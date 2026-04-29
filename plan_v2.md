# KawaiiCool Island v2.0 — Premium Social World Transformation

## Vision
Transform KawaiiCool Island from a prototype social game into a premium, scalable, highly social virtual world experience inspired by the best of Habbo (room navigation, friend tracking) and BoomBang (custom spaces, mini-games, social interaction) — while remaining original, modern, and professionally executed.

## New Systems to Build

### 1. Social Graph System (`Scripts/Social/`)
**Purpose**: The backbone of all social features — friends, presence, profiles, relationships
- `SocialGraphManager.cs` — Central manager for all social data
- `PlayerProfile.cs` — Rich player profile data (appearance, stats, badges, rooms, bio)
- `FriendList.cs` — Friend management with categories (close friends, acquaintances, blocked)
- `PresenceManager.cs` — Online/offline/away/busy/in-room status with real-time updates
- `RelationshipManager.cs` — Relationship levels (stranger → acquaintance → friend → close friend → bestie)
- `PlayerCard.cs` — UI component for player profile cards (click to view, add friend, whisper, trade, visit room)
- `SocialFeed.cs` — Activity feed showing friend activities (joined room, earned badge, new outfit, etc.)

### 2. Player Interaction System (`Scripts/Interaction/`)
**Purpose**: Tap/click players to interact — the core social discovery mechanic
- `PlayerInteractable.cs` — Component making players clickable/interactable
- `InteractionMenu.cs` — Context menu that appears when clicking another player
- `ProfileViewer.cs` — Full profile viewer panel with tabs (Profile, Outfits, Rooms, Stats, Badges)
- `FriendRequestUI.cs` — Send/receive friend request flow
- `QuickActions.cs` — Quick action buttons (wave, hug, dance together, follow)

### 3. Enhanced Avatar Editor (`Scripts/Avatar/Editor/`)
**Purpose**: Deep character creation and editing — the player's first impression
- `CharacterCreator.cs` — Full character creation wizard (first-time flow)
- `AvatarEditor.cs` — Enhanced avatar editing with live preview, undo/redo
- `OutfitPresetManager.cs` — Save/load/share outfit presets
- `BodyCustomizer.cs` — Body shape, skin tone, height, proportions
- `FaceCustomizer.cs` — Eyes, mouth, eyebrows, expressions, makeup
- `WardrobeUI.cs` — Browse all owned clothing with filtering/search

### 4. Room Discovery & Navigation (`Scripts/Rooms/`)
**Purpose**: Find and navigate rooms — the core world navigation loop
- `RoomBrowser.cs` — Browse all rooms with filters (popular, new, friends, category)
- `RoomCategory.cs` — Room categories (Games, Social, Chill, Creative, Events, Official)
- `RoomNavigator.cs` — Quick navigation to favorite/bookmarked rooms
- `RoomSearch.cs` — Search rooms by name, owner, tags
- `RoomThumbnailGenerator.cs` — Auto-generate room thumbnails for the browser
- `RoomInstanceManager.cs` — Handle entering/exiting rooms with loading

### 5. Enhanced Camera System (`Scripts/Camera/`)
**Purpose**: Smooth, intuitive camera for all platforms
- `WorldCameraController.cs` — Main camera with smooth follow, zoom, pan
- `ZoomController.cs` — Pinch-to-zoom on mobile, scroll wheel on desktop, smooth zoom transitions
- `CameraBounds.cs` — Keep camera within world bounds
- `CameraShake.cs` — Screen shake effects
- `CinemachineSetup.cs` — Cinemachine virtual cameras for different contexts

### 6. Activity & Event Discovery (`Scripts/Discovery/`)
**Purpose**: Find things to do — what's happening right now
- `ActivityFeedManager.cs` — Real-time activity feed (friends, trending, nearby)
- `EventCalendar.cs` — Scheduled events with countdowns
- `TrendingRooms.cs` — Algorithm for trending/popular rooms
- `RecommendedActivities.cs` — Personalized recommendations based on player behavior
- `NotificationHub.cs` — Central notification system for all social events

### 7. Gathering & Party System (`Scripts/Gatherings/`)
**Purpose**: Group activities and social coordination
- `PartyManager.cs` — Create/join/leave parties with party chat
- `GatheringManager.cs` — Scheduled gatherings with RSVP
- `GroupActivity.cs` — Co-op activities (group photo, group dance, group quests)
- `InviteSystem.cs` — Invite friends to rooms, parties, minigames

### 8. Enhanced UI Panels (`Scripts/UI/Panels/`)
**Purpose**: All the new UI screens for social features
- `FriendListPanel.cs` — Friend list with presence indicators, search, categories
- `ProfilePanel.cs` — Full profile viewer with tabs
- `RoomBrowserPanel.cs` — Room discovery browser
- `ActivityFeedPanel.cs` — Social activity feed
- `CharacterCreatorPanel.cs` — Character creation wizard UI
- `SettingsPanel.cs` — Game settings with social preferences

## Integration Points

### EventBus New Events
```csharp
public struct FriendRequestReceivedEvent : IGameEvent { public string FromPlayerId; public string FromPlayerName; }
public struct FriendRequestAcceptedEvent : IGameEvent { public string PlayerId; public string PlayerName; }
public struct PresenceChangedEvent : IGameEvent { public string PlayerId; public PresenceStatus NewStatus; public string Location; }
public struct PlayerTappedEvent : IGameEvent { public string TargetPlayerId; public Vector2 ScreenPosition; }
public struct RoomEnteredEvent : IGameEvent { public string RoomId; public string RoomName; public string RoomType; }
public struct ActivityDiscoveredEvent : IGameEvent { public ActivityType Type; public string Description; public string Location; }
public struct ProfileViewedEvent : IGameEvent { public string ViewerId; public string TargetId; }
```

### Multiplayer Extensions
- NetworkVariables for presence status
- RPCs for friend requests, invites, party coordination
- Proximity-based player discovery

### Backend Extensions
- PlayFab: Friend data, presence, player profiles
- REST API: Room listings, activity feed, recommendations
- Analytics: Social feature usage tracking

## Files to Modify
- `GameEvents.cs` — Add new social events
- `UIManager.cs` — Register new panels
- `Bootstrapper.cs` — Initialize new managers
- `GameManager.cs` — Add social game states
