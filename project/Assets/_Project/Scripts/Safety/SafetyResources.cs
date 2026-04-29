using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace KawaiiCool.Safety
{
    /// <summary>
    /// Represents a single help or safety topic displayed in the safety resources panel.
    /// </summary>
    [Serializable]
    public class SafetyTopic
    {
        /// <summary>
        /// Unique machine-readable identifier for the topic (e.g. "bullying", "privacy", "scams").
        /// </summary>
        public string TopicId;

        /// <summary>
        /// Localised display title for the topic.
        /// </summary>
        public string Title;

        /// <summary>
        /// Detailed educational content explaining the topic and how to stay safe.
        /// </summary>
        public string Content;

        /// <summary>
        /// Optional icon sprite for visual identification in the UI.
        /// </summary>
        public Sprite Icon;

        /// <summary>
        /// Optional URL to an external help article (opened in an in-app browser or device browser).
        /// </summary>
        public string ExternalUrl;
    }

    /// <summary>
    /// In-game safety hub that surfaces help topics, reporting flows, blocking controls,
    /// and quick-access moderation tools. Designed to be easily discoverable from the main HUD.
    /// </summary>
    public class SafetyResources : MonoBehaviour
    {
        #region Inspector — Resources

        [Header("Resources")]
        [Tooltip("Safety and help topics available in the safety panel.")]
        public List<SafetyTopic> Topics = new List<SafetyTopic>
        {
            new SafetyTopic
            {
                TopicId = "online_safety",
                Title = "Online Safety",
                Content = "Never share your real name, address, phone number, or school with other players. " +
                          "Be careful about what you share in your profile or in chat."
            },
            new SafetyTopic
            {
                TopicId = "bullying",
                Title = "Bullying & Harassment",
                Content = "If someone is being mean or making you uncomfortable, use the Block button to stop them " +
                          "from contacting you. You can also Report them to our moderation team."
            },
            new SafetyTopic
            {
                TopicId = "scams",
                Title = "Scams & Phishing",
                Content = "Never click on links from other players promising free items or currency. " +
                          "Official messages from us will never ask for your password."
            },
            new SafetyTopic
            {
                TopicId = "reporting",
                Title = "How to Report",
                Content = "You can report a player by clicking their avatar and selecting 'Report'. " +
                          "Our team reviews every report and takes action when needed."
            },
            new SafetyTopic
            {
                TopicId = "privacy",
                Title = "Privacy Settings",
                Content = "You can control who sees your profile, who can send you friend requests, " +
                          "and who can whisper you from the Settings menu."
            },
            new SafetyTopic
            {
                TopicId = "parents",
                Title = "For Parents & Guardians",
                Content = "Learn about our child safety features, time limits, and purchase controls. " +
                          "Visit our Parent Portal for more information."
            }
        };

        [Tooltip("Button that opens the main safety panel from the HUD.")]
        public Button SafetyButton;

        [Tooltip("Root GameObject for the safety resources panel.")]
        public GameObject SafetyPanel;

        #endregion

        #region Inspector — Reporting

        [Header("Reporting")]
        [Tooltip("Button that initiates the player-reporting flow.")]
        public Button ReportPlayerButton;

        [Tooltip("Button that opens the bug-reporting interface.")]
        public Button ReportBugButton;

        [Tooltip("Button that opens the support contact form or external support site.")]
        public Button ContactSupportButton;

        #endregion

        #region Inspector — Quick Controls

        [Header("Quick Controls")]
        [Tooltip("Button that blocks the currently targeted player.")]
        public Button BlockPlayerButton;

        [Tooltip("Button that mutes the currently targeted player.")]
        public Button MutePlayerButton;

        [Tooltip("Button that toggles ignoring all incoming invites (friend, trade, room).")]
        public Button IgnoreInvitesButton;

        [Tooltip("Button that opens the block-list manager.")]
        public Button ViewBlockListButton;

        #endregion

        #region Inspector — Topic UI

        [Header("Topic UI")]
        [Tooltip("Parent transform for dynamically created topic buttons.")]
        public Transform TopicListParent;

        [Tooltip("Prefab for a single topic entry in the list.")]
        public GameObject TopicItemPrefab;

        [Tooltip("Text component that displays the currently selected topic's title.")]
        public TMPro.TMP_Text SelectedTopicTitle;

        [Tooltip("Text component that displays the currently selected topic's content.")]
        public TMPro.TMP_Text SelectedTopicContent;

        [Tooltip("Image component that displays the currently selected topic's icon.")]
        public Image SelectedTopicIcon;

        #endregion

        #region Internal State

        /// <summary>
        /// The player currently targeted for quick block/mute actions.
        /// </summary>
        private string _targetPlayerId;

        /// <summary>
        /// Whether incoming invites are currently being ignored.
        /// </summary>
        private bool _ignoringInvites;

        /// <summary>
        /// The most recently selected topic identifier.
        /// </summary>
        private string _currentTopicId;

        #endregion

        #region Unity Lifecycle

        private void Start()
        {
            if (SafetyPanel != null)
                SafetyPanel.SetActive(false);

            if (SafetyButton != null)
                SafetyButton.onClick.AddListener(ShowSafetyPanel);

            if (ReportPlayerButton != null)
                ReportPlayerButton.onClick.AddListener(OnReportPlayerClicked);

            if (ReportBugButton != null)
                ReportBugButton.onClick.AddListener(OnReportBugClicked);

            if (ContactSupportButton != null)
                ContactSupportButton.onClick.AddListener(OnContactSupportClicked);

            if (BlockPlayerButton != null)
                BlockPlayerButton.onClick.AddListener(OnBlockPlayerClicked);

            if (MutePlayerButton != null)
                MutePlayerButton.onClick.AddListener(OnMutePlayerClicked);

            if (IgnoreInvitesButton != null)
                IgnoreInvitesButton.onClick.AddListener(OnIgnoreInvitesClicked);

            if (ViewBlockListButton != null)
                ViewBlockListButton.onClick.AddListener(OnViewBlockListClicked);

            PopulateTopicList();
        }

        private void OnDestroy()
        {
            if (SafetyButton != null)
                SafetyButton.onClick.RemoveListener(ShowSafetyPanel);
            if (ReportPlayerButton != null)
                ReportPlayerButton.onClick.RemoveListener(OnReportPlayerClicked);
            if (ReportBugButton != null)
                ReportBugButton.onClick.RemoveListener(OnReportBugClicked);
            if (ContactSupportButton != null)
                ContactSupportButton.onClick.RemoveListener(OnContactSupportClicked);
            if (BlockPlayerButton != null)
                BlockPlayerButton.onClick.RemoveListener(OnBlockPlayerClicked);
            if (MutePlayerButton != null)
                MutePlayerButton.onClick.RemoveListener(OnMutePlayerClicked);
            if (IgnoreInvitesButton != null)
                IgnoreInvitesButton.onClick.RemoveListener(OnIgnoreInvitesClicked);
            if (ViewBlockListButton != null)
                ViewBlockListButton.onClick.RemoveListener(OnViewBlockListClicked);
        }

        #endregion

        #region Public API — Panel Visibility

        /// <summary>
        /// Opens the safety resources panel and populates the topic list.
        /// </summary>
        public void ShowSafetyPanel()
        {
            if (SafetyPanel != null)
                SafetyPanel.SetActive(true);

            PopulateTopicList();

            if (!string.IsNullOrEmpty(_currentTopicId))
                ShowTopic(_currentTopicId);
            else if (Topics.Count > 0)
                ShowTopic(Topics[0].TopicId);

            EventBus.Publish(new SafetyPanelOpenedEvent());
        }

        /// <summary>
        /// Closes the safety resources panel.
        /// </summary>
        public void HideSafetyPanel()
        {
            if (SafetyPanel != null)
                SafetyPanel.SetActive(false);

            EventBus.Publish(new SafetyPanelClosedEvent());
        }

        #endregion

        #region Public API — Topics

        /// <summary>
        /// Displays a specific safety topic by its identifier.
        /// </summary>
        /// <param name="topicId">The unique topic identifier.</param>
        public void ShowTopic(string topicId)
        {
            if (string.IsNullOrEmpty(topicId)) return;

            var topic = Topics.FirstOrDefault(t =>
                string.Equals(t.TopicId, topicId, StringComparison.OrdinalIgnoreCase));

            if (topic == null) return;

            _currentTopicId = topicId;

            if (SelectedTopicTitle != null)
                SelectedTopicTitle.text = topic.Title;

            if (SelectedTopicContent != null)
                SelectedTopicContent.text = topic.Content;

            if (SelectedTopicIcon != null)
                SelectedTopicIcon.sprite = topic.Icon;

            EventBus.Publish(new SafetyTopicViewedEvent(topicId, topic.Title));
        }

        /// <summary>
        /// Adds a custom safety topic at runtime (e.g. from a remote CMS update).
        /// </summary>
        /// <param name="topic">The topic to add.</param>
        public void AddTopic(SafetyTopic topic)
        {
            if (topic == null || string.IsNullOrEmpty(topic.TopicId)) return;
            Topics.Add(topic);
            PopulateTopicList();
        }

        #endregion

        #region Public API — Reporting

        /// <summary>
        /// Opens the player-reporting flow targeting a specific player.
        /// </summary>
        /// <param name="targetId">The player identifier to report.</param>
        public void ShowReportFlow(string targetId)
        {
            _targetPlayerId = targetId;

            if (ChatManager.Instance != null)
            {
                ChatManager.Instance.OpenReportUI(targetId);
            }
            else
            {
                Debug.LogWarning("[SafetyResources] ChatManager not available for report flow.");
            }

            EventBus.Publish(new ReportFlowOpenedEvent(targetId));
        }

        /// <summary>
        /// Opens the block confirmation dialog for a specific player.
        /// </summary>
        /// <param name="targetId">The player identifier to block.</param>
        public void ShowBlockConfirm(string targetId)
        {
            _targetPlayerId = targetId;

            // In production: show a confirmation modal before executing the block
            if (SocialGraphManager.Instance != null)
            {
                SocialGraphManager.Instance.BlockPlayer(targetId);
            }

            EventBus.Publish(new BlockActionEvent(targetId, true));
        }

        /// <summary>
        /// Performs a quick mute on the target player for a specified duration.
        /// </summary>
        /// <param name="targetId">The player identifier to mute.</param>
        /// <param name="duration">Mute duration in seconds.</param>
        public void QuickMute(string targetId, float duration)
        {
            _targetPlayerId = targetId;

            if (ChatManager.Instance != null)
            {
                ChatManager.Instance.MutePlayer(targetId, duration);
            }

            EventBus.Publish(new QuickMuteEvent(targetId, duration));
        }

        #endregion

        #region Private Event Handlers

        private void OnReportPlayerClicked()
        {
            if (!string.IsNullOrEmpty(_targetPlayerId))
            {
                ShowReportFlow(_targetPlayerId);
            }
            else
            {
                // Open report flow with no pre-selected target (user must search)
                if (ChatManager.Instance != null)
                    ChatManager.Instance.OpenReportUI(null);
            }
        }

        private void OnReportBugClicked()
        {
            // In production: open a bug-report form or redirect to external tracker
            Debug.Log("[SafetyResources] Bug report flow initiated.");
            EventBus.Publish(new BugReportOpenedEvent());
        }

        private void OnContactSupportClicked()
        {
            var supportTopic = Topics.FirstOrDefault(t =>
                string.Equals(t.TopicId, "parents", StringComparison.OrdinalIgnoreCase));

            if (supportTopic != null && !string.IsNullOrEmpty(supportTopic.ExternalUrl))
            {
                Application.OpenURL(supportTopic.ExternalUrl);
            }
            else
            {
                // Fallback generic support URL
                Application.OpenURL("https://support.kawaiicoolisland.com");
            }

            EventBus.Publish(new SupportContactEvent());
        }

        private void OnBlockPlayerClicked()
        {
            if (!string.IsNullOrEmpty(_targetPlayerId))
            {
                ShowBlockConfirm(_targetPlayerId);
            }
            else
            {
                Debug.LogWarning("[SafetyResources] No target player selected for block action.");
            }
        }

        private void OnMutePlayerClicked()
        {
            if (!string.IsNullOrEmpty(_targetPlayerId))
            {
                QuickMute(_targetPlayerId, 300f); // 5-minute default quick mute
            }
            else
            {
                Debug.LogWarning("[SafetyResources] No target player selected for mute action.");
            }
        }

        private void OnIgnoreInvitesClicked()
        {
            _ignoringInvites = !_ignoringInvites;

            if (SocialGraphManager.Instance != null)
            {
                SocialGraphManager.Instance.SetIgnoreInvites(_ignoringInvites);
            }

            if (IgnoreInvitesButton != null)
            {
                var colors = IgnoreInvitesButton.colors;
                colors.normalColor = _ignoringInvites ? Color.red : Color.white;
                IgnoreInvitesButton.colors = colors;
            }

            EventBus.Publish(new IgnoreInvitesToggledEvent(_ignoringInvites));
        }

        private void OnViewBlockListClicked()
        {
            if (SocialGraphManager.Instance != null)
            {
                SocialGraphManager.Instance.OpenBlockListUI();
            }
        }

        #endregion

        #region Private UI Helpers

        /// <summary>
        /// Populates the topic list with buttons for every registered <see cref="SafetyTopic"/>.
        /// </summary>
        private void PopulateTopicList()
        {
            if (TopicListParent == null || TopicItemPrefab == null) return;

            foreach (Transform child in TopicListParent)
                Destroy(child.gameObject);

            foreach (var topic in Topics)
            {
                if (topic == null) continue;

                var go = Instantiate(TopicItemPrefab, TopicListParent);
                var text = go.GetComponentInChildren<TMPro.TMP_Text>();
                if (text != null)
                    text.text = topic.Title;

                var icon = go.GetComponentInChildren<Image>();
                if (icon != null && topic.Icon != null)
                    icon.sprite = topic.Icon;

                var btn = go.GetComponent<Button>();
                if (btn == null) btn = go.GetComponentInChildren<Button>();
                if (btn != null)
                {
                    string capturedId = topic.TopicId;
                    btn.onClick.AddListener(() => ShowTopic(capturedId));
                }
            }
        }

        #endregion

        #region Public API — Target Management

        /// <summary>
        /// Sets the current target player for quick block/mute/report actions.
        /// Typically called when the local player clicks on another player's avatar.
        /// </summary>
        /// <param name="targetId">The target player's identifier.</param>
        public void SetTargetPlayer(string targetId)
        {
            _targetPlayerId = targetId;

            bool hasTarget = !string.IsNullOrEmpty(targetId);
            if (BlockPlayerButton != null) BlockPlayerButton.interactable = hasTarget;
            if (MutePlayerButton != null) MutePlayerButton.interactable = hasTarget;
            if (ReportPlayerButton != null) ReportPlayerButton.interactable = hasTarget;
        }

        /// <summary>
        /// Clears the current target player, disabling quick action buttons that require a target.
        /// </summary>
        public void ClearTargetPlayer()
        {
            _targetPlayerId = null;

            if (BlockPlayerButton != null) BlockPlayerButton.interactable = false;
            if (MutePlayerButton != null) MutePlayerButton.interactable = false;
            if (ReportPlayerButton != null) ReportPlayerButton.interactable = false;
        }

        #endregion

        #region EventBus Payloads

        /// <summary>
        /// Published when the safety panel is opened.
        /// </summary>
        public struct SafetyPanelOpenedEvent { }

        /// <summary>
        /// Published when the safety panel is closed.
        /// </summary>
        public struct SafetyPanelClosedEvent { }

        /// <summary>
        /// Published when a safety topic is viewed.
        /// </summary>
        public struct SafetyTopicViewedEvent
        {
            public readonly string TopicId;
            public readonly string Title;

            public SafetyTopicViewedEvent(string topicId, string title)
            {
                TopicId = topicId;
                Title = title;
            }
        }

        /// <summary>
        /// Published when the report flow is opened.
        /// </summary>
        public struct ReportFlowOpenedEvent
        {
            public readonly string TargetId;

            public ReportFlowOpenedEvent(string targetId)
            {
                TargetId = targetId;
            }
        }

        /// <summary>
        /// Published when the bug report interface is opened.
        /// </summary>
        public struct BugReportOpenedEvent { }

        /// <summary>
        /// Published when the support contact button is used.
        /// </summary>
        public struct SupportContactEvent { }

        /// <summary>
        /// Published when a player is blocked or unblocked.
        /// </summary>
        public struct BlockActionEvent
        {
            public readonly string TargetId;
            public readonly bool IsBlocked;

            public BlockActionEvent(string targetId, bool isBlocked)
            {
                TargetId = targetId;
                IsBlocked = isBlocked;
            }
        }

        /// <summary>
        /// Published when a quick mute is performed.
        /// </summary>
        public struct QuickMuteEvent
        {
            public readonly string TargetId;
            public readonly float Duration;

            public QuickMuteEvent(string targetId, float duration)
            {
                TargetId = targetId;
                Duration = duration;
            }
        }

        /// <summary>
        /// Published when the ignore-invites toggle is changed.
        /// </summary>
        public struct IgnoreInvitesToggledEvent
        {
            public readonly bool IsIgnoring;

            public IgnoreInvitesToggledEvent(bool isIgnoring)
            {
                IsIgnoring = isIgnoring;
            }
        }

        #endregion
    }
}
