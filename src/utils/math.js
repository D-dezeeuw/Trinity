/**
 * Trinity - Math Utilities
 * Vector and Matrix operations for WebGL
 */

// ============================================
// Vector 2D
// ============================================

export const vec2 = {
  create(x = 0, y = 0) {
    return new Float32Array([x, y]);
  },

  clone(v) {
    return new Float32Array([v[0], v[1]]);
  },

  set(out, x, y) {
    out[0] = x;
    out[1] = y;
    return out;
  },

  add(out, a, b) {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    return out;
  },

  subtract(out, a, b) {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    return out;
  },

  scale(out, v, s) {
    out[0] = v[0] * s;
    out[1] = v[1] * s;
    return out;
  },

  length(v) {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
  },

  normalize(out, v) {
    const len = vec2.length(v);
    if (len > 0) {
      out[0] = v[0] / len;
      out[1] = v[1] / len;
    }
    return out;
  },

  dot(a, b) {
    return a[0] * b[0] + a[1] * b[1];
  },
};

// ============================================
// Vector 3D
// ============================================

export const vec3 = {
  create(x = 0, y = 0, z = 0) {
    return new Float32Array([x, y, z]);
  },

  clone(v) {
    return new Float32Array([v[0], v[1], v[2]]);
  },

  set(out, x, y, z) {
    out[0] = x;
    out[1] = y;
    out[2] = z;
    return out;
  },

  add(out, a, b) {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    out[2] = a[2] + b[2];
    return out;
  },

  subtract(out, a, b) {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    out[2] = a[2] - b[2];
    return out;
  },

  scale(out, v, s) {
    out[0] = v[0] * s;
    out[1] = v[1] * s;
    out[2] = v[2] * s;
    return out;
  },

  length(v) {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  },

  normalize(out, v) {
    const len = vec3.length(v);
    if (len > 0) {
      out[0] = v[0] / len;
      out[1] = v[1] / len;
      out[2] = v[2] / len;
    }
    return out;
  },

  dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  },

  cross(out, a, b) {
    const ax = a[0], ay = a[1], az = a[2];
    const bx = b[0], by = b[1], bz = b[2];
    out[0] = ay * bz - az * by;
    out[1] = az * bx - ax * bz;
    out[2] = ax * by - ay * bx;
    return out;
  },

  transformMat4(out, v, m) {
    const x = v[0], y = v[1], z = v[2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1.0;
    out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    return out;
  },
};

// ============================================
// Vector 4D
// ============================================

export const vec4 = {
  create(x = 0, y = 0, z = 0, w = 1) {
    return new Float32Array([x, y, z, w]);
  },

  clone(v) {
    return new Float32Array([v[0], v[1], v[2], v[3]]);
  },

  set(out, x, y, z, w) {
    out[0] = x;
    out[1] = y;
    out[2] = z;
    out[3] = w;
    return out;
  },

  transformMat4(out, v, m) {
    const x = v[0], y = v[1], z = v[2], w = v[3];
    out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
    out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
    out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
    out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
    return out;
  },
};

// ============================================
// Matrix 4x4
// ============================================

