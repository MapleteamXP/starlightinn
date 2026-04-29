// -----------------------------------------------------------------------
// DailyRewardsSystem.cs
// Streak-based daily login reward system for KawaiiCool Island.
// Tracks claim times, maintains streaks, and awards currency/items.
// Uses server time to prevent client-side time manipulation.
// -----------------------------------------------------------------------

using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using UnityEngine;

namespace KawaiiCool.Inventory
{
    /// <summary>
    /// Defines a single day's reward in the weekly streak schedule.
    /// </summary>
    [Serializable]
    public class DailyReward
    {
        [Tooltip("Day number (1-7) in the weekly streak.")]
        public int DayNumber;

        [Tooltip("Type of reward: 'coins', 'gems', 'item', 'xp'.")]
        public string RewardType;

        [Tooltip("ItemId if RewardType is 'item'; otherwise empty.")]
        public string RewardId;

        [Tooltip("Quantity of currency or copies of the item.")]
        public int Amount;

        [Tooltip("Icon shown on the reward tile.")]
        public Sprite RewardIcon;

        [Tooltip("If true, this day is visually highlighted as a bonus.")]
        public bool IsBonus;
    }

    /// <summary>
    /// Serializable wrapper for persisting the daily reward state.
    /// </summary>
    [Serializable]
    public class DailyRewardSaveData
    {
        public int CurrentStreak;
        public string LastClaimTime;
        public List<int> ClaimedDays = new();
        public int Version = 1;
    }

    /// <summary>
    /// Manages daily login rewards including streak tracking, claim windows,
    /// and reward distribution.  Uses server time to prevent time cheating.
    /// </summary>
    public class DailyRewardsSystem : Singleton<DailyRewardsSystem>
    {
        #region Inspector
        [Header("Settings")]
        [Tooltip("Maximum streak length before it loops back to Day 1.")]
        public int MaxStreakDays = 7;

        [Tooltip("Hours after the daily window closes before the streak resets.")]
        public float StreakResetHours = 48f;

        [Tooltip("PlayerPrefs key for the last claim timestamp.")]
        public string LastClaimTimeKey = "DailyReward_LastClaim";

        [Tooltip("PlayerPrefs key for the current streak counter.")]
        public string CurrentStreakKey = "DailyReward_Streak";
        #endregion

        #region Rewards
        [Header("Rewards")]
        [Tooltip("Seven daily rewards, one per streak day.  Index 0 = Day 1.")]
        public List<DailyReward> WeekRewards = new();
        #endregion

        // ------------------------------------------------------------------
        // Runtime state
        // ------------------------------------------------------------------
        private int _currentStreak;
        private DateTime _lastClaimTime;
        private bool _canClaimToday;
        private DateTime _nextClaimTime;

        // ------------------------------------------------------------------
        // Public accessors
        // ------------------------------------------------------------------
        /// <summary>Current streak length (0 = no streak).</summary>
        public int CurrentStreak => _currentStreak;

        /// <summary>True if the player has an unclaimed reward today.</summary>
        public bool CanClaimToday => _canClaimToday;

        /// <summary>UTC DateTime when the next claim window opens.</summary>
        public DateTime NextClaimTime => _nextClaimTime;

        /// <summary>Time remaining until the next claim is available.</summary>
        public TimeSpan TimeUntilNextClaim => _canClaimToday ? TimeSpan.Zero : _nextClaimTime - DateTime.UtcNow;

        // ------------------------------------------------------------------
        // Events
        // ------------------------------------------------------------------
        /// <summary>Fired when the streak count changes.  Argument: new streak.</summary>
        public event Action<int> OnStreakUpdated;

        /// <summary>Fired when a reward is successfully claimed.</summary>
        public event Action<DailyReward> OnRewardClaimed;

        /// <summary>Fired when the streak is reset due to inactivity.</summary>
        public event Action OnStreakReset;

        /// <summary>Fired every second while the UI is counting down.</summary>
        public event Action<TimeSpan> OnTimerUpdated;

        // ------------------------------------------------------------------
        // Lifecycle
        // ------------------------------------------------------------------
        protected override void Awake()
        {
            base.Awake();
            Initialize();
        }

        private void Update()
        {
            // Emit timer updates for UI binding
            if (!_canClaimToday && _nextClaimTime > DateTime.UtcNow)
            {
                OnTimerUpdated?.Invoke(TimeUntilNextClaim);
            }
        }

