// ----------------------------------------------------------------------------
// KawaiiCool Island - Core Framework
// ----------------------------------------------------------------------------
// GameEvents.cs - All game event definitions for the type-safe EventBus
// ----------------------------------------------------------------------------
// Defines the IGameEvent marker interface and all event structs used across
// the game's systems. Events are lightweight value-type structs for zero-allocation
// message passing via the EventBus system.
// ----------------------------------------------------------------------------

using UnityEngine;
using Unity.Netcode;

namespace KawaiiCoolIsland.Core.Events
{
    #region Marker Interface

    /// <summary>
    /// Marker interface for all game events. Event structs implementing this
    /// interface can be published and subscribed to via the <see cref="EventBus"/>.
    /// </summary>
    public interface IGameEvent { }

    #endregion

    #region Avatar & Customization Events

    /// <summary>
    /// Fired when a player changes their avatar appearance (clothing, accessory, etc.).
    /// </summary>
    public struct AvatarChangedEvent : IGameEvent
    {
        /// <summary>The unique identifier of the player whose avatar changed.</summary>
        public string PlayerId;

        /// <summary>The category of part that changed (e.g., "Hat", "Shirt", "Shoes").</summary>
        public string PartCategory;

        /// <summary>The new item label/identifier applied.</summary>
        public string NewLabel;
    }

    /// <summary>
    /// Fired when a player changes their avatar's body properties (skin tone, height, etc.).
    /// </summary>
    public struct AvatarBodyChangedEvent : IGameEvent
    {
        /// <summary>The unique identifier of the player.</summary>
        public string PlayerId;

        /// <summary>The body property that changed (e.g., "SkinTone", "Height").</summary>
        public string PropertyName;

        /// <summary>The new value of the property.</summary>
        public float NewValue;
    }

    #endregion

    #region Inventory & Economy Events

    /// <summary>
    /// Fired when the local player's inventory contents change.
    /// </summary>
    public struct InventoryChangedEvent : IGameEvent
    {
        /// <summary>The unique item identifier that changed.</summary>
        public string ItemId;

        /// <summary>The new quantity of the item after the change.</summary>
        public int Quantity;

        /// <summary>The delta amount (positive for gain, negative for loss).</summary>
        public int Delta;
    }

    /// <summary>
    /// Fired when the player gains a new item they didn't previously own.
    /// </summary>
    public struct ItemAcquiredEvent : IGameEvent
    {
        /// <summary>The unique item identifier that was acquired.</summary>
        public string ItemId;

        /// <summary>Display name of the acquired item.</summary>
        public string ItemName;

        /// <summary>Whether the item is of rare quality (for special effects).</summary>
        public bool IsRare;
    }

    /// <summary>
    /// Fired when any currency balance changes (Coins, Gems, StarDust, etc.).
    /// </summary>
    public struct CurrencyChangedEvent : IGameEvent
    {
        /// <summary>The currency type identifier (e.g., "Coins", "Gems", "StarDust").</summary>
        public string CurrencyType;

        /// <summary>The new total balance after the change.</summary>
        public int NewBalance;

        /// <summary>The delta amount (positive for gain, negative for spend).</summary>
        public int Delta;
    }

    /// <summary>
    /// Fired when a transaction (purchase, sale, trade) completes.
    /// </summary>
    public struct TransactionCompletedEvent : IGameEvent
    {
        /// <summary>Unique transaction identifier.</summary>
        public string TransactionId;

        /// <summary>Whether the transaction was successful.</summary>
        public bool Success;

        /// <summary>Human-readable result message.</summary>
        public string Message;
    }

    #endregion

    #region Social & Chat Events

    /// <summary>
    /// Fired when a chat message is received from any channel.
    /// </summary>
    public struct ChatMessageEvent : IGameEvent
    {
        /// <summary>The unique sender identifier.</summary>
        public string SenderId;

        /// <summary>The display name of the sender.</summary>
        public string SenderName;

        /// <summary>The chat message content.</summary>
        public string Message;

        /// <summary>The channel identifier (0=Global, 1=Island, 2=Party, 3=Whisper).</summary>
        public int Channel;
    }

