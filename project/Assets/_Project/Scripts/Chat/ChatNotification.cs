using System;
using System.Collections;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace KawaiiCoolIsland.Chat
{
    /// <summary>
    /// Manages chat notifications that appear when the chat panel is not focused.
    /// Shows toast-style notifications for incoming messages with sender info, preview text,
    /// and channel coloring. Includes unread count tracking and notification queue management.
    /// </summary>
    public class ChatNotification : MonoBehaviour
    {
        #region Header: References
        [Header("References")]
        [Tooltip("Prefab for individual notification toasts (should have TMP_Text for sender, message, and channel).")]
        public GameObject NotificationPrefab;

        [Header("Container")]
        [Tooltip("Transform container where notification toasts are instantiated.")]
        public Transform NotificationContainer;

        [Tooltip("RectTransform of the notification container for positioning.")]
        public RectTransform ContainerRectTransform;

        [Header("Audio")]
        [Tooltip("AudioClip played when a new notification arrives.")]
        public AudioClip NewMessageSFX;

        [Tooltip("AudioClip played for high-priority notifications (whispers, direct mentions).")]
        public AudioClip UrgentMessageSFX;
        #endregion

        #region Header: Settings
        [Header("Settings")]
        [Tooltip("Maximum number of notifications visible at once.")]
        public int MaxVisibleNotifications = 5;

        [Tooltip("How long each notification stays visible before fading out (seconds).")]
        public float NotificationDisplayDuration = 4f;

        [Tooltip("Duration of the fade-in animation (seconds).")]
        public float FadeInDuration = 0.3f;

        [Tooltip("Duration of the fade-out animation (seconds).")]
        public float FadeOutDuration = 0.5f;

        [Tooltip("Delay between consecutive notifications (seconds).")]
        public float NotificationDelay = 0.2f;

        [Tooltip("Maximum length of message preview text in characters.")]
        public int MaxPreviewLength = 50;

        [Tooltip("Whether to show notification toasts at all.")]
        public bool ShowNotifications = true;

        [Tooltip("Whether to play sound on new notifications.")]
        public bool PlaySounds = true;

        [Tooltip("Whether to count unread messages per channel.")]
        public bool TrackUnreadByChannel = true;

        [Tooltip("Whether to show urgent notifications for whispers/mentions even when Do Not Disturb is on.")]
        public bool AlwaysShowUrgent = true;
        #endregion

        #region Header: Positioning
        [Header("Positioning")]
        [Tooltip("Screen corner where notifications appear.")]
        public NotificationPosition Position = NotificationPosition.TopRight;

        [Tooltip("Padding from screen edges in pixels.")]
        public Vector2 ScreenPadding = new(20, 80);

        [Tooltip("Vertical spacing between notification toasts in pixels.")]
        public float NotificationSpacing = 10f;
        #endregion

        #region Private Fields
        private readonly Queue<NotificationData> _notificationQueue = new();
        private readonly List<GameObject> _activeNotifications = new();
        private int _unreadCount;
        private bool _isProcessingQueue;
        private bool _doNotDisturb;
        private AudioSource _audioSource;
        private readonly Dictionary<ChatChannel, int> _unreadByChannel = new();
        #endregion

        #region Public Properties
        /// <summary>
        /// Total number of unread messages across all channels.
        /// </summary>
        public int UnreadCount => _unreadCount;

        /// <summary>
        /// Whether Do Not Disturb mode is enabled (suppresses non-urgent notifications).
        /// </summary>
        public bool DoNotDisturb
        {
            get => _doNotDisturb;
            set => _doNotDisturb = value;
        }

        /// <summary>
        /// Whether notification toasts are currently enabled.
        /// </summary>
        public bool NotificationsEnabled => ShowNotifications;

        /// <summary>
        /// Number of notifications currently visible.
        /// </summary>
        public int ActiveNotificationCount => _activeNotifications.Count;
        #endregion

        #region Public Events
        /// <summary>
        /// Fired when the unread count changes. Parameter: new unread count.
        /// </summary>
        public event Action<int> OnUnreadCountChanged;

        /// <summary>
        /// Fired when a notification is shown.
        /// </summary>
        public event Action<NotificationData> OnNotificationShown;

        /// <summary>
        /// Fired when a notification is dismissed.
        /// </summary>
        public event Action<NotificationData> OnNotificationDismissed;

        /// <summary>
        /// Fired when a notification is clicked by the user.
        /// </summary>
        public event Action<NotificationData> OnNotificationClicked;
        #endregion

        #region Unity Lifecycle
        private void Awake()
        {
            _audioSource = GetComponent<AudioSource>();
            if (_audioSource == null && (NewMessageSFX != null || UrgentMessageSFX != null))
            {
                _audioSource = gameObject.AddComponent<AudioSource>();
                _audioSource.playOnAwake = false;
            }

            // Initialize unread counts per channel
            foreach (ChatChannel channel in Enum.GetValues(typeof(ChatChannel)))
            {
                _unreadByChannel[channel] = 0;
            }

            SetupContainerPosition();
        }

        private void Start()
        {
            // Subscribe to ChatManager events
            if (ChatManager.Instance != null)
            {
                ChatManager.Instance.OnMessageReceived += HandleMessageReceived;
            }
        }

        private void OnEnable()
        {
            if (ChatManager.Instance != null)
            {
                ChatManager.Instance.OnMessageReceived += HandleMessageReceived;
            }
        }

        private void OnDisable()
        {
            if (ChatManager.Instance != null)
            {
                ChatManager.Instance.OnMessageReceived -= HandleMessageReceived;
            }
        }

        private void OnDestroy()
        {
            StopAllCoroutines();
            if (ChatManager.Instance != null)
            {
                ChatManager.Instance.OnMessageReceived -= HandleMessageReceived;
            }
        }

        private void Update()
        {
            // Clean up destroyed notification objects
            for (int i = _activeNotifications.Count - 1; i >= 0; i--)
            {
                if (_activeNotifications[i] == null)
                {
                    _activeNotifications.RemoveAt(i);
                }
            }
        }
        #endregion

        #region Public Methods - Notifications
        /// <summary>
        /// Shows a notification for an incoming chat message.
        /// </summary>
        /// <param name="senderName">Name of the message sender.</param>
        /// <param name="messagePreview">Preview text of the message.</param>
        /// <param name="channel">The channel the message was sent in.</param>
        /// <param name="isUrgent">Whether this is an urgent notification (whisper, mention).</param>
        public void ShowNotification(string senderName, string messagePreview, ChatChannel channel, bool isUrgent = false)
        {
            if (!ShowNotifications) return;
            if (string.IsNullOrEmpty(messagePreview)) return;

            // Check Do Not Disturb
            if (_doNotDisturb && !isUrgent) return;

            // Create notification data
            var notification = new NotificationData
            {
                SenderName = senderName ?? "Unknown",
                MessagePreview = TruncatePreview(StripRichTextTags(messagePreview)),
                Channel = channel,
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                IsUrgent = isUrgent,
                ChannelColor = GetChannelColor(channel)
            };

            _notificationQueue.Enqueue(notification);
            _unreadCount++;
            _unreadByChannel[channel]++;

            OnUnreadCountChanged?.Invoke(_unreadCount);

            // Start processing queue if not already running
            if (!_isProcessingQueue)
            {
                StartCoroutine(ProcessNotificationQueue());
            }
        }

        /// <summary>
        /// Shows a notification directly from a ChatMessage.
        /// </summary>
        /// <param name="message">The chat message to create a notification for.</param>
        public void ShowNotificationFromMessage(ChatMessage message)
        {
            if (message == null) return;

            bool isUrgent = message.Channel == ChatChannel.Whisper ||
                           message.Content.Contains(ChatManager.Instance?.LocalPlayerName ?? "");

            ShowNotification(message.SenderName, message.Content, message.Channel, isUrgent);
        }

        /// <summary>
        /// Clears all active notifications and the pending queue.
        /// </summary>
        public void ClearNotifications()
        {
            _notificationQueue.Clear();

            // Dismiss all active notifications
            foreach (var notification in _activeNotifications.ToList())
            {
                if (notification != null)
                {
                    StartCoroutine(DismissNotificationCoroutine(notification));
                }
            }
            _activeNotifications.Clear();
        }

        /// <summary>
        /// Resets the unread count to zero.
        /// </summary>
        public void ClearUnreadCount()
        {
            _unreadCount = 0;
            foreach (ChatChannel channel in Enum.GetValues(typeof(ChatChannel)))
            {
                _unreadByChannel[channel] = 0;
            }
            OnUnreadCountChanged?.Invoke(0);
        }

        /// <summary>
        /// Gets the unread count for a specific channel.
        /// </summary>
        /// <param name="channel">The channel to query.</param>
        /// <returns>Unread count for the channel.</returns>
        public int GetUnreadCountForChannel(ChatChannel channel)
        {
            return _unreadByChannel.TryGetValue(channel, out int count) ? count : 0;
        }

        /// <summary>
        /// Enables or disables notification toasts.
        /// </summary>
        /// <param name="enabled">Whether to show notifications.</param>
        public void SetNotificationsEnabled(bool enabled)
        {
            ShowNotifications = enabled;
        }

        /// <summary>
        /// Enables or disables Do Not Disturb mode.
        /// </summary>
        /// <param name="enabled">Whether to enable Do Not Disturb.</param>
        public void SetDoNotDisturb(bool enabled)
        {
            _doNotDisturb = enabled;
        }
        #endregion

        #region Private Methods - Notification Processing
        /// <summary>
        /// Coroutine that processes the notification queue, showing one at a time with delays.
        /// </summary>
        private IEnumerator ProcessNotificationQueue()
        {
            _isProcessingQueue = true;

            while (_notificationQueue.Count > 0)
            {
                // Wait if we've reached max visible notifications
                while (_activeNotifications.Count >= MaxVisibleNotifications)
                {
                    yield return new WaitForSeconds(0.5f);
                }

                var notification = _notificationQueue.Dequeue();
                yield return CreateAndShowNotification(notification);

                // Delay between notifications
                if (_notificationQueue.Count > 0)
                {
                    yield return new WaitForSeconds(NotificationDelay);
                }
            }

            _isProcessingQueue = false;
        }

        /// <summary>
        /// Creates and shows a single notification toast.
        /// </summary>
        private IEnumerator CreateAndShowNotification(NotificationData notification)
        {
            if (NotificationPrefab == null || NotificationContainer == null)
            {
                yield break;
            }

            // Instantiate notification
            GameObject notificationObj = Instantiate(NotificationPrefab, NotificationContainer);
            notificationObj.name = $"Notification_{notification.SenderName}_{notification.Timestamp}";

            // Setup notification UI
            SetupNotificationUI(notificationObj, notification);

            // Add click handler
            Button button = notificationObj.GetComponent<Button>();
            if (button == null)
            {
                button = notificationObj.AddComponent<Button>();
            }
            button.onClick.AddListener(() => OnNotificationClickedHandler(notification, notificationObj));

            _activeNotifications.Add(notificationObj);

            // Play sound
            if (PlaySounds && _audioSource != null)
            {
                AudioClip clip = notification.IsUrgent && UrgentMessageSFX != null
                    ? UrgentMessageSFX
                    : NewMessageSFX;

                if (clip != null)
                {
                    _audioSource.PlayOneShot(clip);
                }
            }

            OnNotificationShown?.Invoke(notification);

            // Fade in
            CanvasGroup canvasGroup = notificationObj.GetComponent<CanvasGroup>();
            if (canvasGroup == null)
            {
                canvasGroup = notificationObj.AddComponent<CanvasGroup>();
            }

            yield return FadeCanvasGroup(canvasGroup, 0f, 1f, FadeInDuration);

            // Wait for display duration
            yield return new WaitForSeconds(NotificationDisplayDuration);

            // Fade out and destroy (if not already clicked/dismissed)
            if (notificationObj != null)
            {
                yield return FadeCanvasGroup(canvasGroup, 1f, 0f, FadeOutDuration);

                _activeNotifications.Remove(notificationObj);
                if (notificationObj != null)
                {
                    Destroy(notificationObj);
                }

                OnNotificationDismissed?.Invoke(notification);
            }

            RepositionNotifications();
        }

        /// <summary>
        /// Sets up the UI elements of a notification toast.
        /// </summary>
        private void SetupNotificationUI(GameObject notificationObj, NotificationData notification)
        {
            // Find and setup text components
            TMP_Text[] textComponents = notificationObj.GetComponentsInChildren<TMP_Text>(true);

            foreach (var text in textComponents)
            {
                string lowerName = text.gameObject.name.ToLowerInvariant();

                if (lowerName.Contains("sender") || lowerName.Contains("name"))
                {
                    text.text = notification.SenderName;
                    text.color = notification.ChannelColor;
                }
                else if (lowerName.Contains("message") || lowerName.Contains("preview") || lowerName.Contains("body"))
                {
                    text.text = notification.MessagePreview;
                }
                else if (lowerName.Contains("channel"))
                {
                    text.text = notification.Channel.ToString();
                    text.color = notification.ChannelColor;
                }
            }

            // Setup background color based on urgency
            Image bgImage = notificationObj.GetComponent<Image>();
            if (bgImage != null)
            {
                if (notification.IsUrgent)
                {
                    bgImage.color = new Color(0.3f, 0.15f, 0.15f, 0.9f);
                }
                else
                {
                    bgImage.color = new Color(0.1f, 0.1f, 0.15f, 0.85f);
                }
            }

            // Setup urgent indicator if available
            Transform urgentIndicator = notificationObj.transform.Find("UrgentIndicator");
            if (urgentIndicator != null)
            {
                urgentIndicator.gameObject.SetActive(notification.IsUrgent);
            }
        }

        /// <summary>
        /// Handles notification click - opens chat and focuses the relevant channel.
        /// </summary>
        private void OnNotificationClickedHandler(NotificationData notification, GameObject notificationObj)
        {
            OnNotificationClicked?.Invoke(notification);

            // Remove the notification
            _activeNotifications.Remove(notificationObj);
            if (notificationObj != null)
            {
                Destroy(notificationObj);
            }

            RepositionNotifications();
        }

        /// <summary>
        /// Coroutine for dismissing a notification with fade out.
        /// </summary>
        private IEnumerator DismissNotificationCoroutine(GameObject notificationObj)
        {
            if (notificationObj == null) yield break;

            CanvasGroup canvasGroup = notificationObj.GetComponent<CanvasGroup>();
            if (canvasGroup != null)
            {
                yield return FadeCanvasGroup(canvasGroup, canvasGroup.alpha, 0f, FadeOutDuration);
            }

            if (notificationObj != null)
            {
                Destroy(notificationObj);
            }
        }

        /// <summary>
        /// Coroutine for fading a CanvasGroup's alpha.
        /// </summary>
        private IEnumerator FadeCanvasGroup(CanvasGroup canvasGroup, float from, float to, float duration)
        {
            if (canvasGroup == null) yield break;

            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                canvasGroup.alpha = Mathf.Lerp(from, to, elapsed / duration);
                yield return null;
            }
            canvasGroup.alpha = to;
        }

        /// <summary>
        /// Repositions active notifications to fill gaps after dismissals.
        /// </summary>
        private void RepositionNotifications()
        {
            if (ContainerRectTransform == null) return;

            for (int i = 0; i < _activeNotifications.Count; i++)
            {
                GameObject notification = _activeNotifications[i];
                if (notification == null) continue;

                RectTransform rect = notification.GetComponent<RectTransform>();
                if (rect == null) continue;

                // Calculate position based on index and position setting
                float yOffset = -(i * (rect.sizeDelta.y + NotificationSpacing));
                Vector2 anchoredPos = GetBasePosition();
                anchoredPos.y += yOffset;

                rect.anchoredPosition = anchoredPos;
            }
        }
        #endregion

        #region Private Methods - Event Handlers
        /// <summary>
        /// Handles incoming messages from ChatManager to generate notifications.
        /// </summary>
        private void HandleMessageReceived(ChatMessage message)
        {
            if (message == null) return;
            if (message.IsSystemMessage) return;

            // Skip messages from self
            if (ChatManager.Instance != null && message.SenderId == ChatManager.Instance.LocalPlayerId)
            {
                return;
            }

            // Skip blocked/muted players
            if (ChatManager.Instance != null)
            {
                if (ChatManager.Instance.IsPlayerBlocked(message.SenderId)) return;
                if (ChatManager.Instance.IsPlayerMuted(message.SenderId)) return;
            }

            // Determine if urgent (whisper or mention)
            bool isUrgent = message.Channel == ChatChannel.Whisper;
            if (ChatManager.Instance != null && !string.IsNullOrEmpty(ChatManager.Instance.LocalPlayerName))
            {
                isUrgent |= message.Content.Contains(ChatManager.Instance.LocalPlayerName);
            }

            ShowNotification(message.SenderName, message.Content, message.Channel, isUrgent);
        }
        #endregion

        #region Private Methods - Helpers
        /// <summary>
        /// Gets the display color for a chat channel.
        /// </summary>
        private Color GetChannelColor(ChatChannel channel)
        {
            if (ChatManager.Instance != null)
            {
                var channelInfo = ChatManager.Instance.GetChannelInfo(channel);
                if (channelInfo != null)
                {
                    return channelInfo.ChannelColor;
                }
            }

            return channel switch
            {
                ChatChannel.World => new Color(0.4f, 0.8f, 1f),
                ChatChannel.Proximity => new Color(0.5f, 1f, 0.5f),
                ChatChannel.Island => new Color(1f, 0.6f, 0.2f),
                ChatChannel.Party => new Color(0.8f, 0.4f, 1f),
                ChatChannel.System => Color.yellow,
                ChatChannel.Whisper => new Color(1f, 0.5f, 0.8f),
                _ => Color.white
            };
        }

        /// <summary>
        /// Truncates message preview to MaxPreviewLength with ellipsis.
        /// </summary>
        private string TruncatePreview(string text)
        {
            if (string.IsNullOrEmpty(text)) return "";
            if (text.Length <= MaxPreviewLength) return text;
            return text.Substring(0, MaxPreviewLength - 3) + "...";
        }

        /// <summary>
        /// Strips rich text tags for notification preview.
        /// </summary>
        private static string StripRichTextTags(string input)
        {
            if (string.IsNullOrEmpty(input)) return input;
            return Regex.Replace(input, "<[^>]+>", string.Empty);
        }

        /// <summary>
        /// Calculates the base anchored position based on the Position setting.
        /// </summary>
        private Vector2 GetBasePosition()
        {
            if (ContainerRectTransform == null) return Vector2.zero;

            Vector2 containerSize = ContainerRectTransform.sizeDelta;

            return Position switch
            {
                NotificationPosition.TopLeft => new Vector2(ScreenPadding.x, -ScreenPadding.y),
                NotificationPosition.TopRight => new Vector2(-ScreenPadding.x, -ScreenPadding.y),
                NotificationPosition.BottomLeft => new Vector2(ScreenPadding.x, ScreenPadding.y),
                NotificationPosition.BottomRight => new Vector2(-ScreenPadding.x, ScreenPadding.y),
                _ => new Vector2(-ScreenPadding.x, -ScreenPadding.y)
            };
        }

        /// <summary>
        /// Sets up the initial container position and pivot.
        /// </summary>
        private void SetupContainerPosition()
        {
            if (ContainerRectTransform == null) return;

            switch (Position)
            {
                case NotificationPosition.TopLeft:
                    ContainerRectTransform.anchorMin = new Vector2(0, 1);
                    ContainerRectTransform.anchorMax = new Vector2(0, 1);
                    ContainerRectTransform.pivot = new Vector2(0, 1);
                    break;
                case NotificationPosition.TopRight:
                    ContainerRectTransform.anchorMin = new Vector2(1, 1);
                    ContainerRectTransform.anchorMax = new Vector2(1, 1);
                    ContainerRectTransform.pivot = new Vector2(1, 1);
                    break;
                case NotificationPosition.BottomLeft:
                    ContainerRectTransform.anchorMin = new Vector2(0, 0);
                    ContainerRectTransform.anchorMax = new Vector2(0, 0);
                    ContainerRectTransform.pivot = new Vector2(0, 0);
                    break;
                case NotificationPosition.BottomRight:
                    ContainerRectTransform.anchorMin = new Vector2(1, 0);
                    ContainerRectTransform.anchorMax = new Vector2(1, 0);
                    ContainerRectTransform.pivot = new Vector2(1, 0);
                    break;
            }

            ContainerRectTransform.anchoredPosition = GetBasePosition();
        }
        #endregion
    }

    #region Supporting Types
    /// <summary>
    /// Screen positions where notification toasts can appear.
    /// </summary>
    public enum NotificationPosition
    {
        TopLeft,
        TopRight,
        BottomLeft,
        BottomRight
    }

    /// <summary>
    /// Data structure for a single notification.
    /// </summary>
    public class NotificationData
    {
        /// <summary>Name of the message sender.</summary>
        public string SenderName;

        /// <summary>Truncated preview of the message content.</summary>
        public string MessagePreview;

        /// <summary>Channel the message was sent in.</summary>
        public ChatChannel Channel;

        /// <summary>Unix timestamp when the notification was created.</summary>
        public long Timestamp;

        /// <summary>Whether this is an urgent notification.</summary>
        public bool IsUrgent;

        /// <summary>Display color for the channel.</summary>
        public Color ChannelColor;

        /// <summary>Gets the relative time string.</summary>
        public string RelativeTime
        {
            get
            {
                double age = DateTimeOffset.UtcNow.ToUnixTimeSeconds() - Timestamp;
                if (age < 60) return "just now";
                if (age < 3600) return $"{(int)(age / 60)}m ago";
                return $"{(int)(age / 3600)}h ago";
            }
        }
    }
    #endregion
}
