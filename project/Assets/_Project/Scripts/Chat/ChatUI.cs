using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using TMPro;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.UI;

namespace KawaiiCoolIsland.Chat
{
    /// <summary>
    /// Screen-space chat panel UI for displaying message history, input, and channel selection.
    /// Implements message object pooling for performance, auto-scrolling, and channel-specific styling.
    /// </summary>
    public class ChatUI : MonoBehaviour
    {
        #region Header: References
        [Header("References")]
        [Tooltip("TMP_InputField for typing chat messages.")]
        public TMP_InputField InputField;

        [Tooltip("RectTransform container where message UI objects are instantiated.")]
        public RectTransform MessageContainer;

        [Tooltip("ScrollRect for scrolling through message history.")]
        public ScrollRect MessageScrollRect;

        [Tooltip("Prefab for standard player messages (should have TMP_Text component).")]
        public GameObject MessagePrefab;

        [Tooltip("Prefab for system messages (different styling).")]
        public GameObject SystemMessagePrefab;

        [Tooltip("TMP_Dropdown for channel selection.")]
        public TMP_Dropdown ChannelDropdown;

        [Tooltip("Button to send the current message.")]
        public Button SendButton;

        [Tooltip("Button to open the emoji picker.")]
        public Button EmojiButton;

        [Tooltip("Button to open the sticker picker.")]
        public Button StickerButton;

        [Tooltip("Toggle for enabling/disabling auto-scroll to bottom on new messages.")]
        public Toggle AutoScrollToggle;
        #endregion

        #region Header: Settings
        [Header("Settings")]
        [Tooltip("Maximum number of visible messages in the UI before trimming.")]
        public int MaxVisibleMessages = 50;

        [Tooltip("Vertical spacing between message entries in pixels.")]
        public float MessageSpacing = 5f;

        [Tooltip("Color for local player name in chat.")]
        public Color LocalPlayerColor = new Color(0.3f, 0.8f, 1f);

        [Tooltip("Color for other player names in chat.")]
        public Color OtherPlayerColor = Color.white;

        [Tooltip("Color for system messages in chat.")]
        public Color SystemColor = Color.yellow;

        [Tooltip("Color for whisper messages.")]
        public Color WhisperColor = new Color(1f, 0.5f, 0.8f);

        [Tooltip("Whether to show timestamps on messages.")]
        public bool ShowTimestamps = true;

        [Tooltip("Whether to play a sound on new messages.")]
        public bool PlaySoundOnMessage = true;

        [Tooltip("AudioClip to play when a new message arrives.")]
        public AudioClip MessageSound;

        [Tooltip("Font size for chat messages.")]
        public float MessageFontSize = 14;

        [Tooltip("Whether the chat UI starts visible.")]
        public bool StartVisible = true;
        #endregion

        #region Private Fields
        private readonly Queue<GameObject> _messagePool = new();
        private readonly List<GameObject> _activeMessages = new();
        private bool _isScrolledToBottom = true;
        private AudioSource _audioSource;
        private CanvasGroup _canvasGroup;
        private bool _isVisible = true;
        private readonly Dictionary<ChatChannel, int> _unreadCounts = new();
        #endregion

        #region Public Properties
        /// <summary>
        /// Number of currently visible messages in the chat panel.
        /// </summary>
        public int VisibleMessageCount => _activeMessages.Count;

        /// <summary>
        /// Whether the chat panel is currently visible.
        /// </summary>
        public bool IsVisible => _isVisible;

        /// <summary>
        /// Whether auto-scroll to bottom is enabled.
        /// </summary>
        public bool IsAutoScrollEnabled => AutoScrollToggle != null && AutoScrollToggle.isOn;

        /// <summary>
        /// Total unread messages across all channels.
        /// </summary>
        public int TotalUnreadCount => _unreadCounts.Values.Sum();
        #endregion

        #region Public Events
        /// <summary>
        /// Fired when the chat panel is shown.
        /// </summary>
        public event Action OnPanelShown;

        /// <summary>
        /// Fired when the chat panel is hidden.
        /// </summary>
        public event Action OnPanelHidden;

        /// <summary>
        /// Fired when a message is sent from the input field. Parameter: message text.
        /// </summary>
        public event Action<string> OnMessageSubmitted;

        /// <summary>
        /// Fired when the channel is changed. Parameter: new channel.
        /// </summary>
        public event Action<ChatChannel> OnChannelChanged;

        /// <summary>
        /// Fired when unread count changes. Parameter: total unread count.
        /// </summary>
        public event Action<int> OnUnreadCountChanged;
        #endregion

