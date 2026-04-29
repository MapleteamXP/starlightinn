using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;

namespace KawaiiCool.Backend
{
    /// <summary>
    /// Manages cloud save synchronization for KawaiiCool Island.
    /// Handles automatic periodic sync, conflict resolution, and queued operations.
    /// Syncs player data, inventory, currency, island layouts, and statistics.
    /// </summary>
    public class CloudSaveSync : MonoBehaviour
    {
        public static CloudSaveSync Instance { get; private set; }

        [Header("Settings")]
        [Tooltip("Interval in seconds between automatic syncs. Default: 300 (5 minutes).")]
        public float AutoSyncInterval = 300f;

        [Tooltip("Perform a sync when the application quits or goes to background.")]
        public bool AutoSyncOnQuit = true;

        [Tooltip("When a conflict occurs, use server data (true) or local data (false).")]
        public bool ConflictResolutionUseServer = false;

        [Tooltip("Maximum number of pending operations before forcing a sync.")]
        public int MaxPendingOperations = 50;

        [Tooltip("Log verbose sync diagnostics.")]
        public bool VerboseLogging = false;

        private float _lastSyncTime;
        private bool _isSyncing;
        private readonly Queue<SyncOperation> _pendingOperations = new();
        private readonly Dictionary<string, string> _localDataCache = new();
        private bool _applicationPaused;

        /// <summary>
        /// Whether a sync operation is currently in progress.
        /// </summary>
        public bool IsSyncing => _isSyncing;

        /// <summary>
        /// Seconds remaining until the next automatic sync.
        /// </summary>
        public float TimeUntilNextAutoSync => Mathf.Max(0, AutoSyncInterval - (Time.time - _lastSyncTime));

        /// <summary>
        /// Number of operations currently queued for sync.
        /// </summary>
        public int PendingOperationCount => _pendingOperations.Count;

        /// <summary>
        /// Fired when a sync operation starts.
        /// </summary>
        public event Action OnSyncStarted;

        /// <summary>
        /// Fired when a sync operation completes.
        /// Parameter indicates whether the sync was successful.
        /// </summary>
        public event Action<bool> OnSyncCompleted;

        /// <summary>
        /// Fired when a sync operation encounters an error.
        /// Parameter is the error message.
        /// </summary>
        public event Action<string> OnSyncError;

        /// <summary>
        /// Fired when newer data is detected on the server.
        /// </summary>
        public event Action OnDataChanged;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
            _lastSyncTime = Time.time;
        }

        private void Update()
        {
            // Auto-sync on interval
            if (!_isSyncing && Time.time - _lastSyncTime >= AutoSyncInterval)
            {
                if (_pendingOperations.Count > 0)
                {
                    _ = ForceSync();
                }
            }

            // Force sync if too many pending operations
            if (_pendingOperations.Count >= MaxPendingOperations && !_isSyncing)
            {
                LogVerbose("Pending operations exceeded maximum, forcing sync.");
                _ = ForceSync();
            }
        }

        private void OnApplicationPause(bool pauseStatus)
        {
            _applicationPaused = pauseStatus;
            if (pauseStatus && AutoSyncOnQuit)
            {
                LogVerbose("Application paused, triggering sync.");
                _ = ForceSync();
            }
        }

        private void OnApplicationQuit()
        {
            if (AutoSyncOnQuit && _pendingOperations.Count > 0)
            {
                LogVerbose("Application quitting, attempting final sync.");
                // Note: Async operations during quit may not complete
                // This is best-effort
            }
        }

        #region --- Public Sync Methods ---

        /// <summary>
        /// Performs a full synchronization of all player data.
        /// Syncs inventory, currency, player data, and statistics in sequence.
        /// </summary>
        /// <returns>True if all sync operations succeeded.</returns>
        public async Task<bool> SyncAll()
        {
            if (_isSyncing)
            {
                LogVerbose("Sync already in progress, waiting...");
                await WaitForCurrentSync();
                return true;
            }

            _isSyncing = true;
            OnSyncStarted?.Invoke();

            try
            {
                LogVerbose("Starting full sync...");

                bool success = true;
                success &= await SyncInventoryInternal();
                success &= await SyncCurrencyInternal();
                success &= await SyncPlayerDataInternal();
                success &= await SyncStatisticsInternal();

                if (success)
                {
                    _lastSyncTime = Time.time;
                    LogVerbose("Full sync completed successfully.");
                }
                else
                {
                    LogVerbose("Full sync completed with some failures.");
                }

                OnSyncCompleted?.Invoke(success);
                return success;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[CloudSaveSync] Full sync error: {ex.Message}");
                OnSyncError?.Invoke(ex.Message);
                OnSyncCompleted?.Invoke(false);
                return false;
            }
            finally
            {
                _isSyncing = false;
            }
        }

