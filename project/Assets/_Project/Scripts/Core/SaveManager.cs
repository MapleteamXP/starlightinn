// ----------------------------------------------------------------------------
// KawaiiCool Island - Core Framework
// ----------------------------------------------------------------------------
// SaveManager.cs - JSON save/load with cloud sync hooks
// ----------------------------------------------------------------------------
// Handles all local persistence using JsonUtility and PlayerPrefs.
// Supports optional XOR encryption for sensitive data.
// Includes cloud sync integration stubs for PlayFab.
// Automatically discovers and manages all ISaveable objects.
// ----------------------------------------------------------------------------

using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using UnityEngine;

namespace KawaiiCoolIsland.Core
{
    /// <summary>
    /// Central manager for saving and loading game data.
    /// Uses JsonUtility for serialization and PlayerPrefs for storage.
    /// Supports encryption and cloud synchronization.
    /// </summary>
    public class SaveManager : Singleton<SaveManager>
    {
        #region Constants

        /// <summary>
        /// Prefix applied to all save keys to prevent PlayerPrefs collisions.
        /// </summary>
        private const string KEY_PREFIX = "KKI_";

        /// <summary>
        /// PlayerPrefs key for the save metadata index.
        /// </summary>
        private const string METADATA_KEY = KEY_PREFIX + "SaveMetadata";

        /// <summary>
        /// PlayerPrefs key for the encryption enabled flag.
        /// </summary>
        private const string ENCRYPTION_ENABLED_KEY = KEY_PREFIX + "EncryptionEnabled";

        /// <summary>
        /// PlayerPrefs key for storing the encryption key seed.
        /// </summary>
        private const string ENCRYPTION_SEED_KEY = KEY_PREFIX + "EncryptionSeed";

        #endregion

        #region Fields

        /// <summary>
        /// Whether encryption is enabled for sensitive save data.
        /// </summary>
        private bool _encryptionEnabled = true;

        /// <summary>
        /// The XOR encryption key derived from a persistent seed.
        /// </summary>
        private string _encryptionKey;

        /// <summary>
        /// Set of registered save keys for metadata tracking.
        /// </summary>
        private HashSet<string> _registeredKeys = new HashSet<string>();

        /// <summary>
        /// Whether a save operation is currently in progress.
        /// </summary>
        private bool _isSaving = false;

        /// <summary>
        /// Whether a load operation is currently in progress.
        /// </summary>
        private bool _isLoading = false;

        /// <summary>
        /// Whether a cloud sync is currently in progress.
        /// </summary>
        private bool _isCloudSyncing = false;

        #endregion

        #region Events

        /// <summary>
        /// Invoked when any individual save operation completes.
        /// </summary>
        public event Action<string> OnSaveKeyCompleted;

        /// <summary>
        /// Invoked when the full SaveAll operation completes.
        /// </summary>
        public event Action OnSaveCompleted;

        /// <summary>
        /// Invoked when the full LoadAll operation completes.
        /// </summary>
        public event Action OnLoadCompleted;

        /// <summary>
        /// Invoked when a cloud sync operation completes.
        /// Parameter is true if sync succeeded.
        /// </summary>
        public event Action<bool> OnCloudSyncCompleted;

        /// <summary>
        /// Invoked when a save/load error occurs.
        /// </summary>
        public event Action<string> OnError;

        #endregion

        #region Properties

        /// <summary>
        /// Whether a save operation is currently in progress.
        /// </summary>
        public bool IsSaving => _isSaving;

        /// <summary>
        /// Whether a load operation is currently in progress.
        /// </summary>
        public bool IsLoading => _isLoading;

        /// <summary>
        /// Whether a cloud sync is currently in progress.
        /// </summary>
        public bool IsCloudSyncing => _isCloudSyncing;

        /// <summary>
        /// Whether to encrypt sensitive save data. Defaults to true.
        /// </summary>
        public bool EncryptionEnabled
        {
            get => _encryptionEnabled;
            set
            {
                _encryptionEnabled = value;
                PlayerPrefs.SetInt(ENCRYPTION_ENABLED_KEY, value ? 1 : 0);
                PlayerPrefs.Save();
            }
        }

