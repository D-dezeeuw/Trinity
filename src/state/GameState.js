/**
 * Trinity - Game State Management
 * Centralized state store with observable pattern
 */

import { GameRules, isSimpleTurnMode } from '../game/GameRules.js';
import { BOARD } from '../config.js';

/**
 * Game phases
 * @readonly
 * @enum {string}
 */
export const GamePhase = Object.freeze({
  SETUP: 'setup',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'gameover',
});

/**
 * Turn phases within a player's turn
 * @readonly
 * @enum {string}
 */
export const TurnPhase = Object.freeze({
  // Classic mode phases
  DRAW: 'draw',
  DEVELOP: 'develop',
  AGENT: 'agent',
  END: 'end',
  // Simple mode phase
  PLACE: 'place',
});

/**
 * State change event types
 * @readonly
 * @enum {string}
 */
export const StateEvent = Object.freeze({
  PHASE_CHANGE: 'phase-change',
  PLAYER_CHANGE: 'player-change',
  TILE_PLACED: 'tile-placed',
  TILE_REMOVED: 'tile-removed',
  TURN_START: 'turn-start',
  TURN_END: 'turn-end',
  LANDMARK_CREATED: 'landmark-created',
  LANDMARK_REMOVED: 'landmark-removed',
  HQ_CREATED: 'hq-created',
  AGENT_PLACED: 'agent-placed',
  AGENT_MOVED: 'agent-moved',
  AGENT_REMOVED: 'agent-removed',
  LANDMARK_CAPTURED: 'landmark-captured',
  EVENT_DRAWN: 'event-drawn',
  EVENT_PLAYED: 'event-played',
  UI_HOVER: 'ui-hover',
  UI_SELECT: 'ui-select',
  GAME_OVER: 'game-over',
  // Starting player determination animation events
  STARTING_PLAYER_DRAW_START: 'starting-player-draw-start',
  STARTING_PLAYER_TILE_DRAWN: 'starting-player-tile-drawn',
  STARTING_PLAYER_REVEAL: 'starting-player-reveal',
  STARTING_PLAYER_COMPARE: 'starting-player-compare',
  STARTING_PLAYER_TIE: 'starting-player-tie',
  STARTING_PLAYER_DETERMINED: 'starting-player-determined',
});

/**
 * Creates the initial game state
 * @param {number} playerCount
 * @returns {Object}
 */
function createInitialState(playerCount = 2) {
  return {
    // Game phase
    phase: GamePhase.SETUP,

    // Players (indexed 0 to playerCount-1)
    currentPlayer: 0,
    playerCount,
    players: Array.from({ length: playerCount }, (_, i) => ({
      id: i,
      name: `Player ${i + 1}`,
      score: 0,
      hand: [], // Tiles in hand
      events: [], // Event cards in hand
      landmarks: 0,
      headquarters: 0,
      skipNextAgentPhase: false,
      skipNextDevelopPhase: false,
    })),

    // Board state - Map key is "x,y" string
    board: {
      tiles: new Map(),
      landmarks: [], // Array of landmark objects
      agents: new Map(), // Map key is "x,y", value is { owner: playerIndex }
    },

    // Draw pile (D. Stack) - tiles to draw from
    drawPile: [],

    // Event pile (E. Stack) - event cards to draw from
    eventPile: [],

    // Turn tracking
    turn: {
      number: 0,
      phase: TurnPhase.DRAW,
      tilesPlacedThisTurn: 0,
    },

    // UI state (ephemeral, not saved)
    ui: {
      hoveredTile: { x: -1, y: -1 },
      selectedHandTile: null,
      selectedBoardTile: null,
    },
  };
}

export class GameState {
  constructor(playerCount = 2) {
    this._state = createInitialState(playerCount);
    this._subscribers = new Map();
    this._history = []; // For undo support
    this._maxHistorySize = 10; // Max undo steps
  }

  // ===========================================================================
  // UNDO SYSTEM
  // ===========================================================================

  /**
   * Save current state to history for undo
   * Call this before making changes that should be undoable
   */
  saveStateForUndo() {
    // Deep clone the current state (excluding UI state)
    const snapshot = this._createSnapshot();
    this._history.push(snapshot);

    // Limit history size
    if (this._history.length > this._maxHistorySize) {
      this._history.shift();
    }
  }

