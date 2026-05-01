/**
 * @file IsoAreaBackgrounds.js
 * @description Isometric diamond-tile area backgrounds for Starlight Inn v5.0.
 * Defines all 14 areas with 20x20 tile floor patterns, wall systems, furniture
 * placement, environmental color palettes, and ambient particle configurations.
 *
 * Rendering is back-to-front (painter's algorithm) so that tiles and props
 * correctly occlude one another.  Walls are drawn as isometric facets after
 * the floor but before furniture props.
 *
 * Tile dimensions: TILE_WIDTH = 64, TILE_HEIGHT = 32 (2:1 isometric ratio).
 * Areas are 20x20 tile grids by default.
 *
 * @module iso/IsoAreaBackgrounds
 */

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

/** @type {number} Isometric tile width in pixels. */
export const TILE_WIDTH = 64;

/** @type {number} Isometric tile height in pixels (2:1 ratio). */
export const TILE_HEIGHT = 32;

/** @type {number} Default area width in tiles. */
export const AREA_WIDTH = 20;

/** @type {number} Default area height in tiles. */
export const AREA_HEIGHT = 20;

/** @type {number} Half tile width for isometric calculations. */
export const HALF_TILE_W = TILE_WIDTH / 2;

/** @type {number} Half tile height for isometric calculations. */
export const HALF_TILE_H = TILE_HEIGHT / 2;

/** @type {number} Wall height in pixels above the tile plane. */
export const WALL_HEIGHT = 48;

// ------------------------------------------------------------------
// Floor tile type registry — all valid floor type IDs
// ------------------------------------------------------------------

/** @type {string[]} */
export const FLOOR_TYPES = [
  'stone_mosaic', 'stone_gray', 'grass', 'sand', 'water',
  'wood_light', 'wood_dark', 'carpet_red', 'carpet_green',
  'neon_grid', 'marble_white', 'dirt', 'snow', 'ice',
  'tile_terracotta'
];

// ------------------------------------------------------------------
// Wall type registry — all valid wall type IDs
// ------------------------------------------------------------------

/** @type {string[]} */
export const WALL_TYPES = [
  'wall_stone', 'wall_wood', 'wall_brick', 'wall_mossy',
  'wall_ice', 'wall_bamboo', 'wall_plaster'
];

// ------------------------------------------------------------------
// Furniture prop registry — all valid furniture IDs
// ------------------------------------------------------------------

/** @type {string[]} */
export const FURNITURE_TYPES = [
  'fountain', 'bench', 'streetlamp', 'flower_bed', 'tree_oak',
  'tree_pine', 'info_board', 'birdbath', 'lamp_floor', 'bush',
  'potted_plant_large', 'potted_plant_hanging', 'beach_umbrella',
  'bar_stool', 'jukebox', 'palm_tree', 'surfboard', 'rock',
  'chest_treasure', 'fireplace', 'dining_table', 'dining_chair',
  'chandelier', 'candle', 'bookshelf', 'trophy_case', 'rug_rect',
  'crystal_cluster', 'portal_ring', 'sofa', 'armchair',
  'coffee_table', 'disco_ball', 'rug_round', 'mushroom_ring',
  'snowman', 'gift_box', 'ice_skating_rink', 'tiki_torch',
  'totem_pole', 'drum_circle', 'campfire', 'potted_plant_small',
  'vendor_stall', 'painting', 'clock_wall', 'mirror', 'portrait',
  'reception_desk', 'bar_counter'
];

// ------------------------------------------------------------------
// Tile color palette — RGB hex for each floor type (render fallback)
// ------------------------------------------------------------------

/** @type {Object<string, string>} */
export const TILE_COLORS = {
  stone_mosaic:     '#8a8a95',
  stone_gray:       '#7a7a85',
  grass:            '#4a8c3f',
  sand:             '#d4b876',
  water:            '#3a8fb5',
  wood_light:       '#b8926a',
  wood_dark:        '#6b4f3a',
  carpet_red:       '#8a2a2a',
  carpet_green:     '#2a5a3a',
  neon_grid:        '#1a0a2e',
  marble_white:     '#e8e0d8',
  dirt:             '#8a6a4a',
  snow:             '#e8ecf0',
  ice:              '#a8d8e8',
  tile_terracotta:  '#b8623a'
};

// ------------------------------------------------------------------
// Wall color palette — RGB hex for each wall type (render fallback)
// ------------------------------------------------------------------

/** @type {Object<string, {top:string,left:string,right:string}>} */
export const WALL_COLORS = {
  wall_stone:   { top: '#9a9aa0', left: '#7a7a82', right: '#6a6a72' },
  wall_wood:    { top: '#8a6a4a', left: '#6a4a32', right: '#5a3e28' },
  wall_brick:   { top: '#9a5a4a', left: '#7a4538', right: '#6a3c30' },
  wall_mossy:   { top: '#6a8a5a', left: '#506a42', right: '#445a38' },
  wall_ice:     { top: '#b8d8e8', left: '#98b8c8', right: '#88a8b8' },
  wall_bamboo:  { top: '#c8b868', left: '#a89850', right: '#988848' },
  wall_plaster: { top: '#d8d0c0', left: '#b8b0a0', right: '#a8a090' }
};

// ------------------------------------------------------------------
// IsoMath helpers
// ------------------------------------------------------------------

/**
 * Convert tile coordinates to screen (canvas) coordinates.
 * @param {number} tx - Tile X (0..19).
 * @param {number} ty - Tile Y (0..19).
 * @param {number} [offX=0] - Camera offset X.
 * @param {number} [offY=0] - Camera offset Y.
 * @returns {{sx:number, sy:number}} Screen position of tile center.
 */
export function tileToScreen(tx, ty, offX = 0, offY = 0) {
  const sx = (tx - ty) * HALF_TILE_W + offX;
  const sy = (tx + ty) * HALF_TILE_H + offY;
  return { sx, sy };
}

/**
 * Convert screen coordinates back to tile coordinates.
 * @param {number} sx - Screen X.
 * @param {number} sy - Screen Y.
 * @param {number} [offX=0] - Camera offset X.
 * @param {number} [offY=0] - Camera offset Y.
 * @returns {{tx:number, ty:number}} Tile position (may be fractional).
 */
export function screenToTile(sx, sy, offX = 0, offY = 0) {
  const dx = sx - offX;
  const dy = sy - offY;
  const tx = (dx / HALF_TILE_W + dy / HALF_TILE_H) / 2;
  const ty = (dy / HALF_TILE_H - dx / HALF_TILE_W) / 2;
  return { tx, ty };
}

/**
 * Compute the depth sort key for a tile position (lower values = drawn first).
 * @param {number} tx
 * @param {number} ty
 * @returns {number}
 */
export function tileDepth(tx, ty) {
  return tx + ty;
}

// ------------------------------------------------------------------
// IsoAreaBackgrounds class
// ------------------------------------------------------------------

/**
 * Manages isometric background data and rendering for all 14 Starlight Inn areas.
 * Each area stores a 20x20 floor pattern, wall definitions, furniture props,
 * environmental palette, and ambient particle configuration.
 */
export class IsoBackgrounds
export default class IsoAreaBackgrounds {
  /**
   * @param {Object} game - The main Game instance.
   */
  constructor(game) {
    /** @type {Object} */
    this.game = game;

    /** @type {Object<string, AreaDef>} Map of areaId -> area definition. */
    this.areas = {};

    /** @private Cache of depth-sorted prop render lists per area. */
    this._propCache = new Map();

    this._initAreas();
  }

  // ================================================================
  //  Area initialization — all 14 areas
  // ================================================================

  /**
   * Initialize all 14 area definitions.
   * @private
   */
  _initAreas() {
    this._initStarlightPlaza();
    this._initMoonlitGardens();
    this._initCoralCove();
    this._initEmberTavern();
    this._initCrystalCaverns();
    this._initCloudNineLounge();
    this._initEnchantedForest();
    this._initFrostyPeaks();
    this._initStarlightInnLobby();
    this._initMysticBazaar();
    this._initSunsetBeach();
    this._initDarkwoodManor();
    this._initWinterWonderland();
    this._initTribalCamp();
  }

  // ================================================================
  // 1. Starlight Plaza (hub)
  // ================================================================

  /** @private */
  _initStarlightPlaza() {
    const W = AREA_WIDTH;
    const H = AREA_HEIGHT;
    const id = 'starlight_plaza';
    const name = 'Starlight Plaza';

    // Floor pattern: stone_mosaic center, stone_gray paths, grass borders
    const floorPattern = this._newGrid(W, H, 'grass');
    this._fillRect(floorPattern, 2, 2, 16, 16, 'stone_gray');
    this._fillRect(floorPattern, 5, 5, 10, 10, 'stone_mosaic');
    // Cross-shaped paths
    this._fillRect(floorPattern, 0, 9, 20, 2, 'stone_gray');
    this._fillRect(floorPattern, 9, 0, 2, 20, 'stone_gray');
    // Center mosaic
    this._fillRect(floorPattern, 7, 7, 6, 6, 'stone_mosaic');

    // Walls: partial stone walls for seating areas
    /** @type {WallDef[]} */
    const walls = [];
    // North seating wall
    walls.push(
      { x: 3, y: 3, type: 'wall_stone', faces: [true, true, false] },
      { x: 4, y: 3, type: 'wall_stone', faces: [true, false, false] },
      { x: 5, y: 3, type: 'wall_stone', faces: [true, false, true] }
    );
    // South seating wall
    walls.push(
      { x: 3, y: 14, type: 'wall_stone', faces: [false, true, false] },
      { x: 4, y: 14, type: 'wall_stone', faces: [false, false, false] },
      { x: 5, y: 14, type: 'wall_stone', faces: [false, false, true] }
    );
    // East seating wall
    walls.push(
      { x: 14, y: 3, type: 'wall_stone', faces: [true, true, false] },
      { x: 14, y: 4, type: 'wall_stone', faces: [false, true, false] },
      { x: 14, y: 5, type: 'wall_stone', faces: [false, true, true] }
    );

    // Props
    /** @type {PropDef[]} */
    const props = [];
    // Central fountain
    props.push({ furnitureId: 'fountain', tileX: 10, tileY: 10, rotation: 0 });
    // 6 benches
    props.push(
      { furnitureId: 'bench', tileX: 4, tileY: 5, rotation: 0 },
      { furnitureId: 'bench', tileX: 15, tileY: 5, rotation: 0 },
      { furnitureId: 'bench', tileX: 5, tileY: 14, rotation: 0 },
      { furnitureId: 'bench', tileX: 14, tileY: 14, rotation: 0 },
      { furnitureId: 'bench', tileX: 5, tileY: 10, rotation: 1 },
      { furnitureId: 'bench', tileX: 14, tileY: 10, rotation: 1 }
    );
    // 4 streetlamps
    props.push(
      { furnitureId: 'streetlamp', tileX: 2, tileY: 2, rotation: 0 },
      { furnitureId: 'streetlamp', tileX: 17, tileY: 2, rotation: 0 },
      { furnitureId: 'streetlamp', tileX: 2, tileY: 17, rotation: 0 },
      { furnitureId: 'streetlamp', tileX: 17, tileY: 17, rotation: 0 }
    );
    // 2 flower beds
    props.push(
      { furnitureId: 'flower_bed', tileX: 7, tileY: 4, rotation: 0 },
      { furnitureId: 'flower_bed', tileX: 12, tileY: 4, rotation: 0 }
    );
    // 4 oak trees at corners
    props.push(
      { furnitureId: 'tree_oak', tileX: 1, tileY: 1, rotation: 0 },
      { furnitureId: 'tree_oak', tileX: 18, tileY: 1, rotation: 0 },
      { furnitureId: 'tree_oak', tileX: 1, tileY: 18, rotation: 0 },
      { furnitureId: 'tree_oak', tileX: 18, tileY: 18, rotation: 0 }
    );
    // Info board
    props.push({ furnitureId: 'info_board', tileX: 10, tileY: 2, rotation: 0 });

    this.areas[id] = {
      id, name, width: W, height: H,
      floorType: 'stone_gray',
      floorPattern,
      walls,
      props,
      palette: {
        primary: '#8a8a95',
        secondary: '#b8a860',
        accent: '#4a8c3f',
        light: '#c8c8d0',
        shadow: '#5a5a62'
      },
      ambient: {
        particles: 'firefly',
        lightLevel: 0.85,
        weather: 'clear'
      },
      spawnPoint: { tileX: 10, tileY: 18 },
      portals: [
        { tileX: 0, tileY: 10, destArea: 'moonlit_gardens', destX: 18, destY: 10 },
        { tileX: 19, tileY: 10, destArea: 'mystic_bazaar', destX: 1, destY: 10 },
        { tileX: 10, tileY: 0, destArea: 'starlight_inn_lobby', destX: 10, destY: 18 }
      ]
    };
  }

  // ================================================================
  // 2. Moonlit Gardens
  // ================================================================

  /** @private */
  _initMoonlitGardens() {
    const W = AREA_WIDTH;
    const H = AREA_HEIGHT;
    const id = 'moonlit_gardens';
    const name = 'Moonlit Gardens';

    // Floor: grass with stone_gray winding paths
    const floorPattern = this._newGrid(W, H, 'grass');
    // Winding path from left to right
    this._pathCurve(floorPattern, [
      [1, 10], [3, 8], [5, 9], [7, 7], [9, 8], [11, 6],
      [13, 7], [15, 5], [17, 6], [18, 8]
    ], 'stone_gray', 2);
    // Secondary path
    this._pathCurve(floorPattern, [
      [10, 1], [8, 4], [9, 7], [10, 10], [11, 13], [10, 16], [10, 18]
    ], 'stone_gray', 2);
    // Central clearing
    this._fillCircle(floorPattern, 10, 10, 4, 'stone_gray');

    // Walls: mossy low garden walls
    /** @type {WallDef[]} */
    const walls = [];
    for (let x = 4; x <= 16; x++) {
      walls.push({ x, y: 4, type: 'wall_mossy', faces: [true, false, false] });
    }
    for (let x = 4; x <= 16; x++) {
      walls.push({ x, y: 16, type: 'wall_mossy', faces: [false, false, false] });
    }
    for (let y = 4; y <= 16; y++) {
      walls.push({ x: 4, y, type: 'wall_mossy', faces: [false, true, false] });
    }
    for (let y = 4; y <= 16; y++) {
      walls.push({ x: 16, y, type: 'wall_mossy', faces: [false, false, true] });
    }

    // Props
    /** @type {PropDef[]} */
    const props = [];
    // 4 benches
    props.push(
      { furnitureId: 'bench', tileX: 6, tileY: 6, rotation: 0 },
      { furnitureId: 'bench', tileX: 14, tileY: 6, rotation: 0 },
      { furnitureId: 'bench', tileX: 6, tileY: 14, rotation: 0 },
      { furnitureId: 'bench', tileX: 14, tileY: 14, rotation: 0 }
    );
    // 6 flower beds
    for (let i = 0; i < 6; i++) {
      const fx = 5 + (i % 3) * 5;
      const fy = 5 + Math.floor(i / 3) * 8;
      props.push({ furnitureId: 'flower_bed', tileX: fx, tileY: fy, rotation: 0 });
    }
    // 3 oak trees
    props.push(
      { furnitureId: 'tree_oak', tileX: 2, tileY: 3, rotation: 0 },
      { furnitureId: 'tree_oak', tileX: 17, tileY: 4, rotation: 0 },
      { furnitureId: 'tree_oak', tileX: 3, tileY: 16, rotation: 0 }
    );
    // 2 pine trees
    props.push(
      { furnitureId: 'tree_pine', tileX: 16, tileY: 2, rotation: 0 },
      { furnitureId: 'tree_pine', tileX: 2, tileY: 17, rotation: 0 }
    );
    // Central fountain
    props.push({ furnitureId: 'fountain', tileX: 10, tileY: 10, rotation: 0 });
    // Birdbath
    props.push({ furnitureId: 'birdbath', tileX: 8, tileY: 8, rotation: 0 });
    // 4 floor lamps
    props.push(
      { furnitureId: 'lamp_floor', tileX: 5, tileY: 10, rotation: 0 },
      { furnitureId: 'lamp_floor', tileX: 15, tileY: 10, rotation: 0 },
      { furnitureId: 'lamp_floor', tileX: 10, tileY: 5, rotation: 0 },
      { furnitureId: 'lamp_floor', tileX: 10, tileY: 15, rotation: 0 }
    );
    // 8 bushes
    const bushSpots = [[3, 5], [7, 3], [13, 3], [17, 7], [3, 13], [7, 17], [13, 17], [17, 13]];
    for (const [bx, by] of bushSpots) {
      props.push({ furnitureId: 'bush', tileX: bx, tileY: by, rotation: 0 });
    }
    // 4 large potted plants
    props.push(
      { furnitureId: 'potted_plant_large', tileX: 6, tileY: 10, rotation: 0 },
      { furnitureId: 'potted_plant_large', tileX: 14, tileY: 10, rotation: 0 },
      { furnitureId: 'potted_plant_large', tileX: 10, tileY: 6, rotation: 0 },
      { furnitureId: 'potted_plant_large', tileX: 10, tileY: 14, rotation: 0 }
    );

    this.areas[id] = {
      id, name, width: W, height: H,
      floorType: 'grass',
      floorPattern,
      walls,
      props,
      palette: {
        primary: '#2a5a3a',
        secondary: '#8a9aaa',
        accent: '#7a8a7a',
        light: '#b0c0b8',
        shadow: '#1a3a2a'
      },
      ambient: {
        particles: 'firefly',
        lightLevel: 0.65,
        weather: 'clear'
      },
      spawnPoint: { tileX: 1, tileY: 10 },
      portals: [
        { tileX: 19, tileY: 10, destArea: 'starlight_plaza', destX: 1, destY: 10 },
        { tileX: 10, tileY: 0, destArea: 'enchanted_forest', destX: 10, destY: 18 },
        { tileX: 10, tileY: 19, destArea: 'coral_cove', destX: 10, destY: 1 }
      ]
    };
  }

