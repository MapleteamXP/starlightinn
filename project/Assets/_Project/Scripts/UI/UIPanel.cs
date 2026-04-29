using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

namespace KawaiiCoolIsland.UI
{
    /// <summary>
    /// Defines the type of animation used when a panel enters or exits.
    /// </summary>
    public enum PanelAnimationType
    {
        /// <summary>No animation.</summary>
        None,
        /// <summary>Fade in from transparent to opaque.</summary>
        FadeIn,
        /// <summary>Fade out from opaque to transparent.</summary>
        FadeOut,
        /// <summary>Slide in from the left edge.</summary>
        SlideFromLeft,
        /// <summary>Slide in from the right edge.</summary>
        SlideFromRight,
        /// <summary>Slide in from the top edge.</summary>
        SlideFromTop,
        /// <summary>Slide in from the bottom edge.</summary>
        SlideFromBottom,
        /// <summary>Slide out to the left edge.</summary>
        SlideToLeft,
        /// <summary>Slide out to the right edge.</summary>
        SlideToRight,
        /// <summary>Slide out to the top edge.</summary>
        SlideToTop,
        /// <summary>Slide out to the bottom edge.</summary>
        SlideToBottom,
        /// <summary>Scale in from zero to full size.</summary>
        ScaleIn,
        /// <summary>Scale out from full size to zero.</summary>
        ScaleOut,
        /// <summary>Bounce in with elastic overshoot.</summary>
        BounceIn,
        /// <summary>Bounce out with elastic overshoot.</summary>
        BounceOut
    }

    /// <summary>
    /// Popup type that determines icon, color, and button configuration.
    /// </summary>
    public enum PopupType
    {
        /// <summary>Informational popup with OK button.</summary>
        Info,
        /// <summary>Warning popup with yellow accent.</summary>
        Warning,
        /// <summary>Error popup with red accent.</summary>
        Error,
        /// <summary>Confirmation popup with OK/Cancel buttons.</summary>
        Confirm,
        /// <summary>Input popup with text field.</summary>
        Input
    }

    /// <summary>
    /// Toast notification type that determines visual styling.
    /// </summary>
    public enum ToastType
    {
        /// <summary>Neutral information toast.</summary>
        Info,
        /// <summary>Success toast with green accent.</summary>
        Success,
        /// <summary>Warning toast with yellow/orange accent.</summary>
        Warning,
        /// <summary>Error toast with red accent.</summary>
        Error
    }

    /// <summary>
    /// Base class for all UI panels in KawaiiCool Island.
    /// Provides lifecycle hooks, animation support, and platform-aware layout.
    /// </summary>
    public abstract class UIPanel : MonoBehaviour
    {
        #region Inspector - Panel Settings
        [Header("Panel Settings")]
        [Tooltip("Unique identifier used by UIManager to reference this panel.")]
        public string PanelId;

        [Tooltip("If true, blocks interaction with panels behind this one.")]
        public bool IsModal = false;

        [Tooltip("If true, pauses game time when this panel is open.")]
        public bool PauseGameWhenOpen = false;

        [Tooltip("If true, pressing Escape will trigger OnBackPressed.")]
        public bool CloseOnEscape = true;

        [Tooltip("If true, clicking the background blocker will close the panel.")]
        public bool CloseOnBackgroundClick = false;
        #endregion

        #region Inspector - Animation
        [Header("Animation")]
        [Tooltip("Animation to play when the panel is shown.")]
        public PanelAnimationType EnterAnimation = PanelAnimationType.FadeIn;

        [Tooltip("Animation to play when the panel is hidden.")]
        public PanelAnimationType ExitAnimation = PanelAnimationType.FadeOut;

        [Tooltip("Duration of the enter/exit animation in seconds.")]
        public float AnimationDuration = 0.3f;

        [Tooltip("Easing curve for the animation. Defaults to ease-in-out.")]
        public AnimationCurve AnimationCurve = AnimationCurve.EaseInOut(0, 0, 1, 1);
        #endregion

        #region Inspector - Audio
        [Header("Audio")]
        [Tooltip("Sound effect ID played when the panel opens.")]
        public string OpenSFX = "ui_open";

        [Tooltip("Sound effect ID played when the panel closes.")]
        public string CloseSFX = "ui_close";
        #endregion

        #region Inspector - References
        [Header("References")]
        [Tooltip("CanvasGroup for controlling panel alpha and raycast blocking.")]
        public CanvasGroup CanvasGroup;

        [Tooltip("The main content RectTransform that will be animated.")]
        public RectTransform ContentRect;

        [Tooltip("Optional close button that will be auto-wired.")]
        public Button CloseButton;

