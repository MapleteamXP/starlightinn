/**
 * @fileoverview EventCalendar.js — Scheduled world events system for Starlight Inn v3.0.
 * Manages recurring global events: Chest Rush (every 4h), Double Silver Weekend,
 * and the daily Mini-game Tournament at 8pm. Provides countdown timers,
 * automatic triggering, announcements, and a visual event panel.
 *
 * @module events/EventCalendar
 * @version 3.0.0
 * @author Starlight Inn Team
 */

/** @typedef {import('../engine/Game.js').Game} Game */

/**
 * Represents a scheduled event entry.
 * @typedef {Object} ScheduledEvent
 * @property {string} id — Unique event identifier.
 * @property {string} schedule — Schedule pattern string.
 * @property {Function} callback — Function to invoke when the event fires.
 * @property {number|null} nextTrigger — Timestamp of the next scheduled trigger.
 * @property {boolean} isRunning — Whether the event is currently active.
 * @property {number|null} endTime — When the active event ends.
 */

/**
 * Represents a public upcoming event display record.
 * @typedef {Object} UpcomingEvent
 * @property {string} name — Human-readable event name.
 * @property {number|null} time — Timestamp of next occurrence, or null.
 * @property {string} emoji — Display emoji.
 * @property {string} description — Short flavor text.
 */

/**
 * Manages scheduled world events: parsing cron-like schedules, triggering
 * callbacks, tracking active event windows, and rendering a countdown panel.
 * @export
 */
export class EventCalendar {
  /**
   * Creates an EventCalendar instance.
   * @param {Game} game — The main Game instance.
   */
  constructor(game) {
    /** @type {Game} */
    this.game = game;

    /** @type {ScheduledEvent[]} — Internal list of registered events. */
    this.events = [];

    /** @type {number|null} — Next Chest Rush timestamp. */
    this.nextChestRush = null;

    /** @type {number|null} — Next Double Silver timestamp. */
    this.nextDoubleSilver = null;

    /** @type {number|null} — Next Tournament timestamp. */
    this.nextTournament = null;

    /** @type {number|null} — Interval handle for the tick loop. */
    this._tickTimer = null;

    /** @type {number} — Tick interval in ms (check every 10 seconds). */
    this.tickRate = 10000;
  }

  /* ================================================================ */
  /*  INITIALIZATION                                                  */
  /* ================================================================ */

  /**
   * Initializes the calendar: registers default events and starts the tick loop.
   * @returns {void}
   */
  init() {
    this.scheduleEvent('chest_rush', 'every_4_hours', () => this.startChestRush());
    this.scheduleEvent('double_silver', 'weekend', () => this.startDoubleSilver());
    this.scheduleEvent('minigame_tournament', 'daily_8pm', () => this.startTournament());

    this._tickTimer = setInterval(() => this.tick(), this.tickRate);

    this.game.chat.system('📅 Event calendar initialized. Next events scheduled.');
  }

  /* ================================================================ */
  /*  SCHEDULING                                                      */
  /* ================================================================ */

  /**
   * Registers a new recurring event with a schedule pattern.
   * Supported patterns:
   *   - 'every_N_hours'    → e.g. every_4_hours
   *   - 'weekend'          → Saturday & Sunday, 12:00 PM
   *   - 'daily_8pm'        → Every day at 20:00 local time
   *   - 'hourly'           → Every hour on the hour
   * @param {string} id — Unique event identifier.
   * @param {string} schedule — Schedule pattern string.
   * @param {Function} callback — Called when the event fires.
   * @returns {ScheduledEvent} The registered event object.
   */
  scheduleEvent(id, schedule, callback) {
    const nextTrigger = this.parseSchedule(schedule);
    const event = {
      id,
      schedule,
      callback,
      nextTrigger,
      isRunning: false,
      endTime: null
    };
    this.events.push(event);

    // Cache the next trigger time on the instance for quick lookups
    if (id === 'chest_rush') this.nextChestRush = nextTrigger;
    if (id === 'double_silver') this.nextDoubleSilver = nextTrigger;
    if (id === 'minigame_tournament') this.nextTournament = nextTrigger;

    return event;
  }

