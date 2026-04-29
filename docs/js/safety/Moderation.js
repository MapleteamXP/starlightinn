/**
 * Moderation.js — Room Moderation & Player Management Tools
 *
 * Provides room owners, moderators, and admins with tools to
 * manage their spaces: kick, mute, ban, safe mode, block lists.
 * Also includes child-safety features and pre-approved message
 * support for restricted environments.
 *
 * Features:
 * - Kick: remove player from area (send to hub)
 * - Mute: temporary chat silence with auto-expire
 * - Ban: temporary area entry denial with auto-expire
 * - Safe mode: restrict chat to pre-approved messages only
 * - Block list: personal ignore / mute list per player
 * - Admin escalation: elevate to game-wide moderation
 * - Action logging: all moderation actions recorded
 *
 * @author Starlight Inn Safety Team
 * @version 3.0.0
 */

export class Moderation {
  /**
   * Create a new Moderation manager.
   * @param {Object} game - Game engine reference.
   */
  constructor(game) {
    /** @type {Object} Game engine reference. */
    this.game = game;

    /** @type {Map<string, Array<{action:string, targetId:string, reason:string, timestamp:number, duration:number, by:string}>>} Action logs per area. */
    this.actionLogs = new Map();

    /** @type {Map<string, Array<{playerId:string, mutedAt:number, expiresAt:number, reason:string, by:string}>>} Mute list per area. */
    this.muteLists = new Map();

    /** @type {Map<string, Array<{playerId:string, bannedAt:number, expiresAt:number, reason:string, by:string}>>} Ban list per area. */
    this.banLists = new Map();

    /** @type {number} Default mute duration in minutes. */
    this.defaultMuteDuration = 5;

    /** @type {number} Default ban duration in hours. */
    this.defaultBanDuration = 24;

    /** @type {number} Max action log entries per area. */
    this.maxLogEntries = 200;
  }

  /**
   * Kick a player from the current area.
   * @param {string} playerId - Target player ID.
   * @param {string} [reason=''] - Reason for kick.
   * @param {string} [by=''] - Moderator name.
   * @returns {{success:boolean, message:string}} Result.
   */
  kick(playerId, reason = '', by = '') {
    const area = this.game?.state?.area;
    if (!area) {
      return { success: false, message: 'No active area.' };
    }

    const player = this.getPlayerById(playerId);
    if (!player) {
      return { success: false, message: 'Player not found in this area.' };
    }

    // Send player to hub
    if (this.game?.network?.sendToHub) {
      this.game.network.sendToHub(playerId);
    }

    // Notify target
    if (this.game?.chat?.private) {
      this.game.chat.private(
        playerId,
        `You have been removed from this area. Reason: ${reason || 'violation of community guidelines'}`
      );
    }

    // Log the action
    this.logAction(area, 'kick', playerId, reason, 0, by);

    // Broadcast to area (without naming to avoid drama)
    if (this.game?.chat?.system) {
      this.game.chat.system('A player has been removed from this area.');
    }

    console.log(`[Moderation] Kick: ${playerId} from ${area} by ${by || 'system'}`);

    return { success: true, message: 'Player kicked successfully.' };
  }

  /**
   * Mute a player in the current area.
   * @param {string} playerId - Target player ID.
   * @param {number} [durationMinutes=5] - Mute duration.
   * @param {string} [reason=''] - Reason for mute.
   * @param {string} [by=''] - Moderator name.
   * @returns {{success:boolean, message:string, expiresAt:number}} Result.
   */
  mute(playerId, durationMinutes = this.defaultMuteDuration, reason = '', by = '') {
    const area = this.game?.state?.area;
    if (!area) {
      return { success: false, message: 'No active area.', expiresAt: 0 };
    }

    const now = Date.now();
    const expiresAt = now + (durationMinutes * 60 * 1000);

    if (!this.muteLists.has(area)) {
      this.muteLists.set(area, []);
    }

    const mutes = this.muteLists.get(area);
    const existing = mutes.find(m => m.playerId === playerId);

    if (existing) {
      // Extend existing mute
      existing.expiresAt = Math.max(existing.expiresAt, expiresAt);
      existing.reason = reason || existing.reason;
    } else {
      mutes.push({
        playerId,
        mutedAt: now,
        expiresAt,
        reason,
        by: by || 'system',
      });
    }

    this.logAction(area, 'mute', playerId, reason, durationMinutes, by);

    // Notify target
    if (this.game?.chat?.private) {
      this.game.chat.private(
        playerId,
        `You have been muted for ${durationMinutes} minute(s). Reason: ${reason || 'spam or inappropriate behavior'}`
      );
    }

    console.log(`[Moderation] Mute: ${playerId} for ${durationMinutes}m in ${area}`);

    return {
      success: true,
      message: `Player muted for ${durationMinutes} minute(s).`,
      expiresAt,
    };
  }

