import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CLI_PATH = join(process.cwd(), 'bin', 'cli.js');
const NODE_BIN = process.execPath;

// Helper to run CLI and get result (captures both stdout and stderr)
function runCLI(args = [], input = null) {
  const result = spawnSync(NODE_BIN, [CLI_PATH, ...args], {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status
  };
}

describe('CLI - Help and Usage', () => {
  it('should display help with --help', () => {
    const result = runCLI(['--help']);
    assert.strictEqual(result.exitCode, 0);
    assert.match(result.stdout, /xswarm-ai-sanitize/);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /Options:/);
  });

  it('should accept empty input via pipe', () => {
    // When stdin is piped (not TTY), CLI reads from it - empty input is valid
    const result = runCLI(['-q'], '');
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stdout, '');
  });
});

describe('CLI - Secret Detection (Anthropic)', () => {
  const anthropicKey = 'sk-' + 'ant-' + 'a'.repeat(100);

  it('should detect Anthropic API key from stdin', () => {
    const input = `API_KEY=${anthropicKey}`;
    const result = runCLI(['-q'], input);
    assert.strictEqual(result.exitCode, 0);
    assert.match(result.stdout, /\[REDACTED:anthropic_api_key\]/);
  });

  it('should detect Anthropic key in file', () => {
    const tmpFile = join(tmpdir(), `test-anthropic-${Date.now()}.txt`);
    writeFileSync(tmpFile, `ANTHROPIC_KEY=${anthropicKey}`);
    const result = runCLI(['-q', tmpFile]);
    unlinkSync(tmpFile);
    assert.strictEqual(result.exitCode, 0);
    assert.match(result.stdout, /\[REDACTED:anthropic_api_key\]/);
  });

  it('should block on Anthropic key in block mode', () => {
    const input = `KEY=${anthropicKey}`;
    const result = runCLI(['--block', '--secrets', '1', '-q'], input);
    assert.strictEqual(result.exitCode, 1);
  });
});

describe('CLI - Secret Detection (OpenAI)', () => {
  const openaiKey = 'sk-' + 'a'.repeat(46);
  const openaiOrgKey = 'sk-org-' + 'a'.repeat(41);

  it('should detect OpenAI API key', () => {
    const input = `OPENAI_KEY=${openaiKey}`;
    const result = runCLI(['-q'], input);
    assert.strictEqual(result.exitCode, 0);
    assert.match(result.stdout, /\[REDACTED:openai_api_key\]/);
  });

  it('should detect OpenAI org key', () => {
    const input = `ORG_KEY=${openaiOrgKey}`;
    const result = runCLI(['-q'], input);
    assert.strictEqual(result.exitCode, 0);
    assert.match(result.stdout, /\[REDACTED:openai_org_key\]/);
  });
});

describe('CLI - Secret Detection (AWS)', () => {
  const awsAccessKey = 'AKIA' + 'IOSFODNN7EXAMPLE';

  it('should detect AWS access key', () => {
    const input = `AWS_ACCESS_KEY_ID=${awsAccessKey}`;
    const result = runCLI(['-q'], input);
    assert.strictEqual(result.exitCode, 0);
    assert.match(result.stdout, /\[REDACTED:aws_access_key\]/);
  });
});

describe('CLI - Secret Detection (GitHub)', () => {
  const githubToken = 'gh' + 'p_' + 'a'.repeat(36);

  it('should detect GitHub PAT', () => {
    const input = `GITHUB_TOKEN=${githubToken}`;
    const result = runCLI(['-q'], input);
    assert.strictEqual(result.exitCode, 0);
    assert.match(result.stdout, /\[REDACTED:github_pat\]/);
  });

  it('should block on GitHub token in block mode', () => {
    const input = `TOKEN=${githubToken}`;
    const result = runCLI(['--block', '--secrets', '1', '-q'], input);
    assert.strictEqual(result.exitCode, 1);
  });
});