  // ================================================================
  // 3. Coral Cove (beach)
  // ================================================================

  /** @private */
  _initCoralCove() {
    const W = AREA_WIDTH;
    const H = AREA_HEIGHT;
    const id = 'coral_cove';
    const name = 'Coral Cove';

    // Floor: sand main, water edge, wood_light pier
    const floorPattern = this._newGrid(W, H, 'sand');
    // Water along the south and east edges
    this._fillRect(floorPattern, 15, 0, 5, 20, 'water');
    this._fillRect(floorPattern, 0, 15, 20, 5, 'water');
    // Wood pier extending into water
    this._fillRect(floorPattern, 12, 12, 3, 7, 'wood_light');
    this._fillRect(floorPattern, 12, 12, 7, 3, 'wood_light');
    // Wet sand near water
    this._fillRect(floorPattern, 13, 13, 2, 2, 'sand');

    // Walls: bamboo fence sections
    /** @type {WallDef[]} */
    const walls = [];
    for (let x = 1; x <= 11; x++) {
      walls.push({ x, y: 1, type: 'wall_bamboo', faces: [true, false, false] });
    }
    for (let y = 1; y <= 11; y++) {
      walls.push({ x: 1, y, type: 'wall_bamboo', faces: [false, true, false] });
    }

    // Props
    /** @type {PropDef[]} */
    const props = [];
    // 3 beach umbrellas
    props.push(
      { furnitureId: 'beach_umbrella', tileX: 4, tileY: 4, rotation: 0 },
      { furnitureId: 'beach_umbrella', tileX: 8, tileY: 5, rotation: 0 },
      { furnitureId: 'beach_umbrella', tileX: 6, tileY: 9, rotation: 0 }
    );
    // 2 benches
    props.push(
      { furnitureId: 'bench', tileX: 3, tileY: 8, rotation: 0 },
      { furnitureId: 'bench', tileX: 9, tileY: 3, rotation: 1 }
    );
    // 4 bar stools at tiki bar (on pier)
    props.push(
      { furnitureId: 'bar_stool', tileX: 13, tileY: 13, rotation: 0 },
      { furnitureId: 'bar_stool', tileX: 13, tileY: 14, rotation: 0 },
      { furnitureId: 'bar_stool', tileX: 14, tileY: 13, rotation: 0 },
      { furnitureId: 'bar_stool', tileX: 14, tileY: 14, rotation: 0 }
    );
    // Jukebox
    props.push({ furnitureId: 'jukebox', tileX: 13, tileY: 12, rotation: 0 });
    // 6 palm trees
    props.push(
      { furnitureId: 'palm_tree', tileX: 2, tileY: 2, rotation: 0 },
      { furnitureId: 'palm_tree', tileX: 5, tileY: 2, rotation: 0 },
      { furnitureId: 'palm_tree', tileX: 10, tileY: 3, rotation: 0 },
      { furnitureId: 'palm_tree', tileX: 3, tileY: 11, rotation: 0 },
      { furnitureId: 'palm_tree', tileX: 9, tileY: 10, rotation: 0 },
      { furnitureId: 'palm_tree', tileX: 11, tileY: 7, rotation: 0 }
    );
    // 2 surfboards leaning
    props.push(
      { furnitureId: 'surfboard', tileX: 11, tileY: 11, rotation: 0 },
      { furnitureId: 'surfboard', tileX: 12, tileY: 11, rotation: 1 }
    );
    // 4 rocks
    props.push(
      { furnitureId: 'rock', tileX: 7, tileY: 7, rotation: 0 },
      { furnitureId: 'rock', tileX: 14, tileY: 8, rotation: 0 },
      { furnitureId: 'rock', tileX: 8, tileY: 13, rotation: 0 },
      { furnitureId: 'rock', tileX: 16, tileY: 16, rotation: 0 }
    );
    // 1 treasure chest (buried)
    props.push({ furnitureId: 'chest_treasure', tileX: 6, tileY: 13, rotation: 0 });

    this.areas[id] = {
      id, name, width: W, height: H,
      floorType: 'sand',
      floorPattern,
      walls,
      props,
      palette: {
        primary: '#d4b876',
        secondary: '#3a8fb5',
        accent: '#e86838',
        light: '#f0d8a0',
        shadow: '#a08050'
      },
      ambient: {
        particles: 'sparkle',
        lightLevel: 0.90,
        weather: 'clear'
      },
      spawnPoint: { tileX: 6, tileY: 6 },
      portals: [
        { tileX: 10, tileY: 0, destArea: 'moonlit_gardens', destX: 10, destY: 18 },
        { tileX: 19, tileY: 5, destArea: 'sunset_beach', destX: 1, destY: 5 }
      ]
    };
  }

  // ================================================================
  // 4. Ember Tavern
  // ================================================================

  /** @private */
  _initEmberTavern() {
    const W = AREA_WIDTH;
    const H = AREA_HEIGHT;
    const id = 'ember_tavern';
    const name = 'Ember Tavern';

    // Floor: wood_dark main, carpet_red center area
    const floorPattern = this._newGrid(W, H, 'wood_dark');
    // Red carpet center
    this._fillRect(floorPattern, 4, 6, 12, 10, 'carpet_red');
    // Bar area
    this._fillRect(floorPattern, 2, 2, 16, 3, 'wood_dark');
    // Fireplace area
    this._fillRect(floorPattern, 8, 16, 4, 3, 'stone_gray');

    // Walls: wood all around, brick fireplace accent
    /** @type {WallDef[]} */
    const walls = [];
    // Full perimeter
    for (let x = 0; x < W; x++) {
      walls.push({ x, y: 0, type: 'wall_wood', faces: [true, x === 0, x === W - 1] });
    }
    for (let y = 1; y < H; y++) {
      walls.push({ x: 0, y, type: 'wall_wood', faces: [false, true, false] });
      walls.push({ x: W - 1, y, type: 'wall_wood', faces: [false, false, true] });
    }
    for (let x = 1; x < W - 1; x++) {
      walls.push({ x, y: H - 1, type: 'wall_wood', faces: [false, false, false] });
    }
    // Fireplace accent (brick) on north wall center
    walls.push(
      { x: 8, y: 0, type: 'wall_brick', faces: [true, false, false] },
      { x: 9, y: 0, type: 'wall_brick', faces: [true, false, false] },
      { x: 10, y: 0, type: 'wall_brick', faces: [true, false, false] },
      { x: 11, y: 0, type: 'wall_brick', faces: [true, false, false] }
    );

    // Props
    /** @type {PropDef[]} */
    const props = [];
    // Fireplace (centered on north wall)
    props.push({ furnitureId: 'fireplace', tileX: 9, tileY: 1, rotation: 0 });
    // 4 dining tables with 16 chairs (4 per table)
    const tableSpots = [[6, 8], [12, 8], [6, 13], [12, 13]];
    for (const [tx, ty] of tableSpots) {
      props.push({ furnitureId: 'dining_table', tileX: tx, tileY: ty, rotation: 0 });
      // 4 chairs per table
      props.push(
        { furnitureId: 'dining_chair', tileX: tx - 1, tileY: ty, rotation: 0 },
        { furnitureId: 'dining_chair', tileX: tx + 1, tileY: ty, rotation: 0 },
        { furnitureId: 'dining_chair', tileX: tx, tileY: ty - 1, rotation: 0 },
        { furnitureId: 'dining_chair', tileX: tx, tileY: ty + 1, rotation: 0 }
      );
    }
    // 6 bar stools at the bar counter
    props.push(
      { furnitureId: 'bar_stool', tileX: 4, tileY: 4, rotation: 0 },
      { furnitureId: 'bar_stool', tileX: 6, tileY: 4, rotation: 0 },
      { furnitureId: 'bar_stool', tileX: 8, tileY: 4, rotation: 0 },
      { furnitureId: 'bar_stool', tileX: 10, tileY: 4, rotation: 0 },
      { furnitureId: 'bar_stool', tileX: 12, tileY: 4, rotation: 0 },
      { furnitureId: 'bar_stool', tileX: 14, tileY: 4, rotation: 0 }
    );
    // Bar counter
    props.push({ furnitureId: 'bar_counter', tileX: 9, tileY: 3, rotation: 0 });
    // 3 chandeliers
    props.push(
      { furnitureId: 'chandelier', tileX: 9, tileY: 6, rotation: 0 },
      { furnitureId: 'chandelier', tileX: 6, tileY: 11, rotation: 0 },
      { furnitureId: 'chandelier', tileX: 12, tileY: 11, rotation: 0 }
    );
    // 6 candles
    props.push(
      { furnitureId: 'candle', tileX: 5, tileY: 7, rotation: 0 },
      { furnitureId: 'candle', tileX: 13, tileY: 7, rotation: 0 },
      { furnitureId: 'candle', tileX: 5, tileY: 14, rotation: 0 },
      { furnitureId: 'candle', tileX: 13, tileY: 14, rotation: 0 },
      { furnitureId: 'candle', tileX: 9, tileY: 10, rotation: 0 },
      { furnitureId: 'candle', tileX: 9, tileY: 14, rotation: 0 }
    );
    // 2 bookshelves
    props.push(
      { furnitureId: 'bookshelf', tileX: 1, tileY: 3, rotation: 0 },
      { furnitureId: 'bookshelf', tileX: 1, tileY: 5, rotation: 0 }
    );
    // Trophy case
    props.push({ furnitureId: 'trophy_case', tileX: 18, tileY: 3, rotation: 0 });
    // 2 rectangular rugs
    props.push(
      { furnitureId: 'rug_rect', tileX: 9, tileY: 9, rotation: 0 },
      { furnitureId: 'rug_rect', tileX: 9, tileY: 13, rotation: 0 }
    );

    this.areas[id] = {
      id, name, width: W, height: H,
      floorType: 'wood_dark',
      floorPattern,
      walls,
      props,
      palette: {
        primary: '#6b4f3a',
        secondary: '#8a2a2a',
        accent: '#d4a838',
        light: '#e8c868',
        shadow: '#3a2a1a'
      },
      ambient: {
        particles: 'dust',
        lightLevel: 0.55,
        weather: 'indoor'
      },
      spawnPoint: { tileX: 9, tileY: 17 },
      portals: [
        { tileX: 9, tileY: 19, destArea: 'starlight_inn_lobby', destX: 9, destY: 1 }
      ]
    };
  }

  // ================================================================
  // 5. Crystal Caverns
  // ================================================================

  /** @private */
  _initCrystalCaverns() {
    const W = AREA_WIDTH;
    const H = AREA_HEIGHT;
    const id = 'crystal_caverns';
    const name = 'Crystal Caverns';

    // Floor: stone_gray with neon_grid accent patches
    const floorPattern = this._newGrid(W, H, 'stone_gray');
    // Neon grid patches
    this._fillRect(floorPattern, 5, 5, 4, 4, 'neon_grid');
    this._fillRect(floorPattern, 12, 8, 4, 4, 'neon_grid');
    this._fillRect(floorPattern, 6, 13, 3, 3, 'neon_grid');
    // Ice patches
    this._fillRect(floorPattern, 2, 2, 3, 3, 'ice');
    this._fillRect(floorPattern, 15, 2, 3, 3, 'ice');
    this._fillRect(floorPattern, 15, 15, 3, 3, 'ice');

    // Walls: ice all around, mossy mixed in
    /** @type {WallDef[]} */
    const walls = [];
    for (let x = 0; x < W; x++) {
      walls.push({ x, y: 0, type: 'wall_ice', faces: [true, x === 0, x === W - 1] });
    }
    for (let y = 1; y < H; y++) {
      walls.push({ x: 0, y, type: 'wall_ice', faces: [false, true, false] });
      walls.push({ x: W - 1, y, type: 'wall_ice', faces: [false, false, true] });
    }
    for (let x = 1; x < W - 1; x++) {
      walls.push({ x, y: H - 1, type: 'wall_ice', faces: [false, false, false] });
    }
    // Mossy mixed sections
    for (let x = 3; x <= 7; x++) {
      walls.push({ x, y: H - 1, type: 'wall_mossy', faces: [false, false, false] });
    }
    for (let y = 5; y <= 10; y++) {
      walls.push({ x: 0, y, type: 'wall_mossy', faces: [false, true, false] });
    }

    // Props
    /** @type {PropDef[]} */
    const props = [];
    // 6 crystal clusters
    props.push(
      { furnitureId: 'crystal_cluster', tileX: 3, tileY: 3, rotation: 0 },
      { furnitureId: 'crystal_cluster', tileX: 16, tileY: 3, rotation: 0 },
      { furnitureId: 'crystal_cluster', tileX: 7, tileY: 7, rotation: 0 },
      { furnitureId: 'crystal_cluster', tileX: 14, tileY: 10, rotation: 0 },
      { furnitureId: 'crystal_cluster', tileX: 5, tileY: 15, rotation: 0 },
      { furnitureId: 'crystal_cluster', tileX: 16, tileY: 16, rotation: 0 }
    );
    // 4 rocks
    props.push(
      { furnitureId: 'rock', tileX: 2, tileY: 8, rotation: 0 },
      { furnitureId: 'rock', tileX: 17, tileY: 8, rotation: 0 },
      { furnitureId: 'rock', tileX: 8, tileY: 16, rotation: 0 },
      { furnitureId: 'rock', tileX: 12, tileY: 5, rotation: 0 }
    );
    // 4 hanging plants
    props.push(
      { furnitureId: 'potted_plant_hanging', tileX: 4, tileY: 1, rotation: 0 },
      { furnitureId: 'potted_plant_hanging', tileX: 10, tileY: 1, rotation: 0 },
      { furnitureId: 'potted_plant_hanging', tileX: 14, tileY: 1, rotation: 0 },
      { furnitureId: 'potted_plant_hanging', tileX: 18, tileY: 1, rotation: 0 }
    );
    // 4 floor lamps (glowing blue)
    props.push(
      { furnitureId: 'lamp_floor', tileX: 5, tileY: 5, rotation: 0 },
      { furnitureId: 'lamp_floor', tileX: 14, tileY: 5, rotation: 0 },
      { furnitureId: 'lamp_floor', tileX: 5, tileY: 14, rotation: 0 },
      { furnitureId: 'lamp_floor', tileX: 14, tileY: 14, rotation: 0 }
    );
    // 2 treasure chests
    props.push(
      { furnitureId: 'chest_treasure', tileX: 3, tileY: 16, rotation: 0 },
      { furnitureId: 'chest_treasure', tileX: 16, tileY: 6, rotation: 0 }
    );
    // 1 portal ring
    props.push({ furnitureId: 'portal_ring', tileX: 10, tileY: 10, rotation: 0 });

    this.areas[id] = {
      id, name, width: W, height: H,
      floorType: 'stone_gray',
      floorPattern,
      walls,
      props,
      palette: {
        primary: '#1a2a4a',
        secondary: '#3ac0d8',
        accent: '#8a5aaa',
        light: '#78d8f0',
        shadow: '#0a1528'
      },
      ambient: {
        particles: 'sparkle',
        lightLevel: 0.45,
        weather: 'indoor'
      },
      spawnPoint: { tileX: 10, tileY: 18 },
      portals: [
        { tileX: 10, tileY: 19, destArea: 'enchanted_forest', destX: 10, destY: 1 },
        { tileX: 10, tileY: 0, destArea: 'frosty_peaks', destX: 10, destY: 18 }
      ]
    };
  }

