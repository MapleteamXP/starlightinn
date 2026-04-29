using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KawaiiCool.Missions
{
    /// <summary>
    /// Tracks player engagement patterns over time, computes a churn risk score, and triggers
    /// retention interventions such as come-back bonuses and feature suggestions.
    /// Designed to integrate with <see cref="MissionManager"/> and backend analytics.
    /// </summary>
    public class RetentionTracker : Singleton<RetentionTracker>
    {
        [Header("Metrics")]
        public int DaysSinceFirstPlay;
        public int DaysSinceLastPlay;
        public int TotalSessions;
        public float TotalPlayTimeHours;
        public float AvgSessionLength;
        public int FeaturesUsedCount;
        public List<string> FeaturesUsed = new();

        [Header("Churn Prediction")]
        [Range(0f, 1f)]
        public float ChurnRiskScore;
        public bool IsAtRisk => ChurnRiskScore > 0.7f;

        [Header("Interventions")]
        public bool ShowComeBackBonus = false;
        public bool ShowFeaturePrompt = false;
        public string SuggestedFeature;

        [Header("Configuration")]
        public float ComeBackBonusThresholdDays = 3f;
        public int ComeBackBonusCoins = 500;
        public int ComeBackBonusGems = 25;
        public List<string> AvailableFeatures = new()
        {
            "Fishing", "Cooking", "RoomDecoration", "FashionShow", "MinigameArena", "TradingPost", "PartyPlanner"
        };

        /// <summary>
        /// Fired when a come-back bonus is awarded after an extended absence.
        /// </summary>
        public event Action OnComeBackBonusAwarded;

        /// <summary>
        /// Fired when an unexplored feature is suggested to re-engage the player.
        /// </summary>
        public event Action<string> OnFeatureSuggested;

        private DateTime _sessionStart;
        private const string PREF_FIRST_PLAY = "Retention_FirstPlay";
        private const string PREF_LAST_PLAY = "Retention_LastPlay";
        private const string PREF_TOTAL_SESSIONS = "Retention_TotalSessions";
        private const string PREF_TOTAL_HOURS = "Retention_TotalHours";
        private const string PREF_FEATURES_USED = "Retention_FeaturesUsed";
        private const string PREF_HAS_HAD_INTERVENTION = "Retention_HadIntervention";

        private void Start()
        {
            LoadMetrics();
            RecordSessionStart();
            CalculateChurnRisk();
            TriggerRetentionIntervention();
        }

        private void OnApplicationPause(bool pause)
        {
            if (pause)
            {
                RecordSessionEnd();
                SaveMetrics();
            }
            else
            {
                RecordSessionStart();
            }
        }

        private void OnApplicationQuit()
        {
            RecordSessionEnd();
            SaveMetrics();
        }

        /// <summary>
        /// Records the start of a play session and updates lifetime session count.
        /// </summary>
        public void RecordSessionStart()
        {
            _sessionStart = DateTime.UtcNow;
            TotalSessions++;

            if (DaysSinceFirstPlay == 0)
            {
                string firstPlayStr = PlayerPrefs.GetString(PREF_FIRST_PLAY, "");
                if (string.IsNullOrEmpty(firstPlayStr))
                {
                    PlayerPrefs.SetString(PREF_FIRST_PLAY, DateTime.UtcNow.ToString("O"));
                    DaysSinceFirstPlay = 0;
                }
                else
                {
                    var firstPlay = DateTime.Parse(firstPlayStr);
                    DaysSinceFirstPlay = (int)(DateTime.UtcNow - firstPlay).TotalDays;
                }
            }

            string lastPlayStr = PlayerPrefs.GetString(PREF_LAST_PLAY, "");
            if (!string.IsNullOrEmpty(lastPlayStr))
            {
                var lastPlay = DateTime.Parse(lastPlayStr);
                DaysSinceLastPlay = (int)(DateTime.UtcNow - lastPlay).TotalDays;
            }

            Debug.Log($"[RetentionTracker] Session started. Days since last play: {DaysSinceLastPlay}");
        }

        /// <summary>
        /// Records the end of a play session and updates average session length.
        /// </summary>
        public void RecordSessionEnd()
        {
            var sessionLength = (float)(DateTime.UtcNow - _sessionStart).TotalHours;
            TotalPlayTimeHours += sessionLength;
            AvgSessionLength = TotalSessions > 0 ? TotalPlayTimeHours / TotalSessions : 0f;
            PlayerPrefs.SetString(PREF_LAST_PLAY, DateTime.UtcNow.ToString("O"));
            SaveMetrics();
        }

        /// <summary>
        /// Records that a specific feature was used, expanding the player's explored feature set.
        /// </summary>
        public void RecordFeatureUsed(string featureId)
        {
            if (string.IsNullOrEmpty(featureId)) return;
            if (!FeaturesUsed.Contains(featureId))
            {
                FeaturesUsed.Add(featureId);
                FeaturesUsedCount = FeaturesUsed.Count;
            }
            SaveMetrics();
        }

        /// <summary>
        /// Computes a churn risk score (0.0 - 1.0) based on recency, frequency, and depth of engagement.
        /// </summary>
        public void CalculateChurnRisk()
        {
            float engagementScore = CalculateEngagementScore();
            float socialScore = CalculateSocialScore();
            float progressionScore = CalculateProgressionScore();

            // Weighted combination: recency matters most.
            float rawScore = 1f - (engagementScore * 0.45f + socialScore * 0.35f + progressionScore * 0.2f);
            ChurnRiskScore = Mathf.Clamp01(rawScore);

            Debug.Log($"[RetentionTracker] Churn risk calculated: {ChurnRiskScore:F2} " +
                      $"(E:{engagementScore:F2}, S:{socialScore:F2}, P:{progressionScore:F2})");
        }

        /// <summary>
        /// Evaluates whether a retention intervention is warranted and triggers it.
        /// </summary>
        public void TriggerRetentionIntervention()
        {
            if (DaysSinceLastPlay >= ComeBackBonusThresholdDays && !PlayerPrefs.HasKey(PREF_HAS_HAD_INTERVENTION))
            {
                ShowComeBackBonus = true;
                AwardComeBackBonus();
            }
            else if (IsAtRisk)
            {
                ShowFeaturePrompt = true;
                SuggestUnexploredFeature();
            }
        }

        /// <summary>
        /// Awards a come-back bonus for returning after an extended absence.
        /// </summary>
        public void AwardComeBackBonus()
        {
            if (!ShowComeBackBonus) return;

            InventoryManager.Instance?.AddCurrency("coins", ComeBackBonusCoins);
            InventoryManager.Instance?.AddCurrency("gems", ComeBackBonusGems);
            PlayerPrefs.SetInt(PREF_HAS_HAD_INTERVENTION, 1);
            ShowComeBackBonus = false;

            OnComeBackBonusAwarded?.Invoke();
            PlayFabManager.Instance?.RecordRetentionEvent("comeback_bonus", DaysSinceLastPlay);
            Debug.Log($"[RetentionTracker] Come-back bonus awarded: {ComeBackBonusCoins} coins, {ComeBackBonusGems} gems.");
        }

        /// <summary>
        /// Suggests a feature the player has not yet explored, surfaced via UI or notifications.
        /// </summary>
        public void SuggestUnexploredFeature()
        {
            var unused = GetUnusedFeatures();
            if (unused.Count == 0) return;

            int index = UnityEngine.Random.Range(0, unused.Count);
            SuggestedFeature = unused[index];
            ShowFeaturePrompt = true;

            OnFeatureSuggested?.Invoke(SuggestedFeature);
            PlayFabManager.Instance?.RecordRetentionEvent("feature_suggested", SuggestedFeature);
            Debug.Log($"[RetentionTracker] Suggested unexplored feature: {SuggestedFeature}");
        }

        /// <summary>
        /// Computes the engagement sub-score (0-1) based on session recency and frequency.
        /// </summary>
        private float CalculateEngagementScore()
        {
            float recencyScore = Mathf.Clamp01(1f - (DaysSinceLastPlay / 14f));
            float frequencyScore = Mathf.Clamp01(TotalSessions / 30f);
            float durationScore = Mathf.Clamp01(TotalPlayTimeHours / 20f);
            return (recencyScore * 0.5f) + (frequencyScore * 0.3f) + (durationScore * 0.2f);
        }

        /// <summary>
        /// Computes the social sub-score (0-1) based on friends and social actions.
        /// </summary>
        private float CalculateSocialScore()
        {
            int friendCount = SocialGraphManager.Instance?.FriendCount ?? 0;
            float friendScore = Mathf.Clamp01(friendCount / 20f);
            float featureScore = Mathf.Clamp01(FeaturesUsed.Count / 10f);
            return (friendScore * 0.6f) + (featureScore * 0.4f);
        }

        /// <summary>
        /// Computes the progression sub-score (0-1) based on badges and level-like metrics.
        /// </summary>
        private float CalculateProgressionScore()
        {
            int badgeCount = BadgeManager.Instance?.BadgeCount ?? 0;
            float badgeScore = Mathf.Clamp01(badgeCount / 15f);
            float timeScore = Mathf.Clamp01(TotalPlayTimeHours / 50f);
            return (badgeScore * 0.5f) + (timeScore * 0.5f);
        }

        /// <summary>
        /// Returns a list of available features the player has not yet used.
        /// </summary>
        private List<string> GetUnusedFeatures()
        {
            return AvailableFeatures.Where(f => !FeaturesUsed.Contains(f)).ToList();
        }

        /// <summary>
        /// Persists all retention metrics to PlayerPrefs.
        /// </summary>
        private void SaveMetrics()
        {
            PlayerPrefs.SetInt(PREF_TOTAL_SESSIONS, TotalSessions);
            PlayerPrefs.SetFloat(PREF_TOTAL_HOURS, TotalPlayTimeHours);
            PlayerPrefs.SetString(PREF_FEATURES_USED, string.Join(",", FeaturesUsed));
            PlayerPrefs.Save();
        }

        /// <summary>
        /// Loads retention metrics from PlayerPrefs with safe defaults.
        /// </summary>
        private void LoadMetrics()
        {
            TotalSessions = PlayerPrefs.GetInt(PREF_TOTAL_SESSIONS, 0);
            TotalPlayTimeHours = PlayerPrefs.GetFloat(PREF_TOTAL_HOURS, 0f);
            string featuresStr = PlayerPrefs.GetString(PREF_FEATURES_USED, "");
            FeaturesUsed = string.IsNullOrEmpty(featuresStr)
                ? new List<string>()
                : featuresStr.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();
            FeaturesUsedCount = FeaturesUsed.Count;

            string firstPlayStr = PlayerPrefs.GetString(PREF_FIRST_PLAY, "");
            if (!string.IsNullOrEmpty(firstPlayStr))
            {
                var firstPlay = DateTime.Parse(firstPlayStr);
                DaysSinceFirstPlay = (int)(DateTime.UtcNow - firstPlay).TotalDays;
            }

            string lastPlayStr = PlayerPrefs.GetString(PREF_LAST_PLAY, "");
            if (!string.IsNullOrEmpty(lastPlayStr))
            {
                var lastPlay = DateTime.Parse(lastPlayStr);
                DaysSinceLastPlay = (int)(DateTime.UtcNow - lastPlay).TotalDays;
            }

            AvgSessionLength = TotalSessions > 0 ? TotalPlayTimeHours / TotalSessions : 0f;
        }
    }
}
