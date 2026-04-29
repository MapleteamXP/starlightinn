using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using UnityEngine;

namespace KawaiiCool.Safety
{
    /// <summary>
    /// Comprehensive result of a single spam analysis pass, including scoring and recommended moderation.
    /// </summary>
    [Serializable]
    public class SpamCheckResult
    {
        /// <summary>
        /// Whether the message was classified as spam.
        /// </summary>
        public bool IsSpam;

        /// <summary>
        /// Normalised spam confidence score from 0.0 (clean) to 1.0 (definite spam).
        /// </summary>
        public float SpamScore;

        /// <summary>
        /// Human-readable category of the primary violation (e.g. "identical_repeat", "rapid_fire").
        /// </summary>
        public string ViolationType;

        /// <summary>
        /// A UI-safe warning message that can be shown to the sender.
        /// </summary>
        public string WarningMessage;

        /// <summary>
        /// Whether the player should be automatically muted based on this violation.
        /// </summary>
        public bool ShouldMute;

        /// <summary>
        /// Recommended automatic mute duration in seconds.
        /// </summary>
        public float SuggestedMuteDuration;

        /// <summary>
        /// Individual detection flags for telemetry and fine-grained logging.
        /// </summary>
        public SpamDetectionFlags Flags;
    }

    /// <summary>
    /// Bitmask of individual spam detection signals.
    /// </summary>
    [Flags]
    public enum SpamDetectionFlags
    {
        None = 0,
        IdenticalRepeat = 1 << 0,
        RapidFire = 1 << 1,
        CharacterRepeat = 1 << 2,
        ExcessiveCaps = 1 << 3,
        ExcessivePunctuation = 1 << 4,
        RepeatedWhitespace = 1 << 5,
        SuspiciousPatterns = 1 << 6,
        LengthAnomaly = 1 << 7,
        KnownSpamPhrase = 1 << 8
    }

    /// <summary>
    /// Internal record of a player's chat message for historical analysis.
    /// </summary>
    [Serializable]
    internal class ChatMessageRecord
    {
        public string Message;
        public float Timestamp;
        public float SpamScore;
    }

    /// <summary>
    /// Client-side fast spam detector with multiple heuristics.
    /// Server-side authoritative validation is performed via <see cref="ServerValidator" />.
    /// </summary>
    public class SpamDetector : Singleton<SpamDetector>
    {
        #region Inspector Settings

        [Header("Detection Thresholds")]
        [Tooltip("How many identical messages within the window before flagging as spam.")]
        public int IdenticalMessageThreshold = 3;

        [Tooltip("Seconds to look back when counting identical messages.")]
        public float IdenticalMessageWindow = 30f;

        [Tooltip("How many total messages within the window before flagging rapid-fire spam.")]
        public int RapidMessageThreshold = 5;

        [Tooltip("Seconds to look back when counting rapid-fire messages.")]
        public float RapidMessageWindow = 10f;

        [Tooltip("How many repeated identical characters in a row triggers the repeat heuristic.")]
        public int CharacterRepeatThreshold = 15;

        [Tooltip("Ratio of uppercase characters above which a message is flagged for excessive caps.")]
        [Range(0f, 1f)]
        public float CapsRatioThreshold = 0.8f;

        [Tooltip("Minimum message length before caps/whitespace checks are applied.")]
        public int MinMessageLengthForCheck = 5;

        [Tooltip("Maximum allowed length for a single chat message.")]
        public int MaxMessageLength = 500;

        [Tooltip("Number of excessive punctuation marks that triggers the heuristic.")]
        public int ExcessivePunctuationThreshold = 8;

        [Tooltip("Number of consecutive whitespace characters that triggers the heuristic.")]
        public int RepeatedWhitespaceThreshold = 5;

        [Header("Scoring")]
        [Tooltip("Spam score at or above which a message is considered spam.")]
        [Range(0f, 1f)]
        public float SpamScoreThreshold = 0.65f;

        [Tooltip("Spam score at or above which an automatic mute is recommended.")]
        [Range(0f, 1f)]
        public float AutoMuteScoreThreshold = 0.85f;

