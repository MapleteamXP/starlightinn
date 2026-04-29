using System;
using System.Collections.Generic;
using UnityEngine;

namespace KawaiiCoolIsland.Performance
{
    /// <summary>
    /// Sprite Level-of-Detail (LOD) system for KawaiiCool Island v3.0.
    /// Automatically swaps sprite assets and adjusts rendering parameters based on
    /// distance from the camera and camera zoom level. Integrates with the existing
    /// nine-layer <see cref="SpriteRenderer"/> avatar architecture and respects
    /// Y-sorting depth for correct 2.5D draw order.
    /// </summary>
    public class SpriteLODSystem : MonoBehaviour
    {
        #region Header: LOD Levels

        [Header("LOD Levels")]
        [Tooltip("Ordered LOD presets. Level 0 is highest quality, larger numbers are lower quality.")]
        public List<SpriteLODLevel> LODLevels = new();

        [Tooltip("Seconds between global LOD evaluation passes.")]
        public float LODCheckInterval = 1f;

        [Tooltip("Evaluate LOD based on world-space distance from camera.")]
        public bool UseDistanceBased = true;

        [Tooltip("Evaluate LOD based on orthographic camera size / zoom factor.")]
        public bool UseZoomBased = true;

        #endregion

        #region Header: Culling

        [Header("Culling")]
        [Tooltip("Distance beyond which renderers are completely disabled.")]
        public float CullDistance = 30f;

        [Tooltip("Distance band over which objects fade out before culling. Requires shader support.")]
        public float FadeDistance = 5f;

        [Tooltip("Enable alpha fade as objects approach cull distance.")]
        public bool UseFade = true;

        #endregion

        #region Private State

        /// <summary>Internal tracking entry pairing a SpriteRenderer with its per-object config.</summary>
        private class TrackedRenderer
        {
            public SpriteRenderer Renderer;
            public LODConfig Config;
            public int CurrentLODLevel;
            public bool IsCulled;
            public float OriginalAlpha;
            public Sprite OriginalSprite;
            public bool IsFading;
        }

        private readonly List<TrackedRenderer> _trackedRenderers = new();
        private Camera _mainCamera;
        private float _lastCheckTime;
        private float _globalLODMultiplier = 1f;
        private static readonly int ShaderAlphaID = Shader.PropertyToID("_Alpha");
        private static readonly int ShaderFadeID = Shader.PropertyToID("_Fade");

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            InitializeDefaultLODLevels();
        }

        private void Start()
        {
            _mainCamera = Camera.main;
            if (_mainCamera == null)
            {
                Debug.LogWarning("[SpriteLODSystem] No Main Camera found. LOD will not function correctly.");
            }
            EventBus.Subscribe<QualityTierChangedEvent>(OnQualityTierChanged);
        }

        private void OnDestroy()
        {
            EventBus.Unsubscribe<QualityTierChangedEvent>(OnQualityTierChanged);
        }

        private void Update()
        {
            if (_mainCamera == null)
            {
                _mainCamera = Camera.main;
                if (_mainCamera == null) return;
            }

            if (Time.time - _lastCheckTime < LODCheckInterval)
                return;

            _lastCheckTime = Time.time;
            ForceUpdateAll();
        }

        #endregion

        #region Public API: Registration

        /// <summary>
        /// Registers a <see cref="SpriteRenderer"/> for automatic LOD management.
        /// </summary>
        /// <param name="renderer">The renderer to manage.</param>
        /// <param name="config">Per-object LOD configuration including sprite atlas and scale data.</param>
        public void RegisterRenderer(SpriteRenderer renderer, LODConfig config)
        {
            if (renderer == null)
            {
                Debug.LogWarning("[SpriteLODSystem] Attempted to register a null renderer.");
                return;
            }

            // Prevent duplicate registration
            for (int i = 0; i < _trackedRenderers.Count; i++)
            {
                if (_trackedRenderers[i].Renderer == renderer)
                {
                    _trackedRenderers[i].Config = config ?? new LODConfig();
                    return;
                }
            }

            _trackedRenderers.Add(new TrackedRenderer
            {
                Renderer = renderer,
                Config = config ?? new LODConfig(),
                CurrentLODLevel = 0,
                IsCulled = false,
                OriginalAlpha = renderer.color.a,
                OriginalSprite = renderer.sprite,
                IsFading = false
            });
        }

        /// <summary>
        /// Unregisters a <see cref="SpriteRenderer"/> from LOD management and restores its original sprite.
        /// </summary>
        /// <param name="renderer">The renderer to release.</param>
        public void UnregisterRenderer(SpriteRenderer renderer)
        {
            if (renderer == null) return;

            for (int i = _trackedRenderers.Count - 1; i >= 0; i--)
            {
                if (_trackedRenderers[i].Renderer == renderer)
                {
                    RestoreOriginalState(_trackedRenderers[i]);
                    _trackedRenderers.RemoveAt(i);
                    return;
                }
            }
        }

