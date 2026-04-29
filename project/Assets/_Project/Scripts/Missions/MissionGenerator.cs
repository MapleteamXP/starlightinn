using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KawaiiCool.Missions
{
    /// <summary>
    /// Lightweight player preference profile used to bias mission generation toward
    /// activities the player enjoys or features they have not yet explored.
    /// </summary>
    [System.Serializable]
    public class PlayerPreferenceProfile
    {
        public string PlayerId;
        public int PlayerLevel;
        public int SessionCount;
        public float TotalPlayTimeHours;
        public Dictionary<MissionCategory, float> CategoryAffinity = new();
        public List<string> CompletedMissionIds = new();
        public List<string> ExploredFeatures = new();
        public DateTime LastLogin;

        /// <summary>
        /// Loads the current local player profile from persisted state.
        /// </summary>
        public static PlayerPreferenceProfile LoadCurrent()
        {
            var profile = new PlayerPreferenceProfile
            {
                PlayerId = SystemInfo.deviceUniqueIdentifier,
                PlayerLevel = PlayerPrefs.GetInt("Player_Level", 1),
                SessionCount = PlayerPrefs.GetInt("Player_Sessions", 0),
                TotalPlayTimeHours = PlayerPrefs.GetFloat("Player_Hours", 0f),
                LastLogin = DateTime.UtcNow
            };

            string affinityJson = PlayerPrefs.GetString("Player_CategoryAffinity", "");
            if (!string.IsNullOrEmpty(affinityJson))
            {
                var pairs = affinityJson.Split(';');
                foreach (var pair in pairs)
                {
                    var kv = pair.Split('=');
                    if (kv.Length == 2 && Enum.TryParse<MissionCategory>(kv[0], out var cat))
                        profile.CategoryAffinity[cat] = float.Parse(kv[1]);
                }
            }

            string completedJson = PlayerPrefs.GetString("Player_CompletedMissions", "");
            profile.CompletedMissionIds = string.IsNullOrEmpty(completedJson)
                ? new List<string>()
                : completedJson.Split(',').ToList();

            string exploredJson = PlayerPrefs.GetString("Player_ExploredFeatures", "");
            profile.ExploredFeatures = string.IsNullOrEmpty(exploredJson)
                ? new List<string>()
                : exploredJson.Split(',').ToList();

            return profile;
        }

        /// <summary>
        /// Persists the profile to PlayerPrefs.
        /// </summary>
        public void Save()
        {
            PlayerPrefs.SetInt("Player_Level", PlayerLevel);
            PlayerPrefs.SetInt("Player_Sessions", SessionCount);
            PlayerPrefs.SetFloat("Player_Hours", TotalPlayTimeHours);
            PlayerPrefs.SetString("Player_CompletedMissions", string.Join(",", CompletedMissionIds));
            PlayerPrefs.SetString("Player_ExploredFeatures", string.Join(",", ExploredFeatures));

            var affinityParts = CategoryAffinity.Select(kv => $"{kv.Key}={kv.Value:F2}");
            PlayerPrefs.SetString("Player_CategoryAffinity", string.Join(";", affinityParts));
            PlayerPrefs.Save();
        }
    }

    /// <summary>
    /// Procedurally generates daily, weekly, tutorial, and comeback missions using
    /// player preference profiling. Biases selection toward preferred categories and
    /// unexplored features to maximize engagement and retention.
    /// </summary>
    public class MissionGenerator : MonoBehaviour
    {
        [Header("Pools")]
        public List<MissionData> DailyMissionPool = new();
        public List<MissionData> WeeklyMissionPool = new();
        public List<MissionData> SpecialMissionPool = new();

        [Header("Personalization")]
        public bool UsePersonalization = true;
        [Range(0f, 1f)]
        public float NewFeatureBias = 0.3f;
        [Range(0f, 1f)]
        public float CategoryAffinityWeight = 0.4f;

        [Header("Level Scaling")]
        public bool ScaleTargetsWithLevel = true;
        public float TargetMultiplierPerLevel = 0.1f;
        public int MaxTargetIncrease = 3;

        [Header("Tutorial")]
        public List<MissionData> TutorialMissions = new();

        /// <summary>
        /// Generates a personalized set of daily missions for the player.
        /// </summary>
        /// <param name="profile">The player's preference and history profile.</param>
        /// <returns>A filtered, scored, and deduplicated list of daily missions.</returns>
        public List<MissionData> GenerateDailyMissions(PlayerPreferenceProfile profile)
        {
            if (DailyMissionPool == null || DailyMissionPool.Count == 0)
            {
                Debug.LogWarning("[MissionGenerator] Daily mission pool is empty.");
                return new List<MissionData>();
            }

            int count = MissionManager.Instance?.DailyMissionCount ?? 3;
            var selected = SelectMissionsFromPool(DailyMissionPool, count, profile);
            return ScaleTargets(selected, profile);
        }

        /// <summary>
        /// Generates a personalized set of weekly missions for the player.
        /// </summary>
        /// <param name="profile">The player's preference and history profile.</param>
        /// <returns>A filtered, scored, and deduplicated list of weekly missions.</returns>
        public List<MissionData> GenerateWeeklyMissions(PlayerPreferenceProfile profile)
        {
            if (WeeklyMissionPool == null || WeeklyMissionPool.Count == 0)
            {
                Debug.LogWarning("[MissionGenerator] Weekly mission pool is empty.");
                return new List<MissionData>();
            }

            int count = MissionManager.Instance?.WeeklyMissionCount ?? 5;
            var selected = SelectMissionsFromPool(WeeklyMissionPool, count, profile);
            return ScaleTargets(selected, profile);
        }

        /// <summary>
        /// Generates a tutorial mission targeting a specific feature the player has not used.
        /// </summary>
        /// <param name="featureId">The feature identifier to build a tutorial around.</param>
        /// <returns>A cloned tutorial mission or null if none are available.</returns>
        public MissionData GenerateTutorialMission(string featureId)
        {
            var template = TutorialMissions.FirstOrDefault(m => m.MissionId.Contains(featureId));
            if (template == null) return null;
            return CloneMission(template);
        }

        /// <summary>
        /// Generates a comeback mission scaled to the length of the player's absence.
        /// </summary>
        /// <param name="daysAway">Number of days since the player's last session.</param>
        /// <returns>A comeback mission with scaled rewards.</returns>
        public MissionData GenerateComebackMission(int daysAway)
        {
            if (SpecialMissionPool == null || SpecialMissionPool.Count == 0) return null;

            var template = SpecialMissionPool.FirstOrDefault(m => m.Category == MissionCategory.Social);
            if (template == null) template = SpecialMissionPool[0];

            var mission = CloneMission(template);
            mission.Title = $"Welcome Back! ({daysAway} days)";
            mission.Description = "Reconnect with the island community after your break!";
            mission.TargetAmount = Mathf.Clamp(daysAway, 1, 7);

            foreach (var reward in mission.Rewards)
            {
                reward.Amount = Mathf.RoundToInt(reward.Amount * Mathf.Min(daysAway / 2f, 3f));
            }

            return mission;
        }

        /// <summary>
        /// Core selection algorithm. Scores all candidates, applies personalization bias,
        /// and selects the top N without duplicates.
        /// </summary>
        private List<MissionData> SelectMissionsFromPool(
            List<MissionData> pool, int count, PlayerPreferenceProfile profile)
        {
            if (!UsePersonalization)
            {
                return pool.OrderBy(_ => UnityEngine.Random.value).Take(count).Select(CloneMission).ToList();
            }

            var scored = new List<ScoredMission>();
            var excludeIds = new HashSet<string>(profile.CompletedMissionIds);
            var unusedFeatures = GetUnusedFeatures(profile);

            foreach (var mission in pool)
            {
                if (excludeIds.Contains(mission.MissionId) && !mission.IsRepeatable)
                    continue;

                float score = ScoreMissionForPlayer(mission, profile);

                // Boost for unexplored features.
                if (unusedFeatures.Any(f => mission.Description.Contains(f, StringComparison.OrdinalIgnoreCase)))
                    score += NewFeatureBias;

                scored.Add(new ScoredMission { Mission = mission, Score = score });
            }

            var selected = scored.OrderByDescending(s => s.Score)
                                 .ThenBy(_ => UnityEngine.Random.value)
                                 .Take(count)
                                 .Select(s => CloneMission(s.Mission))
                                 .ToList();
            return selected;
        }

        /// <summary>
        /// Computes a fitness score for a mission against a player profile.
        /// </summary>
        private float ScoreMissionForPlayer(MissionData mission, PlayerPreferenceProfile profile)
        {
            float score = UnityEngine.Random.Range(0f, 0.2f); // Base jitter.

            // Category affinity boost.
            if (profile.CategoryAffinity.TryGetValue(mission.Category, out float affinity))
                score += affinity * CategoryAffinityWeight;
            else
                score += 0.1f; // Slight preference for unexplored categories.

            // Level gate.
            if (profile.PlayerLevel < mission.MinLevel)
                score -= 1f;

            // Repeat penalty.
            if (profile.CompletedMissionIds.Contains(mission.MissionId))
                score -= mission.IsRepeatable ? 0.1f : 0.5f;

            // Premium missions only for high-engagement players (proxy heuristic).
            if (mission.IsPremium && profile.TotalPlayTimeHours < 5f)
                score -= 0.3f;

            // Prerequisite check.
            if (mission.RequiredMissions.Count > 0)
            {
                int prereqMet = mission.RequiredMissions.Count(id => profile.CompletedMissionIds.Contains(id));
                score += (prereqMet / (float)mission.RequiredMissions.Count) * 0.2f;
            }

            return score;
        }

        /// <summary>
        /// Returns features from the player's available set that they have not yet explored.
        /// </summary>
        private List<string> GetUnusedFeatures(PlayerPreferenceProfile profile)
        {
            var allFeatures = new[] { "Fishing", "Cooking", "RoomDecoration", "FashionShow",
                                      "MinigameArena", "TradingPost", "PartyPlanner" };
            return allFeatures.Where(f => !profile.ExploredFeatures.Contains(f)).ToList();
        }

        /// <summary>
        /// Scales mission targets based on player level to maintain challenge over time.
        /// </summary>
        private List<MissionData> ScaleTargets(List<MissionData> missions, PlayerPreferenceProfile profile)
        {
            if (!ScaleTargetsWithLevel) return missions;

            int levelBonus = Mathf.Min(profile.PlayerLevel, MaxTargetIncrease);
            foreach (var mission in missions)
            {
                float multiplier = 1f + (levelBonus * TargetMultiplierPerLevel);
                mission.TargetAmount = Mathf.RoundToInt(mission.TargetAmount * multiplier);
            }
            return missions;
        }

        /// <summary>
        /// Creates a deep-ish clone of a ScriptableObject mission template for runtime mutation.
        /// </summary>
        private MissionData CloneMission(MissionData original)
        {
            var clone = ScriptableObject.CreateInstance<MissionData>();
            clone.MissionId = original.MissionId;
            clone.Title = original.Title;
            clone.Description = original.Description;
            clone.Type = original.Type;
            clone.Category = original.Category;
            clone.Trigger = original.Trigger;
            clone.TargetAmount = original.TargetAmount;
            clone.CurrentAmount = 0;
            clone.Icon = original.Icon;
            clone.IsPremium = original.IsPremium;
            clone.MinLevel = original.MinLevel;
            clone.StartDate = original.StartDate;
            clone.EndDate = original.EndDate;
            clone.IsRepeatable = original.IsRepeatable;
            clone.MaxRepeats = original.MaxRepeats;
            clone.RequiredMissions = new List<string>(original.RequiredMissions);
            clone.Rewards = original.Rewards.Select(r => new RewardData
            {
                RewardId = r.RewardId,
                RewardType = r.RewardType,
                Amount = r.Amount,
                ItemId = r.ItemId
            }).ToList();
            return clone;
        }

        private class ScoredMission
        {
            public MissionData Mission;
            public float Score;
        }
    }
}
