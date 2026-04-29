using System;
using System.Collections.Generic;
using UnityEngine;

namespace KawaiiCoolIsland.Rooms.Moderation
{
    /// <summary>
    /// Defines the privacy level for a room.
    /// </summary>
    public enum RoomPrivacy
    {
        /// <summary>Anyone can join.</summary>
        Public,
        /// <summary>Only friends can join.</summary>
        FriendsOnly,
        /// <summary>Invite-only access.</summary>
        Private,
        /// <summary>Requires a password to join.</summary>
        PasswordProtected
    }

    /// <summary>
    /// Room category used for discovery and filtering.
    /// </summary>
    public enum RoomCategory
    {
        Social,
        Hangout,
        Creative,
        Event,
        Shopping,
        MiniGame,
        Roleplay,
        Showcase,
        Other
    }

    /// <summary>
    /// Represents a player's permissions within a room.
    /// </summary>
    [System.Serializable]
    public class RoomPermissions
    {
        /// <summary>Permission to kick other players.</summary>
        public bool CanKick;
        /// <summary>Permission to mute other players.</summary>
        public bool CanMute;
        /// <summary>Permission to ban other players.</summary>
        public bool CanBan;
        /// <summary>Permission to edit room metadata.</summary>
        public bool CanEditRoom;
        /// <summary>Permission to move or edit furniture.</summary>
        public bool CanEditFurniture;
        /// <summary>Permission to control music playback.</summary>
        public bool CanControlMusic;
        /// <summary>Permission to invite players to the room.</summary>
        public bool CanInvite;
        /// <summary>Permission to manage co-host assignments.</summary>
        public bool CanManageCoHosts;

        /// <summary>
        /// Returns a set of full owner permissions.
        /// </summary>
        public static RoomPermissions Owner => new()
        {
            CanKick = true,
            CanMute = true,
            CanBan = true,
            CanEditRoom = true,
            CanEditFurniture = true,
            CanControlMusic = true,
            CanInvite = true,
            CanManageCoHosts = true
        };

        /// <summary>
        /// Returns a set of standard co-host permissions.
        /// </summary>
        public static RoomPermissions CoHost => new()
        {
            CanKick = true,
            CanMute = true,
            CanBan = false,
            CanEditRoom = false,
            CanEditFurniture = true,
            CanControlMusic = true,
            CanInvite = true,
            CanManageCoHosts = false
        };

        /// <summary>
        /// Returns default permissions for a regular guest.
        /// </summary>
        public static RoomPermissions Guest => new()
        {
            CanKick = false,
            CanMute = false,
            CanBan = false,
            CanEditRoom = false,
            CanEditFurniture = false,
            CanControlMusic = false,
            CanInvite = false,
            CanManageCoHosts = false
        };
    }

    /// <summary>
    /// Serializable data container for persisting room settings.
    /// </summary>
    [System.Serializable]
    public class RoomSettingsData
    {
        public string RoomId;
        public string RoomName;
        public string Description;
        public int Privacy;
        public string Password;
        public int MaxPlayers;
        public int Category;
        public List<string> Tags;
        public string Rules;
        public string WelcomeMessage;
        public bool AllowFurnitureEditing;
        public bool AllowMusicControl;
        public List<string> CoHosts;
        public List<string> EnabledFeatures;
    }

    /// <summary>
    /// Manages room settings, permissions, co-hosts, and feature toggles.
    /// Only room owners and co-hosts may modify settings.
    /// </summary>
    public class RoomSettingsManager : Singleton<RoomSettingsManager>
    {
        [Header("Current Room")]
        /// <summary>Gets the identifier of the currently loaded room.</summary>
        public string CurrentRoomId { get; private set; }

        /// <summary>Gets whether the local player is the room owner.</summary>
        public bool IsRoomOwner { get; private set; }

        /// <summary>Gets whether the local player is a co-host.</summary>
        public bool IsCoHost { get; private set; }

        /// <summary>Gets the local player's permissions in the current room.</summary>
        public RoomPermissions MyPermissions { get; private set; } = RoomPermissions.Guest;

