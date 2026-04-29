using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using UnityEngine;

namespace KawaiiCoolIsland.Chat
{
    /// <summary>
    /// Provides message moderation and profanity filtering for the KawaiiCool Island chat system.
    /// Supports configurable word lists, whitelisting, leet-speak normalization, and whole-word matching.
    /// </summary>
    public class ProfanityFilter
    {
        #region Private Fields
        private readonly HashSet<string> _profanityWords;
        private readonly List<string> _whitelistWords;
        private readonly string _replacement;
        private readonly bool _useLeetSpeakFilter;

        /// <summary>
        /// Leet-speak character mappings for normalization.
        /// Covers common substitutions: 1=l/i, 3=e, 4=a, 5=s, 7=t, 0=o, etc.
        /// </summary>
        private static readonly Dictionary<char, char> LeetMappings = new()
        {
            { '1', 'i' },
            { '3', 'e' },
            { '4', 'a' },
            { '5', 's' },
            { '7', 't' },
            { '0', 'o' },
            { '@', 'a' },
            { '$', 's' },
            { '!', 'i' },
            { '|', 'i' },
            { '+', 't' },
            { '(', 'c' },
            { ')', 'd' },
            { '[', 'c' },
            { ']', 'e' },
            { '{', 'c' },
            { '}', 'e' },
            { '<', 'c' },
            { '>', 't' },
            { '^', 'v' },
            { '~', 'n' },
            { '`', 'a' },
            { '*', 'a' },
            { '#', 'h' },
            { '%', 'x' },
            { '&', 'e' },
            { '8', 'b' },
            { '6', 'g' },
            { '9', 'g' },
            { '2', 'z' },
        };

        /// <summary>
        /// Regex pattern to detect separator characters between letters.
        /// </summary>
        private static readonly string SeparatorPattern = @"[\s\.\-_\+\*\/\\\|\(\)\{\}\[\]]*";
        #endregion

        #region Constructor
        /// <summary>
        /// Creates a new ProfanityFilter instance.
        /// </summary>
        /// <param name="replacement">String to replace profanity words with (default: "***").</param>
        /// <param name="filterLeetSpeak">Whether to normalize leet-speak before filtering (default: true).</param>
        public ProfanityFilter(string replacement = "***", bool filterLeetSpeak = true)
        {
            _profanityWords = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            _whitelistWords = new List<string>();
            _replacement = replacement;
            _useLeetSpeakFilter = filterLeetSpeak;
        }
        #endregion

        #region Public Methods - Word List Management
        /// <summary>
        /// Loads profanity words from a TextAsset (one word per line).
        /// </summary>
        /// <param name="wordListAsset">TextAsset containing the word list.</param>
        public void LoadWordList(TextAsset wordListAsset)
        {
            if (wordListAsset == null)
            {
                Debug.LogWarning("[ProfanityFilter] Word list TextAsset is null.");
                return;
            }

            string[] lines = wordListAsset.text.Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries);
            LoadWordList(lines);
        }

        /// <summary>
        /// Loads profanity words from an array of strings.
        /// </summary>
        /// <param name="words">Array of profanity words to add.</param>
        public void LoadWordList(string[] words)
        {
            if (words == null || words.Length == 0) return;

            int addedCount = 0;
            foreach (string word in words)
            {
                string trimmed = word.Trim().ToLowerInvariant();
                if (!string.IsNullOrWhiteSpace(trimmed) && !_profanityWords.Contains(trimmed))
                {
                    _profanityWords.Add(trimmed);
                    addedCount++;
                }
            }

            Debug.Log($"[ProfanityFilter] Loaded {addedCount} profanity words. Total: {_profanityWords.Count}");
        }

        /// <summary>
        /// Adds a single profanity word to the filter.
        /// </summary>
        /// <param name="word">The word to add.</param>
        public void AddWord(string word)
        {
            if (string.IsNullOrWhiteSpace(word)) return;

            string normalized = word.Trim().ToLowerInvariant();
            _profanityWords.Add(normalized);
            Debug.Log($"[ProfanityFilter] Added word: {normalized}");
        }

        /// <summary>
        /// Removes a profanity word from the filter.
        /// </summary>
        /// <param name="word">The word to remove.</param>
        public void RemoveWord(string word)
        {
            if (string.IsNullOrWhiteSpace(word)) return;

            string normalized = word.Trim().ToLowerInvariant();
            _profanityWords.Remove(normalized);
            Debug.Log($"[ProfanityFilter] Removed word: {normalized}");
        }

