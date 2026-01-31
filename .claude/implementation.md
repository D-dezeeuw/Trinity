# Trinity — Implementation Plan

## Project Overview

A browser-based prototype of Trinity using vanilla JavaScript, Canvas, and WebGL with custom GLSL shaders. Two human players, hot-seat multiplayer (same device, taking turns).

**Tech Stack:**
- Node.js (development server only)
- HTML5 Canvas (UI layer)
- WebGL 2.0 (3D rendering)
- GLSL (custom shaders)
- No external libraries

---

## Game Rules Configuration

All game mechanics are configurable via `src/game/GameRules.js`:

```javascript
// Turn modes
TURN_MODE: 'simple' | 'classic'
  - 'simple': Place tile → Auto-refill → End (recommended)
  - 'classic': Draw → Develop → Agent → End

// Placement
TILES_PER_TURN: 1          // Tiles that can be placed per turn
HAND_SIZE: 5               // Hand refills to this size
DRAW_MODE: 'refill'        // 'refill' = draw to hand size, 'fixed' = draw exact count

// Other settings
PLAYER_COUNT: 2
TILES_PER_TYPE: 24         // 72 total tiles (24 H + 24 C + 24 I)
AUTO_FORM_LANDMARKS: true  // Auto-form when H+C+I adjacent
```

**Visual Target:**
- Isometric 3D (45° angle top-down)
- Minimalist aesthetic
- Light greys, whites, soft pastels
- Milky transparent tiles with refraction
- Soft luminescence on hover
- Clean lines

---

## Architecture Overview

```
/trinity
├── /src
│   ├── /core           # Game logic (state, rules, validation)
│   ├── /renderer       # WebGL rendering
│   ├── /shaders        # GLSL shader files
│   ├── /ui             # Canvas 2D UI overlay
│   ├── /input          # Mouse/keyboard handling
│   └── /utils          # Math, helpers
├── /assets             # Textures (if any)
├── index.html
├── main.js             # Entry point
├── server.js           # Simple Node.js dev server
└── package.json
```

---

## Phase 1: Project Foundation ✅ COMPLETE

### 1.1 Project Setup
- [x] Create package.json with basic metadata
- [x] Create simple Node.js static file server (no dependencies)
- [x] Create index.html with canvas element
- [x] Create main.js entry point
- [x] Verify server runs and serves files

### 1.2 Canvas & WebGL Initialization
- [x] Create dual-canvas setup (WebGL for 3D, Canvas2D for UI overlay)
- [x] Initialize WebGL 2.0 context with error handling
- [x] Set up render loop with requestAnimationFrame
- [x] Implement basic viewport/resize handling
- [x] Create shader compilation utility functions

### 1.3 Math Utilities
- [x] Implement vec2, vec3, vec4 operations
- [x] Implement mat4 operations (identity, multiply, translate, rotate, scale)
- [x] Implement isometric projection matrix (45° rotation, orthographic)
- [x] Implement screen-to-world coordinate conversion
- [x] Implement world-to-screen coordinate conversion

**Deliverable:** Empty canvas with WebGL context, running render loop, resizable. ✅ COMPLETE

---

## Phase 2: Isometric Board Rendering ✅ COMPLETE

### 2.1 Board Geometry
- [x] Define board constants (8x8 grid, tile size, spacing)
- [x] Create vertex data for a single tile (flat square with beveled edges)
- [x] Create vertex buffer for entire board grid
- [x] Calculate isometric positions for all 64 tiles

### 2.2 Basic Board Shader
- [x] Create vertex shader with isometric projection
- [x] Create fragment shader with checkerboard pattern
- [x] Implement light grey/white alternating colors
- [x] Add subtle grid lines between tiles
- [x] Add ambient lighting

### 2.3 Board Interaction
- [x] Implement mouse position tracking
- [x] Convert mouse position to board coordinates (isometric picking)
- [x] Highlight hovered tile with color change
- [x] Implement smooth hover transition (fade in/out)

**Deliverable:** Rendered 8x8 isometric board with hover highlighting. ✅ COMPLETE

---

## Phase 3: Tile Rendering ✅ COMPLETE

### 3.1 Tile Geometry
- [x] Create 3D tile mesh (rounded rectangular prism)
- [x] Add slight bevel to edges
- [x] Create vertex normals for lighting
- [x] Support stacking (variable height per tile)

### 3.2 Tile Shader (Basic)
- [x] Implement per-tile color (Housing=green, Commerce=blue, Industry=orange)
- [x] Add basic Phong lighting (ambient + diffuse + specular)
- [x] Implement transparency (alpha blending)
- [x] Add soft edge glow for selected tiles

### 3.3 Tile Shader (Advanced — Milky/Refraction) ✅ COMPLETE
- [x] Implement subsurface scattering approximation
- [x] Add Fresnel effect for edge transparency
- [x] Implement simple refraction distortion (caustics + chromatic aberration)
- [x] Add rough texture to top surface (noise-based)
- [x] Implement luminescence on hover (smooth pulse)

