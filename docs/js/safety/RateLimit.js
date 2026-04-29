/**
 * RateLimit.js — Action Throttling & Cooldown System
 *
 * Enforces per-action rate limits per player to prevent spam,
 * abuse, flooding, and server overload. Client-side enforcement
 * with timestamps designed to be server-validated.
 *
 * Action limits:
 * - message:      5 per 10 seconds
 * - whisper:      1 per 3 seconds
 * - emote:       10 per 10 seconds
 * - friendRequest:  1 per 60 seconds
 * - tradeRequest:   1 per 60 seconds
 * - roomChange:     5 per 60 seconds
 * - gesture:        6 per 10 seconds
 * - report:         3 per 60 seconds
 * - powerUp:        5 per 60 seconds
 * - emoteBuy:       2 per 60 seconds
 * - furnitureMove: 10 per 60 seconds
 * - itemDrop:       3 per 10 seconds
 * - catalogOpen:   20 per 60 seconds
 *
 * @author Starlight Inn Safety Team
 * @version 3.0.0
 */

export class RateLimit {
  /**
   * Create a new RateLimit tracker.
   */
  constructor() {
    /** @type {Object<string, {max:number, window:number}>} Per-action limits. */
    this.limits = {
      message:        { max: 5,  window: 10000 },  // 5 messages per 10 seconds
      whisper:        { max: 1,  window: 3000 },   // 1 whisper per 3 seconds
      emote:          { max: 10, window: 10000 },  // 10 emotes per 10 seconds
      friendRequest:  { max: 1,  window: 60000 },  // 1 friend request per minute
      tradeRequest:   { max: 1,  window: 60000 },  // 1 trade request per minute
      roomChange:     { max: 5,  window: 60000 },  // 5 room changes per minute
      gesture:        { max: 6,  window: 10000 },  // 6 gestures per 10 seconds
      report:         { max: 3,  window: 60000 },  // 3 reports per minute
      powerUp:        { max: 5,  window: 60000 },  // 5 power-ups per minute
      emoteBuy:       { max: 2,  window: 60000 },  // 2 emote purchases per minute
      furnitureMove:  { max: 10, window: 60000 },  // 10 furniture moves per minute
      itemDrop:       { max: 3,  window: 10000 },  // 3 item drops per 10 seconds
      catalogOpen:    { max: 20, window: 60000 },  // 20 catalog opens per minute
      pinChange:      { max: 3,  window: 300000 }, // 3 pin changes per 5 minutes
      nameChange:     { max: 1,  window: 86400000 }, // 1 name change per day
      bioChange:      { max: 5,  window: 300000 }, // 5 bio edits per 5 minutes
    };

    /** @type {Map<string, Object<string, number[]>>} Player action history. */
    this.history = new Map();

    /** @type {Map<string, Object<string, number>>} Violation counts per player/action. */
    this.violations = new Map();

    /** @type {number} Global violation threshold before auto-mute suggestion. */
    this.violationThreshold = 5;

    /** @type {number} Max history entries per action per player (memory cap). */
    this.maxHistoryPerAction = 50;
  }

  /**
   * Check if a player may perform an action.
   * @param {string} playerId - Unique player identifier.
   * @param {string} action - Action type key.
   * @returns {boolean} True if allowed.
   */
  canPerform(playerId, action) {
    const limit = this.limits[action];
    if (!limit) return true; // no limit configured = allow

    const playerHistory = this.getPlayerHistory(playerId, action);
    const now = Date.now();
    const recent = playerHistory.filter(t => now - t < limit.window);

    return recent.length < limit.max;
  }

  /**
   * Check if allowed and record in one call.
   * @param {string} playerId - Player identifier.
   * @param {string} action - Action type.
   * @returns {{allowed:boolean, remaining:number, cooldown:number}} Result info.
   */
  checkAndRecord(playerId, action) {
    const allowed = this.canPerform(playerId, action);
    const remaining = this.getRemaining(playerId, action);
    const cooldown = this.getRemainingCooldown(playerId, action);

    if (allowed) {
      this.record(playerId, action);
    } else {
      this.incrementViolation(playerId, action);
    }

    return { allowed, remaining, cooldown };
  }

  /**
   * Record an action attempt (successful or not).
   * @param {string} playerId - Player identifier.
   * @param {string} action - Action type.
   */
  record(playerId, action) {
    if (!this.history.has(playerId)) {
      this.history.set(playerId, {});
    }
    const player = this.history.get(playerId);
    if (!player[action]) player[action] = [];
    player[action].push(Date.now());

    this.cleanup(playerId, action);
  }

  /**
   * Get remaining allowed actions before hitting limit.
   * @param {string} playerId - Player identifier.
   * @param {string} action - Action type.
   * @returns {number} Remaining count (0 if at limit).
   */
  getRemaining(playerId, action) {
    const limit = this.limits[action];
    if (!limit) return Infinity;

    const playerHistory = this.getPlayerHistory(playerId, action);
    const now = Date.now();
    const recent = playerHistory.filter(t => now - t < limit.window);
    return Math.max(0, limit.max - recent.length);
  }

  /**
   * Get cooldown milliseconds until next action is allowed.
   * @param {string} playerId - Player identifier.
   * @param {string} action - Action type.
   * @returns {number} Milliseconds until available (0 if available now).
   */
  getRemainingCooldown(playerId, action) {
    const limit = this.limits[action];
    if (!limit) return 0;

    const playerHistory = this.getPlayerHistory(playerId, action);
    const now = Date.now();
    const recent = playerHistory.filter(t => now - t < limit.window);

    if (recent.length < limit.max) return 0;

    const oldest = Math.min(...recent);
    return Math.max(0, limit.window - (now - oldest));
  }

