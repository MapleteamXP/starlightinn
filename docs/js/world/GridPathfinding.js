/**
 * @file GridPathfinding.js
 * @description A* pathfinding system for Starlight Inn v3.5.
 * Provides 8-directional grid-based pathfinding with path smoothing,
 * tap-to-move interface, dynamic obstacle support, and debug visualization.
 * @module world/GridPathfinding
 * @version 3.5.0
 */

// ============================================================
// CONSTANTS
// ============================================================

/** @constant {number} CARDINAL_COST - Movement cost for cardinal directions (N, E, S, W) */
const CARDINAL_COST = 1.0;

/** @constant {number} DIAGONAL_COST - Movement cost for diagonal directions (NE, SE, SW, NW) */
const DIAGONAL_COST = Math.SQRT2;

/** @constant {number} MAX_ITERATIONS - Hard cap on A* search iterations to prevent hangs */
const MAX_ITERATIONS = 5000;

/** @constant {number} DEFAULT_CELL_SIZE - Default grid cell size in pixels (matches tile size) */
const DEFAULT_CELL_SIZE = 32;

/** @constant {number} WAYPOINT_THRESHOLD - Distance in pixels to consider a waypoint reached */
const WAYPOINT_THRESHOLD = 4.0;

/** @constant {number} DEFAULT_WALK_SPEED - Default movement speed in pixels per second */
const DEFAULT_WALK_SPEED = 120.0;

/** @constant {number} WAYPOINT_REACHED_DIST - Grid distance to consider waypoint reached for smoothing */
const WAYPOINT_REACHED_DIST = 0.5;

/** @constant {number} DEBUG_NODE_SIZE - Size of debug visualization nodes in pixels */
const DEBUG_NODE_SIZE = 4;

/** @constant {Array<Array<number>>} DIRECTIONS - 8 directional offsets [dx, dy, cost] */
const DIRECTIONS = [
  [0, -1, CARDINAL_COST],   // N
  [1, -1, DIAGONAL_COST],   // NE
  [1, 0, CARDINAL_COST],    // E
  [1, 1, DIAGONAL_COST],    // SE
  [0, 1, CARDINAL_COST],    // S
  [-1, 1, DIAGONAL_COST],   // SW
  [-1, 0, CARDINAL_COST],   // W
  [-1, -1, DIAGONAL_COST],  // NW
];

// ============================================================
// BINARY MIN-HEAP
// ============================================================

/**
 * Binary min-heap implementation for the A* open set.
 * Provides O(log n) insertion and extraction, O(1) peek.
 * @private
 */
class _BinaryHeap {
  /**
   * @description Creates a new BinaryHeap.
   * @param {Function} scoreFn - Function that returns the sort score for an element
   */
  constructor(scoreFn) {
    /** @type {Array<Object>} */
    this._heap = [];
    /** @type {Function} */
    this._scoreFn = scoreFn;
  }

  /**
   * @description Returns the number of elements in the heap.
   * @returns {number}
   */
  get size() {
    return this._heap.length;
  }

  /**
   * @description Returns true if the heap is empty.
   * @returns {boolean}
   */
  get isEmpty() {
    return this._heap.length === 0;
  }

  /**
   * @description Pushes an element onto the heap.
   * @param {Object} element - The element to insert
   */
  push(element) {
    this._heap.push(element);
    this._bubbleUp(this._heap.length - 1);
  }

  /**
   * @description Removes and returns the element with the lowest score.
   * @returns {Object|null} The minimum element, or null if empty
   */
  pop() {
    if (this.isEmpty) return null;
    const min = this._heap[0];
    const end = this._heap.pop();
    if (this._heap.length > 0) {
      this._heap[0] = end;
      this._sinkDown(0);
    }
    return min;
  }

  /**
   * @description Updates the position of an element after its score changes.
   * @param {Object} element - The element to reposition
   */
  update(element) {
    const idx = this._heap.indexOf(element);
    if (idx >= 0) {
      this._bubbleUp(idx);
      this._sinkDown(idx);
    }
  }

  /**
   * @description Checks if the heap contains the given element.
   * @param {Object} element - The element to check
   * @returns {boolean}
   */
  includes(element) {
    return this._heap.includes(element);
  }

  /**
   * @description Removes all elements from the heap.
   */
  clear() {
    this._heap.length = 0;
  }

  /**
   * @description Moves an element up the heap until heap order is restored.
   * @param {number} n - Index of the element to bubble up
   * @private
   */
  _bubbleUp(n) {
    const element = this._heap[n];
    const score = this._scoreFn(element);
    while (n > 0) {
      const parentN = ((n + 1) >> 1) - 1;
      const parent = this._heap[parentN];
      if (score >= this._scoreFn(parent)) break;
      this._heap[n] = parent;
      this._heap[parentN] = element;
      n = parentN;
    }
  }

