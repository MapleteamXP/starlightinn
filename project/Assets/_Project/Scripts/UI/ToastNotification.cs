using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace KawaiiCoolIsland.UI
{
    /// <summary>
    /// Data container for a queued toast notification.
    /// </summary>
    [System.Serializable]
    public class ToastData
    {
        /// <summary>The message text to display.</summary>
        public string Message;

        /// <summary>The visual type of the toast.</summary>
        public ToastType Type;

        /// <summary>How long the toast remains visible in seconds.</summary>
        public float Duration;

        /// <summary>Optional sprite icon for the toast.</summary>
        public Sprite Icon;

        /// <summary>
        /// Creates a new ToastData instance.
        /// </summary>
        /// <param name="message">Toast message text.</param>
        /// <param name="type">Toast notification type.</param>
        /// <param name="duration">Display duration.</param>
        public ToastData(string message, ToastType type, float duration)
        {
            Message = message;
            Type = type;
            Duration = duration;
        }
    }

    /// <summary>
    /// Manages toast notification display with queuing, stacking, and automatic dismissal.
    /// Toasts slide in from the edge, display for a duration, then fade out.
    /// </summary>
    public class ToastNotification : MonoBehaviour
    {
        #region Inspector - Prefabs & References
        [Header("Prefabs & References")]
        [Tooltip("Prefab for the toast notification UI element. Should have CanvasGroup, Image (background), and TextMeshProUGUI.")]
        public GameObject ToastPrefab;

        [Tooltip("Container transform where toasts will be instantiated.")]
        public Transform ToastContainer;

        [Tooltip("Background image for info toasts.")]
        public Sprite InfoBackground;

        [Tooltip("Background image for success toasts.")]
        public Sprite SuccessBackground;

        [Tooltip("Background image for warning toasts.")]
        public Sprite WarningBackground;

        [Tooltip("Background image for error toasts.")]
        public Sprite ErrorBackground;
        #endregion

        #region Inspector - Colors
        [Header("Type Colors")]
        [Tooltip("Background color for info toasts.")]
        public Color InfoColor = new Color(0.2f, 0.5f, 1f, 0.9f);

        [Tooltip("Background color for success toasts.")]
        public Color SuccessColor = new Color(0.2f, 0.8f, 0.3f, 0.9f);

        [Tooltip("Background color for warning toasts.")]
        public Color WarningColor = new Color(1f, 0.8f, 0.2f, 0.9f);

        [Tooltip("Background color for error toasts.")]
        public Color ErrorColor = new Color(1f, 0.2f, 0.2f, 0.9f);

        [Tooltip("Text color for all toast messages.")]
        public Color TextColor = Color.white;

        [Tooltip("Icon color for info toasts.")]
        public Color InfoIconColor = Color.white;

        [Tooltip("Icon color for success toasts.")]
        public Color SuccessIconColor = Color.white;

        [Tooltip("Icon color for warning toasts.")]
        public Color WarningIconColor = Color.black;

        [Tooltip("Icon color for error toasts.")]
        public Color ErrorIconColor = Color.white;
        #endregion

        #region Inspector - Timing
        [Header("Timing")]
        [Tooltip("Default display duration for toasts in seconds.")]
        public float DefaultDuration = 2f;

        [Tooltip("Duration of the fade-in animation.")]
        public float FadeInDuration = 0.2f;

        [Tooltip("Duration of the fade-out animation.")]
        public float FadeOutDuration = 0.3f;

        [Tooltip("Duration of the slide-in animation.")]
        public float SlideInDuration = 0.25f;

        [Tooltip("Delay between processing queued toasts.")]
        public float QueueProcessDelay = 0.1f;
        #endregion

        #region Inspector - Stacking
        [Header("Stacking")]
        [Tooltip("Vertical pixel offset between stacked toasts.")]
        public float StackOffset = 80f;

        [Tooltip("Maximum number of simultaneously visible toasts.")]
        public int MaxVisibleToasts = 3;

        [Tooltip("If true, new toasts of the same type replace the existing one instead of stacking.")]
        public bool CombineSameType = false;

        [Tooltip("If true, toasts stack from bottom to top. If false, top to bottom.")]
        public bool StackFromBottom = true;

        [Tooltip("Horizontal position of toasts (-1 = left, 0 = center, 1 = right).")]
        [Range(-1f, 1f)]
        public float HorizontalAlignment = 0f;

        [Tooltip("Side padding from screen edges in pixels.")]
        public float SidePadding = 40f;
        #endregion

        #region Inspector - Animation
        [Header("Animation")]
        [Tooltip("Easing curve for toast animations.")]
        public AnimationCurve AnimationCurve = AnimationCurve.EaseInOut(0, 0, 1, 1);

        [Tooltip("If true, toasts slide in from the side instead of fading in.")]
        public bool SlideInFromSide = true;

        [Tooltip("Slide-in distance in pixels.")]
        public float SlideInDistance = 200f;

        [Tooltip("If true, applies a subtle bounce to the slide animation.")]
        public bool BounceOnEnter = false;
        #endregion

        #region Private State
        private readonly Queue<ToastData> _toastQueue = new();
        private readonly List<GameObject> _activeToasts = new();
        private readonly Dictionary<ToastType, GameObject> _lastToastByType = new();
        private Coroutine _processQueueCoroutine;
        private bool _isProcessingQueue;
        #endregion

        #region Public Properties
        /// <summary>
        /// Number of toasts currently waiting in the queue.
        /// </summary>
        public int QueuedCount => _toastQueue.Count;

        /// <summary>
        /// Number of toasts currently visible on screen.
        /// </summary>
        public int VisibleCount => _activeToasts.Count;

        /// <summary>
        /// True if the queue is currently being processed.
        /// </summary>
        public bool IsProcessing => _isProcessingQueue;
        #endregion

        #region Events
        /// <summary>
        /// Fired when a toast is shown.
        /// </summary>
        public event System.Action<ToastData> OnToastShown;

        /// <summary>
        /// Fired when a toast is dismissed.
        /// </summary>
        public event System.Action<ToastData> OnToastDismissed;

        /// <summary>
        /// Fired when all queued toasts have been processed.
        /// </summary>
        public event System.Action OnQueueEmpty;
        #endregion

        #region Unity Lifecycle
        private void Awake()
        {
            if (ToastContainer == null)
            {
                ToastContainer = transform;
            }
        }

        private void OnDestroy()
        {
            // Clean up active toasts
            foreach (var toast in _activeToasts)
            {
                if (toast != null)
                    Destroy(toast);
            }
            _activeToasts.Clear();
        }
        #endregion

        #region Public Methods - Show Toasts
        /// <summary>
        /// Displays a toast notification with the specified message, type, and duration.
        /// If MaxVisibleToasts is reached, the toast is queued for later display.
        /// </summary>
        /// <param name="message">The text message to display.</param>
        /// <param name="type">The visual type of the toast.</param>
        /// <param name="duration">Optional override duration. Null uses DefaultDuration.</param>
        public void ShowToast(string message, ToastType type = ToastType.Info, float? duration = null)
        {
            if (string.IsNullOrEmpty(message))
            {
                Debug.LogWarning("[ToastNotification] Cannot show toast with empty message.");
                return;
            }

            float actualDuration = duration ?? DefaultDuration;
            var toastData = new ToastData(message, type, actualDuration);

            // Check if we should combine with existing toast of same type
            if (CombineSameType && _lastToastByType.TryGetValue(type, out var existingToast))
            {
                if (existingToast != null)
                {
                    UpdateExistingToast(existingToast, toastData);
                    return;
                }
            }

            // If at max visible toasts, queue it
            if (_activeToasts.Count >= MaxVisibleToasts)
            {
                _toastQueue.Enqueue(toastData);
                ProcessQueue();
                return;
            }

            // Show immediately
            CreateAndShowToast(toastData);
        }

        /// <summary>
        /// Shortcut for showing a success toast.
        /// </summary>
        /// <param name="message">Success message text.</param>
        public void ShowSuccess(string message)
        {
            ShowToast(message, ToastType.Success, DefaultDuration);
        }

        /// <summary>
        /// Shortcut for showing an error toast.
        /// </summary>
        /// <param name="message">Error message text.</param>
        public void ShowError(string message)
        {
            ShowToast(message, ToastType.Error, DefaultDuration * 1.5f);
        }

        /// <summary>
        /// Shortcut for showing a warning toast.
        /// </summary>
        /// <param name="message">Warning message text.</param>
        public void ShowWarning(string message)
        {
            ShowToast(message, ToastType.Warning, DefaultDuration);
        }

        /// <summary>
        /// Clears all active toasts and the pending queue.
        /// </summary>
        /// <param name="animate">If true, toasts fade out. If false, they're destroyed immediately.</param>
        public void ClearAllToasts(bool animate = true)
        {
            // Clear queue
            _toastQueue.Clear();

            // Dismiss active toasts
            var toastsToRemove = new List<GameObject>(_activeToasts);
            foreach (var toast in toastsToRemove)
            {
                if (toast != null)
                {
                    if (animate)
                    {
                        StartCoroutine(DismissToastCoroutine(toast));
                    }
                    else
                    {
                        Destroy(toast);
                    }
                }
            }

            _activeToasts.Clear();
            _lastToastByType.Clear();
        }

        /// <summary>
        /// Dismisses a specific toast immediately.
        /// </summary>
        /// <param name="toast">The toast GameObject to dismiss.</param>
        public void DismissToast(GameObject toast)
        {
            if (toast == null) return;

            if (_activeToasts.Contains(toast))
            {
                _activeToasts.Remove(toast);
                StartCoroutine(DismissToastCoroutine(toast));
                UpdateToastPositions();
                ProcessQueue();
            }
        }
        #endregion

        #region Private Toast Creation
        private void CreateAndShowToast(ToastData data)
        {
            if (ToastPrefab == null)
            {
                Debug.LogError("[ToastNotification] ToastPrefab is not assigned.");
                return;
            }

            // Instantiate toast
            GameObject toast = Instantiate(ToastPrefab, ToastContainer, false);
            toast.name = $"Toast_{data.Type}_{_activeToasts.Count}";

            // Configure visual appearance
            ConfigureToastAppearance(toast, data);

            // Add to tracking
            _activeToasts.Add(toast);
            _lastToastByType[data.Type] = toast;

            // Start display coroutine
            StartCoroutine(ToastCoroutine(toast, data));

            // Update positions for stack
            UpdateToastPositions();

            OnToastShown?.Invoke(data);
        }

        private void ConfigureToastAppearance(GameObject toast, ToastData data)
        {
            // Get components
            var image = toast.GetComponentInChildren<Image>();
            var text = toast.GetComponentInChildren<TextMeshProUGUI>();
            var canvasGroup = toast.GetComponent<CanvasGroup>();
            var iconImage = toast.transform.Find("Icon")?.GetComponent<Image>();

            if (canvasGroup == null)
            {
                canvasGroup = toast.AddComponent<CanvasGroup>();
            }

            // Set text
            if (text != null)
            {
                text.text = data.Message;
                text.color = TextColor;

                // Adjust text color for warning (dark background)
                if (data.Type == ToastType.Warning)
                {
                    text.color = Color.black;
                }
            }

            // Set background color and sprite
            if (image != null)
            {
                (image.color, image.sprite) = data.Type switch
                {
                    ToastType.Success => (SuccessColor, SuccessBackground),
                    ToastType.Warning => (WarningColor, WarningBackground),
                    ToastType.Error => (ErrorColor, ErrorBackground),
                    _ => (InfoColor, InfoBackground)
                };
            }

            // Set icon color
            if (iconImage != null)
            {
                iconImage.color = data.Type switch
                {
                    ToastType.Success => SuccessIconColor,
                    ToastType.Warning => WarningIconColor,
                    ToastType.Error => ErrorIconColor,
                    _ => InfoIconColor
                };
            }

            // Set initial alpha for animation
            canvasGroup.alpha = 0f;

            // Add click-to-dismiss
            var btn = toast.GetComponent<Button>();
            if (btn == null)
            {
                btn = toast.AddComponent<Button>();
                btn.transition = Selectable.Transition.None;
            }
            btn.onClick.AddListener(() => DismissToast(toast));

            // Store ToastData on the GameObject for reference
            var toastRef = toast.AddComponent<ToastReference>();
            toastRef.Data = data;
        }

        private void UpdateExistingToast(GameObject toast, ToastData newData)
        {
            var text = toast.GetComponentInChildren<TextMeshProUGUI>();
            if (text != null)
            {
                text.text = newData.Message;
            }

            // Refresh the timer
            var toastRef = toast.GetComponent<ToastReference>();
            if (toastRef != null)
            {
                toastRef.Data = newData;
            }

            // Pulse animation to indicate update
            var rt = toast.GetComponent<RectTransform>();
            if (rt != null)
            {
                StartCoroutine(UITransitions.PunchScale(rt, 1.1f, 0.2f));
            }

            OnToastShown?.Invoke(newData);
        }
        #endregion

        #region Coroutines
        private IEnumerator ToastCoroutine(GameObject toast, ToastData data)
        {
            var canvasGroup = toast.GetComponent<CanvasGroup>();
            var rectTransform = toast.GetComponent<RectTransform>();

            // Fade and slide in
            yield return StartCoroutine(AnimateToastIn(canvasGroup, rectTransform));

            // Wait for duration (using unscaled time for pause compatibility)
            float elapsed = 0f;
            while (elapsed < data.Duration)
            {
                // Check if the toast still exists and is active
                if (toast == null) yield break;

                elapsed += Time.unscaledDeltaTime;
                yield return null;
            }

            // Dismiss
            if (toast != null && _activeToasts.Contains(toast))
            {
                _activeToasts.Remove(toast);
                if (_lastToastByType.ContainsKey(data.Type) && _lastToastByType[data.Type] == toast)
                {
                    _lastToastByType.Remove(data.Type);
                }

                yield return StartCoroutine(DismissToastCoroutine(toast));
                UpdateToastPositions();
                ProcessQueue();
            }

            OnToastDismissed?.Invoke(data);
        }

        private IEnumerator AnimateToastIn(CanvasGroup canvasGroup, RectTransform rectTransform)
        {
            float elapsed = 0f;
            float duration = SlideInFromSide ? SlideInDuration : FadeInDuration;

            // Calculate start position for slide
            Vector2 targetPos = GetToastPosition(_activeToasts.Count - 1);
            Vector2 startPos = SlideInFromSide
                ? targetPos + new Vector2(SlideInDistance * (HorizontalAlignment >= 0 ? 1f : -1f), 0f)
                : targetPos;

            if (rectTransform != null)
            {
                rectTransform.anchoredPosition = startPos;
            }

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                float easedT = AnimationCurve.Evaluate(t);

                // Fade
                if (canvasGroup != null)
                {
                    canvasGroup.alpha = t;
                }

                // Slide
                if (rectTransform != null && SlideInFromSide)
                {
                    if (BounceOnEnter)
                    {
                        float bounceT = UITransitions.EaseOutBack(t);
                        rectTransform.anchoredPosition = Vector2.LerpUnclamped(startPos, targetPos, bounceT);
                    }
                    else
                    {
                        rectTransform.anchoredPosition = Vector2.LerpUnclamped(startPos, targetPos, easedT);
                    }
                }

                yield return null;
            }

            // Finalize
            if (canvasGroup != null)
                canvasGroup.alpha = 1f;
            if (rectTransform != null)
                rectTransform.anchoredPosition = targetPos;
        }

        private IEnumerator DismissToastCoroutine(GameObject toast)
        {
            if (toast == null) yield break;

            var canvasGroup = toast.GetComponent<CanvasGroup>();
            var rectTransform = toast.GetComponent<RectTransform>();
            float elapsed = 0f;

            // Fade out and slide up slightly
            while (elapsed < FadeOutDuration)
            {
                if (toast == null) yield break;

                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / FadeOutDuration);

                if (canvasGroup != null)
                {
                    canvasGroup.alpha = 1f - t;
                }

                if (rectTransform != null)
                {
                    rectTransform.anchoredPosition += Vector2.up * 30f * Time.unscaledDeltaTime;
                }

                yield return null;
            }

            if (toast != null)
            {
                Destroy(toast);
            }
        }
        #endregion

        #region Queue Processing
        private void ProcessQueue()
        {
            if (_isProcessingQueue) return;
            if (_toastQueue.Count == 0) return;
            if (_activeToasts.Count >= MaxVisibleToasts) return;

            _processQueueCoroutine = StartCoroutine(ProcessQueueCoroutine());
        }

        private IEnumerator ProcessQueueCoroutine()
        {
            _isProcessingQueue = true;

            while (_toastQueue.Count > 0 && _activeToasts.Count < MaxVisibleToasts)
            {
                var data = _toastQueue.Dequeue();
                CreateAndShowToast(data);
                yield return new WaitForSecondsRealtime(QueueProcessDelay);
            }

            _isProcessingQueue = false;

            if (_toastQueue.Count == 0)
            {
                OnQueueEmpty?.Invoke();
            }
        }
        #endregion

        #region Position Management
        private void UpdateToastPositions()
        {
            for (int i = 0; i < _activeToasts.Count; i++)
            {
                if (_activeToasts[i] == null) continue;

                var rt = _activeToasts[i].GetComponent<RectTransform>();
                if (rt != null)
                {
                    Vector2 targetPos = GetToastPosition(i);
                    // Smoothly move to new position
                    StartCoroutine(SmoothMoveToPosition(rt, targetPos, 0.2f));
                }
            }
        }

        private Vector2 GetToastPosition(int index)
        {
            if (ToastContainer == null) return Vector2.zero;

            var containerRT = ToastContainer.GetComponent<RectTransform>();
            if (containerRT == null) return Vector2.zero;

            float containerWidth = containerRT.rect.width;
            float containerHeight = containerRT.rect.height;

            // Calculate x position based on alignment
            float xPos = HorizontalAlignment switch
            {
                < 0f => -containerWidth * 0.5f + SidePadding,   // Left aligned
                > 0f => containerWidth * 0.5f - SidePadding,    // Right aligned
                _ => 0f                                          // Center
            };

            // Calculate y position based on stack direction
            float yOffset = index * StackOffset;
            float yPos = StackFromBottom
                ? -containerHeight * 0.5f + SidePadding + yOffset
                : containerHeight * 0.5f - SidePadding - yOffset;

            return new Vector2(xPos, yPos);
        }

        private IEnumerator SmoothMoveToPosition(RectTransform rt, Vector2 targetPos, float duration)
        {
            Vector2 startPos = rt.anchoredPosition;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                if (rt == null) yield break;

                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                float easedT = AnimationCurve.EaseInOut(0, 0, 1, 1).Evaluate(t);
                rt.anchoredPosition = Vector2.Lerp(startPos, targetPos, easedT);
                yield return null;
            }

            if (rt != null)
                rt.anchoredPosition = targetPos;
        }
        #endregion

        #region Private Helpers
        private Color GetToastColor(ToastType type)
        {
            return type switch
            {
                ToastType.Success => SuccessColor,
                ToastType.Warning => WarningColor,
                ToastType.Error => ErrorColor,
                _ => InfoColor
            };
        }

        private Sprite GetToastBackground(ToastType type)
        {
            return type switch
            {
                ToastType.Success => SuccessBackground,
                ToastType.Warning => WarningBackground,
                ToastType.Error => ErrorBackground,
                _ => InfoBackground
            };
        }
        #endregion

