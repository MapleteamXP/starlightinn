// ----------------------------------------------------------------------------
// KawaiiCool Island - Social Graph System
// ----------------------------------------------------------------------------
// SocialGraphManager.cs - Central hub for all player relationships
// ----------------------------------------------------------------------------
// Manages friends, friend requests, blocks, presence, and relationship
// progression. Integrates with PlayFab backend and local SaveManager.
// Uses the EventBus for decoupled notifications and async/await for backend.
// ----------------------------------------------------------------------------

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using UnityEngine;
using KawaiiCoolIsland.Core;
using KawaiiCoolIsland.Core.Events;
using KawaiiCool.Backend;

#if PLAYFAB
using PlayFab;
using PlayFab.ClientModels;
#endif

namespace KawaiiCoolIsland.Social
{
    #region Data Models

    /// <summary>
    /// Represents a friend in the social graph with presence and relationship data.
    /// </summary>
    [System.Serializable]
    public class FriendInfo
    {
        /// <summary>The unique player identifier of this friend.</summary>
        public string PlayerId;

        /// <summary>The display name of this friend.</summary>
        public string DisplayName;

        /// <summary>The current presence status of this friend.</summary>
        public PresenceStatus Status;

        /// <summary>The current location of this friend if online.</summary>
        public string Location;

        /// <summary>The room ID of this friend if in a room.</summary>
        public string LocationId;

        /// <summary>The current relationship level (1-10).</summary>
        public int RelationshipLevel;

        /// <summary>The current relationship XP toward the next level.</summary>
        public int RelationshipXP;

        /// <summary>Unix timestamp of when this friendship was established.</summary>
        public long BefriendedDate;

        /// <summary>Whether this friend is currently online.</summary>
        public bool IsOnline => Status != PresenceStatus.Offline;
    }

    /// <summary>
    /// Represents an incoming or outgoing friend request.
    /// </summary>
    [System.Serializable]
    public class FriendRequest
    {
        /// <summary>The unique request identifier.</summary>
        public string RequestId;

        /// <summary>The player ID who sent the request.</summary>
        public string SenderId;

        /// <summary>The display name of the sender.</summary>
        public string SenderName;

        /// <summary>The player ID who received the request.</summary>
        public string RecipientId;

        /// <summary>Unix timestamp when the request was created.</summary>
        public long Timestamp;

        /// <summary>True if this is an incoming request, false if outgoing.</summary>
        public bool IsIncoming;
    }

    #endregion

    /// <summary>
    /// Central social hub for KawaiiCool Island. Manages all player relationships,
    /// friend requests, blocks, presence tracking, and relationship progression.
    /// Integrates with PlayFab for backend synchronization and SaveManager for local persistence.
    /// </summary>
    public class SocialGraphManager : Singleton<SocialGraphManager>
    {
        #region Constants

        /// <summary>
        /// Save key for the local friend list.
        /// </summary>
        private const string FRIENDS_SAVE_KEY = "SocialGraph_Friends";

        /// <summary>
        /// Save key for pending friend requests.
        /// </summary>
        private const string REQUESTS_SAVE_KEY = "SocialGraph_Requests";

        /// <summary>
        /// Save key for blocked players list.
        /// </summary>
        private const string BLOCKED_SAVE_KEY = "SocialGraph_Blocked";

        /// <summary>
        /// Save key for relationship data.
        /// </summary>
        private const string RELATIONSHIPS_SAVE_KEY = "SocialGraph_Relationships";

        /// <summary>
        /// Maximum number of friends allowed.
        /// </summary>
        public const int MAX_FRIENDS = 200;

        /// <summary>
        /// Maximum number of pending friend requests allowed.
        /// </summary>
        public const int MAX_PENDING_REQUESTS = 50;

        /// <summary>
        /// Maximum number of blocked players allowed.
        /// </summary>
        public const int MAX_BLOCKED = 100;

        #endregion

        #region Fields

        /// <summary>
        /// The local player's unique identifier.
        /// </summary>
        private string _localPlayerId;

