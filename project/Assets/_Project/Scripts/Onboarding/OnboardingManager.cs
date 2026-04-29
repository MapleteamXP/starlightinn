using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;
using KawaiiCool.UI;
using KawaiiCool.Events;
using KawaiiCool.Input;
using KawaiiCool.World;
using KawaiiCool.Player;
using KawaiiCool.Chat;

namespace KawaiiCool.Onboarding
{
    /// <summary>
    /// Enumerates the types of player actions required to advance an onboarding step.
    /// </summary>
    public enum OnboardingActionType
    {
        /// <summary>No action required; step advances automatically or via code.</summary>
        None,
        /// <summary>Player must tap or click.</summary>
        Tap,
        /// <summary>Player must long-press.</summary>
        LongPress,
        /// <summary>Player must drag.</summary>
        Drag,
        /// <summary>Player must type text.</summary>
        Type,
        /// <summary>Wait for a timed duration.</summary>
        Wait,
        /// <summary>Player must navigate to a location or UI screen.</summary>
        Navigate,
        /// <summary>Player must interact with an object or player.</summary>
        Interact,
        /// <summary>Player must complete a specific task.</summary>
        CompleteTask
    }

    /// <summary>
    /// Defines a single step in the first-time user onboarding sequence.
    /// </summary>
    [System.Serializable]
    public class OnboardingStep
    {
        [Tooltip("Unique identifier for this step.")]
        public string StepId;

        [Tooltip("Title displayed in the tutorial overlay for this step.")]
        public string Title;

        [Tooltip("Description text explaining what the player should do.")]
        public string Description;

        [Tooltip("Specific instruction shown to the player.")]
        public string InstructionText;

        [Tooltip("Optional illustration sprite for this step.")]
        public Sprite Illustration;

        [Tooltip("UI element to highlight (assign RectTransform from the scene).")]
        public GameObject TargetUIElement;

        [Tooltip("Tag used to find a world-space object to highlight.")]
        public string TargetObjectTag;

        [Tooltip("The type of action the player must perform to complete this step.")]
        public OnboardingActionType RequiredAction;

        [Tooltip("Whether the player is allowed to skip this individual step.")]
        public bool IsSkippable = true;

        [Tooltip("Delay in seconds before auto-advancing. -1 = manual advancement only.")]
        public float AutoAdvanceDelay = -1f;

        [Tooltip("Rewards granted when this step is completed.")]
        public List<RewardData> CompletionRewards = new List<RewardData>();
    }

    /// <summary>
    /// Manages the first-time user experience (FTUE) for KawaiiCool Island v3.0.
    /// Orchestrates a sequence of guided onboarding steps, tracks progress,
    /// saves/loads completion state, and integrates with the UI, camera, chat,
    /// and interaction systems via the EventBus.
    /// </summary>
    public class OnboardingManager : Singleton<OnboardingManager>
    {
        // ─────────────────────────────────────────────────────────────────
        //  State
        // ─────────────────────────────────────────────────────────────────
        [Header("State")]
        [SerializeField, Tooltip("Whether the player has fully completed onboarding.")]
        private bool _hasCompletedOnboarding;

        /// <summary>
        /// Gets whether the player has fully completed onboarding.
        /// </summary>
        public bool HasCompletedOnboarding => _hasCompletedOnboarding;

        [SerializeField, Tooltip("Index of the currently active onboarding step (0-based).")]
        private int _currentStep;

        /// <summary>
        /// Gets the index of the currently active onboarding step.
        /// </summary>
        public int CurrentStep => _currentStep;

        [SerializeField, Tooltip("The full list of onboarding steps.")]
        private List<OnboardingStep> _allSteps = new List<OnboardingStep>();

        /// <summary>
        /// Gets the full list of onboarding steps.
        /// </summary>
        public List<OnboardingStep> AllSteps => _allSteps;

        // ─────────────────────────────────────────────────────────────────
        //  Settings
        // ─────────────────────────────────────────────────────────────────
        [Header("Settings")]
        [SerializeField, Tooltip("If true, new players will be forced into onboarding on first login.")]
        public bool ForceOnboardingForNewPlayers = true;

