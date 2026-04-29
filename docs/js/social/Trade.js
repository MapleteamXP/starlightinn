/**
 * @file Trade.js
 * @description Trade window UI for Starlight Inn v3.
 * Supports drag-drop from inventory, lock mechanism, 5-second confirm countdown.
 * Renders via Canvas overlay.
 */

const TRADE_CONFIRM_MS = 5000;
const SLOT_SIZE = 44;
const SLOT_GAP = 6;

export class TradeWindow {
  /**
   * @param {Object} game — The main game instance.
   */
  constructor(game) {
    this.game = game;
    this.visible = false;
    this.partner = null; // { id, name }

    // Offer slots
    this.myOffer = [];     // Array of item objects the local player offers
    this.partnerOffer = []; // Array of item objects the partner offers

    // Lock state
    this.myLocked = false;
    this.partnerLocked = false;
    this.myConfirmed = false;
    this.partnerConfirmed = false;

    // Confirm countdown
    this.confirmTimer = null;
    this.confirmRemaining = 0;

    // Layout rects (computed in _computeLayout)
    this._layout = {};

    // Drag state
    this._dragItem = null;
    this._dragFrom = null; // 'inventory' | 'myOffer'
    this._dragX = 0;
    this._dragY = 0;
    this._hoverSlot = null;

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
  }

  /**
   * Open the trade window with a partner.
   * @param {Object} partner — { id, name }
   */
  show(partner) {
    if (!partner) return;
    this.partner = partner;
    this.visible = true;

    // Reset state
    this.myOffer = [];
    this.partnerOffer = [];
    this.myLocked = false;
    this.partnerLocked = false;
    this.myConfirmed = false;
    this.partnerConfirmed = false;
    this._clearConfirm();

    // Attach canvas listeners
    const canvas = this.game.canvas;
    if (canvas) {
      canvas.addEventListener('pointerdown', this._onPointerDown, { passive: false });
      canvas.addEventListener('pointermove', this._onPointerMove, { passive: false });
      canvas.addEventListener('pointerup', this._onPointerUp, { passive: false });
    }

    this.game.chat && this.game.chat.system(`Trade opened with ${partner.name}.`);
  }

  /** Close the trade window. */
  hide() {
    this.visible = false;
    this._clearConfirm();

    const canvas = this.game.canvas;
    if (canvas) {
      canvas.removeEventListener('pointerdown', this._onPointerDown);
      canvas.removeEventListener('pointermove', this._onPointerMove);
      canvas.removeEventListener('pointerup', this._onPointerUp);
    }
  }

  /** Cancel / decline the current trade. */
  decline() {
    if (this.partner) {
      this.game.chat && this.game.chat.system(`Trade with ${this.partner.name} was cancelled.`);
      this.game.emit && this.game.emit('tradeCancel', { partnerId: this.partner.id });
    }
    this.hide();
  }

  /**
   * Add an item from local inventory to the offer.
   * @param {Object} item — { id, name, icon, value }
   */
  addItemToOffer(item) {
    if (this.myLocked) return;
    if (this.myOffer.length >= 8) {
      this.game.chat && this.game.chat.system('Trade offer is full (max 8 items).');
      return;
    }
    this.myOffer.push({ ...item, uid: `${item.id}_${Date.now()}` });
    this.myLocked = false; // adding resets lock
    this.myConfirmed = false;
    this.partnerConfirmed = false;
    this._clearConfirm();
  }

  /**
   * Remove an item from the local offer.
   * @param {Object} item
   */
  removeItemFromOffer(item) {
    if (this.myLocked) return;
    const idx = this.myOffer.findIndex((o) => o.uid === item.uid);
    if (idx >= 0) {
      this.myOffer.splice(idx, 1);
      this.myLocked = false;
      this.myConfirmed = false;
      this.partnerConfirmed = false;
      this._clearConfirm();
    }
  }

  /** Lock the local offer. */
  lockOffer() {
    if (this.myOffer.length === 0 && this.partnerOffer.length === 0) {
      this.game.chat && this.game.chat.system('Add items before locking.');
      return;
    }
    this.myLocked = true;
    this.game.chat && this.game.chat.system('Your offer is locked.');
    this.game.emit && this.game.emit('tradeLock', { partnerId: this.partner.id });
  }

  /** Unlock the local offer. */
  unlockOffer() {
    this.myLocked = false;
    this.myConfirmed = false;
    this._clearConfirm();
    this.game.chat && this.game.chat.system('Your offer is unlocked.');
    this.game.emit && this.game.emit('tradeUnlock', { partnerId: this.partner.id });
  }

  /**
   * Called when partner locks their offer.
   */
  onPartnerLock() {
    this.partnerLocked = true;
    this.game.chat && this.game.chat.system(`${this.partner.name} has locked their offer.`);
  }

