// ----------------------------------------------------------------------------
// KawaiiCool Island - Core Framework
// ----------------------------------------------------------------------------
// ObjectPool.cs - Generic object pooling system
// ----------------------------------------------------------------------------
// Provides a type-safe, generic object pool for Unity Components.
// Supports prewarming, automatic expansion, and lifecycle callbacks.
// Reduces GC pressure by reusing objects instead of instantiating/destroying.
// Use for frequently spawned/despawned objects like particle effects, projectiles,
// UI elements, and temporary gameplay objects.
// ----------------------------------------------------------------------------

using System;
using System.Collections.Generic;
using UnityEngine;

namespace KawaiiCoolIsland.Core
{
    /// <summary>
    /// Generic object pool for Unity Component types.
    /// Efficiently reuses objects to minimize garbage collection and instantiation overhead.
    /// </summary>
    /// <typeparam name="T">The Component type to pool. Must have a parameterless instantiation path.</typeparam>
    public class ObjectPool<T> where T : Component
    {
        #region Configuration

        /// <summary>
        /// The prefab used to create new pooled objects.
        /// </summary>
        private readonly T _prefab;

        /// <summary>
        /// The Transform under which pooled objects are parented.
        /// </summary>
        private readonly Transform _parent;

        /// <summary>
        /// Initial pool size and number of objects created per expansion.
        /// </summary>
        private readonly int _defaultCapacity;

        /// <summary>
        /// Maximum number of objects the pool will maintain.
        /// Requests beyond this will create temporary (non-pooled) objects.
        /// </summary>
        private readonly int _maxCapacity;

        #endregion

        #region State

        /// <summary>
        /// The stack of available (inactive) pooled objects.
        /// </summary>
        private readonly Stack<T> _pool;

        /// <summary>
        /// Set of all objects currently in use (active).
        /// Used to prevent double-returns and track pool utilization.
        /// </summary>
        private readonly HashSet<T> _activeObjects;

        /// <summary>
        /// Total number of objects instantiated by this pool.
        /// </summary>
        private int _totalCreated = 0;

        /// <summary>
        /// Whether the pool has been disposed.
        /// </summary>
        private bool _isDisposed = false;

        #endregion

        #region Callbacks

        /// <summary>
        /// Called when an object is retrieved from the pool.
        /// Use this to reset/initialize the object before use.
        /// </summary>
        public event Action<T> OnGet;

        /// <summary>
        /// Called when an object is returned to the pool.
        /// Use this to clean up/reset the object before deactivation.
        /// </summary>
        public event Action<T> OnReturn;

        /// <summary>
        /// Called when a new object is created by the pool.
        /// Use this to perform one-time setup on new instances.
        /// </summary>
        public event Action<T> OnCreate;

        /// <summary>
        /// Called when an object is destroyed due to pool overflow or disposal.
        /// </summary>
        public event Action<T> OnDestroyObject;

        #endregion

        #region Properties

        /// <summary>
        /// Number of objects currently available in the pool (inactive).
        /// </summary>
        public int AvailableCount => _pool?.Count ?? 0;

        /// <summary>
        /// Number of objects currently in use (active).
        /// </summary>
        public int ActiveCount => _activeObjects?.Count ?? 0;

        /// <summary>
        /// Total number of objects managed by this pool (active + available).
        /// </summary>
        public int TotalCount => _totalCreated;

        /// <summary>
        /// Maximum capacity of this pool.
        /// </summary>
        public int MaxCapacity => _maxCapacity;

        /// <summary>
        /// Whether the pool has been disposed and should not be used.
        /// </summary>
        public bool IsDisposed => _isDisposed;

        /// <summary>
        /// Current utilization ratio (0.0 to 1.0).
        /// </summary>
        public float UtilizationRatio => _totalCreated > 0 ? (float)ActiveCount / _totalCreated : 0f;

        #endregion

        #region Constructors

