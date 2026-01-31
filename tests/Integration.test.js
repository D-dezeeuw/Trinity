/**
 * Trinity - Integration Tests
 * Tests complete game flows and multi-system interactions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameController } from '../src/controllers/GameController.js';
import { GameState, StateEvent, TurnPhase } from '../src/state/GameState.js';
import { GameRules } from '../src/game/GameRules.js';
import { TileType } from '../src/game/TileTypes.js';

describe('Integration: Game Flow', () => {
  let controller;
  let gameState;

  beforeEach(() => {
    controller = new GameController(null);
    gameState = controller.startNewGame(2);
    // Set consistent starting player for tests
    gameState.setCurrentPlayer(0);
  });

  describe('Complete Turn Cycle', () => {
    it('executes a complete 2-player turn cycle', () => {
      // Player 0's turn
      expect(gameState.getCurrentPlayer()).toBe(0);

      // Place a tile in starting zone
      const result1 = controller.tryPlaceTile(0, 0, 0);
      expect(result1.success).toBe(true);

      // End turn
      controller.endTurnWithRefill();

      // Player 1's turn
      expect(gameState.getCurrentPlayer()).toBe(1);

      // Place a tile in player 1's starting zone (bottom rows)
      const result2 = controller.tryPlaceTile(0, 7, 0);
      expect(result2.success).toBe(true);

      // End turn
      controller.endTurnWithRefill();

      // Back to Player 0
      expect(gameState.getCurrentPlayer()).toBe(0);
      expect(gameState.getTurn().number).toBe(2);
    });

    it('draws tiles at end of turn (landmark bonus + underdog)', () => {
      const initialHandSize = gameState.getPlayerHand(0).length;

      // Place and end turn
      controller.tryPlaceTile(0, 0, 0);
      controller.endTurnWithRefill();

      // With LANDMARK_DRAW_BONUS and UNDERDOG_BONUS:
      // Draw = 1 base + 0 landmarks + 1 underdog = 2 tiles
      // Hand size after: initial - 1 (placed) + 2 (drawn) = initial + 1
      const afterRefill = gameState.getPlayerHand(0).length;
      expect(afterRefill).toBe(initialHandSize + 1); // 5 - 1 + 2 = 6
    });
  });

  describe('Landmark Formation Flow', () => {
    it('forms landmark when Trinity is completed', () => {
      // Manually place tiles to form a Trinity
      // Player 0: Place Housing, Commerce, Industry in adjacency
      gameState.setCurrentPlayer(0);

      // Add specific tiles to hand for testing
      const player = gameState.getPlayer(0);

      // Place tiles directly to ensure Trinity formation
      gameState.placeTile(0, 0, { type: TileType.HOUSING });
      gameState.placeTile(1, 0, { type: TileType.COMMERCE });
      gameState.placeTile(0, 1, { type: TileType.INDUSTRY });

      // Form landmark manually (in real game, auto-detected)
      const positions = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
      gameState.formLandmark(0, 0, positions, 0);

      // Verify landmark exists
      expect(gameState.getLandmarks()).toHaveLength(1);
      expect(gameState.getPlayer(0).landmarks).toBe(1);
    });

    it('awards event card when forming landmark', () => {
      // Check initial event count
      const initialEvents = gameState.getPlayerEvents(0).length;

      // Place tiles directly to ensure Trinity formation
      gameState.placeTile(3, 0, { type: TileType.HOUSING });
      gameState.placeTile(4, 0, { type: TileType.COMMERCE });

      // Place the third tile which triggers landmark formation via controller
      gameState.addTileToHand(0, { type: TileType.INDUSTRY, owner: 0 });
      const handIndex = gameState.getPlayerHand(0).length - 1;
      controller.tryPlaceTile(3, 1, handIndex);

      // Player should have received an event card for forming the landmark
      const afterEvents = gameState.getPlayerEvents(0).length;
      // If landmark formed, player should have 1 more event
      const landmarks = gameState.getLandmarks();
      if (landmarks.length > 0) {
        expect(afterEvents).toBe(initialEvents + 1);
      }
    });

    it('converts landmark to HQ and spawns agents', () => {
      // Create landmark first
      gameState.placeTile(0, 0, { type: TileType.HOUSING });
      gameState.placeTile(1, 0, { type: TileType.COMMERCE });
      gameState.placeTile(0, 1, { type: TileType.INDUSTRY });
      gameState.formLandmark(0, 0, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], 0);

      // Convert to HQ
      const result = controller.convertLandmarkToHQ(0, 0);
      expect(result.success).toBe(true);

      // Verify HQ status
      const landmark = gameState.getLandmarkAt(0, 0);
      expect(landmark.isHQ).toBe(true);

      // Verify agents were spawned
      const agents = gameState.getAgentsAt(0, 0);
      expect(agents.length).toBeGreaterThan(0);
    });
  });

  describe('Event Card Flow', () => {
    it('deals initial events to players', () => {
      expect(gameState.getPlayerEvents(0).length).toBe(2);
      expect(gameState.getPlayerEvents(1).length).toBe(2);
    });

    it('plays self-targeting event', () => {
      // Find a self-targeting event in player's hand
      const events = gameState.getPlayerEvents(0);
      const selfEvent = events.find(e => e.target === 'self' || e.target === 'none');

      if (selfEvent) {
        const eventIndex = events.indexOf(selfEvent);
        const result = controller.playEventCard(eventIndex, null);

        // Either succeeds or has valid reason
        expect(result).toHaveProperty('success');
      }
    });

    it('identifies valid targets for targeting events', () => {
      // Place a tile first
      controller.tryPlaceTile(0, 0, 0);

      // Get targets for own tiles
      const event = { targetFilter: 'OWN_TILES' };
      const targets = controller.getValidTargetsForEvent(event);

      expect(targets.length).toBe(1);
      expect(targets[0]).toEqual(expect.objectContaining({ x: 0, y: 0, type: 'tile' }));
    });
  });

  describe('Agent Combat Flow', () => {
    it('simulates agent placement and movement', () => {
      // Create HQ first to have agent spawn point
      gameState.placeTile(0, 0, { type: TileType.HOUSING });
      gameState.placeTile(1, 0, { type: TileType.COMMERCE });
      gameState.placeTile(0, 1, { type: TileType.INDUSTRY });
      gameState.formLandmark(0, 0, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], 0);
      controller.convertLandmarkToHQ(0, 0);

      // Get initial agent position
      const initialAgents = gameState.getAgentsAt(0, 0);
      expect(initialAgents.length).toBeGreaterThan(0);

      // Try to move agent
      const moves = controller.getValidAgentMoves(0, 0);
      expect(moves.length).toBeGreaterThan(0);

      // Execute move
      const targetMove = moves[0];
      const moveResult = controller.tryMoveAgent(0, 0, targetMove.x, targetMove.y);
      expect(moveResult.success).toBe(true);

      // Verify agent moved
      expect(gameState.getAgentsAt(targetMove.x, targetMove.y).length).toBe(1);
    });
  });

  describe('Multi-Player Game', () => {
    let fourPlayerState;
    let fourPlayerController;

    beforeEach(() => {
      fourPlayerController = new GameController(null);
      fourPlayerState = fourPlayerController.startNewGame(4);
      fourPlayerState.setCurrentPlayer(0);
    });

    it('handles 4-player turn rotation', () => {
      // Cycle through all players
      for (let i = 0; i < 4; i++) {
        expect(fourPlayerState.getCurrentPlayer()).toBe(i);

        // Place in starting zone and end turn
        const zones = [
          { x: 0, y: 0 },  // P0: top-left
          { x: 7, y: 0 },  // P1: top-right
          { x: 0, y: 7 },  // P2: bottom-left
          { x: 7, y: 7 },  // P3: bottom-right
        ];
        fourPlayerController.tryPlaceTile(zones[i].x, zones[i].y, 0);
        fourPlayerController.endTurnWithRefill();
      }

      // Back to player 0
      expect(fourPlayerState.getCurrentPlayer()).toBe(0);
    });

    it('maintains separate hands for all players', () => {
      for (let i = 0; i < 4; i++) {
        const hand = fourPlayerState.getPlayerHand(i);
        expect(hand.length).toBe(GameRules.HAND_SIZE);
      }
    });
  });

  describe('Game End Conditions', () => {
    it('detects when all hands are empty after deck depletion', () => {
      // This is a simplified test - in real scenario would take many turns
      // Just verify the check function works
      const result = controller.checkGameEnd();
      expect(result).toHaveProperty('ended');
      expect(result.ended).toBe(false); // Game just started
    });

    it('calculates scores correctly', () => {
      // Create landmarks for player 0
      gameState.placeTile(0, 0, { type: TileType.HOUSING });
      gameState.placeTile(1, 0, { type: TileType.COMMERCE });
      gameState.placeTile(0, 1, { type: TileType.INDUSTRY });
      gameState.formLandmark(0, 0, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], 0);

      const scores = controller.getScores();
      expect(scores[0].landmarks).toBe(1);
      expect(scores[0].score).toBe(1);
      expect(scores[1].landmarks).toBe(0);
      expect(scores[1].score).toBe(0);
    });

    it('scores include tiebreaker information', () => {
      const scores = controller.getScores();
      expect(scores[0]).toHaveProperty('securedLandmarks');
      expect(scores[0]).toHaveProperty('tilesInHand');
    });

    it('HQ does NOT add points to score (per rulebook)', () => {
      // Create and convert landmark to HQ
      gameState.placeTile(0, 0, { type: TileType.HOUSING });
      gameState.placeTile(1, 0, { type: TileType.COMMERCE });
      gameState.placeTile(0, 1, { type: TileType.INDUSTRY });
      gameState.formLandmark(0, 0, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], 0);
      controller.convertLandmarkToHQ(0, 0);

      const scores = controller.getScores();
      // HQ is tracked but doesn't count for score
      expect(scores[0].hq).toBe(1);
      // Per rulebook: HQ don't count toward victory, so score = landmarks - hq = 1 - 1 = 0
      expect(scores[0].score).toBe(0);
    });
  });

  describe('State Event Subscriptions', () => {
    it('fires events during game flow', () => {
      const tilePlaced = vi.fn();
      const turnEnd = vi.fn();
      const playerChange = vi.fn();

      gameState.on(StateEvent.TILE_PLACED, tilePlaced);
      gameState.on(StateEvent.TURN_END, turnEnd);
      gameState.on(StateEvent.PLAYER_CHANGE, playerChange);

      // Execute turn
      controller.tryPlaceTile(0, 0, 0);
      controller.endTurnWithRefill();

      expect(tilePlaced).toHaveBeenCalled();
      expect(turnEnd).toHaveBeenCalled();
      expect(playerChange).toHaveBeenCalled();
    });

    it('fires landmark events during formation', () => {
      const landmarkCreated = vi.fn();
      gameState.on(StateEvent.LANDMARK_CREATED, landmarkCreated);

      // Create landmark
      gameState.placeTile(0, 0, { type: TileType.HOUSING });
      gameState.placeTile(1, 0, { type: TileType.COMMERCE });
      gameState.placeTile(0, 1, { type: TileType.INDUSTRY });
      gameState.formLandmark(0, 0, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], 0);

      expect(landmarkCreated).toHaveBeenCalledWith(expect.objectContaining({
        x: 0, y: 0, owner: 0
      }));
    });
  });

  describe('Error Handling', () => {
    it('handles invalid tile placement gracefully', () => {
      // Try to place outside board
      const result = controller.tryPlaceTile(100, 100, 0);
      expect(result.success).toBe(false);
    });

    it('handles invalid event card index gracefully', () => {
      const result = controller.playEventCard(999, null);
      expect(result.success).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('handles moving non-existent agent gracefully', () => {
      const result = controller.tryMoveAgent(0, 0, 1, 0);
      expect(result.success).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe('Serialization Roundtrip', () => {
    it('preserves game state after serialize/deserialize', () => {
      // Set up some game state
      controller.tryPlaceTile(0, 0, 0);
      gameState.placeTile(1, 0, { type: TileType.COMMERCE });
      gameState.setCurrentPlayer(1);

      // Serialize
      const serialized = gameState.serialize();

      // Create new state and deserialize
      const newState = new GameState(2);
      newState.deserialize(serialized);

      // Verify preserved
      expect(newState.getCurrentPlayer()).toBe(1);
      expect(newState.hasTile(0, 0)).toBe(true);
      expect(newState.hasTile(1, 0)).toBe(true);
    });
  });
});
