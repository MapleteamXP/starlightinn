using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

// ---------------------------------------------------------------------------
// KawaiiCool Island - Minigame UI Manager
// ---------------------------------------------------------------------------
// Shared UI management system for all minigames. Handles screen transitions,
// countdown animation, results display, timer/score updates, and combo/fever
// visual feedback. Works in conjunction with MinigameController subclasses.
// ---------------------------------------------------------------------------

namespace KawaiiCool.Minigames
{
    /// <summary>
    /// Central UI manager for minigame screens and HUD elements. Provides
    /// methods for showing/hiding different minigame screens with smooth
    /// transitions and animated feedback.
    ///
    /// <para>Attach this component to a single GameObject in the scene and
    /// reference it from your MinigameController implementations.</para>
    /// </summary>
    public class MinigameUIManager : MonoBehaviour
    {
        #region Inspector Fields

        [Header("Screens")]
        [Tooltip("Screen shown while waiting for players to join.")]
        public GameObject WaitingScreen;

        [Tooltip("Screen shown during the pre-game countdown.")]
        public GameObject CountdownScreen;

        [Tooltip("HUD shown during active gameplay.")]
        public GameObject GameplayHUD;

        [Tooltip("Screen shown at the end with final results.")]
        public GameObject ResultsScreen;

        [Tooltip("Screen shown when the game is paused.")]
        public GameObject PauseScreen;

        [Header("Countdown")]
        [Tooltip("Large text element for the countdown numbers.")]
        public TMP_Text CountdownText;

        [Tooltip("Animation curve controlling the scale pulse during countdown.")]
        public AnimationCurve CountdownScaleCurve = AnimationCurve.EaseInOut(0f, 1.5f, 1f, 1f);

        [Tooltip("Duration of each countdown number pulse in seconds.")]
        public float CountdownPulseDuration = 0.8f;

        [Header("Results")]
        [Tooltip("Parent transform for result row entries.")]
        public Transform ResultsContainer;

        [Tooltip("Prefab for a single result row (should have rank, name, score texts).")]
        public GameObject ResultRowPrefab;

        [Tooltip("Text displaying the winner's name.")]
        public TMP_Text WinnerText;

        [Tooltip("Panel showing earned rewards.")]
        public GameObject RewardPanel;

        [Tooltip("Container for reward display entries.")]
        public Transform RewardContainer;

        [Tooltip("Prefab for a reward display entry.")]
        public GameObject RewardEntryPrefab;

        [Tooltip("Delay between each result row appearing (seconds).")]
        public float ResultsRevealDelay = 0.3f;

        [Header("Gameplay HUD")]
        [Tooltip("Text displaying the remaining time.")]
        public TMP_Text TimerText;

        [Tooltip("Text displaying the current score.")]
        public TMP_Text ScoreText;

        [Tooltip("Text displaying the current combo.")]
        public TMP_Text ComboText;

        [Tooltip("Panel shown during fever mode.")]
        public GameObject FeverPanel;

        [Tooltip("Animator for fever mode visual effects.")]
        public Animator FeverAnimator;

        [Tooltip("Text displaying fever level.")]
        public TMP_Text FeverLevelText;

        [Tooltip("Panel for showing hit results (Perfect, Great, etc.).")]
        public GameObject HitResultPanel;

        [Tooltip("Text displaying the last hit result.")]
        public TMP_Text HitResultText;

        [Header("Waiting Screen")]
        [Tooltip("Text showing current player count.")]
        public TMP_Text PlayerCountText;

        [Tooltip("Container for player name entries.")]
        public Transform PlayerListContainer;

        [Tooltip("Prefab for a player name entry.")]
        public GameObject PlayerNameEntryPrefab;

        [Tooltip("Text showing minimum players required.")]
        public TMP_Text MinPlayersText;

        [Header("Pause Menu")]
        [Tooltip("Button to resume the game.")]
        public Button ResumeButton;

        [Tooltip("Button to quit the minigame.")]
        public Button QuitButton;

