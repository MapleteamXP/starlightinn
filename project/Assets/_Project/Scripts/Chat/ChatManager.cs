using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using TMPro;
using UnityEngine;

namespace KawaiiCoolIsland.Chat
{
    /// <summary>
    /// Central manager for the KawaiiCool Island real-time chat system.
    /// Handles message routing, profanity filtering, typing indicators, player moderation,
    /// and multi-channel communication (World, Proximity, Island, Party, System, Whisper).
    /// </summary>
    public class ChatManager : MonoBehaviour
    {
        #region Singleton Pattern
        private static ChatManager _instance;
        public static ChatManager Instance
        {
            get
            {
                if (_instance == null)
                {
                    _instance = FindObjectOfType<ChatManager>();
                    if (_instance == null)
                    {
                        var go = new GameObject("ChatManager");
                        _instance = go.AddComponent<ChatManager>();
                        DontDestroyOnLoad(go);
                    }
                }
                return _instance;
            }
        }
        #endregion

        #region Header: Settings
        [Header("Settings")]
        [Tooltip("Maximum number of messages stored per channel history.")]
        public int MaxMessageHistory = 200;

        [Tooltip("How long chat bubbles remain visible above player heads (seconds).")]
        public float MessageDisplayTime = 5f;

        [Tooltip("How long typing indicators remain visible without updates (seconds).")]
        public float TypingIndicatorTimeout = 5f;

        [Tooltip("Maximum character length for a single chat message.")]
        public int MaxMessageLength = 200;

        [Tooltip("Minimum seconds between messages from the same player (rate limiting).")]
        public float MessageRateLimit = 0.5f;

        [Tooltip("Local player identifier used for sending messages.")]
        public string LocalPlayerId = "local_player";

        [Tooltip("Local player display name shown in chat.")]
        public string LocalPlayerName = "Player";
        #endregion

        #region Header: Profanity Filter
        [Header("Profanity Filter")]
        [Tooltip("Enable or disable the profanity filter globally.")]
        public bool EnableProfanityFilter = true;

        [Tooltip("TextAsset containing profanity words, one per line.")]
        public TextAsset ProfanityWordList;

        [Tooltip("String used to replace profanity words (e.g., ***).")]
        public string ProfanityReplacement = "***";
        #endregion

        #region Header: Channels
        [Header("Channels")]
        [Tooltip("List of configured chat channels with their settings.")]
        public List<ChatChannelInfo> Channels = new();
        #endregion

        #region Private Fields
        private readonly Dictionary<ChatChannel, List<ChatMessage>> _messageHistory = new();
        private readonly Dictionary<string, TypingIndicator> _typingIndicators = new();
        private readonly HashSet<string> _mutedPlayers = new();
        private readonly HashSet<string> _blockedPlayers = new();
        private float _lastMessageTime;
        private ChatChannel _currentChannel = ChatChannel.World;
        private ProfanityFilter _profanityFilter;
        private ChatCommandHandler _commandHandler;
        private bool _isInitialized;
        #endregion

        #region Public Properties
        /// <summary>
        /// The currently active chat channel for sending messages.
        /// </summary>
        public ChatChannel CurrentChannel => _currentChannel;

        /// <summary>
        /// The command handler for processing slash commands.
        /// </summary>
        public ChatCommandHandler CommandHandler => _commandHandler;

        /// <summary>
        /// Whether the chat manager has completed initialization.
        /// </summary>
        public bool IsInitialized => _isInitialized;
        #endregion

        #region Public Events
        /// <summary>
        /// Fired when any chat message is received from the network or local source.
        /// </summary>
        public event Action<ChatMessage> OnMessageReceived;

        /// <summary>
        /// Fired when the local player successfully sends a message.
        /// </summary>
        public event Action<ChatMessage> OnMessageSent;

        /// <summary>
        /// Fired when a typing indicator is shown. Parameters: playerId, playerName.
        /// </summary>
        public event Action<string, string> OnTypingIndicatorShown;

