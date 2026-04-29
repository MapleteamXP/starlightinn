using System;
using UnityEngine;

namespace KawaiiCoolIsland.Performance
{
    /// <summary>
    /// Adaptive frame-rate targeting system for KawaiiCool Island v3.0.
    /// Sets the application's target frame rate, manages VSync, and automatically
    /// throttles the frame rate when the application loses focus or enters the
    /// background. Provides platform-specific defaults for mobile, desktop, and console.
    /// </summary>
    public class FrameRateTarget : MonoBehaviour
    {
        #region Header: Target

        [Header("Target")]
        [Tooltip("Desired frame rate when the application is active and focused.")]
        public int TargetFrameRate = 60;

        [Tooltip("Absolute minimum frame rate the adaptive system will ever set.")]
        public int MinFrameRate = 30;

        [Tooltip("Enable vertical sync to synchronize frame presentation with the display refresh.")]
        public bool UseVSync = false;

        [Tooltip("VSync count (0 = off, 1 = every refresh, 2 = every 2nd refresh).")]
        [Range(0, 4)]
        public int VSyncCount = 0;

        #endregion

        #region Header: Adaptive

        [Header("Adaptive")]
        [Tooltip("Dynamically adjust target frame rate based on measured performance.")]
        public bool AdaptiveFrameRate = true;

        [Tooltip("Speed at which the adaptive system changes the target frame rate (0 = instant, 1 = very slow).")]
        [Range(0.01f, 2f)]
        public float AdaptationSpeed = 0.5f;

        [Tooltip("Frame rate target when the application window is not focused.")]
        public int IdleFrameRate = 30;

        [Tooltip("Frame rate target when the application is paused / backgrounded.")]
        public int BackgroundFrameRate = 10;

        #endregion

        #region Header: Platform

        [Header("Platform")]
        [Tooltip("Default target frame rate on mobile platforms (iOS / Android).")]
        public int MobileTarget = 60;

        [Tooltip("Default target frame rate on desktop platforms (Windows / macOS / Linux).")]
        public int DesktopTarget = 144;

        [Tooltip("Default target frame rate on console platforms.")]
        public int ConsoleTarget = 60;

        #endregion

        #region Private State

        private int _currentTarget;
        private int _appliedTarget;
        private bool _isFocused = true;
        private bool _isPaused;
        private float _adaptiveSmoothedFPS;
        private const float FPSSmoothFactor = 0.1f;

        #endregion

        #region Events

        /// <summary>Fired when the active target frame rate changes.</summary>
        public event Action<int> OnTargetFrameRateChanged;

        /// <summary>Fired when focus state changes.</summary>
        public event Action<bool> OnFocusStateChanged;

        #endregion

        #region Unity Lifecycle

        private void Start()
        {
            ApplyPlatformSettings();
            ApplyFrameRate();
        }

        private void Update()
        {
            if (AdaptiveFrameRate && _isFocused && !_isPaused)
            {
                AdaptFrameRate();
            }

            // Detect changes from external scripts
            if (Application.targetFrameRate != _appliedTarget)
            {
                _appliedTarget = Application.targetFrameRate;
            }
        }

        private void OnApplicationFocus(bool hasFocus)
        {
            _isFocused = hasFocus;
            OnFocusStateChanged?.Invoke(hasFocus);

            if (hasFocus)
            {
                SetActiveMode();
            }
            else
            {
                SetIdleMode();
            }
        }

        private void OnApplicationPause(bool pause)
        {
            _isPaused = pause;
            if (pause)
            {
                SetBackgroundMode();
            }
            else if (_isFocused)
            {
                SetActiveMode();
            }
        }

        #endregion

        #region Public API: Frame Rate Control

        /// <summary>
        /// Sets the application's target frame rate immediately.
        /// </summary>
        /// <param name="fps">Desired frames per second.</param>
        public void SetTargetFrameRate(int fps)
        {
            TargetFrameRate = Mathf.Clamp(fps, MinFrameRate, 1000);
            ApplyFrameRate();
        }

        /// <summary>
        /// Enables or disables vertical sync.
        /// </summary>
        /// <param name="enable">True to enable VSync.</param>
        public void SetVSync(bool enable)
        {
            UseVSync = enable;
            VSyncCount = enable ? 1 : 0;
            QualitySettings.vSyncCount = VSyncCount;
        }

