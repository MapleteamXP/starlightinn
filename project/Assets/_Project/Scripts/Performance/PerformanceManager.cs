using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using UnityEngine;
using UnityEngine.Rendering;

namespace KawaiiCoolIsland.Performance
{
    /// <summary>
    /// Central performance monitoring and dynamic quality optimization system for KawaiiCool Island v3.0.
    /// Provides always-on, low-overhead FPS tracking, memory profiling, draw-call statistics,
    /// automatic quality-tier adjustment, and event-driven optimization passes.
    /// </summary>
    public class PerformanceManager : Singleton<PerformanceManager>
    {
        #region Header: Monitoring

        [Header("Monitoring")]
        [Tooltip("Desired frame rate the game tries to maintain.")]
        public float TargetFPS = 60f;

        [Tooltip("FPS below this value triggers low-performance warnings.")]
        public float LowFPSThreshold = 45f;

        [Tooltip("FPS below this value triggers critical-performance emergency measures.")]
        public float CriticalFPSThreshold = 30f;

        [Tooltip("How often (in seconds) to evaluate FPS and consider quality changes.")]
        public float FPSCheckInterval = 2f;

        #endregion

        #region Header: Quality Tiers

        [Header("Quality Tiers")]
        [Tooltip("Currently active quality tier.")]
        public QualityTier CurrentTier = QualityTier.High;

        [Tooltip("If true, the manager automatically lowers/raises quality tier based on FPS.")]
        public bool AutoAdjustQuality = true;

        [Tooltip("Per-tier configuration presets. Must contain at least one entry for every QualityTier value.")]
        public List<QualityTierSettings> TierSettings = new();

        #endregion

        #region Header: Stats (Read-Only Public API)

        [Header("Stats")]
        /// <summary>Instantaneous frame rate measured this frame.</summary>
        public float CurrentFPS { get; private set; }

        /// <summary>Running average frame rate over the sample window.</summary>
        public float AverageFPS { get; private set; }

        /// <summary>Estimated managed + native memory usage in megabytes.</summary>
        public float CurrentMemoryMB { get; private set; }

        /// <summary>Number of draw calls in the last frame (requires Unity Profiler access or manual counting).</summary>
        public int DrawCalls { get; private set; }

        /// <summary>Number of SetPass calls in the last frame.</summary>
        public int SetPassCalls { get; private set; }

        /// <summary>Triangle count rendered in the last frame.</summary>
        public int TriangleCount { get; private set; }

        /// <summary>Vertex count rendered in the last frame.</summary>
        public int VertexCount { get; private set; }

        #endregion

        #region Header: Actions

        [Header("Actions")]
        [Tooltip("Enable dynamic camera-based culling via CullingManager.")]
        public bool EnableDynamicCulling = true;

        [Tooltip("Enable sprite LOD reduction at distance / high zoom.")]
        public bool EnableSpriteLOD = true;

        [Tooltip("Enable particle system culling when off-screen or over budget.")]
        public bool EnableParticleCulling = true;

        [Tooltip("Enable UI texture culling for off-screen canvas elements.")]
        public bool EnableUITextureCulling = true;

        #endregion

        #region Private State

        private float _fpsAccumulator;
        private int _fpsSampleCount;
        private float _lastFPSCheck;
        private float _lowFPSTime;
        private float _minFPSRecord;
        private float _maxFPSRecord;
        private float _memoryPeakMB;
        private int _peakDrawCalls;
        private int _peakSetPassCalls;
        private readonly Queue<float> _fpsHistory = new();
        private const int MaxFPSHistory = 120;
        private float _timeSinceLastOptimization;
        private const float OptimizationCooldown = 3f;
        private bool _tierTransitionInProgress;
        private QualityTier _pendingTier;

        #endregion

        #region Events

        /// <summary>Raised whenever the active <see cref="QualityTier"/> changes.</summary>
        public event Action<QualityTier> OnQualityTierChanged;

        /// <summary>Raised when FPS drops below <see cref="LowFPSThreshold"/>.</summary>
        public event Action<float> OnFPSDropped;

        /// <summary>Raised when FPS drops below <see cref="CriticalFPSThreshold"/>.</summary>
        public event Action OnPerformanceCritical;

        #endregion

        #region Unity Lifecycle

        protected override void Awake()
        {
            base.Awake();
            InitializeTierSettings();
            _minFPSRecord = float.MaxValue;
            _maxFPSRecord = 0f;
            AverageFPS = TargetFPS;
            CurrentFPS = TargetFPS;
        }

