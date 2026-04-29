using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Unity.Netcode;

namespace KawaiiCoolIsland.Multiplayer
{
    /// <summary>
    /// Enumeration of supported room / world types in KawaiiCool Island.
    /// Each type enforces its own player-capacity rules via <see cref="NetworkConstants"/>.
    /// </summary>
    public enum RoomType
    {
        /// <summary>Public social Hub — up to <see cref="NetworkConstants.MAX_PLAYERS_HUB"/> players.</summary>
        Hub,

        /// <summary>Private player Island — up to <see cref="NetworkConstants.MAX_PLAYERS_ISLAND"/> players.</summary>
        Island,

        /// <summary>Session-based Minigame — up to <see cref="NetworkConstants.MAX_PLAYERS_MINIGAME"/> players.</summary>
        Minigame,

        /// <summary>Password-protected or invite-only private room.</summary>
        Private,

        /// <summary>Limited-time event world with special rules.</summary>
        Event
    }

    /// <summary>
    /// Lightweight serialisable metadata describing a player's presence
    /// inside a room. Used by <see cref="RoomManager.PlayersInRoom"/>.
    /// </summary>
    [System.Serializable]
    public class PlayerRoomInfo
    {
        /// <summary>Unique player identifier (matches <see cref="NetworkObjectId"/>).</summary>
        public string PlayerId;

        /// <summary>Human-readable display name shown above the avatar.</summary>
        public string DisplayName;

        /// <summary>JSON blob describing avatar outfit / cosmetics.</summary>
        public string AvatarJson;

        /// <summary>Whether this player created / is hosting the room.</summary>
        public bool IsHost;

        /// <summary><see cref="Time.time"/> when the player entered the room.</summary>
        public float JoinTime;

        /// <summary>
        /// Ready-state flag used by minigame lobbies. Ignored in Hub/Island.
        /// </summary>
        public bool IsReady;

        /// <summary>Seconds elapsed since <see cref="JoinTime"/>.</summary>
        public float TimeInRoom => Time.time - JoinTime;
    }

    /// <summary>
    /// Server-authoritative room manager responsible for creating, joining,
    /// leaving, and transitioning between Hub, Island, Minigame, and Event rooms.
    /// Persists across scene loads as a <see cref="Singleton{T}"/>.
    /// </summary>
    public class RoomManager : Singleton<RoomManager>
    {
        // ------------------------------------------------------------------
        // Public state
        // ------------------------------------------------------------------

        /// <summary>Unique room identifier (GUID or host-provided code).</summary>
        public string CurrentRoomId { get; private set; }

        /// <summary>The <see cref="RoomType"/> of the currently occupied room.</summary>
        public RoomType CurrentRoomType { get; private set; }

        /// <summary>Human-readable room name displayed in the HUD.</summary>
        public string RoomName { get; private set; }

        /// <summary>Maximum player capacity enforced by this room type.</summary>
        public int MaxPlayers { get; private set; }

        /// <summary>
        /// Whether the room is hidden from public room lists and requires
        /// an invite code to join.
        /// </summary>
        public bool IsPrivate { get; private set; }

        /// <summary>
        /// Snapshot of all players currently in the room. Updated on every
        /// join / leave. Only valid while connected.
        /// </summary>
        public List<PlayerRoomInfo> PlayersInRoom { get; private set; } = new();

        // ------------------------------------------------------------------
        // Private state
        // ------------------------------------------------------------------

        /// <summary>
        /// The timestamp (via <see cref="Time.time"/>) when the local player
        /// entered the current room.
        /// </summary>
        private float _roomEnterTime;

        /// <summary>
        /// NetworkVariable that replicates the room's player count to all
        /// clients for HUD display.
        /// </summary>
        private readonly NetworkVariable<int> _netPlayerCount = new(
            readPerm: NetworkVariableReadPermission.Everyone,
            writePerm: NetworkVariableWritePermission.Server
        );

        /// <summary>
        /// NetworkVariable that replicates whether the room is full.
        /// </summary>
        private readonly NetworkVariable<bool> _netIsRoomFull = new(
            readPerm: NetworkVariableReadPermission.Everyone,
            writePerm: NetworkVariableWritePermission.Server
        );

        // ------------------------------------------------------------------
        // Lifecycle
        // ------------------------------------------------------------------

        protected override void Awake()
        {
            base.Awake();
            // Keep across scene loads
            DontDestroyOnLoad(gameObject);
        }

        public override void OnNetworkSpawn()
        {
            base.OnNetworkSpawn();
            _netPlayerCount.OnValueChanged += OnPlayerCountChanged;
        }