  /**
   * Called when partner unlocks their offer.
   */
  onPartnerUnlock() {
    this.partnerLocked = false;
    this.partnerConfirmed = false;
    this._clearConfirm();
  }

  /**
   * Confirm and start the 5-second countdown.
   * Both sides must have locked.
   */
  accept() {
    if (!this.myLocked || !this.partnerLocked) {
      this.game.chat && this.game.chat.system('Both players must lock their offers first.');
      return;
    }
    this.myConfirmed = true;
    this._startConfirmCountdown();
    this.game.emit && this.game.emit('tradeAccept', { partnerId: this.partner.id });
  }

  /** Partner confirmed — start countdown if both ready. */
  onPartnerAccept() {
    this.partnerConfirmed = true;
    if (this.myConfirmed) this._startConfirmCountdown();
  }

  /** Start the 5-second countdown before trade executes. */
  _startConfirmCountdown() {
    this.confirmRemaining = TRADE_CONFIRM_MS;
    this._clearConfirm();
    this.confirmTimer = setInterval(() => {
      this.confirmRemaining -= 100;
      if (this.confirmRemaining <= 0) {
        this._executeTrade();
      }
    }, 100);
  }

  _clearConfirm() {
    if (this.confirmTimer) {
      clearInterval(this.confirmTimer);
      this.confirmTimer = null;
    }
    this.confirmRemaining = 0;
  }

  /** Finalize the trade — exchange items. */
  _executeTrade() {
    this._clearConfirm();
    this.game.chat && this.game.chat.system(
      `Trade with ${this.partner.name} complete!`
    );
    // In a full build: actually transfer items between inventories
    this.game.emit && this.game.emit('tradeComplete', {
      partnerId: this.partner.id,
      sent: this.myOffer,
      received: this.partnerOffer,
    });
    this.hide();
  }

  // ─── Canvas Rendering ───

  /**
   * Render the trade window overlay.
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    if (!this.visible) return;

    const W = ctx.canvas.width;
    const H = ctx.canvas.height;

    this._computeLayout(W, H);
    const L = this._layout;

    // 1) Darkened backdrop
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, W, H);

    // 2) Window background
    ctx.fillStyle = 'rgba(17, 24, 39, 0.96)';
    this._roundRect(ctx, L.winX, L.winY, L.winW, L.winH, 12);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, L.winX, L.winY, L.winW, L.winH, 12);
    ctx.stroke();

    // 3) Title bar
    ctx.fillStyle = '#1F2937';
    this._roundRect(ctx, L.winX, L.winY, L.winW, 36, [12, 12, 0, 0]);
    ctx.fill();
    ctx.fillStyle = '#E5E7EB';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Trading with ${this.partner?.name || '...'}`, W / 2, L.winY + 24);

    // 4) Left panel — My offer
    this._renderPanel(ctx, 'Your Offer', L.leftX, L.panelY, L.panelW, L.panelH, this.myOffer, this.myLocked, true);

    // 5) Right panel — Partner's offer
    this._renderPanel(ctx, `${this.partner?.name || 'Partner'}'s Offer`, L.rightX, L.panelY, L.panelW, L.panelH, this.partnerOffer, this.partnerLocked, false);

    // 6) Center — value comparison & buttons
    this._renderCenter(ctx, L.centerX, L.panelY, L.centerW, L.panelH);

    // 7) Dragged item ghost
    if (this._dragItem) {
      ctx.globalAlpha = 0.8;
      this._drawItemSlot(ctx, this._dragX - SLOT_SIZE / 2, this._dragY - SLOT_SIZE / 2, this._dragItem);
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Render one side panel.
   * @private
   */
  _renderPanel(ctx, title, x, y, w, h, items, locked, isMine) {
    // Panel bg
    ctx.fillStyle = 'rgba(31, 41, 55, 0.6)';
    this._roundRect(ctx, x, y, w, h, 8);
    ctx.fill();

    // Title
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, x + 10, y + 18);

    // Lock indicator
    if (locked) {
      ctx.fillStyle = '#10B981';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('🔒 LOCKED', x + w - 10, y + 18);
    }

    // Item slots (2x4 grid)
    const cols = 2;
    const rows = 4;
    const startX = x + (w - (cols * SLOT_SIZE + (cols - 1) * SLOT_GAP)) / 2;
    const startY = y + 30;

    for (let i = 0; i < cols * rows; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const sx = startX + col * (SLOT_SIZE + SLOT_GAP);
      const sy = startY + row * (SLOT_SIZE + SLOT_GAP);
      const item = items[i] || null;
      this._drawItemSlot(ctx, sx, sy, item, i === this._hoverSlot && isMine);
    }

