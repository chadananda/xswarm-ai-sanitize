/**
 * File Watcher Plugin
 * Automatically sanitizes agent memory files on write
 */

import sanitize from '../src/index.js';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';

let chokidar;
try {
  chokidar = await import('chokidar');
} catch (err) {
  console.warn('chokidar not installed - file watcher unavailable. Install with: npm install chokidar');
}

/**
 * Create file watcher for agent memory files
 * @param {string[]} patterns - Glob patterns to watch
 * @param {Object} config - Sanitization configuration
 * @param {string} [config.mode='sanitize'] - Always use 'sanitize' mode for memory files
 * @returns {Object} Watcher instance with close() method
 */
export default function createWatcher(patterns, config = {}) {
  if (!chokidar) {
    throw new Error('chokidar is required for file watching. Install with: npm install chokidar');
  }

  const defaultConfig = {
    mode: 'sanitize' // Always sanitize, never block memory files
  };

  // Expand home directory in patterns
  const expandedPatterns = patterns.map(pattern =>
    pattern.replace(/^~/, homedir())
  );

  // Track files being processed to prevent re-entry
  const processing = new Set();

  // Debounce timer
  let debounceTimers = new Map();

  /**
   * Sanitize a file
   */
  async function sanitizeFile(filePath) {
    if (processing.has(filePath)) {
      return; // Already processing
    }

    if (!existsSync(filePath)) {
      return; // File deleted
    }

    processing.add(filePath);

    try {
      const content = await readFile(filePath, 'utf-8');
      const result = sanitize(content, defaultConfig);

      // Only rewrite if changes were made
      if (result.sanitized !== content) {
        await writeFile(filePath, result.sanitized, 'utf-8');
        console.log(`Sanitized: ${filePath} (${result.actions?.join(', ') || 'no threats'})`);
      }
    } catch (err) {
      console.error(`Error sanitizing ${filePath}:`, err.message);
    } finally {
      processing.delete(filePath);
    }
  }

  /**
   * Handle file change with debounce
   */
  function handleChange(filePath) {
    // Clear existing timer
    if (debounceTimers.has(filePath)) {
      clearTimeout(debounceTimers.get(filePath));
    }

    // Set new timer (500ms debounce)
    const timer = setTimeout(() => {
      debounceTimers.delete(filePath);
      sanitizeFile(filePath);
    }, 500);

    debounceTimers.set(filePath, timer);
  }

  // Create watcher
  const watcher = chokidar.watch(expandedPatterns, {
    persistent: true,
    ignoreInitial: false, // Sanitize existing files on startup
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100
    }
  });

  watcher.on('add', handleChange);
  watcher.on('change', handleChange);

  watcher.on('error', err => {
    console.error('Watcher error:', err);
  });

  return {
    close: () => {
      // Clear all pending timers
      for (const timer of debounceTimers.values()) {
        clearTimeout(timer);
      }
      debounceTimers.clear();

      return watcher.close();
    }
  };
}