        [Tooltip("Background blocker GameObject for modal panels.")]
        public GameObject BackgroundBlocker;
        #endregion

        #region State
        /// <summary>
        /// True if the panel is currently visible (after show animation completes).
        /// </summary>
        public bool IsVisible { get; private set; }

        /// <summary>
        /// True while the panel is in the middle of an enter or exit animation.
        /// </summary>
        public bool IsAnimating { get; private set; }

        /// <summary>
        /// The original sibling index this panel had when registered.
        /// </summary>
        public int OriginalSiblingIndex { get; private set; }

        private Vector2 _originalAnchoredPosition;
        private Vector3 _originalScale;
        private bool _isRegistered;
        private Coroutine _currentAnimation;
        #endregion

        #region Unity Lifecycle
        /// <summary>
        /// Called when the script instance is being loaded.
        /// Initializes references and captures original transform values.
        /// </summary>
        protected virtual void Awake()
        {
            // Auto-find CanvasGroup if not assigned
            if (CanvasGroup == null)
                CanvasGroup = GetComponent<CanvasGroup>();

            // Auto-find ContentRect if not assigned
            if (ContentRect == null)
                ContentRect = GetComponent<RectTransform>();

            // Capture original values for animation reset
            if (ContentRect != null)
            {
                _originalAnchoredPosition = ContentRect.anchoredPosition;
                _originalScale = ContentRect.localScale;
            }

            // Wire close button
            if (CloseButton != null)
            {
                CloseButton.onClick.AddListener(OnCloseButtonClicked);
            }

            // Wire background blocker click
            if (BackgroundBlocker != null)
            {
                var blockerBtn = BackgroundBlocker.GetComponent<Button>();
                if (blockerBtn == null)
                {
                    blockerBtn = BackgroundBlocker.AddComponent<Button>();
                    blockerBtn.transition = Selectable.Transition.None;
                }
                blockerBtn.onClick.AddListener(OnBackgroundClicked);
            }

            // Ensure CanvasGroup exists
            if (CanvasGroup == null)
            {
                CanvasGroup = gameObject.AddComponent<CanvasGroup>();
            }

            CanvasGroup.alpha = 0f;
            CanvasGroup.blocksRaycasts = false;
            CanvasGroup.interactable = false;
        }

        /// <summary>
        /// Called on the frame when the script is enabled.
        /// </summary>
        protected virtual void OnEnable()
        {
            if (PauseGameWhenOpen)
            {
                Time.timeScale = 0f;
            }
        }

        /// <summary>
        /// Called when the behaviour becomes disabled.
        /// </summary>
        protected virtual void OnDisable()
        {
            if (PauseGameWhenOpen && Time.timeScale == 0f)
            {
                Time.timeScale = 1f;
            }
        }

        /// <summary>
        /// Called when the MonoBehaviour will be destroyed.
        /// Unregisters from UIManager and cleans up event listeners.
        /// </summary>
        protected virtual void OnDestroy()
        {
            if (CloseButton != null)
            {
                CloseButton.onClick.RemoveListener(OnCloseButtonClicked);
            }

            if (BackgroundBlocker != null)
            {
                var blockerBtn = BackgroundBlocker.GetComponent<Button>();
                if (blockerBtn != null)
                    blockerBtn.onClick.RemoveListener(OnBackgroundClicked);
            }

            if (_isRegistered && UIManager.Instance != null)
            {
                UIManager.Instance.UnregisterPanel(this);
                _isRegistered = false;
            }

            if (_currentAnimation != null)
            {
                StopCoroutine(_currentAnimation);
            }
        }
        #endregion

        #region Lifecycle Hooks (Override in derived classes)
        /// <summary>
        /// Called when the panel is about to be shown (before animation starts).
        /// Override to populate data and prepare the panel state.
        /// </summary>
        public virtual void OnPanelShow()
        {
            // Override in derived classes
        }

        /// <summary>
        /// Called after the show animation completes.
        /// Override to start animations or enable interactive elements.
        /// </summary>
        public virtual void OnPanelShown()
        {
            // Override in derived classes
        }

        /// <summary>
        /// Called when the panel is about to be hidden (before exit animation).
        /// Override to save state or stop running coroutines.
        /// </summary>
        public virtual void OnPanelHide()
        {
            // Override in derived classes
        }

        /// <summary>
        /// Called after the hide animation completes.
        /// Override to clean up resources.
        /// </summary>
        public virtual void OnPanelHidden()
        {
            // Override in derived classes
        }

        /// <summary>
        /// Called when the panel's data should be refreshed while visible.
        /// Override to update bound data and UI elements.
        /// </summary>
        public virtual void OnPanelRefresh()
        {
            // Override in derived classes
        }

