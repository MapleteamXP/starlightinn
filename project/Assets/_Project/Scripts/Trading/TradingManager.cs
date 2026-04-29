using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using UnityEngine;

namespace KawaiiCoolIsland.Trading
{
    /// <summary>
    /// Central trading manager singleton that handles the complete player-to-player trade lifecycle,
    /// validation, anti-scam safeguards, and trade history persistence.
    /// </summary>
    public class TradingManager : Singleton<TradingManager>
    {
        #region Fields

        [Header("Trade Session")]
        [SerializeField] private TradeSession _currentTrade;
        [SerializeField] private List<TradeRecord> _tradeHistory = new List<TradeRecord>();
        [SerializeField] private int _dailyTradeCount;
        [SerializeField] private long _lastDailyResetTimestamp;

        [Header("Settings")]
        [SerializeField] private int _maxTradeSlots = 8;
        [SerializeField] private int _minLevelForTrading = 3;
        [SerializeField] private bool _friendsOnlyTrading = false;
        [SerializeField] private float _tradeConfirmationDelay = 3f;
        [SerializeField] private int _maxDailyTrades = 50;
        [SerializeField] private float _tradeTimeoutDuration = 120f;
        [SerializeField] private float _unfairTradeThreshold = 0.5f;

        private readonly Dictionary<string, TradeRequest> _pendingRequests = new Dictionary<string, TradeRequest>();
        private readonly Dictionary<string, float> _lockTimestamps = new Dictionary<string, float>();
        private bool _isExecutingTrade;
        private float _tradeStartTime;
        private string _localPlayerId;

        #endregion

        #region Properties

        /// <summary>
        /// Gets the currently active trade session, or null if no trade is in progress.
        /// </summary>
        public TradeSession CurrentTrade => _currentTrade;

        /// <summary>
        /// Returns true if the local player is currently in an active trade session.
        /// </summary>
        public bool IsInTrade => _currentTrade != null && _currentTrade.Status == TradeStatus.Active;

        /// <summary>
        /// Returns true if both parties have locked their offers and the trade is awaiting final confirmation.
        /// </summary>
        public bool IsTradeLocked => _currentTrade?.IsLocked ?? false;

        /// <summary>
        /// Maximum number of item slots available per side in a trade.
        /// </summary>
        public int MaxTradeSlots => _maxTradeSlots;

        /// <summary>
        /// Minimum player level required to participate in trading.
        /// </summary>
        public int MinLevelForTrading => _minLevelForTrading;

        /// <summary>
        /// When enabled, trades are restricted to friends only.
        /// </summary>
        public bool FriendsOnlyTrading => _friendsOnlyTrading;

        /// <summary>
        /// Delay in seconds required between locking and confirming a trade (anti-scam measure).
        /// </summary>
        public float TradeConfirmationDelay => _tradeConfirmationDelay;

        /// <summary>
        /// Maximum number of trades a player can complete per day.
        /// </summary>
        public int MaxDailyTrades => _maxDailyTrades;

        /// <summary>
        /// Current number of trades completed today.
        /// </summary>
        public int DailyTradeCount => _dailyTradeCount;

        /// <summary>
        /// Duration in seconds before an active trade automatically times out.
        /// </summary>
        public float TradeTimeoutDuration => _tradeTimeoutDuration;

        #endregion

        #region Events

        /// <summary>
        /// Fired when a new trade session is successfully initiated.
        /// </summary>
        public event Action<TradeSession> OnTradeInitiated;

        /// <summary>
        /// Fired when the other party accepts a trade request.
        /// </summary>
        public event Action OnTradeAccepted;

        /// <summary>
        /// Fired when a trade request is declined by the other party.
        /// </summary>
        public event Action OnTradeDeclined;

        /// <summary>
        /// Fired when an active trade is cancelled by either party.
        /// </summary>
        public event Action OnTradeCancelled;

        /// <summary>
        /// Fired when a trade completes successfully and items are exchanged.
        /// </summary>
        public event Action OnTradeCompleted;

        /// <summary>
        /// Fired when any trade error occurs, carrying the error message.
        /// </summary>
        public event Action<string> OnTradeError;

        /// <summary>
        /// Fired when the local player locks their side of the trade.
        /// </summary>
        public event Action OnTradeLocked;

        /// <summary>
        /// Fired when the local player unlocks their side of the trade.
        /// </summary>
        public event Action OnTradeUnlocked;

        /// <summary>
        /// Fired when either side adds or removes an item from their offer.
        /// </summary>
        public event Action OnTradeOfferChanged;

        /// <summary>
        /// Fired when a trade times out due to inactivity.
        /// </summary>
        public event Action OnTradeTimedOut;

        #endregion

        #region Unity Lifecycle

        protected override void Awake()
        {
            base.Awake();
            _localPlayerId = GameAPIClient.Instance?.PlayerId ?? string.Empty;
            LoadTradeHistory();
            ResetDailyCountIfNeeded();
        }

        private void Update()
        {
            if (_currentTrade == null) return;

            // Check for trade timeout
            if (_currentTrade.Status == TradeStatus.Active || _currentTrade.Status == TradeStatus.Locked)
            {
                float elapsed = Time.time - _tradeStartTime;
                if (elapsed >= _tradeTimeoutDuration)
                {
                    OnTradeTimeout();
                }
            }
        }

        #endregion

        #region Trade Lifecycle - Initiation

