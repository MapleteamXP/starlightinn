using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;
#if FIREBASE
using Firebase;
using Firebase.Auth;
using Firebase.Analytics;
using Firebase.Extensions;
#endif

namespace KawaiiCool.Backend
{
    /// <summary>
    /// Central manager for all Firebase services in KawaiiCool Island.
    /// Handles authentication (anonymous, email/password, social providers),
    /// analytics logging, Crashlytics crash reporting, and Remote Config.
    /// All operations use async/await for clean asynchronous flow.
    /// </summary>
    public class FirebaseManager : MonoBehaviour
    {
        public static FirebaseManager Instance { get; private set; }

        #region --- Private Fields ---

#if FIREBASE
        private FirebaseApp _app;
        private FirebaseAuth _auth;
        private FirebaseUser _currentUser;
#endif
        private bool _isInitialized;
        private string _cachedIdToken;
        private DateTime _tokenExpiryTime;

        #endregion

        #region --- Public Properties ---

        /// <summary>
        /// Whether Firebase has been successfully initialized.
        /// </summary>
        public bool IsInitialized => _isInitialized;

        /// <summary>
        /// Whether a user is currently logged in.
        /// </summary>
        public bool IsLoggedIn
        {
            get
            {
#if FIREBASE
                return _currentUser != null;
#else
                return false;
#endif
            }
        }

        /// <summary>
        /// The Firebase User ID of the currently logged in user.
        /// </summary>
        public string UserId
        {
            get
            {
#if FIREBASE
                return _currentUser?.UserId;
#else
                return null;
#endif
            }
        }

        /// <summary>
        /// Display name of the currently logged in user.
        /// </summary>
        public string DisplayName
        {
            get
            {
#if FIREBASE
                return _currentUser?.DisplayName;
#else
                return null;
#endif
            }
        }

        /// <summary>
        /// Email address of the currently logged in user.
        /// </summary>
        public string Email
        {
            get
            {
#if FIREBASE
                return _currentUser?.Email;
#else
                return null;
#endif
            }
        }

        /// <summary>
        /// Whether the current user is logged in anonymously.
        /// </summary>
        public bool IsAnonymous
        {
            get
            {
#if FIREBASE
                return _currentUser?.IsAnonymous ?? false;
#else
                return false;
#endif
            }
        }

        /// <summary>
        /// The Firebase ID token for API authentication.
        /// Automatically refreshes when expired.
        /// </summary>
        public string IdToken
        {
            get
            {
                if (DateTime.UtcNow >= _tokenExpiryTime)
                {
                    _ = RefreshIdTokenAsync();
                }
                return _cachedIdToken;
            }
        }

        #endregion

        #region --- Configuration ---

        [Header("Config")]
        [Tooltip("Enable Firebase Analytics event logging.")]
        public bool EnableAnalytics = true;

        [Tooltip("Enable Firebase Crashlytics crash reporting.")]
        public bool EnableCrashlytics = true;

        [Tooltip("Enable Firebase Cloud Messaging push notifications.")]
        public bool EnableCloudMessaging = true;

        [Tooltip("Enable Firebase Remote Config live configuration.")]
        public bool EnableRemoteConfig = true;

        [Tooltip("Automatically sign in anonymously on initialization if no user is logged in.")]
        public bool AutoSignInAnonymously = true;

        #endregion

        #region --- Events ---

        /// <summary>
        /// Fired when Firebase initialization state changes.
        /// Parameter is whether Firebase is fully initialized.
        /// </summary>
        public event Action<bool> OnInitializedChanged;

        /// <summary>
        /// Fired when a user successfully logs in.
        /// Parameter is the Firebase user.
        /// </summary>
        public event Action<object> OnUserLoggedIn;

        /// <summary>
        /// Fired when the current user logs out.
        /// </summary>
        public event Action OnUserLoggedOut;

