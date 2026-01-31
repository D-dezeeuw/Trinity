/**
 * Trinity - WebGL Renderer
 * Wraps existing WebGL renderers (BoardRenderer, TileRenderer, UIRenderer)
 * to conform to the Renderer interface for modular switching
 */

import { Renderer } from './Renderer.js';
import { initWebGL, resizeCanvas, setupRenderState, clear } from './webgl.js';
import { Camera } from './camera.js';
import { BoardRenderer } from './board.js';
import { TileRenderer } from './TileRenderer.js';
import { UIRenderer } from './UIRenderer.js';
import { AnimationManager } from './AnimationManager.js';

/**
 * WebGLRenderer wraps the existing WebGL-based rendering system
 * Provides full visual rendering with animations and interactivity
 */
export class WebGLRenderer extends Renderer {
  /**
   * @param {Object} options
   * @param {WebGLRenderingContext|null} options.gl - Existing GL context (optional)
   * @param {HTMLCanvasElement|null} options.glCanvas - WebGL canvas (optional)
   * @param {HTMLCanvasElement|null} options.uiCanvas - UI canvas (optional)
   * @param {Camera|null} options.camera - Existing camera (optional)
   * @param {BoardRenderer|null} options.boardRenderer - Existing board renderer (optional)
   * @param {TileRenderer|null} options.tileRenderer - Existing tile renderer (optional)
   * @param {UIRenderer|null} options.uiRenderer - Existing UI renderer (optional)
   * @param {AnimationManager|null} options.animationManager - Existing animation manager (optional)
   */
  constructor(options = {}) {
    super();

    // Store existing components if provided (for wrapping existing setup)
    this._gl = options.gl || null;
    this._glCanvas = options.glCanvas || null;
    this._uiCanvas = options.uiCanvas || null;
    this._camera = options.camera || null;
    this._boardRenderer = options.boardRenderer || null;
    this._tileRenderer = options.tileRenderer || null;
    this._uiRenderer = options.uiRenderer || null;
    this._animationManager = options.animationManager || null;

    // Runtime state
    this._time = 0;
    this._lastTime = 0;
    this._renderLoopId = null;
    this._gameState = null;
  }

  getName() {
    return 'webgl';
  }

  supportsAnimation() {
    return true;
  }

  supportsInteraction() {
    return true;
  }

  requiresBrowser() {
    return true;
  }

  /**
   * Initialize the WebGL renderer
   * @param {HTMLElement|null} container - Container with canvas elements
   */
  async initialize(container) {
    // If we already have all components, just mark as initialized
    if (this._gl && this._boardRenderer && this._tileRenderer) {
      this._initialized = true;
      return;
    }

    // Otherwise, initialize from scratch
    if (container) {
      this._glCanvas = container.querySelector('#gl-canvas') || container.querySelector('canvas');
      this._uiCanvas = container.querySelector('#ui-canvas');
    }

    if (!this._glCanvas) {
      throw new Error('WebGLRenderer requires a canvas element');
    }

    // Initialize WebGL context
    this._gl = initWebGL(this._glCanvas);
    if (!this._gl) {
      throw new Error('WebGL 2.0 is not supported');
    }
    setupRenderState(this._gl);

    // Create camera
    this._camera = new Camera();

    // Create renderers
    this._boardRenderer = new BoardRenderer(this._gl);
    await this._boardRenderer.init();

    this._tileRenderer = new TileRenderer(this._gl);
    await this._tileRenderer.init();

    if (this._uiCanvas) {
      this._uiRenderer = new UIRenderer(this._uiCanvas);
    }

    // Create animation manager
    this._animationManager = new AnimationManager();

    // Set up initial viewport
    this._handleResize();

    this._initialized = true;
  }

  /**
   * Set the game state for UI renderer
   * @param {import('../state/GameState.js').GameState} gameState
   */
  setGameState(gameState) {
    this._gameState = gameState;
    if (this._uiRenderer) {
      this._uiRenderer.setGameState(gameState);
    }
  }

  /**
   * Render a single frame
   * @param {import('../state/GameState.js').GameState} gameState
   * @param {Object} options
   * @param {number} options.time - Current time in seconds
   * @param {number} options.deltaTime - Time since last frame
   */
  render(gameState, options = {}) {
    if (!this._initialized) {
      throw new Error('WebGLRenderer not initialized');
    }

    const time = options.time !== undefined ? options.time : this._time;
    const deltaTime = options.deltaTime !== undefined ? options.deltaTime : 0;

    // Update animations
    if (this._animationManager) {
      this._animationManager.update(deltaTime);
    }

    // Clear
    clear(this._gl);

    // Render board
    this._boardRenderer.render(this._camera, time);

    // Render player indicators
    const numPlayers = gameState ? gameState.getPlayers().length : 2;
    this._tileRenderer.renderPlayerIndicators(this._camera, time, numPlayers);

    // Render tiles
    if (gameState) {
      const tiles = gameState.getTilesForRendering();
      if (tiles.length > 0) {
        this._tileRenderer.render(this._camera, time, tiles, {
          hoveredTile: gameState.getHoveredTile(),
          selectedTile: gameState.getSelectedTile(),
          animationManager: this._animationManager,
        });
      }

      // Render agents
      const agents = gameState.getAgents();
      if (agents.length > 0) {
        this._tileRenderer.renderAgents(this._camera, time, agents, { tiles });
      }
    }

    // Render UI
    if (this._uiRenderer) {
      this._uiRenderer.render(time);
    }
  }

  /**
   * Handle canvas resize
   * @private
   */
  _handleResize() {
    if (this._glCanvas) {
      resizeCanvas(this._glCanvas);
      const width = this._glCanvas.width;
      const height = this._glCanvas.height;
      this._gl.viewport(0, 0, width, height);
      this._camera.setAspect(width, height);
    }

    if (this._uiCanvas) {
      resizeCanvas(this._uiCanvas);
    }
  }

  /**
   * Get the camera
   * @returns {Camera}
   */
  getCamera() {
    return this._camera;
  }

  /**
   * Get the board renderer
   * @returns {BoardRenderer}
   */
  getBoardRenderer() {
    return this._boardRenderer;
  }

  /**
   * Get the tile renderer
   * @returns {TileRenderer}
   */
  getTileRenderer() {
    return this._tileRenderer;
  }

  /**
   * Get the UI renderer
   * @returns {UIRenderer|null}
   */
  getUIRenderer() {
    return this._uiRenderer;
  }

  /**
   * Get the animation manager
   * @returns {AnimationManager}
   */
  getAnimationManager() {
    return this._animationManager;
  }

  /**
   * Get the WebGL context
   * @returns {WebGLRenderingContext}
   */
  getGL() {
    return this._gl;
  }

  /**
   * Clean up resources
   */
  destroy() {
    // Stop render loop if running
    if (this._renderLoopId) {
      cancelAnimationFrame(this._renderLoopId);
      this._renderLoopId = null;
    }

    // Note: We don't destroy the sub-renderers here since they may be shared
    // The main Game class manages the lifecycle of those components

    this._initialized = false;
  }
}
