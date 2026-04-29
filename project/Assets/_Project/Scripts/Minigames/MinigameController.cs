using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using TMPro;

// ---------------------------------------------------------------------------
// KawaiiCool Island - Minigame Framework
// ---------------------------------------------------------------------------
// Abstract base class for all minigames in KawaiiCool Island. Uses the
// Template Method pattern with a state machine (Waiting -> Countdown ->
// Playing -> GameOver) and coroutine-based timing for clean, predictable
// game loops.
// ---------------------------------------------------------------------------

namespace KawaiiCool.Minigames
{
    /// <summary>
    /// Represents the current state of a minigame within its lifecycle.
    /// </summary>
    public enum MinigameState
    {
        /// <summary>Minigame is not running and awaiting initialization.</summary>
        Inactive,

        /// <summary>Minigame is active and waiting for enough players to join.</summary>
        Waiting,

        /// <summary>Pre-game countdown before gameplay begins.</summary>
        Countdown,

        /// <summary>Gameplay is actively running.</summary>
        Playing,

        /// <summary>Game has ended and results are being displayed.</summary>
        GameOver
    }

    /// <summary>
    /// Serializable data class representing a player's score, stats, rewards,
    /// and performance tracking within a minigame session.
    /// </summary>
    [Serializable]
    public class PlayerScore
    {
        /// <summary>Unique identifier for the player (network or local ID).</summary>
        public string PlayerId;

        /// <summary>Display name of the player.</summary>
        public string PlayerName;

        /// <summary>Current score for this player in the minigame.</summary>
        public int Score;

        /// <summary>Current consecutive success streak (combo).</summary>
        public int Combo;

        /// <summary>Maximum combo achieved during the session.</summary>
        public int MaxCombo;

        /// <summary>Final rank (1st, 2nd, 3rd, etc.) after sorting.</summary>
        public int Rank;

        /// <summary>Minigame-specific statistics (e.g., notes hit, coins collected).</summary>
        public Dictionary<string, int> Stats = new();

        /// <summary>Rewards earned by this player at the end of the minigame.</summary>
        public List<RewardData> Rewards = new();
    }

    /// <summary>
    /// ScriptableObject that defines the configuration data for a minigame.
    /// Used for designer-friendly setup in the Unity Inspector.
    /// </summary>
    [CreateAssetMenu(fileName = "Minigame_", menuName = "KawaiiCool/Minigame")]
    public class MinigameData : ScriptableObject
    {
        [Header("Identity")]
        [Tooltip("Unique identifier for this minigame type.")]
        public string MinigameId;

        [Tooltip("Human-readable name shown in UI.")]
        public string DisplayName;

        [Tooltip("Description shown in the minigame lobby.")]
        [TextArea] public string Description;

        [Tooltip("Icon sprite for the minigame select screen.")]
        public Sprite Icon;

        [Tooltip("Banner image for the minigame lobby.")]
        public Sprite Banner;

        [Header("Players")]
        [Tooltip("Minimum number of players required to start.")]
        public int MinPlayers = 1;

        [Tooltip("Maximum number of players allowed.")]
        public int MaxPlayers = 4;

        [Header("Timing")]
        [Tooltip("Default gameplay duration in seconds.")]
        public float DefaultDuration = 60f;

        [Header("Rewards")]
        [Tooltip("Base rewards every participant receives.")]
        public List<RewardData> BaseRewards = new();

        [Header("Settings")]
        [Tooltip("If true, players are grouped into teams.")]
        public bool IsTeamBased;

        [Tooltip("Name of the Unity scene to load for this minigame.")]
        public string SceneName;

        [Tooltip("Full type name of the controller class for reflection-based instantiation.")]
        public string ControllerTypeName;
    }

    /// <summary>
    /// Serializable reward entry that can be granted to players at the end
    /// of a minigame. Supports deterministic and probabilistic rewards.
    /// </summary>
    [Serializable]
    public class RewardData
    {
        [Tooltip("Type of reward: 'coins', 'gems', 'xp', 'item', etc.")]
        public string RewardType;

        [Tooltip("Item ID or reward identifier.")]
        public string RewardId;

        [Tooltip("Amount of the reward to grant.")]
        public int Amount;

