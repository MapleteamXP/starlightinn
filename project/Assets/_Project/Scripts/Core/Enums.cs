// ----------------------------------------------------------------------------
// KawaiiCool Island - Core Framework
// ----------------------------------------------------------------------------
// Enums.cs - Centralized shared enumerations used across all game systems
// ----------------------------------------------------------------------------
// Contains all enum definitions that are referenced by multiple systems
// (events, managers, UI, networking) to ensure consistency and avoid
// duplication across the codebase.
// ----------------------------------------------------------------------------

namespace KawaiiCoolIsland.Core
{
    #region Presence & Social

    /// <summary>
    /// Represents a player's online presence status.
    /// </summary>
    public enum PresenceStatus
    {
        /// <summary>Player is offline.</summary>
        Offline,
        /// <summary>Player is online but not in a specific location.</summary>
        Online,
        /// <summary>Player is currently in-game on their island.</summary>
        InIsland,
        /// <summary>Player is in a social hub area.</summary>
        InHub,
        /// <summary>Player is in a minigame.</summary>
        InMinigame,
        /// <summary>Player is in a private room.</summary>
        InRoom,
        /// <summary>Player is in the avatar editor.</summary>
        InAvatarEditor,
        /// <summary>Player is away from keyboard/controller.</summary>
        Away,
        /// <summary>Player has set Do Not Disturb.</summary>
        DoNotDisturb
    }

    /// <summary>
    /// Categories for sorting or filtering the friend list.
    /// </summary>
    public enum FriendCategory
    {
        /// <summary>All friends regardless of status.</summary>
        All,
        /// <summary>Friends who are currently online.</summary>
        Online,
        /// <summary>Friends who are currently offline.</summary>
        Offline,
        /// <summary>Friends in the same location.</summary>
        Nearby,
        /// <summary>Favorite or starred friends.</summary>
        Favorites
    }

    /// <summary>
    /// Sort options for the friend list.
    /// </summary>
    public enum FriendSort
    {
        /// <summary>Sort alphabetically by name.</summary>
        Name,
        /// <summary>Sort by online status first.</summary>
        Status,
        /// <summary>Sort by relationship level.</summary>
        RelationshipLevel,
        /// <summary>Sort by most recent interaction.</summary>
        RecentlyInteracted
    }

    #endregion

    #region Activity & Discovery

    /// <summary>
    /// Types of discoverable activities in the game world.
    /// </summary>
    public enum ActivityType
    {
        /// <summary>A hidden collectible or treasure.</summary>
        Collectible,
        /// <summary>An interactive world object.</summary>
        Interactive,
        /// <summary>A hidden easter egg or secret.</summary>
        Secret,
        /// <summary>A daily or weekly challenge.</summary>
        Challenge,
        /// <summary>A community event or celebration.</summary>
        CommunityEvent,
        /// <summary>A special seasonal activity.</summary>
        Seasonal,
        /// <summary>A photo spot or scenic location.</summary>
        PhotoSpot,
        /// <summary>A hidden minigame trigger.</summary>
        HiddenMinigame
    }

    /// <summary>
    /// Broad categories for grouping activities.
    /// </summary>
    public enum ActivityCategory
    {
        /// <summary>Exploration-related activities.</summary>
        Exploration,
        /// <summary>Social interaction activities.</summary>
        Social,
        /// <summary>Creative building activities.</summary>
        Creative,
        /// <summary>Competitive activities.</summary>
        Competitive,
        /// <summary>Relaxing or casual activities.</summary>
        Casual
    }

    /// <summary>
    /// The current state of an activity instance.
    /// </summary>
    public enum ActivityState
    {
        /// <summary>Activity is locked and not yet available.</summary>
        Locked,
        /// <summary>Activity is available but not started.</summary>
        Available,
        /// <summary>Activity is currently in progress.</summary>
        InProgress,
        /// <summary>Activity has been completed.</summary>
        Completed,
        /// <summary>Activity has expired.</summary>
        Expired
    }

    #endregion

    #region Notification & Feed

    /// <summary>
    /// Types of notifications delivered to the player.
    /// </summary>
    public enum NotificationType
    {
        /// <summary>A friend request was received.</summary>
        FriendRequest,
        /// <summary>A party invitation was received.</summary>
        PartyInvite,
        /// <summary>A gathering or event reminder.</summary>
        GatheringReminder,
        /// <summary>A new message or chat mention.</summary>
        Message,
        /// <summary>A level-up or progression milestone.</summary>
        LevelUp,
        /// <summary>An achievement or badge unlock.</summary>
        Achievement,
        /// <summary>A system or maintenance announcement.</summary>
        System,
        /// <summary>A daily quest reminder.</summary>
        DailyQuest,
        /// <summary>A trade or economy notification.</summary>
        Trade,
        /// <summary>A room or event invite.</summary>
        RoomInvite
    }

