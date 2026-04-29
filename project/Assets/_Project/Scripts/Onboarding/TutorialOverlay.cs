using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace KawaiiCool.Onboarding
{
    /// <summary>
    /// Provides an interactive tutorial overlay with darkened backgrounds,
    /// highlight regions, tooltip panels, arrow indicators, and animated
    /// finger-cursor gestures to guide the player through onboarding and tutorials.
    /// </summary>
    public class TutorialOverlay : MonoBehaviour
    {
        // ─────────────────────────────────────────────────────────────────
        //  Overlay
        // ─────────────────────────────────────────────────────────────────
        [Header("Overlay")]
        [SerializeField, Tooltip("The canvas that renders the tutorial overlay above all other UI.")]
        private Canvas _overlayCanvas;

        /// <summary>
        /// Gets or sets the overlay canvas.
        /// </summary>
        public Canvas OverlayCanvas => _overlayCanvas;

        [SerializeField, Tooltip("Full-screen image used to darken the background behind the tutorial.")]
        private Image _darkenBackground;

        [SerializeField, Tooltip("Alpha value for the darkened background (0 = transparent, 1 = fully opaque)."), Range(0f, 1f)]
        private float _darkenAlpha = 0.6f;

        [SerializeField, Tooltip("Color of the highlight glow overlay.")]
        private Color _highlightColor = new Color(1f, 0.8f, 0f, 0.3f);

        // ─────────────────────────────────────────────────────────────────
        //  Highlight
        // ─────────────────────────────────────────────────────────────────
        [Header("Highlight")]
        [SerializeField, Tooltip("The root RectTransform used to position the highlight area.")]
        private RectTransform _highlightRect;

        [SerializeField, Tooltip("Border image drawn around the highlighted region.")]
        private Image _highlightBorder;

        [SerializeField, Tooltip("Extra padding around the target element when highlighting.")]
        private float _highlightPadding = 10f;

        [SerializeField, Tooltip("Duration of the highlight move/scale animation in seconds.")]
        private float _highlightAnimationDuration = 0.3f;

        // ─────────────────────────────────────────────────────────────────
        //  Tooltip
        // ─────────────────────────────────────────────────────────────────
        [Header("Tooltip")]
        [SerializeField, Tooltip("Root GameObject for the tooltip panel.")]
        private GameObject _tooltipPanel;

        [SerializeField, Tooltip("Text component for the tooltip title.")]
        private TMP_Text _tooltipTitle;

        [SerializeField, Tooltip("Text component for the tooltip description/instructions.")]
        private TMP_Text _tooltipDescription;

        [SerializeField, Tooltip("Button to advance to the next step.")]
        private Button _tooltipNextButton;

        [SerializeField, Tooltip("Button to skip the current step.")]
        private Button _tooltipSkipButton;

        [SerializeField, Tooltip("Vertical offset between the highlight and the tooltip panel.")]
        private float _tooltipOffset = 20f;

        // ─────────────────────────────────────────────────────────────────
        //  Arrow
        // ─────────────────────────────────────────────────────────────────
        [Header("Arrow")]
        [SerializeField, Tooltip("Animated arrow indicator pointing at the highlighted target.")]
        private GameObject _arrowIndicator;

        [SerializeField, Tooltip("Distance the arrow bounces in pixels.")]
        private float _arrowBounceAmount = 10f;

        [SerializeField, Tooltip("Speed of the arrow bounce animation.")]
        private float _arrowBounceSpeed = 2f;

        // ─────────────────────────────────────────────────────────────────
        //  Finger Cursor
        // ─────────────────────────────────────────────────────────────────
        [Header("Finger Cursor")]
        [SerializeField, Tooltip("Animated finger cursor used to demonstrate tap gestures.")]
        private GameObject _fingerCursor;

        [SerializeField, Tooltip("If true, the finger tap animation will play automatically when shown.")]
        private bool _showFingerAnimation = true;

        [SerializeField, Tooltip("Duration of a single finger tap animation cycle in seconds.")]
        private float _fingerTapDuration = 0.5f;

        // ─────────────────────────────────────────────────────────────────
        //  Internal State
        // ─────────────────────────────────────────────────────────────────
        private CanvasGroup _canvasGroup;
        private Coroutine _highlightAnimCoroutine;
        private Coroutine _fingerTapCoroutine;
        private Coroutine _arrowBounceCoroutine;
        private RectTransform _tooltipRect;
        private Vector2 _currentHighlightPosition;
        private Vector2 _currentHighlightSize;
        private bool _isHighlightActive;
        private GraphicRaycaster _raycaster;

        // ─────────────────────────────────────────────────────────────────
        //  Lifecycle
        // ─────────────────────────────────────────────────────────────────
        private void Awake()
        {
            _canvasGroup = GetComponent<CanvasGroup>();
            if (_canvasGroup == null)
                _canvasGroup = gameObject.AddComponent<CanvasGroup>();

            if (_overlayCanvas == null)
                _overlayCanvas = GetComponent<Canvas>();

            _raycaster = GetComponent<GraphicRaycaster>();

            if (_highlightRect != null)
            {
                _highlightRect.gameObject.SetActive(false);
                _currentHighlightPosition = _highlightRect.anchoredPosition;
                _currentHighlightSize = _highlightRect.sizeDelta;
            }

            if (_tooltipPanel != null)
            {
                _tooltipRect = _tooltipPanel.GetComponent<RectTransform>();
                _tooltipPanel.SetActive(false);
            }

            if (_arrowIndicator != null)
                _arrowIndicator.SetActive(false);

            if (_fingerCursor != null)
                _fingerCursor.SetActive(false);

            if (_darkenBackground != null)
                _darkenBackground.color = new Color(0f, 0f, 0f, 0f);

            if (_tooltipNextButton != null)
                _tooltipNextButton.onClick.AddListener(OnNextClicked);

            if (_tooltipSkipButton != null)
                _tooltipSkipButton.onClick.AddListener(OnSkipClicked);
        }

        private void OnDestroy()
        {
            if (_tooltipNextButton != null)
                _tooltipNextButton.onClick.RemoveListener(OnNextClicked);
            if (_tooltipSkipButton != null)
                _tooltipSkipButton.onClick.RemoveListener(OnSkipClicked);
        }

        private void OnNextClicked()
        {
            OnboardingManager.Instance?.CompleteCurrentStep();
        }

        private void OnSkipClicked()
        {
            OnboardingManager.Instance?.SkipOnboarding();
        }

        // ─────────────────────────────────────────────────────────────────
        //  Public API — Highlights
        // ─────────────────────────────────────────────────────────────────
        /// <summary>
        /// Highlights a UI element (RectTransform) and displays a tooltip.
        /// </summary>
        /// <param name="target">The RectTransform to highlight.</param>
        /// <param name="title">Tooltip title text.</param>
        /// <param name="description">Tooltip description/instruction text.</param>
        public void ShowHighlight(RectTransform target, string title, string description)
        {
            if (target == null) return;

            Vector2 screenPos = RectTransformUtility.WorldToScreenPoint(_overlayCanvas.worldCamera ?? Camera.main, target.position);
            Vector2 size = target.rect.size;
            size.x *= target.lossyScale.x;
            size.y *= target.lossyScale.y;

            ShowHighlight(screenPos, size, title, description);

            // Start tracking the target in case it moves.
            if (_highlightAnimCoroutine != null)
                StopCoroutine(_highlightAnimCoroutine);
            _highlightAnimCoroutine = StartCoroutine(AnimateHighlight(target));
        }

        /// <summary>
        /// Highlights a screen-space region and displays a tooltip.
        /// </summary>
        /// <param name="screenPosition">Center of the highlight in screen coordinates.</param>
        /// <param name="size">Width and height of the highlight area.</param>
        /// <param name="title">Tooltip title text.</param>
        /// <param name="description">Tooltip description/instruction text.</param>
        public void ShowHighlight(Vector2 screenPosition, Vector2 size, string title, string description)
        {
            _isHighlightActive = true;
            ShowOverlay();

            Vector2 paddedSize = size + Vector2.one * _highlightPadding * 2f;

            _currentHighlightPosition = screenPosition;
            _currentHighlightSize = paddedSize;

            if (_highlightRect != null)
            {
                _highlightRect.gameObject.SetActive(true);
                _highlightRect.sizeDelta = paddedSize;
                _highlightRect.position = screenPosition;
            }

            if (_highlightBorder != null)
            {
                _highlightBorder.gameObject.SetActive(true);
                _highlightBorder.color = _highlightColor;
            }

            PositionTooltipAt(screenPosition, paddedSize);
            SetTooltipText(title, description);
            ShowTooltip();

            // Start arrow pointing at the highlight.
            if (_arrowIndicator != null)
            {
                _arrowIndicator.SetActive(true);
                _arrowIndicator.transform.position = screenPosition;
                if (_arrowBounceCoroutine != null)
                    StopCoroutine(_arrowBounceCoroutine);
                _arrowBounceCoroutine = StartCoroutine(ArrowBounceAnimation(screenPosition));
            }
        }

        /// <summary>
        /// Highlights a world-space position (e.g., an object in the 3D world)
        /// and displays a tooltip anchored near it.
        /// </summary>
        /// <param name="worldPosition">World-space position to highlight.</param>
        /// <param name="radius">Radius of the highlight circle in world units.</param>
        /// <param name="title">Tooltip title text.</param>
        /// <param name="description">Tooltip description/instruction text.</param>
        public void ShowWorldHighlight(Vector3 worldPosition, float radius, string title, string description)
        {
            Camera cam = _overlayCanvas.worldCamera ?? Camera.main;
            if (cam == null) return;

            Vector3 viewportPos = cam.WorldToViewportPoint(worldPosition);
            if (viewportPos.z < 0) return; // Behind camera.

            Vector2 screenPos = new Vector2(viewportPos.x * Screen.width, viewportPos.y * Screen.height);

            // Estimate screen size from world radius.
            float worldDiameter = radius * 2f;
            float screenDiameter = worldDiameter / (cam.orthographic ? cam.orthographicSize * 2f / Screen.height : 1f) * Screen.height;
            Vector2 size = new Vector2(screenDiameter, screenDiameter);

            ShowHighlight(screenPos, size, title, description);
        }

        /// <summary>
        /// Smoothly moves the highlight to a new UI target.
        /// </summary>
        /// <param name="newTarget">The new RectTransform to highlight.</param>
        public void MoveHighlightTo(RectTransform newTarget)
        {
            if (newTarget == null) return;
            ShowHighlight(newTarget, _tooltipTitle?.text, _tooltipDescription?.text);
        }

        /// <summary>
        /// Hides the highlight region, tooltip, arrow, and finger cursor.
        /// </summary>
        public void HideHighlight()
        {
            _isHighlightActive = false;

            if (_highlightRect != null)
                _highlightRect.gameObject.SetActive(false);
            if (_highlightBorder != null)
                _highlightBorder.gameObject.SetActive(false);

            HideTooltip();
            HideFingerTap();

            if (_arrowIndicator != null)
                _arrowIndicator.SetActive(false);

            if (_highlightAnimCoroutine != null)
            {
                StopCoroutine(_highlightAnimCoroutine);
                _highlightAnimCoroutine = null;
            }
            if (_arrowBounceCoroutine != null)
            {
                StopCoroutine(_arrowBounceCoroutine);
                _arrowBounceCoroutine = null;
            }
        }

        // ─────────────────────────────────────────────────────────────────
        //  Public API — Finger Cursor
        // ─────────────────────────────────────────────────────────────────
        /// <summary>
        /// Shows an animated finger tap cursor at the specified screen position.
        /// </summary>
        /// <param name="position">Screen position for the finger cursor.</param>
        public void ShowFingerTap(Vector2 position)
        {
            if (_fingerCursor == null) return;
            _fingerCursor.SetActive(true);
            _fingerCursor.transform.position = position;

            if (_showFingerAnimation)
            {
                if (_fingerTapCoroutine != null)
                    StopCoroutine(_fingerTapCoroutine);
                _fingerTapCoroutine = StartCoroutine(FingerTapAnimation(position));
            }
        }

        /// <summary>
        /// Hides the finger tap cursor and stops its animation.
        /// </summary>
        public void HideFingerTap()
        {
            if (_fingerCursor != null)
                _fingerCursor.SetActive(false);

            if (_fingerTapCoroutine != null)
            {
                StopCoroutine(_fingerTapCoroutine);
                _fingerTapCoroutine = null;
            }
        }

        // ─────────────────────────────────────────────────────────────────
        //  Public API — Interaction Blocking
        // ─────────────────────────────────────────────────────────────────
        /// <summary>
        /// Enables or disables all interaction with the tutorial overlay.
        /// </summary>
        /// <param name="enable">True to enable interaction; false to block it.</param>
        public void EnableInteraction(bool enable)
        {
            if (_canvasGroup != null)
                _canvasGroup.blocksRaycasts = enable;
        }

        /// <summary>
        /// Blocks all UI interactions except for the specified allowed target.
        /// Useful when you want the player to only interact with one specific button.
        /// </summary>
        /// <param name="allowedTarget">The RectTransform that should remain interactable.</param>
        public void BlockAllExcept(RectTransform allowedTarget)
        {
            // Implementation note: In a full system you would use a custom
            // raycast filter or a transparent overlay with a hole cut out.
            // For this architecture, we enable interaction on the overlay and
            // rely on the caller to handle specific element passthrough.
            if (_canvasGroup != null)
                _canvasGroup.blocksRaycasts = true;
        }

        /// <summary>
        /// Removes all interaction blocking and restores normal UI behavior.
        /// </summary>
        public void UnblockAll()
        {
            if (_canvasGroup != null)
                _canvasGroup.blocksRaycasts = false;
            HideOverlay();
        }

        // ─────────────────────────────────────────────────────────────────
        //  Private Animation Coroutines
        // ─────────────────────────────────────────────────────────────────
        private IEnumerator AnimateHighlight(RectTransform target)
        {
            if (_highlightRect == null || target == null) yield break;

            while (_isHighlightActive && target != null)
            {
                Vector2 screenPos = RectTransformUtility.WorldToScreenPoint(
                    _overlayCanvas.worldCamera ?? Camera.main, target.position);

                Vector2 size = target.rect.size;
                size.x *= target.lossyScale.x;
                size.y *= target.lossyScale.y;
                size += Vector2.one * _highlightPadding * 2f;

                // Smooth lerp toward the target.
                _highlightRect.position = Vector3.Lerp(_highlightRect.position, screenPos, Time.deltaTime * 10f);
                _highlightRect.sizeDelta = Vector2.Lerp(_highlightRect.sizeDelta, size, Time.deltaTime * 10f);

                // Reposition arrow.
                if (_arrowIndicator != null && _arrowIndicator.activeInHierarchy)
                    _arrowIndicator.transform.position = screenPos;

                yield return null;
            }
        }

        private void PositionTooltipAt(Vector2 screenPosition, Vector2 highlightSize)
        {
            if (_tooltipRect == null) return;

            // Determine best position (above, below, left, right) based on screen edges.
            Vector2 tooltipPos = screenPosition;
            float offset = highlightSize.y * 0.5f + _tooltipOffset;

            if (screenPosition.y + offset + 150f < Screen.height)
            {
                // Place above.
                tooltipPos.y += offset;
            }
            else
            {
                // Place below.
                tooltipPos.y -= offset;
            }

            _tooltipRect.position = tooltipPos;
        }

        private void PositionTooltip(RectTransform target)
        {
            if (target == null || _tooltipRect == null) return;
            Vector2 screenPos = RectTransformUtility.WorldToScreenPoint(_overlayCanvas.worldCamera ?? Camera.main, target.position);
            Vector2 size = target.rect.size;
            size.x *= target.lossyScale.x;
            size.y *= target.lossyScale.y;
            PositionTooltipAt(screenPos, size);
        }

        private IEnumerator FingerTapAnimation(Vector2 position)
        {
            if (_fingerCursor == null) yield break;

            RectTransform fingerRt = _fingerCursor.GetComponent<RectTransform>();
            Vector2 originalPos = position;

            while (_fingerCursor.activeInHierarchy)
            {
                // Down phase.
                float elapsed = 0f;
                while (elapsed < _fingerTapDuration * 0.4f)
                {
                    elapsed += Time.deltaTime;
                    if (fingerRt != null)
                        fingerRt.anchoredPosition = originalPos + Vector2.down * Mathf.Lerp(0f, 10f, elapsed / (_fingerTapDuration * 0.4f));
                    yield return null;
                }

                // Up phase.
                elapsed = 0f;
                while (elapsed < _fingerTapDuration * 0.4f)
                {
                    elapsed += Time.deltaTime;
                    if (fingerRt != null)
                        fingerRt.anchoredPosition = originalPos + Vector2.down * Mathf.Lerp(10f, 0f, elapsed / (_fingerTapDuration * 0.4f));
                    yield return null;
                }

                // Pause between taps.
                yield return new WaitForSeconds(_fingerTapDuration * 0.2f);
            }
        }

        private IEnumerator ArrowBounceAnimation(Vector2 basePosition)
        {
            if (_arrowIndicator == null) yield break;

            RectTransform arrowRt = _arrowIndicator.GetComponent<RectTransform>();
            float time = 0f;

            while (_arrowIndicator.activeInHierarchy)
            {
                time += Time.deltaTime * _arrowBounceSpeed;
                float offset = Mathf.Sin(time) * _arrowBounceAmount;
                if (arrowRt != null)
                    arrowRt.anchoredPosition = basePosition + Vector2.up * offset;
                yield return null;
            }
        }

        // ─────────────────────────────────────────────────────────────────
        //  Tooltip Helpers
        // ─────────────────────────────────────────────────────────────────
        private void SetTooltipText(string title, string description)
        {
            if (_tooltipTitle != null)
                _tooltipTitle.text = title ?? string.Empty;
            if (_tooltipDescription != null)
                _tooltipDescription.text = description ?? string.Empty;
        }

        private void ShowTooltip()
        {
            if (_tooltipPanel != null)
                _tooltipPanel.SetActive(true);
        }

        private void HideTooltip()
        {
            if (_tooltipPanel != null)
                _tooltipPanel.SetActive(false);
        }

        // ─────────────────────────────────────────────────────────────────
        //  Overlay Visibility
        // ─────────────────────────────────────────────────────────────────
        private void ShowOverlay()
        {
            if (_canvasGroup != null)
            {
                _canvasGroup.alpha = 1f;
                _canvasGroup.blocksRaycasts = true;
                _canvasGroup.interactable = true;
            }

            if (_darkenBackground != null)
            {
                _darkenBackground.gameObject.SetActive(true);
                StartCoroutine(FadeDarken(_darkenAlpha));
            }
        }

        private void HideOverlay()
        {
            if (_darkenBackground != null)
                StartCoroutine(FadeDarken(0f, true));

            if (_canvasGroup != null)
            {
                _canvasGroup.alpha = 0f;
                _canvasGroup.blocksRaycasts = false;
                _canvasGroup.interactable = false;
            }
        }

        private IEnumerator FadeDarken(float targetAlpha, bool deactivateAfter = false)
        {
            if (_darkenBackground == null) yield break;

            Color c = _darkenBackground.color;
            float startAlpha = c.a;
            float elapsed = 0f;
            const float DURATION = 0.25f;

            while (elapsed < DURATION)
            {
                elapsed += Time.deltaTime;
                c.a = Mathf.Lerp(startAlpha, targetAlpha, elapsed / DURATION);
                _darkenBackground.color = c;
                yield return null;
            }

            c.a = targetAlpha;
            _darkenBackground.color = c;

            if (deactivateAfter && targetAlpha <= 0.01f)
                _darkenBackground.gameObject.SetActive(false);
        }

        // ─────────────────────────────────────────────────────────────────
        //  Debug Helpers
        // ─────────────────────────────────────────────────────────────────
        /// <summary>
        /// Debug helper that highlights the center of the screen.
        /// </summary>
        [ContextMenu("Test Center Highlight")]
        public void DebugTestCenterHighlight()
        {
            ShowHighlight(
                new Vector2(Screen.width * 0.5f, Screen.height * 0.5f),
                new Vector2(200f, 100f),
                "Test Title",
                "This is a test description for the tutorial overlay system."
            );
        }

        /// <summary>
        /// Debug helper that hides the highlight immediately.
        /// </summary>
        [ContextMenu("Hide Highlight")]
        public void DebugHideHighlight()
        {
            HideHighlight();
        }
    }
}
