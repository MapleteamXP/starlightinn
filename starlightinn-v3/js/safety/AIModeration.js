/**
 * @file AIModeration.js
 * @description AI-assisted chat moderation system for Starlight Inn v3.5.
 * Provides client-side heuristic-based sentiment analysis, contextual behavior
 * pattern detection, violation classification, and graduated action enforcement.
 *
 * All analysis is performed locally using keyword matching, regex patterns,
 * and heuristic scoring — no external ML API calls are made. The system
 * maintains per-player reputation scores, moderation logs, and supports
 * player appeals with false-positive protection.
 *
 * @author Starlight Inn Team
 * @version 3.5.0
 * @since 2024-12-01
 */

// ============================================================
// CONSTANTS
// ============================================================

/** @constant {string} REPUTATION_KEY - localStorage key prefix for player reputation data */
const REPUTATION_KEY = 'starlight_moderation_reputation';

/** @constant {string} MODERATION_LOG_KEY - localStorage key for moderation action log */
const MODERATION_LOG_KEY = 'starlight_moderation_log';

/** @constant {number} CONTEXT_WINDOW_SIZE - Number of recent messages to retain per player for context analysis */
const CONTEXT_WINDOW_SIZE = 5;

/** @constant {number} MAX_LOG_ENTRIES - Maximum moderation log entries retained in memory and storage */
const MAX_LOG_ENTRIES = 100;

/** @constant {number} MUTE_DURATION_MS - Duration of a mute action in milliseconds (10 minutes) */
const MUTE_DURATION_MS = 600000;

/** @constant {number} REPUTATION_MAX - Maximum player reputation score */
const REPUTATION_MAX = 100;

/** @constant {number} REPUTATION_MIN - Minimum player reputation score */
const REPUTATION_MIN = 0;

/** @constant {number} REPUTATION_STARTING - Default reputation for new players */
const REPUTATION_STARTING = 70;

/** @constant {number} NEW_ACCOUNT_THRESHOLD_MS - Account age below which stricter thresholds apply (1 day) */
const NEW_ACCOUNT_THRESHOLD_MS = 86400000;

/** @constant {number} REPUTATION_HIGH - Threshold for high-reputation lenient treatment */
const REPUTATION_HIGH = 80;

/** @constant {number} REPUTATION_LOW - Threshold for low-reputation strict treatment */
const REPUTATION_LOW = 30;

/** @constant {number} THRESHOLD_NO_ACTION - Below this score, no action is taken */
const THRESHOLD_NO_ACTION = 0.3;

/** @constant {number} THRESHOLD_SOFT_WARNING - Score range for soft warning action */
const THRESHOLD_SOFT_WARNING = 0.6;

/** @constant {number} THRESHOLD_MUTE - Score range for mute action */
const THRESHOLD_MUTE = 0.8;

/** @constant {number} LENIENCY_HIGH_REPUTATION - Score reduction for high-reputation players */
const LENIENCY_HIGH_REPUTATION = 0.08;

/** @constant {number} STRICTNESS_NEW_ACCOUNT - Score increase for new accounts */
const STRICTNESS_NEW_ACCOUNT = 0.12;

/** @constant {number} REPUTATION_GOOD_BEHAVIOR_BONUS - Reputation gain per clean message */
const REPUTATION_GOOD_BEHAVIOR_BONUS = 0.05;

/** @constant {number} REPUTATION_VIOLATION_PENALTY - Reputation loss per violation */
const REPUTATION_VIOLATION_PENALTY = 5;

// ============================================================
// VIOLATION TYPE ENUM
// ============================================================

/**
 * @constant {Object} VIOLATION_TYPES
 * @description Enumerated violation types with their display metadata.
 */
const VIOLATION_TYPES = {
  HATE: { id: 'HATE', label: 'Hate Speech', severityWeight: 1.0 },
  HARASSMENT: { id: 'HARASSMENT', label: 'Harassment', severityWeight: 0.9 },
  SPAM: { id: 'SPAM', label: 'Spam', severityWeight: 0.6 },
  SCAM: { id: 'SCAM', label: 'Scam / Fraud', severityWeight: 0.8 },
  SEXUAL: { id: 'SEXUAL', label: 'Sexual Content', severityWeight: 1.0 },
  PERSONAL_INFO: { id: 'PERSONAL_INFO', label: 'Personal Information', severityWeight: 0.85 },
  GROOMING: { id: 'GROOMING', label: 'Grooming', severityWeight: 1.0 },
};

// ============================================================
// MODERATION ACTION ENUM
// ============================================================

/**
 * @constant {Object} ACTIONS
 * @description Possible moderation actions in order of severity.
 */
const ACTIONS = {
  NONE: 'NONE',
  SOFT_WARNING: 'SOFT_WARNING',
  MUTE: 'MUTE',
  AUTO_REPORT: 'AUTO_REPORT',
};

// ============================================================
// KEYWORD DATABASE
// ============================================================

/**
 * @constant {Object} KEYWORD_DATABASE
 * @description Categorized keyword lists for heuristic detection.
 * Each category maps to an array of [keyword, weight] tuples where
 * weight (0-1) indicates severity contribution.
 */
