using System;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using UnityEngine.SceneManagement;

namespace KawaiiCoolIsland.Rooms
{
    /// <summary>
    /// Manages room transitions including loading screens, scene changes,
    /// fade effects, and room initialization for KawaiiCool Island v2.0.
    /// </summary>
    public class RoomInstanceManager : Singleton<RoomInstanceManager>
    {
        #region Loading UI

        [Header("Loading")]
        /// <summary>Root GameObject of the loading screen overlay.</summary>
        public GameObject LoadingScreen;

        /// <summary>Progress bar slider for load progress feedback.</summary>
        public Slider LoadingProgressBar;

        /// <summary>Text label for loading status messages.</summary>
        public TMP_Text LoadingText;

        /// <summary>Minimum time the loading screen remains visible for perceived smoothness.</summary>
        public float MinLoadingTime = 1.5f;

        #endregion

        #region Transitions

        [Header("Transitions")]
        /// <summary>Duration of the fade-in effect when a room loads.</summary>
        public float FadeInDuration = 0.5f;

        /// <summary>Duration of the fade-out effect when leaving a room.</summary>
        public float FadeOutDuration = 0.3f;

        /// <summary>Optional full-screen fade overlay image.</summary>
        public Image FadeOverlay;

        #endregion

        #region Internal State

        /// <summary>Information about the room the player is currently in.</summary>
        private RoomInfo _currentRoom;

        /// <summary>Information about the room the player is transitioning into.</summary>
        private RoomInfo _targetRoom;

        /// <summary>Whether a room transition is currently in progress.</summary>
        private bool _isTransitioning;

        /// <summary>Cached coroutine reference for the active transition.</summary>
        private Coroutine _activeTransition;

        /// <summary>Default scene to load when exiting to hub.</summary>
        private const string HubSceneName = "HubScene";

        /// <summary>Default scene to load when exiting to home.</summary>
        private const string HomeSceneName = "HomeScene";

        #endregion

        #region Public Properties

        /// <summary>Information about the room the player is currently in, or null if at hub/home.</summary>
        public RoomInfo CurrentRoom => _currentRoom;

        /// <summary>True if a room transition is currently in progress.</summary>
        public bool IsTransitioning => _isTransitioning;

        #endregion

        #region Events

        /// <summary>Raised when the player successfully enters a room.</summary>
        public new event Action<RoomInfo> OnRoomEntered;

        /// <summary>Raised when the player leaves a room.</summary>
        public event Action OnRoomExited;

        /// <summary>Raised periodically during loading with progress 0 to 1.</summary>
        public event Action<float> OnLoadingProgress;

        /// <summary>Raised when the loading screen is shown.</summary>
        public event Action OnLoadingStarted;

        /// <summary>Raised when the loading screen is hidden.</summary>
        public event Action OnLoadingFinished;

        /// <summary>Raised when the fade overlay begins a transition.</summary>
        public event Action OnFadeStarted;

        /// <summary>Raised when the fade overlay completes.</summary>
        public event Action OnFadeComplete;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            if (LoadingScreen != null)
                LoadingScreen.SetActive(false);

            if (FadeOverlay != null)
            {
                Color c = FadeOverlay.color;
                c.a = 0f;
                FadeOverlay.color = c;
                FadeOverlay.gameObject.SetActive(false);
            }
        }

        private void OnEnable()
        {
            EventBus.Subscribe<RoomEnterRequestedEvent>(OnRoomEnterRequested);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<RoomEnterRequestedEvent>(OnRoomEnterRequested);
        }

        #endregion

        #region Room Entry

        /// <summary>
        /// Initiates entry into a room using its <see cref="RoomInfo"/>.
        /// </summary>
        /// <param name="room">The room to enter.</param>
        public void EnterRoom(RoomInfo room)
        {
            if (room == null)
            {
                Debug.LogWarning("[RoomInstanceManager] Cannot enter null room.");
                return;
            }

            if (_isTransitioning)
            {
                Debug.LogWarning("[RoomInstanceManager] Transition already in progress. Ignoring request.");
                return;
            }

            _targetRoom = room;
            _activeTransition = StartCoroutine(RoomTransitionCoroutine(room));
        }

