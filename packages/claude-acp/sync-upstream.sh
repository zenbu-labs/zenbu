#!/bin/bash
set -euo pipefail

REPO="https://github.com/agentclientprotocol/claude-agent-acp"
BRANCH="${1:-main}"
TEMP=$(mktemp -d)
trap 'rm -rf "$TEMP"' EXIT

echo "Cloning $REPO ($BRANCH)..."
git clone --depth 1 --branch "$BRANCH" "$REPO" "$TEMP"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

rsync -av --delete "$TEMP/src/" "$SCRIPT_DIR/src/"
cp "$TEMP/vitest.config.ts" "$SCRIPT_DIR/vitest.config.ts"

echo ""
echo "Synced from $REPO ($BRANCH)"
echo "Review changes: git diff packages/claude-acp/"
echo ""
echo "NOTE: package.json, tsconfig.json, and sync-upstream.sh are NOT synced (we maintain our own)."
echo "Check upstream package.json for new/changed dependencies:"
echo "  cat $TEMP/package.json  (temp dir already cleaned up -- re-run with inspection if needed)"