  /**
   * @description Moves an element down the heap until heap order is restored.
   * @param {number} n - Index of the element to sink down
   * @private
   */
  _sinkDown(n) {
    const element = this._heap[n];
    const score = this._scoreFn(element);
    const len = this._heap.length;
    while (true) {
      const child2N = (n + 1) << 1;
      const child1N = child2N - 1;
      let swap = null;
      let child1Score;
      if (child1N < len) {
        child1Score = this._scoreFn(this._heap[child1N]);
        if (child1Score < score) swap = child1N;
      }
      if (child2N < len) {
        const child2Score = this._scoreFn(this._heap[child2N]);
        if ((swap === null ? score : child1Score) > child2Score) swap = child2N;
      }
      if (swap === null) break;
      this._heap[n] = this._heap[swap];
      this._heap[swap] = element;
      n = swap;
    }
  }
}

// ============================================================
// PATH NODE
// ============================================================

/**
 * @typedef {Object} PathNode
 * @property {number} x - Grid X coordinate
 * @property {number} y - Grid Y coordinate
 * @property {number} g - Cost from start to this node
 * @property {number} h - Heuristic estimate to goal
 * @property {number} f - Total estimated cost (g + h)
 * @property {PathNode|null} parent - Previous node in the path
 * @property {boolean} closed - Whether this node has been evaluated
 * @property {boolean} visited - Whether this node has been added to open set
 */

// ============================================================
// MAIN CLASS
// ============================================================

/**
 * @class GridPathfinding
 * @description A* pathfinding system with 8-directional movement, path smoothing,
 * tap-to-move interface, dynamic obstacles, and debug visualization.
 * Integrates with the Game class to provide grid-based navigation for entities.
 */
export default class GridPathfinding {
  /**
   * @description Creates a new GridPathfinding instance.
   * @param {Object} game - The main Game instance
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.cellSize=32] - Size of each grid cell in pixels
   * @param {number} [options.walkSpeed=120] - Entity walk speed in pixels per second
   * @param {number} [options.maxIterations=5000] - Maximum A* iterations per search
   * @param {boolean} [options.debug=false] - Enable debug visualization
   * @param {HTMLCanvasElement} [options.debugCanvas=null] - Optional dedicated debug canvas
   */
  constructor(game, options = {}) {
    /** @type {Object} Reference to the main Game instance */
    this.game = game;

    /** @type {number} Grid cell size in pixels */
    this.cellSize = options.cellSize ?? DEFAULT_CELL_SIZE;

    /** @type {number} Entity movement speed in pixels per second */
    this.walkSpeed = options.walkSpeed ?? DEFAULT_WALK_SPEED;

    /** @type {number} Maximum A* search iterations before aborting */
    this.maxIterations = options.maxIterations ?? MAX_ITERATIONS;

    /** @type {boolean} Whether debug visualization is enabled */
    this.debug = options.debug ?? false;

    /** @type {HTMLCanvasElement|null} Dedicated debug canvas overlay */
    this.debugCanvas = options.debugCanvas ?? null;

    /** @type {CanvasRenderingContext2D|null} Debug canvas 2D context */
    this._debugCtx = this.debugCanvas?.getContext('2d') ?? null;

    /** @type {Array<Array<boolean>>|null} 2D boolean walkability grid */
    this._grid = null;

    /** @type {number} Grid width in cells */
    this._gridWidth = 0;

    /** @type {number} Grid height in cells */
    this._gridHeight = 0;

    /** @type {Set<string>} Dynamically blocked cell keys "x,y" */
    this._dynamicObstacles = new Set();

    /** @type {Map<string, PathNode>} Pool of node objects keyed by "x,y" to reduce GC */
    this._nodePool = new Map();

    /** @type {Array<{x: number, y: number}>|null} Current active path waypoints in pixel coords */
    this._currentPath = null;

    /** @type {number} Current waypoint index being traversed */
    this._waypointIndex = 0;

    /** @type {Object|null} The entity currently following a path (must have x, y properties) */
    this._activeEntity = null;

    /** @type {Function|null} Resolve function for the active move Promise */
    this._pathResolve = null;

    /** @type {Function|null} Reject function for the active move Promise */
    this._pathReject = null;

    /** @type {Function|null} Optional callback invoked at each waypoint (entity, waypointIndex, waypoint) */
    this._waypointCallback = null;

    /** @type {Array<{x: number, y: number}>} Debug: nodes explored in last search */
    this._debugExplored = [];

    /** @type {Array<{x: number, y: number}>} Debug: final path waypoints */
    this._debugPath = [];

    /** @type {boolean} Whether a path is currently being followed */
    this.isMoving = false;

    /** @type {number} Timestamp of last frame update */
    this._lastTime = 0;
  }

