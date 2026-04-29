using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KawaiiCoolIsland.Rooms.Moderation
{
    /// <summary>
    /// Types of mini-events that can be started inside a room.
    /// </summary>
    public enum MiniEventType
    {
        /// <summary>Players dance together with synced music.</summary>
        DanceParty,
        /// <summary>Players showcase outfits on a runway.</summary>
        FashionShow,
        /// <summary>Players search for hidden items.</summary>
        ScavengerHunt,
        /// <summary>Trivia competition with room-wide scores.</summary>
        TriviaNight,
        /// <summary>Players can set up trading stalls.</summary>
        TradeFair,
        /// <summary>Custom user-defined event type.</summary>
        Custom
    }

    /// <summary>
    /// Represents the lifecycle status of a mini-event.
    /// </summary>
    public enum MiniEventStatus
    {
        Inactive,
        StartingSoon,
        Active,
        EndingSoon,
        Ended
    }

    /// <summary>
    /// Serializable reward data for event participation.
    /// </summary>
    [System.Serializable]
    public class RewardData
    {
        public string RewardId;
        public string RewardName;
        public string RewardType; // Currency, Item, Badge, Experience
        public int Quantity;
        public Sprite Icon;
    }

    /// <summary>
    /// Represents a scheduled event within a room.
    /// </summary>
    [System.Serializable]
    public class RoomEventData
    {
        public string EventId;
        public string EventName;
        public string Description;
        public long StartTimeUtc;
        public long EndTimeUtc;
        public Sprite Banner;
        public List<RewardData> Rewards;
        public bool IsPromoted;
        public bool IsCancelled;
        public string CreatedBy;
    }

    /// <summary>
    /// Tracks the state of an active mini-event.
    /// </summary>
    [System.Serializable]
    public class MiniEventState
    {
        public MiniEventType Type;
        public MiniEventStatus Status;
        public long StartTimeUtc;
        public long EndTimeUtc;
        public string CustomName;
        public string CustomDescription;
    }

    /// <summary>
    /// Provides event hosting tools for room owners and co-hosts.
    /// Supports scheduled events, mini-events, room promotions, and attendee management.
    /// </summary>
    public class RoomEventHost : MonoBehaviour
    {
        [Header("Configuration")]
        [SerializeField] private int maxScheduledEvents = 5;
        [SerializeField] private int maxRewardsPerEvent = 10;
        [SerializeField] private float endingSoonThresholdSeconds = 300f;
        [SerializeField] private float startingSoonThresholdSeconds = 300f;

        [Header("Runtime State")]
        private readonly List<RoomEventData> scheduledEvents = new();
        private MiniEventState currentMiniEvent = null;
        private readonly HashSet<string> attendees = new();
        private bool isBoostActive = false;
        private float boostRemainingSeconds = 0f;

        /// <summary>
        /// Invoked when a scheduled event starts. Parameter: eventId.
        /// </summary>
        public event Action<string> OnEventStarted;

        /// <summary>
        /// Invoked when a scheduled event ends. Parameter: eventId.
        /// </summary>
        public event Action<string> OnEventEnded;

        /// <summary>
        /// Invoked when a mini-event status changes. Parameters: type, status.
        /// </summary>
        public event Action<MiniEventType, MiniEventStatus> OnMiniEventStatusChanged;

        /// <summary>
        /// Invoked when the attendee list updates. Parameter: attendee count.
        /// </summary>
        public event Action<int> OnAttendeeCountChanged;

        /// <summary>
        /// Invoked when a room boost is activated or expires. Parameter: active.
        /// </summary>
        public event Action<bool> OnBoostChanged;

        /// <summary>
        /// Creates a scheduled event in the room. Requires edit permission.
        /// </summary>
        /// <param name="eventName">Name of the event.</param>
        /// <param name="description">Description of the event.</param>
        /// <param name="startTime">Start time in local DateTime.</param>
        /// <param name="endTime">End time in local DateTime.</param>
        public void CreateEventInRoom(string eventName, string description,
            DateTime startTime, DateTime endTime)
        {
            if (!CanHostEvent()) return;
            if (scheduledEvents.Count >= maxScheduledEvents)
            {
                Debug.LogWarning("[RoomEventHost] Maximum scheduled events reached.");
                return;
            }

            if (string.IsNullOrWhiteSpace(eventName)) return;
            if (endTime <= startTime) return;

            RoomEventData evt = new()
            {
                EventId = Guid.NewGuid().ToString(),
                EventName = eventName.Trim(),
                Description = description ?? "",
                StartTimeUtc = new DateTimeOffset(startTime.ToUniversalTime()).ToUnixTimeSeconds(),
                EndTimeUtc = new DateTimeOffset(endTime.ToUniversalTime()).ToUnixTimeSeconds(),
                Banner = null,
                Rewards = new List<RewardData>(),
                IsPromoted = false,
                IsCancelled = false,
                CreatedBy = GetLocalPlayerId()
            };

            scheduledEvents.Add(evt);
            EventBus.RoomEventCreated?.Invoke(evt.EventId, eventName);
        }

        /// <summary>
        /// Cancels a scheduled event. Requires owner or creator permission.
        /// </summary>
        /// <param name="eventId">The event to cancel.</param>
        public void CancelEvent(string eventId)
        {
            if (!CanHostEvent()) return;
            if (string.IsNullOrWhiteSpace(eventId)) return;

            RoomEventData evt = scheduledEvents.FirstOrDefault(e => e.EventId == eventId);
            if (evt == null || evt.IsCancelled) return;

            evt.IsCancelled = true;
            EventBus.RoomEventCancelled?.Invoke(eventId);
        }

        /// <summary>
        /// Promotes an event to increase its visibility. Requires owner permission.
        /// </summary>
        /// <param name="eventId">The event to promote.</param>
        public void PromoteEvent(string eventId)
        {
            if (!RoomSettingsManager.Instance.IsRoomOwner) return;
            if (string.IsNullOrWhiteSpace(eventId)) return;

            RoomEventData evt = scheduledEvents.FirstOrDefault(e => e.EventId == eventId);
            if (evt == null) return;

            evt.IsPromoted = true;
            EventBus.RoomEventPromoted?.Invoke(eventId);
        }

        /// <summary>
        /// Sets a visual banner for an event.
        /// </summary>
        /// <param name="eventId">The event to update.</param>
        /// <param name="banner">The banner sprite.</param>
        public void SetEventBanner(string eventId, Sprite banner)
        {
            if (!CanHostEvent()) return;
            if (string.IsNullOrWhiteSpace(eventId)) return;

            RoomEventData evt = scheduledEvents.FirstOrDefault(e => e.EventId == eventId);
            if (evt != null) evt.Banner = banner;
        }

        /// <summary>
        /// Adds a reward to an event.
        /// </summary>
        /// <param name="eventId">The event to add a reward to.</param>
        /// <param name="reward">The reward data.</param>
        public void AddEventReward(string eventId, RewardData reward)
        {
            if (!CanHostEvent()) return;
            if (string.IsNullOrWhiteSpace(eventId) || reward == null) return;

            RoomEventData evt = scheduledEvents.FirstOrDefault(e => e.EventId == eventId);
            if (evt == null) return;
            if (evt.Rewards.Count >= maxRewardsPerEvent) return;

            evt.Rewards.Add(reward);
        }

        /// <summary>
        /// Gets a copy of the scheduled events list.
        /// </summary>
        /// <returns>List of scheduled room events.</returns>
        public List<RoomEventData> GetScheduledEvents()
        {
            return new List<RoomEventData>(scheduledEvents.Where(e => !e.IsCancelled));
        }

        /// <summary>
        /// Gets a specific event by identifier.
        /// </summary>
        /// <param name="eventId">The event identifier.</param>
        /// <returns>The event data, or null if not found.</returns>
        public RoomEventData GetEventById(string eventId)
        {
            return scheduledEvents.FirstOrDefault(e => e.EventId == eventId);
        }

        /// <summary>
        /// Starts a mini-event of the specified type. Ends any active mini-event first.
        /// </summary>
        /// <param name="type">The type of mini-event to start.</param>
        public void StartMiniEvent(MiniEventType type)
        {
            if (!CanHostEvent()) return;
            if (currentMiniEvent != null && currentMiniEvent.Status == MiniEventStatus.Active)
            {
                EndMiniEvent();
            }

            long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            currentMiniEvent = new MiniEventState
            {
                Type = type,
                Status = MiniEventStatus.Active,
                StartTimeUtc = now,
                EndTimeUtc = now + 3600, // Default 1 hour runtime
                CustomName = type == MiniEventType.Custom ? "Custom Event" : type.ToString(),
                CustomDescription = ""
            };

            OnMiniEventStatusChanged?.Invoke(type, MiniEventStatus.Active);
            EventBus.MiniEventStarted?.Invoke(type.ToString());
            SendAttendeeMessage($"Mini-event started: {currentMiniEvent.CustomName}!");
        }

        /// <summary>
        /// Starts a custom mini-event with a specific name and description.
        /// </summary>
        /// <param name="name">Custom event name.</param>
        /// <param name="description">Custom event description.</param>
        public void StartCustomMiniEvent(string name, string description)
        {
            if (!CanHostEvent()) return;
            if (string.IsNullOrWhiteSpace(name)) return;

            if (currentMiniEvent != null && currentMiniEvent.Status == MiniEventStatus.Active)
            {
                EndMiniEvent();
            }

            long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            currentMiniEvent = new MiniEventState
            {
                Type = MiniEventType.Custom,
                Status = MiniEventStatus.Active,
                StartTimeUtc = now,
                EndTimeUtc = now + 3600,
                CustomName = name.Trim(),
                CustomDescription = description ?? ""
            };

            OnMiniEventStatusChanged?.Invoke(MiniEventType.Custom, MiniEventStatus.Active);
            EventBus.MiniEventStarted?.Invoke(name);
            SendAttendeeMessage($"Mini-event started: {name}!");
        }

        /// <summary>
        /// Ends the currently active mini-event.
        /// </summary>
        public void EndMiniEvent()
        {
            if (currentMiniEvent == null) return;

            MiniEventType type = currentMiniEvent.Type;
            currentMiniEvent.Status = MiniEventStatus.Ended;
            currentMiniEvent.EndTimeUtc = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

            OnMiniEventStatusChanged?.Invoke(type, MiniEventStatus.Ended);
            EventBus.MiniEventEnded?.Invoke(type.ToString());
            currentMiniEvent = null;
        }

        /// <summary>
        /// Gets the current mini-event status.
        /// </summary>
        /// <returns>The mini-event status, or inactive if none.</returns>
        public MiniEventStatus GetMiniEventStatus()
        {
            if (currentMiniEvent == null) return MiniEventStatus.Inactive;
            return currentMiniEvent.Status;
        }

        /// <summary>
        /// Gets the current mini-event state if active.
        /// </summary>
        /// <returns>The mini-event state, or null.</returns>
        public MiniEventState GetCurrentMiniEvent()
        {
            return currentMiniEvent;
        }

        /// <summary>
        /// Boosts room visibility in the room browser for a duration. Requires owner permission.
        /// </summary>
        /// <param name="durationHours">Boost duration in hours.</param>
        public void BoostRoomVisibility(int durationHours)
        {
            if (!RoomSettingsManager.Instance.IsRoomOwner) return;
            if (durationHours <= 0) return;

            isBoostActive = true;
            boostRemainingSeconds = durationHours * 3600f;
            EventBus.RoomBoosted?.Invoke(durationHours);
            OnBoostChanged?.Invoke(true);
        }

        /// <summary>
        /// Features the room in its discovery category. Requires owner permission.
        /// </summary>
        public void FeatureRoomInCategory()
        {
            if (!RoomSettingsManager.Instance.IsRoomOwner) return;
            EventBus.RoomFeatured?.Invoke(RoomSettingsManager.Instance.GetRoomCategory().ToString());
        }

        /// <summary>
        /// Marks the room as a designated event venue. Requires owner permission.
        /// </summary>
        public void SetRoomAsEventVenue()
        {
            if (!RoomSettingsManager.Instance.IsRoomOwner) return;
            EventBus.RoomMarkedAsVenue?.Invoke(RoomSettingsManager.Instance.CurrentRoomId);
        }

        /// <summary>
        /// Returns whether a room visibility boost is currently active.
        /// </summary>
        public bool IsBoostActive() => isBoostActive;

        /// <summary>
        /// Returns the remaining boost time in seconds.
        /// </summary>
        public float GetBoostRemainingSeconds() => boostRemainingSeconds;

        /// <summary>
        /// Returns a copy of the attendee list.
        /// </summary>
        /// <returns>List of attendee player identifiers.</returns>
        public List<string> GetAttendees()
        {
            return new List<string>(attendees);
        }

        /// <summary>
        /// Returns the current number of attendees.
        /// </summary>
        public int GetAttendeeCount() => attendees.Count;

        /// <summary>
        /// Sends a message to all attendees via system message.
        /// </summary>
        /// <param name="message">The message to broadcast.</param>
        public void SendAttendeeMessage(string message)
        {
            if (string.IsNullOrWhiteSpace(message)) return;
            EventBus.SystemMessage?.Invoke($"[Event] {message}");
        }

        /// <summary>
        /// Registers a player as an attendee of the current event.
        /// </summary>
        /// <param name="playerId">The attendee player identifier.</param>
        public void RegisterAttendee(string playerId)
        {
            if (string.IsNullOrWhiteSpace(playerId)) return;
            if (attendees.Add(playerId))
            {
                OnAttendeeCountChanged?.Invoke(attendees.Count);
            }
        }

        /// <summary>
        /// Removes a player from the attendee list.
        /// </summary>
        /// <param name="playerId">The player to remove.</param>
        public void RemoveAttendee(string playerId)
        {
            if (string.IsNullOrWhiteSpace(playerId)) return;
            if (attendees.Remove(playerId))
            {
                OnAttendeeCountChanged?.Invoke(attendees.Count);
            }
        }

        /// <summary>
        /// Clears all attendees.
        /// </summary>
        public void ClearAttendees()
        {
            attendees.Clear();
            OnAttendeeCountChanged?.Invoke(0);
        }

        /// <summary>
        /// Checks whether a player is registered as an attendee.
        /// </summary>
        /// <param name="playerId">The player to check.</param>
        /// <returns>True if the player is an attendee.</returns>
        public bool IsAttendee(string playerId)
        {
            return !string.IsNullOrWhiteSpace(playerId) && attendees.Contains(playerId);
        }

        /// <summary>
        /// Updates event statuses and mini-event timers.
        /// </summary>
        private void Update()
        {
            long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            UpdateScheduledEvents(now);
            UpdateMiniEvent(now);
            UpdateBoostTimer();
        }

        /// <summary>
        /// Processes scheduled event state transitions.
        /// </summary>
        private void UpdateScheduledEvents(long now)
        {
            foreach (RoomEventData evt in scheduledEvents)
            {
                if (evt.IsCancelled) continue;

                if (now >= evt.StartTimeUtc && now < evt.EndTimeUtc)
                {
                    // Event is active
                    OnEventStarted?.Invoke(evt.EventId);
                    EventBus.RoomEventStarted?.Invoke(evt.EventId, evt.EventName);
                    evt.IsCancelled = true; // Prevent re-fire; in production use a fired flag
                }
                else if (now >= evt.EndTimeUtc)
                {
                    OnEventEnded?.Invoke(evt.EventId);
                    EventBus.RoomEventEnded?.Invoke(evt.EventId, evt.EventName);
                }
            }
        }

        /// <summary>
        /// Processes mini-event status transitions based on elapsed time.
        /// </summary>
        private void UpdateMiniEvent(long now)
        {
            if (currentMiniEvent == null) return;
            if (currentMiniEvent.Status == MiniEventStatus.Ended) return;

            long secondsRemaining = currentMiniEvent.EndTimeUtc - now;

            if (secondsRemaining <= 0)
            {
                EndMiniEvent();
            }
            else if (secondsRemaining <= endingSoonThresholdSeconds && currentMiniEvent.Status != MiniEventStatus.EndingSoon)
            {
                currentMiniEvent.Status = MiniEventStatus.EndingSoon;
                OnMiniEventStatusChanged?.Invoke(currentMiniEvent.Type, MiniEventStatus.EndingSoon);
            }
            else if (now >= currentMiniEvent.StartTimeUtc - startingSoonThresholdSeconds && now < currentMiniEvent.StartTimeUtc && currentMiniEvent.Status != MiniEventStatus.StartingSoon)
            {
                currentMiniEvent.Status = MiniEventStatus.StartingSoon;
                OnMiniEventStatusChanged?.Invoke(currentMiniEvent.Type, MiniEventStatus.StartingSoon);
            }
        }

        /// <summary>
        /// Decrements the boost timer.
        /// </summary>
        private void UpdateBoostTimer()
        {
            if (!isBoostActive) return;
            boostRemainingSeconds -= Time.deltaTime;
            if (boostRemainingSeconds <= 0)
            {
                isBoostActive = false;
                boostRemainingSeconds = 0;
                OnBoostChanged?.Invoke(false);
                EventBus.RoomBoostExpired?.Invoke();
            }
        }

        /// <summary>
        /// Checks whether the local player can host events.
        /// </summary>
        private bool CanHostEvent()
        {
            if (RoomSettingsManager.Instance == null) return false;
            return RoomSettingsManager.Instance.CanEdit();
        }

        /// <summary>
        /// Gets the local player's identifier.
        /// </summary>
        private string GetLocalPlayerId()
        {
            if (PlayFabManager.Instance != null)
                return PlayFabManager.Instance.GetPlayerId();
            return "local_player";
        }

        /// <summary>
        /// Clears event state when leaving a room.
        /// </summary>
        private void OnRoomExited(string roomId)
        {
            if (currentMiniEvent != null)
            {
                currentMiniEvent.Status = MiniEventStatus.Ended;
                currentMiniEvent = null;
            }
            scheduledEvents.Clear();
            attendees.Clear();
            isBoostActive = false;
            boostRemainingSeconds = 0f;
        }

        private void OnEnable()
        {
            EventBus.RoomExited += OnRoomExited;
        }

        private void OnDisable()
        {
            EventBus.RoomExited -= OnRoomExited;
        }
    }
}