        /// <summary>
        /// All confirmed friendships keyed by player ID.
        /// </summary>
        private readonly Dictionary<string, FriendInfo> _friends = new();

        /// <summary>
        /// Pending friend requests keyed by request ID.
        /// </summary>
        private readonly Dictionary<string, FriendRequest> _pendingRequests = new();

        /// <summary>
        /// Set of blocked player IDs for O(1) lookup.
        /// </summary>
        private readonly HashSet<string> _blockedPlayers = new();

        /// <summary>
        /// Relationship XP data keyed by player ID.
        /// </summary>
        private readonly Dictionary<string, int> _relationshipXP = new();

        /// <summary>
        /// Whether the social graph has been initialized and loaded.
        /// </summary>
        private bool _isInitialized;

        /// <summary>
        /// Lock for thread-safe operations on the friends dictionary.
        /// </summary>
        private readonly object _lock = new();

        #endregion

        #region Events

        /// <summary>
        /// Fired when a new friend request is received.
        /// </summary>
        public event Action<FriendRequest> OnFriendRequestReceived;

        /// <summary>
        /// Fired when a friend request is accepted (by either party).
        /// Parameter is the new friend's player ID.
        /// </summary>
        public event Action<string> OnFriendRequestAccepted;

        /// <summary>
        /// Fired when a friend is removed from the list.
        /// Parameter is the removed friend's player ID.
        /// </summary>
        public event Action<string> OnFriendRemoved;

        /// <summary>
        /// Fired when a friend's presence status changes.
        /// Parameters: playerId, new presence info.
        /// </summary>
        public event Action<string, PresenceInfo> OnFriendPresenceChanged;

        /// <summary>
        /// Fired when a player is blocked.
        /// Parameter is the blocked player's ID.
        /// </summary>
        public event Action<string> OnPlayerBlocked;

        /// <summary>
        /// Fired when a player is unblocked.
        /// Parameter is the unblocked player's ID.
        /// </summary>
        public event Action<string> OnPlayerUnblocked;

        /// <summary>
        /// Fired when the friend list is fully loaded from backend.
        /// </summary>
        public event Action OnFriendsLoaded;

        #endregion

        #region Unity Lifecycle

        /// <summary>
        /// Called when the singleton awakes. Initializes and loads local data.
        /// </summary>
        protected override void OnSingletonAwake()
        {
            base.OnSingletonAwake();
            _localPlayerId = SystemInfo.deviceUniqueIdentifier;
            LoadLocalData();
        }

        #endregion

        #region Friend Management

        /// <summary>
        /// Sends a friend request to the target player.
        /// Checks for existing friendship, blocks, and request limits.
        /// </summary>
        /// <param name="targetPlayerId">The player ID to send a friend request to.</param>
        public async void SendFriendRequest(string targetPlayerId)
        {
            if (string.IsNullOrEmpty(targetPlayerId)) return;
            if (targetPlayerId == _localPlayerId)
            {
                Debug.LogWarning("[SocialGraphManager] Cannot send friend request to yourself.");
                return;
            }

            lock (_lock)
            {
                if (_friends.ContainsKey(targetPlayerId))
                {
                    Debug.LogWarning($"[SocialGraphManager] Already friends with {targetPlayerId}.");
                    return;
                }

                if (_blockedPlayers.Contains(targetPlayerId))
                {
                    Debug.LogWarning($"[SocialGraphManager] Cannot send request to blocked player {targetPlayerId}.");
                    return;
                }

                if (_pendingRequests.Count >= MAX_PENDING_REQUESTS)
                {
                    Debug.LogWarning("[SocialGraphManager] Maximum pending requests reached.");
                    return;
                }
            }

            // Backend integration
#if PLAYFAB
            bool success = await SendPlayFabFriendRequest(targetPlayerId);
            if (!success) return;
#endif

            var request = new FriendRequest
            {
                RequestId = Guid.NewGuid().ToString("N"),
                SenderId = _localPlayerId,
                RecipientId = targetPlayerId,
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                IsIncoming = false
            };

            lock (_lock)
            {
                _pendingRequests[request.RequestId] = request;
            }

            SaveLocalData();
            Debug.Log($"[SocialGraphManager] Friend request sent to {targetPlayerId}.");
        }

