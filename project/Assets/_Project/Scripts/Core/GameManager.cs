// ----------------------------------------------------------------------------
// KawaiiCool Island - Core Framework
// ----------------------------------------------------------------------------
// GameManager.cs - Central game state manager
// ----------------------------------------------------------------------------
// Manages the overall game state machine, player progression (XP/Level),
// and play time tracking. Publishes state changes via the EventBus and
// exposes UnityEvents for inspector-level wiring.
// ----------------------------------------------------------------------------

using System;
using UnityEngine;
using UnityEngine.Events;
using KawaiiCoolIsland.Core.Events;

namespace KawaiiCoolIsland.Core
{
    /// <summary>
    /// Defines the primary game states for the state machine.
    /// </summary>
    public enum GameState
    {
        /// <summary>Initial boot/loading sequence before main menu.</summary>
        Boot,

        /// <summary>Main menu, title screen, and options.</summary>
        MainMenu,

        /// <summary>Character creation and onboarding flow.</summary>
        CharacterCreation,

        /// <summary>Player's personal island - building and decorating.</summary>
        Island,

        /// <summary>Social hub area where players gather.</summary>
        Hub,

        /// <summary>Active minigame gameplay.</summary>
        Minigame,

        /// <summary>Loading screen between state transitions.</summary>
        Loading,

        /// <summary>Room browser for discovering and joining player rooms.</summary>
        RoomBrowser,

        /// <summary>Viewing another player's profile.</summary>
        ProfileView,

        /// <summary>Friend list and social graph management.</summary>
        FriendList,

        /// <summary>Avatar customization and outfit editor.</summary>
        AvatarEditor,

        /// <summary>Game settings and preferences.</summary>
        Settings,

        /// <summary>Activity feed showing social updates and events.</summary>
        ActivityFeed
    }

    /// <summary>
    /// Central game state manager that controls the high-level game flow.
    /// Handles state transitions, player progression, and session tracking.
    /// All state changes are published through the EventBus for decoupled systems.
    /// </summary>
    public class GameManager : Singleton<GameManager>
    {
        #region Inspector Events

        /// <summary>
        /// Invoked when the game state changes. Exposed for inspector wiring.
        /// </summary>
        [Header("Events")]
        [Tooltip("Fired when GameState changes. Passes the new state.")]
        public UnityEvent<GameState> OnGameStateChangedUnity;

        /// <summary>
        /// Invoked when the player levels up.
        /// </summary>
        [Tooltip("Fired when the player gains a level.")]
        public UnityEvent<int> OnLevelUpUnity;

        /// <summary>
        /// Invoked when XP is gained.
        /// </summary>
        [Tooltip("Fired when XP is added. Passes the new XP total.")]
        public UnityEvent<int> OnXPGainedUnity;

        #endregion

        #region Private Fields

        /// <summary>
        /// The current game state.
        /// </summary>
        private GameState _currentState = GameState.Boot;

        /// <summary>
        /// The previous game state before the current one.
        /// </summary>
        private GameState _previousState = GameState.Boot;

        /// <summary>
        /// Total play time in seconds (persisted across sessions).
        /// </summary>
        private float _playTime = 0f;

        /// <summary>
        /// Whether the play time timer is currently running.
        /// </summary>
        private bool _playTimeRunning = false;

        /// <summary>
        /// Current player level (1-based).
        /// </summary>
        private int _playerLevel = 1;

        /// <summary>
        /// Current player XP toward the next level.
        /// </summary>
        private int _playerXP = 0;

        /// <summary>
        /// XP required to reach the next level. Scales with level.
        /// </summary>
        private int _xpToNextLevel = 100;

        /// <summary>
        /// Total cumulative XP earned across all time.
        /// </summary>
        private int _totalXP = 0;

        /// <summary>
        /// Whether the game is currently paused.
        /// </summary>
        private bool _isPaused = false;

        /// <summary>
        /// Whether the game has finished initial boot sequence.
        /// </summary>
        private bool _hasBooted = false;

