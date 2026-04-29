using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.Audio;

namespace KawaiiCoolIsland.Audio
{
    /// <summary>
    /// Defines the voice transmission mode for voice chat.
    /// </summary>
    public enum VoiceMode
    {
        /// <summary>Push-to-talk: hold a key to transmit voice.</summary>
        PushToTalk,
        /// <summary>Voice activation: transmit when speaking volume exceeds threshold.</summary>
        VoiceActivation,
        /// <summary>Always on: continuously transmit voice.</summary>
        AlwaysOn,
        /// <summary>Muted: receive only, do not transmit.</summary>
        Muted
    }

    /// <summary>
    /// Defines the type of voice channel for spatial audio behavior.
    /// </summary>
    public enum ChannelType
    {
        /// <summary>Positional 3D audio - voices come from player positions.</summary>
        Positional,
        /// <summary>Non-positional audio - all voices at equal volume.</summary>
        NonPositional,
        /// <summary>Echo channel for testing your own microphone.</summary>
        Echo
    }

    /// <summary>
    /// Manages voice chat functionality for KawaiiCool Island.
    /// Provides a Vivox-compatible API that can be adapted for Photon Voice or other providers.
    /// Supports proximity-based voice, multiple transmission modes, and visual speaking indicators.
    /// 
    /// This is a stub implementation - integrate with your actual voice provider
    /// (Vivox, Photon Voice, Agora, etc.) by overriding the virtual methods.
    /// </summary>
    public class VoiceChatManager : MonoBehaviour
    {
        #region Singleton
        /// <summary>Static instance of the VoiceChatManager.</summary>
        public static VoiceChatManager Instance { get; private set; }
        #endregion

        #region Inspector Fields
        [Header("Settings")]
        [Tooltip("Whether voice chat is enabled.")]
        public bool EnableVoiceChat = true;

        [Tooltip("Default voice transmission mode.")]
        public VoiceMode DefaultVoiceMode = VoiceMode.PushToTalk;

        [Tooltip("Volume threshold for voice activation mode (0-1).")]
        [Range(0f, 1f)]
        public float VoiceActivationThreshold = 0.01f;

        [Tooltip("Key code for push-to-talk.")]
        public KeyCode PushToTalkKey = KeyCode.V;

        [Header("Proximity")]
        [Tooltip("Whether to use proximity-based voice range.")]
        public bool UseProximity = true;

        [Tooltip("Maximum voice range for proximity chat.")]
        public float VoiceRange = 8f;

        [Tooltip("Multiplier for voice volume falloff with distance.")]
        public AnimationCurve ProximityRolloff = AnimationCurve.EaseInOut(0f, 1f, 1f, 0f);

        [Header("Audio Settings")]
        [Tooltip("The AudioMixer containing the Voice group.")]
        public AudioMixer VoiceMixer;

        [Tooltip("Name of the voice group in the AudioMixer.")]
        public string VoiceGroupName = "Voice";

        [Tooltip("Whether to mute other audio when voice is active (ducking).")]
        public bool EnableAudioDucking = true;

        [Tooltip("Amount to duck music and SFX when voice is active (0-1).")]
        [Range(0f, 1f)]
        public float DuckingAmount = 0.3f;

        [Tooltip("Transition time for audio ducking in seconds.")]
        public float DuckingTransitionTime = 0.5f;

        [Header("Indicators")]
        [Tooltip("Prefab for the speaking indicator UI element.")]
        public GameObject SpeakingIndicatorPrefab;

        [Tooltip("Color when the local player is speaking.")]
        public Color SelfSpeakingColor = Color.green;

        [Tooltip("Color when another player is speaking.")]
        public Color OtherSpeakingColor = Color.cyan;

        [Tooltip("Color when a player is muted.")]
        public Color MutedColor = Color.red;

        [Header("Debug")]
        [Tooltip("Show debug messages in the console.")]
        public bool DebugMode = false;
        #endregion

