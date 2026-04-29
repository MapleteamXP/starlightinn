// ----------------------------------------------------------------------------
// KawaiiCool Island - Social Graph System
// ----------------------------------------------------------------------------
// RelationshipManager.cs - Relationship progression system
// ----------------------------------------------------------------------------
// Tracks interactions between friends and calculates relationship levels
// based on shared activities. Provides titles, colors, and rewards for
// each relationship tier.
// ----------------------------------------------------------------------------

using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using KawaiiCoolIsland.Core;
using KawaiiCoolIsland.Core.Events;

namespace KawaiiCoolIsland.Social
{
    #region Data Models

    /// <summary>
    /// Types of social interactions that contribute to relationship XP.
    /// </summary>
    public enum InteractionType
    {
        /// <summary>Sent a chat message to the friend.</summary>
        Chat,
        /// <summary>Visited the friend's room.</summary>
        VisitRoom,
        /// <summary>Played a minigame together.</summary>
        PlayMinigameTogether,
        /// <summary>Gifted an item to the friend.</summary>
        GiftItem,
        /// <summary>Performed an emote together.</summary>
        EmoteTogether,
        /// <summary>Completed a trade with the friend.</summary>
        Trade,
        /// <summary>Attended a party together.</summary>
        PartyTogether
    }

    /// <summary>
    /// Records a single interaction between two players.
    /// </summary>
    [System.Serializable]
    public class InteractionHistory
    {
        /// <summary>The type of interaction that occurred.</summary>
        public InteractionType Type;

        /// <summary>Unix timestamp of when the interaction occurred.</summary>
        public long Timestamp;

        /// <summary>Additional details about the interaction.</summary>
        public string Details;

        /// <summary>Amount of XP gained from this interaction.</summary>
        public int XPGained;
    }

    #endregion

    /// <summary>
    /// Manages relationship progression between the local player and their friends.
    /// Tracks interaction history, awards XP for shared activities, and provides
    /// level-up notifications with titles and rewards.
    /// </summary>
    public class RelationshipManager : Singleton<RelationshipManager>
    {
        #region Constants

        /// <summary>
        /// Save key for interaction history.
        /// </summary>
        private const string INTERACTIONS_SAVE_KEY = "Relationship_Interactions";

        /// <summary>
        /// Save key for relationship rewards claimed.
        /// </summary>
        private const string REWARDS_SAVE_KEY = "Relationship_Rewards";

        /// <summary>
        /// Base XP awarded for a chat interaction.
        /// </summary>
        public const int XP_CHAT = 5;

        /// <summary>
        /// Base XP awarded for visiting a friend's room.
        /// </summary>
        public const int XP_VISIT_ROOM = 25;

        /// <summary>
        /// Base XP awarded for playing a minigame together.
        /// </summary>
        public const int XP_PLAY_MINIGAME = 50;

        /// <summary>
        /// Base XP awarded for gifting an item.
        /// </summary>
        public const int XP_GIFT_ITEM = 40;

        /// <summary>
        /// Base XP awarded for performing an emote together.
        /// </summary>
        public const int XP_EMOTE = 15;

        /// <summary>
        /// Base XP awarded for completing a trade.
        /// </summary>
        public const int XP_TRADE = 30;

        /// <summary>
        /// Base XP awarded for attending a party together.
        /// </summary>
        public const int XP_PARTY = 35;

        /// <summary>
        /// Maximum number of interactions stored per friend.
        /// </summary>
        public const int MAX_HISTORY_PER_FRIEND = 100;

        #endregion

        #region Fields

        /// <summary>
        /// Interaction history keyed by player ID.
        /// </summary>
        private readonly Dictionary<string, List<InteractionHistory>> _interactionHistory = new();

        /// <summary>
        /// Set of claimed relationship reward keys (playerId:level).
        /// </summary>
        private readonly HashSet<string> _claimedRewards = new();

        /// <summary>
        /// XP thresholds for each relationship level.
        /// </summary>
        private static readonly int[] LevelThresholds = new[]
        {
            0,      // Level 1
            100,    // Level 2
            250,    // Level 3
            500,    // Level 4
            1000,   // Level 5
            2000,   // Level 6
            3500,   // Level 7
            5500,   // Level 8
            8000,   // Level 9
            11000   // Level 10 (max)
        };

