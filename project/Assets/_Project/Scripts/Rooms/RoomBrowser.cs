using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using TMPro;

namespace KawaiiCoolIsland.Rooms
{
    /// <summary>
    /// Central room discovery hub for KawaiiCool Island v2.0.
    /// Browse, filter, search, and discover rooms. The RoomBrowser acts as the
    /// primary interface for players to find and join rooms across the virtual world.
    /// </summary>
    public class RoomBrowser : Singleton<RoomBrowser>
    {
        #region Room Lists

        [Header("Room Lists")]
        /// <summary>All rooms fetched from the server.</summary>
        public List<RoomInfo> AllRooms = new();

        /// <summary>Rooms after applying active filters, search, and sorting.</summary>
        public List<RoomInfo> FilteredRooms = new();

        #endregion

        #region Filters

        [Header("Filters")]
        /// <summary>Currently selected category filter.</summary>
        public RoomCategory ActiveCategory = RoomCategory.All;

        /// <summary>Currently selected sort order.</summary>
        public RoomSort ActiveSort = RoomSort.Popular;

        /// <summary>Active search query string.</summary>
        public string SearchQuery = "";

        /// <summary>When true, only show rooms with friends inside.</summary>
        public bool FriendsOnly = false;

        /// <summary>When true, only show rooms that have available player slots.</summary>
        public bool HasSpaceOnly = false;

        #endregion

        #region Pagination

        [Header("Pagination")]
        /// <summary>Maximum number of rooms displayed per page.</summary>
        public int RoomsPerPage = 20;

        /// <summary>Current page index (0-based).</summary>
        public int CurrentPage = 0;

        /// <summary>Total number of pages based on filtered results and <see cref="RoomsPerPage"/>.</summary>
        public int TotalPages => Mathf.CeilToInt(FilteredRooms.Count / (float)RoomsPerPage);

        #endregion

        #region Internal State

        /// <summary>Locally persisted favorite room IDs.</summary>
        private readonly List<string> _favoriteRoomIds = new();

        /// <summary>Persisted room visit history.</summary>
        private readonly List<RoomHistoryEntry> _roomHistory = new();

        /// <summary>Maximum number of history entries to retain.</summary>
        private const int MaxHistoryEntries = 50;

        /// <summary>Maximum number of favorite rooms allowed.</summary>
        private const int MaxFavorites = 100;

        /// <summary>Cached trending calculations refreshed periodically.</summary>
        private readonly Dictionary<string, float> _trendingCache = new();

        /// <summary>Timestamp of the last server fetch.</summary>
        private long _lastFetchTimestamp;

        /// <summary>Minimum seconds between automatic refreshes.</summary>
        private const float RefreshCooldownSeconds = 15f;

        #endregion

        #region Events

        /// <summary>Raised whenever the room list is refreshed and filters reapplied.</summary>
        public event Action OnRoomsRefreshed;

        /// <summary>Raised when the player successfully enters a room.</summary>
        public event Action<RoomInfo> OnRoomEntered;

        /// <summary>Raised when a room is added to favorites.</summary>
        public event Action<string> OnFavoriteAdded;

        /// <summary>Raised when a room is removed from favorites.</summary>
        public event Action<string> OnFavoriteRemoved;

        /// <summary>Raised when the active category changes.</summary>
        public event Action<RoomCategory> OnCategoryChanged;

        /// <summary>Raised when the active sort changes.</summary>
        public event Action<RoomSort> OnSortChanged;

        #endregion

        #region Unity Lifecycle

        private void Start()
        {
            LoadPersistedData();
            RefreshRooms();
        }

        private void OnEnable()
        {
            EventBus.Subscribe<RoomListUpdatedEvent>(OnRoomListUpdated);
            EventBus.Subscribe<PlayerJoinedRoomEvent>(OnPlayerJoinedRoom);
            EventBus.Subscribe<PlayerLeftRoomEvent>(OnPlayerLeftRoom);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<RoomListUpdatedEvent>(OnRoomListUpdated);
            EventBus.Unsubscribe<PlayerJoinedRoomEvent>(OnPlayerJoinedRoom);
            EventBus.Unsubscribe<PlayerLeftRoomEvent>(OnPlayerLeftRoom);
        }

        #endregion

        #region Core Browsing

