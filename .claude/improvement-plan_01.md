# Trinity - Improvement Plan 01

Priority list of improvements, fixes, and missing features.

**Status: ALL COMPLETE** (28/28 items implemented)

---

## Priority 1: Critical Functionality ✅ COMPLETE

### 1.1 Event Card Targeting System ✅ DONE

**Status:** Implemented in main.js with `handleTargetSelection()`, `enterTargetingMode()`, `exitTargetingMode()`

**Description:** Implement target selection UI for events that require targets (tiles, agents, opponents, landmarks).

---

### 1.2 Agent Visual Rendering ✅ DONE

**Status:** Implemented in TileRenderer.js with `renderAgents()` method

**Description:** Add visual representation of agents on the board.

---

### 1.3 HQ Visual Distinction ✅ DONE

**Status:** Implemented with `u_isHQ` uniform in tile.frag.glsl

**Description:** Visually distinguish HQ landmarks from regular landmarks.

---

## Priority 2: Test Coverage ✅ COMPLETE

### 2.1 Event Cards Unit Tests ✅ DONE

**Status:** EventCards.test.js (38 tests)

---

### 2.2 GameController Unit Tests ✅ DONE

**Status:** GameController.test.js (60 tests)

---

### 2.3 GameState Event/Agent Tests ✅ DONE

**Status:** GameState.test.js (65 tests)

---

### 2.4 Integration Tests ✅ DONE

**Status:** Integration.test.js (21 tests)

---

## Priority 3: Gameplay Features ✅ COMPLETE

### 3.1 Agent Phase UI ✅ DONE

**Status:** Implemented in UIRenderer with `selectAgent()`, `clearAgentSelection()`, `getValidAgentMoves()`

---

### 3.2 HQ Conversion UI ✅ DONE

**Status:** Implemented in main.js with `showHQConversionPrompt()`

---

### 3.3 Takeover UI Flow ✅ DONE

**Status:** Implemented in UIRenderer with `setTakeoverTarget()`, `_renderTakeoverPanel()`

---

### 3.4 Event Effect Animations ✅ DONE

**Status:** Implemented in AnimationManager with EVENT_EFFECT, TILE_CAPTURE, HQ_CONVERT, SETTLEMENT, AGENT_MOVE

---

## Priority 4: Missing Event Effects ✅ COMPLETE

### 4.1 Insider Trading Effect ✅ DONE

**Status:** Implemented in GameController with `_effectPeekAndReorderDeck()`

---

### 4.2 Stakeout Effect ✅ DONE

**Status:** Implemented in GameController with `_effectViewHiddenInfo()`

---

### 4.3 Insurance Claim Trigger ✅ DONE

**Status:** Implemented in GameController with `_checkInsuranceClaimTrigger()`

---

## Priority 5: Visual Polish ✅ COMPLETE

### 5.1 Agent Movement Animation ✅ DONE

**Status:** Implemented in AnimationManager with `animateAgentMove()`

---

### 5.2 HQ Conversion Animation ✅ DONE

**Status:** Implemented in AnimationManager with `animateHQConversion()`

---

### 5.3 Takeover/Battle Animation ✅ DONE

**Status:** Implemented in AnimationManager with `animateSettlement()`, `animateTileCapture()`

---

### 5.4 Agent Spawn Animation ✅ DONE

**Status:** Implemented in AnimationManager with `animateAgentSpawn()`

---

### 5.5 Refraction Shader ✅ DONE

**Status:** Implemented in tile.frag.glsl with `caustics()`, `chromaticAberration()`, `refract_custom()`

**Description:** Glass-like caustics and chromatic aberration effects for milky glass look.

---

## Priority 6: Game Flow Enhancements ✅ COMPLETE

### 6.1 Mulligan Option ✅ DONE

**Status:** Implemented in GameController with `requestMulligan()`

---

### 6.2 Event Draft Phase ✅ DONE

**Status:** Implemented in GameController with `_executeEventDraft()`

---

### 6.3 Turn Transition Animation ✅ DONE

**Status:** Implemented in UIRenderer with `startTurnTransition()`, `_renderTurnTransition()`

**Description:** Animated overlay when turn changes showing "Player X - Your Turn".

---

### 6.4 State History / Undo ✅ DONE

**Status:** Implemented in GameState with `saveStateForUndo()`, `undo()`, `canUndo()`

**Description:** Press Z to undo last tile placement. History limited to 10 states.

---

## Priority 7: Quality of Life ✅ COMPLETE

### 7.1 Valid Placement Preview ✅ DONE

**Status:** Implemented in TileRenderer with `renderPreview()` - ghost tile at cursor

**Description:** Shows transparent preview tile at cursor when placing.

---

### 7.2 Landmark Formation Preview ✅ DONE

**Status:** Implemented in BoardRenderer with `setLandmarkPreview()` and board.frag.glsl

**Description:** Golden glow on tiles that would form a landmark when hovering over valid placement.

---

### 7.3 Player Color Coding ✅ DONE

**Status:** Implemented in tile.frag.glsl with `u_playerColor` uniform

**Description:** Player 1 = blue tint, Player 2 = red/orange tint on tile edges.

---

### 7.4 Tooltip System ✅ DONE

**Status:** Implemented in UIRenderer with `showTooltip()`, `updateTooltip()`, `_renderTooltip()`

**Description:** Hover over tiles, events, or buttons to see tooltips.

---

### 7.5 Game Rules Reference ✅ DONE

**Status:** Implemented in UIRenderer with `toggleHelp()`, `_renderHelpOverlay()`

**Description:** Press ? or H to show help overlay with rules and controls.

---

## Summary

| Priority | Items | Status |
|----------|-------|--------|
| 1 | 3 | ✅ Complete |
| 2 | 4 | ✅ Complete |
| 3 | 4 | ✅ Complete |
| 4 | 3 | ✅ Complete |
| 5 | 5 | ✅ Complete |
| 6 | 4 | ✅ Complete |
| 7 | 5 | ✅ Complete |

**Total: 28/28 items complete**

---

*Created: 2026-01-29*
*Completed: 2026-01-30*
*Based on: implementation.md analysis and verification report*
