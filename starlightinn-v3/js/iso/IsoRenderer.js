/**
 * @file IsoRenderer.js
 * @description Isometric rendering engine for Starlight Inn v5.0.
 * Handles isometric tile rendering, furniture, avatars, and effects.
 * Coordinates with IsoCamera, IsoDepthSorter, IsoTileset, and IsoFurniture.
 * @module iso/IsoRenderer
 * @version 5.0.0
 */

/**
 * Isometric rendering engine. Draws the entire isometric world including
 * tiles, walls, furniture, avatars, and atmospheric effects.
 * @export {IsoRenderer}
 */
export class IsoRenderer {
  /**
   * @param {import('../engine/Game.js').Game} game - The game instance.
   * @param {import('./IsoMath.js').IsoMath} isoMath - Isometric math instance.
   * @param {import('./IsoCamera.js').IsoCamera} isoCamera - Isometric camera.
   * @param {import('./IsoDepthSorter.js').IsoDepthSorter} depthSorter - Depth sorter.
   * @param {import('./IsoTileset.js').IsoTileset} tileset - Tile definitions.
   * @param {import('./IsoFurniture.js').IsoFurniture} furniture - Furniture catalog.
   * @param {import('./IsoAssetLoader.js').IsoAssetLoader} assetLoader - Asset loader.
   * @param {import('./IsoAreaBackgrounds.js').IsoAreaBackgrounds} areaBackgrounds - Area layouts.
   */
  constructor(game, isoMath, isoCamera, depthSorter, tileset, furniture, assetLoader, areaBackgrounds) {
    this.game = game;
    this.ctx = game.ctx;
    this.W = game.W;
    this.H = game.H;
    this.isoMath = isoMath;
    this.camera = isoCamera;
    this.depthSorter = depthSorter;
    this.tileset = tileset;
    this.furniture = furniture;
    this.assetLoader = assetLoader;
    this.areaBackgrounds = areaBackgrounds;

    /** @type {number} Animation phase counter. */
    this.envPhase = 0;
    /** @type {number} Tile animation frame offset. */
    this.tileAnimOffset = 0;
    /** @type {HTMLCanvasElement|null} Offscreen cache for static tiles. */
    this._tileCache = null;
    /** @type {boolean} Whether cache needs regeneration. */
    this._cacheDirty = true;
    /** @type {Map<string, HTMLCanvasElement>} Procedural sprite cache. */
    this._spriteCache = new Map();
    /** @type {Object|null} Current area layout. */
    this._currentLayout = null;

    this._initCache();
  }

  /**
   * Initialize the offscreen tile cache.
   * @private
   */
  _initCache() {
    this._tileCache = document.createElement('canvas');
    this._tileCache.width = this.W;
    this._tileCache.height = this.H;
  }

  /**
   * Clear the screen and render one complete isometric frame.
   */
  render() {
    this.envPhase += 0.008;
    this.tileAnimOffset += 0.016;
    this.clear();

    const area = this.areaBackgrounds.getCurrent();
    if (!area) {
      this._renderFallback();
      return;
    }

    this._currentLayout = area;

    // 1. Background gradient
    this._renderBackground(area);

    // 2. Build and sort render list
    const renderList = this._buildRenderList(area);
    const sorted = this.depthSorter.sort(renderList);

    // 3. Render tiles
    this._renderTiles(sorted.filter(i => i.type === 'tile'));

    // 4. Render walls
    this._renderWalls(sorted.filter(i => i.type === 'wall'));

    // 5. Render furniture
    this._renderFurnitureItems(sorted.filter(i => i.type === 'furniture'));

    // 6. Render avatars (players + NPCs)
    this._renderAvatars();

    // 7. Render particles
    this._renderParticles();

    // 8. Atmospheric effects
    this._renderAtmosphere(area);

    // 9. Vignette overlay
    this._renderVignette();
  }

  /**
   * Clear the canvas.
   */
  clear() {
    this.ctx.fillStyle = '#0a0a0f';
    this.ctx.fillRect(0, 0, this.W, this.H);
  }

