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
    #region Data Models

    /// <summary>
    /// Outfit data displayed in the profile outfits tab.
    /// </summary>
    [System.Serializable]
    public class OutfitInfo
    {
        /// <summary>Unique outfit identifier.</summary>
        public string OutfitId;
        /// <summary>Display name of the outfit.</summary>
        public string OutfitName;
        /// <summary>Thumbnail sprite or URL.</summary>
        public string ThumbnailUrl;
        /// <summary>Whether this is the currently equipped outfit.</summary>
        public bool IsEquipped;
    }

    /// <summary>
    /// Room data displayed in the profile rooms tab.
    /// </summary>
    [System.Serializable]
    public class ProfileRoomInfo
    {
        /// <summary>Unique room identifier.</summary>
        public string RoomId;
        /// <summary>Display name of the room.</summary>
        public string RoomName;
        /// <summary>Thumbnail image URL.</summary>
        public string ThumbnailUrl;
        /// <summary>Current player count inside the room.</summary>
        public int PlayerCount;
        /// <summary>Maximum capacity.</summary>
        public int MaxCapacity;
    }

    /// <summary>
    /// Badge/achievement data displayed in the profile badges tab.
    /// </summary>
    [System.Serializable]
    public class BadgeInfo
    {
        /// <summary>Unique badge identifier.</summary>
        public string BadgeId;
        /// <summary>Display name of the badge.</summary>
        public string BadgeName;
        /// <summary>Badge description / unlock criteria.</summary>
        public string Description;
        /// <summary>Icon sprite or URL.</summary>
        public string IconUrl;
        /// <summary>Whether the player has unlocked this badge.</summary>
        public bool IsUnlocked;
        /// <summary>Unix timestamp when unlocked.</summary>
        public long UnlockedAt;
    }

    /// <summary>
    /// Stat data displayed in the profile stats tab.
    /// </summary>
    [System.Serializable]
    public class PlayerStat
    {
        /// <summary>Stat category label.</summary>
        public string StatName;
        /// <summary>Current value.</summary>
        public int Value;
        /// <summary>Human-readable formatted value.</summary>
        public string FormattedValue;
    }

    #endregion

    /// <summary>
    /// Full profile viewer panel with tabbed sections: Profile, Outfits, Rooms, Stats, and Badges.
    /// Integrates with <see cref="EventBus"/> for real-time profile updates.
    /// </summary>
    public class ProfilePanel : UIPanel
    {
        #region Inspector - Header
        [Header("Header")]
        [Tooltip("Player avatar image in the profile header.")]
        public Image AvatarImage;

        [Tooltip("Player display name text.")]
        public TMP_Text NameText;

        [Tooltip("Player level text (e.g., 'Lv. 42').")]
        public TMP_Text LevelText;

        [Tooltip("Small status dot image next to the name.")]
        public Image StatusDot;

        [Tooltip("Status text label (Online, Offline, etc.).")]
        public TMP_Text StatusText;

        [Tooltip("Button to send a friend request (hidden if already friends or self).")]
        public Button AddFriendButton;

        [Tooltip("Button to open private message chat.")]
        public Button MessageButton;

        [Tooltip("Button to visit the player's current room.")]
        public Button VisitRoomButton;

        [Tooltip("Button to report the player.")]
        public Button ReportButton;

        [Tooltip("Button to block the player.")]
        public Button BlockButton;
        #endregion

        #region Inspector - Tabs
        [Header("Tabs")]
        [Tooltip("Toggle for the Profile (bio/info) tab.")]
        public Toggle ProfileTab;

        [Tooltip("Toggle for the Outfits tab.")]
        public Toggle OutfitsTab;

        [Tooltip("Toggle for the Rooms tab.")]
        public Toggle RoomsTab;

        [Tooltip("Toggle for the Stats tab.")]
        public Toggle StatsTab;

        [Tooltip("Toggle for the Badges tab.")]
        public Toggle BadgesTab;
        #endregion

        #region Inspector - Profile Tab
        [Header("Profile Tab")]
        [Tooltip("Player biography text.")]
        public TMP_Text BioText;

        [Tooltip("Account creation date text.")]
        public TMP_Text JoinDateText;

        [Tooltip("Total play time text.")]
        public TMP_Text PlayTimeText;

        [Tooltip("Number of friends text.")]
        public TMP_Text FriendsCountText;

        [Tooltip("Number of rooms owned text.")]
        public TMP_Text RoomsOwnedText;

        [Tooltip("Container for mutual friend avatars.")]
        public Transform MutualFriendsContainer;

        [Tooltip("Button to edit own profile (only visible for self).")]
        public Button EditProfileButton;
        #endregion

        #region Inspector - Outfits Tab
        [Header("Outfits Tab")]
        [Tooltip("Grid container for outfit cells.")]
        public Transform OutfitGrid;

        [Tooltip("Prefab for an outfit thumbnail cell.")]
        public GameObject OutfitCellPrefab;

        [Tooltip("Button to view the selected outfit in detail.")]
        public Button ViewOutfitButton;
        #endregion

        #region Inspector - Rooms Tab
        [Header("Rooms Tab")]
        [Tooltip("List container for room entries.")]
        public Transform RoomList;

        [Tooltip("Prefab for a room list cell.")]
        public GameObject RoomCellPrefab;

        [Tooltip("Secondary visit room button in the rooms tab.")]
        public Button VisitRoomButton2;
        #endregion

        #region Inspector - Stats Tab
        [Header("Stats Tab")]
        [Tooltip("Grid container for stat cells.")]
        public Transform StatsGrid;

        [Tooltip("Prefab for a stat display cell.")]
        public GameObject StatCellPrefab;

        [Tooltip("Total minigames played text.")]
        public TMP_Text MinigamesPlayedText;

        [Tooltip("Total minigames won text.")]
        public TMP_Text MinigamesWonText;

        [Tooltip("Win rate percentage text.")]
        public TMP_Text WinRateText;
        #endregion

        #region Inspector - Badges Tab
        [Header("Badges Tab")]
        [Tooltip("Grid container for badge cells.")]
        public Transform BadgesGrid;

        [Tooltip("Prefab for a badge cell.")]
        public GameObject BadgeCellPrefab;

        [Tooltip("Total badges count text (e.g., '12 / 50').")]
        public TMP_Text BadgesCountText;
        #endregion

        #region State
        private string _currentPlayerId;
        private bool _isMyProfile;
        private readonly List<OutfitInfo> _outfits = new();
        private readonly List<ProfileRoomInfo> _rooms = new();
        private readonly List<BadgeInfo> _badges = new();
        private readonly List<PlayerStat> _stats = new();
        private int _minigamesPlayed;
        private int _minigamesWon;
        private int _selectedTabIndex = 0;
        private readonly string[] _tabNames = { "Profile", "Outfits", "Rooms", "Stats", "Badges" };
        #endregion

        #region Events
        /// <summary>
        /// Fired when the Add Friend button is clicked.
        /// </summary>
        public event Action<string> OnAddFriendClicked;

        /// <summary>
        /// Fired when the Message button is clicked.
        /// </summary>
        public event Action<string> OnMessageClicked;

        /// <summary>
        /// Fired when a room is selected for visiting.
        /// </summary>
        public event Action<string> OnVisitRoomClicked;
        #endregion

        #region Unity Lifecycle
        protected override void Awake()
        {
            base.Awake();
            WireEventListeners();
        }

        private void OnEnable()
        {
            EventBus.Instance?.Subscribe<AvatarChangedEvent>(OnAvatarChanged);
        }

        private void OnDisable()
        {
            EventBus.Instance?.Unsubscribe<AvatarChangedEvent>(OnAvatarChanged);
        }
        #endregion

        #region EventBus Handlers
        /// <summary>
        /// Refreshes the avatar image when an avatar change event is received for the viewed player.
        /// </summary>
        private void OnAvatarChanged(AvatarChangedEvent evt)
        {
            if (evt.PlayerId == _currentPlayerId && AvatarImage != null)
            {
                // TODO: Reload avatar sprite via ImageLoader
                RefreshPreviewImage();
            }
        }
        #endregion

        #region Public API
        /// <summary>
        /// Displays the profile for a specific player by ID.
        /// </summary>
        /// <param name="playerId">The unique player identifier.</param>
        public void ShowProfile(string playerId)
        {
            if (string.IsNullOrEmpty(playerId))
            {
                Debug.LogError("[ProfilePanel] Cannot show profile for null or empty playerId.");
                return;
            }

            _currentPlayerId = playerId;
            _isMyProfile = false; // TODO: Compare with local player ID from session
            LoadProfileData(playerId);
            RefreshButtons();
            ShowTab(0);
            Show(true);
        }

        /// <summary>
        /// Displays the local player's own profile.
        /// </summary>
        public void ShowMyProfile()
        {
            _currentPlayerId = "local_player"; // TODO: Replace with actual session player ID
            _isMyProfile = true;
            LoadProfileData(_currentPlayerId);
            RefreshButtons();
            ShowTab(0);
            Show(true);
        }

        /// <summary>
        /// Called when the panel is about to be shown.
        /// </summary>
        public override void OnPanelShow()
        {
            base.OnPanelShow();
            if (!string.IsNullOrEmpty(_currentPlayerId))
            {
                LoadProfileData(_currentPlayerId);
                RefreshButtons();
                ShowTab(_selectedTabIndex);
            }
        }

        /// <summary>
        /// Called when the panel data should be refreshed while visible.
        /// </summary>
        public override void OnPanelRefresh()
        {
            base.OnPanelRefresh();
            if (!string.IsNullOrEmpty(_currentPlayerId))
            {
                LoadProfileData(_currentPlayerId);
                RefreshCurrentTab();
            }
        }

        /// <summary>
        /// Called when the back button (Escape) is pressed.
        /// </summary>
        /// <returns>True if the back press was handled.</returns>
        public override bool OnBackPressed()
        {
            if (_selectedTabIndex > 0)
            {
                ShowTab(0);
                return true;
            }
            return base.OnBackPressed();
        }

        /// <summary>
        /// Called when the device type changes. Adjusts grid layouts for mobile vs desktop.
        /// </summary>
        /// <param name="deviceType">The new device type.</param>
        public override void OnDeviceTypeChanged(DeviceType deviceType)
        {
            base.OnDeviceTypeChanged(deviceType);
            ConfigureGridLayout(OutfitGrid, deviceType, 150f, 120f);
            ConfigureGridLayout(BadgesGrid, deviceType, 100f, 100f);
            ConfigureGridLayout(StatsGrid, deviceType, 200f, 80f);
        }
        #endregion

        #region Private Implementation
        /// <summary>
        /// Wires all UI toggle and button event listeners.
        /// </summary>
        private void WireEventListeners()
        {
            if (ProfileTab != null)
                ProfileTab.onValueChanged.AddListener(isOn => { if (isOn) ShowTab(0); });
            if (OutfitsTab != null)
                OutfitsTab.onValueChanged.AddListener(isOn => { if (isOn) ShowTab(1); });
            if (RoomsTab != null)
                RoomsTab.onValueChanged.AddListener(isOn => { if (isOn) ShowTab(2); });
            if (StatsTab != null)
                StatsTab.onValueChanged.AddListener(isOn => { if (isOn) ShowTab(3); });
            if (BadgesTab != null)
                BadgesTab.onValueChanged.AddListener(isOn => { if (isOn) ShowTab(4); });

            if (AddFriendButton != null)
                AddFriendButton.onClick.AddListener(() => OnAddFriendClicked?.Invoke(_currentPlayerId));
            if (MessageButton != null)
                MessageButton.onClick.AddListener(() => OnMessageClicked?.Invoke(_currentPlayerId));
            if (VisitRoomButton != null)
                VisitRoomButton.onClick.AddListener(() => OnVisitRoomClicked?.Invoke(_currentPlayerId));
            if (VisitRoomButton2 != null)
                VisitRoomButton2.onClick.AddListener(() => OnVisitRoomClicked?.Invoke(_currentPlayerId));
            if (ReportButton != null)
                ReportButton.onClick.AddListener(OnReportClicked);
            if (BlockButton != null)
                BlockButton.onClick.AddListener(OnBlockClicked);
            if (EditProfileButton != null)
                EditProfileButton.onClick.AddListener(OnEditProfileClicked);
            if (ViewOutfitButton != null)
                ViewOutfitButton.onClick.AddListener(OnViewOutfitClicked);
        }

        /// <summary>
        /// Loads profile data from the backend or cache.
        /// </summary>
        /// <param name="playerId">The player ID to load data for.</param>
        private void LoadProfileData(string playerId)
        {
            // TODO: Replace with actual API call
            // Simulated data
            if (NameText != null) NameText.text = $"Player {playerId}";
            if (LevelText != null) LevelText.text = "Lv. 42";
            if (StatusText != null) StatusText.text = "Online";
            if (StatusDot != null) StatusDot.color = new Color(0.3f, 0.9f, 0.3f);
            if (BioText != null) BioText.text = "Welcome to my profile! I love building rooms and playing minigames.";
            if (JoinDateText != null) JoinDateText.text = "Joined: March 2024";
            if (PlayTimeText != null) PlayTimeText.text = "Play Time: 128h";
            if (FriendsCountText != null) FriendsCountText.text = "Friends: 24";
            if (RoomsOwnedText != null) RoomsOwnedText.text = "Rooms: 5";

            _outfits.Clear();
            for (int i = 0; i < 8; i++)
            {
                _outfits.Add(new OutfitInfo
                {
                    OutfitId = $"outfit_{i}",
                    OutfitName = $"Outfit {i + 1}",
                    ThumbnailUrl = string.Empty,
                    IsEquipped = i == 0
                });
            }

            _rooms.Clear();
            for (int i = 0; i < 4; i++)
            {
                _rooms.Add(new ProfileRoomInfo
                {
                    RoomId = $"room_{i}",
                    RoomName = $"My Room {i + 1}",
                    ThumbnailUrl = string.Empty,
                    PlayerCount = UnityEngine.Random.Range(0, 10),
                    MaxCapacity = 25
                });
            }

            _badges.Clear();
            for (int i = 0; i < 20; i++)
            {
                _badges.Add(new BadgeInfo
                {
                    BadgeId = $"badge_{i}",
                    BadgeName = $"Badge {i + 1}",
                    Description = $"Description for badge {i + 1}",
                    IconUrl = string.Empty,
                    IsUnlocked = i < 7,
                    UnlockedAt = i < 7 ? DateTimeOffset.UtcNow.AddDays(-i * 5).ToUnixTimeSeconds() : 0
                });
            }

            _stats.Clear();
            _stats.Add(new PlayerStat { StatName = "Minigames Played", Value = 142, FormattedValue = "142" });
            _stats.Add(new PlayerStat { StatName = "Minigames Won", Value = 89, FormattedValue = "89" });
            _stats.Add(new PlayerStat { StatName = "Rooms Visited", Value = 312, FormattedValue = "312" });
            _stats.Add(new PlayerStat { StatName = "Items Collected", Value = 512, FormattedValue = "512" });
            _stats.Add(new PlayerStat { StatName = "Fish Caught", Value = 74, FormattedValue = "74" });
            _stats.Add(new PlayerStat { StatName = "Distance Walked", Value = 15000, FormattedValue = "15.0 km" });

            _minigamesPlayed = 142;
            _minigamesWon = 89;
        }

        /// <summary>
        /// Switches the visible tab and refreshes its content.
        /// </summary>
        /// <param name="tabIndex">0=Profile, 1=Outfits, 2=Rooms, 3=Stats, 4=Badges</param>
        private void ShowTab(int tabIndex)
        {
            _selectedTabIndex = Mathf.Clamp(tabIndex, 0, 4);
            RefreshCurrentTab();
        }

        /// <summary>
        /// Refreshes the currently selected tab's content.
        /// </summary>
        private void RefreshCurrentTab()
        {
            switch (_selectedTabIndex)
            {
                case 0: PopulateProfileTab(); break;
                case 1: PopulateOutfitsTab(); break;
                case 2: PopulateRoomsTab(); break;
                case 3: PopulateStatsTab(); break;
                case 4: PopulateBadgesTab(); break;
            }
        }

        /// <summary>
        /// Updates button visibility based on friendship status and whether this is the local player's profile.
        /// </summary>
        private void RefreshButtons()
        {
            if (AddFriendButton != null)
                AddFriendButton.gameObject.SetActive(!_isMyProfile);
            if (MessageButton != null)
                MessageButton.gameObject.SetActive(!_isMyProfile);
            if (VisitRoomButton != null)
                VisitRoomButton.gameObject.SetActive(!_isMyProfile);
            if (ReportButton != null)
                ReportButton.gameObject.SetActive(!_isMyProfile);
            if (BlockButton != null)
                BlockButton.gameObject.SetActive(!_isMyProfile);
            if (EditProfileButton != null)
                EditProfileButton.gameObject.SetActive(_isMyProfile);
        }

        /// <summary>
        /// Populates the Profile (bio/info) tab with data.
        /// </summary>
        private void PopulateProfileTab()
        {
            if (MutualFriendsContainer == null) return;
            // Clear old mutual friend avatars
            foreach (Transform child in MutualFriendsContainer)
            {
                if (child != null) Destroy(child.gameObject);
            }
            // TODO: Populate mutual friend avatars from API
        }

        /// <summary>
        /// Populates the Outfits grid with thumbnail cells.
        /// </summary>
        private void PopulateOutfitsTab()
        {
            if (OutfitGrid == null || OutfitCellPrefab == null) return;

            foreach (Transform child in OutfitGrid)
            {
                if (child != null) Destroy(child.gameObject);
            }

            foreach (var outfit in _outfits)
            {
                var cell = Instantiate(OutfitCellPrefab, OutfitGrid, false);
                var nameTxt = cell.transform.Find("Name")?.GetComponent<TMP_Text>();
                var thumb = cell.transform.Find("Thumbnail")?.GetComponent<Image>();
                var equippedMarker = cell.transform.Find("Equipped")?.GetComponent<GameObject>();

                if (nameTxt != null) nameTxt.text = outfit.OutfitName;
                if (equippedMarker != null) equippedMarker.SetActive(outfit.IsEquipped);
                if (thumb != null && !string.IsNullOrEmpty(outfit.ThumbnailUrl))
                {
                    // TODO: Async thumbnail load
                }

                var btn = cell.GetComponent<Button>();
                if (btn != null)
                {
                    string oid = outfit.OutfitId;
                    btn.onClick.AddListener(() => OnOutfitSelected(oid));
                }
            }
        }

        /// <summary>
        /// Populates the Rooms list with room entries.
        /// </summary>
        private void PopulateRoomsTab()
        {
            if (RoomList == null || RoomCellPrefab == null) return;

            foreach (Transform child in RoomList)
            {
                if (child != null) Destroy(child.gameObject);
            }

            foreach (var room in _rooms)
            {
                var cell = Instantiate(RoomCellPrefab, RoomList, false);
                var nameTxt = cell.transform.Find("Name")?.GetComponent<TMP_Text>();
                var countTxt = cell.transform.Find("Count")?.GetComponent<TMP_Text>();
                var thumb = cell.transform.Find("Thumbnail")?.GetComponent<Image>();
                var visitBtn = cell.transform.Find("VisitButton")?.GetComponent<Button>();

                if (nameTxt != null) nameTxt.text = room.RoomName;
                if (countTxt != null) countTxt.text = $"{room.PlayerCount}/{room.MaxCapacity}";
                if (thumb != null && !string.IsNullOrEmpty(room.ThumbnailUrl))
                {
                    // TODO: Async thumbnail load
                }
                if (visitBtn != null)
                {
                    string rid = room.RoomId;
                    visitBtn.onClick.AddListener(() => OnVisitRoomClicked?.Invoke(rid));
                }
            }
        }

        /// <summary>
        /// Populates the Stats grid with stat cells.
        /// </summary>
        private void PopulateStatsTab()
        {
            if (StatsGrid == null || StatCellPrefab == null) return;

            foreach (Transform child in StatsGrid)
            {
                if (child != null) Destroy(child.gameObject);
            }

            if (MinigamesPlayedText != null) MinigamesPlayedText.text = _minigamesPlayed.ToString();
            if (MinigamesWonText != null) MinigamesWonText.text = _minigamesWon.ToString();
            if (WinRateText != null)
            {
                float rate = _minigamesPlayed > 0 ? (float)_minigamesWon / _minigamesPlayed * 100f : 0f;
                WinRateText.text = $"{rate:F1}%";
            }

            foreach (var stat in _stats)
            {
                var cell = Instantiate(StatCellPrefab, StatsGrid, false);
                var nameTxt = cell.transform.Find("Name")?.GetComponent<TMP_Text>();
                var valueTxt = cell.transform.Find("Value")?.GetComponent<TMP_Text>();

                if (nameTxt != null) nameTxt.text = stat.StatName;
                if (valueTxt != null) valueTxt.text = stat.FormattedValue;
            }
        }

        /// <summary>
        /// Populates the Badges grid with badge cells.
        /// </summary>
        private void PopulateBadgesTab()
        {
            if (BadgesGrid == null || BadgeCellPrefab == null) return;

            foreach (Transform child in BadgesGrid)
            {
                if (child != null) Destroy(child.gameObject);
            }

            int unlockedCount = 0;
            foreach (var badge in _badges)
            {
                if (badge.IsUnlocked) unlockedCount++;
                var cell = Instantiate(BadgeCellPrefab, BadgesGrid, false);
                var nameTxt = cell.transform.Find("Name")?.GetComponent<TMP_Text>();
                var icon = cell.transform.Find("Icon")?.GetComponent<Image>();
                var lockedOverlay = cell.transform.Find("Locked")?.GetComponent<GameObject>();

                if (nameTxt != null) nameTxt.text = badge.BadgeName;
                if (lockedOverlay != null) lockedOverlay.SetActive(!badge.IsUnlocked);
                if (icon != null)
                {
                    icon.color = badge.IsUnlocked ? Color.white : new Color(0.4f, 0.4f, 0.4f, 0.5f);
                    if (!string.IsNullOrEmpty(badge.IconUrl))
                    {
                        // TODO: Async icon load
                    }
                }

                var btn = cell.GetComponent<Button>();
                if (btn != null)
                {
                    string bid = badge.BadgeId;
                    btn.onClick.AddListener(() => OnBadgeClicked(bid));
                }
            }

            if (BadgesCountText != null)
                BadgesCountText.text = $"{unlockedCount} / {_badges.Count}";
        }

        /// <summary>
        /// Reloads the avatar image from the current profile data.
        /// </summary>
        private void RefreshPreviewImage()
        {
            if (AvatarImage == null) return;
            // TODO: Load avatar sprite from URL via ImageLoader utility
        }

        /// <summary>
        /// Handles the report player button click.
        /// </summary>
        private void OnReportClicked()
        {
            UIManager.Instance?.ShowPopup(
                "Report Player",
                "Please select a reason for reporting this player.",
                PopupType.Confirm,
                onConfirm: () => UIManager.Instance?.ShowToast("Report submitted. Thank you!", ToastType.Success, 2f)
            );
        }

        /// <summary>
        /// Handles the block player button click.
        /// </summary>
        private void OnBlockClicked()
        {
            UIManager.Instance?.ShowPopup(
                "Block Player",
                $"Are you sure you want to block this player? You won't see their messages or rooms.",
                PopupType.Confirm,
                onConfirm: () =>
                {
                    UIManager.Instance?.ShowToast("Player blocked.", ToastType.Warning, 2f);
                    if (BlockButton != null) BlockButton.interactable = false;
                }
            );
        }

        /// <summary>
        /// Handles the edit profile button click (self-only).
        /// </summary>
        private void OnEditProfileClicked()
        {
            UIManager.Instance?.ShowPanel("CharacterCreatorPanel", true, true);
        }

        /// <summary>
        /// Handles selection of an outfit cell.
        /// </summary>
        private void OnOutfitSelected(string outfitId)
        {
            UIManager.Instance?.ShowToast($"Selected outfit: {outfitId}", ToastType.Info, 1.5f);
        }

        /// <summary>
        /// Handles selection of a badge cell.
        /// </summary>
        private void OnBadgeClicked(string badgeId)
        {
            var badge = _badges.FirstOrDefault(b => b.BadgeId == badgeId);
            if (badge == null) return;
            UIManager.Instance?.ShowPopup(
                badge.BadgeName,
                badge.IsUnlocked ? badge.Description : "Locked - complete the required objective to unlock.",
                PopupType.Info
            );
        }

        /// <summary>
        /// Handles the view outfit detail button.
        /// </summary>
        private void OnViewOutfitClicked()
        {
            UIManager.Instance?.ShowToast("Outfit detail view coming soon!", ToastType.Info, 2f);
        }

        /// <summary>
        /// Helper to configure a GridLayoutGroup based on device type.
        /// </summary>
        private static void ConfigureGridLayout(Transform gridTransform, DeviceType deviceType, float desktopCellWidth, float desktopCellHeight)
        {
            if (gridTransform == null) return;
            var grid = gridTransform.GetComponent<GridLayoutGroup>();
            if (grid == null) return;

            if (deviceType == DeviceType.Mobile)
            {
                grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
                grid.constraintCount = 3;
                grid.cellSize = new Vector2(desktopCellWidth * 0.75f, desktopCellHeight * 0.75f);
            }
            else
            {
                grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
                grid.constraintCount = 4;
                grid.cellSize = new Vector2(desktopCellWidth, desktopCellHeight);
            }
        }
        #endregion
    }
}