        [Header("Settings")]
        [SerializeField] private string roomName = "My Room";
        [SerializeField] private string roomDescription = "";
        [SerializeField] private RoomPrivacy roomPrivacy = RoomPrivacy.Public;
        [SerializeField] private string roomPassword = "";
        [SerializeField] private int maxPlayers = 20;
        [SerializeField] private RoomCategory roomCategory = RoomCategory.Social;
        [SerializeField] private List<string> roomTags = new();
        [SerializeField] private string roomRules = "";
        [SerializeField] private string welcomeMessage = "Welcome to my room!";
        [SerializeField] private bool allowFurnitureEditing = false;
        [SerializeField] private bool allowMusicControl = true;

        [Header("Co-Hosts")]
        [SerializeField] private List<string> coHosts = new();

        [Header("Features")]
        [SerializeField] private List<string> enabledFeatures = new();

        private const string SettingsPrefix = "RoomSettings_";

        /// <summary>
        /// Invoked whenever any room setting is changed.
        /// </summary>
        public event Action OnSettingsChanged;

        /// <summary>
        /// Invoked when a co-host is added. Passes the player identifier.
        /// </summary>
        public event Action<string> OnCoHostAdded;

        /// <summary>
        /// Invoked when a co-host is removed. Passes the player identifier.
        /// </summary>
        public event Action<string> OnCoHostRemoved;

        /// <summary>
        /// Sets the room name. Requires edit permission.
        /// </summary>
        /// <param name="name">The new room name.</param>
        public void SetRoomName(string name)
        {
            if (!CanEdit()) return;
            roomName = string.IsNullOrWhiteSpace(name) ? "Unnamed Room" : name.Trim();
            OnSettingsChanged?.Invoke();
        }

        /// <summary>
        /// Gets the current room name.
        /// </summary>
        public string GetRoomName() => roomName;

        /// <summary>
        /// Sets the room description. Requires edit permission.
        /// </summary>
        /// <param name="description">The new description.</param>
        public void SetRoomDescription(string description)
        {
            if (!CanEdit()) return;
            roomDescription = description ?? "";
            OnSettingsChanged?.Invoke();
        }

        /// <summary>
        /// Gets the current room description.
        /// </summary>
        public string GetRoomDescription() => roomDescription;

        /// <summary>
        /// Sets the room privacy level. Requires edit permission.
        /// </summary>
        /// <param name="privacy">The desired privacy level.</param>
        public void SetRoomPrivacy(RoomPrivacy privacy)
        {
            if (!CanEdit()) return;
            roomPrivacy = privacy;
            OnSettingsChanged?.Invoke();
        }

        /// <summary>
        /// Gets the current room privacy level.
        /// </summary>
        public RoomPrivacy GetRoomPrivacy() => roomPrivacy;

        /// <summary>
        /// Sets the room join password. Requires edit permission.
        /// </summary>
        /// <param name="password">The new password. Empty clears it.</param>
        public void SetRoomPassword(string password)
        {
            if (!CanEdit()) return;
            roomPassword = password ?? "";
            OnSettingsChanged?.Invoke();
        }

        /// <summary>
        /// Gets the current room password.
        /// </summary>
        public string GetRoomPassword() => roomPassword;

        /// <summary>
        /// Sets the maximum number of players allowed. Requires edit permission.
        /// </summary>
        /// <param name="max">Maximum player count (clamped 1-100).</param>
        public void SetMaxPlayers(int max)
        {
            if (!CanEdit()) return;
            maxPlayers = Mathf.Clamp(max, 1, 100);
            OnSettingsChanged?.Invoke();
        }

        /// <summary>
        /// Gets the current maximum player count.
        /// </summary>
        public int GetMaxPlayers() => maxPlayers;

        /// <summary>
        /// Sets the room discovery category. Requires edit permission.
        /// </summary>
        /// <param name="category">The new category.</param>
        public void SetRoomCategory(RoomCategory category)
        {
            if (!CanEdit()) return;
            roomCategory = category;
            OnSettingsChanged?.Invoke();
        }

