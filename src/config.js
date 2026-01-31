/**
 * Trinity - Centralized Configuration
 * All magic numbers and tweakable values in one place
 */

// =============================================================================
// BOARD CONFIGURATION
// =============================================================================
export const BOARD = Object.freeze({
  /** Number of tiles per side (8x8 grid) */
  SIZE: 8,

  /** Size of each tile in world units */
  TILE_SIZE: 1.0,

  /** Height/depth of the 3D board (sides) */
  HEIGHT: 0.4,
});

// =============================================================================
// CAMERA CONFIGURATION
// =============================================================================
export const CAMERA = Object.freeze({
  /** Initial camera position */
  INITIAL_POSITION: Object.freeze([10, 12, 10]),

  /** Camera target (look-at point) */
  INITIAL_TARGET: Object.freeze([0, 0, 0]),

  /** Up vector */
  UP: Object.freeze([0, 1, 0]),

  /** Initial zoom level */
  INITIAL_ZOOM: 5,

  /** Minimum zoom (most zoomed in) */
  MIN_ZOOM: 2,

  /** Maximum zoom (most zoomed out) */
  MAX_ZOOM: 20,

  /** Near clipping plane */
  NEAR: 0.1,

  /** Far clipping plane */
  FAR: 100,

  /** Distance from target */
  DISTANCE: 15,

  /** Minimum pitch angle (radians) */
  MIN_PITCH: 0.2,

  /** Maximum pitch angle (radians) - just under 90 degrees */
  MAX_PITCH: Math.PI / 2 - 0.1,

  // Cursor-based rotation settings
  /** Enable cursor-based board rotation */
  CURSOR_ROTATION_ENABLED: true,

  /** Maximum yaw offset in radians (~8.5 degrees) */
  CURSOR_YAW_RANGE: 0.15,

  /** Interpolation smoothing factor (0-1, lower = smoother) */
  CURSOR_ROTATION_SMOOTHING: 0.08,

  /** Center dead zone as fraction of screen width (0.1 = 10%) */
  CURSOR_DEAD_ZONE: 0.1,

  /** Maximum pitch offset in radians (~5 degrees) */
  CURSOR_PITCH_RANGE: 0.09,

  // Player-based rotation settings
  /** Enable automatic board rotation to face active player's side */
  ROTATE_TO_ACTIVE_PLAYER: true,

  /** Rotation speed for player transitions (0-1, higher = faster) */
  PLAYER_ROTATION_SPEED: 0.032,
});

// =============================================================================
// RENDER CONFIGURATION
// =============================================================================
export const RENDER = Object.freeze({
  /** Background clear color [R, G, B, A] (0-1 range) */
  CLEAR_COLOR: Object.freeze([0.1, 0.1, 0.12, 1.0]),

  /** Light direction (normalized in shader) */
  LIGHT_DIRECTION: Object.freeze([0.5, 1.0, 0.5]),
});

// =============================================================================
// TILE DIMENSIONS
// =============================================================================
export const TILE = Object.freeze({
  /** Width of 3D tile (slightly smaller than grid cell) */
  WIDTH: 0.8,

  /** Height of 3D tile */
  HEIGHT: 0.25,

  /** Depth of 3D tile */
  DEPTH: 0.8,

  /** Small offset to prevent z-fighting with board */
  Y_OFFSET: 0.01,
});

// =============================================================================
// INPUT CONFIGURATION
// =============================================================================
export const INPUT = Object.freeze({
  /** Zoom change per scroll wheel tick */
  ZOOM_SPEED: 0.5,
});

