# xswarm-ai-sanitize

**Secret detection for AI agents** — 600+ patterns, plugins for LangChain, LlamaIndex, Vercel AI, OpenClaw, Nanobot, and more.

[![npm version](https://img.shields.io/npm/v/xswarm-ai-sanitize.svg)](https://www.npmjs.com/package/xswarm-ai-sanitize)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why This Matters

AI agents are increasingly given access to sensitive data sources: email inboxes, cloud storage, internal documents, and databases. This creates a critical security vulnerability:

```
User: "Search my emails for 'deployment'"
Agent: *searches Gmail*
Email contains: "Deploy with AWS_KEY=AKIAIOSFODNN7EXAMPLE"
Agent: *stores in memory/logs*
→ API key now persists in agent memory forever
```

**xswarm-ai-sanitize** sits between your AI agent and external data sources to automatically detect and redact secrets **before** they reach your agent's memory.

## Quick Start

```bash
npx xswarm-ai-sanitize
```

This launches an interactive wizard that:
1. Detects which AI frameworks you have installed
2. Shows integration options for each framework
3. Provides copy-paste code examples

## Framework Integrations

| Framework | Plugin | Status |
|-----------|--------|--------|
| **LangChain** | `xswarm-ai-sanitize/plugins/langchain` | ✅ Ready |
| **LlamaIndex** | `xswarm-ai-sanitize/plugins/llamaindex` | ✅ Ready |
| **Vercel AI SDK** | `xswarm-ai-sanitize/plugins/vercel-ai` | ✅ Ready |
| **OpenClaw** | `xswarm-ai-sanitize/plugins/openclaw` | ✅ Ready |
| **Nanobot** | `xswarm-ai-sanitize/plugins/nanobot` | ✅ Ready |
| **xSwarm** | `xswarm-ai-sanitize/plugins/xswarm` | 🔜 Coming |

### LangChain

```javascript
import { createSanitizeCallback, wrapTool } from 'xswarm-ai-sanitize/plugins/langchain';

// Option 1: Use callback handler
const chain = new LLMChain({
  llm,
  prompt,
  callbacks: [createSanitizeCallback({ mode: 'sanitize' })]
});

// Option 2: Wrap individual tools
const safeTool = wrapTool(myTool, { mode: 'sanitize' });
```

### LlamaIndex

```javascript
import { createSanitizePostprocessor } from 'xswarm-ai-sanitize/plugins/llamaindex';

const queryEngine = index.asQueryEngine({
  nodePostprocessors: [createSanitizePostprocessor({ mode: 'sanitize' })]
});
```

### Vercel AI SDK

```javascript
import { sanitizeMiddleware, sanitizeTool } from 'xswarm-ai-sanitize/plugins/vercel-ai';

// Option 1: Use middleware
const result = await generateText({
  model,
  prompt,
  experimental_middleware: sanitizeMiddleware({ mode: 'sanitize' })
});

// Option 2: Wrap tools
const tools = {
  searchEmails: sanitizeTool(emailSearchTool, { mode: 'sanitize' })
};
```

### OpenClaw

```javascript
import createSanitizePlugin from 'xswarm-ai-sanitize/plugins/openclaw';

export default createSanitizePlugin({ mode: 'sanitize' });
```

### Nanobot (MCP)

```javascript
import { createSanitizeFilter } from 'xswarm-ai-sanitize/plugins/nanobot';

export default createSanitizeFilter({ mode: 'sanitize' });
```

## CLI Usage

For direct text sanitization:

```bash
# Pipe text through sanitizer
cat .env | npx xswarm-ai-sanitize sanitize -q

# Block mode (exit 1 if secrets found)
npx xswarm-ai-sanitize sanitize --block config.yml

# From file
npx xswarm-ai-sanitize sanitize myfile.txt
```

## Node.js API

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

// SANITIZE Mode - Always clean, never block
const result = sanitize(content, { mode: 'sanitize' });
console.log(result.sanitized); // Secrets replaced with [REDACTED:type]
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
| And more... | CRM, Analytics, Maps, Blockchain, IoT, etc. | 300+ |

### Entropy Analysis

Detects high-randomness strings that may be secrets without known prefixes:
- Shannon entropy calculation (threshold: 4.5)
- Minimum length filter (16 chars)
- Used as secondary validation for generic patterns

## Key Features

- **Zero Dependencies** — Uses only Node.js built-ins
- **Fully Synchronous** — No async, no Promises, no network calls
- **Fast** — <5ms for typical documents
- **Privacy-First** — All processing local, zero external API calls

## Performance

- 1KB content: <1ms
- 10KB content: <5ms
- 100KB content: <50ms
- Pattern compilation: one-time at module load

## Installation

```bash
npm install xswarm-ai-sanitize
```

## Testing

```bash
npm test
```

## License

MIT

## Links

- [GitHub Repository](https://github.com/chadananda/xswarm-ai-sanitize)
- [npm Package](https://www.npmjs.com/package/xswarm-ai-sanitize)
- [xSwarm](https://xswarm.ai)
