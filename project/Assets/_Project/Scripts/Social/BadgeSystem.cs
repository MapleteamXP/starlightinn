// ----------------------------------------------------------------------------
// KawaiiCool Island - Social Graph System
// ----------------------------------------------------------------------------
// BadgeSystem.cs - Achievements/badges for social and gameplay milestones
// ----------------------------------------------------------------------------
// ScriptableObject-based badge definitions with a manager that checks
// player stats against badge requirements and awards eligible badges.
// Integrates with PlayerProfileManager and publishes events via EventBus.
// ----------------------------------------------------------------------------

using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using KawaiiCoolIsland.Core;
using KawaiiCoolIsland.Core.Events;

namespace KawaiiCoolIsland.Social
{
    #region ScriptableObject Definition

    /// <summary>
    /// ScriptableObject asset defining a badge/achievement in KawaiiCool Island.
    /// Created via Assets > Create > KawaiiCool > Badge menu.
    /// </summary>
    [CreateAssetMenu(fileName = "Badge_", menuName = "KawaiiCool/Badge")]
    public class BadgeData : ScriptableObject
    {
        /// <summary>The unique badge identifier.</summary>
        public string BadgeId;

        /// <summary>The display name of the badge.</summary>
        public string DisplayName;

        /// <summary>The badge description text.</summary>
        public string Description;

        /// <summary>The badge icon sprite.</summary>
        public Sprite Icon;

        /// <summary>The rarity tier of the badge.</summary>
        public BadgeRarity Rarity;

        /// <summary>The category of the badge.</summary>
        public BadgeCategory Category;

        /// <summary>The required stat value to earn this badge.</summary>
        public int RequiredValue;

        /// <summary>The stat name to check for badge eligibility.</summary>
        public string RequiredStat;

        /// <summary>Whether this badge is hidden until earned.</summary>
        public bool IsHidden;
    }

    #endregion

    /// <summary>
    /// Manages all badges in the game. Tracks earned badges, checks player stats
    /// against badge requirements, and handles awarding with proper event notifications.
    /// Loads badge definitions from Resources or asset references.
    /// </summary>
    public class BadgeManager : Singleton<BadgeManager>
    {
        #region Constants

        /// <summary>
        /// Save key for earned badge IDs.
        /// </summary>
        private const string BADGES_SAVE_KEY = "BadgeManager_Earned";

        /// <summary>
        /// Resource path for badge definitions.
        /// </summary>
        public const string BADGE_RESOURCES_PATH = "Badges";

        #endregion

        #region Fields

        /// <summary>
        /// All badge definitions loaded into the manager.
        /// </summary>
        [SerializeField]
        private List<BadgeData> _allBadges = new();

        /// <summary>
        /// Set of earned badge IDs for fast lookup.
        /// </summary>
        private readonly HashSet<string> _earnedBadgeIds = new();

        /// <summary>
        /// Lock for thread-safe badge operations.
        /// </summary>
        private readonly object _lock = new();

        #endregion

        #region Properties

        /// <summary>
        /// All badge definitions available in the game.
        /// </summary>
        public List<BadgeData> AllBadges => _allBadges;

        /// <summary>
        /// IDs of all earned badges.
        /// </summary>
        public List<string> EarnedBadgeIds
        {
            get
            {
                lock (_lock)
                {
                    return _earnedBadgeIds.ToList();
                }
            }
        }

        /// <summary>
        /// Total number of badges available.
        /// </summary>
        public int TotalBadgeCount => _allBadges?.Count ?? 0;

        /// <summary>
        /// Number of badges earned.
        /// </summary>
        public int EarnedCount
        {
            get
            {
                lock (_lock)
                {
                    return _earnedBadgeIds.Count;
                }
            }
        }

        #endregion

        #region Events

        /// <summary>
        /// Fired when a badge is earned. Parameter is the badge definition.
        /// </summary>
        public event Action<BadgeData> OnBadgeEarned;

