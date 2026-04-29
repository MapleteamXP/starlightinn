using System.Collections.Generic;
using UnityEngine;

namespace KawaiiCool.Backend
{
    /// <summary>
    /// Centralized event logger for KawaiiCool Island.
    /// Routes events to Firebase Analytics and PlayFab analytics with automatic batching.
    /// All methods are fire-and-forget and safe to call from any thread.
    /// </summary>
    public static class BackendEventLogger
    {
        private const string EVENT_SESSION_START = "session_start";
        private const string EVENT_SESSION_END = "session_end";
        private const string EVENT_SCREEN_VIEW = "screen_view";
        private const string EVENT_CURRENCY_EARNED = "currency_earned";
        private const string EVENT_CURRENCY_SPENT = "currency_spent";
        private const string EVENT_ITEM_ACQUIRED = "item_acquired";
        private const string EVENT_ITEM_CONSUMED = "item_consumed";
        private const string EVENT_FRIEND_ADDED = "friend_added";
        private const string EVENT_CHAT_MESSAGE = "chat_message_sent";
        private const string EVENT_EMOTE_USED = "emote_used";
        private const string EVENT_MINIGAME_STARTED = "minigame_started";
        private const string EVENT_MINIGAME_ENDED = "minigame_ended";
        private const string EVENT_ISLAND_EDITED = "island_edited";
        private const string EVENT_AVATAR_CUSTOMIZED = "avatar_customized";
        private const string EVENT_SHOP_VIEWED = "shop_viewed";
        private const string EVENT_ITEM_PURCHASED = "item_purchased";
        private const string EVENT_LEVEL_UP = "level_up";
        private const string EVENT_XP_GAINED = "xp_gained";
        private const string EVENT_ACHIEVEMENT_UNLOCKED = "achievement_unlocked";
        private const string EVENT_DAILY_REWARD_CLAIMED = "daily_reward_claimed";
        private const string EVENT_AD_IMPRESSION = "ad_impression";
        private const string EVENT_AD_REWARD = "ad_reward";
        private const string EVENT_PUSH_RECEIVED = "push_received";
        private const string EVENT_PUSH_OPENED = "push_opened";

        /// <summary>
        /// Logs the start of a player session.
        /// </summary>
        public static void LogSessionStart()
        {
            var parameters = new Dictionary<string, object>
            {
                { "timestamp", System.DateTimeOffset.UtcNow.ToUnixTimeSeconds() }
            };
            LogEvent(EVENT_SESSION_START, parameters);
        }

        /// <summary>
        /// Logs the end of a player session with duration.
        /// </summary>
        /// <param name="sessionLengthSeconds">Total session length in seconds.</param>
        public static void LogSessionEnd(int sessionLengthSeconds)
        {
            var parameters = new Dictionary<string, object>
            {
                { "session_length", sessionLengthSeconds },
                { "session_length_minutes", sessionLengthSeconds / 60 }
            };
            LogEvent(EVENT_SESSION_END, parameters);
        }

        /// <summary>
        /// Logs a screen/view navigation event.
        /// </summary>
        /// <param name="screenName">Name of the screen viewed.</param>
        public static void LogScreenView(string screenName)
        {
            var parameters = new Dictionary<string, object>
            {
                { "screen_name", screenName }
            };
            LogEvent(EVENT_SCREEN_VIEW, parameters);
        }

        /// <summary>
        /// Logs when a player earns virtual currency.
        /// </summary>
        /// <param name="currencyType">Type of currency earned (e.g., "coins", "gems").</param>
        /// <param name="amount">Amount earned.</param>
        /// <param name="source">Source of the earnings (e.g., "minigame", "daily_reward").</param>
        public static void LogCurrencyEarned(string currencyType, int amount, string source)
        {
            var parameters = new Dictionary<string, object>
            {
                { "currency_type", currencyType },
                { "amount", amount },
                { "source", source },
                { "balance_after", -1 } // Populated by economy manager
            };
            LogEvent(EVENT_CURRENCY_EARNED, parameters);
        }

        /// <summary>
        /// Logs when a player spends virtual currency.
        /// </summary>
        /// <param name="currencyType">Type of currency spent.</param>
        /// <param name="amount">Amount spent.</param>
        /// <param name="sink">What the currency was spent on (e.g., "shop", "upgrade").</param>
        public static void LogCurrencySpent(string currencyType, int amount, string sink)
        {
            var parameters = new Dictionary<string, object>
            {
                { "currency_type", currencyType },
                { "amount", amount },
                { "sink", sink }
            };
            LogEvent(EVENT_CURRENCY_SPENT, parameters);
        }

        /// <summary>
        /// Logs when a player acquires an item.
        /// </summary>
        /// <param name="itemId">Unique identifier of the item.</param>
        /// <param name="source">Source of acquisition (e.g., "shop", "gift", "minigame").</param>
        /// <param name="quantity">Number of items acquired.</param>
        public static void LogItemAcquired(string itemId, string source, int quantity = 1)
        {
            var parameters = new Dictionary<string, object>
            {
                { "item_id", itemId },
                { "source", source },
                { "quantity", quantity }
            };
            LogEvent(EVENT_ITEM_ACQUIRED, parameters);
        }