        [Tooltip("Button to open settings.")]
        public Button SettingsButton;

        [Header("Transitions")]
        [Tooltip("Animator for screen transition effects.")]
        public Animator TransitionAnimator;

        [Tooltip("Duration of screen fade transitions in seconds.")]
        public float TransitionDuration = 0.3f;

        [Tooltip("CanvasGroup for fading the entire UI.")]
        public CanvasGroup CanvasFadeGroup;

        [Header("Notification")]
        [Tooltip("Text for temporary notifications/popups.")]
        public TMP_Text NotificationText;

        [Tooltip("Animator for notification popups.")]
        public Animator NotificationAnimator;

        #endregion

        #region Runtime State

        /// <summary>Currently visible screen.</summary>
        private GameObject _currentScreen;

        /// <summary>Coroutine for the countdown animation.</summary>
        private Coroutine _countdownCoroutine;

        /// <summary>Coroutine for the results reveal animation.</summary>
        private Coroutine _resultsCoroutine;

        /// <summary>Cached RectTransform for the countdown text.</summary>
        private RectTransform _countdownRectTransform;

        /// <summary>Whether the UI manager is fully initialized.</summary>
        private bool _isInitialized;

        #endregion

        #region Events

        /// <summary>Invoked when the player requests to pause the game.</summary>
        public event Action OnPauseRequested;

        /// <summary>Invoked when the player requests to resume the game.</summary>
        public event Action OnResumeRequested;

        /// <summary>Invoked when the player requests to quit the minigame.</summary>
        public event Action OnQuitRequested;

        #endregion

        #region Initialization

        /// <summary>
        /// Unity Start callback. Initializes the UI manager and hides all screens.
        /// </summary>
        private void Start()
        {
            Initialize();
        }

        /// <summary>
        /// Initializes the UI manager by hiding all screens and setting up button listeners.
        /// </summary>
        public void Initialize()
        {
            if (_isInitialized) return;

            // Hide all screens initially
            SetScreenActive(WaitingScreen, false);
            SetScreenActive(CountdownScreen, false);
            SetScreenActive(GameplayHUD, false);
            SetScreenActive(ResultsScreen, false);
            SetScreenActive(PauseScreen, false);
            SetScreenActive(FeverPanel, false);
            SetScreenActive(HitResultPanel, false);

            // Cache transforms
            if (CountdownText != null)
                _countdownRectTransform = CountdownText.GetComponent<RectTransform>();

            // Setup button listeners
            if (ResumeButton != null)
                ResumeButton.onClick.AddListener(OnResumeButtonClicked);

            if (QuitButton != null)
                QuitButton.onClick.AddListener(OnQuitButtonClicked);

            if (SettingsButton != null)
                SettingsButton.onClick.AddListener(OnSettingsButtonClicked);

            // Ensure fade group starts fully opaque
            if (CanvasFadeGroup != null)
                CanvasFadeGroup.alpha = 1f;

            _isInitialized = true;
            Debug.Log("[MinigameUIManager] Initialized.");
        }

        #endregion

        #region Screen Management

        /// <summary>
        /// Shows the waiting screen with a list of joined player names.
        /// </summary>
        /// <param name="playerNames">List of player display names.</param>
        public void ShowWaiting(List<string> playerNames)
        {
            SwitchScreen(WaitingScreen);

            // Update player count
            if (PlayerCountText != null)
                PlayerCountText.text = $"Players: {playerNames?.Count ?? 0}";

            // Populate player list
            if (PlayerListContainer != null && PlayerNameEntryPrefab != null)
            {
                // Clear existing entries
                foreach (Transform child in PlayerListContainer)
                    Destroy(child.gameObject);

                // Create entries
                if (playerNames != null)
                {
                    foreach (var name in playerNames)
                    {
                        GameObject entry = Instantiate(PlayerNameEntryPrefab, PlayerListContainer);
                        TMP_Text nameText = entry.GetComponentInChildren<TMP_Text>();
                        if (nameText != null)
                            nameText.text = name ?? "Unknown";
                    }
                }
            }

            Debug.Log("[MinigameUIManager] Showing waiting screen.");
        }

