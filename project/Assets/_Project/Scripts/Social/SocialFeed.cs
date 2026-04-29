// ----------------------------------------------------------------------------
// KawaiiCool Island - Social Graph System
// ----------------------------------------------------------------------------
// SocialFeed.cs - Activity feed showing what friends are doing
// ----------------------------------------------------------------------------
// Manages a real-time social feed of friend activities, system events,
// trending rooms, and game announcements. Supports filtering, marking as read,
// and integration with the EventBus for decoupled feed item creation.
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
    /// Types of feed items that can appear in the social feed.
    /// </summary>
    public enum FeedType
    {
        /// <summary>A friend joined a room.</summary>
        FriendJoinedRoom,
        /// <summary>A friend earned a badge.</summary>
        FriendEarnedBadge,
        /// <summary>A friend created a new outfit.</summary>
        FriendNewOutfit,
        /// <summary>A friend won a minigame.</summary>
        FriendWonMinigame,
        /// <summary>A room is trending/popular.</summary>
        TrendingRoom,
        /// <summary>An event is about to start.</summary>
        EventStarting,
        /// <summary>A system-wide announcement.</summary>
        SystemAnnouncement,
        /// <summary>A player unlocked an achievement.</summary>
        AchievementUnlocked,
        /// <summary>A player leveled up.</summary>
        PlayerLeveledUp
    }

    /// <summary>
    /// Represents a single item in the social activity feed.
    /// </summary>
    [System.Serializable]
    public class FeedItem
    {
        /// <summary>The unique feed item identifier.</summary>
        public string ItemId;

        /// <summary>The type of feed item.</summary>
        public FeedType Type;

        /// <summary>The player ID who triggered this feed item.</summary>
        public string ActorId;

        /// <summary>The display name of the actor.</summary>
        public string ActorName;

        /// <summary>The target player ID if applicable.</summary>
        public string TargetId;

        /// <summary>The target display name if applicable.</summary>
        public string TargetName;

        /// <summary>Human-readable description of the feed item.</summary>
        public string Description;

        /// <summary>Unix timestamp when the feed item was created.</summary>
        public long Timestamp;

        /// <summary>Whether this item has been read by the local player.</summary>
        public bool IsRead;

        /// <summary>Thumbnail sprite for visual display.</summary>
        public Sprite Thumbnail;

        /// <summary>Additional metadata for extensibility.</summary>
        public Dictionary<string, string> Metadata = new();
    }

    #endregion

    /// <summary>
    /// Manages the social activity feed for KawaiiCool Island.
    /// Collects friend activities, system events, and trending content
    /// into a unified timeline. Supports read tracking and event-driven updates.
    /// </summary>
    public class SocialFeedManager : Singleton<SocialFeedManager>
    {
        #region Constants

        /// <summary>
        /// Save key for feed items.
        /// </summary>
        private const string FEED_SAVE_KEY = "SocialFeed_Items";

        /// <summary>
        /// Maximum number of feed items to retain.
        /// </summary>
        public const int DEFAULT_MAX_FEED_ITEMS = 50;

        /// <summary>
        /// Maximum age of feed items in days before automatic cleanup.
        /// </summary>
        public const int MAX_FEED_ITEM_AGE_DAYS = 7;

        #endregion

        #region Fields

        /// <summary>
        /// All feed items in chronological order (newest first).
        /// </summary>
        private readonly List<FeedItem> _feedItems = new();

        /// <summary>
        /// Lock for thread-safe feed operations.
        /// </summary>
        private readonly object _lock = new();

        #endregion

        #region Properties

        /// <summary>
        /// Maximum number of feed items to retain. Older items are pruned.
        /// </summary>
        public int MaxFeedItems { get; set; } = DEFAULT_MAX_FEED_ITEMS;

        /// <summary>
        /// Gets a copy of all feed items.
        /// </summary>
        public List<FeedItem> FeedItems
        {
            get
            {
                lock (_lock)
                {
                    return _feedItems.ToList();
                }
            }
        }

        #endregion

        #region Events

        /// <summary>
        /// Fired when a new feed item is added.
        /// </summary>
        public event Action<FeedItem> OnNewFeedItem;

        /// <summary>
        /// Fired when the feed is cleared.
        /// </summary>
        public event Action OnFeedCleared;

        /// <summary>
        /// Fired when a feed item is marked as read.
        /// Parameter is the item ID.
        /// </summary>
        public event Action<string> OnItemMarkedRead;

        #endregion

        #region Unity Lifecycle

        /// <summary>
        /// Called when the singleton awakes. Loads saved feed items.
        /// </summary>
        protected override void OnSingletonAwake()
        {
            base.OnSingletonAwake();
            LoadLocalData();
            PruneOldItems();
            SubscribeToEvents();
        }

        private void OnDestroy()
        {
            UnsubscribeFromEvents();
        }

        #endregion

        #region Feed Item Creation

        /// <summary>
        /// Adds a custom feed item to the feed.
        /// </summary>
        /// <param name="item">The feed item to add.</param>
        public void AddFeedItem(FeedItem item)
        {
            if (item == null) return;
            if (string.IsNullOrEmpty(item.ItemId))
                item.ItemId = Guid.NewGuid().ToString("N");

            lock (_lock)
            {
                _feedItems.Insert(0, item);
                PruneExcessItems();
            }

            SaveLocalData();
            OnNewFeedItem?.Invoke(item);
            EventBus.Instance.Publish(new FeedItemAddedEvent
            {
                ItemId = item.ItemId,
                FeedType = (int)item.Type,
                ActorName = item.ActorName,
                Description = item.Description
            });

            Debug.Log($"[SocialFeedManager] Added feed item: {item.Description}");
        }

        /// <summary>
        /// Adds a feed item for a friend joining a room.
        /// </summary>
        /// <param name="friendId">The friend's player ID.</param>
        /// <param name="friendName">The friend's display name.</param>
        /// <param name="roomName">The room name joined.</param>
        public void AddFriendJoinedRoomFeed(string friendId, string friendName, string roomName)
        {
            var item = new FeedItem
            {
                ItemId = Guid.NewGuid().ToString("N"),
                Type = FeedType.FriendJoinedRoom,
                ActorId = friendId,
                ActorName = friendName,
                Description = $"{friendName} joined {roomName}",
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                IsRead = false,
                Metadata = new Dictionary<string, string>
                {
                    { "roomName", roomName }
                }
            };
            AddFeedItem(item);
        }

        /// <summary>
        /// Adds a feed item for a friend earning a badge.
        /// </summary>
        /// <param name="friendId">The friend's player ID.</param>
        /// <param name="friendName">The friend's display name.</param>
        /// <param name="badgeName">The badge display name.</param>
        public void AddFriendEarnedBadgeFeed(string friendId, string friendName, string badgeName)
        {
            var item = new FeedItem
            {
                ItemId = Guid.NewGuid().ToString("N"),
                Type = FeedType.FriendEarnedBadge,
                ActorId = friendId,
                ActorName = friendName,
                Description = $"{friendName} earned the {badgeName} badge!",
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                IsRead = false,
                Metadata = new Dictionary<string, string>
                {
                    { "badgeName", badgeName }
                }
            };
            AddFeedItem(item);
        }

        /// <summary>
        /// Adds a feed item for a friend creating a new outfit.
        /// </summary>
        /// <param name="friendId">The friend's player ID.</param>
        /// <param name="friendName">The friend's display name.</param>
        /// <param name="outfitName">The outfit preset name.</param>
        public void AddFriendNewOutfitFeed(string friendId, string friendName, string outfitName)
        {
            var item = new FeedItem
            {
                ItemId = Guid.NewGuid().ToString("N"),
                Type = FeedType.FriendNewOutfit,
                ActorId = friendId,
                ActorName = friendName,
                Description = $"{friendName} created a new outfit: {outfitName}",
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                IsRead = false,
                Metadata = new Dictionary<string, string>
                {
                    { "outfitName", outfitName }
                }
            };
            AddFeedItem(item);
        }

        /// <summary>
        /// Adds a feed item for a friend winning a minigame.
        /// </summary>
        /// <param name="friendId">The friend's player ID.</param>
        /// <param name="friendName">The friend's display name.</param>
        /// <param name="minigameName">The minigame display name.</param>
        public void AddFriendWonMinigameFeed(string friendId, string friendName, string minigameName)
        {
            var item = new FeedItem
            {
                ItemId = Guid.NewGuid().ToString("N"),
                Type = FeedType.FriendWonMinigame,
                ActorId = friendId,
                ActorName = friendName,
                Description = $"{friendName} won at {minigameName}!",
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                IsRead = false,
                Metadata = new Dictionary<string, string>
                {
                    { "minigameName", minigameName }
                }
            };
            AddFeedItem(item);
        }

        /// <summary>
        /// Adds a feed item for a trending/popular room.
        /// </summary>
        /// <param name="roomName">The trending room name.</param>
        /// <param name="playerCount">The number of players in the room.</param>
        public void AddTrendingRoomFeed(string roomName, int playerCount)
        {
            var item = new FeedItem
            {
                ItemId = Guid.NewGuid().ToString("N"),
                Type = FeedType.TrendingRoom,
                ActorName = roomName,
                Description = $"{roomName} is trending with {playerCount} players!",
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                IsRead = false,
                Metadata = new Dictionary<string, string>
                {
                    { "roomName", roomName },
                    { "playerCount", playerCount.ToString() }
                }
            };
            AddFeedItem(item);
        }

        /// <summary>
        /// Adds a feed item for an upcoming event.
        /// </summary>
        /// <param name="eventName">The event name.</param>
        /// <param name="roomName">The room where the event will take place.</param>
        /// <param name="minutesUntilStart">Minutes until the event starts.</param>
        public void AddEventStartingFeed(string eventName, string roomName, int minutesUntilStart)
        {
            var item = new FeedItem
            {
                ItemId = Guid.NewGuid().ToString("N"),
                Type = FeedType.EventStarting,
                ActorName = eventName,
                Description = $"{eventName} starts in {minutesUntilStart} minutes at {roomName}!",
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                IsRead = false,
                Metadata = new Dictionary<string, string>
                {
                    { "eventName", eventName },
                    { "roomName", roomName },
                    { "minutesUntilStart", minutesUntilStart.ToString() }
                }
            };
            AddFeedItem(item);
        }

        /// <summary>
        /// Adds a system announcement to the feed.
        /// </summary>
        /// <param name="message">The announcement message.</param>
        /// <param name="priority">Whether this is a high-priority announcement.</param>
        public void AddSystemAnnouncement(string message, bool priority = false)
        {
            var item = new FeedItem
            {
                ItemId = Guid.NewGuid().ToString("N"),
                Type = FeedType.SystemAnnouncement,
                ActorName = "System",
                Description = message,
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                IsRead = !priority,
                Metadata = new Dictionary<string, string>
                {
                    { "priority", priority.ToString() }
                }
            };
            AddFeedItem(item);
        }

        /// <summary>
        /// Adds a feed item for a player leveling up.
        /// </summary>
        /// <param name="playerId">The player's ID.</param>
        /// <param name="playerName">The player's display name.</param>
        /// <param name="newLevel">The new level achieved.</param>
        public void AddPlayerLeveledUpFeed(string playerId, string playerName, int newLevel)
        {
            var item = new FeedItem
            {
                ItemId = Guid.NewGuid().ToString("N"),
                Type = FeedType.PlayerLeveledUp,
                ActorId = playerId,
                ActorName = playerName,
                Description = $"{playerName} reached level {newLevel}!",
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                IsRead = false,
                Metadata = new Dictionary<string, string>
                {
                    { "newLevel", newLevel.ToString() }
                }
            };
            AddFeedItem(item);
        }

        #endregion

        #region Feed Operations

        /// <summary>
        /// Clears all feed items.
        /// </summary>
        public void ClearFeed()
        {
            lock (_lock)
            {
                _feedItems.Clear();
            }

            SaveLocalData();
            OnFeedCleared?.Invoke();
            Debug.Log("[SocialFeedManager] Feed cleared.");
        }

        /// <summary>
        /// Gets feed items filtered to a specific player as the actor.
        /// </summary>
        /// <param name="playerId">The player ID to filter by.</param>
        /// <returns>List of matching feed items.</returns>
        public List<FeedItem> GetFeedForPlayer(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return new List<FeedItem>();

            lock (_lock)
            {
                return _feedItems.Where(item => item.ActorId == playerId).ToList();
            }
        }

        /// <summary>
        /// Gets feed items filtered by type.
        /// </summary>
        /// <param name="type">The feed type to filter by.</param>
        /// <returns>List of matching feed items.</returns>
        public List<FeedItem> GetFeedByType(FeedType type)
        {
            lock (_lock)
            {
                return _feedItems.Where(item => item.Type == type).ToList();
            }
        }

        /// <summary>
        /// Marks a specific feed item as read.
        /// </summary>
        /// <param name="itemId">The unique item ID to mark.</param>
        public void MarkItemRead(string itemId)
        {
            if (string.IsNullOrEmpty(itemId)) return;

            lock (_lock)
            {
                var item = _feedItems.FirstOrDefault(i => i.ItemId == itemId);
                if (item != null)
                {
                    item.IsRead = true;
                }
            }

            SaveLocalData();
            OnItemMarkedRead?.Invoke(itemId);
        }

        /// <summary>
        /// Marks all feed items as read.
        /// </summary>
        public void MarkAllRead()
        {
            lock (_lock)
            {
                foreach (var item in _feedItems)
                {
                    item.IsRead = true;
                }
            }

            SaveLocalData();
            Debug.Log("[SocialFeedManager] All items marked as read.");
        }

        /// <summary>
        /// Gets the count of unread feed items.
        /// </summary>
        /// <returns>Number of unread items.</returns>
        public int GetUnreadCount()
        {
            lock (_lock)
            {
                return _feedItems.Count(item => !item.IsRead);
            }
        }

        /// <summary>
        /// Gets only unread feed items.
        /// </summary>
        /// <returns>List of unread items, newest first.</returns>
        public List<FeedItem> GetUnreadItems()
        {
            lock (_lock)
            {
                return _feedItems.Where(item => !item.IsRead).ToList();
            }
        }

        #endregion

        #region Event Subscriptions

        /// <summary>
        /// Subscribes to relevant game events for automatic feed population.
        /// </summary>
        private void SubscribeToEvents()
        {
            EventBus.Instance.Subscribe<LevelUpEvent>(OnLevelUpEvent);
            EventBus.Instance.Subscribe<AchievementUnlockedEvent>(OnAchievementUnlocked);
            EventBus.Instance.Subscribe<FriendRequestAcceptedEvent>(OnFriendRequestAccepted);
            EventBus.Instance.Subscribe<FriendPresenceChangedEvent>(OnFriendPresenceChanged);
            EventBus.Instance.Subscribe<BadgeEarnedEvent>(OnBadgeEarned);
        }

        /// <summary>
        /// Unsubscribes from game events.
        /// </summary>
        private void UnsubscribeFromEvents()
        {
            if (!EventBus.HasInstance) return;
            EventBus.Instance.Unsubscribe<LevelUpEvent>(OnLevelUpEvent);
            EventBus.Instance.Unsubscribe<AchievementUnlockedEvent>(OnAchievementUnlocked);
            EventBus.Instance.Unsubscribe<FriendRequestAcceptedEvent>(OnFriendRequestAccepted);
            EventBus.Instance.Unsubscribe<FriendPresenceChangedEvent>(OnFriendPresenceChanged);
            EventBus.Instance.Unsubscribe<BadgeEarnedEvent>(OnBadgeEarned);
        }

        /// <summary>
        /// Handles level up events from the EventBus.
        /// </summary>
        private void OnLevelUpEvent(LevelUpEvent evt)
        {
            if (PlayerProfileManager.HasInstance)
            {
                string name = PlayerProfileManager.Instance.MyProfile?.DisplayName ?? "A player";
                string playerId = PlayerProfileManager.Instance.MyProfile?.PlayerId ?? "";
                AddPlayerLeveledUpFeed(playerId, name, evt.NewLevel);
            }
        }

        /// <summary>
        /// Handles achievement unlock events from the EventBus.
        /// </summary>
        private void OnAchievementUnlocked(AchievementUnlockedEvent evt)
        {
            var item = new FeedItem
            {
                ItemId = Guid.NewGuid().ToString("N"),
                Type = FeedType.AchievementUnlocked,
                ActorName = evt.AchievementName,
                Description = $"Achievement unlocked: {evt.AchievementName} - {evt.Description}",
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                IsRead = false,
                Metadata = new Dictionary<string, string>
                {
                    { "achievementId", evt.AchievementId }
                }
            };
            AddFeedItem(item);
        }

        /// <summary>
        /// Handles friend request accepted events from the EventBus.
        /// </summary>
        private void OnFriendRequestAccepted(FriendRequestAcceptedEvent evt)
        {
            var item = new FeedItem
            {
                ItemId = Guid.NewGuid().ToString("N"),
                Type = FeedType.SystemAnnouncement,
                ActorName = evt.PlayerName,
                Description = $"You are now friends with {evt.PlayerName}!",
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                IsRead = false
            };
            AddFeedItem(item);
        }

        /// <summary>
        /// Handles friend presence changed events from the EventBus.
        /// </summary>
        private void OnFriendPresenceChanged(FriendPresenceChangedEvent evt)
        {
            // Only add feed item when a friend comes online in a room
            if (evt.NewStatus == (int)PresenceStatus.InRoom && !string.IsNullOrEmpty(evt.NewLocation))
            {
                AddFriendJoinedRoomFeed(evt.FriendId, evt.FriendName, evt.NewLocation);
            }
        }

        /// <summary>
        /// Handles badge earned events from the EventBus.
        /// </summary>
        private void OnBadgeEarned(BadgeEarnedEvent evt)
        {
            if (PlayerProfileManager.HasInstance)
            {
                string name = PlayerProfileManager.Instance.MyProfile?.DisplayName ?? "A player";
                string playerId = PlayerProfileManager.Instance.MyProfile?.PlayerId ?? "";
                AddFriendEarnedBadgeFeed(playerId, name, evt.BadgeName);
            }
        }

        #endregion

        #region Maintenance

        /// <summary>
        /// Removes items that exceed the maximum count.
        /// </summary>
        private void PruneExcessItems()
        {
            while (_feedItems.Count > MaxFeedItems)
            {
                _feedItems.RemoveAt(_feedItems.Count - 1);
            }
        }

        /// <summary>
        /// Removes items older than the maximum age.
        /// </summary>
        private void PruneOldItems()
        {
            long cutoff = DateTimeOffset.UtcNow.AddDays(-MAX_FEED_ITEM_AGE_DAYS).ToUnixTimeSeconds();

            lock (_lock)
            {
                _feedItems.RemoveAll(item => item.Timestamp < cutoff);
            }
        }

        #endregion

        #region Persistence

        /// <summary>
        /// Serializable container for feed save data.
        /// </summary>
        [System.Serializable]
        private class FeedSaveData
        {
            public List<FeedItemSaveEntry> Items = new();
        }

        /// <summary>
        /// Serializable feed item entry for save/load.
        /// </summary>
        [System.Serializable]
        private class FeedItemSaveEntry
        {
            public string ItemId;
            public int Type;
            public string ActorId;
            public string ActorName;
            public string TargetId;
            public string TargetName;
            public string Description;
            public long Timestamp;
            public bool IsRead;
        }

        /// <summary>
        /// Saves feed data to local storage.
        /// </summary>
        private void SaveLocalData()
        {
            var saveData = new FeedSaveData();

            lock (_lock)
            {
                foreach (var item in _feedItems)
                {
                    saveData.Items.Add(new FeedItemSaveEntry
                    {
                        ItemId = item.ItemId,
                        Type = (int)item.Type,
                        ActorId = item.ActorId,
                        ActorName = item.ActorName,
                        TargetId = item.TargetId,
                        TargetName = item.TargetName,
                        Description = item.Description,
                        Timestamp = item.Timestamp,
                        IsRead = item.IsRead
                    });
                }
            }

            SaveManager.Instance?.Save(FEED_SAVE_KEY, saveData);
        }

        /// <summary>
        /// Loads feed data from local storage.
        /// </summary>
        private void LoadLocalData()
        {
            var saveData = SaveManager.Instance?.Load<FeedSaveData>(FEED_SAVE_KEY);
            if (saveData == null) return;

            lock (_lock)
            {
                _feedItems.Clear();
                foreach (var entry in saveData.Items)
                {
                    _feedItems.Add(new FeedItem
                    {
                        ItemId = entry.ItemId,
                        Type = (FeedType)entry.Type,
                        ActorId = entry.ActorId,
                        ActorName = entry.ActorName,
                        TargetId = entry.TargetId,
                        TargetName = entry.TargetName,
                        Description = entry.Description,
                        Timestamp = entry.Timestamp,
                        IsRead = entry.IsRead,
                        Metadata = new Dictionary<string, string>()
                    });
                }
            }

            Debug.Log($"[SocialFeedManager] Loaded {_feedItems.Count} feed items.");
        }

        #endregion

        #region Editor

#if UNITY_EDITOR
        /// <summary>
        /// Editor helper to log the current feed state.
        /// </summary>
        [ContextMenu("Log Feed State")]
        private void EditorLogFeed()
        {
            lock (_lock)
            {
                Debug.Log("=== SocialFeedManager State ===");
                Debug.Log($"Total Items: {_feedItems.Count} (Max: {MaxFeedItems})");
                Debug.Log($"Unread: {GetUnreadCount()}");
                foreach (var item in _feedItems.Take(10))
                {
                    Debug.Log($"  [{item.Type}] {(item.IsRead ? "R" : "U")} {item.ActorName}: {item.Description}");
                }
            }
        }

        /// <summary>
        /// Editor helper to add a test feed item.
        /// </summary>
        [ContextMenu("Add Test Feed Item")]
        private void EditorAddTestItem()
        {
            AddSystemAnnouncement("This is a test announcement from the editor!", priority: true);
        }
#endif

        #endregion
    }
}
