// ============================================================
// Starlight Engine — Player Stats
// ============================================================

export class StatsSystem {
  constructor() {
    this.data = {
      joinDate: Date.now(),
      totalPlayTime: 0,
      messagesSent: 0,
      roomsVisited: 0,
      furniturePlaced: 0,
      furnitureBought: 0,
      minigamesPlayed: 0,
      minigamesWon: 0,
      treasureChestsFound: 0,
      totalCoinsEarned: 0,
      totalCoinsSpent: 0,
      stepsWalked: 0,
    };
    this.load();
  }

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem('starlight_stats'));
      if (saved) this.data = { ...this.data, ...saved };
    } catch (e) {}
  }

  save() {
    try { localStorage.setItem('starlight_stats', JSON.stringify(this.data)); } catch (e) {}
  }

  tick(dt) {
    this.data.totalPlayTime += dt;
    if (Math.random() < 0.01) this.save();
  }

  inc(key, amount = 1) {
    this.data[key] = (this.data[key] || 0) + amount;
    this.save();
  }

  getStats() {
    const hours = Math.floor(this.data.totalPlayTime / 3600);
    const mins = Math.floor((this.data.totalPlayTime % 3600) / 60);
    return [
      { label: 'Play Time', value: `${hours}h ${mins}m` },
      { label: 'Messages Sent', value: this.data.messagesSent },
      { label: 'Rooms Visited', value: this.data.roomsVisited },
      { label: 'Furniture Placed', value: this.data.furniturePlaced },
      { label: 'Furniture Bought', value: this.data.furnitureBought },
      { label: 'Minigames Played', value: this.data.minigamesPlayed },
      { label: 'Minigames Won', value: this.data.minigamesWon },
      { label: 'Treasures Found', value: this.data.treasureChestsFound },
      { label: 'Coins Earned', value: this.data.totalCoinsEarned.toLocaleString() },
      { label: 'Coins Spent', value: this.data.totalCoinsSpent.toLocaleString() },
      { label: 'Steps Walked', value: this.data.stepsWalked },
    ];
  }
}