        /// <summary>
        /// Accepts a pending friend request by its request ID.
        /// </summary>
        /// <param name="requestId">The unique request ID to accept.</param>
        public async void AcceptFriendRequest(string requestId)
        {
            if (string.IsNullOrEmpty(requestId)) return;

            FriendRequest request;
            lock (_lock)
            {
                if (!_pendingRequests.TryGetValue(requestId, out request))
                {
                    Debug.LogWarning($"[SocialGraphManager] Request {requestId} not found.");
                    return;
                }

                if (!request.IsIncoming)
                {
                    Debug.LogWarning("[SocialGraphManager] Cannot accept your own outgoing request.");
                    return;
                }

                if (_friends.Count >= MAX_FRIENDS)
                {
                    Debug.LogWarning("[SocialGraphManager] Maximum friends reached.");
                    return;
                }
            }

#if PLAYFAB
            bool success = await AcceptPlayFabFriendRequest(request.SenderId);
            if (!success) return;
#endif

            var friendInfo = new FriendInfo
            {
                PlayerId = request.SenderId,
                DisplayName = request.SenderName,
                Status = PresenceStatus.Offline,
                RelationshipLevel = 1,
                RelationshipXP = 0,
                BefriendedDate = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
            };

            lock (_lock)
            {
                _friends[request.SenderId] = friendInfo;
                _pendingRequests.Remove(requestId);
            }

            SaveLocalData();
            OnFriendRequestAccepted?.Invoke(request.SenderId);
            EventBus.Instance.Publish(new FriendRequestAcceptedEvent
            {
                PlayerId = request.SenderId,
                PlayerName = request.SenderName
            });

            Debug.Log($"[SocialGraphManager] Friend request accepted: {request.SenderId}");
        }

        /// <summary>
        /// Declines and removes a pending friend request.
        /// </summary>
        /// <param name="requestId">The unique request ID to decline.</param>
        public void DeclineFriendRequest(string requestId)
        {
            if (string.IsNullOrEmpty(requestId)) return;

            lock (_lock)
            {
                if (!_pendingRequests.Remove(requestId))
                {
                    Debug.LogWarning($"[SocialGraphManager] Request {requestId} not found.");
                    return;
                }
            }

            SaveLocalData();
            Debug.Log($"[SocialGraphManager] Friend request declined: {requestId}");
        }

        /// <summary>
        /// Removes a friend from the friend list.
        /// </summary>
        /// <param name="playerId">The player ID of the friend to remove.</param>
        public async void RemoveFriend(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return;

            bool wasFriend;
            lock (_lock)
            {
                wasFriend = _friends.Remove(playerId);
                _relationshipXP.Remove(playerId);
            }

            if (!wasFriend) return;

#if PLAYFAB
            await RemovePlayFabFriend(playerId);
#endif

            SaveLocalData();
            OnFriendRemoved?.Invoke(playerId);
            EventBus.Instance.Publish(new FriendRemovedEvent
            {
                PlayerId = playerId,
                PlayerName = GetFriendDisplayName(playerId)
            });

            Debug.Log($"[SocialGraphManager] Removed friend: {playerId}");
        }

