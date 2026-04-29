using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KawaiiCoolIsland.Discovery
{
    /// <summary>
    /// Enum representing all possible types of activity that can appear in the feed.
    /// </summary>
    public enum ActivityType
    {
        FriendActivity,
        TrendingRoom,
        EventStarting,
        MinigameQueue,
        NewRoom,
        Achievement,
        Milestone,
        SystemAnnouncement,
        Promotion
    }

    /// <summary>
    /// Enum for filtering the activity feed into categories.
    /// </summary>
    public enum ActivityCategory
    {
        All,
        Friends,
        Trending,
        Events,
        Minigames,
        Rooms,
        System
    }

    /// <summary>
    /// Represents a single item in the activity feed.
    /// </summary>
    [System.Serializable]
    public class ActivityItem
    {
        public string ActivityId;
        public ActivityType Type;
        public ActivityCategory Category;
        public string Title;
        public string Description;
        public Sprite Icon;
        public string ActorId;
        public string ActorName;
        public string TargetId;
        public string TargetName;
        public long Timestamp;
        public bool IsRead;
        public bool IsRecommended;
        public float RelevanceScore;
        public Dictionary<string, string> Metadata = new Dictionary<string, string>();
        public Action OnClickAction;
    }

    /// <summary>
    /// Defines a source that contributes activities to the feed.
    /// </summary>
    [System.Serializable]
    public class ActivityFeedSource
    {
        public string SourceId;
        public string SourceName;
        public ActivityCategory Category;
        public bool IsEnabled = true;
        public float Priority = 1f;
    }

    /// <summary>
    /// Central hub for all activity discovery in KawaiiCool Island.
    /// Aggregates, filters, personalizes and serves the live activity feed.
    /// </summary>
    public class ActivityFeedManager : Singleton<ActivityFeedManager>
    {
        [Header("Feed Sources")]
        /// <summary>List of configured activity feed sources.</summary>
        public List<ActivityFeedSource> Sources = new List<ActivityFeedSource>();
        /// <summary>Current list of activity items in the feed.</summary>
        public List<ActivityItem> CurrentFeed = new List<ActivityItem>();
        /// <summary>Maximum number of items to retain in the feed.</summary>
        public int MaxFeedItems = 100;

        [Header("Categories")]
        /// <summary>Currently active category filter.</summary>
        public ActivityCategory ActiveCategory = ActivityCategory.All;

        [Header("Personalization")]
        /// <summary>Whether to apply personalization/relevance scoring.</summary>
        public bool UsePersonalization = true;
        /// <summary>Number of items to keep in the recommendation pool.</summary>
        public int RecommendationPoolSize = 50;

        /// <summary>Triggered whenever the feed is updated with new or changed items.</summary>
        public event Action<List<ActivityItem>> OnFeedUpdated;
        /// <summary>Triggered whenever a new activity item is added.</summary>
        public event Action<ActivityItem> OnNewActivity;

        private const float ActivityExpiryHours = 24f;
        private Queue<ActivityItem> _recommendedPool = new Queue<ActivityItem>();
        private HashSet<string> _seenActivityIds = new HashSet<string>();

        /// <summary>
        /// Refreshes the activity feed by fetching updates from all enabled sources,
        /// removing expired items, re-scoring and re-sorting.
        /// </summary>
        public void RefreshFeed()
        {
            RemoveExpiredActivities();

            if (UsePersonalization)
                GenerateRecommendedFeed();

            SortFeedByRelevance();
            TrimFeed();

            ApplyCategoryFilter(ActiveCategory);
            OnFeedUpdated?.Invoke(CurrentFeed);
        }

        /// <summary>
        /// Adds a new activity item to the feed.
        /// </summary>
        /// <param name="item">The activity item to add.</param>
        public void AddActivity(ActivityItem item)
        {
            if (item == null) return;
            if (string.IsNullOrEmpty(item.ActivityId))
                item.ActivityId = Guid.NewGuid().ToString();

            item.Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

            CurrentFeed.Insert(0, item);
            OnNewActivity?.Invoke(item);

            TrimFeed();
            RefreshFeed();
        }

        /// <summary>
        /// Filters the feed by a specific category.
        /// </summary>
        /// <param name="category">The category to filter by.</param>
        public void FilterByCategory(ActivityCategory category)
        {
            ActiveCategory = category;
            ApplyCategoryFilter(category);
            OnFeedUpdated?.Invoke(CurrentFeed);
        }

        /// <summary>
        /// Retrieves the current feed up to a specified count.
        /// </summary>
        /// <param name="count">Maximum number of items to return.</param>
        /// <returns>List of activity items.</returns>
        public List<ActivityItem> GetFeed(int count = 20)
        {
            return CurrentFeed.Take(count).ToList();
        }

        /// <summary>
        /// Gets personalized recommended activities for the player.
        /// </summary>
        /// <returns>List of recommended activity items.</returns>
        public List<ActivityItem> GetRecommendedActivities()
        {
            return CurrentFeed.Where(a => a.IsRecommended && !a.IsRead)
                              .OrderByDescending(a => a.RelevanceScore)
                              .Take(10)
                              .ToList();
        }

        /// <summary>
        /// Gets currently trending activities.
        /// </summary>
        /// <returns>List of trending activity items.</returns>
        public List<ActivityItem> GetTrendingActivities()
        {
            return CurrentFeed.Where(a => a.Type == ActivityType.TrendingRoom ||
                                            a.Category == ActivityCategory.Trending)
                              .OrderByDescending(a => a.RelevanceScore)
                              .Take(10)
                              .ToList();
        }

        /// <summary>
        /// Gets activities involving friends.
        /// </summary>
        /// <returns>List of friend-related activity items.</returns>
        public List<ActivityItem> GetFriendActivities()
        {
            return CurrentFeed.Where(a => a.Category == ActivityCategory.Friends ||
                                            a.Type == ActivityType.FriendActivity)
                              .OrderByDescending(a => a.Timestamp)
                              .Take(20)
                              .ToList();
        }

        /// <summary>
        /// Gets activities for rooms near the player's current location.
        /// </summary>
        /// <returns>List of nearby activity items.</returns>
        public List<ActivityItem> GetNearbyActivities()
        {
            // Placeholder for proximity-based filtering
            return CurrentFeed.Where(a => !string.IsNullOrEmpty(a.TargetId))
                              .OrderByDescending(a => a.RelevanceScore)
                              .Take(10)
                              .ToList();
        }

        /// <summary>
        /// Marks a specific activity as seen/read.
        /// </summary>
        /// <param name="activityId">The ID of the activity to mark.</param>
        public void MarkActivitySeen(string activityId)
        {
            var item = CurrentFeed.FirstOrDefault(a => a.ActivityId == activityId);
            if (item != null)
            {
                item.IsRead = true;
                _seenActivityIds.Add(activityId);
                OnFeedUpdated?.Invoke(CurrentFeed);
            }
        }

        /// <summary>
        /// Marks all activities in the feed as seen/read.
        /// </summary>
        public void MarkAllSeen()
        {
            foreach (var item in CurrentFeed)
            {
                item.IsRead = true;
                _seenActivityIds.Add(item.ActivityId);
            }
            OnFeedUpdated?.Invoke(CurrentFeed);
        }

        /// <summary>
        /// Gets the number of unread activities.
        /// </summary>
        /// <returns>Count of unread items.</returns>
        public int GetUnreadCount()
        {
            return CurrentFeed.Count(a => !a.IsRead);
        }

        /// <summary>
        /// Clears all items from the feed.
        /// </summary>
        public void ClearFeed()
        {
            CurrentFeed.Clear();
            _recommendedPool.Clear();
            _seenActivityIds.Clear();
            OnFeedUpdated?.Invoke(CurrentFeed);
        }

        /// <summary>
        /// Logs that a friend has joined a room.
        /// </summary>
        /// <param name="friendId">The friend's player ID.</param>
        /// <param name="roomName">The name of the room joined.</param>
        public void LogFriendJoinedRoom(string friendId, string roomName)
        {
            var item = new ActivityItem
            {
                Type = ActivityType.FriendActivity,
                Category = ActivityCategory.Friends,
                Title = "Friend Joined Room",
                Description = $"Your friend joined {roomName}!",
                ActorId = friendId,
                TargetName = roomName,
                OnClickAction = () => EventBus.Publish("NavigateToRoom", roomName)
            };
            AddActivity(item);
        }

        /// <summary>
        /// Logs a trending room to the activity feed.
        /// </summary>
        /// <param name="roomId">The room ID.</param>
        /// <param name="roomName">The room display name.</param>
        /// <param name="playerCount">Current number of players in the room.</param>
        public void LogTrendingRoom(string roomId, string roomName, int playerCount)
        {
            var item = new ActivityItem
            {
                Type = ActivityType.TrendingRoom,
                Category = ActivityCategory.Trending,
                Title = "Trending Room",
                Description = $"{roomName} is hopping with {playerCount} players!",
                TargetId = roomId,
                TargetName = roomName,
                Metadata = new Dictionary<string, string> { { "playerCount", playerCount.ToString() } },
                OnClickAction = () => EventBus.Publish("NavigateToRoom", roomId)
            };
            AddActivity(item);
        }

        /// <summary>
        /// Logs that an event is starting soon.
        /// </summary>
        /// <param name="eventName">Name of the event.</param>
        /// <param name="roomId">Room where the event is hosted.</param>
        /// <param name="minutesUntil">Minutes until the event starts.</param>
        public void LogEventStarting(string eventName, string roomId, int minutesUntil)
        {
            var item = new ActivityItem
            {
                Type = ActivityType.EventStarting,
                Category = ActivityCategory.Events,
                Title = "Event Starting Soon",
                Description = $"{eventName} starts in {minutesUntil} minute(s)!",
                TargetId = roomId,
                TargetName = eventName,
                Metadata = new Dictionary<string, string> { { "minutesUntil", minutesUntil.ToString() } },
                OnClickAction = () => EventBus.Publish("NavigateToEvent", roomId)
            };
            AddActivity(item);
        }

        /// <summary>
        /// Logs a minigame queue status update.
        /// </summary>
        /// <param name="minigameName">Name of the minigame.</param>
        /// <param name="playersNeeded">Players still needed to start.</param>
        public void LogMinigameQueue(string minigameName, int playersNeeded)
        {
            var item = new ActivityItem
            {
                Type = ActivityType.MinigameQueue,
                Category = ActivityCategory.Minigames,
                Title = "Minigame Queue",
                Description = $"{minigameName} needs {playersNeeded} more player(s)!",
                TargetName = minigameName,
                Metadata = new Dictionary<string, string> { { "playersNeeded", playersNeeded.ToString() } },
                OnClickAction = () => EventBus.Publish("JoinMinigameQueue", minigameName)
            };
            AddActivity(item);
        }

        /// <summary>
        /// Logs a newly created room.
        /// </summary>
        /// <param name="roomId">The room ID.</param>
        /// <param name="roomName">The room name.</param>
        /// <param name="ownerName">The owner/creator name.</param>
        public void LogNewRoom(string roomId, string roomName, string ownerName)
        {
            var item = new ActivityItem
            {
                Type = ActivityType.NewRoom,
                Category = ActivityCategory.Rooms,
                Title = "New Room Opened",
                Description = $"{ownerName} opened a new room: {roomName}!",
                ActorName = ownerName,
                TargetId = roomId,
                TargetName = roomName,
                OnClickAction = () => EventBus.Publish("NavigateToRoom", roomId)
            };
            AddActivity(item);
        }

        /// <summary>
        /// Logs a player achievement unlock.
        /// </summary>
        /// <param name="playerId">The player who earned the achievement.</param>
        /// <param name="achievementName">Name of the achievement.</param>
        public void LogAchievement(string playerId, string achievementName)
        {
            var item = new ActivityItem
            {
                Type = ActivityType.Achievement,
                Category = ActivityCategory.Friends,
                Title = "Achievement Unlocked",
                Description = $"A friend unlocked '{achievementName}'!",
                ActorId = playerId,
                TargetName = achievementName,
                OnClickAction = () => EventBus.Publish("ViewAchievement", achievementName)
            };
            AddActivity(item);
        }

        /// <summary>
        /// Logs a player milestone reached.
        /// </summary>
        /// <param name="playerId">The player who reached the milestone.</param>
        /// <param name="milestone">Description of the milestone.</param>
        public void LogMilestone(string playerId, string milestone)
        {
            var item = new ActivityItem
            {
                Type = ActivityType.Milestone,
                Category = ActivityCategory.Friends,
                Title = "Milestone Reached",
                Description = milestone,
                ActorId = playerId,
                OnClickAction = () => EventBus.Publish("ViewProfile", playerId)
            };
            AddActivity(item);
        }

        /// <summary>
        /// Generates the personalized recommendation subset of the feed.
        /// </summary>
        private void GenerateRecommendedFeed()
        {
            foreach (var item in CurrentFeed)
            {
                item.RelevanceScore = CalculateActivityRelevance(item);
                item.IsRecommended = item.RelevanceScore > 0.5f;
            }
        }

        /// <summary>
        /// Calculates a relevance score for the given activity based on player preferences.
        /// </summary>
        /// <param name="item">The activity to score.</param>
        /// <returns>A float score from 0.0 to 1.0.</returns>
        private float CalculateActivityRelevance(ActivityItem item)
        {
            float score = 0.5f;

            // Boost friend activities
            if (item.Category == ActivityCategory.Friends)
                score += 0.3f;

            // Boost events
            if (item.Category == ActivityCategory.Events)
                score += 0.2f;

            // Boost unread
            if (!item.IsRead)
                score += 0.1f;

            // Penalize old items
            long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            float hoursOld = (now - item.Timestamp) / 3600f;
            score -= hoursOld * 0.02f;

            // Boost items with click actions
            if (item.OnClickAction != null)
                score += 0.05f;

            return Mathf.Clamp01(score);
        }

        /// <summary>
        /// Sorts the feed by descending relevance score.
        /// </summary>
        private void SortFeedByRelevance()
        {
            if (UsePersonalization)
            {
                CurrentFeed = CurrentFeed.OrderByDescending(a => a.RelevanceScore)
                                          .ThenByDescending(a => a.Timestamp)
                                          .ToList();
            }
            else
            {
                CurrentFeed = CurrentFeed.OrderByDescending(a => a.Timestamp).ToList();
            }
        }

        /// <summary>
        /// Removes activities older than the expiry threshold.
        /// </summary>
        private void RemoveExpiredActivities()
        {
            long cutoff = DateTimeOffset.UtcNow.AddHours(-ActivityExpiryHours).ToUnixTimeSeconds();
            CurrentFeed.RemoveAll(a => a.Timestamp < cutoff);
        }

        /// <summary>
        /// Trims the feed to the maximum allowed size.
        /// </summary>
        private void TrimFeed()
        {
            if (CurrentFeed.Count > MaxFeedItems)
            {
                var overflow = CurrentFeed.Skip(MaxFeedItems).ToList();
                foreach (var item in overflow)
                {
                    if (item.IsRecommended)
                        _recommendedPool.Enqueue(item);
                }
                CurrentFeed = CurrentFeed.Take(MaxFeedItems).ToList();
            }
        }

        /// <summary>
        /// Applies the active category filter to the feed display.
        /// </summary>
        /// <param name="category">The category to filter by.</param>
        private void ApplyCategoryFilter(ActivityCategory category)
        {
            if (category == ActivityCategory.All) return;
            CurrentFeed = CurrentFeed.Where(a => a.Category == category).ToList();
        }

        /// <summary>
        /// Called when the instance is first created.
        /// </summary>
        protected override void Awake()
        {
            base.Awake();
            EventBus.Subscribe("FriendJoinedRoom", OnFriendJoinedRoomEvent);
            EventBus.Subscribe("TrendingRoomUpdated", OnTrendingRoomUpdated);
            EventBus.Subscribe("EventStarting", OnEventStarting);
        }

        /// <summary>
        /// Cleans up event subscriptions on destroy.
        /// </summary>
        protected override void OnDestroy()
        {
            base.OnDestroy();
            EventBus.Unsubscribe("FriendJoinedRoom", OnFriendJoinedRoomEvent);
            EventBus.Unsubscribe("TrendingRoomUpdated", OnTrendingRoomUpdated);
            EventBus.Unsubscribe("EventStarting", OnEventStarting);
        }

        private void OnFriendJoinedRoomEvent(object data)
        {
            if (data is string[] parts && parts.Length >= 2)
                LogFriendJoinedRoom(parts[0], parts[1]);
        }

        private void OnTrendingRoomUpdated(object data)
        {
            if (data is string[] parts && parts.Length >= 3)
            {
                if (int.TryParse(parts[2], out int count))
                    LogTrendingRoom(parts[0], parts[1], count);
            }
        }

        private void OnEventStarting(object data)
        {
            if (data is string[] parts && parts.Length >= 3)
            {
                if (int.TryParse(parts[2], out int minutes))
                    LogEventStarting(parts[0], parts[1], minutes);
            }
        }
    }
}