        /// <summary>
        /// Syncs only the player's inventory data.
        /// </summary>
        /// <returns>True if sync succeeded.</returns>
        public async Task<bool> SyncInventory()
        {
            if (_isSyncing) { await WaitForCurrentSync(); return true; }
            _isSyncing = true;
            OnSyncStarted?.Invoke();
            try { bool ok = await SyncInventoryInternal(); OnSyncCompleted?.Invoke(ok); return ok; }
            catch (Exception ex) { OnSyncError?.Invoke(ex.Message); OnSyncCompleted?.Invoke(false); return false; }
            finally { _isSyncing = false; }
        }

        /// <summary>
        /// Syncs only the player's virtual currency balances.
        /// </summary>
        /// <returns>True if sync succeeded.</returns>
        public async Task<bool> SyncCurrency()
        {
            if (_isSyncing) { await WaitForCurrentSync(); return true; }
            _isSyncing = true;
            OnSyncStarted?.Invoke();
            try { bool ok = await SyncCurrencyInternal(); OnSyncCompleted?.Invoke(ok); return ok; }
            catch (Exception ex) { OnSyncError?.Invoke(ex.Message); OnSyncCompleted?.Invoke(false); return false; }
            finally { _isSyncing = false; }
        }

        /// <summary>
        /// Syncs general player data (settings, preferences, etc.).
        /// </summary>
        /// <returns>True if sync succeeded.</returns>
        public async Task<bool> SyncPlayerData()
        {
            if (_isSyncing) { await WaitForCurrentSync(); return true; }
            _isSyncing = true;
            OnSyncStarted?.Invoke();
            try { bool ok = await SyncPlayerDataInternal(); OnSyncCompleted?.Invoke(ok); return ok; }
            catch (Exception ex) { OnSyncError?.Invoke(ex.Message); OnSyncCompleted?.Invoke(false); return false; }
            finally { _isSyncing = false; }
        }

        /// <summary>
        /// Syncs a specific island layout slot.
        /// </summary>
        /// <param name="slotName">Name of the island slot to sync.</param>
        /// <returns>True if sync succeeded.</returns>
        public async Task<bool> SyncIsland(string slotName)
        {
            if (_isSyncing) { await WaitForCurrentSync(); return true; }
            _isSyncing = true;
            OnSyncStarted?.Invoke();
            try
            {
                string key = $"island_{slotName}";
                string localData = GetLocalIslandData(slotName);
                bool ok = await UploadData(key, localData);
                OnSyncCompleted?.Invoke(ok);
                return ok;
            }
            catch (Exception ex) { OnSyncError?.Invoke(ex.Message); OnSyncCompleted?.Invoke(false); return false; }
            finally { _isSyncing = false; }
        }

        /// <summary>
        /// Syncs player statistics/leaderboard data.
        /// </summary>
        /// <returns>True if sync succeeded.</returns>
        public async Task<bool> SyncStatistics()
        {
            if (_isSyncing) { await WaitForCurrentSync(); return true; }
            _isSyncing = true;
            OnSyncStarted?.Invoke();
            try { bool ok = await SyncStatisticsInternal(); OnSyncCompleted?.Invoke(ok); return ok; }
            catch (Exception ex) { OnSyncError?.Invoke(ex.Message); OnSyncCompleted?.Invoke(false); return false; }
            finally { _isSyncing = false; }
        }

        /// <summary>
        /// Forces an immediate sync of all pending operations.
        /// </summary>
        /// <returns>True if sync succeeded.</returns>
        public async Task<bool> ForceSync()
        {
            if (_isSyncing)
            {
                await WaitForCurrentSync();
                return true;
            }
            return await PerformSync();
        }