        [Tooltip("Probability (0-1) that this reward is granted. 1 = always.")]
        [Range(0f, 1f)]
        public float Probability = 1f;
    }

    /// <summary>
    /// Abstract base class for all minigame controllers in KawaiiCool Island.
    /// Implements the Template Method pattern with a coroutine-driven state
    /// machine for clean, maintainable game lifecycle management.
    ///
    /// <para>Concrete implementations override the OnEnter/OnUpdate lifecycle
    /// hooks to provide minigame-specific behavior.</para>
    /// </summary>
    public abstract class MinigameController : MonoBehaviour
    {
        #region Inspector Fields

        [Header("Minigame Data")]
        [Tooltip("ScriptableObject containing this minigame's configuration.")]
        public MinigameData Data;

        [Header("Timing")]
        [Tooltip("Duration of the pre-game countdown in seconds.")]
        public float CountdownDuration = 3f;

        [Tooltip("Duration of active gameplay in seconds.")]
        public float GameDuration = 60f;

        [Tooltip("Duration the results screen is displayed in seconds.")]
        public float ResultsDuration = 10f;

        [Tooltip("Minimum players required to start the minigame.")]
        public float MinPlayers = 1f;

        [Tooltip("Maximum players allowed in the minigame.")]
        public float MaxPlayers = 4f;

        [Header("UI References")]
        [Tooltip("UI GameObject shown during the countdown phase.")]
        public GameObject CountdownUI;

        [Tooltip("UI GameObject shown during active gameplay.")]
        public GameObject GameplayUI;

        [Tooltip("UI GameObject shown at game over / results.")]
        public GameObject ResultsUI;

        [Tooltip("UI GameObject shown while waiting for players.")]
        public GameObject WaitingUI;

        [Tooltip("Text element displaying the remaining timer.")]
        public TMP_Text TimerText;

        [Tooltip("Text element displaying the current score.")]
        public TMP_Text ScoreText;

        [Header("Audio")]
        [Tooltip("AudioManager ID for the background music track.")]
        public string BGMusicId = "minigame_default";

        [Tooltip("AudioManager ID for the countdown tick SFX.")]
        public string CountdownSFX = "countdown";

        [Tooltip("AudioManager ID for the game start SFX.")]
        public string StartSFX = "minigame_start";

        [Tooltip("AudioManager ID for the game end SFX.")]
        public string EndSFX = "minigame_end";

        #endregion

        #region State & Data

        /// <summary>Current state of the minigame state machine.</summary>
        protected MinigameState CurrentState { get; private set; } = MinigameState.Inactive;

        /// <summary>Remaining time within the current state (countdown or gameplay).</summary>
        protected float StateTimer { get; private set; }

        /// <summary>Mapping of player IDs to their score data.</summary>
        protected Dictionary<string, PlayerScore> PlayerScores = new();

        /// <summary>List of player IDs currently registered in the minigame.</summary>
        protected List<string> ParticipatingPlayers = new();

        /// <summary>Reference to the currently running state coroutine.</summary>
        private Coroutine _activeStateCoroutine;

        /// <summary>Flag to prevent multiple initialization calls.</summary>
        private bool _isInitialized;

        /// <summary>Cached MinigameUIManager reference.</summary>
        private MinigameUIManager _uiManager;

        #endregion

        #region Public Properties

        /// <summary>
        /// Returns true if the minigame is in any active state (not Inactive).
        /// </summary>
        public bool IsActive => CurrentState != MinigameState.Inactive;

        /// <summary>
        /// The current state of the minigame state machine.
        /// </summary>
        public MinigameState State => CurrentState;

        /// <summary>
        /// Remaining time in the current state (countdown or gameplay timer).
        /// </summary>
        public float RemainingTime => StateTimer;

        /// <summary>
        /// Number of players currently registered for this minigame.
        /// </summary>
        public int PlayerCount => ParticipatingPlayers.Count;

        /// <summary>
        /// Number of players that have a score entry.
        /// </summary>
        public int ScoredPlayerCount => PlayerScores.Count;

        /// <summary>
        /// Read-only access to the participating player IDs.
        /// </summary>
        public IReadOnlyList<string> GetParticipatingPlayers() => ParticipatingPlayers.AsReadOnly();