        #region Unity Lifecycle
        private void Awake()
        {
            _canvasGroup = GetComponent<CanvasGroup>();
            if (_canvasGroup == null)
            {
                _canvasGroup = gameObject.AddComponent<CanvasGroup>();
            }

            _audioSource = GetComponent<AudioSource>();
            if (_audioSource == null && PlaySoundOnMessage)
            {
                _audioSource = gameObject.AddComponent<AudioSource>();
                _audioSource.playOnAwake = false;
            }

            // Initialize unread counts
            foreach (ChatChannel channel in Enum.GetValues(typeof(ChatChannel)))
            {
                _unreadCounts[channel] = 0;
            }
        }

        private void Start()
        {
            SetupEventListeners();
            SetupChannelDropdown();

            if (!StartVisible)
            {
                HidePanel();
            }
            else
            {
                ShowPanel();
            }

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
            if (ChatManager.Instance != null)
            {
                ChatManager.Instance.OnMessageReceived -= HandleMessageReceived;
            }
        }

        private void Update()
        {
            // Toggle chat visibility with Return/Enter key
            if (Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.KeypadEnter))
            {
                if (!_isVisible)
                {
                    ShowPanel();
                    InputField?.Select();
                    InputField?.ActivateInputField();
                }
                else if (InputField != null && !InputField.isFocused)
                {
                    InputField.Select();
                    InputField.ActivateInputField();
                }
            }

            // Hide chat with Escape
            if (Input.GetKeyDown(KeyCode.Escape) && _isVisible)
            {
                if (InputField != null && InputField.isFocused)
                {
                    InputField.DeactivateInputField();
                }
                else
                {
                    HidePanel();
                }
            }
        }
        #endregion

        #region Public Methods - Panel Visibility
        /// <summary>
        /// Shows the chat panel.
        /// </summary>
        public void ShowPanel()
        {
            _isVisible = true;
            if (_canvasGroup != null)
            {
                _canvasGroup.alpha = 1f;
                _canvasGroup.interactable = true;
                _canvasGroup.blocksRaycasts = true;
            }

            // Clear unread counts for current channel
            if (ChatManager.Instance != null)
            {
                _unreadCounts[ChatManager.Instance.CurrentChannel] = 0;
                UpdateUnreadDisplay();
            }

            ScrollToBottom();
            OnPanelShown?.Invoke();
        }

        /// <summary>
        /// Hides the chat panel.
        /// </summary>
        public void HidePanel()
        {
            _isVisible = false;
            if (_canvasGroup != null)
            {
                _canvasGroup.alpha = 0f;
                _canvasGroup.interactable = false;
                _canvasGroup.blocksRaycasts = false;
            }

            // Deselect input field
            if (InputField != null)
            {
                InputField.DeactivateInputField();
            }

            OnPanelHidden?.Invoke();
        }

        /// <summary>
        /// Toggles the chat panel visibility.
        /// </summary>
        public void TogglePanel()
        {
            if (_isVisible)
                HidePanel();
            else
                ShowPanel();
        }
        #endregion

        #region Public Methods - Messages
        /// <summary>
        /// Adds a chat message to the UI panel.
        /// </summary>
        /// <param name="message">The chat message to display.</param>
        public void AddMessage(ChatMessage message)
        {
            if (message == null) return;

            GameObject msgObj = GetMessageFromPool();
            if (msgObj == null) return;

            // Setup the message UI
            SetupMessageUI(msgObj, message);

            // Position in container
            msgObj.transform.SetParent(MessageContainer, false);
            msgObj.transform.SetAsLastSibling();

            _activeMessages.Add(msgObj);

            // Play sound
            if (PlaySoundOnMessage && _audioSource != null && MessageSound != null)
            {
                _audioSource.PlayOneShot(MessageSound);
            }

            // Auto-scroll
            if (_isScrolledToBottom && IsAutoScrollEnabled)
            {
                ScrollToBottom();
            }

            // Trim if needed
            TrimMessageHistory();

            // Update unread if panel is hidden
            if (!_isVisible)
            {
                _unreadCounts[message.Channel]++;
                UpdateUnreadDisplay();
            }
        }

