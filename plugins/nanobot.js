/**
 * Nanobot Integration Plugin
 * Sanitizes MCP tool results and agent outputs
 *
 * Nanobot is an MCP-based agent framework that turns MCP servers into AI agents.
 * This plugin provides filters for sanitizing data flowing through MCP tools.
 */

import sanitize from '../src/index.js';

/**
 * Create an MCP tool result filter for Nanobot
 * @param {Object} config - Sanitization configuration
 * @returns {Object} Nanobot filter
 */
export function createSanitizeFilter(config = {}) {
  const options = {
    mode: config.mode || 'sanitize',
    blockThreshold: config.blockThreshold || {
      secrets: 3,
      highSeverity: 1
    }
  };

  return {
    name: 'xswarm-ai-sanitize',
    version: '1.0.0',

    /**
     * Filter tool results before they reach the agent
     */
    filterToolResult(toolName, result) {
      let textContent;

      if (typeof result === 'string') {
        textContent = result;
      } else if (result && typeof result === 'object') {
        // Handle MCP content format
        if (Array.isArray(result.content)) {
          // MCP returns content as array of content blocks
          textContent = result.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('\n');
        } else {
          textContent = result.content || result.text || JSON.stringify(result);
        }
      } else {
        return result;
      }

      const sanitized = sanitize(textContent, options);

      if (sanitized.blocked) {
        if (options.mode === 'block') {
          throw new Error(`Tool result blocked: ${sanitized.reason}`);
        }
        return {
          content: [{ type: 'text', text: `[BLOCKED: ${sanitized.reason}]` }],
          _blocked: true
        };
      }

      // Return in MCP format
      if (typeof result === 'string') {
        return sanitized.sanitized;
      }

      if (Array.isArray(result.content)) {
        return {
          ...result,
          content: result.content.map(block => {
            if (block.type === 'text') {
              const blockResult = sanitize(block.text, options);
              return { ...block, text: blockResult.sanitized };
            }
            return block;
          }),
          _sanitized: true
        };
      }

      return {
        ...result,
        content: sanitized.sanitized,
        _sanitized: true
      };
    },

    /**
     * Filter messages before they're stored in context
     */
    filterMessage(message) {
      if (!message.content) return message;

      let textContent;
      if (typeof message.content === 'string') {
        textContent = message.content;
      } else if (Array.isArray(message.content)) {
        // Handle content blocks
        const textBlocks = message.content.filter(b => b.type === 'text');
        if (textBlocks.length === 0) return message;
        textContent = textBlocks.map(b => b.text).join('\n');
      } else {
        return message;
      }

      const sanitized = sanitize(textContent, options);

      if (sanitized.blocked) {
        return {
          ...message,
          content: `[BLOCKED: ${sanitized.reason}]`,
          _blocked: true
        };
      }

      if (typeof message.content === 'string') {
        return {
          ...message,
          content: sanitized.sanitized,
          _sanitized: true
        };
      }

      // Handle content blocks
      return {
        ...message,
        content: message.content.map(block => {
          if (block.type === 'text') {
            const blockResult = sanitize(block.text, options);
            return { ...block, text: blockResult.sanitized };
          }
          return block;
        }),
        _sanitized: true
      };
    }
  };
}

/**
 * Wrap an MCP tool to sanitize its outputs
 * @param {Object} tool - The MCP tool definition
 * @param {Object} config - Sanitization configuration
 * @returns {Object} Wrapped tool
 */
export function wrapMCPTool(tool, config = {}) {
  const options = {
    mode: config.mode || 'sanitize',
    blockThreshold: config.blockThreshold || {
      secrets: 3,
      highSeverity: 1
    }
  };

  return {
    ...tool,

    async execute(args) {
      const result = await tool.execute(args);

      const filter = createSanitizeFilter(options);
      return filter.filterToolResult(tool.name, result);
    }
  };
}

/**
 * Create a Nanobot middleware that sanitizes all tool outputs
 * Use this in your nanobot configuration
 * @param {Object} config - Sanitization configuration
 * @returns {Function} Middleware function
 */
export function createMiddleware(config = {}) {
  const filter = createSanitizeFilter(config);

  return function nanobotSanitizeMiddleware(ctx, next) {
    // Intercept tool results
    const originalToolResult = ctx.toolResult;
    if (originalToolResult) {
      ctx.toolResult = filter.filterToolResult(ctx.toolName, originalToolResult);
    }

    return next();
  };
}

export default { createSanitizeFilter, wrapMCPTool, createMiddleware };
