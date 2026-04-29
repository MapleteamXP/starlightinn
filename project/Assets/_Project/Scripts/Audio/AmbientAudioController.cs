using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Audio;

namespace KawaiiCoolIsland.Audio
{
    /// <summary>
    /// Represents the time of day for ambient audio selection.
    /// </summary>
    public enum TimeOfDay
    {
        /// <summary>Morning hours (sunrise to midday).</summary>
        Morning,
        /// <summary>Day hours (midday to late afternoon).</summary>
        Day,
        /// <summary>Evening hours (sunset to dusk).</summary>
        Evening,
        /// <summary>Night hours (dusk to sunrise).</summary>
        Night
    }

    /// <summary>
    /// Defines an ambient audio track with scene and time-of-day filtering.
    /// </summary>
    [Serializable]
    public class AmbientTrack
    {
        [Tooltip("Unique identifier for this ambient track.")]
        public string TrackId;

        [Tooltip("Human-readable display name.")]
        public string DisplayName;

        [Tooltip("The ambient audio clip to play.")]
        public AudioClip Clip;

        [Tooltip("Base volume level for this ambient track (0-1)."), Range(0f, 1f)]
        public float BaseVolume = 0.3f;

        [Tooltip("Whether this track should loop continuously.")]
        public bool Loop = true;

        [Tooltip("List of scene names where this track is valid. Leave empty for all scenes.")]
        public List<string> ValidScenes = new();

        [Tooltip("List of times of day when this track should play. Leave empty for all times.")]
        public List<TimeOfDay> ValidTimes = new();
    }

    /// <summary>
    /// Defines weather-specific audio including ambient loops and random sounds.
    /// </summary>
    [Serializable]
    public class WeatherAudio
    {
        [Tooltip("Unique identifier for this weather type (e.g., 'rain', 'wind').")]
        public string WeatherId;

        [Tooltip("Continuous ambient audio for this weather type.")]
        public AudioClip AmbientClip;

        [Tooltip("List of random occasional sounds for this weather.")]
        public List<AudioClip> RandomSounds = new();

        [Tooltip("Minimum interval between random sounds in seconds.")]
        public float RandomSoundIntervalMin = 5f;

        [Tooltip("Maximum interval between random sounds in seconds.")]
        public float RandomSoundIntervalMax = 15f;
    }

    /// <summary>
    /// Controls ambient soundscapes for KawaiiCool Island. Manages crossfading between
    /// different ambient tracks, time-of-day audio transitions, and weather audio overlays.
    /// Uses a dual AudioSource setup for seamless crossfading.
    /// </summary>
    public class AmbientAudioController : MonoBehaviour
    {
        #region Inspector Fields
        [Header("Ambient Tracks")]
        [Tooltip("List of available ambient audio tracks.")]
        public List<AmbientTrack> AmbientTracks = new();

        [Header("Weather")]
        [Tooltip("List of weather audio configurations.")]
        public List<WeatherAudio> WeatherAudio = new();

        [Header("Time of Day")]
        [Tooltip("Ambient clip for morning hours.")]
        public AudioClip MorningAmbient;

        [Tooltip("Ambient clip for daytime hours.")]
        public AudioClip DayAmbient;

        [Tooltip("Ambient clip for evening hours.")]
        public AudioClip EveningAmbient;

        [Tooltip("Ambient clip for nighttime hours.")]
        public AudioClip NightAmbient;

        [Header("Transition")]
        [Tooltip("Duration of crossfade between ambient tracks in seconds.")]
        public float CrossfadeDuration = 5f;

        [Header("Mixer")]
        [Tooltip("The AudioMixer containing the Ambient group.")]
        public AudioMixer AmbientMixer;

        [Tooltip("Name of the ambient group in the AudioMixer.")]
        public string AmbientGroupName = "Ambient";
        #endregion

        #region Private State
        private AudioSource _currentAmbientSource;
        private AudioSource _nextAmbientSource;
        private AmbientTrack _currentTrack;
        private Coroutine _crossfadeCoroutine;
        private Coroutine _weatherRandomCoroutine;
        private TimeOfDay _currentTimeOfDay = TimeOfDay.Day;
        private WeatherAudio _currentWeather;
        private float _ambientVolumeMultiplier = 1f;
        private bool _initialized;
        private readonly Dictionary<string, WeatherAudio> _weatherDatabase = new();
        private readonly Dictionary<string, AmbientTrack> _trackDatabase = new();
        #endregion

