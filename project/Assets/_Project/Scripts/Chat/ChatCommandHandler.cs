using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using UnityEngine;

namespace KawaiiCoolIsland.Chat
{
    /// <summary>
    /// Handles registration and execution of slash commands for the chat system.
    /// Supports built-in commands (/w, /mute, /block, etc.) and custom command registration.
    /// Commands are parsed from input text starting with '/'.
    /// </summary>
    public class ChatCommandHandler
    {
        #region Private Fields
        private readonly Dictionary<string, ChatCommand> _commands;
        #endregion

        #region Constructor
        /// <summary>
        /// Creates a new ChatCommandHandler instance with an empty command registry.
        /// </summary>
        public ChatCommandHandler()
        {
            _commands = new Dictionary<string, ChatCommand>(StringComparer.OrdinalIgnoreCase);
        }
        #endregion

        #region Public Methods - Command Registration
        /// <summary>
        /// Registers a new slash command with the handler.
        /// </summary>
        /// <param name="command">The command keyword (e.g., "w" for /w). Case-insensitive.</param>
        /// <param name="description">Human-readable description of what the command does.</param>
        /// <param name="handler">Action to execute when the command is invoked. Receives parsed arguments.</param>
        /// <param name="usage">Optional usage syntax hint (e.g., "&lt;player&gt; &lt;message&gt;").</param>
        /// <param name="requiresTarget">Whether this command requires a target player argument.</param>
        public void RegisterCommand(string command, string description, Action<string[]> handler,
            string usage = "", bool requiresTarget = false)
        {
            if (string.IsNullOrWhiteSpace(command))
            {
                Debug.LogWarning("[ChatCommandHandler] Cannot register command with empty name.");
                return;
            }

            if (handler == null)
            {
                Debug.LogWarning($"[ChatCommandHandler] Cannot register command '{command}' with null handler.");
                return;
            }

            string normalizedCommand = command.Trim().ToLowerInvariant();

            if (_commands.ContainsKey(normalizedCommand))
            {
                Debug.LogWarning($"[ChatCommandHandler] Command '/{normalizedCommand}' is already registered. Overwriting.");
                _commands.Remove(normalizedCommand);
            }

            _commands[normalizedCommand] = new ChatCommand
            {
                Command = normalizedCommand,
                Description = description,
                Handler = handler,
                Usage = usage,
                RequiresTarget = requiresTarget
            };
        }

        /// <summary>
        /// Unregisters a previously registered command.
        /// </summary>
        /// <param name="command">The command keyword to unregister.</param>
        /// <returns>True if the command was found and removed.</returns>
        public bool UnregisterCommand(string command)
        {
            if (string.IsNullOrWhiteSpace(command)) return false;

            string normalizedCommand = command.Trim().ToLowerInvariant();
            return _commands.Remove(normalizedCommand);
        }

        /// <summary>
        /// Checks if a command is registered.
        /// </summary>
        /// <param name="command">The command keyword to check.</param>
        /// <returns>True if the command is registered.</returns>
        public bool IsCommandRegistered(string command)
        {
            if (string.IsNullOrWhiteSpace(command)) return false;
            return _commands.ContainsKey(command.Trim().ToLowerInvariant());
        }
        #endregion

        #region Public Methods - Command Execution
        /// <summary>
        /// Attempts to parse and execute a slash command from input text.
        /// </summary>
        /// <param name="input">The raw input text starting with '/'.</param>
        /// <returns>True if the input was a valid command and was executed.</returns>
        public bool TryExecuteCommand(string input)
        {
            if (string.IsNullOrWhiteSpace(input)) return false;
            if (!input.StartsWith("/")) return false;

            // Remove the leading '/' and trim
            string commandText = input.Substring(1).Trim();
            if (string.IsNullOrWhiteSpace(commandText)) return false;

            // Parse command and arguments
            // Support quoted arguments: /w "Player Name" hello there
            var parsed = ParseCommandLine(commandText);
            if (parsed.Count == 0) return false;

            string commandName = parsed[0].ToLowerInvariant();
            string[] args = parsed.Count > 1 ? parsed.GetRange(1, parsed.Count - 1).ToArray() : Array.Empty<string>();

            // Try exact match first
            if (_commands.TryGetValue(commandName, out ChatCommand command))
            {
                try
                {
                    command.Handler?.Invoke(args);
                    return true;
                }
                catch (Exception ex)
                {
                    Debug.LogError($"[ChatCommandHandler] Error executing '/{commandName}': {ex.Message}");
                    return false;
                }
            }

            // Try partial/fuzzy match
            string bestMatch = FindBestMatch(commandName);
            if (!string.IsNullOrEmpty(bestMatch) && _commands.TryGetValue(bestMatch, out command))
            {
                try
                {
                    command.Handler?.Invoke(args);
                    return true;
                }
                catch (Exception ex)
                {
                    Debug.LogError($"[ChatCommandHandler] Error executing '/{bestMatch}': {ex.Message}");
                    return false;
                }
            }

            Debug.LogWarning($"[ChatCommandHandler] Unknown command: /{commandName}. Type /help for available commands.");
            return false;
        }