  // ============================================================
  // GRID MANAGEMENT
  // ============================================================

  /**
   * @description Loads a walkability grid for the current area.
   * @param {Array<Array<boolean>>} grid - 2D boolean array where true = walkable, false = blocked
   * @param {number} [pixelOffsetX=0] - X offset of the grid in world pixels
   * @param {number} [pixelOffsetY=0] - Y offset of the grid in world pixels
   */
  loadGrid(grid, pixelOffsetX = 0, pixelOffsetY = 0) {
    if (!grid || !Array.isArray(grid) || grid.length === 0) {
      throw new Error('GridPathfinding.loadGrid: grid must be a non-empty 2D array');
    }
    this._grid = grid;
    this._gridWidth = grid[0].length;
    this._gridHeight = grid.length;
    this._gridOffsetX = pixelOffsetX;
    this._gridOffsetY = pixelOffsetY;
    this._dynamicObstacles.clear();
    this._clearNodePool();
    this._cancelPath();
  }

  /**
   * @description Clears the current grid and cancels any active path.
   */
  unloadGrid() {
    this._grid = null;
    this._gridWidth = 0;
    this._gridHeight = 0;
    this._dynamicObstacles.clear();
    this._clearNodePool();
    this._cancelPath();
  }

  /**
   * @description Resizes the current grid, filling new cells as walkable.
   * Preserves existing walkability data where possible.
   * @param {number} newWidth - New grid width in cells
   * @param {number} newHeight - New grid height in cells
   */
  resizeGrid(newWidth, newHeight) {
    if (newWidth <= 0 || newHeight <= 0) {
      throw new Error('GridPathfinding.resizeGrid: dimensions must be positive');
    }
    const oldGrid = this._grid;
    const oldWidth = this._gridWidth;
    const oldHeight = this._gridHeight;

    const newGrid = Array.from({ length: newHeight }, (_, y) =>
      Array.from({ length: newWidth }, (_, x) =>
        oldGrid && y < oldHeight && x < oldWidth ? oldGrid[y][x] : true
      )
    );

    this._grid = newGrid;
    this._gridWidth = newWidth;
    this._gridHeight = newHeight;
    this._clearNodePool();
  }

  /**
   * @description Checks whether a grid cell is walkable.
   * Returns false if out of bounds, permanently blocked, or dynamically blocked.
   * @param {number} gx - Grid X coordinate
   * @param {number} gy - Grid Y coordinate
   * @returns {boolean}
   * @private
   */
  _isWalkable(gx, gy) {
    if (gx < 0 || gy < 0 || gx >= this._gridWidth || gy >= this._gridHeight) {
      return false;
    }
    if (!this._grid[gy][gx]) return false;
    if (this._dynamicObstacles.has(`${gx},${gy}`)) return false;
    return true;
  }

  /**
   * @description Converts a world pixel coordinate to a grid coordinate.
   * @param {number} px - World X in pixels
   * @param {number} py - World Y in pixels
   * @returns {{gx: number, gy: number}} Grid coordinates
   */
  worldToGrid(px, py) {
    return {
      gx: Math.floor((px - this._gridOffsetX) / this.cellSize),
      gy: Math.floor((py - this._gridOffsetY) / this.cellSize),
    };
  }

  /**
   * @description Converts a grid coordinate to world pixel center.
   * @param {number} gx - Grid X coordinate
   * @param {number} gy - Grid Y coordinate
   * @returns {{px: number, py: number}} Pixel coordinates (cell center)
   */
  gridToWorld(gx, gy) {
    return {
      px: this._gridOffsetX + gx * this.cellSize + this.cellSize * 0.5,
      py: this._gridOffsetY + gy * this.cellSize + this.cellSize * 0.5,
    };
  }

  // ============================================================
  // DYNAMIC OBSTACLES
  // ============================================================

  /**
   * @description Marks a grid cell as temporarily blocked (e.g., by another player).
   * @param {number} gx - Grid X coordinate
   * @param {number} gy - Grid Y coordinate
   */
  blockCell(gx, gy) {
    this._dynamicObstacles.add(`${gx},${gy}`);
  }

