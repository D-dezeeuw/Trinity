# Trinity — Implementation Plan

## Project Overview

A browser-based prototype of Trinity using vanilla JavaScript, Canvas, and WebGL with custom GLSL shaders. Two human players, hot-seat multiplayer (same device, taking turns).

**Tech Stack:**
- Node.js (development server only)
- HTML5 Canvas (UI layer)
- WebGL 2.0 (3D rendering)
- GLSL (custom shaders)
- No external libraries

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

## Phase 1: Project Foundation

### 1.1 Project Setup
- [ ] Create package.json with basic metadata
- [ ] Create simple Node.js static file server (no dependencies)
- [ ] Create index.html with canvas element
- [ ] Create main.js entry point
- [ ] Verify server runs and serves files

### 1.2 Canvas & WebGL Initialization
- [ ] Create dual-canvas setup (WebGL for 3D, Canvas2D for UI overlay)
- [ ] Initialize WebGL 2.0 context with error handling
- [ ] Set up render loop with requestAnimationFrame
- [ ] Implement basic viewport/resize handling
- [ ] Create shader compilation utility functions

### 1.3 Math Utilities
- [ ] Implement vec2, vec3, vec4 operations
- [ ] Implement mat4 operations (identity, multiply, translate, rotate, scale)
- [ ] Implement isometric projection matrix (45° rotation, orthographic)
- [ ] Implement screen-to-world coordinate conversion
- [ ] Implement world-to-screen coordinate conversion

**Deliverable:** Empty canvas with WebGL context, running render loop, resizable.

---

## Phase 2: Isometric Board Rendering

### 2.1 Board Geometry
- [ ] Define board constants (8x8 grid, tile size, spacing)
- [ ] Create vertex data for a single tile (flat square with beveled edges)
- [ ] Create vertex buffer for entire board grid
- [ ] Calculate isometric positions for all 64 tiles

### 2.2 Basic Board Shader
- [ ] Create vertex shader with isometric projection
- [ ] Create fragment shader with checkerboard pattern
- [ ] Implement light grey/white alternating colors
- [ ] Add subtle grid lines between tiles
- [ ] Add ambient lighting

### 2.3 Board Interaction
- [ ] Implement mouse position tracking
- [ ] Convert mouse position to board coordinates (isometric picking)
- [ ] Highlight hovered tile with color change
- [ ] Implement smooth hover transition (fade in/out)

**Deliverable:** Rendered 8x8 isometric board with hover highlighting.

---

## Phase 3: Tile Rendering

### 3.1 Tile Geometry
- [ ] Create 3D tile mesh (rounded rectangular prism)
- [ ] Add slight bevel to edges
- [ ] Create vertex normals for lighting
- [ ] Support stacking (variable height per tile)

### 3.2 Tile Shader (Basic)
- [ ] Implement per-tile color (Housing=blue, Commerce=green, Industry=orange)
- [ ] Add basic Phong lighting (ambient + diffuse + specular)
- [ ] Implement transparency (alpha blending)
- [ ] Add soft edge glow for selected tiles

### 3.3 Tile Shader (Advanced — Milky/Refraction)
- [ ] Implement subsurface scattering approximation
- [ ] Add Fresnel effect for edge transparency
- [ ] Implement simple refraction distortion
- [ ] Add rough texture to top surface (noise-based)
- [ ] Implement luminescence on hover (smooth pulse)

### 3.4 Tile Stacking
- [ ] Render stacked tiles for Landmarks (3 tiles)
- [ ] Render stacked tiles for Headquarters (Agents)
- [ ] Render Agents on top of tiles (securing)
- [ ] Animate stacking when Landmark forms

**Deliverable:** Beautiful translucent tiles rendering on board with proper stacking.

---

## Phase 4: Game State Management

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
- [ ] Implement immutable state updates
- [ ] Create action dispatcher (draw, place, convert, move, attack, pass)
- [ ] Implement state history for undo (optional)
- [ ] Create state serialization for save/load (optional)

### 4.3 Rules Engine
- [ ] Implement tile placement validation (adjacency, starting zone)
- [ ] Implement Landmark detection (H+C+I connected)
- [ ] Implement Landmark formation (stacking, freeing spaces)
- [ ] Implement HQ conversion
- [ ] Implement Agent movement validation
- [ ] Implement takeover validation and execution
- [ ] Implement capture vs settlement logic
- [ ] Implement end game detection (64 spaces filled)
- [ ] Implement scoring and winner determination

**Deliverable:** Complete game logic, testable without UI.

---

## Phase 5: UI Layer (Canvas 2D)