        /// <summary>
        /// Gets the current room category.
        /// </summary>
        public RoomCategory GetRoomCategory() => roomCategory;

        /// <summary>
        /// Sets the room tags for discovery. Requires edit permission.
        /// </summary>
        /// <param name="tags">The list of tags.</param>
        public void SetRoomTags(List<string> tags)
        {
            if (!CanEdit()) return;
            roomTags = tags ?? new List<string>();
            OnSettingsChanged?.Invoke();
        }

        /// <summary>
        /// Gets the current room tags.
        /// </summary>
        public List<string> GetRoomTags() => new(roomTags);

        /// <summary>
        /// Sets the room rules text. Requires edit permission.
        /// </summary>
        /// <param name="rules">The new rules text.</param>
        public void SetRoomRules(string rules)
        {
            if (!CanEdit()) return;
            roomRules = rules ?? "";
            OnSettingsChanged?.Invoke();
        }

        /// <summary>
        /// Gets the current room rules.
        /// </summary>
        public string GetRoomRules() => roomRules;

        /// <summary>
        /// Sets the welcome message shown to new visitors. Requires edit permission.
        /// </summary>
        /// <param name="message">The new welcome message.</param>
        public void SetWelcomeMessage(string message)
        {
            if (!CanEdit()) return;
            welcomeMessage = message ?? "";
            OnSettingsChanged?.Invoke();
        }

        /// <summary>
        /// Gets the current welcome message.
        /// </summary>
        public string GetWelcomeMessage() => welcomeMessage;

        /// <summary>
        /// Sets whether co-hosts can edit furniture. Requires owner permission.
        /// </summary>
        /// <param name="allow">True to allow furniture editing for co-hosts.</param>
        public void SetAllowFurnitureEditing(bool allow)
        {
            if (!IsRoomOwner) return;
            allowFurnitureEditing = allow;
            OnSettingsChanged?.Invoke();
        }

        /// <summary>
        /// Gets whether co-host furniture editing is enabled.
        /// </summary>
        public bool GetAllowFurnitureEditing() => allowFurnitureEditing;

        /// <summary>
        /// Sets whether co-hosts can control music. Requires owner permission.
        /// </summary>
        /// <param name="allow">True to allow music control for co-hosts.</param>
        public void SetAllowMusicControl(bool allow)
        {
            if (!IsRoomOwner) return;
            allowMusicControl = allow;
            OnSettingsChanged?.Invoke();
        }

        /// <summary>
        /// Gets whether co-host music control is enabled.
        /// </summary>
        public bool GetAllowMusicControl() => allowMusicControl;

        /// <summary>
        /// Adds a co-host to the room. Requires owner permission.
        /// </summary>
        /// <param name="playerId">The player identifier to promote.</param>
        public void AddCoHost(string playerId)
        {
            if (string.IsNullOrWhiteSpace(playerId)) return;
            if (!IsRoomOwner) return;
            if (coHosts.Contains(playerId)) return;

            coHosts.Add(playerId);
            OnCoHostAdded?.Invoke(playerId);
            OnSettingsChanged?.Invoke();
        }

        /// <summary>
        /// Removes a co-host from the room. Requires owner permission.
        /// </summary>
        /// <param name="playerId">The player identifier to demote.</param>
        public void RemoveCoHost(string playerId)
        {
            if (!IsRoomOwner) return;
            if (!coHosts.Contains(playerId)) return;

            coHosts.Remove(playerId);
            OnCoHostRemoved?.Invoke(playerId);
            OnSettingsChanged?.Invoke();
        }

        /// <summary>
        /// Returns a copy of the current co-host list.
        /// </summary>
        /// <returns>List of co-host player identifiers.</returns>
        public List<string> GetCoHosts() => new(coHosts);

        /// <summary>
        /// Checks whether a specific player is a co-host.
        /// </summary>
        /// <param name="playerId">The player identifier to check.</param>
        /// <returns>True if the player is a co-host.</returns>
        public bool IsCoHostOf(string playerId)
        {
            return !string.IsNullOrWhiteSpace(playerId) && coHosts.Contains(playerId);
        }