        [SerializeField, Tooltip("If true, players can skip the entire onboarding sequence.")]
        public bool AllowSkip = true;

        [SerializeField, Tooltip("If true, contextual tutorial tips will appear after onboarding is finished.")]
        public bool ShowTutorialTipsAfterOnboarding = true;

        [SerializeField, Tooltip("Delay in seconds before showing a post-onboarding tip.")]
        public float TipDisplayDelay = 5f;

        // ─────────────────────────────────────────────────────────────────
        //  Progress
        // ─────────────────────────────────────────────────────────────────
        /// <summary>
        /// Gets the total number of onboarding steps configured.
        /// </summary>
        public int TotalSteps => _allSteps.Count;

        /// <summary>
        /// Gets the current progress as a normalized value between 0 and 1.
        /// </summary>
        public float ProgressPercent => TotalSteps > 0 ? _currentStep / (float)TotalSteps : 0f;

        [SerializeField, Tooltip("Tracks completion state for individual steps by their StepId.")]
        private Dictionary<string, bool> _stepCompletion = new Dictionary<string, bool>();

        /// <summary>
        /// Gets the dictionary mapping step IDs to their completion status.
        /// </summary>
        public Dictionary<string, bool> StepCompletion => _stepCompletion;

        // ─────────────────────────────────────────────────────────────────
        //  Internal Dependencies
        // ─────────────────────────────────────────────────────────────────
        [Header("References")]
        [SerializeField, Tooltip("Reference to the tutorial overlay component.")]
        private TutorialOverlay _tutorialOverlay;

        [SerializeField, Tooltip("Reference to the world camera controller for focus changes.")]
        private WorldCameraController _worldCamera;

        [SerializeField, Tooltip("Reference to the UIManager for panel operations.")]
        private UIManager _uiManager;

        [SerializeField, Tooltip("Reference to the chat manager.")]
        private ChatManager _chatManager;

        [SerializeField, Tooltip("Reference to the touch input handler.")]
        private TouchInputHandler _touchInput;

        // ─────────────────────────────────────────────────────────────────
        //  Feature Discovery
        // ─────────────────────────────────────────────────────────────────
        private HashSet<string> _discoveredFeatures = new HashSet<string>();
        private const string PREFS_ONBOARDING_COMPLETE = "KawaiiCool_OnboardingComplete";
        private const string PREFS_ONBOARDING_STEP = "KawaiiCool_OnboardingStep";
        private const string PREFS_DISCOVERED_FEATURES = "KawaiiCool_DiscoveredFeatures";
        private const string PREFS_STEP_COMPLETION = "KawaiiCool_StepCompletion";

        // ─────────────────────────────────────────────────────────────────
        //  Events
        // ─────────────────────────────────────────────────────────────────
        /// <summary>
        /// Invoked when an onboarding step begins. Parameter is the step index.
        /// </summary>
        public event Action<int> OnStepStarted;

        /// <summary>
        /// Invoked when an onboarding step is completed. Parameter is the step index.
        /// </summary>
        public event Action<int> OnStepCompleted;

        /// <summary>
        /// Invoked when the entire onboarding sequence is completed.
        /// </summary>
        public event Action OnOnboardingComplete;

        /// <summary>
        /// Invoked when the player chooses to skip onboarding.
        /// </summary>
        public event Action OnOnboardingSkipped;

        // ─────────────────────────────────────────────────────────────────
        //  Lifecycle
        // ─────────────────────────────────────────────────────────────────
        protected override void Awake()
        {
            base.Awake();
            LoadProgress();
        }

        private void Start()
        {
            if (_tutorialOverlay == null)
                _tutorialOverlay = FindFirstObjectByType<TutorialOverlay>();
            if (_worldCamera == null)
                _worldCamera = FindFirstObjectByType<WorldCameraController>();
            if (_uiManager == null)
                _uiManager = UIManager.Instance;
            if (_chatManager == null)
                _chatManager = ChatManager.Instance;
            if (_touchInput == null)
                _touchInput = FindFirstObjectByType<TouchInputHandler>();

            EventBus.Instance.Subscribe(EventBus.EventType.PlayerLoggedIn, OnPlayerLoggedIn);
            EventBus.Instance.Subscribe(EventBus.EventType.SceneLoaded, OnSceneLoaded);
        }