        /// <summary>
        /// Adds a system message directly as text.
        /// </summary>
        /// <param name="text">The system message text.</param>
        public void AddSystemMessage(string text)
        {
            if (string.IsNullOrEmpty(text)) return;

            var systemMsg = new ChatMessage
            {
                MessageId = Guid.NewGuid().ToString("N").Substring(0, 16),
                SenderId = "system",
                SenderName = "System",
                Content = text,
                Channel = ChatChannel.System,
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                IsSystemMessage = true,
                Type = MessageType.System,
                Reactions = new List<EmoteReaction>()
            };

            AddMessage(systemMsg);
        }

        /// <summary>
        /// Clears all messages from the chat panel.
        /// </summary>
        public void ClearChat()
        {
            foreach (var msg in _activeMessages)
            {
                if (msg != null)
                {
                    ReturnMessageToPool(msg);
                }
            }
            _activeMessages.Clear();

            // Also clear from ChatManager history
            if (ChatManager.Instance != null)
            {
                ChatManager.Instance.ClearHistory(ChatManager.Instance.CurrentChannel);
            }
        }

        /// <summary>
        /// Scrolls the message view to the bottom (most recent message).
        /// </summary>
        public void ScrollToBottom()
        {
            if (MessageScrollRect == null) return;

            Canvas.ForceUpdateCanvases();
            MessageScrollRect.verticalNormalizedPosition = 0f;
            Canvas.ForceUpdateCanvases();
        }

        /// <summary>
        /// Refreshes the channel dropdown UI to match current channels.
        /// </summary>
        public void RefreshChannelUI()
        {
            SetupChannelDropdown();
        }

        /// <summary>
        /// Loads and displays message history for the current channel.
        /// </summary>
        public void LoadChannelHistory()
        {
            if (ChatManager.Instance == null) return;

            // Clear current messages
            foreach (var msg in _activeMessages)
            {
                if (msg != null) ReturnMessageToPool(msg);
            }
            _activeMessages.Clear();

            // Load history for current channel
            var history = ChatManager.Instance.GetMessageHistory(ChatManager.Instance.CurrentChannel, MaxVisibleMessages);
            foreach (var message in history)
            {
                GameObject msgObj = GetMessageFromPool();
                if (msgObj == null) continue;

                SetupMessageUI(msgObj, message);
                msgObj.transform.SetParent(MessageContainer, false);
                msgObj.transform.SetAsLastSibling();
                _activeMessages.Add(msgObj);
            }

            ScrollToBottom();
        }
        #endregion

        #region Private Methods - Setup
        /// <summary>
        /// Sets up all event listeners for UI components.
        /// </summary>
        private void SetupEventListeners()
        {
            if (SendButton != null)
            {
                SendButton.onClick.AddListener(OnSendClicked);
            }

            if (InputField != null)
            {
                InputField.onSubmit.AddListener(OnInputSubmit);
                InputField.onValueChanged.AddListener(OnInputValueChanged);
            }

            if (ChannelDropdown != null)
            {
                ChannelDropdown.onValueChanged.AddListener(OnChannelChanged);
            }

            if (MessageScrollRect != null)
            {
                MessageScrollRect.onValueChanged.AddListener(OnScrollValueChanged);
            }

            if (EmojiButton != null)
            {
                EmojiButton.onClick.AddListener(OnEmojiButtonClicked);
            }

            if (StickerButton != null)
            {
                StickerButton.onClick.AddListener(OnStickerButtonClicked);
            }
        }

        /// <summary>
        /// Sets up the channel dropdown with available channels.
        /// </summary>
        private void SetupChannelDropdown()
        {
            if (ChannelDropdown == null) return;
            if (ChatManager.Instance == null) return;

            ChannelDropdown.ClearOptions();

            var options = new List<TMP_Dropdown.OptionData>();
            foreach (var channelInfo in ChatManager.Instance.Channels)
            {
                string prefix = channelInfo.Channel == ChatManager.Instance.CurrentChannel
                    ? "> " : "  ";
                options.Add(new TMP_Dropdown.OptionData(
                    $"{prefix}{channelInfo.DisplayName}"));
            }

            ChannelDropdown.AddOptions(options);

            // Set current selection
            int currentIndex = ChatManager.Instance.Channels.FindIndex(
                c => c.Channel == ChatManager.Instance.CurrentChannel);
            if (currentIndex >= 0)
            {
                ChannelDropdown.SetValueWithoutNotify(currentIndex);
            }
        }