        /// <summary>
        /// Forces an immediate LOD evaluation for every registered renderer.
        /// Call this after camera teleportation, zoom changes, or manual quality tier switches.
        /// </summary>
        public void ForceUpdateAll()
        {
            for (int i = 0; i < _trackedRenderers.Count; i++)
            {
                var tracked = _trackedRenderers[i];
                if (tracked.Renderer == null)
                {
                    _trackedRenderers.RemoveAt(i);
                    i--;
                    continue;
                }
                UpdateLODForRenderer(tracked);
            }
        }

        /// <summary>
        /// Sets a global multiplier applied to all LOD distance thresholds.
        /// Useful when the quality tier changes and we want to tighten or relax LOD globally.
        /// </summary>
        /// <param name="multiplier">Value to multiply against distance thresholds. 1.0 = default.</param>
        public void SetGlobalLODMultiplier(float multiplier)
        {
            _globalLODMultiplier = Mathf.Clamp(multiplier, 0.1f, 2f);
        }

        #endregion

        #region Core LOD Logic

        private void UpdateLODForRenderer(TrackedRenderer tracked)
        {
            SpriteRenderer renderer = tracked.Renderer;
            LODConfig config = tracked.Config;

            Vector3 position = renderer.transform.position;
            float distance = Vector3.Distance(position, _mainCamera.transform.position);
            float zoom = GetCameraZoomFactor();

            // 1. Culling check
            float effectiveCull = CullDistance / Mathf.Max(config.Importance, 0.1f);
            if (distance > effectiveCull && config.CanCull)
            {
                if (!tracked.IsCulled)
                {
                    tracked.IsCulled = true;
                    renderer.enabled = false;
                }
                return;
            }
            else if (tracked.IsCulled)
            {
                tracked.IsCulled = false;
                renderer.enabled = true;
            }

            // 2. Fade handling
            float fadeStart = effectiveCull - FadeDistance;
            if (UseFade && distance > fadeStart && config.CanCull)
            {
                float fadeT = Mathf.InverseLerp(fadeStart, effectiveCull, distance);
                ApplyFade(renderer, tracked, 1f - fadeT);
                tracked.IsFading = true;
            }
            else if (tracked.IsFading)
            {
                ApplyFade(renderer, tracked, 1f);
                tracked.IsFading = false;
            }

            // 3. Calculate LOD level
            int lodLevel = CalculateLODLevel(distance, zoom, config);
            if (lodLevel == tracked.CurrentLODLevel)
                return;

            tracked.CurrentLODLevel = lodLevel;
            ApplyLOD(tracked, lodLevel);
        }

        private int CalculateLODLevel(float distance, float zoom, LODConfig config)
        {
            int bestLevel = 0;

            for (int i = 0; i < LODLevels.Count; i++)
            {
                SpriteLODLevel level = LODLevels[i];
                bool distanceOk = !UseDistanceBased || distance <= level.MaxDistance * _globalLODMultiplier;
                bool zoomOk = !UseZoomBased || zoom >= level.MinZoom;

                if (distanceOk && zoomOk)
                {
                    bestLevel = level.Level;
                }
                else
                {
                    // Once a level fails, all subsequent (lower-quality) levels are even stricter,
                    // so we can break early if our list is sorted by ascending quality.
                    break;
                }
            }

            // Clamp to available sprites in config
            if (config.LODSprites != null && config.LODSprites.Count > 0)
            {
                bestLevel = Mathf.Clamp(bestLevel, 0, config.LODSprites.Count - 1);
            }
            else
            {
                bestLevel = 0;
            }

            return bestLevel;
        }

        private void ApplyLOD(TrackedRenderer tracked, int lodLevel)
        {
            SpriteRenderer renderer = tracked.Renderer;
            LODConfig config = tracked.Config;

            // Swap sprite
            if (config.LODSprites != null && lodLevel < config.LODSprites.Count)
            {
                Sprite replacement = config.LODSprites[lodLevel];
                if (replacement != null && renderer.sprite != replacement)
                {
                    renderer.sprite = replacement;
                }
            }
            else if (lodLevel == 0 && tracked.OriginalSprite != null)
            {
                renderer.sprite = tracked.OriginalSprite;
            }

            // Apply scale multiplier from LOD level definition
            if (lodLevel < LODLevels.Count)
            {
                float scaleMul = LODLevels[lodLevel].ScaleMultiplier;
                renderer.transform.localScale = Vector3.one * (config.BaseScale * scaleMul);
            }

            // Skip animation flag from LOD level
            if (lodLevel < LODLevels.Count && LODLevels[lodLevel].SkipAnimation)
            {
                var anim = renderer.GetComponent<Animator>();
                if (anim != null && anim.enabled)
                    anim.enabled = false;
            }
            else
            {
                var anim = renderer.GetComponent<Animator>();
                if (anim != null && !anim.enabled)
                    anim.enabled = true;
            }
        }

