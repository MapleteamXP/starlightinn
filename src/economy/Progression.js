// ============================================================
// Starlight Engine — Player Level / XP Progression
// ============================================================

const LEVELS = [
  { level: 1, xp: 0, title: 'Newcomer' },
  { level: 2, xp: 100, title: 'Visitor' },
  { level: 3, xp: 300, title: 'Regular' },
  { level: 4, xp: 600, title: 'Resident' },
  { level: 5, xp: 1000, title: 'Socialite' },
  { level: 6, xp: 1500, title: 'Decorator' },
  { level: 7, xp: 2100, title: 'Gamer' },
  { level: 8, xp: 2800, title: 'Collector' },
  { level: 9, xp: 3600, title: 'Influencer' },
  { level: 10, xp: 4500, title: 'VIP' },
  { level: 11, xp: 5500, title: 'Elite' },
  { level: 12, xp: 6600, title: 'Legend' },
  { level: 13, xp: 7800, title: 'Master' },
  { level: 14, xp: 9100, title: 'Grandmaster' },
  { level: 15, xp: 10500, title: 'Starlight Champion' },
];

export class ProgressionSystem {
  constructor(game) {
    this.game = game;
    this.xp = 0;
    this.level = 1;
    this.title = 'Newcomer';
    this.equippedTitle = null;
    this.load();
  }

  load() {
    try {
      const data = JSON.parse(localStorage.getItem('starlight_progression'));
      if (data) { this.xp = data.xp || 0; this.level = data.level || 1; this.title = data.title || 'Newcomer'; this.equippedTitle = data.equippedTitle || null; }
    } catch (e) {}
    this._recalc();
  }

  save() {
    try { localStorage.setItem('starlight_progression', JSON.stringify({ xp: this.xp, level: this.level, title: this.title, equippedTitle: this.equippedTitle })); } catch (e) {}
  }

  _recalc() {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (this.xp >= LEVELS[i].xp) {
        const newLevel = LEVELS[i].level;
        if (newLevel > this.level) {
          this.level = newLevel;
          this.title = LEVELS[i].title;
          this.game.uiManager.showNotification(`Level Up! You are now Level ${this.level} — ${this.title}! +★${this.level * 50}`, 'success');
          this.game.currencySystem.add(this.level * 50);
          this.game.soundManager.play('win');
          this.game.soundManager.play('levelup');
          this.game.shakeScreen(8, 0.5);
          // Particle burst at player position
          if (this.game.player) {
            this.game.spawnParticles(this.game.player.x, this.game.player.y, '#f4d03f', 20);
            this.game.spawnParticles(this.game.player.x, this.game.player.y, '#2ecc71', 12);
            this.game.spawnParticles(this.game.player.x, this.game.player.y, '#9b59b6', 8);
          }
        }
        break;
      }
    }
  }

  addXP(amount) {
    this.xp += amount;
    this._recalc();
    this.save();
  }

  getNextLevelXP() {
    const next = LEVELS.find(l => l.level === this.level + 1);
    return next ? next.xp : LEVELS[LEVELS.length - 1].xp;
  }

  getProgress() {
    const currentLevel = LEVELS.find(l => l.level === this.level) || LEVELS[0];
    const nextLevel = LEVELS.find(l => l.level === this.level + 1);
    const needed = nextLevel ? nextLevel.xp - currentLevel.xp : 1;
    const have = this.xp - currentLevel.xp;
    return { level: this.level, title: this.getTitle(), xp: this.xp, have, needed, percent: nextLevel ? Math.min(100, Math.floor((have / needed) * 100)) : 100 };
  }

  getTitle() { return this.equippedTitle || this.title; }

  getUnlockedTitles() {
    return LEVELS.filter(l => this.xp >= l.xp).map(l => l.title);
  }

  setEquippedTitle(title) {
    this.equippedTitle = title;
    this.save();
  }
}
