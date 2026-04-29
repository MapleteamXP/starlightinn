// ----------------------------------------------------------------------------
// KawaiiCool Island - Social Graph System
// ----------------------------------------------------------------------------
// PresenceManager.cs - Real-time presence tracking for players
// ----------------------------------------------------------------------------
// Tracks online status, location, and activity for the local player and
// subscribed friends. Integrates with the EventBus for decoupled presence
// notifications and auto-updates presence based on game state changes.
// ----------------------------------------------------------------------------

using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using KawaiiCoolIsland.Core;
using KawaiiCoolIsland.Core.Events;

namespace KawaiiCoolIsland.Social
{
    #region Data Models

    /// <summary>
    /// Possible presence statuses for players in the social graph.
    /// </summary>
    public enum PresenceStatus
    {
        /// <summary>Player is offline or not connected.</summary>
        Offline,
        /// <summary>Player is online and active.</summary>
        Online,
        /// <summary>Player is away from the device.</summary>
        Away,
        /// <summary>Player is busy and should not be disturbed.</summary>
        Busy,
        /// <summary>Player is currently in a room.</summary>
        InRoom,
        /// <summary>Player is playing a minigame.</summary>
        InMinigame,
        /// <summary>Player is in the room editor.</summary>
        InEditor
    }

    /// <summary>
    /// Serializable presence information for a player.
    /// </summary>
    [System.Serializable]
    public class PresenceInfo
    {
        /// <summary>The player's unique identifier.</summary>
        public string PlayerId;

        /// <summary>The player's display name.</summary>
        public string DisplayName;

        /// <summary>The current presence status.</summary>
        public PresenceStatus Status;

        /// <summary>Human-readable location description (e.g., "Main Menu", "Candy Cove").</summary>
        public string Location;

        /// <summary>The room or location ID if applicable.</summary>
        public string LocationId;

        /// <summary>Unix timestamp of when the player was last seen online.</summary>
        public long LastSeen;

        /// <summary>True if the player is on a mobile device.</summary>
        public bool IsMobile;
    }

    #endregion

    /// <summary>
    /// Manages real-time presence tracking for the local player and subscribed friends.
    /// Auto-updates presence based on game state transitions and broadcasts changes
    /// via the EventBus and direct events.
    /// </summary>
    public class PresenceManager : Singleton<PresenceManager>
    {
        #region Constants

        /// <summary>
        /// Save key for presence settings.
        /// </summary>
        private const string PRESENCE_SAVE_KEY = "Presence_Settings";

        /// <summary>
        /// Idle timeout in seconds before automatically setting status to Away.
        /// </summary>
        public const float IDLE_TIMEOUT_SECONDS = 300f;

        /// <summary>
        /// How often to broadcast presence updates (seconds).
        /// </summary>
        public const float PRESENCE_BROADCAST_INTERVAL = 30f;

        #endregion

        #region Fields

        /// <summary>
        /// The local player's current presence info.
        /// </summary>
        private PresenceInfo _myPresence;

        /// <summary>
        /// Dictionary of all tracked presence info keyed by player ID.
        /// </summary>
        private readonly Dictionary<string, PresenceInfo> _presenceData = new();

        /// <summary>
        /// Set of player IDs we are subscribed to for presence updates.
        /// </summary>
        private readonly HashSet<string> _subscribedPlayers = new();

        /// <summary>
        /// Timer for idle detection.
        /// </summary>
        private float _idleTimer;

        /// <summary>
        /// Timer for periodic presence broadcasts.
        /// </summary>
        private float _broadcastTimer;

        /// <summary>
        /// Whether the player was idle last frame.
        /// </summary>
        private bool _wasIdle;

        /// <summary>
        /// Lock for thread-safe presence operations.
        /// </summary>
        private readonly object _lock = new();

        #endregion

        #region Events

        /// <summary>
        /// Fired when any player's presence changes.
        /// Parameters: playerId, new presence info.
        /// </summary>
        public event Action<string, PresenceInfo> OnPresenceChanged;

        /// <summary>
        /// Fired when the local player's presence is updated.
        /// </summary>
        public event Action<PresenceInfo> OnMyPresenceChanged;

        #endregion

        #region Unity Lifecycle

