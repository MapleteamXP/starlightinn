/**
 * @file Input.js
 * @description Unified input handling for keyboard, mouse, and touch.
 * Supports gesture hotkeys, virtual joystick on mobile, pinch-to-zoom, and event subscription.
 */

/**
 * Unified input handler for keyboard, mouse, and touch events.
 * @export {Input}
 */
export class Input {
  /**
   * @param {import('./Game.js').Game} game - The game instance.
   */
  constructor(game) {
    this.game = game;

    // Keyboard state
    /** @type {Object<string, boolean>} */
    this.keys = {};
    /** @type {Set<string>} Keys pressed this frame (single-fire). */
    this.keysPressed = new Set();
    /** @type {Set<string>} Keys released this frame. */
    this.keysReleased = new Set();

    // Mouse state
    /** @type {{x:number, y:number, down:boolean, rightDown:boolean, worldX:number, worldY:number}} */
    this.mouse = { x: 0, y: 0, down: false, rightDown: false, worldX: 0, worldY: 0 };

    // Touch state
    /** @type {{active:boolean, startX:number, startY:number, currentX:number, currentY:number, fingers:number, pinchStartDist:number, longPressFired:boolean}} */
    this.touch = {
      active: false,
      startX: 0, startY: 0,
      currentX: 0, currentY: 0,
      fingers: 0,
      pinchStartDist: 0,
      longPressFired: false,
      identifier: null
    };

    /** @type {boolean} Whether the device is mobile. */
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    /** @type {boolean} Whether touch mode is active (auto-detected or forced). */
    this.touchMode = this.isMobile;

    // Gesture mapping: 1=wave, 2=dance, 3=sit, 4=sleep, 5=laugh, 6=cry
    /** @type {string[]} */
    this.gestureLabels = ['', 'wave', 'dance', 'sit', 'sleep', 'laugh', 'cry'];

    // Virtual joystick state (for mobile)
    /** @type {{active:boolean, anchorX:number, anchorY:number, currentX:number, currentY:number, maxRadius:number}} */
    this.joystick = { active: false, anchorX: 0, anchorY: 0, currentX: 0, currentY: 0, maxRadius: 50 };

    // Event subscription system
    /** @type {Object<string, Function[]>} */
    this.callbacks = {
      onKeyDown: [], onKeyUp: [],
      onMouseDown: [], onMouseMove: [], onMouseUp: [],
      onRightClick: [],
      onTouchStart: [], onTouchMove: [], onTouchEnd: [],
      onPinch: [], onTap: [], onLongPress: [],
      onGesture: []
    };

    // Long-press state
    /** @type {number|null} */
    this.longPressTimer = null;
    /** @type {number} Long-press threshold in ms. */
    this.longPressDuration = 500;

    // Bound handler references for cleanup
    this._boundKeyDown = this._onKeyDown.bind(this);
    this._boundKeyUp = this._onKeyUp.bind(this);
    this._boundMouseDown = this._onMouseDown.bind(this);
    this._boundMouseMove = this._onMouseMove.bind(this);
    this._boundMouseUp = this._onMouseUp.bind(this);
    this._boundContextMenu = this._onContextMenu.bind(this);
    this._boundWheel = this._onWheel.bind(this);
    this._boundTouchStart = this._onTouchStart.bind(this);
    this._boundTouchMove = this._onTouchMove.bind(this);
    this._boundTouchEnd = this._onTouchEnd.bind(this);
    this._boundVisibilityChange = this._onVisibilityChange.bind(this);
  }

