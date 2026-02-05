/**
 * LangChain Integration Plugin
 * Sanitizes tool outputs and chain results to prevent secrets from reaching agent memory
 */

import sanitize from '../src/index.js';

/**
 * Create a LangChain callback handler that sanitizes outputs
 * @param {Object} config - Sanitization configuration
 * @param {string} [config.mode='sanitize'] - 'block' or 'sanitize'
 * @param {Object} [config.blockThreshold] - Block thresholds
 * @returns {Object} LangChain callback handler
 */
export function createSanitizeCallback(config = {}) {
  const options = {
    mode: config.mode || 'sanitize',
    blockThreshold: config.blockThreshold || {
      secrets: 3,
      highSeverity: 1
    }
  };

  return {
    name: 'xswarm-ai-sanitize',

    /**
     * Called when a tool finishes execution
     */
    handleToolEnd(output, runId) {
      if (typeof output !== 'string') {
        output = JSON.stringify(output);
      }

      const result = sanitize(output, options);

      if (result.blocked) {
        throw new Error(`Tool output blocked: ${result.reason}`);
      }

      return result.sanitized;
    },

    /**
     * Called when a chain finishes execution
     */
    handleChainEnd(outputs, runId) {
      const sanitized = {};

      for (const [key, value] of Object.entries(outputs)) {
        if (typeof value === 'string') {
          const result = sanitize(value, options);
          if (result.blocked) {
            throw new Error(`Chain output blocked: ${result.reason}`);
          }
          sanitized[key] = result.sanitized;
        } else {
          sanitized[key] = value;
        }
      }

      return sanitized;
    },

    /**
     * Called when an LLM finishes generation
     */
    handleLLMEnd(output, runId) {
      // LLM outputs typically don't contain secrets, but we can optionally check
      return output;
    }
  };
}

/**
 * Create a tool wrapper that sanitizes tool outputs
 * @param {Function} tool - The tool function to wrap
 * @param {Object} config - Sanitization configuration
 * @returns {Function} Wrapped tool function
 */
export function wrapTool(tool, config = {}) {
  const options = {
    mode: config.mode || 'sanitize',
    blockThreshold: config.blockThreshold || {
      secrets: 3,
      highSeverity: 1
    }
  };

  return async function sanitizedTool(...args) {
    const output = await tool(...args);

    let textOutput;
    if (typeof output === 'string') {
      textOutput = output;
    } else if (output && typeof output === 'object') {
      textOutput = output.content || output.text || JSON.stringify(output);
    } else {
      return output;
    }

    const result = sanitize(textOutput, options);

    if (result.blocked) {
      throw new Error(`Tool output blocked: ${result.reason}`);
    }

    if (typeof output === 'string') {
      return result.sanitized;
    } else {
      return {
        ...output,
        content: result.sanitized,
        _sanitized: true,
        _threats: result.threats
      };
    }
  };
}

/**
 * Create a retriever wrapper that sanitizes retrieved documents
 * @param {Object} retriever - The retriever to wrap
 * @param {Object} config - Sanitization configuration
 * @returns {Object} Wrapped retriever
 */
export function wrapRetriever(retriever, config = {}) {
  const options = {
    mode: config.mode || 'sanitize',
    blockThreshold: config.blockThreshold || {
      secrets: 3,
      highSeverity: 1
    }
  };

  return {
    ...retriever,

    async getRelevantDocuments(query) {
      const docs = await retriever.getRelevantDocuments(query);

      return docs.map(doc => {
        const result = sanitize(doc.pageContent, options);

        if (result.blocked) {
          return {
            ...doc,
            pageContent: `[BLOCKED: ${result.reason}]`,
            metadata: { ...doc.metadata, _blocked: true }
          };
        }

        return {
          ...doc,
          pageContent: result.sanitized,
          metadata: { ...doc.metadata, _sanitized: true }
        };
      });
    }
  };
}

export default { createSanitizeCallback, wrapTool, wrapRetriever };