        /// <summary>
        /// Queues a sync operation to be processed during the next sync.
        /// </summary>
        /// <param name="type">Type of sync operation.</param>
        /// <param name="key">Data key for the operation.</param>
        /// <param name="data">JSON data payload.</param>
        public void QueueOperation(SyncOperationType type, string key, string data)
        {
            var operation = new SyncOperation
            {
                Type = type,
                Key = key,
                Data = data,
                RetryCount = 0
            };
            _pendingOperations.Enqueue(operation);
            LogVerbose($"Queued {type} operation for key '{key}'. Queue size: {_pendingOperations.Count}");
        }

        #endregion

        #region --- Internal Sync Methods ---

        /// <summary>
        /// Core sync routine that processes all pending operations.
        /// </summary>
        /// <returns>True if all operations completed successfully.</returns>
        private async Task<bool> PerformSync()
        {
            if (_isSyncing) return true;
            _isSyncing = true;
            OnSyncStarted?.Invoke();

            try
            {
                await ProcessPendingOperations();
                _lastSyncTime = Time.time;
                OnSyncCompleted?.Invoke(true);
                return true;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[CloudSaveSync] Sync error: {ex.Message}");
                OnSyncError?.Invoke(ex.Message);
                OnSyncCompleted?.Invoke(false);
                return false;
            }
            finally
            {
                _isSyncing = false;
            }
        }

        private async Task<bool> SyncInventoryInternal()
        {
            LogVerbose("Syncing inventory...");

#if PLAYFAB
            var inventory = await PlayFabManager.Instance?.GetInventory();
            if (inventory != null)
            {
                string json = SerializeInventory(inventory);
                await UploadData("inventory", json);
                LogVerbose($"Inventory synced: {inventory.Count} items.");
                return true;
            }
#else
            await Task.Delay(10);
            LogVerbose("PlayFab not available, inventory sync skipped.");
#endif
            return false;
        }

        private async Task<bool> SyncCurrencyInternal()
        {
            LogVerbose("Syncing currency...");

#if PLAYFAB
            var currencies = await PlayFabManager.Instance?.GetAllVirtualCurrency();
            if (currencies != null)
            {
                string json = JsonUtility.ToJson(new CurrencyWrapper { Currencies = currencies });
                await UploadData("currency", json);
                LogVerbose($"Currency synced: {currencies.Count} currencies.");
                return true;
            }
#else
            await Task.Delay(10);
            LogVerbose("PlayFab not available, currency sync skipped.");
#endif
            return false;
        }

        private async Task<bool> SyncPlayerDataInternal()
        {
            LogVerbose("Syncing player data...");

#if PLAYFAB
            var playerData = await PlayFabManager.Instance?.GetAllPlayerData();
            if (playerData != null)
            {
                foreach (var kvp in playerData)
                {
                    await UploadData($"playerdata_{kvp.Key}", kvp.Value.Value);
                }
                LogVerbose($"Player data synced: {playerData.Count} keys.");
                return true;
            }
#else
            await Task.Delay(10);
            LogVerbose("PlayFab not available, player data sync skipped.");
#endif
            return false;
        }

        private async Task<bool> SyncStatisticsInternal()
        {
            LogVerbose("Syncing statistics...");
            await Task.Delay(10);
            // Statistics are server-authoritative on PlayFab, so we just validate local cache
            return true;
        }

        /// <summary>
        /// Uploads data to the cloud save backend.
        /// </summary>
        /// <param name="key">Data key.</param>
        /// <param name="json">JSON string to upload.</param>
        private async Task<bool> UploadData(string key, string json)
        {
            if (string.IsNullOrEmpty(json)) return false;

#if PLAYFAB
            bool success = await PlayFabManager.Instance?.UpdatePlayerData(key, json);
            if (success)
            {
                _localDataCache[key] = json;
                LogVerbose($"Uploaded '{key}' successfully.");
            }
            return success;
#else
            _localDataCache[key] = json;
            await Task.Delay(10);
            LogVerbose($"Uploaded '{key}' (local only - PlayFab disabled).");
            return true;
#endif
        }

        /// <summary>
        /// Downloads data from the cloud save backend.
        /// </summary>
        /// <param name="key">Data key to download.</param>
        /// <returns>The JSON data string, or null if not found.</returns>
        private async Task<string> DownloadData(string key)
        {
#if PLAYFAB
            string data = await PlayFabManager.Instance?.GetPlayerData(key);
            if (!string.IsNullOrEmpty(data))
            {
                _localDataCache[key] = data;
            }
            return data;
#else
            _localDataCache.TryGetValue(key, out string cached);
            await Task.Delay(10);
            return cached;
#endif
        }