        #endregion

        #region Events

        /// <summary>
        /// Invoked whenever the minigame state changes. Argument is the new state.
        /// </summary>
        public event Action<MinigameState> OnStateChanged;

        /// <summary>
        /// Invoked when a player's score changes. Arguments: playerId, newScore.
        /// </summary>
        public event Action<string, int> OnScoreChanged;

        /// <summary>
        /// Invoked when the minigame ends with the final sorted scores list.
        /// </summary>
        public event Action<List<PlayerScore>> OnGameEnded;

        #endregion

        #region Core Lifecycle (Called by Framework)

        /// <summary>
        /// Initializes the minigame with configuration data. Must be called
        /// before any other lifecycle method. Safe to call multiple times —
        /// subsequent calls are ignored.
        /// </summary>
        /// <param name="data">The ScriptableObject configuration for this minigame.</param>
        public void Initialize(MinigameData data)
        {
            if (_isInitialized)
            {
                Debug.LogWarning($"[MinigameController] {Data?.MinigameId ?? "Unknown"} is already initialized. Ignoring duplicate call.");
                return;
            }

            if (data == null)
            {
                Debug.LogError("[MinigameController] Initialize called with null MinigameData!");
                return;
            }

            Data = data;
            GameDuration = data.DefaultDuration;
            MinPlayers = data.MinPlayers;
            MaxPlayers = data.MaxPlayers;

            // Find and cache the UI manager
            _uiManager = FindFirstObjectByType<MinigameUIManager>();
            if (_uiManager == null)
            {
                Debug.LogWarning("[MinigameController] No MinigameUIManager found in scene. UI will not be managed.");
            }

            _isInitialized = true;

            try
            {
                OnInitialized();
            }
            catch (Exception ex)
            {
                Debug.LogError($"[MinigameController] Exception in OnInitialized: {ex}");
            }

            Debug.Log($"[MinigameController] Initialized '{data.DisplayName}' (ID: {data.MinigameId})");
        }

        /// <summary>
        /// Registers a player to participate in the minigame. Players must be
        /// registered before StartMinigame() is called.
        /// </summary>
        /// <param name="playerId">Unique identifier for the player.</param>
        /// <param name="playerName">Human-readable display name.</param>
        public void RegisterPlayer(string playerId, string playerName)
        {
            if (string.IsNullOrEmpty(playerId))
            {
                Debug.LogWarning("[MinigameController] Cannot register player with null or empty ID.");
                return;
            }

            if (ParticipatingPlayers.Contains(playerId))
            {
                Debug.LogWarning($"[MinigameController] Player {playerId} is already registered.");
                return;
            }

            if (ParticipatingPlayers.Count >= MaxPlayers)
            {
                Debug.LogWarning($"[MinigameController] Cannot register player {playerId}: max players ({MaxPlayers}) reached.");
                return;
            }

            ParticipatingPlayers.Add(playerId);

            if (!PlayerScores.ContainsKey(playerId))
            {
                PlayerScores[playerId] = new PlayerScore
                {
                    PlayerId = playerId,
                    PlayerName = playerName ?? playerId,
                    Score = 0,
                    Combo = 0,
                    MaxCombo = 0,
                    Rank = 0
                };
            }

            // Network sync stub
            RpcPlayerJoined(playerId, playerName);

            try
            {
                OnPlayerRegistered(playerId);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[MinigameController] Exception in OnPlayerRegistered: {ex}");
            }

            Debug.Log($"[MinigameController] Player registered: {playerName} ({playerId}). Total: {ParticipatingPlayers.Count}");
        }

