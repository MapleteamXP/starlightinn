using System.Collections.Generic;
using UnityEngine;

namespace KawaiiCool.Avatar
{
    /// <summary>
    /// Defines the equip slot / render layer for an avatar part.
    /// </summary>
    public enum PartCategory
    {
        /// <summary>Base body skin layer.</summary>
        Body,
        /// <summary>Hair layer (renders behind and in front of head).</summary>
        Hair,
        /// <summary>Face expression / eyes / mouth layer.</summary>
        Face,
        /// <summary>Top clothing layer (shirts, jackets).</summary>
        Top,
        /// <summary>Bottom clothing layer (pants, skirts).</summary>
        Bottom,
        /// <summary>Footwear layer.</summary>
        Shoes,
        /// <summary>Primary accessory layer.</summary>
        Accessory1,
        /// <summary>Secondary accessory layer.</summary>
        Accessory2
    }

    /// <summary>
    /// Item rarity tier affecting drop rates, visual flair, and trade value.
    /// </summary>
    public enum ItemRarity
    {
        Common,
        Uncommon,
        Rare,
        Epic,
        Legendary
    }

    /// <summary>
    /// ScriptableObject representing a single equippable avatar part
    /// (hair, clothing, accessory, etc.) with sprites, animation, and economy data.
    /// </summary>
    [CreateAssetMenu(fileName = "Part_", menuName = "KawaiiCool/Avatar Part")]
    public class AvatarPartData : ScriptableObject
    {
        [Header("Identity")]
        [Tooltip("Unique identifier used for saving/loading and runtime lookups.")]
        public string PartId;

        [Tooltip("Human-readable name shown in UI.")]
        public string DisplayName;

        [Tooltip("Flavor description shown in tooltips and shop.")] 
        [TextArea(2, 4)]
        public string Description;

        [Tooltip("Icon sprite displayed in inventory and shop UI.")]
        public Sprite Icon;

        [Tooltip("Rarity tier determining visual effects and value.")]
        public ItemRarity Rarity = ItemRarity.Common;

        [Header("Category")]
        [Tooltip("Which body layer / equip slot this part occupies.")]
        public PartCategory Category;

        [Header("Sprites")]
        [Tooltip("Default forward-facing sprite for this part.")]
        public Sprite FrontSprite;

        [Tooltip("Optional rear-facing sprite (used for hair back layers).")]
        public Sprite BackSprite;

        [Tooltip("Optional side-facing sprite for profile views.")]
        public Sprite SideSprite;

        [Header("Animation")]
        [Tooltip("If true, this part supplies custom idle/walk animation clips.")]
        public bool HasCustomAnimation;

        [Tooltip("Custom idle animation clip (overrides base body idle).")]
        public AnimationClip CustomIdleClip;

        [Tooltip("Custom walk/move animation clip (overrides base body walk).")]
        public AnimationClip CustomWalkClip;

        [Header("Compatibility")]
        [Tooltip("List of body type IDs this part can be equipped on. Empty = all bodies.")]
        public List<string> CompatibleBodies = new List<string>();

        [Tooltip("List of PartIds that conflict with this part (mutually exclusive).")]
        public List<string> IncompatibleParts = new List<string>();

        [Header("Economy")]
        [Tooltip("Purchase price in the specified currency.")]
        public int PurchasePrice;

        [Tooltip("Currency type: coins, gems, tickets, etc.")]
        public string CurrencyType = "coins";

        [Tooltip("If true, requires real-money currency or premium pass.")]
        public bool IsPremium;

        [Tooltip("If true, can be traded with other players.")]
        public bool IsTradeable = true;

        /// <summary>
        /// Returns the appropriate sprite for the given facing direction.
        /// Falls back through Side -> Back -> Front if the preferred sprite is null.
        /// </summary>
        /// <param name="facingRight">True if facing right (side view).</param>
        /// <param name="isBack">True if rear-facing view is needed.</param>
        public Sprite GetSpriteForDirection(bool facingRight = false, bool isBack = false)
        {
            if (isBack && BackSprite != null)
                return BackSprite;
            if (SideSprite != null)
                return SideSprite;
            if (BackSprite != null)
                return BackSprite;
            return FrontSprite;
        }

        /// <summary>
        /// Checks if this part is compatible with the given body type ID.
        /// </summary>
        /// <param name="bodyTypeId">The body type to check compatibility against.</param>
        public bool IsCompatibleWithBody(string bodyTypeId)
        {
            if (string.IsNullOrEmpty(bodyTypeId))
                return false;
            if (CompatibleBodies == null || CompatibleBodies.Count == 0)
                return true;
            return CompatibleBodies.Contains(bodyTypeId);
        }

        /// <summary>
        /// Checks if this part conflicts with the given part ID.
        /// </summary>
        /// <param name="partId">The PartId to check for conflict.</param>
        public bool ConflictsWith(string partId)
        {
            if (string.IsNullOrEmpty(partId) || IncompatibleParts == null)
                return false;
            return IncompatibleParts.Contains(partId);
        }

        private void OnValidate()
        {
            if (string.IsNullOrWhiteSpace(PartId))
            {
                PartId = name.Replace("Part_", "").ToLowerInvariant().Trim();
            }

            if (string.IsNullOrWhiteSpace(DisplayName))
            {
                DisplayName = ObjectNames.NicifyVariableName(name.Replace("Part_", ""));
            }
        }
    }
}
