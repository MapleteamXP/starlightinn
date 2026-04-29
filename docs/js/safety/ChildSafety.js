/**
 * ChildSafety.js — Under-13 & Child Protection System
 *
 * Implements COPPA-aware and child-safety best practices for
 * Starlight Inn. When enabled, restricts potentially risky
 * features while preserving the cozy social experience.
 *
 * Restricted features in Child Mode:
 * - Free chat → pre-approved message selection only
 * - Whispers → disabled
 * - Trading → disabled
 * - Room creation → disabled
 * - Profile search visibility → hidden
 * - Location sharing → disabled
 * - External links → disabled
 * - Bio editing → disabled
 * - Friend requests → require parent approval (mock)
 * - Report → still allowed (child safety priority)
 *
 * @author Starlight Inn Safety Team
 * @version 3.0.0
 */

export class ChildSafety {
  /**
   * Create a new ChildSafety manager.
   * @param {Object} game - Game engine reference.
   */
  constructor(game) {
    /** @type {Object} Game engine reference. */
    this.game = game;

    /** @type {Array<string>} Features restricted in child mode. */
    this.restrictedFeatures = [
      'whisper',        // No private messages
      'trade',          // No item trading
      'create_room',    // No creating new rooms
      'profile_public', // Hidden from search
      'location_share', // No location sharing
      'external_links', // No clickable URLs
      'bio_edit',       // Bio editing disabled
      'free_chat',      // Must use pre-approved messages
      'photo_upload',   // No avatar photo uploads
      'voice_chat',     // No voice communication
      'video_chat',     // No video communication
      'email_share',    // No email sharing
      'phone_share',    // No phone number sharing
      'real_name',      // No real name display
      'age_display',    // No age display
      'address_share',  // No address sharing
    ];

    /** @type {Array<string>} Features still allowed in child mode. */
    this.allowedFeatures = [
      'chat_safe',      // Pre-approved messages
      'emote',          // Emotes / gestures
      'move',           // Walking around
      'interact',       // Furniture interaction
      'report',         // Reporting (safety critical)
      'friend_request', // With monitoring (mock parent approval)
      'minigame',       // Safe mini-games
      'dress_up',       // Outfit changing
      'decorate',       // Room decoration (if room owner)
      'help',           // Help system
      'settings',       // Safe settings
    ];

    /** @type {string} localStorage key for child mode. */
    this.storageKey = 'starlight_child_mode';

    /** @type {string} localStorage key for parent PIN. */
    this.pinKey = 'starlight_child_pin';
  }

  /**
   * Enable child safety mode.
   * @param {string} [pin=''] - Optional parent PIN for later disable.
   * @returns {{success:boolean, message:string}}
   */
  enable(pin = '') {
    if (!this.game?.state) {
      return { success: false, message: 'Game state not available.' };
    }

    this.game.state.childMode = true;

    // Store PIN if provided (hashed in real system)
    if (pin) {
      this.setPin(pin);
    }

    // Persist setting
    try {
      localStorage.setItem(this.storageKey, 'true');
    } catch (e) {
      console.warn('[ChildSafety] localStorage save failed:', e);
    }

    // System notification
    if (this.game?.chat?.system) {
      this.game.chat.system(
        'Child Safety Mode enabled. Some features are restricted for your protection.'
      );
    }

    // Update UI
    if (this.game?.ui?.updateChildMode) {
      this.game.ui.updateChildMode(true);
    }

    // Disable restricted UI elements
    this.applyRestrictions();

    console.log('[ChildSafety] Child mode enabled');

    return {
      success: true,
      message: 'Child Safety Mode enabled.',
    };
  }

  /**
   * Disable child safety mode (requires PIN if set).
   * @param {string} [pin=''] - Parent PIN to verify.
   * @returns {{success:boolean, message:string}}
   */
  disable(pin = '') {
    if (!this.game?.state) {
      return { success: false, message: 'Game state not available.' };
    }

    // Verify PIN if one was set
    if (this.hasPin() && !this.verifyPin(pin)) {
      return { success: false, message: 'Incorrect PIN. Please ask a parent for help.' };
    }

    this.game.state.childMode = false;

    try {
      localStorage.removeItem(this.storageKey);
    } catch (e) {
      console.warn('[ChildSafety] localStorage remove failed:', e);
    }

    if (this.game?.chat?.system) {
      this.game.chat.system('Child Safety Mode disabled.');
    }

    if (this.game?.ui?.updateChildMode) {
      this.game.ui.updateChildMode(false);
    }

    this.removeRestrictions();

    console.log('[ChildSafety] Child mode disabled');

    return {
      success: true,
      message: 'Child Safety Mode disabled.',
    };
  }

