#!/bin/bash

# npm Deployment Script for xswarm-ai-sanitize
# Handles testing, versioning, and publishing with new npm security requirements

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================"
echo "xswarm-ai-sanitize Deployment Script"
echo -e "======================================${NC}"
echo

# Function to print status messages
info() {
  echo -e "${BLUE}→${NC} $1"
}

success() {
  echo -e "${GREEN}✓${NC} $1"
}

error() {
  echo -e "${RED}✗${NC} $1"
}

warning() {
  echo -e "${YELLOW}⚠${NC}  $1"
}

# Parse arguments
VERSION_TYPE="${1:-minor}"  # Default to minor version bump

if [[ ! "$VERSION_TYPE" =~ ^(major|minor|patch)$ ]]; then
  error "Invalid version type: $VERSION_TYPE"
  echo "Usage: npm run deploy [major|minor|patch]"
  echo "  major: Breaking changes (1.0.0 → 2.0.0)"
  echo "  minor: New features (1.0.0 → 1.1.0) [default]"
  echo "  patch: Bug fixes (1.0.0 → 1.0.1)"
  exit 1
fi

info "Version bump type: $VERSION_TYPE"
echo

# Step 1: Check if we're in the right directory
info "Step 1: Checking directory..."
if [ ! -f "package.json" ] || [ ! -f "bin/cli.js" ]; then
  error "Not in xswarm-ai-sanitize root directory"
  exit 1
fi
success "In correct directory"
echo

# Step 2: Check npm version
info "Step 2: Checking npm version..."
NPM_VERSION=$(npm --version)
REQUIRED_VERSION="11.5.1"
if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NPM_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
  warning "npm version $NPM_VERSION is older than recommended $REQUIRED_VERSION"
  echo "  Run: npm install -g npm@latest"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
else
  success "npm version $NPM_VERSION is up to date"
fi
echo

# Step 3: Check npm authentication
info "Step 3: Checking npm authentication..."
if npm whoami &>/dev/null; then
  NPM_USER=$(npm whoami)
  success "Logged in as: $NPM_USER"
else
  error "Not logged in to npm"
  echo
  info "Please log in to npm (requires 2FA):"
  npm login
  if npm whoami &>/dev/null; then
    success "Successfully logged in as: $(npm whoami)"
  else
    error "Login failed"
    exit 1
  fi
fi
echo

# Step 4: Run functional tests
info "Step 4: Running functional tests..."
if [ -f "test-real-functionality.sh" ]; then
  if ./test-real-functionality.sh; then
    success "All functional tests passed"
  else
    error "Functional tests failed"
    exit 1
  fi
else
  warning "Functional test script not found, skipping..."
fi
echo

# Step 5: Run npm tests
info "Step 5: Running npm test suite..."
if npm test; then
  success "npm tests passed"
else
  error "npm tests failed"
  exit 1
fi
echo

# Step 6: Check git status
info "Step 6: Checking git status..."
if [ -n "$(git status --porcelain)" ]; then
  warning "Uncommitted changes detected"
  git status --short
  echo
  read -p "Commit changes? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    info "Staging changes..."
    git add -A

    echo
    info "Enter commit message (or press Enter for default):"
    read -r COMMIT_MSG

    if [ -z "$COMMIT_MSG" ]; then
      COMMIT_MSG="feat: Add CLI tool with AI provider pattern support

- Add comprehensive CLI tool accessible via npx
- Add 4 new AI provider secret patterns (Anthropic, OpenAI, Cohere)
- Create extensive CLI documentation and test suite (90+ tests)
- Update README with CLI quick start
- Zero dependencies, pattern-only mode

Features:
- Sanitize and block modes
- File and stdin input
- Exit codes for CI/CD
- 48 secret patterns + 27 injection patterns
"
    fi

    git commit -m "$COMMIT_MSG"
    success "Changes committed"
  else
    error "Deployment cancelled - commit changes first"
    exit 1
  fi
else
  success "Working directory is clean"
fi
echo

# Step 7: Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
info "Step 7: Current version: $CURRENT_VERSION"
echo

# Step 8: Bump version
info "Step 8: Bumping $VERSION_TYPE version..."
NEW_VERSION=$(npm version $VERSION_TYPE --no-git-tag-version)
success "Version bumped: $CURRENT_VERSION → $NEW_VERSION"
echo

# Step 9: Commit version bump
info "Step 9: Committing version bump..."
git add package.json package-lock.json 2>/dev/null || git add package.json
git commit -m "chore: bump version to $NEW_VERSION"
success "Version bump committed"
echo

# Step 10: Create git tag
info "Step 10: Creating git tag..."
git tag -a "$NEW_VERSION" -m "Release $NEW_VERSION"
success "Tag created: $NEW_VERSION"
echo

# Step 11: Publish to npm
info "Step 11: Publishing to npm..."
warning "This will publish to npm registry (requires 2FA code)"
echo
read -p "Continue with npm publish? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  error "Publish cancelled"
  warning "Version was bumped and committed. To revert:"
  echo "  git reset --hard HEAD~2"
  echo "  git tag -d $NEW_VERSION"
  exit 1
fi

if npm publish; then
  success "Successfully published $NEW_VERSION to npm!"
else
  error "npm publish failed"
  warning "You may need to:"
  echo "  1. Enable 2FA on your npm account"
  echo "  2. Check package name availability"
  echo "  3. Verify npm authentication"
  exit 1
fi
echo

# Step 12: Push to git
info "Step 12: Pushing to git..."
read -p "Push to git remote? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  git push origin master --follow-tags
  success "Pushed to git with tags"
else
  warning "Skipped git push. Don't forget to push manually:"
  echo "  git push origin master --follow-tags"
fi
echo

# Step 13: Summary
echo -e "${GREEN}======================================"
echo "✓ Deployment Complete!"
echo -e "======================================${NC}"
echo
echo "Package: xswarm-ai-sanitize@$NEW_VERSION"
echo "Published to: https://www.npmjs.com/package/xswarm-ai-sanitize"
echo
echo "Users can now run:"
echo "  npx xswarm-ai-sanitize@latest myfile.txt"
echo
echo "Or install:"
echo "  npm install -g xswarm-ai-sanitize@latest"
echo
echo -e "${GREEN}🎉 Success!${NC}"