export const mat4 = {
  create() {
    const out = new Float32Array(16);
    out[0] = 1;
    out[5] = 1;
    out[10] = 1;
    out[15] = 1;
    return out;
  },

  clone(m) {
    return new Float32Array(m);
  },

  identity(out) {
    out[0] = 1;  out[1] = 0;  out[2] = 0;  out[3] = 0;
    out[4] = 0;  out[5] = 1;  out[6] = 0;  out[7] = 0;
    out[8] = 0;  out[9] = 0;  out[10] = 1; out[11] = 0;
    out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
    return out;
  },

  multiply(out, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    return out;
  },

  translate(out, m, v) {
    const x = v[0], y = v[1], z = v[2];
    if (m === out) {
      out[12] = m[0] * x + m[4] * y + m[8] * z + m[12];
      out[13] = m[1] * x + m[5] * y + m[9] * z + m[13];
      out[14] = m[2] * x + m[6] * y + m[10] * z + m[14];
      out[15] = m[3] * x + m[7] * y + m[11] * z + m[15];
    } else {
      const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
      const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
      const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
      out[0] = a00; out[1] = a01; out[2] = a02; out[3] = a03;
      out[4] = a10; out[5] = a11; out[6] = a12; out[7] = a13;
      out[8] = a20; out[9] = a21; out[10] = a22; out[11] = a23;
      out[12] = a00 * x + a10 * y + a20 * z + m[12];
      out[13] = a01 * x + a11 * y + a21 * z + m[13];
      out[14] = a02 * x + a12 * y + a22 * z + m[14];
      out[15] = a03 * x + a13 * y + a23 * z + m[15];
    }
    return out;
  },

  scale(out, m, v) {
    const x = v[0], y = v[1], z = v[2];
    out[0] = m[0] * x;  out[1] = m[1] * x;  out[2] = m[2] * x;  out[3] = m[3] * x;
    out[4] = m[4] * y;  out[5] = m[5] * y;  out[6] = m[6] * y;  out[7] = m[7] * y;
    out[8] = m[8] * z;  out[9] = m[9] * z;  out[10] = m[10] * z; out[11] = m[11] * z;
    out[12] = m[12];    out[13] = m[13];    out[14] = m[14];     out[15] = m[15];
    return out;
  },

  rotateX(out, m, rad) {
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
    if (m !== out) {
      out[0] = m[0]; out[1] = m[1]; out[2] = m[2]; out[3] = m[3];
      out[12] = m[12]; out[13] = m[13]; out[14] = m[14]; out[15] = m[15];
    }
    out[4] = a10 * c + a20 * s;
    out[5] = a11 * c + a21 * s;
    out[6] = a12 * c + a22 * s;
    out[7] = a13 * c + a23 * s;
    out[8] = a20 * c - a10 * s;
    out[9] = a21 * c - a11 * s;
    out[10] = a22 * c - a12 * s;
    out[11] = a23 * c - a13 * s;
    return out;
  },

  rotateY(out, m, rad) {
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
    if (m !== out) {
      out[4] = m[4]; out[5] = m[5]; out[6] = m[6]; out[7] = m[7];
      out[12] = m[12]; out[13] = m[13]; out[14] = m[14]; out[15] = m[15];
    }
    out[0] = a00 * c - a20 * s;
    out[1] = a01 * c - a21 * s;
    out[2] = a02 * c - a22 * s;
    out[3] = a03 * c - a23 * s;
    out[8] = a00 * s + a20 * c;
    out[9] = a01 * s + a21 * c;
    out[10] = a02 * s + a22 * c;
    out[11] = a03 * s + a23 * c;
    return out;
  },

  rotateZ(out, m, rad) {
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
    const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    if (m !== out) {
      out[8] = m[8]; out[9] = m[9]; out[10] = m[10]; out[11] = m[11];
      out[12] = m[12]; out[13] = m[13]; out[14] = m[14]; out[15] = m[15];
    }
    out[0] = a00 * c + a10 * s;
    out[1] = a01 * c + a11 * s;
    out[2] = a02 * c + a12 * s;
    out[3] = a03 * c + a13 * s;
    out[4] = a10 * c - a00 * s;
    out[5] = a11 * c - a01 * s;
    out[6] = a12 * c - a02 * s;
    out[7] = a13 * c - a03 * s;
    return out;
  },

  /**
   * Orthographic projection matrix
   */
  ortho(out, left, right, bottom, top, near, far) {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);
    out[0] = -2 * lr;     out[1] = 0;           out[2] = 0;           out[3] = 0;
    out[4] = 0;           out[5] = -2 * bt;     out[6] = 0;           out[7] = 0;
    out[8] = 0;           out[9] = 0;           out[10] = 2 * nf;     out[11] = 0;
    out[12] = (left + right) * lr;
    out[13] = (top + bottom) * bt;
    out[14] = (far + near) * nf;
    out[15] = 1;
    return out;
  },

  /**
   * Perspective projection matrix
   */
  perspective(out, fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[11] = -1;
    out[12] = 0; out[13] = 0; out[15] = 0;
    if (far !== null && far !== Infinity) {
      const nf = 1 / (near - far);
      out[10] = (far + near) * nf;
      out[14] = 2 * far * near * nf;
    } else {
      out[10] = -1;
      out[14] = -2 * near;
    }
    return out;
  },

  /**
   * LookAt matrix for camera
   */
  lookAt(out, eye, center, up) {
    let x0, x1, x2, y0, y1, y2, z0, z1, z2, len;

    const eyex = eye[0], eyey = eye[1], eyez = eye[2];
    const upx = up[0], upy = up[1], upz = up[2];
    const centerx = center[0], centery = center[1], centerz = center[2];

    if (Math.abs(eyex - centerx) < 0.000001 &&
        Math.abs(eyey - centery) < 0.000001 &&
        Math.abs(eyez - centerz) < 0.000001) {
      return mat4.identity(out);
    }

    z0 = eyex - centerx;
    z1 = eyey - centery;
    z2 = eyez - centerz;
    len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
    z0 *= len; z1 *= len; z2 *= len;

    x0 = upy * z2 - upz * z1;
    x1 = upz * z0 - upx * z2;
    x2 = upx * z1 - upy * z0;
    len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
    if (!len) {
      x0 = 0; x1 = 0; x2 = 0;
    } else {
      len = 1 / len;
      x0 *= len; x1 *= len; x2 *= len;
    }

    y0 = z1 * x2 - z2 * x1;
    y1 = z2 * x0 - z0 * x2;
    y2 = z0 * x1 - z1 * x0;
    len = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2);
    if (!len) {
      y0 = 0; y1 = 0; y2 = 0;
    } else {
      len = 1 / len;
      y0 *= len; y1 *= len; y2 *= len;
    }

    out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
    out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
    out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
    out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
    out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
    out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
    out[15] = 1;

    return out;
  },

  /**
   * Invert a matrix
   */
  invert(out, a) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;

    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1.0 / det;

    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

    return out;
  },
};

