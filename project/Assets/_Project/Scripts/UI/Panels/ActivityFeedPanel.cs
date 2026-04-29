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
    /// Categories for filtering the activity feed.
    /// </summary>
    public enum ActivityCategory
    {
        /// <summary>All activity types.</summary>
        All,
        /// <summary>Friend-related activities.</summary>
        Friends,
        /// <summary>Trending / popular activities.</summary>
        Trending,
        /// <summary>Game events and announcements.</summary>
        Events,
        /// <summary>System notifications.</summary>
        System
    }

    #endregion

    #region Data Models

    /// <summary>
    /// Immutable data holder for a single activity feed item.
    /// </summary>
    [System.Serializable]
    public class ActivityItem
    {
        /// <summary>Unique activity identifier.</summary>
        public string ActivityId;
        /// <summary>Player ID who performed the action.</summary>
        public string ActorId;
        /// <summary>Display name of the actor.</summary>
        public string ActorName;
        /// <summary>Avatar URL of the actor.</summary>
        public string ActorAvatarUrl;
        /// <summary>Short title of the activity.</summary>
        public string Title;
        /// <summary>Detailed description.</summary>
        public string Description;
        /// <summary>Unix timestamp when the activity occurred.</summary>
        public long Timestamp;
        /// <summary>Action button label (e.g., "Join", "View"). Null if no action.</summary>
        public string ActionLabel;
        /// <summary>Payload ID for the action (room ID, player ID, etc.).</summary>
        public string ActionTargetId;
        /// <summary>Activity category for filtering.</summary>
        public ActivityCategory Category;
        /// <summary>True if this activity has not been viewed yet.</summary>
        public bool IsUnread;
    }

    #endregion

    /// <summary>
    /// Social activity feed panel that displays a scrolling list of recent activities
    /// from friends, trending events, and system notifications. Supports filtering,
    /// unread indicators, and interactive actions on feed items.
    /// </summary>
    public class ActivityFeedPanel : UIPanel
    {
        #region Inspector - Feed
        [Header("Feed")]
        [Tooltip("Container Transform that holds instantiated activity items.")]
        public Transform FeedContainer;

        [Tooltip("Prefab used to create each activity feed entry.")]
        public GameObject ActivityItemPrefab;

        [Tooltip("ScrollRect component for the activity feed.")]
        public ScrollRect FeedScrollRect;
        #endregion

        #region Inspector - Filters
        [Header("Filters")]
        [Tooltip("Toggle for viewing all activities.")]
        public Toggle AllToggle;

        [Tooltip("Toggle for viewing friend activities only.")]
        public Toggle FriendsToggle;

        [Tooltip("Toggle for viewing trending activities.")]
        public Toggle TrendingToggle;

        [Tooltip("Toggle for viewing game events.")]
        public Toggle EventsToggle;

        [Tooltip("Toggle for viewing system notifications.")]
        public Toggle SystemToggle;
        #endregion

        #region Inspector - Empty State
        [Header("Empty State")]
        [Tooltip("GameObject shown when the feed is empty.")]
        public GameObject EmptyState;

        [Tooltip("Text explaining the empty state.")]
        public TMP_Text EmptyText;
        #endregion

        #region Inspector - Item UI
        [Header("Item UI")]
        [Tooltip("Avatar image on the activity item template.")]
        public Image ActorAvatar;

        [Tooltip("Title text on the activity item template.")]
        public TMP_Text TitleText;

        [Tooltip("Description text on the activity item template.")]
        public TMP_Text DescriptionText;

        [Tooltip("Relative time text on the activity item template.")]
        public TMP_Text TimeText;

        [Tooltip("Action button on the activity item template.")]
        public Button ActionButton;

        [Tooltip("Unread dot indicator on the activity item template.")]
        public Image UnreadIndicator;
        #endregion

        #region State
        private readonly List<ActivityItem> _allActivities = new();
        private readonly List<ActivityItem> _displayedActivities = new();
        private ActivityCategory _currentCategory = ActivityCategory.All;
        private readonly Dictionary<string, GameObject> _activityItemMap = new();
        #endregion

        #region Events
        /// <summary>
        /// Fired when an activity feed item is clicked/selected.
        /// </summary>
        public event Action<string> OnActivitySelected;
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
            EventBus.Instance?.Subscribe<MinigameCompletedEvent>(OnMinigameCompleted);
        }

        private void OnDisable()
        {
            EventBus.Instance?.Unsubscribe<FriendStatusChangedEvent>(OnFriendStatusChanged);
            EventBus.Instance?.Unsubscribe<MinigameCompletedEvent>(OnMinigameCompleted);
        }
        #endregion

        #region EventBus Handlers
        /// <summary>
        /// Adds an activity when a friend's status changes (e.g., comes online).
        /// </summary>
        private void OnFriendStatusChanged(FriendStatusChangedEvent evt)
        {
            if (evt.IsOnline)
            {
                AddActivityItem(new ActivityItem
                {
                    ActivityId = Guid.NewGuid().ToString(),
                    ActorId = evt.FriendId,
                    ActorName = evt.FriendId, // TODO: Resolve name from friend list
                    Title = "Friend Online",
                    Description = $"{evt.FriendId} is now online!",
                    Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                    Category = ActivityCategory.Friends,
                    IsUnread = true
                });
            }
        }

        /// <summary>
        /// Adds an activity when a minigame completes with a notable result.
        /// </summary>
        private void OnMinigameCompleted(MinigameCompletedEvent evt)
        {
            if (evt.FinalRank <= 3)
            {
                AddActivityItem(new ActivityItem
                {
                    ActivityId = Guid.NewGuid().ToString(),
                    ActorId = "local_player",
                    ActorName = "You",
                    Title = "Minigame Victory!",
                    Description = $"You ranked #{evt.FinalRank} and earned {evt.CoinsAwarded} coins!",
                    Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                    Category = ActivityCategory.Trending,
                    ActionLabel = "Replay",
                    ActionTargetId = evt.MinigameId,
                    IsUnread = true
                });
            }
        }
        #endregion

        #region Public API
        /// <summary>
        /// Called when the panel is about to be shown. Loads activity data and refreshes UI.
        /// </summary>
        public override void OnPanelShow()
        {
            base.OnPanelShow();
            LoadActivityData();
            RefreshFeed();
        }

        /// <summary>
        /// Refreshes the activity feed from data source and reapplies filters.
        /// </summary>
        public void RefreshFeed()
        {
            ApplyCategoryFilter();
            PopulateFeed();
            UpdateEmptyState();
        }

        /// <summary>
        /// Filters the feed by the specified category.
        /// </summary>
        /// <param name="category">The activity category to display.</param>
        public void FilterByCategory(ActivityCategory category)
        {
            _currentCategory = category;
            RefreshFeed();
        }

        /// <summary>
        /// Called when an activity item is clicked.
        /// </summary>
        /// <param name="activityId">The unique activity identifier.</param>
        public void OnActivityClicked(string activityId)
        {
            if (string.IsNullOrEmpty(activityId)) return;

            var activity = _allActivities.FirstOrDefault(a => a.ActivityId == activityId);
            if (activity != null && activity.IsUnread)
            {
                activity.IsUnread = false;
                RefreshFeed();
            }

            OnActivitySelected?.Invoke(activityId);
        }

        /// <summary>
        /// Marks all activities as read and refreshes the UI.
        /// </summary>
        public void MarkAllRead()
        {
            foreach (var activity in _allActivities)
                activity.IsUnread = false;
            RefreshFeed();
            UIManager.Instance?.ShowToast("All activities marked as read.", ToastType.Success, 2f);
        }

        /// <summary>
        /// Clears all activities from the feed.
        /// </summary>
        public void ClearFeed()
        {
            _allActivities.Clear();
            RefreshFeed();
            UIManager.Instance?.ShowToast("Feed cleared.", ToastType.Info, 1.5f);
        }

        /// <summary>
        /// Called when the device type changes. Adjusts feed item sizing for mobile vs desktop.
        /// </summary>
        /// <param name="deviceType">The new device type.</param>
        public override void OnDeviceTypeChanged(DeviceType deviceType)
        {
            base.OnDeviceTypeChanged(deviceType);
            if (FeedContainer == null) return;

            var layout = FeedContainer.GetComponent<VerticalLayoutGroup>();
            if (layout != null)
            {
                layout.spacing = deviceType == DeviceType.Mobile ? 16f : 12f;
                layout.padding = deviceType == DeviceType.Mobile
                    ? new RectOffset(16, 16, 16, 16)
                    : new RectOffset(24, 24, 24, 24);
            }
        }
        #endregion

        #region Private Implementation
        /// <summary>
        /// Wires all UI toggle event listeners.
        /// </summary>
        private void WireEventListeners()
        {
            if (AllToggle != null)
                AllToggle.onValueChanged.AddListener(isOn => { if (isOn) FilterByCategory(ActivityCategory.All); });
            if (FriendsToggle != null)
                FriendsToggle.onValueChanged.AddListener(isOn => { if (isOn) FilterByCategory(ActivityCategory.Friends); });
            if (TrendingToggle != null)
                TrendingToggle.onValueChanged.AddListener(isOn => { if (isOn) FilterByCategory(ActivityCategory.Trending); });
            if (EventsToggle != null)
                EventsToggle.onValueChanged.AddListener(isOn => { if (isOn) FilterByCategory(ActivityCategory.Events); });
            if (SystemToggle != null)
                SystemToggle.onValueChanged.AddListener(isOn => { if (isOn) FilterByCategory(ActivityCategory.System); });
        }

        /// <summary>
        /// Loads activity data from the backend or cache.
        /// </summary>
        private void LoadActivityData()
        {
            _allActivities.Clear();
            // TODO: Replace with actual API call
            var categories = new[] { ActivityCategory.Friends, ActivityCategory.Trending, ActivityCategory.Events, ActivityCategory.System };
            var titles = new[] { "New Friend", "Room of the Day", "Event Starting", "Maintenance Notice", "Achievement Unlocked", "Level Up!", "Trade Complete" };
            var descriptions = new[]
            {
                "You are now friends with Player 3!",
                "Check out the most popular room today.",
                "The Summer Festival event is starting now!",
                "Scheduled maintenance in 30 minutes.",
                "You unlocked the 'First Steps' badge!",
                "You reached Level 10! New items unlocked.",
                "You traded 5 items with Player 7."
            };

            for (int i = 0; i < 15; i++)
            {
                _allActivities.Add(new ActivityItem
                {
                    ActivityId = $"activity_{i}",
                    ActorId = $"player_{i % 8}",
                    ActorName = $"Player {i % 8 + 1}",
                    Title = titles[i % titles.Length],
                    Description = descriptions[i % descriptions.Length],
                    Timestamp = DateTimeOffset.UtcNow.AddMinutes(-i * 15).ToUnixTimeSeconds(),
                    Category = categories[i % categories.Length],
                    ActionLabel = i % 3 == 0 ? "View" : null,
                    ActionTargetId = i % 3 == 0 ? $"target_{i}" : null,
                    IsUnread = i < 5
                });
            }
        }

        /// <summary>
        /// Applies the current category filter to determine displayed activities.
        /// </summary>
        private void ApplyCategoryFilter()
        {
            _displayedActivities.Clear();
            if (_currentCategory == ActivityCategory.All)
            {
                _displayedActivities.AddRange(_allActivities);
            }
            else
            {
                _displayedActivities.AddRange(_allActivities.Where(a => a.Category == _currentCategory));
            }

            // Sort by newest first
            _displayedActivities.Sort((a, b) => b.Timestamp.CompareTo(a.Timestamp));
        }

        /// <summary>
        /// Instantiates and populates UI items for the displayed activities.
        /// </summary>
        private void PopulateFeed()
        {
            if (FeedContainer == null || ActivityItemPrefab == null) return;

            foreach (var kvp in _activityItemMap)
            {
                if (kvp.Value != null) Destroy(kvp.Value);
            }
            _activityItemMap.Clear();

            foreach (var activity in _displayedActivities)
            {
                var item = Instantiate(ActivityItemPrefab, FeedContainer, false);
                item.name = $"ActivityItem_{activity.ActivityId}";
                SetupActivityItem(item, activity);
                _activityItemMap[activity.ActivityId] = item;
            }

            if (FeedScrollRect != null)
                FeedScrollRect.normalizedPosition = new Vector2(0, 1);
        }

        /// <summary>
        /// Configures a single activity item GameObject with data and button bindings.
        /// </summary>
        private void SetupActivityItem(GameObject item, ActivityItem activity)
        {
            if (item == null || activity == null) return;

            var avatar = item.transform.Find("Avatar")?.GetComponent<Image>();
            var titleTxt = item.transform.Find("Title")?.GetComponent<TMP_Text>();
            var descTxt = item.transform.Find("Description")?.GetComponent<TMP_Text>();
            var timeTxt = item.transform.Find("Time")?.GetComponent<TMP_Text>();
            var actionBtn = item.transform.Find("ActionButton")?.GetComponent<Button>();
            var actionLabel = item.transform.Find("ActionButton/Label")?.GetComponent<TMP_Text>();
            var unreadDot = item.transform.Find("UnreadDot")?.GetComponent<Image>();
            var mainBtn = item.GetComponent<Button>();

            if (titleTxt != null) titleTxt.text = activity.Title;
            if (descTxt != null) descTxt.text = activity.Description;
            if (timeTxt != null) timeTxt.text = FormatRelativeTime(activity.Timestamp);
            if (unreadDot != null) unreadDot.gameObject.SetActive(activity.IsUnread);

            if (avatar != null && !string.IsNullOrEmpty(activity.ActorAvatarUrl))
            {
                // TODO: Async avatar load
            }

            if (actionBtn != null)
            {
                bool hasAction = !string.IsNullOrEmpty(activity.ActionLabel);
                actionBtn.gameObject.SetActive(hasAction);
                if (actionLabel != null) actionLabel.text = activity.ActionLabel ?? string.Empty;
                if (hasAction)
                {
                    string targetId = activity.ActionTargetId;
                    actionBtn.onClick.AddListener(() => OnActionButtonClicked(targetId));
                }
            }

            if (mainBtn != null)
            {
                string aid = activity.ActivityId;
                mainBtn.onClick.AddListener(() => OnActivityClicked(aid));
            }
        }

        /// <summary>
        /// Handles the action button click on an activity item.
        /// </summary>
        private void OnActionButtonClicked(string targetId)
        {
            if (string.IsNullOrEmpty(targetId)) return;
            UIManager.Instance?.ShowToast($"Action: {targetId}", ToastType.Info, 1.5f);
            // TODO: Navigate to target (room, profile, etc.)
        }

        /// <summary>
        /// Adds a new activity item to the feed dynamically.
        /// </summary>
        /// <param name="item">The activity item to add.</param>
        private void AddActivityItem(ActivityItem item)
        {
            if (item == null) return;
            _allActivities.Insert(0, item);
            if (_allActivities.Count > 100)
                _allActivities.RemoveAt(_allActivities.Count - 1);

            if (IsVisible)
            {
                RefreshFeed();
            }
        }

        /// <summary>
        /// Shows or hides the empty state based on displayed content.
        /// </summary>
        private void UpdateEmptyState()
        {
            if (EmptyState == null || EmptyText == null) return;

            bool isEmpty = _displayedActivities.Count == 0;
            EmptyState.SetActive(isEmpty);

            if (isEmpty)
            {
                EmptyText.text = _currentCategory switch
                {
                    ActivityCategory.Friends => "No friend activity right now. Go hang out!",
                    ActivityCategory.Trending => "Nothing trending at the moment.",
                    ActivityCategory.Events => "No active events. Check back later!",
                    ActivityCategory.System => "No system notifications.",
                    _ => "Your activity feed is empty. Start exploring!"
                };
            }
        }

        /// <summary>
        /// Formats a Unix timestamp into a human-readable relative time string.
        /// </summary>
        private static string FormatRelativeTime(long unixTimestamp)
        {
            var dt = DateTimeOffset.FromUnixTimeSeconds(unixTimestamp);
            var diff = DateTimeOffset.UtcNow - dt;

            if (diff.TotalMinutes < 1) return "Just now";
            if (diff.TotalMinutes < 60) return $"{diff.TotalMinutes:F0}m ago";
            if (diff.TotalHours < 24) return $"{diff.TotalHours:F0}h ago";
            if (diff.TotalDays < 7) return $"{diff.TotalDays:F0}d ago";
            return dt.ToString("MMM dd");
        }
        #endregion
    }
}