        /// <summary>
        /// Called when the singleton awakes. Initializes local presence.
        /// </summary>
        protected override void OnSingletonAwake()
        {
            base.OnSingletonAwake();
            InitializeMyPresence();
        }

        private void Update()
        {
            UpdateIdleDetection();
            UpdateBroadcastTimer();
        }

        #endregion

        #region Presence Management

        /// <summary>
        /// Sets the local player's presence status and location.
        /// </summary>
        /// <param name="status">The new presence status.</param>
        /// <param name="location">Optional location description.</param>
        /// <param name="locationId">Optional location/room ID.</param>
        public void SetMyPresence(PresenceStatus status, string location = "", string locationId = "")
        {
            bool changed = false;

            lock (_lock)
            {
                if (_myPresence == null)
                {
                    InitializeMyPresence();
                }

                if (_myPresence.Status != status)
                {
                    _myPresence.Status = status;
                    changed = true;
                }

                if (_myPresence.Location != location)
                {
                    _myPresence.Location = location;
                    changed = true;
                }

                if (_myPresence.LocationId != locationId)
                {
                    _myPresence.LocationId = locationId;
                    changed = true;
                }

                _myPresence.LastSeen = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            }

            if (changed)
            {
                BroadcastMyPresence();
                OnMyPresenceChanged?.Invoke(_myPresence);
                Debug.Log($"[PresenceManager] My presence: {status} at {location}");
            }
        }

        /// <summary>
        /// Subscribes to presence updates for a list of friend/player IDs.
        /// </summary>
        /// <param name="friendIds">List of player IDs to subscribe to.</param>
        public void SubscribeToFriendPresence(List<string> friendIds)
        {
            if (friendIds == null) return;

            lock (_lock)
            {
                foreach (var id in friendIds)
                {
                    if (!string.IsNullOrEmpty(id))
                    {
                        _subscribedPlayers.Add(id);
                    }
                }
            }

            Debug.Log($"[PresenceManager] Subscribed to {friendIds.Count} players' presence.");
        }

        /// <summary>
        /// Unsubscribes from presence updates for a specific player.
        /// </summary>
        /// <param name="friendId">The player ID to unsubscribe from.</param>
        public void UnsubscribeFromFriendPresence(string friendId)
        {
            if (string.IsNullOrEmpty(friendId)) return;

            lock (_lock)
            {
                _subscribedPlayers.Remove(friendId);
                _presenceData.Remove(friendId);
            }

            Debug.Log($"[PresenceManager] Unsubscribed from {friendId} presence.");
        }

        /// <summary>
        /// Gets the presence info for a specific player.
        /// </summary>
        /// <param name="playerId">The player ID to look up.</param>
        /// <returns>The presence info, or null if not tracked.</returns>
        public PresenceInfo GetPresence(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return null;

            lock (_lock)
            {
                _presenceData.TryGetValue(playerId, out var presence);
                return presence;
            }
        }

        /// <summary>
        /// Gets all tracked presence data.
        /// </summary>
        /// <returns>Dictionary of player IDs to presence info.</returns>
        public Dictionary<string, PresenceInfo> GetAllPresence()
        {
            lock (_lock)
            {
                return new Dictionary<string, PresenceInfo>(_presenceData);
            }
        }

        /// <summary>
        /// Checks if a player is currently online.
        /// </summary>
        /// <param name="playerId">The player ID to check.</param>
        /// <returns>True if the player is online.</returns>
        public bool IsOnline(string playerId)
        {
            var presence = GetPresence(playerId);
            return presence != null && presence.Status != PresenceStatus.Offline;
        }

        /// <summary>
        /// Checks if a player is in the same room as the local player.
        /// </summary>
        /// <param name="playerId">The player ID to check.</param>
        /// <returns>True if in the same room.</returns>
        public bool IsInSameRoom(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return false;

            lock (_lock)
            {
                if (_myPresence == null) return false;
                if (!_presenceData.TryGetValue(playerId, out var other)) return false;

                return !string.IsNullOrEmpty(_myPresence.LocationId)
                    && _myPresence.LocationId == other.LocationId;
            }
        }

        #endregion

        #region Auto-Presence State Handlers

        /// <summary>
        /// Called when the local player enters a room. Updates presence automatically.
        /// </summary>
        /// <param name="roomId">The room ID entered.</param>
        /// <param name="roomName">The display name of the room.</param>
        public void OnEnteredRoom(string roomId, string roomName)
        {
            SetMyPresence(PresenceStatus.InRoom, roomName, roomId);
        }

