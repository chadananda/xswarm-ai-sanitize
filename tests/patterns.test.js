import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const patternsPath = join(process.cwd(), 'src', 'patterns.json');
const patterns = JSON.parse(readFileSync(patternsPath, 'utf-8'));

describe('Pattern Library Structure', () => {
  it('should parse JSON successfully', () => {
    assert.ok(patterns);
    assert.strictEqual(typeof patterns, 'object');
  });

  it('should have secrets array with 600+ patterns', () => {
    assert.strictEqual(Array.isArray(patterns.secrets), true);
    assert.ok(patterns.secrets.length >= 600, `Expected >= 600 secrets, got ${patterns.secrets.length}`);
  });

  it('should NOT have injections array', () => {
    assert.strictEqual(patterns.injections, undefined);
  });

  it('should have no duplicate pattern names', () => {
    const names = patterns.secrets.map(p => p.name);
    const uniqueNames = new Set(names);
    assert.strictEqual(uniqueNames.size, names.length, 'Found duplicate pattern names');
  });
});

describe('Secret Pattern Validation', () => {
  it('should have required fields for all secret patterns', () => {
    patterns.secrets.forEach(pattern => {
      assert.ok(pattern.name, `Pattern missing name: ${JSON.stringify(pattern)}`);
      assert.ok(pattern.regex, `Pattern ${pattern.name} missing regex`);
      assert.ok(pattern.severity, `Pattern ${pattern.name} missing severity`);
      assert.ok(pattern.description, `Pattern ${pattern.name} missing description`);
      assert.strictEqual(typeof pattern.name, 'string');
      assert.strictEqual(typeof pattern.regex, 'string');
      assert.strictEqual(typeof pattern.severity, 'string');
      assert.strictEqual(typeof pattern.description, 'string');
    });
  });

  it('should have valid severity levels', () => {
    const validSeverities = ['critical', 'high', 'medium', 'low'];
    patterns.secrets.forEach(pattern => {
      assert.ok(validSeverities.includes(pattern.severity),
        `Invalid severity "${pattern.severity}" for pattern ${pattern.name}`);
    });
  });

  it('should compile all secret regexes without error', () => {
    patterns.secrets.forEach(pattern => {
      assert.doesNotThrow(() => new RegExp(pattern.regex, 'gi'),
        `Failed to compile regex for ${pattern.name}: ${pattern.regex}`);
    });
  });

  it('should have checkEntropy flag on generic patterns', () => {
    const patternsWithEntropy = patterns.secrets.filter(p => p.checkEntropy === true);
    assert.ok(patternsWithEntropy.length >= 2, 'At least 2 patterns should have checkEntropy');

    const genericApiKey = patterns.secrets.find(p => p.name === 'generic_api_key');
    const genericSecret = patterns.secrets.find(p => p.name === 'generic_secret');

    assert.ok(genericApiKey, 'Missing generic_api_key pattern');
    assert.ok(genericSecret, 'Missing generic_secret pattern');
    assert.strictEqual(genericApiKey.checkEntropy, true, 'generic_api_key should have checkEntropy: true');
    assert.strictEqual(genericSecret.checkEntropy, true, 'generic_secret should have checkEntropy: true');
  });
});

