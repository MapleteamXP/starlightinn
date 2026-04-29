using System;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace KawaiiCoolIsland.Interaction
{
    /// <summary>
    /// Data model representing a player's public profile.
    /// </summary>
    [System.Serializable]
    public class PlayerProfile
    {
        public string PlayerId;
        public string DisplayName;
        public int Level;
        public string Status;
        public bool IsOnline;
        public string Bio;
        public string JoinDate;
        public int PlayTimeMinutes;
        public int RelationshipLevel;
        public List<string> MutualFriendIds;
        public List<PlayerOutfit> Outfits;
        public List<PlayerRoom> Rooms;
        public List<PlayerStat> Stats;
        public List<PlayerBadge> Badges;
    }

    [System.Serializable]
    public class PlayerOutfit
    {
        public string OutfitId;
        public string Name;
        public Sprite Thumbnail;
        public bool IsEquipped;
    }

    [System.Serializable]
    public class PlayerRoom
    {
        public string RoomId;
        public string Name;
        public Sprite Thumbnail;
        public int VisitorCount;
        public bool IsLocked;
    }

    [System.Serializable]
    public class PlayerStat
    {
        public string StatName;
        public int Value;
        public int MaxValue;
        public Sprite Icon;
    }

    [System.Serializable]
    public class PlayerBadge
    {
        public string BadgeId;
        public string Name;
        public string Description;
        public Sprite Icon;
        public bool IsUnlocked;
        public string UnlockDate;
        public Color BadgeColor;
    }

    /// <summary>
    /// Full profile viewer panel — the centerpiece of social discovery.
    /// Displays profile info, outfits, rooms, stats, and badges in a tabbed layout.
    /// </summary>
    public class ProfileViewer : UIPanel
    {
        #region Inspector — Profile Header

        [Header("Profile Header")]
        [Tooltip("Circular thumbnail image of the player's avatar.")]
        public Image AvatarThumbnail;

        [Tooltip("Text displaying the player's display name.")]
        public TMP_Text NameText;

        [Tooltip("Text displaying the player's level.")]
        public TMP_Text LevelText;

        [Tooltip("Text displaying the player's current status message.")]
        public TMP_Text StatusText;

        [Tooltip("Colored dot indicating online/offline status.")]
        public Image StatusDot;

        [Tooltip("Button to send a friend request (hidden if already friends).")]
        public Button AddFriendButton;

        [Tooltip("Button to open a private message with this player.")]
        public Button MessageButton;

        [Tooltip("Button to visit the player's current or home room.")]
        public Button VisitRoomButton;

        [Tooltip("Overflow button for additional actions (block, report, etc.).")]
        public Button MoreButton;

        #endregion

        #region Inspector — Tabs

        [Header("Tabs")]
        [Tooltip("ToggleGroup managing the tab bar exclusivity.")]
        public ToggleGroup TabGroup;

        [Tooltip("Toggle for the Profile / About tab.")]
        public Toggle ProfileTab;

        [Tooltip("Toggle for the Outfits / Wardrobe tab.")]
        public Toggle OutfitsTab;

        [Tooltip("Toggle for the Rooms / Spaces tab.")]
        public Toggle RoomsTab;

        [Tooltip("Toggle for the Stats / Achievements tab.")]
        public Toggle StatsTab;

        [Tooltip("Toggle for the Badges / Collection tab.")]
        public Toggle BadgesTab;

        #endregion

        #region Inspector — Tab Contents

        [Header("Tab Contents")]
        public GameObject ProfileContent;
        public GameObject OutfitsContent;
        public GameObject RoomsContent;
        public GameObject StatsContent;
        public GameObject BadgesContent;

        #endregion

        #region Inspector — Profile Tab

        [Header("Profile Tab")]
        [Tooltip("Text displaying the player's bio / about me.")]
        public TMP_Text BioText;

        [Tooltip("Text displaying when the player joined the game.")]
        public TMP_Text JoinDateText;

        [Tooltip("Text displaying total play time.")]
        public TMP_Text PlayTimeText;

        [Tooltip("Text displaying the friendship level between local and target player.")]
        public TMP_Text RelationshipLevelText;

        [Tooltip("Container for mutual friend avatars.")]
        public Transform MutualFriendsContainer;

        #endregion

        #region Inspector — Outfits Tab

        [Header("Outfits Tab")]
        [Tooltip("Grid container for outfit cells.")]
        public Transform OutfitGrid;

        [Tooltip("Prefab for a single outfit cell.")]
        public GameObject OutfitCellPrefab;

        #endregion

        #region Inspector — Rooms Tab

        [Header("Rooms Tab")]
        [Tooltip("List container for room cells.")]
        public Transform RoomList;

        [Tooltip("Prefab for a single room cell.")]
        public GameObject RoomCellPrefab;

        #endregion

        #region Inspector — Stats Tab

        [Header("Stats Tab")]
        [Tooltip("Grid container for stat cells.")]
        public Transform StatsGrid;

        [Tooltip("Prefab for a single stat cell.")]
        public GameObject StatCellPrefab;

        #endregion

        #region Inspector — Badges Tab

        [Header("Badges Tab")]
        [Tooltip("Grid container for badge cells.")]
        public Transform BadgesGrid;

        [Tooltip("Prefab for a single badge cell.")]
        public GameObject BadgeCellPrefab;

        #endregion

        #region Private State

        private string _currentPlayerId;
        private PlayerProfile _currentProfile;
        private bool _isOwnProfile;
        private readonly List<GameObject> _spawnedCells = new();
        private bool _isLoading;

        #endregion

        #region Events

        /// <summary>
        /// Invoked when a friend request is sent from the profile viewer. Passes the target player ID.
        /// </summary>
        public event Action<string> OnFriendRequestSent;

        /// <summary>
        /// Invoked when the user requests to whisper the viewed player. Passes the player ID.
        /// </summary>
        public event Action<string> OnWhisperRequested;

        #endregion

        #region Unity Lifecycle

        protected override void Awake()
        {
            base.Awake();
            RegisterTabListeners();
            RegisterButtonListeners();
        }

        private void OnEnable()
        {
            EventBus.Subscribe<string>(EventBus.EventType.ShowProfileViewer, OnShowProfileRequested);
            EventBus.Subscribe<string>(EventBus.EventType.ProfileDataLoaded, OnProfileDataLoaded);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<string>(EventBus.EventType.ShowProfileViewer, OnShowProfileRequested);
            EventBus.Unsubscribe<string>(EventBus.EventType.ProfileDataLoaded, OnProfileDataLoaded);
        }

        #endregion

        #region Public API

        /// <summary>
        /// Opens the profile viewer and loads data for the specified player.
        /// </summary>
        /// <param name="playerId">The unique identifier of the player to view.</param>
        public void ShowProfile(string playerId)
        {
            if (string.IsNullOrEmpty(playerId))
            {
                Debug.LogError($"[{nameof(ProfileViewer)}] Cannot show profile for null/empty playerId.");
                return;
            }

            _currentPlayerId = playerId;
            _isOwnProfile = IsLocalPlayerId(playerId);
            ShowPanel();
            LoadProfile(playerId);
        }

        /// <summary>
        /// Opens the profile viewer for the local player (My Profile).
        /// </summary>
        public void ShowMyProfile()
        {
            string localId = GetLocalPlayerId();
            if (string.IsNullOrEmpty(localId))
            {
                Debug.LogError($"[{nameof(ProfileViewer)}] Local player ID is not available.");
                return;
            }
            ShowProfile(localId);
        }

        /// <summary>
        /// Called automatically by <see cref="UIPanel.ShowPanel"/> when the panel becomes visible.
        /// Resets tab selection to the Profile tab.
        /// </summary>
        public override void OnPanelShow()
        {
            base.OnPanelShow();
            if (ProfileTab != null)
            {
                ProfileTab.isOn = true;
                OnTabChanged(ProfileTab);
            }
        }

        #endregion

        #region Data Loading

        /// <summary>
        /// Initiates asynchronous loading of the player's profile data.
        /// </summary>
        private void LoadProfile(string playerId)
        {
            if (_isLoading) return;
            _isLoading = true;

            // Show loading state
            ClearAllCells();
            if (NameText != null) NameText.text = "Loading...";

            // Request profile data from the backend / PlayerProfileManager
            EventBus.Publish(EventBus.EventType.RequestProfileData, playerId);

            // Fallback: if EventBus doesn't respond quickly, we could use a direct reference:
            // PlayerProfileManager.Instance?.RequestProfile(playerId);
        }

        /// <summary>
        /// Callback invoked when profile data has been loaded and broadcast.
        /// </summary>
        private void OnProfileDataLoaded(PlayerProfile profile)
        {
            _isLoading = false;
            if (profile == null)
            {
                Debug.LogWarning($"[{nameof(ProfileViewer)}] Received null profile data.");
                if (NameText != null) NameText.text = "Profile Unavailable";
                return;
            }

            _currentProfile = profile;
            PopulateHeader();
            PopulateProfileTab();
            UpdateButtonVisibility();
        }

        #endregion

        #region Header Population

        /// <summary>
        /// Fills the profile header with the loaded player's data.
        /// </summary>
        private void PopulateHeader()
        {
            if (_currentProfile == null) return;

            if (NameText != null)
                NameText.text = _currentProfile.DisplayName ?? "Unknown";

            if (LevelText != null)
                LevelText.text = $"Lv. {_currentProfile.Level}";

            if (StatusText != null)
                StatusText.text = _currentProfile.Status ?? "No status set";

            if (StatusDot != null)
                StatusDot.color = _currentProfile.IsOnline ? new Color(0.2f, 0.8f, 0.2f) : Color.gray;

            if (AvatarThumbnail != null)
            {
                // AvatarThumbnail.sprite = ... loaded from profile
            }
        }

        #endregion

        #region Tab Population

        /// <summary>
        /// Populates the Profile / About tab with bio, join date, play time, and mutual friends.
        /// </summary>
        private void PopulateProfileTab()
        {
            if (_currentProfile == null) return;

            if (BioText != null)
                BioText.text = string.IsNullOrEmpty(_currentProfile.Bio) ? "No bio yet." : _currentProfile.Bio;

            if (JoinDateText != null)
                JoinDateText.text = $"Joined: {_currentProfile.JoinDate ?? "Unknown"}";

            if (PlayTimeText != null)
            {
                int hours = _currentProfile.PlayTimeMinutes / 60;
                int mins = _currentProfile.PlayTimeMinutes % 60;
                PlayTimeText.text = $"Play Time: {hours}h {mins}m";
            }

            if (RelationshipLevelText != null)
            {
                if (_isOwnProfile)
                    RelationshipLevelText.text = "This is you!";
                else
                    RelationshipLevelText.text = $"Friendship Level: {_currentProfile.RelationshipLevel}";
            }

            PopulateMutualFriends();
        }

        /// <summary>
        /// Populates the mutual friends avatar row in the Profile tab.
        /// </summary>
        private void PopulateMutualFriends()
        {
            if (MutualFriendsContainer == null) return;
            ClearContainer(MutualFriendsContainer);

            if (_currentProfile?.MutualFriendIds == null) return;

            foreach (string friendId in _currentProfile.MutualFriendIds)
            {
                // Instantiate mini-avatar prefabs for mutual friends
                // GameObject cell = Instantiate(MutualFriendAvatarPrefab, MutualFriendsContainer);
                // Set avatar from friendId
            }
        }

        /// <summary>
        /// Populates the Outfits tab with the player's wardrobe.
        /// </summary>
        private void PopulateOutfitsTab()
        {
            if (OutfitGrid == null || OutfitCellPrefab == null) return;
            ClearContainer(OutfitGrid);

            if (_currentProfile?.Outfits == null) return;

            foreach (var outfit in _currentProfile.Outfits)
            {
                GameObject cell = Instantiate(OutfitCellPrefab, OutfitGrid);
                _spawnedCells.Add(cell);

                // Configure cell
                Image thumb = cell.GetComponentInChildren<Image>();
                TMP_Text label = cell.GetComponentInChildren<TMP_Text>();
                if (thumb != null) thumb.sprite = outfit.Thumbnail;
                if (label != null) label.text = outfit.Name;

                // Highlight equipped outfit
                if (outfit.IsEquipped)
                {
                    Image border = cell.GetComponent<Image>();
                    if (border != null) border.color = new Color(1f, 0.8f, 0.2f);
                }
            }
        }

        /// <summary>
        /// Populates the Rooms tab with the player's created / favorite rooms.
        /// </summary>
        private void PopulateRoomsTab()
        {
            if (RoomList == null || RoomCellPrefab == null) return;
            ClearContainer(RoomList);

            if (_currentProfile?.Rooms == null) return;

            foreach (var room in _currentProfile.Rooms)
            {
                GameObject cell = Instantiate(RoomCellPrefab, RoomList);
                _spawnedCells.Add(cell);

                Image thumb = cell.GetComponentInChildren<Image>();
                TMP_Text nameLabel = cell.transform.Find("NameText")?.GetComponent<TMP_Text>();
                TMP_Text visitorLabel = cell.transform.Find("VisitorText")?.GetComponent<TMP_Text>();
                GameObject lockIcon = cell.transform.Find("LockIcon")?.gameObject;

                if (thumb != null) thumb.sprite = room.Thumbnail;
                if (nameLabel != null) nameLabel.text = room.Name;
                if (visitorLabel != null) visitorLabel.text = $"{room.VisitorCount} visitors";
                if (lockIcon != null) lockIcon.SetActive(room.IsLocked);
            }
        }

        /// <summary>
        /// Populates the Stats tab with the player's statistics.
        /// </summary>
        private void PopulateStatsTab()
        {
            if (StatsGrid == null || StatCellPrefab == null) return;
            ClearContainer(StatsGrid);

            if (_currentProfile?.Stats == null) return;

            foreach (var stat in _currentProfile.Stats)
            {
                GameObject cell = Instantiate(StatCellPrefab, StatsGrid);
                _spawnedCells.Add(cell);

                Image icon = cell.transform.Find("Icon")?.GetComponent<Image>();
                TMP_Text nameLabel = cell.transform.Find("Name")?.GetComponent<TMP_Text>();
                TMP_Text valueLabel = cell.transform.Find("Value")?.GetComponent<TMP_Text>();
                Slider slider = cell.GetComponentInChildren<Slider>();

                if (icon != null) icon.sprite = stat.Icon;
                if (nameLabel != null) nameLabel.text = stat.StatName;
                if (valueLabel != null) valueLabel.text = $"{stat.Value} / {stat.MaxValue}";
                if (slider != null)
                {
                    slider.maxValue = stat.MaxValue;
                    slider.value = stat.Value;
                }
            }
        }

        /// <summary>
        /// Populates the Badges tab with the player's collected badges.
        /// </summary>
        private void PopulateBadgesTab()
        {
            if (BadgesGrid == null || BadgeCellPrefab == null) return;
            ClearContainer(BadgesGrid);

            if (_currentProfile?.Badges == null) return;

            foreach (var badge in _currentProfile.Badges)
            {
                GameObject cell = Instantiate(BadgeCellPrefab, BadgesGrid);
                _spawnedCells.Add(cell);

                Image icon = cell.GetComponentInChildren<Image>();
                TMP_Text nameLabel = cell.transform.Find("Name")?.GetComponent<TMP_Text>();
                TMP_Text descLabel = cell.transform.Find("Description")?.GetComponent<TMP_Text>();
                GameObject lockedOverlay = cell.transform.Find("LockedOverlay")?.gameObject;
                CanvasGroup cg = cell.GetComponent<CanvasGroup>();

                if (icon != null)
                {
                    icon.sprite = badge.Icon;
                    icon.color = badge.BadgeColor;
                }
                if (nameLabel != null) nameLabel.text = badge.Name;
                if (descLabel != null) descLabel.text = badge.Description;
                if (lockedOverlay != null) lockedOverlay.SetActive(!badge.IsUnlocked);
                if (cg != null) cg.alpha = badge.IsUnlocked ? 1f : 0.5f;
            }
        }

        #endregion

        #region Button Handlers

        /// <summary>
        /// Called when the Add Friend button is clicked.
        /// </summary>
        private void OnAddFriendClicked()
        {
            if (string.IsNullOrEmpty(_currentPlayerId)) return;
            if (_isOwnProfile)
            {
                Debug.Log("Cannot friend yourself!");
                return;
            }

            EventBus.Publish(EventBus.EventType.SendFriendRequest, _currentPlayerId);
            OnFriendRequestSent?.Invoke(_currentPlayerId);

            // Update button to pending state
            if (AddFriendButton != null)
            {
                TMP_Text btnText = AddFriendButton.GetComponentInChildren<TMP_Text>();
                if (btnText != null) btnText.text = "Request Sent";
                AddFriendButton.interactable = false;
            }
        }

        /// <summary>
        /// Called when the Message button is clicked.
        /// </summary>
        private void OnMessageClicked()
        {
            if (string.IsNullOrEmpty(_currentPlayerId)) return;
            EventBus.Publish(EventBus.EventType.OpenWhisperChat, (_currentPlayerId, _currentProfile?.DisplayName));
            OnWhisperRequested?.Invoke(_currentPlayerId);
        }

        /// <summary>
        /// Called when the Visit Room button is clicked.
        /// </summary>
        private void OnVisitRoomClicked()
        {
            if (string.IsNullOrEmpty(_currentPlayerId)) return;
            EventBus.Publish(EventBus.EventType.VisitPlayerRoom, _currentPlayerId);
        }

        /// <summary>
        /// Called when the More (overflow) button is clicked.
        /// </summary>
        private void OnMoreClicked()
        {
            if (string.IsNullOrEmpty(_currentPlayerId)) return;
            // Show a small dropdown or secondary menu
            EventBus.Publish(EventBus.EventType.ShowPlayerMoreOptions, _currentPlayerId);
        }

        #endregion

        #region Tab Handling

        /// <summary>
        /// Registers listeners on all tab toggles to switch content panels.
        /// </summary>
        private void RegisterTabListeners()
        {
            if (ProfileTab != null)
                ProfileTab.onValueChanged.AddListener(isOn => { if (isOn) OnTabChanged(ProfileTab); });
            if (OutfitsTab != null)
                OutfitsTab.onValueChanged.AddListener(isOn => { if (isOn) OnTabChanged(OutfitsTab); });
            if (RoomsTab != null)
                RoomsTab.onValueChanged.AddListener(isOn => { if (isOn) OnTabChanged(RoomsTab); });
            if (StatsTab != null)
                StatsTab.onValueChanged.AddListener(isOn => { if (isOn) OnTabChanged(StatsTab); });
            if (BadgesTab != null)
                BadgesTab.onValueChanged.AddListener(isOn => { if (isOn) OnTabChanged(BadgesTab); });
        }

        /// <summary>
        /// Registers click listeners on the header action buttons.
        /// </summary>
        private void RegisterButtonListeners()
        {
            if (AddFriendButton != null)
                AddFriendButton.onClick.AddListener(OnAddFriendClicked);
            if (MessageButton != null)
                MessageButton.onClick.AddListener(OnMessageClicked);
            if (VisitRoomButton != null)
                VisitRoomButton.onClick.AddListener(OnVisitRoomClicked);
            if (MoreButton != null)
                MoreButton.onClick.AddListener(OnMoreClicked);
        }

        /// <summary>
        /// Switches the visible content panel based on the active tab toggle.
        /// </summary>
        private void OnTabChanged(Toggle toggle)
        {
            if (toggle == null) return;

            // Hide all content first
            SetContentActive(ProfileContent, false);
            SetContentActive(OutfitsContent, false);
            SetContentActive(RoomsContent, false);
            SetContentActive(StatsContent, false);
            SetContentActive(BadgesContent, false);

            // Show matching content and populate
            if (toggle == ProfileTab)
            {
                SetContentActive(ProfileContent, true);
                PopulateProfileTab();
            }
            else if (toggle == OutfitsTab)
            {
                SetContentActive(OutfitsContent, true);
                PopulateOutfitsTab();
            }
            else if (toggle == RoomsTab)
            {
                SetContentActive(RoomsContent, true);
                PopulateRoomsTab();
            }
            else if (toggle == StatsTab)
            {
                SetContentActive(StatsContent, true);
                PopulateStatsTab();
            }
            else if (toggle == BadgesTab)
            {
                SetContentActive(BadgesContent, true);
                PopulateBadgesTab();
            }
        }

        /// <summary>
        /// Safely sets a content GameObject active or inactive.
        /// </summary>
        private static void SetContentActive(GameObject content, bool active)
        {
            if (content != null)
                content.SetActive(active);
        }

        #endregion

        #region Helpers

        /// <summary>
        /// Destroys all dynamically instantiated cells and clears the tracking list.
        /// </summary>
        private void ClearAllCells()
        {
            foreach (var go in _spawnedCells)
            {
                if (go != null) Destroy(go);
            }
            _spawnedCells.Clear();
        }

        /// <summary>
        /// Destroys all children of a container transform.
        /// </summary>
        private static void ClearContainer(Transform container)
        {
            if (container == null) return;
            for (int i = container.childCount - 1; i >= 0; i--)
            {
                Destroy(container.GetChild(i).gameObject);
            }
        }

        /// <summary>
        /// Returns true if the given playerId matches the local player.
        /// </summary>
        private bool IsLocalPlayerId(string playerId)
        {
            return playerId == GetLocalPlayerId();
        }

        /// <summary>
        /// Retrieves the local player's unique identifier.
        /// </summary>
        private string GetLocalPlayerId()
        {
            // Hook up to NetworkedPlayer or PlayerProfileManager
            // Fallback to PlayerPrefs for single-player / debug
            return PlayerPrefs.GetString("LocalPlayerId", string.Empty);
        }

        /// <summary>
        /// Updates the visibility and interactability of header buttons based on profile context.
        /// </summary>
        private void UpdateButtonVisibility()
        {
            if (AddFriendButton != null)
            {
                AddFriendButton.gameObject.SetActive(!_isOwnProfile);
                AddFriendButton.interactable = true;
                TMP_Text btnText = AddFriendButton.GetComponentInChildren<TMP_Text>();
                if (btnText != null) btnText.text = "Add Friend";
            }

            if (MessageButton != null)
                MessageButton.gameObject.SetActive(!_isOwnProfile);

            if (VisitRoomButton != null)
                VisitRoomButton.gameObject.SetActive(true);

            if (MoreButton != null)
                MoreButton.gameObject.SetActive(!_isOwnProfile);
        }

        #endregion

        #region EventBus Handlers

        /// <summary>
        /// Responds to a ShowProfileViewer event broadcast via the EventBus.
        /// </summary>
        private void OnShowProfileRequested(string playerId)
        {
            ShowProfile(playerId);
        }

        #endregion
    }
}
