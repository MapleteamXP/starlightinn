// ----------------------------------------------------------------------------
// KawaiiCool Island - Core Framework
// ----------------------------------------------------------------------------
// ScriptableObjectArchitecture.cs - Base classes for ScriptableObject data
// ----------------------------------------------------------------------------
// Provides the ScriptableObject data architecture for all game content:
// items, clothing, emotes, placeable objects, and more.
// All data assets use [CreateAssetMenu] for easy editor creation.
// Follows a hierarchical design with shared base properties.
// ----------------------------------------------------------------------------

using System;
using UnityEngine;

namespace KawaiiCoolIsland.Core.Data
{
    #region Enums

    /// <summary>
    /// Defines the rarity tiers for items. Affects drop rates, visual effects, and value.
    /// </summary>
    public enum ItemRarity
    {
        /// <summary>Common items - frequently obtained.</summary>
        Common = 0,

        /// <summary>Uncommon items - moderate drop rate.</summary>
        Uncommon = 1,

        /// <summary>Rare items - low drop rate, visible glow effect.</summary>
        Rare = 2,

        /// <summary>Epic items - very low drop rate, animated effects.</summary>
        Epic = 3,

        /// <summary>Legendary items - extremely rare, unique visual flair.</summary>
        Legendary = 4,

        /// <summary>Mythic items - event-only or one-time rewards.</summary>
        Mythic = 5
    }

    /// <summary>
    /// Defines the broad category of an item for inventory organization and filtering.
    /// </summary>
    public enum ItemCategory
    {
        /// <summary>Clothing and wearable items.</summary>
        Clothing,

        /// <summary>Accessories like hats, glasses, jewelry.</summary>
        Accessory,

        /// <summary>Furniture and decorative objects for islands.</summary>
        Furniture,

        /// <summary>Emotes and dance animations.</summary>
        Emote,

        /// <summary>Consumable items with temporary effects.</summary>
        Consumable,

        /// <summary>Currency bundles and tokens.</summary>
        Currency,

        /// <summary>Special event and seasonal items.</summary>
        Event,

        /// <summary>Building blocks and terrain modifiers.</summary>
        Building
    }

    /// <summary>
    /// Defines the clothing slot where an item is equipped.
    /// </summary>
    public enum ClothingSlot
    {
        /// <summary>Headwear (hats, caps, headbands).</summary>
        Hat,

        /// <summary>Face accessories (glasses, masks).</summary>
        Face,

        /// <summary>Top/shirt layer.</summary>
        Shirt,

        /// <summary>Bottom/pants layer.</summary>
        Pants,

        /// <summary>Full-body outfits (overrides shirt + pants).</summary>
        Outfit,

        /// <summary>Footwear.</summary>
        Shoes,

        /// <summary>Handheld items.</summary>
        Handheld,

        /// <summary>Back accessories (wings, backpacks, capes).</summary>
        Back
    }

    /// <summary>
    /// Defines the type of emote animation.
    /// </summary>
    public enum EmoteType
    {
        /// <summary>Greeting and social gestures.</summary>
        Greeting,

        /// <summary>Dance animations.</summary>
        Dance,

        /// <summary>Reaction expressions (laugh, cry, surprise).</summary>
        Reaction,

        /// <summary>Poses and idle stances.</summary>
        Pose,

        /// <summary>Special/celebration emotes.</summary>
        Special
    }

    /// <summary>
    /// Defines how a placeable object snaps to the island grid.
    /// </summary>
    public enum PlacementSnapType
    {
        /// <summary>No snapping - free placement.</summary>
        Free,

        /// <summary>Snap to a unit grid.</summary>
        Grid,

        /// <summary>Snap to the center of grid cells.</summary>
        GridCenter,

        /// <summary>Snap to the ground surface.</summary>
        Surface
    }

    #endregion

    #region ItemData Base Class

    /// <summary>
    /// Base class for all item data in the game. Provides shared properties
    /// like identification, display info, rarity, pricing, and categorization.
    /// </summary>
    public abstract class ItemData : ScriptableObject
    {
        #region Identification

