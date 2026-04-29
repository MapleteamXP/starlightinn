using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace KawaiiCoolIsland.Avatar.Editor
{
    /// <summary>
    /// Sorting options available in the wardrobe browser.
    /// </summary>
    public enum WardrobeSort
    {
        /// <summary>Most recently acquired items first.</summary>
        Newest,
        /// <summary>Alphabetical by display name.</summary>
        Name,
        /// <summary>Highest rarity first.</summary>
        Rarity,
        /// <summary>Grouped by category.</summary>
        Category,
        /// <summary>Most frequently equipped first.</summary>
        MostWorn
    }

    /// <summary>
    /// Represents a wardrobe category for navigation and filtering.
    /// </summary>
    [System.Serializable]
    public class WardrobeCategory
    {
        /// <summary>
        /// Display name shown in the UI.
        /// </summary>
        public string Name;

        /// <summary>
        /// Icon sprite for the category tab.
        /// </summary>
        public Sprite Icon;

        /// <summary>
        /// The item category enum this wardrobe category maps to.
        /// </summary>
        public ItemCategory Category;
    }

    /// <summary>
    /// Powerful wardrobe browser for managing owned clothing and accessories.
    /// Supports multi-category filtering, rarity filtering, search, sorting,
    /// favorites, new item highlighting, and live equip/unequip with preview.
    /// </summary>
    public class WardrobeUI : MonoBehaviour
    {
        #region Header Fields

        [Header("Grid")]
        [SerializeField, Tooltip("Container transform for the item grid layout.")]
        public Transform ItemGrid;

        [SerializeField, Tooltip("Prefab instantiated for each wardrobe item cell.")]
        public GameObject WardrobeItemPrefab;

        [SerializeField, Tooltip("Number of columns in the grid layout."), Min(1)]
        public int GridColumns = 4;

        [Header("Filters")]
        [SerializeField, Tooltip("Dropdown for selecting item category filter.")]
        public TMP_Dropdown CategoryFilter;

        [SerializeField, Tooltip("Dropdown for selecting rarity filter.")]
        public TMP_Dropdown RarityFilter;

        [SerializeField, Tooltip("Dropdown for selecting sort order.")]
        public TMP_Dropdown SortFilter;

        [SerializeField, Tooltip("Search input field for filtering by name.")]
        public TMP_InputField SearchInput;

        [SerializeField, Tooltip("Toggle to show only favorited items.")]
        public Toggle FavoritesToggle;

        [SerializeField, Tooltip("Toggle to show only new/unseen items.")]
        public Toggle NewItemsToggle;

        [Header("Categories")]
        [SerializeField, Tooltip("List of wardrobe categories available in the browser.")]
        public List<WardrobeCategory> Categories = new();

        [Header("Preview & Actions")]
        [SerializeField, Tooltip("Avatar preview component for live try-on.")]
        public AvatarPreview Preview;

        [SerializeField, Tooltip("Button to equip the selected item.")]
        public Button EquipButton;

        [SerializeField, Tooltip("Button to unequip the selected item.")]
        public Button UnequipButton;

        [SerializeField, Tooltip("Button to toggle favorite status of the selected item.")]
        public Button FavoriteButton;

        [SerializeField, Tooltip("Text displaying current filtered item count.")]
        public TMP_Text ItemCountText;

        #endregion

        #region Private Fields

        private List<InventoryItem> _filteredItems = new();
        private InventoryItem _selectedItem;
        private AvatarController _avatarController;
        private List<GameObject> _gridCells = new();
        private ItemCategory? _activeCategoryFilter;
        private ItemRarity? _activeRarityFilter;
        private WardrobeSort _activeSort = WardrobeSort.Newest;
        private string _searchQuery = string.Empty;
        private bool _favoritesOnly;
        private bool _newItemsOnly;

        #endregion

        #region Events

        /// <summary>
        /// Invoked when an item is equipped from the wardrobe.
        /// </summary>
        public event Action<InventoryItem> OnItemEquipped;

        /// <summary>
        /// Invoked when an item is unequipped from the wardrobe.
        /// </summary>
        public event Action<InventoryItem> OnItemUnequipped;

        /// <summary>
        /// Invoked when the selected item changes.
        /// </summary>
        public event Action<InventoryItem> OnSelectionChanged;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            if (Preview != null)
                _avatarController = Preview.GetComponent<AvatarController>();

            InitializeCategories();
            InitializeFilters();
            BindUIEvents();
        }

        private void OnEnable()
        {
            EventBus.Subscribe<InventoryUpdatedEvent>(OnInventoryUpdated);
            EventBus.Subscribe<ShowWardrobeCategoryEvent>(OnShowWardrobeCategory);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<InventoryUpdatedEvent>(OnInventoryUpdated);
            EventBus.Unsubscribe<ShowWardrobeCategoryEvent>(OnShowWardrobeCategory);
        }

        #endregion

        #region Public API

        /// <summary>
        /// Opens the wardrobe and refreshes the display.
        /// </summary>
        public void ShowWardrobe()
        {
            gameObject.SetActive(true);
            RefreshWardrobe();
        }

        /// <summary>
        /// Refreshes the wardrobe grid and item count based on current filters.
        /// </summary>
        public void RefreshWardrobe()
        {
            ApplyFilters();
            PopulateGrid();
            UpdateItemCountText();
        }

        /// <summary>
        /// Applies all active filters and sorts the resulting item list.
        /// </summary>
        public void ApplyFilters()
        {
            _filteredItems = GetOwnedItems();

            if (_activeCategoryFilter.HasValue)
                FilterByCategory(_activeCategoryFilter.Value);

            if (_activeRarityFilter.HasValue)
                FilterByRarity(_activeRarityFilter.Value);

            if (!string.IsNullOrWhiteSpace(_searchQuery))
                FilterBySearch(_searchQuery);

            if (_favoritesOnly)
                FilterFavoritesOnly();

            if (_newItemsOnly)
                FilterNewItemsOnly();

            SortItems(_activeSort);
        }

        /// <summary>
        /// Selects an item for preview and action.
        /// </summary>
        /// <param name="item">The inventory item to select.</param>
        public void SelectItem(InventoryItem item)
        {
            _selectedItem = item;
            UpdateActionButtons();
            OnSelectionChanged?.Invoke(item);

            if (item != null && item.PartData != null)
                PreviewItem(item.PartData);
        }

        /// <summary>
        /// Equips the currently selected item onto the avatar.
        /// </summary>
        public void EquipSelected()
        {
            if (_selectedItem == null || _selectedItem.PartData == null) return;

            if (_avatarController != null)
                _avatarController.EquipPart(_selectedItem.PartData);

            _selectedItem.TimesWorn++;
            OnItemEquipped?.Invoke(_selectedItem);

            EventBus.Publish(new AvatarPartEquippedEvent
            {
                PartId = _selectedItem.PartData.PartId,
                LayerName = _selectedItem.PartData.LayerName
            });

            UpdateActionButtons();
            RefreshGridSelection();
        }

        /// <summary>
        /// Unequips the layer corresponding to the currently selected item.
        /// </summary>
        public void UnequipSelected()
        {
            if (_selectedItem == null || _selectedItem.PartData == null) return;

            string layerName = _selectedItem.PartData.LayerName;
            _avatarController?.UnequipLayer(layerName);

            OnItemUnequipped?.Invoke(_selectedItem);
            UpdateActionButtons();
            RefreshGridSelection();
        }

        /// <summary>
        /// Toggles the favorite status of the currently selected item.
        /// </summary>
        public void ToggleFavoriteSelected()
        {
            if (_selectedItem == null) return;

            _selectedItem.IsFavorite = !_selectedItem.IsFavorite;
            RefreshGridSelection();
            UpdateActionButtons();
        }

        /// <summary>
        /// Sorts the filtered items by the given sort mode.
        /// </summary>
        /// <param name="sort">The sort mode to apply.</param>
        public void SortItems(WardrobeSort sort)
        {
            _activeSort = sort;

            switch (sort)
            {
                case WardrobeSort.Newest:
                    _filteredItems = _filteredItems.OrderByDescending(i => i.AcquiredDate).ToList();
                    break;
                case WardrobeSort.Name:
                    _filteredItems = _filteredItems.OrderBy(i => i.PartData?.DisplayName ?? string.Empty).ToList();
                    break;
                case WardrobeSort.Rarity:
                    _filteredItems = _filteredItems.OrderByDescending(i => i.PartData?.Rarity ?? ItemRarity.Common).ToList();
                    break;
                case WardrobeSort.Category:
                    _filteredItems = _filteredItems.OrderBy(i => i.PartData?.LayerName ?? string.Empty).ToList();
                    break;
                case WardrobeSort.MostWorn:
                    _filteredItems = _filteredItems.OrderByDescending(i => i.TimesWorn).ToList();
                    break;
            }
        }

        #endregion

        #region Filtering

        private void FilterByCategory(ItemCategory category)
        {
            _filteredItems = _filteredItems
                .Where(i => i.PartData != null && i.PartData.ItemCategory == category)
                .ToList();
        }

        private void FilterByRarity(ItemRarity rarity)
        {
            _filteredItems = _filteredItems
                .Where(i => i.PartData != null && i.PartData.Rarity == rarity)
                .ToList();
        }

        private void FilterBySearch(string query)
        {
            var lowerQuery = query.ToLowerInvariant();
            _filteredItems = _filteredItems
                .Where(i => i.PartData != null &&
                    (i.PartData.DisplayName.ToLowerInvariant().Contains(lowerQuery) ||
                     i.PartData.Description.ToLowerInvariant().Contains(lowerQuery)))
                .ToList();
        }

        private void FilterFavoritesOnly()
        {
            _filteredItems = _filteredItems.Where(i => i.IsFavorite).ToList();
        }

        private void FilterNewItemsOnly()
        {
            _filteredItems = _filteredItems.Where(i => i.IsNew).ToList();
        }

        #endregion

        #region Grid Population

        private void PopulateGrid()
        {
            ClearGrid();

            if (WardrobeItemPrefab == null || ItemGrid == null) return;

            foreach (var item in _filteredItems)
            {
                var cell = Instantiate(WardrobeItemPrefab, ItemGrid);
                var cellScript = cell.GetComponent<WardrobeItemCell>();
                if (cellScript != null)
                {
                    bool isEquipped = IsItemEquipped(item);
                    cellScript.Setup(item, isEquipped, OnCellClicked, OnCellFavoriteToggled);
                }
                _gridCells.Add(cell);
            }
        }

        private void ClearGrid()
        {
            foreach (var cell in _gridCells)
                if (cell != null) Destroy(cell);
            _gridCells.Clear();
        }

        private void RefreshGridSelection()
        {
            for (int i = 0; i < _gridCells.Count; i++)
            {
                if (i >= _filteredItems.Count) continue;
                var cell = _gridCells[i]?.GetComponent<WardrobeItemCell>();
                if (cell != null)
                    cell.SetEquipped(IsItemEquipped(_filteredItems[i]));
            }
        }

        private void OnCellClicked(InventoryItem item)
        {
            SelectItem(item);
        }

        private void OnCellFavoriteToggled(InventoryItem item)
        {
            if (item == null) return;
            item.IsFavorite = !item.IsFavorite;
            if (_favoritesOnly)
                RefreshWardrobe();
            else
                RefreshGridSelection();
        }

        private bool IsItemEquipped(InventoryItem item)
        {
            if (_avatarController == null || item?.PartData == null) return false;
            var equipped = _avatarController.GetEquippedPart(item.PartData.LayerName);
            return equipped != null && equipped.PartId == item.PartData.PartId;
        }

        private void PreviewItem(AvatarPartData part)
        {
            if (Preview != null && part != null)
            {
                Preview.PreviewPart(part);
            }
        }

        #endregion

        #region Data Access

        private List<InventoryItem> GetOwnedItems()
        {
            if (InventoryManager.Instance != null)
                return InventoryManager.Instance.GetAllOwnedItems();
            return new List<InventoryItem>();
        }

        #endregion

        #region UI Initialization

        private void InitializeCategories()
        {
            if (Categories.Count == 0)
            {
                Categories.Add(new WardrobeCategory { Name = "All", Icon = null, Category = ItemCategory.None });
                Categories.Add(new WardrobeCategory { Name = "Tops", Icon = null, Category = ItemCategory.Top });
                Categories.Add(new WardrobeCategory { Name = "Bottoms", Icon = null, Category = ItemCategory.Bottom });
                Categories.Add(new WardrobeCategory { Name = "Shoes", Icon = null, Category = ItemCategory.Shoes });
                Categories.Add(new WardrobeCategory { Name = "Accessories", Icon = null, Category = ItemCategory.Accessory });
                Categories.Add(new WardrobeCategory { Name = "Hair", Icon = null, Category = ItemCategory.Hair });
            }
        }

        private void InitializeFilters()
        {
            if (CategoryFilter != null)
            {
                CategoryFilter.ClearOptions();
                CategoryFilter.AddOptions(Categories.Select(c => c.Name).ToList());
                CategoryFilter.value = 0;
                CategoryFilter.RefreshShownValue();
            }

            if (RarityFilter != null)
            {
                RarityFilter.ClearOptions();
                RarityFilter.AddOptions(Enum.GetNames(typeof(ItemRarity)).ToList());
                RarityFilter.value = 0;
                RarityFilter.RefreshShownValue();
            }

            if (SortFilter != null)
            {
                SortFilter.ClearOptions();
                SortFilter.AddOptions(Enum.GetNames(typeof(WardrobeSort)).ToList());
                SortFilter.value = (int)WardrobeSort.Newest;
                SortFilter.RefreshShownValue();
            }
        }

        private void BindUIEvents()
        {
            if (CategoryFilter != null)
                CategoryFilter.onValueChanged.AddListener(OnCategoryFilterChanged);

            if (RarityFilter != null)
                RarityFilter.onValueChanged.AddListener(OnRarityFilterChanged);

            if (SortFilter != null)
                SortFilter.onValueChanged.AddListener(OnSortFilterChanged);

            if (SearchInput != null)
                SearchInput.onValueChanged.AddListener(OnSearchChanged);

            if (FavoritesToggle != null)
                FavoritesToggle.onValueChanged.AddListener(OnFavoritesToggled);

            if (NewItemsToggle != null)
                NewItemsToggle.onValueChanged.AddListener(OnNewItemsToggled);

            if (EquipButton != null)
                EquipButton.onClick.AddListener(EquipSelected);

            if (UnequipButton != null)
                UnequipButton.onClick.AddListener(UnequipSelected);

            if (FavoriteButton != null)
                FavoriteButton.onClick.AddListener(ToggleFavoriteSelected);
        }

        #endregion

        #region UI Event Handlers

        private void OnCategoryFilterChanged(int index)
        {
            if (index == 0)
                _activeCategoryFilter = null;
            else if (index < Categories.Count)
                _activeCategoryFilter = Categories[index].Category;
            RefreshWardrobe();
        }

        private void OnRarityFilterChanged(int index)
        {
            if (index == 0)
                _activeRarityFilter = null;
            else
                _activeRarityFilter = (ItemRarity)(index - 1);
            RefreshWardrobe();
        }

        private void OnSortFilterChanged(int index)
        {
            _activeSort = (WardrobeSort)index;
            RefreshWardrobe();
        }

        private void OnSearchChanged(string query)
        {
            _searchQuery = query;
            RefreshWardrobe();
        }

        private void OnFavoritesToggled(bool isOn)
        {
            _favoritesOnly = isOn;
            RefreshWardrobe();
        }

        private void OnNewItemsToggled(bool isOn)
        {
            _newItemsOnly = isOn;
            RefreshWardrobe();
        }

        #endregion

        #region UI Updates

        private void UpdateItemCountText()
        {
            if (ItemCountText == null) return;
            int total = InventoryManager.Instance?.GetAllOwnedItems().Count ?? 0;
            int shown = _filteredItems.Count;
            ItemCountText.text = $"{shown} / {total} items";
        }

        private void UpdateActionButtons()
        {
            bool hasSelection = _selectedItem != null;
            bool isEquipped = hasSelection && IsItemEquipped(_selectedItem);
            bool isFavorite = _selectedItem?.IsFavorite ?? false;

            if (EquipButton != null)
                EquipButton.interactable = hasSelection && !isEquipped;

            if (UnequipButton != null)
                UnequipButton.interactable = hasSelection && isEquipped;

            if (FavoriteButton != null)
            {
                FavoriteButton.interactable = hasSelection;
                var favText = FavoriteButton.GetComponentInChildren<TMP_Text>(true);
                if (favText != null)
                    favText.text = isFavorite ? "Unfavorite" : "Favorite";
            }
        }

        #endregion

        #region Event Bus Handlers

        private void OnInventoryUpdated(InventoryUpdatedEvent evt)
        {
            RefreshWardrobe();
        }

        private void OnShowWardrobeCategory(ShowWardrobeCategoryEvent evt)
        {
            for (int i = 0; i < Categories.Count; i++)
            {
                if (Categories[i].Category == evt.Category)
                {
                    if (CategoryFilter != null)
                        CategoryFilter.value = i;
                    _activeCategoryFilter = evt.Category;
                    RefreshWardrobe();
                    return;
                }
            }
        }

        #endregion
    }

    #region Supporting Types

    /// <summary>
    /// Represents an item in the player's inventory with usage metadata.
    /// </summary>
    [System.Serializable]
    public class InventoryItem
    {
        public string ItemId;
        public AvatarPartData PartData;
        public bool IsFavorite;
        public bool IsNew;
        public long AcquiredDate;
        public int TimesWorn;
    }

    /// <summary>
    /// Item rarity tiers.
    /// </summary>
    public enum ItemRarity { Common, Uncommon, Rare, Epic, Legendary }

    /// <summary>
    /// Item category types.
    /// </summary>
    public enum ItemCategory { None, Body, Head, HairFront, HairBack, Top, Bottom, Shoes, Accessory }

    #endregion
}
