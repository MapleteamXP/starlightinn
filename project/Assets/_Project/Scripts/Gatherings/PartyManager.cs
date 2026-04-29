using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KawaiiCoolIsland.Gatherings
{
    /// <summary>
    /// Enumerates the types of activities a party can engage in.
    /// </summary>
    public enum PartyActivityType
    {
        Minigame,
        RoomTour,
        PhotoShoot,
        DanceParty,
        ScavengerHunt,
        Custom
    }

    /// <summary>
    /// Represents a single member within a party.
    /// </summary>
    [System.Serializable]
    public class PartyMember
    {
        /// <summary>The unique identifier of the player.</summary>
        public string PlayerId;

        /// <summary>The display name of the player.</summary>
        public string PlayerName;

        /// <summary>Whether this member is the party leader.</summary>
        public bool IsLeader;

        /// <summary>Whether the member is ready for an activity.</summary>
        public bool IsReady;

        /// <summary>The room the member is currently in.</summary>
        public string CurrentRoomId;

        /// <summary>Unix timestamp when the member joined.</summary>
        public long JoinedTime;

        /// <summary>Whether the member is auto-following the leader.</summary>
        public bool IsFollowingLeader;
    }

    /// <summary>
    /// Represents a pending party invitation.
    /// </summary>
    [System.Serializable]
    public class PartyInvite
    {
        /// <summary>The unique identifier of this invite.</summary>
        public string InviteId;

        /// <summary>The party this invite is for.</summary>
        public string PartyId;

        /// <summary>The player who sent the invite.</summary>
        public string FromPlayerId;

        /// <summary>The display name of the inviting player.</summary>
        public string FromPlayerName;

        /// <summary>The target player to receive the invite.</summary>
        public string ToPlayerId;

        /// <summary>Unix timestamp when the invite was sent.</summary>
        public long SentTime;

        /// <summary>Seconds until the invite expires.</summary>
        public float ExpiresIn;

        /// <summary>Whether the invite has been accepted.</summary>
        public bool IsAccepted;
    }

    /// <summary>
    /// Represents a party with members, invites, and activity state.
    /// </summary>
    [System.Serializable]
    public class Party
    {
        /// <summary>The unique identifier of this party.</summary>
        public string PartyId;

        /// <summary>The player ID of the current leader.</summary>
        public string LeaderId;

        /// <summary>The display name of the current leader.</summary>
        public string LeaderName;

        /// <summary>A user-provided description of the party.</summary>
        public string Description;

        /// <summary>All current members of the party.</summary>
        public List<PartyMember> Members = new();

        /// <summary>Invites that have been sent but not yet acted upon.</summary>
        public List<PartyInvite> PendingInvites = new();

        /// <summary>The room the party is currently assembled in.</summary>
        public string CurrentRoomId;

        /// <summary>Whether the party is publicly discoverable.</summary>
        public bool IsPublic;

        /// <summary>Unix timestamp when the party was created.</summary>
        public long CreatedTime;

        /// <summary>The currently active party activity, if any.</summary>
        public PartyActivityType? CurrentActivity;

        /// <summary>Votes for the next activity keyed by player ID.</summary>
        public Dictionary<string, int> ActivityVotes = new();
    }

    /// <summary>
    /// Manages party creation, membership, chat, invites, and group coordination.
    /// Integrates with <see cref="ChatManager"/>, <see cref="EventBus"/>, and networked player state.
    /// </summary>
    public class PartyManager : Singleton<PartyManager>
    {
        // ─────────────────────────────────────────────────────────────
        // Config
        // ─────────────────────────────────────────────────────────────

        /// <summary>The maximum number of players allowed in one party.</summary>
        [Header("Party")]
        [SerializeField]
        private int _maxPartySize = 8;

        /// <summary>The maximum number of players allowed in one party.</summary>
        public int MaxPartySize => _maxPartySize;

        /// <summary>Seconds before an invite automatically expires.</summary>
        [SerializeField]
        private float _inviteTimeout = 60f;

        /// <summary>Seconds before an invite automatically expires.</summary>
        public float InviteTimeout => _inviteTimeout;

        /// <summary>Whether non-friend players may be invited.</summary>
        [SerializeField]
        private bool _allowStrangers = false;

        /// <summary>Whether non-friend players may be invited.</summary>
        public bool AllowStrangers => _allowStrangers;

        // ─────────────────────────────────────────────────────────────
        // State
        // ─────────────────────────────────────────────────────────────

        /// <summary>The local player's current party, if any.</summary>
        public Party CurrentParty { get; private set; }

        /// <summary>True if the local player is currently in a party.</summary>
        public bool IsInParty => CurrentParty != null;

        /// <summary>True if the local player is the leader of their current party.</summary>
        public bool IsPartyLeader => CurrentParty?.LeaderId == MyPlayerId;

        /// <summary>The local player's unique identifier (stub).</summary>
        private string MyPlayerId => NetworkedPlayer.Instance?.PlayerId ?? string.Empty;

        /// <summary>The local player's display name (stub).</summary>
        private string MyPlayerName => NetworkedPlayer.Instance?.PlayerName ?? "You";

        /// <summary>Internal chat history for party messages.</summary>
        private readonly List<ChatMessage> _partyChatHistory = new();

        /// <summary>Internal timer tracking invite expirations.</summary>
        private float _inviteTimerAccumulator = 0f;

        // ─────────────────────────────────────────────────────────────
        // Events
        // ─────────────────────────────────────────────────────────────

        /// <summary>Raised when the local player creates a new party.</summary>
        public event Action<Party> OnPartyCreated;

        /// <summary>Raised when the local player's party is disbanded.</summary>
        public event Action OnPartyDisbanded;

        /// <summary>Raised when a player joins the local player's party.</summary>
        public event Action<string> OnPlayerJoinedParty;

        /// <summary>Raised when a player leaves the local player's party.</summary>
        public event Action<string> OnPlayerLeftParty;

        /// <summary>Raised when the local player receives a party invite.</summary>
        public event Action<string> OnPartyInviteReceived;

        /// <summary>Raised when a new party chat message arrives.</summary>
        public event Action<ChatMessage> OnPartyMessageReceived;

        // ─────────────────────────────────────────────────────────────
        // Lifecycle
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Initializes the party manager and subscribes to room change events.
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
        /// Updates invite timers each frame to expire stale invites.
        /// </summary>
        private void Update()
        {
            if (CurrentParty == null) return;
            _inviteTimerAccumulator += Time.deltaTime;
            if (_inviteTimerAccumulator >= 1f)
            {
                _inviteTimerAccumulator -= 1f;
                PruneExpiredInvites();
            }
        }

        // ─────────────────────────────────────────────────────────────
        // Party Lifecycle
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Creates a new party with the local player as leader.
        /// </summary>
        public void CreateParty()
        {
            if (IsInParty)
            {
                Debug.LogWarning("[PartyManager] Already in a party. Leave first.");
                return;
            }

            var party = new Party
            {
                PartyId = Guid.NewGuid().ToString(),
                LeaderId = MyPlayerId,
                LeaderName = MyPlayerName,
                Description = $"{MyPlayerName}'s Party",
                Members = new List<PartyMember>(),
                PendingInvites = new List<PartyInvite>(),
                CurrentRoomId = GetCurrentRoomId(),
                IsPublic = false,
                CreatedTime = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                CurrentActivity = null,
                ActivityVotes = new Dictionary<string, int>()
            };

            party.Members.Add(new PartyMember
            {
                PlayerId = MyPlayerId,
                PlayerName = MyPlayerName,
                IsLeader = true,
                IsReady = false,
                CurrentRoomId = party.CurrentRoomId,
                JoinedTime = party.CreatedTime,
                IsFollowingLeader = false
            });

            CurrentParty = party;
            _partyChatHistory.Clear();

            Debug.Log($"[PartyManager] Created party {party.PartyId}");
            OnPartyCreated?.Invoke(party);
            EventBus.Instance?.Publish("PartyCreated", party);

            // Stub: sync over network
            RpcCreateParty(party);
        }

        /// <summary>
        /// Disbands the current party (leader only). All members are removed.
        /// </summary>
        public void DisbandParty()
        {
            if (!IsInParty)
            {
                Debug.LogWarning("[PartyManager] Not in a party.");
                return;
            }

            if (!IsPartyLeader)
            {
                Debug.LogWarning("[PartyManager] Only the leader can disband.");
                return;
            }

            string partyId = CurrentParty.PartyId;
            CurrentParty = null;
            _partyChatHistory.Clear();

            Debug.Log($"[PartyManager] Disbanded party {partyId}");
            OnPartyDisbanded?.Invoke();
            EventBus.Instance?.Publish("PartyDisbanded", partyId);

            RpcDisbandParty(partyId);
        }

        /// <summary>
        /// Removes the local player from their current party.
        /// If the leader leaves, leadership is transferred automatically.
        /// </summary>
        public void LeaveParty()
        {
            if (!IsInParty)
            {
                Debug.LogWarning("[PartyManager] Not in a party.");
                return;
            }

            var party = CurrentParty;
            string myId = MyPlayerId;
            bool wasLeader = IsPartyLeader;

            var me = party.Members.FirstOrDefault(m => m.PlayerId == myId);
            if (me != null) party.Members.Remove(me);

            if (party.Members.Count == 0)
            {
                CurrentParty = null;
                _partyChatHistory.Clear();
                OnPartyDisbanded?.Invoke();
                EventBus.Instance?.Publish("PartyDisbanded", party.PartyId);
            }
            else
            {
                if (wasLeader)
                {
                    var next = party.Members.OrderBy(m => m.JoinedTime).FirstOrDefault();
                    if (next != null)
                    {
                        next.IsLeader = true;
                        party.LeaderId = next.PlayerId;
                        party.LeaderName = next.PlayerName;
                        RpcPromoteToLeader(party.PartyId, next.PlayerId);
                    }
                }
                OnPlayerLeftParty?.Invoke(myId);
                EventBus.Instance?.Publish("PlayerLeftParty", party.PartyId, myId);
            }

            CurrentParty = null;
            _partyChatHistory.Clear();
            Debug.Log($"[PartyManager] Left party {party.PartyId}");
            RpcLeaveParty(party.PartyId, myId);
        }

        // ─────────────────────────────────────────────────────────────
        // Invitations
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Sends a party invitation to another player.
        /// </summary>
        /// <param name="playerId">The target player's unique identifier.</param>
        public void InviteToParty(string playerId)
        {
            if (!IsInParty)
            {
                Debug.LogWarning("[PartyManager] Must be in a party to invite.");
                return;
            }

            if (!IsPartyLeader)
            {
                Debug.LogWarning("[PartyManager] Only the leader can invite.");
                return;
            }

            if (CurrentParty.Members.Count >= _maxPartySize)
            {
                Debug.LogWarning("[PartyManager] Party is full.");
                return;
            }

            if (CurrentParty.Members.Any(m => m.PlayerId == playerId))
            {
                Debug.LogWarning("[PartyManager] Player already in party.");
                return;
            }

            if (CurrentParty.PendingInvites.Any(i => i.ToPlayerId == playerId && !i.IsAccepted))
            {
                Debug.LogWarning("[PartyManager] Invite already pending.");
                return;
            }

            if (!_allowStrangers)
            {
                bool isFriend = SocialGraphManager.Instance?.AreFriends(MyPlayerId, playerId) ?? false;
                if (!isFriend)
                {
                    Debug.LogWarning("[PartyManager] Cannot invite strangers (AllowStrangers=false).");
                    return;
                }
            }

            var invite = new PartyInvite
            {
                InviteId = Guid.NewGuid().ToString(),
                PartyId = CurrentParty.PartyId,
                FromPlayerId = MyPlayerId,
                FromPlayerName = MyPlayerName,
                ToPlayerId = playerId,
                SentTime = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                ExpiresIn = _inviteTimeout,
                IsAccepted = false
            };

            CurrentParty.PendingInvites.Add(invite);
            Debug.Log($"[PartyManager] Invited {playerId} to party {CurrentParty.PartyId}");
            RpcSendPartyInvite(invite);
        }

        /// <summary>
        /// Accepts an incoming party invitation and joins that party.
        /// </summary>
        /// <param name="partyId">The identifier of the party to join.</param>
        public void AcceptPartyInvite(string partyId)
        {
            // Stub: in a full implementation this resolves against received invites.
            // For now we simulate joining a remote party.
            if (IsInParty)
            {
                Debug.LogWarning("[PartyManager] Already in a party. Leave first.");
                return;
            }

            // Remove from any invite system records
            InviteSystem.Instance?.DeclineAllInvites(); // clear UI clutter

            // In real networked flow, server would send Party snapshot.
            Debug.Log($"[PartyManager] Accepted invite to party {partyId}");
            EventBus.Instance?.Publish("PartyInviteAccepted", partyId, MyPlayerId);
            RpcAcceptPartyInvite(partyId, MyPlayerId);
        }

        /// <summary>
        /// Declines an incoming party invitation.
        /// </summary>
        /// <param name="partyId">The identifier of the party to decline.</param>
        public void DeclinePartyInvite(string partyId)
        {
            Debug.Log($"[PartyManager] Declined invite to party {partyId}");
            EventBus.Instance?.Publish("PartyInviteDeclined", partyId, MyPlayerId);
            RpcDeclinePartyInvite(partyId, MyPlayerId);
        }

        // ─────────────────────────────────────────────────────────────
        // Member Management
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Removes a member from the party (leader only).
        /// </summary>
        /// <param name="playerId">The player to kick.</param>
        public void KickFromParty(string playerId)
        {
            if (!IsInParty || !IsPartyLeader)
            {
                Debug.LogWarning("[PartyManager] Must be party leader to kick.");
                return;
            }

            if (playerId == MyPlayerId)
            {
                Debug.LogWarning("[PartyManager] Cannot kick yourself.");
                return;
            }

            var member = CurrentParty.Members.FirstOrDefault(m => m.PlayerId == playerId);
            if (member == null)
            {
                Debug.LogWarning("[PartyManager] Player not in party.");
                return;
            }

            CurrentParty.Members.Remove(member);
            OnPlayerLeftParty?.Invoke(playerId);
            EventBus.Instance?.Publish("PlayerLeftParty", CurrentParty.PartyId, playerId);
            Debug.Log($"[PartyManager] Kicked {playerId} from party.");
            RpcKickFromParty(CurrentParty.PartyId, playerId);
        }

        /// <summary>
        /// Promotes another member to party leader.
        /// </summary>
        /// <param name="playerId">The player to promote.</param>
        public void PromoteToLeader(string playerId)
        {
            if (!IsInParty || !IsPartyLeader)
            {
                Debug.LogWarning("[PartyManager] Must be leader to promote.");
                return;
            }

            var target = CurrentParty.Members.FirstOrDefault(m => m.PlayerId == playerId);
            if (target == null)
            {
                Debug.LogWarning("[PartyManager] Target not in party.");
                return;
            }

            // Demote self
            var me = CurrentParty.Members.FirstOrDefault(m => m.PlayerId == MyPlayerId);
            if (me != null) me.IsLeader = false;

            // Promote target
            target.IsLeader = true;
            CurrentParty.LeaderId = target.PlayerId;
            CurrentParty.LeaderName = target.PlayerName;

            Debug.Log($"[PartyManager] Promoted {playerId} to leader.");
            EventBus.Instance?.Publish("PartyLeaderChanged", CurrentParty.PartyId, playerId);
            RpcPromoteToLeader(CurrentParty.PartyId, playerId);
        }

        // ─────────────────────────────────────────────────────────────
        // Party Settings
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Sets whether the party is publicly discoverable.
        /// </summary>
        /// <param name="isPublic">True to make the party public.</param>
        public void SetPartyPrivacy(bool isPublic)
        {
            if (!IsInParty || !IsPartyLeader)
            {
                Debug.LogWarning("[PartyManager] Must be leader to change privacy.");
                return;
            }

            CurrentParty.IsPublic = isPublic;
            Debug.Log($"[PartyManager] Party privacy set to {(isPublic ? "Public" : "Private")}");
            RpcSetPartyPrivacy(CurrentParty.PartyId, isPublic);
        }

        /// <summary>
        /// Updates the party description.
        /// </summary>
        /// <param name="description">The new description text.</param>
        public void SetPartyDescription(string description)
        {
            if (!IsInParty || !IsPartyLeader)
            {
                Debug.LogWarning("[PartyManager] Must be leader to set description.");
                return;
            }

            CurrentParty.Description = description ?? string.Empty;
            RpcSetPartyDescription(CurrentParty.PartyId, CurrentParty.Description);
        }

        /// <summary>
        /// Transfers the entire party to a specific room.
        /// </summary>
        /// <param name="roomId">The target room identifier.</param>
        public void TransferPartyToRoom(string roomId)
        {
            if (!IsInParty || !IsPartyLeader)
            {
                Debug.LogWarning("[PartyManager] Must be leader to transfer party.");
                return;
            }

            if (string.IsNullOrEmpty(roomId))
            {
                Debug.LogWarning("[PartyManager] Invalid room ID.");
                return;
            }

            CurrentParty.CurrentRoomId = roomId;
            foreach (var member in CurrentParty.Members)
                member.CurrentRoomId = roomId;

            Debug.Log($"[PartyManager] Party transferred to room {roomId}");
            EventBus.Instance?.Publish("PartyTransferred", CurrentParty.PartyId, roomId);
            RpcTransferPartyToRoom(CurrentParty.PartyId, roomId);
        }

        /// <summary>
        /// Toggles the local player following the leader across room changes.
        /// </summary>
        public void FollowLeader()
        {
            if (!IsInParty)
            {
                Debug.LogWarning("[PartyManager] Not in a party.");
                return;
            }

            var me = CurrentParty.Members.FirstOrDefault(m => m.PlayerId == MyPlayerId);
            if (me == null) return;

            me.IsFollowingLeader = !me.IsFollowingLeader;
            Debug.Log($"[PartyManager] FollowLeader = {me.IsFollowingLeader}");
            RpcUpdateFollowStatus(CurrentParty.PartyId, MyPlayerId, me.IsFollowingLeader);

            if (me.IsFollowingLeader && !string.IsNullOrEmpty(CurrentParty.CurrentRoomId))
            {
                string myRoom = GetCurrentRoomId();
                if (myRoom != CurrentParty.CurrentRoomId)
                {
                    EventBus.Instance?.Publish("RequestRoomChange", CurrentParty.CurrentRoomId);
                }
            }
        }

        // ─────────────────────────────────────────────────────────────
        // Chat
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Sends a chat message visible to all party members.
        /// </summary>
        /// <param name="message">The message text.</param>
        public void SendPartyMessage(string message)
        {
            if (!IsInParty)
            {
                Debug.LogWarning("[PartyManager] Not in a party.");
                return;
            }

            if (string.IsNullOrWhiteSpace(message)) return;

            var chatMsg = new ChatMessage
            {
                SenderId = MyPlayerId,
                SenderName = MyPlayerName,
                Channel = ChatChannel.Party,
                Content = message.Trim(),
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
            };

            _partyChatHistory.Add(chatMsg);
            OnPartyMessageReceived?.Invoke(chatMsg);

            // Route through ChatManager if available
            ChatManager.Instance?.SendMessage(ChatChannel.Party, message);
            RpcSendPartyMessage(CurrentParty.PartyId, chatMsg);
        }

        /// <summary>
        /// Returns the local chat history for the current party.
        /// </summary>
        /// <returns>A list of <see cref="ChatMessage"/> ordered by time.</returns>
        public List<ChatMessage> GetPartyChatHistory()
        {
            return new List<ChatMessage>(_partyChatHistory);
        }

        // ─────────────────────────────────────────────────────────────
        // Activities
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Begins a new party activity immediately (leader only).
        /// </summary>
        /// <param name="activity">The type of activity to start.</param>
        public void StartPartyActivity(PartyActivityType activity)
        {
            if (!IsInParty || !IsPartyLeader)
            {
                Debug.LogWarning("[PartyManager] Must be leader to start activity.");
                return;
            }

            CurrentParty.CurrentActivity = activity;
            CurrentParty.ActivityVotes.Clear();
            Debug.Log($"[PartyManager] Started activity {activity}");
            EventBus.Instance?.Publish("PartyActivityStarted", CurrentParty.PartyId, activity);
            RpcStartPartyActivity(CurrentParty.PartyId, activity);
        }

        /// <summary>
        /// Casts a vote for the next party activity.
        /// </summary>
        /// <param name="activity">The activity to vote for.</param>
        public void VoteOnActivity(PartyActivityType activity)
        {
            if (!IsInParty)
            {
                Debug.LogWarning("[PartyManager] Not in a party.");
                return;
            }

            CurrentParty.ActivityVotes[MyPlayerId] = (int)activity;
            Debug.Log($"[PartyManager] Voted for {activity}");
            RpcVoteOnActivity(CurrentParty.PartyId, MyPlayerId, (int)activity);
        }

        // ─────────────────────────────────────────────────────────────
        // Queries
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Returns all members in the current party.
        /// </summary>
        public List<PartyMember> GetPartyMembers()
        {
            if (!IsInParty) return new List<PartyMember>();
            return new List<PartyMember>(CurrentParty.Members);
        }

        /// <summary>
        /// Returns all pending invites for the current party.
        /// </summary>
        public List<PartyInvite> GetPendingInvites()
        {
            if (!IsInParty) return new List<PartyInvite>();
            return new List<PartyInvite>(CurrentParty.PendingInvites.Where(i => !i.IsAccepted));
        }

        // ─────────────────────────────────────────────────────────────
        // Internal
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Removes expired invites from the current party.
        /// </summary>
        private void PruneExpiredInvites()
        {
            if (CurrentParty == null) return;
            long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var expired = CurrentParty.PendingInvites
                .Where(i => !i.IsAccepted && (now - i.SentTime) > i.ExpiresIn)
                .ToList();

            foreach (var inv in expired)
            {
                CurrentParty.PendingInvites.Remove(inv);
                Debug.Log($"[PartyManager] Expired invite {inv.InviteId}");
            }
        }

        /// <summary>
        /// Gets the local player's current room ID via RoomManager.
        /// </summary>
        private string GetCurrentRoomId()
        {
            return RoomManager.Instance?.CurrentRoom?.RoomId ?? string.Empty;
        }

        /// <summary>
        /// When the local player changes rooms, sync to party state.
        /// </summary>
        private void OnLocalPlayerRoomChanged(string roomId)
        {
            if (!IsInParty) return;
            var me = CurrentParty.Members.FirstOrDefault(m => m.PlayerId == MyPlayerId);
            if (me != null) me.CurrentRoomId = roomId;

            // Auto-follow: if leader moved and I'm following, follow
            if (CurrentParty.LeaderId != MyPlayerId && me is { IsFollowingLeader: true })
            {
                var leader = CurrentParty.Members.FirstOrDefault(m => m.PlayerId == CurrentParty.LeaderId);
                if (leader != null && leader.CurrentRoomId != roomId && !string.IsNullOrEmpty(leader.CurrentRoomId))
                {
                    EventBus.Instance?.Publish("RequestRoomChange", leader.CurrentRoomId);
                }
            }

            RpcSyncMemberRoom(CurrentParty.PartyId, MyPlayerId, roomId);
        }

        // ─────────────────────────────────────────────────────────────
        // Network RPC Stubs ( NGO / Netcode for GameObjects )
        // Replace with real [ServerRpc] / [ClientRpc] in production.
        // ─────────────────────────────────────────────────────────────

        /// <summary>Stub: server RPC to create a party.</summary>
        private void RpcCreateParty(Party party) => Debug.Log($"[RPC] CreateParty {party.PartyId}");

        /// <summary>Stub: server RPC to disband a party.</summary>
        private void RpcDisbandParty(string partyId) => Debug.Log($"[RPC] DisbandParty {partyId}");

        /// <summary>Stub: server RPC to leave a party.</summary>
        private void RpcLeaveParty(string partyId, string playerId) => Debug.Log($"[RPC] LeaveParty {playerId} from {partyId}");

        /// <summary>Stub: server RPC to send a party invite.</summary>
        private void RpcSendPartyInvite(PartyInvite invite) => Debug.Log($"[RPC] SendPartyInvite {invite.InviteId} -> {invite.ToPlayerId}");

        /// <summary>Stub: server RPC to accept a party invite.</summary>
        private void RpcAcceptPartyInvite(string partyId, string playerId) => Debug.Log($"[RPC] AcceptPartyInvite {playerId} -> {partyId}");

        /// <summary>Stub: server RPC to decline a party invite.</summary>
        private void RpcDeclinePartyInvite(string partyId, string playerId) => Debug.Log($"[RPC] DeclinePartyInvite {playerId} -> {partyId}");

        /// <summary>Stub: server RPC to kick a player.</summary>
        private void RpcKickFromParty(string partyId, string playerId) => Debug.Log($"[RPC] KickFromParty {playerId} from {partyId}");

        /// <summary>Stub: server RPC to promote a player.</summary>
        private void RpcPromoteToLeader(string partyId, string playerId) => Debug.Log($"[RPC] PromoteToLeader {playerId} in {partyId}");

        /// <summary>Stub: server RPC to set party privacy.</summary>
        private void RpcSetPartyPrivacy(string partyId, bool isPublic) => Debug.Log($"[RPC] SetPartyPrivacy {partyId} = {isPublic}");

        /// <summary>Stub: server RPC to set party description.</summary>
        private void RpcSetPartyDescription(string partyId, string description) => Debug.Log($"[RPC] SetPartyDescription {partyId}");

        /// <summary>Stub: server RPC to transfer party to a room.</summary>
        private void RpcTransferPartyToRoom(string partyId, string roomId) => Debug.Log($"[RPC] TransferPartyToRoom {partyId} -> {roomId}");

        /// <summary>Stub: server RPC to update follow status.</summary>
        private void RpcUpdateFollowStatus(string partyId, string playerId, bool following) => Debug.Log($"[RPC] UpdateFollowStatus {playerId} = {following}");

        /// <summary>Stub: server RPC to sync a member's room.</summary>
        private void RpcSyncMemberRoom(string partyId, string playerId, string roomId) => Debug.Log($"[RPC] SyncMemberRoom {playerId} -> {roomId}");

        /// <summary>Stub: server RPC to send a party chat message.</summary>
        private void RpcSendPartyMessage(string partyId, ChatMessage msg) => Debug.Log($"[RPC] SendPartyMessage {partyId} from {msg.SenderId}");

        /// <summary>Stub: server RPC to start a party activity.</summary>
        private void RpcStartPartyActivity(string partyId, PartyActivityType activity) => Debug.Log($"[RPC] StartPartyActivity {partyId} -> {activity}");

        /// <summary>Stub: server RPC to vote on an activity.</summary>
        private void RpcVoteOnActivity(string partyId, string playerId, int activityIndex) => Debug.Log($"[RPC] VoteOnActivity {playerId} -> {(PartyActivityType)activityIndex}");

        // ─────────────────────────────────────────────────────────────
        // Static Utility
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Generates a short human-readable party code from a GUID.
        /// </summary>
        /// <param name="guid">The GUID to encode.</param>
        /// <returns>An 8-character uppercase party code.</returns>
        public static string GeneratePartyCode(string guid)
        {
            var hash = System.Security.Cryptography.MD5.HashData(System.Text.Encoding.UTF8.GetBytes(guid));
            var sb = new System.Text.StringBuilder(8);
            for (int i = 0; i < 4; i++)
                sb.Append(hash[i].ToString("X2"));
            return sb.ToString();
        }
    }
}
