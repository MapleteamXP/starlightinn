using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Audio;
using UnityEngine.Pool;
using Object = UnityEngine.Object;

namespace KawaiiCoolIsland.Audio
{
    /// <summary>
    /// Categories for organizing sound effects.
    /// </summary>
    public enum SFXCategory
    {
        /// <summary>UI interaction sounds.</summary>
        UI,
        /// <summary>Footstep sounds for different surfaces.</summary>
        Footsteps,
        /// <summary>General interaction sounds.</summary>
        Interactions,
        /// <summary>Minigame-specific sounds.</summary>
        Minigames,
        /// <summary>Ambient environmental sounds.</summary>
        Ambient,
        /// <summary>Voice lines and character speech.</summary>
        Voice,
        /// <summary>Emote expression sounds.</summary>
        Emotes,
        /// <summary>Weather-related sounds.</summary>
        Weather
    }

    /// <summary>
    /// ScriptableObject containing data for a single sound effect.
    /// </summary>
    [CreateAssetMenu(fileName = "SFX_", menuName = "KawaiiCool/SFX")]
    public class SFXData : ScriptableObject
    {
        [Tooltip("Unique identifier for this SFX.")]
        public string SFXId;

        [Tooltip("Human-readable display name.")]
        public string DisplayName;

        [Tooltip("The audio clip to play.")]
        public AudioClip Clip;

        [Tooltip("Category this SFX belongs to.")]
        public SFXCategory Category;

        [Tooltip("Base volume for this SFX (0-1)."), Range(0f, 1f)]
        public float Volume = 1f;

        [Tooltip("Base pitch for this SFX."), Range(0.1f, 3f)]
        public float Pitch = 1f;

        [Tooltip("Random pitch variation (+/- this value)."), Range(0f, 1f)]
        public float PitchRandomness = 0f;

        [Tooltip("Whether this SFX uses spatial (3D) audio.")]
        public bool IsSpatial = true;

        [Tooltip("Minimum distance for spatial audio falloff.")]
        public float MinDistance = 1f;

        [Tooltip("Maximum distance for spatial audio falloff.")]
        public float MaxDistance = 20f;

        [Tooltip("Rolloff mode for spatial audio.")]
        public AudioRolloffMode RolloffMode = AudioRolloffMode.Linear;

        [Tooltip("Whether this SFX should loop.")]
        public bool Loop = false;

        [Tooltip("Audio priority (0=highest, 256=lowest). Default=128.")]
        [Range(0, 256)]
        public int Priority = 128;

        [Tooltip("Whether to preload this clip at startup to prevent hitches.")]
        public bool Prewarm = false;
    }

    /// <summary>
    /// ScriptableObject containing data for an SFX category.
    /// </summary>
    [CreateAssetMenu(fileName = "SFXCategory_", menuName = "KawaiiCool/SFX Category")]
    public class SFXCategoryData : ScriptableObject
    {
        [Tooltip("Unique identifier for this category.")]
        public string CategoryId;

        [Tooltip("Human-readable display name.")]
        public string DisplayName;

        [Tooltip("Volume multiplier applied to all SFX in this category.")]
        [Range(0f, 2f)]
        public float VolumeMultiplier = 1f;

        [Tooltip("Whether SFX in this category are spatial by default.")]
        public bool IsSpatial = true;

        [Tooltip("Maximum number of concurrent SFX in this category.")]
        [Range(1, 32)]
        public int MaxConcurrent = 5;

        [Tooltip("List of SFX in this category.")]
        public List<SFXData> SFXList = new();
    }

    /// <summary>
    /// Manages all sound effects for KawaiiCool Island using an object pooling system
    /// to avoid garbage collection from creating/destroying AudioSources. Supports
    /// spatial 2D audio, category-based volume control, and random pitch variation.
    /// </summary>
    public class SFXManager : MonoBehaviour
    {
        #region Singleton
        /// <summary>Static instance of the SFXManager.</summary>
        public static SFXManager Instance { get; private set; }
        #endregion