        /// <summary>
        /// Unique identifier for this item. Must be globally unique across all items.
        /// </summary>
        [Header("Identification")]
        [Tooltip("Unique item ID. Format: Category_ItemName (e.g., 'Hat_SunnyCap')")]
        public string ItemId;

        /// <summary>
        /// Display name shown to players in UI.
        /// </summary>
        [Tooltip("Display name shown in-game.")]
        public string DisplayName;

        /// <summary>
        /// Detailed description of the item.
        /// </summary>
        [Tooltip("Description shown in tooltips and detail views.")]
        [TextArea(2, 4)]
        public string Description;

        #endregion

        #region Categorization

        /// <summary>
        /// The item's rarity tier. Affects drop rates and visual presentation.
        /// </summary>
        [Header("Categorization")]
        [Tooltip("Rarity affects drop rates and visual effects.")]
        public ItemRarity Rarity = ItemRarity.Common;

        /// <summary>
        /// The broad category this item belongs to.
        /// </summary>
        [Tooltip("Item category for inventory organization.")]
        public ItemCategory Category;

        /// <summary>
        /// Sub-category for more specific filtering (e.g., "Summer", "Gothic").
        /// </summary>
        [Tooltip("Sub-category tag for filtering (e.g., 'Summer', 'Gothic', 'Fantasy').")]
        public string SubCategory = string.Empty;

        #endregion

        #region Visuals

        /// <summary>
        /// The primary icon displayed in inventory and UI.
        /// </summary>
        [Header("Visuals")]
        [Tooltip("Inventory/UI icon for this item.")]
        public Sprite Icon;

        /// <summary>
        /// Optional preview image for detailed views.
        /// </summary>
        [Tooltip("Optional larger preview image for detail panels.")]
        public Sprite PreviewImage;

        /// <summary>
        /// Color tint applied to the item's UI representation based on rarity.
        /// </summary>
        public Color RarityColor => GetRarityColor(Rarity);

        #endregion

        #region Economy

        /// <summary>
        /// Purchase price in the primary currency (Coins).
        /// -1 means not purchasable.
        /// </summary>
        [Header("Economy")]
        [Tooltip("Price in Coins. -1 = not purchasable.")]
        public int CoinPrice = -1;

        /// <summary>
        /// Purchase price in premium currency (Gems).
        /// -1 means not purchasable with Gems.
        /// </summary>
        [Tooltip("Price in Gems. -1 = not purchasable with Gems.")]
        public int GemPrice = -1;

        /// <summary>
        /// Sell value in Coins when sold to the shop.
        /// </summary>
        [Tooltip("Sell value in Coins. 0 = cannot be sold.")]
        public int SellValue = 0;

        /// <summary>
        /// Whether this item can be traded between players.
        /// </summary>
        [Tooltip("Can this item be traded between players?")]
        public bool IsTradable = true;

        /// <summary>
        /// Whether this item can be gifted to friends.
        /// </summary>
        [Tooltip("Can this item be gifted to friends?")]
        public bool IsGiftable = true;

        #endregion

        #region Availability

        /// <summary>
        /// Whether this item is available in the game (can be disabled for events).
        /// </summary>
        [Header("Availability")]
        [Tooltip("If false, this item is hidden from players.")]
        public bool IsAvailable = true;

        /// <summary>
        /// If true, this item is only available during specific events.
        /// </summary>
        [Tooltip("Is this a limited-time event item?")]
        public bool IsEventLimited = false;

        /// <summary>
        /// The name of the event this item is associated with, if event-limited.
        /// </summary>
        [Tooltip("Event name if this is an event-limited item.")]
        public string EventName = string.Empty;

        /// <summary>
        /// Minimum player level required to use/equip this item.
        /// </summary>
        [Tooltip("Minimum player level to use this item.")]
        public int RequiredLevel = 1;

        #endregion

        #region Utility Methods