        /// <summary>
        /// Called when the local player enters a minigame. Updates presence automatically.
        /// </summary>
        /// <param name="minigameId">The minigame identifier.</param>
        public void OnEnteredMinigame(string minigameId)
        {
            SetMyPresence(PresenceStatus.InMinigame, $"Playing: {minigameId}", minigameId);
        }

        /// <summary>
        /// Called when the local player enters the room editor. Updates presence automatically.
        /// </summary>
        public void OnEnteredEditor()
        {
            SetMyPresence(PresenceStatus.InEditor, "Room Editor", "editor");
        }

        /// <summary>
        /// Called when the local player goes idle (no input). Sets status to Away.
        /// </summary>
        public void OnWentIdle()
        {
            if (_myPresence?.Status == PresenceStatus.Online)
            {
                SetMyPresence(PresenceStatus.Away, _myPresence.Location, _myPresence.LocationId);
            }
        }

        /// <summary>
        /// Called when the local player becomes active after being idle.
        /// </summary>
        public void OnBecameActive()
        {
            if (_myPresence?.Status == PresenceStatus.Away)
            {
                SetMyPresence(PresenceStatus.Online, _myPresence.Location, _myPresence.LocationId);
            }
        }

        /// <summary>
        /// Called when the local player returns to the main menu.
        /// </summary>
        public void OnReturnedToMenu()
        {
            SetMyPresence(PresenceStatus.Online, "Main Menu", "main_menu");
        }

        /// <summary>
        /// Called when the local player logs out or disconnects.
        /// </summary>
        public void OnDisconnected()
        {
            SetMyPresence(PresenceStatus.Offline, "", "");
        }

        #endregion

        #region Internal Presence Updates

        /// <summary>
        /// Updates the presence info for a tracked player. Called by backend listeners.
        /// </summary>
        /// <param name="playerId">The player whose presence changed.</param>
        /// <param name="info">The new presence info.</param>
        internal void UpdatePresence(string playerId, PresenceInfo info)
        {
            if (string.IsNullOrEmpty(playerId) || info == null) return;

            PresenceInfo oldInfo = null;
            bool changed = false;

            lock (_lock)
            {
                if (_presenceData.TryGetValue(playerId, out oldInfo))
                {
                    changed = oldInfo.Status != info.Status
                        || oldInfo.Location != info.Location
                        || oldInfo.LocationId != info.LocationId;
                }
                else
                {
                    changed = true;
                }

                _presenceData[playerId] = info;
            }

            if (changed)
            {
                OnPresenceChanged?.Invoke(playerId, info);

                // Notify SocialGraphManager if this is a friend
                if (SocialGraphManager.HasInstance && SocialGraphManager.Instance.IsFriend(playerId))
                {
                    SocialGraphManager.Instance.OnPresenceUpdated(playerId, info);
                }

                EventBus.Instance.Publish(new FriendPresenceChangedEvent
                {
                    FriendId = playerId,
                    FriendName = info.DisplayName,
                    NewStatus = (int)info.Status,
                    NewLocation = info.Location,
                    NewLocationId = info.LocationId
                });
            }
        }

        /// <summary>
        /// Removes a player from the presence tracking.
        /// </summary>
        /// <param name="playerId">The player ID to remove.</param>
        internal void RemovePresence(string playerId)
        {
            lock (_lock)
            {
                _presenceData.Remove(playerId);
                _subscribedPlayers.Remove(playerId);
            }
        }

        #endregion

        #region Idle Detection

        /// <summary>
        /// Detects player idle state based on input activity.
        /// </summary>
        private void UpdateIdleDetection()
        {
            bool hasInput = Input.anyKey || Input.mousePosition != _lastMousePosition;
            _lastMousePosition = Input.mousePosition;

            if (hasInput)
            {
                _idleTimer = 0f;
                if (_wasIdle)
                {
                    _wasIdle = false;
                    OnBecameActive();
                }
            }
            else
            {
                _idleTimer += Time.deltaTime;
                if (_idleTimer >= IDLE_TIMEOUT_SECONDS && !_wasIdle)
                {
                    _wasIdle = true;
                    OnWentIdle();
                }
            }
        }

