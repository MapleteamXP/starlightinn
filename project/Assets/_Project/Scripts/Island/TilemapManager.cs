// TilemapManager.cs
// Tilemap painting, querying, and management for ground and decoration layers.
// KawaiiCool Island - Island Editor System

using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Tilemaps;

namespace KawaiiCool.IslandEditor
{
    /// <summary>
    /// Manages all Tilemap operations for the island editor including painting,
    /// erasing, querying tiles, flood fill, and serialization helpers.
    /// Operates on two layers: Ground and Decoration.
    /// </summary>
    public class TilemapManager : MonoBehaviour
    {
        /// <summary>The ground layer Tilemap for terrain (grass, dirt, paths).</summary>
        public Tilemap GroundTilemap;

        /// <summary>The decoration layer Tilemap for overlays (flowers, markings).</summary>
        public Tilemap DecorationTilemap;

        /// <summary>The Grid component that both Tilemaps are children of.</summary>
        public Grid WorldGrid;

        [Header("Tile Database")]
        /// <summary>All available TileBase assets that can be painted.</summary>
        public List<TileBase> AvailableTiles = new();

        /// <summary>Runtime lookup from tile name to TileBase asset.</summary>
        private Dictionary<string, TileBase> _tileLookup;

        private void Awake()
        {
            BuildTileLookup();
        }

        /// <summary>
        /// Paints a tile at the specified cell position on the named tilemap layer.
        /// </summary>
        /// <param name="cellPosition">Grid cell coordinates.</param>
        /// <param name="tile">The TileBase asset to paint.</param>
        /// <param name="tilemapName">Target layer: "Ground" or "Decoration".</param>
        public void PaintTile(Vector3Int cellPosition, TileBase tile, string tilemapName = "Ground")
        {
            Tilemap target = GetTilemapByName(tilemapName);
            if (target == null)
            {
                Debug.LogWarning($"[TilemapManager] Tilemap '{tilemapName}' not found.");
                return;
            }

            if (tile == null)
            {
                Debug.LogWarning("[TilemapManager] Cannot paint null tile.");
                return;
            }

            target.SetTile(cellPosition, tile);
            target.SetTileFlags(cellPosition, TileFlags.None);
        }

        /// <summary>
        /// Erases (removes) the tile at the specified cell position.
        /// </summary>
        /// <param name="cellPosition">Grid cell coordinates.</param>
        /// <param name="tilemapName">Target layer: "Ground" or "Decoration".</param>
        public void EraseTile(Vector3Int cellPosition, string tilemapName = "Ground")
        {
            Tilemap target = GetTilemapByName(tilemapName);
            if (target == null)
            {
                Debug.LogWarning($"[TilemapManager] Tilemap '{tilemapName}' not found.");
                return;
            }

            target.SetTile(cellPosition, null);
        }

        /// <summary>
        /// Retrieves the tile at the specified cell position.
        /// </summary>
        /// <param name="cellPosition">Grid cell coordinates.</param>
        /// <param name="tilemapName">Target layer: "Ground" or "Decoration".</param>
        /// <returns>The TileBase at that cell, or null if empty.</returns>
        public TileBase GetTile(Vector3Int cellPosition, string tilemapName = "Ground")
        {
            Tilemap target = GetTilemapByName(tilemapName);
            if (target == null)
                return null;

            return target.GetTile(cellPosition);
        }

        /// <summary>
        /// Removes all tiles from both Ground and Decoration tilemaps.
        /// </summary>
        public void ClearAllTiles()
        {
            GroundTilemap?.ClearAllTiles();
            GroundTilemap?.CompressBounds();
            DecorationTilemap?.ClearAllTiles();
            DecorationTilemap?.CompressBounds();
        }

        /// <summary>
        /// Flood-fills a contiguous region of the same tile starting from a position.
        /// Uses 4-way adjacency (no diagonals).
        /// </summary>
        /// <param name="startPosition">Starting grid cell.</param>
        /// <param name="tile">The tile to fill with.</param>
        public void FloodFill(Vector3Int startPosition, TileBase tile)
        {
            if (GroundTilemap == null || tile == null)
                return;

            TileBase targetTile = GroundTilemap.GetTile(startPosition);
            if (targetTile == tile)
                return;

            var queue = new Queue<Vector3Int>();
            var visited = new HashSet<Vector3Int>();
            queue.Enqueue(startPosition);
            visited.Add(startPosition);

            Vector3Int[] directions = new Vector3Int[]
            {
                Vector3Int.up,
                Vector3Int.down,
                Vector3Int.left,
                Vector3Int.right
            };

            while (queue.Count > 0)
            {
                Vector3Int current = queue.Dequeue();
                TileBase currentTile = GroundTilemap.GetTile(current);

                if (currentTile == targetTile)
                {
                    GroundTilemap.SetTile(current, tile);
                    GroundTilemap.SetTileFlags(current, TileFlags.None);

                    foreach (var dir in directions)
                    {
                        Vector3Int neighbor = current + dir;
                        if (!visited.Contains(neighbor))
                        {
                            visited.Add(neighbor);
                            queue.Enqueue(neighbor);
                        }
                    }
                }
            }
        }