        private void OnDestroy()
        {
            if (EventBus.HasInstance)
            {
                EventBus.Instance.Unsubscribe(EventBus.EventType.PlayerLoggedIn, OnPlayerLoggedIn);
                EventBus.Instance.Unsubscribe(EventBus.EventType.SceneLoaded, OnSceneLoaded);
            }
        }

        // ─────────────────────────────────────────────────────────────────
        //  Entry Point
        // ─────────────────────────────────────────────────────────────────
        /// <summary>
        /// Called automatically when a player logs in. Determines whether onboarding should begin.
        /// </summary>
        private void OnPlayerLoggedIn(object data)
        {
            bool isNewPlayer = data is bool b && b;
            if (ForceOnboardingForNewPlayers && isNewPlayer && !_hasCompletedOnboarding)
            {
                StartOnboarding();
            }
        }

        private void OnSceneLoaded(object data)
        {
            // Re-bind scene references after a scene load.
            if (_tutorialOverlay == null)
                _tutorialOverlay = FindFirstObjectByType<TutorialOverlay>();
            if (_worldCamera == null)
                _worldCamera = FindFirstObjectByType<WorldCameraController>();
        }

        // ─────────────────────────────────────────────────────────────────
        //  Public API
        // ─────────────────────────────────────────────────────────────────
        /// <summary>
        /// Begins the onboarding sequence from the first step.
        /// </summary>
        public void StartOnboarding()
        {
            _currentStep = 0;
            _hasCompletedOnboarding = false;
            SaveProgress();
            ExecuteCurrentStep();
            Debug.Log("[OnboardingManager] Onboarding started.");
        }

        /// <summary>
        /// Skips the entire onboarding sequence and marks it as completed.
        /// </summary>
        public void SkipOnboarding()
        {
            _hasCompletedOnboarding = true;
            _currentStep = TotalSteps;
            SaveProgress();
            _tutorialOverlay?.HideHighlight();
            _tutorialOverlay?.UnblockAll();
            OnOnboardingSkipped?.Invoke();
            EventBus.Instance.Publish(EventBus.EventType.OnboardingSkipped);
            Debug.Log("[OnboardingManager] Onboarding skipped by user.");
        }

        /// <summary>
        /// Jumps directly to a specific step index.
        /// </summary>
        /// <param name="stepIndex">The zero-based step index to jump to.</param>
        public void GoToStep(int stepIndex)
        {
            if (stepIndex < 0 || stepIndex >= TotalSteps)
            {
                Debug.LogWarning($"[OnboardingManager] Invalid step index: {stepIndex}");
                return;
            }
            _currentStep = stepIndex;
            ExecuteCurrentStep();
        }

        /// <summary>
        /// Advances to the next onboarding step.
        /// </summary>
        public void NextStep()
        {
            if (_currentStep < TotalSteps - 1)
            {
                _currentStep++;
                ExecuteCurrentStep();
            }
            else
            {
                CompleteOnboarding();
            }
        }

        /// <summary>
        /// Goes back to the previous onboarding step.
        /// </summary>
        public void PreviousStep()
        {
            if (_currentStep > 0)
            {
                _currentStep--;
                ExecuteCurrentStep();
            }
        }

        /// <summary>
        /// Marks the current step as completed, awards any rewards, and advances.
        /// </summary>
        public void CompleteCurrentStep()
        {
            if (_currentStep < 0 || _currentStep >= TotalSteps) return;

            var step = _allSteps[_currentStep];
            _stepCompletion[step.StepId] = true;

            // Grant rewards.
            foreach (var reward in step.CompletionRewards)
            {
                GrantReward(reward);
            }

            OnStepCompleted?.Invoke(_currentStep);
            EventBus.Instance.Publish(EventBus.EventType.OnboardingStepCompleted, _currentStep);

            SaveProgress();
            NextStep();
        }

