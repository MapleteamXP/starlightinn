using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using TMPro;

// ---------------------------------------------------------------------------
// KawaiiCool Island - Fashion Voting Minigame
// ---------------------------------------------------------------------------
// A fashion contest minigame with two phases: Dress Up (players assemble
// outfits matching a random theme) and Voting (players vote on each other's
// outfits). Features theme adherence scoring, limited votes per player,
// and comprehensive results calculation.
// ---------------------------------------------------------------------------

namespace KawaiiCool.Minigames
{
    /// <summary>
    /// Current phase of the Fashion Voting minigame.
    /// </summary>
    public enum FashionPhase
    {
        /// <summary>Players are assembling their outfits.</summary>
        DressUp,

        /// <summary>Players are voting on each other's outfits.</summary>
        Voting,

        /// <summary>Final results are being displayed.</summary>
        Results
    }

    /// <summary>
    /// Serializable definition of a fashion theme that players dress up to match.
    /// </summary>
    [Serializable]
    public class FashionTheme
    {
        [Tooltip("Unique identifier for this theme.")]
        public string ThemeId;

        [Tooltip("Display name shown to players.")]
        public string ThemeName;

        [Tooltip("Description of what the theme means.")]
        public string Description;

        [Tooltip("Icon sprite for the theme.")]
        public Sprite ThemeIcon;

        [Tooltip("Clothing tags that match this theme (e.g., 'cute', 'elegant', 'sporty').")]
        public List<string> PreferredTags;

        [Tooltip("Specific item IDs that give bonus points for this theme.")]
        public List<string> BonusItemIds;
    }

    /// <summary>
    /// Represents a player's submitted outfit and voting results.
    /// </summary>
    [Serializable]
    public class PlayerOutfit
    {
        [Tooltip("Player who submitted this outfit.")]
        public string PlayerId;

        [Tooltip("Display name of the player.")]
        public string PlayerName;

        [Tooltip("Mapping of outfit slot names to equipped item IDs.")]
        public Dictionary<string, string> OutfitParts;

        [Tooltip("Score for how well the outfit matches the theme (0-100).")]
        public int ThemeAdherenceScore;

        [Tooltip">Number of votes received from other players.</")]
        public int VoteCount;

        [Tooltip("Final calculated score combining theme adherence and votes.")]
        public int FinalScore;