const KEYWORD_DATABASE = {
  hate: [
    ['hate', 0.6], ['kill', 0.7], ['die', 0.5], ['stupid', 0.4],
    ['idiot', 0.5], ['dumb', 0.4], ['loser', 0.5], ['trash', 0.45],
    ['worthless', 0.6], ['garbage', 0.4], ['noob', 0.3], ['suck', 0.4],
    ['worst', 0.35], ['terrible', 0.3], ['awful', 0.3],
  ],
  harassment: [
    ['ugly', 0.5], ['fat', 0.5], ['annoying', 0.4], ['shut up', 0.5],
    ['go away', 0.4], ['nobody likes', 0.6], ['leave me alone', 0.35],
    ['get lost', 0.45], ['bother', 0.35], ['bully', 0.7],
  ],
  spam: [
    ['http', 0.3], ['www.', 0.3], ['.com', 0.3], ['free gold', 0.8],
    ['click here', 0.7], ['visit my', 0.6], ['buy now', 0.6],
    ['limited time', 0.4], ['@@@', 0.5], ['!!!', 0.2],
    ['caps_lock_pattern', 0.3], ['repeated_letter_pattern', 0.25],
  ],
  scam: [
    ['free', 0.3], ['hack', 0.7], ['cheat', 0.6], ['generator', 0.6],
    ['giveaway', 0.5], ['promo code', 0.5], ['double your', 0.7],
    ['send password', 0.9], ['account verify', 0.8], ['claim prize', 0.6],
  ],
  sexual: [
    ['sexy', 0.6], ['hot', 0.4], ['date me', 0.5], ['boyfriend', 0.3],
    ['girlfriend', 0.3], ['age', 0.2], ['asl', 0.7], ['where live', 0.4],
    ['private', 0.3], ['pics', 0.6], ['meet up', 0.6],
  ],
  personalInfo: [
    ['phone', 0.5], ['address', 0.6], ['email', 0.5], ['real name', 0.5],
    ['where do you', 0.4], ['how old', 0.4], ['school', 0.3],
    ['facebook', 0.5], ['instagram', 0.5], ['discord', 0.4],
    ['snapchat', 0.5], ['whatsapp', 0.5],
  ],
  grooming: [
    ['dont tell', 0.7], ['secret', 0.4], ['between us', 0.5],
    ['our little', 0.6], ['special friend', 0.5], ['older', 0.3],
    ['mature', 0.4], ['experienced', 0.35], ['trust me', 0.4],
  ],
};

// ============================================================
// SAFETY WHITELIST
// ============================================================

/**
 * @constant {Set<string>} SAFETY_WHITELIST
 * @description Words and short phrases that are always safe and should
 * never trigger moderation, even if they contain substrings matching patterns.
 */
const SAFETY_WHITELIST = new Set([
  'hello', 'hi', 'hey', 'friend', 'trade', 'yes', 'no', 'thanks', 'thank',
  'please', 'ok', 'okay', 'cool', 'nice', 'good', 'great', 'awesome',
  'welcome', 'bye', 'goodbye', 'later', 'see you', 'lol', 'haha',
  'sure', 'yep', 'nope', 'maybe', 'sorry', 'oops', 'wow', 'yay',
  'happy', 'fun', 'play', 'game', 'inn', 'starlight', 'room', 'house',
  'decor', 'furniture', 'couch', 'chair', 'table', 'lamp', 'rug',
  'silver', 'gold', 'buy', 'sell', 'offer', 'deal', 'fair',
  'hello!', 'hi!', 'hey!', 'thanks!', 'ty', 'tyvm', 'np', 'gg',
  'gift', 'party', 'event', 'season', 'help', 'how', 'what', 'where',
  'when', 'who', 'why', 'because', 'and', 'but', 'or', 'if',
]);

// ============================================================
// GREETING PATTERNS
// ============================================================

/**
 * @constant {RegExp} SINGLE_WORD_GREETING
 * @description Pattern matching single-word greetings that should never be flagged.
 */
const SINGLE_WORD_GREETING = /^(hi|hey|hello|yo|sup|hiya|howdy|greetings|salutations)$/i;

// ============================================================
// PATTERN REGEX
// ============================================================

/**
 * @constant {Object} PATTERNS
 * @description Compiled regex patterns for heuristic spam and abuse detection.
 */
const PATTERNS = {
  /** Detects excessive repeated characters (e.g., "aaa", "!!!!") */
  repeatedChars: /(.)\1{4,}/,

  /** Detects ALL CAPS words of 3+ characters */
  allCaps: /\b[A-Z]{3,}\b/,

  /** Detects excessive use of multiple exclamation marks */
  excessivePunctuation: /[!?]{3,}/,

  /** Detects potential URL patterns */
  urlLike: /(https?:\/\/|www\.|\.[a-z]{2,}\/|\.[a-z]{2,}$)/i,

  /** Detects excessive numbers (common in scam/spam) */
  excessiveNumbers: /\d{8,}/,

  /** Detects repeated words (e.g., "hello hello hello") */
  repeatedWords: /\b(\w+)\b\s+\b\1\b\s+\b\1\b/i,

  /** Detects excessive emoji usage */
  excessiveEmoji: /[\u{1F300}-\u{1F9FF}]{5,}/u,

  /** Detects excessive whitespace (potential formatting trick) */
  excessiveWhitespace: /\s{5,}/,
};

// ============================================================
// AI MODERATION CLASS
// ============================================================