        /// <summary>
        /// Unregisters a player from the minigame. If the minigame is already
        /// playing, their scores are preserved.
        /// </summary>
        /// <param name="playerId">Unique identifier for the player to remove.</param>
        public void UnregisterPlayer(string playerId)
        {
            if (string.IsNullOrEmpty(playerId))
            {
                Debug.LogWarning("[MinigameController] Cannot unregister player with null or empty ID.");
                return;
            }

            if (!ParticipatingPlayers.Contains(playerId))
            {
                Debug.LogWarning($"[MinigameController] Player {playerId} is not registered.");
                return;
            }

            ParticipatingPlayers.Remove(playerId);

            // Network sync stub
            RpcPlayerLeft(playerId);

            try
            {
                OnPlayerUnregistered(playerId);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[MinigameController] Exception in OnPlayerUnregistered: {ex}");
            }

            Debug.Log($"[MinigameController] Player unregistered: {playerId}. Remaining: {ParticipatingPlayers.Count}");

            // Auto-abort if all players left during active gameplay
            if (CurrentState == MinigameState.Playing && ParticipatingPlayers.Count == 0)
            {
                Debug.Log("[MinigameController] All players left. Aborting minigame.");
                AbortMinigame();
            }
        }

        /// <summary>
        /// Starts the minigame by transitioning from Inactive/Waiting to Countdown.
        /// Validates that enough players are registered.
        /// </summary>
        public void StartMinigame()
        {
            if (!_isInitialized)
            {
                Debug.LogError("[MinigameController] Cannot start minigame: not initialized!");
                return;
            }

            if (CurrentState != MinigameState.Inactive && CurrentState != MinigameState.Waiting)
            {
                Debug.LogWarning($"[MinigameController] Cannot start from state {CurrentState}.");
                return;
            }

            if (ParticipatingPlayers.Count < MinPlayers)
            {
                Debug.LogWarning($"[MinigameController] Not enough players ({ParticipatingPlayers.Count}/{MinPlayers}). Waiting...");
                ChangeState(MinigameState.Waiting);
                return;
            }

            Debug.Log($"[MinigameController] Starting '{Data.DisplayName}' with {ParticipatingPlayers.Count} players!");
            ChangeState(MinigameState.Countdown);
        }

        /// <summary>
        /// Forces the minigame to end immediately, transitioning to GameOver state.
        /// Use this for early termination (e.g., all objectives completed).
        /// </summary>
        public void EndMinigame()
        {
            if (!IsActive)
            {
                Debug.LogWarning("[MinigameController] Cannot end minigame: not active.");
                return;
            }

            Debug.Log("[MinigameController] Ending minigame early.");
            ChangeState(MinigameState.GameOver);
        }

        /// <summary>
        /// Aborts the minigame immediately, returning to Inactive state.
        /// Scores are discarded and no rewards are granted.
        /// </summary>
        public void AbortMinigame()
        {
            Debug.Log("[MinigameController] Aborting minigame!");

            StopActiveCoroutine();
            PlayerScores.Clear();
            ParticipatingPlayers.Clear();
            ChangeState(MinigameState.Inactive);
        }

        #endregion

        #region State Machine

        /// <summary>
        /// Transitions the minigame to a new state. Stops any active state
        /// coroutine and starts the new state's coroutine.
        /// </summary>
        /// <param name="newState">The target state to transition into.</param>
        protected void ChangeState(MinigameState newState)
        {
            if (CurrentState == newState)
                return;

            MinigameState previousState = CurrentState;
            CurrentState = newState;

            Debug.Log($"[MinigameController] State: {previousState} -> {newState}");

            // Stop any running state coroutine
            StopActiveCoroutine();

            // Start the new state's coroutine
            switch (newState)
            {
                case MinigameState.Waiting:
                    _activeStateCoroutine = StartCoroutine(WaitingCoroutine());
                    break;
                case MinigameState.Countdown:
                    _activeStateCoroutine = StartCoroutine(CountdownCoroutine());
                    break;
                case MinigameState.Playing:
                    _activeStateCoroutine = StartCoroutine(PlayingCoroutine());
                    break;
                case MinigameState.GameOver:
                    _activeStateCoroutine = StartCoroutine(GameOverCoroutine());
                    break;
                case MinigameState.Inactive:
                    try { OnEnterInactive(); } catch (Exception ex) { Debug.LogError($"OnEnterInactive: {ex}"); }
                    break;
            }

            // Notify subscribers
            try
            {
                OnStateChanged?.Invoke(newState);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[MinigameController] Exception in OnStateChanged event: {ex}");
            }
        }

