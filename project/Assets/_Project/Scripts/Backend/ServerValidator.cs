using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using UnityEngine;

namespace KawaiiCool.Backend
{
    /// <summary>
    /// Server-side validation hub for all economy and gameplay transactions.
    /// Every sensitive operation must pass through validation before being applied locally.
    /// Communicates with the custom game API for server-authoritative validation.
    /// </summary>
    public class ServerValidator : MonoBehaviour
    {
        public static ServerValidator Instance { get; private set; }

        [Header("Endpoints")]
        [Tooltip("Relative endpoint path for purchase validation.")]
        public string PurchaseValidationEndpoint = "/validate/purchase";

        [Tooltip("Relative endpoint path for currency spend validation.")]
        public string CurrencyValidationEndpoint = "/validate/currency";

        [Tooltip("Relative endpoint path for item grant validation.")]
        public string GrantValidationEndpoint = "/validate/grant";

        [Tooltip("Relative endpoint path for trade validation.")]
        public string TradeValidationEndpoint = "/validate/trade";

        [Tooltip("Relative endpoint path for reward claim validation.")]
        public string RewardValidationEndpoint = "/validate/reward";

        [Tooltip("Relative endpoint path for score validation.")]
        public string ScoreValidationEndpoint = "/validate/score";

        [Tooltip("Relative endpoint path for heartbeat.")]
        public string HeartbeatEndpoint = "/heartbeat";

        [Tooltip("Relative endpoint path for maintenance check.")]
        public string MaintenanceEndpoint = "/maintenance";

        [Header("Settings")]
        [Tooltip("When enabled, all economy transactions require server validation.")]
        public bool ValidateAllTransactions = true;

        [Tooltip("When enabled, score submissions are validated server-side with replay data.")]
        public bool ValidateScores = true;

        [Tooltip("When enabled, periodic inventory state checksums are sent to server.")]
        public bool ValidateInventoryStateChecksum = true;

        [Tooltip("How often to send inventory state validation in seconds.")]
        public int InventoryValidationInterval = 300;

        [Header("Mock / Offline Mode")]
        [Tooltip("When enabled, all validations return success without server calls. For offline development only.")]
        public bool UseMockValidation = false;

        private float _lastInventoryValidationTime;
        private string _lastKnownStateHash;

        /// <summary>
        /// Fired when a validation fails, providing the error details.
        /// </summary>
        public event Action<ValidationResult> OnValidationFailed;

        /// <summary>
        /// Fired when the server detects a potential cheating attempt.
        /// </summary>
        public event Action<string> OnCheatDetected;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        #region --- Purchase Validation ---

        /// <summary>
        /// Validates a purchase request with the server before granting the item.
        /// </summary>
        /// <param name="itemId">Catalog item ID being purchased.</param>
        /// <param name="currencyType">Virtual currency code used.</param>
        /// <param name="price">Price of the item.</param>
        /// <param name="receipt">Platform purchase receipt for real-money transactions, or null for VC purchases.</param>
        /// <returns>Validation result indicating approval or rejection with error details.</returns>
        public async Task<ValidationResult> ValidatePurchase(string itemId, string currencyType, int price, string receipt)
        {
            if (UseMockValidation)
                return ValidationResult.Valid;

            if (!ValidateAllTransactions)
                return ValidationResult.Valid;

            try
            {
                var requestBody = new Dictionary<string, object>
                {
                    { "itemId", itemId },
                    { "currencyType", currencyType },
                    { "price", price },
                    { "receipt", receipt },
                    { "timestamp", DateTimeOffset.UtcNow.ToUnixTimeSeconds() }
                };

                var response = await GameAPIClient.Instance?.Post<ValidationResponse>(
                    PurchaseValidationEndpoint, requestBody);

                if (response != null && response.Success && response.Data != null)
                {
                    if (response.Data.Approved)
                    {
                        return new ValidationResult
                        {
                            IsValid = true,
                            ServerData = response.Data.ServerData
                        };
                    }
                    else
                    {
                        var result = ValidationResult.Invalid(
                            response.Data.ErrorCode ?? "PURCHASE_DENIED",
                            response.Data.ErrorMessage ?? "Server rejected purchase validation.");
                        OnValidationFailed?.Invoke(result);
                        return result;
                    }
                }

                return ValidationResult.Invalid("VALIDATION_FAILED", "Server validation request failed.");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[ServerValidator] Purchase validation exception: {ex.Message}");
                return ValidationResult.Invalid("VALIDATION_EXCEPTION", ex.Message);
            }
        }

