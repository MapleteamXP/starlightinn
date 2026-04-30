/**
 * YSortRenderer.js -- v6.0
 * Sprite-based rendering with proper isometric depth (Y-sort).
 * Replaces IsoRenderer for world rendering in v6.0.
 */

export class YSortRenderer {
  constructor(isoMath, tilemap, spriteGenerator, spriteCache) {
    this.isoMath = isoMath;
    this.tilemap = tilemap;
    this.spriteGenerator = spriteGenerator;
    this.spriteCache = spriteCache;
    this.entities = [];
    this.particles = [];
    this.cameraOffset = { x: 0, y: 0 };
    this._debug = false;
  }

  /**
   * Register an entity for rendering.
   */
  addEntity(entity) {
    if (!this.entities.includes(entity)) {
      this.entities.push(entity);
    }
  }

  removeEntity(entity) {
    const idx = this.entities.indexOf(entity);
    if (idx >= 0) this.entities.splice(idx, 1);
  }

  /**
   * Add a particle/effect.
   */
  addParticle(p) {
    this.particles.push(p);
  }

  /**
   * Set camera offset (screen px) for culling.
   */
  setCameraOffset(x, y) {
    this.cameraOffset.x = x;
    this.cameraOffset.y = y;
  }

  /**
   * Render the entire world to the given context.
   */
  render(ctx, pixelPerfectScaler = null) {
    if (pixelPerfectScaler) pixelPerfectScaler.apply(ctx);

    const cw = ctx.canvas.width;
    const ch = ctx.canvas.height;

    // Build render list: tiles + entities + particles
    const renderList = [];

    // Gather visible tiles
    const tileRange = this._getVisibleTileRange(cw, ch);
    for (let y = tileRange.y0; y <= tileRange.y1; y++) {
      for (let x = tileRange.x0; x <= tileRange.x1; x++) {
        const tile = this.tilemap.get(x, y);
        if (!tile) continue;
        const screen = this.isoMath.tileToScreen(x, y);
        renderList.push({
          type: 'tile',
          x, y,
          screenX: screen.x,
          screenY: screen.y,
          sortY: screen.y,
          data: tile,
        });
      }
    }

    // Gather entities
    for (const ent of this.entities) {
      const screen = this.isoMath.tileToScreen(ent.x, ent.y);
      renderList.push({
        type: 'entity',
        sortY: screen.y + (ent.heightOffset || 0),
        screenX: ent.renderX ?? screen.x,
        screenY: ent.renderY ?? screen.y,
        data: ent,
      });
    }

    // Gather particles
    for (const p of this.particles) {
      renderList.push({
        type: 'particle',
        sortY: p.y,
        screenX: p.x,
        screenY: p.y,
        data: p,
      });
    }

    // Y-sort: higher sortY draws last (on top)
    renderList.sort((a, b) => a.sortY - b.sortY);

    // Draw in sorted order
    ctx.save();
    ctx.translate(this.cameraOffset.x, this.cameraOffset.y);

    for (const item of renderList) {
      switch (item.type) {
        case 'tile':
          this._drawTile(ctx, item);
          break;
        case 'entity':
          this._drawEntity(ctx, item);
          break;
        case 'particle':
          this._drawParticle(ctx, item);
          break;
      }
    }

    ctx.restore();

    // Remove dead particles
    this.particles = this.particles.filter(p => p.life > 0);
  }

  _drawTile(ctx, item) {
    const { screenX, screenY, data } = item;
    const key = `tile:${data.type}:${data.variant}`;
    let sprite = this.spriteCache?.get(key);
    if (!sprite) {
      sprite = this.spriteGenerator?.generateFloorTile(data.variant);
      this.spriteCache?.set(key, sprite);
    }
    if (sprite) {
      const dx = screenX - sprite.width / 2;
      const dy = screenY - sprite.height / 2;
      ctx.drawImage(sprite, dx, dy);
    }
    if (this._debug) {
      ctx.strokeStyle = 'rgba(255,0,0,0.3)';
      ctx.strokeRect(screenX - 32, screenY - 16, 64, 32);
    }
  }

  _drawEntity(ctx, item) {
    const { screenX, screenY, data } = item;
    const key = `avatar:${data.id || 'player'}:${data.facing || 's'}:0`;
    let sprite = this.spriteCache?.get(key);
    if (!sprite) {
      sprite = this.spriteGenerator?.generateAvatarSprite(data, data.facing || 's', 0);
      this.spriteCache?.set(key, sprite);
    }
    if (sprite) {
      const dx = screenX - sprite.width / 2;
      const dy = screenY - sprite.height;
      ctx.drawImage(sprite, dx, dy);
    }
    // Nameplate
    if (data.name) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      const tw = ctx.measureText(data.name).width;
      ctx.fillRect(screenX - tw / 2 - 4, screenY - sprite.height - 10, tw + 8, 14);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(data.name, screenX, screenY - sprite.height - 1);
    }
  }

  _drawParticle(ctx, item) {
    const { screenX, screenY, data } = item;
    ctx.globalAlpha = data.alpha ?? 1;
    ctx.fillStyle = data.color || '#FFD700';
    ctx.beginPath();
    ctx.arc(screenX, screenY, data.size || 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  _getVisibleTileRange(cw, ch) {
    // Conservative overestimate for visible tiles
    const padTiles = 2;
    const cx = -this.cameraOffset.x + cw / 2;
    const cy = -this.cameraOffset.y + ch / 2;
    const centerTile = this.isoMath.screenToTile(cx, cy);
    const visibleW = Math.ceil(cw / this.isoMath.tileW) + padTiles * 2;
    const visibleH = Math.ceil(ch / this.isoMath.tileH) + padTiles * 2;
    const tx0 = Math.max(0, Math.floor(centerTile.x - visibleW / 2));
    const ty0 = Math.max(0, Math.floor(centerTile.y - visibleH / 2));
    const tx1 = Math.min(this.tilemap.width - 1, Math.floor(centerTile.x + visibleW / 2));
    const ty1 = Math.min(this.tilemap.height - 1, Math.floor(centerTile.y + visibleH / 2));
    return { x0: tx0, y0: ty0, x1: tx1, y1: ty1 };
  }

  setDebug(v) {
    this._debug = v;
  }

  invalidateCache() {
    this.spriteCache?.clear();
  }
}

export default YSortRenderer;
