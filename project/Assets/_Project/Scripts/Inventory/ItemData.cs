// -----------------------------------------------------------------------
// ItemData.cs
// ScriptableObject definition for all items in KawaiiCool Island.
// Contains visual, gameplay, economy, and availability data.
// -----------------------------------------------------------------------

using System;
using System.Collections.Generic;
using System.Globalization;
using UnityEngine;

namespace KawaiiCool.Inventory
{
    /// <summary>
    /// Rarity tiers for items, from most common to most rare.
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
    /// Broad categories used to filter and organize items.
    /// </summary>
    public enum ItemCategory
    {
        Clothing,
        Accessory,
        Furniture,
        Consumable,
        Currency,
        Material,
        Collectible
    }

    /// <summary>
    /// Sorting options for inventory display.
    /// </summary>
    public enum SortType
    {
        Name,
        Rarity,
        Category,
        DateAcquired,
        Custom
    }

    /// <summary>
    /// ScriptableObject that defines the static data for an item.
    /// Every unique item in the game has one ItemData asset.
    /// </summary>
    [CreateAssetMenu(fileName = "Item_", menuName = "KawaiiCool/Item")]
    public class ItemData : ScriptableObject
    {
        #region Basic Info
        [Header("Basic")]
        [Tooltip("Unique identifier used by code and persistence.")]
        public string ItemId;

        [Tooltip("Human-readable name shown in UI.")]
        public string DisplayName;

        [Tooltip("Long description shown in tooltips.")]
        [TextArea(3, 6)]
        public string Description;

        [Tooltip("2D icon shown in inventory and shop.")]
        public Sprite Icon;

        [Tooltip("Which broad category this item belongs to.")]
        public ItemCategory Category;

        [Tooltip("How rare this item is. Drives color, drop rate, and value.")]
        public ItemRarity Rarity;
        #endregion

        #region Visual
        [Header("Visual")]
        [Tooltip("Color associated with this item's rarity.")]
        public Color RarityColor;

        [Tooltip("Border sprite that frames the item icon.")]
        public Sprite RarityBorder;

        [Tooltip("Prefab instantiated when the item is dropped in the 3D world.")]
        public GameObject WorldPrefab;

        [Tooltip("How many grid cells this item occupies (width x height).")]
        public Vector2Int InventorySize = Vector2Int.one;
        #endregion

        #region Stacking
        [Header("Stacking")]
        [Tooltip("Whether multiple copies can stack in one inventory cell.")]
        public bool IsStackable = true;

        [Tooltip("Maximum number of items in a single stack.")]
        public int MaxStackSize = 99;
        #endregion

        #region Usage
        [Header("Usage")]
        [Tooltip("If true, the item is destroyed when used.")]
        public bool IsConsumable;

        [Tooltip("If true, the item can be equipped into one or more slots.")]
        public bool IsEquippable;

        [Tooltip("Named equip slots this item can occupy (e.g. 'head', 'body').")]
        public List<string> EquipSlots = new();

        [Tooltip("If true, the item can be activated for an effect.")]
        public bool IsUsable;

        [Tooltip("Short description of what happens when the item is used.")]
        [TextArea(2, 4)]
        public string UseEffectDescription;
        #endregion

        #region Economy
        [Header("Economy")]
        [Tooltip("Price to purchase this item from the shop.")]
        public int PurchasePrice;

        [Tooltip("Currency type for purchasing (e.g. 'coins', 'gems', 'tickets').")]
        public string PurchaseCurrency = "coins";

        [Tooltip("Amount refunded when selling the item.")]
        public int SellPrice;

        [Tooltip("If true, this item can only be bought with hard currency or real money.")]
        public bool IsPremium;

        [Tooltip("If true, the item can be traded between players.")]
        public bool IsTradeable = true;

        [Tooltip("If true, the item can be sent as a gift.")]
        public bool IsGiftable = true;
        #endregion

        #region Availability
        [Header("Availability")]
        [Tooltip("If true, this item is only available during a limited window.")]
        public bool IsLimitedTime;

