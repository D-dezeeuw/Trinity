/**
 * Trinity - GameState Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState, GamePhase, StateEvent } from '../src/state/GameState.js';

describe('GameState', () => {
  let state;

  beforeEach(() => {
    state = new GameState(2);
  });

  describe('initialization', () => {
    it('initializes with setup phase', () => {
      expect(state.getPhase()).toBe(GamePhase.SETUP);
    });

    it('initializes with correct player count', () => {
      expect(state.getPlayers()).toHaveLength(2);
    });

    it('initializes with player 0 as current', () => {
      expect(state.getCurrentPlayer()).toBe(0);
    });

    it('initializes with empty board', () => {
      expect(state.getAllTiles()).toHaveLength(0);
    });

    it('initializes UI state with no hover', () => {
      const ui = state.getUIState();
      expect(ui.hoveredTile.x).toBe(-1);
      expect(ui.hoveredTile.y).toBe(-1);
    });
  });

  describe('phase management', () => {
    it('can change phase', () => {
      state.setPhase(GamePhase.PLAYING);
      expect(state.getPhase()).toBe(GamePhase.PLAYING);
    });

    it('emits event on phase change', () => {
      const callback = vi.fn();
      state.on(StateEvent.PHASE_CHANGE, callback);

      state.setPhase(GamePhase.PLAYING);

      expect(callback).toHaveBeenCalledWith({
        oldPhase: GamePhase.SETUP,
        newPhase: GamePhase.PLAYING,
      });
    });
  });

  describe('startGame', () => {
    it('sets phase to PLAYING', () => {
      state.startGame(2);
      expect(state.getPhase()).toBe(GamePhase.PLAYING);
    });

    it('sets turn to 1', () => {
      state.startGame(2);
      expect(state.getTurn().number).toBe(1);
    });

    it('emits phase change and turn start events', () => {
      const phaseCallback = vi.fn();
      const turnCallback = vi.fn();

      state.on(StateEvent.PHASE_CHANGE, phaseCallback);
      state.on(StateEvent.TURN_START, turnCallback);

      state.startGame(2);

      expect(phaseCallback).toHaveBeenCalled();
      expect(turnCallback).toHaveBeenCalledWith({ turn: 1, player: 0 });
    });
  });

  describe('tile placement', () => {
    it('places a tile on the board', () => {
      const tile = { type: 'housing' };
      state.placeTile(3, 4, tile);

      expect(state.hasTile(3, 4)).toBe(true);
      expect(state.getTile(3, 4).type).toBe('housing');
    });

    it('throws when placing on occupied position', () => {
      state.placeTile(0, 0, { type: 'housing' });
      expect(() => state.placeTile(0, 0, { type: 'commerce' })).toThrow();
    });

    it('emits TILE_PLACED event', () => {
      const callback = vi.fn();
      state.on(StateEvent.TILE_PLACED, callback);

      state.placeTile(2, 3, { type: 'industry' });

      expect(callback).toHaveBeenCalledWith({
        x: 2,
        y: 3,
        tile: expect.objectContaining({ type: 'industry' }),
        player: 0,
      });
    });

    it('records which player placed the tile', () => {
      state.placeTile(1, 1, { type: 'housing' });
      expect(state.getTile(1, 1).placedBy).toBe(0);
    });
  });

  describe('tile removal', () => {
    it('removes a tile from the board', () => {
      state.placeTile(5, 5, { type: 'commerce' });
      expect(state.hasTile(5, 5)).toBe(true);

      state.removeTile(5, 5);
      expect(state.hasTile(5, 5)).toBe(false);
    });

    it('emits TILE_REMOVED event', () => {
      state.placeTile(1, 2, { type: 'housing' });

      const callback = vi.fn();
      state.on(StateEvent.TILE_REMOVED, callback);

      state.removeTile(1, 2);

      expect(callback).toHaveBeenCalledWith({
        x: 1,
        y: 2,
        tile: expect.objectContaining({ type: 'housing' }),
      });
    });
  });

  describe('turn management', () => {
    it('advances to next player on endTurn', () => {
      expect(state.getCurrentPlayer()).toBe(0);
      state.endTurn();
      expect(state.getCurrentPlayer()).toBe(1);
    });

    it('wraps around to player 0', () => {
      state.endTurn(); // Player 0 -> 1
      state.endTurn(); // Player 1 -> 0
      expect(state.getCurrentPlayer()).toBe(0);
    });

    it('increments turn number when wrapping', () => {
      expect(state.getTurn().number).toBe(0);
      state.endTurn(); // Player 0 -> 1
      expect(state.getTurn().number).toBe(0);
      state.endTurn(); // Player 1 -> 0 (new turn)
      expect(state.getTurn().number).toBe(1);
    });

    it('emits TURN_END and TURN_START events', () => {
      const endCallback = vi.fn();
      const startCallback = vi.fn();
      const changeCallback = vi.fn();

      state.on(StateEvent.TURN_END, endCallback);
      state.on(StateEvent.TURN_START, startCallback);
      state.on(StateEvent.PLAYER_CHANGE, changeCallback);

      state.endTurn();

      expect(endCallback).toHaveBeenCalled();
      expect(startCallback).toHaveBeenCalled();
      expect(changeCallback).toHaveBeenCalledWith({
        oldPlayer: 0,
        newPlayer: 1,
      });
    });
  });

  describe('UI state', () => {
    it('sets hovered tile', () => {
      state.setHoveredTile(3, 5);
      const tile = state.getHoveredTile();
      expect(tile.x).toBe(3);
      expect(tile.y).toBe(5);
    });

    it('clears hovered tile', () => {
      state.setHoveredTile(3, 5);
      state.clearHoveredTile();
      const tile = state.getHoveredTile();
      expect(tile.x).toBe(-1);
      expect(tile.y).toBe(-1);
    });

    it('emits UI_HOVER event', () => {
      const callback = vi.fn();
      state.on(StateEvent.UI_HOVER, callback);

      state.setHoveredTile(2, 4);

      expect(callback).toHaveBeenCalledWith({
        oldTile: { x: -1, y: -1 },
        newTile: { x: 2, y: 4 },
      });
    });
  });

  describe('observer pattern', () => {
    it('allows multiple subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      state.on(StateEvent.UI_HOVER, callback1);
      state.on(StateEvent.UI_HOVER, callback2);

      state.setHoveredTile(1, 1);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('returns unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = state.on(StateEvent.UI_HOVER, callback);

      state.setHoveredTile(1, 1);
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      state.setHoveredTile(2, 2);
      expect(callback).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('off removes subscriber', () => {
      const callback = vi.fn();
      state.on(StateEvent.UI_HOVER, callback);

      state.setHoveredTile(1, 1);
      expect(callback).toHaveBeenCalledTimes(1);

      state.off(StateEvent.UI_HOVER, callback);

      state.setHoveredTile(2, 2);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('serialization', () => {
    it('serializes state to object', () => {
      state.startGame(2);
      state.placeTile(0, 0, { type: 'housing' });

      const serialized = state.serialize();

      expect(serialized.phase).toBe(GamePhase.PLAYING);
      expect(serialized.playerCount).toBe(2);
      expect(serialized.board.tiles).toHaveLength(1);
    });

    it('deserializes state from object', () => {
      const data = {
        phase: GamePhase.PLAYING,
        currentPlayer: 1,
        playerCount: 3,
        players: [
          { id: 0, name: 'P1', score: 5, hand: [], landmarks: 1, headquarters: 0 },
          { id: 1, name: 'P2', score: 3, hand: [], landmarks: 0, headquarters: 1 },
          { id: 2, name: 'P3', score: 0, hand: [], landmarks: 0, headquarters: 0 },
        ],
        board: {
          tiles: [['1,2', { type: 'commerce', placedBy: 0 }]],
          landmarks: [],
        },
        turn: { number: 5, actionsRemaining: 1 },
      };

      state.deserialize(data);

      expect(state.getPhase()).toBe(GamePhase.PLAYING);
      expect(state.getCurrentPlayer()).toBe(1);
      expect(state.getPlayers()).toHaveLength(3);
      expect(state.hasTile(1, 2)).toBe(true);
      expect(state.getTurn().number).toBe(5);
    });
  });

  describe('getAllTiles', () => {
    it('returns all placed tiles with coordinates', () => {
      state.placeTile(0, 0, { type: 'housing' });
      state.placeTile(7, 7, { type: 'commerce' });

      const tiles = state.getAllTiles();

      expect(tiles).toHaveLength(2);
      expect(tiles).toContainEqual(
        expect.objectContaining({ x: 0, y: 0, tile: expect.objectContaining({ type: 'housing' }) })
      );
      expect(tiles).toContainEqual(
        expect.objectContaining({ x: 7, y: 7, tile: expect.objectContaining({ type: 'commerce' }) })
      );
    });
  });

  // ===========================================================================
  // EVENT CARD TESTS
  // ===========================================================================

  describe('event pile management', () => {
    it('initializes empty event pile', () => {
      expect(state.getEventPileCount()).toBe(0);
    });

    it('can initialize event pile', () => {
      const events = [
        { id: 'event-1', name: 'Event 1' },
        { id: 'event-2', name: 'Event 2' },
      ];
      state.initEventPile(events);

      expect(state.getEventPileCount()).toBe(2);
    });

    it('draws event from pile', () => {
      state.initEventPile([
        { id: 'event-1', name: 'Event 1' },
        { id: 'event-2', name: 'Event 2' },
      ]);

      const event = state.drawEvent();

      expect(event).toBeDefined();
      expect(state.getEventPileCount()).toBe(1);
    });

    it('returns null when drawing from empty pile', () => {
      const event = state.drawEvent();

      expect(event).toBeNull();
    });
  });

  describe('player events', () => {
    beforeEach(() => {
      state.initEventPile([
        { id: 'event-1', name: 'Event 1' },
        { id: 'event-2', name: 'Event 2' },
        { id: 'event-3', name: 'Event 3' },
      ]);
    });

    it('draws event to player hand', () => {
      const event = state.drawEventToHand(0);

      expect(event).toBeDefined();
      expect(state.getPlayerEvents(0)).toHaveLength(1);
    });

    it('emits EVENT_DRAWN on draw', () => {
      const callback = vi.fn();
      state.on(StateEvent.EVENT_DRAWN, callback);

      state.drawEventToHand(0);

      expect(callback).toHaveBeenCalledWith({
        player: 0,
        event: expect.objectContaining({ id: 'event-3' }),
      });
    });

    it('removes event from player hand', () => {
      state.drawEventToHand(0);
      state.drawEventToHand(0);

      const removed = state.removeEventFromHand(0, 0);

      expect(removed).toBeDefined();
      expect(state.getPlayerEvents(0)).toHaveLength(1);
    });

    it('plays event and emits event', () => {
      state.drawEventToHand(0);

      const callback = vi.fn();
      state.on(StateEvent.EVENT_PLAYED, callback);

      const played = state.playEvent(0, 0, { targetX: 1, targetY: 2 });

      expect(played).toBeDefined();
      expect(state.getPlayerEvents(0)).toHaveLength(0);
      expect(callback).toHaveBeenCalledWith({
        player: 0,
        event: expect.objectContaining({ id: 'event-3' }),
        target: { targetX: 1, targetY: 2 },
      });
    });

    it('peeks at top of event pile without removing', () => {
      const peeked = state.peekEventPile(2);

      expect(peeked).toHaveLength(2);
      expect(state.getEventPileCount()).toBe(3); // Still 3
    });
  });

  // ===========================================================================
  // AGENT TESTS
  // ===========================================================================

  describe('agent management', () => {
    it('places agent on board', () => {
      state.placeAgent(3, 3, 0);

      const agents = state.getAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0]).toEqual({ x: 3, y: 3, owner: 0, count: 1 });
    });

    it('emits AGENT_PLACED event', () => {
      const callback = vi.fn();
      state.on(StateEvent.AGENT_PLACED, callback);

      state.placeAgent(2, 2, 0);

      expect(callback).toHaveBeenCalledWith({ x: 2, y: 2, owner: 0 });
    });

    it('stacks multiple agents at same position', () => {
      state.placeAgent(3, 3, 0);
      state.placeAgent(3, 3, 0);

      const agents = state.getAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0].count).toBe(2);
    });

    it('tracks agents from different players at same position', () => {
      state.placeAgent(3, 3, 0);
      state.placeAgent(3, 3, 1);

      const agents = state.getAgents();
      expect(agents).toHaveLength(2);
      expect(agents).toContainEqual({ x: 3, y: 3, owner: 0, count: 1 });
      expect(agents).toContainEqual({ x: 3, y: 3, owner: 1, count: 1 });
    });

    it('gets agents at specific position', () => {
      state.placeAgent(3, 3, 0);
      state.placeAgent(3, 3, 1);
      state.placeAgent(5, 5, 0);

      const agentsAt33 = state.getAgentsAt(3, 3);
      expect(agentsAt33).toHaveLength(2);

      const agentsAt55 = state.getAgentsAt(5, 5);
      expect(agentsAt55).toHaveLength(1);

      const agentsAt00 = state.getAgentsAt(0, 0);
      expect(agentsAt00).toHaveLength(0);
    });

    it('counts agents per player', () => {
      state.placeAgent(1, 1, 0);
      state.placeAgent(2, 2, 0);
      state.placeAgent(3, 3, 0);
      state.placeAgent(4, 4, 1);

      expect(state.getPlayerAgentCount(0)).toBe(3);
      expect(state.getPlayerAgentCount(1)).toBe(1);
    });

    it('checks for enemy agents at position', () => {
      state.placeAgent(3, 3, 1);

      expect(state.hasEnemyAgentsAt(3, 3, 0)).toBe(true);
      expect(state.hasEnemyAgentsAt(3, 3, 1)).toBe(false);
      expect(state.hasEnemyAgentsAt(5, 5, 0)).toBe(false);
    });
  });

  describe('agent movement', () => {
    beforeEach(() => {
      state.placeAgent(3, 3, 0);
    });

    it('moves agent to new position', () => {
      state.moveAgent(3, 3, 4, 3, 0);

      expect(state.getAgentsAt(3, 3)).toHaveLength(0);
      expect(state.getAgentsAt(4, 3)).toHaveLength(1);
    });

    it('emits AGENT_MOVED event', () => {
      const callback = vi.fn();
      state.on(StateEvent.AGENT_MOVED, callback);

      state.moveAgent(3, 3, 4, 3, 0);

      expect(callback).toHaveBeenCalledWith({
        fromX: 3, fromY: 3,
        toX: 4, toY: 3,
        owner: 0,
      });
    });

    it('throws when moving from position with no agent', () => {
      expect(() => state.moveAgent(0, 0, 1, 0, 0)).toThrow('No agent');
    });

    it('throws when moving another player\'s agent', () => {
      expect(() => state.moveAgent(3, 3, 4, 3, 1)).toThrow('has no agent');
    });
  });

  describe('agent removal', () => {
    beforeEach(() => {
      state.placeAgent(3, 3, 0);
      state.placeAgent(3, 3, 0);
    });

    it('removes one agent from stack', () => {
      state.removeAgent(3, 3, 0);

      const agents = state.getAgentsAt(3, 3);
      expect(agents).toHaveLength(1);
    });

    it('removes last agent clears position', () => {
      state.removeAgent(3, 3, 0);
      state.removeAgent(3, 3, 0);

      const agents = state.getAgentsAt(3, 3);
      expect(agents).toHaveLength(0);
    });

    it('emits AGENT_REMOVED event', () => {
      const callback = vi.fn();
      state.on(StateEvent.AGENT_REMOVED, callback);

      state.removeAgent(3, 3, 0);

      expect(callback).toHaveBeenCalledWith({ x: 3, y: 3, owner: 0 });
    });

    it('throws when removing from position with no agent', () => {
      expect(() => state.removeAgent(0, 0, 0)).toThrow('No agent');
    });
  });

  // ===========================================================================
  // LANDMARK TESTS
  // ===========================================================================

  describe('landmark formation', () => {
    beforeEach(() => {
      // Place 3 tiles in a pattern that could form a landmark
      state.placeTile(0, 0, { type: 'housing' });
      state.placeTile(1, 0, { type: 'commerce' });
      state.placeTile(0, 1, { type: 'industry' });
    });

    it('forms landmark from 3 tiles', () => {
      const positions = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
      state.formLandmark(0, 0, positions, 0);

      const landmarks = state.getLandmarks();
      expect(landmarks).toHaveLength(1);
      expect(landmarks[0].owner).toBe(0);
      expect(landmarks[0].tiles).toHaveLength(3);
    });

    it('removes tiles from board when forming landmark', () => {
      const positions = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
      state.formLandmark(0, 0, positions, 0);

      // Original tile positions should be clear
      expect(state.hasTile(0, 0)).toBe(false);
      expect(state.hasTile(1, 0)).toBe(false);
      expect(state.hasTile(0, 1)).toBe(false);
    });

    it('increments player landmark count', () => {
      expect(state.getPlayer(0).landmarks).toBe(0);

      const positions = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
      state.formLandmark(0, 0, positions, 0);

      expect(state.getPlayer(0).landmarks).toBe(1);
    });

    it('emits LANDMARK_CREATED event', () => {
      const callback = vi.fn();
      state.on(StateEvent.LANDMARK_CREATED, callback);

      const positions = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
      state.formLandmark(0, 0, positions, 0);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        x: 0, y: 0,
        owner: 0,
        freedPositions: expect.any(Array),
      }));
    });
  });

  describe('HQ conversion', () => {
    beforeEach(() => {
      // Create a landmark first
      state.placeTile(0, 0, { type: 'housing' });
      state.placeTile(1, 0, { type: 'commerce' });
      state.placeTile(0, 1, { type: 'industry' });
      const positions = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
      state.formLandmark(0, 0, positions, 0);
    });

    it('converts landmark to HQ', () => {
      state.convertToHQ(0, 0);

      const landmark = state.getLandmarkAt(0, 0);
      expect(landmark.isHQ).toBe(true);
    });

    it('increments player HQ count', () => {
      expect(state.getPlayer(0).headquarters).toBe(0);

      state.convertToHQ(0, 0);

      expect(state.getPlayer(0).headquarters).toBe(1);
    });

    it('emits HQ_CREATED event', () => {
      const callback = vi.fn();
      state.on(StateEvent.HQ_CREATED, callback);

      state.convertToHQ(0, 0);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        landmarkIndex: 0,
        x: 0, y: 0,
        owner: 0,
      }));
    });

    it('throws when converting non-owned landmark', () => {
      expect(() => state.convertToHQ(0, 1)).toThrow('does not own');
    });

    it('throws when converting already HQ', () => {
      state.convertToHQ(0, 0);
      expect(() => state.convertToHQ(0, 0)).toThrow('already an HQ');
    });
  });

  describe('getTilesForRendering with HQ', () => {
    beforeEach(() => {
      state.placeTile(0, 0, { type: 'housing' });
      state.placeTile(1, 0, { type: 'commerce' });
      state.placeTile(0, 1, { type: 'industry' });
      const positions = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
      state.formLandmark(0, 0, positions, 0);
    });

    it('includes isHQ flag for landmarks', () => {
      const tiles = state.getTilesForRendering();

      // All landmark tiles at (0,0) should have isHQ false initially
      const landmarkTiles = tiles.filter(t => t.x === 0 && t.y === 0);
      expect(landmarkTiles.length).toBe(3); // 3 stacked tiles
      expect(landmarkTiles.every(t => t.isHQ === false)).toBe(true);
    });

    it('sets isHQ true after conversion', () => {
      state.convertToHQ(0, 0);

      const tiles = state.getTilesForRendering();
      const landmarkTiles = tiles.filter(t => t.x === 0 && t.y === 0);

      expect(landmarkTiles.every(t => t.isHQ === true)).toBe(true);
    });

    it('includes landmarkOwner for landmark tiles', () => {
      const tiles = state.getTilesForRendering();
      const landmarkTiles = tiles.filter(t => t.x === 0 && t.y === 0);

      expect(landmarkTiles.every(t => t.landmarkOwner === 0)).toBe(true);
    });
  });
});
