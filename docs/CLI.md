# xswarm-ai-sanitize CLI

Command-line tool for detecting and redacting secrets and injection attacks in text files and streams.

## Installation

### Global Installation
```bash
npm install -g xswarm-ai-sanitize
```

Then use anywhere:
```bash
xswarm-ai-sanitize myfile.txt
```

### Using with npx (No Installation Required)
```bash
npx xswarm-ai-sanitize myfile.txt
```

### Local Project Installation
```bash
npm install xswarm-ai-sanitize
npx xswarm-ai-sanitize myfile.txt
```

## Quick Start

### Sanitize a file (redact secrets)
```bash
xswarm-ai-sanitize config.yml
```

Output:
```
DATABASE_URL=[REDACTED:database_url_postgres]
API_KEY=[REDACTED:anthropic_api_key]

✓ 2 secret(s) redacted
```

### Read from stdin
```bash
cat .env | xswarm-ai-sanitize
echo "KEY=sk-ant-abc..." | xswarm-ai-sanitize
```

### Save filtered output
```bash
xswarm-ai-sanitize input.txt > safe-output.txt
```

### Block mode (reject if secrets found)
```bash
xswarm-ai-sanitize --block production.log
# Exits with code 1 if secrets detected
```

## Usage

```
xswarm-ai-sanitize [options] [file]
```

### Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--mode <mode>` | `-m` | Mode: 'sanitize' or 'block' | sanitize |
| `--block` | `-b` | Enable block mode (shorthand) | - |
| `--secrets <n>` | `-s` | Block threshold for secrets | 3 |
| `--injections <n>` | `-i` | Block threshold for injections | 2 |
| `--high-severity <n>` | | Block threshold for high-severity | 1 |
| `--quiet` | `-q` | Suppress statistics output | false |
| `--verbose` | `-v` | Show detailed threat information | false |
| `--help` | | Show help message | - |

## Modes

### Sanitize Mode (Default)
Always returns cleaned content. Secrets are redacted, injections removed.

```bash
xswarm-ai-sanitize file.txt
# Always exits with code 0
# Outputs sanitized content
```

**Use cases:**
- Pre-processing before sending to LLM
- Cleaning memory/log files
- Redacting secrets from documents
- Pipeline processing where content must flow through

### Block Mode
Rejects content if too many threats detected. Like antivirus.

```bash
xswarm-ai-sanitize --block --secrets 1 file.txt
# Exits with code 1 if ≥1 secret found
# Outputs error message to stderr
```

**Use cases:**
- Pre-commit hooks (block commits with secrets)
- CI/CD validation
- API gateway protection
- Strict security policies

## Examples

### Example 1: Filter Environment Files
```bash
# Sanitize .env file before sharing
xswarm-ai-sanitize .env.example > .env.template

# Result: All secrets replaced with [REDACTED:*]
```

### Example 2: Pre-commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit

# Check staged files for secrets
git diff --cached --name-only | while read file; do
  if xswarm-ai-sanitize --block --quiet "$file" 2>/dev/null; then
    :
  else
    echo "❌ Secrets detected in: $file"
    exit 1
  fi
done
```

### Example 3: CI/CD Pipeline
```bash
# Check all code for secrets before deployment
find . -type f -name "*.js" -o -name "*.ts" | while read file; do
  xswarm-ai-sanitize --block --secrets 1 "$file" || exit 1