  /**
   * Parses a schedule string and returns the next trigger timestamp.
   * @param {string} schedule — Schedule pattern.
   * @returns {number} Unix timestamp of the next occurrence.
   */
  parseSchedule(schedule) {
    const now = new Date();
    const nowTs = now.getTime();

    // every_N_hours
    const hoursMatch = schedule.match(/^every_(\d+)_hours?$/);
    if (hoursMatch) {
      const hours = parseInt(hoursMatch[1], 10);
      const next = new Date(nowTs + hours * 3600000);
      next.setMinutes(0, 0, 0);
      return next.getTime();
    }

    // weekend
    if (schedule === 'weekend') {
      const day = now.getDay(); // 0=Sun, 6=Sat
      let daysUntil = 0;
      if (day >= 1 && day <= 5) {
        daysUntil = 6 - day; // days until Saturday
      }
      const next = new Date(nowTs + daysUntil * 86400000);
      next.setHours(12, 0, 0, 0);
      return next.getTime();
    }

    // daily_8pm
    if (schedule === 'daily_8pm') {
      const next = new Date(now);
      next.setHours(20, 0, 0, 0);
      if (next.getTime() <= nowTs) {
        next.setDate(next.getDate() + 1);
      }
      return next.getTime();
    }

    // hourly
    if (schedule === 'hourly') {
      const next = new Date(now);
      next.setMinutes(0, 0, 0);
      next.setHours(next.getHours() + 1);
      return next.getTime();
    }

    // Default: 1 hour from now
    return nowTs + 3600000;
  }

  /**
   * Recalculates the next trigger time for an event after it fires.
   * @param {ScheduledEvent} event — The event to reschedule.
   * @returns {void}
   */
  reschedule(event) {
    event.nextTrigger = this.parseSchedule(event.schedule);
    if (event.id === 'chest_rush') this.nextChestRush = event.nextTrigger;
    if (event.id === 'double_silver') this.nextDoubleSilver = event.nextTrigger;
    if (event.id === 'minigame_tournament') this.nextTournament = event.nextTrigger;
  }

  /* ================================================================ */
  /*  TICK LOOP                                                       */
  /* ================================================================ */

  /**
   * Checks all scheduled events and fires any whose time has come.
   * Runs on a 10-second interval.
   * @returns {void}
   */
  tick() {
    const now = Date.now();
    for (const event of this.events) {
      if (!event.isRunning && event.nextTrigger && now >= event.nextTrigger) {
        event.isRunning = true;
        try {
          event.callback();
        } catch (err) {
          console.error(`[EventCalendar] Event "${event.id}" threw:`, err);
        }
        this.reschedule(event);
      }
    }
  }

  /* ================================================================ */
  /*  EVENT STARTERS                                                  */
  /* ================================================================ */

  /**
   * Starts a Chest Rush event: spawns 5 chests across all areas.
   * Active window: 30 minutes.
   * @returns {void}
   */
  startChestRush() {
    if (!this.game.chestManager) {
      console.warn('[EventCalendar] ChestManager not available for Chest Rush');
      return;
    }

    for (let i = 0; i < 5; i++) {
      this.game.chestManager.forceSpawn();
    }

    this.game.chat.system(
      '📦 **Chest Rush!** 5 chests have spawned across the world! Find them before they vanish!'
    );
    this.game.ui.toast('Chest Rush active! 5 chests spawned!', 'event', 6000);

    // Mark event running with 30-minute window
    const rushEvent = this.events.find(e => e.id === 'chest_rush');
    if (rushEvent) {
      rushEvent.endTime = Date.now() + 1800000;
      setTimeout(() => {
        rushEvent.isRunning = false;
        rushEvent.endTime = null;
        this.game.chat.system('📦 Chest Rush has ended. See you at the next rush!');
      }, 1800000);
    }
  }

