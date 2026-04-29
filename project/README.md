# KawaiiCool Island v2.0 — Premium Social Virtual World

> The Ultimate Cross-Platform Social Hangout Game — Inspired by the best of classic social worlds, reimagined for today.
> 
> A kawaii-cool virtual world where players create unique avatars, build dream islands, discover rooms, make friends, join parties, play minigames, and create unforgettable memories together.

---

## What's New in v2.0

### The Social World Transformation

KawaiiCool Island has evolved from a prototype social game into a **premium, scalable, highly social virtual world**. Drawing inspiration from Habbo's room navigation and friend tracking, and BoomBang's custom spaces and social interaction — while being completely original, modern, and professionally executed.

| v1.0 Feature | v2.0 Enhancement |
|---------------|------------------|
| Basic avatar swap | **Deep character creator** with body shapes, facial features, expressions |
| Simple room entry | **Habbo-style room browser** with categories, search, trending, favorites |
| Basic chat | **Full social layer** — friends, presence, profiles, relationships, activity feed |
| Static camera | **Buttery-smooth camera** with pinch zoom, pan, shake, cinemachine |
| Solo minigames | **Party system** — gather friends, coordinate, group activities |
| Basic UI | **7 new responsive panels** — friend list, profile viewer, room browser, activity feed, character creator, settings, notifications |

---

## Project Overview

| Property | Value |
|----------|-------|
| **Engine** | Unity 2023.2+ LTS |
| **Render Pipeline** | Universal Render Pipeline (URP) 2D |
| **Platforms** | Android, iOS, Windows, macOS |
| **Networking** | Netcode for GameObjects + Unity Relay |
| **Backend** | Firebase + PlayFab hybrid |
| **Codebase** | **126 C# files, 73,000+ lines** |

---

## System Architecture v2.0