        #region Private State
        private bool _isInitialized;
        private bool _isSpeaking;
        private VoiceMode _currentMode;
        private bool _isMuted;
        private bool _isDeafened;
        private readonly Dictionary<string, GameObject> _playerIndicators = new();
        private readonly Dictionary<string, float> _playerVoiceVolumes = new();
        private readonly Dictionary<string, bool> _mutedPlayers = new();
        private readonly HashSet<string> _joinedChannels = new();
        private string _localPlayerId;
        private float _currentMicLevel;
        private Coroutine _duckingCoroutine;
        private AudioMixerGroup _voiceMixerGroup;
        #endregion

        #region Events
        /// <summary>Invoked when the local player's speaking state changes.</summary>
        public event Action<bool> OnSelfSpeakingChanged;

        /// <summary>Invoked when any player's speaking state changes. (playerId, isSpeaking)</summary>
        public event Action<string, bool> OnPlayerSpeakingChanged;

        /// <summary>Invoked when a player's voice volume changes. (playerId, volume)</summary>
        public event Action<string, float> OnVoiceVolumeChanged;

        /// <summary>Invoked when the voice mode changes.</summary>
        public event Action<VoiceMode> OnVoiceModeChanged;

        /// <summary>Invoked when successfully connected to voice service.</summary>
        public event Action OnVoiceConnected;

        /// <summary>Invoked when disconnected from voice service.</summary>
        public event Action OnVoiceDisconnected;

        /// <summary>Invoked when a channel is joined. (channelName, channelType)</summary>
        public event Action<string, ChannelType> OnChannelJoined;

        /// <summary>Invoked when a channel is left. (channelName)</summary>
        public event Action<string> OnChannelLeft;
        #endregion

        #region Public Properties
        /// <summary>Gets whether the voice chat system is initialized.</summary>
        public bool IsInitialized => _isInitialized;

        /// <summary>Gets whether the local player is currently speaking.</summary>
        public bool IsSpeaking => _isSpeaking;

        /// <summary>Gets the current voice mode.</summary>
        public VoiceMode CurrentMode => _currentMode;

        /// <summary>Gets the current microphone input level (0-1).</summary>
        public float CurrentMicLevel => _currentMicLevel;

        /// <summary>Gets whether the local player is muted.</summary>
        public bool IsMuted => _isMuted;

        /// <summary>Gets whether the local player is deafened (cannot hear others).</summary>
        public bool IsDeafened => _isDeafened;

        /// <summary>Gets the local player ID.</summary>
        public string LocalPlayerId => _localPlayerId;

        /// <summary>Gets the list of currently joined channel names.</summary>
        public IReadOnlyCollection<string> JoinedChannels => _joinedChannels;
        #endregion

        #region Unity Lifecycle
        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Debug.LogWarning("[VoiceChatManager] Duplicate instance found. Destroying.");
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void Start()
        {
            _currentMode = DefaultVoiceMode;

            if (VoiceMixer != null)
            {
                var groups = VoiceMixer.FindMatchingGroups(VoiceGroupName);
                if (groups.Length > 0)
                {
                    _voiceMixerGroup = groups[0];
                }
            }
        }

        private void Update()
        {
            if (!_isInitialized || !EnableVoiceChat) return;

            switch (_currentMode)
            {
                case VoiceMode.PushToTalk:
                    CheckPushToTalk();
                    break;
                case VoiceMode.VoiceActivation:
                    CheckVoiceActivation();
                    break;
                case VoiceMode.AlwaysOn:
                    if (!_isSpeaking)
                        SetSpeaking(true);
                    break;
                case VoiceMode.Muted:
                    if (_isSpeaking)
                        SetSpeaking(false);
                    break;
            }

            UpdateSpeakingIndicator();
            UpdateProximityVolumes();
        }

        private void OnDestroy()
        {
            if (Instance == this)
            {
                // Clean up indicators
                foreach (var indicator in _playerIndicators.Values)
                {
                    if (indicator != null)
                        Destroy(indicator);
                }
                _playerIndicators.Clear();

                Instance = null;
            }
        }
        #endregion

        #region Initialization
        /// <summary>
        /// Initializes the voice chat system. Override this to connect to your voice provider.
        /// </summary>
        public void Initialize()
        {
            if (_isInitialized) return;

            if (!EnableVoiceChat)
            {
                Debug.Log("[VoiceChatManager] Voice chat is disabled in settings.");
                return;
            }

            // TODO: Replace with actual voice provider initialization
            // Example for Vivox:
            // VivoxService.Instance.Initialize();
            // Example for Photon Voice:
            // PhotonVoiceNetwork.Instance.ConnectUsingSettings();

            OnInitialize();

            _isInitialized = true;
            OnVoiceConnected?.Invoke();

            if (DebugMode)
                Debug.Log("[VoiceChatManager] Voice chat initialized.");
        }

