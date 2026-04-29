using System;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;

namespace KawaiiCoolIsland.UI
{
    /// <summary>
    /// Automatically switches between platform-specific layout GameObjects
    /// based on the current device type (Mobile, Desktop, Console).
    /// Attach this component to a UI container that has child layout roots for each platform.
    /// </summary>
    [ExecuteAlways]
    public class ResponsiveLayout : MonoBehaviour
    {
        #region Inspector - Layouts
        [Header("Layouts")]
        [Tooltip("Root GameObject containing the mobile portrait layout.")]
        public GameObject MobileLayout;

        [Tooltip("Root GameObject containing the desktop landscape layout.")]
        public GameObject DesktopLayout;

        [Tooltip("Root GameObject containing the console/TV layout.")]
        public GameObject ConsoleLayout;
        #endregion

        #region Inspector - Settings
        [Header("Settings")]
        [Tooltip("If true, automatically detects device type on Start.")]
        public bool AutoDetectOnStart = true;

        [Tooltip("If true, plays a crossfade transition when switching layouts.")]
        public bool AnimateTransition = true;

        [Tooltip("Duration of the layout transition animation in seconds.")]
        public float TransitionDuration = 0.3f;

        [Tooltip("If true, refreshes layout on orientation change (mobile only).")]
        public bool RefreshOnOrientationChange = true;

        [Tooltip("If true, saves and restores sibling indices of child objects when switching.")]
        public bool PreserveSiblingOrder = true;
        #endregion

        #region Inspector - Layout-Specific Settings
        [Header("Layout-Specific Settings")]
        [Tooltip("Additional scale factor applied to mobile layouts.")]
        public float MobileScaleFactor = 1f;

        [Tooltip("Additional scale factor applied to desktop layouts.")]
        public float DesktopScaleFactor = 1f;

        [Tooltip("Additional scale factor applied to console layouts.")]
        public float ConsoleScaleFactor = 1.1f;

        [Tooltip("If true, adjusts font sizes based on device type.")]
        public bool AutoScaleFonts = true;

        [Tooltip("Font size multiplier for mobile devices.")]
        public float MobileFontMultiplier = 1f;

        [Tooltip("Font size multiplier for desktop devices.")]
        public float DesktopFontMultiplier = 0.85f;

        [Tooltip("Font size multiplier for console devices.")]
        public float ConsoleFontMultiplier = 1.2f;
        #endregion

        #region State
        private DeviceType _currentLayout;
        private GameObject _activeLayoutObject;
        private CanvasGroup _mobileCanvasGroup;
        private CanvasGroup _desktopCanvasGroup;
        private CanvasGroup _consoleCanvasGroup;
        private ScreenOrientation _lastOrientation;
        private Coroutine _transitionCoroutine;
        #endregion

        #region Events
        /// <summary>
        /// Fired when the layout is switched to a different device type.
        /// </summary>
        public event Action<DeviceType> OnLayoutSwitched;

        /// <summary>
        /// Fired before a layout transition begins.
        /// </summary>
        public event Action<DeviceType> OnLayoutTransitionStart;

        /// <summary>
        /// Fired after a layout transition completes.
        /// </summary>
        public event Action<DeviceType> OnLayoutTransitionComplete;
        #endregion

        #region Public Properties
        /// <summary>
        /// Currently active device type layout.
        /// </summary>
        public DeviceType CurrentLayout => _currentLayout;

        /// <summary>
        /// The currently active layout GameObject, or null if none.
        /// </summary>
        public GameObject ActiveLayoutObject => _activeLayoutObject;

        /// <summary>
        /// True if a layout transition is currently in progress.
        /// </summary>
        public bool IsTransitioning => _transitionCoroutine != null;
        #endregion

        #region Unity Lifecycle
        private void Awake()
        {
            CacheCanvasGroups();
        }

        private void Start()
        {
            _lastOrientation = Screen.orientation;

            if (AutoDetectOnStart)
            {
                DeviceType targetType = UIManager.Instance != null
                    ? UIManager.Instance.CurrentDeviceType
                    : DetectDeviceTypeInternal();
                SwitchLayout(targetType);
            }
        }

        private void Update()
        {
            if (!RefreshOnOrientationChange) return;

            // Monitor for orientation changes on mobile
            if (Screen.orientation != _lastOrientation)
            {
                _lastOrientation = Screen.orientation;

                if (UIManager.Instance != null && UIManager.Instance.IsMobile)
                {
                    RefreshLayout();
                }
            }

#if UNITY_EDITOR
            // In editor, monitor for device type changes from UIManager
            if (UIManager.Instance != null && UIManager.Instance.CurrentDeviceType != _currentLayout)
            {
                SwitchLayout(UIManager.Instance.CurrentDeviceType);
            }
#endif
        }

