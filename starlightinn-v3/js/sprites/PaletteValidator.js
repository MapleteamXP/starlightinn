/**
 * PaletteValidator.js
 * =================
 * Enforces the strict flat-color palette constraints for all sprites
 * in Starlight Inn v6.0. Ensures every sprite conforms to the Habbo Hotel
 * aesthetic: limited colors, solid black outlines, no gradients,
 * no anti-aliasing, and fully opaque fills.
 *
 * Provides validation, auto-repair, and palette suggestion utilities.
 *
 * @module sprites/PaletteValidator
 * @version 6.0.0
 * @author Starlight Inn Team
 */

import { PALETTES } from './PaletteManager.js';
import { COLOR_RULES } from './ColorTable.js';

// =============================================================================
// Requirement Constants
// =============================================================================

/**
 * Immutable requirements object defining all palette constraints.
 * Used by the validator to check compliance and drive auto-repair.
 *
 * @constant
 * @type {PaletteRequirements}
 */
export const REQUIREMENTS = {
  /** Maximum unique colors allowed per sprite. */
  maxColorsPerSprite: 6,

  /** Every sprite must have a solid black outline. */
  mustHaveOutline: true,

  /** The canonical outline color. */
  outlineColor: '#000000',

  /** Gradient fills are strictly prohibited. */
  noGradients: true,

  /** Anti-aliased (semi-transparent) edge pixels are prohibited. */
  noAntiAliasing: true,

  /** Semi-transparent fill colors (0 < alpha < 255) are prohibited. */
  noSemiTransparent: true,

  /** All fills must be flat, solid colors. */
  mustBeFlatFill: true,

  /** Minimum distance (in RGB squared units) between distinct sprite colors. */
  minColorSeparation: 200
};

// =============================================================================
// PaletteValidator Class
// =============================================================================

/**
 * Validates and enforces palette constraints on sprite canvases.
 * Performs pixel-level analysis to ensure compliance with the
 * flat, vibrant, limited-color aesthetic.
 *
 * @class PaletteValidator
 */
export class PaletteValidator {
  /**
   * Creates a new PaletteValidator with default requirements.
   *
   * @constructor
   * @param {Object} [options] — Optional overrides for requirements.
   */
  constructor(options = {}) {
    /**
     * Active requirements for this validator instance.
     * @private
     * @type {PaletteRequirements}
     */
    this._requirements = { ...REQUIREMENTS, ...options };

    /**
     * Cache for parsed palette RGB values.
     * @private
     * @type {Map<string, number[][]>}
     */
    this._paletteRgbCache = new Map();
  }