        /// <summary>
        /// Refreshes the room list from the server and reapplies all active filters.
        /// </summary>
        public void RefreshRooms()
        {
            if (Time.time - _lastFetchTimestamp < RefreshCooldownSeconds)
            {
                ApplyAllFilters();
                OnRoomsRefreshed?.Invoke();
                return;
            }

            FetchRoomsFromServer();
        }

        /// <summary>
        /// Returns the subset of <see cref="FilteredRooms"/> for the current page.
        /// </summary>
        public List<RoomInfo> GetCurrentPage()
        {
            if (FilteredRooms == null || FilteredRooms.Count == 0)
                return new List<RoomInfo>();

            int start = CurrentPage * RoomsPerPage;
            int count = Mathf.Min(RoomsPerPage, FilteredRooms.Count - start);

            if (start < 0 || start >= FilteredRooms.Count)
                return new List<RoomInfo>();

            return FilteredRooms.GetRange(start, count);
        }

        /// <summary>
        /// Navigates directly to a specific page index.
        /// </summary>
        /// <param name="page">Zero-based page index.</param>
        public void GoToPage(int page)
        {
            CurrentPage = Mathf.Clamp(page, 0, Mathf.Max(0, TotalPages - 1));
            OnRoomsRefreshed?.Invoke();
        }

        /// <summary>
        /// Advances to the next page if available.
        /// </summary>
        public void NextPage()
        {
            if (CurrentPage < TotalPages - 1)
            {
                CurrentPage++;
                OnRoomsRefreshed?.Invoke();
            }
        }

        /// <summary>
        /// Goes back to the previous page if available.
        /// </summary>
        public void PreviousPage()
        {
            if (CurrentPage > 0)
            {
                CurrentPage--;
                OnRoomsRefreshed?.Invoke();
            }
        }

        #endregion

        #region Filtering

        /// <summary>
        /// Sets the active category filter and refreshes results.
        /// </summary>
        /// <param name="category">The category to filter by.</param>
        public void FilterByCategory(RoomCategory category)
        {
            ActiveCategory = category;
            CurrentPage = 0;
            ApplyAllFilters();
            OnCategoryChanged?.Invoke(category);
            OnRoomsRefreshed?.Invoke();
        }

        /// <summary>
        /// Sets a text search query and refreshes results.
        /// </summary>
        /// <param name="query">Search string to filter room names, owners, and tags.</param>
        public void FilterBySearch(string query)
        {
            SearchQuery = query?.Trim() ?? "";
            CurrentPage = 0;
            ApplyAllFilters();
            OnRoomsRefreshed?.Invoke();
        }

        /// <summary>
        /// Sets the active sort order and refreshes results.
        /// </summary>
        /// <param name="sort">The sort criteria to apply.</param>
        public void SortRooms(RoomSort sort)
        {
            ActiveSort = sort;
            CurrentPage = 0;
            ApplyAllFilters();
            OnSortChanged?.Invoke(sort);
            OnRoomsRefreshed?.Invoke();
        }

        /// <summary>
        /// Toggles the friends-only filter.
        /// </summary>
        public void ToggleFriendsOnly()
        {
            FriendsOnly = !FriendsOnly;
            CurrentPage = 0;
            ApplyAllFilters();
            OnRoomsRefreshed?.Invoke();
        }

        /// <summary>
        /// Toggles the has-space-only filter.
        /// </summary>
        public void ToggleHasSpaceOnly()
        {
            HasSpaceOnly = !HasSpaceOnly;
            CurrentPage = 0;
            ApplyAllFilters();
            OnRoomsRefreshed?.Invoke();
        }

        #endregion

        #region Room Entry

        /// <summary>
        /// Enters a room by its unique identifier.
        /// </summary>
        /// <param name="roomId">The room ID to join.</param>
        public void EnterRoom(string roomId)
        {
            RoomInfo room = AllRooms.FirstOrDefault(r => r.RoomId == roomId);
            if (room == null)
            {
                Debug.LogWarning($"[RoomBrowser] Room not found: {roomId}");
                return;
            }

            EnterRoomByInfo(room);
        }