        #region Events
        /// <summary>Invoked when the ambient track changes.</summary>
        public event Action<string> OnAmbientChanged;

        /// <summary>Invoked when the time of day ambient changes.</summary>
        public event Action<TimeOfDay> OnTimeOfDayChanged;

        /// <summary>Invoked when weather audio changes.</summary>
        public event Action<string> OnWeatherChanged;
        #endregion

        #region Unity Lifecycle
        private void Awake()
        {
            SetupAudioSources();
            BuildDatabases();
        }

        private void Start()
        {
            // Play day ambient by default
            if (DayAmbient != null)
            {
                PlayAmbientClip(DayAmbient, CrossfadeDuration);
            }
        }

        private void OnDestroy()
        {
            if (_crossfadeCoroutine != null)
                StopCoroutine(_crossfadeCoroutine);
            if (_weatherRandomCoroutine != null)
                StopCoroutine(_weatherRandomCoroutine);
        }
        #endregion

        #region Setup
        /// <summary>
        /// Creates and configures the dual AudioSource components for crossfading.
        /// </summary>
        private void SetupAudioSources()
        {
            // Create or get current ambient source
            _currentAmbientSource = gameObject.AddComponent<AudioSource>();
            ConfigureAmbientSource(_currentAmbientSource);
            _currentAmbientSource.volume = 0f;

            // Create next ambient source for crossfading
            _nextAmbientSource = gameObject.AddComponent<AudioSource>();
            ConfigureAmbientSource(_nextAmbientSource);
            _nextAmbientSource.volume = 0f;
        }

        /// <summary>
        /// Configures an AudioSource for ambient playback.
        /// </summary>
        private void ConfigureAmbientSource(AudioSource source)
        {
            source.playOnAwake = false;
            source.loop = true;
            source.spatialBlend = 0f; // 2D ambient
            source.priority = 200; // Low priority, ambient is background

            if (AmbientMixer != null)
            {
                var groups = AmbientMixer.FindMatchingGroups(AmbientGroupName);
                if (groups.Length > 0)
                {
                    source.outputAudioMixerGroup = groups[0];
                }
            }
        }

        /// <summary>
        /// Builds lookup databases for tracks and weather configurations.
        /// </summary>
        private void BuildDatabases()
        {
            foreach (var track in AmbientTracks)
            {
                if (track != null && !string.IsNullOrEmpty(track.TrackId))
                {
                    _trackDatabase[track.TrackId] = track;
                }
            }

            foreach (var weather in WeatherAudio)
            {
                if (weather != null && !string.IsNullOrEmpty(weather.WeatherId))
                {
                    _weatherDatabase[weather.WeatherId] = weather;
                }
            }

            _initialized = true;
        }
        #endregion

        #region Ambient Playback
        /// <summary>
        /// Plays an ambient track by its unique identifier with crossfade.
        /// </summary>
        /// <param name="ambientId">The track identifier to play.</param>
        public void PlayAmbient(string ambientId)
        {
            if (!_initialized) return;

            AmbientTrack track = GetTrack(ambientId);
            if (track == null)
            {
                Debug.LogWarning($"[AmbientAudioController] Ambient track not found: {ambientId}");
                return;
            }

            if (track.Clip == null)
            {
                Debug.LogWarning($"[AmbientAudioController] Ambient track '{ambientId}' has no clip.");
                return;
            }

            // Check scene validity
            string currentScene = UnityEngine.SceneManagement.SceneManager.GetActiveScene().name;
            if (track.ValidScenes.Count > 0 && !track.ValidScenes.Contains(currentScene))
            {
                Debug.Log($"[AmbientAudioController] Track '{ambientId}' not valid in scene '{currentScene}'.");
                return;
            }

            // Check time validity
            if (track.ValidTimes.Count > 0 && !track.ValidTimes.Contains(_currentTimeOfDay))
            {
                Debug.Log($"[AmbientAudioController] Track '{ambientId}' not valid during {_currentTimeOfDay}.");
                return;
            }

            if (_currentTrack != null && _currentTrack.TrackId == track.TrackId)
                return; // Already playing this track

            _currentTrack = track;
            StartCrossfade(track.Clip, track.BaseVolume * _ambientVolumeMultiplier, CrossfadeDuration);
            OnAmbientChanged?.Invoke(ambientId);

            Debug.Log($"[AmbientAudioController] Playing ambient: {ambientId}");
        }

