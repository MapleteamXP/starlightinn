// ----------------------------------------------------------------------------
// KawaiiCool Island - Social Graph System
// ----------------------------------------------------------------------------
// PlayerProfile.cs - Rich player profile data model and manager
// ----------------------------------------------------------------------------
// Provides comprehensive player profile data including display info, stats,
// badges, outfit data, and progression. Syncs with PlayFab backend and
// supports thumbnail generation and real-time updates.
// ----------------------------------------------------------------------------

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using UnityEngine;
using KawaiiCoolIsland.Core;
using KawaiiCoolIsland.Core.Events;
using KawaiiCool.Backend;

#if PLAYFAB
using PlayFab.ClientModels;
#endif

namespace KawaiiCoolIsland.Social
{
    #region Data Models

    /// <summary>
    /// Rarity tiers for badges.
    /// </summary>
    public enum BadgeRarity
    {
        /// <summary>Common badge - easy to obtain.</summary>
        Common,
        /// <summary>Uncommon badge - requires some effort.</summary>
        Uncommon,
        /// <summary>Rare badge - challenging to obtain.</summary>
        Rare,
        /// <summary>Epic badge - very difficult to obtain.</summary>
        Epic,
        /// <summary>Legendary badge - extremely rare.</summary>
        Legendary
    }

    /// <summary>
    /// Badge categories for grouping and filtering.
    /// </summary>
    public enum BadgeCategory
    {
        /// <summary>Social interaction badges.</summary>
        Social,
        /// <summary>Gameplay and minigame badges.</summary>
        Gameplay,
        /// <summary>Exploration and discovery badges.</summary>
        Exploration,
        /// <summary>Collection and completion badges.</summary>
        Collection,
        /// <summary>Event-exclusive badges.</summary>
        Event,
        /// <summary>Special or hidden badges.</summary>
        Special
    }

    /// <summary>
    /// Rich player profile data container.
    /// </summary>
    [System.Serializable]
    public class PlayerProfile
    {
        /// <summary>The unique player identifier.</summary>
        public string PlayerId;

        /// <summary>The player's display name.</summary>
        public string DisplayName;

        /// <summary>Player's bio text. Max 200 characters.</summary>
        public string Bio;

        /// <summary>Serialized outfit JSON string.</summary>
        public string AvatarJson;

        /// <summary>Cached avatar thumbnail sprite.</summary>
        public Sprite AvatarThumbnail;

        /// <summary>Player's current level.</summary>
        public int Level;

        /// <summary>Current XP toward next level.</summary>
        public int XP;

        /// <summary>Total play time in minutes.</summary>
        public int TotalPlayTimeMinutes;

        /// <summary>Current room ID if in a room.</summary>
        public string CurrentRoomId;

        /// <summary>Current room name if in a room.</summary>
        public string CurrentRoomName;

        /// <summary>Number of friends.</summary>
        public int FriendsCount;

        /// <summary>Number of rooms owned by this player.</summary>
        public int RoomsOwned;

        /// <summary>Total minigames played.</summary>
        public int MinigamesPlayed;

        /// <summary>Total minigames won.</summary>
        public int MinigamesWon;

        /// <summary>Unix timestamp of account creation.</summary>
        public long AccountCreatedDate;

        /// <summary>Unix timestamp of last login.</summary>
        public long LastLoginDate;

        /// <summary>Earned badges.</summary>
        public List<BadgeData> Badges = new();

        /// <summary>Favorite room IDs.</summary>
        public List<string> FavoriteRooms = new();

        /// <summary>Named outfit preset JSONs.</summary>
        public List<string> OutfitPresets = new();

        /// <summary>Custom stat dictionary for extensible tracking.</summary>
        public Dictionary<string, int> Stats = new();
    }

    /// <summary>
    /// Encapsulates a profile update operation with field-level granularity.
    /// </summary>
    [System.Serializable]
    public class PlayerProfileUpdate
    {
        /// <summary>Fields to update in the player profile.</summary>
        public Dictionary<string, object> Fields = new();

        /// <summary>Whether to sync this update to the backend immediately.</summary>
        public bool SyncToBackend = true;
    }

    #endregion

    /// <summary>
    /// Manages the local player's profile and provides methods to fetch
    /// and update other players' profiles. Integrates with PlayFab for cloud
    /// persistence and supports real-time profile synchronization.
    /// </summary>
    public class PlayerProfileManager : Singleton<PlayerProfileManager>
    {
        #region Constants

        /// <summary>
        /// Save key for the local player profile.
        /// </summary>
        private const string PROFILE_SAVE_KEY = "PlayerProfile_MyProfile";