        /// <summary>
        /// Enters a room using a <see cref="RoomInfo"/> reference.
        /// </summary>
        /// <param name="room">The room info to join.</param>
        public void EnterRoomByInfo(RoomInfo room)
        {
            if (room == null)
            {
                Debug.LogWarning("[RoomBrowser] Cannot enter null room.");
                return;
            }

            if (room.IsPrivate && !string.IsNullOrEmpty(room.RequiredLevel))
            {
                // Additional permission checks can be added here
            }

            AddToHistory(room.RoomId);
            OnRoomEntered?.Invoke(room);

            EventBus.Publish(new RoomEnterRequestedEvent { Room = room });
            RoomInstanceManager.Instance?.EnterRoom(room);
        }

        /// <summary>
        /// Opens the room creation flow for the player to build a new room.
        /// </summary>
        public void CreateNewRoom()
        {
            EventBus.Publish(new RoomCreateRequestedEvent());
            UIManager.Instance?.ShowPanel("RoomCreationPanel");
        }

        /// <summary>
        /// Opens the island editor for the player's own room.
        /// </summary>
        /// <param name="roomId">The room ID to edit.</param>
        public void EditMyRoom(string roomId)
        {
            RoomInfo room = AllRooms.FirstOrDefault(r => r.RoomId == roomId);
            if (room == null)
            {
                Debug.LogWarning($"[RoomBrowser] Cannot edit unknown room: {roomId}");
                return;
            }

            EventBus.Publish(new RoomEditRequestedEvent { RoomId = roomId });
            IslandEditor.Instance?.EditIsland(roomId);
        }

        #endregion

        #region Discovery Queries

        /// <summary>
        /// Gets a list of recommended rooms tailored to the player based on
        /// favorites, history, friends, and trending activity.
        /// </summary>
        public List<RoomInfo> GetRecommendedRooms()
        {
            var scored = new List<(RoomInfo room, float score)>();

            foreach (RoomInfo room in AllRooms)
            {
                float score = 0f;

                // Boost trending rooms
                score += room.TrendingScore * 0.3f;

                // Boost rooms with friends
                if (room.FriendIdsInside.Count > 0)
                    score += room.FriendIdsInside.Count * 10f;

                // Boost favorite-adjacent categories
                if (_favoriteRoomIds.Contains(room.RoomId))
                    score += 50f;

                // Boost rooms matching player's history categories
                foreach (RoomHistoryEntry history in _roomHistory)
                {
                    if (history.RoomId == room.RoomId)
                    {
                        score += 20f;
                        break;
                    }
                }

                // Boost official rooms slightly
                if (room.IsOfficial)
                    score += 5f;

                // Penalize full rooms
                if (room.CurrentPlayers >= room.MaxPlayers)
                    score -= 30f;

                scored.Add((room, score));
            }

            scored = scored.OrderByDescending(s => s.score).ToList();
            return scored.Select(s => s.room).ToList();
        }

        /// <summary>
        /// Gets the top N trending rooms by <see cref="RoomInfo.TrendingScore"/>.
        /// </summary>
        /// <param name="count">Maximum number of rooms to return. Default is 10.</param>
        public List<RoomInfo> GetTrendingRooms(int count = 10)
        {
            return AllRooms
                .OrderByDescending(r => r.TrendingScore)
                .Take(count)
                .ToList();
        }

        /// <summary>
        /// Gets the most recently created rooms.
        /// </summary>
        /// <param name="count">Maximum number of rooms to return. Default is 10.</param>
        public List<RoomInfo> GetNewRooms(int count = 10)
        {
            return AllRooms
                .OrderByDescending(r => r.CreatedDate)
                .Take(count)
                .ToList();
        }

        /// <summary>
        /// Gets rooms that currently have friends inside.
        /// </summary>
        public List<RoomInfo> GetFriendRooms()
        {
            return AllRooms
                .Where(r => r.FriendIdsInside != null && r.FriendIdsInside.Count > 0)
                .OrderByDescending(r => r.FriendIdsInside.Count)
                .ToList();
        }

        /// <summary>
        /// Gets official rooms curated by the game administrators.
        /// </summary>
        public List<RoomInfo> GetOfficialRooms()
        {
            return AllRooms
                .Where(r => r.IsOfficial)
                .OrderByDescending(r => r.TrendingScore)
                .ToList();
        }

        /// <summary>
        /// Gets rooms currently marked as active events.
        /// </summary>
        public List<RoomInfo> GetEventRooms()
        {
            return AllRooms
                .Where(r => r.IsEvent)
                .OrderByDescending(r => r.TrendingScore)
                .ToList();
        }

        #endregion

        #region Favorites

