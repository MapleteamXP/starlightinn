/**
 * @file HitBox.js
 * @description Axis-aligned bounding box (AABB) definition with collision type,
 * intersection tests, point containment, and debug visualization.
 * Designed for integration with the CollisionSystem and pixel-art UI.
 *
 * @module collision/HitBox
 * @version 8.0.0
 */

// ============================================================
// HITBOX CLASS
// ============================================================

/**
 * @class HitBox
 * @description A collision bounding box with type, intersection, and debug draw.
 *
 * Types:
 * - 'solid'     — fully blocks movement
 * - 'trigger'   — no physical response, fires callbacks on overlap
 * - 'platform'  — solid only when landing from above (one-way up)
 * - 'one_way'   — solid only from the specified direction
 */
export default class HitBox {
  /**
   * Creates a new HitBox.
   * @param {number} x — Offset from entity origin
   * @param {number} y — Offset from entity origin
   * @param {number} w — Width in pixels
   * @param {number} h — Height in pixels
   * @param {string} [type='solid'] — One of 'solid' | 'trigger' | 'platform' | 'one_way'
   * @param {string} [oneWayDir='up'] — For 'one_way': 'up' | 'down' | 'left' | 'right'
   * @param {string} [id=''] — Optional identifier
   */
  constructor(x, y, w, h, type = 'solid', oneWayDir = 'up', id = '') {
    /** @type {number} X offset from entity origin in pixels */
    this.x = x;
    /** @type {number} Y offset from entity origin in pixels */
    this.y = y;
    /** @type {number} Width in pixels */
    this.w = w;
    /** @type {number} Height in pixels */
    this.h = h;
    /** @type {string} Collision response type */
    this.type = type;
    /** @type {string} Allowed approach direction for one-way */
    this.oneWayDir = oneWayDir;
    /** @type {string} Optional identifier */
    this.id = id;
    /** @type {boolean} Enabled state */
    this.enabled = true;
    /** @type {Set<string>} Tag set for filtering */
    this.tags = new Set();
    /** @type {Object|null} Arbitrary metadata */
    this.data = null;
  }

  // ── Geometry ──────────────────────────────────────────────

  /**
   * Returns the absolute world bounds when attached to an entity.
   * @param {Object} entity — Must have {x, y}
   * @returns {{x: number, y: number, w: number, h: number}}
   */
  getWorldBounds(entity) {
    return {
      x: (entity?.x ?? 0) + this.x,
      y: (entity?.y ?? 0) + this.y,
      w: this.w,
      h: this.h,
    };
  }

  /**
   * Returns the centre point of the hitbox.
   * @param {Object} [entity]
   * @returns {{x: number, y: number}}
   */
  getCentre(entity) {
    const b = this.getWorldBounds(entity);
    return {
      x: b.x + b.w / 2,
      y: b.y + b.h / 2,
    };
  }

  /**
   * Returns the four corner points.
   * @param {Object} [entity]
   * @returns {{tl:{x:number,y:number},tr:{x:number,y:number},bl:{x:number,y:number},br:{x:number,y:number}}}
   */
  getCorners(entity) {
    const b = this.getWorldBounds(entity);
    return {
      tl: { x: b.x, y: b.y },
      tr: { x: b.x + b.w, y: b.y },
      bl: { x: b.x, y: b.y + b.h },
      br: { x: b.x + b.w, y: b.y + b.h },
    };
  }

  // ── Intersection Tests ─────────────────────────────────────