        /// <summary>
        /// Enables a named feature for the room. Requires owner permission.
        /// </summary>
        /// <param name="featureId">The feature identifier.</param>
        public void EnableFeature(string featureId)
        {
            if (!CanEdit() || string.IsNullOrWhiteSpace(featureId)) return;
            if (!enabledFeatures.Contains(featureId))
            {
                enabledFeatures.Add(featureId);
                OnSettingsChanged?.Invoke();
            }
        }

        /// <summary>
        /// Disables a named feature for the room. Requires owner permission.
        /// </summary>
        /// <param name="featureId">The feature identifier.</param>
        public void DisableFeature(string featureId)
        {
            if (!CanEdit() || string.IsNullOrWhiteSpace(featureId)) return;
            if (enabledFeatures.Contains(featureId))
            {
                enabledFeatures.Remove(featureId);
                OnSettingsChanged?.Invoke();
            }
        }

        /// <summary>
        /// Checks whether a named feature is enabled.
        /// </summary>
        /// <param name="featureId">The feature identifier.</param>
        /// <returns>True if the feature is enabled.</returns>
        public bool IsFeatureEnabled(string featureId)
        {
            return !string.IsNullOrWhiteSpace(featureId) && enabledFeatures.Contains(featureId);
        }

        /// <summary>
        /// Loads persisted room settings for the given room identifier.
        /// </summary>
        /// <param name="roomId">The room to load settings for.</param>
        public void LoadRoomSettings(string roomId)
        {
            if (string.IsNullOrWhiteSpace(roomId)) return;
            CurrentRoomId = roomId;

            string json = PlayerPrefs.GetString(SettingsPrefix + roomId, "");
            if (!string.IsNullOrEmpty(json))
            {
                try
                {
                    RoomSettingsData data = JsonUtility.FromJson<RoomSettingsData>(json);
                    ApplySettingsData(data);
                }
                catch (Exception ex)
                {
                    Debug.LogError($"[RoomSettingsManager] Failed to load settings for {roomId}: {ex.Message}");
                    ResetToDefaults();
                }
            }
            else
            {
                ResetToDefaults();
            }

            // Refresh local permission state
            UpdateLocalPermissions();
            OnSettingsChanged?.Invoke();
        }

        /// <summary>
        /// Persists current room settings to local storage.
        /// </summary>
        public void SaveRoomSettings()
        {
            if (string.IsNullOrWhiteSpace(CurrentRoomId)) return;

            RoomSettingsData data = BuildSettingsData();
            string json = JsonUtility.ToJson(data, true);
            PlayerPrefs.SetString(SettingsPrefix + CurrentRoomId, json);
            PlayerPrefs.Save();
        }

        /// <summary>
        /// Resets all settings to their default values.
        /// </summary>
        public void ResetToDefaults()
        {
            roomName = "My Room";
            roomDescription = "";
            roomPrivacy = RoomPrivacy.Public;
            roomPassword = "";
            maxPlayers = 20;
            roomCategory = RoomCategory.Social;
            roomTags = new List<string>();
            roomRules = "";
            welcomeMessage = "Welcome to my room!";
            allowFurnitureEditing = false;
            allowMusicControl = true;
            coHosts = new List<string>();
            enabledFeatures = new List<string>();
            OnSettingsChanged?.Invoke();
        }

        /// <summary>
        /// Sets whether the local player is the room owner.
        /// </summary>
        /// <param name="isOwner">True if the local player owns the room.</param>
        public void SetIsRoomOwner(bool isOwner)
        {
            IsRoomOwner = isOwner;
            UpdateLocalPermissions();
        }

        /// <summary>
        /// Sets whether the local player is a co-host.
        /// </summary>
        /// <param name="isCoHost">True if the local player is a co-host.</param>
        public void SetIsCoHost(bool isCoHost)
        {
            IsCoHost = isCoHost;
            UpdateLocalPermissions();
        }

        /// <summary>
        /// Checks if the local player has general edit permission.
        /// </summary>
        /// <returns>True if owner or co-host.</returns>
        public bool CanEdit() => IsRoomOwner || IsCoHost;

