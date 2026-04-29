/**
 * @file PostProcess.js
 * @description AAA-grade shader-based post-processing pipeline.
 * Multi-pass effects: bloom (threshold + Gaussian blur), vignette, color grading,
 * film grain, chromatic aberration, and ACES tone mapping.
 * Manages framebuffers for ping-pong rendering.
 */

// ─── Shared Vertex Shader ────────────────────────────────────────────────────

/** Fullscreen quad vertex shader */
const QUAD_VERTEX = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

// ─── Bloom: Bright Pass ──────────────────────────────────────────────────────

/** Extract bright areas for bloom */
const BRIGHT_PASS_FRAGMENT = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_source;
  uniform float u_threshold;
  uniform float u_knee;

  void main() {
    vec4 color = texture2D(u_source, v_texCoord);
    float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
    float soft = brightness - u_threshold + u_knee;
    soft = clamp(soft, 0.0, 2.0 * u_knee);
    soft = soft * soft / (4.0 * u_knee + 0.0001);
    float contrib = max(soft, brightness - u_threshold);
    contrib = clamp(contrib, 0.0, 1.0);
    gl_FragColor = vec4(color.rgb * contrib, color.a);
  }
`;

// ─── Bloom: Gaussian Blur ────────────────────────────────────────────────────

/** Separable Gaussian blur */
const BLUR_FRAGMENT = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_source;
  uniform vec2 u_direction;
  uniform vec2 u_texelSize;

  // 9-tap Gaussian kernel (sigma = 2.0)
  void main() {
    vec4 color = vec4(0.0);
    vec2 off = u_direction * u_texelSize;

    color += texture2D(u_source, v_texCoord - off * 4.0) * 0.0162;
    color += texture2D(u_source, v_texCoord - off * 3.0) * 0.0540;
    color += texture2D(u_source, v_texCoord - off * 2.0) * 0.1216;
    color += texture2D(u_source, v_texCoord - off * 1.0) * 0.1945;
    color += texture2D(u_source, v_texCoord) * 0.2270;
    color += texture2D(u_source, v_texCoord + off * 1.0) * 0.1945;
    color += texture2D(u_source, v_texCoord + off * 2.0) * 0.1216;
    color += texture2D(u_source, v_texCoord + off * 3.0) * 0.0540;
    color += texture2D(u_source, v_texCoord + off * 4.0) * 0.0162;

    gl_FragColor = color;
  }
`;

// ─── Bloom: Composite ────────────────────────────────────────────────────────

/** Add bloom back onto original image */
const BLOOM_COMPOSITE_FRAGMENT = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_source;
  uniform sampler2D u_bloom;
  uniform float u_intensity;

  void main() {
    vec4 base = texture2D(u_source, v_texCoord);
    vec4 bloom = texture2D(u_bloom, v_texCoord);
    gl_FragColor = vec4(base.rgb + bloom.rgb * u_intensity, base.a);
  }
`;

// ─── Vignette ────────────────────────────────────────────────────────────────

/** Edge darkening vignette effect */
const VIGNETTE_FRAGMENT = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_source;
  uniform float u_intensity;
  uniform vec3 u_color;
  uniform vec2 u_center;
  uniform float u_radius;
  uniform float u_smoothness;

  void main() {
    vec4 color = texture2D(u_source, v_texCoord);
    vec2 dist = v_texCoord - u_center;
    float len = length(dist);
    float vignette = smoothstep(u_radius, u_radius - u_smoothness, len);
    vignette = mix(1.0 - u_intensity, 1.0, vignette);
    color.rgb = mix(u_color * (1.0 - u_intensity), color.rgb, vignette);
    gl_FragColor = color;
  }
`;

// ─── Color Grading ───────────────────────────────────────────────────────────

/** Color grading: brightness, contrast, saturation, warmth */
const COLOR_GRADE_FRAGMENT = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_source;
  uniform float u_brightness;
  uniform float u_contrast;
  uniform float u_saturation;
  uniform float u_warmth;

  vec3 adjustBrightness(vec3 c, float v) { return c + v; }
  vec3 adjustContrast(vec3 c, float v) { return (c - 0.5) * (1.0 + v) + 0.5; }
  vec3 adjustSaturation(vec3 c, float v) {
    float gray = dot(c, vec3(0.2126, 0.7152, 0.0722));
    return mix(vec3(gray), c, 1.0 + v);
  }
  vec3 adjustWarmth(vec3 c, float v) {
    c.r += v * 0.08;
    c.b -= v * 0.06;
    return c;
  }

  void main() {
    vec4 color = texture2D(u_source, v_texCoord);
    color.rgb = adjustBrightness(color.rgb, u_brightness);
    color.rgb = adjustContrast(color.rgb, u_contrast);
    color.rgb = adjustSaturation(color.rgb, u_saturation);
    color.rgb = adjustWarmth(color.rgb, u_warmth);
    gl_FragColor = color;
  }