        #endregion

        #region Unity Lifecycle

        /// <summary>
        /// Called when the singleton awakes. Initializes encryption and loads metadata.
        /// </summary>
        protected override void OnSingletonAwake()
        {
            base.OnSingletonAwake();
            InitializeEncryption();
            LoadMetadata();
        }

        #endregion

        #region Save Operations

        /// <summary>
        /// Saves serializable data to PlayerPrefs as JSON.
        /// Optionally encrypts sensitive data if encryption is enabled.
        /// </summary>
        /// <typeparam name="T">The serializable data type.</typeparam>
        /// <param name="key">The unique save key.</param>
        /// <param name="data">The data object to serialize and save.</param>
        public void Save<T>(string key, T data) where T : class
        {
            if (string.IsNullOrEmpty(key))
            {
                LogError("Save key cannot be null or empty.");
                return;
            }

            if (data == null)
            {
                LogError($"Cannot save null data for key '{key}'.");
                return;
            }

            try
            {
                string json = JsonUtility.ToJson(data, prettyPrint: false);

                if (_encryptionEnabled)
                {
                    json = EncryptString(json);
                }

                string fullKey = KEY_PREFIX + key;
                PlayerPrefs.SetString(fullKey, json);
                PlayerPrefs.Save();

                _registeredKeys.Add(key);
                SaveMetadata();

                OnSaveKeyCompleted?.Invoke(key);

                Debug.Log($"[SaveManager] Saved '{key}' ({typeof(T).Name}).");
            }
            catch (Exception ex)
            {
                LogError($"Failed to save '{key}': {ex.Message}");
            }
        }

