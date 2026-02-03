# API Documentation

Complete reference for xswarm-ai-sanitize

## Table of Contents

- [Main API](#main-api)
- [Plugins](#plugins)
- [Internal Modules](#internal-modules)
- [Types](#types)

## Main API

### `sanitize(content, options)`

Asynchronous sanitization function with optional AI enhancement.

**Parameters**:
- `content` (string): Content to analyze and sanitize
- `options` (object): Configuration options

**Returns**: `Promise<SanitizeResult>`

**Example**:
```javascript
import sanitize from 'xswarm-ai-sanitize';

const result = await sanitize(content, {
  mode: 'block',
  blockThreshold: { secrets: 3, injections: 2, highSeverity: 1 }
});
```

### `sanitize.sync(content, options)`

Synchronous sanitization (pattern-only, no AI).

**Parameters**:
- `content` (string): Content to analyze
- `options` (object): Configuration options

**Returns**: `SanitizeResult`

**Example**:
```javascript
const result = sanitize.sync(content, { mode: 'sanitize' });
```

## Options

### SanitizeOptions

```typescript
interface SanitizeOptions {
  mode: 'block' | 'sanitize';
  direction?: 'inbound' | 'outbound' | 'storage';
  ai?: AIConfig;
  blockThreshold?: BlockThreshold;
}
```

#### `mode` (required)

Operation mode:
- `'block'`: Antivirus-style - blocks if threats exceed threshold
- `'sanitize'`: Always returns cleaned content, never blocks

#### `direction` (optional)

Data flow context (for future features):
- `'inbound'` (default): External data coming into agent
- `'outbound'`: Agent output going to external systems
- `'storage'`: Persisted data (memory files, logs)

#### `ai` (optional)

AI provider configuration for enhanced detection.

```typescript
interface AIConfig {
  enabled: boolean;
  provider: 'groq' | 'ollama' | 'openai' | 'anthropic' | 'lmstudio';
  model: string;
  endpoint?: string;
  apiKey?: string;
  timeout?: number;  // default: 10000ms
}
```

**Provider-Specific Configuration**:

**Groq**:
```javascript
{
  enabled: true,
  provider: 'groq',
  model: 'llama-3.1-8b-instant',
  apiKey: process.env.GROQ_API_KEY
}
```

**Ollama** (local):
```javascript
{
  enabled: true,
  provider: 'ollama',
  model: 'llama3.1:8b',
  endpoint: 'http://localhost:11434'  // optional
}
```

**OpenAI**:
```javascript
{
  enabled: true,
  provider: 'openai',
  model: 'gpt-4',
  apiKey: process.env.OPENAI_API_KEY
}
```

**Anthropic**:
```javascript
{
  enabled: true,
  provider: 'anthropic',
  model: 'claude-3-opus-20240229',
  apiKey: process.env.ANTHROPIC_API_KEY
}
```

**LM Studio** (local):
```javascript
{
  enabled: true,
  provider: 'lmstudio',
  model: 'local-model',
  endpoint: 'http://localhost:1234'  // optional
}
```

#### `blockThreshold` (optional, BLOCK mode only)

Thresholds for blocking content.

```typescript
interface BlockThreshold {
  secrets?: number;        // default: 3
  injections?: number;     // default: 2
  highSeverity?: number;   // default: 1
}
```

**Behavior**:
- Content is blocked if **any** threshold is met
- High-severity threats include `critical` and `high` severities
- Set to `Infinity` to never block on that category

**Examples**:
```javascript
// Strict: Block on any secret
{ secrets: 1, injections: 2, highSeverity: 1 }

// Permissive: Block only on multiple threats
{ secrets: 10, injections: 10, highSeverity: 3 }

// Never block secrets, but block injections
{ secrets: Infinity, injections: 1, highSeverity: 1 }
```

## Return Values

### BLOCK Mode Result

```typescript
interface BlockModeResult {
  blocked: boolean;
  safe: boolean;
  sanitized?: string;
  threats: {
    secrets: number;
    injections: number;
    details: ThreatDetail[];
  };
  reason?: string;
}
```

**Fields**:
- `blocked`: `true` if content was blocked (exceeds threshold)
- `safe`: `true` if no threats detected
- `sanitized`: Cleaned content (only present if not blocked)
- `threats.secrets`: Count of secrets detected
- `threats.injections`: Count of injection attempts detected
- `threats.details`: Array of all detected threats
- `reason`: Human-readable explanation (only if blocked)

**Example (blocked)**:
```javascript
{
  blocked: true,
  safe: false,
  threats: {
    secrets: 5,
    injections: 2,
    details: [
      { type: 'aws_access_key', severity: 'critical', position: 42 },
      { type: 'github_token', severity: 'high', position: 128 },
      // ...
    ]
  },
  reason: 'Content blocked: 5 secrets, 2 injections, 7 high-severity threats'
}
```

**Example (not blocked)**:
```javascript
{
  blocked: false,
  safe: false,
  sanitized: 'My API key is [REDACTED:aws_access_key] here',
  threats: {
    secrets: 1,
    injections: 0,
    details: [
      { type: 'aws_access_key', severity: 'critical', position: 14 }
    ]
  }
}
```

### SANITIZE Mode Result

```typescript
interface SanitizeModeResult {
  blocked: false;
  safe: boolean;
  sanitized: string;
  threats: {
    secrets: number;
    injections: number;
  };
  actions: string[];
}
```

**Fields**:
- `blocked`: Always `false` (SANITIZE never blocks)
- `safe`: `true` if no threats detected
- `sanitized`: Cleaned content (always present)
- `threats`: Counts of detected threats
- `actions`: Array of actions taken

**Actions**:
- `'secrets_redacted'`: Secrets were found and redacted
- `'injections_removed'`: Injection attempts were removed

**Example**:
```javascript
{
  blocked: false,
  safe: false,
  sanitized: 'Key: [REDACTED:aws_access_key]. Normal text here.',
  threats: {
    secrets: 1,
    injections: 1
  },
  actions: ['secrets_redacted', 'injections_removed']
}
```

## Plugins

### OpenClaw Plugin

Auto-protects external tool results in OpenClaw framework.

```javascript
import createOpenClawPlugin from 'xswarm-ai-sanitize/plugins/openclaw';

const plugin = createOpenClawPlugin({
  mode: 'block',
  ai: { enabled: true, provider: 'ollama' },
  blockThreshold: { secrets: 3, injections: 2, highSeverity: 1 }
});
```

**Hook**: `onToolResult`

Filters results from external tools before they reach the agent.

**External Tools** (filtered):
- `search`
- `fetch`
- `read_email`
- `read_file`
- `database_query`

**Internal Tools** (not filtered):
- All other tools

**Behavior**:
- String results: Replaced with `sanitized` value
- Object results: `content` field replaced, adds `_sanitized` and `_threats` metadata
- BLOCK mode: Throws error if blocked
- SANITIZE mode: Always returns cleaned result

### File Watcher Plugin

Automatically sanitizes files on change.

```javascript
import createWatcher from 'xswarm-ai-sanitize/plugins/watcher';

const watcher = createWatcher(
  ['~/.agent/memory/**/*.md', '~/.agent/logs/**/*.txt'],
  {
    mode: 'sanitize',
    ai: { enabled: false }
  }
);

// Later: stop watching
watcher.close();
```

**Parameters**:
- `patterns` (string[]): Glob patterns (supports `~` for home directory)
- `config` (object): Sanitization configuration

**Features**:
- Sanitizes existing files on startup
- Watches for changes (add, modify)
- 500ms debounce (avoids rapid re-sanitization)
- Re-entry prevention (won't sanitize while sanitizing)
- Only rewrites if changes detected

**Requires**: `chokidar` (optional peer dependency)

```bash
npm install chokidar
```

## Internal Modules

These are exported for testing/advanced use but not part of the public API.

### Pattern Detector

```javascript
import {
  detectSecrets,
  detectInjections,
  detectAll,
  redactSecrets,
  removeInjections
} from 'xswarm-ai-sanitize/src/detectors.js';
```

### AI Provider

```javascript
import {
  analyzeWithAI,
  formatRequest,
  extractResponseText,
  parseAIResponse,
  PROVIDERS
} from 'xswarm-ai-sanitize/src/ai.js';
```

### Cache

```javascript
import { createCache } from 'xswarm-ai-sanitize/src/cache.js';

const cache = createCache({ maxSize: 1000, ttl: 300000 });
```

### Entropy

```javascript
import {
  shannonEntropy,
  isHighEntropy,
  extractHighEntropyStrings
} from 'xswarm-ai-sanitize/src/entropy.js';
```

## Error Handling

### Invalid Options

```javascript
// Throws: "options.mode is required"
await sanitize(content);

// Throws: "options.mode must be 'block' or 'sanitize'"
await sanitize(content, { mode: 'invalid' });
```

### AI Provider Errors

AI errors are **non-fatal** and fall back to pattern-only detection:

```javascript
const result = await sanitize(content, {
  mode: 'block',
  ai: { enabled: true, provider: 'ollama', model: 'llama3.1' }
});
// If Ollama is down, uses pattern-only detection
// Logs warning: "AI analysis failed, using pattern-only detection"
```

### Unknown AI Provider

```javascript
// Throws: "Unknown provider: invalid"
await analyzeWithAI(content, { provider: 'invalid', model: 'model' });
```

### File Watcher Without Chokidar

```javascript
// Throws: "chokidar is required for file watching"
import createWatcher from 'xswarm-ai-sanitize/plugins/watcher';
createWatcher(['/path/**/*.md']);
```

## Performance Considerations

### Caching

Sanitization results are cached by content hash:
- **Cache key**: SHA-256 of `content + JSON.stringify(options)`
- **TTL**: 5 minutes
- **Max size**: 1000 entries (LRU eviction)

**Cache hits avoid**:
- Pattern compilation and matching
- AI API calls
- Redaction/removal operations

**Disable caching** (for testing):
```javascript
// Clear cache between tests
import { createCache } from 'xswarm-ai-sanitize/src/cache.js';
// Cache is internal, but can be cleared via module reload
```

### Pattern Compilation

Patterns are compiled at module load time:
- 44 secret regexes compiled once
- 27 injection regexes compiled once
- Zero per-call compilation cost

### AI Timeouts

Default timeout: 10 seconds

```javascript
await sanitize(content, {
  mode: 'block',
  ai: {
    enabled: true,
    provider: 'ollama',
    model: 'llama3.1',
    timeout: 5000  // 5 second timeout
  }
});
```

## Best Practices

### 1. Use Pattern-Only for High-Volume

```javascript
// Fast path for real-time filtering
const result = sanitize.sync(content, { mode: 'sanitize' });
```

### 2. Use Local AI for Sensitive Data

```javascript
// Never send sensitive data to cloud
const result = await sanitize(sensitiveData, {
  mode: 'block',
  ai: { enabled: true, provider: 'ollama', model: 'llama3.1' }
});
```

### 3. Use SANITIZE for Memory Files

```javascript
// Memory files should never block writes
const result = await sanitize(memoryContent, {
  mode: 'sanitize',
  direction: 'storage'
});
```

### 4. Adjust Thresholds for Context

```javascript
// Strict for production external data
await sanitize(externalData, {
  mode: 'block',
  blockThreshold: { secrets: 1, injections: 1, highSeverity: 1 }
});

// Permissive for internal testing
await sanitize(testData, {
  mode: 'block',
  blockThreshold: { secrets: 10, injections: 10, highSeverity: 5 }
});
```

### 5. Handle Blocked Content Gracefully

```javascript
const result = await sanitize(content, { mode: 'block' });

if (result.blocked) {
  // Log details for investigation
  console.error('Content blocked:', result.reason);
  console.error('Threats:', result.threats);

  // Notify user without exposing secrets
  return { error: 'Content contains security threats and cannot be processed' };
}
```

## License

MIT © xSwarm Team
