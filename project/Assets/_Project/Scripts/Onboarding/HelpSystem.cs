using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace KawaiiCool.Onboarding
{
    /// <summary>
    /// Represents a single help topic entry in the knowledge base.
    /// </summary>
    [System.Serializable]
    public class HelpTopic
    {
        [Tooltip("Unique identifier for this help topic.")]
        public string TopicId;

        [Tooltip("Display title of the help topic.")]
        public string Title;

        [Tooltip("Category grouping for filtering and organization.")]
        public string Category;

        [Tooltip("Full help content text (supports RichText).")]
        public string Content;

        [Tooltip("List of related topic IDs for cross-linking.")]
        public List<string> RelatedTopics = new List<string>();

        [Tooltip("Optional icon sprite for the topic list item.")]
        public Sprite Icon;
    }

    /// <summary>
    /// Provides an in-game help panel, knowledge base search, and
    /// contextual quick-help system for KawaiiCool Island players.
    /// </summary>
    public class HelpSystem : MonoBehaviour
    {
        // ─────────────────────────────────────────────────────────────────
        //  Help Panel
        // ─────────────────────────────────────────────────────────────────
        [Header("Help Panel")]
        [SerializeField, Tooltip("Root GameObject for the help panel.")]
        private GameObject _helpPanel;

        [SerializeField, Tooltip("Input field for searching help topics.")]
        private TMP_InputField _searchInput;

        [SerializeField, Tooltip("Scrollable container where topic buttons are instantiated.")]
        private Transform _topicsContainer;

        [SerializeField, Tooltip("Prefab instantiated for each topic in the topics list.")]
        private GameObject _topicItemPrefab;

        [SerializeField, Tooltip("Panel that displays the selected topic's full content.")]
        private GameObject _contentPanel;

        [SerializeField, Tooltip("Text component displaying the selected topic's content.")]
        private TMP_Text _contentText;

        // ─────────────────────────────────────────────────────────────────
        //  Topics
        // ─────────────────────────────────────────────────────────────────
        [Header("Topics")]
        [SerializeField, Tooltip("Master list of all help topics available in the knowledge base.")]
        private List<HelpTopic> _topics = new List<HelpTopic>();

        // ─────────────────────────────────────────────────────────────────
        //  Quick Help
        // ─────────────────────────────────────────────────────────────────
        [Header("Quick Help")]
        [SerializeField, Tooltip("Button that opens the quick-help overlay for the current context.")]
        private Button _quickHelpButton;

        [SerializeField, Tooltip("Panel shown for quick contextual help tips.")]
        private GameObject _quickHelpPanel;

        [SerializeField, Tooltip("Topic IDs that are relevant for the current gameplay context.")]
        private List<string> _contextualHelpIds = new List<string>();

        // ─────────────────────────────────────────────────────────────────
        //  Internal State
        // ─────────────────────────────────────────────────────────────────
        private List<GameObject> _topicItems = new List<GameObject>();
        private string _currentTopicId;

        // ─────────────────────────────────────────────────────────────────
        //  Lifecycle
        // ─────────────────────────────────────────────────────────────────
        private void Start()
        {
            if (_helpPanel != null)
                _helpPanel.SetActive(false);
            if (_quickHelpPanel != null)
                _quickHelpPanel.SetActive(false);

            if (_searchInput != null)
                _searchInput.onValueChanged.AddListener(OnSearchValueChanged);

            if (_quickHelpButton != null)
                _quickHelpButton.onClick.AddListener(ShowContextualHelpFromButton);
        }

        private void OnDestroy()
        {
            if (_searchInput != null)
                _searchInput.onValueChanged.RemoveListener(OnSearchValueChanged);
            if (_quickHelpButton != null)
                _quickHelpButton.onClick.RemoveListener(ShowContextualHelpFromButton);
        }

        // ─────────────────────────────────────────────────────────────────
        //  Public API — Panel Control
        // ─────────────────────────────────────────────────────────────────
        /// <summary>
        /// Opens the full help panel and populates the topics list.
        /// </summary>
        public void ShowHelp()
        {
            if (_helpPanel == null) return;
            _helpPanel.SetActive(true);
            PopulateTopics();
        }

        /// <summary>
        /// Closes the help panel.
        /// </summary>
        public void HideHelp()
        {
            if (_helpPanel != null)
                _helpPanel.SetActive(false);
        }

        /// <summary>
        /// Searches help topics by query and updates the topics list.
        /// </summary>
        /// <param name="query">Search string to filter topics by title, category, or content.</param>
        public void SearchHelp(string query)
        {
            FilterTopics(query);
        }

        /// <summary>
        /// Displays the content of a specific help topic.
        /// </summary>
        /// <param name="topicId">The unique identifier of the topic to display.</param>
        public void ShowTopic(string topicId)
        {
            HelpTopic topic = FindTopic(topicId);
            if (topic == null)
            {
                Debug.LogWarning($"[HelpSystem] Topic not found: {topicId}");
                return;
            }

            _currentTopicId = topicId;
            if (_contentText != null)
                _contentText.text = $"<b><size=24>{topic.Title}</size></b>\n\n{topic.Content}";

            if (_contentPanel != null)
                _contentPanel.SetActive(true);
        }

        /// <summary>
        /// Shows contextual help based on the current gameplay situation.
        /// </summary>
        /// <param name="context">A context string identifying the current situation.</param>
        public void ShowContextualHelp(string context)
        {
            if (_quickHelpPanel != null)
                _quickHelpPanel.SetActive(true);

            // Try to find a topic matching the context.
            HelpTopic bestMatch = null;
            foreach (var topic in _topics)
            {
                if (topic.TopicId.Equals(context, System.StringComparison.OrdinalIgnoreCase) ||
                    topic.Category.Equals(context, System.StringComparison.OrdinalIgnoreCase))
                {
                    bestMatch = topic;
                    break;
                }
            }

            if (bestMatch != null && _contentText != null)
            {
                _contentText.text = $"<b>{bestMatch.Title}</b>\n\n{bestMatch.Content}";
            }
            else
            {
                if (_contentText != null)
                    _contentText.text = "No specific help available for this context. Try searching the help panel.";
            }
        }

        /// <summary>
        /// Shows help about game controls.
        /// </summary>
        public void ShowControlsHelp()
        {
            ShowTopic("controls");
        }

        /// <summary>
        /// Shows help about player safety and moderation.
        /// </summary>
        public void ShowSafetyHelp()
        {
            ShowTopic("safety");
        }

        /// <summary>
        /// Shows help about the trading system.
        /// </summary>
        public void ShowTradingHelp()
        {
            ShowTopic("trading");
        }

        /// <summary>
        /// Shows help about moderation tools and reporting.
        /// </summary>
        public void ShowModerationHelp()
        {
            ShowTopic("moderation");
        }

        // ─────────────────────────────────────────────────────────────────
        //  Private Helpers
        // ─────────────────────────────────────────────────────────────────
        private void PopulateTopics()
        {
            ClearTopicItems();
            foreach (var topic in _topics)
            {
                CreateTopicItem(topic);
            }
        }

        private void FilterTopics(string query)
        {
            ClearTopicItems();
            string q = query?.ToLowerInvariant() ?? "";
            foreach (var topic in _topics)
            {
                if (string.IsNullOrEmpty(q) ||
                    topic.Title.ToLowerInvariant().Contains(q) ||
                    topic.Category.ToLowerInvariant().Contains(q) ||
                    topic.Content.ToLowerInvariant().Contains(q))
                {
                    CreateTopicItem(topic);
                }
            }
        }

        private void CreateTopicItem(HelpTopic topic)
        {
            if (_topicItemPrefab == null || _topicsContainer == null) return;

            GameObject item = Instantiate(_topicItemPrefab, _topicsContainer);
            item.name = $"Topic_{topic.TopicId}";

            var titleText = item.GetComponentInChildren<TMP_Text>();
            if (titleText != null)
                titleText.text = topic.Title;

            var iconImg = item.transform.Find("Icon")?.GetComponent<Image>();
            if (iconImg != null)
                iconImg.sprite = topic.Icon;

            var button = item.GetComponent<Button>();
            if (button == null)
                button = item.GetComponentInChildren<Button>();
            if (button != null)
            {
                string capturedId = topic.TopicId;
                button.onClick.AddListener(() => ShowTopic(capturedId));
            }

            _topicItems.Add(item);
        }

        private void ClearTopicItems()
        {
            foreach (var item in _topicItems)
            {
                if (item != null)
                    Destroy(item);
            }
            _topicItems.Clear();
        }

        private HelpTopic FindTopic(string topicId)
        {
            if (string.IsNullOrEmpty(topicId)) return null;
            foreach (var topic in _topics)
            {
                if (topic.TopicId.Equals(topicId, System.StringComparison.OrdinalIgnoreCase))
                    return topic;
            }
            return null;
        }

        private void OnSearchValueChanged(string value)
        {
            FilterTopics(value);
        }

        private void ShowContextualHelpFromButton()
        {
            if (_contextualHelpIds.Count > 0)
                ShowContextualHelp(_contextualHelpIds[0]);
            else
                ShowContextualHelp("general");
        }

        // ─────────────────────────────────────────────────────────────────
        //  Debug Helpers
        // ─────────────────────────────────────────────────────────────────
        /// <summary>
        /// Debug helper to open the help panel directly from the editor.
        /// </summary>
        [ContextMenu("Debug Show Help")]
        public void DebugShowHelp()
        {
            ShowHelp();
        }
    }
}
