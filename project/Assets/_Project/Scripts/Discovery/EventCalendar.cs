using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KawaiiCoolIsland.Discovery
{
    /// <summary>
    /// Types of scheduled events available on the island.
    /// </summary>
    public enum EventType
    {
        MinigameTournament,
        FashionShow,
        RoomOpening,
        MeetAndGreet,
        HolidayEvent,
        SpecialPromotion,
        CommunityEvent,
        PlayerHosted
    }

    /// <summary>
    /// Current lifecycle status of a scheduled event.
    /// </summary>
    public enum EventStatus
    {
        Upcoming,
        StartingSoon,
        Active,
        EndingSoon,
        Ended,
        Cancelled
    }

    /// <summary>
    /// Data structure representing a reward granted for event participation.
    /// </summary>
    [System.Serializable]
    public class RewardData
    {
        public string RewardId;
        public string RewardName;
        public int Quantity;
        public Sprite RewardIcon;
    }

    /// <summary>
    /// Represents a single scheduled event on the calendar.
    /// </summary>
    [System.Serializable]
    public class ScheduledEvent
    {
        public string EventId;
        public string EventName;
        public string Description;
        public Sprite Banner;
        public DateTime StartTime;
        public DateTime EndTime;
        public string RoomId;
        public string RoomName;
        public EventType Type;
        public EventStatus Status;
        public int MaxAttendees;
        public int CurrentAttendees;
        public List<string> AttendeeIds = new List<string>();
        public List<string> HostIds = new List<string>();
        public List<RewardData> Rewards = new List<RewardData>();
        public bool IsOfficial;
        public bool RequiresRSVP;
        public List<string> Tags = new List<string>();
    }

    /// <summary>
    /// Manages the island's event calendar, countdowns, RSVPs and event lifecycle.
    /// </summary>
    public class EventCalendar : Singleton<EventCalendar>
    {
        [Header("Events")]
        /// <summary>Complete list of all known events.</summary>
        public List<ScheduledEvent> AllEvents = new List<ScheduledEvent>();
        /// <summary>Events that have not yet started.</summary>
        public List<ScheduledEvent> UpcomingEvents = new List<ScheduledEvent>();
        /// <summary>Events that are currently running.</summary>
        public List<ScheduledEvent> ActiveEvents = new List<ScheduledEvent>();
        /// <summary>Events the local player has RSVP'd to.</summary>
        public List<ScheduledEvent> MyEvents = new List<ScheduledEvent>();

        [Header("Settings")]
        /// <summary>Seconds between automatic refreshes.</summary>
        public float RefreshInterval = 60f;
        /// <summary>Maximum number of upcoming events to track.</summary>
        public int MaxUpcomingEvents = 20;

        /// <summary>Invoked when an event transitions to Active status.</summary>
        public event Action<ScheduledEvent> OnEventStarted;
        /// <summary>Invoked when an event is about to end.</summary>
        public event Action<ScheduledEvent> OnEventEnding;
        /// <summary>Invoked when a brand-new event is announced.</summary>
        public event Action<ScheduledEvent> OnNewEventAnnounced;

        private string _localPlayerId;
        private Coroutine _refreshCoroutine;
        private HashSet<string> _notifiedStarting = new HashSet<string>();
        private HashSet<string> _notifiedEnding = new HashSet<string>();

        /// <summary>
        /// Refreshes all event lists from the backend and recalculates statuses.
        /// </summary>
        public void RefreshEvents()
        {
            UpdateEventStatuses();
            SortEvents();
            BuildDerivedLists();
            CheckForStartingEvents();
        }

        /// <summary>
        /// Gets all events scheduled for a specific date.
        /// </summary>
        /// <param name="date">The calendar date to query.</param>
        /// <returns>List of events on that date.</returns>
        public List<ScheduledEvent> GetEventsForDate(DateTime date)
        {
            return AllEvents.Where(e => e.StartTime.Date == date.Date)
                            .OrderBy(e => e.StartTime)
                            .ToList();
        }

        /// <summary>
        /// Gets all events scheduled for the current week (Monday-Sunday).
        /// </summary>
        /// <returns>List of events this week.</returns>
        public List<ScheduledEvent> GetEventsForWeek()
        {
            DateTime today = DateTime.Today;
            int offset = (int)today.DayOfWeek - (int)DayOfWeek.Monday;
            if (offset < 0) offset += 7;
            DateTime monday = today.AddDays(-offset);
            DateTime sunday = monday.AddDays(6);

            return AllEvents.Where(e => e.StartTime.Date >= monday && e.StartTime.Date <= sunday)
                            .OrderBy(e => e.StartTime)
                            .ToList();
        }

        /// <summary>
        /// Gets all events scheduled for the current month.
        /// </summary>
        /// <returns>List of events this month.</returns>
        public List<ScheduledEvent> GetEventsForMonth()
        {
            DateTime today = DateTime.Today;
            return AllEvents.Where(e => e.StartTime.Year == today.Year && e.StartTime.Month == today.Month)
                            .OrderBy(e => e.StartTime)
                            .ToList();
        }

        /// <summary>
        /// Gets the next upcoming event.
        /// </summary>
        /// <returns>The next event, or null if none.</returns>
        public ScheduledEvent GetNextEvent()
        {
            return UpcomingEvents.OrderBy(e => e.StartTime).FirstOrDefault();
        }

        /// <summary>
        /// Retrieves an event by its unique ID.
        /// </summary>
        /// <param name="eventId">The event ID to look up.</param>
        /// <returns>The event, or null if not found.</returns>
        public ScheduledEvent GetEvent(string eventId)
        {
            return AllEvents.FirstOrDefault(e => e.EventId == eventId);
        }

        /// <summary>
        /// RSVPs the local player to an event.
        /// </summary>
        /// <param name="eventId">The event to RSVP to.</param>
        public void RSVPToEvent(string eventId)
        {
            var evt = GetEvent(eventId);
            if (evt == null) return;
            if (evt.RequiresRSVP && evt.AttendeeIds.Count >= evt.MaxAttendees)
            {
                Debug.LogWarning($"Event {evt.EventName} is full.");
                return;
            }
            if (!evt.AttendeeIds.Contains(_localPlayerId))
            {
                evt.AttendeeIds.Add(_localPlayerId);
                evt.CurrentAttendees = evt.AttendeeIds.Count;
                BuildMyEvents();
                EventBus.Publish("RSVPSuccess", eventId);
            }
        }

        /// <summary>
        /// Cancels the local player's RSVP for an event.
        /// </summary>
        /// <param name="eventId">The event ID to cancel.</param>
        public void CancelRSVP(string eventId)
        {
            var evt = GetEvent(eventId);
            if (evt == null) return;
            evt.AttendeeIds.Remove(_localPlayerId);
            evt.CurrentAttendees = evt.AttendeeIds.Count;
            BuildMyEvents();
            EventBus.Publish("RSVPCancelled", eventId);
        }

        /// <summary>
        /// Checks whether the local player has RSVP'd to the given event.
        /// </summary>
        /// <param name="eventId">The event ID.</param>
        /// <returns>True if RSVP'd, otherwise false.</returns>
        public bool HasRSVPd(string eventId)
        {
            var evt = GetEvent(eventId);
            return evt != null && evt.AttendeeIds.Contains(_localPlayerId);
        }

        /// <summary>
        /// Gets the number of attendees for an event.
        /// </summary>
        /// <param name="eventId">The event ID.</param>
        /// <returns>Attendee count.</returns>
        public int GetRSVPCount(string eventId)
        {
            var evt = GetEvent(eventId);
            return evt?.AttendeeIds.Count ?? 0;
        }

        /// <summary>
        /// Creates a new player-hosted event.
        /// </summary>
        /// <param name="eventName">Display name of the event.</param>
        /// <param name="roomId">Room where the event takes place.</param>
        /// <param name="startTime">When the event starts.</param>
        /// <param name="maxAttendees">Maximum allowed attendees.</param>
        public void CreatePlayerEvent(string eventName, string roomId, DateTime startTime, int maxAttendees)
        {
            var evt = new ScheduledEvent
            {
                EventId = Guid.NewGuid().ToString(),
                EventName = eventName,
                RoomId = roomId,
                StartTime = startTime,
                EndTime = startTime.AddHours(1),
                MaxAttendees = maxAttendees,
                Type = EventType.PlayerHosted,
                IsOfficial = false,
                RequiresRSVP = true,
                Status = EventStatus.Upcoming,
                HostIds = new List<string> { _localPlayerId }
            };
            AllEvents.Add(evt);
            OnNewEventAnnounced?.Invoke(evt);
            RefreshEvents();
        }

        /// <summary>
        /// Gets the remaining time until an event starts.
        /// </summary>
        /// <param name="eventId">The event ID.</param>
        /// <returns>TimeSpan until start, or TimeSpan.Zero if already started/ended.</returns>
        public TimeSpan GetTimeUntilEvent(string eventId)
        {
            var evt = GetEvent(eventId);
            if (evt == null) return TimeSpan.Zero;
            DateTime now = DateTime.Now;
            if (now >= evt.StartTime) return TimeSpan.Zero;
            return evt.StartTime - now;
        }

        /// <summary>
        /// Gets a human-readable countdown string for an event.
        /// </summary>
        /// <param name="eventId">The event ID.</param>
        /// <returns>Formatted countdown text.</returns>
        public string GetCountdownText(string eventId)
        {
            TimeSpan remaining = GetTimeUntilEvent(eventId);
            if (remaining <= TimeSpan.Zero)
                return "Started!";
            if (remaining.TotalDays >= 1)
                return $"{remaining.Days}d {remaining.Hours}h remaining";
            if (remaining.TotalHours >= 1)
                return $"{remaining.Hours}h {remaining.Minutes}m remaining";
            return $"{remaining.Minutes}m {remaining.Seconds}s remaining";
        }

        /// <summary>
        /// Updates the lifecycle status of all events based on current time.
        /// </summary>
        private void UpdateEventStatuses()
        {
            DateTime now = DateTime.Now;
            foreach (var evt in AllEvents)
            {
                if (evt.Status == EventStatus.Cancelled) continue;

                double minutesToStart = (evt.StartTime - now).TotalMinutes;
                double minutesToEnd = (evt.EndTime - now).TotalMinutes;

                if (minutesToEnd <= 0)
                    evt.Status = EventStatus.Ended;
                else if (minutesToEnd <= 10)
                    evt.Status = EventStatus.EndingSoon;
                else if (minutesToStart <= 0)
                    evt.Status = EventStatus.Active;
                else if (minutesToStart <= 30)
                    evt.Status = EventStatus.StartingSoon;
                else
                    evt.Status = EventStatus.Upcoming;
            }
        }

        /// <summary>
        /// Sorts all events by start time ascending.
        /// </summary>
        private void SortEvents()
        {
            AllEvents = AllEvents.OrderBy(e => e.StartTime).ToList();
        }

        /// <summary>
        /// Checks for events that just started or are ending and fires events accordingly.
        /// </summary>
        private void CheckForStartingEvents()
        {
            foreach (var evt in ActiveEvents)
            {
                if (!_notifiedStarting.Contains(evt.EventId))
                {
                    _notifiedStarting.Add(evt.EventId);
                    OnEventStarted?.Invoke(evt);
                    ActivityFeedManager.Instance?.LogEventStarting(evt.EventName, evt.RoomId, 0);
                }
            }

            foreach (var evt in AllEvents.Where(e => e.Status == EventStatus.EndingSoon))
            {
                if (!_notifiedEnding.Contains(evt.EventId))
                {
                    _notifiedEnding.Add(evt.EventId);
                    OnEventEnding?.Invoke(evt);
                }
            }
        }

        /// <summary>
        /// Rebuilds derived event lists (upcoming, active, my events).
        /// </summary>
        private void BuildDerivedLists()
        {
            UpcomingEvents = AllEvents.Where(e => e.Status == EventStatus.Upcoming || e.Status == EventStatus.StartingSoon)
                                       .Take(MaxUpcomingEvents)
                                       .ToList();
            ActiveEvents = AllEvents.Where(e => e.Status == EventStatus.Active || e.Status == EventStatus.EndingSoon)
                                     .ToList();
            BuildMyEvents();
        }

        /// <summary>
        /// Rebuilds the MyEvents list from RSVP data.
        /// </summary>
        private void BuildMyEvents()
        {
            MyEvents = AllEvents.Where(e => e.AttendeeIds.Contains(_localPlayerId))
                                .OrderBy(e => e.StartTime)
                                .ToList();
        }

        /// <summary>
        /// Periodic background refresh coroutine.
        /// </summary>
        private IEnumerator RefreshCoroutine()
        {
            var wait = new WaitForSeconds(RefreshInterval);
            while (true)
            {
                yield return wait;
                RefreshEvents();
            }
        }

        /// <summary>
        /// Unity Awake — initialize local player and start auto-refresh.
        /// </summary>
        protected override void Awake()
        {
            base.Awake();
            _localPlayerId = PlayFabManager.Instance?.GetLocalPlayerId() ?? "local";
            EventBus.Subscribe("EventsFetched", OnEventsFetched);
        }

        /// <summary>
        /// Unity Start — begin periodic refresh.
        /// </summary>
        private void Start()
        {
            if (_refreshCoroutine == null)
                _refreshCoroutine = StartCoroutine(RefreshCoroutine());
        }

        /// <summary>
        /// Cleanup on destroy.
        /// </summary>
        protected override void OnDestroy()
        {
            base.OnDestroy();
            EventBus.Unsubscribe("EventsFetched", OnEventsFetched);
            if (_refreshCoroutine != null)
            {
                StopCoroutine(_refreshCoroutine);
                _refreshCoroutine = null;
            }
        }

        /// <summary>
        /// Handles batch events fetched from the backend.
        /// </summary>
        /// <param name="data">Serialized event data.</param>
        private void OnEventsFetched(object data)
        {
            if (data is List<ScheduledEvent> fetched)
            {
                foreach (var evt in fetched)
                {
                    if (AllEvents.All(e => e.EventId != evt.EventId))
                    {
                        AllEvents.Add(evt);
                        OnNewEventAnnounced?.Invoke(evt);
                    }
                }
                RefreshEvents();
            }
        }
    }
}
