using System;
using UnityEngine;
using Unity.Netcode;

namespace KawaiiCoolIsland.Multiplayer
{
    /// <summary>
    /// Base network behaviour for interactive world objects (chairs, doors,
    /// harvest nodes, minigame stations, etc.). Handles server-authorised
    /// interaction requests, ownership gating, cooldown enforcement, and
    /// networked visual-effect playback.
    /// </summary>
    /// <remarks>
    /// Derive from this class and override <see cref="CanInteract"/> and
    /// <see cref="OnInteract"/> to implement game-specific logic.
    /// </remarks>
    [RequireComponent(typeof(NetworkObject))]
    public class NetworkedObject : NetworkBehaviour
    {
        // ------------------------------------------------------------------
        // Inspector
        // ------------------------------------------------------------------

        [Header("Identity")]
        [Tooltip("Unique stable identifier used for save-data and event routing.")]
        public string ObjectId;

        [Header("Interaction Rules")]
        [Tooltip("If true, only the owning client may interact with this object.")]
        public bool RequiresOwnership = false;

        [Tooltip("Seconds that must elapse between consecutive interactions.")]
        public float InteractionCooldown = NetworkConstants.INTERACTION_COOLDOWN;

        [Header("Visuals")]
        [Tooltip("Animator triggered on successful interaction (optional).")]
        public Animator ObjectAnimator;

        [Tooltip("Name of the Animator trigger parameter fired on interact.")]
        public string InteractTriggerName = "Interact";

        // ------------------------------------------------------------------
        // Network state
        // ------------------------------------------------------------------

        /// <summary>
        /// Whether the object is currently in an interaction sequence.
        /// Replicated to all clients so UIs can show a "busy" indicator.
        /// </summary>
        private readonly NetworkVariable<bool> _isBeingInteracted = new(
            readPerm: NetworkVariableReadPermission.Everyone,
            writePerm: NetworkVariableWritePermission.Server
        );

        /// <summary>
        /// <see cref="NetworkObjectId"/> of the player currently interacting.
        /// Only meaningful when <see cref="_isBeingInteracted"/> is true.
        /// </summary>
        private readonly NetworkVariable<ulong> _interactingPlayer = new(
            readPerm: NetworkVariableReadPermission.Everyone,
            writePerm: NetworkVariableWritePermission.Server
        );

        // ------------------------------------------------------------------
        // Private state
        // ------------------------------------------------------------------

        /// <summary>Timestamp (via <see cref="Time.time"/>) of the last successful interaction.</summary>
        private float _lastInteractionTime = -999f;

        /// <summary>Cached collider used for spatial queries.</summary>
        private Collider2D _collider2D;

        /// <summary>Cached 3D collider (if present).</summary>
        private Collider _collider3D;

        // ------------------------------------------------------------------
        // Properties
        // ------------------------------------------------------------------

        /// <summary>Returns <c>true</c> if the interaction cooldown has elapsed.</summary>
        public bool IsCooldownReady => Time.time - _lastInteractionTime >= InteractionCooldown;

        /// <summary>Returns <c>true</c> if another player is currently interacting with this object.</summary>
        public bool IsBeingInteracted => _isBeingInteracted.Value;

        /// <summary>The <see cref="NetworkObjectId"/> of the player currently interacting, or 0 if none.</summary>
        public ulong InteractingPlayerId => _interactingPlayer.Value;

        // ------------------------------------------------------------------
        // Lifecycle
        // ------------------------------------------------------------------

        public override void OnNetworkSpawn()
        {
            base.OnNetworkSpawn();

            _collider2D = GetComponent<Collider2D>();
            _collider3D = GetComponent<Collider>();

            // Validate ObjectId in editor / dev builds
            if (string.IsNullOrWhiteSpace(ObjectId))
            {
                ObjectId = $"obj_{NetworkObjectId}";
                Debug.LogWarning(
                    $"[{nameof(NetworkedObject)}] ObjectId was blank; assigned fallback '{ObjectId}' " +
                    $"on GameObject '{gameObject.name}'.", this);
            }

            _isBeingInteracted.OnValueChanged += OnInteractionStateChanged;
        }

        public override void OnNetworkDespawn()
        {
            _isBeingInteracted.OnValueChanged -= OnInteractionStateChanged;
            base.OnNetworkDespawn();
        }

        // ------------------------------------------------------------------
        // Public API
        // ------------------------------------------------------------------

