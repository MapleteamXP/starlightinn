using System.Collections;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.OnScreen;

namespace KawaiiCoolIsland.UI
{
    /// <summary>
    /// Handles mobile touch input including on-screen joystick, action buttons,
    /// camera pan, and pinch-to-zoom. Only active on mobile platforms.
    /// Integrates with Unity's Input System package.
    /// </summary>
    public class TouchInputHandler : MonoBehaviour
    {
        #region Inspector - Joystick
        [Header("Joystick")]
        [Tooltip("On-screen joystick control for player movement.")]
        public OnScreenStick MovementJoystick;

        [Tooltip("Container RectTransform for the joystick (shown/hidden based on touch).")]
        public RectTransform JoystickContainer;

        [Tooltip("Seconds to wait before fading out the joystick after release.")]
        public float JoystickFadeOutDelay = 2f;

        [Tooltip("Duration of the joystick fade animation.")]
        public float JoystickFadeDuration = 0.3f;

        [Tooltip("If true, the joystick follows the touch position on the left half of the screen.")]
        public bool JoystickFollowsTouch = true;

        [Tooltip("Screen-space radius within which joystick appears from touch origin.")]
        public float JoystickActivationRadius = 150f;
        #endregion

        #region Inspector - Action Buttons
        [Header("Action Buttons")]
        [Tooltip("On-screen button for interact action.")]
        public OnScreenButton InteractButton;

        [Tooltip("On-screen button for jump action.")]
        public OnScreenButton JumpButton;

        [Tooltip("On-screen button for emote action.")]
        public OnScreenButton EmoteButton;

        [Tooltip("CanvasGroup for the action buttons container (for fade in/out).")]
        public CanvasGroup ActionButtonsCanvasGroup;

        [Tooltip("If true, action buttons fade out when not in use.")]
        public bool FadeActionButtons = false;

        [Tooltip("Delay before action buttons fade out.")]
        public float ActionButtonsFadeDelay = 5f;
        #endregion

        #region Inspector - Camera
        [Header("Camera")]
        [Tooltip("Speed multiplier for camera pan via touch drag on right half of screen.")]
        public float CameraPanSpeed = 1f;

        [Tooltip("Speed multiplier for pinch-to-zoom.")]
        public float CameraZoomSpeed = 0.01f;

        [Tooltip("Minimum camera zoom distance (orthographic size or FOV).")]
        public float CameraZoomMin = 2f;

        [Tooltip("Maximum camera zoom distance (orthographic size or FOV).")]
        public float CameraZoomMax = 15f;

        [Tooltip("If true, invert the camera pan direction.")]
        public bool InvertCameraPan = false;

        [Tooltip("Smoothing factor for camera movement (higher = smoother).")]
        public float CameraSmoothing = 5f;
        #endregion

        #region Inspector - Settings
        [Header("Settings")]
        [Tooltip("If true, disables this component on non-mobile platforms.")]
        public bool DisableOnNonMobile = true;

        [Tooltip("Fraction of screen width considered the 'left side' for joystick (0.5 = left half).")]
        [Range(0.1f, 0.9f)]
        public float LeftScreenFraction = 0.5f;

        [Tooltip("If true, blocks touch input when over UI elements.")]
        public bool BlockTouchOverUI = true;

        [Tooltip("If true, the handler auto-detects mobile and enables/disables accordingly.")]
        public bool AutoDetectPlatform = true;
        #endregion

        #region State
        private Camera _mainCamera;
        private Vector2 _lastTouchPosition;
        private bool _isPanning;
        private bool _isZooming;
        private float _pinchStartDistance;
        private float _cameraStartZoom;
        private float _targetZoom;
        private Vector2 _cameraPanDelta;
        private Vector2 _targetCameraPanDelta;
        private CanvasGroup _joystickCanvasGroup;
        private Coroutine _joystickFadeCoroutine;
        private Coroutine _actionButtonFadeCoroutine;
        private float _lastInteractTime;
        private int _leftSideTouchId = -1;
        private int _rightSideTouchId = -1;
        #endregion

        #region Public Properties
        /// <summary>
        /// Normalized movement input vector from the joystick (-1 to +1 on each axis).
        /// </summary>
        public Vector2 MovementInput { get; private set; }

        /// <summary>
        /// True when the interact button is being held down.
        /// </summary>
        public bool IsInteracting { get; private set; }

        /// <summary>
        /// True when the jump button was pressed this frame.
        /// </summary>
        public bool JumpPressed { get; private set; }

        /// <summary>
        /// True when touch input is currently active.
        /// </summary>
        public bool IsTouchActive => Input.touchCount > 0;

        /// <summary>
        /// True when the camera is being panned.
        /// </summary>
        public bool IsCameraPanning => _isPanning;

        /// <summary>
        /// True when pinch zoom is active.
        /// </summary>
        public bool IsPinchZooming => _isZooming;