        private void OnEnable()
        {
            // Subscribe to UIManager device type changes
            if (UIManager.Instance != null)
            {
                UIManager.Instance.OnDeviceTypeChanged += OnDeviceTypeChanged;
            }
        }

        private void OnDisable()
        {
            if (_transitionCoroutine != null)
            {
                StopCoroutine(_transitionCoroutine);
                _transitionCoroutine = null;
            }

            if (UIManager.Instance != null)
            {
                UIManager.Instance.OnDeviceTypeChanged -= OnDeviceTypeChanged;
            }
        }
        #endregion

        #region Public Methods
        /// <summary>
        /// Switches to the layout for the specified device type.
        /// </summary>
        /// <param name="deviceType">Target device type.</param>
        public void SwitchLayout(DeviceType deviceType)
        {
            if (_currentLayout == deviceType && _activeLayoutObject != null) return;

            GameObject targetLayout = GetLayoutObject(deviceType);
            if (targetLayout == null)
            {
                Debug.LogWarning($"[ResponsiveLayout] No layout object found for {deviceType} on {gameObject.name}");
                return;
            }

            OnLayoutTransitionStart?.Invoke(deviceType);

            if (AnimateTransition && _activeLayoutObject != null)
            {
                if (_transitionCoroutine != null)
                    StopCoroutine(_transitionCoroutine);
                _transitionCoroutine = StartCoroutine(TransitionLayouts(_activeLayoutObject, targetLayout, deviceType));
            }
            else
            {
                ApplyLayoutImmediate(targetLayout, deviceType);
            }

            _currentLayout = deviceType;
        }

        /// <summary>
        /// Refreshes the current layout without switching.
        /// Use this after dynamic content changes.
        /// </summary>
        public void RefreshLayout()
        {
            SwitchLayout(_currentLayout);
        }

        /// <summary>
        /// Returns the layout GameObject for a given device type.
        /// </summary>
        /// <param name="deviceType">Device type to look up.</param>
        /// <returns>Layout GameObject, or null if not assigned.</returns>
        public GameObject GetLayoutObject(DeviceType deviceType)
        {
            return deviceType switch
            {
                DeviceType.Mobile => MobileLayout,
                DeviceType.Desktop => DesktopLayout,
                DeviceType.Console => ConsoleLayout,
                _ => DesktopLayout
            };
        }

        /// <summary>
        /// Returns the scale factor for a given device type.
        /// </summary>
        /// <param name="deviceType">Device type to look up.</param>
        /// <returns>Scale multiplier.</returns>
        public float GetScaleFactor(DeviceType deviceType)
        {
            return deviceType switch
            {
                DeviceType.Mobile => MobileScaleFactor,
                DeviceType.Desktop => DesktopScaleFactor,
                DeviceType.Console => ConsoleScaleFactor,
                _ => 1f
            };
        }

        /// <summary>
        /// Returns the font multiplier for a given device type.
        /// </summary>
        /// <param name="deviceType">Device type to look up.</param>
        /// <returns>Font size multiplier.</returns>
        public float GetFontMultiplier(DeviceType deviceType)
        {
            return deviceType switch
            {
                DeviceType.Mobile => MobileFontMultiplier,
                DeviceType.Desktop => DesktopFontMultiplier,
                DeviceType.Console => ConsoleFontMultiplier,
                _ => 1f
            };
        }
        #endregion

        #region Private Methods
        private void ApplyLayoutImmediate(GameObject targetLayout, DeviceType deviceType)
        {
            // Deactivate all layouts
            if (MobileLayout != null) MobileLayout.SetActive(false);
            if (DesktopLayout != null) DesktopLayout.SetActive(false);
            if (ConsoleLayout != null) ConsoleLayout.SetActive(false);

            // Activate target
            targetLayout.SetActive(true);
            _activeLayoutObject = targetLayout;

            // Apply scale factor
            ApplyScaleFactor(targetLayout, deviceType);

            // Apply font scaling
            if (AutoScaleFonts)
            {
                ApplyFontScaling(targetLayout, deviceType);
            }

            OnLayoutSwitched?.Invoke(deviceType);
            OnLayoutTransitionComplete?.Invoke(deviceType);

            Debug.Log($"[ResponsiveLayout] Switched to {deviceType} layout on {gameObject.name}");
        }