        /// <summary>
        /// Marks the entire onboarding sequence as completed.
        /// </summary>
        public void CompleteOnboarding()
        {
            _hasCompletedOnboarding = true;
            _currentStep = TotalSteps;
            SaveProgress();
            _tutorialOverlay?.HideHighlight();
            _tutorialOverlay?.UnblockAll();
            OnOnboardingComplete?.Invoke();
            EventBus.Instance.Publish(EventBus.EventType.OnboardingComplete);
            Debug.Log("[OnboardingManager] Onboarding completed!");

            if (ShowTutorialTipsAfterOnboarding)
            {
                StartCoroutine(DelayedTipActivation());
            }
        }

        /// <summary>
        /// Resets onboarding progress so it can be run again.
        /// </summary>
        public void ResetOnboarding()
        {
            _hasCompletedOnboarding = false;
            _currentStep = 0;
            _stepCompletion.Clear();
            _discoveredFeatures.Clear();
            SaveProgress();
            Debug.Log("[OnboardingManager] Onboarding progress reset.");
        }

        /// <summary>
        /// Marks a feature as discovered by the player.
        /// </summary>
        /// <param name="featureId">The unique identifier of the discovered feature.</param>
        public void MarkFeatureDiscovered(string featureId)
        {
            if (string.IsNullOrEmpty(featureId)) return;
            _discoveredFeatures.Add(featureId);
            SaveProgress();
            EventBus.Instance.Publish(EventBus.EventType.FeatureDiscovered, featureId);
        }

        /// <summary>
        /// Checks whether a feature has already been discovered.
        /// </summary>
        /// <param name="featureId">The feature identifier to check.</param>
        /// <returns>True if the feature has been discovered; otherwise false.</returns>
        public bool HasDiscoveredFeature(string featureId)
        {
            return !string.IsNullOrEmpty(featureId) && _discoveredFeatures.Contains(featureId);
        }

        // ─────────────────────────────────────────────────────────────────
        //  Step Execution Router
        // ─────────────────────────────────────────────────────────────────
        private void ExecuteCurrentStep()
        {
            if (_currentStep < 0 || _currentStep >= TotalSteps)
            {
                CompleteOnboarding();
                return;
            }

            var step = _allSteps[_currentStep];
            OnStepStarted?.Invoke(_currentStep);
            EventBus.Instance.Publish(EventBus.EventType.OnboardingStepStarted, _currentStep);

            // Route to the appropriate step handler based on step id or index.
            switch (step.StepId)
            {
                case "welcome":             Step_Welcome(); break;
                case "character_creation":  Step_CharacterCreation(); break;
                case "enter_world":         Step_EnterWorld(); break;
                case "movement":            Step_Movement(); break;
                case "camera_zoom":         Step_CameraZoom(); break;
                case "interact_player":     Step_InteractWithPlayer(); break;
                case "friend_list":         Step_OpenFriendList(); break;
                case "send_message":          Step_SendMessage(); break;
                case "visit_room":            Step_VisitRoom(); break;
                case "play_minigame":         Step_PlayMinigame(); break;
                case "customize_avatar":      Step_CustomizeAvatar(); break;
                case "daily_rewards":         Step_DailyRewards(); break;
                case "complete":              Step_Complete(); break;
                default:
                    // Generic step handler.
                    HandleGenericStep(step);
                    break;
            }
        }

        private void HandleGenericStep(OnboardingStep step)
        {
            if (_tutorialOverlay == null) return;

            if (step.TargetUIElement != null)
            {
                var rt = step.TargetUIElement.GetComponent<RectTransform>();
                if (rt != null)
                    _tutorialOverlay.ShowHighlight(rt, step.Title, step.Description);
            }
            else if (!string.IsNullOrEmpty(step.TargetObjectTag))
            {
                var target = GameObject.FindWithTag(step.TargetObjectTag);
                if (target != null)
                {
                    var wPos = target.transform.position;
                    _tutorialOverlay.ShowWorldHighlight(wPos, 2f, step.Title, step.Description);
                }
            }

            if (step.AutoAdvanceDelay > 0)
            {
                StartCoroutine(AutoAdvanceAfterDelay(step.AutoAdvanceDelay));
            }
        }

        private IEnumerator AutoAdvanceAfterDelay(float delay)
        {
            yield return new WaitForSeconds(delay);
            CompleteCurrentStep();
        }