        public override void OnNetworkDespawn()
        {
            _netPlayerCount.OnValueChanged -= OnPlayerCountChanged;
            base.OnNetworkDespawn();
        }

        // ------------------------------------------------------------------
        // Room lifecycle
        // ------------------------------------------------------------------

        /// <summary>
        /// Creates a new room of the specified type. Only the host may create
        /// rooms in a networked session; calling this as a client will
        /// relay the request via ServerRpc.
        /// </summary>
        /// <param name="type">Room type dictating capacity and rules.</param>
        /// <param name="roomName">Human-readable name shown in the HUD.</param>
        /// <param name="maxPlayers">Override capacity. Zero = use type default.</param>
        /// <param name="isPrivate">If true, the room is hidden from public listings.</param>
        public void CreateRoom(RoomType type, string roomName, int maxPlayers = 0, bool isPrivate = false)
        {
            if (!KawaiiNetworkManager.Instance.IsHost)
            {
                // Client asks server to create
                CreateRoomServerRpc(type, roomName, maxPlayers, isPrivate);
                return;
            }

            int capacity = ResolveCapacity(type, maxPlayers);
            CurrentRoomId   = Guid.NewGuid().ToString("N").Substring(0, 8).ToUpper();
            CurrentRoomType = type;
            RoomName        = roomName;
            MaxPlayers      = capacity;
            IsPrivate       = isPrivate;
            _roomEnterTime  = Time.time;

            PlayersInRoom.Clear();
            _netPlayerCount.Value = 1;
            _netIsRoomFull.Value  = false;

            // Add host as first player
            AddLocalPlayerToRoom(true);

            Debug.Log(
                $"[{nameof(RoomManager)}] Created room '{RoomName}' [{CurrentRoomId}] " +
                $"Type={type}, Max={MaxPlayers}, Private={isPrivate}");

            OnRoomJoined?.Invoke();
        }

        /// <summary>
        /// Joins an existing room by its unique identifier.
        /// </summary>
        /// <param name="roomId">The room code / GUID.</param>
        public void JoinRoom(string roomId)
        {
            if (KawaiiNetworkManager.Instance.IsHost)
            {
                Debug.LogWarning($"[{nameof(RoomManager)}] Host cannot join rooms; use CreateRoom instead.");
                return;
            }

            JoinRoomServerRpc(roomId);
        }

        /// <summary>
        /// Attempts to join a random public room of the given type.
        /// Stubbed for integration with a matchmaking or Lobby service.
        /// </summary>
        /// <param name="type">Desired room type.</param>
        public void JoinRandomRoom(RoomType type)
        {
            // TODO: Query Lobby / Matchmaker for available public rooms
            Debug.Log($"[{nameof(RoomManager)}] JoinRandomRoom({type}) — awaiting matchmaking integration.");
        }

        /// <summary>
        /// Leaves the current room and returns to the Hub.
        /// Fires <see cref="OnRoomLeft"/> locally.
        /// </summary>
        public void LeaveRoom()
        {
            LeaveRoomServerRpc();

            // Local teardown
            CurrentRoomId   = null;
            RoomName        = null;
            MaxPlayers      = 0;
            IsPrivate       = false;
            PlayersInRoom.Clear();

            OnRoomLeft?.Invoke();

            // Auto-return to Hub
            NetworkSceneLoader.Instance?.ReturnToHub();
        }

        /// <summary>
        /// Transitions every connected client to a different scene / room.
        /// Host only.
        /// </summary>
        /// <param name="roomId">Target room identifier.</param>
        public void TransferToRoom(string roomId)
        {
            if (!KawaiiNetworkManager.Instance.IsHost)
            {
                Debug.LogWarning($"[{nameof(RoomManager)}] Only the host may initiate room transfers.");
                return;
            }

            string sceneName = ResolveSceneName(roomId);
            if (!string.IsNullOrEmpty(sceneName))
            {
                NetworkSceneLoader.Instance?.LoadScene(sceneName, LoadSceneMode.Single);
                BroadcastRoomTransferClientRpc(roomId, sceneName);
            }
        }

        /// <summary>
        /// Sends an invite to <paramref name="playerId"/> to join the current room.
        /// Stubbed for integration with a push-notification or Lobby service.
        /// </summary>
        public void InvitePlayer(string playerId)
        {
            if (string.IsNullOrEmpty(CurrentRoomId))
            {
                Debug.LogWarning($"[{nameof(RoomManager)}] Cannot invite — not currently in a room.");
                return;
            }

            Debug.Log($"[{nameof(RoomManager)}] Inviting player {playerId} to room '{CurrentRoomId}'.");
            // TODO: Integrate with Unity Lobby / Friends / Push notifications
        }