        /// <summary>
        /// Colors associated with each relationship level.
        /// </summary>
        private static readonly Color[] LevelColors = new[]
        {
            new Color(0.7f, 0.7f, 0.7f),   // 1 - Grey
            new Color(0.5f, 0.8f, 0.5f),   // 2 - Light Green
            new Color(0.4f, 0.9f, 0.4f),   // 3 - Green
            new Color(0.3f, 0.9f, 0.7f),   // 4 - Teal
            new Color(0.3f, 0.8f, 1.0f),   // 5 - Light Blue
            new Color(0.4f, 0.6f, 1.0f),   // 6 - Blue
            new Color(0.6f, 0.5f, 1.0f),   // 7 - Purple
            new Color(0.9f, 0.5f, 1.0f),   // 8 - Magenta
            new Color(1.0f, 0.5f, 0.7f),   // 9 - Pink
            new Color(1.0f, 0.8f, 0.3f),   // 10 - Gold
        };

        /// <summary>
        /// Lock for thread-safe operations.
        /// </summary>
        private readonly object _lock = new();

        #endregion

        #region Events

        /// <summary>
        /// Fired when a relationship levels up.
        /// Parameters: playerId, oldLevel, newLevel.
        /// </summary>
        public event Action<string, int, int> OnRelationshipLeveledUp;

        /// <summary>
        /// Fired when a new interaction is recorded.
        /// Parameters: playerId, interactionType, xpGained.
        /// </summary>
        public event Action<string, InteractionType, int> OnInteractionRecorded;

        #endregion

        #region Unity Lifecycle

        /// <summary>
        /// Called when the singleton awakes. Loads interaction history.
        /// </summary>
        protected override void OnSingletonAwake()
        {
            base.OnSingletonAwake();
            LoadLocalData();
        }

        #endregion

        #region Relationship Levels

        /// <summary>
        /// Gets the relationship level for a friend (1-10).
        /// </summary>
        /// <param name="playerId">The friend's player ID.</param>
        /// <returns>The relationship level, or 0 if not a friend.</returns>
        public int GetRelationshipLevel(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return 0;
            if (!SocialGraphManager.Instance?.IsFriend(playerId) ?? true) return 0;

            int xp = GetRelationshipXP(playerId);
            return CalculateLevelFromXP(xp);
        }

        /// <summary>
        /// Gets the current relationship XP for a friend.
        /// </summary>
        /// <param name="playerId">The friend's player ID.</param>
        /// <returns>The total relationship XP.</returns>
        public int GetRelationshipXP(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return 0;

            lock (_lock)
            {
                if (!_interactionHistory.TryGetValue(playerId, out var history))
                    return 0;

                return history.Sum(h => h.XPGained);
            }
        }

        /// <summary>
        /// Gets the XP required to reach the next level from the current level.
        /// </summary>
        /// <param name="currentLevel">The current relationship level.</param>
        /// <returns>XP needed, or 0 if at max level.</returns>
        public int GetXPToNextLevel(int currentLevel)
        {
            if (currentLevel < 1 || currentLevel >= 10) return 0;
            return LevelThresholds[currentLevel] - LevelThresholds[currentLevel - 1];
        }

        /// <summary>
        /// Calculates level from total XP.
        /// </summary>
        private int CalculateLevelFromXP(int xp)
        {
            for (int i = LevelThresholds.Length - 1; i >= 0; i--)
            {
                if (xp >= LevelThresholds[i])
                    return Mathf.Clamp(i + 1, 1, 10);
            }
            return 1;
        }

        /// <summary>
        /// Gets the human-readable title for a relationship level.
        /// </summary>
        /// <param name="level">The relationship level (1-10).</param>
        /// <returns>The title string.</returns>
        public string GetRelationshipTitle(int level)
        {
            return level switch
            {
                1 => "Acquaintance",
                2 => "New Friend",
                3 => "Buddy",
                4 => "Pal",
                5 => "Close Friend",
                6 => "Good Friend",
                7 => "Trusted Friend",
                8 => "Bestie",
                9 => "Soulmate",
                10 => "Kindred Spirit",
                _ => "Stranger"
            };
        }

        /// <summary>
        /// Gets the color associated with a relationship level.
        /// </summary>
        /// <param name="level">The relationship level (1-10).</param>
        /// <returns>The color for UI display.</returns>
        public Color GetRelationshipColor(int level)
        {
            if (level < 1 || level > 10)
                return Color.gray;
            return LevelColors[level - 1];
        }

        #endregion

        #region Interactions