    /// <summary>
    /// Fired when the local player receives a friend request.
    /// </summary>
    public struct FriendRequestEvent : IGameEvent
    {
        /// <summary>The player ID sending the friend request.</summary>
        public string SenderId;

        /// <summary>The display name of the requesting player.</summary>
        public string SenderName;
    }

    /// <summary>
    /// Fired when a friend's online status changes.
    /// </summary>
    public struct FriendStatusChangedEvent : IGameEvent
    {
        /// <summary>The friend's player ID.</summary>
        public string FriendId;

        /// <summary>True if the friend is now online.</summary>
        public bool IsOnline;

        /// <summary>The current location of the friend if online.</summary>
        public string CurrentLocation;
    }

    #endregion

    #region Multiplayer & Player Events

    /// <summary>
    /// Fired when a new player joins the current multiplayer session.
    /// Uses Unity Netcode types for networked scenarios.
    /// </summary>
    public struct PlayerJoinedEvent : IGameEvent
    {
        /// <summary>The unique player identifier (may be a Netcode ClientId string).</summary>
        public string PlayerId;

        /// <summary>The display name of the player who joined.</summary>
        public string PlayerName;

#if UNITY_NETCODE_EXISTS
        /// <summary>The Netcode client ID if available.</summary>
        public ulong ClientId;
#endif
    }

    /// <summary>
    /// Fired when a player leaves the current multiplayer session.
    /// </summary>
    public struct PlayerLeftEvent : IGameEvent
    {
        /// <summary>The unique identifier of the player who left.</summary>
        public string PlayerId;

        /// <summary>The display name of the player who left.</summary>
        public string PlayerName;

        /// <summary>The reason for disconnection if known.</summary>
        public string Reason;
    }

    /// <summary>
    /// Fired when the local player's network connection state changes.
    /// </summary>
    public struct ConnectionStateChangedEvent : IGameEvent
    {
        /// <summary>The new connection state (0=Disconnected, 1=Connecting, 2=Connected).</summary>
        public int NewState;

        /// <summary>Additional information about the state change.</summary>
        public string Info;
    }

    #endregion

    #region Island & World Events

    /// <summary>
    /// Fired when an object is placed on the player's island.
    /// </summary>
    public struct IslandObjectPlacedEvent : IGameEvent
    {
        /// <summary>The unique identifier of the placed object instance.</summary>
        public string ObjectId;

        /// <summary>The world position where the object was placed.</summary>
        public Vector3 Position;

        /// <summary>The world rotation applied to the object.</summary>
        public Quaternion Rotation;

        /// <summary>The item data ID of the placed object.</summary>
        public string ItemDataId;

        /// <summary>The player ID who placed the object.</summary>
        public string PlacedByPlayerId;
    }

    /// <summary>
    /// Fired when an island object is removed or picked up.
    /// </summary>
    public struct IslandObjectRemovedEvent : IGameEvent
    {
        /// <summary>The unique identifier of the removed object instance.</summary>
        public string ObjectId;

        /// <summary>The player ID who removed the object.</summary>
        public string RemovedByPlayerId;
    }

    /// <summary>
    /// Fired when the island's environment (time of day, weather) changes.
    /// </summary>
    public struct IslandEnvironmentChangedEvent : IGameEvent
    {
        /// <summary>Time of day in hours (0-24).</summary>
        public float TimeOfDay;

        /// <summary>Weather state (0=Clear, 1=Cloudy, 2=Rain, 3=Snow).</summary>
        public int WeatherState;
    }

    #endregion

    #region Minigame Events

    /// <summary>
    /// Fired when a minigame's state changes (Waiting, Playing, Ended, etc.).
    /// </summary>
    public struct MinigameStateChangedEvent : IGameEvent
    {
        /// <summary>The unique minigame identifier.</summary>
        public string MinigameId;

        /// <summary>The new state (0=Inactive, 1=Waiting, 2=Countdown, 3=Playing, 4=Ended).</summary>
        public int NewState;

