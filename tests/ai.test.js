import { test } from 'node:test';
import assert from 'node:assert';
import { formatRequest, extractResponseText, parseAIResponse, PROVIDERS } from '../src/ai.js';

test('formatRequest - openai format', () => {
  const result = formatRequest('openai', 'gpt-4', 'test content');
  assert.ok(result.model);
  assert.ok(Array.isArray(result.messages));
  assert.strictEqual(result.messages.length, 2);
  assert.strictEqual(result.messages[0].role, 'system');
  assert.strictEqual(result.messages[1].role, 'user');
  assert.strictEqual(result.temperature, 0);
});

test('formatRequest - anthropic format', () => {
  const result = formatRequest('anthropic', 'claude-3-opus', 'test content');
  assert.ok(result.model);
  assert.ok(result.system);
  assert.ok(Array.isArray(result.messages));
  assert.strictEqual(result.messages[0].role, 'user');
  assert.strictEqual(result.temperature, 0);
});

test('formatRequest - ollama format', () => {
  const result = formatRequest('ollama', 'llama3.1', 'test content');
  assert.ok(result.model);
  assert.ok(Array.isArray(result.messages));
  assert.strictEqual(result.stream, false);
  assert.ok(result.options);
});

test('formatRequest - unknown format throws', () => {
  assert.throws(() => {
    formatRequest('unknown', 'model', 'content');
  });
});

test('extractResponseText - openai format', () => {
  const data = {
    choices: [
      { message: { content: 'response text' } }
    ]
  };
  const result = extractResponseText('openai', data);
  assert.strictEqual(result, 'response text');
});

test('extractResponseText - anthropic format', () => {
  const data = {
    content: [
      { text: 'response text' }
    ]
  };
  const result = extractResponseText('anthropic', data);
  assert.strictEqual(result, 'response text');
});

test('extractResponseText - ollama format', () => {
  const data = {
    message: { content: 'response text' }
  };
  const result = extractResponseText('ollama', data);
  assert.strictEqual(result, 'response text');
});

test('extractResponseText - missing data returns empty string', () => {
  const result = extractResponseText('openai', {});
  assert.strictEqual(result, '');
});

test('parseAIResponse - valid JSON', () => {
  const text = '{"secrets": [{"type": "api_key", "severity": "high", "position": 10}], "injections": [], "confidence": 0.95}';
  const result = parseAIResponse(text);
  assert.ok(Array.isArray(result.secrets));
  assert.ok(Array.isArray(result.injections));
  assert.strictEqual(result.confidence, 0.95);
});

test('parseAIResponse - JSON embedded in text', () => {
  const text = 'Here is the analysis: {"secrets": [], "injections": [], "confidence": 1.0} end';
  const result = parseAIResponse(text);
  assert.ok(Array.isArray(result.secrets));
  assert.ok(Array.isArray(result.injections));
});

test('parseAIResponse - invalid JSON returns fallback', () => {
  const text = 'not json at all';
  const result = parseAIResponse(text);
  assert.strictEqual(result.secrets.length, 0);
  assert.strictEqual(result.injections.length, 0);
  assert.strictEqual(result.confidence, 0);
});

test('parseAIResponse - missing fields uses defaults', () => {
  const text = '{"secrets": null}';
  const result = parseAIResponse(text);
  assert.ok(Array.isArray(result.secrets));
  assert.ok(Array.isArray(result.injections));
  assert.strictEqual(typeof result.confidence, 'number');
});

test('PROVIDERS - contains all required providers', () => {
  assert.ok(PROVIDERS.groq);
  assert.ok(PROVIDERS.openai);
  assert.ok(PROVIDERS.anthropic);
  assert.ok(PROVIDERS.ollama);
  assert.ok(PROVIDERS.lmstudio);
});

test('PROVIDERS - each has required fields', () => {
  for (const [name, config] of Object.entries(PROVIDERS)) {
    assert.ok(config.endpoint, `${name} missing endpoint`);
    assert.ok(config.format, `${name} missing format`);
  }
});