        /// <summary>
        /// Initiates a trade request to the specified target player.
        /// Validates prerequisites (level, daily limit, friend status) before sending.
        /// </summary>
        /// <param name="targetPlayerId">Unique identifier of the target player.</param>
        public async void InitiateTrade(string targetPlayerId)
        {
            if (string.IsNullOrEmpty(targetPlayerId))
            {
                OnTradeError?.Invoke("Invalid target player ID.");
                return;
            }

            if (IsInTrade)
            {
                OnTradeError?.Invoke("You are already in a trade.");
                return;
            }

            if (!CanTradeWith(targetPlayerId))
            {
                OnTradeError?.Invoke("Cannot trade with this player.");
                return;
            }

            if (_dailyTradeCount >= _maxDailyTrades)
            {
                OnTradeError?.Invoke("Daily trade limit reached. Try again tomorrow.");
                return;
            }

            try
            {
                var request = new TradeRequest
                {
                    RequestId = Guid.NewGuid().ToString(),
                    FromPlayerId = _localPlayerId,
                    ToPlayerId = targetPlayerId,
                    Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
                };

                _pendingRequests[request.RequestId] = request;

                bool sent = await GameAPIClient.Instance.SendTradeRequestAsync(targetPlayerId);
                if (!sent)
                {
                    _pendingRequests.Remove(request.RequestId);
                    OnTradeError?.Invoke("Failed to send trade request.");
                    return;
                }

                Debug.Log($"[TradingManager] Trade request sent to {targetPlayerId}");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[TradingManager] InitiateTrade error: {ex.Message}");
                OnTradeError?.Invoke("Network error while initiating trade.");
            }
        }

        /// <summary>
        /// Accepts an incoming trade request and establishes the active trade session.
        /// </summary>
        /// <param name="requestId">Unique identifier of the trade request to accept.</param>
        public async void AcceptTradeRequest(string requestId)
        {
            if (!_pendingRequests.TryGetValue(requestId, out var request))
            {
                OnTradeError?.Invoke("Trade request not found or expired.");
                return;
            }

            if (IsInTrade)
            {
                OnTradeError?.Invoke("You are already in a trade.");
                return;
            }

            try
            {
                bool accepted = await GameAPIClient.Instance.AcceptTradeRequestAsync(requestId);
                if (!accepted)
                {
                    OnTradeError?.Invoke("Failed to accept trade request.");
                    return;
                }

                _pendingRequests.Remove(requestId);

                string partnerId = request.FromPlayerId == _localPlayerId ? request.ToPlayerId : request.FromPlayerId;
                string partnerName = await GetPlayerNameAsync(partnerId);

                _currentTrade = new TradeSession
                {
                    TradeId = Guid.NewGuid().ToString(),
                    InitiatorId = request.FromPlayerId,
                    InitiatorName = request.FromPlayerId == _localPlayerId ? "You" : partnerName,
                    TargetId = partnerId,
                    TargetName = partnerName,
                    Status = TradeStatus.Active,
                    StartTime = Time.time,
                    TimeoutDuration = _tradeTimeoutDuration
                };

                _tradeStartTime = Time.time;
                _lockTimestamps.Clear();

                OnTradeInitiated?.Invoke(_currentTrade);
                OnTradeAccepted?.Invoke();
                EventBus.Publish(new TradeStartedEvent(_currentTrade));

                Debug.Log($"[TradingManager] Trade accepted with {partnerName}");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[TradingManager] AcceptTradeRequest error: {ex.Message}");
                OnTradeError?.Invoke("Network error while accepting trade.");
            }
        }

        /// <summary>
        /// Declines an incoming trade request.
        /// </summary>
        /// <param name="requestId">Unique identifier of the trade request to decline.</param>
        public async void DeclineTradeRequest(string requestId)
        {
            if (!_pendingRequests.ContainsKey(requestId))
            {
                OnTradeError?.Invoke("Trade request not found or expired.");
                return;
            }

            try
            {
                await GameAPIClient.Instance.DeclineTradeRequestAsync(requestId);
                _pendingRequests.Remove(requestId);
                OnTradeDeclined?.Invoke();
                EventBus.Publish(new TradeDeclinedEvent(requestId));
                Debug.Log($"[TradingManager] Trade request {requestId} declined.");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[TradingManager] DeclineTradeRequest error: {ex.Message}");
                OnTradeError?.Invoke("Network error while declining trade.");
            }
        }

        #endregion

        #region Trade Lifecycle - Active Trade

        /// <summary>
        /// Cancels the currently active trade and notifies the server.
        /// </summary>
        public async void CancelTrade()
        {
            if (_currentTrade == null) return;

            try
            {
                await GameAPIClient.Instance.CancelTradeAsync(_currentTrade.TradeId);
                _currentTrade.Status = TradeStatus.Cancelled;
                EventBus.Publish(new TradeCancelledEvent(_currentTrade.TradeId));
                CleanupTrade();
                OnTradeCancelled?.Invoke();
                Debug.Log("[TradingManager] Trade cancelled.");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[TradingManager] CancelTrade error: {ex.Message}");
                // Force cleanup even on error
                CleanupTrade();
                OnTradeCancelled?.Invoke();
            }
        }

        /// <summary>
        /// Adds an item from the local player's inventory to their trade offer.
        /// </summary>
        /// <param name="itemInstanceId">Unique instance ID of the item to add.</param>
        /// <param name="quantity">Number of units to add (default 1).</param>
        public void AddItemToTrade(string itemInstanceId, int quantity = 1)
        {
            if (_currentTrade == null || _currentTrade.Status != TradeStatus.Active)
            {
                OnTradeError?.Invoke("No active trade to add items to.");
                return;
            }

            if (IsLocalSideLocked())
            {
                OnTradeError?.Invoke("Cannot modify offer while locked. Unlock first.");
                return;
            }

            if (!CanTradeItem(itemInstanceId))
            {
                OnTradeError?.Invoke("This item cannot be traded.");
                return;
            }

            var inventory = InventoryManager.Instance;
            var item = inventory?.GetItemByInstanceId(itemInstanceId);
            if (item == null)
            {
                OnTradeError?.Invoke("Item not found in inventory.");
                return;
            }

            var offer = GetLocalOffer();
            if (offer.Count >= _maxTradeSlots)
            {
                OnTradeError?.Invoke("Trade slots are full.");
                return;
            }

            // Check if already in offer and stack if possible
            var existing = offer.FirstOrDefault(s => s.ItemInstanceId == itemInstanceId);
            if (existing != null)
            {
                existing.Quantity += quantity;
            }
            else
            {
                offer.Add(new TradeSlot
                {
                    ItemInstanceId = itemInstanceId,
                    ItemId = item.Data?.ItemId ?? itemInstanceId,
                    Quantity = quantity,
                    Data = item.Data,
                    IsPremium = item.Data?.IsPremium ?? false
                });
            }

            RecalculateTradeValues();
            OnTradeOfferChanged?.Invoke();
            EventBus.Publish(new TradeOfferChangedEvent(_currentTrade.TradeId, _localPlayerId));
        }

