/**
 * SpriteSheet.js — Starlight Inn v6.0
 * Sprite sheet composition system for packing multiple frames into a single
 * canvas texture atlas. Supports grid packing, animation sequences, metadata
 * export/import, and direct canvas drawImage rendering from the packed sheet.
 *
 * All coordinates are integers. Pixel-art crispness is maintained via
 * imageSmoothingEnabled=false on the packed sheet context.
 *
 * @module sprites/SpriteSheet
 * @version 6.0.0
 * @author Starlight Inn Team
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum texture atlas dimension in pixels. */
const MAX_ATLAS_SIZE = 2048;
/** Default padding between frames in the atlas (px). */
const DEFAULT_PADDING = 2;
/** Minimum atlas dimension in pixels. */
const MIN_ATLAS_SIZE = 64;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Compute the next power of two >= n.
 *
 * @param {number} n
 * @returns {number}
 */
function _nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * Round a number up to the nearest multiple of m.
 *
 * @param {number} n
 * @param {number} m
 * @returns {number}
 */
function _roundUp(n, m) {
  return Math.ceil(n / m) * m;
}

/**
 * Create an off-screen canvas with pixel-art settings.
 *
 * @param {number} width
 * @param {number} height
 * @returns {HTMLCanvasElement}
 */
function _createCanvas(width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.mozImageSmoothingEnabled = false;
  ctx.webkitImageSmoothingEnabled = false;
  ctx.msImageSmoothingEnabled = false;
  return c;
}

/**
 * Get a 2D context from a canvas with pixel-art settings.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {CanvasRenderingContext2D}
 */
function _getCtx(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.mozImageSmoothingEnabled = false;
  ctx.webkitImageSmoothingEnabled = false;
  ctx.msImageSmoothingEnabled = false;
  return ctx;
}

// =============================================================================
// SPRITE SHEET CLASS
// =============================================================================

/**
 * Represents a packed sprite sheet (texture atlas).
 * Frames are arranged in a grid with configurable padding.
 * Supports animation sequences and metadata export.
 */
export class SpriteSheet {
  /**
   * @param {Object} [options]
   * @param {number} [options.padding=2] - Pixel padding between frames
   * @param {boolean} [options.pow2=false] - Round atlas size to power of two
   * @param {number} [options.maxSize=2048] - Maximum atlas dimension
   * @param {string} [options.name='sheet'] - Atlas name for metadata
   */
  constructor(options = {}) {
    /** @type {string} */
    this.name = options.name || 'sheet';
    /** @type {number} */
    this.padding = options.padding != null ? options.padding : DEFAULT_PADDING;
    /** @type {boolean} */
    this.pow2 = !!options.pow2;
    /** @type {number} */
    this.maxSize = options.maxSize || MAX_ATLAS_SIZE;

    /** @type {Map<string, {canvas:HTMLCanvasElement, width:number, height:number, anchorX:number, anchorY:number, hitW:number, hitH:number}>} */
    this._frames = new Map();

    /** @type {Map<string, string[]>} Animation name -> ordered frame id list. */
    this._animations = new Map();

    /** @type {HTMLCanvasElement|null} Packed atlas canvas. */
    this._sheetCanvas = null;
    /** @type {CanvasRenderingContext2D|null} Atlas context. */
    this._sheetCtx = null;

    /**
     * Atlas layout metadata: id -> {x, y, width, height, anchorX, anchorY, hitW, hitH}.
     * @type {Object<string, {x:number, y:number, width:number, height:number, anchorX:number, anchorY:number, hitW:number, hitH:number}>}
     */
    this._atlas = {};

    /** @type {number} Current atlas width. */
    this._sheetW = 0;
    /** @type {number} Current atlas height. */
    this._sheetH = 0;

    /** @type {boolean} Whether the atlas needs repacking. */
    this._dirty = true;

    // Animation playback state
    /** @type {string|null} Currently playing animation name. */
    this._currentAnim = null;
    /** @type {number} Current frame index within the animation. */
    this._animFrame = 0;
    /** @type {number} Accumulated time for animation timing. */
    this._animTime = 0;
    /** @type {number} Default frame duration in ms. */
    this._frameDuration = 150;
    /** @type {boolean} Whether the current animation loops. */
    this._animLoop = true;
  }

