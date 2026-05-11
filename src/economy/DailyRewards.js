// ============================================================
// Starlight Engine — Daily Login Rewards
// ============================================================

const REWARDS = [
  { day: 1, coins: 50, item: null },
  { day: 2, coins: 100, item: null },
  { day: 3, coins: 150, item: 'plant' },
  { day: 4, coins: 200, item: null },
  { day: 5, coins: 300, item: 'lamp' },
  { day: 6, coins: 400, item: null },
  { day: 7, coins: 1000, item: 'dragon' },
];

export class DailyRewardSystem {
  constructor(game) {
    this.game = game;
    this.streak = 0;
    this.lastClaim = 0;
    this.load();
  }

  load() {
    try {
      const data = JSON.parse(localStorage.getItem('starlight_daily'));
      if (data) {
        this.streak = data.streak || 0;
        this.lastClaim = data.lastClaim || 0;
      }
    } catch (e) {}
  }

  save() {
    try { localStorage.setItem('starlight_daily', JSON.stringify({ streak: this.streak, lastClaim: this.lastClaim })); } catch (e) {}
  }

  canClaim() {
    const now = new Date();
    const last = new Date(this.lastClaim);
    const sameDay = now.getFullYear() === last.getFullYear() &&
                    now.getMonth() === last.getMonth() &&
                    now.getDate() === last.getDate();
    return !sameDay;
  }

  getStreakDay() {
    return ((this.streak - 1) % 7) + 1;
  }

  claim() {
    if (!this.canClaim()) return null;
    const now = Date.now();
    const last = new Date(this.lastClaim);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isConsecutive = last.getFullYear() === yesterday.getFullYear() &&
                          last.getMonth() === yesterday.getMonth() &&
                          last.getDate() === yesterday.getDate();
    if (isConsecutive || this.streak === 0) {
      this.streak++;
    } else {
      this.streak = 1;
    }
    this.lastClaim = now;
    this.save();

    const day = this.getStreakDay();
    const reward = REWARDS[day - 1];
    if (reward) {
      this.game.currencySystem.add(reward.coins);
      if (reward.item) this.game.inventorySystem.add(reward.item, 1);
    }
    return { day, ...reward };
  }

  getRewardsTable() {
    const currentDay = this.getStreakDay();
    return REWARDS.map((r, i) => ({
      ...r,
      index: i + 1,
      claimed: i + 1 < currentDay || (i + 1 === currentDay && !this.canClaim()),
      current: i + 1 === currentDay && this.canClaim()
    }));
  }
}