  /**
   * Attach all event listeners and prepare input state.
   */
  init() {
    const canvas = this.game.canvas;

    // Keyboard
    window.addEventListener('keydown', this._boundKeyDown);
    window.addEventListener('keyup', this._boundKeyUp);

    // Mouse
    canvas.addEventListener('mousedown', this._boundMouseDown);
    window.addEventListener('mousemove', this._boundMouseMove);
    window.addEventListener('mouseup', this._boundMouseUp);
    canvas.addEventListener('contextmenu', this._boundContextMenu);
    canvas.addEventListener('wheel', this._boundWheel, { passive: false });

    // Touch
    canvas.addEventListener('touchstart', this._boundTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this._boundTouchMove, { passive: false });
    canvas.addEventListener('touchend', this._boundTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', this._boundTouchEnd, { passive: false });

    // Visibility
    document.addEventListener('visibilitychange', this._boundVisibilityChange);

    // Prevent default touch behaviors that cause scrolling
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    console.log('[Input] Initialized. Mobile:', this.isMobile, 'Touch mode:', this.touchMode);
  }

  // ── Keyboard Handlers ───────────────────────────────────────────────────

  /**
   * @param {KeyboardEvent} e
   */
  _onKeyDown(e) {
    const key = e.key.toLowerCase();
    if (!this.keys[key]) {
      this.keys[key] = true;
      this.keysPressed.add(key);
    }

    // Prevent scrolling with arrow keys/space
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(key)) {
      e.preventDefault();
    }

    // Spacebar triggers main action in landing
    if (key === ' ' || key === 'enter') {
      if (this.game.state.screen === 'landing') {
        this.game.setScreen('charselect');
        e.preventDefault();
      }
    }

    // Escape opens/closes menu
    if (key === 'escape') {
      if (this.game.state.screen === 'game') {
        this.game.setScreen('settings');
      } else if (this.game.state.screen === 'settings') {
        this.game.setScreen('game');
      }
    }

    // Enter in settings returns to game
    if (key === 'enter' && this.game.state.screen === 'settings') {
      this.game.setScreen('game');
    }

    // Emit
    this._emit('onKeyDown', key, e);
  }

  /**
   * @param {KeyboardEvent} e
   */
  _onKeyUp(e) {
    const key = e.key.toLowerCase();
    this.keys[key] = false;
    this.keysReleased.add(key);
    this._emit('onKeyUp', key, e);
  }

  // ── Mouse Handlers ──────────────────────────────────────────────────────

  /**
   * @param {MouseEvent} e
   */
  _onMouseDown(e) {
    const rect = this.game.canvas.getBoundingClientRect();
    const scaleX = this.game.W / rect.width;
    const scaleY = this.game.H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    this.mouse.x = mx;
    this.mouse.y = my;

    if (e.button === 0) {
      this.mouse.down = true;
      // Convert to world coords for click-to-move
      if (this.game.camera) {
        const wpos = this.game.camera.screenToWorld(mx, my);
        this.mouse.worldX = wpos.x;
        this.mouse.worldY = wpos.y;
      }
      this._emit('onMouseDown', mx, my, e);
    } else if (e.button === 2) {
      this.mouse.rightDown = true;
      this._emit('onRightClick', mx, my, e);
    }
  }

  /**
   * @param {MouseEvent} e
   */
  _onMouseMove(e) {
    const rect = this.game.canvas.getBoundingClientRect();
    const scaleX = this.game.W / rect.width;
    const scaleY = this.game.H / rect.height;
    this.mouse.x = (e.clientX - rect.left) * scaleX;
    this.mouse.y = (e.clientY - rect.top) * scaleY;
    this._emit('onMouseMove', this.mouse.x, this.mouse.y, e);
  }

