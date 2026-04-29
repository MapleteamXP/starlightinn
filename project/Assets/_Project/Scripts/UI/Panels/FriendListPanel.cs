using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using KawaiiCoolIsland.Core;
using KawaiiCoolIsland.Core.Events;

namespace KawaiiCoolIsland.UI
{
    #region Enums

    /// <summary>
    /// Categories for filtering the friend list view.
    /// </summary>
    public enum FriendCategory
    {
        /// <summary>All friends regardless of status.</summary>
        All,
        /// <summary>Only friends currently online.</summary>
        Online,
        /// <summary>Only friends currently offline.</summary>
        Offline,
        /// <summary>Pending friend requests.</summary>
        Requests,
        /// <summary>Friends that have been blocked.</summary>
        Blocked,
        /// <summary>Close friends / best friends.</summary>
        CloseFriends
    }

    /// <summary>
    /// Sorting options for the friend list.
    /// </summary>
    public enum FriendSort
    {
        /// <summary>Alphabetical by display name.</summary>
        Name,
        /// <summary>Online status first, then alphabetical.</summary>
        OnlineStatus,
        /// <summary>Most recently played with first.</summary>
        RecentlyPlayed,
        /// <summary>Highest relationship level first.</summary>
        RelationshipLevel,
        /// <summary>Most recently added first.</summary>
        DateAdded
    }

    /// <summary>
    /// Presence status indicator for a friend.
    /// </summary>
    public enum PresenceStatus
    {
        /// <summary>Friend is offline.</summary>
        Offline,
        /// <summary>Friend is online and available.</summary>
        Online,
        /// <summary>Friend is online but busy.</summary>
        Busy,
        /// <summary>Friend is away from keyboard.</summary>
        Away,
        /// <summary>Friend is in a game or minigame.</summary>
        InGame
    }

    #endregion

    #region Data Models

    /// <summary>
    /// Immutable data holder for a friend's information displayed in the friend list.
    /// </summary>
    [System.Serializable]
    public class FriendInfo
    {
        /// <summary>Unique player identifier.</summary>
        public string PlayerId;
        /// <summary>Display name shown in UI.</summary>
        public string DisplayName;
        /// <summary>URL to the player's avatar image.</summary>
        public string AvatarUrl;
        /// <summary>Current online status.</summary>
        public PresenceStatus Status;
        /// <summary>Current room or location string.</summary>
        public string CurrentLocation;
        /// <summary>Relationship level (0-100).</summary>
        public int RelationshipLevel;
        /// <summary>Unix timestamp when friendship was established.</summary>
        public long DateAdded;
        /// <summary>Unix timestamp of last interaction.</summary>
        public long LastPlayedTogether;
        /// <summary>True if this friend is marked as a close friend.</summary>
        public bool IsCloseFriend;
        /// <summary>True if this player is blocked.</summary>
        public bool IsBlocked;
    }

    /// <summary>
    /// Immutable data holder for a pending friend request.
    /// </summary>
    [System.Serializable]
    public class FriendRequestInfo
    {
        /// <summary>Unique request identifier.</summary>
        public string RequestId;
        /// <summary>Player ID of the request sender.</summary>
        public string SenderId;
        /// <summary>Display name of the request sender.</summary>
        public string SenderName;
        /// <summary>Avatar URL of the request sender.</summary>
        public string SenderAvatarUrl;
        /// <summary>Unix timestamp when the request was sent.</summary>
        public long SentAt;
    }

    #endregion

    /// <summary>
    /// Friend list panel for KawaiiCool Island. Displays friends with presence indicators,
    /// supports search, category filtering, sorting, and friend request management.
    /// Integrates with <see cref="EventBus"/> for real-time presence updates.
    /// </summary>
    public class FriendListPanel : UIPanel
    {
        #region Inspector - Tabs
        [Header("Tabs")]
        [Tooltip("Toggle for viewing all friends.")]
        public Toggle AllFriendsTab;

        [Tooltip("Toggle for viewing online friends only.")]
        public Toggle OnlineTab;

        [Tooltip("Toggle for viewing pending friend requests.")]
        public Toggle RequestsTab;

        [Tooltip("Toggle for viewing blocked players.")]
        public Toggle BlockedTab;
        #endregion

