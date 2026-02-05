# Deployment Guide

Complete guide for publishing xswarm-ai-sanitize to npm with the new 2026 security requirements.

## Prerequisites

### 1. npm Account Setup

- Create account at [npmjs.com](https://www.npmjs.com/signup)
- **Enable 2FA** (required for publishing)
  - Go to: https://www.npmjs.com/settings/YOUR_USERNAME/profile
  - Enable "Two-Factor Authentication"
  - Choose "Authorization and Publishing" mode

### 2. npm CLI Version

Update to npm 11.5.1+:

```bash
npm install -g npm@latest
npm --version  # Should be 11.5.1 or higher
```

### 3. Authentication

Login to npm (creates 2-hour session token):

```bash
npm login
# Opens browser for authentication
# Enter 2FA code when prompted
```

Verify login:

```bash
npm whoami
# Should show your npm username
```

## Deployment Methods

### Method 1: Automated Deploy Script (Recommended)

The deploy script handles everything automatically:

```bash
cd ~/Desktop/skills/xswarm-ai-sanitize

# Deploy with minor version bump (1.0.0 → 1.1.0)
npm run deploy

# Or specify version type
npm run deploy:major   # Breaking changes (1.0.0 → 2.0.0)
npm run deploy:minor   # New features (1.0.0 → 1.1.0)
npm run deploy:patch   # Bug fixes (1.0.0 → 1.0.1)
```

**What the script does:**

1. ✅ Checks directory and npm version
2. ✅ Verifies npm authentication
3. ✅ Runs functional tests (15 tests)
4. ✅ Runs npm test suite
5. ✅ Checks git status
6. ✅ Commits uncommitted changes (with prompt)
7. ✅ Bumps package version
8. ✅ Creates git tag
9. ✅ Publishes to npm (prompts for 2FA)
10. ✅ Pushes to git with tags

### Method 2: Manual Step-by-Step

If you prefer manual control:

```bash
cd ~/Desktop/skills/xswarm-ai-sanitize

# 1. Run tests
npm test
./test-real-functionality.sh

# 2. Commit changes
git add -A
git commit -m "feat: your changes here"

# 3. Bump version
npm version minor  # or major/patch

# 4. Publish (will prompt for 2FA)
npm publish

# 5. Push to git
git push origin master --follow-tags
```

## npm Security Requirements (2026)

### Key Changes

1. **Classic tokens permanently revoked** (Dec 9, 2025)
2. **Session-based authentication**: Login provides 2-hour session tokens
3. **2FA mandatory** for publishing
4. **Granular tokens**: Max 7 days for publish permissions
5. **Token lifetime**: Max 90 days (after Feb 3, 2026)

### Publishing Methods Supported

#### Local Publishing (What We Use)
- Use `npm login` for 2-hour session
- 2FA required at publish time
- Best for manual/occasional releases

#### Trusted Publishing (For CI/CD)
- Uses GitHub Actions with OIDC
- No tokens needed
- Requires npm CLI 11.5.1+
- See: https://docs.npmjs.com/trusted-publishers/

#### Short-lived Granular Tokens
- Max 7 days for publish permissions
- Create at: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
- Good for automation with expiration

## Version Numbering

Follow semantic versioning:

- **Major** (X.0.0): Breaking changes
  - Changed API
  - Removed features
  - Non-backward compatible changes

- **Minor** (0.X.0): New features
  - New functionality
  - Backward compatible additions
  - New patterns/detection

- **Patch** (0.0.X): Bug fixes
  - Bug fixes
  - Performance improvements
  - Documentation updates

## Pre-deployment Checklist

- [ ] All tests passing (`npm test`)
- [ ] Functional tests passing (`./test-real-functionality.sh`)
- [ ] Documentation updated (README.md, CHANGELOG.md)
- [ ] Git working directory clean
- [ ] npm login active (check with `npm whoami`)
- [ ] 2FA enabled on npm account

## Deployment Workflow

```
Local Changes
    ↓
Run Tests ✓
    ↓
Commit to Git
    ↓
Bump Version (npm version)
    ↓
Create Git Tag
    ↓
npm Publish (with 2FA)
    ↓
Push to GitHub
    ↓
Users can: npx xswarm-ai-sanitize@latest
```

## Troubleshooting

### "Need auth" error

```bash
# Login expired (2-hour session)
npm login
```

### "2FA required" error

Enable 2FA on your npm account:
1. Go to https://www.npmjs.com/settings/YOUR_USERNAME/profile
2. Enable "Two-Factor Authentication"
3. Choose "Authorization and Publishing" mode

### "Package already exists" error

- Check if package name is taken: https://www.npmjs.com/package/xswarm-ai-sanitize
- Or you don't have publish permissions

### "Version already published" error

```bash
# Bump version again
npm version patch  # Increments to next version
npm publish
```

### Tests failing

```bash
# Run tests to see what's failing
npm test
./test-real-functionality.sh

# Fix issues before deploying
```

### Git push rejected

```bash
# Pull latest changes first
git pull origin master --rebase

# Then push
git push origin master --follow-tags
```

## Post-Deployment

### Verify Publication

1. Check npm registry:
   ```bash
   npm view xswarm-ai-sanitize
   ```

2. Test installation:
   ```bash
   npx xswarm-ai-sanitize@latest --help
   ```

3. Check npm page:
   https://www.npmjs.com/package/xswarm-ai-sanitize

### Update Documentation

1. Update CHANGELOG.md with release notes
2. Create GitHub release:
   ```bash
   gh release create v1.1.0 \
     --title "v1.1.0 - CLI Tool Release" \
     --notes "See CHANGELOG.md for details"
   ```

3. Announce on:
   - GitHub Discussions
   - Twitter/Social media
   - Relevant communities

## Rollback

If you need to unpublish (within 72 hours):

```bash
# Deprecate version (recommended)
npm deprecate xswarm-ai-sanitize@1.1.0 "Use version 1.0.0 instead"

# Or unpublish (only if critical security issue)
npm unpublish xswarm-ai-sanitize@1.1.0
```

**Note:** Unpublishing is discouraged and has restrictions. Consider deprecating instead.

## Automated Deployments (Future)

### GitHub Actions with Trusted Publishing

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      id-token: write  # Required for OIDC
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm test
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Configure trusted publishing:
1. Go to npm package settings
2. Enable "Trusted Publishers"
3. Add GitHub repository

## Support

- npm docs: https://docs.npmjs.com
- 2FA guide: https://docs.npmjs.com/about-two-factor-authentication
- Trusted publishing: https://docs.npmjs.com/trusted-publishers/

## Security Best Practices

1. ✅ Always use 2FA
2. ✅ Never commit tokens to git
3. ✅ Use session tokens (2-hour) for local publishing
4. ✅ Use trusted publishing for CI/CD
5. ✅ Regularly rotate long-lived tokens (if used)
6. ✅ Monitor npm account for suspicious activity
7. ✅ Keep npm CLI updated

---

**Ready to deploy?**

```bash
npm run deploy
```

🚀 Good luck!
