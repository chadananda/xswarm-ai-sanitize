/**
 * OpenClaw Framework Plugin
 * Auto-protects all external tool results by filtering through xswarm-ai-sanitize
 */

import sanitize from '../src/index.js';

/**
 * Create OpenClaw plugin with specified configuration
 * @param {Object} config - Sanitization configuration
 * @param {string} config.mode - 'block' or 'sanitize'
 * @param {Object} [config.ai] - AI provider configuration
 * @param {Object} [config.blockThreshold] - Block thresholds for BLOCK mode
 * @returns {Object} OpenClaw plugin
 */
export default function createOpenClawPlugin(config = {}) {
  const defaultConfig = {
    mode: config.mode || 'block',
    ai: config.ai || { enabled: false },
    blockThreshold: config.blockThreshold || {
      secrets: 3,
      injections: 2,
      highSeverity: 1
    }
  };

  return {
    name: 'xswarm-ai-sanitize',
    version: '1.0.0',

    /**
     * Hook that runs after tool execution, before result is returned to agent
     */
    async onToolResult(event) {
      const { tool, result } = event;

      // Only sanitize external tools (skip internal commands)
      const externalTools = ['search', 'fetch', 'read_email', 'read_file', 'database_query'];
      if (!externalTools.includes(tool.name)) {
        return event;
      }

      // Extract text content from result
      let textContent = '';
      if (typeof result === 'string') {
        textContent = result;
      } else if (result && typeof result === 'object') {
        // Handle object results (e.g., { content: '...', metadata: {...} })
        textContent = result.content || result.text || result.body || JSON.stringify(result);
      }

      if (!textContent) {
        return event;
      }

      // Sanitize the content
      const sanitized = await sanitize(textContent, defaultConfig);

      // Handle BLOCK mode
      if (sanitized.blocked) {
        throw new Error(`Tool result blocked by security filter: ${sanitized.reason}`);
      }

      // Replace result with sanitized version
      if (typeof result === 'string') {
        event.result = sanitized.sanitized;
      } else if (result && typeof result === 'object') {
        event.result = {
          ...result,
          content: sanitized.sanitized,
          _sanitized: true,
          _threats: sanitized.threats
        };
      }

      return event;
    }
  };
}