        #endregion

        #region Unity Lifecycle

        /// <summary>
        /// Called when the singleton awakes. Loads badge definitions and earned badges.
        /// </summary>
        protected override void OnSingletonAwake()
        {
            base.OnSingletonAwake();
            LoadBadgeDatas();
            LoadLocalData();
        }

        #endregion

        #region Badge Definitions

        /// <summary>
        /// Loads all badge definitions from Resources and assigned references.
        /// </summary>
        private void LoadBadgeDatas()
        {
            // Load from assigned references first
            if (_allBadges == null)
                _allBadges = new List<BadgeData>();

            // Also load from Resources folder if available
            var resourceBadges = Resources.LoadAll<BadgeData>(BADGE_RESOURCES_PATH);
            foreach (var badge in resourceBadges)
            {
                if (!_allBadges.Any(b => b.BadgeId == badge.BadgeId))
                {
                    _allBadges.Add(badge);
                }
            }

            Debug.Log($"[BadgeManager] Loaded {_allBadges.Count} badge definitions.");
        }

        /// <summary>
        /// Gets a badge definition by its ID.
        /// </summary>
        /// <param name="badgeId">The badge identifier.</param>
        /// <returns>The badge definition, or null if not found.</returns>
        public BadgeData GetBadgeData(string badgeId)
        {
            if (string.IsNullOrEmpty(badgeId)) return null;
            return _allBadges?.FirstOrDefault(b => b.BadgeId == badgeId);
        }

        /// <summary>
        /// Gets all badge definitions in a specific category.
        /// </summary>
        /// <param name="category">The badge category to filter.</param>
        /// <returns>List of matching badge definitions.</returns>
        public List<BadgeData> GetBadgesByCategory(BadgeCategory category)
        {
            return _allBadges?.Where(b => b.Category == category).ToList() ?? new List<BadgeData>();
        }

        /// <summary>
        /// Gets all badge definitions of a specific rarity.
        /// </summary>
        /// <param name="rarity">The badge rarity to filter.</param>
        /// <returns>List of matching badge definitions.</returns>
        public List<BadgeData> GetBadgesByRarity(BadgeRarity rarity)
        {
            return _allBadges?.Where(b => b.Rarity == rarity).ToList() ?? new List<BadgeData>();
        }

        #endregion

        #region Badge Checking & Awarding

        /// <summary>
        /// Checks all unearned badges against current player stats and awards any that qualify.
        /// Call this after stat changes or on session start.
        /// </summary>
        public void CheckAndAwardBadges()
        {
            if (_allBadges == null || _allBadges.Count == 0) return;
            if (PlayerProfileManager.Instance?.MyProfile == null) return;

            var stats = PlayerProfileManager.Instance.MyProfile.Stats;
            if (stats == null) return;

            bool anyEarned = false;
            foreach (var badge in _allBadges)
            {
                if (_earnedBadgeIds.Contains(badge.BadgeId)) continue;
                if (string.IsNullOrEmpty(badge.RequiredStat)) continue;

                if (stats.TryGetValue(badge.RequiredStat, out int currentValue))
                {
                    if (currentValue >= badge.RequiredValue)
                    {
                        AwardBadgeInternal(badge);
                        anyEarned = true;
                    }
                }
            }

            if (anyEarned)
            {
                SaveLocalData();
            }
        }

        /// <summary>
        /// Checks if the player has earned a specific badge.
        /// </summary>
        /// <param name="badgeId">The badge identifier to check.</param>
        /// <returns>True if the badge has been earned.</returns>
        public bool HasBadge(string badgeId)
        {
            if (string.IsNullOrEmpty(badgeId)) return false;
            lock (_lock)
            {
                return _earnedBadgeIds.Contains(badgeId);
            }
        }

