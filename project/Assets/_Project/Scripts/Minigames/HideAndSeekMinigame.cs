using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

// ---------------------------------------------------------------------------
// KawaiiCool Island - Hide and Seek Minigame
// ---------------------------------------------------------------------------
// A multiplayer hide-and-seek game with distinct phases: Seeker Selection,
// Hiding, Seeking, and Round End. The seeker must find all hiders within
// the time limit. Features detection cones, hiding spot validation, and
// scoring for both seekers and hiders.
// ---------------------------------------------------------------------------

namespace KawaiiCool.Minigames
{
    /// <summary>
    /// Current phase of the Hide and Seek minigame.
    /// </summary>
    public enum HideSeekPhase
    {
        /// <summary>Selecting which player will be the seeker.</summary>
        SelectingSeeker,

        /// <summary>Hiders are finding and moving to hiding spots.</summary>
        Hiding,

        /// <summary>Seeker is trying to find all hiders.</summary>
        Seeking,

        /// <summary>The round has ended (all found or time up).</summary>
        RoundEnd
    }

    /// <summary>
    /// Hide and Seek minigame controller. Manages a complete round of
    /// hide-and-seek with seeker selection, hiding phase, seeking phase,
    /// and scoring based on how many hiders were found and how well hiders
    /// evaded detection.
    /// </summary>
    public class HideAndSeekMinigame : MinigameController
    {
        #region Inspector Settings

        [Header("Phases")]
        [Tooltip("Duration of the hiding phase in seconds.")]
        public float HidingDuration = 30f;

        [Tooltip("Duration of the seeking phase in seconds.")]
        public float SeekingDuration = 60f;

        [Tooltip("Delay after seeker is revealed before they can move (seconds).")]
        public float SeekerRevealDelay = 5f;

        [Tooltip("Duration of the round-end phase in seconds.")]
        public float RoundEndDuration = 8f;

        [Header("Hiding")]
        [Tooltip("Bounds of the area where hiders can hide.")]
        public Bounds HidingArea;

        [Tooltip("List of predefined hiding spot transforms.")]
        public List<Transform> HidingSpots;

        [Tooltip("Layer mask for valid hiding spots.")]
        public LayerMask HidingSpotLayer;

        [Tooltip("Minimum distance between hiders.")]
        public float MinHiderDistance = 2f;

        [Header("Seeking")]
        [Tooltip("Movement speed multiplier for the seeker.")]
        public float SeekerSpeedMultiplier = 1.2f;

        [Tooltip("Range within which a seeker can detect a hider.")]
        public float DetectionRange = 2f;

        [Tooltip("Field of view angle for the seeker's detection cone.")]
        public float DetectionAngle = 45f;

        [Tooltip("If true, seekers must be facing toward hiders to detect them.")]
        public bool RequireLineOfSight = true;

        [Tooltip("Layer mask for obstacles that block line of sight.")]
        public LayerMask ObstacleLayer;

        [Header("Scoring")]
        [Tooltip("Points awarded to the seeker for each hider found.")]
        public int PointsPerFind = 100;

        [Tooltip("Points awarded to hiders for each second they remain hidden.")]
        public int PointsPerSecondHidden = 2;

        [Tooltip("Bonus points for hiders not found by the end.")]
        public int NotFoundBonus = 200;

        [Tooltip("Points awarded to seeker for finding all hiders.")]
        public int AllFoundBonus = 150;

        [Header("UI")]
        [Tooltip("Text displaying the current phase.")]
        public TMPro.TMP_Text PhaseText;

        [Tooltip("Text displaying seeker info.")]
        public TMPro.TMP_Text SeekerText;

        [Tooltip("Text displaying remaining hiders count.")]
        public TMPro.TMP_Text HidersRemainingText;

        [Tooltip("Text displaying the seeker's reveal countdown.")]
        public TMPro.TMP_Text RevealCountdownText;

        [Tooltip("Panel shown to hiders during hiding phase.")]
        public GameObject HiderPanel;

        [Tooltip("Panel shown to the seeker.")]
        public GameObject SeekerPanel;

        [Header("Visual")]
        [Tooltip("Particle effect played when a hider is found.")]
        public ParticleSystem FoundEffect;

        [Tooltip("Particle effect played when the round ends.")]
        public ParticleSystem RoundEndEffect;

        [Tooltip("Light or indicator for the seeker.")]
        public GameObject SeekerIndicator;

        [Header("Audio")]
        [Tooltip("SFX played when a hider is found.")]
        public string FoundSFX = "hider_found";