  /**
   * Check if a player is currently muted.
   * @param {string} playerId - Player ID.
   * @param {string} [area] - Area ID (defaults to current).
   * @returns {{muted:boolean, reason:string, expiresIn:number}} Mute status.
   */
  isMuted(playerId, area) {
    const targetArea = area || this.game?.state?.area;
    if (!targetArea) return { muted: false, reason: '', expiresIn: 0 };

    const mutes = this.muteLists.get(targetArea) || [];
    const now = Date.now();
    const entry = mutes.find(m => m.playerId === playerId && m.expiresAt > now);

    if (entry) {
      return {
        muted: true,
        reason: entry.reason,
        expiresIn: Math.ceil((entry.expiresAt - now) / 1000),
      };
    }

    return { muted: false, reason: '', expiresIn: 0 };
  }

  /**
   * Unmute a player.
   * @param {string} playerId - Player ID.
   * @param {string} [area] - Area ID.
   * @returns {{success:boolean, message:string}}
   */
  unmute(playerId, area) {
    const targetArea = area || this.game?.state?.area;
    if (!targetArea) return { success: false, message: 'No area specified.' };

    const mutes = this.muteLists.get(targetArea) || [];
    const idx = mutes.findIndex(m => m.playerId === playerId);

    if (idx !== -1) {
      mutes.splice(idx, 1);
      this.logAction(targetArea, 'unmute', playerId, '', 0, '');
      return { success: true, message: 'Player unmuted.' };
    }

    return { success: false, message: 'Player was not muted.' };
  }

  /**
   * Ban a player from the current area.
   * @param {string} playerId - Target player ID.
   * @param {number} [durationHours=24] - Ban duration.
   * @param {string} [reason=''] - Reason for ban.
   * @param {string} [by=''] - Moderator name.
   * @returns {{success:boolean, message:string, expiresAt:number}} Result.
   */
  ban(playerId, durationHours = this.defaultBanDuration, reason = '', by = '') {
    const area = this.game?.state?.area;
    if (!area) {
      return { success: false, message: 'No active area.', expiresAt: 0 };
    }

    const now = Date.now();
    const expiresAt = now + (durationHours * 60 * 60 * 1000);

    if (!this.banLists.has(area)) {
      this.banLists.set(area, []);
    }

    const bans = this.banLists.get(area);
    const existing = bans.find(b => b.playerId === playerId);

    if (existing) {
      existing.expiresAt = Math.max(existing.expiresAt, expiresAt);
      existing.reason = reason || existing.reason;
    } else {
      bans.push({
        playerId,
        bannedAt: now,
        expiresAt,
        reason,
        by: by || 'system',
      });
    }

    // Kick the player immediately if they're in the area
    this.kick(playerId, reason, by);

    this.logAction(area, 'ban', playerId, reason, durationHours, by);

    console.log(`[Moderation] Ban: ${playerId} for ${durationHours}h in ${area}`);

    return {
      success: true,
      message: `Player banned for ${durationHours} hour(s).`,
      expiresAt,
    };
  }

