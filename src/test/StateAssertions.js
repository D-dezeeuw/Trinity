/**
 * Trinity - State Assertions
 * Simple assertion helpers for testing game state
 * No external dependencies - just throws errors on failure
 */

import { toGrid, toAscii, asciiEqual, gridsEqual, gridDiff } from './BoardSerializer.js';

/**
 * Assert that a tile exists at position with expected type and owner
 * @param {import('./BoardSerializer.js').GridData} gridData - Grid from toGrid()
 * @param {number} x
 * @param {number} y
 * @param {string} type - Expected type (H, C, I)
 * @param {number} owner - Expected owner (player index)
 * @throws {Error} If assertion fails
 */
export function assertTileAt(gridData, x, y, type, owner) {
  const cell = gridData.grid[y]?.[x];

  if (!cell) {
    throw new Error(`Expected tile at (${x}, ${y}) but found empty cell`);
  }

  if (cell.type !== type) {
    throw new Error(`Expected tile type "${type}" at (${x}, ${y}) but found "${cell.type}"`);
  }

  if (cell.owner !== owner) {
    throw new Error(`Expected tile owner ${owner} at (${x}, ${y}) but found ${cell.owner}`);
  }
}

/**
 * Assert that a cell is empty
 * @param {import('./BoardSerializer.js').GridData} gridData
 * @param {number} x
 * @param {number} y
 * @throws {Error} If cell is not empty
 */
export function assertEmptyAt(gridData, x, y) {
  const cell = gridData.grid[y]?.[x];

  if (cell !== null) {
    throw new Error(`Expected empty cell at (${x}, ${y}) but found tile: ${cell.type}/${cell.owner}`);
  }
}

/**
 * Assert landmark exists at position
 * @param {import('./BoardSerializer.js').GridData} gridData
 * @param {number} x
 * @param {number} y
 * @param {number} owner - Expected owner
 * @param {boolean} isHQ - Expected HQ status (optional)
 * @throws {Error} If assertion fails
 */
export function assertLandmarkAt(gridData, x, y, owner, isHQ = undefined) {
  const landmark = gridData.landmarks.find(l => l.x === x && l.y === y);

  if (!landmark) {
    throw new Error(`Expected landmark at (${x}, ${y}) but found none`);
  }

  if (landmark.owner !== owner) {
    throw new Error(`Expected landmark owner ${owner} at (${x}, ${y}) but found ${landmark.owner}`);
  }

  if (isHQ !== undefined && landmark.isHQ !== isHQ) {
    throw new Error(`Expected landmark isHQ=${isHQ} at (${x}, ${y}) but found ${landmark.isHQ}`);
  }
}

/**
 * Assert no landmark at position
 * @param {import('./BoardSerializer.js').GridData} gridData
 * @param {number} x
 * @param {number} y
 * @throws {Error} If landmark exists
 */
export function assertNoLandmarkAt(gridData, x, y) {
  const landmark = gridData.landmarks.find(l => l.x === x && l.y === y);

  if (landmark) {
    throw new Error(`Expected no landmark at (${x}, ${y}) but found one owned by ${landmark.owner}`);
  }
}

/**
 * Assert agent exists at position
 * @param {import('./BoardSerializer.js').GridData} gridData
 * @param {number} x
 * @param {number} y
 * @param {number} owner
 * @param {number} count - Expected count (optional)
 * @throws {Error} If assertion fails
 */
export function assertAgentAt(gridData, x, y, owner, count = undefined) {
  const agent = gridData.agents.find(a => a.x === x && a.y === y && a.owner === owner);

  if (!agent) {
    throw new Error(`Expected agent for player ${owner} at (${x}, ${y}) but found none`);
  }

  if (count !== undefined && agent.count !== count) {
    throw new Error(`Expected ${count} agents at (${x}, ${y}) but found ${agent.count}`);
  }
}

/**
 * Assert no agent at position
 * @param {import('./BoardSerializer.js').GridData} gridData
 * @param {number} x
 * @param {number} y
 * @throws {Error} If any agent exists
 */
export function assertNoAgentAt(gridData, x, y) {
  const agents = gridData.agents.filter(a => a.x === x && a.y === y);

  if (agents.length > 0) {
    throw new Error(`Expected no agents at (${x}, ${y}) but found ${agents.length}`);
  }
}

/**
 * Assert landmark count for a player
 * @param {import('./BoardSerializer.js').GridData} gridData
 * @param {number} owner
 * @param {number} expected
 * @throws {Error} If count doesn't match
 */
export function assertLandmarkCount(gridData, owner, expected) {
  const count = gridData.landmarks.filter(l => l.owner === owner).length;

  if (count !== expected) {
    throw new Error(`Expected ${expected} landmarks for player ${owner} but found ${count}`);
  }
}

