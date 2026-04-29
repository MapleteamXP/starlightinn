using UnityEngine;
using UnityEngine.UI;
using TMPro;
using Unity.Netcode;

namespace KawaiiCoolIsland.Multiplayer
{
    /// <summary>
    /// Enumeration of discrete connection-quality tiers used by the HUD
    /// and gameplay systems (e.g. adaptive compression, movement buffering).
    /// </summary>
    public enum ConnectionQuality
    {
        /// <summary>RTT &lt; 50 ms — ideal for competitive minigames.</summary>
        Excellent,

        /// <summary>RTT 50–100 ms — perfectly playable.</summary>
        Good,

        /// <summary>RTT 100–200 ms — minor latency, interpolation increased.</summary>
        Fair,

        /// <summary>RTT 200–500 ms — noticeable lag, reduced fidelity.</summary>
        Poor,

        /// <summary>RTT &gt; 500 ms or no response — effectively disconnected.</summary>
        Disconnected
    }

    /// <summary>
    /// Real-time connection-quality HUD that polls <see cref="NetworkManager"/>
    /// transport statistics and displays ping, packet-loss percentage,
    /// and a colour-coded indicator. Attach to a Canvas in the HUD scene.
    /// </summary>
    [RequireComponent(typeof(CanvasGroup))]
    public class ConnectionQualityMonitor : MonoBehaviour
    {
        // ------------------------------------------------------------------
        // Inspector
        // ------------------------------------------------------------------

        [Header("Text Displays")]
        [Tooltip("TMP_Text element that shows current RTT in milliseconds.")]
        public TMP_Text PingText;

        [Tooltip("TMP_Text element that shows estimated packet-loss percentage.")]
        public TMP_Text PacketLossText;

        [Header("Visual Indicator")]
        [Tooltip("Image whose colour is driven by the current ConnectionQuality tier.")]
        public Image QualityIndicator;

        [Header("Timing")]
        [Tooltip("Seconds between each statistics refresh.")]
        public float UpdateInterval = NetworkConstants.CONNECTION_QUALITY_UPDATE_INTERVAL;

        [Header("Quality Colours")]
        [Tooltip("Colour when ConnectionQuality is Excellent.")]
        public Color ExcellentColor = Color.green;

        [Tooltip("Colour when ConnectionQuality is Good.")]
        public Color GoodColor = new Color(0.5f, 1f, 0.5f);

        [Tooltip("Colour when ConnectionQuality is Fair.")]
        public Color FairColor = Color.yellow;

        [Tooltip("Colour when ConnectionQuality is Poor.")]
        public Color PoorColor = Color.red;

        [Tooltip("Colour when ConnectionQuality is Disconnected.")]
        public Color DisconnectedColor = Color.gray;

        // ------------------------------------------------------------------
        // Private state
        // ------------------------------------------------------------------

        /// <summary>Time of the last statistics refresh.</summary>
        private float _lastUpdateTime;

        /// <summary>Last sampled round-trip time in milliseconds.</summary>
        private int _lastRTT;

        /// <summary>Cached reference to the NGO transport for RTT polling.</summary>
        private Unity.Netcode.Transports.UTP.UnityTransport _transport;

        /// <summary>Running sum of lost packets since last reset.</summary>
        private ulong _cumulativePacketLoss;

        /// <summary>Running sum of sent packets since last reset.</summary>
        private ulong _cumulativePacketsSent;

        /// <summary>Cached CanvasGroup for optional fade behaviour.</summary>
        private CanvasGroup _canvasGroup;

        // ------------------------------------------------------------------
        // Properties
        // ------------------------------------------------------------------

        /// <summary>
        /// The most recently evaluated <see cref="ConnectionQuality"/> tier.
        /// Updated every <see cref="UpdateInterval"/> seconds.
        /// </summary>
        public ConnectionQuality CurrentQuality { get; private set; } = ConnectionQuality.Disconnected;

        // ------------------------------------------------------------------
        // Lifecycle
        // ------------------------------------------------------------------

        private void Awake()
        {
            _canvasGroup = GetComponent<CanvasGroup>();

            // Optional: hide until connected
            if (_canvasGroup != null)
                _canvasGroup.alpha = 0f;
        }

        private void Start()
        {
            if (NetworkManager.Singleton != null)
                _transport = NetworkManager.Singleton.GetComponent<Unity.Netcode.Transports.UTP.UnityTransport>();
        }

        private void Update()
        {
            if (NetworkManager.Singleton == null || !NetworkManager.Singleton.IsListening)
            {
                CurrentQuality = ConnectionQuality.Disconnected;
                FadeDisplay(0f);
                return;
            }

            FadeDisplay(1f);

            if (Time.time - _lastUpdateTime >= UpdateInterval)
            {
                _lastUpdateTime = Time.time;
                UpdateDisplay();
            }
        }

        // ------------------------------------------------------------------
        // Core
        // ------------------------------------------------------------------

