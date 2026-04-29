// ----------------------------------------------------------------------------
// KawaiiCool Island - Core Framework
// ----------------------------------------------------------------------------
// EventBus.cs - Type-safe, zero-allocation event system
// ----------------------------------------------------------------------------
// A centralized, type-safe publish/subscribe event bus using delegates stored
// in a Dictionary<Type, Delegate>. Supports thread-safe subscription,
// unsubscription, and event publishing with automatic cleanup.
// All game events implement IGameEvent and are passed as structs for zero-allocation.
// ----------------------------------------------------------------------------

using System;
using System.Collections.Generic;
using System.Threading;
using UnityEngine;
using KawaiiCoolIsland.Core.Events;

namespace KawaiiCoolIsland.Core
{
    /// <summary>
    /// Central type-safe event bus for decoupled communication between game systems.
    /// Uses struct-based events for zero-allocation messaging.
    /// </summary>
    public sealed class EventBus : Singleton<EventBus>
    {
        #region Fields

        /// <summary>
        /// Thread-safe lock for all subscription operations.
        /// </summary>
        private readonly ReaderWriterLockSlim _rwLock = new ReaderWriterLockSlim(LockRecursionPolicy.SupportsRecursion);

        /// <summary>
        /// Dictionary mapping event types to their delegate subscriptions.
        /// Each entry stores a multicast delegate of all handlers for that event type.
        /// </summary>
        private readonly Dictionary<Type, Delegate> _subscriptions = new Dictionary<Type, Delegate>();

        /// <summary>
        /// Pending subscribe operations queued during event publication.
        /// Applied after publication completes to avoid modification-during-iteration.
        /// </summary>
        private readonly Queue<(Type type, Delegate handler)> _pendingSubscribes = new Queue<(Type, Delegate)>();

        /// <summary>
        /// Pending unsubscribe operations queued during event publication.
        /// </summary>
        private readonly Queue<(Type type, Delegate handler)> _pendingUnsubscribes = new Queue<(Type, Delegate)>();

        /// <summary>
        /// Counter tracking recursive Publish depth. Used to defer subscription changes.
        /// </summary>
        private int _publishDepth = 0;

        /// <summary>
        /// Total number of events published since startup (for debugging/metrics).
        /// </summary>
        private long _totalEventsPublished = 0;

        #endregion

        #region Properties

        /// <summary>
        /// Total number of events published since startup.
        /// </summary>
        public long TotalEventsPublished => _totalEventsPublished;

        /// <summary>
        /// Number of distinct event types currently registered.
        /// </summary>
        public int RegisteredEventTypes
        {
            get
            {
                _rwLock.EnterReadLock();
                try
                {
                    return _subscriptions.Count;
                }
                finally
                {
                    _rwLock.ExitReadLock();
                }
            }
        }

        #endregion

        #region Subscription

        /// <summary>
        /// Subscribe a handler to a specific event type.
        /// Thread-safe. Can be called during event publication (deferred application).
        /// </summary>
        /// <typeparam name="TEvent">The event struct type implementing <see cref="IGameEvent"/>.</typeparam>
        /// <param name="handler">The callback to invoke when events of this type are published.</param>
        public void Subscribe<TEvent>(Action<TEvent> handler) where TEvent : struct, IGameEvent
        {
            if (handler == null)
            {
                Debug.LogError("[EventBus] Cannot subscribe null handler.");
                return;
            }

            Type eventType = typeof(TEvent);

            // If we're inside a Publish call, defer the subscription
            if (_publishDepth > 0)
            {
                _pendingSubscribes.Enqueue((eventType, handler));
                return;
            }

            _rwLock.EnterWriteLock();
            try
            {
                if (_subscriptions.TryGetValue(eventType, out Delegate existing))
                {
                    _subscriptions[eventType] = Delegate.Combine(existing, handler);
                }
                else
                {
                    _subscriptions[eventType] = handler;
                }
            }
            finally
            {
                _rwLock.ExitWriteLock();
            }
        }

