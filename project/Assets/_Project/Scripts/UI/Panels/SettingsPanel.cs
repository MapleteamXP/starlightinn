using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using KawaiiCoolIsland.Core;
using KawaiiCoolIsland.Core.Events;

namespace KawaiiCoolIsland.UI
{
    #region Data Models

    /// <summary>
    /// Immutable holder for a player's game settings, used for save/load.
    /// </summary>
    [System.Serializable]
    public class GameSettings
    {
        // General
        public bool NotificationsEnabled = true;
        public bool AutoFollowLeader = false;
        public float TextSize = 1f;
        public int LanguageIndex = 0;

        // Audio
        public float MasterVolume = 1f;
        public float MusicVolume = 0.8f;
        public float SFXVolume = 0.8f;
        public float VoiceVolume = 1f;
        public bool MuteWhenMinimized = true;

        // Graphics
        public int QualityLevel = 2;
        public bool ShowPlayerNames = true;
        public bool ShowChatBubbles = true;
        public float RenderDistance = 100f;

        // Social
        public bool AcceptFriendRequests = true;
        public bool AllowRoomInvites = true;
        public bool AllowPartyInvites = true;
        public bool AllowTradeRequests = true;
        public bool ShowOnlineStatus = true;
        public int PrivacyLevel = 0;
    }

    #endregion

    /// <summary>
    /// Game settings panel with tabbed sections: General, Audio, Graphics, Social, and Account.
    /// Supports saving, loading, and resetting to defaults. Integrates with <see cref="EventBus"/>.
    /// </summary>
    public class SettingsPanel : UIPanel
    {
        #region Inspector - Tabs
        [Header("Tabs")]
        [Tooltip("Toggle for the General settings tab.")]
        public Toggle GeneralTab;

        [Tooltip("Toggle for the Audio settings tab.")]
        public Toggle AudioTab;

        [Tooltip("Toggle for the Graphics settings tab.")]
        public Toggle GraphicsTab;

        [Tooltip("Toggle for the Social settings tab.")]
        public Toggle SocialTab;

        [Tooltip("Toggle for the Account settings tab.")]
        public Toggle AccountTab;
        #endregion

        #region Inspector - General
        [Header("General")]
        [Tooltip("Toggle to enable/disable notifications.")]
        public Toggle NotificationsToggle;

        [Tooltip("Toggle to auto-follow party leader.")]
        public Toggle AutoFollowLeaderToggle;

        [Tooltip("Slider for UI text size scaling.")]
        public Slider TextSizeSlider;

        [Tooltip("Dropdown for language selection.")]
        public TMP_Dropdown LanguageDropdown;
        #endregion

        #region Inspector - Audio
        [Header("Audio")]
        [Tooltip("Slider for master volume.")]
        public Slider MasterVolumeSlider;

        [Tooltip("Slider for music volume.")]
        public Slider MusicVolumeSlider;

        [Tooltip("Slider for sound effects volume.")]
        public Slider SFXVolumeSlider;

        [Tooltip("Slider for voice chat volume.")]
        public Slider VoiceVolumeSlider;

        [Tooltip("Toggle to mute audio when the application is minimized.")]
        public Toggle MuteWhenMinimizedToggle;
        #endregion

        #region Inspector - Graphics
        [Header("Graphics")]
        [Tooltip("Dropdown for overall quality preset.")]
        public TMP_Dropdown QualityDropdown;

        [Tooltip("Toggle to show player name tags above avatars.")]
        public Toggle ShowPlayerNamesToggle;

        [Tooltip("Toggle to show chat bubble speech above avatars.")]
        public Toggle ShowChatBubblesToggle;

        [Tooltip("Slider for render distance (meters).")]
        public Slider RenderDistanceSlider;
        #endregion

        #region Inspector - Social
        [Header("Social")]
        [Tooltip("Toggle to allow incoming friend requests.")]
        public Toggle AcceptFriendRequestsToggle;