    /// <summary>
    /// Types of items that can appear in the social activity feed.
    /// </summary>
    public enum FeedType
    {
        /// <summary>A player leveled up.</summary>
        LevelUp,
        /// <summary>A player earned an achievement.</summary>
        Achievement,
        /// <summary>A player joined the game.</summary>
        PlayerJoined,
        /// <summary>A player earned a badge.</summary>
        BadgeEarned,
        /// <summary>A player decorated their island.</summary>
        IslandUpdate,
        /// <summary>A player started a minigame.</summary>
        MinigameStart,
        /// <summary>A player won a minigame.</summary>
        MinigameWin,
        /// <summary>A player made a new friend.</summary>
        Friendship,
        /// <summary>A player updated their outfit.</summary>
        OutfitUpdate,
        /// <summary>A player created a room.</summary>
        RoomCreated,
        /// <summary>A scheduled event started.</summary>
        EventStart
    }

    #endregion

    #region Room

    /// <summary>
    /// Categories for room classification and filtering.
    /// </summary>
    public enum RoomCategory
    {
        /// <summary>Default or uncategorized room.</summary>
        General,
        /// <summary>Social hangout space.</summary>
        Social,
        /// <summary>Minigame or competitive space.</summary>
        Minigame,
        /// <summary>Roleplay or themed space.</summary>
        Roleplay,
        /// <summary>Player-created event space.</summary>
        Event,
        /// <summary>Shopping or commerce space.</summary>
        Shop,
        /// <summary>Relaxation or chill space.</summary>
        Chill,
        /// <summary>Art or showcase gallery.</summary>
        Gallery
    }

    /// <summary>
    /// Sort options for the room browser.
    /// </summary>
    public enum RoomSort
    {
        /// <summary>Sort by most recently active.</summary>
        Recent,
        /// <summary>Sort by player count descending.</summary>
        Popularity,
        /// <summary>Sort alphabetically by name.</summary>
        Name,
        /// <summary>Sort by creation date.</summary>
        Newest
    }

    #endregion

    #region Event & Calendar

    /// <summary>
    /// Types of scheduled events in the game.
    /// </summary>
    public enum EventType
    {
        /// <summary>One-time special event.</summary>
        Special,
        /// <summary>Daily recurring event.</summary>
        Daily,
        /// <summary>Weekly recurring event.</summary>
        Weekly,
        /// <summary>Weekend-only event.</summary>
        Weekend,
        /// <summary>Seasonal or holiday event.</summary>
        Seasonal,
        /// <summary>Community or player-run event.</summary>
        Community
    }

    /// <summary>
    /// The current lifecycle state of a scheduled event.
    /// </summary>
    public enum EventStatus
    {
        /// <summary>Event is scheduled but not yet active.</summary>
        Upcoming,
        /// <summary>Event is currently running.</summary>
        Active,
        /// <summary>Event has ended.</summary>
        Ended,
        /// <summary>Event was cancelled.</summary>
        Cancelled
    }

    #endregion

    #region Party & Gathering

    /// <summary>
    /// Types of activities a party can engage in.
    /// </summary>
    public enum PartyActivityType
    {
        /// <summary>No specific activity assigned.</summary>
        None,
        /// <summary>Exploring the world together.</summary>
        Exploring,
        /// <summary>Playing a minigame as a group.</summary>
        Minigame,
        /// <summary>Visiting a specific room together.</summary>
        RoomVisit,
        /// <summary>Social hangout on an island.</summary>
        IslandHangout,
        /// <summary>Participating in a scheduled event.</summary>
        Event
    }

    /// <summary>
    /// RSVP response status for gatherings.
    /// </summary>
    public enum RSVPStatus
    {
        /// <summary>No response yet.</summary>
        Pending,
        /// <summary>Player is attending.</summary>
        Attending,
        /// <summary>Player is not attending.</summary>
        NotAttending,
        /// <summary>Player might attend.</summary>
        Maybe
    }

    /// <summary>
    /// The current state of a gathering or party event.
    /// </summary>
    public enum GatheringStatus
    {
        /// <summary>Gathering is being planned.</summary>
        Planning,
        /// <summary>Invites have been sent.</summary>
        Inviting,
        /// <summary>Gathering is currently happening.</summary>
        InProgress,
        /// <summary>Gathering has concluded.</summary>
        Finished,
        /// <summary>Gathering was cancelled.</summary>
        Cancelled
    }

    /// <summary>
    /// Types of invites that can be sent between players.
    /// </summary>
    public enum InviteType
    {
        /// <summary>Invite to join a party.</summary>
        Party,
        /// <summary>Invite to visit a room.</summary>
        Room,
        /// <summary>Invite to join a minigame.</summary>
        Minigame,
        /// <summary>Invite to a gathering or event.</summary>
        Gathering,
        /// <summary>General friend request.</summary>
        FriendRequest
    }

    #endregion

    #region Camera

    /// <summary>
    /// Rendering mode for the world camera.
    /// </summary>
    public enum CameraRenderMode
    {
        /// <summary>Standard 3D perspective rendering.</summary>
        Perspective3D,
        /// <summary>Orthographic rendering for 2D-like views.</summary>
        Orthographic,
        /// <summary>Isometric-style projection.</summary>
        Isometric,
        /// <summary>Cinematic or cutscene rendering mode.</summary>
        Cinematic
    }

