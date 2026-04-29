using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.SceneManagement;
using TMPro;
using KawaiiCool.UI;
using KawaiiCool.Events;

namespace KawaiiCool.Onboarding
{
    /// <summary>
    /// Defines a single phase in the first-run wizard experience.
    /// </summary>
    [System.Serializable]
    public class WizardPhase
    {
        [Tooltip("Unique identifier for this wizard phase.")]
        public string PhaseId;

        [Tooltip("Display title shown during this phase.")]
        public string Title;

        [Tooltip("Description text explaining this phase.")]
        public string Description;

        [Tooltip("Illustration sprite shown for this phase.")]
        public Sprite Illustration;

        [Tooltip("Optional prefab instantiated for interactive demonstration during this phase.")]
        public GameObject DemoPrefab;

        [Tooltip("Rewards granted when this phase is completed.")]
        public List<RewardData> Rewards = new List<RewardData>();

        [Tooltip("If true, the player must perform an interaction before advancing.")]
        public bool RequiresInteraction;

        [Tooltip("Time in seconds before auto-advancing. -1 = no auto-advance.")]
        public float AutoAdvanceTime = -1f;
    }

    /// <summary>
    /// Guided first-run experience that runs after character creation.
    /// The wizard walks the player through core systems in a safe demo world
       /// before releasing them into the main KawaiiCool Island world.
    /// </summary>
    public class FirstRunWizard : MonoBehaviour
    {
        // ─────────────────────────────────────────────────────────────────
        //  Phases
        // ─────────────────────────────────────────────────────────────────
        [Header("Phases")]
        [SerializeField, Tooltip("Ordered list of phases that make up the wizard experience.")]
        private List<WizardPhase> _phases = new List<WizardPhase>();

        [SerializeField, Tooltip("Index of the currently active wizard phase."), ReadOnly]
        private int _currentPhase = 0;

        /// <summary>
        /// Gets the index of the currently active wizard phase.
        /// </summary>
        public int CurrentPhase => _currentPhase;

        // ─────────────────────────────────────────────────────────────────
        //  UI
        // ─────────────────────────────────────────────────────────────────
        [Header("UI")]
        [SerializeField, Tooltip("Root panel GameObject for the wizard UI.")]
        private GameObject _wizardPanel;

        [SerializeField, Tooltip("Text component for the current phase title.")]
        private TMP_Text _phaseTitle;

        [SerializeField, Tooltip("Text component for the current phase description.")]
        private TMP_Text _phaseDescription;

        [SerializeField, Tooltip("Button to advance to the next phase.")]
        private Button _nextPhaseButton;

        [SerializeField, Tooltip("Button to skip the entire wizard.")]
        private Button _skipButton;

        [SerializeField, Tooltip("Progress slider showing overall wizard completion.")]
        private Slider _progressBar;

        [SerializeField, Tooltip("Image component for the phase illustration.")]
        private Image _phaseIllustration;

        // ─────────────────────────────────────────────────────────────────
        //  Rewards
        // ─────────────────────────────────────────────────────────────────
        [Header("Rewards")]
        [SerializeField, Tooltip("Panel shown when granting phase completion rewards.")]
        private GameObject _rewardPanel;

        [SerializeField, Tooltip("Container transform where reward item UI elements are spawned.")]
        private Transform _rewardContainer;

        [SerializeField, Tooltip("Prefab instantiated for each reward entry in the reward panel.")]
        private GameObject _rewardItemPrefab;

        [SerializeField, Tooltip("Title text component on the reward panel.")]
        private TMP_Text _rewardTitle;

        // ─────────────────────────────────────────────────────────────────
        //  Demo World
        // ─────────────────────────────────────────────────────────────────
        [Header("Demo")]
        [SerializeField, Tooltip("If true, the wizard runs inside an isolated demo/tutorial scene.")]
        private bool _useDemoWorld = true;

        [SerializeField, Tooltip("Name of the demo scene to load for the wizard.")]
        private string _demoSceneName = "TutorialWorld";

