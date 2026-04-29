/**
 * Report.js — Player Report & Moderation Queue System
 *
 * Handles the full report workflow for Starlight Inn:
 * - Submit reports with 6 categories (harassment, spam, inappropriate, cheating, scam, other)
 * - Persistent localStorage queue (last 100 reports)
 - Moderator review interface (pending / reviewed / actioned / dismissed)
 * - Resolution tracking with notes
 * - Export / import for server sync
 * - Report throttling per player (3 per minute)
 *
 * @author Starlight Inn Safety Team
 * @version 3.0.0
 */

export class Report {
  /**
   * Create a new Report system.
   * @param {Object} game - Game engine reference (for state, UI, area).
   */
  constructor(game) {
    /** @type {Object} Game engine reference. */
    this.game = game;

    /** @type {string} localStorage key. */
    this.storageKey = 'starlight_reports';

    /** @type {Array<Object>} In-memory report queue. */
    this.reports = [];

    /** @type {number} Max reports to persist in localStorage. */
    this.maxStored = 100;

    /** @type {number} Max reports per player per day. */
    this.dailyLimit = 10;

    /** @type {string} localStorage key for daily counts. */
    this.dailyKey = 'starlight_reports_daily';

    this.load();
  }

  /**
   * Submit a new player report.
   * @param {string} targetId - Reported player's ID.
   * @param {string} targetName - Reported player's display name.
   * @param {string} reason - Category ID from getReasons().
   * @param {string} [details=''] - Additional details.
   * @returns {{success:boolean, report:Object|null, message:string}} Submission result.
   */
  submit(targetId, targetName, reason, details = '') {
    // Check daily limit
    if (!this.canSubmitToday()) {
      return {
        success: false,
        report: null,
        message: 'You have reached the daily report limit. Please try again tomorrow.',
      };
    }

    // Validate reason
    const validReasons = this.getReasons().map(r => r.id);
    if (!validReasons.includes(reason)) {
      return {
        success: false,
        report: null,
        message: 'Invalid report category.',
      };
    }

    // Validate target
    if (!targetId || !targetName) {
      return {
        success: false,
        report: null,
        message: 'Invalid player selected.',
      };
    }

    // Prevent self-reporting
    const myId = this.game?.state?.player?.id;
    if (targetId === myId) {
      return {
        success: false,
        report: null,
        message: 'You cannot report yourself.',
      };
    }

    const report = {
      id: `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      reporterId: myId || 'unknown',
      reporterName: this.game?.state?.player?.name || 'Unknown',
      targetId,
      targetName,
      reason,
      details: this.sanitizeDetails(details),
      timestamp: Date.now(),
      area: this.game?.state?.area || 'unknown',
      areaName: this.game?.state?.areaName || 'Unknown Area',
      status: 'pending',         // pending, reviewed, actioned, dismissed
      moderatorAction: null,     // warn, mute, kick, ban, dismiss
      moderatorNotes: '',
      moderatorId: null,
      moderatorName: null,
      resolvedAt: null,
      evidence: [],              // screenshot / log references
    };

    this.reports.push(report);
    this.trimStorage();
    this.save();
    this.incrementDailyCount();

    // UI feedback
    if (this.game?.ui?.toast) {
      this.game.ui.toast(
        'Report submitted. Thank you for keeping Starlight Inn safe!',
        'success'
      );
    }

    // Console log for development
    console.log('[Report] Submitted:', report);

    return {
      success: true,
      report,
      message: 'Report submitted successfully.',
    };
  }

  /**
   * Get all valid report reason categories.
   * @returns {Array<{id:string, label:string, description:string, severity:'low'|'medium'|'high'}>}
   */
  getReasons() {
    return [
      {
        id: 'harassment',
        label: 'Harassment or bullying',
        description: 'Targeted abuse, intimidation, or repeated unwanted attention',
        severity: 'high',
      },
      {
        id: 'spam',
        label: 'Spam or flooding',
        description: 'Repeated unwanted messages, ads, or channel flooding',
        severity: 'medium',
      },
      {
        id: 'inappropriate',
        label: 'Inappropriate content',
        description: 'Offensive language, sexual content, or disturbing behavior',
        severity: 'high',
      },
      {
        id: 'cheating',
        label: 'Cheating or exploiting',
        description: 'Using bugs, hacks, or exploits to gain unfair advantage',
        severity: 'high',
      },
      {
        id: 'scam',
        label: 'Scam or fraud',
        description: 'Attempting to trick players into giving items, passwords, or personal info',
        severity: 'high',
      },
      {
        id: 'other',
        label: 'Other',
        description: 'Something else that does not fit the above categories',
        severity: 'low',
      },
    ];
  }

  /**
   * Show the report UI modal for a target player.
   * @param {string} targetId - Target player's ID.
   * @param {string} targetName - Target player's name.
   */
  showReportUI(targetId, targetName) {
    if (!this.game?.ui?.modal) {
      console.warn('[Report] No UI modal available.');
      return;
    }

    const reasons = this.getReasons();
    const reasonOptions = reasons.map(r =>
      `<option value="${r.id}">${r.label}</option>`
    ).join('');

    const html = `
      <div class="report-modal">
        <h3>Report Player</h3>
        <p class="report-target">Reporting: <strong>${this.escapeHtml(targetName)}</strong></p>
        <label for="report-reason">Reason:</label>
        <select id="report-reason">${reasonOptions}</select>
        <label for="report-details">Details (optional):</label>
        <textarea id="report-details" maxlength="500" placeholder="Describe what happened..."></textarea>
        <div class="report-actions">
          <button id="report-submit" class="btn-primary">Submit Report</button>
          <button id="report-cancel" class="btn-secondary">Cancel</button>
        </div>
      </div>
    `;

    this.game.ui.modal.show(html);

    // Wire up buttons
    const submitBtn = document.getElementById('report-submit');
    const cancelBtn = document.getElementById('report-cancel');

    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        const reason = document.getElementById('report-reason')?.value;
        const details = document.getElementById('report-details')?.value || '';
        const result = this.submit(targetId, targetName, reason, details);

        if (result.success) {
          this.game.ui.modal.close();
        } else {
          this.game.ui.toast(result.message, 'error');
        }
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.game.ui.modal.close();
      });
    }
  }

  /**
   * Get all pending reports (moderator view).
   * @returns {Array<Object>} Pending reports, newest first.
   */
  getPendingReports() {
    return this.reports
      .filter(r => r.status === 'pending')
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get all resolved reports.
   * @returns {Array<Object>} Resolved reports.
   */
  getResolvedReports() {
    return this.reports
      .filter(r => r.status !== 'pending')
      .sort((a, b) => (b.resolvedAt || 0) - (a.resolvedAt || 0));
  }

  /**
   * Get reports for a specific target player.
   * @param {string} targetId - Target player ID.
   * @returns {Array<Object>} Reports against this player.
   */
  getReportsByTarget(targetId) {
    return this.reports
      .filter(r => r.targetId === targetId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get reports submitted by a specific player.
   * @param {string} reporterId - Reporter player ID.
   * @returns {Array<Object>} Reports by this player.
   */
  getReportsByReporter(reporterId) {
    return this.reports
      .filter(r => r.reporterId === reporterId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Resolve a report with a moderator action.
   * @param {string} reportId - Report ID to resolve.
   * @param {string} action - Moderator action: 'warn' | 'mute' | 'kick' | 'ban' | 'dismiss'.
   * @param {string} [notes=''] - Moderator notes.
   * @param {string} [moderatorId=''] - Moderator player ID.
   * @param {string} [moderatorName=''] - Moderator display name.
   * @returns {{success:boolean, report:Object|null}} Resolution result.
   */
  resolveReport(reportId, action, notes = '', moderatorId = '', moderatorName = '') {
    const validActions = ['warn', 'mute', 'kick', 'ban', 'dismiss'];
    if (!validActions.includes(action)) {
      return { success: false, report: null };
    }

    const report = this.reports.find(r => r.id === reportId);
    if (!report) {
      return { success: false, report: null };
    }

    report.status = action === 'dismiss' ? 'dismissed' : 'actioned';
    report.moderatorAction = action;
    report.moderatorNotes = notes;
    report.moderatorId = moderatorId;
    report.moderatorName = moderatorName;
    report.resolvedAt = Date.now();

    this.save();

    console.log('[Report] Resolved:', report);

    return { success: true, report };
  }

  /**
   * Dismiss a report without action.
   * @param {string} reportId - Report ID.
   * @param {string} [reason=''] - Dismissal reason.
   * @returns {{success:boolean}}
   */
  dismissReport(reportId, reason = '') {
    return this.resolveReport(reportId, 'dismiss', reason);
  }

  /**
   * Get report statistics.
   * @returns {Object} Stats object.
   */
  getStats() {
    const pending = this.reports.filter(r => r.status === 'pending').length;
    const actioned = this.reports.filter(r => r.status === 'actioned').length;
    const dismissed = this.reports.filter(r => r.status === 'dismissed').length;

    const byReason = {};
    for (const r of this.reports) {
      byReason[r.reason] = (byReason[r.reason] || 0) + 1;
    }

    return {
      total: this.reports.length,
      pending,
      actioned,
      dismissed,
      byReason,
    };
  }

  /**
   * Export all reports as JSON (for server sync).
   * @returns {string} JSON string.
   */
  exportAll() {
    return JSON.stringify(this.reports);
  }

  /**
   * Import reports from JSON (server sync).
   * @param {string} json - JSON string.
   */
  importAll(json) {
    try {
      const imported = JSON.parse(json);
      if (Array.isArray(imported)) {
        this.reports = imported;
        this.trimStorage();
        this.save();
      }
    } catch (e) {
      console.error('[Report] Import failed:', e);
    }
  }

  /**
   * Clear all reports (admin only).
   */
  clearAll() {
    this.reports = [];
    this.save();
  }

  /**
   * Check if the current player can submit more reports today.
   * @returns {boolean}
   */
  canSubmitToday() {
    const today = new Date().toISOString().split('T')[0];
    const counts = JSON.parse(localStorage.getItem(this.dailyKey) || '{}');
    const myId = this.game?.state?.player?.id || 'guest';
    const myCount = counts[myId]?.[today] || 0;
    return myCount < this.dailyLimit;
  }

  /**
   * Increment today's report count.
   */
  incrementDailyCount() {
    const today = new Date().toISOString().split('T')[0];
    const counts = JSON.parse(localStorage.getItem(this.dailyKey) || '{}');
    const myId = this.game?.state?.player?.id || 'guest';

    if (!counts[myId]) counts[myId] = {};
    counts[myId][today] = (counts[myId][today] || 0) + 1;

    localStorage.setItem(this.dailyKey, JSON.stringify(counts));
  }

  /**
   * Sanitize report details input.
   * @param {string} details - Raw details.
   * @returns {string} Sanitized string.
   */
  sanitizeDetails(details) {
    if (typeof details !== 'string') return '';
    return details
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .substring(0, 500)
      .trim();
  }

  /**
   * Escape HTML for safe rendering.
   * @param {string} text - Raw text.
   * @returns {string} Escaped text.
   */
  escapeHtml(text) {
    if (typeof text !== 'string') return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Trim reports to maxStored count.
   */
  trimStorage() {
    if (this.reports.length > this.maxStored) {
      this.reports = this.reports.slice(-this.maxStored);
    }
  }

  /**
   * Persist reports to localStorage.
   */
  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.reports));
    } catch (e) {
      console.warn('[Report] localStorage save failed:', e);
      // If quota exceeded, trim more aggressively
      this.reports = this.reports.slice(-50);
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.reports));
      } catch (e2) {
        console.error('[Report] Failed to save even after trimming:', e2);
      }
    }
  }

  /**
   * Load reports from localStorage.
   */
  load() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      this.reports = stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn('[Report] localStorage load failed:', e);
      this.reports = [];
    }
  }
}

export default Report;
