/**
 * Trinity - Main Entry Point
 * A tile-placement strategy game with WebGL rendering
 */

import { initWebGL, resizeCanvas, setupRenderState, clear } from './renderer/webgl.js';
import { Camera } from './renderer/camera.js';
import { BoardRenderer } from './renderer/board.js';
import { screenToWorld, worldToGrid } from './utils/math.js';

class Game {
  constructor() {
    // Canvas elements
    this.glCanvas = document.getElementById('gl-canvas');
    this.uiCanvas = document.getElementById('ui-canvas');
    this.inputLayer = document.getElementById('input-layer');
    this.loadingScreen = document.getElementById('loading');
    this.errorDisplay = document.getElementById('error');

    // Contexts
    this.gl = null;
    this.ctx = null;

    // Renderers
    this.camera = null;
    this.boardRenderer = null;

    // State
    this.isRunning = false;
    this.time = 0;
    this.lastTime = 0;

    // Mouse state
    this.mouse = {
      x: 0,
      y: 0,
      down: false,
      hoveredTile: { x: -1, y: -1 }
    };

    // Bind methods
    this.render = this.render.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onClick = this.onClick.bind(this);
  }

  /**
   * Initialize the game
   */
  async init() {
    try {
      // Initialize WebGL
      this.gl = initWebGL(this.glCanvas);
      if (!this.gl) {
        throw new Error('WebGL 2.0 is not supported by your browser');
      }

      // Initialize 2D context for UI
      this.ctx = this.uiCanvas.getContext('2d');

      // Set up WebGL state
      setupRenderState(this.gl);

      // Create camera
      this.camera = new Camera();

      // Create board renderer
      this.boardRenderer = new BoardRenderer(this.gl);
      await this.boardRenderer.init();

      // Set up event listeners
      this.setupEventListeners();

      // Initial resize
      this.onResize();

      // Hide loading screen
      this.loadingScreen.classList.add('hidden');

      // Start render loop
      this.isRunning = true;
      this.lastTime = performance.now();
      requestAnimationFrame(this.render);

      console.log('Trinity initialized successfully');

    } catch (error) {
      this.showError(error.message);
      console.error('Initialization error:', error);
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    window.addEventListener('resize', this.onResize);

    this.inputLayer.addEventListener('mousemove', this.onMouseMove);
    this.inputLayer.addEventListener('mousedown', this.onMouseDown);
    this.inputLayer.addEventListener('mouseup', this.onMouseUp);
    this.inputLayer.addEventListener('click', this.onClick);

    // Prevent context menu on right click
    this.inputLayer.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mouse wheel for zoom
    this.inputLayer.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.5 : -0.5;
      this.camera.setZoom(this.camera.zoom + delta);
    });
  }

  /**
   * Handle window resize
   */
  onResize() {
    // Resize both canvases
    resizeCanvas(this.glCanvas);
    resizeCanvas(this.uiCanvas);

    const width = this.glCanvas.width;
    const height = this.glCanvas.height;

    // Update WebGL viewport
    this.gl.viewport(0, 0, width, height);

    // Update camera aspect ratio
    this.camera.setAspect(width, height);
  }

  /**
   * Handle mouse move
   */
  onMouseMove(e) {
    const rect = this.glCanvas.getBoundingClientRect();
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;

    // Update hovered tile
    this.updateHoveredTile();
  }

  /**
   * Handle mouse down
   */
  onMouseDown(e) {
    this.mouse.down = true;
  }

  /**
   * Handle mouse up
   */
  onMouseUp(e) {
    this.mouse.down = false;
  }

  /**
   * Handle click
   */
  onClick(e) {
    const tile = this.mouse.hoveredTile;
    if (tile.x >= 0 && tile.y >= 0) {
      console.log(`Clicked tile: (${tile.x}, ${tile.y})`);
      // TODO: Handle tile selection/placement
    }
  }

  /**
   * Update hovered tile based on mouse position
   */
  updateHoveredTile() {
    const worldPos = screenToWorld(
      this.mouse.x,
      this.mouse.y,
      this.camera.getInverseViewProjectionMatrix(),
      this.glCanvas.width,
      this.glCanvas.height
    );

    if (worldPos) {
      const grid = worldToGrid(
        worldPos[0],
        worldPos[2],
        this.boardRenderer.getTileSize(),
        this.boardRenderer.getBoardSize()
      );

      if (grid.valid) {
        this.mouse.hoveredTile.x = grid.x;
        this.mouse.hoveredTile.y = grid.y;
        this.boardRenderer.setHoveredTile(grid.x, grid.y);
      } else {
        this.mouse.hoveredTile.x = -1;
        this.mouse.hoveredTile.y = -1;
        this.boardRenderer.clearHoveredTile();
      }
    } else {
      this.mouse.hoveredTile.x = -1;
      this.mouse.hoveredTile.y = -1;
      this.boardRenderer.clearHoveredTile();
    }
  }

  /**
   * Main render loop
   */
  render(currentTime) {
    if (!this.isRunning) return;

    // Calculate delta time
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    this.time += deltaTime;

    // Clear
    clear(this.gl);

    // Render board
    this.boardRenderer.render(this.camera, this.time);

    // Render UI
    this.renderUI();

    // Request next frame
    requestAnimationFrame(this.render);
  }

  /**
   * Render 2D UI overlay
   */
  renderUI() {
    const ctx = this.ctx;
    const width = this.uiCanvas.width;
    const height = this.uiCanvas.height;

    // Clear UI canvas
    ctx.clearRect(0, 0, width, height);

    // Draw title
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('TRINITY', 20, 40);

    // Draw hovered tile info
    const tile = this.mouse.hoveredTile;
    if (tile.x >= 0 && tile.y >= 0) {
      ctx.font = '14px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText(`Tile: (${tile.x}, ${tile.y})`, 20, height - 20);
    }

    // Draw instructions
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.textAlign = 'right';
    ctx.fillText('Scroll to zoom', width - 20, 30);
    ctx.fillText('Click to select tile', width - 20, 50);
  }

  /**
   * Show error message
   */
  showError(message) {
    this.loadingScreen.classList.add('hidden');
    document.getElementById('error-message').textContent = message;
    this.errorDisplay.classList.add('visible');
  }
}

// Start the game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.init();

  // Expose for debugging
  window.game = game;
});
