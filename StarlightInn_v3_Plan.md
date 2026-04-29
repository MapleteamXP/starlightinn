# Starlight Inn v3.0 — Full-Force Implementation Plan
## Applying Both Master Prompts to the Live Web Game

---

## Current State Analysis

**Existing Starlight Inn** (single `index.html`, 936 lines, 57KB):
- Web game (HTML5 Canvas 2D), NOT Unity — deployed to GitHub Pages
- Cozy twilight aesthetic with CSS variables (already beautiful, KEEP)
- Procedural chibi avatars drawn with `fillRect` (blocky rectangles)
- 6 areas: hub, beach, forest, treehouse, park, island
- Simulated NPCs and fake "online players" (no real multiplayer)
- WASD/Arrow key movement only (no mobile touch)
- Chat with LocalStorage persistence
- Trade UI (demo only — no real logic)
- Inventory grid (40 slots, emoji items)
- Character select with 6 bases + color pickers
- Daily rewards (placeholder — 2 hardcoded items)
- Simulated bot chat every 8 seconds
- **No WebSocket, no real sync, no moderation, no mini-games, no HSL picker, no radial menu**

---

## Target Architecture (Web Game)

Since Starlight Inn is a **web game deployed to GitHub Pages**, we work in the web stack:
- **Frontend**: HTML5 Canvas 2D + CSS3 + vanilla JavaScript (ES6+ modules)
- **Backend**: Node.js + WebSocket (upgrade `server.js`)
- **Assets**: Procedural sprites + emoji-based decorations + CSS-filter colorization
- **Deploy**: Static files to GitHub Pages, WebSocket server separate

---

## Implementation Waves

### Wave 1: Core Engine Upgrade
**Agent: CoreEngine_Dev**
- Modularize from single HTML to `js/` directory with ES6 modules
- 60fps game loop with delta-time
- Camera system: pan, zoom (mouse wheel + pinch), bounds, smooth follow
- Mobile touch controls: virtual joystick, tap-to-move, pinch zoom
- Performance: object culling, dirty rect rendering, requestAnimationFrame
- State manager: player, world, entities, particles

### Wave 2: Avatar & Customization (Master Prompt Feature #1)
**Agent: AvatarEngine_Dev**
- Paint-your-world HSL color picker: `hue-rotate()` / `saturate()` / `brightness()` CSS filters on canvas
- Shadow-based interaction anchor: Every entity casts a subtle drop-shadow glow on click
- Smiley faces: 6 expressions (happy, sad, cool, love, surprised, sleepy) — toggled via key or UI
- 12 base characters (expand from 6): catgirl, human, bunny, robot, fox, dragon, fairy, ghost, mushroom, star, moon, cloud
- Social gestures: wave, dance, sit, sleep, laugh, cry — triggered by number keys 1-6
- Outfit system: 8 layers (base, hair, eyes, mouth, outfit, accessory1, accessory2, shoes)
- Avatar save/load to LocalStorage

### Wave 3: World & Areas (Master Prompt Feature #2)
**Agent: WorldBuilder_Dev**
- Expand from 6 → 12+ areas with unique atmosphere:
  1. Starlight Hub (main) 2. Moon Beach 3. Whispering Forest 4. Cloud Treehouse
  5. Sunflower Park 6. Crystal Island 7. Aurora Lounge (NEW) 8. Ember Café (NEW)
  9. Misty Library (NEW) 10. Stardust Theater (NEW) 11. Twilight Garden (NEW)
  12. Comet Arcade (NEW) 13. Dream Bedroom (NEW) 14. Meteor Market (NEW)
- Each area: unique bg gradient, floor color, decorations, ambient particles, background music descriptor, NPCs
- Seamless transitions: fade + walk direction preservation
- Area browser: thumbnail preview, player count, "Friends Here" indicator

### Wave 4: Social Interaction (Master Prompt Feature #3)
**Agent: SocialInteraction_Dev**
- Radial context menu: 8-slice pie on right-click/long-press any player
  - Actions: Profile, Whisper, Add Friend, Trade, Invite Room, Gift, Uppercut (250 Gold), Report
- Player hover: name tag + status (online/away/busy)
- "Nearby Users" panel: list of players in current area with distance sort
- "People You May Know": mutual-friend based suggestions
- Player inspector: view full outfit breakdown on click
- Social gestures broadcast: nearby players see your wave/dance