  // ==========================================================================
  // FRAME MANAGEMENT
  // ==========================================================================

  /**
   * Add a sprite frame to the sheet.
   *
   * @param {string} id - Unique frame identifier
   * @param {HTMLCanvasElement} canvas - Source canvas/image
   * @param {{anchorX?:number, anchorY?:number, hitW?:number, hitH?:number}} [meta] - Optional frame metadata
   * @returns {SpriteSheet} this (for chaining)
   */
  addFrame(id, canvas, meta = {}) {
    const width = canvas.width;
    const height = canvas.height;
    const anchorX = meta.anchorX != null ? meta.anchorX : Math.floor(width / 2);
    const anchorY = meta.anchorY != null ? meta.anchorY : 0;
    const hitW = meta.hitW != null ? meta.hitW : width;
    const hitH = meta.hitH != null ? meta.hitH : height;

    this._frames.set(id, {
      canvas,
      width,
      height,
      anchorX,
      anchorY,
      hitW,
      hitH
    });

    this._dirty = true;
    return this;
  }

  /**
   * Remove a frame from the sheet.
   *
   * @param {string} id
   * @returns {boolean} true if removed
   */
  removeFrame(id) {
    const removed = this._frames.delete(id);
    if (removed) {
      // Clean up animation references
      for (const [name, ids] of this._animations) {
        const filtered = ids.filter(fid => fid !== id);
        if (filtered.length !== ids.length) {
          this._animations.set(name, filtered);
        }
      }
      this._dirty = true;
    }
    return removed;
  }

  /**
   * Check if a frame id exists.
   *
   * @param {string} id
   * @returns {boolean}
   */
  hasFrame(id) {
    return this._frames.has(id);
  }

  /**
   * Get the count of registered frames.
   *
   * @returns {number}
   */
  getFrameCount() {
    return this._frames.size;
  }

  /**
   * Get all registered frame ids.
   *
   * @returns {string[]}
   */
  getFrameIds() {
    return Array.from(this._frames.keys());
  }

  // ==========================================================================
  // PACKING
  // ==========================================================================

  /**
   * Arrange all frames in a grid layout and generate the atlas.
   * Computes the tightest power-of-two (or exact-fit) sheet size.
   *
   * @param {{cellWidth?:number, cellHeight?:number}} [options] - Force uniform cell size
   * @returns {{width:number, height:number, count:number}} Sheet dimensions and frame count
   */
  pack(options = {}) {
    if (this._frames.size === 0) {
      this._sheetCanvas = _createCanvas(MIN_ATLAS_SIZE, MIN_ATLAS_SIZE);
      this._sheetCtx = _getCtx(this._sheetCanvas);
      this._sheetW = MIN_ATLAS_SIZE;
      this._sheetH = MIN_ATLAS_SIZE;
      this._atlas = {};
      this._dirty = false;
      return { width: this._sheetW, height: this._sheetH, count: 0 };
    }

    // Compute cell dimensions
    let maxW = 0;
    let maxH = 0;
    const entries = [];
    for (const [id, frame] of this._frames) {
      const w = frame.width + this.padding * 2;
      const h = frame.height + this.padding * 2;
      if (w > maxW) maxW = w;
      if (h > maxH) maxH = h;
      entries.push({ id, frame, w, h });
    }

    const cellW = options.cellWidth ? options.cellWidth + this.padding * 2 : maxW;
    const cellH = options.cellHeight ? options.cellHeight + this.padding * 2 : maxH;

    // Determine grid columns that fit within maxSize
    const cols = Math.max(1, Math.floor(this.maxSize / cellW));
    const rows = Math.ceil(entries.length / cols);

    let sheetW = cols * cellW;
    let sheetH = rows * cellH;

    if (this.pow2) {
      sheetW = _nextPow2(sheetW);
      sheetH = _nextPow2(sheetH);
    }

    // Clamp to maxSize
    sheetW = Math.min(sheetW, this.maxSize);
    sheetH = Math.min(sheetH, this.maxSize);

    // Grow if needed (for non-uniform packing)
    if (!options.cellWidth || !options.cellHeight) {
      // Tighter packing: try to fit in rows with variable widths
      // Fallback to simple grid if too complex
      const neededW = Math.min(cols * cellW, this.maxSize);
      const neededH = Math.min(rows * cellH, this.maxSize);
      sheetW = Math.max(sheetW, neededW);
      sheetH = Math.max(sheetH, neededH);
    }

    // Create atlas canvas
    this._sheetCanvas = _createCanvas(sheetW, sheetH);
    this._sheetCtx = _getCtx(this._sheetCanvas);
    this._sheetW = sheetW;
    this._sheetH = sheetH;

    // Clear to transparent
    this._sheetCtx.clearRect(0, 0, sheetW, sheetH);

    // Place frames in grid
    this._atlas = {};
    let col = 0;
    let row = 0;
    for (const entry of entries) {
      const { id, frame } = entry;
      const px = col * cellW + this.padding;
      const py = row * cellH + this.padding;

      // Draw frame onto sheet
      this._sheetCtx.drawImage(frame.canvas, px, py);

      this._atlas[id] = {
        x: px,
        y: py,
        width: frame.width,
        height: frame.height,
        anchorX: frame.anchorX,
        anchorY: frame.anchorY,
        hitW: frame.hitW,
        hitH: frame.hitH
      };

      col++;
      if (col >= cols) {
        col = 0;
        row++;
      }
    }

    this._dirty = false;
    return { width: sheetW, height: sheetH, count: entries.length };
  }