  // ================================================================
  // 6. Cloud Nine Lounge (sky)
  // ================================================================

  /** @private */
  _initCloudNineLounge() {
    const W = AREA_WIDTH;
    const H = AREA_HEIGHT;
    const id = 'cloud_nine_lounge';
    const name = 'Cloud Nine Lounge';

    // Floor: marble_white with neon_grid dance floor
    const floorPattern = this._newGrid(W, H, 'marble_white');
    // Dance floor section
    this._fillRect(floorPattern, 6, 6, 8, 8, 'neon_grid');
    // Border pattern
    for (let x = 0; x < W; x++) {
      floorPattern[0][x] = 'marble_white';
      floorPattern[H - 1][x] = 'marble_white';
    }
    for (let y = 0; y < H; y++) {
      floorPattern[y][0] = 'marble_white';
      floorPattern[y][W - 1] = 'marble_white';
    }

    // Walls: none (open sky — cloud props as boundaries)
    /** @type {WallDef[]} */
    const walls = [];

    // Props
    /** @type {PropDef[]} */
    const props = [];
    // 4 sofas
    props.push(
      { furnitureId: 'sofa', tileX: 3, tileY: 3, rotation: 0 },
      { furnitureId: 'sofa', tileX: 14, tileY: 3, rotation: 0 },
      { furnitureId: 'sofa', tileX: 3, tileY: 14, rotation: 0 },
      { furnitureId: 'sofa', tileX: 14, tileY: 14, rotation: 0 }
    );
    // 6 armchairs
    props.push(
      { furnitureId: 'armchair', tileX: 3, tileY: 6, rotation: 0 },
      { furnitureId: 'armchair', tileX: 3, tileY: 9, rotation: 0 },
      { furnitureId: 'armchair', tileX: 6, tileY: 3, rotation: 0 },
      { furnitureId: 'armchair', tileX: 14, tileY: 6, rotation: 0 },
      { furnitureId: 'armchair', tileX: 14, tileY: 9, rotation: 0 },
      { furnitureId: 'armchair', tileX: 11, tileY: 3, rotation: 0 }
    );
    // 4 coffee tables
    props.push(
      { furnitureId: 'coffee_table', tileX: 5, tileY: 5, rotation: 0 },
      { furnitureId: 'coffee_table', tileX: 12, tileY: 5, rotation: 0 },
      { furnitureId: 'coffee_table', tileX: 5, tileY: 12, rotation: 0 },
      { furnitureId: 'coffee_table', tileX: 12, tileY: 12, rotation: 0 }
    );
    // Disco ball
    props.push({ furnitureId: 'disco_ball', tileX: 10, tileY: 6, rotation: 0 });
    // Jukebox
    props.push({ furnitureId: 'jukebox', tileX: 16, tileY: 16, rotation: 0 });
    // 4 bar stools
    props.push(
      { furnitureId: 'bar_stool', tileX: 9, tileY: 2, rotation: 0 },
      { furnitureId: 'bar_stool', tileX: 10, tileY: 2, rotation: 0 },
      { furnitureId: 'bar_stool', tileX: 11, tileY: 2, rotation: 0 },
      { furnitureId: 'bar_stool', tileX: 12, tileY: 2, rotation: 0 }
    );
    // Bar counter
    props.push({ furnitureId: 'bar_counter', tileX: 10, tileY: 1, rotation: 0 });
    // 6 hanging plants
    props.push(
      { furnitureId: 'potted_plant_hanging', tileX: 2, tileY: 1, rotation: 0 },
      { furnitureId: 'potted_plant_hanging', tileX: 6, tileY: 1, rotation: 0 },
      { furnitureId: 'potted_plant_hanging', tileX: 14, tileY: 1, rotation: 0 },
      { furnitureId: 'potted_plant_hanging', tileX: 18, tileY: 1, rotation: 0 },
      { furnitureId: 'potted_plant_hanging', tileX: 2, tileY: 18, rotation: 0 },
      { furnitureId: 'potted_plant_hanging', tileX: 18, tileY: 18, rotation: 0 }
    );
    // 2 round rugs
    props.push(
      { furnitureId: 'rug_round', tileX: 10, tileY: 10, rotation: 0 },
      { furnitureId: 'rug_round', tileX: 5, tileY: 14, rotation: 0 }
    );

    this.areas[id] = {
      id, name, width: W, height: H,
      floorType: 'marble_white',
      floorPattern,
      walls,
      props,
      palette: {
        primary: '#e8e0d8',
        secondary: '#c8b888',
        accent: '#78b8d8',
        light: '#ffffff',
        shadow: '#c0c8d0'
      },
      ambient: {
        particles: 'sparkle',
        lightLevel: 0.95,
        weather: 'clear'
      },
      spawnPoint: { tileX: 10, tileY: 17 },
      portals: [
        { tileX: 10, tileY: 19, destArea: 'starlight_inn_lobby', destX: 10, destY: 1 },
        { tileX: 0, tileY: 10, destArea: 'aurora_lounge', destX: 18, destY: 10 }
      ]
    };
  }

  // ================================================================
  // 7. Enchanted Forest
  // ================================================================

  /** @private */
  _initEnchantedForest() {
    const W = AREA_WIDTH;
    const H = AREA_HEIGHT;
    const id = 'enchanted_forest';
    const name = 'Enchanted Forest';

    // Floor: grass with dirt paths
    const floorPattern = this._newGrid(W, H, 'grass');
    // Winding dirt paths
    this._pathCurve(floorPattern, [
      [1, 5], [3, 5], [5, 7], [7, 8], [9, 7], [11, 9],
      [13, 8], [15, 10], [17, 9], [18, 11]
    ], 'dirt', 2);
    this._pathCurve(floorPattern, [
      [5, 1], [6, 3], [8, 5], [10, 8], [12, 11], [10, 14],
      [8, 16], [9, 18]
    ], 'dirt', 2);
    // Mushroom ring clearing
    this._fillCircle(floorPattern, 10, 14, 3, 'dirt');

    // Walls: mossy tree-trunk walls (sparse, like tree borders)
    /** @type {WallDef[]} */
    const walls = [];
    for (let x = 0; x < W; x += 2) {
      walls.push({ x, y: 0, type: 'wall_mossy', faces: [true, x === 0, false] });
    }
    for (let y = 0; y < H; y += 2) {
      walls.push({ x: 0, y, type: 'wall_mossy', faces: [false, true, false] });
      walls.push({ x: W - 1, y, type: 'wall_mossy', faces: [false, false, true] });
    }

    // Props
    /** @type {PropDef[]} */
    const props = [];
    // 6 oak trees
    props.push(
      { furnitureId: 'tree_oak', tileX: 2, tileY: 2, rotation: 0 },
      { furnitureId: 'tree_oak', tileX: 17, tileY: 2, rotation: 0 },
      { furnitureId: 'tree_oak', tileX: 4, tileY: 10, rotation: 0 },
      { furnitureId: 'tree_oak', tileX: 15, tileY: 12, rotation: 0 },
      { furnitureId: 'tree_oak', tileX: 2, tileY: 16, rotation: 0 },
      { furnitureId: 'tree_oak', tileX: 17, tileY: 17, rotation: 0 }
    );
    // 4 pine trees
    props.push(
      { furnitureId: 'tree_pine', tileX: 8, tileY: 3, rotation: 0 },
      { furnitureId: 'tree_pine', tileX: 12, tileY: 4, rotation: 0 },
      { furnitureId: 'tree_pine', tileX: 6, tileY: 15, rotation: 0 },
      { furnitureId: 'tree_pine', tileX: 14, tileY: 16, rotation: 0 }
    );
    // 10 bushes
    const bushSpots = [
      [1, 3], [5, 1], [14, 1], [18, 5], [1, 12],
      [3, 18], [7, 17], [13, 18], [18, 14], [16, 8]
    ];
    for (const [bx, by] of bushSpots) {
      props.push({ furnitureId: 'bush', tileX: bx, tileY: by, rotation: 0 });
    }
    // 6 flower beds
    for (let i = 0; i < 6; i++) {
      props.push({
        furnitureId: 'flower_bed',
        tileX: 4 + (i % 3) * 6,
        tileY: 7 + Math.floor(i / 3) * 6,
        rotation: 0
      });
    }
    // 3 benches
    props.push(
      { furnitureId: 'bench', tileX: 9, tileY: 5, rotation: 0 },
      { furnitureId: 'bench', tileX: 5, tileY: 12, rotation: 1 },
      { furnitureId: 'bench', tileX: 14, tileY: 9, rotation: 1 }
    );
    // Fountain
    props.push({ furnitureId: 'fountain', tileX: 10, tileY: 10, rotation: 0 });
    // 4 floor lamps
    props.push(
      { furnitureId: 'lamp_floor', tileX: 8, tileY: 8, rotation: 0 },
      { furnitureId: 'lamp_floor', tileX: 12, tileY: 8, rotation: 0 },
      { furnitureId: 'lamp_floor', tileX: 8, tileY: 12, rotation: 0 },
      { furnitureId: 'lamp_floor', tileX: 12, tileY: 12, rotation: 0 }
    );
    // Mushroom ring
    props.push({ furnitureId: 'mushroom_ring', tileX: 10, tileY: 14, rotation: 0 });
    // 3 crystal clusters (magical)
    props.push(
      { furnitureId: 'crystal_cluster', tileX: 10, tileY: 4, rotation: 0 },
      { furnitureId: 'crystal_cluster', tileX: 4, tileY: 8, rotation: 0 },
      { furnitureId: 'crystal_cluster', tileX: 16, tileY: 6, rotation: 0 }
    );

    this.areas[id] = {
      id, name, width: W, height: H,
      floorType: 'grass',
      floorPattern,
      walls,
      props,
      palette: {
        primary: '#3a6a2a',
        secondary: '#6a5a3a',
        accent: '#9a5aaa',
        light: '#78a868',
        shadow: '#1a3a12'
      },
      ambient: {
        particles: 'firefly',
        lightLevel: 0.55,
        weather: 'clear'
      },
      spawnPoint: { tileX: 10, tileY: 18 },
      portals: [
        { tileX: 10, tileY: 19, destArea: 'moonlit_gardens', destX: 10, destY: 1 },
        { tileX: 10, tileY: 0, destArea: 'crystal_caverns', destX: 10, destY: 18 },
        { tileX: 0, tileY: 10, destArea: 'darkwood_manor', destX: 18, destY: 10 }
      ]
    };
  }

  // ================================================================
  // 8. Frosty Peaks (winter)
  // ================================================================

  /** @private */
  _initFrostyPeaks() {
    const W = AREA_WIDTH;
    const H = AREA_HEIGHT;
    const id = 'frosty_peaks';
    const name = 'Frosty Peaks';

    // Floor: snow with ice skating rink
    const floorPattern = this._newGrid(W, H, 'snow');
    // Ice skating rink center
    this._fillRect(floorPattern, 6, 6, 8, 8, 'ice');
    // Snow drifts (stone_gray as packed snow)
    this._fillRect(floorPattern, 2, 2, 3, 3, 'snow');
    this._fillRect(floorPattern, 15, 2, 3, 3, 'snow');
    this._fillRect(floorPattern, 2, 15, 3, 3, 'snow');
    this._fillRect(floorPattern, 15, 15, 3, 3, 'snow');

    // Walls: ice all around
    /** @type {WallDef[]} */
    const walls = [];
    for (let x = 0; x < W; x++) {
      walls.push({ x, y: 0, type: 'wall_ice', faces: [true, x === 0, x === W - 1] });
    }
    for (let y = 1; y < H; y++) {
      walls.push({ x: 0, y, type: 'wall_ice', faces: [false, true, false] });
      walls.push({ x: W - 1, y, type: 'wall_ice', faces: [false, false, true] });
    }
    for (let x = 1; x < W - 1; x++) {
      walls.push({ x, y: H - 1, type: 'wall_ice', faces: [false, false, false] });
    }

    // Props
    /** @type {PropDef[]} */
    const props = [];
    // 3 snowmen
    props.push(
      { furnitureId: 'snowman', tileX: 3, tileY: 5, rotation: 0 },
      { furnitureId: 'snowman', tileX: 16, tileY: 5, rotation: 0 },
      { furnitureId: 'snowman', tileX: 10, tileY: 3, rotation: 0 }
    );
    // 2 benches
    props.push(
      { furnitureId: 'bench', tileX: 5, tileY: 10, rotation: 0 },
      { furnitureId: 'bench', tileX: 14, tileY: 10, rotation: 0 }
    );
    // 4 streetlamps
    props.push(
      { furnitureId: 'streetlamp', tileX: 2, tileY: 2, rotation: 0 },
      { furnitureId: 'streetlamp', tileX: 17, tileY: 2, rotation: 0 },
      { furnitureId: 'streetlamp', tileX: 2, tileY: 17, rotation: 0 },
      { furnitureId: 'streetlamp', tileX: 17, tileY: 17, rotation: 0 }
    );
    // 4 pine trees (snow-covered)
    props.push(
      { furnitureId: 'tree_pine', tileX: 1, tileY: 8, rotation: 0 },
      { furnitureId: 'tree_pine', tileX: 18, tileY: 8, rotation: 0 },
      { furnitureId: 'tree_pine', tileX: 8, tileY: 1, rotation: 0 },
      { furnitureId: 'tree_pine', tileX: 11, tileY: 18, rotation: 0 }
    );
    // 2 rocks
    props.push(
      { furnitureId: 'rock', tileX: 5, tileY: 16, rotation: 0 },
      { furnitureId: 'rock', tileX: 14, tileY: 5, rotation: 0 }
    );
    // Outdoor fireplace
    props.push({ furnitureId: 'fireplace', tileX: 10, tileY: 16, rotation: 0 });
    // Frozen treasure chest
    props.push({ furnitureId: 'chest_treasure', tileX: 16, tileY: 16, rotation: 0 });

    this.areas[id] = {
      id, name, width: W, height: H,
      floorType: 'snow',
      floorPattern,
      walls,
      props,
      palette: {
        primary: '#a8c8d8',
        secondary: '#e8ecf0',
        accent: '#e88838',
        light: '#d8e8f0',
        shadow: '#6a8a9a'
      },
      ambient: {
        particles: 'sparkle',
        lightLevel: 0.70,
        weather: 'snow'
      },
      spawnPoint: { tileX: 10, tileY: 18 },
      portals: [
        { tileX: 10, tileY: 19, destArea: 'crystal_caverns', destX: 10, destY: 1 },
        { tileX: 10, tileY: 0, destArea: 'winter_wonderland', destX: 10, destY: 18 }
      ]
    };
  }

  // ================================================================
  // 9. Starlight Inn Lobby (main)
  // ================================================================