        /// <summary>
        /// Gets the display color associated with a rarity tier.
        /// </summary>
        /// <param name="rarity">The rarity tier.</param>
        /// <returns>The color for that rarity.</returns>
        public static Color GetRarityColor(ItemRarity rarity)
        {
            return rarity switch
            {
                ItemRarity.Common => new Color(0.8f, 0.8f, 0.8f),      // Light Gray
                ItemRarity.Uncommon => new Color(0.4f, 0.8f, 0.4f),     // Green
                ItemRarity.Rare => new Color(0.3f, 0.6f, 1.0f),         // Blue
                ItemRarity.Epic => new Color(0.7f, 0.3f, 1.0f),         // Purple
                ItemRarity.Legendary => new Color(1.0f, 0.6f, 0.1f),    // Orange
                ItemRarity.Mythic => new Color(1.0f, 0.2f, 0.4f),       // Pink/Red
                _ => Color.white
            };
        }

        /// <summary>
        /// Checks if the player can afford this item with the given balances.
        /// </summary>
        /// <param name="coins">Available coins.</param>
        /// <param name="gems">Available gems.</param>
        /// <returns>True if the item can be purchased.</returns>
        public bool CanAfford(int coins, int gems)
        {
            bool canAffordCoins = CoinPrice <= 0 || coins >= CoinPrice;
            bool canAffordGems = GemPrice <= 0 || gems >= GemPrice;
            return canAffordCoins && canAffordGems;
        }

        /// <summary>
        /// Validates that the item data is properly configured.
        /// </summary>
        /// <returns>True if the data is valid.</returns>
        public virtual bool Validate()
        {
            if (string.IsNullOrEmpty(ItemId))
            {
                Debug.LogError($"[ItemData] {name}: ItemId is empty!");
                return false;
            }
            if (string.IsNullOrEmpty(DisplayName))
            {
                Debug.LogWarning($"[ItemData] {name}: DisplayName is empty.");
            }
            if (Icon == null)
            {
                Debug.LogWarning($"[ItemData] {name}: Icon is not assigned.");
            }
            return true;
        }

        #endregion
    }

    #endregion

    #region ClothingData

    /// <summary>
    /// Data asset for clothing and wearable items.
    /// Extends ItemData with sprite references for each clothing layer and slot information.
    /// </summary>
    [CreateAssetMenu(
        fileName = "ClothingData_New",
        menuName = "KawaiiCool Island/Item Data/Clothing",
        order = 10
    )]
    public class ClothingData : ItemData
    {
        #region Clothing Specifics

        /// <summary>
        /// The body slot this clothing item equips to.
        /// </summary>
        [Header("Clothing Configuration")]
        [Tooltip("Which equipment slot this clothing uses.")]
        public ClothingSlot Slot;

        /// <summary>
        /// If true, this clothing is gender-specific.
        /// </summary>
        [Tooltip("Is this clothing gender-specific?")]
        public bool GenderSpecific = false;

        /// <summary>
        /// The target gender if GenderSpecific is true. 0=Unisex, 1=Masculine, 2=Feminine.
        /// </summary>
        [Tooltip("Target gender style if gender-specific. 0=Unisex, 1=Masc, 2=Fem")]
        public int TargetGender = 0;

        #endregion

        #region Sprite References

        /// <summary>
        /// Front-facing sprite for the 2D avatar view.
        /// </summary>
        [Header("Sprites")]
        [Tooltip("Front-facing sprite for 2D avatar view.")]
        public Sprite FrontSprite;

        /// <summary>
        /// Back-facing sprite for the 2D avatar view.
        /// </summary>
        [Tooltip("Back-facing sprite for 2D avatar view.")]
        public Sprite BackSprite;

        /// <summary>
        /// Side-facing sprite for the 2D avatar view.
        /// </summary>
        [Tooltip("Side-facing sprite for 2D avatar view.")]
        public Sprite SideSprite;

        /// <summary>
        /// Sprite sheet for animated clothing (optional, overrides single sprites).
        /// </summary>
        [Tooltip("Optional sprite sheet for animated clothing.")]
        public Sprite[] AnimationFrames;

        #endregion

        #region 3D/World View