        #region Inspector - Friend List
        [Header("Friend List")]
        [Tooltip("Container Transform that holds instantiated friend items.")]
        public Transform FriendListContainer;

        [Tooltip("Prefab used to create each friend list entry.")]
        public GameObject FriendItemPrefab;

        [Tooltip("Input field for filtering friends by name.")]
        public TMP_InputField SearchInput;

        [Tooltip("Dropdown for selecting the sort order.")]
        public TMP_Dropdown SortDropdown;
        #endregion

        #region Inspector - Friend Item UI
        [Header("Friend Item UI")]
        [Tooltip("Avatar image component on the friend item template.")]
        public Image AvatarImage;

        [Tooltip("Name text component on the friend item template.")]
        public TMP_Text NameText;

        [Tooltip("Status dot image (green/gray) on the friend item template.")]
        public Image StatusDot;

        [Tooltip("Status label text on the friend item template.")]
        public TMP_Text StatusText;

        [Tooltip("Location text showing where the friend currently is.")]
        public TMP_Text LocationText;

        [Tooltip("Button to start a private message with this friend.")]
        public Button MessageButton;

        [Tooltip("Button to visit the friend's current room/island.")]
        public Button VisitButton;

        [Tooltip("Button to open additional options (block, unfriend, etc.).")]
        public Button MoreButton;
        #endregion

        #region Inspector - Requests
        [Header("Requests")]
        [Tooltip("Container Transform that holds instantiated request items.")]
        public Transform RequestsContainer;

        [Tooltip("Prefab used to create each friend request entry.")]
        public GameObject RequestItemPrefab;

        [Tooltip("Badge text showing the count of pending requests.")]
        public TMP_Text RequestCountBadge;
        #endregion

        #region Inspector - Empty States
        [Header("Empty States")]
        [Tooltip("Panel shown when the current category has no entries.")]
        public GameObject EmptyStatePanel;

        [Tooltip("Text explaining why the list is empty.")]
        public TMP_Text EmptyStateText;

        [Tooltip("Button to navigate to the find-friends flow.")]
        public Button FindFriendsButton;
        #endregion

        #region State
        private readonly List<FriendInfo> _allFriends = new();
        private readonly List<FriendInfo> _displayedFriends = new();
        private readonly List<FriendRequestInfo> _pendingRequests = new();
        private FriendCategory _currentCategory = FriendCategory.All;
        private FriendSort _currentSort = FriendSort.Name;
        private string _currentSearchQuery = string.Empty;
        private readonly Dictionary<string, GameObject> _friendItemMap = new();
        private readonly Dictionary<string, GameObject> _requestItemMap = new();
        #endregion

        #region Events
        /// <summary>
        /// Fired when a friend list item is selected (clicked).
        /// </summary>
        public event Action<string> OnFriendSelected;

        /// <summary>
        /// Fired when the message button is pressed on a friend item.
        /// </summary>
        public event Action<string> OnMessageFriendRequested;

        /// <summary>
        /// Fired when the visit button is pressed on a friend item.
        /// </summary>
        public event Action<string> OnVisitFriendRequested;

        /// <summary>
        /// Fired when a friend request is accepted.
        /// </summary>
        public event Action<string> OnFriendRequestAccepted;

        /// <summary>
        /// Fired when a friend request is declined.
        /// </summary>
        public event Action<string> OnFriendRequestDeclined;
        #endregion

        #region Unity Lifecycle
        protected override void Awake()
        {
            base.Awake();
            WireEventListeners();
        }

        private void OnEnable()
        {
            EventBus.Instance?.Subscribe<FriendStatusChangedEvent>(OnFriendStatusChanged);
            EventBus.Instance?.Subscribe<FriendRequestEvent>(OnFriendRequestReceived);
        }

        private void OnDisable()
        {
            EventBus.Instance?.Unsubscribe<FriendStatusChangedEvent>(OnFriendStatusChanged);
            EventBus.Instance?.Unsubscribe<FriendRequestEvent>(OnFriendRequestReceived);
        }
        #endregion

