using System;
using System.Collections;
using System.Text;
using TMPro;
using UnityEngine;

namespace KawaiiCoolIsland.Chat
{
    /// <summary>
    /// Displays an animated "player is typing" indicator above a player character.
    /// Features animated cycling dots, player name display, fade animations, and auto-timeout.
    /// </summary>
    [RequireComponent(typeof(CanvasGroup))]
    public class TypingIndicator : MonoBehaviour
    {
        #region Header: References
        [Header("References")]
        [Tooltip("TMP_Text for displaying the player name (e.g., 'PlayerName is typing').")]
        public TMP_Text NameText;

        [Tooltip("TMP_Text for the animated dots (e.g., '...').")]
        public TMP_Text DotsText;

        [Tooltip("CanvasGroup for fade in/out control.")]
        public CanvasGroup CanvasGroup;
        #endregion

        #region Header: Animation
        [Header("Animation")]
        [Tooltip("Speed at which the dots cycle (seconds per dot change).")]
        public float DotCycleSpeed = 0.5f;

        [Tooltip("Maximum number of dots to display (cycles from 0 to this value).")]
        public int MaxDots = 3;

        [Tooltip("Duration of the fade in/out animation in seconds.")]
        public float FadeDuration = 0.2f;

        [Tooltip("Animation curve for the fade transitions.")]
        public AnimationCurve FadeCurve = AnimationCurve.EaseInOut(0f, 0f, 1f, 1f);
        #endregion

        #region Header: Settings
        [Header("Settings")]
        [Tooltip("Format string for the name text. {0} = player name.")]
        public string NameFormat = "{0}";

        [Tooltip("Color for the player name text.")]
        public Color NameColor = new Color(0.7f, 0.9f, 1f);

        [Tooltip("Color for the dots.")]
        public Color DotsColor = Color.white;

        [Tooltip("Base string used for the dots animation (e.g., '.').")]
        public string DotCharacter = ".";

        [Tooltip("Whether to show the player name above the dots.")]
        public bool ShowPlayerName = true;
        #endregion

        #region Private Fields
        private string _playerName;
        private int _currentDots;
        private float _lastDotUpdate;
        private Coroutine _timeoutCoroutine;
        private Coroutine _fadeCoroutine;
        private Coroutine _dotCycleCoroutine;
        private float _timeoutDuration = 5f;
        private bool _isVisible;
        private Transform _targetTransform;
        private Camera _mainCamera;
        private Vector3 _worldOffset = new(0, 2.2f, 0);
        #endregion

        #region Public Properties
        /// <summary>
        /// The player name currently displayed in this indicator.
        /// </summary>
        public string PlayerName => _playerName;

        /// <summary>
        /// Whether the typing indicator is currently visible.
        /// </summary>
        public bool IsVisible => _isVisible;

        /// <summary>
        /// Whether the indicator has an active timeout running.
        /// </summary>
        public bool HasActiveTimeout => _timeoutCoroutine != null;
        #endregion

        #region Public Events
        /// <summary>
        /// Fired when the typing indicator is hidden due to timeout.
        /// </summary>
        public event Action OnTimeout;

        /// <summary>
        /// Fired when the typing indicator becomes visible.
        /// </summary>
        public event Action OnShown;

        /// <summary>
        /// Fired when the typing indicator is hidden.
        /// </summary>
        public event Action OnHidden;
        #endregion

        #region Unity Lifecycle
        private void Awake()
        {
            if (CanvasGroup == null)
                CanvasGroup = GetComponent<CanvasGroup>();

            // Initialize text components
            if (NameText != null)
            {
                NameText.color = NameColor;
            }
            if (DotsText != null)
            {
                DotsText.color = DotsColor;
            }

            CanvasGroup.alpha = 0f;
            _isVisible = false;
        }

        private void Start()
        {
            _mainCamera = Camera.main;
        }

        private void LateUpdate()
        {
            UpdatePosition();
        }

        private void OnDisable()
        {
            StopAllCoroutines();
            _timeoutCoroutine = null;
            _fadeCoroutine = null;
            _dotCycleCoroutine = null;
            _isVisible = false;
        }

        private void OnDestroy()
        {
            StopAllCoroutines();
        }
        #endregion

        #region Public Methods
        /// <summary>
        /// Shows the typing indicator for a specific player.
        /// </summary>
        /// <param name="playerName">Name of the player who is typing.</param>
        /// <param name="timeout">Seconds before the indicator auto-hides.</param>
        public void Show(string playerName, float timeout = 5f)
        {
            if (string.IsNullOrWhiteSpace(playerName)) return;

            _playerName = playerName;
            _timeoutDuration = timeout;
            _currentDots = 0;
            _lastDotUpdate = Time.time;

            // Update name text
            if (NameText != null)
            {
                NameText.text = string.Format(NameFormat, playerName);
                NameText.gameObject.SetActive(ShowPlayerName);
            }

            // Reset dots
            if (DotsText != null)
            {
                DotsText.text = "";
            }

            // Stop existing coroutines
            StopAllCoroutines();

            // Fade in
            _fadeCoroutine = StartCoroutine(FadeInCoroutine());

            // Start dot cycling
            _dotCycleCoroutine = StartCoroutine(DotCycleCoroutine());

            // Start timeout
            _timeoutCoroutine = StartCoroutine(TimeoutCoroutine(timeout));

            _isVisible = true;
            OnShown?.Invoke();
        }