  /**
   * Analyzes a sprite canvas and returns a comprehensive validation report.
   * Checks color count, outline presence, gradients, anti-aliasing,
   * and alpha channel compliance.
   *
   * @param {HTMLCanvasElement|OffscreenCanvas} canvas — The sprite canvas.
   * @param {number} [maxColors=6] — Maximum allowed unique colors.
   * @returns {SpriteValidationReport} Detailed validation results.
   *
   * @example
   * const report = validator.validateSprite(spriteCanvas);
   * if (!report.valid) console.log(report.violations);
   */
  validateSprite(canvas, maxColors = this._requirements.maxColorsPerSprite) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      return {
        valid: false,
        colorCount: 0,
        excessColors: [],
        violations: ['Invalid canvas provided.'],
        hasOutline: false,
        hasGradients: false,
        hasAntiAliasing: false,
        hasSemiTransparent: false
      };
    }

    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const violations = [];
    const uniqueColors = new Set();
    const colorFrequency = new Map();
    let hasSemiTransparent = false;
    let hasAntiAliasing = false;
    let outlinePixelCount = 0;

    // Scan every pixel.
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a === 0) continue; // Fully transparent — not part of the sprite.

      const hex = `#${[r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')}`;
      uniqueColors.add(hex);
      colorFrequency.set(hex, (colorFrequency.get(hex) || 0) + 1);

      // Check semi-transparent fill.
      if (a > 0 && a < 255) {
        hasSemiTransparent = true;
        if (this._requirements.noSemiTransparent) {
          hasAntiAliasing = true;
        }
      }

      // Check outline color frequency.
      if (hex === this._requirements.outlineColor) {
        outlinePixelCount++;
      }
    }

    const colorCount = uniqueColors.size;
    const excessColors = colorCount > maxColors
      ? Array.from(uniqueColors).slice(maxColors)
      : [];

    if (colorCount > maxColors) {
      violations.push(`Sprite uses ${colorCount} colors, max allowed is ${maxColors}.`);
    }

    const hasOutline = outlinePixelCount > 0;
    if (!hasOutline && this._requirements.mustHaveOutline) {
      violations.push('Sprite is missing a black outline.');
    }

    if (hasSemiTransparent && this._requirements.noSemiTransparent) {
      violations.push('Sprite contains semi-transparent pixels (alpha < 255).');
    }

    if (hasAntiAliasing && this._requirements.noAntiAliasing) {
      violations.push('Sprite shows anti-aliasing (semi-transparent edges).');
    }

    // Gradient check (expensive — done after simpler checks).
    const hasGradients = this._detectGradients(ctx, canvas.width, canvas.height);
    if (hasGradients && this._requirements.noGradients) {
      violations.push('Sprite contains gradient-like color transitions.');
    }

    const valid = violations.length === 0;

    return {
      valid,
      colorCount,
      excessColors,
      violations,
      hasOutline,
      hasGradients,
      hasAntiAliasing,
      hasSemiTransparent,
      colorFrequency: Object.fromEntries(colorFrequency),
      outlinePixelCount
    };
  }

  /**
   * Ensures a sprite has at minimum a 1-pixel black outline.
   * If no outline is detected, this method traces the opaque edges
   * of the sprite with the canonical outline color.
   *
   * @param {HTMLCanvasElement|OffscreenCanvas} canvas — The sprite canvas.
   * @returns {HTMLCanvasElement|OffscreenCanvas} The canvas with outline enforced.
   *
   * @example
   * validator.enforceBlackOutline(mySprite);
   */
  enforceBlackOutline(canvas) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      console.warn('[PaletteValidator] enforceBlackOutline: invalid canvas.');
      return canvas;
    }

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const outlineR = 0, outlineG = 0, outlineB = 0;
    const outlineHex = this._requirements.outlineColor;
    let alreadyHasOutline = false;
    let outlinePixels = 0;

    // Quick pass: check if outline already exists.
    for (let i = 0; i < data.length; i += 4) {
      const hex = `#${[data[i], data[i + 1], data[i + 2]].map(c => c.toString(16).padStart(2, '0')).join('')}`;
      if (hex === outlineHex) {
        outlinePixels++;
        if (outlinePixels > 5) {
          alreadyHasOutline = true;
          break;
        }
      }
    }

    if (alreadyHasOutline) return canvas;

    // Build a mask of opaque pixels.
    const opaqueMask = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        opaqueMask[y * width + x] = data[idx + 3] > 0 ? 1 : 0;
      }
    }

    // Trace outline: any transparent pixel adjacent to an opaque pixel becomes outline.
    const outlineSet = new Set();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (opaqueMask[idx] === 1) continue; // Only draw outline around opaque areas.

        // Check 4-connected neighbors.
        const neighbors = [
          { nx: x - 1, ny: y },
          { nx: x + 1, ny: y },
          { nx: x, ny: y - 1 },
          { nx: x, ny: y + 1 }
        ];

        for (const { nx, ny } of neighbors) {
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (opaqueMask[ny * width + nx] === 1) {
              outlineSet.add(idx);
              break;
            }
          }
        }
      }
    }

    // Apply outline pixels.
    for (const idx of outlineSet) {
      const pxIdx = idx * 4;
      data[pxIdx] = outlineR;
      data[pxIdx + 1] = outlineG;
      data[pxIdx + 2] = outlineB;
      data[pxIdx + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  /**
   * Scans a sprite canvas for gradient-like color transitions.
   * A gradient is detected when there are many unique intermediate
   * colors between two primary colors along a scanline.
   *
   * @param {CanvasRenderingContext2D} ctx — The 2D context.
   * @param {number} width — Canvas width.
   * @param {number} height — Canvas height.
   * @returns {boolean} True if gradient-like transitions are detected.
   * @private
   */
  _detectGradients(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Sample horizontal scanlines at 4-pixel intervals.
    const scanInterval = 4;
    let gradientScore = 0;

    for (let y = 0; y < height; y += scanInterval) {
      const rowColors = [];
      for (let x = 0; x < width; x += scanInterval) {
        const idx = (y * width + x) * 4;
        if (data[idx + 3] === 0) continue;
        const hex = `#${[data[idx], data[idx + 1], data[idx + 2]].map(c => c.toString(16).padStart(2, '0')).join('')}`;
        rowColors.push(hex);
      }

      // Count unique colors in this scanline.
      const uniqueInRow = new Set(rowColors).size;
      if (uniqueInRow > 4) {
        gradientScore += uniqueInRow - 4;
      }
    }

    // Threshold: if gradient score is high across many scanlines, flag as gradient.
    const threshold = Math.max(10, width * height / 400);
    return gradientScore > threshold;
  }

  /**
   * Checks whether a sprite canvas contains anti-aliased edge pixels.
   * Anti-aliasing is detected as semi-transparent pixels (0 < alpha < 255)
   * that sit at the boundary between transparent and opaque regions.
   *
   * @param {HTMLCanvasElement|OffscreenCanvas} canvas — The sprite canvas.
   * @returns {boolean} True if anti-aliasing is detected.
   */
  checkNoAntiAliasing(canvas) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      console.warn('[PaletteValidator] checkNoAntiAliasing: invalid canvas.');
      return false;
    }

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const alpha = data[idx + 3];

        if (alpha > 0 && alpha < 255) {
          // Check if adjacent to both transparent and opaque pixels.
          let hasTransparentNeighbor = false;
          let hasOpaqueNeighbor = false;

          const neighbors = [
            ((y - 1) * width + x) * 4,
            ((y + 1) * width + x) * 4,
            (y * width + (x - 1)) * 4,
            (y * width + (x + 1)) * 4
          ];

          for (const nIdx of neighbors) {
            if (data[nIdx + 3] === 0) hasTransparentNeighbor = true;
            if (data[nIdx + 3] === 255) hasOpaqueNeighbor = true;
          }

          if (hasTransparentNeighbor && hasOpaqueNeighbor) {
            return true; // Anti-aliasing detected.
          }
        }
      }
    }

    return false;
  }

  /**
   * Checks whether a sprite canvas contains any semi-transparent fill colors.
   * Pixels with 0 < alpha < 255 (that are not at transparent edges)
   * are considered violations.
   *
   * @param {HTMLCanvasElement|OffscreenCanvas} canvas — The sprite canvas.
   * @returns {boolean} True if semi-transparent fills are found.
   */
  checkFlatColors(canvas) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      console.warn('[PaletteValidator] checkFlatColors: invalid canvas.');
      return false;
    }

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0 && data[i] < 255) {
        return true;
      }
    }

    return false;
  }

  /**
   * Remaps every color in a sprite canvas to the closest color
   * in a target palette. Fully transparent pixels are preserved.
   *
   * @param {HTMLCanvasElement|OffscreenCanvas} canvas — The sprite canvas.
   * @param {GamePalette|string} palette — Target palette or palette name.
   * @returns {HTMLCanvasElement|OffscreenCanvas} The recolored canvas.
   *
   * @example
   * validator.remapToPalette(spriteCanvas, 'Warm');
   */
  remapToPalette(canvas, palette) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      console.warn('[PaletteValidator] remapToPalette: invalid canvas.');
      return canvas;
    }

    let pal;
    if (typeof palette === 'string') {
      pal = PALETTES[palette];
    } else {
      pal = palette;
    }

    if (!pal) {
      console.warn('[PaletteValidator] remapToPalette: invalid palette.');
      return canvas;
    }

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Build palette RGB array.
    const paletteEntries = Object.entries(pal.colors);
    const paletteRgbs = paletteEntries.map(([_, hex]) => this._hexToRgbArray(hex));

    // Remap every opaque pixel.
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      let bestIdx = 0;
      let bestDist = Infinity;

      for (let j = 0; j < paletteRgbs.length; j++) {
        const pr = paletteRgbs[j][0] - r;
        const pg = paletteRgbs[j][1] - g;
        const pb = paletteRgbs[j][2] - b;
        const dist = pr * pr + pg * pg + pb * pb;
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = j;
        }
      }

      const match = paletteRgbs[bestIdx];
      data[i] = match[0];
      data[i + 1] = match[1];
      data[i + 2] = match[2];
      data[i + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  /**
   * Extracts every unique opaque color used in a sprite canvas.
   *
   * @param {HTMLCanvasElement|OffscreenCanvas} canvas — The sprite canvas.
   * @returns {string[]} Array of unique hex color strings (e.g., ['#FF0000', '#00FF00']).
   *
   * @example
   * const colors = validator.getSpriteColors(spriteCanvas);
   * console.log(colors.length); // 4
   */
  getSpriteColors(canvas) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      console.warn('[PaletteValidator] getSpriteColors: invalid canvas.');
      return [];
    }

    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const colors = new Set();

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const hex = `#${[data[i], data[i + 1], data[i + 2]].map(c => c.toString(16).padStart(2, '0')).join('')}`;
      colors.add(hex);
    }

    return Array.from(colors);
  }

  /**
   * Suggests the best matching predefined palette for a given set
   * of sprite colors. Uses Euclidean distance in RGB space.
   *
   * @param {string[]} spriteColors — Array of hex colors from a sprite.
   * @returns {{name: string, score: number, palette: GamePalette}|null} Best match.
   *
   * @example
   * const suggestion = validator.suggestPalette(['#8B6914', '#D4A84B', '#5C4311']);
   * console.log(suggestion.name); // 'Warm'
   */
  suggestPalette(spriteColors) {
    if (!Array.isArray(spriteColors) || spriteColors.length === 0) {
      console.warn('[PaletteValidator] suggestPalette: invalid spriteColors array.');
      return null;
    }

    let bestName = null;
    let bestScore = Infinity;
    let bestPalette = null;

    for (const [name, palette] of Object.entries(PALETTES)) {
      const paletteColors = Object.values(palette.colors);
      let totalDist = 0;
      let matched = 0;

      for (const spriteHex of spriteColors) {
        const [sr, sg, sb] = this._hexToRgbArray(spriteHex);
        let minDist = Infinity;

        for (const palHex of paletteColors) {
          const [pr, pg, pb] = this._hexToRgbArray(palHex);
          const dist = (sr - pr) ** 2 + (sg - pg) ** 2 + (sb - pb) ** 2;
          if (dist < minDist) minDist = dist;
        }

        totalDist += minDist;
        matched++;
      }

      const avgDist = matched > 0 ? totalDist / matched : Infinity;
      if (avgDist < bestScore) {
        bestScore = avgDist;
        bestName = name;
        bestPalette = palette;
      }
    }

    return {
      name: bestName,
      score: Math.round(bestScore),
      palette: bestPalette
    };
  }

  /**
   * Auto-repairs a sprite canvas to comply with palette rules.
   * Performs the following steps in order:
   *   1. Quantize colors to target palette.
   *   2. Remove semi-transparent pixels (flatten alpha).
   *   3. Enforce black outline.
   *   4. Reduce color count if still over maxColors.
   *
   * @param {HTMLCanvasElement|OffscreenCanvas} canvas — The sprite canvas.
   * @param {GamePalette|string} targetPalette — Target palette or name.
   * @param {Object} [options] — Repair options.
   * @param {number} [options.maxColors=6] — Maximum allowed colors after repair.
   * @returns {SpriteRepairReport} Report of repairs applied.
   *
   * @example
   * const report = validator.repairSprite(spriteCanvas, 'Warm');
   * console.log(report.steps); // ['remap', 'flattenAlpha', 'outline', 'reduce']
   */
  repairSprite(canvas, targetPalette, options = {}) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      return {
        success: false,
        steps: [],
        originalColors: 0,
        finalColors: 0,
        error: 'Invalid canvas provided.'
      };
    }

    const maxColors = options.maxColors ?? this._requirements.maxColorsPerSprite;
    const steps = [];

    // Resolve palette.
    let pal;
    if (typeof targetPalette === 'string') {
      pal = PALETTES[targetPalette];
    } else {
      pal = targetPalette;
    }

    if (!pal) {
      return {
        success: false,
        steps: [],
        originalColors: 0,
        finalColors: 0,
        error: 'Invalid target palette provided.'
      };
    }

    const originalColors = this.getSpriteColors(canvas).length;

    // Step 1: Remap to target palette.
    this.remapToPalette(canvas, pal);
    steps.push('remap');

    // Step 2: Flatten all semi-transparent alphas.
    this._flattenAlpha(canvas);
    steps.push('flattenAlpha');

    // Step 3: Enforce black outline.
    this.enforceBlackOutline(canvas);
    steps.push('outline');

    // Step 4: Reduce color count if still over max.
    const currentColors = this.getSpriteColors(canvas);
    if (currentColors.length > maxColors) {
      this._reduceColorCount(canvas, pal, maxColors);
      steps.push('reduce');
    }

    const finalColors = this.getSpriteColors(canvas).length;

    return {
      success: true,
      steps,
      originalColors,
      finalColors,
      paletteUsed: pal.name,
      compliant: finalColors <= maxColors
    };
  }

  /**
   * Flattens all non-zero alpha values to 255.
   * Removes any semi-transparency from the sprite.
   *
   * @param {HTMLCanvasElement|OffscreenCanvas} canvas — The sprite canvas.
   * @private
   */
  _flattenAlpha(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) {
        data[i] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Reduces the number of unique colors in a sprite by merging
   * the least frequent colors into their nearest palette neighbors.
   *
   * @param {HTMLCanvasElement|OffscreenCanvas} canvas — The sprite canvas.
   * @param {GamePalette} palette — The palette to quantize toward.
   * @param {number} targetCount — Desired maximum color count.
   * @private
   */
  _reduceColorCount(canvas, palette, targetCount) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Count frequency of each opaque color.
    const freq = new Map();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const hex = `#${[data[i], data[i + 1], data[i + 2]].map(c => c.toString(16).padStart(2, '0')).join('')}`;
      freq.set(hex, (freq.get(hex) || 0) + 1);
    }

    const sorted = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]);
    if (sorted.length <= targetCount) return;

    // Keep the top (targetCount - 1) most frequent colors, remap the rest.
    const keepColors = new Set(sorted.slice(0, targetCount - 1).map(([hex]) => hex));
    // Always keep outline color.
    keepColors.add(this._requirements.outlineColor);

    // Precompute nearest keep-color for each discarded color.
    const remapMap = new Map();
    for (const [hex] of sorted.slice(targetCount - 1)) {
      if (keepColors.has(hex)) continue;
      let best = this._requirements.outlineColor;
      let bestDist = Infinity;
      const [r1, g1, b1] = this._hexToRgbArray(hex);

      for (const keepHex of keepColors) {
        const [r2, g2, b2] = this._hexToRgbArray(keepHex);
        const dist = (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          best = keepHex;
        }
      }
      remapMap.set(hex, best);
    }

    // Apply remapping.
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const hex = `#${[data[i], data[i + 1], data[i + 2]].map(c => c.toString(16).padStart(2, '0')).join('')}`;
      if (remapMap.has(hex)) {
        const target = remapMap.get(hex);
        const [tr, tg, tb] = this._hexToRgbArray(target);
        data[i] = tr;
        data[i + 1] = tg;
        data[i + 2] = tb;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Converts a hex string to an [R, G, B] array.
   *
   * @param {string} hex — Hex color string.
   * @returns {number[]} [R, G, B] values.
   * @private
   */
  _hexToRgbArray(hex) {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean, 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
  }
}

