/**
 * Trinity - Game Controller
 * Handles all game logic: tile placement, turn management, game setup
 */

import { GameState, StateEvent, TurnPhase } from '../state/GameState.js';
import { TileType, createTile } from '../game/TileTypes.js';
import { canPlaceTile, getValidPlacements, detectPotentialLandmarks } from '../game/Rules.js';
import { GameRules, isSimpleTurnMode, getTilesToDraw } from '../game/GameRules.js';
import { createEventDeck, shuffleArray, eventRequiresTarget } from '../game/EventCards.js';

export class GameController {
  /**
   * @param {GameState} gameState
   */
  constructor(gameState) {
    this._gameState = gameState;

    // Callbacks for UI updates (set by main.js)
    this._onValidPlacementsChange = null;
    this._onSelectionClear = null;

    // Combo placement state
    this._comboCount = 0;
    this._comboActive = false;
  }

  /**
   * Set the game state (used when resetting)
   * @param {GameState} gameState
   */
  setGameState(gameState) {
    this._gameState = gameState;
  }

  /**
   * Set callback for valid placements changes
   * @param {Function} callback
   */
  onValidPlacementsChange(callback) {
    this._onValidPlacementsChange = callback;
  }

  /**
   * Set callback for selection clear
   * @param {Function} callback
   */
  onSelectionClear(callback) {
    this._onSelectionClear = callback;
  }

  // ===========================================================================
  // TILE SELECTION & PLACEMENT
  // ===========================================================================

  /**
   * Select a tile from the player's hand
   * @param {number} index
   * @param {number} currentSelection - Current selected index
   * @returns {{selected: number, validPositions: Array|null}}
   */
  selectHandTile(index, currentSelection) {
    // Toggle selection
    if (currentSelection === index) {
      this._gameState.selectHandTile(-1);
      return { selected: -1, validPositions: null };
    }

    this._gameState.selectHandTile(index);

    // Calculate valid placements
    const currentPlayer = this._gameState.getCurrentPlayer();
    const boardTiles = this._gameState.getBoardTiles();
    const tilesPlacedThisTurn = this._gameState.getTilesPlacedThisTurn();

    let validPositions;

    // If combo is enabled and we've already placed a tile, show combo positions
    if (GameRules.COMBO_ENABLED && tilesPlacedThisTurn > 0 && this._comboActive) {
      const hand = this._gameState.getPlayerHand(currentPlayer);
      if (index >= 0 && index < hand.length) {
        const tileType = hand[index].type;
        validPositions = this.getValidComboPositions(tileType).map(p => ({ x: p.x, y: p.y }));
      } else {
        validPositions = [];
      }
    } else {
      // Normal placement - use standard valid positions
      validPositions = getValidPlacements(boardTiles, currentPlayer, GameRules.PLAYER_COUNT);
    }

    return { selected: index, validPositions, isComboMode: GameRules.COMBO_ENABLED && tilesPlacedThisTurn > 0 };
  }

  /**
   * Attempt to place a tile from hand onto the board
   * @param {number} x - Board X position
   * @param {number} y - Board Y position
   * @param {number} handIndex - Index in player's hand
   * @returns {{success: boolean, reason?: string, autoEndTurn?: boolean}}
   */
  tryPlaceTile(x, y, handIndex) {
    const currentPlayer = this._gameState.getCurrentPlayer();
    const boardTiles = this._gameState.getBoardTiles();

    // Get the tile type being placed (needed for combo validation)
    const hand = this._gameState.getPlayerHand(currentPlayer);
    if (handIndex < 0 || handIndex >= hand.length) {
      return { success: false, reason: 'Invalid hand index' };
    }
    const tileType = hand[handIndex].type;

    // Check tile placement limit
    // If combo is enabled and we've placed tiles, check combo validity instead
    const tilesPlacedThisTurn = this._gameState.getTilesPlacedThisTurn();

    if (GameRules.COMBO_ENABLED && tilesPlacedThisTurn > 0) {
      // For combo placement, check if this is a valid combo move
      if (this._comboCount >= GameRules.COMBO_MAX_CHAIN) {
        return { success: false, reason: `Maximum combo chain reached (${GameRules.COMBO_MAX_CHAIN})` };
      }

      // Check if this position is valid for combo (connects to different-type neighbor)
      if (!this._canPlaceAsCombo(tileType, x, y)) {
        return { success: false, reason: 'Combo placement requires connecting to a different-type tile you own' };
      }
    } else if (!GameRules.UNLIMITED_PLACEMENT && !GameRules.COMBO_ENABLED && tilesPlacedThisTurn >= GameRules.TILES_PER_TURN) {
      return { success: false, reason: `Already placed ${GameRules.TILES_PER_TURN} tile(s) this turn` };
    }

    // Check if player has ignore adjacency flag (from Shell Company event)
    const ignoreAdjacency = this._gameState.getPlayerFlag(currentPlayer, 'ignoreAdjacencyNextTile');

    // For first tile of turn (or non-combo), use normal validation
    // For combo tiles, we already validated the combo condition above
    const isComboPlacement = GameRules.COMBO_ENABLED && tilesPlacedThisTurn > 0;

    if (!isComboPlacement) {
      // Validate normal placement
      const validation = canPlaceTile(boardTiles, x, y, currentPlayer, GameRules.PLAYER_COUNT);
      if (!validation.valid) {
        // If ignoring adjacency, only allow if the reason is adjacency-related
        const isAdjacencyError = validation.reason?.includes('adjacent') || validation.reason?.includes('starting zone');
        if (!ignoreAdjacency || !isAdjacencyError) {
          // Still reject if it's an occupied space error
          if (validation.reason?.includes('occupied')) {
            return { success: false, reason: validation.reason };
          }
          if (!ignoreAdjacency) {
            return { success: false, reason: validation.reason };
          }
        }
        // Otherwise allow the placement (ignoring adjacency rule)
      }
    } else {
      // For combo placement, still check that position is empty and in bounds
      if (x < 0 || x >= GameRules.BOARD_SIZE || y < 0 || y >= GameRules.BOARD_SIZE) {
        return { success: false, reason: 'Position out of bounds' };
      }
      if (this._gameState.getTile(x, y) || this._gameState.getLandmarkAt(x, y)) {
        return { success: false, reason: 'Position is occupied' };
      }
    }

    // Save state for undo before making changes
    this._gameState.saveStateForUndo();

    // Execute placement
    const tile = this._gameState.removeTileFromHand(currentPlayer, handIndex);
    if (!tile) {
      return { success: false, reason: 'No tile at that hand index' };
    }

    this._gameState.placeTile(x, y, tile);
    this._gameState.selectHandTile(null);
    this._gameState.recordTilePlaced();

    // Clear the ignore adjacency flag after use
    if (ignoreAdjacency) {
      this._gameState.clearPlayerFlag(currentPlayer, 'ignoreAdjacencyNextTile');
      console.log(`Player ${currentPlayer + 1} used Shell Company effect - adjacency rule ignored`);
    }

    // Check for landmarks
    this._checkAndFormLandmarks(x, y, tile.type, currentPlayer);

    // Determine if turn should auto-end (not in unlimited mode)
    const shouldAutoEnd = isSimpleTurnMode() &&
      !GameRules.UNLIMITED_PLACEMENT &&
      this._gameState.getTilesPlacedThisTurn() >= GameRules.TILES_PER_TURN;

    // Update combo state
    if (GameRules.COMBO_ENABLED) {
      this._comboCount++;
      this._comboActive = this._hasMoreComboOptions();
    }

    return { success: true, tileType: tile.type, autoEndTurn: shouldAutoEnd, comboActive: this._comboActive, comboCount: this._comboCount };
  }

  // ===========================================================================
  // COMBO PLACEMENT
  // ===========================================================================

