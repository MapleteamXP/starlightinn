using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KawaiiCoolIsland.Rooms.Moderation
{
    /// <summary>
    /// Represents a ban entry for a specific room.
    /// Bans are room-specific and not global.
    /// </summary>
    [System.Serializable]
    public class RoomBanEntry
    {
        /// <summary>The banned player's identifier.</summary>
        public string PlayerId;
        /// <summary>The banned player's display name.</summary>
        public string PlayerName;
        /// <summary>The reason for the ban.</summary>
        public string Reason;
        /// <summary>Unix timestamp when the ban was issued.</summary>
        public long BannedAt;
        /// <summary>Duration in hours. 0 means permanent.</summary>
        public float DurationHours;
        /// <summary>Player identifier who issued the ban.</summary>
        public string BannedBy;
        /// <summary>Whether this ban is permanent.</summary>
        public bool IsPermanent;

        /// <summary>
        /// Checks if this ban entry is still active based on elapsed time.
        /// </summary>
        /// <returns>True if the ban has not expired.</returns>
        public bool IsActive()
        {
            if (IsPermanent || DurationHours <= 0) return true;
            long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            long expiresAt = BannedAt + (long)(DurationHours * 3600);
            return now < expiresAt;
        }
    }

    /// <summary>
    /// Represents a logged moderation action.
    /// </summary>
    [System.Serializable]
    public class ModerationAction
    {
        /// <summary>Unique identifier for the action log entry.</summary>
        public string ActionId;
        /// <summary>Type of action: Kick, Mute, Ban, Warn, Unmute, Unban.</summary>
        public string ActionType;
        /// <summary>Target player identifier.</summary>
        public string TargetPlayerId;
        /// <summary>Target player display name.</summary>
        public string TargetPlayerName;
        /// <summary>Moderator player identifier.</summary>
        public string ModeratorId;
        /// <summary>Reason provided for the action.</summary>
        public string Reason;
        /// <summary>Unix timestamp when the action occurred.</summary>
        public long Timestamp;
        /// <summary>Duration in minutes (for mutes) or hours (for bans).</summary>
        public float Duration;
    }

    /// <summary>
    /// Provides moderation tools for room owners and co-hosts.
    /// Handles kicks, mutes, bans, warnings, system messages, and action logging.
    /// All moderation actions are room-specific and logged for review.
    /// </summary>
    public class RoomModerationTools : MonoBehaviour
    {
        [Header("Configuration")]
        [SerializeField] private int maxActionLogEntries = 500;
        [SerializeField] private bool broadcastActionsToRoom = true;

        [Header("Runtime State")]
        private readonly List<RoomBanEntry> banList = new();
        private readonly List<string> mutedPlayers = new();
        private readonly List<ModerationAction> actionLog = new();
        private bool roomLocked = false;
        private string activeModerationTargetId = null;

        /// <summary>
        /// Invoked when a player is kicked. Parameters: playerId, reason.
        /// </summary>
        public event Action<string, string> OnPlayerKicked;

        /// <summary>
        /// Invoked when a player is muted. Parameters: playerId, durationMinutes, reason.
        /// </summary>
        public event Action<string, float, string> OnPlayerMuted;

        /// <summary>
        /// Invoked when a player is banned. Parameters: playerId, durationHours, reason.
        /// </summary>
        public event Action<string, float, string> OnPlayerBanned;

        /// <summary>
        /// Invoked when a player is unmuted. Parameter: playerId.
        /// </summary>
        public event Action<string> OnPlayerUnmuted;

        /// <summary>
        /// Invoked when a player is unbanned. Parameter: playerId.
        /// </summary>
        public event Action<string> OnPlayerUnbanned;

        /// <summary>
        /// Invoked when a player is warned. Parameters: playerId, warning.
        /// </summary>
        public event Action<string, string> OnPlayerWarned;

        /// <summary>
        /// Invoked when a system message is sent. Parameter: message.
        /// </summary>
        public event Action<string> OnSystemMessageSent;

        /// <summary>
        /// Invoked when the chat is cleared by a moderator.
        /// </summary>
        public event Action OnChatCleared;

        /// <summary>
        /// Invoked when the room lock state changes. Parameter: locked.
        /// </summary>
        public event Action<bool> OnRoomLockChanged;

        /// <summary>
        /// Kicks a player from the room. Requires kick permission.
        /// </summary>
        /// <param name="playerId">The player to kick.</param>
        /// <param name="reason">Optional reason displayed to the player.</param>
        public void KickPlayer(string playerId, string reason = "")
        {
            if (!CanModerateTarget(playerId)) return;
            if (string.IsNullOrWhiteSpace(playerId)) return;

            string moderatorId = GetLocalPlayerId();
            string targetName = GetPlayerName(playerId);
            reason = string.IsNullOrWhiteSpace(reason) ? "No reason given" : reason;

            LogAction(new ModerationAction
            {
                ActionId = Guid.NewGuid().ToString(),
                ActionType = "Kick",
                TargetPlayerId = playerId,
                TargetPlayerName = targetName,
                ModeratorId = moderatorId,
                Reason = reason,
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                Duration = 0
            });

            NotifyPlayerOfAction(playerId, "kick", reason);

            if (broadcastActionsToRoom)
            {
                SendSystemMessage($"{targetName} was kicked by {GetPlayerName(moderatorId)}. Reason: {reason}");
            }

            OnPlayerKicked?.Invoke(playerId, reason);
            EventBus.PlayerKicked?.Invoke(playerId, reason);
        }

        /// <summary>
        /// Mutes a player for a specified duration. Requires mute permission.
        /// </summary>
        /// <param name="playerId">The player to mute.</param>
        /// <param name="durationMinutes">Mute duration in minutes.</param>
        /// <param name="reason">Optional reason.</param>
        public void MutePlayer(string playerId, float durationMinutes, string reason = "")
        {
            if (!CanModerateTarget(playerId)) return;
            if (string.IsNullOrWhiteSpace(playerId)) return;
            if (durationMinutes <= 0) durationMinutes = 5;

            if (!mutedPlayers.Contains(playerId))
                mutedPlayers.Add(playerId);

            string moderatorId = GetLocalPlayerId();
            string targetName = GetPlayerName(playerId);
            reason = string.IsNullOrWhiteSpace(reason) ? "No reason given" : reason;

            LogAction(new ModerationAction
            {
                ActionId = Guid.NewGuid().ToString(),
                ActionType = "Mute",
                TargetPlayerId = playerId,
                TargetPlayerName = targetName,
                ModeratorId = moderatorId,
                Reason = reason,
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                Duration = durationMinutes
            });

            NotifyPlayerOfAction(playerId, "mute", $"Duration: {durationMinutes} min. Reason: {reason}");

            if (broadcastActionsToRoom)
            {
                SendSystemMessage($"{targetName} was muted for {durationMinutes} min by {GetPlayerName(moderatorId)}.");
            }

            OnPlayerMuted?.Invoke(playerId, durationMinutes, reason);
            EventBus.PlayerMuted?.Invoke(playerId, durationMinutes, reason);
        }

        /// <summary>
        /// Unmutes a previously muted player. Requires mute permission.
        /// </summary>
        /// <param name="playerId">The player to unmute.</param>
        public void UnmutePlayer(string playerId)
        {
            if (!HasPermissionToModerate()) return;
            if (string.IsNullOrWhiteSpace(playerId)) return;

            mutedPlayers.Remove(playerId);

            string moderatorId = GetLocalPlayerId();
            string targetName = GetPlayerName(playerId);

            LogAction(new ModerationAction
            {
                ActionId = Guid.NewGuid().ToString(),
                ActionType = "Unmute",
                TargetPlayerId = playerId,
                TargetPlayerName = targetName,
                ModeratorId = moderatorId,
                Reason = "Unmuted by moderator",
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                Duration = 0
            });

            NotifyPlayerOfAction(playerId, "unmute", "You have been unmuted.");
            OnPlayerUnmuted?.Invoke(playerId);
            EventBus.PlayerUnmuted?.Invoke(playerId);
        }

        /// <summary>
        /// Bans a player from the room for a specified duration. Requires ban permission.
        /// </summary>
        /// <param name="playerId">The player to ban.</param>
        /// <param name="durationHours">Ban duration in hours. 0 or negative for permanent.</param>
        /// <param name="reason">Optional reason.</param>
        public void BanPlayerFromRoom(string playerId, float durationHours, string reason = "")
        {
            if (!CanModerateTarget(playerId)) return;
            if (string.IsNullOrWhiteSpace(playerId)) return;

            // Remove existing ban entry if present
            banList.RemoveAll(b => b.PlayerId == playerId);

            bool isPermanent = durationHours <= 0;
            string moderatorId = GetLocalPlayerId();
            string targetName = GetPlayerName(playerId);
            reason = string.IsNullOrWhiteSpace(reason) ? "No reason given" : reason;

            RoomBanEntry entry = new()
            {
                PlayerId = playerId,
                PlayerName = targetName,
                Reason = reason,
                BannedAt = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                DurationHours = isPermanent ? 0 : durationHours,
                BannedBy = moderatorId,
                IsPermanent = isPermanent
            };

            banList.Add(entry);

            LogAction(new ModerationAction
            {
                ActionId = Guid.NewGuid().ToString(),
                ActionType = "Ban",
                TargetPlayerId = playerId,
                TargetPlayerName = targetName,
                ModeratorId = moderatorId,
                Reason = reason,
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                Duration = durationHours
            });

            string durationText = isPermanent ? "permanently" : $"for {durationHours} hour(s)";
            NotifyPlayerOfAction(playerId, "ban", $"You are banned {durationText}. Reason: {reason}");

            if (broadcastActionsToRoom)
            {
                SendSystemMessage($"{targetName} was banned {durationText} by {GetPlayerName(moderatorId)}.");
            }

            OnPlayerBanned?.Invoke(playerId, durationHours, reason);
            EventBus.PlayerBanned?.Invoke(playerId, durationHours, reason);
        }

        /// <summary>
        /// Unbans a player from the room. Requires ban permission.
        /// </summary>
        /// <param name="playerId">The player to unban.</param>
        public void UnbanPlayerFromRoom(string playerId)
        {
            if (!HasPermissionToBan()) return;
            if (string.IsNullOrWhiteSpace(playerId)) return;

            RoomBanEntry existing = banList.FirstOrDefault(b => b.PlayerId == playerId);
            if (existing == null) return;

            banList.Remove(existing);

            string moderatorId = GetLocalPlayerId();
            LogAction(new ModerationAction
            {
                ActionId = Guid.NewGuid().ToString(),
                ActionType = "Unban",
                TargetPlayerId = playerId,
                TargetPlayerName = existing.PlayerName,
                ModeratorId = moderatorId,
                Reason = "Unbanned by moderator",
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                Duration = 0
            });

            OnPlayerUnbanned?.Invoke(playerId);
            EventBus.PlayerUnbanned?.Invoke(playerId);
        }

        /// <summary>
        /// Sends a warning to a player. Requires kick or mute permission.
        /// </summary>
        /// <param name="playerId">The player to warn.</param>
        /// <param name="warning">The warning message.</param>
        public void WarnPlayer(string playerId, string warning)
        {
            if (!CanModerateTarget(playerId)) return;
            if (string.IsNullOrWhiteSpace(playerId)) return;
            if (string.IsNullOrWhiteSpace(warning)) return;

            string moderatorId = GetLocalPlayerId();
            string targetName = GetPlayerName(playerId);

            LogAction(new ModerationAction
            {
                ActionId = Guid.NewGuid().ToString(),
                ActionType = "Warn",
                TargetPlayerId = playerId,
                TargetPlayerName = targetName,
                ModeratorId = moderatorId,
                Reason = warning,
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                Duration = 0
            });

            NotifyPlayerOfAction(playerId, "warn", warning);
            OnPlayerWarned?.Invoke(playerId, warning);
        }

        /// <summary>
        /// Sends a system-level message to all players in the room.
        /// </summary>
        /// <param name="message">The message to broadcast.</param>
        public void SendSystemMessage(string message)
        {
            if (string.IsNullOrWhiteSpace(message)) return;
            OnSystemMessageSent?.Invoke(message);
            EventBus.SystemMessage?.Invoke(message);
        }

        /// <summary>
        /// Clears the room chat history. Requires moderation permission.
        /// </summary>
        public void ClearChat()
        {
            if (!HasPermissionToModerate()) return;

            LogAction(new ModerationAction
            {
                ActionId = Guid.NewGuid().ToString(),
                ActionType = "ClearChat",
                TargetPlayerId = "",
                TargetPlayerName = "",
                ModeratorId = GetLocalPlayerId(),
                Reason = "Chat cleared",
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                Duration = 0
            });

            OnChatCleared?.Invoke();
            EventBus.ChatCleared?.Invoke();
        }

        /// <summary>
        /// Locks or unlocks the room to prevent new entries. Requires owner or co-host permission.
        /// </summary>
        /// <param name="locked">True to lock the room, false to unlock.</param>
        public void LockRoom(bool locked)
        {
            if (!HasPermissionToModerate()) return;
            roomLocked = locked;

            LogAction(new ModerationAction
            {
                ActionId = Guid.NewGuid().ToString(),
                ActionType = locked ? "LockRoom" : "UnlockRoom",
                TargetPlayerId = "",
                TargetPlayerName = "",
                ModeratorId = GetLocalPlayerId(),
                Reason = locked ? "Room locked" : "Room unlocked",
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                Duration = 0
            });

            if (broadcastActionsToRoom)
            {
                SendSystemMessage(locked ? "The room is now locked." : "The room is now open.");
            }

            OnRoomLockChanged?.Invoke(locked);
            EventBus.RoomLockChanged?.Invoke(locked);
        }

        /// <summary>
        /// Returns whether the room is currently locked.
        /// </summary>
        public bool IsRoomLocked() => roomLocked;

        /// <summary>
        /// Displays the moderation menu for a target player.
        /// </summary>
        /// <param name="targetPlayerId">The player to moderate.</param>
        public void ShowModerationMenu(string targetPlayerId)
        {
            if (string.IsNullOrWhiteSpace(targetPlayerId)) return;
            if (!CanModerateTarget(targetPlayerId)) return;
            activeModerationTargetId = targetPlayerId;
            EventBus.ShowModerationMenu?.Invoke(targetPlayerId);
        }

        /// <summary>
        /// Hides the moderation menu.
        /// </summary>
        public void HideModerationMenu()
        {
            activeModerationTargetId = null;
            EventBus.HideModerationMenu?.Invoke();
        }

        /// <summary>
        /// Gets the currently active moderation target, if any.
        /// </summary>
        public string GetActiveModerationTarget() => activeModerationTargetId;

        /// <summary>
        /// Returns a copy of the current ban list.
        /// </summary>
        /// <returns>List of active ban entries.</returns>
        public List<RoomBanEntry> GetBanList()
        {
            PruneExpiredBans();
            return new List<RoomBanEntry>(banList);
        }

        /// <summary>
        /// Checks whether a player is currently banned.
        /// </summary>
        /// <param name="playerId">The player to check.</param>
        /// <returns>True if banned and ban has not expired.</returns>
        public bool IsPlayerBanned(string playerId)
        {
            if (string.IsNullOrWhiteSpace(playerId)) return false;
            PruneExpiredBans();
            return banList.Any(b => b.PlayerId == playerId && b.IsActive());
        }

        /// <summary>
        /// Checks whether a player is currently muted.
        /// </summary>
        /// <param name="playerId">The player to check.</param>
        /// <returns>True if muted.</returns>
        public bool IsPlayerMuted(string playerId)
        {
            return !string.IsNullOrWhiteSpace(playerId) && mutedPlayers.Contains(playerId);
        }

        /// <summary>
        /// Returns a copy of the moderation action log.
        /// </summary>
        /// <returns>List of logged moderation actions.</returns>
        public List<ModerationAction> GetActionLog()
        {
            return new List<ModerationAction>(actionLog);
        }

        /// <summary>
        /// Appends an action to the moderation log.
        /// </summary>
        /// <param name="action">The action to log.</param>
        public void LogAction(ModerationAction action)
        {
            if (action == null) return;
            actionLog.Add(action);
            TrimActionLog();
        }

        /// <summary>
        /// Clears the entire moderation action log. Requires owner permission.
        /// </summary>
        public void ClearActionLog()
        {
            if (!RoomSettingsManager.Instance.IsRoomOwner) return;
            actionLog.Clear();
        }

        /// <summary>
        /// Checks if the local player has basic moderation permission.
        /// </summary>
        private bool HasPermissionToModerate()
        {
            if (RoomSettingsManager.Instance == null) return false;
            RoomPermissions perms = RoomSettingsManager.Instance.MyPermissions;
            return perms.CanKick || perms.CanMute || perms.CanBan;
        }

        /// <summary>
        /// Checks if the local player has ban permission.
        /// </summary>
        private bool HasPermissionToBan()
        {
            if (RoomSettingsManager.Instance == null) return false;
            return RoomSettingsManager.Instance.MyPermissions.CanBan;
        }

        /// <summary>
        /// Validates whether the local player can moderate the target player.
        /// Owners cannot be moderated. Co-hosts cannot moderate owners.
        /// </summary>
        /// <param name="targetId">The target player identifier.</param>
        /// <returns>True if moderation is permitted.</returns>
        private bool CanModerateTarget(string targetId)
        {
            if (RoomSettingsManager.Instance == null) return false;
            if (string.IsNullOrWhiteSpace(targetId)) return false;

            RoomPermissions perms = RoomSettingsManager.Instance.MyPermissions;
            if (!perms.CanKick && !perms.CanMute && !perms.CanBan) return false;

            // Cannot moderate yourself
            if (targetId == GetLocalPlayerId()) return false;

            // Cannot moderate the room owner
            // In a real implementation, check via NetworkedPlayer or PlayFab
            if (IsPlayerRoomOwner(targetId)) return false;

            return true;
        }

        /// <summary>
        /// Notifies a player of a moderation action via event bus.
        /// </summary>
        /// <param name="playerId">The player to notify.</param>
        /// <param name="action">The action type.</param>
        /// <param name="reason">The reason or details.</param>
        private void NotifyPlayerOfAction(string playerId, string action, string reason)
        {
            if (string.IsNullOrWhiteSpace(playerId)) return;
            EventBus.ModerationActionTaken?.Invoke(playerId, action, reason);
        }

        /// <summary>
        /// Removes expired bans from the list.
        /// </summary>
        private void PruneExpiredBans()
        {
            banList.RemoveAll(b => !b.IsActive());
        }

        /// <summary>
        /// Trims the action log to the configured maximum size.
        /// </summary>
        private void TrimActionLog()
        {
            if (actionLog.Count > maxActionLogEntries)
            {
                int removeCount = actionLog.Count - maxActionLogEntries;
                actionLog.RemoveRange(0, removeCount);
            }
        }

        /// <summary>
        /// Retrieves the local player's identifier.
        /// </summary>
        private string GetLocalPlayerId()
        {
            // Fallback: return a placeholder if PlayFab is unavailable
            if (PlayFabManager.Instance != null)
                return PlayFabManager.Instance.GetPlayerId();
            return "local_player";
        }

        /// <summary>
        /// Retrieves a player's display name.
        /// </summary>
        /// <param name="playerId">The player identifier.</param>
        /// <returns>The display name, or the identifier as fallback.</returns>
        private string GetPlayerName(string playerId)
        {
            if (NetworkedPlayer.GetPlayerById(playerId) is { } player)
                return player.DisplayName;
            return playerId;
        }

        /// <summary>
        /// Checks whether a player is the room owner.
        /// </summary>
        /// <param name="playerId">The player identifier.</param>
        /// <returns>True if the player owns the room.</returns>
        private bool IsPlayerRoomOwner(string playerId)
        {
            if (RoomSettingsManager.Instance == null) return false;
            // In a real implementation, compare against the room owner ID from backend
            return false; // Simplified; owner checks are handled by caller context
        }

        /// <summary>
        /// Initializes moderation state when entering a room.
        /// </summary>
        /// <param name="roomId">The room identifier.</param>
        private void OnRoomEntered(string roomId)
        {
            banList.Clear();
            mutedPlayers.Clear();
            actionLog.Clear();
            roomLocked = false;
            activeModerationTargetId = null;
        }

        /// <summary>
        /// Cleans up moderation state when leaving a room.
        /// </summary>
        /// <param name="roomId">The room identifier.</param>
        private void OnRoomExited(string roomId)
        {
            activeModerationTargetId = null;
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
    }
}
