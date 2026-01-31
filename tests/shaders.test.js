/**
 * Shader Validation Tests
 * Uses glslangValidator to validate GLSL shaders at test time
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import { join } from 'path';

const SHADERS_DIR = join(process.cwd(), 'src/shaders');

/**
 * Check if glslangValidator is available
 */
function hasGlslangValidator() {
  try {
    execSync('which glslangValidator', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate a shader file using glslangValidator
 * @param {string} shaderPath - Path to shader file
 * @returns {{ valid: boolean, errors: string }}
 */
function validateShader(shaderPath) {
  try {
    execSync(`glslangValidator "${shaderPath}"`, { stdio: 'pipe' });
    return { valid: true, errors: '' };
  } catch (error) {
    return { valid: false, errors: error.stderr?.toString() || error.message };
  }
}

describe('Shader Validation', () => {
  const hasValidator = hasGlslangValidator();

  if (!hasValidator) {
    it.skip('glslangValidator not installed - install with: brew install glslang', () => {});
    return;
  }

  // Get all shader files
  const shaderFiles = readdirSync(SHADERS_DIR).filter(f => f.endsWith('.glsl'));

  describe('GLSL Syntax Validation', () => {
    for (const shaderFile of shaderFiles) {
      const shaderPath = join(SHADERS_DIR, shaderFile);

      it(`${shaderFile} should be valid GLSL`, () => {
        const result = validateShader(shaderPath);

        if (!result.valid) {
          // Format error message for better readability
          const errorLines = result.errors
            .split('\n')
            .filter(line => line.includes('ERROR'))
            .join('\n');

          expect.fail(`Shader validation failed:\n${errorLines}`);
        }

        expect(result.valid).toBe(true);
      });
    }
  });

  describe('Shader File Structure', () => {
    it('should have matching vertex and fragment shaders for board', () => {
      expect(shaderFiles).toContain('board.vert.glsl');
      expect(shaderFiles).toContain('board.frag.glsl');
    });

    it('should have matching vertex and fragment shaders for tile', () => {
      expect(shaderFiles).toContain('tile.vert.glsl');
      expect(shaderFiles).toContain('tile.frag.glsl');
    });
  });
});