        /// <summary>
        /// Shows the countdown screen with an animated number.
        /// </summary>
        /// <param name="number">The countdown number to display (3, 2, 1, etc.).</param>
        public void ShowCountdown(int number)
        {
            SwitchScreen(CountdownScreen);

            if (CountdownText != null)
            {
                CountdownText.text = number > 0 ? number.ToString() : "GO!";
            }

            // Start pulse animation
            if (_countdownCoroutine != null)
                StopCoroutine(_countdownCoroutine);

            _countdownCoroutine = StartCoroutine(CountdownPulseCoroutine());
        }

        /// <summary>
        /// Shows the gameplay HUD.
        /// </summary>
        public void ShowGameplay()
        {
            SwitchScreen(GameplayHUD);
            Debug.Log("[MinigameUIManager] Showing gameplay HUD.");
        }

        /// <summary>
        /// Shows the results screen with the final sorted scores.
        /// </summary>
        /// <param name="scores">List of player scores sorted by rank.</param>
        public void ShowResults(List<PlayerScore> scores)
        {
            SwitchScreen(ResultsScreen);

            if (_resultsCoroutine != null)
                StopCoroutine(_resultsCoroutine);

            _resultsCoroutine = StartCoroutine(ResultsRevealCoroutine(scores));

            Debug.Log("[MinigameUIManager] Showing results screen.");
        }

        /// <summary>
        /// Shows the pause screen.
        /// </summary>
        public void ShowPause()
        {
            SetScreenActive(PauseScreen, true);

            // Dim the background
            if (CanvasFadeGroup != null)
                CanvasFadeGroup.alpha = 0.7f;

            Debug.Log("[MinigameUIManager] Showing pause screen.");
        }

        /// <summary>
        /// Hides the pause screen.
        /// </summary>
        public void HidePause()
        {
            SetScreenActive(PauseScreen, false);

            // Restore full opacity
            if (CanvasFadeGroup != null)
                CanvasFadeGroup.alpha = 1f;

            Debug.Log("[MinigameUIManager] Hiding pause screen.");
        }

        /// <summary>
        /// Hides all minigame screens. Useful for cleanup.
        /// </summary>
        public void HideAllScreens()
        {
            SetScreenActive(WaitingScreen, false);
            SetScreenActive(CountdownScreen, false);
            SetScreenActive(GameplayHUD, false);
            SetScreenActive(ResultsScreen, false);
            SetScreenActive(PauseScreen, false);
            _currentScreen = null;
        }

        #endregion

        #region HUD Updates

        /// <summary>
        /// Updates the timer display with the remaining time.
        /// </summary>
        /// <param name="remainingTime">Seconds remaining.</param>
        public void UpdateTimer(float remainingTime)
        {
            if (TimerText == null) return;

            int seconds = Mathf.Max(0, Mathf.CeilToInt(remainingTime));
            int minutes = seconds / 60;
            seconds %= 60;

            TimerText.text = $"{minutes:00}:{seconds:00}";

            // Pulse red when time is running low
            if (remainingTime <= 10f)
            {
                TimerText.color = Color.Lerp(Color.white, Color.red, 1f - (remainingTime / 10f));
            }
            else
            {
                TimerText.color = Color.white;
            }
        }

        /// <summary>
        /// Updates the score display.
        /// </summary>
        /// <param name="score">Current score value.</param>
        public void UpdateScore(int score)
        {
            if (ScoreText != null)
                ScoreText.text = $"Score: {score:N0}";
        }

        /// <summary>
        /// Updates the combo display.
        /// </summary>
        /// <param name="combo">Current combo count.</param>
        public void UpdateCombo(int combo)
        {
            if (ComboText != null)
            {
                ComboText.text = $"Combo: {combo}x";
                ComboText.color = combo > 10 ? Color.yellow : Color.white;
            }
        }