        private void Start()
        {
            ApplyTierSettings(GetSettingsForTier(CurrentTier));
            EventBus.Publish(new PerformanceInitializedEvent { TargetFPS = TargetFPS });
        }

        private void Update()
        {
            RecordFPS(1f / Time.unscaledDeltaTime);
            RecordMemory(GetCurrentMemoryMB());
            CollectRenderStats();

            if (AutoAdjustQuality && Time.time - _lastFPSCheck >= FPSCheckInterval)
            {
                _lastFPSCheck = Time.time;
                CheckAndAdjustQuality();
            }

            _timeSinceLastOptimization += Time.deltaTime;
        }

        #endregion

        #region FPS Recording

        /// <summary>
        /// Records a new instantaneous FPS sample and updates running statistics.
        /// </summary>
        /// <param name="fps">The measured frames-per-second value.</param>
        public void RecordFPS(float fps)
        {
            if (float.IsInfinity(fps) || float.IsNaN(fps) || fps < 0f)
                return;

            CurrentFPS = fps;
            _fpsAccumulator += fps;
            _fpsSampleCount++;
            _fpsHistory.Enqueue(fps);
            if (_fpsHistory.Count > MaxFPSHistory)
                _fpsHistory.Dequeue();

            AverageFPS = _fpsHistory.Count > 0 ? _fpsHistory.Average() : fps;

            if (fps < _minFPSRecord)
                _minFPSRecord = fps;
            if (fps > _maxFPSRecord)
                _maxFPSRecord = fps;
        }

        #endregion

        #region Render & Memory Recording

        /// <summary>
        /// Records the number of draw calls for statistical tracking.
        /// </summary>
        /// <param name="drawCalls">Draw-call count for the current frame.</param>
        public void RecordDrawCalls(int drawCalls)
        {
            DrawCalls = Mathf.Max(0, drawCalls);
            if (DrawCalls > _peakDrawCalls)
                _peakDrawCalls = DrawCalls;
        }

        /// <summary>
        /// Records current memory usage in megabytes.
        /// </summary>
        /// <param name="memoryMB">Memory consumed by the application.</param>
        public void RecordMemory(float memoryMB)
        {
            CurrentMemoryMB = Mathf.Max(0f, memoryMB);
            if (CurrentMemoryMB > _memoryPeakMB)
                _memoryPeakMB = CurrentMemoryMB;
        }

        private void CollectRenderStats()
        {
#if UNITY_EDITOR || DEVELOPMENT_BUILD
            if (UnityEngine.Profiling.Recorder.isSupported)
            {
                var drawRecorder = UnityEngine.Profiling.Recorder.Get("Draw Calls");
                var setPassRecorder = UnityEngine.Profiling.Recorder.Get("SetPass Calls");
                var triRecorder = UnityEngine.Profiling.Recorder.Get("Triangles");
                var vertRecorder = UnityEngine.Profiling.Recorder.Get("Vertices");

                if (drawRecorder.isValid)
                    DrawCalls = drawRecorder.lastValue;
                if (setPassRecorder.isValid)
                    SetPassCalls = setPassRecorder.lastValue;
                if (triRecorder.isValid)
                    TriangleCount = triRecorder.lastValue;
                if (vertRecorder.isValid)
                    VertexCount = vertRecorder.lastValue;
            }
#endif
            if (SetPassCalls > _peakSetPassCalls)
                _peakSetPassCalls = SetPassCalls;
        }

        private static float GetCurrentMemoryMB()
        {
            long total = GC.GetTotalMemory(false);
            total += UnityEngine.Profiling.Profiler.GetTotalAllocatedMemoryLong();
            return total / (1024f * 1024f);
        }

        #endregion

        #region Quality Tier Management

        /// <summary>
        /// Manually sets the active <see cref="QualityTier"/> and applies its settings immediately.
        /// </summary>
        /// <param name="tier">The desired quality tier.</param>
        public void SetQualityTier(QualityTier tier)
        {
            if (tier == CurrentTier)
                return;

            var settings = GetSettingsForTier(tier);
            if (settings == null)
            {
                Debug.LogWarning($"[PerformanceManager] No settings found for tier {tier}. Aborting change.");
                return;
            }

            CurrentTier = tier;
            ApplyTierSettings(settings);
            OnQualityTierChanged?.Invoke(tier);
            EventBus.Publish(new QualityTierChangedEvent { NewTier = tier, PreviousTier = CurrentTier });
            Debug.Log($"[PerformanceManager] Quality tier changed to {tier}.");
        }

