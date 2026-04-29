using System;
using System.Collections.Generic;
using System.Linq;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace KawaiiCoolIsland.Chat
{
    /// <summary>
    /// Manages emote reactions displayed on chat messages.
    /// Shows existing reactions as clickable buttons and provides a picker UI for adding new reactions.
    /// Supports toggling reactions (click to add, click again to remove).
    /// </summary>
    public class EmoteReactionUI : MonoBehaviour, IPointerClickHandler
    {
        #region Header: References
        [Header("References")]
        [Tooltip("Container transform where reaction buttons are instantiated.")]
        public Transform ReactionsContainer;

        [Tooltip("Prefab for individual reaction buttons (should have Image and TMP_Text for count).")]
        public GameObject ReactionButtonPrefab;

        [Tooltip("Prefab for the reaction picker popup panel.")]
        public GameObject ReactionPickerPrefab;
        #endregion

        #region Header: Settings
        [Header("Settings")]
        [Tooltip("Maximum number of unique reaction types allowed per message.")]
        public int MaxReactionsPerMessage = 10;

        [Tooltip("Scale multiplier when hovering over a reaction button.")]
        public float ReactionScaleMultiplier = 1.2f;

        [Tooltip("Duration of reaction button spawn animation in seconds.")]
        public float SpawnAnimationDuration = 0.2f;

        [Tooltip("Animation curve for reaction button spawn scale.")]
        public AnimationCurve SpawnScaleCurve = AnimationCurve.EaseInOut(0f, 0f, 1f, 1f);

        [Tooltip("List of available emote IDs that can be used as reactions.")]
        public List<string> AvailableEmoteIds = new()
        {
            "heart", "thumbs_up", "laugh", "surprised", "sad", "fire", "star", "clap"
        };
        #endregion

        #region Private Fields
        private string _messageId;
        private ChatMessage _message;
        private readonly Dictionary<string, GameObject> _reactionButtons = new();
        private GameObject _reactionPickerInstance;
        private bool _isPickerVisible;
        private string _localPlayerId;
        #endregion

        #region Public Properties
        /// <summary>
        /// The message ID this reaction UI is associated with.
        /// </summary>
        public string MessageId => _messageId;

        /// <summary>
        /// The ChatMessage object being reacted to.
        /// </summary>
        public ChatMessage Message => _message;

        /// <summary>
        /// Number of unique reaction types currently on this message.
        /// </summary>
        public int ReactionCount => _reactionButtons.Count;

        /// <summary>
        /// Whether the reaction picker is currently visible.
        /// </summary>
        public bool IsPickerVisible => _isPickerVisible;
        #endregion

        #region Public Events
        /// <summary>
        /// Fired when a reaction button is clicked. Parameters: messageId, emoteId.
        /// Consumers should call ChatManager.SendEmoteReaction to process the reaction.
        /// </summary>
        public event Action<string, string> OnReactionClicked;

        /// <summary>
        /// Fired when the reaction picker is opened.
        /// </summary>
        public event Action OnPickerOpened;

        /// <summary>
        /// Fired when the reaction picker is closed.
        /// </summary>
        public event Action OnPickerClosed;
        #endregion

        #region Unity Lifecycle
        private void Awake()
        {
            // Try to get local player ID from ChatManager
            if (ChatManager.Instance != null)
            {
                _localPlayerId = ChatManager.Instance.LocalPlayerId;
            }
            else
            {
                _localPlayerId = "local_player";
            }

            // Hide picker initially
            if (ReactionPickerPrefab != null)
            {
                ReactionPickerPrefab.SetActive(false);
            }
        }

        private void OnDestroy()
        {
            HideReactionPicker();
        }
        #endregion

        #region Public Methods
        /// <summary>
        /// Initializes the reaction UI with a chat message.
        /// </summary>
        /// <param name="message">The chat message to attach reactions to.</param>
        public void Initialize(ChatMessage message)
        {
            if (message == null)
            {
                Debug.LogWarning("[EmoteReactionUI] Cannot initialize with null message.");
                return;
            }

            _message = message;
            _messageId = message.MessageId;

            // Clear existing buttons
            ClearReactions();

            // Sync with existing reactions from the message
            if (message.Reactions != null)
            {
                foreach (var reaction in message.Reactions)
                {
                    CreateReactionButton(reaction.EmoteId, reaction.Count,
                        reaction.HasReacted(_localPlayerId));
                }
            }
        }

        /// <summary>
        /// Adds or toggles a reaction on the message.
        /// </summary>
        /// <param name="emoteId">The emote ID to react with.</param>
        /// <param name="emoteSprite">Optional sprite to display for the reaction.</param>
        public void AddReaction(string emoteId, Sprite emoteSprite = null)
        {
            if (_message == null) return;
            if (string.IsNullOrEmpty(emoteId)) return;
            if (_reactionButtons.Count >= MaxReactionsPerMessage && !_reactionButtons.ContainsKey(emoteId))
            {
                Debug.LogWarning("[EmoteReactionUI] Maximum reactions reached for this message.");
                return;
            }

            // Toggle behavior: if already reacted, remove
            if (_message.HasPlayerReacted(emoteId, _localPlayerId))
            {
                RemoveReaction(emoteId);
                return;
            }

            // Add to message data model
            _message.AddReaction(emoteId, _localPlayerId);

            // Update or create UI button
            if (_reactionButtons.TryGetValue(emoteId, out GameObject existingButton))
            {
                UpdateReactionButton(existingButton, emoteId, _message.GetReactionCount(emoteId), true);
            }
            else
            {
                CreateReactionButton(emoteId, 1, true, emoteSprite);
            }

            OnReactionClicked?.Invoke(_messageId, emoteId);

            // Animate the new/existing reaction
            PlaySpawnAnimation(emoteId);
        }

        /// <summary>
        /// Removes a reaction from the message.
        /// </summary>
        /// <param name="emoteId">The emote ID to remove.</param>
        public void RemoveReaction(string emoteId)
        {
            if (_message == null) return;
            if (string.IsNullOrEmpty(emoteId)) return;

            // Remove from message data model
            _message.RemoveReaction(emoteId, _localPlayerId);

            // Update or remove UI button
            int remainingCount = _message.GetReactionCount(emoteId);
            if (remainingCount > 0)
            {
                if (_reactionButtons.TryGetValue(emoteId, out GameObject button))
                {
                    UpdateReactionButton(button, emoteId, remainingCount, false);
                }
            }
            else
            {
                DestroyReactionButton(emoteId);
            }

            OnReactionClicked?.Invoke(_messageId, emoteId);
        }

        /// <summary>
        /// Shows the reaction picker popup at the specified screen position.
        /// </summary>
        /// <param name="position">Screen position for the picker.</param>
        public void ShowReactionPicker(Vector2 position)
        {
            if (ReactionPickerPrefab == null) return;

            // Create picker if not exists
            if (_reactionPickerInstance == null)
            {
                _reactionPickerInstance = Instantiate(ReactionPickerPrefab, transform);
            }

            _reactionPickerInstance.SetActive(true);
            _isPickerVisible = true;

            // Position the picker
            RectTransform pickerRect = _reactionPickerInstance.GetComponent<RectTransform>();
            if (pickerRect != null)
            {
                pickerRect.anchoredPosition = position;
            }

            // Setup picker buttons
            SetupPickerButtons();

            OnPickerOpened?.Invoke();
        }

        /// <summary>
        /// Hides the reaction picker popup.
        /// </summary>
        public void HideReactionPicker()
        {
            if (_reactionPickerInstance != null)
            {
                _reactionPickerInstance.SetActive(false);
            }
            _isPickerVisible = false;
            OnPickerClosed?.Invoke();
        }

        /// <summary>
        /// Toggles the reaction picker visibility.
        /// </summary>
        /// <param name="position">Screen position for the picker if opening.</param>
        public void ToggleReactionPicker(Vector2 position)
        {
            if (_isPickerVisible)
            {
                HideReactionPicker();
            }
            else
            {
                ShowReactionPicker(position);
            }
        }

        /// <summary>
        /// Refreshes all reaction buttons to match the current message state.
        /// Call this after receiving reaction updates from the network.
        /// </summary>
        public void RefreshReactions()
        {
            if (_message?.Reactions == null) return;

            // Remove buttons for reactions that no longer exist
            var toRemove = _reactionButtons.Keys
                .Where(emoteId => _message.Reactions.All(r => r.EmoteId != emoteId))
                .ToList();

            foreach (var emoteId in toRemove)
            {
                DestroyReactionButton(emoteId);
            }

            // Update or create buttons for current reactions
            foreach (var reaction in _message.Reactions)
            {
                bool hasReacted = reaction.HasReacted(_localPlayerId);

                if (_reactionButtons.TryGetValue(reaction.EmoteId, out GameObject button))
                {
                    UpdateReactionButton(button, reaction.EmoteId, reaction.Count, hasReacted);
                }
                else
                {
                    CreateReactionButton(reaction.EmoteId, reaction.Count, hasReacted);
                }
            }
        }

        /// <summary>
        /// Clears all reaction buttons from the UI.
        /// </summary>
        public void ClearReactions()
        {
            foreach (var button in _reactionButtons.Values)
            {
                if (button != null)
                {
                    Destroy(button);
                }
            }
            _reactionButtons.Clear();
        }

        /// <summary>
        /// Handles pointer clicks on the message to show the reaction picker.
        /// </summary>
        public void OnPointerClick(PointerEventData eventData)
        {
            // Right-click or long-press could show picker
            if (eventData.button == PointerEventData.InputButton.Right)
            {
                Vector2 localPos;
                RectTransformUtility.ScreenPointToLocalPointInRectangle(
                    GetComponent<RectTransform>(), eventData.position, eventData.pressEventCamera, out localPos);
                ToggleReactionPicker(localPos);
            }
        }
        #endregion

        #region Private Methods
        /// <summary>
        /// Creates a new reaction button for the given emote.
        /// </summary>
        private void CreateReactionButton(string emoteId, int count, bool hasReacted, Sprite emoteSprite = null)
        {
            if (ReactionButtonPrefab == null || ReactionsContainer == null) return;
            if (_reactionButtons.ContainsKey(emoteId)) return;

            GameObject buttonObj = Instantiate(ReactionButtonPrefab, ReactionsContainer);
            buttonObj.name = $"Reaction_{emoteId}";

            // Setup button visuals
            SetupReactionButtonVisuals(buttonObj, emoteId, count, hasReacted, emoteSprite);

            // Add click handler
            Button button = buttonObj.GetComponent<Button>();
            if (button != null)
            {
                string capturedEmoteId = emoteId; // Capture for closure
                button.onClick.AddListener(() => OnReactionButtonClicked(capturedEmoteId));
            }

            _reactionButtons[emoteId] = buttonObj;

            // Spawn animation
            StartCoroutine(AnimateButtonSpawn(buttonObj));
        }

        /// <summary>
        /// Sets up the visual elements of a reaction button.
        /// </summary>
        private void SetupReactionButtonVisuals(GameObject buttonObj, string emoteId, int count,
            bool hasReacted, Sprite emoteSprite = null)
        {
            // Find image component for emote sprite
            Image image = buttonObj.GetComponentInChildren<Image>();
            if (image != null && emoteSprite != null)
            {
                image.sprite = emoteSprite;
            }

            // Find text component for count
            TMP_Text countText = buttonObj.GetComponentInChildren<TMP_Text>();
            if (countText != null)
            {
                countText.text = count > 1 ? count.ToString() : "";
            }

            // Set background color based on whether local player reacted
            Image bgImage = buttonObj.GetComponent<Image>();
            if (bgImage != null)
            {
                bgImage.color = hasReacted
                    ? new Color(0.4f, 0.7f, 1f, 0.9f)    // Highlighted if reacted
                    : new Color(0.9f, 0.9f, 0.9f, 0.7f); // Normal
            }

            // Set emote label
            TMP_Text labelText = buttonObj.transform.Find("EmoteLabel")?.GetComponent<TMP_Text>();
            if (labelText != null)
            {
                labelText.text = $":{emoteId}:";
            }
        }

        /// <summary>
        /// Updates an existing reaction button with new count and highlight state.
        /// </summary>
        private void UpdateReactionButton(GameObject buttonObj, string emoteId, int count, bool hasReacted)
        {
            if (buttonObj == null) return;

            TMP_Text countText = buttonObj.GetComponentInChildren<TMP_Text>();
            if (countText != null)
            {
                countText.text = count > 1 ? count.ToString() : "";
            }

            Image bgImage = buttonObj.GetComponent<Image>();
            if (bgImage != null)
            {
                bgImage.color = hasReacted
                    ? new Color(0.4f, 0.7f, 1f, 0.9f)
                    : new Color(0.9f, 0.9f, 0.9f, 0.7f);
            }
        }

        /// <summary>
        /// Destroys a reaction button by emote ID.
        /// </summary>
        private void DestroyReactionButton(string emoteId)
        {
            if (_reactionButtons.TryGetValue(emoteId, out GameObject button))
            {
                if (button != null)
                {
                    Destroy(button);
                }
                _reactionButtons.Remove(emoteId);
            }
        }

        /// <summary>
        /// Handles clicks on reaction buttons (toggle behavior).
        /// </summary>
        private void OnReactionButtonClicked(string emoteId)
        {
            if (_message == null) return;

            if (_message.HasPlayerReacted(emoteId, _localPlayerId))
            {
                RemoveReaction(emoteId);
            }
            else
            {
                AddReaction(emoteId);
            }
        }

        /// <summary>
        /// Sets up the reaction picker buttons for all available emotes.
        /// </summary>
        private void SetupPickerButtons()
        {
            if (_reactionPickerInstance == null) return;

            // Find or create container for emote buttons
            Transform pickerContainer = _reactionPickerInstance.transform.Find("EmoteGrid");
            if (pickerContainer == null)
            {
                pickerContainer = _reactionPickerInstance.transform;
            }

            // Clear existing children (if dynamic)
            foreach (Transform child in pickerContainer)
            {
                Destroy(child.gameObject);
            }

            // Create button for each available emote
            foreach (string emoteId in AvailableEmoteIds)
            {
                GameObject emoteBtn = new GameObject($"EmoteBtn_{emoteId}");
                emoteBtn.transform.SetParent(pickerContainer, false);

                // Add image
                Image img = emoteBtn.AddComponent<Image>();
                img.color = new Color(0.95f, 0.95f, 0.95f);

                // Add button component
                Button btn = emoteBtn.AddComponent<Button>();
                ColorBlock colors = btn.colors;
                colors.highlightedColor = new Color(0.7f, 0.9f, 1f);
                btn.colors = colors;

                // Add emote label
                GameObject labelObj = new GameObject("Label");
                labelObj.transform.SetParent(emoteBtn.transform, false);
                TMP_Text label = labelObj.AddComponent<TMP_Text>();
                label.text = $":{emoteId}:";
                label.alignment = TextAlignmentOptions.Center;
                label.fontSize = 14;

                // Add layout element
                LayoutElement layout = emoteBtn.AddComponent<LayoutElement>();
                layout.minWidth = 50;
                layout.minHeight = 50;

                // Capture emote ID for closure
                string capturedEmoteId = emoteId;
                btn.onClick.AddListener(() =>
                {
                    AddReaction(capturedEmoteId);
                    HideReactionPicker();
                });
            }
        }

        /// <summary>
        /// Plays a spawn animation on a reaction button.
        /// </summary>
        private void PlaySpawnAnimation(string emoteId)
        {
            if (_reactionButtons.TryGetValue(emoteId, out GameObject button))
            {
                StartCoroutine(AnimateButtonSpawn(button));
            }
        }

        /// <summary>
        /// Coroutine for the reaction button spawn animation (scale pop).
        /// </summary>
        private System.Collections.IEnumerator AnimateButtonSpawn(GameObject button)
        {
            if (button == null) yield break;

            float elapsed = 0f;
            while (elapsed < SpawnAnimationDuration)
            {
                elapsed += Time.deltaTime;
                float t = SpawnScaleCurve.Evaluate(elapsed / SpawnAnimationDuration);
                float scale = Mathf.Lerp(0.5f, 1f, t);
                button.transform.localScale = Vector3.one * scale;
                yield return null;
            }

            if (button != null)
            {
                button.transform.localScale = Vector3.one;
            }
        }
        #endregion
    }
}