/**
 * @class AIModeration
 * @classdesc AI-assisted chat moderation system using client-side heuristic analysis.
 * Performs sentiment scoring, contextual behavior analysis, violation classification,
 * and graduated action enforcement with reputation-aware thresholds.
 *
 * @example
 * const mod = new AIModeration();
 * const result = mod.analyzeMessage('hello friend', { playerId: 'p123', accountAgeMs: 86400000 });
 * if (result.action !== 'NONE') {
 *   console.log('Action:', result.action, 'Reason:', result.reason);
 * }
 */
class AIModeration {
  /**
   * @description Creates an instance of AIModeration.
   * Initializes the moderation log, loads reputation data, and sets up
   * the player context message history map.
   */
  constructor() {
    /** @private @type {Array<Object>} - In-memory moderation action log (last MAX_LOG_ENTRIES entries) */
    this._moderationLog = this._loadLog();

    /** @private @type {Object} - Player reputation scores: playerId -> number (0-100) */
    this._reputation = this._loadReputation();

    /** @private @type {Map<string, Array<Object>>} - Per-player recent message history for context analysis */
    this._playerMessageHistory = new Map();

    /** @private @type {Set<string>} - Player IDs currently muted */
    this._mutedPlayers = new Set();

    /** @private @type {Object} - Mute expiry timestamps: playerId -> timestamp */
    this._muteExpiry = {};

    /** @private @type {number} - Running counter for log entry IDs */
    this._logIdCounter = this._moderationLog.length > 0
      ? Math.max(...this._moderationLog.map(e => e.id || 0)) + 1
      : 1;

    /** @private @type {number} - Total messages analyzed this session */
    this._totalMessagesAnalyzed = 0;

    /** @private @type {number} - Total actions taken this session */
    this._totalActionsTaken = 0;

    /** @private @type {?number} - Periodic cleanup interval ID */
    this._cleanupInterval = null;

    // Start periodic cleanup of expired mutes and old history
    this._startCleanupTimer();
  }

  // ============================================================
  // PUBLIC API - Core Analysis
  // ============================================================

  /**
   * @description Performs full heuristic analysis on a chat message.
   * Returns comprehensive scores, detected violation type, severity, and recommended action.
   *
   * @param {string} text - The chat message text to analyze.
   * @param {Object} playerContext - Context about the sending player.
   * @param {string} playerContext.playerId - Unique player identifier.
   * @param {number} [playerContext.accountAgeMs=Infinity] - Account age in milliseconds.
   * @param {string} [playerContext.playerName=''] - Player display name (for logging).
   * @param {number} [playerContext.messageTimestamp=Date.now()] - Message timestamp.
   *
   * @returns {Object} Complete analysis result.
   * @returns {Object} return.scores - Sentiment and behavior scores.
   * @returns {number} return.scores.toxicity - Toxicity score from -1 (friendly) to +1 (toxic).
   * @returns {number} return.scores.aggression - Aggression score from 0 to 1.
   * @returns {number} return.scores.spamLikelihood - Spam likelihood from 0 to 1.
   * @returns {number} return.scores.overall - Overall composite risk score from 0 to 1.
   * @returns {string} return.violation - Detected violation type key or 'NONE'.
   * @returns {number} return.severity - Violation severity level (1-3).
   * @returns {string} return.action - Recommended action from ACTIONS enum.
   * @returns {string} return.reason - Human-readable explanation of the decision.
   * @returns {boolean} return.flagged - Whether the message was flagged.
   */
  analyzeMessage(text, playerContext = {}) {
    const { playerId = 'unknown', accountAgeMs = Infinity, playerName = '', messageTimestamp = Date.now() } = playerContext;

    // ---- Sanity Rules ----
    // Never flag empty messages
    if (!text || text.trim().length === 0) {
      return this._buildResult({ toxicity: -1, aggression: 0, spamLikelihood: 0, overall: 0 }, 'NONE', 0, ACTIONS.NONE, 'Empty message - no action.', false);
    }

    const trimmed = text.trim();

    // Never flag single-word greetings
    if (trimmed.split(/\s+/).length === 1 && SINGLE_WORD_GREETING.test(trimmed)) {
      return this._buildResult({ toxicity: -1, aggression: 0, spamLikelihood: 0, overall: 0 }, 'NONE', 0, ACTIONS.NONE, 'Single-word greeting - whitelisted.', false);
    }

    // Whitelist check: if all words are safe, skip heavy analysis
    const words = trimmed.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const allWordsSafe = words.length > 0 && words.every(w => SAFETY_WHITELIST.has(w));
    if (allWordsSafe && words.length <= 3) {
      return this._buildResult({ toxicity: -1, aggression: 0, spamLikelihood: 0, overall: 0 }, 'NONE', 0, ACTIONS.NONE, 'All words whitelisted - no action.', false);
    }

    // ---- Core Scoring ----
    const toxicityScore = this._calculateToxicity(trimmed);
    const aggressionScore = this._calculateAggression(trimmed);
    const spamScore = this._calculateSpam(trimmed);

    // ---- Contextual Analysis ----
    const contextModifier = this._calculateContextModifier(playerId);

    // ---- Composite Score ----
    // Weighted combination: toxicity (0.35), aggression (0.25), spam (0.4)
    let overallScore = (Math.max(0, toxicityScore) * 0.35) + (aggressionScore * 0.25) + (spamScore * 0.4) + contextModifier;

    // ---- Reputation & Account Age Adjustment ----
    const reputation = this._getReputation(playerId);
    const isNewAccount = accountAgeMs < NEW_ACCOUNT_THRESHOLD_MS;
    const isHighReputation = reputation >= REPUTATION_HIGH;

    if (isHighReputation) {
      overallScore = Math.max(0, overallScore - LENIENCY_HIGH_REPUTATION);
    }
    if (isNewAccount) {
      overallScore = Math.min(1, overallScore + STRICTNESS_NEW_ACCOUNT);
    }

    // Clamp final score
    overallScore = Math.max(0, Math.min(1, overallScore));

    // ---- Violation Detection ----
    const { violation, severity } = this._detectViolation(trimmed, { toxicityScore, aggressionScore, spamScore, overallScore });

    // ---- Action Determination ----
    const action = this._determineAction(overallScore, violation, severity);

    // ---- Build Result ----
    const flagged = action !== ACTIONS.NONE;
    const reason = this._buildReason(action, violation, severity, { isHighReputation, isNewAccount, contextModifier });

    const result = this._buildResult(
      { toxicity: toxicityScore, aggression: aggressionScore, spamLikelihood: spamScore, overall: overallScore },
      violation, severity, action, reason, flagged
    );

    // ---- Post-Processing ----
    // Store message in context window
    this._storeMessage(playerId, trimmed, result.scores, messageTimestamp);

    // Update reputation
    if (flagged) {
      this._adjustReputation(playerId, -REPUTATION_VIOLATION_PENALTY);
      this._totalActionsTaken++;
    } else {
      // Small reputation gain for good behavior
      this._adjustReputation(playerId, REPUTATION_GOOD_BEHAVIOR_BONUS);
    }

    this._totalMessagesAnalyzed++;

    // Log action if not NONE
    if (action !== ACTIONS.NONE) {
      this._logAction({
        playerId,
        playerName,
        message: trimmed,
        action,
        violation,
        severity,
        scores: result.scores,
        reason,
        timestamp: messageTimestamp,
        reputationAfter: this._getReputation(playerId),
      });
    }

    // Apply mutes
    if (action === ACTIONS.MUTE) {
      this._applyMute(playerId);
    }

    return result;
  }

