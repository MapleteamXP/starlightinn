/**
 * @file PixelPerfectScaler.js
 * @description Integer scaling system for crisp pixel-art rendering in
 * Starlight Inn v6.0.  Ensures nearest-neighbor scaling with no sub-pixel
 * positioning at zoom levels 1x, 2x, 3x, or 4x.
 *
 * Core rules:
 *   - ONLY integer zoom values are valid
 *   - canvas.style.width/height are set to backingSize * zoom
 *   - CSS image-rendering: pixelated is applied
 *   - All coordinates Math.round()'ed before drawImage
 *   - Never allows sub-pixel positioning or fractional sizes
 *
 * @module iso/PixelPerfectScaler
 * @version 6.0.0
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/** Minimum allowed zoom level */
export const MIN_ZOOM = 1;

/** Maximum allowed zoom level */
export const MAX_ZOOM = 4;

/** Default zoom level */
export const DEFAULT_ZOOM = 1;

/** Valid zoom steps */
export const ZOOM_LEVELS = Object.freeze([1, 2, 3, 4]);

/** CSS class name applied to the canvas */
export const PIXEL_PERFECT_CLASS = "pixel-perfect-canvas";

// =============================================================================
// PIXEL PERFECT SCALER CLASS
// =============================================================================

/**
 * Manages integer scaling for a canvas element to achieve crisp pixel-art
 * output.  Wraps the canvas and controls its CSS display size independently
 * from its backing store resolution.
 *
 * Usage:
 * ```js
 * const scaler = new PixelPerfectScaler(document.getElementById('game'));
 * scaler.setZoom(2);               // 2x pixel-perfect scaling
 * scaler.applyCSS();               // inject pixelated styles
 * const {x, y} = scaler.screenToCanvas(mouseX, mouseY);
 * ```
 */
export default class PixelPerfectScaler {
  /**
   * Create a new PixelPerfectScaler wrapping a canvas element.
   *
   * @param {HTMLCanvasElement} canvas - The canvas to manage
   */
  constructor(canvas) {
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      throw new TypeError("PixelPerfectScaler: expected HTMLCanvasElement");
    }

    /** @type {HTMLCanvasElement} */
    this._canvas = canvas;

    /** @type {number} Current integer zoom level (1-4) */
    this._zoom = DEFAULT_ZOOM;

    /** @type {number} Backing store width in pixels */
    this._backingWidth = canvas.width || 1024;

    /** @type {number} Backing store height in pixels */
    this._backingHeight = canvas.height || 768;

    /** @type {number} CSS display width in pixels */
    this._cssWidth = this._backingWidth;

    /** @type {number} CSS display height in pixels */
    this._cssHeight = this._backingHeight;

    /** @type {boolean} Whether CSS styles have been injected */
    this._cssApplied = false;

    /** @type {HTMLStyleElement|null} Injected style element */
    this._styleElement = null;

    /** @type {boolean} Whether the scaler is tracking window resize */
    this._trackingResize = false;

    /** @type {Function|null} Bound resize handler */
    this._resizeHandler = null;

    /** @type {number} Device pixel ratio at construction */
    this._dpr = window.devicePixelRatio || 1;

    /** @type {boolean} Whether to snap all values to integers */
    this._strictInteger = true;