        private IEnumerator DelayedTipActivation()
        {
            yield return new WaitForSeconds(TipDisplayDelay);
            TooltipSystem.Instance?.ShowContextualTooltip("post_onboarding");
        }

        // ─────────────────────────────────────────────────────────────────
        //  Step Handlers
        // ─────────────────────────────────────────────────────────────────
        /// <summary>
        /// Step: Welcome — introduces the player to the island.
        /// </summary>
        private void Step_Welcome()
        {
            var step = _allSteps[_currentStep];
            _tutorialOverlay?.ShowHighlight(
                new Vector2(Screen.width * 0.5f, Screen.height * 0.5f),
                new Vector2(400f, 250f),
                step.Title,
                step.Description
            );
            _tutorialOverlay?.ShowFingerTap(new Vector2(Screen.width * 0.5f, Screen.height * 0.5f + 60f));

            if (step.AutoAdvanceDelay > 0)
                StartCoroutine(AutoAdvanceAfterDelay(step.AutoAdvanceDelay));
        }

        /// <summary>
        /// Step: CharacterCreation — guides the player to create their avatar.
        /// </summary>
        private void Step_CharacterCreation()
        {
            var step = _allSteps[_currentStep];
            var charCreator = FindFirstObjectByType<CharacterCreator>();
            if (charCreator != null)
            {
                var rt = charCreator.GetComponent<RectTransform>();
                if (rt != null)
                    _tutorialOverlay?.ShowHighlight(rt, step.Title, step.Description);
            }
            else if (step.TargetUIElement != null)
            {
                var rt = step.TargetUIElement.GetComponent<RectTransform>();
                if (rt != null)
                    _tutorialOverlay?.ShowHighlight(rt, step.Title, step.Description);
            }
            EventBus.Instance.Publish(EventBus.EventType.OnboardingHighlightCharacterCreator);
        }

        /// <summary>
        /// Step: EnterWorld — transitions from creation to the world scene.
        /// </summary>
        private void Step_EnterWorld()
        {
            var step = _allSteps[_currentStep];
            _tutorialOverlay?.ShowHighlight(
                new Vector2(Screen.width * 0.5f, Screen.height * 0.4f),
                new Vector2(500f, 120f),
                step.Title,
                step.Description
            );
            EventBus.Instance.Publish(EventBus.EventType.OnboardingRequestEnterWorld);
        }

        /// <summary>
        /// Step: Movement — teaches basic movement controls.
        /// </summary>
        private void Step_Movement()
        {
            var step = _allSteps[_currentStep];
            _tutorialOverlay?.ShowHighlight(
                new Vector2(Screen.width * 0.5f, Screen.height * 0.2f),
                new Vector2(300f, 200f),
                step.Title,
                step.Description
            );

            if (_touchInput != null)
            {
                // Listen for first movement input.
                StartCoroutine(WaitForMovementInput());
            }
        }

        private IEnumerator WaitForMovementInput()
        {
            float timeout = 30f;
            float elapsed = 0f;
            while (elapsed < timeout)
            {
                if (Input.GetAxisRaw("Horizontal") != 0 || Input.GetAxisRaw("Vertical") != 0)
                {
                    CompleteCurrentStep();
                    yield break;
                }
                elapsed += Time.deltaTime;
                yield return null;
            }
            Debug.Log("[OnboardingManager] Movement step timed out; auto-completing.");
            CompleteCurrentStep();
        }

        /// <summary>
        /// Step: CameraZoom — teaches pinch/spread or scroll wheel zoom.
        /// </summary>
        private void Step_CameraZoom()
        {
            var step = _allSteps[_currentStep];
            _tutorialOverlay?.ShowHighlight(
                new Vector2(Screen.width * 0.8f, Screen.height * 0.2f),
                new Vector2(280f, 200f),
                step.Title,
                step.Description
            );

            if (_worldCamera != null)
            {
                StartCoroutine(WaitForZoomInput());
            }
        }

