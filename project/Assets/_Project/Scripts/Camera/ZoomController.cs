using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace KawaiiCool.Camera
{
    /// <summary>
    /// UI controller for camera zoom controls. Handles zoom buttons, slider, and percentage display.
    /// </summary>
    public class ZoomController : MonoBehaviour
    {
        [Header("UI Controls")]
        public GameObject MobileZoomControls;
        public GameObject DesktopZoomControls;
        public Button ZoomInButton;
        public Button ZoomOutButton;
        public Button ZoomResetButton;
        public Slider ZoomSlider;
        public TMP_Text ZoomPercentText;
        
        [Header("Settings")]
        public float ZoomStep = 2f;
        public bool ShowZoomLevel = true;
        public string ZoomFormat = "{0}%";
        public bool HideControlsWhenIdle = true;
        public float IdleHideDelay = 3f;
        public float ControlsFadeSpeed = 5f;
        
        [Header("Platform Detection")]
        public bool AutoDetectPlatform = true;
        public RuntimePlatform MobilePlatformOverride = RuntimePlatform.Android;
        
        private WorldCameraController _cameraController;
        private float _lastInteractionTime;
        private bool _controlsVisible = true;
        private CanvasGroup _mobileCanvasGroup;
        private CanvasGroup _desktopCanvasGroup;
        private bool _isUpdatingSlider;
        private float _currentMobileAlpha = 1f;
        private float _currentDesktopAlpha = 1f;
        private bool _platformIsMobile;
        
        /// <summary>
        /// Called when the script instance is being loaded.
        /// </summary>
        private void Start()
        {
            _cameraController = WorldCameraController.Instance;
            if (_cameraController == null)
            {
                _cameraController = FindObjectOfType<WorldCameraController>();
            }
            
            if (_cameraController == null)
            {
                Debug.LogWarning("[ZoomController] No WorldCameraController found in scene!");
                return;
            }
            
            // Subscribe to camera events
            _cameraController.OnZoomChanged += OnCameraZoomChanged;
            _cameraController.OnCameraMoved += OnCameraMoved;
            
            SetupUI();
            DetectPlatform();
            RefreshZoomDisplay();
            _lastInteractionTime = Time.time;
        }
        
        /// <summary>
        /// Called every frame for UI updates and idle hide behavior.
        /// </summary>
        private void Update()
        {
            if (_cameraController == null) return;
            
            UpdateIdleHide();
            UpdateCanvasGroups();
            
            // Update slider if not being dragged by user
            if (!_isUpdatingSlider && ZoomSlider != null && !ZoomSlider.interactable)
            {
                UpdateSliderFromCamera();
            }
        }
        
        /// <summary>
        /// Called when the behaviour becomes disabled or inactive.
        /// </summary>
        private void OnDisable()
        {
            if (_cameraController != null)
            {
                _cameraController.OnZoomChanged -= OnCameraZoomChanged;
                _cameraController.OnCameraMoved -= OnCameraMoved;
            }
        }
        
        /// <summary>
        /// Sets up all UI button listeners and slider callbacks.
        /// </summary>
        private void SetupUI()
        {
            if (ZoomInButton != null)
            {
                ZoomInButton.onClick.AddListener(OnZoomInClicked);
            }
            
            if (ZoomOutButton != null)
            {
                ZoomOutButton.onClick.AddListener(OnZoomOutClicked);
            }
            
            if (ZoomResetButton != null)
            {
                ZoomResetButton.onClick.AddListener(OnZoomResetClicked);
            }
            
            if (ZoomSlider != null)
            {
                ZoomSlider.onValueChanged.AddListener(OnZoomSliderChanged);
            }
            
            // Get or add canvas groups for fade effects
            if (MobileZoomControls != null)
            {
                _mobileCanvasGroup = MobileZoomControls.GetComponent<CanvasGroup>();
                if (_mobileCanvasGroup == null)
                {
                    _mobileCanvasGroup = MobileZoomControls.AddComponent<CanvasGroup>();
                }
            }
            
            if (DesktopZoomControls != null)
            {
                _desktopCanvasGroup = DesktopZoomControls.GetComponent<CanvasGroup>();
                if (_desktopCanvasGroup == null)
                {
                    _desktopCanvasGroup = DesktopZoomControls.AddComponent<CanvasGroup>();
                }
            }
        }
        
        /// <summary>
        /// Auto-detects the current platform and shows appropriate controls.
        /// </summary>
        private void DetectPlatform()
        {
            if (!AutoDetectPlatform) return;
            
            _platformIsMobile = Application.isMobilePlatform;
            
            if (MobileZoomControls != null)
            {
                MobileZoomControls.SetActive(_platformIsMobile);
            }
            
            if (DesktopZoomControls != null)
            {
                DesktopZoomControls.SetActive(!_platformIsMobile);
            }
        }
        
        /// <summary>
        /// Updates the idle hide behavior for controls.
        /// </summary>
        private void UpdateIdleHide()
        {
            if (!HideControlsWhenIdle) return;
            
            float timeSinceInteraction = Time.time - _lastInteractionTime;
            bool shouldShow = timeSinceInteraction < IdleHideDelay;
            
            if (shouldShow != _controlsVisible)
            {
                _controlsVisible = shouldShow;
            }
        }
        
        /// <summary>
        /// Updates canvas group alpha values for smooth fade in/out.
        /// </summary>
        private void UpdateCanvasGroups()
        {
            float targetAlpha = _controlsVisible ? 1f : 0f;
            
            if (_mobileCanvasGroup != null && MobileZoomControls != null && MobileZoomControls.activeInHierarchy)
            {
                _currentMobileAlpha = Mathf.MoveTowards(_currentMobileAlpha, targetAlpha, Time.deltaTime * ControlsFadeSpeed);
                _mobileCanvasGroup.alpha = _currentMobileAlpha;
                _mobileCanvasGroup.interactable = _controlsVisible;
                _mobileCanvasGroup.blocksRaycasts = _controlsVisible;
            }
            
            if (_desktopCanvasGroup != null && DesktopZoomControls != null && DesktopZoomControls.activeInHierarchy)
            {
                _currentDesktopAlpha = Mathf.MoveTowards(_currentDesktopAlpha, targetAlpha, Time.deltaTime * ControlsFadeSpeed);
                _desktopCanvasGroup.alpha = _currentDesktopAlpha;
                _desktopCanvasGroup.interactable = _controlsVisible;
                _desktopCanvasGroup.blocksRaycasts = _controlsVisible;
            }
        }
        
        /// <summary>
        /// Called when the zoom in button is clicked.
        /// </summary>
        public void OnZoomInClicked()
        {
            if (_cameraController == null) return;
            
            _cameraController.ZoomIn(ZoomStep);
            RecordInteraction();
            
            // Provide haptic feedback on mobile
            if (_platformIsMobile)
            {
                Handheld.Vibrate();
            }
        }
        
        /// <summary>
        /// Called when the zoom out button is clicked.
        /// </summary>
        public void OnZoomOutClicked()
        {
            if (_cameraController == null) return;
            
            _cameraController.ZoomOut(ZoomStep);
            RecordInteraction();
            
            if (_platformIsMobile)
            {
                Handheld.Vibrate();
            }
        }
        
        /// <summary>
        /// Called when the zoom reset button is clicked.
        /// </summary>
        public void OnZoomResetClicked()
        {
            if (_cameraController == null) return;
            
            _cameraController.ResetZoom();
            RecordInteraction();
            
            if (_platformIsMobile)
            {
                Handheld.Vibrate();
            }
        }
        
        /// <summary>
        /// Called when the zoom slider value changes.
        /// </summary>
        /// <param name="value">The slider value (0-1 normalized).</param>
        public void OnZoomSliderChanged(float value)
        {
            if (_cameraController == null) return;
            
            _isUpdatingSlider = true;
            
            float normalizedZoom = Mathf.Clamp01(value);
            float newZoom = Mathf.Lerp(_cameraController.MinZoom, _cameraController.MaxZoom, normalizedZoom);
            _cameraController.SetZoom(newZoom);
            
            RefreshZoomDisplay();
            RecordInteraction();
            
            _isUpdatingSlider = false;
        }
        
        /// <summary>
        /// Records user interaction time to reset idle hide timer.
        /// </summary>
        private void RecordInteraction()
        {
            _lastInteractionTime = Time.time;
            _controlsVisible = true;
        }
        
        /// <summary>
        /// Called when the camera zoom changes externally.
        /// </summary>
        /// <param name="zoom">The new zoom level.</param>
        private void OnCameraZoomChanged(float zoom)
        {
            RefreshZoomDisplay();
        }
        
        /// <summary>
        /// Called when the camera moves.
        /// </summary>
        /// <param name="position">The new camera position.</param>
        private void OnCameraMoved(Vector3 position)
        {
            // Could update position-related UI here if needed
        }
        
        /// <summary>
        /// Refreshes the zoom display (slider, text, etc.).
        /// </summary>
        public void RefreshZoomDisplay()
        {
            if (_cameraController == null) return;
            
            // Update slider
            UpdateSliderFromCamera();
            
            // Update text
            if (ZoomPercentText != null && ShowZoomLevel)
            {
                float percent = CalculateZoomPercent();
                ZoomPercentText.text = string.Format(ZoomFormat, Mathf.RoundToInt(percent));
                ZoomPercentText.gameObject.SetActive(true);
            }
            else if (ZoomPercentText != null)
            {
                ZoomPercentText.gameObject.SetActive(false);
            }
        }
        
        /// <summary>
        /// Updates the slider value based on current camera zoom.
        /// </summary>
        private void UpdateSliderFromCamera()
        {
            if (ZoomSlider == null || _cameraController == null) return;
            
            float normalizedZoom = Mathf.InverseLerp(_cameraController.MinZoom, _cameraController.MaxZoom, _cameraController.CurrentZoom);
            ZoomSlider.SetValueWithoutNotify(normalizedZoom);
        }
        
        /// <summary>
        /// Calculates the current zoom as a percentage (0-100%).
        /// </summary>
        /// <returns>The zoom percentage.</returns>
        private float CalculateZoomPercent()
        {
            if (_cameraController == null) return 100f;
            
            return Mathf.InverseLerp(_cameraController.MinZoom, _cameraController.MaxZoom, _cameraController.CurrentZoom) * 100f;
        }
        
        /// <summary>
        /// Shows the zoom controls.
        /// </summary>
        public void ShowControls()
        {
            _controlsVisible = true;
            _lastInteractionTime = Time.time;
            
            if (_mobileCanvasGroup != null)
            {
                _mobileCanvasGroup.alpha = 1f;
            }
            if (_desktopCanvasGroup != null)
            {
                _desktopCanvasGroup.alpha = 1f;
            }
        }
        
        /// <summary>
        /// Hides the zoom controls.
        /// </summary>
        public void HideControls()
        {
            _controlsVisible = false;
            
            if (_mobileCanvasGroup != null)
            {
                _mobileCanvasGroup.alpha = 0f;
            }
            if (_desktopCanvasGroup != null)
            {
                _desktopCanvasGroup.alpha = 0f;
            }
        }
        
        /// <summary>
        /// Sets the visibility of mobile zoom controls.
        /// </summary>
        /// <param name="visible">Whether mobile controls should be visible.</param>
        public void SetMobileControlsVisible(bool visible)
        {
            if (MobileZoomControls != null)
            {
                MobileZoomControls.SetActive(visible);
            }
        }
        
        /// <summary>
        /// Sets the visibility of desktop zoom controls.
        /// </summary>
        /// <param name="visible">Whether desktop controls should be visible.</param>
        public void SetDesktopControlsVisible(bool visible)
        {
            if (DesktopZoomControls != null)
            {
                DesktopZoomControls.SetActive(visible);
            }
        }
        
        /// <summary>
        /// Sets the zoom step amount for button clicks.
        /// </summary>
        /// <param name="step">The new zoom step value.</param>
        public void SetZoomStep(float step)
        {
            ZoomStep = Mathf.Max(0.1f, step);
        }
        
        /// <summary>
        /// Enables or disables the zoom controls.
        /// </summary>
        /// <param name="enabled">Whether controls are enabled.</param>
        public void SetControlsEnabled(bool enabled)
        {
            if (ZoomInButton != null)
            {
                ZoomInButton.interactable = enabled;
            }
            if (ZoomOutButton != null)
            {
                ZoomOutButton.interactable = enabled;
            }
            if (ZoomResetButton != null)
            {
                ZoomResetButton.interactable = enabled;
            }
            if (ZoomSlider != null)
            {
                ZoomSlider.interactable = enabled;
            }
        }
        
        /// <summary>
        /// Gets whether the current platform is mobile.
        /// </summary>
        public bool IsMobilePlatform => _platformIsMobile;
        
        /// <summary>
        /// Gets whether the controls are currently visible.
        /// </summary>
        public bool AreControlsVisible => _controlsVisible;
    }
}