  /**
   * Render the area background gradient.
   * @param {Object} area
   * @private
   */
  _renderBackground(area) {
    const grad = this.ctx.createLinearGradient(0, 0, 0, this.H);
    grad.addColorStop(0, area.bgTop);
    grad.addColorStop(1, area.bgBottom);
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.W, this.H);

    // Draw stars in the upper portion
    this.ctx.save();
    this.ctx.fillStyle = '#fff8e7';
    const starSeed = area.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    for (let i = 0; i < 50; i++) {
      const sx = ((starSeed * 9301 + i * 49297) % 10000 / 10000) * this.W;
      const sy = ((starSeed * 49297 + i * 9301) % 10000 / 10000) * this.H * 0.4;
      const twinkle = Math.sin(this.envPhase * 3 + i) * 0.5 + 0.5;
      this.ctx.globalAlpha = twinkle * 0.8;
      this.ctx.beginPath();
      this.ctx.arc(sx, sy, 1 + twinkle, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  /**
   * Build the complete render list for the current frame.
   * @param {Object} area
   * @returns {Array<Object>}
   * @private
   */
  _buildRenderList(area) {
    const list = [];
    const cols = area.tileCols;
    const rows = area.tileRows;

    // Floor tiles
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        list.push({
          type: 'tile', col: c, row: r, z: 0,
          tileId: area.floorTile
        });
      }
    }

    // Walls
    for (const wall of area.walls) {
      this._addWallTiles(list, wall);
    }

    // Custom tiles
    if (area.customTiles) {
      for (const ct of area.customTiles) {
        list.push({
          type: 'tile', col: ct.col, row: ct.row, z: 0,
          tileId: ct.tile
        });
      }
    }

    // Furniture
    for (const furn of area.furniture) {
      const item = this.furniture.get(furn.type);
      if (item) {
        list.push({
          type: 'furniture',
          col: furn.x,
          row: furn.y,
          z: item.zOffset || 0,
          item: item,
          uid: furn.type
        });
      }
    }

    return list;
  }

  /**
   * Add wall segment tiles to the render list.
   * @param {Array<Object>} list
   * @param {Object} wall
   * @private
   */
  _addWallTiles(list, wall) {
    const dx = Math.sign(wall.col2 - wall.col1);
    const dy = Math.sign(wall.row2 - wall.row1);
    let c = wall.col1;
    let r = wall.row1;

    while (c !== wall.col2 || r !== wall.row2) {
      list.push({
        type: 'wall', col: c, row: r, z: 0,
        tileId: this._currentLayout?.wallTile || 'wall_wood'
      });
      if (c !== wall.col2) c += dx;
      if (r !== wall.row2) r += dy;
    }
    list.push({
      type: 'wall', col: wall.col2, row: wall.row2, z: 0,
      tileId: this._currentLayout?.wallTile || 'wall_wood'
    });
  }

  /**
   * Render floor tiles.
   * @param {Array<Object>} tiles
   * @private
   */
  _renderTiles(tiles) {
    for (const tile of tiles) {
      const screen = this.camera.worldToScreen(
        tile.col * this.isoMath.tileW,
        tile.row * this.isoMath.tileW
      );

      // Skip off-screen tiles
      if (screen.x < -this.isoMath.tileW || screen.x > this.W + this.isoMath.tileW ||
          screen.y < -this.isoMath.tileH * 2 || screen.y > this.H + this.isoMath.tileH * 2) {
        continue;
      }

      this._drawTile(screen.x, screen.y, tile.tileId, tile.col, tile.row);
    }
  }

