// PlaceableObject.cs
// Component attached to prefabs that can be placed in the island editor.
// Defines placement rules, visual properties, and economic data.
// KawaiiCool Island - Island Editor System

using UnityEngine;

namespace KawaiiCool.IslandEditor
{
    /// <summary>
    /// Defines where and how a placeable object can be positioned in the world.
    /// </summary>
    public enum PlacementType
    {
        /// <summary>Placed on the ground plane (default).</summary>
        Ground,
        /// <summary>Mounted on walls.</summary>
        Wall,
        /// <summary>Placed as flooring.</summary>
        Floor,
        /// <summary>Hanging from ceilings.</summary>
        Ceiling,
        /// <summary>Floating on or submerged in water.</summary>
        Water,
        /// <summary>No placement restrictions.</summary>
        Any
    }

    /// <summary>
    /// Component attached to prefab GameObjects that can be instantiated
    /// by the <see cref="IslandEditor"/> during island editing.
    /// Contains all metadata needed for placement validation, rendering, and economy.
    /// </summary>
    [RequireComponent(typeof(SpriteRenderer))]
    public class PlaceableObject : MonoBehaviour
    {
        [Header("Data")]
        /// <summary>Unique identifier used for save/load and database lookup.</summary>
        public string ObjectId;

        /// <summary>Human-readable name shown in the inventory UI.</summary>
        public string DisplayName;

        /// <summary>Icon sprite displayed in the inventory/item slot.</summary>
        public Sprite Icon;

        /// <summary>Sprite used for the ghost preview and editor visualization.</summary>
        public Sprite PreviewSprite;

        [Header("Placement")]
        /// <summary>Number of grid cells this object occupies in its default orientation.</summary>
        public Vector2Int Size = Vector2Int.one;

        /// <summary>What surface type this object can be placed on.</summary>
        public PlacementType PlacementType;

        /// <summary>Whether the player can rotate this object in the editor.</summary>
        public bool CanRotate = true;

        /// <summary>Whether the player can scale this object in the editor.</summary>
        public bool CanScale = false;

        /// <summary>Minimum allowed scale per axis.</summary>
        public Vector2 MinScale = Vector2.one * 0.5f;

        /// <summary>Maximum allowed scale per axis.</summary>
        public Vector2 MaxScale = Vector2.one * 3f;

        /// <summary>Whether multiple objects can occupy the same grid cell.</summary>
        public bool CanStack = false;

        [Header("Rendering")]
        /// <summary>Base sorting order offset for the SpriteRenderer.</summary>
        public int BaseSortingOrder = 0;

        /// <summary>Whether to sort by Y position for 2.5D depth effect.</summary>
        public bool UseYSort = true;

        [Header("Interaction")]
        /// <summary>Whether this object triggers an interaction when clicked in play mode.</summary>
        public bool IsInteractable = false;

        /// <summary>Text shown in the interaction prompt UI.</summary>
        public string InteractionPrompt = "Interact";

        /// <summary>Optional animation played when interacting.</summary>
        public AnimationClip InteractionAnimation;

        [Header("Economy")]
        /// <summary>Cost to purchase this object from the shop.</summary>
        public int PurchasePrice;

        /// <summary>Currency type string (e.g., "coins", "gems", "tokens").</summary>
        public string CurrencyType = "coins";

        /// <summary>Whether this item requires premium/real-money currency.</summary>
        public bool IsPremium;

        private SpriteRenderer _spriteRenderer;

        /// <summary>
        /// Computes the world-space bounding box of this object's SpriteRenderer.
        /// </summary>
        /// <returns>World-aligned bounds in Unity world units.</returns>
        public Bounds GetWorldBounds()
        {
            if (_spriteRenderer == null)
                _spriteRenderer = GetComponent<SpriteRenderer>();

            if (_spriteRenderer != null && _spriteRenderer.sprite != null)
                return _spriteRenderer.bounds;

            // Fallback: construct bounds from Size
            var bounds = new Bounds(transform.position, new Vector3(Size.x, Size.y, 0.1f));
            return bounds;
        }

        /// <summary>
        /// Returns the cell size after applying a 90-degree rotation.
        /// A 2x1 object becomes 1x2 when rotated 90 degrees.
        /// </summary>
        /// <param name="rotationSteps">Number of 90-degree clockwise steps (0-3).</param>
        /// <returns>The rotated cell dimensions.</returns>
        public Vector2Int GetRotatedSize(int rotationSteps)
        {
            rotationSteps = ((rotationSteps % 4) + 4) % 4;
            return rotationSteps % 2 == 0 ? Size : new Vector2Int(Size.y, Size.x);
        }

        private void Reset()
        {
            // Auto-populate ObjectId from the prefab name if empty
            if (string.IsNullOrEmpty(ObjectId))
                ObjectId = gameObject.name;
        }

        private void Awake()
        {
            if (_spriteRenderer == null)
                _spriteRenderer = GetComponent<SpriteRenderer>();
        }

#if UNITY_EDITOR
        private void OnValidate()
        {
            // Ensure size is at least 1x1
            Size.x = Mathf.Max(1, Size.x);
            Size.y = Mathf.Max(1, Size.y);

            // Clamp scale bounds
            MinScale.x = Mathf.Max(0.1f, MinScale.x);
            MinScale.y = Mathf.Max(0.1f, MinScale.y);
            MaxScale.x = Mathf.Max(MinScale.x, MaxScale.x);
            MaxScale.y = Mathf.Max(MinScale.y, MaxScale.y);
        }
#endif
    }
}
