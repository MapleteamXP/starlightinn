using System;
using System.Collections.Generic;
using UnityEngine;
using Unity.Netcode;
using Unity.Netcode.Components;
using Unity.Collections;
using TMPro;

namespace KawaiiCoolIsland.Multiplayer
{
    /// <summary>
    /// Core networked avatar behaviour for every player in KawaiiCool Island.
    /// Handles owner-authoritative 2D movement via <see cref="NetworkTransform"/>,
    /// synchronised state (position, outfit, display name, typing indicator)
    /// through <see cref="NetworkVariable{T}"/>, and RPC-based actions
    /// (chat, emotes, interaction requests).
    /// </summary>
    /// <remarks>
    /// Each player prefab must contain:
    /// <list type="bullet">
    ///   <item><see cref="NetworkObject"/></item>
    ///   <item><see cref="NetworkTransform"/> (or <see cref="ClientNetworkTransform"/> for owner auth)</item>
    ///   <item><see cref="Rigidbody2D"/></item>
    ///   <item><see cref="AvatarController"/> (custom visual controller)</item>
    /// </list>
    /// </remarks>
    [RequireComponent(typeof(NetworkObject))]
    [RequireComponent(typeof(NetworkTransform))]
    [RequireComponent(typeof(Rigidbody2D))]
    public class NetworkedPlayer : NetworkBehaviour
    {
        // ================================================================
        // Inspector
        // ================================================================

        [Header("Avatar Components")]
        [Tooltip("Custom avatar controller driving animations, facing direction, etc.")]
        public AvatarController Avatar;

        [Tooltip("World-space chat bubble shown above the player's head.")]
        public ChatBubble ChatBubble;

        [Tooltip("Root GameObject for the name-tag UI element.")]
        public GameObject NameTagContainer;

        [Tooltip("TMP_Text component rendering the player's display name.")]
        public TMP_Text NameTagText;

        [Tooltip("Background sprite behind the name tag (coloured by friendship status).")]
        public SpriteRenderer NameTagBackground;

        [Header("Movement")]
        [Tooltip("Local player's horizontal movement speed (units/sec).")]
        public float MovementSpeed = 5f;

        [Tooltip("Lerp speed for smoothing remote player positions. Higher = snappier.")]
        public float InterpolationSpeed = NetworkConstants.INTERPOLATION_SPEED_DEFAULT;

        [Tooltip("Distance at which remote players snap instead of interpolate (teleport detection).")]
        public float SnapThreshold = NetworkConstants.POSITION_SNAP_THRESHOLD;

        [Header("Chat Bubble")]
        [Tooltip("Seconds a chat bubble remains fully opaque before fading.")]
        public float ChatBubbleDuration = NetworkConstants.CHAT_BUBBLE_DURATION;

        [Tooltip("Seconds for the chat-bubble fade-out animation.")]
        public float ChatBubbleFadeTime = NetworkConstants.CHAT_BUBBLE_FADE_TIME;

        // ================================================================
        // Network Variables — all owner-writable for client-authoritative state
        // ================================================================

        /// <summary>
        /// Synchronised world position. Written by the owner every frame;
        /// read by all clients to drive interpolation.
        /// </summary>
        private readonly NetworkVariable<Vector3> _netPosition = new(
            writePerm: NetworkVariableWritePermission.Owner,
            readPerm:  NetworkVariableReadPermission.Everyone
        );

        /// <summary>
        /// Normalised movement input vector [X,Y]. Used by remote clients
        /// to blend walk / idle animations without trusting raw position deltas.
        /// </summary>
        private readonly NetworkVariable<Vector2> _netMovement = new(
            writePerm: NetworkVariableWritePermission.Owner,
            readPerm:  NetworkVariableReadPermission.Everyone
        );

        /// <summary>
        /// UTF-8 display name shown above the avatar and in chat.
        /// Limited to 64 bytes to keep bandwidth minimal.
        /// </summary>
        private readonly NetworkVariable<FixedString64Bytes> _displayName = new(
            writePerm: NetworkVariableWritePermission.Owner,
            readPerm:  NetworkVariableReadPermission.Everyone
        );

