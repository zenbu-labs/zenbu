#!/usr/bin/env bash
# Swap apps/kernel/node_modules with a flat (hoisted) deploy before
# running electron-builder.
#
# Why: electron-builder's pnpm mode only walks 1–2 levels of deps past
# each direct dep, missing deep transitives (e.g. tsx → get-tsconfig →
# resolve-pkg-maps). That's how v0.1.0-0.1.7 shipped with "Cannot find
# module" errors for transitives of transitives. Rather than listing
# every transitive as an explicit kernel dep (whack-a-mole), we use
# pnpm's own `deploy --config.node-linker=hoisted` to produce a flat
# node_modules with every prod transitive at top level, then swap it
# into apps/kernel before electron-builder runs. electron-builder's
# collector now has a clean npm-style tree to walk.
#
# See:
#   https://pnpm.io/cli/deploy
#   https://github.com/electron-userland/electron-builder/issues/6289
#   https://github.com/electron-userland/electron-builder/issues/7555
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KERNEL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE_DIR="$(cd "$KERNEL_DIR/../.." && pwd)"
STAGING="${STAGING_DIR:-/tmp/zenbu-kernel-flat-deploy}"

cd "$WORKSPACE_DIR"

echo "[prep-flat-deploy] staging at $STAGING"
rm -rf "$STAGING"

echo "[prep-flat-deploy] pnpm deploy with node-linker=hoisted"
pnpm --filter=@zenbu/kernel --prod --config.node-linker=hoisted deploy "$STAGING"

# Preserve devDep binaries we still need (electron-builder itself, electron
# for @electron/rebuild). Keeping the original node_modules under a sidecar
# name and linking just the bins.
DEV_BACKUP="$KERNEL_DIR/.node_modules.dev"
rm -rf "$DEV_BACKUP"
mv "$KERNEL_DIR/node_modules" "$DEV_BACKUP"

echo "[prep-flat-deploy] swapping in flat node_modules"
mv "$STAGING/node_modules" "$KERNEL_DIR/node_modules"

# Link the bins + native electron package from the dev tree so
# `pnpm exec electron-builder` still finds them.
mkdir -p "$KERNEL_DIR/node_modules/.bin"
ln -sf "../../.node_modules.dev/.bin/electron-builder" "$KERNEL_DIR/node_modules/.bin/electron-builder"
for pkg in electron electron-builder app-builder-bin; do
  src="$DEV_BACKUP/$pkg"
  if [ -e "$src" ] && [ ! -e "$KERNEL_DIR/node_modules/$pkg" ]; then
    ln -sf "../.node_modules.dev/$pkg" "$KERNEL_DIR/node_modules/$pkg"
  fi
done

echo "[prep-flat-deploy] done — apps/kernel/node_modules is now flat"
echo "[prep-flat-deploy] top-level package count: $(ls "$KERNEL_DIR/node_modules" | wc -l | tr -d ' ')"
