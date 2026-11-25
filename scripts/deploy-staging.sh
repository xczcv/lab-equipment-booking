#!/usr/bin/env bash
set -euo pipefail

: "${RENDER_API_KEY:?Set staging environment secret RENDER_API_KEY}"
: "${RENDER_SERVICE_ID:?Set staging environment variable RENDER_SERVICE_ID}"
: "${STAGING_URL:?Set staging environment variable STAGING_URL}"
: "${GITHUB_SHA:?GITHUB_SHA is required}"

remote=$(git ls-remote --exit-code origin refs/heads/main)
if [[ "${remote%%$'\t'*}" != "$GITHUB_SHA" ]]; then
  echo 'A newer main commit is awaiting its own quality checks.'
  exit 0
fi

deploys="https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys"
payload=$(jq -nc --arg sha "$GITHUB_SHA" '{commitId: $sha}')
id=$(curl --fail-with-body --silent --show-error --max-time 30 \
  --header "Authorization: Bearer $RENDER_API_KEY" \
  --header 'Content-Type: application/json' --data "$payload" "$deploys" | jq -er '.id')
echo "Started Render deploy $id for $GITHUB_SHA"

for ((attempt = 0; attempt < 80; attempt += 1)); do
  phase=$(curl --fail --silent --show-error --max-time 15 \
    --header "Authorization: Bearer $RENDER_API_KEY" "$deploys/$id" | jq -er '.status')
  case "$phase" in
    live)
      url=${STAGING_URL%/}
      curl --fail --silent --show-error --retry 4 --max-time 10 "$url/ready" | jq -e '.status == "ready"'
      curl --fail --silent --show-error --retry 4 --max-time 10 "$url/version" | jq -e --arg sha "$GITHUB_SHA" '.sha == $sha'
      exit 0
      ;;
    *_failed|canceled|cancelled|deactivated)
      echo "Render deploy finished with $phase" >&2
      exit 1
      ;;
  esac
  sleep 10
done
echo "Timed out waiting for Render deploy $id" >&2
exit 1