        [Tooltip("SFX played when all hiders are found.")]
        public string AllFoundSFX = "all_hiders_found";

        [Tooltip("SFX played when hiding phase starts.")]
        public string HidingPhaseSFX = "hiding_start";

        [Tooltip("SFX played when seeking phase starts.")]
        public string SeekingPhaseSFX = "seeking_start";

        #endregion

        #region Runtime State

        /// <summary>List of player IDs who are hiders this round.</summary>
        private List<string> _hiders = new();

        /// <summary>List of player IDs who are seekers this round.</summary>
        private List<string> _seekers = new();

        /// <summary>List of hiders who have been found.</summary>
        private List<string> _foundPlayers = new();

        /// <summary>The currently designated seeker player ID.</summary>
        private string _currentSeeker;

        /// <summary>Current phase of the hide-and-seek round.</summary>
        private HideSeekPhase _currentPhase;

        /// <summary>Registered hiding positions for each hider.</summary>
        private Dictionary<string, Vector3> _hidingPositions = new();

        /// <summary>Timer for the current phase.</summary>
        private float _phaseTimer;

        /// <summary>Coroutine for the main round flow.</summary>
        private Coroutine _roundCoroutine;

        /// <summary>Coroutine for the seeker reveal countdown.</summary>
        private Coroutine _revealCoroutine;

        /// <summary>Time tracking for hider survival scoring.</summary>
        private Dictionary<string, float> _hiderHiddenTime = new();

        #endregion

        #region Events

        /// <summary>Invoked when a player is found. Argument: found player ID.</summary>
        public event Action<string> OnPlayerFoundEvent;

        /// <summary>Invoked when the seeker changes. Argument: new seeker player ID.</summary>
        public event Action<string> OnSeekerChanged;

        /// <summary>Invoked when the phase changes. Argument: new phase.</summary>
        public event Action<HideSeekPhase> OnPhaseChanged;

        #endregion

        #region Initialization

        /// <summary>
        /// Called once after initialization. Validates hiding spots and resets state.
        /// </summary>
        protected override void OnInitialized()
        {
            base.OnInitialized();

            _hiders.Clear();
            _seekers.Clear();
            _foundPlayers.Clear();
            _hidingPositions.Clear();
            _hiderHiddenTime.Clear();
            _currentSeeker = null;
            _currentPhase = HideSeekPhase.SelectingSeeker;

            Debug.Log("[HideAndSeek] Initialized.");
        }

        #endregion

        #region Playing State

        /// <summary>
        /// Called when entering the Playing state. Starts the full round flow
        /// coroutine that manages all phases sequentially.
        /// </summary>
        protected override void OnEnterPlaying()
        {
            base.OnEnterPlaying();

            _foundPlayers.Clear();
            _hidingPositions.Clear();
            _hiderHiddenTime.Clear();

            // Select seeker and start round flow
            _roundCoroutine = StartCoroutine(RoundFlowCoroutine());

            Debug.Log("[HideAndSeek] Gameplay started!");
        }

        /// <summary>
        /// Called every frame during gameplay. Updates phase timer and
        /// handles seeker detection.
        /// </summary>
        protected override void OnUpdatePlaying()
        {
            base.OnUpdatePlaying();

            if (_currentPhase == HideSeekPhase.Seeking)
            {
                _phaseTimer -= Time.deltaTime;

                // Update timer display
                if (TimerText != null)
                {
                    int seconds = Mathf.Max(0, Mathf.CeilToInt(_phaseTimer));
                    TimerText.text = $"Seeking: {seconds}s";
                }

                // Update hiders remaining display
                if (HidersRemainingText != null)
                {
                    int remaining = _hiders.Count - _foundPlayers.Count;
                    HidersRemainingText.text = $"Hiders Remaining: {remaining}";
                }

                // Track hidden time for scoring
                foreach (var hiderId in _hiders)
                {
                    if (!_foundPlayers.Contains(hiderId))
                    {
                        if (!_hiderHiddenTime.ContainsKey(hiderId))
                            _hiderHiddenTime[hiderId] = 0f;
                        _hiderHiddenTime[hiderId] += Time.deltaTime;
                    }
                }

                // Check for finds
                CheckForFinds();

                // Time's up
                if (_phaseTimer <= 0f)
                {
                    OnTimeUp();
                }
            }
            else if (_currentPhase == HideSeekPhase.Hiding)
            {
                _phaseTimer -= Time.deltaTime;

                if (TimerText != null)
                {
                    int seconds = Mathf.Max(0, Mathf.CeilToInt(_phaseTimer));
                    TimerText.text = $"Hiding: {seconds}s";
                }
            }
        }

