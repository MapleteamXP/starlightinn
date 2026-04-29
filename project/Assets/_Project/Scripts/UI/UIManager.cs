using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace KawaiiCoolIsland.UI
{
    /// <summary>
    /// Device type classification for platform-specific UI behavior.
    /// </summary>
    public enum DeviceType
    {
        /// <summary>Mobile phones and tablets (portrait-primary).</summary>
        Mobile,
        /// <summary>Desktop PCs and Macs.</summary>
        Desktop,
        /// <summary>Game consoles (Switch, PlayStation, Xbox).</summary>
        Console
    }

    /// <summary>
    /// Central UI manager for KawaiiCool Island. Handles panel lifecycle,
    /// transitions, device detection, safe areas, and overlay systems.
    /// </summary>
    public class UIManager : MonoBehaviour
    {
        #region Singleton
        private static UIManager _instance;
        public static UIManager Instance
        {
            get
            {
                if (_instance == null)
                {
                    _instance = FindFirstObjectByType<UIManager>();
                    if (_instance == null)
                    {
                        var go = new GameObject("UIManager");
                        _instance = go.AddComponent<UIManager>();
                        DontDestroyOnLoad(go);
                    }
                }
                return _instance;
            }
        }
        #endregion

        #region Inspector - Canvases
        [Header("Canvases")]
        [Tooltip("Main gameplay UI canvas.")]
        public Canvas MainCanvas;

        [Tooltip("Overlay canvas for toasts, notifications, and non-blocking messages.")]
        public Canvas OverlayCanvas;

        [Tooltip("Popup canvas for modal dialogs and blocking popups.")]
        public Canvas PopupCanvas;

        [Tooltip("Tooltip canvas for hover info and contextual hints.")]
        public Canvas TooltipCanvas;
        #endregion

        #region Inspector - Safe Area
        [Header("Safe Area")]
        [Tooltip("Root RectTransform that will be padded to fit within the device safe area.")]
        public RectTransform SafeAreaContainer;
        #endregion

        #region Inspector - Transitions
        [Header("Transitions")]
        [Tooltip("Full-screen fade overlay CanvasGroup for scene/panel transitions.")]
        public CanvasGroup FadeOverlay;

        [Tooltip("Speed multiplier for fade transitions. Higher = faster.")]
        public float FadeSpeed = 8f;
        #endregion

        #region Inspector - Particle Effects
        [Header("Particle Effects")]
        [Tooltip("Particle effect played at cursor position on UI clicks.")]
        public ParticleSystem UIClickEffect;

        [Tooltip("Particle effect played when a popup opens.")]
        public ParticleSystem UIPopupEffect;
        #endregion

        #region Inspector - Canvas Scaler Settings
        [Header("Canvas Scaler Settings")]
        [Tooltip("Reference resolution for mobile portrait mode (1080x1920).")]
        public Vector2 MobileReferenceResolution = new Vector2(1080f, 1920f);

        [Tooltip("Reference resolution for desktop landscape mode (1920x1080).")]
        public Vector2 DesktopReferenceResolution = new Vector2(1920f, 1080f);

        [Tooltip("Match mode for canvas scaler width/height blend.")]
        [Range(0f, 1f)]
        public float MobileMatchWidthOrHeight = 0.5f;

        [Tooltip("Match mode for desktop canvas scaler.")]
        [Range(0f, 1f)]
        public float DesktopMatchWidthOrHeight = 0.5f;
        #endregion

        #region Inspector - Popup Prefabs
        [Header("Popup Prefabs")]
        [Tooltip("Prefab for standard popup dialogs.")]
        public GameObject PopupPrefab;

        [Tooltip("Prefab for toast notifications.")]
        public GameObject ToastPrefab;

        [Tooltip("Prefab for tooltip popups.")]
        public GameObject TooltipPrefab;
        #endregion

        #region Inspector - Social Panels
        [Header("Social Panels")]
        [Tooltip("Friend list panel for managing friends and requests.")]
        public UIPanel FriendListPanel;

        [Tooltip("Player profile viewing panel.")]
        public UIPanel ProfilePanel;

        [Tooltip("Room browser for discovering and joining rooms.")]
        public UIPanel RoomBrowserPanel;

        [Tooltip("Activity feed showing social updates and events.")]
        public UIPanel ActivityFeedPanel;

        [Tooltip("Character creation and onboarding panel.")]
        public UIPanel CharacterCreatorPanel;

        [Tooltip("Settings and preferences panel.")]
        public UIPanel SettingsPanel;

        [Tooltip("Notification center panel.")]
        public UIPanel NotificationPanel;

        [Tooltip("Interaction menu for player-to-player actions.")]
        public UIPanel InteractionMenu;
        #endregion

        #region Panel ID Constants
        /// <summary>Panel ID for the FriendList panel.</summary>
        public const string PANEL_FRIEND_LIST = "FriendList";

        /// <summary>Panel ID for the Profile panel.</summary>
        public const string PANEL_PROFILE = "Profile";

        /// <summary>Panel ID for the RoomBrowser panel.</summary>
        public const string PANEL_ROOM_BROWSER = "RoomBrowser";

        /// <summary>Panel ID for the ActivityFeed panel.</summary>
        public const string PANEL_ACTIVITY_FEED = "ActivityFeed";

        /// <summary>Panel ID for the CharacterCreator panel.</summary>
        public const string PANEL_CHARACTER_CREATOR = "CharacterCreator";

        /// <summary>Panel ID for the Settings panel.</summary>
        public const string PANEL_SETTINGS = "Settings";

        /// <summary>Panel ID for the Notifications panel.</summary>
        public const string PANEL_NOTIFICATIONS = "Notifications";

        /// <summary>Panel ID for the InteractionMenu panel.</summary>
        public const string PANEL_INTERACTION_MENU = "InteractionMenu";
        #endregion

        #region Private State
        private readonly Dictionary<string, UIPanel> _registeredPanels = new();
        private readonly Stack<UIPanel> _panelHistory = new();
        private UIPanel _currentPanel;
        private DeviceType _currentDeviceType;
        private Coroutine _fadeCoroutine;
        private ToastNotification _toastNotification;
        private GameObject _activeTooltip;
        private CanvasScaler _mainCanvasScaler;
        private readonly List<ResponsiveLayout> _responsiveLayouts = new();
        #endregion

        #region Public Properties
        /// <summary>
        /// Current detected device type (Mobile, Desktop, or Console).
        /// </summary>
        public DeviceType CurrentDeviceType => _currentDeviceType;

        /// <summary>
        /// True if current device is classified as mobile.
        /// </summary>
        public bool IsMobile => _currentDeviceType == DeviceType.Mobile;

        /// <summary>
        /// True if current device is desktop or console.
        /// </summary>
        public bool IsDesktop => _currentDeviceType == DeviceType.Desktop || _currentDeviceType == DeviceType.Console;

        /// <summary>
        /// Currently visible panel, or null if none.
        /// </summary>
        public UIPanel CurrentPanel => _currentPanel;

        /// <summary>
        /// True while a panel transition or fade is in progress.
        /// </summary>
        public bool IsTransitioning { get; private set; }

        /// <summary>
        /// Number of panels currently in the navigation history stack.
        /// </summary>
        public int HistoryCount => _panelHistory.Count;

        /// <summary>
        /// Read-only collection of all registered panels.
        /// </summary>
        public IReadOnlyDictionary<string, UIPanel> RegisteredPanels => _registeredPanels;
        #endregion

        #region Events
        /// <summary>
        /// Fired when the device type changes (e.g., orientation switch, platform change).
        /// </summary>
        public event Action<DeviceType> OnDeviceTypeChanged;

        /// <summary>
        /// Fired when a panel finishes its show animation.
        /// </summary>
        public event Action<UIPanel> OnPanelShown;

        /// <summary>
        /// Fired when a panel finishes its hide animation.
        /// </summary>
        public event Action<UIPanel> OnPanelHidden;

        /// <summary>
        /// Fired when a fade transition completes.
        /// </summary>
        public event Action OnFadeComplete;
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

            // Cache components
            if (MainCanvas != null)
                _mainCanvasScaler = MainCanvas.GetComponent<CanvasScaler>();

            // Initialize fade overlay
            if (FadeOverlay != null)
            {
                FadeOverlay.alpha = 0f;
                FadeOverlay.blocksRaycasts = false;
                FadeOverlay.interactable = false;
            }

            // Initialize toast system
            if (ToastPrefab != null && OverlayCanvas != null)
            {
                var toastGo = new GameObject("ToastNotification");
                toastGo.transform.SetParent(OverlayCanvas.transform, false);
                _toastNotification = toastGo.AddComponent<ToastNotification>();
                _toastNotification.ToastPrefab = ToastPrefab;
                _toastNotification.ToastContainer = toastGo.GetComponent<RectTransform>();
            }

            // Detect device
            DetectDeviceType();
        }

        private void Start()
        {
            ApplySafeArea();
            ConfigureCanvasScaler();
        }

        private void Update()
        {
            // Monitor for device type changes at runtime
            DeviceType detected = DetectDeviceTypeInternal();
            if (detected != _currentDeviceType)
            {
                SetDeviceType(detected);
            }

            // Handle escape/back button
            if (Input.GetKeyDown(KeyCode.Escape))
            {
                HandleEscapePressed();
            }
        }

        private void OnDestroy()
        {
            if (_instance == this)
                _instance = null;
        }

        private void OnApplicationFocus(bool hasFocus)
        {
            if (hasFocus)
            {
                ApplySafeArea();
            }
        }
        #endregion

        #region Panel Registration
        /// <summary>
        /// Registers a UIPanel with the manager for lifecycle control.
        /// </summary>
        /// <param name="panel">The panel to register.</param>
        public void RegisterPanel(UIPanel panel)
        {
            if (panel == null) return;
            if (string.IsNullOrEmpty(panel.PanelId))
            {
                Debug.LogWarning($"[UIManager] Cannot register panel with empty PanelId on {panel.name}");
                return;
            }

            if (_registeredPanels.ContainsKey(panel.PanelId))
            {
                Debug.LogWarning($"[UIManager] Panel with ID '{panel.PanelId}' is already registered. Overwriting.");
            }

            _registeredPanels[panel.PanelId] = panel;
            panel.gameObject.SetActive(false);

            // Auto-detect responsive layouts on the panel
            var layouts = panel.GetComponentsInChildren<ResponsiveLayout>(true);
            _responsiveLayouts.AddRange(layouts);
        }

        /// <summary>
        /// Unregisters a panel from the manager.
        /// </summary>
        /// <param name="panel">The panel to unregister.</param>
        public void UnregisterPanel(UIPanel panel)
        {
            if (panel == null) return;

            if (_registeredPanels.ContainsKey(panel.PanelId))
            {
                _registeredPanels.Remove(panel.PanelId);
            }

            // Remove from history if present
            var tempStack = new Stack<UIPanel>();
            while (_panelHistory.Count > 0)
            {
                var p = _panelHistory.Pop();
                if (p != panel)
                    tempStack.Push(p);
            }
            while (tempStack.Count > 0)
                _panelHistory.Push(tempStack.Pop());

            // Remove responsive layouts
            var layouts = panel.GetComponentsInChildren<ResponsiveLayout>(true);
            foreach (var l in layouts)
                _responsiveLayouts.Remove(l);
        }
        #endregion

        #region Panel Navigation
        /// <summary>
        /// Shows a registered panel by its ID.
        /// </summary>
        /// <param name="panelId">Unique identifier of the panel.</param>
        /// <param name="animate">Whether to play the enter animation.</param>
        /// <param name="pushToHistory">Whether to push current panel to navigation history.</param>
        public void ShowPanel(string panelId, bool animate = true, bool pushToHistory = true)
        {
            if (!_registeredPanels.TryGetValue(panelId, out var panel))
            {
                Debug.LogError($"[UIManager] Panel '{panelId}' not found. Make sure it's registered.");
                return;
            }

            if (IsTransitioning)
            {
                Debug.LogWarning($"[UIManager] Transition in progress. Queued show for '{panelId}'.");
                StartCoroutine(WaitAndShowPanel(panel, animate, pushToHistory));
                return;
            }

            // Push current to history before switching
            if (pushToHistory && _currentPanel != null && _currentPanel != panel)
            {
                _panelHistory.Push(_currentPanel);
            }

            // Hide current panel
            if (_currentPanel != null && _currentPanel != panel)
            {
                HidePanelInternal(_currentPanel, animate);
            }

            // Show new panel
            _currentPanel = panel;
            StartCoroutine(ShowPanelCoroutine(panel, animate));
        }

        /// <summary>
        /// Hides a registered panel by its ID.
        /// </summary>
        /// <param name="panelId">Unique identifier of the panel.</param>
        /// <param name="animate">Whether to play the exit animation.</param>
        public void HidePanel(string panelId, bool animate = true)
        {
            if (!_registeredPanels.TryGetValue(panelId, out var panel))
            {
                Debug.LogError($"[UIManager] Panel '{panelId}' not found.");
                return;
            }

            HidePanelInternal(panel, animate);

            if (_currentPanel == panel)
                _currentPanel = null;
        }

        /// <summary>
        /// Navigates back to the previous panel in history.
        /// </summary>
        public void GoBack()
        {
            if (_panelHistory.Count == 0)
            {
                Debug.Log("[UIManager] No panel in history to go back to.");
                return;
            }

            if (IsTransitioning) return;

            var previousPanel = _panelHistory.Pop();

            if (_currentPanel != null)
            {
                HidePanelInternal(_currentPanel, true);
            }

            _currentPanel = previousPanel;
            StartCoroutine(ShowPanelCoroutine(previousPanel, true));
        }

        /// <summary>
        /// Clears all history and returns to the root panel.
        /// </summary>
        public void GoToRoot()
        {
            _panelHistory.Clear();

            if (_currentPanel != null)
            {
                HidePanelInternal(_currentPanel, true);
                _currentPanel = null;
            }
        }

        /// <summary>
        /// Refreshes the current panel's data bindings and UI state.
        /// </summary>
        public void RefreshCurrentPanel()
        {
            _currentPanel?.Refresh();
        }

        /// <summary>
        /// Returns true if a panel with the given ID is registered.
        /// </summary>
        public bool HasPanel(string panelId)
        {
            return _registeredPanels.ContainsKey(panelId);
        }

        /// <summary>
        /// Returns the panel instance for the given ID, or null.
        /// </summary>
        public UIPanel GetPanel(string panelId)
        {
            _registeredPanels.TryGetValue(panelId, out var panel);
            return panel;
        }
        #endregion

        #region Popup / Toast / Tooltip
        /// <summary>
        /// Shows a modal popup dialog with the specified configuration.
        /// </summary>
        /// <param name="title">Popup title text.</param>
        /// <param name="message">Popup body message.</param>
        /// <param name="type">Type of popup (affects icon and button layout).</param>
        /// <param name="onConfirm">Callback when confirm/OK is pressed.</param>
        /// <param name="onCancel">Callback when cancel is pressed.</param>
        public void ShowPopup(string title, string message, PopupType type = PopupType.Info, Action onConfirm = null, Action onCancel = null)
        {
            if (PopupPrefab == null || PopupCanvas == null)
            {
                Debug.LogError("[UIManager] PopupPrefab or PopupCanvas is not assigned.");
                return;
            }

            var popupGo = Instantiate(PopupPrefab, PopupCanvas.transform, false);
            var popupPanel = popupGo.GetComponent<UIPanel>();

            // Configure popup content
            var titleText = popupGo.transform.Find("Title")?.GetComponent<TextMeshProUGUI>();
            var messageText = popupGo.transform.Find("Message")?.GetComponent<TextMeshProUGUI>();
            var confirmBtn = popupGo.transform.Find("ConfirmButton")?.GetComponent<Button>();
            var cancelBtn = popupGo.transform.Find("CancelButton")?.GetComponent<Button>();
            var iconImage = popupGo.transform.Find("Icon")?.GetComponent<Image>();

            if (titleText != null) titleText.text = title;
            if (messageText != null) messageText.text = message;

            // Configure buttons based on popup type
            if (cancelBtn != null)
            {
                cancelBtn.gameObject.SetActive(type == PopupType.Confirm || type == PopupType.Input);
            }

            // Set icon color based on type
            if (iconImage != null)
            {
                iconImage.color = type switch
                {
                    PopupType.Warning => Color.yellow,
                    PopupType.Error => Color.red,
                    PopupType.Confirm => Color.cyan,
                    PopupType.Input => Color.white,
                    _ => Color.white
                };
            }

            // Bind button events
            if (confirmBtn != null)
            {
                confirmBtn.onClick.AddListener(() =>
                {
                    onConfirm?.Invoke();
                    if (popupPanel != null)
                        HidePanel(popupPanel.PanelId, true);
                    else
                        Destroy(popupGo);
                });
            }

            if (cancelBtn != null)
            {
                cancelBtn.onClick.AddListener(() =>
                {
                    onCancel?.Invoke();
                    if (popupPanel != null)
                        HidePanel(popupPanel.PanelId, true);
                    else
                        Destroy(popupGo);
                });
            }

            // Show popup
            if (popupPanel != null)
            {
                popupPanel.IsModal = true;
                RegisterPanel(popupPanel);
                ShowPanel(popupPanel.PanelId, true, false);
            }
            else
            {
                popupGo.SetActive(true);
            }

            // Play effect
            var popupRT = popupGo.GetComponent<RectTransform>();
            if (popupRT != null)
                PlayPopupEffect(popupRT.position);
        }

        /// <summary>
        /// Displays a toast notification message.
        /// </summary>
        /// <param name="message">Toast text content.</param>
        /// <param name="type">Toast type (affects color/icon).</param>
        /// <param name="duration">How long the toast remains visible.</param>
        public void ShowToast(string message, ToastType type = ToastType.Info, float duration = 2f)
        {
            _toastNotification?.ShowToast(message, type, duration);
        }

        /// <summary>
        /// Shows a tooltip at the specified screen position.
        /// </summary>
        /// <param name="position">Screen position for the tooltip.</param>
        /// <param name="text">Tooltip text content.</param>
        public void ShowTooltip(Vector2 position, string text)
        {
            if (TooltipPrefab == null || TooltipCanvas == null) return;

            HideTooltip();

            _activeTooltip = Instantiate(TooltipPrefab, TooltipCanvas.transform, false);
            var tooltipRT = _activeTooltip.GetComponent<RectTransform>();
            var tooltipText = _activeTooltip.GetComponentInChildren<TextMeshProUGUI>();

            if (tooltipText != null)
                tooltipText.text = text;

            // Position tooltip
            if (tooltipRT != null)
            {
                tooltipRT.position = position;

                // Clamp to screen bounds
                var canvasRT = TooltipCanvas.GetComponent<RectTransform>();
                Vector2 localPos;
                RectTransformUtility.ScreenPointToLocalPointInRectangle(
                    canvasRT, position, TooltipCanvas.worldCamera, out localPos);

                float halfW = tooltipRT.rect.width * 0.5f;
                float halfH = tooltipRT.rect.height * 0.5f;
                localPos.x = Mathf.Clamp(localPos.x, -canvasRT.rect.width * 0.5f + halfW, canvasRT.rect.width * 0.5f - halfW);
                localPos.y = Mathf.Clamp(localPos.y, -canvasRT.rect.height * 0.5f + halfH, canvasRT.rect.height * 0.5f - halfH);

                tooltipRT.localPosition = localPos;
            }

            // Animate in
            var tooltipCG = _activeTooltip.GetComponent<CanvasGroup>();
            if (tooltipCG != null)
            {
                tooltipCG.alpha = 0f;
                StartCoroutine(UITransitions.FadeIn(tooltipCG, 0.15f));
            }
        }

        /// <summary>
        /// Hides the currently visible tooltip.
        /// </summary>
        public void HideTooltip()
        {
            if (_activeTooltip != null)
            {
                Destroy(_activeTooltip);
                _activeTooltip = null;
            }
        }
        #endregion

        #region Fade Transitions
        /// <summary>
        /// Fades the screen overlay to black (or fully opaque).
        /// </summary>
        /// <param name="duration">Fade duration in seconds.</param>
        /// <param name="onComplete">Callback when fade completes.</param>
        public void FadeIn(float duration = 0.3f, Action onComplete = null)
        {
            if (FadeOverlay == null) return;

            if (_fadeCoroutine != null)
                StopCoroutine(_fadeCoroutine);

            FadeOverlay.blocksRaycasts = true;
            FadeOverlay.interactable = true;
            _fadeCoroutine = StartCoroutine(FadeCoroutine(1f, duration, onComplete));
        }

        /// <summary>
        /// Fades the screen overlay to transparent.
        /// </summary>
        /// <param name="duration">Fade duration in seconds.</param>
        /// <param name="onComplete">Callback when fade completes.</param>
        public void FadeOut(float duration = 0.3f, Action onComplete = null)
        {
            if (FadeOverlay == null) return;

            if (_fadeCoroutine != null)
                StopCoroutine(_fadeCoroutine);

            _fadeCoroutine = StartCoroutine(FadeCoroutine(0f, duration, () =>
            {
                FadeOverlay.blocksRaycasts = false;
                FadeOverlay.interactable = false;
                onComplete?.Invoke();
            }));
        }

        /// <summary>
        /// Fades to black, executes an action, then fades back out.
        /// </summary>
        /// <param name="midAction">Action to execute while faded to black.</param>
        /// <param name="fadeDuration">Duration of each fade direction.</param>
        public void FadeThrough(Action midAction, float fadeDuration = 0.3f)
        {
            FadeIn(fadeDuration, () =>
            {
                midAction?.Invoke();
                FadeOut(fadeDuration);
            });
        }
        #endregion

        #region Particle Effects
        /// <summary>
        /// Plays the click particle effect at the specified screen position.
        /// </summary>
        /// <param name="position">Screen position in pixels.</param>
        public void PlayClickEffect(Vector2 position)
        {
            if (UIClickEffect == null) return;

            UIClickEffect.transform.position = GetWorldPositionFromScreen(position);
            UIClickEffect.Play();
        }

        /// <summary>
        /// Plays the popup particle effect at the specified position.
        /// </summary>
        /// <param name="position">Position in world or canvas space.</param>
        public void PlayPopupEffect(Vector2 position)
        {
            if (UIPopupEffect == null) return;

            UIPopupEffect.transform.position = new Vector3(position.x, position.y, UIPopupEffect.transform.position.z);
            UIPopupEffect.Play();
        }
        #endregion

        #region Device Type Management
        /// <summary>
        /// Manually sets the device type and applies all related configurations.
        /// </summary>
        /// <param name="deviceType">Target device type.</param>
        public void SetDeviceType(DeviceType deviceType)
        {
            if (_currentDeviceType == deviceType) return;

            DeviceType previousType = _currentDeviceType;
            _currentDeviceType = deviceType;

            Debug.Log($"[UIManager] Device type changed: {previousType} -> {deviceType}");

            // Update canvas scaler
            ConfigureCanvasScaler();

            // Apply safe area
            ApplySafeArea();

            // Notify all responsive layouts
            foreach (var layout in _responsiveLayouts)
            {
                if (layout != null)
                    layout.SwitchLayout(deviceType);
            }

            // Notify all registered panels
            foreach (var panel in _registeredPanels.Values)
            {
                if (panel != null)
                    panel.OnDeviceTypeChanged(deviceType);
            }

            OnDeviceTypeChanged?.Invoke(deviceType);
        }

        /// <summary>
        /// Applies safe area padding to the safe area container.
        /// </summary>
        public void ApplySafeArea()
        {
            if (SafeAreaContainer == null) return;

            Rect safeArea = Screen.safeArea;
            var canvas = SafeAreaContainer.GetComponentInParent<Canvas>();
            if (canvas == null) return;

            var canvasRT = canvas.GetComponent<RectTransform>();
            Vector2 canvasSize = canvasRT.rect.size;

            // Convert safe area from screen coords to canvas coords
            Vector2 anchorMin = safeArea.position;
            Vector2 anchorMax = safeArea.position + safeArea.size;

            anchorMin.x /= Screen.width;
            anchorMin.y /= Screen.height;
            anchorMax.x /= Screen.width;
            anchorMax.y /= Screen.height;

            SafeAreaContainer.anchorMin = anchorMin;
            SafeAreaContainer.anchorMax = anchorMax;
            SafeAreaContainer.offsetMin = Vector2.zero;
            SafeAreaContainer.offsetMax = Vector2.zero;

            Debug.Log($"[UIManager] Safe area applied: {safeArea}");
        }

        /// <summary>
        /// Returns the appropriate reference resolution based on device type.
        /// </summary>
        public Vector2 GetReferenceResolution()
        {
            return _currentDeviceType == DeviceType.Mobile
                ? MobileReferenceResolution
                : DesktopReferenceResolution;
        }
        #endregion

        #region Private Helpers
        private void DetectDeviceType()
        {
            _currentDeviceType = DetectDeviceTypeInternal();
            Debug.Log($"[UIManager] Initial device type detected: {_currentDeviceType}");
        }

        private DeviceType DetectDeviceTypeInternal()
        {
#if UNITY_EDITOR
            // In editor, detect based on game view aspect ratio
            float aspect = (float)Screen.width / Screen.height;
            if (aspect < 1.0f)
                return DeviceType.Mobile;
            return DeviceType.Desktop;
#endif

#if UNITY_ANDROID || UNITY_IOS
            return DeviceType.Mobile;
#elif UNITY_SWITCH || UNITY_PS5 || UNITY_XBOXONE || UNITY_GAMECORE
            return DeviceType.Console;
#else
            float aspect = (float)Screen.width / Screen.height;
            if (aspect < 1.2f)
                return DeviceType.Mobile;
            return DeviceType.Desktop;
#endif
        }

        private void ConfigureCanvasScaler()
        {
            if (_mainCanvasScaler == null) return;

            if (_currentDeviceType == DeviceType.Mobile)
            {
                _mainCanvasScaler.referenceResolution = MobileReferenceResolution;
                _mainCanvasScaler.matchWidthOrHeight = MobileMatchWidthOrHeight;
                _mainCanvasScaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            }
            else
            {
                _mainCanvasScaler.referenceResolution = DesktopReferenceResolution;
                _mainCanvasScaler.matchWidthOrHeight = DesktopMatchWidthOrHeight;
                _mainCanvasScaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            }

            Debug.Log($"[UIManager] Canvas scaler configured for {_currentDeviceType}: " +
                      $"ref={_mainCanvasScaler.referenceResolution}, match={_mainCanvasScaler.matchWidthOrHeight}");
        }

        private void HidePanelInternal(UIPanel panel, bool animate)
        {
            if (panel == null) return;
            StartCoroutine(HidePanelCoroutine(panel, animate));
        }

        private void HandleEscapePressed()
        {
            if (_currentPanel != null)
            {
                bool handled = _currentPanel.OnBackPressed();
                if (handled) return;

                if (_currentPanel.CloseOnEscape && !_currentPanel.IsModal)
                {
                    if (_panelHistory.Count > 0)
                        GoBack();
                    else
                        HidePanel(_currentPanel.PanelId, true);
                }
            }
        }

        private Vector3 GetWorldPositionFromScreen(Vector2 screenPos)
        {
            if (MainCanvas == null) return new Vector3(screenPos.x, screenPos.y, 0f);

            if (MainCanvas.renderMode == RenderMode.ScreenSpaceOverlay)
            {
                return new Vector3(screenPos.x, screenPos.y, 0f);
            }

            RectTransformUtility.ScreenPointToWorldPointInRectangle(
                MainCanvas.GetComponent<RectTransform>(),
                screenPos,
                MainCanvas.worldCamera,
                out Vector3 worldPos);
            return worldPos;
        }
        #endregion

        #region Coroutines
        private IEnumerator FadeCoroutine(float targetAlpha, float duration, Action onComplete)
        {
            IsTransitioning = true;
            float startAlpha = FadeOverlay.alpha;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                FadeOverlay.alpha = Mathf.Lerp(startAlpha, targetAlpha, t);
                yield return null;
            }

            FadeOverlay.alpha = targetAlpha;
            IsTransitioning = false;
            onComplete?.Invoke();
            OnFadeComplete?.Invoke();
        }

        private IEnumerator ShowPanelCoroutine(UIPanel panel, bool animate)
        {
            IsTransitioning = true;

            panel.gameObject.SetActive(true);
            panel.OnPanelShow();

            if (animate)
            {
                yield return panel.StartCoroutine(panel.AnimateShow());
            }
            else
            {
                if (panel.CanvasGroup != null)
                    panel.CanvasGroup.alpha = 1f;
            }

            panel.OnPanelShown();
            IsTransitioning = false;
            OnPanelShown?.Invoke(panel);
        }

        private IEnumerator HidePanelCoroutine(UIPanel panel, bool animate)
        {
            panel.OnPanelHide();

            if (animate)
            {
                yield return panel.StartCoroutine(panel.AnimateHide());
            }

            panel.gameObject.SetActive(false);
            panel.OnPanelHidden();
            OnPanelHidden?.Invoke(panel);
        }

        private IEnumerator WaitAndShowPanel(UIPanel panel, bool animate, bool pushToHistory)
        {
            while (IsTransitioning)
                yield return null;

            ShowPanel(panel.PanelId, animate, pushToHistory);
        }
        #endregion

#if UNITY_EDITOR
        [ContextMenu("Detect Device Type")]
        private void EditorDetectDevice()
        {
            DetectDeviceType();
            ApplySafeArea();
            ConfigureCanvasScaler();
        }

        [ContextMenu("Simulate Mobile")]
        private void EditorSimulateMobile()
        {
            SetDeviceType(DeviceType.Mobile);
        }

        [ContextMenu("Simulate Desktop")]
        private void EditorSimulateDesktop()
        {
            SetDeviceType(DeviceType.Desktop);
        }
#endif
    }
}
