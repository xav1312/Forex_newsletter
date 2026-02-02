/**
 * Source Manager
 * Handles loading and retrieving source adapters
 */

const ADAPTERS = {
  'ing': require('./adapters/ing'),
  'investing': require('./adapters/investing'),
};

/**
 * Get a source adapter by ID
 * @param {string} sourceId - The ID of the source (e.g., 'ing')
 * @returns {object} The adapter module
 */
function getSource(sourceId = 'ing') {
  const adapter = ADAPTERS[sourceId];
  
  if (!adapter) {
    throw new Error(`Source adapter '${sourceId}' not found. Available: ${Object.keys(ADAPTERS).join(', ')}`);
  }
  
  return adapter;
}

/**
 * List available sources
 * @returns {Array<{id: string, name: string}>}
 */
function listSources() {
  return Object.values(ADAPTERS).map(a => ({
    id: a.id,
    name: a.name
  }));
}

module.exports = {
  getSource,
  listSources
};
