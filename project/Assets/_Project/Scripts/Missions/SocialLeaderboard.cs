using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace KawaiiCool.Missions
{
    /// <summary>
    /// Social leaderboard categories tailored for a social virtual world experience.
    /// </summary>
    public enum LeaderboardCategory
    {
        MostHelpful,
        MostVisitedRoom,
        MostFriends,
        MostMinigamesWon,
        MostTimePlayed,
        MostItemsCollected,
        BestFashionRating,
        MostTrades
    }

    /// <summary>
    /// Serializable data for a single leaderboard entry.
    /// </summary>
    [System.Serializable]
    public class LeaderboardEntry
    {
        public int Rank;
        public string PlayerId;
        public string PlayerName;
        public Sprite Avatar;
        public int Score;
        public bool IsMe;
        public int ChangeFromLastWeek;
    }

    /// <summary>
    /// UI controller for social leaderboards. Supports multiple categories, time ranges,
    /// player profile navigation, and mock data for offline or preview scenarios.
    /// </summary>
    public class SocialLeaderboard : MonoBehaviour
    {
        [Header("Categories")]
        public List<LeaderboardCategoryConfig> Categories = new();

        [Header("Display")]
        public Transform LeaderboardContainer;
        public GameObject LeaderboardEntryPrefab;
        public TMP_Text CategoryTitleText;
        public Button PrevCategoryButton;
        public Button NextCategoryButton;

        [Header("Time Range")]
        public TMP_Dropdown TimeRangeDropdown;

        [Header("Player Profile Preview")]
        public GameObject PlayerPreviewPanel;
        public Image PreviewAvatar;
        public TMP_Text PreviewNameText;
        public TMP_Text PreviewScoreText;
        public Button PreviewFriendButton;
        public Button PreviewCloseButton;
        public Button PreviewVisitRoomButton;

        [Header("My Rank")]
        public Transform MyRankContainer;
        public GameObject MyRankEntryPrefab;

        [Header("Animation")]
        public Animator EntrySpawnAnimator;
        public float EntrySpawnDelay = 0.05f;

        private int _currentCategoryIndex = 0;
        private LeaderboardTimeRange _currentTimeRange = LeaderboardTimeRange.ThisWeek;
        private readonly List<GameObject> _spawnedEntries = new();
        private readonly List<GameObject> _spawnedMyRank = new();

        /// <summary>
        /// Invoked when a player entry is clicked for profile navigation.
        /// </summary>
        public event Action<string> OnPlayerProfileRequested;

        /// <summary>
        /// Unity Start. Initializes dropdown and category navigation.
        /// </summary>
        private void Start()
        {
            SetupTimeRangeDropdown();
            SetupNavigationButtons();
            SetupPreviewButtons();
            ShowLeaderboard(0);
        }

        /// <summary>
        /// Displays the leaderboard for a specific category index.
        /// </summary>
        /// <param name="categoryIndex">Zero-based index into <see cref="Categories"/>.</param>
        public void ShowLeaderboard(int categoryIndex)
        {
            _currentCategoryIndex = Mathf.Clamp(categoryIndex, 0, Categories.Count - 1);
            var config = Categories[_currentCategoryIndex];
            RefreshLeaderboard();
            UpdateNavigationButtons();
        }

        /// <summary>
        /// Refreshes the leaderboard entries from the current category and time range.
        /// </summary>
        public void RefreshLeaderboard()
        {
            ClearEntries();
            var config = Categories[_currentCategoryIndex];
            if (CategoryTitleText != null)
                CategoryTitleText.text = config.DisplayName;

            var entries = GetMockData(config.Category.ToString());
            entries = FilterByTimeRange(entries, _currentTimeRange);
            entries = SortAndRank(entries);

            PopulateLeaderboard(entries);
            PopulateMyRank(entries);
        }

        /// <summary>
        /// Called when the time range dropdown value changes.
        /// </summary>
        public void OnTimeRangeChanged(int index)
        {
            _currentTimeRange = (LeaderboardTimeRange)index;
            RefreshLeaderboard();
        }

        /// <summary>
        /// Called when a leaderboard player entry is clicked. Opens the preview panel.
        /// </summary>
        public void OnPlayerClicked(string playerId)
        {
            var entry = FindEntryByPlayerId(playerId);
            if (entry == null) return;

            if (PlayerPreviewPanel != null) PlayerPreviewPanel.SetActive(true);
            if (PreviewAvatar != null && entry.Avatar != null) PreviewAvatar.sprite = entry.Avatar;
            if (PreviewNameText != null) PreviewNameText.text = entry.PlayerName;
            if (PreviewScoreText != null) PreviewScoreText.text = $"Score: {entry.Score}";

            if (PreviewFriendButton != null)
            {
                PreviewFriendButton.onClick.RemoveAllListeners();
                PreviewFriendButton.onClick.AddListener(() => OnAddFriendClicked(playerId));
            }

            if (PreviewVisitRoomButton != null)
            {
                PreviewVisitRoomButton.onClick.RemoveAllListeners();
                PreviewVisitRoomButton.onClick.AddListener(() => OnVisitRoomClicked(playerId));
            }

            OnPlayerProfileRequested?.Invoke(playerId);
        }

        private void PopulateLeaderboard(List<LeaderboardEntry> entries)
        {
            if (LeaderboardContainer == null || LeaderboardEntryPrefab == null) return;

            for (int i = 0; i < entries.Count; i++)
            {
                var entry = entries[i];
                var go = Instantiate(LeaderboardEntryPrefab, LeaderboardContainer);
                _spawnedEntries.Add(go);

                BindEntry(go, entry, i);

                if (EntrySpawnAnimator != null)
                {
                    var anim = go.GetComponent<Animator>();
                    if (anim != null)
                    {
                        anim.SetTrigger("Spawn");
                        // Stagger triggers via delayed invoke could be added here.
                    }
                }
            }
        }

        private void PopulateMyRank(List<LeaderboardEntry> allEntries)
        {
            if (MyRankContainer == null || MyRankEntryPrefab == null) return;
            foreach (var go in _spawnedMyRank) Destroy(go);
            _spawnedMyRank.Clear();

            var me = allEntries.FirstOrDefault(e => e.IsMe);
            if (me == null) return;

            var go = Instantiate(MyRankEntryPrefab, MyRankContainer);
            _spawnedMyRank.Add(go);
            BindEntry(go, me, -1);
        }

        private void BindEntry(GameObject go, LeaderboardEntry entry, int spawnIndex)
        {
            var rankText = go.transform.Find("Rank")?.GetComponent<TMP_Text>();
            var nameText = go.transform.Find("Name")?.GetComponent<TMP_Text>();
            var scoreText = go.transform.Find("Score")?.GetComponent<TMP_Text>();
            var avatarImg = go.transform.Find("Avatar")?.GetComponent<Image>();
            var changeText = go.transform.Find("Change")?.GetComponent<TMP_Text>();
            var crownIcon = go.transform.Find("Crown")?.gameObject;
            var meBadge = go.transform.Find("MeBadge")?.gameObject;
            var clickBtn = go.GetComponent<Button>() ?? go.transform.Find("ClickArea")?.GetComponent<Button>();

            if (rankText != null) rankText.text = $"#{entry.Rank}";
            if (nameText != null) nameText.text = entry.PlayerName;
            if (scoreText != null) scoreText.text = entry.Score.ToString("N0");
            if (avatarImg != null && entry.Avatar != null) avatarImg.sprite = entry.Avatar;

            if (changeText != null)
            {
                if (entry.ChangeFromLastWeek > 0)
                {
                    changeText.text = $"▲{entry.ChangeFromLastWeek}";
                    changeText.color = Color.green;
                }
                else if (entry.ChangeFromLastWeek < 0)
                {
                    changeText.text = $"▼{Mathf.Abs(entry.ChangeFromLastWeek)}";
                    changeText.color = Color.red;
                }
                else
                {
                    changeText.text = "-";
                    changeText.color = Color.gray;
                }
            }

            if (crownIcon != null)
                crownIcon.SetActive(entry.Rank <= 3);

            if (meBadge != null)
                meBadge.SetActive(entry.IsMe);

            if (clickBtn != null)
            {
                clickBtn.onClick.RemoveAllListeners();
                clickBtn.onClick.AddListener(() => OnPlayerClicked(entry.PlayerId));
            }
        }

        private List<LeaderboardEntry> GetMockData(string categoryId)
        {
            var entries = new List<LeaderboardEntry>();
            var names = new[] { "KawaiiStar", "IslandHopper", "FluffyPanda", "CoolCat99", "SunnyBun",
                                "MochiMochi", "PixelDream", "AquaMarine", "LunaWolf", "CloudNine" };
            var rng = new System.Random(categoryId.GetHashCode());

            for (int i = 0; i < 20; i++)
            {
                entries.Add(new LeaderboardEntry
                {
                    Rank = i + 1,
                    PlayerId = $"player_{i:D3}",
                    PlayerName = names[i % names.Length] + (i >= names.Length ? $"_{i}" : ""),
                    Score = Mathf.Max(1, 1000 - i * 45 + rng.Next(-20, 20)),
                    IsMe = i == 4,
                    ChangeFromLastWeek = rng.Next(-5, 6)
                });
            }
            return entries;
        }

        private List<LeaderboardEntry> FilterByTimeRange(List<LeaderboardEntry> entries, LeaderboardTimeRange range)
        {
            // In a production build this would query PlayFab with date filters.
            // Mock data scales scores to simulate different time ranges.
            return range switch
            {
                LeaderboardTimeRange.Today => entries.Select(e => new LeaderboardEntry
                {
                    Rank = e.Rank, PlayerId = e.PlayerId, PlayerName = e.PlayerName,
                    Avatar = e.Avatar, Score = e.Score / 7, IsMe = e.IsMe, ChangeFromLastWeek = e.ChangeFromLastWeek
                }).ToList(),
                LeaderboardTimeRange.ThisMonth => entries.Select(e => new LeaderboardEntry
                {
                    Rank = e.Rank, PlayerId = e.PlayerId, PlayerName = e.PlayerName,
                    Avatar = e.Avatar, Score = e.Score * 3, IsMe = e.IsMe, ChangeFromLastWeek = e.ChangeFromLastWeek
                }).ToList(),
                LeaderboardTimeRange.AllTime => entries.Select(e => new LeaderboardEntry
                {
                    Rank = e.Rank, PlayerId = e.PlayerId, PlayerName = e.PlayerName,
                    Avatar = e.Avatar, Score = e.Score * 8, IsMe = e.IsMe, ChangeFromLastWeek = e.ChangeFromLastWeek
                }).ToList(),
                _ => entries
            };
        }

        private List<LeaderboardEntry> SortAndRank(List<LeaderboardEntry> entries)
        {
            var sorted = entries.OrderByDescending(e => e.Score).ToList();
            for (int i = 0; i < sorted.Count; i++)
                sorted[i].Rank = i + 1;
            return sorted;
        }

        private LeaderboardEntry FindEntryByPlayerId(string playerId)
        {
            var all = GetMockData(Categories[_currentCategoryIndex].Category.ToString());
            return all.FirstOrDefault(e => e.PlayerId == playerId);
        }

        private void SetupTimeRangeDropdown()
        {
            if (TimeRangeDropdown == null) return;
            TimeRangeDropdown.ClearOptions();
            TimeRangeDropdown.AddOptions(new List<string> { "Today", "This Week", "This Month", "All Time" });
            TimeRangeDropdown.onValueChanged.AddListener(OnTimeRangeChanged);
        }

        private void SetupNavigationButtons()
        {
            if (PrevCategoryButton != null)
                PrevCategoryButton.onClick.AddListener(() => ShowLeaderboard(_currentCategoryIndex - 1));
            if (NextCategoryButton != null)
                NextCategoryButton.onClick.AddListener(() => ShowLeaderboard(_currentCategoryIndex + 1));
        }

        private void SetupPreviewButtons()
        {
            if (PreviewCloseButton != null)
                PreviewCloseButton.onClick.AddListener(() => { if (PlayerPreviewPanel != null) PlayerPreviewPanel.SetActive(false); });
        }

        private void UpdateNavigationButtons()
        {
            if (PrevCategoryButton != null)
                PrevCategoryButton.interactable = _currentCategoryIndex > 0;
            if (NextCategoryButton != null)
                NextCategoryButton.interactable = _currentCategoryIndex < Categories.Count - 1;
        }

        private void ClearEntries()
        {
            foreach (var go in _spawnedEntries)
            {
                if (go != null) Destroy(go);
            }
            _spawnedEntries.Clear();
        }

        private void OnAddFriendClicked(string playerId)
        {
            SocialGraphManager.Instance?.SendFriendRequest(playerId);
            if (PreviewFriendButton != null)
            {
                var txt = PreviewFriendButton.GetComponentInChildren<TMP_Text>();
                if (txt != null) txt.text = "Request Sent!";
                PreviewFriendButton.interactable = false;
            }
        }

        private void OnVisitRoomClicked(string playerId)
        {
            // Room visit navigation would integrate with room manager.
            Debug.Log($"[SocialLeaderboard] Requesting room visit for player {playerId}");
        }
    }

    /// <summary>
    /// Configuration container for a single leaderboard category tab.
    /// </summary>
    [System.Serializable]
    public class LeaderboardCategoryConfig
    {
        public LeaderboardCategory Category;
        public string DisplayName;
        public string PlayFabStatisticName;
        public Sprite Icon;
    }

    public enum LeaderboardTimeRange { Today, ThisWeek, ThisMonth, AllTime }
}