  /**
   * Check if a player is banned from an area.
   * @param {string} playerId - Player ID.
   * @param {string} [area] - Area ID.
   * @returns {{banned:boolean, reason:string, expiresIn:number}} Ban status.
   */
  isBanned(playerId, area) {
    const targetArea = area || this.game?.state?.area;
    if (!targetArea) return { banned: false, reason: '', expiresIn: 0 };

    const bans = this.banLists.get(targetArea) || [];
    const now = Date.now();
    const entry = bans.find(b => b.playerId === playerId && b.expiresAt > now);

    if (entry) {
      return {
        banned: true,
        reason: entry.reason,
        expiresIn: Math.ceil((entry.expiresAt - now) / 1000),
      };
    }

    return { banned: false, reason: '', expiresIn: 0 };
  }

  /**
   * Unban a player.
   * @param {string} playerId - Player ID.
   * @param {string} [area] - Area ID.
   * @returns {{success:boolean, message:string}}
   */
  unban(playerId, area) {
    const targetArea = area || this.game?.state?.area;
    if (!targetArea) return { success: false, message: 'No area specified.' };

    const bans = this.banLists.get(targetArea) || [];
    const idx = bans.findIndex(b => b.playerId === playerId);

    if (idx !== -1) {
      bans.splice(idx, 1);
      this.logAction(targetArea, 'unban', playerId, '', 0, '');
      return { success: true, message: 'Player unbanned.' };
    }

    return { success: false, message: 'Player was not banned.' };
  }

  /**
   * Enable safe mode (pre-approved chat only).
   */
  enableSafeMode() {
    if (this.game?.state) {
      this.game.state.safeMode = true;
    }
    if (this.game?.chat?.system) {
      this.game.chat.system('Safe Mode enabled: chat is restricted to pre-approved messages.');
    }
    console.log('[Moderation] Safe mode enabled');
  }

  /**
   * Disable safe mode.
   */
  disableSafeMode() {
    if (this.game?.state) {
      this.game.state.safeMode = false;
    }
    if (this.game?.chat?.system) {
      this.game.chat.system('Safe Mode disabled: normal chat restored.');
    }
    console.log('[Moderation] Safe mode disabled');
  }

  /**
   * Get pre-approved safe-mode messages.
   * @returns {string[]} Safe message list.
   */
  getSafeMessages() {
    return [
      'Hello!',
      'Nice to meet you!',
      'This area is lovely!',
      'Want to play a game?',
      'Thank you!',
      'Goodbye!',
      'See you later!',
      'Have a nice day!',
      'That\'s cool!',
      'Great idea!',
      'I like this place!',
      'How are you?',
      'I\'m doing well, thanks!',
      'Welcome!',
      'Safe travels!',
      'Sweet dreams!',
      'Good luck!',
      'Well done!',
      'Nice outfit!',
      'Cozy vibes!',
    ];
  }

  /**
   * Block a player (personal mute / ignore).
   * @param {string} playerId - Target player ID.
   */
  blockPlayer(playerId) {
    if (!this.game?.state) return;
    if (!this.game.state.blockedPlayers) {
      this.game.state.blockedPlayers = [];
    }
    if (!this.game.state.blockedPlayers.includes(playerId)) {
      this.game.state.blockedPlayers.push(playerId);
    }
    this.saveBlockList();
  }

  /**
   * Unblock a player.
   * @param {string} playerId - Target player ID.
   */
  unblockPlayer(playerId) {
    if (!this.game?.state?.blockedPlayers) return;
    this.game.state.blockedPlayers = this.game.state.blockedPlayers.filter(
      id => id !== playerId
    );
    this.saveBlockList();
  }

  /**
   * Check if a player is blocked.
   * @param {string} playerId - Player ID.
   * @returns {boolean}
   */
  isBlocked(playerId) {
    return (this.game?.state?.blockedPlayers || []).includes(playerId);
  }

  /**
   * Get the block list.
   * @returns {string[]}
   */
  getBlockedPlayers() {
    return [...(this.game?.state?.blockedPlayers || [])];
  }

  /**
   * Save block list to localStorage.
   */
  saveBlockList() {
    if (!this.game?.state?.blockedPlayers) return;
    try {
      localStorage.setItem(
        'starlight_blocked_players',
        JSON.stringify(this.game.state.blockedPlayers)
      );
    } catch (e) {
      console.warn('[Moderation] Failed to save block list:', e);
    }
  }