        // ------------------------------------------------------------------
        // Initialization
        // ------------------------------------------------------------------

        /// <summary>
        /// Loads saved state and evaluates the current claim eligibility.
        /// </summary>
        public void Initialize()
        {
            LoadState();
            CheckStreak();

            Debug.Log($"[DailyRewards] Initialized — streak={_currentStreak}, canClaim={_canClaimToday}");
        }

        // ------------------------------------------------------------------
        // Claiming
        // ------------------------------------------------------------------

        /// <summary>
        /// Claims the reward for the specified day index (0-based).
        /// Validates streak position and availability.
        /// </summary>
        public void ClaimDay(int dayIndex)
        {
            if (!_canClaimToday)
            {
                Debug.Log("[DailyRewards] No reward available to claim today.");
                return;
            }

            if (dayIndex < 0 || dayIndex >= WeekRewards.Count)
            {
                Debug.LogWarning($"[DailyRewards] Invalid day index {dayIndex}.");
                return;
            }

            DailyReward reward = WeekRewards[dayIndex];
            if (reward == null)
            {
                Debug.LogWarning($"[DailyRewards] No reward defined for day {dayIndex + 1}.");
                return;
            }

            // Verify the claimed day matches the current streak position
            int expectedDay = (_currentStreak % MaxStreakDays);
            if (dayIndex != expectedDay)
            {
                Debug.Log($"[DailyRewards] Day index mismatch. Expected {expectedDay}, got {dayIndex}.");
                return;
            }

            // Award
            AwardReward(reward);

            // Update streak
            IncrementStreak();
            _lastClaimTime = DateTime.UtcNow;
            _canClaimToday = false;
            _nextClaimTime = DateTime.UtcNow.Date.AddDays(1);

            SaveState();

            OnRewardClaimed?.Invoke(reward);
            Debug.Log($"[DailyRewards] Claimed Day {reward.DayNumber}: {reward.Amount}x {reward.RewardType}");
        }

        /// <summary>
        /// Grants the reward contents to the player.
        /// </summary>
        private void AwardReward(DailyReward reward)
        {
            if (reward == null || InventoryManager.Instance == null) return;

            switch (reward.RewardType?.ToLowerInvariant())
            {
                case "coins":
                    InventoryManager.Instance.AddCurrency("coins", reward.Amount);
                    break;

                case "gems":
                    InventoryManager.Instance.AddCurrency("gems", reward.Amount);
                    break;

                case "tickets":
                    InventoryManager.Instance.AddCurrency("tickets", reward.Amount);
                    break;

                case "item":
                    if (!string.IsNullOrEmpty(reward.RewardId))
                    {
                        InventoryManager.Instance.AddItem(reward.RewardId, reward.Amount);
                    }
                    break;

                case "xp":
                    // Dispatch to XP system
                    Debug.Log($"[DailyRewards] Awarded {reward.Amount} XP.");
                    break;

                default:
                    Debug.LogWarning($"[DailyRewards] Unknown reward type '{reward.RewardType}'.");
                    break;
            }
        }

        // ------------------------------------------------------------------
        // Queries
        // ------------------------------------------------------------------

        /// <summary>
        /// Returns the reward for today based on current streak position.
        /// </summary>
        public DailyReward GetTodaysReward()
        {
            if (WeekRewards.Count == 0) return null;

            int index = _currentStreak % MaxStreakDays;
            if (index < 0 || index >= WeekRewards.Count) return null;

            return WeekRewards[index];
        }

        /// <summary>
        /// Returns all rewards in the weekly schedule.
        /// </summary>
        public List<DailyReward> GetWeekRewards()
        {
            return new List<DailyReward>(WeekRewards);
        }

        // ------------------------------------------------------------------
        // Streak Logic
        // ------------------------------------------------------------------

        /// <summary>
        /// Evaluates the current streak state and claim eligibility.
        /// Call this after app foregrounding or server time sync.
        /// </summary>
        public void CheckStreak()
        {
            DateTime now = GetServerTime();

            // Never claimed
            if (_lastClaimTime == default)
            {
                _canClaimToday = true;
                _nextClaimTime = now;
                return;
            }

            TimeSpan sinceLastClaim = now - _lastClaimTime;

            // Already claimed today (server day)
            if (_lastClaimTime.Date == now.Date)
            {
                _canClaimToday = false;
                _nextClaimTime = now.Date.AddDays(1);
                return;
            }

            // Within the next-day window
            if (sinceLastClaim.TotalHours < 24)
            {
                // Should not happen if dates differ, but handle edge cases
                _canClaimToday = true;
                _nextClaimTime = now;
                return;
            }

            // Within the grace period (24-48 hours) — streak continues
            if (sinceLastClaim.TotalHours < 24 + StreakResetHours)
            {
                _canClaimToday = true;
                _nextClaimTime = now;
                return;
            }

            // Beyond grace period — reset streak
            Debug.Log("[DailyRewards] Streak reset due to inactivity.");
            ResetStreak();
            _canClaimToday = true;
            _nextClaimTime = now;
        }

