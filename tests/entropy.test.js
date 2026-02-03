import { describe, it } from 'node:test';
import assert from 'node:assert';
import { shannonEntropy, isHighEntropy, extractHighEntropyStrings } from '../src/entropy.js';

describe('shannonEntropy', () => {
  it('returns 0 for empty string', () => {
    assert.strictEqual(shannonEntropy(''), 0);
  });

  it('returns 0 for null/undefined', () => {
    assert.strictEqual(shannonEntropy(null), 0);
    assert.strictEqual(shannonEntropy(undefined), 0);
  });

  it('returns 0 for single repeated char', () => {
    assert.strictEqual(shannonEntropy('aaaa'), 0);
    assert.strictEqual(shannonEntropy('zzzzzzzz'), 0);
  });

  it('returns 2 for 4 unique chars uniform distribution', () => {
    const entropy = shannonEntropy('abcd');
    assert.ok(Math.abs(entropy - 2.0) < 0.001);
  });

  it('high entropy for random-looking string', () => {
    assert.ok(shannonEntropy('aK3m9Xq2L7bR4nW8') > 3.5);
  });

  it('calculates correct entropy for simple patterns', () => {
    // 2 chars, 50/50 split: entropy = 1
    const entropy = shannonEntropy('aabb');
    assert.ok(Math.abs(entropy - 1.0) < 0.001);
  });

  it('high entropy for AWS-like keys', () => {
    assert.ok(shannonEntropy('AKIAIOSFODNN7EXAMPLE1') > 4.0);
  });

  it('low entropy for repetitive patterns', () => {
    assert.ok(shannonEntropy('abababababababab') < 1.5);
  });

  it('handles single character', () => {
    assert.strictEqual(shannonEntropy('a'), 0);
  });

  it('handles special characters', () => {
    const entropy = shannonEntropy('!@#$%^&*()');
    assert.ok(entropy > 0);
  });
});

describe('isHighEntropy', () => {
  it('returns false for short strings', () => {
    assert.strictEqual(isHighEntropy('abc'), false);
    assert.strictEqual(isHighEntropy('abcdefghijklmno'), false); // 15 chars
  });

  it('returns false for null/undefined', () => {
    assert.strictEqual(isHighEntropy(null), false);
    assert.strictEqual(isHighEntropy(undefined), false);
  });

  it('returns false for empty string', () => {
    assert.strictEqual(isHighEntropy(''), false);
  });

  it('returns false for low entropy long string', () => {
    assert.strictEqual(isHighEntropy('aaaaaaaaaaaaaaaa'), false);
    assert.strictEqual(isHighEntropy('hellohellohellohello'), false);
  });

  it('returns true for high-entropy token', () => {
    assert.strictEqual(isHighEntropy('AKIAIOSFODNN7EXAMPLE1'), true);
  });

  it('respects custom threshold', () => {
    assert.strictEqual(isHighEntropy('abcdefghijklmnop', 5.0), false);
    assert.strictEqual(isHighEntropy('abcdefghijklmnop', 3.0), true);
  });

  it('uses default threshold of 4.5', () => {
    // String with entropy around 4.5
    const highEntropyStr = 'aK3m9Xq2L7bR4nW8pZ5j';
    const entropy = shannonEntropy(highEntropyStr);
    assert.strictEqual(isHighEntropy(highEntropyStr), entropy >= 4.5);
  });

  it('returns true for JWT-like tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0';
    assert.strictEqual(isHighEntropy(jwt), true);
  });

  it('returns false for English words >= 16 chars', () => {
    assert.strictEqual(isHighEntropy('internationalization'), false);
    assert.strictEqual(isHighEntropy('congratulations!'), false);
  });
});

