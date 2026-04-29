using UnityEngine;
using UnityEngine.UI;

namespace KawaiiCoolIsland.UI
{
    /// <summary>
    /// Applies mobile safe area padding to a RectTransform to ensure UI elements
    /// are not obscured by notches, home indicators, or rounded corners.
    /// Works on iOS, Android, and other platforms that report a safe area.
    /// </summary>
    [ExecuteAlways]
    public class SafeAreaController : MonoBehaviour
    {
        #region Inspector
        [Tooltip("The RectTransform to apply safe area padding to. Defaults to this object's RectTransform.")]
        public RectTransform TargetRect;

        [Tooltip("If true, applies safe area on Start.")]
        public bool ApplyOnStart = true;

        [Tooltip("If true, continuously monitors for orientation changes and reapplies safe area.")]
        public bool ApplyOnOrientationChange = true;

        [Tooltip("Additional padding offset in pixels (x = horizontal, y = vertical).")]
        public Vector2 PaddingOffset = Vector2.zero;

        [Tooltip("Minimum safe area padding to enforce even when safe area is zero.")]
        public Vector2 MinPadding = new Vector2(0f, 0f);

        [Tooltip("If true, applies the safe area to this object's RectTransform even when not on a mobile platform.")]
        public bool ForceApplyInEditor = true;

        [Tooltip("If true, also adjusts child layout groups after applying safe area.")]
        public bool RefreshLayouts = true;
        #endregion

        #region Private State
        private Rect _lastSafeArea;
        private ScreenOrientation _lastOrientation;
        private Vector2 _lastResolution;
        private Canvas _parentCanvas;
        private RectTransform _canvasRectTransform;
        private bool _hasInitialized;
        #endregion

        #region Public Properties
        /// <summary>
        /// The last safe area rect that was applied.
        /// </summary>
        public Rect LastSafeArea => _lastSafeArea;

        /// <summary>
        /// The current computed safe area in canvas-local coordinates.
        /// </summary>
        public Rect CurrentSafeArea { get; private set; }
        #endregion

        #region Unity Lifecycle
        private void Awake()
        {
            Initialize();
        }

        private void Start()
        {
            if (ApplyOnStart)
            {
                ApplySafeArea();
            }
            _hasInitialized = true;
        }

        private void Update()
        {
            if (!ApplyOnOrientationChange) return;

            bool needsUpdate = false;

            // Check for safe area changes
            if (Screen.safeArea != _lastSafeArea)
            {
                needsUpdate = true;
            }

            // Check for orientation changes
            if (Screen.orientation != _lastOrientation)
            {
                _lastOrientation = Screen.orientation;
                needsUpdate = true;
            }

            // Check for resolution changes
            Vector2 currentResolution = new Vector2(Screen.width, Screen.height);
            if (currentResolution != _lastResolution)
            {
                _lastResolution = currentResolution;
                needsUpdate = true;
            }

            if (needsUpdate)
            {
                ApplySafeArea();
            }
        }

        private void OnEnable()
        {
            if (_hasInitialized && ApplyOnOrientationChange)
            {
                ApplySafeArea();
            }
        }

        private void OnRectTransformDimensionsChange()
        {
            if (_hasInitialized && ApplyOnOrientationChange)
            {
                ApplySafeArea();
            }
        }
        #endregion

        #region Public Methods
        /// <summary>
        /// Applies the current device safe area to the target RectTransform.
        /// Call this manually when you know the safe area has changed.
        /// </summary>
        public void ApplySafeArea()
        {
            if (TargetRect == null)
            {
                Initialize();
                if (TargetRect == null) return;
            }

            Rect safeArea = Screen.safeArea;
            _lastSafeArea = safeArea;
            _lastOrientation = Screen.orientation;
            _lastResolution = new Vector2(Screen.width, Screen.height);

            ApplySafeArea(safeArea);
        }