        /// <summary>
        /// Initiates entry into a room by its unique identifier.
        /// Resolves the room info from <see cref="RoomBrowser"/> before transitioning.
        /// </summary>
        /// <param name="roomId">The room ID to enter.</param>
        public void EnterRoom(string roomId)
        {
            RoomInfo room = RoomBrowser.Instance?.AllRooms.FirstOrDefault(r => r.RoomId == roomId);
            if (room == null)
            {
                Debug.LogWarning($"[RoomInstanceManager] Room not found for entry: {roomId}");
                return;
            }

            EnterRoom(room);
        }

        /// <summary>
        /// Exits the current room and returns to the central hub.
        /// </summary>
        public void ExitToHub()
        {
            if (_isTransitioning)
                return;

            _activeTransition = StartCoroutine(ExitTransitionCoroutine(HubSceneName, true));
        }

        /// <summary>
        /// Exits the current room and returns to the player's home room.
        /// </summary>
        public void ExitToHome()
        {
            if (_isTransitioning)
                return;

            _activeTransition = StartCoroutine(ExitTransitionCoroutine(HomeSceneName, false));
        }

        /// <summary>
        /// Reloads the scene of the current room.
        /// </summary>
        public void ReloadCurrentRoom()
        {
            if (_currentRoom == null)
            {
                Debug.LogWarning("[RoomInstanceManager] No current room to reload.");
                return;
            }

            EnterRoom(_currentRoom);
        }

        #endregion

        #region Transition Coroutines

        /// <summary>
        /// Full room entry transition: fade out, load scene, initialize room, fade in.
        /// </summary>
        private IEnumerator RoomTransitionCoroutine(RoomInfo room)
        {
            _isTransitioning = true;
            OnFadeStarted?.Invoke();

            // Fade out
            if (FadeOverlay != null)
                yield return StartCoroutine(FadeOverlayCoroutine(0f, 1f, FadeOutDuration));

            // Show loading screen
            ShowLoadingScreen($"Loading {room.RoomName}...");
            OnLoadingStarted?.Invoke();

            // Unload current room
            if (_currentRoom != null)
            {
                OnRoomUnloaded();
                yield return null;
            }

            // Load room scene
            yield return StartCoroutine(LoadRoomScene(ResolveSceneName(room)));

            // Initialize the room
            yield return StartCoroutine(InitializeRoom(room));

            // Minimum display time for smooth feel
            float elapsed = 0f;
            while (elapsed < MinLoadingTime)
            {
                elapsed += Time.deltaTime;
                yield return null;
            }

            // Hide loading
            HideLoadingScreen();
            OnLoadingFinished?.Invoke();

            // Fade in
            if (FadeOverlay != null)
                yield return StartCoroutine(FadeOverlayCoroutine(1f, 0f, FadeInDuration));

            OnFadeComplete?.Invoke();
            OnRoomLoaded();

            _currentRoom = room;
            _isTransitioning = false;
            _activeTransition = null;

            OnRoomEntered?.Invoke(room);
            EventBus.Publish(new RoomEnteredEvent { Room = room });
        }

