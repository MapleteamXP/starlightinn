// -----------------------------------------------------------------------
// ShopManager.cs
// Shop system for KawaiiCool Island.  Handles sections, daily rotation,
// limited-time events, discount rules, purchasing, and gifting.
// -----------------------------------------------------------------------

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;

namespace KawaiiCool.Inventory
{
    /// <summary>
    /// Data defining a purchasable reward granted during a shop event.
    /// </summary>
    [Serializable]
    public class RewardData
    {
        public string RewardId;
        public string RewardType;
        public int Amount;
        public Sprite RewardIcon;
    }

    /// <summary>
    /// A limited-time event that brings exclusive items and discounts.
    /// </summary>
    [Serializable]
    public class ShopEvent
    {
        public string EventId;
        public string EventName;
        public string Description;
        public Sprite Banner;
        public Color ThemeColor = Color.magenta;
        public string StartDate;
        public string EndDate;
        public List<ItemData> ExclusiveItems = new();
        public List<string> DiscountedItemIds = new();
        [Range(0f, 1f)] public float DiscountMultiplier = 0.8f;
        public List<RewardData> EventRewards = new();

        /// <summary>
        /// Returns true if the current server time falls within the event window.
        /// </summary>
        public bool IsActive()
        {
            DateTime now = DateTime.UtcNow;

            if (!string.IsNullOrEmpty(StartDate))
            {
                if (DateTime.TryParse(StartDate, null, System.Globalization.DateTimeStyles.RoundtripKind, out DateTime start))
                {
                    if (now < start) return false;
                }
            }

            if (!string.IsNullOrEmpty(EndDate))
            {
                if (DateTime.TryParse(EndDate, null, System.Globalization.DateTimeStyles.RoundtripKind, out DateTime end))
                {
                    if (now > end) return false;
                }
            }

            return true;
        }
    }

    /// <summary>
    /// A discount rule that applies to items matching specific tags or categories.
    /// </summary>
    [Serializable]
    public class DiscountRule
    {
        public string RuleName;
        public List<string> ItemTags = new();
        public List<string> CategoryIds = new();
        [Range(0f, 1f)] public float DiscountPercent = 0.2f;
        public bool RequiresMembership;
        public string ValidFrom;
        public string ValidUntil;

        /// <summary>
        /// Checks if the rule is currently valid.
        /// </summary>
        public bool IsValid()
        {
            DateTime now = DateTime.UtcNow;

            if (!string.IsNullOrEmpty(ValidFrom))
            {
                if (DateTime.TryParse(ValidFrom, null, System.Globalization.DateTimeStyles.RoundtripKind, out DateTime from))
                {
                    if (now < from) return false;
                }
            }

            if (!string.IsNullOrEmpty(ValidUntil))
            {
                if (DateTime.TryParse(ValidUntil, null, System.Globalization.DateTimeStyles.RoundtripKind, out DateTime until))
                {
                    if (now > until) return false;
                }
            }

            return true;
        }
    }

    /// <summary>
    /// ScriptableObject defining a named section of the shop (e.g. "Clothing", "Furniture").
    /// </summary>
    [CreateAssetMenu(fileName = "ShopSection_", menuName = "KawaiiCool/Shop Section")]
    public class ShopSection : ScriptableObject
    {
        [Tooltip("Internal identifier.")]
        public string SectionId;

        [Tooltip("Display name shown in the section tab.")]
        public string DisplayName;

        [Tooltip("Short description shown when browsing.")]
        public string Description;

        [Tooltip("Icon for the section tab.")]
        public Sprite Icon;

        [Tooltip("Only show items matching this category.  None = all.")]
        public ItemCategory CategoryFilter;

        [Tooltip("Explicit list of items in this section.")]
        public List<ItemData> Items = new();

        [Tooltip("If true, the daily rotation is shown in this section.")]
        public bool ShowDailyRotation;

        [Tooltip("If true, this section only appears during a time window.")]
        public bool IsLimitedTime;

        [Tooltip("ISO date when the section becomes visible.")]
        public string AvailableFrom;

        [Tooltip("ISO date when the section is hidden.")]
        public string AvailableUntil;