        /// <summary>
        /// Returns a list of all registered commands.
        /// </summary>
        /// <returns>List of ChatCommand objects.</returns>
        public List<ChatCommand> GetAvailableCommands()
        {
            return _commands.Values.OrderBy(c => c.Command).ToList();
        }

        /// <summary>
        /// Returns formatted help text for a specific command.
        /// </summary>
        /// <param name="command">The command to get help for.</param>
        /// <returns>Formatted help string, or error message if command not found.</returns>
        public string GetCommandHelp(string command)
        {
            if (string.IsNullOrWhiteSpace(command)) return "Usage: /help <command>";

            string normalizedCommand = command.Trim().ToLowerInvariant();
            if (_commands.TryGetValue(normalizedCommand, out ChatCommand cmd))
            {
                var sb = new StringBuilder();
                sb.AppendLine($"<b>/{cmd.Command}</b> - {cmd.Description}");
                if (!string.IsNullOrEmpty(cmd.Usage))
                {
                    sb.AppendLine($"Usage: /{cmd.Command} {cmd.Usage}");
                }
                return sb.ToString();
            }

            return $"Unknown command: /{command}. Type /help for available commands.";
        }

        /// <summary>
        /// Returns command suggestions based on partial input (for autocomplete).
        /// </summary>
        /// <param name="partial">Partial command text (without the leading '/').</param>
        /// <returns>List of matching command names.</returns>
        public List<string> GetCommandSuggestions(string partial)
        {
            if (string.IsNullOrWhiteSpace(partial)) return new List<string>();

            string normalizedPartial = partial.ToLowerInvariant();
            return _commands.Keys
                .Where(cmd => cmd.StartsWith(normalizedPartial))
                .OrderBy(cmd => cmd)
                .ToList();
        }
        #endregion

        #region Private Methods
        /// <summary>
        /// Parses a command line string, respecting quoted arguments.
        /// </summary>
        private List<string> ParseCommandLine(string input)
        {
            var result = new List<string>();
            if (string.IsNullOrWhiteSpace(input)) return result;

            var currentArg = new StringBuilder();
            bool inQuotes = false;

            for (int i = 0; i < input.Length; i++)
            {
                char c = input[i];

                if (c == '"')
                {
                    inQuotes = !inQuotes;
                    continue;
                }

                if (char.IsWhiteSpace(c) && !inQuotes)
                {
                    if (currentArg.Length > 0)
                    {
                        result.Add(currentArg.ToString());
                        currentArg.Clear();
                    }
                    continue;
                }

                currentArg.Append(c);
            }

            if (currentArg.Length > 0)
            {
                result.Add(currentArg.ToString());
            }

            return result;
        }

        /// <summary>
        /// Finds the best matching command using prefix matching.
        /// </summary>
        private string FindBestMatch(string commandName)
        {
            // Exact length match for short commands (prevent 'w' matching 'whisper' when 'w' exists)
            foreach (var cmd in _commands.Keys)
            {
                if (cmd == commandName) return cmd;
            }

            // Prefix match for longer commands
            var matches = _commands.Keys.Where(cmd => cmd.StartsWith(commandName)).ToList();
            if (matches.Count == 1) return matches[0];

            return null;
        }
        #endregion
    }

    /// <summary>
    /// Represents a registered chat command with its metadata and handler.
    /// </summary>
    public class ChatCommand
    {
        /// <summary>
        /// The command keyword (e.g., "w" for /w). Stored in lowercase.
        /// </summary>
        public string Command;

        /// <summary>
        /// Human-readable description of what the command does.
        /// </summary>
        public string Description;

        /// <summary>
        /// Usage syntax hint shown in help text (e.g., "&lt;player&gt; &lt;message&gt;").
        /// </summary>
        public string Usage;

        /// <summary>
        /// Whether this command requires a target player as the first argument.
        /// </summary>
        public bool RequiresTarget;

        /// <summary>
        /// The action to execute when this command is invoked.
        /// Receives an array of parsed argument strings.
        /// </summary>
        public Action<string[]> Handler;

        /// <summary>
        /// Returns formatted help text for this command.
        /// </summary>
        public string GetHelpText()
        {
            var sb = new StringBuilder();
            sb.Append($"/{Command}");
            if (!string.IsNullOrEmpty(Usage))
            {
                sb.Append($" {Usage}");
            }
            sb.Append($" - {Description}");
            return sb.ToString();
        }

        /// <summary>
        /// Returns a string representation of the command.
        /// </summary>
        public override string ToString()
        {
            return $"/{Command} - {Description}";
        }
    }
}