        [Tooltip("Base automatic mute duration in seconds for severe violations.")]
        public float AutoMuteDurationSeconds = 120f;

        [Tooltip("Score increment per identical repeat violation.")]
        public float IdenticalRepeatWeight = 0.35f;

        [Tooltip("Score increment per rapid-fire violation.")]
        public float RapidFireWeight = 0.30f;

        [Tooltip("Score increment for character repeat violations.")]
        public float CharacterRepeatWeight = 0.20f;

        [Tooltip("Score increment for excessive caps.")]
        public float CapsWeight = 0.15f;

        [Tooltip("Score increment for excessive punctuation.")]
        public float PunctuationWeight = 0.15f;

        [Tooltip("Score increment for repeated whitespace.")]
        public float WhitespaceWeight = 0.10f;

        [Header("Lists")]
        [Tooltip("Known spam/phishing phrases that trigger an immediate high score.")]
        public List<string> KnownSpamPhrases = new List<string>
        {
            "free robux",
            "free gems",
            "click here",
            "free coins",
            "visit this site",
            "get free"
        };

        [Tooltip("If true, spam detection events are published to EventBus.")]
        public bool PublishEvents = true;

        [Tooltip("If true, spam detection decisions are logged to the console.")]
        public bool DebugLogging = false;

        #endregion

        #region Internal State

        /// <summary>
        /// Per-player message history used for sliding-window analysis.
        /// </summary>
        private Dictionary<string, List<ChatMessageRecord>> _playerMessageHistory = new Dictionary<string, List<ChatMessageRecord>>();

        /// <summary>
        /// Thread-safety lock for the history dictionary.
        /// </summary>
        private readonly object _lock = new object();

        /// <summary>
        /// Regex for detecting repeated punctuation characters.
        /// </summary>
        private static readonly Regex PunctuationRegex = new Regex(@"[!?\.]{4,}", RegexOptions.Compiled);

        /// <summary>
        /// Regex for detecting repeated whitespace.
        /// </summary>
        private static readonly Regex WhitespaceRegex = new Regex(@"\s{4,}", RegexOptions.Compiled);

        #endregion

        #region Events

        /// <summary>
        /// Fired whenever a message is classified as spam.
        /// Parameters: playerId, <see cref="SpamCheckResult"/>.
        /// </summary>
        public event Action<string, SpamCheckResult> OnSpamDetected;

        #endregion

        #region Public API

        /// <summary>
        /// Analyses a chat message for spam indicators and returns a detailed result.
        /// </summary>
        /// <param name="playerId">The sender's authenticated player identifier.</param>
        /// <param name="message">The raw chat message text.</param>
        /// <returns>A <see cref="SpamCheckResult"/> with scoring and moderation recommendations.</returns>
        public SpamCheckResult CheckMessage(string playerId, string message)
        {
            if (string.IsNullOrEmpty(playerId))
            {
                return new SpamCheckResult
                {
                    IsSpam = true,
                    SpamScore = 1f,
                    ViolationType = "invalid_sender",
                    WarningMessage = "Message could not be sent.",
                    ShouldMute = false,
                    SuggestedMuteDuration = 0f,
                    Flags = SpamDetectionFlags.SuspiciousPatterns
                };
            }

            if (string.IsNullOrWhiteSpace(message))
            {
                return new SpamCheckResult
                {
                    IsSpam = false,
                    SpamScore = 0f,
                    ViolationType = "empty_message",
                    WarningMessage = "Message is empty.",
                    ShouldMute = false,
                    SuggestedMuteDuration = 0f,
                    Flags = SpamDetectionFlags.None
                };
            }

            if (message.Length > MaxMessageLength)
            {
                return new SpamCheckResult
                {
                    IsSpam = true,
                    SpamScore = 0.75f,
                    ViolationType = "length_anomaly",
                    WarningMessage = $"Message exceeds maximum length of {MaxMessageLength} characters.",
                    ShouldMute = false,
                    SuggestedMuteDuration = 0f,
                    Flags = SpamDetectionFlags.LengthAnomaly
                };
            }

            lock (_lock)
            {
                float score = CalculateSpamScore(playerId, message);
                var flags = EvaluateFlags(playerId, message);
                bool isSpam = score >= SpamScoreThreshold;
                bool shouldMute = score >= AutoMuteScoreThreshold;

                string violation = DerivePrimaryViolation(flags);
                string warning = BuildWarningMessage(flags, score);

                var result = new SpamCheckResult
                {
                    IsSpam = isSpam,
                    SpamScore = Mathf.Clamp01(score),
                    ViolationType = violation,
                    WarningMessage = warning,
                    ShouldMute = shouldMute,
                    SuggestedMuteDuration = shouldMute ? AutoMuteDurationSeconds : 0f,
                    Flags = flags
                };

                if (isSpam)
                {
                    OnSpamDetected?.Invoke(playerId, result);

                    if (PublishEvents)
                    {
                        EventBus.Publish(new SpamDetectedEvent(playerId, message, result));
                    }

                    if (DebugLogging)
                    {
                        Debug.LogWarning($"[SpamDetector] Spam detected from {playerId}: " +
                                         $"score={score:F2}, violation={violation}, message='{message.Substring(0, Mathf.Min(40, message.Length))}...'");
                    }
                }

                return result;
            }
        }

