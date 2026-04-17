#!/usr/bin/env bash
# Zenbu install/reinstall script.
#
# - Idempotent: every ensure_* function reads state first and no-ops if satisfied.
# - Emits machine-readable ##ZENBU_STEP: lines for the Electron setup window.
#   Harmless prints when run in a terminal.
# - Canonical entry point: first-install (from setup window) and `zen doctor`.
# - macOS-only today; shape generalizes for Linux/Windows later.
#
# Tools (bun, pnpm) are downloaded into the Zenbu-isolated cache tree
# (~/Library/Caches/Zenbu/) so they never collide with the user's toolchain.
# Isolation is via official env vars (BUN_INSTALL, PNPM_HOME, XDG_*) —
# see https://pnpm.io/settings and https://bun.sh/docs/installation.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$SCRIPT_DIR"
REPO_URL="https://github.com/zenbu-labs/zenbu.git"

HOME_DIR="${HOME}"
CACHE_ROOT="${HOME_DIR}/Library/Caches/Zenbu"
BIN_DIR="${CACHE_ROOT}/bin"
export BUN_INSTALL="${CACHE_ROOT}/bun"
export PNPM_HOME="${CACHE_ROOT}/pnpm"
export XDG_CACHE_HOME="${CACHE_ROOT}/xdg/cache"
export XDG_DATA_HOME="${CACHE_ROOT}/xdg/data"
export XDG_STATE_HOME="${CACHE_ROOT}/xdg/state"

INTERNAL_DIR="${HOME_DIR}/.zenbu/.internal"
REGISTRY_DIR="${HOME_DIR}/.zenbu/registry"
CLI_BIN_DIR="${HOME_DIR}/.zenbu/bin"

PATH_SENTINEL="# added by zenbu"
ZEN_SHIM="${CLI_BIN_DIR}/zen"

VERSIONS_JSON="${REPO_DIR}/setup/versions.json"

# Prepend our isolated bin dir so downloaded bun/pnpm take precedence.
export PATH="${BIN_DIR}:${PATH}"

# ---------- UI protocol helpers ----------

step_start() { printf "##ZENBU_STEP:start:%s:%s\n" "$1" "$2"; }
step_done()  { printf "##ZENBU_STEP:done:%s\n" "$1"; }
step_error() { printf "##ZENBU_STEP:error:%s:%s\n" "$1" "$2"; }
step_offer() { printf "##ZENBU_STEP:offer-install:%s:%s\n" "$1" "$2"; }
step_progress() { printf "##ZENBU_STEP:download:%s:%s\n" "$1" "$2"; }

log_ok()   { printf "  ✓ %s\n" "$1"; }
log_do()   { printf "  → %s\n" "$1"; }

# Read a top-level string field from versions.json (bun/pnpm version etc).
# Simple jq-free JSON extraction: grep + awk. Good enough for our own file.
read_version() {
  local tool="$1"
  local field="$2"
  awk -v tool="\"$tool\"" -v field="\"$field\"" '
    BEGIN { depth=0; in_tool=0 }
    /\{/ { depth++ }
    /\}/ { depth-- }
    $0 ~ tool":" { in_tool=1; next }
    in_tool && depth >= 2 && $0 ~ field {
      gsub(/^[ \t]+|[ \t,]+$/, "")
      match($0, /"[^"]*"[ \t]*:[ \t]*"[^"]*"/)
      if (RSTART > 0) {
        val = substr($0, RSTART, RLENGTH)
        sub(/^"[^"]*"[ \t]*:[ \t]*"/, "", val)
        sub(/"$/, "", val)
        print val
        exit
      }
    }
  ' "$VERSIONS_JSON"
}

# Read a nested target field (sha256 or asset) for bun/pnpm given a target key.
read_target_field() {
  local tool="$1"
  local target_key="$2"
  local field="$3"
  python3 - "$VERSIONS_JSON" "$tool" "$target_key" "$field" <<'PY'
import json, sys
path, tool, target_key, field = sys.argv[1:5]
with open(path) as f:
    data = json.load(f)
print(data[tool]["targets"][target_key][field])
PY
}

detect_bun_target() {
  case "$(uname -m)" in
    arm64|aarch64) echo "darwin-aarch64" ;;
    x86_64)        echo "darwin-x64" ;;
    *)             echo ""; return 1 ;;
  esac
}

