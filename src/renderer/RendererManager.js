/**
 * Trinity - Renderer Manager
 * Orchestrates switching between different renderer implementations
 */

/**
 * Manages multiple renderer implementations and enables runtime switching
 */
export class RendererManager {
  constructor() {
    /** @type {Map<string, import('./Renderer.js').Renderer>} */
    this._renderers = new Map();

    /** @type {import('./Renderer.js').Renderer|null} */
    this._activeRenderer = null;

    /** @type {string|null} */
    this._activeRendererName = null;

    /** @type {HTMLElement|null} */
    this._container = null;
  }

  /**
   * Register a renderer implementation
   * @param {string} name - Unique name for this renderer
   * @param {import('./Renderer.js').Renderer} renderer - Renderer instance
   */
  register(name, renderer) {
    if (this._renderers.has(name)) {
      console.warn(`Renderer "${name}" is already registered, replacing...`);
    }
    this._renderers.set(name, renderer);
  }

  /**
   * Unregister a renderer
   * @param {string} name - Name of renderer to remove
   */
  unregister(name) {
    const renderer = this._renderers.get(name);
    if (renderer) {
      if (this._activeRendererName === name) {
        renderer.destroy();
        this._activeRenderer = null;
        this._activeRendererName = null;
      }
      this._renderers.delete(name);
    }
  }

  /**
   * Set the container element for visual renderers
   * @param {HTMLElement} container
   */
  setContainer(container) {
    this._container = container;
  }

  /**
   * Switch to a different renderer
   * @param {string} name - Name of the renderer to switch to
   * @returns {Promise<import('./Renderer.js').Renderer>} The activated renderer
   */
  async switch(name) {
    const renderer = this._renderers.get(name);
    if (!renderer) {
      throw new Error(`Renderer "${name}" is not registered`);
    }

    // Destroy current renderer if different
    if (this._activeRenderer && this._activeRendererName !== name) {
      this._activeRenderer.destroy();
    }

    // Initialize new renderer if needed
    if (!renderer.isInitialized()) {
      await renderer.initialize(this._container);
    }

    this._activeRenderer = renderer;
    this._activeRendererName = name;

    return renderer;
  }

  /**
   * Get the currently active renderer
   * @returns {import('./Renderer.js').Renderer|null}
   */
  getActive() {
    return this._activeRenderer;
  }

  /**
   * Get the name of the currently active renderer
   * @returns {string|null}
   */
  getActiveName() {
    return this._activeRendererName;
  }

  /**
   * Get a registered renderer by name
   * @param {string} name
   * @returns {import('./Renderer.js').Renderer|undefined}
   */
  get(name) {
    return this._renderers.get(name);
  }

  /**
   * Get all registered renderer names
   * @returns {string[]}
   */
  getRegisteredNames() {
    return Array.from(this._renderers.keys());
  }

  /**
   * Render using the active renderer
   * @param {import('../state/GameState.js').GameState} gameState
   * @param {Object} options
   * @returns {*} Renderer-specific output
   */
  render(gameState, options = {}) {
    if (!this._activeRenderer) {
      throw new Error('No active renderer. Call switch() first.');
    }
    return this._activeRenderer.render(gameState, options);
  }

  /**
   * Check if a renderer is registered
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return this._renderers.has(name);
  }

  /**
   * Destroy all renderers and clean up
   */
  destroy() {
    for (const renderer of this._renderers.values()) {
      renderer.destroy();
    }
    this._renderers.clear();
    this._activeRenderer = null;
    this._activeRendererName = null;
  }
}

// Singleton instance for convenience
let _instance = null;

/**
 * Get the global RendererManager instance
 * @returns {RendererManager}
 */
export function getRendererManager() {
  if (!_instance) {
    _instance = new RendererManager();
  }
  return _instance;
}

/**
 * Reset the global instance (for testing)
 */
export function resetRendererManager() {
  if (_instance) {
    _instance.destroy();
    _instance = null;
  }
}