        /// <summary>
        /// Fired when an authentication error occurs.
        /// </summary>
        public event Action<Exception> OnAuthError;

        /// <summary>
        /// Fired when the ID token is refreshed.
        /// </summary>
        public event Action<string> OnTokenRefreshed;

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

        private void OnDestroy()
        {
#if FIREBASE
            if (_auth != null)
            {
                _auth.StateChanged -= OnAuthStateChanged;
            }
#endif
        }

        #endregion

        #region --- Initialization ---

        /// <summary>
        /// Initializes Firebase services. Must be called before any other Firebase operations.
        /// </summary>
        /// <returns>True if Firebase was successfully initialized.</returns>
        public async Task<bool> Initialize()
        {
            if (_isInitialized)
            {
                Debug.Log("[FirebaseManager] Firebase already initialized.");
                return true;
            }

            try
            {
                bool dependenciesOk = await CheckAndFixDependencies();
                if (!dependenciesOk)
                {
                    Debug.LogError("[FirebaseManager] Firebase dependencies could not be resolved.");
                    return false;
                }

#if FIREBASE
                _app = FirebaseApp.DefaultInstance;
                _auth = FirebaseAuth.DefaultInstance;

                // Subscribe to auth state changes
                _auth.StateChanged += OnAuthStateChanged;

                // Initialize Crashlytics
                if (EnableCrashlytics)
                {
                    FirebaseCrashlytics.Initialize();
                    FirebaseCrashlytics.IsCrashlyticsCollectionEnabled = true;
                    LogCrashlytics("Firebase initialized successfully.");
                }

                // Initialize Remote Config
                if (EnableRemoteConfig)
                {
                    await FetchRemoteConfig();
                }

                _isInitialized = true;
                OnInitializedChanged?.Invoke(true);

                // Auto sign in anonymously if needed
                if (AutoSignInAnonymously && _auth.CurrentUser == null)
                {
                    await SignInAnonymously();
                }
                else if (_auth.CurrentUser != null)
                {
                    _currentUser = _auth.CurrentUser;
                    OnUserLoggedIn?.Invoke(_currentUser);
                }

                Debug.Log("[FirebaseManager] Firebase initialized successfully.");
                return true;
#else
                Debug.LogWarning("[FirebaseManager] FIREBASE compilation symbol not defined. Using mock mode.");
                _isInitialized = true;
                OnInitializedChanged?.Invoke(true);
                return true;
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[FirebaseManager] Initialization failed: {ex.Message}");
                OnAuthError?.Invoke(ex);
                return false;
            }
        }

        /// <summary>
        /// Checks and attempts to fix Firebase dependencies.
        /// </summary>
        /// <returns>True if all dependencies are available.</returns>
        public async Task<bool> CheckAndFixDependencies()
        {
            try
            {
#if FIREBASE
                var dependencyStatus = await FirebaseApp.CheckAndFixDependenciesAsync();
                if (dependencyStatus == DependencyStatus.Available)
                {
                    return true;
                }
                else
                {
                    Debug.LogError($"[FirebaseManager] Firebase dependencies unavailable: {dependencyStatus}");
                    return false;
                }
#else
                await Task.Delay(1);
                return true;
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[FirebaseManager] Dependency check failed: {ex.Message}");
                return false;
            }
        }

        #endregion

        #region --- Authentication ---

        /// <summary>
        /// Signs in a new anonymous user or returns the current anonymous user.
        /// </summary>
        /// <returns>AuthResult with success status and user details.</returns>
        public async Task<AuthResult> SignInAnonymously()
        {
            try
            {
#if FIREBASE
                var result = await _auth.SignInAnonymouslyAsync();
                _currentUser = result.User;
                _cachedIdToken = await _currentUser.TokenAsync(true);
                _tokenExpiryTime = DateTime.UtcNow.AddMinutes(55);

                OnUserLoggedIn?.Invoke(_currentUser);
                LogLogin("anonymous");

                return new AuthResult
                {
                    Success = true,
                    UserId = _currentUser.UserId,
                    IsNewUser = result.AdditionalUserInfo?.IsNewUser ?? false
                };
#else
                await Task.Delay(1);
                return new AuthResult { Success = true, UserId = "mock_anonymous_user", IsNewUser = true };
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[FirebaseManager] Anonymous sign-in failed: {ex.Message}");
                OnAuthError?.Invoke(ex);
                return new AuthResult { Success = false, ErrorMessage = ex.Message };
            }
        }

