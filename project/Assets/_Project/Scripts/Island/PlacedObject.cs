// PlacedObject.cs
// Runtime component attached to instantiated placeable objects in the scene.
// Manages serialization, interaction, and visual feedback for placed items.
// KawaiiCool Island - Island Editor System

using System;
using System.Collections.Generic;
using UnityEngine;

namespace KawaiiCool.IslandEditor
{
    /// <summary>
    /// Represents an object that has been placed in the island world.
    /// Attached to the instantiated GameObject and handles its runtime state,
    /// serialization, highlighting, and player interaction.
    /// </summary>
    [RequireComponent(typeof(SpriteRenderer))]
    public class PlacedObject : MonoBehaviour
    {
        /// <summary>Unique runtime instance identifier (GUID).</summary>
        public string InstanceId { get; private set; }

        /// <summary>The <see cref="PlaceableObject.ObjectId"/> this instance was created from.</summary>
        public string ObjectId { get; private set; }

        /// <summary>Reference to the source <see cref="PlaceableObject"/> data.</summary>
        public PlaceableObject Data { get; private set; }

        /// <summary>The grid cell position this object is anchored to.</summary>
        public Vector3Int GridPosition { get; private set; }

        /// <summary>Number of 90-degree clockwise rotation steps applied.</summary>
        public int RotationSteps { get; private set; }

        /// <summary>The original unscaled local scale at time of placement.</summary>
        public Vector3 OriginalScale { get; private set; }

        /// <summary>Whether this object can be interacted with in play mode.</summary>
        public bool IsInteractable => Data != null && Data.IsInteractable;

        /// <summary>Event invoked when the player interacts with this object.</summary>
        public event Action OnInteracted;

        private SpriteRenderer _spriteRenderer;
        private Material _defaultMaterial;
        private Color _defaultColor;
        private bool _isGhostMode;
        private Grid _worldGrid;

        /// <summary>
        /// Initializes this placed object with placement data.
        /// </summary>
        /// <param name="data">The source placeable object data.</param>
        /// <param name="position">World-space position for placement.</param>
        /// <param name="rotation">Number of 90-degree clockwise rotation steps.</param>
        /// <param name="instanceId">Optional existing instance ID (null generates a new GUID).</param>
        /// <param name="worldGrid">Optional grid reference for cell position calculation.</param>
        public void Initialize(PlaceableObject data, Vector3 position, int rotation, string instanceId = null, Grid worldGrid = null)
        {
            Data = data != null ? data : throw new ArgumentNullException(nameof(data));
            InstanceId = string.IsNullOrEmpty(instanceId) ? Guid.NewGuid().ToString("N") : instanceId;
            ObjectId = data.ObjectId;
            RotationSteps = ((rotation % 4) + 4) % 4;
            OriginalScale = data.transform.localScale;
            _worldGrid = worldGrid;

            transform.position = position;
            transform.rotation = Quaternion.Euler(0, 0, RotationSteps * 90f);
            transform.localScale = OriginalScale;

            _spriteRenderer = GetComponent<SpriteRenderer>();
            _defaultMaterial = _spriteRenderer.sharedMaterial;
            _defaultColor = _spriteRenderer.color;

            // Use preview sprite if assigned
            if (data.PreviewSprite != null)
                _spriteRenderer.sprite = data.PreviewSprite;

            _spriteRenderer.sortingOrder = data.BaseSortingOrder;

            // Register with Y-sort manager if needed
            if (data.UseYSort)
            {
                var ySort = FindAnyObjectByType<YSortManager>();
                ySort?.RegisterRenderer(_spriteRenderer);
            }

            // Calculate grid position
            GridPosition = _worldGrid != null
                ? _worldGrid.WorldToCell(position)
                : new Vector3Int(Mathf.FloorToInt(position.x), Mathf.FloorToInt(position.y), 0);
        }

        /// <summary>
        /// Called when the player interacts with this object in play mode.
        /// Plays the interaction animation if assigned and raises <see cref="OnInteracted"/>.
        /// </summary>
        public void OnInteract()
        {
            if (Data == null || !Data.IsInteractable)
                return;

            if (Data.InteractionAnimation != null)
            {
                var animator = GetComponent<Animator>();
                if (animator != null)
                    animator.Play(Data.InteractionAnimation.name);
            }

            OnInteracted?.Invoke();
        }

        /// <summary>
        /// Serializes this object's current state into a <see cref="PlacedObjectData"/>.
        /// </summary>
        /// <returns>Serializable data structure for save.</returns>
        public PlacedObjectData Serialize()
        {
            return new PlacedObjectData
            {
                InstanceId = InstanceId,
                ObjectId = ObjectId,
                PosX = transform.position.x,
                PosY = transform.position.y,
                PosZ = transform.position.z,
                RotX = transform.rotation.eulerAngles.x,
                RotY = transform.rotation.eulerAngles.y,
                RotZ = transform.rotation.eulerAngles.z,
                ScaleX = transform.localScale.x,
                ScaleY = transform.localScale.y,
                ScaleZ = transform.localScale.z,
                SortingOrder = _spriteRenderer != null ? _spriteRenderer.sortingOrder : 0
            };
        }

