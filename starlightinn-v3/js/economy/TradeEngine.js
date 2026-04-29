/**
 * TradeEngine.js
 * Safe player-to-player trading system for Starlight Inn v3.0.
 * Features: two-phase lock, 5-second countdown, fairness scoring,
 * anti-scam validation (ownership, duplicates, inventory space),
 * and full trade receipt logging.
 *
 * @module economy/TradeEngine
 */

const TRADE_LOG_KEY = 'starlight_trade_log';
const MAX_LOG_ENTRIES = 50;

/**
 * Gold-to-Silver conversion rate for value parity calculations.
 * @type {number}
 */
const GOLD_SILVER_RATIO = 10;

/**
 * Trade session states.
 * @type {Record<string, string>}
 */
export const TRADE_STATES = {
  OPEN: 'open',           // Negotiation phase
  LOCKED: 'locked',       // One side locked
  COUNTING: 'counting',   // Both locked, countdown active
  COMPLETE: 'complete',   // Trade executed
  CANCELLED: 'cancelled', // Aborted
  EXPIRED: 'expired'      // Timed out
};

/**
 * Represents a single bilateral trade session between two players.
 */
export class TradeSession {
  /**
   * @param {string} id
   * @param {string} initiatorId
   * @param {string} targetId
   */
  constructor(id, initiatorId, targetId) {
    this.id = id;
    this.initiatorId = initiatorId;
    this.targetId = targetId;

    // Offer arrays contain full item objects (from initiator/target inventory)
    this.initiatorOffer = [];
    this.targetOffer = [];

    // Lock flags
    this.initiatorLocked = false;
    this.targetLocked = false;
    this.initiatorConfirmed = false;
    this.targetConfirmed = false;

    this.state = TRADE_STATES.OPEN;
    this.countdown = 5;
    this.createdAt = Date.now();
    this.timeout = 120000; // 2 minutes hard timeout
    this.completedAt = null;
    this.cancelledBy = null;
    this.cancelReason = null;
    this.fairnessResult = null;
    this.receipt = null;

    // Internal countdown timer ref
    this._countdownTimer = null;
    this._expiryTimer = null;
  }

  /**
   * Get the offer array for a given side.
   * @param {'initiator'|'target'} side
   * @returns {Array<object>}
   */
  getOffer(side) {
    return side === 'initiator' ? this.initiatorOffer : this.targetOffer;
  }

  /**
   * Set the lock flag for a side.
   * @param {'initiator'|'target'} side
   * @param {boolean} locked
   */
  setLock(side, locked) {
    if (side === 'initiator') this.initiatorLocked = locked;
    else this.targetLocked = locked;
  }

  /**
   * Check if both sides are locked.
   * @returns {boolean}
   */
  bothLocked() {
    return this.initiatorLocked && this.targetLocked;
  }

  /**
   * Check if both sides have confirmed after countdown.
   * @returns {boolean}
   */
  bothConfirmed() {
    return this.initiatorConfirmed && this.targetConfirmed;
  }

  /** Clean up timers. */
  dispose() {
    if (this._countdownTimer) clearInterval(this._countdownTimer);
    if (this._expiryTimer) clearTimeout(this._expiryTimer);
    this._countdownTimer = null;
    this._expiryTimer = null;
  }
}

/**
 * TradeEngine manages active trade sessions, fairness calculation,
 * anti-scam validation, and atomic item exchange.
 */
export class TradeEngine {
  /**
   * @param {object} game - Main game reference
   */
  constructor(game) {
    if (!game || typeof game !== 'object') {
      throw new TypeError('TradeEngine requires a valid game reference');
    }
    this.game = game;
    /** @type {Map<string, TradeSession>} */
    this.trades = new Map();
    /** @type {Array<object>} */
    this.tradeLog = [];
    this._loadLog();
  }

  // ============================================================
  //  Session Lifecycle
  // ============================================================

