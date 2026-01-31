/**
 * Trinity - Landmark Formation Tests
 * Tests for Trinity (H+C+I) formation during gameplay
 * Using ASCII-based test utilities for readable test scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../src/state/GameState.js';
import { TileType } from '../src/game/TileTypes.js';
import { detectPotentialLandmarks } from '../src/game/Rules.js';
import { fromAscii, toGrid, toAscii } from '../src/test/BoardSerializer.js';
import {
  assertLandmarkAt,
  assertLandmarkCount,
  assertNoLandmarkAt,
  assertTileAt,
} from '../src/test/StateAssertions.js';

/**
 * Helper to detect and form landmarks for a placed tile
 */
function detectAndFormLandmark(gameState, x, y, tileType, playerIndex) {
  const boardTiles = gameState.getBoardTiles();
  const landmarks = detectPotentialLandmarks(boardTiles, x, y, tileType, playerIndex);

  for (const lm of landmarks) {
    const positions = [lm.housing, lm.commerce, lm.industry];
    gameState.formLandmark(lm.housing.x, lm.housing.y, positions, playerIndex);
  }

  return landmarks;
}

/**
 * Helper to place a tile and check for landmark formation
 */
function placeTileAndCheck(gameState, x, y, type, player) {
  gameState.setCurrentPlayer(player);
  gameState.placeTile(x, y, { type, owner: player });
  return detectAndFormLandmark(gameState, x, y, type, player);
}

