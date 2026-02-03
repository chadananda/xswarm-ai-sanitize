/**
 * xswarm-ai-sanitize
 * Universal security filter for AI agents - detects and neutralizes secret leakage and prompt injection attacks
 */

import { detectAll, redactSecrets, removeInjections } from './detectors.js';
import { analyzeWithAI } from './ai.js';
import { createCache } from './cache.js';

// Create cache instance with 5-minute TTL
const cache = createCache({ maxSize: 1000, ttl: 5 * 60 * 1000 });

/**
 * Main sanitization function
 * @param {string} content - Content to analyze and sanitize
 * @param {Object} options - Configuration options
 * @param {string} options.mode - 'block' or 'sanitize'
 * @param {string} [options.direction='inbound'] - 'inbound', 'outbound', or 'storage'
 * @param {Object} [options.ai] - AI provider configuration
 * @param {boolean} [options.ai.enabled=false] - Enable AI-enhanced analysis
 * @param {string} [options.ai.provider] - 'groq', 'ollama', 'openai', 'anthropic', 'lmstudio'
 * @param {string} [options.ai.model] - Model name
 * @param {string} [options.ai.endpoint] - Custom endpoint URL
 * @param {string} [options.ai.apiKey] - API key for cloud providers
 * @param {Object} [options.blockThreshold] - Thresholds for BLOCK mode
 * @param {number} [options.blockThreshold.secrets=3] - Block if this many secrets found
 * @param {number} [options.blockThreshold.injections=2] - Block if this many injections found
 * @param {number} [options.blockThreshold.highSeverity=1] - Block if any high-severity threats
 * @returns {Promise<Object>} Sanitization result
 */
export default async function sanitize(content, options = {}) {
  // Validate required options
  if (!options.mode || !['block', 'sanitize'].includes(options.mode)) {
    throw new Error('options.mode is required and must be "block" or "sanitize"');
  }

  if (!content || typeof content !== 'string') {
    return options.mode === 'block'
      ? { blocked: false, safe: true, sanitized: content || '', threats: { secrets: 0, injections: 0, details: [] } }
      : { blocked: false, safe: true, sanitized: content || '', threats: { secrets: 0, injections: 0 }, actions: [] };
  }

  // Check cache
  const cacheKey = cache.hashKey(content + JSON.stringify(options));
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  // Pattern-based detection
  const patternResults = detectAll(content);

  // AI-enhanced analysis (optional)
  let aiResults = null;
  if (options.ai?.enabled) {
    try {
      aiResults = await analyzeWithAI(content, options.ai);
    } catch (err) {
      // AI errors are non-fatal, fall back to pattern-only
      console.warn('AI analysis failed, using pattern-only detection:', err.message);
    }
  }

  // Merge pattern and AI results
  let allSecrets = [...patternResults.secrets];
  let allInjections = [...patternResults.injections];

  if (aiResults && aiResults.confidence > 0.5) {
    // Add AI-detected threats that don't overlap with pattern matches
    const patternPositions = new Set(patternResults.secrets.map(s => s.position));
    for (const aiSecret of aiResults.secrets || []) {
      if (!patternPositions.has(aiSecret.position)) {
        allSecrets.push({
          name: aiSecret.type || 'ai_detected_secret',
          severity: aiSecret.severity || 'medium',
          value: '',
          position: aiSecret.position || 0,
          source: 'ai'
        });
      }
    }

    const injectionPositions = new Set(patternResults.injections.map(i => i.position));
    for (const aiInjection of aiResults.injections || []) {
      if (!injectionPositions.has(aiInjection.position)) {
        allInjections.push({
          name: aiInjection.type || 'ai_detected_injection',
          severity: aiInjection.severity || 'medium',
          value: '',
          position: aiInjection.position || 0,
          source: 'ai'
        });
      }
    }
  }

  // Count high-severity threats
  const highSeverity = [...allSecrets, ...allInjections].filter(
    item => item.severity === 'critical' || item.severity === 'high'
  ).length;

  // Mode-specific logic
  if (options.mode === 'block') {
    const threshold = {
      secrets: options.blockThreshold?.secrets ?? 3,
      injections: options.blockThreshold?.injections ?? 2,
      highSeverity: options.blockThreshold?.highSeverity ?? 1
    };

    // Check if content should be blocked
    const shouldBlock =
      allSecrets.length >= threshold.secrets ||
      allInjections.length >= threshold.injections ||
      highSeverity >= threshold.highSeverity;

    if (shouldBlock) {
      const result = {
        blocked: true,
        safe: false,
        threats: {
          secrets: allSecrets.length,
          injections: allInjections.length,
          details: [...allSecrets, ...allInjections].map(t => ({
            type: t.name,
            severity: t.severity,
            position: t.position
          }))
        },
        reason: `Content blocked: ${allSecrets.length} secrets, ${allInjections.length} injections, ${highSeverity} high-severity threats`
      };
      cache.set(cacheKey, result);
      return result;
    }

    // Not blocked - sanitize and return
    let sanitized = redactSecrets(content, allSecrets);
    sanitized = removeInjections(sanitized, allInjections);

    const result = {
      blocked: false,
      safe: allSecrets.length === 0 && allInjections.length === 0,
      sanitized,
      threats: {
        secrets: allSecrets.length,
        injections: allInjections.length,
        details: [...allSecrets, ...allInjections].map(t => ({
          type: t.name,
          severity: t.severity,
          position: t.position
        }))
      }
    };
    cache.set(cacheKey, result);
    return result;
  }

  // SANITIZE mode - always return cleaned content, never block
  let sanitized = redactSecrets(content, allSecrets);
  sanitized = removeInjections(sanitized, allInjections);

  const actions = [];
  if (allSecrets.length > 0) actions.push('secrets_redacted');
  if (allInjections.length > 0) actions.push('injections_removed');

  const result = {
    blocked: false,
    safe: allSecrets.length === 0 && allInjections.length === 0,
    sanitized,
    threats: {
      secrets: allSecrets.length,
      injections: allInjections.length
    },
    actions
  };
  cache.set(cacheKey, result);
  return result;
}

