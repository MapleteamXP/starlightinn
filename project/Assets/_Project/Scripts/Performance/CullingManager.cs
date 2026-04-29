using System;
using System.Collections.Generic;
using UnityEngine;

namespace KawaiiCoolIsland.Performance
{
    /// <summary>
    /// Smart camera-based culling system for KawaiiCool Island v3.0.
    /// Evaluates visibility using frustum planes and update-rate staggering so that
    /// non-critical objects (decorations, particles, NPCs) are checked less frequently
    /// than the player. Respects Y-sorting depth for correct 2.5D rendering order.
    /// </summary>
    public class CullingManager : Singleton<CullingManager>
    {
        #region Header: Culling

        [Header("Culling")]
        [Tooltip("Horizontal world units added to camera frustum before culling.")]
        public float HorizontalCullMargin = 2f;

        [Tooltip("Vertical world units added to camera frustum before culling.")]
        public float VerticalCullMargin = 2f;

        [Tooltip("Use camera frustum planes for visibility testing.")]
        public bool UseCameraBounds = true;

        [Tooltip("Cull entire layers when no objects on that layer are visible.")]
        public bool UseLayerCulling = true;

        #endregion

        #region Header: Update Rates

        [Header("Update Rates")]
        [Tooltip("Fraction of frames between player visibility checks (0 = every frame).")]
        public float PlayerUpdateRate = 0f;

        [Tooltip("Fraction of frames between NPC visibility checks (0.1 = every 10th frame).")]
        public float NPCUpdateRate = 0.1f;

        [Tooltip("Fraction of frames between decoration visibility checks (0.5 = every 2nd frame).")]
        public float DecorationUpdateRate = 0.5f;

        [Tooltip("Fraction of frames between particle system visibility checks.")]
        public float ParticleUpdateRate = 0.2f;

        #endregion

        #region Private State

        private readonly Dictionary<GameObject, CullableObject> _registeredObjects = new();
        private Plane[] _cameraPlanes;
        private Camera _mainCamera;
        private int _frameCounter;
        private readonly Dictionary<CullableType, float> _updateRateLookup = new();
        private Bounds _expandedCameraBounds;
        private readonly HashSet<int> _visibleLayers = new();

        #endregion

        #region Events

        /// <summary>Fired when an object's visibility state changes.</summary>
        public event Action<GameObject, bool> OnVisibilityChanged;

        #endregion

        #region Unity Lifecycle

        protected override void Awake()
        {
            base.Awake();
            BuildUpdateRateLookup();
        }

        private void Start()
        {
            _mainCamera = Camera.main;
            _cameraPlanes = new Plane[6];
            EventBus.Subscribe<QualityTierChangedEvent>(OnQualityTierChanged);
        }

        private void OnDestroy()
        {
            EventBus.Unsubscribe<QualityTierChangedEvent>(OnQualityTierChanged);
        }

        private void Update()
        {
            _frameCounter++;

            if (_mainCamera == null)
            {
                _mainCamera = Camera.main;
                if (_mainCamera == null) return;
            }

            UpdateCameraPlanes();
            CullObjects();
        }

        #endregion

        #region Public API: Registration

        /// <summary>
        /// Registers a <see cref="GameObject"/> for managed culling and visibility updates.
        /// </summary>
        /// <param name="obj">The object to track.</param>
        /// <param name="type">Category determining update rate and priority.</param>
        /// <param name="importance">Higher importance resists culling (1.0 = normal).</param>
        public void RegisterObject(GameObject obj, CullableType type, float importance = 1f)
        {
            if (obj == null)
            {
                Debug.LogWarning("[CullingManager] Attempted to register a null GameObject.");
                return;
            }

            if (_registeredObjects.ContainsKey(obj))
            {
                _registeredObjects[obj].Type = type;
                _registeredObjects[obj].Importance = importance;
                return;
            }

            float interval = _updateRateLookup.TryGetValue(type, out float rate) ? rate : 0.5f;
            Renderer rend = obj.GetComponentInChildren<Renderer>();
            Bounds bounds = rend != null ? rend.bounds : new Bounds(obj.transform.position, Vector3.one);

            var cullable = new CullableObject
            {
                Object = obj,
                Type = type,
                Importance = importance,
                IsVisible = true,
                LastUpdateTime = Time.time,
                UpdateInterval = interval,
                WorldBounds = bounds,
                LastPosition = obj.transform.position
            };

            _registeredObjects[obj] = cullable;

            if (UseLayerCulling)
                _visibleLayers.Add(obj.layer);
        }

