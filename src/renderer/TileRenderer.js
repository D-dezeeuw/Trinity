/**
 * Trinity - Tile Renderer
 * Renders 3D tiles on the board
 */

import {
  createProgram,
  createBuffer,
  createIndexBuffer,
  createVAO,
  getUniformLocations,
  getAttributeLocations,
  loadShaderSource
} from './webgl.js';
import { mat4, vec3, gridToWorld, worldToScreen, vec2 } from '../utils/math.js';
import { BOARD, RENDER, TILE, HAND_TILES } from '../config.js';

// Board surface height - tiles must be placed ABOVE this
const BOARD_SURFACE_Y = BOARD.HEIGHT;
import { TileType, TileProperties } from '../game/TileTypes.js';

// Tile dimensions from config
const TILE_WIDTH = TILE.WIDTH;
const TILE_HEIGHT = TILE.HEIGHT;
const TILE_DEPTH = TILE.DEPTH;

// Agent visual configuration
const AGENT = Object.freeze({
  RADIUS: 0.15,      // Agent disc radius
  HEIGHT: 0.08,      // Agent disc height
  Y_OFFSET: 0.02,    // Offset above tile surface
  STACK_OFFSET: 0.12, // Vertical offset between stacked agents
});

// Landmark visual configuration (white tapered square/frustum)
const LANDMARK = Object.freeze({
  BASE_WIDTH: 0.85,   // Base width (slightly larger than tile)
  TOP_WIDTH: 0.55,    // Top width (smaller, creates taper)
  HEIGHT: 0.5,        // Taller than regular tiles (represents 3 stacked)
  COLOR: [0.95, 0.95, 0.95], // White/off-white
});

// Player color configuration (used for both agents and tile ownership tinting)
// Player 1: Cool tones (blue), Player 2: Warm tones (red/orange)
const PLAYER_COLORS = Object.freeze([
  [0.2, 0.6, 1.0],   // Player 1: Blue (cool)
  [1.0, 0.4, 0.3],   // Player 2: Red/Orange (warm)
  [0.3, 0.8, 0.4],   // Player 3: Green
  [0.9, 0.7, 0.2],   // Player 4: Yellow
]);

export class TileRenderer {
  constructor(gl) {
    this.gl = gl;
    this.program = null;
    this.vao = null;
    this.uniforms = null;
    this.indexCount = 0;

    // Agent rendering
    this.agentVao = null;
    this.agentIndexCount = 0;

    // Landmark rendering (tapered square)
    this.landmarkVao = null;
    this.landmarkIndexCount = 0;

    // Board settings
    this.boardSize = BOARD.SIZE;
    this.tileSize = BOARD.TILE_SIZE;

    // Light direction
    this.lightDir = vec3.create(...RENDER.LIGHT_DIRECTION);
    vec3.normalize(this.lightDir, this.lightDir);

    // Reusable model matrix
    this.modelMatrix = mat4.create();
  }

  /**
   * Initialize the tile renderer
   */
  async init() {
    const gl = this.gl;

    // Load shaders
    const vertSource = await loadShaderSource('/src/shaders/tile.vert.glsl');
    const fragSource = await loadShaderSource('/src/shaders/tile.frag.glsl');

    // Create program
    this.program = createProgram(gl, vertSource, fragSource);
    if (!this.program) {
      throw new Error('Failed to create tile shader program');
    }

    // Get uniform locations
    this.uniforms = getUniformLocations(gl, this.program, [
      'u_model',
      'u_view',
      'u_projection',
      'u_lightDir',
      'u_cameraPos',
      'u_tileColor',
      'u_selected',
      'u_hovered',
      'u_time',
      'u_isHQ',
      'u_playerColor',
      'u_hasOwner',
      // Trinity formation animation uniforms
      'u_trinityPhase',
      'u_phaseProgress',
      'u_borderGlowIntensity',
      'u_dissolveThreshold',
      'u_isFormingTrinity',
      'u_formationProgress',
      // Opacity control for preview tiles
      'u_opacity'
    ]);

    // Get attribute locations
    const attribs = getAttributeLocations(gl, this.program, [
      'a_position',
      'a_normal'
    ]);

    // Create tile geometry (a box)
    const geometry = this.createTileGeometry();

    // Create buffers
    const positionBuffer = createBuffer(gl, geometry.positions);
    const normalBuffer = createBuffer(gl, geometry.normals);
    const indexBuffer = createIndexBuffer(gl, geometry.indices);

    this.indexCount = geometry.indices.length;

    // Create VAO
    this.vao = createVAO(gl, {
      [attribs.a_position]: { buffer: positionBuffer, size: 3 },
      [attribs.a_normal]: { buffer: normalBuffer, size: 3 }
    }, indexBuffer);

    // Create agent geometry (octagonal prism / disc shape)
    const agentGeometry = this.createAgentGeometry();
    const agentPositionBuffer = createBuffer(gl, agentGeometry.positions);
    const agentNormalBuffer = createBuffer(gl, agentGeometry.normals);
    const agentIndexBuffer = createIndexBuffer(gl, agentGeometry.indices);

    this.agentIndexCount = agentGeometry.indices.length;

    // Create agent VAO
    this.agentVao = createVAO(gl, {
      [attribs.a_position]: { buffer: agentPositionBuffer, size: 3 },
      [attribs.a_normal]: { buffer: agentNormalBuffer, size: 3 }
    }, agentIndexBuffer);

    // Create landmark geometry (tapered square / frustum)
    const landmarkGeometry = this.createLandmarkGeometry();
    const landmarkPositionBuffer = createBuffer(gl, landmarkGeometry.positions);
    const landmarkNormalBuffer = createBuffer(gl, landmarkGeometry.normals);
    const landmarkIndexBuffer = createIndexBuffer(gl, landmarkGeometry.indices);

    this.landmarkIndexCount = landmarkGeometry.indices.length;

    // Create landmark VAO
    this.landmarkVao = createVAO(gl, {
      [attribs.a_position]: { buffer: landmarkPositionBuffer, size: 3 },
      [attribs.a_normal]: { buffer: landmarkNormalBuffer, size: 3 }
    }, landmarkIndexBuffer);
  }

