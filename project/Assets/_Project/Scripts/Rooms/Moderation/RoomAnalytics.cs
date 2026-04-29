using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KawaiiCoolIsland.Rooms.Moderation
{
    /// <summary>
    /// Daily aggregated statistics for a room.
    /// </summary>
    [System.Serializable]
    public class DailyStat
    {
        /// <summary>The calendar date for this stat entry.</summary>
        public DateTime Date;
        /// <summary>Total visits on this day.</summary>
        public int Visits;
        /// <summary>Unique visitors on this day.</summary>
        public int UniqueVisitors;
        /// <summary>Peak concurrent players on this day.</summary>
        public int PeakPlayers;
        /// <summary>Average visit duration in minutes on this day.</summary>
        public float AvgDuration;
    }

    /// <summary>
    /// Summary snapshot of room analytics for a given time range.
    /// </summary>
    [System.Serializable]
    public class RoomAnalyticsSummary
    {
        /// <summary>Total visits in the selected period.</summary>
        public int TotalVisits;
        /// <summary>Unique visitors in the selected period.</summary>
        public int UniqueVisitors;
        /// <summary>Maximum concurrent players in the selected period.</summary>
        public int PeakConcurrent;
        /// <summary>Average visit duration in minutes.</summary>
        public float AvgDuration;
        /// <summary>Growth rate percentage vs previous period.</summary>
        public float GrowthRate;
        /// <summary>Current number of favorites.</summary>
        public int Favorites;
        /// <summary>The most common entry source.</summary>
        public string MostPopularEntrySource;
        /// <summary>The most common exit reason.</summary>
        public string MostCommonExitReason;
    }

    /// <summary>
    /// Tracks and aggregates room analytics for room owners.
    /// All data is read-only from the owner's perspective and persists locally.
    /// </summary>
    public class RoomAnalytics : MonoBehaviour
    {
        [Header("Configuration")]
        [SerializeField] private int maxDailyStats = 90;

        [Header("Current Metrics")]
        /// <summary>Total visits across all tracked time.</summary>
        public int TotalVisits;
        /// <summary>Count of unique visitor identifiers.</summary>
        public int UniqueVisitors;
        /// <summary>Maximum concurrent players ever recorded.</summary>
        public int PeakConcurrentPlayers;
        /// <summary>Average visit duration in minutes.</summary>
        public float AverageVisitDuration;
        /// <summary>Current number of players who favorited the room.</summary>
        public int CurrentFavorites;
        /// <summary>Total active time of the room in hours.</summary>
        public float TotalTimeActive;
        /// <summary>Map of entry sources to visit counts.</summary>
        public Dictionary<string, int> EntrySources = new();
        /// <summary>Map of exit reasons to exit counts.</summary>
        public Dictionary<string, int> ExitReasons = new();
        /// <summary>Daily stat history.</summary>
        public List<DailyStat> DailyStats = new();

        private DateTime rangeFrom;
        private DateTime rangeTo;
        private readonly HashSet<string> uniqueVisitorIds = new();
        private float totalDurationAccumulator;
        private int durationSampleCount;
        private float currentSessionStartTime;
        private bool isSessionActive;

        /// <summary>
        /// Invoked when any analytic metric changes.
        /// </summary>
        public event Action OnAnalyticsUpdated;

        /// <summary>
        /// Sets the time range for filtering analytics queries.
        /// </summary>
        /// <param name="from">Start of the range.</param>
        /// <param name="to">End of the range.</param>
        public void SetTimeRange(DateTime from, DateTime to)
        {
            rangeFrom = from;
            rangeTo = to;
            OnAnalyticsUpdated?.Invoke();
        }

        /// <summary>
        /// Sets the analytics range to the last 24 hours.
        /// </summary>
        public void ShowLast24Hours()
        {
            rangeTo = DateTime.UtcNow;
            rangeFrom = rangeTo.AddHours(-24);
            OnAnalyticsUpdated?.Invoke();
        }

        /// <summary>
        /// Sets the analytics range to the last 7 days.
        /// </summary>
        public void ShowLast7Days()
        {
            rangeTo = DateTime.UtcNow;
            rangeFrom = rangeTo.AddDays(-7);
            OnAnalyticsUpdated?.Invoke();
        }

        /// <summary>
        /// Sets the analytics range to the last 30 days.
        /// </summary>
        public void ShowLast30Days()
        {
            rangeTo = DateTime.UtcNow;
            rangeFrom = rangeTo.AddDays(-30);
            OnAnalyticsUpdated?.Invoke();
        }

        /// <summary>
        /// Records a player visit.
        /// </summary>
        /// <param name="playerId">The visiting player identifier.</param>
        /// <param name="source">How the player found the room.</param>
        public void RecordVisit(string playerId, string source)
        {
            if (string.IsNullOrWhiteSpace(playerId)) return;
            source ??= "Unknown";

            TotalVisits++;
            if (uniqueVisitorIds.Add(playerId))
            {
                UniqueVisitors++;
            }

            if (EntrySources.ContainsKey(source))
                EntrySources[source]++;
            else
                EntrySources[source] = 1;

            UpdateDailyVisit(DateTime.UtcNow, playerId);
            OnAnalyticsUpdated?.Invoke();
        }

        /// <summary>
        /// Records a player exit.
        /// </summary>
        /// <param name="playerId">The exiting player identifier.</param>
        /// <param name="reason">Why the player left.</param>
        /// <param name="duration">Visit duration in minutes.</param>
        public void RecordExit(string playerId, string reason, float duration)
        {
            if (string.IsNullOrWhiteSpace(playerId)) return;
            reason ??= "Unknown";

            if (ExitReasons.ContainsKey(reason))
                ExitReasons[reason]++;
            else
                ExitReasons[reason] = 1;

            totalDurationAccumulator += duration;
            durationSampleCount++;
            AverageVisitDuration = durationSampleCount > 0 ? totalDurationAccumulator / durationSampleCount : 0f;

            UpdateDailyExit(DateTime.UtcNow, duration);
            OnAnalyticsUpdated?.Invoke();
        }

        /// <summary>
        /// Records a player favoriting the room.
        /// </summary>
        public void RecordFavoriteAdded()
        {
            CurrentFavorites++;
            OnAnalyticsUpdated?.Invoke();
        }

        /// <summary>
        /// Records a player removing their favorite.
        /// </summary>
        public void RecordFavoriteRemoved()
        {
            CurrentFavorites = Mathf.Max(0, CurrentFavorites - 1);
            OnAnalyticsUpdated?.Invoke();
        }

        /// <summary>
        /// Updates the current concurrent player count and tracks the peak.
        /// </summary>
        /// <param name="currentCount">Current number of players in the room.</param>
        public void UpdateConcurrentPlayers(int currentCount)
        {
            if (currentCount > PeakConcurrentPlayers)
            {
                PeakConcurrentPlayers = currentCount;
                UpdateDailyPeak(DateTime.UtcNow, currentCount);
                OnAnalyticsUpdated?.Invoke();
            }
        }

        /// <summary>
        /// Returns an analytics summary for the currently selected time range.
        /// </summary>
        /// <returns>A summary of key metrics.</returns>
        public RoomAnalyticsSummary GetSummary()
        {
            RoomAnalyticsSummary summary = new()
            {
                TotalVisits = 0,
                UniqueVisitors = 0,
                PeakConcurrent = 0,
                AvgDuration = 0,
                GrowthRate = 0,
                Favorites = CurrentFavorites,
                MostPopularEntrySource = "None",
                MostCommonExitReason = "None"
            };

            List<DailyStat> filtered = GetFilteredDailyStats();
            if (filtered.Count == 0)
            {
                summary.TotalVisits = TotalVisits;
                summary.UniqueVisitors = UniqueVisitors;
                summary.PeakConcurrent = PeakConcurrentPlayers;
                summary.AvgDuration = AverageVisitDuration;
                return summary;
            }

            float totalDuration = 0;
            int totalVisits = 0;
            int totalUnique = 0;
            int peak = 0;
            foreach (DailyStat day in filtered)
            {
                totalVisits += day.Visits;
                totalUnique += day.UniqueVisitors;
                peak = Mathf.Max(peak, day.PeakPlayers);
                totalDuration += day.AvgDuration * day.Visits;
            }

            summary.TotalVisits = totalVisits;
            summary.UniqueVisitors = totalUnique;
            summary.PeakConcurrent = peak;
            summary.AvgDuration = totalVisits > 0 ? totalDuration / totalVisits : 0;

            // Growth rate: compare current period to previous period
            int mid = filtered.Count / 2;
            if (mid > 0)
            {
                int firstHalf = filtered.Take(mid).Sum(d => d.Visits);
                int secondHalf = filtered.Skip(mid).Sum(d => d.Visits);
                if (firstHalf > 0)
                {
                    summary.GrowthRate = ((secondHalf - firstHalf) / (float)firstHalf) * 100f;
                }
            }

            // Most popular entry source in filtered range
            if (EntrySources.Count > 0)
            {
                KeyValuePair<string, int> top = EntrySources.OrderByDescending(kv => kv.Value).First();
                summary.MostPopularEntrySource = top.Key;
            }

            // Most common exit reason in filtered range
            if (ExitReasons.Count > 0)
            {
                KeyValuePair<string, int> top = ExitReasons.OrderByDescending(kv => kv.Value).First();
                summary.MostCommonExitReason = top.Key;
            }

            return summary;
        }

        /// <summary>
        /// Returns daily stats filtered by the current time range.
        /// </summary>
        private List<DailyStat> GetFilteredDailyStats()
        {
            if (rangeFrom == default && rangeTo == default)
                return new List<DailyStat>(DailyStats);

            return DailyStats.Where(d => d.Date >= rangeFrom && d.Date <= rangeTo).ToList();
        }

        /// <summary>
        /// Updates the daily stat entry for a visit.
        /// </summary>
        private void UpdateDailyVisit(DateTime date, string playerId)
        {
            DailyStat stat = GetOrCreateDailyStat(date);
            stat.Visits++;
            TrimDailyStats();
        }

        /// <summary>
        /// Updates the daily stat entry for an exit with duration.
        /// </summary>
        private void UpdateDailyExit(DateTime date, float duration)
        {
            DailyStat stat = GetOrCreateDailyStat(date);
            float totalAvg = stat.AvgDuration * (stat.Visits - 1);
            stat.AvgDuration = (totalAvg + duration) / stat.Visits;
        }

        /// <summary>
        /// Updates the daily peak concurrent players.
        /// </summary>
        private void UpdateDailyPeak(DateTime date, int peak)
        {
            DailyStat stat = GetOrCreateDailyStat(date);
            stat.PeakPlayers = Mathf.Max(stat.PeakPlayers, peak);
        }

        /// <summary>
        /// Gets or creates the daily stat entry for a given date.
        /// </summary>
        private DailyStat GetOrCreateDailyStat(DateTime date)
        {
            DateTime day = date.Date;
            DailyStat stat = DailyStats.FirstOrDefault(d => d.Date.Date == day);
            if (stat == null)
            {
                stat = new DailyStat { Date = day };
                DailyStats.Add(stat);
            }
            return stat;
        }

        /// <summary>
        /// Trims daily stats to the configured maximum.
        /// </summary>
        private void TrimDailyStats()
        {
            if (DailyStats.Count > maxDailyStats)
            {
                DailyStats = DailyStats.OrderByDescending(d => d.Date).Take(maxDailyStats).ToList();
            }
        }

        /// <summary>
        /// Resets all analytics data.
        /// </summary>
        public void ResetAnalytics()
        {
            TotalVisits = 0;
            UniqueVisitors = 0;
            PeakConcurrentPlayers = 0;
            AverageVisitDuration = 0;
            CurrentFavorites = 0;
            TotalTimeActive = 0;
            EntrySources.Clear();
            ExitReasons.Clear();
            DailyStats.Clear();
            uniqueVisitorIds.Clear();
            totalDurationAccumulator = 0;
            durationSampleCount = 0;
            OnAnalyticsUpdated?.Invoke();
        }

        /// <summary>
        /// Tracks room session active time.
        /// </summary>
        private void Update()
        {
            if (isSessionActive)
            {
                TotalTimeActive += Time.deltaTime / 3600f;
            }
        }

        /// <summary>
        /// Starts tracking room session time.
        /// </summary>
        public void StartSession()
        {
            isSessionActive = true;
            currentSessionStartTime = Time.time;
        }

        /// <summary>
        /// Stops tracking room session time.
        /// </summary>
        public void EndSession()
        {
            isSessionActive = false;
        }
    }
}