        /// <summary>
        /// Checks whether this section should currently be visible.
        /// </summary>
        public bool IsAvailable()
        {
            if (!IsLimitedTime) return true;

            DateTime now = DateTime.UtcNow;

            if (!string.IsNullOrEmpty(AvailableFrom))
            {
                if (DateTime.TryParse(AvailableFrom, null, System.Globalization.DateTimeStyles.RoundtripKind, out DateTime from))
                {
                    if (now < from) return false;
                }
            }

            if (!string.IsNullOrEmpty(AvailableUntil))
            {
                if (DateTime.TryParse(AvailableUntil, null, System.Globalization.DateTimeStyles.RoundtripKind, out DateTime until))
                {
                    if (now > until) return false;
                }
            }

            return true;
        }
    }

    // =====================================================================
    // ShopManager
    // =====================================================================

    /// <summary>
    /// Central shop controller.  Manages sections, daily rotation, events,
    /// discounts, purchases, and gifting.
    /// </summary>
    public class ShopManager : Singleton<ShopManager>
    {
        #region Inspector
        [Header("Sections")]
        [Tooltip("All shop sections available to the player.")]
        public List<ShopSection> Sections = new();

        [Header("Daily Rotation")]
        [Tooltip("How many items appear in the daily rotation.")]
        public int DailyRotationSize = 6;

        [Tooltip("ISO date of the last daily rotation refresh.")]
        public string LastRotationDate;

        [Tooltip("Current set of daily rotation items.")]
        public List<ItemData> CurrentDailyItems = new();

        [Header("Featured")]
        [Tooltip("Items manually promoted to the featured row.")]
        public List<ItemData> FeaturedItems = new();

        [Header("Events")]
        [Tooltip("Events that are currently active or upcoming.")]
        public List<ShopEvent> ActiveEvents = new();

        [Tooltip("Events scheduled to start in the future.")]
        public List<ShopEvent> UpcomingEvents = new();

        [Header("Discounts")]
        [Tooltip("Base discount applied for members.")]
        [Range(0f, 1f)]
        public float MemberDiscount = 0.1f;

        [Tooltip("Active discount rules evaluated at purchase time.")]
        public List<DiscountRule> DiscountRules = new();

        [Header("Settings")]
        [Tooltip("If true, daily rotation refreshes based on server time.")]
        public bool UseServerTime = true;
        #endregion

        // ------------------------------------------------------------------
        // Events
        // ------------------------------------------------------------------
        /// <summary>Fired when any item is purchased.</summary>
        public event Action<ItemData> OnItemPurchased;

        /// <summary>Fired when an item is gifted.  Arguments: item, recipientId.</summary>
        public event Action<ItemData, string> OnItemGifted;

        /// <summary>Fired when the daily rotation changes.</summary>
        public event Action OnDailyRotationRefreshed;

        // ------------------------------------------------------------------
        // Lifecycle
        // ------------------------------------------------------------------
        private void Start()
        {
            CheckDailyRotation();
        }

        // ------------------------------------------------------------------
        // Purchasing
        // ------------------------------------------------------------------

        /// <summary>
        /// Purchases an item by its ItemId using the default or specified currency.
        /// </summary>
        public void PurchaseItem(string itemId, string currencyType = null)
        {
            ItemData item = ItemDatabase.GetItem(itemId);
            if (item == null)
            {
                Debug.LogWarning($"[ShopManager] Cannot purchase unknown item '{itemId}'.");
                return;
            }
            PurchaseItem(item, currencyType);
        }

        /// <summary>
        /// Purchases the given item data after verifying funds and availability.
        /// </summary>
        public void PurchaseItem(ItemData item, string currencyType = null)
        {
            if (item == null)
            {
                Debug.LogWarning("[ShopManager] Cannot purchase null item.");
                return;
            }

            if (!item.IsAvailable())
            {
                Debug.Log($"[ShopManager] Item '{item.ItemId}' is not currently available.");
                return;
            }

            string currency = currencyType ?? item.PurchaseCurrency;
            int price = GetDiscountedPrice(item);

            if (!InventoryManager.Instance.CanAfford(currency, price))
            {
                Debug.Log($"[ShopManager] Insufficient {currency} to buy '{item.ItemId}' (need {price}).");
                return;
            }

            if (InventoryManager.Instance == null)
            {
                Debug.LogError("[ShopManager] InventoryManager instance is null.");
                return;
            }

            // Spend currency
            bool spent = InventoryManager.Instance.SpendCurrency(currency, price);
            if (!spent)
            {
                Debug.LogWarning($"[ShopManager] Currency transaction failed for '{item.ItemId}'.");
                return;
            }

            // Grant item
            InventoryManager.Instance.AddItem(item.ItemId, 1);

            Debug.Log($"[ShopManager] Purchased '{item.DisplayName}' for {price} {currency}.");
            OnItemPurchased?.Invoke(item);
        }