detect_pnpm_target() {
  case "$(uname -m)" in
    arm64|aarch64) echo "darwin-arm64" ;;
    x86_64)        echo "darwin-x64" ;;
    *)             echo ""; return 1 ;;
  esac
}

verify_sha256() {
  local file="$1" expected="$2"
  local actual
  actual="$(shasum -a 256 "$file" | awk '{print $1}')"
  if [ "$actual" != "$expected" ]; then
    printf "sha256 mismatch: expected %s, got %s\n" "$expected" "$actual" >&2
    return 1
  fi
  return 0
}

# ---------- ensure_* steps ----------

ensure_dirs() {
  mkdir -p "$BIN_DIR" "$BUN_INSTALL" "$PNPM_HOME" \
    "$XDG_CACHE_HOME" "$XDG_DATA_HOME" "$XDG_STATE_HOME" \
    "$INTERNAL_DIR" "$REGISTRY_DIR" "$CLI_BIN_DIR"
}

ensure_git() {
  if ! command -v git >/dev/null 2>&1; then
    step_offer xcode-cli "xcode-select --install"
    echo "git not found — install Xcode Command Line Tools" >&2
    return 1
  fi
  # Detect the stub (xcode-select not fully configured).
  if ! git --version >/dev/null 2>&1; then
    step_offer xcode-cli "xcode-select --install"
    echo "git stub — install Xcode Command Line Tools" >&2
    return 1
  fi
  log_ok "git: $(command -v git)"
}

ensure_bun() {
  local target version asset url sha expected_sha
  target="$(detect_bun_target)"
  if [ -z "$target" ]; then
    echo "unsupported architecture: $(uname -m)" >&2
    return 1
  fi
  version="$(read_version bun version)"
  asset="$(read_target_field bun "$target" asset)"
  expected_sha="$(read_target_field bun "$target" sha256)"
  # Version marker — simple "did we install exactly this?" check.
  local marker="${BIN_DIR}/.bun.version"
  local current=""
  if [ -f "$marker" ]; then current="$(cat "$marker" 2>/dev/null || true)"; fi
  if [ -x "${BIN_DIR}/bun" ] && [ "$current" = "$version" ]; then
    log_ok "bun $version already installed"
    return
  fi
  local tag="bun-v${version}"
  url="https://github.com/oven-sh/bun/releases/download/${tag}/${asset}"
  local tmpdir
  tmpdir="$(mktemp -d)"
  local zip_path="${tmpdir}/${asset}"
  log_do "downloading bun $version"
  curl -fL --progress-bar -o "$zip_path" "$url"
  verify_sha256 "$zip_path" "$expected_sha"
  (cd "$tmpdir" && unzip -q "$asset")
  # bun releases extract to a dir like bun-darwin-aarch64/bun
  local extracted
  extracted="$(find "$tmpdir" -type f -name bun -perm -u+x | head -1)"
  if [ -z "$extracted" ]; then
    echo "could not locate bun binary in $asset" >&2
    return 1
  fi
  install -m 0755 "$extracted" "${BIN_DIR}/bun"
  printf "%s" "$version" > "$marker"
  rm -rf "$tmpdir"
  log_ok "bun $version installed"
}

ensure_pnpm() {
  local target version asset url expected_sha
  target="$(detect_pnpm_target)"
  if [ -z "$target" ]; then
    echo "unsupported architecture: $(uname -m)" >&2
    return 1
  fi
  version="$(read_version pnpm version)"
  asset="$(read_target_field pnpm "$target" asset)"
  expected_sha="$(read_target_field pnpm "$target" sha256)"
  local marker="${BIN_DIR}/.pnpm.version"
  local current=""
  if [ -f "$marker" ]; then current="$(cat "$marker" 2>/dev/null || true)"; fi
  if [ -x "${BIN_DIR}/pnpm" ] && [ "$current" = "$version" ]; then
    log_ok "pnpm $version already installed"
    return
  fi
  local tag="v${version}"
  url="https://github.com/pnpm/pnpm/releases/download/${tag}/${asset}"
  local tmp="${BIN_DIR}/.pnpm.download"
  log_do "downloading pnpm $version"
  curl -fL --progress-bar -o "$tmp" "$url"
  verify_sha256 "$tmp" "$expected_sha"
  chmod +x "$tmp"
  mv "$tmp" "${BIN_DIR}/pnpm"
  printf "%s" "$version" > "$marker"
  log_ok "pnpm $version installed"
}

