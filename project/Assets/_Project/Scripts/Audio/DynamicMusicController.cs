using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Audio;

namespace KawaiiCoolIsland.Audio
{
    /// <summary>
    /// Represents the current state of the dynamic music system.
    /// Each state maps to a different arrangement of layered audio tracks.
    /// </summary>
    public enum MusicState
    {
        /// <summary>Menu screen - minimal layers.</summary>
        Menu,
        /// <summary>Exploring the island - standard exploration mix.</summary>
        Explore,
        /// <summary>Social areas with other players - fuller arrangement.</summary>
        Social,
        /// <summary>Active minigame - all layers engaged.</summary>
        Minigame,
        /// <summary>Island editing mode - relaxed, creative music.</summary>
        IslandEdit,
        /// <summary>Fashion show event - dramatic, stylish arrangement.</summary>
        FashionShow,
        /// <summary>Countdown timer - tense, building music.</summary>
        Countdown
    }

    /// <summary>
    /// Controls the dynamic layered music system for KawaiiCool Island.
    /// Manages 4 synchronized audio layers (Base, Melody, Harmony, Accent) that
    /// crossfade based on game state. Supports AudioMixer snapshots for different
    /// gameplay contexts, BPM synchronization, beat/bar events, and fever mode.
    /// </summary>
    [RequireComponent(typeof(AudioSource))]
    public class DynamicMusicController : MonoBehaviour
    {
        #region Singleton
        /// <summary>Static instance of the DynamicMusicController.</summary>
        public static DynamicMusicController Instance { get; private set; }
        #endregion

        #region Inspector Fields
        [Header("Audio Sources (Layers)")]
        [Tooltip("Drums and bass - always playing at minimum level.")]
        public AudioSource BaseLayer;

        [Tooltip("Main melody line.")]
        public AudioSource MelodyLayer;

        [Tooltip("Chords, pads, and harmonic content.")]
        public AudioSource HarmonyLayer;

        [Tooltip("Sparkles, fills, and accent sounds.")]
        public AudioSource AccentLayer;

        [Header("Mixer")]
        [Tooltip("The AudioMixer containing the Music group.")]
        public AudioMixer MusicMixer;

        [Tooltip("Name of the music group in the AudioMixer.")]
        public string MusicGroupName = "Music";

        [Header("Snapshots")]
        [Tooltip("Snapshot for menu screen state.")]
        public AudioMixerSnapshot MenuSnapshot;

        [Tooltip("Snapshot for island exploration state.")]
        public AudioMixerSnapshot ExploreSnapshot;

        [Tooltip("Snapshot for social interaction areas.")]
        public AudioMixerSnapshot SocialSnapshot;

        [Tooltip("Snapshot for minigame activities.")]
        public AudioMixerSnapshot MinigameSnapshot;

        [Tooltip("Snapshot for island editing mode.")]
        public AudioMixerSnapshot IslandEditSnapshot;

        [Tooltip("Default duration for snapshot transitions in seconds.")]
        public float SnapshotTransitionTime = 2f;

        [Header("Layer Volumes")]
        [Tooltip("Animation curve used for layer volume fading. X=time, Y=volume.")]
        public AnimationCurve LayerFadeCurve = AnimationCurve.EaseInOut(0, 0, 1, 1);

        [Tooltip("Speed multiplier for layer volume fades.")]
        public float LayerFadeSpeed = 2f;

        [Header("BPM & Sync")]
        [Tooltip("Base beats per minute for the music.")]
        [SerializeField] private float _baseBPM = 120f;

        [Tooltip("Enable beat and bar event dispatching.")]
        public bool EnableBeatEvents = true;
        #endregion

        #region Private State
        private MusicState _currentState = MusicState.Menu;
        private Dictionary<MusicState, float[]> _layerVolumes = new();
        private readonly float[] _currentVolumes = new float[4];
        private readonly float[] _targetVolumes = new float[4];
        private Coroutine _snapshotCoroutine;
        private Coroutine _feverCoroutine;
        private float _previousBarPosition = -1f;
        private float _previousBeatPosition = -1f;
        private bool _isFeverMode;
        private float _feverBPMMultiplier = 1f;
        private bool _isPaused;
        private bool _initialized;