        [Tooltip("Toggle to allow room invites.")]
        public Toggle AllowRoomInvitesToggle;

        [Tooltip("Toggle to allow party invites.")]
        public Toggle AllowPartyInvitesToggle;

        [Tooltip("Toggle to allow trade requests.")]
        public Toggle AllowTradeRequestsToggle;

        [Tooltip("Toggle to show online status to friends.")]
        public Toggle ShowOnlineStatusToggle;

        [Tooltip("Dropdown for privacy level (Public, Friends Only, Private).")]
        public TMP_Dropdown PrivacyDropdown;
        #endregion

        #region Inspector - Account
        [Header("Account")]
        [Tooltip("Button to link external account (Google, Apple, etc.).")]
        public Button LinkAccountButton;

        [Tooltip("Button to open the change password flow.")]
        public Button ChangePasswordButton;

        [Tooltip("Button to initiate account deletion.")]
        public Button DeleteAccountButton;

        [Tooltip("Text displaying the local player's unique ID.")]
        public TMP_Text PlayerIdText;
        #endregion

        #region State
        private GameSettings _settings = new();
        private int _selectedTabIndex = 0;
        private bool _isDirty = false;
        private readonly string[] _tabNames = { "General", "Audio", "Graphics", "Social", "Account" };
        #endregion

        #region Events
        /// <summary>
        /// Fired when settings are saved successfully.
        /// </summary>
        public event Action OnSettingsSaved;
        #endregion

        #region Unity Lifecycle
        protected override void Awake()
        {
            base.Awake();
            WireEventListeners();
        }
        #endregion

        #region Public API
        /// <summary>
        /// Called when the panel is about to be shown. Loads current settings and refreshes UI.
        /// </summary>
        public override void OnPanelShow()
        {
            base.OnPanelShow();
            LoadSettings();
            ShowTab(0);
        }

        /// <summary>
        /// Saves the current settings to persistent storage and publishes a save event.
        /// </summary>
        public void SaveSettings()
        {
            // Sync UI values into _settings
            SyncUItoModel();

            // TODO: Replace with actual save to PlayerPrefs or backend
            PlayerPrefs.SetString("KawaiiCool_Settings", JsonUtility.ToJson(_settings));
            PlayerPrefs.Save();

            // Apply audio volumes immediately
            ApplyAudioSettings();
            ApplyGraphicsSettings();

            _isDirty = false;
            OnSettingsSaved?.Invoke();
            UIManager.Instance?.ShowToast("Settings saved!", ToastType.Success, 2f);

            EventBus.Instance?.Publish(new SaveCompletedEvent
            {
                Success = true,
                Key = "settings",
                ErrorMessage = string.Empty
            });
        }

        /// <summary>
        /// Resets all settings to their default values and updates the UI.
        /// </summary>
        public void ResetToDefaults()
        {
            UIManager.Instance?.ShowPopup(
                "Reset Settings",
                "Are you sure you want to reset all settings to their default values?",
                PopupType.Confirm,
                onConfirm: () =>
                {
                    _settings = new GameSettings();
                    SyncModelToUI();
                    SaveSettings();
                    UIManager.Instance?.ShowToast("Settings reset to defaults.", ToastType.Info, 2f);
                }
            );
        }

        /// <summary>
        /// Loads settings from persistent storage and updates the UI.
        /// </summary>
        public void LoadSettings()
        {
            string json = PlayerPrefs.GetString("KawaiiCool_Settings", string.Empty);
            if (!string.IsNullOrEmpty(json))
            {
                try
                {
                    _settings = JsonUtility.FromJson<GameSettings>(json) ?? new GameSettings();
                }
                catch (Exception ex)
                {
                    Debug.LogError($"[SettingsPanel] Failed to load settings: {ex.Message}");
                    _settings = new GameSettings();
                }
            }
            else
            {
                _settings = new GameSettings();
            }

            SyncModelToUI();
            _isDirty = false;

            if (PlayerIdText != null)
                PlayerIdText.text = $"ID: {SystemInfo.deviceUniqueIdentifier}";
        }

