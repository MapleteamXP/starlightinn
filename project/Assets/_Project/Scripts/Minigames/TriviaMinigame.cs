using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using TMPro;

// ---------------------------------------------------------------------------
// KawaiiCool Island - Trivia Minigame
// ---------------------------------------------------------------------------
// A quiz/trivia game where players answer questions from a shuffled pool.
// Features timed answers, streak bonuses, time-based scoring, and
// multiple question categories with difficulty levels.
// ---------------------------------------------------------------------------

namespace KawaiiCool.Minigames
{
    /// <summary>
    /// Internal state of the trivia minigame during gameplay.
    /// </summary>
    public enum TriviaState
    {
        /// <summary>A new question is being presented to players.</summary>
        PresentingQuestion,

        /// <summary>Waiting for players to submit their answers.</summary>
        WaitingForAnswers,

        /// <summary>Revealing the correct answer and processing results.</summary>
        RevealingAnswer,

        /// <summary>Transition delay between questions.</summary>
        BetweenQuestions
    }

    /// <summary>
    /// Serializable data for a single trivia question.
    /// The first answer in the Answers list is always correct (shuffled at runtime).
    /// </summary>
    [Serializable]
    public class TriviaQuestion
    {
        [Tooltip("Unique identifier for this question.")]
        public string QuestionId;

        [Tooltip("Category of the question (e.g., 'Science', 'History', 'Pop Culture').")]
        public string Category;

        [Tooltip("Difficulty level: 'Easy', 'Medium', 'Hard'.")]
        public string Difficulty;

        [Tooltip("The question text displayed to players.")]
        public string QuestionText;

        [Tooltip("List of possible answers. Index 0 is always the correct answer.")]
        public List<string> Answers;

        [Tooltip("Explanation shown after the answer is revealed.")]
        public string CorrectAnswerExplanation;

        [Tooltip("Optional image to display with the question.")]
        public Sprite QuestionImage;
    }

    /// <summary>
    /// Records a single player's answer to a trivia question.
    /// </summary>
    [Serializable]
    public class PlayerAnswer
    {
        [Tooltip("Player who submitted the answer.")]
        public string PlayerId;

        [Tooltip("Index of the chosen answer (0-based).")]
        public int AnswerIndex;

        [Tooltip">Time (in seconds) taken to answer.</")]
        public float AnswerTime;

        [Tooltip("Whether the answer was correct.")]
        public bool IsCorrect;