        /// <summary>
        /// Virtual method for provider-specific initialization.
        /// Override in a derived class to implement actual voice provider setup.
        /// </summary>
        protected virtual void OnInitialize()
        {
            // Stub: Override with provider-specific initialization
        }

        /// <summary>
        /// Logs in the local player with the voice service.
        /// </summary>
        /// <param name="playerName">The display name for the local player.</param>
        public void Login(string playerName)
        {
            if (!_isInitialized)
            {
                Debug.LogWarning("[VoiceChatManager] Cannot login - voice chat not initialized.");
                return;
            }

            _localPlayerId = playerName; // TODO: Use actual player ID from auth system

            // TODO: Replace with actual voice provider login
            // Example for Vivox:
            // var account = new Account(playerName);
            // VivoxService.Instance.Login(account);

            OnLogin(playerName);

            if (DebugMode)
                Debug.Log($"[VoiceChatManager] Logged in as: {playerName}");
        }

        /// <summary>
        /// Virtual method for provider-specific login.
        /// </summary>
        protected virtual void OnLogin(string playerName)
        {
            // Stub: Override with provider-specific login
        }
        #endregion

        #region Channel Management
        /// <summary>
        /// Joins a voice channel.
        /// </summary>
        /// <param name="channelName">The name of the channel to join.</param>
        /// <param name="type">The type of channel (positional, non-positional, echo).</param>
        public void JoinChannel(string channelName, ChannelType type)
        {
            if (!_isInitialized)
            {
                Debug.LogWarning("[VoiceChatManager] Cannot join channel - not initialized.");
                return;
            }

            if (_joinedChannels.Contains(channelName))
            {
                Debug.Log($"[VoiceChatManager] Already in channel: {channelName}");
                return;
            }

            // TODO: Replace with actual voice provider channel join
            // Example for Vivox:
            // var channel = new Channel(channelName, type == ChannelType.Positional ? ChannelType.Positional : ChannelType.NonPositional);
            // VivoxService.Instance.ChannelSession.Join(channel);

            OnJoinChannel(channelName, type);

            _joinedChannels.Add(channelName);
            OnChannelJoined?.Invoke(channelName, type);

            if (DebugMode)
                Debug.Log($"[VoiceChatManager] Joined channel: {channelName} ({type})");
        }

        /// <summary>
        /// Virtual method for provider-specific channel join.
        /// </summary>
        protected virtual void OnJoinChannel(string channelName, ChannelType type)
        {
            // Stub: Override with provider-specific channel join
        }

        /// <summary>
        /// Leaves a voice channel.
        /// </summary>
        /// <param name="channelName">The name of the channel to leave.</param>
        public void LeaveChannel(string channelName)
        {
            if (!_joinedChannels.Contains(channelName)) return;

            // TODO: Replace with actual voice provider channel leave

            OnLeaveChannel(channelName);

            _joinedChannels.Remove(channelName);
            OnChannelLeft?.Invoke(channelName);

            if (DebugMode)
                Debug.Log($"[VoiceChatManager] Left channel: {channelName}");
        }

        /// <summary>
        /// Virtual method for provider-specific channel leave.
        /// </summary>
        protected virtual void OnLeaveChannel(string channelName)
        {
            // Stub: Override with provider-specific channel leave
        }
        #endregion

        #region Speaking Control
        /// <summary>
        /// Sets whether the local player is currently speaking.
        /// </summary>
        /// <param name="speaking">True if speaking, false otherwise.</param>
        public void SetSpeaking(bool speaking)
        {
            if (_isSpeaking == speaking) return;

            _isSpeaking = speaking;

            // TODO: Replace with actual voice provider transmit control
            // Example for Vivox:
            // VivoxService.Instance.AudioInputDevices.Muted = !speaking;

            OnSetSpeaking(speaking);

            if (speaking)
            {
                OnSelfSpeakingChanged?.Invoke(true);
                OnPlayerStartedSpeaking(_localPlayerId);
                if (EnableAudioDucking)
                    StartAudioDucking();
            }
            else
            {
                OnSelfSpeakingChanged?.Invoke(false);
                OnPlayerStoppedSpeaking(_localPlayerId);
                if (EnableAudioDucking)
                    StopAudioDucking();
            }

            if (DebugMode)
                Debug.Log($"[VoiceChatManager] Speaking: {speaking}");
        }