        /// <summary>Time remaining in current phase if applicable.</summary>
        public float TimeRemaining;
    }

    /// <summary>
    /// Fired when a minigame score update occurs.
    /// </summary>
    public struct MinigameScoreEvent : IGameEvent
    {
        /// <summary>The minigame identifier.</summary>
        public string MinigameId;

        /// <summary>The player ID whose score changed.</summary>
        public string PlayerId;

        /// <summary>The new score value.</summary>
        public int NewScore;

        /// <summary>The point delta from the previous score.</summary>
        public int ScoreDelta;
    }

    /// <summary>
    /// Fired when a minigame round/match completes with final results.
    /// </summary>
    public struct MinigameCompletedEvent : IGameEvent
    {
        /// <summary>The minigame identifier.</summary>
        public string MinigameId;

        /// <summary>The local player's final score.</summary>
        public int FinalScore;

        /// <summary>The local player's final rank (1-based).</summary>
        public int FinalRank;

        /// <summary>XP awarded for participation.</summary>
        public int XPAwarded;

        /// <summary>Coins awarded.</summary>
        public int CoinsAwarded;
    }

    #endregion

    #region Progression & Achievement Events

    /// <summary>
    /// Fired when the player's level increases.
    /// </summary>
    public struct LevelUpEvent : IGameEvent
    {
        /// <summary>The new player level.</summary>
        public int NewLevel;

        /// <summary>The previous player level.</summary>
        public int PreviousLevel;

        /// <summary>New features/unlocks granted at this level.</summary>
        public string[] Unlocks;
    }

    /// <summary>
    /// Fired when an achievement is unlocked.
    /// </summary>
    public struct AchievementUnlockedEvent : IGameEvent
    {
        /// <summary>The achievement identifier.</summary>
        public string AchievementId;

        /// <summary>The display name of the achievement.</summary>
        public string AchievementName;

        /// <summary>The achievement description text.</summary>
        public string Description;
    }

    /// <summary>
    /// Fired when a daily quest objective is completed.
    /// </summary>
    public struct QuestCompletedEvent : IGameEvent
    {
        /// <summary>The quest identifier.</summary>
        public string QuestId;

        /// <summary>The quest display name.</summary>
        public string QuestName;

        /// <summary>Rewards granted for completion.</summary>
        public string[] RewardIds;
    }

    #endregion

    #region Social Graph Events

    /// <summary>
    /// Fired when the local player receives a friend request with full request details.
    /// </summary>
    public struct FriendRequestReceivedEvent : IGameEvent
    {
        /// <summary>The unique request identifier.</summary>
        public string RequestId;

        /// <summary>The player ID sending the friend request.</summary>
        public string SenderId;

        /// <summary>The display name of the requesting player.</summary>
        public string SenderName;

        /// <summary>Unix timestamp when the request was sent.</summary>
        public long Timestamp;
    }

    /// <summary>
    /// Fired when a friend request is accepted (by either party).
    /// </summary>
    public struct FriendRequestAcceptedEvent : IGameEvent
    {
        /// <summary>The player ID whose friendship was established.</summary>
        public string PlayerId;

        /// <summary>The display name of the new friend.</summary>
        public string PlayerName;
    }

    /// <summary>
    /// Fired when a friend is removed from the friend list.
    /// </summary>
    public struct FriendRemovedEvent : IGameEvent
    {
        /// <summary>The player ID of the removed friend.</summary>
        public string PlayerId;

        /// <summary>The display name of the removed friend.</summary>
        public string PlayerName;
    }

    /// <summary>
    /// Fired when a friend's presence status changes with full presence info.
    /// </summary>
    public struct FriendPresenceChangedEvent : IGameEvent
    {
        /// <summary>The friend's player ID.</summary>
        public string FriendId;

        /// <summary>The friend's display name.</summary>
        public string FriendName;

        /// <summary>The new presence status value.</summary>
        public int NewStatus;

        /// <summary>The new location string.</summary>
        public string NewLocation;

        /// <summary>The new location ID.</summary>
        public string NewLocationId;
    }

