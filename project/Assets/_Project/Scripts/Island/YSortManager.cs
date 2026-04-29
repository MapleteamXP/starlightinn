// YSortManager.cs
// Handles Y-based depth sorting for 2D/2.5D objects.
// Updates SpriteRenderer.sortingOrder based on world Y position for pseudo-depth.
// KawaiiCool Island - Island Editor System

using System.Collections.Generic;
using UnityEngine;

namespace KawaiiCool.IslandEditor
{
    /// <summary>
    /// Manages Y-axis depth sorting for SpriteRenderers to create a 2.5D perspective effect.
    /// Objects lower on screen (smaller Y) appear behind objects higher on screen (larger Y).
    /// Automatically updates at configurable intervals or on demand.
    /// </summary>
    public class YSortManager : MonoBehaviour
    {
        /// <summary>Whether to automatically update sorting orders every frame interval.</summary>
        public bool AutoUpdate = true;

        /// <summary>Seconds between automatic sorting updates.</summary>
        public float UpdateInterval = 0.1f;

        /// <summary>Name of the sorting layer to assign.</summary>
        public string SortingLayerName = "Default";

        /// <summary>Multiplier applied to Y position to determine sorting order.</summary>
        public float SortingMultiplier = -100f;

        /// <summary>Base offset added to all sorting orders.</summary>
        public int BaseSortingOffset = 0;

        private List<SpriteRenderer> _sortedRenderers = new();
        private float _lastUpdateTime;
        private int _sortingLayerId;

        /// <summary>
        /// Registers a SpriteRenderer to be managed by the Y-sort system.
        /// The renderer will have its sortingOrder updated automatically.
        /// </summary>
        /// <param name="renderer">The SpriteRenderer to register.</param>
        public void RegisterRenderer(SpriteRenderer renderer)
        {
            if (renderer == null || _sortedRenderers.Contains(renderer))
                return;

            _sortedRenderers.Add(renderer);
            renderer.sortingLayerName = SortingLayerName;
        }

        /// <summary>
        /// Unregisters a SpriteRenderer from the Y-sort system.
        /// Call this before destroying the object or when disabling Y-sort.
        /// </summary>
        /// <param name="renderer">The SpriteRenderer to unregister.</param>
        public void UnregisterRenderer(SpriteRenderer renderer)
        {
            if (renderer == null)
                return;

            _sortedRenderers.Remove(renderer);
        }

        /// <summary>
        /// Immediately recalculates and applies sorting orders for all registered renderers.
        /// Use after bulk placement operations or when AutoUpdate is disabled.
        /// </summary>
        public void ForceUpdateSorting()
        {
            UpdateSortingOrders();
        }

        private void Awake()
        {
            _sortingLayerId = SortingLayer.NameToID(SortingLayerName);
        }

        private void Update()
        {
            if (!AutoUpdate)
                return;

            if (Time.time - _lastUpdateTime >= UpdateInterval)
            {
                UpdateSortingOrders();
                _lastUpdateTime = Time.time;
            }
        }

        /// <summary>
        /// Iterates all registered renderers and assigns sortingOrder based on Y position.
        /// Objects with lower Y (farther "back") get lower order; higher Y (closer "front") get higher order.
        /// </summary>
        private void UpdateSortingOrders()
        {
            // Remove null entries (destroyed objects)
            _sortedRenderers.RemoveAll(r => r == null);

            for (int i = 0; i < _sortedRenderers.Count; i++)
            {
                var renderer = _sortedRenderers[i];
                if (renderer == null)
                    continue;

                // Calculate sorting order from Y position
                int sortOrder = BaseSortingOffset + Mathf.RoundToInt(renderer.transform.position.y * SortingMultiplier);
                renderer.sortingOrder = sortOrder;
            }
        }

        private void OnValidate()
        {
            UpdateInterval = Mathf.Max(0f, UpdateInterval);
        }
    }
}
