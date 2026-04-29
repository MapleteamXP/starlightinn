/**
 * @file ParticleSystemGPU.js
 * @description GPU-accelerated particle system with instanced rendering.
 * CPU-side particle simulation (position, velocity, life, color, size),
 * GPU-side instanced rendering for maximum throughput.
 * Includes preset effects: fireflies, falling leaves, lamp flicker, combat effects,
 * emotes, and ambient atmosphere particles.
 */

// ─── Particle Vertex Shader ──────────────────────────────────────────────────

/** Instanced particle vertex shader */
const PARTICLE_VERTEX = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;

  // Instance attributes
  attribute vec2 a_offset;
  attribute vec4 a_color;
  attribute float a_size;
  attribute float a_rotation;

  uniform mat4 u_viewMatrix;
  uniform mat4 u_projMatrix;

  varying vec4 v_color;
  varying vec2 v_texCoord;

  void main() {
    float c = cos(a_rotation);
    float s = sin(a_rotation);
    vec2 rotated = vec2(
      a_position.x * c - a_position.y * s,
      a_position.x * s + a_position.y * c
    );
    vec2 worldPos = rotated * a_size + a_offset;
    gl_Position = u_projMatrix * u_viewMatrix * vec4(worldPos, 0.0, 1.0);
    v_color = a_color;
    v_texCoord = a_texCoord;
  }
`;

// ─── Particle Fragment Shader ─────────────────────────────────────────────────

/** Particle fragment shader with soft circular falloff */
const PARTICLE_FRAGMENT = `
  precision mediump float;
  varying vec4 v_color;
  varying vec2 v_texCoord;

  void main() {
    // Create a soft circular particle from the quad
    vec2 center = v_texCoord - vec2(0.5);
    float dist = length(center) * 2.0;
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
    alpha = pow(alpha, 1.5); // Sharper falloff
    gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
  }
`;

// ─── Sparkle Variant Fragment Shader ──────────────────────────────────────────

/** Sparkle/star shaped particle */
const SPARKLE_FRAGMENT = `
  precision mediump float;
  varying vec4 v_color;
  varying vec2 v_texCoord;
  uniform float u_time;

  void main() {
    vec2 uv = v_texCoord - vec2(0.5);
    float angle = atan(uv.y, uv.x);
    float dist = length(uv) * 2.0;

    // 4-point star shape
    float star = abs(cos(angle * 2.0));
    star = 1.0 - smoothstep(star * 0.5, star * 0.5 + 0.5, dist);
    star = max(star, 1.0 - smoothstep(0.0, 0.3, dist));

    // Twinkle
    float twinkle = sin(u_time * 8.0) * 0.3 + 0.7;
    star *= twinkle;

    gl_FragColor = vec4(v_color.rgb, v_color.a * star);
  }