        /// <summary>
        /// Exit transition: fade out, load destination scene, fade in.
        /// </summary>
        private IEnumerator ExitTransitionCoroutine(string sceneName, bool toHub)
        {
            _isTransitioning = true;
            OnFadeStarted?.Invoke();

            if (FadeOverlay != null)
                yield return StartCoroutine(FadeOverlayCoroutine(0f, 1f, FadeOutDuration));

            ShowLoadingScreen(toHub ? "Returning to Hub..." : "Going Home...");
            OnLoadingStarted?.Invoke();

            OnRoomUnloaded();
            _currentRoom = null;

            yield return StartCoroutine(LoadRoomScene(sceneName));

            float elapsed = 0f;
            while (elapsed < MinLoadingTime)
            {
                elapsed += Time.deltaTime;
                yield return null;
            }

            HideLoadingScreen();
            OnLoadingFinished?.Invoke();

            if (FadeOverlay != null)
                yield return StartCoroutine(FadeOverlayCoroutine(1f, 0f, FadeInDuration));

            OnFadeComplete?.Invoke();

            _isTransitioning = false;
            _activeTransition = null;

            OnRoomExited?.Invoke();
            EventBus.Publish(new RoomExitedEvent { ToHub = toHub });
        }

        /// <summary>
        /// Loads a room scene asynchronously with progress reporting.
        /// </summary>
        private IEnumerator LoadRoomScene(string sceneName)
        {
            if (string.IsNullOrEmpty(sceneName))
            {
                Debug.LogError("[RoomInstanceManager] Scene name is empty. Cannot load.");
                yield break;
            }

            AsyncOperation loadOp = SceneManager.LoadSceneAsync(sceneName);
            if (loadOp == null)
            {
                Debug.LogError($"[RoomInstanceManager] Failed to start scene load: {sceneName}");
                yield break;
            }

            loadOp.allowSceneActivation = false;

            while (loadOp.progress < 0.9f)
            {
                float progress = Mathf.Clamp01(loadOp.progress / 0.9f);
                UpdateLoadingProgress(progress, "Loading scene...");
                OnLoadingProgress?.Invoke(progress);
                yield return null;
            }

            UpdateLoadingProgress(0.95f, "Activating scene...");
            OnLoadingProgress?.Invoke(0.95f);

            loadOp.allowSceneActivation = true;

            while (!loadOp.isDone)
            {
                yield return null;
            }

            UpdateLoadingProgress(1f, "Done!");
            OnLoadingProgress?.Invoke(1f);
        }

        /// <summary>
        /// Initializes the room after the scene has loaded.
        /// Spawns player, connects networking, and sets up room state.
        /// </summary>
        private IEnumerator InitializeRoom(RoomInfo room)
        {
            UpdateLoadingProgress(1f, "Initializing room...");

            // Spawn player avatar
            EventBus.Publish(new PlayerSpawnRequestedEvent
            {
                RoomId = room.RoomId,
                SpawnTag = "RoomSpawn"
            });

            yield return null;

            // Connect to room networking
            EventBus.Publish(new RoomNetworkJoinRequestedEvent
            {
                RoomId = room.RoomId,
                RoomName = room.RoomName
            });

            yield return new WaitForSeconds(0.3f);

            // Sync room state from server
            EventBus.Publish(new RoomStateSyncRequestedEvent { RoomId = room.RoomId });

            yield return new WaitForSeconds(0.2f);

            // Finalize
            UpdateLoadingProgress(1f, "Welcome to " + room.RoomName);
        }

        /// <summary>
        /// Called after the room scene has fully loaded and faded in.
        /// </summary>
        private void OnRoomLoaded()
        {
            Debug.Log($"[RoomInstanceManager] Room loaded: {_targetRoom?.RoomName}");

            // Notify other systems
            if (_targetRoom != null)
            {
                EventBus.Publish(new RoomReadyEvent { Room = _targetRoom });
            }
        }

        /// <summary>
        /// Called when leaving a room before the scene unloads.
        /// </summary>
        private void OnRoomUnloaded()
        {
            if (_currentRoom != null)
            {
                EventBus.Publish(new RoomLeaveRequestedEvent { RoomId = _currentRoom.RoomId });
                Debug.Log($"[RoomInstanceManager] Leaving room: {_currentRoom.RoomName}");
            }
        }

        #endregion

        #region Fade Coroutine