        /// <summary>
        /// Removes an item from the local player's trade offer.
        /// </summary>
        /// <param name="itemInstanceId">Unique instance ID of the item to remove.</param>
        public void RemoveItemFromTrade(string itemInstanceId)
        {
            if (_currentTrade == null || _currentTrade.Status != TradeStatus.Active)
            {
                OnTradeError?.Invoke("No active trade.");
                return;
            }

            if (IsLocalSideLocked())
            {
                OnTradeError?.Invoke("Cannot modify offer while locked.");
                return;
            }

            var offer = GetLocalOffer();
            var slot = offer.FirstOrDefault(s => s.ItemInstanceId == itemInstanceId);
            if (slot != null)
            {
                offer.Remove(slot);
                RecalculateTradeValues();
                OnTradeOfferChanged?.Invoke();
                EventBus.Publish(new TradeOfferChangedEvent(_currentTrade.TradeId, _localPlayerId));
            }
        }

        /// <summary>
        /// Adds currency to the local player's trade offer.
        /// </summary>
        /// <param name="currencyType">Type identifier of the currency (e.g., "Gems", "Coins").</param>
        /// <param name="amount">Amount to offer. Must be positive and available.</param>
        public void AddCurrencyToTrade(string currencyType, int amount)
        {
            if (_currentTrade == null || _currentTrade.Status != TradeStatus.Active)
            {
                OnTradeError?.Invoke("No active trade.");
                return;
            }

            if (IsLocalSideLocked())
            {
                OnTradeError?.Invoke("Cannot modify offer while locked.");
                return;
            }

            if (amount <= 0)
            {
                OnTradeError?.Invoke("Currency amount must be positive.");
                return;
            }

            var localCurrency = GetLocalCurrency();
            int currentAmount = localCurrency.ContainsKey(currencyType) ? localCurrency[currencyType] : 0;
            int newAmount = currentAmount + amount;

            // Validate player actually has this currency
            if (!InventoryManager.Instance.HasCurrency(currencyType, newAmount))
            {
                OnTradeError?.Invoke("Insufficient currency.");
                return;
            }

            localCurrency[currencyType] = newAmount;
            RecalculateTradeValues();
            OnTradeOfferChanged?.Invoke();
            EventBus.Publish(new TradeOfferChangedEvent(_currentTrade.TradeId, _localPlayerId));
        }

        #endregion

        #region Trade Lifecycle - Lock & Confirm

        /// <summary>
        /// Locks the local player's side of the trade, signaling readiness to confirm.
        /// Once locked, the offer cannot be modified until unlocked.
        /// </summary>
        public void LockTrade()
        {
            if (_currentTrade == null || _currentTrade.Status != TradeStatus.Active)
            {
                OnTradeError?.Invoke("No active trade to lock.");
                return;
            }

            if (IsLocalSideLocked())
            {
                OnTradeError?.Invoke("Your side is already locked.");
                return;
            }

            bool isInitiator = _currentTrade.InitiatorId == _localPlayerId;
            if (isInitiator)
            {
                _currentTrade.InitiatorLocked = true;
            }
            else
            {
                _currentTrade.TargetLocked = true;
            }

            _lockTimestamps[_localPlayerId] = Time.time;

            // Check if both sides are locked
            if (_currentTrade.InitiatorLocked && _currentTrade.TargetLocked)
            {
                _currentTrade.IsLocked = true;
                _currentTrade.Status = TradeStatus.Locked;
            }

            OnTradeLocked?.Invoke();
            EventBus.Publish(new TradeLockedEvent(_currentTrade.TradeId, _localPlayerId));
            Debug.Log("[TradingManager] Trade locked.");
        }

        /// <summary>
        /// Unlocks the local player's side, allowing modifications to the offer again.
        /// This also resets the other party's confirmation if they had already confirmed.
        /// </summary>
        public void UnlockTrade()
        {
            if (_currentTrade == null)
            {
                OnTradeError?.Invoke("No active trade.");
                return;
            }

            if (!IsLocalSideLocked())
            {
                OnTradeError?.Invoke("Your side is not locked.");
                return;
            }

            bool isInitiator = _currentTrade.InitiatorId == _localPlayerId;
            if (isInitiator)
            {
                _currentTrade.InitiatorLocked = false;
                _currentTrade.InitiatorConfirmed = false;
            }
            else
            {
                _currentTrade.TargetLocked = false;
                _currentTrade.TargetConfirmed = false;
            }

            _currentTrade.IsLocked = false;
            if (_currentTrade.Status == TradeStatus.Locked)
            {
                _currentTrade.Status = TradeStatus.Active;
            }

            _lockTimestamps.Remove(_localPlayerId);
            OnTradeUnlocked?.Invoke();
            EventBus.Publish(new TradeUnlockedEvent(_currentTrade.TradeId, _localPlayerId));
            Debug.Log("[TradingManager] Trade unlocked.");
        }