  /**
   * Create a deep clone snapshot of the current state
   * @private
   */
  _createSnapshot() {
    const state = this._state;
    return {
      phase: state.phase,
      currentPlayer: state.currentPlayer,
      playerCount: state.playerCount,
      players: state.players.map(p => ({
        ...p,
        hand: [...p.hand.map(t => ({ ...t }))],
        events: [...p.events.map(e => ({ ...e }))],
      })),
      board: {
        tiles: new Map(Array.from(state.board.tiles.entries()).map(([k, v]) => [k, { ...v }])),
        landmarks: state.board.landmarks.map(l => ({ ...l, tiles: l.tiles?.map(t => ({ ...t })) })),
        agents: new Map(Array.from(state.board.agents.entries()).map(([k, v]) => [k, { ...v }])),
      },
      drawPile: [...state.drawPile.map(t => ({ ...t }))],
      eventPile: [...state.eventPile.map(e => ({ ...e }))],
      turn: { ...state.turn },
    };
  }

  /**
   * Restore state from a snapshot
   * @private
   */
  _restoreSnapshot(snapshot) {
    this._state.phase = snapshot.phase;
    this._state.currentPlayer = snapshot.currentPlayer;
    this._state.playerCount = snapshot.playerCount;
    this._state.players = snapshot.players;
    this._state.board.tiles = snapshot.board.tiles;
    this._state.board.landmarks = snapshot.board.landmarks;
    this._state.board.agents = snapshot.board.agents;
    this._state.drawPile = snapshot.drawPile;
    this._state.eventPile = snapshot.eventPile;
    this._state.turn = snapshot.turn;
  }

  /**
   * Undo the last action
   * @returns {boolean} True if undo was performed, false if no history
   */
  undo() {
    if (this._history.length === 0) {
      return false;
    }

    const snapshot = this._history.pop();
    this._restoreSnapshot(snapshot);
    return true;
  }

  /**
   * Check if undo is available
   * @returns {boolean}
   */
  canUndo() {
    return this._history.length > 0;
  }

  /**
   * Clear undo history (e.g., at end of turn)
   */
  clearUndoHistory() {
    this._history = [];
  }

  // ===========================================================================
  // VALIDATION HELPERS
  // ===========================================================================

  /**
   * Validate player index is within bounds
   * @private
   * @param {number} playerIndex
   * @throws {Error} If player index is invalid
   */
  _validatePlayerIndex(playerIndex) {
    if (typeof playerIndex !== 'number' || !Number.isInteger(playerIndex)) {
      throw new Error(`Invalid player index: must be an integer`);
    }
    if (playerIndex < 0 || playerIndex >= this._state.playerCount) {
      throw new Error(`Invalid player index: ${playerIndex} (valid: 0-${this._state.playerCount - 1})`);
    }
  }

  /**
   * Validate board position is within bounds
   * @private
   * @param {number} x
   * @param {number} y
   * @throws {Error} If position is out of bounds
   */
  _validateBoardPosition(x, y) {
    if (typeof x !== 'number' || typeof y !== 'number') {
      throw new Error(`Invalid board position: x and y must be numbers`);
    }
    if (x < 0 || x >= BOARD.SIZE || y < 0 || y >= BOARD.SIZE) {
      throw new Error(`Board position (${x}, ${y}) is out of bounds (0-${BOARD.SIZE - 1})`);
    }
  }

  /**
   * Validate tile object has required properties
   * @private
   * @param {Object} tile
   * @throws {Error} If tile is invalid
   */
  _validateTile(tile) {
    if (!tile || typeof tile !== 'object') {
      throw new Error(`Invalid tile: must be an object`);
    }
    if (!tile.type) {
      throw new Error(`Invalid tile: missing required 'type' property`);
    }
  }

  // ===========================================================================
  // READ ACCESS
  // ===========================================================================

  /**
   * Get current game phase
   * @returns {string}
   */
  getPhase() {
    return this._state.phase;
  }

  /**
   * Get current player index
   * @returns {number}
   */
  getCurrentPlayer() {
    return this._state.currentPlayer;
  }

  /**
   * Get player data
   * @param {number} index
   * @returns {Object}
   */
  getPlayer(index) {
    return { ...this._state.players[index] };
  }

  /**
   * Get all players
   * @returns {Object[]}
   */
  getPlayers() {
    return this._state.players.map(p => ({ ...p }));
  }

  /**
   * Get tile at board position
   * @param {number} x
   * @param {number} y
   * @returns {Object|null}
   */
  getTile(x, y) {
    const tile = this._state.board.tiles.get(`${x},${y}`);
    return tile ? { ...tile } : null;
  }

  /**
   * Check if position has a tile
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  hasTile(x, y) {
    return this._state.board.tiles.has(`${x},${y}`);
  }

  /**
   * Get the board tiles Map (for rules validation)
   * @returns {Map}
   */
  getBoardTiles() {
    return this._state.board.tiles;
  }

  /**
   * Get all placed tiles
   * @returns {Array<{x: number, y: number, tile: Object}>}
   */
  getAllTiles() {
    const result = [];
    for (const [key, tile] of this._state.board.tiles) {
      const [x, y] = key.split(',').map(Number);
      result.push({ x, y, tile: { ...tile } });
    }
    return result;
  }