        #region EventBus Handlers
        /// <summary>
        /// Handles real-time friend status changes from the event bus.
        /// </summary>
        private void OnFriendStatusChanged(FriendStatusChangedEvent evt)
        {
            var friend = _allFriends.FirstOrDefault(f => f.PlayerId == evt.FriendId);
            if (friend == null) return;

            friend.Status = evt.IsOnline ? PresenceStatus.Online : PresenceStatus.Offline;
            friend.CurrentLocation = evt.CurrentLocation ?? string.Empty;

            if (_friendItemMap.TryGetValue(evt.FriendId, out var item))
            {
                UpdateFriendItemUI(item, friend);
            }

            // Refresh list if category filter would affect visibility
            if (_currentCategory == FriendCategory.Online || _currentCategory == FriendCategory.Offline)
            {
                RefreshFriendList();
            }
        }

        /// <summary>
        /// Handles incoming friend request events.
        /// </summary>
        private void OnFriendRequestReceived(FriendRequestEvent evt)
        {
            var request = new FriendRequestInfo
            {
                RequestId = Guid.NewGuid().ToString(),
                SenderId = evt.SenderId,
                SenderName = evt.SenderName,
                SentAt = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
            };
            _pendingRequests.Add(request);
            RefreshRequestBadge();

            if (_currentCategory == FriendCategory.Requests)
            {
                PopulateRequests();
            }
        }
        #endregion

        #region Public API
        /// <summary>
        /// Called when the panel is about to be shown. Populates friend data and refreshes UI.
        /// </summary>
        public override void OnPanelShow()
        {
            base.OnPanelShow();
            LoadFriendData();
            RefreshFriendList();
            RefreshRequestBadge();
            UpdateEmptyState();
        }

        /// <summary>
        /// Refreshes the friend list from the data source and reapplies filters/sort.
        /// </summary>
        public void RefreshFriendList()
        {
            ApplyCategoryFilter();
            ApplySearchFilter();
            ApplySorting();
            PopulateFriendList();
            UpdateEmptyState();
        }

        /// <summary>
        /// Filters the friend list by a search query (name contains).
        /// </summary>
        /// <param name="searchQuery">The search string to filter by.</param>
        public void FilterFriends(string searchQuery)
        {
            _currentSearchQuery = searchQuery?.ToLowerInvariant() ?? string.Empty;
            RefreshFriendList();
        }

        /// <summary>
        /// Sorts the displayed friends using the specified sort mode.
        /// </summary>
        /// <param name="sort">The sort criteria to apply.</param>
        public void SortFriends(FriendSort sort)
        {
            _currentSort = sort;
            RefreshFriendList();
        }

        /// <summary>
        /// Switches the visible friend category and refreshes the list.
        /// </summary>
        /// <param name="category">The category to display.</param>
        public void ShowCategory(FriendCategory category)
        {
            _currentCategory = category;
            RefreshFriendList();
        }

        /// <summary>
        /// Called when a friend item is clicked. Opens profile or context menu.
        /// </summary>
        /// <param name="playerId">The unique identifier of the clicked friend.</param>
        public void OnFriendItemClicked(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return;
            OnFriendSelected?.Invoke(playerId);
            UIManager.Instance?.ShowPanel("ProfilePanel", true, true);
        }

        /// <summary>
        /// Called when the message button is clicked on a friend item.
        /// </summary>
        /// <param name="playerId">The friend's player ID.</param>
        public void OnMessageClicked(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return;
            OnMessageFriendRequested?.Invoke(playerId);
            UIManager.Instance?.ShowPanel("ChatUI", true, true);
        }

        /// <summary>
        /// Called when the visit room button is clicked on a friend item.
        /// </summary>
        /// <param name="playerId">The friend's player ID.</param>
        public void OnVisitRoomClicked(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return;
            OnVisitFriendRequested?.Invoke(playerId);
            UIManager.Instance?.ShowToast($"Visiting friend's room...", ToastType.Info, 2f);
        }

        /// <summary>
        /// Accepts a pending friend request.
        /// </summary>
        /// <param name="requestId">The unique request identifier.</param>
        public void OnAcceptRequest(string requestId)
        {
            var request = _pendingRequests.FirstOrDefault(r => r.RequestId == requestId);
            if (request == null) return;

            _pendingRequests.Remove(request);
            OnFriendRequestAccepted?.Invoke(request.SenderId);
            RefreshRequestBadge();
            PopulateRequests();
            UIManager.Instance?.ShowToast($"You are now friends with {request.SenderName}!", ToastType.Success, 3f);
        }