        /// <summary>
        /// Removes <paramref name="playerId"/> from the room. Host only.
        /// </summary>
        public void KickPlayer(string playerId)
        {
            if (!KawaiiNetworkManager.Instance.IsHost)
            {
                Debug.LogWarning($"[{nameof(RoomManager)}] Only the host may kick players.");
                return;
            }

            KickPlayerServerRpc(playerId);
        }

        /// <summary>
        /// Toggles the room's public / private visibility. Host only.
        /// </summary>
        public void SetRoomPrivacy(bool isPrivate)
        {
            if (!KawaiiNetworkManager.Instance.IsHost) return;

            IsPrivate = isPrivate;
            SetRoomPrivacyClientRpc(isPrivate);
            OnRoomPrivacyChanged?.Invoke();
        }

        // ------------------------------------------------------------------
        // Queries
        // ------------------------------------------------------------------

        /// <summary>
        /// Returns the <see cref="PlayerRoomInfo"/> for a given player,
        /// or <c>null</c> if they are not in the room.
        /// </summary>
        public PlayerRoomInfo GetPlayerInfo(string playerId)
        {
            return PlayersInRoom.FirstOrDefault(p => p.PlayerId == playerId);
        }

        /// <summary>
        /// Whether the room has reached its player-capacity limit.
        /// </summary>
        public bool IsRoomFull()
        {
            if (string.IsNullOrEmpty(CurrentRoomId)) return false;
            return PlayersInRoom.Count >= MaxPlayers;
        }

        /// <summary>
        /// Seconds elapsed since the local player entered the current room.
        /// </summary>
        public float GetTimeInRoom()
        {
            if (string.IsNullOrEmpty(CurrentRoomId)) return 0f;
            return Time.time - _roomEnterTime;
        }

        /// <summary>
        /// Current number of players in the room.
        /// </summary>
        public int PlayerCount => PlayersInRoom.Count;

        /// <summary>
        /// Number of players in the room who have marked themselves ready.
        /// Only meaningful in Minigame rooms.
        /// </summary>
        public int ReadyCount => PlayersInRoom.Count(p => p.IsReady);

        // ------------------------------------------------------------------
        // Server RPCs
        // ------------------------------------------------------------------

        /// <summary>
        /// Server-side room creation. Validates capacity and notifies all clients.
        /// </summary>
        [ServerRpc(RequireOwnership = false)]
        private void CreateRoomServerRpc(RoomType type, string roomName, int maxPlayers, bool isPrivate)
        {
            if (!IsServer) return;

            int capacity = ResolveCapacity(type, maxPlayers);

            // Reject if at global player cap
            if (NetworkManager.Singleton.ConnectedClients.Count >= NetworkConstants.ABSOLUTE_MAX_PLAYERS)
            {
                Debug.LogWarning($"[{nameof(RoomManager)}] Global player cap reached. Room creation rejected.");
                return;
            }

            // Store room state
            CurrentRoomId   = Guid.NewGuid().ToString("N").Substring(0, 8).ToUpper();
            CurrentRoomType = type;
            RoomName        = roomName;
            MaxPlayers      = capacity;
            IsPrivate       = isPrivate;
            _roomEnterTime  = Time.time;

            PlayersInRoom.Clear();
            _netPlayerCount.Value = 0;
            _netIsRoomFull.Value  = false;

            // Add all currently connected players
            foreach (var client in NetworkManager.Singleton.ConnectedClientsList)
            {
                var np = KawaiiNetworkManager.Instance?.GetPlayer(client.ClientId);
                if (np != null)
                    AddPlayerToRoom(np.NetworkObjectId.ToString(), np.DisplayName, client.ClientId == NetworkManager.Singleton.LocalClientId);
            }

            SyncRoomStateClientRpc(CurrentRoomId, (int)type, RoomName, MaxPlayers, IsPrivate);
            OnRoomJoined?.Invoke();
        }

        /// <summary>
        /// Server-side join handler. Validates room capacity and syncs state.
        /// </summary>
        [ServerRpc(RequireOwnership = false)]
        private void JoinRoomServerRpc(string roomId)
        {
            if (!IsServer) return;

            if (CurrentRoomId != roomId)
            {
                Debug.LogWarning($"[{nameof(RoomManager)}] Room '{roomId}' does not exist.");
                return;
            }

            if (IsRoomFull())
            {
                Debug.LogWarning($"[{nameof(RoomManager)}] Room '{roomId}' is full. Join rejected.");
                return;
            }

            // Notify joining client of current room state
            SyncRoomStateClientRpc(CurrentRoomId, (int)CurrentRoomType, RoomName, MaxPlayers, IsPrivate);
        }