        /// <summary>
        /// Plays a weather audio configuration by its identifier.
        /// </summary>
        /// <param name="weatherId">The weather identifier to play.</param>
        public void PlayWeather(string weatherId)
        {
            if (!_weatherDatabase.TryGetValue(weatherId, out WeatherAudio weather))
            {
                Debug.LogWarning($"[AmbientAudioController] Weather not found: {weatherId}");
                return;
            }

            _currentWeather = weather;

            // Start random sound coroutine if there are random sounds
            if (weather.RandomSounds != null && weather.RandomSounds.Count > 0)
            {
                if (_weatherRandomCoroutine != null)
                    StopCoroutine(_weatherRandomCoroutine);
                _weatherRandomCoroutine = StartCoroutine(PlayWeatherRandomSounds(weather));
            }

            OnWeatherChanged?.Invoke(weatherId);
        }

        /// <summary>
        /// Stops weather audio and random sound playback.
        /// </summary>
        public void StopWeather()
        {
            _currentWeather = null;
            if (_weatherRandomCoroutine != null)
            {
                StopCoroutine(_weatherRandomCoroutine);
                _weatherRandomCoroutine = null;
            }
        }

        /// <summary>
        /// Sets the time of day and switches to the appropriate ambient clip.
        /// </summary>
        /// <param name="timeOfDay">The new time of day.</param>
        public void SetTimeOfDay(TimeOfDay timeOfDay)
        {
            if (_currentTimeOfDay == timeOfDay) return;

            _currentTimeOfDay = timeOfDay;

            AudioClip timeClip = GetAmbientForTimeOfDay(timeOfDay);
            if (timeClip != null)
            {
                PlayAmbientClip(timeClip, CrossfadeDuration);
            }

            OnTimeOfDayChanged?.Invoke(timeOfDay);
        }

        /// <summary>
        /// Gets the ambient AudioClip for a specific time of day.
        /// </summary>
        private AudioClip GetAmbientForTimeOfDay(TimeOfDay timeOfDay)
        {
            return timeOfDay switch
            {
                TimeOfDay.Morning => MorningAmbient,
                TimeOfDay.Day => DayAmbient,
                TimeOfDay.Evening => EveningAmbient,
                TimeOfDay.Night => NightAmbient,
                _ => DayAmbient
            };
        }

        /// <summary>
        /// Plays an ambient clip directly with crossfade.
        /// </summary>
        private void PlayAmbientClip(AudioClip clip, float duration)
        {
            if (clip == null) return;
            StartCrossfade(clip, 0.3f * _ambientVolumeMultiplier, duration);
        }
        #endregion

        #region Crossfading
        /// <summary>
        /// Initiates a crossfade to a new ambient clip.
        /// </summary>
        private void StartCrossfade(AudioClip newClip, float targetVolume, float duration)
        {
            if (_crossfadeCoroutine != null)
                StopCoroutine(_crossfadeCoroutine);

            _crossfadeCoroutine = StartCoroutine(CrossfadeAmbient(newClip, targetVolume, duration));
        }

        /// <summary>
        /// Coroutine that smoothly crossfades between two ambient tracks.
        /// </summary>
        private IEnumerator CrossfadeAmbient(AudioClip newClip, float targetVolume, float duration)
        {
            // Swap sources - next becomes the fading-in source
            AudioSource fadeOutSource = _currentAmbientSource;
            AudioSource fadeInSource = _nextAmbientSource;

            // Set up the fade-in source
            fadeInSource.clip = newClip;
            fadeInSource.loop = true;
            fadeInSource.volume = 0f;
            fadeInSource.Play();

            // Swap references for next time
            _currentAmbientSource = fadeInSource;
            _nextAmbientSource = fadeOutSource;

            float elapsed = 0f;
            float startVolume = fadeOutSource != null ? fadeOutSource.volume : 0f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / duration;
                float smoothT = Mathf.SmoothStep(0f, 1f, t);

                if (fadeOutSource != null)
                    fadeOutSource.volume = Mathf.Lerp(startVolume, 0f, smoothT);

                fadeInSource.volume = Mathf.Lerp(0f, targetVolume, smoothT);

                yield return null;
            }

            // Ensure final state
            if (fadeOutSource != null)
            {
                fadeOutSource.Stop();
                fadeOutSource.clip = null;
                fadeOutSource.volume = 0f;
            }

            fadeInSource.volume = targetVolume;
        }
        #endregion