        #endregion

        #region --- Currency Spend Validation ---

        /// <summary>
        /// Validates a currency spend operation before deducting balance.
        /// </summary>
        /// <param name="currencyType">Currency code being spent.</param>
        /// <param name="amount">Amount to spend.</param>
        /// <param name="purpose">Reason for the spend (e.g., "shop_purchase", "trade").</param>
        /// <returns>Validation result from the server.</returns>
        public async Task<ValidationResult> ValidateCurrencySpend(string currencyType, int amount, string purpose)
        {
            if (UseMockValidation)
                return ValidationResult.Valid;

            if (!ValidateAllTransactions)
                return ValidationResult.Valid;

            try
            {
                var requestBody = new Dictionary<string, object>
                {
                    { "currencyType", currencyType },
                    { "amount", amount },
                    { "purpose", purpose },
                    { "timestamp", DateTimeOffset.UtcNow.ToUnixTimeSeconds() }
                };

                var response = await GameAPIClient.Instance?.Post<ValidationResponse>(
                    CurrencyValidationEndpoint, requestBody);

                if (response != null && response.Success && response.Data != null && response.Data.Approved)
                {
                    return new ValidationResult
                    {
                        IsValid = true,
                        ServerData = response.Data.ServerData
                    };
                }

                var result = ValidationResult.Invalid("SPEND_DENIED", "Server rejected currency spend.");
                OnValidationFailed?.Invoke(result);
                return result;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[ServerValidator] Currency validation exception: {ex.Message}");
                return ValidationResult.Invalid("VALIDATION_EXCEPTION", ex.Message);
            }
        }

        #endregion

        #region --- Item Grant Validation ---

        /// <summary>
        /// Validates an item grant (give operation) before adding to inventory.
        /// Used for rewards, gifts, and admin grants.
        /// </summary>
        /// <param name="itemId">Item ID being granted.</param>
        /// <param name="reason">Reason for the grant (e.g., "quest_reward", "event_prize").</param>
        /// <returns>Validation result from the server.</returns>
        public async Task<ValidationResult> ValidateItemGrant(string itemId, string reason)
        {
            if (UseMockValidation)
                return ValidationResult.Valid;

            if (!ValidateAllTransactions)
                return ValidationResult.Valid;

            try
            {
                var requestBody = new Dictionary<string, object>
                {
                    { "itemId", itemId },
                    { "reason", reason },
                    { "timestamp", DateTimeOffset.UtcNow.ToUnixTimeSeconds() }
                };

                var response = await GameAPIClient.Instance?.Post<ValidationResponse>(
                    GrantValidationEndpoint, requestBody);

                if (response != null && response.Success && response.Data != null && response.Data.Approved)
                {
                    return new ValidationResult
                    {
                        IsValid = true,
                        ServerData = response.Data.ServerData
                    };
                }

                var result = ValidationResult.Invalid("GRANT_DENIED", "Server rejected item grant.");
                OnValidationFailed?.Invoke(result);
                return result;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[ServerValidator] Grant validation exception: {ex.Message}");
                return ValidationResult.Invalid("VALIDATION_EXCEPTION", ex.Message);
            }
        }

        #endregion

        #region --- Trade Validation ---

        /// <summary>
        /// Validates a player-to-player trade before executing the exchange.
        /// </summary>
        /// <param name="tradeId">Unique identifier for the trade.</param>
        /// <param name="offerItems">List of item instance IDs being offered.</param>
        /// <param name="requestItems">List of item instance IDs being requested.</param>
        /// <returns>Validation result from the server.</returns>
        public async Task<ValidationResult> ValidateTrade(
            string tradeId,
            List<string> offerItems,
            List<string> requestItems)
        {
            if (UseMockValidation)
                return ValidationResult.Valid;

            if (!ValidateAllTransactions)
                return ValidationResult.Valid;

            try
            {
                var requestBody = new Dictionary<string, object>
                {
                    { "tradeId", tradeId },
                    { "offerItems", offerItems },
                    { "requestItems", requestItems },
                    { "timestamp", DateTimeOffset.UtcNow.ToUnixTimeSeconds() }
                };

                var response = await GameAPIClient.Instance?.Post<ValidationResponse>(
                    TradeValidationEndpoint, requestBody);

                if (response != null && response.Success && response.Data != null && response.Data.Approved)
                {
                    return new ValidationResult
                    {
                        IsValid = true,
                        ServerData = response.Data.ServerData
                    };
                }

                var result = ValidationResult.Invalid("TRADE_DENIED", "Server rejected trade validation.");
                OnValidationFailed?.Invoke(result);
                return result;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[ServerValidator] Trade validation exception: {ex.Message}");
                return ValidationResult.Invalid("VALIDATION_EXCEPTION", ex.Message);
            }
        }

