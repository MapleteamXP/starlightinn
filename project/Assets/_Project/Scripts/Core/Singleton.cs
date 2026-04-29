// ----------------------------------------------------------------------------
// KawaiiCool Island - Core Framework
// ----------------------------------------------------------------------------
// Singleton.cs - Generic singleton base class for MonoBehaviour-derived managers
// ----------------------------------------------------------------------------
// This class provides a thread-safe, generic singleton pattern for Unity
// MonoBehaviours. Supports optional DontDestroyOnLoad persistence across scenes.
// ----------------------------------------------------------------------------

using UnityEngine;

namespace KawaiiCoolIsland.Core
{
    /// <summary>
    /// Abstract generic singleton base class for MonoBehaviour-derived components.
    /// Provides thread-safe lazy initialization with optional scene persistence.
    /// </summary>
    /// <typeparam name="T">The concrete MonoBehaviour type to singleton-ize.</typeparam>
    public abstract class Singleton<T> : MonoBehaviour where T : MonoBehaviour
    {
        #region Fields

        /// <summary>
        /// Thread-safe lock for instance initialization.
        /// </summary>
        private static readonly object _lock = new object();

        /// <summary>
        /// Volatile flag indicating whether application is quitting.
        /// Prevents re-creation during shutdown.
        /// </summary>
        private static bool _isQuitting = false;

        /// <summary>
        /// Cached instance reference for fast access.
        /// </summary>
        private static T _instance;

        #endregion

        #region Properties

        /// <summary>
        /// Gets the singleton instance. Creates one if none exists.
        /// Thread-safe and null-checked.
        /// </summary>
        public static T Instance
        {
            get
            {
                if (_isQuitting)
                {
                    Debug.LogWarning(
                        $"[Singleton] Instance of '{typeof(T)}' already destroyed on application quit. " +
                        "Won't create again - returning null."
                    );
                    return null;
                }

                lock (_lock)
                {
                    if (_instance == null)
                    {
                        _instance = FindFirstObjectByType<T>();

                        if (_instance == null)
                        {
                            var singletonObject = new GameObject(
                                $"[Singleton] {typeof(T).Name}"
                            );
                            _instance = singletonObject.AddComponent<T>();

                            Debug.Log(
                                $"[Singleton] An instance of '{typeof(T)}' was created automatically. " +
                                $"Consider adding it to your Bootstrapper scene for explicit control."
                            );
                        }
                    }

                    return _instance;
                }
            }
        }

        /// <summary>
        /// When true, the GameObject will persist across scene loads via DontDestroyOnLoad.
        /// Override in derived classes to control persistence behavior.
        /// </summary>
        protected virtual bool PersistAcrossScenes => true;

        #endregion

        #region Unity Lifecycle

        /// <summary>
        /// Unity Awake. Sets up the singleton instance and applies persistence settings.
        /// Call base.Awake() when overriding.
        /// </summary>
        protected virtual void Awake()
        {
            lock (_lock)
            {
                if (_instance != null && _instance != this)
                {
                    Debug.LogWarning(
                        $"[Singleton] Duplicate instance of '{typeof(T)}' detected on '{gameObject.name}'. " +
                        "Destroying duplicate."
                    );
                    Destroy(gameObject);
                    return;
                }

                _instance = this as T;

                if (PersistAcrossScenes)
                {
                    var root = transform.root;
                    if (root != transform)
                    {
                        Debug.LogWarning(
                            $"[Singleton] '{typeof(T).Name}' is not a root GameObject. " +
                            "DontDestroyOnLoad only works on root objects. Reparenting to root."
                        );
                        transform.SetParent(null);
                    }
                    DontDestroyOnLoad(gameObject);
                }

                OnSingletonAwake();
            }
        }

        /// <summary>
        /// Called after singleton initialization is complete in Awake.
        /// Use this instead of overriding Awake in derived classes.
        /// </summary>
        protected virtual void OnSingletonAwake() { }

        /// <summary>
        /// Unity OnDestroy. Clears the instance reference when this object is destroyed.
        /// </summary>
        protected virtual void OnDestroy()
        {
            lock (_lock)
            {
                if (_instance == this)
                {
                    _instance = null;
                }
            }
        }

        /// <summary>
        /// Unity OnApplicationQuit. Marks the application as quitting to prevent
        /// re-creation of singleton instances during shutdown.
        /// </summary>
        protected virtual void OnApplicationQuit()
        {
            _isQuitting = true;
        }

        #endregion

        #region Public Methods

        /// <summary>
        /// Checks whether the singleton instance currently exists without triggering creation.
        /// </summary>
        /// <returns>True if the instance has been initialized and is available.</returns>
        public static bool HasInstance => _instance != null;

        /// <summary>
        /// Attempts to get the existing instance without triggering auto-creation.
        /// </summary>
        /// <param name="result">The instance if available, null otherwise.</param>
        /// <returns>True if the instance exists.</returns>
        public static bool TryGetInstance(out T result)
        {
            result = _instance;
            return _instance != null;
        }

        #endregion
    }
}
