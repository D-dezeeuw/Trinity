/**
 * Trinity - Text Renderer
 * Renders game state as ASCII text grid for testing and debugging
 */

import { Renderer } from './Renderer.js';
import { TileType, TileProperties } from '../game/TileTypes.js';
import { BOARD } from '../config.js';

/**
 * Encoding symbols for the text representation
 */
const Symbols = {
  EMPTY: '.',
  LANDMARK: 'L',
  HQ: 'Q',
  AGENT_PREFIX: '@',
};

/**
 * Get short name for tile type
 * @param {string} type - TileType value
 * @returns {string} Single character representation
 */
function getTileShortName(type) {
  const props = TileProperties[type];
  return props ? props.shortName : '?';
}

/**
 * TextRenderer renders the game state as an ASCII grid
 * Useful for testing, debugging, and headless environments
 */
export class TextRenderer extends Renderer {
  constructor() {
    super();
    this._boardSize = BOARD.SIZE;
  }

  getName() {
    return 'text';
  }

  requiresBrowser() {
    return false;
  }

  /**
   * Render the game state as ASCII text
   * @param {import('../state/GameState.js').GameState} gameState
   * @param {Object} options
   * @param {boolean} options.includeHeader - Include turn/player info header
   * @param {boolean} options.includeFooter - Include landmarks/hands summary
   * @param {boolean} options.compact - Use compact format (no row numbers)
   * @returns {string} ASCII representation of the board
   */
  render(gameState, options = {}) {
    const {
      includeHeader = true,
      includeFooter = true,
      compact = false,
    } = options;

    const lines = [];

    // Header
    if (includeHeader) {
      lines.push(this._renderHeader(gameState));
    }

    // Column headers
    lines.push(this._renderColumnHeaders(compact));

    // Board rows
    for (let y = 0; y < this._boardSize; y++) {
      lines.push(this._renderRow(gameState, y, compact));
    }

    // Footer
    if (includeFooter) {
      lines.push('');
      lines.push(this._renderLandmarksSummary(gameState));
      lines.push(this._renderHandsSummary(gameState));
    }

    return lines.join('\n');
  }

  /**
   * Render header line with turn info
   * @private
   */
  _renderHeader(gameState) {
    const turn = gameState.getTurn();
    const currentPlayer = gameState.getCurrentPlayer();
    const phase = gameState.getTurnPhase();
    return `Turn ${turn.number} | P${currentPlayer + 1} | ${phase.toUpperCase()}`;
  }

  /**
   * Render column headers
   * @private
   */
  _renderColumnHeaders(compact) {
    const cols = [];
    for (let x = 0; x < this._boardSize; x++) {
      cols.push(x.toString());
    }
    const prefix = compact ? '' : '  ';
    return prefix + cols.join(' ');
  }

  /**
   * Render a single row of the board
   * @private
   */
  _renderRow(gameState, y, compact) {
    const cells = [];

    for (let x = 0; x < this._boardSize; x++) {
      cells.push(this._renderCell(gameState, x, y));
    }

    const prefix = compact ? '' : `${y} `;
    return prefix + cells.join(' ');
  }

  /**
   * Render a single cell
   * @private
   */
  _renderCell(gameState, x, y) {
    // Check for landmark at this position
    const landmark = gameState.getLandmarkAt(x, y);
    if (landmark) {
      return landmark.isHQ ? Symbols.HQ : Symbols.LANDMARK;
    }

    // Check for agents (show agent if present, regardless of tile)
    const agents = gameState.getAgentsAt(x, y);
    if (agents.length > 0) {
      // Show primary agent owner
      const ownerCounts = {};
      for (const agent of agents) {
        ownerCounts[agent.owner] = (ownerCounts[agent.owner] || 0) + 1;
      }
      // Get the first owner (or the one with most agents)
      const primaryOwner = Object.keys(ownerCounts)
        .reduce((a, b) => ownerCounts[a] > ownerCounts[b] ? a : b);
      const count = agents.length;
      // Format: @1 for single agent, @1x2 for stacked
      if (count > 1) {
        return `${Symbols.AGENT_PREFIX}${parseInt(primaryOwner) + 1}`;
      }
      return `${Symbols.AGENT_PREFIX}${parseInt(primaryOwner) + 1}`;
    }

    // Check for tile
    const tile = gameState.getTile(x, y);
    if (tile) {
      const shortName = getTileShortName(tile.type);
      const owner = tile.placedBy !== undefined ? tile.placedBy : tile.owner;

      // Player 0 = uppercase, Player 1 = lowercase
      // For 3+ players, append number
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
   * Render landmarks summary
   * @private
   */
  _renderLandmarksSummary(gameState) {
    const landmarks = gameState.getLandmarks();
    if (landmarks.length === 0) {
      return 'Landmarks: none';
    }

    const parts = landmarks.map((l, i) => {
      const hqMarker = l.isHQ ? '*' : '';
      return `L${i}(${l.x},${l.y})P${l.owner + 1}${hqMarker}`;
    });

    return 'Landmarks: ' + parts.join(' ');
  }

  /**
   * Render player hands summary
   * @private
   */
  _renderHandsSummary(gameState) {
    const players = gameState.getPlayers();
    const parts = players.map((p, i) => {
      const hand = gameState.getPlayerHand(i);
      const tiles = hand.map(t => getTileShortName(t.type)).join(',');
      return `P${i + 1}[${tiles}]`;
    });

    return 'Hands: ' + parts.join(' ');
  }

  /**
   * Render just the grid portion (no header/footer)
   * Useful for compact test assertions
   * @param {import('../state/GameState.js').GameState} gameState
   * @returns {string}
   */
  renderGrid(gameState) {
    return this.render(gameState, {
      includeHeader: false,
      includeFooter: false,
      compact: true,
    });
  }

  /**
   * Render a minimal representation suitable for inline test assertions
   * @param {import('../state/GameState.js').GameState} gameState
   * @returns {string}
   */
  renderCompact(gameState) {
    const lines = [];
    for (let y = 0; y < this._boardSize; y++) {
      const cells = [];
      for (let x = 0; x < this._boardSize; x++) {
        cells.push(this._renderCell(gameState, x, y));
      }
      lines.push(cells.join(' '));
    }
    return lines.join('\n');
  }
}