### 3.4 Tile Stacking
- [x] Render stacked tiles for Landmarks (3 tiles)
- [x] Render stacked tiles for Headquarters (Agents)
- [x] Render Agents on top of tiles (securing)
- [x] Animate stacking when Landmark forms

**Deliverable:** Beautiful translucent tiles rendering on board with proper stacking. ✅ COMPLETE

---

## Phase 4: Game State Management ✅ COMPLETE

### 4.1 Core Data Structures
```javascript
// Board state
board[8][8] = {
  tile: null | { type, owner, agents[] },
  landmark: null | { owner, secured: number },
  headquarters: null | { owner, agents: number },
  agent: null | { owner }  // standalone agent
}

// Player state
player = {
  id: 0 | 1,
  hand: Tile[],           // visible (open hand)
  events: Event[],        // hidden
  landmarks: number,      // score
  startingZone: coords[]
}

// Game state
game = {
  phase: 'setup' | 'draw' | 'develop' | 'agent' | 'end',
  currentPlayer: 0 | 1,
  dStack: Tile[],
  eStack: Event[],
  board: Board,
  players: Player[],
  winner: null | 0 | 1
}
```

### 4.2 State Management
- [x] Implement immutable state updates
- [x] Create action dispatcher (draw, place, convert, move, attack, pass)
- [x] Implement state history for undo
- [x] Create state serialization for save/load
- [x] Create draw pile management (init, shuffle, draw)
- [x] Create hand management (add, remove, refill)
- [x] Create turn phase tracking

### 4.3 Rules Engine
- [x] Implement tile placement validation (adjacency, starting zone)
- [x] Implement Landmark detection (H+C+I connected)
- [x] Implement Landmark formation (stacking tiles)
- [x] Implement freeing spaces when landmark forms
- [x] Implement HQ conversion
- [x] Implement Agent movement validation
- [x] Implement takeover validation and execution
- [x] Implement capture vs settlement logic
- [x] Implement end game detection (64 spaces filled)
- [x] Implement scoring and winner determination

**Deliverable:** Complete game logic, testable without UI. ✅ COMPLETE

---

## Phase 5: UI Layer (Canvas 2D) ✅ COMPLETE

### 5.1 UI Framework
- [x] Create UI component base class (UIRenderer)
- [x] Implement text rendering (custom or canvas fillText)
- [x] Implement button components
- [x] Implement panel/container components
- [x] Layer UI canvas over WebGL canvas

### 5.2 Player Hand Display
- [x] Render player's tiles (open hand) along bottom edge
- [x] Show tile type with color coding
- [x] Highlight selected tile
- [x] Click to select tile for placement

### 5.3 Game Info Panel
- [x] Display current player indicator
- [x] Display current phase
- [x] Display Landmark counts for both players
- [x] Display D. Stack count
- [x] Display E. Stack count

### 5.4 Event Cards UI
- [x] Display event card count (face-down)
- [x] Click to view own event cards (modal)
- [x] Select and play event card
- [x] Display event card effect when played

### 5.5 Action Buttons
- [x] "End Phase" / "Pass" button
- [x] "Convert to HQ" button (when Landmark selected)
- [x] "Undo" button
- [x] Context-sensitive action prompts

**Deliverable:** Functional UI for all game actions. ✅ COMPLETE

---

## Phase 6: Input & Interaction ✅ COMPLETE

### 6.1 Input System
- [x] Create unified input manager
- [x] Handle mouse move, click, drag
- [x] Handle keyboard shortcuts
- [x] Distinguish UI clicks vs board clicks

### 6.2 Tile Placement Flow
- [x] Select tile from hand
- [x] Highlight valid placement positions on board
- [x] Click to place tile
- [x] Animate tile placement
- [x] Auto-detect and trigger Landmark formation

### 6.3 Agent Actions Flow
- [x] Select Headquarters or Agent on board
- [x] Show valid moves (movement, attack targets)
- [x] Click to execute move
- [x] Animate Agent movement
- [x] Handle takeover with confirmation

### 6.4 Turn Flow
- [x] Enforce phase order (configurable: simple or classic mode)
- [x] Auto-advance phases when required
- [x] Handle "pass" / "end turn"
- [x] Switch to next player with visual indicator
- [x] Simple mode: Place 1 tile → Auto-refill hand → End
- [x] Classic mode: Draw → Develop → Agent → End

**Deliverable:** Playable game with full input handling. ✅ COMPLETE

---

## Phase 7: Game Setup Flow ✅ COMPLETE

### 7.1 Setup Sequence
- [x] Initialize D. Stack (72 shuffled tiles)
- [x] Initialize E. Stack (34 shuffled events)
- [x] Determine starting positions (2-player: opposite sides)
- [x] Starting player determination (H > C > I rule)
- [x] Deal 5 tiles to each player
- [x] Mulligan option
- [x] Event draft (deal 2, keep 1, pass 1)