  /**
   * @param {MouseEvent} e
   */
  _onMouseUp(e) {
    if (e.button === 0) this.mouse.down = false;
    if (e.button === 2) this.mouse.rightDown = false;
    const rect = this.game.canvas.getBoundingClientRect();
    const scaleX = this.game.W / rect.width;
    const scaleY = this.game.H / rect.height;
    this._emit('onMouseUp', (e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY, e);
  }

  /**
   * @param {MouseEvent} e
   */
  _onContextMenu(e) {
    e.preventDefault();
    this._emit('onRightClick', this.mouse.x, this.mouse.y, e);
  }

  /**
   * @param {WheelEvent} e
   */
  _onWheel(e) {
    e.preventDefault();
    if (this.game.camera) {
      if (e.deltaY < 0) {
        this.game.camera.zoomIn(0.08);
      } else {
        this.game.camera.zoomOut(0.08);
      }
    }
  }

  // ── Touch Handlers ──────────────────────────────────────────────────────

  /**
   * @param {TouchEvent} e
   */
  _onTouchStart(e) {
    e.preventDefault();
    const touches = e.touches;
    this.touch.fingers = touches.length;

    if (touches.length === 1) {
      const t = touches[0];
      const rect = this.game.canvas.getBoundingClientRect();
      const scaleX = this.game.W / rect.width;
      const scaleY = this.game.H / rect.height;

      this.touch.active = true;
      this.touch.identifier = t.identifier;
      this.touch.startX = this.touch.currentX = (t.clientX - rect.left) * scaleX;
      this.touch.startY = this.touch.currentY = (t.clientY - rect.top) * scaleY;
      this.touch.longPressFired = false;

      // Activate virtual joystick on left half of screen
      if (this.touch.startX < this.game.W * 0.5) {
        this.joystick.active = true;
        this.joystick.anchorX = this.touch.startX;
        this.joystick.anchorY = this.touch.startY;
        this.joystick.currentX = this.touch.startX;
        this.joystick.currentY = this.touch.startY;
      }

      // Long press timer
      this.longPressTimer = window.setTimeout(() => {
        if (this.touch.active && !this.touch.longPressFired) {
          this.touch.longPressFired = true;
          this._emit('onLongPress', this.touch.currentX, this.touch.currentY);
        }
      }, this.longPressDuration);

      this._emit('onTouchStart', this.touch.currentX, this.touch.currentY, e);
    } else if (touches.length === 2) {
      // Pinch start
      this.joystick.active = false;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      this.touch.pinchStartDist = Math.sqrt(dx * dx + dy * dy);
    }
  }

  /**
   * @param {TouchEvent} e
   */
  _onTouchMove(e) {
    e.preventDefault();
    const touches = e.touches;
    this.touch.fingers = touches.length;

    if (touches.length === 1 && this.touch.active) {
      const t = touches[0];
      const rect = this.game.canvas.getBoundingClientRect();
      const scaleX = this.game.W / rect.width;
      const scaleY = this.game.H / rect.height;
      this.touch.currentX = (t.clientX - rect.left) * scaleX;
      this.touch.currentY = (t.clientY - rect.top) * scaleY;

      // Update joystick
      if (this.joystick.active) {
        this.joystick.currentX = this.touch.currentX;
        this.joystick.currentY = this.touch.currentY;
      }

      // Cancel long press if moved significantly
      const moveDist = Math.hypot(this.touch.currentX - this.touch.startX, this.touch.currentY - this.touch.startY);
      if (moveDist > 10 && this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }

      this._emit('onTouchMove', this.touch.currentX, this.touch.currentY, e);
    } else if (touches.length === 2 && this.touch.pinchStartDist > 0) {
      // Pinch zoom
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scaleChange = dist / this.touch.pinchStartDist;
      if (this.game.camera) {
        this.game.camera.setZoom(this.game.camera.zoom * scaleChange);
      }
      this.touch.pinchStartDist = dist;
      this._emit('onPinch', scaleChange, e);
    }
  }

  /**
   * @param {TouchEvent} e
   */
  _onTouchEnd(e) {
    e.preventDefault();
    const wasTap = this.touch.active &&
      !this.touch.longPressFired &&
      Math.hypot(this.touch.currentX - this.touch.startX, this.touch.currentY - this.touch.startY) < 15;

    if (wasTap) {
      this._emit('onTap', this.touch.startX, this.touch.startY, e);
    }

    // Handle landing screen tap
    if (wasTap && this.game.state.screen === 'landing') {
      this.game.setScreen('charselect');
    }

    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    this.touch.active = false;
    this.touch.fingers = e.touches.length;
    this.joystick.active = false;
    this.touch.pinchStartDist = 0;

    this._emit('onTouchEnd', this.touch.currentX, this.touch.currentY, e);
  }

  // ── Visibility ──────────────────────────────────────────────────────────

  _onVisibilityChange() {
    if (document.hidden) {
      // Clear all keys when tab is hidden to prevent stuck keys
      Object.keys(this.keys).forEach(k => { this.keys[k] = false; });
    }
  }

  // ── Query Methods ───────────────────────────────────────────────────────

  /**
   * Get normalized movement vector from keyboard or virtual joystick.
   * @returns {{x:number, y:number}} Normalized vector with magnitude capped at 1.
   */
  getMovementVector() {
    let dx = 0, dy = 0;

    // Keyboard
    if (this.keys['w'] || this.keys['arrowup']) dy -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) dy += 1;
    if (this.keys['a'] || this.keys['arrowleft']) dx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) dx += 1;