/**
 * Assert HQ count for a player
 * @param {import('./BoardSerializer.js').GridData} gridData
 * @param {number} owner
 * @param {number} expected
 * @throws {Error} If count doesn't match
 */
export function assertHQCount(gridData, owner, expected) {
  const count = gridData.landmarks.filter(l => l.owner === owner && l.isHQ).length;

  if (count !== expected) {
    throw new Error(`Expected ${expected} HQs for player ${owner} but found ${count}`);
  }
}

/**
 * Assert agent count for a player
 * @param {import('./BoardSerializer.js').GridData} gridData
 * @param {number} owner
 * @param {number} expected
 * @throws {Error} If count doesn't match
 */
export function assertAgentCount(gridData, owner, expected) {
  const count = gridData.agents
    .filter(a => a.owner === owner)
    .reduce((sum, a) => sum + a.count, 0);

  if (count !== expected) {
    throw new Error(`Expected ${expected} agents for player ${owner} but found ${count}`);
  }
}

/**
 * Assert current player
 * @param {import('./BoardSerializer.js').GridData} gridData
 * @param {number} expected
 * @throws {Error} If doesn't match
 */
export function assertCurrentPlayer(gridData, expected) {
  if (gridData.meta.currentPlayer !== expected) {
    throw new Error(`Expected current player ${expected} but found ${gridData.meta.currentPlayer}`);
  }
}

/**
 * Assert turn number
 * @param {import('./BoardSerializer.js').GridData} gridData
 * @param {number} expected
 * @throws {Error} If doesn't match
 */
export function assertTurnNumber(gridData, expected) {
  if (gridData.meta.turn !== expected) {
    throw new Error(`Expected turn ${expected} but found ${gridData.meta.turn}`);
  }
}

/**
 * Assert grids are equal
 * @param {import('./BoardSerializer.js').GridData} actual
 * @param {import('./BoardSerializer.js').GridData} expected
 * @throws {Error} If grids differ
 */
export function assertGridsEqual(actual, expected) {
  if (!gridsEqual(actual, expected)) {
    const diffs = gridDiff(expected, actual);
    const diffStr = diffs.map(d =>
      `(${d.x},${d.y}): expected ${d.expected?.type || 'empty'} got ${d.actual?.type || 'empty'}`
    ).join(', ');
    throw new Error(`Grids differ at: ${diffStr}`);
  }
}

/**
 * Assert ASCII representations are equal (ignoring whitespace)
 * @param {string} actual
 * @param {string} expected
 * @throws {Error} If differ
 */
export function assertAsciiEqual(actual, expected) {
  if (!asciiEqual(actual, expected)) {
    throw new Error(`ASCII grids differ:\nExpected:\n${expected}\n\nActual:\n${actual}`);
  }
}

/**
 * Assert tile count for a player
 * @param {import('./BoardSerializer.js').GridData} gridData
 * @param {number} owner
 * @param {number} expected
 * @throws {Error} If count doesn't match
 */
export function assertTileCount(gridData, owner, expected) {
  let count = 0;
  for (const row of gridData.grid) {
    for (const cell of row) {
      if (cell && cell.owner === owner) {
        count++;
      }
    }
  }

  if (count !== expected) {
    throw new Error(`Expected ${expected} tiles for player ${owner} but found ${count}`);
  }
}

/**
 * Create a simple test helper that wraps GameState operations with grid output
 * @param {import('../state/GameState.js').GameState} gameState
 * @returns {Object} Helper object with convenience methods
 */
export function createTestHelper(gameState) {
  return {
    /**
     * Get current grid state
     */
    grid() {
      return toGrid(gameState);
    },

    /**
     * Get ASCII representation
     */
    ascii(options = {}) {
      return toAscii(gameState, options);
    },

    /**
     * Assert tile at position
     */
    assertTile(x, y, type, owner) {
      assertTileAt(this.grid(), x, y, type, owner);
    },

    /**
     * Assert empty at position
     */
    assertEmpty(x, y) {
      assertEmptyAt(this.grid(), x, y);
    },

    /**
     * Assert landmark at position
     */
    assertLandmark(x, y, owner, isHQ = undefined) {
      assertLandmarkAt(this.grid(), x, y, owner, isHQ);
    },

    /**
     * Assert agent at position
     */
    assertAgent(x, y, owner, count = undefined) {
      assertAgentAt(this.grid(), x, y, owner, count);
    },

    /**
     * Assert landmark count for player
     */
    assertLandmarkCount(owner, expected) {
      assertLandmarkCount(this.grid(), owner, expected);
    },

    /**
     * Log current board state to console
     */
    log() {
      console.log(toAscii(gameState, { includeHeader: true, includeFooter: true }));
    },
  };
}