// ============================================
// Isometric Utilities
// ============================================

/**
 * Create an isometric projection matrix
 * Standard isometric: 45° rotation on Y, ~35.264° on X
 */
export function createIsometricMatrix(scale = 1) {
  const m = mat4.create();

  // Apply isometric rotation
  // First rotate around Y by 45 degrees
  mat4.rotateY(m, m, Math.PI / 4);
  // Then rotate around X by ~35.264 degrees (arctan(1/sqrt(2)))
  mat4.rotateX(m, m, Math.atan(1 / Math.sqrt(2)));

  // Apply scale
  mat4.scale(m, m, vec3.create(scale, scale, scale));

  return m;
}

/**
 * Convert screen coordinates to world coordinates (on the ground plane)
 * @param {number} screenX - Screen X coordinate
 * @param {number} screenY - Screen Y coordinate
 * @param {Float32Array} invViewProj - Inverse of view-projection matrix
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {Float32Array} World position [x, y, z]
 */
export function screenToWorld(screenX, screenY, invViewProj, width, height) {
  // Convert to normalized device coordinates (-1 to 1)
  const ndcX = (screenX / width) * 2 - 1;
  const ndcY = 1 - (screenY / height) * 2;

  // Create ray in clip space
  const nearPoint = vec4.create(ndcX, ndcY, -1, 1);
  const farPoint = vec4.create(ndcX, ndcY, 1, 1);

  // Transform to world space
  vec4.transformMat4(nearPoint, nearPoint, invViewProj);
  vec4.transformMat4(farPoint, farPoint, invViewProj);

  // Perspective divide
  const near = vec3.create(
    nearPoint[0] / nearPoint[3],
    nearPoint[1] / nearPoint[3],
    nearPoint[2] / nearPoint[3]
  );
  const far = vec3.create(
    farPoint[0] / farPoint[3],
    farPoint[1] / farPoint[3],
    farPoint[2] / farPoint[3]
  );

  // Ray direction
  const dir = vec3.create();
  vec3.subtract(dir, far, near);
  vec3.normalize(dir, dir);

  // Intersect with ground plane (y = 0)
  if (Math.abs(dir[1]) < 0.0001) {
    return null; // Ray parallel to ground
  }

  const t = -near[1] / dir[1];
  return vec3.create(
    near[0] + dir[0] * t,
    0,
    near[2] + dir[2] * t
  );
}

/**
 * Convert world coordinates to screen coordinates
 */
export function worldToScreen(worldPos, viewProj, width, height) {
  const clipPos = vec4.create(worldPos[0], worldPos[1], worldPos[2], 1);
  vec4.transformMat4(clipPos, clipPos, viewProj);

  // Perspective divide
  const ndcX = clipPos[0] / clipPos[3];
  const ndcY = clipPos[1] / clipPos[3];

  // Convert to screen coordinates
  return vec2.create(
    (ndcX + 1) * 0.5 * width,
    (1 - ndcY) * 0.5 * height
  );
}

/**
 * Convert board grid position to world position
 */
export function gridToWorld(gridX, gridY, tileSize = 1, boardSize = 8) {
  const offset = (boardSize - 1) * tileSize / 2;
  return vec3.create(
    gridX * tileSize - offset,
    0,
    gridY * tileSize - offset
  );
}

/**
 * Convert world position to board grid position
 */
export function worldToGrid(worldX, worldZ, tileSize = 1, boardSize = 8) {
  const offset = (boardSize - 1) * tileSize / 2;
  const gridX = Math.round((worldX + offset) / tileSize);
  const gridY = Math.round((worldZ + offset) / tileSize);

  // Clamp to valid board range
  return {
    x: Math.max(0, Math.min(boardSize - 1, gridX)),
    y: Math.max(0, Math.min(boardSize - 1, gridY)),
    valid: gridX >= 0 && gridX < boardSize && gridY >= 0 && gridY < boardSize
  };
}

// ============================================
// General Utilities
// ============================================

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function degToRad(degrees) {
  return degrees * Math.PI / 180;
}

export function radToDeg(radians) {
  return radians * 180 / Math.PI;
}