        [Tooltip("Points earned for this answer.")]
        public int PointsEarned;
    }

    /// <summary>
    /// Trivia minigame controller. Presents shuffled questions to all players,
    /// accepts timed answers, calculates scores with time bonuses and streak
    /// multipliers, and displays results after each question.
    /// </summary>
    public class TriviaMinigame : MinigameController
    {
        #region Inspector Settings

        [Header("Questions")]
        [Tooltip("Pool of all available trivia questions.")]
        public List<TriviaQuestion> Questions = new();

        [Tooltip("Number of questions per game session.")]
        public int QuestionsPerGame = 10;

        [Tooltip("Time limit (in seconds) for players to answer each question.")]
        public float QuestionTimeLimit = 15f;

        [Tooltip("Delay (in seconds) between questions.")]
        public float BetweenQuestionDelay = 3f;

        [Tooltip("Delay (in seconds) to show the correct answer before moving on.")]
        public float AnswerRevealDuration = 3f;

        [Header("Scoring")]
        [Tooltip("Base points awarded for a correct answer.")]
        public int BasePoints = 100;

        [Tooltip("Additional points per second remaining when answered correctly.")]
        public float TimeBonusMultiplier = 10f;

        [Tooltip("Bonus points per consecutive correct answer streak.")]
        public int StreakBonus = 20;

        [Tooltip("Maximum streak bonus multiplier cap.")]
        public int MaxStreakBonus = 100;

        [Header("UI")]
        [Tooltip("Text displaying the current question.")]
        public TMP_Text QuestionText;

        [Tooltip("Array of text elements for the answer options (typically 4).")]
        public TMP_Text[] AnswerTexts;

        [Tooltip("Text displaying the current question number.")]
        public TMP_Text QuestionNumberText;

        [Tooltip("Image displaying the question image (if any).")]
        public UnityEngine.UI.Image QuestionImage;

        [Tooltip("Text displaying the correct answer explanation.")]
        public TMP_Text ExplanationText;

        [Tooltip("Panel shown during answer reveal.")]
        public GameObject AnswerRevealPanel;

        [Tooltip("Color for correct answer buttons.")]
        public Color CorrectAnswerColor = new Color(0.2f, 0.8f, 0.2f);

        [Tooltip("Color for incorrect answer buttons.")]
        public Color IncorrectAnswerColor = new Color(0.9f, 0.2f, 0.2f);

        [Tooltip("Color for default/unselected answer buttons.")]
        public Color DefaultAnswerColor = new Color(0.3f, 0.5f, 0.9f);

        [Header("Difficulty Modifiers")]
        [Tooltip("Score multiplier for Easy questions.")]
        public float EasyMultiplier = 1.0f;

        [Tooltip("Score multiplier for Medium questions.")]
        public float MediumMultiplier = 1.5f;

        [Tooltip("Score multiplier for Hard questions.")]
        public float HardMultiplier = 2.0f;

        #endregion

        #region Runtime State

        /// <summary>Shuffled subset of questions for this game session.</summary>
        private List<TriviaQuestion> _shuffledQuestions = new();

        /// <summary>Index of the current question being presented.</summary>
        private int _currentQuestionIndex;

        /// <summary>The currently active question.</summary>
        private TriviaQuestion _currentQuestion;

        /// <summary>Mapping of player ID to their answer for the current question.</summary>
        private Dictionary<string, PlayerAnswer> _currentAnswers = new();

        /// <summary>Current consecutive correct streak per player.</summary>
        private Dictionary<string, int> _playerStreaks = new();

        /// <summary>Time when the current question was presented.</summary>
        private float _questionStartTime;

        /// <summary>Current internal trivia state.</summary>
        private TriviaState _triviaState;

        /// <summary>Whether answers for the current question are shuffled.</summary>
        private bool _answersShuffled;

        /// <summary>Mapping from displayed answer index to original answer index.</summary>
        private int[] _answerShuffleMap;

        /// <summary>Total questions answered (for stats).</summary>
        private int _totalQuestionsAnswered;

        /// <summary>Total correct answers across all players.</summary>
        private int _totalCorrectAnswers;

        /// <summary>Coroutine managing the current question timer.</summary>
        private Coroutine _questionCoroutine;

        /// <summary>Number of answers for each question (typically 4).</summary>
        private const int ANSWER_COUNT = 4;

        #endregion

        #region Events

        /// <summary>
        /// Invoked when a new question is presented. Argument is the question data.
        /// </summary>
        public event Action<TriviaQuestion> OnQuestionPresented;

        /// <summary>
        /// Invoked when an answer is revealed. Arguments: playerId, wasCorrect, pointsEarned.
        /// </summary>
        public event Action<string, bool, int> OnAnswerRevealed;

        #endregion

        #region Initialization

        /// <summary>
        /// Called once after initialization. Validates question pool and sets up state.
        /// </summary>
        protected override void OnInitialized()
        {
            base.OnInitialized();

            // Add default questions if none provided
            if (Questions == null || Questions.Count == 0)
            {
                Questions = GetDefaultQuestions();
            }

            // Validate questions
            foreach (var q in Questions)
            {
                if (q.Answers == null || q.Answers.Count < 2)
                {
                    Debug.LogWarning($"[Trivia] Question '{q.QuestionId}' has fewer than 2 answers!");
                }
            }

            _currentQuestionIndex = 0;
            _totalQuestionsAnswered = 0;
            _totalCorrectAnswers = 0;
            _triviaState = TriviaState.PresentingQuestion;

            Debug.Log($"[Trivia] Initialized with {Questions.Count} questions.");
        }

        /// <summary>
        /// Provides a default set of trivia questions if none are configured.
        /// </summary>
        private List<TriviaQuestion> GetDefaultQuestions()
        {
            return new List<TriviaQuestion>
            {
                new TriviaQuestion
                {
                    QuestionId = "triv_001",
                    Category = "General",
                    Difficulty = "Easy",
                    QuestionText = "What is the capital of Japan?",
                    Answers = new List<string> { "Tokyo", "Osaka", "Kyoto", "Nagoya" },
                    CorrectAnswerExplanation = "Tokyo has been the capital of Japan since 1868."
                },
                new TriviaQuestion
                {
                    QuestionId = "triv_002",
                    Category = "Science",
                    Difficulty = "Easy",
                    QuestionText = "What planet is known as the Red Planet?",
                    Answers = new List<string> { "Mars", "Venus", "Jupiter", "Saturn" },
                    CorrectAnswerExplanation = "Mars appears red due to iron oxide (rust) on its surface."
                },
                new TriviaQuestion
                {
                    QuestionId = "triv_003",
                    Category = "Animals",
                    Difficulty = "Medium",
                    QuestionText = "What is the largest mammal in the world?",
                    Answers = new List<string> { "Blue Whale", "Elephant", "Giraffe", "Humpback Whale" },
                    CorrectAnswerExplanation = "The Blue Whale can grow up to 30 meters long!"
                },
                new TriviaQuestion
                {
                    QuestionId = "triv_004",
                    Category = "Geography",
                    Difficulty = "Easy",
                    QuestionText = "How many continents are there on Earth?",
                    Answers = new List<string> { "Seven", "Five", "Six", "Eight" },
                    CorrectAnswerExplanation = "The seven continents are: Asia, Africa, North America, South America, Antarctica, Europe, and Australia."
                },
                new TriviaQuestion
                {
                    QuestionId = "triv_005",
                    Category = "Science",
                    Difficulty = "Medium",
                    QuestionText = "What is the chemical symbol for gold?",
                    Answers = new List<string> { "Au", "Ag", "Fe", "Pb" },
                    CorrectAnswerExplanation = "Au comes from the Latin word 'aurum' meaning gold."
                },
                new TriviaQuestion
                {
                    QuestionId = "triv_006",
                    Category = "History",
                    Difficulty = "Hard",
                    QuestionText = "In which year did the Berlin Wall fall?",
                    Answers = new List<string> { "1989", "1987", "1991", "1985" },
                    CorrectAnswerExplanation = "The Berlin Wall fell on November 9, 1989."
                },
                new TriviaQuestion
                {
                    QuestionId = "triv_007",
                    Category = "Nature",
                    Difficulty = "Easy",
                    QuestionText = "What do bees collect from flowers to make honey?",
                    Answers = new List<string> { "Nectar", "Pollen", "Sap", "Dew" },
                    CorrectAnswerExplanation = "Bees collect nectar and convert it into honey through a process of regurgitation and evaporation."
                },
                new TriviaQuestion
                {
                    QuestionId = "triv_008",
                    Category = "Space",
                    Difficulty = "Medium",
                    QuestionText = "What is the hottest planet in our solar system?",
                    Answers = new List<string> { "Venus", "Mercury", "Mars", "Jupiter" },
                    CorrectAnswerExplanation = "Venus is hotter than Mercury due to its thick atmosphere trapping heat (greenhouse effect)."
                },
                new TriviaQuestion
                {
                    QuestionId = "triv_009",
                    Category = "Art",
                    Difficulty = "Medium",
                    QuestionText = "Who painted the Mona Lisa?",
                    Answers = new List<string> { "Leonardo da Vinci", "Michelangelo", "Raphael", "Donatello" },
                    CorrectAnswerExplanation = "Leonardo da Vinci painted the Mona Lisa between 1503 and 1519."
                },
                new TriviaQuestion
                {
                    QuestionId = "triv_010",
                    Category = "Music",
                    Difficulty = "Easy",
                    QuestionText = "How many letters are in the musical alphabet?",
                    Answers = new List<string> { "Seven", "Five", "Twelve", "Eight" },
                    CorrectAnswerExplanation = "The musical alphabet uses the letters A through G."
                }
            };
        }

        #endregion

        #region Playing State

        /// <summary>
        /// Called when entering the Playing state. Loads and shuffles questions,
        /// then presents the first question.
        /// </summary>
        protected override void OnEnterPlaying()
        {
            base.OnEnterPlaying();

            LoadQuestions();
            ShuffleQuestions();

            _currentQuestionIndex = 0;
            _totalQuestionsAnswered = 0;
            _totalCorrectAnswers = 0;
            _playerStreaks.Clear();

            // Initialize streaks for all players
            foreach (var playerId in ParticipatingPlayers)
            {
                _playerStreaks[playerId] = 0;
            }

            // Present first question after a short delay
            _questionCoroutine = StartCoroutine(QuestionFlowCoroutine());

            Debug.Log("[Trivia] Gameplay started! First question coming up...");
        }

        /// <summary>
        /// Called every frame during gameplay. Updates trivia-specific UI.
        /// </summary>
        protected override void OnUpdatePlaying()
        {
            base.OnUpdatePlaying();

            // Update timer display during WaitingForAnswers state
            if (_triviaState == TriviaState.WaitingForAnswers)
            {
                float timeRemaining = GetQuestionTimeRemaining();
                if (TimerText != null)
                {
                    int seconds = Mathf.Max(0, Mathf.CeilToInt(timeRemaining));
                    TimerText.text = $"Time: {seconds}s";
                }

                // Check for time up
                if (timeRemaining <= 0f)
                {
                    ProcessAnswers();
                }
            }
        }

        #endregion

        #region Question Flow Coroutine

        /// <summary>
        /// Main coroutine managing the question-answer-reveal cycle.
        /// Runs until all questions are exhausted.
        /// </summary>
        private IEnumerator QuestionFlowCoroutine()
        {
            while (_currentQuestionIndex < _shuffledQuestions.Count)
            {
                // Present question
                PresentQuestion();
                _triviaState = TriviaState.WaitingForAnswers;

                // Wait for answers or time limit
                float waitTime = QuestionTimeLimit;
                while (waitTime > 0f && _triviaState == TriviaState.WaitingForAnswers)
                {
                    waitTime -= Time.deltaTime;

                    // Check if all players have answered
                    if (AllPlayersAnswered())
                    {
                        yield return new WaitForSeconds(0.5f);
                        break;
                    }

                    yield return null;
                }

                // Process answers
                _triviaState = TriviaState.RevealingAnswer;
                ProcessAnswers();

                // Show answer reveal
                yield return new WaitForSeconds(AnswerRevealDuration);

                // Between question delay
                _triviaState = TriviaState.BetweenQuestions;
                yield return new WaitForSeconds(BetweenQuestionDelay);

                // Cleanup for next question
                ClearAnswerReveal();
                _currentQuestionIndex++;
            }

            // All questions done — transition to game over
            Debug.Log("[Trivia] All questions answered!");
            EndMinigame();
        }

        #endregion

        #region Question Loading & Shuffling

        /// <summary>
        /// Loads and validates the question pool.
        /// </summary>
        private void LoadQuestions()
        {
            if (Questions == null || Questions.Count == 0)
            {
                Debug.LogError("[Trivia] No questions available!");
                return;
            }

            // Clamp questions per game to available questions
            int count = Mathf.Min(QuestionsPerGame, Questions.Count);
            _shuffledQuestions = new List<TriviaQuestion>(count);

            Debug.Log($"[Trivia] Loaded {Questions.Count} questions, using {count} per game.");
        }

        /// <summary>
        /// Shuffles the question pool and selects a subset for this game session.
        /// Also shuffles answer order for each question.
        /// </summary>
        private void ShuffleQuestions()
        {
            // Fisher-Yates shuffle the question pool
            List<TriviaQuestion> pool = new List<TriviaQuestion>(Questions);
            System.Random rng = new System.Random();

            for (int i = pool.Count - 1; i > 0; i--)
            {
                int j = rng.Next(i + 1);
                (pool[i], pool[j]) = (pool[j], pool[i]);
            }

            // Take the first N questions
            int count = Mathf.Min(QuestionsPerGame, pool.Count);
            _shuffledQuestions = pool.Take(count).ToList();
        }

        #endregion

        #region Question Presentation

        /// <summary>
        /// Presents the current question to all players. Shuffles answer order
        /// and updates all UI elements.
        /// </summary>
        private void PresentQuestion()
        {
            if (_currentQuestionIndex >= _shuffledQuestions.Count) return;

            _currentQuestion = _shuffledQuestions[_currentQuestionIndex];
            _currentAnswers.Clear();
            _questionStartTime = Time.time;
            _answersShuffled = false;

            // Update question number display
            if (QuestionNumberText != null)
                QuestionNumberText.text = $"Question {_currentQuestionIndex + 1} of {_shuffledQuestions.Count}";

            // Update question text
            if (QuestionText != null)
                QuestionText.text = _currentQuestion.QuestionText;

            // Update question image if available
            if (QuestionImage != null)
            {
                if (_currentQuestion.QuestionImage != null)
                {
                    QuestionImage.sprite = _currentQuestion.QuestionImage;
                    QuestionImage.gameObject.SetActive(true);
                }
                else
                {
                    QuestionImage.gameObject.SetActive(false);
                }
            }

            // Shuffle and display answers
            ShuffleAndDisplayAnswers();

            // Hide answer reveal panel
            if (AnswerRevealPanel != null)
                AnswerRevealPanel.SetActive(false);

            // Reset answer button colors
            ResetAnswerButtonColors();

            Debug.Log($"[Trivia] Q{_currentQuestionIndex + 1}: {_currentQuestion.QuestionText}");

            try
            {
                OnQuestionPresented?.Invoke(_currentQuestion);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[Trivia] OnQuestionPresented event: {ex}");
            }
        }

        /// <summary>
        /// Shuffles the answer order and updates the answer UI texts.
        /// Creates a mapping from displayed index to original correct index.
        /// </summary>
        private void ShuffleAndDisplayAnswers()
        {
            if (_currentQuestion?.Answers == null) return;

            int answerCount = Mathf.Min(_currentQuestion.Answers.Count, AnswerTexts.Length);
            _answerShuffleMap = new int[answerCount];

            // Create index array and shuffle
            List<int> indices = Enumerable.Range(0, answerCount).ToList();
            System.Random rng = new System.Random();
            for (int i = indices.Count - 1; i > 0; i--)
            {
                int j = rng.Next(i + 1);
                (indices[i], indices[j]) = (indices[j], indices[i]);
            }

            // Apply shuffled order
            for (int i = 0; i < answerCount; i++)
            {
                _answerShuffleMap[i] = indices[i];
                if (AnswerTexts[i] != null)
                {
                    AnswerTexts[i].text = _currentQuestion.Answers[indices[i]];
                    AnswerTexts[i].gameObject.SetActive(true);
                }
            }

            // Hide unused answer slots
            for (int i = answerCount; i < AnswerTexts.Length; i++)
            {
                if (AnswerTexts[i] != null)
                    AnswerTexts[i].gameObject.SetActive(false);
            }

            _answersShuffled = true;
        }

        #endregion

        #region Answer Submission

        /// <summary>
        /// Submits an answer for a player. Called by the answer selection UI.
        /// </summary>
        /// <param name="playerId">The answering player.</param>
        /// <param name="answerIndex">Index of the selected answer (displayed order).</param>
        public void SubmitAnswer(string playerId, int answerIndex)
        {
            if (_triviaState != TriviaState.WaitingForAnswers)
            {
                Debug.LogWarning("[Trivia] Cannot submit answer: not accepting answers!");
                return;
            }

            if (_currentAnswers.ContainsKey(playerId))
            {
                Debug.LogWarning($"[Trivia] {playerId} already answered!");
                return;
            }

            if (!_answersShuffled || answerIndex < 0 || answerIndex >= _answerShuffleMap.Length)
            {
                Debug.LogWarning($"[Trivia] Invalid answer index: {answerIndex}");
                return;
            }

            float answerTime = Time.time - _questionStartTime;
            int originalIndex = _answerShuffleMap[answerIndex];

            _currentAnswers[playerId] = new PlayerAnswer
            {
                PlayerId = playerId,
                AnswerIndex = originalIndex,
                AnswerTime = answerTime,
                IsCorrect = originalIndex == 0, // Index 0 is always correct
                PointsEarned = 0 // Calculated later
            };

            Debug.Log($"[Trivia] {playerId} answered option {answerIndex} (original: {originalIndex}) in {answerTime:F2}s");

            // If all players answered early, we can move to reveal
            if (AllPlayersAnswered())
            {
                Debug.Log("[Trivia] All players answered!");
            }
        }

        /// <summary>
        /// Checks if all participating players have submitted an answer.
        /// </summary>
        private bool AllPlayersAnswered()
        {
            if (ParticipatingPlayers.Count == 0) return false;

            foreach (var playerId in ParticipatingPlayers)
            {
                if (!_currentAnswers.ContainsKey(playerId))
                    return false;
            }
            return true;
        }

        #endregion

        #region Answer Processing

        /// <summary>
        /// Processes all submitted answers, calculates scores, and reveals
        /// the correct answer. Also handles players who didn't answer in time.
        /// </summary>
        private void ProcessAnswers()
        {
            // Process players who didn't answer (treat as incorrect)
            foreach (var playerId in ParticipatingPlayers)
            {
                if (!_currentAnswers.ContainsKey(playerId))
                {
                    _currentAnswers[playerId] = new PlayerAnswer
                    {
                        PlayerId = playerId,
                        AnswerIndex = -1,
                        AnswerTime = QuestionTimeLimit,
                        IsCorrect = false,
                        PointsEarned = 0
                    };
                }
            }

            CalculateQuestionScores();
            ShowCorrectAnswer();

            _totalQuestionsAnswered++;
        }

        /// <summary>
        /// Calculates scores for all answers to the current question based on
        /// correctness, time bonus, streak bonus, and difficulty multiplier.
        /// </summary>
        private void CalculateQuestionScores()
        {
            // Get difficulty multiplier
            float difficultyMultiplier = _currentQuestion?.Difficulty?.ToLower() switch
            {
                "easy" => EasyMultiplier,
                "medium" => MediumMultiplier,
                "hard" => HardMultiplier,
                _ => 1f
            };

            foreach (var kvp in _currentAnswers)
            {
                PlayerAnswer answer = kvp.Value;

                if (answer.IsCorrect)
                {
                    // Time bonus: faster answer = more points
                    float timeRemaining = QuestionTimeLimit - answer.AnswerTime;
                    int timeBonus = Mathf.RoundToInt(Mathf.Max(0f, timeRemaining) * TimeBonusMultiplier);

                    // Streak bonus
                    if (!_playerStreaks.ContainsKey(answer.PlayerId))
                        _playerStreaks[answer.PlayerId] = 0;

                    _playerStreaks[answer.PlayerId]++;
                    int streak = _playerStreaks[answer.PlayerId];
                    int streakBonus = Mathf.Min(streak * StreakBonus, MaxStreakBonus);

                    // Final score
                    answer.PointsEarned = Mathf.RoundToInt(
                        (BasePoints + timeBonus + streakBonus) * difficultyMultiplier);

                    // Award points
                    AddScore(answer.PlayerId, answer.PointsEarned);
                    _totalCorrectAnswers++;

                    // Update stats
                    if (PlayerScores.ContainsKey(answer.PlayerId))
                    {
                        PlayerScore ps = PlayerScores[answer.PlayerId];
                        if (!ps.Stats.ContainsKey("correct_answers"))
                            ps.Stats["correct_answers"] = 0;
                        ps.Stats["correct_answers"]++;
                        ps.Combo = streak;
                        if (streak > ps.MaxCombo)
                            ps.MaxCombo = streak;
                    }
                }
                else
                {
                    // Wrong answer — reset streak
                    _playerStreaks[answer.PlayerId] = 0;

                    if (PlayerScores.ContainsKey(answer.PlayerId))
                        PlayerScores[answer.PlayerId].Combo = 0;
                }

                try
                {
                    OnAnswerRevealed?.Invoke(answer.PlayerId, answer.IsCorrect, answer.PointsEarned);
                }
                catch (Exception ex)
                {
                    Debug.LogError($"[Trivia] OnAnswerRevealed event: {ex}");
                }
            }
        }

        /// <summary>
        /// Shows the correct answer on screen with visual feedback.
        /// </summary>
        private void ShowCorrectAnswer()
        {
            if (AnswerRevealPanel != null)
                AnswerRevealPanel.SetActive(true);

            // Highlight correct and incorrect answer buttons
            for (int i = 0; i < _answerShuffleMap.Length; i++)
            {
                if (_answerShuffleMap[i] == 0) // This is the correct answer
                {
                    SetAnswerButtonColor(i, CorrectAnswerColor);
                }
                else if (AnswerTexts[i] != null)
                {
                    SetAnswerButtonColor(i, IncorrectAnswerColor);
                }
            }

            // Show explanation
            if (ExplanationText != null && _currentQuestion != null)
            {
                ExplanationText.text = _currentQuestion.CorrectAnswerExplanation;
                ExplanationText.gameObject.SetActive(true);
            }
        }

        /// <summary>
        /// Clears the answer reveal UI for the next question.
        /// </summary>
        private void ClearAnswerReveal()
        {
            if (AnswerRevealPanel != null)
                AnswerRevealPanel.SetActive(false);

            if (ExplanationText != null)
                ExplanationText.gameObject.SetActive(false);

            ResetAnswerButtonColors();
        }

        #endregion

        #region UI Helpers

        /// <summary>
        /// Sets the color of an answer button by index.
        /// </summary>
        private void SetAnswerButtonColor(int index, Color color)
        {
            if (index < 0 || index >= AnswerTexts.Length) return;

            UnityEngine.UI.Button button = AnswerTexts[index]?.GetComponentInParent<UnityEngine.UI.Button>();
            if (button != null)
            {
                UnityEngine.UI.Image btnImage = button.GetComponent<UnityEngine.UI.Image>();
                if (btnImage != null)
                    btnImage.color = color;
            }
        }

        /// <summary>
        /// Resets all answer button colors to default.
        /// </summary>
        private void ResetAnswerButtonColors()
        {
            for (int i = 0; i < AnswerTexts.Length; i++)
            {
                SetAnswerButtonColor(i, DefaultAnswerColor);
            }
        }

        #endregion

        #region Public API

        /// <summary>
        /// Gets the currently active question.
        /// </summary>
        /// <returns>The current TriviaQuestion, or null if none active.</returns>
        public TriviaQuestion GetCurrentQuestion() => _currentQuestion;

        /// <summary>
        /// Gets the remaining time for the current question.
        /// </summary>
        /// <returns>Seconds remaining, or 0 if time is up.</returns>
        public float GetQuestionTimeRemaining()
        {
            if (_triviaState != TriviaState.WaitingForAnswers) return 0f;
            return Mathf.Max(0f, QuestionTimeLimit - (Time.time - _questionStartTime));
        }

        /// <summary>
        /// Gets the current internal trivia state.
        /// </summary>
        public TriviaState GetTriviaState() => _triviaState;

        /// <summary>
        /// Gets the current question number (1-based).
        /// </summary>
        public int GetCurrentQuestionNumber() => _currentQuestionIndex + 1;

        /// <summary>
        /// Gets the total number of questions in this session.
        /// </summary>
        public int GetTotalQuestions() => _shuffledQuestions.Count;

        /// <summary>
        /// Gets the current streak for a player.
        /// </summary>
        /// <param name="playerId">The player ID.</param>
        /// <returns>Current correct answer streak.</returns>
        public int GetPlayerStreak(string playerId)
        {
            return _playerStreaks.ContainsKey(playerId) ? _playerStreaks[playerId] : 0;
        }

        /// <summary>
        /// Gets overall accuracy percentage for the session.
        /// </summary>
        public float GetOverallAccuracy()
        {
            if (_totalQuestionsAnswered == 0) return 0f;
            int totalAnswers = ParticipatingPlayers.Count * _totalQuestionsAnswered;
            return totalAnswers > 0 ? (_totalCorrectAnswers / (float)totalAnswers) * 100f : 0f;
        }

        /// <summary>
        /// Checks if a player has answered the current question.
        /// </summary>
        public bool HasPlayerAnswered(string playerId)
        {
            return _currentAnswers.ContainsKey(playerId);
        }

        #endregion

        #region Reward Calculation

        /// <summary>
        /// Calculates rewards based on accuracy and streak performance.
        /// </summary>
        protected override void CalculateRewards()
        {
            base.CalculateRewards();

            foreach (var kvp in PlayerScores)
            {
                PlayerScore ps = kvp.Value;

                int correctAnswers = ps.Stats.ContainsKey("correct_answers") ? ps.Stats["correct_answers"] : 0;
                int totalAnswered = _shuffledQuestions.Count;
                float accuracy = totalAnswered > 0 ? correctAnswers / (float)totalAnswered : 0f;

                // Perfect game bonus
                if (accuracy >= 1.0f && totalAnswered >= 5)
                {
                    ps.Rewards.Add(new RewardData { RewardType = "gems", RewardId = "gem_perfect", Amount = 25 });
                    ps.Rewards.Add(new RewardData { RewardType = "item", RewardId = "trivia_master_badge", Amount = 1 });
                }
                // High accuracy bonus
                else if (accuracy >= 0.8f)
                {
                    ps.Rewards.Add(new RewardData { RewardType = "gems", RewardId = "gem_standard", Amount = 10 });
                }
                // Participation reward
                else
                {
                    ps.Rewards.Add(new RewardData { RewardType = "coins", RewardId = "coins_participation", Amount = 30 });
                }

                // Streak reward
                if (ps.MaxCombo >= 5)
                {
                    ps.Rewards.Add(new RewardData { RewardType = "xp", RewardId = "xp_streak", Amount = ps.MaxCombo * 10 });
                }
            }
        }

        #endregion

        #region Cleanup

        /// <summary>
        /// Called when returning to Inactive state. Stops question coroutine
        /// and resets all trivia state.
        /// </summary>
        protected override void OnEnterInactive()
        {
            base.OnEnterInactive();

            if (_questionCoroutine != null)
            {
                StopCoroutine(_questionCoroutine);
                _questionCoroutine = null;
            }

            _currentQuestion = null;
            _currentAnswers.Clear();
            _playerStreaks.Clear();
            _shuffledQuestions.Clear();
            _currentQuestionIndex = 0;
            _totalQuestionsAnswered = 0;
            _totalCorrectAnswers = 0;
            _triviaState = TriviaState.PresentingQuestion;

            Debug.Log("[Trivia] Cleaned up and returned to inactive.");
        }

        #endregion
    }
}
