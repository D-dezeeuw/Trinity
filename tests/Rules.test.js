/**
 * Trinity - Game Rules Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAdjacentPositions,
  isInStartingZone,
  canPlaceTile,
  getValidPlacements,
  detectPotentialLandmarks,
  isBoardFull,
  countPlayerLandmarks,
  determineWinner,
} from '../src/game/Rules.js';
import { TileType, createTile, isTrinity } from '../src/game/TileTypes.js';

describe('TileTypes', () => {
  describe('isTrinity', () => {
    it('returns true for H + C + I', () => {
      expect(isTrinity([TileType.HOUSING, TileType.COMMERCE, TileType.INDUSTRY])).toBe(true);
    });

    it('returns true regardless of order', () => {
      expect(isTrinity([TileType.INDUSTRY, TileType.HOUSING, TileType.COMMERCE])).toBe(true);
    });

    it('returns false for duplicate types', () => {
      expect(isTrinity([TileType.HOUSING, TileType.HOUSING, TileType.COMMERCE])).toBe(false);
    });

    it('returns false for wrong count', () => {
      expect(isTrinity([TileType.HOUSING, TileType.COMMERCE])).toBe(false);
    });
  });

  describe('createTile', () => {
    it('creates a valid tile', () => {
      const tile = createTile(TileType.HOUSING, 0);
      expect(tile.type).toBe(TileType.HOUSING);
      expect(tile.owner).toBe(0);
      expect(tile.isLandmark).toBe(false);
    });

    it('throws for invalid type', () => {
      expect(() => createTile('invalid', 0)).toThrow();
    });
  });
});

describe('Rules', () => {
  let boardTiles;

  beforeEach(() => {
    boardTiles = new Map();
  });

  describe('getAdjacentPositions', () => {
    it('returns 4 positions for center tile', () => {
      const adjacent = getAdjacentPositions(4, 4);
      expect(adjacent).toHaveLength(4);
      expect(adjacent).toContainEqual({ x: 3, y: 4 });
      expect(adjacent).toContainEqual({ x: 5, y: 4 });
      expect(adjacent).toContainEqual({ x: 4, y: 3 });
      expect(adjacent).toContainEqual({ x: 4, y: 5 });
    });

    it('returns 2 positions for corner tile', () => {
      const adjacent = getAdjacentPositions(0, 0);
      expect(adjacent).toHaveLength(2);
      expect(adjacent).toContainEqual({ x: 1, y: 0 });
      expect(adjacent).toContainEqual({ x: 0, y: 1 });
    });

    it('returns 3 positions for edge tile', () => {
      const adjacent = getAdjacentPositions(0, 4);
      expect(adjacent).toHaveLength(3);
    });
  });

  describe('isInStartingZone', () => {
    describe('2 players', () => {
      it('player 0 starts in top rows', () => {
        expect(isInStartingZone(0, 0, 0, 2)).toBe(true);
        expect(isInStartingZone(7, 1, 0, 2)).toBe(true);
        expect(isInStartingZone(0, 2, 0, 2)).toBe(false);
      });

      it('player 1 starts in bottom rows', () => {
        expect(isInStartingZone(0, 7, 1, 2)).toBe(true);
        expect(isInStartingZone(7, 6, 1, 2)).toBe(true);
        expect(isInStartingZone(0, 5, 1, 2)).toBe(false);
      });
    });

    describe('4 players', () => {
      it('player 0 starts in top-left corner', () => {
        expect(isInStartingZone(0, 0, 0, 4)).toBe(true);
        expect(isInStartingZone(1, 1, 0, 4)).toBe(true);
        expect(isInStartingZone(2, 0, 0, 4)).toBe(false);
      });

      it('player 1 starts in top-right corner', () => {
        expect(isInStartingZone(7, 0, 1, 4)).toBe(true);
        expect(isInStartingZone(6, 1, 1, 4)).toBe(true);
      });

      it('player 2 starts in bottom-left corner', () => {
        expect(isInStartingZone(0, 7, 2, 4)).toBe(true);
        expect(isInStartingZone(1, 6, 2, 4)).toBe(true);
      });

      it('player 3 starts in bottom-right corner', () => {
        expect(isInStartingZone(7, 7, 3, 4)).toBe(true);
        expect(isInStartingZone(6, 6, 3, 4)).toBe(true);
      });
    });
  });

  describe('canPlaceTile', () => {
    it('allows first tile in starting zone', () => {
      const result = canPlaceTile(boardTiles, 0, 0, 0, 2);
      expect(result.valid).toBe(true);
    });

    it('rejects first tile outside starting zone', () => {
      const result = canPlaceTile(boardTiles, 4, 4, 0, 2);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('starting zone');
    });

    it('rejects placement on occupied position', () => {
      boardTiles.set('0,0', createTile(TileType.HOUSING, 0));
      const result = canPlaceTile(boardTiles, 0, 0, 0, 2);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('occupied');
    });

    it('requires adjacency after first tile', () => {
      boardTiles.set('0,0', createTile(TileType.HOUSING, 0));

      // Adjacent is valid
      const adjacent = canPlaceTile(boardTiles, 1, 0, 0, 2);
      expect(adjacent.valid).toBe(true);

      // Non-adjacent is invalid
      const nonAdjacent = canPlaceTile(boardTiles, 3, 3, 0, 2);
      expect(nonAdjacent.valid).toBe(false);
      expect(nonAdjacent.reason).toContain('adjacent');
    });

    it('only allows adjacency to own tiles', () => {
      // Player 0 has a tile at (0,0)
      boardTiles.set('0,0', createTile(TileType.HOUSING, 0));
      // Player 1 has a tile at (4,4)
      boardTiles.set('4,4', createTile(TileType.HOUSING, 1));

      // Player 0 cannot place adjacent to player 1's tile (must be adjacent to own tile)
      const result = canPlaceTile(boardTiles, 4, 5, 0, 2);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('adjacent');
    });
  });

  describe('getValidPlacements', () => {
    it('returns starting zone for new player', () => {
      const valid = getValidPlacements(boardTiles, 0, 2);
      // Top two rows = 16 positions
      expect(valid).toHaveLength(16);
    });

    it('returns adjacent positions for existing player', () => {
      boardTiles.set('0,0', createTile(TileType.HOUSING, 0));
      const valid = getValidPlacements(boardTiles, 0, 2);
      // Adjacent to (0,0): (1,0) and (0,1)
      expect(valid).toHaveLength(2);
      expect(valid).toContainEqual({ x: 1, y: 0 });
      expect(valid).toContainEqual({ x: 0, y: 1 });
    });
  });

  describe('detectPotentialLandmarks', () => {
    it('detects landmark when H, C, I connect', () => {
      // Place Commerce at (0,0) and Industry at (1,0) owned by player 0
      boardTiles.set('0,0', { ...createTile(TileType.COMMERCE, 0), placedBy: 0 });
      boardTiles.set('1,0', { ...createTile(TileType.INDUSTRY, 0), placedBy: 0 });

      // Placing Housing at (0,1) would create a landmark (H connects to both C and I via being adjacent to C which is adjacent to I)
      // Actually, for this test, let's make them all adjacent to the new tile position
      // Reset:
      boardTiles.clear();
      boardTiles.set('1,0', { ...createTile(TileType.COMMERCE, 0), placedBy: 0 });
      boardTiles.set('0,1', { ...createTile(TileType.INDUSTRY, 0), placedBy: 0 });

      // Placing Housing at (0,0) - adjacent to both Commerce (1,0) and Industry (0,1)
      const landmarks = detectPotentialLandmarks(boardTiles, 0, 0, TileType.HOUSING, 0);

      expect(landmarks).toHaveLength(1);
      expect(landmarks[0]).toHaveProperty('housing');
      expect(landmarks[0]).toHaveProperty('commerce');
      expect(landmarks[0]).toHaveProperty('industry');
    });

    it('returns empty when types do not form Trinity', () => {
      boardTiles.set('1,0', { ...createTile(TileType.HOUSING, 0), placedBy: 0 });
      boardTiles.set('0,1', { ...createTile(TileType.HOUSING, 0), placedBy: 0 });

      const landmarks = detectPotentialLandmarks(boardTiles, 0, 0, TileType.COMMERCE, 0);
      expect(landmarks).toHaveLength(0);
    });

    it('ignores tiles owned by other players', () => {
      boardTiles.set('1,0', { ...createTile(TileType.COMMERCE, 1), placedBy: 1 }); // Player 1
      boardTiles.set('0,1', { ...createTile(TileType.INDUSTRY, 0), placedBy: 0 }); // Player 0

      const landmarks = detectPotentialLandmarks(boardTiles, 0, 0, TileType.HOUSING, 0);
      expect(landmarks).toHaveLength(0);
    });

    describe('Trinity Propagation Rule', () => {
      it('detects Trinity on adjacent Housing when placing Commerce', () => {
        // Setup: Housing at (1,1), Industry at (2,1), place Commerce at (1,0)
        // The Housing at (1,1) should form a Trinity
        boardTiles.set('1,1', { ...createTile(TileType.HOUSING, 0), placedBy: 0 });
        boardTiles.set('2,1', { ...createTile(TileType.INDUSTRY, 0), placedBy: 0 });

        // Placing Commerce at (1,0) - adjacent to Housing at (1,1)
        const landmarks = detectPotentialLandmarks(boardTiles, 1, 0, TileType.COMMERCE, 0);

        expect(landmarks).toHaveLength(1);
        expect(landmarks[0].housing).toEqual({ x: 1, y: 1 });
        expect(landmarks[0].commerce).toEqual({ x: 1, y: 0 });
        expect(landmarks[0].industry).toEqual({ x: 2, y: 1 });
      });

      it('detects Trinity on adjacent Housing when placing Industry', () => {
        // Setup: Housing at (2,2), Commerce at (2,3), place Industry at (3,2)
        // The Housing at (2,2) should form a Trinity
        boardTiles.set('2,2', { ...createTile(TileType.HOUSING, 0), placedBy: 0 });
        boardTiles.set('2,3', { ...createTile(TileType.COMMERCE, 0), placedBy: 0 });

        // Placing Industry at (3,2) - adjacent to Housing at (2,2)
        const landmarks = detectPotentialLandmarks(boardTiles, 3, 2, TileType.INDUSTRY, 0);

        expect(landmarks).toHaveLength(1);
        expect(landmarks[0].housing).toEqual({ x: 2, y: 2 });
      });

      it('does not form Trinity when Housing tile is not adjacent to placed tile', () => {
        // Setup: Housing at (0,0), Commerce at (1,0), Industry at (3,3) - not adjacent to Housing
        boardTiles.set('0,0', { ...createTile(TileType.HOUSING, 0), placedBy: 0 });
        boardTiles.set('1,0', { ...createTile(TileType.COMMERCE, 0), placedBy: 0 });

        // Placing Industry at (3,3) - NOT adjacent to Housing at (0,0)
        const landmarks = detectPotentialLandmarks(boardTiles, 3, 3, TileType.INDUSTRY, 0);

        expect(landmarks).toHaveLength(0);
      });

      it('can trigger multiple Trinities from one placement', () => {
        // Setup: Two Housing tiles, each missing one tile type
        // Housing at (1,1) has Commerce at (0,1)
        // Housing at (1,3) has Commerce at (0,3)
        // Placing Industry at (1,2) should trigger BOTH Trinities
        boardTiles.set('1,1', { ...createTile(TileType.HOUSING, 0), placedBy: 0 });
        boardTiles.set('0,1', { ...createTile(TileType.COMMERCE, 0), placedBy: 0 });
        boardTiles.set('1,3', { ...createTile(TileType.HOUSING, 0), placedBy: 0 });
        boardTiles.set('0,3', { ...createTile(TileType.COMMERCE, 0), placedBy: 0 });

        // Placing Industry at (1,2) - adjacent to both Housing tiles
        const landmarks = detectPotentialLandmarks(boardTiles, 1, 2, TileType.INDUSTRY, 0);

        expect(landmarks).toHaveLength(2);
      });

      it('Trinity always forms on the Housing tile position', () => {
        // Place Commerce and Industry first, then Housing
        boardTiles.set('1,0', { ...createTile(TileType.COMMERCE, 0), placedBy: 0 });
        boardTiles.set('0,1', { ...createTile(TileType.INDUSTRY, 0), placedBy: 0 });

        // Place Housing at (0,0) - should form Trinity on (0,0)
        const landmarks = detectPotentialLandmarks(boardTiles, 0, 0, TileType.HOUSING, 0);

        expect(landmarks).toHaveLength(1);
        expect(landmarks[0].housing).toEqual({ x: 0, y: 0 });
      });

      it('detects L-shaped Trinity (Housing at corner)', () => {
        // L-shape arrangement:
        //   H C
        //   I
        // Housing at (0,0), Commerce at (1,0), Industry at (0,1)
        // All three connected: H-C adjacent, H-I adjacent
        boardTiles.set('0,0', { ...createTile(TileType.HOUSING, 0), placedBy: 0 });
        boardTiles.set('1,0', { ...createTile(TileType.COMMERCE, 0), placedBy: 0 });

        // Place Industry at (0,1) - completes L-shape
        const landmarks = detectPotentialLandmarks(boardTiles, 0, 1, TileType.INDUSTRY, 0);

        expect(landmarks).toHaveLength(1);
        expect(landmarks[0].housing).toEqual({ x: 0, y: 0 });
        expect(landmarks[0].commerce).toEqual({ x: 1, y: 0 });
        expect(landmarks[0].industry).toEqual({ x: 0, y: 1 });
      });

      it('detects linear Trinity (H-C-I in a row)', () => {
        // Linear arrangement: H - C - I
        // Housing at (0,0), Commerce at (1,0), Industry at (2,0)
        // H-C adjacent, C-I adjacent, but H-I NOT adjacent
        boardTiles.set('0,0', { ...createTile(TileType.HOUSING, 0), placedBy: 0 });
        boardTiles.set('1,0', { ...createTile(TileType.COMMERCE, 0), placedBy: 0 });

        // Place Industry at (2,0) - completes linear Trinity
        const landmarks = detectPotentialLandmarks(boardTiles, 2, 0, TileType.INDUSTRY, 0);

        expect(landmarks).toHaveLength(1);
        expect(landmarks[0].housing).toEqual({ x: 0, y: 0 });
        expect(landmarks[0].commerce).toEqual({ x: 1, y: 0 });
        expect(landmarks[0].industry).toEqual({ x: 2, y: 0 });
      });

      it('detects linear Trinity (C-H-I arrangement)', () => {
        // Linear arrangement: C - H - I (Housing in middle)
        // Commerce at (0,0), Housing at (1,0), Industry at (2,0)
        boardTiles.set('0,0', { ...createTile(TileType.COMMERCE, 0), placedBy: 0 });
        boardTiles.set('1,0', { ...createTile(TileType.HOUSING, 0), placedBy: 0 });

        // Place Industry at (2,0)
        const landmarks = detectPotentialLandmarks(boardTiles, 2, 0, TileType.INDUSTRY, 0);

        expect(landmarks).toHaveLength(1);
        expect(landmarks[0].housing).toEqual({ x: 1, y: 0 });
      });

      it('detects vertical L-shaped Trinity', () => {
        // Vertical L-shape:
        //   H
        //   C
        //   I
        // But rotated as L:
        //   H
        //   C I
        boardTiles.set('1,1', { ...createTile(TileType.HOUSING, 0), placedBy: 0 });
        boardTiles.set('1,2', { ...createTile(TileType.COMMERCE, 0), placedBy: 0 });

        // Place Industry at (2,2) - forms L-shape with C at corner
        const landmarks = detectPotentialLandmarks(boardTiles, 2, 2, TileType.INDUSTRY, 0);

        expect(landmarks).toHaveLength(1);
        expect(landmarks[0].housing).toEqual({ x: 1, y: 1 });
      });
    });
  });

  describe('isBoardFull', () => {
    it('returns false for empty board', () => {
      expect(isBoardFull(boardTiles)).toBe(false);
    });

    it('returns true for full board', () => {
      // Fill the board (8x8 = 64 tiles)
      for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
          boardTiles.set(`${x},${y}`, createTile(TileType.HOUSING, 0));
        }
      }
      expect(isBoardFull(boardTiles)).toBe(true);
    });
  });

  describe('countPlayerLandmarks', () => {
    it('counts landmarks for a player', () => {
      boardTiles.set('0,0', { ...createTile(TileType.HOUSING, 0), isLandmark: true, placedBy: 0 });
      boardTiles.set('1,0', { ...createTile(TileType.HOUSING, 0), isLandmark: true, placedBy: 0 });
      boardTiles.set('2,0', { ...createTile(TileType.HOUSING, 1), isLandmark: true, placedBy: 1 });

      expect(countPlayerLandmarks(boardTiles, 0)).toBe(2);
      expect(countPlayerLandmarks(boardTiles, 1)).toBe(1);
    });
  });

  describe('determineWinner', () => {
    it('determines single winner', () => {
      const players = [
        { landmarks: 3 },
        { landmarks: 5 },
        { landmarks: 2 },
      ];
      const result = determineWinner(players);
      expect(result.winner).toBe(1);
      expect(result.tied).toBe(false);
    });

    it('detects tie', () => {
      const players = [
        { landmarks: 4 },
        { landmarks: 4 },
        { landmarks: 2 },
      ];
      const result = determineWinner(players);
      expect(result.tied).toBe(true);
      expect(result.tiedPlayers).toContain(0);
      expect(result.tiedPlayers).toContain(1);
    });
  });
});