  /**
   * AABB intersection test against another HitBox.
   * @param {HitBox} other
   * @param {Object} [thisEntity]
   * @param {Object} [otherEntity]
   * @returns {boolean}
   */
  intersects(other, thisEntity, otherEntity) {
    if (!this.enabled || !other.enabled) return false;
    const a = this.getWorldBounds(thisEntity);
    const b = other.getWorldBounds(otherEntity);
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  /**
   * AABB intersection test against a raw rectangle.
   * @param {{x:number,y:number,w:number,h:number}} rect
   * @param {Object} [thisEntity]
   * @returns {boolean}
   */
  intersectsRect(rect, thisEntity) {
    if (!this.enabled) return false;
    const a = this.getWorldBounds(thisEntity);
    return (
      a.x < rect.x + rect.w &&
      a.x + a.w > rect.x &&
      a.y < rect.y + rect.h &&
      a.y + a.h > rect.y
    );
  }

  /**
   * Point-in-rectangle test.
   * @param {number} px
   * @param {number} py
   * @param {Object} [entity]
   * @returns {boolean}
   */
  containsPoint(px, py, entity) {
    if (!this.enabled) return false;
    const b = this.getWorldBounds(entity);
    return px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h;
  }

  /**
   * Circle intersection test.
   * @param {number} cx — Circle centre X
   * @param {number} cy — Circle centre Y
   * @param {number} radius
   * @param {Object} [entity]
   * @returns {boolean}
   */
  intersectsCircle(cx, cy, radius, entity) {
    if (!this.enabled) return false;
    const b = this.getWorldBounds(entity);
    // Find closest point on AABB to circle centre
    const closestX = Math.max(b.x, Math.min(cx, b.x + b.w));
    const closestY = Math.max(b.y, Math.min(cy, b.y + b.h));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy < radius * radius;
  }

  /**
   * Line-segment intersection test (Liang-Barsky).
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @param {Object} [entity]
   * @returns {boolean}
   */
  intersectsLine(x1, y1, x2, y2, entity) {
    if (!this.enabled) return false;
    const b = this.getWorldBounds(entity);

    const dx = x2 - x1;
    const dy = y2 - y1;
    const p = [-dx, dx, -dy, dy];
    const q = [x1 - b.x, b.x + b.w - x1, y1 - b.y, b.y + b.h - y1];

    let t0 = 0;
    let t1 = 1;
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) {
        if (q[i] < 0) return false;
      } else {
        const t = q[i] / p[i];
        if (p[i] < 0) {
          t0 = Math.max(t0, t);
        } else {
          t1 = Math.min(t1, t);
        }
      }
      if (t0 > t1) return false;
    }
    return true;
  }

  // ── MTV (Minimum Translation Vector) ────────────────────────

  /**
   * Computes the MTV to separate this HitBox from another.
   * @param {HitBox} other
   * @param {Object} [thisEntity]
   * @param {Object} [otherEntity]
   * @returns {{nx: number, ny: number, penetration: number}|null}
   */
  getMTV(other, thisEntity, otherEntity) {
    if (!this.enabled || !other.enabled) return null;
    const a = this.getWorldBounds(thisEntity);
    const b = other.getWorldBounds(otherEntity);

    const overlapLeft = (b.x + b.w) - a.x;
    const overlapRight = (a.x + a.w) - b.x;
    const overlapTop = (b.y + b.h) - a.y;
    const overlapBottom = (a.y + a.h) - b.y;

    if (overlapLeft <= 0 || overlapRight <= 0 || overlapTop <= 0 || overlapBottom <= 0) {
      return null;
    }

    const left = overlapLeft < overlapRight;
    const top = overlapTop < overlapBottom;
    const minX = left ? -overlapLeft : overlapRight;
    const minY = top ? -overlapTop : overlapBottom;

    if (Math.abs(minX) < Math.abs(minY)) {
      return { nx: left ? -1 : 1, ny: 0, penetration: Math.abs(minX) };
    } else {
      return { nx: 0, ny: top ? -1 : 1, penetration: Math.abs(minY) };
    }
  }

  /**
   * Computes the MTV to separate from a raw rectangle.
   * @param {{x:number,y:number,w:number,h:number}} rect
   * @param {Object} [thisEntity]
   * @returns {{nx: number, ny: number, penetration: number}|null}
   */
  getMTVRect(rect, thisEntity) {
    if (!this.enabled) return null;
    const a = this.getWorldBounds(thisEntity);

    const overlapLeft = (rect.x + rect.w) - a.x;
    const overlapRight = (a.x + a.w) - rect.x;
    const overlapTop = (rect.y + rect.h) - a.y;
    const overlapBottom = (a.y + a.h) - rect.y;

    if (overlapLeft <= 0 || overlapRight <= 0 || overlapTop <= 0 || overlapBottom <= 0) {
      return null;
    }

    const left = overlapLeft < overlapRight;
    const top = overlapTop < overlapBottom;
    const minX = left ? -overlapLeft : overlapRight;
    const minY = top ? -overlapTop : overlapBottom;

    if (Math.abs(minX) < Math.abs(minY)) {
      return { nx: left ? -1 : 1, ny: 0, penetration: Math.abs(minX) };
    } else {
      return { nx: 0, ny: top ? -1 : 1, penetration: Math.abs(minY) };
    }
  }

  // ── One-Way Logic ───────────────────────────────────────────

  /**
   * Determines whether a one-way platform should block movement.
   * @param {Object} mover — Entity with {prevX, prevY, velocityX?, velocityY?}
   * @param {Object} [thisEntity]
   * @returns {boolean}
   */
  canBlockOneWay(mover, thisEntity) {
    if (this.type !== 'one_way' && this.type !== 'platform') return true;
    if (!this.enabled) return false;

    const dir = this.oneWayDir;
    const b = this.getWorldBounds(thisEntity);
    const prevY = mover.prevY ?? mover.y;
    const prevX = mover.prevX ?? mover.x;

    switch (dir) {
      case 'up':
        // Only block if mover was above the platform before
        return (prevY + (mover.h ?? 0)) <= b.y;
      case 'down':
        return prevY >= b.y + b.h;
      case 'left':
        return (prevX + (mover.w ?? 0)) <= b.x;
      case 'right':
        return prevX >= b.x + b.w;
      default:
        return true;
    }
  }

  // ── Mutators ────────────────────────────────────────────────

  /**
   * Moves the hitbox offset.
   * @param {number} dx
   * @param {number} dy
   * @returns {HitBox} This (chainable)
   */
  move(dx, dy) {
    this.x += dx;
    this.y += dy;
    return this;
  }

  /**
   * Resizes the hitbox.
   * @param {number} w
   * @param {number} h
   * @returns {HitBox} This (chainable)
   */
  resize(w, h) {
    this.w = w;
    this.h = h;
    return this;
  }

  /**
   * Sets the collision type.
   * @param {string} type
   * @returns {HitBox} This (chainable)
   */
  setType(type) {
    this.type = type;
    return this;
  }

  /**
   * Adds a tag.
   * @param {string} tag
   * @returns {HitBox} This (chainable)
   */
  addTag(tag) {
    this.tags.add(tag);
    return this;
  }

  /**
   * Removes a tag.
   * @param {string} tag
   * @returns {HitBox} This (chainable)
   */
  removeTag(tag) {
    this.tags.delete(tag);
    return this;
  }

  /**
   * Checks if a tag is present.
   * @param {string} tag
   * @returns {boolean}
   */
  hasTag(tag) {
    return this.tags.has(tag);
  }

  /**
   * Clones this HitBox.
   * @returns {HitBox}
   */
  clone() {
    const h = new HitBox(this.x, this.y, this.w, this.h, this.type, this.oneWayDir, this.id);
    h.enabled = this.enabled;
    for (const t of this.tags) h.tags.add(t);
    h.data = this.data;
    return h;
  }

  // ── Debug Visualization ─────────────────────────────────────

  /**
   * Draws the hitbox outline on a canvas context.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} [entity]
   * @param {string} [color='#00FF00']
   * @param {boolean} [fill=false]
   * @param {boolean} [drawCentre=false]
   */
  drawDebug(ctx, entity, color = '#00FF00', fill = false, drawCentre = false) {
    if (!this.enabled) return;
    const b = this.getWorldBounds(entity);

    ctx.save();
    if (fill) {
      ctx.fillStyle = color + '22';
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);

    // Type label
    ctx.fillStyle = color;
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(this.type[0].toUpperCase(), b.x + 1, b.y + 1);

    if (drawCentre) {
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      ctx.beginPath();
      ctx.moveTo(cx - 3, cy);
      ctx.lineTo(cx + 3, cy);
      ctx.moveTo(cx, cy - 3);
      ctx.lineTo(cx, cy + 3);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Draws a fancy debug outline with type-specific colours.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} [entity]
   */
  drawDebugStyled(ctx, entity) {
    const colorMap = {
      solid: '#00FF00',
      trigger: '#FFFF00',
      platform: '#00FFFF',
      one_way: '#FF8800',
    };
    this.drawDebug(ctx, entity, colorMap[this.type] ?? '#FFFFFF', true, true);
  }

  // ── Serialisation ───────────────────────────────────────────

  /**
   * Serialises to a plain object.
   * @returns {Object}
   */
  toJSON() {
    return {
      x: this.x, y: this.y, w: this.w, h: this.h,
      type: this.type, oneWayDir: this.oneWayDir,
      id: this.id, enabled: this.enabled,
      tags: Array.from(this.tags),
    };
  }

  /**
   * Restores from a plain object.
   * @param {Object} data
   * @returns {HitBox}
   */
  static fromJSON(data) {
    const h = new HitBox(data.x, data.y, data.w, data.h, data.type, data.oneWayDir, data.id);
    h.enabled = data.enabled ?? true;
    if (data.tags) {
      for (const t of data.tags) h.tags.add(t);
    }
    return h;
  }

  // ── Static Helpers ────────────────────────────────────────

  /**
   * Creates a HitBox from an entity's width/height, centred.
   * @param {number} w
   * @param {number} h
   * @param {string} [type='solid']
   * @returns {HitBox}
   */
  static fromSize(w, h, type = 'solid') {
    return new HitBox(-w / 2, -h / 2, w, h, type);
  }

  /**
   * Creates a HitBox from top-left corner.
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {string} [type='solid']
   * @returns {HitBox}
   */
  static fromTopLeft(x, y, w, h, type = 'solid') {
    return new HitBox(x, y, w, h, type);
  }

  /**
   * Creates a zero-size HitBox as a placeholder.
   * @returns {HitBox}
   */
  static empty() {
    return new HitBox(0, 0, 0, 0, 'trigger');
  }

  /**
   * Creates a circular approximating HitBox (square bounding).
   * @param {number} radius
   * @param {string} [type='solid']
   * @returns {HitBox}
   */
  static fromCircle(radius, type = 'solid') {
    const s = radius * 2;
    return new HitBox(-radius, -radius, s, s, type);
  }
}