        /// <summary>
        /// Computes the axis-aligned bounding box that contains all painted tiles
        /// across both Ground and Decoration layers.
        /// </summary>
        /// <returns>BoundsInt covering all occupied cells.</returns>
        public BoundsInt GetTilemapBounds()
        {
            BoundsInt combinedBounds = new();

            if (GroundTilemap != null)
            {
                GroundTilemap.CompressBounds();
                combinedBounds = GroundTilemap.cellBounds;
            }

            if (DecorationTilemap != null)
            {
                DecorationTilemap.CompressBounds();
                if (combinedBounds.size == Vector3Int.zero)
                    combinedBounds = DecorationTilemap.cellBounds;
                else
                    combinedBounds = UnionBounds(combinedBounds, DecorationTilemap.cellBounds);
            }

            return combinedBounds;
        }

        /// <summary>
        /// Returns all occupied cell positions across both tilemap layers.
        /// </summary>
        /// <returns>List of cell positions that have a tile.</returns>
        public List<Vector3Int> GetAllOccupiedCells()
        {
            var cells = new List<Vector3Int>();
            BoundsInt bounds = GetTilemapBounds();

            foreach (var pos in bounds.allPositionsWithin)
            {
                if (GroundTilemap != null && GroundTilemap.HasTile(pos))
                    cells.Add(pos);
                else if (DecorationTilemap != null && DecorationTilemap.HasTile(pos))
                    cells.Add(pos);
            }

            return cells;
        }

        /// <summary>
        /// Converts a world-space position to grid cell coordinates.
        /// </summary>
        /// <param name="worldPosition">Position in world space.</param>
        /// <returns>Corresponding grid cell coordinates.</returns>
        public Vector3Int WorldToCell(Vector3 worldPosition)
        {
            if (WorldGrid != null)
                return WorldGrid.WorldToCell(worldPosition);

            return new Vector3Int(
                Mathf.FloorToInt(worldPosition.x),
                Mathf.FloorToInt(worldPosition.y),
                Mathf.FloorToInt(worldPosition.z)
            );
        }

        /// <summary>
        /// Converts grid cell coordinates to world-space position (cell center).
        /// </summary>
        /// <param name="cellPosition">Grid cell coordinates.</param>
        /// <returns>World-space position at the center of the cell.</returns>
        public Vector3 CellToWorld(Vector3Int cellPosition)
        {
            if (WorldGrid != null)
                return WorldGrid.CellToWorld(cellPosition) + WorldGrid.cellSize * 0.5f;

            return new Vector3(cellPosition.x + 0.5f, cellPosition.y + 0.5f, cellPosition.z);
        }

        /// <summary>
        /// Checks if a cell position is empty on both tilemap layers.
        /// </summary>
        /// <param name="cellPosition">Grid cell coordinates.</param>
        /// <returns>True if neither layer has a tile at this cell.</returns>
        public bool IsCellEmpty(Vector3Int cellPosition)
        {
            bool groundEmpty = GroundTilemap == null || !GroundTilemap.HasTile(cellPosition);
            bool decoEmpty = DecorationTilemap == null || !DecorationTilemap.HasTile(cellPosition);
            return groundEmpty && decoEmpty;
        }

        /// <summary>
        /// Retrieves a TileBase from the database by its asset name.
        /// </summary>
        /// <param name="tileName">Name of the tile asset.</param>
        /// <returns>The TileBase if found, null otherwise.</returns>
        public TileBase GetTileByName(string tileName)
        {
            if (_tileLookup == null)
                BuildTileLookup();

            _tileLookup?.TryGetValue(tileName, out var tile);
            return tile;
        }

        /// <summary>
        /// Populates the runtime tile lookup dictionary for fast name-based access.
        /// </summary>
        public void BuildTileLookup()
        {
            _tileLookup = new Dictionary<string, TileBase>();
            if (AvailableTiles == null) return;

            foreach (var tile in AvailableTiles)
            {
                if (tile != null && !_tileLookup.ContainsKey(tile.name))
                    _tileLookup.Add(tile.name, tile);
            }
        }

        /// <summary>
        /// Gets the named tilemap reference (Ground or Decoration).
        /// </summary>
        /// <param name="tilemapName">"Ground" or "Decoration".</param>
        /// <returns>The matching Tilemap component, or null.</returns>
        private Tilemap GetTilemapByName(string tilemapName)
        {
            return tilemapName switch
            {
                "Ground" => GroundTilemap,
                "Decoration" => DecorationTilemap,
                _ => null
            };
        }

        /// <summary>
        /// Computes the union of two BoundsInt regions.
        /// </summary>
        private BoundsInt UnionBounds(BoundsInt a, BoundsInt b)
        {
            Vector3Int min = Vector3Int.Min(a.min, b.min);
            Vector3Int max = Vector3Int.Max(a.max, b.max);
            return new BoundsInt(min, max - min);
        }
    }
}
