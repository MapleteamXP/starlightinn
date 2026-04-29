/**
 * Currency.js
 * Dual-currency economy manager for Starlight Inn v3.0
 * Silver (soft, earned through play) + Gold (premium, scarce)
 * Includes hourly grants, daily login bonuses, streak tracking, and persistence.
 *
 * @module economy/Currency
 */

const STORAGE_KEY = 'starlight_currency';
const STREAK_KEY = 'starlight_login_streak';

/**
 * Escalating daily bonus table (Gold)
 * Day 1 through 7, with day 7 being a special reward.
 * @type {number[]}
 */
const DAILY_BONUS_TABLE = [50, 100, 150, 200, 250, 300, 500];

/**
 * Day 7 rare bonus item ID granted on 7-day streak.
 * @type {string}
 */
const STREAK_7_RARE_ITEM = 'badge_stellar_guest';

/**
 * Anti-cheat flag: maximum Gold a client can legitimately hold.
 * Used during transaction validation.
 * @type {number}
 */
const ABSURD_GOLD_CAP = 50000;

/**
 * Currency class manages the dual-currency economy: Silver (soft) and Gold (premium).
 * All mutations are persisted to localStorage and validated against spend limits.
 */
export class Currency {
  /**
   * @param {object} game - Reference to the main game object; expects `game.state`, `game.ui`
   */
  constructor(game) {
    if (!game || typeof game !== 'object') {
      throw new TypeError('Currency requires a valid game reference');
    }
    this.game = game;

    // --- Currency state (in-memory, synced with game.state) ---
    this.lastGrantTime = 0;
    this.dailyGranted = 0;
    this.dailyCap = 1000;
    this.grantInterval = 3600000; // 1 hour in ms

    // --- Login streak ---
    this.lastLoginDate = null;
    this.loginStreak = 0;

    // --- Anti-cheat / audit ---
    this.auditLog = [];
    this.maxAuditEntries = 100;
  }

  /** Initialize currency from persisted state and start hourly grants. */
  init() {
    this.load();
    this.startHourlyGrants();
    this._autoClaimStreakIfEligible();
  }

  // ============================================================
  //  SILVER (Soft Currency)
  // ============================================================

  /**
   * Get current Silver balance.
   * @returns {number}
   */
  getSilver() {
    return this.game.state.silver ?? 0;
  }

  /**
   * Add Silver (earned through play).
   * @param {number} amount
   * @param {string} [reason=''] - Audit reason
   * @returns {number} New Silver balance
   */
  addSilver(amount, reason = '') {
    if (!Number.isFinite(amount) || amount < 0) {
      console.warn('[Currency] addSilver rejected invalid amount:', amount);
      return this.getSilver();
    }
    this.game.state.silver = (this.game.state.silver ?? 0) + amount;
    this._audit('ADD_SILVER', amount, reason);
    this.save();
    return this.game.state.silver;
  }

  /**
   * Spend Silver. Returns true if successful.
   * @param {number} amount
   * @param {string} [reason='']
   * @returns {boolean}
   */
  spendSilver(amount, reason = '') {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    if ((this.game.state.silver ?? 0) < amount) return false;

    this.game.state.silver -= amount;
    this._audit('SPEND_SILVER', amount, reason);
    this.save();
    return true;
  }

  /**
   * Check if player can afford a Silver cost.
   * @param {number} amount
   * @returns {boolean}
   */
  canAffordSilver(amount) {
    if (!Number.isFinite(amount) || amount < 0) return true; // zero cost
    return (this.game.state.silver ?? 0) >= amount;
  }

  // ============================================================
  //  GOLD (Premium Currency)
  // ============================================================

  /**
   * Get current Gold balance.
   * @returns {number}
   */
  getGold() {
    return this.game.state.gold ?? 0;
  }

  /**
   * Add Gold (earned slowly, bought, or granted).
   * @param {number} amount
   * @param {string} [reason='']
   * @returns {number} New Gold balance
   */
  addGold(amount, reason = '') {
    if (!Number.isFinite(amount) || amount < 0) {
      console.warn('[Currency] addGold rejected invalid amount:', amount);
      return this.getGold();
    }
    this.game.state.gold = (this.game.state.gold ?? 0) + amount;
    this._audit('ADD_GOLD', amount, reason);
    this.save();
    return this.game.state.gold;
  }

  /**
   * Spend Gold. Returns true if successful.
   * @param {number} amount
   * @param {string} [reason='']
   * @returns {boolean}
   */
  spendGold(amount, reason = '') {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    if ((this.game.state.gold ?? 0) < amount) return false;

    this.game.state.gold -= amount;
    this._audit('SPEND_GOLD', amount, reason);
    this.save();
    return true;
  }

  /**
   * Check if player can afford a Gold cost.
   * @param {number} amount
   * @returns {boolean}
   */
  canAffordGold(amount) {
    if (!Number.isFinite(amount) || amount < 0) return true;
    return (this.game.state.gold ?? 0) >= amount;
  }

  // ============================================================
  //  Dual-cost convenience
  // ============================================================

