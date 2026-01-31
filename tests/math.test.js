/**
 * Trinity - Math Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import {
  vec2,
  vec3,
  vec4,
  mat4,
  clamp,
  lerp,
  smoothstep,
  degToRad,
  radToDeg,
  worldToGrid,
  gridToWorld,
} from '../src/utils/math.js';

// Helper for floating point comparison
const EPSILON = 0.0001;
function expectClose(actual, expected, epsilon = EPSILON) {
  expect(Math.abs(actual - expected)).toBeLessThan(epsilon);
}

function expectVec3Close(actual, expected, epsilon = EPSILON) {
  expectClose(actual[0], expected[0], epsilon);
  expectClose(actual[1], expected[1], epsilon);
  expectClose(actual[2], expected[2], epsilon);
}

// =============================================================================
// vec2 Tests
// =============================================================================

describe('vec2', () => {
  it('creates a zero vector by default', () => {
    const v = vec2.create();
    expect(v[0]).toBe(0);
    expect(v[1]).toBe(0);
  });

  it('creates a vector with specified values', () => {
    const v = vec2.create(3, 4);
    expect(v[0]).toBe(3);
    expect(v[1]).toBe(4);
  });

  it('clones a vector', () => {
    const v = vec2.create(1, 2);
    const c = vec2.clone(v);
    expect(c[0]).toBe(1);
    expect(c[1]).toBe(2);
    // Verify it's a new instance
    c[0] = 99;
    expect(v[0]).toBe(1);
  });

  it('adds two vectors', () => {
    const a = vec2.create(1, 2);
    const b = vec2.create(3, 4);
    const out = vec2.create();
    vec2.add(out, a, b);
    expect(out[0]).toBe(4);
    expect(out[1]).toBe(6);
  });

  it('subtracts two vectors', () => {
    const a = vec2.create(5, 7);
    const b = vec2.create(2, 3);
    const out = vec2.create();
    vec2.subtract(out, a, b);
    expect(out[0]).toBe(3);
    expect(out[1]).toBe(4);
  });

  it('scales a vector', () => {
    const v = vec2.create(2, 3);
    const out = vec2.create();
    vec2.scale(out, v, 2);
    expect(out[0]).toBe(4);
    expect(out[1]).toBe(6);
  });

  it('calculates length', () => {
    const v = vec2.create(3, 4);
    expect(vec2.length(v)).toBe(5);
  });

  it('normalizes a vector', () => {
    const v = vec2.create(3, 4);
    const out = vec2.create();
    vec2.normalize(out, v);
    expectClose(out[0], 0.6);
    expectClose(out[1], 0.8);
    expectClose(vec2.length(out), 1);
  });

  it('calculates dot product', () => {
    const a = vec2.create(1, 2);
    const b = vec2.create(3, 4);
    expect(vec2.dot(a, b)).toBe(11); // 1*3 + 2*4
  });
});

// =============================================================================
// vec3 Tests
// =============================================================================

describe('vec3', () => {
  it('creates a zero vector by default', () => {
    const v = vec3.create();
    expect(v[0]).toBe(0);
    expect(v[1]).toBe(0);
    expect(v[2]).toBe(0);
  });

  it('creates a vector with specified values', () => {
    const v = vec3.create(1, 2, 3);
    expect(v[0]).toBe(1);
    expect(v[1]).toBe(2);
    expect(v[2]).toBe(3);
  });

  it('adds two vectors', () => {
    const a = vec3.create(1, 2, 3);
    const b = vec3.create(4, 5, 6);
    const out = vec3.create();
    vec3.add(out, a, b);
    expect(out[0]).toBe(5);
    expect(out[1]).toBe(7);
    expect(out[2]).toBe(9);
  });

  it('calculates length', () => {
    const v = vec3.create(2, 3, 6);
    expect(vec3.length(v)).toBe(7); // sqrt(4+9+36) = 7
  });

  it('calculates cross product', () => {
    const x = vec3.create(1, 0, 0);
    const y = vec3.create(0, 1, 0);
    const out = vec3.create();
    vec3.cross(out, x, y);
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(0);
    expect(out[2]).toBe(1); // X cross Y = Z
  });

  it('normalizes a vector', () => {
    const v = vec3.create(0, 3, 4);
    const out = vec3.create();
    vec3.normalize(out, v);
    expectClose(out[0], 0);
    expectClose(out[1], 0.6);
    expectClose(out[2], 0.8);
  });
});

// =============================================================================
// mat4 Tests
// =============================================================================

describe('mat4', () => {
  it('creates an identity matrix by default', () => {
    const m = mat4.create();
    // Diagonal should be 1
    expect(m[0]).toBe(1);
    expect(m[5]).toBe(1);
    expect(m[10]).toBe(1);
    expect(m[15]).toBe(1);
    // Off-diagonal should be 0
    expect(m[1]).toBe(0);
    expect(m[4]).toBe(0);
  });

  it('identity sets a matrix to identity', () => {
    const m = mat4.create();
    m[0] = 99; // Corrupt it
    mat4.identity(m);
    expect(m[0]).toBe(1);
    expect(m[5]).toBe(1);
    expect(m[10]).toBe(1);
    expect(m[15]).toBe(1);
  });

  it('multiplies identity matrices correctly', () => {
    const a = mat4.create();
    const b = mat4.create();
    const out = mat4.create();
    mat4.multiply(out, a, b);
    // Result should still be identity
    expect(out[0]).toBe(1);
    expect(out[5]).toBe(1);
    expect(out[10]).toBe(1);
    expect(out[15]).toBe(1);
  });

  it('translates correctly', () => {
    const m = mat4.create();
    mat4.translate(m, m, vec3.create(1, 2, 3));
    // Translation should be in elements 12, 13, 14
    expect(m[12]).toBe(1);
    expect(m[13]).toBe(2);
    expect(m[14]).toBe(3);
  });

  it('scales correctly', () => {
    const m = mat4.create();
    mat4.scale(m, m, vec3.create(2, 3, 4));
    expect(m[0]).toBe(2);
    expect(m[5]).toBe(3);
    expect(m[10]).toBe(4);
  });

  it('inverts an identity matrix', () => {
    const m = mat4.create();
    const out = mat4.create();
    mat4.invert(out, m);
    // Inverse of identity is identity
    expect(out[0]).toBe(1);
    expect(out[5]).toBe(1);
    expect(out[10]).toBe(1);
    expect(out[15]).toBe(1);
  });

  it('inverts a translation matrix', () => {
    const m = mat4.create();
    mat4.translate(m, m, vec3.create(5, 10, 15));

    const inv = mat4.create();
    mat4.invert(inv, m);

    // Multiply m * inv should give identity
    const result = mat4.create();
    mat4.multiply(result, m, inv);

    expectClose(result[0], 1);
    expectClose(result[5], 1);
    expectClose(result[10], 1);
    expectClose(result[15], 1);
    expectClose(result[12], 0);
    expectClose(result[13], 0);
    expectClose(result[14], 0);
  });

  it('creates orthographic projection', () => {
    const m = mat4.create();
    mat4.ortho(m, -1, 1, -1, 1, 0.1, 100);
    // Basic sanity checks
    expect(m[15]).toBe(1);
    expect(m[0]).not.toBe(0);
    expect(m[5]).not.toBe(0);
    expect(m[10]).not.toBe(0);
  });

  it('creates perspective projection', () => {
    const m = mat4.create();
    mat4.perspective(m, Math.PI / 4, 1.5, 0.1, 100);
    // Perspective matrix has specific structure
    expect(m[11]).toBe(-1);
    expect(m[15]).toBe(0);
  });
});

// =============================================================================
// Utility Function Tests
// =============================================================================

describe('clamp', () => {
  it('clamps below minimum', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps above maximum', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns value when in range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
});

describe('lerp', () => {
  it('returns a when t=0', () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it('returns b when t=1', () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('returns midpoint when t=0.5', () => {
    expect(lerp(10, 20, 0.5)).toBe(15);
  });
});

describe('smoothstep', () => {
  it('returns 0 when x <= edge0', () => {
    expect(smoothstep(0, 1, -0.5)).toBe(0);
    expect(smoothstep(0, 1, 0)).toBe(0);
  });

  it('returns 1 when x >= edge1', () => {
    expect(smoothstep(0, 1, 1)).toBe(1);
    expect(smoothstep(0, 1, 1.5)).toBe(1);
  });

  it('returns 0.5 at midpoint', () => {
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
  });
});

describe('angle conversions', () => {
  it('converts degrees to radians', () => {
    expectClose(degToRad(180), Math.PI);
    expectClose(degToRad(90), Math.PI / 2);
    expectClose(degToRad(360), Math.PI * 2);
  });

  it('converts radians to degrees', () => {
    expectClose(radToDeg(Math.PI), 180);
    expectClose(radToDeg(Math.PI / 2), 90);
  });

  it('round-trips correctly', () => {
    const original = 45;
    const result = radToDeg(degToRad(original));
    expectClose(result, original);
  });
});

// =============================================================================
// Grid Conversion Tests
// =============================================================================

describe('worldToGrid', () => {
  const boardSize = 8;
  const tileSize = 1;

  it('converts center of board to middle grid', () => {
    const result = worldToGrid(0, 0, tileSize, boardSize);
    // Center should be around (3,3) or (4,4) depending on offset calculation
    expect(result.valid).toBe(true);
    expect(result.x).toBeGreaterThanOrEqual(0);
    expect(result.x).toBeLessThan(boardSize);
  });

  it('returns invalid for positions outside board', () => {
    const result = worldToGrid(100, 100, tileSize, boardSize);
    expect(result.valid).toBe(false);
  });

  it('clamps to valid range', () => {
    const result = worldToGrid(100, 100, tileSize, boardSize);
    expect(result.x).toBe(boardSize - 1);
    expect(result.y).toBe(boardSize - 1);
  });
});

describe('gridToWorld', () => {
  const boardSize = 8;
  const tileSize = 1;

  it('converts grid (0,0) to world position', () => {
    const pos = gridToWorld(0, 0, tileSize, boardSize);
    expect(pos[1]).toBe(0); // Y should always be 0 (ground plane)
  });

  it('converts grid center to near-zero world position', () => {
    const center = Math.floor(boardSize / 2);
    const pos = gridToWorld(center, center, tileSize, boardSize);
    // Should be close to origin
    expectClose(pos[0], 0.5); // Offset due to centering
    expectClose(pos[2], 0.5);
  });
});