        /// <summary>
        /// Save key for the profile cache of other players.
        /// </summary>
        private const string PROFILE_CACHE_KEY = "PlayerProfile_Cache";

        /// <summary>
        /// Maximum length for player bio text.
        /// </summary>
        public const int MAX_BIO_LENGTH = 200;

        /// <summary>
        /// Maximum length for display name.
        /// </summary>
        public const int MAX_DISPLAY_NAME_LENGTH = 30;

        /// <summary>
        /// Cache expiration time for fetched profiles (hours).
        /// </summary>
        public const int PROFILE_CACHE_HOURS = 24;

        #endregion

        #region Fields

        /// <summary>
        /// The local player's profile.
        /// </summary>
        private PlayerProfile _myProfile;

        /// <summary>
        /// Cache of fetched profiles keyed by player ID.
        /// </summary>
        private readonly Dictionary<string, PlayerProfile> _profileCache = new();

        /// <summary>
        /// Timestamps for profile cache entries.
        /// </summary>
        private readonly Dictionary<string, long> _cacheTimestamps = new();

        /// <summary>
        /// Whether the profile manager has loaded local data.
        /// </summary>
        private bool _isLoaded;

        /// <summary>
        /// Lock for thread-safe profile operations.
        /// </summary>
        private readonly object _lock = new();

        #endregion

        #region Properties

        /// <summary>
        /// The local player's current profile. May be null if not loaded.
        /// </summary>
        public PlayerProfile MyProfile
        {
            get
            {
                lock (_lock)
                {
                    return _myProfile;
                }
            }
        }

        /// <summary>
        /// Whether the profile manager has loaded and is ready.
        /// </summary>
        public bool IsLoaded => _isLoaded;

        #endregion

        #region Events

        /// <summary>
        /// Fired when the local player's profile is updated.
        /// </summary>
        public event Action OnMyProfileUpdated;

        /// <summary>
        /// Fired when any profile is loaded. Parameter is the player ID.
        /// </summary>
        public event Action<string> OnProfileLoaded;

        /// <summary>
        /// Fired when the local player's avatar thumbnail changes.
        /// </summary>
        public event Action<Sprite> OnAvatarThumbnailChanged;

        #endregion

        #region Unity Lifecycle

        /// <summary>
        /// Called when the singleton awakes. Loads the local profile.
        /// </summary>
        protected override void OnSingletonAwake()
        {
            base.OnSingletonAwake();
            LoadMyProfile();
        }

        #endregion

        #region Local Profile Operations

        /// <summary>
        /// Loads the local player's profile from local save or creates a new one.
        /// </summary>
        public void LoadMyProfile()
        {
            lock (_lock)
            {
                _myProfile = SaveManager.Instance?.Load<PlayerProfile>(PROFILE_SAVE_KEY);

                if (_myProfile == null)
                {
                    _myProfile = CreateDefaultProfile();
                }
                else
                {
                    // Ensure dictionaries are initialized after JSON deserialization
                    _myProfile.Badges ??= new List<BadgeData>();
                    _myProfile.FavoriteRooms ??= new List<string>();
                    _myProfile.OutfitPresets ??= new List<string>();
                    _myProfile.Stats ??= new Dictionary<string, int>();
                }
            }

            _isLoaded = true;
            OnProfileLoaded?.Invoke(_myProfile.PlayerId);
            Debug.Log($"[PlayerProfileManager] Loaded profile for {_myProfile.DisplayName} (Lv{_myProfile.Level})");
        }

        /// <summary>
        /// Applies a batch update to the local player's profile.
        /// </summary>
        /// <param name="update">The update containing fields to change.</param>
        public void UpdateProfile(PlayerProfileUpdate update)
        {
            if (update?.Fields == null || update.Fields.Count == 0) return;

            lock (_lock)
            {
                if (_myProfile == null) return;

                foreach (var kvp in update.Fields)
                {
                    ApplyProfileField(kvp.Key, kvp.Value);
                }

                _myProfile.LastLoginDate = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            }

            SaveMyProfile();
            OnMyProfileUpdated?.Invoke();

            if (update.SyncToBackend)
            {
                _ = SyncProfileToBackend();
            }
        }

