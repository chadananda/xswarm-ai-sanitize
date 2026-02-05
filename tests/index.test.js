import { test } from 'node:test';
import assert from 'node:assert';
import sanitize from '../src/index.js';

test('sanitize - requires mode option', () => {
  assert.throws(() => {
    sanitize('test');
  }, /mode is required/);
});

test('sanitize - accepts block mode', () => {
  const result = sanitize('clean text', { mode: 'block' });
  assert.ok(result);
  assert.strictEqual(result.blocked, false);
});

test('sanitize - accepts sanitize mode', () => {
  const result = sanitize('clean text', { mode: 'sanitize' });
  assert.ok(result);
  assert.strictEqual(result.blocked, false);
});

test('sanitize - BLOCK mode blocks high-severity content', () => {
  const text = 'Key: AKIAIOSFODNN7EXAMPLE, Token: ' + 'ghp_' + 'FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE, Secret: ' + 'sk_' + 'live_' + 'FAKEFAKEFAKEFAKEFAKEFAKE';
  const result = sanitize(text, { mode: 'block' });
  assert.strictEqual(result.blocked, true);
  assert.ok(result.reason);
});

test('sanitize - BLOCK mode allows below threshold', () => {
  const text = 'One key: AKIAIOSFODNN7EXAMPLE';
  const result = sanitize(text, {
    mode: 'block',
    blockThreshold: { secrets: 5, highSeverity: 5 }
  });
  assert.strictEqual(result.blocked, false);
  assert.ok(result.sanitized);
});

test('sanitize - BLOCK mode custom thresholds', () => {
  const text = 'Key1: AKIAIOSFODNN7EXAMPLE';
  const result = sanitize(text, {
    mode: 'block',
    blockThreshold: { secrets: 1, highSeverity: 10 }
  });
  assert.strictEqual(result.blocked, true);
});

test('sanitize - SANITIZE mode never blocks', () => {
  const text = 'AKIAIOSFODNN7EXAMPLE AKIAIOSFODNN7EXAMPLE AKIAIOSFODNN7EXAMPLE';
  const result = sanitize(text, { mode: 'sanitize' });
  assert.strictEqual(result.blocked, false);
  assert.ok(result.sanitized);
  assert.ok(!result.sanitized.includes('AKIAIOSFODNN7EXAMPLE'));
});

test('sanitize - SANITIZE mode reports actions', () => {
  const text = 'Key: AKIAIOSFODNN7EXAMPLE';
  const result = sanitize(text, { mode: 'sanitize' });
  assert.ok(result.actions);
  assert.ok(result.actions.includes('secrets_redacted'));
});

test('sanitize - handles empty content', () => {
  const result = sanitize('', { mode: 'block' });
  assert.strictEqual(result.blocked, false);
  assert.strictEqual(result.safe, true);
});

test('sanitize - handles null content', () => {
  const result = sanitize(null, { mode: 'sanitize' });
  assert.strictEqual(result.blocked, false);
  assert.strictEqual(result.safe, true);
});

test('sanitize - redacts secrets in output', () => {
  const text = 'My AWS key is AKIAIOSFODNN7EXAMPLE';
  const result = sanitize(text, {
    mode: 'block',
    blockThreshold: { secrets: 10, highSeverity: 10 }
  });
  assert.ok(!result.sanitized.includes('AKIAIOSFODNN7EXAMPLE'));
  assert.ok(result.sanitized.includes('[REDACTED:'));
});

test('sanitize - reports threat counts', () => {
  const text = 'Key: AKIAIOSFODNN7EXAMPLE';
  const result = sanitize(text, { mode: 'sanitize' });
  assert.ok(result.threats);
  assert.ok(result.threats.secrets >= 1);
});

test('sanitize - safe content returns safe=true', () => {
  const text = 'This is completely safe content';
  const result = sanitize(text, { mode: 'block' });
  assert.strictEqual(result.safe, true);
  assert.strictEqual(result.blocked, false);
});

test('sanitize - is synchronous (no Promise returned)', () => {
  const result = sanitize('clean text', { mode: 'block' });
  // Should NOT be a Promise
  assert.strictEqual(typeof result.then, 'undefined');
  assert.ok(result.safe);
});

test('sanitize - caching works for identical content', () => {
  const text = 'unique content for cache test 12345';
  const options = { mode: 'block' };
  const result1 = sanitize(text, options);
  const result2 = sanitize(text, options);
  assert.deepStrictEqual(result1, result2);
});
