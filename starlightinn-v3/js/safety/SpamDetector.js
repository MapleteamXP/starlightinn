/**
 * SpamDetector.js — Message Spam & Abuse Detection
 *
 * Identifies spammy behavior in chat by analyzing message patterns:
 * - Identical message flooding (3 identical in 30s)
 * - Rapid message bursts (5 messages in 10s)
 * - ALL CAPS shouting (>80% uppercase)
 * - Repeated character stretching (15+ same chars)
 * - Excessive punctuation (!!!!!, ?????)
 * - Link flooding (multiple URLs in short window)
 * - Emoji / symbol spam
 * - Number / symbol pattern spam
 *
 * Returns a score-based assessment with actionable violations.
 *
 * @author Starlight Inn Safety Team
 * @version 3.0.0
 */

export class SpamDetector {
  /**
   * Create a new SpamDetector.
   */
  constructor() {
    /** @type {Map<string, Array<{text:string, time:number, length:number}>>} Player message history. */
    this.playerMessages = new Map();

    /** @type {Map<string, number>} Player spam scores (persistent per session). */
    this.playerScores = new Map();

    /** @type {Map<string, number>} Player mute warning timestamps. */
    this.muteWarnings = new Map();

    /** @type {Object<string, {count:number, window:number}|number>} Detection thresholds. */
    this.thresholds = {
      identicalMessages: { count: 3, window: 30000 },  // 3 identical in 30s
      rapidMessages:     { count: 5,  window: 10000 },   // 5 messages in 10s
      capsRatio:         0.80,                           // 80% uppercase
      repeatChars:       15,                             // 15+ repeated chars
      excessivePunctuation: 5,                           // 5+ consecutive !/?
      linkSpam:          { count: 3, window: 60000 },   // 3 links in 60s
      emojiSpam:         { count: 8, window: 10000 },     // 8+ emojis in 10s
      longMessage:       256,                            // Very long message threshold
    };

    /** @type {number} Score threshold for auto-mute consideration. */
    this.muteThreshold = 5;

    /** @type {number} Score threshold for warning toast. */
    this.warningThreshold = 3;

    /** @type {RegExp} URL detection pattern. */
    this.urlPattern = /(https?:\/\/|www\.)[^\s]+/gi;

    /** @type {RegExp} Emoji detection pattern. */
    this.emojiPattern = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]/gu;