        /// <summary>
        /// Records a new interaction with a friend and awards XP.
        /// </summary>
        /// <param name="playerId">The friend's player ID.</param>
        /// <param name="type">The type of interaction.</param>
        public void AddInteraction(string playerId, InteractionType type)
        {
            if (string.IsNullOrEmpty(playerId)) return;
            if (!SocialGraphManager.Instance?.IsFriend(playerId) ?? true)
            {
                Debug.LogWarning($"[RelationshipManager] Cannot add interaction: {playerId} is not a friend.");
                return;
            }

            int xp = GetXPForInteraction(type);
            var interaction = new InteractionHistory
            {
                Type = type,
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                Details = $"{type} interaction",
                XPGained = xp
            };

            int oldLevel;
            lock (_lock)
            {
                if (!_interactionHistory.TryGetValue(playerId, out var history))
                {
                    history = new List<InteractionHistory>();
                    _interactionHistory[playerId] = history;
                }

                history.Add(interaction);

                // Trim history if too long
                if (history.Count > MAX_HISTORY_PER_FRIEND)
                {
                    history.RemoveAt(0);
                }

                oldLevel = CalculateLevelFromXP(history.Sum(h => h.XPGained) - xp);
            }

            // Also add to SocialGraphManager for consistency
            SocialGraphManager.Instance?.AddRelationshipXP(playerId, xp);

            int newLevel = GetRelationshipLevel(playerId);
            if (newLevel > oldLevel)
            {
                OnRelationshipLeveledUp?.Invoke(playerId, oldLevel, newLevel);
                EventBus.Instance.Publish(new RelationshipLeveledUpEvent
                {
                    OtherPlayerId = playerId,
                    OldLevel = oldLevel,
                    NewLevel = newLevel,
                    NewTitle = GetRelationshipTitle(newLevel)
                });

                Debug.Log($"[RelationshipManager] Relationship with {playerId} leveled up: {oldLevel} -> {newLevel}");
            }

            OnInteractionRecorded?.Invoke(playerId, type, xp);
            SaveLocalData();
        }

        /// <summary>
        /// Gets the interaction history for a friend.
        /// </summary>
        /// <param name="playerId">The friend's player ID.</param>
        /// <returns>List of interactions, most recent first.</returns>
        public List<InteractionHistory> GetInteractionHistory(string playerId)
        {
            lock (_lock)
            {
                if (_interactionHistory.TryGetValue(playerId, out var history))
                {
                    return history.OrderByDescending(h => h.Timestamp).ToList();
                }
                return new List<InteractionHistory>();
            }
        }

        /// <summary>
        /// Gets the XP value for a specific interaction type.
        /// </summary>
        /// <param name="type">The interaction type.</param>
        /// <returns>The base XP awarded.</returns>
        public int GetXPForInteraction(InteractionType type)
        {
            return type switch
            {
                InteractionType.Chat => XP_CHAT,
                InteractionType.VisitRoom => XP_VISIT_ROOM,
                InteractionType.PlayMinigameTogether => XP_PLAY_MINIGAME,
                InteractionType.GiftItem => XP_GIFT_ITEM,
                InteractionType.EmoteTogether => XP_EMOTE,
                InteractionType.Trade => XP_TRADE,
                InteractionType.PartyTogether => XP_PARTY,
                _ => 0
            };
        }

        #endregion

        #region Rewards

        /// <summary>
        /// Unlocks a relationship reward for a specific level with a friend.
        /// </summary>
        /// <param name="level">The relationship level.</param>
        /// <param name="playerId">The friend's player ID.</param>
        public void UnlockRelationshipReward(int level, string playerId)
        {
            if (level < 1 || level > 10) return;
            if (string.IsNullOrEmpty(playerId)) return;

            string rewardKey = $"{playerId}:{level}";

            lock (_lock)
            {
                if (_claimedRewards.Contains(rewardKey))
                {
                    Debug.Log($"[RelationshipManager] Reward for level {level} with {playerId} already claimed.");
                    return;
                }

                _claimedRewards.Add(rewardKey);
            }

            SaveLocalData();
            Debug.Log($"[RelationshipManager] Unlocked level {level} reward with {playerId}.");
        }

        /// <summary>
        /// Checks if a relationship reward has been claimed.
        /// </summary>
        /// <param name="level">The relationship level.</param>
        /// <param name="playerId">The friend's player ID.</param>
        /// <returns>True if the reward was claimed.</returns>
        public bool IsRewardClaimed(int level, string playerId)
        {
            string rewardKey = $"{playerId}:{level}";
            lock (_lock)
            {
                return _claimedRewards.Contains(rewardKey);
            }
        }