        #region Volume Control
        /// <summary>
        /// Fades out the current ambient audio over a duration.
        /// </summary>
        /// <param name="duration">Fade-out duration in seconds.</param>
        public void FadeOutAmbient(float duration)
        {
            if (_crossfadeCoroutine != null)
                StopCoroutine(_crossfadeCoroutine);

            _crossfadeCoroutine = StartCoroutine(FadeOutCoroutine(duration));
        }

        /// <summary>
        /// Coroutine for fading out ambient audio.
        /// </summary>
        private IEnumerator FadeOutCoroutine(float duration)
        {
            float startVolume = _currentAmbientSource != null ? _currentAmbientSource.volume : 0f;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / duration;

                if (_currentAmbientSource != null)
                    _currentAmbientSource.volume = Mathf.Lerp(startVolume, 0f, t);

                if (_nextAmbientSource != null)
                    _nextAmbientSource.volume = Mathf.Lerp(0f, 0f, t);

                yield return null;
            }

            if (_currentAmbientSource != null)
            {
                _currentAmbientSource.Stop();
                _currentAmbientSource.clip = null;
            }
        }

        /// <summary>
        /// Sets the ambient volume multiplier and applies it to the current playback.
        /// </summary>
        /// <param name="volume">Volume multiplier from 0 to 1.</param>
        public void SetAmbientVolume(float volume)
        {
            _ambientVolumeMultiplier = Mathf.Clamp01(volume);

            // Apply to AudioMixer
            if (AmbientMixer != null)
            {
                float db = VolumeToDecibel(_ambientVolumeMultiplier);
                AmbientMixer.SetFloat("AmbientVolume", db);
            }

            // Also update current source
            if (_currentTrack != null && _currentAmbientSource != null)
            {
                float targetVol = _currentTrack.BaseVolume * _ambientVolumeMultiplier;
                _currentAmbientSource.volume = targetVol;
            }
        }
        #endregion

        #region Weather Random Sounds
        /// <summary>
        /// Coroutine that periodically plays random sounds for weather effects.
        /// </summary>
        private IEnumerator PlayWeatherRandomSounds(WeatherAudio weather)
        {
            while (_currentWeather == weather && weather.RandomSounds.Count > 0)
            {
                float waitTime = UnityEngine.Random.Range(weather.RandomSoundIntervalMin, weather.RandomSoundIntervalMax);
                yield return new WaitForSeconds(waitTime);

                if (_currentWeather != weather) yield break;

                // Pick and play a random sound
                int randomIndex = UnityEngine.Random.Range(0, weather.RandomSounds.Count);
                AudioClip randomClip = weather.RandomSounds[randomIndex];

                if (randomClip != null)
                {
                    // Create a one-shot source for the random weather sound
                    GameObject oneShotObj = new($"WeatherSound_{randomClip.name}");
                    oneShotObj.transform.SetParent(transform);
                    AudioSource oneShot = oneShotObj.AddComponent<AudioSource>();
                    oneShot.clip = randomClip;
                    oneShot.spatialBlend = 0f;
                    oneShot.volume = 0.4f * _ambientVolumeMultiplier;
                    oneShot.Play();

                    Destroy(oneShotObj, randomClip.length + 0.1f);
                }
            }
        }
        #endregion

        #region Lookup
        /// <summary>
        /// Gets an ambient track by its ID.
        /// </summary>
        private AmbientTrack GetTrack(string ambientId)
        {
            _trackDatabase.TryGetValue(ambientId, out AmbientTrack track);
            return track;
        }

        /// <summary>
        /// Converts a linear volume (0-1) to decibels for the AudioMixer.
        /// </summary>
        private float VolumeToDecibel(float volume)
        {
            if (volume <= 0.0001f) return -80f;
            return 20f * Mathf.Log10(volume);
        }
        #endregion

        #region Properties
        /// <summary>Gets the currently playing ambient track.</summary>
        public AmbientTrack CurrentTrack => _currentTrack;

        /// <summary>Gets the current time of day setting.</summary>
        public TimeOfDay CurrentTimeOfDay => _currentTimeOfDay;

        /// <summary>Gets whether ambient audio is currently playing.</summary>
        public bool IsPlaying => _currentAmbientSource != null && _currentAmbientSource.isPlaying;

        /// <summary>Gets the current ambient volume multiplier.</summary>
        public float CurrentVolume => _ambientVolumeMultiplier;
        #endregion
    }
}
