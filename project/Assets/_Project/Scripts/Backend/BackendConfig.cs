using System.Collections.Generic;
using UnityEngine;

namespace KawaiiCool.Backend
{
    /// <summary>
    /// ScriptableObject configuration for all backend services in KawaiiCool Island.
    /// Contains Firebase, PlayFab, Custom API settings, feature flags, and economy limits.
    /// </summary>
    [CreateAssetMenu(fileName = "BackendConfig", menuName = "KawaiiCool/Backend Config")]
    public class BackendConfig : ScriptableObject
    {
        [Header("Firebase")]
        [Tooltip("Enable Firebase Authentication for player login.")]
        public bool UseFirebaseAuth = true;

        [Tooltip("Enable Firebase Analytics for event tracking.")]
        public bool UseFirebaseAnalytics = true;

        [Tooltip("Enable Firebase Crashlytics for crash reporting.")]
        public bool UseFirebaseCrashlytics = true;

        [Tooltip("Enable Firebase Cloud Messaging for push notifications.")]
        public bool UseFirebaseMessaging = true;

        [Tooltip("Enable Firebase Remote Config for live configuration updates.")]
        public bool UseFirebaseRemoteConfig = true;

        [Header("PlayFab")]
        [Tooltip("PlayFab Title ID from the Game Manager dashboard.")]
        public string PlayFabTitleId;

        [Tooltip("Use PlayFab development mode endpoints.")]
        public bool UseDevelopmentMode = false;

        [Tooltip("Enable PlayFab virtual currency and inventory systems.")]
        public bool UsePlayFabEconomy = true;

        [Tooltip("Enable PlayFab leaderboards for competitive features.")]
        public bool UsePlayFabLeaderboards = true;

        [Tooltip("Enable PlayFab Cloud Save for player data persistence.")]
        public bool UsePlayFabCloudSave = true;

        [Tooltip("Enable PlayFab Friends system.")]
        public bool UsePlayFabFriends = true;

        [Tooltip("Use CloudScript/Azure Functions for server-side validation.")]
        public bool UseCloudScriptValidation = true;

        [Header("Custom API")]
        [Tooltip("Base URL for the custom game REST API.")]
        public string APIBaseUrl;

        [Tooltip("Enable the custom REST API client.")]
        public bool UseCustomAPI = true;

        [Tooltip("API version to use in request URLs.")]
        public int APIVersion = 1;

        [Header("Feature Flags")]
        [Tooltip("Enable player-to-player item trading.")]
        public bool EnableTrading = true;

        [Tooltip("Enable gifting items to friends.")]
        public bool EnableGifting = true;

        [Tooltip("Enable voice chat in social areas.")]
        public bool EnableVoiceChat = false;

        [Tooltip("Enable clan/guild system.")]
        public bool EnableClans = false;

        [Tooltip("Enable tournament events.")]
        public bool EnableTournaments = false;

        [Tooltip("Enable battle pass seasonal progression.")]
        public bool EnableBattlePass = false;

        [Header("Economy")]
        [Tooltip("List of virtual currency types used in the game.")]
        public List<string> CurrencyTypes = new() { "CO", "GM", "TK" };

        [Tooltip("Maximum coins a player can hold.")]
        public int MaxCoins = 999999;

        [Tooltip("Maximum gems a player can hold.")]
        public int MaxGems = 99999;

        [Tooltip("Maximum tickets a player can hold.")]
        public int MaxTickets = 999;

        [Tooltip("Enable premium (real-money) currency purchases.")]
        public bool EnablePremiumCurrency = true;

        [Header("Rate Limits")]
        [Tooltip("Maximum API requests per minute per player.")]
        public int MaxRequestsPerMinute = 120;

        [Tooltip("Maximum trades per day per player.")]
        public int MaxTradesPerDay = 10;

        [Tooltip("Maximum friend requests per day per player.")]
        public int MaxFriendRequestsPerDay = 20;

        [Header("Security")]
        [Tooltip("Validate all economy transactions server-side.")]
        public bool ValidateTransactionsServerSide = true;

        [Tooltip("Send periodic heartbeat to detect anomalies.")]
        public bool EnableHeartbeat = true;

        [Tooltip("Heartbeat interval in seconds.")]
        public int HeartbeatIntervalSeconds = 60;

        /// <summary>
        /// Gets the currency code for the primary currency (coins).
        /// </summary>
        public string CoinsCurrencyCode => CurrencyTypes.Count > 0 ? CurrencyTypes[0] : "CO";

        /// <summary>
        /// Gets the currency code for the premium currency (gems).
        /// </summary>
        public string GemsCurrencyCode => CurrencyTypes.Count > 1 ? CurrencyTypes[1] : "GM";

        /// <summary>
        /// Gets the currency code for the ticket currency.
        /// </summary>
        public string TicketsCurrencyCode => CurrencyTypes.Count > 2 ? CurrencyTypes[2] : "TK";

        /// <summary>
        /// Returns the maximum allowed value for a given currency type.
        /// </summary>
        /// <param name="currencyCode">The currency code to check.</param>
        /// <returns>The maximum allowed amount.</returns>
        public int GetMaxCurrency(string currencyCode)
        {
            if (currencyCode == CoinsCurrencyCode) return MaxCoins;
            if (currencyCode == GemsCurrencyCode) return MaxGems;
            if (currencyCode == TicketsCurrencyCode) return MaxTickets;
            return int.MaxValue;
        }

        /// <summary>
        /// Validates that the configuration has required fields set.
        /// </summary>
        /// <returns>True if configuration is valid.</returns>
        public bool IsValid()
        {
            if (UsePlayFabEconomy && string.IsNullOrEmpty(PlayFabTitleId))
                return false;
            if (UseCustomAPI && string.IsNullOrEmpty(APIBaseUrl))
                return false;
            return true;
        }
    }
}