        /// <summary>
        /// Loads and deserializes data from PlayerPrefs.
        /// </summary>
        /// <typeparam name="T">The expected data type.</typeparam>
        /// <param name="key">The unique save key.</param>
        /// <returns>The deserialized data, or null if not found or on error.</returns>
        public T Load<T>(string key) where T : class
        {
            if (string.IsNullOrEmpty(key))
            {
                LogError("Load key cannot be null or empty.");
                return null;
            }

            string fullKey = KEY_PREFIX + key;

            if (!PlayerPrefs.HasKey(fullKey))
            {
                Debug.Log($"[SaveManager] No save data found for key '{key}'.");
                return null;
            }

            try
            {
                string json = PlayerPrefs.GetString(fullKey);

                if (_encryptionEnabled)
                {
                    json = DecryptString(json);
                }

                T data = JsonUtility.FromJson<T>(json);

                Debug.Log($"[SaveManager] Loaded '{key}' ({typeof(T).Name}).");
                return data;
            }
            catch (Exception ex)
            {
                LogError($"Failed to load '{key}': {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// Checks if a save key exists in PlayerPrefs.
        /// </summary>
        /// <param name="key">The save key to check.</param>
        /// <returns>True if the key exists.</returns>
        public bool HasKey(string key)
        {
            if (string.IsNullOrEmpty(key)) return false;
            return PlayerPrefs.HasKey(KEY_PREFIX + key);
        }

        /// <summary>
        /// Deletes a save key from PlayerPrefs.
        /// </summary>
        /// <param name="key">The save key to delete.</param>
        public void Delete(string key)
        {
            if (string.IsNullOrEmpty(key)) return;

            string fullKey = KEY_PREFIX + key;
            if (PlayerPrefs.HasKey(fullKey))
            {
                PlayerPrefs.DeleteKey(fullKey);
                _registeredKeys.Remove(key);
                SaveMetadata();
                Debug.Log($"[SaveManager] Deleted save key '{key}'.");
            }
        }

        /// <summary>
        /// Deletes all save data managed by this SaveManager.
        /// Use with caution - primarily for player-initiated data reset.
        /// </summary>
        public void DeleteAll()
        {
            var keysToDelete = new List<string>(_registeredKeys);
            foreach (var key in keysToDelete)
            {
                PlayerPrefs.DeleteKey(KEY_PREFIX + key);
            }

            PlayerPrefs.DeleteKey(METADATA_KEY);
            PlayerPrefs.DeleteKey(ENCRYPTION_ENABLED_KEY);
            PlayerPrefs.DeleteKey(ENCRYPTION_SEED_KEY);

            _registeredKeys.Clear();
            PlayerPrefs.Save();

            Debug.Log("[SaveManager] All save data deleted.");
        }

        #endregion

        #region Bulk Operations

        /// <summary>
        /// Finds all active ISaveable objects and triggers their OnSave method.
        /// </summary>
        public void SaveAll()
        {
            if (_isSaving)
            {
                Debug.LogWarning("[SaveManager] SaveAll already in progress. Ignoring duplicate call.");
                return;
            }

            _isSaving = true;
            int saveCount = 0;

            try
            {
                // Find all MonoBehaviours implementing ISaveable
                var saveables = FindObjectsByType<MonoBehaviour>(FindObjectsSortMode.None)
                    .OfType<ISaveable>();

                foreach (var saveable in saveables)
                {
                    try
                    {
                        saveable.OnSave(this);
                        _registeredKeys.Add(saveable.SaveKey);
                        saveCount++;
                    }
                    catch (Exception ex)
                    {
                        LogError($"Error saving '{saveable.SaveKey}': {ex.Message}");
                    }
                }

                SaveMetadata();
                Debug.Log($"[SaveManager] SaveAll complete. {saveCount} object(s) saved.");
            }
            catch (Exception ex)
            {
                LogError($"SaveAll failed: {ex.Message}");
            }
            finally
            {
                _isSaving = false;
                OnSaveCompleted?.Invoke();
            }
        }

        /// <summary>
        /// Finds all active ISaveable objects and triggers their OnLoad method.
        /// </summary>
        public void LoadAll()
        {
            if (_isLoading)
            {
                Debug.LogWarning("[SaveManager] LoadAll already in progress. Ignoring duplicate call.");
                return;
            }

            _isLoading = true;
            int loadCount = 0;

            try
            {
                var saveables = FindObjectsByType<MonoBehaviour>(FindObjectsSortMode.None)
                    .OfType<ISaveable>();

                foreach (var saveable in saveables)
                {
                    try
                    {
                        saveable.OnLoad(this);
                        loadCount++;
                    }
                    catch (Exception ex)
                    {
                        LogError($"Error loading '{saveable.SaveKey}': {ex.Message}");
                    }
                }

                Debug.Log($"[SaveManager] LoadAll complete. {loadCount} object(s) loaded.");
            }
            catch (Exception ex)
            {
                LogError($"LoadAll failed: {ex.Message}");
            }
            finally
            {
                _isLoading = false;
                OnLoadCompleted?.Invoke();
            }
        }

        /// <summary>
        /// Initiates a cloud sync with the backend service.
        /// Stubs are provided for PlayFab integration.
        /// </summary>
        public void CloudSync()
        {
            if (_isCloudSyncing)
            {
                Debug.LogWarning("[SaveManager] Cloud sync already in progress.");
                return;
            }

            _isCloudSyncing = true;
            Debug.Log("[SaveManager] Starting cloud sync...");

            // First, save everything locally
            SaveAll();

            // Then sync to cloud
            StartCoroutine(CloudSyncCoroutine());
        }

        /// <summary>
        /// Coroutine handling the cloud sync operation.
        /// </summary>
        private IEnumerator CloudSyncCoroutine()
        {
#if PLAYFAB
            yield return StartCoroutine(PlayFabCloudSync());
#else
            Debug.Log("[SaveManager] Cloud sync stub - PlayFab not integrated. Simulating success.");
            yield return new WaitForSeconds(0.5f);
#endif

            _isCloudSyncing = false;
            OnCloudSyncCompleted?.Invoke(true);
            Debug.Log("[SaveManager] Cloud sync complete.");
        }

#if PLAYFAB
        /// <summary>
        /// PlayFab-specific cloud sync implementation.
        /// Requires the PlayFab SDK to be imported.
        /// </summary>
        private IEnumerator PlayFabCloudSync()
        {
            bool syncComplete = false;
            bool syncSuccess = false;

            // Collect all save data
            var saveData = new Dictionary<string, string>();
            foreach (var key in _registeredKeys)
            {
                string fullKey = KEY_PREFIX + key;
                if (PlayerPrefs.HasKey(fullKey))
                {
                    saveData[key] = PlayerPrefs.GetString(fullKey);
                }
            }

            // Upload to PlayFab
            var request = new PlayFab.ClientModels.UpdateUserDataRequest
            {
                Data = saveData,
                Permission = PlayFab.ClientModels.UserDataPermission.Private
            };

            PlayFab.PlayFabClientAPI.UpdateUserData(request,
                result =>
                {
                    syncSuccess = true;
                    syncComplete = true;
                    Debug.Log("[SaveManager] PlayFab cloud save successful.");
                },
                error =>
                {
                    syncSuccess = false;
                    syncComplete = true;
                    LogError($"PlayFab cloud save failed: {error.ErrorMessage}");
                });

            // Wait for async operation
            while (!syncComplete)
            {
                yield return null;
            }

            OnCloudSyncCompleted?.Invoke(syncSuccess);
        }
#endif

        #endregion

        #region Encryption

        /// <summary>
        /// Initializes the encryption system. Generates a persistent key if one doesn't exist.
        /// </summary>
        private void InitializeEncryption()
        {
            _encryptionEnabled = PlayerPrefs.GetInt(ENCRYPTION_ENABLED_KEY, 1) == 1;

            if (PlayerPrefs.HasKey(ENCRYPTION_SEED_KEY))
            {
                string seed = PlayerPrefs.GetString(ENCRYPTION_SEED_KEY);
                _encryptionKey = DeriveKey(seed);
            }
            else
            {
                // Generate a new seed
                string seed = Guid.NewGuid().ToString("N");
                PlayerPrefs.SetString(ENCRYPTION_SEED_KEY, seed);
                PlayerPrefs.Save();
                _encryptionKey = DeriveKey(seed);
            }
        }

        /// <summary>
        /// Derives an encryption key from a seed string.
        /// </summary>
        /// <param name="seed">The seed value.</param>
        /// <returns>A derived key string.</returns>
        private string DeriveKey(string seed)
        {
            // Simple key derivation - in production, consider using a proper KDF
            byte[] bytes = Encoding.UTF8.GetBytes(seed);
            byte[] key = new byte[32];
            for (int i = 0; i < key.Length; i++)
            {
                key[i] = bytes[i % bytes.Length];
            }
            return Convert.ToBase64String(key);
        }

        /// <summary>
        /// Encrypts a string using XOR with the derived key.
        /// </summary>
        /// <param name="input">The plain text to encrypt.</param>
        /// <returns>Base64-encoded encrypted string.</returns>
        private string EncryptString(string input)
        {
            if (string.IsNullOrEmpty(input)) return input;

            byte[] inputBytes = Encoding.UTF8.GetBytes(input);
            byte[] keyBytes = Convert.FromBase64String(_encryptionKey);

            for (int i = 0; i < inputBytes.Length; i++)
            {
                inputBytes[i] ^= keyBytes[i % keyBytes.Length];
            }

            return Convert.ToBase64String(inputBytes);
        }

        /// <summary>
        /// Decrypts a string using XOR with the derived key.
        /// </summary>
        /// <param name="input">The Base64-encoded encrypted string.</param>
        /// <returns>The decrypted plain text.</returns>
        private string DecryptString(string input)
        {
            if (string.IsNullOrEmpty(input)) return input;

            try
            {
                byte[] inputBytes = Convert.FromBase64String(input);
                byte[] keyBytes = Convert.FromBase64String(_encryptionKey);

                for (int i = 0; i < inputBytes.Length; i++)
                {
                    inputBytes[i] ^= keyBytes[i % keyBytes.Length];
                }

                return Encoding.UTF8.GetString(inputBytes);
            }
            catch
            {
                // If decryption fails, data may be unencrypted or corrupted
                Debug.LogWarning("[SaveManager] Decryption failed - data may be unencrypted.");
                return input;
            }
        }

        #endregion

        #region Metadata

        /// <summary>
        /// Serializable container for save metadata.
        /// </summary>
        [Serializable]
        private class SaveMetadata
        {
            /// <summary>
            /// List of all registered save keys.
            /// </summary>
            public List<string> Keys = new List<string>();

            /// <summary>
            /// Timestamp of the last successful save operation.
            /// </summary>
            public string LastSaveTimestamp;
        }

        /// <summary>
        /// Saves the metadata index containing all registered keys.
        /// </summary>
        private void SaveMetadata()
        {
            var metadata = new SaveMetadata
            {
                Keys = new List<string>(_registeredKeys),
                LastSaveTimestamp = DateTime.UtcNow.ToString("O")
            };

            string json = JsonUtility.ToJson(metadata);
            PlayerPrefs.SetString(METADATA_KEY, json);
        }

        /// <summary>
        /// Loads the metadata index and restores the registered keys set.
        /// </summary>
        private void LoadMetadata()
        {
            if (!PlayerPrefs.HasKey(METADATA_KEY)) return;

            try
            {
                string json = PlayerPrefs.GetString(METADATA_KEY);
                var metadata = JsonUtility.FromJson<SaveMetadata>(json);
                if (metadata?.Keys != null)
                {
                    _registeredKeys = new HashSet<string>(metadata.Keys);
                }
            }
            catch (Exception ex)
            {
                LogError($"Failed to load save metadata: {ex.Message}");
                _registeredKeys = new HashSet<string>();
            }
        }

        #endregion

        #region Utility

        /// <summary>
        /// Logs an error message and invokes the OnError event.
        /// </summary>
        /// <param name="message">The error message.</param>
        private void LogError(string message)
        {
            string formatted = $"[SaveManager] {message}";
            Debug.LogError(formatted);
            OnError?.Invoke(message);
        }

        /// <summary>
        /// Gets a list of all registered save keys.
        /// </summary>
        /// <returns>Array of save key strings.</returns>
        public string[] GetAllSaveKeys()
        {
            return _registeredKeys.ToArray();
        }

        /// <summary>
        /// Gets the timestamp of the last save operation.
        /// </summary>
        /// <returns>UTC DateTime of last save, or DateTime.MinValue if unknown.</returns>
        public DateTime GetLastSaveTime()
        {
            if (!PlayerPrefs.HasKey(METADATA_KEY))
                return DateTime.MinValue;

            try
            {
                string json = PlayerPrefs.GetString(METADATA_KEY);
                var metadata = JsonUtility.FromJson<SaveMetadata>(json);
                if (!string.IsNullOrEmpty(metadata?.LastSaveTimestamp))
                {
                    return DateTime.Parse(metadata.LastSaveTimestamp);
                }
            }
            catch { /* ignored */ }

            return DateTime.MinValue;
        }

        #endregion

        #region Editor

#if UNITY_EDITOR

        /// <summary>
        /// Editor helper to inspect all save data in PlayerPrefs.
        /// </summary>
        [ContextMenu("Log All Save Keys")]
        private void EditorLogAllKeys()
        {
            Debug.Log("=== SaveManager Registered Keys ===");
            foreach (var key in _registeredKeys)
            {
                string fullKey = KEY_PREFIX + key;
                bool exists = PlayerPrefs.HasKey(fullKey);
                Debug.Log($"  [{exists}] {key}");
            }
            Debug.Log($"Total: {_registeredKeys.Count} key(s)");
        }

        /// <summary>
        /// Editor helper to clear all save data.
        /// </summary>
        [ContextMenu("Clear All Save Data")]
        private void EditorClearAllData()
        {
            if (UnityEditor.EditorUtility.DisplayDialog(
                "Clear All Save Data",
                "Are you sure you want to delete all save data? This cannot be undone.",
                "Delete",
                "Cancel"))
            {
                DeleteAll();
            }
        }

#endif

        #endregion
    }
}