        /// <summary>
        /// Configures a message GameObject with the given ChatMessage data.
        /// </summary>
        private void SetupMessageUI(GameObject msgObj, ChatMessage message)
        {
            TMP_Text textComponent = msgObj.GetComponentInChildren<TMP_Text>();
            if (textComponent == null)
            {
                textComponent = msgObj.GetComponent<TMP_Text>();
            }

            if (textComponent != null)
            {
                textComponent.fontSize = MessageFontSize;

                if (message.IsSystemMessage)
                {
                    textComponent.color = SystemColor;
                    textComponent.text = $"<b><color=yellow>[System]</color></b> {message.Content}";
                }
                else
                {
                    // Determine name color
                    bool isLocalPlayer = message.SenderId == ChatManager.Instance?.LocalPlayerId;
                    Color nameColor = isLocalPlayer ? LocalPlayerColor : OtherPlayerColor;
                    string nameHex = ColorToHex(nameColor);

                    // Get channel color
                    ChatChannelInfo channelInfo = ChatManager.Instance?.GetChannelInfo(message.Channel);
                    string channelColorHex = channelInfo != null ? ColorToHex(channelInfo.ChannelColor) : "FFFFFF";

                    // Build formatted message
                    var sb = new System.Text.StringBuilder();

                    // Timestamp
                    if (ShowTimestamps)
                    {
                        sb.Append($"<color=#888888>[{message.GetFormattedTime()}]</color> ");
                    }

                    // Channel prefix for non-world channels
                    if (message.Channel != ChatChannel.World)
                    {
                        string channelTag = message.Channel == ChatChannel.Whisper
                            ? $"<color={ColorToHex(WhisperColor)}>[W]</color>"
                            : $"<color={channelColorHex}>[{channelInfo?.DisplayName ?? message.Channel.ToString()}]</color>";
                        sb.Append($"{channelTag} ");
                    }

                    // Sender name and content
                    string content = message.Type == MessageType.Sticker
                        ? $"<i>[Sticker: {message.Content}]</i>"
                        : message.Content;

                    sb.Append($"<color={nameHex}><b>{message.SenderName}</b></color>: {content}");

                    // Reactions
                    if (message.TotalReactionCount > 0)
                    {
                        sb.Append(" ");
                        foreach (var reaction in message.Reactions)
                        {
                            sb.Append($"<color=#FFD700>:{reaction.EmoteId}:x{reaction.Count}</color> ");
                        }
                    }

                    textComponent.text = sb.ToString();
                    textComponent.color = Color.white;
                }
            }

            // Add EmoteReactionUI component if not present
            EmoteReactionUI reactionUI = msgObj.GetComponent<EmoteReactionUI>();
            if (reactionUI == null && !message.IsSystemMessage)
            {
                reactionUI = msgObj.AddComponent<EmoteReactionUI>();
            }
            reactionUI?.Initialize(message);

            msgObj.SetActive(true);
        }
        #endregion

        #region Private Methods - Event Handlers
        /// <summary>
        /// Handles the send button click.
        /// </summary>
        private void OnSendClicked()
        {
            if (InputField == null) return;

            string text = InputField.text.Trim();
            if (string.IsNullOrWhiteSpace(text)) return;

            // Check if it's a command
            if (text.StartsWith("/"))
            {
                if (ChatManager.Instance != null)
                {
                    ChatManager.Instance.CommandHandler.TryExecuteCommand(text);
                }
            }
            else
            {
                ChatManager.Instance?.SendMessage(text);
                OnMessageSubmitted?.Invoke(text);
            }

            InputField.text = "";
            InputField.ActivateInputField();
        }

        /// <summary>
        /// Handles input field submission (Enter key).
        /// </summary>
        private void OnInputSubmit(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return;

            OnSendClicked();
        }

        /// <summary>
        /// Handles input value changes (for typing indicator).
        /// </summary>
        private void OnInputValueChanged(string text)
        {
            // Send typing indicator when user starts typing
            if (!string.IsNullOrEmpty(text))
            {
                ChatManager.Instance?.SetTyping(true);
            }
        }

        /// <summary>
        /// Handles channel dropdown changes.
        /// </summary>
        private void OnChannelChanged(int index)
        {
            if (ChatManager.Instance == null) return;
            if (index < 0 || index >= ChatManager.Instance.Channels.Count) return;

            var newChannel = ChatManager.Instance.Channels[index].Channel;
            ChatManager.Instance.SetChannel(newChannel);

            // Reload history for new channel
            LoadChannelHistory();

            OnChannelChanged?.Invoke(newChannel);
        }

        /// <summary>
        /// Handles scroll rect value changes to track if user is at bottom.
        /// </summary>
        private void OnScrollValueChanged(Vector2 scrollPos)
        {
            // scrollPos.y = 0 means scrolled to bottom
            _isScrolledToBottom = scrollPos.y <= 0.01f;
        }

