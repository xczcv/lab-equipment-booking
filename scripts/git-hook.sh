#!/bin/sh
set -eu

cd "$(git rev-parse --show-toplevel)"
if [ "${0##*/}" = pre-commit ] && ! git diff --quiet; then
  echo 'Stage or stash tracked changes before committing.' >&2
  exit 1
fi
npm run check