        /// <summary>
        /// Fired when a typing indicator is hidden. Parameter: playerId.
        /// </summary>
        public event Action<string> OnTypingIndicatorHidden;

        /// <summary>
        /// Fired when a player is muted. Parameter: playerId.
        /// </summary>
        public event Action<string> OnPlayerMuted;

        /// <summary>
        /// Fired when a player is unmuted. Parameter: playerId.
        /// </summary>
        public event Action<string> OnPlayerUnmuted;

        /// <summary>
        /// Fired when a player is blocked. Parameter: playerId.
        /// </summary>
        public event Action<string> OnPlayerBlocked;

        /// <summary>
        /// Fired when a player is unblocked. Parameter: playerId.
        /// </summary>
        public event Action<string> OnPlayerUnblocked;
        #endregion

        #region Unity Lifecycle
        private void Awake()
        {
            if (_instance != null && _instance != this)
            {
                Destroy(gameObject);
                return;
            }
            _instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void Start()
        {
            Initialize();
        }

        private void Update()
        {
            // Clean up expired typing indicators
            var expiredIndicators = _typingIndicators
                .Where(kvp => kvp.Value == null)
                .Select(kvp => kvp.Key)
                .ToList();

            foreach (var playerId in expiredIndicators)
            {
                _typingIndicators.Remove(playerId);
            }
        }
        #endregion

        #region Public Methods
        /// <summary>
        /// Initializes the chat manager, profanity filter, command handler, and channel history.
        /// Should be called before using any chat functionality.
        /// </summary>
        public void Initialize()
        {
            if (_isInitialized) return;

            // Initialize message history for all channels
            foreach (ChatChannel channel in Enum.GetValues(typeof(ChatChannel)))
            {
                if (!_messageHistory.ContainsKey(channel))
                {
                    _messageHistory[channel] = new List<ChatMessage>();
                }
            }

            // Initialize profanity filter
            _profanityFilter = new ProfanityFilter(ProfanityReplacement, true);
            if (EnableProfanityFilter && ProfanityWordList != null)
            {
                _profanityFilter.LoadWordList(ProfanityWordList);
            }

            // Initialize command handler with built-in commands
            _commandHandler = new ChatCommandHandler();
            RegisterBuiltInCommands();

            // Setup default channels if none configured
            if (Channels == null || Channels.Count == 0)
            {
                SetupDefaultChannels();
            }

            _isInitialized = true;
            Debug.Log("[ChatManager] Initialized successfully.");
        }

        /// <summary>
        /// Switches the current active chat channel.
        /// </summary>
        /// <param name="channel">The channel to switch to.</param>
        public void SetChannel(ChatChannel channel)
        {
            if (_currentChannel == channel) return;

            _currentChannel = channel;
            Debug.Log($"[ChatManager] Switched to channel: {channel}");
        }

        /// <summary>
        /// Sends a chat message to the specified channel (or current channel if null).
        /// Applies profanity filtering, rate limiting, and validation.
        /// </summary>
        /// <param name="message">The raw message text to send.</param>
        /// <param name="channel">Optional target channel. Uses current channel if null.</param>
        public void SendMessage(string message, ChatChannel? channel = null)
        {
            if (!_isInitialized) Initialize();
            if (string.IsNullOrWhiteSpace(message)) return;

            var targetChannel = channel ?? _currentChannel;

            // Check for slash commands
            if (message.StartsWith("/"))
            {
                bool handled = _commandHandler.TryExecuteCommand(message);
                if (handled) return;
            }

            // Rate limiting check
            if (Time.time - _lastMessageTime < MessageRateLimit)
            {
                Debug.LogWarning("[ChatManager] Message rate limited. Please wait.");
                return;
            }

            // Validate message
            if (!ValidateMessage(message))
            {
                Debug.LogWarning("[ChatManager] Message validation failed.");
                return;
            }

            // Strip rich text tags for length calculation
            string plainText = StripRichTextTags(message);
            if (plainText.Length > MaxMessageLength)
            {
                Debug.LogWarning($"[ChatManager] Message exceeds max length of {MaxMessageLength}.");
                return;
            }

            // Apply profanity filter
            string filteredContent = EnableProfanityFilter
                ? _profanityFilter.Filter(message)
                : message;

            // Create message object
            var chatMessage = new ChatMessage
            {
                MessageId = GenerateMessageId(),
                SenderId = LocalPlayerId,
                SenderName = LocalPlayerName,
                Content = filteredContent,
                Channel = targetChannel,
                Timestamp = GetUnixTimestamp(),
                IsSystemMessage = false,
                Type = MessageType.Text,
                Reactions = new List<EmoteReaction>()
            };

            _lastMessageTime = Time.time;

            // Send (in a real game, this would go through the network layer)
            ReceiveMessage(chatMessage);
            OnMessageSent?.Invoke(chatMessage);
        }

        /// <summary>
        /// Sends a system-generated message to the specified channel.
        /// </summary>
        /// <param name="message">The system message content.</param>
        /// <param name="channel">Target channel for the system message.</param>
        public void SendSystemMessage(string message, ChatChannel channel = ChatChannel.System)
        {
            if (!_isInitialized) Initialize();
            if (string.IsNullOrWhiteSpace(message)) return;

            var systemMessage = new ChatMessage
            {
                MessageId = GenerateMessageId(),
                SenderId = "system",
                SenderName = "System",
                Content = message,
                Channel = channel,
                Timestamp = GetUnixTimestamp(),
                IsSystemMessage = true,
                Type = MessageType.System,
                Reactions = new List<EmoteReaction>()
            };

            ReceiveMessage(systemMessage);
        }

        /// <summary>
        /// Sends an emote reaction to a specific message.
        /// </summary>
        /// <param name="messageId">The target message ID.</param>
        /// <param name="emoteId">The emote identifier to react with.</param>
        public void SendEmoteReaction(string messageId, string emoteId)
        {
            if (string.IsNullOrEmpty(messageId) || string.IsNullOrEmpty(emoteId)) return;

            // Find the message across all channels
            ChatMessage targetMessage = null;
            foreach (var channelHistory in _messageHistory.Values)
            {
                targetMessage = channelHistory.Find(m => m.MessageId == messageId);
                if (targetMessage != null) break;
            }

            if (targetMessage == null)
            {
                Debug.LogWarning($"[ChatManager] Message {messageId} not found for reaction.");
                return;
            }

            targetMessage.AddReaction(emoteId, LocalPlayerId);

            // Broadcast the reaction update
            Debug.Log($"[ChatManager] Reaction {emoteId} added to message {messageId}");
        }

        /// <summary>
        /// Sends a sticker message to the specified channel.
        /// </summary>
        /// <param name="stickerId">The sticker identifier to send.</param>
        /// <param name="channel">Optional target channel. Uses current channel if null.</param>
        public void SendSticker(string stickerId, ChatChannel? channel = null)
        {
            if (!_isInitialized) Initialize();
            if (string.IsNullOrEmpty(stickerId)) return;

            if (Time.time - _lastMessageTime < MessageRateLimit)
            {
                Debug.LogWarning("[ChatManager] Message rate limited.");
                return;
            }

            var targetChannel = channel ?? _currentChannel;

            var stickerMessage = new ChatMessage
            {
                MessageId = GenerateMessageId(),
                SenderId = LocalPlayerId,
                SenderName = LocalPlayerName,
                Content = stickerId,
                Channel = targetChannel,
                Timestamp = GetUnixTimestamp(),
                IsSystemMessage = false,
                Type = MessageType.Sticker,
                Reactions = new List<EmoteReaction>()
            };

            _lastMessageTime = Time.time;
            ReceiveMessage(stickerMessage);
            OnMessageSent?.Invoke(stickerMessage);
        }

        /// <summary>
        /// Sets the local player's typing state and broadcasts it to other players.
        /// </summary>
        /// <param name="isTyping">True if the player is currently typing.</param>
        public void SetTyping(bool isTyping)
        {
            // In a real networked game, this would send typing state to the server
            // For now we just log it
            Debug.Log($"[ChatManager] Typing state: {isTyping}");
        }

        /// <summary>
        /// Displays a typing indicator for a remote player.
        /// </summary>
        /// <param name="playerId">The player who is typing.</param>
        /// <param name="playerName">The display name of the typing player.</param>
        public void ShowTypingIndicator(string playerId, string playerName)
        {
            if (IsPlayerBlocked(playerId)) return;

            OnTypingIndicatorShown?.Invoke(playerId, playerName);
        }

        /// <summary>
        /// Hides the typing indicator for a remote player.
        /// </summary>
        /// <param name="playerId">The player who stopped typing.</param>
        public void HideTypingIndicator(string playerId)
        {
            OnTypingIndicatorHidden?.Invoke(playerId);
        }

        /// <summary>
        /// Mutes a player for a specified duration, preventing their messages from appearing.
        /// </summary>
        /// <param name="playerId">The player to mute.</param>
        /// <param name="durationMinutes">Duration of the mute in minutes. Default is 60.</param>
        public void MutePlayer(string playerId, float durationMinutes = 60f)
        {
            if (string.IsNullOrEmpty(playerId)) return;

            _mutedPlayers.Add(playerId);
            OnPlayerMuted?.Invoke(playerId);

            Debug.Log($"[ChatManager] Player {playerId} muted for {durationMinutes} minutes.");

            // Auto-unmute after duration
            if (durationMinutes > 0)
            {
                StartCoroutine(AutoUnmuteCoroutine(playerId, durationMinutes));
            }
        }

        /// <summary>
        /// Unmutes a previously muted player.
        /// </summary>
        /// <param name="playerId">The player to unmute.</param>
        public void UnmutePlayer(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return;

            _mutedPlayers.Remove(playerId);
            OnPlayerUnmuted?.Invoke(playerId);

            Debug.Log($"[ChatManager] Player {playerId} unmuted.");
        }

        /// <summary>
        /// Blocks a player, preventing all communication including messages and friend requests.
        /// </summary>
        /// <param name="playerId">The player to block.</param>
        public void BlockPlayer(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return;

            _blockedPlayers.Add(playerId);
            OnPlayerBlocked?.Invoke(playerId);

            Debug.Log($"[ChatManager] Player {playerId} blocked.");
        }

        /// <summary>
        /// Unblocks a previously blocked player.
        /// </summary>
        /// <param name="playerId">The player to unblock.</param>
        public void UnblockPlayer(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return;

            _blockedPlayers.Remove(playerId);
            OnPlayerUnblocked?.Invoke(playerId);

            Debug.Log($"[ChatManager] Player {playerId} unblocked.");
        }

        /// <summary>
        /// Checks if a player is currently blocked.
        /// </summary>
        /// <param name="playerId">The player to check.</param>
        /// <returns>True if the player is blocked.</returns>
        public bool IsPlayerBlocked(string playerId)
        {
            return !string.IsNullOrEmpty(playerId) && _blockedPlayers.Contains(playerId);
        }

        /// <summary>
        /// Checks if a player is currently muted.
        /// </summary>
        /// <param name="playerId">The player to check.</param>
        /// <returns>True if the player is muted.</returns>
        public bool IsPlayerMuted(string playerId)
        {
            return !string.IsNullOrEmpty(playerId) && _mutedPlayers.Contains(playerId);
        }

        /// <summary>
        /// Reports a message for moderation review.
        /// </summary>
        /// <param name="messageId">The ID of the message being reported.</param>
        /// <param name="reason">The reason for the report.</param>
        /// <param name="details">Optional additional details about the report.</param>
        public void ReportMessage(string messageId, ReportReason reason, string details = "")
        {
            if (string.IsNullOrEmpty(messageId)) return;

            // Find the message
            ChatMessage reportedMessage = null;
            foreach (var channelHistory in _messageHistory.Values)
            {
                reportedMessage = channelHistory.Find(m => m.MessageId == messageId);
                if (reportedMessage != null) break;
            }

            if (reportedMessage == null)
            {
                Debug.LogWarning($"[ChatManager] Cannot report: Message {messageId} not found.");
                return;
            }

            // In a real game, send report to backend moderation service
            Debug.Log($"[ChatManager] Message reported - ID: {messageId}, " +
                      $"Sender: {reportedMessage.SenderName}, Reason: {reason}, Details: {details}");

            SendSystemMessage($"Report submitted for review. Thank you for keeping KawaiiCool Island safe!");
        }

        /// <summary>
        /// Retrieves message history for a specific channel.
        /// </summary>
        /// <param name="channel">The channel to get history for.</param>
        /// <param name="count">Maximum number of messages to return (most recent first).</param>
        /// <returns>List of chat messages for the channel.</returns>
        public List<ChatMessage> GetMessageHistory(ChatChannel channel, int count = 50)
        {
            if (!_messageHistory.TryGetValue(channel, out var history))
            {
                return new List<ChatMessage>();
            }

            return history
                .OrderByDescending(m => m.Timestamp)
                .Take(count)
                .OrderBy(m => m.Timestamp)
                .ToList();
        }

        /// <summary>
        /// Clears all message history for a specific channel.
        /// </summary>
        /// <param name="channel">The channel to clear.</param>
        public void ClearHistory(ChatChannel channel)
        {
            if (_messageHistory.TryGetValue(channel, out var history))
            {
                history.Clear();
                Debug.Log($"[ChatManager] History cleared for channel: {channel}");
            }
        }

        /// <summary>
        /// Clears all message history across all channels.
        /// </summary>
        public void ClearAllHistory()
        {
            foreach (var history in _messageHistory.Values)
            {
                history.Clear();
            }
            Debug.Log("[ChatManager] All chat history cleared.");
        }

        /// <summary>
        /// Gets the channel info for a specific channel.
        /// </summary>
        /// <param name="channel">The channel to look up.</param>
        /// <returns>Channel info, or null if not found.</returns>
        public ChatChannelInfo GetChannelInfo(ChatChannel channel)
        {
            return Channels.Find(c => c.Channel == channel);
        }

        /// <summary>
        /// Adds a custom profanity word to the filter at runtime.
        /// </summary>
        /// <param name="word">The word to filter.</param>
        public void AddProfanityWord(string word)
        {
            _profanityFilter?.AddWord(word);
        }

        /// <summary>
        /// Removes a profanity word from the filter at runtime.
        /// </summary>
        /// <param name="word">The word to remove from the filter.</param>
        public void RemoveProfanityWord(string word)
        {
            _profanityFilter?.RemoveWord(word);
        }
        #endregion

        #region Private Methods
        /// <summary>
        /// Processes a received message: adds to history, filters blocked senders, fires events.
        /// </summary>
        private void ReceiveMessage(ChatMessage message)
        {
            if (message == null) return;

            // Check if sender is blocked or muted (for non-system messages)
            if (!message.IsSystemMessage)
            {
                if (IsPlayerBlocked(message.SenderId))
                {
                    Debug.Log($"[ChatManager] Message from blocked player {message.SenderId} ignored.");
                    return;
                }

                if (IsPlayerMuted(message.SenderId) && message.SenderId != LocalPlayerId)
                {
                    Debug.Log($"[ChatManager] Message from muted player {message.SenderId} ignored.");
                    return;
                }
            }

            // Add to channel history
            if (!_messageHistory.TryGetValue(message.Channel, out var history))
            {
                history = new List<ChatMessage>();
                _messageHistory[message.Channel] = history;
            }

            history.Add(message);

            // Trim history if exceeds max
            if (history.Count > MaxMessageHistory)
            {
                history.RemoveAt(0);
            }

            // Fire event
            OnMessageReceived?.Invoke(message);
        }

        /// <summary>
        /// Validates a message before sending. Checks for empty content and basic spam patterns.
        /// </summary>
        private bool ValidateMessage(string message)
        {
            if (string.IsNullOrWhiteSpace(message)) return false;

            string stripped = StripRichTextTags(message).Trim();
            if (string.IsNullOrWhiteSpace(stripped)) return false;
            if (stripped.Length < 1) return false;

            // Check for excessive repeated characters (spam indicator)
            var repeatedCharPattern = new Regex(@"(.)\1{10,}");
            if (repeatedCharPattern.IsMatch(stripped))
            {
                Debug.LogWarning("[ChatManager] Message blocked: excessive repeated characters.");
                return false;
            }

            // Check for excessive caps (shouting)
            if (stripped.Length > 10)
            {
                int capsCount = stripped.Count(char.IsUpper);
                if ((float)capsCount / stripped.Length > 0.9f)
                {
                    Debug.LogWarning("[ChatManager] Message blocked: excessive capitalization.");
                    return false;
                }
            }

            return true;
        }

        /// <summary>
        /// Generates a unique message ID using GUID.
        /// </summary>
        private string GenerateMessageId()
        {
            return Guid.NewGuid().ToString("N").Substring(0, 16);
        }

        /// <summary>
        /// Returns the current Unix timestamp in seconds.
        /// </summary>
        private long GetUnixTimestamp()
        {
            return DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        }

        /// <summary>
        /// Strips Unity rich text tags from a string for accurate length calculation.
        /// </summary>
        private string StripRichTextTags(string input)
        {
            if (string.IsNullOrEmpty(input)) return input;
            return Regex.Replace(input, "<[^>]+>", string.Empty);
        }

        /// <summary>
        /// Coroutine to automatically unmute a player after the specified duration.
        /// </summary>
        private IEnumerator AutoUnmuteCoroutine(string playerId, float durationMinutes)
        {
            yield return new WaitForSeconds(durationMinutes * 60f);
            UnmutePlayer(playerId);
        }

        /// <summary>
        /// Sets up default channel configurations if none are provided.
        /// </summary>
        private void SetupDefaultChannels()
        {
            Channels = new List<ChatChannelInfo>
            {
                new ChatChannelInfo
                {
                    Channel = ChatChannel.World,
                    DisplayName = "World",
                    ChannelColor = new Color(0.4f, 0.8f, 1f),
                    RequiresProximity = false,
                    IsModerated = true
                },
                new ChatChannelInfo
                {
                    Channel = ChatChannel.Proximity,
                    DisplayName = "Near",
                    ChannelColor = new Color(0.5f, 1f, 0.5f),
                    RequiresProximity = true,
                    ProximityRange = 20f,
                    IsModerated = true
                },
                new ChatChannelInfo
                {
                    Channel = ChatChannel.Island,
                    DisplayName = "Island",
                    ChannelColor = new Color(1f, 0.6f, 0.2f),
                    RequiresProximity = false,
                    IsModerated = true
                },
                new ChatChannelInfo
                {
                    Channel = ChatChannel.Party,
                    DisplayName = "Party",
                    ChannelColor = new Color(0.8f, 0.4f, 1f),
                    RequiresProximity = false,
                    IsModerated = false
                },
                new ChatChannelInfo
                {
                    Channel = ChatChannel.System,
                    DisplayName = "System",
                    ChannelColor = Color.yellow,
                    RequiresProximity = false,
                    IsModerated = false
                },
                new ChatChannelInfo
                {
                    Channel = ChatChannel.Whisper,
                    DisplayName = "Whisper",
                    ChannelColor = new Color(1f, 0.5f, 0.8f),
                    RequiresProximity = false,
                    IsModerated = true
                }
            };
        }

        /// <summary>
        /// Registers all built-in slash commands with the command handler.
        /// </summary>
        private void RegisterBuiltInCommands()
        {
            // Whisper command: /w <player> <message>
            _commandHandler.RegisterCommand(
                "w",
                "Send a private message to a player",
                args =>
                {
                    if (args.Length < 2)
                    {
                        SendSystemMessage("Usage: /w <player> <message>");
                        return;
                    }
                    string targetPlayer = args[0];
                    string whisperMessage = string.Join(" ", args, 1, args.Length - 1);
                    // In a real game, route this to the target player
                    SendMessage($"[To {targetPlayer}]: {whisperMessage}", ChatChannel.Whisper);
                });

            // Also register /whisper as alias
            _commandHandler.RegisterCommand(
                "whisper",
                "Send a private message to a player (alias for /w)",
                args =>
                {
                    if (args.Length < 2)
                    {
                        SendSystemMessage("Usage: /whisper <player> <message>");
                        return;
                    }
                    string targetPlayer = args[0];
                    string whisperMessage = string.Join(" ", args, 1, args.Length - 1);
                    SendMessage($"[To {targetPlayer}]: {whisperMessage}", ChatChannel.Whisper);
                });

            // Mute command: /mute <player>
            _commandHandler.RegisterCommand(
                "mute",
                "Mute a player",
                args =>
                {
                    if (args.Length < 1)
                    {
                        SendSystemMessage("Usage: /mute <player>");
                        return;
                    }
                    MutePlayer(args[0]);
                    SendSystemMessage($"Player {args[0]} has been muted.");
                });

            // Unmute command: /unmute <player>
            _commandHandler.RegisterCommand(
                "unmute",
                "Unmute a player",
                args =>
                {
                    if (args.Length < 1)
                    {
                        SendSystemMessage("Usage: /unmute <player>");
                        return;
                    }
                    UnmutePlayer(args[0]);
                    SendSystemMessage($"Player {args[0]} has been unmuted.");
                });

            // Block command: /block <player>
            _commandHandler.RegisterCommand(
                "block",
                "Block a player",
                args =>
                {
                    if (args.Length < 1)
                    {
                        SendSystemMessage("Usage: /block <player>");
                        return;
                    }
                    BlockPlayer(args[0]);
                    SendSystemMessage($"Player {args[0]} has been blocked.");
                });

            // Unblock command: /unblock <player>
            _commandHandler.RegisterCommand(
                "unblock",
                "Unblock a player",
                args =>
                {
                    if (args.Length < 1)
                    {
                        SendSystemMessage("Usage: /unblock <player>");
                        return;
                    }
                    UnblockPlayer(args[0]);
                    SendSystemMessage($"Player {args[0]} has been unblocked.");
                });

            // Clear command: /clear
            _commandHandler.RegisterCommand(
                "clear",
                "Clear the current chat channel",
                args =>
                {
                    ClearHistory(_currentChannel);
                    SendSystemMessage("Chat cleared.");
                });

            // Emote command: /emote <id>
            _commandHandler.RegisterCommand(
                "emote",
                "Play an emote animation",
                args =>
                {
                    if (args.Length < 1)
                    {
                        SendSystemMessage("Usage: /emote <emote_id>");
                        return;
                    }
                    string emoteId = args[0];
                    // In a real game, trigger the emote animation
                    SendMessage($"*performs {emoteId}*", ChatChannel.Proximity);
                });

            // Help command: /help
            _commandHandler.RegisterCommand(
                "help",
                "Show available chat commands",
                args =>
                {
                    var commands = _commandHandler.GetAvailableCommands();
                    SendSystemMessage("=== Available Commands ===");
                    foreach (var cmd in commands)
                    {
                        SendSystemMessage($"/{cmd.Command} - {cmd.Description}");
                    }
                });

            // Party command: /party <subcommand>
            _commandHandler.RegisterCommand(
                "party",
                "Party management commands",
                args =>
                {
                    if (args.Length < 1)
                    {
                        SendSystemMessage("Usage: /party <invite|accept|leave|kick|list>");
                        return;
                    }
                    string subCommand = args[0].ToLower();
                    switch (subCommand)
                    {
                        case "invite":
                            if (args.Length < 2)
                            {
                                SendSystemMessage("Usage: /party invite <player>");
                                return;
                            }
                            SendSystemMessage($"Party invite sent to {args[1]}.");
                            break;
                        case "accept":
                            SendSystemMessage("Party invite accepted.");
                            break;
                        case "leave":
                            SendSystemMessage("You left the party.");
                            break;
                        case "kick":
                            if (args.Length < 2)
                            {
                                SendSystemMessage("Usage: /party kick <player>");
                                return;
                            }
                            SendSystemMessage($"{args[1]} has been kicked from the party.");
                            break;
                        case "list":
                            SendSystemMessage("Party members: (list would appear here)");
                            break;
                        default:
                            SendSystemMessage($"Unknown party command: {subCommand}");
                            break;
                    }
                });

            // Report command: /report <player> <reason>
            _commandHandler.RegisterCommand(
                "report",
                "Report a player for inappropriate behavior",
                args =>
                {
                    if (args.Length < 2)
                    {
                        SendSystemMessage("Usage: /report <player> <reason>");
                        return;
                    }
                    string targetPlayer = args[0];
                    string reason = string.Join(" ", args, 1, args.Length - 1);
                    SendSystemMessage($"Report submitted for {targetPlayer}. Thank you!");
                });
        }
        #endregion
    }