        /// <summary>
        /// Convenience shorthand that returns <c>true</c> if the message is spam.
        /// </summary>
        /// <param name="playerId">The sender's player identifier.</param>
        /// <param name="message">The message text.</param>
        /// <returns><c>true</c> if classified as spam.</returns>
        public bool IsSpam(string playerId, string message)
        {
            return CheckMessage(playerId, message).IsSpam;
        }

        /// <summary>
        /// Stores a message in the player's history for future sliding-window checks.
        /// Call this <em>after</em> the message has passed (or failed) spam detection.
        /// </summary>
        /// <param name="playerId">The sender's player identifier.</param>
        /// <param name="message">The message text.</param>
        public void RecordMessage(string playerId, string message)
        {
            if (string.IsNullOrEmpty(playerId) || string.IsNullOrWhiteSpace(message)) return;

            lock (_lock)
            {
                if (!_playerMessageHistory.TryGetValue(playerId, out var history))
                {
                    history = new List<ChatMessageRecord>();
                    _playerMessageHistory[playerId] = history;
                }

                float now = Time.realtimeSinceStartup;

                // Preemptive cleanup of stale entries to cap memory.
                float oldestAllowed = now - Mathf.Max(IdenticalMessageWindow, RapidMessageWindow) * 2f;
                history.RemoveAll(r => r.Timestamp < oldestAllowed);

                history.Add(new ChatMessageRecord
                {
                    Message = message,
                    Timestamp = now,
                    SpamScore = 0f // updated later if CheckMessage is used
                });
            }
        }

        /// <summary>
        /// Clears all stored message history for a specific player (e.g. after logout or ban).
        /// </summary>
        /// <param name="playerId">The player identifier.</param>
        public void ClearHistory(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return;

            lock (_lock)
            {
                _playerMessageHistory.Remove(playerId);
            }

            if (DebugLogging)
                Debug.Log($"[SpamDetector] History cleared for player {playerId}");
        }

        /// <summary>
        /// Clears all stored message history globally.
        /// </summary>
        public void ClearAllHistory()
        {
            lock (_lock)
            {
                _playerMessageHistory.Clear();
            }

            if (DebugLogging)
                Debug.Log("[SpamDetector] All player histories cleared.");
        }

        #endregion

        #region Detection Heuristics

        /// <summary>
        /// Checks whether the player has sent the same message too many times recently.
        /// </summary>
        private bool IsIdenticalSpam(string playerId, string message)
        {
            if (!_playerMessageHistory.TryGetValue(playerId, out var history)) return false;

            float now = Time.realtimeSinceStartup;
            string normalised = NormaliseMessage(message);

            int identicalCount = history.Count(r =>
                now - r.Timestamp <= IdenticalMessageWindow &&
                NormaliseMessage(r.Message) == normalised);

            return identicalCount >= IdenticalMessageThreshold - 1; // -1 because current message not yet recorded
        }