        private IEnumerator TransitionLayouts(GameObject from, GameObject to, DeviceType deviceType)
        {
            // Get CanvasGroups
            CanvasGroup fromCg = from.GetComponent<CanvasGroup>();
            CanvasGroup toCg = to.GetComponent<CanvasGroup>();

            // Ensure CanvasGroups exist
            if (fromCg == null) fromCg = from.AddComponent<CanvasGroup>();
            if (toCg == null) toCg = to.AddComponent<CanvasGroup>();

            // Prepare target
            to.SetActive(true);
            toCg.alpha = 0f;
            toCg.blocksRaycasts = false;
            ApplyScaleFactor(to, deviceType);
            if (AutoScaleFonts)
            {
                ApplyFontScaling(to, deviceType);
            }

            float elapsed = 0f;
            while (elapsed < TransitionDuration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / TransitionDuration);

                // Fade out current
                fromCg.alpha = 1f - t;

                // Fade in new
                toCg.alpha = t;

                yield return null;
            }

            // Finalize
            fromCg.alpha = 0f;
            fromCg.blocksRaycasts = false;
            from.SetActive(false);

            toCg.alpha = 1f;
            toCg.blocksRaycasts = true;
            _activeLayoutObject = to;

            _transitionCoroutine = null;
            _currentLayout = deviceType;

            OnLayoutSwitched?.Invoke(deviceType);
            OnLayoutTransitionComplete?.Invoke(deviceType);

            Debug.Log($"[ResponsiveLayout] Transitioned to {deviceType} layout on {gameObject.name}");
        }

        private void ApplyMobileLayout()
        {
            if (MobileLayout != null)
            {
                if (DesktopLayout != null) DesktopLayout.SetActive(false);
                if (ConsoleLayout != null) ConsoleLayout.SetActive(false);
                MobileLayout.SetActive(true);
                _activeLayoutObject = MobileLayout;
                ApplyScaleFactor(MobileLayout, DeviceType.Mobile);
            }
        }

        private void ApplyDesktopLayout()
        {
            if (DesktopLayout != null)
            {
                if (MobileLayout != null) MobileLayout.SetActive(false);
                if (ConsoleLayout != null) ConsoleLayout.SetActive(false);
                DesktopLayout.SetActive(true);
                _activeLayoutObject = DesktopLayout;
                ApplyScaleFactor(DesktopLayout, DeviceType.Desktop);
            }
        }

        private void ApplyConsoleLayout()
        {
            if (ConsoleLayout != null)
            {
                if (MobileLayout != null) MobileLayout.SetActive(false);
                if (DesktopLayout != null) DesktopLayout.SetActive(false);
                ConsoleLayout.SetActive(true);
                _activeLayoutObject = ConsoleLayout;
                ApplyScaleFactor(ConsoleLayout, DeviceType.Console);
            }
        }

        private void ApplyScaleFactor(GameObject layoutRoot, DeviceType deviceType)
        {
            float scale = GetScaleFactor(deviceType);
            RectTransform rt = layoutRoot.GetComponent<RectTransform>();
            if (rt != null && Mathf.Abs(scale - 1f) > 0.001f)
            {
                rt.localScale = Vector3.one * scale;
            }
        }

        private void ApplyFontScaling(GameObject layoutRoot, DeviceType deviceType)
        {
            float multiplier = GetFontMultiplier(deviceType);
            if (Mathf.Abs(multiplier - 1f) < 0.001f) return;

            var texts = layoutRoot.GetComponentsInChildren<TMPro.TextMeshProUGUI>(true);
            foreach (var text in texts)
            {
                text.fontSize *= multiplier;
            }
        }

        private void CacheCanvasGroups()
        {
            if (MobileLayout != null)
                _mobileCanvasGroup = MobileLayout.GetComponent<CanvasGroup>();
            if (DesktopLayout != null)
                _desktopCanvasGroup = DesktopLayout.GetComponent<CanvasGroup>();
            if (ConsoleLayout != null)
                _consoleCanvasGroup = ConsoleLayout.GetComponent<CanvasGroup>();
        }

        private void OnDeviceTypeChanged(DeviceType deviceType)
        {
            if (deviceType != _currentLayout)
            {
                SwitchLayout(deviceType);
            }
        }

        private DeviceType DetectDeviceTypeInternal()
        {
            if (UIManager.Instance != null)
                return UIManager.Instance.CurrentDeviceType;

#if UNITY_ANDROID || UNITY_IOS
            return DeviceType.Mobile;
#elif UNITY_SWITCH || UNITY_PS5 || UNITY_XBOXONE || UNITY_GAMECORE
            return DeviceType.Console;
#else
            float aspect = (float)Screen.width / Screen.height;
            return aspect < 1.2f ? DeviceType.Mobile : DeviceType.Desktop;
#endif
        }
        #endregion

#if UNITY_EDITOR
        private void OnValidate()
        {
            CacheCanvasGroups();
        }
#endif
    }
}