  /**
   * Get current turn info
   * @returns {Object}
   */
  getTurn() {
    return { ...this._state.turn };
  }

  /**
   * Get current turn phase
   * @returns {string}
   */
  getTurnPhase() {
    return this._state.turn.phase;
  }

  /**
   * Get draw pile count
   * @returns {number}
   */
  getDrawPileCount() {
    return this._state.drawPile.length;
  }

  /**
   * Get turn info for UI rendering (decoupled from GameRules)
   * @returns {Object}
   */
  getTurnInfo() {
    const tilesPlaced = this._state.turn.tilesPlacedThisTurn || 0;
    const tilesPerTurn = GameRules.TILES_PER_TURN;
    const isSimpleMode = isSimpleTurnMode();

    return {
      phase: this._state.turn.phase,
      number: this._state.turn.number,
      tilesPlaced,
      tilesPerTurn,
      tilesRemaining: Math.max(0, tilesPerTurn - tilesPlaced),
      isSimpleMode
    };
  }

  /**
   * Get UI state
   * @returns {Object}
   */
  getUIState() {
    return {
      hoveredTile: { ...this._state.ui.hoveredTile },
      selectedHandTile: this._state.ui.selectedHandTile,
      selectedBoardTile: this._state.ui.selectedBoardTile ? { ...this._state.ui.selectedBoardTile } : null,
    };
  }

  /**
   * Get hovered tile
   * @returns {{x: number, y: number}}
   */
  getHoveredTile() {
    return { ...this._state.ui.hoveredTile };
  }

  /**
   * Get selected board tile
   * @returns {{x: number, y: number}|null}
   */
  getSelectedTile() {
    return this._state.ui.selectedBoardTile ? { ...this._state.ui.selectedBoardTile } : null;
  }

  /**
   * Get tiles formatted for rendering
   * @returns {Array<{x: number, y: number, tile: Object, stackIndex: number, isHQ: boolean, landmarkOwner: number}>}
   */
  getTilesForRendering() {
    const result = [];

    // Regular tiles (not part of landmarks)
    for (const [key, tile] of this._state.board.tiles) {
      if (!tile.isPartOfLandmark) {
        const [x, y] = key.split(',').map(Number);
        result.push({ x, y, tile: { ...tile }, stackIndex: 0, isHQ: false, landmarkOwner: -1 });
      }
    }

    // Landmark stacked tiles
    for (const landmark of this._state.board.landmarks) {
      const { x, y, tiles, isHQ, owner } = landmark;
      tiles.forEach((tile, index) => {
        result.push({
          x, y,
          tile: { ...tile },
          stackIndex: index,
          isHQ: isHQ || false,
          landmarkOwner: owner
        });
      });
    }

    return result;
  }

  /**
   * Get all landmarks
   * @returns {Array<{x: number, y: number, tiles: Array, owner: number}>}
   */
  getLandmarks() {
    return this._state.board.landmarks.map(l => ({
      x: l.x,
      y: l.y,
      tiles: l.tiles.map(t => ({ ...t })),
      owner: l.owner
    }));
  }

  /**
   * Form a landmark from 3 tiles
   * @param {number} landmarkX - Position for the landmark stack
   * @param {number} landmarkY
   * @param {Array<{x: number, y: number}>} tilePositions - Positions of the 3 tiles forming the landmark
   * @param {number} owner - Player who owns the landmark
   */
  formLandmark(landmarkX, landmarkY, tilePositions, owner) {
    // Validate inputs
    this._validateBoardPosition(landmarkX, landmarkY);
    this._validatePlayerIndex(owner);
    if (!Array.isArray(tilePositions) || tilePositions.length !== 3) {
      throw new Error('formLandmark requires exactly 3 tile positions');
    }

    // Collect the tiles and remove them from board (freeing spaces)
    const tiles = [];
    const freedPositions = [];
    for (const pos of tilePositions) {
      this._validateBoardPosition(pos.x, pos.y);
      const key = `${pos.x},${pos.y}`;
      const tile = this._state.board.tiles.get(key);
      if (!tile) {
        throw new Error(`No tile at position (${pos.x}, ${pos.y})`);
      }
      tiles.push({ ...tile });
      freedPositions.push({ x: pos.x, y: pos.y });

      // Remove tile from board (frees the space for new tiles)
      this._state.board.tiles.delete(key);
    }

    // Create the landmark
    const landmark = {
      x: landmarkX,
      y: landmarkY,
      tiles,
      owner,
      isHQ: false, // True when converted to headquarters
      secured: 0,  // Number of friendly agents securing this landmark
      contested: false, // True when enemy agents are present
    };

    this._state.board.landmarks.push(landmark);

    // Update player's landmark count
    this._state.players[owner].landmarks++;

    this._emit(StateEvent.LANDMARK_CREATED, {
      x: landmarkX,
      y: landmarkY,
      tiles,
      owner,
      freedPositions // Positions that are now empty and available
    });
  }