        /// <summary>Volume multipliers per layer index during fever mode.</summary>
        private readonly float[] _feverLayerMultipliers = new float[4];
        #endregion

        #region Public Properties
        /// <summary>Gets the current music state.</summary>
        public MusicState CurrentState => _currentState;

        /// <summary>Gets whether any layer is currently playing.</summary>
        public bool IsPlaying => BaseLayer != null && BaseLayer.isPlaying;

        /// <summary>Gets or sets the current BPM of the music.</summary>
        public float CurrentBPM { get; private set; } = 120f;

        /// <summary>Gets whether fever mode is currently active.</summary>
        public bool IsFeverMode => _isFeverMode;

        /// <summary>Gets the layer fade progress as a value from 0 to 1.</summary>
        public float LayerFadeProgress { get; private set; } = 1f;
        #endregion

        #region Events
        /// <summary>Invoked when the music state changes. Parameter is the new state.</summary>
        public event Action<MusicState> OnMusicStateChanged;

        /// <summary>Invoked on each beat (based on CurrentBPM).</summary>
        public event Action OnBeat;

        /// <summary>Invoked on each bar (4 beats, based on CurrentBPM).</summary>
        public event Action OnBar;
        #endregion

        #region Unity Lifecycle
        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Debug.LogWarning("[DynamicMusicController] Duplicate instance found. Destroying.");
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void Start()
        {
            Initialize();
        }

        private void Update()
        {
            if (!_initialized || _isPaused) return;

            UpdateLayerVolumes();
            SyncAudioSources();

            if (EnableBeatEvents && IsPlaying)
            {
                DispatchBeatEvents();
            }
        }

        private void OnDestroy()
        {
            if (_snapshotCoroutine != null)
                StopCoroutine(_snapshotCoroutine);
            if (_feverCoroutine != null)
                StopCoroutine(_feverCoroutine);

            if (Instance == this)
                Instance = null;
        }
        #endregion

        #region Initialization
        /// <summary>
        /// Initializes the dynamic music controller. Sets up layer volume mappings,
        /// validates audio sources, and prepares the system for playback.
        /// </summary>
        public void Initialize()
        {
            if (_initialized) return;

            ValidateAudioSources();
            InitializeLayerVolumes();
            CurrentBPM = _baseBPM;

            for (int i = 0; i < 4; i++)
            {
                _feverLayerMultipliers[i] = 1f;
            }

            _initialized = true;
            Debug.Log("[DynamicMusicController] Initialized successfully.");
        }

        /// <summary>
        /// Validates that all required AudioSource components are assigned.
        /// Logs warnings for any missing references.
        /// </summary>
        private void ValidateAudioSources()
        {
            if (BaseLayer == null)
                Debug.LogError("[DynamicMusicController] BaseLayer AudioSource is not assigned!");
            if (MelodyLayer == null)
                Debug.LogWarning("[DynamicMusicController] MelodyLayer AudioSource is not assigned.");
            if (HarmonyLayer == null)
                Debug.LogWarning("[DynamicMusicController] HarmonyLayer AudioSource is not assigned.");
            if (AccentLayer == null)
                Debug.LogWarning("[DynamicMusicController] AccentLayer AudioSource is not assigned.");

            // Ensure all layers don't play on awake
            AudioSource[] sources = { BaseLayer, MelodyLayer, HarmonyLayer, AccentLayer };
            foreach (var source in sources)
            {
                if (source != null)
                    source.playOnAwake = false;
            }
        }

