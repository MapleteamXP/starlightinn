using System;
using System.Collections.Generic;
using UnityEngine;

namespace KawaiiCool.Avatar
{
    /// <summary>
    /// Manages color tinting for avatar renderers (hair, skin, eyes, clothing).
    /// Uses material property blocks for efficient per-renderer color overrides
    /// without creating material instances. Works with <see cref="AvatarController"/>.
    /// </summary>
    public class ColorCustomization : MonoBehaviour
    {
        [Header("Tint Targets")]
        [Tooltip("All SpriteRenderers that can receive color tints." +
                 " Should match the renderers in AvatarController.")]
        public SpriteRenderer[] TintableRenderers;

        [Header("Default Colors")]
        [Tooltip("Default hair color for new avatars.")]
        public Color DefaultHairColor = new Color(0.85f, 0.55f, 0.25f, 1f);

        [Tooltip("Default skin tone for new avatars.")]
        public Color DefaultSkinTone = new Color(1f, 0.85f, 0.72f, 1f);

        [Tooltip("Default eye color for new avatars.")]
        public Color DefaultEyeColor = new Color(0.25f, 0.55f, 0.85f, 1f);

        // Persistent color state per category
        private Dictionary<string, Color> _colorData = new Dictionary<string, Color>(StringComparer.OrdinalIgnoreCase);

        // Material property blocks for zero-allocation color application
        private MaterialPropertyBlock _propertyBlock;
        private static readonly int ColorTintHash = Shader.PropertyToID("_Color");

        private void Awake()
        {
            _propertyBlock = new MaterialPropertyBlock();
            InitializeDefaults();
        }

        /// <summary>
        /// Applies default colors to all known categories.
        /// </summary>
        public void InitializeDefaults()
        {
            SetColor("hair", DefaultHairColor, apply: false);
            SetColor("skin", DefaultSkinTone, apply: false);
            SetColor("eyes", DefaultEyeColor, apply: false);
            SetColor("top", Color.white, apply: false);
            SetColor("bottom", Color.white, apply: false);
            SetColor("shoes", Color.white, apply: false);
            SetColor("accessory1", Color.white, apply: false);
            SetColor("accessory2", Color.white, apply: false);

            ApplyAllColors();
        }

        /// <summary>
        /// Sets the hair color tint and immediately applies it to hair renderers.
        /// </summary>
        /// <param name="color">Target hair color.</param>
        public void SetHairColor(Color color)
        {
            SetColor("hair", color);
        }

        /// <summary>
        /// Sets the skin tone tint and applies it to body and head renderers.
        /// </summary>
        /// <param name="color">Target skin tone.</param>
        public void SetSkinTone(Color color)
        {
            SetColor("skin", color);
        }

        /// <summary>
        /// Sets the eye color tint and applies it to the head/face renderer.
        /// </summary>
        /// <param name="color">Target eye color.</param>
        public void SetEyeColor(Color color)
        {
            SetColor("eyes", color);
        }

        /// <summary>
        /// Sets a color tint for a specific clothing or accessory category.
        /// </summary>
        /// <param name="category">Category name: top, bottom, shoes, accessory1, accessory2.</param>
        /// <param name="color">Target tint color.</param>
        public void SetClothingTint(string category, Color color)
        {
            if (string.IsNullOrWhiteSpace(category))
            {
                Debug.LogWarning("[ColorCustomization] Cannot tint null or empty category.");
                return;
            }
            SetColor(category, color);
        }

        /// <summary>
        /// Generic color setter for any category. Stores the value and applies it.
        /// </summary>
        /// <param name="category">Color category key.</param>
        /// <param name="color">Target color.</param>
        /// <param name="apply">If true, immediately pushes to renderers.</param>
        private void SetColor(string category, Color color, bool apply = true)
        {
            _colorData[category] = color;
            if (apply)
                ApplyColorToCategory(category, color);
        }