describe('CLI - Secret Detection (Database URLs)', () => {
  it('should detect PostgreSQL URL', () => {
    const input = 'DATABASE_URL=postgres://user:pass@localhost:5432/db';
    const result = runCLI(['-q'], input);
    assert.strictEqual(result.exitCode, 0);
    assert.match(result.stdout, /REDACTED/);
  });

  it('should detect MongoDB URL', () => {
    const input = 'MONGODB_URI=mongodb://admin:secret@cluster.mongodb.net/db';
    const result = runCLI(['-q'], input);
    assert.strictEqual(result.exitCode, 0);
    assert.match(result.stdout, /REDACTED/);
  });

  it('should detect MySQL URL', () => {
    const input = 'MYSQL_URL=mysql://root:password@localhost:3306/mydb';
    const result = runCLI(['-q'], input);
    assert.strictEqual(result.exitCode, 0);
    assert.match(result.stdout, /REDACTED/);
  });
});

describe('CLI - Secret Detection (Other Services)', () => {
  const slackToken = 'xox' + 'b-1234567890-1234567890123-' + 'a'.repeat(24);

  it('should detect Slack token', () => {
    const input = `SLACK_TOKEN=${slackToken}`;
    const result = runCLI(['-q'], input);
    assert.strictEqual(result.exitCode, 0);
    assert.match(result.stdout, /\[REDACTED:slack_bot_token\]/);
  });
});

describe('CLI - Multiple Secrets', () => {
  it('should detect multiple secrets in one input', () => {
    const input = `
      ANTHROPIC_KEY=${'sk-' + 'ant-' + 'a'.repeat(100)}
      AWS_KEY=${'AKIA' + 'IOSFODNN7EXAMPLE'}
      GITHUB_TOKEN=${'gh' + 'p_' + 'a'.repeat(36)}
    `;
    const result = runCLI(['-q'], input);
    assert.strictEqual(result.exitCode, 0);
    const redactedCount = (result.stdout.match(/REDACTED/g) || []).length;
    assert.ok(redactedCount >= 3, `Expected >= 3 redactions, got ${redactedCount}`);
  });
});

describe('CLI - Safe Content Preservation', () => {
  it('should preserve safe content', () => {
    const input = 'const DEBUG = true; const VERSION = "1.2.3";';
    const result = runCLI(['-q'], input);
    assert.strictEqual(result.exitCode, 0);
    assert.match(result.stdout, /const DEBUG = true/);
    assert.match(result.stdout, /const VERSION/);
  });

  it('should not flag short strings', () => {
    const input = 'const X = "abc"; const Y = 123;';
    const result = runCLI(['-q'], input);
    assert.strictEqual(result.exitCode, 0);
    assert.match(result.stdout, /const X = "abc"/);
  });
});

describe('CLI - Block Mode', () => {
  it('should exit 0 with no secrets in block mode', () => {
    const input = 'const DEBUG = true;';
    const result = runCLI(['--block', '-q'], input);
    assert.strictEqual(result.exitCode, 0);
  });

  it('should exit 1 with secrets in block mode', () => {
    const input = `KEY=${'sk-' + 'ant-' + 'a'.repeat(100)}`;
    const result = runCLI(['--block', '--secrets', '1', '-q'], input);
    assert.strictEqual(result.exitCode, 1);
  });

  it('should show block reason in stderr', () => {
    const input = `KEY=${'sk-' + 'ant-' + 'a'.repeat(100)}`;
    const result = runCLI(['--block', '--secrets', '1'], input);
    assert.strictEqual(result.exitCode, 1);
    assert.match(result.stderr, /BLOCKED/);
  });
});

describe('CLI - Sanitize Mode (Default)', () => {
  it('should always exit 0 in sanitize mode', () => {
    const input = `KEY=${'sk-' + 'ant-' + 'a'.repeat(100)}`;
    const result = runCLI(['-q'], input);
    assert.strictEqual(result.exitCode, 0);
  });

  it('should redact secrets in sanitize mode', () => {
    const input = `ANTHROPIC_KEY=${'sk-' + 'ant-' + 'a'.repeat(100)}`;
    const result = runCLI(['-q'], input);
    assert.strictEqual(result.exitCode, 0);
    assert.match(result.stdout, /REDACTED/);
    assert.doesNotMatch(result.stdout, /sk-ant-aaa/);
  });

  it('should show statistics in stderr by default', () => {
    const input = `KEY=${'sk-' + 'ant-' + 'a'.repeat(100)}`;
    const result = runCLI([], input);
    assert.strictEqual(result.exitCode, 0);
    assert.match(result.stderr, /secret\(s\) redacted/);
  });
});

