using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KawaiiCoolIsland.Discovery
{
    /// <summary>
    /// Types of notifications that the hub can display.
    /// </summary>
    public enum NotificationType
    {
        FriendRequest,
        RoomInvite,
        PartyInvite,
        EventStarting,
        Achievement,
        TradeRequest,
        Message,
        System,
        Activity
    }

    /// <summary>
    /// Represents a single in-game notification with metadata, actions and deep-linking.
    /// </summary>
    [System.Serializable]
    public class GameNotification
    {
        public string NotificationId;
        public NotificationType Type;
        public string Title;
        public string Message;
        public Sprite Icon;
        public long Timestamp;
        public bool IsRead;
        public bool IsUrgent;
        public Dictionary<string, string> Actions = new Dictionary<string, string>();
        public string DeepLink;
    }

    /// <summary>
    /// Central notification hub for all social events in KawaiiCool Island.
    /// Handles queuing, display timing, Do-Not-Disturb, and action routing.
    /// </summary>
    public class NotificationHub : Singleton<NotificationHub>
    {
        [Header("Notifications")]
        /// <summary>Currently active (queued or displayed) notifications.</summary>
        public List<GameNotification> ActiveNotifications = new List<GameNotification>();
        /// <summary>Maximum number of notifications to retain.</summary>
        public int MaxNotifications = 20;
        /// <summary>Seconds a non-urgent notification stays on screen.</summary>
        public float NotificationDisplayTime = 5f;

        [Header("Settings")]
        /// <summary>Allow friend-request notifications.</summary>
        public bool EnableFriendRequestNotifications = true;
        /// <summary>Allow room-invite notifications.</summary>
        public bool EnableRoomInviteNotifications = true;
        /// <summary>Allow party-invite notifications.</summary>
        public bool EnablePartyInviteNotifications = true;
        /// <summary>Allow event-starting notifications.</summary>
        public bool EnableEventNotifications = true;
        /// <summary>Allow achievement-unlock notifications.</summary>
        public bool EnableAchievementNotifications = true;
        /// <summary>Allow trade-request notifications.</summary>
        public bool EnableTradeNotifications = true;
        /// <summary>Allow direct-message notifications.</summary>
        public bool EnableMessageNotifications = true;
        /// <summary>When true, all non-urgent notifications are suppressed.</summary>
        public bool DoNotDisturb = false;

        /// <summary>Invoked when a new notification is received.</summary>
        public event Action<GameNotification> OnNotificationReceived;
        /// <summary>Invoked when all notifications are dismissed.</summary>
        public event Action OnAllNotificationsDismissed;

        private Queue<GameNotification> _displayQueue = new Queue<GameNotification>();
        private Coroutine _displayCoroutine;
        private bool _isDisplaying;

        /// <summary>
        /// Queues and displays a generic game notification.
        /// </summary>
        /// <param name="notification">The notification to show.</param>
        public void ShowNotification(GameNotification notification)
        {
            if (notification == null) return;
            if (!ShouldShowNotification(notification.Type))
                return;

            if (string.IsNullOrEmpty(notification.NotificationId))
                notification.NotificationId = Guid.NewGuid().ToString();
            notification.Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

            ActiveNotifications.Add(notification);
            TrimNotifications();

            if (notification.IsUrgent || !DoNotDisturb)
            {
                _displayQueue.Enqueue(notification);
                if (!_isDisplaying)
                    _displayCoroutine = StartCoroutine(NotificationDisplayCoroutine(notification));
            }

            OnNotificationReceived?.Invoke(notification);
            EventBus.Publish("NotificationReceived", notification);
        }

        /// <summary>
        /// Shows a friend-request notification.
        /// </summary>
        /// <param name="fromPlayerId">The requesting player's ID.</param>
        /// <param name="fromPlayerName">The requesting player's display name.</param>
        public void ShowFriendRequest(string fromPlayerId, string fromPlayerName)
        {
            var n = new GameNotification
            {
                Type = NotificationType.FriendRequest,
                Title = "Friend Request",
                Message = $"{fromPlayerName} wants to be friends!",
                IsUrgent = false,
                Actions = new Dictionary<string, string>
                {
                    { "Accept", $"AcceptFriend:{fromPlayerId}" },
                    { "Decline", $"DeclineFriend:{fromPlayerId}" }
                },
                DeepLink = $"Profile/{fromPlayerId}"
            };
            ShowNotification(n);
        }

        /// <summary>
        /// Shows a room-invite notification.
        /// </summary>
        /// <param name="fromPlayerId">The inviter's player ID.</param>
        /// <param name="roomName">Name of the room.</param>
        /// <param name="roomId">Room identifier.</param>
        public void ShowRoomInvite(string fromPlayerId, string roomName, string roomId)
        {
            var n = new GameNotification
            {
                Type = NotificationType.RoomInvite,
                Title = "Room Invite",
                Message = $"You are invited to {roomName}!",
                IsUrgent = false,
                Actions = new Dictionary<string, string>
                {
                    { "Join", $"JoinRoom:{roomId}" },
                    { "Ignore", "Ignore" }
                },
                DeepLink = $"Room/{roomId}"
            };
            ShowNotification(n);
        }

        /// <summary>
        /// Shows a party-invite notification.
        /// </summary>
        /// <param name="fromPlayerId">The inviter's player ID.</param>
        /// <param name="partyId">The party group ID.</param>
        public void ShowPartyInvite(string fromPlayerId, string partyId)
        {
            var n = new GameNotification
            {
                Type = NotificationType.PartyInvite,
                Title = "Party Invite",
                Message = "You have been invited to a party!",
                IsUrgent = false,
                Actions = new Dictionary<string, string>
                {
                    { "Join", $"JoinParty:{partyId}" },
                    { "Decline", "DeclineParty" }
                },
                DeepLink = $"Party/{partyId}"
            };
            ShowNotification(n);
        }

        /// <summary>
        /// Shows an event-starting notification with countdown minutes.
        /// </summary>
        /// <param name="eventName">Name of the event.</param>
        /// <param name="roomId">Room where the event takes place.</param>
        /// <param name="minutes">Minutes until the event starts.</param>
        public void ShowEventStarting(string eventName, string roomId, int minutes)
        {
            var n = new GameNotification
            {
                Type = NotificationType.EventStarting,
                Title = "Event Starting Soon",
                Message = $"{eventName} starts in {minutes} minute(s)!",
                IsUrgent = minutes <= 5,
                Actions = new Dictionary<string, string>
                {
                    { "Go Now", $"JoinRoom:{roomId}" },
                    { "Later", "Dismiss" }
                },
                DeepLink = $"Event/{roomId}"
            };
            ShowNotification(n);
        }

        /// <summary>
        /// Shows an achievement-unlock notification.
        /// </summary>
        /// <param name="achievementName">Name of the achievement.</param>
        /// <param name="icon">Icon sprite for the achievement.</param>
        public void ShowAchievement(string achievementName, Sprite icon)
        {
            var n = new GameNotification
            {
                Type = NotificationType.Achievement,
                Title = "Achievement Unlocked!",
                Message = $"You earned '{achievementName}'!",
                Icon = icon,
                IsUrgent = false,
                Actions = new Dictionary<string, string>
                {
                    { "View", "ViewAchievements" }
                },
                DeepLink = "Achievements"
            };
            ShowNotification(n);
        }

        /// <summary>
        /// Shows a trade-request notification.
        /// </summary>
        /// <param name="fromPlayerId">The requesting player's ID.</param>
        public void ShowTradeRequest(string fromPlayerId)
        {
            var n = new GameNotification
            {
                Type = NotificationType.TradeRequest,
                Title = "Trade Request",
                Message = "A player wants to trade with you!",
                IsUrgent = true,
                Actions = new Dictionary<string, string>
                {
                    { "Accept", $"AcceptTrade:{fromPlayerId}" },
                    { "Decline", $"DeclineTrade:{fromPlayerId}" }
                },
                DeepLink = $"Trade/{fromPlayerId}"
            };
            ShowNotification(n);
        }

        /// <summary>
        /// Shows a direct-message notification.
        /// </summary>
        /// <param name="fromPlayerId">The sender's player ID.</param>
        /// <param name="fromPlayerName">The sender's display name.</param>
        /// <param name="messagePreview">Short preview of the message.</param>
        public void ShowMessage(string fromPlayerId, string fromPlayerName, string messagePreview)
        {
            var n = new GameNotification
            {
                Type = NotificationType.Message,
                Title = $"Message from {fromPlayerName}",
                Message = messagePreview,
                IsUrgent = false,
                Actions = new Dictionary<string, string>
                {
                    { "Reply", $"ReplyTo:{fromPlayerId}" },
                    { "Dismiss", "Dismiss" }
                },
                DeepLink = $"Chat/{fromPlayerId}"
            };
            ShowNotification(n);
        }

        /// <summary>
        /// Dismisses a single notification by ID.
        /// </summary>
        /// <param name="notificationId">The notification to remove.</param>
        public void DismissNotification(string notificationId)
        {
            var n = ActiveNotifications.FirstOrDefault(x => x.NotificationId == notificationId);
            if (n != null)
            {
                ActiveNotifications.Remove(n);
                OnNotificationReceived?.Invoke(null); // signal UI refresh
            }
        }

        /// <summary>
        /// Dismisses all active notifications.
        /// </summary>
        public void DismissAll()
        {
            ActiveNotifications.Clear();
            _displayQueue.Clear();
            if (_displayCoroutine != null)
            {
                StopCoroutine(_displayCoroutine);
                _displayCoroutine = null;
            }
            _isDisplaying = false;
            OnAllNotificationsDismissed?.Invoke();
            EventBus.Publish("AllNotificationsDismissed", null);
        }

        /// <summary>
        /// Gets the count of unread notifications.
        /// </summary>
        /// <returns>Number of unread items.</returns>
        public int GetUnreadCount()
        {
            return ActiveNotifications.Count(n => !n.IsRead);
        }

        /// <summary>
        /// Gets all unread notifications.
        /// </summary>
        /// <returns>List of unread notifications.</returns>
        public List<GameNotification> GetUnreadNotifications()
        {
            return ActiveNotifications.Where(n => !n.IsRead)
                                      .OrderByDescending(n => n.Timestamp)
                                      .ToList();
        }

        /// <summary>
        /// Marks a specific notification as read.
        /// </summary>
        /// <param name="notificationId">The notification ID.</param>
        public void MarkAsRead(string notificationId)
        {
            var n = ActiveNotifications.FirstOrDefault(x => x.NotificationId == notificationId);
            if (n != null)
                n.IsRead = true;
        }

        /// <summary>
        /// Determines whether a notification of the given type should be shown based on settings.
        /// </summary>
        /// <param name="type">The notification type.</param>
        /// <returns>True if the notification should be displayed.</returns>
        private bool ShouldShowNotification(NotificationType type)
        {
            switch (type)
            {
                case NotificationType.FriendRequest:
                    return EnableFriendRequestNotifications;
                case NotificationType.RoomInvite:
                    return EnableRoomInviteNotifications;
                case NotificationType.PartyInvite:
                    return EnablePartyInviteNotifications;
                case NotificationType.EventStarting:
                    return EnableEventNotifications;
                case NotificationType.Achievement:
                    return EnableAchievementNotifications;
                case NotificationType.TradeRequest:
                    return EnableTradeNotifications;
                case NotificationType.Message:
                    return EnableMessageNotifications;
                default:
                    return true;
            }
        }

        /// <summary>
        /// Internal display handler that publishes to the UI system.
        /// </summary>
        /// <param name="notification">The notification to display.</param>
        private void DisplayNotification(GameNotification notification)
        {
            EventBus.Publish("ShowToast", notification);
            if (!string.IsNullOrEmpty(notification.DeepLink))
            {
                EventBus.Publish("NotificationDeepLink", notification.DeepLink);
            }
        }

        /// <summary>
        /// Coroutine that manages sequential display of queued notifications.
        /// </summary>
        /// <param name="notification">The first notification to display.</param>
        private IEnumerator NotificationDisplayCoroutine(GameNotification notification)
        {
            _isDisplaying = true;
            DisplayNotification(notification);

            float waitTime = notification.IsUrgent ? NotificationDisplayTime * 2f : NotificationDisplayTime;
            yield return new WaitForSeconds(waitTime);

            _isDisplaying = false;
            if (_displayQueue.Count > 0)
            {
                _displayQueue.Dequeue(); // remove the one just shown
                if (_displayQueue.Count > 0)
                {
                    var next = _displayQueue.Peek();
                    _displayCoroutine = StartCoroutine(NotificationDisplayCoroutine(next));
                }
            }
        }

        /// <summary>
        /// Trims the notification list to the maximum size.
        /// </summary>
        private void TrimNotifications()
        {
            if (ActiveNotifications.Count > MaxNotifications)
            {
                var toRemove = ActiveNotifications.OrderBy(n => n.Timestamp)
                                                   .Take(ActiveNotifications.Count - MaxNotifications)
                                                   .ToList();
                foreach (var n in toRemove)
                    ActiveNotifications.Remove(n);
            }
        }

        /// <summary>
        /// Unity Awake — wire up to event bus.
        /// </summary>
        protected override void Awake()
        {
            base.Awake();
            EventBus.Subscribe("FriendRequestReceived", OnFriendRequestReceived);
            EventBus.Subscribe("RoomInviteReceived", OnRoomInviteReceived);
            EventBus.Subscribe("AchievementUnlocked", OnAchievementUnlocked);
        }

        /// <summary>
        /// Unity OnDestroy — clean up subscriptions.
        /// </summary>
        protected override void OnDestroy()
        {
            base.OnDestroy();
            EventBus.Unsubscribe("FriendRequestReceived", OnFriendRequestReceived);
            EventBus.Unsubscribe("RoomInviteReceived", OnRoomInviteReceived);
            EventBus.Unsubscribe("AchievementUnlocked", OnAchievementUnlocked);
        }

        private void OnFriendRequestReceived(object data)
        {
            if (data is string[] parts && parts.Length >= 2)
                ShowFriendRequest(parts[0], parts[1]);
        }

        private void OnRoomInviteReceived(object data)
        {
            if (data is string[] parts && parts.Length >= 3)
                ShowRoomInvite(parts[0], parts[1], parts[2]);
        }

        private void OnAchievementUnlocked(object data)
        {
            if (data is string achievementName)
                ShowAchievement(achievementName, null);
        }
    }
}