        /// <summary>
        /// Blocks a player, preventing friend requests and hiding their presence.
        /// Also removes them from friends if they are one.
        /// </summary>
        /// <param name="playerId">The player ID to block.</param>
        public void BlockPlayer(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return;
            if (playerId == _localPlayerId) return;

            lock (_lock)
            {
                if (_blockedPlayers.Count >= MAX_BLOCKED)
                {
                    Debug.LogWarning("[SocialGraphManager] Maximum blocked players reached.");
                    return;
                }

                _blockedPlayers.Add(playerId);
                _friends.Remove(playerId);

                // Remove any pending requests from/to this player
                var toRemove = _pendingRequests
                    .Where(kvp => kvp.Value.SenderId == playerId || kvp.Value.RecipientId == playerId)
                    .Select(kvp => kvp.Key)
                    .ToList();
                foreach (var reqId in toRemove)
                {
                    _pendingRequests.Remove(reqId);
                }
            }

            SaveLocalData();
            OnPlayerBlocked?.Invoke(playerId);
            EventBus.Instance.Publish(new PlayerBlockedEvent
            {
                PlayerId = playerId,
                PlayerName = GetFriendDisplayName(playerId)
            });

            Debug.Log($"[SocialGraphManager] Blocked player: {playerId}");
        }

        /// <summary>
        /// Unblocks a previously blocked player.
        /// </summary>
        /// <param name="playerId">The player ID to unblock.</param>
        public void UnblockPlayer(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return;

            lock (_lock)
            {
                _blockedPlayers.Remove(playerId);
            }

            SaveLocalData();
            OnPlayerUnblocked?.Invoke(playerId);
            Debug.Log($"[SocialGraphManager] Unblocked player: {playerId}");
        }

        /// <summary>
        /// Gets a copy of the full friend list.
        /// </summary>
        /// <returns>List of all friends.</returns>
        public List<FriendInfo> GetFriends()
        {
            lock (_lock)
            {
                return _friends.Values.ToList();
            }
        }

        /// <summary>
        /// Gets only the friends who are currently online.
        /// </summary>
        /// <returns>List of online friends.</returns>
        public List<FriendInfo> GetOnlineFriends()
        {
            lock (_lock)
            {
                return _friends.Values.Where(f => f.IsOnline).ToList();
            }
        }

        /// <summary>
        /// Gets all pending friend requests (incoming and outgoing).
        /// </summary>
        /// <returns>List of pending friend requests.</returns>
        public List<FriendRequest> GetPendingRequests()
        {
            lock (_lock)
            {
                return _pendingRequests.Values.ToList();
            }
        }

        /// <summary>
        /// Checks if the given player is a friend.
        /// </summary>
        /// <param name="playerId">The player ID to check.</param>
        /// <returns>True if the player is a friend.</returns>
        public bool IsFriend(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return false;
            lock (_lock)
            {
                return _friends.ContainsKey(playerId);
            }
        }

        /// <summary>
        /// Checks if the given player is blocked.
        /// </summary>
        /// <param name="playerId">The player ID to check.</param>
        /// <returns>True if the player is blocked.</returns>
        public bool IsBlocked(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return false;
            lock (_lock)
            {
                return _blockedPlayers.Contains(playerId);
            }
        }

        /// <summary>
        /// Checks if there is a pending incoming request from the given player.
        /// </summary>
        /// <param name="playerId">The player ID to check.</param>
        /// <returns>True if there is a pending incoming request.</returns>
        public bool HasPendingRequestFrom(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return false;
            lock (_lock)
            {
                return _pendingRequests.Values.Any(r => r.IsIncoming && r.SenderId == playerId);
            }
        }

        /// <summary>
        /// Gets the display name of a friend by their player ID.
        /// </summary>
        /// <param name="playerId">The friend's player ID.</param>
        /// <returns>The display name, or the player ID if not found.</returns>
        public string GetFriendDisplayName(string playerId)
        {
            lock (_lock)
            {
                return _friends.TryGetValue(playerId, out var friend) ? friend.DisplayName : playerId;
            }
        }

        #endregion

        #region Presence

        /// <summary>
        /// Updates the local player's presence status and broadcasts to friends.
        /// </summary>
        /// <param name="status">The new presence status.</param>
        /// <param name="location">Optional location description.</param>
        public void UpdateMyPresence(PresenceStatus status, string location = "")
        {
            PresenceManager.Instance?.SetMyPresence(status, location);
        }

        /// <summary>
        /// Gets the current presence info for a specific player.
        /// </summary>
        /// <param name="playerId">The player ID to look up.</param>
        /// <returns>The player's presence info, or null if not available.</returns>
        public PresenceInfo GetPlayerPresence(string playerId)
        {
            return PresenceManager.Instance?.GetPresence(playerId);
        }

