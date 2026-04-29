using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KawaiiCoolIsland.Discovery
{
    /// <summary>
    /// Trend category classification for rooms.
    /// </summary>
    public enum TrendCategory
    {
        Trending,
        Rising,
        Hot,
        New,
        Official
    }

    /// <summary>
    /// Lightweight room info required for trending calculations.
    /// </summary>
    [System.Serializable]
    public class RoomInfo
    {
        public string RoomId;
        public string RoomName;
        public int CurrentPlayers;
        public int MaxPlayers;
        public float AvgVisitDuration;
        public float VisitsPerHour;
        public bool IsOfficial;
        public long CreatedAt;
        public List<string> Tags = new List<string>();
    }

    /// <summary>
    /// Holds a room's computed trend score and metadata.
    /// </summary>
    [System.Serializable]
    public class RoomTrendScore
    {
        public string RoomId;
        public string RoomName;
        public float Score;
        public float PreviousScore;
        public float GrowthRate;
        public int CurrentPlayers;
        public TrendCategory Category;
    }

    /// <summary>
    /// Algorithm that computes trending, rising and hot rooms based on
    /// player count, visit rate, friend activity, recency decay and boosts.
    /// </summary>
    public class TrendingRooms : MonoBehaviour
    {
        [Header("Algorithm")]
        /// <summary>Weight given to current player count in scoring.</summary>
        public float PlayerCountWeight = 1f;
        /// <summary>Weight given to visit rate in scoring.</summary>
        public float VisitRateWeight = 2f;
        /// <summary>Weight given to friend activity in scoring.</summary>
        public float FriendActivityWeight = 3f;
        /// <summary>Multiplier applied to newly created rooms.</summary>
        public float NewRoomBoost = 1.5f;
        /// <summary>Multiplier applied to official rooms.</summary>
        public float OfficialRoomBoost = 1.2f;
        /// <summary>Decay factor applied per hour since last update (0-1).</summary>
        public float RecencyDecay = 0.95f;
        /// <summary>Seconds between automatic trend recalculations.</summary>
        public float UpdateInterval = 300f;

        [Header("Results")]
        /// <summary>Computed list of trending rooms with scores.</summary>
        public List<RoomTrendScore> TrendingList = new List<RoomTrendScore>();
        /// <summary>Number of rooms to include in the trending list.</summary>
        public int TrendingCount = 10;

        private Dictionary<string, RoomTrendScore> _previousScores = new Dictionary<string, RoomTrendScore>();
        private Dictionary<string, int> _friendVisits = new Dictionary<string, int>();
        private float _lastUpdateTime;
        private List<RoomInfo> _trackedRooms = new List<RoomInfo>();

        /// <summary>
        /// Recalculates trending scores for all tracked rooms and rebuilds lists.
        /// </summary>
        public void CalculateTrending()
        {
            var newScores = new List<RoomTrendScore>();
            float hoursSinceLast = (Time.time - _lastUpdateTime) / 3600f;

            foreach (var room in _trackedRooms)
            {
                float raw = CalculateRoomScore(room);
                float decayed = ApplyDecay(raw, hoursSinceLast);
                float boosted = ApplyBoosts(room, decayed);

                float prev = _previousScores.ContainsKey(room.RoomId)
                    ? _previousScores[room.RoomId].Score
                    : 0f;

                float growth = prev > 0f ? (boosted - prev) / prev : 0f;

                var trend = new RoomTrendScore
                {
                    RoomId = room.RoomId,
                    RoomName = room.RoomName,
                    Score = boosted,
                    PreviousScore = prev,
                    GrowthRate = growth,
                    CurrentPlayers = room.CurrentPlayers,
                    Category = ClassifyTrend(growth, room)
                };

                newScores.Add(trend);
            }

            _previousScores = newScores.ToDictionary(s => s.RoomId, s => s);
            TrendingList = newScores.OrderByDescending(s => s.Score).Take(TrendingCount).ToList();
            _lastUpdateTime = Time.time;
        }

        /// <summary>
        /// Gets the top trending rooms.
        /// </summary>
        /// <param name="count">Maximum number of rooms to return.</param>
        /// <returns>List of trending room scores.</returns>
        public List<RoomTrendScore> GetTrending(int count = 10)
        {
            if (Time.time - _lastUpdateTime > UpdateInterval)
                CalculateTrending();

            return TrendingList.Take(count).ToList();
        }

        /// <summary>
        /// Gets the fastest-growing (rising) rooms.
        /// </summary>
        /// <param name="count">Maximum number of rooms to return.</param>
        /// <returns>List of rising room scores.</returns>
        public List<RoomTrendScore> GetRising(int count = 5)
        {
            if (Time.time - _lastUpdateTime > UpdateInterval)
                CalculateTrending();

            return TrendingList.Where(r => r.GrowthRate > 0f)
                               .OrderByDescending(r => r.GrowthRate)
                               .Take(count)
                               .ToList();
        }

        /// <summary>
        /// Gets the currently most active (hot) rooms.
        /// </summary>
        /// <param name="count">Maximum number of rooms to return.</param>
        /// <returns>List of hot room scores.</returns>
        public List<RoomTrendScore> GetHot(int count = 5)
        {
            if (Time.time - _lastUpdateTime > UpdateInterval)
                CalculateTrending();

            return TrendingList.OrderByDescending(r => r.CurrentPlayers)
                               .Take(count)
                               .ToList();
        }

        /// <summary>
        /// Calculates a raw trend score for a single room.
        /// </summary>
        /// <param name="room">The room to score.</param>
        /// <returns>Raw score before decay and boosts.</returns>
        public float CalculateRoomScore(RoomInfo room)
        {
            if (room == null) return 0f;

            float playerFactor = room.MaxPlayers > 0
                ? (float)room.CurrentPlayers / room.MaxPlayers
                : 0f;

            float visitFactor = Mathf.Min(room.VisitsPerHour / 100f, 1f);

            float friendFactor = _friendVisits.ContainsKey(room.RoomId)
                ? Mathf.Min(_friendVisits[room.RoomId] / 10f, 1f)
                : 0f;

            return playerFactor * PlayerCountWeight
                 + visitFactor * VisitRateWeight
                 + friendFactor * FriendActivityWeight;
        }

        /// <summary>
        /// Reports a player visiting a room.
        /// </summary>
        /// <param name="roomId">The visited room ID.</param>
        public void ReportRoomVisit(string roomId)
        {
            var room = _trackedRooms.FirstOrDefault(r => r.RoomId == roomId);
            if (room == null)
            {
                // Room not tracked yet; request full info from RoomBrowser
                EventBus.Publish("RequestRoomInfo", roomId);
                return;
            }
            room.CurrentPlayers++;
        }

        /// <summary>
        /// Reports a player exiting a room with dwell time.
        /// </summary>
        /// <param name="roomId">The exited room ID.</param>
        /// <param name="timeSpent">Seconds spent in the room.</param>
        public void ReportRoomExit(string roomId, float timeSpent)
        {
            var room = _trackedRooms.FirstOrDefault(r => r.RoomId == roomId);
            if (room == null) return;
            room.CurrentPlayers = Mathf.Max(0, room.CurrentPlayers - 1);

            // Update rolling average dwell time
            room.AvgVisitDuration = (room.AvgVisitDuration + timeSpent) * 0.5f;
        }

        /// <summary>
        /// Registers or updates a room in the trending tracker.
        /// </summary>
        /// <param name="room">Room info to register.</param>
        public void RegisterRoom(RoomInfo room)
        {
            if (room == null) return;
            var existing = _trackedRooms.FirstOrDefault(r => r.RoomId == room.RoomId);
            if (existing != null)
                _trackedRooms.Remove(existing);
            _trackedRooms.Add(room);
        }

        /// <summary>
        /// Reports that a friend visited a room, boosting its friend-activity weight.
        /// </summary>
        /// <param name="roomId">The room ID.</param>
        public void ReportFriendVisit(string roomId)
        {
            if (!_friendVisits.ContainsKey(roomId))
                _friendVisits[roomId] = 0;
            _friendVisits[roomId]++;
        }

        /// <summary>
        /// Applies time-based decay to a score.
        /// </summary>
        /// <param name="score">The base score.</param>
        /// <param name="hoursSinceUpdate">Hours since the last update.</param>
        /// <returns>Decayed score.</returns>
        private float ApplyDecay(float score, float hoursSinceUpdate)
        {
            return score * Mathf.Pow(RecencyDecay, hoursSinceUpdate);
        }

        /// <summary>
        /// Applies boosts based on room metadata.
        /// </summary>
        /// <param name="room">The room to boost.</param>
        /// <param name="baseScore">Score before boosts.</param>
        /// <returns>Boosted score.</returns>
        private float ApplyBoosts(RoomInfo room, float baseScore)
        {
            float boosted = baseScore;
            long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            float hoursSinceCreated = (now - room.CreatedAt) / 3600f;

            if (hoursSinceCreated < 24f)
                boosted *= NewRoomBoost;

            if (room.IsOfficial)
                boosted *= OfficialRoomBoost;

            return boosted;
        }

        /// <summary>
        /// Classifies a room into a trend category based on growth and metadata.
        /// </summary>
        /// <param name="growthRate">The growth rate of the room score.</param>
        /// <param name="room">The room info.</param>
        /// <returns>The assigned trend category.</returns>
        private TrendCategory ClassifyTrend(float growthRate, RoomInfo room)
        {
            if (room.IsOfficial) return TrendCategory.Official;
            long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            if ((now - room.CreatedAt) < 86400) return TrendCategory.New;
            if (growthRate > 0.25f) return TrendCategory.Rising;
            if (room.CurrentPlayers >= room.MaxPlayers * 0.8f) return TrendCategory.Hot;
            return TrendCategory.Trending;
        }

        /// <summary>
        /// Unity Start — subscribe to event bus and do an initial calculation.
        /// </summary>
        private void Start()
        {
            EventBus.Subscribe("RoomVisited", OnRoomVisited);
            EventBus.Subscribe("RoomInfoReceived", OnRoomInfoReceived);
            EventBus.Subscribe("FriendJoinedRoom", OnFriendJoinedRoom);
            CalculateTrending();
        }

        /// <summary>
        /// Unity OnDestroy — clean up subscriptions.
        /// </summary>
        private void OnDestroy()
        {
            EventBus.Unsubscribe("RoomVisited", OnRoomVisited);
            EventBus.Unsubscribe("RoomInfoReceived", OnRoomInfoReceived);
            EventBus.Unsubscribe("FriendJoinedRoom", OnFriendJoinedRoom);
        }

        private void OnRoomVisited(object data)
        {
            if (data is string roomId)
                ReportRoomVisit(roomId);
        }

        private void OnRoomInfoReceived(object data)
        {
            if (data is RoomInfo room)
                RegisterRoom(room);
        }

        private void OnFriendJoinedRoom(object data)
        {
            if (data is string[] parts && parts.Length >= 2)
                ReportFriendVisit(parts[1]);
        }
    }
}
