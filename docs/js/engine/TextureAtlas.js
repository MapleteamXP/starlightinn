/**
 * @file TextureAtlas.js
 * @description Sprite sheet packing system using shelf-bin algorithm.
 * Packs multiple sprite images into a single GPU texture with UV coordinate tracking.
 * Supports dynamic atlas growth, procedural avatar generation, and pixel-perfect packing.
 */

/**
 * A single slot in the atlas.
 * @typedef {Object} AtlasSlot
 * @property {number} x - Pixel X position in atlas.
 * @property {number} y - Pixel Y position in atlas.
 * @property {number} w - Pixel width.
 * @property {number} h - Pixel height.
 * @property {number} u1 - Left UV coordinate.
 * @property {number} v1 - Top UV coordinate.
 * @property {number} u2 - Right UV coordinate.
 * @property {number} v2 - Bottom UV coordinate.
 * @property {number} [padX] - Horizontal padding.
 * @property {number} [padY] - Vertical padding.
 */

/**
 * A shelf in the shelf-packing algorithm.
 * @typedef {Object} AtlasShelf
 * @property {number} y - Y position of the shelf.
 * @property {number} height - Shelf height.
 * @property {number} x - Current X cursor position.
 */

/**
 * TextureAtlas packs multiple images into a single WebGL texture.
 * Uses a shelf-bin packing algorithm with dynamic shelf creation.
 * Supports padding, bleeding prevention, and hot-reloading.
 * @export {TextureAtlas}
 */
