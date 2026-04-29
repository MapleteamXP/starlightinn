using UnityEngine;

namespace KawaiiCool.Onboarding
{
    /// <summary>
    /// Represents a single reward that can be granted during onboarding, tutorials, or wizard phases.
    /// </summary>
    [System.Serializable]
    public class RewardData
    {
        [Tooltip("Unique identifier for this reward type.")]
        public string RewardId;

        [Tooltip("Display name shown to the player.")]
        public string DisplayName;

        [Tooltip("Icon sprite for UI representation.")]
        public Sprite Icon;

        [Tooltip("Quantity of the reward to grant.")]
        public int Quantity = 1;

        [Tooltip("Type of reward: Currency, Item, Clothing, Furniture, Badge, etc.")]
        public RewardType Type;

        [Tooltip("Optional reference ID for the specific item or catalog entry.")]
        public string CatalogId;

        [Tooltip("Whether this reward should be shown in the reward panel.")]
        public bool ShowInUI = true;

        [Tooltip("Optional flavor text for the reward.")]
        public string Description;
    }

    /// <summary>
    /// Enumerates the types of rewards available in KawaiiCool Island.
    /// </summary>
    public enum RewardType
    {
        None,
        Coins,
        Gems,
        Experience,
        Item,
        Clothing,
        Furniture,
        Badge,
        Emote,
        Title,
        Wallpaper,
        AvatarPart
    }
}