        /// <summary>
        /// Final confirmation of the trade. Both parties must be locked and the anti-scam
        /// confirmation delay must have elapsed since locking. Server validation is performed
        /// before the trade is executed.
        /// </summary>
        public async void ConfirmTrade()
        {
            if (_currentTrade == null)
            {
                OnTradeError?.Invoke("No active trade to confirm.");
                return;
            }

            if (!_currentTrade.IsLocked)
            {
                OnTradeError?.Invoke("Both parties must lock before confirming.");
                return;
            }

            // Anti-scam: enforce confirmation delay
            if (_lockTimestamps.TryGetValue(_localPlayerId, out float lockTime))
            {
                float elapsedSinceLock = Time.time - lockTime;
                if (elapsedSinceLock < _tradeConfirmationDelay)
                {
                    float remaining = _tradeConfirmationDelay - elapsedSinceLock;
                    OnTradeError?.Invoke($"Please wait {remaining:F1} more seconds before confirming.");
                    return;
                }
            }

            bool isInitiator = _currentTrade.InitiatorId == _localPlayerId;
            if (isInitiator)
            {
                _currentTrade.InitiatorConfirmed = true;
            }
            else
            {
                _currentTrade.TargetConfirmed = true;
            }

            EventBus.Publish(new TradeConfirmedEvent(_currentTrade.TradeId, _localPlayerId));

            // Only proceed when both have confirmed
            if (_currentTrade.InitiatorConfirmed && _currentTrade.TargetConfirmed)
            {
                _currentTrade.Status = TradeStatus.Confirmed;
                await ExecuteTradeAsync();
            }
        }

        /// <summary>
        /// Declines and cancels the currently active trade from within the trade window.
        /// </summary>
        public void DeclineTrade()
        {
            if (_currentTrade == null) return;
            _currentTrade.Status = TradeStatus.Declined;
            CancelTrade();
        }

        #endregion

        #region Server Validation & Execution

        /// <summary>
        /// Performs comprehensive server-side validation before executing a trade.
        /// Checks item ownership, tradeability, currency availability, and fairness.
        /// </summary>
        private async Task<bool> ValidateTradeBeforeConfirmAsync()
        {
            if (_currentTrade == null) return false;

            try
            {
                var localOffer = GetLocalOffer();
                var partnerOffer = GetPartnerOffer();
                var localCurrency = GetLocalCurrency();
                var partnerCurrency = GetPartnerCurrency();

                // Build the trade payload for server validation
                var tradePayload = new TradeOffer
                {
                    TradeId = _currentTrade.TradeId,
                    InitiatorId = _currentTrade.InitiatorId,
                    TargetId = _currentTrade.TargetId,
                    InitiatorItems = localOffer.Select(s => new TradeItem
                    {
                        ItemInstanceId = s.ItemInstanceId,
                        ItemId = s.ItemId,
                        Quantity = s.Quantity
                    }).ToList(),
                    TargetItems = partnerOffer.Select(s => new TradeItem
                    {
                        ItemInstanceId = s.ItemInstanceId,
                        ItemId = s.ItemId,
                        Quantity = s.Quantity
                    }).ToList(),
                    InitiatorCurrency = new Dictionary<string, int>(localCurrency),
                    TargetCurrency = new Dictionary<string, int>(partnerCurrency)
                };

                bool isValid = await ServerValidator.Instance.ValidateTradeAsync(tradePayload);
                if (!isValid)
                {
                    OnTradeError?.Invoke("Server rejected the trade. Items may no longer be valid.");
                    return false;
                }

                // Additional client-side validation as defense-in-depth
                foreach (var slot in localOffer)
                {
                    if (!CanTradeItem(slot.ItemInstanceId))
                    {
                        OnTradeError?.Invoke($"Item {slot.Data?.DisplayName ?? slot.ItemId} is no longer tradeable.");
                        return false;
                    }
                }

                return true;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[TradingManager] ValidateTradeBeforeConfirm error: {ex.Message}");
                OnTradeError?.Invoke("Validation error. Trade aborted for safety.");
                return false;
            }
        }

        /// <summary>
        /// Executes the trade by sending it to the server for atomic processing.
        /// On success, updates inventories and records the trade history.
        /// </summary>
        private async Task ExecuteTradeAsync()
        {
            if (_isExecutingTrade) return;
            _isExecutingTrade = true;

            try
            {
                bool validated = await ValidateTradeBeforeConfirmAsync();
                if (!validated)
                {
                    RollbackTrade();
                    _isExecutingTrade = false;
                    return;
                }

                bool success = await GameAPIClient.Instance.ExecuteTradeAsync(_currentTrade.TradeId);
                if (!success)
                {
                    OnTradeError?.Invoke("Trade execution failed on the server. No items were exchanged.");
                    RollbackTrade();
                    _isExecutingTrade = false;
                    return;
                }

                // Apply local inventory changes
                ApplyTradeToInventory();

                // Record the trade
                var record = CreateTradeRecord();
                SaveTradeRecord(record);

                _currentTrade.Status = TradeStatus.Completed;
                _dailyTradeCount++;

                EventBus.Publish(new TradeCompletedEvent(_currentTrade.TradeId, record));
                OnTradeCompleted?.Invoke();

                Debug.Log("[TradingManager] Trade executed successfully.");

                // Clear the trade session after a short delay to allow UI animations
                await Task.Delay(2000);
                CleanupTrade();
            }
            catch (Exception ex)
            {
                Debug.LogError($"[TradingManager] ExecuteTrade error: {ex.Message}");
                OnTradeError?.Invoke("Critical error during trade execution.");
                RollbackTrade();
            }
            finally
            {
                _isExecutingTrade = false;
            }
        }