        /// <summary>
        /// Updates the local player's bio text.
        /// </summary>
        /// <param name="newBio">The new bio text. Truncated to 200 characters if too long.</param>
        public void UpdateBio(string newBio)
        {
            if (newBio == null) newBio = string.Empty;
            if (newBio.Length > MAX_BIO_LENGTH)
                newBio = newBio.Substring(0, MAX_BIO_LENGTH);

            lock (_lock)
            {
                if (_myProfile == null) return;
                _myProfile.Bio = newBio;
            }

            SaveMyProfile();
            OnMyProfileUpdated?.Invoke();
            EventBus.Instance.Publish(new ProfileUpdatedEvent
            {
                PlayerId = _myProfile?.PlayerId,
                UpdatedField = "Bio",
                NewValue = newBio
            });

            Debug.Log($"[PlayerProfileManager] Bio updated.");
        }

        /// <summary>
        /// Updates the local player's display name.
        /// </summary>
        /// <param name="newName">The new display name. Truncated to 30 characters if too long.</param>
        public void UpdateDisplayName(string newName)
        {
            if (string.IsNullOrWhiteSpace(newName)) return;
            if (newName.Length > MAX_DISPLAY_NAME_LENGTH)
                newName = newName.Substring(0, MAX_DISPLAY_NAME_LENGTH);

            lock (_lock)
            {
                if (_myProfile == null) return;
                _myProfile.DisplayName = newName.Trim();
            }

            SaveMyProfile();
            OnMyProfileUpdated?.Invoke();
            EventBus.Instance.Publish(new ProfileUpdatedEvent
            {
                PlayerId = _myProfile?.PlayerId,
                UpdatedField = "DisplayName",
                NewValue = newName
            });

            Debug.Log($"[PlayerProfileManager] Display name updated to: {newName}");
        }

        /// <summary>
        /// Adds a badge to the local player's profile.
        /// </summary>
        /// <param name="badgeId">The badge identifier to add.</param>
        public void AddBadge(string badgeId)
        {
            if (string.IsNullOrEmpty(badgeId)) return;

            // Find the badge definition from BadgeManager
            BadgeData badge = null;
            if (BadgeManager.HasInstance)
            {
                badge = BadgeManager.Instance.AllBadges.FirstOrDefault(b => b.BadgeId == badgeId);
            }

            if (badge == null)
            {
                Debug.LogWarning($"[PlayerProfileManager] Badge {badgeId} not found in catalog.");
                return;
            }

            lock (_lock)
            {
                if (_myProfile == null) return;
                if (_myProfile.Badges.Any(b => b.BadgeId == badgeId))
                {
                    Debug.Log($"[PlayerProfileManager] Badge {badgeId} already earned.");
                    return;
                }

                _myProfile.Badges.Add(badge);
            }

            SaveMyProfile();
            OnMyProfileUpdated?.Invoke();
            EventBus.Instance.Publish(new BadgeEarnedEvent
            {
                BadgeId = badgeId,
                BadgeName = badge.DisplayName,
                Rarity = (int)badge.Rarity,
                Category = (int)badge.Category
            });

            Debug.Log($"[PlayerProfileManager] Badge earned: {badge.DisplayName}");
        }

        /// <summary>
        /// Updates a custom stat on the local player's profile.
        /// </summary>
        /// <param name="statName">The stat identifier.</param>
        /// <param name="value">The new value.</param>
        public void UpdateStat(string statName, int value)
        {
            if (string.IsNullOrEmpty(statName)) return;

            lock (_lock)
            {
                _myProfile?.Stats?.TryAdd(statName, 0);
                if (_myProfile?.Stats != null)
                    _myProfile.Stats[statName] = value;
            }

            SaveMyProfile();
        }

        /// <summary>
        /// Increments a custom stat by a given amount.
        /// </summary>
        /// <param name="statName">The stat identifier.</param>
        /// <param name="delta">The amount to add (can be negative).</param>
        public void IncrementStat(string statName, int delta = 1)
        {
            if (string.IsNullOrEmpty(statName)) return;

            lock (_lock)
            {
                if (_myProfile?.Stats == null) return;
                _myProfile.Stats.TryAdd(statName, 0);
                _myProfile.Stats[statName] += delta;
            }

            SaveMyProfile();
        }

        /// <summary>
        /// Sets the avatar thumbnail from a Texture2D.
        /// </summary>
        /// <param name="thumbnail">The thumbnail texture to set.</param>
        public void SetAvatarThumbnail(Texture2D thumbnail)
        {
            if (thumbnail == null) return;

            Sprite sprite = Sprite.Create(
                thumbnail,
                new Rect(0, 0, thumbnail.width, thumbnail.height),
                new Vector2(0.5f, 0.5f)
            );

            lock (_lock)
            {
                if (_myProfile != null)
                    _myProfile.AvatarThumbnail = sprite;
            }

            OnAvatarThumbnailChanged?.Invoke(sprite);
            OnMyProfileUpdated?.Invoke();
            Debug.Log("[PlayerProfileManager] Avatar thumbnail updated.");
        }