        /// <summary>
        /// Gets presence info for all friends.
        /// </summary>
        /// <returns>Dictionary of friend player IDs to their presence info.</returns>
        public Dictionary<string, PresenceInfo> GetAllFriendsPresence()
        {
            var result = new Dictionary<string, PresenceInfo>();
            var friendIds = GetFriends().Select(f => f.PlayerId).ToList();
            var presenceDict = PresenceManager.Instance?.GetAllPresence();

            if (presenceDict == null) return result;

            foreach (var id in friendIds)
            {
                if (presenceDict.TryGetValue(id, out var presence))
                {
                    result[id] = presence;
                }
            }

            return result;
        }

        /// <summary>
        /// Internal callback invoked by PresenceManager when a friend's presence changes.
        /// Updates the cached FriendInfo and fires the event.
        /// </summary>
        /// <param name="playerId">The player whose presence changed.</param>
        /// <param name="presence">The new presence info.</param>
        internal void OnPresenceUpdated(string playerId, PresenceInfo presence)
        {
            if (presence == null) return;

            lock (_lock)
            {
                if (_friends.TryGetValue(playerId, out var friend))
                {
                    friend.Status = presence.Status;
                    friend.Location = presence.Location;
                    friend.LocationId = presence.LocationId;
                }
            }

            OnFriendPresenceChanged?.Invoke(playerId, presence);
            EventBus.Instance.Publish(new FriendPresenceChangedEvent
            {
                FriendId = playerId,
                FriendName = presence.DisplayName,
                NewStatus = (int)presence.Status,
                NewLocation = presence.Location,
                NewLocationId = presence.LocationId
            });
        }

        #endregion

        #region Relationship Levels

        /// <summary>
        /// Adds relationship XP to a friend, potentially leveling up the relationship.
        /// </summary>
        /// <param name="playerId">The friend's player ID.</param>
        /// <param name="xp">The amount of XP to add.</param>
        public void AddRelationshipXP(string playerId, int xp)
        {
            if (string.IsNullOrEmpty(playerId) || xp <= 0) return;
            if (!IsFriend(playerId)) return;

            int oldLevel;
            lock (_lock)
            {
                if (!_relationshipXP.TryGetValue(playerId, out int currentXP))
                    currentXP = 0;

                oldLevel = GetRelationshipLevelInternal(playerId);
                _relationshipXP[playerId] = currentXP + xp;
            }

            int newLevel = GetRelationshipLevel(playerId);
            if (newLevel > oldLevel)
            {
                lock (_lock)
                {
                    if (_friends.TryGetValue(playerId, out var friend))
                    {
                        friend.RelationshipLevel = newLevel;
                    }
                }

                EventBus.Instance.Publish(new RelationshipLeveledUpEvent
                {
                    OtherPlayerId = playerId,
                    OldLevel = oldLevel,
                    NewLevel = newLevel,
                    NewTitle = GetRelationshipTitle(newLevel)
                });

                Debug.Log($"[SocialGraphManager] Relationship with {playerId} leveled up: {oldLevel} -> {newLevel}");
            }

            SaveLocalData();
        }

        /// <summary>
        /// Gets the current relationship level (1-10) for a friend.
        /// </summary>
        /// <param name="playerId">The friend's player ID.</param>
        /// <returns>The relationship level, or 0 if not a friend.</returns>
        public int GetRelationshipLevel(string playerId)
        {
            lock (_lock)
            {
                return GetRelationshipLevelInternal(playerId);
            }
        }

        /// <summary>
        /// Gets the relationship title for a given level.
        /// </summary>
        /// <param name="level">The relationship level (1-10).</param>
        /// <returns>The human-readable title.</returns>
        public string GetRelationshipTitle(int level)
        {
            return level switch
            {
                1 => "Acquaintance",
                2 => "New Friend",
                3 => "Buddy",
                4 => "Pal",
                5 => "Close Friend",
                6 => "Good Friend",
                7 => "Trusted Friend",
                8 => "Bestie",
                9 => "Soulmate",
                10 => "Kindred Spirit",
                _ => "Stranger"
            };
        }

