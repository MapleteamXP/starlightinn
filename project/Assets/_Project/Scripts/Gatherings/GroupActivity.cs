using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KawaiiCoolIsland.Gatherings
{
    /// <summary>
    /// Enumerates the possible lifecycle states of a group activity.
    /// </summary>
    public enum ActivityState
    {
        /// <summary>Waiting for enough participants to join.</summary>
        Waiting,

        /// <summary>A countdown before the activity begins.</summary>
        Countdown,

        /// <summary>The activity is currently running.</summary>
        Active,

        /// <summary>Results are being displayed.</summary>
        Results,

        /// <summary>The activity has fully concluded.</summary>
        Ended
    }

    /// <summary>
    /// Base class for cooperative group activities that parties can participate in together.
    /// Handles participant lifecycle, scoring, and synchronized state transitions.
    /// </summary>
    public class GroupActivity : MonoBehaviour
    {
        // ─────────────────────────────────────────────────────────────
        // Config
        // ─────────────────────────────────────────────────────────────

        /// <summary>The type of party activity this represents.</summary>
        [Header("Activity")]
        public PartyActivityType ActivityType = PartyActivityType.Custom;

        /// <summary>The human-readable name displayed in UI.</summary>
        public string ActivityName = "Group Activity";

        /// <summary>Duration in seconds the activity runs once active.</summary>
        public float Duration = 60f;

        /// <summary>Minimum participants required to begin.</summary>
        public int MinParticipants = 2;

        /// <summary>Maximum participants allowed.</summary>
        public int MaxParticipants = 8;

        // ─────────────────────────────────────────────────────────────
        // State
        // ─────────────────────────────────────────────────────────────

        /// <summary>The current lifecycle state of this activity.</summary>
        [Header("State")]
        public ActivityState CurrentState = ActivityState.Waiting;

        /// <summary>Player IDs currently participating.</summary>
        public List<string> Participants = new();

        /// <summary>Scoreboard keyed by player ID.</summary>
        public Dictionary<string, int> ParticipantScores = new();

        /// <summary>Elapsed time since the activity became Active.</summary>
        private float _elapsedTime = 0f;

        /// <summary>Countdown timer before the activity becomes Active.</summary>
        private float _countdownTimer = 5f;

        /// <summary>Whether rewards have already been distributed.</summary>
        private bool _rewardsAwarded = false;

        // ─────────────────────────────────────────────────────────────
        // Events
        // ─────────────────────────────────────────────────────────────

        /// <summary>Raised when the activity transitions to <see cref="ActivityState.Active"/>.</summary>
        public event Action OnActivityStarted;

        /// <summary>Raised when the activity transitions to <see cref="ActivityState.Results"/> or <see cref="ActivityState.Ended"/>.</summary>
        public event Action OnActivityEnded;

        /// <summary>Raised when a participant's score changes. Args: playerId, newScore.</summary>
        public event Action<string, int> OnScoreChanged;

        // ─────────────────────────────────────────────────────────────
        // Lifecycle
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Validates configuration on startup.
        /// </summary>
        protected virtual void Start()
        {
            if (MinParticipants < 1) MinParticipants = 1;
            if (MaxParticipants < MinParticipants) MaxParticipants = MinParticipants;
        }

        /// <summary>
        /// Drives countdown, active timer, and automatic state transitions.
        /// </summary>
        protected virtual void Update()
        {
            switch (CurrentState)
            {
                case ActivityState.Countdown:
                    _countdownTimer -= Time.deltaTime;
                    if (_countdownTimer <= 0f)
                        TransitionToActive();
                    break;

                case ActivityState.Active:
                    _elapsedTime += Time.deltaTime;
                    if (_elapsedTime >= Duration)
                        TransitionToResults();
                    break;

                case ActivityState.Results:
                    // Results linger for a short moment before auto-ending
                    break;
            }
        }

        // ─────────────────────────────────────────────────────────────
        // Participant Management
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Adds a player as a participant if capacity allows.
        /// </summary>
        /// <param name="playerId">The player to add.</param>
        public virtual void AddParticipant(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return;
            if (Participants.Contains(playerId)) return;
            if (Participants.Count >= MaxParticipants)
            {
                Debug.LogWarning($"[GroupActivity] Max participants ({MaxParticipants}) reached.");
                return;
            }

            Participants.Add(playerId);
            if (!ParticipantScores.ContainsKey(playerId))
                ParticipantScores[playerId] = 0;

            Debug.Log($"[GroupActivity] Added participant {playerId}. Count={Participants.Count}");

            // Auto-start if we cross the minimum threshold while waiting
            if (CurrentState == ActivityState.Waiting && Participants.Count >= MinParticipants)
            {
                StartActivity(Participants);
            }
        }

        /// <summary>
        /// Removes a player from the activity.
        /// </summary>
        /// <param name="playerId">The player to remove.</param>
        public virtual void RemoveParticipant(string playerId)
        {
            if (!Participants.Contains(playerId)) return;
            Participants.Remove(playerId);
            Debug.Log($"[GroupActivity] Removed participant {playerId}. Count={Participants.Count}");

            // If below minimum while active, we could optionally pause; for now we continue.
            if (CurrentState == ActivityState.Active && Participants.Count == 0)
            {
                EndActivity();
            }
        }

        // ─────────────────────────────────────────────────────────────
        // Activity Lifecycle
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Begins the activity with the given participants, entering a brief countdown first.
        /// </summary>
        /// <param name="participants">The initial set of player IDs.</param>
        public virtual void StartActivity(List<string> participants)
        {
            if (CurrentState != ActivityState.Waiting)
            {
                Debug.LogWarning("[GroupActivity] Already started or ended.");
                return;
            }

            Participants = new List<string>(participants ?? new List<string>());
            foreach (var id in Participants)
            {
                if (!ParticipantScores.ContainsKey(id))
                    ParticipantScores[id] = 0;
            }

            if (Participants.Count < MinParticipants)
            {
                Debug.LogWarning($"[GroupActivity] Not enough participants ({Participants.Count}/{MinParticipants}).");
                return;
            }

            CurrentState = ActivityState.Countdown;
            _countdownTimer = 5f;
            _elapsedTime = 0f;
            _rewardsAwarded = false;

            Debug.Log($"[GroupActivity] Starting countdown for {ActivityName}...");
        }

        /// <summary>
        /// Ends the activity immediately, transitioning to results.
        /// </summary>
        public virtual void EndActivity()
        {
            if (CurrentState == ActivityState.Ended) return;

            TransitionToResults();
        }

        /// <summary>
        /// Transitions from Countdown to Active state.
        /// </summary>
        protected virtual void TransitionToActive()
        {
            CurrentState = ActivityState.Active;
            _elapsedTime = 0f;
            Debug.Log($"[GroupActivity] {ActivityName} is now ACTIVE!");
            OnActivityStarted?.Invoke();
            EventBus.Instance?.Publish("GroupActivityStarted", ActivityType, Participants);
        }

        /// <summary>
        /// Transitions from Active to Results state and awards rewards.
        /// </summary>
        protected virtual void TransitionToResults()
        {
            if (CurrentState == ActivityState.Results || CurrentState == ActivityState.Ended)
                return;

            CurrentState = ActivityState.Results;
            Debug.Log($"[GroupActivity] {ActivityName} results displayed.");
            AwardGroupRewards();
            OnActivityEnded?.Invoke();
            EventBus.Instance?.Publish("GroupActivityEnded", ActivityType, GetRankedScores());

            // Automatically move to Ended after a brief display window
            Invoke(nameof(TransitionToEnded), 5f);
        }

        /// <summary>
        /// Final transition to the Ended state.
        /// </summary>
        private void TransitionToEnded()
        {
            CurrentState = ActivityState.Ended;
            Debug.Log($"[GroupActivity] {ActivityName} fully ended.");
        }

        // ─────────────────────────────────────────────────────────────
        // Scoring
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Sets (or overwrites) the score for a specific participant.
        /// </summary>
        /// <param name="playerId">The participant.</param>
        /// <param name="score">The new score value.</param>
        public virtual void SetParticipantScore(string playerId, int score)
        {
            if (!Participants.Contains(playerId))
            {
                Debug.LogWarning($"[GroupActivity] {playerId} is not a participant.");
                return;
            }

            int previous = ParticipantScores.ContainsKey(playerId) ? ParticipantScores[playerId] : 0;
            ParticipantScores[playerId] = Mathf.Max(0, score);
            OnScoreChanged?.Invoke(playerId, ParticipantScores[playerId]);
            EventBus.Instance?.Publish("GroupActivityScoreChanged", playerId, ParticipantScores[playerId]);

            if (ParticipantScores[playerId] != previous)
                Debug.Log($"[GroupActivity] Score for {playerId}: {previous} -> {ParticipantScores[playerId]}");
        }

        /// <summary>
        /// Returns the current scores sorted descending.
        /// </summary>
        /// <returns>A list of player ID / score pairs ranked highest-first.</returns>
        public virtual List<KeyValuePair<string, int>> GetRankedScores()
        {
            return ParticipantScores
                .OrderByDescending(kv => kv.Value)
                .ToList();
        }

        // ─────────────────────────────────────────────────────────────
        // Rewards
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Awards group-wide and individual rewards based on participation and performance.
        /// Override in subclasses for activity-specific reward logic.
        /// </summary>
        public virtual void AwardGroupRewards()
        {
            if (_rewardsAwarded) return;
            _rewardsAwarded = true;

            var ranked = GetRankedScores();
            if (ranked.Count == 0) return;

            int topScore = ranked[0].Value;
            foreach (var kv in ranked)
            {
                int bonus = kv.Value == topScore ? 10 : 5;
                int participationBonus = Participants.Contains(kv.Key) ? 5 : 0;
                int total = kv.Value + bonus + participationBonus;

                Debug.Log($"[GroupActivity] Reward for {kv.Key}: {total} points (base {kv.Value}, rank {bonus}, participation {participationBonus})");
                EventBus.Instance?.Publish("ActivityRewardGranted", kv.Key, ActivityType, total);
            }

            Debug.Log($"[GroupActivity] Group rewards awarded for {ActivityName}.");
        }

        // ─────────────────────────────────────────────────────────────
        // Utility
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Returns true if the specified player is participating.
        /// </summary>
        public bool IsParticipant(string playerId)
        {
            return Participants.Contains(playerId);
        }

        /// <summary>
        /// Returns the score for a participant, or zero if not found.
        /// </summary>
        public int GetScore(string playerId)
        {
            return ParticipantScores.ContainsKey(playerId) ? ParticipantScores[playerId] : 0;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // Specialized Activity Types
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// A group photo activity where participants are positioned, a countdown runs, and a snapshot is taken.
    /// </summary>
    public class GroupPhotoActivity : GroupActivity
    {
        /// <summary>Positions assigned to each participant for the photo.</summary>
        public Dictionary<string, Vector3> PhotoPositions = new();

        /// <summary>The camera used to capture the group photo.</summary>
        public Camera PhotoCamera;

        /// <summary>Whether the photo has already been snapped.</summary>
        private bool _photoSnapped = false;

        /// <summary>
        /// Initializes the photo activity with a shorter countdown.
        /// </summary>
        protected override void Start()
        {
            base.Start();
            ActivityType = PartyActivityType.PhotoShoot;
            ActivityName = "Group Photo";
            Duration = 10f;
            MinParticipants = 1;
            MaxParticipants = 8;
        }

        /// <summary>
        /// Overrides active update to trigger a photo snap once during the activity.
        /// </summary>
        protected override void Update()
        {
            base.Update();

            if (CurrentState == ActivityState.Active && !_photoSnapped && _elapsedTime >= Duration * 0.5f)
            {
                SnapPhoto();
            }
        }

        /// <summary>
        /// Adds a participant and assigns them a photo slot position.
        /// </summary>
        public override void AddParticipant(string playerId)
        {
            base.AddParticipant(playerId);
            if (!PhotoPositions.ContainsKey(playerId))
            {
                int index = Participants.IndexOf(playerId);
                PhotoPositions[playerId] = CalculateSlotPosition(index);
            }
        }

        /// <summary>
        /// Removes a participant and frees their photo slot.
        /// </summary>
        public override void RemoveParticipant(string playerId)
        {
            base.RemoveParticipant(playerId);
            PhotoPositions.Remove(playerId);
        }

        /// <summary>
        /// Captures the group photo and awards bonus points for good positioning.
        /// </summary>
        private void SnapPhoto()
        {
            _photoSnapped = true;
            Debug.Log("[GroupPhotoActivity] SNAP! Group photo captured.");
            EventBus.Instance?.Publish("GroupPhotoSnapped", ActivityName, Participants);

            // Award bonus for every participant present at snap time
            foreach (var pid in Participants)
            {
                SetParticipantScore(pid, GetScore(pid) + 15);
            }
        }

        /// <summary>
        /// Computes a world-space position for a photo slot based on its index.
        /// </summary>
        private Vector3 CalculateSlotPosition(int index)
        {
            float angle = (index / (float)Mathf.Max(1, MaxParticipants)) * 180f - 90f;
            float radius = 2f;
            float x = Mathf.Sin(angle * Mathf.Deg2Rad) * radius;
            float z = Mathf.Cos(angle * Mathf.Deg2Rad) * radius;
            return transform.position + new Vector3(x, 0f, z);
        }

        /// <summary>
        /// Resets the photo activity for reuse.
        /// </summary>
        public override void StartActivity(List<string> participants)
        {
            _photoSnapped = false;
            PhotoPositions.Clear();
            base.StartActivity(participants);
        }
    }

    /// <summary>
    /// A synchronized dance activity where participants earn points for timing accuracy.
    /// </summary>
    public class GroupDanceActivity : GroupActivity
    {
        /// <summary>The current beat index in the dance routine.</summary>
        public int CurrentBeat = 0;

        /// <summary>Total beats in the dance routine.</summary>
        public int TotalBeats = 16;

        /// <summary>Seconds per beat.</summary>
        public float BeatInterval = 1f;

        /// <summary>Tracks whether each participant hit the current beat.</summary>
        private Dictionary<string, bool> _beatHits = new();

        /// <summary>
        /// Initializes the dance activity.
        /// </summary>
        protected override void Start()
        {
            base.Start();
            ActivityType = PartyActivityType.DanceParty;
            ActivityName = "Synchronized Dance";
            Duration = TotalBeats * BeatInterval;
            MinParticipants = 2;
            MaxParticipants = 8;
        }

        /// <summary>
        /// Runs the dance beat metronome during the active phase.
        /// </summary>
        protected override void Update()
        {
            base.Update();

            if (CurrentState == ActivityState.Active)
            {
                int expectedBeat = Mathf.FloorToInt(_elapsedTime / BeatInterval);
                if (expectedBeat > CurrentBeat && expectedBeat < TotalBeats)
                {
                    CurrentBeat = expectedBeat;
                    OnNewBeat();
                }
            }
        }

        /// <summary>
        /// Called at the start of every beat to reset hit tracking.
        /// </summary>
        private void OnNewBeat()
        {
            _beatHits.Clear();
            EventBus.Instance?.Publish("DanceNewBeat", CurrentBeat, TotalBeats);
            Debug.Log($"[GroupDanceActivity] Beat {CurrentBeat}/{TotalBeats}");
        }

        /// <summary>
        /// Call this when a participant hits the current beat on time.
        /// </summary>
        /// <param name="playerId">The participant who hit the beat.</param>
        public void ReportBeatHit(string playerId)
        {
            if (!Participants.Contains(playerId)) return;
            if (_beatHits.ContainsKey(playerId)) return; // Only one hit per beat

            _beatHits[playerId] = true;
            int current = GetScore(playerId);
            SetParticipantScore(playerId, current + 10);
            Debug.Log($"[GroupDanceActivity] {playerId} hit beat {CurrentBeat}!");
        }

        /// <summary>
        /// Call this when a participant misses the current beat window.
        /// </summary>
        /// <param name="playerId">The participant who missed.</param>
        public void ReportBeatMiss(string playerId)
        {
            if (!Participants.Contains(playerId)) return;
            Debug.Log($"[GroupDanceActivity] {playerId} missed beat {CurrentBeat}.");
        }

        /// <summary>
        /// Overrides reward distribution to give a synchronization bonus.
        /// </summary>
        public override void AwardGroupRewards()
        {
            if (_rewardsAwarded) return;

            // Perfect-sync bonus if all participants have identical high scores
            var ranked = GetRankedScores();
            if (ranked.Count > 1 && ranked[0].Value > 0 && ranked.All(kv => kv.Value == ranked[0].Value))
            {
                foreach (var pid in Participants)
                {
                    SetParticipantScore(pid, GetScore(pid) + 25);
                }
                Debug.Log("[GroupDanceActivity] PERFECT SYNC BONUS awarded!");
            }

            base.AwardGroupRewards();
        }
    }

    /// <summary>
    /// A scavenger hunt where participants find items scattered around a room.
    /// </summary>
    public class ScavengerHuntActivity : GroupActivity
    {
        /// <summary>Total collectible items placed in the room.</summary>
        public int TotalItems = 10;

        /// <summary>Items collected keyed by player ID.</summary>
        private Dictionary<string, int> _itemsCollected = new();

        /// <summary>
        /// Initializes the scavenger hunt.
        /// </summary>
        protected override void Start()
        {
            base.Start();
            ActivityType = PartyActivityType.ScavengerHunt;
            ActivityName = "Scavenger Hunt";
            Duration = 120f;
            MinParticipants = 1;
            MaxParticipants = 8;
        }

        /// <summary>
        /// Adds a participant with zero collected items.
        /// </summary>
        public override void AddParticipant(string playerId)
        {
            base.AddParticipant(playerId);
            if (!_itemsCollected.ContainsKey(playerId))
                _itemsCollected[playerId] = 0;
        }

        /// <summary>
        /// Call this when a participant collects an item.
        /// </summary>
        /// <param name="playerId">The collector.</param>
        public void CollectItem(string playerId)
        {
            if (!Participants.Contains(playerId)) return;
            _itemsCollected[playerId] = _itemsCollected.GetValueOrDefault(playerId, 0) + 1;
            SetParticipantScore(playerId, _itemsCollected[playerId] * 5);
            EventBus.Instance?.Publish("ScavengerItemCollected", playerId, _itemsCollected[playerId]);
            Debug.Log($"[ScavengerHuntActivity] {playerId} collected item #{_itemsCollected[playerId]}");
        }

        /// <summary>
        /// Returns the number of items collected by a participant.
        /// </summary>
        public int GetItemsCollected(string playerId)
        {
            return _itemsCollected.GetValueOrDefault(playerId, 0);
        }

        /// <summary>
        /// Overrides rewards to give a completion bonus if all items were found.
        /// </summary>
        public override void AwardGroupRewards()
        {
            if (_rewardsAwarded) return;

            int totalFound = _itemsCollected.Values.Sum();
            if (totalFound >= TotalItems)
            {
                foreach (var pid in Participants)
                {
                    SetParticipantScore(pid, GetScore(pid) + 20);
                }
                Debug.Log("[ScavengerHuntActivity] ALL ITEMS FOUND BONUS!");
            }

            base.AwardGroupRewards();
        }

        /// <summary>
        /// Resets the activity for a new round.
        /// </summary>
        public override void StartActivity(List<string> participants)
        {
            _itemsCollected.Clear();
            base.StartActivity(participants);
        }
    }
}