        /// <summary>
        /// Reverts the trade state when validation or execution fails.
        /// Resets confirmations and returns the trade to the Active state.
        /// </summary>
        private void RollbackTrade()
        {
            if (_currentTrade == null) return;

            _currentTrade.InitiatorConfirmed = false;
            _currentTrade.TargetConfirmed = false;
            _currentTrade.Status = TradeStatus.Active;

            OnTradeError?.Invoke("Trade has been rolled back. Please review your offer and try again.");
            Debug.LogWarning("[TradingManager] Trade rolled back.");
        }

        /// <summary>
        /// Handles trade timeout due to inactivity. Automatically cancels the trade.
        /// </summary>
        private void OnTradeTimeout()
        {
            if (_currentTrade == null) return;

            _currentTrade.Status = TradeStatus.TimedOut;
            EventBus.Publish(new TradeTimedOutEvent(_currentTrade.TradeId));
            OnTradeTimedOut?.Invoke();

            try
            {
                GameAPIClient.Instance.CancelTradeAsync(_currentTrade.TradeId).ConfigureAwait(false);
            }
            catch { /* Best effort */ }

            CleanupTrade();
            OnTradeError?.Invoke("Trade timed out due to inactivity.");
            Debug.Log("[TradingManager] Trade timed out.");
        }

        #endregion

        #region Validation Helpers

        /// <summary>
        /// Checks whether the local player can initiate or participate in a trade with the given player.
        /// Considers level requirements, friend-only mode, and blacklist status.
        /// </summary>
        /// <param name="playerId">The player ID to validate against.</param>
        /// <returns>True if trading is permitted with this player.</returns>
        public bool CanTradeWith(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return false;
            if (playerId == _localPlayerId) return false;

            // Level check
            int playerLevel = GameAPIClient.Instance.GetPlayerLevel(_localPlayerId);
            if (playerLevel < _minLevelForTrading)
            {
                return false;
            }

            // Friends-only check
            if (_friendsOnlyTrading)
            {
                bool isFriend = SocialGraphManager.Instance?.IsFriend(playerId) ?? false;
                if (!isFriend) return false;
            }

            // Blacklist / blocked check
            if (SocialGraphManager.Instance?.IsBlocked(playerId) ?? false)
            {
                return false;
            }

            return true;
        }

        /// <summary>
        /// Checks whether a specific inventory item instance can be traded.
        /// </summary>
        /// <param name="itemInstanceId">The item instance to check.</param>
        /// <returns>True if the item is tradeable.</returns>
        public bool CanTradeItem(string itemInstanceId)
        {
            var item = InventoryManager.Instance?.GetItemByInstanceId(itemInstanceId);
            if (item == null || item.Data == null) return false;

            return item.Data.IsTradeable && !item.IsBound && !item.IsEquipped;
        }

        /// <summary>
        /// Calculates the trade value of a single item by its ID using the value calculator.
        /// </summary>
        /// <param name="itemId">The item identifier.</param>
        /// <returns>The calculated trade value, or 0 if the item is not found.</returns>
        public int GetItemTradeValue(string itemId)
        {
            if (TradeValueCalculator.Instance != null)
            {
                return TradeValueCalculator.Instance.CalculateItemValue(itemId);
            }
            return 0;
        }

        /// <summary>
        /// Calculates the total trade value of a set of items and currencies.
        /// </summary>
        /// <param name="items">Dictionary mapping item instance IDs to quantities.</param>
        /// <param name="currencies">Dictionary mapping currency types to amounts.</param>
        /// <returns>The total combined trade value.</returns>
        public int GetTotalTradeValue(Dictionary<string, int> items, Dictionary<string, int> currencies)
        {
            int total = 0;

            if (items != null)
            {
                foreach (var kvp in items)
                {
                    var invItem = InventoryManager.Instance?.GetItemByInstanceId(kvp.Key);
                    if (invItem?.Data != null)
                    {
                        int unitValue = GetItemTradeValue(invItem.Data.ItemId);
                        total += unitValue * kvp.Value;
                    }
                }
            }

            if (currencies != null)
            {
                foreach (var kvp in currencies)
                {
                    total += kvp.Value; // Currency maps 1:1 to value for baseline
                }
            }

            return total;
        }

        /// <summary>
        /// Evaluates whether a trade is fair by comparing the total value offered by each side.
        /// </summary>
        /// <param name="trade">The trade session to evaluate.</param>
        /// <returns>True if the value difference is within the fairness threshold.</returns>
        public bool IsTradeFair(TradeSession trade)
        {
            if (trade == null) return true;

            int initiatorTotal = trade.InitiatorValue;
            int targetTotal = trade.TargetValue;

            if (initiatorTotal == 0 && targetTotal == 0) return true;

            int maxValue = Mathf.Max(initiatorTotal, targetTotal);
            if (maxValue == 0) return true;

            int difference = Mathf.Abs(initiatorTotal - targetTotal);
            float ratio = (float)difference / maxValue;

            return ratio <= _unfairTradeThreshold;
        }

        #endregion

        #region Trade History

        /// <summary>
        /// Retrieves the most recent trade records from local history.
        /// </summary>
        /// <param name="count">Maximum number of records to return (default 20).</param>
        /// <returns>List of trade records, ordered from newest to oldest.</returns>
        public List<TradeRecord> GetTradeHistory(int count = 20)
        {
            return _tradeHistory
                .OrderByDescending(r => r.Timestamp)
                .Take(count)
                .ToList();
        }