        /// <summary>
        /// Initializes the default volume mappings for each music state.
        /// Each state defines a 4-element float array for [Base, Melody, Harmony, Accent] volumes.
        /// </summary>
        private void InitializeLayerVolumes()
        {
            // Layer order: [Base, Melody, Harmony, Accent]
            _layerVolumes[MusicState.Menu] = new[] { 0.4f, 0.0f, 0.0f, 0.0f };
            _layerVolumes[MusicState.Explore] = new[] { 0.7f, 0.5f, 0.3f, 0.0f };
            _layerVolumes[MusicState.Social] = new[] { 0.8f, 0.7f, 0.6f, 0.3f };
            _layerVolumes[MusicState.Minigame] = new[] { 0.9f, 0.8f, 0.7f, 0.8f };
            _layerVolumes[MusicState.IslandEdit] = new[] { 0.5f, 0.4f, 0.5f, 0.2f };
            _layerVolumes[MusicState.FashionShow] = new[] { 0.7f, 0.9f, 0.8f, 0.6f };
            _layerVolumes[MusicState.Countdown] = new[] { 0.9f, 0.3f, 0.5f, 0.9f };

            // Initialize current volumes to match menu state
            if (_layerVolumes.TryGetValue(MusicState.Menu, out float[] menuVolumes))
            {
                for (int i = 0; i < 4; i++)
                {
                    _currentVolumes[i] = menuVolumes[i];
                    _targetVolumes[i] = menuVolumes[i];
                }
            }
        }
        #endregion

        #region Playback Control
        /// <summary>
        /// Starts playing all music layers from the beginning, synchronized.
        /// </summary>
        public void Play()
        {
            if (!_initialized) Initialize();

            double startTime = AudioSettings.dspTime + 0.1;

            PlayLayer(BaseLayer, startTime);
            PlayLayer(MelodyLayer, startTime);
            PlayLayer(HarmonyLayer, startTime);
            PlayLayer(AccentLayer, startTime);

            ApplyLayerVolumes();
            Debug.Log("[DynamicMusicController] Started playback.");
        }

        /// <summary>
        /// Helper to safely play a single layer at a scheduled DSP time.
        /// </summary>
        private void PlayLayer(AudioSource source, double dspTime)
        {
            if (source == null || source.clip == null) return;
            source.Stop();
            source.PlayScheduled(dspTime);
        }

        /// <summary>
        /// Pauses all music layers.
        /// </summary>
        public void Pause()
        {
            _isPaused = true;
            BaseLayer?.Pause();
            MelodyLayer?.Pause();
            HarmonyLayer?.Pause();
            AccentLayer?.Pause();
        }

        /// <summary>
        /// Resumes all music layers from their paused positions.
        /// </summary>
        public void Resume()
        {
            _isPaused = false;
            BaseLayer?.UnPause();
            MelodyLayer?.UnPause();
            HarmonyLayer?.UnPause();
            AccentLayer?.UnPause();
        }

        /// <summary>
        /// Stops all music layers.
        /// </summary>
        public void Stop()
        {
            BaseLayer?.Stop();
            MelodyLayer?.Stop();
            HarmonyLayer?.Stop();
            AccentLayer?.Stop();
            _isPaused = false;
        }
        #endregion

        #region State Management
        /// <summary>
        /// Transitions the music to a new state with smooth crossfading between layer volumes.
        /// </summary>
        /// <param name="state">The target music state.</param>
        /// <param name="transitionTime">
        /// Duration of the transition in seconds. Use -1 to use the default SnapshotTransitionTime.
        /// </param>
        public void SetMusicState(MusicState state, float transitionTime = -1)
        {
            if (_currentState == state) return;

            float fadeTime = transitionTime < 0 ? SnapshotTransitionTime : transitionTime;
            _currentState = state;

            if (_layerVolumes.TryGetValue(state, out float[] volumes))
            {
                for (int i = 0; i < 4; i++)
                {
                    float feverMult = _isFeverMode ? _feverLayerMultipliers[i] : 1f;
                    _targetVolumes[i] = volumes[i] * feverMult;
                }
            }
            else
            {
                Debug.LogWarning($"[DynamicMusicController] No volume mapping found for state {state}.");
            }

            // Auto-transition to matching snapshot if available
            AudioMixerSnapshot targetSnapshot = GetSnapshotForState(state);
            if (targetSnapshot != null)
            {
                CrossfadeToSnapshot(targetSnapshot, fadeTime);
            }

            OnMusicStateChanged?.Invoke(state);
            Debug.Log($"[DynamicMusicController] State changed to {state} (fade: {fadeTime}s).");
        }