describe('Trinity Formation', () => {
  describe('L-Shaped Formations', () => {
    it('forms trinity with H as corner (H adjacent to C and I)', () => {
      // Setup:  H C
      //         I
      const state = new GameState(2);
      state.setPhase('playing');

      placeTileAndCheck(state, 0, 0, TileType.HOUSING, 0);
      placeTileAndCheck(state, 1, 0, TileType.COMMERCE, 0);
      const landmarks = placeTileAndCheck(state, 0, 1, TileType.INDUSTRY, 0);

      expect(landmarks.length).toBe(1);
      expect(landmarks[0].housing).toEqual({ x: 0, y: 0 });

      const grid = toGrid(state);
      assertLandmarkCount(grid, 0, 1);
    });

    it('forms trinity with C as corner', () => {
      // Setup:  C H
      //         I
      const state = new GameState(2);
      state.setPhase('playing');

      placeTileAndCheck(state, 0, 0, TileType.COMMERCE, 0);
      placeTileAndCheck(state, 1, 0, TileType.HOUSING, 0);
      const landmarks = placeTileAndCheck(state, 0, 1, TileType.INDUSTRY, 0);

      expect(landmarks.length).toBe(1);
      // Landmark forms at Housing position (1, 0)
      expect(landmarks[0].housing).toEqual({ x: 1, y: 0 });
    });

    it('forms trinity with I as corner', () => {
      // Setup:  I H
      //         C
      const state = new GameState(2);
      state.setPhase('playing');

      placeTileAndCheck(state, 0, 0, TileType.INDUSTRY, 0);
      placeTileAndCheck(state, 1, 0, TileType.HOUSING, 0);
      const landmarks = placeTileAndCheck(state, 0, 1, TileType.COMMERCE, 0);

      expect(landmarks.length).toBe(1);
      expect(landmarks[0].housing).toEqual({ x: 1, y: 0 });
    });

    it('forms trinity with rotated L (bottom-left corner)', () => {
      // Setup:  I
      //         H C
      const state = new GameState(2);
      state.setPhase('playing');

      placeTileAndCheck(state, 0, 0, TileType.INDUSTRY, 0);
      placeTileAndCheck(state, 0, 1, TileType.HOUSING, 0);
      const landmarks = placeTileAndCheck(state, 1, 1, TileType.COMMERCE, 0);

      expect(landmarks.length).toBe(1);
      expect(landmarks[0].housing).toEqual({ x: 0, y: 1 });
    });

    it('forms trinity with rotated L (top-right corner)', () => {
      // Setup:  C H
      //           I
      const state = new GameState(2);
      state.setPhase('playing');

      placeTileAndCheck(state, 0, 0, TileType.COMMERCE, 0);
      placeTileAndCheck(state, 1, 0, TileType.HOUSING, 0);
      const landmarks = placeTileAndCheck(state, 1, 1, TileType.INDUSTRY, 0);

      expect(landmarks.length).toBe(1);
      expect(landmarks[0].housing).toEqual({ x: 1, y: 0 });
    });

    it('forms vertical L-shape', () => {
      // Setup:  H I
      //         C
      const state = new GameState(2);
      state.setPhase('playing');

      placeTileAndCheck(state, 0, 0, TileType.HOUSING, 0);
      placeTileAndCheck(state, 1, 0, TileType.INDUSTRY, 0);
      const landmarks = placeTileAndCheck(state, 0, 1, TileType.COMMERCE, 0);

      expect(landmarks.length).toBe(1);
      expect(landmarks[0].housing).toEqual({ x: 0, y: 0 });
    });
  });

  describe('Linear Formations', () => {
    it('forms horizontal trinity H-C-I', () => {
      // Setup:  H C I
      const state = new GameState(2);
      state.setPhase('playing');

      placeTileAndCheck(state, 0, 0, TileType.HOUSING, 0);
      placeTileAndCheck(state, 1, 0, TileType.COMMERCE, 0);
      const landmarks = placeTileAndCheck(state, 2, 0, TileType.INDUSTRY, 0);

      expect(landmarks.length).toBe(1);
      expect(landmarks[0].housing).toEqual({ x: 0, y: 0 });
    });

    it('forms horizontal trinity I-C-H', () => {
      // Setup:  I C H
      const state = new GameState(2);
      state.setPhase('playing');

      placeTileAndCheck(state, 0, 0, TileType.INDUSTRY, 0);
      placeTileAndCheck(state, 1, 0, TileType.COMMERCE, 0);
      const landmarks = placeTileAndCheck(state, 2, 0, TileType.HOUSING, 0);

      expect(landmarks.length).toBe(1);
      expect(landmarks[0].housing).toEqual({ x: 2, y: 0 });
    });

    it('forms vertical trinity H-C-I', () => {
      // Setup:  H
      //         C
      //         I
      const state = new GameState(2);
      state.setPhase('playing');

      placeTileAndCheck(state, 0, 0, TileType.HOUSING, 0);
      placeTileAndCheck(state, 0, 1, TileType.COMMERCE, 0);
      const landmarks = placeTileAndCheck(state, 0, 2, TileType.INDUSTRY, 0);

      expect(landmarks.length).toBe(1);
      expect(landmarks[0].housing).toEqual({ x: 0, y: 0 });
    });

    it('forms vertical trinity with H in middle', () => {
      // Setup:  C
      //         H
      //         I
      const state = new GameState(2);
      state.setPhase('playing');

      placeTileAndCheck(state, 0, 0, TileType.COMMERCE, 0);
      placeTileAndCheck(state, 0, 1, TileType.HOUSING, 0);
      const landmarks = placeTileAndCheck(state, 0, 2, TileType.INDUSTRY, 0);

      expect(landmarks.length).toBe(1);
      expect(landmarks[0].housing).toEqual({ x: 0, y: 1 });
    });

    it('forms vertical trinity with H at bottom', () => {
      // Setup:  I
      //         C
      //         H
      const state = new GameState(2);
      state.setPhase('playing');

      placeTileAndCheck(state, 0, 0, TileType.INDUSTRY, 0);
      placeTileAndCheck(state, 0, 1, TileType.COMMERCE, 0);
      const landmarks = placeTileAndCheck(state, 0, 2, TileType.HOUSING, 0);

      expect(landmarks.length).toBe(1);
      expect(landmarks[0].housing).toEqual({ x: 0, y: 2 });
    });
  });

  describe('Tile Placement Order', () => {
    it('forms trinity when H is placed last', () => {
      const state = new GameState(2);
      state.setPhase('playing');

      // Place C and I first
      placeTileAndCheck(state, 1, 0, TileType.COMMERCE, 0);
      placeTileAndCheck(state, 0, 1, TileType.INDUSTRY, 0);

      // Place H to complete
      const landmarks = placeTileAndCheck(state, 0, 0, TileType.HOUSING, 0);

      expect(landmarks.length).toBe(1);
    });

    it('forms trinity when C is placed last', () => {
      const state = new GameState(2);
      state.setPhase('playing');

      // Place H and I first (L-shape setup)
      placeTileAndCheck(state, 0, 0, TileType.HOUSING, 0);
      placeTileAndCheck(state, 0, 1, TileType.INDUSTRY, 0);

      // Place C to complete
      const landmarks = placeTileAndCheck(state, 1, 0, TileType.COMMERCE, 0);

      expect(landmarks.length).toBe(1);
    });

    it('forms trinity when I is placed last', () => {
      const state = new GameState(2);
      state.setPhase('playing');

      // Place H and C first
      placeTileAndCheck(state, 0, 0, TileType.HOUSING, 0);
      placeTileAndCheck(state, 1, 0, TileType.COMMERCE, 0);

      // Place I to complete
      const landmarks = placeTileAndCheck(state, 0, 1, TileType.INDUSTRY, 0);

      expect(landmarks.length).toBe(1);
    });
  });

  describe('Trinity Propagation', () => {
    it('placing C triggers trinity at nearby Housing', () => {
      // Setup: H at (0,0), I at (0,1)
      // Place C at (1,0) adjacent to H
      const state = new GameState(2);
      state.setPhase('playing');

      placeTileAndCheck(state, 0, 0, TileType.HOUSING, 0);
      placeTileAndCheck(state, 0, 1, TileType.INDUSTRY, 0);

      // C is placed adjacent to H, triggers trinity at H
      const landmarks = placeTileAndCheck(state, 1, 0, TileType.COMMERCE, 0);

      expect(landmarks.length).toBe(1);
      expect(landmarks[0].housing).toEqual({ x: 0, y: 0 });
    });

    it('placing I triggers trinity at Housing one step away', () => {
      // Setup: H at (1,1), C at (1,0)
      // Place I at (2,1) adjacent to H
      const state = new GameState(2);
      state.setPhase('playing');

      placeTileAndCheck(state, 1, 1, TileType.HOUSING, 0);
      placeTileAndCheck(state, 1, 0, TileType.COMMERCE, 0);

      const landmarks = placeTileAndCheck(state, 2, 1, TileType.INDUSTRY, 0);

      expect(landmarks.length).toBe(1);
      expect(landmarks[0].housing).toEqual({ x: 1, y: 1 });
    });
  });

  describe('Multiple Players', () => {
    it('each player forms their own landmark', () => {
      const state = new GameState(2);
      state.setPhase('playing');

      // Player 1 forms trinity at top-left
      placeTileAndCheck(state, 0, 0, TileType.HOUSING, 0);
      placeTileAndCheck(state, 1, 0, TileType.COMMERCE, 0);
      placeTileAndCheck(state, 0, 1, TileType.INDUSTRY, 0);

      // Player 2 forms trinity at bottom-right
      placeTileAndCheck(state, 6, 6, TileType.HOUSING, 1);
      placeTileAndCheck(state, 7, 6, TileType.COMMERCE, 1);
      placeTileAndCheck(state, 6, 7, TileType.INDUSTRY, 1);

      const grid = toGrid(state);
      assertLandmarkCount(grid, 0, 1);
      assertLandmarkCount(grid, 1, 1);
    });

    it('mixed ownership tiles do not form trinity', () => {
      const state = new GameState(2);
      state.setPhase('playing');

      // H and I from player 0
      placeTileAndCheck(state, 0, 0, TileType.HOUSING, 0);
      placeTileAndCheck(state, 0, 1, TileType.INDUSTRY, 0);

      // C from player 1
      const landmarks = placeTileAndCheck(state, 1, 0, TileType.COMMERCE, 1);

      // Should not form trinity (mixed ownership)
      expect(landmarks.length).toBe(0);

      const grid = toGrid(state);
      assertLandmarkCount(grid, 0, 0);
      assertLandmarkCount(grid, 1, 0);
    });
  });

  describe('Invalid Formations', () => {
    it('does not form trinity with gap in line', () => {
      // Setup: H . C I (gap between H and C)
      const state = new GameState(2);
      state.setPhase('playing');

      placeTileAndCheck(state, 0, 0, TileType.HOUSING, 0);
      placeTileAndCheck(state, 2, 0, TileType.COMMERCE, 0);
      const landmarks = placeTileAndCheck(state, 3, 0, TileType.INDUSTRY, 0);

      expect(landmarks.length).toBe(0);
    });

    it('does not form trinity with diagonal adjacency', () => {
      // Setup: H .
      //        . C I (H diagonal to C)
      const state = new GameState(2);
      state.setPhase('playing');

      placeTileAndCheck(state, 0, 0, TileType.HOUSING, 0);
      placeTileAndCheck(state, 1, 1, TileType.COMMERCE, 0);
      const landmarks = placeTileAndCheck(state, 2, 1, TileType.INDUSTRY, 0);

      expect(landmarks.length).toBe(0);
    });

    it('does not form trinity with duplicate types (H H C)', () => {
      // Setup: H H
      //        C
      const state = new GameState(2);
      state.setPhase('playing');

      placeTileAndCheck(state, 0, 0, TileType.HOUSING, 0);
      placeTileAndCheck(state, 1, 0, TileType.HOUSING, 0);
      const landmarks = placeTileAndCheck(state, 0, 1, TileType.COMMERCE, 0);

      // No trinity - missing Industry
      expect(landmarks.length).toBe(0);
    });

    it('does not form trinity with only two types', () => {
      // Setup: H C
      //        H C
      const state = new GameState(2);
      state.setPhase('playing');

      placeTileAndCheck(state, 0, 0, TileType.HOUSING, 0);
      placeTileAndCheck(state, 1, 0, TileType.COMMERCE, 0);
      placeTileAndCheck(state, 0, 1, TileType.HOUSING, 0);
      const landmarks = placeTileAndCheck(state, 1, 1, TileType.COMMERCE, 0);

      // No trinity - no Industry
      expect(landmarks.length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('forms trinity at board corner (0,0)', () => {
      const state = new GameState(2);
      state.setPhase('playing');

      placeTileAndCheck(state, 0, 0, TileType.HOUSING, 0);
      placeTileAndCheck(state, 1, 0, TileType.COMMERCE, 0);
      const landmarks = placeTileAndCheck(state, 0, 1, TileType.INDUSTRY, 0);

      expect(landmarks.length).toBe(1);
      const grid = toGrid(state);
      assertLandmarkAt(grid, 0, 0, 0);
    });

    it('forms trinity at board edge (7,0)', () => {
      const state = new GameState(2);
      state.setPhase('playing');

      placeTileAndCheck(state, 7, 0, TileType.HOUSING, 0);
      placeTileAndCheck(state, 6, 0, TileType.COMMERCE, 0);
      const landmarks = placeTileAndCheck(state, 7, 1, TileType.INDUSTRY, 0);

      expect(landmarks.length).toBe(1);
      expect(landmarks[0].housing).toEqual({ x: 7, y: 0 });
    });

    it('forms trinity at board corner (7,7)', () => {
      const state = new GameState(2);
      state.setPhase('playing');

      placeTileAndCheck(state, 7, 7, TileType.HOUSING, 0);
      placeTileAndCheck(state, 6, 7, TileType.COMMERCE, 0);
      const landmarks = placeTileAndCheck(state, 7, 6, TileType.INDUSTRY, 0);

      expect(landmarks.length).toBe(1);
      expect(landmarks[0].housing).toEqual({ x: 7, y: 7 });
    });

    it('forms trinity surrounded by other tiles', () => {
      // Dense area with trinity in the middle
      const state = new GameState(2);
      state.setPhase('playing');

      // Surrounding tiles (player 1)
      placeTileAndCheck(state, 2, 2, TileType.HOUSING, 1);
      placeTileAndCheck(state, 4, 2, TileType.COMMERCE, 1);
      placeTileAndCheck(state, 2, 4, TileType.INDUSTRY, 1);
      placeTileAndCheck(state, 4, 4, TileType.HOUSING, 1);

      // Trinity in the middle (player 0)
      placeTileAndCheck(state, 3, 3, TileType.HOUSING, 0);
      placeTileAndCheck(state, 4, 3, TileType.COMMERCE, 0);
      const landmarks = placeTileAndCheck(state, 3, 4, TileType.INDUSTRY, 0);

      expect(landmarks.length).toBe(1);
      expect(landmarks[0].housing).toEqual({ x: 3, y: 3 });
    });
  });

  describe('Using ASCII Setup', () => {
    it('detects trinity from ASCII board state', () => {
      // Use fromAscii to create initial state, then manually check
      const state = fromAscii(`
        H C . . . . . .
        I . . . . . . .
        . . . . . . . .
        . . . . . . . .
        . . . . . . . .
        . . . . . . . .
        . . . . . . . .
        . . . . . . . .
      `);

      // The fromAscii places tiles but doesn't auto-form landmarks
      // Manually trigger detection for the I placement
      const landmarks = detectAndFormLandmark(state, 0, 1, TileType.INDUSTRY, 0);

      expect(landmarks.length).toBe(1);
      expect(landmarks[0].housing).toEqual({ x: 0, y: 0 });
    });

    it('detects linear trinity from ASCII', () => {
      const state = fromAscii(`
        H C I . . . . .
        . . . . . . . .
      `);

      const landmarks = detectAndFormLandmark(state, 2, 0, TileType.INDUSTRY, 0);

      expect(landmarks.length).toBe(1);
    });

    it('handles two-player board from ASCII', () => {
      const state = fromAscii(`
        H C . . . . . .
        I . . . . . . .
        . . . . . . . .
        . . . . . . . .
        . . . . . . . .
        . . . . . . . .
        . . . . . . i .
        . . . . . . h c
      `, { playerCount: 2 });

      // Player 0's trinity
      detectAndFormLandmark(state, 0, 1, TileType.INDUSTRY, 0);

      // Player 1's trinity
      detectAndFormLandmark(state, 7, 7, TileType.COMMERCE, 1);

      const grid = toGrid(state);
      assertLandmarkCount(grid, 0, 1);
      assertLandmarkCount(grid, 1, 1);
    });
  });
});