        /// <summary>
        /// Adds a room to the player's favorites.
        /// </summary>
        /// <param name="roomId">The room ID to favorite.</param>
        public void AddToFavorites(string roomId)
        {
            if (string.IsNullOrEmpty(roomId))
                return;

            if (_favoriteRoomIds.Contains(roomId))
                return;

            if (_favoriteRoomIds.Count >= MaxFavorites)
            {
                Debug.LogWarning($"[RoomBrowser] Favorite limit reached ({MaxFavorites}).");
                return;
            }

            _favoriteRoomIds.Add(roomId);
            SaveFavorites();
            OnFavoriteAdded?.Invoke(roomId);

            EventBus.Publish(new RoomFavoritedEvent { RoomId = roomId });
        }

        /// <summary>
        /// Removes a room from the player's favorites.
        /// </summary>
        /// <param name="roomId">The room ID to remove.</param>
        public void RemoveFromFavorites(string roomId)
        {
            if (string.IsNullOrEmpty(roomId))
                return;

            if (!_favoriteRoomIds.Remove(roomId))
                return;

            SaveFavorites();
            OnFavoriteRemoved?.Invoke(roomId);

            EventBus.Publish(new RoomUnfavoritedEvent { RoomId = roomId });
        }

        /// <summary>
        /// Checks whether a room is in the player's favorites.
        /// </summary>
        /// <param name="roomId">The room ID to check.</param>
        public bool IsFavorite(string roomId)
        {
            return !string.IsNullOrEmpty(roomId) && _favoriteRoomIds.Contains(roomId);
        }

        /// <summary>
        /// Returns a list of all favorited room IDs.
        /// </summary>
        public List<string> GetFavoriteRooms()
        {
            return new List<string>(_favoriteRoomIds);
        }

        /// <summary>
        /// Returns full <see cref="RoomInfo"/> objects for all favorited rooms.
        /// </summary>
        public List<RoomInfo> GetFavoriteRoomInfos()
        {
            return AllRooms.Where(r => _favoriteRoomIds.Contains(r.RoomId)).ToList();
        }

        #endregion

        #region History

        /// <summary>
        /// Records a room visit in the player's history.
        /// </summary>
        /// <param name="roomId">The visited room ID.</param>
        public void AddToHistory(string roomId)
        {
            if (string.IsNullOrEmpty(roomId))
                return;

            RoomInfo room = AllRooms.FirstOrDefault(r => r.RoomId == roomId);
            string roomName = room?.RoomName ?? "Unknown Room";

            RoomHistoryEntry existing = _roomHistory.FirstOrDefault(h => h.RoomId == roomId);
            if (existing != null)
            {
                existing.LastVisited = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                existing.VisitCount++;
                // Move to top
                _roomHistory.Remove(existing);
                _roomHistory.Insert(0, existing);
            }
            else
            {
                _roomHistory.Insert(0, new RoomHistoryEntry
                {
                    RoomId = roomId,
                    RoomName = roomName,
                    LastVisited = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                    VisitCount = 1
                });
            }

            while (_roomHistory.Count > MaxHistoryEntries)
                _roomHistory.RemoveAt(_roomHistory.Count - 1);

            SaveHistory();
        }

        /// <summary>
        /// Returns the player's room visit history.
        /// </summary>
        public List<RoomHistoryEntry> GetRoomHistory()
        {
            return new List<RoomHistoryEntry>(_roomHistory);
        }

        /// <summary>
        /// Clears the player's room visit history.
        /// </summary>
        public void ClearHistory()
        {
            _roomHistory.Clear();
            SaveHistory();
            EventBus.Publish(new RoomHistoryClearedEvent());
        }

        #endregion

        #region Server & Filter Pipeline

        /// <summary>
        /// Initiates an asynchronous fetch of the room list from the backend.
        /// </summary>
        private void FetchRoomsFromServer()
        {
            _lastFetchTimestamp = Time.time;

            PlayFabManager.Instance?.GetRoomList(
                onSuccess: (serverRooms) =>
                {
                    AllRooms = serverRooms ?? new List<RoomInfo>();
                    RecalculateTrendingScores();
                    ApplyAllFilters();
                    OnRoomsRefreshed?.Invoke();
                },
                onError: (error) =>
                {
                    Debug.LogError($"[RoomBrowser] Failed to fetch rooms: {error}");
                    EventBus.Publish(new RoomListFetchFailedEvent { Error = error });
                });
        }

