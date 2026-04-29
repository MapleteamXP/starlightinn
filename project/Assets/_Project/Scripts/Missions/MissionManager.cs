using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KawaiiCool.Missions
{
    /// <summary>
    /// Defines the frequency and lifecycle type of a mission.
    /// </summary>
    public enum MissionType { Daily, Weekly, Special, Tutorial, Achievement }

    /// <summary>
    /// Categorizes missions by the gameplay activity they encourage.
    /// </summary>
    public enum MissionCategory { Social, Explorer, Minigame, Creator, Trader, Collector }

    /// <summary>
    /// The in-game action that contributes progress toward a mission.
    /// </summary>
    public enum MissionTrigger
    {
        WaveToPlayers, AddFriend, SendMessage, VisitRoom, PlayMinigame,
        WinMinigame, UseEmote, JoinParty, TradeItem, DecorateRoom,
        ChangeOutfit, EarnBadge, Login, SpendTimeInGame, InviteFriend
    }

    /// <summary>
    /// Serializable container for tracking the runtime state of an active or completed mission.
    /// </summary>
    [System.Serializable]
    public class MissionProgress
    {
        public string MissionId;
        public int CurrentProgress;
        public bool IsComplete;
        public bool IsClaimed;
        public long CompletedTime;
        public int RepeatCount;
    }

    /// <summary>
    /// ScriptableObject definition for a mission template. Used to drive all mission content via data.
    /// </summary>
    [CreateAssetMenu(fileName = "Mission_", menuName = "KawaiiCool/Mission")]
    public class MissionData : ScriptableObject
    {
        public string MissionId;
        public string Title;
        public string Description;
        public MissionType Type;
        public MissionCategory Category;
        public MissionTrigger Trigger;
        public int TargetAmount;
        public int CurrentAmount;
        public List<RewardData> Rewards = new();
        public Sprite Icon;
        public bool IsPremium;
        public int MinLevel;
        public List<string> RequiredMissions = new();
        public string StartDate;
        public string EndDate;
        public bool IsRepeatable;
        public int MaxRepeats;
    }

    /// <summary>
    /// Serializable reward payload awarded when a mission is claimed.
    /// </summary>
    [System.Serializable]
    public class RewardData
    {
        public string RewardId;
        public RewardType RewardType;
        public int Amount;
        public string ItemId;
    }

    /// <summary>
    /// Supported reward types for mission completion.
    /// </summary>
    public enum RewardType { Coins, Gems, Experience, Item, Badge }

    /// <summary>
    /// Central mission orchestrator for KawaiiCool Island v3.0. Handles daily, weekly, special, and tutorial
    /// mission generation, progress tracking, completion, claiming, streak bonuses, and integration with
    /// <see cref="EventBus"/> for decoupled social action triggers.
    /// </summary>
    public class MissionManager : Singleton<MissionManager>
    {
        [Header("Daily Missions")]
        public List<MissionData> DailyMissions = new();
        public int DailyMissionCount = 3;
        public string LastDailyReset;

        [Header("Weekly Missions")]
        public List<MissionData> WeeklyMissions = new();
        public int WeeklyMissionCount = 5;
        public string LastWeeklyReset;

        [Header("Special Missions")]
        public List<MissionData> SpecialMissions = new();

        [Header("Progress")]
        public List<MissionProgress> ActiveMissions = new();
        public List<MissionProgress> CompletedMissions = new();

        [Header("Streak")]
        public int DailyCompletionStreak = 0;
        public int MaxStreak = 30;
        public float StreakBonusMultiplier = 0.1f;

        /// <summary>
        /// Invoked when any mission reaches completion criteria.
        /// </summary>
        public event Action<string> OnMissionCompleted;

        /// <summary>
        /// Invoked when a mission reward has been claimed.
        /// </summary>
        public event Action<string> OnMissionClaimed;

        /// <summary>
        /// Invoked when all daily missions for the current cycle are complete.
        /// </summary>
        public event Action OnAllDailyMissionsComplete;

        /// <summary>
        /// Invoked when the daily completion streak increases.
        /// </summary>
        public event Action OnStreakIncreased;

        private const string PREF_ACTIVE_MISSIONS = "Mission_Active";
        private const string PREF_COMPLETED_MISSIONS = "Mission_Completed";
        private const string PREF_LAST_DAILY_RESET = "Mission_LastDailyReset";
        private const string PREF_LAST_WEEKLY_RESET = "Mission_LastWeeklyReset";
        private const string PREF_DAILY_STREAK = "Mission_DailyStreak";

        private bool _initialized;
        private MissionGenerator _generator;

        /// <summary>
        /// Initializes the mission system, loads saved progress, subscribes to EventBus,
        /// and checks whether daily or weekly resets are needed.
        /// </summary>
        public void Initialize()
        {
            if (_initialized) return;
            _initialized = true;

            LoadMissionProgress();
            _generator = GetComponent<MissionGenerator>() ?? gameObject.AddComponent<MissionGenerator>();

            EventBus.Instance.Subscribe<MinigamePlayedEvent>(OnMinigamePlayed);
            EventBus.Instance.Subscribe<FriendAddedEvent>(OnFriendAdded);
            EventBus.Instance.Subscribe<MessageSentEvent>(OnMessageSent);
            EventBus.Instance.Subscribe<RoomVisitedEvent>(OnRoomVisited);
            EventBus.Instance.Subscribe<EmoteUsedEvent>(OnEmoteUsed);
            EventBus.Instance.Subscribe<PartyJoinedEvent>(OnPartyJoined);
            EventBus.Instance.Subscribe<ItemTradedEvent>(OnItemTraded);
            EventBus.Instance.Subscribe<OutfitChangedEvent>(OnOutfitChanged);
            EventBus.Instance.Subscribe<RoomDecoratedEvent>(OnRoomDecorated);
            EventBus.Instance.Subscribe<BadgeEarnedEvent>(OnBadgeEarned);
            EventBus.Instance.Subscribe<LoginEvent>(OnLogin);
            EventBus.Instance.Subscribe<WaveToPlayerEvent>(OnWaveToPlayer);

            CheckDailyReset();
            CheckWeeklyReset();
        }

        private void OnDestroy()
        {
            if (!_initialized) return;
            EventBus.Instance.Unsubscribe<MinigamePlayedEvent>(OnMinigamePlayed);
            EventBus.Instance.Unsubscribe<FriendAddedEvent>(OnFriendAdded);
            EventBus.Instance.Unsubscribe<MessageSentEvent>(OnMessageSent);
            EventBus.Instance.Unsubscribe<RoomVisitedEvent>(OnRoomVisited);
            EventBus.Instance.Unsubscribe<EmoteUsedEvent>(OnEmoteUsed);
            EventBus.Instance.Unsubscribe<PartyJoinedEvent>(OnPartyJoined);
            EventBus.Instance.Unsubscribe<ItemTradedEvent>(OnItemTraded);
            EventBus.Instance.Unsubscribe<OutfitChangedEvent>(OnOutfitChanged);
            EventBus.Instance.Unsubscribe<RoomDecoratedEvent>(OnRoomDecorated);
            EventBus.Instance.Unsubscribe<BadgeEarnedEvent>(OnBadgeEarned);
            EventBus.Instance.Unsubscribe<LoginEvent>(OnLogin);
            EventBus.Instance.Unsubscribe<WaveToPlayerEvent>(OnWaveToPlayer);
        }

        #region EventBus Handlers

        private void OnMinigamePlayed(MinigamePlayedEvent evt) => TrackMinigamePlayed(evt.MinigameId, evt.Won);
        private void OnFriendAdded(FriendAddedEvent evt) => TrackFriendAdded();
        private void OnMessageSent(MessageSentEvent evt) => TrackMessageSent();
        private void OnRoomVisited(RoomVisitedEvent evt) => TrackRoomVisit(evt.RoomId);
        private void OnEmoteUsed(EmoteUsedEvent evt) => TrackEmoteUsed();
        private void OnPartyJoined(PartyJoinedEvent evt) => TrackPartyJoined();
        private void OnItemTraded(ItemTradedEvent evt) => TrackItemTraded();
        private void OnOutfitChanged(OutfitChangedEvent evt) => TrackSocialAction(MissionTrigger.ChangeOutfit);
        private void OnRoomDecorated(RoomDecoratedEvent evt) => TrackSocialAction(MissionTrigger.DecorateRoom);
        private void OnBadgeEarned(BadgeEarnedEvent evt) => TrackSocialAction(MissionTrigger.EarnBadge);
        private void OnLogin(LoginEvent evt) => TrackSocialAction(MissionTrigger.Login);
        private void OnWaveToPlayer(WaveToPlayerEvent evt) => TrackSocialAction(MissionTrigger.WaveToPlayers);

        #endregion

        /// <summary>
        /// Generates a fresh set of daily missions, respecting the configured count and player level.
        /// </summary>
        public void GenerateDailyMissions()
        {
            var profile = PlayerPreferenceProfile.LoadCurrent();
            var missions = _generator.GenerateDailyMissions(profile);
            DailyMissions = missions;
            LastDailyReset = DateTime.UtcNow.ToString("O");

            foreach (var mission in missions)
            {
                if (!ActiveMissions.Any(m => m.MissionId == mission.MissionId))
                {
                    ActiveMissions.Add(new MissionProgress
                    {
                        MissionId = mission.MissionId,
                        CurrentProgress = 0,
                        IsComplete = false,
                        IsClaimed = false,
                        CompletedTime = 0,
                        RepeatCount = 0
                    });
                }
            }

            SaveMissionProgress();
            Debug.Log($"[MissionManager] Generated {missions.Count} daily missions.");
        }

        /// <summary>
        /// Generates a fresh set of weekly missions for the current cycle.
        /// </summary>
        public void GenerateWeeklyMissions()
        {
            var profile = PlayerPreferenceProfile.LoadCurrent();
            var missions = _generator.GenerateWeeklyMissions(profile);
            WeeklyMissions = missions;
            LastWeeklyReset = DateTime.UtcNow.ToString("O");

            foreach (var mission in missions)
            {
                if (!ActiveMissions.Any(m => m.MissionId == mission.MissionId))
                {
                    ActiveMissions.Add(new MissionProgress
                    {
                        MissionId = mission.MissionId,
                        CurrentProgress = 0,
                        IsComplete = false,
                        IsClaimed = false,
                        CompletedTime = 0,
                        RepeatCount = 0
                    });
                }
            }

            SaveMissionProgress();
            Debug.Log($"[MissionManager] Generated {missions.Count} weekly missions.");
        }

        /// <summary>
        /// Checks whether the specified mission is eligible for completion and marks it complete if so.
        /// </summary>
        /// <param name="missionId">The unique identifier of the mission to evaluate.</param>
        public void CheckMissionProgress(string missionId)
        {
            var progress = ActiveMissions.FirstOrDefault(m => m.MissionId == missionId);
            if (progress == null) return;

            var data = ResolveMissionData(missionId);
            if (data == null) return;

            if (progress.CurrentProgress >= data.TargetAmount && !progress.IsComplete)
            {
                CompleteMission(missionId);
            }
        }

        /// <summary>
        /// Applies a delta to a mission's progress and evaluates completion.
        /// </summary>
        /// <param name="missionId">The mission identifier.</param>
        /// <param name="delta">The amount to add (or subtract if negative).</param>
        public void UpdateMissionProgress(string missionId, int delta)
        {
            var progress = ActiveMissions.FirstOrDefault(m => m.MissionId == missionId);
            if (progress == null) return;

            progress.CurrentProgress = Mathf.Max(0, progress.CurrentProgress + delta);
            CheckMissionProgress(missionId);
            SaveMissionProgress();
        }

        /// <summary>
        /// Marks a mission as completed, moves it to the completed list, and fires completion events.
        /// </summary>
        /// <param name="missionId">The mission identifier.</param>
        public void CompleteMission(string missionId)
        {
            var progress = ActiveMissions.FirstOrDefault(m => m.MissionId == missionId);
            if (progress == null || progress.IsComplete) return;

            progress.IsComplete = true;
            progress.CompletedTime = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

            ActiveMissions.Remove(progress);
            CompletedMissions.Add(progress);

            OnMissionCompleted?.Invoke(missionId);
            PlayFabManager.Instance?.RecordMissionCompleted(missionId);

            Debug.Log($"[MissionManager] Mission completed: {missionId}");

            if (AreAllDailyMissionsComplete())
            {
                OnAllDailyMissionsComplete?.Invoke();
                IncrementStreak();
            }

            SaveMissionProgress();
        }

        /// <summary>
        /// Claims rewards for a completed mission and marks it as claimed.
        /// </summary>
        /// <param name="missionId">The mission identifier.</param>
        public void ClaimMissionReward(string missionId)
        {
            var progress = CompletedMissions.FirstOrDefault(m => m.MissionId == missionId);
            if (progress == null || progress.IsClaimed) return;

            var data = ResolveMissionData(missionId);
            if (data == null) return;

            progress.IsClaimed = true;

            int totalBonus = CalculateStreakBonus(0);
            foreach (var reward in data.Rewards)
            {
                int amount = reward.Amount + Mathf.RoundToInt(reward.Amount * totalBonus);
                DistributeReward(reward, amount);
            }

            OnMissionClaimed?.Invoke(missionId);
            PlayFabManager.Instance?.RecordMissionClaimed(missionId);
            SaveMissionProgress();
            Debug.Log($"[MissionManager] Rewards claimed for mission: {missionId}");
        }

        /// <summary>
        /// Determines if a mission is marked complete.
        /// </summary>
        public bool IsMissionComplete(string missionId)
        {
            return CompletedMissions.Any(m => m.MissionId == missionId && m.IsComplete);
        }

        /// <summary>
        /// Determines if a mission's rewards have already been claimed.
        /// </summary>
        public bool IsMissionClaimed(string missionId)
        {
            return CompletedMissions.Any(m => m.MissionId == missionId && m.IsClaimed);
        }

        /// <summary>
        /// Gets the current numeric progress for a mission.
        /// </summary>
        public int GetMissionProgress(string missionId)
        {
            var active = ActiveMissions.FirstOrDefault(m => m.MissionId == missionId);
            if (active != null) return active.CurrentProgress;
            var completed = CompletedMissions.FirstOrDefault(m => m.MissionId == missionId);
            return completed?.CurrentProgress ?? 0;
        }

        /// <summary>
        /// Gets the target amount required to complete a mission.
        /// </summary>
        public int GetMissionTarget(string missionId)
        {
            var data = ResolveMissionData(missionId);
            return data?.TargetAmount ?? 0;
        }

        /// <summary>
        /// Returns the normalized progress (0.0 - 1.0) for a mission.
        /// </summary>
        public float GetMissionProgressPercent(string missionId)
        {
            int target = GetMissionTarget(missionId);
            if (target <= 0) return 0f;
            return Mathf.Clamp01((float)GetMissionProgress(missionId) / target);
        }

        /// <summary>
        /// Retrieves all currently active daily missions.
        /// </summary>
        public List<MissionProgress> GetActiveDailyMissions()
        {
            var dailyIds = new HashSet<string>(DailyMissions.Select(d => d.MissionId));
            return ActiveMissions.Where(m => dailyIds.Contains(m.MissionId)).ToList();
        }

        /// <summary>
        /// Retrieves all currently active weekly missions.
        /// </summary>
        public List<MissionProgress> GetActiveWeeklyMissions()
        {
            var weeklyIds = new HashSet<string>(WeeklyMissions.Select(w => w.MissionId));
            return ActiveMissions.Where(m => weeklyIds.Contains(m.MissionId)).ToList();
        }

        /// <summary>
        /// Checks whether every daily mission for the current cycle has been completed.
        /// </summary>
        public bool AreAllDailyMissionsComplete()
        {
            var dailyIds = new HashSet<string>(DailyMissions.Select(d => d.MissionId));
            var activeDaily = ActiveMissions.Where(m => dailyIds.Contains(m.MissionId)).ToList();
            var completedDaily = CompletedMissions.Where(m => dailyIds.Contains(m.MissionId) && m.IsComplete).ToList();
            return activeDaily.Count == 0 && completedDaily.Count >= DailyMissions.Count && DailyMissions.Count > 0;
        }

        /// <summary>
        /// Evaluates whether a daily reset should occur based on server midnight boundary.
        /// </summary>
        public void CheckDailyReset()
        {
            if (string.IsNullOrEmpty(LastDailyReset))
            {
                GenerateDailyMissions();
                return;
            }

            var lastReset = DateTime.Parse(LastDailyReset);
            var now = DateTime.UtcNow;
            if ((now - lastReset).TotalHours >= 24)
            {
                ArchiveCompletedMissions();
                GenerateDailyMissions();
                Debug.Log("[MissionManager] Daily mission reset triggered.");
            }
        }

        /// <summary>
        /// Evaluates whether a weekly reset should occur (Monday 00:00 UTC).
        /// </summary>
        public void CheckWeeklyReset()
        {
            if (string.IsNullOrEmpty(LastWeeklyReset))
            {
                GenerateWeeklyMissions();
                return;
            }

            var lastReset = DateTime.Parse(LastWeeklyReset);
            var now = DateTime.UtcNow;
            if ((now - lastReset).TotalDays >= 7)
            {
                ArchiveCompletedMissions();
                GenerateWeeklyMissions();
                Debug.Log("[MissionManager] Weekly mission reset triggered.");
            }
        }

        /// <summary>
        /// Calculates the streak-scaled reward amount for a base reward value.
        /// </summary>
        /// <param name="baseReward">The base reward amount before streak bonus.</param>
        /// <returns>The bonus amount (not the total) to add to the base reward.</returns>
        public int CalculateStreakBonus(int baseReward)
        {
            int cappedStreak = Mathf.Min(DailyCompletionStreak, MaxStreak);
            float multiplier = cappedStreak * StreakBonusMultiplier;
            return Mathf.RoundToInt(baseReward * multiplier);
        }

        #region Social Action Tracking

        /// <summary>
        /// Generic social action tracker. Increments progress on all active missions that match the trigger.
        /// </summary>
        /// <param name="trigger">The action type to track.</param>
        /// <param name="count">The number of times the action occurred.</param>
        public void TrackSocialAction(MissionTrigger trigger, int count = 1)
        {
            foreach (var mission in ActiveMissions.ToList())
            {
                var data = ResolveMissionData(mission.MissionId);
                if (data != null && data.Trigger == trigger)
                {
                    UpdateMissionProgress(mission.MissionId, count);
                }
            }
        }

        /// <summary>
        /// Tracks a room visit across all active Explorer missions.
        /// </summary>
        public void TrackRoomVisit(string roomId)
        {
            foreach (var mission in ActiveMissions.ToList())
            {
                var data = ResolveMissionData(mission.MissionId);
                if (data != null && data.Trigger == MissionTrigger.VisitRoom)
                {
                    UpdateMissionProgress(mission.MissionId, 1);
                }
            }
        }

        /// <summary>
        /// Tracks a friend addition across all active Social missions.
        /// </summary>
        public void TrackFriendAdded()
        {
            TrackSocialAction(MissionTrigger.AddFriend, 1);
        }

        /// <summary>
        /// Tracks a message sent across all active Social missions.
        /// </summary>
        public void TrackMessageSent()
        {
            TrackSocialAction(MissionTrigger.SendMessage, 1);
        }

        /// <summary>
        /// Tracks a minigame session across all active Minigame missions.
        /// </summary>
        public void TrackMinigamePlayed(string minigameId, bool won)
        {
            TrackSocialAction(MissionTrigger.PlayMinigame, 1);
            if (won)
            {
                TrackSocialAction(MissionTrigger.WinMinigame, 1);
            }
        }

        /// <summary>
        /// Tracks an item trade across all active Trader missions.
        /// </summary>
        public void TrackItemTraded()
        {
            TrackSocialAction(MissionTrigger.TradeItem, 1);
        }

        /// <summary>
        /// Tracks an emote usage across all active Social missions.
        /// </summary>
        public void TrackEmoteUsed()
        {
            TrackSocialAction(MissionTrigger.UseEmote, 1);
        }

        /// <summary>
        /// Tracks a party join across all active Social missions.
        /// </summary>
        public void TrackPartyJoined()
        {
            TrackSocialAction(MissionTrigger.JoinParty, 1);
        }

        #endregion

        /// <summary>
        /// Archives old completed missions into a rotating history to keep runtime lists lean.
        /// </summary>
        private void ArchiveCompletedMissions()
        {
            const int maxHistory = 50;
            if (CompletedMissions.Count > maxHistory)
            {
                var toRemove = CompletedMissions.OrderBy(m => m.CompletedTime).Take(CompletedMissions.Count - maxHistory).ToList();
                foreach (var m in toRemove)
                    CompletedMissions.Remove(m);
            }
        }

        /// <summary>
        /// Increments the daily completion streak and caps it at <see cref="MaxStreak"/>.
        /// </summary>
        private void IncrementStreak()
        {
            DailyCompletionStreak = Mathf.Min(DailyCompletionStreak + 1, MaxStreak);
            OnStreakIncreased?.Invoke();
            SaveMissionProgress();
            Debug.Log($"[MissionManager] Streak increased to {DailyCompletionStreak}");
        }

        /// <summary>
        /// Resets the daily completion streak (e.g., on missed day).
        /// </summary>
        public void ResetStreak()
        {
            DailyCompletionStreak = 0;
            SaveMissionProgress();
            Debug.Log("[MissionManager] Streak reset.");
        }

        /// <summary>
        /// Selects a random mission from a filtered pool, excluding specified IDs.
        /// </summary>
        private MissionData SelectMissionFromPool(MissionType type, List<string> excludeIds)
        {
            List<MissionData> pool = type == MissionType.Daily
                ? _generator.DailyMissionPool
                : _generator.WeeklyMissionPool;

            if (pool == null || pool.Count == 0) return null;

            var filtered = pool.Where(m => !excludeIds.Contains(m.MissionId)).ToList();
            if (filtered.Count == 0) filtered = pool;

            int index = UnityEngine.Random.Range(0, filtered.Count);
            return filtered[index];
        }

        /// <summary>
        /// Persists active and completed mission progress, streak, and reset timestamps to PlayerPrefs.
        /// </summary>
        private void SaveMissionProgress()
        {
            string activeJson = JsonUtility.ToJson(new MissionProgressListWrapper { Items = ActiveMissions });
            string completedJson = JsonUtility.ToJson(new MissionProgressListWrapper { Items = CompletedMissions });

            PlayerPrefs.SetString(PREF_ACTIVE_MISSIONS, activeJson);
            PlayerPrefs.SetString(PREF_COMPLETED_MISSIONS, completedJson);
            PlayerPrefs.SetString(PREF_LAST_DAILY_RESET, LastDailyReset ?? "");
            PlayerPrefs.SetString(PREF_LAST_WEEKLY_RESET, LastWeeklyReset ?? "");
            PlayerPrefs.SetInt(PREF_DAILY_STREAK, DailyCompletionStreak);
            PlayerPrefs.Save();
        }

        /// <summary>
        /// Loads mission progress from PlayerPrefs. Safe to call even if no prior save exists.
        /// </summary>
        private void LoadMissionProgress()
        {
            if (PlayerPrefs.HasKey(PREF_ACTIVE_MISSIONS))
            {
                string activeJson = PlayerPrefs.GetString(PREF_ACTIVE_MISSIONS);
                var activeWrapper = JsonUtility.FromJson<MissionProgressListWrapper>(activeJson);
                if (activeWrapper?.Items != null)
                    ActiveMissions = activeWrapper.Items;
            }

            if (PlayerPrefs.HasKey(PREF_COMPLETED_MISSIONS))
            {
                string completedJson = PlayerPrefs.GetString(PREF_COMPLETED_MISSIONS);
                var completedWrapper = JsonUtility.FromJson<MissionProgressListWrapper>(completedJson);
                if (completedWrapper?.Items != null)
                    CompletedMissions = completedWrapper.Items;
            }

            LastDailyReset = PlayerPrefs.GetString(PREF_LAST_DAILY_RESET, "");
            LastWeeklyReset = PlayerPrefs.GetString(PREF_LAST_WEEKLY_RESET, "");
            DailyCompletionStreak = PlayerPrefs.GetInt(PREF_DAILY_STREAK, 0);
        }

        /// <summary>
        /// Resolves a <see cref="MissionData"/> reference from any of the current mission lists.
        /// </summary>
        private MissionData ResolveMissionData(string missionId)
        {
            var all = new List<MissionData>();
            all.AddRange(DailyMissions);
            all.AddRange(WeeklyMissions);
            all.AddRange(SpecialMissions);
            if (_generator != null)
            {
                all.AddRange(_generator.DailyMissionPool);
                all.AddRange(_generator.WeeklyMissionPool);
            }
            return all.FirstOrDefault(m => m.MissionId == missionId);
        }

        /// <summary>
        /// Distributes a resolved reward to the player's inventory or wallet.
        /// </summary>
        private void DistributeReward(RewardData reward, int amount)
        {
            switch (reward.RewardType)
            {
                case RewardType.Coins:
                    InventoryManager.Instance?.AddCurrency("coins", amount);
                    break;
                case RewardType.Gems:
                    InventoryManager.Instance?.AddCurrency("gems", amount);
                    break;
                case RewardType.Experience:
                    // ExperienceManager could be used here if available.
                    break;
                case RewardType.Item:
                    if (!string.IsNullOrEmpty(reward.ItemId))
                        InventoryManager.Instance?.AddItem(reward.ItemId, amount);
                    break;
                case RewardType.Badge:
                    BadgeManager.Instance?.AwardBadge(reward.ItemId);
                    break;
            }
        }

        [System.Serializable]
        private class MissionProgressListWrapper { public List<MissionProgress> Items = new(); }
    }

    #region EventBus Event Definitions

    public class MinigamePlayedEvent { public string MinigameId; public bool Won; }
    public class FriendAddedEvent { }
    public class MessageSentEvent { }
    public class RoomVisitedEvent { public string RoomId; }
    public class EmoteUsedEvent { }
    public class PartyJoinedEvent { }
    public class ItemTradedEvent { }
    public class OutfitChangedEvent { }
    public class RoomDecoratedEvent { }
    public class BadgeEarnedEvent { public string BadgeId; }
    public class LoginEvent { }
    public class WaveToPlayerEvent { }

    #endregion
}