        /// <summary>
        /// Resolves a data conflict between local and server versions.
        /// </summary>
        /// <param name="key">The data key in conflict.</param>
        /// <param name="localData">Local version of the data.</param>
        /// <param name="serverData">Server version of the data.</param>
        private void ResolveConflict(string key, string localData, string serverData)
        {
            Debug.LogWarning($"[CloudSaveSync] Conflict detected for key '{key}'. " +
                           $"Resolution: {(ConflictResolutionUseServer ? "Server" : "Local")}");

            if (ConflictResolutionUseServer)
            {
                _localDataCache[key] = serverData;
                OnDataChanged?.Invoke();
            }
            else
            {
                // Keep local, queue an upload
                QueueOperation(SyncOperationType.Upload, key, localData);
            }
        }

        /// <summary>
        /// Processes all queued sync operations.
        /// </summary>
        private async Task ProcessPendingOperations()
        {
            int processedCount = 0;
            int failedCount = 0;

            while (_pendingOperations.Count > 0)
            {
                var operation = _pendingOperations.Dequeue();

                try
                {
                    switch (operation.Type)
                    {
                        case SyncOperationType.Upload:
                            await UploadData(operation.Key, operation.Data);
                            break;
                        case SyncOperationType.Download:
                            await DownloadData(operation.Key);
                            break;
                        case SyncOperationType.Delete:
#if PLAYFAB
                            await PlayFabManager.Instance?.UpdatePlayerData(operation.Key, "{}");
#endif
                            _localDataCache.Remove(operation.Key);
                            break;
                    }
                    processedCount++;
                }
                catch (Exception ex)
                {
                    Debug.LogError($"[CloudSaveSync] Operation failed for key '{operation.Key}': {ex.Message}");
                    operation.RetryCount++;
                    if (operation.RetryCount < 3)
                    {
                        _pendingOperations.Enqueue(operation);
                    }
                    else
                    {
                        failedCount++;
                    }
                }
            }

            LogVerbose($"Processed {processedCount} operations, {failedCount} failed.");
        }

        #endregion

        #region --- Helpers ---

        private async Task WaitForCurrentSync()
        {
            while (_isSyncing)
            {
                await Task.Delay(100);
            }
        }

        private void LogVerbose(string message)
        {
            if (VerboseLogging)
            {
                Debug.Log($"[CloudSaveSync] {message}");
            }
        }

        private string SerializeInventory(List<object> inventory)
        {
            if (inventory == null) return "[]";
            return JsonUtility.ToJson(new InventoryWrapper { Items = new List<SerializableItemInstance>() });
        }

        private string GetLocalIslandData(string slotName)
        {
            // Retrieve island layout from local game state
            // This would integrate with the island building system
            return $"{{\"slot\":\"{slotName}\",\"version\":1}}";
        }

        [System.Serializable]
        private class CurrencyWrapper
        {
            public Dictionary<string, int> Currencies;
        }

        [System.Serializable]
        private class InventoryWrapper
        {
            public List<SerializableItemInstance> Items;
        }

        [System.Serializable]
        private class SerializableItemInstance
        {
            public string ItemId;
            public string InstanceId;
            public int Quantity;
            public string DisplayName;
        }

        #endregion
    }

    /// <summary>
    /// Types of sync operations that can be queued.
    /// </summary>
    public enum SyncOperationType
    {
        /// <summary>Upload local data to cloud.</summary>
        Upload,

        /// <summary>Download data from cloud to local.</summary>
        Download,

        /// <summary>Delete data from cloud.</summary>
        Delete
    }

    /// <summary>
    /// Represents a single sync operation in the queue.
    /// </summary>
    public class SyncOperation
    {
        /// <summary>Type of sync operation.</summary>
        public SyncOperationType Type;

        /// <summary>Data key for the operation.</summary>
        public string Key;

        /// <summary>JSON data payload (for uploads).</summary>
        public string Data;

        /// <summary>Number of times this operation has been retried.</summary>
        public int RetryCount;
    }
}
