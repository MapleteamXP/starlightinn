// -----------------------------------------------------------------------
// ShopUI.cs
// Shop user-interface panel.  Displays sections, item grids, previews,
// currency balances, and the daily rotation timer.
// -----------------------------------------------------------------------

using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace KawaiiCool.Inventory
{
    /// <summary>
    /// Base class for UI panels in the KawaiiCool UI system.
    /// </summary>
    public abstract class UIPanel : MonoBehaviour
    {
        [Tooltip("Root GameObject that is toggled to show/hide the panel.")]
        public GameObject PanelRoot;

        [Tooltip("Animator for show/hide transitions.")]
        public Animator PanelAnimator;

        [Tooltip("If true, the panel blocks raycasts on panels beneath it.")]
        public bool IsModal = true;

        /// <summary>Shows the panel.</summary>
        public virtual void ShowPanel()
        {
            if (PanelRoot != null)
                PanelRoot.SetActive(true);

            if (PanelAnimator != null)
                PanelAnimator.SetTrigger("Show");

            OnPanelShow();
        }

        /// <summary>Hides the panel.</summary>
        public virtual void HidePanel()
        {
            if (PanelAnimator != null)
                PanelAnimator.SetTrigger("Hide");
            else if (PanelRoot != null)
                PanelRoot.SetActive(false);

            OnPanelHide();
        }

        /// <summary>Called immediately after the panel becomes visible.</summary>
        public virtual void OnPanelShow() { }

        /// <summary>Called when the panel begins to hide.</summary>
        public virtual void OnPanelHide() { }
    }

    // =====================================================================
    // ShopUI
    // =====================================================================

    /// <summary>
    /// Full shop interface panel.  Renders sections, item grids, previews,
    /// and currency displays.  Communicates with ShopManager.
    /// </summary>
    public class ShopUI : UIPanel
    {
        #region Inspector — Sections
        [Header("Sections")]
        [Tooltip("Parent transform for section tab buttons.")]
        public Transform SectionContainer;

        [Tooltip("Prefab for a single section tab button.")]
        public GameObject SectionButtonPrefab;

        [Tooltip("Parent transform for the item grid.")]
        public Transform ItemGridContainer;

        [Tooltip("Prefab for a single shop item cell.")]
        public GameObject ShopItemPrefab;
        #endregion

        #region Inspector — Preview
        [Header("Preview")]
        [Tooltip("Root of the item preview overlay.")]
        public GameObject PreviewPanel;

        [Tooltip("Large image of the previewed item.")]
        public Image PreviewImage;

        [Tooltip("Name text in the preview panel.")]
        public TMP_Text PreviewName;

        [Tooltip("Description text in the preview panel.")]
        public TMP_Text PreviewDescription;

        [Tooltip("Price text in the preview panel.")]
        public TMP_Text PreviewPrice;

        [Tooltip("Button that confirms purchase.")]
        public Button PurchaseButton;

        [Tooltip("Button that initiates gifting.")]
        public Button GiftButton;

        [Tooltip("Button that opens a 3D preview scene.")]
        public Button PreviewButton;
        #endregion

        #region Inspector — Currency
        [Header("Currency")]
        [Tooltip("Text showing coin balance.")]
        public TMP_Text CoinsText;

        [Tooltip("Text showing gem balance.")]
        public TMP_Text GemsText;

        [Tooltip("Button to open the coin top-up flow.")]
        public Button AddCoinsButton;

        [Tooltip("Button to open the gem top-up flow.")]
        public Button AddGemsButton;
        #endregion

        #region Inspector — Daily
        [Header("Daily")]
        [Tooltip("Container for daily rotation item thumbnails.")]
        public Transform DailyItemsContainer;

        [Tooltip("Text counting down to next daily refresh.")]
        public TMP_Text DailyRefreshTimer;
        #endregion

        // ------------------------------------------------------------------
        // Runtime state
        // ------------------------------------------------------------------
        private ShopSection _currentSection;
        private ItemData _previewedItem;
        private readonly List<GameObject> _spawnedItems = new();
        private readonly List<GameObject> _spawnedSectionButtons = new();
        private Coroutine _dailyTimerCoroutine;

        // ------------------------------------------------------------------
        // Lifecycle
        // ------------------------------------------------------------------
        private void Awake()
        {
            if (PurchaseButton != null)
                PurchaseButton.onClick.AddListener(OnPurchaseClicked);

            if (GiftButton != null)
                GiftButton.onClick.AddListener(OnGiftClicked);

            if (PreviewButton != null)
                PreviewButton.onClick.AddListener(() =>
                {
                    if (_previewedItem != null)
                        ShopManager.Instance?.OpenItemPreview(_previewedItem);
                });

            if (AddCoinsButton != null)
                AddCoinsButton.onClick.AddListener(() =>
                {
                    Debug.Log("[ShopUI] Open coin purchase flow.");
                });

            if (AddGemsButton != null)
                AddGemsButton.onClick.AddListener(() =>
                {
                    Debug.Log("[ShopUI] Open gem purchase flow.");
                });
        }

        private void OnDestroy()
        {
            if (PurchaseButton != null)
                PurchaseButton.onClick.RemoveListener(OnPurchaseClicked);

            if (GiftButton != null)
                GiftButton.onClick.RemoveListener(OnGiftClicked);
        }

        // ------------------------------------------------------------------
        // Panel overrides
        // ------------------------------------------------------------------

        /// <summary>
        /// Called when the shop panel is shown.  Refreshes all content.
        /// </summary>
        public override void OnPanelShow()
        {
            base.OnPanelShow();

            BuildSectionTabs();
            RefreshCurrencyDisplay();

            // Default to first section or daily
            if (ShopManager.Instance != null && ShopManager.Instance.Sections.Count > 0)
                ShowSection(ShopManager.Instance.Sections[0].SectionId);
            else
                ShowDailyItems();

            StartDailyTimer();
        }

        public override void OnPanelHide()
        {
            base.OnPanelHide();
            StopDailyTimer();
            ClosePreview();
        }

        // ------------------------------------------------------------------
        // Section Navigation
        // ------------------------------------------------------------------

        /// <summary>
        /// Displays the items for the given section.
        /// </summary>
        public void ShowSection(string sectionId)
        {
            if (ShopManager.Instance == null) return;

            _currentSection = ShopManager.Instance.Sections.FirstOrDefault(s => s.SectionId == sectionId);
            if (_currentSection == null) return;

            var items = ShopManager.Instance.GetSectionItems(sectionId);
            PopulateItemGrid(items);
            HighlightSectionTab(sectionId);
        }

        /// <summary>
        /// Shows the daily rotation items.
        /// </summary>
        public void ShowDailyItems()
        {
            if (ShopManager.Instance == null) return;

            _currentSection = null;
            var items = ShopManager.Instance.GetDailyRotation();
            PopulateItemGrid(items);

            // Also populate the daily thumbnails row
            PopulateDailyRow(items);
        }

        /// <summary>
        /// Shows the featured items.
        /// </summary>
        public void ShowFeaturedItems()
        {
            if (ShopManager.Instance == null) return;

            _currentSection = null;
            var items = ShopManager.Instance.GetFeaturedItems();
            PopulateItemGrid(items);
        }

        // ------------------------------------------------------------------
        // Item Grid
        // ------------------------------------------------------------------

        /// <summary>
        /// Clears and repopulates the main item grid.
        /// </summary>
        private void PopulateItemGrid(List<ItemData> items)
        {
            ClearSpawnedItems();

            if (ItemGridContainer == null || ShopItemPrefab == null) return;

            foreach (var item in items)
            {
                if (item == null) continue;

                GameObject go = Instantiate(ShopItemPrefab, ItemGridContainer);
                var cell = go.GetComponent<ShopItemCell>();
                if (cell == null) cell = go.AddComponent<ShopItemCell>();

                cell.Setup(item, ShopManager.Instance.GetDiscountedPrice(item));
                cell.OnClicked += HandleShopItemClicked;

                _spawnedItems.Add(go);
            }
        }

        /// <summary>
        /// Populates the small daily-rotation thumbnail row.
        /// </summary>
        private void PopulateDailyRow(List<ItemData> items)
        {
            if (DailyItemsContainer == null) return;

            // Clear previous
            foreach (Transform child in DailyItemsContainer)
            {
                if (child != null) Destroy(child.gameObject);
            }

            foreach (var item in items)
            {
                if (item == null) continue;

                GameObject go = Instantiate(ShopItemPrefab, DailyItemsContainer);
                var cell = go.GetComponent<ShopItemCell>();
                if (cell == null) cell = go.AddComponent<ShopItemCell>();

                cell.Setup(item, ShopManager.Instance.GetDiscountedPrice(item));
                cell.SetCompactMode(true);
                cell.OnClicked += HandleShopItemClicked;
            }
        }

        private void ClearSpawnedItems()
        {
            foreach (var go in _spawnedItems)
            {
                if (go != null) Destroy(go);
            }
            _spawnedItems.Clear();
        }

        // ------------------------------------------------------------------
        // Section Tabs
        // ------------------------------------------------------------------

        private void BuildSectionTabs()
        {
            if (SectionContainer == null || SectionButtonPrefab == null) return;

            // Clear old
            foreach (var btn in _spawnedSectionButtons)
            {
                if (btn != null) Destroy(btn);
            }
            _spawnedSectionButtons.Clear();

            if (ShopManager.Instance == null) return;

            foreach (var section in ShopManager.Instance.Sections)
            {
                if (!section.IsAvailable()) continue;

                GameObject go = Instantiate(SectionButtonPrefab, SectionContainer);
                var txt = go.GetComponentInChildren<TMP_Text>();
                if (txt != null) txt.text = section.DisplayName;

                var img = go.GetComponentInChildren<Image>();
                if (img != null && section.Icon != null) img.sprite = section.Icon;

                var btn = go.GetComponent<Button>();
                string capturedId = section.SectionId;
                if (btn != null)
                    btn.onClick.AddListener(() => ShowSection(capturedId));

                _spawnedSectionButtons.Add(go);
            }
        }

        private void HighlightSectionTab(string sectionId)
        {
            // Visual highlighting logic would go here
            // e.g. change button colors based on selection
        }

        // ------------------------------------------------------------------
        // Preview
        // ------------------------------------------------------------------

        /// <summary>
        /// Opens the preview overlay for the given item.
        /// </summary>
        public void PreviewItem(ItemData item)
        {
            if (item == null || PreviewPanel == null) return;

            _previewedItem = item;

            if (PreviewImage != null)
            {
                PreviewImage.sprite = item.Icon;
                PreviewImage.enabled = item.Icon != null;
            }

            if (PreviewName != null)
            {
                string hex = item.GetRarityColorHex();
                PreviewName.text = $"<color={hex}>{item.DisplayName}</color>";
            }

            if (PreviewDescription != null)
                PreviewDescription.text = item.Description;

            if (PreviewPrice != null)
            {
                int price = ShopManager.Instance.GetDiscountedPrice(item);
                PreviewPrice.text = $"{price:N0} <sprite name={item.PurchaseCurrency}>";
            }

            // Disable purchase if unaffordable
            if (PurchaseButton != null)
            {
                bool canAfford = ShopManager.Instance.CanAfford(item);
                PurchaseButton.interactable = canAfford;
            }

            // Disable gift if not giftable
            if (GiftButton != null)
                GiftButton.interactable = item.IsGiftable;

            PreviewPanel.SetActive(true);
        }

        /// <summary>
        /// Closes the preview overlay.
        /// </summary>
        public void ClosePreview()
        {
            _previewedItem = null;
            if (PreviewPanel != null)
                PreviewPanel.SetActive(false);
        }

        // ------------------------------------------------------------------
        // Button Handlers
        // ------------------------------------------------------------------

        /// <summary>
        /// Called when the Purchase button in the preview panel is clicked.
        /// </summary>
        public void OnPurchaseClicked()
        {
            if (_previewedItem == null || ShopManager.Instance == null) return;

            ShopManager.Instance.PurchaseItem(_previewedItem);
            RefreshCurrencyDisplay();

            // Refresh grid to reflect any availability changes
            if (_currentSection != null)
                ShowSection(_currentSection.SectionId);
            else
                ShowDailyItems();
        }

        /// <summary>
        /// Called when the Gift button in the preview panel is clicked.
        /// </summary>
        public void OnGiftClicked()
        {
            if (_previewedItem == null) return;

            Debug.Log("[ShopUI] Gift flow not yet implemented — needs recipient picker.");
            // In production this would open a friend-picker overlay
        }

        // ------------------------------------------------------------------
        // Currency Display
        // ------------------------------------------------------------------

        /// <summary>
        /// Refreshes the coin and gem text from InventoryManager.
        /// </summary>
        public void RefreshCurrencyDisplay()
        {
            if (InventoryManager.Instance == null) return;

            if (CoinsText != null)
            {
                int coins = InventoryManager.Instance.GetCurrency("coins");
                CoinsText.text = coins.ToString("N0");
            }

            if (GemsText != null)
            {
                int gems = InventoryManager.Instance.GetCurrency("gems");
                GemsText.text = gems.ToString("N0");
            }
        }

        // ------------------------------------------------------------------
        // Daily Timer
        // ------------------------------------------------------------------

        private void StartDailyTimer()
        {
            StopDailyTimer();
            _dailyTimerCoroutine = StartCoroutine(DailyTimerRoutine());
        }

        private void StopDailyTimer()
        {
            if (_dailyTimerCoroutine != null)
            {
                StopCoroutine(_dailyTimerCoroutine);
                _dailyTimerCoroutine = null;
            }
        }

        private IEnumerator DailyTimerRoutine()
        {
            while (true)
            {
                UpdateDailyTimer();
                yield return new WaitForSeconds(1f);
            }
        }

        private void UpdateDailyTimer()
        {
            if (DailyRefreshTimer == null) return;

            DateTime now = DateTime.UtcNow;
            DateTime nextMidnight = now.Date.AddDays(1);
            TimeSpan remaining = nextMidnight - now;

            DailyRefreshTimer.text = $"{remaining.Hours:D2}:{remaining.Minutes:D2}:{remaining.Seconds:D2}";
        }

        // ------------------------------------------------------------------
        // Event handlers
        // ------------------------------------------------------------------

        private void HandleShopItemClicked(ItemData item)
        {
            PreviewItem(item);
        }
    }

    // =====================================================================
    // ShopItemCell — single item display inside the shop grid
    // =====================================================================

    /// <summary>
    /// UI component for a single item cell inside the shop grid.
    /// </summary>
    public class ShopItemCell : MonoBehaviour
    {
        [Header("Visual")]
        public Image ItemIcon;
        public Image RarityBorder;
        public TMP_Text NameText;
        public TMP_Text PriceText;
        public Button ClickButton;
        public GameObject DiscountBadge;
        public TMP_Text DiscountText;

        /// <summary>Fired when the user clicks this cell.</summary>
        public event Action<ItemData> OnClicked;

        private ItemData _item;
        private bool _isCompact;

        /// <summary>
        /// Configures the cell with item data and its current price.
        /// </summary>
        public void Setup(ItemData item, int discountedPrice)
        {
            _item = item;
            if (item == null) return;

            if (ItemIcon != null)
            {
                ItemIcon.sprite = item.Icon;
                ItemIcon.enabled = item.Icon != null;
            }

            if (RarityBorder != null)
            {
                RarityBorder.sprite = item.RarityBorder;
                RarityBorder.color = item.RarityColor;
                RarityBorder.enabled = true;
            }

            if (NameText != null)
            {
                NameText.text = item.DisplayName;
                if (!_isCompact)
                    NameText.color = item.RarityColor;
            }

            if (PriceText != null)
            {
                if (discountedPrice < item.PurchasePrice)
                {
                    PriceText.text = $"<s>{item.PurchasePrice:N0}</s> {discountedPrice:N0}";
                }
                else
                {
                    PriceText.text = $"{discountedPrice:N0}";
                }
            }

            if (DiscountBadge != null)
            {
                bool hasDiscount = discountedPrice < item.PurchasePrice;
                DiscountBadge.SetActive(hasDiscount);
                if (hasDiscount && DiscountText != null)
                {
                    int pct = Mathf.RoundToInt(100f * (1f - (float)discountedPrice / item.PurchasePrice));
                    DiscountText.text = $"-{pct}%";
                }
            }

            if (ClickButton != null)
            {
                ClickButton.onClick.RemoveAllListeners();
                ClickButton.onClick.AddListener(() => OnClicked?.Invoke(_item));
            }
        }

        /// <summary>
        /// Switches between full and compact display modes.
        /// </summary>
        public void SetCompactMode(bool compact)
        {
            _isCompact = compact;
            if (NameText != null)
                NameText.gameObject.SetActive(!compact);
            if (PriceText != null)
                PriceText.gameObject.SetActive(!compact);
        }
    }
}