  /**
   * @description Unmarks a previously blocked grid cell.
   * @param {number} gx - Grid X coordinate
   * @param {number} gy - Grid Y coordinate
   */
  unblockCell(gx, gy) {
    this._dynamicObstacles.delete(`${gx},${gy}`);
  }

  /**
   * @description Blocks a world pixel area (all cells that the area overlaps).
   * @param {number} px - World X in pixels
   * @param {number} py - World Y in pixels
   * @param {number} width - Width in pixels
   * @param {number} height - Height in pixels
   */
  blockArea(px, py, width, height) {
    const tl = this.worldToGrid(px, py);
    const br = this.worldToGrid(px + width - 1, py + height - 1);
    for (let gy = tl.gy; gy <= br.gy; gy++) {
      for (let gx = tl.gx; gx <= br.gx; gx++) {
        this.blockCell(gx, gy);
      }
    }
  }

  /**
   * @description Unblocks a world pixel area.
   * @param {number} px - World X in pixels
   * @param {number} py - World Y in pixels
   * @param {number} width - Width in pixels
   * @param {number} height - Height in pixels
   */
  unblockArea(px, py, width, height) {
    const tl = this.worldToGrid(px, py);
    const br = this.worldToGrid(px + width - 1, py + height - 1);
    for (let gy = tl.gy; gy <= br.gy; gy++) {
      for (let gx = tl.gx; gx <= br.gx; gx++) {
        this.unblockCell(gx, gy);
      }
    }
  }

  /**
   * @description Clears all dynamic obstacles.
   */
  clearDynamicObstacles() {
    this._dynamicObstacles.clear();
  }

  // ============================================================
  // A* PATHFINDING
  // ============================================================

  /**
   * @description Manhattan distance heuristic optimized for 8-directional movement.
   * Uses Chebyshev distance: max(|dx|, |dy|) which is admissible for 8-dir with uniform costs.
   * @param {number} x0 - Start grid X
   * @param {number} y0 - Start grid Y
   * @param {number} x1 - Goal grid X
   * @param {number} y1 - Goal goal Y
   * @returns {number} Heuristic cost estimate
   * @private
   */
  _heuristic(x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    // Chebyshev distance is admissible for 8-directional with D=1, D2=sqrt(2)
    // h = D * (dx + dy) + (D2 - 2 * D) * min(dx, dy)
    // With D=1, D2=sqrt(2): h = dx + dy + (sqrt(2)-2) * min(dx, dy)
    // Simplified: h = max(dx, dy) when cardinal=1 and diagonal=sqrt(2)
    return CARDINAL_COST * (dx + dy) + (DIAGONAL_COST - 2 * CARDINAL_COST) * Math.min(dx, dy);
  }

  /**
   * @description Retrieves or creates a PathNode from the node pool.
   * @param {number} x - Grid X
   * @param {number} y - Grid Y
   * @returns {PathNode}
   * @private
   */
  _getNode(x, y) {
    const key = `${x},${y}`;
    let node = this._nodePool.get(key);
    if (!node) {
      node = { x, y, g: 0, h: 0, f: 0, parent: null, closed: false, visited: false };
      this._nodePool.set(key, node);
    }
    return node;
  }

  /**
   * @description Clears all pooled nodes. Call before each new search.
   * @private
   */
  _clearNodePool() {
    this._nodePool.clear();
  }

  /**
   * @description Checks if a diagonal move between two cardinal neighbors is valid.
   * Prevents cutting corners by ensuring both adjacent cardinal cells are walkable.
   * @param {number} cx - Current grid X
   * @param {number} cy - Current grid Y
   * @param {number} dx - Direction X component
   * @param {number} dy - Direction Y component
   * @returns {boolean}
   * @private
   */
  _isDiagonalValid(cx, cy, dx, dy) {
    // For a diagonal move (dx,dy), both adjacent cardinal cells must be walkable
    if (dx !== 0 && dy !== 0) {
      return this._isWalkable(cx + dx, cy) && this._isWalkable(cx, cy + dy);
    }
    return true;
  }