        /// <summary>
        /// Creates a new object pool.
        /// </summary>
        /// <param name="prefab">The prefab to use for creating pooled objects.</param>
        /// <param name="parent">Optional parent Transform for pooled objects. Created automatically if null.</param>
        /// <param name="defaultCapacity">Initial pool size and expansion batch size.</param>
        /// <param name="maxCapacity">Maximum number of objects to pool. Extra objects are destroyed when returned.</param>
        /// <exception cref="ArgumentNullException">Thrown if prefab is null.</exception>
        /// <exception cref="ArgumentException">Thrown if capacities are invalid.</exception>
        public ObjectPool(T prefab, Transform parent = null, int defaultCapacity = 10, int maxCapacity = 100)
        {
            if (prefab == null)
                throw new ArgumentNullException(nameof(prefab), "Pool prefab cannot be null.");
            if (defaultCapacity <= 0)
                throw new ArgumentException("Default capacity must be positive.", nameof(defaultCapacity));
            if (maxCapacity < defaultCapacity)
                throw new ArgumentException("Max capacity must be >= default capacity.", nameof(maxCapacity));

            _prefab = prefab;
            _defaultCapacity = defaultCapacity;
            _maxCapacity = maxCapacity;

            // Create a parent container if none provided
            if (parent == null)
            {
                GameObject container = new GameObject($"[Pool] {typeof(T).Name}");
                _parent = container.transform;
            }
            else
            {
                _parent = parent;
            }

            _pool = new Stack<T>(defaultCapacity);
            _activeObjects = new HashSet<T>();
        }

        #endregion

        #region Core Operations

        /// <summary>
        /// Retrieves an object from the pool. If none are available, creates a new one.
        /// The object is activated and returned ready for use.
        /// </summary>
        /// <returns>An active object from the pool.</returns>
        public T Get()
        {
            if (_isDisposed)
            {
                Debug.LogError($"[ObjectPool<{typeof(T).Name}>] Cannot Get from disposed pool.");
                return null;
            }

            T obj;

            if (_pool.Count > 0)
            {
                obj = _pool.Pop();
            }
            else if (_totalCreated < _maxCapacity)
            {
                obj = CreateNewObject();
            }
            else
            {
                // Max capacity reached - create a temporary object (not pooled)
                Debug.LogWarning(
                    $"[ObjectPool<{typeof(T).Name}>] Max capacity ({_maxCapacity}) reached. " +
                    "Creating temporary non-pooled object. Consider increasing max capacity."
                );
                obj = CreateNewObject(isTemporary: true);
            }

            if (obj != null)
            {
                obj.gameObject.SetActive(true);
                _activeObjects.Add(obj);
                OnGet?.Invoke(obj);
            }

            return obj;
        }

        /// <summary>
        /// Retrieves an object and applies a position/rotation before returning it.
        /// </summary>
        /// <param name="position">World position to place the object.</param>
        /// <param name="rotation">World rotation to apply.</param>
        /// <param name="parent">Optional parent transform.</param>
        /// <returns>An active object from the pool at the specified transform.</returns>
        public T Get(Vector3 position, Quaternion rotation, Transform parent = null)
        {
            T obj = Get();
            if (obj != null)
            {
                obj.transform.SetPositionAndRotation(position, rotation);
                if (parent != null)
                {
                    obj.transform.SetParent(parent, worldPositionStays: true);
                }
            }
            return obj;
        }

        /// <summary>
        /// Returns an object to the pool. The object is deactivated and made available for reuse.
        /// </summary>
        /// <param name="obj">The object to return to the pool.</param>
        public void Return(T obj)
        {
            if (_isDisposed)
            {
                Debug.LogError($"[ObjectPool<{typeof(T).Name}>] Cannot Return to disposed pool.");
                return;
            }

            if (obj == null)
            {
                Debug.LogWarning($"[ObjectPool<{typeof(T).Name}>] Attempted to return null object.");
                return;
            }

            // Check if this object belongs to our active set
            if (!_activeObjects.Contains(obj))
            {
                // Object may already be returned, or is a temporary object
                if (!_pool.Contains(obj))
                {
                    // It's a temporary object or from another pool - just destroy it
                    OnDestroyObject?.Invoke(obj);
                    if (obj != null && obj.gameObject != null)
                    {
                        UnityEngine.Object.Destroy(obj.gameObject);
                    }
                }
                return;
            }

            // Remove from active set
            _activeObjects.Remove(obj);

            // Invoke return callback
            OnReturn?.Invoke(obj);

            // Check if we should pool this object or destroy it (over capacity)
            if (_pool.Count >= _maxCapacity)
            {
                OnDestroyObject?.Invoke(obj);
                if (obj != null && obj.gameObject != null)
                {
                    UnityEngine.Object.Destroy(obj.gameObject);
                }
                _totalCreated--;
                return;
            }

            // Reset transform and parent
            obj.transform.SetParent(_parent);
            obj.gameObject.SetActive(false);

            _pool.Push(obj);
        }

