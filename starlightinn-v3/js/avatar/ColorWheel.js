/** @fileoverview ColorWheel.js — Premium HSL Color Picker for Starlight Inn v8.0
 *  A canvas-based color wheel with hue ring, saturation–lightness square,
 *  real-time preview, RGB/HEX read-out, eyedropper, and 24 preset swatches.
 *  @author Starlight Inn UI Team
 *  @version 3.0.0
 */

/**
 * Convert HSL values to RGB object.
 * @param {number} h — Hue in degrees [0,360]
 * @param {number} s — Saturation in percent [0,100]
 * @param {number} l — Lightness in percent [0,100]
 * @returns {{r:number,g:number,b:number}} RGB in range [0,255]
 */
function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return {
    r: Math.round(f(0) * 255),
    g: Math.round(f(8) * 255),
    b: Math.round(f(4) * 255),
  };
}

/**
 * Convert RGB values to HEX string.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {string} HEX color like "#FF5733"
 */
function rgbToHex(r, g, b) {
  const toHex = (c) => c.toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert RGB to HSL.
 * @param {number} r [0,255]
 * @param {number} g [0,255]
 * @param {number} b [0,255]
 * @returns {{h:number,s:number,l:number}}
 */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Parse a HEX string to RGB.
 * @param {string} hex
 * @returns {{r:number,g:number,b:number}|null}
 */
function hexToRgb(hex) {
  const m = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

/** Preset color swatches for skin, hair, and outfit selection. */
const COLOR_PRESETS = [
  // Skin tones (8)
  '#FFDFC4', '#F0D5BE', '#EECFA1', '#E3B887',
  '#D4A76A', '#C68E58', '#A67B5B', '#8D5524',
  // Hair colors (8)
  '#090806', '#2C222B', '#3B302A', '#4E433F',
  '#A55728', '#B55239', '#D6C4C2', '#E6CEA8',
  // Outfit colors (8)
  '#1976D2', '#D32F2F', '#388E3C', '#FBC02D',
  '#7B1FA2', '#00796B', '#E64A19', '#5D4037',
];

/**
 * Premium HSL Color Wheel picker.
 * Renders a 256×256 hue ring + 128×128 S×L square with presets below.
 */
class ColorWheel {
  /**
   * @param {string} canvasId — ID of the <canvas> element.
   * @param {Function} onChange — Callback(color) fired when color changes.
   * @param {Object} [options] — Optional configuration.
   * @param {number} [options.size=256] — Canvas width/height in px.
   * @param {number} [options.presetHeight=48] — Height of the presets row.
   * @param {string} [options.initialColor='#FF5733'] — Starting color HEX.
   */
  constructor(canvasId, onChange, options = {}) {
    /** @type {HTMLCanvasElement|null} */
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      throw new Error(`ColorWheel: canvas #${canvasId} not found`);
    }
    /** @type {CanvasRenderingContext2D} */
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    /** @type {Function} */
    this.onChange = onChange;

    /** @type {number} */
    this.size = options.size || 256;
    /** @type {number} */
    this.presetHeight = options.presetHeight || 48;
    /** @type {number} */
    this.centerX = this.size / 2;
    /** @type {number} */
    this.centerY = this.size / 2;
    /** @type {number} */
    this.radius = Math.floor(this.size / 2) - 16;
    /** @type {number} */
    this.innerRadius = this.radius - 28;
    /** @type {number} */
    this.squareSize = Math.floor(this.innerRadius * Math.sqrt(2));

    // HSL state
    /** @type {number} Hue [0,360] */
    this.h = 0;
    /** @type {number} Saturation [0,100] */
    this.s = 100;
    /** @type {number} Lightness [0,100] */
    this.l = 50;

    // Interaction state
    /** @type {boolean} */
    this.isDragging = false;
    /** @type {'ring'|'square'|null} */
    this.dragTarget = null;
    /** @type {boolean} */
    this.isEyeDropperActive = false;

    // Setup canvas dimensions
    this.canvas.width = this.size;
    this.canvas.height = this.size + this.presetHeight + 8;
    this.canvas.style.cursor = 'crosshair';

    // Initialize from optional starting color
    const initial = options.initialColor || '#FF5733';
    this.setColor(initial);

    this._buildPresetSwatches();
    this._setupEvents();
    this.draw();
  }

  /**
   * Set the current color from a HEX string.
   * @param {string} hex
   */
  setColor(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return;
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    this.h = hsl.h;
    this.s = hsl.s;
    this.l = hsl.l;
    this._notify();
    this.draw();
  }

  /**
   * Get the current color as a rich object.
   * @returns {{h:number,s:number,l:number,hex:string,rgb:{r:number,g:number,b:number},rgba:string}}
   */
  getColor() {
    const rgb = hslToRgb(this.h, this.s, this.l);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    return {
      h: this.h,
      s: this.s,
      l: this.l,
      hex,
      rgb,
      rgba: `rgba(${rgb.r},${rgb.g},${rgb.b},1)`,
    };
  }

  /** @private — Notify callback with current color. */
  _notify() {
    if (typeof this.onChange === 'function') {
      this.onChange(this.getColor());
    }
  }

  /** @private — Build the 24 preset color swatches below the wheel. */
  _buildPresetSwatches() {
    const presetCount = COLOR_PRESETS.length; // 24
    const cols = 8;
    const rows = Math.ceil(presetCount / cols);
    const pad = 4;
    const swatchW = Math.floor((this.size - (cols + 1) * pad) / cols);
    const swatchH = Math.floor((this.presetHeight - (rows + 1) * pad) / rows);
    const startY = this.size + 4;

    this._presets = COLOR_PRESETS.map((hex, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return {
        hex,
        x: pad + col * (swatchW + pad),
        y: startY + row * (swatchH + pad),
        w: swatchW,
        h: swatchH,
      };
    });
  }

  /** @private — Attach mouse/touch event listeners. */
  _setupEvents() {
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);

    this.canvas.addEventListener('mousedown', this._onMouseDown);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);

    this.canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
    document.addEventListener('touchend', this._onTouchEnd);
  }

  /** @private — Get pointer position relative to canvas. */
  _getPos(evt) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  /** @private — Determine if point is in hue ring. */
  _isInRing(x, y) {
    const dx = x - this.centerX;
    const dy = y - this.centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist >= this.innerRadius && dist <= this.radius;
  }

  /** @private — Determine if point is in S×L square. */
  _isInSquare(x, y) {
    const half = this.squareSize / 2;
    return (
      x >= this.centerX - half &&
      x <= this.centerX + half &&
      y >= this.centerY - half &&
      y <= this.centerY + half
    );
  }

  /** @private — Check preset swatch hit. */
  _hitPreset(x, y) {
    for (const p of this._presets) {
      if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) {
        return p;
      }
    }
    return null;
  }

  /** @private — Handle mousedown. */
  _onMouseDown(evt) {
    const { x, y } = this._getPos(evt);
    if (this.isEyeDropperActive) {
      this._sampleColorAt(x, y);
      this.isEyeDropperActive = false;
      this.canvas.style.cursor = 'crosshair';
      return;
    }
    const preset = this._hitPreset(x, y);
    if (preset) {
      this.setColor(preset.hex);
      return;
    }
    if (this._isInRing(x, y)) {
      this.isDragging = true;
      this.dragTarget = 'ring';
      this._updateHueFromPos(x, y);
    } else if (this._isInSquare(x, y)) {
      this.isDragging = true;
      this.dragTarget = 'square';
      this._updateSlFromPos(x, y);
    }
  }

  /** @private — Handle mousemove. */
  _onMouseMove(evt) {
    const { x, y } = this._getPos(evt);
    if (!this.isDragging) {
      // Hover cursor feedback
      if (this._hitPreset(x, y)) {
        this.canvas.style.cursor = 'pointer';
      } else if (this._isInRing(x, y) || this._isInSquare(x, y)) {
        this.canvas.style.cursor = 'crosshair';
      } else {
        this.canvas.style.cursor = 'default';
      }
      return;
    }
    if (this.dragTarget === 'ring') {
      this._updateHueFromPos(x, y);
    } else if (this.dragTarget === 'square') {
      this._updateSlFromPos(x, y);
    }
  }

  /** @private — Handle mouseup. */
  _onMouseUp() {
    this.isDragging = false;
    this.dragTarget = null;
  }

  /** @private — Touch handlers wrapper. */
  _onTouchStart(evt) {
    evt.preventDefault();
    this._onMouseDown(evt);
  }
  _onTouchMove(evt) {
    evt.preventDefault();
    this._onMouseMove(evt);
  }
  _onTouchEnd(evt) {
    evt.preventDefault();
    this._onMouseUp();
  }

  /** @private — Update hue from ring position. */
  _updateHueFromPos(x, y) {
    const dx = x - this.centerX;
    const dy = y - this.centerY;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    angle = (angle + 360) % 360;
    this.h = Math.round(angle);
    this._notify();
    this.draw();
  }

  /** @private — Update saturation & lightness from square position. */
  _updateSlFromPos(x, y) {
    const half = this.squareSize / 2;
    let sx = (x - (this.centerX - half)) / this.squareSize;
    let sy = (y - (this.centerY - half)) / this.squareSize;
    sx = Math.max(0, Math.min(1, sx));
    sy = Math.max(0, Math.min(1, sy));
    // Horizontal axis = saturation (0→100)
    // Vertical axis = lightness (100→0) so top is bright
    this.s = Math.round(sx * 100);
    this.l = Math.round((1 - sy) * 100);
    this._notify();
    this.draw();
  }

  /** @private — Sample a color from canvas pixel (eyedropper). */
  _sampleColorAt(x, y) {
    x = Math.max(0, Math.min(this.size - 1, x));
    y = Math.max(0, Math.min(this.size - 1, y));
    const pixel = this.ctx.getImageData(x, y, 1, 1).data;
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
    this.setColor(hex);
  }

  /** Activate the eyedropper tool. */
  activateEyeDropper() {
    this.isEyeDropperActive = true;
    this.canvas.style.cursor = 'copy';
  }

  /** Dispose event listeners. */
  destroy() {
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
    this.canvas.removeEventListener('touchstart', this._onTouchStart);
    this.canvas.removeEventListener('touchmove', this._onTouchMove);
    document.removeEventListener('touchend', this._onTouchEnd);
  }

  /** Main draw entry point. Renders the entire widget. */
  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this._drawHueRing();
    this._drawSquare();
    this._drawRingSelector();
    this._drawSquareSelector();
    this._drawCenterPreview();
    this._drawPresets();
    this._drawLabels();
  }

  /** @private — Render the outer hue ring with smooth conic gradient. */
  _drawHueRing() {
    const ctx = this.ctx;
    const { centerX, centerY, radius, innerRadius } = this;

    // Create a conic gradient for 0→360 hue
    const gradient = ctx.createConicGradient(0, centerX, centerY);
    for (let i = 0; i <= 360; i += 30) {
      gradient.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
    }

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2, true);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Subtle border ring
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /** @private — Render the inner saturation × lightness square. */
  _drawSquare() {
    const ctx = this.ctx;
    const half = this.squareSize / 2;
    const x = this.centerX - half;
    const y = this.centerY - half;

    // White→ hue gradient (horizontal: saturation)
    const gradH = ctx.createLinearGradient(x, y, x + this.squareSize, y);
    gradH.addColorStop(0, '#fff');
    gradH.addColorStop(1, `hsl(${this.h}, 100%, 50%)`);

    // Dark overlay (vertical: lightness)
    const gradV = ctx.createLinearGradient(x, y, x, y + this.squareSize);
    gradV.addColorStop(0, 'rgba(0,0,0,0)');
    gradV.addColorStop(1, 'rgba(0,0,0,1)');

    ctx.fillStyle = gradH;
    ctx.fillRect(x, y, this.squareSize, this.squareSize);
    ctx.fillStyle = gradV;
    ctx.fillRect(x, y, this.squareSize, this.squareSize);

    // Square border
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, this.squareSize, this.squareSize);
  }

  /** @private — Draw the hue selector indicator on the ring. */
  _drawRingSelector() {
    const ctx = this.ctx;
    const angle = (this.h * Math.PI) / 180;
    const r = (this.radius + this.innerRadius) / 2;
    const x = this.centerX + Math.cos(angle) * r;
    const y = this.centerY + Math.sin(angle) * r;

    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Small inner dot shows the actual hue color
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${this.h}, 100%, 50%)`;
    ctx.fill();
  }

  /** @private — Draw the S×L selector indicator inside the square. */
  _drawSquareSelector() {
    const ctx = this.ctx;
    const half = this.squareSize / 2;
    const sx = (this.s / 100) * this.squareSize;
    const sy = (1 - this.l / 100) * this.squareSize;
    const x = this.centerX - half + sx;
    const y = this.centerY - half + sy;

    // Outer white ring for contrast
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner dot with current color
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${this.h}, ${this.s}%, ${this.l}%)`;
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /** @private — Draw a color preview disc in the very center. */
  _drawCenterPreview() {
    const ctx = this.ctx;
    const r = this.innerRadius * 0.25;
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, r, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${this.h}, ${this.s}%, ${this.l}%)`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /** @private — Render the 24 preset swatches. */
  _drawPresets() {
    const ctx = this.ctx;
    for (const p of this._presets) {
      ctx.fillStyle = p.hex;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x, p.y, p.w, p.h);

      // Highlight if this preset matches current color
      const rgb = hslToRgb(this.h, this.s, this.l);
      const currentHex = rgbToHex(rgb.r, rgb.g, rgb.b);
      if (currentHex === p.hex) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2);
      }
    }
  }

  /** @private — Draw RGB/HEX text labels below presets. */
  _drawLabels() {
    const ctx = this.ctx;
    const rgb = hslToRgb(this.h, this.s, this.l);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    const labelY = this.size + this.presetHeight + 2;

    ctx.font = '11px monospace';
    ctx.fillStyle = '#cccccc';
    ctx.textAlign = 'left';
    ctx.fillText(`HEX ${hex}`, 8, labelY + 10);
    ctx.textAlign = 'right';
    ctx.fillText(`RGB ${rgb.r},${rgb.g},${rgb.b}`, this.size - 8, labelY + 10);
    ctx.textAlign = 'center';
    ctx.fillText(`HSL ${this.h}° ${this.s}% ${this.l}%`, this.size / 2, labelY + 24);
  }
}

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ColorWheel, hslToRgb, rgbToHex, hexToRgb, rgbToHsl, COLOR_PRESETS };
}