        /// <summary>
        /// Returns whether the local player can manage co-hosts.
        /// </summary>
        /// <returns>True if owner or has co-host management permission.</returns>
        public bool CanManageCoHosts() => IsRoomOwner || MyPermissions.CanManageCoHosts;

        /// <summary>
        /// Builds a serializable data snapshot of current settings.
        /// </summary>
        private RoomSettingsData BuildSettingsData()
        {
            return new RoomSettingsData
            {
                RoomId = CurrentRoomId,
                RoomName = roomName,
                Description = roomDescription,
                Privacy = (int)roomPrivacy,
                Password = roomPassword,
                MaxPlayers = maxPlayers,
                Category = (int)roomCategory,
                Tags = new List<string>(roomTags),
                Rules = roomRules,
                WelcomeMessage = welcomeMessage,
                AllowFurnitureEditing = allowFurnitureEditing,
                AllowMusicControl = allowMusicControl,
                CoHosts = new List<string>(coHosts),
                EnabledFeatures = new List<string>(enabledFeatures)
            };
        }

        /// <summary>
        /// Applies serialized data to current settings.
        /// </summary>
        /// <param name="data">The data to apply.</param>
        private void ApplySettingsData(RoomSettingsData data)
        {
            if (data == null) return;
            roomName = data.RoomName ?? "My Room";
            roomDescription = data.Description ?? "";
            roomPrivacy = (RoomPrivacy)Mathf.Clamp(data.Privacy, 0, 3);
            roomPassword = data.Password ?? "";
            maxPlayers = Mathf.Clamp(data.MaxPlayers, 1, 100);
            roomCategory = (RoomCategory)Mathf.Clamp(data.Category, 0, 8);
            roomTags = data.Tags ?? new List<string>();
            roomRules = data.Rules ?? "";
            welcomeMessage = data.WelcomeMessage ?? "Welcome!";
            allowFurnitureEditing = data.AllowFurnitureEditing;
            allowMusicControl = data.AllowMusicControl;
            coHosts = data.CoHosts ?? new List<string>();
            enabledFeatures = data.EnabledFeatures ?? new List<string>();
        }

        /// <summary>
        /// Recalculates the local player's permissions based on owner/co-host state.
        /// </summary>
        private void UpdateLocalPermissions()
        {
            if (IsRoomOwner)
            {
                MyPermissions = RoomPermissions.Owner;
            }
            else if (IsCoHost)
            {
                MyPermissions = RoomPermissions.CoHost;
                // Adjust dynamic furniture/music permissions
                MyPermissions.CanEditFurniture = allowFurnitureEditing;
                MyPermissions.CanControlMusic = allowMusicControl;
            }
            else
            {
                MyPermissions = RoomPermissions.Guest;
            }
        }

        /// <summary>
        /// Validates a password against the current room password.
        /// </summary>
        /// <param name="password">The password to validate.</param>
        /// <returns>True if valid or room is not password-protected.</returns>
        public bool ValidatePassword(string password)
        {
            if (roomPrivacy != RoomPrivacy.PasswordProtected) return true;
            return roomPassword.Equals(password ?? "");
        }

        /// <summary>
        /// Checks whether the room is currently at capacity.
        /// </summary>
        /// <param name="currentPlayerCount">The current number of players.</param>
        /// <returns>True if the room is full.</returns>
        public bool IsAtCapacity(int currentPlayerCount)
        {
            return currentPlayerCount >= maxPlayers;
        }

        private void OnEnable()
        {
            EventBus.RoomEntered += OnRoomEntered;
            EventBus.RoomExited += OnRoomExited;
        }

        private void OnDisable()
        {
            EventBus.RoomEntered -= OnRoomEntered;
            EventBus.RoomExited -= OnRoomExited;
        }

        private void OnRoomEntered(string roomId)
        {
            LoadRoomSettings(roomId);
        }

        private void OnRoomExited(string roomId)
        {
            SaveRoomSettings();
            CurrentRoomId = null;
            IsRoomOwner = false;
            IsCoHost = false;
            MyPermissions = RoomPermissions.Guest;
        }
    }
}