### Wave 5: Economy & Trading (Master Prompt Feature #4)
**Agent: EconomyTrading_Dev**
- Dual currency: Silver (earned) + Gold (premium/earned slowly)
- Hourly grants: 100 Gold per hour online, cap 1000 per 24h
- 12-category catalog: Hair, Eyes, Mouth, Outfits, Shoes, Accessories, Furniture, Pets, Backgrounds, Effects, Badges, Bundles
- Trade system: drag-drop offer window, value comparison, both-party lock + confirm, 5-second anti-scam delay
- Trade history: localStorage log with receipts
- Currency HUD: Silver count + Gold count in top bar

### Wave 6: Mini-Game Engine (Master Prompt Feature #5)
**Agent: MinigameEngine_Dev**
- Mini-game framework: state machine, scoring, countdown, results screen
- 4 launch mini-games:
  1. Star Catcher: Click falling stars, combo multiplier
  2. Memory Match: Card matching with cozy theme
  3. Rhythm Dance: Arrow keys in time with music
  4. Trivia: 10 questions about the world lore
- Mini-game queue: lobby system, 2-4 players, auto-start countdown
- Rewards: Silver + exclusive mini-game badges

### Wave 7: Chests, Events & Power-Ups (Master Prompt Feature #6)
**Agent: EventsChests_Dev**
- Rare chests: spawn every 2 hours in random areas, visible to all, first-click-wins
  - 3 tiers: Wooden (common), Silver (rare), Golden (legendary)
  - Contents: random items from catalog, Silver, Gold
- Social power-ups (consumables, bought with Gold):
  - Cocktail (125 Gold): glowing aura + confetti particles for 30s
  - Flower (75 Gold): heart particles burst on target player
  - Kiss (50 Gold): floating heart emoji trail
  - Uppercut (250 Gold): comedic knockout animation (victim falls, gets back up)
- Event calendar: scheduled mini-games, chest rushes, double-Silver weekends

### Wave 8: Chat, Safety & Moderation (Master Prompt Feature #7)
**Agent: SafetyModeration_Dev**
- Chat system upgrade: 4 channels (Area, Whisper, System, Mini-game)
- Profanity filter: 200+ word list, leet-speak detection
- Rate limiting: 5 messages per 10 seconds, 1 whisper per 3 seconds
- Report system: report any player → reason selection → moderation queue
- Block/Mute: block = hide all interaction, mute = hide chat only
- Moderation tools: kick from area, temporary mute, report log
- Child-safety: under-13 mode (restricted chat, no trading)

### Wave 9: Backend & Real-Time Sync (Master Prompt Feature #8)
**Agent: BackendSync_Dev**
- Upgrade `server.js` to WebSocket server with Socket.IO
- Real-time sync: player positions, chat messages, trade state, mini-game state
- Room/channel system: players grouped by area
- Presence: online/offline/away status with heartbeat
- Message history: persist last 100 messages per area
- Player authentication: simple token-based (no real auth for MVP)
- Database: JSON file storage (upgradeable to MongoDB/Redis)

### Wave 10: Polish, Performance & Delivery
**Agent: PolishPerf_Dev**
- Performance: 60fps target, object culling, particle limits, dirty rect rendering
- Accessibility: sufficient contrast, keyboard navigation, reduced motion option
- Mobile: responsive layout, safe area, touch-optimized buttons (min 64px)
- Loading: progress bar, asset preloading
- Sound: Web Audio API ambient loops + SFX
- Settings panel: graphics quality, sound volume, controls, privacy
- Final integration: all modules wired together, smoke test

---

## File Structure Target