```
+-------------------------------------------------------------+
|                    KAWAIICOOL ISLAND v2.0                   |
|              Premium Cross-Platform Social World              |
+-------------------------------------------------------------+
|                                                             |
|  SOCIAL LAYER (NEW in v2.0)                                |
|  +------------------+  +------------------+                 |
|  | SOCIAL GRAPH     |  | PRESENCE         |                 |
|  | - Friends        |  | - Online/Offline |                 |
|  | - Friend Requests|  | - Location Aware |                 |
|  | - Block/Mute     |  | - Auto-Away      |                 |
|  | - Relationships  |  | - Status Updates   |                 |
|  +------------------+  +------------------+                 |
|  +------------------+  +------------------+                 |
|  | PLAYER PROFILES  |  | ACTIVITY FEED    |                 |
|  | - Rich Profiles  |  | - Friend Activity|                 |
|  | - Badges         |  | - Trending Rooms |                 |
|  | - Stats          |  | - Event Calendar |                 |
|  | - Outfit History |  | - Notifications  |                 |
|  +------------------+  +------------------+                 |
|                                                             |
|  INTERACTION LAYER (NEW in v2.0)                           |
|  +------------------+  +------------------+                 |
|  | TAP TO INTERACT  |  | RADIAL MENU      |                 |
|  | - Click Players  |  | - View Profile   |                 |
|  | - Raycast Select |  | - Add Friend     |                 |
|  | - Highlight      |  | - Whisper/Trade  |                 |
|  +------------------+  +------------------+                 |
|  +------------------+  +------------------+                 |
|  | PROFILE VIEWER   |  | QUICK ACTIONS    |                 |
|  | - 5 Tab Panel    |  | - Wave/Hug/Dance |                 |
|  | - Mutual Friends |  | - Follow         |                 |
|  | - Minigame Stats |  | - Trade          |                 |
|  +------------------+  +------------------+                 |
|                                                             |
|  WORLD NAVIGATION (NEW in v2.0)                            |
|  +------------------+  +------------------+                 |
|  | ROOM BROWSER     |  | ROOM NAVIGATOR   |                 |
|  | - Categories     |  | - Home/Hub       |                 |
|  | - Search/Filter  |  | - Favorites      |                 |
|  | - Trending       |  | - History        |                 |
|  | - Pagination     |  | - Friend Rooms   |                 |
|  +------------------+  +------------------+                 |
|                                                             |
|  CAMERA SYSTEM (NEW in v2.0)                               |
|  +------------------+  +------------------+                 |
|  | PINCH TO ZOOM    |  | SMOOTH FOLLOW    |                 |
|  | - Mobile Pinch   |  | - Look Ahead     |                 |
|  | - Scroll Zoom    |  | - Dynamic Deadzone|                |
|  | - UI Controls    |  | - Edge Panning  |                 |
|  +------------------+  +------------------+                 |
|                                                             |
|  PARTY & GATHERINGS (NEW in v2.0)                          |
|  +------------------+  +------------------+                 |
|  | PARTY SYSTEM     |  | GATHERINGS       |                 |
|  | - Create/Join    |  | - RSVP Events    |                 |
|  | - Party Chat     |  | - Scheduled      |                 |
|  | - Follow Leader  |  | - Host/Attend    |                 |
|  | - Group Activities|  | - Calendar       |                 |
|  +------------------+  +------------------+                 |
|                                                             |
|  ORIGINAL v1.0 SYSTEMS (CORE FOUNDATION)                   |
|  +------------------+  +------------------+                 |
|  | AVATAR SYSTEM    |  | ISLAND EDITOR    |                 |
|  | - 9-Layer Render |  | - Drag/Drop      |                 |
|  | - Sprite Swap    |  | - Grid/Free      |                 |
|  | - Emotes         |  | - Save/Load      |                 |
|  | - Body/Face Edit |  | - Y-Sort Depth   |                 |
|  +------------------+  +------------------+                 |
|  +------------------+  +------------------+                 |
|  | MULTIPLAYER      |  | MINIGAMES (5)    |                 |
|  | - Netcode NGO    |  | - Rhythm Dance   |                 |
|  | - Room-Based     |  | - Fashion Vote   |                 |
|  | - Proximity Chat |  | - Coin Rush      |                 |
|  | - Smooth Interp  |  | - Trivia         |                 |
|  +------------------+  +------------------+                 |
|  +------------------+  +------------------+                 |
|  | UI FRAMEWORK     |  | INVENTORY & SHOP |                 |
|  | - 12 Animations  |  | - Drag-Drop Grid |                 |
|  | - Responsive     |  | - Daily Rotation |                 |
|  | - Touch Controls |  | - 3 Currencies   |                 |
|  | - Safe Area      |  | - Daily Rewards  |                 |
|  +------------------+  +------------------+                 |
|  +------------------+  +------------------+                 |
|  | CHAT SYSTEM      |  | AUDIO SYSTEM     |                 |
|  | - 6 Channels     |  | - Dynamic Music  |                 |
|  | - Chat Bubbles   |  | - SFX Pooling    |                 |
|  | - Profanity      |  | - Spatial Audio  |                 |
|  | - Slash Commands |  | - Voice Chat Stub|                 |
|  +------------------+  +------------------+                 |
|                                                             |
|  BACKEND LAYER                                              |
|  +------------------+  +------------------+                 |
|  | FIREBASE         |  | PLAYFAB          |                 |
|  | - Auth           |  | - Economy        |                 |
|  | - Analytics      |  | - Cloud Save     |                 |
|  | - Crashlytics    |  | - Leaderboards   |                 |
|  | - Remote Config  |  | - Friends        |                 |
|  +------------------+  +------------------+                 |
|  +------------------+  +------------------+                 |
|  | CUSTOM REST API  |  | SERVER VALIDATION|                 |
|  | - Profiles       |  | - Purchase Check |                 |
|  | - Trading        |  | - Anti-Cheat     |                 |
|  | - Reporting      |  | - State Verify   |                 |
|  +------------------+  +------------------+                 |
+-------------------------------------------------------------+
```

---

## Quick Start

### Prerequisites

- **Unity Hub** with Unity 2023.2.x LTS installed
- **Platform modules**: Android Build Support, iOS Build Support (Mac only)
- **IDE**: Visual Studio 2022, VS Code, or Rider
- Optional: Firebase SDK, PlayFab SDK (for backend features)

