using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace KawaiiCoolIsland.Avatar.Editor
{
    /// <summary>
    /// Serializable configuration for all facial features and expressions.
    /// </summary>
    [System.Serializable]
    public class FaceConfiguration
    {
        /// <summary>
        /// Identifier of the currently equipped eye type.
        /// </summary>
        public string EyeType;

        /// <summary>
        /// Color applied to the eye sprites.
        /// </summary>
        public Color EyeColor;

        /// <summary>
        /// Identifier of the currently equipped eyebrow type.
        /// </summary>
        public string EyebrowType;

        /// <summary>
        /// Color applied to the eyebrow sprites.
        /// </summary>
        public Color EyebrowColor;

        /// <summary>
        /// Identifier of the currently equipped mouth type.
        /// </summary>
        public string MouthType;

        /// <summary>
        /// Identifier of the active facial expression (emote state).
        /// </summary>
        public string CurrentExpression;

        /// <summary>
        /// Whether makeup effects (blush, lip color) are active.
        /// </summary>
        public bool HasMakeup;

        /// <summary>
        /// Color of the blush overlay.
        /// </summary>
        public Color BlushColor;

        /// <summary>
        /// Intensity of the blush effect (0 to 1).
        /// </summary>
        public float BlushIntensity;

        /// <summary>
        /// Color of the lip overlay.
        /// </summary>
        public Color LipColor;
    }

    /// <summary>
    /// Provides controls for customizing facial features including eyes, eyebrows,
    /// mouth, expressions, and makeup with live preview feedback.
    /// </summary>
    public class FaceCustomizer : MonoBehaviour
    {
        #region Header Fields

        [Header("Eyes")]
        [SerializeField, Tooltip("Grid container for selectable eye type buttons.")]
        public Transform EyeTypeGrid;

        [SerializeField, Tooltip("Slider controlling eye sprite size.")]
        public Slider EyeSizeSlider;

        [SerializeField, Tooltip("Slider controlling horizontal eye spacing.")]
        public Slider EyeSpacingSlider;

        [SerializeField, Tooltip("Color picker for eye tint.")]
        public ColorPicker EyeColorPicker;

        [SerializeField, Tooltip("Slider controlling vertical eye position.")]
        public Slider EyeHeightSlider;

        [Header("Eyebrows")]
        [SerializeField, Tooltip("Grid container for selectable eyebrow type buttons.")]
        public Transform EyebrowTypeGrid;

        [SerializeField, Tooltip("Slider controlling eyebrow vertical position.")]
        public Slider EyebrowHeightSlider;

        [SerializeField, Tooltip("Color picker for eyebrow tint.")]
        public ColorPicker EyebrowColorPicker;

        [Header("Mouth")]
        [SerializeField, Tooltip("Grid container for selectable mouth type buttons.")]
        public Transform MouthTypeGrid;

        [SerializeField, Tooltip("Slider controlling mouth sprite width.")]
        public Slider MouthWidthSlider;

        [SerializeField, Tooltip("Slider controlling mouth sprite height.")]
        public Slider MouthHeightSlider;

        [Header("Expressions")]
        [SerializeField, Tooltip("Grid container for expression selection buttons.")]
        public Transform ExpressionGrid;

        [SerializeField, Tooltip("Button to preview the selected expression.")]
        public Button TestExpressionButton;

        [Header("Makeup")]
        [SerializeField, Tooltip("Toggle to enable or disable makeup effects.")]
        public Toggle EnableMakeupToggle;

        [SerializeField, Tooltip("Color picker for blush overlay color.")]
        public ColorPicker BlushColorPicker;

        [SerializeField, Tooltip("Slider controlling blush opacity.")]
        public Slider BlushIntensitySlider;

        [SerializeField, Tooltip("Color picker for lip overlay color.")]
        public ColorPicker LipColorPicker;

        #endregion

        #region Private Fields

        private FaceConfiguration _currentConfig = new();
        private AvatarController _avatarController;
        private AvatarPreview _preview;
        private EmotePlayer _emotePlayer;
        private Dictionary<string, Button> _eyeButtons = new();
        private Dictionary<string, Button> _eyebrowButtons = new();
        private Dictionary<string, Button> _mouthButtons = new();
        private Dictionary<string, Button> _expressionButtons = new();

        #endregion

        #region Events

        /// <summary>
        /// Invoked whenever any face configuration property changes.
        /// </summary>
        public event Action OnConfigurationChanged;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            _preview = GetComponentInParent<AvatarPreview>();
            if (_preview != null)
            {
                _avatarController = _preview.GetComponent<AvatarController>();
                _emotePlayer = _preview.GetComponent<EmotePlayer>();
            }

            InitializeSliders();
            InitializeToggles();
            InitializeColorPickers();
        }

        #endregion

        #region Public API

        /// <summary>
        /// Sets the eye type by part identifier.
        /// </summary>
        /// <param name="eyeId">AvatarPartData part ID for the eye.</param>
        public void SetEyeType(string eyeId)
        {
            _currentConfig.EyeType = eyeId;
            EquipPart("Eye", eyeId);
            UpdateButtonSelection(_eyeButtons, eyeId);
            OnConfigurationChanged?.Invoke();
        }

        /// <summary>
        /// Sets the eye color tint.
        /// </summary>
        /// <param name="color">The desired eye color.</param>
        public void SetEyeColor(Color color)
        {
            _currentConfig.EyeColor = color;
            ApplyColorToLayer("Eye", color);
            if (EyeColorPicker != null) EyeColorPicker.SetColor(color);
            OnConfigurationChanged?.Invoke();
        }

        /// <summary>
        /// Sets the eyebrow type by part identifier.
        /// </summary>
        /// <param name="eyebrowId">AvatarPartData part ID for the eyebrows.</param>
        public void SetEyebrowType(string eyebrowId)
        {
            _currentConfig.EyebrowType = eyebrowId;
            EquipPart("Eyebrow", eyebrowId);
            UpdateButtonSelection(_eyebrowButtons, eyebrowId);
            OnConfigurationChanged?.Invoke();
        }

        /// <summary>
        /// Sets the mouth type by part identifier.
        /// </summary>
        /// <param name="mouthId">AvatarPartData part ID for the mouth.</param>
        public void SetMouthType(string mouthId)
        {
            _currentConfig.MouthType = mouthId;
            EquipPart("Mouth", mouthId);
            UpdateButtonSelection(_mouthButtons, mouthId);
            OnConfigurationChanged?.Invoke();
        }

        /// <summary>
        /// Sets and previews a facial expression.
        /// </summary>
        /// <param name="expressionId">Expression identifier.</param>
        public void SetExpression(string expressionId)
        {
            _currentConfig.CurrentExpression = expressionId;
            _emotePlayer?.PlayExpression(expressionId);
            UpdateButtonSelection(_expressionButtons, expressionId);
            OnConfigurationChanged?.Invoke();
        }

        /// <summary>
        /// Toggles makeup effects (blush and lip color) on or off.
        /// </summary>
        /// <param name="enabled">True to enable makeup.</param>
        public void ToggleMakeup(bool enabled)
        {
            _currentConfig.HasMakeup = enabled;
            ApplyMakeup();
            OnConfigurationChanged?.Invoke();
        }

        /// <summary>
        /// Sets the blush overlay color.
        /// </summary>
        public void SetBlushColor(Color color)
        {
            _currentConfig.BlushColor = color;
            ApplyMakeup();
            OnConfigurationChanged?.Invoke();
        }

        /// <summary>
        /// Sets the blush opacity intensity.
        /// </summary>
        public void SetBlushIntensity(float intensity)
        {
            _currentConfig.BlushIntensity = Mathf.Clamp01(intensity);
            ApplyMakeup();
            OnConfigurationChanged?.Invoke();
        }

        /// <summary>
        /// Sets the lip overlay color.
        /// </summary>
        public void SetLipColor(Color color)
        {
            _currentConfig.LipColor = color;
            ApplyMakeup();
            OnConfigurationChanged?.Invoke();
        }

        /// <summary>
        /// Returns a copy of the current face configuration.
        /// </summary>
        public FaceConfiguration GetConfiguration()
        {
            return new FaceConfiguration
            {
                EyeType = _currentConfig.EyeType,
                EyeColor = _currentConfig.EyeColor,
                EyebrowType = _currentConfig.EyebrowType,
                EyebrowColor = _currentConfig.EyebrowColor,
                MouthType = _currentConfig.MouthType,
                CurrentExpression = _currentConfig.CurrentExpression,
                HasMakeup = _currentConfig.HasMakeup,
                BlushColor = _currentConfig.BlushColor,
                BlushIntensity = _currentConfig.BlushIntensity,
                LipColor = _currentConfig.LipColor
            };
        }

        /// <summary>
        /// Loads a face configuration and updates all controls and preview.
        /// </summary>
        /// <param name="config">The face configuration to apply.</param>
        public void LoadConfiguration(FaceConfiguration config)
        {
            if (config == null) return;

            _currentConfig = new FaceConfiguration
            {
                EyeType = config.EyeType,
                EyeColor = config.EyeColor,
                EyebrowType = config.EyebrowType,
                EyebrowColor = config.EyebrowColor,
                MouthType = config.MouthType,
                CurrentExpression = config.CurrentExpression,
                HasMakeup = config.HasMakeup,
                BlushColor = config.BlushColor,
                BlushIntensity = config.BlushIntensity,
                LipColor = config.LipColor
            };

            RefreshFromConfig();
        }

        /// <summary>
        /// Randomizes all face properties.
        /// </summary>
        public void Randomize()
        {
            SetEyeColor(UnityEngine.Random.ColorHSV());
            SetEyebrowColor(UnityEngine.Random.ColorHSV());
            ToggleMakeup(UnityEngine.Random.value > 0.7f);
            if (_currentConfig.HasMakeup)
            {
                SetBlushColor(new Color(1f, 0.4f, 0.4f, 0.3f));
                SetBlushIntensity(UnityEngine.Random.Range(0.2f, 0.6f));
                SetLipColor(new Color(0.9f, 0.3f, 0.4f, 0.5f));
            }
        }

        #endregion

        #region Private Implementation

        private void InitializeSliders()
        {
            if (EyeSizeSlider != null)
            {
                EyeSizeSlider.minValue = 0.8f;
                EyeSizeSlider.maxValue = 1.2f;
                EyeSizeSlider.value = 1f;
                EyeSizeSlider.onValueChanged.AddListener(v => ApplyEyeScale());
            }

            if (EyeSpacingSlider != null)
            {
                EyeSpacingSlider.minValue = -0.2f;
                EyeSpacingSlider.maxValue = 0.2f;
                EyeSpacingSlider.value = 0f;
                EyeSpacingSlider.onValueChanged.AddListener(v => ApplyEyePosition());
            }

            if (EyeHeightSlider != null)
            {
                EyeHeightSlider.minValue = -0.1f;
                EyeHeightSlider.maxValue = 0.1f;
                EyeHeightSlider.value = 0f;
                EyeHeightSlider.onValueChanged.AddListener(v => ApplyEyePosition());
            }

            if (EyebrowHeightSlider != null)
            {
                EyebrowHeightSlider.minValue = -0.15f;
                EyebrowHeightSlider.maxValue = 0.15f;
                EyebrowHeightSlider.value = 0f;
                EyebrowHeightSlider.onValueChanged.AddListener(v => ApplyEyebrowPosition());
            }

            if (MouthWidthSlider != null)
            {
                MouthWidthSlider.minValue = 0.8f;
                MouthWidthSlider.maxValue = 1.2f;
                MouthWidthSlider.value = 1f;
                MouthWidthSlider.onValueChanged.AddListener(v => ApplyMouthScale());
            }

            if (MouthHeightSlider != null)
            {
                MouthHeightSlider.minValue = 0.8f;
                MouthHeightSlider.maxValue = 1.2f;
                MouthHeightSlider.value = 1f;
                MouthHeightSlider.onValueChanged.AddListener(v => ApplyMouthScale());
            }

            if (BlushIntensitySlider != null)
            {
                BlushIntensitySlider.minValue = 0f;
                BlushIntensitySlider.maxValue = 1f;
                BlushIntensitySlider.value = 0f;
                BlushIntensitySlider.onValueChanged.AddListener(v => SetBlushIntensity(v));
            }
        }

        private void InitializeToggles()
        {
            if (EnableMakeupToggle != null)
            {
                EnableMakeupToggle.onValueChanged.RemoveAllListeners();
                EnableMakeupToggle.onValueChanged.AddListener(ToggleMakeup);
            }

            if (TestExpressionButton != null)
            {
                TestExpressionButton.onClick.RemoveAllListeners();
                TestExpressionButton.onClick.AddListener(() =>
                {
                    if (!string.IsNullOrEmpty(_currentConfig.CurrentExpression))
                        _emotePlayer?.PlayExpression(_currentConfig.CurrentExpression);
                });
            }
        }

        private void InitializeColorPickers()
        {
            if (EyeColorPicker != null)
            {
                EyeColorPicker.onColorChanged.RemoveAllListeners();
                EyeColorPicker.onColorChanged.AddListener(SetEyeColor);
            }

            if (EyebrowColorPicker != null)
            {
                EyebrowColorPicker.onColorChanged.RemoveAllListeners();
                EyebrowColorPicker.onColorChanged.AddListener(SetEyebrowColor);
            }

            if (BlushColorPicker != null)
            {
                BlushColorPicker.onColorChanged.RemoveAllListeners();
                BlushColorPicker.onColorChanged.AddListener(SetBlushColor);
            }

            if (LipColorPicker != null)
            {
                LipColorPicker.onColorChanged.RemoveAllListeners();
                LipColorPicker.onColorChanged.AddListener(SetLipColor);
            }
        }

        private void EquipPart(string layerName, string partId)
        {
            if (_avatarController == null) return;

            var part = InventoryManager.Instance?.GetPartById(partId);
            if (part != null)
                _avatarController.EquipPart(part);
        }

        private void ApplyColorToLayer(string layerName, Color color)
        {
            if (_avatarController == null) return;

            var renderer = _avatarController.GetLayerRenderer(layerName);
            if (renderer != null)
                renderer.color = color;
        }

        private void ApplyEyeScale()
        {
            if (_avatarController == null) return;
            var t = _avatarController.GetLayerTransform("Eye");
            if (t != null)
                t.localScale = Vector3.one * EyeSizeSlider.value;
        }

        private void ApplyEyePosition()
        {
            if (_avatarController == null) return;
            var t = _avatarController.GetLayerTransform("Eye");
            if (t != null)
            {
                float spacing = EyeSpacingSlider != null ? EyeSpacingSlider.value : 0f;
                float height = EyeHeightSlider != null ? EyeHeightSlider.value : 0f;
                t.localPosition = new Vector3(spacing, height, 0f);
            }
        }

        private void ApplyEyebrowPosition()
        {
            if (_avatarController == null) return;
            var t = _avatarController.GetLayerTransform("Eyebrow");
            if (t != null)
                t.localPosition = new Vector3(0f, EyebrowHeightSlider?.value ?? 0f, 0f);
        }

        private void ApplyMouthScale()
        {
            if (_avatarController == null) return;
            var t = _avatarController.GetLayerTransform("Mouth");
            if (t != null)
            {
                float w = MouthWidthSlider?.value ?? 1f;
                float h = MouthHeightSlider?.value ?? 1f;
                t.localScale = new Vector3(w, h, 1f);
            }
        }

        private void ApplyMakeup()
        {
            if (_avatarController == null) return;

            var blushRenderer = _avatarController.GetLayerRenderer("Blush");
            var lipRenderer = _avatarController.GetLayerRenderer("Lips");

            if (blushRenderer != null)
            {
                blushRenderer.gameObject.SetActive(_currentConfig.HasMakeup);
                if (_currentConfig.HasMakeup)
                {
                    var c = _currentConfig.BlushColor;
                    blushRenderer.color = new Color(c.r, c.g, c.b, _currentConfig.BlushIntensity);
                }
            }

            if (lipRenderer != null)
            {
                lipRenderer.gameObject.SetActive(_currentConfig.HasMakeup);
                if (_currentConfig.HasMakeup)
                    lipRenderer.color = _currentConfig.LipColor;
            }
        }

        private void RefreshFromConfig()
        {
            if (!string.IsNullOrEmpty(_currentConfig.EyeType))
                SetEyeType(_currentConfig.EyeType);
            SetEyeColor(_currentConfig.EyeColor);

            if (!string.IsNullOrEmpty(_currentConfig.EyebrowType))
                SetEyebrowType(_currentConfig.EyebrowType);

            if (!string.IsNullOrEmpty(_currentConfig.MouthType))
                SetMouthType(_currentConfig.MouthType);

            if (EnableMakeupToggle != null)
                EnableMakeupToggle.isOn = _currentConfig.HasMakeup;

            ApplyMakeup();
        }

        private void UpdateButtonSelection(Dictionary<string, Button> buttons, string selectedId)
        {
            foreach (var kvp in buttons)
            {
                var colors = kvp.Value.colors;
                colors.normalColor = kvp.Key == selectedId ? Color.yellow : Color.white;
                kvp.Value.colors = colors;
            }
        }

        #endregion
    }
}