        private IEnumerator WaitForZoomInput()
        {
            float initialZoom = _worldCamera != null ? _worldCamera.ZoomLevel : 0f;
            float timeout = 30f;
            float elapsed = 0f;
            while (elapsed < timeout)
            {
                if (_worldCamera != null && Mathf.Abs(_worldCamera.ZoomLevel - initialZoom) > 0.1f)
                {
                    CompleteCurrentStep();
                    yield break;
                }
                elapsed += Time.deltaTime;
                yield return null;
            }
            CompleteCurrentStep();
        }

        /// <summary>
        /// Step: InteractWithPlayer — guides the player to tap another player.
        /// </summary>
        private void Step_InteractWithPlayer()
        {
            var step = _allSteps[_currentStep];
            var target = GameObject.FindWithTag("PlayerAvatar");
            if (target != null)
            {
                var interactable = target.GetComponent<PlayerInteractable>();
                if (interactable != null)
                {
                    _tutorialOverlay?.ShowWorldHighlight(target.transform.position, 1.5f, step.Title, step.Description);
                    interactable.OnInteract += OnTargetPlayerInteracted;
                }
            }
            else
            {
                // Fallback to generic highlight.
                HandleGenericStep(step);
            }
        }

        private void OnTargetPlayerInteracted(PlayerInteractable source)
        {
            source.OnInteract -= OnTargetPlayerInteracted;
            CompleteCurrentStep();
        }

        /// <summary>
        /// Step: OpenFriendList — opens the social panel.
        /// </summary>
        private void Step_OpenFriendList()
        {
            var step = _allSteps[_currentStep];
            var friendButton = GameObject.FindWithTag("FriendListButton");
            if (friendButton != null)
            {
                var rt = friendButton.GetComponent<RectTransform>();
                if (rt != null)
                    _tutorialOverlay?.ShowHighlight(rt, step.Title, step.Description);
            }
            else
            {
                HandleGenericStep(step);
            }
        }

        /// <summary>
        /// Step: SendMessage — teaches the chat system.
        /// </summary>
        private void Step_SendMessage()
        {
            var step = _allSteps[_currentStep];
            if (_chatManager != null)
            {
                var chatPanel = _chatManager.GetComponent<RectTransform>();
                if (chatPanel != null)
                    _tutorialOverlay?.ShowHighlight(chatPanel, step.Title, step.Description);
            }
            else
            {
                HandleGenericStep(step);
            }
        }

        /// <summary>
        /// Step: VisitRoom — guides the player to enter a user room.
        /// </summary>
        private void Step_VisitRoom()
        {
            var step = _allSteps[_currentStep];
            var roomButton = GameObject.FindWithTag("RoomButton");
            if (roomButton != null)
            {
                var rt = roomButton.GetComponent<RectTransform>();
                if (rt != null)
                    _tutorialOverlay?.ShowHighlight(rt, step.Title, step.Description);
            }
            else
            {
                HandleGenericStep(step);
            }
        }

        /// <summary>
        /// Step: PlayMinigame — guides the player to a minigame.
        /// </summary>
        private void Step_PlayMinigame()
        {
            var step = _allSteps[_currentStep];
            var gamePortal = GameObject.FindWithTag("MinigamePortal");
            if (gamePortal != null)
            {
                _tutorialOverlay?.ShowWorldHighlight(gamePortal.transform.position, 2f, step.Title, step.Description);
            }
            else
            {
                HandleGenericStep(step);
            }
        }

        /// <summary>
        /// Step: CustomizeAvatar — directs to the wardrobe or customization UI.
        /// </summary>
        private void Step_CustomizeAvatar()
        {
            var step = _allSteps[_currentStep];
            var customizeBtn = GameObject.FindWithTag("CustomizeButton");
            if (customizeBtn != null)
            {
                var rt = customizeBtn.GetComponent<RectTransform>();
                if (rt != null)
                    _tutorialOverlay?.ShowHighlight(rt, step.Title, step.Description);
            }
            else
            {
                HandleGenericStep(step);
            }
        }

        /// <summary>
        /// Step: DailyRewards — shows the daily login reward UI.
        /// </summary>
        private void Step_DailyRewards()
        {
            var step = _allSteps[_currentStep];
            var rewardButton = GameObject.FindWithTag("DailyRewardButton");
            if (rewardButton != null)
            {
                var rt = rewardButton.GetComponent<RectTransform>();
                if (rt != null)
                    _tutorialOverlay?.ShowHighlight(rt, step.Title, step.Description);
            }
            else
            {
                HandleGenericStep(step);
            }
        }

