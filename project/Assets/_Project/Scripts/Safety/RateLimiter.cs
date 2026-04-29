using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KawaiiCool.Safety
{
    /// <summary>
    /// Enumerates all rate-limited action categories for telemetry and logging.
    /// </summary>
    public enum RateLimitedAction
    {
        Message,
        FriendRequest,
        TradeRequest,
        RoomChange,
        Whisper,
        Emote,
        LoginAttempt,
        ReportSubmission,
        ProfileUpdate,
        Purchase,
        InventoryAction
    }

    /// <summary>
    /// Client-enforced rate limiter with configurable windows per action type.
    /// All limits are synchronised with <see cref="ServerValidator" /> on the backend for authoritative enforcement.
    /// </summary>
    public class RateLimiter : Singleton<RateLimiter>
    {
        #region Inspector Settings

        [Header("Limits")]
        [Tooltip("Seconds a player must wait between friend requests.")]
        public float FriendRequestCooldown = 60f;

        [Tooltip("Seconds a player must wait between trade requests.")]
        public float TradeRequestCooldown = 60f;

        [Tooltip("Maximum public chat messages allowed within a 10-second window.")]
        public int MaxMessagesPer10Seconds = 5;

        [Tooltip("Maximum public chat messages allowed within a 60-second window.")]
        public int MaxMessagesPerMinute = 20;

        [Tooltip("Maximum emote animations triggered within a 10-second window.")]
        public int MaxEmotesPer10Seconds = 10;

        [Tooltip("Maximum room changes (teleports, joins) within a 60-second window.")]
        public int MaxRoomChangesPerMinute = 5;

        [Tooltip("Maximum failed or successful login attempts per 5-minute window.")]
        public int MaxLoginAttemptsPer5Minutes = 5;

        [Tooltip("Seconds a player must wait between whisper/direct messages to different recipients.")]
        public float WhisperCooldown = 3f;

        [Tooltip("Maximum outbound friend requests within a 60-minute window.")]
        public int MaxFriendRequestsPerHour = 10;

        [Tooltip("Maximum outbound trade requests within a 60-minute window.")]
        public int MaxTradeRequestsPerHour = 10;

        [Header("Burst Limits")]
        [Tooltip("Maximum consecutive identical messages before hard throttle.")]
        public int MaxIdenticalMessagesPerWindow = 3;

        [Tooltip("Window for identical-message burst detection in seconds.")]
        public float IdenticalMessageWindowSeconds = 30f;

        [Header("Advanced")]
        [Tooltip("How often (in seconds) stale timestamps are purged from memory.")]
        public float CleanupIntervalSeconds = 60f;

        [Tooltip("Maximum entries per action type before forced cleanup to prevent memory bloat.")]
        public int MaxEntriesPerAction = 500;

        [Tooltip("If true, exceeding a limit publishes an event to EventBus for telemetry.")]
        public bool PublishEvents = true;

        [Tooltip("If true, prints verbose debug logs for rate-limit denials.")]
        public bool DebugLogging = false;

        #endregion

        #region Internal State

        /// <summary>
        /// Timestamp history keyed by "actionType:playerId".
        /// </summary>
        private Dictionary<string, List<float>> _actionTimestamps = new Dictionary<string, List<float>>();

        /// <summary>
        /// Per-player last-whisper-target tracking to prevent whisper spam to multiple targets.
        /// </summary>
        private Dictionary<string, string> _lastWhisperTarget = new Dictionary<string, string>();

        /// <summary>
        /// Last time the cleanup coroutine ran.
        /// </summary>
        private float _lastCleanupTime;

        /// <summary>
        /// Runtime lock to make the limiter thread-safe if accessed from background threads.
        /// </summary>
        private readonly object _lock = new object();

        #endregion

        #region Unity Lifecycle

        protected override void Awake()
        {
            base.Awake();
            _lastCleanupTime = Time.realtimeSinceStartup;
        }

        private void Update()
        {
            if (Time.realtimeSinceStartup - _lastCleanupTime >= CleanupIntervalSeconds)
            {
                CleanupOldTimestamps();
                _lastCleanupTime = Time.realtimeSinceStartup;
            }
        }

        #endregion

        #region Public API — Generic

        /// <summary>
        /// Determines whether the specified player may perform an action at this moment.
        /// </summary>
        /// <param name="actionType">A unique identifier for the action category (e.g. "whisper", "emote").</param>
        /// <param name="playerId">The authenticated player identifier.</param>
        /// <returns><c>true</c> if the action is permitted; otherwise <c>false</c>.</returns>
        public bool CanPerformAction(string actionType, string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return false;
            if (string.IsNullOrEmpty(actionType)) return true;

            lock (_lock)
            {
                string key = BuildKey(actionType, playerId);
                if (!_actionTimestamps.TryGetValue(key, out var timestamps))
                    return true;

                float now = Time.realtimeSinceStartup;
                float window = GetWindowForAction(actionType);
                int maxCount = GetMaxCountForAction(actionType);

                int countInWindow = timestamps.Count(t => now - t <= window);
                return countInWindow < maxCount;
            }
        }

        /// <summary>
        /// Records that the player has just performed an action, advancing their rate-limit counter.
        /// </summary>
        /// <param name="actionType">Action category identifier.</param>
        /// <param name="playerId">The player identifier.</param>
        public void RecordAction(string actionType, string playerId)
        {
            if (string.IsNullOrEmpty(playerId) || string.IsNullOrEmpty(actionType)) return;

            lock (_lock)
            {
                string key = BuildKey(actionType, playerId);
                if (!_actionTimestamps.TryGetValue(key, out var timestamps))
                {
                    timestamps = new List<float>();
                    _actionTimestamps[key] = timestamps;
                }

                timestamps.Add(Time.realtimeSinceStartup);

                if (timestamps.Count > MaxEntriesPerAction)
                {
                    float cutoff = Time.realtimeSinceStartup - GetWindowForAction(actionType) * 2f;
                    timestamps.RemoveAll(t => t < cutoff);
                }
            }

            if (PublishEvents)
            {
                EventBus.Publish(new RateLimitActionRecordedEvent(actionType, playerId, Time.realtimeSinceStartup));
            }
        }

        /// <summary>
        /// Returns the remaining cooldown in seconds before the player may perform the action again.
        /// </summary>
        /// <param name="actionType">Action category identifier.</param>
        /// <param name="playerId">The player identifier.</param>
        /// <returns>Seconds remaining; 0 if no cooldown is active.</returns>
        public float GetRemainingCooldown(string actionType, string playerId)
        {
            if (string.IsNullOrEmpty(playerId) || string.IsNullOrEmpty(actionType)) return 0f;

            lock (_lock)
            {
                string key = BuildKey(actionType, playerId);
                if (!_actionTimestamps.TryGetValue(key, out var timestamps) || timestamps.Count == 0)
                    return 0f;

                float now = Time.realtimeSinceStartup;
                float window = GetWindowForAction(actionType);
                int maxCount = GetMaxCountForAction(actionType);
                float oldestAllowed = now - window;

                var relevant = timestamps.Where(t => t >= oldestAllowed).OrderBy(t => t).ToList();
                if (relevant.Count < maxCount) return 0f;

                int indexToExpire = relevant.Count - maxCount;
                if (indexToExpire < 0) return 0f;

                float expiryTime = relevant[indexToExpire] + window;
                return Mathf.Max(0f, expiryTime - now);
            }
        }

        /// <summary>
        /// Builds a human-readable cooldown message suitable for UI display.
        /// </summary>
        /// <param name="actionType">Action category identifier.</param>
        /// <param name="remaining">Seconds remaining on cooldown.</param>
        /// <returns>Localised cooldown message string.</returns>
        public string GetCooldownMessage(string actionType, float remaining)
        {
            if (remaining <= 0f)
                return string.Empty;

            string friendlyName = GetFriendlyActionName(actionType);
            int seconds = Mathf.CeilToInt(remaining);

            if (seconds >= 60)
            {
                int minutes = seconds / 60;
                int secs = seconds % 60;
                if (secs > 0)
                    return $"{friendlyName} is rate-limited. Please wait {minutes}m {secs}s.";
                return $"{friendlyName} is rate-limited. Please wait {minutes} minute(s).";
            }

            return $"{friendlyName} is rate-limited. Please wait {seconds} second(s).";
        }

        /// <summary>
        /// Resets every tracked limit for a single player (e.g. after moderation action or logout).
        /// </summary>
        /// <param name="playerId">The player identifier.</param>
        public void ResetLimits(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return;

            lock (_lock)
            {
                var keysToRemove = _actionTimestamps.Keys.Where(k => k.EndsWith($":{playerId}")).ToList();
                foreach (var key in keysToRemove)
                    _actionTimestamps.Remove(key);

                _lastWhisperTarget.Remove(playerId);
            }

            if (DebugLogging)
                Debug.Log($"[RateLimiter] All limits reset for player {playerId}");
        }

        /// <summary>
        /// Resets rate-limit data for every player. Use with caution (e.g. during server restart).
        /// </summary>
        public void ResetAllLimits()
        {
            lock (_lock)
            {
                _actionTimestamps.Clear();
                _lastWhisperTarget.Clear();
            }

            if (DebugLogging)
                Debug.Log("[RateLimiter] All limits reset globally.");
        }

        #endregion

        #region Public API — Specific Checks

        /// <summary>
        /// Checks if a player may send a public chat message right now.
        /// Evaluates both the 10-second and 1-minute message windows.
        /// </summary>
        /// <param name="playerId">The player identifier.</param>
        /// <returns><c>true</c> if messaging is permitted.</returns>
        public bool CanSendMessage(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return false;

            lock (_lock)
            {
                float now = Time.realtimeSinceStartup;

                if (!CheckLimitInternal("message_10s", playerId, MaxMessagesPer10Seconds, 10f, now))
                    return false;
                if (!CheckLimitInternal("message_1m", playerId, MaxMessagesPerMinute, 60f, now))
                    return false;

                return true;
            }
        }

        /// <summary>
        /// Records a sent message for both 10-second and 1-minute tracking windows.
        /// </summary>
        /// <param name="playerId">The player identifier.</param>
        public void RecordMessageSent(string playerId)
        {
            RecordAction("message_10s", playerId);
            RecordAction("message_1m", playerId);
        }

        /// <summary>
        /// Checks if a player may send a friend request right now.
        /// </summary>
        /// <param name="playerId">The player identifier.</param>
        /// <returns><c>true</c> if permitted.</returns>
        public bool CanSendFriendRequest(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return false;
            float remaining = GetRemainingCooldown("friend_request", playerId);
            if (remaining > 0f) return false;
            return CheckLimit("friend_request_hourly", playerId, MaxFriendRequestsPerHour, 3600f);
        }

        /// <summary>
        /// Records a friend request in both cooldown and hourly quota trackers.
        /// </summary>
        /// <param name="playerId">The player identifier.</param>
        public void RecordFriendRequestSent(string playerId)
        {
            RecordAction("friend_request", playerId);
            RecordAction("friend_request_hourly", playerId);
        }

        /// <summary>
        /// Checks if a player may send a trade request right now.
        /// </summary>
        /// <param name="playerId">The player identifier.</param>
        /// <returns><c>true</c> if permitted.</returns>
        public bool CanSendTradeRequest(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return false;
            float remaining = GetRemainingCooldown("trade_request", playerId);
            if (remaining > 0f) return false;
            return CheckLimit("trade_request_hourly", playerId, MaxTradeRequestsPerHour, 3600f);
        }

        /// <summary>
        /// Records a trade request in both cooldown and hourly quota trackers.
        /// </summary>
        /// <param name="playerId">The player identifier.</param>
        public void RecordTradeRequestSent(string playerId)
        {
            RecordAction("trade_request", playerId);
            RecordAction("trade_request_hourly", playerId);
        }

        /// <summary>
        /// Checks if a player may change rooms right now.
        /// </summary>
        /// <param name="playerId">The player identifier.</param>
        /// <returns><c>true</c> if permitted.</returns>
        public bool CanChangeRoom(string playerId)
        {
            return CheckLimit("room_change", playerId, MaxRoomChangesPerMinute, 60f);
        }

        /// <summary>
        /// Checks if a player may send a whisper/direct message right now.
        /// </summary>
        /// <param name="playerId">The player identifier.</param>
        /// <param name="targetId">The intended recipient identifier.</param>
        /// <returns><c>true</c> if permitted.</returns>
        public bool CanSendWhisper(string playerId, string targetId)
        {
            if (string.IsNullOrEmpty(playerId) || string.IsNullOrEmpty(targetId)) return false;

            lock (_lock)
            {
                if (_lastWhisperTarget.TryGetValue(playerId, out string lastTarget) && lastTarget != targetId)
                {
                    float remaining = GetRemainingCooldown("whisper", playerId);
                    if (remaining > 0f)
                        return false;
                }

                return CheckLimitInternal("whisper", playerId, 1, WhisperCooldown, Time.realtimeSinceStartup);
            }
        }

        /// <summary>
        /// Records a whisper/direct message for cooldown tracking.
        /// </summary>
        /// <param name="playerId">The sender identifier.</param>
        /// <param name="targetId">The recipient identifier.</param>
        public void RecordWhisperSent(string playerId, string targetId)
        {
            RecordAction("whisper", playerId);
            lock (_lock)
            {
                _lastWhisperTarget[playerId] = targetId;
            }
        }

        /// <summary>
        /// Checks if a player may trigger an emote animation right now.
        /// </summary>
        /// <param name="playerId">The player identifier.</param>
        /// <returns><c>true</c> if permitted.</returns>
        public bool CanUseEmote(string playerId)
        {
            return CheckLimit("emote", playerId, MaxEmotesPer10Seconds, 10f);
        }

        /// <summary>
        /// Checks if a player may attempt login (or token refresh) right now.
        /// </summary>
        /// <param name="playerId">The player identifier.</param>
        /// <returns><c>true</c> if permitted.</returns>
        public bool CanAttemptLogin(string playerId)
        {
            return CheckLimit("login_attempt", playerId, MaxLoginAttemptsPer5Minutes, 300f);
        }

        /// <summary>
        /// Returns a summary of current utilisation for every tracked action type.
        /// </summary>
        /// <param name="playerId">The player identifier.</param>
        /// <returns>Dictionary mapping action type to current usage and limit.</returns>
        public Dictionary<string, (int current, int limit, float remaining)> GetPlayerLimitSummary(string playerId)
        {
            var result = new Dictionary<string, (int, int, float)>();
            if (string.IsNullOrEmpty(playerId)) return result;

            lock (_lock)
            {
                float now = Time.realtimeSinceStartup;
                foreach (var kvp in _actionTimestamps)
                {
                    if (!kvp.Key.EndsWith($":{playerId}")) continue;

                    string actionType = kvp.Key.Split(':')[0];
                    float window = GetWindowForAction(actionType);
                    int limit = GetMaxCountForAction(actionType);
                    int current = kvp.Value.Count(t => now - t <= window);
                    float remaining = GetRemainingCooldown(actionType, playerId);

                    result[actionType] = (current, limit, remaining);
                }
            }

            return result;
        }

        #endregion

        #region Private Helpers

        /// <summary>
        /// Checks a generic sliding-window limit for the given player.
        /// </summary>
        private bool CheckLimit(string actionType, string playerId, int maxCount, float windowSeconds)
        {
            if (string.IsNullOrEmpty(playerId) || string.IsNullOrEmpty(actionType)) return false;

            lock (_lock)
            {
                return CheckLimitInternal(actionType, playerId, maxCount, windowSeconds, Time.realtimeSinceStartup);
            }
        }

        /// <summary>
        /// Internal limit check that assumes the caller already holds <see cref="_lock"/>.
        /// </summary>
        private bool CheckLimitInternal(string actionType, string playerId, int maxCount, float windowSeconds, float now)
        {
            string key = BuildKey(actionType, playerId);
            if (!_actionTimestamps.TryGetValue(key, out var timestamps))
                return true;

            int countInWindow = timestamps.Count(t => now - t <= windowSeconds);
            bool allowed = countInWindow < maxCount;

            if (!allowed && DebugLogging)
            {
                Debug.LogWarning($"[RateLimiter] Blocked {actionType} for player {playerId} " +
                                 $"({countInWindow}/{maxCount} in {windowSeconds}s window).");
            }

            return allowed;
        }

        /// <summary>
        /// Removes timestamps older than the relevant action window to cap memory usage.
        /// </summary>
        private void CleanupOldTimestamps()
        {
            lock (_lock)
            {
                float now = Time.realtimeSinceStartup;
                var keysToRemove = new List<string>();

                foreach (var kvp in _actionTimestamps)
                {
                    string actionType = kvp.Key.Split(':')[0];
                    float window = GetWindowForAction(actionType) * 2f; // safety margin
                    kvp.Value.RemoveAll(t => now - t > window);

                    if (kvp.Value.Count == 0)
                        keysToRemove.Add(kvp.Key);
                }

                foreach (var key in keysToRemove)
                    _actionTimestamps.Remove(key);
            }

            if (DebugLogging)
                Debug.Log($"[RateLimiter] Cleanup complete. Active keys: {_actionTimestamps.Count}");
        }

        /// <summary>
        /// Composes the composite dictionary key for an action/player pair.
        /// </summary>
        private string BuildKey(string actionType, string playerId)
        {
            return $"{actionType}:{playerId}";
        }

        /// <summary>
        /// Resolves a default look-back window for an arbitrary action type string.
        /// </summary>
        private float GetWindowForAction(string actionType)
        {
            switch (actionType.ToLowerInvariant())
            {
                case "friend_request": return FriendRequestCooldown;
                case "trade_request": return TradeRequestCooldown;
                case "message_10s": return 10f;
                case "message_1m": return 60f;
                case "emote": return 10f;
                case "room_change": return 60f;
                case "login_attempt": return 300f;
                case "whisper": return WhisperCooldown;
                case "friend_request_hourly": return 3600f;
                case "trade_request_hourly": return 3600f;
                case "report": return 60f;
                default: return 60f;
            }
        }

        /// <summary>
        /// Resolves a default maximum count for an arbitrary action type string.
        /// </summary>
        private int GetMaxCountForAction(string actionType)
        {
            switch (actionType.ToLowerInvariant())
            {
                case "friend_request": return 1;
                case "trade_request": return 1;
                case "message_10s": return MaxMessagesPer10Seconds;
                case "message_1m": return MaxMessagesPerMinute;
                case "emote": return MaxEmotesPer10Seconds;
                case "room_change": return MaxRoomChangesPerMinute;
                case "login_attempt": return MaxLoginAttemptsPer5Minutes;
                case "whisper": return 1;
                case "friend_request_hourly": return MaxFriendRequestsPerHour;
                case "trade_request_hourly": return MaxTradeRequestsPerHour;
                case "report": return 3;
                default: return 10;
            }
        }

        /// <summary>
        /// Returns a human-friendly display name for an action type.
        /// </summary>
        private string GetFriendlyActionName(string actionType)
        {
            switch (actionType.ToLowerInvariant())
            {
                case "friend_request": return "Friend request";
                case "trade_request": return "Trade request";
                case "message_10s":
                case "message_1m": return "Chat message";
                case "emote": return "Emote";
                case "room_change": return "Room change";
                case "login_attempt": return "Login attempt";
                case "whisper": return "Whisper";
                case "report": return "Report";
                default: return "Action";
            }
        }

        #endregion

        #region Events

        /// <summary>
        /// Published whenever a rate-limited action is recorded.
        /// </summary>
        public struct RateLimitActionRecordedEvent
        {
            public readonly string ActionType;
            public readonly string PlayerId;
            public readonly float Timestamp;

            public RateLimitActionRecordedEvent(string actionType, string playerId, float timestamp)
            {
                ActionType = actionType;
                PlayerId = playerId;
                Timestamp = timestamp;
            }
        }

        #endregion
    }
}