    // Apply initial state
    this._updateCSSSize();
  }

  // ---------------------------------------------------------------------------
  // ZOOM CONTROL
  // ---------------------------------------------------------------------------

  /**
   * Set the zoom level. Only integer values 1-4 are accepted.
   * The zoom is clamped and rounded to the nearest valid integer.
   *
   * @param {number} level - Desired zoom level
   * @returns {number} The actual zoom level applied
   */
  setZoom(level) {
    const clamped = this._clampZoom(level);

    if (clamped !== this._zoom) {
      this._zoom = clamped;
      this._updateCSSSize();
      this._onZoomChanged();
    }

    return this._zoom;
  }

  /**
   * Get the current zoom level.
   * @returns {number}
   */
  getZoom() {
    return this._zoom;
  }

  /**
   * Increase zoom by one step (clamped at MAX_ZOOM).
   * @returns {number} New zoom level
   */
  zoomIn() {
    const idx = ZOOM_LEVELS.indexOf(this._zoom);
    const next = idx >= 0 && idx < ZOOM_LEVELS.length - 1
      ? ZOOM_LEVELS[idx + 1]
      : MAX_ZOOM;
    return this.setZoom(next);
  }

  /**
   * Decrease zoom by one step (clamped at MIN_ZOOM).
   * @returns {number} New zoom level
   */
  zoomOut() {
    const idx = ZOOM_LEVELS.indexOf(this._zoom);
    const prev = idx > 0 ? ZOOM_LEVELS[idx - 1] : MIN_ZOOM;
    return this.setZoom(prev);
  }

  /**
   * Reset zoom to the default level.
   * @returns {number}
   */
  resetZoom() {
    return this.setZoom(DEFAULT_ZOOM);
  }

  /**
   * Set zoom to the minimum level.
   * @returns {number}
   */
  zoomMin() {
    return this.setZoom(MIN_ZOOM);
  }

  /**
   * Set zoom to the maximum level.
   * @returns {number}
   */
  zoomMax() {
    return this.setZoom(MAX_ZOOM);
  }

  // ---------------------------------------------------------------------------
  // CSS / STYLING
  // ---------------------------------------------------------------------------

  /**
   * Apply pixel-perfect CSS styles to the canvas.
   * Injects a <style> block into <head> and sets inline styles.
   */
  applyCSS() {
    if (this._cssApplied) return;

    const canvas = this._canvas;

    // Inline styles on the canvas element
    canvas.style.imageRendering = "pixelated";
    canvas.style.imageRendering = "-webkit-optimize-contrast";
    canvas.style.imageRendering = "crisp-edges";
    canvas.style.imageRendering = "-moz-crisp-edges";
    canvas.style.msInterpolationMode = "nearest-neighbor";
    canvas.style.boxSizing = "border-box";
    canvas.style.display = "block";

    // Add class for external CSS targeting
    canvas.classList.add(PIXEL_PERFECT_CLASS);

    // Inject global stylesheet for the class
    const styleId = "pixel-perfect-scaler-styles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .${PIXEL_PERFECT_CLASS} {
          image-rendering: pixelated;
          image-rendering: crisp-edges;
          image-rendering: -moz-crisp-edges;
          -ms-interpolation-mode: nearest-neighbor;
        }
      `;
      document.head.appendChild(style);
      this._styleElement = style;
    }

    this._cssApplied = true;
  }

  /**
   * Remove applied CSS styles and restore default canvas appearance.
   */
  removeCSS() {
    const canvas = this._canvas;

    canvas.style.imageRendering = "";
    canvas.style.msInterpolationMode = "";
    canvas.style.boxSizing = "";
    canvas.style.display = "";
    canvas.classList.remove(PIXEL_PERFECT_CLASS);

    if (this._styleElement && this._styleElement.parentNode) {
      this._styleElement.parentNode.removeChild(this._styleElement);
      this._styleElement = null;
    }

    this._cssApplied = false;
  }

  /**
   * Check if CSS has been applied.
   * @returns {boolean}
   */
  hasCSS() {
    return this._cssApplied;
  }

  // ---------------------------------------------------------------------------
  // RESIZE HANDLING
  // ---------------------------------------------------------------------------

  /**
   * Handle window/canvas resize.  Maintains the backing store resolution
   * while recalculating the CSS display size based on the current zoom.
   */
  handleResize() {
    const canvas = this._canvas;

    // Read the current backing store size
    this._backingWidth = canvas.width || 1024;
    this._backingHeight = canvas.height || 768;
    this._dpr = window.devicePixelRatio || 1;

    this._updateCSSSize();
  }

  /**
   * Enable automatic resize tracking via window resize events.
   * The handler is debounced for performance.
   */
  startResizeTracking() {
    if (this._trackingResize) return;

    this._resizeHandler = () => {
      window.clearTimeout(this._resizeTimeout);
      this._resizeTimeout = window.setTimeout(() => {
        this.handleResize();
      }, 100);
    };

    window.addEventListener("resize", this._resizeHandler);
    this._trackingResize = true;
  }

  /**
   * Stop automatic resize tracking.
   */
  stopResizeTracking() {
    if (!this._trackingResize || !this._resizeHandler) return;

    window.removeEventListener("resize", this._resizeHandler);
    this._resizeHandler = null;
    this._trackingResize = false;

    if (this._resizeTimeout) {
      window.clearTimeout(this._resizeTimeout);
      this._resizeTimeout = null;
    }
  }

  /**
   * Check if resize tracking is active.
   * @returns {boolean}
   */
  isTrackingResize() {
    return this._trackingResize;
  }

  // ---------------------------------------------------------------------------
  // COORDINATE CONVERSION
  // ---------------------------------------------------------------------------

  /**
   * Convert screen (CSS pixel) coordinates to canvas backing coordinates.
   * Accounts for zoom: canvasX = screenX / zoom.
   * Result is rounded to the nearest integer.
   *
   * @param {number} screenX - CSS pixel X coordinate
   * @param {number} screenY - CSS pixel Y coordinate
   * @returns {{canvasX: number, canvasY: number}}
   */
  screenToCanvas(screenX, screenY) {
    const zoom = this._zoom;
    return {
      canvasX: this.snapToPixel(screenX / zoom),
      canvasY: this.snapToPixel(screenY / zoom),
    };
  }

  /**
   * Convert canvas backing coordinates to screen (CSS pixel) coordinates.
   * Inverse of screenToCanvas: screenX = canvasX * zoom.
   *
   * @param {number} canvasX - Canvas backing X coordinate
   * @param {number} canvasY - Canvas backing Y coordinate
   * @returns {{screenX: number, screenY: number}}
   */
  canvasToScreen(canvasX, canvasY) {
    const zoom = this._zoom;
    return {
      screenX: this.snapToPixel(canvasX * zoom),
      screenY: this.snapToPixel(canvasY * zoom),
    };
  }

  /**
   * Convert a DOM MouseEvent or Touch to canvas coordinates.
   * Handles getBoundingClientRect offset and zoom scaling.
   *
   * @param {MouseEvent|Touch} event - Input event
   * @returns {{canvasX: number, canvasY: number}}
   */
  eventToCanvas(event) {
    const rect = this._canvas.getBoundingClientRect();
    const screenX = (event.clientX || event.pageX || 0) - rect.left;
    const screenY = (event.clientY || event.pageY || 0) - rect.top;
    return this.screenToCanvas(screenX, screenY);
  }

  /**
   * Convert a DOM MouseEvent to canvas coordinates relative to the backing
   * store, accounting for both CSS zoom and DPR.
   *
   * @param {MouseEvent|Touch} event
   * @returns {{backingX: number, backingY: number}}
   */
  eventToBacking(event) {
    const rect = this._canvas.getBoundingClientRect();
    const cssX = (event.clientX || event.pageX || 0) - rect.left;
    const cssY = (event.clientY || event.pageY || 0) - rect.top;

    const scaleX = this._backingWidth / rect.width;
    const scaleY = this._backingHeight / rect.height;

    return {
      backingX: this.snapToPixel(cssX * scaleX),
      backingY: this.snapToPixel(cssY * scaleY),
    };
  }

  // ---------------------------------------------------------------------------
  // PIXEL-SNAPPING UTILITIES
  // ---------------------------------------------------------------------------

  /**
   * Snap a value to the nearest integer pixel.
   * When strict integer mode is enabled, this always rounds.
   *
   * @param {number} value
   * @returns {number}
   */
  snapToPixel(value) {
    if (this._strictInteger) {
      return Math.round(value);
    }
    return Math.floor(value);
  }

  /**
   * Snap an object with x/y properties to integer pixels.
   *
   * @param {{x:number, y:number}} point
   * @returns {{x:number, y:number}}
   */
  snapPoint(point) {
    return {
      x: this.snapToPixel(point.x),
      y: this.snapToPixel(point.y),
    };
  }

  /**
   * Snap a rectangle to integer pixel boundaries.
   *
   * @param {{x:number, y:number, w:number, h:number}} rect
   * @returns {{x:number, y:number, w:number, h:number}}
   */
  snapRect(rect) {
    return {
      x: this.snapToPixel(rect.x),
      y: this.snapToPixel(rect.y),
      w: this.snapToPixel(rect.w),
      h: this.snapToPixel(rect.h),
    };
  }

  /**
   * Check if a value is already at an integer pixel boundary.
   *
   * @param {number} value
   * @returns {boolean}
   */
  isPixelAligned(value) {
    return Math.abs(value - Math.round(value)) < 0.001;
  }

  // ---------------------------------------------------------------------------
  // SCALING QUERIES
  // ---------------------------------------------------------------------------

  /**
   * Get the current scale factor (same as zoom).
   * @returns {number}
   */
  getScaleFactor() {
    return this._zoom;
  }

  /**
   * Check if the current zoom is an integer value.
   * Always returns true since the scaler only allows integers.
   * @returns {boolean}
   */
  isIntegerScale() {
    return Number.isInteger(this._zoom) && this._zoom >= MIN_ZOOM && this._zoom <= MAX_ZOOM;
  }

  /**
   * Get the ratio of CSS pixels to backing pixels.
   * At zoom=2, backing is half the CSS size per pixel.
   *
   * @returns {number}
   */
  getPixelRatio() {
    return this._zoom;
  }

  /**
   * Get the backing store (canvas internal) dimensions.
   * @returns {{width: number, height: number}}
   */
  getBackingSize() {
    return {
      width: this._backingWidth,
      height: this._backingHeight,
    };
  }

  /**
   * Get the CSS display (screen) dimensions.
   * @returns {{width: number, height: number}}
   */
  getDisplaySize() {
    return {
      width: this._cssWidth,
      height: this._cssHeight,
    };
  }

  // ---------------------------------------------------------------------------
  // CANVAS SIZE MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Set the canvas backing store size.
   * Also updates CSS display size based on current zoom.
   *
   * @param {number} width
   * @param {number} height
   */
  setCanvasSize(width, height) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));

    this._backingWidth = w;
    this._backingHeight = h;
    this._canvas.width = w;
    this._canvas.height = h;

    this._updateCSSSize();
  }

  /**
   * Set the CSS display size directly (independent of backing size).
   * Use with caution — this can break pixel-perfect alignment.
   *
   * @param {number} width
   * @param {number} height
   */
  setDisplaySize(width, height) {
    this._cssWidth = Math.round(width);
    this._cssHeight = Math.round(height);
    this._canvas.style.width = `${this._cssWidth}px`;
    this._canvas.style.height = `${this._cssHeight}px`;
  }

  /**
   * Get the current canvas element.
   * @returns {HTMLCanvasElement}
   */
  getCanvas() {
    return this._canvas;
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Clamp a zoom level to valid integer values.
   * @param {number} zoom
   * @returns {number}
   * @private
   */
  _clampZoom(zoom) {
    const rounded = Math.round(zoom);
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, rounded));
  }

  /**
   * Update the CSS display size based on backing size and zoom.
   * @private
   */
  _updateCSSSize() {
    this._cssWidth = this._backingWidth * this._zoom;
    this._cssHeight = this._backingHeight * this._zoom;

    const canvas = this._canvas;
    canvas.style.width = `${this._cssWidth}px`;
    canvas.style.height = `${this._cssHeight}px`;

    // Ensure pixelated rendering on the element
    if (this._cssApplied) {
      canvas.style.imageRendering = "pixelated";
      canvas.style.imageRendering = "crisp-edges";
    }
  }

  /**
   * Called when the zoom level changes.
   * Can be overridden or used for event emission.
   * @private
   */
  _onZoomChanged() {
    // Reserved for subclasses / event hooks
  }

  // ---------------------------------------------------------------------------
  // FIT-TO-CONTAINER
  // ---------------------------------------------------------------------------

  /**
   * Calculate the maximum integer zoom that fits a target container
   * while maintaining the canvas aspect ratio.
   *
   * @param {number} containerWidth
   * @param {number} containerHeight
   * @returns {number} Recommended zoom level
   */
  fitZoomToContainer(containerWidth, containerHeight) {
    const cw = Math.max(1, containerWidth);
    const ch = Math.max(1, containerHeight);

    const zoomX = Math.floor(cw / this._backingWidth);
    const zoomY = Math.floor(ch / this._backingHeight);
    const fitZoom = Math.max(MIN_ZOOM, Math.min(zoomX, zoomY, MAX_ZOOM));

    return fitZoom;
  }

  /**
   * Fit the canvas to a container element using the maximum integer zoom.
   *
   * @param {HTMLElement} container
   * @returns {number} Applied zoom level
   */
  fitToContainer(container) {
    const rect = container.getBoundingClientRect();
    const zoom = this.fitZoomToContainer(rect.width, rect.height);
    return this.setZoom(zoom);
  }

  /**
   * Center the canvas within its offset parent.
   */
  centerInParent() {
    const canvas = this._canvas;
    canvas.style.marginLeft = "auto";
    canvas.style.marginRight = "auto";
    canvas.style.display = "block";
  }

  // ---------------------------------------------------------------------------
  // STRICT MODE
  // ---------------------------------------------------------------------------

  /**
   * Enable or disable strict integer snapping mode.
   * When strict (default), all coordinates are Math.round()'ed.
   *
   * @param {boolean} enabled
   */
  setStrictInteger(enabled) {
    this._strictInteger = !!enabled;
  }

  /**
   * Check if strict integer snapping is enabled.
   * @returns {boolean}
   */
  isStrictInteger() {
    return this._strictInteger;
  }

  // ---------------------------------------------------------------------------
  // CONTEXT HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Get a 2D context pre-configured for pixel-perfect rendering.
   * Disables all image smoothing modes.
   *
   * @param {Object} [attrs] - Context attributes (alpha, etc.)
   * @returns {CanvasRenderingContext2D}
   */
  getContext(attrs = {}) {
    const ctx = this._canvas.getContext("2d", attrs);
    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    ctx.oImageSmoothingEnabled = false;
    return ctx;
  }

  /**
   * Apply pixel-perfect settings to an existing 2D context.
   *
   * @param {CanvasRenderingContext2D} ctx
   */
  static applyPixelPerfectContext(ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    ctx.oImageSmoothingEnabled = false;
  }

  // ---------------------------------------------------------------------------
  // BATCH COORDINATE CONVERSION
  // ---------------------------------------------------------------------------

  /**
   * Convert an array of screen points to canvas points in one batch.
   *
   * @param {Array<{x:number, y:number}>} points
   * @returns {Array<{x:number, y:number}>}
   */
  batchScreenToCanvas(points) {
    const zoom = this._zoom;
    const out = new Array(points.length);
    for (let i = 0; i < points.length; i++) {
      out[i] = {
        x: this.snapToPixel(points[i].x / zoom),
        y: this.snapToPixel(points[i].y / zoom),
      };
    }
    return out;
  }

  /**
   * Convert an array of canvas points to screen points in one batch.
   *
   * @param {Array<{x:number, y:number}>} points
   * @returns {Array<{x:number, y:number}>}
   */
  batchCanvasToScreen(points) {
    const zoom = this._zoom;
    const out = new Array(points.length);
    for (let i = 0; i < points.length; i++) {
      out[i] = {
        x: this.snapToPixel(points[i].x * zoom),
        y: this.snapToPixel(points[i].y * zoom),
      };
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // LIFECYCLE
  // ---------------------------------------------------------------------------

  /**
   * Clean up resources, remove event listeners, and restore canvas.
   */
  destroy() {
    this.stopResizeTracking();
    this.removeCSS();
    this._canvas = null;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { MIN_ZOOM, MAX_ZOOM, DEFAULT_ZOOM, ZOOM_LEVELS };
