using UnityEngine;
using UnityEngine.Audio;
using System.Collections;
using System.Collections.Generic;

namespace KawaiiCoolIsland.Audio
{
    /// <summary>
    /// Provides centralized configuration and utility methods for the main AudioMixer.
    /// Handles volume control for all mixer groups, snapshot transitions, and mute functionality.
    /// Should be attached to a persistent GameObject in the scene.
    /// </summary>
    public class AudioMixerSetup : MonoBehaviour
    {
        #region Inspector Fields
        [Header("Mixer")]
        [Tooltip("The main AudioMixer asset controlling all game audio.")]
        public AudioMixer MainMixer;

        [Header("Exposed Parameters")]
        [Tooltip("Exposed parameter name for master volume in the AudioMixer.")]
        public string MasterVolumeParam = "MasterVolume";

        [Tooltip("Exposed parameter name for music group volume in the AudioMixer.")]
        public string MusicVolumeParam = "MusicVolume";

        [Tooltip("Exposed parameter name for SFX group volume in the AudioMixer.")]
        public string SFXVolumeParam = "SFXVolume";

        [Tooltip("Exposed parameter name for UI group volume in the AudioMixer.")]
        public string UIVolumeParam = "UIVolume";

        [Tooltip("Exposed parameter name for ambient group volume in the AudioMixer.")]
        public string AmbientVolumeParam = "AmbientVolume";

        [Tooltip("Exposed parameter name for voice group volume in the AudioMixer.")]
        public string VoiceVolumeParam = "VoiceVolume";

        [Header("Snapshots")]
        [Tooltip("Default snapshot for normal gameplay.")]
        public AudioMixerSnapshot DefaultSnapshot;

        [Tooltip("Snapshot for fully muted audio.")]
        public AudioMixerSnapshot MutedSnapshot;

        [Tooltip("Snapshot for pause menu (reduced game audio, clear UI audio).")]
        public AudioMixerSnapshot PauseSnapshot;

        [Tooltip("Snapshot focused on minigame audio.")]
        public AudioMixerSnapshot MinigameFocusSnapshot;

        [Header("Transition Defaults")]
        [Tooltip("Default duration for snapshot transitions in seconds.")]
        public float DefaultTransitionTime = 1f;
        #endregion

        #region Private State
        private readonly Dictionary<string, float> _savedVolumes = new();
        private bool _isMuted;
        private Coroutine _snapshotTransitionCoroutine;
        #endregion

        #region Constants
        private const float MinDecibel = -80f;
        #endregion

        #region Unity Lifecycle
        private void Awake()
        {
            if (MainMixer == null)
            {
                Debug.LogError("[AudioMixerSetup] MainMixer is not assigned! Audio controls will not function.");
                return;
            }

            // Save initial volume levels
            SaveCurrentVolumes();
        }

        private void Start()
        {
            // Ensure default snapshot is active
            if (DefaultSnapshot != null)
            {
                DefaultSnapshot.TransitionTo(0.01f);
            }
        }
        #endregion

        #region Volume Control - Public API
        /// <summary>
        /// Sets the master volume on the AudioMixer.
        /// </summary>
        /// <param name="volume">Linear volume from 0 to 1. 0 is silent, 1 is full volume.</param>
        public void SetMasterVolume(float volume)
        {
            SetVolume(MasterVolumeParam, volume);
        }

        /// <summary>
        /// Sets the music group volume on the AudioMixer.
        /// </summary>
        /// <param name="volume">Linear volume from 0 to 1.</param>
        public void SetMusicVolume(float volume)
        {
            SetVolume(MusicVolumeParam, volume);
        }

        /// <summary>
        /// Sets the SFX group volume on the AudioMixer.
        /// </summary>
        /// <param name="volume">Linear volume from 0 to 1.</param>
        public void SetSFXVolume(float volume)
        {
            SetVolume(SFXVolumeParam, volume);
        }

        /// <summary>
        /// Sets the UI group volume on the AudioMixer.
        /// </summary>
        /// <param name="volume">Linear volume from 0 to 1.</param>
        public void SetUIVolume(float volume)
        {
            SetVolume(UIVolumeParam, volume);
        }

        /// <summary>
        /// Sets the ambient group volume on the AudioMixer.
        /// </summary>
        /// <param name="volume">Linear volume from 0 to 1.</param>
        public void SetAmbientVolume(float volume)
        {
            SetVolume(AmbientVolumeParam, volume);
        }