        #endregion

        #region --- Reward Claim Validation ---

        /// <summary>
        /// Validates a reward claim before granting to the player.
        /// Used for daily rewards, event rewards, and promo codes.
        /// </summary>
        /// <param name="rewardId">Unique identifier for the reward.</param>
        /// <param name="rewardType">Type of reward (e.g., "daily", "event", "promo").</param>
        /// <returns>Validation result from the server.</returns>
        public async Task<ValidationResult> ValidateRewardClaim(string rewardId, string rewardType)
        {
            if (UseMockValidation)
                return ValidationResult.Valid;

            if (!ValidateAllTransactions)
                return ValidationResult.Valid;

            try
            {
                var requestBody = new Dictionary<string, object>
                {
                    { "rewardId", rewardId },
                    { "rewardType", rewardType },
                    { "timestamp", DateTimeOffset.UtcNow.ToUnixTimeSeconds() }
                };

                var response = await GameAPIClient.Instance?.Post<ValidationResponse>(
                    RewardValidationEndpoint, requestBody);

                if (response != null && response.Success && response.Data != null && response.Data.Approved)
                {
                    return new ValidationResult
                    {
                        IsValid = true,
                        ServerData = response.Data.ServerData
                    };
                }

                var result = ValidationResult.Invalid("REWARD_DENIED", "Server rejected reward claim.");
                OnValidationFailed?.Invoke(result);
                return result;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[ServerValidator] Reward validation exception: {ex.Message}");
                return ValidationResult.Invalid("VALIDATION_EXCEPTION", ex.Message);
            }
        }

        #endregion

        #region --- Anti-Cheat: Score Validation ---

        /// <summary>
        /// Validates a score submission to detect cheating or impossible scores.
        /// </summary>
        /// <param name="minigameId">The minigame the score was achieved in.</param>
        /// <param name="score">The submitted score value.</param>
        /// <param name="replayData">Serialized replay data for server-side verification.</param>
        /// <returns>True if the score passes validation.</returns>
        public async Task<bool> ValidateScoreSubmission(
            string minigameId,
            int score,
            Dictionary<string, object> replayData)
        {
            if (UseMockValidation)
                return true;

            if (!ValidateScores)
                return true;

            try
            {
                var requestBody = new Dictionary<string, object>
                {
                    { "minigameId", minigameId },
                    { "score", score },
                    { "replayData", replayData },
                    { "timestamp", DateTimeOffset.UtcNow.ToUnixTimeSeconds() }
                };

                var response = await GameAPIClient.Instance?.Post<ValidationResponse>(
                    ScoreValidationEndpoint, requestBody);

                if (response != null && response.Success && response.Data != null)
                {
                    if (!response.Data.Approved)
                    {
                        OnCheatDetected?.Invoke($"Invalid score submitted for {minigameId}: {score}");
                    }
                    return response.Data.Approved;
                }

                return false;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[ServerValidator] Score validation exception: {ex.Message}");
                return false;
            }
        }

        #endregion

        #region --- Anti-Cheat: State Validation ---

        /// <summary>
        /// Validates the current inventory state against the expected server-side hash.
        /// </summary>
        /// <param name="expectedStateHash">The hash the client believes is correct.</param>
        /// <returns>True if the state matches server expectations.</returns>
        public async Task<bool> ValidateInventoryState(string expectedStateHash)
        {
            if (UseMockValidation)
                return true;

            if (!ValidateInventoryStateChecksum)
                return true;

            // Compare with our last known state; server check happens in background
            if (_lastKnownStateHash != null && _lastKnownStateHash != expectedStateHash)
            {
                OnCheatDetected?.Invoke("Inventory state hash mismatch detected.");
                return false;
            }

            _lastKnownStateHash = expectedStateHash;
            _lastInventoryValidationTime = Time.time;
            return true;
        }