  /** @private */
  _initStarlightInnLobby() {
    const W = AREA_WIDTH;
    const H = AREA_HEIGHT;
    const id = 'starlight_inn_lobby';
    const name = 'Starlight Inn Lobby';

    // Floor: wood_light with carpet_red center runner
    const floorPattern = this._newGrid(W, H, 'wood_light');
    // Red carpet center runner
    this._fillRect(floorPattern, 7, 4, 6, 14, 'carpet_red');
    // Welcome mat area
    this._fillRect(floorPattern, 6, 16, 8, 3, 'carpet_red');
    // Side wood pattern
    this._fillRect(floorPattern, 2, 2, 4, 16, 'wood_light');
    this._fillRect(floorPattern, 14, 2, 4, 16, 'wood_light');

    // Walls: wood with plaster accent
    /** @type {WallDef[]} */
    const walls = [];
    for (let x = 0; x < W; x++) {
      const isAccent = x >= 6 && x <= 13;
      walls.push({
        x, y: 0,
        type: isAccent ? 'wall_plaster' : 'wall_wood',
        faces: [true, x === 0, x === W - 1]
      });
    }
    for (let y = 1; y < H; y++) {
      walls.push({ x: 0, y, type: 'wall_wood', faces: [false, true, false] });
      walls.push({ x: W - 1, y, type: 'wall_wood', faces: [false, false, true] });
    }
    for (let x = 1; x < W - 1; x++) {
      walls.push({ x, y: H - 1, type: 'wall_wood', faces: [false, false, false] });
    }

    // Props
    /** @type {PropDef[]} */
    const props = [];
    // Reception desk (centered on south wall)
    props.push({ furnitureId: 'reception_desk', tileX: 9, tileY: 16, rotation: 0 });
    // 2 sofas
    props.push(
      { furnitureId: 'sofa', tileX: 5, tileY: 8, rotation: 0 },
      { furnitureId: 'sofa', tileX: 13, tileY: 8, rotation: 0 }
    );
    // 4 armchairs
    props.push(
      { furnitureId: 'armchair', tileX: 4, tileY: 12, rotation: 0 },
      { furnitureId: 'armchair', tileX: 6, tileY: 12, rotation: 0 },
      { furnitureId: 'armchair', tileX: 13, tileY: 12, rotation: 0 },
      { furnitureId: 'armchair', tileX: 15, tileY: 12, rotation: 0 }
    );
    // 2 coffee tables
    props.push(
      { furnitureId: 'coffee_table', tileX: 5, tileY: 10, rotation: 0 },
      { furnitureId: 'coffee_table', tileX: 13, tileY: 10, rotation: 0 }
    );
    // 2 chandeliers
    props.push(
      { furnitureId: 'chandelier', tileX: 9, tileY: 6, rotation: 0 },
      { furnitureId: 'chandelier', tileX: 9, tileY: 12, rotation: 0 }
    );
    // 4 bookshelves
    props.push(
      { furnitureId: 'bookshelf', tileX: 1, tileY: 2, rotation: 0 },
      { furnitureId: 'bookshelf', tileX: 1, tileY: 5, rotation: 0 },
      { furnitureId: 'bookshelf', tileX: 18, tileY: 2, rotation: 0 },
      { furnitureId: 'bookshelf', tileX: 18, tileY: 5, rotation: 0 }
    );
    // Wall clock
    props.push({ furnitureId: 'clock_wall', tileX: 9, tileY: 1, rotation: 0 });
    // Round rug
    props.push({ furnitureId: 'rug_round', tileX: 9, tileY: 9, rotation: 0 });
    // 4 large potted plants
    props.push(
      { furnitureId: 'potted_plant_large', tileX: 3, tileY: 3, rotation: 0 },
      { furnitureId: 'potted_plant_large', tileX: 16, tileY: 3, rotation: 0 },
      { furnitureId: 'potted_plant_large', tileX: 3, tileY: 15, rotation: 0 },
      { furnitureId: 'potted_plant_large', tileX: 16, tileY: 15, rotation: 0 }
    );
    // 4 paintings
    props.push(
      { furnitureId: 'painting', tileX: 5, tileY: 1, rotation: 0 },
      { furnitureId: 'painting', tileX: 7, tileY: 1, rotation: 0 },
      { furnitureId: 'painting', tileX: 11, tileY: 1, rotation: 0 },
      { furnitureId: 'painting', tileX: 13, tileY: 1, rotation: 0 }
    );

    this.areas[id] = {
      id, name, width: W, height: H,
      floorType: 'wood_light',
      floorPattern,
      walls,
      props,
      palette: {
        primary: '#b8926a',
        secondary: '#e8e0d0',
        accent: '#8a2a2a',
        light: '#f0e8d8',
        shadow: '#7a6048'
      },
      ambient: {
        particles: 'dust',
        lightLevel: 0.80,
        weather: 'indoor'
      },
      spawnPoint: { tileX: 9, tileY: 14 },
      portals: [
        { tileX: 9, tileY: 0, destArea: 'starlight_plaza', destX: 9, destY: 18 },
        { tileX: 0, tileY: 9, destArea: 'ember_tavern', destX: 18, destY: 9 },
        { tileX: 9, tileY: 19, destArea: 'cloud_nine_lounge', destX: 9, destY: 1 },
        { tileX: 19, tileY: 9, destArea: 'mystic_bazaar', destX: 1, destY: 9 }
      ]
    };
  }

  // ================================================================
  // 10. Mystic Bazaar (market)
  // ================================================================

  /** @private */
  _initMysticBazaar() {
    const W = AREA_WIDTH;
    const H = AREA_HEIGHT;
    const id = 'mystic_bazaar';
    const name = 'Mystic Bazaar';

    // Floor: tile_terracotta main, stone_gray vendor aisles
    const floorPattern = this._newGrid(W, H, 'tile_terracotta');
    // Vendor aisles (stone_gray paths)
    this._fillRect(floorPattern, 3, 3, 2, 14, 'stone_gray');
    this._fillRect(floorPattern, 8, 3, 2, 14, 'stone_gray');
    this._fillRect(floorPattern, 13, 3, 2, 14, 'stone_gray');
    // Cross aisles
    this._fillRect(floorPattern, 3, 8, 14, 2, 'stone_gray');
    this._fillRect(floorPattern, 3, 14, 14, 2, 'stone_gray');

    // Walls: partial stone, bamboo sections
    /** @type {WallDef[]} */
    const walls = [];
    for (let x = 0; x < 6; x++) {
      walls.push({ x, y: 0, type: 'wall_stone', faces: [true, x === 0, false] });
    }
    for (let x = 14; x < W; x++) {
      walls.push({ x, y: 0, type: 'wall_stone', faces: [true, false, x === W - 1] });
    }
    for (let y = 0; y < 5; y++) {
      walls.push({ x: 0, y, type: 'wall_bamboo', faces: [false, true, false] });
    }
    for (let y = 15; y < H; y++) {
      walls.push({ x: W - 1, y, type: 'wall_bamboo', faces: [false, false, true] });
    }

    // Props
    /** @type {PropDef[]} */
    const props = [];
    // 8 vendor stalls (along the aisles)
    const stallSpots = [
      [2, 5], [6, 5], [11, 5], [16, 5],
      [2, 11], [6, 11], [11, 11], [16, 11]
    ];
    for (const [sx, sy] of stallSpots) {
      props.push({ furnitureId: 'vendor_stall', tileX: sx, tileY: sy, rotation: 0 });
    }
    // 2 benches
    props.push(
      { furnitureId: 'bench', tileX: 5, tileY: 17, rotation: 0 },
      { furnitureId: 'bench', tileX: 14, tileY: 17, rotation: 0 }
    );
    // 4 streetlamps
    props.push(
      { furnitureId: 'streetlamp', tileX: 1, tileY: 1, rotation: 0 },
      { furnitureId: 'streetlamp', tileX: 18, tileY: 1, rotation: 0 },
      { furnitureId: 'streetlamp', tileX: 1, tileY: 18, rotation: 0 },
      { furnitureId: 'streetlamp', tileX: 18, tileY: 18, rotation: 0 }
    );
    // 4 flower beds
    props.push(
      { furnitureId: 'flower_bed', tileX: 4, tileY: 2, rotation: 0 },
      { furnitureId: 'flower_bed', tileX: 9, tileY: 2, rotation: 0 },
      { furnitureId: 'flower_bed', tileX: 14, tileY: 2, rotation: 0 },
      { furnitureId: 'flower_bed', tileX: 17, tileY: 17, rotation: 0 }
    );
    // 2 oak trees
    props.push(
      { furnitureId: 'tree_oak', tileX: 1, tileY: 10, rotation: 0 },
      { furnitureId: 'tree_oak', tileX: 18, tileY: 10, rotation: 0 }
    );
    // 3 treasure chests
    props.push(
      { furnitureId: 'chest_treasure', tileX: 3, tileY: 3, rotation: 0 },
      { furnitureId: 'chest_treasure', tileX: 16, tileY: 16, rotation: 0 },
      { furnitureId: 'chest_treasure', tileX: 10, tileY: 10, rotation: 0 }
    );
    // 4 rectangular rugs (vendor display mats)
    props.push(
      { furnitureId: 'rug_rect', tileX: 5, tileY: 6, rotation: 0 },
      { furnitureId: 'rug_rect', tileX: 10, tileY: 6, rotation: 0 },
      { furnitureId: 'rug_rect', tileX: 5, tileY: 12, rotation: 0 },
      { furnitureId: 'rug_rect', tileX: 10, tileY: 12, rotation: 0 }
    );
    // 6 small potted plants
    for (let i = 0; i < 6; i++) {
      props.push({
        furnitureId: 'potted_plant_small',
        tileX: 2 + i * 3,
        tileY: 1 + (i % 2),
        rotation: 0
      });
    }

    this.areas[id] = {
      id, name, width: W, height: H,
      floorType: 'tile_terracotta',
      floorPattern,
      walls,
      props,
      palette: {
        primary: '#b8623a',
        secondary: '#7a7a85',
        accent: '#d4a838',
        light: '#d8a878',
        shadow: '#6a4028'
      },
      ambient: {
        particles: 'dust',
        lightLevel: 0.80,
        weather: 'clear'
      },
      spawnPoint: { tileX: 10, tileY: 18 },
      portals: [
        { tileX: 0, tileY: 10, destArea: 'starlight_plaza', destX: 18, destY: 10 },
        { tileX: 10, tileY: 0, destArea: 'starlight_inn_lobby', destX: 10, destY: 18 },
        { tileX: 19, tileY: 10, destArea: 'sunset_beach', destX: 1, destY: 10 }
      ]
    };
  }

  // ================================================================
  // 11. Sunset Beach (boardwalk)
  // ================================================================

  /** @private */
  _initSunsetBeach() {
    const W = AREA_WIDTH;
    const H = AREA_HEIGHT;
    const id = 'sunset_beach';
    const name = 'Sunset Beach';

    // Floor: wood_light boardwalk, sand beach, water ocean
    const floorPattern = this._newGrid(W, H, 'sand');
    // Boardwalk along the top
    this._fillRect(floorPattern, 0, 0, 20, 4, 'wood_light');
    // Water along the south
    this._fillRect(floorPattern, 0, 14, 20, 6, 'water');
    // Transition strip
    this._fillRect(floorPattern, 0, 12, 20, 2, 'sand');
    // Pier extending into water
    this._fillRect(floorPattern, 8, 14, 4, 5, 'wood_light');

    // Walls: bamboo railings along boardwalk edge
    /** @type {WallDef[]} */
    const walls = [];
    for (let x = 0; x < W; x++) {
      walls.push({ x, y: 4, type: 'wall_bamboo', faces: [true, x === 0, x === W - 1] });
    }

    // Props
    /** @type {PropDef[]} */
    const props = [];
    // 4 beach umbrellas (on sand)
    props.push(
      { furnitureId: 'beach_umbrella', tileX: 3, tileY: 8, rotation: 0 },
      { furnitureId: 'beach_umbrella', tileX: 8, tileY: 9, rotation: 0 },
      { furnitureId: 'beach_umbrella', tileX: 13, tileY: 8, rotation: 0 },
      { furnitureId: 'beach_umbrella', tileX: 17, tileY: 9, rotation: 0 }
    );
    // 4 benches (on boardwalk)
    props.push(
      { furnitureId: 'bench', tileX: 3, tileY: 2, rotation: 0 },
      { furnitureId: 'bench', tileX: 8, tileY: 2, rotation: 0 },
      { furnitureId: 'bench', tileX: 13, tileY: 2, rotation: 0 },
      { furnitureId: 'bench', tileX: 17, tileY: 2, rotation: 0 }
    );
    // 4 streetlamps (along boardwalk)
    props.push(
      { furnitureId: 'streetlamp', tileX: 1, tileY: 1, rotation: 0 },
      { furnitureId: 'streetlamp', tileX: 6, tileY: 1, rotation: 0 },
      { furnitureId: 'streetlamp', tileX: 12, tileY: 1, rotation: 0 },
      { furnitureId: 'streetlamp', tileX: 18, tileY: 1, rotation: 0 }
    );
    // 6 palm trees
    props.push(
      { furnitureId: 'palm_tree', tileX: 2, tileY: 6, rotation: 0 },
      { furnitureId: 'palm_tree', tileX: 5, tileY: 10, rotation: 0 },
      { furnitureId: 'palm_tree', tileX: 9, tileY: 7, rotation: 0 },
      { furnitureId: 'palm_tree', tileX: 14, tileY: 10, rotation: 0 },
      { furnitureId: 'palm_tree', tileX: 17, tileY: 6, rotation: 0 },
      { furnitureId: 'palm_tree', tileX: 10, tileY: 11, rotation: 0 }
    );
    // 3 surfboards
    props.push(
      { furnitureId: 'surfboard', tileX: 10, tileY: 8, rotation: 0 },
      { furnitureId: 'surfboard', tileX: 11, tileY: 8, rotation: 1 },
      { furnitureId: 'surfboard', tileX: 6, tileY: 9, rotation: 0 }
    );
    // 3 rocks
    props.push(
      { furnitureId: 'rock', tileX: 1, tileY: 13, rotation: 0 },
      { furnitureId: 'rock', tileX: 18, tileY: 13, rotation: 0 },
      { furnitureId: 'rock', tileX: 10, tileY: 13, rotation: 0 }
    );
    // 1 treasure chest
    props.push({ furnitureId: 'chest_treasure', tileX: 10, tileY: 17, rotation: 0 });

    this.areas[id] = {
      id, name, width: W, height: H,
      floorType: 'sand',
      floorPattern,
      walls,
      props,
      palette: {
        primary: '#d4a058',
        secondary: '#b8926a',
        accent: '#2a5a8a',
        light: '#f0b860',
        shadow: '#7a5030'
      },
      ambient: {
        particles: 'sparkle',
        lightLevel: 0.80,
        weather: 'clear'
      },
      spawnPoint: { tileX: 10, tileY: 3 },
      portals: [
        { tileX: 0, tileY: 10, destArea: 'mystic_bazaar', destX: 18, destY: 10 },
        { tileX: 19, tileY: 10, destArea: 'coral_cove', destX: 1, destY: 10 }
      ]
    };
  }

  // ================================================================
  // 12. Darkwood Manor (spooky)
  // ================================================================

  /** @private */
  _initDarkwoodManor() {
    const W = AREA_WIDTH;
    const H = AREA_HEIGHT;
    const id = 'darkwood_manor';
    const name = 'Darkwood Manor';

    // Floor: wood_dark with carpet_green (worn)
    const floorPattern = this._newGrid(W, H, 'wood_dark');
    // Worn green carpet
    this._fillRect(floorPattern, 4, 6, 12, 10, 'carpet_green');
    // Checkerboard wood pattern in corners
    this._fillRect(floorPattern, 2, 2, 5, 4, 'wood_dark');
    this._fillRect(floorPattern, 13, 2, 5, 4, 'wood_dark');

    // Walls: aged brick and dark wood
    /** @type {WallDef[]} */
    const walls = [];
    for (let x = 0; x < W; x++) {
      const isBrick = x >= 4 && x <= 15;
      walls.push({
        x, y: 0,
        type: isBrick ? 'wall_brick' : 'wall_wood',
        faces: [true, x === 0, x === W - 1]
      });
    }
    for (let y = 1; y < H; y++) {
      walls.push({ x: 0, y, type: 'wall_wood', faces: [false, true, false] });
      walls.push({ x: W - 1, y, type: 'wall_wood', faces: [false, false, true] });
    }
    for (let x = 1; x < W - 1; x++) {
      walls.push({ x, y: H - 1, type: 'wall_brick', faces: [false, false, false] });
    }

    // Props
    /** @type {PropDef[]} */
    const props = [];
    // 2 chandeliers (unlit)
    props.push(
      { furnitureId: 'chandelier', tileX: 7, tileY: 8, rotation: 0 },
      { furnitureId: 'chandelier', tileX: 13, tileY: 8, rotation: 0 }
    );
    // 3 bookshelves (cobwebbed)
    props.push(
      { furnitureId: 'bookshelf', tileX: 1, tileY: 3, rotation: 0 },
      { furnitureId: 'bookshelf', tileX: 1, tileY: 6, rotation: 0 },
      { furnitureId: 'bookshelf', tileX: 18, tileY: 3, rotation: 0 }
    );
    // 2 armchairs (torn)
    props.push(
      { furnitureId: 'armchair', tileX: 6, tileY: 10, rotation: 0 },
      { furnitureId: 'armchair', tileX: 14, tileY: 10, rotation: 0 }
    );
    // Cold fireplace
    props.push({ furnitureId: 'fireplace', tileX: 10, tileY: 1, rotation: 0 });
    // Cracked mirror
    props.push({ furnitureId: 'mirror', tileX: 16, tileY: 1, rotation: 0 });
    // Creepy portrait
    props.push({ furnitureId: 'portrait', tileX: 4, tileY: 1, rotation: 0 });
    // 4 candles
    props.push(
      { furnitureId: 'candle', tileX: 5, tileY: 8, rotation: 0 },
      { furnitureId: 'candle', tileX: 15, tileY: 8, rotation: 0 },
      { furnitureId: 'candle', tileX: 10, tileY: 12, rotation: 0 },
      { furnitureId: 'candle', tileX: 10, tileY: 6, rotation: 0 }
    );
    // Faded rug
    props.push({ furnitureId: 'rug_rect', tileX: 10, tileY: 10, rotation: 0 });

    this.areas[id] = {
      id, name, width: W, height: H,
      floorType: 'wood_dark',
      floorPattern,
      walls,
      props,
      palette: {
        primary: '#4a4a52',
        secondary: '#3a5a3a',
        accent: '#8a6a3a',
        light: '#6a6a72',
        shadow: '#1a1a22'
      },
      ambient: {
        particles: 'dust',
        lightLevel: 0.30,
        weather: 'indoor'
      },
      spawnPoint: { tileX: 10, tileY: 17 },
      portals: [
        { tileX: 19, tileY: 10, destArea: 'enchanted_forest', destX: 1, destY: 10 },
        { tileX: 10, tileY: 19, destArea: 'tribal_camp', destX: 10, destY: 1 }
      ]
    };
  }

