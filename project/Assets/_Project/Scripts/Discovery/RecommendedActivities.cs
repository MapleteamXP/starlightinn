using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KawaiiCoolIsland.Discovery
{
    /// <summary>
    /// Lightweight player profile data used for friend recommendations.
    /// </summary>
    [System.Serializable]
    public class PlayerProfile
    {
        public string PlayerId;
        public string DisplayName;
        public Sprite Avatar;
        public List<string> Tags = new List<string>();
        public List<string> MutualFriendIds = new List<string>();
    }

    /// <summary>
    /// Lightweight minigame data used for recommendations.
    /// </summary>
    [System.Serializable]
    public class MinigameData
    {
        public string MinigameId;
        public string Name;
        public string Category;
        public List<string> Tags = new List<string>();
        public float AvgPlayTime;
        public int PlayerCount;
    }

    /// <summary>
    /// Stores aggregated preference scores derived from player behavior.
    /// </summary>
    [System.Serializable]
    public class PlayerPreferenceProfile
    {
        public Dictionary<string, float> CategoryScores = new Dictionary<string, float>();
        public Dictionary<string, float> TagScores = new Dictionary<string, float>();
        public Dictionary<string, int> ActivityCounts = new Dictionary<string, int>();
        public List<string> FavoriteRooms = new List<string>();
        public List<string> DismissedRecommendations = new List<string>();
        public long LastUpdated;
    }

    /// <summary>
    /// Base interface for a recommendation engine.
    /// </summary>
    public interface IRecommendationEngine
    {
        string EngineName { get; }
        float GetScore(object candidate, PlayerPreferenceProfile profile);
    }

    /// <summary>
    /// Concrete recommendation engine implementation.
    /// </summary>
    [System.Serializable]
    public class RecommendationEngine : IRecommendationEngine
    {
        public string EngineName { get; set; }
        public float Weight = 1f;

        private Func<object, PlayerPreferenceProfile, float> _scorer;

        public RecommendationEngine(string name, float weight, Func<object, PlayerPreferenceProfile, float> scorer)
        {
            EngineName = name;
            Weight = weight;
            _scorer = scorer;
        }

        public float GetScore(object candidate, PlayerPreferenceProfile profile)
        {
            return _scorer?.Invoke(candidate, profile) ?? 0f * Weight;
        }
    }

    /// <summary>
    /// Generates personalized activity, room, event, minigame and friend recommendations
    /// based on tracked player behavior and preference profiles.
    /// </summary>
    public class RecommendedActivities : MonoBehaviour
    {
        [Header("Player Data")]
        /// <summary>The player's evolving preference profile.</summary>
        public PlayerPreferenceProfile Preferences = new PlayerPreferenceProfile();

        [Header("Recommendation Types")]
        /// <summary>Registered scoring engines for recommendations.</summary>
        public List<RecommendationEngine> Engines = new List<RecommendationEngine>();

        private List<RoomInfo> _roomPool = new List<RoomInfo>();
        private List<ScheduledEvent> _eventPool = new List<ScheduledEvent>();
        private List<MinigameData> _minigamePool = new List<MinigameData>();
        private List<PlayerProfile> _playerPool = new List<PlayerProfile>();
        private List<ActivityItem> _activityPool = new List<ActivityItem>();

        /// <summary>
        /// Gets personalized activity recommendations.
        /// </summary>
        /// <param name="count">Maximum recommendations to return.</param>
        /// <returns>List of recommended activity items.</returns>
        public List<ActivityItem> GetRecommendations(int count = 5)
        {
            var scored = new List<(ActivityItem item, float score)>();
            foreach (var item in _activityPool)
            {
                float s = 0f;
                foreach (var engine in Engines)
                    s += engine.GetScore(item, Preferences);
                scored.Add((item, s));
            }
            return scored.OrderByDescending(x => x.score)
                         .Take(count)
                         .Select(x => x.item)
                         .ToList();
        }

        /// <summary>
        /// Gets personalized room recommendations.
        /// </summary>
        /// <param name="count">Maximum rooms to return.</param>
        /// <returns>List of recommended rooms.</returns>
        public List<RoomInfo> GetRecommendedRooms(int count = 5)
        {
            var scored = new List<(RoomInfo room, float score)>();
            foreach (var room in _roomPool)
            {
                if (Preferences.DismissedRecommendations.Contains(room.RoomId))
                    continue;
                float s = CalculateRoomRecommendationScore(room);
                scored.Add((room, s));
            }
            return scored.OrderByDescending(x => x.score)
                         .Take(count)
                         .Select(x => x.room)
                         .ToList();
        }

        /// <summary>
        /// Gets personalized event recommendations.
        /// </summary>
        /// <param name="count">Maximum events to return.</param>
        /// <returns>List of recommended events.</returns>
        public List<ScheduledEvent> GetRecommendedEvents(int count = 3)
        {
            var scored = new List<(ScheduledEvent evt, float score)>();
            foreach (var evt in _eventPool)
            {
                if (Preferences.DismissedRecommendations.Contains(evt.EventId))
                    continue;
                float s = CalculateEventRecommendationScore(evt);
                scored.Add((evt, s));
            }
            return scored.OrderByDescending(x => x.score)
                         .Take(count)
                         .Select(x => x.evt)
                         .ToList();
        }

        /// <summary>
        /// Gets personalized minigame recommendations.
        /// </summary>
        /// <param name="count">Maximum minigames to return.</param>
        /// <returns>List of recommended minigames.</returns>
        public List<MinigameData> GetRecommendedMinigames(int count = 3)
        {
            var scored = new List<(MinigameData mg, float score)>();
            foreach (var mg in _minigamePool)
            {
                float s = 0f;
                if (Preferences.CategoryScores.ContainsKey(mg.Category))
                    s += Preferences.CategoryScores[mg.Category];
                foreach (var tag in mg.Tags)
                {
                    if (Preferences.TagScores.ContainsKey(tag))
                        s += Preferences.TagScores[tag];
                }
                if (Preferences.FavoriteRooms.Count > 0)
                    s += 0.05f;
                scored.Add((mg, s));
            }
            return scored.OrderByDescending(x => x.score)
                         .Take(count)
                         .Select(x => x.mg)
                         .ToList();
        }

        /// <summary>
        /// Gets "You might know" friend recommendations.
        /// </summary>
        /// <param name="count">Maximum players to return.</param>
        /// <returns>List of recommended player profiles.</returns>
        public List<PlayerProfile> GetRecommendedFriends(int count = 5)
        {
            var scored = new List<(PlayerProfile p, float score)>();
            foreach (var p in _playerPool)
            {
                float s = p.MutualFriendIds.Count * 0.3f;
                int tagOverlap = p.Tags.Count(t => Preferences.TagScores.ContainsKey(t));
                s += tagOverlap * 0.1f;
                scored.Add((p, s));
            }
            return scored.OrderByDescending(x => x.score)
                         .Take(count)
                         .Select(x => x.p)
                         .ToList();
        }

        /// <summary>
        /// Records player engagement with an activity for preference learning.
        /// </summary>
        /// <param name="activityType">Type of activity (e.g., "Room", "Minigame").</param>
        /// <param name="activityId">Unique identifier of the activity.</param>
        /// <param name="engagementScore">Score from 0.0 to 1.0 representing engagement.</param>
        public void RecordActivity(string activityType, string activityId, float engagementScore)
        {
            if (!Preferences.ActivityCounts.ContainsKey(activityType))
                Preferences.ActivityCounts[activityType] = 0;
            Preferences.ActivityCounts[activityType]++;

            if (!Preferences.CategoryScores.ContainsKey(activityType))
                Preferences.CategoryScores[activityType] = 0f;
            Preferences.CategoryScores[activityType] += engagementScore * 0.1f;

            Preferences.LastUpdated = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        }

        /// <summary>
        /// Records a room visit with dwell time for preference learning.
        /// </summary>
        /// <param name="roomId">Visited room ID.</param>
        /// <param name="timeSpent">Seconds spent in the room.</param>
        public void RecordRoomVisit(string roomId, float timeSpent)
        {
            if (!Preferences.FavoriteRooms.Contains(roomId))
                Preferences.FavoriteRooms.Add(roomId);
            if (Preferences.FavoriteRooms.Count > 20)
                Preferences.FavoriteRooms.RemoveAt(0);

            RecordActivity("Room", roomId, Mathf.Clamp01(timeSpent / 300f));
        }

        /// <summary>
        /// Records a minigame play session and whether it was enjoyed.
        /// </summary>
        /// <param name="minigameId">Played minigame ID.</param>
        /// <param name="enjoyed">True if the player enjoyed the session.</param>
        public void RecordMinigamePlay(string minigameId, bool enjoyed)
        {
            float score = enjoyed ? 0.8f : 0.2f;
            RecordActivity("Minigame", minigameId, score);
        }

        /// <summary>
        /// Rebuilds the preference profile from current data and trims stale entries.
        /// </summary>
        public void UpdatePreferences()
        {
            long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            long cutoff = now - 86400 * 30; // 30 days

            if (Preferences.LastUpdated < cutoff)
            {
                // Decay old scores
                foreach (var key in Preferences.CategoryScores.Keys.ToList())
                    Preferences.CategoryScores[key] *= 0.9f;
                foreach (var key in Preferences.TagScores.Keys.ToList())
                    Preferences.TagScores[key] *= 0.9f;
            }
            Preferences.LastUpdated = now;
        }

        /// <summary>
        /// Dismisses a recommendation so it will not appear again.
        /// </summary>
        /// <param name="recommendationId">ID of the recommendation to dismiss.</param>
        public void DismissRecommendation(string recommendationId)
        {
            if (!Preferences.DismissedRecommendations.Contains(recommendationId))
                Preferences.DismissedRecommendations.Add(recommendationId);
        }

        /// <summary>
        /// Calculates a recommendation score for a single room.
        /// </summary>
        /// <param name="room">The room to score.</param>
        /// <returns>Score from 0.0 to 1.0+.</returns>
        private float CalculateRoomRecommendationScore(RoomInfo room)
        {
            float score = 0f;

            if (Preferences.FavoriteRooms.Contains(room.RoomId))
                score += 0.5f;

            foreach (var tag in room.Tags)
            {
                if (Preferences.TagScores.ContainsKey(tag))
                    score += Preferences.TagScores[tag] * 0.2f;
            }

            score += room.CurrentPlayers * 0.01f;
            score += room.AvgVisitDuration * 0.001f;

            return Mathf.Clamp01(score);
        }

        /// <summary>
        /// Calculates a recommendation score for a single event.
        /// </summary>
        /// <param name="evt">The event to score.</param>
        /// <returns>Score from 0.0 to 1.0+.</returns>
        private float CalculateEventRecommendationScore(ScheduledEvent evt)
        {
            float score = 0f;

            if (Preferences.CategoryScores.ContainsKey("Event"))
                score += Preferences.CategoryScores["Event"] * 0.2f;

            foreach (var tag in evt.Tags)
            {
                if (Preferences.TagScores.ContainsKey(tag))
                    score += Preferences.TagScores[tag] * 0.15f;
            }

            if (evt.IsOfficial)
                score += 0.1f;

            if (evt.RequiresRSVP && evt.AttendeeIds.Count >= evt.MaxAttendees * 0.8f)
                score += 0.05f; // Social proof

            return Mathf.Clamp01(score);
        }

        /// <summary>
        /// Gets the player's highest-scoring categories.
        /// </summary>
        /// <returns>List of category names.</returns>
        private List<string> GetFavoriteCategories()
        {
            return Preferences.CategoryScores.OrderByDescending(kvp => kvp.Value)
                                             .Select(kvp => kvp.Key)
                                             .ToList();
        }

        /// <summary>
        /// Gets the player's highest-scoring tags.
        /// </summary>
        /// <returns>List of tag names.</returns>
        private List<string> GetFavoriteTags()
        {
            return Preferences.TagScores.OrderByDescending(kvp => kvp.Value)
                                        .Select(kvp => kvp.Key)
                                        .ToList();
        }

        /// <summary>
        /// Gets the total recorded play time for a given category.
        /// </summary>
        /// <param name="category">The category name.</param>
        /// <returns>Estimated play time count.</returns>
        private int GetPlayTimeForCategory(string category)
        {
            return Preferences.ActivityCounts.ContainsKey(category)
                ? Preferences.ActivityCounts[category]
                : 0;
        }

        /// <summary>
        /// Unity Start — register default engines and load pools.
        /// </summary>
        private void Start()
        {
            RegisterDefaultEngines();
            EventBus.Subscribe("RoomPoolUpdated", OnRoomPoolUpdated);
            EventBus.Subscribe("EventPoolUpdated", OnEventPoolUpdated);
            EventBus.Subscribe("MinigamePoolUpdated", OnMinigamePoolUpdated);
            EventBus.Subscribe("PlayerPoolUpdated", OnPlayerPoolUpdated);
        }

        /// <summary>
        /// Unity OnDestroy — clean up event bus subscriptions.
        /// </summary>
        private void OnDestroy()
        {
            EventBus.Unsubscribe("RoomPoolUpdated", OnRoomPoolUpdated);
            EventBus.Unsubscribe("EventPoolUpdated", OnEventPoolUpdated);
            EventBus.Unsubscribe("MinigamePoolUpdated", OnMinigamePoolUpdated);
            EventBus.Unsubscribe("PlayerPoolUpdated", OnPlayerPoolUpdated);
        }

        private void RegisterDefaultEngines()
        {
            Engines.Add(new RecommendationEngine("CategoryMatch", 1.0f, (obj, profile) =>
            {
                if (obj is ActivityItem item && profile.CategoryScores.ContainsKey(item.Category.ToString()))
                    return profile.CategoryScores[item.Category.ToString()];
                return 0f;
            }));
            Engines.Add(new RecommendationEngine("RecencyBoost", 0.5f, (obj, profile) =>
            {
                if (obj is ActivityItem item)
                {
                    long age = DateTimeOffset.UtcNow.ToUnixTimeSeconds() - item.Timestamp;
                    return Mathf.Max(0f, 1f - (age / 86400f));
                }
                return 0f;
            }));
        }

        private void OnRoomPoolUpdated(object data)
        {
            if (data is List<RoomInfo> rooms)
                _roomPool = rooms;
        }

        private void OnEventPoolUpdated(object data)
        {
            if (data is List<ScheduledEvent> evts)
                _eventPool = evts;
        }

        private void OnMinigamePoolUpdated(object data)
        {
            if (data is List<MinigameData> mgs)
                _minigamePool = mgs;
        }

        private void OnPlayerPoolUpdated(object data)
        {
            if (data is List<PlayerProfile> players)
                _playerPool = players;
        }
    }
}
