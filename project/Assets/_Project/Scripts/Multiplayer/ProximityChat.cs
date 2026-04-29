using System;
using System.Collections.Generic;
using UnityEngine;
using Unity.Netcode;

namespace KawaiiCoolIsland.Multiplayer
{
    /// <summary>
    /// Manages proximity-based text and voice chat for a <see cref="NetworkedPlayer"/>.
    /// Only players within <see cref="ChatRange"/> can see each other's messages;
    /// voice volume attenuates with distance according to <see cref="VolumeByDistance"/>.
    /// Runs locally on every client — no server mediation required for range culling.
    /// </summary>
    [RequireComponent(typeof(NetworkedPlayer))]
    public class ProximityChat : NetworkBehaviour
    {
        // ------------------------------------------------------------------
        // Inspector
        // ------------------------------------------------------------------

        [Header("Range Settings")]
        [Tooltip("Maximum distance (world units) at which text chat is visible.")]
        public float ChatRange = NetworkConstants.CHAT_RANGE_DEFAULT;

        [Tooltip("Maximum distance (world units) at which voice audio is audible.")]
        public float VoiceRange = NetworkConstants.VOICE_RANGE_DEFAULT;

        [Header("Voice Attenuation")]
        [Tooltip("Maps normalized distance (0=at player, 1=at VoiceRange) to volume multiplier.")]
        public AnimationCurve VolumeByDistance = AnimationCurve.Linear(0f, 1f, 1f, 0f);

        [Header("Optimisation")]
        [Tooltip("Seconds between proximity-list rebuilds. Lower = faster updates but more CPU.")]
        public float UpdateInterval = 0.25f;

        // ------------------------------------------------------------------
        // Private state
        // ------------------------------------------------------------------

        /// <summary>Cached reference to the owning player.</summary>
        private NetworkedPlayer _owner;

        /// <summary>Players currently within <see cref="ChatRange"/></summary>
        private readonly List<NetworkedPlayer> _playersInRange = new();

        /// <summary>Timestamp of last proximity-list update.</summary>
        private float _lastUpdateTime;

        /// <summary>Previously-in-range set used to detect enter/exit events.</summary>
        private readonly HashSet<ulong> _previousInRange = new();

        // ------------------------------------------------------------------
        // Properties
        // ------------------------------------------------------------------

        /// <summary>Number of players currently within chat range.</summary>
        public int PlayersInRangeCount => _playersInRange.Count;

        // ------------------------------------------------------------------
        // Lifecycle
        // ------------------------------------------------------------------

        public override void OnNetworkSpawn()
        {
            base.OnNetworkSpawn();
            _owner = GetComponent<NetworkedPlayer>();

            if (_owner == null)
            {
                Debug.LogError(
                    $"[{nameof(ProximityChat)}] Missing {nameof(NetworkedPlayer)} on '{gameObject.name}'.",
                    this);
                enabled = false;
                return;
            }

            // Slight phase offset so every client doesn't update on the same frame
            _lastUpdateTime = Time.time + UnityEngine.Random.Range(0f, UpdateInterval);
        }

        private void Update()
        {
            if (!IsSpawned || _owner == null) return;

            if (Time.time - _lastUpdateTime >= UpdateInterval)
            {
                _lastUpdateTime = Time.time;
                UpdateProximityList();
            }
        }

        // ------------------------------------------------------------------
        // Public API
        // ------------------------------------------------------------------

        /// <summary>
        /// Sends a proximity-limited text chat message.
        /// The message is forwarded to all players within <see cref="ChatRange"/>
        /// via the owner's <see cref="NetworkedPlayer.SendChatMessageServerRpc"/>.
        /// </summary>
        /// <param name="message">Raw text payload. Truncated to <see cref="NetworkConstants.MAX_CHAT_MESSAGE_LENGTH"/>.</param>
        public void SendProximityMessage(string message)
        {
            if (string.IsNullOrWhiteSpace(message)) return;

            // Truncate
            if (message.Length > NetworkConstants.MAX_CHAT_MESSAGE_LENGTH)
            {
                message = message.Substring(0, NetworkConstants.MAX_CHAT_MESSAGE_LENGTH);
            }

            // Owner sends through server so it can be replicated
            if (_owner != null && _owner.IsLocalPlayer)
            {
                // Channel 0 = proximity chat (global chat would use channel 1)
                _owner.SendChatMessageServerRpc(message, 0);
            }
        }

