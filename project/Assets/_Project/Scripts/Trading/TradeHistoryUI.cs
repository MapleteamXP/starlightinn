using System;
using System.Collections.Generic;
using System.Linq;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace KawaiiCoolIsland.Trading
{
    /// <summary>
    /// Trade history browser UI panel that displays past completed trades,
    /// supports detail inspection, and provides history management options.
    /// </summary>
    public class TradeHistoryUI : UIPanel
    {
        #region Serialized Fields

        [Header("History")]
        [SerializeField] private Transform _historyList;
        [SerializeField] private GameObject _tradeRecordPrefab;
        [SerializeField] private TMP_Text _totalTradesText;
        [SerializeField] private Button _clearHistoryButton;
        [SerializeField] private ScrollRect _scrollRect;

        [Header("Detail View")]
        [SerializeField] private GameObject _detailPanel;
        [SerializeField] private TMP_Text _detailPartnerText;
        [SerializeField] private TMP_Text _detailDateText;
        [SerializeField] private Transform _detailGaveGrid;
        [SerializeField] private Transform _detailReceivedGrid;
        [SerializeField] private TMP_Text _detailFairnessText;
        [SerializeField] private Button _detailCloseButton;

        [Header("Filters")]
        [SerializeField] private TMP_Dropdown _filterDropdown;
        [SerializeField] private TMP_InputField _searchInput;

        #endregion

        #region Private Fields

        private List<GameObject> _recordObjects = new List<GameObject>();
        private List<GameObject> _detailGaveObjects = new List<GameObject>();
        private List<GameObject> _detailReceivedObjects = new List<GameObject>();
        private List<TradeRecord> _currentRecords = new List<TradeRecord>();
        private string _selectedTradeId;
        private TradeHistoryFilter _currentFilter = TradeHistoryFilter.All;

        #endregion

        #region UIPanel Overrides

        /// <summary>
        /// Called when the history panel is shown. Refreshes the trade history list.
        /// </summary>
        public override void OnPanelShow()
        {
            base.OnPanelShow();
            SubscribeToEvents();
            RefreshHistory();
        }

        /// <summary>
        /// Called when the history panel is hidden. Cleans up detail view.
        /// </summary>
        public override void OnPanelHide()
        {
            base.OnPanelHide();
            UnsubscribeFromEvents();
            HideDetailPanel();
        }

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            if (_clearHistoryButton != null)
                _clearHistoryButton.onClick.AddListener(OnClearHistoryClicked);
            if (_detailCloseButton != null)
                _detailCloseButton.onClick.AddListener(HideDetailPanel);
            if (_searchInput != null)
                _searchInput.onValueChanged.AddListener(OnSearchChanged);
            if (_filterDropdown != null)
                _filterDropdown.onValueChanged.AddListener(OnFilterChanged);

            SetupFilterDropdown();
            HideDetailPanel();
        }

        private void OnDestroy()
        {
            if (_clearHistoryButton != null)
                _clearHistoryButton.onClick.RemoveListener(OnClearHistoryClicked);
            if (_detailCloseButton != null)
                _detailCloseButton.onClick.RemoveListener(HideDetailPanel);
            if (_searchInput != null)
                _searchInput.onValueChanged.RemoveListener(OnSearchChanged);
            if (_filterDropdown != null)
                _filterDropdown.onValueChanged.RemoveListener(OnFilterChanged);
        }

        #endregion

        #region Initialization

        private void SetupFilterDropdown()
        {
            if (_filterDropdown == null) return;

            _filterDropdown.ClearOptions();
            _filterDropdown.AddOptions(new List<string>
            {
                "All Trades",
                "Fair Trades",
                "Unfair Trades",
                "Premium Items",
                "Currency Only"
            });
        }

        #endregion

        #region Event Subscriptions

        private void SubscribeToEvents()
        {
            EventBus.Subscribe<TradeCompletedEvent>(OnTradeCompleted);
        }

        private void UnsubscribeFromEvents()
        {
            EventBus.Unsubscribe<TradeCompletedEvent>(OnTradeCompleted);
        }

        private void OnTradeCompleted(TradeCompletedEvent evt)
        {
            RefreshHistory();
        }

        #endregion

        #region History Refresh

        /// <summary>
        /// Refreshes the history list from the TradingManager and repopulates the UI.
        /// Applies current filter and search terms.
        /// </summary>
        public void RefreshHistory()
        {
            ClearRecordObjects();

            var allRecords = TradingManager.Instance?.GetTradeHistory(100) ?? new List<TradeRecord>();
            _currentRecords = ApplyFilterAndSearch(allRecords);

            if (_totalTradesText != null)
                _totalTradesText.text = $"Total Trades: {_currentRecords.Count}";

            PopulateHistory();
        }

        private void PopulateHistory()
        {
            if (_historyList == null || _tradeRecordPrefab == null) return;

            foreach (var record in _currentRecords)
            {
                var go = Instantiate(_tradeRecordPrefab, _historyList);
                var recordUI = go.GetComponent<TradeRecordUI>();
                if (recordUI != null)
                {
                    recordUI.Setup(record, () => OnRecordClicked(record.TradeId));
                }
                else
                {
                    // Fallback setup if TradeRecordUI component is not available
                    SetupFallbackRecordUI(go, record);
                }
                _recordObjects.Add(go);
            }
        }

        private void SetupFallbackRecordUI(GameObject go, TradeRecord record)
        {
            var texts = go.GetComponentsInChildren<TMP_Text>(true);
            if (texts.Length > 0)
                texts[0].text = record.PartnerName;
            if (texts.Length > 1)
                texts[1].text = FormatTimestamp(record.Timestamp);

            var button = go.GetComponent<Button>();
            if (button != null)
            {
                string tradeId = record.TradeId;
                button.onClick.AddListener(() => OnRecordClicked(tradeId));
            }
        }

        #endregion

        #region Filtering & Search

        private List<TradeRecord> ApplyFilterAndSearch(List<TradeRecord> records)
        {
            IEnumerable<TradeRecord> result = records;

            // Apply filter
            result = _currentFilter switch
            {
                TradeHistoryFilter.FairOnly => result.Where(r => r.WasFair),
                TradeHistoryFilter.UnfairOnly => result.Where(r => !r.WasFair),
                TradeHistoryFilter.PremiumItems => result.Where(r =>
                    r.Gave.Any(s => s.IsPremium) || r.Received.Any(s => s.IsPremium)),
                TradeHistoryFilter.CurrencyOnly => result.Where(r =>
                    r.Gave.All(s => s.Data == null) && r.Received.All(s => s.Data == null)),
                _ => result
            };

            // Apply search
            string search = _searchInput?.text?.ToLowerInvariant() ?? "";
            if (!string.IsNullOrEmpty(search))
            {
                result = result.Where(r =>
                    r.PartnerName.ToLowerInvariant().Contains(search) ||
                    r.Gave.Any(s => s.Data != null && s.Data.DisplayName.ToLowerInvariant().Contains(search)) ||
                    r.Received.Any(s => s.Data != null && s.Data.DisplayName.ToLowerInvariant().Contains(search)));
            }

            return result.ToList();
        }

        private void OnFilterChanged(int index)
        {
            _currentFilter = (TradeHistoryFilter)index;
            RefreshHistory();
        }

        private void OnSearchChanged(string value)
        {
            RefreshHistory();
        }

        #endregion

        #region Record Detail

        /// <summary>
        /// Opens the detail view for a specific trade record.
        /// </summary>
        /// <param name="tradeId">The unique identifier of the trade to inspect.</param>
        public void OnRecordClicked(string tradeId)
        {
            _selectedTradeId = tradeId;
            var record = TradingManager.Instance?.GetTradeRecord(tradeId);
            if (record == null) return;

            ShowDetailPanel(record);
        }

        private void ShowDetailPanel(TradeRecord record)
        {
            if (_detailPanel != null)
                _detailPanel.SetActive(true);

            if (_detailPartnerText != null)
                _detailPartnerText.text = $"Traded with: {record.PartnerName}";

            if (_detailDateText != null)
                _detailDateText.text = FormatTimestamp(record.Timestamp);

            if (_detailFairnessText != null)
            {
                var rating = record.WasFair ? FairnessRating.Fair : FairnessRating.Unfair;
                _detailFairnessText.text = $"Fairness: {TradeValueCalculator.Instance?.GetFairnessText(rating) ?? "Unknown"}";
                _detailFairnessText.color = TradeValueCalculator.Instance?.GetFairnessColor(rating) ?? Color.white;
            }

            PopulateDetailGrids(record);
        }

        private void HideDetailPanel()
        {
            if (_detailPanel != null)
                _detailPanel.SetActive(false);
            _selectedTradeId = null;
            ClearDetailObjects();
        }

        private void PopulateDetailGrids(TradeRecord record)
        {
            ClearDetailObjects();

            // Populate "Gave" grid
            if (_detailGaveGrid != null)
            {
                foreach (var slot in record.Gave)
                {
                    var go = CreateDetailSlot(slot, _detailGaveGrid);
                    _detailGaveObjects.Add(go);
                }
            }

            // Populate "Received" grid
            if (_detailReceivedGrid != null)
            {
                foreach (var slot in record.Received)
                {
                    var go = CreateDetailSlot(slot, _detailReceivedGrid);
                    _detailReceivedObjects.Add(go);
                }
            }
        }

        private GameObject CreateDetailSlot(TradeSlot slot, Transform parent)
        {
            var go = new GameObject($"DetailSlot_{slot.ItemId}", typeof(RectTransform));
            go.transform.SetParent(parent, false);

            var layout = go.AddComponent<HorizontalLayoutGroup>();
            layout.childControlWidth = false;
            layout.childControlHeight = false;

            // Icon
            var iconGO = new GameObject("Icon", typeof(RectTransform));
            iconGO.transform.SetParent(go.transform, false);
            var iconImage = iconGO.AddComponent<Image>();
            iconImage.sprite = slot.Data?.Icon;
            iconImage.rectTransform.sizeDelta = new Vector2(32, 32);

            // Name label
            var textGO = new GameObject("Name", typeof(RectTransform));
            textGO.transform.SetParent(go.transform, false);
            var text = textGO.AddComponent<TMP_Text>();
            string name = slot.Data != null ? slot.Data.DisplayName : slot.ItemId;
            text.text = slot.Quantity > 1 ? $"{name} x{slot.Quantity}" : name;
            text.fontSize = 14;

            // Rarity border color
            if (slot.Data != null)
            {
                var borderGO = new GameObject("Border", typeof(RectTransform));
                borderGO.transform.SetParent(iconGO.transform, false);
                borderGO.transform.SetAsFirstSibling();
                var border = borderGO.AddComponent<Image>();
                border.color = GetRarityColor(slot.Data.Rarity);
                border.rectTransform.anchorMin = Vector2.zero;
                border.rectTransform.anchorMax = Vector2.one;
                border.rectTransform.sizeDelta = Vector2.zero;
            }

            return go;
        }

        #endregion

        #region Actions

        private void OnClearHistoryClicked()
        {
            // Confirm dialog via UIManager
            UIManager.Instance?.ShowConfirmationDialog(
                "Clear History",
                "Are you sure you want to clear all local trade history? This cannot be undone.",
                OnConfirmClearHistory,
                null);
        }

        private void OnConfirmClearHistory()
        {
            TradingManager.Instance?.ClearTradeHistory();
            RefreshHistory();
            HideDetailPanel();
        }

        #endregion

        #region Utility

        private string FormatTimestamp(long unixTimestamp)
        {
            var dateTime = DateTimeOffset.FromUnixTimeSeconds(unixTimestamp).LocalDateTime;
            return dateTime.ToString("MMM dd, yyyy HH:mm");
        }

        private Color GetRarityColor(ItemRarity rarity)
        {
            return rarity switch
            {
                ItemRarity.Common => Color.gray,
                ItemRarity.Uncommon => Color.green,
                ItemRarity.Rare => Color.blue,
                ItemRarity.Epic => Color.magenta,
                ItemRarity.Legendary => new Color(1f, 0.84f, 0f),
                _ => Color.white
            };
        }

        private void ClearRecordObjects()
        {
            foreach (var go in _recordObjects)
            {
                if (go != null) Destroy(go);
            }
            _recordObjects.Clear();
        }

        private void ClearDetailObjects()
        {
            foreach (var go in _detailGaveObjects)
            {
                if (go != null) Destroy(go);
            }
            _detailGaveObjects.Clear();

            foreach (var go in _detailReceivedObjects)
            {
                if (go != null) Destroy(go);
            }
            _detailReceivedObjects.Clear();
        }

        #endregion
    }

    /// <summary>
    /// UI component for rendering a single trade record entry in the history list.
    /// Expected to be attached to the TradeRecordPrefab GameObject.
    /// </summary>
    public class TradeRecordUI : MonoBehaviour
    {
        [SerializeField] private TMP_Text _partnerNameText;
        [SerializeField] private TMP_Text _dateText;
        [SerializeField] private TMP_Text _valueText;
        [SerializeField] private Image _fairnessIndicator;
        [SerializeField] private Button _clickButton;
        [SerializeField] private GameObject _premiumBadge;

        public void Setup(TradeRecord record, Action onClick)
        {
            if (_partnerNameText != null)
                _partnerNameText.text = record.PartnerName;

            if (_dateText != null)
            {
                var dateTime = DateTimeOffset.FromUnixTimeSeconds(record.Timestamp).LocalDateTime;
                _dateText.text = dateTime.ToString("MMM dd, HH:mm");
            }

            if (_valueText != null)
            {
                int gaveValue = CalculateSlotListValue(record.Gave);
                int receivedValue = CalculateSlotListValue(record.Received);
                _valueText.text = $"Gave: {gaveValue} / Got: {receivedValue}";
            }

            if (_fairnessIndicator != null)
            {
                var rating = record.WasFair ? FairnessRating.Fair : FairnessRating.Unfair;
                _fairnessIndicator.color = TradeValueCalculator.Instance?.GetFairnessColor(rating) ?? Color.white;
            }

            if (_premiumBadge != null)
            {
                bool hasPremium = record.Gave.Any(s => s.IsPremium) || record.Received.Any(s => s.IsPremium);
                _premiumBadge.SetActive(hasPremium);
            }

            if (_clickButton != null)
            {
                _clickButton.onClick.RemoveAllListeners();
                _clickButton.onClick.AddListener(() => onClick?.Invoke());
            }
        }

        private int CalculateSlotListValue(List<TradeSlot> slots)
        {
            int total = 0;
            if (TradeValueCalculator.Instance != null)
            {
                total = TradeValueCalculator.Instance.CalculateTradeValue(slots, null);
            }
            else
            {
                foreach (var slot in slots)
                {
                    if (slot.Data != null)
                        total += slot.Data.Price * slot.Quantity;
                }
            }
            return total;
        }
    }

    /// <summary>
    /// Filtering options for the trade history list.
    /// </summary>
    public enum TradeHistoryFilter
    {
        All,
        FairOnly,
        UnfairOnly,
        PremiumItems,
        CurrencyOnly
    }
}