        /// <summary>
        /// Gets the AudioMixerSnapshot associated with a given music state.
        /// </summary>
        private AudioMixerSnapshot GetSnapshotForState(MusicState state)
        {
            return state switch
            {
                MusicState.Menu => MenuSnapshot,
                MusicState.Explore => ExploreSnapshot,
                MusicState.Social => SocialSnapshot,
                MusicState.Minigame => MinigameSnapshot,
                MusicState.IslandEdit => IslandEditSnapshot,
                _ => null
            };
        }
        #endregion

        #region Layer Volume Control
        /// <summary>
        /// Sets the volume for a specific layer by index.
        /// </summary>
        /// <param name="layerIndex">0=Base, 1=Melody, 2=Harmony, 3=Accent</param>
        /// <param name="volume">Target volume from 0 to 1.</param>
        /// <param name="fadeTime">Fade duration. Use -1 for default LayerFadeSpeed.</param>
        public void SetLayerVolume(int layerIndex, float volume, float fadeTime = -1)
        {
            if (layerIndex < 0 || layerIndex >= 4)
            {
                Debug.LogError($"[DynamicMusicController] Invalid layer index: {layerIndex}. Must be 0-3.");
                return;
            }

            _targetVolumes[layerIndex] = Mathf.Clamp01(volume);
        }

        /// <summary>
        /// Smoothly updates layer volumes toward their targets each frame.
        /// </summary>
        private void UpdateLayerVolumes()
        {
            float delta = Time.deltaTime * LayerFadeSpeed;
            bool allReached = true;

            for (int i = 0; i < 4; i++)
            {
                if (Mathf.Abs(_currentVolumes[i] - _targetVolumes[i]) > 0.001f)
                {
                    float t = Mathf.Clamp01(delta / Mathf.Max(0.01f, Mathf.Abs(_targetVolumes[i] - _currentVolumes[i])));
                    float curveT = LayerFadeCurve.Evaluate(t);
                    _currentVolumes[i] = Mathf.Lerp(_currentVolumes[i], _targetVolumes[i], curveT);
                    allReached = false;
                }
                else
                {
                    _currentVolumes[i] = _targetVolumes[i];
                }
            }

            LayerFadeProgress = allReached ? 1f : LayerFadeProgress;
            ApplyLayerVolumes();
        }

        /// <summary>
        /// Applies the current volume values to each AudioSource.
        /// </summary>
        private void ApplyLayerVolumes()
        {
            if (BaseLayer != null) BaseLayer.volume = _currentVolumes[0];
            if (MelodyLayer != null) MelodyLayer.volume = _currentVolumes[1];
            if (HarmonyLayer != null) HarmonyLayer.volume = _currentVolumes[2];
            if (AccentLayer != null) AccentLayer.volume = _currentVolumes[3];
        }

        /// <summary>
        /// Sets the master volume on the AudioMixer music group.
        /// </summary>
        /// <param name="volume">Volume from 0 to 1.</param>
        public void SetMasterVolume(float volume)
        {
            float db = VolumeToDecibel(Mathf.Clamp01(volume));
            if (MusicMixer != null)
            {
                MusicMixer.SetFloat("MasterVolume", db);
            }
        }

        /// <summary>
        /// Sets the music group volume on the AudioMixer.
        /// </summary>
        /// <param name="volume">Volume from 0 to 1.</param>
        public void SetMusicVolume(float volume)
        {
            float db = VolumeToDecibel(Mathf.Clamp01(volume));
            if (MusicMixer != null)
            {
                MusicMixer.SetFloat("MusicVolume", db);
            }
        }