  /**
   * Create 3D box geometry for a tile
   */
  createTileGeometry() {
    const hw = TILE_WIDTH / 2;   // half width
    const hh = TILE_HEIGHT / 2;  // half height
    const hd = TILE_DEPTH / 2;   // half depth

    // 8 corners of the box
    // Bottom face (y = -hh)
    // Top face (y = +hh)

    const positions = [
      // Top face (y = +hh)
      -hw, hh, -hd,   // 0
       hw, hh, -hd,   // 1
       hw, hh,  hd,   // 2
      -hw, hh,  hd,   // 3

      // Bottom face (y = -hh)
      -hw, -hh, -hd,  // 4
       hw, -hh, -hd,  // 5
       hw, -hh,  hd,  // 6
      -hw, -hh,  hd,  // 7

      // Front face (z = +hd)
      -hw, -hh, hd,   // 8
       hw, -hh, hd,   // 9
       hw,  hh, hd,   // 10
      -hw,  hh, hd,   // 11

      // Back face (z = -hd)
       hw, -hh, -hd,  // 12
      -hw, -hh, -hd,  // 13
      -hw,  hh, -hd,  // 14
       hw,  hh, -hd,  // 15

      // Right face (x = +hw)
       hw, -hh,  hd,  // 16
       hw, -hh, -hd,  // 17
       hw,  hh, -hd,  // 18
       hw,  hh,  hd,  // 19

      // Left face (x = -hw)
      -hw, -hh, -hd,  // 20
      -hw, -hh,  hd,  // 21
      -hw,  hh,  hd,  // 22
      -hw,  hh, -hd,  // 23
    ];

    const normals = [
      // Top face - pointing up
      0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
      // Bottom face - pointing down
      0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
      // Front face - pointing forward
      0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
      // Back face - pointing backward
      0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
      // Right face - pointing right
      1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
      // Left face - pointing left
      -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
    ];

    // CCW winding for front faces (when viewed from outside the box)
    const indices = [
      // Top face
      0, 3, 2, 0, 2, 1,
      // Bottom face (viewed from below, so reverse)
      4, 5, 6, 4, 6, 7,
      // Front face
      8, 9, 10, 8, 10, 11,
      // Back face
      12, 13, 14, 12, 14, 15,
      // Right face
      16, 17, 18, 16, 18, 19,
      // Left face
      20, 21, 22, 20, 22, 23,
    ];

    return { positions, normals, indices };
  }

  /**
   * Create disc/cylinder geometry for agents
   * Uses an octagonal approximation for efficiency
   */
  createAgentGeometry() {
    const r = AGENT.RADIUS;
    const h = AGENT.HEIGHT / 2;
    const segments = 8; // Octagon

    const positions = [];
    const normals = [];
    const indices = [];

    // Top center vertex
    positions.push(0, h, 0);
    normals.push(0, 1, 0);

    // Bottom center vertex
    positions.push(0, -h, 0);
    normals.push(0, -1, 0);

    // Generate top and bottom ring vertices
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      // Top ring (for top face)
      positions.push(x, h, z);
      normals.push(0, 1, 0);

      // Bottom ring (for bottom face)
      positions.push(x, -h, z);
      normals.push(0, -1, 0);

      // Top ring (for side face)
      positions.push(x, h, z);
      normals.push(x / r, 0, z / r);

      // Bottom ring (for side face)
      positions.push(x, -h, z);
      normals.push(x / r, 0, z / r);
    }

    // Top face triangles (fan from center)
    for (let i = 0; i < segments; i++) {
      const curr = 2 + i * 4;        // Top ring vertex for top face
      const next = 2 + ((i + 1) % segments) * 4;
      indices.push(0, next, curr);   // Center, next, current (CCW)
    }

    // Bottom face triangles (fan from center)
    for (let i = 0; i < segments; i++) {
      const curr = 3 + i * 4;        // Bottom ring vertex for bottom face
      const next = 3 + ((i + 1) % segments) * 4;
      indices.push(1, curr, next);   // Center, current, next (CCW from below)
    }

