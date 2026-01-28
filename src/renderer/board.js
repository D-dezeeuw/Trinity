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

export class BoardRenderer {
  constructor(gl) {
    this.gl = gl;
    this.program = null;
    this.vao = null;
    this.uniforms = null;
    this.indexCount = 0;

    // Board settings
    this.boardSize = 8;
    this.tileSize = 1.0;

    // Model matrix (identity for board at origin)
    this.modelMatrix = mat4.create();

    // Hovered tile (-1, -1 means no hover)
    this.hoveredTile = { x: -1, y: -1 };

    // Light direction (from top-right)
    this.lightDir = vec3.create(0.5, 1.0, 0.5);
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
      'u_boardSize'
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
   * Create board geometry (flat plane)
   */
  createBoardGeometry() {
    const size = this.boardSize * this.tileSize;
    const half = size / 2;

    // Simple quad for the board
    const positions = [
      -half, 0, -half,
       half, 0, -half,
       half, 0,  half,
      -half, 0,  half
    ];

    const normals = [
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
      0, 1, 0
    ];

    const uvs = [
      0, 0,
      1, 0,
      1, 1,
      0, 1
    ];

    const indices = [
      0, 1, 2,
      0, 2, 3
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
}