### Setup Instructions

1. **Clone or extract** this project to your desired location
2. **Open Unity Hub** → Add project → Select the `KawaiiCoolIsland` folder
3. **Wait for Unity** to import and compile all scripts (first import may take 5-10 minutes)
4. **Open the Boot scene** at `Assets/_Project/Scenes/Boot.unity`
5. **Press Play** to run the game

### Required Package Setup

The following packages will auto-install via the Package Manager:

| Package | Version | Purpose |
|---------|---------|---------|
| URP | 14.0.11 | 2D rendering pipeline |
| Netcode for GameObjects | 1.8.1 | Multiplayer networking |
| Input System | 1.7.0 | Cross-platform input |
| 2D Animation | 9.1.0 | Sprite rigging & swap |
| TextMeshPro | 3.0.9 | UI text rendering |
| Unity Transport | 2.1.0 | Network transport layer |

### Optional SDK Integration

For full backend functionality, install:

**Firebase** (via Unity Package Manager or external SDK):
```
Window > Package Manager > Add package from git URL
com.google.firebase.app
com.google.firebase.auth
com.google.firebase.analytics
com.google.firebase.crashlytics
com.google.firebase.remote-config
com.google.firebase.messaging
```

**PlayFab** (via Unity Asset Store or Package Manager):
```
Window > Package Manager > Packages: In Project
com.playfab.unitysdk
```

After installing, add these symbols to **Player Settings > Other Settings > Scripting Define Symbols**:
- `FIREBASE` - Enable Firebase integration
- `PLAYFAB` - Enable PlayFab integration

---

## All Systems v2.0

### 1. Social Graph System (NEW v2.0)

**Files**: `Assets/_Project/Scripts/Social/` (6 files, 5,352 lines)

The backbone of all social features:

- **Friend Management**: Send/accept/decline requests, remove friends, block/unblock, categories (close friends, acquaintances)
- **Presence System**: Real-time online/offline/away/busy/in-room status with location awareness
- **Relationship Levels**: 10-tier progression from Stranger to Bestie with XP system, colors, and unlockable rewards
- **Player Profiles**: Rich profiles with bio, stats, badges, room ownership, minigame history
- **Social Feed**: Activity feed showing friend activities — joined rooms, earned badges, new outfits, won minigames
- **Badge System**: 50+ collectible badges for milestones and achievements

**Key Classes**: `SocialGraphManager`, `PlayerProfileManager`, `PresenceManager`, `RelationshipManager`, `SocialFeedManager`, `BadgeManager`

---

### 2. Player Interaction System (NEW v2.0)

**Files**: `Assets/_Project/Scripts/Interaction/` (6 files, 3,274 lines)

Tap/click players to interact — the core social discovery mechanic:

- **Player Interactable**: Attach to player prefabs. Click/tap to select. Long-press for menu. Distance-based interaction range.
- **Radial Context Menu**: Circular menu with 13 actions — View Profile, Add Friend, Whisper, Gift, Invite Room, Invite Party, Trade, Report, Block, Follow, Wave, Hug, Dance Together
- **Profile Viewer**: Full 5-tab profile panel (Profile, Outfits, Rooms, Stats, Badges) with mutual friends display
- **Friend Request UI**: Send/receive/accept/decline friend requests with player search
- **Quick Actions**: Action bar for Wave, Hug, High Five, Dance Together, Sit Together, Follow, Trade
- **Player Selector**: Raycast-based selection for both mouse and touch with visual indicators

---

### 3. Enhanced Avatar Editor & Character Creator (NEW v2.0)

**Files**: `Assets/_Project/Scripts/Avatar/Editor/` (6 files, 3,275 lines)

Deep character creation and editing:

- **Character Creator**: 6-step wizard for new players — Body → Face → Hair → Clothing → Accessories → Name
- **Avatar Editor**: Full editing with 8 category tabs, undo/redo stack (50 states), live preview
- **Outfit Presets**: Save/load/share up to 20 outfit presets with thumbnails
- **Body Customizer**: Height, width, head size sliders (0.8x to 1.2x), skin tone picker with presets
- **Face Customizer**: Eye type/size/color, eyebrow type, mouth type, expressions, makeup (blush + lip)
- **Wardrobe UI**: Browse all owned clothing with category/rarity/search/favorites filtering, 5 sort modes