        #region Inspector Fields
        [Header("Mixer")]
        [Tooltip("The AudioMixer containing the SFX group.")]
        public AudioMixer SFXMixer;

        [Tooltip("Name of the SFX group in the AudioMixer.")]
        public string SFXGroupName = "SFX";

        [Header("Pool Settings")]
        [Tooltip("Number of AudioSource objects to pre-allocate in the pool.")]
        [Range(5, 100)]
        public int PoolSize = 20;

        [Tooltip("Prefab with an AudioSource component for pooled instances.")]
        public GameObject AudioSourcePrefab;

        [Tooltip("Transform to hold pooled objects in the hierarchy.")]
        public Transform PoolContainer;

        [Header("Categories")]
        [Tooltip("List of SFX category definitions.")]
        public List<SFXCategoryData> Categories = new();

        [Header("Spatial Settings")]
        [Tooltip("Default maximum hearing distance for spatial SFX.")]
        public float DefaultMaxDistance = 20f;

        [Tooltip("Volume rolloff curve for spatial audio (X=distance/max, Y=volume).")]
        public AnimationCurve SpatialRolloff = AnimationCurve.Linear(0, 1, 1, 0);
        #endregion

        #region Private State
        private readonly Queue<AudioSource> _sfxPool = new();
        private readonly List<AudioSource> _activeSFX = new();
        private readonly Dictionary<string, SFXData> _sfxDatabase = new();
        private readonly Dictionary<string, SFXCategoryData> _categories = new();
        private readonly Dictionary<string, List<AudioSource>> _categoryActiveSources = new();
        private readonly Dictionary<string, Coroutine> _activeFadeCoroutines = new();
        private float _masterVolume = 1f;
        private bool _initialized;
        private int _poolMisses;
        private int _totalRequests;
        #endregion

        #region Events
        /// <summary>Invoked when any SFX is played. Parameter is the SFX ID.</summary>
        public event Action<string> OnSFXPlayed;

        /// <summary>Invoked when all SFX are stopped.</summary>
        public event Action OnAllSFXStopped;
        #endregion

        #region Unity Lifecycle
        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Debug.LogWarning("[SFXManager] Duplicate instance found. Destroying.");
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
            // Clean up finished non-looping sources
            CleanupFinishedSources();
        }

        private void OnDestroy()
        {
            StopAllCoroutines();
            if (Instance == this)
                Instance = null;
        }
        #endregion

        #region Initialization
        /// <summary>
        /// Initializes the SFX manager, creates the audio source pool,
        /// and registers all SFX from category definitions.
        /// </summary>
        public void Initialize()
        {
            if (_initialized) return;

            // Create pool container if not assigned
            if (PoolContainer == null)
            {
                GameObject container = new("SFXPoolContainer");
                container.transform.SetParent(transform);
                PoolContainer = container.transform;
            }

            PrewarmPool();
            RegisterAllCategories();

            _initialized = true;
            Debug.Log($"[SFXManager] Initialized. Pool size: {PoolSize}, SFX registered: {_sfxDatabase.Count}");
        }

        /// <summary>
        /// Creates and pre-allocates the AudioSource pool to avoid runtime allocation.
        /// </summary>
        public void PrewarmPool()
        {
            // Clear existing pool
            while (_sfxPool.Count > 0)
            {
                var source = _sfxPool.Dequeue();
                if (source != null) Destroy(source.gameObject);
            }

            for (int i = 0; i < PoolSize; i++)
            {
                CreatePooledSource();
            }
        }

        /// <summary>
        /// Creates a single pooled AudioSource object.
        /// </summary>
        private void CreatePooledSource()
        {
            GameObject go;
            if (AudioSourcePrefab != null)
            {
                go = Instantiate(AudioSourcePrefab, PoolContainer);
            }
            else
            {
                go = new GameObject("PooledAudioSource");
                go.transform.SetParent(PoolContainer);
                go.AddComponent<AudioSource>();
            }

            go.SetActive(false);
            AudioSource source = go.GetComponent<AudioSource>();
            if (source != null)
            {
                _sfxPool.Enqueue(source);
            }
        }

