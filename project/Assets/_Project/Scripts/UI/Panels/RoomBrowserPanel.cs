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
    /// Categories for filtering the room browser.
    /// </summary>
    public enum RoomCategory
    {
        /// <summary>All public rooms.</summary>
        All,
        /// <summary>Official game rooms.</summary>
        Official,
        /// <summary>Player-created rooms.</summary>
        PlayerMade,
        /// <summary>Rooms hosting events.</summary>
        Events,
        /// <summary>Roleplay-focused rooms.</summary>
        Roleplay,
        /// <summary>Minigame rooms.</summary>
        Minigames,
        /// <summary>Shopping/trade rooms.</summary>
        Shopping,
        /// <summary>Rooms currently trending.</summary>
        Trending,
        /// <summary>Rooms with friends inside.</summary>
        FriendsInside
    }

    /// <summary>
    /// Sorting options for the room browser.
    /// </summary>
    public enum RoomSort
    {
        /// <summary>Most players first.</summary>
        PlayerCount,
        /// <summary>Newest rooms first.</summary>
        Newest,
        /// <summary>Alphabetical by room name.</summary>
        Name,
        /// <summary>Most visited / popular first.</summary>
        Popular,
        /// <summary>Friends inside first.</summary>
        FriendsFirst
    }

    #endregion

    #region Data Models

    /// <summary>
    /// Immutable data holder for a room entry in the browser.
    /// </summary>
    [System.Serializable]
    public class RoomInfo
    {
        /// <summary>Unique room identifier.</summary>
        public string RoomId;
        /// <summary>Display name of the room.</summary>
        public string RoomName;
        /// <summary>Owner player ID.</summary>
        public string OwnerId;
        /// <summary>Owner display name.</summary>
        public string OwnerName;
        /// <summary>Thumbnail image URL.</summary>
        public string ThumbnailUrl;
        /// <summary>Current player count.</summary>
        public int PlayerCount;
        /// <summary>Maximum player capacity.</summary>
        public int MaxCapacity;
        /// <summary>True if this is an official server room.</summary>
        public bool IsOfficial;
        /// <summary>True if this room is currently hosting an event.</summary>
        public bool IsEvent;
        /// <summary>True if the room is private (invite-only).</summary>
        public bool IsPrivate;
        /// <summary>True if the room requires a password.</summary>
        public bool HasPassword;
        /// <summary>Number of friends currently inside.</summary>
        public int FriendsInsideCount;
        /// <summary>Room category for filtering.</summary>
        public RoomCategory Category;
        /// <summary>Unix timestamp when the room was created.</summary>
        public long CreatedAt;
        /// <summary>Total visits / popularity score.</summary>
        public int VisitCount;
        /// <summary>True if the local player has favorited this room.</summary>
        public bool IsFavorited;
    }

    #endregion

    /// <summary>
    /// Room discovery browser panel — the Habbo-style navigator for KawaiiCool Island.
    /// Supports category filtering, search, sorting, pagination, and quick navigation.
    /// </summary>
    public class RoomBrowserPanel : UIPanel
    {
        #region Inspector - Categories
        [Header("Categories")]
        [Tooltip("Container for category filter buttons.")]
        public Transform CategoryContainer;

        [Tooltip("Prefab for a category button.")]
        public GameObject CategoryButtonPrefab;

        [Tooltip("Currently selected room category filter.")]
        public RoomCategory SelectedCategory = RoomCategory.All;
        #endregion

        #region Inspector - Room List
        [Header("Room List")]
        [Tooltip("Container that holds instantiated room items.")]
        public Transform RoomListContainer;

        [Tooltip("Prefab for a room list entry.")]
        public GameObject RoomItemPrefab;

        [Tooltip("ScrollRect component for the room list.")]
        public ScrollRect RoomScrollRect;
        #endregion

        #region Inspector - Search
        [Header("Search")]
        [Tooltip("Input field for searching rooms by name or owner.")]
        public TMP_InputField SearchInput;

        [Tooltip("Button to execute the search.")]
        public Button SearchButton;

        [Tooltip("Button to clear the current search query.")]
        public Button ClearSearchButton;
        #endregion

        #region Inspector - Filters
        [Header("Filters")]
        [Tooltip("Toggle to only show rooms with available space.")]
        public Toggle HasSpaceToggle;

        [Tooltip("Toggle to only show rooms with friends inside.")]
        public Toggle FriendsInsideToggle;

        [Tooltip("Dropdown for selecting the room sort order.")]
        public TMP_Dropdown SortDropdown;
        #endregion

        #region Inspector - Room Item
        [Header("Room Item")]
        [Tooltip("Thumbnail image on the room item template.")]
        public Image RoomThumbnail;

        [Tooltip("Room name text on the item template.")]
        public TMP_Text RoomNameText;

        [Tooltip("Owner name text on the item template.")]
        public TMP_Text OwnerText;

        [Tooltip("Player count text on the item template.")]
        public TMP_Text PlayerCountText;

        [Tooltip("Official badge image (shown for official rooms).")]
        public Image OfficialBadge;

        [Tooltip("Event badge image (shown for event rooms).")]
        public Image EventBadge;

        [Tooltip("Private lock badge image (shown for private rooms).")]
        public Image PrivateBadge;

        [Tooltip("Button to enter the room.")]
        public Button EnterButton;

        [Tooltip("Button to favorite/unfavorite the room.")]
        public Button FavoriteButton;
        #endregion

        #region Inspector - Pagination
        [Header("Pagination")]
        [Tooltip("Button to navigate to the previous page.")]
        public Button PrevPageButton;

        [Tooltip("Button to navigate to the next page.")]
        public Button NextPageButton;

        [Tooltip("Text showing current page and total pages.")]
        public TMP_Text PageText;
        #endregion

        #region Inspector - Quick Nav
        [Header("Quick Nav")]
        [Tooltip("Button to go to the player's home room.")]
        public Button HomeButton;

        [Tooltip("Button to go to the main hub room.")]
        public Button HubButton;

        [Tooltip("Button to view recently visited rooms.")]
        public Button HistoryButton;

        [Tooltip("Button to view favorited rooms.")]
        public Button FavoritesButton;
        #endregion

        #region Inspector - Create
        [Header("Create")]
        [Tooltip("Button to open the room creation flow.")]
        public Button CreateRoomButton;
        #endregion

        #region State
        private readonly List<RoomInfo> _allRooms = new();
        private readonly List<RoomInfo> _filteredRooms = new();
        private readonly List<RoomInfo> _historyRooms = new();
        private readonly List<RoomInfo> _favoriteRooms = new();
        private readonly Dictionary<string, GameObject> _roomItemMap = new();
        private int _currentPage = 1;
        private int _roomsPerPage = 10;
        private string _currentSearchQuery = string.Empty;
        private RoomSort _currentSort = RoomSort.PlayerCount;
        private bool _showHistory;
        private bool _showFavorites;
        #endregion

        #region Events
        /// <summary>
        /// Fired when a room is selected for entry.
        /// </summary>
        public event Action<string> OnRoomSelected;

        /// <summary>
        /// Fired when the create room button is clicked.
        /// </summary>
        public event Action OnCreateRoomRequested;
        #endregion

        #region Unity Lifecycle
        protected override void Awake()
        {
            base.Awake();
            WireEventListeners();
        }

        private void OnEnable()
        {
            EventBus.Instance?.Subscribe<IslandEnvironmentChangedEvent>(OnEnvironmentChanged);
        }

        private void OnDisable()
        {
            EventBus.Instance?.Unsubscribe<IslandEnvironmentChangedEvent>(OnEnvironmentChanged);
        }
        #endregion

        #region EventBus Handlers
        /// <summary>
        /// Refreshes the room list when island environment changes (new events may appear).
        /// </summary>
        private void OnEnvironmentChanged(IslandEnvironmentChangedEvent evt)
        {
            if (IsVisible)
            {
                RefreshRooms();
            }
        }
        #endregion

        #region Public API
        /// <summary>
        /// Called when the panel is about to be shown. Loads room data and refreshes UI.
        /// </summary>
        public override void OnPanelShow()
        {
            base.OnPanelShow();
            LoadRoomData();
            PopulateCategories();
            RefreshRooms();
        }

        /// <summary>
        /// Refreshes the room list from the data source and reapplies filters/sort/pagination.
        /// </summary>
        public void RefreshRooms()
        {
            ApplyCategoryFilter();
            ApplySearchFilter();
            ApplyTogglesFilter();
            ApplySorting();
            UpdatePagination();
            PopulateRoomList();
        }

        /// <summary>
        /// Filters the room list by a specific category.
        /// </summary>
        /// <param name="category">The room category to filter by.</param>
        public void FilterByCategory(RoomCategory category)
        {
            SelectedCategory = category;
            _currentPage = 1;
            _showHistory = false;
            _showFavorites = false;
            RefreshRooms();
        }

        /// <summary>
        /// Searches rooms by the provided query string.
        /// </summary>
        /// <param name="query">Search text matched against room name and owner name.</param>
        public void OnSearch(string query)
        {
            _currentSearchQuery = query?.ToLowerInvariant() ?? string.Empty;
            _currentPage = 1;
            RefreshRooms();
        }

        /// <summary>
        /// Called when the sort dropdown selection changes.
        /// </summary>
        /// <param name="sortIndex">Index corresponding to <see cref="RoomSort"/>.</param>
        public void OnSortChanged(int sortIndex)
        {
            if (sortIndex >= 0 && sortIndex <= (int)RoomSort.FriendsFirst)
            {
                _currentSort = (RoomSort)sortIndex;
                RefreshRooms();
            }
        }

        /// <summary>
        /// Called when the enter room button is clicked on a room item.
        /// </summary>
        /// <param name="roomId">The unique room identifier.</param>
        public void OnEnterRoomClicked(string roomId)
        {
            if (string.IsNullOrEmpty(roomId)) return;
            OnRoomSelected?.Invoke(roomId);
            UIManager.Instance?.ShowToast("Joining room...", ToastType.Info, 2f);
            AddToHistory(roomId);
        }

        /// <summary>
        /// Toggles the favorite status of a room.
        /// </summary>
        /// <param name="roomId">The room to favorite/unfavorite.</param>
        public void OnFavoriteClicked(string roomId)
        {
            var room = _allRooms.FirstOrDefault(r => r.RoomId == roomId);
            if (room == null) return;

            room.IsFavorited = !room.IsFavorited;
            if (room.IsFavorited)
            {
                if (!_favoriteRooms.Any(r => r.RoomId == roomId))
                    _favoriteRooms.Add(room);
                UIManager.Instance?.ShowToast($"{room.RoomName} added to favorites!", ToastType.Success, 2f);
            }
            else
            {
                _favoriteRooms.RemoveAll(r => r.RoomId == roomId);
                UIManager.Instance?.ShowToast($"{room.RoomName} removed from favorites.", ToastType.Info, 2f);
            }

            RefreshRooms();
        }

        /// <summary>
        /// Navigates to a specific page in the paginated room list.
        /// </summary>
        /// <param name="page">1-based page number.</param>
        public void GoToPage(int page)
        {
            int maxPage = Mathf.Max(1, Mathf.CeilToInt((float)_filteredRooms.Count / _roomsPerPage));
            _currentPage = Mathf.Clamp(page, 1, maxPage);
            PopulateRoomList();
            UpdatePagination();
        }

        /// <summary>
        /// Called when the device type changes. Adjusts room item sizes for mobile vs desktop.
        /// </summary>
        /// <param name="deviceType">The new device type.</param>
        public override void OnDeviceTypeChanged(DeviceType deviceType)
        {
            base.OnDeviceTypeChanged(deviceType);
            if (RoomListContainer == null) return;

            var grid = RoomListContainer.GetComponent<GridLayoutGroup>();
            if (grid != null)
            {
                if (deviceType == DeviceType.Mobile)
                {
                    grid.cellSize = new Vector2(600f, 160f);
                    grid.constraintCount = 1;
                    _roomsPerPage = 5;
                }
                else
                {
                    grid.cellSize = new Vector2(500f, 140f);
                    grid.constraintCount = 1;
                    _roomsPerPage = 10;
                }
            }
            RefreshRooms();
        }
        #endregion

        #region Private Implementation
        /// <summary>
        /// Wires all UI event listeners.
        /// </summary>
        private void WireEventListeners()
        {
            if (SearchInput != null)
                SearchInput.onValueChanged.AddListener(query => OnSearch(query));
            if (SearchButton != null)
                SearchButton.onClick.AddListener(() => OnSearch(SearchInput?.text ?? string.Empty));
            if (ClearSearchButton != null)
                ClearSearchButton.onClick.AddListener(() =>
                {
                    if (SearchInput != null) SearchInput.text = string.Empty;
                    OnSearch(string.Empty);
                });

            if (HasSpaceToggle != null)
                HasSpaceToggle.onValueChanged.AddListener(_ => RefreshRooms());
            if (FriendsInsideToggle != null)
                FriendsInsideToggle.onValueChanged.AddListener(_ => RefreshRooms());
            if (SortDropdown != null)
                SortDropdown.onValueChanged.AddListener(index => OnSortChanged(index));

            if (PrevPageButton != null)
                PrevPageButton.onClick.AddListener(() => GoToPage(_currentPage - 1));
            if (NextPageButton != null)
                NextPageButton.onClick.AddListener(() => GoToPage(_currentPage + 1));

            if (HomeButton != null)
                HomeButton.onClick.AddListener(() => OnEnterRoomClicked("home_room"));
            if (HubButton != null)
                HubButton.onClick.AddListener(() => OnEnterRoomClicked("hub_room"));
            if (HistoryButton != null)
                HistoryButton.onClick.AddListener(() =>
                {
                    _showHistory = true;
                    _showFavorites = false;
                    SelectedCategory = RoomCategory.All;
                    _currentPage = 1;
                    RefreshRooms();
                });
            if (FavoritesButton != null)
                FavoritesButton.onClick.AddListener(() =>
                {
                    _showFavorites = true;
                    _showHistory = false;
                    SelectedCategory = RoomCategory.All;
                    _currentPage = 1;
                    RefreshRooms();
                });

            if (CreateRoomButton != null)
                CreateRoomButton.onClick.AddListener(() => OnCreateRoomRequested?.Invoke());
        }

        /// <summary>
        /// Loads room data from the backend or cache.
        /// </summary>
        private void LoadRoomData()
        {
            _allRooms.Clear();
            // TODO: Replace with actual API call
            var categories = new[] { RoomCategory.Official, RoomCategory.PlayerMade, RoomCategory.Events, RoomCategory.Roleplay, RoomCategory.Minigames, RoomCategory.Shopping };
            for (int i = 0; i < 40; i++)
            {
                _allRooms.Add(new RoomInfo
                {
                    RoomId = $"room_{i}",
                    RoomName = $"Room {i + 1}",
                    OwnerId = $"player_{i % 10}",
                    OwnerName = $"Owner {i % 10 + 1}",
                    ThumbnailUrl = string.Empty,
                    PlayerCount = UnityEngine.Random.Range(0, 25),
                    MaxCapacity = 25,
                    IsOfficial = i < 5,
                    IsEvent = i >= 10 && i < 15,
                    IsPrivate = i >= 35,
                    HasPassword = i >= 38,
                    FriendsInsideCount = UnityEngine.Random.Range(0, 4),
                    Category = categories[i % categories.Length],
                    CreatedAt = DateTimeOffset.UtcNow.AddDays(-i).ToUnixTimeSeconds(),
                    VisitCount = UnityEngine.Random.Range(50, 5000),
                    IsFavorited = false
                });
            }
        }

        /// <summary>
        /// Instantiates category filter buttons into the category container.
        /// </summary>
        private void PopulateCategories()
        {
            if (CategoryContainer == null || CategoryButtonPrefab == null) return;

            foreach (Transform child in CategoryContainer)
            {
                if (child != null) Destroy(child.gameObject);
            }

            foreach (RoomCategory category in Enum.GetValues(typeof(RoomCategory)))
            {
                var btn = Instantiate(CategoryButtonPrefab, CategoryContainer, false);
                var label = btn.transform.Find("Label")?.GetComponent<TMP_Text>();
                if (label != null) label.text = category.ToString();

                var toggle = btn.GetComponent<Toggle>();
                if (toggle != null)
                {
                    bool isSelected = category == SelectedCategory;
                    toggle.isOn = isSelected;
                    toggle.onValueChanged.AddListener(isOn =>
                    {
                        if (isOn) FilterByCategory(category);
                    });
                }
            }
        }

        /// <summary>
        /// Instantiates and populates room items for the current page.
        /// </summary>
        private void PopulateRoomList()
        {
            if (RoomListContainer == null || RoomItemPrefab == null) return;

            // Clear old items
            foreach (var kvp in _roomItemMap)
            {
                if (kvp.Value != null) Destroy(kvp.Value);
            }
            _roomItemMap.Clear();

            var sourceList = _showHistory ? _historyRooms : (_showFavorites ? _favoriteRooms : _filteredRooms);
            int startIndex = (_currentPage - 1) * _roomsPerPage;
            int endIndex = Mathf.Min(startIndex + _roomsPerPage, sourceList.Count);

            for (int i = startIndex; i < endIndex; i++)
            {
                var room = sourceList[i];
                var item = Instantiate(RoomItemPrefab, RoomListContainer, false);
                item.name = $"RoomItem_{room.RoomId}";
                SetupRoomItem(item, room);
                _roomItemMap[room.RoomId] = item;
            }

            // Reset scroll position
            if (RoomScrollRect != null)
                RoomScrollRect.normalizedPosition = new Vector2(0, 1);
        }

        /// <summary>
        /// Configures a single room item GameObject with data and button bindings.
        /// </summary>
        private void SetupRoomItem(GameObject item, RoomInfo room)
        {
            if (item == null || room == null) return;

            var nameTxt = item.transform.Find("Name")?.GetComponent<TMP_Text>();
            var ownerTxt = item.transform.Find("Owner")?.GetComponent<TMP_Text>();
            var countTxt = item.transform.Find("Count")?.GetComponent<TMP_Text>();
            var thumb = item.transform.Find("Thumbnail")?.GetComponent<Image>();
            var officialBadge = item.transform.Find("OfficialBadge")?.GetComponent<Image>();
            var eventBadge = item.transform.Find("EventBadge")?.GetComponent<Image>();
            var privateBadge = item.transform.Find("PrivateBadge")?.GetComponent<Image>();
            var enterBtn = item.transform.Find("EnterButton")?.GetComponent<Button>();
            var favBtn = item.transform.Find("FavoriteButton")?.GetComponent<Button>();
            var favIcon = item.transform.Find("FavoriteButton/Icon")?.GetComponent<Image>();

            if (nameTxt != null) nameTxt.text = room.RoomName;
            if (ownerTxt != null) ownerTxt.text = $"By {room.OwnerName}";
            if (countTxt != null) countTxt.text = $"{room.PlayerCount}/{room.MaxCapacity}";
            if (officialBadge != null) officialBadge.gameObject.SetActive(room.IsOfficial);
            if (eventBadge != null) eventBadge.gameObject.SetActive(room.IsEvent);
            if (privateBadge != null) privateBadge.gameObject.SetActive(room.IsPrivate);
            if (favIcon != null) favIcon.color = room.IsFavorited ? Color.yellow : Color.white;

            if (thumb != null && !string.IsNullOrEmpty(room.ThumbnailUrl))
            {
                // TODO: Async thumbnail load
            }

            if (enterBtn != null)
            {
                string rid = room.RoomId;
                enterBtn.interactable = room.PlayerCount < room.MaxCapacity && !room.HasPassword;
                enterBtn.onClick.AddListener(() => OnEnterRoomClicked(rid));
            }

            if (favBtn != null)
            {
                string rid = room.RoomId;
                favBtn.onClick.AddListener(() => OnFavoriteClicked(rid));
            }
        }

        /// <summary>
        /// Applies the selected category filter to the full room list.
        /// </summary>
        private void ApplyCategoryFilter()
        {
            if (SelectedCategory == RoomCategory.All)
            {
                _filteredRooms.Clear();
                _filteredRooms.AddRange(_allRooms);
                return;
            }

            _filteredRooms.Clear();
            foreach (var room in _allRooms)
            {
                if (room.Category == SelectedCategory)
                    _filteredRooms.Add(room);
                else if (SelectedCategory == RoomCategory.Trending && room.VisitCount > 1000)
                    _filteredRooms.Add(room);
                else if (SelectedCategory == RoomCategory.FriendsInside && room.FriendsInsideCount > 0)
                    _filteredRooms.Add(room);
            }
        }

        /// <summary>
        /// Applies the search query filter to the currently filtered rooms.
        /// </summary>
        private void ApplySearchFilter()
        {
            if (string.IsNullOrWhiteSpace(_currentSearchQuery)) return;
            _filteredRooms.RemoveAll(r =>
                !r.RoomName.ToLowerInvariant().Contains(_currentSearchQuery) &&
                !r.OwnerName.ToLowerInvariant().Contains(_currentSearchQuery));
        }

        /// <summary>
        /// Applies toggle-based filters (has space, friends inside) to the room list.
        /// </summary>
        private void ApplyTogglesFilter()
        {
            if (HasSpaceToggle != null && HasSpaceToggle.isOn)
                _filteredRooms.RemoveAll(r => r.PlayerCount >= r.MaxCapacity);

            if (FriendsInsideToggle != null && FriendsInsideToggle.isOn)
                _filteredRooms.RemoveAll(r => r.FriendsInsideCount == 0);
        }

        /// <summary>
        /// Sorts <see cref="_filteredRooms"/> according to <see cref="_currentSort"/>.
        /// </summary>
        private void ApplySorting()
        {
            switch (_currentSort)
            {
                case RoomSort.PlayerCount:
                    _filteredRooms.Sort((a, b) => b.PlayerCount.CompareTo(a.PlayerCount));
                    break;
                case RoomSort.Newest:
                    _filteredRooms.Sort((a, b) => b.CreatedAt.CompareTo(a.CreatedAt));
                    break;
                case RoomSort.Name:
                    _filteredRooms.Sort((a, b) => string.Compare(a.RoomName, b.RoomName, StringComparison.OrdinalIgnoreCase));
                    break;
                case RoomSort.Popular:
                    _filteredRooms.Sort((a, b) => b.VisitCount.CompareTo(a.VisitCount));
                    break;
                case RoomSort.FriendsFirst:
                    _filteredRooms.Sort((a, b) =>
                    {
                        int fa = a.FriendsInsideCount;
                        int fb = b.FriendsInsideCount;
                        return fb.CompareTo(fa);
                    });
                    break;
            }
        }

        /// <summary>
        /// Updates pagination button states and page label text.
        /// </summary>
        private void UpdatePagination()
        {
            int total = _showHistory ? _historyRooms.Count : (_showFavorites ? _favoriteRooms.Count : _filteredRooms.Count);
            int maxPage = Mathf.Max(1, Mathf.CeilToInt((float)total / _roomsPerPage));

            if (PageText != null)
                PageText.text = $"Page {_currentPage} / {maxPage}";

            if (PrevPageButton != null)
                PrevPageButton.interactable = _currentPage > 1;
            if (NextPageButton != null)
                NextPageButton.interactable = _currentPage < maxPage;
        }

        /// <summary>
        /// Adds a room to the recent history list, keeping the list capped.
        /// </summary>
        private void AddToHistory(string roomId)
        {
            var room = _allRooms.FirstOrDefault(r => r.RoomId == roomId);
            if (room == null) return;

            _historyRooms.RemoveAll(r => r.RoomId == roomId);
            _historyRooms.Insert(0, room);
            if (_historyRooms.Count > 20)
                _historyRooms.RemoveAt(_historyRooms.Count - 1);
        }
        #endregion
    }
}