    /// <summary>
    /// Fired when a player is blocked.
    /// </summary>
    public struct PlayerBlockedEvent : IGameEvent
    {
        /// <summary>The player ID that was blocked.</summary>
        public string PlayerId;

        /// <summary>The display name of the blocked player.</summary>
        public string PlayerName;
    }

    /// <summary>
    /// Fired when the local player's profile is updated.
    /// </summary>
    public struct ProfileUpdatedEvent : IGameEvent
    {
        /// <summary>The player ID whose profile was updated.</summary>
        public string PlayerId;

        /// <summary>The field that was updated.</summary>
        public string UpdatedField;

        /// <summary>The new value of the updated field.</summary>
        public string NewValue;
    }

    /// <summary>
    /// Fired when a relationship level increases between two players.
    /// </summary>
    public struct RelationshipLeveledUpEvent : IGameEvent
    {
        /// <summary>The other player's ID.</summary>
        public string OtherPlayerId;

        /// <summary>The previous relationship level.</summary>
        public int OldLevel;

        /// <summary>The new relationship level.</summary>
        public int NewLevel;

        /// <summary>The title associated with the new level.</summary>
        public string NewTitle;
    }

    /// <summary>
    /// Fired when a badge/achievement is earned by the local player.
    /// </summary>
    public struct BadgeEarnedEvent : IGameEvent
    {
        /// <summary>The badge identifier.</summary>
        public string BadgeId;

        /// <summary>The badge display name.</summary>
        public string BadgeName;

        /// <summary>The badge rarity value.</summary>
        public int Rarity;

        /// <summary>The badge category value.</summary>
        public int Category;
    }

    /// <summary>
    /// Fired when a new social feed item is added.
    /// </summary>
    public struct FeedItemAddedEvent : IGameEvent
    {
        /// <summary>The unique feed item ID.</summary>
        public string ItemId;

        /// <summary>The feed type value.</summary>
        public int FeedType;

        /// <summary>The actor/player name associated with the feed item.</summary>
        public string ActorName;

        /// <summary>The description text of the feed item.</summary>
        public string Description;
    }

    #endregion

    #region System & Lifecycle Events

    /// <summary>
    /// Fired when the game state changes (Boot, MainMenu, Island, etc.).
    /// </summary>
    public struct GameStateChangedEvent : IGameEvent
    {
        /// <summary>The previous game state.</summary>
        public GameState PreviousState;

        /// <summary>The new game state.</summary>
        public GameState NewState;
    }

    /// <summary>
    /// Fired when a save operation completes (success or failure).
    /// </summary>
    public struct SaveCompletedEvent : IGameEvent
    {
        /// <summary>Whether the save was successful.</summary>
        public bool Success;

        /// <summary>The key that was saved.</summary>
        public string Key;

        /// <summary>Error message if save failed.</summary>
        public string ErrorMessage;
    }

    /// <summary>
    /// Fired when a load operation completes.
    /// </summary>
    public struct LoadCompletedEvent : IGameEvent
    {
        /// <summary>Whether the load was successful.</summary>
        public bool Success;

        /// <summary>The key that was loaded.</summary>
        public string Key;

        /// <summary>Error message if load failed.</summary>
        public string ErrorMessage;
    }

    /// <summary>
    /// Fired when the input device type changes (Keyboard, Touch, Gamepad).
    /// </summary>
    public struct InputDeviceChangedEvent : IGameEvent
    {
        /// <summary>The new input device type (0=KeyboardMouse, 1=Touch, 2=Gamepad).</summary>
        public int DeviceType;
    }

    #region Social Graph Events (Extended)

    /// <summary>
    /// Fired when a friend request is declined or rejected.
    /// </summary>
    public struct FriendRequestDeclinedEvent : IGameEvent
    {
        /// <summary>The player ID whose request was declined.</summary>
        public string PlayerId;
    }

    /// <summary>
    /// Fired when a player's presence status changes (online, offline, in-game, etc.).
    /// </summary>
    public struct PresenceChangedEvent : IGameEvent
    {
        /// <summary>The player's unique identifier.</summary>
        public string PlayerId;