        /// <summary>
        /// Registers all SFX from the category definitions into the database.
        /// </summary>
        private void RegisterAllCategories()
        {
            foreach (var category in Categories)
            {
                if (category == null) continue;

                _categories[category.CategoryId] = category;
                _categoryActiveSources[category.CategoryId] = new List<AudioSource>();

                foreach (var sfx in category.SFXList)
                {
                    if (sfx != null && !string.IsNullOrEmpty(sfx.SFXId))
                    {
                        _sfxDatabase[sfx.SFXId] = sfx;

                        // Preload clips marked for prewarming
                        if (sfx.Prewarm && sfx.Clip != null)
                        {
                            _ = sfx.Clip.loadState;
                        }
                    }
                }
            }
        }
        #endregion

        #region SFX Playback
        /// <summary>
        /// Plays a sound effect by its registered ID.
        /// </summary>
        /// <param name="sfxId">The unique identifier of the SFX to play.</param>
        /// <param name="position">World position for spatial audio. Null for non-spatial.</param>
        /// <param name="volume">Optional volume override (0-1).</param>
        /// <param name="pitch">Optional pitch override.</param>
        public void PlaySFX(string sfxId, Vector3? position = null, float? volume = null, float? pitch = null)
        {
            _totalRequests++;

            if (string.IsNullOrEmpty(sfxId))
            {
                Debug.LogWarning("[SFXManager] Cannot play SFX with null or empty ID.");
                return;
            }

            if (!_sfxDatabase.TryGetValue(sfxId, out SFXData data))
            {
                Debug.LogWarning($"[SFXManager] SFX not found in database: {sfxId}");
                return;
            }

            // Check category concurrency limits
            string categoryId = GetCategoryIdForSFX(data);
            if (!string.IsNullOrEmpty(categoryId) && _categoryActiveSources.TryGetValue(categoryId, out var activeList))
            {
                if (_categories.TryGetValue(categoryId, out var catData) && activeList.Count >= catData.MaxConcurrent)
                {
                    // Stop the oldest source in this category
                    if (activeList.Count > 0)
                    {
                        FadeOutAndReturnSource(activeList[0], 0.1f);
                        activeList.RemoveAt(0);
                    }
                }
            }

            AudioSource source = GetPooledSource();
            if (source == null)
            {
                Debug.LogWarning("[SFXManager] AudioSource pool exhausted. Consider increasing PoolSize.");
                return;
            }

            PlayOnSource(source, data, position, volume, pitch);

            if (!string.IsNullOrEmpty(categoryId) && activeList != null)
            {
                activeList.Add(source);
            }

            _activeSFX.Add(source);
            OnSFXPlayed?.Invoke(sfxId);
        }

        /// <summary>
        /// Plays a random SFX from a specified category.
        /// </summary>
        /// <param name="categoryId">The category to pick from.</param>
        /// <param name="position">World position for spatial audio.</param>
        public void PlaySFXRandom(string categoryId, Vector3? position = null)
        {
            if (!_categories.TryGetValue(categoryId, out SFXCategoryData category))
            {
                Debug.LogWarning($"[SFXManager] Category not found: {categoryId}");
                return;
            }

            if (category.SFXList == null || category.SFXList.Count == 0)
            {
                Debug.LogWarning($"[SFXManager] Category '{categoryId}' has no SFX.");
                return;
            }

            int randomIndex = UnityEngine.Random.Range(0, category.SFXList.Count);
            SFXData selectedSFX = category.SFXList[randomIndex];

            if (selectedSFX != null)
            {
                PlaySFX(selectedSFX.SFXId, position);
            }
        }

        /// <summary>
        /// Plays a UI sound effect (non-spatial, at center position).
        /// </summary>
        /// <param name="sfxId">The SFX identifier to play.</param>
        public void PlayUISFX(string sfxId)
        {
            PlaySFX(sfxId, null, null, null);
        }