  /**
   * Ensure the atlas is packed. Auto-packs if dirty.
   *
   * @private
   */
  _ensurePacked() {
    if (this._dirty) {
      this.pack();
    }
  }

  // ==========================================================================
  // ATLAS QUERIES
  // ==========================================================================

  /**
   * Get atlas metadata for a specific frame.
   *
   * @param {string} id
   * @returns {{x:number, y:number, width:number, height:number, anchorX:number, anchorY:number, hitW:number, hitH:number}|null}
   */
  getFrame(id) {
    this._ensurePacked();
    return this._atlas[id] || null;
  }

  /**
   * Get the raw atlas metadata object.
   *
   * @returns {Object<string, {x:number, y:number, width:number, height:number, anchorX:number, anchorY:number, hitW:number, hitH:number}>}
   */
  getAtlas() {
    this._ensurePacked();
    return { ...this._atlas };
  }

  /**
   * Get the packed sheet canvas.
   *
   * @returns {HTMLCanvasElement|null}
   */
  getSheet() {
    this._ensurePacked();
    return this._sheetCanvas;
  }

  // ==========================================================================
  // DRAWING
  // ==========================================================================

  /**
   * Draw a specific frame from the sheet onto a rendering context.
   * Uses the frame's anchor point as the draw origin.
   *
   * @param {CanvasRenderingContext2D} ctx - Target rendering context
   * @param {string} id - Frame id
   * @param {number} screenX - Screen X destination (anchorX aligned)
   * @param {number} screenY - Screen Y destination (anchorY aligned)
   * @param {{scale?:number, flipX?:boolean, flipY?:boolean, alpha?:number}} [options]
   */
  drawFrame(ctx, id, screenX, screenY, options = {}) {
    this._ensurePacked();
    const info = this._atlas[id];
    if (!info) return;

    const scale = options.scale || 1;
    const flipX = !!options.flipX;
    const flipY = !!options.flipY;
    const alpha = options.alpha != null ? options.alpha : 1;

    ctx.save();
    ctx.globalAlpha = alpha;

    const destX = screenX - info.anchorX * scale;
    const destY = screenY - info.anchorY * scale;
    const destW = info.width * scale;
    const destH = info.height * scale;

    if (flipX || flipY) {
      ctx.translate(screenX, screenY);
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      ctx.translate(-screenX, -screenY);
    }

    ctx.drawImage(
      this._sheetCanvas,
      info.x, info.y, info.width, info.height,
      Math.floor(destX), Math.floor(destY), Math.floor(destW), Math.floor(destH)
    );

    ctx.restore();
  }

  /**
   * Draw a frame by its atlas coordinates directly (bypass lookup).
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {{x:number, y:number, width:number, height:number, anchorX:number, anchorY:number}} frame
   * @param {number} screenX
   * @param {number} screenY
   */
  drawAtlasFrame(ctx, frame, screenX, screenY) {
    this._ensurePacked();
    if (!this._sheetCanvas) return;
    const destX = Math.floor(screenX - frame.anchorX);
    const destY = Math.floor(screenY - frame.anchorY);
    ctx.drawImage(
      this._sheetCanvas,
      frame.x, frame.y, frame.width, frame.height,
      destX, destY, frame.width, frame.height
    );
  }