        /// <summary>
        /// Awards a badge to the local player. Checks requirements if applicable.
        /// </summary>
        /// <param name="badgeId">The badge identifier to award.</param>
        public void AwardBadge(string badgeId)
        {
            if (string.IsNullOrEmpty(badgeId)) return;

            var badge = GetBadgeData(badgeId);
            if (badge == null)
            {
                Debug.LogWarning($"[BadgeManager] Badge {badgeId} not found in catalog.");
                return;
            }

            AwardBadgeInternal(badge);
            SaveLocalData();
        }

        /// <summary>
        /// Internal method to award a badge without additional validation.
        /// </summary>
        private void AwardBadgeInternal(BadgeData badge)
        {
            if (badge == null) return;

            lock (_lock)
            {
                if (_earnedBadgeIds.Contains(badge.BadgeId))
                {
                    Debug.Log($"[BadgeManager] Badge {badge.BadgeId} already earned.");
                    return;
                }

                _earnedBadgeIds.Add(badge.BadgeId);
            }

            // Update profile
            PlayerProfileManager.Instance?.AddBadge(badge.BadgeId);

            // Fire events
            OnBadgeEarned?.Invoke(badge);
            EventBus.Instance.Publish(new BadgeEarnedEvent
            {
                BadgeId = badge.BadgeId,
                BadgeName = badge.DisplayName,
                Rarity = (int)badge.Rarity,
                Category = (int)badge.Category
            });

            // Add to social feed
            SocialFeedManager.Instance?.AddFriendEarnedBadgeFeed(
                PlayerProfileManager.Instance?.MyProfile?.PlayerId ?? "",
                PlayerProfileManager.Instance?.MyProfile?.DisplayName ?? "",
                badge.DisplayName
            );

            Debug.Log($"[BadgeManager] Badge earned: {badge.DisplayName} ({badge.Rarity})");
        }

        #endregion

        #region Badge Queries

        /// <summary>
        /// Gets all earned badge definitions.
        /// </summary>
        /// <returns>List of earned badge definitions.</returns>
        public List<BadgeData> GetEarnedBadges()
        {
            lock (_lock)
            {
                return _allBadges?.Where(b => _earnedBadgeIds.Contains(b.BadgeId)).ToList()
                    ?? new List<BadgeData>();
            }
        }

        /// <summary>
        /// Gets all unearned badge definitions.
        /// </summary>
        /// <returns>List of unearned badge definitions.</returns>
        public List<BadgeData> GetUnearnedBadges()
        {
            lock (_lock)
            {
                return _allBadges?.Where(b => !_earnedBadgeIds.Contains(b.BadgeId)).ToList()
                    ?? new List<BadgeData>();
            }
        }

        /// <summary>
        /// Gets the current progress toward a badge requirement.
        /// </summary>
        /// <param name="badgeId">The badge identifier.</param>
        /// <returns>Progress percentage (0-100), or -1 if unknown.</returns>
        public int GetBadgeProgress(string badgeId)
        {
            if (string.IsNullOrEmpty(badgeId)) return -1;

            var badge = GetBadgeData(badgeId);
            if (badge == null) return -1;

            if (HasBadge(badgeId)) return 100;
            if (string.IsNullOrEmpty(badge.RequiredStat)) return -1;

            int currentValue = PlayerProfileManager.Instance?.GetStat(badge.RequiredStat) ?? 0;
            if (badge.RequiredValue <= 0) return 0;

            int progress = Mathf.Clamp((int)((float)currentValue / badge.RequiredValue * 100f), 0, 99);
            return progress;
        }

        /// <summary>
        /// Gets the next unearned badge with the highest progress.
        /// </summary>
        /// <returns>The closest badge definition, or null.</returns>
        public BadgeData GetNextClosestBadge()
        {
            BadgeData closest = null;
            int highestProgress = -1;

            foreach (var badge in GetUnearnedBadges())
            {
                int progress = GetBadgeProgress(badge.BadgeId);
                if (progress > highestProgress)
                {
                    highestProgress = progress;
                    closest = badge;
                }
            }

            return closest;
        }

