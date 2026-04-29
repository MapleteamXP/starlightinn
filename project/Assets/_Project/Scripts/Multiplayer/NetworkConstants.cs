using UnityEngine;

namespace KawaiiCoolIsland.Multiplayer
{
    /// <summary>
    /// Centralized network constants for the KawaiiCool Island multiplayer system.
    /// Defines ports, player limits, sync rates, ranges, and network channel indices
    /// used across the Netcode for GameObjects architecture.
    /// </summary>
    public static class NetworkConstants
    {
        // ------------------------------------------------------------------
        // Connection
        // ------------------------------------------------------------------

        /// <summary>Default UDP port for direct (non-Relay) connections.</summary>
        public const int DEFAULT_PORT = 7777;

        /// <summary>
        /// Maximum length for a Relay join code buffer when copying from
        /// <see cref="Unity.Services.Relay.Models.JoinAllocation"/>.
        /// </summary>
        public const int JOIN_CODE_LENGTH = 16;

        // ------------------------------------------------------------------
        // Player capacity per room type
        // ------------------------------------------------------------------

        /// <summary>Maximum concurrent players in the public Hub scene.</summary>
        public const int MAX_PLAYERS_HUB = 50;

        /// <summary>Maximum concurrent players on a private Island.</summary>
        public const int MAX_PLAYERS_ISLAND = 10;

        /// <summary>Maximum concurrent players in a Minigame session.</summary>
        public const int MAX_PLAYERS_MINIGAME = 4;

        /// <summary>Absolute hard cap across all room types.</summary>
        public const int ABSOLUTE_MAX_PLAYERS = 100;

        // ------------------------------------------------------------------
        // Sync timing
        // ------------------------------------------------------------------

        /// <summary>
        /// Seconds between position NetworkVariable dirtying (20 Hz).
        /// Lower = smoother but more bandwidth.
        /// </summary>
        public const float POSITION_SYNC_INTERVAL = 0.05f;

        /// <summary>Network tick rate in Hz. Must match NGO Project Settings.</summary>
        public const int NETWORK_TICK_RATE = 60;

        /// <summary>
        /// NGO <see cref="NetworkTime.TickInterval"/> expressed as seconds.
        /// </summary>
        public const float TICK_DELTA = 1f / NETWORK_TICK_RATE;

        // ------------------------------------------------------------------
        // Proximity ranges
        // ------------------------------------------------------------------

        /// <summary>
        /// Default proximity text-chat radius in world units.
        /// Messages from players beyond this distance are hidden.
        /// </summary>
        public const float CHAT_RANGE_DEFAULT = 12f;

        /// <summary>
        /// Default proximity voice-chat radius in world units.
        /// </summary>
        public const float VOICE_RANGE_DEFAULT = 8f;

        // ------------------------------------------------------------------
        // Chat / Social
        // ------------------------------------------------------------------

        /// <summary>Maximum Unicode characters allowed in a single chat message.</summary>
        public const int MAX_CHAT_MESSAGE_LENGTH = 200;

        /// <summary>
        /// Seconds a chat bubble remains visible above a player before fading.
        /// </summary>
        public const float CHAT_BUBBLE_DURATION = 5f;

        /// <summary>Seconds for the chat-bubble fade-out animation.</summary>
        public const float CHAT_BUBBLE_FADE_TIME = 0.5f;

        // ------------------------------------------------------------------
        // Interaction
        // ------------------------------------------------------------------

        /// <summary>
        /// Minimum seconds between consecutive interactions on the same object.
        /// </summary>
        public const float INTERACTION_COOLDOWN = 0.5f;

        /// <summary>
        /// Seconds before a <see cref="NetworkedPlayer"/> without any incoming
        /// packets is considered timed-out by the host.
        /// </summary>
        public const float PLAYER_TIMEOUT = 30f;

        // ------------------------------------------------------------------
        // Movement interpolation
        // ------------------------------------------------------------------

        /// <summary>
        /// Lerp multiplier (per second) used to smooth remote player positions.
        /// Higher = snappier; Lower = silkier but more latency-ghosting.
        /// </summary>
        public const float INTERPOLATION_SPEED_DEFAULT = 15f;

        /// <summary>
        /// Distance at which a remote player snaps instantly rather than lerps
        /// (e.g. after a teleport / scene load).
        /// </summary>
        public const float POSITION_SNAP_THRESHOLD = 2f;

        // ------------------------------------------------------------------
        // Network channels
        // ------------------------------------------------------------------

        /// <summary>
        /// Reliable sequenced channel index (NGO default). Use for chat,
        /// room state, and critical game events.
        /// </summary>
        public const int CHANNEL_RELIABLE = 0;

        /// <summary>
        /// Unreliable channel index. Use for high-frequency movement,
        /// animation frames, and non-critical state.
        /// </summary>
        public const int CHANNEL_UNRELIABLE = 1;

        // ------------------------------------------------------------------
        // Scene names
        // ------------------------------------------------------------------

        /// <summary>Build-index name of the bootstrap / title scene.</summary>
        public const string SCENE_BOOTSTRAP = "Bootstrap";

        /// <summary>Build-index name of the public Hub world scene.</summary>
        public const string SCENE_HUB = "Hub";

        /// <summary>Build-index name of the private Island home scene.</summary>
        public const string SCENE_ISLAND = "Island";

        /// <summary>
        /// Prefix for minigame additive scenes. Full name is built as
        /// <c>SCENE_MINIGAME_PREFIX + minigameId</c>.
        /// </summary>
        public const string SCENE_MINIGAME_PREFIX = "Minigame_";

        // ------------------------------------------------------------------
        // Relay
        // ------------------------------------------------------------------

        /// <summary>
        /// Maximum allocation lifetime in seconds for a Relay host.
        /// NGO will auto-renew before expiry.
        /// </summary>
        public const int RELAY_MAX_ALLOCATION_LIFETIME = 3600;

        /// <summary>Unity Transport protocol type for Relay (DTLS is encrypted UDP).</summary>
        public const string RELAY_CONNECTION_TYPE = "dtls";

        // ------------------------------------------------------------------
        // Debug / HUD
        // ------------------------------------------------------------------

        /// <summary>
        /// Seconds between refresh cycles of the connection-quality HUD.
        /// </summary>
        public const float CONNECTION_QUALITY_UPDATE_INTERVAL = 1f;

        /// <summary>
        /// RTT threshold in ms below which connection is considered
        /// <see cref="ConnectionQuality.Excellent"/>.
        /// </summary>
        public const int RTT_EXCELLENT = 50;

        /// <summary>
        /// RTT threshold in ms below which connection is considered
        /// <see cref="ConnectionQuality.Good"/>.
        /// </summary>
        public const int RTT_GOOD = 100;

        /// <summary>
        /// RTT threshold in ms below which connection is considered
        /// <see cref="ConnectionQuality.Fair"/>.
        /// </summary>
        public const int RTT_FAIR = 200;

        /// <summary>
        /// RTT threshold in ms below which connection is considered
        /// <see cref="ConnectionQuality.Poor"/> (anything above is Disconnected).
        /// </summary>
        public const int RTT_POOR = 500;
    }
}