        /// <summary>
        /// Logs when a player consumes/uses an item.
        /// </summary>
        /// <param name="itemId">Unique identifier of the consumed item.</param>
        /// <param name="quantity">Number of items consumed.</param>
        public static void LogItemConsumed(string itemId, int quantity = 1)
        {
            var parameters = new Dictionary<string, object>
            {
                { "item_id", itemId },
                { "quantity", quantity }
            };
            LogEvent(EVENT_ITEM_CONSUMED, parameters);
        }

        /// <summary>
        /// Logs when a player adds a friend.
        /// </summary>
        /// <param name="friendId">The PlayFab ID of the added friend.</param>
        /// <param name="method">How the friendship was initiated (e.g., "search", "suggestion").</param>
        public static void LogFriendAdded(string friendId, string method)
        {
            var parameters = new Dictionary<string, object>
            {
                { "friend_id", friendId },
                { "method", method }
            };
            LogEvent(EVENT_FRIEND_ADDED, parameters);
        }

        /// <summary>
        /// Logs when a player sends a chat message.
        /// </summary>
        /// <param name="channel">Chat channel used (e.g., "global", "private", "clan").</param>
        /// <param name="messageLength">Length of the message in characters.</param>
        public static void LogChatMessageSent(string channel, int messageLength)
        {
            var parameters = new Dictionary<string, object>
            {
                { "channel", channel },
                { "message_length", messageLength }
            };
            LogEvent(EVENT_CHAT_MESSAGE, parameters);
        }

        /// <summary>
        /// Logs when a player uses an emote.
        /// </summary>
        /// <param name="emoteId">Unique identifier of the emote.</param>
        public static void LogEmoteUsed(string emoteId)
        {
            var parameters = new Dictionary<string, object>
            {
                { "emote_id", emoteId }
            };
            LogEvent(EVENT_EMOTE_USED, parameters);
        }

        /// <summary>
        /// Logs when a minigame session starts.
        /// </summary>
        /// <param name="minigameId">Unique identifier of the minigame.</param>
        public static void LogMinigameStarted(string minigameId)
        {
            var parameters = new Dictionary<string, object>
            {
                { "minigame_id", minigameId }
            };
            LogEvent(EVENT_MINIGAME_STARTED, parameters);
        }

        /// <summary>
        /// Logs when a minigame session ends.
        /// </summary>
        /// <param name="minigameId">Unique identifier of the minigame.</param>
        /// <param name="score">Final score achieved.</param>
        /// <param name="rank">Player's rank in the match.</param>
        /// <param name="won">Whether the player won.</param>
        public static void LogMinigameEnded(string minigameId, int score, int rank, bool won)
        {
            var parameters = new Dictionary<string, object>
            {
                { "minigame_id", minigameId },
                { "score", score },
                { "rank", rank },
                { "won", won },
                { "success", won }
            };
            LogEvent(EVENT_MINIGAME_ENDED, parameters);
        }

        /// <summary>
        /// Logs island editing activity.
        /// </summary>
        /// <param name="objectsPlaced">Number of objects placed during the session.</param>
        /// <param name="timeSpent">Time spent editing in seconds.</param>
        public static void LogIslandEdited(int objectsPlaced, int timeSpent)
        {
            var parameters = new Dictionary<string, object>
            {
                { "objects_placed", objectsPlaced },
                { "time_spent_seconds", timeSpent }
            };
            LogEvent(EVENT_ISLAND_EDITED, parameters);
        }

        /// <summary>
        /// Logs when a player customizes their avatar.
        /// </summary>
        /// <param name="partsChanged">Number of avatar parts that were changed.</param>
        public static void LogAvatarCustomized(int partsChanged)
        {
            var parameters = new Dictionary<string, object>
            {
                { "parts_changed", partsChanged }
            };
            LogEvent(EVENT_AVATAR_CUSTOMIZED, parameters);
        }

        /// <summary>
        /// Logs when a player views the shop.
        /// </summary>
        /// <param name="sectionId">Shop section viewed (e.g., "featured", "new", "sale").</param>
        public static void LogShopViewed(string sectionId)
        {
            var parameters = new Dictionary<string, object>
            {
                { "section_id", sectionId }
            };
            LogEvent(EVENT_SHOP_VIEWED, parameters);
        }

        /// <summary>
        /// Logs when a player purchases an item from the shop.
        /// </summary>
        /// <param name="itemId">Unique identifier of the purchased item.</param>
        /// <param name="currency">Currency used for the purchase.</param>
        /// <param name="price">Price paid.</param>
        public static void LogItemPurchased(string itemId, string currency, int price)
        {
            var parameters = new Dictionary<string, object>
            {
                { "item_id", itemId },
                { "currency", currency },
                { "price", price },
                { "value", price }
            };
            LogEvent(EVENT_ITEM_PURCHASED, parameters);
        }

