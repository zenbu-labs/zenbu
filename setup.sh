#!/usr/bin/env bash
set -euo pipefail

# Future: declarative dependency system (like a Dockerfile for plugin deps)
# e.g. require git, require pnpm, require node >= 22, etc.

check() {
  if ! command -v "$1" &>/dev/null; then
    echo "ERROR: $1 is required but not installed."
    echo "  Install it from: $2"
    exit 1
  fi
  echo "  ✓ $1 found: $(command -v "$1")"
}

echo "Checking dependencies..."
check git "https://git-scm.com"
check node "https://nodejs.org"
check pnpm "https://pnpm.io/installation"

echo ""
echo "Linking to remote..."
if [ ! -d ".git" ]; then
  git init
  git remote add origin https://github.com/RobPruzan/zenbu.git
  git fetch --depth 1 origin main
  git reset origin/main
  echo "  ✓ linked to remote"
else
  echo "  ✓ already a git repo"
fi

echo ""
echo "Installing packages (skipping shell)..."
pnpm install --filter='!@zenbu/kernel'

echo ""
echo "Generating tsconfig.local.json..."
PACKAGES_DIR="$(cd "$(dirname "$0")/packages" && pwd)"
REGISTRY_DIR="${HOME}/.zenbu/registry"
mkdir -p "${REGISTRY_DIR}"
cat > packages/init/tsconfig.local.json <<EOF
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/renderer/*"],
      "@testbu/*": ["${PACKAGES_DIR}/*"],
      "#registry/*": ["${REGISTRY_DIR}/*"]
    }
  },
  "include": ["src", "shared", "test", "${REGISTRY_DIR}"]
}
EOF
echo "  ✓ wrote packages/init/tsconfig.local.json"

echo ""
echo "Setup complete."