        /// <summary>
        /// Current zoom level (normalized 0-1 where 0 = zoomed in, 1 = zoomed out).
        /// </summary>
        public float CurrentZoomLevel { get; private set; }
        #endregion

        #region Events
        /// <summary>
        /// Fired when the joystick is activated by touch.
        /// </summary>
        public event System.Action OnJoystickActivated;

        /// <summary>
        /// Fired when the joystick is deactivated.
        /// </summary>
        public event System.Action OnJoystickDeactivated;

        /// <summary>
        /// Fired when a camera pan gesture begins.
        /// </summary>
        public event System.Action OnCameraPanStarted;

        /// <summary>
        /// Fired when a camera pan gesture ends.
        /// </summary>
        public event System.Action OnCameraPanEnded;

        /// <summary>
        /// Fired when pinch zoom begins.
        /// </summary>
        public event System.Action OnPinchZoomStarted;

        /// <summary>
        /// Fired when pinch zoom ends.
        /// </summary>
        public event System.Action OnPinchZoomEnded;
        #endregion

        #region Unity Lifecycle
        private void Awake()
        {
            // Cache main camera
            _mainCamera = Camera.main;

            // Get or add CanvasGroup for joystick
            if (JoystickContainer != null)
            {
                _joystickCanvasGroup = JoystickContainer.GetComponent<CanvasGroup>();
                if (_joystickCanvasGroup == null)
                {
                    _joystickCanvasGroup = JoystickContainer.gameObject.AddComponent<CanvasGroup>();
                }
                _joystickCanvasGroup.alpha = 0f;
            }

            // Hide action buttons initially on mobile until needed
            if (ActionButtonsCanvasGroup != null)
            {
                ActionButtonsCanvasGroup.alpha = FadeActionButtons ? 0.5f : 1f;
            }
        }

        private void Start()
        {
            if (AutoDetectPlatform)
            {
                bool isMobile = IsMobilePlatform();
                if (!isMobile && DisableOnNonMobile)
                {
                    enabled = false;
                    if (JoystickContainer != null)
                        JoystickContainer.gameObject.SetActive(false);
                    if (ActionButtonsCanvasGroup != null)
                        ActionButtonsCanvasGroup.gameObject.SetActive(false);
                    Debug.Log("[TouchInputHandler] Disabled - not on mobile platform.");
                    return;
                }
            }

            if (_mainCamera != null)
            {
                _targetZoom = _mainCamera.orthographic ? _mainCamera.orthographicSize : _mainCamera.fieldOfView;
            }
        }

        private void Update()
        {
            // Reset per-frame states
            JumpPressed = false;

            // Only process touch input on mobile
#if !UNITY_ANDROID && !UNITY_IOS && !UNITY_EDITOR
            if (DisableOnNonMobile) return;
#endif
            if (Input.touchCount == 0)
            {
                HandleNoTouches();
                return;
            }

            HandleTouchMovement();
            HandleTouchCamera();
            HandlePinchZoom();
        }

        private void LateUpdate()
        {
            // Smooth camera zoom
            if (_mainCamera != null && _isZooming)
            {
                if (_mainCamera.orthographic)
                {
                    _mainCamera.orthographicSize = Mathf.Lerp(_mainCamera.orthographicSize, _targetZoom, Time.deltaTime * CameraSmoothing);
                }
                else
                {
                    _mainCamera.fieldOfView = Mathf.Lerp(_mainCamera.fieldOfView, _targetZoom, Time.deltaTime * CameraSmoothing);
                }
            }
        }
        #endregion

        #region Touch Handling
        private void HandleTouchMovement()
        {
            if (Input.touchCount == 0) return;

            // Find a touch on the left side of the screen for joystick
            Touch? leftTouch = null;
            for (int i = 0; i < Input.touchCount; i++)
            {
                Touch touch = Input.GetTouch(i);
                if (touch.position.x < Screen.width * LeftScreenFraction)
                {
                    if (touch.phase == TouchPhase.Began || touch.phase == TouchPhase.Moved || touch.phase == TouchPhase.Stationary)
                    {
                        leftTouch = touch;
                        _leftSideTouchId = touch.fingerId;
                        break;
                    }
                }
            }

            if (leftTouch.HasValue)
            {
                Touch touch = leftTouch.Value;

                // Check if touch is over UI
                if (BlockTouchOverUI && IsTouchOverUI(touch.position))
                    return;

                ShowJoystick(touch.position);

                // Update joystick position to follow touch if enabled
                if (JoystickFollowsTouch && MovementJoystick != null)
                {
                    // The OnScreenStick handles the actual movement vector
                    // We just position the visual container
                }
            }
            else
            {
                _leftSideTouchId = -1;
                HideJoystick();
            }
        }

