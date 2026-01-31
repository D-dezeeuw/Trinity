/**
 * Trinity - Game Rules Configuration
 * Adjustable settings for game mechanics and balance
 */

export const GameRules = {
  // =============================================================================
  // PLAYER SETTINGS
  // =============================================================================

  /** Number of players (2-4) */
  PLAYER_COUNT: 2,

  // =============================================================================
  // HAND & DRAWING
  // =============================================================================

  /** Maximum hand size - tiles beyond this are discarded */
  HAND_SIZE: 8,

  /** Whether shuffling is allowed (draw pile, mulligan, etc.) */
  ENABLE_SHUFFLE: false,

  /** Draw mode: 'refill' = draw until hand is full, 'fixed' = draw exactly DRAW_COUNT */
  DRAW_MODE: 'refill',

  /** Number of tiles to draw if DRAW_MODE is 'fixed' */
  DRAW_COUNT: 1,

  /**
   * If true, draw count = 1 base + number of landmarks owned (per rulebook).
   * Overrides DRAW_MODE when enabled.
   */
  LANDMARK_DRAW_BONUS: true,

  /**
   * If true, player(s) with fewest landmarks draw +1 extra tile (per rulebook underdog rule).
   */
  UNDERDOG_BONUS_ENABLED: true,

  // =============================================================================
  // PLACEMENT
  // =============================================================================

  /** Maximum tiles that can be placed per turn (1 = simple mode) */
  TILES_PER_TURN: 1,

  /**
   * If true, unlimited tile placement per turn (classic mode per rulebook).
   * When enabled, overrides TILES_PER_TURN.
   */
  UNLIMITED_PLACEMENT: false,

  /** Whether first tile must be in starting zone */
  REQUIRE_STARTING_ZONE: true,

  /** Whether tiles must be placed adjacent to own tiles (after first) */
  REQUIRE_ADJACENCY: true,

  // =============================================================================
  // COMBO PLACEMENT
  // =============================================================================

  /**
   * Enable combo placement rule.
   * When enabled, players can place multiple tiles per turn if each subsequent
   * tile connects to a different-type neighbor owned by that player.
   */
  COMBO_ENABLED: false,

  /**
   * Maximum tiles in a combo chain.
   * Set to Infinity for unlimited combo chains.
   */
  COMBO_MAX_CHAIN: Infinity,

  // =============================================================================
  // TURN STRUCTURE
  // =============================================================================

  /**
   * Turn phases to use. Options:
   * - 'simple': Place tile → Auto-refill → End (recommended)
   * - 'classic': Draw → Develop → Agent → End (original design)
   */
  TURN_MODE: 'simple',

  /** Whether to skip the agent phase (agents not yet implemented) */
  SKIP_AGENT_PHASE: true,

  // =============================================================================
  // TILES & DECK
  // =============================================================================

  /** Number of each tile type in the draw pile */
  TILES_PER_TYPE: 24,

  /** Tile types available */
  TILE_TYPES: ['housing', 'commerce', 'industry'],

  // =============================================================================
  // BOARD
  // =============================================================================

  /** Board size (8x8 grid) */
  BOARD_SIZE: 8,

  // =============================================================================
  // LANDMARKS
  // =============================================================================

  /** Whether to auto-form landmarks when H+C+I are adjacent */
  AUTO_FORM_LANDMARKS: true,

  /** Number of tiles required for a landmark */
  LANDMARK_SIZE: 3,

  // =============================================================================
  // HEADQUARTERS (HQ)
  // =============================================================================

  /** Whether players can convert landmarks to HQ */
  ENABLE_HQ: true,

  /** Maximum number of HQ a player can have */
  MAX_HQ_PER_PLAYER: 2,

  /** Agents spawned when landmark is converted to HQ (per rulebook: 3 tiles flip to 3 agents) */
  AGENTS_ON_HQ_CONVERSION: 3,

  // =============================================================================
  // AGENTS
  // =============================================================================

  /** Whether agent mechanics are enabled */
  ENABLE_AGENTS: true,

  /** Maximum agents a player can have on the board */
  MAX_AGENTS_PER_PLAYER: 6,

  /** Agents spawned per turn from each HQ */
  AGENTS_SPAWNED_PER_HQ: 1,

  /** Movement range for agents (adjacent = 1) */
  AGENT_MOVEMENT_RANGE: 1,

  /** Agents needed to contest an enemy landmark */
  AGENTS_TO_CONTEST: 1,

  /** Agents needed to capture an enemy landmark (convert to your HQ) */
  AGENTS_TO_CAPTURE: 2,

  /** Whether agents can move through tiles with enemy agents */
  AGENTS_CAN_PASS_ENEMIES: false,

  // =============================================================================
  // WIN CONDITIONS
  // =============================================================================

  /** Game ends when board is full */
  END_ON_FULL_BOARD: true,

  /** Game ends when draw pile is empty and all hands are empty */
  END_ON_EMPTY_DECK: true,

  /** Landmarks needed to win (0 = most landmarks when game ends) */
  LANDMARKS_TO_WIN: 0,

  /** HQ are worth this many landmarks for scoring (0 = HQ don't count toward victory per rulebook) */
  HQ_LANDMARK_VALUE: 0,

  // =============================================================================
  // SETUP OPTIONS (Per Rulebook)
  // =============================================================================

  /**
   * Use rulebook starting player determination (H > C > I tile draw).
   * If false, starting player is random.
   */
  RULEBOOK_STARTING_PLAYER: true,

  /**
   * Allow players to mulligan their starting hand once.
   * Shuffle hand back, draw new tiles.
   * NOTE: Requires ENABLE_SHUFFLE to be true.
   */
  ENABLE_MULLIGAN: false,

  /**
   * Use event draft system at game start.
   * Deal 2, keep 1, pass 1 left.
   * If false, players simply draw 2 events.
   */
  ENABLE_EVENT_DRAFT: true,

  /**
   * Open hand display - all tiles in hand visible to all players.
   * This is the rulebook default (perfect information game).
   */
  OPEN_HANDS: true,
};

/**
 * Get total tiles in draw pile
 */
export function getTotalTiles() {
  return GameRules.TILES_PER_TYPE * GameRules.TILE_TYPES.length;
}

/**
 * Check if using simple turn mode
 */
export function isSimpleTurnMode() {
  return GameRules.TURN_MODE === 'simple';
}

/**
 * Get number of tiles to draw based on current hand size
 */
export function getTilesToDraw(currentHandSize) {
  if (GameRules.DRAW_MODE === 'refill') {
    return Math.max(0, GameRules.HAND_SIZE - currentHandSize);
  }
  return GameRules.DRAW_COUNT;
}
