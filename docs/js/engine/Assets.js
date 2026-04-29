/**
 * @file Assets.js
 * @description Asset loading, caching, and procedural sprite generation.
 * Handles image preloading, offscreen canvas sprite creation, and colorization.
 */

/**
 * Asset manager with cache, loader queue, and procedural avatar generation.
 * @export {Assets}
 */
export class Assets {
  constructor() {
    /** @type {Map<string, HTMLImageElement|ImageBitmap|HTMLCanvasElement>} */
    this.cache = new Map();
    /** @type {Map<string, Promise>} In-flight loading promises. */
    this.loading = new Map();
    /** @type {number} Total assets queued. */
    this.total = 0;
    /** @type {number} Completed loads. */
    this.loaded = 0;
    /** @type {Set<string>} Asset IDs that failed to load. */
    this.failed = new Set();

    // Color lookup tables for procedural generation
    /** @type {string[]} */
    this.skinColors = ['#ffe0bd', '#ffcd94', '#eac086', '#d2a56d', '#8d5524', '#5c3a21'];
    /** @type {string[]} */
    this.hairColors = ['#2d2d2d', '#5c3a21', '#d4a574', '#e8c547', '#a33b3b', '#6b4c9a', '#c4b5fd', '#38bdf8'];
    /** @type {string[]} */
    this.outfitColors = ['#5b8c85', '#c75b5b', '#5b7fa8', '#a85ba8', '#8c5b5b', '#d4a45b', '#4ade80', '#f472b6'];

    /** @type {Map<string, ImageBitmap>} Cache for generated avatar sprites. */
    this._avatarCache = new Map();
    /** @type {OffscreenCanvas|null} Reusable offscreen canvas. */
    this._offscreen = null;
    /** @type {CanvasRenderingContext2D|null} */
    this._offCtx = null;
  }

