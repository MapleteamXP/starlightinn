/**
 * NPC.js
 * ======
 * Non-player character behaviors, dialogue systems, and rendering.
 * Supports idle drift, waypoint wandering, stationary sitting,
 * interaction bubbles, and hint-emitting dialogue.
 *
 * @module world/NPC
 */

import { getArea } from './AreaData.js';

// ------------------------------------------------------------------
// NPC — single non-player character
// ------------------------------------------------------------------

export class NPC {
  /**
   * @param {Object} data — Raw NPC definition from AreaData.
   * @param {string} data.id
   * @param {string} data.name
   * @param {string} data.emoji
   * @param {number} data.x     Normalized position [0..1].
   * @param {number} data.y     Normalized position [0..1].
   * @param {string} data.color Hex color for name tag / highlight.
   * @param {string[]} [data.dialogue=[]]
   * @param {string} [data.behavior='idle'] — 'idle'|'wander'|'sit'
   * @param {number} [data.moveRange=0.1]  Max drift radius in normalized units.
   */
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.emoji = data.emoji;
    this.homeX = data.x;
    this.homeY = data.y;
    this.x = data.x;
    this.y = data.y;
    this.color = data.color || '#ffffff';
    this.dialogue = data.dialogue || [];
    this.behavior = data.behavior || 'idle';
    this.moveRange = data.moveRange ?? 0.1;

    this.timer = 0;
    this.nextMoveIn = 2 + Math.random() * 4; // seconds until next movement
    this.targetX = this.x;
    this.targetY = this.y;
    this.speed = 0.008; // lerp factor per frame (~0.8% distance)

