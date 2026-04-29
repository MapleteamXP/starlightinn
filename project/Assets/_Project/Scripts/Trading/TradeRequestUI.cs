using System;
using System.Collections;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace KawaiiCoolIsland.Trading
{
    /// <summary>
    /// Trade request popup UI that displays when another player sends a trade request.
    /// Includes automatic timeout handling and visual countdown.
    /// </summary>
    public class TradeRequestUI : MonoBehaviour
    {
        #region Serialized Fields

        [Header("Request")]
        [SerializeField] private GameObject _requestPanel;
        [SerializeField] private TMP_Text _requesterNameText;
        [SerializeField] private Image _requesterAvatar;
        [SerializeField] private Button _acceptButton;
        [SerializeField] private Button _declineButton;
        [SerializeField] private Slider _timeoutSlider;
        [SerializeField] private TMP_Text _timeoutText;

        #endregion

        #region Private Fields

        private string _pendingRequestId;
        private string _pendingRequesterId;
        private Coroutine _timeoutCoroutine;
        private float _requestTimeoutDuration = 30f;
        private bool _isShowing;

        #endregion

        #region Events

        /// <summary>
        /// Fired when the local player accepts a trade request.
        /// </summary>
        public event Action<string> OnRequestAccepted;

        /// <summary>
        /// Fired when the local player declines a trade request.
        /// </summary>
        public event Action<string> OnRequestDeclined;

        /// <summary>
        /// Fired when the request popup is hidden for any reason.
        /// </summary>
        public event Action OnRequestHidden;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            if (_acceptButton != null)
                _acceptButton.onClick.AddListener(OnAccept);
            if (_declineButton != null)
                _declineButton.onClick.AddListener(OnDecline);

            if (_requestPanel != null)
                _requestPanel.SetActive(false);
        }

        private void OnDestroy()
        {
            if (_acceptButton != null)
                _acceptButton.onClick.RemoveListener(OnAccept);
            if (_declineButton != null)
                _declineButton.onClick.RemoveListener(OnDecline);

            StopTimeoutCoroutine();
        }

        #endregion

        #region Public API

        /// <summary>
        /// Displays the trade request popup for an incoming request.
        /// </summary>
        /// <param name="fromPlayerId">Unique identifier of the requesting player.</param>
        /// <param name="fromPlayerName">Display name of the requesting player.</param>
        public void ShowRequest(string fromPlayerId, string fromPlayerName)
        {
            _pendingRequestId = Guid.NewGuid().ToString(); // Will be replaced by actual request ID from network
            _pendingRequesterId = fromPlayerId;
            _isShowing = true;

            if (_requestPanel != null)
                _requestPanel.SetActive(true);

            if (_requesterNameText != null)
                _requesterNameText.text = $"{fromPlayerName}\nwants to trade!";

            LoadRequesterAvatar(fromPlayerId);
            ResetTimeoutSlider();

            _timeoutCoroutine = StartCoroutine(TimeoutCoroutine(_requestTimeoutDuration));

            // Subscribe to the actual request arrival
            EventBus.Subscribe<TradeRequestReceivedEvent>(OnTradeRequestReceived);

            Debug.Log($"[TradeRequestUI] Showing request from {fromPlayerName}");
        }

        /// <summary>
        /// Hides the trade request popup and stops the timeout coroutine.
        /// </summary>
        public void HideRequest()
        {
            _isShowing = false;
            StopTimeoutCoroutine();

            if (_requestPanel != null)
                _requestPanel.SetActive(false);

            EventBus.Unsubscribe<TradeRequestReceivedEvent>(OnTradeRequestReceived);
            OnRequestHidden?.Invoke();
        }

        /// <summary>
        /// Called when the player clicks the Accept button.
        /// Validates the request and initiates the trade session.
        /// </summary>
        public void OnAccept()
        {
            if (string.IsNullOrEmpty(_pendingRequestId))
            {
                Debug.LogWarning("[TradeRequestUI] No pending request to accept.");
                HideRequest();
                return;
            }

            if (TradingManager.Instance?.IsInTrade ?? false)
            {
                Debug.LogWarning("[TradeRequestUI] Already in a trade.");
                HideRequest();
                return;
            }

            _acceptButton.interactable = false;
            _declineButton.interactable = false;

            TradingManager.Instance?.AcceptTradeRequest(_pendingRequestId);
            OnRequestAccepted?.Invoke(_pendingRequestId);
            HideRequest();
        }

        /// <summary>
        /// Called when the player clicks the Decline button.
        /// Notifies the server and dismisses the popup.
        /// </summary>
        public void OnDecline()
        {
            if (!string.IsNullOrEmpty(_pendingRequestId))
            {
                TradingManager.Instance?.DeclineTradeRequest(_pendingRequestId);
                OnRequestDeclined?.Invoke(_pendingRequestId);
            }
            HideRequest();
        }

        #endregion

        #region Timeout Handling

        /// <summary>
        /// Coroutine that counts down the request timeout and auto-declines when expired.
        /// </summary>
        /// <param name="duration">Timeout duration in seconds.</param>
        private IEnumerator TimeoutCoroutine(float duration)
        {
            float elapsed = 0f;

            while (elapsed < duration && _isShowing)
            {
                elapsed += Time.deltaTime;
                float remaining = duration - elapsed;
                float progress = remaining / duration;

                if (_timeoutSlider != null)
                    _timeoutSlider.value = progress;

                if (_timeoutText != null)
                    _timeoutText.text = $"{Mathf.Ceil(remaining)}s";

                // Pulse the slider color when time is running low
                if (_timeoutSlider != null && progress < 0.3f)
                {
                    var fill = _timeoutSlider.fillRect?.GetComponent<Image>();
                    if (fill != null)
                        fill.color = Color.Lerp(Color.red, Color.yellow, Mathf.PingPong(Time.time * 2f, 1f));
                }

                yield return null;
            }

            // Auto-decline on timeout
            if (_isShowing)
            {
                Debug.Log("[TradeRequestUI] Request timed out. Auto-declining.");
                if (!string.IsNullOrEmpty(_pendingRequestId))
                    TradingManager.Instance?.DeclineTradeRequest(_pendingRequestId);
                HideRequest();
            }
        }

        private void StopTimeoutCoroutine()
        {
            if (_timeoutCoroutine != null)
            {
                StopCoroutine(_timeoutCoroutine);
                _timeoutCoroutine = null;
            }
        }

        private void ResetTimeoutSlider()
        {
            if (_timeoutSlider != null)
            {
                _timeoutSlider.value = 1f;
                var fill = _timeoutSlider.fillRect?.GetComponent<Image>();
                if (fill != null)
                    fill.color = Color.green;
            }
            if (_timeoutText != null)
                _timeoutText.text = $"{_requestTimeoutDuration:F0}s";
        }

        #endregion

        #region Avatar Loading

        private async void LoadRequesterAvatar(string playerId)
        {
            if (_requesterAvatar == null || GameAPIClient.Instance == null) return;
            try
            {
                var sprite = await GameAPIClient.Instance.GetPlayerAvatarAsync(playerId);
                if (_requesterAvatar != null && sprite != null)
                    _requesterAvatar.sprite = sprite;
            }
            catch
            {
                // Keep placeholder
            }
        }

        #endregion

        #region EventBus Handler

        private void OnTradeRequestReceived(TradeRequestReceivedEvent evt)
        {
            // Store the real request ID from the server
            _pendingRequestId = evt.RequestId;
            _pendingRequesterId = evt.FromPlayerId;
        }

        #endregion
    }
}
