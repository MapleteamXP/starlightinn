using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace KawaiiCoolIsland.Rooms.Moderation
{
    /// <summary>
    /// UI panel for managing room settings, moderation, and analytics.
    /// Only room owners and co-hosts have access. Extends <see cref="UIPanel"/>.
    /// </summary>
    public class RoomSettingsPanel : UIPanel
    {
        [Header("Info")]
        /// <summary>Input field for the room name.</summary>
        public TMP_InputField RoomNameInput;
        /// <summary>Input field for the room description.</summary>
        public TMP_InputField DescriptionInput;
        /// <summary>Input field for room rules.</summary>
        public TMP_InputField RulesInput;
        /// <summary>Input field for the welcome message.</summary>
        public TMP_InputField WelcomeMessageInput;
        /// <summary>Dropdown for room privacy selection.</summary>
        public TMP_Dropdown PrivacyDropdown;
        /// <summary>Input field for the room password.</summary>
        public TMP_InputField PasswordInput;
        /// <summary>Slider for max player count.</summary>
        public Slider MaxPlayersSlider;
        /// <summary>Text display for max player slider value.</summary>
        public TMP_Text MaxPlayersText;
        /// <summary>Dropdown for room category selection.</summary>
        public TMP_Dropdown CategoryDropdown;

        [Header("Features")]
        /// <summary>Toggle for allowing furniture editing by co-hosts.</summary>
        public Toggle AllowEditingToggle;
        /// <summary>Toggle for allowing music control by co-hosts.</summary>
        public Toggle AllowMusicToggle;
        /// <summary>Toggle for showing the room owner name in the UI.</summary>
        public Toggle ShowOwnerNameToggle;
        /// <summary>Toggle for allowing photo mode in the room.</summary>
        public Toggle AllowPhotoModeToggle;

        [Header("Co-Hosts")]
        /// <summary>Transform parent for the co-host list items.</summary>
        public Transform CoHostList;
        /// <summary>Prefab instantiated for each co-host entry.</summary>
        public GameObject CoHostItemPrefab;
        /// <summary>Button to add a co-host.</summary>
        public Button AddCoHostButton;
        /// <summary>Input field for entering a co-host player ID.</summary>
        public TMP_InputField CoHostInput;

        [Header("Moderation")]
        /// <summary>Button to switch to the moderation tab.</summary>
        public Button ModerationTabButton;
        /// <summary>Root GameObject for the moderation tab content.</summary>
        public GameObject ModerationPanel;
        /// <summary>Transform parent for ban list items.</summary>
        public Transform BanList;
        /// <summary>Prefab instantiated for each ban entry.</summary>
        public GameObject BanItemPrefab;
        /// <summary>Transform parent for action log items.</summary>
        public Transform ActionLog;
        /// <summary>Prefab instantiated for each action log entry.</summary>
        public GameObject ActionLogItemPrefab;

        [Header("Analytics")]
        /// <summary>Button to switch to the analytics tab.</summary>
        public Button AnalyticsTabButton;
        /// <summary>Root GameObject for the analytics tab content.</summary>
        public GameObject AnalyticsPanel;
        /// <summary>Text displaying total visits.</summary>
        public TMP_Text TotalVisitsText;
        /// <summary>Text displaying unique visitor count.</summary>
        public TMP_Text UniqueVisitorsText;
        /// <summary>Text displaying peak player count.</summary>
        public TMP_Text PeakPlayersText;
        /// <summary>Text displaying average visit duration.</summary>
        public TMP_Text AvgDurationText;
        /// <summary>Text displaying favorite count.</summary>
        public TMP_Text FavoritesText;

        [Header("Tab Navigation")]
        [SerializeField] private Button settingsTabButton;
        [SerializeField] private Button coHostsTabButton;
        [SerializeField] private GameObject settingsPanelRoot;
        [SerializeField] private GameObject coHostsPanelRoot;
        [SerializeField] private Color activeTabColor = new Color(0.2f, 0.6f, 1f);
        [SerializeField] private Color inactiveTabColor = new Color(0.3f, 0.3f, 0.3f);

        private string currentTab = "Settings";
        private readonly List<GameObject> coHostItems = new();
        private readonly List<GameObject> banItems = new();
        private readonly List<GameObject> logItems = new();

        /// <summary>
        /// Called when the panel is shown. Refreshes all settings and UI state.
        /// </summary>
        public override void OnPanelShow()
        {
            base.OnPanelShow();
            RefreshSettings();
            SwitchTab("Settings");
        }

        /// <summary>
        /// Refreshes all UI controls from the current room settings.
        /// </summary>
        public void RefreshSettings()
        {
            RoomSettingsManager mgr = RoomSettingsManager.Instance;
            if (mgr == null) return;

            // Determine access level
            bool canEdit = mgr.CanEdit();
            bool isOwner = mgr.IsRoomOwner;

            // Info tab
            if (RoomNameInput != null)
            {
                RoomNameInput.text = mgr.GetRoomName();
                RoomNameInput.interactable = canEdit;
            }
            if (DescriptionInput != null)
            {
                DescriptionInput.text = mgr.GetRoomDescription();
                DescriptionInput.interactable = canEdit;
            }
            if (RulesInput != null)
            {
                RulesInput.text = mgr.GetRoomRules();
                RulesInput.interactable = canEdit;
            }
            if (WelcomeMessageInput != null)
            {
                WelcomeMessageInput.text = mgr.GetWelcomeMessage();
                WelcomeMessageInput.interactable = canEdit;
            }
            if (PrivacyDropdown != null)
            {
                PrivacyDropdown.value = (int)mgr.GetRoomPrivacy();
                PrivacyDropdown.interactable = canEdit;
            }
            if (PasswordInput != null)
            {
                PasswordInput.text = mgr.GetRoomPassword();
                PasswordInput.interactable = canEdit && mgr.GetRoomPrivacy() == RoomPrivacy.PasswordProtected;
            }
            if (MaxPlayersSlider != null)
            {
                MaxPlayersSlider.value = mgr.GetMaxPlayers();
                MaxPlayersSlider.interactable = canEdit;
                UpdateMaxPlayersText();
            }
            if (CategoryDropdown != null)
            {
                CategoryDropdown.value = (int)mgr.GetRoomCategory();
                CategoryDropdown.interactable = canEdit;
            }

            // Features tab
            if (AllowEditingToggle != null)
            {
                AllowEditingToggle.isOn = mgr.GetAllowFurnitureEditing();
                AllowEditingToggle.interactable = isOwner;
            }
            if (AllowMusicToggle != null)
            {
                AllowMusicToggle.isOn = mgr.GetAllowMusicControl();
                AllowMusicToggle.interactable = isOwner;
            }
            if (ShowOwnerNameToggle != null)
            {
                ShowOwnerNameToggle.interactable = isOwner;
            }
            if (AllowPhotoModeToggle != null)
            {
                AllowPhotoModeToggle.interactable = isOwner;
            }

            // Co-Host tab
            if (AddCoHostButton != null)
                AddCoHostButton.interactable = isOwner;
            if (CoHostInput != null)
                CoHostInput.interactable = isOwner;

            // Moderation tab
            if (ModerationTabButton != null)
                ModerationTabButton.interactable = mgr.MyPermissions.CanKick || mgr.MyPermissions.CanMute || mgr.MyPermissions.CanBan;

            // Analytics tab
            if (AnalyticsTabButton != null)
                AnalyticsTabButton.interactable = isOwner;

            PopulateCoHostList();
            PopulateBanList();
            PopulateActionLog();
            PopulateAnalytics();
        }

        /// <summary>
        /// Called when the Save button is clicked. Persists current UI values to settings.
        /// </summary>
        public void OnSaveClicked()
        {
            RoomSettingsManager mgr = RoomSettingsManager.Instance;
            if (mgr == null) return;
            if (!mgr.CanEdit()) return;

            if (RoomNameInput != null) mgr.SetRoomName(RoomNameInput.text);
            if (DescriptionInput != null) mgr.SetRoomDescription(DescriptionInput.text);
            if (RulesInput != null) mgr.SetRoomRules(RulesInput.text);
            if (WelcomeMessageInput != null) mgr.SetWelcomeMessage(WelcomeMessageInput.text);
            if (PrivacyDropdown != null) mgr.SetRoomPrivacy((RoomPrivacy)PrivacyDropdown.value);
            if (PasswordInput != null && mgr.GetRoomPrivacy() == RoomPrivacy.PasswordProtected)
                mgr.SetRoomPassword(PasswordInput.text);
            if (MaxPlayersSlider != null) mgr.SetMaxPlayers(Mathf.RoundToInt(MaxPlayersSlider.value));
            if (CategoryDropdown != null) mgr.SetRoomCategory((RoomCategory)CategoryDropdown.value);

            if (AllowEditingToggle != null && mgr.IsRoomOwner)
                mgr.SetAllowFurnitureEditing(AllowEditingToggle.isOn);
            if (AllowMusicToggle != null && mgr.IsRoomOwner)
                mgr.SetAllowMusicControl(AllowMusicToggle.isOn);

            mgr.SaveRoomSettings();
            EventBus.UIShowToast?.Invoke("Room settings saved!");
        }

        /// <summary>
        /// Called when the Reset button is clicked. Reverts UI to saved settings.
        /// </summary>
        public void OnResetClicked()
        {
            RefreshSettings();
            EventBus.UIShowToast?.Invoke("Settings reverted to saved values.");
        }

        /// <summary>
        /// Called when the Add Co-Host button is clicked.
        /// </summary>
        public void OnAddCoHostClicked()
        {
            RoomSettingsManager mgr = RoomSettingsManager.Instance;
            if (mgr == null) return;
            if (!mgr.IsRoomOwner) return;
            if (CoHostInput == null) return;

            string playerId = CoHostInput.text.Trim();
            if (string.IsNullOrWhiteSpace(playerId)) return;

            mgr.AddCoHost(playerId);
            CoHostInput.text = "";
            PopulateCoHostList();
        }

        /// <summary>
        /// Called when a co-host remove button is clicked.
        /// </summary>
        /// <param name="playerId">The co-host to remove.</param>
        public void OnRemoveCoHostClicked(string playerId)
        {
            RoomSettingsManager mgr = RoomSettingsManager.Instance;
            if (mgr == null) return;
            if (!mgr.IsRoomOwner) return;
            if (string.IsNullOrWhiteSpace(playerId)) return;

            mgr.RemoveCoHost(playerId);
            PopulateCoHostList();
        }

        /// <summary>
        /// Called when an unban button is clicked.
        /// </summary>
        /// <param name="playerId">The player to unban.</param>
        public void OnUnbanClicked(string playerId)
        {
            RoomModerationTools mod = GetModerationTools();
            if (mod == null) return;
            mod.UnbanPlayerFromRoom(playerId);
            PopulateBanList();
        }

        /// <summary>
        /// Switches the visible tab in the settings panel.
        /// </summary>
        /// <param name="tabName">Tab name: Settings, CoHosts, Moderation, or Analytics.</param>
        public void SwitchTab(string tabName)
        {
            currentTab = tabName;
            UpdateTabVisibility();
            UpdateTabColors();

            if (tabName == "Moderation")
            {
                PopulateBanList();
                PopulateActionLog();
            }
            else if (tabName == "Analytics")
            {
                PopulateAnalytics();
            }
            else if (tabName == "CoHosts")
            {
                PopulateCoHostList();
            }
        }

        /// <summary>
        /// Populates the co-host list UI from the settings manager.
        /// </summary>
        private void PopulateCoHostList()
        {
            ClearListItems(coHostItems, CoHostList);
            RoomSettingsManager mgr = RoomSettingsManager.Instance;
            if (mgr == null || CoHostList == null || CoHostItemPrefab == null) return;

            List<string> hosts = mgr.GetCoHosts();
            foreach (string playerId in hosts)
            {
                GameObject item = Instantiate(CoHostItemPrefab, CoHostList);
                coHostItems.Add(item);

                TMP_Text label = item.GetComponentInChildren<TMP_Text>();
                if (label != null) label.text = playerId;

                Button removeBtn = item.GetComponentInChildren<Button>();
                if (removeBtn != null)
                {
                    string capturedId = playerId;
                    removeBtn.onClick.RemoveAllListeners();
                    removeBtn.onClick.AddListener(() => OnRemoveCoHostClicked(capturedId));
                }
            }
        }

        /// <summary>
        /// Populates the ban list UI from the moderation tools.
        /// </summary>
        private void PopulateBanList()
        {
            ClearListItems(banItems, BanList);
            RoomModerationTools mod = GetModerationTools();
            if (mod == null || BanList == null || BanItemPrefab == null) return;

            List<RoomBanEntry> bans = mod.GetBanList();
            foreach (RoomBanEntry entry in bans)
            {
                GameObject item = Instantiate(BanItemPrefab, BanList);
                banItems.Add(item);

                TMP_Text label = item.GetComponentInChildren<TMP_Text>();
                if (label != null)
                {
                    string duration = entry.IsPermanent ? "Permanent" : $"{entry.DurationHours}h";
                    label.text = $"{entry.PlayerName} ({duration}) - {entry.Reason}";
                }

                Button unbanBtn = item.GetComponentInChildren<Button>();
                if (unbanBtn != null)
                {
                    string capturedId = entry.PlayerId;
                    unbanBtn.onClick.RemoveAllListeners();
                    unbanBtn.onClick.AddListener(() => OnUnbanClicked(capturedId));
                }
            }
        }

        /// <summary>
        /// Populates the moderation action log UI.
        /// </summary>
        private void PopulateActionLog()
        {
            ClearListItems(logItems, ActionLog);
            RoomModerationTools mod = GetModerationTools();
            if (mod == null || ActionLog == null || ActionLogItemPrefab == null) return;

            List<ModerationAction> logs = mod.GetActionLog();
            // Show most recent first
            for (int i = logs.Count - 1; i >= 0; i--)
            {
                ModerationAction action = logs[i];
                GameObject item = Instantiate(ActionLogItemPrefab, ActionLog);
                logItems.Add(item);

                TMP_Text label = item.GetComponentInChildren<TMP_Text>();
                if (label != null)
                {
                    DateTime dt = DateTimeOffset.FromUnixTimeSeconds(action.Timestamp).DateTime;
                    label.text = $"[{dt:HH:mm}] {action.ActionType}: {action.TargetPlayerName} by {action.ModeratorId}";
                }
            }
        }

        /// <summary>
        /// Populates the analytics tab with current metrics.
        /// </summary>
        private void PopulateAnalytics()
        {
            RoomAnalytics analytics = GetRoomAnalytics();
            if (analytics == null) return;

            RoomAnalyticsSummary summary = analytics.GetSummary();

            if (TotalVisitsText != null)
                TotalVisitsText.text = summary.TotalVisits.ToString("N0");
            if (UniqueVisitorsText != null)
                UniqueVisitorsText.text = summary.UniqueVisitors.ToString("N0");
            if (PeakPlayersText != null)
                PeakPlayersText.text = summary.PeakConcurrent.ToString("N0");
            if (AvgDurationText != null)
                AvgDurationText.text = $"{summary.AvgDuration:F1} min";
            if (FavoritesText != null)
                FavoritesText.text = summary.Favorites.ToString("N0");
        }

        /// <summary>
        /// Updates the max players text display from the slider value.
        /// </summary>
        private void UpdateMaxPlayersText()
        {
            if (MaxPlayersText != null && MaxPlayersSlider != null)
            {
                MaxPlayersText.text = Mathf.RoundToInt(MaxPlayersSlider.value).ToString();
            }
        }

        /// <summary>
        /// Clears dynamically instantiated list items.
        /// </summary>
        private void ClearListItems(List<GameObject> items, Transform parent)
        {
            foreach (GameObject item in items)
            {
                if (item != null) Destroy(item);
            }
            items.Clear();
        }

        /// <summary>
        /// Updates the visibility of tab content roots.
        /// </summary>
        private void UpdateTabVisibility()
        {
            if (settingsPanelRoot != null)
                settingsPanelRoot.SetActive(currentTab == "Settings");
            if (coHostsPanelRoot != null)
                coHostsPanelRoot.SetActive(currentTab == "CoHosts");
            if (ModerationPanel != null)
                ModerationPanel.SetActive(currentTab == "Moderation");
            if (AnalyticsPanel != null)
                AnalyticsPanel.SetActive(currentTab == "Analytics");
        }

        /// <summary>
        /// Updates the tab button colors to indicate active/inactive state.
        /// </summary>
        private void UpdateTabColors()
        {
            SetTabColor(settingsTabButton, currentTab == "Settings");
            SetTabColor(coHostsTabButton, currentTab == "CoHosts");
            SetTabColor(ModerationTabButton, currentTab == "Moderation");
            SetTabColor(AnalyticsTabButton, currentTab == "Analytics");
        }

        /// <summary>
        /// Sets a tab button's color based on active state.
        /// </summary>
        private void SetTabColor(Button btn, bool active)
        {
            if (btn == null) return;
            ColorBlock cb = btn.colors;
            cb.normalColor = active ? activeTabColor : inactiveTabColor;
            btn.colors = cb;
        }

        /// <summary>
        /// Locates the <see cref="RoomModerationTools"/> instance in the scene.
        /// </summary>
        private RoomModerationTools GetModerationTools()
        {
            return FindFirstObjectByType<RoomModerationTools>();
        }

        /// <summary>
        /// Locates the <see cref="RoomAnalytics"/> instance in the scene.
        /// </summary>
        private RoomAnalytics GetRoomAnalytics()
        {
            return FindFirstObjectByType<RoomAnalytics>();
        }

        /// <summary>
        /// Subscribes to settings change events for live UI updates.
        /// </summary>
        protected override void OnEnable()
        {
            base.OnEnable();

            if (MaxPlayersSlider != null)
                MaxPlayersSlider.onValueChanged.AddListener(_ => UpdateMaxPlayersText());
            if (PrivacyDropdown != null)
                PrivacyDropdown.onValueChanged.AddListener(OnPrivacyChanged);

            RoomSettingsManager mgr = RoomSettingsManager.Instance;
            if (mgr != null)
                mgr.OnSettingsChanged += OnSettingsChangedExternally;
        }

        /// <summary>
        /// Unsubscribes from events on disable.
        /// </summary>
        protected override void OnDisable()
        {
            base.OnDisable();

            if (MaxPlayersSlider != null)
                MaxPlayersSlider.onValueChanged.RemoveAllListeners();
            if (PrivacyDropdown != null)
                PrivacyDropdown.onValueChanged.RemoveAllListeners();

            RoomSettingsManager mgr = RoomSettingsManager.Instance;
            if (mgr != null)
                mgr.OnSettingsChanged -= OnSettingsChangedExternally;
        }

        /// <summary>
        /// Handles privacy dropdown changes to toggle password field visibility.
        /// </summary>
        private void OnPrivacyChanged(int value)
        {
            bool isPassword = value == (int)RoomPrivacy.PasswordProtected;
            if (PasswordInput != null)
                PasswordInput.interactable = isPassword && RoomSettingsManager.Instance.CanEdit();
        }

        /// <summary>
        /// Refreshes the UI when settings are changed externally.
        /// </summary>
        private void OnSettingsChangedExternally()
        {
            RefreshSettings();
        }
    }
}
