// ----------------------------------------------------------------------------
// KawaiiCool Island - Core Framework
// ----------------------------------------------------------------------------
// Bootstrapper.cs - Scene initialization and manager loading
// ----------------------------------------------------------------------------
// Handles the initial game boot sequence using RuntimeInitializeOnLoadMethod.
// Ensures all core managers are loaded in the correct order before any
// gameplay code executes. Supports both automatic boot and manual scene-based boot.
// ----------------------------------------------------------------------------

using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace KawaiiCoolIsland.Core
{
    /// <summary>
    /// Defines the initialization priority for core systems.
    /// Lower values initialize first.
    /// </summary>
    public enum InitPriority
    {
        /// <summary>Lowest priority - initializes last.</summary>
        Low = 100,

        /// <summary>Normal priority for most systems.</summary>
        Normal = 50,

        /// <summary>High priority for core dependency systems.</summary>
        High = 10,

        /// <summary>Critical priority - initializes first (EventBus, SaveManager).</summary>
        Critical = 0
    }

    /// <summary>
    /// Attribute marking a MonoBehaviour that should be auto-instantiated during boot.
    /// The marked class must have a parameterless constructor path via AddComponent.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class, Inherited = false, AllowMultiple = false)]
    public class AutoInitAttribute : Attribute
    {
        /// <summary>
        /// The initialization priority. Lower values initialize first.
        /// </summary>
        public InitPriority Priority { get; }

        /// <summary>
        /// Optional name for the manager GameObject.
        /// </summary>
        public string GameObjectName { get; }

        /// <summary>
        /// Whether this manager should persist across scene loads.
        /// </summary>
        public bool PersistAcrossScenes { get; }

        /// <summary>
        /// Marks a MonoBehaviour for automatic initialization during boot.
        /// </summary>
        /// <param name="priority">Initialization order priority.</param>
        /// <param name="gameObjectName">Optional custom GameObject name.</param>
        /// <param name="persist">Whether to persist across scenes.</param>
        public AutoInitAttribute(
            InitPriority priority = InitPriority.Normal,
            string gameObjectName = null,
            bool persist = true
        )
        {
            Priority = priority;
            GameObjectName = gameObjectName;
            PersistAcrossScenes = persist;
        }
    }

    /// <summary>
    /// Central bootstrapper that initializes all core game systems on startup.
    /// Uses RuntimeInitializeOnLoadMethod for automatic execution before scene loading.
    /// </summary>
    public class Bootstrapper : MonoBehaviour
    {
        #region Constants

        /// <summary>
        /// The name of the root GameObject that holds all manager singletons.
        /// </summary>
        private const string MANAGER_ROOT_NAME = "[Managers]";

        /// <summary>
        /// Name of the boot splash/logic scene.
        /// </summary>
        private const string BOOT_SCENE_NAME = "Boot";

        /// <summary>
        /// Name of the main menu scene to load after boot.
        /// </summary>
        private const string MAIN_MENU_SCENE_NAME = "MainMenu";

        #endregion

        #region Fields

        /// <summary>
        /// The root transform under which all managers are parented.
        /// </summary>
        private static Transform _managerRoot;

        /// <summary>
        /// Whether the boot sequence has completed.
        /// </summary>
        private static bool _isBooted = false;

        /// <summary>
        /// List of initialization errors encountered during boot.
        /// </summary>
        private static readonly List<string> _bootErrors = new List<string>();

        /// <summary>
        /// Progress callback for boot operations (0.0 to 1.0).
        /// </summary>
        private static float _bootProgress = 0f;

        #endregion

        #region Events

        /// <summary>
        /// Invoked when the boot sequence starts.
        /// </summary>
        public static event Action OnBootStarted;

        /// <summary>
        /// Invoked when boot progress updates. Parameter is normalized progress (0-1).
        /// </summary>
        public static event Action<float> OnBootProgress;

        /// <summary>
        /// Invoked when the boot sequence completes successfully.
        /// </summary>
        public static event Action OnBootCompleted;

        /// <summary>
        /// Invoked when the boot sequence fails. Parameter is the error message.
        /// </summary>
        public static event Action<string> OnBootFailed;

        /// <summary>
        /// Invoked when a specific manager is initialized. Parameter is the manager type name.
        /// </summary>
        public static event Action<string> OnManagerInitialized;

        #endregion

        #region Properties

        /// <summary>
        /// Whether the boot sequence has completed successfully.
        /// </summary>
        public static bool IsBooted => _isBooted;

        /// <summary>
        /// Current boot progress (0.0 to 1.0).
        /// </summary>
        public static float BootProgress => _bootProgress;

        /// <summary>
        /// Array of errors encountered during boot.
        /// </summary>
        public static IReadOnlyList<string> BootErrors => _bootErrors;

        /// <summary>
        /// Whether any errors occurred during boot.
        /// </summary>
        public static bool HasBootErrors => _bootErrors.Count > 0;

        #endregion

        #region Runtime Initialization

        /// <summary>
        /// Unity runtime initialization hook. Called before the first scene loads.
        /// This is the entry point of the game's initialization sequence.
        /// </summary>
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void Initialize()
        {
            Debug.Log("[Bootstrapper] ============================== ");
            Debug.Log("[Bootstrapper] KawaiiCool Island Boot Started");
            Debug.Log("[Bootstrapper] ============================== ");

            _bootErrors.Clear();
            _bootProgress = 0f;
            _isBooted = false;

            // Create the manager root
            GameObject rootGO = new GameObject(MANAGER_ROOT_NAME);
            _managerRoot = rootGO.transform;
            DontDestroyOnLoad(rootGO);

            // Register for scene loading events
            SceneManager.sceneLoaded += OnSceneLoaded;

            // Start the boot sequence
            var bootRunner = rootGO.AddComponent<Bootstrapper>();
            bootRunner.StartCoroutine(bootRunner.RunBootSequence());
        }

        #endregion

        #region Boot Sequence

        /// <summary>
        /// The main boot sequence coroutine. Initializes all core managers in order.
        /// </summary>
        private IEnumerator RunBootSequence()
        {
            OnBootStarted?.Invoke();

            float totalSteps = 6f;
            float currentStep = 0f;

            // Step 1: Initialize EventBus (Critical - other systems depend on it)
            yield return InitializeManager<EventBus>(InitPriority.Critical, "EventBus");
            currentStep++;
            _bootProgress = currentStep / totalSteps;
            OnBootProgress?.Invoke(_bootProgress);

            // Step 2: Initialize SaveManager (Critical - handles persistence)
            yield return InitializeManager<SaveManager>(InitPriority.Critical, "SaveManager");
            currentStep++;
            _bootProgress = currentStep / totalSteps;
            OnBootProgress?.Invoke(_bootProgress);

            // Step 3: Initialize GameManager (High - central state)
            yield return InitializeManager<GameManager>(InitPriority.High, "GameManager");
            currentStep++;
            _bootProgress = currentStep / totalSteps;
            OnBootProgress?.Invoke(_bootProgress);

            // Step 4: Auto-discover and initialize other [AutoInit] managers
            yield return AutoDiscoverManagers();
            currentStep++;
            _bootProgress = currentStep / totalSteps;
            OnBootProgress?.Invoke(_bootProgress);

            // Step 5: Initialize extended social, room, camera, discovery, and party systems
            yield return InitializeExtendedSystems();
            currentStep++;
            _bootProgress = currentStep / totalSteps;
            OnBootProgress?.Invoke(_bootProgress);

            // Step 6: Post-initialization - load saved state, validate systems
            yield return PostInitialization();
            currentStep++;
            _bootProgress = 1f;
            OnBootProgress?.Invoke(_bootProgress);

            // Mark boot complete
            _isBooted = true;

            if (_bootErrors.Count > 0)
            {
                string errorSummary = string.Join("\n", _bootErrors);
                Debug.LogWarning($"[Bootstrapper] Boot completed with {_bootErrors.Count} error(s):\n{errorSummary}");
                OnBootFailed?.Invoke(errorSummary);
            }
            else
            {
                Debug.Log("[Bootstrapper] Boot completed successfully!");
                OnBootCompleted?.Invoke();
            }

            // Transition to initial scene if we're in the boot scene
            string currentScene = SceneManager.GetActiveScene().name;
            if (currentScene == BOOT_SCENE_NAME || currentScene == "Bootstrap")
            {
                yield return TransitionToMainMenu();
            }
        }

        /// <summary>
        /// Creates and initializes a specific manager singleton.
        /// </summary>
        /// <typeparam name="T">The manager type to initialize.</typeparam>
        /// <param name="priority">Initialization priority.</param>
        /// <param name="name">Display name for logging.</param>
        /// <returns>IEnumerator for coroutine.</returns>
        private IEnumerator InitializeManager<T>(InitPriority priority, string name) where T : MonoBehaviour
        {
            Debug.Log($"[Bootstrapper] [{priority}] Initializing {name}...");

            try
            {
                // Check if already exists in scene
                T existing = FindFirstObjectByType<T>();
                if (existing != null)
                {
                    existing.transform.SetParent(_managerRoot);
                    Debug.Log($"[Bootstrapper] {name} already in scene - reparented.");
                }
                else
                {
                    GameObject managerGO = new GameObject($"[Manager] {name}");
                    managerGO.transform.SetParent(_managerRoot);
                    T manager = managerGO.AddComponent<T>();

                    if (manager == null)
                    {
                        throw new InvalidOperationException($"Failed to add {name} component.");
                    }
                }

                // Give the manager a frame to Awake
                yield return null;

                OnManagerInitialized?.Invoke(name);
                Debug.Log($"[Bootstrapper] {name} initialized successfully.");
            }
            catch (Exception ex)
            {
                string error = $"Failed to initialize {name}: {ex.Message}";
                _bootErrors.Add(error);
                Debug.LogError($"[Bootstrapper] {error}");
            }
        }

        /// <summary>
        /// Auto-discovers MonoBehaviours with [AutoInit] attribute and initializes them.
        /// </summary>
        private IEnumerator AutoDiscoverManagers()
        {
            Debug.Log("[Bootstrapper] Auto-discovering managers...");

            var discoveredManagers = new List<(Type type, AutoInitAttribute attr)>();

            // Find all types in the current assembly with AutoInitAttribute
            var assemblies = System.AppDomain.CurrentDomain.GetAssemblies();
            foreach (var assembly in assemblies)
            {
                try
                {
                    var types = assembly.GetTypes();
                    foreach (var type in types)
                    {
                        if (!type.IsClass || type.IsAbstract) continue;
                        if (!typeof(MonoBehaviour).IsAssignableFrom(type)) continue;

                        var attr = type.GetCustomAttributes(typeof(AutoInitAttribute), inherit: false);
                        if (attr.Length > 0)
                        {
                            discoveredManagers.Add((type, (AutoInitAttribute)attr[0]));
                        }
                    }
                }
                catch (Exception ex)
                {
                    Debug.LogWarning($"[Bootstrapper] Error scanning assembly {assembly.FullName}: {ex.Message}");
                }
            }

            // Sort by priority
            discoveredManagers.Sort((a, b) => a.attr.Priority.CompareTo(b.attr.Priority));

            Debug.Log($"[Bootstrapper] Found {discoveredManagers.Count} auto-init managers.");

            // Initialize each discovered manager
            foreach (var (type, attr) in discoveredManagers)
            {
                string managerName = attr.GameObjectName ?? type.Name;

                try
                {
                    // Check if already initialized (e.g., explicit init above)
                    var existing = FindFirstObjectByType(type);
                    if (existing != null)
                    {
                        Debug.Log($"[Bootstrapper] [{attr.Priority}] {managerName} already initialized - skipping.");
                        continue;
                    }

                    GameObject managerGO = new GameObject($"[Manager] {managerName}");
                    managerGO.transform.SetParent(_managerRoot);
                    var manager = managerGO.AddComponent(type);

                    if (manager == null)
                    {
                        throw new InvalidOperationException($"Failed to add {type.Name} component.");
                    }

                    if (attr.PersistAcrossScenes)
                    {
                        DontDestroyOnLoad(managerGO);
                    }

                    yield return null;

                    OnManagerInitialized?.Invoke(managerName);
                    Debug.Log($"[Bootstrapper] [{attr.Priority}] {managerName} initialized.");
                }
                catch (Exception ex)
                {
                    string error = $"Failed to auto-init {managerName}: {ex.Message}";
                    _bootErrors.Add(error);
                    Debug.LogError($"[Bootstrapper] {error}");
                }
            }
        }

        /// <summary>
        /// Post-initialization tasks: load saved state, validate systems.
        /// </summary>
        private IEnumerator PostInitialization()
        {
            Debug.Log("[Bootstrapper] Running post-initialization...");

            // Load GameManager state
            if (GameManager.HasInstance)
            {
                GameManager.Instance.LoadState();
                yield return null;
            }

            // Any additional post-init can go here
            // - Preload assets
            // - Validate data integrity
            // - Connect to services

            yield return null;
        }

        /// <summary>
        /// Initializes all extended social, interaction, room, camera, discovery, and party systems.
        /// Called during the boot sequence after auto-discovery of [AutoInit] managers.
        /// </summary>
        private IEnumerator InitializeExtendedSystems()
        {
            Debug.Log("[Bootstrapper] Initializing extended systems...");

            try
            {
                // Social systems
                SocialGraphManager.Initialize();
                yield return null;
                PlayerProfileManager.Initialize();
                yield return null;
                PresenceManager.Initialize();
                yield return null;
                RelationshipManager.Initialize();
                yield return null;
                SocialFeedManager.Initialize();
                yield return null;
                BadgeManager.Initialize();
                yield return null;

                // Interaction systems
                PlayerSelector.Initialize();
                yield return null;
                InteractionMenu.Initialize();
                yield return null;
                ProfileViewer.Initialize();
                yield return null;

                // Room systems
                RoomBrowser.Initialize();
                yield return null;
                RoomNavigator.Initialize();
                yield return null;
                RoomInstanceManager.Initialize();
                yield return null;

                // Camera systems
                WorldCameraController.Initialize();
                yield return null;
                ZoomController.Initialize();
                yield return null;

                // Discovery systems
                ActivityFeedManager.Initialize();
                yield return null;
                EventCalendar.Initialize();
                yield return null;
                TrendingRooms.Initialize();
                yield return null;
                NotificationHub.Initialize();
                yield return null;

                // Party systems
                PartyManager.Initialize();
                yield return null;
                GatheringManager.Initialize();
                yield return null;
                InviteSystem.Initialize();
                yield return null;

                Debug.Log("[Bootstrapper] Extended systems initialized successfully.");
            }
            catch (Exception ex)
            {
                string error = $"Failed to initialize extended systems: {ex.Message}";
                _bootErrors.Add(error);
                Debug.LogError($"[Bootstrapper] {error}");
            }
        }

        #endregion

        #region Scene Management

        /// <summary>
        /// Transitions from boot scene to the main menu scene.
        /// </summary>
        private IEnumerator TransitionToMainMenu()
        {
            Debug.Log($"[Bootstrapper] Transitioning to '{MAIN_MENU_SCENE_NAME}'...");

            // Check if the scene exists in build settings
            int sceneCount = SceneManager.sceneCountInBuildSettings;
            bool sceneFound = false;
            for (int i = 0; i < sceneCount; i++)
            {
                string scenePath = SceneUtility.GetScenePathByBuildIndex(i);
                string sceneName = System.IO.Path.GetFileNameWithoutExtension(scenePath);
                if (sceneName == MAIN_MENU_SCENE_NAME)
                {
                    sceneFound = true;
                    break;
                }
            }

            if (!sceneFound)
            {
                Debug.LogWarning(
                    $"[Bootstrapper] Scene '{MAIN_MENU_SCENE_NAME}' not found in build settings. " +
                    "Staying in current scene. Add the scene to File > Build Settings."
                );
                yield break;
            }

            // Load the main menu scene
            AsyncOperation loadOp = SceneManager.LoadSceneAsync(MAIN_MENU_SCENE_NAME, LoadSceneMode.Single);
            if (loadOp != null)
            {
                while (!loadOp.isDone)
                {
                    Debug.Log($"[Bootstrapper] Loading progress: {loadOp.progress:P0}");
                    yield return null;
                }
            }

            Debug.Log($"[Bootstrapper] Scene '{MAIN_MENU_SCENE_NAME}' loaded.");
        }

        /// <summary>
        /// Called when a scene finishes loading. Handles manager persistence.
        /// </summary>
        /// <param name="scene">The loaded scene.</param>
        /// <param name="mode">The load mode.</param>
        private static void OnSceneLoaded(Scene scene, LoadSceneMode mode)
        {
            Debug.Log($"[Bootstrapper] Scene loaded: {scene.name} (mode: {mode})");

            // Ensure manager root is still valid
            if (_managerRoot == null)
            {
                Debug.LogWarning("[Bootstrapper] Manager root was lost. Recreating...");
                GameObject rootGO = new GameObject(MANAGER_ROOT_NAME);
                _managerRoot = rootGO.transform;
                DontDestroyOnLoad(rootGO);
            }

            // After scene load, ensure singleton instances are still valid
            if (_isBooted)
            {
                ValidateSingletons();
            }
        }

        /// <summary>
        /// Validates that all core singletons are still alive after scene transition.
        /// </summary>
        private static void ValidateSingletons()
        {
            // Singleton<T>.Instance auto-creates if null, so we just verify access
            try
            {
                var eventBus = EventBus.Instance;
                var saveManager = SaveManager.Instance;
                var gameManager = GameManager.Instance;

                Debug.Log("[Bootstrapper] All singletons validated after scene load.");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[Bootstrapper] Singleton validation failed: {ex.Message}");
            }
        }

        #endregion

        #region Public API

        /// <summary>
        /// Manually triggers the boot sequence. Use this for scene-based boot (not auto-boot).
        /// </summary>
        public static void Boot()
        {
            if (_isBooted)
            {
                Debug.LogWarning("[Bootstrapper] Already booted. Ignoring duplicate Boot() call.");
                return;
            }

            var existingRunner = FindFirstObjectByType<Bootstrapper>();
            if (existingRunner != null)
            {
                Debug.LogWarning("[Bootstrapper] Boot sequence already running.");
                return;
            }

            // Find or create the manager root
            if (_managerRoot == null)
            {
                GameObject rootGO = new GameObject(MANAGER_ROOT_NAME);
                _managerRoot = rootGO.transform;
                DontDestroyOnLoad(rootGO);
            }

            GameObject runnerGO = new GameObject("[Bootstrapper Runner]");
            runnerGO.transform.SetParent(_managerRoot);
            var runner = runnerGO.AddComponent<Bootstrapper>();
            runner.StartCoroutine(runner.RunBootSequence());
        }

        /// <summary>
        /// Restarts the boot sequence. Useful for recovery after critical errors.
        /// </summary>
        public static void Reboot()
        {
            Debug.Log("[Bootstrapper] Rebooting...");
            _isBooted = false;
            _bootErrors.Clear();
            _bootProgress = 0f;
            Boot();
        }

        /// <summary>
        /// Creates the manager root container if it doesn't exist.
        /// Returns the root transform.
        /// </summary>
        /// <returns>The manager root transform.</returns>
        public static Transform EnsureManagerRoot()
        {
            if (_managerRoot == null)
            {
                GameObject rootGO = new GameObject(MANAGER_ROOT_NAME);
                _managerRoot = rootGO.transform;
                DontDestroyOnLoad(rootGO);
            }
            return _managerRoot;
        }

        #endregion

        #region Debug

#if UNITY_EDITOR

        /// <summary>
        /// Logs the current boot status for debugging.
        /// </summary>
        [ContextMenu("Log Boot Status")]
        private void EditorLogBootStatus()
        {
            Debug.Log("=== Bootstrapper Status ===");
            Debug.Log($"IsBooted: {_isBooted}");
            Debug.Log($"BootProgress: {_bootProgress:P0}");
            Debug.Log($"ManagerRoot: {_managerRoot?.name ?? "NULL"}");
            Debug.Log($"BootErrors: {_bootErrors.Count}");
            foreach (var error in _bootErrors)
            {
                Debug.Log($"  - {error}");
            }
            Debug.Log("===========================");
        }

#endif

        #endregion

        #region Cleanup

        /// <summary>
        /// Unregisters scene load event when this component is destroyed.
        /// </summary>
        private void OnDestroy()
        {
            SceneManager.sceneLoaded -= OnSceneLoaded;
        }

        #endregion
    }
}
