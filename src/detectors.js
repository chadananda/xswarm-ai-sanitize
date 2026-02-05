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
 * Detect all secrets in text
 */
export function detectAll(text) {
  const secrets = detectSecrets(text);

  const highSeverity = secrets.filter(
    item => item.severity === 'critical' || item.severity === 'high'
  ).length;

  return {
    secrets,
    counts: {
      secrets: secrets.length,
      highSeverity
    }
  };
}

/**
 * Redact secrets from text
 */
export function redactSecrets(text, secrets) {
  if (!text || !secrets || secrets.length === 0) return text;

  // Sort by position ascending, then by length descending (prefer longer matches)
  const sorted = [...secrets].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return b.value.length - a.value.length;
  });

  // De-duplicate overlapping matches - keep earliest/longest for each region
  const nonOverlapping = [];
  let lastEnd = -1;

  for (const secret of sorted) {
    const start = secret.position;
    const end = start + secret.value.length;

    // Skip if this overlaps with previous match
    if (start < lastEnd) continue;

    nonOverlapping.push(secret);
    lastEnd = end;
  }

  // Now redact in reverse order to avoid position shifts
  let result = text;
  for (let i = nonOverlapping.length - 1; i >= 0; i--) {
    const secret = nonOverlapping[i];
    const before = result.slice(0, secret.position);
    const after = result.slice(secret.position + secret.value.length);
    result = before + `[REDACTED:${secret.name}]` + after;
  }

  return result;
}

/** Number of compiled secret patterns */
export const patternCount = secretPatterns.length;