        /// <summary>
        /// Applies all active filters, search, and sorting to <see cref="AllRooms"/>
        /// and stores the result in <see cref="FilteredRooms"/>.
        /// </summary>
        private void ApplyAllFilters()
        {
            var query = AllRooms.AsEnumerable();

            // Category filter
            if (ActiveCategory != RoomCategory.All)
            {
                if (ActiveCategory == RoomCategory.New)
                {
                    long cutoff = DateTimeOffset.UtcNow.AddDays(-7).ToUnixTimeSeconds();
                    query = query.Where(r => r.CreatedDate >= cutoff);
                }
                else
                {
                    query = query.Where(r => r.Category == ActiveCategory);
                }
            }

            // Search filter (name, owner, tags)
            if (!string.IsNullOrEmpty(SearchQuery))
            {
                string q = SearchQuery.ToLowerInvariant();
                query = query.Where(r =>
                    (r.RoomName != null && r.RoomName.ToLowerInvariant().Contains(q)) ||
                    (r.OwnerName != null && r.OwnerName.ToLowerInvariant().Contains(q)) ||
                    (r.Tags != null && r.Tags.Any(t => t != null && t.ToLowerInvariant().Contains(q)))
                );
            }

            // Friends only
            if (FriendsOnly)
            {
                query = query.Where(r => r.FriendIdsInside != null && r.FriendIdsInside.Count > 0);
            }

            // Has space
            if (HasSpaceOnly)
            {
                query = query.Where(r => r.CurrentPlayers < r.MaxPlayers);
            }

            // Sorting
            query = ActiveSort switch
            {
                RoomSort.Popular => query.OrderByDescending(r => r.CurrentPlayers).ThenByDescending(r => r.TotalVisits),
                RoomSort.Newest => query.OrderByDescending(r => r.CreatedDate),
                RoomSort.Trending => query.OrderByDescending(r => r.TrendingScore),
                RoomSort.MostVisited => query.OrderByDescending(r => r.TotalVisits),
                RoomSort.Alphabetical => query.OrderBy(r => r.RoomName),
                RoomSort.Friends => query.OrderByDescending(r => r.FriendIdsInside?.Count ?? 0),
                RoomSort.HasSpace => query.OrderByDescending(r => r.MaxPlayers - r.CurrentPlayers),
                _ => query.OrderByDescending(r => r.CurrentPlayers)
            };

            FilteredRooms = query.ToList();

            // Clamp current page
            if (CurrentPage >= TotalPages)
                CurrentPage = Mathf.Max(0, TotalPages - 1);
        }

        /// <summary>
        /// Recalculates trending scores for all rooms after a server refresh.
        /// </summary>
        private void RecalculateTrendingScores()
        {
            _trendingCache.Clear();
            foreach (RoomInfo room in AllRooms)
            {
                CalculateTrendingScore(room);
            }
        }

        /// <summary>
        /// Computes a trending score for a single room based on visits, player velocity,
        /// recency, and favorites.
        /// </summary>
        /// <param name="room">The room to score.</param>
        private void CalculateTrendingScore(RoomInfo room)
        {
            if (room == null)
                return;

            float score = 0f;

            // Base from total visits (logarithmic to avoid dominance)
            score += Mathf.Log10(Mathf.Max(1, room.TotalVisits)) * 5f;

            // Current players weight
            score += room.CurrentPlayers * 2f;

            // Recency boost for new rooms
            long ageSeconds = DateTimeOffset.UtcNow.ToUnixTimeSeconds() - room.CreatedDate;
            float ageDays = ageSeconds / 86400f;
            if (ageDays < 7f)
                score += (7f - ageDays) * 3f;

            // Favorite count boost
            score += room.FavoriteCount * 1.5f;

            // Official event boost
            if (room.IsEvent)
                score += 25f;

            room.TrendingScore = score;
            _trendingCache[room.RoomId] = score;
        }

        #endregion

        #region EventBus Handlers

        private void OnRoomListUpdated(RoomListUpdatedEvent evt)
        {
            RefreshRooms();
        }

        private void OnPlayerJoinedRoom(PlayerJoinedRoomEvent evt)
        {
            RoomInfo room = AllRooms.FirstOrDefault(r => r.RoomId == evt.RoomId);
            if (room != null)
            {
                room.CurrentPlayers = evt.NewPlayerCount;
                ApplyAllFilters();
                OnRoomsRefreshed?.Invoke();
            }
        }