        /// <summary>
        /// Shows or hides the fever mode panel and triggers animations.
        /// </summary>
        /// <param name="active">True to show fever mode, false to hide.</param>
        public void ShowFeverMode(bool active)
        {
            SetScreenActive(FeverPanel, active);

            if (FeverAnimator != null)
            {
                FeverAnimator.SetBool("IsFever", active);
            }

            if (FeverLevelText != null && active)
            {
                FeverLevelText.text = "FEVER!";
            }
        }

        /// <summary>
        /// Updates the fever level display.
        /// </summary>
        /// <param name="level">Current fever level (0 = off).</param>
        public void UpdateFeverLevel(int level)
        {
            if (FeverLevelText != null)
            {
                if (level > 0)
                {
                    FeverLevelText.text = $"FEVER x{level}";
                    ShowFeverMode(true);
                }
                else
                {
                    ShowFeverMode(false);
                }
            }

            if (FeverAnimator != null)
                FeverAnimator.SetInteger("FeverLevel", level);
        }

        /// <summary>
        /// Shows a hit result (Perfect, Great, Good, Miss) with appropriate styling.
        /// </summary>
        /// <param name="result">The hit result to display.</param>
        public void ShowHitResult(string result)
        {
            if (HitResultText != null)
            {
                HitResultText.text = result;
                HitResultText.color = result?.ToLower() switch
                {
                    "perfect" => Color.yellow,
                    "great" => Color.green,
                    "good" => Color.cyan,
                    "miss" => Color.red,
                    _ => Color.white
                };
            }

            SetScreenActive(HitResultPanel, true);

            // Auto-hide after a delay
            StartCoroutine(HideHitResultAfterDelay(1f));
        }

        /// <summary>
        /// Shows a notification popup with the given message.
        /// </summary>
        /// <param name="message">The notification message.</param>
        public void ShowNotification(string message)
        {
            if (NotificationText != null)
            {
                NotificationText.text = message;
            }

            if (NotificationAnimator != null)
            {
                NotificationAnimator.SetTrigger("Show");
            }

            Debug.Log($"[MinigameUIManager] Notification: {message}");
        }

        #endregion

        #region Results Display

        /// <summary>
        /// Coroutine that reveals result rows one by one with a delay between each.
        /// </summary>
        /// <param name="scores">Sorted list of player scores.</param>
        private IEnumerator ResultsRevealCoroutine(List<PlayerScore> scores)
        {
            if (scores == null || scores.Count == 0) yield break;

            // Clear previous results
            if (ResultsContainer != null)
            {
                foreach (Transform child in ResultsContainer)
                    Destroy(child.gameObject);
            }

            // Show winner
            PlayerScore winner = scores[0];
            if (WinnerText != null)
            {
                WinnerText.text = winner.Rank == 1
                    ? $"Winner: {winner.PlayerName}!"
                    : $"1st Place: {winner.PlayerName}";
            }

            // Create result rows with staggered reveal
            for (int i = 0; i < scores.Count; i++)
            {
                PlayerScore ps = scores[i];
                CreateResultRow(ps, i + 1);
                yield return new WaitForSeconds(ResultsRevealDelay);
            }

            // Show rewards after results
            yield return new WaitForSeconds(ResultsRevealDelay * 2f);
            ShowRewards(scores);
        }

