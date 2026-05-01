/**
 * ChatModeration.js — Starlight Inn v7.0
 * Real-time chat moderation, admin commands, moderator panel, appeal system,
 * parental controls, contextual analysis, trusted user system.
 *
 * @version 7.0.0
 * @author Starlight Inn Security Team
 * @license Proprietary
 */

'use strict';

import { ContentFirewall } from './ContentFirewall.js';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const MOD_CONFIG = Object.freeze({
  SEVERITY: {
    INFO: { level: 1, action: 'log', label: 'INFO' },
    WARN: { level: 2, action: 'warn', label: 'WARN' },
    MUTE: { level: 3, action: 'mute', label: 'MUTE' },
    BAN:  { level: 4, action: 'ban',  label: 'BAN'  }
  },
  GROOMING: {
    maxConversationAgeMs: 10 * 60 * 1000,
    minMessagesForAnalysis: 3,
    trustBuildingPhrases: ['ur cute','youre cute','you r cute','special friend','my favorite','only one','secret between','dont tell','private chat','off app','meet up','meet irl','how old r u','asl','a.s.l.','send pics','send pix','trade pix','where live','where u live'],
    isolationPhrases: ['dont tell anyone','just us','between us','our secret','no one else','they wont understand'],
    escalationPhrases: ['meet up','meet irl','your address','ur address','come over','parents home','home alone','when alone']
  },
  TARGETING: {
    maxMessagesToCheck: 20,
    targetingThreshold: 3,
    timeWindowMs: 5 * 60 * 1000
  },
  TRUSTED_USER: {
    minAccountAgeMs: 7 * 24 * 60 * 60 * 1000,
    maxViolations: 0,
    leniencyMultiplier: 0.5
  },
  NEW_USER: {
    maxMessageLength: 200,
    allowURLs: false,
    allowTrading: false,
    allowEmojis: true,
    restrictedWords: ['discord','snap','snapchat','instagram','insta','ig','kik','telegram','tg','whatsapp','watsapp','meet','address','phone','number','email','call','text']
  },
  ADMIN: {
    commands: ['mute','ban','warn','kick','announce','unmute','unban','modchat','logs','reports','broadcast','clearchat','slowmode','lockroom','unlockroom'],
    prefix: '/',
    announceCooldownMs: 5 * 1000
  },
  MODERATOR_PANEL: {
    refreshMs: 5000,
    maxReportsDisplay: 50,
    maxLogsDisplay: 100
  },
  APPEAL: {
    maxLength: 2000,
    cooldownMs: 24 * 60 * 60 * 1000,
    maxActiveAppeals: 3
  },
  PARENTAL: {
    pinHashIterations: 10000,
    maxPinAttempts: 5,
    pinLockoutMs: 30 * 60 * 1000,
    defaultPlaytimeLimitMs: 2 * 60 * 60 * 1000,
    defaultChatEnabled: true,
    defaultTradingEnabled: true
  },
  SLOW_MODE: {
    minDelayMs: 1000,
    maxDelayMs: 60_000
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function now() { return Date.now(); }

function safeJSONParse(str, fallback = null) {
  try { return JSON.parse(str); } catch { return fallback; }
}

function safeJSONStringify(obj) {
  try { return JSON.stringify(obj); } catch { return '{}'; }
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

function hashPin(pin, salt = 'starlight_inn_v7') {
  let hash = hashString(pin + salt);
  for (let i = 0; i < MOD_CONFIG.PARENTAL.pinHashIterations; i++) {
    hash = hashString(hash + salt + i);
  }
  return hash;
}

function clamp(num, min, max) { return Math.min(Math.max(num, min), max); }

function formatDuration(ms) {
  if (ms < 60_000) return `${Math.ceil(ms / 1000)}s`;
  if (ms < 60 * 60_000) return `${Math.ceil(ms / 60_000)}m`;
  if (ms < 24 * 60 * 60_000) return `${Math.ceil(ms / (60 * 60_000))}h`;
  return `${Math.ceil(ms / (24 * 60 * 60_000))}d`;
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION CONTEXT TRACKER
// ─────────────────────────────────────────────────────────────────────────────

class ConversationTracker {
  constructor(maxConversations = 500, maxMessagesPerConv = 50) {
    this.conversations = new Map(); // participantPair -> [messages]
    this.userMessageHistory = new Map(); // userId -> [messages]
    this.maxConversations = maxConversations;
    this.maxMessagesPerConv = maxMessagesPerConv;
    this._cleanupInterval = setInterval(() => this._cleanup(), 5 * 60_000);
  }

  _getConversationKey(userA, userB) {
    return [userA, userB].sort().join('::');
  }

  recordMessage(userId, targetId, message, timestamp = now()) {
    const key = this._getConversationKey(userId, targetId);
    let conv = this.conversations.get(key);
    if (!conv) {
      conv = [];
      if (this.conversations.size >= this.maxConversations) {
        const oldestKey = this.conversations.keys().next().value;
        this.conversations.delete(oldestKey);
      }
      this.conversations.set(key, conv);
    }
    const entry = { sender: userId, message, timestamp, id: `msg-${timestamp}-${Math.random().toString(36).slice(2, 8)}` };
    conv.push(entry);
    if (conv.length > this.maxMessagesPerConv) conv.shift();

    // Also track per-user history
    let userHistory = this.userMessageHistory.get(userId);
    if (!userHistory) { userHistory = []; this.userMessageHistory.set(userId, userHistory); }
    userHistory.push({ targetId, message, timestamp });
    if (userHistory.length > 100) userHistory.shift();
  }

  getConversation(userA, userB) {
    return this.conversations.get(this._getConversationKey(userA, userB)) || [];
  }

  getUserHistory(userId, limit = 50) {
    const history = this.userMessageHistory.get(userId) || [];
    return history.slice(-limit);
  }

  analyzeGroomingPatterns(userA, userB) {
    const conv = this.getConversation(userA, userB);
    if (conv.length < MOD_CONFIG.GROOMING.minMessagesForAnalysis) return { risk: 0, flags: [] };
    const recent = conv.filter(m => now() - m.timestamp < MOD_CONFIG.GROOMING.maxConversationAgeMs);
    const flags = [];
    let trustScore = 0;
    let isolationScore = 0;
    let escalationScore = 0;
    const allText = recent.map(m => m.message.toLowerCase()).join(' ');
    for (const phrase of MOD_CONFIG.GROOMING.trustBuildingPhrases) {
      if (allText.includes(phrase)) trustScore++;
    }
    for (const phrase of MOD_CONFIG.GROOMING.isolationPhrases) {
      if (allText.includes(phrase)) isolationScore++;
    }
    for (const phrase of MOD_CONFIG.GROOMING.escalationPhrases) {
      if (allText.includes(phrase)) escalationScore++;
    }
    if (trustScore >= 2) flags.push('trust_building');
    if (isolationScore >= 1) flags.push('isolation');
    if (escalationScore >= 1) flags.push('escalation');
    const risk = trustScore * 2 + isolationScore * 4 + escalationScore * 6;
    return { risk, flags, trustScore, isolationScore, escalationScore, messageCount: recent.length };
  }

  analyzeRepetitiveTargeting(userId, roomUsers = []) {
    const history = this.getUserHistory(userId, 50);
    if (history.length < MOD_CONFIG.TARGETING.targetingThreshold) return { isTargeting: false, targetCounts: {} };
    const targetCounts = {};
    const recent = history.filter(m => now() - m.timestamp < MOD_CONFIG.TARGETING.timeWindowMs);
    for (const entry of recent) {
      targetCounts[entry.targetId] = (targetCounts[entry.targetId] || 0) + 1;
    }
    for (const [targetId, count] of Object.entries(targetCounts)) {
      if (count >= MOD_CONFIG.TARGETING.targetingThreshold) {
        return { isTargeting: true, targetId, messageCount: count, targetCounts };
      }
    }
    return { isTargeting: false, targetCounts };
  }

  _cleanup() {
    const cutoff = now() - 30 * 60 * 1000;
    for (const [key, conv] of this.conversations.entries()) {
      const recent = conv.filter(m => m.timestamp > cutoff);
      if (recent.length === 0) this.conversations.delete(key);
      else this.conversations.set(key, recent);
    }
    for (const [userId, history] of this.userMessageHistory.entries()) {
      const recent = history.filter(m => m.timestamp > cutoff);
      if (recent.length === 0) this.userMessageHistory.delete(userId);
      else this.userMessageHistory.set(userId, recent);
    }
  }

  destroy() { clearInterval(this._cleanupInterval); }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRUSTED USER SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

class TrustedUserSystem {
  constructor(firewall) {
    this.firewall = firewall;
    this._violationCounts = new Map(); // userId -> count
    this._trustedCache = new Map(); // userId -> { trusted, expiresAt }
    this._cacheTTL = 60_000;
  }

  isTrusted(userId, profile = {}) {
    const cached = this._trustedCache.get(userId);
    if (cached && cached.expiresAt > now()) return cached.trusted;
    const accountAge = profile.accountCreatedAt ? now() - profile.accountCreatedAt : 0;
    const violations = this._violationCounts.get(userId) || 0;
    const trusted = accountAge >= MOD_CONFIG.TRUSTED_USER.minAccountAgeMs && violations <= MOD_CONFIG.TRUSTED_USER.maxViolations;
    this._trustedCache.set(userId, { trusted, expiresAt: now() + this._cacheTTL });
    return trusted;
  }

  getLeniency(userId, profile = {}) {
    if (this.isTrusted(userId, profile)) return MOD_CONFIG.TRUSTED_USER.leniencyMultiplier;
    return 1.0;
  }

  recordViolation(userId, severity) {
    const current = (this._violationCounts.get(userId) || 0) + 1;
    this._violationCounts.set(userId, current);
    this._trustedCache.delete(userId);
    if (this.firewall) {
      this.firewall.storage.set(`violations_${userId}`, { count: current, lastViolation: now(), lastSeverity: severity });
    }
  }

  getViolationCount(userId) {
    return this._violationCounts.get(userId) || 0;
  }

  resetViolations(userId) {
    this._violationCounts.delete(userId);
    this._trustedCache.delete(userId);
    if (this.firewall) this.firewall.storage.remove(`violations_${userId}`);
  }

  loadFromStorage() {
    if (!this.firewall) return;
    const keys = this.firewall.storage.keys().filter(k => k.startsWith('violations_'));
    for (const key of keys) {
      const userId = key.replace('violations_', '');
      const data = this.firewall.storage.get(key);
      if (data && data.count) this._violationCounts.set(userId, data.count);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW USER RESTRICTIONS
// ─────────────────────────────────────────────────────────────────────────────

class NewUserRestrictions {
  constructor(firewall) {
    this.firewall = firewall;
  }

  isNewUser(profile = {}) {
    if (!profile.accountCreatedAt) return true;
    return now() - profile.accountCreatedAt < 24 * 60 * 60 * 1000;
  }

  validateMessage(userId, message, profile = {}) {
    const result = { allowed: true, reason: null, violations: [] };
    if (!this.isNewUser(profile)) return result;
    if (message.length > MOD_CONFIG.NEW_USER.maxMessageLength) {
      result.allowed = false;
      result.reason = `New accounts limited to ${MOD_CONFIG.NEW_USER.maxMessageLength} characters.`;
      result.violations.push({ type: 'new_user_length', max: MOD_CONFIG.NEW_USER.maxMessageLength, actual: message.length });
      return result;
    }
    const lower = message.toLowerCase();
    if (!MOD_CONFIG.NEW_USER.allowURLs) {
      const urlRegex = /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}/gi;
      if (urlRegex.test(lower)) {
        result.allowed = false;
        result.reason = 'URLs not allowed for new accounts.';
        result.violations.push({ type: 'new_user_url' });
      }
      urlRegex.lastIndex = 0;
    }
    for (const word of MOD_CONFIG.NEW_USER.restrictedWords) {
      if (lower.includes(word)) {
        result.allowed = false;
        result.reason = `Restricted content for new accounts.`;
        result.violations.push({ type: 'new_user_restricted_word', word });
      }
    }
    return result;
  }

  canTrade(profile = {}) {
    if (!this.isNewUser(profile)) return { allowed: true };
    return { allowed: MOD_CONFIG.NEW_USER.allowTrading, reason: 'Trading restricted for first 24 hours.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN COMMAND PARSER & EXECUTOR
// ─────────────────────────────────────────────────────────────────────────────

class AdminCommandSystem {
  constructor(firewall, moderatorPanel) {
    this.firewall = firewall;
    this.moderatorPanel = moderatorPanel;
    this._lastAnnounceTime = 0;
    this._commandLog = [];
  }

  parseCommand(message) {
    if (!message || !message.startsWith(MOD_CONFIG.ADMIN.prefix)) return null;
    const parts = message.slice(1).trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    return { command, args, raw: message };
  }

  isAdminCommand(message) {
    return this.parseCommand(message) !== null;
  }

  executeCommand(userId, message, profile = {}) {
    if (!profile.moderator && !profile.admin) {
      return { success: false, error: 'Insufficient permissions.', visibleToUser: true };
    }
    const parsed = this.parseCommand(message);
    if (!parsed) return { success: false, error: 'Invalid command format.' };
    const { command, args } = parsed;
    if (!MOD_CONFIG.ADMIN.commands.includes(command)) {
      return { success: false, error: `Unknown command: ${command}`, visibleToUser: true };
    }
    this._logCommand(userId, command, args);
    switch (command) {
      case 'mute': return this._cmdMute(userId, args, profile);
      case 'unmute': return this._cmdUnmute(userId, args, profile);
      case 'ban': return this._cmdBan(userId, args, profile);
      case 'unban': return this._cmdUnban(userId, args, profile);
      case 'warn': return this._cmdWarn(userId, args, profile);
      case 'kick': return this._cmdKick(userId, args, profile);
      case 'announce': return this._cmdAnnounce(userId, args, profile);
      case 'broadcast': return this._cmdBroadcast(userId, args, profile);
      case 'clearchat': return this._cmdClearChat(userId, args, profile);
      case 'slowmode': return this._cmdSlowMode(userId, args, profile);
      case 'lockroom': return this._cmdLockRoom(userId, args, profile);
      case 'unlockroom': return this._cmdUnlockRoom(userId, args, profile);
      case 'logs': return this._cmdLogs(userId, args, profile);
      case 'reports': return this._cmdReports(userId, args, profile);
      case 'modchat': return this._cmdModChat(userId, args, profile);
      default: return { success: false, error: `Command not yet implemented: ${command}` };
    }
  }

  _cmdMute(issuerId, args, profile) {
    if (args.length < 2) return { success: false, error: 'Usage: /mute <username> <duration> [reason]', visibleToUser: true };
    const target = args[0];
    const durationStr = args[1];
    const reason = args.slice(2).join(' ') || 'No reason provided';
    const durationMs = this._parseDuration(durationStr);
    if (!durationMs) return { success: false, error: 'Invalid duration. Use: 5m, 30m, 1h, 24h, 7d', visibleToUser: true };
    const result = this.firewall.muteSystem.muteUser(target, durationMs, reason, issuerId);
    if (result.success) {
      this.firewall.logger.info('admin_mute', { issuerId, target, durationMs, reason });
      return { success: true, message: `Muted ${target} for ${formatDuration(durationMs)}. Reason: ${reason}`, broadcastToMods: true };
    }
    return { success: false, error: result.error || 'Failed to mute user.' };
  }

  _cmdUnmute(issuerId, args, profile) {
    if (args.length < 1) return { success: false, error: 'Usage: /unmute <username>', visibleToUser: true };
    const target = args[0];
    const result = this.firewall.muteSystem.unmuteUser(target, issuerId);
    if (result.success) {
      this.firewall.logger.info('admin_unmute', { issuerId, target });
      return { success: true, message: `Unmuted ${target}.`, broadcastToMods: true };
    }
    return { success: false, error: 'Failed to unmute user.' };
  }

  _cmdBan(issuerId, args, profile) {
    if (args.length < 2) return { success: false, error: 'Usage: /ban <username> <duration|permanent> <reason>', visibleToUser: true };
    const target = args[0];
    const durationStr = args[1];
    const reason = args.slice(2).join(' ') || 'No reason provided';
    const durationMs = durationStr.toLowerCase() === 'permanent' || durationStr.toLowerCase() === 'perm' ? null : this._parseDuration(durationStr);
    if (durationStr.toLowerCase() !== 'permanent' && durationStr.toLowerCase() !== 'perm' && !durationMs) {
      return { success: false, error: 'Invalid duration. Use: 1h, 24h, 7d, 30d, permanent', visibleToUser: true };
    }
    const fp = this.firewall.accountProtection.generateDeviceFingerprint();
    const result = this.firewall.banSystem.banUserComprehensive(target, profile.ip, fp, reason, durationMs, issuerId);
    this.firewall.logger.info('admin_ban', { issuerId, target, durationMs, reason, permanent: !durationMs });
    return { success: true, message: `Banned ${target}${durationMs ? ` for ${formatDuration(durationMs)}` : ' permanently'}. Reason: ${reason}`, broadcastToMods: true };
  }

  _cmdUnban(issuerId, args, profile) {
    if (args.length < 1) return { success: false, error: 'Usage: /unban <username>', visibleToUser: true };
    const target = args[0];
    this.firewall.banSystem.unbanAccount(target);
    this.firewall.logger.info('admin_unban', { issuerId, target });
    return { success: true, message: `Unbanned ${target}.`, broadcastToMods: true };
  }

  _cmdWarn(issuerId, args, profile) {
    if (args.length < 2) return { success: false, error: 'Usage: /warn <username> <message>', visibleToUser: true };
    const target = args[0];
    const warnMessage = args.slice(1).join(' ');
    // In production, this would send a warning to the target user
    this.firewall.logger.info('admin_warn', { issuerId, target, message: warnMessage });
    return { success: true, message: `Warned ${target}: "${warnMessage}"`, targetNotification: { userId: target, type: 'warning', message: warnMessage, from: issuerId } };
  }

  _cmdKick(issuerId, args, profile) {
    if (args.length < 1) return { success: false, error: 'Usage: /kick <username> [reason]', visibleToUser: true };
    const target = args[0];
    const reason = args.slice(1).join(' ') || 'Kicked by moderator';
    this.firewall.logger.info('admin_kick', { issuerId, target, reason });
    return { success: true, message: `Kicked ${target}. Reason: ${reason}`, kickTarget: target, reason, broadcastToRoom: true };
  }

  _cmdAnnounce(issuerId, args, profile) {
    if (args.length < 1) return { success: false, error: 'Usage: /announce <message>', visibleToUser: true };
    const msg = args.join(' ');
    const timeSinceLast = now() - this._lastAnnounceTime;
    if (timeSinceLast < MOD_CONFIG.ADMIN.announceCooldownMs) {
      return { success: false, error: `Please wait ${Math.ceil((MOD_CONFIG.ADMIN.announceCooldownMs - timeSinceLast) / 1000)}s before next announcement.`, visibleToUser: true };
    }
    this._lastAnnounceTime = now();
    this.firewall.logger.info('admin_announce', { issuerId, message: msg });
    return { success: true, message: `Announcement sent.`, globalAnnouncement: msg, from: issuerId };
  }

  _cmdBroadcast(issuerId, args, profile) {
    if (!profile.admin) return { success: false, error: 'Admin only.', visibleToUser: true };
    if (args.length < 1) return { success: false, error: 'Usage: /broadcast <message>', visibleToUser: true };
    const msg = args.join(' ');
    this.firewall.logger.info('admin_broadcast', { issuerId, message: msg });
    return { success: true, message: `Broadcast sent to all servers.`, globalBroadcast: msg, from: issuerId };
  }

  _cmdClearChat(issuerId, args, profile) {
    this.firewall.logger.info('admin_clearchat', { issuerId });
    return { success: true, message: 'Chat cleared.', clearChat: true };
  }

  _cmdSlowMode(issuerId, args, profile) {
    if (args.length < 1) return { success: false, error: 'Usage: /slowmode <delay_seconds|off>', visibleToUser: true };
    const delayStr = args[0].toLowerCase();
    if (delayStr === 'off') {
      return { success: true, message: 'Slow mode disabled.', slowModeDelay: 0 };
    }
    const delayMs = parseInt(delayStr, 10) * 1000;
    if (isNaN(delayMs) || delayMs < MOD_CONFIG.SLOW_MODE.minDelayMs || delayMs > MOD_CONFIG.SLOW_MODE.maxDelayMs) {
      return { success: false, error: `Delay must be between ${MOD_CONFIG.SLOW_MODE.minDelayMs / 1000}s and ${MOD_CONFIG.SLOW_MODE.maxDelayMs / 1000}s.`, visibleToUser: true };
    }
    this.firewall.logger.info('admin_slowmode', { issuerId, delayMs });
    return { success: true, message: `Slow mode enabled: ${delayMs / 1000}s between messages.`, slowModeDelay: delayMs };
  }

  _cmdLockRoom(issuerId, args, profile) {
    this.firewall.logger.info('admin_lockroom', { issuerId });
    return { success: true, message: 'Room locked. New players cannot join.', roomLocked: true };
  }

  _cmdUnlockRoom(issuerId, args, profile) {
    this.firewall.logger.info('admin_unlockroom', { issuerId });
    return { success: true, message: 'Room unlocked.', roomLocked: false };
  }

  _cmdLogs(issuerId, args, profile) {
    if (!profile.admin && !profile.moderator) return { success: false, error: 'Access denied.' };
    const limit = args[0] ? parseInt(args[0], 10) : 50;
    const logs = this.firewall.logger.getLogs({ limit: clamp(limit, 1, 200) });
    return { success: true, message: `Retrieved ${logs.length} log entries.`, logs, private: true };
  }

  _cmdReports(issuerId, args, profile) {
    if (!profile.admin && !profile.moderator) return { success: false, error: 'Access denied.' };
    const status = args[0] || 'pending';
    const reports = this.firewall.reportSystem.getReports({ status });
    return { success: true, message: `Retrieved ${reports.length} reports.`, reports, private: true };
  }

  _cmdModChat(issuerId, args, profile) {
    if (!profile.moderator && !profile.admin) return { success: false, error: 'Access denied.' };
    const msg = args.join(' ');
    return { success: true, message: `Mod chat: ${msg}`, modChatMessage: msg, from: issuerId };
  }

  _parseDuration(str) {
    if (!str) return null;
    const match = str.match(/^(\d+)([smhd])$/i);
    if (!match) return null;
    const val = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
    return val * (multipliers[unit] || 0);
  }

  _logCommand(userId, command, args) {
    this._commandLog.push({ userId, command, args, timestamp: now() });
    if (this._commandLog.length > 1000) this._commandLog.shift();
  }

  getCommandHistory(limit = 100) {
    return this._commandLog.slice(-limit);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODERATOR PANEL
// ─────────────────────────────────────────────────────────────────────────────

class ModeratorPanel {
  constructor(firewall, adminSystem) {
    this.firewall = firewall;
    this.adminSystem = adminSystem;
    this._isOpen = false;
    this._listeners = [];
    this._refreshInterval = null;
    this._currentView = 'dashboard';
  }

  open() {
    this._isOpen = true;
    this._startRefresh();
    return { success: true, view: this._currentView };
  }

  close() {
    this._isOpen = false;
    this._stopRefresh();
    return { success: true };
  }

  isOpen() { return this._isOpen; }

  getDashboard() {
    return {
      pendingReports: this.firewall.reportSystem.getPendingCount(),
      activeMutes: this.firewall.muteSystem.getActiveMutes().length,
      bannedAccounts: this.firewall.banSystem.getAllBans().accounts.length,
      bannedIPs: this.firewall.banSystem.getAllBans().ips.length,
      suspiciousIPs: this.firewall.accountProtection.getSuspiciousIPs().length,
      recentViolations: this.firewall.logger.getLogs({ level: 'warn', limit: 10 }),
      reportStats: this.firewall.reportSystem.getStats()
    };
  }

  getReports(filters = {}) {
    return this.firewall.reportSystem.getReports(filters);
  }

  assignReport(reportId, moderatorId) {
    return this.firewall.reportSystem.assignReport(reportId, moderatorId);
  }

  resolveReport(reportId, resolution, moderatorId) {
    return this.firewall.reportSystem.resolveReport(reportId, resolution, moderatorId);
  }

  dismissReport(reportId, moderatorId) {
    return this.firewall.reportSystem.dismissReport(reportId, moderatorId);
  }

  getLogs(filters = {}) {
    return this.firewall.logger.getLogs(filters);
  }

  getBannedUsers() {
    return this.firewall.banSystem.getAllBans();
  }

  getMutedUsers() {
    return this.firewall.muteSystem.getActiveMutes();
  }

  broadcastAnnouncement(message, from) {
    this.firewall.logger.info('mod_panel_broadcast', { from, message });
    return { success: true, message, timestamp: now() };
  }

  _startRefresh() {
    if (this._refreshInterval) return;
    this._refreshInterval = setInterval(() => {
      if (this._isOpen && this._listeners.length > 0) {
        const data = this.getDashboard();
        for (const cb of this._listeners) {
          try { cb('refresh', data); } catch (e) { /* ignore */ }
        }
      }
    }, MOD_CONFIG.MODERATOR_PANEL.refreshMs);
  }

  _stopRefresh() {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }
  }

  onUpdate(callback) {
    this._listeners.push(callback);
  }

  offUpdate(callback) {
    const idx = this._listeners.indexOf(callback);
    if (idx !== -1) this._listeners.splice(idx, 1);
  }

  destroy() { this._stopRefresh(); this._listeners = []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// APPEAL SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

class AppealSystem {
  constructor(firewall) {
    this.firewall = firewall;
    this._appeals = new Map();
    this._loadAppeals();
  }

  _loadAppeals() {
    if (!this.firewall) return;
    const stored = this.firewall.storage.get('appeals', []);
    for (const appeal of stored) {
      this._appeals.set(appeal.id, appeal);
    }
  }

  _persistAppeals() {
    if (!this.firewall) return;
    this.firewall.storage.set('appeals', Array.from(this._appeals.values()));
  }

  submitAppeal(userId, banReason, appealText, contactEmail = '') {
    if (!appealText || appealText.length < 20) {
      return { success: false, error: 'Appeal must be at least 20 characters.' };
    }
    if (appealText.length > MOD_CONFIG.APPEAL.maxLength) {
      return { success: false, error: `Appeal too long (max ${MOD_CONFIG.APPEAL.maxLength} chars).` };
    }
    const userAppeals = this.getUserAppeals(userId);
    const activeAppeals = userAppeals.filter(a => a.status === 'pending' || a.status === 'under_review');
    if (activeAppeals.length >= MOD_CONFIG.APPEAL.maxActiveAppeals) {
      return { success: false, error: `Maximum ${MOD_CONFIG.APPEAL.maxActiveAppeals} active appeals allowed.` };
    }
    const lastAppeal = userAppeals[userAppeals.length - 1];
    if (lastAppeal && now() - lastAppeal.submittedAt < MOD_CONFIG.APPEAL.cooldownMs) {
      const remaining = MOD_CONFIG.APPEAL.cooldownMs - (now() - lastAppeal.submittedAt);
      return { success: false, error: `Please wait ${formatDuration(remaining)} before submitting another appeal.` };
    }
    const appealId = `APL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const appeal = {
      id: appealId,
      userId,
      banReason,
      appealText: appealText.slice(0, MOD_CONFIG.APPEAL.maxLength),
      contactEmail: contactEmail.slice(0, 255),
      status: 'pending',
      submittedAt: now(),
      reviewedAt: null,
      reviewedBy: null,
      resolution: null,
      moderatorNotes: ''
    };
    this._appeals.set(appealId, appeal);
    this._persistAppeals();
    if (this.firewall) {
      this.firewall.logger.info('appeal_submitted', { userId, appealId, banReason });
    }
    return { success: true, appealId };
  }

  getUserAppeals(userId) {
    return Array.from(this._appeals.values())
      .filter(a => a.userId === userId)
      .sort((a, b) => b.submittedAt - a.submittedAt);
  }

  getAllAppeals(filters = {}) {
    let appeals = Array.from(this._appeals.values());
    if (filters.status) appeals = appeals.filter(a => a.status === filters.status);
    if (filters.userId) appeals = appeals.filter(a => a.userId === filters.userId);
    if (filters.since) appeals = appeals.filter(a => a.submittedAt >= filters.since);
    return appeals.sort((a, b) => b.submittedAt - a.submittedAt);
  }

  reviewAppeal(appealId, moderatorId, resolution, notes = '') {
    const appeal = this._appeals.get(appealId);
    if (!appeal) return { success: false, error: 'Appeal not found.' };
    appeal.status = resolution === 'approved' ? 'approved' : 'rejected';
    appeal.reviewedAt = now();
    appeal.reviewedBy = moderatorId;
    appeal.resolution = resolution;
    appeal.moderatorNotes = notes.slice(0, 1000);
    this._appeals.set(appealId, appeal);
    this._persistAppeals();
    if (this.firewall) {
      this.firewall.logger.info('appeal_reviewed', { appealId, moderatorId, resolution });
      if (resolution === 'approved') {
        this.firewall.banSystem.unbanAccount(appeal.userId);
      }
    }
    return { success: true, appeal };
  }

  canAppeal(userId) {
    const userAppeals = this.getUserAppeals(userId);
    const lastAppeal = userAppeals[userAppeals.length - 1];
    if (!lastAppeal) return { canAppeal: true };
    if (now() - lastAppeal.submittedAt < MOD_CONFIG.APPEAL.cooldownMs) {
      return { canAppeal: false, remainingMs: MOD_CONFIG.APPEAL.cooldownMs - (now() - lastAppeal.submittedAt) };
    }
    const active = userAppeals.filter(a => a.status === 'pending' || a.status === 'under_review');
    if (active.length >= MOD_CONFIG.APPEAL.maxActiveAppeals) {
      return { canAppeal: false, reason: 'Maximum active appeals reached.' };
    }
    return { canAppeal: true };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PARENTAL CONTROLS
// ─────────────────────────────────────────────────────────────────────────────

class ParentalControls {
  constructor(firewall) {
    this.firewall = firewall;
    this._settings = new Map();
    this._pinAttempts = new Map();
    this._loadSettings();
  }

  _getStorageKey(userId) { return `parental_${userId}`; }

  _loadSettings() {
    if (!this.firewall) return;
    const keys = this.firewall.storage.keys().filter(k => k.startsWith('parental_'));
    for (const key of keys) {
      const userId = key.replace('parental_', '');
      const data = this.firewall.storage.get(key);
      if (data) this._settings.set(userId, data);
    }
  }

  _saveSettings(userId) {
    if (!this.firewall) return;
    const settings = this._settings.get(userId);
    if (settings) this.firewall.storage.set(this._getStorageKey(userId), settings);
  }

  setupPin(userId, pin) {
    if (!pin || pin.length < 4 || pin.length > 12) {
      return { success: false, error: 'PIN must be 4-12 characters.' };
    }
    const settings = this._getOrCreateSettings(userId);
    settings.pinHash = hashPin(pin);
    settings.pinSetAt = now();
    this._settings.set(userId, settings);
    this._saveSettings(userId);
    return { success: true };
  }

  verifyPin(userId, pin) {
    const settings = this._settings.get(userId);
    if (!settings || !settings.pinHash) return { valid: false, error: 'PIN not set up.' };
    const attempts = this._pinAttempts.get(userId) || { count: 0, lockedUntil: 0 };
    if (attempts.lockedUntil > now()) {
      return { valid: false, error: `Too many attempts. Locked for ${formatDuration(attempts.lockedUntil - now())}.` };
    }
    const hash = hashPin(pin);
    if (hash === settings.pinHash) {
      this._pinAttempts.delete(userId);
      return { valid: true };
    }
    attempts.count++;
    if (attempts.count >= MOD_CONFIG.PARENTAL.maxPinAttempts) {
      attempts.lockedUntil = now() + MOD_CONFIG.PARENTAL.pinLockoutMs;
    }
    this._pinAttempts.set(userId, attempts);
    const remaining = MOD_CONFIG.PARENTAL.maxPinAttempts - attempts.count;
    return { valid: false, error: `Invalid PIN. ${remaining} attempts remaining.` };
  }

  changePin(userId, oldPin, newPin) {
    const verify = this.verifyPin(userId, oldPin);
    if (!verify.valid) return { success: false, error: verify.error };
    return this.setupPin(userId, newPin);
  }

  _getOrCreateSettings(userId) {
    if (!this._settings.has(userId)) {
      this._settings.set(userId, {
        chatEnabled: MOD_CONFIG.PARENTAL.defaultChatEnabled,
        tradingEnabled: MOD_CONFIG.PARENTAL.defaultTradingEnabled,
        playtimeLimitMs: MOD_CONFIG.PARENTAL.defaultPlaytimeLimitMs,
        dailyPlaytimeMs: 0,
        lastPlaytimeReset: now(),
        activityLog: [],
        pinHash: null,
        pinSetAt: null,
        createdAt: now()
      });
    }
    return this._settings.get(userId);
  }

  setChatEnabled(userId, pin, enabled) {
    const verify = this.verifyPin(userId, pin);
    if (!verify.valid) return { success: false, error: verify.error };
    const settings = this._getOrCreateSettings(userId);
    settings.chatEnabled = enabled;
    this._saveSettings(userId);
    this._logActivity(userId, 'chat_toggle', { enabled });
    return { success: true, chatEnabled: enabled };
  }

  isChatEnabled(userId) {
    const settings = this._settings.get(userId);
    return settings ? settings.chatEnabled : MOD_CONFIG.PARENTAL.defaultChatEnabled;
  }

  setTradingEnabled(userId, pin, enabled) {
    const verify = this.verifyPin(userId, pin);
    if (!verify.valid) return { success: false, error: verify.error };
    const settings = this._getOrCreateSettings(userId);
    settings.tradingEnabled = enabled;
    this._saveSettings(userId);
    this._logActivity(userId, 'trading_toggle', { enabled });
    return { success: true, tradingEnabled: enabled };
  }

  isTradingEnabled(userId) {
    const settings = this._settings.get(userId);
    return settings ? settings.tradingEnabled : MOD_CONFIG.PARENTAL.defaultTradingEnabled;
  }

  setPlaytimeLimit(userId, pin, limitMs) {
    const verify = this.verifyPin(userId, pin);
    if (!verify.valid) return { success: false, error: verify.error };
    const settings = this._getOrCreateSettings(userId);
    settings.playtimeLimitMs = clamp(limitMs, 30 * 60_000, 8 * 60 * 60_000);
    this._saveSettings(userId);
    return { success: true, playtimeLimitMs: settings.playtimeLimitMs };
  }

  getPlaytimeLimit(userId) {
    const settings = this._settings.get(userId);
    return settings ? settings.playtimeLimitMs : MOD_CONFIG.PARENTAL.defaultPlaytimeLimitMs;
  }

  recordPlaytime(userId, sessionMs) {
    const settings = this._getOrCreateSettings(userId);
    const dayStart = new Date().setHours(0, 0, 0, 0);
    if (settings.lastPlaytimeReset < dayStart) {
      settings.dailyPlaytimeMs = 0;
      settings.lastPlaytimeReset = now();
    }
    settings.dailyPlaytimeMs += sessionMs;
    this._saveSettings(userId);
    const remaining = Math.max(0, settings.playtimeLimitMs - settings.dailyPlaytimeMs);
    return { totalToday: settings.dailyPlaytimeMs, remaining, limitReached: remaining <= 0 };
  }

  isPlaytimeLimitReached(userId) {
    const settings = this._settings.get(userId);
    if (!settings) return false;
    const dayStart = new Date().setHours(0, 0, 0, 0);
    if (settings.lastPlaytimeReset < dayStart) return false;
    return settings.dailyPlaytimeMs >= settings.playtimeLimitMs;
  }

  getActivityLog(userId, pin, limit = 100) {
    const verify = this.verifyPin(userId, pin);
    if (!verify.valid) return { success: false, error: verify.error };
    const settings = this._settings.get(userId);
    if (!settings) return { success: true, activityLog: [] };
    return { success: true, activityLog: settings.activityLog.slice(-limit) };
  }

  _logActivity(userId, action, details = {}) {
    const settings = this._getOrCreateSettings(userId);
    settings.activityLog.push({ action, details, timestamp: now() });
    if (settings.activityLog.length > 500) settings.activityLog.shift();
    this._saveSettings(userId);
  }

  logChatMessage(userId, messageType, content = '') {
    this._logActivity(userId, 'chat_message', { messageType, content: content.slice(0, 200) });
  }

  logTrade(userId, tradePartner, items = []) {
    this._logActivity(userId, 'trade', { tradePartner, itemCount: items.length });
  }

  logLogin(userId, ip) {
    this._logActivity(userId, 'login', { ip: ip ? hashString(ip) : null });
  }

  getSummary(userId, pin) {
    const verify = this.verifyPin(userId, pin);
    if (!verify.valid) return { success: false, error: verify.error };
    const settings = this._getOrCreateSettings(userId);
    const dayStart = new Date().setHours(0, 0, 0, 0);
    if (settings.lastPlaytimeReset < dayStart) {
      settings.dailyPlaytimeMs = 0;
      settings.lastPlaytimeReset = now();
    }
    return {
      success: true,
      summary: {
        chatEnabled: settings.chatEnabled,
        tradingEnabled: settings.tradingEnabled,
        playtimeLimitMs: settings.playtimeLimitMs,
        dailyPlaytimeMs: settings.dailyPlaytimeMs,
        remainingPlaytimeMs: Math.max(0, settings.playtimeLimitMs - settings.dailyPlaytimeMs),
        totalActivityEntries: settings.activityLog.length,
        pinSetAt: settings.pinSetAt,
        lastUpdated: now()
      }
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CHAT MODERATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export class ChatModeration {
  constructor(firewall) {
    this.firewall = firewall || new ContentFirewall();
    this.tracker = new ConversationTracker();
    this.trustedSystem = new TrustedUserSystem(this.firewall);
    this.newUserRestrictions = new NewUserRestrictions(this.firewall);
    this.adminSystem = new AdminCommandSystem(this.firewall, null);
    this.moderatorPanel = new ModeratorPanel(this.firewall, this.adminSystem);
    this.appealSystem = new AppealSystem(this.firewall);
    this.parentalControls = new ParentalControls(this.firewall);
    this._slowModeDelay = 0;
    this._roomLocked = false;
    this._lastMessageTime = new Map();
    this._eventListeners = new Map();
    this.trustedSystem.loadFromStorage();
  }

  /**
   * Scan a message before it is displayed.
   * @param {Object} msg — { id, userId, username, message, timestamp, roomId, profile }
   * @returns {Object} — { allowed, severity, action, reason, censoredMessage, notifications }
   */
  scanMessage(msg) {
    const { userId, username, message, roomId, profile = {}, targetId } = msg;
    const notifications = [];
    const result = {
      allowed: true,
      severity: MOD_CONFIG.SEVERITY.INFO,
      action: 'allow',
      reason: null,
      censoredMessage: message,
      notifications,
      violations: []
    };

    // 1. Parental controls check
    if (!this.parentalControls.isChatEnabled(userId)) {
      result.allowed = false;
      result.severity = MOD_CONFIG.SEVERITY.WARN;
      result.action = 'block';
      result.reason = 'Chat disabled by parental controls.';
      return result;
    }

    // 2. Check if room is locked
    if (this._roomLocked && !profile.moderator && !profile.admin) {
      result.allowed = false;
      result.severity = MOD_CONFIG.SEVERITY.WARN;
      result.action = 'block';
      result.reason = 'Room is currently locked.';
      return result;
    }

    // 3. Check slow mode
    if (this._slowModeDelay > 0 && !profile.moderator && !profile.admin) {
      const lastTime = this._lastMessageTime.get(userId) || 0;
      const elapsed = now() - lastTime;
      if (elapsed < this._slowModeDelay) {
        result.allowed = false;
        result.severity = MOD_CONFIG.SEVERITY.INFO;
        result.action = 'slow_mode';
        result.reason = `Slow mode active. Wait ${Math.ceil((this._slowModeDelay - elapsed) / 1000)}s.`;
        return result;
      }
    }

    // 4. Admin command check
    if (this.adminSystem.isAdminCommand(message)) {
      if (!profile.moderator && !profile.admin) {
        result.allowed = false;
        result.severity = MOD_CONFIG.SEVERITY.WARN;
        result.action = 'block';
        result.reason = 'Admin commands require moderator privileges.';
        return result;
      }
      const cmdResult = this.adminSystem.executeCommand(userId, message, profile);
      result.commandResult = cmdResult;
      result.allowed = false;
      result.severity = MOD_CONFIG.SEVERITY.INFO;
      result.action = 'command';
      result.reason = cmdResult.message || 'Command processed.';
      if (cmdResult.broadcastToMods) {
        notifications.push({ type: 'mod_notification', message: cmdResult.message });
      }
      return result;
    }

    // 5. New user restrictions
    const newUserCheck = this.newUserRestrictions.validateMessage(userId, message, profile);
    if (!newUserCheck.allowed) {
      result.allowed = false;
      result.severity = MOD_CONFIG.SEVERITY.WARN;
      result.action = 'new_user_block';
      result.reason = newUserCheck.reason;
      result.violations.push(...newUserCheck.violations);
      return result;
    }

    // 6. Run through ContentFirewall
    const fwResult = this.firewall.processMessage(userId, message, profile);
    result.censoredMessage = fwResult.censoredMessage;
    result.violations.push(...fwResult.violations);

    if (!fwResult.allowed) {
      result.allowed = false;
      result.reason = fwResult.reason;
      result.action = fwResult.action;
      if (fwResult.severity >= 8) result.severity = MOD_CONFIG.SEVERITY.BAN;
      else if (fwResult.severity >= 5) result.severity = MOD_CONFIG.SEVERITY.MUTE;
      else if (fwResult.severity >= 3) result.severity = MOD_CONFIG.SEVERITY.WARN;
      return result;
    }

    // 7. Contextual analysis: grooming patterns
    if (targetId) {
      const grooming = this.tracker.analyzeGroomingPatterns(userId, targetId);
      if (grooming.risk >= 8) {
        result.severity = MOD_CONFIG.SEVERITY.BAN;
        result.action = 'auto_ban';
        result.reason = 'Grooming pattern detected. Account suspended pending review.';
        result.violations.push({ type: 'grooming', risk: grooming.risk, flags: grooming.flags });
        this.firewall.banSystem.banAccount(userId, `Grooming pattern detected (risk ${grooming.risk}). Flags: ${grooming.flags.join(', ')}`, null, 'auto');
        this.firewall.reportSystem.submitReport({
          reporterId: 'system', targetId: userId, category: 'grooming',
          description: `Auto-detected grooming pattern. Risk score: ${grooming.risk}. Flags: ${grooming.flags.join(', ')}`,
          evidence: { grooming }, chatLog: this.tracker.getConversation(userId, targetId).map(m => m.message)
        });
        result.allowed = false;
        return result;
      } else if (grooming.risk >= 4) {
        result.severity = MOD_CONFIG.SEVERITY.WARN;
        result.violations.push({ type: 'grooming_risk', risk: grooming.risk, flags: grooming.flags });
        notifications.push({ type: 'automated_warning', message: 'Be careful sharing personal information online.' });
      }
    }

    // 8. Contextual analysis: repetitive targeting
    const targeting = this.tracker.analyzeRepetitiveTargeting(userId);
    if (targeting.isTargeting) {
      result.violations.push({ type: 'targeting', targetId: targeting.targetId, messageCount: targeting.messageCount });
      if (targeting.messageCount >= 5) {
        result.severity = MOD_CONFIG.SEVERITY.MUTE;
        result.action = 'auto_mute';
        result.reason = 'Repetitive targeting detected.';
        this.firewall.muteSystem.autoMuteForViolation(userId, 'targeting', 6);
        result.allowed = false;
        return result;
      }
    }

    // 9. Trusted user leniency
    const leniency = this.trustedSystem.getLeniency(userId, profile);
    if (leniency < 1.0 && result.violations.length > 0) {
      // Trusted users get warnings instead of mutes for minor issues
      const hasSevere = result.violations.some(v => v.type === 'profanity' && v.severity >= 8);
      if (!hasSevere && result.severity.level <= MOD_CONFIG.SEVERITY.MUTE.level) {
        result.severity = MOD_CONFIG.SEVERITY.WARN;
        result.action = 'warn';
      }
    }

    // 10. Record conversation
    if (targetId) {
      this.tracker.recordMessage(userId, targetId, message);
    }
    this._lastMessageTime.set(userId, now());

    // 11. Record violations for trusted user tracking
    if (result.violations.length > 0 && result.severity.level >= MOD_CONFIG.SEVERITY.WARN.level) {
      this.trustedSystem.recordViolation(userId, result.severity.level);
    }

    // 12. Log parental activity
    this.parentalControls.logChatMessage(userId, result.allowed ? 'sent' : 'blocked', message);

    return result;
  }

  /**
   * Scan a trade request before processing.
   */
  scanTrade(userId, targetId, profile = {}) {
    // Parental controls
    if (!this.parentalControls.isTradingEnabled(userId)) {
      return { allowed: false, reason: 'Trading disabled by parental controls.' };
    }
    // New user restrictions
    const tradeCheck = this.newUserRestrictions.canTrade(profile);
    if (!tradeCheck.allowed) {
      return { allowed: false, reason: tradeCheck.reason };
    }
    // Firewall trade check
    return this.firewall.processTradeRequest(userId, targetId, profile);
  }

  /**
   * Handle a player action (click, move, interact) for rate limiting.
   */
  scanAction(userId, actionType, profile = {}) {
    return this.firewall.processAction(userId, actionType, profile);
  }

  // ── Admin Command Helpers ──

  executeAdminCommand(userId, message, profile) {
    return this.adminSystem.executeCommand(userId, message, profile);
  }

  getAdminCommandHistory(limit = 100) {
    return this.adminSystem.getCommandHistory(limit);
  }

  // ── Moderator Panel Helpers ──

  openModeratorPanel() { return this.moderatorPanel.open(); }
  closeModeratorPanel() { return this.moderatorPanel.close(); }
  getModeratorDashboard() { return this.moderatorPanel.getDashboard(); }
  getModeratorReports(filters) { return this.moderatorPanel.getReports(filters); }
  assignModeratorReport(reportId, moderatorId) { return this.moderatorPanel.assignReport(reportId, moderatorId); }
  resolveModeratorReport(reportId, resolution, moderatorId) { return this.moderatorPanel.resolveReport(reportId, resolution, moderatorId); }
  dismissModeratorReport(reportId, moderatorId) { return this.moderatorPanel.dismissReport(reportId, moderatorId); }
  getModeratorLogs(filters) { return this.moderatorPanel.getLogs(filters); }
  getBannedUserList() { return this.moderatorPanel.getBannedUsers(); }
  getMutedUserList() { return this.moderatorPanel.getMutedUsers(); }

  // ── Appeal System Helpers ──

  submitAppeal(userId, banReason, appealText, contactEmail) {
    return this.appealSystem.submitAppeal(userId, banReason, appealText, contactEmail);
  }

  getUserAppeals(userId) {
    return this.appealSystem.getUserAppeals(userId);
  }

  getAllAppeals(filters) {
    return this.appealSystem.getAllAppeals(filters);
  }

  reviewAppeal(appealId, moderatorId, resolution, notes) {
    return this.appealSystem.reviewAppeal(appealId, moderatorId, resolution, notes);
  }

  canUserAppeal(userId) {
    return this.appealSystem.canAppeal(userId);
  }

  // ── Parental Controls Helpers ──

  setupParentalPin(userId, pin) {
    return this.parentalControls.setupPin(userId, pin);
  }

  verifyParentalPin(userId, pin) {
    return this.parentalControls.verifyPin(userId, pin);
  }

  changeParentalPin(userId, oldPin, newPin) {
    return this.parentalControls.changePin(userId, oldPin, newPin);
  }

  setParentalChat(userId, pin, enabled) {
    return this.parentalControls.setChatEnabled(userId, pin, enabled);
  }

  isParentalChatEnabled(userId) {
    return this.parentalControls.isChatEnabled(userId);
  }

  setParentalTrading(userId, pin, enabled) {
    return this.parentalControls.setTradingEnabled(userId, pin, enabled);
  }

  isParentalTradingEnabled(userId) {
    return this.parentalControls.isTradingEnabled(userId);
  }

  setParentalPlaytimeLimit(userId, pin, limitMs) {
    return this.parentalControls.setPlaytimeLimit(userId, pin, limitMs);
  }

  getParentalPlaytimeLimit(userId) {
    return this.parentalControls.getPlaytimeLimit(userId);
  }

  recordPlaytime(userId, sessionMs) {
    return this.parentalControls.recordPlaytime(userId, sessionMs);
  }

  isPlaytimeLimitReached(userId) {
    return this.parentalControls.isPlaytimeLimitReached(userId);
  }

  getParentalActivityLog(userId, pin, limit) {
    return this.parentalControls.getActivityLog(userId, pin, limit);
  }

  getParentalSummary(userId, pin) {
    return this.parentalControls.getSummary(userId, pin);
  }

  // ── Utility ──

  setSlowMode(delayMs) {
    this._slowModeDelay = clamp(delayMs, 0, MOD_CONFIG.SLOW_MODE.maxDelayMs);
    return { success: true, delayMs: this._slowModeDelay };
  }

  getSlowMode() { return this._slowModeDelay; }

  setRoomLocked(locked) {
    this._roomLocked = locked;
    return { success: true, locked: this._roomLocked };
  }

  isRoomLocked() { return this._roomLocked; }

  getTrustedStatus(userId, profile) {
    return {
      isTrusted: this.trustedSystem.isTrusted(userId, profile),
      violationCount: this.trustedSystem.getViolationCount(userId),
      leniency: this.trustedSystem.getLeniency(userId, profile)
    };
  }

  getNewUserStatus(profile) {
    return {
      isNewUser: this.newUserRestrictions.isNewUser(profile),
      maxMessageLength: MOD_CONFIG.NEW_USER.maxMessageLength,
      allowsURLs: MOD_CONFIG.NEW_USER.allowURLs,
      allowsTrading: MOD_CONFIG.NEW_USER.allowTrading
    };
  }

  destroy() {
    this.tracker.destroy();
    this.moderatorPanel.destroy();
    this._eventListeners.clear();
    this._lastMessageTime.clear();
  }
}

export default ChatModeration;