  /**
   * Starts a Double Silver event: all silver earnings are doubled.
   * Active window: 2 hours.
   * @returns {void}
   */
  startDoubleSilver() {
    this.game.state.doubleSilver = true;
    this.game.chat.system(
      '💰 **Double Silver Weekend** is active! All Silver earnings are doubled for 2 hours!'
    );
    this.game.ui.toast('Double Silver active! Earn 2x Silver!', 'event', 6000);

    const dsEvent = this.events.find(e => e.id === 'double_silver');
    if (dsEvent) {
      dsEvent.endTime = Date.now() + 7200000;
      setTimeout(() => {
        this.game.state.doubleSilver = false;
        dsEvent.isRunning = false;
        dsEvent.endTime = null;
        this.game.chat.system('💰 Double Silver Weekend has ended. Great haul, everyone!');
      }, 7200000);
    }
  }

  /**
   * Starts the daily Mini-game Tournament at 8pm.
   * Active window: 1 hour.
   * @returns {void}
   */
  startTournament() {
    this.game.chat.system(
      '🏆 **Mini-game Tournament** is starting! Join the lobby for special prizes!'
    );
    this.game.ui.toast('Tournament starting! Head to the lobby!', 'event', 8000);

    // Open tournament lobby overlay if available
    if (this.game.ui && typeof this.game.ui.openTournamentLobby === 'function') {
      this.game.ui.openTournamentLobby();
    }

    const tourneyEvent = this.events.find(e => e.id === 'minigame_tournament');
    if (tourneyEvent) {
      tourneyEvent.endTime = Date.now() + 3600000;
      setTimeout(() => {
        tourneyEvent.isRunning = false;
        tourneyEvent.endTime = null;
        this.game.chat.system('🏆 The Mini-game Tournament has concluded. Winners announced shortly!');
      }, 3600000);
    }
  }

  /* ================================================================ */
  /*  QUERIES                                                         */
  /* ================================================================ */

  /**
   * Returns a list of upcoming events with their next trigger times.
   * @returns {UpcomingEvent[]} Array of upcoming event summaries.
   */
  getUpcomingEvents() {
    return [
      {
        name: 'Chest Rush',
        time: this.nextChestRush,
        emoji: '📦',
        description: '5 chests spawn across all areas for 30 minutes'
      },
      {
        name: 'Double Silver',
        time: this.nextDoubleSilver,
        emoji: '💰',
        description: 'All Silver earnings are doubled for 2 hours'
      },
      {
        name: 'Tournament',
        time: this.nextTournament,
        emoji: '🏆',
        description: 'Mini-game tournament with special prizes at 8pm'
      }
    ];
  }

  /**
   * Returns a list of currently active events.
   * @returns {Array<{name:string, emoji:string, endsIn:number}>} Active events.
   */
  getActiveEvents() {
    const active = [];
    const now = Date.now();
    for (const event of this.events) {
      if (event.isRunning && event.endTime) {
        const names = {
          chest_rush: 'Chest Rush',
          double_silver: 'Double Silver',
          minigame_tournament: 'Tournament'
        };
        const emojis = {
          chest_rush: '📦',
          double_silver: '💰',
          minigame_tournament: '🏆'
        };
        active.push({
          name: names[event.id] || event.id,
          emoji: emojis[event.id] || '⭐',
          endsIn: Math.max(0, event.endTime - now)
        });
      }
    }
    return active;
  }