        /// <summary>
        /// The current active minigame ID if in Minigame state.
        /// </summary>
        private string _activeMinigameId = string.Empty;

        #endregion

        #region Properties

        /// <summary>
        /// The current game state.
        /// </summary>
        public GameState CurrentState => _currentState;

        /// <summary>
        /// The previous game state before the current transition.
        /// </summary>
        public GameState PreviousState => _previousState;

        /// <summary>
        /// Total play time in seconds across all sessions.
        /// </summary>
        public float PlayTime => _playTime;

        /// <summary>
        /// Current player level (1-based).
        /// </summary>
        public int PlayerLevel => _playerLevel;

        /// <summary>
        /// Current XP progress toward the next level.
        /// </summary>
        public int PlayerXP => _playerXP;

        /// <summary>
        /// XP required to reach the next level.
        /// </summary>
        public int XPToNextLevel => _xpToNextLevel;

        /// <summary>
        /// Total cumulative XP earned across all time.
        /// </summary>
        public int TotalXP => _totalXP;

        /// <summary>
        /// Whether the game is currently paused.
        /// </summary>
        public bool IsPaused => _isPaused;

        /// <summary>
        /// Whether the boot sequence has completed.
        /// </summary>
        public bool HasBooted => _hasBooted;

        /// <summary>
        /// The active minigame identifier when in Minigame state.
        /// </summary>
        public string ActiveMinigameId => _activeMinigameId;

        /// <summary>
        /// Progress toward next level as a normalized value (0-1).
        /// </summary>
        public float LevelProgress => _xpToNextLevel > 0 ? (float)_playerXP / _xpToNextLevel : 0f;

        #endregion

        #region Events

        /// <summary>
        /// C# event invoked when the game state changes.
        /// Use this for code-level subscriptions. For inspector wiring, use OnGameStateChangedUnity.
        /// </summary>
        public event Action<GameState> OnGameStateChanged;

        /// <summary>
        /// Invoked when the player levels up. Parameter is the new level.
        /// </summary>
        public event Action<int> OnLevelUp;

        /// <summary>
        /// Invoked when XP is added. Parameters are (newXP, delta, newTotalXP).
        /// </summary>
        public event Action<int, int, int> OnXPGained;

        /// <summary>
        /// Invoked when the pause state changes. Parameter is the new paused state.
        /// </summary>
        public event Action<bool> OnPauseStateChanged;

        #endregion

        #region Unity Lifecycle

        /// <summary>
        /// Called when the singleton awakes. Initializes the game state.
        /// </summary>
        protected override void OnSingletonAwake()
        {
            base.OnSingletonAwake();
            _currentState = GameState.Boot;
            CalculateXPRequirement();
            Debug.Log("[GameManager] Initialized in Boot state.");
        }

        /// <summary>
        /// Unity Update - tracks play time.
        /// </summary>
        private void Update()
        {
            if (_playTimeRunning && !_isPaused)
            {
                _playTime += Time.unscaledDeltaTime;
            }
        }

        #endregion

        #region State Management

        /// <summary>
        /// Changes the current game state with full transition logic.
        /// Publishes GameStateChangedEvent via EventBus and invokes C#/Unity events.
        /// </summary>
        /// <param name="newState">The target game state.</param>
        public void ChangeState(GameState newState)
        {
            if (_currentState == newState)
            {
                Debug.LogWarning($"[GameManager] Ignoring redundant state change to '{newState}'.");
                return;
            }

            _previousState = _currentState;
            GameState oldState = _currentState;
            _currentState = newState;

            // Handle state-specific logic
            OnStateExit(oldState);
            OnStateEnter(newState);

            // Publish event via EventBus
            EventBus.Instance?.Publish(new GameStateChangedEvent
            {
                PreviousState = oldState,
                NewState = newState
            });

            // Invoke C# event
            OnGameStateChanged?.Invoke(newState);

            // Invoke UnityEvent
            OnGameStateChangedUnity?.Invoke(newState);

            Debug.Log($"[GameManager] State changed: {oldState} -> {newState}");
        }