  // ================================================================
  // 13. Winter Wonderland (holiday)
  // ================================================================

  /** @private */
  _initWinterWonderland() {
    const W = AREA_WIDTH;
    const H = AREA_HEIGHT;
    const id = 'winter_wonderland';
    const name = 'Winter Wonderland';

    // Floor: snow with ice paths
    const floorPattern = this._newGrid(W, H, 'snow');
    // Ice paths forming a pattern
    this._fillRect(floorPattern, 3, 3, 2, 14, 'ice');
    this._fillRect(floorPattern, 8, 3, 2, 14, 'ice');
    this._fillRect(floorPattern, 13, 3, 2, 14, 'ice');
    this._fillRect(floorPattern, 3, 3, 14, 2, 'ice');
    this._fillRect(floorPattern, 3, 8, 14, 2, 'ice');
    this._fillRect(floorPattern, 3, 14, 14, 2, 'ice');
    // Central ice rink
    this._fillRect(floorPattern, 7, 7, 6, 6, 'ice');

    // Walls: ice decorative (short sections)
    /** @type {WallDef[]} */
    const walls = [];
    for (let x = 0; x < 5; x++) {
      walls.push({ x, y: 0, type: 'wall_ice', faces: [true, x === 0, false] });
    }
    for (let x = 15; x < W; x++) {
      walls.push({ x, y: 0, type: 'wall_ice', faces: [true, false, x === W - 1] });
    }
    for (let y = 0; y < 4; y++) {
      walls.push({ x: 0, y, type: 'wall_ice', faces: [false, true, false] });
    }
    for (let y = 16; y < H; y++) {
      walls.push({ x: W - 1, y, type: 'wall_ice', faces: [false, false, true] });
    }

    // Props
    /** @type {PropDef[]} */
    const props = [];
    // 6 decorated pine trees
    props.push(
      { furnitureId: 'tree_pine', tileX: 2, tileY: 2, rotation: 0 },
      { furnitureId: 'tree_pine', tileX: 17, tileY: 2, rotation: 0 },
      { furnitureId: 'tree_pine', tileX: 5, tileY: 5, rotation: 0 },
      { furnitureId: 'tree_pine', tileX: 14, tileY: 5, rotation: 0 },
      { furnitureId: 'tree_pine', tileX: 5, tileY: 14, rotation: 0 },
      { furnitureId: 'tree_pine', tileX: 14, tileY: 14, rotation: 0 }
    );
    // 12 gift boxes (scattered)
    const giftSpots = [
      [4, 4], [6, 4], [4, 6], [15, 4], [16, 6], [15, 6],
      [4, 15], [6, 15], [4, 16], [15, 15], [16, 15], [15, 16]
    ];
    for (const [gx, gy] of giftSpots) {
      props.push({ furnitureId: 'gift_box', tileX: gx, tileY: gy, rotation: 0 });
    }
    // 4 snowmen
    props.push(
      { furnitureId: 'snowman', tileX: 3, tileY: 10, rotation: 0 },
      { furnitureId: 'snowman', tileX: 16, tileY: 10, rotation: 0 },
      { furnitureId: 'snowman', tileX: 10, tileY: 4, rotation: 0 },
      { furnitureId: 'snowman', tileX: 10, tileY: 16, rotation: 0 }
    );
    // 2 benches
    props.push(
      { furnitureId: 'bench', tileX: 6, tileY: 11, rotation: 0 },
      { furnitureId: 'bench', tileX: 13, tileY: 11, rotation: 0 }
    );
    // 6 streetlamps (glowing warm)
    props.push(
      { furnitureId: 'streetlamp', tileX: 1, tileY: 1, rotation: 0 },
      { furnitureId: 'streetlamp', tileX: 18, tileY: 1, rotation: 0 },
      { furnitureId: 'streetlamp', tileX: 1, tileY: 18, rotation: 0 },
      { furnitureId: 'streetlamp', tileX: 18, tileY: 18, rotation: 0 },
      { furnitureId: 'streetlamp', tileX: 9, tileY: 6, rotation: 0 },
      { furnitureId: 'streetlamp', tileX: 10, tileY: 6, rotation: 0 }
    );
    // Outdoor fireplace
    props.push({ furnitureId: 'fireplace', tileX: 10, tileY: 1, rotation: 0 });
    // Ice skating rink (center decoration)
    props.push({ furnitureId: 'ice_skating_rink', tileX: 10, tileY: 10, rotation: 0 });

    this.areas[id] = {
      id, name, width: W, height: H,
      floorType: 'snow',
      floorPattern,
      walls,
      props,
      palette: {
        primary: '#e8ecf0',
        secondary: '#c83030',
        accent: '#d4a838',
        light: '#ffffff',
        shadow: '#a0a8b0'
      },
      ambient: {
        particles: 'sparkle',
        lightLevel: 0.75,
        weather: 'snow'
      },
      spawnPoint: { tileX: 10, tileY: 18 },
      portals: [
        { tileX: 10, tileY: 19, destArea: 'frosty_peaks', destX: 10, destY: 1 },
        { tileX: 0, tileY: 10, destArea: 'tribal_camp', destX: 18, destY: 10 }
      ]
    };
  }

  // ================================================================
  // 14. Tribal Camp (jungle)
  // ================================================================

  /** @private */
  _initTribalCamp() {
    const W = AREA_WIDTH;
    const H = AREA_HEIGHT;
    const id = 'tribal_camp';
    const name = 'Tribal Camp';

    // Floor: dirt with grass patches, sand ceremony circle
    const floorPattern = this._newGrid(W, H, 'dirt');
    // Grass patches around edges
    this._fillRect(floorPattern, 0, 0, 5, 5, 'grass');
    this._fillRect(floorPattern, 15, 0, 5, 5, 'grass');
    this._fillRect(floorPattern, 0, 15, 5, 5, 'grass');
    this._fillRect(floorPattern, 15, 15, 5, 5, 'grass');
    // Sand ceremony circle center
    this._fillCircle(floorPattern, 10, 10, 4, 'sand');

    // Walls: bamboo totem fence (sparse)
    /** @type {WallDef[]} */
    const walls = [];
    for (let x = 0; x < W; x += 3) {
      walls.push({ x, y: 0, type: 'wall_bamboo', faces: [true, x === 0, false] });
    }
    for (let y = 0; y < H; y += 3) {
      walls.push({ x: 0, y, type: 'wall_bamboo', faces: [false, true, false] });
      walls.push({ x: W - 1, y, type: 'wall_bamboo', faces: [false, false, true] });
    }

    // Props
    /** @type {PropDef[]} */
    const props = [];
    // 8 tiki torches
    props.push(
      { furnitureId: 'tiki_torch', tileX: 3, tileY: 3, rotation: 0 },
      { furnitureId: 'tiki_torch', tileX: 16, tileY: 3, rotation: 0 },
      { furnitureId: 'tiki_torch', tileX: 3, tileY: 16, rotation: 0 },
      { furnitureId: 'tiki_torch', tileX: 16, tileY: 16, rotation: 0 },
      { furnitureId: 'tiki_torch', tileX: 7, tileY: 7, rotation: 0 },
      { furnitureId: 'tiki_torch', tileX: 13, tileY: 7, rotation: 0 },
      { furnitureId: 'tiki_torch', tileX: 7, tileY: 13, rotation: 0 },
      { furnitureId: 'tiki_torch', tileX: 13, tileY: 13, rotation: 0 }
    );
    // 3 totem poles
    props.push(
      { furnitureId: 'totem_pole', tileX: 5, tileY: 2, rotation: 0 },
      { furnitureId: 'totem_pole', tileX: 15, tileY: 2, rotation: 0 },
      { furnitureId: 'totem_pole', tileX: 10, tileY: 5, rotation: 0 }
    );
    // Drum circle (center)
    props.push({ furnitureId: 'drum_circle', tileX: 10, tileY: 10, rotation: 0 });
    // 6 log seat benches
    props.push(
      { furnitureId: 'bench', tileX: 8, tileY: 9, rotation: 0 },
      { furnitureId: 'bench', tileX: 12, tileY: 9, rotation: 0 },
      { furnitureId: 'bench', tileX: 8, tileY: 11, rotation: 0 },
      { furnitureId: 'bench', tileX: 12, tileY: 11, rotation: 0 },
      { furnitureId: 'bench', tileX: 9, tileY: 8, rotation: 1 },
      { furnitureId: 'bench', tileX: 11, tileY: 8, rotation: 1 }
    );
    // 4 large potted plants
    props.push(
      { furnitureId: 'potted_plant_large', tileX: 2, tileY: 7, rotation: 0 },
      { furnitureId: 'potted_plant_large', tileX: 17, tileY: 7, rotation: 0 },
      { furnitureId: 'potted_plant_large', tileX: 2, tileY: 12, rotation: 0 },
      { furnitureId: 'potted_plant_large', tileX: 17, tileY: 12, rotation: 0 }
    );
    // 4 palm trees
    props.push(
      { furnitureId: 'palm_tree', tileX: 1, tileY: 1, rotation: 0 },
      { furnitureId: 'palm_tree', tileX: 18, tileY: 1, rotation: 0 },
      { furnitureId: 'palm_tree', tileX: 1, tileY: 18, rotation: 0 },
      { furnitureId: 'palm_tree', tileX: 18, tileY: 18, rotation: 0 }
    );
    // 4 flower beds
    props.push(
      { furnitureId: 'flower_bed', tileX: 5, tileY: 5, rotation: 0 },
      { furnitureId: 'flower_bed', tileX: 15, tileY: 5, rotation: 0 },
      { furnitureId: 'flower_bed', tileX: 5, tileY: 15, rotation: 0 },
      { furnitureId: 'flower_bed', tileX: 15, tileY: 15, rotation: 0 }
    );
    // Central campfire
    props.push({ furnitureId: 'campfire', tileX: 10, tileY: 10, rotation: 0 });

    this.areas[id] = {
      id, name, width: W, height: H,
      floorType: 'dirt',
      floorPattern,
      walls,
      props,
      palette: {
        primary: '#8a6a4a',
        secondary: '#4a8c3f',
        accent: '#e86828',
        light: '#b89868',
        shadow: '#4a3a28'
      },
      ambient: {
        particles: 'firefly',
        lightLevel: 0.60,
        weather: 'clear'
      },
      spawnPoint: { tileX: 10, tileY: 17 },
      portals: [
        { tileX: 10, tileY: 0, destArea: 'darkwood_manor', destX: 10, destY: 18 },
        { tileX: 19, tileY: 10, destArea: 'winter_wonderland', destX: 1, destY: 10 }
      ]
    };
  }

  // ================================================================
  //  Public API
  // ================================================================

  /**
   * Retrieve an area definition by its ID.
   * @param {string} areaId
   * @returns {AreaDef|undefined}
   */
  getArea(areaId) {
    return this.areas[areaId];
  }

  /**
   * Get a list of all defined area IDs.
   * @returns {string[]}
   */
  getAreaIds() {
    return Object.keys(this.areas);
  }

  /**
   * Get the floor type at a specific tile.
   * @param {string} areaId
   * @param {number} tileX
   * @param {number} tileY
   * @returns {string} Floor type ID, or 'stone_gray' as default.
   */
  getTileAt(areaId, tileX, tileY) {
    const area = this.areas[areaId];
    if (!area) return 'stone_gray';
    if (tileX < 0 || tileX >= area.width || tileY < 0 || tileY >= area.height) {
      return area.floorType;
    }
    return area.floorPattern[tileY][tileX];
  }

  /**
   * Check if a tile is walkable (not blocked by water, walls, or solid props).
   * @param {string} areaId
   * @param {number} tileX
     * @param {number} tileY
   * @returns {boolean}
   */
  isTileWalkable(areaId, tileX, tileY) {
    const area = this.areas[areaId];
    if (!area) return false;
    if (tileX < 0 || tileX >= area.width || tileY < 0 || tileY >= area.height) {
      return false;
    }
    const tile = area.floorPattern[tileY][tileX];
    // Water tiles are not walkable
    if (tile === 'water') return false;
    // Check wall tiles
    for (const wall of area.walls) {
      if (wall.x === tileX && wall.y === tileY) return false;
    }
    // Check solid props (some props block movement)
    const solidProps = [
      'fountain', 'tree_oak', 'tree_pine', 'bookshelf', 'fireplace',
      'vendor_stall', 'reception_desk', 'bar_counter', 'totem_pole',
      'crystal_cluster', 'rock', 'chest_treasure', 'palm_tree',
      'surfboard', 'trophy_case', 'mirror', 'portrait', 'clock_wall',
      'painting', 'drum_circle', 'campfire', 'bar_stool', 'dining_table',
      'sofa', 'armchair', 'coffee_table', 'bench'
    ];
    for (const prop of area.props) {
      if (prop.tileX === tileX && prop.tileY === tileY) {
        if (solidProps.includes(prop.furnitureId)) return false;
      }
    }
    return true;
  }

  /**
   * Return all walkable tile coordinates for an area.
   * @param {string} areaId
   * @returns {{tileX:number, tileY:number}[]}
   */
  getWalkableTiles(areaId) {
    const area = this.areas[areaId];
    if (!area) return [];
    const walkable = [];
    for (let y = 0; y < area.height; y++) {
      for (let x = 0; x < area.width; x++) {
        if (this.isTileWalkable(areaId, x, y)) {
          walkable.push({ tileX: x, tileY: y });
        }
      }
    }
    return walkable;
  }

  /**
   * Return the default spawn point for an area.
   * @param {string} areaId
   * @returns {{tileX:number, tileY:number}}
   */
  getSpawnPoint(areaId) {
    const area = this.areas[areaId];
    if (!area) return { tileX: 10, tileY: 10 };
    return area.spawnPoint || { tileX: 10, tileY: 10 };
  }

  /**
   * Return portal tile locations with their destination areas.
   * @param {string} areaId
   * @returns {{tileX:number, tileY:number, destArea:string, destX:number, destY:number}[]}
   */
  getPortalTiles(areaId) {
    const area = this.areas[areaId];
    if (!area || !area.portals) return [];
    return area.portals.map(p => ({
      tileX: p.tileX,
      tileY: p.tileY,
      destArea: p.destArea,
      destX: p.destX,
      destY: p.destY
    }));
  }

  // ================================================================
  //  Rendering
  // ================================================================

  /**
   * Render the complete isometric background for an area.
   * Draws floor tiles (back-to-front), walls, depth-sorted props,
   * and ambient effects.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} areaId
   * @param {{x:number, y:number, zoom:number}} camera
   */
  renderArea(ctx, areaId, camera) {
    const area = this.areas[areaId];
    if (!area) return;

    const cx = ctx.canvas.width / 2 + camera.x;
    const cy = camera.y;
    const zoom = camera.zoom || 1;

    ctx.save();
    ctx.scale(zoom, zoom);

    this._renderFloor(ctx, area, cx, cy);
    this._renderWalls(ctx, area, cx, cy);
    this._renderProps(ctx, area, cx, cy);
    this._renderAmbientOverlay(ctx, area);

    ctx.restore();
  }

  /**
   * Render floor tiles in back-to-front painter's order.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {AreaDef} area
   * @param {number} cx - Camera center X.
   * @param {number} cy - Camera offset Y.
   */
  _renderFloor(ctx, area, cx, cy) {
    const W = area.width;
    const H = area.height;
    const offY = cy + HALF_TILE_H;

    // Back-to-front: iterate diagonals from top-back to bottom-front
    for (let diag = 0; diag < W + H - 1; diag++) {
      for (let tx = 0; tx <= diag; tx++) {
        const ty = diag - tx;
        if (tx >= W || ty < 0 || ty >= H) continue;

        const floorType = area.floorPattern[ty][tx];
        const color = TILE_COLORS[floorType] || TILE_COLORS.stone_gray;

        const { sx, sy } = tileToScreen(tx, ty, cx, offY);

        // Draw diamond tile
        this._drawDiamondTile(ctx, sx, sy, color, floorType);
      }
    }
  }

