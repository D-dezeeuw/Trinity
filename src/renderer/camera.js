/**
 * Trinity - Isometric Camera
 */

import { mat4, vec3 } from '../utils/math.js';
import { CAMERA } from '../config.js';

export class Camera {
  constructor() {
    // Camera position and target
    this._position = vec3.create(...CAMERA.INITIAL_POSITION);
    this._target = vec3.create(...CAMERA.INITIAL_TARGET);
    this._up = vec3.create(...CAMERA.UP);

    // Matrices
    this._viewMatrix = mat4.create();
    this._projectionMatrix = mat4.create();
    this._viewProjectionMatrix = mat4.create();
    this._inverseViewProjectionMatrix = mat4.create();

    // Projection settings
    this._zoom = CAMERA.INITIAL_ZOOM;
    this._aspect = 1;
    this._near = CAMERA.NEAR;
    this._far = CAMERA.FAR;

    // Isometric angle (true isometric is ~35.264°)
    this._pitch = Math.atan(1 / Math.sqrt(2)); // ~35.264 degrees
    this._yaw = Math.PI / 4; // 45 degrees
    this._distance = CAMERA.DISTANCE;

    // Cursor-based rotation offset
    this._cursorYawOffset = 0;
    this._targetYawOffset = 0;

    // Player-based rotation offset (rotates board to face active player)
    this._playerYawOffset = 0;
    this._targetPlayerYawOffset = 0;

    // Cursor-based pitch offset
    this._cursorPitchOffset = 0;
    this._targetPitchOffset = 0;

    this._updatePosition();
    this._updateMatrices();
  }

  /**
   * Get current zoom level
   */
  get zoom() {
    return this._zoom;
  }

  /**
   * Update camera position based on angles and distance
   * @private
   */
  _updatePosition() {
    // Apply cursor offset and player offset to yaw for dynamic rotation
    const effectiveYaw = this._yaw + this._cursorYawOffset + this._playerYawOffset;
    // Apply cursor offset to pitch for vertical tilt
    const effectivePitch = this._pitch + this._cursorPitchOffset;

    const cosPitch = Math.cos(effectivePitch);
    const sinPitch = Math.sin(effectivePitch);
    const cosYaw = Math.cos(effectiveYaw);
    const sinYaw = Math.sin(effectiveYaw);

    this._position[0] = this._target[0] + this._distance * cosPitch * sinYaw;
    this._position[1] = this._target[1] + this._distance * sinPitch;
    this._position[2] = this._target[2] + this._distance * cosPitch * cosYaw;
  }

  /**
   * Update all camera matrices
   * @private
   */
  _updateMatrices() {
    // View matrix (lookAt)
    mat4.lookAt(this._viewMatrix, this._position, this._target, this._up);

    // Orthographic projection for isometric view
    const halfWidth = this._zoom * this._aspect;
    const halfHeight = this._zoom;

    mat4.ortho(
      this._projectionMatrix,
      -halfWidth, halfWidth,
      -halfHeight, halfHeight,
      this._near, this._far
    );

    // Combined view-projection matrix
    mat4.multiply(
      this._viewProjectionMatrix,
      this._projectionMatrix,
      this._viewMatrix
    );

    // Inverse for picking
    mat4.invert(
      this._inverseViewProjectionMatrix,
      this._viewProjectionMatrix
    );
  }

  /**
   * Set aspect ratio (call on resize)
   */
  setAspect(width, height) {
    this._aspect = width / height;
    this._updateMatrices();
  }

  /**
   * Zoom in/out
   */
  setZoom(zoom) {
    this._zoom = Math.max(CAMERA.MIN_ZOOM, Math.min(CAMERA.MAX_ZOOM, zoom));
    this._updateMatrices();
  }

  /**
   * Pan the camera target
   */
  pan(dx, dz) {
    this._target[0] += dx;
    this._target[2] += dz;
    this._updatePosition();
    this._updateMatrices();
  }

  /**
   * Rotate the camera around target
   */
  rotate(deltaYaw, deltaPitch) {
    this._yaw += deltaYaw;
    this._pitch = Math.max(CAMERA.MIN_PITCH, Math.min(CAMERA.MAX_PITCH, this._pitch + deltaPitch));
    this._updatePosition();
    this._updateMatrices();
  }