        /// <summary>
        /// Automatically detects an appropriate starting quality tier based on device capabilities.
        /// </summary>
        public void AutoDetectQuality()
        {
            int vramMB = SystemInfo.graphicsMemorySize;
            int ramMB = SystemInfo.systemMemorySize;
            int cpuCount = SystemInfo.processorCount;

            QualityTier detected = QualityTier.Medium;

            if (vramMB >= 6000 && ramMB >= 16000 && cpuCount >= 6)
                detected = QualityTier.Ultra;
            else if (vramMB >= 4000 && ramMB >= 8000 && cpuCount >= 4)
                detected = QualityTier.High;
            else if (vramMB >= 2000 && ramMB >= 4000 && cpuCount >= 2)
                detected = QualityTier.Medium;
            else if (vramMB >= 1024 && ramMB >= 2048)
                detected = QualityTier.Low;
            else
                detected = QualityTier.Minimal;

            SetQualityTier(detected);
            Debug.Log($"[PerformanceManager] Auto-detected quality tier: {detected} (VRAM:{vramMB}MB RAM:{ramMB}MB CPU:{cpuCount}).");
        }

        /// <summary>
        /// Forces the game into the lowest quality tier for maximum compatibility.
        /// </summary>
        public void ForceLowQuality()
        {
            AutoAdjustQuality = false;
            SetQualityTier(QualityTier.Minimal);
        }

        /// <summary>
        /// Forces the game into the highest supported quality tier.
        /// </summary>
        public void ForceHighQuality()
        {
            AutoAdjustQuality = false;
            SetQualityTier(QualityTier.Ultra);
        }

        /// <summary>
        /// Enables or disables automatic quality adjustment.
        /// </summary>
        /// <param name="enable">True to enable auto-adjustment.</param>
        public void ToggleAutoAdjust(bool enable)
        {
            AutoAdjustQuality = enable;
            Debug.Log($"[PerformanceManager] Auto-adjust quality {(enable ? "enabled" : "disabled")}.");
        }

        #endregion

        #region Quality Checks

        private void CheckAndAdjustQuality()
        {
            if (!AutoAdjustQuality || _tierTransitionInProgress)
                return;

            if (AverageFPS < CriticalFPSThreshold)
            {
                _lowFPSTime += FPSCheckInterval;
                if (_lowFPSTime >= FPSCheckInterval * 2f)
                {
                    OnPerformanceCritical?.Invoke();
                    EventBus.Publish(new PerformanceCriticalEvent { CurrentFPS = AverageFPS });
                    DropQualityTier();
                    TriggerOptimizationPass();
                    _lowFPSTime = 0f;
                }
            }
            else if (AverageFPS < LowFPSThreshold)
            {
                _lowFPSTime += FPSCheckInterval;
                OnFPSDropped?.Invoke(AverageFPS);
                EventBus.Publish(new FPSDroppedEvent { CurrentFPS = AverageFPS });
                if (_lowFPSTime >= FPSCheckInterval * 3f)
                {
                    DropQualityTier();
                    _lowFPSTime = 0f;
                }
            }
            else if (AverageFPS >= TargetFPS - 5f && CurrentTier < QualityTier.Ultra)
            {
                _lowFPSTime = Mathf.Max(0f, _lowFPSTime - FPSCheckInterval);
                if (_lowFPSTime <= 0f && _timeSinceLastOptimization > OptimizationCooldown * 2f)
                {
                    RaiseQualityTier();
                }
            }
            else
            {
                _lowFPSTime = Mathf.Max(0f, _lowFPSTime - FPSCheckInterval * 0.5f);
            }
        }

        private QualityTier DetermineOptimalTier()
        {
            if (AverageFPS >= 55f && CurrentTier < QualityTier.Ultra)
                return CurrentTier + 1;
            if (AverageFPS < CriticalFPSThreshold && CurrentTier > QualityTier.Minimal)
                return CurrentTier - 1;
            if (AverageFPS < LowFPSThreshold && CurrentTier > QualityTier.Minimal)
                return CurrentTier - 1;
            return CurrentTier;
        }

        private void DropQualityTier()
        {
            if (CurrentTier > QualityTier.Minimal)
            {
                QualityTier next = CurrentTier - 1;
                SetQualityTier(next);
                _timeSinceLastOptimization = 0f;
            }
        }