        /// <summary>
        /// Checks whether the player is sending messages faster than the rapid-fire threshold.
        /// </summary>
        private bool IsRapidSpam(string playerId)
        {
            if (!_playerMessageHistory.TryGetValue(playerId, out var history)) return false;

            float now = Time.realtimeSinceStartup;
            int count = history.Count(r => now - r.Timestamp <= RapidMessageWindow);
            return count >= RapidMessageThreshold - 1;
        }

        /// <summary>
        /// Checks for excessive repeated single characters (e.g. "aaaaaaaaaaaaaaa").
        /// </summary>
        private bool HasCharacterRepeat(string message)
        {
            if (message.Length < CharacterRepeatThreshold) return false;

            int run = 1;
            for (int i = 1; i < message.Length; i++)
            {
                if (message[i] == message[i - 1])
                {
                    run++;
                    if (run >= CharacterRepeatThreshold) return true;
                }
                else
                {
                    run = 1;
                }
            }
            return false;
        }

        /// <summary>
        /// Checks whether the message is predominantly uppercase.
        /// </summary>
        private bool IsAllCaps(string message)
        {
            if (message.Length < MinMessageLengthForCheck) return false;

            int upperCount = 0;
            int letterCount = 0;

            foreach (char c in message)
            {
                if (char.IsLetter(c))
                {
                    letterCount++;
                    if (char.IsUpper(c)) upperCount++;
                }
            }

            if (letterCount < MinMessageLengthForCheck) return false;
            return (float)upperCount / letterCount >= CapsRatioThreshold;
        }

        /// <summary>
        /// Checks for excessive punctuation clustering.
        /// </summary>
        private bool HasExcessivePunctuation(string message)
        {
            if (message.Length < MinMessageLengthForCheck) return false;
            int count = 0;
            foreach (char c in message)
            {
                if (char.IsPunctuation(c)) count++;
            }
            return count >= ExcessivePunctuationThreshold;
        }

        /// <summary>
        /// Checks for excessive repeated whitespace characters.
        /// </summary>
        private bool HasRepeatedWhitespace(string message)
        {
            if (message.Length < MinMessageLengthForCheck) return false;

            int run = 0;
            foreach (char c in message)
            {
                if (char.IsWhiteSpace(c))
                {
                    run++;
                    if (run >= RepeatedWhitespaceThreshold) return true;
                }
                else
                {
                    run = 0;
                }
            }
            return false;
        }

        /// <summary>
        /// Checks whether the message contains a known spam phrase.
        /// </summary>
        private bool ContainsKnownSpamPhrase(string message)
        {
            string lower = message.ToLowerInvariant();
            foreach (var phrase in KnownSpamPhrases)
            {
                if (string.IsNullOrWhiteSpace(phrase)) continue;
                if (lower.Contains(phrase.ToLowerInvariant()))
                    return true;
            }
            return false;
        }

        #endregion

        #region Scoring & Flags

        /// <summary>
        /// Calculates a normalised spam score from 0.0 to 1.0 based on all active heuristics.
        /// </summary>
        private float CalculateSpamScore(string playerId, string message)
        {
            float score = 0f;

            if (IsIdenticalSpam(playerId, message))
                score += IdenticalRepeatWeight;

            if (IsRapidSpam(playerId))
                score += RapidFireWeight;

            if (HasCharacterRepeat(message))
                score += CharacterRepeatWeight;

            if (IsAllCaps(message))
                score += CapsWeight;

            if (HasExcessivePunctuation(message))
                score += PunctuationWeight;

            if (HasRepeatedWhitespace(message))
                score += WhitespaceWeight;

            if (ContainsKnownSpamPhrase(message))
                score += 0.5f;

            return Mathf.Clamp01(score);
        }