  // ==========================================================================
  // ANIMATION SYSTEM
  // ==========================================================================

  /**
   * Register an animation sequence as a list of frame ids.
   *
   * @param {string} name - Animation name
   * @param {string[]} frameIds - Ordered list of frame ids
   * @param {{frameDuration?:number, loop?:boolean}} [options]
   * @returns {SpriteSheet} this
   */
  addAnimation(name, frameIds, options = {}) {
    this._animations.set(name, {
      ids: [...frameIds],
      frameDuration: options.frameDuration || this._frameDuration,
      loop: options.loop != null ? options.loop : true
    });
    return this;
  }

  /**
   * Remove an animation.
   *
   * @param {string} name
   * @returns {boolean}
   */
  removeAnimation(name) {
    return this._animations.delete(name);
  }

  /**
   * Get animation names.
   *
   * @returns {string[]}
   */
  getAnimationNames() {
    return Array.from(this._animations.keys());
  }

  /**
   * Check if an animation exists.
   *
   * @param {string} name
   * @returns {boolean}
   */
  hasAnimation(name) {
    return this._animations.has(name);
  }

  /**
   * Start playing an animation.
   *
   * @param {string} name
   * @param {{frameDuration?:number, loop?:boolean, startFrame?:number}} [options]
   * @returns {boolean} true if animation exists and started
   */
  playAnimation(name, options = {}) {
    const anim = this._animations.get(name);
    if (!anim) return false;

    this._currentAnim = name;
    this._animFrame = options.startFrame || 0;
    this._animTime = 0;
    this._frameDuration = options.frameDuration || anim.frameDuration;
    this._animLoop = options.loop != null ? options.loop : anim.loop;
    return true;
  }

  /**
   * Stop the current animation.
   */
  stopAnimation() {
    this._currentAnim = null;
    this._animFrame = 0;
    this._animTime = 0;
  }

  /**
   * Update animation state by delta time.
   *
   * @param {number} dt - Delta time in milliseconds
   * @returns {{name:string, frameId:string, frameIndex:number, finished:boolean}|null}
   */
  updateAnimation(dt) {
    if (!this._currentAnim) return null;

    const anim = this._animations.get(this._currentAnim);
    if (!anim) {
      this.stopAnimation();
      return null;
    }

    this._animTime += dt;
    const duration = this._frameDuration;
    let advanced = false;
    let finished = false;

    while (this._animTime >= duration) {
      this._animTime -= duration;
      this._animFrame++;
      advanced = true;

      if (this._animFrame >= anim.ids.length) {
        if (this._animLoop) {
          this._animFrame = 0;
        } else {
          this._animFrame = anim.ids.length - 1;
          finished = true;
          this._currentAnim = null;
          break;
        }
      }
    }

    const frameId = anim.ids[this._animFrame];
    return {
      name: this._currentAnim,
      frameId,
      frameIndex: this._animFrame,
      finished,
      advanced
    };
  }

  /**
   * Get the current animation frame id.
   *
   * @returns {string|null}
   */
  getCurrentFrameId() {
    if (!this._currentAnim) return null;
    const anim = this._animations.get(this._currentAnim);
    if (!anim) return null;
    return anim.ids[this._animFrame] || null;
  }

  /**
   * Draw the current animation frame.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} screenX
   * @param {number} screenY
   * @param {{scale?:number, flipX?:boolean, flipY?:boolean, alpha?:number}} [options]
   */
  drawCurrentFrame(ctx, screenX, screenY, options = {}) {
    const frameId = this.getCurrentFrameId();
    if (frameId) {
      this.drawFrame(ctx, frameId, screenX, screenY, options);
    }
  }

  // ==========================================================================
  // EXPORT / IMPORT
  // ==========================================================================

  /**
   * Export the packed sheet as a PNG data URL.
   *
   * @returns {string|null}
   */
  toDataURL() {
    this._ensurePacked();
    if (!this._sheetCanvas) return null;
    return this._sheetCanvas.toDataURL('image/png');
  }