`;

// ─── Film Grain ──────────────────────────────────────────────────────────────

/** Film grain overlay */
const GRAIN_FRAGMENT = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_source;
  uniform float u_intensity;
  uniform float u_time;
  uniform vec2 u_resolution;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec4 color = texture2D(u_source, v_texCoord);
    vec2 pixel = v_texCoord * u_resolution;
    float noise = hash(pixel + u_time * 100.0) * 2.0 - 1.0;
    color.rgb += noise * u_intensity;
    gl_FragColor = color;
  }
`;

// ─── ACES Tone Mapping ───────────────────────────────────────────────────────

/** ACES filmic tone mapping + gamma correction */
const TONE_MAP_FRAGMENT = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_source;
  uniform float u_exposure;

  vec3 acesToneMap(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  vec3 gammaCorrect(vec3 x) {
    return pow(x, vec3(1.0 / 2.2));
  }

  void main() {
    vec4 color = texture2D(u_source, v_texCoord);
    color.rgb *= u_exposure;
    color.rgb = acesToneMap(color.rgb);
    color.rgb = gammaCorrect(color.rgb);
    gl_FragColor = color;
  }
`;

// ─── Chromatic Aberration ────────────────────────────────────────────────────

/** Subtle RGB channel separation */
const CHROMATIC_FRAGMENT = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_source;
  uniform float u_intensity;
  uniform vec2 u_center;

  void main() {
    vec2 dir = v_texCoord - u_center;
    float dist = length(dir);
    vec2 offset = dir * u_intensity * dist;
    float r = texture2D(u_source, v_texCoord + offset * 1.0).r;
    float g = texture2D(u_source, v_texCoord + offset * 0.5).g;
    float b = texture2D(u_source, v_texCoord - offset * 0.5).b;
    gl_FragColor = vec4(r, g, b, 1.0);
  }
`;

// ─── Final Composite ─────────────────────────────────────────────────────────

/** Final pass combining all effects */
const FINAL_COMPOSITE_FRAGMENT = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_source;
  uniform sampler2D u_bloom;
  uniform float u_bloomIntensity;
  uniform float u_vignetteIntensity;
  uniform vec3 u_vignetteColor;
  uniform float u_brightness;
  uniform float u_contrast;
  uniform float u_saturation;
  uniform float u_warmth;
  uniform float u_grainIntensity;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_exposure;

  // ACES tone mapping
  vec3 acesToneMap(vec3 x) {
    float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }
  vec3 gammaCorrect(vec3 x) { return pow(x, vec3(1.0 / 2.2)); }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  vec3 adjustBrightness(vec3 c, float v) { return c + v; }
  vec3 adjustContrast(vec3 c, float v) { return (c - 0.5) * (1.0 + v) + 0.5; }
  vec3 adjustSaturation(vec3 c, float v) {
    float gray = dot(c, vec3(0.2126, 0.7152, 0.0722));
    return mix(vec3(gray), c, 1.0 + v);
  }
  vec3 adjustWarmth(vec3 c, float v) {
    c.r += v * 0.08; c.b -= v * 0.06; return c;
  }

  void main() {
    // Sample source
    vec4 color = texture2D(u_source, v_texCoord);

    // Add bloom
    if (u_bloomIntensity > 0.0) {
      vec4 bloom = texture2D(u_bloom, v_texCoord);
      color.rgb += bloom.rgb * u_bloomIntensity;
    }

    // Color grading
    color.rgb = adjustBrightness(color.rgb, u_brightness);
    color.rgb = adjustContrast(color.rgb, u_contrast);
    color.rgb = adjustSaturation(color.rgb, u_saturation);
    color.rgb = adjustWarmth(color.rgb, u_warmth);

    // Vignette
    vec2 dist = v_texCoord - vec2(0.5);
    float len = length(dist);
    float vignette = smoothstep(0.75, 0.3, len);
    vignette = mix(1.0 - u_vignetteIntensity, 1.0, vignette);
    color.rgb *= vignette;
    color.rgb = mix(u_vignetteColor * (1.0 - u_vignetteIntensity), color.rgb, vignette);

    // Film grain
    if (u_grainIntensity > 0.0) {
      vec2 pixel = v_texCoord * u_resolution;
      float noise = hash(pixel + u_time * 100.0) * 2.0 - 1.0;
      color.rgb += noise * u_grainIntensity;
    }

    // ACES tone mapping + gamma
    color.rgb *= u_exposure;
    color.rgb = acesToneMap(color.rgb);
    color.rgb = gammaCorrect(color.rgb);

    gl_FragColor = color;
  }
`;

// ─── PostProcess ─────────────────────────────────────────────────────────────

/**
 * Multi-pass post-processing pipeline.
 * Manages framebuffers for bloom extraction, blur passes, and final composite.
 * @export {PostProcess}
 */
export class PostProcess {
  /**
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
   * @param {number} width
   * @param {number} height
   */
  constructor(gl, width, height) {
    /** @type {WebGLRenderingContext|WebGL2RenderingContext} */
    this.gl = gl;
    /** @type {number} */
    this.width = width;
    /** @type {number} */
    this.height = height;

    // Compile all shader programs
    /** @type {WebGLProgram|null} */
    this.brightProgram = this._compileProgram(BRIGHT_PASS_FRAGMENT);
    /** @type {WebGLProgram|null} */
    this.blurProgram = this._compileProgram(BLUR_FRAGMENT);
    /** @type {WebGLProgram|null} */
    this.compositeProgram = this._compileProgram(FINAL_COMPOSITE_FRAGMENT);
    /** @type {WebGLProgram|null} */
    this.vignetteProgram = this._compileProgram(VIGNETTE_FRAGMENT);
    /** @type {WebGLProgram|null} */
    this.colorGradeProgram = this._compileProgram(COLOR_GRADE_FRAGMENT);
    /** @type {WebGLProgram|null} */
    this.grainProgram = this._compileProgram(GRAIN_FRAGMENT);
    /** @type {WebGLProgram|null} */
    this.toneMapProgram = this._compileProgram(TONE_MAP_FRAGMENT);
    /** @type {WebGLProgram|null} */
    this.chromaticProgram = this._compileProgram(CHROMATIC_FRAGMENT);

    // Fullscreen quad buffer
    /** @type {WebGLBuffer|null} */
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 0, 1,   1, -1, 1, 1,   -1, 1, 0, 0,
      -1, 1, 0, 0,    1, -1, 1, 1,    1, 1, 1, 0
    ]), gl.STATIC_DRAW);

    // Framebuffers for multi-pass rendering
    /** @type {WebGLFramebuffer|null} */
    this.mainFBO = null;
    /** @type {WebGLTexture|null} */
    this.mainTexture = null;

    // Bloom ping-pong FBOs (half resolution)
    /** @type {WebGLFramebuffer|null} */
    this.bloomFBO0 = null;
    /** @type {WebGLTexture|null} */
    this.bloomTex0 = null;
    /** @type {WebGLFramebuffer|null} */
    this.bloomFBO1 = null;
    /** @type {WebGLTexture|null} */
    this.bloomTex1 = null;

    this._createFramebuffers(width, height);

    // Effect parameters
    /** @type {Object} */
    this.params = {
      vignetteIntensity: 0.45,
      vignetteColor: [0.04, 0.02, 0.08],
      bloomIntensity: 0.3,
      bloomThreshold: 0.7,
      bloomKnee: 0.3,
      brightness: 0.02,
      contrast: 0.05,
      saturation: 0.1,
      warmth: 0.15,
      grainIntensity: 0.04,
      exposure: 1.0,
      chromaticIntensity: 0.003
    };

    /** @type {number} Accumulated time for animated effects. */
    this.time = 0;

    /** @type {boolean} Enable all post-processing. */
    this.enabled = true;

    /** @type {number} Number of blur passes. */
    this.blurPasses = 2;
  }

  // ─── Shader Compilation ────────────────────────────────────────────────────

  /**
   * Compile a fragment shader against the shared vertex shader.
   * @param {string} fsSource
   * @returns {WebGLProgram|null}
   */
  _compileProgram(fsSource) {
    const gl = this.gl;
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, QUAD_VERTEX);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('VS compile error:', gl.getShaderInfoLog(vs));
      return null;
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('FS compile error:', gl.getShaderInfoLog(fs));
      return null;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(prog));
      return null;
    }
    return prog;
  }

  // ─── Framebuffer Management ────────────────────────────────────────────────

  /**
   * Create all framebuffers and textures.
   * @param {number} w
   * @param {number} h
   */
  _createFramebuffers(w, h) {
    const gl = this.gl;

    // Main scene FBO
    this.mainTexture = this._createTexture(w, h);
    this.mainFBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.mainFBO);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.mainTexture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Bloom FBOs (half res)
    const bw = Math.floor(w / 2);
    const bh = Math.floor(h / 2);
    this.bloomTex0 = this._createTexture(bw, bh);
    this.bloomFBO0 = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFBO0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.bloomTex0, 0);

    this.bloomTex1 = this._createTexture(bw, bh);
    this.bloomFBO1 = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFBO1);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.bloomTex1, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Create a float RGBA texture.
   * @param {number} w
   * @param {number} h
   * @returns {WebGLTexture}
   */
  _createTexture(w, h) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  /**
   * Resize all framebuffers.
   * @param {number} w
   * @param {number} h
   */
  resize(w, h) {
    this.width = w;
    this.height = h;
    // Destroy old framebuffers
    const gl = this.gl;
    if (this.mainFBO) gl.deleteFramebuffer(this.mainFBO);
    if (this.mainTexture) gl.deleteTexture(this.mainTexture);
    if (this.bloomFBO0) gl.deleteFramebuffer(this.bloomFBO0);
    if (this.bloomTex0) gl.deleteTexture(this.bloomTex0);
    if (this.bloomFBO1) gl.deleteFramebuffer(this.bloomFBO1);
    if (this.bloomTex1) gl.deleteTexture(this.bloomTex1);
    this._createFramebuffers(w, h);
  }

  // ─── Bind & Draw Helpers ───────────────────────────────────────────────────

  /**
   * Bind the fullscreen quad and set up attribute pointers.
   * @param {WebGLProgram} program
   */
  _bindQuad(program) {
    const gl = this.gl;
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
  }

  /**
   * Draw the fullscreen quad.
   */
  _drawQuad() {
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
  }

  /**
   * Bind a texture to a sampler unit.
   * @param {number} unit
   * @param {WebGLTexture} texture
   * @param {WebGLUniformLocation} loc
   */
  _bindTexture(unit, texture, loc) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(loc, unit);
  }

  // ─── Main Render ───────────────────────────────────────────────────────────

  /**
   * Render the full post-processing pipeline.
   * Multi-pass: extract bloom -> blur -> composite -> color grade -> vignette -> grain -> tone map.
   * @param {WebGLTexture|null} sourceTexture - The rendered scene texture. If null, renders from current framebuffer.
   * @param {number} [dt=0.016] - Delta time for animated effects.
   */
  render(sourceTexture, dt = 0.016) {
    if (!this.enabled) return;
    this.time += dt;
    const gl = this.gl;

    const srcTex = sourceTexture || this.mainTexture;
    if (!srcTex) return;

    // 1. Bright pass: extract bright areas for bloom
    if (this.params.bloomIntensity > 0) {
      this._brightPass(srcTex);

      // 2. Blur bright areas (ping-pong between bloom FBOs)
      for (let i = 0; i < this.blurPasses; i++) {
        this._blurPass(this.bloomFBO0, this.bloomTex1, [1, 0]); // Horizontal
        this._blurPass(this.bloomFBO1, this.bloomTex0, [0, 1]); // Vertical
      }
    }

    // 3. Final composite: source + bloom + color grade + vignette + grain + tone map
    this._finalComposite(srcTex);
  }

  // ─── Individual Passes ─────────────────────────────────────────────────────

  /**
   * Brightness threshold pass.
   * @param {WebGLTexture} source
   */
  _brightPass(source) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFBO0);
    gl.viewport(0, 0, Math.floor(this.width / 2), Math.floor(this.height / 2));
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.brightProgram);
    this._bindQuad(this.brightProgram);
    this._bindTexture(0, source, gl.getUniformLocation(this.brightProgram, 'u_source'));
    gl.uniform1f(gl.getUniformLocation(this.brightProgram, 'u_threshold'), this.params.bloomThreshold);
    gl.uniform1f(gl.getUniformLocation(this.brightProgram, 'u_knee'), this.params.bloomKnee);
    this._drawQuad();
  }

  /**
   * Gaussian blur pass.
   * @param {WebGLFramebuffer} targetFBO
   * @param {WebGLTexture} sourceTex
   * @param {number[]} direction - [dx, dy]
   */
  _blurPass(targetFBO, sourceTex, direction) {
    const gl = this.gl;
    const isHorizontal = direction[0] > 0;
    const w = isHorizontal ? Math.floor(this.width / 2) : Math.floor(this.width / 2);
    const h = isHorizontal ? Math.floor(this.height / 2) : Math.floor(this.height / 2);

    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);
    gl.viewport(0, 0, w, h);

    gl.useProgram(this.blurProgram);
    this._bindQuad(this.blurProgram);
    this._bindTexture(0, sourceTex, gl.getUniformLocation(this.blurProgram, 'u_source'));
    gl.uniform2f(gl.getUniformLocation(this.blurProgram, 'u_direction'), direction[0], direction[1]);
    gl.uniform2f(gl.getUniformLocation(this.blurProgram, 'u_texelSize'), 1.0 / w, 1.0 / h);
    this._drawQuad();
  }

  /**
   * Final composite pass rendering to screen.
   * @param {WebGLTexture} sourceTex
   */
  _finalComposite(sourceTex) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);

    gl.useProgram(this.compositeProgram);
    this._bindQuad(this.compositeProgram);

    // Source
    this._bindTexture(0, sourceTex, gl.getUniformLocation(this.compositeProgram, 'u_source'));
    // Bloom
    this._bindTexture(1, this.bloomTex0, gl.getUniformLocation(this.compositeProgram, 'u_bloom'));

    // Bloom params
    gl.uniform1f(gl.getUniformLocation(this.compositeProgram, 'u_bloomIntensity'), this.params.bloomIntensity);

    // Vignette params
    gl.uniform1f(gl.getUniformLocation(this.compositeProgram, 'u_vignetteIntensity'), this.params.vignetteIntensity);
    gl.uniform3f(gl.getUniformLocation(this.compositeProgram, 'u_vignetteColor'),
      this.params.vignetteColor[0], this.params.vignetteColor[1], this.params.vignetteColor[2]);

    // Color grading
    gl.uniform1f(gl.getUniformLocation(this.compositeProgram, 'u_brightness'), this.params.brightness);
    gl.uniform1f(gl.getUniformLocation(this.compositeProgram, 'u_contrast'), this.params.contrast);
    gl.uniform1f(gl.getUniformLocation(this.compositeProgram, 'u_saturation'), this.params.saturation);
    gl.uniform1f(gl.getUniformLocation(this.compositeProgram, 'u_warmth'), this.params.warmth);

    // Grain
    gl.uniform1f(gl.getUniformLocation(this.compositeProgram, 'u_grainIntensity'), this.params.grainIntensity);
    gl.uniform1f(gl.getUniformLocation(this.compositeProgram, 'u_time'), this.time);
    gl.uniform2f(gl.getUniformLocation(this.compositeProgram, 'u_resolution'), this.width, this.height);

    // Tone mapping
    gl.uniform1f(gl.getUniformLocation(this.compositeProgram, 'u_exposure'), this.params.exposure);

    this._drawQuad();
  }

  // ─── Effect Parameter Setters ──────────────────────────────────────────────

  /**
   * Set vignette parameters.
   * @param {number} intensity - 0 to 1, edge darkening strength.
   * @param {number[]} color - RGB tint for vignette.
   * @param {number} radius - Inner radius where effect starts.
   * @param {number} smoothness - Edge falloff smoothness.
   */
  setVignette(intensity, color = [0.04, 0.02, 0.08], radius = 0.5, smoothness = 0.45) {
    this.params.vignetteIntensity = intensity;
    this.params.vignetteColor = color;
  }

  /**
   * Set bloom parameters.
   * @param {number} intensity - Bloom add strength.
   * @param {number} threshold - Brightness threshold for bloom extraction.
   * @param {number} knee - Soft threshold knee.
   */
  setBloom(intensity, threshold = 0.7, knee = 0.3) {
    this.params.bloomIntensity = intensity;
    this.params.bloomThreshold = threshold;
    this.params.bloomKnee = knee;
  }

  /**
   * Set color grading parameters.
   * @param {number} brightness - Offset (-1 to 1).
   * @param {number} contrast - Multiplier offset (-1 to 1).
   * @param {number} saturation - Saturation multiplier (-1 to 1).
   * @param {number} warmth - Warmth adjustment (-1 to 1).
   */
  setColorGrade(brightness, contrast, saturation, warmth) {
    this.params.brightness = brightness;
    this.params.contrast = contrast;
    this.params.saturation = saturation;
    this.params.warmth = warmth;
  }

  /**
   * Set film grain intensity.
   * @param {number} intensity - 0 to 1.
   */
  setGrain(intensity) {
    this.params.grainIntensity = intensity;
  }

  /**
   * Set exposure for tone mapping.
   * @param {number} exposure
   */
  setExposure(exposure) {
    this.params.exposure = exposure;
  }

  /**
   * Set chromatic aberration intensity.
   * @param {number} intensity
   */
  setChromatic(intensity) {
    this.params.chromaticIntensity = intensity;
  }

  // ─── Preset Configurations ─────────────────────────────────────────────────

  /**
   * Apply a cozy warm preset suitable for Starlight Inn.
   */
  applyCozyPreset() {
    this.params = {
      vignetteIntensity: 0.5,
      vignetteColor: [0.06, 0.03, 0.1],
      bloomIntensity: 0.25,
      bloomThreshold: 0.65,
      bloomKnee: 0.25,
      brightness: 0.0,
      contrast: 0.08,
      saturation: 0.15,
      warmth: 0.2,
      grainIntensity: 0.04,
      exposure: 1.1,
      chromaticIntensity: 0.002
    };
  }

  /**
   * Apply a cinematic preset with stronger effects.
   */
  applyCinematicPreset() {
    this.params = {
      vignetteIntensity: 0.7,
      vignetteColor: [0.02, 0.01, 0.06],
      bloomIntensity: 0.45,
      bloomThreshold: 0.55,
      bloomKnee: 0.3,
      brightness: -0.02,
      contrast: 0.15,
      saturation: 0.05,
      warmth: 0.1,
      grainIntensity: 0.06,
      exposure: 1.0,
      chromaticIntensity: 0.004
    };
  }

  /**
   * Apply a minimal preset for performance.
   */
  applyLowPreset() {
    this.params = {
      vignetteIntensity: 0.25,
      vignetteColor: [0.04, 0.02, 0.08],
      bloomIntensity: 0.0,
      bloomThreshold: 1.0,
      bloomKnee: 0.0,
      brightness: 0.0,
      contrast: 0.0,
      saturation: 0.0,
      warmth: 0.05,
      grainIntensity: 0.0,
      exposure: 1.0,
      chromaticIntensity: 0.0
    };
    this.blurPasses = 1;
  }

  /**
   * Disable all post-processing.
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Enable post-processing.
   */
  enable() {
    this.enabled = true;
  }

  // ─── Scene FBO Access ──────────────────────────────────────────────────────

  /**
   * Get the main scene framebuffer for rendering into.
   * @returns {WebGLFramebuffer|null}
   */
  getSceneFBO() {
    return this.mainFBO;
  }

  /**
   * Get the scene texture after rendering.
   * @returns {WebGLTexture|null}
   */
  getSceneTexture() {
    return this.mainTexture;
  }

  /**
   * Begin rendering to the scene FBO.
   */
  beginScenePass() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.mainFBO);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /**
   * End scene rendering, ready for post-processing.
   */
  endScenePass() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  /**
   * Destroy all GPU resources.
   */
  destroy() {
    const gl = this.gl;
    const programs = [
      this.brightProgram, this.blurProgram, this.compositeProgram,
      this.vignetteProgram, this.colorGradeProgram, this.grainProgram,
      this.toneMapProgram, this.chromaticProgram
    ];
    for (const p of programs) {
      if (p) gl.deleteProgram(p);
    }
    if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);
    if (this.mainFBO) gl.deleteFramebuffer(this.mainFBO);
    if (this.mainTexture) gl.deleteTexture(this.mainTexture);
    if (this.bloomFBO0) gl.deleteFramebuffer(this.bloomFBO0);
    if (this.bloomTex0) gl.deleteTexture(this.bloomTex0);
    if (this.bloomFBO1) gl.deleteFramebuffer(this.bloomFBO1);
    if (this.bloomTex1) gl.deleteTexture(this.bloomTex1);
  }
}