        /// <summary>
        /// Prefab for the 3D world-space representation (optional).
        /// </summary>
        [Header("3D / World View")]
        [Tooltip("Optional 3D prefab for world-space rendering.")]
        public GameObject WorldPrefab;

        /// <summary>
        /// Offset position when attached to the avatar in world space.
        /// </summary>
        [Tooltip("Position offset when attached to avatar.")]
        public Vector3 WorldOffset = Vector3.zero;

        /// <summary>
        /// Scale multiplier for the world-space representation.
        /// </summary>
        [Tooltip("Scale multiplier in world space.")]
        public Vector3 WorldScale = Vector3.one;

        #endregion

        #region Layering

        /// <summary>
        /// Sorting order for layered rendering. Higher values render on top.
        /// </summary>
        [Header("Layering")]
        [Tooltip("Render sorting order. Higher = drawn on top.")]
        public int SortingOrder = 0;

        /// <summary>
        /// If true, this clothing hides the body part underneath (e.g., full outfit hides shirt/pants).
        /// </summary>
        [Tooltip("If true, hides the underlying body/clothing layer.")]
        public bool HidesUnderlyingLayer = false;

        #endregion

        #region Validation

        /// <summary>
        /// Validates clothing-specific data.
        /// </summary>
        /// <returns>True if valid.</returns>
        public override bool Validate()
        {
            if (!base.Validate()) return false;

            if (FrontSprite == null && (AnimationFrames == null || AnimationFrames.Length == 0))
            {
                Debug.LogWarning($"[ClothingData] {name}: No front sprite or animation frames assigned.");
            }

            return true;
        }

        #endregion
    }

    #endregion

    #region EmoteData

    /// <summary>
    /// Data asset for emote animations.
    /// Defines the animation clip, sound effects, duration, and unlock requirements.
    /// </summary>
    [CreateAssetMenu(
        fileName = "EmoteData_New",
        menuName = "KawaiiCool Island/Item Data/Emote",
        order = 20
    )]
    public class EmoteData : ItemData
    {
        #region Animation

        /// <summary>
        /// The type/category of this emote.
        /// </summary>
        [Header("Animation")]
        [Tooltip("Category of emote.")]
        public EmoteType EmoteType = EmoteType.Greeting;

        /// <summary>
        /// Animation clip played when the emote is triggered.
        /// </summary>
        [Tooltip("Animation clip for this emote.")]
        public AnimationClip AnimationClip;

        /// <summary>
        /// Duration of the emote in seconds. Overrides animation clip length if > 0.
        /// </summary>
        [Tooltip("Emote duration in seconds. 0 = use animation clip length.")]
        public float Duration = 0f;

        /// <summary>
        /// Whether the emote can be cancelled early by player input.
        /// </summary>
        [Tooltip("Can the player cancel this emote early?")]
        public bool IsCancellable = true;

        /// <summary>
        /// Whether the emote loops until cancelled.
        /// </summary>
        [Tooltip("Does this emote loop until cancelled?")]
        public bool IsLooping = false;

        #endregion

        #region Audio

        /// <summary>
        /// Sound effect played when the emote starts.
        /// </summary>
        [Header("Audio")]
        [Tooltip("SFX played when emote starts.")]
        public AudioClip StartSFX;

        /// <summary>
        /// Looping sound effect played during the emote.
        /// </summary>
        [Tooltip("Looping SFX during emote (optional).")]
        public AudioClip LoopSFX;

        /// <summary>
        /// Sound effect played when the emote ends.
        /// </summary>
        [Tooltip("SFX played when emote ends.")]
        public AudioClip EndSFX;

        /// <summary>
        /// Volume multiplier for all emote audio.
        /// </summary>
        [Tooltip("Audio volume multiplier.")]
        [Range(0f, 1f)]
        public float AudioVolume = 1f;

        #endregion

        #region Visual Effects

        /// <summary>
        /// Particle effect prefab spawned during the emote.
        /// </summary>
        [Header("Visual Effects")]
        [Tooltip("Particle effect prefab (optional).")]
        public GameObject ParticleEffectPrefab;