  /**
   * @description Quick-check function that returns true if a message should be flagged.
   * Use this for lightweight pre-screening before full analysis.
   * @param {string} text - The message text to check.
   * @returns {boolean} True if the message should be flagged for review.
   */
  shouldFlag(text) {
    if (!text || text.trim().length === 0) return false;

    const trimmed = text.trim();

    // Fast-pass: single-word greetings are safe
    if (trimmed.split(/\s+/).length === 1 && SINGLE_WORD_GREETING.test(trimmed)) {
      return false;
    }

    // Fast-pass: whitelisted short phrases
    const words = trimmed.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    if (words.length > 0 && words.every(w => SAFETY_WHITELIST.has(w)) && words.length <= 3) {
      return false;
    }

    // Quick heuristic scan
    const toxicityScore = this._calculateToxicity(trimmed);
    const aggressionScore = this._calculateAggression(trimmed);
    const spamScore = this._calculateSpam(trimmed);

    const quickScore = (Math.max(0, toxicityScore) * 0.35) + (aggressionScore * 0.25) + (spamScore * 0.4);

    return quickScore >= THRESHOLD_NO_ACTION;
  }

  // ============================================================
  // PUBLIC API - Player Reputation
  // ============================================================

  /**
   * @description Returns the reputation score for a given player.
   * @param {string} playerId - The player identifier.
   * @returns {number} Reputation score from 0 to 100.
   */
  getReputation(playerId) {
    return this._getReputation(playerId);
  }