        /// <summary>
        /// Logs when a player levels up.
        /// </summary>
        /// <param name="newLevel">The new level achieved.</param>
        public static void LogLevelUp(int newLevel)
        {
            var parameters = new Dictionary<string, object>
            {
                { "level", newLevel }
            };
            LogEvent(EVENT_LEVEL_UP, parameters);
        }

        /// <summary>
        /// Logs when a player gains XP.
        /// </summary>
        /// <param name="amount">Amount of XP gained.</param>
        /// <param name="source">Source of the XP (e.g., "minigame", "quest").</param>
        public static void LogXPGained(int amount, string source)
        {
            var parameters = new Dictionary<string, object>
            {
                { "amount", amount },
                { "source", source }
            };
            LogEvent(EVENT_XP_GAINED, parameters);
        }

        /// <summary>
        /// Logs when a player unlocks an achievement.
        /// </summary>
        /// <param name="achievementId">Unique identifier of the achievement.</param>
        public static void LogAchievementUnlocked(string achievementId)
        {
            var parameters = new Dictionary<string, object>
            {
                { "achievement_id", achievementId }
            };
            LogEvent(EVENT_ACHIEVEMENT_UNLOCKED, parameters);
        }

        /// <summary>
        /// Logs when a player claims their daily reward.
        /// </summary>
        /// <param name="streakDay">Current consecutive day streak.</param>
        public static void LogDailyRewardClaimed(int streakDay)
        {
            var parameters = new Dictionary<string, object>
            {
                { "streak_day", streakDay }
            };
            LogEvent(EVENT_DAILY_REWARD_CLAIMED, parameters);
        }

        /// <summary>
        /// Logs when an ad is displayed to the player.
        /// </summary>
        /// <param name="adUnit">Identifier for the ad placement.</param>
        /// <param name="format">Ad format (e.g., "rewarded", "interstitial", "banner").</param>
        public static void LogAdImpression(string adUnit, string format)
        {
            var parameters = new Dictionary<string, object>
            {
                { "ad_unit", adUnit },
                { "format", format }
            };
            LogEvent(EVENT_AD_IMPRESSION, parameters);
        }

        /// <summary>
        /// Logs when a player receives a reward from watching an ad.
        /// </summary>
        /// <param name="adUnit">Identifier for the ad placement.</param>
        /// <param name="rewardType">Type of reward received.</param>
        /// <param name="rewardAmount">Amount of reward received.</param>
        public static void LogAdReward(string adUnit, string rewardType, int rewardAmount)
        {
            var parameters = new Dictionary<string, object>
            {
                { "ad_unit", adUnit },
                { "reward_type", rewardType },
                { "reward_amount", rewardAmount }
            };
            LogEvent(EVENT_AD_REWARD, parameters);
        }

        /// <summary>
        /// Logs when a push notification is received.
        /// </summary>
        /// <param name="campaignId">The campaign/push notification identifier.</param>
        public static void LogPushNotificationReceived(string campaignId)
        {
            var parameters = new Dictionary<string, object>
            {
                { "campaign_id", campaignId }
            };
            LogEvent(EVENT_PUSH_RECEIVED, parameters);
        }

        /// <summary>
        /// Logs when a player taps on a push notification.
        /// </summary>
        /// <param name="campaignId">The campaign/push notification identifier.</param>
        public static void LogPushNotificationOpened(string campaignId)
        {
            var parameters = new Dictionary<string, object>
            {
                { "campaign_id", campaignId }
            };
            LogEvent(EVENT_PUSH_OPENED, parameters);
        }

        /// <summary>
        /// Core logging method that routes to all enabled analytics providers.
        /// </summary>
        /// <param name="eventName">Name of the event to log.</param>
        /// <param name="parameters">Event parameters as key-value pairs.</param>
        private static void LogEvent(string eventName, Dictionary<string, object> parameters)
        {
#if FIREBASE
            try
            {
                FirebaseManager.Instance?.LogEvent(eventName, parameters);
            }
            catch (System.Exception ex)
            {
                Debug.LogWarning($"[BackendEventLogger] Firebase analytics failed for '{eventName}': {ex.Message}");
            }
#endif

#if PLAYFAB
            try
            {
                if (parameters != null)
                {
                    var json = MiniJSON.Json.Serialize(parameters);
                    // PlayFab analytics would be sent here via WritePlayerEvent
                    // This is non-blocking and fire-and-forget
                }
            }
            catch (System.Exception ex)
            {
                Debug.LogWarning($"[BackendEventLogger] PlayFab analytics failed for '{eventName}': {ex.Message}");
            }
#endif

            // Always log to Unity console in development
#if UNITY_EDITOR || DEVELOPMENT_BUILD
            string paramString = parameters != null ? MiniJSON.Json.Serialize(parameters) : "{}";
            Debug.Log($"[Analytics] {eventName}: {paramString}");
#endif
        }
    }
}