        /// <summary>
        /// Gets the reward description for a relationship level.
        /// </summary>
        /// <param name="level">The relationship level.</param>
        /// <returns>Description of the unlockable reward.</returns>
        public string GetRewardDescription(int level)
        {
            return level switch
            {
                2 => "Unlock friend teleport feature",
                3 => "Unlock exclusive buddy emote",
                4 => "Unlock shared room decoration",
                5 => "Unlock close friend title badge",
                6 => "Unlock private chat channel",
                7 => "Unlock trust-based trading discounts",
                8 => "Unlock bestie duo outfit",
                9 => "Unlock soulmate aura effect",
                10 => "Unlock kindred spirit legendary badge",
                _ => "No reward available"
            };
        }

        #endregion

        #region Persistence

        /// <summary>
        /// Serializable container for relationship save data.
        /// </summary>
        [System.Serializable]
        private class RelationshipSaveData
        {
            public List<InteractionSaveEntry> Interactions = new();
            public List<string> ClaimedRewards = new();
        }

        /// <summary>
        /// Serializable interaction entry for save/load.
        /// </summary>
        [System.Serializable]
        private class InteractionSaveEntry
        {
            public string PlayerId;
            public InteractionType Type;
            public long Timestamp;
            public string Details;
            public int XPGained;
        }

        /// <summary>
        /// Saves relationship data to local storage.
        /// </summary>
        private void SaveLocalData()
        {
            var saveData = new RelationshipSaveData();

            lock (_lock)
            {
                foreach (var kvp in _interactionHistory)
                {
                    foreach (var interaction in kvp.Value)
                    {
                        saveData.Interactions.Add(new InteractionSaveEntry
                        {
                            PlayerId = kvp.Key,
                            Type = interaction.Type,
                            Timestamp = interaction.Timestamp,
                            Details = interaction.Details,
                            XPGained = interaction.XPGained
                        });
                    }
                }

                saveData.ClaimedRewards = _claimedRewards.ToList();
            }

            SaveManager.Instance?.Save(INTERACTIONS_SAVE_KEY, saveData);
        }

        /// <summary>
        /// Loads relationship data from local storage.
        /// </summary>
        private void LoadLocalData()
        {
            var saveData = SaveManager.Instance?.Load<RelationshipSaveData>(INTERACTIONS_SAVE_KEY);
            if (saveData == null) return;

            lock (_lock)
            {
                _interactionHistory.Clear();
                foreach (var entry in saveData.Interactions)
                {
                    if (!_interactionHistory.TryGetValue(entry.PlayerId, out var history))
                    {
                        history = new List<InteractionHistory>();
                        _interactionHistory[entry.PlayerId] = history;
                    }

                    history.Add(new InteractionHistory
                    {
                        Type = entry.Type,
                        Timestamp = entry.Timestamp,
                        Details = entry.Details,
                        XPGained = entry.XPGained
                    });
                }

                _claimedRewards.Clear();
                foreach (var reward in saveData.ClaimedRewards)
                {
                    _claimedRewards.Add(reward);
                }
            }

            Debug.Log($"[RelationshipManager] Loaded {_interactionHistory.Count} friend interaction histories.");
        }

        #endregion

        #region Utility

        /// <summary>
        /// Gets the total number of interactions recorded across all friends.
        /// </summary>
        public int TotalInteractions
        {
            get
            {
                lock (_lock)
                {
                    return _interactionHistory.Values.Sum(h => h.Count);
                }
            }
        }

        /// <summary>
        /// Clears all interaction history and rewards. Use with caution.
        /// </summary>
        [ContextMenu("Clear All Relationship Data")]
        public void ClearAllData()
        {
            lock (_lock)
            {
                _interactionHistory.Clear();
                _claimedRewards.Clear();
            }

            SaveManager.Instance?.Delete(INTERACTIONS_SAVE_KEY);
            Debug.Log("[RelationshipManager] All relationship data cleared.");
        }

        #endregion

        #region Editor

#if UNITY_EDITOR
        /// <summary>
        /// Editor helper to log relationship state.
        /// </summary>
        [ContextMenu("Log Relationship State")]
        private void EditorLogState()
        {
            lock (_lock)
            {
                Debug.Log("=== RelationshipManager State ===");
                foreach (var kvp in _interactionHistory)
                {
                    int xp = kvp.Value.Sum(h => h.XPGained);
                    int level = CalculateLevelFromXP(xp);
                    Debug.Log($"  {kvp.Key}: Lv{level} ({xp} XP) - {kvp.Value.Count} interactions");
                }
                Debug.Log($"Claimed Rewards: {_claimedRewards.Count}");
            }
        }
#endif

        #endregion
    }
}