        #endregion

        #region Round Flow Coroutine

        /// <summary>
        /// Main coroutine managing the sequential phases of a hide-and-seek round.
        /// </summary>
        private IEnumerator RoundFlowCoroutine()
        {
            // Phase 1: Select Seeker
            SelectSeeker();
            yield return new WaitForSeconds(2f);

            // Phase 2: Hiding Phase
            StartHidingPhase();
            yield return new WaitForSeconds(HidingDuration);

            // Phase 3: Seeking Phase
            StartSeekingPhase();

            // Wait for seeking to complete (all found or time up)
            while (_currentPhase == HideSeekPhase.Seeking)
            {
                yield return null;
            }

            // Phase 4: Round End
            yield return new WaitForSeconds(RoundEndDuration);

            // End the minigame
            EndMinigame();
        }

        #endregion

        #region Seeker Selection

        /// <summary>
        /// Randomly selects one player as the seeker and assigns the rest as hiders.
        /// </summary>
        private void SelectSeeker()
        {
            _currentPhase = HideSeekPhase.SelectingSeeker;

            if (ParticipatingPlayers.Count == 0)
            {
                Debug.LogError("[HideAndSeek] Cannot select seeker: no players!");
                return;
            }

            // Randomly select seeker
            int seekerIndex = UnityEngine.Random.Range(0, ParticipatingPlayers.Count);
            _currentSeeker = ParticipatingPlayers[seekerIndex];

            // Everyone else is a hider
            _hiders.Clear();
            _seekers.Clear();

            foreach (var playerId in ParticipatingPlayers)
            {
                if (playerId == _currentSeeker)
                    _seekers.Add(playerId);
                else
                    _hiders.Add(playerId);
            }

            // Show seeker info
            string seekerName = PlayerScores.ContainsKey(_currentSeeker) ? PlayerScores[_currentSeeker].PlayerName : _currentSeeker;

            if (SeekerText != null)
                SeekerText.text = $"Seeker: {seekerName}";

            if (PhaseText != null)
                PhaseText.text = "Selecting Seeker...";

            // Show seeker indicator
            if (SeekerIndicator != null)
                SeekerIndicator.SetActive(true);

            try
            {
                OnSeekerChanged?.Invoke(_currentSeeker);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[HideAndSeek] OnSeekerChanged event: {ex}");
            }

            Debug.Log($"[HideAndSeek] Seeker selected: {seekerName} ({_currentSeeker})");
        }

        #endregion

        #region Hiding Phase

        /// <summary>
        /// Starts the hiding phase, allowing hiders to find and move to hiding spots.
        /// </summary>
        private void StartHidingPhase()
        {
            _currentPhase = HideSeekPhase.Hiding;
            _phaseTimer = HidingDuration;

            if (PhaseText != null)
                PhaseText.text = "HIDE!";

            // Show hider panel, hide seeker panel
            SetUIActive(HiderPanel, true);
            SetUIActive(SeekerPanel, false);

            PlaySFX(HidingPhaseSFX);

            try
            {
                OnPhaseChanged?.Invoke(_currentPhase);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[HideAndSeek] OnPhaseChanged event: {ex}");
            }

            Debug.Log("[HideAndSeek] Hiding phase started!");
        }

        #endregion

        #region Seeking Phase

        /// <summary>
        /// Starts the seeking phase after the seeker reveal delay.
        /// </summary>
        private void StartSeekingPhase()
        {
            _currentPhase = HideSeekPhase.Seeking;
            _phaseTimer = SeekingDuration;

            if (PhaseText != null)
                PhaseText.text = "SEEK!";

            // Show seeker panel, hide hider panel
            SetUIActive(HiderPanel, false);
            SetUIActive(SeekerPanel, true);

            // Process any hiding positions that weren't explicitly registered
            foreach (var hiderId in _hiders)
            {
                if (!_hidingPositions.ContainsKey(hiderId))
                {
                    // Assign a random position for players who didn't register
                    _hidingPositions[hiderId] = GetRandomHidingPosition();
                }
            }

            PlaySFX(SeekingPhaseSFX);

            // Start seeker reveal countdown
            _revealCoroutine = StartCoroutine(SeekerRevealCountdown());

            try
            {
                OnPhaseChanged?.Invoke(_currentPhase);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[HideAndSeek] OnPhaseChanged event: {ex}");
            }

            Debug.Log("[HideAndSeek] Seeking phase started!");
        }