    /// <summary>
    /// Contextual camera behavior modes.
    /// </summary>
    public enum CameraContext
    {
        /// <summary>Default free-roam camera.</summary>
        Default,
        /// <summary>Camera focused on the local player.</summary>
        FollowPlayer,
        /// <summary>Camera focused on a specific target or object.</summary>
        FocusTarget,
        /// <summary>Overview of an island or large area.</summary>
        Overview,
        /// <summary>Close-up for interaction or dialogue.</summary>
        CloseUp,
        /// <summary>Selfie or portrait mode.</summary>
        Selfie
    }

    /// <summary>
    /// Types of camera shake effects.
    /// </summary>
    public enum ShakeType
    {
        /// <summary>Gentle ambient shake.</summary>
        Gentle,
        /// <summary>Moderate impact shake.</summary>
        Moderate,
        /// <summary>Strong violent shake.</summary>
        Strong,
        /// <summary>Short sharp jolt.</summary>
        Jolt,
        /// <summary>Continuous rumble.</summary>
        Rumble,
        /// <summary>Explosion-style heavy shake.</summary>
        Explosion
    }

    #endregion

    #region Avatar & Wardrobe

    /// <summary>
    /// Sort options for the wardrobe/outfit browser.
    /// </summary>
    public enum WardrobeSort
    {
        /// <summary>Sort alphabetically.</summary>
        Name,
        /// <summary>Sort by most recently acquired.</summary>
        RecentlyAcquired,
        /// <summary>Sort by rarity.</summary>
        Rarity,
        /// <summary>Sort by item category.</summary>
        Category,
        /// <summary>Sort by favorites first.</summary>
        Favorites
    }

    /// <summary>
    /// Body part categories for avatar customization.
    /// </summary>
    public enum BodyPart
    {
        /// <summary>Overall body shape and size.</summary>
        Body,
        /// <summary>Skin tone and texture.</summary>
        Skin,
        /// <summary>Height adjustment.</summary>
        Height,
        /// <summary>Torso clothing.</summary>
        Torso,
        /// <summary>Leg clothing.</summary>
        Legs,
        /// <summary>Footwear.</summary>
        Feet,
        /// <summary>Hands and gloves.</summary>
        Hands
    }

    /// <summary>
    /// Face part categories for avatar customization.
    /// </summary>
    public enum FacePart
    {
        /// <summary>Eye shape and color.</summary>
        Eyes,
        /// <summary>Eyebrow style.</summary>
        Eyebrows,
        /// <summary>Nose shape.</summary>
        Nose,
        /// <summary>Mouth and lip style.</summary>
        Mouth,
        /// <summary>Facial expression preset.</summary>
        Expression,
        /// <summary>Blush or face markings.</summary>
        Markings,
        /// <summary>Face accessories like glasses.</summary>
        Accessories
    }

    #endregion

    #region Interaction

    /// <summary>
    /// Types of interactions available between players.
    /// </summary>
    public enum InteractionType
    {
        /// <summary>Send a friend request.</summary>
        FriendRequest,
        /// <summary>Send a direct message.</summary>
        Whisper,
        /// <summary>Invite to a party.</summary>
        PartyInvite,
        /// <summary>Invite to a room.</summary>
        RoomInvite,
        /// <summary>Request a trade.</summary>
        TradeRequest,
        /// <summary>View the player's profile.</summary>
        ViewProfile,
        /// <summary>Block the player.</summary>
        Block,
        /// <summary>Report the player.</summary>
        Report,
        /// <summary>Send a gift.</summary>
        SendGift,
        /// <summary>Request to follow the player.</summary>
        Follow
    }

    #endregion

    #region Trending & Shortcuts

    /// <summary>
    /// Categories for trending content filtering.
    /// </summary>
    public enum TrendCategory
    {
        /// <summary>Trending rooms across all categories.</summary>
        All,
        /// <summary>Trending social hangouts.</summary>
        Social,
        /// <summary>Trending minigame rooms.</summary>
        Minigames,
        /// <summary>Trending creative builds.</summary>
        Creative,
        /// <summary>Trending events.</summary>
        Events,
        /// <summary>New and rising rooms.</summary>
        NewAndRising
    }

    /// <summary>
    /// Types of UI shortcuts available to players.
    /// </summary>
    public enum ShortcutType
    {
        /// <summary>Quick access to friend list.</summary>
        Friends,
        /// <summary>Quick access to inventory.</summary>
        Inventory,
        /// <summary>Quick access to settings.</summary>
        Settings,
        /// <summary>Quick access to the map.</summary>
        Map,
        /// <summary>Quick access to notifications.</summary>
        Notifications,
        /// <summary>Quick access to activity feed.</summary>
        ActivityFeed,
        /// <summary>Quick access to the shop.</summary>
        Shop,
        /// <summary>Quick access to quests.</summary>
        Quests
    }

    #endregion
}