        /// <summary>
        /// Offset position for particle effects relative to the player.
        /// </summary>
        [Tooltip("Particle effect position offset.")]
        public Vector3 ParticleOffset = Vector3.zero;

        /// <summary>
        /// Screen-space UI effect prefab (e.g., emoji popup).
        /// </summary>
        [Tooltip("UI effect prefab (optional, e.g., emoji popup).")]
        public GameObject UIEffectPrefab;

        #endregion

        #region Cooldown & Spam Prevention

        /// <summary>
        /// Cooldown duration before this emote can be used again.
        /// </summary>
        [Header("Cooldown")]
        [Tooltip("Cooldown in seconds before reusing this emote.")]
        public float Cooldown = 0f;

        /// <summary>
        /// Whether this emote triggers the global emote cooldown.
        /// </summary>
        [Tooltip("Does this emote trigger the global cooldown?")]
        public bool TriggersGlobalCooldown = true;

        #endregion

        #region Utility

        /// <summary>
        /// Gets the effective duration of this emote.
        /// </summary>
        /// <returns>Duration in seconds.</returns>
        public float GetDuration()
        {
            if (Duration > 0f) return Duration;
            if (AnimationClip != null) return AnimationClip.length;
            return 1f; // Fallback default
        }

        /// <summary>
        /// Validates emote-specific data.
        /// </summary>
        /// <returns>True if valid.</returns>
        public override bool Validate()
        {
            if (!base.Validate()) return false;

            if (AnimationClip == null && Duration <= 0f)
            {
                Debug.LogWarning($"[EmoteData] {name}: No animation clip and no duration set.");
            }

            return true;
        }

        #endregion
    }

    #endregion

    #region PlaceableObjectData

    /// <summary>
    /// Data asset for objects that can be placed on the player's island.
    /// Includes placement rules, grid snapping, and interaction settings.
    /// </summary>
    [CreateAssetMenu(
        fileName = "PlaceableObjectData_New",
        menuName = "KawaiiCool Island/Item Data/Placeable Object",
        order = 30
    )]
    public class PlaceableObjectData : ItemData
    {
        #region Placement

        /// <summary>
        /// The prefab instantiated when placing this object.
        /// </summary>
        [Header("Placement")]
        [Tooltip("Prefab spawned when this object is placed.")]
        public GameObject PlaceablePrefab;

        /// <summary>
        /// Grid snapping behavior for placement.
        /// </summary>
        [Tooltip("How this object snaps during placement.")]
        public PlacementSnapType SnapType = PlacementSnapType.Grid;

        /// <summary>
        /// Grid size for snapping. 1 = 1 Unity unit.
        /// </summary>
        [Tooltip("Grid snap size in Unity units.")]
        public float GridSize = 1f;

        /// <summary>
        /// The footprint size on the grid (width, height).
        /// </summary>
        [Tooltip("Footprint size in grid units (X=width, Y=depth).")]
        public Vector2Int FootprintSize = new Vector2Int(1, 1);

        /// <summary>
        /// Maximum height offset this object can be placed at.
        /// </summary>
        [Tooltip("Maximum placement height offset.")]
        public float MaxHeightOffset = 0f;

        /// <summary>
        /// Whether this object can be placed on water.
        /// </summary>
        [Tooltip("Can this object be placed on water?")]
        public bool CanPlaceOnWater = false;

        /// <summary>
        /// Whether this object can be placed on slopes.
        /// </summary>
        [Tooltip("Can this object be placed on slopes?")]
        public bool CanPlaceOnSlope = true;

        /// <summary>
        /// Maximum slope angle this object can be placed on.
        /// </summary>
        [Tooltip("Maximum slope angle in degrees.")]
        [Range(0f, 90f)]
        public float MaxSlopeAngle = 45f;

        #endregion

        #region Transform

        /// <summary>
        /// Default scale when placed.
        /// </summary>
        [Header("Transform")]
        [Tooltip("Default scale when placed.")]
        public Vector3 DefaultScale = Vector3.one;