        /// <summary>The new presence status.</summary>
        public PresenceStatus NewStatus;

        /// <summary>Human-readable location description.</summary>
        public string Location;

        /// <summary>The location identifier.</summary>
        public string LocationId;
    }

    /// <summary>
    /// Fired when a player is unblocked.
    /// </summary>
    public struct PlayerUnblockedEvent : IGameEvent
    {
        /// <summary>The player ID that was unblocked.</summary>
        public string PlayerId;
    }

    #endregion

    #region Interaction Events

    /// <summary>
    /// Fired when the local player taps on another player in the world.
    /// </summary>
    public struct PlayerTappedEvent : IGameEvent
    {
        /// <summary>The player ID of the tapped target.</summary>
        public string TargetPlayerId;

        /// <summary>The screen position where the tap occurred.</summary>
        public Vector2 ScreenPosition;
    }

    /// <summary>
    /// Fired when the local player long-presses on another player.
    /// </summary>
    public struct PlayerLongPressedEvent : IGameEvent
    {
        /// <summary>The player ID of the long-pressed target.</summary>
        public string TargetPlayerId;
    }

    /// <summary>
    /// Fired when a player's profile is viewed.
    /// </summary>
    public struct ProfileViewedEvent : IGameEvent
    {
        /// <summary>The viewer's player ID.</summary>
        public string ViewerId;

        /// <summary>The target profile's player ID.</summary>
        public string TargetId;
    }

    /// <summary>
    /// Fired when the interaction menu is opened for a target player.
    /// </summary>
    public struct InteractionMenuOpenedEvent : IGameEvent
    {
        /// <summary>The player ID of the interaction target.</summary>
        public string TargetPlayerId;

        /// <summary>The display name of the interaction target.</summary>
        public string TargetPlayerName;
    }

    #endregion

    #region Room Events

    /// <summary>
    /// Fired when the local player enters a room.
    /// </summary>
    public struct RoomEnteredEvent : IGameEvent
    {
        /// <summary>The unique room identifier.</summary>
        public string RoomId;

        /// <summary>The display name of the room.</summary>
        public string RoomName;

        /// <summary>The room type/category.</summary>
        public string RoomType;
    }

    /// <summary>
    /// Fired when the local player exits a room.
    /// </summary>
    public struct RoomExitedEvent : IGameEvent
    {
        /// <summary>The unique room identifier that was exited.</summary>
        public string RoomId;
    }

    /// <summary>
    /// Fired when the room browser UI is opened.
    /// </summary>
    public struct RoomBrowserOpenedEvent : IGameEvent { }

    /// <summary>
    /// Fired when a new room is created by the local player.
    /// </summary>
    public struct RoomCreatedEvent : IGameEvent
    {
        /// <summary>The unique room identifier.</summary>
        public string RoomId;

        /// <summary>The display name of the created room.</summary>
        public string RoomName;
    }

    #endregion

    #region Activity & Discovery Events

    /// <summary>
    /// Fired when a new activity or discoverable is found.
    /// </summary>
    public struct ActivityDiscoveredEvent : IGameEvent
    {
        /// <summary>The type of activity discovered.</summary>
        public ActivityType Type;

        /// <summary>Human-readable description of the activity.</summary>
        public string Description;

        /// <summary>The location where the activity was discovered.</summary>
        public string Location;
    }

    /// <summary>
    /// Fired when a scheduled event is about to start.
    /// </summary>
    public struct EventStartingEvent : IGameEvent
    {
        /// <summary>The unique event identifier.</summary>
        public string EventId;

        /// <summary>The display name of the event.</summary>
        public string EventName;

        /// <summary>Minutes remaining until the event starts.</summary>
        public int MinutesUntilStart;
    }

    /// <summary>
    /// Fired when a new notification is received.
    /// </summary>
    public struct NotificationReceivedEvent : IGameEvent
    {
        /// <summary>The unique notification identifier.</summary>
        public string NotificationId;

        /// <summary>The notification type.</summary>
        public NotificationType Type;
    }

    #endregion

