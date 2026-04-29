/**
 * @file RadialMenu.js
 * @description 8-slice radial context menu for player interactions in Starlight Inn v3.
 * Supports mouse click and touch long-press. Drawn via Canvas overlay.
 */

export class RadialMenu {
  /**
   * @param {Object} game — The main game instance.
   */
  constructor(game) {
    this.game = game;
    this.visible = false;
    this.targetPlayer = null;
    this.centerX = 0;
    this.centerY = 0;

    // Dimensions (relative to logical canvas size)
    this.outerRadius = 160;
    this.innerRadius = 50;
    this.hoveredSlice = -1;

    // Slice definitions: angle, action key, label, icon code, color
    this.slices = [
      { action: 'profile', label: 'Profile', icon: '👤', color: '#3B82F6', from: 337.5, to: 22.5 },
      { action: 'whisper', label: 'Whisper', icon: '💬', color: '#8B5CF6', from: 22.5, to: 67.5 },
      { action: 'friend', label: 'Add Friend', icon: '➕', color: '#10B981', from: 67.5, to: 112.5 },
      { action: 'trade', label: 'Trade', icon: '⚖️', color: '#F59E0B', from: 112.5, to: 157.5 },
      { action: 'gift', label: 'Gift', icon: '🎁', color: '#EC4899', from: 157.5, to: 202.5 },
      { action: 'invite', label: 'Invite', icon: '📩', color: '#06B6D4', from: 202.5, to: 247.5 },
      { action: 'uppercut', label: 'Uppercut', icon: '👊', color: '#EF4444', from: 247.5, to: 292.5 },
      { action: 'report', label: 'Report', icon: '🚩', color: '#6B7280', from: 292.5, to: 337.5 },
    ];

    // Input state for touch long-press detection
    this._touchTimer = null;
    this._touchStartX = 0;
    this._touchStartY = 0;
    this._longPressMs = 400;
    this._touchMoved = false;

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onPointerClick = this._onPointerClick.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  /**
   * Wire global pointer listeners. Call once after construction.
   */
  init() {
    const canvas = this.game.canvas;
    if (!canvas) return;

    // Use pointer events for unified mouse + touch handling
    canvas.addEventListener('pointerdown', this._onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', this._onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', this._onPointerUp, { passive: false });
    canvas.addEventListener('click', this._onPointerClick, { passive: false });

    // Touch-specific long-press fallback (pointerdown already covers most)
    canvas.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
    canvas.addEventListener('touchend', this._onTouchEnd.bind(this), { passive: false });
    canvas.addEventListener('touchmove', this._onTouchMove.bind(this), { passive: false });

    document.addEventListener('keydown', this._onKeyDown);
  }

  /**
   * Show the radial menu centered at (x, y) for a specific player.
   * @param {number} x
   * @param {number} y
   * @param {Object} targetPlayer
   */
  show(x, y, targetPlayer) {
    this.visible = true;
    this.centerX = x;
    this.centerY = y;
    this.targetPlayer = targetPlayer;
    this.hoveredSlice = -1;

    // Clamp to screen so full menu stays in view
    const margin = this.outerRadius + 20;
    const canvasWidth = this.game.canvas ? this.game.canvas.width : 1280;
    const canvasHeight = this.game.canvas ? this.game.canvas.height : 720;
    this.centerX = Math.max(margin, Math.min(canvasWidth - margin, this.centerX));
    this.centerY = Math.max(margin, Math.min(canvasHeight - margin, this.centerY));
  }

  /** Hide the menu and clear state. */
  hide() {
    this.visible = false;
    this.targetPlayer = null;
    this.hoveredSlice = -1;
  }

  /**
   * Main canvas render call.
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    if (!this.visible) return;

    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    // 1) Darkened vignette background (exclude menu area via composite)
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, width, height);

    // Punch out the menu circle with destination-out
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, this.outerRadius + 4, 0, Math.PI * 2);
    ctx.fill();

    // Restore to source-over
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // 2) Draw each slice as a pie segment
    const sliceCount = this.slices.length;
    const step = (Math.PI * 2) / sliceCount;

    for (let i = 0; i < sliceCount; i++) {
      const slice = this.slices[i];
      const startAngle = -Math.PI / 2 + i * step;
      const endAngle = startAngle + step;
      const isHovered = i === this.hoveredSlice;

      this._drawSlice(ctx, startAngle, endAngle, slice.color, isHovered);
    }

    // 3) Draw inner circle (hub)
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, this.innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#1F2937';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#4B5563';
    ctx.stroke();

    // Player avatar placeholder / name initial inside hub
    ctx.fillStyle = '#E5E7EB';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initial = this.targetPlayer && this.targetPlayer.name
      ? this.targetPlayer.name.charAt(0).toUpperCase()
      : '?';
    ctx.fillText(initial, this.centerX, this.centerY);
    ctx.restore();

    // 4) Draw outer ring stroke
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, this.outerRadius, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.stroke();
    ctx.restore();

    // 5) Draw icons and labels on each slice
    for (let i = 0; i < sliceCount; i++) {
      const slice = this.slices[i];
      const midAngle = -Math.PI / 2 + i * step + step / 2;
      const labelRadius = this.innerRadius + (this.outerRadius - this.innerRadius) * 0.55;
      const lx = this.centerX + Math.cos(midAngle) * labelRadius;
      const ly = this.centerY + Math.sin(midAngle) * labelRadius;

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Icon
      ctx.font = '24px sans-serif';
      ctx.fillStyle = i === this.hoveredSlice ? '#FFFFFF' : 'rgba(255,255,255,0.9)';
      ctx.fillText(slice.icon, lx, ly - 10);

      // Label
      ctx.font = '12px sans-serif';
      ctx.fillStyle = i === this.hoveredSlice ? '#FFFFFF' : 'rgba(255,255,255,0.75)';
      ctx.fillText(slice.label, lx, ly + 14);

      ctx.restore();
    }
  }

  /**
   * Draw a single pie slice.
   * @private
   */
  _drawSlice(ctx, startAngle, endAngle, baseColor, isHovered) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(this.centerX, this.centerY);
    ctx.arc(this.centerX, this.centerY, this.outerRadius, startAngle, endAngle);
    ctx.closePath();

    // Gradient per slice for depth
    const grad = ctx.createRadialGradient(
      this.centerX, this.centerY, this.innerRadius,
      this.centerX, this.centerY, this.outerRadius
    );
    grad.addColorStop(0, baseColor + '33'); // 20% opacity
    grad.addColorStop(1, baseColor + (isHovered ? 'EE' : 'AA'));
    ctx.fillStyle = grad;
    ctx.fill();

    // Hover stroke
    if (isHovered) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    } else {
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Determine which slice contains the given point.
   * @param {number} x
   * @param {number} y
   * @returns {number} Slice index or -1 if outside.
   */
  _getSliceAtPoint(x, y) {
    const dx = x - this.centerX;
    const dy = y - this.centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this.innerRadius || dist > this.outerRadius) return -1;

    let angle = Math.atan2(dy, dx) * (180 / Math.PI); // -180 to 180
    angle = (angle + 90 + 360) % 360; // rotate so 0° = top

    for (let i = 0; i < this.slices.length; i++) {
      const s = this.slices[i];
      if (s.from > s.to) {
        // Wrap-around slice (profile spans 337.5 -> 22.5)
        if (angle >= s.from || angle < s.to) return i;
      } else {
        if (angle >= s.from && angle < s.to) return i;
      }
    }
    return -1;
  }

