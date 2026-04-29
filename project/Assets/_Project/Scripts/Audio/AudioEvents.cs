using UnityEngine;

namespace KawaiiCoolIsland.Audio
{
    /// <summary>
    /// Base interface for all game events used by the EventBus system.
    /// Implement this interface on any struct or class that represents a game event.
    /// </summary>
    public interface IGameEvent { }

    /// <summary>
    /// Event dispatched when an SFX should be played.
    /// Consumed by SFXManager to trigger sound playback.
    /// </summary>
    public struct PlaySFXEvent : IGameEvent
    {
        /// <summary>
        /// The unique identifier of the SFX to play (must match a registered SFXData.SFXId).
        /// </summary>
        public string SFXId;

        /// <summary>
        /// World position for spatial audio. Null for UI/non-spatial playback.
        /// For 2D games, this represents the distance from the camera/listener.
        /// </summary>
        public Vector3? Position;

        /// <summary>
        /// Optional volume multiplier override (0-1). Null uses the SFXData default.
        /// </summary>
        public float? Volume;

        /// <summary>
        /// Optional pitch override. Null uses the SFXData default.
        /// </summary>
        public float? Pitch;

        /// <summary>
        /// Creates a new PlaySFXEvent with the specified parameters.
        /// </summary>
        /// <param name="sfxId">The SFX identifier to play.</param>
        /// <param name="position">World position for spatial audio.</param>
        /// <param name="volume">Volume override (0-1).</param>
        /// <param name="pitch">Pitch override.</param>
        public PlaySFXEvent(string sfxId, Vector3? position = null, float? volume = null, float? pitch = null)
        {
            SFXId = sfxId;
            Position = position;
            Volume = volume;
            Pitch = pitch;
        }
    }

    /// <summary>
    /// Event dispatched when the music state should change.
    /// Consumed by DynamicMusicController to transition between music arrangements.
    /// </summary>
    public struct PlayMusicEvent : IGameEvent
    {
        /// <summary>
        /// The target music state to transition to.
        /// </summary>
        public MusicState State;

        /// <summary>
        /// Duration of the transition in seconds. Use -1 for default transition time.
        /// </summary>
        public float TransitionTime;

        /// <summary>
        /// Creates a new PlayMusicEvent with the specified parameters.
        /// </summary>
        /// <param name="state">The target music state.</param>
        /// <param name="transitionTime">Transition duration in seconds. -1 for default.</param>
        public PlayMusicEvent(MusicState state, float transitionTime = -1f)
        {
            State = state;
            TransitionTime = transitionTime;
        }
    }

    /// <summary>
    /// Event dispatched when the SFX master volume changes.
    /// Contains the new volume level after the change.
    /// </summary>
    public struct SFXVolumeChangedEvent : IGameEvent
    {
        /// <summary>
        /// The new SFX volume as a linear value from 0 to 1.
        /// </summary>
        public float NewVolume;

        /// <summary>
        /// Creates a new SFXVolumeChangedEvent.
        /// </summary>
        /// <param name="newVolume">The new SFX volume (0-1).</param>
        public SFXVolumeChangedEvent(float newVolume)
        {
            NewVolume = Mathf.Clamp01(newVolume);
        }
    }

    /// <summary>
    /// Event dispatched when the music master volume changes.
    /// Contains the new volume level after the change.
    /// </summary>
    public struct MusicVolumeChangedEvent : IGameEvent
    {
        /// <summary>
        /// The new music volume as a linear value from 0 to 1.
        /// </summary>
        public float NewVolume;

        /// <summary>
        /// Creates a new MusicVolumeChangedEvent.
        /// </summary>
        /// <param name="newVolume">The new music volume (0-1).</param>
        public MusicVolumeChangedEvent(float newVolume)
        {
            NewVolume = Mathf.Clamp01(newVolume);
        }
    }

    /// <summary>
    /// Event dispatched when the ambient audio volume changes.
    /// Contains the new volume level for ambient/background audio.
    /// </summary>
    public struct AmbientVolumeChangedEvent : IGameEvent
    {
        /// <summary>
        /// The new ambient volume as a linear value from 0 to 1.
        /// </summary>
        public float NewVolume;

