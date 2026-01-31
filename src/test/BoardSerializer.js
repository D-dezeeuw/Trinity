/**
 * Trinity - Board Serializer
 * Utilities for converting between GameState and ASCII/Grid representations
 * Used for testing and debugging
 */

import { GameState } from '../state/GameState.js';
import { TileType, TileProperties } from '../game/TileTypes.js';
import { BOARD } from '../config.js';

/**
 * Symbol mappings for ASCII representation
 */
const Symbols = {
  EMPTY: '.',
  LANDMARK: 'L',
  HQ: 'Q',
  AGENT_PREFIX: '@',
};

/**
 * Tile type short names
 */
const TypeShortNames = {
  [TileType.HOUSING]: 'H',
  [TileType.COMMERCE]: 'C',
  [TileType.INDUSTRY]: 'I',
};

/**
 * Reverse mapping from short name to type
 */
const ShortNameToType = {
  H: TileType.HOUSING,
  C: TileType.COMMERCE,
  I: TileType.INDUSTRY,
};

/**
 * Convert GameState to a simple grid data structure
 * @param {GameState} gameState
 * @returns {GridData}
 */
export function toGrid(gameState) {
  const size = BOARD.SIZE;
  const grid = [];

  // Build 2D grid
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      const tile = gameState.getTile(x, y);
      if (tile) {
        row.push({
          type: TypeShortNames[tile.type] || tile.type,
          owner: tile.placedBy !== undefined ? tile.placedBy : tile.owner,
        });
      } else {
        row.push(null);
      }
    }
    grid.push(row);
  }

  // Build landmarks
  const landmarks = gameState.getLandmarks().map(l => ({
    x: l.x,
    y: l.y,
    owner: l.owner,
    isHQ: l.isHQ || false,
  }));

  // Build agents
  const agents = gameState.getAgents().map(a => ({
    x: a.x,
    y: a.y,
    owner: a.owner,
    count: a.count,
  }));

  // Build meta
  const turn = gameState.getTurn();
  const players = gameState.getPlayers();
  const meta = {
    turn: turn.number,
    currentPlayer: gameState.getCurrentPlayer(),
    phase: gameState.getTurnPhase(),
    playerCount: players.length,
  };

  return { size, grid, landmarks, agents, meta };
}

/**
 * Convert GameState to ASCII string representation
 * @param {GameState} gameState
 * @param {Object} options
 * @param {boolean} options.includeHeader - Include turn/player info
 * @param {boolean} options.includeFooter - Include landmarks/hands summary
 * @param {boolean} options.compact - Minimal format
 * @returns {string}
 */
export function toAscii(gameState, options = {}) {
  const {
    includeHeader = false,
    includeFooter = false,
    compact = true,
  } = options;

  const size = BOARD.SIZE;
  const lines = [];

  // Header
  if (includeHeader) {
    const turn = gameState.getTurn();
    const currentPlayer = gameState.getCurrentPlayer();
    const phase = gameState.getTurnPhase();
    lines.push(`Turn ${turn.number} | P${currentPlayer + 1} | ${phase.toUpperCase()}`);
  }

  // Grid
  for (let y = 0; y < size; y++) {
    const cells = [];
    for (let x = 0; x < size; x++) {
      cells.push(renderCell(gameState, x, y));
    }
    lines.push(cells.join(' '));
  }

  // Footer
  if (includeFooter) {
    const landmarks = gameState.getLandmarks();
    if (landmarks.length > 0) {
      const lmStr = landmarks.map((l, i) =>
        `L${i}(${l.x},${l.y})P${l.owner + 1}${l.isHQ ? '*' : ''}`
      ).join(' ');
      lines.push('Landmarks: ' + lmStr);
    }
  }

  return lines.join('\n');
}

/**
 * Render a single cell to ASCII
 * @private
 */
function renderCell(gameState, x, y) {
  // Check for landmark
  const landmark = gameState.getLandmarkAt(x, y);
  if (landmark) {
    return landmark.isHQ ? Symbols.HQ : Symbols.LANDMARK;
  }

  // Check for agents
  const agents = gameState.getAgentsAt(x, y);
  if (agents.length > 0) {
    const primaryOwner = agents[0].owner;
    return `${Symbols.AGENT_PREFIX}${primaryOwner + 1}`;
  }

  // Check for tile
  const tile = gameState.getTile(x, y);
  if (tile) {
    const shortName = TypeShortNames[tile.type] || '?';
    const owner = tile.placedBy !== undefined ? tile.placedBy : tile.owner;

    if (owner === 0) {
      return shortName.toUpperCase();
    } else if (owner === 1) {
      return shortName.toLowerCase();
    } else {
      return shortName.toUpperCase() + (owner + 1);
    }
  }

  return Symbols.EMPTY;
}

/**
 * Parse ASCII string to create a GameState
 * @param {string} ascii - ASCII grid representation
 * @param {Object} options
 * @param {number} options.playerCount - Number of players (default 2)
 * @param {number} options.currentPlayer - Current player index (default 0)
 * @returns {GameState}
 */
