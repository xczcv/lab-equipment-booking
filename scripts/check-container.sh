#!/bin/sh
set -eu

sha=$(git rev-parse HEAD)
image=$(docker build -q --build-arg "APP_SHA=$sha" .)
echo "Built $image with APP_SHA=$sha"
network=$(docker network create "booking-check-$$")
database=
app=
cleanup() {
  if [ -n "$app" ]; then docker rm -f "$app" >/dev/null; fi
  if [ -n "$database" ]; then docker rm -f "$database" >/dev/null; fi
  docker network rm "$network" >/dev/null
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

database=$(docker run -d --network "$network" --network-alias postgres \
  -e POSTGRES_USER=booking_test -e POSTGRES_PASSWORD=booking_test \
  -e POSTGRES_DB=booking_test postgres:17-alpine)
db_url=postgresql://booking_test:booking_test@postgres:5432/booking_test
tries=0
until docker exec "$database" pg_isready -h 127.0.0.1 -U booking_test >/dev/null 2>&1; do
  tries=$((tries + 1))
  [ "$tries" -lt 30 ] || exit 1
  sleep 1
done
app=$(docker run -d --network "$network" -p 127.0.0.1::3000 \
  -e "DATABASE_URL=$db_url" "$image")
base="http://$(docker port "$app" 3000/tcp)"
curl --silent --show-error --fail --retry-all-errors --retry 20 --retry-delay 1 --max-time 2 "$base/health"
echo

probe() {
  status=$(curl -sS --max-time 5 -w '\n%{http_code}' "$base$1")
  echo "$1 $status"
  [ "${status##*
}" = "$2" ]
}
probe /ready 503
docker run --rm --network "$network" -e "DATABASE_URL=$db_url" "$image" \
  node dist/maintenance/migrate.js indexes
probe /ready 200
probe /version 200
actual=$(curl -fsS "$base/version")
[ "$actual" = "{\"sha\":\"$sha\"}" ]
tries=0
until [ "$(docker inspect --format '{{.State.Health.Status}}' "$app")" = healthy ]; do
  tries=$((tries + 1))
  [ "$tries" -lt 15 ] || exit 1
  sleep 1
done
echo 'Docker health status: healthy'
docker logs "$app"