        /// <summary>
        /// Called when entering a new game state.
        /// </summary>
        /// <param name="state">The state being entered.</param>
        private void OnStateEnter(GameState state)
        {
            switch (state)
            {
                case GameState.Boot:
                    _playTimeRunning = false;
                    break;

                case GameState.MainMenu:
                    _playTimeRunning = true;
                    if (!_hasBooted)
                    {
                        _hasBooted = true;
                    }
                    break;

                case GameState.CharacterCreation:
                    _playTimeRunning = false;
                    break;

                case GameState.Island:
                    _playTimeRunning = true;
                    break;

                case GameState.Hub:
                    _playTimeRunning = true;
                    break;

                case GameState.Minigame:
                    _playTimeRunning = true;
                    break;

                case GameState.Loading:
                    // Loading state doesn't affect play time tracking
                    break;

                case GameState.RoomBrowser:
                    _playTimeRunning = true;
                    break;

                case GameState.ProfileView:
                    _playTimeRunning = true;
                    break;

                case GameState.FriendList:
                    _playTimeRunning = true;
                    break;

                case GameState.AvatarEditor:
                    _playTimeRunning = false;
                    break;

                case GameState.Settings:
                    _playTimeRunning = true;
                    break;

                case GameState.ActivityFeed:
                    _playTimeRunning = true;
                    break;
            }
        }

        /// <summary>
        /// Called when exiting a game state.
        /// </summary>
        /// <param name="state">The state being exited.</param>
        private void OnStateExit(GameState state)
        {
            switch (state)
            {
                case GameState.Minigame:
                    _activeMinigameId = string.Empty;
                    break;

                case GameState.AvatarEditor:
                    // Avatar editor cleanup can be triggered here
                    break;
            }
        }

        /// <summary>
        /// Transitions to the Minigame state with the specified minigame ID.
        /// </summary>
        /// <param name="minigameId">The unique identifier of the minigame to load.</param>
        public void EnterMinigame(string minigameId)
        {
            if (string.IsNullOrEmpty(minigameId))
            {
                Debug.LogError("[GameManager] Cannot enter minigame with null or empty ID.");
                return;
            }

            _activeMinigameId = minigameId;
            ChangeState(GameState.Minigame);
        }

        /// <summary>
        /// Returns to the previous state from the current state.
        /// Useful for exiting minigames, menus, etc.
        /// </summary>
        public void ReturnToPreviousState()
        {
            if (_previousState == GameState.Boot || _previousState == _currentState)
            {
                Debug.LogWarning("[GameManager] No valid previous state to return to. Going to MainMenu.");
                ChangeState(GameState.MainMenu);
                return;
            }

            ChangeState(_previousState);
        }

        /// <summary>
        /// Transitions to the RoomBrowser state for discovering and joining rooms.
        /// </summary>
        public void EnterRoomBrowser()
        {
            ChangeState(GameState.RoomBrowser);
        }

        /// <summary>
        /// Transitions to the ProfileView state for viewing a specific player's profile.
        /// </summary>
        /// <param name="playerId">The unique identifier of the player to view.</param>
        public void EnterProfileView(string playerId)
        {
            if (string.IsNullOrEmpty(playerId))
            {
                Debug.LogError("[GameManager] Cannot enter profile view with null or empty player ID.");
                return;
            }

            ChangeState(GameState.ProfileView);
        }

        /// <summary>
        /// Transitions to the FriendList state for managing friends and requests.
        /// </summary>
        public void EnterFriendList()
        {
            ChangeState(GameState.FriendList);
        }

        /// <summary>
        /// Transitions to the AvatarEditor state for customizing the player's appearance.
        /// </summary>
        public void EnterAvatarEditor()
        {
            ChangeState(GameState.AvatarEditor);
        }

        /// <summary>
        /// Transitions to the Settings state for managing preferences.
        /// </summary>
        public void EnterSettings()
        {
            ChangeState(GameState.Settings);
        }

