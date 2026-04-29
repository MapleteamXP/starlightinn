using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using UnityEngine;
#if PLAYFAB
using PlayFab;
using PlayFab.ClientModels;
using PlayFab.CloudScriptModels;
#endif

namespace KawaiiCool.Backend
{
    /// <summary>
    /// Central manager for all PlayFab services in KawaiiCool Island.
    /// Handles authentication (via Firebase token, device ID, or email),
    /// player data (Cloud Save), economy (virtual currency, inventory, purchases),
    /// leaderboards, CloudScript execution, friends, and title data.
    /// All operations use async/await wrappers around PlayFab's callback-based API.
    /// </summary>
    public class PlayFabManager : MonoBehaviour
    {
        public static PlayFabManager Instance { get; private set; }

        #region --- Private Fields ---

#if PLAYFAB
        private string _playFabId;
        private string _sessionTicket;
        private EntityKey _entityKey;
#endif
        private bool _isLoggedIn;
        private string _cachedDisplayName;

#if PLAYFAB
        private readonly Dictionary<string, UserDataRecord> _userData = new();
        private readonly Dictionary<string, int> _virtualCurrency = new();
        private readonly List<ItemInstance> _inventory = new();
#endif

        #endregion

        #region --- Public Properties ---

        /// <summary>
        /// Whether the player is currently logged in to PlayFab.
        /// </summary>
        public bool IsLoggedIn => _isLoggedIn;

        /// <summary>
        /// The PlayFab ID of the currently logged in player.
        /// </summary>
        public string PlayFabId
        {
            get
            {
#if PLAYFAB
                return _playFabId;
#else
                return null;
#endif
            }
        }

        /// <summary>
        /// Display name of the currently logged in player.
        /// </summary>
        public string DisplayName => _cachedDisplayName;

        #endregion

        #region --- Configuration ---

        [Header("Settings")]
        [Tooltip("PlayFab Title ID from the Game Manager dashboard.")]
        public string TitleId = "YOUR_TITLE_ID";

        [Tooltip("Use PlayFab development mode settings.")]
        public bool UseDevelopmentMode = false;

        [Tooltip("Automatically sync currency and inventory after login.")]
        public bool AutoSyncOnLogin = true;

        [Tooltip("Enable detailed PlayFab API logging.")]
        public bool VerboseLogging = false;

        #endregion

        #region --- Events ---

        /// <summary>
        /// Fired when the player successfully logs in to PlayFab.
        /// </summary>
        public event Action OnLoggedIn;

        /// <summary>
        /// Fired when the player logs out.
        /// </summary>
        public event Action OnLoggedOut;

        /// <summary>
        /// Fired when a PlayFab API error occurs.
        /// </summary>
        public event Action<object> OnError;

        /// <summary>
        /// Fired when a virtual currency balance changes.
        /// Parameters: currency code, new balance.
        /// </summary>
        public event Action<string, int> OnCurrencyChanged;

        /// <summary>
        /// Fired when the player's inventory changes.
        /// </summary>
        public event Action OnInventoryChanged;

        #endregion

        #region --- Unity Lifecycle ---

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        #endregion

        #region --- Authentication ---