        private void OnPlayerLeftRoom(PlayerLeftRoomEvent evt)
        {
            RoomInfo room = AllRooms.FirstOrDefault(r => r.RoomId == evt.RoomId);
            if (room != null)
            {
                room.CurrentPlayers = evt.NewPlayerCount;
                ApplyAllFilters();
                OnRoomsRefreshed?.Invoke();
            }
        }

        #endregion

        #region Persistence

        /// <summary>
        /// Loads favorites and history from PlayerPrefs.
        /// </summary>
        private void LoadPersistedData()
        {
            string favoritesJson = PlayerPrefs.GetString("RoomBrowser_Favorites", "[]");
            try
            {
                _favoriteRoomIds.Clear();
                _favoriteRoomIds.AddRange(JsonUtility.FromJson<RoomIdListWrapper>(favoritesJson)?.Ids ?? new List<string>());
            }
            catch
            {
                _favoriteRoomIds.Clear();
            }

            string historyJson = PlayerPrefs.GetString("RoomBrowser_History", "[]");
            try
            {
                _roomHistory.Clear();
                var wrapper = JsonUtility.FromJson<RoomHistoryWrapper>(historyJson);
                if (wrapper?.Entries != null)
                    _roomHistory.AddRange(wrapper.Entries);
            }
            catch
            {
                _roomHistory.Clear();
            }
        }

        /// <summary>
        /// Saves the favorite room IDs to PlayerPrefs.
        /// </summary>
        private void SaveFavorites()
        {
            var wrapper = new RoomIdListWrapper { Ids = new List<string>(_favoriteRoomIds) };
            PlayerPrefs.SetString("RoomBrowser_Favorites", JsonUtility.ToJson(wrapper));
            PlayerPrefs.Save();
        }

        /// <summary>
        /// Saves the room visit history to PlayerPrefs.
        /// </summary>
        private void SaveHistory()
        {
            var wrapper = new RoomHistoryWrapper { Entries = new List<RoomHistoryEntry>(_roomHistory) };
            PlayerPrefs.SetString("RoomBrowser_History", JsonUtility.ToJson(wrapper));
            PlayerPrefs.Save();
        }

        #endregion

        #region Utility Classes for JSON Serialization

        [System.Serializable]
        private class RoomIdListWrapper
        {
            public List<string> Ids = new();
        }

        [System.Serializable]
        private class RoomHistoryWrapper
        {
            public List<RoomHistoryEntry> Entries = new();
        }

        #endregion
    }

    #region Data Models

    /// <summary>
    /// Serializable data model representing a room listing.
    /// </summary>
    [System.Serializable]
    public class RoomInfo
    {
        /// <summary>Unique room identifier.</summary>
        public string RoomId;

        /// <summary>Display name of the room.</summary>
        public string RoomName;

        /// <summary>Short description shown in the browser.</summary>
        public string Description;

        /// <summary>PlayFab or backend user ID of the room owner.</summary>
        public string OwnerId;

        /// <summary>Display name of the room owner.</summary>
        public string OwnerName;

        /// <summary>Thumbnail sprite displayed in the browser grid.</summary>
        public Sprite Thumbnail;

        /// <summary>Category used for filtering.</summary>
        public RoomCategory Category;

        /// <summary>Gameplay type of the room.</summary>
        public RoomType Type;

        /// <summary>Number of players currently inside.</summary>
        public int CurrentPlayers;

        /// <summary>Maximum allowed players.</summary>
        public int MaxPlayers;

        /// <summary>Whether this is an official curated room.</summary>
        public bool IsOfficial;

        /// <summary>Whether this room is hosting an active event.</summary>
        public bool IsEvent;

        /// <summary>Whether the room is private (invite-only).</summary>
        public bool IsPrivate;

        /// <summary>Whether a password is required to enter.</summary>
        public bool HasPassword;

        /// <summary>Searchable tags.</summary>
        public List<string> Tags = new();

        /// <summary>Computed trending score.</summary>
        public float TrendingScore;

        /// <summary>Unix timestamp when the room was created.</summary>
        public long CreatedDate;

        /// <summary>Total lifetime visits.</summary>
        public int TotalVisits;