        /// <summary>
        /// Plays a footstep sound based on the surface type.
        /// </summary>
        /// <param name="surfaceType">The type of surface (e.g., "grass", "wood", "stone").</param>
        /// <param name="position">World position of the footstep.</param>
        public void PlayFootstep(string surfaceType, Vector3 position)
        {
            string footstepId = $"footstep_{surfaceType.ToLowerInvariant()}";
            if (_sfxDatabase.ContainsKey(footstepId))
            {
                PlaySFX(footstepId, position);
            }
            else
            {
                // Fallback to generic footstep
                if (_sfxDatabase.ContainsKey("footstep_default"))
                {
                    PlaySFX("footstep_default", position);
                }
            }
        }

        /// <summary>
        /// Plays a voice line at the specified position.
        /// </summary>
        /// <param name="voiceLineId">The voice line identifier.</param>
        /// <param name="position">World position. Null for non-spatial playback.</param>
        public void PlayVoiceLine(string voiceLineId, Vector3? position = null)
        {
            PlaySFX(voiceLineId, position);
        }
        #endregion

        #region SFX Stopping
        /// <summary>
        /// Stops all playing instances of a specific SFX by ID.
        /// </summary>
        /// <param name="sfxId">The SFX identifier to stop.</param>
        public void StopSFX(string sfxId)
        {
            List<AudioSource> toRemove = new();
            foreach (var source in _activeSFX)
            {
                if (source == null)
                {
                    toRemove.Add(source);
                    continue;
                }

                if (source.isPlaying && source.clip != null &&
                    _sfxDatabase.TryGetValue(sfxId, out SFXData data) &&
                    source.clip == data.Clip)
                {
                    source.Stop();
                    toRemove.Add(source);
                    ReturnSourceToPool(source);
                }
            }

            foreach (var source in toRemove)
            {
                _activeSFX.Remove(source);
            }
        }

        /// <summary>
        /// Stops all currently playing SFX with a brief fade out.
        /// </summary>
        public void StopAllSFX()
        {
            foreach (var source in _activeSFX)
            {
                if (source != null)
                {
                    StartCoroutine(FadeOutAndReturn(source, 0.2f));
                }
            }

            _activeSFX.Clear();
            foreach (var key in _categoryActiveSources.Keys)
            {
                _categoryActiveSources[key].Clear();
            }

            OnAllSFXStopped?.Invoke();
        }

        /// <summary>
        /// Stops all SFX in a specific category.
        /// </summary>
        /// <param name="categoryId">The category to stop.</param>
        public void StopCategory(string categoryId)
        {
            if (!_categoryActiveSources.TryGetValue(categoryId, out var activeList)) return;

            foreach (var source in activeList)
            {
                if (source != null)
                {
                    StartCoroutine(FadeOutAndReturn(source, 0.3f));
                }
                _activeSFX.Remove(source);
            }

            activeList.Clear();
        }
        #endregion

        #region Volume Control
        /// <summary>
        /// Sets the master SFX volume on the AudioMixer.
        /// </summary>
        /// <param name="volume">Volume from 0 to 1.</param>
        public void SetSFXVolume(float volume)
        {
            _masterVolume = Mathf.Clamp01(volume);
            float db = VolumeToDecibel(_masterVolume);
            SFXMixer?.SetFloat("SFXVolume", db);
        }

        /// <summary>
        /// Sets the volume multiplier for a specific category.
        /// </summary>
        /// <param name="categoryId">The category to adjust.</param>
        /// <param name="volume">Volume multiplier from 0 to 2.</param>
        public void SetCategoryVolume(string categoryId, float volume)
        {
            if (_categories.TryGetValue(categoryId, out SFXCategoryData category))
            {
                category.VolumeMultiplier = Mathf.Clamp(volume, 0f, 2f);
            }
        }
        #endregion