        private GameObject _currentDemoInstance;
        private Coroutine _autoAdvanceCoroutine;
        private AsyncOperation _sceneLoadOp;
        private bool _isWizardActive;

        // ─────────────────────────────────────────────────────────────────
        //  Events
        // ─────────────────────────────────────────────────────────────────
        /// <summary>
        /// Invoked when the wizard is fully completed.
        /// </summary>
        public event Action OnWizardComplete;

        /// <summary>
        /// Invoked when the player chooses to skip the wizard.
        /// </summary>
        public event Action OnWizardSkipped;

        // ─────────────────────────────────────────────────────────────────
        //  Lifecycle
        // ─────────────────────────────────────────────────────────────────
        private void Awake()
        {
            if (_wizardPanel != null)
                _wizardPanel.SetActive(false);
            if (_rewardPanel != null)
                _rewardPanel.SetActive(false);
        }

        private void Start()
        {
            if (_nextPhaseButton != null)
                _nextPhaseButton.onClick.AddListener(NextPhase);
            if (_skipButton != null)
                _skipButton.onClick.AddListener(SkipWizard);
        }

        private void OnDestroy()
        {
            if (_nextPhaseButton != null)
                _nextPhaseButton.onClick.RemoveListener(NextPhase);
            if (_skipButton != null)
                _skipButton.onClick.RemoveListener(SkipWizard);
        }

        // ─────────────────────────────────────────────────────────────────
        //  Public API
        // ─────────────────────────────────────────────────────────────────
        /// <summary>
        /// Starts the first-run wizard sequence.
        /// </summary>
        public void StartWizard()
        {
            if (_phases.Count == 0)
            {
                Debug.LogWarning("[FirstRunWizard] No phases configured. Completing immediately.");
                CompleteWizard();
                return;
            }

            _isWizardActive = true;
            _currentPhase = 0;

            if (_useDemoWorld)
                LoadDemoWorld();

            if (_wizardPanel != null)
                _wizardPanel.SetActive(true);

            UpdateProgressBar();
            ExecutePhase(_currentPhase);

            EventBus.Instance.Publish(EventBus.EventType.WizardStarted);
            Debug.Log("[FirstRunWizard] Wizard started.");
        }

        /// <summary>
        /// Advances to the next wizard phase.
        /// </summary>
        public void NextPhase()
        {
            if (!_isWizardActive) return;

            // Award rewards for the current phase.
            if (_currentPhase >= 0 && _currentPhase < _phases.Count)
            {
                var phase = _phases[_currentPhase];
                if (phase.Rewards != null && phase.Rewards.Count > 0)
                {
                    ShowReward(phase.Rewards);
                }
            }

            // Clean up current phase environment.
            CleanupPhaseEnvironment(_currentPhase);

            _currentPhase++;
            if (_currentPhase >= _phases.Count)
            {
                CompleteWizard();
                return;
            }

            UpdateProgressBar();
            ExecutePhase(_currentPhase);
        }

        /// <summary>
        /// Skips the wizard entirely and transitions to the main world.
        /// </summary>
        public void SkipWizard()
        {
            _isWizardActive = false;
            CleanupAllPhaseEnvironments();
            if (_wizardPanel != null)
                _wizardPanel.SetActive(false);
            UnloadDemoWorld();
            OnWizardSkipped?.Invoke();
            EventBus.Instance.Publish(EventBus.EventType.WizardSkipped);
            Debug.Log("[FirstRunWizard] Wizard skipped by user.");
        }

        /// <summary>
        /// Completes the wizard, grants any remaining rewards, and transitions to the main world.
        /// </summary>
        public void CompleteWizard()
        {
            _isWizardActive = false;

            // Grant any unclaimed rewards from the final phase.
            if (_currentPhase >= 0 && _currentPhase < _phases.Count)
            {
                var phase = _phases[_currentPhase];
                if (phase.Rewards != null && phase.Rewards.Count > 0)
                {
                    ShowReward(phase.Rewards);
                }
            }

            CleanupAllPhaseEnvironments();
            if (_wizardPanel != null)
                _wizardPanel.SetActive(false);
            UnloadDemoWorld();

            OnWizardComplete?.Invoke();
            EventBus.Instance.Publish(EventBus.EventType.WizardComplete);
            Debug.Log("[FirstRunWizard] Wizard completed!");

            // If onboarding manager exists, mark onboarding complete.
            if (OnboardingManager.HasInstance)
            {
                OnboardingManager.Instance.CompleteOnboarding();
            }
        }