// =============================================================================
// UI CONFIGURATION
// =============================================================================
export const UI = Object.freeze({
  /** Title text settings */
  TITLE: Object.freeze({
    TEXT: 'TRINITY',
    FONT: '24px -apple-system, BlinkMacSystemFont, sans-serif',
    COLOR: 'rgba(255, 255, 255, 0.9)',
    X: 20,
    Y: 40,
  }),

  /** Tile info display settings */
  TILE_INFO: Object.freeze({
    FONT: '14px monospace',
    COLOR: 'rgba(255, 255, 255, 0.7)',
    X: 20,
    Y_OFFSET: 20, // from bottom
  }),

  /** Instructions text settings */
  INSTRUCTIONS: Object.freeze({
    FONT: '12px -apple-system, BlinkMacSystemFont, sans-serif',
    COLOR: 'rgba(255, 255, 255, 0.5)',
    X_OFFSET: 20, // from right
    Y_START: 30,
    LINE_HEIGHT: 18,
    LINES: Object.freeze([
      'Scroll to zoom',
      'Click to select',
      '1-9: Select hand tile',
      'E: View events',
      'Space: End turn',
      'Z: Undo',
      '?: Help',
    ]),
  }),

  /** Player hand display settings */
  HAND: Object.freeze({
    /** Height of the hand area from bottom */
    HEIGHT: 100,
    /** Padding from edges */
    PADDING: 20,
    /** Size of each tile card */
    TILE_SIZE: 60,
    /** Gap between tile cards */
    GAP: 10,
    /** Border radius for tile cards */
    BORDER_RADIUS: 8,
    /** Font for tile labels */
    LABEL_FONT: '10px -apple-system, BlinkMacSystemFont, sans-serif',
    /** Background color */
    BG_COLOR: 'rgba(30, 30, 35, 0.9)',
    /** Border color */
    BORDER_COLOR: 'rgba(255, 255, 255, 0.2)',
    /** Selection highlight color */
    SELECTED_BORDER: 'rgba(255, 255, 100, 0.8)',
    /** Hover highlight color */
    HOVERED_BG: 'rgba(255, 255, 255, 0.1)',
  }),

  /** Game info panel settings */
  INFO_PANEL: Object.freeze({
    /** Width of the info panel */
    WIDTH: 220,
    /** Height of the info panel */
    HEIGHT: 150,
    /** Padding */
    PADDING: 15,
    /** Font for labels */
    LABEL_FONT: '12px -apple-system, BlinkMacSystemFont, sans-serif',
    /** Font for values */
    VALUE_FONT: '16px -apple-system, BlinkMacSystemFont, sans-serif',
    /** Background color */
    BG_COLOR: 'rgba(30, 30, 35, 0.9)',
    /** Text color */
    TEXT_COLOR: 'rgba(255, 255, 255, 0.9)',
    /** Secondary text color */
    SECONDARY_COLOR: 'rgba(255, 255, 255, 0.6)',
    /** Action button height */
    BUTTON_HEIGHT: 36,
  }),

  /** Event cards display settings */
  EVENTS: Object.freeze({
    /** Width of event card */
    CARD_WIDTH: 150,
    /** Height of event card */
    CARD_HEIGHT: 85,
    /** Gap between cards */
    GAP: 8,
    /** Padding from right edge */
    RIGHT_PADDING: 20,
    /** Y position from top */
    TOP_OFFSET: 220,
    /** Max visible cards before collapse */
    MAX_VISIBLE: 3,
    /** Border radius */
    BORDER_RADIUS: 6,
    /** Background color */
    BG_COLOR: 'rgba(40, 35, 50, 0.95)',
    /** Border color */
    BORDER_COLOR: 'rgba(180, 140, 255, 0.3)',
    /** Selected border */
    SELECTED_BORDER: 'rgba(255, 200, 100, 0.9)',
    /** Hover background */
    HOVERED_BG: 'rgba(180, 140, 255, 0.15)',
    /** Title font */
    TITLE_FONT: '11px -apple-system, BlinkMacSystemFont, sans-serif',
    /** Description font */
    DESC_FONT: '9px -apple-system, BlinkMacSystemFont, sans-serif',
    /** Category colors */
    CATEGORY_COLORS: Object.freeze({
      immediate: 'rgba(255, 120, 100, 0.8)',
      tactical: 'rgba(100, 180, 255, 0.8)',
    }),
  }),

  /** Event modal settings */
  EVENT_MODAL: Object.freeze({
    /** Modal width */
    WIDTH: 320,
    /** Modal height */
    HEIGHT: 200,
    /** Padding */
    PADDING: 20,
    /** Background */
    BG_COLOR: 'rgba(25, 25, 30, 0.98)',
    /** Border color */
    BORDER_COLOR: 'rgba(180, 140, 255, 0.5)',
    /** Button height */
    BUTTON_HEIGHT: 32,
  }),
});

// =============================================================================
// ANIMATION CONFIGURATION
// =============================================================================
export const ANIMATION = Object.freeze({
  /** Turn transition animation (player change overlay) */
  TURN_TRANSITION: Object.freeze({
    /** Enable the turn transition animation overlay */
    ENABLED: false,
    /** Duration in seconds */
    DURATION: 1.5,
  }),

  /** Starting player determination animation */
  STARTING_PLAYER: Object.freeze({
    /** Enable the starting player draw animation */
    ENABLED: false,
  }),

  /** Camera rotation to active player */
  CAMERA_ROTATION: Object.freeze({
    /** Enable camera rotation when player changes */
    ENABLED: false,
  }),
});

// =============================================================================
// 3D HAND TILES CONFIGURATION
// =============================================================================
export const HAND_TILES = Object.freeze({
  /** Height above board surface */
  Y_OFFSET: 0.3,

  /** Distance from board center (board half is 4.0) */
  Z_OFFSET: 5.0,

  /** Spacing between tile centers */
  TILE_SPACING: 1.1,

  /** Maximum tiles per hand */
  MAX_TILES: 8,

  /** Scale multiplier for selected tile */
  SELECTION_SCALE: 1.15,

  /** Scale multiplier for hovered tile */
  HOVER_SCALE: 1.08,

  /** Opacity for opponent's hand tiles */
  OPPONENT_OPACITY: 0.5,

  /** Screen-space click detection radius (pixels) */
  CLICK_RADIUS: 35,
});
