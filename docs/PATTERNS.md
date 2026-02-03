# Pattern Library Reference

Complete list of detection patterns in xswarm-ai-sanitize

## Overview

The pattern library contains:
- **44 secret patterns** for credential detection
- **27 injection patterns** for prompt injection detection
- **Entropy analysis** for unknown secrets

All patterns are in `src/patterns.json` and compiled at module load time.

## Secret Patterns

### Cloud Providers (11 patterns)

#### AWS
- **aws_access_key** (critical): `AKIA[0-9A-Z]{16}`
- **aws_secret_key** (critical): 40-char base64 after "aws_secret"
- **aws_session_token** (high): Temporary session tokens

#### Google Cloud
- **google_api_key** (high): `AIza[0-9A-Za-z\\-_]{35}`
- **google_oauth** (high): OAuth 2.0 tokens

#### Azure
- **azure_client_secret** (high): Azure AD client secrets
- **azure_connection_string** (high): Storage connection strings

#### Digital Ocean, Heroku, Cloudflare
- Standard API key patterns with provider-specific prefixes

### Version Control (5 patterns)

#### GitHub
- **github_token** (high): `ghp_[A-Za-z0-9]{36}`
- **github_oauth** (high): `gho_[A-Za-z0-9]{36}`
- **github_app_token** (high): `ghs_[A-Za-z0-9]{36}`
- **github_refresh_token** (high): `ghr_[A-Za-z0-9]{36}`

#### GitLab
- **gitlab_token** (high): `glpat-[A-Za-z0-9\\-_]{20}`
- **gitlab_runner_token** (high): `GR[0-9]{10}[A-Za-z0-9]{20}`

### Payment Services (2 patterns)

#### Stripe
- **stripe_live_key** (critical): `sk_live_[A-Za-z0-9]{24,}`
- **stripe_test_key** (medium): `sk_test_[A-Za-z0-9]{24,}`

### Communication (3 patterns)

#### Slack
- **slack_token** (high): `xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{24,}`
- **slack_webhook** (high): Webhook URLs

#### Discord, Telegram
- Bot tokens and API keys

### Database Connection Strings (5 patterns)

- **mongodb_connection** (critical): `mongodb://` or `mongodb+srv://` with credentials
- **postgres_connection** (critical): `postgres://` or `postgresql://` with credentials
- **mysql_connection** (critical): MySQL connection strings
- **redis_connection** (high): Redis URLs with passwords
- **database_url** (high): Generic database URLs

### Cryptographic Keys (5 patterns)

- **private_key_rsa** (critical): RSA PRIVATE KEY blocks
- **private_key_ec** (critical): EC PRIVATE KEY blocks
- **private_key_dsa** (critical): DSA PRIVATE KEY blocks
- **ssh_private_key** (critical): SSH PRIVATE KEY blocks
- **pgp_private_key** (critical): PGP PRIVATE KEY blocks

### Tokens & Credentials (8 patterns)

- **jwt_token** (medium): JWT tokens (3-part base64)
- **bearer_token** (high): Bearer tokens in auth headers
- **basic_auth** (high): Basic auth credentials (base64)
- **generic_secret** (medium): Patterns like `secret_key=...` (requires entropy check)
- **generic_api_key** (medium): API key patterns (requires entropy check)
- **password** (high): Password assignments (requires entropy check)
- **docker_hub_token** (high): Docker Hub access tokens

### Other Services (5 patterns)

- **mailgun_api_key**, **sendgrid_api_key**, **twilio_api_key**: Email/SMS service keys
- **npm_token**: npm authentication tokens
- Various others

## Injection Patterns

### Instruction Override (6 patterns)

- **instruction_override_explicit**: "Ignore all previous instructions"
- **instruction_override_disregard**: "Disregard prior instructions"
- **instruction_override_forget**: "Forget everything before"
- **instruction_override_reset**: "Reset your instructions"
- **instruction_override_new**: "New instructions:"
- **instruction_override_instead**: "Instead, do..."

### Role Confusion (4 patterns)

- **role_confusion_you_are**: "You are now a..."
- **role_confusion_act_as**: "Act as a..."
- **role_confusion_pretend**: "Pretend to be..."
- **role_confusion_simulate**: "Simulate being..."

### Privilege Escalation (3 patterns)

- **privilege_escalation_admin**: "Execute as admin"
- **privilege_escalation_sudo**: "Run with sudo"
- **privilege_escalation_root**: "Root access"

### System Markers (5 patterns)

- **system_marker_llama**: `<|system|>` tags (Llama format)
- **system_marker_chatml**: `<|im_start|>system` (ChatML format)
- **system_marker_endoftext**: `<|endoftext|>` token
- **system_marker_generic**: `[SYSTEM]`, `[ADMIN]`, `[ROOT]`
- **system_marker_assistant**: Role override markers

### Data Exfiltration (2 patterns)

- **data_exfiltration_send**: "Send data to http://..."
- **data_exfiltration_post**: "POST to external URL"

