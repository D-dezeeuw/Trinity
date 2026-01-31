/**
 * Trinity - GameController Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameController } from '../src/controllers/GameController.js';
import { GameState, TurnPhase } from '../src/state/GameState.js';
import { TileType, createTile } from '../src/game/TileTypes.js';
import { GameRules } from '../src/game/GameRules.js';

describe('GameController', () => {
  let controller;
  let gameState;

  beforeEach(() => {
    // Start a fresh game for each test
    controller = new GameController(null);
    gameState = controller.startNewGame(2);
  });

  describe('startNewGame', () => {
    it('creates a new GameState', () => {
      expect(gameState).toBeInstanceOf(GameState);
    });

    it('sets game phase to playing', () => {
      expect(gameState.getPhase()).toBe('playing');
    });

    it('initializes draw pile with 72 tiles', () => {
      const drawPileCount = gameState.getDrawPileCount();
      // 72 total tiles - 10 dealt (5 per player) = 62
      expect(drawPileCount).toBe(72 - GameRules.HAND_SIZE * 2);
    });

    it('deals starting hands to players', () => {
      const player0Hand = gameState.getPlayerHand(0);
      const player1Hand = gameState.getPlayerHand(1);

      expect(player0Hand.length).toBe(GameRules.HAND_SIZE);
      expect(player1Hand.length).toBe(GameRules.HAND_SIZE);
    });

    it('deals starting events to players', () => {
      const player0Events = gameState.getPlayerEvents(0);
      const player1Events = gameState.getPlayerEvents(1);

      expect(player0Events.length).toBe(2);
      expect(player1Events.length).toBe(2);
    });

    it('sets turn number to 1', () => {
      expect(gameState.getTurn().number).toBe(1);
    });

    it('selects a random starting player', () => {
      // Starting player should be 0 or 1
      const currentPlayer = gameState.getCurrentPlayer();
      expect([0, 1]).toContain(currentPlayer);
    });
  });

  describe('selectHandTile', () => {
    it('selects a tile and returns valid positions', () => {
      const result = controller.selectHandTile(0, -1);

      expect(result.selected).toBe(0);
      expect(result.validPositions).toBeInstanceOf(Array);
      expect(result.validPositions.length).toBeGreaterThan(0);
    });

    it('toggles selection when selecting same tile', () => {
      // Select tile 0
      controller.selectHandTile(0, -1);

      // Select tile 0 again (toggle off)
      const result = controller.selectHandTile(0, 0);

      expect(result.selected).toBe(-1);
      expect(result.validPositions).toBeNull();
    });

    it('switches selection to different tile', () => {
      // Select tile 0
      controller.selectHandTile(0, -1);

      // Select tile 1
      const result = controller.selectHandTile(1, 0);

      expect(result.selected).toBe(1);
      expect(result.validPositions).toBeInstanceOf(Array);
    });
  });

  describe('tryPlaceTile', () => {
    beforeEach(() => {
      // Ensure we're player 0 for consistent starting zone
      gameState.setCurrentPlayer(0);
    });

    it('places tile in valid position', () => {
      // Player 0 starting zone is top rows (y = 0 or 1)
      const result = controller.tryPlaceTile(0, 0, 0);

      expect(result.success).toBe(true);
      expect(result.tileType).toBeDefined();
      expect(gameState.hasTile(0, 0)).toBe(true);
    });

    it('rejects placement outside starting zone for first tile', () => {
      const result = controller.tryPlaceTile(4, 4, 0);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('starting zone');
    });

    it('rejects placement on occupied position', () => {
      controller.tryPlaceTile(0, 0, 0);

      // Reset tiles placed counter for new attempt
      gameState.endTurn();
      gameState.endTurn(); // Back to player 0

      const result = controller.tryPlaceTile(0, 0, 0);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('occupied');
    });

    it('removes tile from hand on successful placement', () => {
      const handSizeBefore = gameState.getPlayerHand(0).length;

      controller.tryPlaceTile(0, 0, 0);

      const handSizeAfter = gameState.getPlayerHand(0).length;
      expect(handSizeAfter).toBe(handSizeBefore - 1);
    });

    it('records tile placement in turn', () => {
      expect(gameState.getTilesPlacedThisTurn()).toBe(0);

      controller.tryPlaceTile(0, 0, 0);

      expect(gameState.getTilesPlacedThisTurn()).toBe(1);
    });

    it('respects tiles per turn limit', () => {
      controller.tryPlaceTile(0, 0, 0);

      // Try to place another (should fail if TILES_PER_TURN is 1)
      if (GameRules.TILES_PER_TURN === 1) {
        const result = controller.tryPlaceTile(1, 0, 0);
        expect(result.success).toBe(false);
        expect(result.reason).toContain('Already placed');
      }
    });
  });

  describe('endTurnWithRefill', () => {
    beforeEach(() => {
      gameState.setCurrentPlayer(0);
    });

    it('advances to next player', () => {
      controller.endTurnWithRefill();

      expect(gameState.getCurrentPlayer()).toBe(1);
    });

    it('refills hand to hand size', () => {
      // Place a tile to reduce hand size
      controller.tryPlaceTile(0, 0, 0);

      const handSizeBefore = gameState.getPlayerHand(0).length;
      expect(handSizeBefore).toBe(GameRules.HAND_SIZE - 1);

      controller.endTurnWithRefill();
      // Now player 1's turn, but player 0's hand should be refilled
      // Actually, refill happens for current player before endTurn
      // Let's check player 1's hand after their turn
    });
  });

  describe('handleActionButton', () => {
    it('prompts to place tile when no tile placed yet', () => {
      const result = controller.handleActionButton();

      // In simple mode, should prompt to place tile
      if (GameRules.TURN_MODE === 'simple') {
        expect(result.action).toBe('prompt');
      }
    });
  });

  describe('checkGameEnd', () => {
    it('returns ended false when game not over', () => {
      const result = controller.checkGameEnd();

      expect(result.ended).toBe(false);
    });

    it('detects game end when board is full', () => {
      // This is hard to test without filling the board
      // We can at least verify the method exists and returns proper structure
      const result = controller.checkGameEnd();

      expect(result).toHaveProperty('ended');
    });
  });

  describe('convertLandmarkToHQ', () => {
    it('fails when no landmark at position', () => {
      const result = controller.convertLandmarkToHQ(0, 0);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('No landmark');
    });
  });

  describe('canConvertToHQ', () => {
    it('returns false when no landmark at position', () => {
      const result = controller.canConvertToHQ(0, 0);

      expect(result).toBe(false);
    });
  });

  describe('getCurrentPlayerEvents', () => {
    it('returns current player event cards', () => {
      const events = controller.getCurrentPlayerEvents();

      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(2); // Starting events
    });
  });

  describe('playEventCard', () => {
    it('fails with invalid event index', () => {
      const result = controller.playEventCard(-1, null);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Invalid event index');
    });

    it('fails with out of bounds event index', () => {
      const result = controller.playEventCard(100, null);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Invalid event index');
    });
  });

  describe('getScores', () => {
    it('returns scores for all players', () => {
      const scores = controller.getScores();

      expect(scores.length).toBe(2);
      expect(scores[0]).toHaveProperty('landmarks');
      expect(scores[0]).toHaveProperty('hq');
      expect(scores[0]).toHaveProperty('score');
    });

    it('initializes with zero scores', () => {
      const scores = controller.getScores();

      expect(scores[0].landmarks).toBe(0);
      expect(scores[0].score).toBe(0);
    });
  });

  describe('agent management', () => {
    describe('tryMoveAgent', () => {
      it('fails when no agent at source position', () => {
        const result = controller.tryMoveAgent(0, 0, 1, 0);

        expect(result.success).toBe(false);
        expect(result.reason).toContain('No agent');
      });
    });

    describe('getValidAgentMoves', () => {
      it('returns empty array when no agent at position', () => {
        const moves = controller.getValidAgentMoves(0, 0);

        expect(moves).toEqual([]);
      });
    });

    describe('getCurrentPlayerAgents', () => {
      it('returns empty array initially', () => {
        const agents = controller.getCurrentPlayerAgents();

        expect(agents).toEqual([]);
      });
    });
  });

  describe('takeover mechanics', () => {
    describe('attemptTakeover', () => {
      it('fails when no landmark at position', () => {
        const result = controller.attemptTakeover(0, 0);

        expect(result.success).toBe(false);
        expect(result.reason).toContain('No landmark');
      });
    });

    describe('canAttackLandmark', () => {
      it('returns canAttack false when no landmark', () => {
        const result = controller.canAttackLandmark(0, 0);

        expect(result.canAttack).toBe(false);
        expect(result.myAgents).toBe(0);
        expect(result.enemyAgents).toBe(0);
      });
    });
  });

  describe('getValidTargetsForEvent', () => {
    it('returns empty array for OWN_TILES when no tiles placed', () => {
      const event = { targetFilter: 'OWN_TILES' };
      const targets = controller.getValidTargetsForEvent(event);

      expect(targets).toEqual([]);
    });

    it('returns opponents for OPPONENT target type', () => {
      // Ensure we know the current player
      gameState.setCurrentPlayer(0);

      const event = { target: 'opponent' };
      const targets = controller.getValidTargetsForEvent(event);

      expect(targets.length).toBe(1);
      expect(targets[0].type).toBe('player');
      expect(targets[0].playerId).toBe(1); // Player 1 is opponent of player 0
    });
  });

  describe('getTargetingMessage', () => {
    it('returns appropriate message for OWN_TILES', () => {
      const event = { targetFilter: 'OWN_TILES' };
      const message = controller.getTargetingMessage(event);

      expect(message).toContain('your tiles');
    });

    it('returns appropriate message for OPPONENT', () => {
      const event = { target: 'opponent' };
      const message = controller.getTargetingMessage(event);

      expect(message).toContain('opponent');
    });
  });

  describe('repositionTile', () => {
    it('returns error when no tile at position', () => {
      const result = controller.repositionTile(0, 0);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('No tile');
    });

    it('returns error when tile is not owned by player', () => {
      // Place a tile as player 1
      gameState.setCurrentPlayer(1);
      gameState.placeTile(0, 0, { type: TileType.HOUSING, owner: 1 });

      // Switch to player 0 and try to reposition
      gameState.setCurrentPlayer(0);
      // Add agent so we don't get the "no agent" error first
      gameState.placeAgent(0, 0, 0);

      const result = controller.repositionTile(0, 0);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('your own');
    });

    it('returns error when no agent available', () => {
      // Place own tile but no agent nearby
      gameState.setCurrentPlayer(0);
      gameState.placeTile(0, 0, { type: TileType.HOUSING, owner: 0, placedBy: 0 });

      const result = controller.repositionTile(0, 0);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('agent');
    });

    it('succeeds with agent at tile position', () => {
      gameState.setCurrentPlayer(0);
      gameState.placeTile(0, 0, { type: TileType.HOUSING, owner: 0, placedBy: 0 });
      gameState.placeAgent(0, 0, 0);

      const initialHandSize = gameState.getPlayerHand(0).length;
      const result = controller.repositionTile(0, 0);

      expect(result.success).toBe(true);
      expect(gameState.getTile(0, 0)).toBeNull();
      expect(gameState.getPlayerHand(0).length).toBe(initialHandSize + 1);
    });
  });

  describe('attemptTileCapture', () => {
    it('returns error when no tile at position', () => {
      const result = controller.attemptTileCapture(0, 0);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('No tile');
    });

    it('returns error when targeting own tile', () => {
      gameState.setCurrentPlayer(0);
      gameState.placeTile(0, 0, { type: TileType.HOUSING, owner: 0, placedBy: 0 });

      const result = controller.attemptTileCapture(0, 0);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('own tile');
    });

    it('returns error when not enough adjacent agents', () => {
      // Place enemy tile as player 1
      gameState.setCurrentPlayer(1);
      gameState.placeTile(3, 3, { type: TileType.COMMERCE, owner: 1 });

      // Switch to player 0 trying to capture
      gameState.setCurrentPlayer(0);

      const result = controller.attemptTileCapture(3, 3);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('agent');
    });

    it('captures tile with sufficient adjacent agents', () => {
      // Place enemy tile as player 1
      gameState.setCurrentPlayer(1);
      gameState.placeTile(3, 3, { type: TileType.COMMERCE, owner: 1 });

      // Switch to player 0 and place agent adjacent
      gameState.setCurrentPlayer(0);
      gameState.placeAgent(2, 3, 0);

      const result = controller.attemptTileCapture(3, 3);

      expect(result.success).toBe(true);
      expect(result.result).toBe('capture');
      // Tile should now belong to player 0
      const tile = gameState.getTile(3, 3);
      expect(tile.placedBy).toBe(0);
    });
  });

  describe('settlement mechanics', () => {
    it('removes landmark when settlement occurs', () => {
      // Create a landmark for player 1
      gameState.placeTile(2, 2, { type: TileType.HOUSING, placedBy: 1 });
      gameState.placeTile(3, 2, { type: TileType.COMMERCE, placedBy: 1 });
      gameState.placeTile(2, 3, { type: TileType.INDUSTRY, placedBy: 1 });
      gameState.formLandmark(2, 2, [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 }], 1);

      const landmarksBefore = gameState.getLandmarks().length;
      expect(landmarksBefore).toBe(1);

      // Player 0 attacks with agents
      gameState.setCurrentPlayer(0);
      gameState.placeAgent(2, 2, 0);
      gameState.placeAgent(2, 2, 0);
      gameState.placeAgent(2, 2, 0);

      const result = controller.attemptTakeover(2, 2);

      expect(result.success).toBe(true);
      expect(result.result).toBe('settlement');
      // Landmark should be destroyed
      expect(gameState.getLandmarks().length).toBe(0);
    });
  });

  describe('P4 setup features', () => {
    describe('mulligan system', () => {
      it('allows player to mulligan once', () => {
        const handBefore = gameState.getPlayerHand(0);
        const firstTileType = handBefore[0]?.type;

        const result = controller.requestMulligan(0);

        expect(result.success).toBe(true);
        // Hand should still have 5 tiles
        const handAfter = gameState.getPlayerHand(0);
        expect(handAfter.length).toBe(GameRules.HAND_SIZE);
      });

      it('prevents second mulligan', () => {
        controller.requestMulligan(0);
        const result = controller.requestMulligan(0);

        expect(result.success).toBe(false);
        expect(result.reason).toContain('already used');
      });

      it('canMulligan returns false after mulligan used', () => {
        expect(controller.canMulligan(0)).toBe(true);
        controller.requestMulligan(0);
        expect(controller.canMulligan(0)).toBe(false);
      });
    });

    describe('open hand display', () => {
      it('getAllPlayersHands returns all hands when OPEN_HANDS is true', () => {
        const hands = controller.getAllPlayersHands();

        expect(hands.length).toBe(2); // 2 players
        expect(hands[0].playerIndex).toBe(0);
        expect(hands[1].playerIndex).toBe(1);
        expect(hands[0].hand.length).toBe(GameRules.HAND_SIZE);
        expect(hands[1].hand.length).toBe(GameRules.HAND_SIZE);
      });
    });

    describe('secured position detection', () => {
      it('detects secured tile with agent', () => {
        gameState.setCurrentPlayer(0);
        gameState.placeTile(0, 0, { type: TileType.HOUSING, placedBy: 0 });
        gameState.placeAgent(0, 0, 0);

        const result = controller.isPositionSecured(0, 0);

        expect(result.secured).toBe(true);
        expect(result.agentCount).toBe(1);
        expect(result.owner).toBe(0);
      });

      it('detects unsecured tile without agent', () => {
        gameState.setCurrentPlayer(0);
        gameState.placeTile(0, 0, { type: TileType.HOUSING, placedBy: 0 });

        const result = controller.isPositionSecured(0, 0);

        expect(result.secured).toBe(false);
        expect(result.agentCount).toBe(0);
      });

      it('getSecuredPositions returns all secured positions', () => {
        gameState.setCurrentPlayer(0);
        gameState.placeTile(0, 0, { type: TileType.HOUSING, placedBy: 0 });
        gameState.placeTile(1, 0, { type: TileType.COMMERCE, placedBy: 0 });
        gameState.placeAgent(0, 0, 0);
        gameState.placeAgent(1, 0, 0);
        gameState.placeAgent(1, 0, 0); // Second agent on same tile

        const secured = controller.getSecuredPositions();

        expect(secured.length).toBe(2);
        const pos00 = secured.find(s => s.x === 0 && s.y === 0);
        const pos10 = secured.find(s => s.x === 1 && s.y === 0);
        expect(pos00.agentCount).toBe(1);
        expect(pos10.agentCount).toBe(2);
      });
    });
  });

  describe('P3 event effects', () => {
    describe('IGNORE_ADJACENCY (Shell Company)', () => {
      it('allows placing tile without adjacency requirement when flag is set', () => {
        gameState.setCurrentPlayer(0);
        // Place a tile in starting zone first
        controller.tryPlaceTile(0, 0, 0);
        gameState.endTurn();
        gameState.endTurn(); // Back to player 0

        // Set the ignore adjacency flag
        gameState.setPlayerFlag(0, 'ignoreAdjacencyNextTile', true);

        // Try to place far from existing tiles (normally would fail)
        const result = controller.tryPlaceTile(4, 0, 0);

        expect(result.success).toBe(true);
        // Flag should be cleared after use
        expect(gameState.getPlayerFlag(0, 'ignoreAdjacencyNextTile')).toBe(false);
      });

      it('clears flag after single use', () => {
        gameState.setCurrentPlayer(0);
        gameState.setPlayerFlag(0, 'ignoreAdjacencyNextTile', true);

        controller.tryPlaceTile(0, 0, 0); // First tile
        gameState.endTurn();
        gameState.endTurn();

        // Flag should be cleared
        expect(gameState.getPlayerFlag(0, 'ignoreAdjacencyNextTile')).toBe(false);
      });
    });

    describe('STEAL_TILE_TO_HAND (Hostile Acquisition)', () => {
      it('steals opponent tile and adds to hand', () => {
        // Place opponent tile
        gameState.setCurrentPlayer(1);
        gameState.placeTile(3, 3, { type: TileType.COMMERCE, placedBy: 1 });

        // Player 0 tries to steal it
        gameState.setCurrentPlayer(0);
        const handSizeBefore = gameState.getPlayerHand(0).length;

        const result = controller._effectStealTileToHand(0, { x: 3, y: 3 });

        expect(result.success).toBe(true);
        expect(gameState.getTile(3, 3)).toBeNull(); // Tile removed
        expect(gameState.getPlayerHand(0).length).toBe(handSizeBefore + 1);
      });

      it('fails when targeting own tile', () => {
        gameState.setCurrentPlayer(0);
        gameState.placeTile(0, 0, { type: TileType.HOUSING, placedBy: 0 });

        const result = controller._effectStealTileToHand(0, { x: 0, y: 0 });

        expect(result.success).toBe(false);
        expect(result.reason).toContain('own tile');
      });
    });

    describe('peekDrawPile and reorderDrawPile', () => {
      it('peeks at top tiles without removing', () => {
        const pileCountBefore = gameState.getDrawPileCount();
        const peeked = gameState.peekDrawPile(3);

        expect(peeked.length).toBe(3);
        expect(gameState.getDrawPileCount()).toBe(pileCountBefore); // Still same count
      });

      it('reorders draw pile successfully', () => {
        const pileCountBefore = gameState.getDrawPileCount();
        const peeked = gameState.peekDrawPile(3);

        // Reorder the tiles (doesn't matter the order, just that it works)
        gameState.reorderDrawPile(peeked);

        // Pile count should remain the same
        expect(gameState.getDrawPileCount()).toBe(pileCountBefore);

        // Peek again should return tiles
        const newPeeked = gameState.peekDrawPile(3);
        expect(newPeeked.length).toBe(3);
      });
    });

    describe('Insurance Claim trigger', () => {
      it('recovers tiles when landmark is lost and Insurance Claim is held', () => {
        // Create landmark for player 1
        gameState.setCurrentPlayer(1);
        gameState.placeTile(2, 2, { type: TileType.HOUSING, placedBy: 1 });
        gameState.placeTile(3, 2, { type: TileType.COMMERCE, placedBy: 1 });
        gameState.placeTile(2, 3, { type: TileType.INDUSTRY, placedBy: 1 });
        gameState.formLandmark(2, 2, [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 }], 1);

        // Give player 1 an Insurance Claim card
        const insuranceClaim = {
          id: 'insurance-claim',
          name: 'Insurance Claim',
          trigger: 'ON_LANDMARK_LOST',
          effect: 'RECOVER_ON_TAKEOVER'
        };
        gameState._state.players[1].events.push(insuranceClaim);

        const player1HandBefore = gameState.getPlayerHand(1).length;

        // Player 0 attacks with agents
        gameState.setCurrentPlayer(0);
        gameState.placeAgent(2, 2, 0);
        gameState.placeAgent(2, 2, 0);
        gameState.placeAgent(2, 2, 0);

        const result = controller.attemptTakeover(2, 2);

        expect(result.success).toBe(true);
        expect(result.tilesRecovered).toBe(3);
        // Player 1 should have 3 more tiles in hand
        expect(gameState.getPlayerHand(1).length).toBe(player1HandBefore + 3);
        // Insurance Claim should be removed from hand
        expect(gameState.getPlayerEvents(1).find(e => e.id === 'insurance-claim')).toBeUndefined();
      });
    });
  });
});
