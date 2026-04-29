/**
 * Presets.js — Outfit preset save / load manager for Starlight Inn v3.0
 *
 * Thin wrapper over localStorage with namespaced keys, JSON
 * serialisation, and helper to snapshot a player state object
 * into a transferable preset record.
 *
 * @author Starlight Inn Team
 * @version 3.0.0
 */

/**
 * @typedef {Object} HSL
 * @property {number} h — hue 0-360
 * @property {number} s — saturation 0-100
 * @property {number} l — lightness 0-100
 */

/**
 * @typedef {Object} OutfitPreset
 * @property {string} charId
 * @property {HSL} skinColor
 * @property {HSL} hairColor
 * @property {HSL} outfitColor
 * @property {string[]} accessories
 * @property {string} expression
 */

export class Presets {
  constructor() {
    /** @type {string} */
    this.storageKey = 'starlight_presets';
  }

  /* ============================================================
     CORE CRUD
     ============================================================ */

  /**
   * Persist a preset under a name. Overwrites existing.
   * @param {string} name
   * @param {OutfitPreset} preset
   */
  save(name, preset) {
    const presets = this.loadAll();
    presets[name] = preset;
    this._write(presets);
  }

  /**
   * Load a single preset by name.
   * @param {string} name
   * @returns {OutfitPreset|undefined}
   */
  load(name) {
    return this.loadAll()[name];
  }

  /**
   * Load every stored preset.
   * @returns {Object<string, OutfitPreset>}
   */
  loadAll() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      // Basic validation: ensure it's a plain object
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return {};
      }
      return parsed;
    } catch (err) {
      // Corrupted storage — wipe and return empty
      console.warn('[Presets] localStorage parse failed, resetting:', err);
      this._write({});
      return {};
    }
  }

  /**
   * Delete a preset by name.
   * @param {string} name
   */
  delete(name) {
    const presets = this.loadAll();
    delete presets[name];
    this._write(presets);
  }

  /**
   * Rename an existing preset.
   * @param {string} oldName
   * @param {string} newName
   * @returns {boolean} success
   */
  rename(oldName, newName) {
    const presets = this.loadAll();
    if (!(oldName in presets)) return false;
    if (newName in presets) return false; // prevent overwrite
    presets[newName] = presets[oldName];
    delete presets[oldName];
    this._write(presets);
    return true;
  }

  /**
   * List all stored preset names.
   * @returns {string[]}
   */
  list() {
    return Object.keys(this.loadAll());
  }

  /**
   * Count stored presets.
   * @returns {number}
   */
  count() {
    return this.list().length;
  }

  /* ============================================================
     FACTORY / CONVERSION
     ============================================================ */

  /**
   * Create a serialisable preset from a player state object.
   * @param {Object} player
   * @returns {OutfitPreset}
   */
  createFromPlayer(player) {
    return {
      charId: player.charId || 'human',
      skinColor: this._safeHSL(player.skinColor),
      hairColor: this._safeHSL(player.hairColor),
      outfitColor: this._safeHSL(player.outfitColor),
      accessories: Array.isArray(player.accessories) ? [...player.accessories] : [],
      expression: player.expression || 'happy'
    };
  }

  /**
   * Create a preset from raw values.
   * @param {Object} opts
   * @returns {OutfitPreset}
   */
  create(opts) {
    return {
      charId: opts.charId || 'human',
      skinColor: this._safeHSL(opts.skinColor),
      hairColor: this._safeHSL(opts.hairColor),
      outfitColor: this._safeHSL(opts.outfitColor),
      accessories: Array.isArray(opts.accessories) ? [...opts.accessories] : [],
      expression: opts.expression || 'happy'
    };
  }

  /* ============================================================
     VALIDATION
     ============================================================ */

  /**
   * Check if a preset object has all required fields.
   * @param {OutfitPreset} preset
   * @returns {boolean}
   */
  isValid(preset) {
    if (!preset || typeof preset !== 'object') return false;
    if (typeof preset.charId !== 'string') return false;
    if (!this._isValidHSL(preset.skinColor)) return false;
    if (!this._isValidHSL(preset.hairColor)) return false;
    if (!this._isValidHSL(preset.outfitColor)) return false;
    if (!Array.isArray(preset.accessories)) return false;
    if (typeof preset.expression !== 'string') return false;
    return true;
  }

  /**
   * Clean and repair a preset if any fields are malformed.
   * @param {OutfitPreset} preset
   * @returns {OutfitPreset}
   */
  sanitize(preset) {
    return {
      charId: typeof preset.charId === 'string' ? preset.charId : 'human',
      skinColor: this._safeHSL(preset.skinColor),
      hairColor: this._safeHSL(preset.hairColor),
      outfitColor: this._safeHSL(preset.outfitColor),
      accessories: Array.isArray(preset.accessories) ? [...preset.accessories] : [],
      expression: typeof preset.expression === 'string' ? preset.expression : 'happy'
    };
  }

  /* ============================================================
     BULK OPERATIONS
     ============================================================ */

  /**
   * Import a batch of presets (e.g. from JSON export).
   * @param {Object<string, OutfitPreset>} incoming
   * @param {boolean} [overwrite=false]
   */
  importAll(incoming, overwrite = false) {
    const existing = this.loadAll();
    for (const [name, preset] of Object.entries(incoming)) {
      if (!this.isValid(preset)) continue;
      if (!overwrite && name in existing) continue;
      existing[name] = preset;
    }
    this._write(existing);
  }

  /**
   * Export every stored preset as a JSON blob.
   * @returns {string} JSON string
   */
  exportAll() {
    return JSON.stringify(this.loadAll(), null, 2);
  }

  /**
   * Wipe all stored presets.
   */
  clear() {
    this._write({});
  }

  /* ============================================================
     INTERNAL
     ============================================================ */

  /** @private */
  _write(data) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (err) {
      console.error('[Presets] localStorage write failed:', err);
    }
  }

  /** @private @returns {HSL} */
  _safeHSL(raw) {
    if (raw && typeof raw === 'object' && 'h' in raw && 's' in raw && 'l' in raw) {
      return {
        h: Math.max(0, Math.min(360, Math.round(raw.h))),
        s: Math.max(0, Math.min(100, Math.round(raw.s))),
        l: Math.max(0, Math.min(100, Math.round(raw.l)))
      };
    }
    return { h: 30, s: 50, l: 60 };
  }

  /** @private @returns {boolean} */
  _isValidHSL(obj) {
    return (
      obj && typeof obj === 'object' &&
      Number.isFinite(obj.h) && obj.h >= 0 && obj.h <= 360 &&
      Number.isFinite(obj.s) && obj.s >= 0 && obj.s <= 100 &&
      Number.isFinite(obj.l) && obj.l >= 0 && obj.l <= 100
    );
  }
}