  /**
   * Set cursor offset for dynamic rotation
   * @param {number} normalizedX - Cursor X position normalized to -1 (left) to 1 (right)
   */
  setCursorOffset(normalizedX) {
    // Invert: cursor left = board rotates right (positive yaw offset)
    this._targetYawOffset = -normalizedX * CAMERA.CURSOR_YAW_RANGE;
  }

  /**
   * Update cursor-based rotation with smooth interpolation
   * Should be called each frame
   */
  updateCursorRotation() {
    // Smooth interpolation toward target
    const diff = this._targetYawOffset - this._cursorYawOffset;

    // Only update if there's meaningful change
    if (Math.abs(diff) > 0.0001) {
      this._cursorYawOffset += diff * CAMERA.CURSOR_ROTATION_SMOOTHING;
      this._updatePosition();
      this._updateMatrices();
    }
  }

  /**
   * Set cursor Y offset for dynamic pitch tilt
   * @param {number} normalizedY - Cursor Y position normalized to -1 (bottom) to 1 (top)
   */
  setCursorPitchOffset(normalizedY) {
    // Cursor at top (normalizedY = 1) → positive pitch offset (tilt back toward camera)
    // Cursor at bottom (normalizedY = -1) → negative pitch offset (tilt away from camera)
    this._targetPitchOffset = normalizedY * CAMERA.CURSOR_PITCH_RANGE;
  }

  /**
   * Update cursor-based pitch with smooth interpolation
   * Should be called each frame
   */
  updateCursorPitchRotation() {
    const diff = this._targetPitchOffset - this._cursorPitchOffset;

    // Only update if there's meaningful change
    if (Math.abs(diff) > 0.0001) {
      this._cursorPitchOffset += diff * CAMERA.CURSOR_ROTATION_SMOOTHING;
      this._updatePosition();
      this._updateMatrices();
    }
  }

  /**
   * Set the active player for board rotation
   * Rotates the board so the active player's side is at the near edge (closest to camera)
   * @param {number} playerIndex - 0 for Player 1, 1 for Player 2
   */
  setActivePlayer(playerIndex) {
    if (!CAMERA.ROTATE_TO_ACTIVE_PLAYER) return;

    // Player 1 (index 0): rotate 180° so their edge (originally near) stays near after flip
    // Player 2 (index 1): no rotation, their edge (originally far) is now near
    this._targetPlayerYawOffset = playerIndex === 0 ? Math.PI : 0;
  }

  /**
   * Update player-based rotation with smooth interpolation
   * Should be called each frame
   */
  updatePlayerRotation() {
    if (!CAMERA.ROTATE_TO_ACTIVE_PLAYER) return;

    // Calculate shortest rotation path (handle wraparound)
    let diff = this._targetPlayerYawOffset - this._playerYawOffset;

    // Normalize diff to [-PI, PI] for shortest path
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    // Only update if there's meaningful change
    if (Math.abs(diff) > 0.0001) {
      this._playerYawOffset += diff * CAMERA.PLAYER_ROTATION_SPEED;

      // Keep playerYawOffset in [0, 2*PI] range
      while (this._playerYawOffset < 0) this._playerYawOffset += Math.PI * 2;
      while (this._playerYawOffset >= Math.PI * 2) this._playerYawOffset -= Math.PI * 2;

      this._updatePosition();
      this._updateMatrices();
    }
  }

  /**
   * Check if player rotation is enabled
   * @returns {boolean}
   */
  isPlayerRotationEnabled() {
    return CAMERA.ROTATE_TO_ACTIVE_PLAYER;
  }

  /**
   * Get camera position as Float32Array
   */
  getPosition() {
    return this._position;
  }

  /**
   * Get view matrix
   */
  getViewMatrix() {
    return this._viewMatrix;
  }

  /**
   * Get projection matrix
   */
  getProjectionMatrix() {
    return this._projectionMatrix;
  }

  /**
   * Get combined view-projection matrix
   */
  getViewProjectionMatrix() {
    return this._viewProjectionMatrix;
  }

  /**
   * Get inverse view-projection matrix (for picking)
   */
  getInverseViewProjectionMatrix() {
    return this._inverseViewProjectionMatrix;
  }
}
