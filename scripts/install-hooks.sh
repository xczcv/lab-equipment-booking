#!/bin/sh
set -eu

hooks=$(git rev-parse --git-path hooks)
mkdir -p "$hooks"
for hook in pre-commit pre-push; do
  if [ -e "$hooks/$hook" ] && ! cmp -s "$hooks/$hook" scripts/git-hook.sh; then
    echo "Existing hook at $hooks/$hook" >&2
    exit 1
  fi
done
for hook in pre-commit pre-push; do
  cp scripts/git-hook.sh "$hooks/$hook"
  chmod +x "$hooks/$hook"
done
