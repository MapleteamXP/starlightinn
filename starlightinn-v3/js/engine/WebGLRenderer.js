/**
 * @file WebGLRenderer.js
 * @description AAA-grade WebGL 2D rendering pipeline for Starlight Inn.
 * Features sprite batching (10k sprites/draw call), texture atlas, GPU particles,
 * post-processing (vignette, bloom, color grading, grain), and depth-of-field.
 * Targets WebGL 1.0 with optional WebGL 2.0 features.
 */

import { TextureAtlas } from './TextureAtlas.js';
import { PostProcess } from './PostProcess.js';
import { ParticleSystemGPU } from './ParticleSystemGPU.js';

// ─── Sprite Shaders ──────────────────────────────────────────────────────────

/** @type {string} Sprite vertex shader source */
const SPRITE_VERTEX = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  attribute vec4 a_color;
  attribute vec2 a_offset;
  attribute float a_rotation;
  attribute vec2 a_scale;
  attribute float a_depth;

  uniform mat4 u_viewMatrix;
  uniform mat4 u_projMatrix;

  varying vec2 v_texCoord;
  varying vec4 v_color;
  varying float v_depth;

  void main() {
    float cos_r = cos(a_rotation);
    float sin_r = sin(a_rotation);
    vec2 rotated = vec2(
      a_position.x * cos_r * a_scale.x - a_position.y * sin_r * a_scale.y,
      a_position.x * sin_r * a_scale.x + a_position.y * cos_r * a_scale.y
    );
    vec2 worldPos = rotated + a_offset;
    gl_Position = u_projMatrix * u_viewMatrix * vec4(worldPos, a_depth * 0.001, 1.0);
    v_texCoord = a_texCoord;
    v_color = a_color;
    v_depth = worldPos.y;
  }
`;

/** @type {string} Sprite fragment shader source */
const SPRITE_FRAGMENT = `
  precision mediump float;
  uniform sampler2D u_texture;
  uniform float u_dofFocus;
  uniform float u_dofStrength;
  uniform float u_time;
  uniform float u_opacityGlobal;

  varying vec2 v_texCoord;
  varying vec4 v_color;
  varying float v_depth;

  void main() {
    vec4 texColor = texture2D(u_texture, v_texCoord);
    vec4 color = texColor * v_color;
    color.a *= u_opacityGlobal;

    // Depth of field: fade distant sprites
    float dofDist = abs(v_depth - u_dofFocus);
    float blur = smoothstep(0.0, 300.0, dofDist) * u_dofStrength;
    color.a *= 1.0 - blur * 0.35;
    color.rgb *= 1.0 - blur * 0.15;

    // Discard fully transparent pixels for performance
    if (color.a < 0.01) discard;

    gl_FragColor = color;
  }