---

### 4. Room Discovery & Navigation (NEW v2.0)

**Files**: `Assets/_Project/Scripts/Rooms/` (6 files, 3,829 lines)

Habbo-style room browser and navigation:

- **Room Browser**: Browse all rooms with 9 categories (All, Games, Social, Chill, Creative, Events, Official, Shopping, Roleplay, New)
- **Search & Filter**: Search by name, owner, tags. Filters for official rooms, has space, friends inside
- **Trending Algorithm**: Weighted scoring based on player count, visit rate, friend activity, recency
- **Pagination**: 20 rooms per page with next/previous navigation
- **Room Navigator**: Quick shortcuts to Home, Hub, Favorites, History, Friend Rooms
- **Room Thumbnails**: Auto-generated bird's-eye camera captures for room previews
- **Favorites & History**: Bookmark rooms, view visit history with timestamps

---

### 5. Camera & Zoom System (NEW v2.0)

**Files**: `Assets/_Project/Scripts/Camera/` (5 files, 2,296 lines)

Buttery-smooth camera for all platforms:

- **World Camera**: Smooth follow with look-ahead, dynamic dead zone, configurable damping
- **Pinch-to-Zoom**: Two-finger pinch on mobile with smooth interpolation
- **Scroll Zoom**: Mouse wheel on desktop with configurable sensitivity
- **Pan Controls**: Touch drag, two-finger pan, middle-mouse pan, edge panning
- **Camera Bounds**: Keep camera within world bounds with soft padding
- **Screen Shake**: 4 shake types (Random, Perlin, Directional, Zoom) with ScriptableObject profiles
- **Cinemachine**: Optional virtual camera setup for different contexts (Follow, Overview, CloseUp, Event)

---

### 6. Activity & Event Discovery (NEW v2.0)

**Files**: `Assets/_Project/Scripts/Discovery/` (5 files, 2,228 lines)

Find things to do — what's happening now:

- **Activity Feed**: Real-time feed with 8 activity types — friend activities, trending rooms, events, minigames, achievements
- **Event Calendar**: Scheduled events with RSVP, countdown timers, player-hosted events
- **Trending Rooms**: Algorithm tracking player count, visit rate, friend activity, recency decay
- **Recommended Activities**: Personalized recommendations based on play history and preferences
- **Notification Hub**: Central notification system with Do Not Disturb, per-type toggles, deep links

---

### 7. Party & Gathering System (NEW v2.0)

**Files**: `Assets/_Project/Scripts/Gatherings/` (4 files, 2,669 lines)

Group coordination and social events:

- **Party Manager**: Create/join/leave parties up to 8 players. Party chat, leader promotion, follow leader to room
- **Gathering Manager**: Scheduled gatherings with 5 RSVP statuses (Invited/Going/Maybe/NotGoing/NoResponse)
- **Group Activities**: Co-op activities — Group Photo, Group Dance (synchronized), Scavenger Hunt
- **Invite System**: Unified invites for rooms, parties, minigames, trades, friend requests, gatherings

---

### 8. New UI Panels (NEW v2.0)

**Files**: `Assets/_Project/Scripts/UI/Panels/` (7 files, 4,467 lines)

All the new screens for social features:

| Panel | Purpose | Key Features |
|-------|---------|-------------|
| **FriendListPanel** | Friend management | Tabs, presence dots, search, sort, categories, requests |
| **ProfilePanel** | Profile viewer | 5 tabs, mutual friends, minigame stats, badge grid |
| **RoomBrowserPanel** | Room discovery | Category bar, search, pagination, favorites, quick nav |
| **ActivityFeedPanel** | Social feed | Category filters, unread indicators, action buttons |
| **CharacterCreatorPanel** | Avatar creation | 6-step wizard, live preview, randomize, name check |
| **SettingsPanel** | Game settings | 5 tabs, dirty tracking, PlayerPrefs save, reset defaults |
| **NotificationPanel** | Notifications | All/Unread filters, dismiss, mark read, action routing |