export function fromAscii(ascii, options = {}) {
  const {
    playerCount = 2,
    currentPlayer = 0,
  } = options;

  const gameState = new GameState(playerCount);
  gameState.setPhase('playing');
  gameState.setCurrentPlayer(currentPlayer);
  gameState.setTurnNumber(1);

  // Parse ASCII grid
  const lines = ascii.trim().split('\n').map(line => line.trim()).filter(line => line.length > 0);

  for (let y = 0; y < lines.length && y < BOARD.SIZE; y++) {
    const cells = lines[y].split(/\s+/);

    for (let x = 0; x < cells.length && x < BOARD.SIZE; x++) {
      const cell = cells[x];
      parseCell(gameState, x, y, cell);
    }
  }

  return gameState;
}

/**
 * Parse a single cell and update game state
 * @private
 */
function parseCell(gameState, x, y, cell) {
  if (!cell || cell === Symbols.EMPTY) {
    return;
  }

  // Landmark
  if (cell === Symbols.LANDMARK || cell === Symbols.HQ) {
    // Can't create landmarks without tiles - skip
    // In real usage, landmarks would be created via formLandmark()
    return;
  }

  // Agent (@1, @2, etc.)
  if (cell.startsWith(Symbols.AGENT_PREFIX)) {
    const ownerStr = cell.slice(1);
    const owner = parseInt(ownerStr, 10) - 1;
    if (!isNaN(owner) && owner >= 0) {
      try {
        gameState.placeAgent(x, y, owner);
      } catch {
        // Ignore if can't place (e.g., max agents reached)
      }
    }
    return;
  }

  // Tile (H, C, I, h, c, i, H3, C4, etc.)
  const typeChar = cell.charAt(0).toUpperCase();
  const type = ShortNameToType[typeChar];

  if (type) {
    // Determine owner from case or trailing number
    let owner = 0;
    if (cell.length > 1) {
      const ownerNum = parseInt(cell.slice(1), 10);
      if (!isNaN(ownerNum)) {
        owner = ownerNum - 1;
      }
    } else if (cell.charAt(0) === cell.charAt(0).toLowerCase()) {
      owner = 1;
    }

    try {
      // Temporarily set current player to owner for placement
      const savedPlayer = gameState.getCurrentPlayer();
      gameState.setCurrentPlayer(owner);
      gameState.placeTile(x, y, { type, owner });
      gameState.setCurrentPlayer(savedPlayer);
    } catch {
      // Ignore placement errors
    }
  }
}

/**
 * Compare two grids for equality
 * @param {GridData} a
 * @param {GridData} b
 * @returns {boolean}
 */
export function gridsEqual(a, b) {
  if (a.size !== b.size) return false;

  for (let y = 0; y < a.size; y++) {
    for (let x = 0; x < a.size; x++) {
      const cellA = a.grid[y][x];
      const cellB = b.grid[y][x];

      if (cellA === null && cellB === null) continue;
      if (cellA === null || cellB === null) return false;
      if (cellA.type !== cellB.type || cellA.owner !== cellB.owner) return false;
    }
  }

  return true;
}

/**
 * Compare two ASCII representations (ignoring whitespace differences)
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function asciiEqual(a, b) {
  const normalize = (s) => s.trim().split('\n').map(line => line.trim()).join('\n');
  return normalize(a) === normalize(b);
}

/**
 * Get a diff between two grids (for debugging)
 * @param {GridData} a
 * @param {GridData} b
 * @returns {Array<{x: number, y: number, expected: Object, actual: Object}>}
 */
export function gridDiff(a, b) {
  const diffs = [];
  const size = Math.max(a.size, b.size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cellA = a.grid[y]?.[x] || null;
      const cellB = b.grid[y]?.[x] || null;

      if (cellA === null && cellB === null) continue;
      if (cellA === null || cellB === null || cellA.type !== cellB.type || cellA.owner !== cellB.owner) {
        diffs.push({ x, y, expected: cellA, actual: cellB });
      }
    }
  }

  return diffs;
}

/**
 * @typedef {Object} CellData
 * @property {string} type - Tile type (H, C, I)
 * @property {number} owner - Player index
 */

/**
 * @typedef {Object} LandmarkData
 * @property {number} x
 * @property {number} y
 * @property {number} owner
 * @property {boolean} isHQ
 */

/**
 * @typedef {Object} AgentData
 * @property {number} x
 * @property {number} y
 * @property {number} owner
 * @property {number} count
 */

/**
 * @typedef {Object} MetaData
 * @property {number} turn
 * @property {number} currentPlayer
 * @property {string} phase
 * @property {number} playerCount
 */

/**
 * @typedef {Object} GridData
 * @property {number} size
 * @property {Array<Array<CellData|null>>} grid
 * @property {LandmarkData[]} landmarks
 * @property {AgentData[]} agents
 * @property {MetaData} meta
 */
