using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KawaiiCool.Safety
{
    /// <summary>
    /// Manages under-13 (COPPA/GDPR-K) safety restrictions for child accounts.
    /// Restrictions are opt-in based on the age declared at account creation and can be
    /// toggled by a verified parent/guardian through the parental controls portal.
    /// </summary>
    public class ChildSafetyMode : MonoBehaviour
    {
        #region Inspector — Settings

        [Header("Account Classification")]
        [Tooltip("Whether the current account is classified as a child account (under 13).")]
        public bool IsChildAccount = false;

        [Tooltip("Minimum age (in years) before the account is considered an adult account.")]
        public int MinimumAge = 13;

        [Tooltip("Feature IDs that are completely disabled for child accounts.")]
        public List<string> RestrictedFeatures = new List<string>
        {
            "voice_chat",
            "external_links",
            "third_party_ads",
            "location_sharing",
            "screen_recording_share"
        };

        #endregion

        #region Inspector — Chat

        [Header("Chat Restrictions")]
        [Tooltip("If false, child accounts can only use pre-approved or quick-chat phrases.")]
        public bool AllowFreeChat = false;

        [Tooltip("If false, direct whispers between child accounts and others are blocked.")]
        public bool AllowWhispers = false;

        [Tooltip("If true, child accounts may participate in room-wide public chat.")]
        public bool AllowRoomChat = true;

        [Tooltip("If true, only messages from the pre-approved list are allowed in chat.")]
        public bool UsePreApprovedMessages = true;

        [Tooltip("The whitelist of phrases child accounts may send when free chat is disabled.")]
        public List<string> PreApprovedMessages = new List<string>
        {
            "Hello!",
            "Nice to meet you!",
            "Let's play!",
            "Thank you!",
            "Goodbye!",
            "I like your outfit!",
            "Want to be friends?",
            "That was fun!",
            "See you later!",
            "Awesome room!"
        };

        #endregion

        #region Inspector — Social

        [Header("Social Restrictions")]
        [Tooltip("If true, child accounts may receive and accept friend requests.")]
        public bool AllowFriendRequests = true;

        [Tooltip("If true, child accounts may participate in item trading.")]
        public bool AllowTrading = false;

        [Tooltip("If true, child accounts may create and publish their own rooms.")]
        public bool AllowRoomCreation = false;

        [Tooltip("If true, child accounts may edit their avatar and profile card.")]
        public bool AllowProfileCustomization = true;

        [Tooltip("Maximum number of friends a child account may have.")]
        public int MaxFriends = 50;

        #endregion

        #region Inspector — Privacy

        [Header("Privacy Restrictions")]
        [Tooltip("If true, the child's online status is hidden from other players.")]
        public bool HideOnlineStatus = true;

        [Tooltip("If true, the child's profile is excluded from public search results.")]
        public bool HideProfileFromSearch = true;

        [Tooltip("If true, all in-app purchases require explicit parent/guardian approval.")]
        public bool RequireParentApprovalForPurchases = true;

        [Tooltip("If true, geo-location data is never collected or shared.")]
        public bool DisableLocationSharing = true;

        [Tooltip("If true, child accounts cannot be tagged in photos or screenshots by others.")]
        public bool DisablePhotoTagging = true;

        #endregion

        #region Inspector — Time Limits

        [Header("Time Limits")]
        [Tooltip("Daily play-time limit in minutes for child accounts (0 = unlimited).")]
        public int DailyPlayTimeLimitMinutes = 120;

        [Tooltip("Hour after which child accounts are automatically disconnected (24h format, -1 = disabled).")]
        public int CurfewHour = -1;

        #endregion

        #region Events

        /// <summary>
        /// Fired when child safety mode is enabled for the current account.
        /// </summary>
        public event Action OnChildModeEnabled;

        /// <summary>
        /// Fired when child safety mode is disabled for the current account.
        /// </summary>
        public event Action OnChildModeDisabled;

        /// <summary>
        /// Fired when a feature access attempt is denied due to child safety restrictions.
        /// Parameters: featureId, denialReason.
        /// </summary>
        public event Action<string, string> OnFeatureDenied;

        #endregion

        #region Internal State

        /// <summary>
        /// The declared age of the account holder at registration.
        /// </summary>
        private int _declaredAge;

        /// <summary>
        /// Whether the mode has been explicitly overridden by a verified parent.
        /// </summary>
        private bool _parentOverrideActive;

        /// <summary>
        /// Accumulated play time today in seconds.
        /// </summary>
        private float _todayPlayTimeSeconds;

        /// <summary>
        /// Timestamp when today's play-time tracking began.
        /// </summary>
        private float _sessionStartTime;

        #endregion

        #region Unity Lifecycle

        private void Start()
        {
            _sessionStartTime = Time.realtimeSinceStartup;
        }

        private void Update()
        {
            if (IsChildAccount && DailyPlayTimeLimitMinutes > 0)
            {
                _todayPlayTimeSeconds = Time.realtimeSinceStartup - _sessionStartTime;

                if (_todayPlayTimeSeconds >= DailyPlayTimeLimitMinutes * 60f)
                {
                    EnforceDailyTimeLimit();
                }
            }

            if (IsChildAccount && CurfewHour >= 0)
            {
                if (DateTime.Now.Hour >= CurfewHour)
                {
                    EnforceCurfew();
                }
            }
        }

        #endregion

        #region Public API — Mode Control

        /// <summary>
        /// Enables child safety mode based on the declared age of the account holder.
        /// </summary>
        /// <param name="age">The declared age in years.</param>
        public void EnableChildMode(int age)
        {
            _declaredAge = age;
            IsChildAccount = age < MinimumAge;

            if (IsChildAccount)
            {
                ApplyRestrictions();
                OnChildModeEnabled?.Invoke();

                EventBus.Publish(new ChildSafetyModeChangedEvent(true, age));

                if (Application.isEditor || Debug.isDebugBuild)
                    Debug.Log($"[ChildSafetyMode] Child mode ENABLED for age {age}.");
            }
            else
            {
                DisableChildMode();
            }
        }

        /// <summary>
        /// Disables child safety mode, restoring full feature access.
        /// This should only be called after verified age-up or parent override.
        /// </summary>
        public void DisableChildMode()
        {
            IsChildAccount = false;
            OnChildModeDisabled?.Invoke();

            EventBus.Publish(new ChildSafetyModeChangedEvent(false, _declaredAge));

            if (Application.isEditor || Debug.isDebugBuild)
                Debug.Log("[ChildSafetyMode] Child mode DISABLED.");
        }

        /// <summary>
        /// Temporarily overrides child safety restrictions using a verified parent PIN.
        /// Override expires at the end of the play session.
        /// </summary>
        /// <param name="parentPin">The verified parent/guardian PIN.</param>
        /// <returns><c>true</c> if the PIN was valid and override was applied.</returns>
        public bool RequestParentOverride(string parentPin)
        {
            // TODO: validate PIN against server or local secure storage
            bool valid = !string.IsNullOrEmpty(parentPin) && parentPin.Length >= 4;
            if (valid)
            {
                _parentOverrideActive = true;
                EventBus.Publish(new ParentOverrideEvent(true));
                Debug.Log("[ChildSafetyMode] Parent override activated.");
            }
            return valid;
        }

        /// <summary>
        /// Revokes an active parent override, reinstating all child safety restrictions.
        /// </summary>
        public void RevokeParentOverride()
        {
            _parentOverrideActive = false;
            ApplyRestrictions();
            EventBus.Publish(new ParentOverrideEvent(false));
            Debug.Log("[ChildSafetyMode] Parent override revoked.");
        }

        #endregion

        #region Public API — Feature Access

        /// <summary>
        /// Determines whether the current account may use a specific feature.
        /// </summary>
        /// <param name="featureId">A unique feature identifier (e.g. "trading", "voice_chat").</param>
        /// <returns><c>true</c> if the feature is permitted.</returns>
        public bool CanUseFeature(string featureId)
        {
            if (!IsChildAccount || _parentOverrideActive) return true;
            if (string.IsNullOrEmpty(featureId)) return true;

            bool allowed = !RestrictedFeatures.Contains(featureId, StringComparer.OrdinalIgnoreCase);

            if (!allowed)
            {
                OnFeatureDenied?.Invoke(featureId, "child_safety_restricted");
            }

            return allowed;
        }

        /// <summary>
        /// Applies all child safety restrictions to the current game session.
        /// Called automatically when child mode is enabled.
        /// </summary>
        public void ApplyRestrictions()
        {
            if (!IsChildAccount) return;

            // Sync with ChatManager
            if (ChatManager.Instance != null)
            {
                if (!AllowFreeChat && UsePreApprovedMessages)
                {
                    ChatManager.Instance.EnableQuickChatMode(PreApprovedMessages);
                }
                else
                {
                    ChatManager.Instance.EnableFreeChat();
                }

                ChatManager.Instance.SetWhisperEnabled(AllowWhispers);
                ChatManager.Instance.SetRoomChatEnabled(AllowRoomChat);
            }

            // Sync with SocialGraphManager
            if (SocialGraphManager.Instance != null)
            {
                SocialGraphManager.Instance.SetMaxFriends(MaxFriends);
                SocialGraphManager.Instance.SetFriendRequestsEnabled(AllowFriendRequests);
                SocialGraphManager.Instance.SetTradingEnabled(AllowTrading);
            }

            // Privacy flags
            if (GameManager.Instance != null)
            {
                GameManager.Instance.SetOnlineStatusVisible(!HideOnlineStatus);
                GameManager.Instance.SetProfileSearchable(!HideProfileFromSearch);
                GameManager.Instance.SetLocationSharingDisabled(DisableLocationSharing);
            }

            EventBus.Publish(new ChildSafetyRestrictionsAppliedEvent(
                AllowFreeChat, AllowWhispers, AllowRoomChat,
                AllowFriendRequests, AllowTrading, AllowRoomCreation,
                MaxFriends, HideOnlineStatus, HideProfileFromSearch));
        }

        #endregion

        #region Public API — Messaging

        /// <summary>
        /// Sends a chat message from a child account, applying pre-approved filtering
        /// or free-chat moderation as configured.
        /// </summary>
        /// <param name="message">The raw message text.</param>
        public void SendMessage(string message)
        {
            if (!IsChildAccount || _parentOverrideActive)
            {
                // Pass through directly for adult accounts or override sessions
                ChatManager.Instance.SendChatMessage(message);
                return;
            }

            if (!AllowRoomChat)
            {
                OnFeatureDenied?.Invoke("room_chat", "child_safety_restricted");
                return;
            }

            if (!AllowFreeChat && UsePreApprovedMessages)
            {
                string normalised = message.Trim();
                bool approved = PreApprovedMessages.Any(m =>
                    string.Equals(m, normalised, StringComparison.OrdinalIgnoreCase));

                if (approved)
                {
                    ChatManager.Instance.SendChatMessage(normalised);
                }
                else
                {
                    OnFeatureDenied?.Invoke("free_chat", "not_in_preapproved_list");
                    // In production: show a UI toast explaining why the message was blocked
                }
            }
            else
            {
                // Free chat is enabled but still filtered through the profanity pipeline
                ChatManager.Instance.SendChatMessage(message);
            }
        }

        /// <summary>
        /// Determines whether a child account may receive a message from the given sender.
        /// </summary>
        /// <param name="senderId">The sender's player identifier.</param>
        /// <returns><c>true</c> if the message may be received.</returns>
        public bool CanReceiveMessageFrom(string senderId)
        {
            if (!IsChildAccount || _parentOverrideActive) return true;
            if (string.IsNullOrEmpty(senderId)) return false;

            // Child accounts cannot receive whispers unless explicitly allowed
            // (ChatManager will additionally route by message type)

            // Check if sender is blocked or muted via ChatManager
            if (ChatManager.Instance != null)
            {
                if (ChatManager.Instance.IsBlocked(senderId) || ChatManager.Instance.IsMuted(senderId))
                    return false;
            }

            // Additional: only accept messages from friends if stricter settings are enabled
            // TODO: add "friends_only_messages" setting if required by policy

            return true;
        }

        /// <summary>
        /// Determines whether a child account may receive a whisper from the given sender.
        /// </summary>
        /// <param name="senderId">The sender's player identifier.</param>
        /// <returns><c>true</c> if the whisper may be received.</returns>
        public bool CanReceiveWhisperFrom(string senderId)
        {
            if (!IsChildAccount || _parentOverrideActive) return true;
            return AllowWhispers && CanReceiveMessageFrom(senderId);
        }

        #endregion

        #region Public API — Purchase Gate

        /// <summary>
        /// Checks whether an in-app purchase may proceed for a child account.
        /// </summary>
        /// <param name="productId">The product identifier.</param>
        /// <returns><c>true</c> if the purchase is permitted.</returns>
        public bool CanPurchase(string productId)
        {
            if (!IsChildAccount || _parentOverrideActive) return true;

            if (RequireParentApprovalForPurchases)
            {
                // In production: trigger parent-approval flow and return false pending approval
                EventBus.Publish(new ParentApprovalRequiredEvent(productId, "in_app_purchase"));
                return false;
            }

            return true;
        }

        #endregion

        #region Enforcement

        /// <summary>
        /// Called when the daily play-time limit is reached. Disconnects the child account
        /// with a friendly message explaining the time limit.
        /// </summary>
        private void EnforceDailyTimeLimit()
        {
            EventBus.Publish(new ChildSafetyEnforcementEvent("daily_time_limit_reached",
                $"You've used your {DailyPlayTimeLimitMinutes} minutes of play time today. See you tomorrow!"));

            // In production: gracefully disconnect with a UI modal
            Debug.Log("[ChildSafetyMode] Daily time limit enforced — session ended.");
        }

        /// <summary>
        /// Called when the curfew hour is reached. Disconnects the child account.
        /// </summary>
        private void EnforceCurfew()
        {
            EventBus.Publish(new ChildSafetyEnforcementEvent("curfew_reached",
                "It's getting late! Time to rest. See you tomorrow!"));

            Debug.Log("[ChildSafetyMode] Curfew enforced — session ended.");
        }

        #endregion

        #region EventBus Payloads

        /// <summary>
        /// Published when child safety mode is enabled or disabled.
        /// </summary>
        public struct ChildSafetyModeChangedEvent
        {
            public readonly bool IsEnabled;
            public readonly int DeclaredAge;

            public ChildSafetyModeChangedEvent(bool isEnabled, int declaredAge)
            {
                IsEnabled = isEnabled;
                DeclaredAge = declaredAge;
            }
        }

        /// <summary>
        /// Published when child safety restrictions are applied to the session.
        /// </summary>
        public struct ChildSafetyRestrictionsAppliedEvent
        {
            public readonly bool AllowFreeChat;
            public readonly bool AllowWhispers;
            public readonly bool AllowRoomChat;
            public readonly bool AllowFriendRequests;
            public readonly bool AllowTrading;
            public readonly bool AllowRoomCreation;
            public readonly int MaxFriends;
            public readonly bool HideOnlineStatus;
            public readonly bool HideProfileFromSearch;

            public ChildSafetyRestrictionsAppliedEvent(
                bool allowFreeChat, bool allowWhispers, bool allowRoomChat,
                bool allowFriendRequests, bool allowTrading, bool allowRoomCreation,
                int maxFriends, bool hideOnlineStatus, bool hideProfileFromSearch)
            {
                AllowFreeChat = allowFreeChat;
                AllowWhispers = allowWhispers;
                AllowRoomChat = allowRoomChat;
                AllowFriendRequests = allowFriendRequests;
                AllowTrading = allowTrading;
                AllowRoomCreation = allowRoomCreation;
                MaxFriends = maxFriends;
                HideOnlineStatus = hideOnlineStatus;
                HideProfileFromSearch = hideProfileFromSearch;
            }
        }

        /// <summary>
        /// Published when a parent override is activated or revoked.
        /// </summary>
        public struct ParentOverrideEvent
        {
            public readonly bool IsActive;

            public ParentOverrideEvent(bool isActive)
            {
                IsActive = isActive;
            }
        }

        /// <summary>
        /// Published when parent approval is required for a purchase or action.
        /// </summary>
        public struct ParentApprovalRequiredEvent
        {
            public readonly string ProductId;
            public readonly string ActionType;

            public ParentApprovalRequiredEvent(string productId, string actionType)
            {
                ProductId = productId;
                ActionType = actionType;
            }
        }

        /// <summary>
        /// Published when child safety enforcement triggers (time limit, curfew, etc.).
        /// </summary>
        public struct ChildSafetyEnforcementEvent
        {
            public readonly string EnforcementType;
            public readonly string Message;

            public ChildSafetyEnforcementEvent(string enforcementType, string message)
            {
                EnforcementType = enforcementType;
                Message = message;
            }
        }

        #endregion
    }
}