        /// <summary>
        /// Checks if the player can afford an item by its ItemId.
        /// </summary>
        public bool CanAfford(string itemId)
        {
            ItemData item = ItemDatabase.GetItem(itemId);
            return item != null && CanAfford(item);
        }

        /// <summary>
        /// Checks if the player can afford the given item.
        /// </summary>
        public bool CanAfford(ItemData item)
        {
            if (item == null) return false;
            int price = GetDiscountedPrice(item);
            return InventoryManager.Instance.CanAfford(item.PurchaseCurrency, price);
        }

        // ------------------------------------------------------------------
        // Pricing
        // ------------------------------------------------------------------

        /// <summary>
        /// Computes the final price after all applicable discounts.
        /// </summary>
        public int GetDiscountedPrice(ItemData item)
        {
            if (item == null) return 0;

            float multiplier = GetDiscountMultiplier(item);
            int discounted = Mathf.RoundToInt(item.PurchasePrice * multiplier);
            return Mathf.Max(0, discounted);
        }

        /// <summary>
        /// Calculates the total discount multiplier (1.0 = no discount).
        /// </summary>
        private float GetDiscountMultiplier(ItemData item)
        {
            if (item == null) return 1f;

            float bestDiscount = 1f;

            // Event discounts
            foreach (var evt in ActiveEvents)
            {
                if (!evt.IsActive()) continue;
                if (evt.ExclusiveItems.Contains(item) || evt.DiscountedItemIds.Contains(item.ItemId))
                {
                    bestDiscount = Mathf.Min(bestDiscount, evt.DiscountMultiplier);
                }
            }

            // Rule-based discounts
            foreach (var rule in DiscountRules)
            {
                if (!rule.IsValid()) continue;
                if (rule.RequiresMembership && !IsMember()) continue;

                bool matches = false;

                foreach (var tag in item.Tags)
                {
                    if (rule.ItemTags.Contains(tag))
                    {
                        matches = true;
                        break;
                    }
                }

                if (!matches && rule.CategoryIds.Contains(item.Category.ToString()))
                    matches = true;

                if (matches)
                {
                    float ruleMult = 1f - rule.DiscountPercent;
                    bestDiscount = Mathf.Min(bestDiscount, ruleMult);
                }
            }

            // Membership discount (only if no better discount)
            if (IsMember() && bestDiscount >= 1f - MemberDiscount)
            {
                bestDiscount = 1f - MemberDiscount;
            }

            return bestDiscount;
        }

        /// <summary>
        /// Returns true if the local player has an active membership.
        /// </summary>
        private bool IsMember()
        {
            // Hook into your membership system
            return false;
        }

        // ------------------------------------------------------------------
        // Daily Rotation
        // ------------------------------------------------------------------

        /// <summary>
        /// Forces a refresh of the daily rotation item pool.
        /// </summary>
        public void RefreshDailyRotation()
        {
            CurrentDailyItems = GenerateDailyItems();
            LastRotationDate = DateTime.UtcNow.ToString("O");
            OnDailyRotationRefreshed?.Invoke();
            Debug.Log($"[ShopManager] Daily rotation refreshed with {CurrentDailyItems.Count} items.");
        }

        /// <summary>
        /// Returns the current daily rotation items.
        /// </summary>
        public List<ItemData> GetDailyRotation()
        {
            CheckDailyRotation();
            return new List<ItemData>(CurrentDailyItems);
        }

        /// <summary>
        /// Checks whether the daily rotation needs to be regenerated.
        /// </summary>
        private void CheckDailyRotation()
        {
            DateTime now = UseServerTime ? GetServerTime() : DateTime.UtcNow;
            DateTime lastRotation = DateTime.MinValue;

            if (!string.IsNullOrEmpty(LastRotationDate))
            {
                DateTime.TryParse(LastRotationDate, null, System.Globalization.DateTimeStyles.RoundtripKind, out lastRotation);
            }

            // Has it passed midnight UTC since last refresh?
            if (lastRotation.Date < now.Date || CurrentDailyItems.Count == 0)
            {
                RefreshDailyRotation();
            }
        }

