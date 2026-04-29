using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace KawaiiCoolIsland.Avatar.Editor
{
    /// <summary>
    /// Serializable configuration for body shape, proportions, and skin tone.
    /// </summary>
    [System.Serializable]
    public class BodyConfiguration
    {
        /// <summary>
        /// Vertical scale multiplier (0.8x to 1.2x).
        /// </summary>
        public float HeightScale = 1f;

        /// <summary>
        /// Horizontal scale multiplier (0.8x to 1.2x).
        /// </summary>
        public float WidthScale = 1f;

        /// <summary>
        /// Head size scale multiplier (0.8x to 1.2x).
        /// </summary>
        public float HeadSizeScale = 1f;

        /// <summary>
        /// Base skin tone color applied to body sprites.
        /// </summary>
        public Color SkinTone = Color.white;
    }

    /// <summary>
    /// Provides controls for customizing body proportions, height, width,
    /// head size, and skin tone with live preview updates.
    /// </summary>
    public class BodyCustomizer : MonoBehaviour
    {
        #region Header Fields

        [Header("Body Properties")]
        [SerializeField, Tooltip("Slider controlling avatar height scale (0.8x to 1.2x).")]
        public Slider HeightSlider;

        [SerializeField, Tooltip("Slider controlling avatar width scale (0.8x to 1.2x).")]
        public Slider WidthSlider;

        [SerializeField, Tooltip("Slider controlling head size scale (0.8x to 1.2x).")]
        public Slider HeadSizeSlider;

        [Header("Skin")]
        [SerializeField, Tooltip("Color picker for selecting skin tone.")]
        public ColorPicker SkinTonePicker;

        [SerializeField, Tooltip("Preset skin tone swatches available for quick selection.")]
        public List<Color> PresetSkinTones = new();

        [Header("Preview")]
        [SerializeField, Tooltip("Avatar preview component for live feedback.")]
        public AvatarPreview Preview;

        #endregion

        #region Private Fields

        private BodyConfiguration _currentConfig = new();
        private AvatarController _avatarController;
        private List<Button> _presetButtons = new();

        #endregion

        #region Events

        /// <summary>
        /// Invoked whenever any body property changes.
        /// </summary>
        public event Action OnConfigurationChanged;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            if (Preview != null)
                _avatarController = Preview.GetComponent<AvatarController>();

            InitializeSliders();
            InitializeSkinTonePicker();
        }

        private void OnEnable()
        {
            RefreshFromConfig();
        }

        #endregion

        #region Public API

        /// <summary>
        /// Sets the avatar height scale and applies it to the preview.
        /// </summary>
        /// <param name="height">Height multiplier, typically clamped 0.8 to 1.2.</param>
        public void SetHeight(float height)
        {
            _currentConfig.HeightScale = Mathf.Clamp(height, 0.8f, 1.2f);
            ApplyScale();
            OnConfigurationChanged?.Invoke();
        }

        /// <summary>
        /// Sets the avatar width scale and applies it to the preview.
        /// </summary>
        /// <param name="width">Width multiplier, typically clamped 0.8 to 1.2.</param>
        public void SetWidth(float width)
        {
            _currentConfig.WidthScale = Mathf.Clamp(width, 0.8f, 1.2f);
            ApplyScale();
            OnConfigurationChanged?.Invoke();
        }

        /// <summary>
        /// Sets the head size scale and applies it to the preview.
        /// </summary>
        /// <param name="size">Head size multiplier, typically clamped 0.8 to 1.2.</param>
        public void SetHeadSize(float size)
        {
            _currentConfig.HeadSizeScale = Mathf.Clamp(size, 0.8f, 1.2f);
            ApplyScale();
            OnConfigurationChanged?.Invoke();
        }

        /// <summary>
        /// Sets the skin tone and applies it to all body-layer sprites.
        /// </summary>
        /// <param name="color">The desired skin tone color.</param>
        public void SetSkinTone(Color color)
        {
            _currentConfig.SkinTone = color;
            ApplySkinTone();
            OnConfigurationChanged?.Invoke();
        }

        /// <summary>
        /// Applies the current body configuration to a target avatar.
        /// </summary>
        /// <param name="avatar">The AvatarController to modify.</param>
        public void ApplyToAvatar(AvatarController avatar)
        {
            if (avatar == null) return;

            var bodyTransform = avatar.GetLayerTransform("Body");
            if (bodyTransform != null)
            {
                bodyTransform.localScale = new Vector3(_currentConfig.WidthScale, _currentConfig.HeightScale, 1f);
            }

            var headTransform = avatar.GetLayerTransform("Head");
            if (headTransform != null)
            {
                headTransform.localScale = Vector3.one * _currentConfig.HeadSizeScale;
            }

            var skinRenderers = avatar.GetSkinRenderers();
            foreach (var sr in skinRenderers)
            {
                if (sr != null)
                    sr.color = _currentConfig.SkinTone;
            }
        }

        /// <summary>
        /// Returns a copy of the current body configuration.
        /// </summary>
        public BodyConfiguration GetConfiguration()
        {
            return new BodyConfiguration
            {
                HeightScale = _currentConfig.HeightScale,
                WidthScale = _currentConfig.WidthScale,
                HeadSizeScale = _currentConfig.HeadSizeScale,
                SkinTone = _currentConfig.SkinTone
            };
        }

        /// <summary>
        /// Loads a body configuration and updates all controls and preview.
        /// </summary>
        /// <param name="config">The configuration to apply.</param>
        public void LoadConfiguration(BodyConfiguration config)
        {
            if (config == null) return;

            _currentConfig = new BodyConfiguration
            {
                HeightScale = config.HeightScale,
                WidthScale = config.WidthScale,
                HeadSizeScale = config.HeadSizeScale,
                SkinTone = config.SkinTone
            };

            RefreshFromConfig();
        }

        /// <summary>
        /// Randomizes all body properties.
        /// </summary>
        public void Randomize()
        {
            SetHeight(UnityEngine.Random.Range(0.85f, 1.15f));
            SetWidth(UnityEngine.Random.Range(0.85f, 1.15f));
            SetHeadSize(UnityEngine.Random.Range(0.85f, 1.15f));
            SetSkinTone(GetRandomSkinTone());
        }

        #endregion

        #region Private Implementation

        private void InitializeSliders()
        {
            if (HeightSlider != null)
            {
                HeightSlider.minValue = 0.8f;
                HeightSlider.maxValue = 1.2f;
                HeightSlider.value = 1f;
                HeightSlider.onValueChanged.AddListener(v => SetHeight(v));
            }

            if (WidthSlider != null)
            {
                WidthSlider.minValue = 0.8f;
                WidthSlider.maxValue = 1.2f;
                WidthSlider.value = 1f;
                WidthSlider.onValueChanged.AddListener(v => SetWidth(v));
            }

            if (HeadSizeSlider != null)
            {
                HeadSizeSlider.minValue = 0.8f;
                HeadSizeSlider.maxValue = 1.2f;
                HeadSizeSlider.value = 1f;
                HeadSizeSlider.onValueChanged.AddListener(v => SetHeadSize(v));
            }
        }

        private void InitializeSkinTonePicker()
        {
            if (SkinTonePicker != null)
            {
                SkinTonePicker.onColorChanged.RemoveAllListeners();
                SkinTonePicker.onColorChanged.AddListener(SetSkinTone);
            }

            BuildPresetSwatches();
        }

        private void BuildPresetSwatches()
        {
            if (PresetSkinTones.Count == 0)
            {
                PresetSkinTones.Add(new Color(1.00f, 0.87f, 0.73f));
                PresetSkinTones.Add(new Color(0.96f, 0.80f, 0.69f));
                PresetSkinTones.Add(new Color(0.90f, 0.72f, 0.58f));
                PresetSkinTones.Add(new Color(0.78f, 0.60f, 0.48f));
                PresetSkinTones.Add(new Color(0.55f, 0.39f, 0.30f));
                PresetSkinTones.Add(new Color(0.38f, 0.27f, 0.21f));
            }
        }

        private void ApplyScale()
        {
            if (Preview != null)
            {
                var root = Preview.transform;
                root.localScale = new Vector3(_currentConfig.WidthScale, _currentConfig.HeightScale, 1f);
            }

            if (_avatarController != null)
            {
                var headTransform = _avatarController.GetLayerTransform("Head");
                if (headTransform != null)
                    headTransform.localScale = Vector3.one * _currentConfig.HeadSizeScale;
            }
        }

        private void ApplySkinTone()
        {
            if (_avatarController == null) return;

            var skinLayers = new[] { "Body", "Head" };
            foreach (var layer in skinLayers)
            {
                var renderer = _avatarController.GetLayerRenderer(layer);
                if (renderer != null)
                    renderer.color = _currentConfig.SkinTone;
            }

            EventBus.Publish(new SkinToneChangedEvent { NewColor = _currentConfig.SkinTone });
        }

        private void RefreshFromConfig()
        {
            if (HeightSlider != null) HeightSlider.value = _currentConfig.HeightScale;
            if (WidthSlider != null) WidthSlider.value = _currentConfig.WidthScale;
            if (HeadSizeSlider != null) HeadSizeSlider.value = _currentConfig.HeadSizeScale;
            if (SkinTonePicker != null) SkinTonePicker.SetColor(_currentConfig.SkinTone);

            ApplyScale();
            ApplySkinTone();
        }

        private Color GetRandomSkinTone()
        {
            if (PresetSkinTones.Count > 0)
                return PresetSkinTones[UnityEngine.Random.Range(0, PresetSkinTones.Count)];
            return new Color(1f, 0.85f, 0.7f, 1f);
        }

        #endregion
    }

    #region Events

    /// <summary>
    /// Published when the skin tone is changed.
    /// </summary>
    public struct SkinToneChangedEvent
    {
        public Color NewColor;
    }

    #endregion
}