        /// <summary>
        /// Displays the reward panel with a list of granted rewards.
        /// </summary>
        /// <param name="rewards">The list of rewards to display.</param>
        public void ShowReward(List<RewardData> rewards)
        {
            if (rewards == null || rewards.Count == 0) return;
            if (_rewardPanel == null || _rewardContainer == null || _rewardItemPrefab == null) return;

            // Clear previous reward items.
            foreach (Transform child in _rewardContainer)
                Destroy(child.gameObject);

            foreach (var reward in rewards)
            {
                if (!reward.ShowInUI) continue;
                var item = Instantiate(_rewardItemPrefab, _rewardContainer);
                var title = item.GetComponentInChildren<TMP_Text>();
                if (title != null)
                    title.text = $"{reward.DisplayName} x{reward.Quantity}";
                var icon = item.GetComponentInChildren<Image>();
                if (icon != null)
                    icon.sprite = reward.Icon;

                // Publish the reward event.
                EventBus.Instance.Publish(EventBus.EventType.RewardGranted, reward);
            }

            if (_rewardTitle != null)
                _rewardTitle.text = "Phase Complete!";

            _rewardPanel.SetActive(true);
            StartCoroutine(HideRewardPanelAfterDelay(3f));
        }

        // ─────────────────────────────────────────────────────────────────
        //  Phase Execution Router
        // ─────────────────────────────────────────────────────────────────
        private void ExecutePhase(int phaseIndex)
        {
            if (phaseIndex < 0 || phaseIndex >= _phases.Count) return;

            var phase = _phases[phaseIndex];
            SetupPhaseUI(phase);
            SetupPhaseEnvironment(phaseIndex);

            // Route to specific phase handler.
            switch (phase.PhaseId)
            {
                case "welcome":            Phase_Welcome(); break;
                case "avatar_intro":       Phase_AvatarIntro(); break;
                case "movement_demo":      Phase_MovementDemo(); break;
                case "interact_demo":      Phase_InteractDemo(); break;
                case "chat_demo":          Phase_ChatDemo(); break;
                case "room_demo":          Phase_RoomDemo(); break;
                case "minigame_demo":      Phase_MinigameDemo(); break;
                case "shop_intro":         Phase_ShopIntro(); break;
                case "daily_rewards_intro":Phase_DailyRewardsIntro(); break;
                case "final":              Phase_Final(); break;
                default:
                    // Generic phase — just show UI.
                    break;
            }

            // Auto-advance if configured.
            if (phase.AutoAdvanceTime > 0 && !phase.RequiresInteraction)
            {
                if (_autoAdvanceCoroutine != null)
                    StopCoroutine(_autoAdvanceCoroutine);
                _autoAdvanceCoroutine = StartCoroutine(AutoAdvanceAfterDelay(phase.AutoAdvanceTime));
            }
        }

        private void SetupPhaseUI(WizardPhase phase)
        {
            if (_phaseTitle != null)
                _phaseTitle.text = phase.Title;
            if (_phaseDescription != null)
                _phaseDescription.text = phase.Description;
            if (_phaseIllustration != null)
                _phaseIllustration.sprite = phase.Illustration;
        }

        private void UpdateProgressBar()
        {
            if (_progressBar != null && _phases.Count > 0)
                _progressBar.value = _currentPhase / (float)_phases.Count;
        }

        // ─────────────────────────────────────────────────────────────────
        //  Phase Handlers
        // ─────────────────────────────────────────────────────────────────
        private void Phase_Welcome()
        {
            Debug.Log("[FirstRunWizard] Phase: Welcome");
        }

