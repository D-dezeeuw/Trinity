/**
 * Trinity - Board Renderer
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
import { mat4, vec3 } from '../utils/math.js';
import { BOARD, RENDER } from '../config.js';

export class BoardRenderer {
  constructor(gl) {
    this.gl = gl;
    this.program = null;
    this.vao = null;
    this.uniforms = null;
    this.indexCount = 0;

    // Board settings from config
    this.boardSize = BOARD.SIZE;
    this.tileSize = BOARD.TILE_SIZE;

    // Model matrix (identity for board at origin)
    this.modelMatrix = mat4.create();

    // Hovered tile (-1, -1 means no hover)
    this.hoveredTile = { x: -1, y: -1 };

    // Valid placements (for tile placement mode)
    this.validPlacements = [];
    this.validPlacementsFlat = new Float32Array(64 * 2); // Max 64 valid positions

    // Landmark preview positions (tiles that would form a landmark)
    this.landmarkPreview = [];
    this.landmarkPreviewFlat = new Float32Array(6); // Max 3 positions (H, C, I)

    // Light direction from config
    this.lightDir = vec3.create(...RENDER.LIGHT_DIRECTION);
    vec3.normalize(this.lightDir, this.lightDir);
  }

  /**
   * Initialize the board renderer
   */
  async init() {
    const gl = this.gl;

    // Load shaders
    const vertSource = await loadShaderSource('/src/shaders/board.vert.glsl');
    const fragSource = await loadShaderSource('/src/shaders/board.frag.glsl');

    // Create program
    this.program = createProgram(gl, vertSource, fragSource);
    if (!this.program) {
      throw new Error('Failed to create board shader program');
    }

    // Get uniform locations
    this.uniforms = getUniformLocations(gl, this.program, [
      'u_model',
      'u_view',
      'u_projection',
      'u_lightDir',
      'u_cameraPos',
      'u_time',
      'u_hoveredTile',
      'u_tileSize',
      'u_boardSize',
      'u_validPlacements',
      'u_validPlacementCount',
      'u_landmarkPreview',
      'u_landmarkPreviewCount'
    ]);

    // Get attribute locations
    const attribs = getAttributeLocations(gl, this.program, [
      'a_position',
      'a_normal',
      'a_uv'
    ]);

    // Create board geometry
    const geometry = this.createBoardGeometry();

    // Create buffers
    const positionBuffer = createBuffer(gl, geometry.positions);
    const normalBuffer = createBuffer(gl, geometry.normals);
    const uvBuffer = createBuffer(gl, geometry.uvs);
    const indexBuffer = createIndexBuffer(gl, geometry.indices);

    this.indexCount = geometry.indices.length;

    // Create VAO
    this.vao = createVAO(gl, {
      [attribs.a_position]: { buffer: positionBuffer, size: 3 },
      [attribs.a_normal]: { buffer: normalBuffer, size: 3 },
      [attribs.a_uv]: { buffer: uvBuffer, size: 2 }
    }, indexBuffer);
  }

  /**
   * Create board geometry (3D box with sides)
   */
  createBoardGeometry() {
    const size = this.boardSize * this.tileSize;
    const half = size / 2;
    const height = BOARD.HEIGHT;

    // 3D box geometry with 6 faces (24 vertices for proper per-face normals)
    const positions = [
      // Top face (Y = height) - vertices 0-3
      -half, height, -half,
       half, height, -half,
       half, height,  half,
      -half, height,  half,

      // Front face (Z = -half, facing -Z) - vertices 4-7
      -half,      0, -half,
       half,      0, -half,
       half, height, -half,
      -half, height, -half,

      // Back face (Z = +half, facing +Z) - vertices 8-11
       half,      0,  half,
      -half,      0,  half,
      -half, height,  half,
       half, height,  half,

      // Left face (X = -half, facing -X) - vertices 12-15
      -half,      0,  half,
      -half,      0, -half,
      -half, height, -half,
      -half, height,  half,

      // Right face (X = +half, facing +X) - vertices 16-19
       half,      0, -half,
       half,      0,  half,
       half, height,  half,
       half, height, -half,

      // Bottom face (Y = 0, facing -Y) - vertices 20-23
      -half, 0,  half,
       half, 0,  half,
       half, 0, -half,
      -half, 0, -half,
    ];

    const normals = [
      // Top face - pointing up
      0, 1, 0,   0, 1, 0,   0, 1, 0,   0, 1, 0,
      // Front face - pointing -Z
      0, 0, -1,  0, 0, -1,  0, 0, -1,  0, 0, -1,
      // Back face - pointing +Z
      0, 0, 1,   0, 0, 1,   0, 0, 1,   0, 0, 1,
      // Left face - pointing -X
      -1, 0, 0,  -1, 0, 0,  -1, 0, 0,  -1, 0, 0,
      // Right face - pointing +X
      1, 0, 0,   1, 0, 0,   1, 0, 0,   1, 0, 0,
      // Bottom face - pointing down
      0, -1, 0,  0, -1, 0,  0, -1, 0,  0, -1, 0,
    ];

    const uvs = [
      // Top face - full board UV mapping
      0, 0,   1, 0,   1, 1,   0, 1,
      // Front face - side UVs
      0, 0,   1, 0,   1, 1,   0, 1,
      // Back face - side UVs
      0, 0,   1, 0,   1, 1,   0, 1,
      // Left face - side UVs
      0, 0,   1, 0,   1, 1,   0, 1,
      // Right face - side UVs
      0, 0,   1, 0,   1, 1,   0, 1,
      // Bottom face - not visible but included
      0, 0,   1, 0,   1, 1,   0, 1,
    ];

    // CCW winding order for each face (when viewed from outside)
    const indices = [
      // Top face
      0, 3, 2,   0, 2, 1,
      // Front face
      4, 7, 6,   4, 6, 5,
      // Back face
      8, 11, 10,   8, 10, 9,
      // Left face
      12, 15, 14,   12, 14, 13,
      // Right face
      16, 19, 18,   16, 18, 17,
      // Bottom face
      20, 23, 22,   20, 22, 21,
    ];

    return { positions, normals, uvs, indices };
  }

  /**
   * Set hovered tile
   */
  setHoveredTile(x, y) {
    this.hoveredTile.x = x;
    this.hoveredTile.y = y;
  }

  /**
   * Clear hovered tile
   */
  clearHoveredTile() {
    this.hoveredTile.x = -1;
    this.hoveredTile.y = -1;
  }

  /**
   * Render the board
   */
  render(camera, time) {
    const gl = this.gl;

    gl.useProgram(this.program);

    // Set uniforms
    gl.uniformMatrix4fv(this.uniforms.u_model, false, this.modelMatrix);
    gl.uniformMatrix4fv(this.uniforms.u_view, false, camera.getViewMatrix());
    gl.uniformMatrix4fv(this.uniforms.u_projection, false, camera.getProjectionMatrix());

    gl.uniform3fv(this.uniforms.u_lightDir, this.lightDir);
    gl.uniform3fv(this.uniforms.u_cameraPos, camera.getPosition());
    gl.uniform1f(this.uniforms.u_time, time);
    gl.uniform2f(this.uniforms.u_hoveredTile, this.hoveredTile.x, this.hoveredTile.y);
    gl.uniform1f(this.uniforms.u_tileSize, this.tileSize);
    gl.uniform1i(this.uniforms.u_boardSize, this.boardSize);

    // Valid placements
    gl.uniform2fv(this.uniforms.u_validPlacements, this.validPlacementsFlat);
    gl.uniform1i(this.uniforms.u_validPlacementCount, this.validPlacements.length);

    // Landmark preview
    gl.uniform2fv(this.uniforms.u_landmarkPreview, this.landmarkPreviewFlat);
    gl.uniform1i(this.uniforms.u_landmarkPreviewCount, this.landmarkPreview.length);

    // Draw
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }

  /**
   * Check if a grid position is valid
   */
  isValidPosition(x, y) {
    return x >= 0 && x < this.boardSize && y >= 0 && y < this.boardSize;
  }

  /**
   * Get board size
   */
  getBoardSize() {
    return this.boardSize;
  }

  /**
   * Get tile size
   */
  getTileSize() {
    return this.tileSize;
  }

  /**
   * Set valid placement positions to highlight
   * @param {Array<{x: number, y: number}>} positions
   */
  setValidPlacements(positions) {
    this.validPlacements = positions;

    // Flatten to Float32Array for uniform
    for (let i = 0; i < 64; i++) {
      if (i < positions.length) {
        this.validPlacementsFlat[i * 2] = positions[i].x;
        this.validPlacementsFlat[i * 2 + 1] = positions[i].y;
      } else {
        this.validPlacementsFlat[i * 2] = -1;
        this.validPlacementsFlat[i * 2 + 1] = -1;
      }
    }
  }

  /**
   * Clear valid placement highlighting
   */
  clearValidPlacements() {
    this.validPlacements = [];
    this.validPlacementsFlat.fill(-1);
  }

  /**
   * Check if a position is in the valid placements list
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isValidPlacement(x, y) {
    return this.validPlacements.some(p => p.x === x && p.y === y);
  }

  /**
   * Set landmark preview positions (tiles that would form a landmark)
   * @param {Array<{x: number, y: number}>} positions
   */
  setLandmarkPreview(positions) {
    this.landmarkPreview = positions || [];

    // Flatten to Float32Array for uniform
    for (let i = 0; i < 3; i++) {
      if (i < this.landmarkPreview.length) {
        this.landmarkPreviewFlat[i * 2] = this.landmarkPreview[i].x;
        this.landmarkPreviewFlat[i * 2 + 1] = this.landmarkPreview[i].y;
      } else {
        this.landmarkPreviewFlat[i * 2] = -1;
        this.landmarkPreviewFlat[i * 2 + 1] = -1;
      }
    }
  }

  /**
   * Clear landmark preview highlighting
   */
  clearLandmarkPreview() {
    this.landmarkPreview = [];
    this.landmarkPreviewFlat.fill(-1);
  }
}
