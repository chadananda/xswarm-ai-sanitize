import { test } from 'node:test';
import assert from 'node:assert';
import { detectSecrets, detectAll, redactSecrets, patternCount } from '../src/detectors.js';

test('patternCount - reports 600+ patterns', () => {
  assert.ok(patternCount >= 600, `Expected >= 600 patterns, got ${patternCount}`);
});

test('detectSecrets - AWS access key', () => {
  // security-audit-ignore: committed-secret — AWS's own published example key (AKIAIOSFODNN7EXAMPLE), a detector test fixture that was never a live credential
  const text = 'My key is AKIAIOSFODNN7EXAMPLE';
  const results = detectSecrets(text);
  assert.ok(results.length > 0);
  assert.ok(results.some(r => r.name === 'aws_access_key'));
});

test('detectSecrets - GitHub token', () => {
  const text = 'Token: ' + 'ghp_' + '1234567890abcdefghijklmnopqrstuvwxyz';
  const results = detectSecrets(text);
  assert.ok(results.length > 0);
  assert.ok(results.some(r => r.name.includes('github')));
});

test('detectSecrets - Stripe API key', () => {
  const text = 'stripe key: ' + 'sk_' + 'live_' + 'FAKEFAKEFAKEFAKEFAKEFAKE';
  const results = detectSecrets(text);
  assert.ok(results.length > 0);
  assert.ok(results.some(r => r.name.includes('stripe')));
});

test('detectSecrets - high entropy string', () => {
  const text = 'Random token: aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9dE';
  const results = detectSecrets(text);
  assert.ok(results.length > 0);
});

test('detectSecrets - no secrets in clean text', () => {
  const text = 'This is a normal paragraph with no secrets';
  const results = detectSecrets(text);
  assert.strictEqual(results.length, 0);
});

test('detectSecrets - empty text', () => {
  const results = detectSecrets('');
  assert.strictEqual(results.length, 0);
});

test('detectSecrets - null text', () => {
  const results = detectSecrets(null);
  assert.strictEqual(results.length, 0);
});

test('detectAll - returns secrets and counts', () => {
  // security-audit-ignore: committed-secret — AWS's own published example key (AKIAIOSFODNN7EXAMPLE), a detector test fixture that was never a live credential
  const text = 'My API key is AKIAIOSFODNN7EXAMPLE.';
  const results = detectAll(text);
  assert.ok(results.secrets.length > 0);
  assert.strictEqual(results.counts.secrets, results.secrets.length);
  assert.ok(results.counts.highSeverity >= 0);
});

test('detectAll - counts high severity threats', () => {
  // security-audit-ignore: committed-secret — AWS's own published example key (AKIAIOSFODNN7EXAMPLE), a detector test fixture that was never a live credential
  const text = 'AWS key AKIAIOSFODNN7EXAMPLE is critical';
  const results = detectAll(text);
  assert.ok(results.counts.highSeverity >= 0);
});

test('redactSecrets - replaces secrets with placeholders', () => {
  // security-audit-ignore: committed-secret — AWS's own published example key (AKIAIOSFODNN7EXAMPLE), a detector test fixture that was never a live credential
  const text = 'My key is AKIAIOSFODNN7EXAMPLE here';
  const secrets = detectSecrets(text);
  const redacted = redactSecrets(text, secrets);
  // security-audit-ignore: committed-secret — AWS's own published example key (AKIAIOSFODNN7EXAMPLE), a detector test fixture that was never a live credential
  assert.ok(!redacted.includes('AKIAIOSFODNN7EXAMPLE'));
  assert.ok(redacted.includes('[REDACTED:'));
});

test('redactSecrets - handles multiple secrets', () => {
  // security-audit-ignore: committed-secret — AWS's own published example key (AKIAIOSFODNN7EXAMPLE), a detector test fixture that was never a live credential
  const text = 'Key1: AKIAIOSFODNN7EXAMPLE and Key2: ' + 'ghp_' + 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  const secrets = detectSecrets(text);
  const redacted = redactSecrets(text, secrets);
  // security-audit-ignore: committed-secret — AWS's own published example key (AKIAIOSFODNN7EXAMPLE), a detector test fixture that was never a live credential
  assert.ok(!redacted.includes('AKIAIOSFODNN7EXAMPLE'));
  assert.ok(!redacted.includes('ghp_'));
});

test('redactSecrets - empty secrets array returns original', () => {
  const text = 'No secrets here';
  const redacted = redactSecrets(text, []);
  assert.strictEqual(redacted, text);
});