  /**
   * Map a normalized 0-360 angle to action key.
   * @param {number} angle — degrees, 0° at top
   * @returns {string} action key
   */
  getSliceAtAngle(angle) {
    const slices = ['profile', 'whisper', 'friend', 'trade', 'gift', 'invite', 'uppercut', 'report'];
    const normalized = ((angle % 360) + 360) % 360;
    const index = Math.floor(((normalized + 22.5) % 360) / 45);
    return slices[index];
  }

  /**
   * Check if an action is available against a target player.
   * @param {string} action
   * @param {Object} targetPlayer
   * @returns {boolean}
   */
  canUseAction(action, targetPlayer) {
    const player = this.game.player;
    if (!player) return false;

    switch (action) {
      case 'uppercut':
        // Comedic knockout costs 250 Gold
        return player.gold >= 250 && !targetPlayer?.isKnockedOut;
      case 'gift':
        // Gift requires friendship
        return this.game.friends && this.game.friends.isFriend(targetPlayer.id);
      case 'trade':
        // Trade requires level 3+
        return player.level >= 3;
      case 'friend':
        // Can't friend yourself or blocked players
        return targetPlayer && player.id !== targetPlayer.id &&
          !(this.game.friends && this.game.friends.isBlocked(targetPlayer.id));
      case 'invite':
        // Can always invite (unless blocked)
        return !(this.game.friends && this.game.friends.isBlocked(targetPlayer.id));
      default:
        return true;
    }
  }