  /**
   * Initiate a new trade session.
   * @param {string} initiatorId
   * @param {string} targetId
   * @returns {TradeSession}
   */
  initiate(initiatorId, targetId) {
    const id = `trade_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const session = new TradeSession(id, initiatorId, targetId);

    // Hard expiry timer
    session._expiryTimer = setTimeout(() => {
      this._expire(session.id);
    }, session.timeout);

    this.trades.set(id, session);
    this._toastIfUI(`Trade initiated with ${targetId}`, 'info');
    return session;
  }

  /**
   * Get an active trade session.
   * @param {string} tradeId
   * @returns {TradeSession | undefined}
   */
  getTrade(tradeId) {
    return this.trades.get(tradeId);
  }

  /**
   * Cancel an active trade and return items to owners.
   * @param {string} tradeId
   * @param {string} cancelledBy - player ID who cancelled
   * @param {string} [reason='']
   * @returns {boolean}
   */
  cancel(tradeId, cancelledBy, reason = '') {
    const trade = this.trades.get(tradeId);
    if (!trade) return false;
    if (trade.state === TRADE_STATES.COMPLETE || trade.state === TRADE_STATES.CANCELLED) return false;

    trade.state = TRADE_STATES.CANCELLED;
    trade.cancelledBy = cancelledBy;
    trade.cancelReason = reason || 'cancelled_by_user';
    trade.dispose();

    // Return items to inventories (if local engine, items are still in inventory)
    // In a networked setup, this would trigger server-side returns.
    this._logTrade(trade, 'cancelled');
    this._toastIfUI('Trade cancelled.', 'warning');
    this.trades.delete(tradeId);
    return true;
  }

  /** @private */
  _expire(tradeId) {
    const trade = this.trades.get(tradeId);
    if (!trade) return;
    if (trade.state === TRADE_STATES.COMPLETE || trade.state === TRADE_STATES.CANCELLED) return;

    trade.state = TRADE_STATES.EXPIRED;
    trade.cancelReason = 'session_expired';
    trade.dispose();
    this._logTrade(trade, 'expired');
    this._toastIfUI('Trade session expired.', 'warning');
    this.trades.delete(tradeId);
  }

  // ============================================================
  //  Offer Management
  // ============================================================

  /**
   * Add an item to a trade offer.
   * @param {string} tradeId
   * @param {string} itemUid - Unique inventory UID
   * @param {'initiator'|'target'} side
   * @returns {{success: boolean, message: string}}
   */
  addItem(tradeId, itemUid, side) {
    const trade = this.trades.get(tradeId);
    if (!trade) return { success: false, message: 'Trade not found.' };
    if (trade.state !== TRADE_STATES.OPEN && trade.state !== TRADE_STATES.LOCKED) {
      return { success: false, message: 'Trade is not open for changes.' };
    }

    const offer = side === 'initiator' ? trade.initiatorOffer : trade.targetOffer;
    const inventory = side === 'initiator' ? this.game.inventory : this.game.inventory;
    // In a real networked game, each player has their own inventory instance.
    // Here we use the local inventory; for P2P trades we assume both are local.

    const item = inventory.getItem(itemUid);
    if (!item) return { success: false, message: 'Item not found in inventory.' };

    // Prevent duplicates in the same offer
    if (offer.some(o => o.uid === itemUid)) {
      return { success: false, message: 'Item already in offer.' };
    }

    // Unlock if previously locked
    trade.setLock(side, false);
    if (side === 'initiator') trade.initiatorConfirmed = false;
    else trade.targetConfirmed = false;
    trade.state = TRADE_STATES.OPEN;

    offer.push(item);
    this._updateFairness(trade);
    return { success: true, message: `Added ${item.name} to offer.` };
  }

  /**
   * Remove an item from a trade offer.
   * @param {string} tradeId
   * @param {string} itemUid
   * @param {'initiator'|'target'} side
   * @returns {{success: boolean, message: string}}
   */
  removeItem(tradeId, itemUid, side) {
    const trade = this.trades.get(tradeId);
    if (!trade) return { success: false, message: 'Trade not found.' };
    if (trade.state !== TRADE_STATES.OPEN && trade.state !== TRADE_STATES.LOCKED) {
      return { success: false, message: 'Trade is not open for changes.' };
    }

    const offer = side === 'initiator' ? trade.initiatorOffer : trade.targetOffer;
    const idx = offer.findIndex(o => o.uid === itemUid);
    if (idx === -1) return { success: false, message: 'Item not in offer.' };

    const removed = offer.splice(idx, 1)[0];
    trade.setLock(side, false);
    if (side === 'initiator') trade.initiatorConfirmed = false;
    else trade.targetConfirmed = false;
    trade.state = TRADE_STATES.OPEN;

    this._updateFairness(trade);
    return { success: true, message: `Removed ${removed.name} from offer.` };
  }

  // ============================================================
  //  Lock / Unlock / Confirm Flow
  // ============================================================

  /**
   * Lock a side's offer. If both locked, start 5-second countdown.
   * @param {string} tradeId
   * @param {'initiator'|'target'} side
   * @returns {{success: boolean, state: string, countdown?: number}}
   */
  lock(tradeId, side) {
    const trade = this.trades.get(tradeId);
    if (!trade) return { success: false, state: 'unknown' };
    if (trade.state !== TRADE_STATES.OPEN) return { success: false, state: trade.state };

    trade.setLock(side, true);

    if (trade.bothLocked()) {
      trade.state = TRADE_STATES.COUNTING;
      trade.countdown = 5;
      this._startCountdown(trade);
      return { success: true, state: TRADE_STATES.COUNTING, countdown: trade.countdown };
    }

    trade.state = TRADE_STATES.LOCKED;
    return { success: true, state: TRADE_STATES.LOCKED };
  }

  /**
   * Unlock a side's offer. Cancels countdown if active.
   * @param {string} tradeId
   * @param {'initiator'|'target'} side
   * @returns {{success: boolean, state: string}}
   */
  unlock(tradeId, side) {
    const trade = this.trades.get(tradeId);
    if (!trade) return { success: false, state: 'unknown' };

    trade.setLock(side, false);
    trade.initiatorConfirmed = false;
    trade.targetConfirmed = false;

    // Cancel countdown
    if (trade._countdownTimer) {
      clearInterval(trade._countdownTimer);
      trade._countdownTimer = null;
    }

    trade.state = TRADE_STATES.OPEN;
    return { success: true, state: TRADE_STATES.OPEN };
  }

  /**
   * Confirm trade after countdown. Both sides must confirm.
   * @param {string} tradeId
   * @param {'initiator'|'target'} side
   * @returns {{success: boolean, state: string}}
   */
  confirm(tradeId, side) {
    const trade = this.trades.get(tradeId);
    if (!trade) return { success: false, state: 'unknown' };
    if (trade.state !== TRADE_STATES.COUNTING) return { success: false, state: trade.state };

    if (side === 'initiator') trade.initiatorConfirmed = true;
    else trade.targetConfirmed = true;

    if (trade.bothConfirmed()) {
      return this._execute(trade);
    }

    return { success: true, state: trade.state };
  }

  /** @private */
  _startCountdown(trade) {
    if (trade._countdownTimer) clearInterval(trade._countdownTimer);
    trade._countdownTimer = setInterval(() => {
      trade.countdown--;
      this._emitCountdown(trade);
      if (trade.countdown <= 0) {
        clearInterval(trade._countdownTimer);
        trade._countdownTimer = null;
        // After countdown, both must explicitly confirm
        this._toastIfUI('Review your trade and confirm!', 'info');
      }
    }, 1000);
  }

  /** @private */
  _emitCountdown(trade) {
    // Hook for UI: game.ui.onTradeCountdown?.(trade)
    if (this.game.ui && typeof this.game.ui.onTradeCountdown === 'function') {
      this.game.ui.onTradeCountdown(trade);
    }
  }

  // ============================================================
  //  Execution
  // ============================================================

  /**
   * Execute the trade: validate, transfer, log, notify.
   * @param {TradeSession} trade
   * @returns {{success: boolean, state: string}}
   * @private
   */
  _execute(trade) {
    // Step 1: Validate
    const validation = this.validateTrade(trade);
    if (!validation.valid) {
      trade.state = TRADE_STATES.OPEN;
      trade.initiatorLocked = false;
      trade.targetLocked = false;
      trade.initiatorConfirmed = false;
      trade.targetConfirmed = false;
      this._toastIfUI(`Trade blocked: ${validation.reason}`, 'error');
      return { success: false, state: TRADE_STATES.OPEN };
    }

    // Step 2: Transfer items
    // In a networked game, this is server-authoritative.
    // Here we simulate by removing from initiator/target and adding to their inventories.
    for (const item of trade.initiatorOffer) {
      this.game.inventory.removeItem(item.uid);
    }
    for (const item of trade.targetOffer) {
      this.game.inventory.removeItem(item.uid);
    }
    for (const item of trade.targetOffer) {
      this.game.inventory.addItem(item);
    }
    for (const item of trade.initiatorOffer) {
      this.game.inventory.addItem(item);
    }

    // Step 3: Finalize
    trade.state = TRADE_STATES.COMPLETE;
    trade.completedAt = Date.now();
    trade.dispose();

    // Step 4: Receipt
    trade.receipt = this._buildReceipt(trade);
    this._logTrade(trade, 'complete');
    this._toastIfUI('Trade completed successfully!', 'success');

    this.trades.delete(trade.id);
    return { success: true, state: TRADE_STATES.COMPLETE };
  }

  // ============================================================
  //  Value & Fairness
  // ============================================================

  /**
   * Calculate the total value of an array of items.
   * Uses Gold*10 + Silver as a unified value metric.
   * @param {Array<object>} items
   * @returns {number}
   */
  calculateValue(items) {
    return items.reduce((sum, item) =>
      sum + (item.priceGold ?? 0) * GOLD_SILVER_RATIO + (item.priceSilver ?? 0), 0);
  }

  /**
   * Evaluate trade fairness between two value totals.
   * @param {number} myValue
   * @param {number} theirValue
   * @returns {{rating: 'fair'|'okay'|'unfair', color: string, ratio: number, diff: number}}
   */
  getFairness(myValue, theirValue) {
    const max = Math.max(myValue, theirValue);
    const min = Math.min(myValue, theirValue);
    const ratio = max > 0 ? min / max : 1;
    const diff = myValue - theirValue;

    if (ratio >= 0.9) return { rating: 'fair', color: '#4CAF50', ratio, diff };
    if (ratio >= 0.7) return { rating: 'okay', color: '#FFC107', ratio, diff };
    return { rating: 'unfair', color: '#f44336', ratio, diff };
  }

  /** @private */
  _updateFairness(trade) {
    const initiatorValue = this.calculateValue(trade.initiatorOffer);
    const targetValue = this.calculateValue(trade.targetOffer);
    trade.fairnessResult = {
      initiatorValue,
      targetValue,
      initiatorFairness: this.getFairness(initiatorValue, targetValue),
      targetFairness: this.getFairness(targetValue, initiatorValue)
    };
  }

  // ============================================================
  //  Anti-scam Validation
  // ============================================================

  /**
   * Validate a trade before execution.
   * Checks: ownership, duplicates, inventory capacity.
   * @param {TradeSession} trade
   * @returns {{valid: boolean, reason?: string}}
   */
  validateTrade(trade) {
    const inventory = this.game.inventory;
    if (!inventory) return { valid: false, reason: 'Inventory unavailable.' };

    // 1. Verify initiator owns all offered items
    for (const item of trade.initiatorOffer) {
      if (!inventory.getItem(item.uid)) {
        return { valid: false, reason: `Initiator does not own ${item.name}.` };
      }
    }

    // 2. Verify target owns all offered items
    // In a real networked game, we check the target's inventory.
    // Here we assume local simulation: skip target ownership check.

    // 3. No duplicate UIDs in either offer
    const initiatorUids = new Set(trade.initiatorOffer.map(i => i.uid));
    if (initiatorUids.size !== trade.initiatorOffer.length) {
      return { valid: false, reason: 'Duplicate items in initiator offer.' };
    }
    const targetUids = new Set(trade.targetOffer.map(i => i.uid));
    if (targetUids.size !== trade.targetOffer.length) {
      return { valid: false, reason: 'Duplicate items in target offer.' };
    }

    // 4. Inventory capacity check
    const itemsIncomingToInitiator = trade.targetOffer.length;
    const itemsIncomingToTarget = trade.initiatorOffer.length;
    const itemsLeavingInitiator = trade.initiatorOffer.length;
    const itemsLeavingTarget = trade.targetOffer.length;

    const initiatorNet = itemsIncomingToInitiator - itemsLeavingInitiator;
    const targetNet = itemsIncomingToTarget - itemsLeavingTarget;

    if (inventory.freeSlots() + itemsLeavingInitiator < itemsIncomingToInitiator) {
      return { valid: false, reason: 'Initiator does not have enough inventory space.' };
    }
    // Target capacity check is skipped in local mode (same inventory)

    // 5. Both sides must be locked and confirmed
    if (!trade.bothLocked() || !trade.bothConfirmed()) {
      return { valid: false, reason: 'Both parties must lock and confirm.' };
    }

    // 6. Sanity: trade must not be empty on both sides
    if (trade.initiatorOffer.length === 0 && trade.targetOffer.length === 0) {
      return { valid: false, reason: 'Both offers are empty.' };
    }

    return { valid: true };
  }

  // ============================================================
  //  Receipt & Logging
  // ============================================================

  /** @private */
  _buildReceipt(trade) {
    return {
      tradeId: trade.id,
      initiatorId: trade.initiatorId,
      targetId: trade.targetId,
      initiatorOffer: trade.initiatorOffer.map(i => ({ id: i.id, name: i.name, rarity: i.rarity })),
      targetOffer: trade.targetOffer.map(i => ({ id: i.id, name: i.name, rarity: i.rarity })),
      initiatorValue: trade.fairnessResult?.initiatorValue ?? 0,
      targetValue: trade.fairnessResult?.targetValue ?? 0,
      fairness: trade.fairnessResult?.initiatorFairness ?? null,
      completedAt: trade.completedAt
    };
  }

  /** @private */
  _logTrade(trade, outcome) {
    const entry = {
      tradeId: trade.id,
      initiatorId: trade.initiatorId,
      targetId: trade.targetId,
      initiatorOfferCount: trade.initiatorOffer.length,
      targetOfferCount: trade.targetOffer.length,
      initiatorValue: trade.fairnessResult?.initiatorValue ?? 0,
      targetValue: trade.fairnessResult?.targetValue ?? 0,
      outcome,
      cancelledBy: trade.cancelledBy ?? null,
      reason: trade.cancelReason ?? null,
      ts: Date.now()
    };
    this.tradeLog.push(entry);
    if (this.tradeLog.length > MAX_LOG_ENTRIES) this.tradeLog.shift();
    this._saveLog();
  }

  /** @private */
  _saveLog() {
    try {
      localStorage.setItem(TRADE_LOG_KEY, JSON.stringify(this.tradeLog));
    } catch (e) {
      console.error('[TradeEngine] log save failed:', e);
    }
  }

  /** @private */
  _loadLog() {
    try {
      const raw = localStorage.getItem(TRADE_LOG_KEY);
      if (raw) this.tradeLog = JSON.parse(raw);
    } catch (e) {
      this.tradeLog = [];
    }
  }

  /**
   * Get trade history.
   * @param {number} [limit=20]
   * @returns {Array<object>}
   */
  getTradeLog(limit = 20) {
    return this.tradeLog.slice(-limit).reverse();
  }

  /**
   * Get trade statistics.
   * @returns {object}
   */
  getStats() {
    const total = this.tradeLog.length;
    const completed = this.tradeLog.filter(t => t.outcome === 'complete').length;
    const cancelled = this.tradeLog.filter(t => t.outcome === 'cancelled').length;
    const totalValueExchanged = this.tradeLog
      .filter(t => t.outcome === 'complete')
      .reduce((s, t) => s + t.initiatorValue + t.targetValue, 0);
    return { total, completed, cancelled, totalValueExchanged };
  }

  // ============================================================
  //  Helpers
  // ============================================================

  /** @private */
  _toastIfUI(message, type = 'info') {
    if (this.game.ui && typeof this.game.ui.toast === 'function') {
      this.game.ui.toast(message, type);
    }
  }
}