        /// <summary>
        /// Creates a single result row in the results container.
        /// </summary>
        /// <param name="ps">The player score data.</param>
        /// <param name="displayRank">The display rank number.</param>
        private void CreateResultRow(PlayerScore ps, int displayRank)
        {
            if (ResultsContainer == null || ResultRowPrefab == null) return;

            GameObject row = Instantiate(ResultRowPrefab, ResultsContainer);

            // Find and update text components (by convention or tag)
            TMP_Text[] texts = row.GetComponentsInChildren<TMP_Text>();
            foreach (var text in texts)
            {
                switch (text.gameObject.name.ToLower())
                {
                    case "rank":
                    case "ranktext":
                        text.text = $"#{ps.Rank}";
                        text.color = GetRankColor(ps.Rank);
                        break;
                    case "name":
                    case "nametext":
                        text.text = ps.PlayerName ?? "Unknown";
                        break;
                    case "score":
                    case "scoretext":
                        text.text = $"{ps.Score:N0}";
                        break;
                    case "combo":
                    case "combotext":
                        text.text = $"Max Combo: {ps.MaxCombo}";
                        break;
                }
            }

            // Animate row entry
            Animator rowAnimator = row.GetComponent<Animator>();
            if (rowAnimator != null)
                rowAnimator.SetTrigger("Show");
        }

        /// <summary>
        /// Shows the rewards panel with earned rewards for all players.
        /// </summary>
        /// <param name="scores">List of player scores with rewards.</param>
        private void ShowRewards(List<PlayerScore> scores)
        {
            if (RewardPanel == null) return;

            // Clear previous reward entries
            if (RewardContainer != null)
            {
                foreach (Transform child in RewardContainer)
                    Destroy(child.gameObject);
            }

            // Collect all unique rewards
            HashSet<string> displayedRewards = new HashSet<string>();
            foreach (var ps in scores)
            {
                foreach (var reward in ps.Rewards)
                {
                    string key = $"{reward.RewardType}_{reward.RewardId}";
                    if (!displayedRewards.Contains(key))
                    {
                        displayedRewards.Add(key);
                        CreateRewardEntry(reward);
                    }
                }
            }

            SetScreenActive(RewardPanel, true);
        }

        /// <summary>
        /// Creates a reward entry in the rewards container.
        /// </summary>
        /// <param name="reward">The reward data to display.</param>
        private void CreateRewardEntry(RewardData reward)
        {
            if (RewardContainer == null || RewardEntryPrefab == null) return;

            GameObject entry = Instantiate(RewardEntryPrefab, RewardContainer);

            TMP_Text[] texts = entry.GetComponentsInChildren<TMP_Text>();
            foreach (var text in texts)
            {
                switch (text.gameObject.name.ToLower())
                {
                    case "type":
                        text.text = reward.RewardType;
                        break;
                    case "amount":
                        text.text = $"x{reward.Amount}";
                        break;
                    case "name":
                        text.text = reward.RewardId;
                        break;
                }
            }
        }

        /// <summary>
        /// Returns a color associated with each rank for visual distinction.
        /// </summary>
        private Color GetRankColor(int rank)
        {
            return rank switch
            {
                1 => new Color(1f, 0.84f, 0f),   // Gold
                2 => new Color(0.75f, 0.75f, 0.75f), // Silver
                3 => new Color(0.8f, 0.5f, 0.2f),   // Bronze
                _ => Color.white
            };
        }

        #endregion

        #region Animations

        /// <summary>
        /// Coroutine for the countdown number pulse animation.
        /// Scales the countdown text up and down based on the animation curve.
        /// </summary>
        private IEnumerator CountdownPulseCoroutine()
        {
            if (_countdownRectTransform == null) yield break;

            float elapsed = 0f;

            while (elapsed < CountdownPulseDuration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / CountdownPulseDuration;
                float scale = CountdownScaleCurve.Evaluate(t);
                _countdownRectTransform.localScale = Vector3.one * scale;
                yield return null;
            }

            _countdownRectTransform.localScale = Vector3.one;
        }

        /// <summary>
        /// Coroutine to hide the hit result panel after a delay.
        /// </summary>
        private IEnumerator HideHitResultAfterDelay(float delay)
        {
            yield return new WaitForSeconds(delay);
            SetScreenActive(HitResultPanel, false);
        }

