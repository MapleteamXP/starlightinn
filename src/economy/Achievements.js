// ============================================================
// Starlight Engine — Achievements System
// ============================================================

export const ACHIEVEMENTS = [
  { id: 'first_steps', name: 'First Steps', desc: 'Walk 50 tiles', icon: '🚶', target: 50, reward: 50, type: 'walk' },
  { id: 'socialite', name: 'Socialite', desc: 'Send 20 chat messages', icon: '💬', target: 20, reward: 100, type: 'chat' },
  { id: 'shopper', name: 'Shopper', desc: 'Buy 10 furniture items', icon: '🛒', target: 10, reward: 150, type: 'buy' },
  { id: 'decorator', name: 'Decorator', desc: 'Place 25 furniture pieces', icon: '🏠', target: 25, reward: 200, type: 'place' },
  { id: 'gamer', name: 'Gamer', desc: 'Play 5 minigames', icon: '🎮', target: 5, reward: 250, type: 'minigame' },
  { id: 'winner', name: 'Winner', desc: 'Win 3 minigames', icon: '🏆', target: 3, reward: 300, type: 'win' },
  { id: 'collector', name: 'Collector', desc: 'Own 15 unique furniture types', icon: '📦', target: 15, reward: 400, type: 'collect' },
  { id: 'explorer', name: 'Explorer', desc: 'Visit 10 different rooms', icon: '🗺️', target: 10, reward: 200, type: 'visit' },
  { id: 'customizer', name: 'Customizer', desc: 'Change your look 5 times', icon: '✂️', target: 5, reward: 100, type: 'customize' },
  { id: 'tycoon', name: 'Starlight Tycoon', desc: 'Earn 5,000 StarCoins total', icon: '💰', target: 5000, reward: 1000, type: 'earn' },
];

export class AchievementSystem {
  constructor(game) {
    this.game = game;
    this.progress = {};
    this.claimed = new Set();
    this.totalEarned = 0;
    this.visitedRooms = new Set();
    this.load();
  }

  load() {
    try {
      const data = JSON.parse(localStorage.getItem('starlight_achievements'));
      if (data) {
        this.progress = data.progress || {};
        this.claimed = new Set(data.claimed || []);
        this.totalEarned = data.totalEarned || 0;
        this.visitedRooms = new Set(data.visitedRooms || []);
      }
    } catch (e) {}
  }

  save() {
    try {
      localStorage.setItem('starlight_achievements', JSON.stringify({
        progress: this.progress,
        claimed: Array.from(this.claimed),
        totalEarned: this.totalEarned,
        visitedRooms: Array.from(this.visitedRooms)
      }));
    } catch (e) {}
  }

  track(type, amount = 1) {
    this.progress[type] = (this.progress[type] || 0) + amount;
    this.save();
    this._checkUnlocks();
  }

  visitRoom(roomId) {
    if (!roomId) return;
    this.visitedRooms.add(roomId);
    this.track('visit', 0);
    this._checkUnlocks();
  }

  _checkUnlocks() {
    ACHIEVEMENTS.forEach(ach => {
      if (this.claimed.has(ach.id)) return;
      let val = 0;
      if (ach.type === 'visit') val = this.visitedRooms.size;
      else if (ach.type === 'collect') val = Object.keys(this.game.inventorySystem.getAll()).length;
      else if (ach.type === 'earn') val = this.totalEarned;
      else val = this.progress[ach.type] || 0;
      if (val >= ach.target) {
        this.claimed.add(ach.id);
        this.game.currencySystem.add(ach.reward);
        this.game.uiManager.showAchievementPopup(ach);
        this.game.soundManager.play('win');
        this.save();
      }
    });
  }

  getList() {
    return ACHIEVEMENTS.map(ach => {
      let current = 0;
      if (ach.type === 'visit') current = this.visitedRooms.size;
      else if (ach.type === 'collect') current = Object.keys(this.game.inventorySystem.getAll()).length;
      else if (ach.type === 'earn') current = this.totalEarned;
      else current = this.progress[ach.type] || 0;
      return {
        ...ach,
        current: Math.min(current, ach.target),
        percent: Math.min(100, Math.floor((current / ach.target) * 100)),
        unlocked: this.claimed.has(ach.id)
      };
    });
  }
}
