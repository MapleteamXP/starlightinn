using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace KawaiiCoolIsland.Rooms
{
    /// <summary>
    /// Quick navigation system for KawaiiCool Island v2.0.
    /// Provides fast access to favorites, history, home, hub, and friend rooms.
    /// Acts as the player's personal navigation compass across the virtual world.
    /// </summary>
    public class RoomNavigator : Singleton<RoomNavigator>
    {
        #region Navigation

        [Header("Navigation")]
        /// <summary>Registered navigation shortcuts (Home, Hub, Favorites, etc.).</summary>
        public List<NavigationShortcut> Shortcuts = new();

        /// <summary>ID of the last successfully entered room for "NavigateToLastRoom".</summary>
        private string _lastEnteredRoomId;

        /// <summary>ID of the player's personal home room.</summary>
        private string _homeRoomId;

        /// <summary>ID of the central hub room.</summary>
        private const string HubRoomId = "hub_main";

        #endregion

        #region Quick Join

        [Header("Quick Join")]
        /// <summary>Target room ID for the quick-join button.</summary>
        public string QuickJoinRoomId;

        /// <summary>UI button bound to quick join.</summary>
        public Button QuickJoinButton;

        #endregion

        #region Favorites

        [Header("Favorites")]
        /// <summary>Locally cached favorite room IDs.</summary>
        public List<string> FavoriteRoomIds = new();

        /// <summary>Maximum number of favorites allowed per player.</summary>
        public int MaxFavorites = 50;

        #endregion

        #region History

        [Header("History")]
        /// <summary>Recent room navigation history.</summary>
        public List<RoomHistoryEntry> RoomHistory = new();

        /// <summary>Maximum number of history entries to retain.</summary>
        public int MaxHistory = 20;

        #endregion

        #region Events

        /// <summary>Raised when the player navigates to a specific room.</summary>
        public event Action<string> OnNavigatedToRoom;

        /// <summary>Raised when the player navigates to their home room.</summary>
        public event Action OnNavigatedToHome;

        /// <summary>Raised when the player navigates to the central hub.</summary>
        public event Action OnNavigatedToHub;

        /// <summary>Raised when the player navigates to a friend's current room.</summary>
        public event Action<string> OnNavigatedToFriend;

        /// <summary>Raised when a favorite is added.</summary>
        public event Action<string> OnFavoriteAdded;

        /// <summary>Raised when a favorite is removed.</summary>
        public event Action<string> OnFavoriteRemoved;

        /// <summary>Raised when history changes.</summary>
        public event Action OnHistoryChanged;

        #endregion

        #region Unity Lifecycle

        private void Start()
        {
            LoadPersistedData();
            SetupDefaultShortcuts();
            SetupQuickJoinButton();
        }

        private void OnEnable()
        {
            EventBus.Subscribe<RoomEnterRequestedEvent>(OnRoomEnterRequested);
            EventBus.Subscribe<RoomFavoritedEvent>(OnRoomFavorited);
            EventBus.Subscribe<RoomUnfavoritedEvent>(OnRoomUnfavorited);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<RoomEnterRequestedEvent>(OnRoomEnterRequested);
            EventBus.Unsubscribe<RoomFavoritedEvent>(OnRoomFavorited);
            EventBus.Unsubscribe<RoomUnfavoritedEvent>(OnRoomUnfavorited);
        }

        #endregion

        #region Navigation Actions

        /// <summary>
        /// Navigates to a room by its unique identifier.
        /// Performs validation checks and emits navigation events.
        /// </summary>
        /// <param name="roomId">The target room ID.</param>
        public void NavigateToRoom(string roomId)
        {
            if (string.IsNullOrEmpty(roomId))
            {
                Debug.LogWarning("[RoomNavigator] Cannot navigate to null or empty room ID.");
                return;
            }

            string warning = GetNavigationWarning(roomId);
            if (!string.IsNullOrEmpty(warning))
            {
                Debug.LogWarning($"[RoomNavigator] Navigation warning for {roomId}: {warning}");
                EventBus.Publish(new NavigationWarningEvent
                {
                    RoomId = roomId,
                    Warning = warning
                });
            }

            if (!CanNavigateTo(roomId))
            {
                Debug.LogWarning($"[RoomNavigator] Navigation blocked for room: {roomId}");
                return;
            }

            _lastEnteredRoomId = roomId;
            AddToHistory(roomId, ResolveRoomName(roomId));

            OnNavigatedToRoom?.Invoke(roomId);
            EventBus.Publish(new NavigateToRoomEvent { RoomId = roomId });

            // Delegate actual entry to RoomBrowser / RoomInstanceManager
            RoomBrowser.Instance?.EnterRoom(roomId);
        }

        /// <summary>
        /// Navigates to the player's personal home room.
        /// </summary>
        public void NavigateToHome()
        {
            if (string.IsNullOrEmpty(_homeRoomId))
            {
                _homeRoomId = PlayFabManager.Instance?.GetPlayerHomeRoomId();
            }

            if (string.IsNullOrEmpty(_homeRoomId))
            {
                Debug.LogWarning("[RoomNavigator] No home room configured. Creating one...");
                EventBus.Publish(new CreateHomeRoomEvent());
                return;
            }

            OnNavigatedToHome?.Invoke();
            NavigateToRoom(_homeRoomId);
        }

        /// <summary>
        /// Navigates to the central hub room.
        /// </summary>
        public void NavigateToHub()
        {
            OnNavigatedToHub?.Invoke();
            NavigateToRoom(HubRoomId);
        }

        /// <summary>
        /// Navigates to the last room the player successfully entered.
        /// </summary>
        public void NavigateToLastRoom()
        {
            if (string.IsNullOrEmpty(_lastEnteredRoomId))
            {
                if (RoomHistory.Count > 0)
                    _lastEnteredRoomId = RoomHistory[0].RoomId;
            }

            if (string.IsNullOrEmpty(_lastEnteredRoomId))
            {
                Debug.LogWarning("[RoomNavigator] No last room available. Navigating to hub.");
                NavigateToHub();
                return;
            }

            NavigateToRoom(_lastEnteredRoomId);
        }

        /// <summary>
        /// Navigates to the room where a specified friend is currently located.
        /// </summary>
        /// <param name="friendId">The friend's user ID.</param>
        public void NavigateToFriend(string friendId)
        {
            if (string.IsNullOrEmpty(friendId))
            {
                Debug.LogWarning("[RoomNavigator] Cannot navigate to empty friend ID.");
                return;
            }

            // Query the friend's current room from the backend or social service
            string friendRoomId = ResolveFriendRoomId(friendId);

            if (string.IsNullOrEmpty(friendRoomId))
            {
                Debug.LogWarning($"[RoomNavigator] Friend {friendId} is not in any room.");
                EventBus.Publish(new FriendNotInRoomEvent { FriendId = friendId });
                return;
            }

            OnNavigatedToFriend?.Invoke(friendId);
            EventBus.Publish(new NavigateToFriendRoomEvent
            {
                FriendId = friendId,
                RoomId = friendRoomId
            });

            NavigateToRoom(friendRoomId);
        }

        #endregion

        #region Favorites Management

        /// <summary>
        /// Adds a room to the quick-navigation favorites.
        /// </summary>
        /// <param name="roomId">The room ID to favorite.</param>
        public void AddFavorite(string roomId)
        {
            if (string.IsNullOrEmpty(roomId))
                return;

            if (FavoriteRoomIds.Contains(roomId))
                return;

            if (FavoriteRoomIds.Count >= MaxFavorites)
            {
                Debug.LogWarning($"[RoomNavigator] Favorite limit reached ({MaxFavorites}).");
                EventBus.Publish(new FavoriteLimitReachedEvent { Limit = MaxFavorites });
                return;
            }

            FavoriteRoomIds.Add(roomId);
            SaveFavorites();
            RebuildFavoriteShortcuts();
            OnFavoriteAdded?.Invoke(roomId);
        }

        /// <summary>
        /// Removes a room from quick-navigation favorites.
        /// </summary>
        /// <param name="roomId">The room ID to remove.</param>
        public void RemoveFavorite(string roomId)
        {
            if (string.IsNullOrEmpty(roomId))
                return;

            if (!FavoriteRoomIds.Remove(roomId))
                return;

            SaveFavorites();
            RebuildFavoriteShortcuts();
            OnFavoriteRemoved?.Invoke(roomId);
        }

        #endregion

        #region History Management

        /// <summary>
        /// Records a room visit in the navigation history.
        /// </summary>
        /// <param name="roomId">The visited room ID.</param>
        /// <param name="roomName">The display name of the room.</param>
        public void AddToHistory(string roomId, string roomName)
        {
            if (string.IsNullOrEmpty(roomId))
                return;

            // Remove duplicate if present and reinsert at top
            RoomHistoryEntry existing = RoomHistory.FirstOrDefault(h => h.RoomId == roomId);
            if (existing != null)
            {
                RoomHistory.Remove(existing);
            }

            RoomHistory.Insert(0, new RoomHistoryEntry
            {
                RoomId = roomId,
                RoomName = roomName ?? "Unknown",
                LastVisited = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                VisitCount = existing != null ? existing.VisitCount + 1 : 1
            });

            while (RoomHistory.Count > MaxHistory)
                RoomHistory.RemoveAt(RoomHistory.Count - 1);

            SaveHistory();
            RebuildHistoryShortcuts();
            OnHistoryChanged?.Invoke();
        }

        /// <summary>
        /// Clears the navigation history.
        /// </summary>
        public void ClearHistory()
        {
            RoomHistory.Clear();
            SaveHistory();
            RebuildHistoryShortcuts();
            OnHistoryChanged?.Invoke();
        }

        #endregion

        #region Validation & Warnings

        /// <summary>
        /// Checks whether navigation to a room is currently allowed.
        /// </summary>
        /// <param name="roomId">The room ID to validate.</param>
        /// <returns>True if the player can navigate to the room.</returns>
        public bool CanNavigateTo(string roomId)
        {
            RoomInfo room = RoomBrowser.Instance?.AllRooms.FirstOrDefault(r => r.RoomId == roomId);
            if (room == null)
            {
                // Allow navigation to well-known rooms (home, hub) even if not in browse list
                return roomId == HubRoomId || roomId == _homeRoomId;
            }

            if (room.IsPrivate && !IsInvited(roomId))
                return false;

            if (room.HasPassword && !HasPassword(roomId))
                return false;

            if (room.CurrentPlayers >= room.MaxPlayers)
            {
                // Allow if VIP or moderator (extend as needed)
                return false;
            }

            return true;
        }

        /// <summary>
        /// Returns a human-readable warning explaining why navigation may be blocked.
        /// </summary>
        /// <param name="roomId">The room ID to check.</param>
        /// <returns>Warning string, or empty if no warning.</returns>
        public string GetNavigationWarning(string roomId)
        {
            RoomInfo room = RoomBrowser.Instance?.AllRooms.FirstOrDefault(r => r.RoomId == roomId);
            if (room == null)
            {
                if (roomId != HubRoomId && roomId != _homeRoomId)
                    return "Room not found.";
                return string.Empty;
            }

            if (room.CurrentPlayers >= room.MaxPlayers)
                return "Room is full.";

            if (!string.IsNullOrEmpty(room.RequiredLevel))
                return $"Level {room.RequiredLevel} required.";

            if (room.HasPassword && !HasPassword(roomId))
                return "Password required.";

            if (room.IsPrivate && !IsInvited(roomId))
                return "Private room (invite only).";

            return string.Empty;
        }

        #endregion

        #region Shortcut Management

        /// <summary>
        /// Sets up the default navigation shortcuts: Home, Hub, Favorites, History.
        /// </summary>
        private void SetupDefaultShortcuts()
        {
            Shortcuts.Clear();

            Shortcuts.Add(new NavigationShortcut
            {
                ShortcutId = "shortcut_home",
                DisplayName = "Home",
                TargetRoomId = _homeRoomId ?? "",
                Type = ShortcutType.Home,
                Order = 0
            });

            Shortcuts.Add(new NavigationShortcut
            {
                ShortcutId = "shortcut_hub",
                DisplayName = "Hub",
                TargetRoomId = HubRoomId,
                Type = ShortcutType.Hub,
                Order = 1
            });

            RebuildFavoriteShortcuts();
            RebuildHistoryShortcuts();
            RebuildOfficialShortcuts();
        }

        /// <summary>
        /// Rebuilds favorite-based shortcuts from the favorites list.
        /// </summary>
        private void RebuildFavoriteShortcuts()
        {
            // Remove old favorite shortcuts
            Shortcuts.RemoveAll(s => s.Type == ShortcutType.Favorite);

            int order = 10;
            foreach (string roomId in FavoriteRoomIds)
            {
                string name = ResolveRoomName(roomId);
                Shortcuts.Add(new NavigationShortcut
                {
                    ShortcutId = $"shortcut_fav_{roomId}",
                    DisplayName = name,
                    TargetRoomId = roomId,
                    Type = ShortcutType.Favorite,
                    Order = order++
                });
            }

            SortShortcuts();
        }

        /// <summary>
        /// Rebuilds history-based shortcuts from the history list.
        /// </summary>
        private void RebuildHistoryShortcuts()
        {
            Shortcuts.RemoveAll(s => s.Type == ShortcutType.History);

            int order = 100;
            foreach (RoomHistoryEntry entry in RoomHistory.Take(5))
            {
                Shortcuts.Add(new NavigationShortcut
                {
                    ShortcutId = $"shortcut_hist_{entry.RoomId}",
                    DisplayName = entry.RoomName,
                    TargetRoomId = entry.RoomId,
                    Type = ShortcutType.History,
                    Order = order++
                });
            }

            SortShortcuts();
        }

        /// <summary>
        /// Rebuilds official room shortcuts from the browser list.
        /// </summary>
        private void RebuildOfficialShortcuts()
        {
            Shortcuts.RemoveAll(s => s.Type == ShortcutType.Official);

            List<RoomInfo> official = RoomBrowser.Instance?.GetOfficialRooms().Take(3).ToList();
            if (official == null) return;

            int order = 200;
            foreach (RoomInfo room in official)
            {
                Shortcuts.Add(new NavigationShortcut
                {
                    ShortcutId = $"shortcut_official_{room.RoomId}",
                    DisplayName = room.RoomName,
                    TargetRoomId = room.RoomId,
                    Type = ShortcutType.Official,
                    Order = order++
                });
            }

            SortShortcuts();
        }

        /// <summary>
        /// Sorts shortcuts by their <see cref="NavigationShortcut.Order"/> value.
        /// </summary>
        private void SortShortcuts()
        {
            Shortcuts = Shortcuts.OrderBy(s => s.Order).ToList();
        }

        #endregion

        #region Quick Join

        /// <summary>
        /// Binds the Quick Join button to navigate to <see cref="QuickJoinRoomId"/>.
        /// </summary>
        private void SetupQuickJoinButton()
        {
            if (QuickJoinButton != null)
            {
                QuickJoinButton.onClick.RemoveAllListeners();
                QuickJoinButton.onClick.AddListener(() =>
                {
                    if (!string.IsNullOrEmpty(QuickJoinRoomId))
                        NavigateToRoom(QuickJoinRoomId);
                });
            }
        }

        /// <summary>
        /// Updates the quick join target and refreshes the button binding.
        /// </summary>
        /// <param name="roomId">The new quick join room ID.</param>
        public void SetQuickJoinRoom(string roomId)
        {
            QuickJoinRoomId = roomId;
            SetupQuickJoinButton();
        }

        #endregion

        #region Helpers

        /// <summary>
        /// Resolves a room display name from all available sources.
        /// </summary>
        private string ResolveRoomName(string roomId)
        {
            RoomInfo room = RoomBrowser.Instance?.AllRooms.FirstOrDefault(r => r.RoomId == roomId);
            if (room != null)
                return room.RoomName;

            RoomHistoryEntry history = RoomHistory.FirstOrDefault(h => h.RoomId == roomId);
            if (history != null)
                return history.RoomName;

            return roomId;
        }

        /// <summary>
        /// Resolves the current room ID for a given friend.
        /// </summary>
        private string ResolveFriendRoomId(string friendId)
        {
            // Check browser for rooms containing this friend
            RoomInfo room = RoomBrowser.Instance?.AllRooms
                .FirstOrDefault(r => r.FriendIdsInside != null && r.FriendIdsInside.Contains(friendId));

            if (room != null)
                return room.RoomId;

            // Fallback to social backend
            return PlayFabManager.Instance?.GetFriendCurrentRoomId(friendId);
        }

        /// <summary>
        /// Checks whether the player has a valid invite for a private room.
        /// </summary>
        private bool IsInvited(string roomId)
        {
            // Delegate to backend or invite manager
            return PlayFabManager.Instance?.HasRoomInvite(roomId) ?? false;
        }

        /// <summary>
        /// Checks whether the player knows the password for a room.
        /// </summary>
        private bool HasPassword(string roomId)
        {
            return PlayerPrefs.HasKey($"RoomPassword_{roomId}");
        }

        #endregion

        #region EventBus Handlers

        private void OnRoomEnterRequested(RoomEnterRequestedEvent evt)
        {
            _lastEnteredRoomId = evt.Room?.RoomId;
        }

        private void OnRoomFavorited(RoomFavoritedEvent evt)
        {
            if (!FavoriteRoomIds.Contains(evt.RoomId))
                AddFavorite(evt.RoomId);
        }

        private void OnRoomUnfavorited(RoomUnfavoritedEvent evt)
        {
            RemoveFavorite(evt.RoomId);
        }

        #endregion

        #region Persistence

        /// <summary>
        /// Loads favorites, history, and home room from PlayerPrefs.
        /// </summary>
        private void LoadPersistedData()
        {
            string favJson = PlayerPrefs.GetString("RoomNavigator_Favorites", "[]");
            try
            {
                FavoriteRoomIds.Clear();
                var wrapper = JsonUtility.FromJson<RoomIdListWrapper>(favJson);
                if (wrapper?.Ids != null)
                    FavoriteRoomIds.AddRange(wrapper.Ids);
            }
            catch { /* ignore malformed */ }

            string histJson = PlayerPrefs.GetString("RoomNavigator_History", "[]");
            try
            {
                RoomHistory.Clear();
                var wrapper = JsonUtility.FromJson<RoomHistoryWrapper>(histJson);
                if (wrapper?.Entries != null)
                    RoomHistory.AddRange(wrapper.Entries);
            }
            catch { /* ignore malformed */ }

            _homeRoomId = PlayerPrefs.GetString("RoomNavigator_HomeRoomId", "");
            _lastEnteredRoomId = PlayerPrefs.GetString("RoomNavigator_LastRoomId", "");
        }

        /// <summary>
        /// Saves favorites to PlayerPrefs.
        /// </summary>
        private void SaveFavorites()
        {
            var wrapper = new RoomIdListWrapper { Ids = new List<string>(FavoriteRoomIds) };
            PlayerPrefs.SetString("RoomNavigator_Favorites", JsonUtility.ToJson(wrapper));
            PlayerPrefs.Save();
        }

        /// <summary>
        /// Saves history to PlayerPrefs.
        /// </summary>
        private void SaveHistory()
        {
            var wrapper = new RoomHistoryWrapper { Entries = new List<RoomHistoryEntry>(RoomHistory) };
            PlayerPrefs.SetString("RoomNavigator_History", JsonUtility.ToJson(wrapper));
            PlayerPrefs.SetString("RoomNavigator_LastRoomId", _lastEnteredRoomId ?? "");
            PlayerPrefs.Save();
        }

        #endregion

        #region JSON Wrappers

        [System.Serializable]
        private class RoomIdListWrapper { public List<string> Ids = new(); }

        [System.Serializable]
        private class RoomHistoryWrapper { public List<RoomHistoryEntry> Entries = new(); }

        #endregion
    }

    #region Data Models

    /// <summary>
    /// Represents a single navigation shortcut in the quick-nav panel.
    /// </summary>
    [System.Serializable]
    public class NavigationShortcut
    {
        /// <summary>Unique shortcut identifier.</summary>
        public string ShortcutId;

        /// <summary>Display label for the shortcut button.</summary>
        public string DisplayName;

        /// <summary>Icon sprite for the shortcut.</summary>
        public Sprite Icon;

        /// <summary>Target room ID to navigate to.</summary>
        public string TargetRoomId;

        /// <summary>Classification of the shortcut.</summary>
        public ShortcutType Type;

        /// <summary>Sort order among shortcuts.</summary>
        public int Order;
    }

    /// <summary>
    /// Types of navigation shortcuts available in the quick-nav panel.
    /// </summary>
    public enum ShortcutType
    {
        /// <summary>Player's personal home room.</summary>
        Home,
        /// <summary>Central world hub.</summary>
        Hub,
        /// <summary>A player-favorited room.</summary>
        Favorite,
        /// <summary>A recently visited room from history.</summary>
        History,
        /// <summary>A room a friend is currently in.</summary>
        FriendRoom,
        /// <summary>An official curated room.</summary>
        Official,
        /// <summary>A room with an active event.</summary>
        Event
    }

    #endregion

    #region EventBus Events

    /// <summary>
    /// Published when the player navigates to a room.
    /// </summary>
    public struct NavigateToRoomEvent
    {
        /// <summary>The target room ID.</summary>
        public string RoomId;
    }

    /// <summary>
    /// Published when the player navigates to a friend's room.
    /// </summary>
    public struct NavigateToFriendRoomEvent
    {
        /// <summary>The friend's user ID.</summary>
        public string FriendId;
        /// <summary>The room the friend is in.</summary>
        public string RoomId;
    }

    /// <summary>
    /// Published when a navigation warning should be shown to the player.
    /// </summary>
    public struct NavigationWarningEvent
    {
        /// <summary>The room ID involved.</summary>
        public string RoomId;
        /// <summary>Human-readable warning message.</summary>
        public string Warning;
    }

    /// <summary>
    /// Published when a friend is not in any room.
    /// </summary>
    public struct FriendNotInRoomEvent
    {
        /// <summary>The friend's user ID.</summary>
        public string FriendId;
    }

    /// <summary>
    /// Published when the player needs a home room created.
    /// </summary>
    public struct CreateHomeRoomEvent { }

    /// <summary>
    /// Published when the favorite limit is reached.
    /// </summary>
    public struct FavoriteLimitReachedEvent
    {
        /// <summary>The favorite limit that was reached.</summary>
        public int Limit;
    }

    #endregion
}