        private void HandleTouchCamera()
        {
            if (Input.touchCount == 0) return;

            // Find a touch on the right side for camera panning
            Touch? rightTouch = null;
            for (int i = 0; i < Input.touchCount; i++)
            {
                Touch touch = Input.GetTouch(i);
                if (touch.position.x >= Screen.width * LeftScreenFraction && touch.fingerId != _leftSideTouchId)
                {
                    if (touch.phase == TouchPhase.Began || touch.phase == TouchPhase.Moved || touch.phase == TouchPhase.Stationary)
                    {
                        rightTouch = touch;
                        _rightSideTouchId = touch.fingerId;
                        break;
                    }
                }
            }

            if (rightTouch.HasValue)
            {
                Touch touch = rightTouch.Value;

                // Check if touch is over UI
                if (BlockTouchOverUI && IsTouchOverUI(touch.position))
                    return;

                if (touch.phase == TouchPhase.Began)
                {
                    _isPanning = true;
                    _lastTouchPosition = touch.position;
                    OnCameraPanStarted?.Invoke();
                }
                else if (touch.phase == TouchPhase.Moved && _isPanning)
                {
                    Vector2 delta = touch.position - _lastTouchPosition;
                    _lastTouchPosition = touch.position;

                    float invert = InvertCameraPan ? -1f : 1f;
                    _targetCameraPanDelta = new Vector2(
                        delta.x * CameraPanSpeed * invert,
                        delta.y * CameraPanSpeed * invert
                    );

                    // Apply camera pan
                    if (_mainCamera != null)
                    {
                        Vector3 pan = new Vector3(-_targetCameraPanDelta.x, -_targetCameraPanDelta.y, 0f);
                        pan *= Time.deltaTime;
                        _mainCamera.transform.position += pan;
                    }
                }
            }
            else
            {
                if (_isPanning)
                {
                    _isPanning = false;
                    _rightSideTouchId = -1;
                    OnCameraPanEnded?.Invoke();
                }
            }
        }

        private void HandlePinchZoom()
        {
            if (Input.touchCount < 2)
            {
                if (_isZooming)
                {
                    _isZooming = false;
                    OnPinchZoomEnded?.Invoke();
                }
                return;
            }

            Touch touch0 = Input.GetTouch(0);
            Touch touch1 = Input.GetTouch(1);

            if (touch0.phase == TouchPhase.Began || touch1.phase == TouchPhase.Began)
            {
                _pinchStartDistance = Vector2.Distance(touch0.position, touch1.position);
                _cameraStartZoom = _mainCamera != null
                    ? (_mainCamera.orthographic ? _mainCamera.orthographicSize : _mainCamera.fieldOfView)
                    : 10f;
                _isZooming = true;
                _targetZoom = _cameraStartZoom;
                OnPinchZoomStarted?.Invoke();
            }
            else if ((touch0.phase == TouchPhase.Moved || touch1.phase == TouchPhase.Moved) && _isZooming)
            {
                float currentDistance = Vector2.Distance(touch0.position, touch1.position);
                if (Mathf.Abs(_pinchStartDistance) > 0.001f)
                {
                    float scaleFactor = currentDistance / _pinchStartDistance;
                    _targetZoom = _cameraStartZoom / scaleFactor;
                    _targetZoom = Mathf.Clamp(_targetZoom, CameraZoomMin, CameraZoomMax);
                    _pinchStartDistance = currentDistance;
                    _cameraStartZoom = _targetZoom;

                    // Apply zoom immediately for responsiveness
                    if (_mainCamera != null)
                    {
                        if (_mainCamera.orthographic)
                        {
                            _mainCamera.orthographicSize = _targetZoom;
                        }
                        else
                        {
                            _mainCamera.fieldOfView = _targetZoom;
                        }
                    }

                    // Calculate normalized zoom level
                    CurrentZoomLevel = Mathf.InverseLerp(CameraZoomMin, CameraZoomMax, _targetZoom);
                }
            }
        }

        private void HandleNoTouches()
        {
            MovementInput = Vector2.zero;
            _leftSideTouchId = -1;
            _rightSideTouchId = -1;

            if (_isPanning)
            {
                _isPanning = false;
                OnCameraPanEnded?.Invoke();
            }

            if (_isZooming)
            {
                _isZooming = false;
                OnPinchZoomEnded?.Invoke();
            }
        }
        #endregion

        #region Joystick Visuals
        private void ShowJoystick(Vector2 screenPosition)
        {
            if (JoystickContainer == null) return;

            // Cancel any pending fade out
            if (_joystickFadeCoroutine != null)
            {
                StopCoroutine(_joystickFadeCoroutine);
                _joystickFadeCoroutine = null;
            }

            // Position joystick at touch point (clamped to left side)
            Vector2 anchoredPos;
            RectTransformUtility.ScreenPointToLocalPointInRectangle(
                JoystickContainer.parent as RectTransform,
                screenPosition,
                null,
                out anchoredPos);

            JoystickContainer.anchoredPosition = anchoredPos;

            // Fade in
            if (_joystickCanvasGroup != null)
            {
                _joystickCanvasGroup.alpha = 1f;
            }

            OnJoystickActivated?.Invoke();
        }