        /// <summary>
        /// Called when the back button (Escape) is pressed. Goes back to the General tab or closes.
        /// </summary>
        /// <returns>True if the back press was handled.</returns>
        public override bool OnBackPressed()
        {
            if (_selectedTabIndex > 0)
            {
                ShowTab(0);
                return true;
            }

            if (_isDirty)
            {
                UIManager.Instance?.ShowPopup(
                    "Unsaved Changes",
                    "You have unsaved changes. Save before closing?",
                    PopupType.Confirm,
                    onConfirm: () =>
                    {
                        SaveSettings();
                        Hide(true);
                    },
                    onCancel: () => Hide(true)
                );
                return true;
            }

            return base.OnBackPressed();
        }
        #endregion

        #region Private Implementation
        /// <summary>
        /// Wires all UI toggle, slider, and button event listeners.
        /// </summary>
        private void WireEventListeners()
        {
            if (GeneralTab != null)
                GeneralTab.onValueChanged.AddListener(isOn => { if (isOn) ShowTab(0); });
            if (AudioTab != null)
                AudioTab.onValueChanged.AddListener(isOn => { if (isOn) ShowTab(1); });
            if (GraphicsTab != null)
                GraphicsTab.onValueChanged.AddListener(isOn => { if (isOn) ShowTab(2); });
            if (SocialTab != null)
                SocialTab.onValueChanged.AddListener(isOn => { if (isOn) ShowTab(3); });
            if (AccountTab != null)
                AccountTab.onValueChanged.AddListener(isOn => { if (isOn) ShowTab(4); });

            // Mark dirty on any change
            if (NotificationsToggle != null)
                NotificationsToggle.onValueChanged.AddListener(_ => OnSettingChanged());
            if (AutoFollowLeaderToggle != null)
                AutoFollowLeaderToggle.onValueChanged.AddListener(_ => OnSettingChanged());
            if (TextSizeSlider != null)
                TextSizeSlider.onValueChanged.AddListener(_ => OnSettingChanged());
            if (LanguageDropdown != null)
                LanguageDropdown.onValueChanged.AddListener(_ => OnSettingChanged());

            if (MasterVolumeSlider != null)
                MasterVolumeSlider.onValueChanged.AddListener(_ => OnSettingChanged());
            if (MusicVolumeSlider != null)
                MusicVolumeSlider.onValueChanged.AddListener(_ => OnSettingChanged());
            if (SFXVolumeSlider != null)
                SFXVolumeSlider.onValueChanged.AddListener(_ => OnSettingChanged());
            if (VoiceVolumeSlider != null)
                VoiceVolumeSlider.onValueChanged.AddListener(_ => OnSettingChanged());
            if (MuteWhenMinimizedToggle != null)
                MuteWhenMinimizedToggle.onValueChanged.AddListener(_ => OnSettingChanged());

            if (QualityDropdown != null)
                QualityDropdown.onValueChanged.AddListener(_ => OnSettingChanged());
            if (ShowPlayerNamesToggle != null)
                ShowPlayerNamesToggle.onValueChanged.AddListener(_ => OnSettingChanged());
            if (ShowChatBubblesToggle != null)
                ShowChatBubblesToggle.onValueChanged.AddListener(_ => OnSettingChanged());
            if (RenderDistanceSlider != null)
                RenderDistanceSlider.onValueChanged.AddListener(_ => OnSettingChanged());

            if (AcceptFriendRequestsToggle != null)
                AcceptFriendRequestsToggle.onValueChanged.AddListener(_ => OnSettingChanged());
            if (AllowRoomInvitesToggle != null)
                AllowRoomInvitesToggle.onValueChanged.AddListener(_ => OnSettingChanged());
            if (AllowPartyInvitesToggle != null)
                AllowPartyInvitesToggle.onValueChanged.AddListener(_ => OnSettingChanged());
            if (AllowTradeRequestsToggle != null)
                AllowTradeRequestsToggle.onValueChanged.AddListener(_ => OnSettingChanged());
            if (ShowOnlineStatusToggle != null)
                ShowOnlineStatusToggle.onValueChanged.AddListener(_ => OnSettingChanged());
            if (PrivacyDropdown != null)
                PrivacyDropdown.onValueChanged.AddListener(_ => OnSettingChanged());

            if (LinkAccountButton != null)
                LinkAccountButton.onClick.AddListener(OnLinkAccountClicked);
            if (ChangePasswordButton != null)
                ChangePasswordButton.onClick.AddListener(OnChangePasswordClicked);
            if (DeleteAccountButton != null)
                DeleteAccountButton.onClick.AddListener(OnDeleteAccountClicked);
        }

