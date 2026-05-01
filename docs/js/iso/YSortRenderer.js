/**
 * @file YSortRenderer.js
 * @description Sprite-based isometric renderer for Starlight Inn v6.0.
 * Uses Y-sort depth (painter's algorithm) with strict back-to-front
 * rendering.  Every visual element is drawn via `drawImage()` from
 * pre-generated offscreen sprites — zero procedural drawing in the
 * render loop for maximum performance.
 *
 * Core principle: In isometric view, objects lower on the screen
 * (higher tileX + tileY) render IN FRONT of objects higher on the
 * screen.  Within the same row, left-to-right ordering is preserved.
 * Higher z-layer objects (flying, elevated) render on top.
 *
 * Sort key: (tileX + tileY) * 1000 + zLayer
 *
 * @module iso/YSortRenderer
 * @version 6.0.0
 */

import {
  TILE_WIDTH,
  TILE_HEIGHT,
  HALF_TILE_WIDTH,
  HALF_TILE_HEIGHT,
  WALL_HEIGHT,
  tileToScreen,
  screenToTile,
  getSortKey,
  getSortKeyFloat,
  projectIso,
} from "./IsoMath.js";

import { Z_LAYER, OBJECT_TYPE } from "./IsoDepthSorter.js";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Viewport culling margin in tiles */
const CULL_MARGIN_TILES = 1;

/** Default shadow sprite size in pixels */
const SHADOW_SIZE = 24;

/** Maximum number of render objects before warning */
const MAX_RENDER_OBJECTS = 5000;

/** Nameplate height in pixels */
const NAMEPLATE_HEIGHT = 16;

/** Entity bob amplitude when moving */
const ENTITY_BOB_AMPLITUDE = 2;

/** Entity bob frequency */
const ENTITY_BOB_FREQ = 0.25;

/** Default entity sprite width */
const ENTITY_SPRITE_WIDTH = 40;

/** Default entity sprite height */
const ENTITY_SPRITE_HEIGHT = 56;

/** Particle pool size */
const PARTICLE_POOL_SIZE = 256;

/** Debug overlay colors */
const DEBUG_COLORS = {
  tile: "rgba(0,255,0,0.3)",
  wall: "rgba(255,0,0,0.3)",
  prop: "rgba(0,0,255,0.3)",
  entity: "rgba(255,255,0,0.3)",
  effect: "rgba(255,0,255,0.3)",
  viewport: "rgba(0,255,255,0.2)",
};

// =============================================================================
// RENDER OBJECT
// =============================================================================

/**
 * A single item in the render list.  Passed through the sort and then
 * dispatched to the appropriate render method.
 *
 * @typedef {Object} RenderObject
 * @property {string} type - One of OBJECT_TYPE values
 * @property {number} x - Tile X coordinate (may be float for entities)
 * @property {number} y - Tile Y coordinate (may be float for entities)
 * @property {number} zLayer - Z-layer offset for stacking
 * @property {number} sortKey - Computed depth sort key
 * @property {string} [spriteId] - Sprite cache identifier
 * @property {number} [screenX] - Precomputed screen X
 * @property {number} [screenY] - Precomputed screen Y
 * @property {Object} [data] - Type-specific data payload
 * @property {number} [_index] - Stable sort tie-breaker index
 */

// =============================================================================
// Y-SORT RENDERER CLASS
// =============================================================================

/**
 * Sprite-based isometric renderer using Y-sort depth ordering.
 *
 * All drawing is performed via `ctx.drawImage()` using pre-generated
 * offscreen canvases from the sprite cache.  No procedural shapes are
 * drawn during the render loop.
 */
export default class YSortRenderer {
  /**
   * Create a new YSortRenderer.
   *
   * @param {Object} game - Game instance reference
   * @param {HTMLCanvasElement} canvas - Target canvas element
   */
  constructor(game, canvas) {
    /** @type {Object} Game instance reference */
    this._game = game;

    /** @type {HTMLCanvasElement} Target canvas */
    this._canvas = canvas;

    /** @type {CanvasRenderingContext2D} 2D rendering context */
    this.ctx = canvas.getContext("2d", { alpha: false });

    /** @type {number} Canvas width in backing pixels */
    this._width = canvas.width || 1024;

    /** @type {number} Canvas height in backing pixels */
    this._height = canvas.height || 768;

    /** @type {number} Number of drawImage calls last frame */
    this._drawCount = 0;

    /** @type {boolean} Whether debug overlay is enabled */
    this._debugEnabled = false;

    /** @type {number} Frame counter for animation */
    this._frameCount = 0;

    /** @type {number} Environment animation phase */
    this._envPhase = 0;

    /** @type {Array<RenderObject>} Reusable render list buffer */
    this._renderList = [];

    /** @type {Array<RenderObject>} Sorted render output */
    this._sortedList = [];

    /** @type {Set<string>} Sprite IDs requested this frame (for cache warming) */
    this._requestedSprites = new Set();

    /** @type {Object|null} Cached viewport bounds from last frame */
    this._lastViewport = null;

    /** @type {number} Time of last frame in ms */
    this._lastFrameTime = 0;

    /** @type {number} Current FPS estimate */
    this._fps = 60;

    /** @type {number} Accumulated time for FPS calculation */
    this._fpsAccum = 0;

    /** @type {number} Frame count for FPS calculation */
    this._fpsFrames = 0;

    /** @type {HTMLCanvasElement|null} Cached shadow sprite */
    this._shadowSprite = null;

    /** @type {HTMLCanvasElement|null} Cached nameplate canvas */
    this._nameplateCache = null;

    /** @type {CanvasRenderingContext2D|null} Nameplate cache context */
    this._nameplateCtx = null;

    /** @type {Map<string,HTMLCanvasElement>} Runtime generated fallback sprites */
    this._fallbackSprites = new Map();

    // Initialize context for pixel-perfect rendering
    this._initContext();
    this._initShadowSprite();
    this._initNameplateCache();
  }

  // ---------------------------------------------------------------------------
  // INITIALISATION
  // ---------------------------------------------------------------------------