        #region Registration
        /// <summary>
        /// Registers a new SFX data entry at runtime.
        /// </summary>
        /// <param name="data">The SFX data to register.</param>
        public void RegisterSFX(SFXData data)
        {
            if (data == null || string.IsNullOrEmpty(data.SFXId))
            {
                Debug.LogWarning("[SFXManager] Cannot register null or invalid SFX data.");
                return;
            }

            _sfxDatabase[data.SFXId] = data;
        }

        /// <summary>
        /// Gets the SFX data for a given ID if it exists.
        /// </summary>
        public bool TryGetSFXData(string sfxId, out SFXData data)
        {
            return _sfxDatabase.TryGetValue(sfxId, out data);
        }
        #endregion

        #region Pool Management
        /// <summary>
        /// Gets an available AudioSource from the pool, expanding if necessary.
        /// </summary>
        /// <returns>An available AudioSource, or null if pool is exhausted.</returns>
        private AudioSource GetPooledSource()
        {
            // Find an inactive source in the pool
            int initialCount = _sfxPool.Count;
            for (int i = 0; i < initialCount; i++)
            {
                AudioSource source = _sfxPool.Dequeue();
                if (source != null && !source.isPlaying && !source.gameObject.activeInHierarchy)
                {
                    source.gameObject.SetActive(true);
                    return source;
                }
                // Re-enqueue if it's still in use
                _sfxPool.Enqueue(source);
            }

            // Pool exhausted - create a new one if we're below max
            _poolMisses++;
            if (_activeSFX.Count < PoolSize * 2)
            {
                CreatePooledSource();
                if (_sfxPool.Count > 0)
                {
                    AudioSource newSource = _sfxPool.Dequeue();
                    newSource.gameObject.SetActive(true);
                    return newSource;
                }
            }

            // Steal the oldest active source as last resort
            if (_activeSFX.Count > 0)
            {
                AudioSource oldest = _activeSFX[0];
                _activeSFX.RemoveAt(0);
                oldest.Stop();
                oldest.gameObject.SetActive(true);
                return oldest;
            }

            return null;
        }

        /// <summary>
        /// Returns an AudioSource to the pool for reuse.
        /// </summary>
        /// <param name="source">The AudioSource to return.</param>
        private void ReturnSourceToPool(AudioSource source)
        {
            if (source == null) return;

            source.Stop();
            source.clip = null;
            source.loop = false;
            source.volume = 1f;
            source.pitch = 1f;
            source.spatialBlend = 0f;
            source.gameObject.SetActive(false);
            source.transform.SetParent(PoolContainer);

            _sfxPool.Enqueue(source);
            _activeSFX.Remove(source);

            // Remove from category tracking
            foreach (var kvp in _categoryActiveSources)
            {
                kvp.Value.Remove(source);
            }
        }
        #endregion

        #region Source Configuration
        /// <summary>
        /// Configures and plays an AudioSource with the given SFX data.
        /// </summary>
        private void PlayOnSource(AudioSource source, SFXData data, Vector3? position, float? volume, float? pitch)
        {
            if (source == null || data?.Clip == null) return;

            // Configure spatial settings
            bool useSpatial = data.IsSpatial && position.HasValue;
            source.spatialBlend = useSpatial ? 1f : 0f;

            if (useSpatial)
            {
                source.transform.position = position.Value;
                source.minDistance = data.MinDistance;
                source.maxDistance = data.MaxDistance;
                source.rolloffMode = data.RolloffMode;
            }
            else
            {
                source.transform.position = Camera.main?.transform.position ?? Vector3.zero;
            }

            // Apply volume with category multiplier
            float categoryMult = 1f;
            string catId = GetCategoryIdForSFX(data);
            if (!string.IsNullOrEmpty(catId) && _categories.TryGetValue(catId, out var catData))
            {
                categoryMult = catData.VolumeMultiplier;
            }

            source.volume = (volume ?? data.Volume) * categoryMult * _masterVolume;

            // Apply pitch with optional randomness
            float basePitch = pitch ?? data.Pitch;
            if (data.PitchRandomness > 0)
            {
                basePitch += UnityEngine.Random.Range(-data.PitchRandomness, data.PitchRandomness);
            }
            source.pitch = Mathf.Clamp(basePitch, 0.1f, 3f);

            source.clip = data.Clip;
            source.loop = data.Loop;
            source.priority = data.Priority;

            // Route to mixer group if available
            if (SFXMixer != null)
            {
                var groups = SFXMixer.FindMatchingGroups(string.IsNullOrEmpty(SFXGroupName) ? "SFX" : SFXGroupName);
                if (groups.Length > 0)
                {
                    source.outputAudioMixerGroup = groups[0];
                }
            }

            source.Play();

            // Auto-return to pool after playback if not looping
            if (!data.Loop)
            {
                float delay = data.Clip.length / Mathf.Abs(source.pitch) + 0.1f;
                StartCoroutine(ReturnAfterPlayback(source, delay));
            }
        }