  /**
   * Check if child mode is currently active.
   * @returns {boolean}
   */
  isEnabled() {
    return !!(this.game?.state?.childMode);
  }

  /**
   * Check if a feature is allowed in child mode.
   * @param {string} feature - Feature identifier.
   * @returns {boolean} True if feature is allowed.
   */
  canUseFeature(feature) {
    if (!this.isEnabled()) return true;
    return !this.restrictedFeatures.includes(feature);
  }

  /**
   * Filter a chat message for child mode.
   * @param {string} message - Raw message.
   * @returns {string} Filtered / safe message.
   */
  filterChat(message) {
    if (!this.isEnabled()) return message;

    const safe = this.getSafeMessages();
    const trimmed = message.trim();

    // Allow exact safe messages
    if (safe.includes(trimmed)) return trimmed;

    // Try case-insensitive match
    const lowerSafe = safe.map(m => m.toLowerCase());
    const idx = lowerSafe.indexOf(trimmed.toLowerCase());
    if (idx !== -1) return safe[idx];

    // Not in safe list → return default
    return safe[0];
  }

  /**
   * Get pre-approved chat messages for child mode.
   * @returns {string[]}
   */
  getSafeMessages() {
    return [
      'Hello!',
      'Nice to meet you!',
      'This is fun!',
      'Want to play?',
      'Thank you!',
      'Goodbye!',
      'See you later!',
      'Have a nice day!',
      'I like your outfit!',
      'Your room is cool!',
      'Great job!',
      'That\'s funny!',
      'Cool!',
      'Awesome!',
      'Nice!',
      'Wow!',
      'Yay!',
      'Oops!',
      'Sorry!',
      'Excuse me!',
    ];
  }

  /**
   * Validate a username for child safety.
   * @param {string} name - Proposed username.
   * @returns {{valid:boolean, reason:string, suggestion:string}}
   */
  validateUsername(name) {
    if (typeof name !== 'string') {
      return { valid: false, reason: 'Name must be text.', suggestion: '' };
    }

    const trimmed = name.trim();

    if (trimmed.length < 3) {
      return { valid: false, reason: 'Name must be at least 3 characters.', suggestion: '' };
    }

    if (trimmed.length > 20) {
      return { valid: false, reason: 'Name must be 20 characters or fewer.', suggestion: trimmed.substring(0, 20) };
    }

    // No personal info patterns
    const personalInfoPatterns = [
      /^\d{4}$/,           // 4-digit year
      /^\d{2}\/\d{2}$/,    // Date pattern
      /^\d{3}-\d{3}-\d{4}$/, // Phone-like
      /^\d{5}$/,           // ZIP code
    ];

    for (const pattern of personalInfoPatterns) {
      if (pattern.test(trimmed)) {
        return { valid: false, reason: 'Names should not include personal information.', suggestion: '' };
      }
    }

    // No real name indicators (simple heuristic)
    const nameParts = trimmed.split(/\s+/);
    if (nameParts.length > 2) {
      return { valid: false, reason: 'Please use a fun nickname, not your real name.', suggestion: nameParts[0] };
    }

    return { valid: true, reason: '', suggestion: '' };
  }

  /**
   * Apply UI restrictions for child mode.
   */
  applyRestrictions() {
    if (!this.game?.ui) return;

    // Hide whisper button
    if (this.game.ui.hideWhisper) this.game.ui.hideWhisper();

    // Hide trade button
    if (this.game.ui.hideTrade) this.game.ui.hideTrade();

    // Show safe chat picker instead of free text input
    if (this.game.ui.showSafeChat) this.game.ui.showSafeChat();

    // Disable room creation button
    if (this.game.ui.disableRoomCreate) this.game.ui.disableRoomCreate();

    // Hide external link areas
    if (this.game.ui.hideExternalLinks) this.game.ui.hideExternalLinks();

    // Show child mode indicator
    if (this.game.ui.showChildModeIndicator) this.game.ui.showChildModeIndicator();
  }