// =============================================================================
// Standalone Utility Functions
// =============================================================================

/**
 * Quickly checks whether a canvas is palette-compliant without
 * constructing a full PaletteValidator instance.
 *
 * @param {HTMLCanvasElement|OffscreenCanvas} canvas — The sprite canvas.
 * @returns {boolean} True if the sprite passes all basic checks.
 */
export function quickValidate(canvas) {
  if (!canvas || typeof canvas.getContext !== 'function') return false;
  const validator = new PaletteValidator();
  const report = validator.validateSprite(canvas);
  return report.valid;
}

/**
 * Returns a summary string describing a sprite's color usage.
 * Useful for debug logging and profiling.
 *
 * @param {HTMLCanvasElement|OffscreenCanvas} canvas — The sprite canvas.
 * @returns {string} Human-readable summary.
 */
export function colorSummary(canvas) {
  if (!canvas || typeof canvas.getContext !== 'function') {
    return 'Invalid canvas.';
  }
  const validator = new PaletteValidator();
  const colors = validator.getSpriteColors(canvas);
  const report = validator.validateSprite(canvas);
  const suggestion = validator.suggestPalette(colors);

  return [
    `Sprite: ${canvas.width}x${canvas.height}`,
    `Colors: ${colors.length} / ${REQUIREMENTS.maxColorsPerSprite} max`,
    `Outline: ${report.hasOutline ? 'yes' : 'NO'}`,
    `Anti-alias: ${report.hasAntiAliasing ? 'YES' : 'no'}`,
    `Semi-transparent: ${report.hasSemiTransparent ? 'YES' : 'no'}`,
    `Gradients: ${report.hasGradients ? 'YES' : 'no'}`,
    `Suggested palette: ${suggestion ? suggestion.name : 'none'}`,
    `Valid: ${report.valid ? 'YES' : 'NO'}`
  ].join(' | ');
}

// =============================================================================
// Batch Validation
// =============================================================================

/**
 * Validates an array of sprite canvases and returns a batch report.
 *
 * @param {Array<HTMLCanvasElement|OffscreenCanvas>} canvases — Sprites to validate.
 * @returns {BatchValidationReport} Summary of all validations.
 */
export function batchValidate(canvases) {
  if (!Array.isArray(canvases)) {
    console.warn('[PaletteValidator] batchValidate: expected array of canvases.');
    return { total: 0, valid: 0, invalid: 0, reports: [] };
  }

  const validator = new PaletteValidator();
  const reports = [];
  let validCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < canvases.length; i++) {
    const canvas = canvases[i];
    const report = validator.validateSprite(canvas);
    reports.push({ index: i, valid: report.valid, report });
    if (report.valid) validCount++;
    else invalidCount++;
  }

  return {
    total: canvases.length,
    valid: validCount,
    invalid: invalidCount,
    reports
  };
}

// =============================================================================
// Default Export
// =============================================================================

export default PaletteValidator;