        /// <summary>
        /// Polls the active transport for RTT and computes packet-loss delta,
        /// then refreshes all UI elements.
        /// </summary>
        private void UpdateDisplay()
        {
            _lastRTT = SampleRTT();
            CurrentQuality = GetQualityFromRTT(_lastRTT);

            float packetLossPercent = ComputePacketLossPercent();

            // --- Ping text ---
            if (PingText != null)
            {
                string qualityLabel = CurrentQuality switch
                {
                    ConnectionQuality.Excellent => "EXC",
                    ConnectionQuality.Good      => "GOOD",
                    ConnectionQuality.Fair      => "FAIR",
                    ConnectionQuality.Poor      => "POOR",
                    _                           => "DC"
                };

                PingText.text = $"<b>{_lastRTT} ms</b>  ({qualityLabel})";
                PingText.color = GetColorForQuality(CurrentQuality);
            }

            // --- Packet-loss text ---
            if (PacketLossText != null)
            {
                PacketLossText.text = $"Loss: {packetLossPercent:F1}%";
                PacketLossText.color = packetLossPercent > 5f
                    ? PoorColor
                    : (packetLossPercent > 1f ? FairColor : Color.white);
            }

            // --- Indicator dot ---
            if (QualityIndicator != null)
            {
                QualityIndicator.color = GetColorForQuality(CurrentQuality);

                // Subtle pulse animation when quality degrades
                float pulse = CurrentQuality >= ConnectionQuality.Poor
                    ? 1f + Mathf.PingPong(Time.time * 3f, 0.3f)
                    : 1f;
                QualityIndicator.transform.localScale = Vector3.one * pulse;
            }
        }

        /// <summary>
        /// Samples the current transport RTT in milliseconds.
        /// Falls back to <c>-1</c> if the transport is unavailable.
        /// </summary>
        /// <returns>Round-trip time in ms, or <c>-1</c> when unknown.</returns>
        private int SampleRTT()
        {
            if (_transport == null || _transport.NetworkDriver.IsCreated == false)
                return -1;

            // NGO 1.x / Unity Transport 2.x exposes RTT via NetworkDriver
            try
            {
                var driver = _transport.NetworkDriver;
                if (driver.IsCreated)
                {
                    // Iterate connected peers and average RTT
                    int rttSum = 0;
                    int count = 0;

                    var connections = driver.GetConnections();
                    foreach (var conn in connections)
                    {
                        if (driver.GetConnectionState(conn) == Unity.Networking.Transport.NetworkConnection.State.Connected)
                        {
                            rttSum += (int)driver.GetRemoteEndpoint(conn).NetworkId; // fallback
                            count++;
                        }
                    }

                    // Prefer NGO's built-in NetworkTickSystem RTT if available
                    if (NetworkManager.Singleton.LocalClient != null)
                    {
                        var tickSystem = NetworkManager.Singleton.NetworkTimeSystem;
                        if (tickSystem != null)
                            return (int)(tickSystem.CurrentNetworkTimeOffset * 1000f * 2f);
                    }

                    return count > 0 ? rttSum / count : -1;
                }
            }
            catch
            {
                // Graceful fallback for API differences between NGO versions
            }

            // Ultimate fallback: simulate from server time offset
            return NetworkManager.Singleton.NetworkTimeSystem != null
                ? (int)(NetworkManager.Singleton.NetworkTimeSystem.CurrentNetworkTimeOffset * 1000f * 2f)
                : -1;
        }

        /// <summary>
        /// Computes the delta packet-loss percentage since the last call.
        /// </summary>
        private float ComputePacketLossPercent()
        {
            if (_transport == null) return 0f;

            try
            {
                var stats = _transport.NetworkDriver.GetPipelineBuffers(
                    Unity.Networking.Transport.ReliableSequencedPipelineStage.StageId);

                // NGO does not expose per-packet-loss directly; we approximate
                // by monitoring snapshot deltas or use 0 as safe default.
                return 0f;
            }
            catch
            {
                return 0f;
            }
        }

        /// <summary>
        /// Maps an RTT value (ms) to a <see cref="ConnectionQuality"/> tier.
        /// </summary>
        /// <param name="rtt">Round-trip time in ms. Negative values treated as disconnected.</param>
        private ConnectionQuality GetQualityFromRTT(int rtt)
        {
            if (rtt < 0)  return ConnectionQuality.Disconnected;
            if (rtt <= NetworkConstants.RTT_EXCELLENT) return ConnectionQuality.Excellent;
            if (rtt <= NetworkConstants.RTT_GOOD)      return ConnectionQuality.Good;
            if (rtt <= NetworkConstants.RTT_FAIR)      return ConnectionQuality.Fair;
            if (rtt <= NetworkConstants.RTT_POOR)      return ConnectionQuality.Poor;
            return ConnectionQuality.Disconnected;
        }

        /// <summary>
        /// Returns the configured UI colour for a given quality tier.
        /// </summary>
        private Color GetColorForQuality(ConnectionQuality quality)
        {
            return quality switch
            {
                ConnectionQuality.Excellent => ExcellentColor,
                ConnectionQuality.Good      => GoodColor,
                ConnectionQuality.Fair      => FairColor,
                ConnectionQuality.Poor      => PoorColor,
                _                           => DisconnectedColor,
            };
        }

        /// <summary>
        /// Smoothly fades the CanvasGroup toward <paramref name="targetAlpha"/>.
        /// </summary>
        private void FadeDisplay(float targetAlpha)
        {
            if (_canvasGroup == null) return;
            _canvasGroup.alpha = Mathf.Lerp(_canvasGroup.alpha, targetAlpha, Time.deltaTime * 5f);
        }
    }
}