    #region Enums and Data Classes
    /// <summary>
    /// Enumeration of available chat channels.
    /// </summary>
    public enum ChatChannel
    {
        /// <summary>Global world chat visible to all players.</summary>
        World,
        /// <summary>Chat only visible to players within proximity range.</summary>
        Proximity,
        /// <summary>Chat for players on the same island/instance.</summary>
        Island,
        /// <summary>Private chat for party members.</summary>
        Party,
        /// <summary>System-generated messages and announcements.</summary>
        System,
        /// <summary>Private one-to-one messages between players.</summary>
        Whisper
    }

    /// <summary>
    /// Reasons for reporting a message or player.
    /// </summary>
    public enum ReportReason
    {
        /// <summary>Unwanted repetitive messages.</summary>
        Spam,
        /// <summary>Harassing or bullying behavior.</summary>
        Harassment,
        /// <summary>Inappropriate content or language.</summary>
        Inappropriate,
        /// <summary>Cheating or exploiting.</summary>
        Cheating,
        /// <summary>Other reasons not covered above.</summary>
        Other
    }

    /// <summary>
    /// Serializable configuration data for a chat channel.
    /// </summary>
    [System.Serializable]
    public class ChatChannelInfo
    {
        /// <summary>The channel enum value.</summary>
        public ChatChannel Channel;

        /// <summary>Human-readable display name for the channel.</summary>
        public string DisplayName;

        /// <summary>Color associated with this channel in the UI.</summary>
        public Color ChannelColor;

        /// <summary>Optional icon sprite for the channel.</summary>
        public Sprite ChannelIcon;

        /// <summary>Whether this channel requires players to be in proximity.</summary>
        public bool RequiresProximity;

        /// <summary>Proximity range in Unity units if RequiresProximity is true.</summary>
        public float ProximityRange;

        /// <summary>Whether messages in this channel are moderated.</summary>
        public bool IsModerated;
    }
    #endregion
}