        /// <summary>
        /// Saves a completed trade record to local history and syncs to the server.
        /// </summary>
        /// <param name="record">The trade record to persist.</param>
        public async void SaveTradeRecord(TradeRecord record)
        {
            if (record == null) return;

            _tradeHistory.Add(record);

            // Persist locally
            string json = JsonUtility.ToJson(new TradeRecordListWrapper { Records = _tradeHistory });
            PlayerPrefs.SetString("KawaiiCool_TradeHistory", json);
            PlayerPrefs.Save();

            // Sync to server
            try
            {
                await GameAPIClient.Instance.SyncTradeHistoryAsync(record);
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[TradingManager] Failed to sync trade history: {ex.Message}");
            }
        }

        /// <summary>
        /// Retrieves a specific trade record by its unique trade ID.
        /// </summary>
        /// <param name="tradeId">The trade ID to search for.</param>
        /// <returns>The matching trade record, or null if not found.</returns>
        public TradeRecord GetTradeRecord(string tradeId)
        {
            return _tradeHistory.FirstOrDefault(r => r.TradeId == tradeId);
        }

        /// <summary>
        /// Clears all local trade history. Does not affect server-side records.
        /// </summary>
        public void ClearTradeHistory()
        {
            _tradeHistory.Clear();
            PlayerPrefs.DeleteKey("KawaiiCool_TradeHistory");
            PlayerPrefs.Save();
        }

        #endregion

        #region Private Helpers

        private void RecalculateTradeValues()
        {
            if (_currentTrade == null) return;

            var calculator = TradeValueCalculator.Instance;
            if (calculator != null)
            {
                _currentTrade.InitiatorValue = calculator.CalculateTradeValue(
                    _currentTrade.InitiatorOffer, _currentTrade.InitiatorCurrency);
                _currentTrade.TargetValue = calculator.CalculateTradeValue(
                    _currentTrade.TargetOffer, _currentTrade.TargetCurrency);
            }
            else
            {
                // Fallback: use shop prices
                _currentTrade.InitiatorValue = GetTotalTradeValue(
                    _currentTrade.InitiatorOffer.ToDictionary(s => s.ItemInstanceId, s => s.Quantity),
                    _currentTrade.InitiatorCurrency);
                _currentTrade.TargetValue = GetTotalTradeValue(
                    _currentTrade.TargetOffer.ToDictionary(s => s.ItemInstanceId, s => s.Quantity),
                    _currentTrade.TargetCurrency);
            }
        }

        private List<TradeSlot> GetLocalOffer()
        {
            if (_currentTrade == null) return new List<TradeSlot>();
            return _currentTrade.InitiatorId == _localPlayerId
                ? _currentTrade.InitiatorOffer
                : _currentTrade.TargetOffer;
        }

        private List<TradeSlot> GetPartnerOffer()
        {
            if (_currentTrade == null) return new List<TradeSlot>();
            return _currentTrade.InitiatorId == _localPlayerId
                ? _currentTrade.TargetOffer
                : _currentTrade.InitiatorOffer;
        }

        private Dictionary<string, int> GetLocalCurrency()
        {
            if (_currentTrade == null) return new Dictionary<string, int>();
            return _currentTrade.InitiatorId == _localPlayerId
                ? _currentTrade.InitiatorCurrency
                : _currentTrade.TargetCurrency;
        }

        private Dictionary<string, int> GetPartnerCurrency()
        {
            if (_currentTrade == null) return new Dictionary<string, int>();
            return _currentTrade.InitiatorId == _localPlayerId
                ? _currentTrade.TargetCurrency
                : _currentTrade.InitiatorCurrency;
        }

        private bool IsLocalSideLocked()
        {
            if (_currentTrade == null) return false;
            return _currentTrade.InitiatorId == _localPlayerId
                ? _currentTrade.InitiatorLocked
                : _currentTrade.TargetLocked;
        }

        private void ApplyTradeToInventory()
        {
            var inventory = InventoryManager.Instance;
            if (inventory == null || _currentTrade == null) return;

            // Remove items we gave
            var localOffer = GetLocalOffer();
            foreach (var slot in localOffer)
            {
                inventory.RemoveItem(slot.ItemInstanceId, slot.Quantity);
            }

            // Remove currencies we gave
            var localCurrency = GetLocalCurrency();
            foreach (var kvp in localCurrency)
            {
                inventory.RemoveCurrency(kvp.Key, kvp.Value);
            }

            // Add items we received
            var partnerOffer = GetPartnerOffer();
            foreach (var slot in partnerOffer)
            {
                inventory.AddItem(slot.ItemId, slot.Quantity);
            }

            // Add currencies we received
            var partnerCurrency = GetPartnerCurrency();
            foreach (var kvp in partnerCurrency)
            {
                inventory.AddCurrency(kvp.Key, kvp.Value);
            }
        }

        private TradeRecord CreateTradeRecord()
        {
            if (_currentTrade == null) return null;

            bool isInitiator = _currentTrade.InitiatorId == _localPlayerId;
            var gave = isInitiator ? new List<TradeSlot>(_currentTrade.InitiatorOffer) : new List<TradeSlot>(_currentTrade.TargetOffer);
            var received = isInitiator ? new List<TradeSlot>(_currentTrade.TargetOffer) : new List<TradeSlot>(_currentTrade.InitiatorOffer);

            // Append currency as virtual slots for history
            var gaveCurrency = isInitiator ? _currentTrade.InitiatorCurrency : _currentTrade.TargetCurrency;
            foreach (var kvp in gaveCurrency)
            {
                gave.Add(new TradeSlot
                {
                    ItemInstanceId = $"currency_{kvp.Key}",
                    ItemId = kvp.Key,
                    Quantity = kvp.Value,
                    Data = null,
                    IsPremium = kvp.Key == "Gems" || kvp.Key == "Premium"
                });
            }

            var receivedCurrency = isInitiator ? _currentTrade.TargetCurrency : _currentTrade.InitiatorCurrency;
            foreach (var kvp in receivedCurrency)
            {
                received.Add(new TradeSlot
                {
                    ItemInstanceId = $"currency_{kvp.Key}",
                    ItemId = kvp.Key,
                    Quantity = kvp.Value,
                    Data = null,
                    IsPremium = kvp.Key == "Gems" || kvp.Key == "Premium"
                });
            }

            string partnerId = isInitiator ? _currentTrade.TargetId : _currentTrade.InitiatorId;
            string partnerName = isInitiator ? _currentTrade.TargetName : _currentTrade.InitiatorName;

            return new TradeRecord
            {
                TradeId = _currentTrade.TradeId,
                PartnerId = partnerId,
                PartnerName = partnerName,
                Gave = gave,
                Received = received,
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                WasFair = IsTradeFair(_currentTrade)
            };
        }