        /// <summary>
        /// Handles emoji button click.
        /// </summary>
        private void OnEmojiButtonClicked()
        {
            // TODO: Show emoji picker
            Debug.Log("[ChatUI] Emoji picker requested.");
        }

        /// <summary>
        /// Handles sticker button click.
        /// </summary>
        private void OnStickerButtonClicked()
        {
            // TODO: Show sticker picker
            Debug.Log("[ChatUI] Sticker picker requested.");
        }

        /// <summary>
        /// Handles incoming messages from ChatManager.
        /// </summary>
        private void HandleMessageReceived(ChatMessage message)
        {
            // Only show messages for the current channel
            if (ChatManager.Instance == null) return;

            ChatChannel currentChannel = ChatManager.Instance.CurrentChannel;

            // Whisper messages are special - show if sent to/from local player
            if (message.Channel == ChatChannel.Whisper)
            {
                bool isRelevant = message.SenderId == ChatManager.Instance.LocalPlayerId ||
                                  message.TargetPlayerId == ChatManager.Instance.LocalPlayerId;
                if (!isRelevant) return;
            }
            // System messages always show
            else if (message.Channel != ChatChannel.System && message.Channel != currentChannel)
            {
                // Not for current channel, count as unread
                if (!_isVisible)
                {
                    _unreadCounts[message.Channel]++;
                    UpdateUnreadDisplay();
                }
                return;
            }

            AddMessage(message);
        }
        #endregion

        #region Private Methods - Object Pooling
        /// <summary>
        /// Gets a message GameObject from the pool or creates a new one.
        /// </summary>
        private GameObject GetMessageFromPool()
        {
            if (_messagePool.Count > 0)
            {
                GameObject pooled = _messagePool.Dequeue();
                pooled.SetActive(true);
                return pooled;
            }

            // Determine which prefab to use
            GameObject prefab = MessagePrefab;

            if (prefab == null)
            {
                Debug.LogError("[ChatUI] MessagePrefab is not assigned!");
                return null;
            }

            GameObject newObj = Instantiate(prefab, MessageContainer);
            return newObj;
        }

        /// <summary>
        /// Returns a message GameObject to the pool for reuse.
        /// </summary>
        private void ReturnMessageToPool(GameObject msg)
        {
            if (msg == null) return;

            msg.SetActive(false);
            msg.transform.SetParent(transform, false);

            // Clear text
            TMP_Text text = msg.GetComponentInChildren<TMP_Text>();
            if (text != null)
            {
                text.text = "";
            }

            _messagePool.Enqueue(msg);
        }

        /// <summary>
        /// Trims the visible message list to MaxVisibleMessages.
        /// </summary>
        private void TrimMessageHistory()
        {
            while (_activeMessages.Count > MaxVisibleMessages)
            {
                GameObject oldest = _activeMessages[0];
                _activeMessages.RemoveAt(0);
                ReturnMessageToPool(oldest);
            }
        }
        #endregion

        #region Private Methods - Helpers
        /// <summary>
        /// Returns the channel prefix string for display.
        /// </summary>
        private string GetChannelPrefix(ChatChannel channel)
        {
            return channel switch
            {
                ChatChannel.World => "",
                ChatChannel.Proximity => "[Near] ",
                ChatChannel.Island => "[Island] ",
                ChatChannel.Party => "[Party] ",
                ChatChannel.System => "[System] ",
                ChatChannel.Whisper => "[Whisper] ",
                _ => ""
            };
        }

        /// <summary>
        /// Converts a Unity Color to a hex string.
        /// </summary>
        private static string ColorToHex(Color color)
        {
            int r = Mathf.RoundToInt(color.r * 255);
            int g = Mathf.RoundToInt(color.g * 255);
            int b = Mathf.RoundToInt(color.b * 255);
            return $"#{r:X2}{g:X2}{b:X2}";
        }

        /// <summary>
        /// Updates the unread count display.
        /// </summary>
        private void UpdateUnreadDisplay()
        {
            int total = TotalUnreadCount;
            OnUnreadCountChanged?.Invoke(total);

            // TODO: Update UI badge
        }

        /// <summary>
        /// Strips rich text tags for length calculation.
        /// </summary>
        private static string StripRichTextTags(string input)
        {
            if (string.IsNullOrEmpty(input)) return input;
            return Regex.Replace(input, "<[^>]+>", string.Empty);
        }
        #endregion
    }
}