        /// <summary>
        /// Sets the voice group volume on the AudioMixer.
        /// </summary>
        /// <param name="volume">Linear volume from 0 to 1.</param>
        public void SetVoiceVolume(float volume)
        {
            SetVolume(VoiceVolumeParam, volume);
        }
        #endregion

        #region Mute
        /// <summary>
        /// Mutes or unmutes all audio while preserving previous volume levels.
        /// </summary>
        /// <param name="mute">True to mute, false to restore previous volumes.</param>
        public void MuteAll(bool mute)
        {
            if (_isMuted == mute) return;

            _isMuted = mute;

            if (mute)
            {
                // Save current volumes before muting
                SaveCurrentVolumes();

                // Set all to minimum decibel
                MainMixer?.SetFloat(MasterVolumeParam, MinDecibel);
            }
            else
            {
                // Restore saved volumes
                RestoreSavedVolumes();
            }

            Debug.Log($"[AudioMixerSetup] All audio {(mute ? "muted" : "unmuted")}.");
        }

        /// <summary>
        /// Toggles mute on/off.
        /// </summary>
        public void ToggleMute()
        {
            MuteAll(!_isMuted);
        }

        /// <summary>Gets whether audio is currently muted.</summary>
        public bool IsMuted => _isMuted;
        #endregion

        #region Snapshot Transitions
        /// <summary>
        /// Transitions the AudioMixer to a snapshot by its registered name.
        /// </summary>
        /// <param name="snapshotName">Name of the snapshot to transition to.</param>
        /// <param name="duration">Transition duration in seconds.</param>
        public void TransitionToSnapshot(string snapshotName, float duration)
        {
            if (MainMixer == null) return;

            AudioMixerSnapshot[] snapshots = MainMixer.FindSnapshots(snapshotName);
            if (snapshots.Length > 0)
            {
                TransitionToSnapshot(snapshots[0], duration);
            }
            else
            {
                Debug.LogWarning($"[AudioMixerSetup] Snapshot not found: {snapshotName}");
            }
        }

        /// <summary>
        /// Transitions the AudioMixer to a specific snapshot.
        /// </summary>
        /// <param name="snapshot">The target snapshot.</param>
        /// <param name="duration">Transition duration in seconds.</param>
        public void TransitionToSnapshot(AudioMixerSnapshot snapshot, float duration)
        {
            if (snapshot == null)
            {
                Debug.LogWarning("[AudioMixerSetup] Cannot transition to null snapshot.");
                return;
            }

            if (MainMixer == null)
            {
                Debug.LogWarning("[AudioMixerSetup] Cannot transition - MainMixer is null.");
                return;
            }

            if (_snapshotTransitionCoroutine != null)
                StopCoroutine(_snapshotTransitionCoroutine);

            _snapshotTransitionCoroutine = StartCoroutine(SmoothSnapshotTransition(snapshot, duration));
        }

        /// <summary>
        /// Transitions to the default snapshot.
        /// </summary>
        /// <param name="duration">Transition duration in seconds.</param>
        public void TransitionToDefault(float duration = -1)
        {
            float dur = duration < 0 ? DefaultTransitionTime : duration;
            if (DefaultSnapshot != null)
            {
                TransitionToSnapshot(DefaultSnapshot, dur);
            }
        }

        /// <summary>
        /// Transitions to the muted snapshot.
        /// </summary>
        public void TransitionToMute(float duration = -1)
        {
            float dur = duration < 0 ? DefaultTransitionTime : duration;
            if (MutedSnapshot != null)
            {
                TransitionToSnapshot(MutedSnapshot, dur);
            }
        }

        /// <summary>
        /// Transitions to the pause snapshot.
        /// </summary>
        public void TransitionToPause(float duration = -1)
        {
            float dur = duration < 0 ? DefaultTransitionTime : duration;
            if (PauseSnapshot != null)
            {
                TransitionToSnapshot(PauseSnapshot, dur);
            }
        }

        /// <summary>
        /// Transitions to the minigame focus snapshot.
        /// </summary>
        public void TransitionToMinigameFocus(float duration = -1)
        {
            float dur = duration < 0 ? DefaultTransitionTime : duration;
            if (MinigameFocusSnapshot != null)
            {
                TransitionToSnapshot(MinigameFocusSnapshot, dur);
            }
        }
        #endregion

        #region Parameter Queries
        /// <summary>
        /// Gets the current value of an exposed parameter from the AudioMixer.
        /// </summary>
        /// <param name="parameterName">Name of the exposed parameter.</param>
        /// <returns>The parameter value, or 0 if not found.</returns>
        public float GetParameterValue(string parameterName)
        {
            if (MainMixer == null) return 0f;

            if (MainMixer.GetFloat(parameterName, out float value))
            {
                return value;
            }

            Debug.LogWarning($"[AudioMixerSetup] Parameter not found: {parameterName}");
            return 0f;
        }

