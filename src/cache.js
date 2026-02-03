import { createHash } from 'node:crypto';

/**
 * Create an LRU cache with TTL support.
 * @param {Object} [options]
 * @param {number} [options.maxSize=1000] - Maximum number of cached items
 * @param {number} [options.ttl=300000] - TTL in milliseconds (default 5 min)
 * @returns {{ get, set, has, clear, size, hashKey }}
 */
export function createCache(options = {}) {
  const { maxSize = 1000, ttl = 300_000 } = options;
  const map = new Map(); // Map preserves insertion order for LRU

  function hashKey(content) {
    return createHash('sha256').update(content).digest('hex');
  }

  function evict() {
    // Remove oldest entries (first in Map) until under maxSize
    while (map.size >= maxSize) {
      const firstKey = map.keys().next().value;
      map.delete(firstKey);
    }
  }

  function isExpired(entry) {
    return Date.now() - entry.timestamp > ttl;
  }

  return {
    hashKey,
    get(key) {
      const entry = map.get(key);
      if (!entry) return undefined;
      if (isExpired(entry)) { map.delete(key); return undefined; }
      // Move to end (most recently used)
      map.delete(key);
      map.set(key, entry);
      return entry.value;
    },
    set(key, value) {
      map.delete(key); // Remove if exists (for re-ordering)
      evict();
      map.set(key, { value, timestamp: Date.now() });
    },
    has(key) {
      const entry = map.get(key);
      if (!entry) return false;
      if (isExpired(entry)) { map.delete(key); return false; }
      return true;
    },
    clear() { map.clear(); },
    get size() { return map.size; }
  };
}