        /// <summary>
        /// Cached mouse position for idle detection.
        /// </summary>
        private Vector3 _lastMousePosition;

        /// <summary>
        /// Updates the periodic presence broadcast timer.
        /// </summary>
        private void UpdateBroadcastTimer()
        {
            _broadcastTimer += Time.deltaTime;
            if (_broadcastTimer >= PRESENCE_BROADCAST_INTERVAL)
            {
                _broadcastTimer = 0f;
                BroadcastMyPresence();
            }
        }

        #endregion

        #region Broadcasting

        /// <summary>
        /// Broadcasts the local player's presence to the backend and subscribed listeners.
        /// </summary>
        private void BroadcastMyPresence()
        {
            if (_myPresence == null) return;

#if PLAYFAB
            // In a real implementation, this would update PlayFab presence
            // or send via a real-time multiplayer service
#endif

            // Simulate notifying subscribers (in production, this would go through the network layer)
            Debug.Log($"[PresenceManager] Broadcasting presence: {_myPresence.Status} at {_myPresence.Location}");
        }

        #endregion

        #region Initialization

        /// <summary>
        /// Creates the initial presence info for the local player.
        /// </summary>
        private void InitializeMyPresence()
        {
            string localPlayerId = SystemInfo.deviceUniqueIdentifier;
            string displayName = "Player";

            if (PlayerProfileManager.HasInstance && PlayerProfileManager.Instance.MyProfile != null)
            {
                displayName = PlayerProfileManager.Instance.MyProfile.DisplayName;
                localPlayerId = PlayerProfileManager.Instance.MyProfile.PlayerId;
            }

            _myPresence = new PresenceInfo
            {
                PlayerId = localPlayerId,
                DisplayName = displayName,
                Status = PresenceStatus.Online,
                Location = "Main Menu",
                LocationId = "main_menu",
                LastSeen = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                IsMobile = Application.isMobilePlatform
            };

            lock (_lock)
            {
                _presenceData[localPlayerId] = _myPresence;
            }
        }

        #endregion

        #region Utility

        /// <summary>
        /// Gets the local player's current presence info.
        /// </summary>
        public PresenceInfo MyPresence => _myPresence;

        /// <summary>
        /// Gets the number of online friends among subscribed players.
        /// </summary>
        public int OnlineFriendCount
        {
            get
            {
                lock (_lock)
                {
                    return _presenceData.Values.Count(p => p.Status != PresenceStatus.Offline
                        && _subscribedPlayers.Contains(p.PlayerId));
                }
            }
        }

        /// <summary>
        /// Gets a list of all online subscribed players.
        /// </summary>
        public List<PresenceInfo> GetOnlinePlayers()
        {
            lock (_lock)
            {
                return _presenceData.Values
                    .Where(p => p.Status != PresenceStatus.Offline)
                    .ToList();
            }
        }

        /// <summary>
        /// Gets a list of players currently in the same room.
        /// </summary>
        public List<PresenceInfo> GetPlayersInSameRoom()
        {
            lock (_lock)
            {
                if (_myPresence == null || string.IsNullOrEmpty(_myPresence.LocationId))
                    return new List<PresenceInfo>();

                return _presenceData.Values
                    .Where(p => p.PlayerId != _myPresence.PlayerId
                        && p.LocationId == _myPresence.LocationId)
                    .ToList();
            }
        }

        #endregion

        #region Editor

#if UNITY_EDITOR
        /// <summary>
        /// Editor helper to log the current presence state.
        /// </summary>
        [ContextMenu("Log Presence State")]
        private void EditorLogPresence()
        {
            lock (_lock)
            {
                Debug.Log("=== PresenceManager State ===");
                if (_myPresence != null)
                {
                    Debug.Log($"My Presence: [{_myPresence.Status}] {_myPresence.Location} ({_myPresence.LocationId})");
                }
                Debug.Log($"Tracked Players: {_presenceData.Count}");
                foreach (var kvp in _presenceData)
                {
                    Debug.Log($"  [{kvp.Value.Status}] {kvp.Value.DisplayName} @ {kvp.Value.Location}");
                }
                Debug.Log($"Subscribed: {_subscribedPlayers.Count}");
            }
        }
#endif

        #endregion
    }
}
