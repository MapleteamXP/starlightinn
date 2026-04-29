using System;
using System.Collections;
using UnityEngine;
using UnityEngine.SceneManagement;
using Unity.Netcode;

namespace KawaiiCoolIsland.Multiplayer
{
    /// <summary>
    /// Handles scene transitions in a networked context using NGO's
    /// <see cref="NetworkSceneManager"/>. Supports both single-scene swaps
    /// (Hub, Island) and additive minigame loading. Displays a
    /// <see cref="LoadingScreen"/> while scenes are in-flight.
    /// </summary>
    /// <remarks>
    /// Only the host/server may initiate scene loads in NGO; this wrapper
    /// enforces that rule and provides client-safe helpers.
    /// </remarks>
    public class NetworkSceneLoader : Singleton<NetworkSceneLoader>
    {
        // ------------------------------------------------------------------
        // Inspector
        // ------------------------------------------------------------------

        [Header("UI")]
        [Tooltip("Loading-screen overlay shown during transitions.")]
        public LoadingScreen LoadingScreen;

        [Header("Timing")]
        [Tooltip("Seconds of artificial minimum display time so the loading screen doesn't flash.")]
        public float MinLoadingDisplayTime = 1.5f;

        // ------------------------------------------------------------------
        // Private state
        // ------------------------------------------------------------------

        /// <summary>Whether a scene transition is currently in progress.</summary>
        private bool _isLoading;

        /// <summary>Progress 0..1 of the current load operation.</summary>
        private float _loadingProgress;

        /// <summary>Name of the scene we are currently loading.</summary>
        private string _targetSceneName;

        /// <summary>Callback invoked after the new scene has finished loading.</summary>
        private Action _onLoadComplete;

        // ------------------------------------------------------------------
        // Properties
        // ------------------------------------------------------------------

        /// <summary><c>true</c> while any scene load operation is active.</summary>
        public bool IsLoading => _isLoading;

        /// <summary>Current load progress in [0,1].</summary>
        public float LoadingProgress => _loadingProgress;

        /// <summary>The name of the scene currently being loaded, or <c>null</c> if idle.</summary>
        public string TargetSceneName => _targetSceneName;

        // ------------------------------------------------------------------
        // Lifecycle
        // ------------------------------------------------------------------

        private void OnEnable()
        {
            if (NetworkManager.Singleton != null && NetworkManager.Singleton.SceneManager != null)
            {
                NetworkManager.Singleton.SceneManager.OnLoadComplete      += OnNetworkLoadComplete;
                NetworkManager.Singleton.SceneManager.OnUnloadComplete    += OnNetworkUnloadComplete;
                NetworkManager.Singleton.SceneManager.OnLoadEventCompleted += OnLoadEventCompleted;
            }
        }

        private void OnDisable()
        {
            if (NetworkManager.Singleton != null && NetworkManager.Singleton.SceneManager != null)
            {
                NetworkManager.Singleton.SceneManager.OnLoadComplete      -= OnNetworkLoadComplete;
                NetworkManager.Singleton.SceneManager.OnUnloadComplete    -= OnNetworkUnloadComplete;
                NetworkManager.Singleton.SceneManager.OnLoadEventCompleted -= OnLoadEventCompleted;
            }
        }

        // ------------------------------------------------------------------
        // Public API
        // ------------------------------------------------------------------

        /// <summary>
        /// Loads a scene. If called on the host, uses NGO's
        /// <see cref="NetworkSceneManager"/> to synchronise all clients.
        /// If called on a standalone client, falls back to local
        /// <see cref="SceneManager.LoadScene"/>.
        /// </summary>
        /// <param name="sceneName">Build-index scene name.</param>
        /// <param name="mode">Single or additive.</param>
        public void LoadScene(string sceneName, LoadSceneMode mode = LoadSceneMode.Single)
        {
            if (_isLoading)
            {
                Debug.LogWarning($"[{nameof(NetworkSceneLoader)}] Scene load already in progress ('{_targetSceneName}'). Ignoring '{sceneName}'.");
                return;
            }

            _isLoading = true;
            _loadingProgress = 0f;
            _targetSceneName = sceneName;

            if (LoadingScreen != null)
                LoadingScreen.Show();

            if (KawaiiNetworkManager.Instance != null && KawaiiNetworkManager.Instance.IsHost)
            {
                // Server-driven load: all clients follow automatically
                NetworkManager.Singleton.SceneManager.LoadScene(sceneName, mode);
                // Progress is updated via NGO callbacks
            }
            else if (KawaiiNetworkManager.Instance != null && KawaiiNetworkManager.Instance.IsConnected)
            {
                // Client: wait for server-driven scene change; show loading screen
                StartCoroutine(ClientWaitForSceneCoroutine(sceneName));
            }
            else
            {
                // Offline / not networked
                StartCoroutine(LoadSceneCoroutine(sceneName, mode));
            }
        }

        /// <summary>
        /// Loads a minigame scene additively on top of the current scene.
        /// All connected clients will synchronise.
        /// </summary>
        /// <param name="minigameId">Short identifier appended to <see cref="NetworkConstants.SCENE_MINIGAME_PREFIX"/>.</param>
        public void LoadMinigameScene(string minigameId)
        {
            string sceneName = NetworkConstants.SCENE_MINIGAME_PREFIX + minigameId;
            LoadScene(sceneName, LoadSceneMode.Additive);
        }

        /// <summary>
        /// Returns every client to the public Hub scene (single mode).
        /// </summary>
        public void ReturnToHub()
        {
            LoadScene(NetworkConstants.SCENE_HUB, LoadSceneMode.Single);
        }

