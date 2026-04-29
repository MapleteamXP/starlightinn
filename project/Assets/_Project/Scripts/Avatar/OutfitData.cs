using System;
using System.Collections.Generic;
using UnityEngine;

namespace KawaiiCool.Avatar
{
    /// <summary>
    /// ScriptableObject representing a complete outfit preset that can be applied
    /// to an <see cref="AvatarController"/> in one call. Useful for shop mannequins,
    /// saved outfits, NPCs, and starter kits.
    /// </summary>
    [CreateAssetMenu(fileName = "Outfit_", menuName = "KawaiiCool/Outfit")]
    public class OutfitData : ScriptableObject
    {
        [Header("Info")]
        [Tooltip("Display name for this outfit preset.")]
        public string OutfitName = "New Outfit";

        [Tooltip("Flavor description shown in UI tooltips.")]
        [TextArea(2, 4)]
        public string Description;

        [Tooltip("Thumbnail sprite shown in wardrobe / shop UI.")]
        public Sprite Thumbnail;

        [Header("Body Parts")]
        [Tooltip("Body skin variant label in the Sprite Library. Default = 'default'.")] 
        public string Body = "default";

        [Tooltip("Hair style label. Default = 'default'.")]
        public string Hair = "default";

        [Tooltip("Face expression label. Default = 'default'.")]
        public string Face = "default";

        [Tooltip("Top clothing label. 'none' = unequip.")]
        public string Top = "none";

        [Tooltip("Bottom clothing label. 'none' = unequip.")]
        public string Bottom = "none";

        [Tooltip("Shoes label. Default = 'default'.")]
        public string Shoes = "default";

        [Tooltip("Primary accessory label. 'none' = unequip.")]
        public string Accessory1 = "none";

        [Tooltip("Secondary accessory label. 'none' = unequip.")]
        public string Accessory2 = "none";

        /// <summary>
        /// Converts this outfit to a dictionary mapping category names to sprite labels.
        /// Used for serialization and runtime application.
        /// </summary>
        /// <returns>Dictionary of category name -> sprite label.</returns>
        public Dictionary<string, string> ToDictionary()
        {
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "body", Body },
                { "hair", Hair },
                { "face", Face },
                { "top", Top },
                { "bottom", Bottom },
                { "shoes", Shoes },
                { "accessory1", Accessory1 },
                { "accessory2", Accessory2 }
            };
        }

        /// <summary>
        /// Creates an <see cref="OutfitData"/> instance from a serialized dictionary.
        /// Useful for loading saved outfits from JSON / PlayerPrefs / cloud save.
        /// </summary>
        /// <param name="data">Dictionary of category name -> sprite label.</param>
        /// <returns>A new OutfitData instance populated from the dictionary.</returns>
        public static OutfitData FromDictionary(Dictionary<string, string> data)
        {
            if (data == null)
            {
                Debug.LogWarning("[OutfitData] Cannot create outfit from null dictionary.");
                return null;
            }

            var outfit = CreateInstance<OutfitData>();
            outfit.OutfitName = "Loaded Outfit";

            string GetValue(string key, string defaultValue)
            {
                return data.TryGetValue(key, out string value) && !string.IsNullOrWhiteSpace(value)
                    ? value
                    : defaultValue;
            }

            outfit.Body = GetValue("body", "default");
            outfit.Hair = GetValue("hair", "default");
            outfit.Face = GetValue("face", "default");
            outfit.Top = GetValue("top", "none");
            outfit.Bottom = GetValue("bottom", "none");
            outfit.Shoes = GetValue("shoes", "default");
            outfit.Accessory1 = GetValue("accessory1", "none");
            outfit.Accessory2 = GetValue("accessory2", "none");

            return outfit;
        }

        /// <summary>
        /// Populates this outfit's fields from a dictionary (mutates in-place).
        /// </summary>
        /// <param name="data">Dictionary of category name -> sprite label.</param>
        public void ApplyFromDictionary(Dictionary<string, string> data)
        {
            if (data == null) return;

            string GetValue(string key, string current) =>
                data.TryGetValue(key, out string value) && !string.IsNullOrWhiteSpace(value)
                    ? value
                    : current;

            Body = GetValue("body", Body);
            Hair = GetValue("hair", Hair);
            Face = GetValue("face", Face);
            Top = GetValue("top", Top);
            Bottom = GetValue("bottom", Bottom);
            Shoes = GetValue("shoes", Shoes);
            Accessory1 = GetValue("accessory1", Accessory1);
            Accessory2 = GetValue("accessory2", Accessory2);
        }

        private void OnValidate()
        {
            if (string.IsNullOrWhiteSpace(OutfitName) || OutfitName == "New Outfit")
            {
                OutfitName = ObjectNames.NicifyVariableName(name.Replace("Outfit_", ""));
            }
        }
    }
}