        /// <summary>
        /// Creates a new AmbientVolumeChangedEvent.
        /// </summary>
        /// <param name="newVolume">The new ambient volume (0-1).</param>
        public AmbientVolumeChangedEvent(float newVolume)
        {
            NewVolume = Mathf.Clamp01(newVolume);
        }
    }

    /// <summary>
    /// Event dispatched when the UI audio volume changes.
    /// Contains the new volume level for UI sound effects.
    /// </summary>
    public struct UIVolumeChangedEvent : IGameEvent
    {
        /// <summary>
        /// The new UI volume as a linear value from 0 to 1.
        /// </summary>
        public float NewVolume;

        /// <summary>
        /// Creates a new UIVolumeChangedEvent.
        /// </summary>
        /// <param name="newVolume">The new UI volume (0-1).</param>
        public UIVolumeChangedEvent(float newVolume)
        {
            NewVolume = Mathf.Clamp01(newVolume);
        }
    }

    /// <summary>
    /// Event dispatched when voice chat state changes (enabled/disabled or mode change).
    /// Contains the new enabled state and voice mode.
    /// </summary>
    public struct VoiceChatStateChangedEvent : IGameEvent
    {
        /// <summary>
        /// Whether voice chat is now enabled.
        /// </summary>
        public bool IsEnabled;

        /// <summary>
        /// The current voice mode (PushToTalk, VoiceActivation, etc.).
        /// </summary>
        public VoiceMode Mode;

        /// <summary>
        /// Creates a new VoiceChatStateChangedEvent.
        /// </summary>
        /// <param name="isEnabled">Whether voice chat is enabled.</param>
        /// <param name="mode">The current voice mode.</param>
        public VoiceChatStateChangedEvent(bool isEnabled, VoiceMode mode)
        {
            IsEnabled = isEnabled;
            Mode = mode;
        }
    }

    /// <summary>
    /// Event dispatched when a player starts or stops speaking in voice chat.
    /// Contains the player ID and speaking state.
    /// </summary>
    public struct VoiceChatSpeakingEvent : IGameEvent
    {
        /// <summary>
        /// The unique identifier of the player.
        /// </summary>
        public string PlayerId;

        /// <summary>
        /// Whether the player is currently speaking.
        /// </summary>
        public bool IsSpeaking;

        /// <summary>
        /// The detected voice volume/amplitude (0-1).
        /// </summary>
        public float VoiceVolume;

        /// <summary>
        /// Creates a new VoiceChatSpeakingEvent.
        /// </summary>
        /// <param name="playerId">The player identifier.</param>
        /// <param name="isSpeaking">Whether the player is speaking.</param>
        /// <param name="voiceVolume">The voice volume level (0-1).</param>
        public VoiceChatSpeakingEvent(string playerId, bool isSpeaking, float voiceVolume = 0f)
        {
            PlayerId = playerId;
            IsSpeaking = isSpeaking;
            VoiceVolume = voiceVolume;
        }
    }

    /// <summary>
    /// Event dispatched when the music layer volumes should be overridden.
    /// Used for special gameplay moments that need custom music arrangements.
    /// </summary>
    public struct MusicLayerOverrideEvent : IGameEvent
    {
        /// <summary>
        /// Array of 4 volume values for [Base, Melody, Harmony, Accent] layers.
        /// Null or empty array clears the override.
        /// </summary>
        public float[] LayerVolumes;

        /// <summary>
        /// Duration for the layer transition in seconds.
        /// </summary>
        public float FadeDuration;

        /// <summary>
        /// Creates a new MusicLayerOverrideEvent.
        /// </summary>
        /// <param name="layerVolumes">4-element array of layer volumes (0-1). Null to clear.</param>
        /// <param name="fadeDuration">Fade duration in seconds.</param>
        public MusicLayerOverrideEvent(float[] layerVolumes, float fadeDuration = 2f)
        {
            LayerVolumes = layerVolumes;
            FadeDuration = fadeDuration;
        }
    }