        /// <summary>
        /// Signs in an existing user with email and password.
        /// </summary>
        /// <param name="email">User's email address.</param>
        /// <param name="password">User's password.</param>
        /// <returns>AuthResult with success status and user details.</returns>
        public async Task<AuthResult> SignInWithEmail(string email, string password)
        {
            try
            {
#if FIREBASE
                var result = await _auth.SignInWithEmailAndPasswordAsync(email, password);
                _currentUser = result.User;
                _cachedIdToken = await _currentUser.TokenAsync(true);
                _tokenExpiryTime = DateTime.UtcNow.AddMinutes(55);

                OnUserLoggedIn?.Invoke(_currentUser);
                LogLogin("email");

                return new AuthResult
                {
                    Success = true,
                    UserId = _currentUser.UserId,
                    IsNewUser = result.AdditionalUserInfo?.IsNewUser ?? false
                };
#else
                await Task.Delay(1);
                return new AuthResult { Success = true, UserId = "mock_email_user", IsNewUser = false };
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[FirebaseManager] Email sign-in failed: {ex.Message}");
                OnAuthError?.Invoke(ex);
                return new AuthResult { Success = false, ErrorMessage = ex.Message };
            }
        }

        /// <summary>
        /// Creates a new account with email and password.
        /// </summary>
        /// <param name="email">User's email address.</param>
        /// <param name="password">User's password.</param>
        /// <param name="displayName">Display name for the new account.</param>
        /// <returns>AuthResult with success status and user details.</returns>
        public async Task<AuthResult> CreateAccount(string email, string password, string displayName)
        {
            try
            {
#if FIREBASE
                var result = await _auth.CreateUserWithEmailAndPasswordAsync(email, password);
                _currentUser = result.User;

                // Update display name
                if (!string.IsNullOrEmpty(displayName))
                {
                    await UpdateDisplayName(displayName);
                }

                _cachedIdToken = await _currentUser.TokenAsync(true);
                _tokenExpiryTime = DateTime.UtcNow.AddMinutes(55);

                OnUserLoggedIn?.Invoke(_currentUser);
                LogEvent("sign_up", new Dictionary<string, object> { { "method", "email" } });

                return new AuthResult
                {
                    Success = true,
                    UserId = _currentUser.UserId,
                    IsNewUser = true
                };
#else
                await Task.Delay(1);
                return new AuthResult { Success = true, UserId = "mock_new_user", IsNewUser = true };
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[FirebaseManager] Account creation failed: {ex.Message}");
                OnAuthError?.Invoke(ex);
                return new AuthResult { Success = false, ErrorMessage = ex.Message };
            }
        }

        /// <summary>
        /// Signs in with Google credentials (Android/iOS/Desktop).
        /// </summary>
        /// <returns>AuthResult with success status and user details.</returns>
        public async Task<AuthResult> SignInWithGoogle()
        {
            try
            {
#if FIREBASE && (UNITY_ANDROID || UNITY_IOS)
                // Google sign-in implementation requires Google Sign-In SDK
                // This is a placeholder for the actual implementation
                throw new NotImplementedException("Google Sign-In requires platform-specific SDK setup.");
#else
                await Task.Delay(1);
                Debug.LogWarning("[FirebaseManager] Google Sign-In not available on this platform.");
                return new AuthResult { Success = false, ErrorMessage = "Google Sign-In not available." };
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[FirebaseManager] Google sign-in failed: {ex.Message}");
                OnAuthError?.Invoke(ex);
                return new AuthResult { Success = false, ErrorMessage = ex.Message };
            }
        }