  /**
   * Convert a landmark to Headquarters (HQ)
   * @param {number} landmarkIndex - Index of landmark in landmarks array
   * @param {number} playerIndex - Player converting the landmark
   */
  convertToHQ(landmarkIndex, playerIndex) {
    this._validatePlayerIndex(playerIndex);

    const landmark = this._state.board.landmarks[landmarkIndex];
    if (!landmark) {
      throw new Error(`Invalid landmark index: ${landmarkIndex}`);
    }
    if (landmark.owner !== playerIndex) {
      throw new Error(`Player ${playerIndex} does not own this landmark`);
    }
    if (landmark.isHQ) {
      throw new Error('Landmark is already an HQ');
    }

    // Check max HQ limit
    const currentHQCount = this._state.players[playerIndex].headquarters;
    if (currentHQCount >= GameRules.MAX_HQ_PER_PLAYER) {
      throw new Error(`Player has reached maximum HQ limit (${GameRules.MAX_HQ_PER_PLAYER})`);
    }

    // Convert to HQ
    landmark.isHQ = true;
    this._state.players[playerIndex].headquarters++;

    // Spawn initial agents at HQ location
    const agentsToSpawn = GameRules.AGENTS_ON_HQ_CONVERSION;
    for (let i = 0; i < agentsToSpawn; i++) {
      this._spawnAgentAt(landmark.x, landmark.y, playerIndex);
    }

    this._emit(StateEvent.HQ_CREATED, {
      landmarkIndex,
      x: landmark.x,
      y: landmark.y,
      owner: playerIndex,
      agentsSpawned: agentsToSpawn
    });
  }

  /**
   * Get landmark at position
   * @param {number} x
   * @param {number} y
   * @returns {Object|null} Landmark or null
   */
  getLandmarkAt(x, y) {
    return this._state.board.landmarks.find(l => l.x === x && l.y === y) || null;
  }

  /**
   * Get landmark index by position
   * @param {number} x
   * @param {number} y
   * @returns {number} Index or -1
   */
  getLandmarkIndex(x, y) {
    return this._state.board.landmarks.findIndex(l => l.x === x && l.y === y);
  }

  /**
   * Remove a landmark from the board (for settlement/destruction)
   * @param {number} x
   * @param {number} y
   * @returns {Object|null} The removed landmark or null
   */
  removeLandmark(x, y) {
    const index = this.getLandmarkIndex(x, y);
    if (index === -1) {
      return null;
    }

    const landmark = this._state.board.landmarks[index];
    this._state.board.landmarks.splice(index, 1);

    this._emit(StateEvent.LANDMARK_REMOVED, { x, y, owner: landmark.owner, wasHQ: landmark.isHQ });

    return landmark;
  }

  // ===========================================================================
  // AGENTS
  // ===========================================================================

  /**
   * Spawn an agent at a position (internal helper)
   * @private
   */
  _spawnAgentAt(x, y, owner) {
    const key = `${x},${y}`;
    const existing = this._state.board.agents.get(key);

    if (existing) {
      // Stack agents at same position
      if (!existing.stack) {
        existing.stack = [{ owner: existing.owner }];
      }
      existing.stack.push({ owner });
    } else {
      this._state.board.agents.set(key, { owner, stack: [{ owner }] });
    }
  }

  /**
   * Place an agent on the board
   * @param {number} x
   * @param {number} y
   * @param {number} owner - Player who owns the agent
   */
  placeAgent(x, y, owner) {
    this._validateBoardPosition(x, y);
    this._validatePlayerIndex(owner);

    // Check max agents limit
    const currentAgents = this.getPlayerAgentCount(owner);
    if (currentAgents >= GameRules.MAX_AGENTS_PER_PLAYER) {
      throw new Error(`Player has reached maximum agent limit (${GameRules.MAX_AGENTS_PER_PLAYER})`);
    }

    this._spawnAgentAt(x, y, owner);

    this._emit(StateEvent.AGENT_PLACED, { x, y, owner });
  }