  /**
   * Export the atlas metadata as a JSON-serializable object.
   *
   * @returns {{name:string, width:number, height:number, padding:number, frames:Object, animations:Object}}
   */
  toJSON() {
    this._ensurePacked();
    const animations = {};
    for (const [name, anim] of this._animations) {
      animations[name] = {
        ids: anim.ids,
        frameDuration: anim.frameDuration,
        loop: anim.loop
      };
    }
    return {
      name: this.name,
      width: this._sheetW,
      height: this._sheetH,
      padding: this.padding,
      frames: { ...this._atlas },
      animations
    };
  }

  /**
   * Import atlas metadata from JSON. Does NOT restore image data —
   * the caller must re-add frames and repack, or supply a sheet canvas.
   *
   * @param {Object} json - Output from toJSON()
   * @param {HTMLCanvasElement} [sheetCanvas] - Pre-loaded sheet image
   * @returns {SpriteSheet} this
   */
  fromJSON(json, sheetCanvas) {
    this.name = json.name || this.name;
    this.padding = json.padding != null ? json.padding : this.padding;
    this._atlas = json.frames ? { ...json.frames } : {};

    if (json.animations) {
      this._animations = new Map();
      for (const [name, anim] of Object.entries(json.animations)) {
        this._animations.set(name, {
          ids: [...anim.ids],
          frameDuration: anim.frameDuration || 150,
          loop: anim.loop != null ? anim.loop : true
        });
      }
    }

    if (sheetCanvas) {
      this._sheetCanvas = sheetCanvas;
      this._sheetCtx = _getCtx(sheetCanvas);
      this._sheetW = sheetCanvas.width;
      this._sheetH = sheetCanvas.height;
      this._dirty = false;
    } else {
      this._dirty = true;
    }

    return this;
  }

  /**
   * Export both the sheet image and atlas as a bundle.
   *
   * @returns {{sheet:HTMLCanvasElement, atlas:Object}|null}
   */
  exportBundle() {
    this._ensurePacked();
    if (!this._sheetCanvas) return null;
    return {
      sheet: this._sheetCanvas,
      atlas: this.toJSON()
    };
  }

  /**
   * Import a bundle exported by exportBundle().
   *
   * @param {{sheet:HTMLCanvasElement, atlas:Object}} bundle
   * @returns {SpriteSheet} this
   */
  importBundle(bundle) {
    return this.fromJSON(bundle.atlas, bundle.sheet);
  }

  // ==========================================================================
  // STATIC BUILDERS
  // ==========================================================================

  /**
   * Build a SpriteSheet from an object mapping ids to canvas elements.
   *
   * @param {Object<string, HTMLCanvasElement>} idToCanvas
   * @param {{padding?:number, pow2?:boolean, name?:string}} [options]
   * @returns {SpriteSheet}
   */
  static fromCanvases(idToCanvas, options = {}) {
    const sheet = new SpriteSheet(options);
    for (const [id, canvas] of Object.entries(idToCanvas)) {
      sheet.addFrame(id, canvas);
    }
    sheet.pack();
    return sheet;
  }

  /**
   * Build a SpriteSheet from a list of sprite objects containing {canvas, width, height, anchorX, anchorY}.
   *
   * @param {Object<string, {canvas:HTMLCanvasElement, width:number, height:number, anchorX:number, anchorY:number, hitW?:number, hitH?:number}>} idToSprite
   * @param {{padding?:number, pow2?:boolean, name?:string}} [options]
   * @returns {SpriteSheet}
   */
  static fromSprites(idToSprite, options = {}) {
    const sheet = new SpriteSheet(options);
    for (const [id, sprite] of Object.entries(idToSprite)) {
      sheet.addFrame(id, sprite.canvas, {
        anchorX: sprite.anchorX,
        anchorY: sprite.anchorY,
        hitW: sprite.hitW,
        hitH: sprite.hitH
      });
    }
    sheet.pack();
    return sheet;
  }

  /**
   * Build a SpriteSheet from generated sprite data (e.g. output from SpriteGenerator).
   *
   * @param {Object<string, {canvas:HTMLCanvasElement, width:number, height:number, anchorX:number, anchorY:number}>} sprites
   * @param {string} [sheetName]
   * @returns {SpriteSheet}
   */
  static fromGenerated(sprites, sheetName) {
    return SpriteSheet.fromSprites(sprites, { name: sheetName || 'generated' });
  }
}