---

### Original v1.0 Systems (Foundation)

| System | Files | Lines | Description |
|--------|-------|-------|-------------|
| **Core Framework** | 10 | 5,522 | Singleton, EventBus, SaveManager, GameManager, ObjectPool |
| **Avatar System** | 7 | 2,372 | 9-layer SpriteRenderer, emotes, outfit system |
| **Island Editor** | 8 | 2,272 | Grid/free placement, save/load, Y-sorting |
| **Multiplayer** | 8 | 3,565 | Netcode NGO, rooms, proximity chat |
| **UI Framework** | 9 | 5,803 | Responsive canvas, 12 animation types, transitions |
| **Chat System** | 9 | 5,312 | 6 channels, bubbles, profanity filter, slash commands |
| **Minigames** | 7 | 6,956 | Rhythm, Fashion, Coin Rush, Trivia, Hide & Seek |
| **Inventory & Shop** | 8 | 4,256 | Grid UI, drag-drop, daily rewards, 3 currencies |
| **Audio System** | 7 | 4,334 | Dynamic music layers, SFX pooling, spatial audio |
| **Backend** | 7 | 4,974 | Firebase, PlayFab, REST API, server validation |

---

## Project Structure v2.0

```
KawaiiCoolIsland/
├── Assets/
│   └── _Project/
│       ├── Scripts/
│       │   ├── Core/            # 12 files - Framework + Enums
│       │   ├── Avatar/          # 7 files  - Character system
│       │   ├── Avatar/Editor/   # 6 files  - NEW: Creator, editor, presets
│       │   ├── Island/          # 8 files  - Island editor
│       │   ├── Multiplayer/     # 8 files  - Netcode multiplayer
│       │   ├── UI/              # 9 files  - UI framework
│       │   ├── UI/Panels/       # 7 files  - NEW: Social panels
│       │   ├── Chat/            # 9 files  - Chat system
│       │   ├── Minigames/       # 7 files  - Minigame framework
│       │   ├── Inventory/       # 8 files  - Inventory & shop
│       │   ├── Audio/           # 7 files  - Audio system
│       │   ├── Backend/         # 7 files  - Backend integration
│       │   ├── Social/          # 6 files  - NEW: Friends, presence, profiles
│       │   ├── Interaction/     # 6 files  - NEW: Tap-to-interact, menus
│       │   ├── Rooms/           # 6 files  - NEW: Room browser, navigator
│       │   ├── Camera/          # 5 files  - NEW: Zoom, follow, shake
│       │   ├── Discovery/       # 5 files  - NEW: Feed, events, trending
│       │   └── Gatherings/      # 4 files  - NEW: Party, gatherings, invites
│       ├── ScriptableObjects/   # Data definitions
│       ├── Prefabs/             # Prefab templates
│       ├── Scenes/              # Game scenes
│       ├── Settings/            # URP, Input, AudioMixer
│       └── Sprites/             # 2D art assets
├── Packages/
│   └── manifest.json            # Unity package dependencies
└── README.md                    # This file
```

---

## Controls v2.0

### Mobile (Touch)
- **Left side**: Virtual joystick for movement
- **Right side**: Action buttons (Interact, Emote, Jump)
- **Pinch**: Zoom in/out (NEW v2.0)
- **Two-finger drag**: Pan camera (NEW v2.0)
- **Tap player**: Select and show interaction menu (NEW v2.0)
- **Long-press player**: Show radial context menu (NEW v2.0)
- **Tap**: Interact with objects
- **Drag (right side)**: Pan camera

### Keyboard & Mouse
- **WASD / Arrow keys**: Movement
- **E**: Interact
- **Space**: Jump / Action
- **Tab**: Toggle chat
- **I**: Inventory
- **B**: Shop
- **C**: Character customization
- **F**: Friend list (NEW v2.0)
- **P**: Profile (NEW v2.0)
- **R**: Room browser (NEW v2.0)
- **N**: Notifications (NEW v2.0)
- **Scroll wheel**: Zoom in/out (NEW v2.0)
- **Middle mouse drag**: Pan camera (NEW v2.0)
- **Esc**: Close panels / Pause