        /// <summary>
        /// Signs in with Apple credentials (iOS only).
        /// </summary>
        /// <returns>AuthResult with success status and user details.</returns>
        public async Task<AuthResult> SignInWithApple()
        {
            try
            {
#if FIREBASE && UNITY_IOS
                // Apple sign-in implementation requires Apple Sign-In SDK
                throw new NotImplementedException("Apple Sign-In requires iOS SDK setup.");
#else
                await Task.Delay(1);
                Debug.LogWarning("[FirebaseManager] Apple Sign-In only available on iOS.");
                return new AuthResult { Success = false, ErrorMessage = "Apple Sign-In only available on iOS." };
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[FirebaseManager] Apple sign-in failed: {ex.Message}");
                OnAuthError?.Invoke(ex);
                return new AuthResult { Success = false, ErrorMessage = ex.Message };
            }
        }

        /// <summary>
        /// Signs in with Facebook credentials.
        /// </summary>
        /// <returns>AuthResult with success status and user details.</returns>
        public async Task<AuthResult> SignInWithFacebook()
        {
            try
            {
#if FIREBASE
                // Facebook sign-in requires Facebook SDK
                throw new NotImplementedException("Facebook Sign-In requires Facebook SDK setup.");
#else
                await Task.Delay(1);
                return new AuthResult { Success = false, ErrorMessage = "Facebook Sign-In not available." };
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[FirebaseManager] Facebook sign-in failed: {ex.Message}");
                OnAuthError?.Invoke(ex);
                return new AuthResult { Success = false, ErrorMessage = ex.Message };
            }
        }

        /// <summary>
        /// Links an email/password credential to the current anonymous user.
        /// </summary>
        /// <param name="email">Email address to link.</param>
        /// <param name="password">Password for the new credential.</param>
        /// <returns>AuthResult with success status.</returns>
        public async Task<AuthResult> LinkEmailPassword(string email, string password)
        {
            try
            {
#if FIREBASE
                if (_currentUser == null)
                    return new AuthResult { Success = false, ErrorMessage = "No user is currently signed in." };

                var credential = EmailAuthProvider.GetCredential(email, password);
                var result = await _currentUser.LinkWithCredentialAsync(credential);
                _currentUser = result.User;

                return new AuthResult
                {
                    Success = true,
                    UserId = _currentUser.UserId,
                    IsNewUser = result.AdditionalUserInfo?.IsNewUser ?? false
                };
#else
                await Task.Delay(1);
                return new AuthResult { Success = true };
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[FirebaseManager] Link email/password failed: {ex.Message}");
                OnAuthError?.Invoke(ex);
                return new AuthResult { Success = false, ErrorMessage = ex.Message };
            }
        }

        /// <summary>
        /// Links a Google credential to the current user.
        /// </summary>
        /// <returns>AuthResult with success status.</returns>
        public async Task<AuthResult> LinkGoogle()
        {
            try
            {
#if FIREBASE
                if (_currentUser == null)
                    return new AuthResult { Success = false, ErrorMessage = "No user is currently signed in." };

                // Google linking requires platform-specific implementation
                throw new NotImplementedException("Google linking requires platform-specific SDK.");
#else
                await Task.Delay(1);
                return new AuthResult { Success = true };
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[FirebaseManager] Link Google failed: {ex.Message}");
                OnAuthError?.Invoke(ex);
                return new AuthResult { Success = false, ErrorMessage = ex.Message };
            }
        }