        /// <summary>
        /// Called when the device type changes (e.g., mobile to desktop).
        /// Override to adjust layout or show/hide platform-specific elements.
        /// </summary>
        /// <param name="deviceType">The new device type.</param>
        public virtual void OnDeviceTypeChanged(DeviceType deviceType)
        {
            // Override in derived classes for platform-specific adjustments
        }

        /// <summary>
        /// Called when the back button (Escape) is pressed while this panel is active.
        /// </summary>
        /// <returns>True if the back press was handled and should not propagate further.</returns>
        public virtual bool OnBackPressed()
        {
            if (CloseOnEscape && !IsModal)
            {
                Hide(true);
                return true;
            }
            return false;
        }
        #endregion

        #region Public Methods
        /// <summary>
        /// Shows the panel with optional animation.
        /// </summary>
        /// <param name="animate">Whether to play the enter animation.</param>
        public void Show(bool animate = true)
        {
            if (IsVisible) return;

            // Auto-register if needed
            if (!_isRegistered && UIManager.Instance != null)
            {
                if (string.IsNullOrEmpty(PanelId))
                {
                    PanelId = GetType().Name;
                }
                UIManager.Instance.RegisterPanel(this);
                _isRegistered = true;
            }

            gameObject.SetActive(true);
            transform.SetAsLastSibling();

            OnPanelShow();

            if (animate)
            {
                if (_currentAnimation != null)
                    StopCoroutine(_currentAnimation);
                _currentAnimation = StartCoroutine(AnimateShow());
            }
            else
            {
                SkipToShown();
            }
        }

        /// <summary>
        /// Hides the panel with optional animation.
        /// </summary>
        /// <param name="animate">Whether to play the exit animation.</param>
        public void Hide(bool animate = true)
        {
            if (!IsVisible && !gameObject.activeSelf) return;

            OnPanelHide();

            if (animate)
            {
                if (_currentAnimation != null)
                    StopCoroutine(_currentAnimation);
                _currentAnimation = StartCoroutine(AnimateHide());
            }
            else
            {
                SkipToHidden();
            }
        }

        /// <summary>
        /// Refreshes the panel's data bindings and UI state while visible.
        /// </summary>
        public void Refresh()
        {
            OnPanelRefresh();
        }

        /// <summary>
        /// Brings this panel to the front of the sorting order.
        /// </summary>
        public void BringToFront()
        {
            transform.SetAsLastSibling();
        }

        /// <summary>
        /// Resets the panel's transform to its original captured values.
        /// </summary>
        public void ResetTransform()
        {
            if (ContentRect != null)
            {
                ContentRect.anchoredPosition = _originalAnchoredPosition;
                ContentRect.localScale = _originalScale;
            }
        }
        #endregion

        #region Animation Coroutines
        /// <summary>
        /// Coroutine that plays the enter animation based on EnterAnimation setting.
        /// </summary>
        public IEnumerator AnimateShow()
        {
            IsAnimating = true;

            // Reset to visible state before animating
            if (CanvasGroup != null)
            {
                CanvasGroup.blocksRaycasts = true;
                CanvasGroup.interactable = true;
            }

            // Reset transform
            ResetTransform();

            switch (EnterAnimation)
            {
                case PanelAnimationType.FadeIn:
                    if (CanvasGroup != null)
                        yield return StartCoroutine(UITransitions.FadeIn(CanvasGroup, AnimationDuration, AnimationCurve));
                    break;

                case PanelAnimationType.SlideFromLeft:
                    if (ContentRect != null)
                        yield return StartCoroutine(UITransitions.SlideIn(ContentRect, SlideDirection.Left, AnimationDuration, AnimationCurve));
                    if (CanvasGroup != null)
                        CanvasGroup.alpha = 1f;
                    break;

                case PanelAnimationType.SlideFromRight:
                    if (ContentRect != null)
                        yield return StartCoroutine(UITransitions.SlideIn(ContentRect, SlideDirection.Right, AnimationDuration, AnimationCurve));
                    if (CanvasGroup != null)
                        CanvasGroup.alpha = 1f;
                    break;

                case PanelAnimationType.SlideFromTop:
                    if (ContentRect != null)
                        yield return StartCoroutine(UITransitions.SlideIn(ContentRect, SlideDirection.Top, AnimationDuration, AnimationCurve));
                    if (CanvasGroup != null)
                        CanvasGroup.alpha = 1f;
                    break;

                case PanelAnimationType.SlideFromBottom:
                    if (ContentRect != null)
                        yield return StartCoroutine(UITransitions.SlideIn(ContentRect, SlideDirection.Bottom, AnimationDuration, AnimationCurve));
                    if (CanvasGroup != null)
                        CanvasGroup.alpha = 1f;
                    break;

                case PanelAnimationType.ScaleIn:
                    if (ContentRect != null)
                        yield return StartCoroutine(UITransitions.ScaleIn(ContentRect, AnimationDuration, AnimationCurve));
                    if (CanvasGroup != null)
                        CanvasGroup.alpha = 1f;
                    break;

                case PanelAnimationType.BounceIn:
                    if (ContentRect != null)
                        yield return StartCoroutine(UITransitions.BounceIn(ContentRect, AnimationDuration));
                    if (CanvasGroup != null)
                        CanvasGroup.alpha = 1f;
                    break;

                case PanelAnimationType.None:
                default:
                    if (CanvasGroup != null)
                        CanvasGroup.alpha = 1f;
                    break;
            }

            IsAnimating = false;
            IsVisible = true;
            OnPanelShown();
            UIManager.Instance?.OnPanelShown?.Invoke(this);
        }