  /**
   * Configure the 2D context for crisp pixel-art output.
   * @private
   */
  _initContext() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    ctx.oImageSmoothingEnabled = false;
  }

  /**
   * Create the reusable circular shadow sprite.
   * @private
   */
  _initShadowSprite() {
    const size = SHADOW_SIZE * 2;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = Math.floor(size * 0.4);
    const ctx = canvas.getContext("2d");

    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;

    const cx = Math.floor(size / 2);
    const cy = Math.floor(canvas.height / 2);
    const rx = Math.floor(SHADOW_SIZE * 0.8);
    const ry = Math.floor(canvas.height / 2);

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.floor(rx * 0.7), Math.floor(ry * 0.7), 0, 0, Math.PI * 2);
    ctx.fill();

    this._shadowSprite = canvas;
  }

  /**
   * Create an offscreen canvas for batched nameplate rendering.
   * @private
   */
  _initNameplateCache() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    this._nameplateCache = canvas;
    this._nameplateCtx = ctx;
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API — MAIN RENDER LOOP
  // ---------------------------------------------------------------------------

  /**
   * Render one complete frame of the isometric world.
   *
   * @param {Object} world - Current area/room object with {floorPattern,walls,props,palette}
   * @param {import("./IsoCamera.js").default} camera - Isometric camera
   * @param {Array<Object>} entities - Array of player/NPC entities
   * @param {Object} sprites - Sprite cache (IsoAssetLoader-compatible)
   */
  render(world, camera, entities, sprites) {
    // Update frame counters
    this._frameCount++;
    this._envPhase += 0.008;
    this._drawCount = 0;

    // Update FPS tracking
    const now = performance.now();
    if (this._lastFrameTime > 0) {
      const dt = now - this._lastFrameTime;
      this._fpsAccum += dt;
      this._fpsFrames++;
      if (this._fpsAccum >= 1000) {
        this._fps = Math.round((this._fpsFrames * 1000) / this._fpsAccum);
        this._fpsAccum = 0;
        this._fpsFrames = 0;
      }
    }
    this._lastFrameTime = now;

    // Clear the entire canvas
    this._clearCanvas();

    // Retrieve viewport bounds for culling
    const viewport = camera.getViewportBounds();
    this._lastViewport = viewport;

    // Build the unified render list
    this._renderList.length = 0;
    this._buildRenderList(world, camera, entities, this._renderList);

    // Sort by depth (back-to-front)
    this._sortRenderList(this._renderList);

    // Render all objects in sorted order
    this._renderSortedList(this._sortedList, camera, sprites);

    // Debug overlay (if enabled)
    if (this._debugEnabled) {
      this._renderDebugOverlay(camera, viewport);
    }
  }

  // ---------------------------------------------------------------------------
  // CANVAS CLEARING
  // ---------------------------------------------------------------------------

  /**
   * Clear the canvas with the world's background color.
   * @private
   */
  _clearCanvas() {
    const ctx = this.ctx;
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, this._width, this._height);
  }

  /**
   * Clear a specific region (used internally for UI overlay compositing).
   *
   * @param {number} x - Screen X
   * @param {number} y - Screen Y
   * @param {number} w - Width
   * @param {number} h - Height
   */
  clearRegion(x, y, w, h) {
    this.ctx.clearRect(
      Math.round(x),
      Math.round(y),
      Math.round(w),
      Math.round(h),
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER LIST BUILDING
  // ---------------------------------------------------------------------------

  /**
   * Build the complete render list for the current frame.
   * Objects are added with precomputed sort keys but NOT sorted yet.
   *
   * @param {Object} world - Area definition
   * @param {import("./IsoCamera.js").default} camera - Camera for culling
   * @param {Array<Object>} entities - Entities to render
   * @param {Array<RenderObject>} list - Output array (reused)
   * @private
   */
  _buildRenderList(world, camera, entities, list) {
    const viewport = camera.getViewportBounds();
    const minX = viewport.minX - CULL_MARGIN_TILES;
    const minY = viewport.minY - CULL_MARGIN_TILES;
    const maxX = viewport.maxX + CULL_MARGIN_TILES;
    const maxY = viewport.maxY + CULL_MARGIN_TILES;

    let index = 0;

    // 1. Floor tiles
    if (world && world.floorPattern) {
      index = this._addTilesToList(list, world.floorPattern, minX, minY, maxX, maxY, index);
    }

    // 2. Custom floor tiles / decals
    if (world && world.customTiles) {
      for (const ct of world.customTiles) {
        if (ct.col < minX || ct.col > maxX || ct.row < minY || ct.row > maxY) continue;
        list.push({
          type: OBJECT_TYPE.FLOOR,
          x: ct.col,
          y: ct.row,
          zLayer: Z_LAYER.FLOOR_DECAL,
          sortKey: getSortKey(ct.col, ct.row, Z_LAYER.FLOOR_DECAL),
          spriteId: ct.tile ? `floor_${ct.tile}` : null,
          data: { variant: (ct.col ^ ct.row) & 1, custom: true },
          _index: index++,
        });
      }
    }

    // 3. Walls
    if (world && world.walls) {
      index = this._addWallsToList(list, world.walls, minX, minY, maxX, maxY, index);
    }

    // 4. Props / furniture
    if (world && world.props) {
      index = this._addPropsToList(list, world.props, minX, minY, maxX, maxY, index);
    }

    // 5. Entities (players, NPCs)
    if (entities && entities.length > 0) {
      index = this._addEntitiesToList(list, entities, minX, minY, maxX, maxY, index);
    }

    // 6. Effects / particles
    if (this._game && this._game.state && this._game.state.particles) {
      index = this._addEffectsToList(list, this._game.state.particles, minX, minY, maxX, maxY, index);
    }

    // Warn if list is excessively large
    if (list.length > MAX_RENDER_OBJECTS) {
      console.warn(
        `YSortRenderer: Render list exceeded ${MAX_RENDER_OBJECTS} objects (${list.length})`,
      );
    }
  }

  /**
   * Add floor tiles to the render list.
   *
   * @param {Array<RenderObject>} list
   * @param {Array<Array<string>>} floorPattern - 2D array of tile type IDs
   * @param {number} minX
   * @param {number} minY
   * @param {number} maxX
   * @param {number} maxY
   * @param {number} startIndex
   * @returns {number} Next index
   * @private
   */
  _addTilesToList(list, floorPattern, minX, minY, maxX, maxY, startIndex) {
    const rows = floorPattern.length;
    let index = startIndex;

    for (let r = 0; r < rows; r++) {
      const cols = floorPattern[r];
      if (!cols) continue;

      for (let c = 0; c < cols.length; c++) {
        if (c < minX || c > maxX || r < minY || r > maxY) continue;

        const tileType = cols[c];
        if (!tileType) continue;

        list.push({
          type: OBJECT_TYPE.FLOOR,
          x: c,
          y: r,
          zLayer: Z_LAYER.FLOOR,
          sortKey: getSortKey(c, r, Z_LAYER.FLOOR),
          spriteId: `floor_${tileType}`,
          data: {
            tileType,
            variant: (c ^ r) & 1,
          },
          _index: index++,
        });
      }
    }

    return index;
  }

  /**
   * Add wall tiles to the render list.
   *
   * @param {Array<RenderObject>} list
   * @param {Array<Object>} walls - Array of {x,y,type,faces}
   * @param {number} minX
   * @param {number} minY
   * @param {number} maxX
   * @param {number} maxY
   * @param {number} startIndex
   * @returns {number} Next index
   * @private
   */
  _addWallsToList(list, walls, minX, minY, maxX, maxY, startIndex) {
    let index = startIndex;

    for (const wall of walls) {
      if (wall.x < minX || wall.x > maxX || wall.y < minY || wall.y > maxY) continue;

      const faces = wall.faces || [true, false, false];
      const faceDir =
        faces[1] && faces[2] ? 3 :
        faces[1] ? 1 :
        faces[2] ? 2 : 0;

      const zLayer =
        faceDir === 3 ? Z_LAYER.WALL_TOP :
        faceDir === 1 || faceDir === 2 ? Z_LAYER.WALL_MID :
        Z_LAYER.WALL_BASE;

      list.push({
        type: OBJECT_TYPE.WALL,
        x: wall.x,
        y: wall.y,
        zLayer,
        sortKey: getSortKey(wall.x, wall.y, zLayer),
        spriteId: `wall_${wall.type}`,
        data: {
          wallType: wall.type,
          faces: faceDir,
          height: wall.height || WALL_HEIGHT,
        },
        _index: index++,
      });
    }

    return index;
  }

  /**
   * Add furniture / props to the render list.
   *
   * @param {Array<RenderObject>} list
   * @param {Array<Object>} props - Array of {furnitureId,tileX,tileY,rotation,zHeight}
   * @param {number} minX
   * @param {number} minY
   * @param {number} maxX
   * @param {number} maxY
   * @param {number} startIndex
   * @returns {number} Next index
   * @private
   */
  _addPropsToList(list, props, minX, minY, maxX, maxY, startIndex) {
    let index = startIndex;

    for (const prop of props) {
      const tx = prop.tileX ?? prop.x ?? 0;
      const ty = prop.tileY ?? prop.y ?? 0;

      if (tx < minX || tx > maxX || ty < minY || ty > maxY) continue;

      const heightOffset = prop.zHeight || prop.heightOffset || 0;
      const zLayer = heightOffset > 0
        ? Z_LAYER.PROP_HIGH + Math.min(heightOffset, 9)
        : Z_LAYER.PROP_MID;

      const sortKey = getSortKey(tx, ty, zLayer) + (heightOffset > 0 ? heightOffset * 0.5 : 0);

      list.push({
        type: OBJECT_TYPE.PROP,
        x: tx,
        y: ty,
        zLayer,
        sortKey,
        spriteId: prop.furnitureId ?? prop.spriteId ?? null,
        data: {
          furnitureId: prop.furnitureId,
          rotation: prop.rotation || 0,
          heightOffset,
          interactive: prop.interactive || false,
          width: prop.width || 1,
          height: prop.height || 1,
        },
        _index: index++,
      });
    }

    return index;
  }

  /**
   * Add entities (players, NPCs) to the render list.
   *
   * @param {Array<RenderObject>} list
   * @param {Array<Object>} entities
   * @param {number} minX
   * @param {number} minY
   * @param {number} maxX
   * @param {number} maxY
   * @param {number} startIndex
   * @returns {number} Next index
   * @private
   */
  _addEntitiesToList(list, entities, minX, minY, maxX, maxY, startIndex) {
    let index = startIndex;

    for (const ent of entities) {
      const tx = ent.x ?? ent.tileX ?? 0;
      const ty = ent.y ?? ent.tileY ?? 0;

      // Use expanded culling for entities (they may have tall sprites)
      if (tx < minX - 2 || tx > maxX + 2 || ty < minY - 2 || ty > maxY + 2) continue;

      const isFloat = !Number.isInteger(tx) || !Number.isInteger(ty);
      const sortKey = isFloat
        ? getSortKeyFloat(tx, ty, Z_LAYER.ENTITY)
        : getSortKey(Math.floor(tx), Math.floor(ty), Z_LAYER.ENTITY);

      list.push({
        type: OBJECT_TYPE.ENTITY,
        x: tx,
        y: ty,
        zLayer: Z_LAYER.ENTITY,
        sortKey,
        spriteId: ent.spriteId || this._resolveEntitySpriteId(ent),
        data: {
          entity: ent,
          isLocal: ent.isLocal || false,
          isNPC: ent.type === "npc" || ent.isNPC || false,
          bobPhase: (ent.id || 0) % 7,
        },
        _index: index++,
      });
    }

    return index;
  }

  /**
   * Add particle effects to the render list.
   *
   * @param {Array<RenderObject>} list
   * @param {Array<Object>} particles
   * @param {number} minX
   * @param {number} minY
   * @param {number} maxX
   * @param {number} maxY
   * @param {number} startIndex
   * @returns {number} Next index
   * @private
   */
  _addEffectsToList(list, particles, minX, minY, maxX, maxY, startIndex) {
    let index = startIndex;

    for (const pt of particles) {
      const tx = pt.x ?? pt.tileX ?? 0;
      const ty = pt.y ?? pt.tileY ?? 0;

      if (tx < minX - 3 || tx > maxX + 3 || ty < minY - 3 || ty > maxY + 3) continue;

      list.push({
        type: OBJECT_TYPE.EFFECT,
        x: tx,
        y: ty,
        zLayer: Z_LAYER.EFFECT,
        sortKey: getSortKey(Math.floor(tx), Math.floor(ty), Z_LAYER.EFFECT),
        spriteId: null,
        data: { particle: pt },
        _index: index++,
      });
    }

    return index;
  }

  // ---------------------------------------------------------------------------
  // SORTING
  // ---------------------------------------------------------------------------

  /**
   * Sort the render list back-to-front using stable Y-sort.
   *
   * @param {Array<RenderObject>} list
   * @private
   */
  _sortRenderList(list) {
    if (list.length <= 1) {
      this._sortedList = list.slice();
      return;
    }

    // Use native sort with stable tie-breaking
    this._sortedList = list.sort((a, b) => {
      // Primary: sort key (lower = behind)
      if (a.sortKey !== b.sortKey) {
        return a.sortKey - b.sortKey;
      }

      // Secondary: same-tile type ordering
      if (a.x === b.x && a.y === b.y) {
        const tie = this._typeOrder(a.type) - this._typeOrder(b.type);
        if (tie !== 0) return tie;
      }

      // Tertiary: stable index
      return a._index - b._index;
    });
  }

  /**
   * Get the draw-order priority for an object type.
   * Lower values are drawn first (behind).
   *
   * @param {string} type
   * @returns {number}
   * @private
   */
  _typeOrder(type) {
    switch (type) {
      case OBJECT_TYPE.FLOOR: return 0;
      case OBJECT_TYPE.WALL: return 1;
      case OBJECT_TYPE.PROP: return 2;
      case OBJECT_TYPE.ENTITY: return 3;
      case OBJECT_TYPE.EFFECT: return 4;
      default: return 2;
    }
  }

  // ---------------------------------------------------------------------------
  // SORTED LIST RENDERING
  // ---------------------------------------------------------------------------

  /**
   * Iterate the sorted list and dispatch each object to its renderer.
   *
   * @param {Array<RenderObject>} sorted
   * @param {import("./IsoCamera.js").default} camera
   * @param {Object} sprites
   * @private
   */
  _renderSortedList(sorted, camera, sprites) {
    const zoom = camera.zoom || 1;

    for (const obj of sorted) {
      // Compute screen position
      const screen = tileToScreen(obj.x, obj.y, 0, 0, zoom);
      const screenX = Math.round(screen.screenX - camera.x);
      const screenY = Math.round(screen.screenY - camera.y);

      switch (obj.type) {
        case OBJECT_TYPE.FLOOR:
          this.renderTile(obj, screenX, screenY, sprites);
          break;
        case OBJECT_TYPE.WALL:
          this.renderWall(obj, screenX, screenY, sprites);
          break;
        case OBJECT_TYPE.PROP:
          this.renderProp(obj, screenX, screenY, sprites);
          break;
        case OBJECT_TYPE.ENTITY:
          this.renderEntity(obj, screenX, screenY, sprites);
          break;
        case OBJECT_TYPE.EFFECT:
          this.renderEffect(obj, screenX, screenY, camera);
          break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // TILE RENDERING
  // ---------------------------------------------------------------------------

  /**
   * Draw a single floor tile sprite at the given screen position.
   * The sprite anchor is at the bottom-center of the tile diamond.
   *
   * @param {RenderObject} tileObj
   * @param {number} screenX
   * @param {number} screenY
   * @param {Object} sprites - Sprite cache
   */
  renderTile(tileObj, screenX, screenY, sprites) {
    const spriteId = tileObj.spriteId;
    if (!spriteId) return;

    const sprite = this._getSprite(sprites, spriteId);
    if (!sprite) return;

    // Anchor: bottom-center of the 64x32 diamond
    // At (tileX,tileY) the tile center is at screen coords.
    // The diamond top is at centerY - 16, so bottom is at centerY + 16.
    // The sprite should be drawn so its bottom-center aligns with the tile center.
    const drawX = Math.round(screenX - HALF_TILE_WIDTH);
    const drawY = Math.round(screenY);

    this._drawSpriteInternal(sprite, drawX, drawY);
  }

  // ---------------------------------------------------------------------------
  // WALL RENDERING
  // ---------------------------------------------------------------------------

  /**
   * Draw a single wall sprite at the given screen position.
   * Walls have higher z-layer than floor, lower than props.
   *
   * @param {RenderObject} wallObj
   * @param {number} screenX
   * @param {number} screenY
   * @param {Object} sprites - Sprite cache
   */
  renderWall(wallObj, screenX, screenY, sprites) {
    const spriteId = wallObj.spriteId;
    if (!spriteId) return;

    const sprite = this._getSprite(sprites, spriteId);
    if (!sprite) return;

    const height = wallObj.data?.height || WALL_HEIGHT;

    // Wall anchor: bottom-center sits on the tile top edge
    // The wall extends upward from the tile plane
    const drawX = Math.round(screenX - HALF_TILE_WIDTH);
    const drawY = Math.round(screenY - height);

    this._drawSpriteInternal(sprite, drawX, drawY);
  }

  // ---------------------------------------------------------------------------
  // PROP RENDERING
  // ---------------------------------------------------------------------------

  /**
   * Draw a furniture / prop sprite at the given screen position.
   * Props render after floor+wall, before entities on the same tile.
   * If prop has zHeight (on table), it is elevated.
   *
   * @param {RenderObject} propObj
   * @param {number} screenX
   * @param {number} screenY
   * @param {Object} sprites - Sprite cache
   */
  renderProp(propObj, screenX, screenY, sprites) {
    const spriteId = propObj.spriteId;
    if (!spriteId) return;

    const sprite = this._getSprite(sprites, spriteId);
    if (!sprite) return;

    const heightOffset = propObj.data?.heightOffset || 0;
    const anchorX = sprite.anchorX ?? Math.floor(sprite.width / 2);
    const anchorY = sprite.anchorY ?? sprite.height;

    // Apply elevation offset for props on tables/shelves
    const zOffsetPx = Math.round(heightOffset * 0.5 * TILE_HEIGHT);

    const drawX = Math.round(screenX - anchorX);
    const drawY = Math.round(screenY - anchorY - zOffsetPx);

    this._drawSpriteInternal(sprite, drawX, drawY);

    // Draw interaction indicator for interactive props
    if (propObj.data?.interactive) {
      this._drawInteractionIndicator(screenX, drawY - 4);
    }
  }

  /**
   * Draw a pulsing gold dot above interactive props.
   *
   * @param {number} screenX
   * @param {number} screenY
   * @private
   */
  _drawInteractionIndicator(screenX, screenY) {
    const ctx = this.ctx;
    const pulse = 0.5 + Math.sin(this._envPhase * 4) * 0.3;

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = "#ffd700";
    ctx.beginPath();
    ctx.arc(Math.round(screenX), Math.round(screenY), 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // ENTITY RENDERING
  // ---------------------------------------------------------------------------

  /**
   * Draw a character entity sprite at the given screen position.
   * Entity sprite includes: body + outfit + animation frame.
   * Shadow sprite is drawn first (under entity).
   * Nameplate is drawn above (if enabled).
   *
   * @param {RenderObject} entityObj
   * @param {number} screenX
   * @param {number} screenY
   * @param {Object} sprites - Sprite cache
   */
  renderEntity(entityObj, screenX, screenY, sprites) {
    const ent = entityObj.data?.entity;
    if (!ent) return;

    const isLocal = entityObj.data?.isLocal || false;
    const isNPC = entityObj.data?.isNPC || false;
    const bobPhase = entityObj.data?.bobPhase || 0;

    // Compute bob offset for moving entities
    const moving = ent.moving || false;
    const bob = moving
      ? Math.round(Math.sin(this._frameCount * ENTITY_BOB_FREQ + bobPhase) * ENTITY_BOB_AMPLITUDE)
      : 0;

    // 1. Shadow (drawn first, underneath)
    this._drawEntityShadow(screenX, screenY);

    // 2. Entity body sprite
    const spriteId = entityObj.spriteId;
    if (spriteId && sprites) {
      const sprite = this._getSprite(sprites, spriteId);
      if (sprite) {
        const anchorX = sprite.anchorX ?? Math.floor(sprite.width / 2);
        const anchorY = sprite.anchorY ?? sprite.height;
        const drawX = Math.round(screenX - anchorX);
        const drawY = Math.round(screenY - anchorY + bob);
        this._drawSpriteInternal(sprite, drawX, drawY);
      } else {
        // Fallback: draw a simple avatar body
        this._drawFallbackAvatar(screenX, screenY + bob, ent, isNPC ? 36 : 40);
      }
    } else {
      // Fallback procedural avatar (only when no sprite available)
      this._drawFallbackAvatar(screenX, screenY + bob, ent, isNPC ? 36 : 40);
    }

    // 3. Nameplate
    const showNames = this._game?.state?.settings?.showNames ?? true;
    if (showNames && ent.name) {
      const nameY = screenY + bob - (isNPC ? 22 : 28);
      this._drawNameplate(screenX, nameY, ent.name, isLocal, isNPC);
    }

    // 4. Online / status indicator
    if (isLocal || ent.online) {
      const ctx = this.ctx;
      ctx.fillStyle = "#4ade80";
      ctx.beginPath();
      ctx.arc(
        Math.round(screenX + 14),
        Math.round(screenY + bob - 18),
        3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    // 5. Gesture emoji
    if (ent.gestureId > 0) {
      const gmap = {
        1: "\u{1F44B}",
        2: "\u{1F483}",
        3: "\u{1FA91}",
        4: "\u{1F4A4}",
        5: "\u{1F602}",
        6: "\u{1F622}",
      };
      const ctx = this.ctx;
      ctx.save();
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        gmap[ent.gestureId] || "",
        Math.round(screenX),
        Math.round(screenY + bob - 34),
      );
      ctx.restore();
    }

    // 6. Chat bubble (if present)
    if (ent.chatBubble) {
      this._drawChatBubble(screenX, screenY + bob - (isNPC ? 30 : 38), ent.chatBubble);
    }
  }

  /**
   * Draw a circular shadow beneath an entity.
   *
   * @param {number} screenX
   * @param {number} screenY
   * @private
   */
  _drawEntityShadow(screenX, screenY) {
    if (!this._shadowSprite) return;

    const ctx = this.ctx;
    const w = this._shadowSprite.width;
    const h = this._shadowSprite.height;
    const dx = Math.round(screenX - w / 2);
    const dy = Math.round(screenY - 4);

    ctx.drawImage(this._shadowSprite, dx, dy);
    this._drawCount++;
  }

  /**
   * Draw a fallback avatar body using simple shapes.
   * ONLY called when no sprite is available.
   *
   * @param {number} x
   * @param {number} y
   * @param {Object} appearance
   * @param {number} size
   * @private
   */
  _drawFallbackAvatar(x, y, appearance, size) {
    const ctx = this.ctx;

    const skinColors = ["#ffe0bd", "#ffcd94", "#eac086", "#d2a56d", "#8d5524"];
    const hairColors = ["#2d2d2d", "#5c3a21", "#d4a574", "#e8c547", "#a33b3b", "#6b4c9a"];
    const outfitColors = ["#5b8c85", "#c75b5b", "#5b7fa8", "#a85ba8", "#8c5b5b", "#d4a45b"];

    const skin = skinColors[appearance.skinColor % skinColors.length] || skinColors[0];
    const hair = hairColors[appearance.hairColor % hairColors.length] || hairColors[0];
    const outfit = outfitColors[appearance.outfitColor % outfitColors.length] || outfitColors[0];

    // Body
    ctx.fillStyle = outfit;
    ctx.beginPath();
    ctx.moveTo(Math.round(x - size * 0.25), Math.round(y));
    ctx.lineTo(Math.round(x), Math.round(y - size * 0.15));
    ctx.lineTo(Math.round(x + size * 0.25), Math.round(y));
    ctx.lineTo(Math.round(x + size * 0.2), Math.round(y + size * 0.45));
    ctx.lineTo(Math.round(x - size * 0.2), Math.round(y + size * 0.45));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = this._darkenHex(outfit, 30);
    ctx.lineWidth = 1;
    ctx.stroke();

    // Head
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(Math.round(x), Math.round(y - size * 0.2), Math.round(size * 0.22), 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(
      Math.round(x),
      Math.round(y - size * 0.28),
      Math.round(size * 0.22),
      Math.PI * 1.05,
      Math.PI * 1.95,
    );
    ctx.fill();

    // Eyes
    const eyeY = Math.round(y - size * 0.2);
    const facing = appearance.facing || "down";
    const eyeOffset = facing === "left" ? Math.round(-size * 0.05) : facing === "right" ? Math.round(size * 0.05) : 0;
    ctx.fillStyle = "#2d2d2d";
    ctx.beginPath();
    ctx.arc(Math.round(x - size * 0.06 + eyeOffset), eyeY, Math.round(size * 0.035), 0, Math.PI * 2);
    ctx.arc(Math.round(x + size * 0.06 + eyeOffset), eyeY, Math.round(size * 0.035), 0, Math.PI * 2);
    ctx.fill();

    // Highlights
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(Math.round(x - size * 0.04 + eyeOffset), eyeY - 1, Math.round(size * 0.015), 0, Math.PI * 2);
    ctx.arc(Math.round(x + size * 0.08 + eyeOffset), eyeY - 1, Math.round(size * 0.015), 0, Math.PI * 2);
    ctx.fill();

    // Mouth
    const expression = appearance.expression || "happy";
    ctx.strokeStyle = "#8b5e3c";
    ctx.lineWidth = 1;
    ctx.lineCap = "round";
    if (expression === "happy" || expression === "laugh") {
      ctx.beginPath();
      ctx.arc(
        Math.round(x + eyeOffset),
        Math.round(y - size * 0.1),
        Math.round(size * 0.06),
        0.1,
        Math.PI - 0.1,
      );
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(Math.round(x - size * 0.04 + eyeOffset), Math.round(y - size * 0.12));
      ctx.lineTo(Math.round(x + size * 0.04 + eyeOffset), Math.round(y - size * 0.12));
      ctx.stroke();
    }
  }

  /**
   * Draw a nameplate above a character.
   *
   * @param {number} x
   * @param {number} y
   * @param {string} name
   * @param {boolean} [isLocal=false]
   * @param {boolean} [isNPC=false]
   * @private
   */
  _drawNameplate(x, y, name, isLocal = false, isNPC = false) {
    const ctx = this.ctx;
    ctx.save();

    ctx.font = isNPC ? "10px sans-serif" : "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    const tw = ctx.measureText(name).width;
    const pw = Math.ceil(tw + 10);
    const ph = NAMEPLATE_HEIGHT;
    const px = Math.round(x - pw / 2);
    const py = Math.round(y - ph);

    // Background
    ctx.fillStyle = isLocal
      ? "rgba(91, 140, 133, 0.75)"
      : isNPC
        ? "rgba(139, 90, 43, 0.7)"
        : "rgba(20, 20, 30, 0.65)";

    // Draw rounded rect manually for pixel-perfect edges
    const r = 4;
    ctx.beginPath();
    ctx.moveTo(px + r, py);
    ctx.lineTo(px + pw - r, py);
    ctx.quadraticCurveTo(px + pw, py, px + pw, py + r);
    ctx.lineTo(px + pw, py + ph - r);
    ctx.quadraticCurveTo(px + pw, py + ph, px + pw - r, py + ph);
    ctx.lineTo(px + r, py + ph);
    ctx.quadraticCurveTo(px, py + ph, px, py + ph - r);
    ctx.lineTo(px, py + r);
    ctx.quadraticCurveTo(px, py, px + r, py);
    ctx.closePath();
    ctx.fill();

    // Text
    ctx.fillStyle = isLocal ? "#fff" : "#e2e8f0";
    ctx.fillText(name, Math.round(x), Math.round(y - 3));

    ctx.restore();
  }

  /**
   * Draw a chat bubble above an entity.
   *
   * @param {number} x
   * @param {number} y
   * @param {string} text
   * @private
   */
  _drawChatBubble(x, y, text) {
    const ctx = this.ctx;
    const maxWidth = 180;
    const lineHeight = 14;

    ctx.save();
    ctx.font = "12px sans-serif";

    // Word wrap
    const words = text.split(" ");
    const lines = [];
    let currentLine = "";
    for (const word of words) {
      const test = currentLine ? currentLine + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = test;
      }
    }
    if (currentLine) lines.push(currentLine);
    if (lines.length === 0) lines.push(text);

    let maxLineWidth = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > maxLineWidth) maxLineWidth = w;
    }

    const bubbleW = Math.ceil(maxLineWidth + 12);
    const bubbleH = Math.ceil(lines.length * lineHeight + 8);
    const bx = Math.round(x - bubbleW / 2);
    const by = Math.round(y - bubbleH);

    // Bubble background
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.strokeStyle = "rgba(200, 200, 200, 0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + 6, by);
    ctx.lineTo(bx + bubbleW - 6, by);
    ctx.quadraticCurveTo(bx + bubbleW, by, bx + bubbleW, by + 6);
    ctx.lineTo(bx + bubbleW, by + bubbleH - 6);
    ctx.quadraticCurveTo(bx + bubbleW, by + bubbleH, bx + bubbleW - 6, by + bubbleH);
    ctx.lineTo(bx + 6, by + bubbleH);
    ctx.quadraticCurveTo(bx, by + bubbleH, bx, by + bubbleH - 6);
    ctx.lineTo(bx, by + 6);
    ctx.quadraticCurveTo(bx, by, bx + 6, by);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tail
    ctx.beginPath();
    ctx.moveTo(Math.round(x - 4), by + bubbleH);
    ctx.lineTo(Math.round(x), by + bubbleH + 5);
    ctx.lineTo(Math.round(x + 4), by + bubbleH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = "#1a1a2e";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], Math.round(x), by + 5 + i * lineHeight);
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // EFFECT RENDERING
  // ---------------------------------------------------------------------------

  /**
   * Draw a particle effect at the given screen position.
   * Particles are rendered last (top layer).
   * Supports additive or normal blend modes.
   *
   * @param {RenderObject} effectObj
   * @param {number} screenX
   * @param {number} screenY
   * @param {import("./IsoCamera.js").default} camera
   */
  renderEffect(effectObj, screenX, screenY, camera) {
    const pt = effectObj.data?.particle;
    if (!pt) return;

    const ctx = this.ctx;
    const maxLife = pt.maxLife || 60;
    const lifeRatio = Math.max(0, Math.min(1, pt.life / maxLife));
    const alpha = lifeRatio;

    ctx.save();

    if (pt.blendMode === "additive") {
      ctx.globalCompositeOperation = "lighter";
    }

    ctx.globalAlpha = alpha;

    if (pt.type === "sparkle" || pt.spriteId === "sparkle") {
      this._drawSparkleParticle(screenX, screenY, pt, alpha);
    } else if (pt.type === "heart") {
      ctx.font = `${Math.round(pt.size * 3 * alpha)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = pt.color || "#ff4466";
      ctx.fillText("\u{2764}", Math.round(screenX), Math.round(screenY));
    } else if (pt.type === "note") {
      ctx.font = `${Math.round(pt.size * 3 * alpha)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = pt.color || "#ffcc00";
      ctx.fillText("\u{266A}", Math.round(screenX), Math.round(screenY));
    } else if (pt.type === "firefly") {
      ctx.fillStyle = pt.color || "#aaff66";
      ctx.beginPath();
      ctx.arc(
        Math.round(screenX),
        Math.round(screenY),
        Math.round((pt.size || 2) * alpha),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    } else if (pt.type === "dust") {
      ctx.fillStyle = pt.color || "#d4c4a0";
      const s = Math.round((pt.size || 2) * alpha);
      ctx.fillRect(Math.round(screenX - s / 2), Math.round(screenY - s / 2), s, s);
    } else {
      // Generic particle
      ctx.fillStyle = pt.color || "#ffffff";
      ctx.beginPath();
      ctx.arc(
        Math.round(screenX),
        Math.round(screenY),
        Math.round((pt.size || 3) * alpha),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    ctx.restore();
    this._drawCount++;
  }

  /**
   * Draw a sparkle cross particle.
   *
   * @param {number} screenX
   * @param {number} screenY
   * @param {Object} pt
   * @param {number} alpha
   * @private
   */
  _drawSparkleParticle(screenX, screenY, pt, alpha) {
    const ctx = this.ctx;
    const s = Math.round((pt.size || 4) * alpha);
    const x = Math.round(screenX);
    const y = Math.round(screenY);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this._envPhase * 2 + (pt.x || 0));
    ctx.fillStyle = pt.color || "#fff8e7";
    ctx.fillRect(Math.round(-s / 2), Math.round(-s / 6), s, Math.max(1, Math.round(s / 3)));
    ctx.fillRect(Math.round(-s / 6), Math.round(-s / 2), Math.max(1, Math.round(s / 3)), s);
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // SPRITE DRAWING INTERNALS
  // ---------------------------------------------------------------------------

  /**
   * Draw a cached sprite to the canvas at the given position.
   * All coordinates are Math.round()'ed for pixel-perfect placement.
   *
   * @param {Object} sprite - Sprite record with {canvas,width,height,anchorX,anchorY}
   * @param {number} x - Screen X (already adjusted for anchor)
   * @param {number} y - Screen Y (already adjusted for anchor)
   * @private
   */
  _drawSpriteInternal(sprite, x, y) {
    if (!sprite || !sprite.canvas) return;

    const ctx = this.ctx;
    const drawX = Math.round(x);
    const drawY = Math.round(y);
    const drawW = Math.round(sprite.width);
    const drawH = Math.round(sprite.height);

    ctx.drawImage(sprite.canvas, drawX, drawY, drawW, drawH);
    this._drawCount++;
  }

  /**
   * Retrieve a sprite from the cache by ID.
   * Returns null if not found.
   *
   * @param {Object} sprites - Sprite cache / asset loader
   * @param {string} spriteId
   * @returns {Object|null}
   * @private
   */
  _getSprite(sprites, spriteId) {
    if (!sprites || !spriteId) return null;

    // Track request for cache warming
    this._requestedSprites.add(spriteId);

    // IsoAssetLoader compatible API
    if (typeof sprites.getSprite === "function") {
      return sprites.getSprite(spriteId);
    }

    // Direct map access
    if (sprites instanceof Map) {
      return sprites.get(spriteId) || null;
    }

    // Object property access
    if (sprites[spriteId]) {
      return sprites[spriteId];
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // VIEWPORT CULLING
  // ---------------------------------------------------------------------------

  /**
   * Check whether an object is visible in the camera viewport.
   * Uses the camera's visible tile bounds plus a margin.
   *
   * @param {number} screenX - Screen X position
   * @param {number} screenY - Screen Y position
   * @param {number} spriteWidth - Sprite width in pixels
   * @param {number} spriteHeight - Sprite height in pixels
   * @param {import("./IsoCamera.js").default} camera - Camera instance
   * @returns {boolean} True if visible
   */
  isVisible(screenX, screenY, spriteWidth, spriteHeight, camera) {
    const margin = TILE_WIDTH * (camera.zoom || 1);
    const minSX = -margin;
    const minSY = -margin;
    const maxSX = this._width + margin;
    const maxSY = this._height + margin;

    return (
      screenX + spriteWidth >= minSX &&
      screenX <= maxSX &&
      screenY + spriteHeight >= minSY &&
      screenY <= maxSY
    );
  }

  /**
   * Check whether a tile coordinate is within the viewport bounds.
   *
   * @param {number} tileX
   * @param {number} tileY
   * @param {import("./IsoCamera.js").default} camera
   * @param {number} [extraMargin=0] - Additional tiles of margin
   * @returns {boolean}
   */
  isTileVisible(tileX, tileY, camera, extraMargin = 0) {
    const bounds = camera.getViewportBounds();
    const margin = CULL_MARGIN_TILES + extraMargin;
    return (
      tileX >= bounds.minX - margin &&
      tileX <= bounds.maxX + margin &&
      tileY >= bounds.minY - margin &&
      tileY <= bounds.maxY + margin
    );
  }

  // ---------------------------------------------------------------------------
  // ENTITY SPRITE RESOLUTION
  // ---------------------------------------------------------------------------

  /**
   * Resolve a sprite ID for an entity based on its appearance and state.
   *
   * @param {Object} ent - Entity object
   * @returns {string|null}
   * @private
   */
  _resolveEntitySpriteId(ent) {
    // If entity already has an explicit sprite ID, use it
    if (ent.spriteId) return ent.spriteId;

    // Compose a sprite ID from appearance parts
    const parts = ["avatar"];

    if (ent.skinColor !== undefined) parts.push(`s${ent.skinColor}`);
    if (ent.hairColor !== undefined) parts.push(`h${ent.hairColor}`);
    if (ent.outfitColor !== undefined) parts.push(`o${ent.outfitColor}`);
    if (ent.facing) parts.push(ent.facing);
    if (ent.expression) parts.push(ent.expression);

    // Animation frame for walking
    if (ent.moving) {
      const frame = Math.floor(this._frameCount * 0.15) % 4;
      parts.push(`walk${frame}`);
    } else {
      parts.push("idle");
    }

    return parts.join("_");
  }

  // ---------------------------------------------------------------------------
  // DEBUG OVERLAY
  // ---------------------------------------------------------------------------

  /**
   * Render a debug overlay showing grid, viewport bounds, and stats.
   *
   * @param {import("./IsoCamera.js").default} camera
   * @param {Object} viewport
   * @private
   */
  _renderDebugOverlay(camera, viewport) {
    const ctx = this.ctx;
    const zoom = camera.zoom || 1;

    // Draw viewport grid
    ctx.save();
    ctx.strokeStyle = DEBUG_COLORS.viewport;
    ctx.lineWidth = 1;

    const minX = viewport.minX;
    const minY = viewport.minY;
    const maxX = viewport.maxX;
    const maxY = viewport.maxY;

    for (let tx = minX; tx <= maxX; tx++) {
      for (let ty = minY; ty <= maxY; ty++) {
        const s = tileToScreen(tx, ty, camera.x, camera.y, zoom);
        const corners = [
          { x: s.screenX, y: s.screenY - HALF_TILE_HEIGHT * zoom },
          { x: s.screenX + HALF_TILE_WIDTH * zoom, y: s.screenY },
          { x: s.screenX, y: s.screenY + HALF_TILE_HEIGHT * zoom },
          { x: s.screenX - HALF_TILE_WIDTH * zoom, y: s.screenY },
        ];

        ctx.beginPath();
        ctx.moveTo(Math.round(corners[0].x), Math.round(corners[0].y));
        for (let i = 1; i < corners.length; i++) {
          ctx.lineTo(Math.round(corners[i].x), Math.round(corners[i].y));
        }
        ctx.closePath();
        ctx.stroke();
      }
    }

    ctx.restore();

    // Stats panel
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(8, 8, 200, 110);

    ctx.fillStyle = "#0f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    const lines = [
      `FPS: ${this._fps}`,
      `Draws: ${this._drawCount}`,
      `Objects: ${this._sortedList.length}`,
      `Camera: ${Math.round(camera.x)},${Math.round(camera.y)}`,
      `Zoom: ${zoom.toFixed(2)}`,
      `Viewport: ${viewport.minX},${viewport.minY}-${viewport.maxX},${viewport.maxY}`,
    ];

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 14, 14 + i * 16);
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // UTILITY
  // ---------------------------------------------------------------------------

  /**
   * Darken a hex colour by a percentage.
   *
   * @param {string} hex
   * @param {number} amount
   * @returns {string}
   * @private
   */
  _darkenHex(hex, amount) {
    const num = parseInt(hex.replace("#", ""), 16);
    let r = Math.max(0, ((num >> 16) & 0xff) - amount);
    let g = Math.max(0, ((num >> 8) & 0xff) - amount);
    let b = Math.max(0, (num & 0xff) - amount);
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
  }

  /**
   * Set the canvas dimensions (called on resize).
   *
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    this._width = width;
    this._height = height;
    this._canvas.width = width;
    this._canvas.height = height;
    this._initContext();
  }

  /**
   * Enable or disable the debug overlay.
   *
   * @param {boolean} enabled
   */
  setDebug(enabled) {
    this._debugEnabled = !!enabled;
  }

  /**
   * Check if debug overlay is enabled.
   * @returns {boolean}
   */
  isDebugEnabled() {
    return this._debugEnabled;
  }

  /**
   * Get the number of drawImage calls in the last frame.
   * @returns {number}
   */
  getDrawCount() {
    return this._drawCount;
  }

  /**
   * Get the current FPS estimate.
   * @returns {number}
   */
  getFPS() {
    return this._fps;
  }

  /**
   * Get the number of objects in the last sorted list.
   * @returns {number}
   */
  getObjectCount() {
    return this._sortedList.length;
  }

  /**
   * Get the set of sprite IDs requested this frame.
   * Useful for cache warming / preloading.
   * @returns {Set<string>}
   */
  getRequestedSprites() {
    return this._requestedSprites;
  }

  /**
   * Clear the requested sprite tracking set.
   */
  clearRequestedSprites() {
    this._requestedSprites.clear();
  }

  /**
   * Get the render list from the last frame (unsorted).
   * @returns {Array<RenderObject>}
   */
  getRenderList() {
    return this._renderList.slice();
  }

  /**
   * Get the sorted render list from the last frame.
   * @returns {Array<RenderObject>}
   */
  getSortedList() {
    return this._sortedList.slice();
  }

  // ---------------------------------------------------------------------------
  // BACKGROUND RENDERING (standalone helpers)
  // ---------------------------------------------------------------------------

  /**
   * Render a full-screen background gradient.
   *
   * @param {string} topColor - Top gradient color
   * @param {string} bottomColor - Bottom gradient color
   * @param {Object} [options]
   * @param {number} [options.stars=0] - Number of stars to draw
   * @param {number} [options.starSeed=0] - Seed for star RNG
   */
  renderBackgroundGradient(topColor, bottomColor, options = {}) {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, this._height);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, bottomColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this._width, this._height);

    const stars = options.stars || 0;
    if (stars > 0) {
      const seed = options.starSeed || 0;
      ctx.save();
      ctx.fillStyle = "#fff8e7";
      for (let i = 0; i < stars; i++) {
        const sx = (((seed * 9301 + i * 49297) % 10000) / 10000) * this._width;
        const sy = (((seed * 49297 + i * 9301) % 10000) / 10000) * this._height * 0.4;
        const twinkle = Math.sin(this._envPhase * 3 + i) * 0.5 + 0.5;
        ctx.globalAlpha = twinkle * 0.8;
        ctx.beginPath();
        ctx.arc(Math.round(sx), Math.round(sy), 1 + twinkle, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /**
   * Render a vignette overlay for atmospheric depth.
   */
  renderVignette() {
    const ctx = this.ctx;
    const vgrad = ctx.createRadialGradient(
      Math.round(this._width / 2),
      Math.round(this._height / 2),
      Math.round(this._height * 0.3),
      Math.round(this._width / 2),
      Math.round(this._height / 2),
      Math.round(this._height * 0.9),
    );
    vgrad.addColorStop(0, "rgba(0,0,0,0)");
    vgrad.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = vgrad;
    ctx.fillRect(0, 0, this._width, this._height);

    // Warm tint
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.fillStyle = "rgba(255, 200, 120, 0.5)";
    ctx.fillRect(0, 0, this._width, this._height);
    ctx.restore();
  }

  /**
   * Render an atmospheric color overlay.
   *
   * @param {string} color
   * @param {number} intensity - 0 to 1
   */
  renderAtmosphere(color, intensity) {
    if (intensity <= 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, intensity * 0.15));
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, this._width, this._height);
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // LIFECYCLE
  // ---------------------------------------------------------------------------

  /**
   * Clean up resources and references.
   */
  destroy() {
    this._shadowSprite = null;
    this._nameplateCache = null;
    this._nameplateCtx = null;
    this._fallbackSprites.clear();
    this._renderList.length = 0;
    this._sortedList.length = 0;
    this._requestedSprites.clear();
    this._game = null;
    this._canvas = null;
    this.ctx = null;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { Z_LAYER, OBJECT_TYPE, CULL_MARGIN_TILES };