### Gamepad
- **Left Stick**: Movement
- **A / Cross**: Interact / Confirm
- **B / Circle**: Cancel / Close
- **X / Square**: Emote
- **Y / Triangle**: Inventory
- **D-Pad**: Navigate UI
- **LB / L1**: Zoom out (NEW v2.0)
- **RB / R1**: Zoom in (NEW v2.0)
- **Start**: Pause menu

---

## Build Configuration

### Platform-Specific Settings

| Platform | Target FPS | Bloom | Texture | Input |
|----------|-----------|-------|---------|-------|
| Android (Mid) | 30 | Quarter | Half Res | Touch |
| Android (High) | 60 | Half | Full | Touch |
| iOS | 60 | Half | Full | Touch |
| Windows | 144 | Full | Full | KBM + Gamepad |
| macOS | 120 | Full | Full | KBM + Gamepad |

---

## Performance Targets

| Metric | Mobile Target | Desktop Target |
|--------|--------------|----------------|
| Draw Calls | < 100 | < 200 |
| SetPass Calls | < 50 | < 100 |
| Texture Memory | < 128 MB | < 512 MB |
| GC Alloc/Frame | < 1 KB | < 1 KB |
| Load Time | < 5s | < 3s |
| Scene Transition | < 2s | < 1s |

---

## Development Team

Built with a multi-agent orchestration system:
- 1 Core Systems Architect
- 1 Avatar & Animation Specialist
- 1 Island Editor Specialist
- 1 Multiplayer Networking Specialist
- 1 UI/UX Framework Specialist
- 1 Chat System Specialist
- 1 Minigame Framework Specialist
- 1 Inventory & Economy Specialist
- 1 Audio Systems Specialist
- 1 Backend Integration Specialist
- **1 Social Graph Specialist** (v2.0)
- **1 Player Interaction Specialist** (v2.0)
- **1 Avatar Editor Specialist** (v2.0)
- **1 Room System Specialist** (v2.0)
- **1 Camera System Specialist** (v2.0)
- **1 Activity Discovery Specialist** (v2.0)
- **1 Party & Gathering Specialist** (v2.0)
- **1 UI Panel Specialist** (v2.0)
- **1 Core Extensions Specialist** (v2.0)

---

## License

This project is provided as a starting template for your own kawaii social world game. Feel free to modify, extend, and build upon it. The architecture follows Unity and industry best practices to provide a solid foundation for production development.

---

## Roadmap

### Phase 1 (v1.0 — Complete)
- [x] Core framework and architecture
- [x] Avatar customization system
- [x] Island editor with save/load
- [x] Multiplayer with Netcode
- [x] UI framework
- [x] Chat system
- [x] 5 minigame implementations
- [x] Inventory and shop
- [x] Audio system
- [x] Backend integration

### Phase 2 (v2.0 — Complete)
- [x] Social graph (friends, presence, profiles, relationships)
- [x] Player interaction (tap-to-interact, context menus, profiles)
- [x] Enhanced avatar editor & character creator
- [x] Room discovery & navigation (browser, categories, search)
- [x] Camera system (pinch zoom, smooth follow, shake)
- [x] Activity feed & event discovery
- [x] Party & gathering system
- [x] 7 new UI panels (friend list, profile, room browser, activity feed, character creator, settings, notifications)

### Phase 3 (Future)
- [ ] Clan/guild system with hierarchy
- [ ] Player-to-player trading marketplace
- [ ] Seasonal events framework with world changes
- [ ] Battle pass with progression tracks
- [ ] Advanced analytics dashboard
- [ ] Moderation tools with AI-assisted filtering
- [ ] User-generated content (custom items, rooms)
- [ ] Mobile push notifications
- [ ] Cross-platform friend sync
- [ ] Advanced anti-cheat
- [ ] Server authoritative multiplayer
- [ ] Custom server infrastructure
- [ ] Esports tournament system

---

*Built with love, sparkles, a whole lot of coroutines, and 19 specialized agents working in harmony.*