        /// <summary>
        /// Gets the master volume as a linear value (0-1).
        /// </summary>
        public float GetMasterVolume()
        {
            float db = GetParameterValue(MasterVolumeParam);
            return DecibelToLinear(db);
        }

        /// <summary>
        /// Gets the music volume as a linear value (0-1).
        /// </summary>
        public float GetMusicVolume()
        {
            float db = GetParameterValue(MusicVolumeParam);
            return DecibelToLinear(db);
        }

        /// <summary>
        /// Gets the SFX volume as a linear value (0-1).
        /// </summary>
        public float GetSFXVolume()
        {
            float db = GetParameterValue(SFXVolumeParam);
            return DecibelToLinear(db);
        }

        /// <summary>
        /// Gets the UI volume as a linear value (0-1).
        /// </summary>
        public float GetUIVolume()
        {
            float db = GetParameterValue(UIVolumeParam);
            return DecibelToLinear(db);
        }
        #endregion

        #region Private Methods
        /// <summary>
        /// Sets an AudioMixer float parameter using linear-to-decibel conversion.
        /// </summary>
        private void SetVolume(string parameter, float volume01)
        {
            if (MainMixer == null) return;

            float db = LinearToDecibel(Mathf.Clamp01(volume01));
            MainMixer.SetFloat(parameter, db);
        }

        /// <summary>
        /// Saves all current volume parameter values for later restoration.
        /// </summary>
        private void SaveCurrentVolumes()
        {
            if (MainMixer == null) return;

            string[] parameters = { MasterVolumeParam, MusicVolumeParam, SFXVolumeParam, UIVolumeParam, AmbientVolumeParam, VoiceVolumeParam };

            foreach (string param in parameters)
            {
                if (MainMixer.GetFloat(param, out float value))
                {
                    _savedVolumes[param] = value;
                }
            }
        }

        /// <summary>
        /// Restores all volume parameters to their saved values.
        /// </summary>
        private void RestoreSavedVolumes()
        {
            if (MainMixer == null) return;

            foreach (var kvp in _savedVolumes)
            {
                MainMixer.SetFloat(kvp.Key, kvp.Value);
            }
        }

        /// <summary>
        /// Converts a linear volume (0-1) to decibels for AudioMixer.
        /// </summary>
        private float LinearToDecibel(float linear)
        {
            if (linear <= 0.0001f) return MinDecibel;
            return 20f * Mathf.Log10(linear);
        }

        /// <summary>
        /// Converts decibel value to linear volume (0-1).
        /// </summary>
        private float DecibelToLinear(float dB)
        {
            if (dB <= MinDecibel) return 0f;
            return Mathf.Pow(10f, dB / 20f);
        }

        /// <summary>
        /// Coroutine for smooth snapshot transitions with proper cleanup.
        /// </summary>
        private IEnumerator SmoothSnapshotTransition(AudioMixerSnapshot snapshot, float duration)
        {
            snapshot.TransitionTo(duration);
            yield return new WaitForSeconds(duration);
            _snapshotTransitionCoroutine = null;
        }
        #endregion

        #region Utility
        /// <summary>
        /// Resets all volumes to maximum (1.0).
        /// </summary>
        public void ResetAllVolumes()
        {
            SetMasterVolume(1f);
            SetMusicVolume(1f);
            SetSFXVolume(1f);
            SetUIVolume(1f);
            SetAmbientVolume(1f);
            SetVoiceVolume(1f);
        }

        /// <summary>
        /// Prints current volume levels for all groups to the console.
        /// Useful for debugging.
        /// </summary>
        public void DebugPrintVolumes()
        {
            if (MainMixer == null)
            {
                Debug.Log("[AudioMixerSetup] MainMixer is not assigned.");
                return;
            }

            Debug.Log($"[AudioMixerSetup] Current Volumes:\n" +
                $"  Master: {GetMasterVolume():P0}\n" +
                $"  Music: {GetMusicVolume():P0}\n" +
                $"  SFX: {GetSFXVolume():P0}\n" +
                $"  UI: {GetUIVolume():P0}");
        }
        #endregion

        #region Properties
        /// <summary>Gets whether the AudioMixer reference is valid.</summary>
        public bool IsMixerValid => MainMixer != null;

        /// <summary>Gets the default transition time in seconds.</summary>
        public float TransitionDuration => DefaultTransitionTime;
        #endregion
    }
}