        /// <summary>
        /// Coroutine for the seeker reveal countdown. Shows a "seeker is coming"
        /// warning before the seeker can actually move.
        /// </summary>
        private IEnumerator SeekerRevealCountdown()
        {
            float countdown = SeekerRevealDelay;

            while (countdown > 0f)
            {
                countdown -= Time.deltaTime;

                if (RevealCountdownText != null)
                {
                    RevealCountdownText.text = $"Seeker starts in: {Mathf.CeilToInt(countdown)}s";
                }

                yield return null;
            }

            if (RevealCountdownText != null)
                RevealCountdownText.text = "Seeker is coming!";

            // Seeker can now move and detect
            Debug.Log("[HideAndSeek] Seeker reveal delay complete. Seeker can now find!");
        }

        #endregion

        #region Detection

        /// <summary>
        /// Checks if the seeker has found any hiders based on proximity and
        /// line-of-sight checks.
        /// </summary>
        private void CheckForFinds()
        {
            if (string.IsNullOrEmpty(_currentSeeker)) return;

            // Get seeker position (stub — would come from player controller)
            Vector3 seekerPos = GetPlayerWorldPosition(_currentSeeker);
            Vector3 seekerForward = GetPlayerForward(_currentSeeker);

            foreach (var hiderId in _hiders)
            {
                // Skip already found hiders
                if (_foundPlayers.Contains(hiderId)) continue;

                // Get hider position
                Vector3 hiderPos = _hidingPositions.ContainsKey(hiderId)
                    ? _hidingPositions[hiderId]
                    : GetPlayerWorldPosition(hiderId);

                float distance = Vector3.Distance(seekerPos, hiderPos);

                // Check distance
                if (distance > DetectionRange) continue;

                // Check angle (field of view)
                if (DetectionAngle < 360f)
                {
                    Vector3 dirToHider = (hiderPos - seekerPos).normalized;
                    float angle = Vector3.Angle(seekerForward, dirToHider);
                    if (angle > DetectionAngle * 0.5f) continue;
                }

                // Check line of sight
                if (RequireLineOfSight)
                {
                    if (Physics.Raycast(seekerPos, (hiderPos - seekerPos).normalized, distance, ObstacleLayer))
                        continue;
                }

                // Hider found!
                OnPlayerFound(hiderId, _currentSeeker);
            }
        }

        /// <summary>
        /// Handles a hider being found by the seeker. Awards points and checks
        /// if all hiders have been found.
        /// </summary>
        /// <param name="hiderId">The found hider's player ID.</param>
        /// <param name="seekerId">The seeker who found them.</param>
        private void OnPlayerFound(string hiderId, string seekerId)
        {
            if (_foundPlayers.Contains(hiderId)) return;

            _foundPlayers.Add(hiderId);

            // Award seeker points
            AddScore(seekerId, PointsPerFind);

            // Update stats
            if (PlayerScores.ContainsKey(seekerId))
            {
                if (!PlayerScores[seekerId].Stats.ContainsKey("hiders_found"))
                    PlayerScores[seekerId].Stats["hiders_found"] = 0;
                PlayerScores[seekerId].Stats["hiders_found"]++;
            }

            // Play found effect
            if (FoundEffect != null)
            {
                Vector3 foundPos = _hidingPositions.ContainsKey(hiderId)
                    ? _hidingPositions[hiderId]
                    : transform.position;
                FoundEffect.transform.position = foundPos;
                FoundEffect.Play();
            }

            PlaySFX(FoundSFX);

            try
            {
                OnPlayerFoundEvent?.Invoke(hiderId);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[HideAndSeek] OnPlayerFoundEvent: {ex}");
            }

            Debug.Log($"[HideAndSeek] Hider {hiderId} found by seeker {seekerId}!");

            // Check if all hiders found
            if (_foundPlayers.Count >= _hiders.Count)
            {
                OnAllPlayersFound();
            }
        }

        /// <summary>
        /// Called when the seeker has found all hiders. Awards bonus and
        /// transitions to round end.
        /// </summary>
        private void OnAllPlayersFound()
        {
            if (_currentSeeker != null)
            {
                AddScore(_currentSeeker, AllFoundBonus);
            }

            PlaySFX(AllFoundSFX);

            if (RoundEndEffect != null)
                RoundEndEffect.Play();

            // Transition to round end
            _currentPhase = HideSeekPhase.RoundEnd;

            try
            {
                OnPhaseChanged?.Invoke(_currentPhase);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[HideAndSeek] OnPhaseChanged event: {ex}");
            }

            Debug.Log("[HideAndSeek] All hiders found!");
        }