  /**
   * Get all action timestamps for a player.
   * @param {string} playerId - Player identifier.
   * @param {string} action - Action type.
   * @returns {number[]} Timestamp array.
   */
  getPlayerHistory(playerId, action) {
    return (this.history.get(playerId)?.[action]) || [];
  }

  /**
   * Remove expired timestamps for a player/action.
   * @param {string} playerId - Player identifier.
   * @param {string} action - Action type.
   */
  cleanup(playerId, action) {
    const limit = this.limits[action];
    if (!limit) return;

    const player = this.history.get(playerId);
    if (!player || !player[action]) return;

    const now = Date.now();
    player[action] = player[action].filter(t => now - t < limit.window);

    // Hard cap to prevent memory bloat
    if (player[action].length > this.maxHistoryPerAction) {
      player[action] = player[action].slice(-this.maxHistoryPerAction);
    }
  }

  /**
   * Full cleanup of all expired entries for a player.
   * @param {string} playerId - Player identifier.
   */
  cleanupPlayer(playerId) {
    const player = this.history.get(playerId);
    if (!player) return;

    const now = Date.now();
    for (const action of Object.keys(player)) {
      const limit = this.limits[action];
      if (limit) {
        player[action] = player[action].filter(t => now - t < limit.window);
      }
    }
  }

  /**
   * Remove all data for a player (e.g., on disconnect).
   * @param {string} playerId - Player identifier.
   */
  resetPlayer(playerId) {
    this.history.delete(playerId);
    this.violations.delete(playerId);
  }

  /**
   * Check if a player has exceeded violation threshold.
   * @param {string} playerId - Player identifier.
   * @returns {boolean}
   */
  isRepeatOffender(playerId) {
    const violations = this.violations.get(playerId);
    if (!violations) return false;
    const total = Object.values(violations).reduce((a, b) => a + b, 0);
    return total >= this.violationThreshold;
  }

  /**
   * Increment violation count for a player/action.
   * @param {string} playerId - Player identifier.
   * @param {string} action - Action type.
   */
  incrementViolation(playerId, action) {
    if (!this.violations.has(playerId)) {
      this.violations.set(playerId, {});
    }
    const playerV = this.violations.get(playerId);
    playerV[action] = (playerV[action] || 0) + 1;
  }

  /**
   * Get violation counts for a player.
   * @param {string} playerId - Player identifier.
   * @returns {Object<string, number>}
   */
  getViolations(playerId) {
    return this.violations.get(playerId) || {};
  }

  /**
   * Reset violation count for a player.
   * @param {string} playerId - Player identifier.
   */
  resetViolations(playerId) {
    this.violations.delete(playerId);
  }

  /**
   * Get all currently limited actions for a player.
   * @param {string} playerId - Player identifier.
   * @returns {{action:string, remaining:number, cooldown:number}[]}
   */
  getLimitedActions(playerId) {
    const results = [];
    for (const action of Object.keys(this.limits)) {
      const remaining = this.getRemaining(playerId, action);
      if (remaining === 0) {
        results.push({
          action,
          remaining: 0,
          cooldown: this.getRemainingCooldown(playerId, action),
        });
      }
    }
    return results;
  }

  /**
   * Update a limit at runtime.
   * @param {string} action - Action type.
   * @param {number} max - New max count.
   * @param {number} window - New window in ms.
   */
  setLimit(action, max, window) {
    this.limits[action] = { max, window };
  }

  /**
   * Get current limit config.
   * @param {string} action - Action type.
   * @returns {{max:number, window:number}|undefined}
   */
  getLimit(action) {
    return this.limits[action];
  }

  /**
   * Export player data (for server sync / persistence).
   * @param {string} playerId - Player identifier.
   * @returns {Object|null}
   */
  exportPlayer(playerId) {
    const history = this.history.get(playerId);
    const violations = this.violations.get(playerId);
    if (!history && !violations) return null;
    return { playerId, history, violations };
  }

  /**
   * Import player data (from server sync).
   * @param {Object} data - Exported player data.
   */
  importPlayer(data) {
    if (data.playerId && data.history) {
      this.history.set(data.playerId, data.history);
    }
    if (data.playerId && data.violations) {
      this.violations.set(data.playerId, data.violations);
    }
  }

  /**
   * Get overall statistics.
   * @returns {{trackedPlayers:number, totalActions:number, totalViolations:number}}
   */
  getStats() {
    let totalActions = 0;
    for (const player of this.history.values()) {
      for (const timestamps of Object.values(player)) {
        totalActions += timestamps.length;
      }
    }

    let totalViolations = 0;
    for (const playerV of this.violations.values()) {
      totalViolations += Object.values(playerV).reduce((a, b) => a + b, 0);
    }

    return {
      trackedPlayers: this.history.size,
      totalActions,
      totalViolations,
    };
  }

  /**
   * Format cooldown as human-readable string.
   * @param {number} ms - Milliseconds.
   * @returns {string} Formatted string.
   */
  formatCooldown(ms) {
    if (ms <= 0) return 'now';
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.ceil(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.ceil(minutes / 60);
    return `${hours}h`;
  }
}

export default RateLimit;
