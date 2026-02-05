/**
 * xswarm-ai-sanitize
 * Fast, zero-dependency regex secret detection and sanitization
 */

import { detectAll, redactSecrets } from './detectors.js';
import { createCache } from './cache.js';

// Create cache instance with 5-minute TTL
const cache = createCache({ maxSize: 1000, ttl: 5 * 60 * 1000 });

/**
 * Main sanitization function (synchronous)
 * @param {string} content - Content to analyze and sanitize
 * @param {Object} options - Configuration options
 * @param {string} options.mode - 'block' or 'sanitize'
 * @param {Object} [options.blockThreshold] - Thresholds for BLOCK mode
 * @param {number} [options.blockThreshold.secrets=3] - Block if this many secrets found
 * @param {number} [options.blockThreshold.highSeverity=1] - Block if any high-severity threats
 * @returns {Object} Sanitization result
 */
export default function sanitize(content, options = {}) {
  if (!options.mode || !['block', 'sanitize'].includes(options.mode)) {
    throw new Error('options.mode is required and must be "block" or "sanitize"');
  }

  if (!content || typeof content !== 'string') {
    return options.mode === 'block'
      ? { blocked: false, safe: true, sanitized: content || '', threats: { secrets: 0, details: [] } }
      : { blocked: false, safe: true, sanitized: content || '', threats: { secrets: 0 }, actions: [] };
  }

  // Check cache
  const cacheKey = cache.hashKey(content + JSON.stringify(options));
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  // Pattern-based detection
  const patternResults = detectAll(content);
  const highSeverity = patternResults.counts.highSeverity;

  if (options.mode === 'block') {
    const threshold = {
      secrets: options.blockThreshold?.secrets ?? 3,
      highSeverity: options.blockThreshold?.highSeverity ?? 1
    };

    const shouldBlock =
      patternResults.secrets.length >= threshold.secrets ||
      highSeverity >= threshold.highSeverity;

    if (shouldBlock) {
      const result = {
        blocked: true,
        safe: false,
        threats: {
          secrets: patternResults.secrets.length,
          details: patternResults.secrets.map(t => ({
            type: t.name,
            severity: t.severity,
            position: t.position
          }))
        },
        reason: `Content blocked: ${patternResults.secrets.length} secret(s), ${highSeverity} high-severity`
      };
      cache.set(cacheKey, result);
      return result;
    }

    const sanitized = redactSecrets(content, patternResults.secrets);

    const result = {
      blocked: false,
      safe: patternResults.secrets.length === 0,
      sanitized,
      threats: {
        secrets: patternResults.secrets.length,
        details: patternResults.secrets.map(t => ({
          type: t.name,
          severity: t.severity,
          position: t.position
        }))
      }
    };
    cache.set(cacheKey, result);
    return result;
  }

  // SANITIZE mode
  const sanitized = redactSecrets(content, patternResults.secrets);

  const actions = [];
  if (patternResults.secrets.length > 0) actions.push('secrets_redacted');

  const result = {
    blocked: false,
    safe: patternResults.secrets.length === 0,
    sanitized,
    threats: {
      secrets: patternResults.secrets.length
    },
    actions
  };
  cache.set(cacheKey, result);
  return result;
}
