/**
 * CharacterCreator.js — v8.0 Character Creation UI
 * Orchestrates color wheel, hair catalog, and avatar preview.
 */
import { ColorWheel } from './ColorWheel.js';
import { HairCatalog } from './HairCatalog.js';
import { AvatarPreview } from './AvatarPreview.js';

export class CharacterCreator {
  constructor(game) {
    this.game = game;
    this.preview = null;
    this.wheels = {};
    this.hairGrid = null;
    this.selectedHair = 'bob';
    this.colors = { skin: '#f5cba7', hair: '#5d4037', clothes: '#5b8c85', accent: '#ffd700' };
    this.onComplete = null;
    this.visible = false;
  }

  show() {
    this.visible = true;
    const container = document.getElementById('char-customize');
    if (!container) return;
    container.innerHTML = '';
    container.style.display = 'block';

    // Build preview
    this.preview = new AvatarPreview('char-preview-canvas');
    this.preview.setColors(this.colors);
    this.preview.setHair(this.selectedHair);
    this.preview.draw();

    // Color wheels
    const colorDefs = [
      { id: 'skin', label: 'Skin Tone', default: { h: 30, s: 70, l: 75 } },
      { id: 'hair', label: 'Hair Color', default: { h: 25, s: 45, l: 30 } },
      { id: 'clothes', label: 'Clothes Color', default: { h: 160, s: 25, l: 45 } },
      { id: 'accent', label: 'Accent Color', default: { h: 45, s: 90, l: 55 } }
    ];

    colorDefs.forEach(def => {
      const group = document.createElement('div');
      group.className = 'color-group';
      group.innerHTML = `<label>${def.label}</label>`;
      const wheelContainer = document.createElement('div');
      wheelContainer.id = `wheel-${def.id}`;
      group.appendChild(wheelContainer);
      container.appendChild(group);

      this.wheels[def.id] = new ColorWheel(wheelContainer.id, (hsl) => {
        this.colors[def.id] = hsl;
        if (this.preview) {
          this.preview.setColors(this.colors);
          this.preview.draw();
        }
      });
      this.wheels[def.id].setHSL(def.default.h, def.default.s, def.default.l);
    });

    // Hair selector
    const hairSection = document.createElement('div');
    hairSection.className = 'hair-section';
    hairSection.innerHTML = '<h4>Hairstyle</h4>';
    const tabs = document.createElement('div');
    tabs.className = 'hair-tabs';
    HairCatalog.getCategories().forEach(cat => {
      const btn = document.createElement('button');
      btn.textContent = cat;
      btn.className = 'hair-tab';
      btn.onclick = () => this.showHairCategory(cat);
      tabs.appendChild(btn);
    });
    hairSection.appendChild(tabs);
    this.hairGrid = document.createElement('div');
    this.hairGrid.className = 'hair-grid';
    hairSection.appendChild(this.hairGrid);
    container.appendChild(hairSection);

    this.showHairCategory('short');

    // Continue button
    const actions = document.createElement('div');
    actions.className = 'charselect-actions';
    actions.innerHTML = `<button id="btn-cc-continue" class="btn btn-primary">Continue</button>`;
    container.appendChild(actions);
    document.getElementById('btn-cc-continue')?.addEventListener('click', () => {
      if (this.onComplete) this.onComplete({ hair: this.selectedHair, colors: this.colors });
    });
  }

  showHairCategory(cat) {
    if (!this.hairGrid) return;
    this.hairGrid.innerHTML = '';
    HairCatalog.getByCategory(cat).forEach(hair => {
      const btn = document.createElement('button');
      btn.className = 'hair-btn' + (hair.id === this.selectedHair ? ' selected' : '');
      btn.textContent = hair.name;
      btn.title = hair.name;
      btn.onclick = () => {
        this.selectedHair = hair.id;
        if (this.preview) {
          this.preview.setHair(hair.id);
          this.preview.draw();
        }
        // Update selected class
        this.hairGrid.querySelectorAll('.hair-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      };
      this.hairGrid.appendChild(btn);
    });
  }

  hide() {
    this.visible = false;
    const container = document.getElementById('char-customize');
    if (container) container.style.display = 'none';
  }

  getConfig() {
    return { hair: this.selectedHair, colors: { ...this.colors } };
  }
}