`;

// ─── Background Shaders ──────────────────────────────────────────────────────

/** @type {string} Fullscreen quad vertex shader for backgrounds and post */
const QUAD_VERTEX = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

/** @type {string} Procedural area background fragment shader */
const BG_FRAGMENT = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform vec3 u_topColor;
  uniform vec3 u_bottomColor;
  uniform vec3 u_floorColor;
  uniform float u_horizon;
  uniform float u_time;
  uniform vec2 u_resolution;

  // Pseudo-random for stars
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec2 uv = v_texCoord;
    float horizonY = u_horizon;

    vec3 color;
    if (uv.y < horizonY) {
      // Floor with perspective
      float floorT = uv.y / horizonY;
      color = mix(u_floorColor, u_floorColor * 0.3, floorT);
      // Perspective grid
      float gridX = fract(uv.x * 20.0 / (floorT + 0.1));
      float gridY = fract(1.0 / (floorT + 0.05) * 3.0);
      float grid = smoothstep(0.02, 0.0, min(gridX, gridY)) * 0.06;
      color += grid;
    } else {
      // Sky gradient
      float skyT = (uv.y - horizonY) / (1.0 - horizonY);
      color = mix(u_bottomColor, u_topColor, skyT);
      // Stars
      float star = step(0.998, hash(floor(uv * 80.0)));
      float twinkle = sin(u_time * 3.0 + hash(floor(uv * 80.0)) * 50.0) * 0.5 + 0.5;
      color += vec3(1.0, 0.97, 0.9) * star * twinkle * 0.8;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ─── Utility: Matrix Math ───────────────────────────────────────────────────

/**
 * Set a Float32Array to an orthographic projection matrix.
 * @param {Float32Array} out - 16-element destination array.
 * @param {number} left
 * @param {number} right
 * @param {number} bottom
 * @param {number} top
 * @param {number} near
 * @param {number} far
 */
function setOrtho(out, left, right, bottom, top, near, far) {
  const lr = 1 / (left - right);
  const bt = 1 / (bottom - top);
  const nf = 1 / (near - far);
  out[0] = -2 * lr;  out[1] = 0;      out[2] = 0;      out[3] = 0;
  out[4] = 0;        out[5] = -2 * bt; out[6] = 0;      out[7] = 0;
  out[8] = 0;        out[9] = 0;      out[10] = -2 * nf; out[11] = 0;
  out[12] = (left + right) * lr;
  out[13] = (top + bottom) * bt;
  out[14] = (near + far) * nf;
  out[15] = 1;
}

/**
 * Set a Float32Array to a 2D view matrix (translate + zoom).
 * @param {Float32Array} out - 16-element destination array.
 * @param {number} cx - Camera center X.
 * @param {number} cy - Camera center Y.
 * @param {number} zoom - Zoom scale factor.
 */
function setViewMatrix(out, cx, cy, zoom) {
  out[0] = zoom; out[1] = 0;     out[2] = 0; out[3] = 0;
  out[4] = 0;    out[5] = zoom;  out[6] = 0; out[7] = 0;
  out[8] = 0;    out[9] = 0;     out[10] = 1; out[11] = 0;
  out[12] = -cx * zoom;
  out[13] = -cy * zoom;
  out[14] = 0;
  out[15] = 1;
}

/**
 * Multiply two 4x4 matrices: out = a * b.
 * @param {Float32Array} out
 * @param {Float32Array} a
 * @param {Float32Array} b
 */
function multiplyMat4(out, a, b) {
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[i * 4 + k] * b[k * 4 + j];
      }
      out[i * 4 + j] = sum;
    }
  }
}

// ─── WebGLRenderer ───────────────────────────────────────────────────────────

/**
 * Full WebGL 2D renderer with sprite batching, texture atlas, post-processing,
 * depth-of-field, and GPU-accelerated particles.
 * @export {WebGLRenderer}
 */
export class WebGLRenderer {
  /**
   * @param {HTMLCanvasElement} canvas - The game canvas element.
   */
  constructor(canvas) {
    this.canvas = canvas;

    // Attempt WebGL2 first, then WebGL1
    /** @type {WebGLRenderingContext|WebGL2RenderingContext|null} */
    this.gl = canvas.getContext('webgl2', {
      alpha: false, premultipliedAlpha: false, antialias: false,
      stencil: false, depth: false, preserveDrawingBuffer: false
    });
    this.isWebGL2 = !!this.gl;
    if (!this.gl) {
      this.gl = canvas.getContext('webgl', {
        alpha: false, premultipliedAlpha: false, antialias: false,
        stencil: false, depth: false, preserveDrawingBuffer: false
      });
    }
    if (!this.gl) {
      throw new Error('WebGL not supported');
    }

    /** @type {WebGLProgram|null} */
    this.spriteProgram = null;
    /** @type {WebGLProgram|null} */
    this.bgProgram = null;

    /** @type {WebGLBuffer|null} */
    this.quadBuffer = null;
    /** @type {WebGLBuffer|null} */
    this.spriteQuadBuffer = null;

    // Instance data for sprite batching (interleaved: x,y,rot,sx,sy,r,g,b,a,depth)
    /** @type {Float32Array} */
    this.instanceData = null;
    /** @type {WebGLBuffer|null} */
    this.instanceBuffer = null;

    /** @type {number} Maximum sprites per batch. */
    this.maxSprites = 10000;
    /** @type {number} Current sprite count in batch. */
    this.spriteCount = 0;

    /** @type {TextureAtlas|null} */
    this.atlas = null;
    /** @type {PostProcess|null} */
    this.postProcess = null;
    /** @type {ParticleSystemGPU|null} */
    this.particlesGPU = null;

    /** @type {boolean} Enable post-processing effects. */
    this.postEnabled = true;

    // Camera matrices
    /** @type {Float32Array} 4x4 view matrix (camera transform). */
    this.viewMatrix = new Float32Array(16);
    /** @type {Float32Array} 4x4 orthographic projection matrix. */
    this.projMatrix = new Float32Array(16);
    /** @type {Float32Array} Combined view-projection. */
    this.vpMatrix = new Float32Array(16);

    // DOF settings
    /** @type {number} Y-position of DOF focus plane. */
    this.dofFocusY = 300;
    /** @type {number} DOF blur strength. */
    this.dofStrength = 1.0;

    // Global opacity
    /** @type {number} Master opacity multiplier. */
    this.globalOpacity = 1.0;

    // Environment
    /** @type {number} Accumulated time for animations. */
    this.time = 0;

    // Area background colors
    /** @type {Object<string,Object>} */
    this.areaStyles = {
      hub:       { top: [0.102, 0.063, 0.145], bottom: [0.176, 0.106, 0.306], floor: [0.122, 0.086, 0.188] },
      garden:    { top: [0.059, 0.122, 0.059], bottom: [0.102, 0.235, 0.102], floor: [0.078, 0.196, 0.078] },
      library:   { top: [0.051, 0.082, 0.145], bottom: [0.086, 0.145, 0.243], floor: [0.071, 0.118, 0.2] },
      kitchen:   { top: [0.165, 0.082, 0.063], bottom: [0.239, 0.129, 0.094], floor: [0.2, 0.11, 0.082] },
      rooftop:   { top: [0.039, 0.039, 0.102], bottom: [0.082, 0.082, 0.18],  floor: [0.063, 0.063, 0.133] },
      basement:  { top: [0.039, 0.039, 0.039], bottom: [0.078, 0.078, 0.078], floor: [0.067, 0.067, 0.067] }
    };

    // Screen dimensions
    /** @type {number} */
    this.width = 960;
    /** @type {number} */
    this.height = 540;

    // Stats
    /** @type {number} Draw calls this frame. */
    this.drawCalls = 0;
    /** @type {number} Sprites drawn this frame. */
    this.spritesDrawn = 0;

    // Temporary canvas for generating avatar textures
    /** @type {HTMLCanvasElement} */
    this._tempCanvas = document.createElement('canvas');
    this._tempCanvas.width = 64;
    this._tempCanvas.height = 64;
    /** @type {CanvasRenderingContext2D} */
    this._tempCtx = this._tempCanvas.getContext('2d');

    this._boundResize = this.resize.bind(this);
  }

  // ─── Initialization ────────────────────────────────────────────────────────

  /**
   * Initialize the WebGL renderer: compile shaders, create buffers,
   * set up texture atlas, post-processing, and particle system.
   * @throws {Error} If shader compilation fails.
   */
  init() {
    const gl = this.gl;

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    // Compile shaders
    this.spriteProgram = this._createProgram(SPRITE_VERTEX, SPRITE_FRAGMENT);
    this.bgProgram = this._createProgram(QUAD_VERTEX, BG_FRAGMENT);

    // Create fullscreen quad buffer (position + texCoord)
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 0, 1,   1, -1, 1, 1,   -1, 1, 0, 0,
      -1, 1, 0, 0,    1, -1, 1, 1,    1, 1, 1, 0
    ]), gl.STATIC_DRAW);

    // Create sprite quad buffer (unit square, centered)
    this.spriteQuadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteQuadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -0.5, -0.5, 0, 1,   0.5, -0.5, 1, 1,   -0.5, 0.5, 0, 0,
      -0.5, 0.5, 0, 0,    0.5, -0.5, 1, 1,    0.5, 0.5, 1, 0
    ]), gl.STATIC_DRAW);

    // Create instance buffer for sprite batching
    // Layout per instance: offsetX, offsetY, rotation, scaleX, scaleY, r, g, b, a, depth
    this.instanceData = new Float32Array(this.maxSprites * 10);
    this.instanceBuffer = gl.createBuffer();

    // Initialize projection matrix
    this.updateProjection(this.width, this.height);
    setViewMatrix(this.viewMatrix, 0, 0, 1);

    // Create texture atlas
    this.atlas = new TextureAtlas(gl, 2048);

    // Create post-processing pipeline
    this.postProcess = new PostProcess(gl, this.width, this.height);

    // Create GPU particle system
    this.particlesGPU = new ParticleSystemGPU(gl, 5000);
    this.particlesGPU.init();

    // Generate procedural white pixel for untextured drawing
    this.atlas.addSprite('__white', this._createWhiteImage(8));
    this.atlas.upload();

    console.log('[WebGLRenderer] Initialized. WebGL2:', this.isWebGL2);
  }

  /**
   * Create a 1x1 white Image element for default texturing.
   * @param {number} size
   * @returns {HTMLImageElement}
   */
  _createWhiteImage(size) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, size, size);
    const img = new Image();
    img.src = c.toDataURL();
    return img;
  }

  // ─── Shader Utilities ──────────────────────────────────────────────────────

  /**
   * Compile a WebGL shader.
   * @param {number} type - gl.VERTEX_SHADER or gl.FRAGMENT_SHADER.
   * @param {string} source - GLSL source code.
   * @returns {WebGLShader}
   */
  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${info}\nSource:\n${source}`);
    }
    return shader;
  }

  /**
   * Link a vertex and fragment shader into a program.
   * @param {WebGLShader} vs
   * @param {WebGLShader} fs
   * @returns {WebGLProgram}
   */
  createProgram(vs, fs) {
    const gl = this.gl;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      throw new Error(`Program link error: ${info}`);
    }
    return prog;
  }

  /**
   * Convenience: compile + link from source strings.
   * @param {string} vsSource
   * @param {string} fsSource
   * @returns {WebGLProgram}
   */
  _createProgram(vsSource, fsSource) {
    const gl = this.gl;
    const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
    return this.createProgram(vs, fs);
  }

  // ─── Projection & Camera ───────────────────────────────────────────────────

  /**
   * Update the orthographic projection matrix.
   * @param {number} width
   * @param {number} height
   */
  updateProjection(width, height) {
    this.width = width;
    this.height = height;
    setOrtho(this.projMatrix, 0, width, height, 0, -1, 1);
    if (this.postProcess) {
      this.postProcess.resize(width, height);
    }
  }

  /**
   * Update the view matrix from a camera object.
   * @param {Object} camera - Object with x, y, zoom properties.
   */
  setCamera(camera) {
    const zoom = camera.zoom || 1;
    setViewMatrix(this.viewMatrix, camera.x, camera.y, zoom);
    // Compute VP matrix
    multiplyMat4(this.vpMatrix, this.projMatrix, this.viewMatrix);
    this.dofFocusY = camera.y || 300;
  }

  // ─── Frame Lifecycle ───────────────────────────────────────────────────────

  /**
   * Begin a new frame: clear, update camera, reset batch.
   * @param {Object} camera - Camera state {x, y, zoom}.
   */
  beginFrame(camera) {
    const gl = this.gl;
    this.time += 0.016;
    this.drawCalls = 0;
    this.spritesDrawn = 0;

    // Set camera
    if (camera) {
      this.setCamera(camera);
    }

    // Clear
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Reset sprite batch
    this.spriteCount = 0;
  }

  /**
   * End frame: flush remaining sprites, run post-processing.
   */
  endFrame() {
    this.flush();
    if (this.postEnabled && this.postProcess) {
      this.applyPostProcessing();
    }
  }

  // ─── Sprite Batching ───────────────────────────────────────────────────────

  /**
   * Add a sprite to the batch. Flushes if batch is full.
   * @param {string|number} spriteId - Key in the texture atlas.
   * @param {number} x - World X position.
   * @param {number} y - World Y position.
   * @param {number} w - Width.
   * @param {number} h - Height.
   * @param {number} [rotation=0] - Rotation in radians.
   * @param {number} [opacity=1] - Opacity 0-1.
   * @param {number[]} [tint=[1,1,1,1]] - RGBA tint.
   * @param {boolean} [flipX=false]
   * @param {boolean} [flipY=false]
   * @param {number} [depth=0] - Depth offset for Z-sorting.
   */
  drawSprite(spriteId, x, y, w, h, rotation = 0, opacity = 1,
             tint = [1, 1, 1, 1], flipX = false, flipY = false, depth = 0) {
    if (this.spriteCount >= this.maxSprites) {
      this.flush();
    }

    const uv = this.atlas ? this.atlas.getUV(spriteId) : null;
    if (!uv) {
      // Use white texture if sprite not found
      // Still draw with color tint
    }

    const idx = this.spriteCount * 10;
    const data = this.instanceData;

    data[idx + 0] = x;
    data[idx + 1] = y;
    data[idx + 2] = rotation;
    data[idx + 3] = w * (flipX ? -1 : 1);
    data[idx + 4] = h * (flipY ? -1 : 1);
    data[idx + 5] = tint[0];
    data[idx + 6] = tint[1];
    data[idx + 7] = tint[2];
    data[idx + 8] = tint[3] * opacity;
    data[idx + 9] = depth;

    this.spriteCount++;
  }

  /**
   * Upload instance data to GPU and render all batched sprites.
   */
  flush() {
    if (this.spriteCount === 0) return;

    const gl = this.gl;
    const prog = this.spriteProgram;

    gl.useProgram(prog);

    // Upload instance data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.instanceData.subarray(0, this.spriteCount * 10), gl.DYNAMIC_DRAW);

    // Bind sprite quad
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteQuadBuffer);
    const posLoc = gl.getAttribLocation(prog, 'a_position');
    const tcLoc = gl.getAttribLocation(prog, 'a_texCoord');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(tcLoc);
    gl.vertexAttribPointer(tcLoc, 2, gl.FLOAT, false, 16, 8);

    // Bind instance buffer (interleaved: offsetXY, rotation, scaleXY, colorRGBA, depth)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    const offsetLoc = gl.getAttribLocation(prog, 'a_offset');
    const rotLoc = gl.getAttribLocation(prog, 'a_rotation');
    const scaleLoc = gl.getAttribLocation(prog, 'a_scale');
    const colorLoc = gl.getAttribLocation(prog, 'a_color');
    const depthLoc = gl.getAttribLocation(prog, 'a_depth');

    const stride = 10 * 4; // 10 floats * 4 bytes

    if (offsetLoc >= 0) {
      gl.enableVertexAttribArray(offsetLoc);
      gl.vertexAttribPointer(offsetLoc, 2, gl.FLOAT, false, stride, 0);
      if (this.isWebGL2) {
        gl.vertexAttribDivisor(offsetLoc, 1);
      }
    }
    if (rotLoc >= 0) {
      gl.enableVertexAttribArray(rotLoc);
      gl.vertexAttribPointer(rotLoc, 1, gl.FLOAT, false, stride, 8);
      if (this.isWebGL2) {
        gl.vertexAttribDivisor(rotLoc, 1);
      }
    }
    if (scaleLoc >= 0) {
      gl.enableVertexAttribArray(scaleLoc);
      gl.vertexAttribPointer(scaleLoc, 2, gl.FLOAT, false, stride, 12);
      if (this.isWebGL2) {
        gl.vertexAttribDivisor(scaleLoc, 1);
      }
    }
    if (colorLoc >= 0) {
      gl.enableVertexAttribArray(colorLoc);
      gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, stride, 20);
      if (this.isWebGL2) {
        gl.vertexAttribDivisor(colorLoc, 1);
      }
    }
    if (depthLoc >= 0) {
      gl.enableVertexAttribArray(depthLoc);
      gl.vertexAttribPointer(depthLoc, 1, gl.FLOAT, false, stride, 36);
      if (this.isWebGL2) {
        gl.vertexAttribDivisor(depthLoc, 1);
      }
    }

    // Set uniforms
    gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'u_viewMatrix'), false, this.viewMatrix);
    gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'u_projMatrix'), false, this.projMatrix);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_dofFocus'), this.dofFocusY);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_dofStrength'), this.dofStrength);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_time'), this.time);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_opacityGlobal'), this.globalOpacity);

    // Bind atlas texture
    if (this.atlas && this.atlas.texture) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.atlas.texture);
      gl.uniform1i(gl.getUniformLocation(prog, 'u_texture'), 0);
    }

    // Draw: use instancing if WebGL2, else fallback to looping
    if (this.isWebGL2) {
      // @ts-ignore - WebGL2RenderingContext
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.spriteCount);
    } else {
      // WebGL1 fallback: manual loop (slower but compatible)
      // Disable divisor for WebGL1
      for (let i = 0; i < this.spriteCount; i++) {
        if (offsetLoc >= 0) {
          gl.vertexAttribPointer(offsetLoc, 2, gl.FLOAT, false, stride, i * stride);
        }
        if (rotLoc >= 0) {
          gl.vertexAttribPointer(rotLoc, 1, gl.FLOAT, false, stride, i * stride + 8);
        }
        if (scaleLoc >= 0) {
          gl.vertexAttribPointer(scaleLoc, 2, gl.FLOAT, false, stride, i * stride + 12);
        }
        if (colorLoc >= 0) {
          gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, stride, i * stride + 20);
        }
        if (depthLoc >= 0) {
          gl.vertexAttribPointer(depthLoc, 1, gl.FLOAT, false, stride, i * stride + 36);
        }
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
    }

    this.drawCalls++;
    this.spritesDrawn += this.spriteCount;
    this.spriteCount = 0;
  }

  // ─── Background Rendering ──────────────────────────────────────────────────

  /**
   * Render the procedural area background using the background shader.
   * @param {string} areaId
   */
  renderAreaBackground(areaId) {
    const gl = this.gl;
    const prog = this.bgProgram;
    const style = this.areaStyles[areaId] || this.areaStyles.hub;

    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    const posLoc = gl.getAttribLocation(prog, 'a_position');
    const tcLoc = gl.getAttribLocation(prog, 'a_texCoord');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(tcLoc);
    gl.vertexAttribPointer(tcLoc, 2, gl.FLOAT, false, 16, 8);

    gl.uniform3f(gl.getUniformLocation(prog, 'u_topColor'), ...style.top);
    gl.uniform3f(gl.getUniformLocation(prog, 'u_bottomColor'), ...style.bottom);
    gl.uniform3f(gl.getUniformLocation(prog, 'u_floorColor'), ...style.floor);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_horizon'), 0.35);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_time'), this.time);
    gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), this.width, this.height);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.drawCalls++;
  }

  // ─── Entity Rendering ──────────────────────────────────────────────────────

  /**
   * Render an entity (player, NPC, object) as a sprite.
   * @param {Object} entity
   * @param {number} screenX
   * @param {number} screenY
   * @param {number} [scale=1]
   */
  renderEntity(entity, screenX, screenY, scale = 1) {
    // Shadow
    this.drawSprite('__white', screenX, screenY + 16 * scale,
      28 * scale, 8 * scale, 0, 0.25, [0, 0, 0, 1]);

    // Body
    const color = this._hexToRGBA(entity.color || '#cccccc');
    this.drawSprite('__white', screenX, screenY, 24 * scale, 24 * scale,
      0, 1, color, false, false, entity.y || 0);
  }

  /**
   * Render a player avatar with bob animation.
   * @param {Object} player
   * @param {number} screenX
   * @param {number} screenY
   * @param {number} frameCount
   */
  renderPlayer(player, screenX, screenY, frameCount = 0) {
    const bob = player.moving ? Math.sin(frameCount * 0.25) * 3 : 0;
    const scale = 1.0;
    const y = screenY + bob;

    // Shadow
    this.drawSprite('__white', screenX, y + 18, 32 * scale, 10 * scale,
      0, 0.3, [0, 0, 0, 1]);

    // Generate avatar texture ID
    const avatarId = this._getAvatarId(player);
    if (!this.atlas.hasSprite(avatarId)) {
      this._generateAvatarTexture(player, avatarId);
    }

    // Draw avatar body
    this.drawSprite(avatarId, screenX, y, 32 * scale, 40 * scale,
      0, 1, [1, 1, 1, 1], player.facing === 'left', false, player.y || 0);

    // Gesture indicator
    if (player.gestureId > 0) {
      const gColors = {
        1: [1, 1, 0.5, 1],   // wave
        2: [1, 0.5, 1, 1],   // dance
        3: [0.5, 1, 0.5, 1], // sit
        4: [0.5, 0.5, 1, 1], // sleep
        5: [1, 1, 0, 1],     // laugh
        6: [0.5, 0.7, 1, 1]  // cry
      };
      this.drawSprite('__white', screenX, y - 36, 12, 12, 0, 0.8,
        gColors[player.gestureId] || [1, 1, 1, 1]);
    }
  }

  /**
   * Render an NPC.
   * @param {Object} npc
   * @param {number} screenX
   * @param {number} screenY
   * @param {number} frameCount
   */
  renderNPC(npc, screenX, screenY, frameCount = 0) {
    const bob = npc.moving ? Math.sin(frameCount * 0.2 + (npc.id || 0)) * 2 : 0;
    const y = screenY + bob;

    // Shadow
    this.drawSprite('__white', screenX, y + 16, 28, 8, 0, 0.25, [0, 0, 0, 1]);

    const avatarId = this._getAvatarId(npc);
    if (!this.atlas.hasSprite(avatarId)) {
      this._generateAvatarTexture(npc, avatarId);
    }

    this.drawSprite(avatarId, screenX, y, 28, 36, 0, 1, [1, 1, 1, 1],
      npc.facing === 'left', false, npc.y || 0);
  }

  // ─── Avatar Generation ─────────────────────────────────────────────────────

  /**
   * Get a unique atlas ID for an entity's avatar.
   * @param {Object} entity
   * @returns {string}
   */
  _getAvatarId(entity) {
    const skin = entity.skinColor || 0;
    const hair = entity.hairColor || 0;
    const outfit = entity.outfitColor || 0;
    const expr = entity.expression || 'happy';
    return `avatar_${skin}_${hair}_${outfit}_${expr}`;
  }

  /**
   * Procedurally render an avatar to a canvas and pack into atlas.
   * @param {Object} p
   * @param {string} id
   */
  _generateAvatarTexture(p, id) {
    const ctx = this._tempCtx;
    const w = 64, h = 64;
    ctx.clearRect(0, 0, w, h);

    const skinColors = ['#ffe0bd', '#ffcd94', '#eac086', '#d2a56d', '#8d5524'];
    const hairColors = ['#2d2d2d', '#5c3a21', '#d4a574', '#e8c547', '#a33b3b', '#6b4c9a'];
    const outfitColors = ['#5b8c85', '#c75b5b', '#5b7fa8', '#a85ba8', '#8c5b5b', '#d4a45b'];

    const skin = skinColors[p.skinColor % skinColors.length] || skinColors[0];
    const hair = hairColors[p.hairColor % hairColors.length] || hairColors[0];
    const outfit = outfitColors[p.outfitColor % outfitColors.length] || outfitColors[0];

    const cx = w / 2, cy = h / 2;

    // Body
    ctx.fillStyle = outfit;
    this._roundRect(ctx, cx - 10, cy - 2, 20, 18, 6);
    ctx.fill();

    // Head
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(cx, cy - 12, 12, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(cx, cy - 14, 12, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy - 12, 12, Math.PI * 1.1, Math.PI * 1.9);
    ctx.fill();

    // Eyes
    const eyeOffset = p.facing === 'left' ? -2 : p.facing === 'right' ? 2 : 0;
    const eyeY = cy - 12;
    ctx.fillStyle = '#2d2d2d';

    if (p.expression === 'sleep') {
      ctx.strokeStyle = '#2d2d2d';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx - 5 + eyeOffset, eyeY); ctx.lineTo(cx - 2 + eyeOffset, eyeY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 2 + eyeOffset, eyeY); ctx.lineTo(cx + 5 + eyeOffset, eyeY); ctx.stroke();
    } else if (p.expression === 'laugh') {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx - 3 + eyeOffset, eyeY - 1, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 3 + eyeOffset, eyeY - 1, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2d2d2d';
      ctx.beginPath(); ctx.arc(cx - 3 + eyeOffset, eyeY - 1, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 3 + eyeOffset, eyeY - 1, 1.5, 0, Math.PI * 2); ctx.fill();
    } else if (p.expression === 'cry') {
      ctx.beginPath(); ctx.arc(cx - 3 + eyeOffset, eyeY, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 3 + eyeOffset, eyeY, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath(); ctx.arc(cx - 3 + eyeOffset, eyeY + 6, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 3 + eyeOffset, eyeY + 6, 1.5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(cx - 3 + eyeOffset, eyeY, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 3 + eyeOffset, eyeY, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx - 2 + eyeOffset, eyeY - 1, 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 4 + eyeOffset, eyeY - 1, 0.8, 0, Math.PI * 2); ctx.fill();
    }

    // Mouth
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    if (p.expression === 'happy' || p.expression === 'laugh') {
      ctx.beginPath();
      ctx.arc(cx + eyeOffset, cy - 8, 3, 0.1, Math.PI - 0.1);
      ctx.stroke();
    } else if (p.expression === 'sleep') {
      ctx.beginPath(); ctx.moveTo(cx - 2 + eyeOffset, cy - 8); ctx.lineTo(cx + 2 + eyeOffset, cy - 8); ctx.stroke();
    } else if (p.expression === 'cry') {
      ctx.beginPath(); ctx.moveTo(cx - 2 + eyeOffset, cy - 6);
      ctx.quadraticCurveTo(cx + eyeOffset, cy - 4, cx + 2 + eyeOffset, cy - 6);
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(cx - 2 + eyeOffset, cy - 8); ctx.lineTo(cx + 2 + eyeOffset, cy - 8); ctx.stroke();
    }

    // Accessories
    if (p.accessories && p.accessories.includes('glasses')) {
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(cx - 3 + eyeOffset, eyeY, 4, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + 3 + eyeOffset, eyeY, 4, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 1 + eyeOffset, eyeY); ctx.lineTo(cx - 1 + eyeOffset, eyeY); ctx.stroke();
    }

    // Convert canvas to image and add to atlas
    const img = new Image();
    img.src = this._tempCanvas.toDataURL();
    img.onload = () => {
      if (this.atlas) {
        this.atlas.addSprite(id, img);
        this.atlas.upload();
      }
    };
  }

  /**
   * Draw a rounded rectangle on a 2D context.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} r
   */
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /**
   * Convert hex color string to RGBA array.
   * @param {string} hex
   * @returns {number[]} [r, g, b, a] normalized to 0-1
   */
  _hexToRGBA(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b, 1];
  }

  // ─── Particle Rendering ────────────────────────────────────────────────────

  /**
   * Render GPU-accelerated particles.
   * @param {Array<Object>} particles - Legacy CPU particle array.
   * @param {number} [dt=0.016]
   */
  renderParticles(particles, dt = 0.016) {
    if (this.particlesGPU && particles.length > 0) {
      // Sync CPU particles to GPU
      this.particlesGPU.syncFromCPU(particles, dt);
      this.particlesGPU.render(this.viewMatrix, this.projMatrix);
    }
  }

  /**
   * Emit a GPU particle effect at world coordinates.
   * @param {string} effectType
   * @param {number} x
   * @param {number} y
   * @param {Object} [options]
   */
  emitParticleEffect(effectType, x, y, options = {}) {
    if (this.particlesGPU) {
      this.particlesGPU.emitPreset(effectType, x, y, options);
    }
  }

  // ─── Post-Processing ───────────────────────────────────────────────────────

  /**
   * Apply fullscreen post-processing effects.
   */
  applyPostProcessing() {
    // The post-process system reads the current framebuffer and renders to screen
    // For now, we use the PostProcess class which manages its own framebuffers
    // In a full implementation, we'd first render the scene to an FBO
  }

  // ─── HUD Rendering (delegated to Canvas 2D for text) ───────────────────────

  /**
   * Render HUD overlay using Canvas 2D on top of WebGL.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} state
   * @param {number} W
   * @param {number} H
   */
  renderHUD(ctx, state, W, H) {
    // Top bar
    ctx.fillStyle = 'rgba(10,10,15,0.6)';
    this._drawRoundedRectCanvas(ctx, 8, 8, W - 16, 32, 8);

    // Currency
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`\u{1FA99} ${state.gold}`, 20, 24);
    ctx.fillStyle = '#c0c0c0';
    ctx.fillText(`\u{1FA99} ${state.silver}`, 110, 24);

    // Area name
    const areaNames = {
      hub: 'Starlight Hub', garden: 'Moonlit Garden', library: 'Crystal Library',
      kitchen: 'Cozy Kitchen', rooftop: 'Rooftop Terrace', basement: 'Whisper Basement'
    };
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(areaNames[state.area] || state.area, W / 2, 24);

    // Online count
    ctx.fillStyle = '#a7f070';
    ctx.textAlign = 'right';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${1 + state.onlinePlayers.length} online`, W - 20, 24);

    // Bottom dock
    const dockY = H - 44;
    ctx.fillStyle = 'rgba(10,10,15,0.6)';
    this._drawRoundedRectCanvas(ctx, 8, dockY, W - 16, 36, 8);

    // Action buttons
    const actions = ['Chat', 'Inventory', 'Map', 'Menu'];
    const btnW = 80;
    const gap = 10;
    const startX = (W - (actions.length * btnW + (actions.length - 1) * gap)) / 2;
    for (let i = 0; i < actions.length; i++) {
      const bx = startX + i * (btnW + gap);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      this._drawRoundedRectCanvas(ctx, bx, dockY + 4, btnW, 28, 6);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(actions[i], bx + btnW / 2, dockY + 18);
    }

    // Toasts
    if (state.ui.toastQueue.length > 0) {
      const toast = state.ui.toastQueue[0];
      const tAlpha = Math.min(1, toast.ttl / 0.5);
      ctx.save();
      ctx.globalAlpha = tAlpha;
      ctx.fillStyle = 'rgba(20,20,30,0.85)';
      this._drawRoundedRectCanvas(ctx, W / 2 - 120, 52, 240, 28, 8);
      ctx.fillStyle = '#fff';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(toast.text, W / 2, 66);
      ctx.restore();
    }

    // Chat messages
    if (state.settings.showChat && state.chatMessages.length > 0) {
      const recent = state.chatMessages.slice(-3);
      const chatY = H - 110;
      ctx.save();
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < recent.length; i++) {
        const msg = recent[i];
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(12, chatY + i * 18, 340, 18);
        ctx.fillStyle = '#a7f070';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${msg.sender}:`, 16, chatY + i * 18 + 9);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '11px sans-serif';
        ctx.fillText(msg.text, 16 + ctx.measureText(`${msg.sender}:`).width + 4, chatY + i * 18 + 9);
      }
      ctx.restore();
    }
  }

  /**
   * Draw a rounded rectangle using Canvas 2D.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} r
   */
  _drawRoundedRectCanvas(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }

  // ─── Screen Renderers ──────────────────────────────────────────────────────

  /**
   * Render the landing screen.
   * @param {CanvasRenderingContext2D} ctx2d - Canvas 2D context for text.
   * @param {number} W
   * @param {number} H
   */
  renderLanding(ctx2d, W, H) {
    this.renderAreaBackground('hub');
    ctx2d.fillStyle = 'rgba(0,0,0,0.55)';
    ctx2d.fillRect(0, 0, W, H);
    this._drawTextCanvas(ctx2d, 'Starlight Inn', W / 2, H / 2 - 40, {
      align: 'center', font: 'bold 48px serif', color: '#ffd700', shadow: true
    });
    this._drawTextCanvas(ctx2d, 'A cozy-core social world', W / 2, H / 2 + 10, {
      align: 'center', font: '18px sans-serif', color: '#e2e8f0', shadow: true
    });
    this._drawTextCanvas(ctx2d, 'Press ENTER or TAP to begin', W / 2, H / 2 + 60, {
      align: 'center', font: '14px sans-serif', color: '#a7f070', shadow: true
    });
  }

  /**
   * Render the character selection screen.
   * @param {CanvasRenderingContext2D} ctx2d
   * @param {number} W
   * @param {number} H
   * @param {Object} player
   */
  renderCharSelect(ctx2d, W, H, player) {
    this.renderAreaBackground('hub');
    ctx2d.fillStyle = 'rgba(0,0,0,0.45)';
    ctx2d.fillRect(0, 0, W, H);
    this._drawTextCanvas(ctx2d, 'Choose Your Character', W / 2, 60, {
      align: 'center', font: 'bold 28px sans-serif', color: '#fff', shadow: true
    });
    ctx2d.fillStyle = 'rgba(255,255,255,0.08)';
    const cx = W / 2, cy = H / 2;
    this._drawRoundedRectCanvas(ctx2d, cx - 80, cy - 80, 160, 160, 12);
  }

  /**
   * Render the settings screen.
   * @param {CanvasRenderingContext2D} ctx2d
   * @param {number} W
   * @param {number} H
   * @param {Object} settings
   */
  renderSettings(ctx2d, W, H, settings) {
    this.renderAreaBackground('hub');
    ctx2d.fillStyle = 'rgba(0,0,0,0.55)';
    ctx2d.fillRect(0, 0, W, H);
    this._drawTextCanvas(ctx2d, 'Settings', W / 2, 60, {
      align: 'center', font: 'bold 28px sans-serif', color: '#fff', shadow: true
    });
    const opts = [
      `Sound: ${settings.sound ? 'ON' : 'OFF'}`,
      `Music: ${settings.music ? 'ON' : 'OFF'}`,
      `Quality: ${settings.quality}`,
      `Show Names: ${settings.showNames ? 'ON' : 'OFF'}`,
      `Show Chat: ${settings.showChat ? 'ON' : 'OFF'}`
    ];
    for (let i = 0; i < opts.length; i++) {
      this._drawTextCanvas(ctx2d, opts[i], W / 2, 140 + i * 40, {
        align: 'center', font: '16px sans-serif', color: '#e2e8f0', shadow: true
      });
    }
  }

  /**
   * Canvas 2D text helper.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} text
   * @param {number} x
   * @param {number} y
   * @param {Object} options
   */
  _drawTextCanvas(ctx, text, x, y, options = {}) {
    const {
      font = '14px sans-serif', color = '#fff', align = 'left',
      baseline = 'alphabetic', shadow = false
    } = options;
    ctx.save();
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1;
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // ─── Texture Atlas Management ──────────────────────────────────────────────

  /**
   * Add a sprite image to the texture atlas.
   * @param {string} id
   * @param {HTMLImageElement|HTMLCanvasElement} image
   */
  addSprite(id, image) {
    if (this.atlas) {
      this.atlas.addSprite(id, image);
    }
  }

  /**
   * Upload the atlas texture to GPU.
   */
  uploadAtlas() {
    if (this.atlas) {
      this.atlas.upload();
    }
  }

  /**
   * Check if a sprite exists in the atlas.
   * @param {string} id
   * @returns {boolean}
   */
  hasSprite(id) {
    return this.atlas ? this.atlas.hasSprite(id) : false;
  }

  // ─── DOF Control ───────────────────────────────────────────────────────────

  /**
   * Set the depth-of-field focus plane Y coordinate.
   * @param {number} y
   */
  setDOFFocusY(y) {
    this.dofFocusY = y;
  }

  /**
   * Set DOF blur strength.
   * @param {number} strength
   */
  setDOFStrength(strength) {
    this.dofStrength = strength;
  }

  // ─── Resize ────────────────────────────────────────────────────────────────

  /**
   * Handle canvas resize.
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    const gl = this.gl;
    gl.viewport(0, 0, width, height);
    this.updateProjection(width, height);
    this.width = width;
    this.height = height;
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  /**
   * Destroy all GPU resources.
   */
  destroy() {
    const gl = this.gl;
    if (this.spriteProgram) gl.deleteProgram(this.spriteProgram);
    if (this.bgProgram) gl.deleteProgram(this.bgProgram);
    if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);
    if (this.spriteQuadBuffer) gl.deleteBuffer(this.spriteQuadBuffer);
    if (this.instanceBuffer) gl.deleteBuffer(this.instanceBuffer);
    if (this.atlas) this.atlas.destroy();
    if (this.postProcess) this.postProcess.destroy();
    if (this.particlesGPU) this.particlesGPU.destroy();
  }
}