### 5.1 UI Framework
- [ ] Create UI component base class
- [ ] Implement text rendering (custom or canvas fillText)
- [ ] Implement button components
- [ ] Implement panel/container components
- [ ] Layer UI canvas over WebGL canvas

### 5.2 Player Hand Display
- [ ] Render player's tiles (open hand) along bottom edge
- [ ] Show tile type with color coding
- [ ] Highlight selected tile
- [ ] Click to select tile for placement

### 5.3 Game Info Panel
- [ ] Display current player indicator
- [ ] Display current phase
- [ ] Display Landmark counts for both players
- [ ] Display D. Stack count
- [ ] Display E. Stack count

### 5.4 Event Cards UI
- [ ] Display event card count (face-down)
- [ ] Click to view own event cards (modal)
- [ ] Select and play event card
- [ ] Display event card effect when played

### 5.5 Action Buttons
- [ ] "End Phase" / "Pass" button
- [ ] "Convert to HQ" button (when Landmark selected)
- [ ] "Undo" button (optional)
- [ ] Context-sensitive action prompts

**Deliverable:** Functional UI for all game actions.

---

## Phase 6: Input & Interaction

### 6.1 Input System
- [ ] Create unified input manager
- [ ] Handle mouse move, click, drag
- [ ] Handle keyboard shortcuts (optional)
- [ ] Distinguish UI clicks vs board clicks

### 6.2 Tile Placement Flow
- [ ] Select tile from hand
- [ ] Highlight valid placement positions on board
- [ ] Click to place tile
- [ ] Animate tile placement
- [ ] Auto-detect and trigger Landmark formation

### 6.3 Agent Actions Flow
- [ ] Select Headquarters or Agent on board
- [ ] Show valid moves (movement, attack targets)
- [ ] Click to execute move
- [ ] Animate Agent movement
- [ ] Handle takeover with confirmation

### 6.4 Turn Flow
- [ ] Enforce phase order (Draw → Develop → Agent → End)
- [ ] Auto-advance phases when required
- [ ] Handle "pass" / "end turn"
- [ ] Switch to next player with visual indicator

**Deliverable:** Playable game with full input handling.

---

## Phase 7: Game Setup Flow

### 7.1 Setup Sequence
- [ ] Initialize D. Stack (72 shuffled tiles)
- [ ] Initialize E. Stack (36 shuffled events)
- [ ] Determine starting positions (2-player: opposite sides)
- [ ] Starting player determination (tile draw)
- [ ] Deal 5 tiles to each player
- [ ] Mulligan option UI
- [ ] Event draft UI (deal 2, keep 1, pass 1)

### 7.2 Setup UI
- [ ] "Start Game" screen
- [ ] Player name entry (optional)
- [ ] Starting player announcement
- [ ] Draft interface for events
- [ ] "Begin Game" transition

**Deliverable:** Complete setup flow before main game loop.

---

## Phase 8: Event Cards System

### 8.1 Event Data
- [ ] Define all 19 event types with effects
- [ ] Categorize as Immediate vs Tactical
- [ ] Create event card rendering

### 8.2 Event Execution
- [ ] Implement each event's effect:
  - Market Crash (discard to 3)
  - Construction Boom (draw 3)
  - Rezoning (return own tile)
  - Eminent Domain (remove any basic tile)
  - Hostile Acquisition (steal tile to hand)
  - Hostile Expansion (free capture adjacent)
  - Conversion Permit (swap tile type)
  - Urban Renewal (move own tile)
  - Shell Company (ignore adjacency)
  - Reinforcements (add agent from hand)
  - Double Agent (move enemy agent)
  - Union Strike (skip agent phase)
  - Insider Trading (look at D. Stack)
  - Expedited Permits (draw 2 events)
  - Stakeout (view enemy events + top D. Stack)
  - Insurance Claim (recover tile on takeover)
  - Backroom Deal (swap tile with opponent)
  - Red Tape (opponent skips develop)
  - Hostile Rezoning (change enemy tile type)

### 8.3 Event UI
- [ ] Card view modal
- [ ] Play card button
- [ ] Target selection for targeted events
- [ ] Effect resolution animation

**Deliverable:** All events implemented and playable.

---

## Phase 9: Visual Polish

### 9.1 Animations
- [ ] Tile placement animation (drop from above)
- [ ] Landmark formation animation (tiles sliding and stacking)
- [ ] HQ conversion animation (flip effect)
- [ ] Agent movement animation (slide)
- [ ] Takeover animation (clash effect)
- [ ] Turn transition animation