    #region Party & Gathering Events

    /// <summary>
    /// Fired when the local player receives a party invitation.
    /// </summary>
    public struct PartyInviteReceivedEvent : IGameEvent
    {
        /// <summary>The unique party identifier.</summary>
        public string PartyId;

        /// <summary>The player ID who sent the invite.</summary>
        public string FromPlayerId;

        /// <summary>The display name of the inviting player.</summary>
        public string FromPlayerName;
    }

    /// <summary>
    /// Fired when the local player joins a party.
    /// </summary>
    public struct PartyJoinedEvent : IGameEvent
    {
        /// <summary>The unique party identifier.</summary>
        public string PartyId;

        /// <summary>The player ID of the party leader.</summary>
        public string LeaderId;
    }

    /// <summary>
    /// Fired when the local player leaves a party.
    /// </summary>
    public struct PartyLeftEvent : IGameEvent
    {
        /// <summary>The unique party identifier that was left.</summary>
        public string PartyId;
    }

    /// <summary>
    /// Fired when a party is disbanded.
    /// </summary>
    public struct PartyDisbandedEvent : IGameEvent
    {
        /// <summary>The unique party identifier that was disbanded.</summary>
        public string PartyId;
    }

    /// <summary>
    /// Fired when a player RSVPs to a gathering or event.
    /// </summary>
    public struct GatheringRSVPEvent : IGameEvent
    {
        /// <summary>The unique gathering identifier.</summary>
        public string GatheringId;

        /// <summary>True if attending, false if declining.</summary>
        public bool IsAttending;
    }

    #endregion

    #region Avatar Editor Events

    /// <summary>
    /// Fired when the avatar editor UI is opened.
    /// </summary>
    public struct AvatarEditorOpenedEvent : IGameEvent { }

    /// <summary>
    /// Fired when the avatar editor is closed.
    /// </summary>
    public struct AvatarEditorClosedEvent : IGameEvent
    {
        /// <summary>True if changes were saved, false if cancelled.</summary>
        public bool Saved;
    }

    /// <summary>
    /// Fired when an outfit is saved in the avatar editor.
    /// </summary>
    public struct OutfitSavedEvent : IGameEvent
    {
        /// <summary>The name of the saved outfit.</summary>
        public string OutfitName;
    }

    /// <summary>
    /// Fired when a new character is created during onboarding.
    /// </summary>
    public struct CharacterCreatedEvent : IGameEvent
    {
        /// <summary>The display name of the newly created player.</summary>
        public string PlayerName;
    }

    #endregion

    #region Camera Events

    /// <summary>
    /// Fired when the world camera zoom level changes.
    /// </summary>
    public struct CameraZoomChangedEvent : IGameEvent
    {
        /// <summary>The new zoom distance value.</summary>
        public float NewZoom;

        /// <summary>The zoom as a normalized percentage (0-1).</summary>
        public float ZoomPercent;
    }

    /// <summary>
    /// Fired when the world camera is panned to a new position.
    /// </summary>
    public struct CameraPannedEvent : IGameEvent
    {
        /// <summary>The new camera position in world space.</summary>
        public Vector3 NewPosition;
    }

    /// <summary>
    /// Fired when a camera shake effect is triggered.
    /// </summary>
    public struct CameraShookEvent : IGameEvent
    {
        /// <summary>The intensity of the shake (0-1).</summary>
        public float Intensity;
    }

    #endregion

    #region Settings Events

    /// <summary>
    /// Fired when a game setting is changed.
    /// </summary>
    public struct SettingsChangedEvent : IGameEvent
    {
        /// <summary>The key/identifier of the changed setting.</summary>
        public string SettingKey;

        /// <summary>The new value of the setting.</summary>
        public object NewValue;
    }

    /// <summary>
    /// Fired when a privacy setting is toggled.
    /// </summary>
    public struct PrivacyChangedEvent : IGameEvent
    {
        /// <summary>The privacy setting key.</summary>
        public string Setting;

        /// <summary>True if the setting is now enabled.</summary>
        public bool Enabled;
    }

    #endregion
}