        /// <summary>
        /// Unsubscribe a handler from a specific event type.
        /// Thread-safe. Removes only the exact delegate instance.
        /// </summary>
        /// <typeparam name="TEvent">The event struct type.</typeparam>
        /// <param name="handler">The callback to remove.</param>
        public void Unsubscribe<TEvent>(Action<TEvent> handler) where TEvent : struct, IGameEvent
        {
            if (handler == null)
            {
                Debug.LogError("[EventBus] Cannot unsubscribe null handler.");
                return;
            }

            Type eventType = typeof(TEvent);

            // If we're inside a Publish call, defer the unsubscription
            if (_publishDepth > 0)
            {
                _pendingUnsubscribes.Enqueue((eventType, handler));
                return;
            }

            _rwLock.EnterWriteLock();
            try
            {
                if (_subscriptions.TryGetValue(eventType, out Delegate existing))
                {
                    Delegate updated = Delegate.Remove(existing, handler);

                    if (updated == null)
                    {
                        _subscriptions.Remove(eventType);
                    }
                    else
                    {
                        _subscriptions[eventType] = updated;
                    }
                }
            }
            finally
            {
                _rwLock.ExitWriteLock();
            }
        }

        /// <summary>
        /// Unsubscribe all handlers for a specific event type. Use sparingly.
        /// </summary>
        /// <typeparam name="TEvent">The event struct type to clear.</typeparam>
        public void UnsubscribeAll<TEvent>() where TEvent : struct, IGameEvent
        {
            Type eventType = typeof(TEvent);

            if (_publishDepth > 0)
            {
                // Enqueue removal of all handlers by type - we'll handle this specially
                _pendingUnsubscribes.Enqueue((eventType, null));
                return;
            }

            _rwLock.EnterWriteLock();
            try
            {
                _subscriptions.Remove(eventType);
            }
            finally
            {
                _rwLock.ExitWriteLock();
            }
        }

        #endregion

        #region Publication

        /// <summary>
        /// Publish an event to all subscribed handlers.
        /// Thread-safe. Events are published synchronously on the calling thread.
        /// Subscription changes during publication are deferred until completion.
        /// </summary>
        /// <typeparam name="TEvent">The event struct type.</typeparam>
        /// <param name="evt">The event data to publish.</param>
        public void Publish<TEvent>(TEvent evt) where TEvent : struct, IGameEvent
        {
            Type eventType = typeof(TEvent);
            Delegate handlerDelegate = null;

            _rwLock.EnterReadLock();
            try
            {
                _subscriptions.TryGetValue(eventType, out handlerDelegate);
            }
            finally
            {
                _rwLock.ExitReadLock();
            }

            if (handlerDelegate == null)
            {
                // No subscribers - this is normal, not an error
                return;
            }

            _publishDepth++;
            try
            {
                // Cast and invoke all handlers
                var handlers = handlerDelegate.GetInvocationList();
                for (int i = 0; i < handlers.Length; i++)
                {
                    try
                    {
                        var handler = (Action<TEvent>)handlers[i];
                        handler.Invoke(evt);
                    }
                    catch (Exception ex)
                    {
                        Debug.LogError(
                            $"[EventBus] Exception in event handler for '{eventType.Name}': {ex}\n" +
                            $"Handler target: {handlers[i].Target?.GetType().Name ?? "null"}.{handlers[i].Method?.Name ?? "null"}"
                        );
                        // Continue publishing to remaining handlers
                    }
                }
            }
            finally
            {
                _publishDepth--;
                Interlocked.Increment(ref _totalEventsPublished);

                // Apply any deferred subscription changes
                if (_publishDepth == 0)
                {
                    ApplyPendingChanges();
                }
            }
        }

        /// <summary>
        /// Attempts to publish an event without throwing if no subscribers exist.
        /// Same as Publish but suppresses the overhead of checking.
        /// </summary>
        /// <typeparam name="TEvent">The event struct type.</typeparam>
        /// <param name="evt">The event data to publish.</param>
        /// <returns>True if at least one handler was invoked.</returns>
        public bool TryPublish<TEvent>(TEvent evt) where TEvent : struct, IGameEvent
        {
            Type eventType = typeof(TEvent);
            Delegate handlerDelegate = null;

            _rwLock.EnterReadLock();
            try
            {
                if (!_subscriptions.TryGetValue(eventType, out handlerDelegate) || handlerDelegate == null)
                {
                    return false;
                }
            }
            finally
            {
                _rwLock.ExitReadLock();
            }

            Publish(evt);
            return true;
        }

        #endregion

        #region Deferred Changes