        private void HideJoystick()
        {
            if (JoystickContainer == null || _joystickCanvasGroup == null) return;

            // Start delayed fade out
            if (_joystickFadeCoroutine != null)
                StopCoroutine(_joystickFadeCoroutine);

            _joystickFadeCoroutine = StartCoroutine(FadeJoystickOut());
            OnJoystickDeactivated?.Invoke();
        }

        private IEnumerator FadeJoystickOut()
        {
            yield return new WaitForSecondsRealtime(JoystickFadeOutDelay);

            float elapsed = 0f;
            float startAlpha = _joystickCanvasGroup.alpha;

            while (elapsed < JoystickFadeDuration)
            {
                elapsed += Time.unscaledDeltaTime;
                _joystickCanvasGroup.alpha = Mathf.Lerp(startAlpha, 0f, elapsed / JoystickFadeDuration);
                yield return null;
            }

            _joystickCanvasGroup.alpha = 0f;
            _joystickFadeCoroutine = null;
        }
        #endregion

        #region Action Button Fade
        private void FadeInActionButtons()
        {
            if (ActionButtonsCanvasGroup == null || !FadeActionButtons) return;

            if (_actionButtonFadeCoroutine != null)
                StopCoroutine(_actionButtonFadeCoroutine);

            _actionButtonFadeCoroutine = StartCoroutine(FadeActionButtonsTo(1f));
            _lastInteractTime = Time.unscaledTime;
        }

        private IEnumerator FadeActionButtonsTo(float targetAlpha)
        {
            float elapsed = 0f;
            float startAlpha = ActionButtonsCanvasGroup.alpha;
            float duration = 0.3f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                ActionButtonsCanvasGroup.alpha = Mathf.Lerp(startAlpha, targetAlpha, elapsed / duration);
                yield return null;
            }

            ActionButtonsCanvasGroup.alpha = targetAlpha;
            _actionButtonFadeCoroutine = null;
        }
        #endregion

        #region Public Methods
        /// <summary>
        /// Manually sets the movement input vector (e.g., from AI or cutscene).
        /// </summary>
        /// <param name="input">Normalized movement input (-1 to 1).</param>
        public void SetMovementInput(Vector2 input)
        {
            MovementInput = Vector2.ClampMagnitude(input, 1f);
        }

        /// <summary>
        /// Enables or disables the joystick input.
        /// </summary>
        /// <param name="enabled">Whether joystick input should be processed.</param>
        public void SetJoystickEnabled(bool enabled)
        {
            if (MovementJoystick != null)
            {
                MovementJoystick.enabled = enabled;
            }
        }

        /// <summary>
        /// Shows or hides the action buttons.
        /// </summary>
        /// <param name="show">True to show, false to hide.</param>
        public void ShowActionButtons(bool show)
        {
            if (ActionButtonsCanvasGroup != null)
            {
                ActionButtonsCanvasGroup.alpha = show ? 1f : 0f;
                ActionButtonsCanvasGroup.blocksRaycasts = show;
                ActionButtonsCanvasGroup.interactable = show;
            }
        }

        /// <summary>
        /// Sets the camera reference for pan and zoom operations.
        /// </summary>
        /// <param name="camera">The camera to control.</param>
        public void SetCamera(Camera camera)
        {
            _mainCamera = camera;
            if (_mainCamera != null)
            {
                _targetZoom = _mainCamera.orthographic ? _mainCamera.orthographicSize : _mainCamera.fieldOfView;
            }
        }
        #endregion

        #region Private Helpers
        private bool IsTouchOverUI(Vector2 screenPosition)
        {
            PointerEventData pointerData = new PointerEventData(EventSystem.current)
            {
                position = screenPosition
            };

            var results = new System.Collections.Generic.List<RaycastResult>();
            EventSystem.current.RaycastAll(pointerData, results);

            // Check if the top result is a UI element (not the joystick itself)
            if (results.Count > 0)
            {
                // Allow touches on the joystick
                foreach (var result in results)
                {
                    if (result.gameObject.transform.IsChildOf(JoystickContainer))
                        return false;
                }
                return true;
            }

            return false;
        }

        private bool IsMobilePlatform()
        {
#if UNITY_ANDROID || UNITY_IOS
            return true;
#elif UNITY_EDITOR
            // In editor, check based on aspect ratio
            float aspect = (float)Screen.width / Screen.height;
            return aspect < 1.0f;
#else
            return false;
#endif
        }
        #endregion
    }
}
