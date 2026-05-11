// ============================================================
// Starlight Engine — Minigame Leaderboards
// ============================================================

export class LeaderboardSystem {
  constructor() {
    this.scores = {};
    this.load();
  }

  load() {
    try {
      const data = JSON.parse(localStorage.getItem('starlight_leaderboards'));
      if (data) this.scores = data;
    } catch (e) {}
  }

  save() {
    try { localStorage.setItem('starlight_leaderboards', JSON.stringify(this.scores)); } catch (e) {}
  }

  submit(gameId, score, stats = {}) {
    if (!this.scores[gameId]) this.scores[gameId] = [];
    const entry = { score, stats, date: Date.now(), id: Math.random().toString(36).slice(2, 8) };
    this.scores[gameId].push(entry);
    this.scores[gameId].sort((a, b) => b.score - a.score);
    if (this.scores[gameId].length > 10) this.scores[gameId] = this.scores[gameId].slice(0, 10);
    this.save();
    return entry;
  }

  getTop(gameId, limit = 5, filter = 'all') {
    let list = this.scores[gameId] || [];
    if (filter === 'today') {
      const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
      list = list.filter(s => s.date >= startOfDay.getTime());
    }
    return list.slice(0, limit);
  }

  getPersonalBest(gameId) {
    const list = this.scores[gameId] || [];
    return list.length > 0 ? list[0] : null;
  }
}
