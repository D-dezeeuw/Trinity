# Trinity - Improvement Plan 03: Combo Placement System

## Overview

This plan implements the **Combo Placement** optional rule, allowing players to chain multiple tile placements in a single turn when each new tile connects to a different-type neighbor owned by the player.

---

## Rule Definition

**Combo Placement:**
- After placing the first tile of a turn, the player may place additional tiles.
- Each subsequent tile must be placed adjacent to **any tile the player owns that has a different type** than the tile being placed.
- The chain continues as long as valid different-type connections are available.
- No maximum chain length (unlimited by default).

**Valid Examples:**
- Place Housing → Place Commerce (adjacent to player's Industry) → Place Industry (adjacent to player's Commerce)
- Place Commerce next to own Housing → Place Housing next to own Industry

**Invalid Examples:**
- Place Commerce when only adjacent to own Commerce tiles (same type, cannot continue combo)
- Place Housing when no different-type neighbors exist

---

## Priority 1: Configuration Flags

### 1.1 Add Combo Configuration to GameRules.js

**File:** `src/game/GameRules.js`

**Changes:**
```javascript
// Combo Placement Configuration
COMBO_ENABLED: false,        // Set to true to enable combo placement
COMBO_MAX_CHAIN: Infinity,   // Maximum tiles in a combo chain (Infinity = unlimited)
```

**Acceptance:** Flags exist and default to disabled for backward compatibility.

---

## Priority 2: Core Logic Implementation

### 2.1 Track Combo State During Turn

**File:** `src/controllers/GameController.js`

**Changes:**
- Add state tracking:
  ```javascript
  this._comboCount = 0;           // Tiles placed this turn
  this._comboActive = false;      // Whether combo is currently active
  ```
- Reset at turn start:
  ```javascript
  _startTurn() {
    this._comboCount = 0;
    this._comboActive = false;
    // ... existing code
  }
  ```

**Acceptance:** Combo count resets each turn.

---

### 2.2 Implement Combo Validation Logic

**File:** `src/controllers/GameController.js`

**Changes:**
- Add `_canContinueCombo(tileType, x, y)` method:
  ```javascript
  _canContinueCombo(tileType, x, y) {
    if (!GameRules.COMBO_ENABLED) return false;
    if (this._comboCount >= GameRules.COMBO_MAX_CHAIN) return false;

    // Get all orthogonal neighbors
    const neighbors = this._getOrthogonalNeighbors(x, y);

    // Check if any neighbor is owned by current player AND different type
    const currentPlayer = this._gameState.getCurrentPlayer();
    for (const neighbor of neighbors) {
      const tile = this._gameState.getTile(neighbor.x, neighbor.y);
      if (tile &&
          tile.placedBy === currentPlayer &&
          tile.type !== tileType) {
        return true;
      }
    }
    return false;
  }
  ```

**Acceptance:** Method returns true only when valid combo placement exists.

---

### 2.3 Implement Combo Placement Check

**File:** `src/controllers/GameController.js`

**Changes:**
- Add `getValidComboNeighbors(tileType)` method:
  ```javascript
  getValidComboNeighbors(tileType) {
    if (!GameRules.COMBO_ENABLED) return [];

    const currentPlayer = this._gameState.getCurrentPlayer();
    const playerTiles = this._gameState.getPlayerTiles(currentPlayer);
    const validPositions = [];

    for (const tile of playerTiles) {
      // Only consider tiles of different type
      if (tile.type === tileType) continue;

      // Get empty adjacent positions to this tile
      const neighbors = this._getOrthogonalNeighbors(tile.x, tile.y);
      for (const pos of neighbors) {
        if (this._gameState.isEmpty(pos.x, pos.y) &&
            this._isValidBoardPosition(pos.x, pos.y)) {
          // Check adjacency to different-type tile
          validPositions.push({
            x: pos.x,
            y: pos.y,
            connectsTo: { x: tile.x, y: tile.y, type: tile.type }
          });
        }
      }
    }

    return validPositions;
  }
  ```

**Acceptance:** Returns all valid positions for combo placement.

---

### 2.4 Modify Tile Placement to Support Combo

**File:** `src/controllers/GameController.js`

