# Trinity - Improvement Plan 02: Rulebook Compliance

## Overview

This plan addresses missing features identified by comparing the rulebook against the implemented codebase. Items are organized by priority and grouped by system for efficient implementation.

---

## Priority 1: Core Game Rules (Critical)

### 1.1 Fix HQ Scoring (HQ Should NOT Count Toward Victory)

**Problem:** `HQ_LANDMARK_VALUE: 2` adds points for HQ. Rulebook says HQ don't count.

**Files:** `src/game/GameRules.js`, `src/controllers/GameController.js`

**Changes:**
- Set `HQ_LANDMARK_VALUE: 0` in GameRules.js
- Update `getScores()` to exclude HQ from landmark count
- Score = landmarks only (HQ are strategic, not victory points)

**Acceptance:** Player with 3 Landmarks and 1 HQ scores 3 points, not 5.

---

### 1.2 Implement Landmark Bonus Draw

**Problem:** Players should draw 1 tile + 1 per Landmark owned. Currently uses flat refill.

**Files:** `src/game/GameRules.js`, `src/controllers/GameController.js`

**Changes:**
- Add `LANDMARK_DRAW_BONUS: true` to GameRules.js
- Modify `_refillPlayerHand()` or create `_calculateDrawCount(playerIndex)`:
  ```javascript
  const baseDraws = 1;
  const landmarkBonus = gameState.getPlayer(playerIndex).landmarks;
  return baseDraws + landmarkBonus;
  ```
- Apply in draw phase of turn

**Acceptance:** Player with 2 Landmarks draws 3 tiles at turn start.

---

### 1.3 Implement Underdog Rule

**Problem:** Player(s) with fewest Landmarks should draw +1 extra tile.

**Files:** `src/game/GameRules.js`, `src/controllers/GameController.js`

**Changes:**
- Add `UNDERDOG_BONUS_ENABLED: true` to GameRules.js
- In draw phase, find minimum landmark count among all players
- If current player is tied for minimum, add +1 to draw count
- Combine with Landmark Bonus Draw (1.2)

**Acceptance:** Player with 0 Landmarks (when others have 1+) draws 2 tiles (1 base + 1 underdog).

---

### 1.4 Event Card on Landmark Formation

**Problem:** Building a Landmark should award 1 Event Card.

**Files:** `src/controllers/GameController.js`, `src/state/GameState.js`

**Changes:**
- In `_checkAndFormLandmarks()`, after landmark creation:
  ```javascript
  const event = this._gameState.drawEventToHand(currentPlayer);
  if (event) {
    console.log(`Drew event: ${event.name}`);
  }
  ```
- Emit event for UI notification

**Acceptance:** When Trinity forms, player automatically receives 1 Event card.

---

### 1.5 Implement Tiebreaker Resolution

**Problem:** Tie detected but not resolved. Rules: (1) most secured Landmarks, (2) most tiles in hand.

**Files:** `src/controllers/GameController.js`

**Changes:**
- Modify `_determineWinner()` to apply tiebreakers:
  ```javascript
  // Tiebreaker 1: Count secured landmarks (landmarks with agents)
  // Tiebreaker 2: Count tiles in hand
  ```
- Return single winner after tiebreakers, or true tie if still equal

**Acceptance:** Two players with 3 Landmarks each → player with more secured Landmarks wins.

---

### 1.6 Allow Multiple Tiles Per Turn (Classic Mode)

**Problem:** Rulebook allows "any number of tiles" per turn. Simple mode limits to 1.

**Files:** `src/game/GameRules.js`, `src/controllers/GameController.js`

**Changes:**
- Add `UNLIMITED_PLACEMENT: true` for classic mode
- When enabled, `TILES_PER_TURN` becomes unlimited (or set to 99)
- Keep simple mode as-is for quick games

**Acceptance:** In classic mode, player can place 3 tiles in one Development phase.

---

## Priority 2: Agent & Takeover Mechanics

### 2.1 Implement Reposition Action

**Problem:** Spend 1 Agent to remove own basic tile and return to hand.

**Files:** `src/controllers/GameController.js`, `src/state/GameState.js`

**Changes:**
- Add `repositionTile(x, y)` method:
  ```javascript
  // Validate: tile exists, owned by player, not part of landmark/HQ
  // Validate: player has agent at or adjacent to position
  // Remove tile from board, add to player hand
  // Remove 1 agent (return to draw pile)
  ```
