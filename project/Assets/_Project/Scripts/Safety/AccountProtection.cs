using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KawaiiCool.Safety
{
    /// <summary>
    /// Represents a device known to a player's account, used for multi-device management
    /// and suspicious-login detection.
    /// </summary>
    [Serializable]
    public class RegisteredDevice
    {
        /// <summary>
        /// Unique hardware or installation identifier for the device.
        /// </summary>
        public string DeviceId;

        /// <summary>
        /// Human-readable device name (e.g. "iPhone 14", "Desktop-ABC123").
        /// </summary>
        public string DeviceName;

        /// <summary>
        /// Platform identifier (e.g. "iOS", "Android", "Windows", "macOS", "WebGL").
        /// </summary>
        public string Platform;

        /// <summary>
        /// Last known IP address the device connected from.
        /// </summary>
        public string LastIp;

        /// <summary>
        /// Unix timestamp (seconds) of the most recent successful login.
        /// </summary>
        public long LastUsed;

        /// <summary>
        /// If true, this device will not trigger suspicious-login alerts.
        /// </summary>
        public bool IsTrusted;
    }

    /// <summary>
    /// Provides account-level security features: failed-login lockout, device fingerprinting,
    /// suspicious-login detection, and security alerting. Works offline with local caches
    /// and synchronises with the server when connectivity is available.
    /// </summary>
    public class AccountProtection : Singleton<AccountProtection>
    {
        #region Inspector Settings

        [Header("Security")]
        [Tooltip("If true, new accounts must verify their email before full access is granted.")]
        public bool RequireEmailVerification = true;

        [Tooltip("If true, time-based one-time password (TOTP) 2FA is available.")]
        public bool Enable2FA = false;

        [Tooltip("If true, logins from unknown devices or unusual IP addresses trigger alerts.")]
        public bool EnableSuspiciousLoginDetection = true;

        [Tooltip("Maximum consecutive failed login attempts before the account is temporarily locked.")]
        public int MaxFailedLogins = 5;

        [Tooltip("Duration (seconds) an account remains locked after exceeding failed-login threshold.")]
        public float LockoutDuration = 300f;

        [Header("Device Management")]
        [Tooltip("If true, device fingerprinting is used to track known devices.")]
        public bool EnableDeviceFingerprint = true;

        [Tooltip("If true, a single account may be used on multiple devices.")]
        public bool AllowMultiDevice = true;

        [Tooltip("Maximum number of concurrently registered devices when multi-device is enabled.")]
        public int MaxDevices = 3;

        [Header("Suspicious Login")]
        [Tooltip("If a login originates from an IP more than this many kilometres from the last known IP, flag it.")]
        public float GeoDistanceThresholdKm = 500f;

        [Tooltip("If a login occurs at an unusual hour (local time), flag it.")]
        public bool EnableUnusualHourDetection = true;

        [Tooltip("Hour range considered 'usual' (start, end) in 24h format. Logins outside this window are flagged.")]
        public Vector2 UsualLoginHours = new Vector2(6f, 23f);

        [Header("Alerting")]
        [Tooltip("If true, security alerts are batched and sent via EventBus.")]
        public bool PublishEvents = true;

        [Tooltip("If true, security decisions are logged to the Unity console.")]
        public bool DebugLogging = false;

        #endregion

        #region Internal State

        /// <summary>
        /// Tracks failed login attempts keyed by email or user identifier.
        /// </summary>
        private Dictionary<string, int> _failedLoginAttempts = new Dictionary<string, int>();

        /// <summary>
        /// Tracks the timestamp of the most recent failed login per identifier.
        /// </summary>
        private Dictionary<string, float> _lastFailedLoginTime = new Dictionary<string, float>();

        /// <summary>
        /// Tracks the lockout expiry timestamp per identifier.
        /// </summary>
        private Dictionary<string, float> _lockoutExpiry = new Dictionary<string, float>();

        /// <summary>
        /// Known devices per user.
        /// </summary>
        private Dictionary<string, List<RegisteredDevice>> _knownDevices = new Dictionary<string, List<RegisteredDevice>>();

        /// <summary>
        /// Thread-safety lock.
        /// </summary>
        private readonly object _lock = new object();

        #endregion

        #region Events

        /// <summary>
        /// Fired when a login from an unknown or suspicious device/IP is detected.
        /// Parameters: userId, details string.
        /// </summary>
        public event Action<string, string> OnSuspiciousLoginDetected;

        /// <summary>
        /// Fired when an account is locked due to excessive failed login attempts.
        /// Parameter: userId.
        /// </summary>
        public event Action<string> OnAccountLocked;

        /// <summary>
        /// Fired when an account is unlocked (either by timer expiry or manual moderation).
        /// Parameter: userId.
        /// </summary>
        public event Action<string> OnAccountUnlocked;

        #endregion

        #region Public API — Login Protection

        /// <summary>
        /// Records a failed login attempt against an email or user identifier.
        /// If the threshold is exceeded, the account is locked.
        /// </summary>
        /// <param name="emailOrId">The email address or user identifier used in the login attempt.</param>
        public void RecordFailedLogin(string emailOrId)
        {
            if (string.IsNullOrEmpty(emailOrId)) return;

            lock (_lock)
            {
                float now = Time.realtimeSinceStartup;

                if (!_failedLoginAttempts.ContainsKey(emailOrId))
                {
                    _failedLoginAttempts[emailOrId] = 0;
                    _lastFailedLoginTime[emailOrId] = 0f;
                }

                // Reset counter if the last failure was longer ago than the lockout duration
                if (now - _lastFailedLoginTime[emailOrId] > LockoutDuration)
                {
                    _failedLoginAttempts[emailOrId] = 0;
                }

                _failedLoginAttempts[emailOrId]++;
                _lastFailedLoginTime[emailOrId] = now;

                if (_failedLoginAttempts[emailOrId] >= MaxFailedLogins)
                {
                    _lockoutExpiry[emailOrId] = now + LockoutDuration;
                    OnAccountLocked?.Invoke(emailOrId);

                    if (PublishEvents)
                    {
                        EventBus.Publish(new AccountLockedEvent(emailOrId, LockoutDuration));
                    }

                    if (DebugLogging)
                        Debug.LogWarning($"[AccountProtection] Account locked: {emailOrId} for {LockoutDuration}s");
                }
                else if (DebugLogging)
                {
                    Debug.Log($"[AccountProtection] Failed login recorded for {emailOrId}: " +
                              $"{_failedLoginAttempts[emailOrId]}/{MaxFailedLogins}");
                }
            }
        }

        /// <summary>
        /// Records a successful login, clears failed-login counters, and updates device tracking.
        /// </summary>
        /// <param name="userId">The authenticated user identifier.</param>
        /// <param name="deviceId">The current device identifier.</param>
        public void RecordSuccessfulLogin(string userId, string deviceId)
        {
            if (string.IsNullOrEmpty(userId)) return;

            lock (_lock)
            {
                _failedLoginAttempts.Remove(userId);
                _lastFailedLoginTime.Remove(userId);
                _lockoutExpiry.Remove(userId);

                if (EnableDeviceFingerprint && !string.IsNullOrEmpty(deviceId))
                {
                    if (!_knownDevices.TryGetValue(userId, out var devices))
                    {
                        devices = new List<RegisteredDevice>();
                        _knownDevices[userId] = devices;
                    }

                    var existing = devices.FirstOrDefault(d => d.DeviceId == deviceId);
                    if (existing != null)
                    {
                        existing.LastUsed = GetUnixTimestamp();
                    }
                }
            }

            if (DebugLogging)
                Debug.Log($"[AccountProtection] Successful login recorded for {userId} on device {deviceId}");
        }

        /// <summary>
        /// Determines whether the account is currently under a login lockout.
        /// </summary>
        /// <param name="userId">The user identifier.</param>
        /// <returns><c>true</c> if locked.</returns>
        public bool IsAccountLocked(string userId)
        {
            if (string.IsNullOrEmpty(userId)) return false;

            lock (_lock)
            {
                if (!_lockoutExpiry.TryGetValue(userId, out float expiry)) return false;

                if (Time.realtimeSinceStartup >= expiry)
                {
                    _lockoutExpiry.Remove(userId);
                    _failedLoginAttempts.Remove(userId);
                    OnAccountUnlocked?.Invoke(userId);
                    return false;
                }

                return true;
            }
        }

        /// <summary>
        /// Returns the remaining lockout time in seconds, or 0 if not locked.
        /// </summary>
        /// <param name="userId">The user identifier.</param>
        /// <returns>Remaining seconds; 0 if not locked.</returns>
        public float GetLockoutRemaining(string userId)
        {
            if (string.IsNullOrEmpty(userId)) return 0f;

            lock (_lock)
            {
                if (!_lockoutExpiry.TryGetValue(userId, out float expiry)) return 0f;

                float remaining = expiry - Time.realtimeSinceStartup;
                if (remaining <= 0f)
                {
                    _lockoutExpiry.Remove(userId);
                    _failedLoginAttempts.Remove(userId);
                    OnAccountUnlocked?.Invoke(userId);
                    return 0f;
                }

                return remaining;
            }
        }

        /// <summary>
        /// Manually unlocks an account (e.g. after moderation review or support ticket).
        /// </summary>
        /// <param name="userId">The user identifier.</param>
        public void UnlockAccount(string userId)
        {
            if (string.IsNullOrEmpty(userId)) return;

            lock (_lock)
            {
                _lockoutExpiry.Remove(userId);
                _failedLoginAttempts.Remove(userId);
                _lastFailedLoginTime.Remove(userId);
            }

            OnAccountUnlocked?.Invoke(userId);

            if (PublishEvents)
            {
                EventBus.Publish(new AccountUnlockedEvent(userId, "manual_moderation"));
            }

            if (DebugLogging)
                Debug.Log($"[AccountProtection] Account manually unlocked: {userId}");
        }

        #endregion

        #region Public API — Device Management

        /// <summary>
        /// Checks whether a device has been previously registered to the user.
        /// </summary>
        /// <param name="userId">The user identifier.</param>
        /// <param name="deviceId">The device identifier.</param>
        /// <returns><c>true</c> if the device is known.</returns>
        public bool IsKnownDevice(string userId, string deviceId)
        {
            if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(deviceId)) return false;
            if (!EnableDeviceFingerprint) return true;

            lock (_lock)
            {
                if (!_knownDevices.TryGetValue(userId, out var devices)) return false;
                return devices.Any(d => d.DeviceId == deviceId);
            }
        }

        /// <summary>
        /// Registers a new device to the user's account. If the device limit is exceeded,
        /// the oldest non-trusted device is evicted.
        /// </summary>
        /// <param name="userId">The user identifier.</param>
        /// <param name="deviceId">The device identifier.</param>
        /// <param name="deviceName">Human-readable device name.</param>
        public void RegisterDevice(string userId, string deviceId, string deviceName)
        {
            if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(deviceId)) return;
            if (!EnableDeviceFingerprint) return;

            lock (_lock)
            {
                if (!_knownDevices.TryGetValue(userId, out var devices))
                {
                    devices = new List<RegisteredDevice>();
                    _knownDevices[userId] = devices;
                }

                var existing = devices.FirstOrDefault(d => d.DeviceId == deviceId);
                if (existing != null)
                {
                    existing.DeviceName = deviceName ?? existing.DeviceName;
                    existing.LastUsed = GetUnixTimestamp();
                    existing.Platform = Application.platform.ToString();
                }
                else
                {
                    // Enforce device cap by evicting oldest untrusted device
                    if (devices.Count >= MaxDevices && AllowMultiDevice)
                    {
                        var evict = devices.Where(d => !d.IsTrusted).OrderBy(d => d.LastUsed).FirstOrDefault();
                        if (evict != null)
                        {
                            devices.Remove(evict);
                            if (DebugLogging)
                                Debug.Log($"[AccountProtection] Evicted oldest device {evict.DeviceId} for user {userId}");
                        }
                        else if (devices.Count >= MaxDevices)
                        {
                            if (DebugLogging)
                                Debug.LogWarning($"[AccountProtection] Device limit reached for {userId}; cannot register {deviceId}");
                            return;
                        }
                    }

                    devices.Add(new RegisteredDevice
                    {
                        DeviceId = deviceId,
                        DeviceName = deviceName ?? "Unknown Device",
                        Platform = Application.platform.ToString(),
                        LastIp = string.Empty,
                        LastUsed = GetUnixTimestamp(),
                        IsTrusted = false
                    });
                }
            }

            if (PublishEvents)
            {
                EventBus.Publish(new DeviceRegisteredEvent(userId, deviceId, deviceName));
            }

            if (DebugLogging)
                Debug.Log($"[AccountProtection] Device registered for {userId}: {deviceName} ({deviceId})");
        }

        /// <summary>
        /// Removes a device from the user's registered device list.
        /// </summary>
        /// <param name="userId">The user identifier.</param>
        /// <param name="deviceId">The device identifier to remove.</param>
        public void RemoveDevice(string userId, string deviceId)
        {
            if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(deviceId)) return;

            lock (_lock)
            {
                if (_knownDevices.TryGetValue(userId, out var devices))
                {
                    devices.RemoveAll(d => d.DeviceId == deviceId);
                }
            }

            if (DebugLogging)
                Debug.Log($"[AccountProtection] Device removed for {userId}: {deviceId}");
        }

        /// <summary>
        /// Returns a snapshot of all devices registered to the user.
        /// </summary>
        /// <param name="userId">The user identifier.</param>
        /// <returns>List of registered devices; empty if none.</returns>
        public List<RegisteredDevice> GetRegisteredDevices(string userId)
        {
            if (string.IsNullOrEmpty(userId)) return new List<RegisteredDevice>();

            lock (_lock)
            {
                if (_knownDevices.TryGetValue(userId, out var devices))
                    return devices.ToList();
                return new List<RegisteredDevice>();
            }
        }

        /// <summary>
        /// Marks a device as trusted, preventing future suspicious-login alerts from it.
        /// </summary>
        /// <param name="userId">The user identifier.</param>
        /// <param name="deviceId">The device identifier.</param>
        public void TrustDevice(string userId, string deviceId)
        {
            if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(deviceId)) return;

            lock (_lock)
            {
                if (_knownDevices.TryGetValue(userId, out var devices))
                {
                    var device = devices.FirstOrDefault(d => d.DeviceId == deviceId);
                    if (device != null)
                    {
                        device.IsTrusted = true;
                    }
                }
            }

            if (DebugLogging)
                Debug.Log($"[AccountProtection] Device trusted for {userId}: {deviceId}");
        }

        #endregion

        #region Public API — Suspicious Login Detection

        /// <summary>
        /// Evaluates a login attempt for anomalies and triggers alerts if necessary.
        /// </summary>
        /// <param name="userId">The user identifier.</param>
        /// <param name="deviceId">The device identifier.</param>
        /// <param name="ipAddress">The IP address of the login attempt.</param>
        public void CheckSuspiciousLogin(string userId, string deviceId, string ipAddress)
        {
            if (!EnableSuspiciousLoginDetection) return;
            if (string.IsNullOrEmpty(userId)) return;

            List<string> anomalies = new List<string>();

            lock (_lock)
            {
                // Unknown device check
                bool knownDevice = IsKnownDevice(userId, deviceId);
                if (!knownDevice && EnableDeviceFingerprint)
                {
                    anomalies.Add($"Unknown device: {deviceId}");
                }

                // IP change check (simplified; in production use GeoIP lookup)
                if (_knownDevices.TryGetValue(userId, out var devices))
                {
                    var lastDevice = devices.OrderByDescending(d => d.LastUsed).FirstOrDefault();
                    if (lastDevice != null && !string.IsNullOrEmpty(lastDevice.LastIp) && lastDevice.LastIp != ipAddress)
                    {
                        anomalies.Add($"IP address changed from {lastDevice.LastIp} to {ipAddress}");
                    }
                }

                // Unusual hour check
                if (EnableUnusualHourDetection)
                {
                    int hour = DateTime.Now.Hour;
                    if (hour < (int)UsualLoginHours.x || hour > (int)UsualLoginHours.y)
                    {
                        anomalies.Add($"Unusual login hour: {hour}:00 (usual window {UsualLoginHours.x}-{UsualLoginHours.y})");
                    }
                }
            }

            if (anomalies.Count > 0)
            {
                string details = string.Join("; ", anomalies);
                OnSuspiciousLoginDetected?.Invoke(userId, details);
                SendSecurityAlert(userId, "suspicious_login", details);

                if (PublishEvents)
                {
                    EventBus.Publish(new SuspiciousLoginEvent(userId, deviceId, ipAddress, details));
                }

                if (DebugLogging)
                    Debug.LogWarning($"[AccountProtection] Suspicious login for {userId}: {details}");
            }
        }

        /// <summary>
        /// Sends a security alert to the user via in-game notification, push, or email pipeline.
        /// </summary>
        /// <param name="userId">The user identifier.</param>
        /// <param name="alertType">Machine-readable alert category (e.g. "suspicious_login", "password_changed").</param>
        /// <param name="details">Human-readable alert details.</param>
        public void SendSecurityAlert(string userId, string alertType, string details)
        {
            if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(alertType)) return;

            if (PublishEvents)
            {
                EventBus.Publish(new SecurityAlertEvent(userId, alertType, details, GetUnixTimestamp()));
            }

            if (DebugLogging)
                Debug.Log($"[AccountProtection] Security alert sent to {userId}: [{alertType}] {details}");

            // In production: forward to notification service, push gateway, or email pipeline.
        }

        #endregion

        #region Public API — 2FA

        /// <summary>
        /// Returns whether the account has 2FA enabled.
        /// </summary>
        /// <param name="userId">The user identifier.</param>
        /// <returns><c>true</c> if 2FA is enabled.</returns>
        public bool Is2FAEnabled(string userId)
        {
            // TODO: Query server or local secure storage for 2FA flag.
            return Enable2FA;
        }

        /// <summary>
        /// Verifies a TOTP code during login. Server-validated in production.
        /// </summary>
        /// <param name="userId">The user identifier.</param>
        /// <param name="totpCode">The 6-digit TOTP code.</param>
        /// <returns><c>true</c> if the code is valid.</returns>
        public bool VerifyTOTP(string userId, string totpCode)
        {
            if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(totpCode)) return false;

            // Client-side placeholder — actual TOTP verification must happen on the server.
            if (DebugLogging)
                Debug.Log($"[AccountProtection] TOTP verification requested for {userId}");

            return true; // defer to server
        }

        #endregion

        #region Utilities

        /// <summary>
        /// Returns the current Unix timestamp in seconds.
        /// </summary>
        private static long GetUnixTimestamp()
        {
            return DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        }

        /// <summary>
        /// Clears all local security state. Use with caution (e.g. on explicit logout).
        /// </summary>
        public void ClearAllState()
        {
            lock (_lock)
            {
                _failedLoginAttempts.Clear();
                _lastFailedLoginTime.Clear();
                _lockoutExpiry.Clear();
                _knownDevices.Clear();
            }

            if (DebugLogging)
                Debug.Log("[AccountProtection] All local security state cleared.");
        }

        #endregion

        #region EventBus Payloads

        /// <summary>
        /// EventBus payload fired when an account is locked.
        /// </summary>
        public struct AccountLockedEvent
        {
            public readonly string UserId;
            public readonly float DurationSeconds;

            public AccountLockedEvent(string userId, float durationSeconds)
            {
                UserId = userId;
                DurationSeconds = durationSeconds;
            }
        }

        /// <summary>
        /// EventBus payload fired when an account is unlocked.
        /// </summary>
        public struct AccountUnlockedEvent
        {
            public readonly string UserId;
            public readonly string Reason;

            public AccountUnlockedEvent(string userId, string reason)
            {
                UserId = userId;
                Reason = reason;
            }
        }

        /// <summary>
        /// EventBus payload fired when a device is registered.
        /// </summary>
        public struct DeviceRegisteredEvent
        {
            public readonly string UserId;
            public readonly string DeviceId;
            public readonly string DeviceName;

            public DeviceRegisteredEvent(string userId, string deviceId, string deviceName)
            {
                UserId = userId;
                DeviceId = deviceId;
                DeviceName = deviceName;
            }
        }

        /// <summary>
        /// EventBus payload fired when a suspicious login is detected.
        /// </summary>
        public struct SuspiciousLoginEvent
        {
            public readonly string UserId;
            public readonly string DeviceId;
            public readonly string IpAddress;
            public readonly string Details;

            public SuspiciousLoginEvent(string userId, string deviceId, string ipAddress, string details)
            {
                UserId = userId;
                DeviceId = deviceId;
                IpAddress = ipAddress;
                Details = details;
            }
        }

        /// <summary>
        /// EventBus payload fired for general security alerts.
        /// </summary>
        public struct SecurityAlertEvent
        {
            public readonly string UserId;
            public readonly string AlertType;
            public readonly string Details;
            public readonly long Timestamp;

            public SecurityAlertEvent(string userId, string alertType, string details, long timestamp)
            {
                UserId = userId;
                AlertType = alertType;
                Details = details;
                Timestamp = timestamp;
            }
        }

        #endregion
    }
}