        /// <summary>
        /// Records that a minigame was played.
        /// </summary>
        /// <param name="won">Whether the minigame was won.</param>
        public void RecordMinigamePlayed(bool won)
        {
            lock (_lock)
            {
                if (_myProfile == null) return;
                _myProfile.MinigamesPlayed++;
                if (won) _myProfile.MinigamesWon++;
            }

            SaveMyProfile();
        }

        /// <summary>
        /// Records that a room was visited.
        /// </summary>
        /// <param name="roomId">The room ID visited.</param>
        public void RecordRoomVisit(string roomId)
        {
            if (string.IsNullOrEmpty(roomId)) return;

            lock (_lock)
            {
                if (_myProfile?.FavoriteRooms == null) return;
                if (!_myProfile.FavoriteRooms.Contains(roomId))
                {
                    _myProfile.FavoriteRooms.Add(roomId);
                }
            }

            SaveMyProfile();
        }

        #endregion

        #region Profile Fetching

        /// <summary>
        /// Fetches a player's profile from the backend or cache.
        /// </summary>
        /// <param name="playerId">The player ID to fetch.</param>
        /// <returns>The player profile, or null if unavailable.</returns>
        public async Task<PlayerProfile> GetProfile(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return null;

            // Check cache first
            lock (_lock)
            {
                if (_profileCache.TryGetValue(playerId, out var cached))
                {
                    if (_cacheTimestamps.TryGetValue(playerId, out var timestamp))
                    {
                        var age = DateTimeOffset.UtcNow.ToUnixTimeSeconds() - timestamp;
                        if (age < PROFILE_CACHE_HOURS * 3600)
                        {
                            return cached;
                        }
                    }
                }
            }

            // Fetch from backend
            var profile = await FetchProfileFromBackend(playerId);
            if (profile != null)
            {
                lock (_lock)
                {
                    _profileCache[playerId] = profile;
                    _cacheTimestamps[playerId] = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                }
            }

            OnProfileLoaded?.Invoke(playerId);
            return profile;
        }

        /// <summary>
        /// Gets a cached profile without backend fetch.
        /// </summary>
        /// <param name="playerId">The player ID to look up.</param>
        /// <returns>The cached profile, or null.</returns>
        public PlayerProfile GetCachedProfile(string playerId)
        {
            lock (_lock)
            {
                _profileCache.TryGetValue(playerId, out var profile);
                return profile;
            }
        }

        /// <summary>
        /// Clears the profile cache for a specific player or all players.
        /// </summary>
        /// <param name="playerId">Optional player ID to clear. Null clears all.</param>
        public void ClearProfileCache(string playerId = null)
        {
            lock (_lock)
            {
                if (string.IsNullOrEmpty(playerId))
                {
                    _profileCache.Clear();
                    _cacheTimestamps.Clear();
                }
                else
                {
                    _profileCache.Remove(playerId);
                    _cacheTimestamps.Remove(playerId);
                }
            }
        }

        #endregion

        #region Backend Integration

#if PLAYFAB
        /// <summary>
        /// Syncs the local profile to PlayFab cloud save.
        /// </summary>
        private async Task SyncProfileToBackend()
        {
            if (PlayFabManager.Instance?.IsLoggedIn != true) return;

            try
            {
                string json = JsonUtility.ToJson(_myProfile);
                await PlayFabManager.Instance.UpdatePlayerData("PlayerProfile", json);
                Debug.Log("[PlayerProfileManager] Profile synced to PlayFab.");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayerProfileManager] Failed to sync profile: {ex.Message}");
            }
        }

        /// <summary>
        /// Fetches a profile from PlayFab by player ID.
        /// </summary>
        private async Task<PlayerProfile> FetchProfileFromBackend(string playerId)
        {
            if (PlayFabManager.Instance?.IsLoggedIn != true) return null;

            try
            {
                var json = await PlayFabManager.Instance.GetPlayerData("PlayerProfile");
                if (!string.IsNullOrEmpty(json))
                {
                    return JsonUtility.FromJson<PlayerProfile>(json);
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayerProfileManager] Failed to fetch profile: {ex.Message}");
            }

            return null;
        }
#else
        private async Task SyncProfileToBackend()
        {
            await Task.Delay(1);
        }

        private async Task<PlayerProfile> FetchProfileFromBackend(string playerId)
        {
            await Task.Delay(1);
            return null;
        }
#endif