  /**
   * Draw a single isometric tile diamond.
   * @param {number} sx - Screen X.
   * @param {number} sy - Screen Y.
   * @param {string} tileId - Tile type ID.
   * @param {number} col - Column for variation.
   * @param {number} row - Row for variation.
   * @private
   */
  _drawTile(sx, sy, tileId, col, row) {
    const tile = this.tileset.get(tileId);
    if (!tile) return;

    const cacheKey = `${tileId}_${col % 3}_${row % 3}`;
    if (!this._spriteCache.has(cacheKey)) {
      const color = this.tileset.getVariantColor(tileId);
      const sprite = this.assetLoader.generateTileSprite(
        color, tile.strokeStyle, this.isoMath.tileW, this.isoMath.tileH
      );
      this._spriteCache.set(cacheKey, sprite);
    }

    const sprite = this._spriteCache.get(cacheKey);
    if (sprite) {
      this.ctx.drawImage(
        sprite,
        sx - this.isoMath.halfTileW,
        sy - this.isoMath.halfTileH * 0.5
      );
    }

    // Tile-specific visual details
    if (tile.animated) {
      this.ctx.save();
      this.ctx.globalAlpha = 0.15 + Math.sin(this.tileAnimOffset * 2 + col + row) * 0.08;
      this.ctx.fillStyle = tile.fillStyle;
      this.ctx.fillRect(
        sx - this.isoMath.halfTileW + 4,
        sy - this.isoMath.halfTileH * 0.5 + 4,
        this.isoMath.tileW - 8,
        this.isoMath.tileH - 8
      );
      this.ctx.restore();
    }
  }

  /**
   * Render wall tiles.
   * @param {Array<Object>} walls
   * @private
   */
  _renderWalls(walls) {
    for (const wall of walls) {
      const screen = this.camera.worldToScreen(
        wall.col * this.isoMath.tileW,
        wall.row * this.isoMath.tileW
      );

      if (screen.x < -80 || screen.x > this.W + 80 ||
          screen.y < -80 || screen.y > this.H + 80) {
        continue;
      }

      this._drawWall(screen.x, screen.y, wall.tileId);
    }
  }

  /**
   * Draw a single wall segment.
   * @param {number} sx
   * @param {number} sy
   * @param {string} tileId
   * @private
   */
  _drawWall(sx, sy, tileId) {
    const tile = this.tileset.get(tileId);
    if (!tile) return;

    const cacheKey = `wall_${tileId}`;
    if (!this._spriteCache.has(cacheKey)) {
      const sprite = this.assetLoader.generateWallSprite(
        tile.fillStyle, tile.strokeStyle, this.isoMath.tileW, tile.height
      );
      this._spriteCache.set(cacheKey, sprite);
    }

    const sprite = this._spriteCache.get(cacheKey);
    if (sprite) {
      this.ctx.drawImage(
        sprite,
        sx - this.isoMath.halfTileW,
        sy - tile.height + this.isoMath.halfTileH
      );
    }
  }

  /**
   * Render furniture items.
   * @param {Array<Object>} items
   * @private
   */
  _renderFurnitureItems(items) {
    for (const item of items) {
      const screen = this.camera.worldToScreen(
        item.col * this.isoMath.tileW,
        item.row * this.isoMath.tileW
      );

      if (screen.x < -100 || screen.x > this.W + 100 ||
          screen.y < -100 || screen.y > this.H + 100) {
        continue;
      }

      this._drawFurniture(screen.x, screen.y, item.item);
    }
  }