  /**
   * Load an image asset from a URL and cache it.
   * @param {string} id - Asset identifier.
   * @param {string} src - Image URL.
   * @returns {Promise<HTMLImageElement>}
   */
  async loadSprite(id, src) {
    if (this.cache.has(id)) {
      return this.cache.get(id);
    }
    if (this.loading.has(id)) {
      return this.loading.get(id);
    }

    this.total++;
    const promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.cache.set(id, img);
        this.loaded++;
        this.loading.delete(id);
        resolve(img);
      };
      img.onerror = () => {
        this.failed.add(id);
        this.loaded++;
        this.loading.delete(id);
        reject(new Error(`Failed to load asset: ${id} from ${src}`));
      };
      img.src = src;
    });

    this.loading.set(id, promise);
    return promise;
  }

  /**
   * Load multiple sprites in parallel.
   * @param {Array<{id:string, src:string}>} list
   * @returns {Promise<void>}
   */
  async loadSpriteBatch(list) {
    const promises = list.map(({ id, src }) =>
      this.loadSprite(id, src).catch(err => console.warn('[Assets]', err.message))
    );
    await Promise.all(promises);
  }

  /**
   * Retrieve a cached asset.
   * @param {string} id
   * @returns {HTMLImageElement|ImageBitmap|HTMLCanvasElement|null}
   */
  getSprite(id) {
    return this.cache.get(id) || null;
  }

  /**
   * Check if an asset is cached.
   * @param {string} id
   * @returns {boolean}
   */
  hasSprite(id) {
    return this.cache.has(id);
  }

  /**
   * Get loading progress as a 0..1 value.
   * @returns {number}
   */
  getProgress() {
    return this.total > 0 ? this.loaded / this.total : 1;
  }

  /**
   * Generate a procedural avatar sprite on an offscreen canvas and return it as ImageBitmap.
   * Results are cached by a composite key of character parameters.
   * @param {string} charId - Character archetype id.
   * @param {number} skinColor - Skin color index.
   * @param {number} hairColor - Hair color index.
   * @param {number} outfitColor - Outfit color index.
   * @param {string[]} accessories - List of accessory ids.
   * @returns {ImageBitmap}
   */
  async generateAvatarSprite(charId, skinColor, hairColor, outfitColor, accessories) {
    const cacheKey = `${charId}:${skinColor}:${hairColor}:${outfitColor}:${(accessories || []).sort().join(',')}`;
    if (this._avatarCache.has(cacheKey)) {
      return this._avatarCache.get(cacheKey);
    }

    const w = 64;
    const h = 64;
    const cvs = this._getOffscreen(w, h);
    const ctx = this._offCtx;
    ctx.clearRect(0, 0, w, h);

    const skin = this.skinColors[skinColor % this.skinColors.length];
    const hair = this.hairColors[hairColor % this.hairColors.length];
    const outfit = this.outfitColors[outfitColor % this.outfitColors.length];

    // Body (centered, larger)
    ctx.fillStyle = outfit;
    this._roundRect(ctx, w / 2 - 12, h / 2 - 2, 24, 22, 8);
    ctx.fill();

    // Head
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 - 16, 14, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 - 18, 14, Math.PI, Math.PI * 2);
    ctx.fill();
    // Bangs
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 - 16, 14, Math.PI * 1.08, Math.PI * 1.92);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(w / 2 - 4, h / 2 - 16, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w / 2 + 4, h / 2 - 16, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Eye highlights
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(w / 2 - 3, h / 2 - 17, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w / 2 + 5, h / 2 - 17, 1, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 - 12, 3, 0.1, Math.PI - 0.1);
    ctx.stroke();

    // Accessories
    if (accessories && accessories.includes('glasses')) {
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(w / 2 - 4, h / 2 - 16, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(w / 2 + 4, h / 2 - 16, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w / 2 - 1, h / 2 - 16); ctx.lineTo(w / 2 + 1, h / 2 - 16); ctx.stroke();
    }
    if (accessories && accessories.includes('hat')) {
      ctx.fillStyle = outfit;
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2 - 28, 16, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(w / 2 - 10, h / 2 - 34, 20, 8);
    }
    if (accessories && accessories.includes('bow')) {
      ctx.fillStyle = '#ff6b9d';
      ctx.beginPath();
      ctx.ellipse(w / 2 - 12, h / 2 - 26, 4, 3, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(w / 2 + 12, h / 2 - 26, 4, 3, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2 - 26, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    const bmp = await createImageBitmap(cvs);
    this._avatarCache.set(cacheKey, bmp);
    return bmp;
  }

  /**
   * Colorize an existing sprite using HSL adjustments via an offscreen canvas.
   * @param {HTMLImageElement|ImageBitmap} source - Source image.
   * @param {number} hueShift - Degrees to shift hue.
   * @param {number} [saturation=1] - Saturation multiplier.
   * @param {number} [brightness=1] - Brightness multiplier.
   * @returns {HTMLCanvasElement}
   */
  generateColorizedSprite(source, hueShift, saturation = 1, brightness = 1) {
    const w = source.width || 64;
    const h = source.height || 64;
    const cvs = document.createElement('canvas');
    cvs.width = w;
    cvs.height = h;
    const ctx = cvs.getContext('2d');

    // Apply CSS filter equivalent
    const filters = [
      `hue-rotate(${hueShift}deg)`,
      `saturate(${saturation})`,
      `brightness(${brightness})`
    ].join(' ');

    ctx.filter = filters;
    ctx.drawImage(source, 0, 0, w, h);
    ctx.filter = 'none';

    return cvs;
  }

  /**
   * Generate a solid-color placeholder texture.
   * @param {string} color - CSS color string.
   * @param {number} w
   * @param {number} h
   * @returns {HTMLCanvasElement}
   */
  generatePlaceholder(color, w = 32, h = 32) {
    const cvs = document.createElement('canvas');
    cvs.width = w;
    cvs.height = h;
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    // Add subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);
    return cvs;
  }

  /**
   * Create a 9-patch-style panel sprite.
   * @param {number} w
   * @param {number} h
   * @param {number} r - Corner radius.
   * @param {string} fillColor
   * @param {string} strokeColor
   * @returns {HTMLCanvasElement}
   */
  generatePanel(w, h, r, fillColor = 'rgba(20,20,30,0.85)', strokeColor = 'rgba(255,255,255,0.12)') {
    const cvs = document.createElement('canvas');
    cvs.width = w;
    cvs.height = h;
    const ctx = cvs.getContext('2d');

    ctx.fillStyle = fillColor;
    this._roundRect(ctx, 0, 0, w, h, r);
    ctx.fill();

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    this._roundRect(ctx, 0, 0, w, h, r);
    ctx.stroke();

    return cvs;
  }

  /**
   * Get or create the reusable offscreen canvas.
   * @param {number} w
   * @param {number} h
   * @returns {HTMLCanvasElement}
   */
  _getOffscreen(w, h) {
    if (!this._offscreen || this._offscreen.width < w || this._offscreen.height < h) {
      this._offscreen = document.createElement('canvas');
      this._offscreen.width = w;
      this._offscreen.height = h;
      this._offCtx = this._offscreen.getContext('2d');
    }
    return this._offscreen;
  }

  /**
   * Draw a rounded rectangle path on a context.
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
   * Reset all state. Does not clear the image cache.
   */
  reset() {
    this.total = 0;
    this.loaded = 0;
    this.failed.clear();
  }

  /**
   * Fully clear all caches.
   */
  clear() {
    this.cache.clear();
    this._avatarCache.clear();
    this.loading.clear();
    this.failed.clear();
    this.total = 0;
    this.loaded = 0;
  }
}