        /// <summary>
        /// Sends a password reset email to the specified address.
        /// </summary>
        /// <param name="email">Email address to send reset to.</param>
        public async Task ResetPassword(string email)
        {
            try
            {
#if FIREBASE
                await _auth.SendPasswordResetEmailAsync(email);
                Debug.Log($"[FirebaseManager] Password reset email sent to {email}");
#else
                await Task.Delay(1);
                Debug.Log($"[FirebaseManager] Mock: Password reset email sent to {email}");
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[FirebaseManager] Password reset failed: {ex.Message}");
                OnAuthError?.Invoke(ex);
            }
        }

        /// <summary>
        /// Updates the current user's display name.
        /// </summary>
        /// <param name="name">New display name.</param>
        public async Task UpdateDisplayName(string name)
        {
            try
            {
#if FIREBASE
                if (_currentUser == null) return;
                var profile = new UserProfile { DisplayName = name };
                await _currentUser.UpdateUserProfileAsync(profile);
                Debug.Log($"[FirebaseManager] Display name updated to: {name}");
#else
                await Task.Delay(1);
                Debug.Log($"[FirebaseManager] Mock: Display name updated to: {name}");
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[FirebaseManager] Update display name failed: {ex.Message}");
                OnAuthError?.Invoke(ex);
            }
        }

        /// <summary>
        /// Updates the current user's profile photo URL.
        /// </summary>
        /// <param name="photoUrl">URL of the new profile photo.</param>
        public async Task UpdateProfilePhoto(string photoUrl)
        {
            try
            {
#if FIREBASE
                if (_currentUser == null) return;
                var profile = new UserProfile { PhotoUrl = new Uri(photoUrl) };
                await _currentUser.UpdateUserProfileAsync(profile);
#else
                await Task.Delay(1);
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[FirebaseManager] Update profile photo failed: {ex.Message}");
            }
        }

        /// <summary>
        /// Signs out the current user.
        /// </summary>
        public void SignOut()
        {
#if FIREBASE
            _auth?.SignOut();
            _currentUser = null;
            _cachedIdToken = null;
#endif
            OnUserLoggedOut?.Invoke();
            Debug.Log("[FirebaseManager] User signed out.");
        }

        /// <summary>
        /// Gets the Firebase ID token for the current user.
        /// </summary>
        /// <param name="forceRefresh">Force a token refresh even if not expired.</param>
        /// <returns>The ID token string.</returns>
        public async Task<string> GetIdToken(bool forceRefresh = false)
        {
            try
            {
#if FIREBASE
                if (_currentUser == null) return null;
                string token = await _currentUser.TokenAsync(forceRefresh);
                _cachedIdToken = token;
                _tokenExpiryTime = DateTime.UtcNow.AddMinutes(55);
                return token;
#else
                await Task.Delay(1);
                return "mock_token";
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[FirebaseManager] Get ID token failed: {ex.Message}");
                return null;
            }
        }

        private async Task RefreshIdTokenAsync()
        {
            await GetIdToken(true);
            OnTokenRefreshed?.Invoke(_cachedIdToken);
        }

#if FIREBASE
        private void OnAuthStateChanged(object sender, EventArgs e)
        {
            if (_auth.CurrentUser != _currentUser)
            {
                bool signedIn = _currentUser != _auth.CurrentUser && _auth.CurrentUser != null;
                _currentUser = _auth.CurrentUser;

                if (signedIn)
                {
                    Debug.Log($"[FirebaseManager] Auth state: Signed in as {_currentUser.UserId}");
                    OnUserLoggedIn?.Invoke(_currentUser);
                }
                else if (_currentUser == null)
                {
                    Debug.Log("[FirebaseManager] Auth state: Signed out.");
                    OnUserLoggedOut?.Invoke();
                }
            }
        }
#endif

        #endregion

        #region --- Analytics ---

