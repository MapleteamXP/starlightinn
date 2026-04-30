/**
 * PaletteValidator.js -- v6.0
 * Enforces Habbo-grade palette rules:
 * - max 6 colors per sprite
 * - black outline required
 * - no gradients
 * - no anti-aliasing
 */

import { ColorTable } from './ColorTable.js';

export class PaletteValidator {
  static MAX_COLORS = 6;
  static OUTLINE_COLOR = '#000000';

  /**
   * Validates a palette (array of hex color strings).
   * Returns { valid: boolean, errors: string[], normalized: string[] }.
   */
  static validate(palette) {
    const errors = [];
    const normalized = [];
    const seen = new Set();

    if (!Array.isArray(palette)) {
      errors.push('Palette must be an array of hex color strings');
      return { valid: false, errors, normalized: [] };
    }

    for (const c of palette) {
      const hex = this._normalize(c);
      if (!hex) {
        errors.push(`Invalid color: "${c}"`);
        continue;
      }
      if (!seen.has(hex)) {
        seen.add(hex);
        normalized.push(hex);
      }
    }

    if (normalized.length > this.MAX_COLORS) {
      errors.push(`Too many colors (${normalized.length} > max ${this.MAX_COLORS})`);
    }

    const hasOutline = normalized.some(c => c === this.OUTLINE_COLOR);
    if (!hasOutline) {
      errors.push('Missing black outline (#000000)');
    }

    const valid = errors.length === 0;
    return { valid, errors, normalized };
  }

  /**
   * Reduces a palette to at most MAX_COLORS, preserving outline.
   */
  static constrain(palette) {
    const { normalized } = this.validate(palette);
    const hasOutline = normalized.includes(this.OUTLINE_COLOR);
    const fillColors = normalized.filter(c => c !== this.OUTLINE_COLOR);
    const keep = fillColors.slice(0, this.MAX_COLORS - (hasOutline ? 1 : 0));
    return hasOutline ? [this.OUTLINE_COLOR, ...keep] : keep;
  }

  /**
   * Checks if a pixel grid contains any gradients (intermediate colors not in palette).
   */
  static checkGradients(pixelGrid, palette) {
    const allowed = new Set(palette.map(c => this._normalize(c)).filter(Boolean));
    const offenders = [];
    for (let y = 0; y < pixelGrid.length; y++) {
      const row = pixelGrid[y];
      for (let x = 0; x < row.length; x++) {
        const color = this._normalize(row[x]);
        if (color && !allowed.has(color)) {
          offenders.push({ x, y, color });
        }
      }
    }
    return {
      hasGradients: offenders.length > 0,
      offenders: offenders.slice(0, 20),
    };
  }

  /**
   * Detects anti-aliasing by checking for edge colors that are blended.
   * Returns true if any non-palette colors are found on edges.
   */
  static checkAntiAliasing(canvasOrGrid, palette) {
    // Simple heuristic: any color not in the exact palette is considered AA
    return this.checkGradients(canvasOrGrid, palette);
  }

  /**
   * Full audit: returns a report object.
   */
  static audit(spriteData) {
    const { palette, pixels } = spriteData;
    const paletteResult = this.validate(palette);
    const gradientResult = pixels ? this.checkGradients(pixels, palette) : { hasGradients: false, offenders: [] };
    const aaResult = pixels ? this.checkAntiAliasing(pixels, palette) : { hasGradients: false, offenders: [] };

    return {
      paletteValid: paletteResult.valid,
      paletteErrors: paletteResult.errors,
      gradientFree: !gradientResult.hasGradients,
      antiAliasFree: !aaResult.hasGradients,
      constrainedPalette: this.constrain(palette),
      score: (paletteResult.valid ? 40 : 0) + (!gradientResult.hasGradients ? 30 : 0) + (!aaResult.hasGradients ? 30 : 0),
    };
  }

  static _normalize(color) {
    if (typeof color !== 'string') return null;
    let hex = color.trim().toLowerCase();
    if (hex.startsWith('#')) hex = hex.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (/^[0-9a-f]{6}$/.test(hex)) return '#' + hex;
    return null;
  }
}

export default PaletteValidator;