        /// <summary>
        /// Coroutine that plays the exit animation based on ExitAnimation setting.
        /// </summary>
        public IEnumerator AnimateHide()
        {
            IsAnimating = true;

            // Disable interaction during exit
            if (CanvasGroup != null)
            {
                CanvasGroup.interactable = false;
            }

            switch (ExitAnimation)
            {
                case PanelAnimationType.FadeOut:
                    if (CanvasGroup != null)
                        yield return StartCoroutine(UITransitions.FadeOut(CanvasGroup, AnimationDuration, AnimationCurve));
                    break;

                case PanelAnimationType.SlideToLeft:
                    if (ContentRect != null)
                        yield return StartCoroutine(UITransitions.SlideOut(ContentRect, SlideDirection.Left, AnimationDuration, AnimationCurve));
                    break;

                case PanelAnimationType.SlideToRight:
                    if (ContentRect != null)
                        yield return StartCoroutine(UITransitions.SlideOut(ContentRect, SlideDirection.Right, AnimationDuration, AnimationCurve));
                    break;

                case PanelAnimationType.SlideToTop:
                    if (ContentRect != null)
                        yield return StartCoroutine(UITransitions.SlideOut(ContentRect, SlideDirection.Top, AnimationDuration, AnimationCurve));
                    break;

                case PanelAnimationType.SlideToBottom:
                    if (ContentRect != null)
                        yield return StartCoroutine(UITransitions.SlideOut(ContentRect, SlideDirection.Bottom, AnimationDuration, AnimationCurve));
                    break;

                case PanelAnimationType.ScaleOut:
                    if (ContentRect != null)
                        yield return StartCoroutine(UITransitions.ScaleOut(ContentRect, AnimationDuration, AnimationCurve));
                    break;

                case PanelAnimationType.BounceOut:
                    if (ContentRect != null)
                        yield return StartCoroutine(UITransitions.BounceOut(ContentRect, AnimationDuration));
                    break;

                case PanelAnimationType.None:
                default:
                    if (CanvasGroup != null)
                        CanvasGroup.alpha = 0f;
                    break;
            }

            // Finalize hidden state
            if (CanvasGroup != null)
            {
                CanvasGroup.alpha = 0f;
                CanvasGroup.blocksRaycasts = false;
            }

            IsAnimating = false;
            IsVisible = false;
            gameObject.SetActive(false);
            OnPanelHidden();
            UIManager.Instance?.OnPanelHidden?.Invoke(this);
        }
        #endregion

        #region Private Helpers
        private void SkipToShown()
        {
            if (CanvasGroup != null)
            {
                CanvasGroup.alpha = 1f;
                CanvasGroup.blocksRaycasts = true;
                CanvasGroup.interactable = true;
            }
            ResetTransform();
            IsVisible = true;
            OnPanelShown();
        }

        private void SkipToHidden()
        {
            if (CanvasGroup != null)
            {
                CanvasGroup.alpha = 0f;
                CanvasGroup.blocksRaycasts = false;
                CanvasGroup.interactable = false;
            }
            IsVisible = false;
            gameObject.SetActive(false);
            OnPanelHidden();
        }

        private void OnCloseButtonClicked()
        {
            if (IsModal)
            {
                // For modal panels, just hide without affecting navigation stack
                Hide(true);
            }
            else
            {
                // For non-modal panels, let UIManager handle navigation
                if (UIManager.Instance != null && !string.IsNullOrEmpty(PanelId))
                {
                    UIManager.Instance.HidePanel(PanelId, true);
                }
                else
                {
                    Hide(true);
                }
            }
        }

        private void OnBackgroundClicked()
        {
            if (CloseOnBackgroundClick)
            {
                OnCloseButtonClicked();
            }
        }
        #endregion
    }
}