        /// <summary>
        /// Server-side leave handler. Removes player and broadcasts to room.
        /// </summary>
        [ServerRpc(RequireOwnership = false)]
        private void LeaveRoomServerRpc()
        {
            if (!IsServer) return;

            ulong clientId = ServerRpcParamsExt.GetClientId(ref new ServerRpcParams());
            string playerId = clientId.ToString();

            RemovePlayerFromRoom(playerId);
        }

        /// <summary>
        /// Server-side player kick. Validates host authority before removing.
        /// </summary>
        [ServerRpc(RequireOwnership = false)]
        private void KickPlayerServerRpc(string playerId)
        {
            if (!IsServer) return;

            // Verify caller is host
            ulong callerId = ServerRpcParamsExt.GetClientId(ref new ServerRpcParams());
            if (callerId != NetworkManager.Singleton.LocalClientId)
            {
                Debug.LogWarning($"[{nameof(RoomManager)}] Non-host client {callerId} attempted to kick player.");
                return;
            }

            RemovePlayerFromRoom(playerId);

            // Force-disconnect the kicked client
            if (ulong.TryParse(playerId, out ulong targetClientId))
            {
                NetworkManager.Singleton.DisconnectClient(targetClientId);
            }
        }

        // ------------------------------------------------------------------
        // Client RPCs
        // ------------------------------------------------------------------

        /// <summary>
        /// Pushes the authoritative room state to every client.
        /// Called after creation, join, or any mutating operation.
        /// </summary>
        [ClientRpc]
        private void SyncRoomStateClientRpc(string roomId, int roomType, string roomName,
            int maxPlayers, bool isPrivate)
        {
            CurrentRoomId   = roomId;
            CurrentRoomType = (RoomType)roomType;
            RoomName        = roomName;
            MaxPlayers      = maxPlayers;
            IsPrivate       = isPrivate;

            if (_roomEnterTime <= 0f)
                _roomEnterTime = Time.time;

            Debug.Log(
                $"[{nameof(RoomManager)}] Synced to room '{RoomName}' [{CurrentRoomId}] " +
                $"Type={CurrentRoomType}");
        }

        /// <summary>
        /// Notifies every client that the room privacy flag has changed.
        /// </summary>
        [ClientRpc]
        private void SetRoomPrivacyClientRpc(bool isPrivate)
        {
            IsPrivate = isPrivate;
            OnRoomPrivacyChanged?.Invoke();
        }

        /// <summary>
        /// Instructs every client to begin a scene transition to a new room.
        /// </summary>
        [ClientRpc]
        private void BroadcastRoomTransferClientRpc(string roomId, string sceneName)
        {
            Debug.Log($"[{nameof(RoomManager)}] Room transfer to '{sceneName}' [{roomId}] broadcast.");
            NetworkSceneLoader.Instance?.LoadScene(sceneName, LoadSceneMode.Single);
        }

        /// <summary>
        /// Announces a new player to everyone in the room.
        /// </summary>
        [ClientRpc]
        private void PlayerJoinedRoomClientRpc(string playerId, string displayName, bool isHost)
        {
            if (PlayersInRoom.Exists(p => p.PlayerId == playerId)) return;

            var info = new PlayerRoomInfo
            {
                PlayerId    = playerId,
                DisplayName = displayName,
                IsHost      = isHost,
                JoinTime    = Time.time,
                IsReady     = false
            };

            PlayersInRoom.Add(info);
            _netPlayerCount.Value = PlayersInRoom.Count;

            Debug.Log($"[{nameof(RoomManager)}] Player '{displayName}' ({playerId}) joined room.");
            OnPlayerJoinedRoom?.Invoke(info);
        }

        /// <summary>
        /// Announces a player's departure to everyone in the room.
        /// </summary>
        [ClientRpc]
        private void PlayerLeftRoomClientRpc(string playerId)
        {
            var info = PlayersInRoom.FirstOrDefault(p => p.PlayerId == playerId);
            if (info != null)
            {
                PlayersInRoom.Remove(info);
                _netPlayerCount.Value = PlayersInRoom.Count;
                OnPlayerLeftRoom?.Invoke(info);
            }
        }

        // ------------------------------------------------------------------
        // Internal helpers
        // ------------------------------------------------------------------

