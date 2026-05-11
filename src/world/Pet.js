// ============================================================
// Starlight Engine — Pet System
// ============================================================

import { isoToScreen, TILE_H } from '../engine/Core.js';

const PET_TYPES = ['dog','cat','bird','dragon','bunny'];
const PET_EMOJIS = { dog: '🐶', cat: '🐱', bird: '🐦', dragon: '🐲', bunny: '🐰' };
const PET_NAMES = ['Buddy','Mochi','Pip','Ziggy','Luna','Oreo','Coco','Bean'];

export class PetSystem {
  constructor(game) {
    this.game = game;
    this.pet = null;
    this.load();
  }

  load() {
    try {
      const data = JSON.parse(localStorage.getItem('starlight_pet'));
      if (data) this.pet = data;
    } catch (e) {}
  }

  save() {
    try { localStorage.setItem('starlight_pet', JSON.stringify(this.pet)); } catch (e) {}
  }

  adopt(type, name) {
    if (!PET_TYPES.includes(type)) type = 'dog';
    this.pet = {
      type,
      name: name || PET_NAMES[Math.floor(Math.random() * PET_NAMES.length)],
      hunger: 50,
      happiness: 50,
      energy: 50,
      level: 1,
      xp: 0,
      adopted: Date.now()
    };
    this.save();
  }

  release() {
    this.pet = null;
    localStorage.removeItem('starlight_pet');
  }

  feed() {
    if (!this.pet) return false;
    this.pet.hunger = Math.min(100, this.pet.hunger + 30);
    this.pet.happiness = Math.min(100, this.pet.happiness + 5);
    this.addXP(15);
    this.save();
    return true;
  }

  play() {
    if (!this.pet) return false;
    this.pet.happiness = Math.min(100, this.pet.happiness + 20);
    this.pet.energy = Math.max(0, this.pet.energy - 10);
    this.pet.hunger = Math.max(0, this.pet.hunger - 5);
    this.addXP(20);
    this.save();
    return true;
  }

  rest() {
    if (!this.pet) return false;
    this.pet.energy = Math.min(100, this.pet.energy + 25);
    this.addXP(10);
    this.save();
    return true;
  }

  addXP(amount) {
    if (!this.pet) return;
    this.pet.xp += amount;
    const needed = this.pet.level * 100;
    if (this.pet.xp >= needed) {
      this.pet.xp -= needed;
      this.pet.level++;
      this.pet.happiness = Math.min(100, this.pet.happiness + 20);
      if (this.game && this.game.uiManager) {
        this.game.uiManager.showNotification(`${this.pet.name} leveled up to ${this.pet.level}! 🎉`, 'success');
        this.game.soundManager.play('win');
      }
    }
  }

  tick(dt) {
    if (!this.pet) return;
    // Slow stat decay
    const decay = dt * 0.3;
    this.pet.hunger = Math.max(0, this.pet.hunger - decay);
    this.pet.happiness = Math.max(0, this.pet.happiness - decay * 0.5);
    this.pet.energy = Math.min(100, this.pet.energy + decay * 0.2);
    if (Math.random() < 0.005) this.save();
  }

  getEmoji() {
    return this.pet ? (PET_EMOJIS[this.pet.type] || '🐾') : '';
  }

  draw(ctx, playerX, playerY, camera) {
    if (!this.pet) return;
    const offset = { x: -0.6, y: 0.4 };
    const px = playerX + offset.x + Math.sin(Date.now() / 400) * 0.08;
    const py = playerY + offset.y;
    const sp = isoToScreen(px, py);
    const x = sp.x + camera.x;
    const y = sp.y + camera.y - 10;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Emoji
    ctx.font = '22px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const bob = Math.sin(Date.now() / 300) * 2;
    ctx.fillText(this.getEmoji(), x, y + bob);

    // Name
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px Nunito, sans-serif';
    ctx.fillText(this.pet.name, x, y - 14);
  }
}
