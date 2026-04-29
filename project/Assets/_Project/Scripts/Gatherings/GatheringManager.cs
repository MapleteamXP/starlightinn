using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KawaiiCoolIsland.Gatherings
{
    /// <summary>
    /// Enumerates the possible RSVP responses for a gathering.
    /// </summary>
    public enum RSVPStatus
    {
        /// <summary>Player was invited but has not responded.</summary>
        Invited,

        /// <summary>Player confirmed they will attend.</summary>
        Going,

        /// <summary>Player may attend but is not certain.</summary>
        Maybe,

        /// <summary>Player explicitly declined to attend.</summary>
        NotGoing,

        /// <summary>Player has not interacted with the invite at all.</summary>
        NoResponse
    }

    /// <summary>
    /// Enumerates the lifecycle states of a gathering.
    /// </summary>
    public enum GatheringStatus
    {
        /// <summary>The host is still configuring the gathering.</summary>
        Planning,

        /// <summary>The gathering is scheduled and visible to attendees.</summary>
        Upcoming,

        /// <summary>The gathering will begin within a short window.</summary>
        StartingSoon,

        /// <summary>The gathering is currently in progress.</summary>
        Active,

        /// <summary>The gathering has concluded.</summary>
        Ended,

        /// <summary>The gathering was cancelled by the host.</summary>
        Cancelled
    }

    /// <summary>
    /// Represents a single RSVP entry tied to a player.
    /// </summary>
    [System.Serializable]
    public class RSVPEntry
    {
        /// <summary>The player's unique identifier.</summary>
        public string PlayerId;

        /// <summary>The player's display name.</summary>
        public string PlayerName;

        /// <summary>The current RSVP status.</summary>
        public RSVPStatus Status;

        /// <summary>Unix timestamp of the most recent status change.</summary>
        public long RespondedTime;
    }

    /// <summary>
    /// Represents a scheduled gathering with RSVPs, invites, and room targeting.
    /// </summary>
    [System.Serializable]
    public class Gathering
    {
        /// <summary>The unique identifier of the gathering.</summary>
        public string GatheringId;

        /// <summary>The player ID of the host.</summary>
        public string HostId;

        /// <summary>The display name of the host.</summary>
        public string HostName;

        /// <summary>The human-readable name of the gathering.</summary>
        public string Name;

        /// <summary>A longer description of the gathering.</summary>
        public string Description;

        /// <summary>The room ID where the gathering takes place.</summary>
        public string RoomId;

        /// <summary>The display name of the room.</summary>
        public string RoomName;

        /// <summary>The scheduled start time.</summary>
        public DateTime StartTime;

        /// <summary>The scheduled end time (auto-computed if zero).</summary>
        public DateTime EndTime;

        /// <summary>Maximum number of attendees allowed.</summary>
        public int MaxAttendees;

        /// <summary>All RSVP entries for this gathering.</summary>
        public List<RSVPEntry> RSVPs = new();

        /// <summary>Players explicitly invited to this gathering.</summary>
        public List<string> InvitedIds = new();

        /// <summary>The current lifecycle status of the gathering.</summary>
        public GatheringStatus Status;

        /// <summary>Optional promotional banner image.</summary>
        public Sprite Banner;
    }

    /// <summary>
    /// Manages scheduled gatherings, RSVPs, and attendee coordination.
    /// Integrates with <see cref="EventBus"/> and networked state.
    /// </summary>
    public class GatheringManager : Singleton<GatheringManager>
    {
        // ─────────────────────────────────────────────────────────────
        // Config
        // ─────────────────────────────────────────────────────────────

        /// <summary>Maximum gatherings a single player may host simultaneously.</summary>
        [Header("Settings")]
        [SerializeField]
        private int _maxGatheringsPerPlayer = 3;

        /// <summary>Maximum gatherings a single player may host simultaneously.</summary>
        public int MaxGatheringsPerPlayer => _maxGatheringsPerPlayer;

        /// <summary>Default maximum attendees if none specified.</summary>
        [SerializeField]
        private int _maxAttendees = 50;

        /// <summary>Default maximum attendees if none specified.</summary>
        public int MaxAttendees => _maxAttendees;

        /// <summary>Minimum minutes between creation time and start time.</summary>
        [SerializeField]
        private float _minAdvanceTime = 15f;

        /// <summary>Minimum minutes between creation time and start time.</summary>
        public float MinAdvanceTime => _minAdvanceTime;

        // ─────────────────────────────────────────────────────────────
        // State
        // ─────────────────────────────────────────────────────────────

        /// <summary>All gatherings known to the client.</summary>
        public List<Gathering> AllGatherings = new();

        /// <summary>Gatherings the local player is hosting or attending.</summary>
        public List<Gathering> MyGatherings = new();

        /// <summary>The local player's unique identifier.</summary>
        private string MyPlayerId => NetworkedPlayer.Instance?.PlayerId ?? string.Empty;

        /// <summary>The local player's display name.</summary>
        private string MyPlayerName => NetworkedPlayer.Instance?.PlayerName ?? "You";

        // ─────────────────────────────────────────────────────────────
        // Events
        // ─────────────────────────────────────────────────────────────

        /// <summary>Raised when a new gathering is successfully created.</summary>
        public event Action<Gathering> OnGatheringCreated;

        /// <summary>Raised when a gathering is cancelled.</summary>
        public event Action<string> OnGatheringCancelled;

        /// <summary>Raised when a player's RSVP changes. Args: gatheringId, playerId, status.</summary>
        public event Action<string, string, RSVPStatus> OnRSVPChanged;

        // ─────────────────────────────────────────────────────────────
        // Lifecycle
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Initializes the gathering manager and begins the periodic update loop.
        /// </summary>
        protected override void Awake()
        {
            base.Awake();
            EventBus.Instance?.Subscribe<string>("RoomChanged", OnRoomChanged);
        }

        /// <summary>
        /// Unsubscribes from events on destroy.
        /// </summary>
        protected override void OnDestroy()
        {
            EventBus.Instance?.Unsubscribe<string>("RoomChanged", OnRoomChanged);
            base.OnDestroy();
        }

        /// <summary>
        /// Polls gatherings to update their lifecycle status each frame.
        /// </summary>
        private void Update()
        {
            UpdateGatheringStatuses();
        }

        // ─────────────────────────────────────────────────────────────
        // CRUD Operations
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Creates a new gathering after validating constraints.
        /// </summary>
        /// <param name="name">The gathering name.</param>
        /// <param name="description">A longer description.</param>
        /// <param name="roomId">The target room identifier.</param>
        /// <param name="startTime">When the gathering begins.</param>
        /// <param name="maxAttendees">Maximum allowed attendees.</param>
        /// <param name="invitees">Optional list of players to pre-invite.</param>
        public void CreateGathering(string name, string description, string roomId,
                                    DateTime startTime, int maxAttendees, List<string> invitees)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                Debug.LogWarning("[GatheringManager] Name cannot be empty.");
                return;
            }

            if (string.IsNullOrWhiteSpace(roomId))
            {
                Debug.LogWarning("[GatheringManager] Room ID cannot be empty.");
                return;
            }

            var hostedCount = AllGatherings.Count(g => g.HostId == MyPlayerId && g.Status != GatheringStatus.Cancelled && g.Status != GatheringStatus.Ended);
            if (hostedCount >= _maxGatheringsPerPlayer)
            {
                Debug.LogWarning($"[GatheringManager] Exceeds max gatherings per player ({_maxGatheringsPerPlayer}).");
                return;
            }

            var advance = startTime - DateTime.UtcNow;
            if (advance.TotalMinutes < _minAdvanceTime)
            {
                Debug.LogWarning($"[GatheringManager] Start time must be at least {_minAdvanceTime} minutes in the future.");
                return;
            }

            string roomDisplayName = RoomManager.Instance?.GetRoom(roomId)?.RoomName ?? roomId;

            var gathering = new Gathering
            {
                GatheringId = Guid.NewGuid().ToString(),
                HostId = MyPlayerId,
                HostName = MyPlayerName,
                Name = name.Trim(),
                Description = description?.Trim() ?? string.Empty,
                RoomId = roomId,
                RoomName = roomDisplayName,
                StartTime = startTime,
                EndTime = startTime.AddHours(1), // Default 1-hour duration
                MaxAttendees = Mathf.Clamp(maxAttendees, 1, _maxAttendees),
                RSVPs = new List<RSVPEntry>(),
                InvitedIds = new List<string>(),
                Status = GatheringStatus.Planning
            };

            if (invitees != null)
            {
                foreach (var id in invitees.Distinct())
                {
                    if (id == MyPlayerId) continue;
                    gathering.InvitedIds.Add(id);
                    gathering.RSVPs.Add(new RSVPEntry
                    {
                        PlayerId = id,
                        PlayerName = id, // Will resolve via SocialGraphManager in full build
                        Status = RSVPStatus.Invited,
                        RespondedTime = 0
                    });
                }
            }

            // Host is automatically going
            gathering.RSVPs.Add(new RSVPEntry
            {
                PlayerId = MyPlayerId,
                PlayerName = MyPlayerName,
                Status = RSVPStatus.Going,
                RespondedTime = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
            });

            AllGatherings.Add(gathering);
            RefreshMyGatherings();

            Debug.Log($"[GatheringManager] Created gathering {gathering.GatheringId}: {name}");
            OnGatheringCreated?.Invoke(gathering);
            EventBus.Instance?.Publish("GatheringCreated", gathering);
            RpcCreateGathering(gathering);
        }

        /// <summary>
        /// Cancels a gathering (host only).
        /// </summary>
        /// <param name="gatheringId">The gathering to cancel.</param>
        public void CancelGathering(string gatheringId)
        {
            var gathering = AllGatherings.FirstOrDefault(g => g.GatheringId == gatheringId);
            if (gathering == null)
            {
                Debug.LogWarning($"[GatheringManager] Gathering {gatheringId} not found.");
                return;
            }

            if (gathering.HostId != MyPlayerId)
            {
                Debug.LogWarning("[GatheringManager] Only the host can cancel.");
                return;
            }

            if (gathering.Status == GatheringStatus.Cancelled || gathering.Status == GatheringStatus.Ended)
            {
                Debug.LogWarning("[GatheringManager] Already cancelled or ended.");
                return;
            }

            gathering.Status = GatheringStatus.Cancelled;
            RefreshMyGatherings();

            Debug.Log($"[GatheringManager] Cancelled gathering {gatheringId}");
            OnGatheringCancelled?.Invoke(gatheringId);
            EventBus.Instance?.Publish("GatheringCancelled", gatheringId);
            RpcCancelGathering(gatheringId);
        }

        // ─────────────────────────────────────────────────────────────
        // RSVP
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Updates the local player's RSVP status for a gathering.
        /// </summary>
        /// <param name="gatheringId">The target gathering.</param>
        /// <param name="status">The new RSVP status.</param>
        public void RSVPToGathering(string gatheringId, RSVPStatus status)
        {
            var gathering = AllGatherings.FirstOrDefault(g => g.GatheringId == gatheringId);
            if (gathering == null)
            {
                Debug.LogWarning($"[GatheringManager] Gathering {gatheringId} not found.");
                return;
            }

            if (gathering.Status == GatheringStatus.Cancelled || gathering.Status == GatheringStatus.Ended)
            {
                Debug.LogWarning("[GatheringManager] Cannot RSVP to a cancelled/ended gathering.");
                return;
            }

            if (status == RSVPStatus.Going && GetAttendeeCount(gatheringId) >= gathering.MaxAttendees)
            {
                Debug.LogWarning("[GatheringManager] Gathering is at max capacity.");
                return;
            }

            var entry = gathering.RSVPs.FirstOrDefault(r => r.PlayerId == MyPlayerId);
            if (entry == null)
            {
                entry = new RSVPEntry
                {
                    PlayerId = MyPlayerId,
                    PlayerName = MyPlayerName,
                    Status = status,
                    RespondedTime = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
                };
                gathering.RSVPs.Add(entry);
            }
            else
            {
                entry.Status = status;
                entry.RespondedTime = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            }

            RefreshMyGatherings();
            Debug.Log($"[GatheringManager] RSVP {status} for {gatheringId}");
            OnRSVPChanged?.Invoke(gatheringId, MyPlayerId, status);
            EventBus.Instance?.Publish("RSVPChanged", gatheringId, MyPlayerId, status);
            RpcRSVP(gatheringId, MyPlayerId, status);
        }

        // ─────────────────────────────────────────────────────────────
        // Invitations
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Invites additional players to an existing gathering.
        /// </summary>
        /// <param name="gatheringId">The gathering to invite to.</param>
        /// <param name="playerIds">The players to invite.</param>
        public void InviteToGathering(string gatheringId, List<string> playerIds)
        {
            var gathering = AllGatherings.FirstOrDefault(g => g.GatheringId == gatheringId);
            if (gathering == null)
            {
                Debug.LogWarning($"[GatheringManager] Gathering {gatheringId} not found.");
                return;
            }

            if (gathering.HostId != MyPlayerId)
            {
                Debug.LogWarning("[GatheringManager] Only the host can invite.");
                return;
            }

            if (playerIds == null || playerIds.Count == 0) return;

            foreach (var id in playerIds.Distinct())
            {
                if (id == MyPlayerId) continue;
                if (gathering.InvitedIds.Contains(id)) continue;
                if (gathering.RSVPs.Any(r => r.PlayerId == id)) continue;

                gathering.InvitedIds.Add(id);
                gathering.RSVPs.Add(new RSVPEntry
                {
                    PlayerId = id,
                    PlayerName = id,
                    Status = RSVPStatus.Invited,
                    RespondedTime = 0
                });

                // Unified invite system bridge
                InviteSystem.Instance?.SendInvite(id, InviteType.Gathering, gatheringId,
                    $"You're invited to {gathering.Name}!");
            }

            RefreshMyGatherings();
            Debug.Log($"[GatheringManager] Invited {playerIds.Count} players to {gatheringId}");
            RpcInviteToGathering(gatheringId, playerIds);
        }

        // ─────────────────────────────────────────────────────────────
        // Queries
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Retrieves a gathering by its unique identifier.
        /// </summary>
        /// <param name="gatheringId">The gathering ID.</param>
        /// <returns>The <see cref="Gathering"/> or null if not found.</returns>
        public Gathering GetGathering(string gatheringId)
        {
            return AllGatherings.FirstOrDefault(g => g.GatheringId == gatheringId);
        }

        /// <summary>
        /// Returns gatherings that have not yet started, ordered by start time.
        /// </summary>
        public List<Gathering> GetUpcomingGatherings()
        {
            var now = DateTime.UtcNow;
            return AllGatherings
                .Where(g => g.StartTime > now && g.Status != GatheringStatus.Cancelled && g.Status != GatheringStatus.Ended)
                .OrderBy(g => g.StartTime)
                .ToList();
        }

        /// <summary>
        /// Returns gatherings scheduled for a specific room.
        /// </summary>
        /// <param name="roomId">The room to filter by.</param>
        public List<Gathering> GetGatheringsForRoom(string roomId)
        {
            return AllGatherings
                .Where(g => g.RoomId == roomId && g.Status != GatheringStatus.Cancelled && g.Status != GatheringStatus.Ended)
                .OrderBy(g => g.StartTime)
                .ToList();
        }

        /// <summary>
        /// Returns gatherings the local player is hosting.
        /// </summary>
        public List<Gathering> GetMyHostedGatherings()
        {
            return AllGatherings
                .Where(g => g.HostId == MyPlayerId && g.Status != GatheringStatus.Cancelled && g.Status != GatheringStatus.Ended)
                .OrderBy(g => g.StartTime)
                .ToList();
        }

        /// <summary>
        /// Returns gatherings the local player is attending (Going / Maybe).
        /// </summary>
        public List<Gathering> GetMyAttendingGatherings()
        {
            return AllGatherings
                .Where(g => g.RSVPs.Any(r => r.PlayerId == MyPlayerId &&
                    (r.Status == RSVPStatus.Going || r.Status == RSVPStatus.Maybe)))
                .OrderBy(g => g.StartTime)
                .ToList();
        }

        /// <summary>
        /// Counts confirmed attendees (Going) for a gathering.
        /// </summary>
        /// <param name="gatheringId">The gathering ID.</param>
        public int GetAttendeeCount(string gatheringId)
        {
            var g = AllGatherings.FirstOrDefault(x => x.GatheringId == gatheringId);
            return g?.RSVPs.Count(r => r.Status == RSVPStatus.Going) ?? 0;
        }

        /// <summary>
        /// Returns the player IDs of all confirmed attendees.
        /// </summary>
        /// <param name="gatheringId">The gathering ID.</param>
        public List<string> GetAttendees(string gatheringId)
        {
            var g = AllGatherings.FirstOrDefault(x => x.GatheringId == gatheringId);
            return g?.RSVPs.Where(r => r.Status == RSVPStatus.Going).Select(r => r.PlayerId).ToList() ?? new List<string>();
        }

        /// <summary>
        /// Checks whether the local player is confirmed as attending.
        /// </summary>
        /// <param name="gatheringId">The gathering ID.</param>
        public bool IsAttending(string gatheringId)
        {
            var g = AllGatherings.FirstOrDefault(x => x.GatheringId == gatheringId);
            return g?.RSVPs.Any(r => r.PlayerId == MyPlayerId && r.Status == RSVPStatus.Going) ?? false;
        }

        /// <summary>
        /// Checks whether the local player is the host of the gathering.
        /// </summary>
        /// <param name="gatheringId">The gathering ID.</param>
        public bool IsHosting(string gatheringId)
        {
            return AllGatherings.Any(g => g.GatheringId == gatheringId && g.HostId == MyPlayerId);
        }

        // ─────────────────────────────────────────────────────────────
        // Internal
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Refreshes <see cref="MyGatherings"/> from the master list.
        /// </summary>
        private void RefreshMyGatherings()
        {
            MyGatherings = AllGatherings
                .Where(g => g.HostId == MyPlayerId || g.RSVPs.Any(r => r.PlayerId == MyPlayerId))
                .OrderBy(g => g.StartTime)
                .ToList();
        }

        /// <summary>
        /// Evaluates and updates the <see cref="GatheringStatus"/> for all gatherings each frame.
        /// </summary>
        private void UpdateGatheringStatuses()
        {
            var now = DateTime.UtcNow;
            foreach (var gathering in AllGatherings)
            {
                if (gathering.Status == GatheringStatus.Cancelled || gathering.Status == GatheringStatus.Ended)
                    continue;

                if (gathering.Status == GatheringStatus.Planning && gathering.StartTime > now)
                {
                    gathering.Status = GatheringStatus.Upcoming;
                    EventBus.Instance?.Publish("GatheringStatusChanged", gathering.GatheringId, gathering.Status);
                }

                var timeToStart = gathering.StartTime - now;
                if (gathering.Status == GatheringStatus.Upcoming && timeToStart.TotalMinutes <= 5)
                {
                    gathering.Status = GatheringStatus.StartingSoon;
                    EventBus.Instance?.Publish("GatheringStatusChanged", gathering.GatheringId, gathering.Status);
                }

                if (gathering.Status == GatheringStatus.StartingSoon && timeToStart.TotalSeconds <= 0)
                {
                    gathering.Status = GatheringStatus.Active;
                    EventBus.Instance?.Publish("GatheringStatusChanged", gathering.GatheringId, gathering.Status);
                }

                if (gathering.Status == GatheringStatus.Active && now >= gathering.EndTime)
                {
                    gathering.Status = GatheringStatus.Ended;
                    EventBus.Instance?.Publish("GatheringStatusChanged", gathering.GatheringId, gathering.Status);
                }
            }
        }

        /// <summary>
        /// Handles local room changes for auto-navigation to active gatherings.
        /// </summary>
        private void OnRoomChanged(string roomId)
        {
            // Intentionally no-op; UI layer can prompt user if a gathering is active in this room.
        }

        // ─────────────────────────────────────────────────────────────
        // Network RPC Stubs
        // ─────────────────────────────────────────────────────────────

        /// <summary>Stub: server RPC to create a gathering.</summary>
        private void RpcCreateGathering(Gathering gathering) => Debug.Log($"[RPC] CreateGathering {gathering.GatheringId}");

        /// <summary>Stub: server RPC to cancel a gathering.</summary>
        private void RpcCancelGathering(string gatheringId) => Debug.Log($"[RPC] CancelGathering {gatheringId}");

        /// <summary>Stub: server RPC to update RSVP.</summary>
        private void RpcRSVP(string gatheringId, string playerId, RSVPStatus status) => Debug.Log($"[RPC] RSVP {playerId} -> {status} for {gatheringId}");

        /// <summary>Stub: server RPC to invite players to a gathering.</summary>
        private void RpcInviteToGathering(string gatheringId, List<string> playerIds) => Debug.Log($"[RPC] InviteToGathering {gatheringId} ({playerIds.Count} players)");
    }
}