        /// <summary>
        /// Virtual method for provider-specific speaking control.
        /// </summary>
        protected virtual void OnSetSpeaking(bool speaking)
        {
            // Stub: Override with provider-specific transmit control
        }

        /// <summary>
        /// Checks push-to-talk key input each frame.
        /// </summary>
        private void CheckPushToTalk()
        {
            if (Input.GetKeyDown(PushToTalkKey))
            {
                SetSpeaking(true);
            }
            else if (Input.GetKeyUp(PushToTalkKey))
            {
                SetSpeaking(false);
            }
        }

        /// <summary>
        /// Checks microphone input level for voice activation mode.
        /// </summary>
        private void CheckVoiceActivation()
        {
            // TODO: Replace with actual mic level detection from voice provider
            float micLevel = GetMicrophoneLevel();
            _currentMicLevel = micLevel;

            bool shouldSpeak = micLevel > VoiceActivationThreshold && !_isMuted;
            SetSpeaking(shouldSpeak);
        }

        /// <summary>
        /// Gets the current microphone input level.
        /// Override with provider-specific microphone level detection.
        /// </summary>
        protected virtual float GetMicrophoneLevel()
        {
            // Stub: Return a simulated mic level
            // Override with actual microphone detection from your voice provider
            return 0f;
        }
        #endregion

        #region Mute / Deafen
        /// <summary>
        /// Sets the local player's mute state.
        /// </summary>
        /// <param name="muted">True to mute, false to unmute.</param>
        public void SetMute(bool muted)
        {
            _isMuted = muted;

            if (muted && _isSpeaking)
            {
                SetSpeaking(false);
            }

            // TODO: Replace with actual voice provider mute control
            // Example for Vivox:
            // VivoxService.Instance.AudioInputDevices.Muted = muted;

            OnSetMute(muted);

            if (DebugMode)
                Debug.Log($"[VoiceChatManager] Muted: {muted}");
        }

        /// <summary>
        /// Virtual method for provider-specific mute control.
        /// </summary>
        protected virtual void OnSetMute(bool muted)
        {
            // Stub: Override with provider-specific mute
        }

        /// <summary>
        /// Sets the local player's deafen state (cannot hear others).
        /// </summary>
        /// <param name="deafened">True to deafen, false to undeafen.</param>
        public void SetDeafen(bool deafened)
        {
            _isDeafened = deafened;

            // TODO: Replace with actual voice provider output mute control
            // Example for Vivox:
            // VivoxService.Instance.AudioOutputDevices.Muted = deafened;

            OnSetDeafen(deafened);

            if (DebugMode)
                Debug.Log($"[VoiceChatManager] Deafened: {deafened}");
        }

        /// <summary>
        /// Virtual method for provider-specific deafen control.
        /// </summary>
        protected virtual void OnSetDeafen(bool deafened)
        {
            // Stub: Override with provider-specific output mute
        }

        /// <summary>
        /// Toggles mute state on/off.
        /// </summary>
        public void ToggleMute()
        {
            SetMute(!_isMuted);
        }
        #endregion

        #region Voice Mode
        /// <summary>
        /// Sets the voice transmission mode.
        /// </summary>
        /// <param name="mode">The voice mode to switch to.</param>
        public void SetVoiceMode(VoiceMode mode)
        {
            if (_currentMode == mode) return;

            VoiceMode previousMode = _currentMode;
            _currentMode = mode;

            // Stop speaking when switching to muted mode
            if (mode == VoiceMode.Muted && _isSpeaking)
            {
                SetSpeaking(false);
            }

            OnSetVoiceMode(mode, previousMode);
            OnVoiceModeChanged?.Invoke(mode);

            if (DebugMode)
                Debug.Log($"[VoiceChatManager] Voice mode changed: {mode}");
        }

