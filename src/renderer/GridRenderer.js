/**
 * Trinity - Grid Renderer
 * Renders game state as a pure data structure for programmatic testing
 */

import { Renderer } from './Renderer.js';
import { BOARD } from '../config.js';

/**
 * GridRenderer renders the game state as a simple data structure
 * Ideal for programmatic assertions in tests
 */
export class GridRenderer extends Renderer {
  constructor() {
    super();
    this._boardSize = BOARD.SIZE;
  }

  getName() {
    return 'grid';
  }

  requiresBrowser() {
    return false;
  }

  /**
   * Render the game state as a pure data structure
   * @param {import('../state/GameState.js').GameState} gameState
   * @param {Object} options
   * @returns {GridData}
   */
  render(gameState, options = {}) {
    return {
      size: this._boardSize,
      grid: this._buildGrid(gameState),
      landmarks: this._buildLandmarks(gameState),
      agents: this._buildAgents(gameState),
      meta: this._buildMeta(gameState),
    };
  }

  /**
   * Build 2D grid array
   * @private
   * @param {import('../state/GameState.js').GameState} gameState
   * @returns {Array<Array<CellData|null>>}
   */
  _buildGrid(gameState) {
    const grid = [];

    for (let y = 0; y < this._boardSize; y++) {
      const row = [];
      for (let x = 0; x < this._boardSize; x++) {
        row.push(this._buildCell(gameState, x, y));
      }
      grid.push(row);
    }

    return grid;
  }

  /**
   * Build cell data
   * @private
   * @param {import('../state/GameState.js').GameState} gameState
   * @param {number} x
   * @param {number} y
   * @returns {CellData|null}
   */
  _buildCell(gameState, x, y) {
    const tile = gameState.getTile(x, y);
    if (!tile) {
      return null;
    }

    return {
      type: this._normalizeType(tile.type),
      owner: tile.placedBy !== undefined ? tile.placedBy : tile.owner,
    };
  }

  /**
   * Normalize tile type to short form
   * @private
   */
  _normalizeType(type) {
    const typeMap = {
      housing: 'H',
      commerce: 'C',
      industry: 'I',
    };
    return typeMap[type] || type;
  }

  /**
   * Build landmarks array
   * @private
   * @param {import('../state/GameState.js').GameState} gameState
   * @returns {Array<LandmarkData>}
   */
  _buildLandmarks(gameState) {
    const landmarks = gameState.getLandmarks();
    return landmarks.map(l => ({
      x: l.x,
      y: l.y,
      owner: l.owner,
      isHQ: l.isHQ || false,
      tiles: l.tiles ? l.tiles.map(t => this._normalizeType(t.type)) : [],
    }));
  }

  /**
   * Build agents array
   * @private
   * @param {import('../state/GameState.js').GameState} gameState
   * @returns {Array<AgentData>}
   */
  _buildAgents(gameState) {
    return gameState.getAgents().map(a => ({
      x: a.x,
      y: a.y,
      owner: a.owner,
      count: a.count,
    }));
  }

  /**
   * Build meta information
   * @private
   * @param {import('../state/GameState.js').GameState} gameState
   * @returns {MetaData}
   */
  _buildMeta(gameState) {
    const turn = gameState.getTurn();
    const players = gameState.getPlayers();

    return {
      turn: turn.number,
      currentPlayer: gameState.getCurrentPlayer(),
      phase: gameState.getTurnPhase(),
      playerCount: players.length,
      players: players.map((p, i) => ({
        id: i,
        name: p.name,
        landmarks: p.landmarks,
        headquarters: p.headquarters,
        handSize: gameState.getPlayerHand(i).length,
        eventCount: gameState.getPlayerEvents(i).length,
      })),
    };
  }

  /**
   * Get cell at position from rendered grid
   * @param {GridData} gridData - Result from render()
   * @param {number} x
   * @param {number} y
   * @returns {CellData|null}
   */
  getCell(gridData, x, y) {
    if (y < 0 || y >= gridData.size || x < 0 || x >= gridData.size) {
      return null;
    }
    return gridData.grid[y][x];
  }

  /**
   * Get landmark at position from rendered grid
   * @param {GridData} gridData - Result from render()
   * @param {number} x
   * @param {number} y
   * @returns {LandmarkData|null}
   */
  getLandmark(gridData, x, y) {
    return gridData.landmarks.find(l => l.x === x && l.y === y) || null;
  }

  /**
   * Get agents at position from rendered grid
   * @param {GridData} gridData - Result from render()
   * @param {number} x
   * @param {number} y
   * @returns {Array<AgentData>}
   */
  getAgentsAt(gridData, x, y) {
    return gridData.agents.filter(a => a.x === x && a.y === y);
  }

  /**
   * Count tiles owned by a player
   * @param {GridData} gridData
   * @param {number} owner
   * @returns {number}
   */
  countTilesByOwner(gridData, owner) {
    let count = 0;
    for (const row of gridData.grid) {
      for (const cell of row) {
        if (cell && cell.owner === owner) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Count landmarks owned by a player
   * @param {GridData} gridData
   * @param {number} owner
   * @returns {number}
   */
  countLandmarksByOwner(gridData, owner) {
    return gridData.landmarks.filter(l => l.owner === owner).length;
  }

  /**
   * Count HQs owned by a player
   * @param {GridData} gridData
   * @param {number} owner
   * @returns {number}
   */
  countHQsByOwner(gridData, owner) {
    return gridData.landmarks.filter(l => l.owner === owner && l.isHQ).length;
  }

  /**
   * Count agents owned by a player
   * @param {GridData} gridData
   * @param {number} owner
   * @returns {number}
   */
  countAgentsByOwner(gridData, owner) {
    return gridData.agents
      .filter(a => a.owner === owner)
      .reduce((sum, a) => sum + a.count, 0);
  }
}

/**
 * @typedef {Object} CellData
 * @property {string} type - Tile type (H, C, I)
 * @property {number} owner - Player index who owns the tile
 */

/**
 * @typedef {Object} LandmarkData
 * @property {number} x
 * @property {number} y
 * @property {number} owner
 * @property {boolean} isHQ
 * @property {string[]} tiles - Tile types in the landmark
 */

/**
 * @typedef {Object} AgentData
 * @property {number} x
 * @property {number} y
 * @property {number} owner
 * @property {number} count
 */

/**
 * @typedef {Object} PlayerMeta
 * @property {number} id
 * @property {string} name
 * @property {number} landmarks
 * @property {number} headquarters
 * @property {number} handSize
 * @property {number} eventCount
 */

/**
 * @typedef {Object} MetaData
 * @property {number} turn
 * @property {number} currentPlayer
 * @property {string} phase
 * @property {number} playerCount
 * @property {PlayerMeta[]} players
 */

/**
 * @typedef {Object} GridData
 * @property {number} size
 * @property {Array<Array<CellData|null>>} grid
 * @property {LandmarkData[]} landmarks
 * @property {AgentData[]} agents
 * @property {MetaData} meta
 */
