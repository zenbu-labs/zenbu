#!/usr/bin/env bash
# Count @ts-ignore / @ts-expect-error / @ts-nocheck across tracked source files
# and fail when the total exceeds MAX. Uses `git ls-files` so gitignored paths
# (e.g. dist, node_modules, generated caches) are naturally skipped.

set -euo pipefail

MAX="${MAX:-10}"

cd "$(git rev-parse --show-toplevel)"

matches="$(
  git ls-files '*.ts' '*.tsx' '*.mts' '*.cts' '*.mjs' '*.cjs' '*.js' '*.jsx' \
    | xargs -r grep -nE "@ts-(ignore|expect-error|nocheck)" 2>/dev/null \
    || true
)"

count="$(printf '%s' "$matches" | grep -c . || true)"

echo "ts-ignore directives: $count (limit: $MAX)"
if [ "$count" -gt 0 ]; then
  echo "$matches"
fi

if [ "$count" -gt "$MAX" ]; then
  echo "error: $count ts-ignore directives exceed limit of $MAX" >&2
  exit 1
fi
