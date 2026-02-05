/**
 * LlamaIndex Integration Plugin
 * Sanitizes query results and retrieved nodes to prevent secrets from reaching agent memory
 */

import sanitize from '../src/index.js';

/**
 * Create a response synthesizer wrapper that sanitizes outputs
 * @param {Object} synthesizer - The response synthesizer to wrap
 * @param {Object} config - Sanitization configuration
 * @returns {Object} Wrapped response synthesizer
 */
export function createSanitizeTransform(synthesizer, config = {}) {
  const options = {
    mode: config.mode || 'sanitize',
    blockThreshold: config.blockThreshold || {
      secrets: 3,
      highSeverity: 1
    }
  };

  return {
    ...synthesizer,

    async synthesize(query, nodes, additionalSources) {
      // Sanitize nodes before synthesis
      const sanitizedNodes = nodes.map(node => {
        const text = node.getText ? node.getText() : node.text || '';
        const result = sanitize(text, options);

        if (result.blocked) {
          return {
            ...node,
            text: `[BLOCKED: ${result.reason}]`,
            metadata: { ...node.metadata, _blocked: true }
          };
        }

        return {
          ...node,
          text: result.sanitized,
          metadata: { ...node.metadata, _sanitized: true }
        };
      });

      // Call original synthesizer with sanitized nodes
      const response = await synthesizer.synthesize(query, sanitizedNodes, additionalSources);

      // Also sanitize the final response
      if (response && response.response) {
        const result = sanitize(response.response, options);
        if (result.blocked) {
          return {
            ...response,
            response: `[BLOCKED: ${result.reason}]`,
            metadata: { ...response.metadata, _blocked: true }
          };
        }
        return {
          ...response,
          response: result.sanitized,
          metadata: { ...response.metadata, _sanitized: true }
        };
      }

      return response;
    }
  };
}

/**
 * Create a node postprocessor that sanitizes retrieved nodes
 * @param {Object} config - Sanitization configuration
 * @returns {Object} Node postprocessor
 */
export function createSanitizePostprocessor(config = {}) {
  const options = {
    mode: config.mode || 'sanitize',
    blockThreshold: config.blockThreshold || {
      secrets: 3,
      highSeverity: 1
    }
  };

  return {
    async postprocessNodes(nodes, queryBundle) {
      return nodes.map(node => {
        const text = node.node.getText ? node.node.getText() : node.node.text || '';
        const result = sanitize(text, options);

        if (result.blocked) {
          return {
            ...node,
            node: {
              ...node.node,
              text: `[BLOCKED: ${result.reason}]`,
              metadata: { ...node.node.metadata, _blocked: true }
            }
          };
        }

        return {
          ...node,
          node: {
            ...node.node,
            text: result.sanitized,
            metadata: { ...node.node.metadata, _sanitized: true }
          }
        };
      });
    }
  };
}

/**
 * Create a tool output handler for LlamaIndex agents
 * @param {Object} config - Sanitization configuration
 * @returns {Function} Tool output handler
 */
export function createToolOutputHandler(config = {}) {
  const options = {
    mode: config.mode || 'sanitize',
    blockThreshold: config.blockThreshold || {
      secrets: 3,
      highSeverity: 1
    }
  };

  return function handleToolOutput(output) {
    if (typeof output !== 'string') {
      output = JSON.stringify(output);
    }

    const result = sanitize(output, options);

    if (result.blocked) {
      throw new Error(`Tool output blocked: ${result.reason}`);
    }

    return result.sanitized;
  };
}

export default { createSanitizeTransform, createSanitizePostprocessor, createToolOutputHandler };