        /// <summary>
        /// Virtual method for provider-specific voice mode changes.
        /// </summary>
        protected virtual void OnSetVoiceMode(VoiceMode newMode, VoiceMode previousMode)
        {
            // Stub: Override with provider-specific mode changes
        }
        #endregion

        #region Player Volume / Proximity
        /// <summary>
        /// Sets the volume for a specific remote player.
        /// </summary>
        /// <param name="playerId">The unique identifier of the player.</param>
        /// <param name="volume">Volume level from 0 to 1.</param>
        public void SetPlayerVolume(string playerId, float volume)
        {
            _playerVoiceVolumes[playerId] = Mathf.Clamp01(volume);

            // TODO: Replace with actual per-player volume control
            // Example for Vivox:
            // var participant = GetParticipant(playerId);
            // if (participant != null) participant.SetLocalVolume((int)(volume * 100));

            OnSetPlayerVolume(playerId, volume);
            OnVoiceVolumeChanged?.Invoke(playerId, volume);
        }

        /// <summary>
        /// Virtual method for provider-specific player volume control.
        /// </summary>
        protected virtual void OnSetPlayerVolume(string playerId, float volume)
        {
            // Stub: Override with provider-specific volume control
        }

        /// <summary>
        /// Sets whether proximity-based voice is enabled.
        /// </summary>
        /// <param name="enabled">True to enable proximity voice.</param>
        public void SetProximityEnabled(bool enabled)
        {
            UseProximity = enabled;

            if (!enabled)
            {
                // Reset all player volumes to full
                var playerIds = _playerVoiceVolumes.Keys.ToList();
                foreach (var playerId in playerIds)
                {
                    SetPlayerVolume(playerId, 1f);
                }
            }
        }

        /// <summary>
        /// Sets the maximum voice range for proximity chat.
        /// </summary>
        /// <param name="range">The maximum hearing range in world units.</param>
        public void SetVoiceRange(float range)
        {
            VoiceRange = Mathf.Max(1f, range);
        }

        /// <summary>
        /// Gets a list of players currently within voice range.
        /// </summary>
        /// <returns>List of player IDs within proximity range.</returns>
        public List<string> GetPlayersInVoiceRange()
        {
            List<string> playersInRange = new();

            if (!UseProximity)
            {
                // Return all known players if proximity is disabled
                playersInRange.AddRange(_playerVoiceVolumes.Keys);
                return playersInRange;
            }

            // TODO: Replace with actual player position lookup from your game
            // This should check the distance between the local player and each remote player
            foreach (var playerId in _playerVoiceVolumes.Keys)
            {
                float distance = GetDistanceToPlayer(playerId);
                if (distance <= VoiceRange)
                {
                    playersInRange.Add(playerId);
                }
            }

            return playersInRange;
        }

        /// <summary>
        /// Updates voice volumes based on player proximity each frame.
        /// </summary>
        private void UpdateProximityVolumes()
        {
            if (!UseProximity) return;

            foreach (var playerId in _playerVoiceVolumes.Keys.ToList())
            {
                float distance = GetDistanceToPlayer(playerId);
                float normalizedDistance = Mathf.Clamp01(distance / VoiceRange);
                float volume = ProximityRolloff.Evaluate(normalizedDistance);

                _playerVoiceVolumes[playerId] = volume;

                // Apply to the speaking indicator scale
                if (_playerIndicators.TryGetValue(playerId, out GameObject indicator) && indicator != null)
                {
                    float scale = 0.5f + (volume * 0.5f);
                    indicator.transform.localScale = Vector3.one * scale;
                }
            }
        }

        /// <summary>
        /// Gets the distance from the local player to another player.
        /// Override with your game's actual player position system.
        /// </summary>
        protected virtual float GetDistanceToPlayer(string playerId)
        {
            // Stub: Override with actual distance calculation
            // Example: return Vector3.Distance(localPlayer.transform.position, remotePlayer.transform.position);
            return 0f;
        }
        #endregion