        /// <summary>
        /// Logs in to PlayFab using a Firebase authentication token.
        /// This is the recommended login method when Firebase Auth is used.
        /// </summary>
        /// <param name="firebaseToken">Firebase ID token.</param>
        /// <returns>True if login succeeded.</returns>
        public async Task<bool> LoginWithFirebase(string firebaseToken)
        {
            try
            {
#if PLAYFAB
                PlayFabSettings.TitleId = TitleId;
                var tcs = new TaskCompletionSource<bool>();

                var request = new LoginWithFirebaseRequest
                {
                    TitleId = TitleId,
                    FirebaseTicket = firebaseToken,
                    CreateAccount = true,
                    InfoRequestParameters = new GetPlayerCombinedInfoRequestParams
                    {
                        GetUserAccountInfo = true,
                        GetUserInventory = true,
                        GetUserVirtualCurrency = true,
                        GetPlayerProfile = true
                    }
                };

                PlayFabClientAPI.LoginWithFirebase(request, result =>
                {
                    _playFabId = result.PlayFabId;
                    _sessionTicket = result.SessionTicket;
                    _entityKey = result.EntityToken?.Entity;
                    _isLoggedIn = true;
                    _cachedDisplayName = result.InfoResultPayload?.AccountInfo?.TitleInfo?.DisplayName;

                    CachePlayerData(result.InfoResultPayload);
                    tcs.SetResult(true);
                    OnLoggedIn?.Invoke();
                    LogVerbose($"Logged in with Firebase. PlayFabId: {_playFabId}");
                }, error =>
                {
                    tcs.SetResult(false);
                    HandlePlayFabError(error);
                });

                return await tcs.Task;
#else
                await Task.Delay(1);
                _isLoggedIn = true;
                _cachedDisplayName = "MockPlayer";
                OnLoggedIn?.Invoke();
                return true;
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Firebase login failed: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Logs in to PlayFab using the device's unique identifier.
        /// Used for quick automatic login without credentials.
        /// </summary>
        /// <returns>True if login succeeded.</returns>
        public async Task<bool> LoginWithDeviceId()
        {
            try
            {
#if PLAYFAB
                PlayFabSettings.TitleId = TitleId;
                var tcs = new TaskCompletionSource<bool>();
                string deviceId = SystemInfo.deviceUniqueIdentifier;

                var request = new LoginWithAndroidDeviceIDRequest
                {
                    TitleId = TitleId,
                    AndroidDeviceId = deviceId,
                    AndroidDevice = SystemInfo.deviceModel,
                    OS = SystemInfo.operatingSystem,
                    CreateAccount = true,
                    InfoRequestParameters = new GetPlayerCombinedInfoRequestParams
                    {
                        GetUserInventory = true,
                        GetUserVirtualCurrency = true
                    }
                };

                PlayFabClientAPI.LoginWithAndroidDeviceID(request, result =>
                {
                    _playFabId = result.PlayFabId;
                    _sessionTicket = result.SessionTicket;
                    _entityKey = result.EntityToken?.Entity;
                    _isLoggedIn = true;
                    CachePlayerData(result.InfoResultPayload);
                    tcs.SetResult(true);
                    OnLoggedIn?.Invoke();
                    LogVerbose($"Logged in with Device ID. PlayFabId: {_playFabId}");
                }, error =>
                {
                    tcs.SetResult(false);
                    HandlePlayFabError(error);
                });

                return await tcs.Task;
#else
                await Task.Delay(1);
                _isLoggedIn = true;
                _cachedDisplayName = "MockDevicePlayer";
                OnLoggedIn?.Invoke();
                return true;
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Device ID login failed: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Logs in to PlayFab using email and password credentials.
        /// </summary>
        /// <param name="email">Player's email address.</param>
        /// <param name="password">Player's password.</param>
        /// <returns>True if login succeeded.</returns>
        public async Task<bool> LoginWithEmail(string email, string password)
        {
            try
            {
#if PLAYFAB
                PlayFabSettings.TitleId = TitleId;
                var tcs = new TaskCompletionSource<bool>();

                var request = new LoginWithEmailAddressRequest
                {
                    TitleId = TitleId,
                    Email = email,
                    Password = password,
                    InfoRequestParameters = new GetPlayerCombinedInfoRequestParams
                    {
                        GetUserInventory = true,
                        GetUserVirtualCurrency = true
                    }
                };

                PlayFabClientAPI.LoginWithEmailAddress(request, result =>
                {
                    _playFabId = result.PlayFabId;
                    _sessionTicket = result.SessionTicket;
                    _entityKey = result.EntityToken?.Entity;
                    _isLoggedIn = true;
                    CachePlayerData(result.InfoResultPayload);
                    tcs.SetResult(true);
                    OnLoggedIn?.Invoke();
                    LogVerbose($"Logged in with Email. PlayFabId: {_playFabId}");
                }, error =>
                {
                    tcs.SetResult(false);
                    HandlePlayFabError(error);
                });

                return await tcs.Task;
#else
                await Task.Delay(1);
                _isLoggedIn = true;
                _cachedDisplayName = email.Split('@')[0];
                OnLoggedIn?.Invoke();
                return true;
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Email login failed: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Registers a new PlayFab account with email and password.
        /// </summary>
        /// <param name="email">Email address for the new account.</param>
        /// <param name="password">Password for the new account.</param>
        /// <param name="displayName">Display name for the player profile.</param>
        /// <returns>True if registration succeeded.</returns>
        public async Task<bool> RegisterEmail(string email, string password, string displayName)
        {
            try
            {
#if PLAYFAB
                PlayFabSettings.TitleId = TitleId;
                var tcs = new TaskCompletionSource<bool>();

                var request = new RegisterPlayFabUserRequest
                {
                    TitleId = TitleId,
                    Email = email,
                    Password = password,
                    DisplayName = displayName,
                    RequireBothUsernameAndEmail = false
                };

                PlayFabClientAPI.RegisterPlayFabUser(request, result =>
                {
                    _playFabId = result.PlayFabId;
                    _sessionTicket = result.SessionTicket;
                    _isLoggedIn = true;
                    _cachedDisplayName = displayName;
                    tcs.SetResult(true);
                    OnLoggedIn?.Invoke();
                    LogVerbose($"Registered new account. PlayFabId: {_playFabId}");
                }, error =>
                {
                    tcs.SetResult(false);
                    HandlePlayFabError(error);
                });

                return await tcs.Task;
#else
                await Task.Delay(1);
                _isLoggedIn = true;
                _cachedDisplayName = displayName;
                OnLoggedIn?.Invoke();
                return true;
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Registration failed: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Logs out the current player and clears cached data.
        /// </summary>
        public void Logout()
        {
#if PLAYFAB
            _playFabId = null;
            _sessionTicket = null;
            _entityKey = null;
            _userData.Clear();
            _virtualCurrency.Clear();
            _inventory.Clear();
#endif
            _isLoggedIn = false;
            _cachedDisplayName = null;
            OnLoggedOut?.Invoke();
            LogVerbose("Logged out.");
        }

        #endregion

        #region --- Player Data (Cloud Save) ---

        /// <summary>
        /// Updates a single player data key in Cloud Save.
        /// </summary>
        /// <param name="key">Data key name.</param>
        /// <param name="jsonValue">JSON string value to store.</param>
        /// <returns>True if update succeeded.</returns>
        public async Task<bool> UpdatePlayerData(string key, string jsonValue)
        {
            if (!_isLoggedIn) return false;

            try
            {
#if PLAYFAB
                var tcs = new TaskCompletionSource<bool>();

                var request = new UpdateUserDataRequest
                {
                    Data = new Dictionary<string, string> { { key, jsonValue } }
                };

                PlayFabClientAPI.UpdateUserData(request, result =>
                {
                    tcs.SetResult(true);
                    LogVerbose($"Updated player data key: {key}");
                }, error =>
                {
                    tcs.SetResult(false);
                    HandlePlayFabError(error);
                });

                return await tcs.Task;
#else
                await Task.Delay(1);
                return true;
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Update player data failed: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Retrieves a single player data value from Cloud Save.
        /// </summary>
        /// <param name="key">Data key to retrieve.</param>
        /// <returns>The stored JSON string, or null if not found.</returns>
        public async Task<string> GetPlayerData(string key)
        {
            if (!_isLoggedIn) return null;

            try
            {
#if PLAYFAB
                var tcs = new TaskCompletionSource<string>();

                var request = new GetUserDataRequest
                {
                    Keys = new List<string> { key }
                };

                PlayFabClientAPI.GetUserData(request, result =>
                {
                    if (result.Data != null && result.Data.TryGetValue(key, out var record))
                    {
                        tcs.SetResult(record.Value);
                    }
                    else
                    {
                        tcs.SetResult(null);
                    }
                }, error =>
                {
                    tcs.SetResult(null);
                    HandlePlayFabError(error);
                });

                return await tcs.Task;
#else
                await Task.Delay(1);
                return null;
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Get player data failed: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// Retrieves all player data from Cloud Save.
        /// </summary>
        /// <returns>Dictionary of all player data records.</returns>
        public async Task<Dictionary<string, UserDataRecord>> GetAllPlayerData()
        {
            if (!_isLoggedIn) return new Dictionary<string, UserDataRecord>();

            try
            {
#if PLAYFAB
                var tcs = new TaskCompletionSource<Dictionary<string, UserDataRecord>>();

                var request = new GetUserDataRequest();

                PlayFabClientAPI.GetUserData(request, result =>
                {
                    var data = result.Data ?? new Dictionary<string, UserDataRecord>();
                    tcs.SetResult(data);
                }, error =>
                {
                    tcs.SetResult(new Dictionary<string, UserDataRecord>());
                    HandlePlayFabError(error);
                });

                return await tcs.Task;
#else
                await Task.Delay(1);
                return new Dictionary<string, UserDataRecord>();
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Get all player data failed: {ex.Message}");
                return new Dictionary<string, UserDataRecord>();
            }
        }

        /// <summary>
        /// Updates publisher data (shared across all titles in the studio).
        /// </summary>
        /// <param name="key">Data key.</param>
        /// <param name="value">Value to store.</param>
        /// <returns>True if update succeeded.</returns>
        public async Task<bool> UpdateUserPublisherData(string key, string value)
        {
            if (!_isLoggedIn) return false;

            try
            {
#if PLAYFAB
                var tcs = new TaskCompletionSource<bool>();

                var request = new UpdateUserDataRequest
                {
                    Data = new Dictionary<string, string> { { key, value } }
                };

                PlayFabClientAPI.UpdateUserPublisherData(request, result => tcs.SetResult(true),
                    error => { tcs.SetResult(false); HandlePlayFabError(error); });

                return await tcs.Task;
#else
                await Task.Delay(1);
                return true;
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Update publisher data failed: {ex.Message}");
                return false;
            }
        }

        #endregion

        #region --- Economy ---

        /// <summary>
        /// Adds virtual currency to the player's account.
        /// </summary>
        /// <param name="currencyCode">Currency code (e.g., "CO", "GM", "TK").</param>
        /// <param name="amount">Amount to add.</param>
        /// <returns>True if the operation succeeded.</returns>
        public async Task<bool> AddVirtualCurrency(string currencyCode, int amount)
        {
            if (!_isLoggedIn || amount <= 0) return false;

            try
            {
#if PLAYFAB
                var tcs = new TaskCompletionSource<bool>();

                var request = new AddUserVirtualCurrencyRequest
                {
                    VirtualCurrency = currencyCode,
                    Amount = amount
                };

                PlayFabClientAPI.AddUserVirtualCurrency(request, result =>
                {
                    _virtualCurrency[currencyCode] = result.Balance;
                    OnCurrencyChanged?.Invoke(currencyCode, result.Balance);
                    tcs.SetResult(true);
                    LogVerbose($"Added {amount} {currencyCode}. New balance: {result.Balance}");
                }, error =>
                {
                    tcs.SetResult(false);
                    HandlePlayFabError(error);
                });

                return await tcs.Task;
#else
                await Task.Delay(1);
                OnCurrencyChanged?.Invoke(currencyCode, amount);
                return true;
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Add currency failed: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Subtracts virtual currency from the player's account.
        /// </summary>
        /// <param name="currencyCode">Currency code.</param>
        /// <param name="amount">Amount to subtract.</param>
        /// <returns>True if the operation succeeded.</returns>
        public async Task<bool> SubtractVirtualCurrency(string currencyCode, int amount)
        {
            if (!_isLoggedIn || amount <= 0) return false;

            try
            {
#if PLAYFAB
                var tcs = new TaskCompletionSource<bool>();

                var request = new SubtractUserVirtualCurrencyRequest
                {
                    VirtualCurrency = currencyCode,
                    Amount = amount
                };

                PlayFabClientAPI.SubtractUserVirtualCurrency(request, result =>
                {
                    _virtualCurrency[currencyCode] = result.Balance;
                    OnCurrencyChanged?.Invoke(currencyCode, result.Balance);
                    tcs.SetResult(true);
                    LogVerbose($"Subtracted {amount} {currencyCode}. New balance: {result.Balance}");
                }, error =>
                {
                    tcs.SetResult(false);
                    HandlePlayFabError(error);
                });

                return await tcs.Task;
#else
                await Task.Delay(1);
                OnCurrencyChanged?.Invoke(currencyCode, 0);
                return true;
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Subtract currency failed: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Gets the current balance of a virtual currency.
        /// </summary>
        /// <param name="currencyCode">Currency code.</param>
        /// <returns>Current balance, or 0 if not found.</returns>
        public async Task<int> GetVirtualCurrency(string currencyCode)
        {
            if (!_isLoggedIn) return 0;

#if PLAYFAB
            if (_virtualCurrency.TryGetValue(currencyCode, out var cached))
                return cached;

            var all = await GetAllVirtualCurrency();
            return all.TryGetValue(currencyCode, out var value) ? value : 0;
#else
            await Task.Delay(1);
            return 0;
#endif
        }

        /// <summary>
        /// Gets all virtual currency balances.
        /// </summary>
        /// <returns>Dictionary of currency code to balance.</returns>
        public async Task<Dictionary<string, int>> GetAllVirtualCurrency()
        {
            if (!_isLoggedIn) return new Dictionary<string, int>();

            try
            {
#if PLAYFAB
                var tcs = new TaskCompletionSource<Dictionary<string, int>>();

                var request = new GetUserInventoryRequest();

                PlayFabClientAPI.GetUserInventory(request, result =>
                {
                    _virtualCurrency.Clear();
                    foreach (var kvp in result.VirtualCurrency)
                    {
                        _virtualCurrency[kvp.Key] = kvp.Value;
                    }
                    tcs.SetResult(new Dictionary<string, int>(_virtualCurrency));
                }, error =>
                {
                    tcs.SetResult(new Dictionary<string, int>());
                    HandlePlayFabError(error);
                });

                return await tcs.Task;
#else
                await Task.Delay(1);
                return new Dictionary<string, int>();
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Get currency failed: {ex.Message}");
                return new Dictionary<string, int>();
            }
        }

        /// <summary>
        /// Purchases a catalog item using virtual currency.
        /// </summary>
        /// <param name="itemId">Catalog item ID.</param>
        /// <param name="currencyCode">Currency to use for purchase.</param>
        /// <param name="price">Price of the item.</param>
        /// <returns>True if purchase succeeded.</returns>
        public async Task<bool> PurchaseItem(string itemId, string currencyCode, int price)
        {
            if (!_isLoggedIn) return false;

            try
            {
#if PLAYFAB
                var tcs = new TaskCompletionSource<bool>();

                var request = new PurchaseItemRequest
                {
                    ItemId = itemId,
                    VirtualCurrency = currencyCode,
                    Price = price
                };

                PlayFabClientAPI.PurchaseItem(request, result =>
                {
                    _inventory.AddRange(result.Items);
                    OnInventoryChanged?.Invoke();
                    tcs.SetResult(true);
                    LogVerbose($"Purchased item: {itemId} for {price} {currencyCode}");
                }, error =>
                {
                    tcs.SetResult(false);
                    HandlePlayFabError(error);
                });

                return await tcs.Task;
#else
                await Task.Delay(1);
                OnInventoryChanged?.Invoke();
                return true;
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Purchase failed: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Purchases an item from a specific store.
        /// </summary>
        /// <param name="storeId">Store ID.</param>
        /// <param name="itemId">Item ID in the store.</param>
        /// <returns>True if purchase succeeded.</returns>
        public async Task<bool> PurchaseItemById(string storeId, string itemId)
        {
            if (!_isLoggedIn) return false;

            try
            {
#if PLAYFAB
                var tcs = new TaskCompletionSource<bool>();

                var request = new PurchaseItemRequest
                {
                    ItemId = itemId,
                    StoreId = storeId
                };

                PlayFabClientAPI.PurchaseItem(request, result =>
                {
                    _inventory.AddRange(result.Items);
                    OnInventoryChanged?.Invoke();
                    tcs.SetResult(true);
                    LogVerbose($"Purchased item: {itemId} from store: {storeId}");
                }, error =>
                {
                    tcs.SetResult(false);
                    HandlePlayFabError(error);
                });

                return await tcs.Task;
#else
                await Task.Delay(1);
                OnInventoryChanged?.Invoke();
                return true;
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Store purchase failed: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Grants an item directly to the player's inventory (server-authoritative).
        /// </summary>
        /// <param name="itemId">Catalog item ID to grant.</param>
        /// <returns>True if grant succeeded.</returns>
        public async Task<bool> GrantItem(string itemId)
        {
            if (!_isLoggedIn) return false;

            try
            {
                // Granting items is server-authoritative, use CloudScript
                var result = await ExecuteCloudScript<GrantItemResult>("GrantItemToUser", new { itemId });
                if (result != null)
                {
                    OnInventoryChanged?.Invoke();
                    return true;
                }
                return false;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Grant item failed: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Gets the player's current inventory.
        /// </summary>
        /// <returns>List of item instances in the player's inventory.</returns>
        public async Task<List<ItemInstance>> GetInventory()
        {
            if (!_isLoggedIn) return new List<ItemInstance>();

            try
            {
#if PLAYFAB
                var tcs = new TaskCompletionSource<List<ItemInstance>>();

                var request = new GetUserInventoryRequest();

                PlayFabClientAPI.GetUserInventory(request, result =>
                {
                    _inventory.Clear();
                    _inventory.AddRange(result.Inventory);
                    tcs.SetResult(new List<ItemInstance>(_inventory));
                }, error =>
                {
                    tcs.SetResult(new List<ItemInstance>());
                    HandlePlayFabError(error);
                });

                return await tcs.Task;
#else
                await Task.Delay(1);
                return new List<ItemInstance>();
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Get inventory failed: {ex.Message}");
                return new List<ItemInstance>();
            }
        }

        /// <summary>
        /// Consumes (uses up) items from the player's inventory.
        /// </summary>
        /// <param name="itemInstanceId">Instance ID of the item to consume.</param>
        /// <param name="count">Number of items to consume.</param>
        /// <returns>True if consumption succeeded.</returns>
        public async Task<bool> ConsumeItem(string itemInstanceId, int count = 1)
        {
            if (!_isLoggedIn || count <= 0) return false;

            try
            {
#if PLAYFAB
                var tcs = new TaskCompletionSource<bool>();

                var request = new ConsumeItemRequest
                {
                    ItemInstanceId = itemInstanceId,
                    ConsumeCount = count
                };

                PlayFabClientAPI.ConsumeItem(request, result =>
                {
                    // Update local inventory cache
                    var item = _inventory.FirstOrDefault(i => i.ItemInstanceId == itemInstanceId);
                    if (item != null)
                    {
                        item.RemainingUses -= count;
                        if (item.RemainingUses <= 0)
                        {
                            _inventory.Remove(item);
                        }
                    }
                    OnInventoryChanged?.Invoke();
                    tcs.SetResult(true);
                    LogVerbose($"Consumed {count} of item instance: {itemInstanceId}");
                }, error =>
                {
                    tcs.SetResult(false);
                    HandlePlayFabError(error);
                });

                return await tcs.Task;
#else
                await Task.Delay(1);
                OnInventoryChanged?.Invoke();
                return true;
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Consume item failed: {ex.Message}");
                return false;
            }
        }

        #endregion

        #region --- Leaderboards ---

        /// <summary>
        /// Updates a player statistic for leaderboard entries.
        /// </summary>
        /// <param name="statisticName">Name of the statistic/leaderboard.</param>
        /// <param name="value">New value for the statistic.</param>
        /// <returns>True if update succeeded.</returns>
        public async Task<bool> UpdateStatistic(string statisticName, int value)
        {
            if (!_isLoggedIn) return false;

            try
            {
#if PLAYFAB
                var tcs = new TaskCompletionSource<bool>();

                var request = new UpdatePlayerStatisticsRequest
                {
                    Statistics = new List<StatisticUpdate>
                    {
                        new StatisticUpdate
                        {
                            StatisticName = statisticName,
                            Value = value
                        }
                    }
                };

                PlayFabClientAPI.UpdatePlayerStatistics(request, result =>
                {
                    tcs.SetResult(true);
                    LogVerbose($"Updated statistic '{statisticName}' to {value}");
                }, error =>
                {
                    tcs.SetResult(false);
                    HandlePlayFabError(error);
                });

                return await tcs.Task;
#else
                await Task.Delay(1);
                return true;
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Update statistic failed: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Retrieves a global leaderboard.
        /// </summary>
        /// <param name="statisticName">Name of the leaderboard statistic.</param>
        /// <param name="maxResults">Maximum number of entries to retrieve (max 100).</param>
        /// <returns>List of leaderboard entries.</returns>
        public async Task<List<PlayerLeaderboardEntry>> GetLeaderboard(string statisticName, int maxResults = 20)
        {
            if (!_isLoggedIn) return new List<PlayerLeaderboardEntry>();

            try
            {
#if PLAYFAB
                var tcs = new TaskCompletionSource<List<PlayerLeaderboardEntry>>();

                var request = new GetLeaderboardRequest
                {
                    StatisticName = statisticName,
                    MaxResultsCount = Mathf.Clamp(maxResults, 1, 100)
                };

                PlayFabClientAPI.GetLeaderboard(request, result =>
                {
                    tcs.SetResult(result.Leaderboard);
                }, error =>
                {
                    tcs.SetResult(new List<PlayerLeaderboardEntry>());
                    HandlePlayFabError(error);
                });

                return await tcs.Task;
#else
                await Task.Delay(1);
                return new List<PlayerLeaderboardEntry>();
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Get leaderboard failed: {ex.Message}");
                return new List<PlayerLeaderboardEntry>();
            }
        }

        /// <summary>
        /// Retrieves a friends-only filtered leaderboard.
        /// </summary>
        /// <param name="statisticName">Name of the leaderboard statistic.</param>
        /// <param name="maxResults">Maximum number of entries to retrieve.</param>
        /// <returns>List of friends leaderboard entries.</returns>
        public async Task<List<PlayerLeaderboardEntry>> GetFriendLeaderboard(string statisticName, int maxResults = 20)
        {
            if (!_isLoggedIn) return new List<PlayerLeaderboardEntry>();

            try
            {
#if PLAYFAB
                var tcs = new TaskCompletionSource<List<PlayerLeaderboardEntry>>();

                var request = new GetFriendLeaderboardRequest
                {
                    StatisticName = statisticName,
                    MaxResultsCount = Mathf.Clamp(maxResults, 1, 100)
                };

                PlayFabClientAPI.GetFriendLeaderboard(request, result =>
                {
                    tcs.SetResult(result.Leaderboard);
                }, error =>
                {
                    tcs.SetResult(new List<PlayerLeaderboardEntry>());
                    HandlePlayFabError(error);
                });

                return await tcs.Task;
#else
                await Task.Delay(1);
                return new List<PlayerLeaderboardEntry>();
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Get friend leaderboard failed: {ex.Message}");
                return new List<PlayerLeaderboardEntry>();
            }
        }

        /// <summary>
        /// Gets the current player's value for a specific statistic.
        /// </summary>
        /// <param name="statisticName">Name of the statistic.</param>
        /// <returns>The player's statistic value, or 0 if not found.</returns>
        public async Task<int> GetStatisticValue(string statisticName)
        {
            if (!_isLoggedIn) return 0;

            try
            {
#if PLAYFAB
                var tcs = new TaskCompletionSource<int>();

                var request = new GetPlayerStatisticsRequest
                {
                    StatisticNames = new List<string> { statisticName }
                };

                PlayFabClientAPI.GetPlayerStatistics(request, result =>
                {
                    var stat = result.Statistics?.FirstOrDefault(s => s.StatisticName == statisticName);
                    tcs.SetResult(stat?.Value ?? 0);
                }, error =>
                {
                    tcs.SetResult(0);
                    HandlePlayFabError(error);
                });

                return await tcs.Task;
#else
                await Task.Delay(1);
                return 0;
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Get statistic failed: {ex.Message}");
                return 0;
            }
        }

        #endregion

        #region --- CloudScript ---

        /// <summary>
        /// Executes a CloudScript/Azure Function with the given parameters.
        /// </summary>
        /// <typeparam name="T">Expected return type from the function.</typeparam>
        /// <param name="functionName">Name of the CloudScript function.</param>
        /// <param name="functionParameter">Parameters to pass to the function.</param>
        /// <returns>Deserialized function result.</returns>
        public async Task<T> ExecuteCloudScript<T>(string functionName, object functionParameter = null)
        {
            if (!_isLoggedIn) return default;

            try
            {
#if PLAYFAB
                var tcs = new TaskCompletionSource<T>();

                var request = new ExecuteFunctionRequest
                {
                    FunctionName = functionName,
                    FunctionParameter = functionParameter,
                    GeneratePlayStreamEvent = true
                };

                PlayFabCloudScriptAPI.ExecuteFunction(request, result =>
                {
                    try
                    {
                        if (result.FunctionResult != null)
                        {
                            var deserialized = ConvertToType<T>(result.FunctionResult);
                            tcs.SetResult(deserialized);
                        }
                        else
                        {
                            tcs.SetResult(default);
                        }
                    }
                    catch (Exception ex)
                    {
                        Debug.LogError($"[PlayFabManager] CloudScript result deserialization failed: {ex.Message}");
                        tcs.SetResult(default);
                    }
                }, error =>
                {
                    tcs.SetResult(default);
                    HandlePlayFabError(error);
                });

                return await tcs.Task;
#else
                await Task.Delay(1);
                return default;
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] CloudScript execution failed: {ex.Message}");
                return default;
            }
        }

        /// <summary>
        /// Validates a purchase receipt server-side via CloudScript.
        /// </summary>
        /// <param name="receipt">Platform purchase receipt.</param>
        /// <returns>Validation response from the server.</returns>
        public async Task<Dictionary<string, object>> ValidatePurchase(string receipt)
        {
            return await ExecuteCloudScript<Dictionary<string, object>>("ValidatePurchase", new { receipt });
        }

        /// <summary>
        /// Validates an economy transaction server-side.
        /// </summary>
        /// <param name="transactionId">The transaction to validate.</param>
        /// <returns>True if the transaction is valid.</returns>
        public async Task<bool> ValidateEconomyTransaction(string transactionId)
        {
            var result = await ExecuteCloudScript<Dictionary<string, object>>("ValidateTransaction", new { transactionId });
            if (result != null && result.TryGetValue("valid", out var valid))
            {
                return valid is bool b && b;
            }
            return false;
        }

        #endregion

        #region --- Title Data ---

        /// <summary>
        /// Retrieves specific title data keys.
        /// </summary>
        /// <param name="keys">List of title data keys to retrieve.</param>
        /// <returns>Title data result containing the requested key-value pairs.</returns>
        public async Task<object> GetTitleData(List<string> keys)
        {
            if (!_isLoggedIn) return null;

            try
            {
#if PLAYFAB
                var tcs = new TaskCompletionSource<GetTitleDataResult>();

                var request = new GetTitleDataRequest
                {
                    Keys = keys
                };

                PlayFabClientAPI.GetTitleData(request, result => tcs.SetResult(result),
                    error => { tcs.SetResult(null); HandlePlayFabError(error); });

                return await tcs.Task;
#else
                await Task.Delay(1);
                return null;
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Get title data failed: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// Retrieves all title data.
        /// </summary>
        /// <returns>Title data result containing all key-value pairs.</returns>
        public async Task<object> GetAllTitleData()
        {
            return await GetTitleData(null);
        }

        #endregion

        #region --- Friends ---

        /// <summary>
        /// Adds a friend by their PlayFab ID.
        /// </summary>
        /// <param name="friendPlayFabId">PlayFab ID of the player to add as friend.</param>
        /// <returns>True if the friend was added successfully.</returns>
        public async Task<bool> AddFriend(string friendPlayFabId)
        {
            if (!_isLoggedIn) return false;

            try
            {
#if PLAYFAB
                var tcs = new TaskCompletionSource<bool>();

                var request = new AddFriendRequest
                {
                    FriendPlayFabId = friendPlayFabId
                };

                PlayFabClientAPI.AddFriend(request, result =>
                {
                    tcs.SetResult(true);
                    LogVerbose($"Added friend: {friendPlayFabId}");
                }, error =>
                {
                    tcs.SetResult(false);
                    HandlePlayFabError(error);
                });

                return await tcs.Task;
#else
                await Task.Delay(1);
                return true;
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Add friend failed: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Removes a friend by their PlayFab ID.
        /// </summary>
        /// <param name="friendPlayFabId">PlayFab ID of the friend to remove.</param>
        /// <returns>True if the friend was removed successfully.</returns>
        public async Task<bool> RemoveFriend(string friendPlayFabId)
        {
            if (!_isLoggedIn) return false;

            try
            {
#if PLAYFAB
                var tcs = new TaskCompletionSource<bool>();

                var request = new RemoveFriendRequest
                {
                    FriendPlayFabId = friendPlayFabId
                };

                PlayFabClientAPI.RemoveFriend(request, result =>
                {
                    tcs.SetResult(true);
                    LogVerbose($"Removed friend: {friendPlayFabId}");
                }, error =>
                {
                    tcs.SetResult(false);
                    HandlePlayFabError(error);
                });

                return await tcs.Task;
#else
                await Task.Delay(1);
                return true;
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Remove friend failed: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Gets the player's friends list.
        /// </summary>
        /// <returns>List of friend information.</returns>
        public async Task<List<FriendInfo>> GetFriendsList()
        {
            if (!_isLoggedIn) return new List<FriendInfo>();

            try
            {
#if PLAYFAB
                var tcs = new TaskCompletionSource<List<FriendInfo>>();

                var request = new GetFriendsListRequest
                {
                    IncludeFacebookFriends = false,
                    IncludeSteamFriends = false,
                    XboxToken = null
                };

                PlayFabClientAPI.GetFriendsList(request, result =>
                {
                    tcs.SetResult(result.Friends ?? new List<FriendInfo>());
                }, error =>
                {
                    tcs.SetResult(new List<FriendInfo>());
                    HandlePlayFabError(error);
                });

                return await tcs.Task;
#else
                await Task.Delay(1);
                return new List<FriendInfo>();
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PlayFabManager] Get friends list failed: {ex.Message}");
                return new List<FriendInfo>();
            }
        }

        #endregion

        #region --- Internal Methods ---

        /// <summary>
        /// Handles PlayFab API errors by logging and firing the error event.
        /// </summary>
        /// <param name="error">The PlayFab error object.</param>
        private void HandlePlayFabError(object error)
        {
#if PLAYFAB
            if (error is PlayFabError pfError)
            {
                Debug.LogError($"[PlayFabManager] Error: {pfError.ErrorMessage} (Code: {pfError.Error})");
                OnError?.Invoke(pfError);
            }
            else
#endif
            {
                Debug.LogError($"[PlayFabManager] Unknown error: {error}");
                OnError?.Invoke(error);
            }
        }

        /// <summary>
        /// Converts a CloudScript function result dictionary to the specified type.
        /// </summary>
        /// <typeparam name="T">Target type.</typeparam>
        /// <param name="dict">Dictionary from function result.</param>
        /// <returns>Converted object.</returns>
        private T ConvertToType<T>(Dictionary<string, object> dict)
        {
            if (typeof(T) == typeof(Dictionary<string, object>))
                return (T)(object)dict;

            // For other types, serialize and deserialize via JSON
            string json = JsonUtility.ToJson(new SerializationWrapper { Data = dict });
            return JsonUtility.FromJson<T>(json);
        }

#if PLAYFAB
        /// <summary>
        /// Caches player data from a login/info result payload.
        /// </summary>
        /// <param name="payload">The info result payload from login.</param>
        private void CachePlayerData(GetPlayerCombinedInfoResultPayload payload)
        {
            if (payload == null) return;

            if (payload.UserInventory != null)
            {
                _inventory.Clear();
                _inventory.AddRange(payload.UserInventory);
            }

            if (payload.UserVirtualCurrency != null)
            {
                _virtualCurrency.Clear();
                foreach (var kvp in payload.UserVirtualCurrency)
                {
                    _virtualCurrency[kvp.Key] = kvp.Value;
                }
            }

            if (payload.UserData != null)
            {
                _userData.Clear();
                foreach (var kvp in payload.UserData)
                {
                    _userData[kvp.Key] = kvp.Value;
                }
            }

            LogVerbose($"Cached player data: {_inventory.Count} items, {_virtualCurrency.Count} currencies");
        }
#endif

        private void LogVerbose(string message)
        {
            if (VerboseLogging)
            {
                Debug.Log($"[PlayFabManager] {message}");
            }
        }

        #endregion

        #region --- Serialization Helper ---

        [System.Serializable]
        private class SerializationWrapper
        {
            public Dictionary<string, object> Data;
        }

#if PLAYFAB
        [System.Serializable]
        private class GrantItemResult
        {
            public string ItemId;
            public string ItemInstanceId;
            public bool Success;
        }
#endif

        #endregion
    }
}
