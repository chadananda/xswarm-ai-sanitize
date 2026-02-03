import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createCache } from '../src/cache.js';

describe('createCache', () => {
  it('stores and retrieves values', () => {
    const cache = createCache();
    cache.set('key1', 'value1');
    assert.strictEqual(cache.get('key1'), 'value1');
  });

  it('returns undefined for missing keys', () => {
    const cache = createCache();
    assert.strictEqual(cache.get('missing'), undefined);
  });

  it('evicts LRU entry when maxSize reached', () => {
    const cache = createCache({ maxSize: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3); // should evict 'a'
    assert.strictEqual(cache.has('a'), false);
    assert.strictEqual(cache.get('b'), 2);
    assert.strictEqual(cache.get('c'), 3);
  });

  it('promotes accessed entry (not evicted)', () => {
    const cache = createCache({ maxSize: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a'); // promote 'a'
    cache.set('c', 3); // should evict 'b' (not 'a')
    assert.strictEqual(cache.has('a'), true);
    assert.strictEqual(cache.has('b'), false);
  });

  it('expires entries after TTL', async () => {
    const cache = createCache({ ttl: 50 }); // 50ms TTL
    cache.set('x', 'val');
    assert.strictEqual(cache.get('x'), 'val');
    await new Promise(r => setTimeout(r, 60));
    assert.strictEqual(cache.get('x'), undefined);
  });

  it('hashKey produces consistent SHA-256 hex', () => {
    const cache = createCache();
    const h1 = cache.hashKey('hello');
    const h2 = cache.hashKey('hello');
    assert.strictEqual(h1, h2);
    assert.strictEqual(h1.length, 64); // SHA-256 hex length
  });

  it('clear removes all entries', () => {
    const cache = createCache();
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    assert.strictEqual(cache.size, 0);
  });

  it('has returns false for missing keys', () => {
    const cache = createCache();
    assert.strictEqual(cache.has('missing'), false);
  });

  it('has returns false for expired entries', async () => {
    const cache = createCache({ ttl: 50 });
    cache.set('x', 'val');
    assert.strictEqual(cache.has('x'), true);
    await new Promise(r => setTimeout(r, 60));
    assert.strictEqual(cache.has('x'), false);
  });

  it('size returns current count', () => {
    const cache = createCache();
    assert.strictEqual(cache.size, 0);
    cache.set('a', 1);
    assert.strictEqual(cache.size, 1);
    cache.set('b', 2);
    assert.strictEqual(cache.size, 2);
  });

  it('updates existing key without increasing size', () => {
    const cache = createCache();
    cache.set('a', 1);
    assert.strictEqual(cache.size, 1);
    cache.set('a', 2);
    assert.strictEqual(cache.size, 1);
    assert.strictEqual(cache.get('a'), 2);
  });

  it('hashKey produces different hashes for different content', () => {
    const cache = createCache();
    const h1 = cache.hashKey('hello');
    const h2 = cache.hashKey('world');
    assert.notStrictEqual(h1, h2);
  });

  it('handles maxSize of 1', () => {
    const cache = createCache({ maxSize: 1 });
    cache.set('a', 1);
    cache.set('b', 2);
    assert.strictEqual(cache.has('a'), false);
    assert.strictEqual(cache.has('b'), true);
  });

  it('get returns undefined and cleans up expired entry', async () => {
    const cache = createCache({ ttl: 50 });
    cache.set('x', 'val');
    assert.strictEqual(cache.size, 1);
    await new Promise(r => setTimeout(r, 60));
    assert.strictEqual(cache.get('x'), undefined);
    assert.strictEqual(cache.size, 0); // expired entry removed
  });

  it('has cleans up expired entry', async () => {
    const cache = createCache({ ttl: 50 });
    cache.set('x', 'val');
    assert.strictEqual(cache.size, 1);
    await new Promise(r => setTimeout(r, 60));
    assert.strictEqual(cache.has('x'), false);
    assert.strictEqual(cache.size, 0); // expired entry removed
  });

  it('uses default options when none provided', () => {
    const cache = createCache();
    // Should not throw and should work with defaults
    cache.set('key', 'value');
    assert.strictEqual(cache.get('key'), 'value');
  });

  it('accepts custom maxSize and ttl', () => {
    const cache = createCache({ maxSize: 5, ttl: 1000 });
    cache.set('a', 1);
    assert.strictEqual(cache.get('a'), 1);
  });
});