### 7.2 Setup UI
- [x] "Start Game" screen
- [x] Player count selection
- [x] Starting player announcement
- [x] Draft interface for events (auto-handled)
- [x] "Begin Game" transition

**Deliverable:** Complete setup flow before main game loop. ✅ COMPLETE

---

## Phase 8: Event Cards System ✅ COMPLETE

### 8.1 Event Data
- [x] Define all 19 event types with effects
- [x] Categorize as Immediate vs Tactical
- [x] Create event card rendering

### 8.2 Event Execution
- [x] Implement each event's effect:
  - [x] Market Crash (discard to 3)
  - [x] Construction Boom (draw 3)
  - [x] Rezoning (return own tile)
  - [x] Eminent Domain (remove any basic tile)
  - [x] Hostile Acquisition (steal tile to hand)
  - [x] Hostile Expansion (free capture adjacent)
  - [x] Conversion Permit (swap tile type)
  - [x] Urban Renewal (move own tile)
  - [x] Shell Company (ignore adjacency)
  - [x] Reinforcements (add agent from hand)
  - [x] Double Agent (move enemy agent)
  - [x] Union Strike (skip agent phase)
  - [x] Insider Trading (look at D. Stack)
  - [x] Expedited Permits (draw 2 events)
  - [x] Stakeout (view enemy events + top D. Stack)
  - [x] Insurance Claim (recover tile on takeover)
  - [x] Backroom Deal (swap tile with opponent)
  - [x] Red Tape (opponent skips develop)
  - [x] Hostile Rezoning (change enemy tile type)

### 8.3 Event UI
- [x] Card view modal
- [x] Play card button
- [x] Target selection for targeted events
- [x] Effect resolution animation

**Deliverable:** All events implemented and playable. ✅ COMPLETE

---

## Phase 9: Visual Polish ✅ COMPLETE

### 9.1 Animations
- [x] Tile placement animation (drop from above)
- [x] Landmark formation animation (tiles sliding and stacking)
- [x] HQ conversion animation (flip effect)
- [x] Agent movement animation (slide)
- [x] Takeover animation (clash effect)
- [x] Turn transition animation

### 9.2 Visual Effects
- [x] Hover glow with smooth easing
- [x] Selection outline pulse
- [x] Valid move indicators (subtle glow)
- [x] Player color coding (Player 1 = cool tones, Player 2 = warm tones)
- [x] Placement preview (ghost tile)
- [x] Landmark preview (golden glow)
- [x] Refraction shader (caustics + chromatic aberration)

### 9.3 Quality of Life
- [x] Tooltips for UI elements
- [x] Help system (press ? or H)
- [x] Undo functionality (press Z)

### 9.4 Audio (Optional)
- [ ] Tile placement sound
- [ ] Landmark formation chime
- [ ] Takeover clash sound
- [ ] Turn notification
- [ ] Background ambient

**Deliverable:** Polished, visually appealing game. ✅ COMPLETE (audio optional)

---

## Phase 10: Testing & Refinement ✅ COMPLETE

### 10.1 Gameplay Testing
- [x] 255 automated tests passing
- [x] Verify all rules implemented correctly
- [x] Test edge cases (empty stack, full board, etc.)
- [x] Test all event cards

### 10.2 Performance
- [x] Profile rendering performance
- [x] Optimize shader complexity if needed
- [x] Ensure 60fps on target hardware

### 10.3 Browser Compatibility
- [ ] Test Chrome, Firefox, Safari, Edge
- [ ] Handle WebGL fallbacks gracefully
- [ ] Test different screen sizes

**Deliverable:** Stable, tested prototype. ✅ CORE COMPLETE

---

## Implementation Status Summary

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Project Foundation | ✅ Complete |
| Phase 2 | Board Rendering | ✅ Complete |
| Phase 3 | Tile Rendering | ✅ Complete |
| Phase 4 | Game State | ✅ Complete |
| Phase 5 | UI Layer | ✅ Complete |
| Phase 6 | Input & Interaction | ✅ Complete |
| Phase 7 | Setup Flow | ✅ Complete |
| Phase 8 | Event Cards | ✅ Complete |
| Phase 9 | Visual Polish | ✅ Complete |
| Phase 10 | Testing | ✅ Core Complete |

---

## Key Features Implemented

### Core Game
- Full Trinity rulebook compliance
- All 19 event effects
- Agent system with movement and takeover
- HQ conversion with agent spawning
- Landmark formation and scoring
- Combo placement system (optional)

### Visual
- Milky glass shader with refraction
- Player ownership color coding
- Placement and landmark previews
- Turn transition animations
- All game animations

### Quality of Life
- Tooltips
- Help system (? or H)
- Undo (Z)
- Keyboard shortcuts (1-9, E, Q, Space, Esc)

### Testing
- 255 automated tests
- Full test coverage for game logic

---

*Last Updated: 2026-01-30*
*Status: All planned features implemented*