#if UNITY_EDITOR
        [ContextMenu("Test Info Toast")]
        private void EditorTestInfo()
        {
            ShowToast("This is an info toast notification!", ToastType.Info, 3f);
        }

        [ContextMenu("Test Success Toast")]
        private void EditorTestSuccess()
        {
            ShowSuccess("Operation completed successfully!");
        }

        [ContextMenu("Test Warning Toast")]
        private void EditorTestWarning()
        {
            ShowWarning("Please check your connection.");
        }

        [ContextMenu("Test Error Toast")]
        private void EditorTestError()
        {
            ShowError("Something went wrong!");
        }

        [ContextMenu("Test Multiple Toasts")]
        private void EditorTestMultiple()
        {
            ShowToast("First toast message here!", ToastType.Info, 3f);
            ShowToast("Second toast - success!", ToastType.Success, 3f);
            ShowToast("Third toast - warning!", ToastType.Warning, 3f);
            ShowToast("Fourth toast - error!", ToastType.Error, 3f);
        }

        [ContextMenu("Clear All Toasts")]
        private void EditorClearAll()
        {
            ClearAllToasts(true);
        }
#endif
    }

    /// <summary>
    /// Helper component attached to toast GameObjects to store reference data.
    /// </summary>
    public class ToastReference : MonoBehaviour
    {
        /// <summary>
        /// The ToastData associated with this toast instance.
        /// </summary>
        public ToastData Data;
    }
}
