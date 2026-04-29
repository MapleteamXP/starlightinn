using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace KawaiiCoolIsland.Rooms
{
    /// <summary>
    /// UI-driven room search panel for KawaiiCool Island v2.0.
    /// Supports searching by name, owner, and tags with advanced filter controls.
    /// Integrates with <see cref="RoomBrowser"/> for result display.
    /// </summary>
    public class RoomSearch : MonoBehaviour
    {
        #region Search UI

        [Header("Search")]
        /// <summary>Input field for the player's search query.</summary>
        public TMP_InputField SearchInput;

        /// <summary>Dropdown selecting the search field (Name, Owner, Tag, All).</summary>
        public TMP_Dropdown SearchTypeDropdown;

        /// <summary>Parent transform for search result items.</summary>
        public Transform ResultsContainer;

        /// <summary>Prefab instantiated for each search result.</summary>
        public GameObject ResultPrefab;

        /// <summary>Button that triggers the search.</summary>
        public Button SearchButton;

        #endregion

        #region Filters UI

        [Header("Filters")]
        /// <summary>When true, only show official rooms.</summary>
        public Toggle OfficialOnlyToggle;

        /// <summary>When true, only show rooms with available capacity.</summary>
        public Toggle HasSpaceToggle;

        /// <summary>Minimum current player count filter.</summary>
        public Slider MinPlayerCountSlider;

        /// <summary>Dropdown for category filtering.</summary>
        public TMP_Dropdown CategoryDropdown;

        #endregion

        #region Advanced Filters

        [Header("Advanced Filters")]
        /// <summary>Root GameObject for the advanced filters panel.</summary>
        public GameObject AdvancedFiltersPanel;

        /// <summary>Toggle for showing/hiding event-only rooms.</summary>
        public Toggle EventsOnlyToggle;

        /// <summary>Toggle for friends-only results.</summary>
        public Toggle FriendsOnlyToggle;

        /// <summary>Minimum trending score slider.</summary>
        public Slider MinTrendingScoreSlider;

        /// <summary>Button to clear all filters and search.</summary>
        public Button ClearFiltersButton;

        #endregion

        #region Internal State

        /// <summary>Currently displayed search results.</summary>
        private List<RoomInfo> _currentResults = new();

        /// <summary>Currently active search query.</summary>
        private string _activeQuery = "";

        /// <summary>Whether the advanced panel is visible.</summary>
        private bool _advancedVisible = false;

        /// <summary>Pool of instantiated result items for reuse.</summary>
        private readonly List<GameObject> _resultPool = new();

        #endregion

        #region Events

        /// <summary>Raised when search results change.</summary>
        public event Action<List<RoomInfo>> OnResultsChanged;

        /// <summary>Raised when a room is selected from search results.</summary>
        public event Action<RoomInfo> OnRoomSelected;

        #endregion

        #region Unity Lifecycle

        private void Start()
        {
            SetupUIListeners();
            HideAdvancedFilters();

            if (AdvancedFiltersPanel != null)
                AdvancedFiltersPanel.SetActive(false);
        }

        private void OnEnable()
        {
            EventBus.Subscribe<RoomListUpdatedEvent>(OnRoomListUpdated);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<RoomListUpdatedEvent>(OnRoomListUpdated);
        }

        #endregion

        #region UI Setup

        /// <summary>
        /// Binds UI controls to their respective action methods.
        /// </summary>
        private void SetupUIListeners()
        {
            if (SearchButton != null)
            {
                SearchButton.onClick.RemoveAllListeners();
                SearchButton.onClick.AddListener(() => Search(SearchInput?.text ?? ""));
            }

            if (SearchInput != null)
            {
                SearchInput.onEndEdit.RemoveAllListeners();
                SearchInput.onEndEdit.AddListener((text) =>
                {
                    if (Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.KeypadEnter))
                        Search(text);
                });

                // Live search debounce could be added here
            }

            if (SearchTypeDropdown != null)
            {
                SearchTypeDropdown.onValueChanged.RemoveAllListeners();
                SearchTypeDropdown.onValueChanged.AddListener((_) =>
                {
                    if (!string.IsNullOrEmpty(_activeQuery))
                        Search(_activeQuery);
                });
            }

            if (OfficialOnlyToggle != null)
            {
                OfficialOnlyToggle.onValueChanged.RemoveAllListeners();
                OfficialOnlyToggle.onValueChanged.AddListener((_) =>
                {
                    if (!string.IsNullOrEmpty(_activeQuery))
                        Search(_activeQuery);
                });
            }

            if (HasSpaceToggle != null)
            {
                HasSpaceToggle.onValueChanged.RemoveAllListeners();
                HasSpaceToggle.onValueChanged.AddListener((_) =>
                {
                    if (!string.IsNullOrEmpty(_activeQuery))
                        Search(_activeQuery);
                });
            }

            if (MinPlayerCountSlider != null)
            {
                MinPlayerCountSlider.onValueChanged.RemoveAllListeners();
                MinPlayerCountSlider.onValueChanged.AddListener((_) =>
                {
                    if (!string.IsNullOrEmpty(_activeQuery))
                        Search(_activeQuery);
                });
            }

            if (CategoryDropdown != null)
            {
                CategoryDropdown.onValueChanged.RemoveAllListeners();
                CategoryDropdown.onValueChanged.AddListener((_) =>
                {
                    if (!string.IsNullOrEmpty(_activeQuery))
                        Search(_activeQuery);
                });
            }

            if (ClearFiltersButton != null)
            {
                ClearFiltersButton.onClick.RemoveAllListeners();
                ClearFiltersButton.onClick.AddListener(ClearSearch);
            }
        }

        #endregion

        #region Search Operations

        /// <summary>
        /// Performs a search by the given query, applying active filters.
        /// </summary>
        /// <param name="query">The search string.</param>
        public void Search(string query)
        {
            _activeQuery = query?.Trim() ?? "";

            if (string.IsNullOrEmpty(_activeQuery))
            {
                // No query: apply filters to all rooms
                _currentResults = PerformFilteredQuery(RoomBrowser.Instance?.AllRooms ?? new List<RoomInfo>());
            }
            else
            {
                _currentResults = PerformSearch(_activeQuery);
            }

            DisplayResults(_currentResults);
            OnResultsChanged?.Invoke(_currentResults);
        }

        /// <summary>
        /// Searches for rooms owned by a specific player.
        /// </summary>
        /// <param name="ownerName">The owner display name.</param>
        public void SearchByOwner(string ownerName)
        {
            if (string.IsNullOrEmpty(ownerName))
            {
                ClearSearch();
                return;
            }

            _activeQuery = ownerName;

            if (SearchInput != null)
                SearchInput.text = ownerName;

            if (SearchTypeDropdown != null)
                SearchTypeDropdown.value = 1; // Owner

            List<RoomInfo> results = (RoomBrowser.Instance?.AllRooms ?? new List<RoomInfo>())
                .Where(r => r.OwnerName != null &&
                            r.OwnerName.IndexOf(ownerName, System.StringComparison.OrdinalIgnoreCase) >= 0)
                .ToList();

            _currentResults = PerformFilteredQuery(results);
            DisplayResults(_currentResults);
            OnResultsChanged?.Invoke(_currentResults);
        }

        /// <summary>
        /// Searches for rooms that have a specific tag.
        /// </summary>
        /// <param name="tag">The tag to search for.</param>
        public void SearchByTag(string tag)
        {
            if (string.IsNullOrEmpty(tag))
            {
                ClearSearch();
                return;
            }

            _activeQuery = $"#{tag}";

            if (SearchInput != null)
                SearchInput.text = _activeQuery;

            if (SearchTypeDropdown != null)
                SearchTypeDropdown.value = 2; // Tag

            List<RoomInfo> results = (RoomBrowser.Instance?.AllRooms ?? new List<RoomInfo>())
                .Where(r => r.Tags != null &&
                            r.Tags.Any(t => t != null &&
                                            t.IndexOf(tag, System.StringComparison.OrdinalIgnoreCase) >= 0))
                .ToList();

            _currentResults = PerformFilteredQuery(results);
            DisplayResults(_currentResults);
            OnResultsChanged?.Invoke(_currentResults);
        }

        /// <summary>
        /// Clears the active search query and all filters, showing the full room list.
        /// </summary>
        public void ClearSearch()
        {
            _activeQuery = "";

            if (SearchInput != null)
                SearchInput.text = "";

            if (OfficialOnlyToggle != null)
                OfficialOnlyToggle.isOn = false;

            if (HasSpaceToggle != null)
                HasSpaceToggle.isOn = false;

            if (MinPlayerCountSlider != null)
                MinPlayerCountSlider.value = 0;

            if (CategoryDropdown != null)
                CategoryDropdown.value = 0;

            if (EventsOnlyToggle != null)
                EventsOnlyToggle.isOn = false;

            if (FriendsOnlyToggle != null)
                FriendsOnlyToggle.isOn = false;

            if (MinTrendingScoreSlider != null)
                MinTrendingScoreSlider.value = 0;

            _currentResults = PerformFilteredQuery(RoomBrowser.Instance?.AllRooms ?? new List<RoomInfo>());
            DisplayResults(_currentResults);
            OnResultsChanged?.Invoke(_currentResults);
        }

        /// <summary>
        /// Shows the advanced filters panel.
        /// </summary>
        public void ShowAdvancedFilters()
        {
            _advancedVisible = true;
            if (AdvancedFiltersPanel != null)
                AdvancedFiltersPanel.SetActive(true);
        }

        /// <summary>
        /// Hides the advanced filters panel.
        /// </summary>
        public void HideAdvancedFilters()
        {
            _advancedVisible = false;
            if (AdvancedFiltersPanel != null)
                AdvancedFiltersPanel.SetActive(false);
        }

        /// <summary>
        /// Toggles the advanced filters panel visibility.
        /// </summary>
        public void ToggleAdvancedFilters()
        {
            if (_advancedVisible)
                HideAdvancedFilters();
            else
                ShowAdvancedFilters();
        }

        #endregion

        #region Search & Filter Implementation

        /// <summary>
        /// Performs a text search on room names, owners, or tags based on the dropdown selection.
        /// </summary>
        private List<RoomInfo> PerformSearch(string query)
        {
            List<RoomInfo> source = RoomBrowser.Instance?.AllRooms ?? new List<RoomInfo>();
            int searchMode = SearchTypeDropdown?.value ?? 0;
            string q = query.ToLowerInvariant();

            IEnumerable<RoomInfo> filtered = source.Where(r =>
            {
                switch (searchMode)
                {
                    case 0: // All
                        return (r.RoomName != null && r.RoomName.ToLowerInvariant().Contains(q)) ||
                               (r.OwnerName != null && r.OwnerName.ToLowerInvariant().Contains(q)) ||
                               (r.Tags != null && r.Tags.Any(t => t != null && t.ToLowerInvariant().Contains(q)));
                    case 1: // Owner only
                        return r.OwnerName != null && r.OwnerName.ToLowerInvariant().Contains(q);
                    case 2: // Tag only
                        return r.Tags != null && r.Tags.Any(t => t != null && t.ToLowerInvariant().Contains(q));
                    default:
                        return r.RoomName != null && r.RoomName.ToLowerInvariant().Contains(q);
                }
            });

            return PerformFilteredQuery(filtered.ToList());
        }

        /// <summary>
        /// Applies UI filter controls to a list of rooms.
        /// </summary>
        private List<RoomInfo> PerformFilteredQuery(List<RoomInfo> source)
        {
            IEnumerable<RoomInfo> query = source.AsEnumerable();

            if (OfficialOnlyToggle != null && OfficialOnlyToggle.isOn)
                query = query.Where(r => r.IsOfficial);

            if (HasSpaceToggle != null && HasSpaceToggle.isOn)
                query = query.Where(r => r.CurrentPlayers < r.MaxPlayers);

            if (MinPlayerCountSlider != null && MinPlayerCountSlider.value > 0)
            {
                int min = (int)MinPlayerCountSlider.value;
                query = query.Where(r => r.CurrentPlayers >= min);
            }

            if (CategoryDropdown != null && CategoryDropdown.value > 0)
            {
                RoomCategory cat = (RoomCategory)(CategoryDropdown.value - 1);
                if (cat == RoomCategory.New)
                {
                    long cutoff = DateTimeOffset.UtcNow.AddDays(-7).ToUnixTimeSeconds();
                    query = query.Where(r => r.CreatedDate >= cutoff);
                }
                else
                {
                    query = query.Where(r => r.Category == cat);
                }
            }

            if (_advancedVisible)
            {
                if (EventsOnlyToggle != null && EventsOnlyToggle.isOn)
                    query = query.Where(r => r.IsEvent);

                if (FriendsOnlyToggle != null && FriendsOnlyToggle.isOn)
                    query = query.Where(r => r.FriendIdsInside != null && r.FriendIdsInside.Count > 0);

                if (MinTrendingScoreSlider != null && MinTrendingScoreSlider.value > 0)
                {
                    float min = MinTrendingScoreSlider.value;
                    query = query.Where(r => r.TrendingScore >= min);
                }
            }

            // Default sort by relevance (trending score)
            return query.OrderByDescending(r => r.TrendingScore).ToList();
        }

        #endregion

        #region Results Display

        /// <summary>
        /// Instantiates or reuses result prefabs to display search results.
        /// </summary>
        private void DisplayResults(List<RoomInfo> results)
        {
            if (ResultsContainer == null || ResultPrefab == null)
                return;

            // Hide all existing
            foreach (GameObject go in _resultPool)
            {
                if (go != null)
                    go.SetActive(false);
            }

            for (int i = 0; i < results.Count; i++)
            {
                GameObject item;
                if (i < _resultPool.Count)
                {
                    item = _resultPool[i];
                    item.SetActive(true);
                }
                else
                {
                    item = Instantiate(ResultPrefab, ResultsContainer);
                    _resultPool.Add(item);
                }

                BindResultItem(item, results[i]);
            }
        }

        /// <summary>
        /// Binds a <see cref="RoomInfo"/> to an instantiated result item UI.
        /// </summary>
        private void BindResultItem(GameObject item, RoomInfo room)
        {
            // Expecting specific child components by name or using a small component
            TMP_Text nameLabel = item.transform.Find("NameLabel")?.GetComponent<TMP_Text>();
            if (nameLabel != null)
                nameLabel.text = room.RoomName;

            TMP_Text ownerLabel = item.transform.Find("OwnerLabel")?.GetComponent<TMP_Text>();
            if (ownerLabel != null)
                ownerLabel.text = $"by {room.OwnerName}";

            TMP_Text countLabel = item.transform.Find("CountLabel")?.GetComponent<TMP_Text>();
            if (countLabel != null)
                countLabel.text = $"{room.CurrentPlayers}/{room.MaxPlayers}";

            Image thumbImage = item.transform.Find("Thumbnail")?.GetComponent<Image>();
            if (thumbImage != null && room.Thumbnail != null)
                thumbImage.sprite = room.Thumbnail;

            Button btn = item.GetComponent<Button>();
            if (btn != null)
            {
                btn.onClick.RemoveAllListeners();
                btn.onClick.AddListener(() =>
                {
                    OnRoomSelected?.Invoke(room);
                    RoomBrowser.Instance?.EnterRoomByInfo(room);
                });
            }
        }

        #endregion

        #region EventBus Handlers

        private void OnRoomListUpdated(RoomListUpdatedEvent evt)
        {
            if (!string.IsNullOrEmpty(_activeQuery))
                Search(_activeQuery);
            else
                ClearSearch();
        }

        #endregion
    }
}