done
```

### Example 4: Filter Before AI Processing
```bash
# Clean file before sending to OpenClaw/Claude
xswarm-ai-sanitize /tmp/user-input.txt > /tmp/safe-input.txt
openclaw process /tmp/safe-input.txt
```

### Example 5: Batch Processing
```bash
# Filter all config files in a directory
for file in config/*.yml; do
  xswarm-ai-sanitize "$file" > "safe-$(basename "$file")"
done
```

### Example 6: Quiet Mode for Piping
```bash
# Only output sanitized content (no stats)
cat input.txt | xswarm-ai-sanitize --quiet | some-other-tool
```

### Example 7: Verbose Threat Analysis
```bash
# See detailed information about what was found
xswarm-ai-sanitize --verbose secrets.log
```

Output:
```
[sanitized content...]

✓ 5 secret(s) redacted

Threats detected:
  - anthropic_api_key (critical): 1x
  - aws_access_key (critical): 1x
  - github_pat (critical): 1x
  - database_url_postgres (critical): 2x
```

## Secret Types Detected

The CLI uses **pattern-only mode** (zero dependencies, no AI calls) and detects:

### AI Provider Keys (48 types)
- **Anthropic**: `sk-ant-...` (95-110 chars)
- **OpenAI**: `sk-...` (48 chars)
- **Cohere**: High-entropy 40-char strings
- **Google**: `AIza...` (35 chars)

### Cloud Providers
- **AWS**: `AKIA...`, secret keys
- **Azure**: Client secrets, connection strings
- **Heroku**: API keys (UUID format)
- **Cloudflare**: API keys

### Version Control
- **GitHub**: `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`
- **GitLab**: `glpat-`, `glrt-`

### Payment/SaaS
- **Stripe**: `sk_live_`, `pk_live_`, `sk_test_`
- **SendGrid**: `SG.` tokens
- **Twilio**: `SK...`, `AC...`
- **Mailgun**: `key-...`
- **Slack**: `xoxb-`, `xoxp-`, `xapp-`, webhooks
- **Firebase**: FCM keys

### Databases
- **MongoDB**: `mongodb://...`, `mongodb+srv://...`
- **PostgreSQL**: `postgres://...`, `postgresql://...`
- **MySQL**: `mysql://...`
- **Redis**: `redis://...`

### Private Keys
- RSA, EC, DSA, OpenSSH, Generic PEM

### Authentication
- JWT tokens
- Bearer tokens
- Basic auth headers

### Package Managers
- **NPM**: `npm_...`
- **PyPI**: `pypi-...`
- **Docker Hub**: `dckr_pat_...`

### Generic Patterns
- API keys (`api_key=`, `apikey=`)
- Secrets (`secret=`, `password=`, `token=`)
- High-entropy strings (with entropy checking)

## Injection Attack Detection

Also detects 27 prompt injection patterns:

- Instruction override attempts
- Role/persona changes
- System marker injection
- Privilege escalation
- Data exfiltration attempts
- Command execution
- Hidden HTML comments
- Delimiter injection
- Output manipulation
- Context manipulation
- Encoding evasion
- Multi-step attacks
- Jailbreak attempts
- SQL injection
- Memory manipulation
- And more...

## Performance

- **Speed**: <5ms per file (pattern-only mode)
- **Dependencies**: Zero (uses only Node.js stdlib)
- **Memory**: Minimal (streaming-friendly)
- **Privacy**: No external API calls, all local processing

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success (sanitize mode always returns 0) |
| 1 | Content blocked (block mode with threats detected) |
| 1 | Error (invalid arguments, file not found, etc.) |

## Integration Examples

### With OpenClaw
```bash
# Filter before OpenClaw reads
xswarm-ai-sanitize input.txt > /tmp/safe.txt
# OpenClaw can now safely process /tmp/safe.txt
```

### With Git Hooks
```bash
# .git/hooks/pre-commit
#!/bin/bash
git diff --cached --diff-filter=ACM --name-only | while read file; do
  xswarm-ai-sanitize --block --secrets 1 "$file" 2>/dev/null || {
    echo "⚠️  Secrets detected in $file"
    exit 1
  }
done
```

### With CI/CD
```yaml
# GitHub Actions
- name: Check for secrets
  run: |
    find . -type f -name "*.js" -o -name "*.env*" | while read file; do
      npx xswarm-ai-sanitize --block "$file" || exit 1
    done
```

### With Docker
```dockerfile
FROM node:18-alpine
RUN npm install -g xswarm-ai-sanitize
COPY . /app
WORKDIR /app
RUN xswarm-ai-sanitize --block config/*
```

## Advanced Usage

### Custom Thresholds
```bash
# Only block if 5+ secrets found
xswarm-ai-sanitize --block --secrets 5 file.txt

# Block on first injection attempt
xswarm-ai-sanitize --block --injections 1 file.txt

# Never block on high-severity (not recommended)
xswarm-ai-sanitize --block --high-severity 999 file.txt
```

### Pipeline Integration
```bash
# Part of a data processing pipeline
cat raw-data.txt \
  | xswarm-ai-sanitize --quiet \
  | jq '.data' \
  | some-other-tool \
  > processed.json
```

### Conditional Processing
```bash
# Only sanitize if secrets detected
if xswarm-ai-sanitize --block input.txt 2>/dev/null; then
  cp input.txt output.txt
else
  xswarm-ai-sanitize input.txt > output.txt
fi
```

## Troubleshooting

### "Permission denied"
```bash
# Make sure CLI is executable
chmod +x $(which xswarm-ai-sanitize)
```

### "command not found"
```bash
# Install globally
npm install -g xswarm-ai-sanitize

# Or use npx
npx xswarm-ai-sanitize file.txt
```

### "No input provided"
```bash
# Provide input via file or stdin
xswarm-ai-sanitize file.txt          # ✓
cat file.txt | xswarm-ai-sanitize    # ✓
xswarm-ai-sanitize < file.txt        # ✓
xswarm-ai-sanitize                   # ✗ Error
```

### False Positives
The tool is intentionally strict (better safe than sorry). Generic patterns may over-match:

```bash
# This might get flagged as high-entropy:
const TOKEN = "abcdefghijklmnopqrstuvwxyz123456"

# Workaround: Use environment variables
const TOKEN = process.env.MY_TOKEN
```

### No Secrets Detected (but they're there)
Check if your secret format matches a pattern:

```bash
# Test with known secret format
echo "sk-ant-abc..." | xswarm-ai-sanitize

# Check the pattern list (see above)
```

## Comparison with Other Tools

| Tool | Secrets | Injections | Speed | Privacy | Dependencies |
|------|---------|------------|-------|---------|--------------|
| **xswarm-ai-sanitize** | ✅ 48 types | ✅ 27 types | <5ms | 100% local | Zero |
| gitleaks | ✅ Many | ❌ None | Fast | Local | Go binary |
| truffleHog | ✅ Many | ❌ None | Slow | Local | Python + deps |
| detect-secrets | ✅ Some | ❌ None | Fast | Local | Python |
| OpenAI moderation | ❌ None | ✅ Limited | API call | Cloud | API key |

## For Node.js API Usage

See [README.md](../README.md) for the full Node.js API with AI-enhanced detection.

## License

MIT

## Support

- **Issues**: https://github.com/chadananda/xswarm-ai-sanitize/issues
- **Docs**: https://github.com/chadananda/xswarm-ai-sanitize
- **npm**: https://www.npmjs.com/package/xswarm-ai-sanitize