        /// <summary>
        /// Adds the local player to <see cref="PlayersInRoom"/>.
        /// </summary>
        private void AddLocalPlayerToRoom(bool isHost)
        {
            var localPlayer = KawaiiNetworkManager.Instance?.GetLocalPlayer();
            if (localPlayer == null) return;

            AddPlayerToRoom(
                localPlayer.NetworkObjectId.ToString(),
                localPlayer.DisplayName,
                isHost);
        }

        /// <summary>
        /// Server-side: adds a player record and broadcasts to room.
        /// </summary>
        private void AddPlayerToRoom(string playerId, string displayName, bool isHost)
        {
            if (PlayersInRoom.Exists(p => p.PlayerId == playerId)) return;

            var info = new PlayerRoomInfo
            {
                PlayerId    = playerId,
                DisplayName = displayName,
                IsHost      = isHost,
                JoinTime    = Time.time,
                IsReady     = false
            };

            PlayersInRoom.Add(info);
            _netPlayerCount.Value = PlayersInRoom.Count;
            _netIsRoomFull.Value  = PlayersInRoom.Count >= MaxPlayers;

            PlayerJoinedRoomClientRpc(playerId, displayName, isHost);
        }

        /// <summary>
        /// Server-side: removes a player record and broadcasts to room.
        /// </summary>
        private void RemovePlayerFromRoom(string playerId)
        {
            var info = PlayersInRoom.FirstOrDefault(p => p.PlayerId == playerId);
            if (info == null) return;

            PlayersInRoom.Remove(info);
            _netPlayerCount.Value = PlayersInRoom.Count;
            _netIsRoomFull.Value  = PlayersInRoom.Count >= MaxPlayers;

            PlayerLeftRoomClientRpc(playerId);
        }

        /// <summary>
        /// Maps a <see cref="RoomType"/> to its default player-capacity constant.
        /// </summary>
        private int ResolveCapacity(RoomType type, int requestedCap)
        {
            if (requestedCap > 0) return Mathf.Min(requestedCap, NetworkConstants.ABSOLUTE_MAX_PLAYERS);

            return type switch
            {
                RoomType.Hub      => NetworkConstants.MAX_PLAYERS_HUB,
                RoomType.Island   => NetworkConstants.MAX_PLAYERS_ISLAND,
                RoomType.Minigame => NetworkConstants.MAX_PLAYERS_MINIGAME,
                RoomType.Private  => NetworkConstants.MAX_PLAYERS_ISLAND,
                RoomType.Event    => NetworkConstants.MAX_PLAYERS_HUB,
                _                 => NetworkConstants.MAX_PLAYERS_HUB
            };
        }

        /// <summary>
        /// Maps a room identifier to a Unity scene name.
        /// </summary>
        private string ResolveSceneName(string roomId)
        {
            // Simple mapping: room prefix determines scene
            if (roomId.StartsWith("HUB"))  return NetworkConstants.SCENE_HUB;
            if (roomId.StartsWith("ISL"))  return NetworkConstants.SCENE_ISLAND;
            if (roomId.StartsWith("MINI")) return NetworkConstants.SCENE_MINIGAME_PREFIX + roomId.Substring(5);
            return NetworkConstants.SCENE_HUB; // fallback
        }

        /// <summary>
        /// Callback fired when the replicated player-count changes.
        /// </summary>
        private void OnPlayerCountChanged(int previous, int current)
        {
            Debug.Log($"[{nameof(RoomManager)}] Room player count updated: {previous} -> {current}");
        }

        // ------------------------------------------------------------------
        // Events
        // ------------------------------------------------------------------

        /// <summary>Fired locally when the local player successfully joins (or creates) a room.</summary>
        public event Action OnRoomJoined;

        /// <summary>Fired locally when the local player leaves a room.</summary>
        public event Action OnRoomLeft;

        /// <summary>Fired on every client when a new player enters the room.</summary>
        public event Action<PlayerRoomInfo> OnPlayerJoinedRoom;

        /// <summary>Fired on every client when a player leaves the room.</summary>
        public event Action<PlayerRoomInfo> OnPlayerLeftRoom;

        /// <summary>Fired when the room's privacy flag is toggled.</summary>
        public event Action OnRoomPrivacyChanged;
    }

    // ------------------------------------------------------------------
    // Extension helper for ServerRpcParams
    // ------------------------------------------------------------------

    /// <summary>
    /// Static helper to extract the sender client ID from ServerRpc parameters.
    /// </summary>
    public static class ServerRpcParamsExt
    {
        public static ulong GetClientId(ref ServerRpcParams rpcParams)
        {
            return rpcParams.Receive.SenderClientId;
        }
    }
}