        /// <summary>
        /// Coroutine that returns an AudioSource to the pool after playback completes.
        /// </summary>
        private IEnumerator ReturnAfterPlayback(AudioSource source, float delay)
        {
            yield return new WaitForSeconds(delay);

            if (source != null && !source.loop)
            {
                ReturnSourceToPool(source);
            }
        }

        /// <summary>
        /// Coroutine that fades out an AudioSource before returning it to the pool.
        /// </summary>
        private IEnumerator FadeOutAndReturn(AudioSource source, float fadeTime)
        {
            if (source == null) yield break;

            float startVolume = source.volume;
            float elapsed = 0f;

            while (elapsed < fadeTime && source != null)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / fadeTime;
                source.volume = Mathf.Lerp(startVolume, 0f, t);
                yield return null;
            }

            if (source != null)
            {
                ReturnSourceToPool(source);
            }
        }

        /// <summary>
        /// Initiates a fade-out on a source tracked by the active coroutine dictionary.
        /// </summary>
        private void FadeOutAndReturnSource(AudioSource source, float fadeTime)
        {
            if (source == null) return;
            string key = source.GetInstanceID().ToString();
            if (_activeFadeCoroutines.TryGetValue(key, out var existing))
            {
                StopCoroutine(existing);
            }
            _activeFadeCoroutines[key] = StartCoroutine(FadeOutAndReturn(source, fadeTime));
        }
        #endregion

        #region Maintenance
        /// <summary>
        /// Removes finished AudioSources from the active list and returns them to the pool.
        /// </summary>
        private void CleanupFinishedSources()
        {
            for (int i = _activeSFX.Count - 1; i >= 0; i--)
            {
                AudioSource source = _activeSFX[i];
                if (source == null)
                {
                    _activeSFX.RemoveAt(i);
                    continue;
                }

                if (!source.isPlaying && !source.loop && source.gameObject.activeInHierarchy)
                {
                    ReturnSourceToPool(source);
                }
            }
        }
        #endregion

        #region Utility
        /// <summary>
        /// Finds the category ID that contains a given SFX.
        /// </summary>
        private string GetCategoryIdForSFX(SFXData data)
        {
            foreach (var kvp in _categories)
            {
                if (kvp.Value.SFXList.Contains(data))
                    return kvp.Key;
            }
            return null;
        }

        /// <summary>
        /// Converts a linear volume (0-1) to decibels for the AudioMixer.
        /// </summary>
        private float VolumeToDecibel(float volume)
        {
            if (volume <= 0.0001f) return -80f;
            return 20f * Mathf.Log10(volume);
        }

        /// <summary>
        /// Gets pool statistics for debugging.
        /// </summary>
        public string GetPoolStats()
        {
            return $"Pool: {_sfxPool.Count} available, {_activeSFX.Count} active, " +
                   $"Misses: {_poolMisses}, Total Requests: {_totalRequests}";
        }

        /// <summary>
        /// Gets the number of currently active (playing) SFX.
        /// </summary>
        public int ActiveSFXCount => _activeSFX.Count;

        /// <summary>
        /// Gets the number of available pooled AudioSources.
        /// </summary>
        public int AvailablePoolCount => _sfxPool.Count;
        #endregion
    }
}