  /**
   * Execute an action by key.
   * @param {string} action
   */
  _executeAction(action) {
    if (!this.targetPlayer) return;

    const tp = this.targetPlayer;
    const can = this.canUseAction(action, tp);

    if (!can) {
      this.game.chat && this.game.chat.system(`You can't use ${action} right now.`);
      this.hide();
      return;
    }

    switch (action) {
      case 'profile': {
        this.game.chat && this.game.chat.system(`Opening profile of ${tp.name}...`);
        // Hook into profile panel
        this.game.emit && this.game.emit('openProfile', tp);
        break;
      }
      case 'whisper': {
        this.game.chat && this.game.chat.whisper(tp, ''); // Opens whisper channel
        break;
      }
      case 'friend': {
        if (this.game.friends) {
          this.game.friends.addFriend(tp.id, tp.name);
          this.game.chat && this.game.chat.system(`Friend request sent to ${tp.name}.`);
        }
        break;
      }
      case 'trade': {
        if (this.game.trade) {
          this.game.trade.show(tp);
        }
        break;
      }
      case 'gift': {
        this.game.chat && this.game.chat.system(`Gift window opened for ${tp.name}.`);
        this.game.emit && this.game.emit('openGift', tp);
        break;
      }
      case 'invite': {
        this.game.chat && this.game.chat.system(`You invited ${tp.name} to your area.`);
        this.game.emit && this.game.emit('invitePlayer', tp);
        break;
      }
      case 'uppercut': {
        this.game.player.gold -= 250;
        this.game.chat && this.game.chat.system(
          `👊 You uppercut ${tp.name} for 250 Gold! They're knocked out cold!`
        );
        this.game.emit && this.game.emit('uppercutPlayer', tp);
        break;
      }
      case 'report': {
        this.game.chat && this.game.chat.system(`Report submitted for ${tp.name}. Thank you.`);
        this.game.emit && this.game.emit('reportPlayer', tp);
        break;
      }
    }

    this.hide();
  }

  /** Pointer / Click handlers */

  _onPointerDown(e) {
    if (!this.visible) return;
    // Right-click or long-press can also trigger; here we handle any pointer
  }

  _onPointerMove(e) {
    if (!this.visible) return;
    const rect = this.game.canvas.getBoundingClientRect();
    const scaleX = this.game.canvas.width / rect.width;
    const scaleY = this.game.canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const sliceIdx = this._getSliceAtPoint(x, y);
    if (sliceIdx !== this.hoveredSlice) {
      this.hoveredSlice = sliceIdx;
    }
  }

  _onPointerUp(e) {
    // Handled by click for selection to avoid double-firing
  }

  _onPointerClick(e) {
    if (!this.visible) return;
    e.stopPropagation();

    const rect = this.game.canvas.getBoundingClientRect();
    const scaleX = this.game.canvas.width / rect.width;
    const scaleY = this.game.canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const sliceIdx = this._getSliceAtPoint(x, y);
    if (sliceIdx >= 0) {
      const action = this.slices[sliceIdx].action;
      this._executeAction(action);
    } else {
      // Clicked outside — hide
      this.hide();
    }
  }

  /** Touch long-press fallback */

  _onTouchStart(e) {
    if (this.visible) return; // Already open
    const touch = e.touches[0];
    this._touchStartX = touch.clientX;
    this._touchStartY = touch.clientY;
    this._touchMoved = false;

    this._touchTimer = setTimeout(() => {
      if (!this._touchMoved) {
        // Convert touch coords to canvas coords
        const rect = this.game.canvas.getBoundingClientRect();
        const scaleX = this.game.canvas.width / rect.width;
        const scaleY = this.game.canvas.height / rect.height;
        const x = (this._touchStartX - rect.left) * scaleX;
        const y = (this._touchStartY - rect.top) * scaleY;

        // Find target player under finger (delegate to game)
        const target = this.game.findPlayerAt && this.game.findPlayerAt(x, y);
        if (target) {
          this.show(x, y, target);
        }
      }
    }, this._longPressMs);
  }

  _onTouchEnd(e) {
    if (this._touchTimer) {
      clearTimeout(this._touchTimer);
      this._touchTimer = null;
    }
  }

  _onTouchMove(e) {
    if (!this._touchTimer) return;
    const touch = e.touches[0];
    const dx = touch.clientX - this._touchStartX;
    const dy = touch.clientY - this._touchStartY;
    if (Math.sqrt(dx * dx + dy * dy) > 20) {
      this._touchMoved = true;
      clearTimeout(this._touchTimer);
      this._touchTimer = null;
    }
  }

  /** Keyboard escape */

  _onKeyDown(e) {
    if (e.key === 'Escape' && this.visible) {
      this.hide();
    }
  }

  /** Cleanup listeners on destroy. */
  destroy() {
    const canvas = this.game.canvas;
    if (canvas) {
      canvas.removeEventListener('pointerdown', this._onPointerDown);
      canvas.removeEventListener('pointermove', this._onPointerMove);
      canvas.removeEventListener('pointerup', this._onPointerUp);
      canvas.removeEventListener('click', this._onPointerClick);
    }
    document.removeEventListener('keydown', this._onKeyDown);
  }
}