    // Total value
    const totalValue = items.reduce((sum, it) => sum + (it.value || 0), 0);
    ctx.fillStyle = '#6B7280';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Value: ${totalValue} Gold`, x + w / 2, y + h - 8);
  }

  /**
   * Draw a single item slot.
   * @private
   */
  _drawItemSlot(ctx, x, y, item, isHover = false) {
    // Slot background
    ctx.fillStyle = isHover ? 'rgba(255, 255, 255, 0.1)' : 'rgba(17, 24, 39, 0.8)';
    this._roundRect(ctx, x, y, SLOT_SIZE, SLOT_SIZE, 6);
    ctx.fill();

    // Slot border
    ctx.strokeStyle = isHover ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, x, y, SLOT_SIZE, SLOT_SIZE, 6);
    ctx.stroke();

    if (item) {
      // Item icon (placeholder colored square with initial)
      ctx.fillStyle = item.color || '#3B82F6';
      this._roundRect(ctx, x + 4, y + 4, SLOT_SIZE - 8, SLOT_SIZE - 8, 4);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const initial = (item.icon || item.name?.charAt(0) || '?').toUpperCase();
      ctx.fillText(initial, x + SLOT_SIZE / 2, y + SLOT_SIZE / 2);
      ctx.textBaseline = 'alphabetic';

      // Quantity badge if stackable
      if (item.quantity && item.quantity > 1) {
        const badge = `x${item.quantity}`;
        ctx.fillStyle = '#EF4444';
        const bw = ctx.measureText(badge).width + 6;
        ctx.beginPath();
        ctx.roundRect(x + SLOT_SIZE - bw - 2, y + SLOT_SIZE - 14, bw, 14, 4);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '10px sans-serif';
        ctx.fillText(badge, x + SLOT_SIZE - bw / 2 - 2, y + SLOT_SIZE - 4);
      }
    }
  }

  /**
   * Render the center column: comparison arrows, buttons.
   * @private
   */
  _renderCenter(ctx, x, y, w, h) {
    // Compare arrow area
    const arrowY = y + h / 2 - 20;
    ctx.fillStyle = '#6B7280';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⇄', x + w / 2, arrowY);

    // Value comparison bar
    const myVal = this.myOffer.reduce((s, i) => s + (i.value || 0), 0);
    const pVal = this.partnerOffer.reduce((s, i) => s + (i.value || 0), 0);
    const barY = arrowY + 20;
    const barW = w - 16;
    const total = Math.max(myVal + pVal, 1);
    const myRatio = myVal / total;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fillRect(x + 8, barY, barW, 6);
    ctx.fillStyle = '#3B82F6';
    ctx.fillRect(x + 8, barY, barW * myRatio, 6);
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(x + 8 + barW * myRatio, barY, barW * (1 - myRatio), 6);

    // Buttons
    const btnY = barY + 30;
    this._drawButton(ctx, x + 8, btnY, w - 16, 30,
      this.myLocked ? 'Unlock' : 'Lock Offer',
      this.myLocked ? '#EF4444' : '#10B981',
      () => this.myLocked ? this.unlockOffer() : this.lockOffer()
    );

    const btn2Y = btnY + 38;
    let acceptLabel = 'Accept';
    let acceptColor = '#3B82F6';
    if (this.confirmRemaining > 0) {
      acceptLabel = `Confirming ${(this.confirmRemaining / 1000).toFixed(1)}s`;
      acceptColor = '#F59E0B';
    } else if (this.myConfirmed) {
      acceptLabel = 'Waiting...';
      acceptColor = '#6B7280';
    }
    this._drawButton(ctx, x + 8, btn2Y, w - 16, 30, acceptLabel, acceptColor);

    const btn3Y = btn2Y + 38;
    this._drawButton(ctx, x + 8, btn3Y, w - 16, 30, 'Cancel Trade', '#6B7280');
  }

  /**
   * Draw a button on canvas.
   * @private
   */
  _drawButton(ctx, x, y, w, h, label, color) {
    ctx.fillStyle = color + '22';
    this._roundRect(ctx, x, y, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = color + '66';
    ctx.lineWidth = 1;
    this._roundRect(ctx, x, y, w, h, 6);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
    ctx.textBaseline = 'alphabetic';
  }

  // ─── Input Handling ───

  _onPointerDown(e) {
    if (!this.visible) return;
    const { x, y } = this._canvasCoords(e);
    this._dragX = x;
    this._dragY = y;

    const slot = this._hitTestSlot(x, y);
    if (slot && slot.side === 'myOffer' && this.myOffer[slot.index]) {
      this._dragItem = this.myOffer[slot.index];
      this._dragFrom = 'myOffer';
    }
  }

  _onPointerMove(e) {
    if (!this.visible) return;
    const { x, y } = this._canvasCoords(e);
    this._dragX = x;
    this._dragY = y;

    if (!this._dragItem) {
      const slot = this._hitTestSlot(x, y);
      this._hoverSlot = slot ? slot.index : null;
    }
  }

  _onPointerUp(e) {
    if (!this.visible) return;
    const { x, y } = this._canvasCoords(e);
    const slot = this._hitTestSlot(x, y);

    if (this._dragItem && this._dragFrom === 'myOffer') {
      // Dropped outside valid area → remove from offer
      if (!slot) {
        this.removeItemFromOffer(this._dragItem);
      }
      this._dragItem = null;
      this._dragFrom = null;
      return;
    }

    // Button clicks
    if (!slot) {
      this._handleButtonClick(x, y);
      return;
    }
  }

  /**
   * Check which UI element is at (x, y).
   * @returns {{side: string, index: number} | null}
   */
  _hitTestSlot(x, y) {
    const L = this._layout;
    if (!L.winW) return null;

    // Left panel (my offer) slots
    const leftSlots = this._slotRects(L.leftX, L.panelY + 30, 2, 4);
    for (let i = 0; i < leftSlots.length; i++) {
      const r = leftSlots[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        return { side: 'myOffer', index: i };
      }
    }

    // Right panel (partner offer) slots
    const rightSlots = this._slotRects(L.rightX, L.panelY + 30, 2, 4);
    for (let i = 0; i < rightSlots.length; i++) {
      const r = rightSlots[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        return { side: 'partnerOffer', index: i };
      }
    }

    return null;
  }

  /** Compute slot rectangles for a panel. */
  _slotRects(panelX, startY, cols, rows) {
    const panelW = this._layout.panelW;
    const startX = panelX + (panelW - (cols * SLOT_SIZE + (cols - 1) * SLOT_GAP)) / 2;
    const rects = [];
    for (let i = 0; i < cols * rows; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      rects.push({
        x: startX + col * (SLOT_SIZE + SLOT_GAP),
        y: startY + row * (SLOT_SIZE + SLOT_GAP),
        w: SLOT_SIZE,
        h: SLOT_SIZE,
      });
    }
    return rects;
  }

  /** Handle button clicks via hit testing. */
  _handleButtonClick(x, y) {
    const L = this._layout;
    const barY = L.panelY + L.panelH / 2;

    // Lock / Unlock button area (approximate)
    const lockY = barY + 30;
    if (x >= L.centerX + 8 && x <= L.centerX + L.centerW - 8 &&
        y >= lockY && y <= lockY + 30) {
      if (this.myLocked) this.unlockOffer();
      else this.lockOffer();
      return;
    }

    // Accept button
    const acceptY = lockY + 38;
    if (x >= L.centerX + 8 && x <= L.centerX + L.centerW - 8 &&
        y >= acceptY && y <= acceptY + 30) {
      this.accept();
      return;
    }

    // Cancel button
    const cancelY = acceptY + 38;
    if (x >= L.centerX + 8 && x <= L.centerX + L.centerW - 8 &&
        y >= cancelY && y <= cancelY + 30) {
      this.decline();
      return;
    }

    // Click outside window → hide only if not on window
    if (x < L.winX || x > L.winX + L.winW || y < L.winY || y > L.winY + L.winH) {
      this.hide();
    }
  }

  /** Convert client coords to canvas coords. */
  _canvasCoords(e) {
    const rect = this.game.canvas.getBoundingClientRect();
    const scaleX = this.game.canvas.width / rect.width;
    const scaleY = this.game.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  /** Compute layout based on canvas size. */
  _computeLayout(W, H) {
    const winW = 560;
    const winH = 340;
    const winX = (W - winW) / 2;
    const winY = (H - winH) / 2;
    const gap = 12;
    const panelW = (winW - gap * 3) / 3;
    const panelH = winH - 50;
    const panelY = winY + 40;

    this._layout = {
      winX, winY, winW, winH,
      leftX: winX + gap,
      centerX: winX + gap * 2 + panelW,
      rightX: winX + gap * 3 + panelW * 2,
      panelW,
      panelH,
      panelY,
      centerW: panelW,
    };
  }

  /** Utility: rounded rectangle path. */
  _roundRect(ctx, x, y, w, h, r) {
    const radius = Array.isArray(r) ? r : [r, r, r, r];
    ctx.beginPath();
    ctx.moveTo(x + radius[0], y);
    ctx.lineTo(x + w - radius[1], y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius[1]);
    ctx.lineTo(x + w, y + h - radius[2]);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius[2], y + h);
    ctx.lineTo(x + radius[3], y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius[3]);
    ctx.lineTo(x, y + radius[0]);
    ctx.quadraticCurveTo(x, y, x + radius[0], y);
    ctx.closePath();
  }

  /** Cleanup on destroy. */
  destroy() {
    this._clearConfirm();
    this.hide();
  }
}
