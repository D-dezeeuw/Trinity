/**
 * Trinity - Base Renderer Interface
 * Abstract base class for all renderer implementations
 */

/**
 * Base Renderer class that defines the interface for all renderers
 * @abstract
 */
export class Renderer {
  constructor() {
    if (new.target === Renderer) {
      throw new Error('Renderer is abstract and cannot be instantiated directly');
    }
    this._initialized = false;
  }

  /**
   * Get the renderer name/identifier
   * @returns {string}
   */
  getName() {
    return 'base';
  }

  /**
   * Initialize the renderer
   * @param {HTMLElement|null} container - Container element (null for headless renderers)
   * @returns {Promise<void>}
   */
  async initialize(container) {
    this._initialized = true;
  }

  /**
   * Render the current game state
   * @param {import('../state/GameState.js').GameState} gameState - The game state to render
   * @param {Object} options - Render options
   * @returns {*} Renderer-specific output (string for text, object for grid, void for visual)
   */
  render(gameState, options = {}) {
    throw new Error('render() must be implemented by subclass');
  }

  /**
   * Clean up resources
   */
  destroy() {
    this._initialized = false;
  }

  /**
   * Check if renderer is initialized
   * @returns {boolean}
   */
  isInitialized() {
    return this._initialized;
  }

  /**
   * Check if this renderer supports animations
   * @returns {boolean}
   */
  supportsAnimation() {
    return false;
  }

  /**
   * Check if this renderer supports user interaction
   * @returns {boolean}
   */
  supportsInteraction() {
    return false;
  }

  /**
   * Check if this renderer requires a browser/DOM environment
   * @returns {boolean}
   */
  requiresBrowser() {
    return false;
  }

  /**
   * Get renderer capabilities
   * @returns {Object}
   */
  getCapabilities() {
    return {
      animation: this.supportsAnimation(),
      interaction: this.supportsInteraction(),
      browser: this.requiresBrowser(),
    };
  }
}