**Changes:**
- Modify `tryPlaceTile()` to track combo:
  ```javascript
  tryPlaceTile(x, y, tileType) {
    // ... existing validation ...

    // First placement or normal adjacency check
    if (this._comboCount === 0 || !GameRules.COMBO_ENABLED) {
      // Normal placement rules
      if (!this._isValidPlacement(x, y, tileType)) {
        return { success: false, reason: 'Invalid placement' };
      }
    } else {
      // Combo placement - must connect to different-type neighbor
      if (!this._canContinueCombo(tileType, x, y)) {
        return { success: false, reason: 'Combo requires different-type neighbor' };
      }
    }

    // Place tile
    const result = this._gameState.placeTile(x, y, tileType, currentPlayer);

    if (result.success) {
      this._comboCount++;
      this._comboActive = GameRules.COMBO_ENABLED &&
                          this._hasMoreComboOptions();
    }

    return result;
  }
  ```

**Acceptance:** Tiles can be placed in combo sequence following the rule.

---

### 2.5 Check for More Combo Options

**File:** `src/controllers/GameController.js`

**Changes:**
- Add `_hasMoreComboOptions()` method:
  ```javascript
  _hasMoreComboOptions() {
    const hand = this._gameState.getPlayerHand(this._gameState.getCurrentPlayer());

    for (const tile of hand) {
      const validPositions = this.getValidComboNeighbors(tile.type);
      if (validPositions.length > 0) {
        return true;
      }
    }
    return false;
  }
  ```

**Acceptance:** Returns true if player can continue placing tiles.

---

## Priority 3: UI Integration

### 3.1 Highlight Valid Combo Positions

**File:** `src/renderer/UIRenderer.js`, `src/main.js`

**Changes:**
- When player selects a tile from hand during active combo:
  - Calculate valid combo positions using `getValidComboNeighbors()`
  - Highlight those positions on the board
  - Use distinct color/style for combo vs normal placement

**Acceptance:** Valid combo positions are visually indicated.

---

### 3.2 Show Combo Counter/Status

**File:** `src/renderer/UIRenderer.js`

**Changes:**
- Display combo count when combo is active:
  ```
  COMBO x3
  ```
- Optional: Add "End Combo" button to skip remaining placements

**Acceptance:** Player sees their current combo chain length.

---

### 3.3 Combo End Conditions

**File:** `src/controllers/GameController.js`

**Changes:**
- Combo ends when:
  1. Player has no more tiles in hand
  2. No valid different-type neighbor positions available
  3. Player chooses to end turn / end combo
  4. Max chain reached (if configured)

**Acceptance:** Combo properly terminates under all conditions.

---

## Priority 4: Testing

### 4.1 Unit Tests for Combo Logic

**File:** `tests/Combo.test.js`

**Test Cases:**
1. Combo disabled - only one tile per placement opportunity
2. First tile uses normal adjacency rules
3. Second tile requires different-type neighbor
4. Combo continues with valid placements
5. Combo ends when no valid placements remain
6. Combo respects COMBO_MAX_CHAIN limit
7. Combo count resets at turn start
8. Combo validation across multiple tile types

**Acceptance:** All combo tests pass.

---

## Configuration Reference

| Flag | Default | Description |
|------|---------|-------------|
| `COMBO_ENABLED` | `false` | Enable combo placement rule |
| `COMBO_MAX_CHAIN` | `Infinity` | Max tiles in one combo (Infinity = unlimited) |

---

## Implementation Order

1. **Phase 1 - Config:** Add flags to GameRules.js
2. **Phase 2 - Logic:** Implement combo validation and placement
3. **Phase 3 - UI:** Add visual feedback for combo state
4. **Phase 4 - Tests:** Write and verify test coverage

---

## Files Quick Reference

| File | Changes |
|------|---------|
| `src/game/GameRules.js` | Add COMBO_ENABLED, COMBO_MAX_CHAIN |
| `src/controllers/GameController.js` | Combo logic, validation, state tracking |
| `src/renderer/UIRenderer.js` | Combo position highlighting, counter |
| `src/main.js` | Integration with click handlers |
| `tests/Combo.test.js` | Unit tests for combo system |