    /// <summary>
    /// Event dispatched when the audio snapshot should change.
    /// Consumed by AudioMixerSetup and DynamicMusicController.
    /// </summary>
    public struct AudioSnapshotChangeEvent : IGameEvent
    {
        /// <summary>
        /// Name of the target snapshot in the AudioMixer.
        /// </summary>
        public string SnapshotName;

        /// <summary>
        /// Duration of the snapshot transition in seconds.
        /// </summary>
        public float TransitionDuration;

        /// <summary>
        /// Creates a new AudioSnapshotChangeEvent.
        /// </summary>
        /// <param name="snapshotName">The target snapshot name.</param>
        /// <param name="transitionDuration">Transition duration in seconds.</param>
        public AudioSnapshotChangeEvent(string snapshotName, float transitionDuration = 1f)
        {
            SnapshotName = snapshotName;
            TransitionDuration = transitionDuration;
        }
    }

    /// <summary>
    /// Event dispatched to request an ambient track change.
    /// Consumed by AmbientAudioController.
    /// </summary>
    public struct AmbientChangeEvent : IGameEvent
    {
        /// <summary>
        /// The identifier of the ambient track to play.
        /// </summary>
        public string AmbientId;

        /// <summary>
        /// The new time of day (optional). Use null to not change.
        /// </summary>
        public TimeOfDay? TimeOfDay;

        /// <summary>
        /// Creates a new AmbientChangeEvent.
        /// </summary>
        /// <param name="ambientId">The ambient track identifier.</param>
        /// <param name="timeOfDay">Optional time of day override.</param>
        public AmbientChangeEvent(string ambientId, TimeOfDay? timeOfDay = null)
        {
            AmbientId = ambientId;
            TimeOfDay = timeOfDay;
        }
    }

    /// <summary>
    /// Event dispatched to request a weather audio change.
    /// Consumed by AmbientAudioController.
    /// </summary>
    public struct WeatherChangeEvent : IGameEvent
    {
        /// <summary>
        /// The identifier of the weather audio to play (e.g., "rain", "wind", "clear").
        /// Use null or empty to stop weather audio.
        /// </summary>
        public string WeatherId;

        /// <summary>
        /// Intensity of the weather from 0 to 1.
        /// </summary>
        public float Intensity;

        /// <summary>
        /// Creates a new WeatherChangeEvent.
        /// </summary>
        /// <param name="weatherId">The weather identifier. Null/empty to stop.</param>
        /// <param name="intensity">Weather intensity (0-1).</param>
        public WeatherChangeEvent(string weatherId, float intensity = 0.5f)
        {
            WeatherId = weatherId;
            Intensity = Mathf.Clamp01(intensity);
        }
    }

    /// <summary>
    /// Event dispatched when the master mute state changes.
    /// </summary>
    public struct MasterMuteChangedEvent : IGameEvent
    {
        /// <summary>
        /// Whether audio is now muted.
        /// </summary>
        public bool IsMuted;

        /// <summary>
        /// Creates a new MasterMuteChangedEvent.
        /// </summary>
        /// <param name="isMuted">Whether all audio is muted.</param>
        public MasterMuteChangedEvent(bool isMuted)
        {
            IsMuted = isMuted;
        }
    }

    /// <summary>
    /// Event dispatched when a footstep should be played.
    /// Simplified wrapper for the most common SFX type.
    /// </summary>
    public struct PlayFootstepEvent : IGameEvent
    {
        /// <summary>
        /// The type of surface being stepped on (e.g., "grass", "wood", "stone").
        /// </summary>
        public string SurfaceType;

        /// <summary>
        /// World position of the footstep.
        /// </summary>
        public Vector3 Position;

        /// <summary>
        /// Optional volume multiplier.
        /// </summary>
        public float Volume;

        /// <summary>
        /// Creates a new PlayFootstepEvent.
        /// </summary>
        /// <param name="surfaceType">The surface type.</param>
        /// <param name="position">World position.</param>
        /// <param name="volume">Volume multiplier.</param>
        public PlayFootstepEvent(string surfaceType, Vector3 position, float volume = 1f)
        {
            SurfaceType = surfaceType;
            Position = position;
            Volume = volume;
        }
    }
}
