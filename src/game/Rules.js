/**
 * Trinity - Game Rules
 * Placement validation, landmark detection, and game rule enforcement
 */

import { TileType, isTrinity } from './TileTypes.js';
import { BOARD } from '../config.js';

/**
 * Get orthogonally adjacent positions
 * @param {number} x
 * @param {number} y
 * @returns {Array<{x: number, y: number}>} Adjacent positions
 */
export function getAdjacentPositions(x, y) {
  const adjacent = [
    { x: x - 1, y },      // Left
    { x: x + 1, y },      // Right
    { x, y: y - 1 },      // Up
    { x, y: y + 1 },      // Down
  ];

  // Filter to valid board positions
  return adjacent.filter(pos =>
    pos.x >= 0 && pos.x < BOARD.SIZE &&
    pos.y >= 0 && pos.y < BOARD.SIZE
  );
}

/**
 * Check if a position is in a player's starting zone
 * @param {number} x
 * @param {number} y
 * @param {number} playerIndex
 * @param {number} playerCount
 * @returns {boolean}
 */
export function isInStartingZone(x, y, playerIndex, playerCount) {
  const size = BOARD.SIZE;

  if (playerCount === 2) {
    // 2 players: opposite sides (rows 0-1 and 6-7)
    if (playerIndex === 0) {
      return y <= 1; // Top two rows
    } else {
      return y >= size - 2; // Bottom two rows
    }
  } else {
    // 3-4 players: corners (2x2 zones)
    const corners = [
      { minX: 0, maxX: 1, minY: 0, maxY: 1 },             // Top-left
      { minX: size - 2, maxX: size - 1, minY: 0, maxY: 1 }, // Top-right
      { minX: 0, maxX: 1, minY: size - 2, maxY: size - 1 }, // Bottom-left
      { minX: size - 2, maxX: size - 1, minY: size - 2, maxY: size - 1 }, // Bottom-right
    ];

    const zone = corners[playerIndex];
    if (!zone) return false;

    return x >= zone.minX && x <= zone.maxX &&
           y >= zone.minY && y <= zone.maxY;
  }
}

/**
 * Get all tiles owned by a player from the board state
 * @param {Map} boardTiles - Map of "x,y" -> tile
 * @param {number} playerIndex
 * @returns {Array<{x: number, y: number, tile: Object}>}
 */
export function getPlayerTiles(boardTiles, playerIndex) {
  const tiles = [];
  for (const [key, tile] of boardTiles) {
    if (tile.owner === playerIndex || tile.placedBy === playerIndex) {
      const [x, y] = key.split(',').map(Number);
      tiles.push({ x, y, tile });
    }
  }
  return tiles;
}

/**
 * Check if a player has any tiles on the board
 * @param {Map} boardTiles
 * @param {number} playerIndex
 * @returns {boolean}
 */