        /// <summary>
        /// Transitions to the ActivityFeed state for viewing social updates.
        /// </summary>
        public void EnterActivityFeed()
        {
            ChangeState(GameState.ActivityFeed);
        }

        /// <summary>
        /// Transitions to the CharacterCreation state for onboarding new players.
        /// </summary>
        public void StartCharacterCreation()
        {
            ChangeState(GameState.CharacterCreation);
        }

        #endregion

        #region Pause

        /// <summary>
        /// Toggles the pause state of the game.
        /// </summary>
        public void TogglePause()
        {
            SetPaused(!_isPaused);
        }

        /// <summary>
        /// Sets the pause state explicitly.
        /// </summary>
        /// <param name="paused">True to pause, false to resume.</param>
        public void SetPaused(bool paused)
        {
            if (_isPaused == paused) return;

            _isPaused = paused;
            Time.timeScale = paused ? 0f : 1f;

            OnPauseStateChanged?.Invoke(paused);

            Debug.Log($"[GameManager] Game {(paused ? "paused" : "resumed")}.");
        }

        #endregion

        #region Progression

        /// <summary>
        /// Adds XP to the player. Handles level-ups automatically.
        /// Publishes LevelUpEvent via EventBus when appropriate.
        /// </summary>
        /// <param name="amount">The amount of XP to add. Must be positive.</param>
        public void AddXP(int amount)
        {
            if (amount <= 0)
            {
                Debug.LogWarning($"[GameManager] Cannot add non-positive XP amount: {amount}");
                return;
            }

            int previousLevel = _playerLevel;
            _playerXP += amount;
            _totalXP += amount;

            // Check for level ups (can chain multiple)
            bool leveledUp = false;
            while (_playerXP >= _xpToNextLevel)
            {
                _playerXP -= _xpToNextLevel;
                _playerLevel++;
                leveledUp = true;
                CalculateXPRequirement();
            }

            // Invoke XP gained event
            OnXPGained?.Invoke(_playerXP, amount, _totalXP);
            OnXPGainedUnity?.Invoke(_totalXP);

            // Handle level up
            if (leveledUp)
            {
                HandleLevelUp(previousLevel);
            }
        }

        /// <summary>
        /// Sets the player's level directly. Used for initialization or admin.
        /// </summary>
        /// <param name="level">The target level (1-based).</param>
        public void SetLevel(int level)
        {
            if (level < 1)
            {
                Debug.LogError($"[GameManager] Invalid level: {level}. Must be >= 1.");
                return;
            }

            int previousLevel = _playerLevel;
            _playerLevel = level;
            _playerXP = 0;
            CalculateXPRequirement();

            if (level > previousLevel)
            {
                HandleLevelUp(previousLevel);
            }

            Debug.Log($"[GameManager] Player level set to {level}.");
        }

        /// <summary>
        /// Calculates the XP required for the next level based on current level.
        /// Uses an exponential curve: base * (level ^ exponent).
        /// </summary>
        private void CalculateXPRequirement()
        {
            // XP curve: 100 * (level ^ 1.5)
            _xpToNextLevel = Mathf.RoundToInt(100f * Mathf.Pow(_playerLevel, 1.5f));
        }

        /// <summary>
        /// Handles level-up side effects: events, unlocks, etc.
        /// </summary>
        /// <param name="previousLevel">The level before the increase.</param>
        private void HandleLevelUp(int previousLevel)
        {
            Debug.Log($"[GameManager] LEVEL UP! {previousLevel} -> {_playerLevel}");

            // Determine unlocks for this level
            string[] unlocks = GetUnlocksForLevel(_playerLevel);

            // Publish level up event via EventBus
            EventBus.Instance?.Publish(new LevelUpEvent
            {
                NewLevel = _playerLevel,
                PreviousLevel = previousLevel,
                Unlocks = unlocks
            });

            // Invoke C# and Unity events
            OnLevelUp?.Invoke(_playerLevel);
            OnLevelUpUnity?.Invoke(_playerLevel);
        }