        /// <summary>
        /// Returns all active objects to the pool.
        /// Useful for scene transitions or game state resets.
        /// </summary>
        public void ReturnAll()
        {
            if (_isDisposed) return;

            // Create a copy to avoid modification during iteration
            T[] active = new T[_activeObjects.Count];
            _activeObjects.CopyTo(active);

            foreach (T obj in active)
            {
                if (obj != null)
                {
                    Return(obj);
                }
            }
        }

        #endregion

        #region Prewarm & Expansion

        /// <summary>
        /// Pre-creates objects to fill the pool to the specified count.
        /// Call during loading screens to avoid runtime instantiation stalls.
        /// </summary>
        /// <param name="count">Number of objects to ensure exist in the pool.</param>
        public void Prewarm(int count)
        {
            if (_isDisposed) return;

            int toCreate = Mathf.Min(count, _maxCapacity) - (_pool.Count + _activeObjects.Count);
            toCreate = Mathf.Max(0, toCreate);

            for (int i = 0; i < toCreate; i++)
            {
                if (_totalCreated >= _maxCapacity) break;

                T obj = CreateNewObject();
                if (obj != null)
                {
                    obj.gameObject.SetActive(false);
                    _pool.Push(obj);
                }
            }

            Debug.Log(
                $"[ObjectPool<{typeof(T).Name}>] Prewarmed. " +
                $"Available: {_pool.Count}, Active: {_activeObjects.Count}, Total: {_totalCreated}"
            );
        }

        /// <summary>
        /// Expands the pool by the default capacity amount.
        /// </summary>
        public void Expand()
        {
            Prewarm(_pool.Count + _activeObjects.Count + _defaultCapacity);
        }

        #endregion

        #region Lifecycle

        /// <summary>
        /// Disposes the pool, destroying all managed objects and clearing state.
        /// The pool cannot be used after disposal.
        /// </summary>
        public void Dispose()
        {
            if (_isDisposed) return;

            _isDisposed = true;

            // Destroy all pooled (inactive) objects
            while (_pool.Count > 0)
            {
                T obj = _pool.Pop();
                if (obj != null && obj.gameObject != null)
                {
                    OnDestroyObject?.Invoke(obj);
                    UnityEngine.Object.Destroy(obj.gameObject);
                }
            }

            // Destroy all active objects
            foreach (T obj in _activeObjects)
            {
                if (obj != null && obj.gameObject != null)
                {
                    OnDestroyObject?.Invoke(obj);
                    UnityEngine.Object.Destroy(obj.gameObject);
                }
            }

            _activeObjects.Clear();
            _totalCreated = 0;

            // Destroy the parent container if we created it
            if (_parent != null && _parent.gameObject.name.StartsWith("[Pool]"))
            {
                UnityEngine.Object.Destroy(_parent.gameObject);
            }

            Debug.Log($"[ObjectPool<{typeof(T).Name}>] Pool disposed.");
        }

        /// <summary>
        /// Clears the pool, destroying all inactive objects but leaving active ones alone.
        /// Active objects will be properly handled when they are returned.
        /// </summary>
        public void ClearInactive()
        {
            if (_isDisposed) return;

            int cleared = 0;
            while (_pool.Count > 0)
            {
                T obj = _pool.Pop();
                if (obj != null && obj.gameObject != null)
                {
                    OnDestroyObject?.Invoke(obj);
                    UnityEngine.Object.Destroy(obj.gameObject);
                    cleared++;
                }
            }

            _totalCreated = _activeObjects.Count;
            Debug.Log($"[ObjectPool<{typeof(T).Name}>] Cleared {cleared} inactive objects.");
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Creates a new object instance from the prefab.
        /// </summary>
        /// <param name="isTemporary">If true, the object is not tracked in the total count.</param>
        /// <returns>The newly created object.</returns>
        private T CreateNewObject(bool isTemporary = false)
        {
            if (_prefab == null) return null;

            T obj;

            try
            {
                obj = UnityEngine.Object.Instantiate(_prefab, _parent);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[ObjectPool<{typeof(T).Name}>] Failed to instantiate prefab: {ex.Message}");
                return null;
            }

            if (obj == null)
            {
                Debug.LogError($"[ObjectPool<{typeof(T).Name}>] Instantiate returned null.");
                return null;
            }

            // Set a descriptive name
            obj.name = $"{_prefab.name}_Pooled_{_totalCreated}";

            if (!isTemporary)
            {
                _totalCreated++;
            }

            OnCreate?.Invoke(obj);
            return obj;
        }

        #endregion

        #region Debug

        /// <summary>
        /// Logs the current pool statistics for debugging.
        /// </summary>
        public void LogStats()
        {
            Debug.Log(
                $"[ObjectPool<{typeof(T).Name}>] Stats: " +
                $"Available={_pool.Count}, Active={_activeObjects.Count}, " +
                $"TotalCreated={_totalCreated}, MaxCapacity={_maxCapacity}, " +
                $"Utilization={UtilizationRatio:P0}"
            );
        }

        #endregion
    }