        /// <summary>
        /// Determines whether <paramref name="source"/> is close enough
        /// for this client to hear their chat messages.
        /// </summary>
        /// <param name="source">The player whose message we want to display.</param>
        /// <returns>
        /// <c>true</c> if <paramref name="source"/> is within <see cref="ChatRange"/>
        /// of this player's current position.
        /// </returns>
        public bool CanHearPlayer(NetworkedPlayer source)
        {
            if (source == null || source == _owner) return true; // always hear self
            float distSqr = (source.Position - _owner.Position).sqrMagnitude;
            return distSqr <= ChatRange * ChatRange;
        }

        /// <summary>
        /// Samples the <see cref="VolumeByDistance"/> curve for voice attenuation.
        /// </summary>
        /// <param name="source">Remote player speaking.</param>
        /// <returns>Linear volume multiplier in [0,1]. Returns 0 if beyond VoiceRange.</returns>
        public float GetVoiceVolume(NetworkedPlayer source)
        {
            if (source == null || _owner == null) return 0f;

            float distance = Vector3.Distance(source.Position, _owner.Position);
            if (distance >= VoiceRange) return 0f;

            float t = Mathf.Clamp01(distance / VoiceRange);
            return VolumeByDistance.Evaluate(t);
        }

        /// <summary>
        /// Returns a snapshot of all players currently within <see cref="ChatRange"/>.
        /// </summary>
        /// <returns>A new list copied from the internal cache.</returns>
        public List<NetworkedPlayer> GetPlayersInChatRange()
        {
            return new List<NetworkedPlayer>(_playersInRange);
        }

        // ------------------------------------------------------------------
        // Core
        // ------------------------------------------------------------------

        /// <summary>
        /// Rebuilds the proximity list by querying <see cref="KawaiiNetworkManager"/>
        /// for all connected players and filtering by <see cref="ChatRange"/>.
        /// Fires <see cref="OnPlayerEnteredChatRange"/> and
        /// <see cref="OnPlayerExitedChatRange"/> when membership changes.
        /// </summary>
        private void UpdateProximityList()
        {
            _playersInRange.Clear();

            var allPlayers = KawaiiNetworkManager.Instance?.GetAllPlayers();
            if (allPlayers == null) return;

            Vector3 myPos = _owner.Position;
            float chatRangeSqr = ChatRange * ChatRange;

            var currentInRange = new HashSet<ulong>();

            foreach (var player in allPlayers)
            {
                if (player == null || player == _owner) continue;

                float distSqr = (player.Position - myPos).sqrMagnitude;
                if (distSqr <= chatRangeSqr)
                {
                    _playersInRange.Add(player);
                    currentInRange.Add(player.NetworkObjectId);
                }
            }

            // --- Detect entries ---
            foreach (var id in currentInRange)
            {
                if (!_previousInRange.Contains(id))
                {
                    var player = KawaiiNetworkManager.Instance?.GetPlayer(id);
                    if (player != null)
                    {
                        OnPlayerEnteredChatRange?.Invoke(player);
                        ShowEnterIndicator(player);
                    }
                }
            }

            // --- Detect exits ---
            foreach (var id in _previousInRange)
            {
                if (!currentInRange.Contains(id))
                {
                    var player = KawaiiNetworkManager.Instance?.GetPlayer(id);
                    if (player != null)
                    {
                        OnPlayerExitedChatRange?.Invoke(player);
                        ShowExitIndicator(player);
                    }
                }
            }

            _previousInRange.Clear();
            _previousInRange.UnionWith(currentInRange);
        }

        // ------------------------------------------------------------------
        // Visual feedback (stubbed for integration)
        // ------------------------------------------------------------------

        /// <summary>
        /// Optional visual feedback when a player enters chat range.
        /// Override or extend to integrate with your UI system.
        /// </summary>
        private void ShowEnterIndicator(NetworkedPlayer player)
        {
            Debug.Log($"[{nameof(ProximityChat)}] {player.DisplayName} entered chat range.");
        }

        /// <summary>
        /// Optional visual feedback when a player leaves chat range.
        /// </summary>
        private void ShowExitIndicator(NetworkedPlayer player)
        {
            Debug.Log($"[{nameof(ProximityChat)}] {player.DisplayName} left chat range.");
        }

        // ------------------------------------------------------------------
        // Events
        // ------------------------------------------------------------------

        /// <summary>
        /// Fired when a player moves within <see cref="ChatRange"/>.
        /// Use to show nameplates, chat indicators, or voice icons.
        /// </summary>
        public event Action<NetworkedPlayer> OnPlayerEnteredChatRange;

        /// <summary>
        /// Fired when a player moves outside <see cref="ChatRange"/>.
        /// Use to hide nameplates or fade out voice audio.
        /// </summary>
        public event Action<NetworkedPlayer> OnPlayerExitedChatRange;
    }
}