        /// <summary>
        /// Animates the fade overlay alpha between two values.
        /// </summary>
        private IEnumerator FadeOverlayCoroutine(float fromAlpha, float toAlpha, float duration)
        {
            if (FadeOverlay == null)
                yield break;

            FadeOverlay.gameObject.SetActive(true);

            float elapsed = 0f;
            Color c = FadeOverlay.color;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                c.a = Mathf.Lerp(fromAlpha, toAlpha, t);
                FadeOverlay.color = c;
                yield return null;
            }

            c.a = toAlpha;
            FadeOverlay.color = c;

            if (toAlpha <= 0.01f)
                FadeOverlay.gameObject.SetActive(false);
        }

        #endregion

        #region Loading Screen Helpers

        /// <summary>
        /// Shows the loading screen with the given status message.
        /// </summary>
        private void ShowLoadingScreen(string message)
        {
            if (LoadingScreen != null)
                LoadingScreen.SetActive(true);

            UpdateLoadingProgress(0f, message);
        }

        /// <summary>
        /// Hides the loading screen.
        /// </summary>
        private void HideLoadingScreen()
        {
            if (LoadingScreen != null)
                LoadingScreen.SetActive(false);

            if (LoadingProgressBar != null)
                LoadingProgressBar.value = 0f;
        }

        /// <summary>
        /// Updates the loading progress bar and text.
        /// </summary>
        private void UpdateLoadingProgress(float progress, string message)
        {
            if (LoadingProgressBar != null)
                LoadingProgressBar.value = Mathf.Clamp01(progress);

            if (LoadingText != null && !string.IsNullOrEmpty(message))
                LoadingText.text = message;
        }

        #endregion

        #region Helpers

        /// <summary>
        /// Resolves the Unity scene name for a given room.
        /// </summary>
        private string ResolveSceneName(RoomInfo room)
        {
            if (room == null)
                return HubSceneName;

            // Prefer explicit scene mapping if available
            if (!string.IsNullOrEmpty(room.RoomId))
            {
                // Example convention: room_123 -> RoomScene_123
                return $"RoomScene_{room.RoomId}";
            }

            return HubSceneName;
        }

        #endregion

        #region EventBus Handlers

        private void OnRoomEnterRequested(RoomEnterRequestedEvent evt)
        {
            if (evt.Room != null)
                EnterRoom(evt.Room);
        }

        #endregion
    }

    #region EventBus Events

    /// <summary>
    /// Published when the player has fully entered and initialized a room.
    /// </summary>
    public struct RoomEnteredEvent
    {
        /// <summary>The room entered.</summary>
        public RoomInfo Room;
    }

    /// <summary>
    /// Published when the player exits a room.
    /// </summary>
    public struct RoomExitedEvent
    {
        /// <summary>True if exiting to the hub.</summary>
        public bool ToHub;
    }

    /// <summary>
    /// Published when a room is fully ready after initialization.
    /// </summary>
    public struct RoomReadyEvent
    {
        /// <summary>The room that is ready.</summary>
        public RoomInfo Room;
    }

    /// <summary>
    /// Published when the player requests to leave a room.
    /// </summary>
    public struct RoomLeaveRequestedEvent
    {
        /// <summary>The room ID being left.</summary>
        public string RoomId;
    }

    /// <summary>
    /// Published to request player avatar spawning.
    /// </summary>
    public struct PlayerSpawnRequestedEvent
    {
        /// <summary>The room to spawn in.</summary>
        public string RoomId;
        /// <summary>The spawn point tag.</summary>
        public string SpawnTag;
    }

    /// <summary>
    /// Published to request joining room networking.
    /// </summary>
    public struct RoomNetworkJoinRequestedEvent
    {
        /// <summary>The room ID.</summary>
        public string RoomId;
        /// <summary>The room display name.</summary>
        public string RoomName;
    }

    /// <summary>
    /// Published to request room state synchronization.
    /// </summary>
    public struct RoomStateSyncRequestedEvent
    {
        /// <summary>The room ID.</summary>
        public string RoomId;
    }

    #endregion
}