        #region Speaking Indicators
        /// <summary>
        /// Creates or updates the speaking indicator for a player.
        /// </summary>
        private void UpdateSpeakingIndicator()
        {
            // Update local player indicator
            if (_isSpeaking)
            {
                EnsureIndicator(_localPlayerId, SelfSpeakingColor);
            }
            else
            {
                RemoveIndicator(_localPlayerId);
            }
        }

        /// <summary>
        /// Called when any player starts speaking.
        /// </summary>
        /// <param name="playerId">The player who started speaking.</param>
        private void OnPlayerStartedSpeaking(string playerId)
        {
            Color indicatorColor = playerId == _localPlayerId ? SelfSpeakingColor : OtherSpeakingColor;
            EnsureIndicator(playerId, indicatorColor);
            OnPlayerSpeakingChanged?.Invoke(playerId, true);
        }

        /// <summary>
        /// Called when any player stops speaking.
        /// </summary>
        /// <param name="playerId">The player who stopped speaking.</param>
        private void OnPlayerStoppedSpeaking(string playerId)
        {
            RemoveIndicator(playerId);
            OnPlayerSpeakingChanged?.Invoke(playerId, false);
        }

        /// <summary>
        /// Creates a speaking indicator for a player if one doesn't exist.
        /// </summary>
        private void EnsureIndicator(string playerId, Color color)
        {
            if (SpeakingIndicatorPrefab == null) return;

            if (!_playerIndicators.TryGetValue(playerId, out GameObject indicator) || indicator == null)
            {
                indicator = Instantiate(SpeakingIndicatorPrefab);
                _playerIndicators[playerId] = indicator;

                // TODO: Position indicator above the player's head
                // indicator.transform.position = GetPlayerHeadPosition(playerId);
            }

            // Update indicator color
            var renderer = indicator.GetComponent<SpriteRenderer>();
            if (renderer != null)
            {
                renderer.color = color;
            }

            var image = indicator.GetComponent<UnityEngine.UI.Image>();
            if (image != null)
            {
                image.color = color;
            }

            indicator.SetActive(true);
        }

        /// <summary>
        /// Removes a player's speaking indicator.
        /// </summary>
        private void RemoveIndicator(string playerId)
        {
            if (_playerIndicators.TryGetValue(playerId, out GameObject indicator) && indicator != null)
            {
                indicator.SetActive(false);
            }
        }

        /// <summary>
        /// Removes all speaking indicators.
        /// </summary>
        public void ClearAllIndicators()
        {
            foreach (var kvp in _playerIndicators)
            {
                if (kvp.Value != null)
                    Destroy(kvp.Value);
            }
            _playerIndicators.Clear();
        }
        #endregion

        #region Audio Ducking
        /// <summary>
        /// Starts audio ducking - reduces music and SFX volume when voice is active.
        /// </summary>
        private void StartAudioDucking()
        {
            if (_duckingCoroutine != null)
                StopCoroutine(_duckingCoroutine);

            _duckingCoroutine = StartCoroutine(DuckAudio(DuckingAmount));
        }

        /// <summary>
        /// Stops audio ducking - restores music and SFX volume.
        /// </summary>
        private void StopAudioDucking()
        {
            if (_duckingCoroutine != null)
                StopCoroutine(_duckingCoroutine);

            _duckingCoroutine = StartCoroutine(DuckAudio(1f));
        }

        /// <summary>
        /// Coroutine for smooth audio ducking transitions.
        /// </summary>
        private IEnumerator<WaitForEndOfFrame> DuckAudio(float targetMultiplier)
        {
            // TODO: Connect to AudioMixerSetup for actual ducking
            // This is a placeholder - integrate with your AudioMixerSetup

            float elapsed = 0f;
            float startMultiplier = 1f; // TODO: Get current multiplier

            while (elapsed < DuckingTransitionTime)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / DuckingTransitionTime;
                float current = Mathf.Lerp(startMultiplier, targetMultiplier, t);

                // TODO: Apply ducking to Music and SFX mixer groups
                // AudioMixerSetup.Instance.SetMusicVolume(current);
                // AudioMixerSetup.Instance.SetSFXVolume(current);

                yield return new WaitForEndOfFrame();
            }

            _duckingCoroutine = null;
        }
        #endregion