        /// <summary>
        /// Marks settings as dirty and shows a subtle unsaved indicator.
        /// </summary>
        private void OnSettingChanged()
        {
            _isDirty = true;
        }

        /// <summary>
        /// Switches to the specified settings tab.
        /// </summary>
        /// <param name="tabIndex">0=General, 1=Audio, 2=Graphics, 3=Social, 4=Account</param>
        private void ShowTab(int tabIndex)
        {
            _selectedTabIndex = Mathf.Clamp(tabIndex, 0, 4);
            // TODO: Show/hide tab content panels if using separate panels per tab
        }

        /// <summary>
        /// Syncs the current UI control values into the <see cref="GameSettings"/> model.
        /// </summary>
        private void SyncUItoModel()
        {
            _settings.NotificationsEnabled = NotificationsToggle?.isOn ?? true;
            _settings.AutoFollowLeader = AutoFollowLeaderToggle?.isOn ?? false;
            _settings.TextSize = TextSizeSlider?.value ?? 1f;
            _settings.LanguageIndex = LanguageDropdown?.value ?? 0;

            _settings.MasterVolume = MasterVolumeSlider?.value ?? 1f;
            _settings.MusicVolume = MusicVolumeSlider?.value ?? 0.8f;
            _settings.SFXVolume = SFXVolumeSlider?.value ?? 0.8f;
            _settings.VoiceVolume = VoiceVolumeSlider?.value ?? 1f;
            _settings.MuteWhenMinimized = MuteWhenMinimizedToggle?.isOn ?? true;

            _settings.QualityLevel = QualityDropdown?.value ?? 2;
            _settings.ShowPlayerNames = ShowPlayerNamesToggle?.isOn ?? true;
            _settings.ShowChatBubbles = ShowChatBubblesToggle?.isOn ?? true;
            _settings.RenderDistance = RenderDistanceSlider?.value ?? 100f;

            _settings.AcceptFriendRequests = AcceptFriendRequestsToggle?.isOn ?? true;
            _settings.AllowRoomInvites = AllowRoomInvitesToggle?.isOn ?? true;
            _settings.AllowPartyInvites = AllowPartyInvitesToggle?.isOn ?? true;
            _settings.AllowTradeRequests = AllowTradeRequestsToggle?.isOn ?? true;
            _settings.ShowOnlineStatus = ShowOnlineStatusToggle?.isOn ?? true;
            _settings.PrivacyLevel = PrivacyDropdown?.value ?? 0;
        }