        /// <summary>
        /// Initiates an interaction request from a client to the server.
        /// The server validates via <see cref="CanInteract(ulong)"/> before
        /// calling <see cref="OnInteract(ulong)"/>.
        /// </summary>
        /// <param name="playerId">
        /// <see cref="NetworkObjectId"/> of the player requesting interaction.
        /// </param>
        /// <remarks>Can be called from any client; server has final authority.</remarks>
        [ServerRpc(RequireOwnership = false)]
        public void RequestInteractServerRpc(ulong playerId)
        {
            if (!IsServer) return;

            if (!CanInteract(playerId))
            {
                Debug.Log(
                    $"[{nameof(NetworkedObject)}] Interaction denied for player {playerId} on '{ObjectId}'. " +
                    $"CooldownReady={IsCooldownReady}, IsBeingInteracted={_isBeingInteracted.Value}");
                return;
            }

            // Set state atomically
            _isBeingInteracted.Value = true;
            _interactingPlayer.Value = playerId;
            _lastInteractionTime = Time.time;

            // Execute game logic
            OnInteract(playerId);

            // Auto-clear the "being interacted" flag after a grace period
            // so that clients can re-interact immediately.
            StartCoroutine(ClearInteractionCoroutine(InteractionCooldown));
        }

        /// <summary>
        /// Plays a one-shot visual effect on every client. Invoked by the
        /// server after a successful interaction.
        /// </summary>
        /// <param name="effectId">Identifier used by the VFX pool / addressables.</param>
        [ClientRpc]
        public void PlayInteractionEffectsClientRpc(string effectId)
        {
            // Trigger animator
            if (ObjectAnimator != null && !string.IsNullOrEmpty(InteractTriggerName))
                ObjectAnimator.SetTrigger(InteractTriggerName);

            // Spawn VFX
            if (!string.IsNullOrEmpty(effectId))
                SpawnEffect(effectId);

            OnInteracted?.Invoke(effectId);
        }

        /// <summary>
        /// Resets interaction state (host-only). Use when a scene unloads
        /// or a minigame round restarts.
        /// </summary>
        public void ResetInteractionState()
        {
            if (!IsServer) return;
            _isBeingInteracted.Value = false;
            _interactingPlayer.Value = 0;
            _lastInteractionTime = -999f;
        }

        // ------------------------------------------------------------------
        // Virtual hooks
        // ------------------------------------------------------------------

        /// <summary>
        /// Server-side validation gate. Return <c>false</c> to deny the
        /// interaction request. Base implementation checks ownership,
        /// cooldown, and concurrent-interaction flags.
        /// </summary>
        /// <param name="playerId">Client that sent the <see cref="RequestInteractServerRpc"/>.</param>
        protected virtual bool CanInteract(ulong playerId)
        {
            // Ownership gate
            if (RequiresOwnership && OwnerClientId != playerId)
                return false;

            // Cooldown gate
            if (!IsCooldownReady)
                return false;

            // Concurrent-interaction gate
            if (_isBeingInteracted.Value)
                return false;

            return true;
        }

        /// <summary>
        /// Server-side callback executed after validation succeeds.
        /// Override to implement custom game logic (award items, open UI,
        /// trigger minigame, etc.).
        /// </summary>
        /// <param name="playerId">Client that initiated the interaction.</param>
        protected virtual void OnInteract(ulong playerId)
        {
            // Default: just play effects on all clients
            PlayInteractionEffectsClientRpc($"interact_{ObjectId}");
        }

        // ------------------------------------------------------------------
        // Network variable callbacks
        // ------------------------------------------------------------------

        /// <summary>
        /// Fired on every client when <see cref="_isBeingInteracted"/> changes.
        /// Use for UI busy-state updates.
        /// </summary>
        private void OnInteractionStateChanged(bool previous, bool current)
        {
            if (ObjectAnimator != null)
                ObjectAnimator.SetBool("IsBusy", current);
        }

        // ------------------------------------------------------------------
        // Coroutines
        // ------------------------------------------------------------------

        /// <summary>
        /// Coroutine that clears the interaction-locked state after
        /// <paramref name="delay"/> seconds.
        /// </summary>
        private System.Collections.IEnumerator ClearInteractionCoroutine(float delay)
        {
            yield return new WaitForSeconds(delay);
            if (IsServer)
            {
                _isBeingInteracted.Value = false;
                _interactingPlayer.Value = 0;
            }
        }

        // ------------------------------------------------------------------
        // Effects
        // ------------------------------------------------------------------

        /// <summary>
        /// Spawns a local visual effect. Extend this to integrate with
        /// an object-pool or Addressables system.
        /// </summary>
        private void SpawnEffect(string effectId)
        {
            Debug.Log($"[{nameof(NetworkedObject)}] Spawning effect '{effectId}' at '{ObjectId}'.");
            // TODO: Integrate with VFX pool / Addressables.InstantiateAsync
        }

        // ------------------------------------------------------------------
        // Events
        // ------------------------------------------------------------------

        /// <summary>
        /// Fired on every client after <see cref="PlayInteractionEffectsClientRpc"/> completes.
        /// The string argument is the <paramref name="effectId"/> that was played.
        /// </summary>
        public event Action<string> OnInteracted;
    }
}