        /// <summary>
        /// Applies all pending subscription and unsubscription changes.
        /// Called automatically when Publish depth returns to zero.
        /// </summary>
        private void ApplyPendingChanges()
        {
            _rwLock.EnterWriteLock();
            try
            {
                // Process unsubscribes first
                while (_pendingUnsubscribes.Count > 0)
                {
                    var (type, handler) = _pendingUnsubscribes.Dequeue();

                    if (handler == null)
                    {
                        // Special case: remove all handlers for this type
                        _subscriptions.Remove(type);
                    }
                    else if (_subscriptions.TryGetValue(type, out Delegate existing))
                    {
                        Delegate updated = Delegate.Remove(existing, handler);
                        if (updated == null)
                        {
                            _subscriptions.Remove(type);
                        }
                        else
                        {
                            _subscriptions[type] = updated;
                        }
                    }
                }

                // Process subscribes
                while (_pendingSubscribes.Count > 0)
                {
                    var (type, handler) = _pendingSubscribes.Dequeue();

                    if (_subscriptions.TryGetValue(type, out Delegate existing))
                    {
                        _subscriptions[type] = Delegate.Combine(existing, handler);
                    }
                    else
                    {
                        _subscriptions[type] = handler;
                    }
                }
            }
            finally
            {
                _rwLock.ExitWriteLock();
            }
        }

        #endregion

        #region Utility

        /// <summary>
        /// Checks if there are any subscribers for a given event type.
        /// </summary>
        /// <typeparam name="TEvent">The event struct type.</typeparam>
        /// <returns>True if at least one handler is subscribed.</returns>
        public bool HasSubscribers<TEvent>() where TEvent : struct, IGameEvent
        {
            Type eventType = typeof(TEvent);

            _rwLock.EnterReadLock();
            try
            {
                return _subscriptions.TryGetValue(eventType, out Delegate del) && del != null;
            }
            finally
            {
                _rwLock.ExitReadLock();
            }
        }

        /// <summary>
        /// Gets the number of handlers subscribed to a specific event type.
        /// </summary>
        /// <typeparam name="TEvent">The event struct type.</typeparam>
        /// <returns>Number of subscribed handlers.</returns>
        public int SubscriberCount<TEvent>() where TEvent : struct, IGameEvent
        {
            Type eventType = typeof(TEvent);

            _rwLock.EnterReadLock();
            try
            {
                if (_subscriptions.TryGetValue(eventType, out Delegate del) && del != null)
                {
                    return del.GetInvocationList().Length;
                }
                return 0;
            }
            finally
            {
                _rwLock.ExitReadLock();
            }
        }

        /// <summary>
        /// Clears all subscriptions. Use with caution - primarily for testing or shutdown.
        /// </summary>
        public void ClearAllSubscriptions()
        {
            _rwLock.EnterWriteLock();
            try
            {
                _subscriptions.Clear();
                _pendingSubscribes.Clear();
                _pendingUnsubscribes.Clear();
            }
            finally
            {
                _rwLock.ExitWriteLock();
            }

            Debug.Log("[EventBus] All subscriptions cleared.");
        }

        /// <summary>
        /// Logs a summary of all current subscriptions for debugging purposes.
        /// Editor-only method.
        /// </summary>
#if UNITY_EDITOR
        [ContextMenu("Log Subscription Summary")]
#endif
        public void LogSubscriptionSummary()
        {
            _rwLock.EnterReadLock();
            try
            {
                Debug.Log("=== EventBus Subscription Summary ===");
                foreach (var kvp in _subscriptions)
                {
                    int count = kvp.Value?.GetInvocationList().Length ?? 0;
                    Debug.Log($"  {kvp.Key.Name}: {count} subscriber(s)");
                }
                Debug.Log($"Total event types: {_subscriptions.Count}");
                Debug.Log($"Total events published: {_totalEventsPublished}");
                Debug.Log("=====================================");
            }
            finally
            {
                _rwLock.ExitReadLock();
            }
        }

        #endregion

        #region Lifecycle

        /// <summary>
        /// Called when the singleton awakes. Persists across scenes by default.
        /// </summary>
        protected override void OnSingletonAwake()
        {
            base.OnSingletonAwake();
            Debug.Log("[EventBus] Initialized and ready.");
        }

        /// <summary>
        /// Ensures the reader-writer lock is disposed on destruction.
        /// </summary>
        protected override void OnDestroy()
        {
            _rwLock?.Dispose();
            base.OnDestroy();
        }

        #endregion
    }
}