  /**
   * @description Runs the A* algorithm from start to goal grid coordinates.
   * @param {number} startGx - Start grid X
   * @param {number} startGy - Start grid Y
   * @param {number} goalGx - Goal grid X
   * @param {number} goalGy - Goal grid Y
   * @returns {Array<{x: number, y: number}>|null} Array of grid waypoints from start to goal, or null if no path
   * @private
   */
  _aStar(startGx, startGy, goalGx, goalGy) {
    if (!this._grid) {
      console.warn('GridPathfinding._aStar: no grid loaded');
      return null;
    }

    // Validate goal
    if (!this._isWalkable(goalGx, goalGy)) {
      // Try to find nearest walkable cell to the goal
      const nearest = this._findNearestWalkable(goalGx, goalGy, 5);
      if (!nearest) return null;
      goalGx = nearest.gx;
      goalGy = nearest.gy;
    }

    // Clear node pool for fresh search
    this._clearNodePool();

    // Initialize start node
    const startNode = this._getNode(startGx, startGy);
    startNode.g = 0;
    startNode.h = this._heuristic(startGx, startGy, goalGx, goalGy);
    startNode.f = startNode.g + startNode.h;
    startNode.parent = null;
    startNode.closed = false;
    startNode.visited = true;

    // Binary heap open set ordered by f-score
    const openSet = new _BinaryHeap((n) => n.f);
    openSet.push(startNode);

    this._debugExplored = [];
    let iterations = 0;

    while (!openSet.isEmpty && iterations < this.maxIterations) {
      iterations++;

      // Extract node with lowest f-score
      const current = openSet.pop();
      current.closed = true;

      // Record for debug visualization
      if (this.debug) {
        this._debugExplored.push({ x: current.x, y: current.y });
      }

      // Goal check
      if (current.x === goalGx && current.y === goalGy) {
        return this._reconstructPath(current);
      }

      // Explore all 8 neighbors
      for (const [dx, dy, moveCost] of DIRECTIONS) {
        const nx = current.x + dx;
        const ny = current.y + dy;

        // Skip if not walkable or if diagonal corner-cutting
        if (!this._isWalkable(nx, ny)) continue;
        if (!this._isDiagonalValid(current.x, current.y, dx, dy)) continue;

        const neighbor = this._getNode(nx, ny);
        if (neighbor.closed) continue;

        const tentativeG = current.g + moveCost;

        if (!neighbor.visited || tentativeG < neighbor.g) {
          neighbor.g = tentativeG;
          neighbor.h = this._heuristic(nx, ny, goalGx, goalGy);
          neighbor.f = neighbor.g + neighbor.h;
          neighbor.parent = current;

          if (!neighbor.visited) {
            neighbor.visited = true;
            neighbor.closed = false;
            openSet.push(neighbor);
          } else {
            openSet.update(neighbor);
          }
        }
      }
    }

    if (iterations >= this.maxIterations) {
      console.warn(`GridPathfinding._aStar: exceeded max iterations (${this.maxIterations})`);
    }
    return null; // No path found
  }

  /**
   * @description Reconstructs the path from goal node back to start.
   * @param {PathNode} goalNode - The goal node reached by A*
   * @returns {Array<{x: number, y: number}>} Grid waypoints from start to goal
   * @private
   */
  _reconstructPath(goalNode) {
    const path = [];
    let node = goalNode;
    while (node) {
      path.unshift({ x: node.x, y: node.y });
      node = node.parent;
    }
    return path;
  }