        [Tooltip("ISO 8601 date when the item becomes available (e.g. 2024-12-01T00:00:00Z).")]
        public string AvailableFrom;

        [Tooltip("ISO 8601 date when the item is no longer available.")]
        public string AvailableUntil;

        [Tooltip("Maximum quantity a single player may own. 0 = unlimited.")]
        public int MaxQuantity;

        [Tooltip("Minimum player level required to purchase or use.")]
        public string RequiredLevel;

        [Tooltip("ItemIds that must be owned before this item can be acquired.")]
        public List<string> RequiredItems = new();
        #endregion

        #region Tags
        [Header("Tags")]
        [Tooltip("Arbitrary tags for filtering, search, and discount rules.")]
        public List<string> Tags = new();
        #endregion

        // ------------------------------------------------------------------
        // Helper Methods
        // ------------------------------------------------------------------

        /// <summary>
        /// Returns the rarity color as a hex string for UI text formatting.
        /// </summary>
        /// <returns>Hex color string (e.g. "#FFD700").</returns>
        public string GetRarityColorHex()
        {
            return Rarity switch
            {
                ItemRarity.Common => "#FFFFFF",
                ItemRarity.Uncommon => "#4CFF4C",
                ItemRarity.Rare => "#4C4CFF",
                ItemRarity.Epic => "#FF4CFF",
                ItemRarity.Legendary => "#FFD700",
                _ => "#FFFFFF"
            };
        }

        /// <summary>
        /// Checks if the item is currently available for purchase based on
        /// limited-time windows and prerequisite requirements.
        /// </summary>
        /// <returns>True if the item can currently be bought.</returns>
        public bool IsAvailable()
        {
            if (!IsLimitedTime)
                return true;

            DateTime now = DateTime.UtcNow;

            if (!string.IsNullOrEmpty(AvailableFrom))
            {
                if (DateTime.TryParse(AvailableFrom, null, DateTimeStyles.RoundtripKind, out DateTime from))
                {
                    if (now < from)
                        return false;
                }
            }

            if (!string.IsNullOrEmpty(AvailableUntil))
            {
                if (DateTime.TryParse(AvailableUntil, null, DateTimeStyles.RoundtripKind, out DateTime until))
                {
                    if (now > until)
                        return false;
                }
            }

            return true;
        }

        /// <summary>
        /// Checks if the local player can afford to purchase this item.
        /// </summary>
        /// <returns>True if the player has enough currency.</returns>
        public bool CanPlayerAfford()
        {
            if (InventoryManager.Instance == null)
                return false;

            int balance = InventoryManager.Instance.GetCurrency(PurchaseCurrency);
            return balance >= PurchasePrice;
        }

        /// <summary>
        /// Returns a string describing the rarity with color markup.
        /// </summary>
        /// <returns>Rich-text formatted rarity name.</returns>
        public string GetFormattedRarityName()
        {
            string hex = GetRarityColorHex();
            return $"<color={hex}>{Rarity}</color>";
        }

        /// <summary>
        /// Validates that required ScriptableObject fields are filled.
        /// </summary>
        private void OnValidate()
        {
            if (string.IsNullOrWhiteSpace(ItemId))
            {
                ItemId = name.Replace("Item_", "");
            }

            // Auto-assign rarity colors if not set
            if (RarityColor == default)
            {
                RarityColor = Rarity switch
                {
                    ItemRarity.Common => new Color(1f, 1f, 1f),
                    ItemRarity.Uncommon => new Color(0.3f, 1f, 0.3f),
                    ItemRarity.Rare => new Color(0.3f, 0.3f, 1f),
                    ItemRarity.Epic => new Color(1f, 0.3f, 1f),
                    ItemRarity.Legendary => new Color(1f, 0.84f, 0f),
                    _ => Color.white
                };
            }

            if (MaxStackSize < 1)
                MaxStackSize = 1;

            if (InventorySize.x < 1) InventorySize.x = 1;
            if (InventorySize.y < 1) InventorySize.y = 1;
        }
    }
}