  /**
   * Move an agent from one position to another
   * @param {number} fromX
   * @param {number} fromY
   * @param {number} toX
   * @param {number} toY
   * @param {number} playerIndex - Player moving the agent
   */
  moveAgent(fromX, fromY, toX, toY, playerIndex) {
    this._validateBoardPosition(fromX, fromY);
    this._validateBoardPosition(toX, toY);
    this._validatePlayerIndex(playerIndex);

    const fromKey = `${fromX},${fromY}`;
    const agentData = this._state.board.agents.get(fromKey);

    if (!agentData || !agentData.stack || agentData.stack.length === 0) {
      throw new Error(`No agent at (${fromX}, ${fromY})`);
    }

    // Find an agent owned by the player
    const agentIndex = agentData.stack.findIndex(a => a.owner === playerIndex);
    if (agentIndex === -1) {
      throw new Error(`Player ${playerIndex} has no agent at (${fromX}, ${fromY})`);
    }

    // Remove agent from source
    agentData.stack.splice(agentIndex, 1);
    if (agentData.stack.length === 0) {
      this._state.board.agents.delete(fromKey);
    } else {
      // Update primary owner to first in stack
      agentData.owner = agentData.stack[0].owner;
    }

    // Add agent to destination
    this._spawnAgentAt(toX, toY, playerIndex);

    this._emit(StateEvent.AGENT_MOVED, {
      fromX, fromY, toX, toY, owner: playerIndex
    });
  }

  /**
   * Remove an agent from the board
   * @param {number} x
   * @param {number} y
   * @param {number} playerIndex - Owner of agent to remove
   */
  removeAgent(x, y, playerIndex) {
    this._validateBoardPosition(x, y);
    this._validatePlayerIndex(playerIndex);

    const key = `${x},${y}`;
    const agentData = this._state.board.agents.get(key);

    if (!agentData || !agentData.stack) {
      throw new Error(`No agent at (${x}, ${y})`);
    }

    const agentIndex = agentData.stack.findIndex(a => a.owner === playerIndex);
    if (agentIndex === -1) {
      throw new Error(`Player ${playerIndex} has no agent at (${x}, ${y})`);
    }

    agentData.stack.splice(agentIndex, 1);
    if (agentData.stack.length === 0) {
      this._state.board.agents.delete(key);
    } else {
      agentData.owner = agentData.stack[0].owner;
    }

    this._emit(StateEvent.AGENT_REMOVED, { x, y, owner: playerIndex });
  }

  /**
   * Get all agents on the board
   * @returns {Array<{x: number, y: number, owner: number, count: number}>}
   */
  getAgents() {
    const agents = [];
    for (const [key, data] of this._state.board.agents) {
      const [x, y] = key.split(',').map(Number);
      // Group by owner at this position
      const ownerCounts = {};
      for (const agent of data.stack || []) {
        ownerCounts[agent.owner] = (ownerCounts[agent.owner] || 0) + 1;
      }
      for (const [owner, count] of Object.entries(ownerCounts)) {
        agents.push({ x, y, owner: Number(owner), count });
      }
    }
    return agents;
  }

  /**
   * Get agents at a specific position
   * @param {number} x
   * @param {number} y
   * @returns {Array<{owner: number}>}
   */
  getAgentsAt(x, y) {
    const key = `${x},${y}`;
    const data = this._state.board.agents.get(key);
    return data?.stack ? [...data.stack] : [];
  }

  /**
   * Get total agent count for a player
   * @param {number} playerIndex
   * @returns {number}
   */
  getPlayerAgentCount(playerIndex) {
    let count = 0;
    for (const data of this._state.board.agents.values()) {
      if (data.stack) {
        count += data.stack.filter(a => a.owner === playerIndex).length;
      }
    }
    return count;
  }

  /**
   * Check if a position has enemy agents
   * @param {number} x
   * @param {number} y
   * @param {number} playerIndex - The "friendly" player
   * @returns {boolean}
   */
  hasEnemyAgentsAt(x, y, playerIndex) {
    const agents = this.getAgentsAt(x, y);
    return agents.some(a => a.owner !== playerIndex);
  }

  // ===========================================================================
  // EVENTS (E. Stack)
  // ===========================================================================

  /**
   * Initialize the event pile
   * @param {Array} events - Array of event card objects
   */
  initEventPile(events) {
    this._state.eventPile = [...events];
  }