        /// <summary>
        /// Unregisters an object from culling management.
        /// </summary>
        /// <param name="obj">The object to stop tracking.</param>
        public void UnregisterObject(GameObject obj)
        {
            if (obj == null) return;
            if (_registeredObjects.TryGetValue(obj, out var cullable))
            {
                SetObjectEnabled(cullable, true);
                _registeredObjects.Remove(obj);
            }
        }

        /// <summary>
        /// Forces an immediate full-frame culling evaluation for all registered objects.
        /// </summary>
        public void ForceUpdateCulling()
        {
            UpdateCameraPlanes();
            foreach (var kvp in _registeredObjects)
            {
                UpdateObjectVisibility(kvp.Value);
            }
        }

        /// <summary>
        /// Returns whether the specified object is currently considered visible.
        /// </summary>
        /// <param name="obj">The object to query.</param>
        /// <returns>True if visible; false if culled or not registered.</returns>
        public bool IsVisible(GameObject obj)
        {
            if (obj == null) return false;
            return _registeredObjects.TryGetValue(obj, out var cullable) && cullable.IsVisible;
        }

        /// <summary>
        /// Computes the current world-space distance from the main camera to a position.
        /// </summary>
        /// <param name="position">World position to measure.</param>
        /// <returns>Distance in world units.</returns>
        public float GetDistanceToCamera(Vector3 position)
        {
            if (_mainCamera == null) return float.MaxValue;
            return Vector3.Distance(position, _mainCamera.transform.position);
        }

        #endregion

        #region Core Culling Logic

        private void UpdateCameraPlanes()
        {
            if (_mainCamera == null) return;

            GeometryUtility.CalculateFrustumPlanes(_mainCamera, _cameraPlanes);

            // Expand frustum by margins for smoother culling (objects slightly off-screen stay active)
            if (UseCameraBounds)
            {
                Vector3 center = _mainCamera.transform.position + _mainCamera.transform.forward * (_mainCamera.farClipPlane * 0.5f);
                float h = _mainCamera.orthographic
                    ? _mainCamera.orthographicSize + VerticalCullMargin
                    : Mathf.Tan(_mainCamera.fieldOfView * 0.5f * Mathf.Deg2Rad) * _mainCamera.farClipPlane + VerticalCullMargin;
                float aspect = _mainCamera.aspect;
                float w = h * aspect + HorizontalCullMargin;
                float d = _mainCamera.farClipPlane + Mathf.Max(HorizontalCullMargin, VerticalCullMargin);
                _expandedCameraBounds = new Bounds(center, new Vector3(w * 2f, h * 2f, d));
            }
        }

        private void CullObjects()
        {
            if (_registeredObjects.Count == 0) return;

            foreach (var kvp in _registeredObjects)
            {
                CullableObject obj = kvp.Value;
                if (obj.Object == null) continue;

                if (ShouldSkipThisFrame(obj))
                    continue;

                UpdateObjectVisibility(obj);
                obj.LastUpdateTime = Time.time;
            }
        }

        private bool ShouldSkipThisFrame(CullableObject obj)
        {
            if (obj.UpdateInterval <= 0f)
                return false;

            int frameSkip = Mathf.Max(1, Mathf.RoundToInt(1f / obj.UpdateInterval));
            return (_frameCounter % frameSkip) != 0;
        }

        private void UpdateObjectVisibility(CullableObject obj)
        {
            Vector3 pos = obj.Object.transform.position;

            // Update bounds if moved significantly
            if ((pos - obj.LastPosition).sqrMagnitude > 0.01f)
            {
                Renderer rend = obj.Object.GetComponentInChildren<Renderer>();
                obj.WorldBounds = rend != null ? rend.bounds : new Bounds(pos, Vector3.one * 0.5f);
                obj.LastPosition = pos;
            }

            bool visible = IsInCameraView(obj.WorldBounds, obj.Importance);
            bool wasVisible = obj.IsVisible;

            if (visible != wasVisible)
            {
                obj.IsVisible = visible;
                SetObjectEnabled(obj, visible);
                OnVisibilityChanged?.Invoke(obj.Object, visible);
                EventBus.Publish(new ObjectVisibilityChangedEvent
                {
                    Object = obj.Object,
                    Type = obj.Type,
                    IsVisible = visible
                });
            }
        }