describe('Secret Pattern Matching', () => {
  const testCases = [
    { name: 'aws_access_key', sample: 'AKIAIOSFODNN7EXAMPLE' },
    { name: 'aws_secret_key', sample: 'aws_secret_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"' },
    { name: 'azure_connection_string', sample: 'DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567ABC890DEF123GHI456JKL789MNO012PQR345STU6==' },
    { name: 'github_pat', sample: 'ghp_1234567890abcdefghijklmnopqrstuvwxyz' },
    { name: 'github_oauth', sample: 'gho_1234567890abcdefghijklmnopqrstuvwxyz' },
    { name: 'gitlab_pat', sample: 'glpat-abcdefghijklmnopqrst' },
    { name: 'gcp_api_key', sample: 'AIzaSyDaGmWKa4JsXZ-HjGw7ISLn_3namBGewQe' },
    { name: 'stripe_live_secret', sample: 'sk_' + 'live_' + 'FAKEFAKEFAKEFAKEFAKEFAKE' },
    { name: 'slack_bot_token', sample: 'xoxb-' + '123456789012-1234567890123-' + 'FAKEFAKEFAKEFAKEFAKEFAKE' },
    { name: 'slack_webhook', sample: 'https://hooks.' + 'slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX' },
    { name: 'private_key_rsa', sample: '-----BEGIN RSA PRIVATE KEY-----' },
    { name: 'jwt_token', sample: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U' },
    { name: 'database_url_mongodb', sample: 'mongodb://user:pass@localhost:27017/dbname' },
    { name: 'database_url_postgres', sample: 'postgresql://user:pass@localhost:5432/db' },
    { name: 'sendgrid_api_key', sample: 'SG.' + 'X'.repeat(22) + '.' + 'X'.repeat(43) },
    { name: 'npm_token', sample: 'npm_' + 'a'.repeat(36) },
    { name: 'docker_hub_token', sample: 'dckr_pat_abcdefghijklmnopqrstuvwxyz123456' },
    { name: 'bearer_token', sample: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' },
    { name: 'basic_auth', sample: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=' }
  ];

  testCases.forEach(({ name, sample }) => {
    it(`should match ${name} pattern`, () => {
      const pattern = patterns.secrets.find(p => p.name === name);
      assert.ok(pattern, `Pattern ${name} not found`);
      const regex = new RegExp(pattern.regex, 'gi');
      assert.ok(regex.test(sample), `Pattern ${name} failed to match: "${sample}"`);
    });
  });
});

describe('Edge Cases - Multiline and Special Characters', () => {
  it('should match secrets with newlines in context', () => {
    const text = `
      Here is my AWS key:
      AKIAIOSFODNN7EXAMPLE
      Keep it safe
    `;
    const pattern = patterns.secrets.find(p => p.name === 'aws_access_key');
    const regex = new RegExp(pattern.regex, 'gi');
    assert.ok(regex.test(text), 'Should match AWS key across newlines');
  });

  it('should match private keys with full block content', () => {
    const text = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890abcdefghijklmnopqrstuvwxyz
ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmno
-----END RSA PRIVATE KEY-----`;
    const pattern = patterns.secrets.find(p => p.name === 'private_key_rsa');
    const regex = new RegExp(pattern.regex, 'gi');
    assert.ok(regex.test(text), 'Should match private key with full content');
  });

  it('should match JWT tokens in various contexts', () => {
    const contexts = [
      'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123',
      'token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123',
      'jwt: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123"'
    ];
    const pattern = patterns.secrets.find(p => p.name === 'jwt_token');
    const regex = new RegExp(pattern.regex, 'gi');

    contexts.forEach(context => {
      regex.lastIndex = 0;
      assert.ok(regex.test(context), `Should match JWT in context: "${context}"`);
    });
  });
});

describe('False Positive Prevention', () => {
  const benignSamples = [
    'This is a normal sentence with no secrets',
    'const apiKey = process.env.API_KEY',
    'Please provide your API key for authentication',
    'The user should input their password',
    'Configure the secret in your environment variables',
    'Example: YOUR_API_KEY_HERE',
    'Replace XXXX with your actual key',
    'You can find instructions in the README'
  ];

  it('should not flag benign text as secrets', () => {
    benignSamples.forEach(sample => {
      let matches = [];
      patterns.secrets.forEach(pattern => {
        // Skip generic/broad patterns
        if (pattern.name === 'generic_api_key' ||
            pattern.name === 'generic_secret' ||
            pattern.name === 'azure_client_secret' ||
            pattern.name === 'cloudflare_api_key') {
          return;
        }
        const regex = new RegExp(pattern.regex, 'gi');
        if (regex.test(sample)) {
          matches.push(pattern.name);
        }
      });
      assert.strictEqual(matches.length, 0,
        `Benign text "${sample}" matched patterns: ${matches.join(', ')}`);
    });
  });
});

describe('Coverage of Required Patterns', () => {
  const requiredSecrets = [
    'aws_access_key', 'aws_secret_key', 'github_pat', 'github_oauth',
    'github_user_token', 'github_server_token', 'github_refresh_token',
    'gcp_api_key', 'gcp_oauth_secret', 'stripe_live_secret', 'stripe_test_secret',
    'stripe_live_publishable', 'slack_bot_token', 'slack_user_token',
    'slack_app_token', 'slack_webhook', 'private_key_rsa', 'private_key_ec',
    'private_key_dsa', 'private_key_openssh', 'private_key_generic',
    'jwt_token', 'heroku_api_key', 'twilio_api_key',
    'twilio_account_sid', 'sendgrid_api_key', 'npm_token', 'pypi_token',
    'mailgun_api_key', 'firebase_web_api_key', 'generic_api_key', 'generic_secret',
    'bearer_token', 'basic_auth'
  ];

  it('should include all required secret patterns', () => {
    const secretNames = patterns.secrets.map(p => p.name);
    requiredSecrets.forEach(required => {
      assert.ok(secretNames.includes(required), `Missing required secret pattern: ${required}`);
    });
  });

  it('should include additional cloud provider patterns', () => {
    const secretNames = patterns.secrets.map(p => p.name);
    const additionalPatterns = ['azure_connection_string', 'gitlab_pat', 'docker_hub_token'];

    additionalPatterns.forEach(pattern => {
      assert.ok(secretNames.includes(pattern), `Missing additional pattern: ${pattern}`);
    });
  });
});

describe('Pattern Performance Characteristics', () => {
  it('should compile all patterns in reasonable time', () => {
    const start = Date.now();
    patterns.secrets.forEach(pattern => {
      new RegExp(pattern.regex, 'gi');
    });
    const duration = Date.now() - start;
    assert.ok(duration < 200, `Pattern compilation took ${duration}ms, should be < 200ms`);
  });

  it('should detect secrets in a typical document quickly', () => {
    const content = `
      ANTHROPIC_API_KEY=${'sk-' + 'ant-' + 'a'.repeat(100)}
      AWS_ACCESS_KEY_ID=${'AKIA' + 'IOSFODNN7EXAMPLE'}
      Some normal text that should not trigger any patterns.
    `;

    const compiled = patterns.secrets.map(p => ({
      ...p,
      compiled: new RegExp(p.regex, 'gi')
    }));

    const start = Date.now();
    for (const pattern of compiled) {
      pattern.compiled.lastIndex = 0;
      pattern.compiled.test(content);
    }
    const duration = Date.now() - start;
    assert.ok(duration < 100, `Detection took ${duration}ms, should be < 100ms`);
  });
});

describe('AI Provider Secret Patterns', () => {
  it('should have Anthropic API key pattern', () => {
    const anthropicPattern = patterns.secrets.find(p => p.name === 'anthropic_api_key');
    assert.ok(anthropicPattern, 'Missing anthropic_api_key pattern');
    assert.strictEqual(anthropicPattern.severity, 'critical');
    assert.match(anthropicPattern.regex, /sk-ant/);
  });

  it('should detect valid Anthropic keys', () => {
    const anthropicPattern = patterns.secrets.find(p => p.name === 'anthropic_api_key');
    const regex = new RegExp(anthropicPattern.regex, 'gi');
    const validKey = 'sk-' + 'ant-' + 'a'.repeat(100);
    assert.ok(regex.test(validKey), 'Should match valid Anthropic key');
  });

  it('should have OpenAI API key pattern', () => {
    const openaiPattern = patterns.secrets.find(p => p.name === 'openai_api_key');
    assert.ok(openaiPattern, 'Missing openai_api_key pattern');
    assert.strictEqual(openaiPattern.severity, 'critical');
  });

  it('should detect valid OpenAI keys', () => {
    const openaiPattern = patterns.secrets.find(p => p.name === 'openai_api_key');
    const regex = new RegExp(openaiPattern.regex, 'gi');
    const validKey = 'sk' + '-' + 'A'.repeat(45);
    assert.ok(regex.test(validKey), 'Should match valid OpenAI key');
  });
});

describe('Real-World Secret Detection', () => {
  it('should detect secrets in environment variable format', () => {
    const content = `
      ANTHROPIC_API_KEY=${'sk-' + 'ant-' + 'a'.repeat(100)}
      OPENAI_API_KEY=${'sk-' + 'a'.repeat(45)}
      AWS_ACCESS_KEY_ID=${'AKIA' + 'IOSFODNN7EXAMPLE'}
    `;

    let matchCount = 0;
    patterns.secrets.forEach(pattern => {
      const regex = new RegExp(pattern.regex, 'gi');
      if (regex.test(content)) {
        matchCount++;
      }
    });

    assert.ok(matchCount >= 3, `Expected >= 3 pattern matches, got ${matchCount}`);
  });

  it('should detect secrets in JSON', () => {
    const content = JSON.stringify({
      apiKey: 'sk-' + 'ant-' + 'a'.repeat(100),
      awsKey: 'AKIA' + 'IOSFODNN7EXAMPLE'
    });

    let matchCount = 0;
    patterns.secrets.forEach(pattern => {
      const regex = new RegExp(pattern.regex, 'gi');
      if (regex.test(content)) {
        matchCount++;
      }
    });

    assert.ok(matchCount >= 2, `Expected >= 2 pattern matches in JSON, got ${matchCount}`);
  });
});
