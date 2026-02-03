/**
 * Calculate Shannon entropy of a string.
 * @param {string} str - Input string
 * @returns {number} Entropy value (0 to ~6 for typical strings)
 */
export function shannonEntropy(str) {
  if (!str || str.length === 0) return 0;
  const freq = {};
  for (const ch of str) freq[ch] = (freq[ch] || 0) + 1;
  const len = str.length;
  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Check if string has high entropy (likely a secret/token).
 * @param {string} str - Input string
 * @param {number} [threshold=4.5] - Entropy threshold
 * @returns {boolean} True if entropy exceeds threshold
 */
export function isHighEntropy(str, threshold = 4.5) {
  if (!str || str.length < 16) return false;
  return shannonEntropy(str) >= threshold;
}

/**
 * Extract potential secrets based on entropy analysis.
 * Splits text on whitespace/common delimiters and checks each token.
 * @param {string} text - Input text
 * @param {Object} [options]
 * @param {number} [options.threshold=4.5] - Entropy threshold
 * @param {number} [options.minLength=16] - Minimum token length to check
 * @param {number} [options.maxLength=256] - Maximum token length to check
 * @returns {Array<{value: string, entropy: number, position: number}>}
 */
export function extractHighEntropyStrings(text, options = {}) {
  const { threshold = 4.5, minLength = 16, maxLength = 256 } = options;
  const results = [];
  // Match word-like tokens including common secret chars: alphanumeric, -, _, +, /, =
  const tokenRegex = /[A-Za-z0-9_\-+/=.]{16,}/g;
  let match;
  while ((match = tokenRegex.exec(text)) !== null) {
    const token = match[0];
    if (token.length < minLength || token.length > maxLength) continue;
    const entropy = shannonEntropy(token);
    if (entropy >= threshold) {
      results.push({ value: token, entropy, position: match.index });
    }
  }
  return results;
}