### Delimiters & Boundaries (3 patterns)

- **delimiter_newline**: Multiple newlines as boundary
- **delimiter_hash**: Hash-based boundaries
- **delimiter_brackets**: Special bracket sequences

### Command Injection (2 patterns)

- **command_injection_shell**: Shell command patterns (`;`, `&&`, `||`)
- **command_injection_pipe**: Pipe and redirection operators

### SQL Injection (2 patterns)

- **sql_injection**: SQL manipulation keywords
- **sql_union**: UNION-based SQL injection

## Severity Levels

### Critical
Reserved for secrets that provide immediate system access:
- AWS access keys
- Private keys (RSA, EC, SSH, PGP)
- Database connections with credentials
- Stripe live keys

### High
Serious threats requiring immediate attention:
- GitHub tokens
- API keys for critical services
- Bearer tokens
- Password exposures
- Instruction override attempts
- Privilege escalation attempts

### Medium
Moderate threats that should be monitored:
- JWT tokens
- Stripe test keys
- Generic API keys (with entropy check)
- Role confusion attempts
- System markers

### Low
Minor concerns, often informational:
- Certain delimiters
- Some boundary markers

## Entropy Checking

Some patterns require entropy validation to reduce false positives:

### Patterns with `checkEntropy: true`

1. **generic_secret**: Matches "secret=" patterns, but only if value has high entropy
2. **generic_api_key**: Matches "api_key=" patterns, but only if value has high entropy
3. **password**: Matches "password=" patterns, but only if value has high entropy
4. **generic_token**: Matches "token=" patterns, but only if value has high entropy

### Entropy Thresholds

- **Default threshold**: 4.5 (Shannon entropy scale 0-6)
- **Minimum length**: 16 characters
- **Maximum length**: 256 characters

**Examples**:
```javascript
// High entropy (detected)
"password=aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU"  // entropy: 5.2

// Low entropy (not detected)
"password=testpassword123"  // entropy: 3.1
```

## Custom Patterns

You can extend the pattern library by:

1. **Forking and modifying** `src/patterns.json`
2. **Submitting a PR** with new patterns
3. **Future**: Runtime pattern loading (v1.1)

### Pattern Format

```json
{
  "name": "unique_pattern_name",
  "regex": "regular_expression",
  "severity": "critical|high|medium|low",
  "description": "Human-readable description",
  "checkEntropy": false  // Optional, default false
}
```

### Example Custom Pattern

```json
{
  "name": "custom_company_api_key",
  "regex": "MYCOMPANY_[A-Z0-9]{32}",
  "severity": "high",
  "description": "Internal API keys for MyCompany services",
  "checkEntropy": false
}
```

## False Positive Prevention

### Word Boundaries

Many patterns use `\b` word boundaries to prevent matches in URLs, code, or identifiers:

```javascript
// Matches
"api_key=AKIAIOSFODNN7EXAMPLE"

// Doesn't match
"example_api_key_constant" (part of identifier)
"https://docs.aws.com/api_key" (in URL)
```

### Minimum Lengths

Generic patterns require minimum lengths:
- API keys: 16+ characters
- Tokens: 16+ characters
- Secrets: 20+ characters

### Entropy Validation

Patterns marked with `checkEntropy: true` require Shannon entropy > 4.5 to reduce false positives on test data.

## Pattern Performance

### Regex Compilation

- All patterns compiled at module load time
- Uses `new RegExp(pattern, 'gi')` for case-insensitive global matching
- Compilation time: <100ms for all 71 patterns

### Catastrophic Backtracking Prevention

All patterns are designed to avoid catastrophic backtracking:
- No nested quantifiers
- Bounded repetitions
- Atomic groups where supported

### Pattern Matching Speed

- Average: 1-2ms per pattern
- Total scan time: 50-100ms for all patterns on 10KB document
- Dominated by pattern count, not document size (until very large)

## Testing Patterns

Test your content against patterns:

```javascript
import { detectSecrets, detectInjections } from 'xswarm-ai-sanitize/src/detectors.js';

const secrets = detectSecrets('Content with AKIAIOSFODNN7EXAMPLE');
console.log(secrets);
// [{ name: 'aws_access_key', severity: 'critical', value: 'AKIAIOSFODNN7EXAMPLE', position: 13, source: 'pattern' }]

const injections = detectInjections('Ignore all previous instructions');
console.log(injections);
// [{ name: 'instruction_override_explicit', severity: 'high', value: 'Ignore all previous instructions', position: 0 }]
```

## Contributing Patterns

When contributing new patterns:

1. **Test thoroughly**: Include real-world examples
2. **Avoid false positives**: Use word boundaries and entropy checks
3. **Document well**: Clear descriptions and severity rationale
4. **Performance**: No catastrophic backtracking

See [CONTRIBUTING.md](../CONTRIBUTING.md) for full guidelines.

## License

MIT © xSwarm Team