  /**
   * Draw a single furniture item.
   * @param {number} sx
   * @param {number} sy
   * @param {Object} item
   * @private
   */
  _drawFurniture(sx, sy, item) {
    const w = item.tileW * this.isoMath.tileW * 0.8;
    const h = item.height;

    // Shadow
    this.ctx.save();
    this.ctx.globalAlpha = 0.3;
    this.ctx.fillStyle = '#000';
    this.ctx.beginPath();
    this.ctx.ellipse(sx, sy + this.isoMath.halfTileH, w * 0.4, this.isoMath.halfTileH * 0.4, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // Main body (simplified isometric box)
    const hw = w / 2;
    const hh = this.isoMath.halfTileH;

    // Front face
    this.ctx.fillStyle = item.fillStyle;
    this.ctx.beginPath();
    this.ctx.moveTo(sx - hw, sy - h + hh);
    this.ctx.lineTo(sx + hw, sy - h + hh);
    this.ctx.lineTo(sx + hw, sy + hh);
    this.ctx.lineTo(sx - hw, sy + hh);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.strokeStyle = item.strokeStyle;
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    // Top face
    this.ctx.fillStyle = this._lighten(item.fillStyle, 20);
    this.ctx.beginPath();
    this.ctx.moveTo(sx - hw, sy - h + hh);
    this.ctx.lineTo(sx, sy - h);
    this.ctx.lineTo(sx + hw, sy - h + hh);
    this.ctx.lineTo(sx, sy - h + hh * 2);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // Interaction indicator
    if (item.interactive) {
      this.ctx.save();
      this.ctx.globalAlpha = 0.5 + Math.sin(this.envPhase * 4) * 0.3;
      this.ctx.fillStyle = '#ffd700';
      this.ctx.beginPath();
      this.ctx.arc(sx, sy - h - 8, 3, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  /**
   * Render all avatars (player, online players, NPCs).
   * @private
   */
  _renderAvatars() {
    const entities = [];

    // Local player
    const p = this.game.state.player;
    entities.push({ ...p, type: 'player', isLocal: true });

    // Online players
    for (const op of this.game.state.onlinePlayers) {
      entities.push({ ...op, type: 'player', isLocal: false });
    }

    // NPCs
    for (const npc of this.game.state.npcs) {
      entities.push({ ...npc, type: 'npc' });
    }

    // Sort by isometric depth
    const sorted = this.depthSorter.sortEntities(entities);

    for (const ent of sorted) {
      const screen = this.camera.worldToScreen(ent.x || 0, ent.y || 0);

      if (screen.x < -60 || screen.x > this.W + 60 ||
          screen.y < -60 || screen.y > this.H + 60) {
        continue;
      }

      if (ent.type === 'player') {
        this._renderPlayerAvatar(ent, screen.x, screen.y);
      } else {
        this._renderNPCAvatar(ent, screen.x, screen.y);
      }
    }
  }

  /**
   * Render a player avatar in isometric view.
   * @param {Object} player
   * @param {number} sx
   * @param {number} sy
   * @private
   */
  _renderPlayerAvatar(player, sx, sy) {
    const bob = player.moving ? Math.sin(this.game.frameCount * 0.25) * 2 : 0;
    const size = 40;

    // Shadow
    this.ctx.save();
    this.ctx.globalAlpha = 0.3;
    this.ctx.fillStyle = '#000';
    this.ctx.beginPath();
    this.ctx.ellipse(sx, sy + 10, size * 0.4, 6, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // Avatar body
    this._drawAvatarBody(sx, sy + bob, player, size);

    // Nameplate
    if (this.game.state.settings.showNames && player.name) {
      this._drawNameplate(sx, sy + bob - size * 0.6, player.name, player.isLocal);
    }

    // Online indicator
    if (player.isLocal || player.online) {
      this.ctx.fillStyle = '#4ade80';
      this.ctx.beginPath();
      this.ctx.arc(sx + size * 0.35, sy + bob - size * 0.4, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Gesture
    if (player.gestureId > 0) {
      const gmap = { 1: '\u{1F44B}', 2: '\u{1F483}', 3: '\u{1FA91}', 4: '\u{1F4A4}', 5: '\u{1F602}', 6: '\u{1F622}' };
      this.ctx.font = '14px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(gmap[player.gestureId] || '', sx, sy + bob - size * 0.75);
    }
  }

  /**
   * Render an NPC avatar.
   * @param {Object} npc
   * @param {number} sx
   * @param {number} sy
   * @private
   */
  _renderNPCAvatar(npc, sx, sy) {
    const bob = npc.moving ? Math.sin(this.game.frameCount * 0.2 + (npc.id || 0)) * 2 : 0;
    const size = 36;

    // Shadow
    this.ctx.save();
    this.ctx.globalAlpha = 0.25;
    this.ctx.fillStyle = '#000';
    this.ctx.beginPath();
    this.ctx.ellipse(sx, sy + 8, size * 0.4, 5, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    this._drawAvatarBody(sx, sy + bob, npc, size);

    if (npc.name) {
      this._drawNameplate(sx, sy + bob - size * 0.55, npc.name, false, true);
    }
  }

  /**
   * Draw an avatar body (head + torso).
   * @param {number} x
   * @param {number} y
   * @param {Object} appearance
   * @param {number} size
   * @private
   */
  _drawAvatarBody(x, y, appearance, size) {
    const skinColors = ['#ffe0bd', '#ffcd94', '#eac086', '#d2a56d', '#8d5524'];
    const hairColors = ['#2d2d2d', '#5c3a21', '#d4a574', '#e8c547', '#a33b3b', '#6b4c9a'];
    const outfitColors = ['#5b8c85', '#c75b5b', '#5b7fa8', '#a85ba8', '#8c5b5b', '#d4a45b'];

    const skin = skinColors[appearance.skinColor % skinColors.length] || skinColors[0];
    const hair = hairColors[appearance.hairColor % hairColors.length] || hairColors[0];
    const outfit = outfitColors[appearance.outfitColor % outfitColors.length] || outfitColors[0];

    // Body (outfit)
    this.ctx.fillStyle = outfit;
    this.ctx.beginPath();
    this.ctx.moveTo(x - size * 0.25, y);
    this.ctx.lineTo(x, y - size * 0.15);
    this.ctx.lineTo(x + size * 0.25, y);
    this.ctx.lineTo(x + size * 0.2, y + size * 0.45);
    this.ctx.lineTo(x - size * 0.2, y + size * 0.45);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.strokeStyle = this._darken(outfit, 30);
    this.ctx.lineWidth = 0.5;
    this.ctx.stroke();

    // Head
    this.ctx.fillStyle = skin;
    this.ctx.beginPath();
    this.ctx.arc(x, y - size * 0.2, size * 0.22, 0, Math.PI * 2);
    this.ctx.fill();

    // Hair
    this.ctx.fillStyle = hair;
    this.ctx.beginPath();
    this.ctx.arc(x, y - size * 0.28, size * 0.22, Math.PI * 1.05, Math.PI * 1.95);
    this.ctx.fill();

    // Eyes
    const eyeY = y - size * 0.2;
    const facing = appearance.facing || 'down';
    const eyeOffset = facing === 'left' ? -size * 0.05 : facing === 'right' ? size * 0.05 : 0;
    this.ctx.fillStyle = '#2d2d2d';
    this.ctx.beginPath();
    this.ctx.arc(x - size * 0.06 + eyeOffset, eyeY, size * 0.035, 0, Math.PI * 2);
    this.ctx.arc(x + size * 0.06 + eyeOffset, eyeY, size * 0.035, 0, Math.PI * 2);
    this.ctx.fill();

    // Eye highlights
    this.ctx.fillStyle = '#fff';
    this.ctx.beginPath();
    this.ctx.arc(x - size * 0.04 + eyeOffset, eyeY - 1, size * 0.015, 0, Math.PI * 2);
    this.ctx.arc(x + size * 0.08 + eyeOffset, eyeY - 1, size * 0.015, 0, Math.PI * 2);
    this.ctx.fill();

    // Mouth
    const expression = appearance.expression || 'happy';
    this.ctx.strokeStyle = '#8b5e3c';
    this.ctx.lineWidth = 1;
    this.ctx.lineCap = 'round';
    if (expression === 'happy' || expression === 'laugh') {
      this.ctx.beginPath();
      this.ctx.arc(x + eyeOffset, y - size * 0.1, size * 0.06, 0.1, Math.PI - 0.1);
      this.ctx.stroke();
    } else {
      this.ctx.beginPath();
      this.ctx.moveTo(x - size * 0.04 + eyeOffset, y - size * 0.12);
      this.ctx.lineTo(x + size * 0.04 + eyeOffset, y - size * 0.12);
      this.ctx.stroke();
    }
  }

  /**
   * Draw a nameplate above a character.
   * @param {number} x
   * @param {number} y
   * @param {string} name
   * @param {boolean} isLocal
   * @param {boolean} isNPC
   * @private
   */
  _drawNameplate(x, y, name, isLocal = false, isNPC = false) {
    this.ctx.save();
    this.ctx.font = isNPC ? '10px sans-serif' : 'bold 11px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'bottom';
    const tw = this.ctx.measureText(name).width;
    const pw = tw + 10;
    const ph = 16;

    // Background
    this.ctx.fillStyle = isLocal ? 'rgba(91, 140, 133, 0.7)' : 'rgba(20, 20, 30, 0.65)';
    this.ctx.beginPath();
    this.ctx.roundRect(x - pw / 2, y - ph, pw, ph, 4);
    this.ctx.fill();

    // Text
    this.ctx.fillStyle = isLocal ? '#fff' : '#e2e8f0';
    this.ctx.fillText(name, x, y - 3);
    this.ctx.restore();
  }

  /**
   * Render particles.
   * @private
   */
  _renderParticles() {
    const particles = this.game.state.particles;
    if (!particles || particles.length === 0) return;

    for (const pt of particles) {
      const alpha = Math.max(0, Math.min(1, pt.life / (pt.maxLife || 2)));
      const screen = this.camera.worldToScreen(pt.x, pt.y);

      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = pt.color || '#fff';

      if (pt.type === 'sparkle') {
        const s = pt.size * alpha;
        this.ctx.translate(screen.x, screen.y);
        this.ctx.rotate(this.envPhase * 2 + pt.x);
        this.ctx.fillRect(-s / 2, -s / 6, s, s / 3);
        this.ctx.fillRect(-s / 6, -s / 2, s / 3, s);
      } else if (pt.type === 'heart') {
        this.ctx.font = `${pt.size * 3 * alpha}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('\u{2764}', screen.x, screen.y);
      } else if (pt.type === 'note') {
        this.ctx.font = `${pt.size * 3 * alpha}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('\u{266A}', screen.x, screen.y);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(screen.x, screen.y, pt.size * alpha, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    }
  }

  /**
   * Render atmospheric effects (ambient color overlay).
   * @param {Object} area
   * @private
   */
  _renderAtmosphere(area) {
    if (area.ambientIntensity > 0) {
      this.ctx.save();
      this.ctx.globalAlpha = area.ambientIntensity * 0.15;
      this.ctx.fillStyle = area.ambientColor;
      this.ctx.fillRect(0, 0, this.W, this.H);
      this.ctx.restore();
    }
  }

  /**
   * Render vignette overlay.
   * @private
   */
  _renderVignette() {
    const vgrad = this.ctx.createRadialGradient(
      this.W / 2, this.H / 2, this.H * 0.3,
      this.W / 2, this.H / 2, this.H * 0.9
    );
    vgrad.addColorStop(0, 'rgba(0,0,0,0)');
    vgrad.addColorStop(1, 'rgba(0,0,0,0.35)');
    this.ctx.fillStyle = vgrad;
    this.ctx.fillRect(0, 0, this.W, this.H);

    // Warm tint overlay
    this.ctx.save();
    this.ctx.globalAlpha = 0.03;
    this.ctx.fillStyle = 'rgba(255, 200, 120, 0.5)';
    this.ctx.fillRect(0, 0, this.W, this.H);
    this.ctx.restore();
  }

  /**
   * Render a fallback when no area is loaded.
   * @private
   */
  _renderFallback() {
    this.ctx.fillStyle = '#1a1025';
    this.ctx.fillRect(0, 0, this.W, this.H);
    this.ctx.fillStyle = '#ffd700';
    this.ctx.font = 'bold 20px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Loading area...', this.W / 2, this.H / 2);
  }

  /**
   * Lighten a hex color.
   * @private
   */
  _lighten(hex, amount) {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  }

  /**
   * Darken a hex color.
   * @private
   */
  _darken(hex, amount) {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  }

  /**
   * Mark the tile cache as dirty (needs regeneration).
   */
  invalidateCache() {
    this._cacheDirty = true;
    this._spriteCache.clear();
  }

  /**
   * Handle canvas resize.
   */
  resize() {
    this.W = this.game.W;
    this.H = this.game.H;
    this._tileCache.width = this.W;
    this._tileCache.height = this.H;
    this._cacheDirty = true;
  }

  /**
   * Clean up resources.
   */
  destroy() {
    this._spriteCache.clear();
    this._tileCache = null;
  }
}