export function playerHasTiles(boardTiles, playerIndex) {
  for (const tile of boardTiles.values()) {
    if (tile.owner === playerIndex || tile.placedBy === playerIndex) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a tile placement is valid
 * @param {Map} boardTiles - Map of "x,y" -> tile
 * @param {number} x - Target X position
 * @param {number} y - Target Y position
 * @param {number} playerIndex - Player attempting placement
 * @param {number} playerCount - Total players in game
 * @returns {{valid: boolean, reason?: string}}
 */
export function canPlaceTile(boardTiles, x, y, playerIndex, playerCount) {
  // Check board bounds
  if (x < 0 || x >= BOARD.SIZE || y < 0 || y >= BOARD.SIZE) {
    return { valid: false, reason: 'Position outside board bounds' };
  }

  // Check if position is already occupied
  const key = `${x},${y}`;
  if (boardTiles.has(key)) {
    return { valid: false, reason: 'Position already occupied' };
  }

  // Check adjacency requirement
  const hasOwnTiles = playerHasTiles(boardTiles, playerIndex);

  if (!hasOwnTiles) {
    // No tiles on board - must place in starting zone
    if (!isInStartingZone(x, y, playerIndex, playerCount)) {
      return { valid: false, reason: 'First tile must be placed in your starting zone' };
    }
    return { valid: true };
  }

  // Has tiles - must place adjacent to own tile
  const adjacent = getAdjacentPositions(x, y);
  const hasAdjacentOwnTile = adjacent.some(pos => {
    const adjTile = boardTiles.get(`${pos.x},${pos.y}`);
    return adjTile && (adjTile.owner === playerIndex || adjTile.placedBy === playerIndex);
  });

  if (!hasAdjacentOwnTile) {
    return { valid: false, reason: 'Tile must be placed adjacent to one of your existing tiles' };
  }

  return { valid: true };
}

/**
 * Find all valid placement positions for a player
 * @param {Map} boardTiles
 * @param {number} playerIndex
 * @param {number} playerCount
 * @returns {Array<{x: number, y: number}>}
 */
export function getValidPlacements(boardTiles, playerIndex, playerCount) {
  const valid = [];

  for (let x = 0; x < BOARD.SIZE; x++) {
    for (let y = 0; y < BOARD.SIZE; y++) {
      const result = canPlaceTile(boardTiles, x, y, playerIndex, playerCount);
      if (result.valid) {
        valid.push({ x, y });
      }
    }
  }

  return valid;
}

/**
 * Check if a tile is valid for Trinity formation (owned by player, not already in landmark)
 * @param {Object} tile
 * @param {number} playerIndex
 * @returns {boolean}
 */
function isValidTileForTrinity(tile, playerIndex) {
  if (!tile) return false;
  if (tile.owner !== playerIndex && tile.placedBy !== playerIndex) return false;
  if (tile.isLandmark || tile.isPartOfLandmark) return false;
  return true;
}

/**
 * Find all connected tiles of a specific type within 2 steps from a starting position
 * Uses recursive neighbor checking to find L-shaped and linear arrangements
 * @param {Map} boardTiles
 * @param {number} startX
 * @param {number} startY
 * @param {string} targetType - The tile type to find
 * @param {number} playerIndex
 * @param {Set} visited - Already visited positions
 * @param {number} depth - Current recursion depth (max 2 for 3-tile arrangements)
 * @returns {Array<{x: number, y: number}>} Found tile positions
 */
function findConnectedTilesOfType(boardTiles, startX, startY, targetType, playerIndex, visited, depth = 0) {
  const results = [];
  if (depth > 2) return results; // Max 2 steps for 3-tile Trinity

  const adjacent = getAdjacentPositions(startX, startY);

  for (const pos of adjacent) {
    const key = `${pos.x},${pos.y}`;
    if (visited.has(key)) continue;

    const tile = boardTiles.get(key);
    if (!isValidTileForTrinity(tile, playerIndex)) continue;

    if (tile.type === targetType) {
      results.push({ x: pos.x, y: pos.y });
    }

    // Continue searching through this tile (for L-shapes and linear arrangements)
    if (depth < 1) {
      visited.add(key);
      const deeper = findConnectedTilesOfType(boardTiles, pos.x, pos.y, targetType, playerIndex, visited, depth + 1);
      results.push(...deeper);
    }
  }

  return results;
}

/**
 * Check if three tiles form a connected group (all mutually reachable)
 * @param {{x: number, y: number}} pos1
 * @param {{x: number, y: number}} pos2
 * @param {{x: number, y: number}} pos3
 * @returns {boolean}
 */
function areTilesConnected(pos1, pos2, pos3) {
  // Check if tiles are orthogonally adjacent
  const isAdjacent = (a, b) => {
    return (Math.abs(a.x - b.x) === 1 && a.y === b.y) ||
           (Math.abs(a.y - b.y) === 1 && a.x === b.x);
  };

  // For 3 tiles to be connected, we need at least 2 adjacency connections
  // Valid arrangements:
  // 1. L-shape: one tile (corner) adjacent to both others
  // 2. Linear: middle tile adjacent to both ends
  const adj12 = isAdjacent(pos1, pos2);
  const adj13 = isAdjacent(pos1, pos3);
  const adj23 = isAdjacent(pos2, pos3);

  // Count adjacencies - need at least 2 for a connected group of 3
  const adjacencyCount = (adj12 ? 1 : 0) + (adj13 ? 1 : 0) + (adj23 ? 1 : 0);

  return adjacencyCount >= 2;
}

/**
 * Check if a Housing tile at a given position can form a Trinity
 * Supports L-shaped and linear arrangements by checking recursively through neighbors
 * Trinity always forms on the Housing tile position
 * @param {Map} boardTiles - Current board state (should include the newly placed tile)
 * @param {number} hx - Housing tile X position
 * @param {number} hy - Housing tile Y position
 * @param {number} playerIndex - Player who owns the tiles
 * @returns {{housing: {x,y}, commerce: {x,y}, industry: {x,y}}|null} Landmark config or null
 */
function checkHousingForTrinity(boardTiles, hx, hy, playerIndex) {
  const housingTile = boardTiles.get(`${hx},${hy}`);

  // Verify this is actually a Housing tile owned by the player
  if (!housingTile || housingTile.type !== TileType.HOUSING) return null;
  if (!isValidTileForTrinity(housingTile, playerIndex)) return null;

  const housingPos = { x: hx, y: hy };
  const visited = new Set([`${hx},${hy}`]);

  // Find all reachable Commerce tiles (direct or through one intermediate tile)
  const commerceTiles = findConnectedTilesOfType(boardTiles, hx, hy, TileType.COMMERCE, playerIndex, new Set(visited), 0);

  // Find all reachable Industry tiles
  const industryTiles = findConnectedTilesOfType(boardTiles, hx, hy, TileType.INDUSTRY, playerIndex, new Set(visited), 0);

  // Try all combinations of Commerce and Industry to find a valid connected Trinity
  for (const commerce of commerceTiles) {
    for (const industry of industryTiles) {
      // Check that all three tiles form a connected group
      if (areTilesConnected(housingPos, commerce, industry)) {
        return {
          housing: housingPos,
          commerce,
          industry
        };
      }
    }
  }

  return null;
}

/**
 * Get all positions within N steps of a starting position (for searching nearby Housing tiles)
 * @param {number} x
 * @param {number} y
 * @param {number} maxSteps
 * @returns {Array<{x: number, y: number}>}
 */
function getPositionsWithinSteps(x, y, maxSteps) {
  const positions = [];
  const visited = new Set([`${x},${y}`]);
  let frontier = [{ x, y }];

  for (let step = 0; step < maxSteps; step++) {
    const nextFrontier = [];
    for (const pos of frontier) {
      const adjacent = getAdjacentPositions(pos.x, pos.y);
      for (const adj of adjacent) {
        const key = `${adj.x},${adj.y}`;
        if (!visited.has(key)) {
          visited.add(key);
          positions.push(adj);
          nextFrontier.push(adj);
        }
      }
    }
    frontier = nextFrontier;
  }

  return positions;
}

/**
 * Check if placing a tile at a position would form a landmark
 * Trinity Propagation Rule: Check Housing tiles within 2 steps of the placed tile
 * Supports L-shaped and linear arrangements (H-C-I, H-I-C, C-H-I, etc.)
 * Trinity always forms ON the Housing tile
 * @param {Map} boardTiles - Current board state
 * @param {number} x
 * @param {number} y
 * @param {string} tileType - Type of tile being placed
 * @param {number} playerIndex
 * @returns {Array<{housing: {x,y}, commerce: {x,y}, industry: {x,y}}>} Array of potential landmarks
 */
export function detectPotentialLandmarks(boardTiles, x, y, tileType, playerIndex) {
  const landmarks = [];
  const checkedHousingPositions = new Set();

  console.log(`[Trinity Check] New tile placed: ${tileType.toUpperCase()} at (${x}, ${y}) by Player ${playerIndex + 1}`);

  // Create a temporary board state with the new tile included
  // (in case the caller hasn't added it yet)
  const tempBoard = new Map(boardTiles);
  const newTileKey = `${x},${y}`;
  if (!tempBoard.has(newTileKey)) {
    tempBoard.set(newTileKey, {
      type: tileType,
      owner: playerIndex,
      placedBy: playerIndex,
      isLandmark: false,
      isPartOfLandmark: false
    });
  }

  // 1. If the placed tile is Housing, check if IT can form a Trinity
  if (tileType === TileType.HOUSING) {
    console.log(`[Trinity Check] Checking placed Housing tile at (${x}, ${y})`);
    const landmark = checkHousingForTrinity(tempBoard, x, y, playerIndex);
    if (landmark) {
      console.log(`[Trinity Check] ✓ TRINITY FOUND at Housing (${x},${y})!`);
      landmarks.push(landmark);
    }
    checkedHousingPositions.add(`${x},${y}`);
  }

  // 2. Check all Housing tiles within 2 steps (for L-shaped arrangements)
  // The newly placed tile might complete a Trinity for a nearby Housing
  const nearbyPositions = getPositionsWithinSteps(x, y, 2);

  for (const pos of nearbyPositions) {
    const key = `${pos.x},${pos.y}`;
    if (checkedHousingPositions.has(key)) continue;

    const tile = tempBoard.get(key);
    if (!tile) continue;
    if (tile.type !== TileType.HOUSING) continue;
    if (!isValidTileForTrinity(tile, playerIndex)) continue;

    console.log(`[Trinity Check] Checking nearby Housing tile at (${pos.x}, ${pos.y})`);
    const landmark = checkHousingForTrinity(tempBoard, pos.x, pos.y, playerIndex);
    if (landmark) {
      console.log(`[Trinity Check] ✓ TRINITY FOUND at nearby Housing (${pos.x},${pos.y})!`);
      landmarks.push(landmark);
    }
    checkedHousingPositions.add(key);
  }

  if (landmarks.length === 0) {
    console.log(`[Trinity Check] No Trinity formed this placement`);
  }

  return landmarks;
}

/**
 * Check if the board is full (game end condition)
 * @param {Map} boardTiles
 * @returns {boolean}
 */
export function isBoardFull(boardTiles) {
  return boardTiles.size >= BOARD.SIZE * BOARD.SIZE;
}

/**
 * Count landmarks for a player
 * @param {Map} boardTiles
 * @param {number} playerIndex
 * @returns {number}
 */
export function countPlayerLandmarks(boardTiles, playerIndex) {
  let count = 0;
  for (const tile of boardTiles.values()) {
    if ((tile.owner === playerIndex || tile.placedBy === playerIndex) && tile.isLandmark) {
      count++;
    }
  }
  return count;
}

/**
 * Determine winner at end of game
 * @param {Array<Object>} players - Player objects with scores
 * @returns {{winner: number, tied: boolean, tiedPlayers?: number[]}}
 */
export function determineWinner(players) {
  let maxScore = -1;
  let winners = [];

  for (let i = 0; i < players.length; i++) {
    const score = players[i].landmarks || 0;
    if (score > maxScore) {
      maxScore = score;
      winners = [i];
    } else if (score === maxScore) {
      winners.push(i);
    }
  }

  if (winners.length === 1) {
    return { winner: winners[0], tied: false };
  }

  return { winner: winners[0], tied: true, tiedPlayers: winners };
}
