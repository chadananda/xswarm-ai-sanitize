#!/usr/bin/env bash
set -euo pipefail

#──────────────────────────────────────────────
# xswarm-ai-sanitize deploy script
# Usage:
#   ./scripts/deploy.sh          # publish current version
#   ./scripts/deploy.sh patch    # bump patch, publish
#   ./scripts/deploy.sh minor    # bump minor, publish
#   ./scripts/deploy.sh major    # bump major, publish
#   ./scripts/deploy.sh --dry    # dry run (no actual publish)
#──────────────────────────────────────────────

# ── Fix nvm environment ──────────────────────
# Unset broken lazy-load shell functions and set PATH directly
unset -f node npm npx 2>/dev/null || true
NODE_DIR="$HOME/.nvm/versions/node/v24.13.0/bin"
if [ -d "$NODE_DIR" ]; then
  export PATH="$NODE_DIR:$PATH"
fi

# Verify node is available
if ! command -v node &>/dev/null; then
  echo "Error: node not found. Install Node.js >= 18." >&2
  exit 1
fi

NODE_VERSION=$(node -v)
echo "Using Node $NODE_VERSION ($(which node))"

# ── Parse args ───────────────────────────────
BUMP=""
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    patch|minor|major) BUMP="$arg" ;;
    --dry) DRY_RUN=true ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

# ── Preflight checks ────────────────────────
cd "$(dirname "$0")/.."
echo ""
echo "=== Preflight Checks ==="

# 1. Clean git working tree
if [ -n "$(git status --porcelain)" ]; then
  echo "Warning: Uncommitted changes detected."
  git status --short
  echo ""
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
fi

# 2. npm auth check
echo -n "npm auth: "
if npm whoami 2>/dev/null; then
  echo ""
else
  echo "Not logged in!"
  echo ""
  echo "Run one of these to authenticate:"
  echo "  npm login                    # interactive browser login"
  echo "  npm login --auth-type=legacy # username/password login"
  echo ""
  echo "Or set a token in ~/.npmrc:"
  echo '  //registry.npmjs.org/:_authToken=npm_YOUR_TOKEN_HERE'
  echo ""
  exit 1
fi

# 3. Run tests
echo ""
echo "=== Running Tests ==="
node --test tests/**/*.test.js
echo "All tests passed."

# 4. Check what would be published
echo ""
echo "=== Package Contents ==="
npm pack --dry-run 2>&1 | head -40

# ── Version bump ─────────────────────────────
if [ -n "$BUMP" ]; then
  echo ""
  echo "=== Bumping version ($BUMP) ==="
  npm version "$BUMP" --no-git-tag-version
  NEW_VERSION=$(node -p "require('./package.json').version")
  echo "New version: $NEW_VERSION"

  # Commit and tag
  git add package.json
  git commit -m "chore: bump version to v$NEW_VERSION"
  git tag "v$NEW_VERSION"
  echo "Created git tag v$NEW_VERSION"
fi

CURRENT_VERSION=$(node -p "require('./package.json').version")

# ── Publish ──────────────────────────────────
echo ""
echo "=== Publishing v$CURRENT_VERSION ==="

if [ "$DRY_RUN" = true ]; then
  echo "[DRY RUN] Would publish xswarm-ai-sanitize@$CURRENT_VERSION"
  npm publish --dry-run
else
  read -p "Publish xswarm-ai-sanitize@$CURRENT_VERSION to npm? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi

  npm publish --access public
  echo ""
  echo "Published! https://www.npmjs.com/package/xswarm-ai-sanitize"

  # Push git tag if we bumped
  if [ -n "$BUMP" ]; then
    read -p "Push tag v$CURRENT_VERSION to origin? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      git push && git push --tags
      echo "Pushed to origin."
    fi
  fi
fi

echo ""
echo "Done."