  /**
   * Check if the player can continue placing tiles via combo
   * A tile can be placed in a combo if it connects to a different-type neighbor owned by the player
   * @param {string} tileType - Type of tile being placed
   * @param {number} x - Board X position
   * @param {number} y - Board Y position
   * @returns {boolean}
   */
  _canPlaceAsCombo(tileType, x, y) {
    if (!GameRules.COMBO_ENABLED) return false;
    if (this._comboCount >= GameRules.COMBO_MAX_CHAIN) return false;

    const currentPlayer = this._gameState.getCurrentPlayer();

    // Get orthogonal neighbors
    const neighbors = [
      { x: x - 1, y },
      { x: x + 1, y },
      { x, y: y - 1 },
      { x, y: y + 1 }
    ];

    // Check if any neighbor is owned by current player AND is a different type
    for (const pos of neighbors) {
      const tile = this._gameState.getTile(pos.x, pos.y);
      if (tile && tile.placedBy === currentPlayer && tile.type !== tileType) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all valid positions where a tile can be placed as part of a combo
   * @param {string} tileType - Type of tile to place
   * @returns {Array<{x: number, y: number, connectsTo: {x: number, y: number, type: string}}>}
   */
  getValidComboPositions(tileType) {
    if (!GameRules.COMBO_ENABLED) return [];
    if (this._comboCount >= GameRules.COMBO_MAX_CHAIN) return [];

    const currentPlayer = this._gameState.getCurrentPlayer();
    const validPositions = [];
    const checkedPositions = new Set();

    // Get all tiles owned by current player that are different type
    for (const { x, y, tile } of this._gameState.getAllTiles()) {
      if (tile.placedBy !== currentPlayer) continue;
      if (tile.type === tileType) continue; // Must be different type

      // Check adjacent empty positions
      const neighbors = [
        { x: x - 1, y: y },
        { x: x + 1, y: y },
        { x: x, y: y - 1 },
        { x: x, y: y + 1 }
      ];

      for (const pos of neighbors) {
        const key = `${pos.x},${pos.y}`;
        if (checkedPositions.has(key)) continue;
        checkedPositions.add(key);

        // Check bounds
        if (pos.x < 0 || pos.x >= GameRules.BOARD_SIZE || pos.y < 0 || pos.y >= GameRules.BOARD_SIZE) {
          continue;
        }

        // Check if empty
        if (this._gameState.getTile(pos.x, pos.y)) continue;
        if (this._gameState.getLandmarkAt(pos.x, pos.y)) continue;

        validPositions.push({
          x: pos.x,
          y: pos.y,
          connectsTo: { x, y, type: tile.type }
        });
      }
    }

    return validPositions;
  }

  /**
   * Check if player has more combo options available in their hand
   * @private
   * @returns {boolean}
   */
  _hasMoreComboOptions() {
    if (!GameRules.COMBO_ENABLED) return false;
    if (this._comboCount >= GameRules.COMBO_MAX_CHAIN) return false;

    const currentPlayer = this._gameState.getCurrentPlayer();
    const hand = this._gameState.getPlayerHand(currentPlayer);

    for (const tile of hand) {
      const validPositions = this.getValidComboPositions(tile.type);
      if (validPositions.length > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Reset combo state (called at turn start/end)
   */
  resetComboState() {
    this._comboCount = 0;
    this._comboActive = false;
  }

  /**
   * Get current combo count
   * @returns {number}
   */
  getComboCount() {
    return this._comboCount;
  }

  /**
   * Check if combo is currently active
   * @returns {boolean}
   */
  isComboActive() {
    return this._comboActive;
  }

  /**
   * Check for and form landmarks after tile placement
   * Per rulebook: forming a landmark awards 1 event card
   * @private
   */
  _checkAndFormLandmarks(x, y, tileType, player) {
    if (!GameRules.AUTO_FORM_LANDMARKS) {
      console.log('[Trinity Check] Auto-form landmarks disabled, skipping check');
      return;
    }

    console.log(`\n========== TRINITY CHECK START ==========`);
    const boardTiles = this._gameState.getBoardTiles();
    const landmarks = detectPotentialLandmarks(boardTiles, x, y, tileType, player);

    if (landmarks.length > 0) {
      const lm = landmarks[0];
      const positions = [lm.housing, lm.commerce, lm.industry];
      console.log(`[Trinity Check] Creating landmark at (${x}, ${y}) with tiles:`, positions);
      this._gameState.formLandmark(x, y, positions, player);
      console.log(`[Trinity Check] ★ LANDMARK FORMED for Player ${player + 1}! ★`);

      // Per rulebook: draw 1 event card as reward for forming landmark
      const event = this._gameState.drawEventToHand(player);
      if (event) {
        console.log(`[Trinity Check] Player ${player + 1} drew event "${event.name}" as reward`);
      }
    } else {
      console.log(`[Trinity Check] No Trinity formed this placement`);
    }
    console.log(`========== TRINITY CHECK END ==========\n`);
  }

  /**
   * Preview potential landmark formation at a hypothetical position
   * Returns the tiles that would form a landmark if the given tile is placed
   * @param {number} x - Board X position
   * @param {number} y - Board Y position
   * @param {string} tileType - Type of tile being placed
   * @returns {Array<{x: number, y: number}>} Positions that would form the landmark
   */
  previewLandmarkFormation(x, y, tileType) {
    if (!GameRules.AUTO_FORM_LANDMARKS) {
      return [];
    }

    const currentPlayer = this._gameState.getCurrentPlayer();
    const boardTiles = this._gameState.getBoardTiles();

    // Temporarily add the preview tile to check for landmarks
    // We need to create a copy of the board tiles map
    const tempBoardTiles = new Map(boardTiles);
    tempBoardTiles.set(`${x},${y}`, {
      type: tileType,
      placedBy: currentPlayer,
      isLandmark: false
    });

    const landmarks = detectPotentialLandmarks(tempBoardTiles, x, y, tileType, currentPlayer);

    if (landmarks.length > 0) {
      const lm = landmarks[0];
      return [lm.housing, lm.commerce, lm.industry];
    }

    return [];
  }

  // ===========================================================================
  // TURN MANAGEMENT
  // ===========================================================================

  /**
   * Handle action button press based on game mode
   * @returns {{action: string, result?: any}}
   */
  handleActionButton() {
    if (isSimpleTurnMode()) {
      return this._handleSimpleModeAction();
    }
    return this._handleClassicModeAction();
  }

  /**
   * Handle simple mode action
   * @private
   */
  _handleSimpleModeAction() {
    const tilesPlaced = this._gameState.getTilesPlacedThisTurn();

    if (tilesPlaced < GameRules.TILES_PER_TURN) {
      return { action: 'prompt', message: 'Select a tile from your hand and click a valid board position' };
    }

    this.endTurnWithRefill();
    return { action: 'endTurn' };
  }

  /**
   * Handle classic mode action based on current phase
   * @private
   */
  _handleClassicModeAction() {
    const phase = this._gameState.getTurnPhase();

    switch (phase) {
      case TurnPhase.DRAW:
        return this._handleDrawPhase();
      case TurnPhase.DEVELOP:
        return this._handleDevelopPhaseEnd();
      case TurnPhase.AGENT:
        return this._handleAgentPhaseEnd();
      case TurnPhase.END:
        return this._handleEndTurn();
      default:
        return { action: 'unknown' };
    }
  }

  /**
   * Handle draw phase
   * @private
   */
  _handleDrawPhase() {
    // Spawn agents at turn start (classic mode)
    this._spawnAgentsFromHQ();

    const tile = this._gameState.drawTileToHand();
    this._gameState.setTurnPhase(TurnPhase.DEVELOP);

    return {
      action: 'draw',
      success: !!tile,
      tileType: tile?.type
    };
  }

  /**
   * Handle develop phase end
   * @private
   */
  _handleDevelopPhaseEnd() {
    const nextPhase = (GameRules.SKIP_AGENT_PHASE || !GameRules.ENABLE_AGENTS)
      ? TurnPhase.END
      : TurnPhase.AGENT;
    this._gameState.setTurnPhase(nextPhase);
    return { action: 'advancePhase', phase: nextPhase };
  }

  /**
   * Handle agent phase end
   * @private
   */
  _handleAgentPhaseEnd() {
    this._gameState.setTurnPhase(TurnPhase.END);
    return { action: 'advancePhase', phase: TurnPhase.END };
  }

  // ===========================================================================
  // HEADQUARTERS (HQ)
  // ===========================================================================

  /**
   * Convert a player's landmark to HQ
   * @param {number} landmarkX
   * @param {number} landmarkY
   * @returns {{success: boolean, reason?: string}}
   */
  convertLandmarkToHQ(landmarkX, landmarkY) {
    if (!GameRules.ENABLE_HQ) {
      return { success: false, reason: 'HQ conversion is disabled' };
    }

    const currentPlayer = this._gameState.getCurrentPlayer();
    const landmarkIndex = this._gameState.getLandmarkIndex(landmarkX, landmarkY);

    if (landmarkIndex === -1) {
      return { success: false, reason: 'No landmark at this position' };
    }

    try {
      this._gameState.convertToHQ(landmarkIndex, currentPlayer);
      console.log(`Player ${currentPlayer + 1} converted landmark at (${landmarkX}, ${landmarkY}) to HQ`);
      return { success: true };
    } catch (error) {
      return { success: false, reason: error.message };
    }
  }

  /**
   * Check if a landmark can be converted to HQ by current player
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  canConvertToHQ(x, y) {
    if (!GameRules.ENABLE_HQ) return false;

    const currentPlayer = this._gameState.getCurrentPlayer();
    const landmark = this._gameState.getLandmarkAt(x, y);

    if (!landmark) return false;
    if (landmark.owner !== currentPlayer) return false;
    if (landmark.isHQ) return false;

    const currentHQCount = this._gameState.getPlayer(currentPlayer).headquarters;
    return currentHQCount < GameRules.MAX_HQ_PER_PLAYER;
  }

  // ===========================================================================
  // AGENTS
  // ===========================================================================

  /**
   * Spawn agents from all HQ at turn start
   * @private
   */
  _spawnAgentsFromHQ() {
    if (!GameRules.ENABLE_AGENTS) return;

    const currentPlayer = this._gameState.getCurrentPlayer();
    const landmarks = this._gameState.getLandmarks();

    for (const landmark of landmarks) {
      if (landmark.owner === currentPlayer && landmark.isHQ) {
        const agentCount = this._gameState.getPlayerAgentCount(currentPlayer);
        if (agentCount < GameRules.MAX_AGENTS_PER_PLAYER) {
          const toSpawn = Math.min(
            GameRules.AGENTS_SPAWNED_PER_HQ,
            GameRules.MAX_AGENTS_PER_PLAYER - agentCount
          );
          for (let i = 0; i < toSpawn; i++) {
            try {
              this._gameState.placeAgent(landmark.x, landmark.y, currentPlayer);
            } catch (e) {
              break; // Max reached
            }
          }
        }
      }
    }
  }

  /**
   * Try to move an agent
   * @param {number} fromX
   * @param {number} fromY
   * @param {number} toX
   * @param {number} toY
   * @returns {{success: boolean, reason?: string}}
   */
  tryMoveAgent(fromX, fromY, toX, toY) {
    if (!GameRules.ENABLE_AGENTS) {
      return { success: false, reason: 'Agents are disabled' };
    }

    const currentPlayer = this._gameState.getCurrentPlayer();

    // Check move range
    const distance = Math.abs(toX - fromX) + Math.abs(toY - fromY);
    if (distance > GameRules.AGENT_MOVEMENT_RANGE) {
      return { success: false, reason: `Agent can only move ${GameRules.AGENT_MOVEMENT_RANGE} space(s)` };
    }

    // Check for enemy agents blocking
    if (!GameRules.AGENTS_CAN_PASS_ENEMIES) {
      if (this._gameState.hasEnemyAgentsAt(toX, toY, currentPlayer)) {
        return { success: false, reason: 'Cannot move through enemy agents' };
      }
    }

    try {
      this._gameState.moveAgent(fromX, fromY, toX, toY, currentPlayer);
      console.log(`Agent moved from (${fromX}, ${fromY}) to (${toX}, ${toY})`);
      return { success: true };
    } catch (error) {
      return { success: false, reason: error.message };
    }
  }

  /**
   * Get valid move targets for an agent at a position
   * @param {number} x
   * @param {number} y
   * @returns {Array<{x: number, y: number}>}
   */
  getValidAgentMoves(x, y) {
    if (!GameRules.ENABLE_AGENTS) return [];

    const currentPlayer = this._gameState.getCurrentPlayer();
    const agents = this._gameState.getAgentsAt(x, y);

    // Check if current player has an agent here
    if (!agents.some(a => a.owner === currentPlayer)) {
      return [];
    }

    const validMoves = [];
    const directions = [
      { dx: 0, dy: -1 }, // up
      { dx: 0, dy: 1 },  // down
      { dx: -1, dy: 0 }, // left
      { dx: 1, dy: 0 },  // right
    ];

    for (const { dx, dy } of directions) {
      const newX = x + dx;
      const newY = y + dy;

      // Check bounds
      if (newX < 0 || newX >= GameRules.BOARD_SIZE || newY < 0 || newY >= GameRules.BOARD_SIZE) {
        continue;
      }

      // Check enemy blocking
      if (!GameRules.AGENTS_CAN_PASS_ENEMIES && this._gameState.hasEnemyAgentsAt(newX, newY, currentPlayer)) {
        continue;
      }

      validMoves.push({ x: newX, y: newY });
    }

    return validMoves;
  }

  /**
   * Get all agents for current player
   * @returns {Array<{x: number, y: number, count: number}>}
   */
  getCurrentPlayerAgents() {
    const currentPlayer = this._gameState.getCurrentPlayer();
    return this._gameState.getAgents().filter(a => a.owner === currentPlayer);
  }

  // ===========================================================================
  // TAKEOVER MECHANICS
  // ===========================================================================

  /**
   * Attempt to contest/capture an enemy landmark
   * @param {number} landmarkX
   * @param {number} landmarkY
   * @returns {{success: boolean, result?: string, reason?: string}}
   */
  attemptTakeover(landmarkX, landmarkY) {
    if (!GameRules.ENABLE_AGENTS) {
      return { success: false, reason: 'Agents are disabled' };
    }

    const currentPlayer = this._gameState.getCurrentPlayer();
    const landmark = this._gameState.getLandmarkAt(landmarkX, landmarkY);

    if (!landmark) {
      return { success: false, reason: 'No landmark at this position' };
    }

    if (landmark.owner === currentPlayer) {
      return { success: false, reason: 'Cannot takeover your own landmark' };
    }

    // Count agents at this landmark
    const agentsAtPosition = this._gameState.getAgentsAt(landmarkX, landmarkY);
    const myAgents = agentsAtPosition.filter(a => a.owner === currentPlayer).length;
    const enemyAgents = agentsAtPosition.filter(a => a.owner === landmark.owner).length;

    // Check if enough agents to contest
    if (myAgents < GameRules.AGENTS_TO_CONTEST) {
      return {
        success: false,
        reason: `Need ${GameRules.AGENTS_TO_CONTEST} agent(s) to contest (have ${myAgents})`
      };
    }

    // Determine outcome
    if (myAgents >= GameRules.AGENTS_TO_CAPTURE && myAgents > enemyAgents) {
      // CAPTURE: Convert enemy landmark to your HQ
      return this._executeCaptureNoteworthyLandmark(landmark, currentPlayer, myAgents, enemyAgents);
    } else if (myAgents >= GameRules.AGENTS_TO_CONTEST) {
      // CONTEST: Mark landmark as contested, battle of attrition
      return this._executeContestLandmark(landmark, currentPlayer, myAgents, enemyAgents);
    }

    return { success: false, reason: 'Not enough agents to takeover' };
  }

  /**
   * Execute settlement on a landmark/HQ takeover
   * Per rulebook: All attacking agents AND defending stack are removed.
   * The space becomes EMPTY. Both sides lose everything.
   * @private
   */
  _executeSettlement(landmark, attacker, attackerAgents, defenderAgents) {
    const defender = landmark.owner;
    const x = landmark.x;
    const y = landmark.y;
    const wasHQ = landmark.isHQ;
    const landmarkTiles = [...landmark.tiles]; // Copy tiles before removal

    // Check for Insurance Claim trigger before settlement
    const recoveredTiles = this._checkInsuranceClaimTrigger(defender, landmarkTiles);

    // Remove ALL attacker agents at this position
    for (let i = 0; i < attackerAgents; i++) {
      try {
        this._gameState.removeAgent(x, y, attacker);
      } catch (e) { break; }
    }

    // Remove ALL defender agents at this position
    for (let i = 0; i < defenderAgents; i++) {
      try {
        this._gameState.removeAgent(x, y, defender);
      } catch (e) { break; }
    }

    // Remove the landmark entirely (settlement = mutual destruction)
    this._gameState.removeLandmark(x, y);

    // Update defender's counts using setPlayerFlag pattern
    const players = this._gameState.getPlayers();
    const newLandmarkCount = players[defender].landmarks - 1;
    this._gameState.setPlayerFlag(defender, 'landmarks', newLandmarkCount);
    if (wasHQ) {
      const newHQCount = players[defender].headquarters - 1;
      this._gameState.setPlayerFlag(defender, 'headquarters', newHQCount);
    }

    this._gameState._emit(StateEvent.LANDMARK_CAPTURED, {
      x, y, attacker, defender, wasHQ, settlement: true, tilesRecovered: recoveredTiles.length
    });

    console.log(`SETTLEMENT at (${x}, ${y}): Landmark destroyed. Player ${attacker + 1} lost ${attackerAgents} agents, Player ${defender + 1} lost landmark${wasHQ ? ' (HQ)' : ''} + ${defenderAgents} agents.${recoveredTiles.length > 0 ? ` Recovered ${recoveredTiles.length} tiles via Insurance Claim.` : ''}`);

    return {
      success: true,
      result: 'settlement',
      attackerLoss: attackerAgents,
      defenderLoss: defenderAgents,
      landmarkDestroyed: true,
      tilesRecovered: recoveredTiles.length
    };
  }

  /**
   * Check if a player has Insurance Claim and trigger it
   * @private
   * @param {number} defenderIndex - Player who lost the landmark
   * @param {Array} landmarkTiles - The tiles from the lost landmark
   * @returns {Array} Tiles that were recovered (empty if no Insurance Claim)
   */
  _checkInsuranceClaimTrigger(defenderIndex, landmarkTiles) {
    const defenderEvents = this._gameState.getPlayerEvents(defenderIndex);

    // Find Insurance Claim in defender's hand
    const insuranceIndex = defenderEvents.findIndex(e => e.trigger === 'ON_LANDMARK_LOST');

    if (insuranceIndex === -1) {
      return []; // No Insurance Claim
    }

    // Trigger Insurance Claim - recover tiles to hand
    const insuranceEvent = defenderEvents[insuranceIndex];
    console.log(`Player ${defenderIndex + 1} triggers Insurance Claim!`);

    // Remove the event from hand (it's used)
    this._gameState.removeEventFromHand(defenderIndex, insuranceIndex);

    // Add landmark tiles to defender's hand
    for (const tile of landmarkTiles) {
      const recoveredTile = { ...tile };
      recoveredTile.owner = defenderIndex;
      recoveredTile.placedBy = defenderIndex;
      recoveredTile.isPartOfLandmark = false;
      this._gameState.addTileToHand(defenderIndex, recoveredTile);
    }

    console.log(`Player ${defenderIndex + 1} recovered ${landmarkTiles.length} tiles to hand via Insurance Claim`);

    // Enforce hand limit - excess tiles are discarded
    const discarded = this._enforceHandLimit(defenderIndex);
    if (discarded > 0) {
      console.log(`Player ${defenderIndex + 1} discarded ${discarded} excess tile(s) (hand limit: ${GameRules.HAND_SIZE})`);
    }

    return landmarkTiles;
  }

  /**
   * Execute a full capture of an enemy landmark (LEGACY - now uses settlement)
   * Per rulebook: Landmark/HQ takeovers always result in settlement
   * @private
   */
  _executeCaptureNoteworthyLandmark(landmark, attacker, attackerAgents, defenderAgents) {
    // Per rulebook: Landmark takeovers result in SETTLEMENT (mutual destruction)
    return this._executeSettlement(landmark, attacker, attackerAgents, defenderAgents);
  }

  /**
   * Execute contesting a landmark
   * Per rulebook: Landmark/HQ takeovers always result in settlement
   * @private
   */
  _executeContestLandmark(landmark, attacker, attackerAgents, defenderAgents) {
    // Per rulebook: Landmark takeovers result in SETTLEMENT (mutual destruction)
    return this._executeSettlement(landmark, attacker, attackerAgents, defenderAgents);
  }

  /**
   * Check if a landmark can be attacked by current player
   * @param {number} x
   * @param {number} y
   * @returns {{canAttack: boolean, myAgents: number, enemyAgents: number}}
   */
  canAttackLandmark(x, y) {
    const currentPlayer = this._gameState.getCurrentPlayer();
    const landmark = this._gameState.getLandmarkAt(x, y);

    if (!landmark || landmark.owner === currentPlayer) {
      return { canAttack: false, myAgents: 0, enemyAgents: 0 };
    }

    const agentsAtPosition = this._gameState.getAgentsAt(x, y);
    const myAgents = agentsAtPosition.filter(a => a.owner === currentPlayer).length;
    const enemyAgents = agentsAtPosition.filter(a => a.owner === landmark.owner).length;

    return {
      canAttack: myAgents >= GameRules.AGENTS_TO_CONTEST,
      myAgents,
      enemyAgents
    };
  }

  /**
   * Reposition action: Spend 1 agent to remove own basic tile and return to hand
   * Per rulebook: Cannot reposition tiles that are part of a Landmark or HQ
   * @param {number} x - Tile X position
   * @param {number} y - Tile Y position
   * @returns {{success: boolean, reason?: string}}
   */
  repositionTile(x, y) {
    if (!GameRules.ENABLE_AGENTS) {
      return { success: false, reason: 'Agents are disabled' };
    }

    const currentPlayer = this._gameState.getCurrentPlayer();
    const tile = this._gameState.getTile(x, y);

    // Validate tile exists and is owned by player
    if (!tile) {
      return { success: false, reason: 'No tile at this position' };
    }

    if (tile.placedBy !== currentPlayer) {
      return { success: false, reason: 'You can only reposition your own tiles' };
    }

    // Cannot reposition tiles that are part of landmarks
    if (tile.isPartOfLandmark) {
      return { success: false, reason: 'Cannot reposition tiles that are part of a Landmark' };
    }

    // Check for agent at or adjacent to position
    const agentsAtPosition = this._gameState.getAgentsAt(x, y);
    const myAgentsHere = agentsAtPosition.filter(a => a.owner === currentPlayer);

    // Also check adjacent positions for agents
    const adjacentPositions = [
      { x: x - 1, y }, { x: x + 1, y },
      { x, y: y - 1 }, { x, y: y + 1 }
    ];

    let agentSource = null;
    if (myAgentsHere.length > 0) {
      agentSource = { x, y };
    } else {
      for (const pos of adjacentPositions) {
        const adjAgents = this._gameState.getAgentsAt(pos.x, pos.y);
        if (adjAgents.some(a => a.owner === currentPlayer)) {
          agentSource = pos;
          break;
        }
      }
    }

    if (!agentSource) {
      return { success: false, reason: 'Need an agent at or adjacent to tile to reposition' };
    }

    // Execute reposition: remove agent, remove tile, add tile to hand
    this._gameState.removeAgent(agentSource.x, agentSource.y, currentPlayer);
    const removedTile = this._gameState.removeTile(x, y);
    this._gameState.addTileToHand(currentPlayer, removedTile);

    console.log(`Player ${currentPlayer + 1} repositioned tile at (${x}, ${y}) back to hand (spent 1 agent)`);

    // Enforce hand limit
    const discarded = this._enforceHandLimit(currentPlayer);
    if (discarded > 0) {
      console.log(`Player ${currentPlayer + 1} discarded ${discarded} excess tile(s) (hand limit: ${GameRules.HAND_SIZE})`);
    }

    return { success: true, tile: removedTile };
  }

  /**
   * Attempt to capture an opponent's basic tile (not landmark)
   * Per rulebook: Agents = stack height captures tile, agents discarded
   * @param {number} x - Tile X position
   * @param {number} y - Tile Y position
   * @returns {{success: boolean, reason?: string}}
   */
  attemptTileCapture(x, y) {
    if (!GameRules.ENABLE_AGENTS) {
      return { success: false, reason: 'Agents are disabled' };
    }

    const currentPlayer = this._gameState.getCurrentPlayer();
    const tile = this._gameState.getTile(x, y);

    // Validate tile
    if (!tile) {
      return { success: false, reason: 'No tile at this position' };
    }

    if (tile.placedBy === currentPlayer) {
      return { success: false, reason: 'Cannot capture your own tile' };
    }

    if (tile.isPartOfLandmark) {
      return { success: false, reason: 'Use landmark takeover for landmarks' };
    }

    // Check for adjacent attacker agents
    const adjacentPositions = [
      { x: x - 1, y }, { x: x + 1, y },
      { x, y: y - 1 }, { x, y: y + 1 }
    ];

    let attackerAgentCount = 0;
    let attackerPositions = [];

    for (const pos of adjacentPositions) {
      const agents = this._gameState.getAgentsAt(pos.x, pos.y);
      const myAgents = agents.filter(a => a.owner === currentPlayer);
      if (myAgents.length > 0) {
        attackerAgentCount += myAgents.length;
        attackerPositions.push({ ...pos, count: myAgents.length });
      }
    }

    // Count defending agents on the tile
    const defendingAgents = this._gameState.getAgentsAt(x, y)
      .filter(a => a.owner === tile.placedBy).length;

    // Stack height = 1 (tile) + defending agents
    const stackHeight = 1 + defendingAgents;

    if (attackerAgentCount < stackHeight) {
      return {
        success: false,
        reason: `Need ${stackHeight} agent(s) to capture (have ${attackerAgentCount} adjacent)`
      };
    }

    // Execute capture: remove attacking agents, remove defending agents, transfer ownership
    let agentsUsed = 0;
    for (const pos of attackerPositions) {
      for (let i = 0; i < pos.count && agentsUsed < stackHeight; i++) {
        this._gameState.removeAgent(pos.x, pos.y, currentPlayer);
        agentsUsed++;
      }
    }

    // Remove defending agents
    const originalOwner = tile.placedBy;
    for (let i = 0; i < defendingAgents; i++) {
      try {
        this._gameState.removeAgent(x, y, originalOwner);
      } catch (e) { break; }
    }

    // Transfer tile ownership
    this._gameState.updateTileOwnership(x, y, currentPlayer);

    console.log(`Player ${currentPlayer + 1} captured tile at (${x}, ${y}) from Player ${originalOwner + 1} (used ${agentsUsed} agents)`);

    return {
      success: true,
      result: 'capture',
      agentsUsed,
      defendingAgentsRemoved: defendingAgents
    };
  }

  /**
   * Handle turn end (classic mode)
   * @private
   */
  _handleEndTurn() {
    this._gameState.endTurn();
    return { action: 'endTurn', nextPlayer: this._gameState.getCurrentPlayer() };
  }

  /**
   * Check if player is an underdog (tied for fewest landmarks)
   * @private
   */
  _isUnderdog(playerIndex) {
    if (!GameRules.UNDERDOG_BONUS_ENABLED) return false;

    const players = this._gameState.getPlayers();
    const currentPlayerLandmarks = players[playerIndex].landmarks - players[playerIndex].headquarters;

    // Find minimum landmark count (non-HQ) among all players
    const minLandmarks = Math.min(
      ...players.map(p => p.landmarks - p.headquarters)
    );

    // Player is underdog if tied for minimum
    return currentPlayerLandmarks === minLandmarks;
  }

  /**
   * Calculate draw count for a player
   * Per rulebook: 1 base + landmarks owned + underdog bonus
   * @private
   */
  _calculateDrawCount(playerIndex) {
    if (GameRules.LANDMARK_DRAW_BONUS) {
      const player = this._gameState.getPlayer(playerIndex);
      // Per rulebook: draw 1 + number of non-HQ landmarks owned
      const nonHQLandmarks = player.landmarks - player.headquarters;
      let drawCount = 1 + nonHQLandmarks;

      // Per rulebook: +1 if player has fewest landmarks (underdog rule)
      if (this._isUnderdog(playerIndex)) {
        drawCount += 1;
        console.log(`Player ${playerIndex + 1} gets underdog bonus (+1 draw)`);
      }

      return drawCount;
    }

    // Default: use getTilesToDraw (refill mode)
    const currentHandSize = this._gameState.getPlayerHand(playerIndex).length;
    return getTilesToDraw(currentHandSize);
  }

  /**
   * End turn and refill hand (simple mode)
   * Enforces max hand size - excess tiles are discarded
   */
  endTurnWithRefill() {
    // Reset combo state at turn end
    this.resetComboState();

    const currentPlayer = this._gameState.getCurrentPlayer();
    const tilesToDraw = this._calculateDrawCount(currentPlayer);

    // Draw tiles
    let drawnCount = 0;
    for (let i = 0; i < tilesToDraw; i++) {
      const tile = this._gameState.drawTile();
      if (tile) {
        tile.owner = currentPlayer;
        this._gameState.addTileToHand(currentPlayer, tile);
        drawnCount++;
      }
    }

    console.log(`Player ${currentPlayer + 1} drew ${drawnCount} tile(s)`);

    // Enforce max hand size - discard excess tiles
    const discarded = this._enforceHandLimit(currentPlayer);
    if (discarded > 0) {
      console.log(`Player ${currentPlayer + 1} discarded ${discarded} excess tile(s) (hand limit: ${GameRules.HAND_SIZE})`);
    }

    this._gameState.endTurn();

    // Spawn agents for new player (simple mode)
    this._spawnAgentsFromHQ();
  }

  /**
   * Enforce the maximum hand size by discarding excess tiles
   * Tiles are discarded from the end of the hand (most recently drawn)
   * @param {number} playerIndex
   * @returns {number} Number of tiles discarded
   * @private
   */
  _enforceHandLimit(playerIndex) {
    const hand = this._gameState.getPlayerHand(playerIndex);
    let discarded = 0;

    while (hand.length > GameRules.HAND_SIZE) {
      // Discard from end (most recently drawn)
      const tileIndex = hand.length - 1;
      const discardedTile = this._gameState.removeTileFromHand(playerIndex, tileIndex);
      if (discardedTile) {
        discarded++;
        // Refresh hand reference after removal
        hand.pop();
      } else {
        break;
      }
    }

    return discarded;
  }

  // ===========================================================================
  // GAME SETUP
  // ===========================================================================

  /**
   * Start a new game
   * @param {number} playerCount - Number of players (defaults to GameRules setting)
   * @returns {GameState} The new game state
   */
  startNewGame(playerCount = GameRules.PLAYER_COUNT) {
    // Create fresh game state
    const gameState = new GameState(playerCount);
    this._gameState = gameState;

    // Create draw pile (shuffle if enabled)
    const drawPile = this._createDrawPile();
    gameState.initDrawPile(drawPile);
    if (GameRules.ENABLE_SHUFFLE) {
      gameState.shuffleDrawPile();
    } else {
      console.log('[GameController] Shuffle disabled - tiles dealt in creation order');
    }

    // Create event pile (shuffle if enabled)
    const eventDeck = createEventDeck();
    if (GameRules.ENABLE_SHUFFLE) {
      shuffleArray(eventDeck);
    }
    gameState.initEventPile(eventDeck);

    // Determine starting player (before dealing hands so tiles go back to pile)
    const startingPlayer = this._determineStartingPlayer(gameState, playerCount);
    gameState.setCurrentPlayer(startingPlayer);

    // Deal starting hands
    this._dealStartingHands(gameState, playerCount);

    // Deal starting events (2 per player, with draft if enabled)
    this._dealStartingEvents(gameState, playerCount);

    // Set game phase
    gameState.setPhase('playing');
    gameState.setTurnNumber(1);
    gameState.setTurnPhase(isSimpleTurnMode() ? TurnPhase.PLACE : TurnPhase.DRAW);

    console.log('=== New Game Started ===');
    console.log(`Players: ${playerCount}`);
    console.log(`Mode: ${GameRules.TURN_MODE} (${GameRules.TILES_PER_TURN} tile(s) per turn)`);
    console.log(`Starting player: Player ${startingPlayer + 1}`);
    console.log(`Draw pile: ${gameState.getDrawPileCount()} tiles`);
    console.log(`Event pile: ${gameState.getEventPileCount()} events`);

    return gameState;
  }

  /**
   * Create the draw pile
   * @private
   */
  _createDrawPile() {
    const drawPile = [];
    for (let i = 0; i < GameRules.TILES_PER_TYPE; i++) {
      drawPile.push(createTile(TileType.HOUSING, null));
      drawPile.push(createTile(TileType.COMMERCE, null));
      drawPile.push(createTile(TileType.INDUSTRY, null));
    }
    return drawPile;
  }

  /**
   * Deal starting hands to all players
   * @private
   * @param {GameState} gameState
   * @param {number} playerCount
   */
  _dealStartingHands(gameState, playerCount) {
    for (let player = 0; player < playerCount; player++) {
      for (let i = 0; i < GameRules.HAND_SIZE; i++) {
        const tile = gameState.drawTile();
        if (tile) {
          tile.owner = player;
          gameState.addTileToHand(player, tile);
        }
      }
    }
  }

  /**
   * Deal starting events to all players
   * If ENABLE_EVENT_DRAFT is true, uses draft system (deal 2, keep 1, pass 1)
   * @private
   * @param {GameState} gameState
   * @param {number} playerCount
   */
  _dealStartingEvents(gameState, playerCount) {
    if (GameRules.ENABLE_EVENT_DRAFT) {
      this._executeEventDraft(gameState, playerCount);
    } else {
      // Simple mode: just deal 2 events per player
      const STARTING_EVENTS = 2;
      for (let player = 0; player < playerCount; player++) {
        for (let i = 0; i < STARTING_EVENTS; i++) {
          gameState.drawEventToHand(player);
        }
      }
    }
  }

  /**
   * Execute the event draft system per rulebook:
   * Deal 2 to each player, keep 1, pass 1 left, keep passed card
   * @private
   */
  _executeEventDraft(gameState, playerCount) {
    // Deal 2 events to each player temporarily
    const playerEvents = [];
    for (let player = 0; player < playerCount; player++) {
      const events = [];
      for (let i = 0; i < 2; i++) {
        const event = gameState.drawEvent();
        if (event) events.push(event);
      }
      playerEvents.push(events);
    }

    // For automatic draft: player keeps first card, passes second to left
    // In a full implementation, UI would let player choose which to keep
    for (let player = 0; player < playerCount; player++) {
      const events = playerEvents[player];
      if (events.length >= 1) {
        // Keep first event
        gameState._state.players[player].events.push(events[0]);
      }
    }

    // Pass second card to player on left (next player index)
    for (let player = 0; player < playerCount; player++) {
      const events = playerEvents[player];
      if (events.length >= 2) {
        // Pass to player on left (next player)
        const targetPlayer = (player + 1) % playerCount;
        gameState._state.players[targetPlayer].events.push(events[1]);
      }
    }

    console.log(`Event draft complete: each player kept 1, passed 1 left`);
  }

  /**
   * Get tile rank for starting player comparison
   * Housing = 3 (highest), Commerce = 2, Industry = 1 (lowest)
   * @private
   */
  _getTileRank(type) {
    if (type === TileType.HOUSING) return 3;
    if (type === TileType.COMMERCE) return 2;
    return 1; // Industry
  }

  /**
   * Determine starting player per rulebook:
   * Each player draws a tile, H > C > I. Tied players draw again.
   * All drawn tiles go to bottom of D. Stack.
   * Emits events for UI animation.
   * @private
   * @returns {number} Starting player index
   */
  _determineStartingPlayer(gameState, playerCount) {
    if (!GameRules.RULEBOOK_STARTING_PLAYER) {
      const winner = Math.floor(Math.random() * playerCount);
      gameState._emit(StateEvent.STARTING_PLAYER_DETERMINED, {
        winner,
        method: 'random'
      });
      return winner;
    }

    const drawnTiles = []; // Track all drawn tiles to return to bottom
    let contenders = Array.from({ length: playerCount }, (_, i) => i);
    let roundNumber = 0;

    while (contenders.length > 1) {
      roundNumber++;
      const draws = [];

      // Emit round start event
      gameState._emit(StateEvent.STARTING_PLAYER_DRAW_START, {
        round: roundNumber,
        contenders: [...contenders]
      });

      // Each contender draws a tile
      for (const player of contenders) {
        const tile = gameState.drawTile();
        if (tile) {
          const rank = this._getTileRank(tile.type);
          draws.push({ player, tile, rank });
          drawnTiles.push(tile);

          // Emit per-tile draw event
          gameState._emit(StateEvent.STARTING_PLAYER_TILE_DRAWN, {
            player,
            tile: { type: tile.type },
            rank,
            round: roundNumber
          });
        }
      }

      // Emit reveal event with all draws
      gameState._emit(StateEvent.STARTING_PLAYER_REVEAL, {
        round: roundNumber,
        draws: draws.map(d => ({
          player: d.player,
          tileType: d.tile.type,
          rank: d.rank
        }))
      });

      // Find highest rank among draws
      let maxRank = 0;
      for (const draw of draws) {
        if (draw.rank > maxRank) maxRank = draw.rank;
      }

      // Filter to only those with highest rank
      const previousContenders = [...contenders];
      contenders = draws
        .filter(d => d.rank === maxRank)
        .map(d => d.player);

      // Emit compare event
      gameState._emit(StateEvent.STARTING_PLAYER_COMPARE, {
        round: roundNumber,
        draws: draws.map(d => ({
          player: d.player,
          tileType: d.tile.type,
          rank: d.rank
        })),
        maxRank,
        winners: [...contenders]
      });

      if (contenders.length > 1) {
        console.log(`Starting player tie! ${contenders.length} players draw again...`);
        // Emit tie event
        gameState._emit(StateEvent.STARTING_PLAYER_TIE, {
          round: roundNumber,
          tiedPlayers: [...contenders]
        });
      }
    }

    // Return all drawn tiles to bottom of draw pile
    gameState.addTilesToDrawPileBottom(drawnTiles);

    const winner = contenders[0] ?? 0;
    console.log(`Starting player determined: Player ${winner + 1} (drew highest tile)`);

    // Emit final determination event
    gameState._emit(StateEvent.STARTING_PLAYER_DETERMINED, {
      winner,
      totalRounds: roundNumber,
      method: 'tile-draw'
    });

    return winner;
  }

  /**
   * Request a mulligan for a player
   * Per rulebook: shuffle hand back, draw new tiles, once per player
   * NOTE: Requires ENABLE_SHUFFLE to be true (mulligan needs shuffling)
   * @param {number} playerIndex
   * @returns {{success: boolean, reason?: string}}
   */
  requestMulligan(playerIndex) {
    if (!GameRules.ENABLE_MULLIGAN) {
      return { success: false, reason: 'Mulligan is disabled' };
    }

    if (!GameRules.ENABLE_SHUFFLE) {
      return { success: false, reason: 'Mulligan requires shuffling to be enabled' };
    }

    const player = this._gameState.getPlayer(playerIndex);
    if (this._gameState.getPlayerFlag(playerIndex, 'usedMulligan')) {
      return { success: false, reason: 'Player has already used their mulligan' };
    }

    // Get current hand
    const hand = this._gameState.getPlayerHand(playerIndex);

    // Return all tiles to draw pile (shuffle them in)
    for (const tile of hand) {
      this._gameState.addTileToDrawPileBottom(tile);
    }

    // Clear hand
    while (this._gameState.getPlayerHand(playerIndex).length > 0) {
      this._gameState.removeTileFromHand(playerIndex, 0);
    }

    // Shuffle draw pile
    this._gameState.shuffleDrawPile();

    // Draw new tiles up to hand size
    for (let i = 0; i < GameRules.HAND_SIZE; i++) {
      const tile = this._gameState.drawTile();
      if (tile) {
        tile.owner = playerIndex;
        this._gameState.addTileToHand(playerIndex, tile);
      }
    }

    // Mark mulligan as used
    this._gameState.setPlayerFlag(playerIndex, 'usedMulligan', true);

    console.log(`Player ${playerIndex + 1} used their mulligan`);
    return { success: true };
  }

  /**
   * Check if a player can mulligan
   * @param {number} playerIndex
   * @returns {boolean}
   */
  canMulligan(playerIndex) {
    if (!GameRules.ENABLE_MULLIGAN) return false;
    if (!GameRules.ENABLE_SHUFFLE) return false; // Mulligan requires shuffle
    return !this._gameState.getPlayerFlag(playerIndex, 'usedMulligan');
  }

  /**
   * Get all players' hands (for open hand display)
   * @returns {Array<{playerIndex: number, hand: Array}>}
   */
  getAllPlayersHands() {
    if (!GameRules.OPEN_HANDS) {
      // Only return current player's hand
      const current = this._gameState.getCurrentPlayer();
      return [{
        playerIndex: current,
        hand: this._gameState.getPlayerHand(current)
      }];
    }

    // Return all hands (open information)
    const players = this._gameState.getPlayers();
    return players.map((_, i) => ({
      playerIndex: i,
      hand: this._gameState.getPlayerHand(i)
    }));
  }

  /**
   * Check if a tile/landmark is secured (has defending agents)
   * @param {number} x
   * @param {number} y
   * @returns {{secured: boolean, agentCount: number, owner: number}}
   */
  isPositionSecured(x, y) {
    const tile = this._gameState.getTile(x, y);
    const landmark = this._gameState.getLandmarkAt(x, y);
    const owner = tile?.placedBy ?? landmark?.owner ?? -1;

    if (owner === -1) {
      return { secured: false, agentCount: 0, owner: -1 };
    }

    const agents = this._gameState.getAgentsAt(x, y);
    const friendlyAgents = agents.filter(a => a.owner === owner).length;

    return {
      secured: friendlyAgents > 0,
      agentCount: friendlyAgents,
      owner
    };
  }

  /**
   * Get all secured positions for rendering
   * @returns {Array<{x: number, y: number, owner: number, agentCount: number}>}
   */
  getSecuredPositions() {
    const secured = [];
    const agents = this._gameState.getAgents();

    // Group agents by position
    const positionAgents = new Map();
    for (const agent of agents) {
      const key = `${agent.x},${agent.y}`;
      if (!positionAgents.has(key)) {
        positionAgents.set(key, { x: agent.x, y: agent.y, agentsByOwner: {} });
      }
      // agent has { x, y, owner, count } structure
      const existing = positionAgents.get(key).agentsByOwner[agent.owner] || 0;
      positionAgents.get(key).agentsByOwner[agent.owner] = existing + agent.count;
    }

    // Check each position with agents
    for (const [key, data] of positionAgents) {
      const tile = this._gameState.getTile(data.x, data.y);
      const landmark = this._gameState.getLandmarkAt(data.x, data.y);
      const owner = tile?.placedBy ?? landmark?.owner;

      if (owner !== undefined && data.agentsByOwner[owner]) {
        secured.push({
          x: data.x,
          y: data.y,
          owner,
          agentCount: data.agentsByOwner[owner]
        });
      }
    }

    return secured;
  }

  // ===========================================================================
  // EVENT CARDS
  // ===========================================================================

  /**
   * Play an event card from current player's hand
   * @param {number} eventIndex - Index in player's event hand
   * @param {Object} target - Target data (position, player, etc.)
   * @returns {{success: boolean, reason?: string, effect?: Object}}
   */
  playEventCard(eventIndex, target = null) {
    const currentPlayer = this._gameState.getCurrentPlayer();
    const events = this._gameState.getPlayerEvents(currentPlayer);

    if (eventIndex < 0 || eventIndex >= events.length) {
      return { success: false, reason: 'Invalid event index' };
    }

    const event = events[eventIndex];

    // Check if target is required
    if (eventRequiresTarget(event) && !target) {
      return { success: false, reason: 'This event requires a target' };
    }

    // Execute the event effect
    const result = this._executeEventEffect(event, currentPlayer, target);

    if (result.success) {
      // Remove event from hand
      this._gameState.playEvent(currentPlayer, eventIndex, target);
      console.log(`Player ${currentPlayer + 1} played: ${event.name}`);
    }

    return result;
  }

  /**
   * Execute an event card's effect
   * @private
   */
  _executeEventEffect(event, player, target) {
    switch (event.effect) {
      case 'DRAW_TILES':
        return this._effectDrawTiles(player, event.effectParams.count);

      case 'DRAW_EVENTS':
        return this._effectDrawEvents(player, event.effectParams.count);

      case 'DISCARD_TO_HAND_SIZE':
        return this._effectDiscardToHandSize(target.player, event.effectParams.handSize);

      case 'RETURN_TILE_TO_HAND':
        return this._effectReturnTileToHand(player, target);

      case 'REMOVE_TILE':
        return this._effectRemoveTile(target);

      case 'SKIP_AGENT_PHASE':
        return this._effectSkipPhase(target.player, 'agent');

      case 'SKIP_DEVELOP_PHASE':
        return this._effectSkipPhase(target.player, 'develop');

      case 'SPAWN_AGENT':
        return this._effectSpawnAgent(player, target);

      case 'STEAL_TILE_TO_HAND':
        return this._effectStealTileToHand(player, target);

      case 'CHANGE_TILE_TYPE':
        return this._effectChangeTileType(player, target, event.effectParams);

      case 'MOVE_OWN_TILE':
        return this._effectMoveOwnTile(player, target);

      case 'IGNORE_ADJACENCY':
        return this._effectIgnoreAdjacency(player);

      case 'SWAP_TILES':
        return this._effectSwapTiles(player, target);

      case 'CHANGE_OPPONENT_TILE_TYPE':
        return this._effectChangeOpponentTileType(player, target, event.effectParams);

      case 'MOVE_OPPONENT_AGENT':
        return this._effectMoveOpponentAgent(player, target);

      case 'FREE_CAPTURE':
        return this._effectFreeCapture(player, target);

      case 'PEEK_AND_REORDER_DECK':
        return this._effectPeekAndReorderDeck(player, event.effectParams);

      case 'VIEW_HIDDEN_INFO':
        return this._effectViewHiddenInfo(player, target, event.effectParams);

      default:
        console.log(`Unimplemented event effect: ${event.effect}`);
        return { success: true, message: 'Effect not yet implemented' };
    }
  }

  /**
   * Effect: Draw tiles
   * Enforces hand limit - excess tiles are discarded
   * @private
   */
  _effectDrawTiles(player, count) {
    let drawn = 0;
    for (let i = 0; i < count; i++) {
      const tile = this._gameState.drawTile();
      if (tile) {
        tile.owner = player;
        this._gameState.addTileToHand(player, tile);
        drawn++;
      }
    }

    // Enforce hand limit
    const discarded = this._enforceHandLimit(player);
    if (discarded > 0) {
      console.log(`Player ${player + 1} discarded ${discarded} excess tile(s) (hand limit: ${GameRules.HAND_SIZE})`);
    }

    return { success: true, drawn, discarded };
  }

  /**
   * Effect: Draw event cards
   * @private
   */
  _effectDrawEvents(player, count) {
    let drawn = 0;
    for (let i = 0; i < count; i++) {
      if (this._gameState.drawEventToHand(player)) {
        drawn++;
      }
    }
    return { success: true, drawn };
  }

  /**
   * Effect: Force discard to hand size
   * @private
   */
  _effectDiscardToHandSize(player, handSize) {
    const hand = this._gameState.getPlayerHand(player);
    const toDiscard = hand.length - handSize;
    // Note: In full implementation, player would choose which to discard
    for (let i = 0; i < toDiscard && i >= 0; i++) {
      this._gameState.removeTileFromHand(player, 0);
    }
    return { success: true, discarded: Math.max(0, toDiscard) };
  }

  /**
   * Effect: Return tile to hand
   * Enforces hand limit - excess tiles are discarded
   * @private
   */
  _effectReturnTileToHand(player, target) {
    const tile = this._gameState.getTile(target.x, target.y);
    if (!tile || tile.placedBy !== player) {
      return { success: false, reason: 'Invalid tile target' };
    }
    this._gameState.removeTile(target.x, target.y);
    this._gameState.addTileToHand(player, tile);

    // Enforce hand limit
    const discarded = this._enforceHandLimit(player);
    if (discarded > 0) {
      console.log(`Player ${player + 1} discarded ${discarded} excess tile(s) (hand limit: ${GameRules.HAND_SIZE})`);
    }

    return { success: true };
  }

  /**
   * Effect: Remove tile from board
   * @private
   */
  _effectRemoveTile(target) {
    const tile = this._gameState.getTile(target.x, target.y);
    if (!tile) {
      return { success: false, reason: 'No tile at target' };
    }
    this._gameState.removeTile(target.x, target.y);
    return { success: true };
  }

  /**
   * Effect: Skip a phase
   * @private
   */
  _effectSkipPhase(player, phase) {
    if (phase === 'agent') {
      this._gameState.setPlayerFlag(player, 'skipNextAgentPhase', true);
    } else if (phase === 'develop') {
      this._gameState.setPlayerFlag(player, 'skipNextDevelopPhase', true);
    }
    return { success: true };
  }

  /**
   * Effect: Spawn an agent
   * @private
   */
  _effectSpawnAgent(player, target) {
    try {
      this._gameState.placeAgent(target.x, target.y, player);
      return { success: true };
    } catch (e) {
      return { success: false, reason: e.message };
    }
  }

  /**
   * Effect: Steal opponent's tile and add to your hand (Hostile Acquisition)
   * @private
   */
  _effectStealTileToHand(player, target) {
    const tile = this._gameState.getTile(target.x, target.y);
    if (!tile) {
      return { success: false, reason: 'No tile at target' };
    }
    if (tile.placedBy === player) {
      return { success: false, reason: 'Cannot steal your own tile' };
    }
    if (tile.isPartOfLandmark) {
      return { success: false, reason: 'Cannot steal tiles that are part of a landmark' };
    }

    const removedTile = this._gameState.removeTile(target.x, target.y);
    removedTile.owner = player;
    removedTile.placedBy = player;
    this._gameState.addTileToHand(player, removedTile);

    console.log(`Player ${player + 1} stole tile from (${target.x}, ${target.y})`);

    // Enforce hand limit
    const discarded = this._enforceHandLimit(player);
    if (discarded > 0) {
      console.log(`Player ${player + 1} discarded ${discarded} excess tile(s) (hand limit: ${GameRules.HAND_SIZE})`);
    }

    return { success: true };
  }

  /**
   * Effect: Change one of your tiles to a different type (Conversion Permit)
   * @private
   */
  _effectChangeTileType(player, target, params) {
    const tile = this._gameState.getTile(target.x, target.y);
    if (!tile) {
      return { success: false, reason: 'No tile at target' };
    }
    if (tile.placedBy !== player) {
      return { success: false, reason: 'Can only change your own tiles' };
    }
    if (tile.isPartOfLandmark) {
      return { success: false, reason: 'Cannot change tiles that are part of a landmark' };
    }

    const newType = target.newType || params?.newType;
    if (!newType) {
      return { success: false, reason: 'No new tile type specified' };
    }

    // Update tile type directly in the map
    const key = `${target.x},${target.y}`;
    const actualTile = this._gameState._state.board.tiles.get(key);
    if (actualTile) {
      const oldType = actualTile.type;
      actualTile.type = newType;
      console.log(`Player ${player + 1} changed tile at (${target.x}, ${target.y}) from ${oldType} to ${newType}`);
    }

    return { success: true };
  }

  /**
   * Effect: Move one of your tiles to an adjacent empty space (Urban Renewal)
   * @private
   */
  _effectMoveOwnTile(player, target) {
    const tile = this._gameState.getTile(target.fromX, target.fromY);
    if (!tile) {
      return { success: false, reason: 'No tile at source position' };
    }
    if (tile.placedBy !== player) {
      return { success: false, reason: 'Can only move your own tiles' };
    }
    if (tile.isPartOfLandmark) {
      return { success: false, reason: 'Cannot move tiles that are part of a landmark' };
    }

    // Check destination is empty
    if (this._gameState.getTile(target.toX, target.toY)) {
      return { success: false, reason: 'Destination is not empty' };
    }

    // Check destination is adjacent
    const dx = Math.abs(target.toX - target.fromX);
    const dy = Math.abs(target.toY - target.fromY);
    if (dx + dy !== 1) {
      return { success: false, reason: 'Destination must be adjacent' };
    }

    const removedTile = this._gameState.removeTile(target.fromX, target.fromY);
    this._gameState.placeTile(target.toX, target.toY, removedTile);

    console.log(`Player ${player + 1} moved tile from (${target.fromX}, ${target.fromY}) to (${target.toX}, ${target.toY})`);
    return { success: true };
  }

  /**
   * Effect: Next tile placement ignores adjacency rules (Shell Company)
   * @private
   */
  _effectIgnoreAdjacency(player) {
    this._gameState.setPlayerFlag(player, 'ignoreAdjacencyNextTile', true);
    console.log(`Player ${player + 1} can place next tile anywhere (Shell Company)`);
    return { success: true };
  }

  /**
   * Effect: Swap your tile with an adjacent opponent tile (Backroom Deal)
   * @private
   */
  _effectSwapTiles(player, target) {
    const myTile = this._gameState.getTile(target.myX, target.myY);
    const theirTile = this._gameState.getTile(target.theirX, target.theirY);

    if (!myTile || !theirTile) {
      return { success: false, reason: 'Both tiles must exist' };
    }
    if (myTile.placedBy !== player) {
      return { success: false, reason: 'First tile must be yours' };
    }
    if (theirTile.placedBy === player) {
      return { success: false, reason: 'Second tile must be opponent\'s' };
    }
    if (myTile.isPartOfLandmark || theirTile.isPartOfLandmark) {
      return { success: false, reason: 'Cannot swap landmark tiles' };
    }

    // Check adjacency
    const dx = Math.abs(target.myX - target.theirX);
    const dy = Math.abs(target.myY - target.theirY);
    if (dx + dy !== 1) {
      return { success: false, reason: 'Tiles must be adjacent' };
    }

    // Swap tiles
    const removedMine = this._gameState.removeTile(target.myX, target.myY);
    const removedTheirs = this._gameState.removeTile(target.theirX, target.theirY);

    this._gameState.placeTile(target.myX, target.myY, removedTheirs);
    this._gameState.placeTile(target.theirX, target.theirY, removedMine);

    console.log(`Player ${player + 1} swapped tiles at (${target.myX}, ${target.myY}) and (${target.theirX}, ${target.theirY})`);
    return { success: true };
  }

  /**
   * Effect: Change an opponent's tile to a different type (Hostile Rezoning)
   * @private
   */
  _effectChangeOpponentTileType(player, target, params) {
    const tile = this._gameState.getTile(target.x, target.y);
    if (!tile) {
      return { success: false, reason: 'No tile at target' };
    }
    if (tile.placedBy === player) {
      return { success: false, reason: 'Must target opponent\'s tile' };
    }
    if (tile.isPartOfLandmark) {
      return { success: false, reason: 'Cannot change landmark tiles' };
    }

    const newType = target.newType || params?.newType;
    if (!newType) {
      return { success: false, reason: 'No new tile type specified' };
    }

    const key = `${target.x},${target.y}`;
    const actualTile = this._gameState._state.board.tiles.get(key);
    if (actualTile) {
      const oldType = actualTile.type;
      actualTile.type = newType;
      console.log(`Player ${player + 1} changed opponent's tile at (${target.x}, ${target.y}) from ${oldType} to ${newType}`);
    }

    return { success: true };
  }

  /**
   * Effect: Move one opponent agent to an adjacent space (Double Agent)
   * @private
   */
  _effectMoveOpponentAgent(player, target) {
    const agents = this._gameState.getAgentsAt(target.fromX, target.fromY);
    const opponentAgent = agents.find(a => a.owner !== player);

    if (!opponentAgent) {
      return { success: false, reason: 'No opponent agent at source' };
    }

    // Check destination is adjacent
    const dx = Math.abs(target.toX - target.fromX);
    const dy = Math.abs(target.toY - target.fromY);
    if (dx + dy !== 1) {
      return { success: false, reason: 'Destination must be adjacent' };
    }

    this._gameState.moveAgent(target.fromX, target.fromY, target.toX, target.toY, opponentAgent.owner);

    console.log(`Player ${player + 1} moved opponent's agent from (${target.fromX}, ${target.fromY}) to (${target.toX}, ${target.toY})`);
    return { success: true };
  }

  /**
   * Effect: Capture adjacent opponent tile without spending agents (Hostile Expansion)
   * @private
   */
  _effectFreeCapture(player, target) {
    const tile = this._gameState.getTile(target.x, target.y);
    if (!tile) {
      return { success: false, reason: 'No tile at target' };
    }
    if (tile.placedBy === player) {
      return { success: false, reason: 'Must target opponent\'s tile' };
    }
    if (tile.isPartOfLandmark) {
      return { success: false, reason: 'Cannot capture landmark tiles with this effect' };
    }

    // Transfer ownership
    this._gameState.updateTileOwnership(target.x, target.y, player);

    // Remove any defending agents
    const agents = this._gameState.getAgentsAt(target.x, target.y);
    for (const agent of agents) {
      if (agent.owner !== player) {
        this._gameState.removeAgent(target.x, target.y, agent.owner);
      }
    }

    console.log(`Player ${player + 1} captured tile at (${target.x}, ${target.y}) for free`);
    return { success: true };
  }

  /**
   * Effect: Peek at top tiles of draw pile and optionally reorder (Insider Trading)
   * @private
   */
  _effectPeekAndReorderDeck(player, params) {
    const count = params?.count || 5;
    const peekedTiles = this._gameState.peekDrawPile(count);

    // For now, just log what was seen - full implementation would need UI for reordering
    console.log(`Player ${player + 1} peeked at top ${peekedTiles.length} tiles:`, peekedTiles.map(t => t.type));

    // If a new order is provided, apply it
    if (params?.newOrder && Array.isArray(params.newOrder)) {
      this._gameState.reorderDrawPile(params.newOrder);
    }

    return { success: true, peekedTiles };
  }

  /**
   * Effect: View opponent's events and top of draw pile (Stakeout)
   * @private
   */
  _effectViewHiddenInfo(player, target, params) {
    const opponentIndex = target?.player ?? target?.playerId;
    const deckPeekCount = params?.deckPeekCount || 3;

    const result = { success: true };

    // Get opponent's events if targeting a player
    if (opponentIndex !== undefined && opponentIndex !== player) {
      result.opponentEvents = this._gameState.getPlayerEvents(opponentIndex);
      console.log(`Player ${player + 1} viewed Player ${opponentIndex + 1}'s events:`, result.opponentEvents.map(e => e.name));
    }

    // Peek at draw pile
    result.topTiles = this._gameState.peekDrawPile(deckPeekCount);
    console.log(`Player ${player + 1} peeked at top ${result.topTiles.length} tiles:`, result.topTiles.map(t => t.type));

    return result;
  }

  /**
   * Get current player's event cards
   * @returns {Array}
   */
  getCurrentPlayerEvents() {
    const currentPlayer = this._gameState.getCurrentPlayer();
    return this._gameState.getPlayerEvents(currentPlayer);
  }

  /**
   * Get valid targets for an event based on its targetFilter
   * @param {Object} event - The event card
   * @returns {Array<{x: number, y: number, type: string, data?: Object}>}
   */
  getValidTargetsForEvent(event) {
    const currentPlayer = this._gameState.getCurrentPlayer();
    const validTargets = [];

    switch (event.targetFilter) {
      case 'OWN_TILES':
        // Get all tiles owned by current player (not part of landmarks)
        for (const { x, y, tile } of this._gameState.getAllTiles()) {
          if (tile.placedBy === currentPlayer && !tile.isPartOfLandmark) {
            validTargets.push({ x, y, type: 'tile', data: tile });
          }
        }
        break;

      case 'OPPONENT_TILES':
        // Get all tiles owned by opponents (not part of landmarks)
        for (const { x, y, tile } of this._gameState.getAllTiles()) {
          if (tile.placedBy !== currentPlayer && !tile.isPartOfLandmark) {
            validTargets.push({ x, y, type: 'tile', data: tile });
          }
        }
        break;

      case 'NOT_LANDMARK':
        // Get all basic tiles (not part of landmarks)
        for (const { x, y, tile } of this._gameState.getAllTiles()) {
          if (!tile.isPartOfLandmark) {
            validTargets.push({ x, y, type: 'tile', data: tile });
          }
        }
        break;

      case 'OWN_HQ':
        // Get current player's HQ landmarks
        for (const landmark of this._gameState.getLandmarks()) {
          if (landmark.owner === currentPlayer && landmark.isHQ) {
            validTargets.push({ x: landmark.x, y: landmark.y, type: 'landmark', data: landmark });
          }
        }
        break;

      case 'ADJACENT_OPPONENT_LANDMARKS':
        // Get opponent landmarks that are adjacent to player's tiles
        const playerTiles = this._gameState.getAllTiles().filter(t => t.tile.placedBy === currentPlayer);
        for (const landmark of this._gameState.getLandmarks()) {
          if (landmark.owner !== currentPlayer) {
            // Check if adjacent to any player tile
            const isAdjacent = playerTiles.some(({ x, y }) =>
              Math.abs(landmark.x - x) + Math.abs(landmark.y - y) === 1
            );
            if (isAdjacent) {
              validTargets.push({ x: landmark.x, y: landmark.y, type: 'landmark', data: landmark });
            }
          }
        }
        break;

      case 'OPPONENT_AGENTS':
        // Get all opponent agents
        for (const agent of this._gameState.getAgents()) {
          if (agent.owner !== currentPlayer) {
            validTargets.push({ x: agent.x, y: agent.y, type: 'agent', data: agent });
          }
        }
        break;

      case 'OWN_TILES_ADJACENT_TO_OPPONENT':
        // Get own tiles that are adjacent to opponent tiles
        const opponentTiles = this._gameState.getAllTiles().filter(t => t.tile.placedBy !== currentPlayer);
        for (const { x, y, tile } of this._gameState.getAllTiles()) {
          if (tile.placedBy === currentPlayer && !tile.isPartOfLandmark) {
            const isAdjacent = opponentTiles.some(opp =>
              Math.abs(opp.x - x) + Math.abs(opp.y - y) === 1
            );
            if (isAdjacent) {
              validTargets.push({ x, y, type: 'tile', data: tile });
            }
          }
        }
        break;

      default:
        // For events targeting opponents (OPPONENT target type but no filter)
        if (event.target === 'opponent') {
          // Return opponent player indices as targets
          const players = this._gameState.getPlayers();
          for (let i = 0; i < players.length; i++) {
            if (i !== currentPlayer) {
              validTargets.push({ x: -1, y: -1, type: 'player', playerId: i, data: players[i] });
            }
          }
        }
        break;
    }

    return validTargets;
  }

  /**
   * Get the targeting message for an event
   * @param {Object} event - The event card
   * @returns {string}
   */
  getTargetingMessage(event) {
    switch (event.targetFilter) {
      case 'OWN_TILES':
        return 'Click one of your tiles on the board';
      case 'OPPONENT_TILES':
        return 'Click an opponent\'s tile on the board';
      case 'NOT_LANDMARK':
        return 'Click any basic tile (not a landmark)';
      case 'OWN_HQ':
        return 'Click one of your Headquarters';
      case 'ADJACENT_OPPONENT_LANDMARKS':
        return 'Click an adjacent opponent landmark';
      case 'OPPONENT_AGENTS':
        return 'Click an opponent\'s agent';
      case 'OWN_TILES_ADJACENT_TO_OPPONENT':
        return 'Click your tile adjacent to an opponent';
      default:
        if (event.target === 'opponent') {
          return 'This event targets your opponent';
        }
        return `Select a target (${event.target})`;
    }
  }

  // ===========================================================================
  // GAME END
  // ===========================================================================

  /**
   * Check if the game has ended
   * @returns {{ended: boolean, reason?: string, winner?: number, scores?: Array}}
   */
  checkGameEnd() {
    const gs = this._gameState;

    // Check if board is full
    if (GameRules.END_ON_FULL_BOARD) {
      const boardSize = GameRules.BOARD_SIZE;
      const totalSpaces = boardSize * boardSize;
      const tilesOnBoard = gs.getAllTiles().length;
      const landmarksOnBoard = gs.getLandmarks().length;

      // Per rulebook: Agents on empty spaces also count as occupied
      const agentOnlySpaces = this._countAgentOnlySpaces(gs);

      // Landmarks take up 1 space but represent 3 tiles combined
      const occupiedSpaces = tilesOnBoard + landmarksOnBoard + agentOnlySpaces;

      if (occupiedSpaces >= totalSpaces) {
        return this._calculateEndGameResult('Board is full');
      }
    }

    // Check if deck is empty and all hands are empty
    if (GameRules.END_ON_EMPTY_DECK) {
      const drawPileEmpty = gs.getDrawPileCount() === 0;
      if (drawPileEmpty) {
        const players = gs.getPlayers();
        const allHandsEmpty = players.every(p => p.hand.length === 0);
        if (allHandsEmpty) {
          return this._calculateEndGameResult('All tiles have been played');
        }
      }
    }

    // Check if a player has reached the landmark win condition
    if (GameRules.LANDMARKS_TO_WIN > 0) {
      const players = gs.getPlayers();
      for (let i = 0; i < players.length; i++) {
        const score = this._calculatePlayerScore(players[i]);
        if (score >= GameRules.LANDMARKS_TO_WIN) {
          return this._calculateEndGameResult(`Player ${i + 1} reached ${GameRules.LANDMARKS_TO_WIN} landmarks`);
        }
      }
    }

    return { ended: false };
  }

  /**
   * Count spaces occupied by agents only (no tile or landmark beneath)
   * Per rulebook: Agents on empty spaces count toward board occupation
   * @private
   */
  _countAgentOnlySpaces(gs) {
    const agents = gs.getAgents();
    let agentOnlyCount = 0;

    // Track unique positions
    const checkedPositions = new Set();

    for (const agent of agents) {
      const key = `${agent.x},${agent.y}`;
      if (checkedPositions.has(key)) continue;
      checkedPositions.add(key);

      // Check if there's a tile at this position
      const hasTile = gs.getTile(agent.x, agent.y) !== null;
      // Check if there's a landmark at this position
      const hasLandmark = gs.getLandmarkAt(agent.x, agent.y) !== null;

      // If no tile and no landmark, this is an agent-only space
      if (!hasTile && !hasLandmark) {
        agentOnlyCount++;
      }
    }

    return agentOnlyCount;
  }

  /**
   * Calculate final game result
   * Per rulebook tiebreakers: (1) most secured landmarks, (2) most tiles in hand
   * @private
   */
  _calculateEndGameResult(reason) {
    const players = this._gameState.getPlayers();
    const landmarks = this._gameState.getLandmarks();

    const scores = players.map((player, index) => {
      // Count secured landmarks (landmarks with friendly agents)
      const securedLandmarks = landmarks.filter(lm => {
        if (lm.owner !== index) return false;
        const agentsAtLandmark = this._gameState.getAgentsAt(lm.x, lm.y);
        return agentsAtLandmark.some(a => a.owner === index);
      }).length;

      return {
        playerIndex: index,
        name: player.name || `Player ${index + 1}`,
        landmarks: player.landmarks,
        hq: player.headquarters,
        score: this._calculatePlayerScore(player),
        securedLandmarks,
        tilesInHand: player.hand.length
      };
    });

    // Sort by: score (desc), then secured landmarks (desc), then tiles in hand (desc)
    scores.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.securedLandmarks !== a.securedLandmarks) return b.securedLandmarks - a.securedLandmarks;
      return b.tilesInHand - a.tilesInHand;
    });

    // Determine winner after tiebreakers
    const topScore = scores[0];
    const winners = scores.filter(s =>
      s.score === topScore.score &&
      s.securedLandmarks === topScore.securedLandmarks &&
      s.tilesInHand === topScore.tilesInHand
    );

    return {
      ended: true,
      reason,
      winner: winners.length === 1 ? winners[0].playerIndex : null,
      isTie: winners.length > 1,
      scores
    };
  }

  /**
   * Calculate a player's score
   * Per rulebook: only non-HQ landmarks count toward victory.
   * HQ are strategic (agent spawn points) but don't award points.
   * @private
   */
  _calculatePlayerScore(player) {
    // Score = landmarks excluding those converted to HQ
    return player.landmarks - player.headquarters;
  }

  /**
   * Get final scores for all players (includes tiebreaker info)
   * @returns {Array}
   */
  getScores() {
    const players = this._gameState.getPlayers();
    const landmarks = this._gameState.getLandmarks();

    return players.map((player, index) => {
      // Count secured landmarks (landmarks with friendly agents)
      const securedLandmarks = landmarks.filter(lm => {
        if (lm.owner !== index) return false;
        const agentsAtLandmark = this._gameState.getAgentsAt(lm.x, lm.y);
        return agentsAtLandmark.some(a => a.owner === index);
      }).length;

      return {
        playerIndex: index,
        name: player.name || `Player ${index + 1}`,
        landmarks: player.landmarks,
        hq: player.headquarters,
        score: this._calculatePlayerScore(player),
        securedLandmarks,
        tilesInHand: player.hand.length
      };
    });
  }

  // ===========================================================================
  // UNDO SYSTEM
  // ===========================================================================

  /**
   * Undo the last action (tile placement)
   * @returns {{success: boolean, message?: string}}
   */
  undo() {
    if (!this._gameState.canUndo()) {
      return { success: false, message: 'Nothing to undo' };
    }

    const success = this._gameState.undo();
    if (success) {
      // Reset combo state on undo
      this.resetComboState();
      return { success: true, message: 'Action undone' };
    }

    return { success: false, message: 'Undo failed' };
  }

  /**
   * Check if undo is available
   * @returns {boolean}
   */
  canUndo() {
    return this._gameState.canUndo();
  }
}