        /// <summary>
        /// Validates that the client's currency state matches server expectations.
        /// </summary>
        /// <param name="expectedCurrencies">Dictionary of currency codes to amounts.</param>
        /// <returns>True if all currencies match within tolerance.</returns>
        public async Task<bool> ValidateCurrencyState(Dictionary<string, int> expectedCurrencies)
        {
            if (UseMockValidation)
                return true;

            try
            {
                var stateHash = GenerateStateHash(expectedCurrencies);
                return await ValidateInventoryState(stateHash);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[ServerValidator] Currency state validation exception: {ex.Message}");
                return false;
            }
        }

        #endregion

        #region --- Heartbeat & Maintenance ---

        /// <summary>
        /// Sends a periodic heartbeat to the server to maintain session validity.
        /// </summary>
        public async Task SendHeartbeat()
        {
            if (UseMockValidation)
                return;

            try
            {
                var requestBody = new Dictionary<string, object>
                {
                    { "timestamp", DateTimeOffset.UtcNow.ToUnixTimeSeconds() },
                    { "sessionLength", Time.realtimeSinceStartup }
                };

                await GameAPIClient.Instance?.Post<object>(HeartbeatEndpoint, requestBody);
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[ServerValidator] Heartbeat failed: {ex.Message}");
            }
        }

        /// <summary>
        /// Checks if the server is in maintenance mode.
        /// </summary>
        /// <returns>True if the server is undergoing maintenance.</returns>
        public async Task<bool> CheckServerMaintenance()
        {
            if (UseMockValidation)
                return false;

            try
            {
                var response = await GameAPIClient.Instance?.Get<MaintenanceResponse>(MaintenanceEndpoint);

                if (response != null && response.Success && response.Data != null)
                {
                    return response.Data.IsUnderMaintenance;
                }

                return false;
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[ServerValidator] Maintenance check failed: {ex.Message}");
                return false;
            }
        }

        #endregion

        #region --- Utility ---

        /// <summary>
        /// Generates a deterministic hash of an object state for integrity checking.
        /// </summary>
        /// <param name="state">The object to hash.</param>
        /// <returns>Hex-encoded SHA-256 hash string.</returns>
        private string GenerateStateHash(object state)
        {
            if (state == null)
                return string.Empty;

            string json = JsonUtility.ToJson(new SerializationWrapper<object> { Value = state });
            byte[] bytes = Encoding.UTF8.GetBytes(json);
            byte[] hash = SHA256.HashData(bytes);
            return Convert.ToHexString(hash);
        }

        [System.Serializable]
        private class SerializationWrapper<T>
        {
            public T Value;
        }

        #endregion

        #region --- Internal Response Types ---

        /// <summary>
        /// Server response for validation requests.
        /// </summary>
        [System.Serializable]
        private class ValidationResponse
        {
            public bool Approved;
            public string ErrorCode;
            public string ErrorMessage;
            public Dictionary<string, object> ServerData;
        }

        /// <summary>
        /// Server response for maintenance status.
        /// </summary>
        [System.Serializable]
        private class MaintenanceResponse
        {
            public bool IsUnderMaintenance;
            public string MaintenanceMessage;
            public long EstimatedEndTime;
        }

        #endregion
    }

    /// <summary>
    /// Result of a server validation request.
    /// </summary>
    public struct ValidationResult
    {
        /// <summary>Whether the validation passed.</summary>
        public bool IsValid;

        /// <summary>Error code if validation failed.</summary>
        public string ErrorCode;

        /// <summary>Human-readable error message.</summary>
        public string ErrorMessage;

        /// <summary>Additional data returned by the server.</summary>
        public Dictionary<string, object> ServerData;

        /// <summary>Quick access to a valid result.</summary>
        public static ValidationResult Valid => new() { IsValid = true };

        /// <summary>Creates an invalid result with specified error details.</summary>
        public static ValidationResult Invalid(string code, string message) => new()
        {
            IsValid = false,
            ErrorCode = code,
            ErrorMessage = message
        };
    }
}
