/**
 * Trinity - Input Manager
 * Centralizes all input handling with a pub/sub event system
 */

import { INPUT } from '../config.js';

/**
 * @typedef {Object} InputState
 * @property {number} mouseX - Current mouse X position (canvas coordinates)
 * @property {number} mouseY - Current mouse Y position (canvas coordinates)
 * @property {boolean} mouseDown - Is primary mouse button pressed
 * @property {boolean} rightMouseDown - Is secondary mouse button pressed
 * @property {Object} hoveredTile - Currently hovered tile {x, y} or {x: -1, y: -1} if none
 */

/**
 * Input event types emitted by InputManager
 * @readonly
 * @enum {string}
 */
export const InputEvent = Object.freeze({
  MOUSE_MOVE: 'mouse-move',
  MOUSE_DOWN: 'mouse-down',
  MOUSE_UP: 'mouse-up',
  CLICK: 'click',
  RIGHT_CLICK: 'right-click',
  ZOOM: 'zoom',
  TILE_HOVER: 'tile-hover',
  TILE_CLICK: 'tile-click',
  KEY_DOWN: 'key-down',
  KEY_UP: 'key-up',
});

export class InputManager {
  /**
   * @param {HTMLElement} inputElement - Element to attach listeners to
   * @param {HTMLCanvasElement} canvas - Canvas for coordinate calculations
   */
  constructor(inputElement, canvas) {
    this.inputElement = inputElement;
    this.canvas = canvas;

    // Current input state
    this.state = {
      mouseX: 0,
      mouseY: 0,
      mouseDown: false,
      rightMouseDown: false,
      hoveredTile: { x: -1, y: -1 },
    };

    // Event subscribers: Map<eventType, Set<callback>>
    this.subscribers = new Map();

    // Tile coordinate converter (set externally)
    this.tileConverter = null;

    // Bind methods
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onClick = this._onClick.bind(this);
    this._onContextMenu = this._onContextMenu.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);

    this._attachListeners();
  }

  /**
   * Set the function that converts screen coordinates to tile coordinates
   * @param {Function} converter - (screenX, screenY) => {x, y, valid}
   */
  setTileConverter(converter) {
    this.tileConverter = converter;
  }

  /**
   * Subscribe to an input event
   * @param {string} eventType - Event type from InputEvent enum
   * @param {Function} callback - Function to call when event fires
   * @returns {Function} Unsubscribe function
   */
  on(eventType, callback) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType).add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.get(eventType)?.delete(callback);
    };
  }

  /**
   * Unsubscribe from an input event
   * @param {string} eventType
   * @param {Function} callback
   */
  off(eventType, callback) {
    this.subscribers.get(eventType)?.delete(callback);
  }

  /**
   * Emit an event to all subscribers
   * @param {string} eventType
   * @param {Object} data
   */
  emit(eventType, data) {
    const callbacks = this.subscribers.get(eventType);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(data);
      }
    }
  }

  /**
   * Get current input state (read-only copy)
   * @returns {InputState}
   */
  getState() {
    return { ...this.state, hoveredTile: { ...this.state.hoveredTile } };
  }

  /**
   * Get currently hovered tile
   * @returns {{x: number, y: number}}
   */
  getHoveredTile() {
    return { ...this.state.hoveredTile };
  }

  /**
   * Attach DOM event listeners
   * @private
   */
  _attachListeners() {
    const el = this.inputElement;

    el.addEventListener('mousemove', this._onMouseMove);
    el.addEventListener('mousedown', this._onMouseDown);
    el.addEventListener('mouseup', this._onMouseUp);
    el.addEventListener('click', this._onClick);
    el.addEventListener('contextmenu', this._onContextMenu);
    el.addEventListener('wheel', this._onWheel, { passive: false });

    // Keyboard events on document (global)
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
  }

  /**
   * Remove DOM event listeners
   */
  destroy() {
    const el = this.inputElement;

    el.removeEventListener('mousemove', this._onMouseMove);
    el.removeEventListener('mousedown', this._onMouseDown);
    el.removeEventListener('mouseup', this._onMouseUp);
    el.removeEventListener('click', this._onClick);
    el.removeEventListener('contextmenu', this._onContextMenu);
    el.removeEventListener('wheel', this._onWheel);

    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);

    this.subscribers.clear();
  }

  /**
   * Update mouse position from event
   * @private
   */
  _updateMousePosition(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.state.mouseX = e.clientX - rect.left;
    this.state.mouseY = e.clientY - rect.top;
  }

  /**
   * Update hovered tile using converter
   * @private
   */
  _updateHoveredTile() {
    if (!this.tileConverter) {
      return;
    }

    const result = this.tileConverter(this.state.mouseX, this.state.mouseY);

    const oldTile = this.state.hoveredTile;
    const newTile = result.valid ? { x: result.x, y: result.y } : { x: -1, y: -1 };

    // Only emit if tile changed
    if (oldTile.x !== newTile.x || oldTile.y !== newTile.y) {
      this.state.hoveredTile = newTile;
      this.emit(InputEvent.TILE_HOVER, {
        tile: { ...newTile },
        previousTile: { ...oldTile },
      });
    }
  }

  // --- Event Handlers ---

  _onMouseMove(e) {
    this._updateMousePosition(e);
    this._updateHoveredTile();

    this.emit(InputEvent.MOUSE_MOVE, {
      x: this.state.mouseX,
      y: this.state.mouseY,
    });
  }

  _onMouseDown(e) {
    if (e.button === 0) {
      this.state.mouseDown = true;
    } else if (e.button === 2) {
      this.state.rightMouseDown = true;
    }

    this.emit(InputEvent.MOUSE_DOWN, {
      button: e.button,
      x: this.state.mouseX,
      y: this.state.mouseY,
    });
  }

  _onMouseUp(e) {
    if (e.button === 0) {
      this.state.mouseDown = false;
    } else if (e.button === 2) {
      this.state.rightMouseDown = false;
    }

    this.emit(InputEvent.MOUSE_UP, {
      button: e.button,
      x: this.state.mouseX,
      y: this.state.mouseY,
    });
  }

  _onClick(e) {
    this.emit(InputEvent.CLICK, {
      x: this.state.mouseX,
      y: this.state.mouseY,
    });

    // Also emit tile click if hovering a valid tile
    const tile = this.state.hoveredTile;
    if (tile.x >= 0 && tile.y >= 0) {
      this.emit(InputEvent.TILE_CLICK, {
        tile: { ...tile },
      });
    }
  }

  _onContextMenu(e) {
    e.preventDefault();
    this.emit(InputEvent.RIGHT_CLICK, {
      x: this.state.mouseX,
      y: this.state.mouseY,
      tile: { ...this.state.hoveredTile },
    });
  }

  _onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? INPUT.ZOOM_SPEED : -INPUT.ZOOM_SPEED;

    this.emit(InputEvent.ZOOM, {
      delta,
      x: this.state.mouseX,
      y: this.state.mouseY,
    });
  }

  _onKeyDown(e) {
    // Don't capture if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
      return;
    }

    this.emit(InputEvent.KEY_DOWN, {
      key: e.key,
      code: e.code,
      shift: e.shiftKey,
      ctrl: e.ctrlKey || e.metaKey,
      alt: e.altKey,
    });
  }

  _onKeyUp(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
      return;
    }

    this.emit(InputEvent.KEY_UP, {
      key: e.key,
      code: e.code,
      shift: e.shiftKey,
      ctrl: e.ctrlKey || e.metaKey,
      alt: e.altKey,
    });
  }
}
