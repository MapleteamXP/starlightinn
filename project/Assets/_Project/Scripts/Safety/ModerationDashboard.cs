using System;
using System.Collections.Generic;
using System.Linq;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace KawaiiCool.Safety
{
    /// <summary>
    /// Represents a single moderation action (warn, mute, kick, ban) taken against a player.
    /// </summary>
    [Serializable]
    public class ModerationActionRecord
    {
        public string ActionId;
        public string ActionType; // "warn", "mute", "kick", "ban", "unban"
        public string PlayerId;
        public string PlayerName;
        public string ModeratorId;
        public string ModeratorName;
        public string Reason;
        public float DurationSeconds; // 0 for permanent or instant actions
        public long Timestamp;
        public bool IsReverted;
        public string RevertReason;
    }

    /// <summary>
    /// Represents a player report submitted by another user.
    /// </summary>
    [Serializable]
    public class PlayerReport
    {
        public string ReportId;
        public string ReporterId;
        public string ReporterName;
        public string TargetId;
        public string TargetName;
        public string Reason;
        public string Details;
        public long Timestamp;
        public string Status; // "pending", "resolved", "escalated", "dismissed"
        public string AssignedModeratorId;
        public string Evidence; // chat log snippet, screenshot reference, etc.
    }

    /// <summary>
    /// Represents a searchable player result in the moderation dashboard.
    /// </summary>
    [Serializable]
    public class ModerationPlayerInfo
    {
        public string PlayerId;
        public string PlayerName;
        public string Status; // "online", "offline", "muted", "banned"
        public long JoinDate;
        public int ReportCount;
        public int MuteCount;
        public int BanCount;
        public string CurrentRoom;
    }

    /// <summary>
    /// Unity UI panel for room owners and global moderators to inspect players,
    /// review reports, and apply moderation actions. Inherits from <see cref="UIPanel" />.
    /// </summary>
    public class ModerationDashboard : UIPanel
    {
        #region Inspector — Player Search

        [Header("Player Search")]
        [Tooltip("Input field for searching players by name or ID.")]
        public TMP_InputField PlayerSearchInput;

        [Tooltip("Button that triggers the search.")]
        public Button SearchButton;

        [Tooltip("Parent transform for search result entries.")]
        public Transform SearchResults;

        [Tooltip("Prefab instantiated for each search result row.")]
        public GameObject PlayerResultPrefab;

        #endregion

        #region Inspector — Actions

        [Header("Actions")]
        [Tooltip("Button to issue a warning to the selected player.")]
        public Button WarnButton;

        [Tooltip("Button to mute the selected player.")]
        public Button MuteButton;

        [Tooltip("Button to kick the selected player from the current room.")]
        public Button KickButton;

        [Tooltip("Button to ban the selected player.")]
        public Button BanButton;

        [Tooltip("Button to unban the selected player.")]
        public Button UnbanButton;

        [Tooltip("Button to view the moderation history of the selected player.")]
        public Button ViewHistoryButton;

        #endregion

        #region Inspector — Player Details

        [Header("Details")]
        [Tooltip("Panel that displays detailed information for the selected player.")]
        public GameObject PlayerDetailsPanel;

        [Tooltip("Text field displaying the selected player's display name.")]
        public TMP_Text PlayerNameText;

        [Tooltip("Text field displaying the selected player's unique identifier.")]
        public TMP_Text PlayerIdText;

        [Tooltip("Text field displaying the selected player's current status.")]
        public TMP_Text StatusText;

        [Tooltip("Text field displaying the selected player's account creation date.")]
        public TMP_Text JoinDateText;

        [Tooltip("Text field displaying how many times the player has been reported.")]
        public TMP_Text ReportCountText;

        [Tooltip("Text field displaying how many times the player has been muted.")]
        public TMP_Text MuteCountText;

        [Tooltip("Text field displaying how many times the player has been banned.")]
        public TMP_Text BanCountText;

        [Tooltip("Parent transform for action history entries.")]
        public Transform ActionHistoryList;

        [Tooltip("Prefab instantiated for each action history row.")]
        public GameObject ActionHistoryItemPrefab;

        #endregion

        #region Inspector — Reports

        [Header("Reports")]
        [Tooltip("Tab button that switches to the reports view.")]
        public Button ReportsTabButton;

        [Tooltip("Panel that displays pending and resolved reports.")]
        public GameObject ReportsPanel;

        [Tooltip("Parent transform for report list entries.")]
        public Transform ReportsList;

        [Tooltip("Prefab instantiated for each report row.")]
        public GameObject ReportItemPrefab;

        [Tooltip("Text field showing how many reports are awaiting review.")]
        public TMP_Text PendingReportsText;

        #endregion

        #region Inspector — Bulk Actions

        [Header("Bulk Actions")]
        [Tooltip("Button to select all players in the current search results.")]
        public Button SelectAllButton;

        [Tooltip("Button to mute all selected players simultaneously.")]
        public Button BulkMuteButton;

        [Tooltip("Button to kick all selected players from the room simultaneously.")]
        public Button BulkKickButton;

        #endregion

        #region Internal State

        /// <summary>
        /// The player currently selected for inspection or moderation.
        /// </summary>
        private string _selectedPlayerId;

        /// <summary>
        /// Cached search results from the most recent query.
        /// </summary>
        private List<ModerationPlayerInfo> _currentSearchResults = new List<ModerationPlayerInfo>();

        /// <summary>
        /// Set of player IDs selected for bulk operations.
        /// </summary>
        private HashSet<string> _selectedPlayerIds = new HashSet<string>();

        /// <summary>
        /// Cached pending reports.
        /// </summary>
        private List<PlayerReport> _pendingReports = new List<PlayerReport>();

        /// <summary>
        /// Cached action history for the selected player.
        /// </summary>
        private List<ModerationActionRecord> _actionHistory = new List<ModerationActionRecord>();

        /// <summary>
        /// Whether the local user has global moderation privileges.
        /// </summary>
        private bool _isGlobalModerator;

        /// <summary>
        /// Whether the local user is the owner of the current room.
        /// </summary>
        private bool _isRoomOwner;

        #endregion

        #region UIPanel Lifecycle

        /// <summary>
        /// Called when the panel is shown. Refreshes all sub-views.
        /// </summary>
        public override void OnPanelShow()
        {
            base.OnPanelShow();

            _isGlobalModerator = CheckGlobalModeratorPrivileges();
            _isRoomOwner = CheckRoomOwnerPrivileges();

            RefreshPlayerList();
            PopulateReports();
            UpdateActionButtonStates();

            if (PlayerDetailsPanel != null)
                PlayerDetailsPanel.SetActive(false);

            if (ReportsPanel != null)
                ReportsPanel.SetActive(false);

            // Wire UI events (idempotent — safe to call multiple times)
            if (SearchButton != null)
                SearchButton.onClick.AddListener(OnSearchClicked);
            if (WarnButton != null)
                WarnButton.onClick.AddListener(OnWarnClicked);
            if (MuteButton != null)
                MuteButton.onClick.AddListener(OnMuteClicked);
            if (KickButton != null)
                KickButton.onClick.AddListener(OnKickClicked);
            if (BanButton != null)
                BanButton.onClick.AddListener(OnBanClicked);
            if (UnbanButton != null)
                UnbanButton.onClick.AddListener(OnUnbanClicked);
            if (ViewHistoryButton != null)
                ViewHistoryButton.onClick.AddListener(OnViewHistoryClicked);
            if (ReportsTabButton != null)
                ReportsTabButton.onClick.AddListener(OnReportsTabClicked);
            if (SelectAllButton != null)
                SelectAllButton.onClick.AddListener(OnSelectAllClicked);
            if (BulkMuteButton != null)
                BulkMuteButton.onClick.AddListener(OnBulkMuteClicked);
            if (BulkKickButton != null)
                BulkKickButton.onClick.AddListener(OnBulkKickClicked);
        }

        public override void OnPanelHide()
        {
            base.OnPanelHide();

            // Remove listeners to prevent leaks on panel reuse
            if (SearchButton != null)
                SearchButton.onClick.RemoveListener(OnSearchClicked);
            if (WarnButton != null)
                WarnButton.onClick.RemoveListener(OnWarnClicked);
            if (MuteButton != null)
                MuteButton.onClick.RemoveListener(OnMuteClicked);
            if (KickButton != null)
                KickButton.onClick.RemoveListener(OnKickClicked);
            if (BanButton != null)
                BanButton.onClick.RemoveListener(OnBanClicked);
            if (UnbanButton != null)
                UnbanButton.onClick.RemoveListener(OnUnbanClicked);
            if (ViewHistoryButton != null)
                ViewHistoryButton.onClick.RemoveListener(OnViewHistoryClicked);
            if (ReportsTabButton != null)
                ReportsTabButton.onClick.RemoveListener(OnReportsTabClicked);
            if (SelectAllButton != null)
                SelectAllButton.onClick.RemoveListener(OnSelectAllClicked);
            if (BulkMuteButton != null)
                BulkMuteButton.onClick.RemoveListener(OnBulkMuteClicked);
            if (BulkKickButton != null)
                BulkKickButton.onClick.RemoveListener(OnBulkKickClicked);
        }

        #endregion

        #region Public API — Search & Selection

        /// <summary>
        /// Executes a player search by name or ID and populates the results list.
        /// </summary>
        /// <param name="query">The search string (name fragment or exact ID).</param>
        public void SearchPlayer(string query)
        {
            if (string.IsNullOrWhiteSpace(query))
            {
                ClearSearchResults();
                return;
            }

            // In production: query backend moderation API
            _currentSearchResults = PerformMockSearch(query);
            PopulateSearchResults();
        }

        /// <summary>
        /// Selects a player and reveals the details panel.
        /// </summary>
        /// <param name="playerId">The unique player identifier.</param>
        public void SelectPlayer(string playerId)
        {
            _selectedPlayerId = playerId;
            PopulatePlayerDetails();
            PopulateActionHistory();
            UpdateActionButtonStates();

            if (PlayerDetailsPanel != null)
                PlayerDetailsPanel.SetActive(true);
        }

        #endregion

        #region Public API — Moderation Actions

        /// <summary>
        /// Issues a warning to the selected player. Room owners may warn players in their room;
        /// global moderators may warn anyone.
        /// </summary>
        public void OnWarnClicked()
        {
            if (!CanModerate(_selectedPlayerId)) return;
            ApplyModerationAction("warn", _selectedPlayerId, 0f, "Warning issued by moderator.");
        }

        /// <summary>
        /// Mutes the selected player for a configurable duration.
        /// </summary>
        public void OnMuteClicked()
        {
            if (!CanModerate(_selectedPlayerId)) return;
            ApplyModerationAction("mute", _selectedPlayerId, 300f, "Muted by moderator.");
        }

        /// <summary>
        /// Kicks the selected player from the current room.
        /// </summary>
        public void OnKickClicked()
        {
            if (!CanModerate(_selectedPlayerId)) return;
            ApplyModerationAction("kick", _selectedPlayerId, 0f, "Kicked from room by moderator.");
        }

        /// <summary>
        /// Bans the selected player. Only global moderators or room owners may ban.
        /// </summary>
        public void OnBanClicked()
        {
            if (!CanModerate(_selectedPlayerId)) return;
            ApplyModerationAction("ban", _selectedPlayerId, 0f, "Banned by moderator.");
        }

        /// <summary>
        /// Unbans the selected player.
        /// </summary>
        public void OnUnbanClicked()
        {
            if (!CanModerate(_selectedPlayerId)) return;
            ApplyModerationAction("unban", _selectedPlayerId, 0f, "Ban removed by moderator.");
        }

        /// <summary>
        /// Marks a report as resolved after moderator review.
        /// </summary>
        /// <param name="reportId">The unique report identifier.</param>
        public void OnReportResolved(string reportId)
        {
            if (string.IsNullOrEmpty(reportId)) return;

            var report = _pendingReports.FirstOrDefault(r => r.ReportId == reportId);
            if (report != null)
            {
                report.Status = "resolved";
                report.AssignedModeratorId = GameManager.Instance.CurrentUserId;
            }

            PopulateReports();
            EventBus.Publish(new ReportResolvedEvent(reportId, GameManager.Instance.CurrentUserId));
        }

        /// <summary>
        /// Escalates a report to senior moderation staff for further review.
        /// </summary>
        /// <param name="reportId">The unique report identifier.</param>
        public void OnReportEscalated(string reportId)
        {
            if (string.IsNullOrEmpty(reportId)) return;

            var report = _pendingReports.FirstOrDefault(r => r.ReportId == reportId);
            if (report != null)
            {
                report.Status = "escalated";
                report.AssignedModeratorId = GameManager.Instance.CurrentUserId;
            }

            PopulateReports();
            EventBus.Publish(new ReportEscalatedEvent(reportId, GameManager.Instance.CurrentUserId));
        }

        #endregion

        #region Private UI Helpers

        private void OnSearchClicked()
        {
            if (PlayerSearchInput != null)
                SearchPlayer(PlayerSearchInput.text);
        }

        private void OnViewHistoryClicked()
        {
            PopulateActionHistory();
        }

        private void OnReportsTabClicked()
        {
            if (ReportsPanel != null)
                ReportsPanel.SetActive(!ReportsPanel.activeSelf);
        }

        private void OnSelectAllClicked()
        {
            if (_selectedPlayerIds.Count == _currentSearchResults.Count)
                _selectedPlayerIds.Clear();
            else
                _selectedPlayerIds = new HashSet<string>(_currentSearchResults.Select(p => p.PlayerId));

            PopulateSearchResults();
        }

        private void OnBulkMuteClicked()
        {
            foreach (var playerId in _selectedPlayerIds)
            {
                ApplyModerationAction("mute", playerId, 300f, "Bulk mute by moderator.");
            }
            _selectedPlayerIds.Clear();
            PopulateSearchResults();
        }

        private void OnBulkKickClicked()
        {
            foreach (var playerId in _selectedPlayerIds)
            {
                ApplyModerationAction("kick", playerId, 0f, "Bulk kick by moderator.");
            }
            _selectedPlayerIds.Clear();
            PopulateSearchResults();
        }

        #endregion

        #region Private Population Methods

        /// <summary>
        /// Clears and repopulates the search results scroll view.
        /// </summary>
        private void PopulateSearchResults()
        {
            if (SearchResults == null || PlayerResultPrefab == null) return;

            foreach (Transform child in SearchResults)
                Destroy(child.gameObject);

            foreach (var player in _currentSearchResults)
            {
                var go = Instantiate(PlayerResultPrefab, SearchResults);
                // In production: bind player data to the prefab's UI components via a small view component
                var nameText = go.GetComponentInChildren<TMP_Text>();
                if (nameText != null)
                    nameText.text = $"{player.PlayerName} ({player.Status})";

                bool isSelected = _selectedPlayerIds.Contains(player.PlayerId);
                // TODO: toggle selection visuals

                var btn = go.GetComponent<Button>();
                if (btn == null) btn = go.GetComponentInChildren<Button>();
                if (btn != null)
                {
                    string capturedId = player.PlayerId; // closure capture
                    btn.onClick.AddListener(() => SelectPlayer(capturedId));
                }
            }
        }

        /// <summary>
        /// Populates the player details panel with the selected player's metadata.
        /// </summary>
        private void PopulatePlayerDetails()
        {
            var player = _currentSearchResults.FirstOrDefault(p => p.PlayerId == _selectedPlayerId);
            if (player == null) return;

            if (PlayerNameText != null)
                PlayerNameText.text = player.PlayerName;
            if (PlayerIdText != null)
                PlayerIdText.text = $"ID: {player.PlayerId}";
            if (StatusText != null)
                StatusText.text = $"Status: {player.Status}";
            if (JoinDateText != null)
                JoinDateText.text = $"Joined: {DateTimeOffset.FromUnixTimeSeconds(player.JoinDate).ToLocalTime():yyyy-MM-dd}";
            if (ReportCountText != null)
                ReportCountText.text = $"Reports: {player.ReportCount}";
            if (MuteCountText != null)
                MuteCountText.text = $"Mutes: {player.MuteCount}";
            if (BanCountText != null)
                BanCountText.text = $"Bans: {player.BanCount}";
        }

        /// <summary>
        /// Populates the action history scroll view for the selected player.
        /// </summary>
        private void PopulateActionHistory()
        {
            if (ActionHistoryList == null || ActionHistoryItemPrefab == null) return;

            foreach (Transform child in ActionHistoryList)
                Destroy(child.gameObject);

            // In production: fetch from server moderation API
            var history = _actionHistory.Where(a => a.PlayerId == _selectedPlayerId)
                                       .OrderByDescending(a => a.Timestamp)
                                       .ToList();

            foreach (var action in history)
            {
                var go = Instantiate(ActionHistoryItemPrefab, ActionHistoryList);
                var text = go.GetComponentInChildren<TMP_Text>();
                if (text != null)
                {
                    var date = DateTimeOffset.FromUnixTimeSeconds(action.Timestamp).ToLocalTime();
                    text.text = $"[{date:yyyy-MM-dd HH:mm}] {action.ActionType.ToUpper()} by {action.ModeratorName}: {action.Reason}";
                }
            }
        }

        /// <summary>
        /// Populates the pending reports list and updates the pending count badge.
        /// </summary>
        private void PopulateReports()
        {
            if (ReportsList == null || ReportItemPrefab == null) return;

            foreach (Transform child in ReportsList)
                Destroy(child.gameObject);

            // In production: fetch from server
            _pendingReports = PerformMockReports();
            int pendingCount = _pendingReports.Count(r => r.Status == "pending");

            if (PendingReportsText != null)
                PendingReportsText.text = $"Pending: {pendingCount}";

            foreach (var report in _pendingReports.OrderByDescending(r => r.Timestamp))
            {
                var go = Instantiate(ReportItemPrefab, ReportsList);
                var text = go.GetComponentInChildren<TMP_Text>();
                if (text != null)
                {
                    text.text = $"[{report.Status.ToUpper()}] {report.TargetName} reported by {report.ReporterName}: {report.Reason}";
                }

                var resolveBtn = go.transform.Find("ResolveButton")?.GetComponent<Button>();
                if (resolveBtn != null)
                {
                    string capturedId = report.ReportId;
                    resolveBtn.onClick.AddListener(() => OnReportResolved(capturedId));
                }

                var escalateBtn = go.transform.Find("EscalateButton")?.GetComponent<Button>();
                if (escalateBtn != null)
                {
                    string capturedId = report.ReportId;
                    escalateBtn.onClick.AddListener(() => OnReportEscalated(capturedId));
                }
            }
        }

        private void RefreshPlayerList()
        {
            _currentSearchResults.Clear();
            ClearSearchResults();
        }

        private void ClearSearchResults()
        {
            if (SearchResults == null) return;
            foreach (Transform child in SearchResults)
                Destroy(child.gameObject);
        }

        /// <summary>
        /// Enables or disables moderation action buttons based on the current selection and privileges.
        /// </summary>
        private void UpdateActionButtonStates()
        {
            bool hasSelection = !string.IsNullOrEmpty(_selectedPlayerId);
            bool canModerate = hasSelection && CanModerate(_selectedPlayerId);

            if (WarnButton != null) WarnButton.interactable = canModerate;
            if (MuteButton != null) MuteButton.interactable = canModerate;
            if (KickButton != null) KickButton.interactable = canModerate;
            if (BanButton != null) BanButton.interactable = canModerate && (_isGlobalModerator || _isRoomOwner);
            if (UnbanButton != null) UnbanButton.interactable = canModerate && (_isGlobalModerator || _isRoomOwner);
            if (ViewHistoryButton != null) ViewHistoryButton.interactable = hasSelection;

            bool hasBulkSelection = _selectedPlayerIds.Count > 0;
            if (BulkMuteButton != null) BulkMuteButton.interactable = hasBulkSelection && (_isGlobalModerator || _isRoomOwner);
            if (BulkKickButton != null) BulkKickButton.interactable = hasBulkSelection && (_isGlobalModerator || _isRoomOwner);
        }

        #endregion

        #region Private Business Logic

        /// <summary>
        /// Checks whether the local user has permission to moderate the target player.
        /// </summary>
        private bool CanModerate(string targetPlayerId)
        {
            if (string.IsNullOrEmpty(targetPlayerId)) return false;
            if (_isGlobalModerator) return true;
            if (_isRoomOwner)
            {
                // Room owners can only moderate players currently in their room
                var player = _currentSearchResults.FirstOrDefault(p => p.PlayerId == targetPlayerId);
                return player != null && player.CurrentRoom == GameManager.Instance.CurrentRoomId;
            }
            return false;
        }

        /// <summary>
        /// Applies a moderation action locally and dispatches it to the server.
        /// </summary>
        private void ApplyModerationAction(string actionType, string targetId, float duration, string reason)
        {
            var record = new ModerationActionRecord
            {
                ActionId = Guid.NewGuid().ToString("N").Substring(0, 16),
                ActionType = actionType,
                PlayerId = targetId,
                PlayerName = _currentSearchResults.FirstOrDefault(p => p.PlayerId == targetId)?.PlayerName ?? "Unknown",
                ModeratorId = GameManager.Instance.CurrentUserId,
                ModeratorName = GameManager.Instance.CurrentUserName,
                Reason = reason,
                DurationSeconds = duration,
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                IsReverted = false
            };

            _actionHistory.Add(record);

            EventBus.Publish(new ModerationActionAppliedEvent(record));

            // Notify ChatManager / SocialGraphManager for enforcement
            if (actionType == "mute")
            {
                ChatManager.Instance.MutePlayer(targetId, duration);
            }
            else if (actionType == "kick")
            {
                ChatManager.Instance.KickPlayer(targetId);
            }
            else if (actionType == "ban")
            {
                ChatManager.Instance.BanPlayer(targetId);
            }
            else if (actionType == "unban")
            {
                ChatManager.Instance.UnbanPlayer(targetId);
            }

            PopulateActionHistory();
            UpdateActionButtonStates();
        }

        private bool CheckGlobalModeratorPrivileges()
        {
            // TODO: check GameManager or session token for global mod role
            return false;
        }

        private bool CheckRoomOwnerPrivileges()
        {
            // TODO: check GameManager for room ownership
            return false;
        }

        #endregion

        #region Mock Data (Production Replacements)

        private List<ModerationPlayerInfo> PerformMockSearch(string query)
        {
            // Production: replace with server moderation search API call
            return new List<ModerationPlayerInfo>();
        }

        private List<PlayerReport> PerformMockReports()
        {
            // Production: replace with server report fetch API call
            return new List<PlayerReport>();
        }

        #endregion

        #region EventBus Payloads

        /// <summary>
        /// Published when a moderation action is applied by a moderator.
        /// </summary>
        public struct ModerationActionAppliedEvent
        {
            public readonly ModerationActionRecord Record;

            public ModerationActionAppliedEvent(ModerationActionRecord record)
            {
                Record = record;
            }
        }

        /// <summary>
        /// Published when a report is marked as resolved.
        /// </summary>
        public struct ReportResolvedEvent
        {
            public readonly string ReportId;
            public readonly string ModeratorId;

            public ReportResolvedEvent(string reportId, string moderatorId)
            {
                ReportId = reportId;
                ModeratorId = moderatorId;
            }
        }

        /// <summary>
        /// Published when a report is escalated to senior staff.
        /// </summary>
        public struct ReportEscalatedEvent
        {
            public readonly string ReportId;
            public readonly string ModeratorId;

            public ReportEscalatedEvent(string reportId, string moderatorId)
            {
                ReportId = reportId;
                ModeratorId = moderatorId;
            }
        }

        #endregion
    }
}