  /**
   * Shuffle the event pile (if shuffling is enabled)
   * @returns {boolean} True if shuffle was performed
   */
  shuffleEventPile() {
    if (!GameRules.ENABLE_SHUFFLE) {
      console.log('[GameState] Shuffle disabled - event pile order preserved');
      return false;
    }
    const pile = this._state.eventPile;
    for (let i = pile.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pile[i], pile[j]] = [pile[j], pile[i]];
    }
    return true;
  }

  /**
   * Get event pile count
   * @returns {number}
   */
  getEventPileCount() {
    return this._state.eventPile.length;
  }

  /**
   * Draw an event card from the pile
   * @returns {Object|null} Event card or null if pile is empty
   */
  drawEvent() {
    if (this._state.eventPile.length === 0) {
      return null;
    }
    return this._state.eventPile.pop();
  }

  /**
   * Draw an event card to a player's hand
   * @param {number} playerIndex
   * @returns {Object|null} Drawn event or null
   */
  drawEventToHand(playerIndex = this._state.currentPlayer) {
    this._validatePlayerIndex(playerIndex);
    const event = this.drawEvent();
    if (event) {
      this._state.players[playerIndex].events.push(event);
      this._emit(StateEvent.EVENT_DRAWN, { player: playerIndex, event });
    }
    return event;
  }

  /**
   * Get a player's event cards
   * @param {number} playerIndex
   * @returns {Array}
   */
  getPlayerEvents(playerIndex) {
    this._validatePlayerIndex(playerIndex);
    return [...this._state.players[playerIndex].events];
  }

  /**
   * Remove an event from player's hand
   * @param {number} playerIndex
   * @param {number} eventIndex
   * @returns {Object|null}
   */
  removeEventFromHand(playerIndex, eventIndex) {
    this._validatePlayerIndex(playerIndex);
    const events = this._state.players[playerIndex].events;
    if (eventIndex >= 0 && eventIndex < events.length) {
      return events.splice(eventIndex, 1)[0];
    }
    return null;
  }

  /**
   * Play an event card (removes from hand, emits event)
   * @param {number} playerIndex
   * @param {number} eventIndex
   * @param {Object} target - Target data for the event
   * @returns {Object|null} The played event or null
   */
  playEvent(playerIndex, eventIndex, target = null) {
    const event = this.removeEventFromHand(playerIndex, eventIndex);
    if (event) {
      this._emit(StateEvent.EVENT_PLAYED, {
        player: playerIndex,
        event,
        target
      });
    }
    return event;
  }

  /**
   * Peek at top N events from pile (for Insider Trading etc.)
   * @param {number} count
   * @returns {Array}
   */
  peekEventPile(count) {
    const pile = this._state.eventPile;
    return pile.slice(-count).reverse();
  }

  /**
   * Reorder top N events in pile
   * @param {Array} newOrder - Array of event objects in new order (top first)
   */
  reorderEventPile(newOrder) {
    const pile = this._state.eventPile;
    const count = newOrder.length;
    pile.splice(-count, count);
    pile.push(...newOrder.reverse());
  }

  /**
   * Peek at top N tiles from draw pile (for Insider Trading etc.)
   * @param {number} count
   * @returns {Array}
   */
  peekDrawPile(count) {
    const pile = this._state.drawPile;
    return pile.slice(-count).reverse();
  }

  /**
   * Reorder top N tiles in draw pile
   * @param {Array} newOrder - Array of tile objects in new order (top first)
   */
  reorderDrawPile(newOrder) {
    const pile = this._state.drawPile;
    const count = newOrder.length;
    pile.splice(-count, count);
    pile.push(...newOrder.reverse());
  }

  // ===========================================================================
  // MUTATIONS
  // ===========================================================================

  /**
   * Set game phase
   * @param {string} phase
   */
  setPhase(phase) {
    const oldPhase = this._state.phase;
    this._state.phase = phase;
    this._emit(StateEvent.PHASE_CHANGE, { oldPhase, newPhase: phase });
  }

  /**
   * Start a new game
   * @param {number} playerCount
   */
  startGame(playerCount = 2) {
    this._state = createInitialState(playerCount);
    this._state.phase = GamePhase.PLAYING;
    this._state.turn.number = 1;
    this._emit(StateEvent.PHASE_CHANGE, { oldPhase: GamePhase.SETUP, newPhase: GamePhase.PLAYING });
    this._emit(StateEvent.TURN_START, { turn: 1, player: 0 });
  }

  /**
   * Add a tile to a player's hand
   * @param {number} playerIndex
   * @param {Object} tile
   */
  addTileToHand(playerIndex, tile) {
    this._validatePlayerIndex(playerIndex);
    this._validateTile(tile);
    this._state.players[playerIndex].hand.push({ ...tile });
  }

  /**
   * Remove a tile from a player's hand
   * @param {number} playerIndex
   * @param {number} tileIndex
   * @returns {Object|null} The removed tile, or null if invalid index
   */
  removeTileFromHand(playerIndex, tileIndex) {
    this._validatePlayerIndex(playerIndex);
    const hand = this._state.players[playerIndex].hand;
    if (typeof tileIndex !== 'number' || tileIndex < 0 || tileIndex >= hand.length) {
      return null;
    }
    return hand.splice(tileIndex, 1)[0];
  }

  /**
   * Get a player's hand
   * @param {number} playerIndex
   * @returns {Array}
   */
  getPlayerHand(playerIndex) {
    return this._state.players[playerIndex].hand.map(t => ({ ...t }));
  }

  /**
   * Initialize the draw pile with tiles
   * @param {Array} tiles - Array of tile objects
   */
  initDrawPile(tiles) {
    this._state.drawPile = [...tiles];
  }

  /**
   * Shuffle the draw pile (if shuffling is enabled)
   * @returns {boolean} True if shuffle was performed
   */
  shuffleDrawPile() {
    if (!GameRules.ENABLE_SHUFFLE) {
      console.log('[GameState] Shuffle disabled - draw pile order preserved');
      return false;
    }
    const pile = this._state.drawPile;
    for (let i = pile.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pile[i], pile[j]] = [pile[j], pile[i]];
    }
    return true;
  }

  /**
   * Add a tile to the bottom of the draw pile
   * @param {Object} tile
   */
  addTileToDrawPileBottom(tile) {
    this._state.drawPile.unshift(tile);
  }

  /**
   * Add multiple tiles to the bottom of the draw pile
   * @param {Array} tiles
   */
  addTilesToDrawPileBottom(tiles) {
    this._state.drawPile.unshift(...tiles);
  }

  /**
   * Draw a tile from the draw pile
   * @returns {Object|null} The drawn tile, or null if pile is empty
   */
  drawTile() {
    if (this._state.drawPile.length === 0) {
      return null;
    }
    return this._state.drawPile.pop();
  }

  /**
   * Draw a tile and add it to the current player's hand
   * @returns {Object|null} The drawn tile, or null if pile is empty
   */
  drawTileToHand() {
    const tile = this.drawTile();
    if (tile) {
      const currentPlayer = this._state.currentPlayer;
      this._state.players[currentPlayer].hand.push(tile);
    }
    return tile;
  }

  /**
   * Set the turn phase
   * @param {string} phase
   */
  setTurnPhase(phase) {
    const oldPhase = this._state.turn.phase;
    this._state.turn.phase = phase;
    this._emit(StateEvent.PHASE_CHANGE, { oldPhase, newPhase: phase, type: 'turn' });
  }

  /**
   * Advance to the next turn phase
   */
  advanceTurnPhase() {
    const phases = [TurnPhase.DRAW, TurnPhase.DEVELOP, TurnPhase.AGENT, TurnPhase.END];
    const currentIndex = phases.indexOf(this._state.turn.phase);

    if (currentIndex < phases.length - 1) {
      this.setTurnPhase(phases[currentIndex + 1]);
    } else {
      // End of turn - advance to next player
      this.endTurn();
    }
  }

  /**
   * Record that a tile was placed this turn
   */
  recordTilePlaced() {
    this._state.turn.tilesPlacedThisTurn++;
  }

  /**
   * Get number of tiles placed this turn
   * @returns {number}
   */
  getTilesPlacedThisTurn() {
    return this._state.turn.tilesPlacedThisTurn;
  }

  /**
   * Place a tile on the board
   * @param {number} x
   * @param {number} y
   * @param {Object} tile
   */
  placeTile(x, y, tile) {
    // Validate inputs
    this._validateBoardPosition(x, y);
    this._validateTile(tile);

    const key = `${x},${y}`;
    if (this._state.board.tiles.has(key)) {
      throw new Error(`Tile already exists at (${x}, ${y})`);
    }
    this._state.board.tiles.set(key, { ...tile, placedBy: this._state.currentPlayer });
    this._emit(StateEvent.TILE_PLACED, { x, y, tile, player: this._state.currentPlayer });
  }

  /**
   * Remove a tile from the board
   * @param {number} x
   * @param {number} y
   */
  removeTile(x, y) {
    const key = `${x},${y}`;
    const tile = this._state.board.tiles.get(key);
    if (tile) {
      this._state.board.tiles.delete(key);
      this._emit(StateEvent.TILE_REMOVED, { x, y, tile });
      return tile;
    }
    return null;
  }

  /**
   * Update tile ownership (for captures)
   * @param {number} x
   * @param {number} y
   * @param {number} newOwner - Player index
   */
  updateTileOwnership(x, y, newOwner) {
    const key = `${x},${y}`;
    const tile = this._state.board.tiles.get(key);
    if (tile) {
      tile.owner = newOwner;
      tile.placedBy = newOwner;
    }
  }

  /**
   * Set current player (for game setup)
   * @param {number} playerIndex
   */
  setCurrentPlayer(playerIndex) {
    this._validatePlayerIndex(playerIndex);
    this._state.currentPlayer = playerIndex;
  }

  /**
   * Set a flag on a player (for event effects like skip phase, ignore adjacency)
   * @param {number} playerIndex
   * @param {string} flag - The flag name to set
   * @param {any} value - The value to set
   */
  setPlayerFlag(playerIndex, flag, value) {
    this._validatePlayerIndex(playerIndex);
    this._state.players[playerIndex][flag] = value;
  }

  /**
   * Get a flag from a player
   * @param {number} playerIndex
   * @param {string} flag - The flag name to get
   * @returns {any}
   */
  getPlayerFlag(playerIndex, flag) {
    this._validatePlayerIndex(playerIndex);
    return this._state.players[playerIndex][flag];
  }

  /**
   * Clear a flag from a player (set to false/undefined)
   * @param {number} playerIndex
   * @param {string} flag
   */
  clearPlayerFlag(playerIndex, flag) {
    this._validatePlayerIndex(playerIndex);
    this._state.players[playerIndex][flag] = false;
  }

  /**
   * Set turn number (for game setup)
   * @param {number} turnNumber
   */
  setTurnNumber(turnNumber) {
    if (typeof turnNumber !== 'number' || !Number.isInteger(turnNumber) || turnNumber < 0) {
      throw new Error(`Invalid turn number: must be a non-negative integer`);
    }
    this._state.turn.number = turnNumber;
  }

  /**
   * End current player's turn
   */
  endTurn() {
    const oldPlayer = this._state.currentPlayer;
    this._emit(StateEvent.TURN_END, { turn: this._state.turn.number, player: oldPlayer });

    // Advance to next player
    this._state.currentPlayer = (this._state.currentPlayer + 1) % this._state.playerCount;

    // If wrapped around to player 0, increment turn number
    if (this._state.currentPlayer === 0) {
      this._state.turn.number++;
    }

    // Reset turn state - use correct phase for mode
    this._state.turn.phase = isSimpleTurnMode() ? TurnPhase.PLACE : TurnPhase.DRAW;
    this._state.turn.tilesPlacedThisTurn = 0;

    this._emit(StateEvent.TURN_START, { turn: this._state.turn.number, player: this._state.currentPlayer });
    this._emit(StateEvent.PLAYER_CHANGE, { oldPlayer, newPlayer: this._state.currentPlayer });
  }

  /**
   * Set hovered tile (UI state)
   * @param {number} x
   * @param {number} y
   */
  setHoveredTile(x, y) {
    const old = { ...this._state.ui.hoveredTile };
    this._state.ui.hoveredTile = { x, y };
    this._emit(StateEvent.UI_HOVER, { oldTile: old, newTile: { x, y } });
  }

  /**
   * Clear hovered tile
   */
  clearHoveredTile() {
    this.setHoveredTile(-1, -1);
  }

  /**
   * Select a tile from hand
   * @param {number|null} index
   */
  selectHandTile(index) {
    this._state.ui.selectedHandTile = index;
    this._emit(StateEvent.UI_SELECT, { type: 'hand', index });
  }

  /**
   * Select a board tile
   * @param {number|null} x
   * @param {number|null} y
   */
  selectBoardTile(x, y) {
    this._state.ui.selectedBoardTile = x !== null ? { x, y } : null;
    this._emit(StateEvent.UI_SELECT, { type: 'board', position: this._state.ui.selectedBoardTile });
  }

  // ===========================================================================
  // OBSERVERS
  // ===========================================================================

  /**
   * Subscribe to state events
   * @param {string} eventType
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  on(eventType, callback) {
    if (!this._subscribers.has(eventType)) {
      this._subscribers.set(eventType, new Set());
    }
    this._subscribers.get(eventType).add(callback);
    return () => this.off(eventType, callback);
  }

  /**
   * Unsubscribe from state events
   * @param {string} eventType
   * @param {Function} callback
   */
  off(eventType, callback) {
    this._subscribers.get(eventType)?.delete(callback);
  }

  /**
   * Emit a state event
   * @private
   */
  _emit(eventType, data) {
    const callbacks = this._subscribers.get(eventType);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(data);
      }
    }
  }

  // ===========================================================================
  // SERIALIZATION
  // ===========================================================================

  /**
   * Serialize state for saving
   * @returns {Object}
   */
  serialize() {
    return {
      phase: this._state.phase,
      currentPlayer: this._state.currentPlayer,
      playerCount: this._state.playerCount,
      players: this._state.players,
      board: {
        tiles: Array.from(this._state.board.tiles.entries()),
        landmarks: this._state.board.landmarks,
        agents: Array.from(this._state.board.agents.entries()),
      },
      drawPile: this._state.drawPile,
      eventPile: this._state.eventPile,
      turn: this._state.turn,
      // Note: UI state is not serialized (ephemeral)
    };
  }

  /**
   * Load state from serialized data
   * @param {Object} data
   */
  deserialize(data) {
    this._state = createInitialState(data.playerCount);
    this._state.phase = data.phase;
    this._state.currentPlayer = data.currentPlayer;
    this._state.players = data.players;
    this._state.board.tiles = new Map(data.board.tiles);
    this._state.board.landmarks = data.board.landmarks;
    this._state.board.agents = new Map(data.board.agents || []);
    this._state.drawPile = data.drawPile || [];
    this._state.eventPile = data.eventPile || [];
    this._state.turn = data.turn;
    this._emit(StateEvent.PHASE_CHANGE, { oldPhase: null, newPhase: data.phase });
  }
}