        /// <summary>
        /// Declines and removes a pending friend request.
        /// </summary>
        /// <param name="requestId">The unique request identifier.</param>
        public void OnDeclineRequest(string requestId)
        {
            var request = _pendingRequests.FirstOrDefault(r => r.RequestId == requestId);
            if (request == null) return;

            _pendingRequests.Remove(request);
            OnFriendRequestDeclined?.Invoke(request.SenderId);
            RefreshRequestBadge();
            PopulateRequests();
        }

        /// <summary>
        /// Blocks a player and refreshes the list if viewing blocked category.
        /// </summary>
        /// <param name="playerId">The player ID to block.</param>
        public void OnBlockClicked(string playerId)
        {
            var friend = _allFriends.FirstOrDefault(f => f.PlayerId == playerId);
            if (friend == null) return;

            friend.IsBlocked = true;
            RefreshFriendList();
            UIManager.Instance?.ShowToast($"{friend.DisplayName} has been blocked.", ToastType.Warning, 3f);
        }

        /// <summary>
        /// Unblocks a previously blocked player.
        /// </summary>
        /// <param name="playerId">The player ID to unblock.</param>
        public void OnUnblockClicked(string playerId)
        {
            var friend = _allFriends.FirstOrDefault(f => f.PlayerId == playerId);
            if (friend == null) return;

            friend.IsBlocked = false;
            RefreshFriendList();
            UIManager.Instance?.ShowToast($"{friend.DisplayName} has been unblocked.", ToastType.Success, 2f);
        }

        /// <summary>
        /// Called when the device type changes. Adjusts layout for mobile vs desktop.
        /// </summary>
        /// <param name="deviceType">The new device type.</param>
        public override void OnDeviceTypeChanged(DeviceType deviceType)
        {
            base.OnDeviceTypeChanged(deviceType);

            if (FriendListContainer == null) return;

            var grid = FriendListContainer.GetComponent<GridLayoutGroup>();
            if (grid != null)
            {
                if (deviceType == DeviceType.Mobile)
                {
                    grid.cellSize = new Vector2(600f, 120f);
                    grid.constraintCount = 1;
                }
                else
                {
                    grid.cellSize = new Vector2(400f, 100f);
                    grid.constraintCount = 2;
                }
            }
        }
        #endregion

        #region Private Implementation
        /// <summary>
        /// Wires UI event listeners (tabs, search, sort, buttons).
        /// </summary>
        private void WireEventListeners()
        {
            if (AllFriendsTab != null)
                AllFriendsTab.onValueChanged.AddListener(isOn => { if (isOn) ShowCategory(FriendCategory.All); });
            if (OnlineTab != null)
                OnlineTab.onValueChanged.AddListener(isOn => { if (isOn) ShowCategory(FriendCategory.Online); });
            if (RequestsTab != null)
                RequestsTab.onValueChanged.AddListener(isOn => { if (isOn) ShowCategory(FriendCategory.Requests); });
            if (BlockedTab != null)
                BlockedTab.onValueChanged.AddListener(isOn => { if (isOn) ShowCategory(FriendCategory.Blocked); });

            if (SearchInput != null)
            {
                SearchInput.onValueChanged.AddListener(query => FilterFriends(query));
                SearchInput.onEndEdit.AddListener(query => FilterFriends(query));
            }

            if (SortDropdown != null)
                SortDropdown.onValueChanged.AddListener(index => SortFriends((FriendSort)index));

            if (FindFriendsButton != null)
                FindFriendsButton.onClick.AddListener(() => UIManager.Instance?.ShowPanel("RoomBrowserPanel", true, true));
        }