        private void Phase_AvatarIntro()
        {
            Debug.Log("[FirstRunWizard] Phase: Avatar Intro");
        }

        private void Phase_MovementDemo()
        {
            Debug.Log("[FirstRunWizard] Phase: Movement Demo");
        }

        private void Phase_InteractDemo()
        {
            Debug.Log("[FirstRunWizard] Phase: Interact Demo");
        }

        private void Phase_ChatDemo()
        {
            Debug.Log("[FirstRunWizard] Phase: Chat Demo");
        }

        private void Phase_RoomDemo()
        {
            Debug.Log("[FirstRunWizard] Phase: Room Demo");
        }

        private void Phase_MinigameDemo()
        {
            Debug.Log("[FirstRunWizard] Phase: Minigame Demo");
        }

        private void Phase_ShopIntro()
        {
            Debug.Log("[FirstRunWizard] Phase: Shop Intro");
        }

        private void Phase_DailyRewardsIntro()
        {
            Debug.Log("[FirstRunWizard] Phase: Daily Rewards Intro");
        }

        private void Phase_Final()
        {
            Debug.Log("[FirstRunWizard] Phase: Final");
        }

        // ─────────────────────────────────────────────────────────────────
        //  Demo World Management
        // ─────────────────────────────────────────────────────────────────
        private void LoadDemoWorld()
        {
            if (string.IsNullOrEmpty(_demoSceneName)) return;
            if (!Application.CanStreamedLevelBeLoaded(_demoSceneName))
            {
                Debug.LogWarning($"[FirstRunWizard] Demo scene '{_demoSceneName}' not found in build.");
                return;
            }

            _sceneLoadOp = SceneManager.LoadSceneAsync(_demoSceneName, LoadSceneMode.Additive);
            if (_sceneLoadOp != null)
                _sceneLoadOp.allowSceneActivation = true;
        }

        private void UnloadDemoWorld()
        {
            if (!string.IsNullOrEmpty(_demoSceneName))
            {
                SceneManager.UnloadSceneAsync(_demoSceneName);
            }
        }

        private void SetupPhaseEnvironment(int phaseIndex)
        {
            if (phaseIndex < 0 || phaseIndex >= _phases.Count) return;
            var phase = _phases[phaseIndex];
            if (phase.DemoPrefab != null)
            {
                _currentDemoInstance = Instantiate(phase.DemoPrefab);
                _currentDemoInstance.name = $"Demo_{phase.PhaseId}";
            }
        }

        private void CleanupPhaseEnvironment(int phaseIndex)
        {
            if (_currentDemoInstance != null)
            {
                Destroy(_currentDemoInstance);
                _currentDemoInstance = null;
            }
        }

        private void CleanupAllPhaseEnvironments()
        {
            CleanupPhaseEnvironment(_currentPhase);
        }

        // ─────────────────────────────────────────────────────────────────
        //  Coroutines
        // ─────────────────────────────────────────────────────────────────
        private IEnumerator AutoAdvanceAfterDelay(float delay)
        {
            yield return new WaitForSeconds(delay);
            NextPhase();
        }

        private IEnumerator HideRewardPanelAfterDelay(float delay)
        {
            yield return new WaitForSeconds(delay);
            if (_rewardPanel != null)
                _rewardPanel.SetActive(false);
        }

        // ─────────────────────────────────────────────────────────────────
        //  Debug Helpers
        // ─────────────────────────────────────────────────────────────────
        /// <summary>
        /// Debug helper to start the wizard from the editor.
        /// </summary>
        [ContextMenu("Debug Start Wizard")]
        public void DebugStartWizard()
        {
            StartWizard();
        }

        /// <summary>
        /// Debug helper to skip to the last phase.
        /// </summary>
        [ContextMenu("Debug Jump To Final Phase")]
        public void DebugJumpToFinalPhase()
        {
            _currentPhase = Mathf.Max(0, _phases.Count - 1);
            ExecutePhase(_currentPhase);
        }
    }
}