        /// <summary>
        /// Called when the seeking timer runs out before all hiders are found.
        /// Awards survival bonuses to remaining hiders.
        /// </summary>
        private void OnTimeUp()
        {
            Debug.Log("[HideAndSeek] Time's up!");

            // Award survival bonus to hiders not found
            foreach (var hiderId in _hiders)
            {
                if (!_foundPlayers.Contains(hiderId))
                {
                    AddScore(hiderId, NotFoundBonus);

                    if (PlayerScores.ContainsKey(hiderId))
                    {
                        if (!PlayerScores[hiderId].Stats.ContainsKey("survived"))
                            PlayerScores[hiderId].Stats["survived"] = 0;
                        PlayerScores[hiderId].Stats["survived"] = 1;
                    }
                }
            }

            _currentPhase = HideSeekPhase.RoundEnd;

            try
            {
                OnPhaseChanged?.Invoke(_currentPhase);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[HideAndSeek] OnPhaseChanged event: {ex}");
            }
        }

        #endregion

        #region Hiding Positions

        /// <summary>
        /// Registers a hiding position for a player. Called by the player
        /// controller when a hider reaches their chosen spot.
        /// </summary>
        /// <param name="playerId">The hider's player ID.</param>
        /// <param name="position">The hiding position in world space.</param>
        public void RegisterHidingPosition(string playerId, Vector3 position)
        {
            if (!_hiders.Contains(playerId))
            {
                Debug.LogWarning($"[HideAndSeek] {playerId} is not a hider!");
                return;
            }

            _hidingPositions[playerId] = position;
            Debug.Log($"[HideAndSeek] {playerId} registered hiding position: {position}");
        }

        /// <summary>
        /// Attempts to find a player as a seeker. Only works during the Seeking phase.
        /// </summary>
        /// <param name="seekerId">The seeker attempting the find.</param>
        /// <param name="targetId">The hider being searched for.</param>
        /// <returns>True if the target was found.</returns>
        public bool TryFindPlayer(string seekerId, string targetId)
        {
            if (_currentPhase != HideSeekPhase.Seeking)
                return false;

            if (seekerId != _currentSeeker)
                return false;

            if (!_hiders.Contains(targetId))
                return false;

            if (_foundPlayers.Contains(targetId))
                return false;

            // Validate proximity
            Vector3 seekerPos = GetPlayerWorldPosition(seekerId);
            Vector3 targetPos = _hidingPositions.ContainsKey(targetId)
                ? _hidingPositions[targetId]
                : GetPlayerWorldPosition(targetId);

            float distance = Vector3.Distance(seekerPos, targetPos);
            if (distance > DetectionRange)
                return false;

            OnPlayerFound(targetId, seekerId);
            return true;
        }

        /// <summary>
        /// Gets a random hiding position within the hiding area bounds.
        /// </summary>
        private Vector3 GetRandomHidingPosition()
        {
            return new Vector3(
                UnityEngine.Random.Range(HidingArea.min.x, HidingArea.max.x),
                Mathf.Max(HidingArea.min.y, 0f),
                UnityEngine.Random.Range(HidingArea.min.z, HidingArea.max.z)
            );
        }

        /// <summary>
        /// Gets a player's world position. Stub — should be linked to player controller.
        /// </summary>
        private Vector3 GetPlayerWorldPosition(string playerId)
        {
            // TODO: Get actual position from player manager/character controller
            return _hidingPositions.ContainsKey(playerId)
                ? _hidingPositions[playerId]
                : Vector3.zero;
        }

        /// <summary>
        /// Gets a player's forward direction. Stub — should be linked to player controller.
        /// </summary>
        private Vector3 GetPlayerForward(string playerId)
        {
            // TODO: Get actual forward from player transform
            return Vector3.forward;
        }

        #endregion

        #region Score Calculation