        /// <summary>
        /// Stops the currently running state coroutine, if any.
        /// </summary>
        private void StopActiveCoroutine()
        {
            if (_activeStateCoroutine != null)
            {
                StopCoroutine(_activeStateCoroutine);
                _activeStateCoroutine = null;
            }
        }

        #endregion

        #region State Coroutines

        /// <summary>
        /// Coroutine for the Waiting state. Periodically checks if enough
        /// players have joined to transition to Countdown.
        /// </summary>
        private IEnumerator WaitingCoroutine()
        {
            try { OnEnterWaiting(); } catch (Exception ex) { Debug.LogError($"OnEnterWaiting: {ex}"); }

            SetUIActive(WaitingUI, true);
            SetUIActive(CountdownUI, false);
            SetUIActive(GameplayUI, false);
            SetUIActive(ResultsUI, false);

            // Update waiting UI with player names
            if (_uiManager != null)
            {
                List<string> names = ParticipatingPlayers
                    .Select(id => PlayerScores.ContainsKey(id) ? PlayerScores[id].PlayerName : id)
                    .ToList();
                _uiManager.ShowWaiting(names);
            }

            // Wait until enough players join
            while (ParticipatingPlayers.Count < MinPlayers)
            {
                try { OnUpdateWaiting(); } catch (Exception ex) { Debug.LogError($"OnUpdateWaiting: {ex}"); }
                yield return new WaitForSeconds(0.5f);
            }

            // Enough players — transition to countdown
            ChangeState(MinigameState.Countdown);
        }

        /// <summary>
        /// Coroutine for the Countdown state. Displays a 3-2-1 countdown,
        /// plays SFX, then transitions to Playing state.
        /// </summary>
        private IEnumerator CountdownCoroutine()
        {
            try { OnEnterCountdown(); } catch (Exception ex) { Debug.LogError($"OnEnterCountdown: {ex}"); }

            SetUIActive(WaitingUI, false);
            SetUIActive(CountdownUI, true);
            SetUIActive(GameplayUI, false);
            SetUIActive(ResultsUI, false);

            // Play countdown SFX
            PlaySFX(CountdownSFX);

            float elapsed = 0f;

            while (elapsed < CountdownDuration)
            {
                StateTimer = CountdownDuration - elapsed;

                int displayNumber = Mathf.CeilToInt(StateTimer);
                if (TimerText != null)
                    TimerText.text = displayNumber.ToString();

                if (_uiManager != null)
                    _uiManager.ShowCountdown(displayNumber);

                try { OnUpdateCountdown(); } catch (Exception ex) { Debug.LogError($"OnUpdateCountdown: {ex}"); }

                elapsed += Time.deltaTime;
                yield return null;
            }

            // Countdown complete — start the game!
            StateTimer = 0f;
            PlaySFX(StartSFX);
            ChangeState(MinigameState.Playing);
        }

        /// <summary>
        /// Coroutine for the Playing state. Runs the main gameplay timer and
        /// delegates per-frame updates to the concrete implementation.
        /// </summary>
        private IEnumerator PlayingCoroutine()
        {
            try { OnEnterPlaying(); } catch (Exception ex) { Debug.LogError($"OnEnterPlaying: {ex}"); }

            SetUIActive(WaitingUI, false);
            SetUIActive(CountdownUI, false);
            SetUIActive(GameplayUI, true);
            SetUIActive(ResultsUI, false);

            if (_uiManager != null)
                _uiManager.ShowGameplay();

            // Play background music
            PlayBGM(BGMusicId);

            StateTimer = GameDuration;
            float nextSecond = 1f;

            while (StateTimer > 0f)
            {
                StateTimer -= Time.deltaTime;
                nextSecond -= Time.deltaTime;

                // Update timer display each second
                if (nextSecond <= 0f)
                {
                    nextSecond += 1f;
                    UpdateTimerDisplay();
                }

                // Delegate to implementation
                try { OnUpdatePlaying(); } catch (Exception ex) { Debug.LogError($"OnUpdatePlaying: {ex}"); }

                yield return null;
            }

            StateTimer = 0f;
            UpdateTimerDisplay();

            // Time's up — game over
            ChangeState(MinigameState.GameOver);
        }