/**
 * Synchronous sanitization (pattern-only, no AI)
 */
sanitize.sync = function (content, options = {}) {
  if (!options.mode || !['block', 'sanitize'].includes(options.mode)) {
    throw new Error('options.mode is required and must be "block" or "sanitize"');
  }

  if (!content || typeof content !== 'string') {
    return options.mode === 'block'
      ? { blocked: false, safe: true, sanitized: content || '', threats: { secrets: 0, injections: 0, details: [] } }
      : { blocked: false, safe: true, sanitized: content || '', threats: { secrets: 0, injections: 0 }, actions: [] };
  }

  const patternResults = detectAll(content);
  const highSeverity = patternResults.counts.highSeverity;

  if (options.mode === 'block') {
    const threshold = {
      secrets: options.blockThreshold?.secrets ?? 3,
      injections: options.blockThreshold?.injections ?? 2,
      highSeverity: options.blockThreshold?.highSeverity ?? 1
    };

    const shouldBlock =
      patternResults.secrets.length >= threshold.secrets ||
      patternResults.injections.length >= threshold.injections ||
      highSeverity >= threshold.highSeverity;

    if (shouldBlock) {
      return {
        blocked: true,
        safe: false,
        threats: {
          secrets: patternResults.secrets.length,
          injections: patternResults.injections.length,
          details: [...patternResults.secrets, ...patternResults.injections].map(t => ({
            type: t.name,
            severity: t.severity,
            position: t.position
          }))
        },
        reason: `Content blocked: ${patternResults.secrets.length} secrets, ${patternResults.injections.length} injections, ${highSeverity} high-severity threats`
      };
    }

    let sanitized = redactSecrets(content, patternResults.secrets);
    sanitized = removeInjections(sanitized, patternResults.injections);

    return {
      blocked: false,
      safe: patternResults.secrets.length === 0 && patternResults.injections.length === 0,
      sanitized,
      threats: {
        secrets: patternResults.secrets.length,
        injections: patternResults.injections.length,
        details: [...patternResults.secrets, ...patternResults.injections].map(t => ({
          type: t.name,
          severity: t.severity,
          position: t.position
        }))
      }
    };
  }

  // SANITIZE mode
  let sanitized = redactSecrets(content, patternResults.secrets);
  sanitized = removeInjections(sanitized, patternResults.injections);

  const actions = [];
  if (patternResults.secrets.length > 0) actions.push('secrets_redacted');
  if (patternResults.injections.length > 0) actions.push('injections_removed');

  return {
    blocked: false,
    safe: patternResults.secrets.length === 0 && patternResults.injections.length === 0,
    sanitized,
    threats: {
      secrets: patternResults.secrets.length,
      injections: patternResults.injections.length
    },
    actions
  };
};