  /**
   * @description Sets a player's reputation score manually (for admin/appeal use).
   * @param {string} playerId - The player identifier.
   * @param {number} score - New reputation score (0-100).
   */
  setReputation(playerId, score) {
    const clamped = Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, score));
    this._reputation[playerId] = clamped;
    this._saveReputation();
  }

  /**
   * @description Increments reputation for good behavior (e.g., completing minigames, trading).
   * @param {string} playerId - The player identifier.
   * @param {number} [amount=1] - Amount to increase reputation by.
   */
  rewardGoodBehavior(playerId, amount = 1) {
    this._adjustReputation(playerId, amount);
  }

  // ============================================================
  // PUBLIC API - Moderation Log
  // ============================================================

  /**
   * @description Returns the moderation action log, most recent first.
   * @param {Object} [filters={}] - Optional filters.
   * @param {string} [filters.playerId] - Filter by player ID.
   * @param {string} [filters.action] - Filter by action type.
   * @param {number} [filters.limit=100] - Maximum entries to return.
   * @returns {Array<Object>} Array of moderation log entries.
   */
  getLog(filters = {}) {
    const { playerId, action, limit = MAX_LOG_ENTRIES } = filters;

    let entries = [...this._moderationLog];

    if (playerId) {
      entries = entries.filter(e => e.playerId === playerId);
    }
    if (action) {
      entries = entries.filter(e => e.action === action);
    }

    return entries
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * @description Adds an appeal record for a moderation action.
   * Updates player reputation to be more lenient and logs the appeal.
   * @param {number} logEntryId - The ID of the log entry being appealed.
   * @param {string} playerId - The player making the appeal.
   * @param {string} [reason=''] - Optional appeal reason text.
   * @returns {boolean} True if the appeal was processed successfully.
   */
  appealAction(logEntryId, playerId, reason = '') {
    try {
      const entry = this._moderationLog.find(e => e.id === logEntryId && e.playerId === playerId);
      if (!entry) return false;

      // Mark as appealed
      entry.appealed = true;
      entry.appealReason = reason;
      entry.appealedAt = Date.now();

      // Restore some reputation as goodwill gesture
      this._adjustReputation(playerId, REPUTATION_VIOLATION_PENALTY * 0.5);

      // Log the appeal
      this._logAction({
        playerId,
        playerName: entry.playerName,
        message: `[APPEAL] Log #${logEntryId}: ${reason}`,
        action: 'APPEAL',
        violation: 'NONE',
        severity: 0,
        scores: { toxicity: 0, aggression: 0, spamLikelihood: 0, overall: 0 },
        reason: `Appeal submitted for log #${logEntryId}${reason ? ': ' + reason : ''}`,
        timestamp: Date.now(),
        reputationAfter: this._getReputation(playerId),
        appealedLogId: logEntryId,
      });

      this._saveLog();
      return true;
    } catch (err) {
      console.error('[AIModeration] Appeal processing error:', err);
      return false;
    }
  }

  // ============================================================
  // PUBLIC API - Mute Management
  // ============================================================

  /**
   * @description Checks if a player is currently muted.
   * @param {string} playerId - The player identifier.
   * @returns {boolean} True if the player is currently muted.
   */
  isMuted(playerId) {
    // Check if mute has expired
    if (this._mutedPlayers.has(playerId)) {
      const expiry = this._muteExpiry[playerId] || 0;
      if (Date.now() > expiry) {
        this._mutedPlayers.delete(playerId);
        delete this._muteExpiry[playerId];
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * @description Returns the remaining mute duration for a player in milliseconds.
   * @param {string} playerId - The player identifier.
   * @returns {number} Remaining mute duration in ms, or 0 if not muted.
   */
  getMuteRemaining(playerId) {
    if (!this.isMuted(playerId)) return 0;
    return Math.max(0, (this._muteExpiry[playerId] || 0) - Date.now());
  }

  /**
   * @description Manually unmutes a player (for admin use or appeal resolution).
   * @param {string} playerId - The player identifier.
   */
  unmutePlayer(playerId) {
    this._mutedPlayers.delete(playerId);
    delete this._muteExpiry[playerId];
  }

  // ============================================================
  // PUBLIC API - Statistics
  // ============================================================

  /**
   * @description Returns moderation system statistics for the current session.
   * @returns {Object} Statistics object.
   * @returns {number} return.totalMessagesAnalyzed - Total messages processed.
   * @returns {number} return.totalActionsTaken - Total moderation actions applied.
   * @returns {number} return.falsePositiveRate - Estimated false positive rate.
   * @returns {number} return.appealCount - Number of appeals filed.
   * @returns {Object} return.actionBreakdown - Count of each action type.
   */
  getStats() {
    const actionBreakdown = { NONE: 0, SOFT_WARNING: 0, MUTE: 0, AUTO_REPORT: 0 };
    for (const entry of this._moderationLog) {
      if (actionBreakdown[entry.action] !== undefined) {
        actionBreakdown[entry.action]++;
      }
    }

    const appealCount = this._moderationLog.filter(e => e.action === 'APPEAL').length;
    const fpRate = this._totalMessagesAnalyzed > 0
      ? (appealCount / this._totalMessagesAnalyzed)
      : 0;

    return {
      totalMessagesAnalyzed: this._totalMessagesAnalyzed,
      totalActionsTaken: this._totalActionsTaken,
      falsePositiveRate: parseFloat(fpRate.toFixed(4)),
      appealCount,
      actionBreakdown,
    };
  }

  // ============================================================
  // PUBLIC API - Lifecycle
  // ============================================================

  /**
   * @description Disposes the moderation system, saving all state and clearing timers.
   */
  dispose() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }
    this._saveReputation();
    this._saveLog();
    this._playerMessageHistory.clear();
    this._mutedPlayers.clear();
  }

  // ============================================================
  // PRIVATE METHODS - Scoring Heuristics
  // ============================================================

  /**
   * @private
   * @description Calculates toxicity score from -1 (friendly) to +1 (toxic).
   * Uses keyword matching against the hate and harassment databases.
   * @param {string} text - Lowercase message text.
   * @returns {number} Toxicity score.
   */
  _calculateToxicity(text) {
    const lower = text.toLowerCase();
    let score = 0;
    let maxWord = 0;

    // Check hate keywords
    for (const [keyword, weight] of KEYWORD_DATABASE.hate) {
      if (lower.includes(keyword)) {
        maxWord = Math.max(maxWord, weight);
        score += weight * 0.6;
      }
    }

    // Check harassment keywords
    for (const [keyword, weight] of KEYWORD_DATABASE.harassment) {
      if (lower.includes(keyword)) {
        maxWord = Math.max(maxWord, weight);
        score += weight * 0.5;
      }
    }

    // Penalize excessive caps
    const capsMatches = lower.match(PATTERNS.allCaps);
    if (capsMatches) {
      score += capsMatches.length * 0.1;
    }

    // Clamp and return
    return Math.max(-1, Math.min(1, score + maxWord));
  }

  /**
   * @private
   * @description Calculates aggression score from 0 to 1.
   * Uses punctuation patterns, imperative language, and caps usage.
   * @param {string} text - Message text.
   * @returns {number} Aggression score.
   */
  _calculateAggression(text) {
    let score = 0;

    // Excessive exclamation marks indicate shouting/aggression
    const exclMatches = text.match(/!/g);
    if (exclMatches && exclMatches.length >= 3) {
      score += 0.2 + (exclMatches.length * 0.05);
    }

    // ALL CAPS words
    const capsMatches = text.match(PATTERNS.allCaps);
    if (capsMatches) {
      score += capsMatches.length * 0.15;
    }

    // Imperative/command patterns
    const imperativePatterns = ['shut up', 'get out', 'go away', 'stop', 'leave', 'quit'];
    for (const pattern of imperativePatterns) {
      if (text.toLowerCase().includes(pattern)) {
        score += 0.35;
      }
    }

    // Repeated characters (shouting emphasis)
    if (PATTERNS.repeatedChars.test(text)) {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  /**
   * @private
   * @description Calculates spam likelihood score from 0 to 1.
   * Uses URL detection, repetition patterns, promotional keywords, and formatting.
   * @param {string} text - Message text.
   * @returns {number} Spam likelihood score.
   */
  _calculateSpam(text) {
    const lower = text.toLowerCase();
    let score = 0;

    // URL detection
    if (PATTERNS.urlLike.test(text)) {
      score += 0.6;
    }

    // Check spam keywords
    for (const [keyword, weight] of KEYWORD_DATABASE.spam) {
      if (lower.includes(keyword)) {
        score += weight * 0.5;
      }
    }

    // Check scam keywords (also contribute to spam score)
    for (const [keyword, weight] of KEYWORD_DATABASE.scam) {
      if (lower.includes(keyword)) {
        score += weight * 0.4;
      }
    }

    // Repeated words
    if (PATTERNS.repeatedWords.test(text)) {
      score += 0.3;
    }

    // Excessive repeated characters
    if (PATTERNS.repeatedChars.test(text)) {
      score += 0.15;
    }

    // Excessive punctuation
    if (PATTERNS.excessivePunctuation.test(text)) {
      score += 0.15;
    }

    // Excessive emoji
    if (PATTERNS.excessiveEmoji.test(text)) {
      score += 0.2;
    }

    // Excessive numbers
    if (PATTERNS.excessiveNumbers.test(text)) {
      score += 0.25;
    }

    // Message length factor: extremely short or extremely long messages
    const wordCount = text.split(/\s+/).length;
    if (wordCount > 30) {
      score += 0.1;
    }

    // Excessive whitespace (formatting tricks)
    if (PATTERNS.excessiveWhitespace.test(text)) {
      score += 0.15;
    }

    return Math.min(1, score);
  }

  /**
   * @private
   * @description Calculates a contextual modifier based on the player's recent message history.
   * If previous messages were borderline, the modifier increases the current score.
   * @param {string} playerId - The player identifier.
   * @returns {number} Context modifier to add to overall score (0 to +0.15).
   */
  _calculateContextModifier(playerId) {
    const history = this._playerMessageHistory.get(playerId);
    if (!history || history.length === 0) return 0;

    let modifier = 0;
    let borderlineCount = 0;

    // Analyze last CONTEXT_WINDOW_SIZE messages
    const recentMessages = history.slice(-CONTEXT_WINDOW_SIZE);
    for (const entry of recentMessages) {
      const overall = entry.scores.overall || 0;
      if (overall >= THRESHOLD_NO_ACTION && overall < THRESHOLD_SOFT_WARNING) {
        borderlineCount++;
      }
    }

    // Escalation: each borderline message in window adds to modifier
    if (borderlineCount >= 2) {
      modifier = 0.05 * borderlineCount;
    }

    // If last message was already a soft warning level, escalate faster
    const lastMessage = recentMessages[recentMessages.length - 1];
    if (lastMessage && lastMessage.flagged) {
      modifier += 0.05;
    }

    return Math.min(0.15, modifier);
  }

  // ============================================================
  // PRIVATE METHODS - Violation Detection
  // ============================================================

  /**
   * @private
   * @description Determines the primary violation type and severity based on scores.
   * @param {string} text - The message text.
   * @param {Object} scores - The calculated scores.
   * @returns {Object} Object with violation type string and severity number.
   */
  _detectViolation(text, scores) {
    const lower = text.toLowerCase();
    let maxViolation = 'NONE';
    let maxSeverity = 0;
    let maxWeight = 0;

    // Check each violation category
    const categories = [
      { type: 'HATE', keywords: KEYWORD_DATABASE.hate },
      { type: 'HARASSMENT', keywords: KEYWORD_DATABASE.harassment },
      { type: 'SPAM', keywords: KEYWORD_DATABASE.spam },
      { type: 'SCAM', keywords: KEYWORD_DATABASE.scam },
      { type: 'SEXUAL', keywords: KEYWORD_DATABASE.sexual },
      { type: 'PERSONAL_INFO', keywords: KEYWORD_DATABASE.personalInfo },
      { type: 'GROOMING', keywords: KEYWORD_DATABASE.grooming },
    ];

    for (const category of categories) {
      let categoryWeight = 0;
      for (const [keyword, weight] of category.keywords) {
        if (lower.includes(keyword)) {
          categoryWeight += weight;
        }
      }

      const typeInfo = VIOLATION_TYPES[category.type];
      const adjustedWeight = categoryWeight * (typeInfo ? typeInfo.severityWeight : 1);

      if (adjustedWeight > maxWeight) {
        maxWeight = adjustedWeight;
        maxViolation = category.type;
        maxSeverity = this._weightToSeverity(adjustedWeight);
      }
    }

    // If no specific violation but spam score is high, classify as SPAM
    if (maxViolation === 'NONE' && scores.spamLikelihood >= THRESHOLD_NO_ACTION) {
      maxViolation = 'SPAM';
      maxSeverity = this._weightToSeverity(scores.spamLikelihood);
    }

    return { violation: maxViolation, severity: maxSeverity };
  }

  /**
   * @private
   * @description Converts a weight value to a severity level (1-3).
   * @param {number} weight - The calculated weight.
   * @returns {number} Severity level from 1 (low) to 3 (high).
   */
  _weightToSeverity(weight) {
    if (weight >= 1.5) return 3;
    if (weight >= 0.8) return 2;
    if (weight > 0) return 1;
    return 0;
  }

  // ============================================================
  // PRIVATE METHODS - Action Determination
  // ============================================================

  /**
   * @private
   * @description Determines the appropriate moderation action based on overall score.
   * @param {number} overallScore - The composite risk score (0-1).
   * @param {string} violation - Detected violation type.
   * @param {number} severity - Violation severity (1-3).
   * @returns {string} Action from the ACTIONS enum.
   */
  _determineAction(overallScore, violation, severity) {
    // Auto-report for highest severity violations regardless of score
    if (severity >= 3 && overallScore >= THRESHOLD_MUTE) {
      return ACTIONS.AUTO_REPORT;
    }

    if (overallScore < THRESHOLD_NO_ACTION) {
      return ACTIONS.NONE;
    }
    if (overallScore < THRESHOLD_SOFT_WARNING) {
      return ACTIONS.SOFT_WARNING;
    }
    if (overallScore < THRESHOLD_MUTE) {
      // Severity 2+ violations skip soft warning and go straight to mute
      return severity >= 2 ? ACTIONS.MUTE : ACTIONS.SOFT_WARNING;
    }
    return ACTIONS.AUTO_REPORT;
  }

  // ============================================================
  // PRIVATE METHODS - Context Window
  // ============================================================

  /**
   * @private
   * @description Stores a message and its scores in the player's context window.
   * Maintains a sliding window of the last CONTEXT_WINDOW_SIZE messages.
   * @param {string} playerId - The player identifier.
   * @param {string} text - The message text.
   * @param {Object} scores - The calculated scores for this message.
   * @param {number} timestamp - Message timestamp.
   */
  _storeMessage(playerId, text, scores, timestamp) {
    if (!this._playerMessageHistory.has(playerId)) {
      this._playerMessageHistory.set(playerId, []);
    }

    const history = this._playerMessageHistory.get(playerId);
    history.push({
      text,
      scores,
      flagged: scores.overall >= THRESHOLD_NO_ACTION,
      timestamp,
    });

    // Maintain window size
    while (history.length > CONTEXT_WINDOW_SIZE) {
      history.shift();
    }
  }

  // ============================================================
  // PRIVATE METHODS - Reputation
  // ============================================================

  /**
   * @private
   * @description Gets a player's reputation score, defaulting to REPUTATION_STARTING.
   * @param {string} playerId - The player identifier.
   * @returns {number} Reputation score (0-100).
   */
  _getReputation(playerId) {
    return this._reputation[playerId] !== undefined
      ? this._reputation[playerId]
      : REPUTATION_STARTING;
  }

  /**
   * @private
   * @description Adjusts a player's reputation score by a delta amount.
   * @param {string} playerId - The player identifier.
   * @param {number} delta - Amount to adjust by (positive or negative).
   */
  _adjustReputation(playerId, delta) {
    const current = this._getReputation(playerId);
    this._reputation[playerId] = Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, current + delta));
    this._saveReputation();
  }

  /**
   * @private
   * @description Loads reputation data from localStorage.
   * @returns {Object} Map of playerId -> reputation score.
   */
  _loadReputation() {
    try {
      const raw = localStorage.getItem(REPUTATION_KEY);
      if (raw) return JSON.parse(raw);
    } catch (err) {
      console.warn('[AIModeration] Failed to load reputation:', err);
    }
    return {};
  }

  /**
   * @private
   * @description Saves reputation data to localStorage.
   */
  _saveReputation() {
    try {
      localStorage.setItem(REPUTATION_KEY, JSON.stringify(this._reputation));
    } catch (err) {
      console.warn('[AIModeration] Failed to save reputation:', err);
    }
  }

  // ============================================================
  // PRIVATE METHODS - Moderation Log
  // ============================================================

  /**
   * @private
   * @description Loads moderation log from localStorage.
   * @returns {Array<Object>} Array of log entries.
   */
  _loadLog() {
    try {
      const raw = localStorage.getItem(MODERATION_LOG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.slice(-MAX_LOG_ENTRIES) : [];
      }
    } catch (err) {
      console.warn('[AIModeration] Failed to load moderation log:', err);
    }
    return [];
  }

  /**
   * @private
   * @description Saves the moderation log to localStorage.
   */
  _saveLog() {
    try {
      const toSave = this._moderationLog.slice(-MAX_LOG_ENTRIES);
      localStorage.setItem(MODERATION_LOG_KEY, JSON.stringify(toSave));
    } catch (err) {
      console.warn('[AIModeration] Failed to save moderation log:', err);
    }
  }

  /**
   * @private
   * @description Adds an entry to the moderation log.
   * @param {Object} entry - The log entry data.
   */
  _logAction(entry) {
    const logEntry = {
      id: this._logIdCounter++,
      ...entry,
      appealed: false,
      appealReason: null,
      appealedAt: null,
    };

    this._moderationLog.push(logEntry);

    // Trim log to max size
    if (this._moderationLog.length > MAX_LOG_ENTRIES) {
      this._moderationLog = this._moderationLog.slice(-MAX_LOG_ENTRIES);
    }

    this._saveLog();
  }

  // ============================================================
  // PRIVATE METHODS - Mute Enforcement
  // ============================================================

  /**
   * @private
   * @description Applies a mute to a player for the configured duration.
   * @param {string} playerId - The player identifier.
   */
  _applyMute(playerId) {
    this._mutedPlayers.add(playerId);
    this._muteExpiry[playerId] = Date.now() + MUTE_DURATION_MS;
  }

  // ============================================================
  // PRIVATE METHODS - Cleanup
  // ============================================================

  /**
   * @private
   * @description Starts the periodic cleanup timer for expired mutes and old history.
   */
  _startCleanupTimer() {
    // Clean up every 60 seconds
    this._cleanupInterval = setInterval(() => {
      this._cleanup();
    }, 60000);
  }

  /**
   * @private
   * @description Cleans up expired mutes and very old message history.
   */
  _cleanup() {
    const now = Date.now();

    // Remove expired mutes
    for (const playerId of Array.from(this._mutedPlayers)) {
      const expiry = this._muteExpiry[playerId] || 0;
      if (now > expiry) {
        this._mutedPlayers.delete(playerId);
        delete this._muteExpiry[playerId];
      }
    }

    // Clear message history older than 1 hour to prevent memory growth
    const HISTORY_MAX_AGE = 3600000;
    for (const [playerId, history] of this._playerMessageHistory.entries()) {
      const filtered = history.filter(entry => (now - entry.timestamp) < HISTORY_MAX_AGE);
      if (filtered.length === 0) {
        this._playerMessageHistory.delete(playerId);
      } else {
        this._playerMessageHistory.set(playerId, filtered);
      }
    }
  }

  // ============================================================
  // PRIVATE METHODS - Result Building
  // ============================================================

  /**
   * @private
   * @description Constructs a standardized analysis result object.
   * @param {Object} scores - Score breakdown.
   * @param {string} violation - Violation type.
   * @param {number} severity - Severity level.
   * @param {string} action - Action taken.
   * @param {string} reason - Human-readable reason.
   * @param {boolean} flagged - Whether the message was flagged.
   * @returns {Object} Standardized result object.
   */
  _buildResult(scores, violation, severity, action, reason, flagged) {
    return {
      scores: {
        toxicity: parseFloat(scores.toxicity.toFixed(4)),
        aggression: parseFloat(scores.aggression.toFixed(4)),
        spamLikelihood: parseFloat(scores.spamLikelihood.toFixed(4)),
        overall: parseFloat(scores.overall.toFixed(4)),
      },
      violation,
      severity,
      action,
      reason,
      flagged,
      timestamp: Date.now(),
    };
  }

  /**
   * @private
   * @description Builds a human-readable reason string for the moderation decision.
   * @param {string} action - The action taken.
   * @param {string} violation - The violation type.
   * @param {number} severity - The severity level.
   * @param {Object} context - Additional context flags.
   * @returns {string} Human-readable explanation.
   */
  _buildReason(action, violation, severity, context) {
    if (action === ACTIONS.NONE) {
      return 'Message passed all checks.';
    }

    const parts = [];

    if (violation !== 'NONE') {
      const typeInfo = VIOLATION_TYPES[violation];
      parts.push(`Detected ${typeInfo ? typeInfo.label : violation} (severity ${severity})`);
    }

    if (context.isHighReputation) {
      parts.push('High reputation player - lenient threshold applied.');
    }
    if (context.isNewAccount) {
      parts.push('New account - strict threshold applied.');
    }
    if (context.contextModifier > 0) {
      parts.push('Contextual escalation from recent borderline messages.');
    }

    switch (action) {
      case ACTIONS.SOFT_WARNING:
        parts.push('Action: Soft warning displayed to player.');
        break;
      case ACTIONS.MUTE:
        parts.push(`Action: Muted for ${MUTE_DURATION_MS / 60000} minutes.`);
        break;
      case ACTIONS.AUTO_REPORT:
        parts.push('Action: Auto-reported to moderation queue.');
        break;
    }

    return parts.join(' ');
  }
}

// ============================================================
// EXPORT
// ============================================================

export default AIModeration;