        /// <summary>
        /// Coroutine for the GameOver state. Calculates and displays final
        /// scores, awards rewards, then transitions to Inactive.
        /// </summary>
        private IEnumerator GameOverCoroutine()
        {
            try { OnEnterGameOver(); } catch (Exception ex) { Debug.LogError($"OnEnterGameOver: {ex}"); }

            SetUIActive(WaitingUI, false);
            SetUIActive(CountdownUI, false);
            SetUIActive(GameplayUI, false);
            SetUIActive(ResultsUI, true);

            PlaySFX(EndSFX);
            StopBGM();

            // Calculate final rankings
            List<PlayerScore> sortedScores = GetSortedScores();
            for (int i = 0; i < sortedScores.Count; i++)
            {
                sortedScores[i].Rank = i + 1;
            }

            // Calculate rewards based on performance
            try
            {
                CalculateRewards();
            }
            catch (Exception ex)
            {
                Debug.LogError($"[MinigameController] Exception in CalculateRewards: {ex}");
            }

            // Show results UI
            if (_uiManager != null)
            {
                _uiManager.ShowResults(sortedScores);
            }

            // Notify subscribers
            try
            {
                OnGameEnded?.Invoke(sortedScores);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[MinigameController] Exception in OnGameEnded event: {ex}");
            }

            // Award rewards
            AwardRewards();

            // Display results for the configured duration
            float elapsed = 0f;
            while (elapsed < ResultsDuration)
            {
                StateTimer = ResultsDuration - elapsed;

                try { OnUpdateGameOver(); } catch (Exception ex) { Debug.LogError($"OnUpdateGameOver: {ex}"); }

                elapsed += Time.deltaTime;
                yield return null;
            }

            // Return to inactive state
            ChangeState(MinigameState.Inactive);
        }

        #endregion

        #region Scoring API

        /// <summary>
        /// Adds points to a player's current score. Also invokes OnScoreChanged.
        /// </summary>
        /// <param name="playerId">The player's unique identifier.</param>
        /// <param name="points">Points to add (can be negative for penalties).</param>
        protected void AddScore(string playerId, int points)
        {
            if (!PlayerScores.ContainsKey(playerId))
            {
                Debug.LogWarning($"[MinigameController] Cannot add score: player {playerId} not found.");
                return;
            }

            PlayerScores[playerId].Score += points;
            int newScore = PlayerScores[playerId].Score;

            // Update score text if it belongs to local player
            if (ScoreText != null)
                ScoreText.text = $"Score: {newScore}";

            try
            {
                OnScoreChanged?.Invoke(playerId, newScore);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[MinigameController] Exception in OnScoreChanged event: {ex}");
            }

            // Network sync
            RpcScoreUpdated(playerId, newScore);
        }

        /// <summary>
        /// Sets a player's score to an absolute value.
        /// </summary>
        /// <param name="playerId">The player's unique identifier.</param>
        /// <param name="score">The new absolute score.</param>
        protected void SetScore(string playerId, int score)
        {
            if (!PlayerScores.ContainsKey(playerId))
            {
                Debug.LogWarning($"[MinigameController] Cannot set score: player {playerId} not found.");
                return;
            }

            PlayerScores[playerId].Score = score;

            if (ScoreText != null)
                ScoreText.text = $"Score: {score}";

            try
            {
                OnScoreChanged?.Invoke(playerId, score);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[MinigameController] Exception in OnScoreChanged event: {ex}");
            }

            RpcScoreUpdated(playerId, score);
        }

        /// <summary>
        /// Gets the current score for a player.
        /// </summary>
        /// <param name="playerId">The player's unique identifier.</param>
        /// <returns>The player's current score, or 0 if not found.</returns>
        protected int GetScore(string playerId)
        {
            if (PlayerScores.TryGetValue(playerId, out PlayerScore ps))
                return ps.Score;

            return 0;
        }

        /// <summary>
        /// Returns all player scores sorted by score descending (highest first).
        /// This list determines the final rankings.
        /// </summary>
        /// <returns>Sorted list of PlayerScore objects.</returns>
        protected List<PlayerScore> GetSortedScores()
        {
            return PlayerScores.Values
                .OrderByDescending(ps => ps.Score)
                .ThenByDescending(ps => ps.MaxCombo)
                .ToList();
        }