        #endregion

        #region Persistence

        /// <summary>
        /// Saves the local profile to local storage.
        /// </summary>
        private void SaveMyProfile()
        {
            lock (_lock)
            {
                if (_myProfile != null)
                {
                    SaveManager.Instance?.Save(PROFILE_SAVE_KEY, _myProfile);
                }
            }
        }

        /// <summary>
        /// Creates a default profile for a new player.
        /// </summary>
        private PlayerProfile CreateDefaultProfile()
        {
            return new PlayerProfile
            {
                PlayerId = SystemInfo.deviceUniqueIdentifier,
                DisplayName = "Kawaii Traveler",
                Bio = "Hello! I'm new to KawaiiCool Island!",
                AvatarJson = "{}",
                Level = 1,
                XP = 0,
                TotalPlayTimeMinutes = 0,
                FriendsCount = 0,
                RoomsOwned = 0,
                MinigamesPlayed = 0,
                MinigamesWon = 0,
                AccountCreatedDate = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                LastLoginDate = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                Badges = new List<BadgeData>(),
                FavoriteRooms = new List<string>(),
                OutfitPresets = new List<string>(),
                Stats = new Dictionary<string, int>()
            };
        }

        /// <summary>
        /// Applies a field update to the local profile using reflection.
        /// </summary>
        private void ApplyProfileField(string fieldName, object value)
        {
            if (_myProfile == null || string.IsNullOrEmpty(fieldName)) return;

            var field = typeof(PlayerProfile).GetField(fieldName);
            if (field != null && value != null && field.FieldType.IsAssignableFrom(value.GetType()))
            {
                field.SetValue(_myProfile, value);
            }
        }

        #endregion

        #region Utility

        /// <summary>
        /// Gets the total number of badges earned.
        /// </summary>
        public int BadgeCount
        {
            get
            {
                lock (_lock)
                {
                    return _myProfile?.Badges?.Count ?? 0;
                }
            }
        }

        /// <summary>
        /// Gets a specific stat value from the local profile.
        /// </summary>
        /// <param name="statName">The stat identifier.</param>
        /// <returns>The stat value, or 0 if not found.</returns>
        public int GetStat(string statName)
        {
            lock (_lock)
            {
                if (_myProfile?.Stats != null && _myProfile.Stats.TryGetValue(statName, out int value))
                    return value;
                return 0;
            }
        }

        /// <summary>
        /// Updates the friend count in the profile from SocialGraphManager.
        /// </summary>
        public void RefreshFriendCount()
        {
            lock (_lock)
            {
                if (_myProfile == null) return;
                _myProfile.FriendsCount = SocialGraphManager.Instance?.FriendCount ?? 0;
            }
            SaveMyProfile();
        }

        /// <summary>
        /// Resets the local profile to default values.
        /// </summary>
        [ContextMenu("Reset Profile")]
        public void ResetProfile()
        {
            lock (_lock)
            {
                _myProfile = CreateDefaultProfile();
            }
            SaveMyProfile();
            OnMyProfileUpdated?.Invoke();
            Debug.Log("[PlayerProfileManager] Profile reset to defaults.");
        }

        #endregion

        #region Editor

#if UNITY_EDITOR
        /// <summary>
        /// Editor helper to log the current profile state.
        /// </summary>
        [ContextMenu("Log Profile State")]
        private void EditorLogProfile()
        {
            lock (_lock)
            {
                if (_myProfile == null)
                {
                    Debug.Log("[PlayerProfileManager] No profile loaded.");
                    return;
                }

                Debug.Log("=== PlayerProfileManager State ===");
                Debug.Log($"PlayerId: {_myProfile.PlayerId}");
                Debug.Log($"DisplayName: {_myProfile.DisplayName}");
                Debug.Log($"Level: {_myProfile.Level} (XP: {_myProfile.XP})");
                Debug.Log($"Bio: {_myProfile.Bio}");
                Debug.Log($"PlayTime: {_myProfile.TotalPlayTimeMinutes} min");
                Debug.Log($"Friends: {_myProfile.FriendsCount} | Rooms: {_myProfile.RoomsOwned}");
                Debug.Log($"Minigames: {_myProfile.MinigamesPlayed} played, {_myProfile.MinigamesWon} won");
                Debug.Log($"Badges: {_myProfile.Badges?.Count ?? 0}");
                Debug.Log($"Stats: {_myProfile.Stats?.Count ?? 0}");
                Debug.Log($"Cache: {_profileCache.Count} profiles");
            }
        }
#endif

        #endregion
    }
}