        /// <summary>
        /// Calculates final scores including hider survival time bonuses.
        /// </summary>
        protected override void CalculateRewards()
        {
            base.CalculateRewards();

            // Award hider survival time points
            foreach (var kvp in _hiderHiddenTime)
            {
                string hiderId = kvp.Key;
                float hiddenTime = kvp.Value;

                if (PlayerScores.ContainsKey(hiderId))
                {
                    int survivalPoints = Mathf.RoundToInt(hiddenTime * PointsPerSecondHidden);
                    PlayerScores[hiderId].Score += survivalPoints;

                    if (!PlayerScores[hiderId].Stats.ContainsKey("hidden_time"))
                        PlayerScores[hiderId].Stats["hidden_time"] = 0;
                    PlayerScores[hiderId].Stats["hidden_time"] = Mathf.RoundToInt(hiddenTime);
                }
            }

            // Sort and assign ranks
            var sortedScores = GetSortedScores();
            for (int i = 0; i < sortedScores.Count; i++)
            {
                sortedScores[i].Rank = i + 1;
            }

            // Calculate rewards
            foreach (var ps in sortedScores)
            {
                switch (ps.Rank)
                {
                    case 1:
                        ps.Rewards.Add(new RewardData { RewardType = "gems", RewardId = "gem_premium", Amount = 15 });
                        ps.Rewards.Add(new RewardData { RewardType = "item", RewardId = "hideseek_winner", Amount = 1, Probability = 0.4f });
                        break;
                    case 2:
                        ps.Rewards.Add(new RewardData { RewardType = "gems", RewardId = "gem_standard", Amount = 8 });
                        break;
                    default:
                        ps.Rewards.Add(new RewardData { RewardType = "coins", RewardId = "coins_participation", Amount = 40 });
                        break;
                }

                // Bonus for finding many hiders (seeker bonus)
                if (ps.Stats.ContainsKey("hiders_found") && ps.Stats["hiders_found"] >= 3)
                {
                    ps.Rewards.Add(new RewardData { RewardType = "xp", RewardId = "xp_seeker", Amount = 75 });
                }

                // Bonus for surviving the whole round
                if (ps.Stats.ContainsKey("survived") && ps.Stats["survived"] == 1)
                {
                    ps.Rewards.Add(new RewardData { RewardType = "xp", RewardId = "xp_survivor", Amount = 50 });
                }
            }
        }

        #endregion

        #region Public API

        /// <summary>
        /// Gets the current phase of the hide-and-seek round.
        /// </summary>
        public HideSeekPhase GetCurrentPhase() => _currentPhase;

        /// <summary>
        /// Gets the current seeker's player ID.
        /// </summary>
        public string GetCurrentSeeker() => _currentSeeker;

        /// <summary>
        /// Gets the list of hider player IDs.
        /// </summary>
        public IReadOnlyList<string> GetHiders() => _hiders.AsReadOnly();

        /// <summary>
        /// Gets the list of found player IDs.
        /// </summary>
        public IReadOnlyList<string> GetFoundPlayers() => _foundPlayers.AsReadOnly();

        /// <summary>
        /// Gets the number of hiders still hidden.
        /// </summary>
        public int GetRemainingHiderCount() => _hiders.Count - _foundPlayers.Count;

        /// <summary>
        /// Checks if a specific player is the current seeker.
        /// </summary>
        public bool IsSeeker(string playerId) => _currentSeeker == playerId;

        /// <summary>
        /// Checks if a specific player is a hider.
        /// </summary>
        public bool IsHider(string playerId) => _hiders.Contains(playerId);

        /// <summary>
        /// Checks if a specific hider has been found.
        /// </summary>
        public bool IsFound(string playerId) => _foundPlayers.Contains(playerId);

        /// <summary>
        /// Gets the total number of hiders found by the seeker.
        /// </summary>
        public int GetFoundCount() => _foundPlayers.Count;

        /// <summary>
        /// Gets the total number of hiders.
        /// </summary>
        public int GetTotalHiderCount() => _hiders.Count;

        #endregion

        #region Cleanup

        /// <summary>
        /// Called when returning to Inactive state. Stops all coroutines and
        /// resets round-specific state.
        /// </summary>
        protected override void OnEnterInactive()
        {
            base.OnEnterInactive();

            if (_roundCoroutine != null)
            {
                StopCoroutine(_roundCoroutine);
                _roundCoroutine = null;
            }

            if (_revealCoroutine != null)
            {
                StopCoroutine(_revealCoroutine);
                _revealCoroutine = null;
            }

            _hiders.Clear();
            _seekers.Clear();
            _foundPlayers.Clear();
            _hidingPositions.Clear();
            _hiderHiddenTime.Clear();
            _currentSeeker = null;
            _currentPhase = HideSeekPhase.SelectingSeeker;

            if (SeekerIndicator != null)
                SeekerIndicator.SetActive(false);

            Debug.Log("[HideAndSeek] Cleaned up and returned to inactive.");
        }

        #endregion
    }
}