        /// <summary>
        /// Converts a linear volume (0-1) to decibels.
        /// </summary>
        private float VolumeToDecibel(float volume)
        {
            if (volume <= 0.0001f) return -80f;
            return 20f * Mathf.Log10(volume);
        }
        #endregion

        #region Snapshot Management
        /// <summary>
        /// Transitions the AudioMixer to a specific snapshot over a duration.
        /// </summary>
        /// <param name="snapshot">The target snapshot.</param>
        /// <param name="duration">Transition duration in seconds.</param>
        public void CrossfadeToSnapshot(AudioMixerSnapshot snapshot, float duration)
        {
            if (snapshot == null)
            {
                Debug.LogWarning("[DynamicMusicController] Cannot transition to null snapshot.");
                return;
            }

            if (_snapshotCoroutine != null)
                StopCoroutine(_snapshotCoroutine);

            _snapshotCoroutine = StartCoroutine(SnapshotTransitionCoroutine(snapshot, duration));
        }

        /// <summary>
        /// Coroutine that handles smooth snapshot transitions.
        /// </summary>
        private IEnumerator SnapshotTransitionCoroutine(AudioMixerSnapshot snapshot, float duration)
        {
            snapshot.TransitionTo(duration);
            yield return new WaitForSeconds(duration);
            _snapshotCoroutine = null;
        }
        #endregion

        #region Fever Mode
        /// <summary>
        /// Activates fever mode with increased BPM and boosted layer volumes.
        /// </summary>
        /// <param name="bpmMultiplier">Multiplier for the current BPM (default 1.2x).</param>
        public void StartFeverMode(float bpmMultiplier = 1.2f)
        {
            if (_isFeverMode) return;

            _isFeverMode = true;
            _feverBPMMultiplier = bpmMultiplier;
            CurrentBPM = _baseBPM * bpmMultiplier;

            // Boost layers for fever mode
            _feverLayerMultipliers[0] = 1.1f;  // Base
            _feverLayerMultipliers[1] = 1.2f;  // Melody
            _feverLayerMultipliers[2] = 1.15f; // Harmony
            _feverLayerMultipliers[3] = 1.3f;  // Accent

            // Re-apply current state with fever multipliers
            SetMusicState(_currentState, 0.5f);

            // Adjust pitch on all sources to match new BPM
            float pitchMultiplier = bpmMultiplier;
            ApplyPitchToAllLayers(pitchMultiplier);

            Debug.Log($"[DynamicMusicController] Fever mode started! BPM: {CurrentBPM}");
        }

        /// <summary>
        /// Deactivates fever mode and returns to normal BPM and volumes.
        /// </summary>
        public void EndFeverMode()
        {
            if (!_isFeverMode) return;

            _isFeverMode = false;
            CurrentBPM = _baseBPM;

            for (int i = 0; i < 4; i++)
            {
                _feverLayerMultipliers[i] = 1f;
            }

            SetMusicState(_currentState, 1f);
            ApplyPitchToAllLayers(1f);

            Debug.Log("[DynamicMusicController] Fever mode ended.");
        }

        /// <summary>
        /// Applies a pitch multiplier to all layer AudioSources.
        /// </summary>
        private void ApplyPitchToAllLayers(float pitch)
        {
            if (BaseLayer != null) BaseLayer.pitch = pitch;
            if (MelodyLayer != null) MelodyLayer.pitch = pitch;
            if (HarmonyLayer != null) HarmonyLayer.pitch = pitch;
            if (AccentLayer != null) AccentLayer.pitch = pitch;
        }
        #endregion

        #region BPM & Sync
        /// <summary>
        /// Sets the BPM and adjusts all layer pitches accordingly.
        /// </summary>
        /// <param name="bpm">The new beats per minute.</param>
        public void SetBPM(float bpm)
        {
            _baseBPM = Mathf.Clamp(bpm, 60f, 200f);
            CurrentBPM = _isFeverMode ? _baseBPM * _feverBPMMultiplier : _baseBPM;

            float pitchMult = CurrentBPM / 120f; // Relative to base 120 BPM
            ApplyPitchToAllLayers(pitchMult);
        }