        /// <summary>
        /// Loads friend data from the backend or cache.
        /// </summary>
        private void LoadFriendData()
        {
            _allFriends.Clear();
            // TODO: Replace with actual API call to GameAPIClient
            // Simulated data for development / testing
            for (int i = 0; i < 12; i++)
            {
                _allFriends.Add(new FriendInfo
                {
                    PlayerId = $"player_{i}",
                    DisplayName = $"Player {i + 1}",
                    AvatarUrl = string.Empty,
                    Status = (i % 3 == 0) ? PresenceStatus.Online : PresenceStatus.Offline,
                    CurrentLocation = (i % 3 == 0) ? "Hub Island" : string.Empty,
                    RelationshipLevel = UnityEngine.Random.Range(0, 100),
                    DateAdded = DateTimeOffset.UtcNow.AddDays(-i * 7).ToUnixTimeSeconds(),
                    LastPlayedTogether = DateTimeOffset.UtcNow.AddDays(-i).ToUnixTimeSeconds(),
                    IsCloseFriend = i < 3,
                    IsBlocked = false
                });
            }
        }

        /// <summary>
        /// Applies the current category filter to <see cref="_displayedFriends"/>.
        /// </summary>
        private void ApplyCategoryFilter()
        {
            _displayedFriends.Clear();
            switch (_currentCategory)
            {
                case FriendCategory.All:
                    _displayedFriends.AddRange(_allFriends.Where(f => !f.IsBlocked));
                    break;
                case FriendCategory.Online:
                    _displayedFriends.AddRange(_allFriends.Where(f => f.Status != PresenceStatus.Offline && !f.IsBlocked));
                    break;
                case FriendCategory.Offline:
                    _displayedFriends.AddRange(_allFriends.Where(f => f.Status == PresenceStatus.Offline && !f.IsBlocked));
                    break;
                case FriendCategory.Requests:
                    // Requests are handled separately
                    break;
                case FriendCategory.Blocked:
                    _displayedFriends.AddRange(_allFriends.Where(f => f.IsBlocked));
                    break;
                case FriendCategory.CloseFriends:
                    _displayedFriends.AddRange(_allFriends.Where(f => f.IsCloseFriend && !f.IsBlocked));
                    break;
            }
        }

        /// <summary>
        /// Applies the current search query to the displayed friends.
        /// </summary>
        private void ApplySearchFilter()
        {
            if (string.IsNullOrWhiteSpace(_currentSearchQuery)) return;
            _displayedFriends.RemoveAll(f => !f.DisplayName.ToLowerInvariant().Contains(_currentSearchQuery));
        }

        /// <summary>
        /// Sorts <see cref="_displayedFriends"/> according to <see cref="_currentSort"/>.
        /// </summary>
        private void ApplySorting()
        {
            switch (_currentSort)
            {
                case FriendSort.Name:
                    _displayedFriends.Sort((a, b) => string.Compare(a.DisplayName, b.DisplayName, StringComparison.OrdinalIgnoreCase));
                    break;
                case FriendSort.OnlineStatus:
                    _displayedFriends.Sort((a, b) =>
                    {
                        int statusCompare = a.Status == PresenceStatus.Offline ? 1 : (b.Status == PresenceStatus.Offline ? -1 : 0);
                        return statusCompare != 0 ? statusCompare : string.Compare(a.DisplayName, b.DisplayName, StringComparison.OrdinalIgnoreCase);
                    });
                    break;
                case FriendSort.RecentlyPlayed:
                    _displayedFriends.Sort((a, b) => b.LastPlayedTogether.CompareTo(a.LastPlayedTogether));
                    break;
                case FriendSort.RelationshipLevel:
                    _displayedFriends.Sort((a, b) => b.RelationshipLevel.CompareTo(a.RelationshipLevel));
                    break;
                case FriendSort.DateAdded:
                    _displayedFriends.Sort((a, b) => b.DateAdded.CompareTo(a.DateAdded));
                    break;
            }
        }

        /// <summary>
        /// Instantiates and populates UI items for the current displayed friends.
        /// </summary>
        private void PopulateFriendList()
        {
            if (FriendListContainer == null || FriendItemPrefab == null) return;

            // Clear existing items efficiently
            foreach (var kvp in _friendItemMap)
            {
                if (kvp.Value != null)
                    Destroy(kvp.Value);
            }
            _friendItemMap.Clear();

            if (_currentCategory == FriendCategory.Requests)
            {
                PopulateRequests();
                return;
            }

            foreach (var friend in _displayedFriends)
            {
                var item = Instantiate(FriendItemPrefab, FriendListContainer, false);
                item.name = $"FriendItem_{friend.PlayerId}";
                SetupFriendItem(item, friend);
                _friendItemMap[friend.PlayerId] = item;
            }
        }

