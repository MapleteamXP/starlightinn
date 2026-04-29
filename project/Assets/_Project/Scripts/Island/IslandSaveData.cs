// IslandSaveData.cs
// Serializable data structures for island save/load persistence.
// KawaiiCool Island - Island Editor System

using System;
using System.Collections.Generic;
using UnityEngine;

namespace KawaiiCool.IslandEditor
{
    /// <summary>
    /// Root serializable container for all island data that can be saved and loaded.
    /// Contains ground/decoration tiles, placed objects, and island settings.
    /// </summary>
    [Serializable]
    public class IslandSaveData
    {
        /// <summary>The name of the save slot this data is stored in.</summary>
        public string SaveSlotName;

        /// <summary>Version string for save data migration support.</summary>
        public string SaveVersion = "1.0";

        /// <summary>ISO 8601 timestamp of when the island was last saved.</summary>
        public string LastSaved;

        /// <summary>Display name of the island.</summary>
        public string IslandName;

        /// <summary>All ground layer tiles.</summary>
        public List<TileSaveData> GroundTiles = new();

        /// <summary>All decoration layer tiles.</summary>
        public List<TileSaveData> DecorationTiles = new();

        /// <summary>All placed furniture/decoration objects.</summary>
        public List<PlacedObjectData> Objects = new();

        /// <summary>Island-wide settings (background, music, lighting, etc.).</summary>
        public IslandSettingsData Settings = new();
    }

    /// <summary>
    /// Serializable representation of a placed object's transform and state.
    /// Used to persist object placement across save/load cycles.
    /// </summary>
    [Serializable]
    public class PlacedObjectData
    {
        /// <summary>Unique runtime instance identifier.</summary>
        public string InstanceId;

        /// <summary>Reference to the <see cref="PlaceableObject.ObjectId"/> in the database.</summary>
        public string ObjectId;

        /// <summary>World-space X position.</summary>
        public float PosX, PosY, PosZ;

        /// <summary>Euler angle rotation in degrees.</summary>
        public float RotX, RotY, RotZ;

        /// <summary>Local scale per axis.</summary>
        public float ScaleX, ScaleY, ScaleZ;

        /// <summary>SpriteRenderer sorting order for depth.</summary>
        public int SortingOrder;
    }

    /// <summary>
    /// Serializable representation of a single tile on a Tilemap layer.
    /// </summary>
    [Serializable]
    public class TileSaveData
    {
        /// <summary>Asset name or GUID identifying the tile.</summary>
        public string TileId;

        /// <summary>Grid cell X coordinate.</summary>
        public int CellX, CellY, CellZ;

        /// <summary>The tilemap layer name ("Ground" or "Decoration").</summary>
        public string TilemapName;

        /// <summary>JSON string containing custom tile properties if any.</summary>
        public string TileProperties;
    }

    /// <summary>
    /// Serializable island-wide settings for ambience, access control, and performance.
    /// </summary>
    [Serializable]
    public class IslandSettingsData
    {
        /// <summary>Identifier for the background/environment preset.</summary>
        public string BackgroundId;

        /// <summary>Identifier for the background music track.</summary>
        public string MusicId;

        /// <summary>Global lighting intensity multiplier (0-1+).</summary>
        public float LightingIntensity = 1f;

        /// <summary>Hex color string for ambient lighting tint.</summary>
        public string LightingColor = "#FFFFFF";

        /// <summary>Whether the island is visible to other players.</summary>
        public bool IsPublic = true;

        /// <summary>Maximum concurrent visitors allowed on the island.</summary>
        public int MaxVisitors = 10;
    }
}