        /// <summary>
        /// Enables or disables the adaptive frame rate subsystem.
        /// </summary>
        /// <param name="enable">True to enable adaptation.</param>
        public void EnableAdaptive(bool enable)
        {
            AdaptiveFrameRate = enable;
            if (!enable)
            {
                SetTargetFrameRate(TargetFrameRate);
            }
        }

        /// <summary>
        /// Switches to idle frame rate (window not focused).
        /// </summary>
        public void SetIdleMode()
        {
            _currentTarget = IdleFrameRate;
            ApplyFrameRate();
        }

        /// <summary>
        /// Switches to active frame rate (window focused and in foreground).
        /// </summary>
        public void SetActiveMode()
        {
            _currentTarget = TargetFrameRate;
            ApplyFrameRate();
        }

        /// <summary>
        /// Switches to background frame rate (application paused).
        /// </summary>
        public void SetBackgroundMode()
        {
            _currentTarget = BackgroundFrameRate;
            ApplyFrameRate();
        }

        #endregion

        #region Platform & Adaptive Logic

        private void ApplyPlatformSettings()
        {
#if UNITY_IOS || UNITY_ANDROID
            TargetFrameRate = MobileTarget;
            UseVSync = true;
            VSyncCount = 1;
#elif UNITY_STANDALONE
            TargetFrameRate = DesktopTarget;
            UseVSync = false;
            VSyncCount = 0;
#elif UNITY_GAMECORE || UNITY_PS5 || UNITY_SWITCH
            TargetFrameRate = ConsoleTarget;
            UseVSync = true;
            VSyncCount = 1;
#else
            TargetFrameRate = 60;
            UseVSync = false;
            VSyncCount = 0;
#endif
            _currentTarget = TargetFrameRate;
        }

        private void AdaptFrameRate()
        {
            if (Time.deltaTime <= 0f) return;

            float instantFPS = 1f / Time.unscaledDeltaTime;
            _adaptiveSmoothedFPS = Mathf.Lerp(_adaptiveSmoothedFPS, instantFPS, FPSSmoothFactor);

            int desiredTarget;
            if (_adaptiveSmoothedFPS < TargetFrameRate - 10f)
            {
                // Performance is struggling: temporarily lower target to relieve pressure
                desiredTarget = Mathf.Max(MinFrameRate, TargetFrameRate - 15);
            }
            else if (_adaptiveSmoothedFPS > TargetFrameRate + 5f)
            {
                // Headroom available: raise back toward preferred target
                desiredTarget = TargetFrameRate;
            }
            else
            {
                desiredTarget = _currentTarget;
            }

            // Smoothly approach the desired target
            int diff = desiredTarget - _currentTarget;
            if (Mathf.Abs(diff) > 0)
            {
                int step = Mathf.Max(1, Mathf.RoundToInt(Mathf.Abs(diff) * AdaptationSpeed * Time.deltaTime * 10f));
                _currentTarget += Mathf.Sign(diff) * step;
                _currentTarget = Mathf.Clamp(_currentTarget, MinFrameRate, TargetFrameRate);
                ApplyFrameRate();
            }
        }

        private void ApplyFrameRate()
        {
            int newTarget = _currentTarget;

            if (UseVSync && VSyncCount > 0)
            {
                QualitySettings.vSyncCount = VSyncCount;
                // When VSync is on, targetFrameRate is treated as a cap by some platforms
                Application.targetFrameRate = newTarget;
            }
            else
            {
                QualitySettings.vSyncCount = 0;
                Application.targetFrameRate = newTarget;
            }

            if (newTarget != _appliedTarget)
            {
                _appliedTarget = newTarget;
                OnTargetFrameRateChanged?.Invoke(newTarget);
                EventBus.Publish(new FrameRateChangedEvent { NewTarget = newTarget });
                Debug.Log($"[FrameRateTarget] Target frame rate set to {newTarget} (VSync: {UseVSync}, Count: {VSyncCount}).");
            }
        }

        #endregion
    }

    #region EventBus Events

    /// <summary>Event published whenever the frame rate target changes.</summary>
    public struct FrameRateChangedEvent
    {
        public int NewTarget;
    }

    #endregion
}