        /// <summary>
        /// Triggers a screen transition animation.
        /// </summary>
        private IEnumerator ScreenTransitionCoroutine(GameObject targetScreen)
        {
            // Fade out
            if (TransitionAnimator != null)
                TransitionAnimator.SetTrigger("FadeOut");

            yield return new WaitForSeconds(TransitionDuration * 0.5f);

            // Switch screens
            HideAllScreens();
            if (targetScreen != null)
                targetScreen.SetActive(true);
            _currentScreen = targetScreen;

            // Fade in
            if (TransitionAnimator != null)
                TransitionAnimator.SetTrigger("FadeIn");

            yield return new WaitForSeconds(TransitionDuration * 0.5f);
        }

        #endregion

        #region Button Handlers

        /// <summary>
        /// Handles the resume button click.
        /// </summary>
        private void OnResumeButtonClicked()
        {
            HidePause();
            try
            {
                OnResumeRequested?.Invoke();
            }
            catch (Exception ex)
            {
                Debug.LogError($"[MinigameUIManager] OnResumeRequested event: {ex}");
            }
        }

        /// <summary>
        /// Handles the quit button click.
        /// </summary>
        private void OnQuitButtonClicked()
        {
            try
            {
                OnQuitRequested?.Invoke();
            }
            catch (Exception ex)
            {
                Debug.LogError($"[MinigameUIManager] OnQuitRequested event: {ex}");
            }
        }

        /// <summary>
        /// Handles the settings button click.
        /// </summary>
        private void OnSettingsButtonClicked()
        {
            Debug.Log("[MinigameUIManager] Settings button clicked.");
            // TODO: Open settings menu
        }

        #endregion

        #region Utility

        /// <summary>
        /// Safely sets a GameObject's active state with null checking.
        /// </summary>
        private void SetScreenActive(GameObject screen, bool active)
        {
            if (screen != null)
                screen.SetActive(active);
        }

        /// <summary>
        /// Switches to a target screen, hiding the current one.
        /// Uses transition animation if available.
        /// </summary>
        private void SwitchScreen(GameObject targetScreen)
        {
            if (targetScreen == _currentScreen) return;

            if (TransitionAnimator != null && _currentScreen != null)
            {
                StartCoroutine(ScreenTransitionCoroutine(targetScreen));
            }
            else
            {
                HideAllScreens();
                if (targetScreen != null)
                    targetScreen.SetActive(true);
                _currentScreen = targetScreen;
            }
        }

        #endregion

        #region Public API

        /// <summary>
        /// Gets the name of the currently active screen for debugging.
        /// </summary>
        public string GetCurrentScreenName() => _currentScreen?.name ?? "None";

        /// <summary>
        /// Checks if a specific screen is currently visible.
        /// </summary>
        public bool IsScreenVisible(GameObject screen)
        {
            return screen != null && screen.activeSelf;
        }

        /// <summary>
        /// Forces a refresh of the player list on the waiting screen.
        /// </summary>
        public void RefreshWaitingScreen(List<string> playerNames, int minPlayers)
        {
            if (_currentScreen != WaitingScreen) return;

            ShowWaiting(playerNames);

            if (MinPlayersText != null)
                MinPlayersText.text = $"Min: {minPlayers}";
        }

        /// <summary>
        /// Updates the phase text on the gameplay HUD.
        /// </summary>
        public void UpdatePhaseText(string phaseName)
        {
            // Implementation depends on phase text location
            Debug.Log($"[MinigameUIManager] Phase: {phaseName}");
        }

        #endregion

        #region Cleanup

        /// <summary>
        /// Cleans up all coroutines and resets the UI manager.
        /// </summary>
        private void OnDestroy()
        {
            if (_countdownCoroutine != null)
                StopCoroutine(_countdownCoroutine);

            if (_resultsCoroutine != null)
                StopCoroutine(_resultsCoroutine);

            // Remove button listeners
            if (ResumeButton != null)
                ResumeButton.onClick.RemoveListener(OnResumeButtonClicked);

            if (QuitButton != null)
                QuitButton.onClick.RemoveListener(OnQuitButtonClicked);

            if (SettingsButton != null)
                SettingsButton.onClick.RemoveListener(OnSettingsButtonClicked);
        }

        #endregion
    }
}