        /// <summary>
        /// Adds a word to the whitelist. Whitelisted words will never be filtered,
        /// even if they contain profanity substrings (e.g., "class" contains "ass").
        /// </summary>
        /// <param name="word">The word to whitelist.</param>
        public void AddWhitelistWord(string word)
        {
            if (string.IsNullOrWhiteSpace(word)) return;

            string normalized = word.Trim().ToLowerInvariant();
            if (!_whitelistWords.Contains(normalized))
            {
                _whitelistWords.Add(normalized);
            }
        }

        /// <summary>
        /// Removes a word from the whitelist.
        /// </summary>
        /// <param name="word">The word to remove from the whitelist.</param>
        public void RemoveWhitelistWord(string word)
        {
            if (string.IsNullOrWhiteSpace(word)) return;

            string normalized = word.Trim().ToLowerInvariant();
            _whitelistWords.Remove(normalized);
        }

        /// <summary>
        /// Clears all profanity words from the filter.
        /// </summary>
        public void ClearWordList()
        {
            _profanityWords.Clear();
            Debug.Log("[ProfanityFilter] Word list cleared.");
        }

        /// <summary>
        /// Returns the total number of profanity words in the filter.
        /// </summary>
        public int WordCount => _profanityWords.Count;
        #endregion

        #region Public Methods - Filtering
        /// <summary>
        /// Filters profanity from the input string, replacing matched words with the replacement string.
        /// Preserves the original casing pattern of the first character.
        /// </summary>
        /// <param name="input">The input string to filter.</param>
        /// <returns>The filtered string with profanity replaced.</returns>
        public string Filter(string input)
        {
            if (string.IsNullOrEmpty(input)) return input;
            if (_profanityWords.Count == 0) return input;

            string result = input;

            // First pass: direct word matching
            foreach (string word in _profanityWords)
            {
                if (string.IsNullOrWhiteSpace(word)) continue;

                result = FilterWord(result, word);
            }

            // Second pass: leet-speak normalization if enabled
            if (_useLeetSpeakFilter)
            {
                result = FilterLeetSpeak(result);
            }

            return result;
        }

        /// <summary>
        /// Checks if the input contains any profanity words.
        /// </summary>
        /// <param name="input">The input string to check.</param>
        /// <returns>True if profanity is detected.</returns>
        public bool ContainsProfanity(string input)
        {
            if (string.IsNullOrEmpty(input)) return false;
            if (_profanityWords.Count == 0) return false;

            string normalizedInput = input.ToLowerInvariant();

            // Check whitelisted words first and mask them temporarily
            foreach (string whitelistWord in _whitelistWords)
            {
                normalizedInput = normalizedInput.Replace(whitelistWord, new string('_', whitelistWord.Length));
            }

            // Direct check
            foreach (string word in _profanityWords)
            {
                if (IsWholeWord(normalizedInput, normalizedInput.IndexOf(word, StringComparison.OrdinalIgnoreCase), word.Length))
                {
                    return true;
                }
            }

            // Leet-speak check
            if (_useLeetSpeakFilter)
            {
                string leetNormalized = NormalizeLeetSpeak(normalizedInput);
                foreach (string word in _profanityWords)
                {
                    if (IsWholeWord(leetNormalized, leetNormalized.IndexOf(word, StringComparison.OrdinalIgnoreCase), word.Length))
                    {
                        return true;
                    }
                }
            }

            return false;
        }

        /// <summary>
        /// Finds and returns all profanity words detected in the input.
        /// </summary>
        /// <param name="input">The input string to scan.</param>
        /// <returns>List of detected profanity words.</returns>
        public List<string> FindProfanity(string input)
        {
            var found = new List<string>();
            if (string.IsNullOrEmpty(input) || _profanityWords.Count == 0) return found;

            string normalizedInput = input.ToLowerInvariant();

            foreach (string word in _profanityWords)
            {
                if (string.IsNullOrWhiteSpace(word)) continue;

                // Check direct match
                if (normalizedInput.Contains(word, StringComparison.OrdinalIgnoreCase) &&
                    IsWholeWord(normalizedInput, normalizedInput.IndexOf(word, StringComparison.OrdinalIgnoreCase), word.Length))
                {
                    if (!found.Contains(word, StringComparer.OrdinalIgnoreCase))
                    {
                        found.Add(word);
                    }
                }

                // Check leet-speak variant
                if (_useLeetSpeakFilter)
                {
                    string leetNormalized = NormalizeLeetSpeak(normalizedInput);
                    if (leetNormalized.Contains(word, StringComparison.OrdinalIgnoreCase) &&
                        IsWholeWord(leetNormalized, leetNormalized.IndexOf(word, StringComparison.OrdinalIgnoreCase), word.Length))
                    {
                        if (!found.Contains(word, StringComparer.OrdinalIgnoreCase))
                        {
                            found.Add(word);
                        }
                    }
                }
            }

            return found;
        }
        #endregion

