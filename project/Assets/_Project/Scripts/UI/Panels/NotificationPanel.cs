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
    /// Immutable data holder for a notification inbox item.
    /// </summary>
    [System.Serializable]
    public class NotificationItem
    {
        /// <summary>Unique notification identifier.</summary>
        public string NotificationId;
        /// <summary>Title of the notification.</summary>
        public string Title;
        /// <summary>Message body of the notification.</summary>
        public string Message;
        /// <summary>Type label (e.g., "Friend Request", "System", "Event").</summary>
        public string TypeLabel;
        /// <summary>Unix timestamp when the notification was sent.</summary>
        public long Timestamp;
        /// <summary>True if the notification has not been read.</summary>
        public bool IsUnread;
        /// <summary>True if the notification has been dismissed.</summary>
        public bool IsDismissed;
        /// <summary>Optional action payload ID (room ID, player ID, etc.).</summary>
        public string ActionTargetId;
        /// <summary>Optional action type hint.</summary>
        public string ActionType;
    }

    #endregion

    /// <summary>
    /// Notification inbox panel that displays a scrollable list of notifications
    /// with filtering, mark-as-read, and dismiss capabilities. Integrates with
    /// <see cref="EventBus"/> for real-time notification delivery.
    /// </summary>
    public class NotificationPanel : UIPanel
    {
        #region Inspector - Notifications
        [Header("Notifications")]
        [Tooltip("Container Transform that holds instantiated notification items.")]
        public Transform NotificationList;

        [Tooltip("Prefab used to create each notification list entry.")]
        public GameObject NotificationItemPrefab;

        [Tooltip("ScrollRect component for the notification list.")]
        public ScrollRect ScrollView;
        #endregion

        #region Inspector - Filters
        [Header("Filters")]
        [Tooltip("Toggle to show all notifications.")]
        public Toggle AllToggle;

        [Tooltip("Toggle to show only unread notifications.")]
        public Toggle UnreadToggle;

        [Tooltip("Button to mark all notifications as read.")]
        public Button MarkAllReadButton;

        [Tooltip("Button to clear all dismissed notifications.")]
        public Button ClearAllButton;
        #endregion

        #region Inspector - Empty
        [Header("Empty")]
        [Tooltip("GameObject shown when there are no notifications.")]
        public GameObject EmptyState;

        [Tooltip("Text explaining the empty state.")]
        public TMP_Text EmptyText;
        #endregion

        #region State
        private readonly List<NotificationItem> _allNotifications = new();
        private readonly List<NotificationItem> _displayedNotifications = new();
        private bool _showUnreadOnly = false;
        private readonly Dictionary<string, GameObject> _notificationItemMap = new();
        #endregion

        #region Public API
        /// <summary>
        /// Called when the panel is about to be shown. Loads notifications and refreshes UI.
        /// </summary>
        public override void OnPanelShow()
        {
            base.OnPanelShow();
            LoadNotifications();
            RefreshNotifications();
        }

        /// <summary>
        /// Refreshes the notification list from data source and reapplies filters.
        /// </summary>
        public void RefreshNotifications()
        {
            ApplyFilter();
            PopulateNotifications();
            UpdateEmptyState();
        }

        /// <summary>
        /// Called when a notification item is clicked. Marks it as read and triggers the action.
        /// </summary>
        /// <param name="notificationId">The unique notification identifier.</param>
        public void OnNotificationClicked(string notificationId)
        {
            if (string.IsNullOrEmpty(notificationId)) return;

            var notification = _allNotifications.FirstOrDefault(n => n.NotificationId == notificationId);
            if (notification == null) return;

            if (notification.IsUnread)
            {
                notification.IsUnread = false;
                RefreshNotifications();
            }

            // Handle action navigation
            if (!string.IsNullOrEmpty(notification.ActionType) && !string.IsNullOrEmpty(notification.ActionTargetId))
            {
                HandleNotificationAction(notification.ActionType, notification.ActionTargetId);
            }
        }

        /// <summary>
        /// Dismisses a notification from the inbox.
        /// </summary>
        /// <param name="notificationId">The notification to dismiss.</param>
        public void OnDismissClicked(string notificationId)
        {
            var notification = _allNotifications.FirstOrDefault(n => n.NotificationId == notificationId);
            if (notification == null) return;

            notification.IsDismissed = true;
            RefreshNotifications();
            UIManager.Instance?.ShowToast("Notification dismissed.", ToastType.Info, 1.5f);
        }

        /// <summary>
        /// Marks all notifications as read and refreshes the UI.
        /// </summary>
        public void MarkAllRead()
        {
            foreach (var notification in _allNotifications)
                notification.IsUnread = false;
            RefreshNotifications();
            UIManager.Instance?.ShowToast("All notifications marked as read.", ToastType.Success, 2f);
        }

        /// <summary>
        /// Permanently removes all dismissed notifications from the list.
        /// </summary>
        public void ClearAll()
        {
            int removed = _allNotifications.RemoveAll(n => n.IsDismissed);
            RefreshNotifications();
            UIManager.Instance?.ShowToast($"{removed} notifications cleared.", ToastType.Info, 1.5f);
        }

        /// <summary>
        /// Called when the device type changes. Adjusts layout for mobile vs desktop.
        /// </summary>
        /// <param name="deviceType">The new device type.</param>
        public override void OnDeviceTypeChanged(DeviceType deviceType)
        {
            base.OnDeviceTypeChanged(deviceType);
            if (NotificationList == null) return;

            var layout = NotificationList.GetComponent<VerticalLayoutGroup>();
            if (layout != null)
            {
                layout.spacing = deviceType == DeviceType.Mobile ? 14f : 10f;
                layout.padding = deviceType == DeviceType.Mobile
                    ? new RectOffset(12, 12, 12, 12)
                    : new RectOffset(20, 20, 20, 20);
            }
        }
        #endregion

        #region Private Implementation
        /// <summary>
        /// Wires all UI event listeners.
        /// </summary>
        private void WireEventListeners()
        {
            if (AllToggle != null)
                AllToggle.onValueChanged.AddListener(isOn =>
                {
                    if (isOn)
                    {
                        _showUnreadOnly = false;
                        RefreshNotifications();
                    }
                });
            if (UnreadToggle != null)
                UnreadToggle.onValueChanged.AddListener(isOn =>
                {
                    if (isOn)
                    {
                        _showUnreadOnly = true;
                        RefreshNotifications();
                    }
                });
            if (MarkAllReadButton != null)
                MarkAllReadButton.onClick.AddListener(MarkAllRead);
            if (ClearAllButton != null)
                ClearAllButton.onClick.AddListener(ClearAll);
        }

        /// <summary>
        /// Loads notification data from the backend or cache.
        /// </summary>
        private void LoadNotifications()
        {
            _allNotifications.Clear();
            // TODO: Replace with actual API call
            var types = new[] { "Friend Request", "System", "Event", "Trade", "Achievement" };
            var titles = new[] { "New Friend Request", "Server Maintenance", "Summer Event!", "Trade Offer", "Badge Unlocked" };
            var messages = new[]
            {
                "Player 3 wants to be your friend.",
                "Scheduled maintenance in 1 hour.",
                "The Summer Festival has started! Join now.",
                "Player 7 sent you a trade request.",
                "You unlocked the 'First Steps' badge!"
            };

            for (int i = 0; i < 10; i++)
            {
                _allNotifications.Add(new NotificationItem
                {
                    NotificationId = $"notif_{i}",
                    Title = titles[i % titles.Length],
                    Message = messages[i % messages.Length],
                    TypeLabel = types[i % types.Length],
                    Timestamp = DateTimeOffset.UtcNow.AddHours(-i * 2).ToUnixTimeSeconds(),
                    IsUnread = i < 4,
                    IsDismissed = false,
                    ActionTargetId = i % 3 == 0 ? $"target_{i}" : null,
                    ActionType = i % 3 == 0 ? (i % 2 == 0 ? "OpenRoom" : "OpenProfile") : null
                });
            }
        }

        /// <summary>
        /// Applies the current filter (all or unread only) to the notification list.
        /// </summary>
        private void ApplyFilter()
        {
            _displayedNotifications.Clear();
            var source = _allNotifications.Where(n => !n.IsDismissed);
            if (_showUnreadOnly)
                source = source.Where(n => n.IsUnread);
            _displayedNotifications.AddRange(source.OrderByDescending(n => n.Timestamp));
        }

        /// <summary>
        /// Instantiates and populates notification items for the current filter.
        /// </summary>
        private void PopulateNotifications()
        {
            if (NotificationList == null || NotificationItemPrefab == null) return;

            foreach (var kvp in _notificationItemMap)
            {
                if (kvp.Value != null) Destroy(kvp.Value);
            }
            _notificationItemMap.Clear();

            foreach (var notification in _displayedNotifications)
            {
                var item = Instantiate(NotificationItemPrefab, NotificationList, false);
                item.name = $"NotificationItem_{notification.NotificationId}";
                SetupNotificationItem(item, notification);
                _notificationItemMap[notification.NotificationId] = item;
            }

            if (ScrollView != null)
                ScrollView.normalizedPosition = new Vector2(0, 1);
        }

        /// <summary>
        /// Configures a single notification item GameObject with data and button bindings.
        /// </summary>
        private void SetupNotificationItem(GameObject item, NotificationItem notification)
        {
            if (item == null || notification == null) return;

            var titleTxt = item.transform.Find("Title")?.GetComponent<TMP_Text>();
            var msgTxt = item.transform.Find("Message")?.GetComponent<TMP_Text>();
            var typeTxt = item.transform.Find("Type")?.GetComponent<TMP_Text>();
            var timeTxt = item.transform.Find("Time")?.GetComponent<TMP_Text>();
            var unreadDot = item.transform.Find("UnreadDot")?.GetComponent<Image>();
            var dismissBtn = item.transform.Find("DismissButton")?.GetComponent<Button>();
            var mainBtn = item.GetComponent<Button>();

            if (titleTxt != null) titleTxt.text = notification.Title;
            if (msgTxt != null) msgTxt.text = notification.Message;
            if (typeTxt != null) typeTxt.text = notification.TypeLabel;
            if (timeTxt != null) timeTxt.text = FormatRelativeTime(notification.Timestamp);
            if (unreadDot != null) unreadDot.gameObject.SetActive(notification.IsUnread);

            if (mainBtn != null)
            {
                string nid = notification.NotificationId;
                mainBtn.onClick.AddListener(() => OnNotificationClicked(nid));
            }

            if (dismissBtn != null)
            {
                string nid = notification.NotificationId;
                dismissBtn.onClick.AddListener(() => OnDismissClicked(nid));
            }
        }

        /// <summary>
        /// Navigates to the appropriate panel based on notification action type.
        /// </summary>
        private void HandleNotificationAction(string actionType, string targetId)
        {
            switch (actionType)
            {
                case "OpenRoom":
                    UIManager.Instance?.ShowToast($"Opening room: {targetId}", ToastType.Info, 2f);
                    // TODO: Join room
                    break;
                case "OpenProfile":
                    var profilePanel = UIManager.Instance?.GetPanel("ProfilePanel") as ProfilePanel;
                    profilePanel?.ShowProfile(targetId);
                    break;
                case "OpenChat":
                    UIManager.Instance?.ShowPanel("ChatUI", true, true);
                    break;
                case "AcceptTrade":
                    UIManager.Instance?.ShowToast("Trade offer accepted.", ToastType.Success, 2f);
                    break;
                default:
                    UIManager.Instance?.ShowToast($"Action: {actionType}", ToastType.Info, 1.5f);
                    break;
            }
        }

        /// <summary>
        /// Shows or hides the empty state based on displayed content.
        /// </summary>
        private void UpdateEmptyState()
        {
            if (EmptyState == null || EmptyText == null) return;

            bool isEmpty = _displayedNotifications.Count == 0;
            EmptyState.SetActive(isEmpty);

            if (isEmpty)
            {
                EmptyText.text = _showUnreadOnly
                    ? "No unread notifications. You're all caught up!"
                    : "No notifications in your inbox.";
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