  /**
   * Render wall facets on top of the floor.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {AreaDef} area
   * @param {number} cx
   * @param {number} cy
   */
  _renderWalls(ctx, area, cx, cy) {
    const offY = cy + HALF_TILE_H;

    for (const wall of area.walls) {
      const colors = WALL_COLORS[wall.type] || WALL_COLORS.wall_stone;
      const { sx, sy } = tileToScreen(wall.x, wall.y, cx, offY);

      // Top face (always drawn)
      if (wall.faces[0]) {
        this._drawWallTop(ctx, sx, sy, colors.top);
      }
      // Left face
      if (wall.faces[1]) {
        this._drawWallLeft(ctx, sx, sy, colors.left);
      }
      // Right face
      if (wall.faces[2]) {
        this._drawWallRight(ctx, sx, sy, colors.right);
      }
    }
  }

  /**
   * Render props depth-sorted back-to-front.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {AreaDef} area
   * @param {number} cx
   * @param {number} cy
   */
  _renderProps(ctx, area, cx, cy) {
    const offY = cy + HALF_TILE_H;

    // Sort props by tile depth (tx + ty) for correct occlusion
    const sorted = area.props.slice().sort((a, b) => {
      return tileDepth(a.tileX, a.tileY) - tileDepth(b.tileX, b.tileY);
    });

    for (const prop of sorted) {
      const { sx, sy } = tileToScreen(prop.tileX, prop.tileY, cx, offY);
      this._drawProp(ctx, prop, sx, sy);
    }
  }