describe('extractHighEntropyStrings', () => {
  it('finds secrets in prose text', () => {
    const text = 'Deploy with key AKIAIOSFODNN7EXAMPLE1 on server';
    const results = extractHighEntropyStrings(text);
    assert.ok(results.length > 0);
    assert.ok(results[0].value.includes('AKIA'));
  });

  it('returns empty for benign text', () => {
    const results = extractHighEntropyStrings('Hello world this is normal text');
    assert.strictEqual(results.length, 0);
  });

  it('includes position information', () => {
    const text = 'key=AKIAIOSFODNN7EXAMPLE1';
    const results = extractHighEntropyStrings(text);
    assert.ok(results.length > 0);
    assert.strictEqual(typeof results[0].position, 'number');
    assert.ok(results[0].position >= 0);
  });

  it('includes entropy value', () => {
    const text = 'secret: aK3m9Xq2L7bR4nW8pZ5jTy6Hq9';
    const results = extractHighEntropyStrings(text);
    assert.ok(results.length > 0);
    assert.strictEqual(typeof results[0].entropy, 'number');
    assert.ok(results[0].entropy > 4.5);
  });

  it('respects custom threshold', () => {
    const text = 'token: abcdefghijklmnop';
    const resultsDefault = extractHighEntropyStrings(text);
    const resultsLow = extractHighEntropyStrings(text, { threshold: 3.0 });
    assert.strictEqual(resultsDefault.length, 0);
    assert.ok(resultsLow.length > 0);
  });

  it('respects minLength option', () => {
    const text = 'short: aK3m9Xq2L7bR4nW8';
    const results = extractHighEntropyStrings(text, { minLength: 20 });
    assert.strictEqual(results.length, 0);
  });

  it('respects maxLength option', () => {
    const longSecret = 'a'.repeat(300);
    const text = `secret: ${longSecret}`;
    const results = extractHighEntropyStrings(text, { maxLength: 256 });
    assert.strictEqual(results.length, 0);
  });

  it('finds multiple secrets in same text', () => {
    const text = 'Key1: AKIAIOSFODNN7EXAMPLE1 and Key2: ' + 'sk_' + 'test_' + 'FAKEFAKEFAKEFAKEFAKEFAKE';
    const results = extractHighEntropyStrings(text);
    assert.ok(results.length >= 2);
  });

  it('handles text with no tokens', () => {
    const results = extractHighEntropyStrings('');
    assert.strictEqual(results.length, 0);
  });

  it('handles text with only short tokens', () => {
    const results = extractHighEntropyStrings('a b c d e f g h i j k');
    assert.strictEqual(results.length, 0);
  });

  it('extracts JWT tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ';
    const text = `Authorization: Bearer ${jwt}`;
    const results = extractHighEntropyStrings(text);
    assert.ok(results.length > 0);
  });

  it('handles base64-encoded strings', () => {
    const base64 = 'SGVsbG8gV29ybGQhIFRoaXMgaXMgYSB0ZXN0';
    const text = `data: ${base64}`;
    const results = extractHighEntropyStrings(text);
    assert.ok(results.length > 0);
  });

  it('returns correct position for multiple matches', () => {
    const text = 'First: AKIAIOSFODNN7EXAMPLE1 Second: ' + 'sk_' + 'test_' + 'FAKEFAKEFAKEFAKEFAKEFAKE';
    const results = extractHighEntropyStrings(text);
    assert.ok(results.length >= 2);
    assert.ok(results[0].position < results[1].position);
  });

  it('handles tokens with allowed special chars', () => {
    const text = 'token: aK3-m9X_q2L+7bR/4nW=8';
    const results = extractHighEntropyStrings(text, { threshold: 4.0 });
    assert.ok(results.length > 0);
  });

  it('does not extract low entropy long strings', () => {
    const text = 'password: aaaaaaaaaaaaaaaa';
    const results = extractHighEntropyStrings(text);
    assert.strictEqual(results.length, 0);
  });

  it('handles options with all parameters', () => {
    const text = 'secret: aK3m9Xq2L7bR4nW8pZ5jTy6Hq9';
    const results = extractHighEntropyStrings(text, {
      threshold: 4.0,
      minLength: 20,
      maxLength: 100
    });
    assert.ok(results.length > 0);
    assert.ok(results[0].value.length >= 20);
    assert.ok(results[0].value.length <= 100);
  });

  it('handles text with no high entropy strings but valid length', () => {
    const text = 'normal: hellohellohellohello';
    const results = extractHighEntropyStrings(text);
    assert.strictEqual(results.length, 0);
  });

  it('correctly calculates position in complex text', () => {
    const text = 'prefix text AKIAIOSFODNN7EXAMPLE1 suffix';
    const results = extractHighEntropyStrings(text);
    assert.ok(results.length > 0);
    assert.strictEqual(text.substring(results[0].position).startsWith('AKIA'), true);
  });
});