        /// <summary>
        /// Configures a single friend item GameObject with data and button bindings.
        /// </summary>
        private void SetupFriendItem(GameObject item, FriendInfo friend)
        {
            if (item == null || friend == null) return;

            var avatar = item.transform.Find("Avatar")?.GetComponent<Image>();
            var nameTxt = item.transform.Find("Name")?.GetComponent<TMP_Text>();
            var statusDot = item.transform.Find("StatusDot")?.GetComponent<Image>();
            var statusTxt = item.transform.Find("Status")?.GetComponent<TMP_Text>();
            var locationTxt = item.transform.Find("Location")?.GetComponent<TMP_Text>();
            var msgBtn = item.transform.Find("MessageButton")?.GetComponent<Button>();
            var visitBtn = item.transform.Find("VisitButton")?.GetComponent<Button>();
            var moreBtn = item.transform.Find("MoreButton")?.GetComponent<Button>();
            var mainBtn = item.GetComponent<Button>();

            if (nameTxt != null) nameTxt.text = friend.DisplayName;
            if (locationTxt != null) locationTxt.text = friend.CurrentLocation;
            if (statusTxt != null) statusTxt.text = GetStatusLabel(friend.Status);
            if (statusDot != null) statusDot.color = GetStatusColor(friend.Status);

            // Load avatar (placeholder if URL empty)
            if (avatar != null && !string.IsNullOrEmpty(friend.AvatarUrl))
            {
                // TODO: Use ImageLoader utility for async sprite loading
            }

            if (mainBtn != null)
            {
                string pid = friend.PlayerId;
                mainBtn.onClick.AddListener(() => OnFriendItemClicked(pid));
            }

            if (msgBtn != null)
            {
                string pid = friend.PlayerId;
                msgBtn.onClick.AddListener(() => OnMessageClicked(pid));
            }

            if (visitBtn != null)
            {
                string pid = friend.PlayerId;
                visitBtn.onClick.AddListener(() => OnVisitRoomClicked(pid));
            }

            if (moreBtn != null)
            {
                string pid = friend.PlayerId;
                moreBtn.onClick.AddListener(() => ShowFriendContextMenu(pid));
            }
        }

        /// <summary>
        /// Updates the UI of an existing friend item without full rebuild.
        /// </summary>
        private void UpdateFriendItemUI(GameObject item, FriendInfo friend)
        {
            if (item == null || friend == null) return;
            var statusDot = item.transform.Find("StatusDot")?.GetComponent<Image>();
            var statusTxt = item.transform.Find("Status")?.GetComponent<TMP_Text>();
            var locationTxt = item.transform.Find("Location")?.GetComponent<TMP_Text>();

            if (statusDot != null) statusDot.color = GetStatusColor(friend.Status);
            if (statusTxt != null) statusTxt.text = GetStatusLabel(friend.Status);
            if (locationTxt != null) locationTxt.text = friend.CurrentLocation;
        }

        /// <summary>
        /// Populates the friend request list when the Requests category is active.
        /// </summary>
        private void PopulateRequests()
        {
            if (RequestsContainer == null || RequestItemPrefab == null) return;

            foreach (var kvp in _requestItemMap)
            {
                if (kvp.Value != null)
                    Destroy(kvp.Value);
            }
            _requestItemMap.Clear();

            foreach (var request in _pendingRequests)
            {
                var item = Instantiate(RequestItemPrefab, RequestsContainer, false);
                item.name = $"RequestItem_{request.RequestId}";
                SetupRequestItem(item, request);
                _requestItemMap[request.RequestId] = item;
            }

            // Hide friend list while in requests view
            if (FriendListContainer != null)
                FriendListContainer.gameObject.SetActive(_currentCategory != FriendCategory.Requests);
            if (RequestsContainer != null)
                RequestsContainer.gameObject.SetActive(_currentCategory == FriendCategory.Requests);
        }

