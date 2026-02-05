# xswarm-ai-sanitize

**Fast regex secret detection and redaction** — 600+ patterns plus Shannon entropy analysis, zero dependencies

[![npm version](https://img.shields.io/npm/v/xswarm-ai-sanitize.svg)](https://www.npmjs.com/package/xswarm-ai-sanitize)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why This Matters

AI agents are increasingly given access to sensitive data sources: email inboxes, cloud storage, internal documents, and databases. This creates a critical security vulnerability:

```
User: "Search my emails for 'deployment'"
Agent: *searches Gmail*
Email contains: "Deploy with AWS_KEY=AKIAIOSFODNN7EXAMPLE"
Agent: *stores in memory/logs*
 API key now persists in agent memory forever
```

**xswarm-ai-sanitize** sits between your AI agent and external data sources to automatically detect and redact secrets **before** they reach your agent's memory.

## Key Features

- **Two Operational Modes**
  - **BLOCK Mode**: Reject content if too many secrets are found
  - **SANITIZE Mode**: Always-clean mode that redacts secrets and passes content through

- **Dual Detection Strategy**
  - **Pattern-based**: 600+ secret patterns covering all major platforms (fast, <5ms)
  - **Entropy-based**: Shannon entropy analysis catches secrets without known prefixes

- **Zero Dependencies** — Uses only Node.js built-ins
- **Fully Synchronous** — No async, no Promises, no network calls
- **Privacy-First** — All processing local, zero external API calls

## Installation

```bash
npm install xswarm-ai-sanitize
```

### CLI Usage

```bash
# Use with npx
npx xswarm-ai-sanitize myfile.txt

# Or install globally
npm install -g xswarm-ai-sanitize
xswarm-ai-sanitize myfile.txt
```

Optional: Install `chokidar` for file watcher plugin:
```bash
npm install chokidar
```

## Quick Start

### CLI

**Sanitize a file** (redact secrets):
```bash
npx xswarm-ai-sanitize config.yml
```

**Block mode** (reject if secrets found):
```bash
npx xswarm-ai-sanitize --block production.log
# Exits with code 1 if secrets detected
```

**From stdin**:
```bash
cat .env | npx xswarm-ai-sanitize -q > safe.env
```

### Node.js API

```javascript
import sanitize from 'xswarm-ai-sanitize';

// BLOCK Mode - Reject content with too many secrets
const result = sanitize(emailContent, {
  mode: 'block',
  blockThreshold: {
    secrets: 3,        // Block if 3+ secrets found
    highSeverity: 1    // Always block high-severity threats
  }
});

if (result.blocked) {
  throw new Error(`Secrets detected: ${result.reason}`);
}

// Safe to process
processContent(result.sanitized);
```

```javascript
// SANITIZE Mode - Always clean, never block
const result = sanitize(memoryFile, {
  mode: 'sanitize'
});

// Secrets redacted
saveToMemory(result.sanitized);
```

## Use Cases

### Email Assistant Protection

```javascript
import sanitize from 'xswarm-ai-sanitize';

const email = await gmail.fetch(messageId);
const clean = sanitize(email.body, { mode: 'sanitize' });
// Secrets never reach agent memory
```

### Agent Memory Cleanup

```javascript
import createWatcher from 'xswarm-ai-sanitize/plugins/watcher';

const watcher = createWatcher(['~/.agent/memory/**/*.md'], {
  mode: 'sanitize'
});
// All memory writes automatically cleaned
```

### OpenClaw Framework Integration

```javascript
import createOpenClawPlugin from 'xswarm-ai-sanitize/plugins/openclaw';

export default createOpenClawPlugin({
  mode: 'block'
});
// Every external tool result filtered automatically
```

## API Reference

### `sanitize(content, options)` — synchronous

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `'block' \| 'sanitize'` | *required* | Operating mode |
| `blockThreshold.secrets` | `number` | `3` | Block if this many secrets found |
| `blockThreshold.highSeverity` | `number` | `1` | Block if any high-severity threats |

#### Return Value

```javascript
{
  blocked: boolean,       // true if content was blocked (BLOCK mode only)
  safe: boolean,          // true if no threats found
  sanitized: string,      // Cleaned content (secrets replaced with [REDACTED:type])
  threats: {
    secrets: number,      // Count of secrets found
    details: [...]        // Array of { type, severity, position }
  },
  reason: string,         // If blocked, explanation why
  actions: string[]       // ['secrets_redacted'] if in SANITIZE mode
}
```

## Detection Capabilities

### Secret Patterns (600+)

| Category | Examples | Count |
|----------|----------|-------|
| AI/ML Providers | OpenAI, Anthropic, Hugging Face, Groq, Cohere | 25+ |
| Cloud Providers | AWS, Azure, GCP, DigitalOcean, Linode, Vultr | 40+ |
| Version Control | GitHub, GitLab, Bitbucket, Gitea | 25+ |
| CI/CD | CircleCI, Travis, Jenkins, Buildkite, Vercel | 25+ |
| Payment | Stripe, PayPal, Square, Plaid, Coinbase | 25+ |
| Communication | Slack, Discord, Telegram, Twilio, SendGrid | 30+ |
| Databases | MongoDB, PostgreSQL, MySQL, Redis, Supabase | 30+ |
| Auth/Identity | Auth0, Okta, Clerk, Keycloak, Firebase | 20+ |
| Monitoring | Datadog, New Relic, Sentry, Grafana, PagerDuty | 25+ |
| Infrastructure | Docker, Kubernetes, Terraform, Vault, Consul | 20+ |
| Cryptographic Keys | RSA, EC, DSA, SSH, PGP, PKCS | 15+ |
| Package Managers | NPM, PyPI, RubyGems, NuGet, Cargo | 10+ |
| Generic | API keys, secrets, passwords, connection strings | 20+ |
| And more... | CRM, Analytics, Maps, Blockchain, IoT, etc. | 200+ |

### Entropy Analysis

Detects high-randomness strings that may be secrets without known prefixes:
- Shannon entropy calculation (threshold: 4.5)
- Minimum length filter (16 chars)
- Used as secondary validation for generic patterns (`checkEntropy: true`)

## Performance

- 1KB content: <1ms
- 10KB content: <5ms
- 100KB content: <50ms
- Pattern compilation: one-time at module load

## Architecture

```
External Data -> xswarm-ai-sanitize -> AI Agent
                       |
              [Pattern Detection]
                       |
              [Entropy Analysis]
                       |
                  [Decision]
                       |
          BLOCK or SANITIZE -> Clean Data
```

### Design Principles

1. **Zero Dependencies**: Uses built-in crypto, fs, Map
2. **Fully Synchronous**: No async, no network calls
3. **Performance**: Pattern compilation at module load (<5ms per scan)
4. **Cache-Enabled**: LRU cache with 5-minute TTL (1000 entries)

## Testing

```bash
npm test
npm run test:coverage
```

## License

MIT

## Links

- [GitHub Repository](https://github.com/chadananda/xswarm-ai-sanitize)
- [npm Package](https://www.npmjs.com/package/xswarm-ai-sanitize)
- [Issue Tracker](https://github.com/chadananda/xswarm-ai-sanitize/issues)
- [xSwarm](https://xswarm.ai)