        /// <summary>
        /// Grants calculated rewards to all participating players.
        /// Iterates through each player's Rewards list and processes them.
        /// </summary>
        protected void AwardRewards()
        {
            foreach (var kvp in PlayerScores)
            {
                PlayerScore ps = kvp.Value;

                // Grant base rewards
                if (Data != null && Data.BaseRewards != null)
                {
                    foreach (var reward in Data.BaseRewards)
                    {
                        float roll = UnityEngine.Random.value;
                        if (roll <= reward.Probability)
                        {
                            GrantReward(ps.PlayerId, reward);
                        }
                    }
                }

                // Grant performance-based rewards
                foreach (var reward in ps.Rewards)
                {
                    GrantReward(ps.PlayerId, reward);
                }
            }

            Debug.Log("[MinigameController] All rewards granted.");
        }

        /// <summary>
        /// Grants a single reward to a player. Override this method to hook
        /// into your game's inventory/currency system.
        /// </summary>
        /// <param name="playerId">The player to receive the reward.</param>
        /// <param name="reward">The reward data to grant.</param>
        protected virtual void GrantReward(string playerId, RewardData reward)
        {
            if (reward == null) return;

            Debug.Log($"[MinigameController] Granting {reward.Amount}x {reward.RewardType} (ID: {reward.RewardId}) to player {playerId}");

            // Network sync
            RpcRewardGranted(playerId, reward.RewardType, reward.RewardId, reward.Amount);

            // TODO: Hook into inventory/currency system here
        }

        #endregion

        #region UI Helpers

        /// <summary>
        /// Safely sets a UI GameObject's active state with null checking.
        /// </summary>
        private void SetUIActive(GameObject uiObject, bool active)
        {
            if (uiObject != null)
                uiObject.SetActive(active);
        }

        /// <summary>
        /// Updates the timer text display with the current remaining time.
        /// </summary>
        private void UpdateTimerDisplay()
        {
            if (TimerText != null)
            {
                int seconds = Mathf.Max(0, Mathf.CeilToInt(StateTimer));
                int minutes = seconds / 60;
                seconds %= 60;
                TimerText.text = $"{minutes:00}:{seconds:00}";
            }

            if (_uiManager != null)
                _uiManager.UpdateTimer(StateTimer);
        }

        #endregion

        #region Audio Helpers

        /// <summary>
        /// Plays background music by its AudioManager ID. Stub — hook into your audio system.
        /// </summary>
        protected void PlayBGM(string musicId)
        {
            if (string.IsNullOrEmpty(musicId)) return;
            Debug.Log($"[MinigameController] Playing BGM: {musicId}");
            // TODO: AudioManager.PlayMusic(musicId);
        }

        /// <summary>
        /// Plays a one-shot SFX by its AudioManager ID. Stub — hook into your audio system.
        /// </summary>
        protected void PlaySFX(string sfxId)
        {
            if (string.IsNullOrEmpty(sfxId)) return;
            Debug.Log($"[MinigameController] Playing SFX: {sfxId}");
            // TODO: AudioManager.PlaySFX(sfxId);
        }

        /// <summary>
        /// Stops the currently playing background music. Stub.
        /// </summary>
        protected void StopBGM()
        {
            Debug.Log("[MinigameController] Stopping BGM.");
            // TODO: AudioManager.StopMusic();
        }

        #endregion

        #region Network RPC Stubs

        /// <summary>
        /// Stub for network-synchronized player join. Override for multiplayer.
        /// </summary>
        protected virtual void RpcPlayerJoined(string playerId, string playerName)
        {
            // Override in networked subclass
        }

        /// <summary>
        /// Stub for network-synchronized player leave. Override for multiplayer.
        /// </summary>
        protected virtual void RpcPlayerLeft(string playerId)
        {
            // Override in networked subclass
        }

        /// <summary>
        /// Stub for network-synchronized score update. Override for multiplayer.
        /// </summary>
        protected virtual void RpcScoreUpdated(string playerId, int newScore)
        {
            // Override in networked subclass
        }