        #endregion

        #region Persistence

        /// <summary>
        /// Serializable container for badge save data.
        /// </summary>
        [System.Serializable]
        private class BadgeSaveData
        {
            public List<string> EarnedIds = new();
        }

        /// <summary>
        /// Saves earned badges to local storage.
        /// </summary>
        private void SaveLocalData()
        {
            var saveData = new BadgeSaveData();

            lock (_lock)
            {
                saveData.EarnedIds = _earnedBadgeIds.ToList();
            }

            SaveManager.Instance?.Save(BADGES_SAVE_KEY, saveData);
        }

        /// <summary>
        /// Loads earned badges from local storage.
        /// </summary>
        private void LoadLocalData()
        {
            var saveData = SaveManager.Instance?.Load<BadgeSaveData>(BADGES_SAVE_KEY);
            if (saveData == null) return;

            lock (_lock)
            {
                _earnedBadgeIds.Clear();
                foreach (var id in saveData.EarnedIds)
                {
                    if (!string.IsNullOrEmpty(id))
                        _earnedBadgeIds.Add(id);
                }
            }

            Debug.Log($"[BadgeManager] Loaded {_earnedBadgeIds.Count} earned badges.");
        }

        #endregion

        #region Utility

        /// <summary>
        /// Adds a badge definition at runtime (e.g., from DLC or events).
        /// </summary>
        /// <param name="badge">The badge definition to add.</param>
        public void AddBadgeData(BadgeData badge)
        {
            if (badge == null) return;
            if (_allBadges == null) _allBadges = new List<BadgeData>();

            if (_allBadges.Any(b => b.BadgeId == badge.BadgeId))
            {
                Debug.LogWarning($"[BadgeManager] Badge {badge.BadgeId} already exists.");
                return;
            }

            _allBadges.Add(badge);
            Debug.Log($"[BadgeManager] Added badge definition: {badge.DisplayName}");
        }

        /// <summary>
        /// Clears all earned badge data. Use with caution.
        /// </summary>
        [ContextMenu("Clear All Earned Badges")]
        public void ClearAllEarnedBadges()
        {
            lock (_lock)
            {
                _earnedBadgeIds.Clear();
            }

            SaveManager.Instance?.Delete(BADGES_SAVE_KEY);
            Debug.Log("[BadgeManager] All earned badges cleared.");
        }

        /// <summary>
        /// Gets the completion percentage for all badges.
        /// </summary>
        /// <returns>Percentage from 0 to 100.</returns>
        public float GetCompletionPercentage()
        {
            if (_allBadges == null || _allBadges.Count == 0) return 0f;
            lock (_lock)
            {
                return (float)_earnedBadgeIds.Count / _allBadges.Count * 100f;
            }
        }

        #endregion

        #region Editor

#if UNITY_EDITOR
        /// <summary>
        /// Editor helper to log the current badge state.
        /// </summary>
        [ContextMenu("Log Badge State")]
        private void EditorLogState()
        {
            lock (_lock)
            {
                Debug.Log("=== BadgeManager State ===");
                Debug.Log($"Total Badges: {_allBadges?.Count ?? 0}");
                Debug.Log($"Earned: {_earnedBadgeIds.Count}");
                Debug.Log($"Completion: {GetCompletionPercentage():F1}%");
                Debug.Log("Earned badges:");
                foreach (var id in _earnedBadgeIds)
                {
                    var badge = GetBadgeData(id);
                    Debug.Log($"  [{badge?.Rarity}] {badge?.DisplayName}");
                }
            }
        }

        /// <summary>
        /// Editor helper to award all badges for testing.
        /// </summary>
        [ContextMenu("Award All Badges (Debug)")]
        private void EditorAwardAllBadges()
        {
            if (_allBadges == null) return;
            foreach (var badge in _allBadges)
            {
                AwardBadgeInternal(badge);
            }
            SaveLocalData();
        }
#endif

        #endregion
    }
}