        /// <summary>
        /// JSON blob (max 256 bytes) describing the player's current outfit /
        /// cosmetic configuration. Parsed by <see cref="AvatarController"/>.
        /// </summary>
        private readonly NetworkVariable<FixedString256Bytes> _outfitState = new(
            writePerm: NetworkVariableWritePermission.Owner,
            readPerm:  NetworkVariableReadPermission.Everyone
        );

        /// <summary>
        /// Whether the local player has the chat input field focused.
        /// Used to show a typing indicator above the avatar.
        /// </summary>
        private readonly NetworkVariable<bool> _isTyping = new(
            writePerm: NetworkVariableWritePermission.Owner,
            readPerm:  NetworkVariableReadPermission.Everyone
        );

        // ================================================================
        // Local state
        // ================================================================

        /// <summary>Target position used for remote-player interpolation.</summary>
        private Vector3 _targetPosition;

        /// <summary>Cached local movement input from <see cref="InputManager"/>.</summary>
        private Vector2 _movementInput;

        /// <summary>Whether the local player has any non-zero movement input.</summary>
        private bool _isMoving;

        /// <summary>Cached reference to the 2D physics body.</summary>
        private Rigidbody2D _rb;

        /// <summary>True once <see cref="OnNetworkSpawn"/> has completed.</summary>
        private bool _hasSpawned;

        /// <summary>Timestamp of the most recent position dirtying.</summary>
        private float _lastPositionSyncTime;

        /// <summary>Cached display name string to avoid FixedString→string churn.</summary>
        private string _cachedDisplayName = "Player";

        // ================================================================
        // Properties
        // ================================================================

        /// <summary>The unique NGO network object ID for this player.</summary>
        public ulong ClientId => NetworkObjectId;

        /// <summary>Human-readable display name (cached from NetworkVariable).</summary>
        public string DisplayName => _cachedDisplayName;

        /// <summary>Whether this NetworkBehaviour is owned by the local client.</summary>
        public bool IsLocalPlayer => IsOwner;

        /// <summary>Current world-space position of the transform.</summary>
        public Vector3 Position => transform.position;

        /// <summary>True while the player has non-zero movement input.</summary>
        public bool IsMoving => _isMoving;

        /// <summary>Whether this player's chat input is focused.</summary>
        public bool IsTyping => _isTyping.Value;

        /// <summary>
        /// The synchronised movement vector. Use for animation blending on
        /// remote players.
        /// </summary>
        public Vector2 NetworkMovement => _netMovement.Value;

        /// <summary>
        /// The synchronised outfit JSON string. Parse and apply to
        /// <see cref="AvatarController"/>.
        /// </summary>
        public string OutfitJson => _outfitState.Value.ToString();

        // ================================================================
        // Lifecycle
        // ================================================================

        public override void OnNetworkSpawn()
        {
            base.OnNetworkSpawn();
            _rb = GetComponent<Rigidbody2D>();
            _hasSpawned = true;

            // Initialise interpolation target to current spawn position
            _targetPosition = transform.position;
            if (IsOwner)
            {
                _netPosition.Value = transform.position;
            }
            else
            {
                _targetPosition = _netPosition.Value;
            }

            // Subscribe to NetworkVariable change events
            _netPosition.OnValueChanged  += OnPositionChanged;
            _displayName.OnValueChanged  += OnDisplayNameChanged;
            _outfitState.OnValueChanged  += OnOutfitChanged;
            _isTyping.OnValueChanged     += OnTypingChanged;
            _netMovement.OnValueChanged  += OnMovementChanged;

            // Register with the network manager
            KawaiiNetworkManager.Instance?.RegisterPlayer(this);

            // Apply initial values immediately
            _cachedDisplayName = _displayName.Value.ToString();
            RefreshNameTag();
            ApplyOutfit(_outfitState.Value.ToString());

            // Disable remote-player components that should only run locally
            if (!IsOwner)
            {
                ConfigureRemotePlayer();
            }
            else
            {
                ConfigureLocalPlayer();
            }

            Debug.Log(
                $"[{nameof(NetworkedPlayer)}] Spawned clientId={OwnerClientId}, " +
                $"networkObjectId={NetworkObjectId}, isOwner={IsOwner}");
        }