        /// <summary>
        /// Stub for network-synchronized reward grant. Override for multiplayer.
        /// </summary>
        protected virtual void RpcRewardGranted(string playerId, string rewardType, string rewardId, int amount)
        {
            // Override in networked subclass
        }

        #endregion

        #region Virtual Lifecycle Hooks (Template Method)

        /// <summary>
        /// Called once after the minigame is initialized. Use for loading
        /// assets, setting up references, and configuring minigame-specific data.
        /// </summary>
        protected virtual void OnInitialized() { }

        /// <summary>
        /// Called when entering the Waiting state. Use for setting up lobby UI.
        /// </summary>
        protected virtual void OnEnterWaiting() { }

        /// <summary>
        /// Called when entering the Countdown state. Use for pre-game preparation.
        /// </summary>
        protected virtual void OnEnterCountdown() { }

        /// <summary>
        /// Called when entering the Playing state. Use for spawning entities,
        /// starting music, and beginning active gameplay.
        /// </summary>
        protected virtual void OnEnterPlaying() { }

        /// <summary>
        /// Called when entering the GameOver state. Use for final score
        /// calculations and cleanup.
        /// </summary>
        protected virtual void OnEnterGameOver() { }

        /// <summary>
        /// Called when returning to the Inactive state. Use for full cleanup.
        /// </summary>
        protected virtual void OnEnterInactive() { }

        /// <summary>
        /// Called every tick while in the Waiting state.
        /// </summary>
        protected virtual void OnUpdateWaiting() { }

        /// <summary>
        /// Called every frame while in the Countdown state.
        /// </summary>
        protected virtual void OnUpdateCountdown() { }

        /// <summary>
        /// Called every frame while in the Playing state. This is the main
        /// gameplay update loop for concrete implementations.
        /// </summary>
        protected virtual void OnUpdatePlaying() { }

        /// <summary>
        /// Called every frame while in the GameOver state.
        /// </summary>
        protected virtual void OnUpdateGameOver() { }

        /// <summary>
        /// Called when a new player is registered. Use for player-specific setup.
        /// </summary>
        /// <param name="playerId">The ID of the registered player.</param>
        protected virtual void OnPlayerRegistered(string playerId) { }

        /// <summary>
        /// Called when a player is unregistered. Use for player-specific cleanup.
        /// </summary>
        /// <param name="playerId">The ID of the unregistered player.</param>
        protected virtual void OnPlayerUnregistered(string playerId) { }

        /// <summary>
        /// Override to implement minigame-specific reward calculation based on
        /// performance metrics (rank, combos, stats, etc.).
        /// </summary>
        protected virtual void CalculateRewards() { }

        #endregion

        #region Public Helpers

        /// <summary>
        /// Gets the PlayerScore data for a specific player.
        /// </summary>
        /// <param name="playerId">The player's unique identifier.</param>
        /// <returns>The PlayerScore, or null if not found.</returns>
        public PlayerScore GetPlayerScore(string playerId)
        {
            if (PlayerScores.TryGetValue(playerId, out PlayerScore ps))
                return ps;
            return null;
        }

        /// <summary>
        /// Checks if a specific player is registered in this minigame.
        /// </summary>
        /// <param name="playerId">The player ID to check.</param>
        /// <returns>True if the player is registered.</returns>
        public bool IsPlayerRegistered(string playerId)
        {
            return ParticipatingPlayers.Contains(playerId);
        }

        /// <summary>
        /// Gets a formatted string summary of the minigame state for debugging.
        /// </summary>
        public string GetDebugInfo()
        {
            var sb = new System.Text.StringBuilder();
            sb.AppendLine($"=== {Data?.DisplayName ?? "Unnamed Minigame"} ===");
            sb.AppendLine($"State: {CurrentState}");
            sb.AppendLine($"Players: {ParticipatingPlayers.Count}/{MaxPlayers}");
            sb.AppendLine($"Timer: {StateTimer:F1}s");
            sb.AppendLine("Scores:");
            foreach (var ps in GetSortedScores())
            {
                sb.AppendLine($"  {ps.PlayerName}: {ps.Score} (Combo: {ps.Combo}/{ps.MaxCombo})");
            }
            return sb.ToString();
        }

        #endregion
    }
}