        /// <summary>
        /// Logs a custom analytics event with optional parameters.
        /// </summary>
        /// <param name="eventName">Name of the event (max 40 chars, alphanumeric and underscores).</param>
        /// <param name="parameters">Optional event parameters as key-value pairs.</param>
        public void LogEvent(string eventName, Dictionary<string, object> parameters = null)
        {
            if (!EnableAnalytics) return;

            try
            {
#if FIREBASE
                if (parameters != null && parameters.Count > 0)
                {
                    var firebaseParams = new List<Parameter>();
                    foreach (var kvp in parameters)
                    {
                        switch (kvp.Value)
                        {
                            case long l:
                                firebaseParams.Add(new Parameter(kvp.Key, l));
                                break;
                            case int i:
                                firebaseParams.Add(new Parameter(kvp.Key, i));
                                break;
                            case double d:
                                firebaseParams.Add(new Parameter(kvp.Key, d));
                                break;
                            case float f:
                                firebaseParams.Add(new Parameter(kvp.Key, f));
                                break;
                            case bool b:
                                firebaseParams.Add(new Parameter(kvp.Key, b ? 1L : 0L));
                                break;
                            default:
                                firebaseParams.Add(new Parameter(kvp.Key, kvp.Value?.ToString() ?? ""));
                                break;
                        }
                    }
                    FirebaseAnalytics.LogEvent(eventName, firebaseParams.ToArray());
                }
                else
                {
                    FirebaseAnalytics.LogEvent(eventName);
                }
#endif

#if UNITY_EDITOR || DEVELOPMENT_BUILD
                string paramStr = parameters != null ? string.Join(", ", parameters) : "none";
                Debug.Log($"[Analytics] {eventName}: {paramStr}");
#endif
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[FirebaseManager] Analytics logging failed: {ex.Message}");
            }
        }

        /// <summary>
        /// Logs a level start event.
        /// </summary>
        /// <param name="levelName">Name or identifier of the level.</param>
        public void LogLevelStart(string levelName)
        {
            LogEvent("level_start", new Dictionary<string, object> { { "level_name", levelName } });
        }

        /// <summary>
        /// Logs a level end event with result and score.
        /// </summary>
        /// <param name="levelName">Name or identifier of the level.</param>
        /// <param name="success">Whether the level was completed successfully.</param>
        /// <param name="score">Final score achieved.</param>
        public void LogLevelEnd(string levelName, bool success, int score)
        {
            LogEvent("level_end", new Dictionary<string, object>
            {
                { "level_name", levelName },
                { "success", success },
                { "score", score }
            });
        }

        /// <summary>
        /// Logs a virtual currency purchase event.
        /// </summary>
        /// <param name="itemId">The purchased item identifier.</param>
        /// <param name="currency">Currency type used.</param>
        /// <param name="price">Price paid.</param>
        public void LogPurchase(string itemId, string currency, double price)
        {
            LogEvent("purchase", new Dictionary<string, object>
            {
                { "item_id", itemId },
                { "currency", currency },
                { "price", price }
            });
        }

        /// <summary>
        /// Logs a login event with the authentication method.
        /// </summary>
        /// <param name="method">Authentication method used (e.g., "email", "google", "anonymous").</param>
        public void LogLogin(string method)
        {
            LogEvent("login", new Dictionary<string, object> { { "method", method } });
        }

        /// <summary>
        /// Logs a tutorial step completion.
        /// </summary>
        /// <param name="stepName">Name or identifier of the tutorial step.</param>
        public void LogTutorialStep(string stepName)
        {
            LogEvent("tutorial_step", new Dictionary<string, object> { { "step_name", stepName } });
        }

        /// <summary>
        /// Sets a user property for audience segmentation.
        /// </summary>
        /// <param name="name">Property name.</param>
        /// <param name="value">Property value.</param>
        public void SetUserProperty(string name, string value)
        {
            if (!EnableAnalytics) return;
#if FIREBASE
            FirebaseAnalytics.SetUserProperty(name, value);
#endif
        }

        #endregion

        #region --- Crashlytics ---