- Add UI button/action for reposition

**Acceptance:** Player with agent can spend it to pick up adjacent owned tile.

---

### 2.2 Basic Tile Capture (Ownership Transfer)

**Problem:** Takeover of basic tile should transfer ownership, not destroy.

**Files:** `src/controllers/GameController.js`

**Changes:**
- In `attemptTakeover()`, for basic tiles:
  ```javascript
  // Change tile.placedBy to attacker
  // Remove attacking agents (to draw pile)
  // Tile stays in place, now attacker's
  ```
- Different from landmark takeover (settlement/destruction)

**Acceptance:** Attack basic tile with 1 agent → tile becomes yours, agent discarded.

---

### 2.3 Verify Settlement Mechanics (Landmark/HQ Takeover)

**Problem:** Attacking Landmark/HQ should destroy BOTH attacker agents AND defender stack.

**Files:** `src/controllers/GameController.js`

**Changes:**
- Review `_executeContestLandmark()` and `_executeCaptureNoteworthyLandmark()`
- Ensure mutual destruction: all attacking agents + all defender tiles/agents removed
- Space becomes empty

**Acceptance:** Attack HQ with 3 agents → both HQ and 3 agents removed, space empty.

---

### 2.4 Agents Count as Board Occupation

**Problem:** Deployed agents on empty spaces should count toward "board full" end condition.

**Files:** `src/game/Rules.js`, `src/controllers/GameController.js`

**Changes:**
- Modify `isBoardFull()`:
  ```javascript
  // Count: tiles + landmarks + agent-only positions
  const tileCount = boardTiles.size;
  const landmarkCount = landmarks.length;
  const agentOnlySpaces = countAgentOnlyPositions();
  return (tileCount + landmarkCount + agentOnlySpaces) >= 64;
  ```

**Acceptance:** 60 tiles + 4 agent-only spaces = board full, game ends.

---

## Priority 3: Event Card Effects

### 3.1 Implement STEAL_TILE_TO_HAND (Hostile Acquisition)

**Files:** `src/controllers/GameController.js`

**Effect:** Remove opponent's basic tile from board, add to your hand.

**Implementation:**
```javascript
case 'STEAL_TILE_TO_HAND':
  const tile = this._gameState.removeTile(target.x, target.y);
  this._gameState.addTileToHand(currentPlayer, tile);
  break;
```

---

### 3.2 Implement CHANGE_TILE_TYPE (Conversion Permit)

**Files:** `src/controllers/GameController.js`

**Effect:** Change one of your tiles to a different type.

**Implementation:**
```javascript
case 'CHANGE_TILE_TYPE':
  const tile = this._gameState.getTile(target.x, target.y);
  tile.type = event.effectParams.newType; // Or prompt user for type
  break;
```

---

### 3.3 Implement MOVE_OWN_TILE (Urban Renewal)

**Files:** `src/controllers/GameController.js`

**Effect:** Move one of your basic tiles to an adjacent empty space.

**Implementation:**
```javascript
case 'MOVE_OWN_TILE':
  const tile = this._gameState.removeTile(target.fromX, target.fromY);
  this._gameState.placeTile(target.toX, target.toY, tile);
  break;
```

---

### 3.4 Implement IGNORE_ADJACENCY (Shell Company)

**Files:** `src/controllers/GameController.js`

**Effect:** Place next tile ignoring adjacency rules (anywhere on board).

**Implementation:**
- Set flag `this._ignoreAdjacencyNextTile = true`
- In `tryPlaceTile()`, skip adjacency check if flag is set
- Clear flag after placement

---

### 3.5 Implement SWAP_TILES (Backroom Deal)

**Files:** `src/controllers/GameController.js`

**Effect:** Swap positions of your tile with an adjacent opponent tile.

**Implementation:**
```javascript
case 'SWAP_TILES':
  const myTile = this._gameState.removeTile(target.myX, target.myY);
  const theirTile = this._gameState.removeTile(target.theirX, target.theirY);
  this._gameState.placeTile(target.myX, target.myY, theirTile);
  this._gameState.placeTile(target.theirX, target.theirY, myTile);
  break;
```

---

### 3.6 Implement CHANGE_OPPONENT_TILE_TYPE (Hostile Rezoning)

**Files:** `src/controllers/GameController.js`

**Effect:** Change an opponent's basic tile to a different type.

---

### 3.7 Implement MOVE_OPPONENT_AGENT (Double Agent)

