/**
 * @file Renderer.js
 * @description Rendering adapter for Starlight Inn.
 * Attempts WebGL 2D rendering with sprite batching and post-processing;
 * falls back to Canvas 2D if WebGL is unavailable.
 * Maintains the same public API as the original Canvas 2D renderer.
 */

import { WebGLRenderer } from './WebGLRenderer.js';

// ─── Canvas Fallback Renderer ────────────────────────────────────────────────

/**
 * Canvas 2D fallback renderer when WebGL is unavailable.
 * Mirrors the original Renderer implementation.
 */
class CanvasFallbackRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.W = 960;
    this.H = 540;

    /** @type {HTMLCanvasElement|null} */
    this.postCanvas = null;
    /** @type {CanvasRenderingContext2D|null} */
    this.postCtx = null;
    this._initPostBuffer();

    this.envPhase = 0;
    this.areaStyles = {
      hub:       { top: '#1a1025', bottom: '#2d1b4e', floor: '#1f1630', accent: '#ffcc80' },
      garden:    { top: '#0f1f0f', bottom: '#1a3c1a', floor: '#143214', accent: '#a7f070' },
      library:   { top: '#0d1525', bottom: '#16253e', floor: '#121e33', accent: '#8bb9ff' },
      kitchen:   { top: '#2a1510', bottom: '#3d2118', floor: '#331c15', accent: '#ffb74d' },
      rooftop:   { top: '#0a0a1a', bottom: '#15152e', floor: '#101022', accent: '#c4b5fd' },
      basement:  { top: '#0a0a0a', bottom: '#141414', floor: '#111111', accent: '#9ca3af' }
    };

    /** @type {Image|null} */
    this.grainTile = null;
    this._generateGrainTile();
  }

  _initPostBuffer() {
    this.postCanvas = document.createElement('canvas');
    this.postCanvas.width = this.W;
    this.postCanvas.height = this.H;
    this.postCtx = this.postCanvas.getContext('2d');
  }

  _generateGrainTile() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const x = c.getContext('2d');
    const img = x.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 30;
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 16;
    }
    x.putImageData(img, 0, 0);
    this.grainTile = c;
  }

  setGame(game) { this.game = game; }

  clear() {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.W, this.H);
  }

  renderArea(areaId, targetCtx) {
    const ctx = targetCtx || this.ctx;
    const style = this.areaStyles[areaId] || this.areaStyles.hub;
    const horizonY = this.H * 0.35;
    const grad = ctx.createLinearGradient(0, 0, 0, horizonY);
    grad.addColorStop(0, style.top);
    grad.addColorStop(1, style.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.W, horizonY);

    // Stars
    ctx.save();
    ctx.fillStyle = '#fff8e7';
    const starSeed = areaId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    for (let i = 0; i < 40; i++) {
      const sx = ((starSeed * 9301 + i * 49297) % 10000 / 10000) * this.W;
      const sy = ((starSeed * 49297 + i * 9301) % 10000 / 10000) * horizonY * 0.9;
      const twinkle = Math.sin(this.envPhase * 3 + i) * 0.5 + 0.5;
      ctx.globalAlpha = twinkle * 0.7;
      ctx.beginPath();
      ctx.arc(sx, sy, 1 + twinkle, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Floor
    const fgrad = ctx.createLinearGradient(0, horizonY, 0, this.H);
    fgrad.addColorStop(0, style.floor);
    fgrad.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = fgrad;
    ctx.fillRect(0, horizonY, this.W, this.H - horizonY);

    // Perspective grid
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    const cx = this.W / 2;
    for (let i = -8; i <= 8; i++) {
      const xBase = cx + i * 120;
      ctx.beginPath();
      ctx.moveTo(cx, horizonY);
      ctx.lineTo(xBase + i * 40, this.H);
      ctx.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const y = horizonY + (this.H - horizonY) * (i / 6);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.W, y);
      ctx.stroke();
    }
    ctx.restore();

    // Vignette
    const vgrad = ctx.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.3, this.W / 2, this.H / 2, this.H * 0.9);
    vgrad.addColorStop(0, 'rgba(0,0,0,0)');
    vgrad.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vgrad;
    ctx.fillRect(0, 0, this.W, this.H);
  }

  renderGame() {
    const g = this.game;
    const cam = g.camera;
    const area = g.state.area;
    this.envPhase += 0.008;
    const pctx = this.postCtx;
    pctx.clearRect(0, 0, this.W, this.H);
    this.renderArea(area, pctx);

    const entities = this._collectEntities();
    entities.sort((a, b) => (a.y || 0) - (b.y || 0));
    for (const ent of entities) {
      if (!cam || cam.isInView(ent.x || 0, ent.y || 0, 60)) {
        const sp = cam ? cam.worldToScreen(ent.x || 0, ent.y || 0) : { x: ent.x || 0, y: ent.y || 0 };
        if (ent.type === 'player') this.renderPlayer(ent, sp.x, sp.y, pctx);
        else if (ent.type === 'npc') this.renderNPC(ent, sp.x, sp.y, pctx);
        else this.renderEntity(ent, sp.x, sp.y, 1, pctx);
      }
    }

    this.renderParticles(g.state.particles, pctx);
    this.ctx.drawImage(this.postCanvas, 0, 0);
    this.applyPostEffects(this.ctx);
    this.renderHUD(this.ctx);
  }

  _collectEntities() {
    const out = [];
    out.push({ ...this.game.state.player, type: 'player' });
    for (const op of this.game.state.onlinePlayers) out.push({ ...op, type: 'player' });
    for (const npc of this.game.state.npcs) out.push({ ...npc, type: 'npc' });
    return out;
  }

  renderEntity(entity, x, y, scale = 1, targetCtx) {
    const ctx = targetCtx || this.ctx;
    this.drawShadow(x, y + 14, 28, 8, 0.25, ctx);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = entity.color || '#ccc';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderPlayer(player, x, y, targetCtx) {
    const ctx = targetCtx || this.ctx;
    const bob = player.moving ? Math.sin(this.game.frameCount * 0.25) * 3 : 0;
    this.drawShadow(x, y + 18, 32, 10, 0.3, ctx);
    ctx.save();
    ctx.translate(x, y + bob);
    this._drawAvatar(ctx, player);
    if (player.gestureId > 0) {
      const gmap = { 1: '\u{1F44B}', 2: '\u{1F483}', 3: '\u{1FA91}', 4: '\u{1F4A4}', 5: '\u{1F602}', 6: '\u{1F622}' };
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(gmap[player.gestureId] || '', 0, -42);
    }
    ctx.restore();
    if (this.game.state.settings.showNames && player.name) {
      this.drawText(player.name, x, y - 38, { align: 'center', baseline: 'bottom', font: '11px sans-serif', color: '#fff', shadow: true, shadowColor: 'rgba(0,0,0,0.7)' }, ctx);
    }
    ctx.fillStyle = player.moving ? '#4ade80' : '#60a5fa';
    ctx.beginPath();
    ctx.arc(x + 14, y - 36, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  renderNPC(npc, x, y, targetCtx) {
    const ctx = targetCtx || this.ctx;
    const bob = npc.moving ? Math.sin(this.game.frameCount * 0.2 + (npc.id || 0)) * 2 : 0;
    this.drawShadow(x, y + 16, 28, 8, 0.25, ctx);
    ctx.save();
    ctx.translate(x, y + bob);
    this._drawAvatar(ctx, npc);
    ctx.restore();
    if (npc.name) {
      this.drawText(npc.name, x, y - 34, { align: 'center', baseline: 'bottom', font: '10px sans-serif', color: '#e2e8f0', shadow: true, shadowColor: 'rgba(0,0,0,0.6)' }, ctx);
    }
  }

  _drawAvatar(ctx, p) {
    const skinColors = ['#ffe0bd', '#ffcd94', '#eac086', '#d2a56d', '#8d5524'];
    const hairColors = ['#2d2d2d', '#5c3a21', '#d4a574', '#e8c547', '#a33b3b', '#6b4c9a'];
    const outfitColors = ['#5b8c85', '#c75b5b', '#5b7fa8', '#a85ba8', '#8c5b5b', '#d4a45b'];
    const skin = skinColors[p.skinColor % skinColors.length] || skinColors[0];
    const hair = hairColors[p.hairColor % hairColors.length] || hairColors[0];
    const outfit = outfitColors[p.outfitColor % outfitColors.length] || outfitColors[0];

    ctx.fillStyle = outfit;
    this.drawRoundedRect(-10, -4, 20, 18, 6, true, false, ctx);
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, -14, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(0, -16, 13, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -14, 13, Math.PI * 1.1, Math.PI * 1.9);
    ctx.fill();

    const eyeY = -14;
    const eyeOffset = p.facing === 'left' ? -2 : p.facing === 'right' ? 2 : 0;
    ctx.fillStyle = '#2d2d2d';
    if (p.expression === 'sleep') {
      ctx.strokeStyle = '#2d2d2d'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-5 + eyeOffset, eyeY); ctx.lineTo(-2 + eyeOffset, eyeY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2 + eyeOffset, eyeY); ctx.lineTo(5 + eyeOffset, eyeY); ctx.stroke();
    } else if (p.expression === 'laugh') {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-3 + eyeOffset, eyeY - 1, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(3 + eyeOffset, eyeY - 1, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2d2d2d';
      ctx.beginPath(); ctx.arc(-3 + eyeOffset, eyeY - 1, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(3 + eyeOffset, eyeY - 1, 1.5, 0, Math.PI * 2); ctx.fill();
    } else if (p.expression === 'cry') {
      ctx.beginPath(); ctx.arc(-3 + eyeOffset, eyeY, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(3 + eyeOffset, eyeY, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath(); ctx.arc(-3 + eyeOffset, eyeY + 6, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(3 + eyeOffset, eyeY + 6, 1.5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(-3 + eyeOffset, eyeY, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(3 + eyeOffset, eyeY, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-2 + eyeOffset, eyeY - 1, 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(4 + eyeOffset, eyeY - 1, 0.8, 0, Math.PI * 2); ctx.fill();
    }

    ctx.strokeStyle = '#8b5e3c'; ctx.lineWidth = 1; ctx.lineCap = 'round';
    if (p.expression === 'happy' || p.expression === 'laugh') {
      ctx.beginPath(); ctx.arc(0 + eyeOffset, -10, 3, 0.1, Math.PI - 0.1); ctx.stroke();
    } else if (p.expression === 'sleep') {
      ctx.beginPath(); ctx.moveTo(-2 + eyeOffset, -10); ctx.lineTo(2 + eyeOffset, -10); ctx.stroke();
    } else if (p.expression === 'cry') {
      ctx.beginPath(); ctx.moveTo(-2 + eyeOffset, -8); ctx.quadraticCurveTo(0 + eyeOffset, -6, 2 + eyeOffset, -8); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(-2 + eyeOffset, -10); ctx.lineTo(2 + eyeOffset, -10); ctx.stroke();
    }

    if (p.accessories && p.accessories.includes('glasses')) {
      ctx.strokeStyle = '#444'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(-3 + eyeOffset, eyeY, 4, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(3 + eyeOffset, eyeY, 4, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1 + eyeOffset, eyeY); ctx.lineTo(-1 + eyeOffset, eyeY); ctx.stroke();
    }
  }

  renderParticles(particles, targetCtx) {
    const ctx = targetCtx || this.ctx;
    for (const pt of particles) {
      const alpha = Math.max(0, Math.min(1, pt.life / (pt.maxLife || 2)));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color || '#fff';
      if (pt.type === 'sparkle') {
        const s = pt.size * alpha;
        ctx.translate(pt.x, pt.y);
        ctx.rotate(this.envPhase * 2 + (pt.x || 0));
        ctx.fillRect(-s / 2, -s / 6, s, s / 3);
        ctx.fillRect(-s / 6, -s / 2, s / 3, s);
      } else if (pt.type === 'heart') {
        ctx.font = `${pt.size * 3 * alpha}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('\u{2764}', pt.x, pt.y);
      } else if (pt.type === 'note') {
        ctx.font = `${pt.size * 3 * alpha}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('\u{266A}', pt.x, pt.y);
      } else {
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * alpha, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  renderHUD(targetCtx) {
    const ctx = targetCtx || this.ctx;
    const st = this.game.state;
    ctx.fillStyle = 'rgba(10,10,15,0.6)';
    this.drawRoundedRect(8, 8, this.W - 16, 32, 8, true, false, ctx);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`\u{1FA99} ${st.gold}`, 20, 24);
    ctx.fillStyle = '#c0c0c0';
    ctx.fillText(`\u{1FA99} ${st.silver}`, 110, 24);
    const areaNames = { hub: 'Starlight Hub', garden: 'Moonlit Garden', library: 'Crystal Library', kitchen: 'Cozy Kitchen', rooftop: 'Rooftop Terrace', basement: 'Whisper Basement' };
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(areaNames[st.area] || st.area, this.W / 2, 24);
    ctx.fillStyle = '#a7f070';
    ctx.textAlign = 'right';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${1 + st.onlinePlayers.length} online`, this.W - 20, 24);

    const dockY = this.H - 44;
    ctx.fillStyle = 'rgba(10,10,15,0.6)';
    this.drawRoundedRect(8, dockY, this.W - 16, 36, 8, true, false, ctx);
    const actions = ['Chat', 'Inventory', 'Map', 'Menu'];
    const btnW = 80, gap = 10;
    const startX = (this.W - (actions.length * btnW + (actions.length - 1) * gap)) / 2;
    for (let i = 0; i < actions.length; i++) {
      const bx = startX + i * (btnW + gap);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      this.drawRoundedRect(bx, dockY + 4, btnW, 28, 6, true, false, ctx);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(actions[i], bx + btnW / 2, dockY + 18);
    }

    if (st.ui.toastQueue.length > 0) {
      const toast = st.ui.toastQueue[0];
      const tAlpha = Math.min(1, toast.ttl / 0.5);
      ctx.save();
      ctx.globalAlpha = tAlpha;
      ctx.fillStyle = 'rgba(20,20,30,0.85)';
      this.drawRoundedRect(this.W / 2 - 120, 52, 240, 28, 8, true, false, ctx);
      ctx.fillStyle = '#fff';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(toast.text, this.W / 2, 66);
      ctx.restore();
    }

    if (st.settings.showChat && st.chatMessages.length > 0) {
      const recent = st.chatMessages.slice(-3);
      const chatY = this.H - 110;
      ctx.save();
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < recent.length; i++) {
        const msg = recent[i];
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(12, chatY + i * 18, 340, 18);
        ctx.fillStyle = '#a7f070';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${msg.sender}:`, 16, chatY + i * 18 + 9);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '11px sans-serif';
        ctx.fillText(msg.text, 16 + ctx.measureText(`${msg.sender}:`).width + 4, chatY + i * 18 + 9);
      }
      ctx.restore();
    }
  }

  applyPostEffects(ctx) {
    const vgrad = ctx.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.35, this.W / 2, this.H / 2, this.H * 0.95);
    vgrad.addColorStop(0, 'rgba(0,0,0,0)');
    vgrad.addColorStop(1, 'rgba(10,5,20,0.45)');
    ctx.fillStyle = vgrad;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.fillStyle = 'rgba(255,200,120,0.03)';
    ctx.fillRect(0, 0, this.W, this.H);
    if (this.grainTile && this.game.state.settings.quality !== 'low') {
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.globalCompositeOperation = 'overlay';
      for (let gy = 0; gy < this.H; gy += 128) {
        for (let gx = 0; gx < this.W; gx += 128) {
          ctx.drawImage(this.grainTile, gx, gy);
        }
      }
      ctx.restore();
    }
  }

  renderLanding() {
    const ctx = this.ctx;
    this.renderArea('hub', ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, this.W, this.H);
    this.drawText('Starlight Inn', this.W / 2, this.H / 2 - 40, { align: 'center', font: 'bold 48px serif', color: '#ffd700', shadow: true }, ctx);
    this.drawText('A cozy-core social world', this.W / 2, this.H / 2 + 10, { align: 'center', font: '18px sans-serif', color: '#e2e8f0', shadow: true }, ctx);
    this.drawText('Press ENTER or TAP to begin', this.W / 2, this.H / 2 + 60, { align: 'center', font: '14px sans-serif', color: '#a7f070', shadow: true }, ctx);
  }

  renderCharSelect() {
    const ctx = this.ctx;
    this.renderArea('hub', ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, this.W, this.H);
    this.drawText('Choose Your Character', this.W / 2, 60, { align: 'center', font: 'bold 28px sans-serif', color: '#fff', shadow: true }, ctx);
    const cx = this.W / 2, cy = this.H / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    this.drawRoundedRect(cx - 80, cy - 80, 160, 160, 12, true, false, ctx);
    this._drawAvatar(ctx, { ...this.game.state.player, x: cx, y: cy, expression: 'happy' });
  }

  renderMinigame() {
    this.renderGame();
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, this.W, this.H);
    this.drawText('Minigame Active', this.W / 2, this.H / 2, { align: 'center', font: 'bold 24px sans-serif', color: '#ffd700', shadow: true }, ctx);
  }

  renderSettings() {
    const ctx = this.ctx;
    this.renderArea('hub', ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, this.W, this.H);
    this.drawText('Settings', this.W / 2, 60, { align: 'center', font: 'bold 28px sans-serif', color: '#fff', shadow: true }, ctx);
    const opts = [
      `Sound: ${this.game.state.settings.sound ? 'ON' : 'OFF'}`,
      `Music: ${this.game.state.settings.music ? 'ON' : 'OFF'}`,
      `Quality: ${this.game.state.settings.quality}`,
      `Show Names: ${this.game.state.settings.showNames ? 'ON' : 'OFF'}`,
      `Show Chat: ${this.game.state.settings.showChat ? 'ON' : 'OFF'}`
    ];
    for (let i = 0; i < opts.length; i++) {
      this.drawText(opts[i], this.W / 2, 140 + i * 40, { align: 'center', font: '16px sans-serif', color: '#e2e8f0', shadow: true }, ctx);
    }
  }

  drawShadow(cx, cy, w, h, alpha = 0.3, targetCtx) {
    const ctx = targetCtx || this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, w / 2);
    grad.addColorStop(0, 'rgba(0,0,0,0.7)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawText(text, x, y, options = {}, targetCtx) {
    const ctx = targetCtx || this.ctx;
    const { font = '14px sans-serif', color = '#fff', align = 'left', baseline = 'alphabetic', shadow = false, shadowColor = 'rgba(0,0,0,0.8)', shadowBlur = 3, shadowOffsetX = 0, shadowOffsetY = 1 } = options;
    ctx.save();
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (shadow) { ctx.shadowColor = shadowColor; ctx.shadowBlur = shadowBlur; ctx.shadowOffsetX = shadowOffsetX; ctx.shadowOffsetY = shadowOffsetY; }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  drawRoundedRect(x, y, w, h, r, fill = false, stroke = false, targetCtx) {
    const ctx = targetCtx || this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }
}

// ─── Main Renderer Adapter ───────────────────────────────────────────────────

/**
 * Renderer adapter that tries WebGL first, falls back to Canvas 2D.
 * Maintains the same public API as the original Canvas 2D renderer
 * so Game.js and other modules need no changes.
 * @export {Renderer}
 */
export class Renderer {
  /**
   * @param {import('./Game.js').Game} game - The game instance.
   */
  constructor(game) {
    this.game = game;
    this.canvas = game.canvas;
    this.ctx = game.ctx;
    this.W = game.W;
    this.H = game.H;

    // Try WebGL first
    /** @type {boolean} */
    this.useWebGL = false;
    /** @type {WebGLRenderer|null} */
    this.webgl = null;
    /** @type {CanvasFallbackRenderer|null} */
    this.canvasRenderer = null;

    try {
      this.webgl = new WebGLRenderer(game.canvas);
      this.webgl.init();
      this.webgl.updateProjection(this.W, this.H);
      this.useWebGL = true;
      console.log('[Renderer] WebGL 2D renderer initialized successfully.');
    } catch (e) {
      console.warn('[Renderer] WebGL unavailable, falling back to Canvas 2D:', e.message);
      this.canvasRenderer = new CanvasFallbackRenderer(game.canvas);
      this.canvasRenderer.setGame(game);
      this.useWebGL = false;
    }

    // Animation phase
    this.envPhase = 0;
  }

  // ─── Core API (matches original Renderer) ──────────────────────────────────

  /** Clear the screen. */
  clear() {
    if (this.useWebGL) {
      // WebGL clear happens in beginFrame
    } else {
      this.canvasRenderer.clear();
    }
  }

  /** Render the full game scene. */
  renderGame() {
    if (this.useWebGL) {
      this._renderGameWebGL();
    } else {
      this.canvasRenderer.renderGame();
    }
  }

  /**
   * WebGL game rendering pipeline.
   */
  _renderGameWebGL() {
    const g = this.game;
    const cam = g.camera;
    const area = g.state.area;
    this.envPhase += 0.008;

    // Begin frame
    this.webgl.beginFrame(cam);

    // 1. Background (procedural shader)
    this.webgl.renderAreaBackground(area);

    // 2. Collect and Y-sort entities
    const entities = this._collectEntities();
    entities.sort((a, b) => (a.y || 0) - (b.y || 0));

    for (const ent of entities) {
      if (!cam || cam.isInView(ent.x || 0, ent.y || 0, 60)) {
        const sp = cam ? cam.worldToScreen(ent.x || 0, ent.y || 0) : { x: ent.x || 0, y: ent.y || 0 };
        if (ent.type === 'player') {
          this.webgl.renderPlayer(ent, sp.x, sp.y, g.frameCount);
        } else if (ent.type === 'npc') {
          this.webgl.renderNPC(ent, sp.x, sp.y, g.frameCount);
        } else {
          this.webgl.renderEntity(ent, sp.x, sp.y);
        }
      }
    }

    // 3. Particles (GPU-accelerated)
    this.webgl.renderParticles(g.state.particles, 0.016);

    // 4. End frame (flush + post-processing)
    this.webgl.endFrame();

    // 5. HUD overlay (Canvas 2D on top for crisp text)
    this.webgl.renderHUD(this.ctx, g.state, this.W, this.H);
  }

  /**
   * Collect all renderable entities.
   * @returns {Array<Object>}
   */
  _collectEntities() {
    const out = [];
    out.push({ ...this.game.state.player, type: 'player' });
    for (const op of this.game.state.onlinePlayers) {
      out.push({ ...op, type: 'player' });
    }
    for (const npc of this.game.state.npcs) {
      out.push({ ...npc, type: 'npc' });
    }
    return out;
  }

  // ─── Screen Renderers ──────────────────────────────────────────────────────

  /** Render landing screen. */
  renderLanding() {
    if (this.useWebGL) {
      this.webgl.beginFrame(null);
      this.webgl.renderLanding(this.ctx, this.W, this.H);
      this.webgl.endFrame();
    } else {
      this.canvasRenderer.renderLanding();
    }
  }

  /** Render character select screen. */
  renderCharSelect() {
    if (this.useWebGL) {
      this.webgl.beginFrame(null);
      this.webgl.renderCharSelect(this.ctx, this.W, this.H, this.game.state.player);
      this.webgl.endFrame();
    } else {
      this.canvasRenderer.renderCharSelect();
    }
  }

  /** Render minigame overlay. */
  renderMinigame() {
    if (this.useWebGL) {
      this._renderGameWebGL();
      this.ctx.fillStyle = 'rgba(0,0,0,0.35)';
      this.ctx.fillRect(0, 0, this.W, this.H);
      this.webgl._drawTextCanvas(this.ctx, 'Minigame Active', this.W / 2, this.H / 2, {
        align: 'center', font: 'bold 24px sans-serif', color: '#ffd700', shadow: true
      });
    } else {
      this.canvasRenderer.renderMinigame();
    }
  }

  /** Render settings screen. */
  renderSettings() {
    if (this.useWebGL) {
      this.webgl.beginFrame(null);
      this.webgl.renderSettings(this.ctx, this.W, this.H, this.game.state.settings);
      this.webgl.endFrame();
    } else {
      this.canvasRenderer.renderSettings();
    }
  }

  // ─── Per-Entity Rendering (for external use) ───────────────────────────────

  /**
   * Render a single entity.
   * @param {Object} entity
   * @param {number} x
   * @param {number} y
   * @param {number} [scale=1]
   * @param {CanvasRenderingContext2D} [targetCtx]
   */
  renderEntity(entity, x, y, scale = 1, targetCtx) {
    if (this.useWebGL) {
      // Entity is batched in renderGame; this is for standalone use
      this.webgl.beginFrame(null);
      this.webgl.renderEntity(entity, x, y, scale);
      this.webgl.flush();
    } else {
      this.canvasRenderer.renderEntity(entity, x, y, scale, targetCtx);
    }
  }

  /**
   * Render a player.
   * @param {Object} player
   * @param {number} x
   * @param {number} y
   * @param {CanvasRenderingContext2D} [targetCtx]
   */
  renderPlayer(player, x, y, targetCtx) {
    if (this.useWebGL) {
      this.webgl.renderPlayer(player, x, y, this.game.frameCount);
    } else {
      this.canvasRenderer.renderPlayer(player, x, y, targetCtx);
    }
  }

  /**
   * Render an NPC.
   * @param {Object} npc
   * @param {number} x
   * @param {number} y
   * @param {CanvasRenderingContext2D} [targetCtx]
   */
  renderNPC(npc, x, y, targetCtx) {
    if (this.useWebGL) {
      this.webgl.renderNPC(npc, x, y, this.game.frameCount);
    } else {
      this.canvasRenderer.renderNPC(npc, x, y, targetCtx);
    }
  }

  /**
   * Render particles.
   * @param {Array<Object>} particles
   * @param {CanvasRenderingContext2D} [targetCtx]
   */
  renderParticles(particles, targetCtx) {
    if (this.useWebGL) {
      // Particles rendered in renderGame pipeline
    } else {
      this.canvasRenderer.renderParticles(particles, targetCtx);
    }
  }

  /**
   * Render HUD.
   * @param {CanvasRenderingContext2D} [targetCtx]
   */
  renderHUD(targetCtx) {
    if (this.useWebGL) {
      this.webgl.renderHUD(this.ctx, this.game.state, this.W, this.H);
    } else {
      this.canvasRenderer.renderHUD(targetCtx);
    }
  }

  /**
   * Render an area background.
   * @param {string} areaId
   * @param {CanvasRenderingContext2D} [targetCtx]
   */
  renderArea(areaId, targetCtx) {
    if (this.useWebGL) {
      this.webgl.renderAreaBackground(areaId);
    } else {
      this.canvasRenderer.renderArea(areaId, targetCtx);
    }
  }

  // ─── Utility (forwarded to active renderer) ────────────────────────────────

  /** @param {number} cx @param {number} cy @param {number} w @param {number} h @param {number} alpha */
  drawShadow(cx, cy, w, h, alpha = 0.3, targetCtx) {
    if (!this.useWebGL) {
      this.canvasRenderer.drawShadow(cx, cy, w, h, alpha, targetCtx);
    }
  }

  /** @param {string} text @param {number} x @param {number} y @param {Object} options */
  drawText(text, x, y, options = {}, targetCtx) {
    if (!this.useWebGL) {
      this.canvasRenderer.drawText(text, x, y, options, targetCtx);
    }
  }

  /** @param {number} x @param {number} y @param {number} w @param {number} h @param {number} r */
  drawRoundedRect(x, y, w, h, r, fill = false, stroke = false, targetCtx) {
    if (!this.useWebGL) {
      this.canvasRenderer.drawRoundedRect(x, y, w, h, r, fill, stroke, targetCtx);
    }
  }

  /** Apply post-processing effects. */
  applyPostEffects(ctx) {
    if (!this.useWebGL) {
      this.canvasRenderer.applyPostEffects(ctx);
    }
  }

  // ─── WebGL Access (for advanced users) ─────────────────────────────────────

  /**
   * Get the underlying WebGL renderer, if active.
   * @returns {WebGLRenderer|null}
   */
  getWebGL() {
    return this.webgl;
  }

  /**
   * Check if WebGL is active.
   * @returns {boolean}
   */
  isUsingWebGL() {
    return this.useWebGL;
  }

  // ─── Resize ────────────────────────────────────────────────────────────────

  /**
   * Handle canvas resize.
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    this.W = width;
    this.H = height;
    if (this.useWebGL && this.webgl) {
      this.webgl.resize(width, height);
    }
    if (this.canvasRenderer) {
      this.canvasRenderer.W = width;
      this.canvasRenderer.H = height;
      this.canvasRenderer._initPostBuffer();
    }
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  /** Destroy all GPU resources. */
  destroy() {
    if (this.webgl) {
      this.webgl.destroy();
      this.webgl = null;
    }
    this.useWebGL = false;
  }
}