  /**
   * Load block list from localStorage.
   */
  loadBlockList() {
    try {
      const stored = localStorage.getItem('starlight_blocked_players');
      if (stored && this.game?.state) {
        this.game.state.blockedPlayers = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[Moderation] Failed to load block list:', e);
    }
  }

  /**
   * Escalate a moderation action to game-wide admin.
   * @param {string} playerId - Target player ID.
   * @param {string} actionType - Type of escalation.
   * @param {string} [reason=''] - Reason.
   */
  escalate(playerId, actionType, reason = '') {
    const escalation = {
      playerId,
      actionType,
      reason,
      area: this.game?.state?.area,
      timestamp: Date.now(),
      reportedBy: this.game?.state?.player?.name || 'system',
    };

    console.log('[Moderation] Escalated to admin:', escalation);

    // In a real system, send to admin queue via network
    if (this.game?.network?.sendAdminAlert) {
      this.game.network.sendAdminAlert(escalation);
    }
  }

  /**
   * Log a moderation action.
   * @param {string} area - Area ID.
   * @param {string} action - Action type.
   * @param {string} targetId - Target player ID.
   * @param {string} reason - Reason.
   * @param {number} duration - Duration (minutes/hours depending on action).
   * @param {string} by - Moderator name.
   */
  logAction(area, action, targetId, reason, duration, by) {
    if (!this.actionLogs.has(area)) {
      this.actionLogs.set(area, []);
    }

    const logs = this.actionLogs.get(area);
    logs.push({
      action,
      targetId,
      reason,
      duration,
      by: by || 'system',
      timestamp: Date.now(),
    });

    // Trim to max
    if (logs.length > this.maxLogEntries) {
      logs.splice(0, logs.length - this.maxLogEntries);
    }
  }

  /**
   * Get moderation logs for an area.
   * @param {string} [area] - Area ID.
   * @returns {Array<Object>} Log entries.
   */
  getLogs(area) {
    const targetArea = area || this.game?.state?.area;
    return [...(this.actionLogs.get(targetArea) || [])].reverse();
  }

  /**
   * Get all moderation logs across all areas.
   * @returns {Array<Object>}
   */
  getAllLogs() {
    const all = [];
    for (const [area, logs] of this.actionLogs.entries()) {
      for (const log of logs) {
        all.push({ ...log, area });
      }
    }
    return all.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Clean expired mutes and bans (call periodically).
   */
  cleanup() {
    const now = Date.now();

    for (const [area, mutes] of this.muteLists.entries()) {
      const active = mutes.filter(m => m.expiresAt > now);
      if (active.length !== mutes.length) {
        this.muteLists.set(area, active);
      }
    }

    for (const [area, bans] of this.banLists.entries()) {
      const active = bans.filter(b => b.expiresAt > now);
      if (active.length !== bans.length) {
        this.banLists.set(area, active);
      }
    }
  }

  /**
   * Get moderation stats for an area.
   * @param {string} [area] - Area ID.
   * @returns {{mutes:number, bans:number, kicks:number, totalActions:number}}
   */
  getStats(area) {
    const targetArea = area || this.game?.state?.area;
    const logs = this.actionLogs.get(targetArea) || [];

    return {
      mutes: logs.filter(l => l.action === 'mute').length,
      bans: logs.filter(l => l.action === 'ban').length,
      kicks: logs.filter(l => l.action === 'kick').length,
      totalActions: logs.length,
    };
  }

  /**
   * Check if current player has moderation powers.
   * @returns {boolean}
   */
  isModerator() {
    const player = this.game?.state?.player;
    if (!player) return false;
    return player.isAdmin || player.isRoomOwner || player.isModerator;
  }

  /**
   * Check if current player owns the current room.
   * @returns {boolean}
   */
  isRoomOwner() {
    const area = this.game?.state?.area;
    const player = this.game?.state?.player;
    if (!area || !player) return false;
    return player.ownedAreas?.includes(area) || player.isAdmin;
  }

  /**
   * Look up a player object by ID.
   * @param {string} playerId - Player ID.
   * @returns {Object|null}
   */
  getPlayerById(playerId) {
    const players = this.game?.state?.players || [];
    return players.find(p => p.id === playerId) || null;
  }
}

export default Moderation;
