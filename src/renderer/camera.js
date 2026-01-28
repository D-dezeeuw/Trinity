/**
 * Trinity - Isometric Camera
 */

import { mat4, vec3 } from '../utils/math.js';

export class Camera {
  constructor() {
    // Camera position and target
    this.position = vec3.create(10, 12, 10);
    this.target = vec3.create(0, 0, 0);
    this.up = vec3.create(0, 1, 0);

    // Matrices
    this.viewMatrix = mat4.create();
    this.projectionMatrix = mat4.create();
    this.viewProjectionMatrix = mat4.create();
    this.inverseViewProjectionMatrix = mat4.create();

    // Projection settings
    this.zoom = 5;
    this.aspect = 1;
    this.near = 0.1;
    this.far = 100;

    // Isometric angle (true isometric is ~35.264°)
    this.pitch = Math.atan(1 / Math.sqrt(2)); // ~35.264 degrees
    this.yaw = Math.PI / 4; // 45 degrees
    this.distance = 15;

    this.updatePosition();
    this.updateMatrices();
  }

  /**
   * Update camera position based on angles and distance
   */
  updatePosition() {
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    const cosYaw = Math.cos(this.yaw);
    const sinYaw = Math.sin(this.yaw);

    this.position[0] = this.target[0] + this.distance * cosPitch * sinYaw;
    this.position[1] = this.target[1] + this.distance * sinPitch;
    this.position[2] = this.target[2] + this.distance * cosPitch * cosYaw;
  }

  /**
   * Update all camera matrices
   */
  updateMatrices() {
    // View matrix (lookAt)
    mat4.lookAt(this.viewMatrix, this.position, this.target, this.up);

    // Orthographic projection for isometric view
    const halfWidth = this.zoom * this.aspect;
    const halfHeight = this.zoom;

    mat4.ortho(
      this.projectionMatrix,
      -halfWidth, halfWidth,
      -halfHeight, halfHeight,
      this.near, this.far
    );

    // Combined view-projection matrix
    mat4.multiply(
      this.viewProjectionMatrix,
      this.projectionMatrix,
      this.viewMatrix
    );

    // Inverse for picking
    mat4.invert(
      this.inverseViewProjectionMatrix,
      this.viewProjectionMatrix
    );
  }

  /**
   * Set aspect ratio (call on resize)
   */
  setAspect(width, height) {
    this.aspect = width / height;
    this.updateMatrices();
  }

  /**
   * Zoom in/out
   */
  setZoom(zoom) {
    this.zoom = Math.max(2, Math.min(20, zoom));
    this.updateMatrices();
  }

  /**
   * Pan the camera target
   */
  pan(dx, dz) {
    this.target[0] += dx;
    this.target[2] += dz;
    this.updatePosition();
    this.updateMatrices();
  }

  /**
   * Rotate the camera around target
   */
  rotate(deltaYaw, deltaPitch) {
    this.yaw += deltaYaw;
    this.pitch = Math.max(0.2, Math.min(Math.PI / 2 - 0.1, this.pitch + deltaPitch));
    this.updatePosition();
    this.updateMatrices();
  }

  /**
   * Get camera position as Float32Array
   */
  getPosition() {
    return this.position;
  }

  /**
   * Get view matrix
   */
  getViewMatrix() {
    return this.viewMatrix;
  }

  /**
   * Get projection matrix
   */
  getProjectionMatrix() {
    return this.projectionMatrix;
  }

  /**
   * Get combined view-projection matrix
   */
  getViewProjectionMatrix() {
    return this.viewProjectionMatrix;
  }

  /**
   * Get inverse view-projection matrix (for picking)
   */
  getInverseViewProjectionMatrix() {
    return this.inverseViewProjectionMatrix;
  }
}