        public override void OnNetworkDespawn()
        {
            _hasSpawned = false;

            _netPosition.OnValueChanged  -= OnPositionChanged;
            _displayName.OnValueChanged  -= OnDisplayNameChanged;
            _outfitState.OnValueChanged  -= OnOutfitChanged;
            _isTyping.OnValueChanged     -= OnTypingChanged;
            _netMovement.OnValueChanged  -= OnMovementChanged;

            KawaiiNetworkManager.Instance?.UnregisterPlayer(NetworkObjectId);

            base.OnNetworkDespawn();
        }

        private void Update()
        {
            if (!_hasSpawned) return;

            if (IsOwner)
            {
                HandleLocalInput();
                UpdateOwnerVisuals();
            }
            else
            {
                UpdateRemoteInterpolation();
                UpdateRemoteVisuals();
            }
        }

        private void FixedUpdate()
        {
            if (!_hasSpawned) return;

            if (IsOwner)
            {
                UpdateOwnerPhysics();
            }
        }

        // ================================================================
        // Local player (owner) methods
        // ================================================================

        /// <summary>
        /// Polls input and caches the movement vector. Called in <see cref="Update"/>.
        /// </summary>
        private void HandleLocalInput()
        {
            // Horizontal movement only (2D platformer / side-view style)
            float horizontal = Input.GetAxisRaw("Horizontal");
            _movementInput = new Vector2(horizontal, 0f).normalized;
            _isMoving = Mathf.Abs(horizontal) > 0.01f;

            // Typing toggle (example keybinding)
            if (Input.GetKeyDown(KeyCode.Return))
            {
                SetTyping(!_isTyping.Value);
            }
        }

        /// <summary>
        /// Moves the Rigidbody2D using the cached input. Called in <see cref="FixedUpdate"/>.
        /// </summary>
        private void UpdateOwnerPhysics()
        {
            Vector2 velocity = _movementInput * MovementSpeed;
            _rb.linearVelocity = new Vector2(velocity.x, _rb.linearVelocity.y);

            // Update NetworkVariables at the configured sync rate
            if (Time.time - _lastPositionSyncTime >= NetworkConstants.POSITION_SYNC_INTERVAL)
            {
                _lastPositionSyncTime = Time.time;
                _netPosition.Value = transform.position;
                _netMovement.Value = _movementInput;
            }
        }

        /// <summary>
        /// Updates local visual state (facing direction, animations). Called in <see cref="Update"/>.
        /// </summary>
        private void UpdateOwnerVisuals()
        {
            // Facing direction
            if (_movementInput.x > 0.01f)
                transform.localScale = new Vector3(1f, 1f, 1f);
            else if (_movementInput.x < -0.01f)
                transform.localScale = new Vector3(-1f, 1f, 1f);

            // Drive avatar animations
            if (Avatar != null)
            {
                Avatar.SetMovement(_movementInput);
                Avatar.SetMoving(_isMoving);
            }
        }

        /// <summary>
        /// Configures components that should only be active for the local player.
        /// </summary>
        private void ConfigureLocalPlayer()
        {
            // Enable any local-only camera follow scripts
            var followCam = GetComponentInChildren<CameraFollow>(true);
            if (followCam != null) followCam.enabled = true;

            // Set a distinctive name-tag colour for self
            if (NameTagBackground != null)
                NameTagBackground.color = new Color(0.3f, 0.7f, 1f, 0.8f);

            // Register with RoomManager
            if (RoomManager.Instance != null && RoomManager.Instance.CurrentRoomId == null)
            {
                RoomManager.Instance.CreateRoom(RoomType.Hub, "Public Hub");
            }
        }

        // ================================================================
        // Remote player methods
        // ================================================================