export class TextureAtlas {
  /**
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
   * @param {number} [maxSize=4096] - Max texture dimension (must be power of 2).
   * @param {number} [padding=2] - Pixel padding between sprites.
   */
  constructor(gl, maxSize = 4096, padding = 2) {
    /** @type {WebGLRenderingContext|WebGL2RenderingContext} */
    this.gl = gl;
    /** @type {number} */
    this.maxSize = maxSize;
    /** @type {number} */
    this.padding = padding;

    // Ensure power-of-2
    /** @type {number} */
    this.currentSize = 256; // Starts small, grows as needed
    /** @type {number} */
    this.usedWidth = 0;
    /** @type {number} */
    this.usedHeight = 0;

    // Shelf tracking for packing algorithm
    /** @type {AtlasShelf[]} */
    this.shelves = [];
    /** @type {number} */
    this.currentShelfY = 0;
    /** @type {number} */
    this.currentShelfHeight = 0;

    // Sprite slot mapping: spriteId -> AtlasSlot
    /** @type {Map<string, AtlasSlot>} */
    this.slots = new Map();

    // Pending images waiting to be packed
    /** @type {Map<string, HTMLImageElement|HTMLCanvasElement>} */
    this.pending = new Map();

    // Offscreen canvas for building the atlas
    /** @type {HTMLCanvasElement} */
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.currentSize;
    this.canvas.height = this.currentSize;
    /** @type {CanvasRenderingContext2D} */
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false });

    // Clear to transparent
    this.ctx.clearRect(0, 0, this.currentSize, this.currentSize);

    // WebGL texture handle
    /** @type {WebGLTexture|null} */
    this.texture = gl.createTexture();
    /** @type {boolean} */
    this.dirty = false;
    /** @type {boolean} */
    this.uploaded = false;

    // Statistics
    /** @type {number} */
    this.spriteCount = 0;
    /** @type {number} */
    this.totalArea = 0;
    /** @type {number} */
    this.packEfficiency = 0;

    // Procedural generation cache
    /** @type {Map<string, string>} */
    this._avatarCache = new Map();
  }

  // ─── Core Packing ──────────────────────────────────────────────────────────

  /**
   * Add a sprite image to the atlas. Packs immediately but defers GPU upload.
   * @param {string} id - Unique sprite identifier.
   * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} image - Source image.
   * @param {Object} [options] - Packing options.
   * @param {number} [options.padding] - Override default padding.
   * @returns {AtlasSlot|null} The packed slot info, or null if it didn't fit.
   */
  addSprite(id, image, options = {}) {
    if (this.slots.has(id)) {
      return this.slots.get(id);
    }

    const pad = options.padding !== undefined ? options.padding : this.padding;
    const w = image.width || image.videoWidth || 64;
    const h = image.height || image.videoHeight || 64;

    // Attempt to pack
    const slot = this._packRect(id, w, h, pad);
    if (!slot) {
      // Atlas full - try to grow
      if (!this._grow()) {
        console.warn(`[TextureAtlas] Cannot fit sprite "${id}" (${w}x${h}) in ${this.maxSize}x${this.maxSize} atlas`);
        return null;
      }
      // Retry after grow
      return this.addSprite(id, image, options);
    }

    // Draw image into the atlas canvas
    this.ctx.drawImage(image, slot.x, slot.y, slot.w, slot.h);

    // Copy a 1-pixel border to prevent UV bleeding (edge padding)
    this._applyEdgePadding(slot);

    this.slots.set(id, slot);
    this.pending.set(id, image);
    this.dirty = true;
    this.spriteCount++;
    this.totalArea += w * h;
    this._updateEfficiency();

    return slot;
  }

  /**
   * Pack a rectangle using the shelf algorithm.
   * @param {string} id
   * @param {number} w
   * @param {number} h
   * @param {number} pad
   * @returns {AtlasSlot|null}
   */
  _packRect(id, w, h, pad) {
    const paddedW = w + pad * 2;
    const paddedH = h + pad * 2;

    // Check if sprite is larger than max atlas size
    if (paddedW > this.currentSize || paddedH > this.currentSize) {
      // Try to grow to accommodate
      const needed = Math.max(paddedW, paddedH);
      if (needed <= this.maxSize) {
        this._resize(needed);
      } else {
        return null;
      }
    }

    // Try to fit on an existing shelf
    for (const shelf of this.shelves) {
      if (shelf.height >= paddedH && shelf.x + paddedW <= this.currentSize) {
        const slot = this._createSlot(shelf.x + pad, shelf.y + pad, w, h);
        shelf.x += paddedW;
        this.usedWidth = Math.max(this.usedWidth, shelf.x);
        return slot;
      }
    }

    // Need a new shelf
    const newShelfHeight = paddedH;
    if (this.currentShelfY + newShelfHeight > this.currentSize) {
      // Out of vertical space - need to grow
      return null;
    }

    const newShelf = { y: this.currentShelfY, height: newShelfHeight, x: paddedW };
    this.shelves.push(newShelf);
    this.currentShelfY += newShelfHeight;
    this.usedHeight = this.currentShelfY;

    const slot = this._createSlot(pad, newShelf.y + pad, w, h);
    return slot;
  }

  /**
   * Create a slot with UV coordinates.
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @returns {AtlasSlot}
   */
  _createSlot(x, y, w, h) {
    const size = this.currentSize;
    return {
      x, y, w, h,
      u1: x / size,
      v1: y / size,
      u2: (x + w) / size,
      v2: (y + h) / size
    };
  }

  /**
   * Copy edge pixels outward to prevent UV bleeding.
   * @param {AtlasSlot} slot
   */
  _applyEdgePadding(slot) {
    const ctx = this.ctx;
    const { x, y, w, h } = slot;

    // Top edge
    ctx.drawImage(this.canvas, x, y, w, 1, x, y - 1, w, 1);
    // Bottom edge
    ctx.drawImage(this.canvas, x, y + h - 1, w, 1, x, y + h, w, 1);
    // Left edge
    ctx.drawImage(this.canvas, x, y, 1, h, x - 1, y, 1, h);
    // Right edge
    ctx.drawImage(this.canvas, x + w - 1, y, 1, h, x + w, y, 1, h);
  }

  // ─── Atlas Growth ──────────────────────────────────────────────────────────

  /**
   * Grow the atlas canvas to the next power of 2.
   * @returns {boolean} True if growth succeeded.
   */
  _grow() {
    const newSize = this.currentSize * 2;
    if (newSize > this.maxSize) return false;
    this._resize(newSize);
    return true;
  }

  /**
   * Resize the atlas canvas.
   * @param {number} newSize
   */
  _resize(newSize) {
    // Save current content
    const temp = document.createElement('canvas');
    temp.width = this.currentSize;
    temp.height = this.currentSize;
    const tctx = temp.getContext('2d');
    tctx.drawImage(this.canvas, 0, 0);

    // Resize
    this.currentSize = newSize;
    this.canvas.width = newSize;
    this.canvas.height = newSize;
    this.ctx.clearRect(0, 0, newSize, newSize);
    this.ctx.drawImage(temp, 0, 0);

    // Recalculate UVs for all existing slots
    for (const slot of this.slots.values()) {
      slot.u1 = slot.x / newSize;
      slot.v1 = slot.y / newSize;
      slot.u2 = (slot.x + slot.w) / newSize;
      slot.v2 = (slot.y + slot.h) / newSize;
    }

    this.dirty = true;
  }

  // ─── GPU Upload ────────────────────────────────────────────────────────────

  /**
   * Upload the atlas canvas to the GPU texture.
   * Call after adding all sprites for the frame.
   */
  upload() {
    if (!this.dirty) return;
    const gl = this.gl;

    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    if (!this.uploaded) {
      // First upload
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.uploaded = true;
    } else {
      // Sub-upload: use texSubImage2D for the used region
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.currentSize, this.currentSize,
        gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
    }

    this.dirty = false;
  }

  /**
   * Force a full re-upload of the atlas texture.
   */
  forceUpload() {
    this.dirty = true;
    this.uploaded = false;
    this.upload();
  }

  // ─── Queries ───────────────────────────────────────────────────────────────

  /**
   * Get UV coordinates for a sprite.
   * @param {string} id
   * @returns {AtlasSlot|null}
   */
  getUV(id) {
    return this.slots.get(id) || null;
  }

  /**
   * Check if a sprite is packed in the atlas.
   * @param {string} id
   * @returns {boolean}
   */
  hasSprite(id) {
    return this.slots.has(id);
  }

  /**
   * Get atlas dimensions.
   * @returns {{width: number, height: number, usedWidth: number, usedHeight: number}}
   */
  getStats() {
    return {
      width: this.currentSize,
      height: this.currentSize,
      usedWidth: this.usedWidth,
      usedHeight: this.usedHeight,
      spriteCount: this.spriteCount,
      packEfficiency: this.packEfficiency
    };
  }

  /**
   * Update packing efficiency metric.
   */
  _updateEfficiency() {
    const atlasArea = this.currentSize * this.currentSize;
    this.packEfficiency = atlasArea > 0 ? this.totalArea / atlasArea : 0;
  }

  // ─── Removal ───────────────────────────────────────────────────────────────

  /**
   * Remove a sprite from the atlas. Note: this creates fragmentation;
   * use defragment() to reclaim space.
   * @param {string} id
   */
  removeSprite(id) {
    const slot = this.slots.get(id);
    if (slot) {
      // Clear the region
      this.ctx.clearRect(slot.x - this.padding, slot.y - this.padding,
        slot.w + this.padding * 2, slot.h + this.padding * 2);
      this.slots.delete(id);
      this.pending.delete(id);
      this.spriteCount--;
      this.totalArea -= slot.w * slot.h;
      this.dirty = true;
    }
  }

  /**
   * Defragment the atlas by repacking all sprites.
   * Expensive operation - call sparingly.
   */
  defragment() {
    const entries = Array.from(this.pending.entries());
    this.slots.clear();
    this.pending.clear();
    this.shelves = [];
    this.currentShelfY = 0;
    this.usedWidth = 0;
    this.usedHeight = 0;
    this.totalArea = 0;
    this.spriteCount = 0;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.currentSize, this.currentSize);

    // Repack
    for (const [id, image] of entries) {
      this.addSprite(id, image);
    }
    this.forceUpload();
  }

  // ─── Procedural Avatar Generation ──────────────────────────────────────────

  /**
   * Generate procedural avatar sprites for character + expression combos and pack them.
   * @param {string[]} charIds - Character IDs to generate.
   * @param {string[]} expressions - Expression names.
   * @param {Function} [drawFn] - Custom draw function(ctx, charId, expression).
   * @returns {string[]} List of generated atlas IDs.
   */
  generateAvatarPack(charIds, expressions, drawFn) {
    const generated = [];
    const size = 64;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    for (const charId of charIds) {
      for (const expr of expressions) {
        const id = `avatar_${charId}_${expr}`;
        if (this.slots.has(id)) {
          generated.push(id);
          continue;
        }

        ctx.clearRect(0, 0, size, size);

        if (drawFn) {
          drawFn(ctx, charId, expr);
        } else {
          this._defaultAvatarDraw(ctx, charId, expr, size);
        }

        this.addSprite(id, c);
        generated.push(id);
      }
    }

    this.upload();
    return generated;
  }

  /**
   * Default procedural avatar drawing.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} charId
   * @param {string} expression
   * @param {number} size
   */
  _defaultAvatarDraw(ctx, charId, expression, size) {
    const cx = size / 2;
    const cy = size / 2;

    // Derive colors from charId hash
    const hash = this._hashString(charId);
    const skinColors = ['#ffe0bd', '#ffcd94', '#eac086', '#d2a56d', '#8d5524'];
    const hairColors = ['#2d2d2d', '#5c3a21', '#d4a574', '#e8c547', '#a33b3b', '#6b4c9a'];
    const outfitColors = ['#5b8c85', '#c75b5b', '#5b7fa8', '#a85ba8', '#8c5b5b', '#d4a45b'];

    const skin = skinColors[hash % skinColors.length];
    const hair = hairColors[(hash >> 4) % hairColors.length];
    const outfit = outfitColors[(hash >> 8) % outfitColors.length];

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

    // Eyes based on expression
    ctx.fillStyle = '#2d2d2d';
    const eyeY = cy - 12;
    if (expression === 'sleep') {
      ctx.strokeStyle = '#2d2d2d';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx - 5, eyeY); ctx.lineTo(cx - 2, eyeY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 2, eyeY); ctx.lineTo(cx + 5, eyeY); ctx.stroke();
    } else if (expression === 'laugh') {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx - 3, eyeY - 1, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 3, eyeY - 1, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2d2d2d';
      ctx.beginPath(); ctx.arc(cx - 3, eyeY - 1, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 3, eyeY - 1, 1.5, 0, Math.PI * 2); ctx.fill();
    } else if (expression === 'cry') {
      ctx.beginPath(); ctx.arc(cx - 3, eyeY, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 3, eyeY, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath(); ctx.arc(cx - 3, eyeY + 6, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 3, eyeY + 6, 1.5, 0, Math.PI * 2); ctx.fill();
    } else {
      // happy / normal
      ctx.beginPath(); ctx.arc(cx - 3, eyeY, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 3, eyeY, 2.2, 0, Math.PI * 2); ctx.fill();
    }

    // Mouth
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    if (expression === 'happy' || expression === 'laugh') {
      ctx.beginPath();
      ctx.arc(cx, cy - 8, 3, 0.1, Math.PI - 0.1);
      ctx.stroke();
    } else if (expression === 'sleep') {
      ctx.beginPath(); ctx.moveTo(cx - 2, cy - 8); ctx.lineTo(cx + 2, cy - 8); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(cx - 2, cy - 8); ctx.lineTo(cx + 2, cy - 8); ctx.stroke();
    }
  }

  /**
   * Draw a rounded rectangle.
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
   * Simple string hash for deterministic avatar generation.
   * @param {string} str
   * @returns {number}
   */
  _hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  // ─── Batch Operations ──────────────────────────────────────────────────────

  /**
   * Add multiple sprites from an array of {id, image} objects.
   * @param {Array<{id: string, image: HTMLImageElement|HTMLCanvasElement}>} sprites
   * @returns {string[]} IDs that were successfully packed.
   */
  addSprites(sprites) {
    const packed = [];
    for (const { id, image } of sprites) {
      const slot = this.addSprite(id, image);
      if (slot) packed.push(id);
    }
    return packed;
  }

  /**
   * Add sprites from a spritesheet image using a JSON descriptor.
   * @param {HTMLImageElement|HTMLCanvasElement} sheetImage
   * @param {Object<string, {x: number, y: number, w: number, h: number}>} descriptor
   */
  addSpriteSheet(sheetImage, descriptor) {
    for (const [id, { x, y, w, h }] of Object.entries(descriptor)) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(sheetImage, x, y, w, h, 0, 0, w, h);
      this.addSprite(id, c);
    }
  }

  // ─── Mipmapping ────────────────────────────────────────────────────────────

  /**
   * Generate mipmaps for smoother rendering at distance.
   * Only effective if atlas is power-of-2.
   */
  generateMipmaps() {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  // ─── Debug ─────────────────────────────────────────────────────────────────

  /**
   * Draw the atlas layout for debugging.
   * @returns {HTMLCanvasElement}
   */
  debugVisual() {
    const c = document.createElement('canvas');
    c.width = this.currentSize;
    c.height = this.currentSize;
    const ctx = c.getContext('2d');

    // Draw atlas content
    ctx.drawImage(this.canvas, 0, 0);

    // Draw slot outlines
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 1;
    for (const [id, slot] of this.slots) {
      ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);
      if (slot.w > 40 && slot.h > 20) {
        ctx.fillStyle = '#ff0000';
        ctx.font = '10px monospace';
        ctx.fillText(id.substring(0, 15), slot.x + 2, slot.y + 12);
      }
    }

    // Draw shelf lines
    ctx.strokeStyle = '#00ff00';
    ctx.setLineDash([5, 5]);
    for (const shelf of this.shelves) {
      ctx.beginPath();
      ctx.moveTo(0, shelf.y);
      ctx.lineTo(this.currentSize, shelf.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    return c;
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  /**
   * Destroy the GPU texture and release resources.
   */
  destroy() {
    if (this.texture) {
      this.gl.deleteTexture(this.texture);
      this.texture = null;
    }
    this.slots.clear();
    this.pending.clear();
    this.shelves = [];
  }
}