        /// <summary>
        /// Gets the list of feature/item unlocks for a given level.
        /// Override or extend this method to define level-up rewards.
        /// </summary>
        /// <param name="level">The player level.</param>
        /// <returns>Array of unlock identifiers.</returns>
        private string[] GetUnlocksForLevel(int level)
        {
            // Simple gating example - in production this would come from a data table
            var unlocks = new System.Collections.Generic.List<string>();

            if (level == 2) unlocks.Add("Feature_FriendRequests");
            if (level == 3) unlocks.Add("Feature_IslandDecorating");
            if (level == 5) unlocks.Add("Feature_Minigames");
            if (level == 5) unlocks.Add("Minigame_Fishing");
            if (level == 7) unlocks.Add("Feature_Trading");
            if (level == 10) unlocks.Add("Feature_Clans");
            if (level % 5 == 0) unlocks.Add($"Reward_LevelPack_{level}");

            return unlocks.ToArray();
        }

        #endregion

        #region Session Data

        /// <summary>
        /// Resets the current session's play time. Does not affect saved data.
        /// </summary>
        public void ResetSessionPlayTime()
        {
            _playTime = 0f;
        }

        /// <summary>
        /// Gets a formatted play time string (HH:MM:SS).
        /// </summary>
        /// <returns>Formatted play time string.</returns>
        public string GetFormattedPlayTime()
        {
            TimeSpan ts = TimeSpan.FromSeconds(_playTime);
            if (ts.TotalHours >= 1)
            {
                return $"{ts.Hours:D2}:{ts.Minutes:D2}:{ts.Seconds:D2}";
            }
            return $"{ts.Minutes:D2}:{ts.Seconds:D2}";
        }

        #endregion

        #region Persistence

        /// <summary>
        /// Serializable data container for GameManager state.
        /// </summary>
        [Serializable]
        private class GameManagerData
        {
            public int PlayerLevel;
            public int PlayerXP;
            public int TotalXP;
            public float PlayTime;
            public string LastSaveTimestamp;
        }

        /// <summary>
        /// Saves the GameManager state via the SaveManager.
        /// </summary>
        public void SaveState()
        {
            var data = new GameManagerData
            {
                PlayerLevel = _playerLevel,
                PlayerXP = _playerXP,
                TotalXP = _totalXP,
                PlayTime = _playTime,
                LastSaveTimestamp = DateTime.UtcNow.ToString("O")
            };

            SaveManager.Instance?.Save("GameManager", data);
        }

        /// <summary>
        /// Loads the GameManager state from the SaveManager.
        /// </summary>
        public void LoadState()
        {
            var data = SaveManager.Instance?.Load<GameManagerData>("GameManager");
            if (data != null)
            {
                _playerLevel = Mathf.Max(1, data.PlayerLevel);
                _playerXP = Mathf.Max(0, data.PlayerXP);
                _totalXP = Mathf.Max(0, data.TotalXP);
                _playTime = Mathf.Max(0f, data.PlayTime);
                CalculateXPRequirement();

                Debug.Log($"[GameManager] Loaded state - Level {_playerLevel}, XP {_playerXP}/{_xpToNextLevel}.");
            }
        }

        #endregion

        #region Editor

#if UNITY_EDITOR

        /// <summary>
        /// Editor helper to add test XP.
        /// </summary>
        [ContextMenu("Add Test XP (50)")]
        private void EditorAddTestXP()
        {
            AddXP(50);
        }

        /// <summary>
        /// Editor helper to force a level up.
        /// </summary>
        [ContextMenu("Force Level Up")]
        private void EditorForceLevelUp()
        {
            AddXP(_xpToNextLevel - _playerXP + 1);
        }

        /// <summary>
        /// Editor helper to reset progression.
        /// </summary>
        [ContextMenu("Reset Progression")]
        private void EditorResetProgression()
        {
            _playerLevel = 1;
            _playerXP = 0;
            _totalXP = 0;
            CalculateXPRequirement();
            Debug.Log("[GameManager] Progression reset to Level 1.");
        }

#endif

        #endregion
    }
}
