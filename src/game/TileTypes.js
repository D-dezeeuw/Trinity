/**
 * Trinity - Tile Type Definitions
 * The three fundamental development types that form the Trinity
 */

/**
 * Tile types in the game
 * @readonly
 * @enum {string}
 */
export const TileType = Object.freeze({
  HOUSING: 'housing',
  COMMERCE: 'commerce',
  INDUSTRY: 'industry',
});

/**
 * All tile types as an array (for iteration)
 */
export const ALL_TILE_TYPES = Object.freeze([
  TileType.HOUSING,
  TileType.COMMERCE,
  TileType.INDUSTRY,
]);

/**
 * Tile display properties
 */
export const TileProperties = Object.freeze({
  [TileType.HOUSING]: {
    name: 'Housing',
    shortName: 'H',
    color: '#4CAF50',       // Green
    colorLight: '#81C784',
    colorDark: '#388E3C',
    description: 'Residential buildings that house the city\'s population',
  },
  [TileType.COMMERCE]: {
    name: 'Commerce',
    shortName: 'C',
    color: '#2196F3',       // Blue
    colorLight: '#64B5F6',
    colorDark: '#1976D2',
    description: 'Shops and businesses that drive the economy',
  },
  [TileType.INDUSTRY]: {
    name: 'Industry',
    shortName: 'I',
    color: '#FF9800',       // Orange
    colorLight: '#FFB74D',
    colorDark: '#F57C00',
    description: 'Factories and production facilities',
  },
});

/**
 * Create a new tile object
 * @param {string} type - TileType value
 * @param {number} owner - Player index who owns this tile
 * @returns {Object} Tile object
 */
export function createTile(type, owner) {
  if (!ALL_TILE_TYPES.includes(type)) {
    throw new Error(`Invalid tile type: ${type}`);
  }
  return {
    type,
    owner,
    isLandmark: false,
    isHeadquarters: false,
    agents: 0,
  };
}

/**
 * Get display properties for a tile type
 * @param {string} type - TileType value
 * @returns {Object} Display properties
 */
export function getTileProperties(type) {
  return TileProperties[type] || null;
}

/**
 * Check if a set of tile types forms a valid Trinity (Landmark)
 * @param {string[]} types - Array of tile types
 * @returns {boolean} True if the types form a complete Trinity
 */
export function isTrinity(types) {
  if (types.length !== 3) return false;

  const typeSet = new Set(types);
  return typeSet.has(TileType.HOUSING) &&
         typeSet.has(TileType.COMMERCE) &&
         typeSet.has(TileType.INDUSTRY);
}