        /// <summary>
        /// Returns every client to the private Island scene (single mode).
        /// </summary>
        public void ReturnToIsland()
        {
            LoadScene(NetworkConstants.SCENE_ISLAND, LoadSceneMode.Single);
        }

        /// <summary>
        /// Unloads an additively loaded minigame scene. Host only.
        /// </summary>
        /// <param name="minigameId">Same identifier used in <see cref="LoadMinigameScene"/>.</param>
        public void UnloadMinigameScene(string minigameId)
        {
            if (!KawaiiNetworkManager.Instance.IsHost) return;

            string sceneName = NetworkConstants.SCENE_MINIGAME_PREFIX + minigameId;
            NetworkManager.Singleton.SceneManager.UnloadScene(
                SceneManager.GetSceneByName(sceneName));
        }

        /// <summary>
        /// Returns the current load progress in [0,1].
        /// </summary>
        public float GetLoadingProgress()
        {
            return _loadingProgress;
        }

        // ------------------------------------------------------------------
        // Coroutines
        // ------------------------------------------------------------------

        /// <summary>
        /// Local (offline) scene-load coroutine that drives the loading screen
        /// and falls back when NGO is not active.
        /// </summary>
        private IEnumerator LoadSceneCoroutine(string sceneName, LoadSceneMode mode)
        {
            AsyncOperation op = SceneManager.LoadSceneAsync(sceneName, mode);
            op.allowSceneActivation = false;

            float startTime = Time.time;

            while (op.progress < 0.9f)
            {
                _loadingProgress = op.progress / 0.9f;
                LoadingScreen?.SetProgress(_loadingProgress);
                yield return null;
            }

            _loadingProgress = 1f;
            LoadingScreen?.SetProgress(1f);

            // Minimum display time so the screen doesn't flash
            float elapsed = Time.time - startTime;
            if (elapsed < MinLoadingDisplayTime)
                yield return new WaitForSeconds(MinLoadingDisplayTime - elapsed);

            op.allowSceneActivation = true;

            yield return null; // let scene activate

            _isLoading = false;
            LoadingScreen?.Hide();
            _onLoadComplete?.Invoke();
        }

        /// <summary>
        /// Coroutine used by clients while waiting for the host to drive
        /// the scene change via <see cref="NetworkSceneManager"/>.
        /// </summary>
        private IEnumerator ClientWaitForSceneCoroutine(string sceneName)
        {
            float startTime = Time.time;
            float fakeProgress = 0f;

            // Animate progress bar while waiting for NGO to synchronise
            while (_isLoading && SceneManager.GetActiveScene().name != sceneName)
            {
                fakeProgress = Mathf.MoveTowards(fakeProgress, 0.95f, Time.deltaTime * 0.3f);
                _loadingProgress = fakeProgress;
                LoadingScreen?.SetProgress(fakeProgress);
                yield return null;
            }

            _loadingProgress = 1f;
            LoadingScreen?.SetProgress(1f);

            float elapsed = Time.time - startTime;
            if (elapsed < MinLoadingDisplayTime)
                yield return new WaitForSeconds(MinLoadingDisplayTime - elapsed);

            _isLoading = false;
            LoadingScreen?.Hide();
            _onLoadComplete?.Invoke();
        }

        // ------------------------------------------------------------------
        // NGO scene callbacks
        // ------------------------------------------------------------------

        /// <summary>
        /// Fired on the server when a single client has finished loading.
        /// </summary>
        private void OnNetworkLoadComplete(ulong clientId, string sceneName, LoadSceneMode loadSceneMode)
        {
            Debug.Log(
                $"[{nameof(NetworkSceneLoader)}] Client {clientId} finished loading '{sceneName}' ({loadSceneMode}).");
        }

        /// <summary>
        /// Fired on the server when a scene has been unloaded for a client.
        /// </summary>
        private void OnNetworkUnloadComplete(ulong clientId, string sceneName)
        {
            Debug.Log(
                $"[{nameof(NetworkSceneLoader)}] Client {clientId} unloaded '{sceneName}'.");
        }

        /// <summary>
        /// Fired on the server when <b>all</b> clients have finished loading.
        /// We use this to dismiss the loading screen on the host.
        /// </summary>
        private void OnLoadEventCompleted(string sceneName, LoadSceneMode loadSceneMode,
            List<ulong> clientsCompleted, List<ulong> clientsTimedOut)
        {
            Debug.Log(
                $"[{nameof(NetworkSceneLoader)}] Scene '{sceneName}' load event completed. " +
                $"Completed: {clientsCompleted.Count}, Timed out: {clientsTimedOut.Count}");

            if (clientsTimedOut.Count > 0)
            {
                Debug.LogWarning(
                    $"[{nameof(NetworkSceneLoader)}] Clients timed out during scene load: " +
                    string.Join(", ", clientsTimedOut));
            }

            StartCoroutine(FinishLoadingCoroutine());
        }

        /// <summary>
        /// Finalises the loading sequence after all clients have confirmed.
        /// </summary>
        private IEnumerator FinishLoadingCoroutine()
        {
            _loadingProgress = 1f;
            LoadingScreen?.SetProgress(1f);
            yield return new WaitForSeconds(0.5f);
            _isLoading = false;
            LoadingScreen?.Hide();
            _onLoadComplete?.Invoke();
        }

        // ------------------------------------------------------------------
        // Events
        // ------------------------------------------------------------------

        /// <summary>
        /// Fired locally when a scene load operation fully completes and the
        /// loading screen has been dismissed.
        /// </summary>
        public event Action OnLoadComplete
        {
            add    => _onLoadComplete += value;
            remove => _onLoadComplete -= value;
        }
    }
}