        /// <summary>
        /// Generates a random selection of items for the daily rotation.
        /// </summary>
        private List<ItemData> GenerateDailyItems()
        {
            // Collect all available items from all sections
            var candidates = new List<ItemData>();
            foreach (var section in Sections)
            {
                if (!section.IsAvailable()) continue;
                foreach (var item in section.Items)
                {
                    if (item != null && item.IsAvailable() && item.PurchasePrice > 0)
                        candidates.Add(item);
                }
            }

            // Add event exclusive items
            foreach (var evt in ActiveEvents)
            {
                if (!evt.IsActive()) continue;
                foreach (var item in evt.ExclusiveItems)
                {
                    if (item != null && !candidates.Contains(item))
                        candidates.Add(item);
                }
            }

            if (candidates.Count == 0)
                return new List<ItemData>();

            // Shuffle (Fisher-Yates)
            var rng = new System.Random();
            int n = candidates.Count;
            while (n > 1)
            {
                n--;
                int k = rng.Next(n + 1);
                (candidates[n], candidates[k]) = (candidates[k], candidates[n]);
            }

            int count = Mathf.Min(DailyRotationSize, candidates.Count);
            return candidates.GetRange(0, count);
        }

        // ------------------------------------------------------------------
        // Item Queries
        // ------------------------------------------------------------------

        /// <summary>
        /// Returns the manually-featured items.
        /// </summary>
        public List<ItemData> GetFeaturedItems()
        {
            return FeaturedItems.Where(i => i != null && i.IsAvailable()).ToList();
        }

        /// <summary>
        /// Returns all items in the specified section.
        /// </summary>
        public List<ItemData> GetSectionItems(string sectionId)
        {
            var section = Sections.FirstOrDefault(s => s.SectionId == sectionId);
            if (section == null || !section.IsAvailable()) return new List<ItemData>();

            var items = section.Items.Where(i => i != null && i.IsAvailable()).ToList();

            if (section.ShowDailyRotation)
            {
                items.AddRange(GetDailyRotation().Where(d => !items.Contains(d)));
            }

            return items;
        }

        /// <summary>
        /// Returns items exclusive to an event.
        /// </summary>
        public List<ItemData> GetEventItems(string eventId)
        {
            var evt = ActiveEvents.FirstOrDefault(e => e.EventId == eventId);
            return evt?.ExclusiveItems.Where(i => i != null).ToList() ?? new List<ItemData>();
        }

        // ------------------------------------------------------------------
        // Preview
        // ------------------------------------------------------------------

        /// <summary>
        /// Opens the 3D / full-screen preview for an item.
        /// </summary>
        public void OpenItemPreview(ItemData item)
        {
            if (item == null) return;
            Debug.Log($"[ShopManager] Opening preview for '{item.DisplayName}'.");
            // Dispatch to UIManager to show preview panel
        }

        // ------------------------------------------------------------------
        // Gifting
        // ------------------------------------------------------------------

        /// <summary>
        /// Sends an item as a gift to another player.
        /// </summary>
        public void GiftItem(string itemId, string recipientId)
        {
            if (string.IsNullOrWhiteSpace(recipientId))
            {
                Debug.LogWarning("[ShopManager] Cannot gift without a recipient.");
                return;
            }

            ItemData item = ItemDatabase.GetItem(itemId);
            if (item == null)
            {
                Debug.LogWarning($"[ShopManager] Cannot gift unknown item '{itemId}'.");
                return;
            }

            if (!item.IsGiftable)
            {
                Debug.Log($"[ShopManager] Item '{itemId}' cannot be gifted.");
                return;
            }

            int price = GetDiscountedPrice(item);
            if (!InventoryManager.Instance.CanAfford(item.PurchaseCurrency, price))
            {
                Debug.Log($"[ShopManager] Cannot afford to gift '{itemId}'.");
                return;
            }

            InventoryManager.Instance.SpendCurrency(item.PurchaseCurrency, price);
            Debug.Log($"[ShopManager] Gifted '{item.DisplayName}' to {recipientId}.");
            OnItemGifted?.Invoke(item, recipientId);
        }

        // ------------------------------------------------------------------
        // Server time
        // ------------------------------------------------------------------

        /// <summary>
        /// Returns the current server time.  Falls back to local UTC.
        /// </summary>
        private DateTime GetServerTime()
        {
            // In production this should call your game server
            return DateTime.UtcNow;
        }

        /// <summary>
        /// Checks if the given item is part of an active event.
        /// </summary>
        private bool IsInActiveEvent(ItemData item)
        {
            if (item == null) return false;
            return ActiveEvents.Any(evt => evt.IsActive() &&
                (evt.ExclusiveItems.Contains(item) || evt.DiscountedItemIds.Contains(item.ItemId)));
        }
    }
}