        /// <summary>
        /// Syncs the <see cref="GameSettings"/> model values into the UI controls.
        /// </summary>
        private void SyncModelToUI()
        {
            if (NotificationsToggle != null) NotificationsToggle.isOn = _settings.NotificationsEnabled;
            if (AutoFollowLeaderToggle != null) AutoFollowLeaderToggle.isOn = _settings.AutoFollowLeader;
            if (TextSizeSlider != null) TextSizeSlider.value = _settings.TextSize;
            if (LanguageDropdown != null) LanguageDropdown.value = _settings.LanguageIndex;

            if (MasterVolumeSlider != null) MasterVolumeSlider.value = _settings.MasterVolume;
            if (MusicVolumeSlider != null) MusicVolumeSlider.value = _settings.MusicVolume;
            if (SFXVolumeSlider != null) SFXVolumeSlider.value = _settings.SFXVolume;
            if (VoiceVolumeSlider != null) VoiceVolumeSlider.value = _settings.VoiceVolume;
            if (MuteWhenMinimizedToggle != null) MuteWhenMinimizedToggle.isOn = _settings.MuteWhenMinimized;

            if (QualityDropdown != null) QualityDropdown.value = _settings.QualityLevel;
            if (ShowPlayerNamesToggle != null) ShowPlayerNamesToggle.isOn = _settings.ShowPlayerNames;
            if (ShowChatBubblesToggle != null) ShowChatBubblesToggle.isOn = _settings.ShowChatBubbles;
            if (RenderDistanceSlider != null) RenderDistanceSlider.value = _settings.RenderDistance;

            if (AcceptFriendRequestsToggle != null) AcceptFriendRequestsToggle.isOn = _settings.AcceptFriendRequests;
            if (AllowRoomInvitesToggle != null) AllowRoomInvitesToggle.isOn = _settings.AllowRoomInvites;
            if (AllowPartyInvitesToggle != null) AllowPartyInvitesToggle.isOn = _settings.AllowPartyInvites;
            if (AllowTradeRequestsToggle != null) AllowTradeRequestsToggle.isOn = _settings.AllowTradeRequests;
            if (ShowOnlineStatusToggle != null) ShowOnlineStatusToggle.isOn = _settings.ShowOnlineStatus;
            if (PrivacyDropdown != null) PrivacyDropdown.value = _settings.PrivacyLevel;
        }

        /// <summary>
        /// Applies audio volume settings to the audio mixer or AudioManager.
        /// </summary>
        private void ApplyAudioSettings()
        {
            // TODO: Integrate with AudioManager to set mixer group volumes
            // AudioManager.Instance?.SetMasterVolume(_settings.MasterVolume);
            // AudioManager.Instance?.SetMusicVolume(_settings.MusicVolume);
            // AudioManager.Instance?.SetSFXVolume(_settings.SFXVolume);
            // AudioManager.Instance?.SetVoiceVolume(_settings.VoiceVolume);
        }

        /// <summary>
        /// Applies graphics settings to the rendering pipeline.
        /// </summary>
        private void ApplyGraphicsSettings()
        {
            if (QualityDropdown != null)
                QualitySettings.SetQualityLevel(_settings.QualityLevel, true);

            // TODO: Apply render distance to camera far clip plane
            // TODO: Toggle player name tags and chat bubbles in world
        }

        /// <summary>
        /// Handles the link account button click.
        /// </summary>
        private void OnLinkAccountClicked()
        {
            UIManager.Instance?.ShowPopup(
                "Link Account",
                "Choose a platform to link your account to:",
                PopupType.Info
            );
        }

        /// <summary>
        /// Handles the change password button click.
        /// </summary>
        private void OnChangePasswordClicked()
        {
            UIManager.Instance?.ShowPopup(
                "Change Password",
                "A password reset link will be sent to your registered email.",
                PopupType.Confirm,
                onConfirm: () => UIManager.Instance?.ShowToast("Reset link sent!", ToastType.Success, 2f)
            );
        }

        /// <summary>
        /// Handles the delete account button click with a confirmation guard.
        /// </summary>
        private void OnDeleteAccountClicked()
        {
            UIManager.Instance?.ShowPopup(
                "Delete Account",
                "WARNING: This action is permanent and cannot be undone. All progress will be lost. Are you absolutely sure?",
                PopupType.Confirm,
                onConfirm: () =>
                {
                    UIManager.Instance?.ShowPopup(
                        "Final Confirmation",
                        "Please type DELETE in the popup input to confirm account deletion.",
                        PopupType.Input,
                        onConfirm: () => UIManager.Instance?.ShowToast("Account deletion request submitted.", ToastType.Warning, 3f)
                    );
                }
            );
        }
        #endregion
    }
}