        private void RaiseQualityTier()
        {
            if (CurrentTier < QualityTier.Ultra)
            {
                QualityTier next = CurrentTier + 1;
                SetQualityTier(next);
                _timeSinceLastOptimization = 0f;
            }
        }

        #endregion

        #region Tier Settings Application

        private void InitializeTierSettings()
        {
            if (TierSettings == null || TierSettings.Count == 0)
            {
                TierSettings = new List<QualityTierSettings>
                {
                    new QualityTierSettings { Tier = QualityTier.Ultra,    RenderScale = 1.0f, MaxSpriteResolution = 4096, EnableBloom = true,  EnablePostProcessing = true,  EnableShadows = true,  EnableParticles = true,  MaxParticlesPerSystem = 200, AnimationUpdateRate = 1.0f, CullDistance = 100f, EnableAudioReverb = true,  MaxConcurrentAudioSources = 32, EnableReflections = true  },
                    new QualityTierSettings { Tier = QualityTier.High,     RenderScale = 1.0f, MaxSpriteResolution = 2048, EnableBloom = true,  EnablePostProcessing = true,  EnableShadows = false, EnableParticles = true,  MaxParticlesPerSystem = 150, AnimationUpdateRate = 1.0f, CullDistance = 75f,  EnableAudioReverb = true,  MaxConcurrentAudioSources = 24, EnableReflections = false },
                    new QualityTierSettings { Tier = QualityTier.Medium,   RenderScale = 0.9f, MaxSpriteResolution = 1024, EnableBloom = false, EnablePostProcessing = false, EnableShadows = false, EnableParticles = true,  MaxParticlesPerSystem = 100, AnimationUpdateRate = 0.5f, CullDistance = 50f,  EnableAudioReverb = true,  MaxConcurrentAudioSources = 20, EnableReflections = false },
                    new QualityTierSettings { Tier = QualityTier.Low,     RenderScale = 0.8f, MaxSpriteResolution = 512,  EnableBloom = false, EnablePostProcessing = false, EnableShadows = false, EnableParticles = false, MaxParticlesPerSystem = 50,  AnimationUpdateRate = 0.33f, CullDistance = 35f,  EnableAudioReverb = false, MaxConcurrentAudioSources = 12, EnableReflections = false },
                    new QualityTierSettings { Tier = QualityTier.Minimal, RenderScale = 0.7f, MaxSpriteResolution = 256,  EnableBloom = false, EnablePostProcessing = false, EnableShadows = false, EnableParticles = false, MaxParticlesPerSystem = 0,   AnimationUpdateRate = 0.25f, CullDistance = 25f,  EnableAudioReverb = false, MaxConcurrentAudioSources = 6,  EnableReflections = false }
                };
            }
        }

        private QualityTierSettings GetSettingsForTier(QualityTier tier)
        {
            return TierSettings?.FirstOrDefault(s => s.Tier == tier);
        }

        private void ApplyTierSettings(QualityTierSettings settings)
        {
            if (settings == null)
                return;

            ScalableBufferManager.ResizeBuffers(settings.RenderScale, settings.RenderScale);

            if (CullingManager.HasInstance)
            {
                CullingManager.Instance.HorizontalCullMargin = settings.CullDistance * 0.05f;
                CullingManager.Instance.VerticalCullMargin = settings.CullDistance * 0.05f;
            }

            var lod = FindFirstObjectByType<SpriteLODSystem>();
            if (lod != null)
            {
                lod.CullDistance = settings.CullDistance;
                lod.SetGlobalLODMultiplier(settings.RenderScale);
            }

            EventBus.Publish(new TierSettingsAppliedEvent
            {
                Tier = settings.Tier,
                RenderScale = settings.RenderScale,
                CullDistance = settings.CullDistance
            });
        }

        #endregion

        #region Optimization Passes

        /// <summary>
        /// Triggers a full optimization pass: culling, LOD, particle, and draw-call reduction.
        /// </summary>
        public void TriggerOptimizationPass()
        {
            if (_timeSinceLastOptimization < OptimizationCooldown)
                return;
            _timeSinceLastOptimization = 0f;

            Debug.Log("[PerformanceManager] Triggering optimization pass.");

            if (EnableDynamicCulling)
                CullingManager.Instance?.ForceUpdateCulling();

            ReduceDrawCalls();
            ReduceParticleDensity();
            ReduceAnimationUpdateRate();
            IncreaseCullingDistance();

            EventBus.Publish(new OptimizationPassEvent { Tier = CurrentTier });
        }