        /// <summary>
        /// Configures a single request item with accept/decline bindings.
        /// </summary>
        private void SetupRequestItem(GameObject item, FriendRequestInfo request)
        {
            if (item == null || request == null) return;

            var nameTxt = item.transform.Find("Name")?.GetComponent<TMP_Text>();
            var avatar = item.transform.Find("Avatar")?.GetComponent<Image>();
            var acceptBtn = item.transform.Find("AcceptButton")?.GetComponent<Button>();
            var declineBtn = item.transform.Find("DeclineButton")?.GetComponent<Button>();

            if (nameTxt != null) nameTxt.text = request.SenderName;
            if (avatar != null && !string.IsNullOrEmpty(request.SenderAvatarUrl))
            {
                // TODO: async avatar load
            }

            if (acceptBtn != null)
            {
                string rid = request.RequestId;
                acceptBtn.onClick.AddListener(() => OnAcceptRequest(rid));
            }
            if (declineBtn != null)
            {
                string rid = request.RequestId;
                declineBtn.onClick.AddListener(() => OnDeclineRequest(rid));
            }
        }

        /// <summary>
        /// Updates the request badge count text.
        /// </summary>
        private void RefreshRequestBadge()
        {
            if (RequestCountBadge == null) return;
            int count = _pendingRequests.Count;
            RequestCountBadge.text = count > 0 ? count.ToString() : string.Empty;
            RequestCountBadge.gameObject.SetActive(count > 0);
        }

        /// <summary>
        /// Updates presence dot color for a specific player.
        /// </summary>
        private void UpdatePresenceIndicator(string playerId, PresenceStatus status)
        {
            if (_friendItemMap.TryGetValue(playerId, out var item))
            {
                var dot = item?.transform.Find("StatusDot")?.GetComponent<Image>();
                if (dot != null) dot.color = GetStatusColor(status);
            }
        }

        /// <summary>
        /// Shows or hides the empty state panel based on displayed content.
        /// </summary>
        private void UpdateEmptyState()
        {
            if (EmptyStatePanel == null || EmptyStateText == null) return;

            bool isEmpty = _currentCategory == FriendCategory.Requests
                ? _pendingRequests.Count == 0
                : _displayedFriends.Count == 0;

            EmptyStatePanel.SetActive(isEmpty);

            if (isEmpty)
            {
                EmptyStateText.text = _currentCategory switch
                {
                    FriendCategory.All => "You don't have any friends yet. Go make some!",
                    FriendCategory.Online => "No friends are online right now.",
                    FriendCategory.Offline => "No offline friends? That's odd...",
                    FriendCategory.Requests => "No pending friend requests.",
                    FriendCategory.Blocked => "You haven't blocked anyone. Stay kind!",
                    FriendCategory.CloseFriends => "No close friends selected yet.",
                    _ => "Nothing to see here."
                };
            }
        }

        /// <summary>
        /// Opens a context menu for the selected friend (block, unfriend, etc.).
        /// </summary>
        private void ShowFriendContextMenu(string playerId)
        {
            var friend = _allFriends.FirstOrDefault(f => f.PlayerId == playerId);
            if (friend == null) return;

            string title = friend.IsBlocked ? "Unblock Player" : "Block Player";
            Action action = friend.IsBlocked
                ? () => OnUnblockClicked(playerId)
                : () => OnBlockClicked(playerId);

            UIManager.Instance?.ShowPopup(
                title,
                $"Are you sure you want to {(friend.IsBlocked ? "unblock" : "block")} {friend.DisplayName}?",
                PopupType.Confirm,
                onConfirm: action
            );
        }

        /// <summary>
        /// Returns a human-readable label for a presence status.
        /// </summary>
        private static string GetStatusLabel(PresenceStatus status)
        {
            return status switch
            {
                PresenceStatus.Online => "Online",
                PresenceStatus.Busy => "Busy",
                PresenceStatus.Away => "Away",
                PresenceStatus.InGame => "In Game",
                _ => "Offline"
            };
        }

        /// <summary>
        /// Returns the UI color associated with a presence status.
        /// </summary>
        private static Color GetStatusColor(PresenceStatus status)
        {
            return status switch
            {
                PresenceStatus.Online => new Color(0.3f, 0.9f, 0.3f),
                PresenceStatus.Busy => new Color(0.9f, 0.3f, 0.3f),
                PresenceStatus.Away => new Color(0.9f, 0.9f, 0.3f),
                PresenceStatus.InGame => new Color(0.3f, 0.6f, 0.9f),
                _ => new Color(0.5f, 0.5f, 0.5f)
            };
        }
        #endregion
    }
}