        /// <summary>
        /// Whether the player can rotate this object after placement.
        /// </summary>
        [Tooltip("Can the player rotate this object?")]
        public bool AllowRotation = true;

        /// <summary>
        /// Rotation snap increments in degrees. 0 = free rotation.
        /// </summary>
        [Tooltip("Rotation snap in degrees. 0 = free rotation.")]
        public float RotationSnap = 90f;

        /// <summary>
        /// Whether the player can scale this object after placement.
        /// </summary>
        [Tooltip("Can the player resize this object?")]
        public bool AllowScaling = false;

        /// <summary>
        /// Minimum scale multiplier if scaling is enabled.
        /// </summary>
        [Tooltip("Minimum scale multiplier.")]
        public float MinScale = 0.5f;

        /// <summary>
        /// Maximum scale multiplier if scaling is enabled.
        /// </summary>
        [Tooltip("Maximum scale multiplier.")]
        public float MaxScale = 2f;

        #endregion

        #region Interaction

        /// <summary>
        /// Whether players can interact with this object.
        /// </summary>
        [Header("Interaction")]
        [Tooltip("Can players interact with this object?")]
        public bool IsInteractable = false;

        /// <summary>
        /// The interaction prompt text shown to players.
        /// </summary>
        [Tooltip("Interaction prompt text (e.g., 'Sit', 'Open').")]
        public string InteractionPrompt = string.Empty;

        /// <summary>
        /// Whether this object triggers a state change when interacted with.
        /// </summary>
        [Tooltip("Does interaction toggle an animation/state?")]
        public bool HasToggleState = false;

        /// <summary>
        /// Animation trigger name for interaction, if applicable.
        /// </summary>
        [Tooltip("Animator trigger name for interaction.")]
        public string InteractionTriggerName = string.Empty;

        #endregion

        #region Preview

        /// <summary>
        /// Preview material used during placement (typically semi-transparent).
        /// </summary>
        [Header("Preview")]
        [Tooltip("Material for placement preview (usually transparent).")]
        public Material PreviewMaterial;

        /// <summary>
        /// Valid placement preview color.
        /// </summary>
        [Tooltip("Preview color when placement is valid.")]
        public Color ValidPlacementColor = new Color(0f, 1f, 0f, 0.5f);

        /// <summary>
        /// Invalid placement preview color.
        /// </summary>
        [Tooltip("Preview color when placement is invalid.")]
        public Color InvalidPlacementColor = new Color(1f, 0f, 0f, 0.5f);

        #endregion

        #region Validation

        /// <summary>
        /// Validates placeable object data.
        /// </summary>
        /// <returns>True if valid.</returns>
        public override bool Validate()
        {
            if (!base.Validate()) return false;

            if (PlaceablePrefab == null)
            {
                Debug.LogError($"[PlaceableObjectData] {name}: PlaceablePrefab is required!");
                return false;
            }

            if (FootprintSize.x <= 0 || FootprintSize.y <= 0)
            {
                Debug.LogWarning($"[PlaceableObjectData] {name}: Footprint size must be positive.");
                FootprintSize = new Vector2Int(1, 1);
            }

            return true;
        }

        #endregion
    }

    #endregion

    #region ConsumableData

    /// <summary>
    /// Data asset for consumable items with temporary or one-time effects.
    /// </summary>
    [CreateAssetMenu(
        fileName = "ConsumableData_New",
        menuName = "KawaiiCool Island/Item Data/Consumable",
        order = 40
    )]
    public class ConsumableData : ItemData
    {
        #region Consumable Settings

        /// <summary>
        /// Whether this consumable is consumed on use.
        /// </summary>
        [Header("Consumable Settings")]
        [Tooltip("Is this item consumed when used?")]
        public bool IsConsumed = true;

        /// <summary>
        /// Maximum stack size in inventory.
        /// </summary>
        [Tooltip("Maximum stack size in inventory.")]
        public int MaxStackSize = 99;

        /// <summary>
        /// Cooldown between uses in seconds.
        /// </summary>
        [Tooltip("Cooldown between uses in seconds.")]
        public float UseCooldown = 0f;