        /// <summary>
        /// Smoothly interpolates this remote player's transform toward the
        /// authoritative <see cref="_netPosition"/>. Uses snap logic for
        /// large position jumps (teleports / scene changes).
        /// </summary>
        private void UpdateRemoteInterpolation()
        {
            float distance = Vector3.Distance(transform.position, _targetPosition);

            if (distance > SnapThreshold)
            {
                // Teleport — don't interpolate across huge distances
                transform.position = _targetPosition;
            }
            else
            {
                // Smooth interpolation
                float t = 1f - Mathf.Exp(-InterpolationSpeed * Time.deltaTime);
                transform.position = Vector3.Lerp(transform.position, _targetPosition, t);
            }
        }

        /// <summary>
        /// Updates remote visual state from NetworkVariable data. Called in <see cref="Update"/>.
        /// </summary>
        private void UpdateRemoteVisuals()
        {
            // Facing direction from movement vector
            Vector2 netMove = _netMovement.Value;
            if (netMove.x > 0.01f)
                transform.localScale = new Vector3(1f, 1f, 1f);
            else if (netMove.x < -0.01f)
                transform.localScale = new Vector3(-1f, 1f, 1f);

            // Drive avatar animations from network movement
            if (Avatar != null)
            {
                Avatar.SetMovement(netMove);
                Avatar.SetMoving(netMove.sqrMagnitude > 0.001f);
            }
        }

        /// <summary>
        /// Disables components that should not run for remote players.
        /// </summary>
        private void ConfigureRemotePlayer()
        {
            // Disable camera follow on remote avatars
            var followCam = GetComponentInChildren<CameraFollow>(true);
            if (followCam != null) followCam.enabled = false;

            // Disable local input components
            var localController = GetComponent<PlayerInputController>();
            if (localController != null) localController.enabled = false;

            // Standard name-tag colour for other players
            if (NameTagBackground != null)
                NameTagBackground.color = new Color(0.2f, 0.2f, 0.2f, 0.7f);
        }

        // ================================================================
        // Public API — state setters (owner only)
        // ================================================================

        /// <summary>
        /// Sets the display name synchronised to all clients.
        /// Must be called by the owning client.
        /// </summary>
        /// <param name="name">Display name. Truncated to 64 bytes if too long.</param>
        public void SetDisplayName(string name)
        {
            if (!IsOwner)
            {
                Debug.LogWarning($"[{nameof(NetworkedPlayer)}] Only the owner may set the display name.");
                return;
            }

            if (string.IsNullOrWhiteSpace(name))
                name = "Player";

            // Truncate to fit FixedString64Bytes
            if (name.Length > 60)
                name = name.Substring(0, 60);

            _displayName.Value = new FixedString64Bytes(name);
        }

        /// <summary>
        /// Serialises outfit data to JSON and synchronises it to all clients.
        /// Must be called by the owning client.
        /// </summary>
        /// <param name="outfitData">Key-value pairs describing equipped cosmetics.</param>
        public void SetOutfit(Dictionary<string, string> outfitData)
        {
            if (!IsOwner)
            {
                Debug.LogWarning($"[{nameof(NetworkedPlayer)}] Only the owner may set the outfit.");
                return;
            }

            string json = SerializeOutfit(outfitData);
            if (json.Length > 250)
            {
                Debug.LogWarning($"[{nameof(NetworkedPlayer)}] Outfit JSON too long ({json.Length} chars), truncating.");
                json = json.Substring(0, 250);
            }

            _outfitState.Value = new FixedString256Bytes(json);
        }

        /// <summary>
        /// Sets the typing-indicator state. Must be called by the owning client.
        /// </summary>
        public void SetTyping(bool typing)
        {
            if (!IsOwner) return;
            _isTyping.Value = typing;
        }

        /// <summary>
        /// Displays a chat bubble above this player's avatar locally.
        /// Does not network — the message arrives via RPC and this is called
        /// by the local receiver.
        /// </summary>
        public void ShowChatBubble(string message)
        {
            if (ChatBubble == null) return;
            ChatBubble.Show(message, ChatBubbleDuration, ChatBubbleFadeTime);
        }

        /// <summary>
        /// Triggers an emote animation on the <see cref="AvatarController"/>.
        /// </summary>
        public void PlayEmoteLocal(string emoteId)
        {
            if (Avatar != null)
                Avatar.PlayEmote(emoteId);
        }