  /**
   * Draw ambient lighting overlay based on area palette.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {AreaDef} area
   */
  _renderAmbientOverlay(ctx, area) {
    const { ambient, palette } = area;
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;

    // Light level vignette
    const lightLevel = ambient.lightLevel || 0.8;
    if (lightLevel < 1.0) {
      const darkness = 1.0 - lightLevel;
      const gradient = ctx.createRadialGradient(
        W / 2, H / 2, Math.min(W, H) * 0.2,
        W / 2, H / 2, Math.max(W, H) * 0.7
      );
      const baseColor = palette.shadow || '#000000';
      const r = parseInt(baseColor.slice(1, 3), 16);
      const g = parseInt(baseColor.slice(3, 5), 16);
      const b = parseInt(baseColor.slice(5, 7), 16);
      gradient.addColorStop(0, `rgba(${r},${g},${b},0)`);
      gradient.addColorStop(1, `rgba(${r},${g},${b},${darkness.toFixed(3)})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ================================================================
  //  Primitive drawing helpers
  // ================================================================

  /**
   * Draw an isometric diamond tile.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} sx - Screen center X.
   * @param {number} sy - Screen center Y.
   * @param {string} color - Base tile color.
   * @param {string} floorType - Floor type ID for texture variation.
   */
  _drawDiamondTile(ctx, sx, sy, color, floorType) {
    // Top face (lighter)
    const lightColor = this._lightenColor(color, 15);
    ctx.fillStyle = lightColor;
    ctx.beginPath();
    ctx.moveTo(sx, sy - HALF_TILE_H);
    ctx.lineTo(sx + HALF_TILE_W, sy);
    ctx.lineTo(sx, sy + HALF_TILE_H);
    ctx.lineTo(sx - HALF_TILE_W, sy);
    ctx.closePath();
    ctx.fill();

    // Subtle edge lines
    ctx.strokeStyle = this._darkenColor(color, 10);
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Floor-type-specific detail
    switch (floorType) {
      case 'water':
        this._drawWaterRipple(ctx, sx, sy, color);
        break;
      case 'grass':
        this._drawGrassTuft(ctx, sx, sy, color);
        break;
      case 'neon_grid':
        this._drawNeonGrid(ctx, sx, sy);
        break;
      case 'stone_mosaic':
        this._drawMosaicPattern(ctx, sx, sy, color);
        break;
      case 'snow':
        this._drawSnowSparkle(ctx, sx, sy);
        break;
      case 'ice':
        this._drawIceReflect(ctx, sx, sy, color);
        break;
    }
  }

  /**
   * Draw a water ripple effect on a tile.
   * @private
   */
  _drawWaterRipple(ctx, sx, sy, color) {
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sx, sy, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx, sy, 12, 0.5, Math.PI);
    ctx.stroke();
  }

  /**
   * Draw small grass tufts on a grass tile.
   * @private
   */
  _drawGrassTuft(ctx, sx, sy, color) {
    ctx.fillStyle = this._lightenColor(color, 20);
    for (let i = 0; i < 3; i++) {
      const ox = (Math.sin(i * 2.1) * 8);
      const oy = (Math.cos(i * 1.7) * 4) - 4;
      ctx.fillRect(sx + ox - 1, sy + oy - 2, 2, 4);
    }
  }

  /**
   * Draw neon grid lines on a dance floor tile.
   * @private
   */
  _drawNeonGrid(ctx, sx, sy) {
    ctx.strokeStyle = 'rgba(180,80,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - HALF_TILE_W + 4, sy);
    ctx.lineTo(sx + HALF_TILE_W - 4, sy);
    ctx.moveTo(sx, sy - HALF_TILE_H + 4);
    ctx.lineTo(sx, sy + HALF_TILE_H - 4);
    ctx.stroke();
  }

  /**
   * Draw mosaic tile pattern.
   * @private
   */
  _drawMosaicPattern(ctx, sx, sy, color) {
    ctx.fillStyle = this._darkenColor(color, 15);
    ctx.fillRect(sx - 6, sy - 3, 4, 4);
    ctx.fillRect(sx + 2, sy + 1, 4, 4);
    ctx.fillStyle = this._lightenColor(color, 15);
    ctx.fillRect(sx - 2, sy - 6, 4, 4);
    ctx.fillRect(sx + 4, sy - 2, 4, 4);
  }

  /**
   * Draw subtle snow sparkle.
   * @private
   */
  _drawSnowSparkle(ctx, sx, sy) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(sx - 4, sy - 4, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw ice reflection highlight.
   * @private
   */
  _drawIceReflect(ctx, sx, sy, color) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.moveTo(sx - 8, sy - 4);
    ctx.lineTo(sx - 2, sy - 8);
    ctx.lineTo(sx + 4, sy - 6);
    ctx.lineTo(sx - 2, sy - 2);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Draw the top face of a wall block.
   * @private
   */
  _drawWallTop(ctx, sx, sy, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(sx - HALF_TILE_W, sy - HALF_TILE_H);
    ctx.lineTo(sx, sy - HALF_TILE_H * 2);
    ctx.lineTo(sx + HALF_TILE_W, sy - HALF_TILE_H);
    ctx.lineTo(sx, sy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = this._darkenColor(color, 15);
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  /**
   * Draw the left face of a wall block.
   * @private
   */
  _drawWallLeft(ctx, sx, sy, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(sx - HALF_TILE_W, sy - HALF_TILE_H);
    ctx.lineTo(sx, sy);
    ctx.lineTo(sx, sy + WALL_HEIGHT);
    ctx.lineTo(sx - HALF_TILE_W, sy + WALL_HEIGHT - HALF_TILE_H);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = this._darkenColor(color, 15);
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  /**
   * Draw the right face of a wall block.
   * @private
   */
  _drawWallRight(ctx, sx, sy, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(sx + HALF_TILE_W, sy - HALF_TILE_H);
    ctx.lineTo(sx, sy);
    ctx.lineTo(sx, sy + WALL_HEIGHT);
    ctx.lineTo(sx + HALF_TILE_W, sy + WALL_HEIGHT - HALF_TILE_H);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = this._darkenColor(color, 15);
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  /**
   * Draw a furniture prop at the given screen position.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {PropDef} prop
   * @param {number} sx
   * @param {number} sy
   */
  _drawProp(ctx, prop, sx, sy) {
    // Props are drawn offset upward from the tile center (sitting on the floor)
    const px = sx;
    const py = sy - 12;

    switch (prop.furnitureId) {
      case 'fountain':
        this._drawFountain(ctx, px, py);
        break;
      case 'bench':
        this._drawBench(ctx, px, py, prop.rotation);
        break;
      case 'streetlamp':
        this._drawStreetlamp(ctx, px, py);
        break;
      case 'flower_bed':
        this._drawFlowerBed(ctx, px, py);
        break;
      case 'tree_oak':
        this._drawTreeOak(ctx, px, py);
        break;
      case 'tree_pine':
        this._drawTreePine(ctx, px, py);
        break;
      case 'info_board':
        this._drawInfoBoard(ctx, px, py);
        break;
      case 'birdbath':
        this._drawBirdbath(ctx, px, py);
        break;
      case 'lamp_floor':
        this._drawFloorLamp(ctx, px, py);
        break;
      case 'bush':
        this._drawBush(ctx, px, py);
        break;
      case 'potted_plant_large':
        this._drawPottedPlantLarge(ctx, px, py);
        break;
      case 'potted_plant_hanging':
        this._drawHangingPlant(ctx, px, py);
        break;
      case 'beach_umbrella':
        this._drawBeachUmbrella(ctx, px, py);
        break;
      case 'bar_stool':
        this._drawBarStool(ctx, px, py);
        break;
      case 'jukebox':
        this._drawJukebox(ctx, px, py);
        break;
      case 'palm_tree':
        this._drawPalmTree(ctx, px, py);
        break;
      case 'surfboard':
        this._drawSurfboard(ctx, px, py, prop.rotation);
        break;
      case 'rock':
        this._drawRock(ctx, px, py);
        break;
      case 'chest_treasure':
        this._drawTreasureChest(ctx, px, py);
        break;
      case 'fireplace':
        this._drawFireplace(ctx, px, py);
        break;
      case 'dining_table':
        this._drawDiningTable(ctx, px, py);
        break;
      case 'dining_chair':
        this._drawDiningChair(ctx, px, py, prop.rotation);
        break;
      case 'chandelier':
        this._drawChandelier(ctx, px, py);
        break;
      case 'candle':
        this._drawCandle(ctx, px, py);
        break;
      case 'bookshelf':
        this._drawBookshelf(ctx, px, py);
        break;
      case 'trophy_case':
        this._drawTrophyCase(ctx, px, py);
        break;
      case 'rug_rect':
        this._drawRugRect(ctx, px, py);
        break;
      case 'rug_round':
        this._drawRugRound(ctx, px, py);
        break;
      case 'crystal_cluster':
        this._drawCrystalCluster(ctx, px, py);
        break;
      case 'portal_ring':
        this._drawPortalRing(ctx, px, py);
        break;
      case 'sofa':
        this._drawSofa(ctx, px, py, prop.rotation);
        break;
      case 'armchair':
        this._drawArmchair(ctx, px, py, prop.rotation);
        break;
      case 'coffee_table':
        this._drawCoffeeTable(ctx, px, py);
        break;
      case 'disco_ball':
        this._drawDiscoBall(ctx, px, py);
        break;
      case 'mushroom_ring':
        this._drawMushroomRing(ctx, px, py);
        break;
      case 'snowman':
        this._drawSnowman(ctx, px, py);
        break;
      case 'gift_box':
        this._drawGiftBox(ctx, px, py);
        break;
      case 'ice_skating_rink':
        this._drawIceRink(ctx, px, py);
        break;
      case 'tiki_torch':
        this._drawTikiTorch(ctx, px, py);
        break;
      case 'totem_pole':
        this._drawTotemPole(ctx, px, py);
        break;
      case 'drum_circle':
        this._drawDrumCircle(ctx, px, py);
        break;
      case 'campfire':
        this._drawCampfire(ctx, px, py);
        break;
      case 'potted_plant_small':
        this._drawPottedPlantSmall(ctx, px, py);
        break;
      case 'vendor_stall':
        this._drawVendorStall(ctx, px, py);
        break;
      case 'painting':
        this._drawPainting(ctx, px, py);
        break;
      case 'clock_wall':
        this._drawClockWall(ctx, px, py);
        break;
      case 'mirror':
        this._drawMirror(ctx, px, py);
        break;
      case 'portrait':
        this._drawPortrait(ctx, px, py);
        break;
      case 'reception_desk':
        this._drawReceptionDesk(ctx, px, py);
        break;
      case 'bar_counter':
        this._drawBarCounter(ctx, px, py);
        break;
      default:
        // Generic fallback: colored diamond
        ctx.fillStyle = '#ff00ff';
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fill();
    }
  }

  // ================================================================
  //  Individual prop renderers
  // ================================================================

  /** @private */
  _drawFountain(ctx, x, y) {
    // Base
    ctx.fillStyle = '#8a8a95';
    this._isoCircle(ctx, x, y + 8, 14);
    // Water
    ctx.fillStyle = '#4a9aaa';
    this._isoCircle(ctx, x, y + 6, 10);
    // Jet
    ctx.fillStyle = '#7ac8d8';
    ctx.beginPath();
    ctx.arc(x, y - 8, 4, 0, Math.PI * 2);
    ctx.fill();
    // Glow
    ctx.fillStyle = 'rgba(122,200,216,0.2)';
    ctx.beginPath();
    ctx.arc(x, y - 8, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawBench(ctx, x, y, rotation) {
    const isHorizontal = rotation === 0 || rotation === 2;
    ctx.fillStyle = '#7a5a3a';
    if (isHorizontal) {
      ctx.fillRect(x - 14, y - 4, 28, 10);
      ctx.fillStyle = '#5a3a22';
      ctx.fillRect(x - 12, y - 6, 4, 16);
      ctx.fillRect(x + 8, y - 6, 4, 16);
    } else {
      ctx.fillRect(x - 4, y - 14, 10, 28);
      ctx.fillStyle = '#5a3a22';
      ctx.fillRect(x - 6, y - 12, 16, 4);
      ctx.fillRect(x - 6, y + 8, 16, 4);
    }
  }

  /** @private */
  _drawStreetlamp(ctx, x, y) {
    // Pole
    ctx.fillStyle = '#4a4a52';
    ctx.fillRect(x - 2, y - 28, 4, 36);
    // Lamp head
    ctx.fillStyle = '#6a6a72';
    ctx.beginPath();
    ctx.arc(x, y - 30, 6, 0, Math.PI * 2);
    ctx.fill();
    // Glow
    ctx.fillStyle = 'rgba(255,220,120,0.35)';
    ctx.beginPath();
    ctx.arc(x, y - 30, 16, 0, Math.PI * 2);
    ctx.fill();
    // Light center
    ctx.fillStyle = '#ffe8a0';
    ctx.beginPath();
    ctx.arc(x, y - 30, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawFlowerBed(ctx, x, y) {
    // Bed base
    ctx.fillStyle = '#6a5a3a';
    this._isoCircle(ctx, x, y + 4, 12);
    // Flowers
    const colors = ['#ff6b6b', '#ffd93d', '#ff8fab', '#c77dff', '#ffaa55'];
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const fx = x + Math.cos(angle) * 6;
      const fy = y + 4 + Math.sin(angle) * 3;
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.arc(fx, fy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Center
    ctx.fillStyle = '#6b8c42';
    ctx.beginPath();
    ctx.arc(x, y + 4, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawTreeOak(ctx, x, y) {
    // Trunk
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(x - 4, y - 20, 8, 24);
    // Canopy layers
    ctx.fillStyle = '#4a7a32';
    this._isoCircle(ctx, x, y - 28, 18);
    ctx.fillStyle = '#5a8a3a';
    this._isoCircle(ctx, x - 6, y - 24, 12);
    ctx.fillStyle = '#3a6a28';
    this._isoCircle(ctx, x + 6, y - 22, 14);
    // Highlight
    ctx.fillStyle = 'rgba(120,180,80,0.15)';
    this._isoCircle(ctx, x, y - 32, 10);
  }

  /** @private */
  _drawTreePine(ctx, x, y) {
    // Trunk
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(x - 3, y - 16, 6, 20);
    // Pine tiers
    ctx.fillStyle = '#2a5a28';
    this._drawIsoTriangle(ctx, x, y - 36, 20, 16);
    ctx.fillStyle = '#3a6a32';
    this._drawIsoTriangle(ctx, x, y - 28, 16, 14);
    ctx.fillStyle = '#2d5a2a';
    this._drawIsoTriangle(ctx, x, y - 22, 12, 12);
    // Snow cap for winter areas
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(x, y - 38, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawInfoBoard(ctx, x, y) {
    // Post
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(x - 3, y - 16, 6, 20);
    // Board
    ctx.fillStyle = '#b8a070';
    ctx.fillRect(x - 14, y - 28, 28, 16);
    // Frame
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 14, y - 28, 28, 16);
    // Text lines
    ctx.fillStyle = '#3a2a12';
    ctx.fillRect(x - 10, y - 24, 20, 2);
    ctx.fillRect(x - 10, y - 20, 16, 2);
    ctx.fillRect(x - 10, y - 16, 18, 2);
  }

  /** @private */
  _drawBirdbath(ctx, x, y) {
    // Pedestal
    ctx.fillStyle = '#9a9aa0';
    ctx.fillRect(x - 3, y - 10, 6, 14);
    // Bowl
    ctx.fillStyle = '#a8a8b0';
    ctx.beginPath();
    ctx.ellipse(x, y - 12, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Water
    ctx.fillStyle = '#7ac8d8';
    ctx.beginPath();
    ctx.ellipse(x, y - 13, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawFloorLamp(ctx, x, y) {
    // Base
    ctx.fillStyle = '#5a4a3a';
    this._isoCircle(ctx, x, y + 6, 5);
    // Pole
    ctx.fillStyle = '#7a6a52';
    ctx.fillRect(x - 2, y - 20, 4, 28);
    // Shade
    ctx.fillStyle = '#d8c8a0';
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 20);
    ctx.lineTo(x + 8, y - 20);
    ctx.lineTo(x + 5, y - 30);
    ctx.lineTo(x - 5, y - 30);
    ctx.closePath();
    ctx.fill();
    // Glow
    ctx.fillStyle = 'rgba(255,220,140,0.25)';
    ctx.beginPath();
    ctx.arc(x, y - 22, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawBush(ctx, x, y) {
    ctx.fillStyle = '#4a7a32';
    this._isoCircle(ctx, x, y, 10);
    ctx.fillStyle = '#3a6a28';
    this._isoCircle(ctx, x - 4, y - 2, 7);
    ctx.fillStyle = '#5a8a3a';
    this._isoCircle(ctx, x + 4, y + 2, 8);
    // Berries
    ctx.fillStyle = '#d84848';
    ctx.beginPath();
    ctx.arc(x + 3, y - 3, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawPottedPlantLarge(ctx, x, y) {
    // Pot
    ctx.fillStyle = '#a06040';
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 4);
    ctx.lineTo(x + 8, y - 4);
    ctx.lineTo(x + 6, y + 8);
    ctx.lineTo(x - 6, y + 8);
    ctx.closePath();
    ctx.fill();
    // Plant
    ctx.fillStyle = '#4a8a32';
    this._isoCircle(ctx, x, y - 14, 14);
    ctx.fillStyle = '#3a7a28';
    this._isoCircle(ctx, x - 6, y - 12, 10);
    ctx.fillStyle = '#5a9a3a';
    this._isoCircle(ctx, x + 6, y - 10, 11);
  }

  /** @private */
  _drawHangingPlant(ctx, x, y) {
    // Hook
    ctx.fillStyle = '#6a6a72';
    ctx.fillRect(x - 1, y - 24, 2, 8);
    // Pot
    ctx.fillStyle = '#8a6a42';
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 16);
    ctx.lineTo(x + 6, y - 16);
    ctx.lineTo(x + 4, y - 6);
    ctx.lineTo(x - 4, y - 6);
    ctx.closePath();
    ctx.fill();
    // Vines
    ctx.fillStyle = '#4a8a32';
    for (let i = 0; i < 4; i++) {
      const vx = x - 4 + i * 3;
      const len = 8 + Math.sin(i * 2) * 4;
      ctx.fillRect(vx - 1, y - 8, 2, len);
    }
    // Leaves
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(x + (i - 2) * 4, y + (i % 2) * 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** @private */
  _drawBeachUmbrella(ctx, x, y) {
    // Pole
    ctx.fillStyle = '#d0a858';
    ctx.fillRect(x - 2, y - 28, 4, 32);
    // Canopy
    ctx.fillStyle = '#e84848';
    ctx.beginPath();
    ctx.moveTo(x - 18, y - 20);
    ctx.lineTo(x + 18, y - 20);
    ctx.lineTo(x, y - 42);
    ctx.closePath();
    ctx.fill();
    // Stripe
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 20);
    ctx.lineTo(x + 6, y - 20);
    ctx.lineTo(x, y - 42);
    ctx.closePath();
    ctx.fill();
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    this._isoCircle(ctx, x, y + 4, 12);
  }

  /** @private */
  _drawBarStool(ctx, x, y) {
    // Seat
    ctx.fillStyle = '#8a6a42';
    ctx.beginPath();
    ctx.ellipse(x, y - 10, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Leg
    ctx.fillStyle = '#6a5a42';
    ctx.fillRect(x - 2, y - 10, 4, 14);
    // Base
    ctx.fillStyle = '#5a4a32';
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawJukebox(ctx, x, y) {
    // Body
    ctx.fillStyle = '#8a2a2a';
    ctx.fillRect(x - 12, y - 28, 24, 32);
    // Top dome
    ctx.fillStyle = '#a03030';
    ctx.beginPath();
    ctx.arc(x, y - 28, 12, Math.PI, 0);
    ctx.fill();
    // Speaker grill
    ctx.fillStyle = '#6a2020';
    ctx.fillRect(x - 8, y - 16, 16, 10);
    // Lights
    ctx.fillStyle = '#40d0ff';
    ctx.fillRect(x - 6, y - 22, 3, 3);
    ctx.fillRect(x + 3, y - 22, 3, 3);
    ctx.fillRect(x - 6, y - 6, 3, 3);
    ctx.fillRect(x + 3, y - 6, 3, 3);
    // Records visible
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(x - 2, y - 12, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawPalmTree(ctx, x, y) {
    // Trunk (curved)
    ctx.fillStyle = '#9a7a42';
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 4);
    ctx.quadraticCurveTo(x + 6, y - 12, x + 4, y - 28);
    ctx.lineTo(x + 8, y - 28);
    ctx.quadraticCurveTo(x + 10, y - 10, x + 2, y + 4);
    ctx.closePath();
    ctx.fill();
    // Fronds
    ctx.fillStyle = '#4a8a32';
    const frondBaseX = x + 6;
    const frondBaseY = y - 28;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(frondBaseX, frondBaseY);
      ctx.quadraticCurveTo(
        frondBaseX + Math.cos(angle) * 20,
        frondBaseY + Math.sin(angle) * 8 - 8,
        frondBaseX + Math.cos(angle) * 30,
        frondBaseY + Math.sin(angle) * 6
      );
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#4a8a32';
      ctx.stroke();
    }
    // Coconuts
    ctx.fillStyle = '#6a4a2a';
    ctx.beginPath();
    ctx.arc(frondBaseX - 2, frondBaseY + 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(frondBaseX + 4, frondBaseY + 5, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawSurfboard(ctx, x, y, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation * Math.PI / 2);
    // Board
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.ellipse(0, -8, 6, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    // Stripe
    ctx.fillStyle = '#e84848';
    ctx.fillRect(-2, -20, 4, 24);
    ctx.restore();
  }

  /** @private */
  _drawRock(ctx, x, y) {
    ctx.fillStyle = '#8a8a90';
    this._isoCircle(ctx, x, y + 2, 10);
    ctx.fillStyle = '#9a9aa0';
    this._isoCircle(ctx, x - 3, y, 7);
    ctx.fillStyle = '#7a7a82';
    this._isoCircle(ctx, x + 4, y + 3, 6);
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawTreasureChest(ctx, x, y) {
    // Box
    ctx.fillStyle = '#a07828';
    ctx.fillRect(x - 10, y - 8, 20, 14);
    // Lid
    ctx.fillStyle = '#b08830';
    ctx.beginPath();
    ctx.arc(x, y - 8, 10, Math.PI, 0);
    ctx.fill();
    // Bands
    ctx.fillStyle = '#7a6020';
    ctx.fillRect(x - 8, y - 10, 3, 14);
    ctx.fillRect(x + 5, y - 10, 3, 14);
    // Lock
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(x, y - 6, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawFireplace(ctx, x, y) {
    // Structure
    ctx.fillStyle = '#8a5a4a';
    ctx.fillRect(x - 14, y - 20, 28, 24);
    // Opening
    ctx.fillStyle = '#2a1a12';
    ctx.fillRect(x - 10, y - 16, 20, 16);
    // Fire
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.moveTo(x - 6, y);
    ctx.lineTo(x + 6, y);
    ctx.lineTo(x, y - 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.moveTo(x - 3, y);
    ctx.lineTo(x + 3, y);
    ctx.lineTo(x, y - 10);
    ctx.closePath();
    ctx.fill();
    // Glow
    ctx.fillStyle = 'rgba(255,100,30,0.2)';
    ctx.beginPath();
    ctx.arc(x, y - 6, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawDiningTable(ctx, x, y) {
    // Table top
    ctx.fillStyle = '#8a6a42';
    this._isoCircle(ctx, x, y, 16);
    // Center
    ctx.fillStyle = '#7a5a38';
    this._isoCircle(ctx, x, y, 12);
    // Cloth
    ctx.fillStyle = 'rgba(255,240,220,0.3)';
    this._isoCircle(ctx, x, y - 1, 14);
  }

  /** @private */
  _drawDiningChair(ctx, x, y, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation * Math.PI / 2);
    // Back
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(-8, -10, 16, 4);
    // Seat
    ctx.fillStyle = '#8a6a42';
    ctx.fillRect(-8, -6, 16, 10);
    // Legs
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(-7, 4, 3, 6);
    ctx.fillRect(4, 4, 3, 6);
    ctx.restore();
  }

  /** @private */
  _drawChandelier(ctx, x, y) {
    // Chain
    ctx.fillStyle = '#5a5a62';
    ctx.fillRect(x - 1, y - 24, 2, 16);
    // Frame
    ctx.fillStyle = '#d4a838';
    ctx.beginPath();
    ctx.arc(x, y - 8, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b89828';
    ctx.beginPath();
    ctx.arc(x, y - 8, 8, 0, Math.PI * 2);
    ctx.fill();
    // Candles
    ctx.fillStyle = '#fff8e0';
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const cx = x + Math.cos(angle) * 10;
      const cy = y - 8 + Math.sin(angle) * 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Glow
    ctx.fillStyle = 'rgba(255,220,120,0.2)';
    ctx.beginPath();
    ctx.arc(x, y - 8, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawCandle(ctx, x, y) {
    // Holder
    ctx.fillStyle = '#8a7a42';
    ctx.beginPath();
    ctx.arc(x, y + 2, 5, 0, Math.PI * 2);
    ctx.fill();
    // Candle
    ctx.fillStyle = '#f0e8d0';
    ctx.fillRect(x - 3, y - 10, 6, 12);
    // Wick
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(x - 1, y - 13, 2, 3);
    // Flame
    ctx.fillStyle = '#ffcc40';
    ctx.beginPath();
    ctx.ellipse(x, y - 16, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Glow
    ctx.fillStyle = 'rgba(255,180,60,0.2)';
    ctx.beginPath();
    ctx.arc(x, y - 12, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawBookshelf(ctx, x, y) {
    // Frame
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(x - 12, y - 28, 24, 32);
    // Shelves
    ctx.fillStyle = '#7a5a32';
    ctx.fillRect(x - 10, y - 24, 20, 3);
    ctx.fillRect(x - 10, y - 16, 20, 3);
    ctx.fillRect(x - 10, y - 8, 20, 3);
    // Books
    const colors = ['#8a2a2a', '#2a4a6a', '#4a6a2a', '#6a2a6a', '#8a6a2a'];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        ctx.fillStyle = colors[(row + col) % colors.length];
        ctx.fillRect(x - 9 + col * 5, y - 22 + row * 8, 4, 6);
      }
    }
  }

  /** @private */
  _drawTrophyCase(ctx, x, y) {
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(x - 14, y - 28, 28, 32);
    ctx.fillStyle = '#8a7a52';
    ctx.fillRect(x - 12, y - 26, 24, 28);
    // Glass
    ctx.fillStyle = 'rgba(200,220,240,0.25)';
    ctx.fillRect(x - 10, y - 24, 20, 20);
    // Trophy inside
    ctx.fillStyle = '#d4a838';
    ctx.beginPath();
    ctx.arc(x, y - 14, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 1, y - 8, 2, 6);
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 2);
    ctx.lineTo(x + 4, y - 2);
    ctx.lineTo(x + 3, y + 2);
    ctx.lineTo(x - 3, y + 2);
    ctx.closePath();
    ctx.fill();
  }

  /** @private */
  _drawRugRect(ctx, x, y) {
    ctx.fillStyle = '#8a2a2a';
    ctx.beginPath();
    ctx.moveTo(x - 18, y);
    ctx.lineTo(x, y - 9);
    ctx.lineTo(x + 18, y);
    ctx.lineTo(x, y + 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9a3a3a';
    ctx.beginPath();
    ctx.moveTo(x - 14, y);
    ctx.lineTo(x, y - 7);
    ctx.lineTo(x + 14, y);
    ctx.lineTo(x, y + 7);
    ctx.closePath();
    ctx.fill();
  }

  /** @private */
  _drawRugRound(ctx, x, y) {
    ctx.fillStyle = '#8a2a2a';
    this._isoCircle(ctx, x, y, 14);
    ctx.fillStyle = '#9a3a3a';
    this._isoCircle(ctx, x, y, 10);
    ctx.fillStyle = '#aa4a4a';
    this._isoCircle(ctx, x, y, 6);
  }

  /** @private */
  _drawCrystalCluster(ctx, x, y) {
    const hues = ['#7ac8d8', '#a878d8', '#78d8a8'];
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const h = 10 + Math.sin(i * 3) * 6;
      const cx = x + Math.cos(angle) * 6;
      const cy = y + Math.sin(angle) * 3;
      ctx.fillStyle = hues[i % hues.length];
      ctx.beginPath();
      ctx.moveTo(cx, cy + 4);
      ctx.lineTo(cx + 4, cy - h / 2);
      ctx.lineTo(cx - 4, cy - h / 2);
      ctx.closePath();
      ctx.fill();
    }
    // Glow base
    ctx.fillStyle = 'rgba(122,200,216,0.15)';
    this._isoCircle(ctx, x, y + 4, 12);
  }

  /** @private */
  _drawPortalRing(ctx, x, y) {
    // Outer ring
    ctx.strokeStyle = '#a878f0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y - 12, 18, 0, Math.PI * 2);
    ctx.stroke();
    // Inner ring
    ctx.strokeStyle = '#c8a0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y - 12, 12, 0, Math.PI * 2);
    ctx.stroke();
    // Center glow
    ctx.fillStyle = 'rgba(160,120,240,0.3)';
    ctx.beginPath();
    ctx.arc(x, y - 12, 10, 0, Math.PI * 2);
    ctx.fill();
    // Swirl effect
    ctx.strokeStyle = 'rgba(200,160,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.2) {
      const r = 6 + a * 0.5;
      const px = x + Math.cos(a) * r;
      const py = y - 12 + Math.sin(a) * r * 0.5;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  /** @private */
  _drawSofa(ctx, x, y, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation * Math.PI / 2);
    ctx.fillStyle = '#7a4a6a';
    ctx.fillRect(-16, -10, 32, 20);
    ctx.fillStyle = '#6a3a5a';
    ctx.fillRect(-16, -14, 32, 6);
    ctx.fillRect(-18, -10, 4, 20);
    ctx.fillRect(14, -10, 4, 20);
    ctx.restore();
  }

  /** @private */
  _drawArmchair(ctx, x, y, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation * Math.PI / 2);
    ctx.fillStyle = '#6a4a5a';
    ctx.fillRect(-10, -10, 20, 20);
    ctx.fillStyle = '#5a3a4a';
    ctx.fillRect(-10, -14, 20, 6);
    ctx.fillRect(-12, -10, 4, 20);
    ctx.fillRect(8, -10, 4, 20);
    ctx.restore();
  }

  /** @private */
  _drawCoffeeTable(ctx, x, y) {
    ctx.fillStyle = '#8a6a42';
    this._isoCircle(ctx, x, y, 12);
    ctx.fillStyle = '#7a5a38';
    this._isoCircle(ctx, x, y, 9);
    // Items on table
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - 3, y - 2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 3, y + 1, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawDiscoBall(ctx, x, y) {
    // Chain
    ctx.fillStyle = '#6a6a72';
    ctx.fillRect(x - 1, y - 32, 2, 14);
    // Ball
    ctx.fillStyle = '#a0a0b0';
    ctx.beginPath();
    ctx.arc(x, y - 18, 10, 0, Math.PI * 2);
    ctx.fill();
    // Facets
    ctx.fillStyle = '#c0c0d0';
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const dx = x - 6 + col * 4;
        const dy = y - 24 + row * 4;
        ctx.fillRect(dx, dy, 3, 3);
      }
    }
    // Light beams
    ctx.strokeStyle = 'rgba(255,100,200,0.15)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Date.now() * 0.001;
      ctx.beginPath();
      ctx.moveTo(x, y - 18);
      ctx.lineTo(x + Math.cos(angle) * 40, y - 18 + Math.sin(angle) * 20);
      ctx.stroke();
    }
  }

  /** @private */
  _drawMushroomRing(ctx, x, y) {
    const count = 8;
    const radius = 14;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const mx = x + Math.cos(angle) * radius;
      const my = y + Math.sin(angle) * radius * 0.5;
      // Stem
      ctx.fillStyle = '#e8dcc8';
      ctx.fillRect(mx - 2, my - 6, 4, 8);
      // Cap
      const capColors = ['#d84848', '#e86868', '#c83838', '#ff7070'];
      ctx.fillStyle = capColors[i % capColors.length];
      ctx.beginPath();
      ctx.arc(mx, my - 8, 5, Math.PI, 0);
      ctx.fill();
      // Spots
      ctx.fillStyle = '#f0f0d0';
      ctx.beginPath();
      ctx.arc(mx - 2, my - 10, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** @private */
  _drawSnowman(ctx, x, y) {
    // Base
    ctx.fillStyle = '#e8ecf0';
    ctx.beginPath();
    ctx.arc(x, y + 4, 10, 0, Math.PI * 2);
    ctx.fill();
    // Mid
    ctx.fillStyle = '#f0f4f8';
    ctx.beginPath();
    ctx.arc(x, y - 8, 7, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(x, y - 18, 5, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.arc(x - 2, y - 20, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 2, y - 20, 1, 0, Math.PI * 2);
    ctx.fill();
    // Nose (carrot)
    ctx.fillStyle = '#ff8830';
    ctx.beginPath();
    ctx.moveTo(x, y - 18);
    ctx.lineTo(x + 5, y - 17);
    ctx.lineTo(x, y - 16);
    ctx.closePath();
    ctx.fill();
    // Hat
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x - 6, y - 26, 12, 4);
    ctx.fillRect(x - 4, y - 30, 8, 6);
    // Buttons
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.arc(x, y - 10, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y - 6, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawGiftBox(ctx, x, y) {
    const colors = ['#d83030', '#30a830', '#3080d8', '#d8a030', '#a030d8'];
    const idx = Math.abs((x * 7 + y * 13) % colors.length);
    ctx.fillStyle = colors[idx];
    ctx.fillRect(x - 6, y - 8, 12, 10);
    // Ribbon
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(x - 1, y - 8, 2, 10);
    ctx.fillRect(x - 6, y - 4, 12, 2);
    // Bow
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(x - 3, y - 10, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 3, y - 10, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawIceRink(ctx, x, y) {
    // Already rendered as ice floor tiles; draw decorative border
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 40, 0, Math.PI * 2);
    ctx.stroke();
    // Skate marks
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * 15, y + Math.sin(angle) * 8);
      ctx.lineTo(x + Math.cos(angle) * 30, y + Math.sin(angle) * 15);
      ctx.stroke();
    }
  }

  /** @private */
  _drawTikiTorch(ctx, x, y) {
    // Pole
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(x - 2, y - 24, 4, 28);
    // Mask head
    ctx.fillStyle = '#a07838';
    ctx.beginPath();
    ctx.arc(x, y - 26, 7, 0, Math.PI * 2);
    ctx.fill();
    // Face
    ctx.fillStyle = '#3a2a1a';
    ctx.beginPath();
    ctx.arc(x - 2, y - 28, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 2, y - 28, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 2, y - 24, 4, 2);
    // Flame
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.ellipse(x, y - 34, 4, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.ellipse(x, y - 36, 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Glow
    ctx.fillStyle = 'rgba(255,100,30,0.2)';
    ctx.beginPath();
    ctx.arc(x, y - 34, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawTotemPole(ctx, x, y) {
    // Base section
    ctx.fillStyle = '#a06838';
    ctx.fillRect(x - 8, y - 8, 16, 12);
    // Middle section
    ctx.fillStyle = '#8a5830';
    ctx.fillRect(x - 7, y - 22, 14, 14);
    // Top section
    ctx.fillStyle = '#b07840';
    ctx.fillRect(x - 6, y - 36, 12, 14);
    // Face patterns
    ctx.fillStyle = '#e8d8a0';
    // Eyes
    ctx.fillRect(x - 4, y - 30, 3, 3);
    ctx.fillRect(x + 1, y - 30, 3, 3);
    // Mouth
    ctx.fillRect(x - 3, y - 18, 6, 2);
    // Top eyes
    ctx.fillRect(x - 3, y - 16, 2, 2);
    ctx.fillRect(x + 1, y - 16, 2, 2);
    // Border lines
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 8, y - 8, 16, 12);
    ctx.strokeRect(x - 7, y - 22, 14, 14);
    ctx.strokeRect(x - 6, y - 36, 12, 14);
  }

  /** @private */
  _drawDrumCircle(ctx, x, y) {
    // Central drum
    ctx.fillStyle = '#a07838';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8b878';
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    // Surrounding drums
    const positions = [
      [x - 18, y], [x + 18, y], [x, y - 14], [x, y + 14]
    ];
    for (const [dx, dy] of positions) {
      ctx.fillStyle = '#8a6830';
      ctx.beginPath();
      ctx.arc(dx, dy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c8a868';
      ctx.beginPath();
      ctx.arc(dx, dy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** @private */
  _drawCampfire(ctx, x, y) {
    // Stones ring
    ctx.fillStyle = '#8a8a90';
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle) * 10, y + Math.sin(angle) * 5, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Logs
    ctx.fillStyle = '#6a4a2a';
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.3);
    ctx.fillRect(-8, -2, 16, 4);
    ctx.restore();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.3);
    ctx.fillRect(-8, -2, 16, 4);
    ctx.restore();
    // Flames
    ctx.fillStyle = '#ff4400';
    ctx.beginPath();
    ctx.moveTo(x - 6, y);
    ctx.lineTo(x + 6, y);
    ctx.lineTo(x, y - 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x + 4, y);
    ctx.lineTo(x, y - 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.moveTo(x - 2, y);
    ctx.lineTo(x + 2, y);
    ctx.lineTo(x, y - 8);
    ctx.closePath();
    ctx.fill();
    // Glow
    ctx.fillStyle = 'rgba(255,100,30,0.25)';
    ctx.beginPath();
    ctx.arc(x, y - 6, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawPottedPlantSmall(ctx, x, y) {
    // Pot
    ctx.fillStyle = '#a06840';
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 2);
    ctx.lineTo(x + 5, y - 2);
    ctx.lineTo(x + 4, y + 6);
    ctx.lineTo(x - 4, y + 6);
    ctx.closePath();
    ctx.fill();
    // Plant
    ctx.fillStyle = '#5a9a3a';
    ctx.beginPath();
    ctx.arc(x, y - 8, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a8a2a';
    ctx.beginPath();
    ctx.arc(x - 3, y - 6, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawVendorStall(ctx, x, y) {
    // Counter
    ctx.fillStyle = '#8a5a3a';
    ctx.fillRect(x - 12, y - 6, 24, 12);
    // Posts
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(x - 12, y - 24, 3, 20);
    ctx.fillRect(x + 9, y - 24, 3, 20);
    // Canopy
    ctx.fillStyle = '#d84848';
    ctx.beginPath();
    ctx.moveTo(x - 16, y - 20);
    ctx.lineTo(x + 16, y - 20);
    ctx.lineTo(x + 12, y - 32);
    ctx.lineTo(x - 12, y - 32);
    ctx.closePath();
    ctx.fill();
    // Stripe
    ctx.fillStyle = '#f0e8d0';
    ctx.fillRect(x - 3, y - 32, 6, 12);
    // Wares on counter
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(x - 5, y - 8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c85050';
    ctx.beginPath();
    ctx.arc(x + 4, y - 6, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawPainting(ctx, x, y) {
    // Frame
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(x - 8, y - 22, 16, 18);
    // Canvas
    ctx.fillStyle = '#87ceeb';
    ctx.fillRect(x - 6, y - 20, 12, 14);
    // Simple landscape
    ctx.fillStyle = '#4a8c3f';
    ctx.fillRect(x - 6, y - 10, 12, 4);
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(x + 2, y - 16, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawClockWall(ctx, x, y) {
    // Frame
    ctx.fillStyle = '#d4a838';
    ctx.beginPath();
    ctx.arc(x, y - 14, 10, 0, Math.PI * 2);
    ctx.fill();
    // Face
    ctx.fillStyle = '#f8f8f8';
    ctx.beginPath();
    ctx.arc(x, y - 14, 8, 0, Math.PI * 2);
    ctx.fill();
    // Hands
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - 14);
    ctx.lineTo(x, y - 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - 14);
    ctx.lineTo(x + 5, y - 12);
    ctx.stroke();
  }

  /** @private */
  _drawMirror(ctx, x, y) {
    // Frame
    ctx.fillStyle = '#d4c8a8';
    ctx.beginPath();
    ctx.ellipse(x, y - 14, 10, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    // Glass
    ctx.fillStyle = '#c0d0e0';
    ctx.beginPath();
    ctx.ellipse(x, y - 14, 8, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Crack
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 20);
    ctx.lineTo(x + 2, y - 12);
    ctx.lineTo(x - 1, y - 8);
    ctx.stroke();
  }

  /** @private */
  _drawPortrait(ctx, x, y) {
    // Frame
    ctx.fillStyle = '#6a4a2a';
    ctx.beginPath();
    ctx.ellipse(x, y - 14, 9, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Canvas
    ctx.fillStyle = '#3a2a1a';
    ctx.beginPath();
    ctx.ellipse(x, y - 14, 7, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eerie eyes
    ctx.fillStyle = '#88cc44';
    ctx.beginPath();
    ctx.arc(x - 2, y - 16, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 2, y - 16, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawReceptionDesk(ctx, x, y) {
    // Desk body
    ctx.fillStyle = '#8a6a42';
    ctx.fillRect(x - 20, y - 8, 40, 16);
    // Counter top
    ctx.fillStyle = '#a08052';
    ctx.fillRect(x - 22, y - 10, 44, 6);
    // Front panel
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(x - 18, y - 2, 36, 10);
    // Bell
    ctx.fillStyle = '#d4a838';
    ctx.beginPath();
    ctx.arc(x, y - 12, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawBarCounter(ctx, x, y) {
    // Counter
    ctx.fillStyle = '#7a5a38';
    ctx.fillRect(x - 24, y - 6, 48, 14);
    // Top
    ctx.fillStyle = '#9a7a52';
    ctx.fillRect(x - 26, y - 8, 52, 6);
    // Front detail
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(x - 20, y, 40, 8);
    // Bottles
    ctx.fillStyle = '#30a848';
    ctx.fillRect(x - 14, y - 16, 4, 8);
    ctx.fillStyle = '#d83030';
    ctx.fillRect(x - 6, y - 16, 4, 8);
    ctx.fillStyle = '#3080d8';
    ctx.fillRect(x + 2, y - 16, 4, 8);
    ctx.fillStyle = '#d8a030';
    ctx.fillRect(x + 10, y - 16, 4, 8);
  }

  // ================================================================
  //  Shape primitives
  // ================================================================

  /**
   * Draw an isometric circle (ellipse flattened on Y axis).
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   * @param {number} r
   */
  _isoCircle(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw an isometric triangle (pointing up).
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   * @param {number} w
   * @param {number} h
   */
  _drawIsoTriangle(ctx, cx, cy, w, h) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - h);
    ctx.lineTo(cx + w / 2, cy);
    ctx.lineTo(cx - w / 2, cy);
    ctx.closePath();
    ctx.fill();
  }

  // ================================================================
  //  Grid helpers
  // ================================================================

  /**
   * Create a new 2D grid filled with a default value.
   * @private
   * @param {number} w
   * @param {number} h
   * @param {string} fill
   * @returns {string[][]}
   */
  _newGrid(w, h, fill) {
    const grid = [];
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) {
        row.push(fill);
      }
      grid.push(row);
    }
    return grid;
  }

  /**
   * Fill a rectangular region in a grid.
   * @private
   * @param {string[][]} grid
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {string} value
   */
  _fillRect(grid, x, y, w, h, value) {
    const gh = grid.length;
    const gw = grid[0].length;
    for (let ry = y; ry < y + h && ry < gh; ry++) {
      for (let rx = x; rx < x + w && rx < gw; rx++) {
        if (ry >= 0 && rx >= 0) {
          grid[ry][rx] = value;
        }
      }
    }
  }

  /**
   * Fill a circular region in a grid.
   * @private
   * @param {string[][]} grid
   * @param {number} cx
   * @param {number} cy
   * @param {number} radius
   * @param {string} value
   */
  _fillCircle(grid, cx, cy, radius, value) {
    const gh = grid.length;
    const gw = grid[0].length;
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (y >= 0 && y < gh && x >= 0 && x < gw) {
          const dx = x - cx;
          const dy = y - cy;
          if (dx * dx + dy * dy <= radius * radius) {
            grid[y][x] = value;
          }
        }
      }
    }
  }

  /**
   * Draw a curved path through a series of points.
   * @private
   * @param {string[][]} grid
   * @param {number[][]} points - Array of [x, y] points.
   * @param {string} value
   * @param {number} width - Path width in tiles.
   */
  _pathCurve(grid, points, value, width) {
    if (points.length < 2) return;
    const gh = grid.length;
    const gw = grid[0].length;
    const halfW = Math.floor(width / 2);

    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[i + 1];
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const px = Math.round(x0 + (x1 - x0) * t);
        const py = Math.round(y0 + (y1 - y0) * t);
        for (let dy = -halfW; dy <= halfW; dy++) {
          for (let dx = -halfW; dx <= halfW; dx++) {
            const tx = px + dx;
            const ty = py + dy;
            if (ty >= 0 && ty < gh && tx >= 0 && tx < gw) {
              grid[ty][tx] = value;
            }
          }
        }
      }
    }
  }

  // ================================================================
  //  Color utilities
  // ================================================================

  /**
   * Lighten a hex color by a percentage.
   * @private
   * @param {string} hex - Hex color string (#RRGGBB).
   * @param {number} percent - Percentage to lighten (0-100).
   * @returns {string} Lightened hex color.
   */
  _lightenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x00FF) + amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  }

  /**
   * Darken a hex color by a percentage.
   * @private
   * @param {string} hex - Hex color string (#RRGGBB).
   * @param {number} percent - Percentage to darken (0-100).
   * @returns {string} Darkened hex color.
   */
  _darkenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x00FF) - amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  }
}

// ------------------------------------------------------------------
//  JSDoc type definitions (for IDE support)
// ------------------------------------------------------------------

/**
 * @typedef {Object} AreaDef
 * @property {string} id - Area identifier.
 * @property {string} name - Human-readable area name.
 * @property {number} width - Width in tiles.
 * @property {number} height - Height in tiles.
 * @property {string} floorType - Default floor type ID.
 * @property {string[][]} floorPattern - 2D array of floor type IDs.
 * @property {WallDef[]} walls - Wall definitions.
 * @property {PropDef[]} props - Furniture prop definitions.
 * @property {Object} palette - Color palette.
 * @property {string} palette.primary
 * @property {string} palette.secondary
 * @property {string} palette.accent
 * @property {string} palette.light
 * @property {string} palette.shadow
 * @property {Object} ambient - Ambient configuration.
 * @property {string} ambient.particles - Particle type ID.
 * @property {number} ambient.lightLevel - 0-1 light level.
 * @property {string} ambient.weather - Weather type.
 * @property {{tileX:number, tileY:number}} spawnPoint - Default spawn tile.
 * @property {PortalDef[]} portals - Portal connections.
 */

/**
 * @typedef {Object} WallDef
 * @property {number} x - Tile X position.
 * @property {number} y - Tile Y position.
 * @property {string} type - Wall type ID.
 * @property {boolean[]} faces - [top, left, right] visibility flags.
 */

/**
 * @typedef {Object} PropDef
 * @property {string} furnitureId - Furniture type ID.
 * @property {number} tileX - Tile X position.
 * @property {number} tileY - Tile Y position.
 * @property {number} rotation - Rotation in 90-degree increments.
 */

/**
 * @typedef {Object} PortalDef
 * @property {number} tileX - Portal tile X.
 * @property {number} tileY - Portal tile Y.
 * @property {string} destArea - Destination area ID.
 * @property {number} destX - Destination tile X.
 * @property {number} destY - Destination tile Y.
 */


/** IsoAreaBackgrounds class wrapper for main.js import */
export class IsoAreaBackgrounds {
  constructor(game) { this.game = game; this.areas = AREAS || {}; }
  getArea(id) { return this.areas[id]; }
  getAll() { return this.areas; }
}
export default IsoAreaBackgrounds;