**Files:** `src/controllers/GameController.js`

**Effect:** Move one opponent agent to an adjacent space.

---

### 3.8 Implement FREE_CAPTURE (Hostile Expansion)

**Files:** `src/controllers/GameController.js`

**Effect:** Capture adjacent opponent basic tile without spending agents.

---

### 3.9 Implement PEEK_AND_REORDER_DECK (Insider Trading)

**Files:** `src/controllers/GameController.js`, `src/state/GameState.js`

**Effect:** Look at top 5 tiles of draw pile, reorder them.

**Implementation:**
- Add `peekDrawPile(count)` and `reorderDrawPile(newOrder)` to GameState
- UI: Show tiles, let player drag to reorder, confirm

---

### 3.10 Implement VIEW_HIDDEN_INFO (Stakeout)

**Files:** `src/controllers/GameController.js`

**Effect:** View opponent's event cards and top 3 tiles of draw pile.

**Implementation:**
- UI modal showing opponent events + deck peek
- Information only, no state change

---

### 3.11 Implement RECOVER_ON_TAKEOVER Trigger (Insurance Claim)

**Files:** `src/controllers/GameController.js`

**Effect:** When your landmark is taken over, draw 2 tiles and 1 event.

**Implementation:**
- Add event trigger system: `ON_LANDMARK_LOST`
- Check player's tactical events for matching triggers
- Auto-activate or prompt to use

---

## Priority 4: Setup & UX

### 4.1 Implement Starting Player Determination

**Problem:** Should draw tiles to determine; Housing > Commerce > Industry.

**Files:** `src/controllers/GameController.js`

**Changes:**
- Before game start, each player draws 1 tile
- Compare: H > C > I
- Highest goes first, ties redraw
- Return tiles to bottom of deck

---

### 4.2 Implement Mulligan System

**Problem:** Players should be able to mulligan starting hand once.

**Files:** `src/controllers/GameController.js`, UI

**Changes:**
- After initial deal, offer mulligan button
- If used: shuffle hand back, draw 5 new, disable button
- Track `player.mulliganUsed = true`

---

### 4.3 Implement Event Draft at Game Start

**Problem:** Deal 2, keep 1, pass 1 left mechanic missing.

**Files:** `src/controllers/GameController.js`, UI

**Changes:**
- Deal 2 events to each player
- UI: Show both, player picks one to keep
- Pass unchosen to player on left
- Each player ends with 2 events (1 chosen + 1 received)

---

### 4.4 Show Opponent Hands (Open Hand Rule)

**Problem:** All tiles should be visible to all players.

**Files:** `src/renderer/UIRenderer.js`

**Changes:**
- Add panel showing other players' hands
- Position: corners or side panels
- Show tile types with player color indicator

---

### 4.5 Visual Indicator for Secured Properties

**Problem:** Tiles/Landmarks with agents on them need visual distinction.

**Files:** `src/renderer/TileRenderer.js`, `src/shaders/tile.frag.glsl`

**Changes:**
- Pass `isSecured` flag to shader
- Add subtle shield icon or border glow for secured tiles
- Different from HQ glow (maybe blue tint)

---

## Implementation Order

**Phase 1 - Core Rules (Do First):**
1. 1.1 Fix HQ Scoring
2. 1.4 Event on Landmark Formation
3. 1.5 Tiebreaker Resolution

**Phase 2 - Draw Mechanics:**
4. 1.2 Landmark Bonus Draw
5. 1.3 Underdog Rule

**Phase 3 - Agent Actions:**
6. 2.1 Reposition Action
7. 2.2 Basic Tile Capture
8. 2.3 Settlement Verification
9. 2.4 Agents Count as Occupation

**Phase 4 - Event Effects (Can parallelize):**
10. All Priority 3 items (3.1 - 3.11)

**Phase 5 - Setup & Polish:**
11. All Priority 4 items (4.1 - 4.5)

---

## Files Quick Reference

| File | Changes |
|------|---------|
| `src/game/GameRules.js` | Config flags, scoring values |
| `src/controllers/GameController.js` | Most game logic changes |
| `src/state/GameState.js` | State methods (peek, reorder, etc.) |
| `src/game/Rules.js` | Board full calculation |
| `src/renderer/UIRenderer.js` | Opponent hands, UI elements |
| `src/renderer/TileRenderer.js` | Secured visual indicator |
| `src/shaders/tile.frag.glsl` | Secured shader effect |