        /// <summary>
        /// Builds a bitwise flag set representing all triggered heuristics.
        /// </summary>
        private SpamDetectionFlags EvaluateFlags(string playerId, string message)
        {
            SpamDetectionFlags flags = SpamDetectionFlags.None;

            if (IsIdenticalSpam(playerId, message)) flags |= SpamDetectionFlags.IdenticalRepeat;
            if (IsRapidSpam(playerId)) flags |= SpamDetectionFlags.RapidFire;
            if (HasCharacterRepeat(message)) flags |= SpamDetectionFlags.CharacterRepeat;
            if (IsAllCaps(message)) flags |= SpamDetectionFlags.ExcessiveCaps;
            if (HasExcessivePunctuation(message)) flags |= SpamDetectionFlags.ExcessivePunctuation;
            if (HasRepeatedWhitespace(message)) flags |= SpamDetectionFlags.RepeatedWhitespace;
            if (ContainsKnownSpamPhrase(message)) flags |= SpamDetectionFlags.KnownSpamPhrase;

            if (message.Length > MaxMessageLength) flags |= SpamDetectionFlags.LengthAnomaly;

            return flags;
        }

        /// <summary>
        /// Derives the primary violation string from the most severe active flag.
        /// </summary>
        private string DerivePrimaryViolation(SpamDetectionFlags flags)
        {
            if (flags.HasFlag(SpamDetectionFlags.KnownSpamPhrase)) return "known_spam_phrase";
            if (flags.HasFlag(SpamDetectionFlags.IdenticalRepeat)) return "identical_repeat";
            if (flags.HasFlag(SpamDetectionFlags.RapidFire)) return "rapid_fire";
            if (flags.HasFlag(SpamDetectionFlags.CharacterRepeat)) return "character_repeat";
            if (flags.HasFlag(SpamDetectionFlags.ExcessiveCaps)) return "excessive_caps";
            if (flags.HasFlag(SpamDetectionFlags.ExcessivePunctuation)) return "excessive_punctuation";
            if (flags.HasFlag(SpamDetectionFlags.RepeatedWhitespace)) return "repeated_whitespace";
            if (flags.HasFlag(SpamDetectionFlags.LengthAnomaly)) return "length_anomaly";
            return "none";
        }

        /// <summary>
        /// Builds a contextual warning message for the sender.
        /// </summary>
        private string BuildWarningMessage(SpamDetectionFlags flags, float score)
        {
            if (flags.HasFlag(SpamDetectionFlags.KnownSpamPhrase))
                return "Your message contains phrases commonly used in scams. Please be careful.";

            if (flags.HasFlag(SpamDetectionFlags.IdenticalRepeat))
                return "Please do not repeat the same message multiple times.";

            if (flags.HasFlag(SpamDetectionFlags.RapidFire))
                return "You're sending messages too quickly. Please slow down.";

            if (flags.HasFlag(SpamDetectionFlags.CharacterRepeat))
                return "Please avoid sending messages with excessive repeated characters.";

            if (flags.HasFlag(SpamDetectionFlags.ExcessiveCaps))
                return "Please avoid using excessive capital letters.";

            if (flags.HasFlag(SpamDetectionFlags.ExcessivePunctuation))
                return "Please avoid using excessive punctuation.";

            if (flags.HasFlag(SpamDetectionFlags.RepeatedWhitespace))
                return "Please avoid using excessive spaces in your message.";

            if (score >= SpamScoreThreshold)
                return "Your message was flagged by our spam filter. Please review our chat guidelines.";

            return string.Empty;
        }

        #endregion

        #region Utilities

        /// <summary>
        /// Normalises a message for comparison (lowercase, trimmed, collapsed whitespace).
        /// </summary>
        private string NormaliseMessage(string message)
        {
            if (string.IsNullOrWhiteSpace(message)) return string.Empty;
            string trimmed = message.Trim().ToLowerInvariant();
            // Collapse repeated whitespace for fair comparison
            return Regex.Replace(trimmed, @"\s+", " ");
        }

        #endregion

        #region Events

        /// <summary>
        /// EventBus payload for spam detection telemetry.
        /// </summary>
        public struct SpamDetectedEvent
        {
            public readonly string PlayerId;
            public readonly string Message;
            public readonly SpamCheckResult Result;

            public SpamDetectedEvent(string playerId, string message, SpamCheckResult result)
            {
                PlayerId = playerId;
                Message = message;
                Result = result;
            }
        }

        #endregion
    }
}