    // Virtual joystick override
    if (this.joystick.active) {
      const jdx = this.joystick.currentX - this.joystick.anchorX;
      const jdy = this.joystick.currentY - this.joystick.anchorY;
      const dist = Math.sqrt(jdx * jdx + jdy * jdy);
      if (dist > 5) {
        const clampedDist = Math.min(dist, this.joystick.maxRadius);
        dx = (jdx / dist) * (clampedDist / this.joystick.maxRadius);
        dy = (jdy / dist) * (clampedDist / this.joystick.maxRadius);
        return { x: dx, y: dy };
      }
    }

    // Normalize keyboard vector
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    return { x: dx, y: dy };
  }

  /**
   * Check if a gesture hotkey (1-6) was pressed this frame.
   * @returns {number} Gesture id (0 if none).
   */
  isGestureKeyPressed() {
    for (let i = 1; i <= 6; i++) {
      if (this.keysPressed.has(i.toString())) return i;
    }
    return 0;
  }

  /**
   * Check if a key is currently held.
   * @param {string} key - Lowercase key name.
   * @returns {boolean}
   */
  isKeyDown(key) {
    return !!this.keys[key.toLowerCase()];
  }

  /**
   * Check if a key was pressed this frame (single-shot).
   * @param {string} key
   * @returns {boolean}
   */
  isKeyPressed(key) {
    return this.keysPressed.has(key.toLowerCase());
  }

  /**
   * Check if a key was released this frame.
   * @param {string} key
   * @returns {boolean}
   */
  isKeyReleased(key) {
    return this.keysReleased.has(key.toLowerCase());
  }

  // ── Event Subscription ──────────────────────────────────────────────────

  /**
   * Subscribe to an input event.
   * @param {string} event - Event name (e.g., 'onKeyDown', 'onTap').
   * @param {Function} callback
   * @returns {Function} Unsubscribe function.
   */
  subscribe(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
    return () => this.unsubscribe(event, callback);
  }

  /**
   * Unsubscribe from an input event.
   * @param {string} event
   * @param {Function} callback
   */
  unsubscribe(event, callback) {
    if (!this.callbacks[event]) return;
    const idx = this.callbacks[event].indexOf(callback);
    if (idx !== -1) this.callbacks[event].splice(idx, 1);
  }

  /**
   * Emit an event to all subscribers.
   */
  _emit(event, ...args) {
    if (!this.callbacks[event]) return;
    for (const cb of this.callbacks[event]) {
      try { cb(...args); } catch (e) { console.warn('[Input] Event error:', e); }
    }
  }

  // ── Per-frame Update ────────────────────────────────────────────────────

  /**
   * Clear single-frame key states. Call at the end of each frame.
   */
  endFrame() {
    this.keysPressed.clear();
    this.keysReleased.clear();
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────

  /**
   * Remove all event listeners and clean up.
   */
  destroy() {
    window.removeEventListener('keydown', this._boundKeyDown);
    window.removeEventListener('keyup', this._boundKeyUp);
    this.game.canvas.removeEventListener('mousedown', this._boundMouseDown);
    window.removeEventListener('mousemove', this._boundMouseMove);
    window.removeEventListener('mouseup', this._boundMouseUp);
    this.game.canvas.removeEventListener('contextmenu', this._boundContextMenu);
    this.game.canvas.removeEventListener('wheel', this._boundWheel);
    this.game.canvas.removeEventListener('touchstart', this._boundTouchStart);
    this.game.canvas.removeEventListener('touchmove', this._boundTouchMove);
    this.game.canvas.removeEventListener('touchend', this._boundTouchEnd);
    this.game.canvas.removeEventListener('touchcancel', this._boundTouchEnd);
    document.removeEventListener('visibilitychange', this._boundVisibilityChange);

    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
    }

    document.body.style.overflow = '';
    document.body.style.touchAction = '';
  }
}