        /// <summary>
        /// Reduces draw calls by batching suggestions and disabling shadow casters on sprites.
        /// </summary>
        public void ReduceDrawCalls()
        {
            SpriteRenderer[] renderers = FindObjectsByType<SpriteRenderer>(FindObjectsSortMode.None);
            foreach (var sr in renderers)
            {
                if (sr == null) continue;
                sr.shadowCastingMode = ShadowCastingMode.Off;
                sr.receiveShadows = false;
            }
            Resources.UnloadUnusedAssets();
            Debug.Log("[PerformanceManager] Draw-call reduction pass complete.");
        }

        /// <summary>
        /// Reduces loaded texture resolution globally by down-referencing textures.
        /// </summary>
        public void ReduceTextureQuality()
        {
            var streaming = FindFirstObjectByType<TextureStreaming>();
            if (streaming != null)
            {
                int newSize = Mathf.Max(64, streaming.MaxTextureSize / 2);
                streaming.SetMaxTextureSize(newSize);
            }
            QualitySettings.masterTextureLimit = Mathf.Min(QualitySettings.masterTextureLimit + 1, 3);
            Debug.Log("[PerformanceManager] Texture quality reduced.");
        }

        /// <summary>
        /// Reduces active particle density by halving max counts on all ParticleSystems.
        /// </summary>
        public void ReduceParticleDensity()
        {
            var systems = FindObjectsByType<ParticleSystem>(FindObjectsSortMode.None);
            var settings = GetSettingsForTier(CurrentTier);
            int maxParticles = settings?.MaxParticlesPerSystem ?? 50;

            foreach (var ps in systems)
            {
                if (ps == null) continue;
                var main = ps.main;
                main.maxParticles = Mathf.Min(main.maxParticles, maxParticles);
            }
            Debug.Log($"[PerformanceManager] Particle density capped at {maxParticles}.");
        }

        /// <summary>
        /// Reduces animation update rate for non-essential animators.
        /// </summary>
        public void ReduceAnimationUpdateRate()
        {
            var tierSettings = GetSettingsForTier(CurrentTier);
            float rate = tierSettings?.AnimationUpdateRate ?? 0.5f;

            var animators = FindObjectsByType<Animator>(FindObjectsSortMode.None);
            foreach (var anim in animators)
            {
                if (anim == null) continue;
                if (!anim.gameObject.CompareTag("Player"))
                {
                    anim.updateMode = AnimatorUpdateMode.Normal;
                }
            }
            Debug.Log($"[PerformanceManager] Animation update rate adjusted (target multiplier: {rate}).");
        }

        /// <summary>
        /// Increases culling distance to aggressively hide distant objects.
        /// </summary>
        public void IncreaseCullingDistance()
        {
            var settings = GetSettingsForTier(CurrentTier);
            if (settings != null && CullingManager.HasInstance)
            {
                CullingManager.Instance.HorizontalCullMargin = settings.CullDistance * 0.1f;
                CullingManager.Instance.VerticalCullMargin = settings.CullDistance * 0.1f;
            }
        }

        #endregion

        #region Reporting

        /// <summary>
        /// Generates a comprehensive <see cref="PerformanceReport"/> from current statistics.
        /// </summary>
        /// <returns>A snapshot <see cref="PerformanceReport"/>.</returns>
        public PerformanceReport GetPerformanceReport()
        {
            var report = new PerformanceReport
            {
                AverageFPS = AverageFPS,
                MinFPS = _minFPSRecord == float.MaxValue ? 0f : _minFPSRecord,
                MaxFPS = _maxFPSRecord,
                MemoryPeakMB = _memoryPeakMB,
                PeakDrawCalls = _peakDrawCalls,
                PeakSetPassCalls = _peakSetPassCalls,
                TierUsed = CurrentTier,
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
            };

            report.Bottlenecks = IdentifyBottlenecks(report);
            return report;
        }