    // Dialogue state
    this.speaking = false;
    this.speakTimer = 0;
    this.currentLine = '';
    this.speakDuration = 4; // seconds a bubble stays visible
    this.talkedBefore = false;
    this.dialogueIndex = 0;
  }

  // ================================================================
  // Update
  // ================================================================

  /**
   * Advance NPC simulation: movement, timers, idle animations.
   * @param {number} dt — Delta time in seconds.
   */
  update(dt) {
    this.timer += dt;

    // --- Movement behaviors ---
    if (this.behavior === 'idle') {
      if (this.timer >= this.nextMoveIn) {
        this.timer = 0;
        this.nextMoveIn = 2 + Math.random() * 5;
        const rx = (Math.random() - 0.5) * 2 * this.moveRange;
        const ry = (Math.random() - 0.5) * 2 * this.moveRange;
        this.targetX = Math.max(0.02, Math.min(0.98, this.homeX + rx));
        this.targetY = Math.max(0.02, Math.min(0.98, this.homeY + ry));
      }
    } else if (this.behavior === 'wander') {
      if (this.timer >= this.nextMoveIn) {
        this.timer = 0;
        this.nextMoveIn = 3 + Math.random() * 6;
        const rx = (Math.random() - 0.5) * 2 * this.moveRange;
        const ry = (Math.random() - 0.5) * 2 * this.moveRange;
        this.targetX = Math.max(0.02, Math.min(0.98, this.homeX + rx));
        this.targetY = Math.max(0.02, Math.min(0.98, this.homeY + ry));
      }
    } else if (this.behavior === 'sit') {
      this.targetX = this.homeX;
      this.targetY = this.homeY;
    }

    // Smooth drift toward target
    this.x += (this.targetX - this.x) * this.speed;
    this.y += (this.targetY - this.y) * this.speed;

    // --- Dialogue timer ---
    if (this.speaking) {
      this.speakTimer -= dt;
      if (this.speakTimer <= 0) {
        this.speaking = false;
        this.currentLine = '';
      }
    }
  }

  // ================================================================
  // Dialogue
  // ================================================================

  /**
   * Pick a dialogue line.
   * First-time visitors get sequential lines; repeat visitors get random.
   * @returns {string}
   */
  getDialogue() {
    if (this.dialogue.length === 0) return '...';

    if (!this.talkedBefore) {
      const line = this.dialogue[this.dialogueIndex % this.dialogue.length];
      this.dialogueIndex++;
      if (this.dialogueIndex >= this.dialogue.length) {
        this.talkedBefore = true;
      }
      return line;
    }
    return this.dialogue[Math.floor(Math.random() * this.dialogue.length)];
  }

  /**
   * Triggered when the player interacts with this NPC.
   * Shows a dialogue bubble and may emit a quest hint.
   * @param {Object} player — Player entity (must have x, y, name).
   * @returns {string} The spoken line.
   */
  onInteract(player) {
    const line = this.getDialogue();
    this.speaking = true;
    this.speakTimer = this.speakDuration;
    this.currentLine = line;

    // If the line hints at another area, we could notify quest system.
    const hintKeywords = ['treehouse', 'forest', 'beach', 'cafe', 'library', 'theater', 'garden', 'market', 'arcade', 'island', 'lounge', 'bedroom'];
    const lower = line.toLowerCase();
    for (const kw of hintKeywords) {
      if (lower.includes(kw)) {
        this._emitHint(kw);
        break;
      }
    }

    return line;
  }

  /** @private */
  _emitHint(keyword) {
    // Dispatch a custom event that the quest manager can listen to.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('npc-hint', {
        detail: { npcId: this.id, keyword }
      }));
    }
  }

  // ================================================================
  // Rendering
  // ================================================================

  /**
   * Draw the NPC sprite (emoji), name tag, and optional dialogue bubble.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W — Canvas width.
   * @param {number} H — Canvas height.
   */
  render(ctx, W, H) {
    const cx = this.x * W;
    const cy = this.y * H;
    const baseSize = Math.floor(H * 0.06);

    // Shadow ellipse beneath NPC
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + baseSize * 0.45, baseSize * 0.5, baseSize * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Emoji sprite
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${baseSize}px serif`;
    ctx.fillText(this.emoji, cx, cy);

    // Name tag (small, below sprite)
    const nameSize = Math.max(10, Math.floor(H * 0.018));
    ctx.font = `${nameSize}px sans-serif`;
    const nameWidth = ctx.measureText(this.name).width;
    const tagY = cy + baseSize * 0.65;
    const pad = 4;

    // Tag background
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.roundRect(cx - nameWidth / 2 - pad, tagY - nameSize / 2 - pad,
                  nameWidth + pad * 2, nameSize + pad * 2, 4);
    ctx.fill();

    // Tag text
    ctx.fillStyle = this.color;
    ctx.fillText(this.name, cx, tagY);

    // Dialogue bubble
    if (this.speaking && this.currentLine) {
      this._renderBubble(ctx, W, H, cx, cy - baseSize * 0.7, this.currentLine);
    }
  }

  /** @private */
  _renderBubble(ctx, W, H, x, y, text) {
    const fontSize = Math.max(12, Math.floor(H * 0.022));
    ctx.font = `${fontSize}px sans-serif`;
    const maxWidth = W * 0.3;
    const lines = this._wrapText(ctx, text, maxWidth);
    const lineHeight = fontSize * 1.3;
    const textHeight = lines.length * lineHeight;
    const textWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
    const pad = 10;
    const bw = textWidth + pad * 2;
    const bh = textHeight + pad * 2;

    let bx = x - bw / 2;
    let by = y - bh - 6;

    // Clamp to canvas bounds
    bx = Math.max(8, Math.min(W - bw - 8, bx));
    by = Math.max(8, by);

    // Bubble body
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 8);
    ctx.fill();
    ctx.stroke();

    // Little tail pointing down
    ctx.beginPath();
    ctx.moveTo(x - 6, by + bh);
    ctx.lineTo(x, by + bh + 6);
    ctx.lineTo(x + 6, by + bh);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Text lines
    ctx.fillStyle = '#1a1a2e';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((line, i) => {
      ctx.fillText(line, bx + pad, by + pad + i * lineHeight);
    });
  }

  /** @private Split a string into lines that fit within maxWidth. */
  _wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [text];
  }
}

// ------------------------------------------------------------------
// NPCManager — loads and orchestrates all NPCs in the current area
// ------------------------------------------------------------------

export class NPCManager {
  /**
   * @param {Object} game — Main Game instance.
   */
  constructor(game) {
    this.game = game;
    /** @type {Map<string, NPC>} */
    this.npcs = new Map();
    this.activeAreaId = null;
  }

  /**
   * Instantiate NPCs for a given area.
   * @param {string} areaId
   */
  loadAreaNPCs(areaId) {
    const area = getArea(areaId);
    if (!area) {
      console.warn(`NPCManager: no area data for "${areaId}"`);
      this.npcs.clear();
      this.activeAreaId = null;
      return;
    }

    this.npcs.clear();
    this.activeAreaId = areaId;

    for (const data of area.npcs) {
      const npc = new NPC(data);
      this.npcs.set(data.id, npc);
    }
  }

  /**
   * Update all NPCs.
   * @param {number} dt
   */
  update(dt) {
    for (const npc of this.npcs.values()) {
      npc.update(dt);
    }
  }

  /**
   * Render all NPCs.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W
   * @param {number} H
   */
  render(ctx, W, H) {
    for (const npc of this.npcs.values()) {
      npc.render(ctx, W, H);
    }
  }

  /**
   * Find an NPC within a radius of a point.
   * @param {number} x     Normalized coordinate.
   * @param {number} y     Normalized coordinate.
   * @param {number} [radius=0.05] Search radius in normalized units.
   * @returns {NPC|null}
   */
  getNPCAt(x, y, radius = 0.05) {
    for (const npc of this.npcs.values()) {
      const dx = npc.x - x;
      const dy = npc.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius) {
        return npc;
      }
    }
    return null;
  }

  /**
   * Retrieve a specific NPC by ID.
   * @param {string} id
   * @returns {NPC|undefined}
   */
  getNPC(id) {
    return this.npcs.get(id);
  }

  /**
   * List every NPC currently loaded.
   * @returns {NPC[]}
   */
  getAllNPCs() {
    return Array.from(this.npcs.values());
  }

  /**
   * Count of NPCs in the active area.
   * @returns {number}
   */
  getNPCCount() {
    return this.npcs.size;
  }

  /**
   * Force every NPC to close their dialogue bubble.
   * Useful during area transitions.
   */
  closeAllDialogues() {
    for (const npc of this.npcs.values()) {
      npc.speaking = false;
      npc.currentLine = '';
      npc.speakTimer = 0;
    }
  }
}