        private void CullIfOffScreen(SpriteRenderer renderer)
        {
            if (renderer == null || _mainCamera == null) return;
            Vector3 viewportPos = _mainCamera.WorldToViewportPoint(renderer.transform.position);
            bool onScreen = viewportPos.x >= -0.05f && viewportPos.x <= 1.05f
                         && viewportPos.y >= -0.05f && viewportPos.y <= 1.05f
                         && viewportPos.z > 0f;
            renderer.enabled = onScreen;
        }

        #endregion

        #region Fade & Camera Helpers

        private void ApplyFade(SpriteRenderer renderer, TrackedRenderer tracked, float alphaMultiplier)
        {
            Color c = renderer.color;
            c.a = tracked.OriginalAlpha * alphaMultiplier;
            renderer.color = c;

            if (renderer.material != null && renderer.material.HasProperty(ShaderFadeID))
            {
                renderer.material.SetFloat(ShaderFadeID, alphaMultiplier);
            }
        }

        private float GetCameraZoomFactor()
        {
            if (_mainCamera == null) return 1f;
            return _mainCamera.orthographic ? _mainCamera.orthographicSize : _mainCamera.fieldOfView;
        }

        private void RestoreOriginalState(TrackedRenderer tracked)
        {
            if (tracked.Renderer == null) return;
            tracked.Renderer.enabled = true;
            if (tracked.OriginalSprite != null)
                tracked.Renderer.sprite = tracked.OriginalSprite;
            Color c = tracked.Renderer.color;
            c.a = tracked.OriginalAlpha;
            tracked.Renderer.color = c;
        }

        #endregion

        #region EventBus Integration

        private void OnQualityTierChanged(QualityTierChangedEvent evt)
        {
            // Tighten LOD when quality drops, relax when it rises
            float mul = evt.NewTier <= QualityTier.Medium ? 0.7f : 1f;
            SetGlobalLODMultiplier(mul);
            ForceUpdateAll();
        }

        #endregion

        #region Defaults

        private void InitializeDefaultLODLevels()
        {
            if (LODLevels != null && LODLevels.Count > 0)
                return;

            LODLevels = new List<SpriteLODLevel>
            {
                new SpriteLODLevel { Level = 0, MaxDistance = 10f,  MinZoom = 0f,   ScaleMultiplier = 1.0f, SkipAnimation = false },
                new SpriteLODLevel { Level = 1, MaxDistance = 20f,  MinZoom = 2f,   ScaleMultiplier = 0.9f, SkipAnimation = false },
                new SpriteLODLevel { Level = 2, MaxDistance = 35f,  MinZoom = 5f,   ScaleMultiplier = 0.75f, SkipAnimation = true  },
                new SpriteLODLevel { Level = 3, MaxDistance = 50f,  MinZoom = 8f,   ScaleMultiplier = 0.5f, SkipAnimation = true  },
                new SpriteLODLevel { Level = 4, MaxDistance = 75f,  MinZoom = 12f,  ScaleMultiplier = 0.35f, SkipAnimation = true  }
            };
        }

        #endregion
    }

    #region Data Classes

    /// <summary>
    /// Defines a single LOD level threshold and optional visual simplification rules.
    /// </summary>
    [System.Serializable]
    public class SpriteLODLevel
    {
        [Tooltip("LOD index. 0 = original/highest quality.")]
        public int Level;

        [Tooltip("Maximum world distance at which this LOD level is still used.")]
        public float MaxDistance;

        [Tooltip("Minimum camera zoom (orthographicSize / FOV) to qualify for this LOD.")]
        public float MinZoom;

        [Tooltip("Alternative sprite asset for this LOD. May be null to reuse original.")]
        public Sprite ReplacementSprite;

        [Tooltip("Uniform scale multiplier applied to the renderer transform at this LOD.")]
        public float ScaleMultiplier = 1f;

        [Tooltip("If true, Animator components on this object are disabled to save CPU.")]
        public bool SkipAnimation = false;
    }

    /// <summary>
    /// Per-object LOD configuration supplied when registering a <see cref="SpriteRenderer"/>.
    /// </summary>
    [System.Serializable]
    public class LODConfig
    {
        [Tooltip("Ordered list of replacement sprites, index matching LOD level.")]
        public List<Sprite> LODSprites = new();

        [Tooltip("Base uniform scale for this object.")]
        public float BaseScale = 1f;

        [Tooltip("If false, this object is never culled regardless of distance.")]
        public bool CanCull = true;

        [Tooltip("Importance multiplier. Higher values resist culling (1.0 = normal).")]
        public float Importance = 1f;
    }

    #endregion
}