    #region MonoBehaviour Pool Host

    /// <summary>
    /// MonoBehaviour wrapper that hosts an ObjectPool and provides coroutine support.
    /// Attach this to a GameObject in the scene for pools that need MonoBehaviour features.
    /// </summary>
    /// <typeparam name="T">The Component type to pool.</typeparam>
    public class ObjectPoolHost<T> : MonoBehaviour where T : Component
    {
        #region Fields

        /// <summary>
        /// The underlying object pool.
        /// </summary>
        private ObjectPool<T> _pool;

        #endregion

        #region Properties

        /// <summary>
        /// The underlying object pool.
        /// </summary>
        public ObjectPool<T> Pool => _pool;

        #endregion

        #region Initialization

        /// <summary>
        /// Initializes the pool host with a prefab and configuration.
        /// </summary>
        /// <param name="prefab">The prefab to pool.</param>
        /// <param name="defaultCapacity">Initial pool capacity.</param>
        /// <param name="maxCapacity">Maximum pool capacity.</param>
        /// <param name="prewarmCount">Number of objects to prewarm.</param>
        public void Initialize(T prefab, int defaultCapacity = 10, int maxCapacity = 100, int prewarmCount = 0)
        {
            if (_pool != null)
            {
                Debug.LogWarning($"[ObjectPoolHost<{typeof(T).Name}>] Already initialized. Disposing old pool.");
                _pool.Dispose();
            }

            _pool = new ObjectPool<T>(prefab, transform, defaultCapacity, maxCapacity);

            if (prewarmCount > 0)
            {
                _pool.Prewarm(prewarmCount);
            }
        }

        #endregion

        #region Lifecycle

        /// <summary>
        /// Cleans up the pool when this host is destroyed.
        /// </summary>
        private void OnDestroy()
        {
            _pool?.Dispose();
        }

        #endregion
    }

    #endregion

    #region Poolable Component Base

    /// <summary>
    /// Optional base class for pooled objects. Provides automatic Return() support
       /// and lifecycle hooks that the pool will call.
    /// </summary>
    public abstract class Poolable : MonoBehaviour
    {
        /// <summary>
        /// The pool that owns this object, if any.
        /// </summary>
        public ObjectPool<Poolable> OwnerPool { get; set; }

        /// <summary>
        /// Called when the object is retrieved from the pool.
        /// Override to reset state, enable components, etc.
        /// </summary>
        public virtual void OnPoolGet() { }

        /// <summary>
        /// Called when the object is returned to the pool.
        /// Override to disable components, stop coroutines, etc.
        /// </summary>
        public virtual void OnPoolReturn() { }

        /// <summary>
        /// Called when the object is first created by the pool.
        /// Override for one-time setup.
        /// </summary>
        public virtual void OnPoolCreate() { }

        /// <summary>
        /// Returns this object to its owning pool.
        /// Safe to call even if not pooled.
        /// </summary>
        public void ReturnToPool()
        {
            if (OwnerPool != null)
            {
                OwnerPool.Return(this);
            }
            else
            {
                Debug.LogWarning(
                    $"[Poolable] '{gameObject.name}' has no owner pool. Destroying instead."
                );
                Destroy(gameObject);
            }
        }

        /// <summary>
        /// Schedules automatic return to pool after the specified delay.
        /// </summary>
        /// <param name="delay">Delay in seconds before returning to pool.</param>
        public void AutoReturn(float delay)
        {
            StartCoroutine(AutoReturnCoroutine(delay));
        }

        /// <summary>
        /// Coroutine for automatic pool return.
        /// </summary>
        private System.Collections.IEnumerator AutoReturnCoroutine(float delay)
        {
            yield return new WaitForSeconds(delay);
            ReturnToPool();
        }
    }

    #endregion
}
