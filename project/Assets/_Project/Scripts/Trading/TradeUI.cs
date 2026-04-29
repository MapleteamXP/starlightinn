using System;
using System.Collections.Generic;
using System.Linq;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace KawaiiCoolIsland.Trading
{
    /// <summary>
    /// Complete trade window UI panel that renders the active trade session,
    /// handles inventory browsing, currency input, fairness display, and all
    /// player actions (lock, unlock, confirm, cancel).
    /// </summary>
    public class TradeUI : UIPanel
    {
        #region Header - Players

        [Header("Players")]
        [SerializeField] private TMP_Text _myNameText;
        [SerializeField] private TMP_Text _partnerNameText;
        [SerializeField] private Image _myAvatar;
        [SerializeField] private Image _partnerAvatar;

        #endregion

        #region Header - My Offer

        [Header("My Offer")]
        [SerializeField] private Transform _myOfferGrid;
        [SerializeField] private GameObject _tradeSlotPrefab;
        [SerializeField] private TMP_Text _myValueText;
        [SerializeField] private Button _addItemButton;
        [SerializeField] private Button _addCurrencyButton;

        #endregion

        #region Header - Partner Offer

        [Header("Partner Offer")]
        [SerializeField] private Transform _partnerOfferGrid;
        [SerializeField] private TMP_Text _partnerValueText;
        [SerializeField] private Image _partnerLockIndicator;

        #endregion

        #region Header - Status

        [Header("Status")]
        [SerializeField] private TMP_Text _statusText;
        [SerializeField] private Slider _tradeTimerSlider;
        [SerializeField] private Image _fairnessIndicator;
        [SerializeField] private TMP_Text _fairnessText;

        #endregion

        #region Header - Actions

        [Header("Actions")]
        [SerializeField] private Button _lockButton;
        [SerializeField] private Button _unlockButton;
        [SerializeField] private Button _confirmButton;
        [SerializeField] private Button _cancelButton;

        #endregion

        #region Header - Inventory Browser

        [Header("Inventory Browser")]
        [SerializeField] private GameObject _inventoryBrowserPanel;
        [SerializeField] private Transform _inventoryGrid;
        [SerializeField] private Button _closeBrowserButton;

        #endregion

        #region Header - Currency Dialog

        [Header("Currency Dialog")]
        [SerializeField] private GameObject _currencyDialog;
        [SerializeField] private Slider _currencySlider;
        [SerializeField] private TMP_Text _currencyAmountText;
        [SerializeField] private TMP_Text _currencyTypeText;
        [SerializeField] private Button _currencyConfirmButton;
        [SerializeField] private Button _currencyCancelButton;

        #endregion

        #region Fields

        private List<GameObject> _myOfferSlotObjects = new List<GameObject>();
        private List<GameObject> _partnerOfferSlotObjects = new List<GameObject>();
        private List<GameObject> _inventorySlotObjects = new List<GameObject>();
        private string _pendingCurrencyType;
        private bool _isShowingInventoryBrowser;
        private bool _isShowingCurrencyDialog;
        private float _lockReadyTime;
        private bool _isCountingDown;

        #endregion

        #region Events

        /// <summary>
        /// Fired when the trade window is closed for any reason.
        /// </summary>
        public event Action OnTradeWindowClosed;

        #endregion

        #region UIPanel Overrides

        /// <summary>
        /// Called when the trade panel is shown. Subscribes to trade manager events
        /// and initializes the UI state for the active trade session.
        /// </summary>
        public override void OnPanelShow()
        {
            base.OnPanelShow();
            SubscribeToEvents();
            InitializeUI();
            RefreshTradeUI();
        }

        /// <summary>
        /// Called when the trade panel is hidden. Unsubscribes from events and cleans up.
        /// </summary>
        public override void OnPanelHide()
        {
            base.OnPanelHide();
            UnsubscribeFromEvents();
            HideInventoryBrowser();
            HideCurrencyDialog();
            OnTradeWindowClosed?.Invoke();
        }

        #endregion

        #region Initialization

        private void Awake()
        {
            BindButtonListeners();
            SetupPrefabs();
        }

        private void BindButtonListeners()
        {
            if (_addItemButton != null)
                _addItemButton.onClick.AddListener(OnAddItemClicked);
            if (_addCurrencyButton != null)
                _addCurrencyButton.onClick.AddListener(OnAddCurrencyClicked);
            if (_lockButton != null)
                _lockButton.onClick.AddListener(OnLockClicked);
            if (_unlockButton != null)
                _unlockButton.onClick.AddListener(OnUnlockClicked);
            if (_confirmButton != null)
                _confirmButton.onClick.AddListener(OnConfirmClicked);
            if (_cancelButton != null)
                _cancelButton.onClick.AddListener(OnCancelClicked);
            if (_closeBrowserButton != null)
                _closeBrowserButton.onClick.AddListener(HideInventoryBrowser);
            if (_currencyConfirmButton != null)
                _currencyConfirmButton.onClick.AddListener(OnCurrencyConfirmClicked);
            if (_currencyCancelButton != null)
                _currencyCancelButton.onClick.AddListener(HideCurrencyDialog);
        }

        private void SetupPrefabs()
        {
            if (_tradeSlotPrefab == null)
            {
                Debug.LogWarning("[TradeUI] TradeSlotPrefab is not assigned.");
            }
        }

        private void InitializeUI()
        {
            HideInventoryBrowser();
            HideCurrencyDialog();

            var session = TradingManager.Instance?.CurrentTrade;
            if (session == null) return;

            bool isInitiator = session.InitiatorId == GameAPIClient.Instance?.PlayerId;

            if (_myNameText != null)
                _myNameText.text = isInitiator ? session.InitiatorName : "You";
            if (_partnerNameText != null)
                _partnerNameText.text = isInitiator ? session.TargetName : session.InitiatorName;

            // Load avatars via GameAPIClient
            LoadAvatarAsync(isInitiator ? session.InitiatorId : session.TargetId, _myAvatar);
            LoadAvatarAsync(isInitiator ? session.TargetId : session.InitiatorId, _partnerAvatar);

            UpdateStatusText("Trade Active - Arrange your offer");
            UpdateActionButtons(false);
            _partnerLockIndicator.gameObject.SetActive(false);
        }

        private async void LoadAvatarAsync(string playerId, Image targetImage)
        {
            if (targetImage == null || GameAPIClient.Instance == null) return;
            try
            {
                var sprite = await GameAPIClient.Instance.GetPlayerAvatarAsync(playerId);
                if (targetImage != null && sprite != null)
                    targetImage.sprite = sprite;
            }
            catch
            {
                // Keep default avatar
            }
        }

        #endregion

        #region Event Subscriptions

        private void SubscribeToEvents()
        {
            var tm = TradingManager.Instance;
            if (tm == null) return;

            tm.OnTradeOfferChanged += OnTradeOfferChanged;
            tm.OnTradeLocked += OnTradeLocked;
            tm.OnTradeUnlocked += OnTradeUnlocked;
            tm.OnTradeCompleted += OnTradeCompleted;
            tm.OnTradeCancelled += OnTradeCancelled;
            tm.OnTradeError += OnTradeError;
            tm.OnTradeTimedOut += OnTradeTimedOut;
        }

        private void UnsubscribeFromEvents()
        {
            var tm = TradingManager.Instance;
            if (tm == null) return;

            tm.OnTradeOfferChanged -= OnTradeOfferChanged;
            tm.OnTradeLocked -= OnTradeLocked;
            tm.OnTradeUnlocked -= OnTradeUnlocked;
            tm.OnTradeCompleted -= OnTradeCompleted;
            tm.OnTradeCancelled -= OnTradeCancelled;
            tm.OnTradeError -= OnTradeError;
            tm.OnTradeTimedOut -= OnTradeTimedOut;
        }

        #endregion

        #region UI Refresh

        /// <summary>
        /// Fully refreshes the trade UI to match the current trade session state.
        /// Call this after any trade state change.
        /// </summary>
        public void RefreshTradeUI()
        {
            var session = TradingManager.Instance?.CurrentTrade;
            if (session == null) return;

            PopulateMyOffer();
            PopulatePartnerOffer();
            UpdateValueDisplay();
            UpdateFairnessDisplay();
            UpdateTimerDisplay();
            UpdateActionState();
            UpdatePartnerLockState();
            UpdateStatusFromSession(session);
        }

        private void PopulateMyOffer()
        {
            ClearMyOfferSlots();

            var session = TradingManager.Instance?.CurrentTrade;
            if (session == null) return;

            bool isInitiator = session.InitiatorId == GameAPIClient.Instance?.PlayerId;
            var offer = isInitiator ? session.InitiatorOffer : session.TargetOffer;

            foreach (var slot in offer)
            {
                if (_tradeSlotPrefab == null || _myOfferGrid == null) continue;

                var go = Instantiate(_tradeSlotPrefab, _myOfferGrid);
                var uiSlot = go.GetComponent<TradeSlotUI>();
                if (uiSlot != null)
                {
                    uiSlot.Setup(slot, OnMySlotClicked);
                }
                else
                {
                    // Fallback if TradeSlotUI component missing
                    var icon = go.GetComponent<Image>();
                    if (icon != null && slot.Data != null && slot.Data.Icon != null)
                        icon.sprite = slot.Data.Icon;
                    var qty = go.GetComponentInChildren<TMP_Text>();
                    if (qty != null)
                        qty.text = slot.Quantity > 1 ? $"x{slot.Quantity}" : "";
                }
                _myOfferSlotObjects.Add(go);
            }

            // Fill empty slots
            int maxSlots = TradingManager.Instance?.MaxTradeSlots ?? 8;
            for (int i = offer.Count; i < maxSlots; i++)
            {
                if (_tradeSlotPrefab == null || _myOfferGrid == null) break;
                var go = Instantiate(_tradeSlotPrefab, _myOfferGrid);
                var emptySlot = go.GetComponent<TradeSlotUI>();
                if (emptySlot != null)
                    emptySlot.ShowEmpty();
                else
                {
                    var canvasGroup = go.GetComponent<CanvasGroup>();
                    if (canvasGroup != null) canvasGroup.alpha = 0.3f;
                }
                _myOfferSlotObjects.Add(go);
            }
        }

        private void PopulatePartnerOffer()
        {
            ClearPartnerOfferSlots();

            var session = TradingManager.Instance?.CurrentTrade;
            if (session == null) return;

            bool isInitiator = session.InitiatorId == GameAPIClient.Instance?.PlayerId;
            var offer = isInitiator ? session.TargetOffer : session.InitiatorOffer;

            foreach (var slot in offer)
            {
                if (_tradeSlotPrefab == null || _partnerOfferGrid == null) continue;

                var go = Instantiate(_tradeSlotPrefab, _partnerOfferGrid);
                var uiSlot = go.GetComponent<TradeSlotUI>();
                if (uiSlot != null)
                {
                    uiSlot.SetupReadOnly(slot);
                }
                else
                {
                    var icon = go.GetComponent<Image>();
                    if (icon != null && slot.Data != null && slot.Data.Icon != null)
                        icon.sprite = slot.Data.Icon;
                    var qty = go.GetComponentInChildren<TMP_Text>();
                    if (qty != null)
                        qty.text = slot.Quantity > 1 ? $"x{slot.Quantity}" : "";
                }
                _partnerOfferSlotObjects.Add(go);
            }

            // Fill empty slots
            int maxSlots = TradingManager.Instance?.MaxTradeSlots ?? 8;
            for (int i = offer.Count; i < maxSlots; i++)
            {
                if (_tradeSlotPrefab == null || _partnerOfferGrid == null) break;
                var go = Instantiate(_tradeSlotPrefab, _partnerOfferGrid);
                var emptySlot = go.GetComponent<TradeSlotUI>();
                if (emptySlot != null)
                    emptySlot.ShowEmpty();
                else
                {
                    var canvasGroup = go.GetComponent<CanvasGroup>();
                    if (canvasGroup != null) canvasGroup.alpha = 0.3f;
                }
                _partnerOfferSlotObjects.Add(go);
            }
        }

        private void UpdateValueDisplay()
        {
            var session = TradingManager.Instance?.CurrentTrade;
            if (session == null) return;

            bool isInitiator = session.InitiatorId == GameAPIClient.Instance?.PlayerId;
            int myValue = isInitiator ? session.InitiatorValue : session.TargetValue;
            int partnerValue = isInitiator ? session.TargetValue : session.InitiatorValue;

            if (_myValueText != null)
                _myValueText.text = $"Value: {myValue:N0}";
            if (_partnerValueText != null)
                _partnerValueText.text = $"Value: {partnerValue:N0}";
        }

        private void UpdateTimerDisplay()
        {
            var session = TradingManager.Instance?.CurrentTrade;
            if (session == null || _tradeTimerSlider == null) return;

            float elapsed = Time.time - session.StartTime;
            float remaining = Mathf.Max(0, session.TimeoutDuration - elapsed);
            float progress = session.TimeoutDuration > 0 ? remaining / session.TimeoutDuration : 0;

            _tradeTimerSlider.value = progress;

            // Turn red when low
            var fill = _tradeTimerSlider.fillRect?.GetComponent<Image>();
            if (fill != null)
                fill.color = progress < 0.2f ? Color.red : Color.green;
        }

        private void UpdatePartnerLockState()
        {
            var session = TradingManager.Instance?.CurrentTrade;
            if (session == null || _partnerLockIndicator == null) return;

            bool isInitiator = session.InitiatorId == GameAPIClient.Instance?.PlayerId;
            bool partnerLocked = isInitiator ? session.TargetLocked : session.InitiatorLocked;

            _partnerLockIndicator.gameObject.SetActive(partnerLocked);
            _partnerLockIndicator.color = partnerLocked ? Color.green : Color.gray;
        }

        private void UpdateActionState()
        {
            var session = TradingManager.Instance?.CurrentTrade;
            if (session == null) return;

            bool isInitiator = session.InitiatorId == GameAPIClient.Instance?.PlayerId;
            bool localLocked = isInitiator ? session.InitiatorLocked : session.TargetLocked;
            bool bothLocked = session.IsLocked;

            // Show/hide lock/unlock
            if (_lockButton != null)
                _lockButton.gameObject.SetActive(!localLocked);
            if (_unlockButton != null)
                _unlockButton.gameObject.SetActive(localLocked);

            // Confirm button only visible when both locked
            if (_confirmButton != null)
            {
                _confirmButton.gameObject.SetActive(bothLocked);
                _confirmButton.interactable = CanConfirmNow();
            }

            // Disable add buttons when locked
            bool canEdit = !localLocked;
            if (_addItemButton != null)
                _addItemButton.interactable = canEdit;
            if (_addCurrencyButton != null)
                _addCurrencyButton.interactable = canEdit;
        }

        private void UpdateStatusFromSession(TradeSession session)
        {
            if (_statusText == null) return;

            bool isInitiator = session.InitiatorId == GameAPIClient.Instance?.PlayerId;
            bool localLocked = isInitiator ? session.InitiatorLocked : session.TargetLocked;
            bool partnerLocked = isInitiator ? session.TargetLocked : session.InitiatorLocked;

            if (!localLocked && !partnerLocked)
                UpdateStatusText("Arrange your offer");
            else if (localLocked && !partnerLocked)
                UpdateStatusText("Locked - Waiting for partner...");
            else if (!localLocked && partnerLocked)
                UpdateStatusText("Partner locked! Lock when ready.");
            else
                UpdateStatusText("Both locked! Review and confirm.");
        }

        private void UpdateStatusText(string message)
        {
            if (_statusText != null)
                _statusText.text = message;
        }

        private void UpdateActionButtons(bool locked)
        {
            if (_lockButton != null)
                _lockButton.gameObject.SetActive(!locked);
            if (_unlockButton != null)
                _unlockButton.gameObject.SetActive(locked);
        }

        private bool CanConfirmNow()
        {
            float delay = TradingManager.Instance?.TradeConfirmationDelay ?? 3f;
            return Time.time >= _lockReadyTime + delay;
        }

        #endregion

        #region Fairness Display

        /// <summary>
        /// Updates the fairness indicator based on the value comparison between both trade sides.
        /// </summary>
        public void UpdateFairnessDisplay()
        {
            var session = TradingManager.Instance?.CurrentTrade;
            if (session == null) return;

            var calculator = TradeValueCalculator.Instance;
            if (calculator == null) return;

            bool isInitiator = session.InitiatorId == GameAPIClient.Instance?.PlayerId;
            int myValue = isInitiator ? session.InitiatorValue : session.TargetValue;
            int partnerValue = isInitiator ? session.TargetValue : session.InitiatorValue;

            FairnessRating rating = calculator.RateFairness(myValue, partnerValue);
            Color color = calculator.GetFairnessColor(rating);
            string text = calculator.GetFairnessText(rating);

            if (_fairnessIndicator != null)
                _fairnessIndicator.color = color;
            if (_fairnessText != null)
                _fairnessText.text = text;
        }

        #endregion

        #region Inventory Browser

        /// <summary>
        /// Opens the inventory browser overlay so the player can select items to add.
        /// </summary>
        public void ShowInventoryBrowser()
        {
            if (_inventoryBrowserPanel != null)
                _inventoryBrowserPanel.SetActive(true);
            _isShowingInventoryBrowser = true;
            PopulateInventoryBrowser();
        }

        /// <summary>
        /// Closes the inventory browser overlay.
        /// </summary>
        public void HideInventoryBrowser()
        {
            if (_inventoryBrowserPanel != null)
                _inventoryBrowserPanel.SetActive(false);
            _isShowingInventoryBrowser = false;
        }

        private void PopulateInventoryBrowser()
        {
            ClearInventorySlots();

            var inventory = InventoryManager.Instance;
            if (inventory == null || _inventoryGrid == null) return;

            var tradeableItems = inventory.GetAllItems()
                .Where(item => item.Data != null && item.Data.IsTradeable && !item.IsBound && !item.IsEquipped)
                .ToList();

            foreach (var item in tradeableItems)
            {
                if (_tradeSlotPrefab == null) continue;
                var go = Instantiate(_tradeSlotPrefab, _inventoryGrid);
                var uiSlot = go.GetComponent<TradeSlotUI>();
                if (uiSlot != null)
                {
                    var slot = new TradeSlot
                    {
                        ItemInstanceId = item.InstanceId,
                        ItemId = item.Data.ItemId,
                        Quantity = item.Quantity,
                        Data = item.Data,
                        IsPremium = item.Data.IsPremium
                    };
                    uiSlot.Setup(slot, () => OnInventoryItemClicked(item));
                }
                _inventorySlotObjects.Add(go);
            }
        }

        private void OnInventoryItemClicked(InventoryItem item)
        {
            if (item == null) return;
            TradingManager.Instance?.AddItemToTrade(item.InstanceId, 1);
            HideInventoryBrowser();
        }

        #endregion

        #region Currency Dialog

        /// <summary>
        /// Opens the currency amount dialog for the specified currency type.
        /// </summary>
        /// <param name="currencyType">The currency type to add (e.g., "Coins", "Gems").</param>
        public void ShowCurrencyDialog(string currencyType)
        {
            _pendingCurrencyType = currencyType;
            if (_currencyDialog != null)
                _currencyDialog.SetActive(true);
            if (_currencyTypeText != null)
                _currencyTypeText.text = currencyType;
            _isShowingCurrencyDialog = true;

            // Setup slider bounds
            int maxAmount = InventoryManager.Instance?.GetCurrencyAmount(currencyType) ?? 0;
            if (_currencySlider != null)
            {
                _currencySlider.minValue = 0;
                _currencySlider.maxValue = maxAmount;
                _currencySlider.value = 0;
                _currencySlider.onValueChanged.RemoveAllListeners();
                _currencySlider.onValueChanged.AddListener(OnCurrencySliderChanged);
            }
            OnCurrencySliderChanged(0);
        }

        /// <summary>
        /// Closes the currency amount dialog without applying.
        /// </summary>
        public void HideCurrencyDialog()
        {
            if (_currencyDialog != null)
                _currencyDialog.SetActive(false);
            _isShowingCurrencyDialog = false;
            _pendingCurrencyType = null;
        }

        private void OnCurrencySliderChanged(float value)
        {
            int amount = Mathf.RoundToInt(value);
            if (_currencyAmountText != null)
                _currencyAmountText.text = amount.ToString("N0");
        }

        private void OnCurrencyConfirmClicked()
        {
            if (string.IsNullOrEmpty(_pendingCurrencyType) || _currencySlider == null) return;
            int amount = Mathf.RoundToInt(_currencySlider.value);
            if (amount > 0)
            {
                TradingManager.Instance?.AddCurrencyToTrade(_pendingCurrencyType, amount);
            }
            HideCurrencyDialog();
        }

        #endregion

        #region Button Handlers

        private void OnAddItemClicked()
        {
            ShowInventoryBrowser();
        }

        private void OnAddCurrencyClicked()
        {
            // Default to Coins; could be expanded to show a picker
            ShowCurrencyDialog("Coins");
        }

        private void OnMySlotClicked(TradeSlot slot)
        {
            if (slot == null) return;
            TradingManager.Instance?.RemoveItemFromTrade(slot.ItemInstanceId);
        }

        private void OnLockClicked()
        {
            TradingManager.Instance?.LockTrade();
            _lockReadyTime = Time.time;
        }

        private void OnUnlockClicked()
        {
            TradingManager.Instance?.UnlockTrade();
        }

        private void OnConfirmClicked()
        {
            TradingManager.Instance?.ConfirmTrade();
        }

        private void OnCancelClicked()
        {
            TradingManager.Instance?.CancelTrade();
            UIManager.Instance?.HidePanel(this);
        }

        #endregion

        #region Event Handlers

        private void OnTradeOfferChanged()
        {
            RefreshTradeUI();
        }

        private void OnTradeLocked()
        {
            RefreshTradeUI();
            _lockReadyTime = Time.time;
        }

        private void OnTradeUnlocked()
        {
            RefreshTradeUI();
        }

        private void OnTradeCompleted()
        {
            ShowTradeCompleteAnimation();
            UIManager.Instance?.HidePanel(this);
        }

        private void OnTradeCancelled()
        {
            ShowTradeCancelledAnimation();
            UIManager.Instance?.HidePanel(this);
        }

        private void OnTradeError(string errorMessage)
        {
            UpdateStatusText($"Error: {errorMessage}");
            if (_statusText != null)
                _statusText.color = Color.red;
        }

        private void OnTradeTimedOut()
        {
            UpdateStatusText("Trade timed out.");
            UIManager.Instance?.HidePanel(this);
        }

        #endregion

        #region Animations

        /// <summary>
        /// Triggers the visual celebration animation for a successfully completed trade.
        /// </summary>
        public void ShowTradeCompleteAnimation()
        {
            // Trigger a celebratory particle burst or tween via UIManager/Animator
            Debug.Log("[TradeUI] Trade complete animation shown.");
            EventBus.Publish(new TradeUIShowAnimationEvent("TradeComplete"));
        }

        /// <summary>
        /// Triggers the visual cancellation animation.
        /// </summary>
        public void ShowTradeCancelledAnimation()
        {
            Debug.Log("[TradeUI] Trade cancelled animation shown.");
            EventBus.Publish(new TradeUIShowAnimationEvent("TradeCancelled"));
        }

        #endregion

        #region Cleanup Helpers

        private void ClearMyOfferSlots()
        {
            foreach (var go in _myOfferSlotObjects)
            {
                if (go != null) Destroy(go);
            }
            _myOfferSlotObjects.Clear();
        }

        private void ClearPartnerOfferSlots()
        {
            foreach (var go in _partnerOfferSlotObjects)
            {
                if (go != null) Destroy(go);
            }
            _partnerOfferSlotObjects.Clear();
        }

        private void ClearInventorySlots()
        {
            foreach (var go in _inventorySlotObjects)
            {
                if (go != null) Destroy(go);
            }
            _inventorySlotObjects.Clear();
        }

        #endregion

        #region Update Loop

        private void LateUpdate()
        {
            if (!IsVisible) return;

            // Continuously update timer
            UpdateTimerDisplay();

            // Update confirm button availability during anti-scam delay
            var session = TradingManager.Instance?.CurrentTrade;
            if (session != null && session.IsLocked && _confirmButton != null && _confirmButton.gameObject.activeSelf)
            {
                _confirmButton.interactable = CanConfirmNow();
                if (!_confirmButton.interactable && _statusText != null)
                {
                    float remaining = (_lockReadyTime + (TradingManager.Instance?.TradeConfirmationDelay ?? 3f)) - Time.time;
                    if (remaining > 0)
                        UpdateStatusText($"Reviewing... Confirm in {remaining:F0}s");
                }
            }
        }

        #endregion
    }

    /// <summary>
    /// UI helper for rendering a single trade slot inside the trade window.
    /// Expected to be attached to the TradeSlotPrefab GameObject.
    /// </summary>
    public class TradeSlotUI : MonoBehaviour
    {
        [SerializeField] private Image _iconImage;
        [SerializeField] private TMP_Text _quantityText;
        [SerializeField] private Image _rarityBorder;
        [SerializeField] private GameObject _premiumBadge;
        [SerializeField] private Button _clickButton;
        [SerializeField] private CanvasGroup _canvasGroup;

        private TradeSlot _slot;
        private System.Action<TradeSlot> _onClickCallback;
        private System.Action _onClickSimple;

        public void Setup(TradeSlot slot, System.Action<TradeSlot> onClick)
        {
            _slot = slot;
            _onClickCallback = onClick;
            RefreshVisuals();
            if (_clickButton != null)
                _clickButton.onClick.AddListener(() => _onClickCallback?.Invoke(_slot));
        }

        public void Setup(TradeSlot slot, System.Action onClick)
        {
            _slot = slot;
            _onClickSimple = onClick;
            RefreshVisuals();
            if (_clickButton != null)
                _clickButton.onClick.AddListener(() => _onClickSimple?.Invoke());
        }

        public void SetupReadOnly(TradeSlot slot)
        {
            _slot = slot;
            RefreshVisuals();
            if (_clickButton != null)
                _clickButton.interactable = false;
        }

        public void ShowEmpty()
        {
            if (_iconImage != null)
                _iconImage.sprite = null;
            if (_quantityText != null)
                _quantityText.text = "";
            if (_rarityBorder != null)
                _rarityBorder.color = Color.gray;
            if (_premiumBadge != null)
                _premiumBadge.SetActive(false);
            if (_canvasGroup != null)
                _canvasGroup.alpha = 0.3f;
            if (_clickButton != null)
                _clickButton.interactable = false;
        }

        private void RefreshVisuals()
        {
            if (_slot == null) return;

            if (_iconImage != null && _slot.Data != null)
                _iconImage.sprite = _slot.Data.Icon;

            if (_quantityText != null)
                _quantityText.text = _slot.Quantity > 1 ? $"x{_slot.Quantity}" : "";

            if (_rarityBorder != null && _slot.Data != null)
                _rarityBorder.color = GetRarityColor(_slot.Data.Rarity);

            if (_premiumBadge != null)
                _premiumBadge.SetActive(_slot.IsPremium);

            if (_canvasGroup != null)
                _canvasGroup.alpha = 1f;
        }

        private Color GetRarityColor(ItemRarity rarity)
        {
            return rarity switch
            {
                ItemRarity.Common => Color.gray,
                ItemRarity.Uncommon => Color.green,
                ItemRarity.Rare => Color.blue,
                ItemRarity.Epic => Color.magenta,
                ItemRarity.Legendary => new Color(1f, 0.84f, 0f), // Gold
                _ => Color.white
            };
        }
    }

    /// <summary>
    /// Event for triggering trade UI animations through the EventBus.
    /// </summary>
    public class TradeUIShowAnimationEvent
    {
        public readonly string AnimationName;
        public TradeUIShowAnimationEvent(string animationName) => AnimationName = animationName;
    }

    /// <summary>
    /// Placeholder for InventoryItem reference from the existing InventoryManager.
    /// </summary>
    public class InventoryItem
    {
        public string InstanceId;
        public ItemData Data;
        public int Quantity;
        public bool IsBound;
        public bool IsEquipped;
    }

    /// <summary>
    /// Placeholder for ItemRarity enum from existing ItemData.
    /// </summary>
    public enum ItemRarity { Common, Uncommon, Rare, Epic, Legendary }
}
