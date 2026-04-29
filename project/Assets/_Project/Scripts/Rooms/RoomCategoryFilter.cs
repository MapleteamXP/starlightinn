using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace KawaiiCoolIsland.Rooms
{
    /// <summary>
    /// UI category filter bar for the room browser in KawaiiCool Island v2.0.
    /// Displays category buttons with dynamic counts and supports single-select filtering.
    /// </summary>
    public class RoomCategoryFilter : MonoBehaviour
    {
        #region Categories

        [Header("Categories")]
        /// <summary>Parent transform for category button instantiation.</summary>
        public Transform CategoryContainer;

        /// <summary>Prefab for a single category button (expects Image + TMP_Text + Button).</summary>
        public GameObject CategoryButtonPrefab;

        /// <summary>Static configuration for each available category.</summary>
        public List<RoomCategoryData> Categories = new();

        #endregion

        #region Selection Styling

        [Header("Selected")]
        /// <summary>Currently selected room category filter.</summary>
        public RoomCategory SelectedCategory = RoomCategory.All;

        /// <summary>Color applied to the selected category button.</summary>
        public Color SelectedColor = Color.cyan;

        /// <summary>Color applied to unselected category buttons.</summary>
        public Color NormalColor = Color.white;

        /// <summary>Scale factor for the selected button.</summary>
        public float SelectedScale = 1.05f;

        /// <summary>Normal scale for unselected buttons.</summary>
        public float NormalScale = 1.0f;

        #endregion

        #region Internal State

        /// <summary>Instantiated category buttons keyed by category enum.</summary>
        private readonly Dictionary<RoomCategory, GameObject> _categoryButtons = new();

        /// <summary>Count labels keyed by category enum for dynamic updates.</summary>
        private readonly Dictionary<RoomCategory, TMP_Text> _countLabels = new();

        /// <summary>Background images keyed by category enum for color updates.</summary>
        private readonly Dictionary<RoomCategory, Image> _buttonImages = new();

        /// <summary>Whether the component has been initialized.</summary>
        private bool _isInitialized;

        #endregion

        #region Events

        /// <summary>Raised when the player selects a different category.</summary>
        public event Action<RoomCategory> OnCategorySelected;

        #endregion

        #region Unity Lifecycle

        private void Start()
        {
            SetupCategories();
        }

        private void OnEnable()
        {
            EventBus.Subscribe<RoomListUpdatedEvent>(OnRoomListUpdated);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<RoomListUpdatedEvent>(OnRoomListUpdated);
        }

        #endregion

        #region Category Setup

        /// <summary>
        /// Creates category buttons from the <see cref="Categories"/> configuration.
        /// Clears and rebuilds if already initialized.
        /// </summary>
        public void SetupCategories()
        {
            if (_isInitialized)
            {
                // Rebuild: clear existing
                foreach (var kvp in _categoryButtons)
                {
                    if (kvp.Value != null)
                        Destroy(kvp.Value);
                }
                _categoryButtons.Clear();
                _countLabels.Clear();
                _buttonImages.Clear();
            }

            if (CategoryContainer == null || CategoryButtonPrefab == null)
            {
                Debug.LogWarning("[RoomCategoryFilter] CategoryContainer or CategoryButtonPrefab is not assigned.");
                return;
            }

            // Ensure All category is always present
            if (!Categories.Any(c => c.Category == RoomCategory.All))
            {
                Categories.Insert(0, new RoomCategoryData
                {
                    Category = RoomCategory.All,
                    DisplayName = "All",
                    Color = NormalColor,
                    Description = "Show all rooms"
                });
            }

            foreach (RoomCategoryData data in Categories)
            {
                GameObject btnGO = Instantiate(CategoryButtonPrefab, CategoryContainer);
                btnGO.name = $"Category_{data.Category}";

                // Bind components
                Image bgImage = btnGO.GetComponent<Image>() ?? btnGO.GetComponentInChildren<Image>();
                TMP_Text label = btnGO.GetComponentInChildren<TMP_Text>();
                Button button = btnGO.GetComponent<Button>() ?? btnGO.GetComponentInChildren<Button>();

                // Set label
                if (label != null)
                {
                    label.text = data.DisplayName;
                    _countLabels[data.Category] = label;
                }

                // Set initial color
                if (bgImage != null)
                {
                    bgImage.color = data.Category == SelectedCategory ? (data.Color != default ? data.Color : SelectedColor) : NormalColor;
                    _buttonImages[data.Category] = bgImage;
                }

                // Set icon if available
                Image iconImage = btnGO.transform.Find("Icon")?.GetComponent<Image>();
                if (iconImage != null && data.Icon != null)
                    iconImage.sprite = data.Icon;

                // Bind click
                if (button != null)
                {
                    RoomCategory captured = data.Category;
                    button.onClick.RemoveAllListeners();
                    button.onClick.AddListener(() => SelectCategory(captured));
                }

                _categoryButtons[data.Category] = btnGO;
            }

            _isInitialized = true;
            RefreshSelectionVisuals();
        }

        #endregion

        #region Selection

        /// <summary>
        /// Selects a category and applies the filter through <see cref="RoomBrowser"/>.
        /// </summary>
        /// <param name="category">The category to select.</param>
        public void SelectCategory(RoomCategory category)
        {
            if (SelectedCategory == category)
                return;

            SelectedCategory = category;
            RefreshSelectionVisuals();

            // Push to RoomBrowser
            RoomBrowser.Instance?.FilterByCategory(category);

            OnCategorySelected?.Invoke(category);
            EventBus.Publish(new CategorySelectedEvent { Category = category });
        }

        /// <summary>
        /// Updates the visual state (color, scale) of all category buttons based on selection.
        /// </summary>
        private void RefreshSelectionVisuals()
        {
            foreach (var kvp in _categoryButtons)
            {
                RoomCategory cat = kvp.Key;
                GameObject btnGO = kvp.Value;

                if (btnGO == null)
                    continue;

                bool isSelected = cat == SelectedCategory;

                if (_buttonImages.TryGetValue(cat, out Image img) && img != null)
                {
                    RoomCategoryData data = Categories.FirstOrDefault(c => c.Category == cat);
                    Color targetColor = isSelected
                        ? (data.Color != default ? data.Color : SelectedColor)
                        : NormalColor;
                    img.color = targetColor;
                }

                // Scale animation
                btnGO.transform.localScale = isSelected ? Vector3.one * SelectedScale : Vector3.one * NormalScale;
            }
        }

        #endregion

        #region Dynamic Counts

        /// <summary>
        /// Updates the count badge on each category button from a supplied dictionary.
        /// </summary>
        /// <param name="counts">Mapping of category to available room count.</param>
        public void RefreshCategoryCounts(Dictionary<RoomCategory, int> counts)
        {
            if (counts == null)
                return;

            foreach (var kvp in counts)
            {
                if (_countLabels.TryGetValue(kvp.Key, out TMP_Text label) && label != null)
                {
                    RoomCategoryData data = Categories.FirstOrDefault(c => c.Category == kvp.Key);
                    string baseName = data.DisplayName ?? kvp.Key.ToString();
                    label.text = $"{baseName} ({kvp.Value})";
                }
            }

            // Update All count with total
            if (_countLabels.TryGetValue(RoomCategory.All, out TMP_Text allLabel) && allLabel != null)
            {
                int total = counts.Values.Sum();
                RoomCategoryData allData = Categories.FirstOrDefault(c => c.Category == RoomCategory.All);
                string allName = allData.DisplayName ?? "All";
                allLabel.text = $"{allName} ({total})";
            }
        }

        /// <summary>
        /// Computes and refreshes category counts from the current <see cref="RoomBrowser.AllRooms"/>.
        /// </summary>
        public void RefreshCategoryCountsFromBrowser()
        {
            List<RoomInfo> all = RoomBrowser.Instance?.AllRooms;
            if (all == null)
                return;

            var counts = new Dictionary<RoomCategory, int>();
            foreach (RoomCategory cat in System.Enum.GetValues(typeof(RoomCategory)))
            {
                counts[cat] = 0;
            }

            foreach (RoomInfo room in all)
            {
                counts[room.Category]++;
                counts[RoomCategory.All]++;

                if (room.IsOfficial)
                    counts[RoomCategory.Official]++;

                if (room.IsEvent)
                    counts[RoomCategory.Events]++;

                long cutoff = DateTimeOffset.UtcNow.AddDays(-7).ToUnixTimeSeconds();
                if (room.CreatedDate >= cutoff)
                    counts[RoomCategory.New]++;
            }

            RefreshCategoryCounts(counts);
        }

        #endregion

        #region EventBus Handlers

        private void OnRoomListUpdated(RoomListUpdatedEvent evt)
        {
            RefreshCategoryCountsFromBrowser();
        }

        #endregion
    }

    #region Data Model

    /// <summary>
    /// Configuration data for a single room category filter button.
    /// </summary>
    [System.Serializable]
    public class RoomCategoryData
    {
        /// <summary>The category enum value.</summary>
        public RoomCategory Category;

        /// <summary>Display label on the button.</summary>
        public string DisplayName;

        /// <summary>Optional icon sprite.</summary>
        public Sprite Icon;

        /// <summary>Tint color for the selected state.</summary>
        public Color Color;

        /// <summary>Tooltip / accessibility description.</summary>
        public string Description;
    }

    #endregion

    #region EventBus Events

    /// <summary>
    /// Published when a category is selected in the filter UI.
    /// </summary>
    public struct CategorySelectedEvent
    {
        /// <summary>The selected category.</summary>
        public RoomCategory Category;
    }

    #endregion
}
