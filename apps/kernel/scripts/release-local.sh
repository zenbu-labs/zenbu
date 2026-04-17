#!/usr/bin/env bash
set -euo pipefail

# Runs the same release pipeline as CI, but locally.
#
# Usage:
#   pnpm release              # current platform, unsigned, no publish
#   pnpm release --mac        # mac only (signs + notarizes if .env.release present)
#   pnpm release --mac --win  # multiple targets
#   PUBLISH=always pnpm release --mac   # publish to GitHub releases
#
# Put signing/notarization secrets in apps/kernel/.env.release (gitignored).
# See .env.release.example for the variable list.

HERE="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$HERE/.." && pwd)"
cd "$APP_DIR"

if [ -f .env.release ]; then
  echo "Loading .env.release"
  set -a
  # shellcheck disable=SC1091
  source .env.release
  set +a
fi

PUBLISH="${PUBLISH:-never}"

ARGS=("$@")
if [ "${#ARGS[@]}" -eq 0 ]; then
  case "$(uname -s)" in
    Darwin) ARGS=(--mac) ;;
    Linux)  ARGS=(--linux) ;;
    MINGW*|MSYS*|CYGWIN*) ARGS=(--win) ;;
    *) ARGS=(--mac) ;;
  esac
fi

EXTRA=()
# If no signing cert is configured, force identity=null so electron-builder
# doesn't try (and fail) to discover one from the Keychain.
if [ -z "${CSC_LINK:-}" ] && [ -z "${CSC_NAME:-}" ]; then
  EXTRA+=(--config.mac.identity=null)
fi

echo "Building JS bundle..."
pnpm run build

echo "Running electron-builder ${ARGS[*]} --publish $PUBLISH ${EXTRA[*]}"
pnpm exec electron-builder "${ARGS[@]}" --publish "$PUBLISH" "${EXTRA[@]}"