    // Side faces (quads as two triangles)
    for (let i = 0; i < segments; i++) {
      const topCurr = 4 + i * 4;      // Top ring for side
      const botCurr = 5 + i * 4;      // Bottom ring for side
      const topNext = 4 + ((i + 1) % segments) * 4;
      const botNext = 5 + ((i + 1) % segments) * 4;

      // Two triangles per quad
      indices.push(topCurr, botCurr, botNext);
      indices.push(topCurr, botNext, topNext);
    }

    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      indices: new Uint16Array(indices)
    };
  }

  /**
   * Create tapered square geometry for landmarks (frustum/truncated pyramid)
   * White square that is smaller at the top
   */
  createLandmarkGeometry() {
    const bw = LANDMARK.BASE_WIDTH / 2;  // Base half-width
    const tw = LANDMARK.TOP_WIDTH / 2;   // Top half-width
    const h = LANDMARK.HEIGHT / 2;       // Half height

    // Calculate normals for tapered sides
    // The normal of a tapered face points outward at an angle
    const taperAngle = Math.atan2(bw - tw, LANDMARK.HEIGHT);
    const nx = Math.cos(taperAngle);  // Horizontal component
    const ny = Math.sin(taperAngle);  // Vertical component

    const positions = [
      // Top face (y = +h) - smaller square
      -tw, h, -tw,   // 0
       tw, h, -tw,   // 1
       tw, h,  tw,   // 2
      -tw, h,  tw,   // 3

      // Bottom face (y = -h) - larger square
      -bw, -h, -bw,  // 4
       bw, -h, -bw,  // 5
       bw, -h,  bw,  // 6
      -bw, -h,  bw,  // 7

      // Front face (z = positive) - trapezoid
      -bw, -h, bw,   // 8
       bw, -h, bw,   // 9
       tw,  h, tw,   // 10
      -tw,  h, tw,   // 11

      // Back face (z = negative) - trapezoid
       bw, -h, -bw,  // 12
      -bw, -h, -bw,  // 13
      -tw,  h, -tw,  // 14
       tw,  h, -tw,  // 15

      // Right face (x = positive) - trapezoid
       bw, -h,  bw,  // 16
       bw, -h, -bw,  // 17
       tw,  h, -tw,  // 18
       tw,  h,  tw,  // 19

      // Left face (x = negative) - trapezoid
      -bw, -h, -bw,  // 20
      -bw, -h,  bw,  // 21
      -tw,  h,  tw,  // 22
      -tw,  h, -tw,  // 23
    ];

    const normals = [
      // Top face - pointing up
      0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
      // Bottom face - pointing down
      0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
      // Front face - angled outward (z positive, y positive)
      0, ny, nx,  0, ny, nx,  0, ny, nx,  0, ny, nx,
      // Back face - angled outward (z negative, y positive)
      0, ny, -nx, 0, ny, -nx, 0, ny, -nx, 0, ny, -nx,
      // Right face - angled outward (x positive, y positive)
      nx, ny, 0,  nx, ny, 0,  nx, ny, 0,  nx, ny, 0,
      // Left face - angled outward (x negative, y positive)
      -nx, ny, 0, -nx, ny, 0, -nx, ny, 0, -nx, ny, 0,
    ];

    // CCW winding for front faces
    const indices = [
      // Top face
      0, 3, 2, 0, 2, 1,
      // Bottom face (viewed from below)
      4, 5, 6, 4, 6, 7,
      // Front face
      8, 9, 10, 8, 10, 11,
      // Back face
      12, 13, 14, 12, 14, 15,
      // Right face
      16, 17, 18, 16, 18, 19,
      // Left face
      20, 21, 22, 20, 22, 23,
    ];

    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      indices: new Uint16Array(indices)
    };
  }

  /**
   * Set common shader uniforms (camera, lighting, time)
   * @private
   */
  _setCommonUniforms(camera, time) {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uniforms.u_view, false, camera.getViewMatrix());
    gl.uniformMatrix4fv(this.uniforms.u_projection, false, camera.getProjectionMatrix());
    gl.uniform3fv(this.uniforms.u_lightDir, this.lightDir);
    gl.uniform3fv(this.uniforms.u_cameraPos, camera.getPosition());
    gl.uniform1f(this.uniforms.u_time, time);
    gl.uniform1f(this.uniforms.u_opacity, 1.0);  // Default full opacity
  }

  /**
   * Get color for tile type
   */
  getTileColor(type) {
    const props = TileProperties[type];
    if (!props) {
      return [0.5, 0.5, 0.5]; // Grey fallback
    }
    // Parse hex color to RGB
    const hex = props.color;
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b];
  }

  /**
   * Render all tiles from game state
   * @param {Object} camera - Camera instance
   * @param {number} time - Current time
   * @param {Array} tiles - Array of {x, y, tile} objects
   * @param {Object} options - Rendering options (hoveredTile, selectedTile, animationManager)
   */
  render(camera, time, tiles, options = {}) {
    if (!tiles || tiles.length === 0) return;

    const gl = this.gl;
    const { hoveredTile, selectedTile, animationManager } = options;

    this._setCommonUniforms(camera, time);
    gl.bindVertexArray(this.vao);

    // Get active Trinity formations for special rendering
    const trinityFormations = animationManager ?
      animationManager.getTrinityFormations() : [];

    // Get active tile materializations
    const tileMaterializations = animationManager ?
      animationManager.getTileMaterializations() : [];

    // Build a map of tiles currently in Trinity formation animation
    const formingTilesMap = new Map();
    for (const { value } of trinityFormations) {
      if (value && value.tileStates) {
        for (const state of value.tileStates) {
          const key = `${Math.round(state.x)},${Math.round(state.y)}`;
          formingTilesMap.set(key, state);
        }
      }
    }

    // Build a map of tiles currently materializing
    const materializingTilesMap = new Map();
    for (const { value } of tileMaterializations) {
      if (value && value.isMaterializing) {
        const key = `${Math.round(value.x)},${Math.round(value.z)}`;
        materializingTilesMap.set(key, value);
      }
    }

    // Render each tile
    for (const { x, y, tile, stackIndex = 0, isHQ = false, landmarkOwner = -1 } of tiles) {
      const tileKey = `${x},${y}`;
      const isLandmark = landmarkOwner >= 0;

      // For landmarks, only render once (skip stacked tiles after the first)
      if (isLandmark && stackIndex > 0) {
        continue;
      }

      // Check if this tile is part of a Trinity formation animation
      const formationState = formingTilesMap.get(tileKey);

      // Check if this tile is materializing
      const materializeState = materializingTilesMap.get(tileKey);

      if (formationState) {
        // Skip tiles that are not visible (e.g., during phase 3)
        if (!formationState.visible) continue;

        // Render with formation animation state
        this._renderFormingTile(gl, camera, time, tile, formationState);
      } else if (materializeState) {
        // Render with materialization animation
        this._renderMaterializingTile(gl, camera, time, x, y, tile, stackIndex, isHQ, materializeState);
      } else if (isLandmark) {
        // Render landmark with tapered white model
        this._renderLandmark(gl, camera, time, x, y, landmarkOwner, isHQ, hoveredTile, selectedTile);
      } else {
        // Normal tile rendering
        const worldPos = gridToWorld(x, y, this.tileSize, this.boardSize);

        // Position tile above board surface, with stacking offset
        const yOffset = BOARD_SURFACE_Y + TILE_HEIGHT / 2 + stackIndex * TILE_HEIGHT + TILE.Y_OFFSET;

        mat4.identity(this.modelMatrix);
        mat4.translate(this.modelMatrix, this.modelMatrix,
          vec3.create(worldPos[0], yOffset, worldPos[2]));

        gl.uniformMatrix4fv(this.uniforms.u_model, false, this.modelMatrix);

        // Set tile color based on type
        const color = this.getTileColor(tile.type);
        gl.uniform3fv(this.uniforms.u_tileColor, color);

        // Check hover/selection state
        const isHovered = hoveredTile && hoveredTile.x === x && hoveredTile.y === y;
        const isSelected = selectedTile && selectedTile.x === x && selectedTile.y === y;

        gl.uniform1f(this.uniforms.u_hovered, isHovered ? 1.0 : 0.0);
        gl.uniform1f(this.uniforms.u_selected, isSelected ? 1.0 : 0.0);

        // Set HQ flag for visual distinction
        gl.uniform1f(this.uniforms.u_isHQ, isHQ ? 1.0 : 0.0);

        // Disable Trinity formation uniforms for normal tiles
        gl.uniform1f(this.uniforms.u_isFormingTrinity, 0.0);

        // Set player ownership color for visual distinction
        const hasOwner = tile.placedBy !== undefined && tile.placedBy !== null;
        gl.uniform1f(this.uniforms.u_hasOwner, hasOwner ? 1.0 : 0.0);
        if (hasOwner) {
          const playerColor = PLAYER_COLORS[tile.placedBy % PLAYER_COLORS.length];
          gl.uniform3fv(this.uniforms.u_playerColor, playerColor);
        } else {
          gl.uniform3fv(this.uniforms.u_playerColor, [0.5, 0.5, 0.5]);
        }

        // Draw
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
      }
    }

    gl.bindVertexArray(null);

    // Render forming Trinity blocks (phase 3)
    for (const { value } of trinityFormations) {
      if (value && value.trinityState && value.trinityState.visible) {
        this._renderFormingTrinity(camera, time, value.trinityState);
      }
    }
  }

  /**
   * Render a tile that is materializing (placement animation)
   * @private
   */
  _renderMaterializingTile(gl, camera, time, x, y, tile, stackIndex, isHQ, matState) {
    const worldPos = gridToWorld(x, y, this.tileSize, this.boardSize);

    // Position tile using animation's world Y (includes rise effect) plus stacking offset
    const yOffset = matState.y + stackIndex * TILE_HEIGHT;

    mat4.identity(this.modelMatrix);
    mat4.translate(this.modelMatrix, this.modelMatrix,
      vec3.create(worldPos[0], yOffset, worldPos[2]));

    gl.uniformMatrix4fv(this.uniforms.u_model, false, this.modelMatrix);

    // Set tile color based on type
    const color = this.getTileColor(tile.type);
    gl.uniform3fv(this.uniforms.u_tileColor, color);

    // Disable hover/selection during materialization
    gl.uniform1f(this.uniforms.u_hovered, 0.0);
    gl.uniform1f(this.uniforms.u_selected, 0.0);
    gl.uniform1f(this.uniforms.u_isHQ, isHQ ? 1.0 : 0.0);

    // Enable materialization effect using Trinity formation shader uniforms
    gl.uniform1f(this.uniforms.u_isFormingTrinity, 1.0);
    gl.uniform1f(this.uniforms.u_trinityPhase, 3.0); // Use phase 3 (materialization)
    gl.uniform1f(this.uniforms.u_phaseProgress, matState.materializeProgress || 0);
    gl.uniform1f(this.uniforms.u_borderGlowIntensity, matState.borderGlowIntensity || 0);
    gl.uniform1f(this.uniforms.u_dissolveThreshold, 0.0);
    gl.uniform1f(this.uniforms.u_formationProgress, matState.formationProgress || 0);

    // Set player ownership color
    const playerIndex = matState.playerIndex !== undefined ? matState.playerIndex :
                        (tile.placedBy !== undefined ? tile.placedBy : 0);
    const playerColor = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
    gl.uniform1f(this.uniforms.u_hasOwner, 1.0);
    gl.uniform3fv(this.uniforms.u_playerColor, playerColor);

    // Draw
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  /**
   * Render a landmark with the tapered white square model
   * @private
   */
  _renderLandmark(gl, camera, time, x, y, landmarkOwner, isHQ, hoveredTile, selectedTile) {
    // Bind landmark VAO
    gl.bindVertexArray(this.landmarkVao);

    const worldPos = gridToWorld(x, y, this.tileSize, this.boardSize);

    // Position landmark above board surface (centered on the landmark height)
    const yOffset = BOARD_SURFACE_Y + LANDMARK.HEIGHT / 2 + TILE.Y_OFFSET;

    mat4.identity(this.modelMatrix);
    mat4.translate(this.modelMatrix, this.modelMatrix,
      vec3.create(worldPos[0], yOffset, worldPos[2]));

    gl.uniformMatrix4fv(this.uniforms.u_model, false, this.modelMatrix);

    // Set white/off-white color for landmarks
    gl.uniform3fv(this.uniforms.u_tileColor, LANDMARK.COLOR);

    // Check hover/selection state
    const isHovered = hoveredTile && hoveredTile.x === x && hoveredTile.y === y;
    const isSelected = selectedTile && selectedTile.x === x && selectedTile.y === y;

    gl.uniform1f(this.uniforms.u_hovered, isHovered ? 1.0 : 0.0);
    gl.uniform1f(this.uniforms.u_selected, isSelected ? 1.0 : 0.0);

    // Set HQ flag for visual distinction (HQ could have special effect)
    gl.uniform1f(this.uniforms.u_isHQ, isHQ ? 1.0 : 0.0);

    // Disable Trinity formation uniforms
    gl.uniform1f(this.uniforms.u_isFormingTrinity, 0.0);

    // Set player ownership color (for subtle tinting or border)
    const playerColor = PLAYER_COLORS[landmarkOwner % PLAYER_COLORS.length];
    gl.uniform1f(this.uniforms.u_hasOwner, 1.0);
    gl.uniform3fv(this.uniforms.u_playerColor, playerColor);

    // Draw landmark
    gl.drawElements(gl.TRIANGLES, this.landmarkIndexCount, gl.UNSIGNED_SHORT, 0);

    // Rebind tile VAO for subsequent tiles
    gl.bindVertexArray(this.vao);
  }

  /**
   * Render a tile that is part of Trinity formation animation
   * @private
   */
  _renderFormingTile(gl, camera, time, tile, formationState) {
    const worldPos = gridToWorld(formationState.x, formationState.z, this.tileSize, this.boardSize);

    mat4.identity(this.modelMatrix);
    mat4.translate(this.modelMatrix, this.modelMatrix,
      vec3.create(worldPos[0], formationState.worldY, worldPos[2]));

    // Apply scale from animation
    if (formationState.scale !== 1.0) {
      mat4.scale(this.modelMatrix, this.modelMatrix,
        vec3.create(formationState.scale, formationState.scale, formationState.scale));
    }

    gl.uniformMatrix4fv(this.uniforms.u_model, false, this.modelMatrix);

    // Set tile color based on type
    const color = this.getTileColor(tile.type);
    gl.uniform3fv(this.uniforms.u_tileColor, color);

    // Disable hover/selection during formation
    gl.uniform1f(this.uniforms.u_hovered, 0.0);
    gl.uniform1f(this.uniforms.u_selected, 0.0);
    gl.uniform1f(this.uniforms.u_isHQ, 0.0);

    // Set Trinity formation uniforms
    gl.uniform1f(this.uniforms.u_isFormingTrinity, 1.0);
    gl.uniform1f(this.uniforms.u_trinityPhase, formationState.phase);
    gl.uniform1f(this.uniforms.u_phaseProgress, formationState.phaseProgress);
    gl.uniform1f(this.uniforms.u_borderGlowIntensity, formationState.borderGlowIntensity || 0.0);
    gl.uniform1f(this.uniforms.u_dissolveThreshold, formationState.dissolveThreshold || 0.0);
    gl.uniform1f(this.uniforms.u_formationProgress, 0.0);

    // Set player ownership color
    const hasOwner = tile.placedBy !== undefined && tile.placedBy !== null;
    gl.uniform1f(this.uniforms.u_hasOwner, hasOwner ? 1.0 : 0.0);
    if (hasOwner) {
      const playerColor = PLAYER_COLORS[tile.placedBy % PLAYER_COLORS.length];
      gl.uniform3fv(this.uniforms.u_playerColor, playerColor);
    } else {
      gl.uniform3fv(this.uniforms.u_playerColor, [0.5, 0.5, 0.5]);
    }

    // Draw
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  /**
   * Render a Trinity block that is forming (phase 3)
   * Uses the tapered landmark geometry with formation animation
   * @private
   */
  _renderFormingTrinity(camera, time, trinityState) {
    const gl = this.gl;
    const { x, z, formationProgress, playerIndex } = trinityState;

    // Don't render if not visible yet
    if (!trinityState.visible || formationProgress <= 0) return;

    this._setCommonUniforms(camera, time);
    gl.bindVertexArray(this.landmarkVao);

    const worldPos = gridToWorld(x, z, this.tileSize, this.boardSize);

    // Smooth eased progress for animation
    const progress = formationProgress;

    // Position landmark above board surface
    // Start slightly below and rise to final position
    const baseY = BOARD_SURFACE_Y + LANDMARK.HEIGHT / 2 + TILE.Y_OFFSET;
    const yOffset = baseY - (1 - progress) * 0.2; // Rise up as it forms

    mat4.identity(this.modelMatrix);
    mat4.translate(this.modelMatrix, this.modelMatrix,
      vec3.create(worldPos[0], yOffset, worldPos[2]));

    // Scale up during formation (start at 0.3, grow to full size)
    // Use easing for smooth appearance
    const minScale = 0.3;
    const scale = minScale + (1.0 - minScale) * progress;
    mat4.scale(this.modelMatrix, this.modelMatrix,
      vec3.create(scale, scale, scale));

    gl.uniformMatrix4fv(this.uniforms.u_model, false, this.modelMatrix);

    // Use white color for the landmark, with glow that fades as it solidifies
    const glowIntensity = (1.0 - progress) * 0.8;
    const r = Math.min(1, LANDMARK.COLOR[0] + glowIntensity * 0.4);
    const g = Math.min(1, LANDMARK.COLOR[1] + glowIntensity * 0.4);
    const b = Math.min(1, LANDMARK.COLOR[2] + glowIntensity * 0.4);
    gl.uniform3fv(this.uniforms.u_tileColor, [r, g, b]);

    // Disable hover/selection
    gl.uniform1f(this.uniforms.u_hovered, 0.0);
    gl.uniform1f(this.uniforms.u_selected, 0.0);
    gl.uniform1f(this.uniforms.u_isHQ, 0.0);

    // Set Trinity formation uniforms for phase 3
    gl.uniform1f(this.uniforms.u_isFormingTrinity, 1.0);
    gl.uniform1f(this.uniforms.u_trinityPhase, 3.0); // Phase 3: Formation
    gl.uniform1f(this.uniforms.u_phaseProgress, progress);
    gl.uniform1f(this.uniforms.u_borderGlowIntensity, glowIntensity);
    gl.uniform1f(this.uniforms.u_dissolveThreshold, 0.0);
    gl.uniform1f(this.uniforms.u_formationProgress, progress);

    // Player color for luminescence
    const playerColor = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
    gl.uniform1f(this.uniforms.u_hasOwner, 1.0);
    gl.uniform3fv(this.uniforms.u_playerColor, playerColor);

    // Draw the tapered landmark
    gl.drawElements(gl.TRIANGLES, this.landmarkIndexCount, gl.UNSIGNED_SHORT, 0);

    gl.bindVertexArray(null);
  }

  /**
   * Render a single tile at a specific position (for hand display, etc.)
   */
  renderSingle(camera, time, x, y, z, tileType, options = {}) {
    const gl = this.gl;
    const { hovered = false, selected = false, playerIndex = null } = options;

    this._setCommonUniforms(camera, time);

    mat4.identity(this.modelMatrix);
    mat4.translate(this.modelMatrix, this.modelMatrix, vec3.create(x, y, z));

    gl.uniformMatrix4fv(this.uniforms.u_model, false, this.modelMatrix);

    const color = this.getTileColor(tileType);
    gl.uniform3fv(this.uniforms.u_tileColor, color);
    gl.uniform1f(this.uniforms.u_hovered, hovered ? 1.0 : 0.0);
    gl.uniform1f(this.uniforms.u_selected, selected ? 1.0 : 0.0);
    gl.uniform1f(this.uniforms.u_isHQ, 0.0);

    // Set player ownership color
    const hasOwner = playerIndex !== null && playerIndex !== undefined;
    gl.uniform1f(this.uniforms.u_hasOwner, hasOwner ? 1.0 : 0.0);
    if (hasOwner) {
      const playerColor = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
      gl.uniform3fv(this.uniforms.u_playerColor, playerColor);
    } else {
      gl.uniform3fv(this.uniforms.u_playerColor, [0.5, 0.5, 0.5]);
    }

    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }

  /**
   * Render all agents on the board
   * @param {Object} camera - Camera instance
   * @param {number} time - Current time
   * @param {Array} agents - Array of {x, y, owner, count} objects
   * @param {Object} options - Rendering options
   */
  renderAgents(camera, time, agents, options = {}) {
    if (!agents || agents.length === 0) return;

    const gl = this.gl;

    this._setCommonUniforms(camera, time);
    gl.bindVertexArray(this.agentVao);

    // Group agents by position to handle stacking
    const agentsByPosition = new Map();
    for (const agent of agents) {
      const key = `${agent.x},${agent.y}`;
      if (!agentsByPosition.has(key)) {
        agentsByPosition.set(key, []);
      }
      // Add multiple entries for count > 1
      for (let i = 0; i < agent.count; i++) {
        agentsByPosition.get(key).push(agent.owner);
      }
    }

    // Render each position's agents with stacking
    for (const [key, ownerList] of agentsByPosition) {
      const [x, y] = key.split(',').map(Number);
      const worldPos = gridToWorld(x, y, this.tileSize, this.boardSize);

      // Check if there's a tile or landmark at this position for base height
      const baseTileHeight = this._getBaseHeightAt(x, y, options.tiles);

      let stackIndex = 0;
      for (const owner of ownerList) {
        // Calculate Y position: base tile height + agent offset + stacking
        const yOffset = baseTileHeight + AGENT.HEIGHT / 2 + AGENT.Y_OFFSET +
          stackIndex * AGENT.STACK_OFFSET;

        mat4.identity(this.modelMatrix);
        mat4.translate(this.modelMatrix, this.modelMatrix,
          vec3.create(worldPos[0], yOffset, worldPos[2]));

        gl.uniformMatrix4fv(this.uniforms.u_model, false, this.modelMatrix);

        // Set agent color based on owner (uses same player colors for consistency)
        const color = PLAYER_COLORS[owner % PLAYER_COLORS.length];
        gl.uniform3fv(this.uniforms.u_tileColor, color);

        // Agents are always slightly "hovered" looking for visibility
        gl.uniform1f(this.uniforms.u_hovered, 0.3);
        gl.uniform1f(this.uniforms.u_selected, 0.0);

        // Draw agent
        gl.drawElements(gl.TRIANGLES, this.agentIndexCount, gl.UNSIGNED_SHORT, 0);

        stackIndex++;
      }
    }

    gl.bindVertexArray(null);
  }

  /**
   * Get the base height at a position (accounts for tiles and landmarks)
   * @private
   */
  _getBaseHeightAt(x, y, tiles) {
    if (!tiles) return BOARD_SURFACE_Y + TILE.Y_OFFSET;

    // Find the highest tile at this position
    let maxStackIndex = -1;
    for (const { x: tx, y: ty, stackIndex = 0 } of tiles) {
      if (tx === x && ty === y) {
        maxStackIndex = Math.max(maxStackIndex, stackIndex);
      }
    }

    if (maxStackIndex >= 0) {
      // There's a tile here, agent sits on top
      return BOARD_SURFACE_Y + TILE.Y_OFFSET + (maxStackIndex + 1) * TILE.HEIGHT;
    }

    // No tile, agent sits on board surface
    return BOARD_SURFACE_Y + TILE.Y_OFFSET;
  }

  /**
   * Get player color for a player (used for agents and ownership tinting)
   * @param {number} playerIndex
   * @returns {Array<number>} RGB color array
   */
  getPlayerColor(playerIndex) {
    return PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
  }

  /**
   * Get agent color for a player (alias for getPlayerColor)
   * @param {number} playerIndex
   * @returns {Array<number>} RGB color array
   */
  getAgentColor(playerIndex) {
    return this.getPlayerColor(playerIndex);
  }

  /**
   * Render a ghost/preview tile at a position
   * Shows where a tile will be placed with transparency and animation
   * @param {Object} camera - Camera instance
   * @param {number} time - Current time
   * @param {number} gridX - Board X position
   * @param {number} gridY - Board Y position
   * @param {string} tileType - Type of tile to preview
   * @param {boolean} isValid - Whether this is a valid placement position
   * @param {number} playerIndex - Player who would place this tile
   */
  renderPreview(camera, time, gridX, gridY, tileType, isValid, playerIndex = 0) {
    if (gridX < 0 || gridY < 0) return;

    const gl = this.gl;
    const worldPos = gridToWorld(gridX, gridY, this.tileSize, this.boardSize);

    // Floating animation
    const floatOffset = Math.sin(time * 3) * 0.05;
    const yOffset = BOARD_SURFACE_Y + TILE_HEIGHT / 2 + TILE.Y_OFFSET + 0.1 + floatOffset;

    this._setCommonUniforms(camera, time);

    mat4.identity(this.modelMatrix);
    mat4.translate(this.modelMatrix, this.modelMatrix,
      vec3.create(worldPos[0], yOffset, worldPos[2]));

    // Slight rotation for visual interest
    const rotation = Math.sin(time * 2) * 0.05;
    mat4.rotateY(this.modelMatrix, this.modelMatrix, rotation);

    gl.uniformMatrix4fv(this.uniforms.u_model, false, this.modelMatrix);

    // Set tile color based on type
    const color = this.getTileColor(tileType);
    gl.uniform3fv(this.uniforms.u_tileColor, color);

    // Preview is always "hovered" with pulsing effect
    const pulseIntensity = isValid ? 0.8 : 0.4;
    gl.uniform1f(this.uniforms.u_hovered, pulseIntensity);
    gl.uniform1f(this.uniforms.u_selected, 0.0);
    gl.uniform1f(this.uniforms.u_isHQ, 0.0);

    // Set player ownership color
    const playerColor = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
    gl.uniform1f(this.uniforms.u_hasOwner, 1.0);
    gl.uniform3fv(this.uniforms.u_playerColor, playerColor);

    // Set opacity: 15% transparent (85% opaque) for invalid placements
    gl.uniform1f(this.uniforms.u_opacity, isValid ? 1.0 : 0.85);

    // Disable trinity formation effects for preview
    gl.uniform1f(this.uniforms.u_isFormingTrinity, 0.0);

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }

  /**
   * Calculate the world position for a hand tile
   * @param {number} playerIndex - 0 or 1
   * @param {number} tileIndex - Index within the hand
   * @param {number} totalTiles - Total tiles in that player's hand
   * @returns {Array} [x, y, z] world position
   */
  getHandTileWorldPosition(playerIndex, tileIndex, totalTiles) {
    const halfBoard = this.boardSize * this.tileSize * 0.5;
    const zOffset = HAND_TILES.Z_OFFSET;
    const yOffset = HAND_TILES.Y_OFFSET + BOARD.HEIGHT;

    // Calculate horizontal spread
    const totalWidth = (totalTiles - 1) * HAND_TILES.TILE_SPACING;
    const startX = -totalWidth / 2;
    const x = startX + tileIndex * HAND_TILES.TILE_SPACING;

    // Z position: player 0 at near edge (negative Z), player 1 at far edge (positive Z)
    const z = playerIndex === 0 ? -zOffset : zOffset;

    return [x, yOffset, z];
  }

  /**
   * Render player hand tiles at board edges
   * @param {Object} camera - Camera instance
   * @param {number} time - Current time for animations
   * @param {Object} gameState - Game state for accessing hands
   * @param {number} currentPlayer - Index of current player
   * @param {number} selectedIndex - Currently selected hand tile index (-1 if none)
   * @param {number} hoveredIndex - Currently hovered hand tile index (-1 if none)
   */
  renderHandTiles(camera, time, gameState, currentPlayer, selectedIndex = -1, hoveredIndex = -1) {
    const gl = this.gl;
    const numPlayers = gameState.getPlayers().length;

    this._setCommonUniforms(camera, time);

    // Enable blending for opponent transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.bindVertexArray(this.vao);

    // Render each player's hand
    for (let playerIndex = 0; playerIndex < Math.min(numPlayers, 2); playerIndex++) {
      const hand = gameState.getPlayerHand(playerIndex);
      const isCurrentPlayer = playerIndex === currentPlayer;
      const totalTiles = hand.length;

      for (let tileIndex = 0; tileIndex < totalTiles; tileIndex++) {
        const tile = hand[tileIndex];
        const [x, y, z] = this.getHandTileWorldPosition(playerIndex, tileIndex, totalTiles);

        // Determine if this tile is hovered or selected (only for current player)
        const isHovered = isCurrentPlayer && tileIndex === hoveredIndex;
        const isSelected = isCurrentPlayer && tileIndex === selectedIndex;

        // Calculate scale based on state
        let scale = 1.0;
        if (isSelected) {
          scale = HAND_TILES.SELECTION_SCALE;
        } else if (isHovered) {
          scale = HAND_TILES.HOVER_SCALE;
        }

        // Floating animation for current player's tiles
        let floatOffset = 0;
        if (isCurrentPlayer) {
          floatOffset = Math.sin(time * 2 + tileIndex * 0.5) * 0.03;
          if (isSelected) {
            floatOffset += 0.08; // Lift selected tile higher
          }
        }

        mat4.identity(this.modelMatrix);
        mat4.translate(this.modelMatrix, this.modelMatrix, vec3.create(x, y + floatOffset, z));

        // Apply scale
        if (scale !== 1.0) {
          mat4.scale(this.modelMatrix, this.modelMatrix, vec3.create(scale, scale, scale));
        }

        gl.uniformMatrix4fv(this.uniforms.u_model, false, this.modelMatrix);

        // Set tile color based on type
        const color = this.getTileColor(tile.type);
        gl.uniform3fv(this.uniforms.u_tileColor, color);

        // Set hover/selection state
        gl.uniform1f(this.uniforms.u_hovered, isHovered ? 1.0 : (isCurrentPlayer ? 0.2 : 0.0));
        gl.uniform1f(this.uniforms.u_selected, isSelected ? 1.0 : 0.0);
        gl.uniform1f(this.uniforms.u_isHQ, 0.0);

        // Set player ownership color
        const playerColor = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
        gl.uniform1f(this.uniforms.u_hasOwner, 1.0);
        gl.uniform3fv(this.uniforms.u_playerColor, playerColor);

        // Set opacity: full for current player, reduced for opponent
        const opacity = isCurrentPlayer ? 1.0 : HAND_TILES.OPPONENT_OPACITY;
        gl.uniform1f(this.uniforms.u_opacity, opacity);

        // Disable trinity formation effects
        gl.uniform1f(this.uniforms.u_isFormingTrinity, 0.0);

        // Draw
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
      }
    }

    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }

  /**
   * Check if a screen position hits a hand tile
   * @param {number} screenX - Screen X coordinate
   * @param {number} screenY - Screen Y coordinate
   * @param {Object} camera - Camera instance
   * @param {Object} gameState - Game state
   * @param {number} viewportWidth - Viewport width in pixels
   * @param {number} viewportHeight - Viewport height in pixels
   * @returns {Object|null} { playerIndex, tileIndex } or null if no hit
   */
  getHandTileAtScreenPosition(screenX, screenY, camera, gameState, viewportWidth, viewportHeight) {
    const viewProj = camera.getViewProjectionMatrix();
    const numPlayers = Math.min(gameState.getPlayers().length, 2);
    const clickRadius = HAND_TILES.CLICK_RADIUS;

    // Check each player's hand tiles
    for (let playerIndex = 0; playerIndex < numPlayers; playerIndex++) {
      const hand = gameState.getPlayerHand(playerIndex);
      const totalTiles = hand.length;

      for (let tileIndex = 0; tileIndex < totalTiles; tileIndex++) {
        const [x, y, z] = this.getHandTileWorldPosition(playerIndex, tileIndex, totalTiles);
        const worldPos = vec3.create(x, y, z);

        // Project to screen coordinates
        const screenPos = worldToScreen(worldPos, viewProj, viewportWidth, viewportHeight);

        // Check if click is within radius of this tile's screen position
        const dx = screenX - screenPos[0];
        const dy = screenY - screenPos[1];
        const distSq = dx * dx + dy * dy;

        if (distSq <= clickRadius * clickRadius) {
          return { playerIndex, tileIndex };
        }
      }
    }

    return null;
  }
}