        /// <summary>
        /// Synchronizes all audio sources to the same playback position.
        /// Ensures layers stay in time with each other.
        /// </summary>
        private void SyncAudioSources()
        {
            if (!IsPlaying) return;

            // Keep all sources in sync by matching to base layer
            float baseTime = BaseLayer.time;
            SyncLayer(MelodyLayer, baseTime);
            SyncLayer(HarmonyLayer, baseTime);
            SyncLayer(AccentLayer, baseTime);
        }

        /// <summary>
        /// Syncs a single layer to the target time if it has drifted.
        /// </summary>
        private void SyncLayer(AudioSource source, float targetTime)
        {
            if (source == null || !source.isPlaying || source.clip == null) return;

            float drift = Mathf.Abs(source.time - targetTime);
            if (drift > 0.05f)
            {
                source.time = targetTime;
            }
        }

        /// <summary>
        /// Gets the current position within a beat as a value from 0 to 1.
        /// </summary>
        /// <returns>Normalized position within the current beat (0 = start, 1 = end).</returns>
        public float GetBeatPosition()
        {
            if (!IsPlaying) return 0f;

            float beatDuration = 60f / CurrentBPM;
            return (BaseLayer.time % beatDuration) / beatDuration;
        }

        /// <summary>
        /// Gets the current position within a bar (4 beats) as a value from 0 to 1.
        /// </summary>
        /// <returns>Normalized position within the current bar (0 = start, 1 = end).</returns>
        public float GetBarPosition()
        {
            if (!IsPlaying) return 0f;

            float barDuration = 240f / CurrentBPM; // 4 beats per bar
            return (BaseLayer.time % barDuration) / barDuration;
        }

        /// <summary>
        /// Dispatches beat and bar events based on playback position.
        /// </summary>
        private void DispatchBeatEvents()
        {
            float beatPos = GetBeatPosition();
            float barPos = GetBarPosition();

            // Detect beat crossing
            if (_previousBeatPosition > 0.8f && beatPos < 0.2f)
            {
                OnBeat?.Invoke();
            }

            // Detect bar crossing
            if (_previousBarPosition > 0.9f && barPos < 0.1f)
            {
                OnBar?.Invoke();
            }

            _previousBeatPosition = beatPos;
            _previousBarPosition = barPos;
        }
        #endregion

        #region Utility
        /// <summary>
        /// Sets custom volume mappings for a music state. Useful for overriding defaults.
        /// </summary>
        /// <param name="state">The music state to configure.</param>
        /// <param name="volumes">
        /// Array of 4 floats: [BaseVolume, MelodyVolume, HarmonyVolume, AccentVolume].
        /// </param>
        public void SetStateLayerVolumes(MusicState state, float[] volumes)
        {
            if (volumes == null || volumes.Length != 4)
            {
                Debug.LogError("[DynamicMusicController] Volume array must have exactly 4 elements.");
                return;
            }

            _layerVolumes[state] = new[]
            {
                Mathf.Clamp01(volumes[0]),
                Mathf.Clamp01(volumes[1]),
                Mathf.Clamp01(volumes[2]),
                Mathf.Clamp01(volumes[3])
            };
        }

        /// <summary>
        /// Gets the current volume of a specific layer.
        /// </summary>
        /// <param name="layerIndex">0=Base, 1=Melody, 2=Harmony, 3=Accent</param>
        /// <returns>Current volume from 0 to 1.</returns>
        public float GetLayerVolume(int layerIndex)
        {
            if (layerIndex < 0 || layerIndex >= 4) return 0f;
            return _currentVolumes[layerIndex];
        }

        /// <summary>
        /// Checks if the music system is initialized and ready.
        /// </summary>
        public bool IsInitialized => _initialized;
        #endregion
    }
}