        private void CleanupTrade()
        {
            _currentTrade = null;
            _lockTimestamps.Clear();
            _tradeStartTime = 0f;
        }

        private void LoadTradeHistory()
        {
            string json = PlayerPrefs.GetString("KawaiiCool_TradeHistory", string.Empty);
            if (!string.IsNullOrEmpty(json))
            {
                try
                {
                    var wrapper = JsonUtility.FromJson<TradeRecordListWrapper>(json);
                    if (wrapper?.Records != null)
                    {
                        _tradeHistory = wrapper.Records;
                    }
                }
                catch (Exception ex)
                {
                    Debug.LogWarning($"[TradingManager] Failed to load trade history: {ex.Message}");
                    _tradeHistory = new List<TradeRecord>();
                }
            }
        }

        private void ResetDailyCountIfNeeded()
        {
            long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            long daySeconds = 86400;

            if (now - _lastDailyResetTimestamp >= daySeconds)
            {
                _dailyTradeCount = 0;
                _lastDailyResetTimestamp = now;
                PlayerPrefs.SetInt("KawaiiCool_DailyTrades", 0);
                PlayerPrefs.SetInt("KawaiiCool_DailyReset", (int)_lastDailyResetTimestamp);
                PlayerPrefs.Save();
            }
            else
            {
                _dailyTradeCount = PlayerPrefs.GetInt("KawaiiCool_DailyTrades", 0);
                _lastDailyResetTimestamp = PlayerPrefs.GetInt("KawaiiCool_DailyReset", (int)now);
            }
        }

        private async Task<string> GetPlayerNameAsync(string playerId)
        {
            try
            {
                return await GameAPIClient.Instance.GetPlayerNameAsync(playerId);
            }
            catch
            {
                return "Unknown Player";
            }
        }

        #endregion

        #region Incoming Network Events

        /// <summary>
        /// Called by the network layer when an incoming trade request is received.
        /// </summary>
        public void OnIncomingTradeRequest(string requestId, string fromPlayerId)
        {
            _pendingRequests[requestId] = new TradeRequest
            {
                RequestId = requestId,
                FromPlayerId = fromPlayerId,
                ToPlayerId = _localPlayerId,
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
            };

            EventBus.Publish(new TradeRequestReceivedEvent(requestId, fromPlayerId));
        }

        /// <summary>
        /// Called by the network layer when the partner updates their trade offer.
        /// </summary>
        public void OnPartnerOfferUpdated(List<TradeSlot> partnerOffer, Dictionary<string, int> partnerCurrency)
        {
            if (_currentTrade == null) return;

            if (_currentTrade.InitiatorId == _localPlayerId)
            {
                _currentTrade.TargetOffer = partnerOffer ?? new List<TradeSlot>();
                _currentTrade.TargetCurrency = partnerCurrency ?? new Dictionary<string, int>();
            }
            else
            {
                _currentTrade.InitiatorOffer = partnerOffer ?? new List<TradeSlot>();
                _currentTrade.InitiatorCurrency = partnerCurrency ?? new Dictionary<string, int>();
            }

            // Reset confirmations when offer changes
            _currentTrade.InitiatorConfirmed = false;
            _currentTrade.TargetConfirmed = false;

            RecalculateTradeValues();
            OnTradeOfferChanged?.Invoke();
        }

        /// <summary>
        /// Called by the network layer when the partner locks their side.
        /// </summary>
        public void OnPartnerLocked(string playerId)
        {
            if (_currentTrade == null) return;

            if (_currentTrade.InitiatorId == playerId)
            {
                _currentTrade.InitiatorLocked = true;
            }
            else
            {
                _currentTrade.TargetLocked = true;
            }

            if (_currentTrade.InitiatorLocked && _currentTrade.TargetLocked)
            {
                _currentTrade.IsLocked = true;
                _currentTrade.Status = TradeStatus.Locked;
            }

            OnTradeOfferChanged?.Invoke();
        }

        /// <summary>
        /// Called by the network layer when the partner unlocks their side.
        /// </summary>
        public void OnPartnerUnlocked(string playerId)
        {
            if (_currentTrade == null) return;

            if (_currentTrade.InitiatorId == playerId)
            {
                _currentTrade.InitiatorLocked = false;
                _currentTrade.InitiatorConfirmed = false;
            }
            else
            {
                _currentTrade.TargetLocked = false;
                _currentTrade.TargetConfirmed = false;
            }

            _currentTrade.IsLocked = false;
            _currentTrade.Status = TradeStatus.Active;
            OnTradeOfferChanged?.Invoke();
        }

        /// <summary>
        /// Called by the network layer when the partner confirms.
        /// </summary>
        public void OnPartnerConfirmed(string playerId)
        {
            if (_currentTrade == null) return;

            if (_currentTrade.InitiatorId == playerId)
            {
                _currentTrade.InitiatorConfirmed = true;
            }
            else
            {
                _currentTrade.TargetConfirmed = true;
            }
        }

