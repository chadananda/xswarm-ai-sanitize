/**
 * Vercel AI SDK Integration Plugin
 * Sanitizes tool results and streaming outputs
 */

import sanitize from '../src/index.js';

/**
 * Create middleware for Vercel AI SDK that sanitizes tool results
 * @param {Object} config - Sanitization configuration
 * @returns {Object} Middleware object
 */
export function sanitizeMiddleware(config = {}) {
  const options = {
    mode: config.mode || 'sanitize',
    blockThreshold: config.blockThreshold || {
      secrets: 3,
      highSeverity: 1
    }
  };

  return {
    transformToolResult({ toolName, result }) {
      if (typeof result !== 'string') {
        result = JSON.stringify(result);
      }

      const sanitized = sanitize(result, options);

      if (sanitized.blocked) {
        return {
          error: `Tool result blocked: ${sanitized.reason}`,
          _blocked: true
        };
      }

      return sanitized.sanitized;
    }
  };
}

/**
 * Wrap a tool function to sanitize its output
 * @param {Function} tool - The tool function
 * @param {Object} config - Sanitization configuration
 * @returns {Function} Wrapped tool
 */
export function sanitizeTool(tool, config = {}) {
  const options = {
    mode: config.mode || 'sanitize',
    blockThreshold: config.blockThreshold || {
      secrets: 3,
      highSeverity: 1
    }
  };

  return async function wrappedTool(args) {
    const result = await tool(args);

    let textResult;
    if (typeof result === 'string') {
      textResult = result;
    } else if (result && typeof result === 'object') {
      textResult = result.content || result.text || JSON.stringify(result);
    } else {
      return result;
    }

    const sanitized = sanitize(textResult, options);

    if (sanitized.blocked) {
      throw new Error(`Tool result blocked: ${sanitized.reason}`);
    }

    if (typeof result === 'string') {
      return sanitized.sanitized;
    }

    return {
      ...result,
      content: sanitized.sanitized,
      _sanitized: true
    };
  };
}

/**
 * Create a stream transformer that sanitizes chunks
 * Note: This accumulates the stream and sanitizes at the end
 * @param {Object} config - Sanitization configuration
 * @returns {TransformStream} Transform stream
 */
export function createSanitizeStream(config = {}) {
  const options = {
    mode: config.mode || 'sanitize',
    blockThreshold: config.blockThreshold || {
      secrets: 3,
      highSeverity: 1
    }
  };

  let accumulated = '';

  return new TransformStream({
    transform(chunk, controller) {
      // Accumulate chunks
      if (typeof chunk === 'string') {
        accumulated += chunk;
      } else if (chunk.textDelta) {
        accumulated += chunk.textDelta;
      }
      // Don't forward yet - wait for flush
    },

    flush(controller) {
      // Sanitize accumulated content
      const result = sanitize(accumulated, options);

      if (result.blocked) {
        controller.enqueue(`[BLOCKED: ${result.reason}]`);
      } else {
        controller.enqueue(result.sanitized);
      }
    }
  });
}

/**
 * Sanitize a complete response object
 * @param {Object} response - The AI response object
 * @param {Object} config - Sanitization configuration
 * @returns {Object} Sanitized response
 */
export function sanitizeResponse(response, config = {}) {
  const options = {
    mode: config.mode || 'sanitize',
    blockThreshold: config.blockThreshold || {
      secrets: 3,
      highSeverity: 1
    }
  };

  const sanitized = { ...response };

  // Sanitize text content
  if (response.text) {
    const result = sanitize(response.text, options);
    if (result.blocked) {
      sanitized.text = `[BLOCKED: ${result.reason}]`;
      sanitized._blocked = true;
    } else {
      sanitized.text = result.sanitized;
      sanitized._sanitized = true;
    }
  }

  // Sanitize tool results
  if (response.toolResults) {
    sanitized.toolResults = response.toolResults.map(tr => {
      if (typeof tr.result === 'string') {
        const result = sanitize(tr.result, options);
        return {
          ...tr,
          result: result.blocked ? `[BLOCKED]` : result.sanitized
        };
      }
      return tr;
    });
  }

  return sanitized;
}

export default { sanitizeMiddleware, sanitizeTool, createSanitizeStream, sanitizeResponse };
