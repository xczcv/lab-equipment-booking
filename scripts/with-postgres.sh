#!/bin/sh
set -eu

# CI can supply its own dedicated service container. Local invocations get a fresh database.
if [ -n "${TEST_DATABASE_URL:-}" ]; then
  exec env DATABASE_URL="$TEST_DATABASE_URL" "$@"
fi

container=$(docker run -d --rm -e POSTGRES_USER=booking_test \
  -e POSTGRES_PASSWORD=booking_test -e POSTGRES_DB=booking_test \
  -p 127.0.0.1::5432 postgres:17-alpine)
trap 'docker stop "$container" >/dev/null' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
tries=0
until docker exec "$container" pg_isready -h 127.0.0.1 -U booking_test -d booking_test >/dev/null 2>&1; do
  tries=$((tries + 1))
  if [ "$tries" -ge 30 ]; then
    docker logs "$container" >&2
    exit 1
  fi
  sleep 1
done
address=$(docker port "$container" 5432/tcp)
env DATABASE_URL="postgresql://booking_test:booking_test@$address/booking_test" "$@"
