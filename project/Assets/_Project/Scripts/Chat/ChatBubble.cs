using System;
using System.Collections;
using System.Text.RegularExpressions;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace KawaiiCoolIsland.Chat
{
    /// <summary>
    /// World-space chat bubble that appears above player characters.
    /// Displays text messages, emotes, stickers, and typing indicators.
    /// Follows the target player in world space using WorldToScreenPoint conversion.
    /// </summary>
    [RequireComponent(typeof(CanvasGroup))]
    public class ChatBubble : MonoBehaviour
    {
        #region Header: References
        [Header("References")]
        [Tooltip("CanvasGroup for fade in/out control.")]
        public CanvasGroup CanvasGroup;

        [Tooltip("TMP_Text component for the message content.")]
        public TMP_Text MessageText;

        [Tooltip("Image component for the bubble background.")]
        public Image BubbleBackground;

        [Tooltip("Image component for the bubble tail (pointer to player).")]
        public Image TailImage;

        [Tooltip("RectTransform of the bubble for size adjustments.")]
        public RectTransform BubbleRect;
        #endregion

        #region Header: Settings
        [Header("Settings")]
        [Tooltip("How long the bubble remains fully visible before fading out.")]
        public float DisplayDuration = 4f;

        [Tooltip("Duration of the fade-in animation in seconds.")]
        public float FadeInDuration = 0.2f;

        [Tooltip("Duration of the fade-out animation in seconds.")]
        public float FadeOutDuration = 0.5f;

        [Tooltip("Maximum width of the bubble in pixels before text wrapping.")]
        public float MaxWidth = 300f;

        [Tooltip("Vertical bob amount for typing indicator animation.")]
        public float TypingBobAmount = 5f;

        [Tooltip("Speed of the typing indicator bob animation.")]
        public float TypingBobSpeed = 3f;

        [Tooltip("Minimum bubble width in pixels.")]
        public float MinWidth = 80f;

        [Tooltip("Padding around the text inside the bubble.")]
        public Vector2 TextPadding = new(16f, 10f);
        #endregion

        #region Header: Colors
        [Header("Colors")]
        [Tooltip("Default bubble background color for normal messages.")]
        public Color NormalBubbleColor = Color.white;

        [Tooltip("Bubble background color for whisper messages.")]
        public Color WhisperBubbleColor = new Color(1, 0.8f, 1);

        [Tooltip("Bubble background color for system messages.")]
        public Color SystemBubbleColor = new Color(1, 0.9f, 0.7f);

        [Tooltip("Bubble background color for party messages.")]
        public Color PartyBubbleColor = new Color(0.85f, 0.7f, 1f);

        [Tooltip("Bubble background color for emote messages.")]
        public Color EmoteBubbleColor = new Color(0.8f, 1f, 0.9f);

        [Tooltip("Text color for normal messages.")]
        public Color NormalTextColor = Color.black;

        [Tooltip("Text color for system messages.")]
        public Color SystemTextColor = new Color(0.6f, 0.4f, 0f);
        #endregion

        #region Private Fields
        private Vector3 _worldOffset = new(0, 1.8f, 0);
        private Transform _targetTransform;
        private Camera _mainCamera;
        private Coroutine _displayCoroutine;
        private Coroutine _typingBobCoroutine;
        private bool _isShowingTyping;
        private Vector3 _baseLocalPosition;
        private ChatChannel _currentChannel = ChatChannel.Proximity;
        private MessageType _currentMessageType = MessageType.Text;
        #endregion

        #region Public Properties
        /// <summary>
        /// Whether the bubble is currently visible.
        /// </summary>
        public bool IsVisible => CanvasGroup != null && CanvasGroup.alpha > 0.01f;

        /// <summary>
        /// Whether the bubble is currently showing a typing indicator.
        /// </summary>
        public bool IsShowingTyping => _isShowingTyping;

        /// <summary>
        /// The world-space offset from the target transform.
        /// </summary>
        public Vector3 WorldOffset => _worldOffset;
        #endregion

        #region Unity Lifecycle
        private void Awake()
        {
            // Auto-get references if not set
            if (CanvasGroup == null)
                CanvasGroup = GetComponent<CanvasGroup>();
            if (BubbleRect == null)
                BubbleRect = GetComponent<RectTransform>();
        }

        private void Start()
        {
            _mainCamera = Camera.main;
            CanvasGroup.alpha = 0f;
            _baseLocalPosition = transform.localPosition;
        }

        private void LateUpdate()
        {
            UpdatePosition();
        }
        #endregion

        #region Public Methods - Display
        /// <summary>
        /// Shows a text message in the chat bubble.
        /// </summary>
        /// <param name="message">The message text to display.</param>
        /// <param name="type">The type of message (affects styling).</param>
        /// <param name="channel">The channel this message came from (affects color).</param>
        public void ShowMessage(string message, MessageType type = MessageType.Text, ChatChannel channel = ChatChannel.Proximity)
        {
            if (string.IsNullOrWhiteSpace(message)) return;

            StopAllCoroutines();
            _isShowingTyping = false;
            _currentChannel = channel;
            _currentMessageType = type;

            // Enable text, disable other displays
            if (MessageText != null)
            {
                MessageText.gameObject.SetActive(true);
                MessageText.text = StripRichTextTags(message);
                MessageText.color = type == MessageType.System ? SystemTextColor : NormalTextColor;
            }

            SetBubbleColor(type, channel);
            AdjustBubbleSize();

            _displayCoroutine = StartCoroutine(DisplayCoroutine(message, DisplayDuration));
        }

        /// <summary>
        /// Shows an emote as an animated bubble with the emote sprite.
        /// </summary>
        /// <param name="emoteSprite">The emote sprite to display.</param>
        /// <param name="emoteName">Optional name of the emote for accessibility.</param>
        public void ShowEmote(Sprite emoteSprite, string emoteName = "")
        {
            if (emoteSprite == null) return;

            StopAllCoroutines();
            _isShowingTyping = false;
            _currentMessageType = MessageType.Emote;

            SetBubbleColor(MessageType.Emote, ChatChannel.Proximity);

            // Use text to show emote name, or display sprite if image component available
            if (MessageText != null)
            {
                MessageText.gameObject.SetActive(true);
                MessageText.text = string.IsNullOrEmpty(emoteName) ? "*emote*" : $"*{emoteName}*";
                MessageText.color = NormalTextColor;
            }

            AdjustBubbleSize();
            _displayCoroutine = StartCoroutine(DisplayCoroutine("", DisplayDuration));
        }

        /// <summary>
        /// Shows a sticker in the chat bubble.
        /// </summary>
        /// <param name="stickerSprite">The sticker sprite to display.</param>
        public void ShowSticker(Sprite stickerSprite)
        {
            if (stickerSprite == null) return;

            StopAllCoroutines();
            _isShowingTyping = false;
            _currentMessageType = MessageType.Sticker;

            if (MessageText != null)
            {
                MessageText.gameObject.SetActive(true);
                MessageText.text = "[Sticker]";
                MessageText.color = NormalTextColor;
            }

            SetBubbleColor(MessageType.Text, ChatChannel.Proximity);
            AdjustBubbleSize();
            _displayCoroutine = StartCoroutine(DisplayCoroutine("", DisplayDuration));
        }

        /// <summary>
        /// Shows the typing indicator (animated dots) above the player.
        /// </summary>
        public void ShowTypingIndicator()
        {
            if (_isShowingTyping) return;

            StopAllCoroutines();
            _isShowingTyping = true;

            if (MessageText != null)
            {
                MessageText.gameObject.SetActive(true);
                MessageText.text = "...";
                MessageText.color = NormalTextColor;
            }

            SetBubbleColor(MessageType.Text, ChatChannel.Proximity);
            AdjustBubbleSize();

            // Fade in
            CanvasGroup.alpha = 1f;

            // Start bob animation
            if (_typingBobCoroutine != null)
                StopCoroutine(_typingBobCoroutine);
            _typingBobCoroutine = StartCoroutine(TypingBobCoroutine());
        }

        /// <summary>
        /// Hides the typing indicator.
        /// </summary>
        public void HideTypingIndicator()
        {
            if (!_isShowingTyping) return;

            _isShowingTyping = false;
            if (_typingBobCoroutine != null)
            {
                StopCoroutine(_typingBobCoroutine);
                _typingBobCoroutine = null;
            }

            HideBubble();
        }

        /// <summary>
        /// Immediately hides the chat bubble with a fade-out animation.
        /// </summary>
        public void HideBubble()
        {
            if (_displayCoroutine != null)
            {
                StopCoroutine(_displayCoroutine);
                _displayCoroutine = null;
            }

            _isShowingTyping = false;
            StartCoroutine(FadeOutCoroutine());
        }

        /// <summary>
        /// Immediately hides the bubble without animation.
        /// </summary>
        public void HideImmediate()
        {
            if (_displayCoroutine != null)
            {
                StopCoroutine(_displayCoroutine);
                _displayCoroutine = null;
            }

            _isShowingTyping = false;
            CanvasGroup.alpha = 0f;
        }

        /// <summary>
        /// Sets the world-space target transform that the bubble will follow.
        /// </summary>
        /// <param name="target">The target transform (typically the player).</param>
        public void SetTarget(Transform target)
        {
            _targetTransform = target;
            _mainCamera = Camera.main;
        }

        /// <summary>
        /// Sets the world-space offset from the target position.
        /// </summary>
        /// <param name="offset">The offset vector (default is above the player's head).</param>
        public void SetWorldOffset(Vector3 offset)
        {
            _worldOffset = offset;
        }

        /// <summary>
        /// Updates the main camera reference (call after camera changes).
        /// </summary>
        public void RefreshCamera()
        {
            _mainCamera = Camera.main;
        }
        #endregion

        #region Private Methods
        /// <summary>
        /// Updates the bubble position to follow the target in world space.
        /// Uses WorldToScreenPoint for accurate world-space UI positioning.
        /// </summary>
        private void UpdatePosition()
        {
            if (_targetTransform == null || _mainCamera == null)
            {
                // If no target, hide the bubble
                if (CanvasGroup != null && CanvasGroup.alpha > 0)
                {
                    CanvasGroup.alpha = 0f;
                }
                return;
            }

            // Calculate world position with offset
            Vector3 worldPosition = _targetTransform.position + _worldOffset;

            // Convert to screen space
            Vector3 screenPosition = _mainCamera.WorldToScreenPoint(worldPosition);

            // Check if the target is behind the camera
            if (screenPosition.z < 0)
            {
                CanvasGroup.alpha = 0f;
                return;
            }

            // Check if the target is visible on screen (with some margin)
            bool isOnScreen = screenPosition.x >= -100 && screenPosition.x <= Screen.width + 100 &&
                              screenPosition.y >= -50 && screenPosition.y <= Screen.height + 50;

            // Only show if the bubble is supposed to be visible AND target is on screen
            if (!isOnScreen && CanvasGroup.alpha > 0)
            {
                CanvasGroup.alpha = 0f;
            }
            else if (isOnScreen && CanvasGroup.alpha == 0 && (_displayCoroutine != null || _isShowingTyping))
            {
                // Will be handled by the coroutines
            }

            // Position the bubble
            if (transform.parent is RectTransform parentRect)
            {
                // We're in a Canvas, convert screen point to canvas local point
                Vector2 canvasPos;
                RectTransformUtility.ScreenPointToLocalPointInRectangle(
                    parentRect, screenPosition, null, out canvasPos);
                transform.localPosition = canvasPos;
            }
            else
            {
                // Direct screen-space positioning
                transform.position = screenPosition;
            }

            // Scale based on distance for depth perception
            float distance = Vector3.Distance(_mainCamera.transform.position, _targetTransform.position);
            float scale = Mathf.Clamp(10f / distance, 0.5f, 1.5f);
            transform.localScale = Vector3.one * scale;
        }

        /// <summary>
        /// Coroutine that handles the full display lifecycle: fade in, hold, fade out.
        /// </summary>
        private IEnumerator DisplayCoroutine(string message, float duration)
        {
            // Fade in
            yield return StartCoroutine(FadeInCoroutine());

            // Hold
            yield return new WaitForSeconds(duration);

            // Fade out
            yield return StartCoroutine(FadeOutCoroutine());
        }

        /// <summary>
        /// Coroutine for the fade-in animation.
        /// </summary>
        private IEnumerator FadeInCoroutine()
        {
            float elapsed = 0f;
            while (elapsed < FadeInDuration)
            {
                elapsed += Time.deltaTime;
                CanvasGroup.alpha = Mathf.Clamp01(elapsed / FadeInDuration);
                yield return null;
            }
            CanvasGroup.alpha = 1f;
        }

        /// <summary>
        /// Coroutine for the fade-out animation.
        /// </summary>
        private IEnumerator FadeOutCoroutine()
        {
            float elapsed = 0f;
            float startAlpha = CanvasGroup.alpha;

            while (elapsed < FadeOutDuration)
            {
                elapsed += Time.deltaTime;
                CanvasGroup.alpha = Mathf.Lerp(startAlpha, 0f, elapsed / FadeOutDuration);
                yield return null;
            }
            CanvasGroup.alpha = 0f;
        }

        /// <summary>
        /// Coroutine for the typing indicator bob animation.
        /// </summary>
        private IEnumerator TypingBobCoroutine()
        {
            float time = 0f;
            _baseLocalPosition = transform.localPosition;

            while (_isShowingTyping)
            {
                time += Time.deltaTime * TypingBobSpeed;
                float bobOffset = Mathf.Sin(time) * TypingBobAmount;
                transform.localPosition = _baseLocalPosition + new Vector3(0, bobOffset, 0);
                yield return null;
            }

            // Reset position
            transform.localPosition = _baseLocalPosition;
        }

        /// <summary>
        /// Sets the bubble background color based on message type and channel.
        /// </summary>
        private void SetBubbleColor(MessageType type, ChatChannel channel)
        {
            if (BubbleBackground == null) return;

            Color targetColor = NormalBubbleColor;

            switch (type)
            {
                case MessageType.System:
                    targetColor = SystemBubbleColor;
                    break;
                case MessageType.Emote:
                    targetColor = EmoteBubbleColor;
                    break;
                case MessageType.Text:
                case MessageType.Sticker:
                default:
                    switch (channel)
                    {
                        case ChatChannel.Whisper:
                            targetColor = WhisperBubbleColor;
                            break;
                        case ChatChannel.Party:
                            targetColor = PartyBubbleColor;
                            break;
                        case ChatChannel.System:
                            targetColor = SystemBubbleColor;
                            break;
                        default:
                            targetColor = NormalBubbleColor;
                            break;
                    }
                    break;
            }

            BubbleBackground.color = targetColor;
        }

        /// <summary>
        /// Adjusts the bubble size to fit the message text.
        /// Respects MaxWidth and adds appropriate padding.
        /// </summary>
        private void AdjustBubbleSize()
        {
            if (MessageText == null || BubbleRect == null) return;

            // Force TMP to recalculate
            MessageText.ForceMeshUpdate();

            Vector2 textSize = MessageText.GetRenderedValues(false);
            float preferredWidth = Mathf.Clamp(textSize.x + TextPadding.x * 2, MinWidth, MaxWidth);
            float preferredHeight = textSize.y + TextPadding.y * 2;

            // If text is wider than max, enable wrapping and recalculate
            if (textSize.x + TextPadding.x * 2 > MaxWidth)
            {
                MessageText.enableWordWrapping = true;
                MessageText.rectTransform.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal, MaxWidth - TextPadding.x * 2);
                MessageText.ForceMeshUpdate();

                textSize = MessageText.GetRenderedValues(false);
                preferredWidth = MaxWidth;
                preferredHeight = textSize.y + TextPadding.y * 2;
            }
            else
            {
                MessageText.enableWordWrapping = false;
            }

            BubbleRect.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal, preferredWidth);
            BubbleRect.SetSizeWithCurrentAnchors(RectTransform.Axis.Vertical, preferredHeight);
        }

        /// <summary>
        /// Strips Unity rich text tags for bubble display.
        /// </summary>
        private static string StripRichTextTags(string input)
        {
            if (string.IsNullOrEmpty(input)) return input;
            return Regex.Replace(input, "<[^>]+>", string.Empty);
        }
        #endregion
    }
}