ensure_remote() {
  if [ ! -d ".git" ]; then
    git init -q
    git remote add origin "$REPO_URL"
    git fetch --depth 1 origin main -q
    git reset origin/main -q
    log_ok "linked to remote"
  fi
}

ensure_deps_installed() {
  # Full output (no --silent) so real errors surface in the setup window log.
  "${BIN_DIR}/pnpm" install --filter='!@zenbu/kernel'
}

ensure_tsconfig_local() {
  local packages_dir tsconfig
  packages_dir="${REPO_DIR}/packages"
  tsconfig="${REPO_DIR}/packages/init/tsconfig.local.json"
  local expected
  expected=$(cat <<EOF
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/renderer/*"],
      "@testbu/*": ["${packages_dir}/*"],
      "#registry/*": ["${REGISTRY_DIR}/*"]
    }
  },
  "include": ["src", "shared", "test", "${REGISTRY_DIR}"]
}
EOF
)
  if [ -f "$tsconfig" ] && [ "$(cat "$tsconfig")" = "$expected" ]; then
    return
  fi
  printf "%s\n" "$expected" > "$tsconfig"
}

ensure_kernel_manifest_registered() {
  local config_json="${HOME_DIR}/.zenbu/config.json"
  local kernel_manifest="${REPO_DIR}/packages/init/zenbu.plugin.json"
  local zen_manifest="${REPO_DIR}/packages/zen/zenbu.plugin.json"
  mkdir -p "$(dirname "$config_json")"
  if [ ! -f "$config_json" ]; then
    printf '{\n  "plugins": []\n}\n' > "$config_json"
  fi
  python3 - "$config_json" "$kernel_manifest" "$zen_manifest" <<'PY'
import json, sys, os
cfg_path, *manifests = sys.argv[1:]
with open(cfg_path) as f:
    cfg = json.load(f)
plugins = cfg.setdefault("plugins", [])
changed = False
for m in manifests:
    if not os.path.exists(m):
        continue
    if m not in plugins:
        plugins.append(m)
        changed = True
if changed:
    with open(cfg_path, "w") as f:
        json.dump(cfg, f, indent=2)
    print("  → registered plugin manifests")
else:
    print("  ✓ plugin manifests already registered")
PY
}

ensure_zen_shim() {
  local expected
  expected=$(cat <<'EOF'
#!/usr/bin/env bash
# zen CLI shim — interprets packages/zen/src/bin.ts via isolated bun.
# Refreshed on every setup.sh run.
set -e
PATHS="$HOME/.zenbu/.internal/paths.json"
if [ -f "$PATHS" ]; then
  BUN=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['bunPath'])" "$PATHS" 2>/dev/null || echo "")
  CACHE=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['cacheRoot'])" "$PATHS" 2>/dev/null || echo "")
fi
[ -z "$BUN" ] && BUN="${ZENBU_BUN:-$HOME/Library/Caches/Zenbu/bin/bun}"
[ -z "$CACHE" ] && CACHE="$HOME/Library/Caches/Zenbu"
if [ ! -x "$BUN" ]; then
  # Fallback: user's own bun on PATH. Harmless — our TS uses no bun-specific APIs.
  if command -v bun >/dev/null 2>&1; then
    BUN="$(command -v bun)"
  else
    echo "zen: bun not found. Install via: bash \"$HOME/.zenbu/plugins/zenbu/setup.sh\"" >&2
    echo "     (or launch Zenbu.app once for the setup window to do it)" >&2
    exit 127
  fi
fi
# Only export the Zenbu-isolated toolchain env if our bin tree is populated —
# otherwise leave the user's normal env intact.
if [ -x "$CACHE/bin/pnpm" ]; then
  export BUN_INSTALL="$CACHE/bun"
  export PNPM_HOME="$CACHE/pnpm"
  export XDG_CACHE_HOME="$CACHE/xdg/cache"
  export XDG_DATA_HOME="$CACHE/xdg/data"
  export XDG_STATE_HOME="$CACHE/xdg/state"
  export PATH="$CACHE/bin:$PATH"
fi
exec "$BUN" "$HOME/.zenbu/plugins/zenbu/packages/zen/src/bin.ts" "$@"
EOF
)
  if [ -f "$ZEN_SHIM" ] && [ "$(cat "$ZEN_SHIM")" = "$expected" ]; then
    return
  fi
  printf "%s\n" "$expected" > "$ZEN_SHIM"
  chmod +x "$ZEN_SHIM"
}

ensure_path_wired() {
  local shell_name rc
  shell_name="$(basename "${SHELL:-/bin/zsh}")"
  case "$shell_name" in
    zsh)
      rc="${ZDOTDIR:-$HOME}/.zshrc"
      ;;
    bash)
      rc="$HOME/.bash_profile"
      [ -f "$rc" ] || rc="$HOME/.bashrc"
      ;;
    fish)
      rc="$HOME/.config/fish/config.fish"
      ;;
    *)
      rc="$HOME/.profile"
      ;;
  esac

  mkdir -p "$(dirname "$rc")"
  if [ -f "$rc" ] && grep -Fq "$PATH_SENTINEL" "$rc"; then
    return
  fi
  # Append sentinel + export line for the detected shell
  if [ "$shell_name" = "fish" ]; then
    printf '\n%s\nset -x PATH $HOME/.zenbu/bin $PATH\n' "$PATH_SENTINEL" >> "$rc"
  else
    printf '\n%s\nexport PATH="$HOME/.zenbu/bin:$PATH"\n' "$PATH_SENTINEL" >> "$rc"
  fi
  log_ok "PATH wired in $rc"
}

ensure_registry_types() {
  # `zen link` looks up from CWD for a zenbu.plugin.json. setup.sh's CWD is
  # the repo root, which has no manifest — pass the manifests explicitly for
  # both plugins so both sections land in ~/.zenbu/registry/.
  "${BIN_DIR}/bun" "${REPO_DIR}/packages/zen/src/bin.ts" link \
    "${REPO_DIR}/packages/init/zenbu.plugin.json"
  "${BIN_DIR}/bun" "${REPO_DIR}/packages/zen/src/bin.ts" link \
    "${REPO_DIR}/packages/zen/zenbu.plugin.json"
}

ensure_db_config() {
  local db_path="${REPO_DIR}/packages/init/.zenbu/db"
  local db_json="${INTERNAL_DIR}/db.json"
  python3 - "$db_json" "$db_path" <<'PY'
import json, sys, os
out, db = sys.argv[1:]
prev = {}
if os.path.exists(out):
    try:
        with open(out) as f: prev = json.load(f)
    except Exception: prev = {}
if prev.get("dbPath") == db:
    print("  ✓ db.json already current")
else:
    with open(out, "w") as f:
        json.dump({"dbPath": db}, f, indent=2)
    print("  → wrote", out)
PY
}

ensure_app_path() {
  local default="/Applications/Zenbu.app/Contents/MacOS/Zenbu"
  if [ -x "$default" ]; then
    "${BIN_DIR}/bun" "${REPO_DIR}/packages/zen/src/bin.ts" \
      config set appPath "$default" 2>/dev/null || true
  fi
}

# ---------- grouped step runner ----------
# Run a group of silent ensure_* functions as one visible setup-window step.
# Streams the group's stdout/stderr into the log; on failure, emits
# ##ZENBU_STEP:error with the last stderr line so the UI has something useful.

run_step() {
  local id="$1" label="$2"
  shift 2
  step_start "$id" "$label"
  local errfile
  errfile="$(mktemp)"
  # Run the group, tee stderr so we can grab the last line on failure.
  if "$@" 2> >(tee "$errfile" >&2); then
    step_done "$id"
    rm -f "$errfile"
  else
    local code=$?
    local last_err
    last_err="$(tail -n 1 "$errfile" 2>/dev/null | tr '\n' ' ' | sed 's/^ *//;s/ *$//')"
    rm -f "$errfile"
    if [ -z "$last_err" ]; then last_err="step failed (exit $code)"; fi
    step_error "$id" "$last_err"
    exit "$code"
  fi
}

group_prepare() {
  ensure_dirs
  ensure_git
}
group_toolchain() {
  ensure_bun
  ensure_pnpm
}
group_install() {
  ensure_remote
  ensure_deps_installed
}
group_wire() {
  ensure_tsconfig_local
  ensure_kernel_manifest_registered
  ensure_zen_shim
  ensure_path_wired
  ensure_db_config
  ensure_app_path
}
group_types() {
  ensure_registry_types
}

# ---------- main ----------

cd "$REPO_DIR"

run_step prepare   "Checking git"            group_prepare
run_step toolchain "Installing bun + pnpm"   group_toolchain
run_step install   "Installing packages"     group_install
run_step types     "Generating registry"     group_types
run_step wire      "Wiring environment"      group_wire

printf "\n##ZENBU_STEP:all-done\n"
