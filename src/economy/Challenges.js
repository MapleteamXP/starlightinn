// ============================================================
// Starlight Engine — Daily Challenges
// ============================================================

const CHALLENGE_POOL = [
  { id: 'walk_20', name: 'Morning Stroll', desc: 'Walk 20 tiles', type: 'walk', target: 20, reward: 50 },
  { id: 'chat_5', name: 'Social Butterfly', desc: 'Send 5 chat messages', type: 'chat', target: 5, reward: 75 },
  { id: 'place_3', name: 'Interior Designer', desc: 'Place 3 furniture items', type: 'place', target: 3, reward: 100 },
  { id: 'buy_2', name: 'Shopping Spree', desc: 'Buy 2 furniture items', type: 'buy', target: 2, reward: 100 },
  { id: 'win_game', name: 'Champion', desc: 'Win a minigame', type: 'win', target: 1, reward: 150 },
  { id: 'visit_3', name: 'World Traveler', desc: 'Visit 3 different rooms', type: 'visit', target: 3, reward: 100 },
  { id: 'find_treasure', name: 'Treasure Hunter', desc: 'Find 2 treasure chests', type: 'treasure', target: 2, reward: 125 },
  { id: 'craft_1', name: 'Crafty', desc: 'Craft 1 item', type: 'craft', target: 1, reward: 100 },
  { id: 'feed_pet', name: 'Pet Parent', desc: 'Feed your pet', type: 'pet_feed', target: 1, reward: 75 },
  { id: 'customize', name: 'New Look', desc: 'Change your avatar look', type: 'customize', target: 1, reward: 50 },
];

export class ChallengeSystem {
  constructor(game) {
    this.game = game;
    this.challenges = [];
    this.progress = {};
    this.completed = new Set();
    this.lastRefresh = 0;
    this.load();
    this._refreshIfNeeded();
  }

  load() {
    try {
      const data = JSON.parse(localStorage.getItem('starlight_challenges'));
      if (data) {
        this.challenges = data.challenges || [];
        this.progress = data.progress || {};
        this.completed = new Set(data.completed || []);
        this.lastRefresh = data.lastRefresh || 0;
      }
    } catch (e) {}
  }

  save() {
    try {
      localStorage.setItem('starlight_challenges', JSON.stringify({
        challenges: this.challenges,
        progress: this.progress,
        completed: Array.from(this.completed),
        lastRefresh: this.lastRefresh
      }));
    } catch (e) {}
  }

  _refreshIfNeeded() {
    const now = new Date();
    const last = new Date(this.lastRefresh);
    const sameDay = now.getFullYear() === last.getFullYear() && now.getMonth() === last.getMonth() && now.getDate() === last.getDate();
    if (!sameDay) {
      this._generateChallenges();
      this.lastRefresh = Date.now();
      this.save();
    }
  }

  _generateChallenges() {
    const shuffled = [...CHALLENGE_POOL].sort(() => Math.random() - 0.5);
    this.challenges = shuffled.slice(0, 3);
    this.progress = {};
    this.completed = new Set();
  }

  track(type, amount = 1) {
    this.challenges.forEach(c => {
      if (c.type !== type || this.completed.has(c.id)) return;
      this.progress[c.id] = (this.progress[c.id] || 0) + amount;
      if (this.progress[c.id] >= c.target) {
        this.completed.add(c.id);
        this.game.currencySystem.add(c.reward);
        this.game.uiManager.showNotification(`Challenge complete: ${c.name}! +★${c.reward}`, 'success');
        this.game.soundManager.play('win');
      }
    });
    this.save();
  }

  getList() {
    this._refreshIfNeeded();
    return this.challenges.map(c => ({
      ...c,
      current: Math.min(this.progress[c.id] || 0, c.target),
      percent: Math.min(100, Math.floor(((this.progress[c.id] || 0) / c.target) * 100)),
      done: this.completed.has(c.id)
    }));
  }
}
