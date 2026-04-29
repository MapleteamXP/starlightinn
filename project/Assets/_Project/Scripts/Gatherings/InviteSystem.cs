using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KawaiiCoolIsland.Gatherings
{
    /// <summary>
    /// Enumerates the different categories of invites that can be sent through the unified system.
    /// </summary>
    public enum InviteType
    {
        /// <summary>Invitation to visit a specific room.</summary>
        Room,

        /// <summary>Invitation to join a party.</summary>
        Party,

        /// <summary>Invitation to join a minigame.</summary>
        Minigame,

        /// <summary>Invitation to start a trade session.</summary>
        Trade,

        /// <summary>Friend request.</summary>
        FriendRequest,

        /// <summary>Invitation to attend a scheduled gathering.</summary>
        Gathering
    }

    /// <summary>
    /// Represents a single pending invite awaiting a response from the recipient.
    /// </summary>
    [System.Serializable]
    public class PendingInvite
    {
        /// <summary>The unique identifier for this invite.</summary>
        public string InviteId;

        /// <summary>The category of invite.</summary>
        public InviteType Type;

        /// <summary>The player who sent the invite.</summary>
        public string FromPlayerId;

        /// <summary>The display name of the sender.</summary>
        public string FromPlayerName;

        /// <summary>The intended recipient player.</summary>
        public string ToPlayerId;

        /// <summary>The target entity identifier (room, party, minigame, etc.).</summary>
        public string TargetId;

        /// <summary>The display name of the target.</summary>
        public string TargetName;

        /// <summary>Optional message attached by the sender.</summary>
        public string Message;

        /// <summary>Unix timestamp when the invite was sent.</summary>
        public long SentTime;

        /// <summary>Seconds remaining until the invite expires.</summary>
        public float ExpiresIn;

        /// <summary>Whether the invite was accepted.</summary>
        public bool IsAccepted;

        /// <summary>Whether the invite was declined.</summary>
        public bool IsDeclined;
    }

    /// <summary>
    /// Unified invite system handling all invitation flows for rooms, parties, minigames,
    /// trades, friend requests, and gatherings. Supports automatic expiration and navigation.
    /// </summary>
    public class InviteSystem : Singleton<InviteSystem>
    {
        // ─────────────────────────────────────────────────────────────
        // Config
        // ─────────────────────────────────────────────────────────────

        /// <summary>Maximum invites the local player may have pending from others.</summary>
        [Header("Invites")]
        [SerializeField]
        private int _maxPendingInvites = 20;

        /// <summary>Maximum invites the local player may have pending from others.</summary>
        public int MaxPendingInvites => _maxPendingInvites;

        /// <summary>Seconds before an invite automatically expires.</summary>
        [Header("Settings")]
        [SerializeField]
        private float _inviteTimeout = 60f;

        /// <summary>Seconds before an invite automatically expires.</summary>
        public float InviteTimeout => _inviteTimeout;

        /// <summary>Whether invites should be auto-declined when the player changes rooms.</summary>
        [SerializeField]
        private bool _autoDeclineOnRoomChange = true;

        /// <summary>Whether invites should be auto-declined when the player changes rooms.</summary>
        public bool AutoDeclineOnRoomChange => _autoDeclineOnRoomChange;

        // ─────────────────────────────────────────────────────────────
        // State
        // ─────────────────────────────────────────────────────────────

        /// <summary>Invites received by the local player that are awaiting action.</summary>
        public List<PendingInvite> PendingInvites = new();

        /// <summary>Invites sent by the local player that are awaiting a response.</summary>
        public List<PendingInvite> SentInvites = new();

        /// <summary>The local player's unique identifier.</summary>
        private string MyPlayerId => NetworkedPlayer.Instance?.PlayerId ?? string.Empty;

        /// <summary>The local player's display name.</summary>
        private string MyPlayerName => NetworkedPlayer.Instance?.PlayerName ?? "You";

        /// <summary>Accumulator for periodic expiration polling.</summary>
        private float _expirationTimer = 0f;

        // ─────────────────────────────────────────────────────────────
        // Events
        // ─────────────────────────────────────────────────────────────

        /// <summary>Raised when the local player receives a new invite.</summary>
        public event Action<PendingInvite> OnInviteReceived;

        /// <summary>Raised when an invite is accepted by the recipient.</summary>
        public event Action<PendingInvite> OnInviteAccepted;

        /// <summary>Raised when an invite is declined by the recipient.</summary>
        public event Action<PendingInvite> OnInviteDeclined;

        /// <summary>Raised when an invite expires without being acted upon.</summary>
        public event Action<PendingInvite> OnInviteExpired;

        // ─────────────────────────────────────────────────────────────
        // Lifecycle
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Subscribes to room change events for auto-decline behavior.
        /// </summary>
        protected override void Awake()
        {
            base.Awake();
            EventBus.Instance?.Subscribe<string>("RoomChanged", OnLocalPlayerRoomChanged);
        }

        /// <summary>
        /// Unsubscribes from events on destroy.
        /// </summary>
        protected override void OnDestroy()
        {
            EventBus.Instance?.Unsubscribe<string>("RoomChanged", OnLocalPlayerRoomChanged);
            base.OnDestroy();
        }

        /// <summary>
        /// Polls invite expiration every second.
        /// </summary>
        private void Update()
        {
            _expirationTimer += Time.deltaTime;
            if (_expirationTimer >= 1f)
            {
                _expirationTimer -= 1f;
                PruneExpiredInvites();
            }
        }

        // ─────────────────────────────────────────────────────────────
        // Sending
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Sends a new invite to another player.
        /// </summary>
        /// <param name="toPlayerId">The recipient player.</param>
        /// <param name="type">The type of invite.</param>
        /// <param name="targetId">The target entity ID (room, party, etc.).</param>
        /// <param name="message">Optional message text.</param>
        public void SendInvite(string toPlayerId, InviteType type, string targetId, string message = "")
        {
            if (string.IsNullOrEmpty(toPlayerId))
            {
                Debug.LogWarning("[InviteSystem] Cannot send invite to empty player ID.");
                return;
            }

            if (toPlayerId == MyPlayerId)
            {
                Debug.LogWarning("[InviteSystem] Cannot invite yourself.");
                return;
            }

            if (string.IsNullOrEmpty(targetId))
            {
                Debug.LogWarning("[InviteSystem] Target ID is required.");
                return;
            }

            // Prevent duplicate pending invites for same target + type
            var existing = SentInvites.FirstOrDefault(i =>
                i.ToPlayerId == toPlayerId && i.Type == type && i.TargetId == targetId && !i.IsAccepted && !i.IsDeclined);
            if (existing != null)
            {
                Debug.LogWarning("[InviteSystem] Duplicate invite already pending.");
                return;
            }

            var invite = new PendingInvite
            {
                InviteId = Guid.NewGuid().ToString(),
                Type = type,
                FromPlayerId = MyPlayerId,
                FromPlayerName = MyPlayerName,
                ToPlayerId = toPlayerId,
                TargetId = targetId,
                TargetName = ResolveTargetName(type, targetId),
                Message = message?.Trim() ?? string.Empty,
                SentTime = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                ExpiresIn = _inviteTimeout,
                IsAccepted = false,
                IsDeclined = false
            };

            SentInvites.Add(invite);
            Debug.Log($"[InviteSystem] Sent {type} invite to {toPlayerId} for target {targetId}");
            RpcSendInvite(invite);
        }

        /// <summary>
        /// Cancels a previously sent invite before the recipient acts on it.
        /// </summary>
        /// <param name="inviteId">The invite to cancel.</param>
        public void CancelInvite(string inviteId)
        {
            var invite = SentInvites.FirstOrDefault(i => i.InviteId == inviteId);
            if (invite == null)
            {
                Debug.LogWarning($"[InviteSystem] Sent invite {inviteId} not found.");
                return;
            }

            if (invite.IsAccepted || invite.IsDeclined)
            {
                Debug.LogWarning("[InviteSystem] Cannot cancel an already-resolved invite.");
                return;
            }

            SentInvites.Remove(invite);
            Debug.Log($"[InviteSystem] Cancelled invite {inviteId}");
            RpcCancelInvite(inviteId);
        }

        // ─────────────────────────────────────────────────────────────
        // Responding
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Accepts a pending invite and navigates to its target.
        /// </summary>
        /// <param name="inviteId">The invite to accept.</param>
        public void AcceptInvite(string inviteId)
        {
            var invite = PendingInvites.FirstOrDefault(i => i.InviteId == inviteId);
            if (invite == null)
            {
                Debug.LogWarning($"[InviteSystem] Pending invite {inviteId} not found.");
                return;
            }

            if (invite.IsDeclined)
            {
                Debug.LogWarning("[InviteSystem] Already declined.");
                return;
            }

            invite.IsAccepted = true;
            PendingInvites.Remove(invite);

            Debug.Log($"[InviteSystem] Accepted invite {inviteId} ({invite.Type})");
            OnInviteAccepted?.Invoke(invite);
            EventBus.Instance?.Publish("InviteAccepted", invite);

            NavigateToInviteTarget(invite);
            RpcAcceptInvite(invite.InviteId);
        }

        /// <summary>
        /// Declines a pending invite.
        /// </summary>
        /// <param name="inviteId">The invite to decline.</param>
        public void DeclineInvite(string inviteId)
        {
            var invite = PendingInvites.FirstOrDefault(i => i.InviteId == inviteId);
            if (invite == null)
            {
                Debug.LogWarning($"[InviteSystem] Pending invite {inviteId} not found.");
                return;
            }

            if (invite.IsAccepted)
            {
                Debug.LogWarning("[InviteSystem] Already accepted.");
                return;
            }

            invite.IsDeclined = true;
            PendingInvites.Remove(invite);

            Debug.Log($"[InviteSystem] Declined invite {inviteId}");
            OnInviteDeclined?.Invoke(invite);
            EventBus.Instance?.Publish("InviteDeclined", invite);
            RpcDeclineInvite(invite.InviteId);
        }

        /// <summary>
        /// Accepts every pending invite. Last navigable target wins.
        /// </summary>
        public void AcceptAllInvites()
        {
            var snapshot = new List<PendingInvite>(PendingInvites);
            foreach (var invite in snapshot)
                AcceptInvite(invite.InviteId);
        }

        /// <summary>
        /// Declines every pending invite.
        /// </summary>
        public void DeclineAllInvites()
        {
            var snapshot = new List<PendingInvite>(PendingInvites);
            foreach (var invite in snapshot)
                DeclineInvite(invite.InviteId);
        }

        // ─────────────────────────────────────────────────────────────
        // Queries
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Returns all pending invites sent by a specific player.
        /// </summary>
        /// <param name="playerId">The sender to filter by.</param>
        public List<PendingInvite> GetInvitesFrom(string playerId)
        {
            return PendingInvites
                .Where(i => i.FromPlayerId == playerId && !i.IsAccepted && !i.IsDeclined)
                .ToList();
        }

        /// <summary>
        /// Returns all pending invites sent to a specific player (from the local player's sent list).
        /// </summary>
        /// <param name="playerId">The recipient to filter by.</param>
        public List<PendingInvite> GetInvitesTo(string playerId)
        {
            return SentInvites
                .Where(i => i.ToPlayerId == playerId && !i.IsAccepted && !i.IsDeclined)
                .ToList();
        }

        /// <summary>
        /// Returns true if there is any pending invite from the specified player.
        /// </summary>
        /// <param name="playerId">The sender to check.</param>
        public bool HasPendingInviteFrom(string playerId)
        {
            return PendingInvites.Any(i => i.FromPlayerId == playerId && !i.IsAccepted && !i.IsDeclined);
        }

        /// <summary>
        /// Returns true if there is any pending invite sent to the specified player.
        /// </summary>
        /// <param name="playerId">The recipient to check.</param>
        public bool HasPendingInviteTo(string playerId)
        {
            return SentInvites.Any(i => i.ToPlayerId == playerId && !i.IsAccepted && !i.IsDeclined);
        }

        /// <summary>
        /// Returns the total number of pending invites awaiting the local player's response.
        /// </summary>
        public int GetPendingInviteCount()
        {
            return PendingInvites.Count(i => !i.IsAccepted && !i.IsDeclined);
        }

        // ─────────────────────────────────────────────────────────────
        // Internal
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Removes expired invites from both incoming and outgoing lists and raises events.
        /// </summary>
        private void PruneExpiredInvites()
        {
            long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

            var expiredIncoming = PendingInvites
                .Where(i => !i.IsAccepted && !i.IsDeclined && (now - i.SentTime) > i.ExpiresIn)
                .ToList();

            foreach (var inv in expiredIncoming)
            {
                PendingInvites.Remove(inv);
                Debug.Log($"[InviteSystem] Expired incoming invite {inv.InviteId} ({inv.Type})");
                OnInviteExpired?.Invoke(inv);
                EventBus.Instance?.Publish("InviteExpired", inv);
            }

            var expiredOutgoing = SentInvites
                .Where(i => !i.IsAccepted && !i.IsDeclined && (now - i.SentTime) > i.ExpiresIn)
                .ToList();

            foreach (var inv in expiredOutgoing)
            {
                SentInvites.Remove(inv);
                Debug.Log($"[InviteSystem] Expired outgoing invite {inv.InviteId} ({inv.Type})");
            }
        }

        /// <summary>
        /// Navigates the local player to the appropriate target based on the invite type.
        /// </summary>
        /// <param name="invite">The accepted invite.</param>
        private void NavigateToInviteTarget(PendingInvite invite)
        {
            switch (invite.Type)
            {
                case InviteType.Room:
                    EventBus.Instance?.Publish("RequestRoomChange", invite.TargetId);
                    break;

                case InviteType.Party:
                    PartyManager.Instance?.AcceptPartyInvite(invite.TargetId);
                    break;

                case InviteType.Minigame:
                    EventBus.Instance?.Publish("RequestMinigameJoin", invite.TargetId);
                    break;

                case InviteType.Trade:
                    EventBus.Instance?.Publish("RequestTradeStart", invite.FromPlayerId);
                    break;

                case InviteType.FriendRequest:
                    SocialGraphManager.Instance?.AcceptFriendRequest(invite.FromPlayerId);
                    break;

                case InviteType.Gathering:
                    EventBus.Instance?.Publish("RequestRoomChange",
                        GatheringManager.Instance?.GetGathering(invite.TargetId)?.RoomId ?? invite.TargetId);
                    break;

                default:
                    Debug.LogWarning($"[InviteSystem] Unknown invite type {invite.Type} for navigation.");
                    break;
            }
        }

        /// <summary>
        /// Resolves a human-readable display name for an invite target.
        /// </summary>
        private string ResolveTargetName(InviteType type, string targetId)
        {
            return type switch
            {
                InviteType.Room => RoomManager.Instance?.GetRoom(targetId)?.RoomName ?? targetId,
                InviteType.Party => PartyManager.Instance?.CurrentParty?.Description ?? targetId,
                InviteType.Gathering => GatheringManager.Instance?.GetGathering(targetId)?.Name ?? targetId,
                _ => targetId
            };
        }

        /// <summary>
        /// Auto-declines all room-related pending invites when the local player changes rooms.
        /// </summary>
        private void OnLocalPlayerRoomChanged(string roomId)
        {
            if (!_autoDeclineOnRoomChange) return;

            var toDecline = PendingInvites
                .Where(i => i.Type == InviteType.Room && !i.IsAccepted && !i.IsDeclined)
                .ToList();

            foreach (var inv in toDecline)
            {
                DeclineInvite(inv.InviteId);
                Debug.Log($"[InviteSystem] Auto-declined room invite {inv.InviteId} due to room change.");
            }
        }

        /// <summary>
        /// Call this when the local player receives an invite from the network layer.
        /// </summary>
        public void ReceiveInvite(PendingInvite invite)
        {
            if (invite == null) return;
            if (invite.ToPlayerId != MyPlayerId)
            {
                Debug.LogWarning("[InviteSystem] Received invite not addressed to local player.");
                return;
            }

            if (PendingInvites.Count >= _maxPendingInvites)
            {
                Debug.LogWarning($"[InviteSystem] Max pending invites reached ({_maxPendingInvites}). Discarding.");
                return;
            }

            // Prevent duplicates
            if (PendingInvites.Any(i => i.InviteId == invite.InviteId)) return;

            PendingInvites.Add(invite);
            Debug.Log($"[InviteSystem] Received {invite.Type} invite from {invite.FromPlayerName}");
            OnInviteReceived?.Invoke(invite);
            EventBus.Instance?.Publish("InviteReceived", invite);
        }

        // ─────────────────────────────────────────────────────────────
        // Network RPC Stubs
        // ─────────────────────────────────────────────────────────────

        /// <summary>Stub: server RPC to send an invite.</summary>
        private void RpcSendInvite(PendingInvite invite) => Debug.Log($"[RPC] SendInvite {invite.InviteId} -> {invite.ToPlayerId}");

        /// <summary>Stub: server RPC to cancel an invite.</summary>
        private void RpcCancelInvite(string inviteId) => Debug.Log($"[RPC] CancelInvite {inviteId}");

        /// <summary>Stub: server RPC to accept an invite.</summary>
        private void RpcAcceptInvite(string inviteId) => Debug.Log($"[RPC] AcceptInvite {inviteId}");

        /// <summary>Stub: server RPC to decline an invite.</summary>
        private void RpcDeclineInvite(string inviteId) => Debug.Log($"[RPC] DeclineInvite {inviteId}");
    }
}