// ============================================================
// HITBOX GROUP (multi-part colliders)
// ============================================================

/**
 * @class HitBoxGroup
 * @description A collection of HitBoxes treated as a single compound collider.
 */
export class HitBoxGroup {
  /**
   * @param {Array<HitBox>} [boxes=[]]
   */
  constructor(boxes = []) {
    /** @type {Array<HitBox>} */
    this.boxes = [...boxes];
  }

  /**
   * @param {HitBox} box
   * @returns {HitBoxGroup}
   */
  add(box) {
    this.boxes.push(box);
    return this;
  }

  /**
   * @param {HitBox} other
   * @param {Object} [thisEntity]
   * @param {Object} [otherEntity]
   * @returns {boolean}
   */
  intersects(other, thisEntity, otherEntity) {
    for (const box of this.boxes) {
      if (box.intersects(other, thisEntity, otherEntity)) return true;
    }
    return false;
  }

  /**
   * @param {number} px
   * @param {number} py
   * @param {Object} [entity]
   * @returns {boolean}
   */
  containsPoint(px, py, entity) {
    for (const box of this.boxes) {
      if (box.containsPoint(px, py, entity)) return true;
    }
    return false;
  }

  /**
   * @param {number} cx
   * @param {number} cy
   * @param {number} radius
   * @param {Object} [entity]
   * @returns {boolean}
   */
  intersectsCircle(cx, cy, radius, entity) {
    for (const box of this.boxes) {
      if (box.intersectsCircle(cx, cy, radius, entity)) return true;
    }
    return false;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} [entity]
   */
  drawDebug(ctx, entity) {
    const colors = ['#00FF00', '#00CC00', '#009900', '#006600'];
    for (let i = 0; i < this.boxes.length; i++) {
      this.boxes[i].drawDebug(ctx, entity, colors[i % colors.length], true, true);
    }
  }
}
