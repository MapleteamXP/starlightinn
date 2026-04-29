using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace KawaiiCool.Missions
{
    /// <summary>
    /// UI panel for displaying, tracking, and claiming daily, weekly, and special missions.
    /// Integrates with <see cref="MissionManager"/> via events and provides rich visual feedback
    /// including progress bars, streak indicators, and completion animations.
    /// </summary>
    public class MissionUI : UIPanel
    {
        [Header("Tabs")]
        public Toggle DailyTab;
        public Toggle WeeklyTab;
        public Toggle SpecialTab;
        public Toggle CompletedTab;

        [Header("Mission List")]
        public Transform MissionListContainer;
        public GameObject MissionItemPrefab;
        public ScrollRect MissionScrollRect;

        [Header("Mission Item (template references for binding)")]
        public Image MissionIcon;
        public TMP_Text TitleText;
        public TMP_Text DescriptionText;
        public Slider ProgressSlider;
        public TMP_Text ProgressText;
        public Button ClaimButton;
        public Image CompleteCheckmark;
        public GameObject NewBadge;

        [Header("Streak")]
        public GameObject StreakPanel;
        public TMP_Text StreakText;
        public Slider StreakSlider;
        public TMP_Text StreakBonusText;
        public Transform StreakRewardsContainer;

        [Header("Summary")]
        public TMP_Text DailyCompleteText;
        public TMP_Text WeeklyCompleteText;
        public Button ClaimAllButton;

        [Header("Details Panel")]
        public GameObject DetailsPanel;
        public TMP_Text DetailsTitleText;
        public TMP_Text DetailsDescriptionText;
        public Transform DetailsRewardsContainer;
        public GameObject DetailsRewardPrefab;
        public Button DetailsCloseButton;
        public Button DetailsClaimButton;

        [Header("Animation")]
        public Animator CompletionAnimator;
        public Animator StreakAnimator;
        public ParticleSystem ClaimParticles;

        /// <summary>
        /// Fired when the player requests to claim a specific mission reward.
        /// </summary>
        public event Action<string> OnMissionClaimRequested;

        private MissionType _currentCategory = MissionType.Daily;
        private string _selectedMissionId;
        private readonly List<GameObject> _spawnedItems = new();
        private readonly List<GameObject> _spawnedStreakRewards = new();
        private readonly List<GameObject> _spawnedDetailRewards = new();

        /// <summary>
        /// Called when the panel is shown. Refreshes data and subscribes to mission events.
        /// </summary>
        public override void OnPanelShow()
        {
            base.OnPanelShow();
            SubscribeEvents();
            RefreshMissions();
            UpdateStreakDisplay();
            UpdateSummaryText();
            SetupTabs();
        }

        /// <summary>
        /// Called when the panel is hidden. Unsubscribes from mission events to avoid leaks.
        /// </summary>
        public override void OnPanelHide()
        {
            base.OnPanelHide();
            UnsubscribeEvents();
            ClearSpawnedItems();
            ClearDetailsPanel();
        }

        private void SubscribeEvents()
        {
            if (MissionManager.Instance != null)
            {
                MissionManager.Instance.OnMissionCompleted += OnMissionCompletedHandler;
                MissionManager.Instance.OnMissionClaimed += OnMissionClaimedHandler;
                MissionManager.Instance.OnAllDailyMissionsComplete += OnAllDailyCompleteHandler;
                MissionManager.Instance.OnStreakIncreased += OnStreakIncreasedHandler;
            }
        }

        private void UnsubscribeEvents()
        {
            if (MissionManager.Instance != null)
            {
                MissionManager.Instance.OnMissionCompleted -= OnMissionCompletedHandler;
                MissionManager.Instance.OnMissionClaimed -= OnMissionClaimedHandler;
                MissionManager.Instance.OnAllDailyMissionsComplete -= OnAllDailyCompleteHandler;
                MissionManager.Instance.OnStreakIncreased -= OnStreakIncreasedHandler;
            }
        }

        private void SetupTabs()
        {
            if (DailyTab != null)
                DailyTab.onValueChanged.AddListener(isOn => { if (isOn) ShowCategory(MissionType.Daily); });
            if (WeeklyTab != null)
                WeeklyTab.onValueChanged.AddListener(isOn => { if (isOn) ShowCategory(MissionType.Weekly); });
            if (SpecialTab != null)
                SpecialTab.onValueChanged.AddListener(isOn => { if (isOn) ShowCategory(MissionType.Special); });
            if (CompletedTab != null)
                CompletedTab.onValueChanged.AddListener(isOn => { if (isOn) ShowCategory(MissionType.Achievement); });
        }

        /// <summary>
        /// Refreshes the entire mission list and summary UI from <see cref="MissionManager"/> state.
        /// </summary>
        public void RefreshMissions()
        {
            ClearSpawnedItems();

            List<MissionProgress> missions = _currentCategory switch
            {
                MissionType.Daily => MissionManager.Instance?.GetActiveDailyMissions(),
                MissionType.Weekly => MissionManager.Instance?.GetActiveWeeklyMissions(),
                MissionType.Special => GetActiveSpecialMissions(),
                _ => MissionManager.Instance?.CompletedMissions
            };

            if (missions != null)
                PopulateMissionList(missions);

            UpdateSummaryText();
            RefreshClaimAllButton();
        }

        /// <summary>
        /// Switches the visible mission category and refreshes the list.
        /// </summary>
        /// <param name="type">The mission category to display.</param>
        public void ShowCategory(MissionType type)
        {
            _currentCategory = type;
            RefreshMissions();
        }

        /// <summary>
        /// Handles click on a mission list item. Opens the details panel.
        /// </summary>
        public void OnMissionClicked(string missionId)
        {
            ShowMissionDetails(missionId);
        }

        /// <summary>
        /// Handles claim button click for a single mission.
        /// </summary>
        public void OnClaimClicked(string missionId)
        {
            if (MissionManager.Instance != null)
            {
                MissionManager.Instance.ClaimMissionReward(missionId);
                OnMissionClaimRequested?.Invoke(missionId);
                PlayCompletionAnimation(missionId);
            }
            RefreshMissions();
        }

        /// <summary>
        /// Claims all completed but unclaimed missions in the current category.
        /// </summary>
        public void OnClaimAllClicked()
        {
            var claimable = MissionManager.Instance?.CompletedMissions.Where(m => m.IsComplete && !m.IsClaimed).ToList();
            if (claimable == null || claimable.Count == 0) return;

            foreach (var mission in claimable)
            {
                MissionManager.Instance.ClaimMissionReward(mission.MissionId);
                OnMissionClaimRequested?.Invoke(mission.MissionId);
            }

            PlayClaimAllAnimation();
            RefreshMissions();
        }

        /// <summary>
        /// Displays the details panel for a specific mission, including rewards.
        /// </summary>
        public void ShowMissionDetails(string missionId)
        {
            _selectedMissionId = missionId;
            var data = ResolveMissionData(missionId);
            if (data == null) return;

            if (DetailsPanel != null) DetailsPanel.SetActive(true);
            if (DetailsTitleText != null) DetailsTitleText.text = data.Title;
            if (DetailsDescriptionText != null) DetailsDescriptionText.text = data.Description;

            ClearDetailsRewards();
            foreach (var reward in data.Rewards)
            {
                var go = Instantiate(DetailsRewardPrefab, DetailsRewardsContainer);
                if (go == null) continue;
                var txt = go.GetComponentInChildren<TMP_Text>();
                if (txt != null)
                    txt.text = $"{reward.RewardType}: {reward.Amount}";
                _spawnedDetailRewards.Add(go);
            }

            if (DetailsClaimButton != null)
            {
                bool canClaim = MissionManager.Instance?.IsMissionComplete(missionId) == true
                                && MissionManager.Instance?.IsMissionClaimed(missionId) == false;
                DetailsClaimButton.gameObject.SetActive(canClaim);
                DetailsClaimButton.onClick.RemoveAllListeners();
                DetailsClaimButton.onClick.AddListener(() => OnClaimClicked(missionId));
            }
        }

        /// <summary>
        /// Closes the mission details panel.
        /// </summary>
        public void CloseDetailsPanel()
        {
            if (DetailsPanel != null) DetailsPanel.SetActive(false);
            _selectedMissionId = null;
        }

        /// <summary>
        /// Plays the mission completion celebration animation.
        /// </summary>
        public void PlayCompletionAnimation(string missionId)
        {
            if (CompletionAnimator != null)
                CompletionAnimator.SetTrigger("Complete");
            if (ClaimParticles != null)
                ClaimParticles.Play();
        }

        /// <summary>
        /// Plays the streak milestone celebration animation.
        /// </summary>
        public void PlayStreakAnimation()
        {
            if (StreakAnimator != null)
                StreakAnimator.SetTrigger("StreakUp");
            if (StreakPanel != null)
            {
                var canvasGroup = StreakPanel.GetComponent<CanvasGroup>();
                if (canvasGroup != null)
                {
                    canvasGroup.alpha = 0f;
                    LeanTween.alphaCanvas(canvasGroup, 1f, 0.5f);
                }
            }
        }

        /// <summary>
        /// Plays a combined animation when claiming all missions at once.
        /// </summary>
        private void PlayClaimAllAnimation()
        {
            if (ClaimParticles != null)
            {
                var main = ClaimParticles.main;
                main.startSpeed = main.startSpeed.constant * 1.5f;
                ClaimParticles.Play();
            }
            if (CompletionAnimator != null)
                CompletionAnimator.SetTrigger("ClaimAll");
        }

        /// <summary>
        /// Binds mission data to the scrollable list of mission items.
        /// </summary>
        private void PopulateMissionList(List<MissionProgress> missions)
        {
            if (MissionItemPrefab == null || MissionListContainer == null) return;

            foreach (var progress in missions)
            {
                var data = ResolveMissionData(progress.MissionId);
                if (data == null) continue;

                var item = Instantiate(MissionItemPrefab, MissionListContainer);
                _spawnedItems.Add(item);

                BindMissionItem(item, data, progress);
            }
        }

        private void BindMissionItem(GameObject item, MissionData data, MissionProgress progress)
        {
            var icon = item.transform.Find("Icon")?.GetComponent<Image>();
            var title = item.transform.Find("Title")?.GetComponent<TMP_Text>();
            var desc = item.transform.Find("Description")?.GetComponent<TMP_Text>();
            var slider = item.transform.Find("ProgressSlider")?.GetComponent<Slider>();
            var progressText = item.transform.Find("ProgressText")?.GetComponent<TMP_Text>();
            var claimBtn = item.transform.Find("ClaimButton")?.GetComponent<Button>();
            var checkmark = item.transform.Find("CompleteCheckmark")?.GetComponent<Image>();
            var newBadge = item.transform.Find("NewBadge")?.gameObject;
            var clickArea = item.GetComponent<Button>() ?? item.transform.Find("ClickArea")?.GetComponent<Button>();

            if (icon != null && data.Icon != null) icon.sprite = data.Icon;
            if (title != null) title.text = data.Title;
            if (desc != null) desc.text = data.Description;

            float pct = MissionManager.Instance?.GetMissionProgressPercent(progress.MissionId) ?? 0f;
            if (slider != null)
            {
                slider.value = pct;
                slider.fillRect.GetComponent<Image>().color = pct >= 1f
                    ? Color.green
                    : new Color(1f, 0.6f, 0.2f);
            }
            if (progressText != null)
            {
                int current = progress.CurrentProgress;
                int target = data.TargetAmount;
                progressText.text = $"{current}/{target}";
            }

            bool isComplete = progress.IsComplete;
            bool isClaimed = progress.IsClaimed;

            if (claimBtn != null)
            {
                claimBtn.gameObject.SetActive(isComplete && !isClaimed);
                claimBtn.onClick.RemoveAllListeners();
                claimBtn.onClick.AddListener(() => OnClaimClicked(progress.MissionId));
            }

            if (checkmark != null)
                checkmark.gameObject.SetActive(isComplete && isClaimed);

            if (newBadge != null)
                newBadge.SetActive(!isComplete && !isClaimed && progress.CurrentProgress == 0);

            if (clickArea != null)
            {
                clickArea.onClick.RemoveAllListeners();
                clickArea.onClick.AddListener(() => OnMissionClicked(progress.MissionId));
            }
        }

        /// <summary>
        /// Updates the streak panel visuals from <see cref="MissionManager"/>.
        /// </summary>
        private void UpdateStreakDisplay()
        {
            if (MissionManager.Instance == null) return;
            int streak = MissionManager.Instance.DailyCompletionStreak;
            int max = MissionManager.Instance.MaxStreak;

            if (StreakText != null) StreakText.text = $"{streak} Day Streak!";
            if (StreakSlider != null)
            {
                StreakSlider.maxValue = max;
                StreakSlider.value = streak;
            }
            if (StreakBonusText != null)
            {
                float bonus = streak * MissionManager.Instance.StreakBonusMultiplier * 100f;
                StreakBonusText.text = $"+{bonus:0}% Reward Bonus";
            }

            PopulateStreakRewards(streak, max);
        }

        private void PopulateStreakRewards(int streak, int max)
        {
            if (StreakRewardsContainer == null) return;
            foreach (var go in _spawnedStreakRewards) Destroy(go);
            _spawnedStreakRewards.Clear();

            for (int i = 1; i <= max; i += 5)
            {
                var go = new GameObject($"StreakReward_{i}");
                go.transform.SetParent(StreakRewardsContainer, false);
                var img = go.AddComponent<Image>();
                img.color = i <= streak ? Color.yellow : Color.gray;
                var txt = new GameObject("Label").AddComponent<TMP_Text>();
                txt.transform.SetParent(go.transform, false);
                txt.text = $"Day {i}";
                txt.alignment = TextAlignmentOptions.Center;
                _spawnedStreakRewards.Add(go);
            }
        }

        private void UpdateSummaryText()
        {
            if (MissionManager.Instance == null) return;

            int dailyTotal = MissionManager.Instance.DailyMissionCount;
            int dailyDone = MissionManager.Instance.CompletedMissions.Count(m =>
                MissionManager.Instance.DailyMissions.Any(d => d.MissionId == m.MissionId) && m.IsComplete);
            if (DailyCompleteText != null)
                DailyCompleteText.text = $"Daily: {dailyDone}/{dailyTotal}";

            int weeklyTotal = MissionManager.Instance.WeeklyMissionCount;
            int weeklyDone = MissionManager.Instance.CompletedMissions.Count(m =>
                MissionManager.Instance.WeeklyMissions.Any(w => w.MissionId == m.MissionId) && m.IsComplete);
            if (WeeklyCompleteText != null)
                WeeklyCompleteText.text = $"Weekly: {weeklyDone}/{weeklyTotal}";
        }

        private void RefreshClaimAllButton()
        {
            if (ClaimAllButton == null || MissionManager.Instance == null) return;
            bool hasClaimable = MissionManager.Instance.CompletedMissions.Any(m => m.IsComplete && !m.IsClaimed);
            ClaimAllButton.gameObject.SetActive(hasClaimable);
            ClaimAllButton.onClick.RemoveAllListeners();
            ClaimAllButton.onClick.AddListener(OnClaimAllClicked);
        }

        private List<MissionProgress> GetActiveSpecialMissions()
        {
            if (MissionManager.Instance == null) return new List<MissionProgress>();
            var specialIds = new HashSet<string>(MissionManager.Instance.SpecialMissions.Select(s => s.MissionId));
            return MissionManager.Instance.ActiveMissions.Where(m => specialIds.Contains(m.MissionId)).ToList();
        }

        private MissionData ResolveMissionData(string missionId)
        {
            if (MissionManager.Instance == null) return null;
            var all = new List<MissionData>();
            all.AddRange(MissionManager.Instance.DailyMissions);
            all.AddRange(MissionManager.Instance.WeeklyMissions);
            all.AddRange(MissionManager.Instance.SpecialMissions);
            return all.FirstOrDefault(m => m.MissionId == missionId);
        }

        private void ClearSpawnedItems()
        {
            foreach (var go in _spawnedItems)
            {
                if (go != null) Destroy(go);
            }
            _spawnedItems.Clear();
        }

        private void ClearDetailsPanel()
        {
            CloseDetailsPanel();
            ClearDetailsRewards();
        }

        private void ClearDetailsRewards()
        {
            foreach (var go in _spawnedDetailRewards)
            {
                if (go != null) Destroy(go);
            }
            _spawnedDetailRewards.Clear();
        }

        #region Event Handlers

        private void OnMissionCompletedHandler(string missionId)
        {
            RefreshMissions();
            PlayCompletionAnimation(missionId);
        }

        private void OnMissionClaimedHandler(string missionId)
        {
            RefreshMissions();
        }

        private void OnAllDailyCompleteHandler()
        {
            PlayStreakAnimation();
            UpdateStreakDisplay();
        }

        private void OnStreakIncreasedHandler()
        {
            UpdateStreakDisplay();
            PlayStreakAnimation();
        }

        #endregion
    }
}