        /// <summary>
        /// Internal method to calculate relationship level from XP without locking.
        /// </summary>
        private int GetRelationshipLevelInternal(string playerId)
        {
            if (!_relationshipXP.TryGetValue(playerId, out int xp))
                return 1;

            return xp switch
            {
                < 100 => 1,
                < 250 => 2,
                < 500 => 3,
                < 1000 => 4,
                < 2000 => 5,
                < 3500 => 6,
                < 5500 => 7,
                < 8000 => 8,
                < 11000 => 9,
                _ => 10
            };
        }

        #endregion

        #region Backend Integration

#if PLAYFAB
        /// <summary>
        /// Sends a friend request via PlayFab.
        /// </summary>
        private async Task<bool> SendPlayFabFriendRequest(string targetPlayFabId)
        {
            if (PlayFabManager.Instance?.IsLoggedIn != true) return false;
            return await PlayFabManager.Instance.AddFriend(targetPlayFabId);
        }

        /// <summary>
        /// Accepts a friend request via PlayFab.
        /// </summary>
        private async Task<bool> AcceptPlayFabFriendRequest(string senderPlayFabId)
        {
            if (PlayFabManager.Instance?.IsLoggedIn != true) return false;
            return await PlayFabManager.Instance.AddFriend(senderPlayFabId);
        }

        /// <summary>
        /// Removes a friend via PlayFab.
        /// </summary>
        private async Task<bool> RemovePlayFabFriend(string friendPlayFabId)
        {
            if (PlayFabManager.Instance?.IsLoggedIn != true) return false;
            return await PlayFabManager.Instance.RemoveFriend(friendPlayFabId);
        }

        /// <summary>
        /// Fetches the friends list from PlayFab and merges with local data.
        /// </summary>
        public async Task SyncFriendsFromBackend()
        {
            if (PlayFabManager.Instance?.IsLoggedIn != true)
            {
                Debug.Log("[SocialGraphManager] Not logged in to PlayFab. Using local friends only.");
                return;
            }

            try
            {
                var backendFriends = await PlayFabManager.Instance.GetFriendsList();
                if (backendFriends == null) return;

                lock (_lock)
                {
                    foreach (var backendFriend in backendFriends)
                    {
                        string friendId = backendFriend.FriendPlayFabId ?? backendFriend.Username;
                        if (string.IsNullOrEmpty(friendId)) continue;

                        if (!_friends.ContainsKey(friendId))
                        {
                            _friends[friendId] = new FriendInfo
                            {
                                PlayerId = friendId,
                                DisplayName = backendFriend.TitleDisplayName ?? friendId,
                                Status = PresenceStatus.Offline,
                                RelationshipLevel = 1,
                                RelationshipXP = 0,
                                BefriendedDate = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
                            };
                        }
                    }
                }

                SaveLocalData();
                OnFriendsLoaded?.Invoke();
                Debug.Log($"[SocialGraphManager] Synced {backendFriends.Count} friends from PlayFab.");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[SocialGraphManager] Failed to sync friends: {ex.Message}");
            }
        }
#endif

        #endregion

        #region Persistence

        /// <summary>
        /// Serializable container for local social graph save data.
        /// </summary>
        [System.Serializable]
        private class SocialGraphSaveData
        {
            public List<FriendInfo> Friends = new();
            public List<FriendRequest> Requests = new();
            public List<string> Blocked = new();
            public Dictionary<string, int> RelationshipXP = new();
        }

        /// <summary>
        /// Saves the social graph to local storage.
        /// </summary>
        private void SaveLocalData()
        {
            var saveData = new SocialGraphSaveData();

            lock (_lock)
            {
                saveData.Friends = _friends.Values.ToList();
                saveData.Requests = _pendingRequests.Values.ToList();
                saveData.Blocked = _blockedPlayers.ToList();
                saveData.RelationshipXP = new Dictionary<string, int>(_relationshipXP);
            }

            SaveManager.Instance?.Save(FRIENDS_SAVE_KEY, saveData);
        }

