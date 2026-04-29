// -----------------------------------------------------------------------
// InventoryManager.cs
// Core inventory system for KawaiiCool Island.
// Manages items, currencies, favourites, equipping, sorting, filtering,
// and persistence.  Uses the Singleton pattern for global access.
// -----------------------------------------------------------------------

using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KawaiiCool.Inventory
{
    /// <summary>
    /// Represents a single instance of an item held in the player's inventory.
    /// </summary>
    [Serializable]
    public class InventoryItem
    {
        /// <summary>Unique identifier for this specific item instance.</summary>
        public string InstanceId;

        /// <summary>Reference to the shared ItemData asset.</summary>
        public string ItemId;

        /// <summary>Runtime reference to the loaded ItemData (not serialized).</summary>
        [NonSerialized] public ItemData Data;

        /// <summary>Number of copies in this stack.</summary>
        public int Quantity;

        /// <summary>Whether the item is currently equipped.</summary>
        public bool IsEquipped;

        /// <summary>Whether the item is marked as a favourite.</summary>
        public bool IsFavorite;

        /// <summary>Unix timestamp of when the item was acquired.</summary>
        public long AcquiredDate;

        /// <summary>Named slot the item is equipped in, if any.</summary>
        public string EquipSlot;

        /// <summary>Arbitrary per-instance key-value data (enchantments, charges, etc.).</summary>
        public Dictionary<string, string> CustomData = new();
    }

    /// <summary>
    /// Serializable wrapper used for JSON persistence of InventoryItem.
    /// </summary>
    [Serializable]
    public class SerializableInventoryItem
    {
        public string InstanceId;
        public string ItemId;
        public int Quantity;
        public bool IsEquipped;
        public bool IsFavorite;
        public long AcquiredDate;
        public string EquipSlot;
        public List<string> CustomDataKeys = new();
        public List<string> CustomDataValues = new();
    }

    /// <summary>
    /// Serializable wrapper used for JSON persistence of the entire inventory.
    /// </summary>
    [Serializable]
    public class InventorySaveData
    {
        public List<SerializableInventoryItem> Items = new();
        public List<string> CurrencyTypes = new();
        public List<int> CurrencyAmounts = new();
        public List<string> Favorites = new();
        public int Version = 1;
    }

    /// <summary>
    /// Central manager for the player's inventory.  Handles items, currencies,
    /// equipment, favourites, sorting, searching, and save/load.
    /// </summary>
    public class InventoryManager : Singleton<InventoryManager>
    {
        #region Settings
        [Header("Settings")]
        [Tooltip("Maximum number of distinct item entries the inventory can hold.")]
        public int MaxInventorySlots = 100;

        [Tooltip("Default stack size cap when an ItemData does not specify one.")]
        public int MaxStackSize = 99;
        #endregion

        // ------------------------------------------------------------------
        // Internal state
        // ------------------------------------------------------------------
        private Dictionary<string, InventoryItem> _items = new();
        private Dictionary<string, int> _currencies = new(StringComparer.OrdinalIgnoreCase);
        private List<string> _favorites = new();
        private bool _isInitialized;

        // ------------------------------------------------------------------
        // Events
        // ------------------------------------------------------------------
        /// <summary>Fired when an item is added.  Arguments: itemId, newQuantity.</summary>
        public event Action<string, int> OnItemAdded;

        /// <summary>Fired when an item is removed.  Arguments: itemId, remainingQuantity.</summary>
        public event Action<string, int> OnItemRemoved;

        /// <summary>Fired when a currency balance changes.  Arguments: currencyType, newBalance.</summary>
        public event Action<string, int> OnCurrencyChanged;

        /// <summary>Fired when an item is equipped.  Argument: itemId.</summary>
        public event Action<string> OnItemEquipped;

        /// <summary>Fired when an item is unequipped.  Argument: itemId.</summary>
        public event Action<string> OnItemUnequipped;

        /// <summary>Fired when the inventory is fully loaded from disk.</summary>
        public event Action OnInventoryLoaded;

        // ------------------------------------------------------------------
        // Lifecycle
        // ------------------------------------------------------------------
        protected override void Awake()
        {
            base.Awake();
            InitializeDefaults();
        }

        /// <summary>
        /// Ensures currency dictionaries contain default entries.
        /// </summary>
        private void InitializeDefaults()
        {
            if (_isInitialized) return;
            _isInitialized = true;

            EnsureCurrency("coins");
            EnsureCurrency("gems");
            EnsureCurrency("tickets");
        }

        private void EnsureCurrency(string type)
        {
            if (!_currencies.ContainsKey(type))
                _currencies[type] = 0;
        }

        // ==================================================================
        // ITEM MANAGEMENT
        // ==================================================================

        /// <summary>
        /// Adds an item to the inventory.  Automatically stacks if the item
        /// is stackable and a matching entry already exists.
        /// </summary>
        /// <param name="itemId">Identifier of the ItemData asset.</param>
        /// <param name="quantity">How many copies to add.</param>
        /// <param name="customData">Optional per-instance key-value data.</param>
        /// <returns>True if the item was fully added.</returns>
        public bool AddItem(string itemId, int quantity = 1, Dictionary<string, string> customData = null)
        {
            if (string.IsNullOrWhiteSpace(itemId) || quantity <= 0)
            {
                Debug.LogWarning($"[InventoryManager] Invalid AddItem call: itemId={itemId}, qty={quantity}");
                return false;
            }

            ItemData data = ItemDatabase.GetItem(itemId);
            if (data == null)
            {
                Debug.LogError($"[InventoryManager] Cannot add unknown item '{itemId}'.");
                return false;
            }

            // Check max quantity
            if (data.MaxQuantity > 0)
            {
                int current = GetItemQuantity(itemId);
                if (current + quantity > data.MaxQuantity)
                {
                    quantity = data.MaxQuantity - current;
                    if (quantity <= 0)
                    {
                        Debug.Log($"[InventoryManager] Player already at max quantity for '{itemId}'.");
                        return false;
                    }
                }
            }

            // Try stacking
            if (data.IsStackable && _items.TryGetValue(itemId, out InventoryItem existing))
            {
                int stackCap = data.MaxStackSize > 0 ? data.MaxStackSize : MaxStackSize;
                int canAdd = stackCap - existing.Quantity;
                int toAdd = Math.Min(quantity, canAdd);

                if (toAdd > 0)
                {
                    existing.Quantity += toAdd;
                    OnItemAdded?.Invoke(itemId, existing.Quantity);
                }

                // Overflow creates new stacks
                int remaining = quantity - toAdd;
                while (remaining > 0)
                {
                    int nextStack = Math.Min(remaining, stackCap);
                    if (!CreateNewStack(data, itemId, nextStack, customData))
                        break;
                    remaining -= nextStack;
                }

                return true;
            }

            // Fresh stack
            return CreateNewStack(data, itemId, quantity, customData);
        }

        /// <summary>
        /// Creates a brand-new inventory entry (stack) for the given item.
        /// </summary>
        private bool CreateNewStack(ItemData data, string itemId, int quantity, Dictionary<string, string> customData)
        {
            if (_items.Count >= MaxInventorySlots)
            {
                Debug.LogWarning("[InventoryManager] Inventory full — cannot add new stack.");
                return false;
            }

            var item = new InventoryItem
            {
                InstanceId = Guid.NewGuid().ToString("N"),
                ItemId = itemId,
                Data = data,
                Quantity = quantity,
                AcquiredDate = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                CustomData = customData != null ? new Dictionary<string, string>(customData) : new Dictionary<string, string>()
            };

            _items[item.InstanceId] = item;
            OnItemAdded?.Invoke(itemId, quantity);
            return true;
        }

        /// <summary>
        /// Removes a quantity of an item.  If the stack reaches zero it is destroyed.
        /// </summary>
        /// <param name="itemId">Identifier of the ItemData asset.</param>
        /// <param name="quantity">How many copies to remove.</param>
        /// <returns>True if the requested quantity was removed.</returns>
        public bool RemoveItem(string itemId, int quantity = 1)
        {
            if (string.IsNullOrWhiteSpace(itemId) || quantity <= 0)
                return false;

            // Find the stack(s) for this itemId
            var stacks = _items.Values.Where(i => i.ItemId == itemId).ToList();
            int totalAvailable = stacks.Sum(s => s.Quantity);

            if (totalAvailable < quantity)
            {
                Debug.LogWarning($"[InventoryManager] Not enough '{itemId}' to remove {quantity}.");
                return false;
            }

            int toRemove = quantity;
            foreach (var stack in stacks)
            {
                if (toRemove <= 0) break;

                int removeFromStack = Math.Min(toRemove, stack.Quantity);
                stack.Quantity -= removeFromStack;
                toRemove -= removeFromStack;

                if (stack.Quantity <= 0)
                {
                    _items.Remove(stack.InstanceId);
                    if (_favorites.Contains(stack.InstanceId))
                        _favorites.Remove(stack.InstanceId);
                }

                OnItemRemoved?.Invoke(itemId, stack.Quantity);
            }

            return true;
        }

        /// <summary>
        /// Removes a specific inventory entry by its unique instance id.
        /// </summary>
        /// <param name="instanceId">The unique instance identifier.</param>
        /// <returns>True if the entry was found and removed.</returns>
        public bool RemoveItemByInstance(string instanceId)
        {
            if (!_items.TryGetValue(instanceId, out InventoryItem item))
                return false;

            _items.Remove(instanceId);
            if (_favorites.Contains(instanceId))
                _favorites.Remove(instanceId);

            OnItemRemoved?.Invoke(item.ItemId, 0);
            return true;
        }

        /// <summary>
        /// Checks whether the player owns at least the requested quantity.
        /// </summary>
        public bool HasItem(string itemId, int quantity = 1)
        {
            return GetItemQuantity(itemId) >= quantity;
        }

        /// <summary>
        /// Returns the total quantity of an item across all stacks.
        /// </summary>
        public int GetItemQuantity(string itemId)
        {
            return _items.Values
                .Where(i => i.ItemId == itemId)
                .Sum(i => i.Quantity);
        }

        /// <summary>
        /// Retrieves the first inventory entry for the given ItemId.
        /// </summary>
        public InventoryItem GetItem(string itemId)
        {
            return _items.Values.FirstOrDefault(i => i.ItemId == itemId);
        }

        /// <summary>
        /// Retrieves a specific inventory entry by its instance id.
        /// </summary>
        public InventoryItem GetItemByInstance(string instanceId)
        {
            return _items.TryGetValue(instanceId, out InventoryItem item) ? item : null;
        }

        /// <summary>
        /// Returns every inventory entry (all stacks).
        /// </summary>
        public List<InventoryItem> GetAllItems()
        {
            return new List<InventoryItem>(_items.Values);
        }

        /// <summary>
        /// Returns all items matching a category.
        /// </summary>
        public List<InventoryItem> GetItemsByCategory(ItemCategory category)
        {
            return _items.Values
                .Where(i => i.Data != null && i.Data.Category == category)
                .ToList();
        }

        /// <summary>
        /// Returns all items matching a rarity tier.
        /// </summary>
        public List<InventoryItem> GetItemsByRarity(ItemRarity rarity)
        {
            return _items.Values
                .Where(i => i.Data != null && i.Data.Rarity == rarity)
                .ToList();
        }

        /// <summary>
        /// Performs a case-insensitive search across display name, id, description, and tags.
        /// </summary>
        public List<InventoryItem> SearchItems(string searchTerm)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
                return GetAllItems();

            string term = searchTerm.ToLowerInvariant();
            return _items.Values.Where(i =>
                (i.Data != null &&
                 ((!string.IsNullOrEmpty(i.Data.DisplayName) && i.Data.DisplayName.ToLowerInvariant().Contains(term)) ||
                  (!string.IsNullOrEmpty(i.ItemId) && i.ItemId.ToLowerInvariant().Contains(term)) ||
                  (!string.IsNullOrEmpty(i.Data.Description) && i.Data.Description.ToLowerInvariant().Contains(term)) ||
                  i.Data.Tags.Any(t => t.ToLowerInvariant().Contains(term))))
            ).ToList();
        }

        /// <summary>
        /// Reorders the internal item list according to the chosen sort type.
        /// </summary>
        public void SortItems(SortType sortType)
        {
            List<InventoryItem> sorted = sortType switch
            {
                SortType.Name => _items.Values.OrderBy(i => i.Data?.DisplayName ?? i.ItemId).ToList(),
                SortType.Rarity => _items.Values.OrderByDescending(i => i.Data?.Rarity ?? ItemRarity.Common).ToList(),
                SortType.Category => _items.Values.OrderBy(i => i.Data?.Category.ToString() ?? "").ToList(),
                SortType.DateAcquired => _items.Values.OrderByDescending(i => i.AcquiredDate).ToList(),
                _ => _items.Values.ToList()
            };

            _items = sorted.ToDictionary(i => i.InstanceId, i => i);
        }

        /// <summary>
        /// Toggles the favourite flag for an inventory entry.
        /// </summary>
        public void ToggleFavorite(string itemId)
        {
            var item = GetItem(itemId);
            if (item == null) return;

            item.IsFavorite = !item.IsFavorite;
            if (item.IsFavorite)
            {
                if (!_favorites.Contains(item.InstanceId))
                    _favorites.Add(item.InstanceId);
            }
            else
            {
                _favorites.Remove(item.InstanceId);
            }
        }

        /// <summary>
        /// Checks whether the given item is marked as a favourite.
        /// </summary>
        public bool IsFavorite(string itemId)
        {
            var item = GetItem(itemId);
            return item != null && item.IsFavorite;
        }

        // ==================================================================
        // USAGE & EQUIPMENT
        // ==================================================================

        /// <summary>
        /// Uses (consumes) one copy of the item if it is usable or consumable.
        /// </summary>
        public void UseItem(string itemId)
        {
            var item = GetItem(itemId);
            if (item?.Data == null) return;

            if (!item.Data.IsUsable && !item.Data.IsConsumable)
            {
                Debug.Log($"[InventoryManager] Item '{itemId}' cannot be used.");
                return;
            }

            Debug.Log($"[InventoryManager] Using item '{itemId}': {item.Data.UseEffectDescription}");

            // Hook for gameplay effects — could dispatch to an effect system
            // GameplayEffectSystem.Apply(item.Data);

            if (item.Data.IsConsumable)
            {
                RemoveItem(itemId, 1);
            }
        }

        /// <summary>
        /// Equips an item into the specified equipment slot.
        /// Unequips any item already occupying that slot.
        /// </summary>
        public void EquipItem(string itemId, string slot)
        {
            var item = GetItem(itemId);
            if (item?.Data == null) return;

            if (!item.Data.IsEquippable)
            {
                Debug.LogWarning($"[InventoryManager] Item '{itemId}' is not equippable.");
                return;
            }

            // Unequip whatever is currently in this slot
            var currentlyEquipped = _items.Values.FirstOrDefault(i =>
                i.IsEquipped && i.EquipSlot == slot);
            currentlyEquipped?.Unequip();

            item.IsEquipped = true;
            item.EquipSlot = slot;
            OnItemEquipped?.Invoke(itemId);
        }

        /// <summary>
        /// Unequips the specified item.
        /// </summary>
        public void UnequipItem(string itemId)
        {
            var item = GetItem(itemId);
            if (item == null) return;

            item.Unequip();
            OnItemUnequipped?.Invoke(itemId);
        }

        // ==================================================================
        // CURRENCY
        // ==================================================================

        /// <summary>
        /// Adds currency.  Negative values are clamped to zero.
        /// </summary>
        public void AddCurrency(string currencyType, int amount)
        {
            if (string.IsNullOrWhiteSpace(currencyType) || amount == 0) return;

            currencyType = currencyType.ToLowerInvariant();
            EnsureCurrency(currencyType);

            int previous = _currencies[currencyType];
            _currencies[currencyType] = Mathf.Max(0, previous + amount);

            OnCurrencyChanged?.Invoke(currencyType, _currencies[currencyType]);
        }

        /// <summary>
        /// Attempts to spend currency.  Returns false if balance is insufficient.
        /// </summary>
        public bool SpendCurrency(string currencyType, int amount)
        {
            if (string.IsNullOrWhiteSpace(currencyType) || amount <= 0)
                return false;

            currencyType = currencyType.ToLowerInvariant();
            EnsureCurrency(currencyType);

            if (_currencies[currencyType] < amount)
                return false;

            _currencies[currencyType] -= amount;
            OnCurrencyChanged?.Invoke(currencyType, _currencies[currencyType]);
            return true;
        }

        /// <summary>
        /// Returns the current balance of a currency type.
        /// </summary>
        public int GetCurrency(string currencyType)
        {
            if (string.IsNullOrWhiteSpace(currencyType))
                return 0;

            currencyType = currencyType.ToLowerInvariant();
            return _currencies.TryGetValue(currencyType, out int value) ? value : 0;
        }

        /// <summary>
        /// Checks whether the player can afford a currency cost.
        /// </summary>
        public bool CanAfford(string currencyType, int amount)
        {
            return GetCurrency(currencyType) >= amount;
        }

        /// <summary>
        /// Overwrites a currency balance.  Used primarily for server sync.
        /// </summary>
        public void SetCurrency(string currencyType, int amount)
        {
            if (string.IsNullOrWhiteSpace(currencyType)) return;

            currencyType = currencyType.ToLowerInvariant();
            _currencies[currencyType] = Mathf.Max(0, amount);
            OnCurrencyChanged?.Invoke(currencyType, _currencies[currencyType]);
        }

        // ==================================================================
        // PERSISTENCE
        // ==================================================================

        /// <summary>
        /// Serializes the entire inventory to JSON.
        /// </summary>
        public string SerializeInventory()
        {
            var saveData = new InventorySaveData();

            foreach (var kvp in _items)
            {
                var item = kvp.Value;
                var serializable = new SerializableInventoryItem
                {
                    InstanceId = item.InstanceId,
                    ItemId = item.ItemId,
                    Quantity = item.Quantity,
                    IsEquipped = item.IsEquipped,
                    IsFavorite = item.IsFavorite,
                    AcquiredDate = item.AcquiredDate,
                    EquipSlot = item.EquipSlot ?? ""
                };

                foreach (var cd in item.CustomData)
                {
                    serializable.CustomDataKeys.Add(cd.Key);
                    serializable.CustomDataValues.Add(cd.Value);
                }

                saveData.Items.Add(serializable);
            }

            foreach (var kvp in _currencies)
            {
                saveData.CurrencyTypes.Add(kvp.Key);
                saveData.CurrencyAmounts.Add(kvp.Value);
            }

            saveData.Favorites = new List<string>(_favorites);

            return JsonUtility.ToJson(saveData, true);
        }

        /// <summary>
        /// Restores the inventory from a JSON string.
        /// </summary>
        public void DeserializeInventory(string json)
        {
            if (string.IsNullOrWhiteSpace(json)) return;

            try
            {
                var saveData = JsonUtility.FromJson<InventorySaveData>(json);
                if (saveData == null) return;

                _items.Clear();
                _currencies.Clear();
                _favorites.Clear();

                foreach (var sItem in saveData.Items)
                {
                    var data = ItemDatabase.GetItem(sItem.ItemId);
                    if (data == null)
                    {
                        Debug.LogWarning($"[InventoryManager] Skipping unknown item '{sItem.ItemId}' during load.");
                        continue;
                    }

                    var item = new InventoryItem
                    {
                        InstanceId = sItem.InstanceId,
                        ItemId = sItem.ItemId,
                        Data = data,
                        Quantity = sItem.Quantity,
                        IsEquipped = sItem.IsEquipped,
                        IsFavorite = sItem.IsFavorite,
                        AcquiredDate = sItem.AcquiredDate,
                        EquipSlot = sItem.EquipSlot
                    };

                    for (int i = 0; i < sItem.CustomDataKeys.Count; i++)
                    {
                        if (i < sItem.CustomDataValues.Count)
                            item.CustomData[sItem.CustomDataKeys[i]] = sItem.CustomDataValues[i];
                    }

                    _items[item.InstanceId] = item;
                }

                for (int i = 0; i < saveData.CurrencyTypes.Count; i++)
                {
                    if (i < saveData.CurrencyAmounts.Count)
                        _currencies[saveData.CurrencyTypes[i].ToLowerInvariant()] = saveData.CurrencyAmounts[i];
                }

                _favorites = saveData.Favorites ?? new List<string>();
                InitializeDefaults();

                OnInventoryLoaded?.Invoke();
                Debug.Log($"[InventoryManager] Loaded {_items.Count} items, {_currencies.Count} currencies.");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[InventoryManager] Failed to deserialize inventory: {ex.Message}");
            }
        }

        /// <summary>
        /// Persists the inventory to PlayerPrefs.
        /// </summary>
        public void SaveInventory()
        {
            string json = SerializeInventory();
            PlayerPrefs.SetString("KawaiiCool_Inventory", json);
            PlayerPrefs.Save();
            Debug.Log("[InventoryManager] Inventory saved.");
        }

        /// <summary>
        /// Loads the inventory from PlayerPrefs.
        /// </summary>
        public void LoadInventory()
        {
            if (PlayerPrefs.HasKey("KawaiiCool_Inventory"))
            {
                string json = PlayerPrefs.GetString("KawaiiCool_Inventory");
                DeserializeInventory(json);
            }
            else
            {
                Debug.Log("[InventoryManager] No saved inventory found — starting fresh.");
            }
        }
    }

    // ====================================================================
    // Extension helpers
    // ====================================================================

    /// <summary>
    /// Extension methods for InventoryItem.
    /// </summary>
    public static class InventoryItemExtensions
    {
        /// <summary>
        /// Unequips this inventory entry.
        /// </summary>
        public static void Unequip(this InventoryItem item)
        {
            if (item == null) return;
            item.IsEquipped = false;
            item.EquipSlot = null;
        }
    }
}