### 9.2 Visual Effects
- [ ] Hover glow with smooth easing
- [ ] Selection outline pulse
- [ ] Valid move indicators (subtle glow)
- [ ] Player color coding (Player 1 = cool tones, Player 2 = warm tones)
- [ ] Particle effects for captures/settlements (optional)

### 9.3 Audio (Optional)
- [ ] Tile placement sound
- [ ] Landmark formation chime
- [ ] Takeover clash sound
- [ ] Turn notification
- [ ] Background ambient

**Deliverable:** Polished, visually appealing game.

---

## Phase 10: Testing & Refinement

### 10.1 Gameplay Testing
- [ ] Play full games, note issues
- [ ] Verify all rules implemented correctly
- [ ] Test edge cases (empty stack, full board, etc.)
- [ ] Test all event cards

### 10.2 Performance
- [ ] Profile rendering performance
- [ ] Optimize shader complexity if needed
- [ ] Ensure 60fps on target hardware

### 10.3 Browser Compatibility
- [ ] Test Chrome, Firefox, Safari, Edge
- [ ] Handle WebGL fallbacks gracefully
- [ ] Test different screen sizes

**Deliverable:** Stable, tested prototype.

---

## Implementation Order (Recommended)

```
Week 1: Phases 1-2 (Foundation + Board)
Week 2: Phases 3-4 (Tiles + Game State)
Week 3: Phases 5-6 (UI + Input)
Week 4: Phases 7-8 (Setup + Events)
Week 5: Phases 9-10 (Polish + Testing)
```

---

## File Structure (Detailed)

```
/trinity
├── index.html
├── package.json
├── server.js
│
├── /src
│   ├── main.js                 # Entry point, game loop
│   │
│   ├── /core
│   │   ├── constants.js        # Game constants
│   │   ├── state.js            # Game state management
│   │   ├── rules.js            # Rules validation
│   │   ├── actions.js          # Action handlers
│   │   └── events.js           # Event card definitions
│   │
│   ├── /renderer
│   │   ├── webgl.js            # WebGL initialization
│   │   ├── board.js            # Board rendering
│   │   ├── tiles.js            # Tile rendering
│   │   ├── camera.js           # Isometric camera
│   │   └── animations.js       # Animation system
│   │
│   ├── /shaders
│   │   ├── board.vert.glsl
│   │   ├── board.frag.glsl
│   │   ├── tile.vert.glsl
│   │   ├── tile.frag.glsl
│   │   └── glow.frag.glsl
│   │
│   ├── /ui
│   │   ├── canvas2d.js         # 2D canvas setup
│   │   ├── components.js       # UI components
│   │   ├── hand.js             # Player hand display
│   │   ├── info.js             # Game info panel
│   │   └── events.js           # Event cards UI
│   │
│   ├── /input
│   │   ├── mouse.js            # Mouse handling
│   │   ├── picking.js          # Isometric picking
│   │   └── controller.js       # Input routing
│   │
│   └── /utils
│       ├── math.js             # Vector/matrix math
│       ├── color.js            # Color utilities
│       └── shuffle.js          # Array shuffling
│
└── /assets
    └── (textures if needed)
```

---

## Key Technical Challenges

### 1. Isometric Picking
Converting 2D mouse coordinates to 3D isometric grid positions requires reverse-projection math. Solution: Create picking ray and intersect with ground plane.

### 2. Tile Transparency & Sorting
Transparent tiles require proper depth sorting (back-to-front rendering). Solution: Sort tiles by distance from camera before rendering.

### 3. Refraction Shader
Simulating milky glass refraction is complex. Solution: Use environment mapping with distortion, or screen-space refraction approximation.

### 4. Stacking Visualization
Stacked tiles (Landmarks, HQ) need clear visual hierarchy. Solution: Slight offset and shadow for each stack level.

### 5. State Management Without Framework
No React/Vue means manual DOM/state sync. Solution: Simple observer pattern for state changes triggering re-renders.

---

## Minimum Viable Prototype (MVP)

If time is limited, prioritize:

1. ✅ Board rendering (flat, no fancy shaders)
2. ✅ Tile placement
3. ✅ Landmark formation
4. ✅ HQ conversion
5. ✅ Agent movement & takeover
6. ✅ Turn flow
7. ✅ Win condition
8. ⏸️ Event cards (can stub with fewer events)
9. ⏸️ Advanced shaders (can use flat colors)
10. ⏸️ Animations (can be instant)

MVP = Playable game with basic visuals. Polish comes after core loop works.

---

*Ready to build. Start with Phase 1.*