        /// <summary>
        /// Loads the social graph from local storage.
        /// </summary>
        private void LoadLocalData()
        {
            var saveData = SaveManager.Instance?.Load<SocialGraphSaveData>(FRIENDS_SAVE_KEY);
            if (saveData == null) return;

            lock (_lock)
            {
                _friends.Clear();
                foreach (var friend in saveData.Friends)
                {
                    if (!string.IsNullOrEmpty(friend.PlayerId))
                        _friends[friend.PlayerId] = friend;
                }

                _pendingRequests.Clear();
                foreach (var request in saveData.Requests)
                {
                    if (!string.IsNullOrEmpty(request.RequestId))
                        _pendingRequests[request.RequestId] = request;
                }

                _blockedPlayers.Clear();
                foreach (var blockedId in saveData.Blocked)
                {
                    if (!string.IsNullOrEmpty(blockedId))
                        _blockedPlayers.Add(blockedId);
                }

                _relationshipXP.Clear();
                if (saveData.RelationshipXP != null)
                {
                    foreach (var kvp in saveData.RelationshipXP)
                    {
                        _relationshipXP[kvp.Key] = kvp.Value;
                    }
                }
            }

            _isInitialized = true;
            Debug.Log($"[SocialGraphManager] Loaded {_friends.Count} friends, {_pendingRequests.Count} requests, {_blockedPlayers.Count} blocked.");
        }

        #endregion

        #region Utility

        /// <summary>
        /// Gets the total number of friends.
        /// </summary>
        public int FriendCount
        {
            get
            {
                lock (_lock)
                {
                    return _friends.Count;
                }
            }
        }

        /// <summary>
        /// Gets the number of pending friend requests.
        /// </summary>
        public int PendingRequestCount
        {
            get
            {
                lock (_lock)
                {
                    return _pendingRequests.Count;
                }
            }
        }

        /// <summary>
        /// Gets the number of blocked players.
        /// </summary>
        public int BlockedCount
        {
            get
            {
                lock (_lock)
                {
                    return _blockedPlayers.Count;
                }
            }
        }

        /// <summary>
        /// Clears all social graph data. Use with caution.
        /// </summary>
        [ContextMenu("Clear All Social Data")]
        public void ClearAllData()
        {
            lock (_lock)
            {
                _friends.Clear();
                _pendingRequests.Clear();
                _blockedPlayers.Clear();
                _relationshipXP.Clear();
            }

            SaveManager.Instance?.Delete(FRIENDS_SAVE_KEY);
            Debug.Log("[SocialGraphManager] All social data cleared.");
        }

        #endregion

        #region Editor

#if UNITY_EDITOR
        /// <summary>
        /// Editor helper to log the current social graph state.
        /// </summary>
        [ContextMenu("Log Social Graph State")]
        private void EditorLogState()
        {
            lock (_lock)
            {
                Debug.Log("=== SocialGraphManager State ===");
                Debug.Log($"Friends: {_friends.Count}/{MAX_FRIENDS}");
                foreach (var friend in _friends.Values)
                {
                    Debug.Log($"  [{friend.Status}] {friend.DisplayName} (Lv{friend.RelationshipLevel}) - {friend.Location}");
                }
                Debug.Log($"Pending Requests: {_pendingRequests.Count}/{MAX_PENDING_REQUESTS}");
                foreach (var req in _pendingRequests.Values)
                {
                    Debug.Log($"  [{req.IsIncoming}] {req.SenderName} -> {req.RecipientId}");
                }
                Debug.Log($"Blocked: {_blockedPlayers.Count}/{MAX_BLOCKED}");
                foreach (var blocked in _blockedPlayers)
                {
                    Debug.Log($"  {blocked}");
                }
            }
        }
#endif

        #endregion
    }
}