    /** @type {number} Max message history entries per player. */
    this.maxHistoryEntries = 100;
  }

  /**
   * Check a message for spam indicators.
   * @param {string} playerId - Player identifier.
   * @param {string} message - Message content.
   * @returns {{isSpam:boolean, violations:string[], score:number, warning:boolean, muteSuggested:boolean}}
   */
  check(playerId, message) {
    const result = {
      isSpam: false,
      violations: [],
      score: 0,
      warning: false,
      muteSuggested: false,
    };

    // Record the message first
    this.recordMessage(playerId, message);

    // === Run all detection heuristics ===
    if (this.isIdenticalSpam(playerId, message)) {
      result.isSpam = true;
      result.violations.push('identical');
      result.score += 3;
    }

    if (this.isRapidSpam(playerId)) {
      result.isSpam = true;
      result.violations.push('rapid');
      result.score += 2;
    }

    if (this.isAllCaps(message)) {
      result.violations.push('caps');
      result.score += 1;
    }

    if (this.hasRepeatedChars(message)) {
      result.violations.push('repeat');
      result.score += 1;
    }

    if (this.hasExcessivePunctuation(message)) {
      result.violations.push('punctuation');
      result.score += 1;
    }

    if (this.isLinkSpam(playerId, message)) {
      result.isSpam = true;
      result.violations.push('link_spam');
      result.score += 2;
    }

    if (this.isEmojiSpam(playerId, message)) {
      result.violations.push('emoji_spam');
      result.score += 1;
    }

    if (this.isVeryLong(message)) {
      result.violations.push('long_message');
      result.score += 1;
    }

    if (this.hasSymbolSpam(message)) {
      result.violations.push('symbol_spam');
      result.score += 1;
    }

    // Final spam determination
    result.isSpam = result.score >= 3;
    result.warning = result.score >= this.warningThreshold;
    result.muteSuggested = result.score >= this.muteThreshold;

    // Accumulate persistent player score
    const currentScore = this.playerScores.get(playerId) || 0;
    this.playerScores.set(playerId, currentScore + result.score);

    // If persistent score is very high, suggest mute
    if (this.playerScores.get(playerId) >= this.muteThreshold * 2) {
      result.muteSuggested = true;
    }

    return result;
  }

  /**
   * Record a message in the player's history.
   * @param {string} playerId - Player identifier.
   * @param {string} message - Message content.
   */
  recordMessage(playerId, message) {
    if (!this.playerMessages.has(playerId)) {
      this.playerMessages.set(playerId, []);
    }
    const history = this.playerMessages.get(playerId);
    history.push({
      text: message,
      time: Date.now(),
      length: message.length,
    });

    this.cleanup(playerId);
  }

  /**
   * Check for identical message spam.
   * @param {string} playerId - Player identifier.
   * @param {string} message - Current message.
   * @returns {boolean}
   */
  isIdenticalSpam(playerId, message) {
    const history = this.getRecentHistory(playerId, this.thresholds.identicalMessages.window);
    const normalizedMsg = message.toLowerCase().trim();
    const identical = history.filter(m =>
      m.text.toLowerCase().trim() === normalizedMsg
    );
    return identical.length >= this.thresholds.identicalMessages.count;
  }

  /**
   * Check for similar message spam (near-identical).
   * @param {string} playerId - Player identifier.
   * @param {string} message - Current message.
   * @returns {boolean}
   */
  isSimilarSpam(playerId, message) {
    const history = this.getRecentHistory(playerId, this.thresholds.identicalMessages.window);
    const normalized = this.normalizeForSimilarity(message);
    const similar = history.filter(m =>
      this.similarity(this.normalizeForSimilarity(m.text), normalized) > 0.85
    );
    return similar.length >= this.thresholds.identicalMessages.count;
  }

  /**
   * Check for rapid-fire messaging.
   * @param {string} playerId - Player identifier.
   * @returns {boolean}
   */
  isRapidSpam(playerId) {
    const history = this.getRecentHistory(playerId, this.thresholds.rapidMessages.window);
    return history.length >= this.thresholds.rapidMessages.count;
  }

  /**
   * Check if message is mostly ALL CAPS.
   * @param {string} message - Message content.
   * @returns {boolean}
   */
  isAllCaps(message) {
    const letters = message.replace(/[^a-zA-Z]/g, '');
    return letters.length > 5 && letters === letters.toUpperCase();
  }

  /**
   * Check for excessive repeated characters.
   * @param {string} message - Message content.
   * @returns {boolean}
   */
  hasRepeatedChars(message) {
    return /(\w)\1{14,}/.test(message); // 15+ repeated same character
  }

  /**
   * Check for excessive punctuation (!!!!!, ?????).
   * @param {string} message - Message content.
   * @returns {boolean}
   */
  hasExcessivePunctuation(message) {
    return /[!?]{5,}/.test(message);
  }

  /**
   * Check for link spam (multiple URLs in short window).
   * @param {string} playerId - Player identifier.
   * @param {string} message - Message content.
   * @returns {boolean}
   */
  isLinkSpam(playerId, message) {
    const hasUrl = this.urlPattern.test(message);
    if (!hasUrl) return false;

    // Reset lastIndex since RegExp with global flag retains it
    this.urlPattern.lastIndex = 0;

    const history = this.getRecentHistory(playerId, this.thresholds.linkSpam.window);
    let linkCount = 0;
    for (const entry of history) {
      const matches = entry.text.match(this.urlPattern);
      if (matches) linkCount += matches.length;
    }
    this.urlPattern.lastIndex = 0;

    return linkCount >= this.thresholds.linkSpam.count;
  }

  /**
   * Check for excessive emoji usage.
   * @param {string} playerId - Player identifier.
   * @param {string} message - Message content.
   * @returns {boolean}
   */
  isEmojiSpam(playerId, message) {
    const emojiMatches = message.match(this.emojiPattern);
    if (!emojiMatches || emojiMatches.length < 4) return false;

    const history = this.getRecentHistory(playerId, this.thresholds.emojiSpam.window);
    let totalEmojis = emojiMatches.length;
    for (const entry of history) {
      const matches = entry.text.match(this.emojiPattern);
      if (matches) totalEmojis += matches.length;
    }

    return totalEmojis >= this.thresholds.emojiSpam.count;
  }

  /**
   * Check for very long messages (potential wall spam).
   * @param {string} message - Message content.
   * @returns {boolean}
   */
  isVeryLong(message) {
    return message.length > this.thresholds.longMessage;
  }

  /**
   * Check for symbol / pattern spam (e.g., "abc123abc123" or "#@$%#@$%").
   * @param {string} message - Message content.
   * @returns {boolean}
   */
  hasSymbolSpam(message) {
    // Check for high ratio of non-alphanumeric characters
    const nonAlphaNum = message.replace(/[a-zA-Z0-9\s]/g, '');
    if (message.length > 10 && nonAlphaNum.length / message.length > 0.5) {
      return true;
    }

    // Check for repetitive 2-3 char patterns
    const pattern = /(.{2,4})\1{4,}/;
    return pattern.test(message);
  }

  /**
   * Normalize text for similarity comparison.
   * @param {string} text - Raw text.
   * @returns {string} Normalized text.
   */
  normalizeForSimilarity(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/(\w)\1{2,}/g, '$1$1');
  }

  /**
   * Compute Jaccard-like similarity between two strings.
   * @param {string} a - First string.
   * @param {string} b - Second string.
   * @returns {number} Similarity ratio 0..1.
   */
  similarity(a, b) {
    if (a === b) return 1.0;
    if (a.length === 0 || b.length === 0) return 0.0;

    // Use bigram similarity
    const bigramsA = this.getBigrams(a);
    const bigramsB = this.getBigrams(b);
    const intersection = [...bigramsA].filter(x => bigramsB.has(x));
    return (2 * intersection.length) / (bigramsA.size + bigramsB.size);
  }

  /**
   * Extract bigrams from a string.
   * @param {string} str - Input string.
   * @returns {Set<string>} Bigram set.
   */
  getBigrams(str) {
    const bigrams = new Set();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  }

  /**
   * Get recent message history for a player.
   * @param {string} playerId - Player identifier.
   * @param {number} windowMs - Time window in milliseconds.
   * @returns {Array<{text:string, time:number, length:number}>}
   */
  getRecentHistory(playerId, windowMs) {
    const history = this.playerMessages.get(playerId) || [];
    const now = Date.now();
    return history.filter(m => now - m.time < windowMs);
  }

  /**
   * Clean up old message history for a player.
   * @param {string} playerId - Player identifier.
   */
  cleanup(playerId) {
    const history = this.playerMessages.get(playerId);
    if (!history) return;

    const now = Date.now();
    const maxWindow = Math.max(
      this.thresholds.identicalMessages.window,
      this.thresholds.rapidMessages.window,
      this.thresholds.linkSpam.window,
      this.thresholds.emojiSpam.window
    );

    let cleaned = history.filter(m => now - m.time < maxWindow);

    // Hard cap to prevent memory bloat
    if (cleaned.length > this.maxHistoryEntries) {
      cleaned = cleaned.slice(-this.maxHistoryEntries);
    }

    this.playerMessages.set(playerId, cleaned);
  }

  /**
   * Reset all data for a player (e.g., on disconnect).
   * @param {string} playerId - Player identifier.
   */
  reset(playerId) {
    this.playerMessages.delete(playerId);
    this.playerScores.delete(playerId);
    this.muteWarnings.delete(playerId);
  }

  /**
   * Get a human-readable explanation for violations.
   * @param {string[]} violations - Violation types.
   * @returns {string} Human-readable explanation.
   */
  explainViolations(violations) {
    const explanations = {
      identical: 'Sending the same message repeatedly',
      rapid: 'Sending messages too quickly',
      caps: 'Using too many capital letters',
      repeat: 'Stretching characters (e.g., "heeeey")',
      punctuation: 'Too much punctuation (!!!???)',
      link_spam: 'Posting too many links',
      emoji_spam: 'Using too many emojis',
      long_message: 'Message is excessively long',
      symbol_spam: 'Too many symbols or patterns',
    };

    return violations.map(v => explanations[v] || v).join('; ');
  }

  /**
   * Get the current persistent spam score for a player.
   * @param {string} playerId - Player identifier.
   * @returns {number} Cumulative score.
   */
  getPlayerScore(playerId) {
    return this.playerScores.get(playerId) || 0;
  }

  /**
   * Decay player scores over time (call periodically).
   * @param {number} decayAmount - Amount to reduce each score by.
   */
  decayScores(decayAmount = 1) {
    for (const [playerId, score] of this.playerScores.entries()) {
      const newScore = Math.max(0, score - decayAmount);
      if (newScore === 0) {
        this.playerScores.delete(playerId);
      } else {
        this.playerScores.set(playerId, newScore);
      }
    }
  }

  /**
   * Get statistics for monitoring.
   * @returns {{trackedPlayers:number, totalMessages:number, flaggedPlayers:number}}
   */
  getStats() {
    let totalMessages = 0;
    for (const history of this.playerMessages.values()) {
      totalMessages += history.length;
    }

    const flaggedPlayers = [...this.playerScores.entries()].filter(
      ([, score]) => score >= this.warningThreshold
    ).length;

    return {
      trackedPlayers: this.playerMessages.size,
      totalMessages,
      flaggedPlayers,
    };
  }
}

export default SpamDetector;
