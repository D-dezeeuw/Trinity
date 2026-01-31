/**
 * Trinity - Renderer Tests
 * Tests for the modular renderer system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../src/state/GameState.js';
import { TileType } from '../src/game/TileTypes.js';
import { TextRenderer } from '../src/renderer/TextRenderer.js';
import { GridRenderer } from '../src/renderer/GridRenderer.js';
import { RendererManager, resetRendererManager } from '../src/renderer/RendererManager.js';
import { toGrid, toAscii, fromAscii, gridsEqual, asciiEqual } from '../src/test/BoardSerializer.js';
import {
  assertTileAt,
  assertEmptyAt,
  assertLandmarkCount,
  createTestHelper,
} from '../src/test/StateAssertions.js';

describe('TextRenderer', () => {
  let renderer;
  let gameState;

  beforeEach(() => {
    renderer = new TextRenderer();
    gameState = new GameState(2);
    gameState.setPhase('playing');
    gameState.setTurnNumber(1);
  });

  it('renders empty board', () => {
    const output = renderer.render(gameState);
    expect(output).toContain('Turn 1');
    expect(output).toContain('P1');
    // Should have 8 rows of dots
    const lines = output.split('\n');
    const gridLines = lines.filter(l => l.includes('.'));
    expect(gridLines.length).toBeGreaterThanOrEqual(8);
  });

  it('renders placed tiles with correct symbols', () => {
    gameState.placeTile(0, 0, { type: TileType.HOUSING, owner: 0 });
    gameState.placeTile(1, 0, { type: TileType.COMMERCE, owner: 0 });

    const output = renderer.renderCompact(gameState);
    const firstLine = output.split('\n')[0];

    expect(firstLine).toContain('H');
    expect(firstLine).toContain('C');
  });

  it('renders player 2 tiles as lowercase', () => {
    gameState.setCurrentPlayer(1);
    gameState.placeTile(0, 0, { type: TileType.INDUSTRY, owner: 1 });

    const output = renderer.renderCompact(gameState);
    expect(output).toContain('i');
  });

  it('renders landmarks as L', () => {
    // Place tiles and form landmark
    gameState.placeTile(0, 0, { type: TileType.HOUSING, owner: 0 });
    gameState.placeTile(1, 0, { type: TileType.COMMERCE, owner: 0 });
    gameState.placeTile(0, 1, { type: TileType.INDUSTRY, owner: 0 });

    // Form landmark at housing position
    gameState.formLandmark(0, 0, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ], 0);

    const output = renderer.renderCompact(gameState);
    expect(output).toContain('L');
  });

  it('renders HQ as Q', () => {
    // Setup landmark
    gameState.placeTile(0, 0, { type: TileType.HOUSING, owner: 0 });
    gameState.placeTile(1, 0, { type: TileType.COMMERCE, owner: 0 });
    gameState.placeTile(0, 1, { type: TileType.INDUSTRY, owner: 0 });
    gameState.formLandmark(0, 0, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ], 0);

    // Convert to HQ
    gameState.convertToHQ(0, 0);

    const output = renderer.renderCompact(gameState);
    expect(output).toContain('Q');
  });

  it('renderGrid returns compact format without headers', () => {
    gameState.placeTile(0, 0, { type: TileType.HOUSING, owner: 0 });

    const output = renderer.renderGrid(gameState);

    expect(output).not.toContain('Turn');
    expect(output).not.toContain('Landmarks');
    // First line should contain tile content (may have column numbers)
    expect(output).toContain('H');
  });
});

describe('GridRenderer', () => {
  let renderer;
  let gameState;

  beforeEach(() => {
    renderer = new GridRenderer();
    gameState = new GameState(2);
    gameState.setPhase('playing');
    gameState.setTurnNumber(1);
  });

  it('renders empty board with null cells', () => {
    const data = renderer.render(gameState);

    expect(data.size).toBe(8);
    expect(data.grid.length).toBe(8);
    expect(data.grid[0][0]).toBeNull();
    expect(data.landmarks).toEqual([]);
    expect(data.agents).toEqual([]);
  });

  it('renders tiles with type and owner', () => {
    gameState.placeTile(2, 3, { type: TileType.HOUSING, owner: 0 });

    const data = renderer.render(gameState);

    expect(data.grid[3][2]).toEqual({ type: 'H', owner: 0 });
  });

  it('includes meta information', () => {
    const data = renderer.render(gameState);

    expect(data.meta.turn).toBe(1);
    expect(data.meta.currentPlayer).toBe(0);
    expect(data.meta.playerCount).toBe(2);
  });

  it('tracks landmarks', () => {
    gameState.placeTile(0, 0, { type: TileType.HOUSING, owner: 0 });
    gameState.placeTile(1, 0, { type: TileType.COMMERCE, owner: 0 });
    gameState.placeTile(0, 1, { type: TileType.INDUSTRY, owner: 0 });
    gameState.formLandmark(0, 0, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ], 0);

    const data = renderer.render(gameState);

    expect(data.landmarks.length).toBe(1);
    expect(data.landmarks[0]).toMatchObject({
      x: 0,
      y: 0,
      owner: 0,
      isHQ: false,
    });
  });

  it('provides helper methods for querying', () => {
    // Set current player to 1 so placeTile uses player 1 as owner
    gameState.setCurrentPlayer(1);
    gameState.placeTile(2, 3, { type: TileType.COMMERCE, owner: 1 });

    const data = renderer.render(gameState);

    expect(renderer.getCell(data, 2, 3)).toEqual({ type: 'C', owner: 1 });
    expect(renderer.getCell(data, 0, 0)).toBeNull();
    expect(renderer.countTilesByOwner(data, 1)).toBe(1);
  });
});

describe('RendererManager', () => {
  let manager;

  beforeEach(() => {
    resetRendererManager();
    manager = new RendererManager();
  });

  it('registers and retrieves renderers', () => {
    const textRenderer = new TextRenderer();
    manager.register('text', textRenderer);

    expect(manager.has('text')).toBe(true);
    expect(manager.get('text')).toBe(textRenderer);
  });

  it('switches between renderers', async () => {
    const textRenderer = new TextRenderer();
    const gridRenderer = new GridRenderer();

    manager.register('text', textRenderer);
    manager.register('grid', gridRenderer);

    await manager.switch('text');
    expect(manager.getActiveName()).toBe('text');

    await manager.switch('grid');
    expect(manager.getActiveName()).toBe('grid');
  });

  it('renders using active renderer', async () => {
    const gameState = new GameState(2);
    gameState.setPhase('playing');
    gameState.placeTile(0, 0, { type: TileType.HOUSING, owner: 0 });

    manager.register('text', new TextRenderer());
    manager.register('grid', new GridRenderer());

    await manager.switch('text');
    const textOutput = manager.render(gameState);
    expect(typeof textOutput).toBe('string');
    expect(textOutput).toContain('H');

    await manager.switch('grid');
    const gridOutput = manager.render(gameState);
    expect(typeof gridOutput).toBe('object');
    expect(gridOutput.grid[0][0]).toEqual({ type: 'H', owner: 0 });
  });

  it('lists registered renderer names', () => {
    manager.register('text', new TextRenderer());
    manager.register('grid', new GridRenderer());

    const names = manager.getRegisteredNames();
    expect(names).toContain('text');
    expect(names).toContain('grid');
  });
});

describe('BoardSerializer', () => {
  describe('toGrid', () => {
    it('converts GameState to grid data', () => {
      const gameState = new GameState(2);
      gameState.setPhase('playing');
      gameState.placeTile(1, 2, { type: TileType.INDUSTRY, owner: 0 });

      const data = toGrid(gameState);

      expect(data.grid[2][1]).toEqual({ type: 'I', owner: 0 });
    });
  });

  describe('toAscii', () => {
    it('converts GameState to ASCII string', () => {
      const gameState = new GameState(2);
      gameState.setPhase('playing');
      gameState.placeTile(0, 0, { type: TileType.HOUSING, owner: 0 });
      gameState.setCurrentPlayer(1);
      gameState.placeTile(1, 1, { type: TileType.COMMERCE, owner: 1 });

      const ascii = toAscii(gameState);

      expect(ascii).toContain('H');
      expect(ascii).toContain('c'); // lowercase for player 2
    });
  });

  describe('fromAscii', () => {
    it('parses ASCII string to GameState', () => {
      const ascii = `
        H C .
        I . .
        . . .
      `;

      const gameState = fromAscii(ascii);

      expect(gameState.getTile(0, 0)).toBeTruthy();
      expect(gameState.getTile(0, 0).type).toBe(TileType.HOUSING);
      expect(gameState.getTile(1, 0).type).toBe(TileType.COMMERCE);
      expect(gameState.getTile(0, 1).type).toBe(TileType.INDUSTRY);
    });

    it('handles player 2 tiles (lowercase)', () => {
      const ascii = `
        h c .
        . . .
      `;

      const gameState = fromAscii(ascii);

      expect(gameState.getTile(0, 0).placedBy).toBe(1);
      expect(gameState.getTile(1, 0).placedBy).toBe(1);
    });

    it('round-trips correctly', () => {
      const original = `
H C . . . . . .
I . . . . . . .
. . h c . . . .
. . i . . . . .
. . . . . . . .
. . . . . . . .
. . . . . . . .
. . . . . . . .
      `.trim();

      const gameState = fromAscii(original);
      const result = toAscii(gameState, { compact: true });

      expect(asciiEqual(original, result)).toBe(true);
    });
  });

  describe('gridsEqual', () => {
    it('returns true for equal grids', () => {
      const gameState1 = fromAscii('H C .\nI . .');
      const gameState2 = fromAscii('H C .\nI . .');

      expect(gridsEqual(toGrid(gameState1), toGrid(gameState2))).toBe(true);
    });

    it('returns false for different grids', () => {
      const gameState1 = fromAscii('H C .');
      const gameState2 = fromAscii('H I .');

      expect(gridsEqual(toGrid(gameState1), toGrid(gameState2))).toBe(false);
    });
  });
});

describe('StateAssertions', () => {
  describe('assertTileAt', () => {
    it('passes for correct tile', () => {
      const gameState = fromAscii('H C .');
      const grid = toGrid(gameState);

      expect(() => assertTileAt(grid, 0, 0, 'H', 0)).not.toThrow();
    });

    it('throws for wrong type', () => {
      const gameState = fromAscii('H . .');
      const grid = toGrid(gameState);

      expect(() => assertTileAt(grid, 0, 0, 'C', 0)).toThrow(/Expected tile type/);
    });

    it('throws for empty cell', () => {
      const gameState = fromAscii('. . .');
      const grid = toGrid(gameState);

      expect(() => assertTileAt(grid, 0, 0, 'H', 0)).toThrow(/found empty cell/);
    });
  });

  describe('assertEmptyAt', () => {
    it('passes for empty cell', () => {
      const gameState = fromAscii('. . .');
      const grid = toGrid(gameState);

      expect(() => assertEmptyAt(grid, 0, 0)).not.toThrow();
    });

    it('throws for occupied cell', () => {
      const gameState = fromAscii('H . .');
      const grid = toGrid(gameState);

      expect(() => assertEmptyAt(grid, 0, 0)).toThrow(/found tile/);
    });
  });

  describe('createTestHelper', () => {
    it('provides convenience methods', () => {
      const gameState = fromAscii('H C .');
      const helper = createTestHelper(gameState);

      expect(helper.grid().grid[0][0]).toEqual({ type: 'H', owner: 0 });
      expect(helper.ascii()).toContain('H');
      expect(() => helper.assertTile(0, 0, 'H', 0)).not.toThrow();
    });
  });
});