        #region Player Management
        /// <summary>
        /// Registers a remote player for voice chat.
        /// </summary>
        /// <param name="playerId">The unique identifier of the player.</param>
        public void RegisterPlayer(string playerId)
        {
            if (!_playerVoiceVolumes.ContainsKey(playerId))
            {
                _playerVoiceVolumes[playerId] = 1f;
            }

            if (DebugMode)
                Debug.Log($"[VoiceChatManager] Registered player: {playerId}");
        }

        /// <summary>
        /// Unregisters a remote player from voice chat.
        /// </summary>
        /// <param name="playerId">The unique identifier of the player.</param>
        public void UnregisterPlayer(string playerId)
        {
            _playerVoiceVolumes.Remove(playerId);
            _mutedPlayers.Remove(playerId);

            if (_playerIndicators.TryGetValue(playerId, out GameObject indicator) && indicator != null)
            {
                Destroy(indicator);
            }
            _playerIndicators.Remove(playerId);

            if (DebugMode)
                Debug.Log($"[VoiceChatManager] Unregistered player: {playerId}");
        }

        /// <summary>
        /// Mutes a specific remote player.
        /// </summary>
        /// <param name="playerId">The player to mute.</param>
        public void MutePlayer(string playerId)
        {
            _mutedPlayers[playerId] = true;

            if (_playerIndicators.TryGetValue(playerId, out GameObject indicator) && indicator != null)
            {
                var renderer = indicator.GetComponent<SpriteRenderer>();
                if (renderer != null) renderer.color = MutedColor;

                var image = indicator.GetComponent<UnityEngine.UI.Image>();
                if (image != null) image.color = MutedColor;
            }
        }

        /// <summary>
        /// Unmutes a specific remote player.
        /// </summary>
        /// <param name="playerId">The player to unmute.</param>
        public void UnmutePlayer(string playerId)
        {
            _mutedPlayers.Remove(playerId);

            if (_playerIndicators.TryGetValue(playerId, out GameObject indicator) && indicator != null)
            {
                var renderer = indicator.GetComponent<SpriteRenderer>();
                if (renderer != null) renderer.color = OtherSpeakingColor;

                var image = indicator.GetComponent<UnityEngine.UI.Image>();
                if (image != null) image.color = OtherSpeakingColor;
            }
        }

        /// <summary>
        /// Checks if a specific player is muted.
        /// </summary>
        public bool IsPlayerMuted(string playerId)
        {
            return _mutedPlayers.ContainsKey(playerId) && _mutedPlayers[playerId];
        }
        #endregion

        #region Cleanup
        /// <summary>
        /// Disconnects from the voice service and cleans up all resources.
        /// </summary>
        public void Disconnect()
        {
            if (_isSpeaking)
                SetSpeaking(false);

            // Leave all channels
            var channels = _joinedChannels.ToList();
            foreach (var channel in channels)
            {
                LeaveChannel(channel);
            }

            ClearAllIndicators();
            _playerVoiceVolumes.Clear();
            _mutedPlayers.Clear();

            OnDisconnect();

            _isInitialized = false;
            OnVoiceDisconnected?.Invoke();

            if (DebugMode)
                Debug.Log("[VoiceChatManager] Disconnected from voice service.");
        }

        /// <summary>
        /// Virtual method for provider-specific disconnection.
        /// </summary>
        protected virtual void OnDisconnect()
        {
            // Stub: Override with provider-specific disconnect
        }
        #endregion

        #region Debug
        /// <summary>
        /// Gets diagnostic information about the voice chat state.
        /// </summary>
        public string GetDebugInfo()
        {
            return $"Voice Chat Debug:\n" +
                   $"  Initialized: {_isInitialized}\n" +
                   $"  Speaking: {_isSpeaking}\n" +
                   $"  Mode: {_currentMode}\n" +
                   $"  Muted: {_isMuted}\n" +
                   $"  Deafened: {_isDeafened}\n" +
                   $"  Proximity: {UseProximity}\n" +
                   $"  Voice Range: {VoiceRange}\n" +
                   $"  Mic Level: {_currentMicLevel:F4}\n" +
                   $"  Channels: {_joinedChannels.Count}\n" +
                   $"  Players Tracked: {_playerVoiceVolumes.Count}";
        }
        #endregion
    }
}
