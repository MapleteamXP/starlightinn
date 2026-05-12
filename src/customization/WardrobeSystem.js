// ============================================================
// Starlight Engine — Wardrobe / Outfit Presets
// ============================================================

const STORAGE_KEY = 'starlight_wardrobe';
const MAX_PRESETS = 5;

export class WardrobeSystem {
  constructor() {
    this.presets = [];
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.presets = JSON.parse(raw);
    } catch (e) {}
    while (this.presets.length < MAX_PRESETS) this.presets.push(null);
  }

  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.presets)); } catch (e) {}
  }

  getPreset(index) {
    if (index < 0 || index >= MAX_PRESETS) return null;
    return this.presets[index];
  }

  setPreset(index, outfit) {
    if (index < 0 || index >= MAX_PRESETS) return false;
    this.presets[index] = { ...outfit, savedAt: Date.now() };
    this.save();
    return true;
  }

  deletePreset(index) {
    if (index < 0 || index >= MAX_PRESETS) return false;
    this.presets[index] = null;
    this.save();
    return true;
  }

  applyPreset(index, targetObj) {
    const p = this.getPreset(index);
    if (!p) return false;
    Object.assign(targetObj, {
      skinColor: p.skinColor,
      hairColor: p.hairColor,
      hairStyle: p.hairStyle,
      shirtColor: p.shirtColor,
      pantsColor: p.pantsColor,
      shoeColor: p.shoeColor,
      hatType: p.hatType,
      glassesType: p.glassesType
    });
    return true;
  }

  getAll() {
    return this.presets.map((p, i) => p ? { ...p, slot: i + 1 } : null);
  }
}