        private bool IsInCameraView(Bounds bounds, float importance)
        {
            if (!UseCameraBounds || _mainCamera == null)
                return true;

            // Expand bounds by importance margin
            Vector3 expandedExtents = bounds.extents * (1f + Mathf.Max(0f, 1f - importance) * 0.5f);
            Bounds testBounds = new Bounds(bounds.center, expandedExtents * 2f);

            // Frustum test
            if (GeometryUtility.TestPlanesAABB(_cameraPlanes, testBounds))
                return true;

            // Expanded margin test for smoother pop-in
            return _expandedCameraBounds.Intersects(testBounds);
        }

        private void SetObjectEnabled(CullableObject obj, bool enabled)
        {
            GameObject go = obj.Object;
            if (go == null) return;

            // For Y-sorted 2.5D we only disable renderers and particle systems,
            // leaving transforms and colliders active for correct depth calculations.
            Renderer[] renderers = go.GetComponentsInChildren<Renderer>(true);
            foreach (var r in renderers)
            {
                if (r != null)
                    r.enabled = enabled;
            }

            ParticleSystem[] particles = go.GetComponentsInChildren<ParticleSystem>(true);
            foreach (var ps in particles)
            {
                if (ps != null)
                {
                    var emission = ps.emission;
                    emission.enabled = enabled;
                }
            }

            // Preserve Animator state (do not disable) to avoid animation reset glitches.
            // Audio sources: mute rather than disable to avoid restart pops.
            AudioSource[] audioSources = go.GetComponentsInChildren<AudioSource>(true);
            foreach (var aud in audioSources)
            {
                if (aud != null)
                    aud.mute = !enabled;
            }
        }

        #endregion

        #region Helpers

        private void BuildUpdateRateLookup()
        {
            _updateRateLookup.Clear();
            _updateRateLookup[CullableType.Player] = PlayerUpdateRate;
            _updateRateLookup[CullableType.NPC] = NPCUpdateRate;
            _updateRateLookup[CullableType.Decoration] = DecorationUpdateRate;
            _updateRateLookup[CullableType.Particle] = ParticleUpdateRate;
            _updateRateLookup[CullableType.UI] = 0f; // UI is always updated
            _updateRateLookup[CullableType.Background] = DecorationUpdateRate;
        }

        private void OnQualityTierChanged(QualityTierChangedEvent evt)
        {
            switch (evt.NewTier)
            {
                case QualityTier.Ultra:
                case QualityTier.High:
                    PlayerUpdateRate = 0f;
                    NPCUpdateRate = 0.05f;
                    DecorationUpdateRate = 0.25f;
                    ParticleUpdateRate = 0.1f;
                    break;
                case QualityTier.Medium:
                    PlayerUpdateRate = 0f;
                    NPCUpdateRate = 0.1f;
                    DecorationUpdateRate = 0.5f;
                    ParticleUpdateRate = 0.2f;
                    break;
                case QualityTier.Low:
                case QualityTier.Minimal:
                    PlayerUpdateRate = 0f;
                    NPCUpdateRate = 0.2f;
                    DecorationUpdateRate = 1f;
                    ParticleUpdateRate = 0.5f;
                    break;
            }
            BuildUpdateRateLookup();
        }

        #endregion

        #region Cleanup

        private void OnApplicationQuit()
        {
            _registeredObjects.Clear();
        }

        #endregion
    }

    #region Enums & Data Classes

    /// <summary>Object categories that receive distinct culling update frequencies.</summary>
    public enum CullableType
    {
        Player,
        NPC,
        Decoration,
        Particle,
        UI,
        Background
    }

    /// <summary>Mutable state container for a single culled object.</summary>
    [System.Serializable]
    public class CullableObject
    {
        public GameObject Object;
        public CullableType Type;
        public float Importance;
        public bool IsVisible;
        public float LastUpdateTime;
        public float UpdateInterval;
        public Bounds WorldBounds;
        public Vector3 LastPosition;
    }

    #endregion

    #region EventBus Events

    /// <summary>Event fired whenever a registered object's visibility state flips.</summary>
    public struct ObjectVisibilityChangedEvent
    {
        public GameObject Object;
        public CullableType Type;
        public bool IsVisible;
    }

    #endregion
}