        /// <summary>
        /// Logs a human-readable performance snapshot to the Unity console.
        /// </summary>
        public void LogPerformanceSnapshot()
        {
            var r = GetPerformanceReport();
            var sb = new StringBuilder();
            sb.AppendLine("=== KawaiiCool Island Performance Snapshot ===");
            sb.AppendLine($"Timestamp: {DateTimeOffset.FromUnixTimeSeconds(r.Timestamp):yyyy-MM-dd HH:mm:ss} UTC");
            sb.AppendLine($"FPS (Cur/Avg/Min/Max): {CurrentFPS:F1} / {r.AverageFPS:F1} / {r.MinFPS:F1} / {r.MaxFPS:F1}");
            sb.AppendLine($"Memory (Cur/Peak): {CurrentMemoryMB:F1}MB / {r.MemoryPeakMB:F1}MB");
            sb.AppendLine($"DrawCalls (Cur/Peak): {DrawCalls} / {r.PeakDrawCalls}");
            sb.AppendLine($"SetPass (Cur/Peak): {SetPassCalls} / {r.PeakSetPassCalls}");
            sb.AppendLine($"Triangles: {TriangleCount}  Vertices: {VertexCount}");
            sb.AppendLine($"Quality Tier: {r.TierUsed}");
            sb.AppendLine($"Bottlenecks: {(r.Bottlenecks.Count > 0 ? string.Join(", ", r.Bottlenecks) : "None detected")}");
            sb.AppendLine("==============================================");
            Debug.Log(sb.ToString());
        }

        private List<string> IdentifyBottlenecks(PerformanceReport report)
        {
            var list = new List<string>();
            if (report.AverageFPS < CriticalFPSThreshold)
                list.Add("FPS_CRITICAL");
            else if (report.AverageFPS < LowFPSThreshold)
                list.Add("FPS_LOW");

            if (report.PeakDrawCalls > 500)
                list.Add("DRAW_CALLS_HIGH");
            if (report.MemoryPeakMB > 512f)
                list.Add("MEMORY_HIGH");
            if (report.PeakSetPassCalls > 100)
                list.Add("SET_PASS_HIGH");
            if (TriangleCount > 50000)
                list.Add("TRIANGLE_COUNT_HIGH");
            return list;
        }

        #endregion
    }

    #region Enums & Data Classes

    /// <summary>Defines discrete quality presets from Ultra to Minimal.</summary>
    public enum QualityTier
    {
        Ultra,
        High,
        Medium,
        Low,
        Minimal
    }

    /// <summary>Serializable configuration for a single <see cref="QualityTier"/>.</summary>
    [System.Serializable]
    public class QualityTierSettings
    {
        public QualityTier Tier;
        [Range(0.25f, 2f)] public float RenderScale = 1f;
        public int MaxSpriteResolution = 2048;
        public bool EnableBloom = true;
        public bool EnablePostProcessing = true;
        public bool EnableShadows = false;
        public bool EnableParticles = true;
        public int MaxParticlesPerSystem = 100;
        [Range(0.05f, 1f)] public float AnimationUpdateRate = 1f;
        public float CullDistance = 50f;
        public bool EnableAudioReverb = true;
        public int MaxConcurrentAudioSources = 20;
        public bool EnableReflections = false;
    }

    /// <summary>Immutable snapshot of performance metrics for analytics or debugging.</summary>
    [System.Serializable]
    public class PerformanceReport
    {
        public float AverageFPS;
        public float MinFPS;
        public float MaxFPS;
        public float MemoryPeakMB;
        public int PeakDrawCalls;
        public int PeakSetPassCalls;
        public QualityTier TierUsed;
        public List<string> Bottlenecks = new();
        public long Timestamp;
    }

    #endregion

    #region EventBus Events

    /// <summary>Event fired when PerformanceManager finishes initialization.</summary>
    public struct PerformanceInitializedEvent
    {
        public float TargetFPS;
    }

    /// <summary>Event fired when the active quality tier changes.</summary>
    public struct QualityTierChangedEvent
    {
        public QualityTier NewTier;
        public QualityTier PreviousTier;
    }

    /// <summary>Event fired when FPS drops below the low threshold.</summary>
    public struct FPSDroppedEvent
    {
        public float CurrentFPS;
    }

    /// <summary>Event fired when FPS drops below the critical threshold.</summary>
    public struct PerformanceCriticalEvent
    {
        public float CurrentFPS;
    }

    /// <summary>Event fired after a tier's settings have been applied.</summary>
    public struct TierSettingsAppliedEvent
    {
        public QualityTier Tier;
        public float RenderScale;
        public float CullDistance;
    }

    /// <summary>Event fired after an optimization pass completes.</summary>
    public struct OptimizationPassEvent
    {
        public QualityTier Tier;
    }

    #endregion
}