```
starlightinn/
├── index.html              # Landing + game shell (lightweight)
├── css/
│   ├── main.css           # Theme, layout, panels
│   ├── animations.css     # Keyframes, transitions
│   └── mobile.css         # Touch-specific styles
├── js/
│   ├── engine/
│   │   ├── Game.js        # Main game loop & state
│   │   ├── Renderer.js    # Canvas 2D rendering
│   │   ├── Camera.js      # Pan, zoom, follow, bounds
│   │   ├── Input.js       # Keyboard + mouse + touch
│   │   ├── Assets.js      # Sprite loading & caching
│   │   └── Audio.js       # Web Audio API
│   ├── world/
│   │   ├── AreaData.js    # 14 area definitions
│   │   ├── AreaManager.js # Transitions, spawning
│   │   └── NPC.js         # NPC behavior & dialogue
│   ├── avatar/
│   │   ├── Avatar.js      # Rendering + expressions
│   │   ├── Customizer.js  # HSL picker + outfit layers
│   │   ├── Gestures.js    # Wave, dance, sit, etc.
│   │   └── Presets.js     # Save/load outfits
│   ├── social/
│   │   ├── Chat.js        # Messages, channels, filter
│   │   ├── RadialMenu.js  # Right-click context menu
│   │   ├── Friends.js     # Friend list, presence
│   │   └── Trade.js       # Trade window + logic
│   ├── economy/
│   │   ├── Currency.js    # Silver + Gold management
│   │   ├── Catalog.js     # 12-category shop
│   │   ├── Inventory.js   # Grid + drag-drop
│   │   └── TradeEngine.js # Safe trading logic
│   ├── minigames/
│   │   ├── MinigameHub.js # Lobby + queue
│   │   ├── StarCatcher.js # Game 1
│   │   ├── MemoryMatch.js # Game 2
│   │   ├── RhythmDance.js # Game 3
│   │   └── Trivia.js      # Game 4
│   ├── events/
│   │   ├── ChestManager.js # Rare chest spawning
│   │   ├── PowerUps.js     # Consumable effects
│   │   └── EventCalendar.js# Scheduled events
│   ├── safety/
│   │   ├── Filter.js       # Profanity + spam
│   │   ├── RateLimit.js    # Action throttling
│   │   ├── Report.js       # Report flow
│   │   └── Moderation.js   # Admin tools
│   ├── ui/
│   │   ├── UIManager.js    # Panel show/hide
│   │   ├── Components.js   # Reusable UI pieces
│   │   ├── TopBar.js       # HUD
│   │   ├── Dock.js         # Bottom action bar
│   │   ├── Settings.js     # Settings panel
│   │   └── Toast.js        # Notifications
│   ├── net/
│   │   ├── SocketClient.js # WebSocket client
│   │   ├── Sync.js         # State synchronization
│   │   └── Auth.js         # Simple auth token
│   └── main.js             # Entry point, module wiring
├── server.js               # Node.js + Socket.IO server
├── package.json            # Dependencies
├── assets/
│   ├── sprites/            # Generated/placeholder sprites
│   ├── audio/              # Ambient + SFX (descriptors)
│   └── particles/          # Particle textures
└── README.md               # Updated documentation
```

---

## Key Technical Decisions

1. **Canvas 2D, NOT WebGL**: Simpler, works everywhere, sufficient for 2D social world
2. **Vanilla JS modules, NO framework**: Zero dependencies for client, fast loading
3. **Socket.IO for WebSocket**: Fallback support, rooms, broadcasting
4. **CSS filters for HSL**: `hue-rotate()`, `saturate()`, `brightness()` — instant color changes without redrawing sprites
5. **Procedural avatars v2**: Keep `fillRect` approach but add expression states, smoother proportions
6. **JSON file DB for MVP**: Upgradeable to MongoDB/Redis later
7. **GitHub Pages for client, separate server host**: Server can run on Render/Railway/Heroku

---

## Master Prompt Feature Checklist

| # | Feature | Status | Agent |
|---|---------|--------|-------|
| 1 | Paint-your-world HSL color picker | NEW | AvatarEngine |
| 2 | Shadow-based interaction anchor | NEW | AvatarEngine |
| 3 | Smiley faces (6 expressions) | NEW | AvatarEngine |
| 4 | Social gestures (wave, dance, sit, sleep, laugh, cry) | NEW | AvatarEngine |
| 5 | 12+ base areas with unique atmosphere | EXPAND 6→14 | WorldBuilder |
| 6 | Dual currency (Silver + Gold) | NEW | EconomyTrading |
| 7 | Hourly grants (100 Gold/h, cap 1000/24h) | NEW | EconomyTrading |
| 8 | 12-category catalog | NEW | EconomyTrading |
| 9 | Trade system with anti-scam | EXPAND demo | EconomyTrading |
| 10 | Rare chests every 2 hours | NEW | EventsChests |
| 11 | Social power-ups (cocktail, flower, kiss, uppercut) | NEW | EventsChests |
| 12 | Radial context menu | NEW | SocialInteraction |
| 13 | Mini-game engine + 4 games | NEW | MinigameEngine |
| 14 | Real-time WebSocket sync | NEW | BackendSync |
| 15 | Safety: profanity, rate limits, reports | NEW | SafetyModeration |
| 16 | Moderation: kick, mute, child-safety | NEW | SafetyModeration |
| 17 | Performance: 60fps, culling, mobile | NEW | PolishPerf |

---

## Deliverable

Complete file structure as a ZIP that the user can:
1. Extract into their repo
2. Run `npm install` + `node server.js` for local dev
3. Push to GitHub (Pages auto-deploys the client)
4. Deploy `server.js` to any Node.js host for multiplayer