        // ================================================================
        // Network Variable callbacks
        // ================================================================

        /// <summary>
        /// Fired on every client (except the owner) when the authoritative
        /// position changes. Updates the interpolation target.
        /// </summary>
        private void OnPositionChanged(Vector3 oldPos, Vector3 newPos)
        {
            _targetPosition = newPos;
        }

        /// <summary>
        /// Fired on every client when the display name changes.
        /// Refreshes the name-tag UI.
        /// </summary>
        private void OnDisplayNameChanged(FixedString64Bytes oldName, FixedString64Bytes newName)
        {
            _cachedDisplayName = newName.ToString();
            RefreshNameTag();
        }

        /// <summary>
        /// Fired on every client when the outfit JSON changes.
        /// Rebuilds the avatar visuals.
        /// </summary>
        private void OnOutfitChanged(FixedString256Bytes oldOutfit, FixedString256Bytes newOutfit)
        {
            ApplyOutfit(newOutfit.ToString());
        }

        /// <summary>
        /// Fired on every client when the typing state changes.
        /// Shows / hides the typing indicator bubble.
        /// </summary>
        private void OnTypingChanged(bool oldTyping, bool newTyping)
        {
            if (Avatar != null)
                Avatar.SetTypingIndicator(newTyping);
        }

        /// <summary>
        /// Fired on every client when the movement vector changes.
        /// Used for animation blending on remote players.
        /// </summary>
        private void OnMovementChanged(Vector2 oldMove, Vector2 newMove)
        {
            // Movement is consumed in UpdateRemoteVisuals
        }

        // ================================================================
        // RPCs — chat
        // ================================================================

        /// <summary>
        /// Sends a chat message to the server. The server validates and
        /// then multicasts it to all clients via <see cref="ReceiveChatMessageClientRpc"/>.
        /// </summary>
        /// <param name="message">Text payload. Max 200 characters.</param>
        /// <param name="channel">
        /// 0 = proximity chat (range-limited), 1 = global/room chat,
        /// 2+ = custom channels (party, guild, etc.)
        /// </param>
        [ServerRpc(RequireOwnership = false)]
        public void SendChatMessageServerRpc(string message, int channel)
        {
            if (!IsServer) return;

            // Validate
            if (string.IsNullOrWhiteSpace(message)) return;
            if (message.Length > NetworkConstants.MAX_CHAT_MESSAGE_LENGTH)
                message = message.Substring(0, NetworkConstants.MAX_CHAT_MESSAGE_LENGTH);

            // Sanitise basic HTML / markup injection
            message = message.Replace("<", "&lt;").Replace(">", "&gt;");

            string senderId   = OwnerClientId.ToString();
            string senderName = _displayName.Value.ToString();

            // Proximity filter: only players in range receive the message
            if (channel == 0)
            {
                var nearbyPlayers = KawaiiNetworkManager.Instance?.GetNearbyPlayers(
                    _netPosition.Value, NetworkConstants.CHAT_RANGE_DEFAULT);

                if (nearbyPlayers != null)
                {
                    foreach (var player in nearbyPlayers)
                    {
                        player.ReceiveChatMessageClientRpc(senderId, senderName, message, channel);
                    }
                }
                // Also send to self so the sender sees their own message
                ReceiveChatMessageClientRpc(senderId, senderName, message, channel);
            }
            else
            {
                // Global / room chat: broadcast to all
                ReceiveChatMessageClientRpc(senderId, senderName, message, channel);
            }
        }

        /// <summary>
        /// Receives a chat message from the server. Displays the bubble and
        /// logs to the local chat UI.
        /// </summary>
        [ClientRpc]
        public void ReceiveChatMessageClientRpc(string senderId, string senderName,
            string message, int channel)
        {
            // Show bubble above sender
            ShowChatBubble(message);

            // Log to chat UI
            ChatLog.Instance?.AddMessage(senderName, message, channel);

            Debug.Log($"[Chat] [{channel}] {senderName}: {message}");
        }

        // ================================================================
        // RPCs — emotes
        // ================================================================