`;

// ─── Particle Data Structure ─────────────────────────────────────────────────

/**
 * @typedef {Object} Particle
 * @property {number} x - World X position.
 * @property {number} y - World Y position.
 * @property {number} vx - Velocity X (pixels/sec).
 * @property {number} vy - Velocity Y (pixels/sec).
 * @property {number} life - Remaining life in seconds.
 * @property {number} maxLife - Initial life in seconds.
 * @property {number} size - Particle size in pixels.
 * @property {number} r - Red color 0-1.
 * @property {number} g - Green color 0-1.
 * @property {number} b - Blue color 0-1.
 * @property {number} a - Alpha 0-1.
 * @property {number} rotation - Rotation in radians.
 * @property {number} rotSpeed - Rotation speed.
 * @property {number} gravity - Gravity acceleration.
 * @property {number} drag - Velocity damping.
 */

// ─── ParticleSystemGPU ───────────────────────────────────────────────────────

/**
 * GPU-accelerated particle system.
 * Simulates particles on CPU, renders via instanced WebGL draw calls.
 * @export {ParticleSystemGPU}
 */
export class ParticleSystemGPU {
  /**
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
   * @param {number} [maxParticles=5000]
   */
  constructor(gl, maxParticles = 5000) {
    /** @type {WebGLRenderingContext|WebGL2RenderingContext} */
    this.gl = gl;
    /** @type {number} */
    this.maxParticles = maxParticles;
    /** @type {number} */
    this.activeCount = 0;

    // Particle state arrays
    /** @type {Float32Array} */
    this.posX = new Float32Array(maxParticles);
    /** @type {Float32Array} */
    this.posY = new Float32Array(maxParticles);
    /** @type {Float32Array} */
    this.velX = new Float32Array(maxParticles);
    /** @type {Float32Array} */
    this.velY = new Float32Array(maxParticles);
    /** @type {Float32Array} */
    this.life = new Float32Array(maxParticles);
    /** @type {Float32Array} */
    this.maxLife = new Float32Array(maxParticles);
    /** @type {Float32Array} */
    this.size = new Float32Array(maxParticles);
    /** @type {Float32Array} */
    this.colorR = new Float32Array(maxParticles);
    /** @type {Float32Array} */
    this.colorG = new Float32Array(maxParticles);
    /** @type {Float32Array} */
    this.colorB = new Float32Array(maxParticles);
    /** @type {Float32Array} */
    this.colorA = new Float32Array(maxParticles);
    /** @type {Float32Array} */
    this.rotation = new Float32Array(maxParticles);
    /** @type {Float32Array} */
    this.rotSpeed = new Float32Array(maxParticles);
    /** @type {Float32Array} */
    this.gravity = new Float32Array(maxParticles);
    /** @type {Float32Array} */
    this.drag = new Float32Array(maxParticles);

    // GPU buffers
    /** @type {WebGLProgram|null} */
    this.program = null;
    /** @type {WebGLProgram|null} */
    this.sparkleProgram = null;
    /** @type {WebGLBuffer|null} */
    this.quadBuffer = null;
    /** @type {WebGLBuffer|null} */
    this.instanceOffsetBuffer = null;
    /** @type {WebGLBuffer|null} */
    this.instanceColorBuffer = null;
    /** @type {WebGLBuffer|null} */
    this.instanceSizeBuffer = null;
    /** @type {WebGLBuffer|null} */
    this.instanceRotationBuffer = null;

    // Interleaved instance data for upload
    /** @type {Float32Array} */
    this.instanceData = new Float32Array(maxParticles * 8); // x, y, r, g, b, a, size, rotation

    // Free list for particle recycling
    /** @type {number[]} */
    this.freeList = [];
    /** @type {number} Next free index. */
    this.nextIndex = 0;

    /** @type {boolean} */
    this.isWebGL2 = gl instanceof WebGL2RenderingContext;
  }

  // ─── Initialization ────────────────────────────────────────────────────────

  /**
   * Compile shaders and create GPU buffers.
   */
  init() {
    const gl = this.gl;

    // Main particle program
    this.program = this._createProgram(PARTICLE_VERTEX, PARTICLE_FRAGMENT);
    // Sparkle variant
    this.sparkleProgram = this._createProgram(PARTICLE_VERTEX, SPARKLE_FRAGMENT);

    // Unit quad for each particle
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -0.5, -0.5, 0, 1,   0.5, -0.5, 1, 1,   -0.5, 0.5, 0, 0,
      -0.5, 0.5, 0, 0,    0.5, -0.5, 1, 1,    0.5, 0.5, 1, 0
    ]), gl.STATIC_DRAW);

    // Instance buffers
    this.instanceOffsetBuffer = gl.createBuffer();
    this.instanceColorBuffer = gl.createBuffer();
    this.instanceSizeBuffer = gl.createBuffer();
    this.instanceRotationBuffer = gl.createBuffer();

    // Initialize free list
    for (let i = this.maxParticles - 1; i >= 0; i--) {
      this.freeList.push(i);
    }
  }

  /**
   * Compile + link shader program.
   * @param {string} vsSource
   * @param {string} fsSource
   * @returns {WebGLProgram}
   */
  _createProgram(vsSource, fsSource) {
    const gl = this.gl;
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    return prog;
  }

  // ─── Particle Emission ─────────────────────────────────────────────────────

  /**
   * Emit particles with the given configuration.
   * @param {Object} config
   * @param {number} config.x - Spawn center X.
   * @param {number} config.y - Spawn center Y.
   * @param {number} [config.count=10]
   * @param {number} [config.speed=50] - Base speed.
   * @param {number} [config.speedVar=0.5] - Speed variation 0-1.
   * @param {number} [config.angle=0] - Base emission angle (radians).
   * @param {number} [config.angleSpread=Math.PI*2] - Angle spread.
   * @param {number} [config.life=1] - Base life in seconds.
   * @param {number} [config.lifeVar=0.3] - Life variation.
   * @param {number} [config.size=4] - Base size in pixels.
   * @param {number} [config.sizeVar=0.5]
   * @param {number[]} [config.color=[1,1,1,1]] - Base RGBA.
   * @param {number[]} [config.colorVar=[0,0,0,0]] - Per-channel variation.
   * @param {number} [config.gravity=0]
   * @param {number} [config.drag=0]
   * @param {number} [config.rotSpeed=0]
   * @returns {number[]} Spawned particle indices.
   */
  emit(config) {
    const count = config.count || 10;
    const spawned = [];

    for (let i = 0; i < count; i++) {
      if (this.activeCount >= this.maxParticles) break;

      const idx = this._allocIndex();
      if (idx < 0) break;

      const speed = (config.speed || 50) * (1 + (Math.random() - 0.5) * (config.speedVar || 0.5));
      const angle = (config.angle || 0) + (Math.random() - 0.5) * (config.angleSpread || Math.PI * 2);

      this.posX[idx] = (config.x || 0) + (Math.random() - 0.5) * 10;
      this.posY[idx] = (config.y || 0) + (Math.random() - 0.5) * 10;
      this.velX[idx] = Math.cos(angle) * speed;
      this.velY[idx] = Math.sin(angle) * speed;
      this.life[idx] = (config.life || 1) * (1 + (Math.random() - 0.5) * (config.lifeVar || 0.3));
      this.maxLife[idx] = this.life[idx];
      this.size[idx] = (config.size || 4) * (1 + (Math.random() - 0.5) * (config.sizeVar || 0.5));
      this.rotation[idx] = Math.random() * Math.PI * 2;
      this.rotSpeed[idx] = config.rotSpeed || 0;
      this.gravity[idx] = config.gravity || 0;
      this.drag[idx] = config.drag || 0;

      const c = config.color || [1, 1, 1, 1];
      const cv = config.colorVar || [0, 0, 0, 0];
      this.colorR[idx] = Math.max(0, Math.min(1, c[0] + (Math.random() - 0.5) * cv[0]));
      this.colorG[idx] = Math.max(0, Math.min(1, c[1] + (Math.random() - 0.5) * cv[1]));
      this.colorB[idx] = Math.max(0, Math.min(1, c[2] + (Math.random() - 0.5) * cv[2]));
      this.colorA[idx] = Math.max(0, Math.min(1, c[3] + (Math.random() - 0.5) * cv[3]));

      spawned.push(idx);
    }

    return spawned;
  }

  /**
   * Allocate a particle index from the free list.
   * @returns {number}
   */
  _allocIndex() {
    if (this.freeList.length > 0) {
      this.activeCount++;
      return this.freeList.pop();
    }
    return -1;
  }

  /**
   * Free a particle index back to the pool.
   * @param {number} idx
   */
  _freeIndex(idx) {
    this.life[idx] = 0;
    this.freeList.push(idx);
    this.activeCount--;
  }

  // ─── Simulation ────────────────────────────────────────────────────────────

  /**
   * Update all particles: position, velocity, life.
   * @param {number} dt - Delta time in seconds.
   */
  update(dt) {
    let active = 0;
    for (let i = 0; i < this.maxParticles; i++) {
      if (this.life[i] <= 0) continue;

      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this._freeIndex(i);
        continue;
      }

      // Apply velocity
      this.posX[i] += this.velX[i] * dt;
      this.posY[i] += this.velY[i] * dt;

      // Apply gravity
      this.velY[i] += this.gravity[i] * dt;

      // Apply drag
      const drag = this.drag[i];
      if (drag > 0) {
        this.velX[i] *= 1 - drag * dt;
        this.velY[i] *= 1 - drag * dt;
      }

      // Rotation
      this.rotation[i] += this.rotSpeed[i] * dt;

      active++;
    }
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  /**
   * Render all active particles.
   * @param {Float32Array} viewMatrix - 4x4 view matrix.
   * @param {Float32Array} projMatrix - 4x4 projection matrix.
   * @param {boolean} [useSparkle=false] - Use sparkle shader variant.
   */
  render(viewMatrix, projMatrix, useSparkle = false) {
    if (this.activeCount === 0) return;

    const gl = this.gl;
    const program = useSparkle ? this.sparkleProgram : this.program;

    // Build interleaved instance data for active particles
    let writeIdx = 0;
    for (let i = 0; i < this.maxParticles; i++) {
      if (this.life[i] <= 0) continue;

      const lifeRatio = this.life[i] / this.maxLife[i];
      const fadeIn = Math.min(1, (1 - lifeRatio) * 5); // Quick fade in
      const fadeOut = Math.min(1, lifeRatio * 3); // Fade out at end
      const alpha = this.colorA[i] * Math.min(fadeIn, fadeOut);

      const base = writeIdx * 8;
      this.instanceData[base + 0] = this.posX[i];
      this.instanceData[base + 1] = this.posY[i];
      this.instanceData[base + 2] = this.colorR[i];
      this.instanceData[base + 3] = this.colorG[i];
      this.instanceData[base + 4] = this.colorB[i];
      this.instanceData[base + 5] = alpha;
      this.instanceData[base + 6] = this.size[i] * lifeRatio;
      this.instanceData[base + 7] = this.rotation[i];

      writeIdx++;
      if (writeIdx >= this.activeCount) break;
    }

    const instanceCount = writeIdx;
    if (instanceCount === 0) return;

    gl.useProgram(program);

    // Bind quad
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    const posLoc = gl.getAttribLocation(program, 'a_position');
    const tcLoc = gl.getAttribLocation(program, 'a_texCoord');
    if (posLoc >= 0) {
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    }
    if (tcLoc >= 0) {
      gl.enableVertexAttribArray(tcLoc);
      gl.vertexAttribPointer(tcLoc, 2, gl.FLOAT, false, 16, 8);
    }

    // Upload instance data
    const data = this.instanceData.subarray(0, instanceCount * 8);

    // Upload as interleaved buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceOffsetBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

    const offsetLoc = gl.getAttribLocation(program, 'a_offset');
    const colorLoc = gl.getAttribLocation(program, 'a_color');
    const sizeLoc = gl.getAttribLocation(program, 'a_size');
    const rotLoc = gl.getAttribLocation(program, 'a_rotation');

    const stride = 8 * 4;

    if (offsetLoc >= 0) {
      gl.enableVertexAttribArray(offsetLoc);
      gl.vertexAttribPointer(offsetLoc, 2, gl.FLOAT, false, stride, 0);
    }
    if (colorLoc >= 0) {
      gl.enableVertexAttribArray(colorLoc);
      gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, stride, 8);
    }
    if (sizeLoc >= 0) {
      gl.enableVertexAttribArray(sizeLoc);
      gl.vertexAttribPointer(sizeLoc, 1, gl.FLOAT, false, stride, 24);
    }
    if (rotLoc >= 0) {
      gl.enableVertexAttribArray(rotLoc);
      gl.vertexAttribPointer(rotLoc, 1, gl.FLOAT, false, stride, 28);
    }

    // Set instanced attribute divisors if WebGL2
    if (this.isWebGL2) {
      // @ts-ignore
      if (offsetLoc >= 0) gl.vertexAttribDivisor(offsetLoc, 1);
      // @ts-ignore
      if (colorLoc >= 0) gl.vertexAttribDivisor(colorLoc, 1);
      // @ts-ignore
      if (sizeLoc >= 0) gl.vertexAttribDivisor(sizeLoc, 1);
      // @ts-ignore
      if (rotLoc >= 0) gl.vertexAttribDivisor(rotLoc, 1);
    }

    // Set uniforms
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_viewMatrix'), false, viewMatrix);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_projMatrix'), false, projMatrix);
    if (useSparkle) {
      gl.uniform1f(gl.getUniformLocation(program, 'u_time'), performance.now() / 1000);
    }

    // Enable additive blending for particles
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    // Draw
    if (this.isWebGL2) {
      // @ts-ignore
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instanceCount);
    } else {
      // WebGL1 fallback: manual loop
      for (let i = 0; i < instanceCount; i++) {
        const base = i * 8;
        if (offsetLoc >= 0) {
          gl.vertexAttribPointer(offsetLoc, 2, gl.FLOAT, false, stride, base * 4);
        }
        if (colorLoc >= 0) {
          gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, stride, (base + 2) * 4);
        }
        if (sizeLoc >= 0) {
          gl.vertexAttribPointer(sizeLoc, 1, gl.FLOAT, false, stride, (base + 6) * 4);
        }
        if (rotLoc >= 0) {
          gl.vertexAttribPointer(rotLoc, 1, gl.FLOAT, false, stride, (base + 7) * 4);
        }
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
    }

    // Restore blend mode
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  // ─── Legacy Sync ───────────────────────────────────────────────────────────

  /**
   * Sync particles from the game's legacy CPU particle array.
   * @param {Array<Object>} cpuParticles
   * @param {number} dt
   */
  syncFromCPU(cpuParticles, dt) {
    // Clear existing
    for (let i = 0; i < this.maxParticles; i++) {
      if (this.life[i] > 0) {
        this._freeIndex(i);
      }
    }

    // Convert CPU particles to GPU
    for (const pt of cpuParticles) {
      if (this.activeCount >= this.maxParticles) break;
      if (!pt.life || pt.life <= 0) continue;

      const idx = this._allocIndex();
      if (idx < 0) break;

      this.posX[idx] = pt.x || 0;
      this.posY[idx] = pt.y || 0;
      this.velX[idx] = pt.vx || 0;
      this.velY[idx] = pt.vy || 0;
      this.life[idx] = pt.life || 1;
      this.maxLife[idx] = pt.maxLife || pt.life || 1;
      this.size[idx] = pt.size || 4;
      this.rotation[idx] = pt.rotation || 0;
      this.rotSpeed[idx] = pt.rotSpeed || 0;
      this.gravity[idx] = pt.gravity || 0;
      this.drag[idx] = pt.drag || 0;

      // Parse color
      const c = this._parseColor(pt.color || '#ffffff');
      this.colorR[idx] = c[0];
      this.colorG[idx] = c[1];
      this.colorB[idx] = c[2];
      this.colorA[idx] = c[3];
    }
  }

  /**
   * Parse a hex color to RGBA.
   * @param {string} hex
   * @returns {number[]}
   */
  _parseColor(hex) {
    if (hex.startsWith('#')) {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return [r, g, b, 1];
    }
    return [1, 1, 1, 1];
  }

  // ─── Preset Effects ────────────────────────────────────────────────────────

  /**
   * Emit firefly particles.
   * @param {number} count
   * @param {{x1:number,y1:number,x2:number,y2:number}} bounds
   */
  fireflies(count, bounds) {
    for (let i = 0; i < count; i++) {
      const x = bounds.x1 + Math.random() * (bounds.x2 - bounds.x1);
      const y = bounds.y1 + Math.random() * (bounds.y2 - bounds.y1);
      this.emit({
        x, y, count: 1,
        speed: 5 + Math.random() * 15,
        speedVar: 1,
        angle: Math.random() * Math.PI * 2,
        angleSpread: 0.5,
        life: 2 + Math.random() * 4,
        size: 1.5 + Math.random() * 2,
        color: [1, 0.95 + Math.random() * 0.05, 0.7 + Math.random() * 0.2, 0.8],
        colorVar: [0.1, 0.1, 0.1, 0.2],
        drag: 0.1
      });
    }
  }

  /**
   * Emit falling leaf particles.
   * @param {number} count
   * @param {{x1:number,y1:number,x2:number,y2:number}} bounds
   */
  fallingLeaves(count, bounds) {
    for (let i = 0; i < count; i++) {
      const x = bounds.x1 + Math.random() * (bounds.x2 - bounds.x1);
      const y = bounds.y1 + Math.random() * (bounds.y2 - bounds.y1);
      this.emit({
        x, y, count: 1,
        speed: 10 + Math.random() * 20,
        angle: Math.PI * 0.7 + Math.random() * 0.3,
        angleSpread: 0.3,
        life: 3 + Math.random() * 4,
        size: 3 + Math.random() * 4,
        color: [0.6 + Math.random() * 0.4, 0.4 + Math.random() * 0.3, 0.1 + Math.random() * 0.2, 0.8],
        colorVar: [0.1, 0.1, 0.05, 0.1],
        gravity: 10 + Math.random() * 15,
        drag: 0.05,
        rotSpeed: (Math.random() - 0.5) * 4
      });
    }
  }

  /**
   * Emit flickering lamp light particles.
   * @param {number} count
   * @param {Array<{x:number,y:number}>} positions
   */
  flickeringLamps(count, positions) {
    for (const pos of positions) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 20;
        this.emit({
          x: pos.x + Math.cos(angle) * dist,
          y: pos.y + Math.sin(angle) * dist,
          count: 1,
          speed: 2 + Math.random() * 5,
          angle: Math.random() * Math.PI * 2,
          life: 0.3 + Math.random() * 0.8,
          size: 2 + Math.random() * 6,
          color: [1, 0.9, 0.5, 0.4],
          colorVar: [0.1, 0.1, 0.1, 0.2],
          drag: 0.5
        });
      }
    }
  }

  /**
   * Uppercut combat impact effect.
   * @param {number} x
   * @param {number} y
   */
  uppercutImpact(x, y) {
    this.emit({
      x, y, count: 20,
      speed: 80, speedVar: 0.8,
      angle: -Math.PI / 2, angleSpread: 1.0,
      life: 0.5, lifeVar: 0.3,
      size: 4, sizeVar: 0.6,
      color: [1, 0.8, 0.2, 1],
      colorVar: [0.2, 0.2, 0.1, 0],
      gravity: -100,
      drag: 0.3
    });
    // Dust ring
    this.emit({
      x, y: y + 10, count: 15,
      speed: 40, speedVar: 0.5,
      angle: 0, angleSpread: Math.PI * 2,
      life: 0.6, size: 6,
      color: [0.7, 0.65, 0.55, 0.6],
      drag: 0.5
    });
  }

  /**
   * Fart cloud effect (comedy).
   * @param {number} x
   * @param {number} y
   */
  fartCloud(x, y) {
    const colors = [
      [0.4, 0.6, 0.3, 0.7],
      [0.5, 0.7, 0.4, 0.6],
      [0.6, 0.8, 0.5, 0.5]
    ];
    for (let i = 0; i < 12; i++) {
      const c = colors[Math.floor(Math.random() * colors.length)];
      this.emit({
        x: x + (Math.random() - 0.5) * 15,
        y: y + Math.random() * 10,
        count: 1,
        speed: 10 + Math.random() * 20,
        angle: -Math.PI / 2 + (Math.random() - 0.5) * 0.8,
        life: 0.8 + Math.random() * 1.2,
        size: 5 + Math.random() * 10,
        color: c,
        colorVar: [0.05, 0.05, 0.05, 0.1],
        gravity: -15,
        drag: 0.2
      });
    }
  }

  /**
   * Cocktail confetti burst.
   * @param {number} x
   * @param {number} y
   */
  cocktailConfetti(x, y) {
    const colors = [
      [1, 0.2, 0.3, 1], [0.2, 0.6, 1, 1], [1, 0.9, 0.1, 1],
      [0.3, 1, 0.4, 1], [1, 0.5, 0.9, 1], [0.8, 0.3, 1, 1]
    ];
    for (let i = 0; i < 30; i++) {
      const c = colors[i % colors.length];
      this.emit({
        x, y, count: 1,
        speed: 50 + Math.random() * 100,
        angle: Math.random() * Math.PI * 2,
        life: 1 + Math.random() * 2,
        size: 2 + Math.random() * 3,
        color: c,
        colorVar: [0.1, 0.1, 0.1, 0],
        gravity: 50,
        drag: 0.1,
        rotSpeed: (Math.random() - 0.5) * 10
      });
    }
  }

  /**
   * Flower heart particles (romance emote).
   * @param {number} x
   * @param {number} y
   */
  flowerHearts(x, y) {
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.emit({
        x, y, count: 1,
        speed: 20 + Math.random() * 40,
        angle, angleSpread: 0.5,
        life: 1.5 + Math.random() * 2,
        size: 3 + Math.random() * 5,
        color: [1, 0.3 + Math.random() * 0.4, 0.4 + Math.random() * 0.3, 0.9],
        colorVar: [0, 0.1, 0.1, 0.1],
        gravity: -20,
        drag: 0.15,
        rotSpeed: (Math.random() - 0.5) * 3
      });
    }
  }

  /**
   * Kiss trail effect.
   * @param {number} x
   * @param {number} y
   */
  kissTrail(x, y) {
    for (let i = 0; i < 8; i++) {
      this.emit({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 10,
        count: 1,
        speed: 15 + Math.random() * 25,
        angle: -Math.PI / 2 + (Math.random() - 0.5) * 0.5,
        life: 1 + Math.random() * 1.5,
        size: 2 + Math.random() * 3,
        color: [1, 0.5, 0.7, 0.7],
        colorVar: [0, 0.1, 0.1, 0.2],
        gravity: -10,
        drag: 0.2
      });
    }
  }

  /**
   * Chest sparkle effect (reward).
   * @param {number} x
   * @param {number} y
   */
  chestSparkle(x, y) {
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 80;
      this.emit({
        x, y, count: 1,
        speed, speedVar: 0.5,
        angle, angleSpread: 0.2,
        life: 0.8 + Math.random() * 1.5,
        size: 2 + Math.random() * 4,
        color: [1, 0.85 + Math.random() * 0.15, 0.3 + Math.random() * 0.3, 1],
        colorVar: [0, 0.1, 0.1, 0],
        gravity: -30,
        drag: 0.2,
        rotSpeed: Math.random() * 5
      });
    }
  }

  /**
   * Emit a preset effect by type name.
   * @param {string} type - Effect type name.
   * @param {number} x
   * @param {number} y
   * @param {Object} [options]
   */
  emitPreset(type, x, y, options = {}) {
    switch (type) {
      case 'sparkle':
        this.chestSparkle(x, y);
        break;
      case 'heart':
        this.flowerHearts(x, y);
        break;
      case 'uppercut':
        this.uppercutImpact(x, y);
        break;
      case 'fart':
        this.fartCloud(x, y);
        break;
      case 'confetti':
        this.cocktailConfetti(x, y);
        break;
      case 'kiss':
        this.kissTrail(x, y);
        break;
      case 'fireflies':
        this.fireflies(options.count || 20, options.bounds || { x1: x - 200, y1: y - 100, x2: x + 200, y2: y + 100 });
        break;
      case 'leaves':
        this.fallingLeaves(options.count || 10, options.bounds || { x1: x - 300, y1: 0, x2: x + 300, y2: y });
        break;
      default:
        // Generic burst
        this.emit({ x, y, count: options.count || 10, speed: 50, angle: 0, angleSpread: Math.PI * 2 });
    }
  }

  // ─── State Queries ─────────────────────────────────────────────────────────

  /**
   * Get the number of active particles.
   * @returns {number}
   */
  getActiveCount() {
    return this.activeCount;
  }

  /**
   * Get max capacity.
   * @returns {number}
   */
  getCapacity() {
    return this.maxParticles;
  }

  /**
   * Clear all particles.
   */
  clear() {
    for (let i = 0; i < this.maxParticles; i++) {
      if (this.life[i] > 0) {
        this._freeIndex(i);
      }
    }
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  /**
   * Destroy all GPU resources.
   */
  destroy() {
    const gl = this.gl;
    if (this.program) gl.deleteProgram(this.program);
    if (this.sparkleProgram) gl.deleteProgram(this.sparkleProgram);
    if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);
    if (this.instanceOffsetBuffer) gl.deleteBuffer(this.instanceOffsetBuffer);
    if (this.instanceColorBuffer) gl.deleteBuffer(this.instanceColorBuffer);
    if (this.instanceSizeBuffer) gl.deleteBuffer(this.instanceSizeBuffer);
    if (this.instanceRotationBuffer) gl.deleteBuffer(this.instanceRotationBuffer);
  }
}