        /// <summary>Number of players who favorited this room.</summary>
        public int FavoriteCount;

        /// <summary>Minimum player level required to enter.</summary>
        public string RequiredLevel;

        /// <summary>List of friend IDs currently inside the room.</summary>
        public List<string> FriendIdsInside = new();
    }

    /// <summary>
    /// Categories used for filtering rooms in the browser.
    /// </summary>
    public enum RoomCategory
    {
        /// <summary>Show all rooms.</summary>
        All,
        /// <summary>Rooms focused on mini-games and competitive play.</summary>
        Games,
        /// <summary>Rooms focused on socializing and hanging out.</summary>
        Social,
        /// <summary>Relaxed, low-pressure environments.</summary>
        Chill,
        /// <summary>Player-created builder/designer spaces.</summary>
        Creative,
        /// <summary>Rooms with active scheduled events.</summary>
        Events,
        /// <summary>Official curated rooms.</summary>
        Official,
        /// <summary>Rooms focused on shopping and virtual goods.</summary>
        Shopping,
        /// <summary>Roleplay-oriented environments.</summary>
        Roleplay,
        /// <summary>Rooms created within the last 7 days.</summary>
        New
    }

    /// <summary>
    /// Sorting options for the room browser.
    /// </summary>
    public enum RoomSort
    {
        /// <summary>Sort by current player count and total visits.</summary>
        Popular,
        /// <summary>Sort by creation date (newest first).</summary>
        Newest,
        /// <summary>Sort by trending score.</summary>
        Trending,
        /// <summary>Sort by total lifetime visits.</summary>
        MostVisited,
        /// <summary>Sort alphabetically by room name.</summary>
        Alphabetical,
        /// <summary>Sort by number of friends inside.</summary>
        Friends,
        /// <summary>Sort by available capacity.</summary>
        HasSpace
    }

    /// <summary>
    /// A single entry in the player's room visit history.
    /// </summary>
    [System.Serializable]
    public class RoomHistoryEntry
    {
        /// <summary>Room identifier.</summary>
        public string RoomId;

        /// <summary>Cached room display name.</summary>
        public string RoomName;

        /// <summary>Unix timestamp of the last visit.</summary>
        public long LastVisited;

        /// <summary>Total number of times visited.</summary>
        public int VisitCount;
    }

    #endregion

    #region EventBus Events

    /// <summary>
    /// Published when the server room list is updated.
    /// </summary>
    public struct RoomListUpdatedEvent { }

    /// <summary>
    /// Published when a player joins a room.
    /// </summary>
    public struct PlayerJoinedRoomEvent
    {
        /// <summary>The room ID entered.</summary>
        public string RoomId;
        /// <summary>The new total player count.</summary>
        public int NewPlayerCount;
    }

    /// <summary>
    /// Published when a player leaves a room.
    /// </summary>
    public struct PlayerLeftRoomEvent
    {
        /// <summary>The room ID exited.</summary>
        public string RoomId;
        /// <summary>The new total player count.</summary>
        public int NewPlayerCount;
    }

    /// <summary>
    /// Published when the player requests to enter a room.
    /// </summary>
    public struct RoomEnterRequestedEvent
    {
        /// <summary>The target room info.</summary>
        public RoomInfo Room;
    }

    /// <summary>
    /// Published when the player opens the room creation panel.
    /// </summary>
    public struct RoomCreateRequestedEvent { }

    /// <summary>
    /// Published when the player requests to edit their room.
    /// </summary>
    public struct RoomEditRequestedEvent
    {
        /// <summary>The room ID to edit.</summary>
        public string RoomId;
    }

    /// <summary>
    /// Published when a room is added to favorites.
    /// </summary>
    public struct RoomFavoritedEvent
    {
        /// <summary>The favorited room ID.</summary>
        public string RoomId;
    }

    /// <summary>
    /// Published when a room is removed from favorites.
    /// </summary>
    public struct RoomUnfavoritedEvent
    {
        /// <summary>The unfavorited room ID.</summary>
        public string RoomId;
    }

    /// <summary>
    /// Published when room history is cleared.
    /// </summary>
    public struct RoomHistoryClearedEvent { }

    /// <summary>
    /// Published when the room list fetch fails.
    /// </summary>
    public struct RoomListFetchFailedEvent
    {
        /// <summary>Error description.</summary>
        public string Error;
    }

    #endregion
}