        public PlayerOutfit()
        {
            OutfitParts = new Dictionary<string, string>();
            ThemeAdherenceScore = 0;
            VoteCount = 0;
            FinalScore = 0;
        }
    }

    /// <summary>
    /// Final results of the fashion voting minigame.
    /// </summary>
    [Serializable]
    public class FashionResults
    {
        [Tooltip("The theme that was used for this round.")]
        public FashionTheme Theme;

        [Tooltip("Player outfits ranked by final score.")]
        public List<PlayerOutfit> RankedOutfits;

        [Tooltip("Mapping of player ID to number of votes they cast.")]
        public Dictionary<string, int> VotesCast;

        [Tooltip("Timestamp when results were finalized.")]
        public float ResultsTimestamp;

        public FashionResults()
        {
            RankedOutfits = new List<PlayerOutfit>();
            VotesCast = new Dictionary<string, int>();
        }
    }

    /// <summary>
    /// Fashion Voting minigame controller. Players dress up to match a random
    /// theme, then vote on each other's outfits. Scoring combines theme
    /// adherence and popular vote.
    /// </summary>
    public class FashionVotingMinigame : MinigameController
    {
        #region Inspector Settings

        [Header("Phases")]
        [Tooltip("Duration of the dress-up phase in seconds.")]
        public float DressUpDuration = 60f;

        [Tooltip("Duration of the voting phase in seconds.")]
        public float VotingDuration = 30f;

        [Tooltip("Duration of the results display in seconds.")]
        public float ResultsDisplayDuration = 15f;

        [Header("Themes")]
        [Tooltip("List of possible fashion themes. One is randomly selected each round.")]
        public List<FashionTheme> Themes = new();

        [Header("Voting")]
        [Tooltip("Number of votes each player can cast.")]
        public int VotesPerPlayer = 3;

        [Tooltip("If true, players can vote for their own outfit.")]
        public bool AllowSelfVote = false;

        [Header("Scoring")]
        [Tooltip("Weight of theme adherence in the final score (0-1).")]
        [Range(0f, 1f)]
        public float ThemeAdherenceWeight = 0.4f;

        [Tooltip("Weight of popular vote in the final score (0-1).")]
        [Range(0f, 1f)]
        public float PopularVoteWeight = 0.6f;

        [Tooltip("Maximum theme adherence score possible.")]
        public int MaxThemeScore = 100;

        [Header("UI")]
        [Tooltip("Text displaying the current theme name.")]
        public TMP_Text ThemeText;

        [Tooltip("Text displaying the current phase.")]
        public TMP_Text PhaseText;

        [Tooltip("Text displaying remaining votes.")]
        public TMP_Text VotesRemainingText;

        [Tooltip("Panel displaying all outfits for voting.")]
        public GameObject VotingPanel;

        [Tooltip("Prefab for an outfit display entry in the voting panel.")]
        public GameObject OutfitDisplayPrefab;

        [Tooltip("Container for outfit display entries.")]
        public Transform OutfitDisplayContainer;

        #endregion

        #region Runtime State

        /// <summary>The currently selected fashion theme.</summary>
        private FashionTheme _currentTheme;

        /// <summary>The current phase of the minigame.</summary>
        private FashionPhase _currentPhase;

        /// <summary>Mapping of player ID to their submitted outfit.</summary>
        private Dictionary<string, PlayerOutfit> _playerOutfits = new();

        /// <summary>Mapping of target player ID to list of voter IDs.</summary>
        private Dictionary<string, List<string>> _votes = new();

        /// <summary>Tracks how many votes each player has remaining.</summary>
        private Dictionary<string, int> _votesRemaining = new();

        /// <summary>Final results for this round.</summary>
        private FashionResults _results;

        /// <summary>Timer for the current phase.</summary>
        private float _phaseTimer;

        /// <summary>Whether all players have submitted outfits.</summary>
        private bool _allOutfitsSubmitted;

        #endregion

        #region Events

        /// <summary>Invoked when a theme is announced to all players.</summary>
        public event Action<FashionTheme> OnThemeAnnounced;

        /// <summary>Invoked when the phase changes.</summary>
        public event Action<FashionPhase> OnFashionPhaseChanged;

        /// <summary>Invoked when a vote is cast. Argument is the target player ID.</summary>
        public event Action<string> OnVoteCast;

        #endregion

        #region Initialization

        /// <summary>
        /// Called once after initialization. Validates theme list and sets up data.
        /// </summary>
        protected override void OnInitialized()
        {
            base.OnInitialized();

            if (Themes == null || Themes.Count == 0)
            {
                Debug.LogWarning("[FashionVoting] No themes configured! Adding default themes.");
                Themes = GetDefaultThemes();
            }

            _playerOutfits.Clear();
            _votes.Clear();
            _votesRemaining.Clear();
            _results = new FashionResults();
            _allOutfitsSubmitted = false;

            Debug.Log($"[FashionVoting] Initialized with {Themes.Count} themes.");
        }

        /// <summary>
        /// Provides a default set of fashion themes if none are configured.
        /// </summary>
        private List<FashionTheme> GetDefaultThemes()
        {
            return new List<FashionTheme>
            {
                new FashionTheme
                {
                    ThemeId = "cute_pastel",
                    ThemeName = "Cute Pastel Dream",
                    Description = "Dress in soft pastel colors with cute accessories! Think kawaii and sweet.",
                    PreferredTags = new List<string> { "cute", "pastel", "kawaii", "sweet" }
                },
                new FashionTheme
                {
                    ThemeId = "elegant_royal",
                    ThemeName = "Royal Elegance",
                    Description = "Channel your inner royalty with elegant gowns and sophisticated accessories.",
                    PreferredTags = new List<string> { "elegant", "royal", "fancy", "classy" }
                },
                new FashionTheme
                {
                    ThemeId = "street_cool",
                    ThemeName = "Street Cool",
                    Description = "Urban street style with a cool edge. Hoodies, sneakers, and attitude!",
                    PreferredTags = new List<string> { "street", "cool", "urban", "casual" }
                },
                new FashionTheme
                {
                    ThemeId = "beach_summer",
                    ThemeName = "Summer Beach Vibes",
                    Description = "Beach-ready outfits perfect for a sunny day by the ocean!",
                    PreferredTags = new List<string> { "summer", "beach", "tropical", "casual" }
                },
                new FashionTheme
                {
                    ThemeId = "fantasy_magical",
                    ThemeName = "Magical Fantasy",
                    Description = "Enchanting outfits inspired by fantasy worlds and magical creatures.",
                    PreferredTags = new List<string> { "fantasy", "magical", "mystical", "enchanting" }
                }
            };
        }

        #endregion

        #region Playing State

        /// <summary>
        /// Called when entering the Playing state. Selects a theme and begins
        /// the dress-up phase.
        /// </summary>
        protected override void OnEnterPlaying()
        {
            base.OnEnterPlaying();

            SelectRandomTheme();
            _playerOutfits.Clear();
            _votes.Clear();
            _votesRemaining.Clear();
            _allOutfitsSubmitted = false;

            // Initialize votes remaining for all players
            foreach (var playerId in ParticipatingPlayers)
            {
                _votesRemaining[playerId] = VotesPerPlayer;
            }

            // Start with dress-up phase
            StartDressUpPhase();

            Debug.Log($"[FashionVoting] Playing started! Theme: {_currentTheme?.ThemeName}");
        }

        /// <summary>
        /// Called every frame during gameplay. Manages phase transitions.
        /// </summary>
        protected override void OnUpdatePlaying()
        {
            base.OnUpdatePlaying();

            _phaseTimer -= Time.deltaTime;

            // Update UI timer
            if (TimerText != null)
            {
                int seconds = Mathf.Max(0, Mathf.CeilToInt(_phaseTimer));
                TimerText.text = $"{_currentPhase}: {seconds}s";
            }

            // Phase-specific update logic
            switch (_currentPhase)
            {
                case FashionPhase.DressUp:
                    UpdateDressUpPhase();
                    break;
                case FashionPhase.Voting:
                    UpdateVotingPhase();
                    break;
                case FashionPhase.Results:
                    // Results phase waits for GameOver transition
                    break;
            }

            // Auto-advance phases when timer expires
            if (_phaseTimer <= 0f)
            {
                AdvancePhase();
            }
        }

        #endregion

        #region Dress Up Phase

        /// <summary>
        /// Starts the dress-up phase, allowing players to assemble their outfits.
        /// </summary>
        private void StartDressUpPhase()
        {
            _currentPhase = FashionPhase.DressUp;
            _phaseTimer = DressUpDuration;

            // Announce theme
            if (ThemeText != null && _currentTheme != null)
            {
                ThemeText.text = $"Theme: {_currentTheme.ThemeName}\n{_currentTheme.Description}";
            }

            if (PhaseText != null)
                PhaseText.text = "DRESS UP!";

            SetUIActive(VotingPanel, false);

            try
            {
                OnFashionPhaseChanged?.Invoke(_currentPhase);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[FashionVoting] OnFashionPhaseChanged event: {ex}");
            }

            Debug.Log("[FashionVoting] Dress-up phase started!");
        }

        /// <summary>
        /// Per-frame update during the dress-up phase.
        /// </summary>
        private void UpdateDressUpPhase()
        {
            // Check if all players have submitted outfits (early transition)
            if (!_allOutfitsSubmitted && ParticipatingPlayers.Count > 0)
            {
                bool allSubmitted = true;
                foreach (var playerId in ParticipatingPlayers)
                {
                    if (!_playerOutfits.ContainsKey(playerId))
                    {
                        allSubmitted = false;
                        break;
                    }
                }

                if (allSubmitted)
                {
                    _allOutfitsSubmitted = true;
                    // Reduce remaining time to 3 seconds for quick transition
                    _phaseTimer = Mathf.Min(_phaseTimer, 3f);
                    Debug.Log("[FashionVoting] All outfits submitted! Transitioning soon...");
                }
            }
        }

        #endregion

        #region Voting Phase

        /// <summary>
        /// Starts the voting phase, displaying all outfits for players to vote on.
        /// </summary>
        private void StartVotingPhase()
        {
            _currentPhase = FashionPhase.Voting;
            _phaseTimer = VotingDuration;

            if (PhaseText != null)
                PhaseText.text = "VOTE!";

            // Auto-submit empty outfits for players who didn't submit
            foreach (var playerId in ParticipatingPlayers)
            {
                if (!_playerOutfits.ContainsKey(playerId))
                {
                    _playerOutfits[playerId] = new PlayerOutfit
                    {
                        PlayerId = playerId,
                        PlayerName = PlayerScores.ContainsKey(playerId) ? PlayerScores[playerId].PlayerName : playerId
                    };
                }
            }

            // Calculate theme adherence scores
            foreach (var kvp in _playerOutfits)
            {
                kvp.Value.ThemeAdherenceScore = CalculateThemeAdherence(kvp.Value);
            }

            // Build voting UI
            BuildVotingUI();

            // Update votes remaining display
            UpdateVotesRemainingDisplay();

            try
            {
                OnFashionPhaseChanged?.Invoke(_currentPhase);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[FashionVoting] OnFashionPhaseChanged event: {ex}");
            }

            Debug.Log("[FashionVoting] Voting phase started!");
        }

        /// <summary>
        /// Per-frame update during the voting phase.
        /// </summary>
        private void UpdateVotingPhase()
        {
            // Check if all votes are cast
            bool allVotesCast = true;
            foreach (var playerId in ParticipatingPlayers)
            {
                if (_votesRemaining.ContainsKey(playerId) && _votesRemaining[playerId] > 0)
                {
                    allVotesCast = false;
                    break;
                }
            }

            if (allVotesCast && ParticipatingPlayers.Count > 0)
            {
                _phaseTimer = Mathf.Min(_phaseTimer, 2f);
            }
        }

        /// <summary>
        /// Builds the voting UI with all submitted outfits.
        /// </summary>
        private void BuildVotingUI()
        {
            if (VotingPanel == null || OutfitDisplayPrefab == null || OutfitDisplayContainer == null)
                return;

            // Clear existing entries
            foreach (Transform child in OutfitDisplayContainer)
            {
                Destroy(child.gameObject);
            }

            // Create an entry for each outfit
            foreach (var kvp in _playerOutfits)
            {
                PlayerOutfit outfit = kvp.Value;
                GameObject entry = Instantiate(OutfitDisplayPrefab, OutfitDisplayContainer);

                // Setup outfit display (names would match the prefab's child components)
                TMP_Text nameText = entry.GetComponentInChildren<TMP_Text>();
                if (nameText != null)
                    nameText.text = outfit.PlayerName;

                // TODO: Set outfit preview image, vote button callbacks, etc.
            }

            SetUIActive(VotingPanel, true);
        }

        #endregion

        #region Results Phase

        /// <summary>
        /// Calculates final results and transitions to the results phase.
        /// </summary>
        private void ShowResultsPhase()
        {
            _currentPhase = FashionPhase.Results;

            CalculateVotingResults();

            if (PhaseText != null)
                PhaseText.text = "RESULTS!";

            // Update scores
            foreach (var outfit in _results.RankedOutfits)
            {
                if (PlayerScores.ContainsKey(outfit.PlayerId))
                {
                    SetScore(outfit.PlayerId, outfit.FinalScore);

                    // Update stats
                    PlayerScores[outfit.PlayerId].Stats["theme_adherence"] = outfit.ThemeAdherenceScore;
                    PlayerScores[outfit.PlayerId].Stats["votes_received"] = outfit.VoteCount;
                }
            }

            try
            {
                OnFashionPhaseChanged?.Invoke(_currentPhase);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[FashionVoting] OnFashionPhaseChanged event: {ex}");
            }

            Debug.Log("[FashionVoting] Results phase started!");
        }

        #endregion

        #region Phase Advancement

        /// <summary>
        /// Advances the minigame to the next phase based on current state.
        /// </summary>
        private void AdvancePhase()
        {
            switch (_currentPhase)
            {
                case FashionPhase.DressUp:
                    StartVotingPhase();
                    break;
                case FashionPhase.Voting:
                    ShowResultsPhase();
                    // Transition to GameOver after showing results
                    EndMinigame();
                    break;
            }
        }

        #endregion

        #region Theme Selection

        /// <summary>
        /// Randomly selects a fashion theme from the available themes.
        /// </summary>
        private void SelectRandomTheme()
        {
            if (Themes == null || Themes.Count == 0)
            {
                Debug.LogError("[FashionVoting] Cannot select theme: no themes available!");
                _currentTheme = null;
                return;
            }

            int index = UnityEngine.Random.Range(0, Themes.Count);
            _currentTheme = Themes[index];

            try
            {
                OnThemeAnnounced?.Invoke(_currentTheme);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[FashionVoting] OnThemeAnnounced event: {ex}");
            }

            Debug.Log($"[FashionVoting] Selected theme: {_currentTheme.ThemeName}");
        }

        #endregion

        #region Outfit Submission

        /// <summary>
        /// Submits an outfit for a player. Called by the outfit selection UI.
        /// </summary>
        /// <param name="playerId">The player submitting the outfit.</param>
        /// <param name="outfit">Mapping of outfit slot names to equipped item IDs.</param>
        public void SubmitOutfit(string playerId, Dictionary<string, string> outfit)
        {
            if (_currentPhase != FashionPhase.DressUp)
            {
                Debug.LogWarning("[FashionVoting] Cannot submit outfit: not in dress-up phase!");
                return;
            }

            if (!ParticipatingPlayers.Contains(playerId))
            {
                Debug.LogWarning($"[FashionVoting] Cannot submit outfit: player {playerId} is not participating.");
                return;
            }

            string playerName = PlayerScores.ContainsKey(playerId) ? PlayerScores[playerId].PlayerName : playerId;

            _playerOutfits[playerId] = new PlayerOutfit
            {
                PlayerId = playerId,
                PlayerName = playerName,
                OutfitParts = outfit ?? new Dictionary<string, string>()
            };

            // Network sync
            RpcOutfitSubmitted(playerId);

            Debug.Log($"[FashionVoting] Outfit submitted by {playerName} with {outfit?.Count ?? 0} parts.");
        }

        #endregion

        #region Voting

        /// <summary>
        /// Casts a vote from one player to another's outfit.
        /// </summary>
        /// <param name="voterId">The player casting the vote.</param>
        /// <param name="targetId">The player whose outfit is being voted for.</param>
        public void CastVote(string voterId, string targetId)
        {
            if (_currentPhase != FashionPhase.Voting)
            {
                Debug.LogWarning("[FashionVoting] Cannot vote: not in voting phase!");
                return;
            }

            if (!ParticipatingPlayers.Contains(voterId))
            {
                Debug.LogWarning($"[FashionVoting] Voter {voterId} is not participating.");
                return;
            }

            if (!_playerOutfits.ContainsKey(targetId))
            {
                Debug.LogWarning($"[FashionVoting] Target {targetId} has no outfit to vote for.");
                return;
            }

            if (!AllowSelfVote && voterId == targetId)
            {
                Debug.LogWarning("[FashionVoting] Self-voting is not allowed!");
                return;
            }

            // Check if voter has votes remaining
            if (!_votesRemaining.ContainsKey(voterId) || _votesRemaining[voterId] <= 0)
            {
                Debug.LogWarning($"[FashionVoting] {voterId} has no votes remaining!");
                return;
            }

            // Record the vote
            if (!_votes.ContainsKey(targetId))
                _votes[targetId] = new List<string>();

            _votes[targetId].Add(voterId);
            _votesRemaining[voterId]--;

            // Update vote count on outfit
            _playerOutfits[targetId].VoteCount = _votes[targetId].Count;

            UpdateVotesRemainingDisplay();

            try
            {
                OnVoteCast?.Invoke(targetId);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[FashionVoting] OnVoteCast event: {ex}");
            }

            Debug.Log($"[FashionVoting] {voterId} voted for {targetId}. Remaining votes: {_votesRemaining[voterId]}");
        }

        /// <summary>
        /// Removes a previously cast vote.
        /// </summary>
        /// <param name="voterId">The player who originally cast the vote.</param>
        /// <param name="targetId">The target whose vote is being removed.</param>
        public void RemoveVote(string voterId, string targetId)
        {
            if (_currentPhase != FashionPhase.Voting)
                return;

            if (!_votes.ContainsKey(targetId))
                return;

            if (_votes[targetId].Remove(voterId))
            {
                _votesRemaining[voterId] = Mathf.Min(_votesRemaining[voterId] + 1, VotesPerPlayer);
                _playerOutfits[targetId].VoteCount = _votes[targetId].Count;
                UpdateVotesRemainingDisplay();

                Debug.Log($"[FashionVoting] Vote removed: {voterId} -> {targetId}");
            }
        }

        /// <summary>
        /// Updates the votes remaining UI display.
        /// </summary>
        private void UpdateVotesRemainingDisplay()
        {
            if (VotesRemainingText == null) return;

            // Show local player's remaining votes
            string localPlayerId = ParticipatingPlayers.Count > 0 ? ParticipatingPlayers[0] : "";
            if (!string.IsNullOrEmpty(localPlayerId) && _votesRemaining.ContainsKey(localPlayerId))
            {
                VotesRemainingText.text = $"Votes: {_votesRemaining[localPlayerId]}";
            }
        }

        #endregion

        #region Scoring

        /// <summary>
        /// Calculates the final results combining theme adherence and popular vote.
        /// </summary>
        private void CalculateVotingResults()
        {
            _results = new FashionResults
            {
                Theme = _currentTheme,
                ResultsTimestamp = Time.time
            };

            int maxVotes = 0;
            foreach (var kvp in _votes)
            {
                if (kvp.Value.Count > maxVotes)
                    maxVotes = kvp.Value.Count;
            }

            foreach (var kvp in _playerOutfits)
            {
                PlayerOutfit outfit = kvp.Value;

                // Normalize theme adherence (0-100)
                float normalizedTheme = outfit.ThemeAdherenceScore / (float)MaxThemeScore;

                // Normalize votes (0-1 based on highest vote count)
                float normalizedVotes = maxVotes > 0 ? outfit.VoteCount / (float)maxVotes : 0f;

                // Calculate final score
                outfit.FinalScore = Mathf.RoundToInt(
                    (normalizedTheme * ThemeAdherenceWeight +
                     normalizedVotes * PopularVoteWeight) * 1000f);

                _results.RankedOutfits.Add(outfit);
            }

            // Sort by final score descending
            _results.RankedOutfits = _results.RankedOutfits
                .OrderByDescending(o => o.FinalScore)
                .ToList();

            // Track votes cast
            foreach (var voterId in ParticipatingPlayers)
            {
                int votesUsed = VotesPerPlayer - (_votesRemaining.ContainsKey(voterId) ? _votesRemaining[voterId] : 0);
                _results.VotesCast[voterId] = votesUsed;
            }

            Debug.Log($"[FashionVoting] Results calculated. Winner: {_results.RankedOutfits.FirstOrDefault()?.PlayerName ?? "None"}");
        }

        /// <summary>
        /// Calculates how well a player's outfit matches the current theme.
        /// </summary>
        /// <param name="outfit">The player's outfit to evaluate.</param>
        /// <returns>Score from 0 to MaxThemeScore based on tag/item matching.</returns>
        private int CalculateThemeAdherence(PlayerOutfit outfit)
        {
            if (_currentTheme == null || outfit?.OutfitParts == null)
                return 0;

            int score = 0;
            int maxPossible = 0;

            // Score based on preferred tags (stub - would look up item tags from database)
            foreach (var part in outfit.OutfitParts)
            {
                maxPossible += 20;

                // TODO: Look up item data and check tags
                // For now, randomize for demonstration
                if (_currentTheme.PreferredTags != null && _currentTheme.PreferredTags.Count > 0)
                {
                    // In a real implementation, check item tags against theme tags
                    score += UnityEngine.Random.Range(10, 20);
                }

                // Check for bonus items
                if (_currentTheme.BonusItemIds != null && _currentTheme.BonusItemIds.Contains(part.Value))
                {
                    score += 30; // Bonus for exact theme items
                }
            }

            // Clamp to max
            return Mathf.Min(MaxThemeScore, Mathf.RoundToInt(maxPossible > 0 ? (score / (float)maxPossible) * MaxThemeScore : 0));
        }

        #endregion

        #region Reward Calculation

        /// <summary>
        /// Calculates rewards based on final rankings.
        /// </summary>
        protected override void CalculateRewards()
        {
            base.CalculateRewards();

            if (_results?.RankedOutfits == null) return;

            for (int i = 0; i < _results.RankedOutfits.Count; i++)
            {
                PlayerOutfit outfit = _results.RankedOutfits[i];
                int rank = i + 1;

                if (!PlayerScores.ContainsKey(outfit.PlayerId)) continue;

                PlayerScore ps = PlayerScores[outfit.PlayerId];

                // Rank-based rewards
                switch (rank)
                {
                    case 1:
                        ps.Rewards.Add(new RewardData { RewardType = "gems", RewardId = "gem_premium", Amount = 20 });
                        ps.Rewards.Add(new RewardData { RewardType = "item", RewardId = "fashion_winner_trophy", Amount = 1, Probability = 0.3f });
                        break;
                    case 2:
                        ps.Rewards.Add(new RewardData { RewardType = "gems", RewardId = "gem_standard", Amount = 10 });
                        break;
                    case 3:
                        ps.Rewards.Add(new RewardData { RewardType = "gems", RewardId = "gem_standard", Amount = 5 });
                        break;
                    default:
                        ps.Rewards.Add(new RewardData { RewardType = "coins", RewardId = "coins_participation", Amount = 50 });
                        break;
                }

                // Theme adherence bonus
                if (outfit.ThemeAdherenceScore >= 80)
                {
                    ps.Rewards.Add(new RewardData { RewardType = "xp", RewardId = "xp_fashion", Amount = 100 });
                }
            }
        }

        #endregion

        #region Network RPC Stubs

        /// <summary>
        /// Stub for network-synchronized outfit submission.
        /// </summary>
        protected virtual void RpcOutfitSubmitted(string playerId)
        {
            // Override in networked subclass for multiplayer sync
        }

        #endregion

        #region Public API

        /// <summary>
        /// Gets the currently selected fashion theme.
        /// </summary>
        public FashionTheme GetCurrentTheme() => _currentTheme;

        /// <summary>
        /// Gets the current phase of the fashion minigame.
        /// </summary>
        public FashionPhase GetCurrentPhase() => _currentPhase;

        /// <summary>
        /// Gets a player's submitted outfit.
        /// </summary>
        /// <param name="playerId">The player ID.</param>
        /// <returns>The player's outfit, or null if not submitted.</returns>
        public PlayerOutfit GetPlayerOutfit(string playerId)
        {
            return _playerOutfits.ContainsKey(playerId) ? _playerOutfits[playerId] : null;
        }

        /// <summary>
        /// Gets the number of remaining votes for a player.
        /// </summary>
        /// <param name="playerId">The player ID.</param>
        /// <returns>Votes remaining.</returns>
        public int GetVotesRemaining(string playerId)
        {
            return _votesRemaining.ContainsKey(playerId) ? _votesRemaining[playerId] : 0;
        }

        /// <summary>
        /// Gets the number of votes a player's outfit has received.
        /// </summary>
        /// <param name="playerId">The player ID.</param>
        /// <returns>Vote count.</returns>
        public int GetVoteCount(string playerId)
        {
            return _votes.ContainsKey(playerId) ? _votes[playerId].Count : 0;
        }

        /// <summary>
        /// Gets the final results of the fashion voting round.
        /// </summary>
        public FashionResults GetResults() => _results;

        #endregion
    }
}