        #region Private Methods - Filtering Logic
        /// <summary>
        /// Replaces occurrences of a specific word with the replacement string,
        /// preserving whole-word boundaries.
        /// </summary>
        private string FilterWord(string input, string word)
        {
            if (string.IsNullOrEmpty(input) || string.IsNullOrEmpty(word)) return input;

            // Build regex pattern that matches the word with word boundaries
            string escapedWord = Regex.Escape(word);
            var pattern = new Regex($@"\b{escapedWord}\b", RegexOptions.IgnoreCase);

            if (pattern.IsMatch(input))
            {
                // Calculate replacement length to roughly match original word length
                string replacement = _replacement.Length >= word.Length
                    ? _replacement
                    : _replacement.PadRight(word.Length, '*');

                input = pattern.Replace(input, replacement);
            }

            return input;
        }

        /// <summary>
        /// Filters leet-speak variants by normalizing and checking against profanity words.
        /// </summary>
        private string FilterLeetSpeak(string input)
        {
            if (string.IsNullOrEmpty(input)) return input;

            string result = input;

            foreach (string word in _profanityWords)
            {
                if (string.IsNullOrWhiteSpace(word)) continue;

                // Create a pattern that matches leet-speak variants of this word
                string leetPattern = BuildLeetPattern(word);
                var regex = new Regex(leetPattern, RegexOptions.IgnoreCase);

                if (regex.IsMatch(result))
                {
                    result = regex.Replace(result, _replacement);
                }
            }

            return result;
        }

        /// <summary>
        /// Builds a regex pattern that matches leet-speak variants of a word.
        /// </summary>
        private string BuildLeetPattern(string word)
        {
            var pattern = new StringBuilder();
            pattern.Append(@"\b");

            foreach (char c in word.ToLowerInvariant())
            {
                // Get all characters that could map to this letter in leet-speak
                var alternatives = GetLeetAlternatives(c);
                if (alternatives.Count > 1)
                {
                    pattern.Append($"[{string.Join("", alternatives)}]");
                }
                else
                {
                    pattern.Append(Regex.Escape(c.ToString()));
                }

                // Allow optional separators between characters
                pattern.Append(SeparatorPattern);
            }

            pattern.Append(@"\b");
            return pattern.ToString();
        }

        /// <summary>
        /// Gets all characters that could represent the given letter in leet-speak.
        /// </summary>
        private List<char> GetLeetAlternatives(char letter)
        {
            var alternatives = new List<char> { letter };

            foreach (var mapping in LeetMappings)
            {
                if (mapping.Value == letter && !alternatives.Contains(mapping.Key))
                {
                    alternatives.Add(mapping.Key);
                }
            }

            return alternatives;
        }

        /// <summary>
        /// Normalizes leet-speak characters to their standard alphabet equivalents.
        /// </summary>
        private string NormalizeLeetSpeak(string input)
        {
            if (string.IsNullOrEmpty(input)) return input;

            var result = new StringBuilder(input.Length);
            foreach (char c in input)
            {
                char lowerC = char.ToLowerInvariant(c);
                if (LeetMappings.TryGetValue(lowerC, out char normalized))
                {
                    result.Append(normalized);
                }
                else
                {
                    result.Append(c);
                }
            }

            return result.ToString();
        }

        /// <summary>
        /// Replaces a word with asterisks matching the word length.
        /// </summary>
        private string ReplaceWithAsterisks(string word)
        {
            return new string('*', word.Length);
        }

        /// <summary>
        /// Checks if a substring at the given position is a whole word (bounded by word boundaries).
        /// </summary>
        private bool IsWholeWord(string text, int startIndex, int length)
        {
            if (startIndex < 0) return false;

            // Check if the character before is a word character
            bool hasWordCharBefore = startIndex > 0 && char.IsLetterOrDigit(text[startIndex - 1]);

            // Check if the character after is a word character
            bool hasWordCharAfter = startIndex + length < text.Length && char.IsLetterOrDigit(text[startIndex + length]);

            return !hasWordCharBefore && !hasWordCharAfter;
        }
        #endregion
    }
}