        #endregion

        #region Effects

        /// <summary>
        /// Type of effect this consumable applies.
        /// </summary>
        [Header("Effects")]
        [Tooltip("Effect type applied when consumed.")]
        public ConsumableEffectType EffectType = ConsumableEffectType.None;

        /// <summary>
        /// Primary effect value (e.g., XP amount, speed multiplier).
        /// </summary>
        [Tooltip("Primary effect value.")]
        public float EffectValue = 0f;

        /// <summary>
        /// Duration of the effect in seconds. 0 = instant.
        /// </summary>
        [Tooltip("Effect duration in seconds. 0 = instant.")]
        public float EffectDuration = 0f;

        /// <summary>
        /// Particle effect spawned when consumed.
        /// </summary>
        [Tooltip("Particle effect on consumption.")]
        public GameObject ConsumeEffectPrefab;

        /// <summary>
        /// Sound effect played when consumed.
        /// </summary>
        [Tooltip("SFX played on consumption.")]
        public AudioClip ConsumeSFX;

        #endregion

        #region Effect Types

        /// <summary>
        /// Defines the types of effects consumables can have.
        /// </summary>
        public enum ConsumableEffectType
        {
            /// <summary>No special effect.</summary>
            None,

            /// <summary>Grants XP immediately.</summary>
            GrantXP,

            /// <summary>Grants currency immediately.</summary>
            GrantCurrency,

            /// <summary>Temporarily increases movement speed.</summary>
            SpeedBoost,

            /// <summary>Temporarily increases jump height.</summary>
            JumpBoost,

            /// <summary>Temporarily makes player invisible.</summary>
            Invisibility,

            /// <summary>Teleports player to a location.</summary>
            Teleport,

            /// <summary>Changes player appearance temporarily.</summary>
            AppearanceChange,

            /// <summary>Triggers a random emote.</summary>
            RandomEmote,

            /// <summary>Grants a temporary aura/effect.</summary>
            AuraEffect
        }

        #endregion
    }

    #endregion

    #region CurrencyPackData

    /// <summary>
    /// Data asset for currency packs available for purchase.
    /// Used in the shop to define coin/gem bundles.
    /// </summary>
    [CreateAssetMenu(
        fileName = "CurrencyPackData_New",
        menuName = "KawaiiCool Island/Item Data/Currency Pack",
        order = 50
    )]
    public class CurrencyPackData : ItemData
    {
        #region Currency Contents

        /// <summary>
        /// Amount of coins granted by this pack.
        /// </summary>
        [Header("Contents")]
        [Tooltip("Coins included in this pack.")]
        public int CoinAmount = 0;

        /// <summary>
        /// Amount of gems granted by this pack.
        /// </summary>
        [Tooltip("Gems included in this pack.")]
        public int GemAmount = 0;

        /// <summary>
        /// Bonus percentage applied to first purchase.
        /// </summary>
        [Tooltip("First-time purchase bonus percentage.")]
        [Range(0f, 2f)]
        public float FirstPurchaseBonus = 0f;

        #endregion

        #region Pricing

        /// <summary>
        /// Real money price in USD for display.
        /// </summary>
        [Header("Real Money Pricing")]
        [Tooltip("Display price in USD (e.g., '$4.99').")]
        public string DisplayPrice = "$0.00";

        /// <summary>
        /// Product ID for platform store integration (App Store, Google Play, etc.).
        /// </summary>
        [Tooltip("Platform store product ID.")]
        public string StoreProductId = string.Empty;

        /// <summary>
        /// Whether this pack is a limited-time offer.
        /// </summary>
        [Header("Promotion")]
        [Tooltip("Is this a limited-time offer?")]
        public bool IsLimitedOffer = false;

        /// <summary>
        /// If a limited offer, the discount percentage.
        /// </summary>
        [Tooltip("Discount percentage if a limited offer.")]
        [Range(0, 99)]
        public int DiscountPercentage = 0;

        #endregion
    }

    #endregion
}
