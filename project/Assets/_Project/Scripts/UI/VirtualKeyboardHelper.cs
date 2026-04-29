using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace KawaiiCoolIsland.UI
{
    /// <summary>
    /// Handles mobile virtual keyboard appearance by shifting UI elements upward
    /// when the keyboard is shown, preventing input fields from being obscured.
    /// Works on iOS and Android with Unity's TouchScreenKeyboard API.
    /// </summary>
    public class VirtualKeyboardHelper : MonoBehaviour
    {
        #region Inspector
        [Header("Elements to Shift")]
        [Tooltip("Array of RectTransforms to shift upward when the keyboard appears.")]
        public RectTransform[] ElementsToShift;

        [Tooltip("Alternative: A single parent RectTransform whose children will all be shifted.")]
        public RectTransform ElementsParent;

        [Tooltip("Additional padding in pixels between the keyboard top and the shifted elements.")]
        public float ShiftPadding = 20f;

        [Tooltip("Duration of the shift animation in seconds.")]
        public float ShiftAnimationDuration = 0.25f;

        [Tooltip("Easing curve for the shift animation.")]
        public AnimationCurve ShiftCurve = AnimationCurve.EaseInOut(0, 0, 1, 1);
        #endregion

        #region Inspector - Settings
        [Header("Settings")]
        [Tooltip("If true, automatically detects the keyboard state each frame.")]
        public bool AutoDetectKeyboard = true;

        [Tooltip("If true, only activates on mobile platforms.")]
        public bool MobileOnly = true;

        [Tooltip("If true, shifts the entire canvas instead of individual elements when keyboard shows.")]
        public bool ShiftEntireCanvas = false;

        [Tooltip("The canvas RectTransform to shift (only used if ShiftEntireCanvas is true).")]
        public RectTransform CanvasToShift;

        [Tooltip("Maximum upward shift in pixels to prevent over-scrolling.")]
        public float MaxShiftAmount = 500f;
        #endregion

        #region Inspector - Focus Tracking
        [Header("Focus Tracking")]
        [Tooltip("If true, automatically detects the currently focused input field and adjusts shift amount.")]
        public bool TrackFocusedInput = true;

        [Tooltip("Additional offset for the focused input field to appear above the keyboard.")]
        public float FocusedElementOffset = 10f;
        #endregion

        #region Private State
        private bool _keyboardWasVisible;
        private float _keyboardHeight;
        private float _currentShiftOffset;
        private float _targetShiftOffset;
        private Coroutine _shiftCoroutine;
        private RectTransform[] _cachedElements;
        private Vector2[] _originalPositions;
        private Canvas _parentCanvas;
        private float _canvasScaleFactor = 1f;
        private TMP_InputField _focusedInputField;
        private InputField _legacyFocusedInputField;
        #endregion

        #region Public Properties
        /// <summary>
        /// True if the virtual keyboard is currently visible.
        /// </summary>
        public bool IsKeyboardVisible => _keyboardWasVisible;

        /// <summary>
        /// Current height of the virtual keyboard in screen pixels.
        /// </summary>
        public float KeyboardHeight => _keyboardHeight;

        /// <summary>
        /// Current upward shift amount applied to UI elements.
        /// </summary>
        public float CurrentShiftOffset => _currentShiftOffset;
        #endregion

        #region Events
        /// <summary>
        /// Fired when the virtual keyboard is shown.
        /// </summary>
        public event System.Action<float> OnKeyboardShown;

        /// <summary>
        /// Fired when the virtual keyboard is hidden.
        /// </summary>
        public event System.Action OnKeyboardHidden;
        #endregion

        #region Unity Lifecycle
        private void Awake()
        {
            CacheElements();

            _parentCanvas = GetComponentInParent<Canvas>();
            if (_parentCanvas != null)
            {
                _canvasScaleFactor = _parentCanvas.scaleFactor;
            }

            if (CanvasToShift == null && ShiftEntireCanvas)
            {
                CanvasToShift = _parentCanvas?.GetComponent<RectTransform>();
            }
        }

        private void Start()
        {
#if !UNITY_ANDROID && !UNITY_IOS && !UNITY_EDITOR
            if (MobileOnly)
            {
                enabled = false;
                return;
            }
#endif
            StoreOriginalPositions();
        }

        private void Update()
        {
            if (!AutoDetectKeyboard) return;

#if UNITY_ANDROID || UNITY_IOS || UNITY_EDITOR
            bool keyboardVisible = TouchScreenKeyboard.visible;
            float keyboardHeight = GetKeyboardHeight();

            // Detect keyboard show
            if (keyboardVisible && !_keyboardWasVisible)
            {
                _keyboardWasVisible = true;
                _keyboardHeight = keyboardHeight;
                HandleKeyboardShown(keyboardHeight);
            }
            // Detect keyboard hide
            else if (!keyboardVisible && _keyboardWasVisible)
            {
                _keyboardWasVisible = false;
                _keyboardHeight = 0f;
                HandleKeyboardHidden();
            }
            // Keyboard still visible but height changed (orientation change, etc.)
            else if (keyboardVisible && _keyboardWasVisible && Mathf.Abs(keyboardHeight - _keyboardHeight) > 1f)
            {
                _keyboardHeight = keyboardHeight;
                HandleKeyboardShown(keyboardHeight);
            }

            // Track focused input field for precise positioning
            if (TrackFocusedInput && keyboardVisible)
            {
                UpdateFocusTracking();
            }

            // Smoothly interpolate current shift toward target
            if (Mathf.Abs(_currentShiftOffset - _targetShiftOffset) > 0.01f)
            {
                _currentShiftOffset = Mathf.Lerp(_currentShiftOffset, _targetShiftOffset, Time.unscaledDeltaTime * 15f);
                ApplyShift(_currentShiftOffset);
            }
#endif
        }

        private void OnEnable()
        {
            // Subscribe to input field events
            SubscribeToInputFields();
        }

        private void OnDisable()
        {
            // Reset shift when disabled
            if (_currentShiftOffset != 0f)
            {
                HandleKeyboardHidden();
            }
        }

        private void OnDestroy()
        {
            UnsubscribeFromInputFields();
        }
        #endregion

        #region Keyboard Handlers
        private void HandleKeyboardShown(float keyboardHeight)
        {
            float shiftAmount = CalculateShiftAmount(keyboardHeight);
            _targetShiftOffset = Mathf.Min(shiftAmount, MaxShiftAmount);

            if (_shiftCoroutine != null)
            {
                StopCoroutine(_shiftCoroutine);
            }

            OnKeyboardShown?.Invoke(keyboardHeight);
            Debug.Log($"[VirtualKeyboardHelper] Keyboard shown, height: {keyboardHeight}, shift: {_targetShiftOffset}");
        }

        private void HandleKeyboardHidden()
        {
            _targetShiftOffset = 0f;
            _currentShiftOffset = 0f;
            _focusedInputField = null;
            _legacyFocusedInputField = null;

            if (_shiftCoroutine != null)
            {
                StopCoroutine(_shiftCoroutine);
            }

            ApplyShift(0f);
            OnKeyboardHidden?.Invoke();
            Debug.Log("[VirtualKeyboardHelper] Keyboard hidden, reset shift.");
        }

        private IEnumerator ShiftElements(float targetOffset)
        {
            float startOffset = _currentShiftOffset;
            float elapsed = 0f;

            while (elapsed < ShiftAnimationDuration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / ShiftAnimationDuration);
                float easedT = ShiftCurve.Evaluate(t);
                float currentOffset = Mathf.Lerp(startOffset, targetOffset, easedT);
                ApplyShift(currentOffset);
                yield return null;
            }

            ApplyShift(targetOffset);
            _shiftCoroutine = null;
        }
        #endregion

        #region Shift Application
        private void ApplyShift(float offset)
        {
            RectTransform[] elements = GetElementsToShift();
            if (elements == null || _originalPositions == null) return;

            for (int i = 0; i < elements.Length && i < _originalPositions.Length; i++)
            {
                if (elements[i] == null) continue;

                Vector2 shiftedPos = _originalPositions[i] + new Vector2(0f, offset);
                elements[i].anchoredPosition = shiftedPos;
            }
        }

        private void StoreOriginalPositions()
        {
            RectTransform[] elements = GetElementsToShift();
            if (elements == null) return;

            _originalPositions = new Vector2[elements.Length];
            for (int i = 0; i < elements.Length; i++)
            {
                if (elements[i] != null)
                {
                    _originalPositions[i] = elements[i].anchoredPosition;
                }
            }
        }

        private void RestoreOriginalPositions()
        {
            RectTransform[] elements = GetElementsToShift();
            if (elements == null || _originalPositions == null) return;

            for (int i = 0; i < elements.Length && i < _originalPositions.Length; i++)
            {
                if (elements[i] != null)
                {
                    elements[i].anchoredPosition = _originalPositions[i];
                }
            }
        }
        #endregion

        #region Focus Tracking
        private void UpdateFocusTracking()
        {
            // Check for focused TMP_InputField
            var tmpFields = GetComponentsInChildren<TMP_InputField>(true);
            foreach (var field in tmpFields)
            {
                if (field.isFocused)
                {
                    if (_focusedInputField != field)
                    {
                        _focusedInputField = field;
                        _legacyFocusedInputField = null;

                        // Recalculate shift for this specific field
                        if (_keyboardHeight > 0)
                        {
                            float shiftAmount = CalculateShiftAmountForElement(field.GetComponent<RectTransform>(), _keyboardHeight);
                            _targetShiftOffset = Mathf.Min(shiftAmount, MaxShiftAmount);
                        }
                    }
                    return;
                }
            }

            // Check for focused legacy InputField
            var legacyFields = GetComponentsInChildren<InputField>(true);
            foreach (var field in legacyFields)
            {
                if (field.isFocused)
                {
                    if (_legacyFocusedInputField != field)
                    {
                        _legacyFocusedInputField = field;
                        _focusedInputField = null;

                        if (_keyboardHeight > 0)
                        {
                            float shiftAmount = CalculateShiftAmountForElement(field.GetComponent<RectTransform>(), _keyboardHeight);
                            _targetShiftOffset = Mathf.Min(shiftAmount, MaxShiftAmount);
                        }
                    }
                    return;
                }
            }
        }
        #endregion

        #region Calculations
        private float CalculateShiftAmount(float keyboardHeight)
        {
            if (ShiftEntireCanvas && CanvasToShift != null)
            {
                return keyboardHeight / _canvasScaleFactor + ShiftPadding;
            }

            RectTransform[] elements = GetElementsToShift();
            if (elements == null || elements.Length == 0)
            {
                return keyboardHeight / _canvasScaleFactor + ShiftPadding;
            }

            // Calculate shift needed to keep the lowest element visible above keyboard
            float lowestElementY = float.MaxValue;
            foreach (var element in elements)
            {
                if (element == null) continue;
                float elementBottom = element.anchoredPosition.y - element.rect.height * (1f - element.pivot.y);
                if (elementBottom < lowestElementY)
                {
                    lowestElementY = elementBottom;
                }
            }

            // Convert keyboard height to canvas-local units
            float keyboardCanvasHeight = keyboardHeight / _canvasScaleFactor;

            // Calculate how much we need to shift up
            float canvasBottom = -CanvasToShift.rect.height * 0.5f;
            float keyboardTopFromBottom = keyboardCanvasHeight;
            float desiredBottom = -keyboardTopFromBottom + ShiftPadding;

            float shiftAmount = canvasBottom + desiredBottom - lowestElementY;
            return Mathf.Max(0f, shiftAmount);
        }

        private float CalculateShiftAmountForElement(RectTransform element, float keyboardHeight)
        {
            if (element == null) return 0f;

            // Get element's screen position
            Vector3[] corners = new Vector3[4];
            element.GetWorldCorners(corners);
            float elementBottomY = corners[0].y;

            // Get keyboard top in screen space
            float keyboardTopY = _keyboardHeight;

            // Convert to canvas-local units
            float elementBottomCanvas = ((RectTransform)element.parent).InverseTransformPoint(corners[0]).y;
            float keyboardTopCanvas = keyboardTopY / _canvasScaleFactor;
            float canvasHeight = CanvasToShift != null ? CanvasToShift.rect.height : Screen.height;
            float keyboardTopLocal = keyboardTopCanvas - canvasHeight * 0.5f;

            float shift = keyboardTopLocal - elementBottomCanvas + FocusedElementOffset + ShiftPadding;
            return Mathf.Max(0f, shift);
        }

        private float GetKeyboardHeight()
        {
#if UNITY_ANDROID
            using (var unityPlayer = new AndroidJavaClass("com.unity3d.player.UnityPlayer"))
            {
                using (var activity = unityPlayer.GetStatic<AndroidJavaObject>("currentActivity"))
                {
                    using (var rect = new AndroidJavaObject("android.graphics.Rect"))
                    {
                        using (var window = activity.Call<AndroidJavaObject>("getWindow"))
                        {
                            using (var view = window.Call<AndroidJavaObject>("getDecorView"))
                            {
                                view.Call("getWindowVisibleDisplayFrame", rect);
                                int screenHeight = view.Call<int>("getHeight");
                                int keyboardHeight = screenHeight - rect.Call<int>("height");
                                return keyboardHeight > 0 ? keyboardHeight : 0;
                            }
                        }
                    }
                }
            }
#elif UNITY_IOS
            return TouchScreenKeyboard.area.height;
#else
            // Fallback - use area from TouchScreenKeyboard if available
            if (TouchScreenKeyboard.area.height > 0)
                return TouchScreenKeyboard.area.height;

            // Estimate based on common keyboard proportions
            return Screen.height * 0.35f;
#endif
        }
        #endregion

        #region Element Management
        private RectTransform[] GetElementsToShift()
        {
            if (_cachedElements != null && _cachedElements.Length > 0)
                return _cachedElements;

            if (ElementsToShift != null && ElementsToShift.Length > 0)
                return ElementsToShift;

            if (ElementsParent != null)
            {
                var children = ElementsParent.GetComponentsInChildren<RectTransform>(true);
                // Skip the parent itself
                var filtered = new System.Collections.Generic.List<RectTransform>();
                for (int i = 0; i < children.Length; i++)
                {
                    if (children[i] != ElementsParent)
                        filtered.Add(children[i]);
                }
                return filtered.ToArray();
            }

            return null;
        }

        private void CacheElements()
        {
            if (ElementsParent != null)
            {
                var children = ElementsParent.GetComponentsInChildren<RectTransform>(true);
                var filtered = new System.Collections.Generic.List<RectTransform>();
                for (int i = 0; i < children.Length; i++)
                {
                    if (children[i] != ElementsParent)
                        filtered.Add(children[i]);
                }
                _cachedElements = filtered.ToArray();
            }
            else if (ElementsToShift != null && ElementsToShift.Length > 0)
            {
                _cachedElements = ElementsToShift;
            }
        }
        #endregion

        #region Input Field Event Subscription
        private void SubscribeToInputFields()
        {
            var tmpFields = GetComponentsInChildren<TMP_InputField>(true);
            foreach (var field in tmpFields)
            {
                field.onSelect.AddListener(OnInputFieldSelected);
                field.onEndEdit.AddListener(OnInputFieldDeselected);
            }

            var legacyFields = GetComponentsInChildren<InputField>(true);
            foreach (var field in legacyFields)
            {
                field.onEndEdit.AddListener(OnLegacyInputFieldDeselected);
            }
        }

        private void UnsubscribeFromInputFields()
        {
            var tmpFields = GetComponentsInChildren<TMP_InputField>(true);
            foreach (var field in tmpFields)
            {
                field.onSelect.RemoveListener(OnInputFieldSelected);
                field.onEndEdit.RemoveListener(OnInputFieldDeselected);
            }

            var legacyFields = GetComponentsInChildren<InputField>(true);
            foreach (var field in legacyFields)
            {
                field.onEndEdit.RemoveListener(OnLegacyInputFieldDeselected);
            }
        }

        private void OnInputFieldSelected(string text)
        {
            // Input field was selected - keyboard may appear
        }

        private void OnInputFieldDeselected(string text)
        {
            _focusedInputField = null;
        }

        private void OnLegacyInputFieldDeselected(string text)
        {
            _legacyFocusedInputField = null;
        }
        #endregion

        #region Public Methods
        /// <summary>
        /// Manually triggers the keyboard shown handler with a specific height.
        /// Useful for testing or custom keyboard implementations.
        /// </summary>
        /// <param name="keyboardHeight">Height of the keyboard in pixels.</param>
        public void SimulateKeyboardShown(float keyboardHeight)
        {
            _keyboardWasVisible = true;
            _keyboardHeight = keyboardHeight;
            HandleKeyboardShown(keyboardHeight);
        }

        /// <summary>
        /// Manually triggers the keyboard hidden handler.
        /// </summary>
        public void SimulateKeyboardHidden()
        {
            _keyboardWasVisible = false;
            _keyboardHeight = 0f;
            HandleKeyboardHidden();
        }

        /// <summary>
        /// Refreshes the cached elements and recalculates shift.
        /// Call this after dynamically adding UI elements.
        /// </summary>
        public void RefreshElements()
        {
            CacheElements();
            StoreOriginalPositions();
        }

        /// <summary>
        /// Adds a RectTransform to the list of elements to shift.
        /// </summary>
        /// <param name="element">The RectTransform to add.</param>
        public void AddElementToShift(RectTransform element)
        {
            if (element == null) return;

            var list = new System.Collections.Generic.List<RectTransform>();
            if (ElementsToShift != null)
                list.AddRange(ElementsToShift);

            if (!list.Contains(element))
            {
                list.Add(element);
                ElementsToShift = list.ToArray();
                RefreshElements();
            }
        }

        /// <summary>
        /// Removes a RectTransform from the list of elements to shift.
        /// </summary>
        /// <param name="element">The RectTransform to remove.</param>
        public void RemoveElementToShift(RectTransform element)
        {
            if (element == null || ElementsToShift == null) return;

            var list = new System.Collections.Generic.List<RectTransform>(ElementsToShift);
            list.Remove(element);
            ElementsToShift = list.ToArray();
            RefreshElements();
        }
        #endregion

#if UNITY_EDITOR
        [ContextMenu("Store Original Positions")]
        private void EditorStorePositions()
        {
            CacheElements();
            StoreOriginalPositions();
        }

        [ContextMenu("Simulate Keyboard Shown (300px)")]
        private void EditorSimulateKeyboard()
        {
            SimulateKeyboardShown(300f);
        }

        [ContextMenu("Simulate Keyboard Hidden")]
        private void EditorSimulateKeyboardHidden()
        {
            SimulateKeyboardHidden();
        }
#endif
    }
}