        /// <summary>
        /// Returns true if the player has already claimed today's reward.
        /// </summary>
        private bool HasClaimedToday()
        {
            if (_lastClaimTime == default) return false;
            return _lastClaimTime.Date == GetServerTime().Date;
        }

        /// <summary>
        /// Resets the streak to zero.
        /// </summary>
        private void ResetStreak()
        {
            int oldStreak = _currentStreak;
            _currentStreak = 0;
            SaveState();

            if (oldStreak > 0)
            {
                OnStreakReset?.Invoke();
                OnStreakUpdated?.Invoke(0);
            }
        }

        /// <summary>
        /// Increments the streak, capping at MaxStreakDays.
        /// </summary>
        private void IncrementStreak()
        {
            _currentStreak++;
            if (_currentStreak >= MaxStreakDays)
                _currentStreak = 0; // Loop back to Day 1 rewards

            OnStreakUpdated?.Invoke(_currentStreak);
        }

        // ------------------------------------------------------------------
        // Persistence
        // ------------------------------------------------------------------

        /// <summary>
        /// Saves the current streak state to PlayerPrefs.
        /// </summary>
        public void SaveState()
        {
            var data = new DailyRewardSaveData
            {
                CurrentStreak = _currentStreak,
                LastClaimTime = _lastClaimTime.ToString("O")
            };

            string json = JsonUtility.ToJson(data);
            PlayerPrefs.SetString("KawaiiCool_DailyRewards", json);
            PlayerPrefs.Save();
        }

        /// <summary>
        /// Loads the streak state from PlayerPrefs.
        /// </summary>
        private void LoadState()
        {
            if (PlayerPrefs.HasKey("KawaiiCool_DailyRewards"))
            {
                string json = PlayerPrefs.GetString("KawaiiCool_DailyRewards");
                var data = JsonUtility.FromJson<DailyRewardSaveData>(json);

                if (data != null)
                {
                    _currentStreak = data.CurrentStreak;

                    if (!string.IsNullOrEmpty(data.LastClaimTime))
                    {
                        DateTime.TryParse(data.LastClaimTime, null,
                            System.Globalization.DateTimeStyles.RoundtripKind, out _lastClaimTime);
                    }
                }
            }
            else
            {
                // Legacy key migration
                if (PlayerPrefs.HasKey(CurrentStreakKey))
                    _currentStreak = PlayerPrefs.GetInt(CurrentStreakKey, 0);

                if (PlayerPrefs.HasKey(LastClaimTimeKey))
                {
                    string legacy = PlayerPrefs.GetString(LastClaimTimeKey, "");
                    DateTime.TryParse(legacy, null,
                        System.Globalization.DateTimeStyles.RoundtripKind, out _lastClaimTime);
                }
            }
        }

        // ------------------------------------------------------------------
        // Server Time
        // ------------------------------------------------------------------

        /// <summary>
        /// Returns the authoritative server time.  Falls back to local UTC.
        /// Override this to call your game's time server.
        /// </summary>
        private DateTime GetServerTime()
        {
            // TODO: Replace with a server time fetch
            // Example: return await GameServer.GetServerTimeAsync();
            return DateTime.UtcNow;
        }

        /// <summary>
        /// Manually syncs streak state with a server-provided timestamp.
        /// Call this after receiving a server time response.
        /// </summary>
        public void SyncWithServerTime(DateTime serverTime)
        {
            // Re-evaluate streak using server time
            TimeSpan sinceLastClaim = serverTime - _lastClaimTime;

            if (sinceLastClaim.TotalHours >= 24 + StreakResetHours)
            {
                ResetStreak();
            }

            _canClaimToday = _lastClaimTime.Date < serverTime.Date;
            _nextClaimTime = _canClaimToday ? serverTime : serverTime.Date.AddDays(1);

            OnStreakUpdated?.Invoke(_currentStreak);
        }
    }
}