  /**
   * Spend both currencies atomically.
   * Rolls back the first if the second fails.
   * @param {number} silverCost
   * @param {number} goldCost
   * @param {string} [reason='']
   * @returns {boolean}
   */
  spendBoth(silverCost, goldCost, reason = '') {
    const silverOK = this.canAffordSilver(silverCost);
    const goldOK = this.canAffordGold(goldCost);
    if (!silverOK || !goldOK) return false;

    const spentSilver = this.spendSilver(silverCost, reason);
    if (!spentSilver) return false;
    const spentGold = this.spendGold(goldCost, reason);
    if (!spentGold) {
      // Rollback
      this.addSilver(silverCost, 'rollback_after_gold_fail');
      return false;
    }
    return true;
  }

  /**
   * Check affordability for both currencies at once.
   * @param {number} silverCost
   * @param {number} goldCost
   * @returns {boolean}
   */
  canAffordBoth(silverCost, goldCost) {
    return this.canAffordSilver(silverCost) && this.canAffordGold(goldCost);
  }

  // ============================================================
  //  Hourly Gold Grants (Retention driver)
  // ============================================================

  /** Start the hourly grant interval timer. */
  startHourlyGrants() {
    // Grant immediately if this is the first init of a session
    if (this.lastGrantTime === 0) {
      this.grantHourlyGold();
    }
    setInterval(() => this.grantHourlyGold(), this.grantInterval);
  }

  /**
   * Grant up to 100 Gold per hour, capped at 1000/day.
   * Resets dailyGranted counter at midnight local time.
   */
  grantHourlyGold() {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Reset daily counter if we've crossed midnight
    if (this.lastGrantTime < todayStart.getTime() && now >= todayStart.getTime()) {
      this.dailyGranted = 0;
    }

    if (this.dailyGranted < this.dailyCap) {
      const grant = Math.min(100, this.dailyCap - this.dailyGranted);
      this.addGold(grant, 'hourly_grant');
      this.dailyGranted += grant;
      this._toastIfUI(`+${grant} Gold (hourly grant)`, 'gold');
    }

    this.lastGrantTime = now;
    this.save();
  }

  // ============================================================
  //  Daily Login Bonus & Streak
  // ============================================================

  /**
   * Auto-check streak on init without claiming.
   * Call explicitly when the daily login panel opens.
   */
  _autoClaimStreakIfEligible() {
    const today = this._todayKey();
    if (this.lastLoginDate === today) return; // already claimed today

    const yesterday = this._yesterdayKey();
    if (this.lastLoginDate === yesterday) {
      this.loginStreak = Math.min((this.loginStreak ?? 0) + 1, 7);
    } else if (this.lastLoginDate !== today) {
      this.loginStreak = 1; // reset streak
    }
    this.lastLoginDate = today;
    this._saveStreak();
  }

  /**
   * Claim the daily login bonus.
   * @returns {{ bonus: number, day: number, streak: number, rareItem: string|null }}
   */
  claimDailyBonus() {
    const today = this._todayKey();
    if (this.lastLoginDate === today) {
      this._toastIfUI('Daily bonus already claimed!', 'info');
      return { bonus: 0, day: 0, streak: this.loginStreak, rareItem: null };
    }

    // Determine streak
    const yesterday = this._yesterdayKey();
    if (this.lastLoginDate === yesterday) {
      this.loginStreak = Math.min((this.loginStreak ?? 0) + 1, 7);
    } else {
      this.loginStreak = 1;
    }
    this.lastLoginDate = today;

    const dayIndex = Math.min(this.loginStreak - 1, 6);
    const bonus = DAILY_BONUS_TABLE[dayIndex];
    let rareItem = null;

    this.addGold(bonus, `daily_login_day${this.loginStreak}`);
    this._toastIfUI(`+${bonus} Gold (Day ${this.loginStreak} bonus!)`, 'gold');

    // Day 7 special rare item
    if (this.loginStreak === 7 && this.game.inventory) {
      rareItem = STREAK_7_RARE_ITEM;
      this.game.inventory.addItem({
        id: rareItem,
        name: 'Stellar Guest',
        category: 'Badges',
        priceSilver: 0,
        priceGold: 0,
        rarity: 'legendary',
        icon: '🌟'
      });
      this._toastIfUI('You received the Stellar Guest badge!', 'legendary');
    }

    this._saveStreak();
    this.save();

    return { bonus, day: this.loginStreak, streak: this.loginStreak, rareItem };
  }

  /**
   * Get current login streak (1-7).
   * @returns {number}
   */
  getLoginStreak() {
    return this.loginStreak ?? 1;
  }

