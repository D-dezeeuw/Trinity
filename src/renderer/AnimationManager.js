/**
 * Trinity - Animation Manager
 * Handles all game animations (tile placement, landmark formation, etc.)
 */

import { lerp, smoothstep } from '../utils/math.js';

/**
 * Animation types
 */
export const AnimationType = Object.freeze({
  TILE_PLACE: 'tile-place',
  TILE_MATERIALIZE: 'tile-materialize',
  TILE_REMOVE: 'tile-remove',
  LANDMARK_FORM: 'landmark-form',
  TRINITY_FORMATION: 'trinity-formation',
  AGENT_MOVE: 'agent-move',
  AGENT_SPAWN: 'agent-spawn',
  EVENT_EFFECT: 'event-effect',
  TILE_CAPTURE: 'tile-capture',
  HQ_CONVERT: 'hq-convert',
  SETTLEMENT: 'settlement',
});

/**
 * Easing functions
 */
export const Easing = {
  linear: t => t,
  easeOut: t => 1 - Math.pow(1 - t, 3),
  easeIn: t => t * t * t,
  easeInOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  bounce: t => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

/**
 * Single animation instance
 */
class Animation {
  constructor(type, data, duration, easing = Easing.easeOut) {
    this.type = type;
    this.data = data;
    this.duration = duration;
    this.easing = easing;
    this.elapsed = 0;
    this.complete = false;
    this.onComplete = null;
  }

  /**
   * Update animation
   * @param {number} deltaTime - Time elapsed since last frame (seconds)
   * @returns {number} Progress (0-1)
   */
  update(deltaTime) {
    this.elapsed += deltaTime;
    const rawProgress = Math.min(this.elapsed / this.duration, 1);
    const progress = this.easing(rawProgress);

    if (rawProgress >= 1) {
      this.complete = true;
      if (this.onComplete) {
        this.onComplete(this);
      }
    }

    return progress;
  }

  /**
   * Get current animated value
   * @returns {Object} Current animation state
   */
  getValue() {
    const progress = this.easing(Math.min(this.elapsed / this.duration, 1));
    return this._interpolate(progress);
  }

  /**
   * Interpolate values based on animation type
   * @private
   */
  _interpolate(progress) {
    const { from, to } = this.data;

    switch (this.type) {
      case AnimationType.TILE_PLACE:
        // Tile drops from above
        return {
          x: to.x,
          y: lerp(from.y, to.y, progress),
          z: to.z,
          scale: lerp(0.5, 1.0, progress),
          opacity: lerp(0.3, 1.0, progress),
        };

      case AnimationType.TILE_MATERIALIZE:
        // Tile materializes with glow effect (similar to Trinity formation)
        // Phase 1 (0-0.3): Materialize from noise
        // Phase 2 (0.3-0.7): Border glow pulse
        // Phase 3 (0.7-1.0): Settle into place
        const matPhase = progress < 0.3 ? 1 : progress < 0.7 ? 2 : 3;
        const matPhaseProgress = progress < 0.3 ? progress / 0.3 :
                                  progress < 0.7 ? (progress - 0.3) / 0.4 :
                                  (progress - 0.7) / 0.3;
        return {
          x: to.x,
          y: to.y + (1 - progress) * 0.15, // Slight rise then settle
          z: to.z,
          scale: 1.0,
          opacity: 1.0,
          // Shader uniforms for materialization effect
          isMaterializing: true,
          materializePhase: matPhase,
          materializeProgress: Easing.easeOut(matPhaseProgress),
          formationProgress: Easing.easeOut(progress), // Overall progress for dissolve/materialize
          borderGlowIntensity: matPhase === 2 ? Math.sin(matPhaseProgress * Math.PI) :
                               matPhase === 1 ? matPhaseProgress * 0.5 : (1 - matPhaseProgress) * 0.3,
          playerIndex: this.data.playerIndex,
        };

      case AnimationType.TILE_REMOVE:
        // Tile fades and shrinks
        return {
          x: from.x,
          y: lerp(from.y, from.y + 0.5, progress),
          z: from.z,
          scale: lerp(1.0, 0, progress),
          opacity: lerp(1.0, 0, progress),
        };

      case AnimationType.LANDMARK_FORM:
        // Tiles slide toward center and stack
        const slideProgress = Math.min(progress * 2, 1);
        const stackProgress = Math.max((progress - 0.5) * 2, 0);
        return {
          x: lerp(from.x, to.x, slideProgress),
          y: lerp(from.y, to.y + this.data.stackIndex * 0.3, stackProgress),
          z: lerp(from.z, to.z, slideProgress),
          scale: 1.0,
          opacity: 1.0,
        };

      case AnimationType.TRINITY_FORMATION:
        // Multi-phase Trinity formation animation
        return this._interpolateTrinityFormation(progress);

      case AnimationType.AGENT_MOVE:
        // Agent slides to new position
        return {
          x: lerp(from.x, to.x, progress),
          y: from.y,
          z: lerp(from.z, to.z, progress),
          scale: 1.0,
          opacity: 1.0,
        };

      case AnimationType.AGENT_SPAWN:
        // Agent appears and grows
        return {
          x: to.x,
          y: lerp(to.y + 1, to.y, progress),
          z: to.z,
          scale: lerp(0, 1.0, progress),
          opacity: lerp(0, 1.0, progress),
        };

      case AnimationType.EVENT_EFFECT:
        // Flash/pulse effect
        const pulseProgress = Math.sin(progress * Math.PI);
        return {
          x: to.x,
          y: to.y,
          z: to.z,
          scale: 1.0 + 0.2 * pulseProgress,
          opacity: 1.0,
          glow: pulseProgress,
          color: this.data.color || [1.0, 0.8, 0.2],
        };

      case AnimationType.TILE_CAPTURE:
        // Color transition effect
        return {
          x: to.x,
          y: to.y + 0.1 * Math.sin(progress * Math.PI * 2),
          z: to.z,
          scale: 1.0 + 0.1 * Math.sin(progress * Math.PI),
          opacity: 1.0,
          colorTransition: progress,
        };

      case AnimationType.HQ_CONVERT:
        // HQ conversion - flip and glow
        const flipProgress = progress < 0.5 ? progress * 2 : 1;
        const glowProgress = progress > 0.5 ? (progress - 0.5) * 2 : 0;
        return {
          x: to.x,
          y: to.y + 0.5 * Math.sin(progress * Math.PI),
          z: to.z,
          scale: 1.0 + 0.3 * Math.sin(progress * Math.PI),
          opacity: 1.0,
          rotateY: flipProgress * Math.PI,
          glow: glowProgress,
        };

      case AnimationType.SETTLEMENT:
        // Settlement - shake and fade
        const shake = Math.sin(progress * Math.PI * 8) * (1 - progress) * 0.2;
        return {
          x: to.x + shake,
          y: to.y,
          z: to.z + shake,
          scale: lerp(1.0, 0, progress),
          opacity: lerp(1.0, 0, progress),
          shake: true,
        };

      default:
        return { ...to, scale: 1.0, opacity: 1.0 };
    }
  }

  /**
   * Interpolate Trinity formation animation (multi-phase)
   * @private
   */
  _interpolateTrinityFormation(progress) {
    const { sourceTiles, landmarkPosition, playerIndex, phases } = this.data;
    const elapsed = this.elapsed;

    // Determine current phase based on elapsed time
    let phase = 0;
    let phaseProgress = 0;

    if (elapsed < phases.glow.end) {
      phase = 1; // Glow
      phaseProgress = elapsed / phases.glow.end;
    } else if (elapsed < phases.dissolve.end) {
      phase = 2; // Dissolve
      phaseProgress = (elapsed - phases.dissolve.start) /
                     (phases.dissolve.end - phases.dissolve.start);
    } else {
      phase = 3; // Formation
      phaseProgress = Math.min(1, (elapsed - phases.formation.start) /
                     (phases.formation.end - phases.formation.start));
    }

    // Notify phase change callback
    if (phase !== this.data.currentPhase) {
      this.data.currentPhase = phase;
      if (this.data.onPhaseChange) {
        this.data.onPhaseChange(phase);
      }
    }

    // Calculate per-tile animation states
    const tileStates = sourceTiles.map((tile, index) => {
      const state = {
        x: tile.x,
        y: tile.y,
        z: tile.y, // z maps to grid y
        worldY: tile.worldY,
        tileType: tile.tileType,
        phase,
        phaseProgress: Easing.easeInOut(Math.min(phaseProgress, 1)),
        borderGlowIntensity: 0,
        dissolveThreshold: 0,
        scale: 1.0,
        opacity: 1.0,
        visible: true
      };

      if (phase === 1) {
        // Phase 1: Border Glow
        state.borderGlowIntensity = Easing.easeOut(phaseProgress);
        // Pulse scale slightly
        state.scale = 1.0 + 0.05 * Math.sin(phaseProgress * Math.PI);
        // Rise slightly
        state.worldY = tile.worldY + 0.1 * Easing.easeOut(phaseProgress);
      } else if (phase === 2) {
        // Phase 2: Disintegration
        state.borderGlowIntensity = 1.0 - phaseProgress * 0.7;
        state.dissolveThreshold = Easing.easeIn(phaseProgress);
        // Drift toward landmark center
        const driftProgress = Easing.easeIn(phaseProgress) * 0.4;
        state.x = lerp(tile.x, landmarkPosition.x, driftProgress);
        state.z = lerp(tile.y, landmarkPosition.y, driftProgress);
        // Tiles become invisible near end of dissolve
        state.visible = phaseProgress < 0.95;
      } else if (phase === 3) {
        // Phase 3: Formation - source tiles are hidden
        state.visible = false;
      }

      return state;
    });

    // Trinity block state (only visible in phase 3)
    const TILE_HEIGHT = 0.25;
    const trinityState = {
      x: landmarkPosition.x,
      y: landmarkPosition.y,
      z: landmarkPosition.y,
      worldY: landmarkPosition.worldY,
      visible: phase === 3,
      formationProgress: phase === 3 ? Easing.easeOut(phaseProgress) : 0,
      // Staggered appearance: each stack level appears with delay
      stackStates: [0, 1, 2].map(stackIndex => {
        const staggerDelay = stackIndex * 0.15;
        const stackPhaseProgress = phase === 3 ?
          Math.max(0, (phaseProgress - staggerDelay) / (1 - staggerDelay * 2)) : 0;
        return {
          stackIndex,
          formationProgress: Easing.easeOut(Math.min(1, stackPhaseProgress)),
          worldY: landmarkPosition.worldY + stackIndex * TILE_HEIGHT,
          visible: stackPhaseProgress > 0
        };
      }),
      playerIndex
    };

    return {
      phase,
      phaseProgress,
      tileStates,
      trinityState,
      landmarkPosition
    };
  }
}

/**
 * Animation Manager - handles all active animations
 */
export class AnimationManager {
  constructor() {
    this._animations = new Map(); // Key: unique ID, Value: Animation
    this._nextId = 0;
  }

  /**
   * Create a tile placement animation
   * @param {number} x - Board X
   * @param {number} y - Board Y (grid)
   * @param {number} worldY - World Y position for tile
   * @param {Function} onComplete - Callback when animation finishes
   * @returns {number} Animation ID
   */
  animateTilePlacement(x, y, worldY, onComplete = null) {
    const dropHeight = 3; // Units above final position
    const duration = 0.4; // seconds

    const animation = new Animation(
      AnimationType.TILE_PLACE,
      {
        from: { x, y: worldY + dropHeight, z: y },
        to: { x, y: worldY, z: y },
      },
      duration,
      Easing.bounce
    );

    animation.onComplete = onComplete;
    return this._addAnimation(animation);
  }

  /**
   * Create a tile materialization animation (nice shader effect like Trinity)
   * @param {number} x - Board X
   * @param {number} y - Board Y (grid)
   * @param {number} worldY - World Y position for tile
   * @param {number} playerIndex - Player who placed the tile
   * @param {Function} onComplete - Callback when animation finishes
   * @returns {number} Animation ID
   */
  animateTileMaterialization(x, y, worldY, playerIndex, onComplete = null) {
    const duration = 0.75; // seconds (25% slower)

    const animation = new Animation(
      AnimationType.TILE_MATERIALIZE,
      {
        from: { x, y: worldY, z: y },
        to: { x, y: worldY, z: y },
        playerIndex,
      },
      duration,
      Easing.easeOut
    );

    animation.onComplete = onComplete;
    return this._addAnimation(animation);
  }

  /**
   * Get all active tile materialization animations
   * @returns {Array<{id: number, value: Object}>}
   */
  getTileMaterializations() {
    return this.getAnimationsOfType(AnimationType.TILE_MATERIALIZE);
  }

  /**
   * Create a tile removal animation
   * @param {number} x
   * @param {number} y
   * @param {number} worldY
   * @param {Function} onComplete
   * @returns {number} Animation ID
   */
  animateTileRemoval(x, y, worldY, onComplete = null) {
    const duration = 0.3;

    const animation = new Animation(
      AnimationType.TILE_REMOVE,
      {
        from: { x, y: worldY, z: y },
        to: { x, y: worldY, z: y },
      },
      duration,
      Easing.easeIn
    );

    animation.onComplete = onComplete;
    return this._addAnimation(animation);
  }

  /**
   * Create landmark formation animations
   * @param {Array<{x, y, worldY}>} tilePositions - Positions of tiles
   * @param {{x, y, worldY}} landmarkPosition - Final landmark position
   * @param {Function} onComplete - Called when all animations complete
   * @returns {Array<number>} Animation IDs
   */
  animateLandmarkFormation(tilePositions, landmarkPosition, onComplete = null) {
    const duration = 0.6;
    const ids = [];
    let completed = 0;

    tilePositions.forEach((pos, index) => {
      const animation = new Animation(
        AnimationType.LANDMARK_FORM,
        {
          from: { x: pos.x, y: pos.worldY, z: pos.y },
          to: { x: landmarkPosition.x, y: landmarkPosition.worldY, z: landmarkPosition.y },
          stackIndex: index,
        },
        duration,
        Easing.easeInOut
      );

      animation.onComplete = () => {
        completed++;
        if (completed === tilePositions.length && onComplete) {
          onComplete();
        }
      };

      ids.push(this._addAnimation(animation));
    });

    return ids;
  }

  /**
   * Create an event effect animation
   * @param {number} x - Board X
   * @param {number} y - Board Y (grid)
   * @param {number} worldY - World Y position
   * @param {Array<number>} color - RGB color [r, g, b] (0-1)
   * @param {Function} onComplete
   * @returns {number} Animation ID
   */
  animateEventEffect(x, y, worldY, color = [1.0, 0.8, 0.2], onComplete = null) {
    const duration = 0.5;

    const animation = new Animation(
      AnimationType.EVENT_EFFECT,
      {
        from: { x, y: worldY, z: y },
        to: { x, y: worldY, z: y },
        color,
      },
      duration,
      Easing.easeOut
    );

    animation.onComplete = onComplete;
    return this._addAnimation(animation);
  }

  /**
   * Create a tile capture animation
   * @param {number} x
   * @param {number} y
   * @param {number} worldY
   * @param {Function} onComplete
   * @returns {number} Animation ID
   */
  animateTileCapture(x, y, worldY, onComplete = null) {
    const duration = 0.4;

    const animation = new Animation(
      AnimationType.TILE_CAPTURE,
      {
        from: { x, y: worldY, z: y },
        to: { x, y: worldY, z: y },
      },
      duration,
      Easing.easeInOut
    );

    animation.onComplete = onComplete;
    return this._addAnimation(animation);
  }

  /**
   * Create HQ conversion animation
   * @param {number} x
   * @param {number} y
   * @param {number} worldY
   * @param {Function} onComplete
   * @returns {number} Animation ID
   */
  animateHQConversion(x, y, worldY, onComplete = null) {
    const duration = 0.8;

    const animation = new Animation(
      AnimationType.HQ_CONVERT,
      {
        from: { x, y: worldY, z: y },
        to: { x, y: worldY, z: y },
      },
      duration,
      Easing.easeInOut
    );

    animation.onComplete = onComplete;
    return this._addAnimation(animation);
  }

  /**
   * Create settlement animation (landmark/HQ destruction)
   * @param {number} x
   * @param {number} y
   * @param {number} worldY
   * @param {Function} onComplete
   * @returns {number} Animation ID
   */
  animateSettlement(x, y, worldY, onComplete = null) {
    const duration = 0.6;

    const animation = new Animation(
      AnimationType.SETTLEMENT,
      {
        from: { x, y: worldY, z: y },
        to: { x, y: worldY, z: y },
      },
      duration,
      Easing.easeIn
    );

    animation.onComplete = onComplete;
    return this._addAnimation(animation);
  }

  /**
   * Create agent move animation
   * @param {number} fromX
   * @param {number} fromY
   * @param {number} toX
   * @param {number} toY
   * @param {number} worldY
   * @param {Function} onComplete
   * @returns {number} Animation ID
   */
  animateAgentMove(fromX, fromY, toX, toY, worldY, onComplete = null) {
    const duration = 0.3;

    const animation = new Animation(
      AnimationType.AGENT_MOVE,
      {
        from: { x: fromX, y: worldY, z: fromY },
        to: { x: toX, y: worldY, z: toY },
      },
      duration,
      Easing.easeInOut
    );

    animation.onComplete = onComplete;
    return this._addAnimation(animation);
  }

  /**
   * Create agent spawn animation
   * @param {number} x
   * @param {number} y
   * @param {number} worldY
   * @param {Function} onComplete
   * @returns {number} Animation ID
   */
  animateAgentSpawn(x, y, worldY, onComplete = null) {
    const duration = 0.4;

    const animation = new Animation(
      AnimationType.AGENT_SPAWN,
      {
        from: { x, y: worldY + 1, z: y },
        to: { x, y: worldY, z: y },
      },
      duration,
      Easing.bounce
    );

    animation.onComplete = onComplete;
    return this._addAnimation(animation);
  }

  /**
   * Create Trinity formation animation (multi-phase: glow, dissolve, form)
   * @param {Array<{x, y, worldY, tileType}>} sourceTiles - The 3 source tiles
   * @param {{x, y, worldY}} landmarkPosition - Final Trinity position
   * @param {number} playerIndex - Owner player index
   * @param {Function} onPhaseChange - Callback(phase) when phase changes
   * @param {Function} onComplete - Callback when animation finishes
   * @returns {number} Animation ID
   */
  animateTrinityFormation(sourceTiles, landmarkPosition, playerIndex, onPhaseChange = null, onComplete = null) {
    // Validate inputs
    if (!sourceTiles || sourceTiles.length !== 3) {
      console.error('Trinity formation requires exactly 3 source tiles');
      if (onComplete) onComplete();
      return -1;
    }

    if (!landmarkPosition) {
      console.error('Trinity formation requires landmark position');
      if (onComplete) onComplete();
      return -1;
    }

    const totalDuration = 2.0; // 2.0 seconds total (25% slower)

    const animation = new Animation(
      AnimationType.TRINITY_FORMATION,
      {
        sourceTiles,
        landmarkPosition,
        playerIndex,
        // Phase timings (in seconds) - 25% slower
        phases: {
          glow: { start: 0, end: 0.5 },
          dissolve: { start: 0.5, end: 1.25 },
          formation: { start: 1.25, end: 2.0 }
        },
        currentPhase: 0,
        onPhaseChange
      },
      totalDuration,
      Easing.linear // We handle easing per-phase in _interpolateTrinityFormation
    );

    animation.onComplete = onComplete;
    return this._addAnimation(animation);
  }

  /**
   * Get all active Trinity formation animations
   * @returns {Array<{id: number, value: Object}>}
   */
  getTrinityFormations() {
    return this.getAnimationsOfType(AnimationType.TRINITY_FORMATION);
  }

  /**
   * Add an animation to the manager
   * @private
   */
  _addAnimation(animation) {
    const id = this._nextId++;
    this._animations.set(id, animation);
    return id;
  }

  /**
   * Update all animations
   * @param {number} deltaTime - Time since last frame (seconds)
   */
  update(deltaTime) {
    for (const [id, animation] of this._animations) {
      animation.update(deltaTime);
      if (animation.complete) {
        this._animations.delete(id);
      }
    }
  }

  /**
   * Get animation state by ID
   * @param {number} id
   * @returns {Object|null} Current animation value or null if not found
   */
  getAnimationValue(id) {
    const animation = this._animations.get(id);
    return animation ? animation.getValue() : null;
  }

  /**
   * Check if any animations are active
   * @returns {boolean}
   */
  hasActiveAnimations() {
    return this._animations.size > 0;
  }

  /**
   * Get all active animations of a type
   * @param {string} type
   * @returns {Array<{id: number, value: Object}>}
   */
  getAnimationsOfType(type) {
    const result = [];
    for (const [id, animation] of this._animations) {
      if (animation.type === type) {
        result.push({ id, value: animation.getValue() });
      }
    }
    return result;
  }

  /**
   * Cancel an animation
   * @param {number} id
   */
  cancel(id) {
    this._animations.delete(id);
  }

  /**
   * Cancel all animations
   */
  cancelAll() {
    this._animations.clear();
  }
}