        /// <summary>
        /// Called by the network layer when the partner cancels the trade.
        /// </summary>
        public void OnPartnerCancelled()
        {
            if (_currentTrade != null)
            {
                _currentTrade.Status = TradeStatus.Cancelled;
                EventBus.Publish(new TradeCancelledEvent(_currentTrade.TradeId));
            }
            CleanupTrade();
            OnTradeCancelled?.Invoke();
        }

        #endregion
    }

    #region Supporting Data Structures

    /// <summary>
    /// Represents a single active or pending trade session between two players.
    /// </summary>
    [System.Serializable]
    public class TradeSession
    {
        public string TradeId;
        public string InitiatorId;
        public string InitiatorName;
        public string TargetId;
        public string TargetName;
        public List<TradeSlot> InitiatorOffer = new List<TradeSlot>();
        public List<TradeSlot> TargetOffer = new List<TradeSlot>();
        public Dictionary<string, int> InitiatorCurrency = new Dictionary<string, int>();
        public Dictionary<string, int> TargetCurrency = new Dictionary<string, int>();
        public bool IsLocked;
        public bool InitiatorLocked;
        public bool TargetLocked;
        public bool InitiatorConfirmed;
        public bool TargetConfirmed;
        public TradeStatus Status;
        public float StartTime;
        public float TimeoutDuration = 120f;
        public int InitiatorValue;
        public int TargetValue;
    }

    /// <summary>
    /// Represents a single item slot within a trade offer.
    /// </summary>
    [System.Serializable]
    public class TradeSlot
    {
        public string ItemInstanceId;
        public string ItemId;
        public int Quantity;
        public ItemData Data;
        public bool IsPremium;
    }

    /// <summary>
    /// Persistent record of a completed trade for history and audit purposes.
    /// </summary>
    [System.Serializable]
    public class TradeRecord
    {
        public string TradeId;
        public string PartnerId;
        public string PartnerName;
        public List<TradeSlot> Gave = new List<TradeSlot>();
        public List<TradeSlot> Received = new List<TradeSlot>();
        public long Timestamp;
        public bool WasFair;
    }

    /// <summary>
    /// JSON serialization wrapper for the trade history list.
    /// </summary>
    [System.Serializable]
    public class TradeRecordListWrapper
    {
        public List<TradeRecord> Records;
    }

    /// <summary>
    /// Internal representation of a pending trade request before acceptance.
    /// </summary>
    public class TradeRequest
    {
        public string RequestId;
        public string FromPlayerId;
        public string ToPlayerId;
        public long Timestamp;
    }

    /// <summary>
    /// Enumerates all possible states of a trade session.
    /// </summary>
    public enum TradeStatus
    {
        Pending,
        Active,
        Locked,
        Confirmed,
        Completed,
        Cancelled,
        Declined,
        TimedOut
    }

    #endregion

    #region EventBus Events

    /// <summary>
    /// Event fired when a trade session begins.
    /// </summary>
    public class TradeStartedEvent
    {
        public readonly TradeSession Session;
        public TradeStartedEvent(TradeSession session) => Session = session;
    }

    /// <summary>
    /// Event fired when a trade request is received from another player.
    /// </summary>
    public class TradeRequestReceivedEvent
    {
        public readonly string RequestId;
        public readonly string FromPlayerId;
        public TradeRequestReceivedEvent(string requestId, string fromPlayerId)
        {
            RequestId = requestId;
            FromPlayerId = fromPlayerId;
        }
    }

    /// <summary>
    /// Event fired when a trade request is declined.
    /// </summary>
    public class TradeDeclinedEvent
    {
        public readonly string RequestId;
        public TradeDeclinedEvent(string requestId) => RequestId = requestId;
    }

    /// <summary>
    /// Event fired when a trade is cancelled.
    /// </summary>
    public class TradeCancelledEvent
    {
        public readonly string TradeId;
        public TradeCancelledEvent(string tradeId) => TradeId = tradeId;
    }

    /// <summary>
    /// Event fired when a trade is completed successfully.
    /// </summary>
    public class TradeCompletedEvent
    {
        public readonly string TradeId;
        public readonly TradeRecord Record;
        public TradeCompletedEvent(string tradeId, TradeRecord record)
        {
            TradeId = tradeId;
            Record = record;
        }
    }

    /// <summary>
    /// Event fired when a trade times out.
    /// </summary>
    public class TradeTimedOutEvent
    {
        public readonly string TradeId;
        public TradeTimedOutEvent(string tradeId) => TradeId = tradeId;
    }

    /// <summary>
    /// Event fired when a player locks their side of the trade.
    /// </summary>
    public class TradeLockedEvent
    {
        public readonly string TradeId;
        public readonly string PlayerId;
        public TradeLockedEvent(string tradeId, string playerId)
        {
            TradeId = tradeId;
            PlayerId = playerId;
        }
    }

    /// <summary>
    /// Event fired when a player unlocks their side of the trade.
    /// </summary>
    public class TradeUnlockedEvent
    {
        public readonly string TradeId;
        public readonly string PlayerId;
        public TradeUnlockedEvent(string tradeId, string playerId)
        {
            TradeId = tradeId;
            PlayerId = playerId;
        }
    }

    /// <summary>
    /// Event fired when a player confirms their side of the trade.
    /// </summary>
    public class TradeConfirmedEvent
    {
        public readonly string TradeId;
        public readonly string PlayerId;
        public TradeConfirmedEvent(string tradeId, string playerId)
        {
            TradeId = tradeId;
            PlayerId = playerId;
        }
    }

    /// <summary>
    /// Event fired when either side modifies their trade offer.
    /// </summary>
    public class TradeOfferChangedEvent
    {
        public readonly string TradeId;
        public readonly string PlayerId;
        public TradeOfferChangedEvent(string tradeId, string playerId)
        {
            TradeId = tradeId;
            PlayerId = playerId;
        }
    }

    #endregion
}
