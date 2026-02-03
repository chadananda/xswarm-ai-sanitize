# Pattern Library

Comprehensive regex pattern library for detecting secrets and prompt injection attacks in AI agent communications.

## Overview

The `patterns.json` file contains two categories of detection patterns:
- **Secrets**: 44 patterns for API keys, tokens, credentials, and private keys
- **Injections**: 27 patterns for prompt injection, jailbreak attempts, and malicious instructions

## Structure

### Secret Patterns

Each secret pattern has the following structure:

```json
{
  "name": "unique_identifier",
  "regex": "regex_pattern_without_flags",
  "severity": "critical|high|medium|low",
  "description": "Human-readable description",
  "checkEntropy": true  // Optional: requires entropy validation
}
```

**Severity Levels:**
- `critical`: Production credentials, private keys, live API keys
- `high`: Service tokens, webhook URLs, authentication headers
- `medium`: Test credentials, publishable keys, generic patterns
- `low`: Low-risk informational patterns (none currently)

**checkEntropy Flag:**
Patterns with `checkEntropy: true` require additional entropy analysis to reduce false positives. Used for generic patterns like `generic_api_key` and `generic_secret` that match variable names without this check.

### Injection Patterns

Each injection pattern has this structure:

```json
{
  "name": "unique_identifier",
  "regex": "regex_pattern_without_flags",
  "severity": "critical|high|medium|low",
  "description": "Human-readable description"
}
```

**Severity Levels:**
- `critical`: Direct instruction override, privilege escalation, data exfiltration
- `high`: System markers, context manipulation, jailbreak attempts
- `medium`: Output manipulation, encoding evasion, tool abuse
- `low`: Informational patterns (none currently)

## Usage

Patterns are designed to be compiled with case-insensitive and global flags:

```javascript
import patterns from './patterns.json';

// Compile secret patterns
const secretRegexes = patterns.secrets.map(p => ({
  name: p.name,
  regex: new RegExp(p.regex, 'gi'),
  severity: p.severity,
  checkEntropy: p.checkEntropy || false
}));

// Compile injection patterns
const injectionRegexes = patterns.injections.map(p => ({
  name: p.name,
  regex: new RegExp(p.regex, 'gi'),
  severity: p.severity
}));

// Test text
function detectSecrets(text) {
  const findings = [];
  for (const pattern of secretRegexes) {
    if (pattern.regex.test(text)) {
      findings.push({
        type: 'secret',
        pattern: pattern.name,
        severity: pattern.severity
      });
    }
  }
  return findings;
}
```

## Secret Pattern Coverage

### Cloud Providers
- AWS (access keys, secret keys)
- Azure (client secrets, connection strings)
- Google Cloud (API keys, OAuth client IDs)

### Version Control
- GitHub (PAT, OAuth, user/server/refresh tokens)
- GitLab (PAT, runner tokens)

### Payment Services
- Stripe (live/test secret keys, publishable keys)

### Communication
- Slack (bot/user/app tokens, webhooks)
- Twilio (API keys, account SIDs)
- SendGrid (API keys)
- Mailgun (API keys)

### Infrastructure
- Heroku (API keys)
- Docker Hub (personal access tokens)
- Firebase (cloud messaging keys)
- Cloudflare (API keys)

### Package Managers
- NPM (access tokens)
- PyPI (API tokens)

### Databases
- MongoDB, PostgreSQL, MySQL, Redis (connection URLs)

### Authentication
- JWT tokens
- Bearer tokens
- Basic auth headers

### Cryptographic Keys
- RSA, EC, DSA, OpenSSH, generic private keys

### Generic Patterns
- API keys (with entropy check)
- Secrets/passwords (with entropy check)

## Injection Pattern Coverage

### Instruction Manipulation
- Previous instruction override
- New instruction injection
- Context manipulation
- Multi-step injection

### System Impersonation
- System/admin/root markers (brackets, XML, LLaMA, ChatML)
- End-of-text delimiter injection
- Hash/bracket delimiter injection

### Role/Persona Changes
- Role assumption
- Persona switching
- Jailbreak attempts (DAN, developer mode)

### Data Exfiltration
- External URL data transmission
- File system access attempts

### Code Execution
- Command execution patterns
- URL fetching
- Tool/function abuse

### Output Manipulation
- Response format control
- Encoding-based evasion

### Attack Vectors
- SQL injection
- HTML comment hiding
- Privilege escalation
- Memory manipulation

## Technical Notes

### Regex Compilation
All patterns are designed to compile efficiently. The library includes performance tests to prevent catastrophic backtracking.

### False Positive Mitigation
- Generic patterns use word boundaries (`\\b`) to reduce noise
- Generic patterns require entropy checking
- Specific patterns are highly targeted to avoid benign matches
- Database URL patterns are split by database type for clarity

### Pattern Optimization
- Complex alternations are split into separate patterns for better performance
- HTML comment patterns use bounded quantifiers to prevent backtracking
- System markers are split by format (LLaMA, ChatML, etc.) for precision

### Maintenance
When adding new patterns:
1. Use specific prefixes/formats when available
2. Add `checkEntropy: true` for generic patterns
3. Use word boundaries for keyword-based patterns
4. Test with both malicious and benign samples
5. Verify regex compilation performance (<100ms for all patterns)

## Testing

The pattern library includes comprehensive tests:
- 61 test cases covering structure, validation, matching, edge cases, and performance
- All tests use Node.js built-in test runner
- Run tests: `npm test`

## Integration

This pattern library is consumed by:
- `detectors.js` - Pattern detection engine
- Integration tests - Full pipeline validation

Patterns are loaded once at module initialization and compiled for efficient repeated use.