        /// <summary>
        /// Applies a specific safe area rect to the target RectTransform.
        /// Useful for testing or custom safe area values.
        /// </summary>
        /// <param name="safeArea">The safe area rect in screen coordinates.</param>
        public void ApplySafeArea(Rect safeArea)
        {
            if (TargetRect == null) return;

            // Cache canvas reference
            if (_parentCanvas == null)
            {
                _parentCanvas = TargetRect.GetComponentInParent<Canvas>();
                if (_parentCanvas != null)
                {
                    _canvasRectTransform = _parentCanvas.GetComponent<RectTransform>();
                }
            }

            if (_canvasRectTransform == null) return;

            // Convert screen safe area to canvas-normalized coordinates
            Vector2 canvasSize = _canvasRectTransform.rect.size;

            // Calculate safe area as normalized anchors (0-1 range)
            Vector2 anchorMin = safeArea.position;
            Vector2 anchorMax = safeArea.position + safeArea.size;

            anchorMin.x /= Screen.width;
            anchorMin.y /= Screen.height;
            anchorMax.x /= Screen.width;
            anchorMax.y /= Screen.height;

            // Apply minimum padding as normalized values
            float minPadXNorm = MinPadding.x / Screen.width;
            float minPadYNorm = MinPadding.y / Screen.height;

            anchorMin.x = Mathf.Max(anchorMin.x, minPadXNorm);
            anchorMin.y = Mathf.Max(anchorMin.y, minPadYNorm);
            anchorMax.x = Mathf.Min(anchorMax.x, 1f - minPadXNorm);
            anchorMax.y = Mathf.Min(anchorMax.y, 1f - minPadYNorm);

            // Apply additional offset padding
            if (PaddingOffset != Vector2.zero)
            {
                float offsetXNorm = PaddingOffset.x / Screen.width;
                float offsetYNorm = PaddingOffset.y / Screen.height;
                anchorMin.x += offsetXNorm;
                anchorMin.y += offsetYNorm;
                anchorMax.x -= offsetXNorm;
                anchorMax.y -= offsetYNorm;
            }

            // Clamp to valid range
            anchorMin = Vector2.Max(anchorMin, Vector2.zero);
            anchorMax = Vector2.Min(anchorMax, Vector2.one);
            anchorMin = Vector2.Min(anchorMin, anchorMax);

            // Apply to target RectTransform
            TargetRect.anchorMin = anchorMin;
            TargetRect.anchorMax = anchorMax;
            TargetRect.offsetMin = Vector2.zero;
            TargetRect.offsetMax = Vector2.zero;
            TargetRect.pivot = new Vector2(0.5f, 0.5f);

            // Store current safe area in canvas coordinates for reference
            CurrentSafeArea = new Rect(
                anchorMin.x * canvasSize.x,
                anchorMin.y * canvasSize.y,
                (anchorMax.x - anchorMin.x) * canvasSize.x,
                (anchorMax.y - anchorMin.y) * canvasSize.y
            );

            // Refresh child layouts if needed
            if (RefreshLayouts)
            {
                RefreshChildLayouts();
            }
        }

        /// <summary>
        /// Resets the safe area to full screen (no padding).
        /// </summary>
        public void ResetSafeArea()
        {
            if (TargetRect == null) return;

            TargetRect.anchorMin = Vector2.zero;
            TargetRect.anchorMax = Vector2.one;
            TargetRect.offsetMin = Vector2.zero;
            TargetRect.offsetMax = Vector2.zero;

            _lastSafeArea = new Rect(0, 0, Screen.width, Screen.height);
        }
        #endregion

        #region Private Methods
        private void Initialize()
        {
            if (TargetRect == null)
            {
                TargetRect = GetComponent<RectTransform>();
            }

            _parentCanvas = TargetRect != null ? TargetRect.GetComponentInParent<Canvas>() : null;
            if (_parentCanvas != null)
            {
                _canvasRectTransform = _parentCanvas.GetComponent<RectTransform>();
            }

            _lastSafeArea = Screen.safeArea;
            _lastOrientation = Screen.orientation;
            _lastResolution = new Vector2(Screen.width, Screen.height);
        }

        private void RefreshChildLayouts()
        {
            var layouts = TargetRect.GetComponentsInChildren<UnityEngine.UI.HorizontalOrVerticalLayoutGroup>(true);
            foreach (var layout in layouts)
            {
                layout.SetDirty();
            }

            var contentFitters = TargetRect.GetComponentsInChildren<UnityEngine.UI.ContentSizeFitter>(true);
            foreach (var fitter in contentFitters)
            {
                fitter.SetLayoutHorizontal();
                fitter.SetLayoutVertical();
            }
        }
        #endregion

#if UNITY_EDITOR
        private void OnValidate()
        {
            if (TargetRect == null)
            {
                TargetRect = GetComponent<RectTransform>();
            }
        }

        /// <summary>
        /// Editor helper to simulate various device safe areas for testing.
        /// </summary>
        [ContextMenu("Simulate iPhone X Safe Area")]
        private void EditorSimulateiPhoneX()
        {
            float w = Screen.width;
            float h = Screen.height;
            // iPhone X safe area: 132pt top, 102pt bottom, 0pt sides (in 2436x1125 space)
            float scale = w / 1125f;
            Rect simulatedSafeArea = new Rect(0, 132f * scale, w, h - (132f + 102f) * scale);
            ApplySafeArea(simulatedSafeArea);
        }

        [ContextMenu("Simulate iPhone 14 Pro Safe Area")]
        private void EditorSimulateiPhone14Pro()
        {
            float w = Screen.width;
            float h = Screen.height;
            float scale = w / 1179f;
            Rect simulatedSafeArea = new Rect(0, 158f * scale, w, h - (158f + 102f) * scale);
            ApplySafeArea(simulatedSafeArea);
        }

        [ContextMenu("Reset Safe Area")]
        private void EditorResetSafeArea()
        {
            ResetSafeArea();
        }

        [ContextMenu("Apply Current Safe Area")]
        private void EditorApplySafeArea()
        {
            ApplySafeArea();
        }
#endif
    }
}