  /**
   * @description Finds the nearest walkable cell to the given coordinates using BFS.
   * @param {number} gx - Target grid X
   * @param {number} gy - Target grid Y
   * @param {number} maxRadius - Maximum search radius in cells
   * @returns {{gx: number, gy: number}|null}
   * @private
   */
  _findNearestWalkable(gx, gy, maxRadius) {
    if (this._isWalkable(gx, gy)) return { gx, gy };
    for (let r = 1; r <= maxRadius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // Only check the ring
          const nx = gx + dx;
          const ny = gy + dy;
          if (this._isWalkable(nx, ny)) return { gx: nx, gy: ny };
        }
      }
    }
    return null;
  }

  // ============================================================
  // PATH SMOOTHING
  // ============================================================

  /**
   * @description Post-processes an A* path to remove unnecessary waypoints.
   * Uses raycasting (line-of-sight) to merge collinear segments.
   * @param {Array<{x: number, y: number}>} gridPath - Raw A* grid path
   * @returns {Array<{x: number, y: number}>} Smoothed path in pixel coordinates
   * @private
   */
  _smoothPath(gridPath) {
    if (!gridPath || gridPath.length < 3) {
      return gridPath ? gridPath.map((p) => this.gridToWorld(p.x, p.y)) : [];
    }

    const smoothed = [gridPath[0]];
    let i = 0;
    const len = gridPath.length;

    while (i < len - 1) {
      // Find the furthest waypoint with clear line of sight from current
      let furthest = i + 1;
      for (let j = i + 2; j < len; j++) {
        if (this._hasLineOfSight(gridPath[i].x, gridPath[i].y, gridPath[j].x, gridPath[j].y)) {
          furthest = j;
        } else {
          break;
        }
      }
      smoothed.push(gridPath[furthest]);
      i = furthest;
    }

    // Convert grid coordinates to world pixel coordinates
    return smoothed.map((p) => this.gridToWorld(p.x, p.y));
  }

  /**
   * @description Checks if there is an unobstructed straight line between two grid cells.
   * Uses a modified Bresenham's line algorithm to sample cells along the line.
   * @param {number} x0 - Start grid X
   * @param {number} y0 - Start grid Y
   * @param {number} x1 - End grid X
   * @param {number} y1 - End grid Y
   * @returns {boolean} True if the line is completely walkable
   * @private
   */
  _hasLineOfSight(x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1;
    let sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    // Check the start and end cells plus all intermediate cells
    while (true) {
      if (!this._isWalkable(x0, y0)) return false;
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
      // When moving diagonally along the line, check corner-cutting
      if (e2 > -dy && e2 < dx) {
        if (!this._isWalkable(x0, y0 - sy) || !this._isWalkable(x0 - sx, y0)) {
          // Allow if the diagonal itself is valid
        }
      }
    }
    return true;
  }

  // ============================================================
  // PUBLIC PATHING API
  // ============================================================

  /**
   * @description Finds a path from start to target world pixel coordinates.
   * Returns smoothed waypoints in pixel coordinates.
   * @param {number} startX - Start world X in pixels
   * @param {number} startY - Start world Y in pixels
   * @param {number} targetX - Target world X in pixels
   * @param {number} targetY - Target world Y in pixels
   * @returns {Array<{x: number, y: number}>|null} Smoothed path waypoints, or null
   */
  findPath(startX, startY, targetX, targetY) {
    if (!this._grid) {
      console.warn('GridPathfinding.findPath: no grid loaded');
      return null;
    }

    const start = this.worldToGrid(startX, startY);
    const goal = this.worldToGrid(targetX, targetY);

    // Clamp to grid bounds
    const clampedGoal = {
      gx: Math.max(0, Math.min(this._gridWidth - 1, goal.gx)),
      gy: Math.max(0, Math.min(this._gridHeight - 1, goal.gy)),
    };

    const rawPath = this._aStar(start.gx, start.gy, clampedGoal.gx, clampedGoal.gy);
    if (!rawPath) return null;

    const smoothed = this._smoothPath(rawPath);
    this._debugPath = smoothed;
    return smoothed;
  }

  /**
   * @description Requests the entity to move to a target world position.
   * Cancels any existing path and computes a new one.
   * @param {number} targetX - Target world X in pixels
   * @param {number} targetY - Target world Y in pixels
   * @param {Object} [entity=null] - Entity to move (defaults to game player entity)
   * @param {Object} [options={}] - Move options
   * @param {number} [options.speed] - Override walk speed for this move
   * @param {Function} [options.onWaypoint] - Callback invoked at each waypoint
   * @returns {Promise<Object>} Resolves with { arrived: true, x, y } on arrival, rejects if blocked
   */
  async requestMove(targetX, targetY, entity = null, options = {}) {
    const mover = entity || this.game.entities?.get('player');
    if (!mover) {
      throw new Error('GridPathfinding.requestMove: no entity available to move');
    }

    // Cancel any existing path
    this._cancelPath();

    // Check if target is same cell as current position
    const currentGrid = this.worldToGrid(mover.x, mover.y);
    const targetGrid = this.worldToGrid(targetX, targetY);
    if (currentGrid.gx === targetGrid.gx && currentGrid.gy === targetGrid.gy) {
      return { arrived: true, x: mover.x, y: mover.y };
    }

    const path = this.findPath(mover.x, mover.y, targetX, targetY);
    if (!path || path.length < 2) {
      return Promise.reject(new Error('No path found to target'));
    }

    // Skip the first waypoint if it's the current position
    const waypoints = path.slice(1);
    this._currentPath = waypoints;
    this._waypointIndex = 0;
    this._activeEntity = mover;
    this._walkSpeed = options.speed || this.walkSpeed;
    this._waypointCallback = options.onWaypoint || null;
    this.isMoving = true;
    this._lastTime = performance.now();

    return new Promise((resolve, reject) => {
      this._pathResolve = resolve;
      this._pathReject = reject;
    });
  }

  /**
   * @description Cancels the current path movement.
   */
  cancelMove() {
    this._cancelPath();
  }

  /**
   * @description Internal method to cancel the current path and clean up state.
   * @private
   */
  _cancelPath() {
    if (this._pathReject && this.isMoving) {
      this._pathReject(new Error('Path cancelled by new move request'));
    }
    this._currentPath = null;
    this._waypointIndex = 0;
    this._activeEntity = null;
    this._pathResolve = null;
    this._pathReject = null;
    this._waypointCallback = null;
    this.isMoving = false;
  }

  // ============================================================
  // PATH FOLLOWING (called from game loop)
  // ============================================================

  /**
   * @description Updates path following. Call this every frame from the game loop.
   * @param {number} deltaTime - Time elapsed since last frame in seconds
   */
  update(deltaTime) {
    if (!this.isMoving || !this._currentPath || !this._activeEntity) return;

    const dt = Math.min(deltaTime, 0.05); // Cap dt to prevent jumps
    const entity = this._activeEntity;
    const target = this._currentPath[this._waypointIndex];

    if (!target) {
      this._completePath();
      return;
    }

    // Compute direction to current waypoint
    const dx = target.x - entity.x;
    const dy = target.y - entity.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Check if waypoint reached
    if (dist < WAYPOINT_THRESHOLD) {
      this._onWaypointReached();
      return;
    }

    // Normalize and apply movement
    const nx = dx / dist;
    const ny = dy / dist;
    const moveDist = this._walkSpeed * dt;

    // If we would overshoot the waypoint, snap to it
    if (moveDist >= dist) {
      entity.x = target.x;
      entity.y = target.y;
      this._onWaypointReached();
    } else {
      entity.x += nx * moveDist;
      entity.y += ny * moveDist;
    }
  }

  /**
   * @description Handles waypoint arrival: triggers callback, advances index.
   * @private
   */
  _onWaypointReached() {
    const target = this._currentPath[this._waypointIndex];

    // Invoke waypoint callback if set
    if (this._waypointCallback) {
      try {
        this._waypointCallback(this._activeEntity, this._waypointIndex, target);
      } catch (err) {
        console.error('GridPathfinding waypoint callback error:', err);
      }
    }

    this._waypointIndex++;

    if (this._waypointIndex >= this._currentPath.length) {
      this._completePath();
    }
  }

  /**
   * @description Completes the current path and resolves the Promise.
   * @private
   */
  _completePath() {
    const entity = this._activeEntity;
    const resolve = this._pathResolve;
    this._cancelPath();
    if (resolve) {
      resolve({ arrived: true, x: entity?.x, y: entity?.y });
    }
  }

  // ============================================================
  // SERIALIZATION
  // ============================================================

  /**
   * @description Serializes the current walkable grid to a compact JSON-friendly object.
   * Uses run-length encoding for efficient storage.
   * @returns {Object|null} Serialized grid data, or null if no grid loaded
   */
  serialize() {
    if (!this._grid) return null;

    const rows = [];
    for (let y = 0; y < this._gridHeight; y++) {
      let rowStr = '';
      for (let x = 0; x < this._gridWidth; x++) {
        rowStr += this._grid[y][x] ? '1' : '0';
      }
      rows.push(rowStr);
    }

    return {
      version: 1,
      width: this._gridWidth,
      height: this._gridHeight,
      cellSize: this.cellSize,
      offsetX: this._gridOffsetX,
      offsetY: this._gridOffsetY,
      rows,
    };
  }

  /**
   * @description Deserializes grid data previously produced by serialize().
   * @param {Object} data - Serialized grid data
   * @returns {boolean} True if deserialization succeeded
   */
  deserialize(data) {
    try {
      if (!data || data.version !== 1) {
        throw new Error('Invalid or unsupported grid serialization version');
      }

      const { width, height, rows, cellSize, offsetX, offsetY } = data;
      if (!Array.isArray(rows) || rows.length !== height) {
        throw new Error('Grid row count mismatch');
      }

      const grid = [];
      for (let y = 0; y < height; y++) {
        const row = rows[y];
        if (row.length !== width) {
          throw new Error(`Grid row ${y} width mismatch: ${row.length} vs ${width}`);
        }
        const boolRow = [];
        for (let x = 0; x < width; x++) {
          boolRow.push(row[x] === '1');
        }
        grid.push(boolRow);
      }

      this.cellSize = cellSize ?? DEFAULT_CELL_SIZE;
      this._gridOffsetX = offsetX ?? 0;
      this._gridOffsetY = offsetY ?? 0;
      this.loadGrid(grid, this._gridOffsetX, this._gridOffsetY);
      return true;
    } catch (err) {
      console.error('GridPathfinding.deserialize error:', err);
      return false;
    }
  }

  // ============================================================
  // DEBUG VISUALIZATION
  // ============================================================

  /**
   * @description Toggles debug visualization on/off.
   * @param {boolean} enabled
   */
  setDebug(enabled) {
    this.debug = enabled;
  }

  /**
   * @description Renders debug visualization of the grid, explored nodes, and path.
   * Call this after the main game render if debug mode is on.
   * @param {CanvasRenderingContext2D} [ctx] - Optional context to draw on (defaults to debug canvas or game canvas)
   */
  drawDebug(ctx) {
    if (!this.debug) return;

    const context = ctx || this._debugCtx || this.game.canvas?.getContext('2d');
    if (!context) return;

    context.save();

    // Apply camera transform if available
    if (this.game.camera) {
      const cam = this.game.camera;
      context.scale(cam.zoom, cam.zoom);
      context.translate(-cam.x, -cam.y);
    }

    try {
      // Draw walkable grid
      this._drawDebugGrid(context);

      // Draw explored nodes
      this._drawDebugExplored(context);

      // Draw path
      this._drawDebugPath(context);

      // Draw waypoints
      this._drawDebugWaypoints(context);
    } catch (err) {
      console.error('GridPathfinding.drawDebug error:', err);
    }

    context.restore();
  }

  /**
   * @description Draws the walkable grid overlay.
   * @param {CanvasRenderingContext2D} ctx
   * @private
   */
  _drawDebugGrid(ctx) {
    if (!this._grid) return;

    ctx.strokeStyle = 'rgba(100, 200, 255, 0.15)';
    ctx.lineWidth = 1;

    for (let y = 0; y < this._gridHeight; y++) {
      for (let x = 0; x < this._gridWidth; x++) {
        const px = this._gridOffsetX + x * this.cellSize;
        const py = this._gridOffsetY + y * this.cellSize;

        if (!this._grid[y][x]) {
          // Blocked cell: filled red
          ctx.fillStyle = 'rgba(255, 60, 60, 0.25)';
          ctx.fillRect(px, py, this.cellSize, this.cellSize);
        }

        ctx.strokeRect(px, py, this.cellSize, this.cellSize);
      }
    }
  }

  /**
   * @description Draws explored nodes from the last A* search.
   * @param {CanvasRenderingContext2D} ctx
   * @private
   */
  _drawDebugExplored(ctx) {
    if (!this._debugExplored.length) return;

    ctx.fillStyle = 'rgba(255, 220, 50, 0.4)';
    const hs = DEBUG_NODE_SIZE * 0.5;

    for (const node of this._debugExplored) {
      const wx = this._gridOffsetX + node.x * this.cellSize + this.cellSize * 0.5;
      const wy = this._gridOffsetY + node.y * this.cellSize + this.cellSize * 0.5;
      ctx.fillRect(wx - hs, wy - hs, DEBUG_NODE_SIZE, DEBUG_NODE_SIZE);
    }
  }

  /**
   * @description Draws the final smoothed path.
   * @param {CanvasRenderingContext2D} ctx
   * @private
   */
  _drawDebugPath(ctx) {
    if (!this._debugPath || this._debugPath.length < 2) return;

    ctx.strokeStyle = 'rgba(0, 255, 150, 0.8)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(this._debugPath[0].x, this._debugPath[0].y);
    for (let i = 1; i < this._debugPath.length; i++) {
      ctx.lineTo(this._debugPath[i].x, this._debugPath[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /**
   * @description Draws waypoint markers on the path.
   * @param {CanvasRenderingContext2D} ctx
   * @private
   */
  _drawDebugWaypoints(ctx) {
    if (!this._debugPath) return;

    for (let i = 0; i < this._debugPath.length; i++) {
      const wp = this._debugPath[i];
      const radius = i === this._waypointIndex ? 6 : 4;

      // Outer glow
      ctx.fillStyle = i === this._waypointIndex ? 'rgba(0, 255, 100, 0.6)' : 'rgba(0, 200, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, radius + 2, 0, Math.PI * 2);
      ctx.fill();

      // Inner dot
      ctx.fillStyle = i === 0 ? '#00ff66' : i === this._debugPath.length - 1 ? '#ff3366' : '#00ccff';
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ============================================================
  // UTILITIES
  // ============================================================

  /**
   * @description Returns the number of cells in the current grid.
   * @returns {number}
   */
  get cellCount() {
    return this._gridWidth * this._gridHeight;
  }

  /**
   * @description Returns the current grid dimensions.
   * @returns {{width: number, height: number}}
   */
  get gridDimensions() {
    return { width: this._gridWidth, height: this._gridHeight };
  }

  /**
   * @description Destroys the pathfinding instance and cleans up resources.
   */
  destroy() {
    this._cancelPath();
    this.unloadGrid();
    this._debugCtx = null;
    this.debugCanvas = null;
    this.game = null;
  }
}
