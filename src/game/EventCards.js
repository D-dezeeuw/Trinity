/**
 * Trinity - Event Cards System
 * Defines all 19 event card types and their effects
 */

/**
 * Event card categories
 */
export const EventCategory = Object.freeze({
  IMMEDIATE: 'immediate', // Played immediately, effect resolves
  TACTICAL: 'tactical',   // Can be held and played strategically
});

/**
 * Event target types
 */
export const EventTarget = Object.freeze({
  NONE: 'none',           // No target needed
  SELF: 'self',           // Affects current player
  OPPONENT: 'opponent',   // Affects opponent
  TILE: 'tile',           // Target a specific tile
  LANDMARK: 'landmark',   // Target a landmark
  AGENT: 'agent',         // Target an agent
  ANY_TILE: 'any-tile',   // Target any tile on board
});

/**
 * All event card definitions
 */
export const EventCards = Object.freeze({
  // =========================================================================
  // MARKET & ECONOMY EVENTS
  // =========================================================================

  MARKET_CRASH: {
    id: 'market-crash',
    name: 'Market Crash',
    description: 'Target player must discard down to 3 tiles in hand.',
    category: EventCategory.IMMEDIATE,
    target: EventTarget.OPPONENT,
    copies: 2,
    effect: 'DISCARD_TO_HAND_SIZE',
    effectParams: { handSize: 3 },
  },

  CONSTRUCTION_BOOM: {
    id: 'construction-boom',
    name: 'Construction Boom',
    description: 'Draw 3 tiles from the D. Stack.',
    category: EventCategory.IMMEDIATE,
    target: EventTarget.SELF,
    copies: 2,
    effect: 'DRAW_TILES',
    effectParams: { count: 3 },
  },

  INSIDER_TRADING: {
    id: 'insider-trading',
    name: 'Insider Trading',
    description: 'Look at the top 5 tiles of the D. Stack. Put them back in any order.',
    category: EventCategory.TACTICAL,
    target: EventTarget.NONE,
    copies: 2,
    effect: 'PEEK_AND_REORDER_DECK',
    effectParams: { count: 5 },
  },

  // =========================================================================
  // TILE MANIPULATION EVENTS
  // =========================================================================

  REZONING: {
    id: 'rezoning',
    name: 'Rezoning',
    description: 'Return one of your tiles from the board to your hand.',
    category: EventCategory.TACTICAL,
    target: EventTarget.TILE,
    targetFilter: 'OWN_TILES',
    copies: 2,
    effect: 'RETURN_TILE_TO_HAND',
  },

  EMINENT_DOMAIN: {
    id: 'eminent-domain',
    name: 'Eminent Domain',
    description: 'Remove any basic tile from the board (not part of a landmark).',
    category: EventCategory.TACTICAL,
    target: EventTarget.ANY_TILE,
    targetFilter: 'NOT_LANDMARK',
    copies: 2,
    effect: 'REMOVE_TILE',
  },

  HOSTILE_ACQUISITION: {
    id: 'hostile-acquisition',
    name: 'Hostile Acquisition',
    description: 'Steal an opponent\'s tile from the board and add it to your hand.',
    category: EventCategory.TACTICAL,
    target: EventTarget.TILE,
    targetFilter: 'OPPONENT_TILES',
    copies: 2,
    effect: 'STEAL_TILE_TO_HAND',
  },

  CONVERSION_PERMIT: {
    id: 'conversion-permit',
    name: 'Conversion Permit',
    description: 'Change one of your tiles to a different type (H/C/I).',
    category: EventCategory.TACTICAL,
    target: EventTarget.TILE,
    targetFilter: 'OWN_TILES',
    copies: 2,
    effect: 'CHANGE_TILE_TYPE',
  },

  URBAN_RENEWAL: {
    id: 'urban-renewal',
    name: 'Urban Renewal',
    description: 'Move one of your tiles to an adjacent empty space.',
    category: EventCategory.TACTICAL,
    target: EventTarget.TILE,
    targetFilter: 'OWN_TILES',
    copies: 2,
    effect: 'MOVE_OWN_TILE',
  },

  SHELL_COMPANY: {
    id: 'shell-company',
    name: 'Shell Company',
    description: 'Place a tile ignoring adjacency rules (still must be valid position).',
    category: EventCategory.TACTICAL,
    target: EventTarget.NONE,
    copies: 2,
    effect: 'IGNORE_ADJACENCY',
  },

  BACKROOM_DEAL: {
    id: 'backroom-deal',
    name: 'Backroom Deal',
    description: 'Swap one of your tiles with an adjacent opponent tile.',
    category: EventCategory.TACTICAL,
    target: EventTarget.TILE,
    targetFilter: 'OWN_TILES_ADJACENT_TO_OPPONENT',
    copies: 2,
    effect: 'SWAP_TILES',
  },

  HOSTILE_REZONING: {
    id: 'hostile-rezoning',
    name: 'Hostile Rezoning',
    description: 'Change an opponent\'s tile to a different type.',
    category: EventCategory.TACTICAL,
    target: EventTarget.TILE,
    targetFilter: 'OPPONENT_TILES',
    copies: 1,
    effect: 'CHANGE_OPPONENT_TILE_TYPE',
  },

  // =========================================================================
  // AGENT EVENTS
  // =========================================================================

  REINFORCEMENTS: {
    id: 'reinforcements',
    name: 'Reinforcements',
    description: 'Place an additional agent on one of your HQ.',
    category: EventCategory.TACTICAL,
    target: EventTarget.LANDMARK,
    targetFilter: 'OWN_HQ',
    copies: 2,
    effect: 'SPAWN_AGENT',
  },

  DOUBLE_AGENT: {
    id: 'double-agent',
    name: 'Double Agent',
    description: 'Move one of your opponent\'s agents to an adjacent space.',
    category: EventCategory.TACTICAL,
    target: EventTarget.AGENT,
    targetFilter: 'OPPONENT_AGENTS',
    copies: 2,
    effect: 'MOVE_OPPONENT_AGENT',
  },

  UNION_STRIKE: {
    id: 'union-strike',
    name: 'Union Strike',
    description: 'Target player skips their agent phase this turn.',
    category: EventCategory.IMMEDIATE,
    target: EventTarget.OPPONENT,
    copies: 2,
    effect: 'SKIP_AGENT_PHASE',
  },

  // =========================================================================
  // EXPANSION EVENTS
  // =========================================================================

  HOSTILE_EXPANSION: {
    id: 'hostile-expansion',
    name: 'Hostile Expansion',
    description: 'Capture an adjacent opponent landmark without needing agents.',
    category: EventCategory.TACTICAL,
    target: EventTarget.LANDMARK,
    targetFilter: 'ADJACENT_OPPONENT_LANDMARKS',
    copies: 1,
    effect: 'FREE_CAPTURE',
  },

  // =========================================================================
  // INFORMATION EVENTS
  // =========================================================================

  EXPEDITED_PERMITS: {
    id: 'expedited-permits',
    name: 'Expedited Permits',
    description: 'Draw 2 event cards from the E. Stack.',
    category: EventCategory.IMMEDIATE,
    target: EventTarget.SELF,
    copies: 2,
    effect: 'DRAW_EVENTS',
    effectParams: { count: 2 },
  },

  STAKEOUT: {
    id: 'stakeout',
    name: 'Stakeout',
    description: 'View opponent\'s event cards and the top 3 tiles of the D. Stack.',
    category: EventCategory.TACTICAL,
    target: EventTarget.OPPONENT,
    copies: 2,
    effect: 'VIEW_HIDDEN_INFO',
    effectParams: { viewEvents: true, viewDeck: 3 },
  },

  // =========================================================================
  // DEFENSIVE EVENTS
  // =========================================================================

  INSURANCE_CLAIM: {
    id: 'insurance-claim',
    name: 'Insurance Claim',
    description: 'When a landmark is taken over, recover the tiles to your hand.',
    category: EventCategory.TACTICAL,
    target: EventTarget.NONE,
    copies: 2,
    effect: 'RECOVER_ON_TAKEOVER',
    trigger: 'ON_LANDMARK_LOST',
  },

  RED_TAPE: {
    id: 'red-tape',
    name: 'Red Tape',
    description: 'Target opponent skips their develop phase next turn.',
    category: EventCategory.IMMEDIATE,
    target: EventTarget.OPPONENT,
    copies: 2,
    effect: 'SKIP_DEVELOP_PHASE',
  },
});

/**
 * Get all event card types as array
 */
export function getAllEventTypes() {
  return Object.values(EventCards);
}

/**
 * Create the event deck (E. Stack)
 * @returns {Array<Object>} Shuffled event deck
 */
export function createEventDeck() {
  const deck = [];

  for (const eventType of Object.values(EventCards)) {
    for (let i = 0; i < eventType.copies; i++) {
      deck.push({
        ...eventType,
        instanceId: `${eventType.id}-${i}`,
      });
    }
  }

  return deck;
}

/**
 * Shuffle an array in place (Fisher-Yates)
 * @param {Array} array
 * @returns {Array}
 */
export function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Get event card by ID
 * @param {string} id
 * @returns {Object|undefined}
 */
export function getEventById(id) {
  return Object.values(EventCards).find(e => e.id === id);
}

/**
 * Check if an event requires a target
 * @param {Object} event
 * @returns {boolean}
 */
export function eventRequiresTarget(event) {
  return event.target !== EventTarget.NONE && event.target !== EventTarget.SELF;
}

/**
 * Get total number of event cards in a full deck
 * @returns {number}
 */
export function getTotalEventCards() {
  return Object.values(EventCards).reduce((sum, e) => sum + e.copies, 0);
}