        /// <summary>
        /// Hides the typing indicator with a fade-out animation.
        /// </summary>
        public void Hide()
        {
            if (!_isVisible) return;

            StopAllCoroutines();
            _timeoutCoroutine = null;
            _dotCycleCoroutine = null;

            _fadeCoroutine = StartCoroutine(FadeOutCoroutine());
        }

        /// <summary>
        /// Immediately hides the typing indicator without animation.
        /// </summary>
        public void HideImmediate()
        {
            StopAllCoroutines();
            _timeoutCoroutine = null;
            _dotCycleCoroutine = null;
            CanvasGroup.alpha = 0f;
            _isVisible = false;
            OnHidden?.Invoke();
        }

        /// <summary>
        /// Refreshes the timeout timer. Call this when a new typing signal is received.
        /// </summary>
        /// <param name="timeout">Seconds before the indicator auto-hides.</param>
        public void RefreshTimeout(float timeout = 5f)
        {
            _timeoutDuration = timeout;

            // Restart timeout coroutine
            if (_timeoutCoroutine != null)
            {
                StopCoroutine(_timeoutCoroutine);
            }
            _timeoutCoroutine = StartCoroutine(TimeoutCoroutine(timeout));
        }

        /// <summary>
        /// Sets the world-space target transform that the indicator will follow.
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
        /// <param name="offset">The offset vector.</param>
        public void SetWorldOffset(Vector3 offset)
        {
            _worldOffset = offset;
        }

        /// <summary>
        /// Updates the main camera reference.
        /// </summary>
        public void RefreshCamera()
        {
            _mainCamera = Camera.main;
        }
        #endregion

        #region Private Methods
        /// <summary>
        /// Updates the indicator position to follow the target in world space.
        /// </summary>
        private void UpdatePosition()
        {
            if (_targetTransform == null || _mainCamera == null)
            {
                // Hide if no target
                if (_isVisible && CanvasGroup.alpha > 0)
                {
                    CanvasGroup.alpha = 0f;
                }
                return;
            }

            Vector3 worldPosition = _targetTransform.position + _worldOffset;
            Vector3 screenPosition = _mainCamera.WorldToScreenPoint(worldPosition);

            // Hide if behind camera
            if (screenPosition.z < 0)
            {
                CanvasGroup.alpha = 0f;
                return;
            }

            // Position the indicator
            if (transform.parent is RectTransform parentRect)
            {
                Vector2 canvasPos;
                RectTransformUtility.ScreenPointToLocalPointInRectangle(
                    parentRect, screenPosition, null, out canvasPos);
                transform.localPosition = canvasPos;
            }
            else
            {
                transform.position = screenPosition;
            }

            // Scale based on distance
            float distance = Vector3.Distance(_mainCamera.transform.position, _targetTransform.position);
            float scale = Mathf.Clamp(10f / distance, 0.5f, 1.5f);
            transform.localScale = Vector3.one * scale;
        }

        /// <summary>
        /// Coroutine that cycles the animated dots (., .., ..., .., ., etc.).
        /// </summary>
        private IEnumerator DotCycleCoroutine()
        {
            _currentDots = 0;
            int direction = 1;

            while (true)
            {
                yield return new WaitForSeconds(DotCycleSpeed);

                _currentDots += direction;

                if (_currentDots >= MaxDots)
                {
                    _currentDots = MaxDots;
                    direction = -1;
                }
                else if (_currentDots <= 0)
                {
                    _currentDots = 0;
                    direction = 1;
                }

                UpdateDotsText();
            }
        }

        /// <summary>
        /// Updates the dots text based on current dot count.
        /// </summary>
        private void UpdateDotsText()
        {
            if (DotsText == null) return;

            var sb = new StringBuilder();
            for (int i = 0; i < _currentDots; i++)
            {
                sb.Append(DotCharacter);
            }
            DotsText.text = sb.ToString();
        }

        /// <summary>
        /// Coroutine that auto-hides the indicator after the timeout duration.
        /// </summary>
        private IEnumerator TimeoutCoroutine(float timeout)
        {
            yield return new WaitForSeconds(timeout);

            _timeoutCoroutine = null;
            Hide();
            OnTimeout?.Invoke();
        }

        /// <summary>
        /// Coroutine for the fade-in animation.
        /// </summary>
        private IEnumerator FadeInCoroutine()
        {
            float elapsed = 0f;
            while (elapsed < FadeDuration)
            {
                elapsed += Time.deltaTime;
                float t = FadeCurve.Evaluate(elapsed / FadeDuration);
                CanvasGroup.alpha = Mathf.Clamp01(t);
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

            while (elapsed < FadeDuration)
            {
                elapsed += Time.deltaTime;
                float t = FadeCurve.Evaluate(elapsed / FadeDuration);
                CanvasGroup.alpha = Mathf.Lerp(startAlpha, 0f, t);
                yield return null;
            }

            CanvasGroup.alpha = 0f;
            _isVisible = false;
            OnHidden?.Invoke();
        }
        #endregion
    }
}