        /// <summary>
        /// Step: Complete — final congratulations and reward summary.
        /// </summary>
        private void Step_Complete()
        {
            var step = _allSteps[_currentStep];
            _tutorialOverlay?.ShowHighlight(
                new Vector2(Screen.width * 0.5f, Screen.height * 0.5f),
                new Vector2(500f, 350f),
                step.Title,
                step.Description
            );
            _tutorialOverlay?.HideFingerTap();

            if (step.AutoAdvanceDelay > 0)
                StartCoroutine(AutoAdvanceAfterDelay(step.AutoAdvanceDelay));
            else
                CompleteOnboarding();
        }

        // ─────────────────────────────────────────────────────────────────
        //  Persistence
        // ─────────────────────────────────────────────────────────────────
        /// <summary>
        /// Saves the current onboarding progress to PlayerPrefs.
        /// </summary>
        private void SaveProgress()
        {
            PlayerPrefs.SetInt(PREFS_ONBOARDING_COMPLETE, _hasCompletedOnboarding ? 1 : 0);
            PlayerPrefs.SetInt(PREFS_ONBOARDING_STEP, _currentStep);
            PlayerPrefs.SetString(PREFS_DISCOVERED_FEATURES, string.Join(",", _discoveredFeatures));

            // Serialize step completion.
            var sb = new System.Text.StringBuilder();
            foreach (var kvp in _stepCompletion)
            {
                sb.Append(kvp.Key).Append('=').Append(kvp.Value ? '1' : '0').Append(';');
            }
            PlayerPrefs.SetString(PREFS_STEP_COMPLETION, sb.ToString());
            PlayerPrefs.Save();
        }

        /// <summary>
        /// Loads onboarding progress from PlayerPrefs.
        /// </summary>
        private void LoadProgress()
        {
            _hasCompletedOnboarding = PlayerPrefs.GetInt(PREFS_ONBOARDING_COMPLETE, 0) == 1;
            _currentStep = PlayerPrefs.GetInt(PREFS_ONBOARDING_STEP, 0);

            string discovered = PlayerPrefs.GetString(PREFS_DISCOVERED_FEATURES, "");
            _discoveredFeatures.Clear();
            if (!string.IsNullOrEmpty(discovered))
            {
                foreach (var f in discovered.Split(','))
                {
                    if (!string.IsNullOrEmpty(f))
                        _discoveredFeatures.Add(f);
                }
            }

            _stepCompletion.Clear();
            string completionData = PlayerPrefs.GetString(PREFS_STEP_COMPLETION, "");
            if (!string.IsNullOrEmpty(completionData))
            {
                var entries = completionData.Split(';');
                foreach (var entry in entries)
                {
                    if (string.IsNullOrEmpty(entry)) continue;
                    var parts = entry.Split('=');
                    if (parts.Length == 2)
                        _stepCompletion[parts[0]] = parts[1] == "1";
                }
            }
        }

        // ─────────────────────────────────────────────────────────────────
        //  Rewards
        // ─────────────────────────────────────────────────────────────────
        private void GrantReward(RewardData reward)
        {
            if (reward == null) return;
            Debug.Log($"[OnboardingManager] Granting reward: {reward.DisplayName} x{reward.Quantity}");
            EventBus.Instance.Publish(EventBus.EventType.RewardGranted, reward);
            // In a full implementation, this would call the Inventory or Economy system.
        }

        // ─────────────────────────────────────────────────────────────────
        //  Debug Helpers
        // ─────────────────────────────────────────────────────────────────
        /// <summary>
        /// Logs the current onboarding state for debugging purposes.
        /// </summary>
        [ContextMenu("Log State")]
        public void DebugLogState()
        {
            Debug.Log($"[OnboardingManager] Completed={_hasCompletedOnboarding}, Step={_currentStep}/{TotalSteps}, Progress={ProgressPercent:P0}");
        }
    }
}