describe('CLI - Quiet Mode', () => {
  it('should suppress statistics with --quiet', () => {
    const input = `KEY=${'sk-' + 'ant-' + 'a'.repeat(100)}`;
    const result = runCLI(['-q'], input);
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stderr, '');
  });

  it('should only output sanitized content in quiet mode', () => {
    const input = 'SAFE_VALUE=123';
    const result = runCLI(['-q'], input);
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stdout.trim(), 'SAFE_VALUE=123');
  });
});

describe('CLI - File Input', () => {
  let tmpDir;
  let tmpFile;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'xswarm-test-'));
    tmpFile = join(tmpDir, 'test.txt');
  });

  after(() => {
    try { unlinkSync(tmpFile); } catch (e) { /* ignore */ }
  });

  it('should read from file', () => {
    writeFileSync(tmpFile, `KEY=${'sk-' + 'ant-' + 'a'.repeat(100)}`);
    const result = runCLI(['-q', tmpFile]);
    assert.strictEqual(result.exitCode, 0);
    assert.match(result.stdout, /REDACTED/);
  });

  it('should handle non-existent file', () => {
    const result = runCLI(['-q', '/nonexistent/file.txt']);
    assert.notStrictEqual(result.exitCode, 0);
  });

  it('should handle empty file', () => {
    writeFileSync(tmpFile, '');
    const result = runCLI(['-q', tmpFile]);
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stdout, '');
  });
});

describe('CLI - Stdin Input', () => {
  it('should read from stdin', () => {
    const input = `KEY=${'sk-' + 'ant-' + 'a'.repeat(100)}`;
    const result = runCLI(['-q'], input);
    assert.strictEqual(result.exitCode, 0);
    assert.match(result.stdout, /REDACTED/);
  });

  it('should handle empty stdin', () => {
    const result = runCLI(['-q'], '');
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stdout, '');
  });
});

describe('CLI - Options Parsing', () => {
  it('should accept --mode sanitize', () => {
    const input = 'const x = 1;';
    const result = runCLI(['--mode', 'sanitize', '-q'], input);
    assert.strictEqual(result.exitCode, 0);
  });

  it('should accept --mode block', () => {
    const input = 'const x = 1;';
    const result = runCLI(['--mode', 'block', '-q'], input);
    assert.strictEqual(result.exitCode, 0);
  });

  it('should accept -b as shorthand for block', () => {
    const input = 'const x = 1;';
    const result = runCLI(['-b', '-q'], input);
    assert.strictEqual(result.exitCode, 0);
  });

  it('should reject invalid mode', () => {
    const input = 'const x = 1;';
    const result = runCLI(['--mode', 'invalid', '-q'], input);
    assert.notStrictEqual(result.exitCode, 0);
  });
});

describe('CLI - Integration', () => {
  it('should work in a pipeline', () => {
    const input = `KEY=${'sk-' + 'ant-' + 'a'.repeat(100)}`;
    const result = runCLI(['-q'], input);
    assert.strictEqual(result.exitCode, 0);
    assert.match(result.stdout, /REDACTED/);
    assert.ok(result.stdout.length > 0);
  });

  it('should be usable for pre-commit hooks', () => {
    const safeInput = 'const x = 1;';
    const unsafeInput = `KEY=${'sk-' + 'ant-' + 'a'.repeat(100)}`;

    const safeResult = runCLI(['--block', '--secrets', '1', '-q'], safeInput);
    const unsafeResult = runCLI(['--block', '--secrets', '1', '-q'], unsafeInput);

    assert.strictEqual(safeResult.exitCode, 0);
    assert.strictEqual(unsafeResult.exitCode, 1);
  });
});

describe('CLI - Performance', () => {
  it('should process quickly (<1s for small files)', () => {
    const input = 'const x = 1; const y = 2;';
    const start = Date.now();
    const result = runCLI(['-q'], input);
    const duration = Date.now() - start;
    assert.strictEqual(result.exitCode, 0);
    assert.ok(duration < 1000, `Took ${duration}ms, expected <1000ms`);
  });
});