        /// <summary>
        /// Requests an emote from the server. The server multicasts it so
        /// every client sees the animation.
        /// </summary>
        [ServerRpc(RequireOwnership = false)]
        public void PlayEmoteServerRpc(string emoteId)
        {
            if (!IsServer) return;
            if (string.IsNullOrWhiteSpace(emoteId)) return;

            // Validate emote exists in catalog
            if (!EmoteCatalog.Instance?.HasEmote(emoteId) ?? false)
            {
                Debug.LogWarning($"[{nameof(NetworkedPlayer)}] Invalid emote '{emoteId}' requested.");
                return;
            }

            PlayEmoteClientRpc(emoteId);
        }

        /// <summary>
        /// Plays an emote animation on every client.
        /// </summary>
        [ClientRpc]
        public void PlayEmoteClientRpc(string emoteId)
        {
            PlayEmoteLocal(emoteId);
        }

        // ================================================================
        // RPCs — interaction
        // ================================================================

        /// <summary>
        /// Requests interaction with a networked object. The server validates
        /// proximity and forwards to the target <see cref="NetworkedObject"/>.
        /// </summary>
        [ServerRpc(RequireOwnership = false)]
        public void RequestInteractServerRpc(string targetObjectId)
        {
            if (!IsServer) return;

            // Find the target object
            var target = FindObjectsByType<NetworkedObject>(FindObjectsSortMode.None)
                .FirstOrDefault(o => o.ObjectId == targetObjectId);

            if (target == null)
            {
                Debug.LogWarning($"[{nameof(NetworkedPlayer)}] Interaction target '{targetObjectId}' not found.");
                return;
            }

            // Proximity check
            float dist = Vector3.Distance(transform.position, target.transform.position);
            if (dist > 3f) // interaction reach
            {
                Debug.LogWarning(
                    $"[{nameof(NetworkedPlayer)}] Player {OwnerClientId} too far from '{targetObjectId}' ({dist:F1} units).");
                return;
            }

            target.RequestInteractServerRpc(OwnerClientId);
        }

        // ================================================================
        // Outfit serialisation
        // ================================================================

        /// <summary>
        /// Serialises a dictionary of outfit key-values to a compact JSON string.
        /// </summary>
        private string SerializeOutfit(Dictionary<string, string> outfitData)
        {
            if (outfitData == null || outfitData.Count == 0) return "{}";

            var entries = new System.Text.StringBuilder("{");
            bool first = true;
            foreach (var kv in outfitData)
            {
                if (!first) entries.Append(',');
                entries.Append($"\"{kv.Key}\":\"{kv.Value}\"");
                first = false;
            }
            entries.Append('}');
            return entries.ToString();
        }

        /// <summary>
        /// Applies outfit JSON to the <see cref="AvatarController"/>.
        /// </summary>
        private void ApplyOutfit(string outfitJson)
        {
            if (Avatar == null || string.IsNullOrWhiteSpace(outfitJson)) return;

            try
            {
                Avatar.ApplyOutfit(outfitJson);
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[{nameof(NetworkedPlayer)}] Failed to apply outfit: {ex.Message}");
            }
        }

        // ================================================================
        // UI helpers
        // ================================================================

        /// <summary>
        /// Refreshes the name-tag text to match <see cref="_cachedDisplayName"/>.
        /// </summary>
        private void RefreshNameTag()
        {
            if (NameTagText != null)
                NameTagText.text = _cachedDisplayName;
        }

        // ================================================================
        // Debug
        // ================================================================

        /// <summary>
        /// Draws the chat-range radius in the Scene view for debugging.
        /// </summary>
        private void OnDrawGizmosSelected()
        {
            Gizmos.color = new Color(0f, 1f, 0.5f, 0.3f);
            Gizmos.DrawWireSphere(transform.position, NetworkConstants.CHAT_RANGE_DEFAULT);

            Gizmos.color = new Color(1f, 0.5f, 0f, 0.2f);
            Gizmos.DrawWireSphere(transform.position, NetworkConstants.VOICE_RANGE_DEFAULT);
        }
    }
}