  /**
   * Formats a millisecond duration into a human-readable countdown string.
   * @param {number} ms — Duration in milliseconds.
   * @returns {string} Formatted string like "2h 15m" or "45m 30s".
   */
  formatCountdown(ms) {
    if (ms <= 0) return 'Starting now!';
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / 60000) % 60);
    const hours = Math.floor(ms / 3600000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  /* ================================================================ */
  /*  UI RENDERING                                                    */
  /* ================================================================ */

  /**
   * Renders the event panel into a provided DOM container.
   * Displays countdowns for upcoming events and badges for active ones.
   * @param {HTMLElement} container — Parent DOM element to render into.
   * @returns {void}
   */
  renderEventPanel(container) {
    if (!container) return;

    const upcoming = this.getUpcomingEvents();
    const active = this.getActiveEvents();
    const now = Date.now();

    let html = `<div class="event-panel" style="
      background: rgba(20,10,40,0.85);
      border: 1px solid rgba(255,215,0,0.3);
      border-radius: 12px;
      padding: 14px;
      font-family: sans-serif;
      color: #f0e6ff;
      max-width: 280px;
    ">`;

    // Active events banner
    if (active.length > 0) {
      html += `<div style="
        margin-bottom: 10px;
        padding-bottom: 10px;
        border-bottom: 1px solid rgba(255,215,0,0.2);
      ">`;
      html += `<div style="
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #ffd700;
        margin-bottom: 6px;
      ">Active Events</div>`;
      for (const evt of active) {
        html += `<div style="
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 4px 0;
          font-size: 13px;
        ">`;
        html += `<span style="font-size: 16px;">${evt.emoji}</span>`;
        html += `<span style="flex:1;">${evt.name}</span>`;
        html += `<span style="color:#ff6b6b; font-size:11px;">${this.formatCountdown(evt.endsIn)} left</span>`;
        html += `</div>`;
      }
      html += `</div>`;
    }

    // Upcoming events
    html += `<div style="
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #a080c0;
      margin-bottom: 6px;
    ">Upcoming Events</div>`;

    for (const evt of upcoming) {
      const timeRemaining = evt.time ? evt.time - now : 0;
      const countdown = this.formatCountdown(timeRemaining);
      html += `<div style="
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 6px 0;
        padding: 6px 8px;
        background: rgba(255,255,255,0.04);
        border-radius: 6px;
        transition: background 0.2s;
      " onmouseover="this.style.background='rgba(255,255,255,0.08)'"
         onmouseout="this.style.background='rgba(255,255,255,0.04)'">`;
      html += `<span style="font-size: 18px;">${evt.emoji}</span>`;
      html += `<div style="flex:1;">`;
      html += `<div style="font-size: 13px; font-weight: 600;">${evt.name}</div>`;
      html += `<div style="font-size: 10px; color: #a090c0; line-height: 1.3;">${evt.description}</div>`;
      html += `</div>`;
      html += `<div style="text-align:right;">`;
      html += `<div style="font-size: 12px; color: #ffd700; font-weight: 600;">${countdown}</div>`;
      html += `</div>`;
      html += `</div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
  }

  /**
   * Re-renders the event panel if the container still exists.
   * Call this periodically (e.g. every minute) to update countdowns.
   * @param {HTMLElement} container — Parent DOM element.
   * @returns {void}
   */
  refreshEventPanel(container) {
    this.renderEventPanel(container);
  }

  /* ================================================================ */
  /*  DEBUG / UTILITY                                                 */
  /* ================================================================ */

  /**
   * Forces an event to trigger immediately, regardless of schedule.
   * @param {string} eventId — ID of the event to force.
   * @returns {boolean} True if the event was found and triggered.
   */
  forceEvent(eventId) {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return false;
    event.callback();
    this.reschedule(event);
    return true;
  }

  /**
   * Cancels any running event by ID and clears its active state.
   * @param {string} eventId — ID of the event to cancel.
   * @returns {boolean} True if cancelled.
   */
  cancelEvent(eventId) {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return false;
    event.isRunning = false;
    event.endTime = null;
    if (eventId === 'double_silver') {
      this.game.state.doubleSilver = false;
    }
    return true;
  }

  /**
   * Destroys the calendar tick timer and clears all events.
   * @returns {void}
   */
  destroy() {
    if (this._tickTimer) {
      clearInterval(this._tickTimer);
      this._tickTimer = null;
    }
    this.events = [];
    this.nextChestRush = null;
    this.nextDoubleSilver = null;
    this.nextTournament = null;
  }
}