  /**
   * Remove UI restrictions (when child mode disabled).
   */
  removeRestrictions() {
    if (!this.game?.ui) return;

    if (this.game.ui.showWhisper) this.game.ui.showWhisper();
    if (this.game.ui.showTrade) this.game.ui.showTrade();
    if (this.game.ui.showFreeChat) this.game.ui.showFreeChat();
    if (this.game.ui.enableRoomCreate) this.game.ui.enableRoomCreate();
    if (this.game.ui.showExternalLinks) this.game.ui.showExternalLinks();
    if (this.game.ui.hideChildModeIndicator) this.game.ui.hideChildModeIndicator();
  }

  /**
   * Set a parent PIN.
   * @param {string} pin - PIN string.
   */
  setPin(pin) {
    try {
      // In a real system, this would be hashed
      localStorage.setItem(this.pinKey, btoa(pin));
    } catch (e) {
      console.warn('[ChildSafety] PIN save failed:', e);
    }
  }

  /**
   * Verify a parent PIN.
   * @param {string} pin - PIN to verify.
   * @returns {boolean}
   */
  verifyPin(pin) {
    try {
      const stored = localStorage.getItem(this.pinKey);
      if (!stored) return true; // no PIN set = no verification needed
      return btoa(pin) === stored;
    } catch (e) {
      return false;
    }
  }

  /**
   * Check if a PIN is set.
   * @returns {boolean}
   */
  hasPin() {
    try {
      return !!localStorage.getItem(this.pinKey);
    } catch (e) {
      return false;
    }
  }

  /**
   * Remove the parent PIN.
   */
  clearPin() {
    try {
      localStorage.removeItem(this.pinKey);
    } catch (e) {
      console.warn('[ChildSafety] PIN clear failed:', e);
    }
  }

  /**
   * Check if child mode was persisted from previous session.
   * @returns {boolean}
   */
  wasEnabled() {
    try {
      return localStorage.getItem(this.storageKey) === 'true';
    } catch (e) {
      return false;
    }
  }

  /**
   * Restore child mode from previous session.
   * @returns {boolean} True if restored.
   */
  restore() {
    if (this.wasEnabled()) {
      this.enable();
      return true;
    }
    return false;
  }

  /**
   * Get a summary of current restrictions.
   * @returns {{enabled:boolean, restricted:string[], allowed:string[]}}
   */
  getSummary() {
    return {
      enabled: this.isEnabled(),
      restricted: [...this.restrictedFeatures],
      allowed: [...this.allowedFeatures],
    };
  }

  /**
   * Sanitize an external link for child safety.
   * @param {string} url - URL string.
   * @returns {string} Safe placeholder or empty string.
   */
  sanitizeLink(url) {
    if (!this.isEnabled()) return url;
    return ''; // Links completely disabled in child mode
  }

  /**
   * Check if a message contains personal information (child safety).
   * @param {string} message - Message text.
   * @returns {{hasPII:boolean, types:string[]}}
   */
  detectPII(message) {
    const types = [];

    // Email pattern
    if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(message)) {
      types.push('email');
    }

    // Phone pattern (various formats)
    if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(message)) {
      types.push('phone');
    }

    // Address-like pattern (simplified)
    if (/\d+\s+[A-Za-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Way|Court|Ct)/i.test(message)) {
      types.push('address');
    }

    // Social media handle with @
    if (/@\w+/.test(message)) {
      types.push('social_handle');
    }

    return { hasPII: types.length > 0, types };
  }

  /**
   * Block a message if it contains PII in child mode.
   * @param {string} message - Message text.
   * @returns {{allowed:boolean, message:string, reason:string}}
   */
  blockIfPII(message) {
    if (!this.isEnabled()) return { allowed: true, message, reason: '' };

    const pii = this.detectPII(message);
    if (pii.hasPII) {
      return {
        allowed: false,
        message: '',
        reason: 'Messages cannot include personal information (email, phone, address).',
      };
    }

    return { allowed: true, message, reason: '' };
  }
}

export default ChildSafety;