// =============================================================================
// ANIMATION SEQUENCE BUILDER
// =============================================================================

/**
 * Utility to build frame id lists for common animation patterns.
 */
export class AnimationBuilder {
  /**
   * Build a walk cycle frame id list from base name and frame count.
   *
   * @param {string} baseId - e.g. "avatar_walk"
   * @param {number} count - number of frames
   * @returns {string[]}
   */
  static walkCycle(baseId, count) {
    const ids = [];
    for (let i = 0; i < count; i++) {
      ids.push(`${baseId}_${i}`);
    }
    return ids;
  }

  /**
   * Build a ping-pong animation (go forward then backward).
   *
   * @param {string} baseId
   * @param {number} count
   * @returns {string[]}
   */
  static pingPong(baseId, count) {
    const ids = [];
    for (let i = 0; i < count; i++) ids.push(`${baseId}_${i}`);
    for (let i = count - 2; i > 0; i--) ids.push(`${baseId}_${i}`);
    return ids;
  }

  /**
   * Build an idle+blink sequence.
   *
   * @param {string} idleId
   * @param {string} blinkId
   * @param {number} [blinkEvery=3]
   * @returns {string[]}
   */
  static idleBlink(idleId, blinkId, blinkEvery = 3) {
    const ids = [];
    for (let i = 0; i < blinkEvery; i++) ids.push(idleId);
    ids.push(blinkId);
    return ids;
  }
}

// =============================================================================
// MULTI-SHEET MANAGER
// =============================================================================

/**
 * Manages multiple SpriteSheets keyed by category.
 */
export class SpriteSheetManager {
  constructor() {
    /** @type {Map<string, SpriteSheet>} */
    this._sheets = new Map();
  }

  /**
   * Register a sheet under a category name.
   *
   * @param {string} name
   * @param {SpriteSheet} sheet
   */
  register(name, sheet) {
    this._sheets.set(name, sheet);
  }

  /**
   * Get a sheet by name.
   *
   * @param {string} name
   * @returns {SpriteSheet|undefined}
   */
  get(name) {
    return this._sheets.get(name);
  }

  /**
   * Remove a sheet.
   *
   * @param {string} name
   * @returns {boolean}
   */
  remove(name) {
    return this._sheets.delete(name);
  }

  /**
   * Draw a frame from a specific sheet.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} sheetName
   * @param {string} frameId
   * @param {number} screenX
   * @param {number} screenY
   * @param {{scale?:number, flipX?:boolean, flipY?:boolean, alpha?:number}} [options]
   */
  drawFrame(ctx, sheetName, frameId, screenX, screenY, options = {}) {
    const sheet = this._sheets.get(sheetName);
    if (sheet) {
      sheet.drawFrame(ctx, frameId, screenX, screenY, options);
    }
  }

  /**
   * Update animations on all sheets.
   *
   * @param {number} dt
   */
  updateAnimations(dt) {
    for (const sheet of this._sheets.values()) {
      sheet.updateAnimation(dt);
    }
  }

  /**
   * Get all sheet names.
   *
   * @returns {string[]}
   */
  getNames() {
    return Array.from(this._sheets.keys());
  }

  /**
   * Export all sheets as a bundle map.
   *
   * @returns {Object<string, {sheet:HTMLCanvasElement, atlas:Object}>}
   */
  exportAll() {
    const out = {};
    for (const [name, sheet] of this._sheets) {
      const bundle = sheet.exportBundle();
      if (bundle) out[name] = bundle;
    }
    return out;
  }

  /**
   * Import all sheets from a bundle map.
   *
   * @param {Object<string, {sheet:HTMLCanvasElement, atlas:Object}>} bundles
   */
  importAll(bundles) {
    for (const [name, bundle] of Object.entries(bundles)) {
      const sheet = new SpriteSheet();
      sheet.importBundle(bundle);
      this._sheets.set(name, sheet);
    }
  }

  /**
   * Pack all registered sheets.
   */
  packAll() {
    for (const sheet of this._sheets.values()) {
      sheet.pack();
    }
  }
}

/** Default export is the SpriteSheet class. */
export default SpriteSheet;