        /// <summary>
        /// Restores this object's state from serialized data.
        /// </summary>
        /// <param name="data">The serialized data to restore from.</param>
        /// <param name="objectLookup">Dictionary mapping ObjectIds to prefab assets.</param>
        /// <param name="worldGrid">Optional grid reference for cell position calculation.</param>
        public void Deserialize(PlacedObjectData data, Dictionary<string, PlaceableObject> objectLookup, Grid worldGrid = null)
        {
            if (data == null) throw new ArgumentNullException(nameof(data));
            if (objectLookup == null) throw new ArgumentNullException(nameof(objectLookup));

            if (!objectLookup.TryGetValue(data.ObjectId, out var placeableData))
            {
                Debug.LogWarning($"[PlacedObject] Could not find ObjectId '{data.ObjectId}' in lookup. Object may be missing from database.");
                return;
            }

            Data = placeableData;
            InstanceId = data.InstanceId ?? Guid.NewGuid().ToString("N");
            ObjectId = data.ObjectId;
            _worldGrid = worldGrid;

            transform.position = new Vector3(data.PosX, data.PosY, data.PosZ);
            transform.rotation = Quaternion.Euler(data.RotX, data.RotY, data.RotZ);
            transform.localScale = new Vector3(data.ScaleX, data.ScaleY, data.ScaleZ);
            OriginalScale = placeableData.transform.localScale;

            RotationSteps = Mathf.RoundToInt(data.RotZ / 90f) % 4;

            _spriteRenderer = GetComponent<SpriteRenderer>();
            _defaultMaterial = _spriteRenderer.sharedMaterial;
            _defaultColor = _spriteRenderer.color;

            if (placeableData.PreviewSprite != null)
                _spriteRenderer.sprite = placeableData.PreviewSprite;

            _spriteRenderer.sortingOrder = data.SortingOrder;

            if (placeableData.UseYSort)
            {
                var ySort = FindAnyObjectByType<YSortManager>();
                ySort?.RegisterRenderer(_spriteRenderer);
            }

            GridPosition = _worldGrid != null
                ? _worldGrid.WorldToCell(transform.position)
                : new Vector3Int(Mathf.FloorToInt(transform.position.x), Mathf.FloorToInt(transform.position.y), 0);
        }

        /// <summary>
        /// Toggles a highlight overlay on the object's SpriteRenderer.
        /// </summary>
        /// <param name="highlighted">True to enable highlight, false to restore default.</param>
        /// <param name="highlightColor">The color to blend over the sprite.</param>
        public void SetHighlight(bool highlighted, Color highlightColor)
        {
            if (_spriteRenderer == null)
                _spriteRenderer = GetComponent<SpriteRenderer>();

            if (highlighted)
            {
                _spriteRenderer.color = highlightColor;
            }
            else
            {
                _spriteRenderer.color = _isGhostMode
                    ? new Color(_defaultColor.r, _defaultColor.g, _defaultColor.b, _defaultColor.a * 0.6f)
                    : _defaultColor;
            }
        }

        /// <summary>
        /// Toggles ghost mode (semi-transparent preview appearance).
        /// </summary>
        /// <param name="isGhost">True to enable ghost mode.</param>
        /// <param name="alpha">Target alpha value (0-1).</param>
        public void SetGhostMode(bool isGhost, float alpha)
        {
            if (_spriteRenderer == null)
                _spriteRenderer = GetComponent<SpriteRenderer>();

            _isGhostMode = isGhost;

            if (isGhost)
            {
                _spriteRenderer.color = new Color(
                    _defaultColor.r,
                    _defaultColor.g,
                    _defaultColor.b,
                    _defaultColor.a * alpha
                );
            }
            else
            {
                _spriteRenderer.color = _defaultColor;
            }
        }

        /// <summary>
        /// Sets the SpriteRenderer's sorting order for depth rendering.
        /// </summary>
        /// <param name="order">The sorting order value.</param>
        public void SetSortingOrder(int order)
        {
            if (_spriteRenderer == null)
                _spriteRenderer = GetComponent<SpriteRenderer>();
            _spriteRenderer.sortingOrder = order;
        }

        private void OnDestroy()
        {
            if (Data != null && Data.UseYSort && _spriteRenderer != null)
            {
                var ySort = FindAnyObjectByType<YSortManager>();
                ySort?.UnregisterRenderer(_spriteRenderer);
            }
        }
    }
}