        /// <summary>
        /// Applies the stored color for the given category to the matching renderers.
        /// Uses material property blocks to avoid material instance bloat.
        /// </summary>
        private void ApplyColorToCategory(string category, Color color)
        {
            if (TintableRenderers == null || TintableRenderers.Length == 0)
                return;

            foreach (var renderer in TintableRenderers)
            {
                if (renderer == null) continue;

                if (RendererMatchesCategory(renderer, category))
                {
                    renderer.GetPropertyBlock(_propertyBlock);
                    _propertyBlock.SetColor(ColorTintHash, color);
                    renderer.SetPropertyBlock(_propertyBlock);
                }
            }
        }

        /// <summary>
        /// Determines if a given renderer belongs to the specified color category.
        /// Matches by GameObject name convention (e.g., "HairFront", "Body").
        /// </summary>
        private bool RendererMatchesCategory(SpriteRenderer renderer, string category)
        {
            if (renderer == null) return false;

            string name = renderer.gameObject.name.ToLowerInvariant();
            string cat = category.ToLowerInvariant();

            switch (cat)
            {
                case "hair":
                    return name.Contains("hair");
                case "skin":
                    return name.Contains("body") || name.Contains("head");
                case "eyes":
                    return name.Contains("head") || name.Contains("face");
                case "top":
                    return name.Contains("top");
                case "bottom":
                    return name.Contains("bottom");
                case "shoes":
                    return name.Contains("shoes");
                case "accessory1":
                    return name.Contains("accessory") && name.Contains("1");
                case "accessory2":
                    return name.Contains("accessory") && name.Contains("2");
                default:
                    return name.Contains(cat);
            }
        }

        /// <summary>
        /// Re-applies all stored colors to their respective renderers.
        /// Call after swapping sprites or re-enabling the avatar.
        /// </summary>
        public void ApplyAllColors()
        {
            foreach (var kvp in _colorData)
            {
                ApplyColorToCategory(kvp.Key, kvp.Value);
            }
        }

        /// <summary>
        /// Resets all tints to white (no tint) and clears stored color data.
        /// </summary>
        public void ResetAllColors()
        {
            _colorData.Clear();
            if (TintableRenderers == null) return;

            foreach (var renderer in TintableRenderers)
            {
                if (renderer == null) continue;
                renderer.GetPropertyBlock(_propertyBlock);
                _propertyBlock.SetColor(ColorTintHash, Color.white);
                renderer.SetPropertyBlock(_propertyBlock);
            }
        }

        /// <summary>
        /// Loads colors from a serialized dictionary (e.g., from save data).
        /// </summary>
        /// <param name="colors">Dictionary mapping category name to Color.</param>
        public void LoadColors(Dictionary<string, Color> colors)
        {
            if (colors == null) return;

            foreach (var kvp in colors)
            {
                _colorData[kvp.Key] = kvp.Value;
            }

            ApplyAllColors();
        }

        /// <summary>
        /// Saves current colors to a serializable dictionary for persistence.
        /// </summary>
        /// <returns>Dictionary mapping category name to Color.</returns>
        public Dictionary<string, Color> SaveColors()
        {
            return new Dictionary<string, Color>(_colorData, StringComparer.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Returns the current color for a given category, or white if not set.
        /// </summary>
        /// <param name="category">Category name to look up.</param>
        public Color GetColor(string category)
        {
            if (_colorData.TryGetValue(category, out Color color))
                return color;
            return Color.white;
        }

        /// <summary>
        /// Resets a single category to its default color.
        /// </summary>
        /// <param name="category">Category to reset.</param>
        public void ResetToDefault(string category)
        {
            switch (category?.ToLowerInvariant())
            {
                case "hair":
                    SetHairColor(DefaultHairColor);
                    break;
                case "skin":
                    SetSkinTone(DefaultSkinTone);
                    break;
                case "eyes":
                    SetEyeColor(DefaultEyeColor);
                    break;
                default:
                    SetClothingTint(category, Color.white);
                    break;
            }
        }
    }
}
