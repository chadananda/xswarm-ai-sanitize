/**
 * Pattern Detection Engine
 * Combines regex pattern matching with entropy-based secret detection
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { isHighEntropy, extractHighEntropyStrings } from './entropy.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const patternsData = JSON.parse(readFileSync(join(__dirname, 'patterns.json'), 'utf-8'));

// Pre-compile patterns at module level for performance
const secretPatterns = patternsData.secrets.map(p => ({
  ...p,
  compiled: new RegExp(p.regex, 'gi')
}));

const injectionPatterns = patternsData.injections.map(p => ({
  ...p,
  compiled: new RegExp(p.regex, 'gi')
}));

/**
 * Detect secrets in text using pattern matching and entropy analysis
 */
export function detectSecrets(text) {
  if (!text) return [];

  const findings = [];
  const foundPositions = new Set();

  // Pattern-based detection
  for (const pattern of secretPatterns) {
    pattern.compiled.lastIndex = 0; // Reset regex state
    let match;

    while ((match = pattern.compiled.exec(text)) !== null) {
      const value = match[1] || match[0];
      const position = match.index;

      // Skip if checkEntropy is required and entropy is low
      if (pattern.checkEntropy && !isHighEntropy(value)) {
        continue;
      }

      findings.push({
        name: pattern.name,
        severity: pattern.severity,
        value,
        position,
        source: 'pattern'
      });

      foundPositions.add(position);
    }
  }

  // Entropy-based detection for additional high-entropy strings
  const entropyFindings = extractHighEntropyStrings(text, {
    minLength: 16,
    threshold: 4.5
  });

  for (const finding of entropyFindings) {
    // Skip if already found by pattern matching
    if (!foundPositions.has(finding.position)) {
      findings.push({
        name: 'high_entropy_string',
        severity: 'medium',
        value: finding.value,
        position: finding.position,
        source: 'entropy'
      });
    }
  }

  return findings;
}

/**
 * Detect injection attempts in text
 */
export function detectInjections(text) {
  if (!text) return [];

  const findings = [];

  for (const pattern of injectionPatterns) {
    pattern.compiled.lastIndex = 0; // Reset regex state
    let match;

    while ((match = pattern.compiled.exec(text)) !== null) {
      const value = match[0];
      const position = match.index;

      findings.push({
        name: pattern.name,
        severity: pattern.severity,
        value,
        position
      });
    }
  }

  return findings;
}

/**
 * Detect all threats (secrets and injections)
 */
export function detectAll(text) {
  const secrets = detectSecrets(text);
  const injections = detectInjections(text);

  const highSeverity = [...secrets, ...injections].filter(
    item => item.severity === 'critical' || item.severity === 'high'
  ).length;

  return {
    secrets,
    injections,
    counts: {
      secrets: secrets.length,
      injections: injections.length,
      highSeverity
    }
  };
}

/**
 * Redact secrets from text
 */
export function redactSecrets(text, secrets) {
  if (!text || !secrets || secrets.length === 0) return text;

  // Sort by position descending to avoid position shifts
  const sorted = [...secrets].sort((a, b) => b.position - a.position);

  let result = text;
  for (const secret of sorted) {
    const before = result.slice(0, secret.position);
    const after = result.slice(secret.position + secret.value.length);
    result = before + `[REDACTED:${secret.name}]` + after;
  }

  return result;
}

/**
 * Remove injection patterns from text
 */
export function removeInjections(text, injections) {
  if (!text || !injections || injections.length === 0) return text;

  // Sort by position descending to avoid position shifts
  const sorted = [...injections].sort((a, b) => b.position - a.position);

  let result = text;
  for (const injection of sorted) {
    const before = result.slice(0, injection.position);
    const after = result.slice(injection.position + injection.value.length);
    result = before + after;
  }

  // Clean up excessive whitespace
  result = result.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines
  result = result.replace(/ {2,}/g, ' '); // Single spaces
  result = result.trim();

  return result;
}