        /// <summary>
        /// Logs a breadcrumb message to Crashlytics for crash context.
        /// </summary>
        /// <param name="message">Message to log.</param>
        public void LogCrashlytics(string message)
        {
            if (!EnableCrashlytics) return;
#if FIREBASE
            FirebaseCrashlytics.Log(message);
#endif
            Debug.Log($"[Crashlytics] {message}");
        }

        /// <summary>
        /// Sets the user ID for Crashlytics crash reports.
        /// </summary>
        /// <param name="userId">User identifier.</param>
        public void SetCrashlyticsUserId(string userId)
        {
            if (!EnableCrashlytics) return;
#if FIREBASE
            FirebaseCrashlytics.SetUserId(userId);
#endif
        }

        /// <summary>
        /// Records a non-fatal exception to Crashlytics.
        /// </summary>
        /// <param name="exception">The exception to record.</param>
        public void RecordException(Exception exception)
        {
            if (!EnableCrashlytics) return;
#if FIREBASE
            FirebaseCrashlytics.LogException(exception);
#endif
            Debug.LogWarning($"[Crashlytics] Exception recorded: {exception.Message}");
        }

        #endregion

        #region --- Remote Config ---

        /// <summary>
        /// Fetches the latest Remote Config values from the server.
        /// </summary>
        public async Task FetchRemoteConfig()
        {
            if (!EnableRemoteConfig) return;

            try
            {
#if FIREBASE
                await FirebaseRemoteConfig.FetchAsync(TimeSpan.Zero);
                await FirebaseRemoteConfig.ActivateAsync();
                Debug.Log("[FirebaseManager] Remote Config fetched and activated.");
#else
                await Task.Delay(1);
#endif
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[FirebaseManager] Remote Config fetch failed: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets a string value from Remote Config.
        /// </summary>
        /// <param name="key">Config key.</param>
        /// <param name="defaultValue">Default value if key not found.</param>
        /// <returns>The config value.</returns>
        public string GetRemoteConfigString(string key, string defaultValue = "")
        {
#if FIREBASE
            return FirebaseRemoteConfig.GetValue(key).StringValue ?? defaultValue;
#else
            return defaultValue;
#endif
        }

        /// <summary>
        /// Gets an integer value from Remote Config.
        /// </summary>
        /// <param name="key">Config key.</param>
        /// <param name="defaultValue">Default value if key not found.</param>
        /// <returns>The config value.</returns>
        public int GetRemoteConfigInt(string key, int defaultValue = 0)
        {
#if FIREBASE
            return (int)FirebaseRemoteConfig.GetValue(key).LongValue;
#else
            return defaultValue;
#endif
        }

        /// <summary>
        /// Gets a boolean value from Remote Config.
        /// </summary>
        /// <param name="key">Config key.</param>
        /// <param name="defaultValue">Default value if key not found.</param>
        /// <returns>The config value.</returns>
        public bool GetRemoteConfigBool(string key, bool defaultValue = false)
        {
#if FIREBASE
            return FirebaseRemoteConfig.GetValue(key).BooleanValue;
#else
            return defaultValue;
#endif
        }

        /// <summary>
        /// Gets a double value from Remote Config.
        /// </summary>
        /// <param name="key">Config key.</param>
        /// <param name="defaultValue">Default value if key not found.</param>
        /// <returns>The config value.</returns>
        public double GetRemoteConfigDouble(string key, double defaultValue = 0)
        {
#if FIREBASE
            return FirebaseRemoteConfig.GetValue(key).DoubleValue;
#else
            return defaultValue;
#endif
        }

        #endregion
    }

    /// <summary>
    /// Result of an authentication operation.
    /// </summary>
    public struct AuthResult
    {
        /// <summary>Whether the authentication succeeded.</summary>
        public bool Success;

        /// <summary>The Firebase User ID.</summary>
        public string UserId;

        /// <summary>Error message if authentication failed.</summary>
        public string ErrorMessage;

        /// <summary>Whether this is a newly created user account.</summary>
        public bool IsNewUser;
    }
}
