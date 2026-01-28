/**
 * Trinity - WebGL Initialization and Utilities
 */

/**
 * Initialize WebGL 2.0 context
 * @param {HTMLCanvasElement} canvas
 * @returns {WebGL2RenderingContext|null}
 */
export function initWebGL(canvas) {
  const options = {
    alpha: true,
    antialias: true,
    depth: true,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  };

  let gl = canvas.getContext('webgl2', options);

  if (!gl) {
    console.warn('WebGL 2.0 not available, trying WebGL 1.0');
    gl = canvas.getContext('webgl', options) ||
         canvas.getContext('experimental-webgl', options);
  }

  if (!gl) {
    return null;
  }

  return gl;
}

/**
 * Compile a shader from source
 * @param {WebGL2RenderingContext} gl
 * @param {number} type - gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
 * @param {string} source - GLSL source code
 * @returns {WebGLShader|null}
 */
export function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    console.error('Shader compilation error:', info);
    console.error('Shader source:', source);
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

/**
 * Create a shader program from vertex and fragment shaders
 * @param {WebGL2RenderingContext} gl
 * @param {string} vertexSource - Vertex shader GLSL source
 * @param {string} fragmentSource - Fragment shader GLSL source
 * @returns {WebGLProgram|null}
 */
export function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  if (!vertexShader || !fragmentShader) {
    return null;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    console.error('Program linking error:', info);
    gl.deleteProgram(program);
    return null;
  }

  // Clean up individual shaders (they're now part of the program)
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  return program;
}

/**
 * Get all uniform locations for a program
 * @param {WebGL2RenderingContext} gl
 * @param {WebGLProgram} program
 * @param {string[]} names - Array of uniform names
 * @returns {Object} Map of name to WebGLUniformLocation
 */
export function getUniformLocations(gl, program, names) {
  const locations = {};
  for (const name of names) {
    locations[name] = gl.getUniformLocation(program, name);
  }
  return locations;
}

/**
 * Get all attribute locations for a program
 * @param {WebGL2RenderingContext} gl
 * @param {WebGLProgram} program
 * @param {string[]} names - Array of attribute names
 * @returns {Object} Map of name to attribute location
 */
export function getAttributeLocations(gl, program, names) {
  const locations = {};
  for (const name of names) {
    locations[name] = gl.getAttribLocation(program, name);
  }
  return locations;
}

/**
 * Create a vertex buffer
 * @param {WebGL2RenderingContext} gl
 * @param {Float32Array|number[]} data
 * @param {number} usage - gl.STATIC_DRAW, gl.DYNAMIC_DRAW, etc.
 * @returns {WebGLBuffer}
 */
export function createBuffer(gl, data, usage = gl.STATIC_DRAW) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), usage);
  return buffer;
}

/**
 * Create an index buffer
 * @param {WebGL2RenderingContext} gl
 * @param {Uint16Array|number[]} data
 * @param {number} usage
 * @returns {WebGLBuffer}
 */
export function createIndexBuffer(gl, data, usage = gl.STATIC_DRAW) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data), usage);
  return buffer;
}

/**
 * Create a Vertex Array Object (VAO)
 * @param {WebGL2RenderingContext} gl
 * @param {Object} attributes - Attribute configuration
 * @param {WebGLBuffer} indexBuffer - Optional index buffer
 * @returns {WebGLVertexArrayObject}
 */
export function createVAO(gl, attributes, indexBuffer = null) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  for (const [location, config] of Object.entries(attributes)) {
    const loc = parseInt(location);
    gl.bindBuffer(gl.ARRAY_BUFFER, config.buffer);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(
      loc,
      config.size || 3,
      config.type || gl.FLOAT,
      config.normalized || false,
      config.stride || 0,
      config.offset || 0
    );

    if (config.divisor) {
      gl.vertexAttribDivisor(loc, config.divisor);
    }
  }

  if (indexBuffer) {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  }

  gl.bindVertexArray(null);
  return vao;
}

/**
 * Resize canvas to match display size
 * @param {HTMLCanvasElement} canvas
 * @returns {boolean} True if canvas was resized
 */
export function resizeCanvas(canvas) {
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

  const needResize = canvas.width !== displayWidth ||
                     canvas.height !== displayHeight;

  if (needResize) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }

  return needResize;
}

/**
 * Set up WebGL state for rendering
 * @param {WebGL2RenderingContext} gl
 */
export function setupRenderState(gl) {
  // Enable depth testing
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  // Enable backface culling
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);

  // Enable blending for transparency
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // Set clear color (dark background)
  gl.clearColor(0.1, 0.1, 0.12, 1.0);
}

/**
 * Clear the canvas
 * @param {WebGL2RenderingContext} gl
 */
export function clear(gl) {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

/**
 * Load shader source from URL
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function loadShaderSource(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load shader: ${url}`);
  }
  return response.text();
}

/**
 * Create a simple texture
 * @param {WebGL2RenderingContext} gl
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} data - RGBA pixel data
 * @returns {WebGLTexture}
 */
export function createTexture(gl, width, height, data) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    data
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return texture;
}
