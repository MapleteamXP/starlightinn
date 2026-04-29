using System;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace KawaiiCoolIsland.Interaction
{
    /// <summary>
    /// UI panel handling the complete friend-request flow:
    /// searching for players, sending requests, and accepting / declining / canceling pending requests.
    /// </summary>
    public class FriendRequestUI : UIPanel
    {
        #region Inspector — Send Request

        [Header("Send Request")]
        [Tooltip("Input field for typing a player's display name or ID to search.")]
        public TMP_InputField SearchInput;

        [Tooltip("Container for search result entries.")]
        public Transform SearchResultsContainer;

        [Tooltip("Prefab for a single search result row.")]
        public GameObject SearchResultPrefab;

        [Tooltip("Button to confirm sending the friend request.")]
        public Button SendRequestButton;

        #endregion

        #region Inspector — Received Requests

        [Header("Received Requests")]
        [Tooltip("Container for incoming friend request items.")]
        public Transform RequestsContainer;

        [Tooltip("Prefab for a single incoming request row.")]
        public GameObject RequestItemPrefab;

        [Tooltip("Text showing the count of pending received requests.")]
        public TMP_Text RequestCountText;

        #endregion

        #region Inspector — Sent Requests

        [Header("Sent Requests")]
        [Tooltip("Container for outgoing friend request items.")]
        public Transform SentRequestsContainer;

        [Tooltip("Prefab for a single outgoing request row.")]
        public GameObject SentRequestPrefab;

        #endregion

        #region Private State

        private readonly List<GameObject> _spawnedSearchResults = new();
        private readonly List<GameObject> _spawnedReceivedItems = new();
        private readonly List<GameObject> _spawnedSentItems = new();

        private string _selectedSearchPlayerId;
        private string _selectedSearchPlayerName;
        private bool _isSearching;
        private float _searchDebounceTimer;
        private const float SEARCH_DEBOUNCE = 0.4f;

        #endregion

        #region Unity Lifecycle

        protected override void Awake()
        {
            base.Awake();
            RegisterListeners();
        }

        private void OnEnable()
        {
            EventBus.Subscribe<string>(EventBus.EventType.FriendRequestAccepted, OnRequestAccepted);
            EventBus.Subscribe<string>(EventBus.EventType.FriendRequestDeclined, OnRequestDeclined);
            EventBus.Subscribe<string>(EventBus.EventType.FriendRequestCancelled, OnRequestCancelled);
            EventBus.Subscribe<List<PlayerSearchResult>>(EventBus.EventType.PlayerSearchResults, OnSearchResultsReceived);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<string>(EventBus.EventType.FriendRequestAccepted, OnRequestAccepted);
            EventBus.Unsubscribe<string>(EventBus.EventType.FriendRequestDeclined, OnRequestDeclined);
            EventBus.Unsubscribe<string>(EventBus.EventType.FriendRequestCancelled, OnRequestCancelled);
            EventBus.Unsubscribe<List<PlayerSearchResult>>(EventBus.EventType.PlayerSearchResults, OnSearchResultsReceived);
        }

        private void Update()
        {
            // Debounced search
            if (_isSearching && _searchDebounceTimer > 0f)
            {
                _searchDebounceTimer -= Time.deltaTime;
                if (_searchDebounceTimer <= 0f)
                {
                    SearchPlayers(SearchInput.text.Trim());
                }
            }
        }

        #endregion

        #region Registration

        /// <summary>
        /// Registers UI event listeners on buttons and input fields.
        /// </summary>
        private void RegisterListeners()
        {
            if (SearchInput != null)
            {
                SearchInput.onValueChanged.AddListener(OnSearchTextChanged);
                SearchInput.onEndEdit.AddListener(text =>
                {
                    if (!string.IsNullOrEmpty(text))
                        SearchPlayers(text.Trim());
                });
            }

            if (SendRequestButton != null)
            {
                SendRequestButton.onClick.AddListener(OnSendRequestClicked);
                SendRequestButton.interactable = false;
            }
        }

        #endregion

        #region Public API — View Switching

        /// <summary>
        /// Shows the "Send Request" search panel.
        /// </summary>
        public void ShowSendRequest()
        {
            ShowPanel();
            ClearSearchResults();
            ClearSentRequests();

            if (SearchInput != null)
            {
                SearchInput.text = "";
                SearchInput.ActivateInputField();
            }

            if (SendRequestButton != null)
                SendRequestButton.interactable = false;
        }

        /// <summary>
        /// Shows the "Received Requests" inbox panel.
        /// </summary>
        public void ShowReceivedRequests()
        {
            ShowPanel();
            ClearSearchResults();
            ClearSentRequests();
            RefreshRequests();
        }

        /// <summary>
        /// Shows the "Sent Requests" tracking panel.
        /// </summary>
        public void ShowSentRequests()
        {
            ShowPanel();
            ClearSearchResults();
            ClearReceivedRequests();
            RefreshRequests();
        }

        /// <summary>
        /// Reloads and re-populates all pending request lists.
        /// </summary>
        public void RefreshRequests()
        {
            // Request fresh data from SocialGraphManager
            EventBus.Publish(EventBus.EventType.RequestPendingFriendRequests, string.Empty);
        }

        #endregion

        #region Search

        /// <summary>
        /// Called when the search input text changes. Debounces the actual search call.
        /// </summary>
        private void OnSearchTextChanged(string text)
        {
            _selectedSearchPlayerId = null;
            _selectedSearchPlayerName = null;

            if (SendRequestButton != null)
                SendRequestButton.interactable = false;

            if (string.IsNullOrWhiteSpace(text))
            {
                ClearSearchResults();
                _isSearching = false;
                return;
            }

            _isSearching = true;
            _searchDebounceTimer = SEARCH_DEBOUNCE;
        }

        /// <summary>
        /// Performs a player search using the provided query string.
        /// </summary>
        private void SearchPlayers(string query)
        {
            if (string.IsNullOrWhiteSpace(query)) return;
            _isSearching = false;

            EventBus.Publish(EventBus.EventType.SearchPlayers, query);

            // Optional direct fallback:
            // SocialGraphManager.Instance?.SearchPlayers(query);
        }

        /// <summary>
        /// Callback when player search results are returned.
        /// </summary>
        private void OnSearchResultsReceived(List<PlayerSearchResult> results)
        {
            ClearSearchResults();

            if (results == null || results.Count == 0)
            {
                ShowSearchEmptyState();
                return;
            }

            foreach (var result in results)
            {
                GameObject row = Instantiate(SearchResultPrefab, SearchResultsContainer);
                _spawnedSearchResults.Add(row);
                ConfigureSearchResultRow(row, result);
            }
        }

        /// <summary>
        /// Configures a single search result row with name, avatar, and click selection.
        /// </summary>
        private void ConfigureSearchResultRow(GameObject row, PlayerSearchResult result)
        {
            TMP_Text nameText = row.GetComponentInChildren<TMP_Text>();
            Button btn = row.GetComponent<Button>();
            Image avatarImg = row.transform.Find("Avatar")?.GetComponent<Image>();

            if (nameText != null) nameText.text = result.DisplayName;
            if (avatarImg != null) avatarImg.sprite = result.AvatarThumbnail;

            if (btn != null)
            {
                string capturedId = result.PlayerId;
                string capturedName = result.DisplayName;
                btn.onClick.AddListener(() => OnSearchResultSelected(capturedId, capturedName));
            }
        }

        /// <summary>
        /// Called when a search result row is tapped.
        /// </summary>
        private void OnSearchResultSelected(string playerId, string playerName)
        {
            _selectedSearchPlayerId = playerId;
            _selectedSearchPlayerName = playerName;

            if (SendRequestButton != null)
                SendRequestButton.interactable = true;

            // Visual selection feedback
            foreach (var row in _spawnedSearchResults)
            {
                if (row == null) continue;
                Image bg = row.GetComponent<Image>();
                if (bg != null) bg.color = Color.white;
            }
        }

        /// <summary>
        /// Displays an empty-state message when no search results are found.
        /// </summary>
        private void ShowSearchEmptyState()
        {
            // Could instantiate an empty-state prefab here
        }

        #endregion

        #region Send Request

        /// <summary>
        /// Called when the Send Request button is clicked.
        /// </summary>
        private void OnSendRequestClicked()
        {
            if (string.IsNullOrEmpty(_selectedSearchPlayerId)) return;

            EventBus.Publish(EventBus.EventType.SendFriendRequest, _selectedSearchPlayerId);

            // Visual feedback
            if (SendRequestButton != null)
            {
                TMP_Text btnText = SendRequestButton.GetComponentInChildren<TMP_Text>();
                if (btnText != null) btnText.text = "Sent!";
                SendRequestButton.interactable = false;
            }

            // Add to sent list immediately for optimistic UI
            AddSentRequestItem(_selectedSearchPlayerId, _selectedSearchPlayerName);
        }

        #endregion

        #region Received Request Handling

        /// <summary>
        /// Populates the received requests container with pending incoming requests.
        /// </summary>
        private void PopulateReceivedRequests(List<FriendRequestData> requests)
        {
            ClearReceivedRequests();

            if (requests == null || requests.Count == 0)
            {
                UpdateRequestCount(0);
                return;
            }

            UpdateRequestCount(requests.Count);

            foreach (var req in requests)
            {
                GameObject item = Instantiate(RequestItemPrefab, RequestsContainer);
                _spawnedReceivedItems.Add(item);
                ConfigureReceivedRequestItem(item, req);
            }
        }

        /// <summary>
        /// Configures a single incoming request row with accept / decline buttons.
        /// </summary>
        private void ConfigureReceivedRequestItem(GameObject item, FriendRequestData request)
        {
            TMP_Text nameText = item.transform.Find("NameText")?.GetComponent<TMP_Text>();
            TMP_Text dateText = item.transform.Find("DateText")?.GetComponent<TMP_Text>();
            Button acceptBtn = item.transform.Find("AcceptButton")?.GetComponent<Button>();
            Button declineBtn = item.transform.Find("DeclineButton")?.GetComponent<Button>();

            if (nameText != null) nameText.text = request.SenderName;
            if (dateText != null) dateText.text = request.SentDate;

            if (acceptBtn != null)
            {
                string capturedId = request.RequestId;
                acceptBtn.onClick.AddListener(() => OnAcceptRequest(capturedId));
            }

            if (declineBtn != null)
            {
                string capturedId = request.RequestId;
                declineBtn.onClick.AddListener(() => OnDeclineRequest(capturedId));
            }
        }

        /// <summary>
        /// Accepts a pending friend request.
        /// </summary>
        private void OnAcceptRequest(string requestId)
        {
            if (string.IsNullOrEmpty(requestId)) return;
            EventBus.Publish(EventBus.EventType.AcceptFriendRequest, requestId);
        }

        /// <summary>
        /// Declines a pending friend request.
        /// </summary>
        private void OnDeclineRequest(string requestId)
        {
            if (string.IsNullOrEmpty(requestId)) return;
            EventBus.Publish(EventBus.EventType.DeclineFriendRequest, requestId);
        }

        /// <summary>
        /// Callback when a friend request is accepted.
        /// </summary>
        private void OnRequestAccepted(string requestId)
        {
            RefreshRequests();
        }

        /// <summary>
        /// Callback when a friend request is declined.
        /// </summary>
        private void OnRequestDeclined(string requestId)
        {
            RefreshRequests();
        }

        #endregion

        #region Sent Request Handling

        /// <summary>
        /// Populates the sent requests container with pending outgoing requests.
        /// </summary>
        private void PopulateSentRequests(List<FriendRequestData> requests)
        {
            ClearSentRequests();

            if (requests == null || requests.Count == 0) return;

            foreach (var req in requests)
            {
                AddSentRequestItem(req.ReceiverId, req.ReceiverName);
            }
        }

        /// <summary>
        /// Adds a single sent-request row to the UI.
        /// </summary>
        private void AddSentRequestItem(string playerId, string playerName)
        {
            if (SentRequestsContainer == null || SentRequestPrefab == null) return;

            GameObject item = Instantiate(SentRequestPrefab, SentRequestsContainer);
            _spawnedSentItems.Add(item);

            TMP_Text nameText = item.GetComponentInChildren<TMP_Text>();
            Button cancelBtn = item.transform.Find("CancelButton")?.GetComponent<Button>();

            if (nameText != null) nameText.text = playerName;
            if (cancelBtn != null)
            {
                string capturedId = playerId;
                cancelBtn.onClick.AddListener(() => OnCancelRequest(capturedId));
            }
        }

        /// <summary>
        /// Cancels an outgoing friend request.
        /// </summary>
        private void OnCancelRequest(string requestId)
        {
            if (string.IsNullOrEmpty(requestId)) return;
            EventBus.Publish(EventBus.EventType.CancelFriendRequest, requestId);
        }

        /// <summary>
        /// Callback when a sent friend request is cancelled.
        /// </summary>
        private void OnRequestCancelled(string requestId)
        {
            RefreshRequests();
        }

        #endregion

        #region Cleanup

        /// <summary>
        /// Destroys all search result rows.
        /// </summary>
        private void ClearSearchResults()
        {
            foreach (var go in _spawnedSearchResults)
            {
                if (go != null) Destroy(go);
            }
            _spawnedSearchResults.Clear();
            _selectedSearchPlayerId = null;
            _selectedSearchPlayerName = null;
        }

        /// <summary>
        /// Destroys all received request rows.
        /// </summary>
        private void ClearReceivedRequests()
        {
            foreach (var go in _spawnedReceivedItems)
            {
                if (go != null) Destroy(go);
            }
            _spawnedReceivedItems.Clear();
            UpdateRequestCount(0);
        }

        /// <summary>
        /// Destroys all sent request rows.
        /// </summary>
        private void ClearSentRequests()
        {
            foreach (var go in _spawnedSentItems)
            {
                if (go != null) Destroy(go);
            }
            _spawnedSentItems.Clear();
        }

        /// <summary>
        /// Updates the received request count badge text.
        /// </summary>
        private void UpdateRequestCount(int count)
        {
            if (RequestCountText != null)
            {
                RequestCountText.text = count > 0 ? $"({count})" : "";
                RequestCountText.gameObject.SetActive(count > 0);
            }
        }

        #endregion
    }

    #region Data Transfer Objects

    /// <summary>
    /// Result entry returned from a player search query.
    /// </summary>
    [System.Serializable]
    public class PlayerSearchResult
    {
        public string PlayerId;
        public string DisplayName;
        public Sprite AvatarThumbnail;
        public bool IsOnline;
    }

    /// <summary>
    /// Data for a single friend request (incoming or outgoing).
    /// </summary>
    [System.Serializable]
    public class FriendRequestData
    {
        public string RequestId;
        public string SenderId;
        public string SenderName;
        public string ReceiverId;
        public string ReceiverName;
        public string SentDate;
    }

    #endregion
}