  /**
   * Get streak data for UI rendering.
   * @returns {object}
   */
  getStreakData() {
    const today = this._todayKey();
    const claimedToday = this.lastLoginDate === today;
    const progress = [];
    for (let d = 1; d <= 7; d++) {
      const isPast = d < this.loginStreak;
      const isCurrent = d === this.loginStreak && !claimedToday;
      const isClaimed = d <= this.loginStreak && claimedToday;
      progress.push({
        day: d,
        bonus: DAILY_BONUS_TABLE[d - 1],
        state: isClaimed ? 'claimed' : isCurrent ? 'current' : isPast ? 'past' : 'future'
      });
    }
    return {
      streak: this.loginStreak,
      claimedToday,
      progress,
      nextBonus: claimedToday ? 0 : DAILY_BONUS_TABLE[Math.min(this.loginStreak, 6)]
    };
  }

  /** @private */
  _todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  /** @private */
  _yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  /** @private */
  _saveStreak() {
    localStorage.setItem(STREAK_KEY, JSON.stringify({
      lastLoginDate: this.lastLoginDate,
      loginStreak: this.loginStreak
    }));
  }

  /** @private */
  _loadStreak() {
    try {
      const raw = localStorage.getItem(STREAK_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      this.lastLoginDate = data.lastLoginDate ?? null;
      this.loginStreak = data.loginStreak ?? 0;
    } catch (e) {
      console.warn('[Currency] Failed to load streak:', e);
      this.lastLoginDate = null;
      this.loginStreak = 0;
    }
  }

  // ============================================================
  //  Anti-cheat / Validation
  // ============================================================

  /**
   * Validate that a Gold balance is within legitimate bounds.
   * @param {number} amount
   * @returns {boolean}
   */
  isLegitimateGold(amount) {
    return Number.isFinite(amount) && amount >= 0 && amount <= ABSURD_GOLD_CAP;
  }

  /**
   * Get the audit log (last 100 entries).
   * @returns {Array<object>}
   */
  getAuditLog() {
    return [...this.auditLog];
  }

  /** @private */
  _audit(action, amount, reason = '') {
    const entry = {
      action,
      amount,
      reason,
      silverAfter: this.getSilver(),
      goldAfter: this.getGold(),
      ts: Date.now()
    };
    this.auditLog.push(entry);
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog.shift();
    }
  }

  // ============================================================
  //  Persistence
  // ============================================================

  /** Persist currency state to localStorage. */
  save() {
    const payload = {
      silver: this.game.state.silver ?? 0,
      gold: this.game.state.gold ?? 0,
      lastGrant: this.lastGrantTime,
      dailyGranted: this.dailyGranted,
      savedAt: Date.now()
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error('[Currency] save failed:', e);
    }
  }

  /** Load currency state from localStorage. */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this._setDefaults();
        return;
      }
      const data = JSON.parse(raw);

      if (Number.isFinite(data.silver)) this.game.state.silver = data.silver;
      if (Number.isFinite(data.gold)) this.game.state.gold = data.gold;
      if (Number.isFinite(data.lastGrant)) this.lastGrantTime = data.lastGrant;
      if (Number.isFinite(data.dailyGranted)) this.dailyGranted = data.dailyGranted;

      // Also load streak
      this._loadStreak();
    } catch (e) {
      console.warn('[Currency] Load failed, resetting:', e);
      this._setDefaults();
    }
  }

  /** Reset to default starting values. */
  reset() {
    this._setDefaults();
    this.save();
    this._saveStreak();
    this.auditLog = [];
  }

  /** @private */
  _setDefaults() {
    this.game.state.silver = 500; // starting silver
    this.game.state.gold = 50;    // starting gold
    this.lastGrantTime = 0;
    this.dailyGranted = 0;
    this.lastLoginDate = null;
    this.loginStreak = 0;
  }

  // ============================================================
  //  UI Helpers
  // ============================================================

  /** @private */
  _toastIfUI(message, type = 'info') {
    if (this.game.ui && typeof this.game.ui.toast === 'function') {
      this.game.ui.toast(message, type);
    }
  }

  /**
   * Format currency display string.
   * @param {number} amount
   * @returns {string}
   */
  static format(amount) {
    if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'M';
    if (amount >= 1000) return (amount / 1000).toFixed(1) + 'K';
    return String(amount);
  }

  /**
   * Get total lifetime currency earned estimate.
   * @returns {object}
   */
  getStats() {
    const audit = this.auditLog;
    const totalSilverEarned = audit
      .filter(e => e.action === 'ADD_SILVER')
      .reduce((s, e) => s + e.amount, 0);
    const totalGoldEarned = audit
      .filter(e => e.action === 'ADD_GOLD')
      .reduce((s, e) => s + e.amount, 0);
    const totalSilverSpent = audit
      .filter(e => e.action === 'SPEND_SILVER')
      .reduce((s, e) => s + e.amount, 0);
    const totalGoldSpent = audit
      .filter(e => e.action === 'SPEND_GOLD')
      .reduce((s, e) => s + e.amount, 0);

    return {
      silver: { current: this.getSilver(), earned: totalSilverEarned, spent: totalSilverSpent },
      gold: { current: this.getGold(), earned: totalGoldEarned, spent: totalGoldSpent },
      hourlyGrantsToday: this.dailyGranted,
      dailyCap: this.dailyCap,
      streak: this.loginStreak
    };
  }
}
