# Starlight Inn v3.5 — AAA Virtual World

> A cozy-core social virtual world built with modern web technologies. Inspired by the community spirit of Habbo Hotel and BoomBang.tv, reimagined with AAA-grade architecture.

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start

# Open http://localhost:3000
```

## Stats

| Metric | Value |
|--------|-------|
| Total Files | 60 |
| Total Lines | 42,189 |
| JavaScript Modules | 52 |
| CSS Files | 3 |
| v3.0 Base | 13,514 lines |
| v3.5 Upgrade | +28,675 lines |

## Architecture

```
ES6 Modules | Canvas 2D + WebGL Fallback | Socket.IO | Node.js + Express
```

### Engine Core

| Module | File | Lines | Description |
|--------|------|-------|-------------|
| Game Loop | `engine/Game.js` | 550 | Main loop, state management, entity tracking |
| WebGL Renderer | `engine/WebGLRenderer.js` | 1,286 | Sprite batching, 10K sprites/draw call, instanced rendering |
| Renderer Adapter | `engine/Renderer.js` | 842 | Auto-detects WebGL, falls back to Canvas 2D |
| Texture Atlas | `engine/TextureAtlas.js` | 668 | Shelf-bin packing, mipmap support, defragmentation |
| Post-Processing | `engine/PostProcess.js` | 862 | Bloom, vignette, color grading, film grain, ACES tone mapping |
| GPU Particles | `engine/ParticleSystemGPU.js` | 877 | 9 preset effects, instanced rendering, additive blending |
| Physics 2D | `engine/Physics2D.js` | 762 | Velocity Verlet, floor/wall/ceiling collision, projectile arcs |
| Camera | `engine/Camera.js` | 355 | Pan, zoom, follow, screen shake |
| Input | `engine/Input.js` | 530 | Keyboard, mouse, touch, pinch-to-zoom |
| Assets | `engine/Assets.js` | 357 | Sprite loading, caching, reference counting |
| Audio | `engine/Audio.js` | 444 | Web Audio API, spatial audio, music mixing |
| Debug Console | `engine/DebugConsole.js` | 1,970 | Network graphs, FPS monitor, collision stats, command console |

### Avatar Systems

| Module | File | Lines | Description |
|--------|------|-------|-------------|
| Avatar | `avatar/Avatar.js` | 994 | Rendering, expressions, layer-stacking, HSL color application |
| Animation Engine | `avatar/AnimationEngine.js` | 922 | 19 easing functions, 16 tracks, squash-and-stretch, cross-blending |
| Shadow Anchor | `avatar/ShadowAnchor.js` | 643 | Elliptical hit-test, hover glow, selection ring, depth cue |
| Customizer | `avatar/Customizer.js` | 479 | HSL color wheel, real-time preview |
| Gestures | `avatar/Gestures.js` | 397 | Social emotes, wave, dance animations |
| Presets | `avatar/Presets.js` | 263 | Save/load outfit configurations |

### World Systems

| Module | File | Lines | Description |
|--------|------|-------|-------------|
| Area Data | `world/AreaData.js` | 917 | 14+ area definitions with walkable grids |
| Area Manager | `world/AreaManager.js` | 504 | Room transitions, spawning, loading |
| Grid Pathfinding | `world/GridPathfinding.js` | 1,176 | A* 8-directional, binary heap, path smoothing, tap-to-move |
| Collision System | `world/CollisionSystem.js` | 1,774 | Spatial hash, circle/AABB, portals, social zones, 4 response types |
| Seasonal Content | `world/SeasonalContent.js` | 1,052 | Christmas, Halloween, Easter, Tribal events |
| Island Editor | `world/IslandEditor.js` | 1,454 | HSL paint, furniture placement, grid, undo/redo (50 deep) |
| Island Editor UI | `world/IslandEditorUI.js` | 1,074 | Toolbar, palette, mini-map, 15+ shortcuts |
| NPC | `world/NPC.js` | 396 | NPC behavior, dialogue trees |

### Social Systems

| Module | File | Lines | Description |
|--------|------|-------|-------------|
| Chat | `social/Chat.js` | 460 | 4 channels (area, whisper, party, system), emoji |
| Radial Menu | `social/RadialMenu.js` | 476 | 8-slice context menu on player shadow |
| Friends | `social/Friends.js` | 469 | Friend list, requests, presence indicators |
| Trade | `social/Trade.js` | 631 | Trade window, item verification, anti-scam |

### Economy Systems

| Module | File | Lines | Description |
|--------|------|-------|-------------|
| Currency | `economy/Currency.js` | 542 | Silver (soft) + Gold (premium, 100/hr, cap 1000/day) |
| Catalog | `economy/Catalog.js` | 499 | 12-category shop, 51+ items |
| Inventory | `economy/Inventory.js` | 707 | Grid layout, drag-and-drop |
| Trade Engine | `economy/TradeEngine.js` | 624 | Server-side validation, fairness checks |

### Mini-Games

| Game | File | Lines | Players | Description |
|------|------|-------|---------|-------------|
| Star Catcher | `minigames/StarCatcher.js` | 361 | 1-4 | Catch falling stars |
| Memory Match | `minigames/MemoryMatch.js` | 415 | 1-2 | Card matching |
| Rhythm Dance | `minigames/RhythmDance.js` | 441 | 1-4 | Arrow rhythm game |
| Trivia | `minigames/Trivia.js` | 452 | 1-4 | World lore quiz |
| Hub | `minigames/MinigameHub.js` | 577 | — | Lobby, matchmaking, scoring |

### Event Systems

| Module | File | Lines | Description |
|--------|------|-------|-------------|
| Chest Manager | `events/ChestManager.js` | 560 | 2-hour spawns, 3 tiers, global announcements |
| Power-Ups | `events/PowerUps.js` | 656 | 4 consumables: Cocktail, Flower, Kiss, Uppercut |
| Event Calendar | `events/EventCalendar.js` | 523 | Scheduled events, holiday tracking |

### Safety & Moderation

| Module | File | Lines | Description |
|--------|------|-------|-------------|
| Filter | `safety/Filter.js` | 525 | 200+ word profanity filter |
| Rate Limit | `safety/RateLimit.js` | 357 | 10 action-type throttles |
| Spam Detector | `safety/SpamDetector.js` | 460 | Pattern detection, repetition analysis |
| Report | `safety/Report.js` | 473 | Report workflow with categories |
| Moderation | `safety/Moderation.js` | 572 | Kick, mute, ban tools |
| Child Safety | `safety/ChildSafety.js` | 464 | Under-13 restricted mode |
| AI Moderation | `safety/AIModeration.js` | 1,217 | Sentiment analysis, reputation, contextual scoring |

### Game Feel Mechanics (Signature)

| Module | File | Lines | Description |
|--------|------|-------|-------------|
| Fart Mechanic | `FartMechanic.js` | 664 | 5-phase animation, 25 green particles, procedural audio, 5s cooldown |
| Uppercut Ejection | `UppercutEjection.js` | 750 | Windup → impact flash → physics arc → 3s exile → daze |
| Screen Effects | `ScreenEffects.js` | 597 | Flash, shake, hitstop, slowMo, floating text, comic text |

### Network

| Module | File | Lines | Description |
|--------|------|-------|-------------|
| Socket Client | `net/SocketClient.js` | 548 | Socket.IO with offline fallback |
| Server | `server.js` | 881 | Node.js + Express + Socket.IO |

## v3.5 Upgrade Highlights

### WebGL Rendering Pipeline
- **Sprite batching**: Up to 10,000 sprites per draw call
- **9 GPU particle effects**: Fireflies, falling leaves, flickering lamps, uppercut impact, fart cloud, cocktail confetti, flower hearts, kiss trail, chest sparkle
- **Multi-pass post-processing**: Bloom, vignette, color grading, film grain, ACES tone mapping, chromatic aberration
- **Texture atlas**: Shelf-bin packing with edge padding and mipmap support
- **Automatic fallback**: Canvas 2D if WebGL unavailable

### Animation & Physics
- **19 easing functions** (Robert Penner set)
- **16 built-in animation tracks**: idle, walk, run, sit, sleep, knocked, recover, dance, 6 emotes, transitions
- **Squash-and-stretch** with anticipation frames
- **Velocity Verlet** physics integration
- **Shadow-anchor interaction system**

### Pathfinding & Collision
- **A* with 8-directional movement** on walkable grids
- **Binary heap open set** for O(log n) performance
- **Path smoothing** via line-of-sight raycasting
- **Tap-to-move** with Promise-based arrival
- **Spatial hash** for O(1) entity lookup
- **Portal triggers** with cooldown and callback
- **Social zones** for dance floors and seating areas

### Island Creator Suite
- **4 edit modes**: Place, paint, move, delete
- **HSL color wheel** for any surface or item
- **Grid snapping** with 32px cells
- **Undo/redo**: 50-deep history across 11 action types
- **Import/export** JSON serialization

### Seasonal Content
- **4 limited-time events**: Christmas, Halloween, Easter, Tribal
- **Exclusive furniture sets** (7 items per season)
- **Seasonal achievements** with 500 Gold rewards
- **Gold boost**: 150/hr during events
- **Area decorations** via GPU particles

### AI Moderation
- **Sentiment scoring**: toxicity, aggression, spam-likelihood
- **7 violation types** with severity levels
- **Graduated responses**: warning → mute → auto-report
- **Player reputation** system (0-100) with persistence
- **False-positive protection**: whitelist, appeals, context window

### Debug Console
- **Draggable overlay** toggled with backtick (`)
- **Network monitor**: 60-sample ping graph, packet loss
- **FPS + frame time** graphs with auto-scaling
- **Collision stats**: tests/frame, portal triggers, spatial hash efficiency
- **Asset tracking**: cache hit/miss, texture memory
- **8 commands**: /fps, /noclip, /spawn, /gold, /season, /net lag, /cam follow, /help

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` / T | Focus chat |
| `Escape` | Close all panels |
| `` ` `` | Toggle debug console |
| F | Friends list |
| I | Inventory |
| B | Catalog (shop) |
| G | Mini-games |

## Project Structure

```
starlightinn-v3/
├── index.html              # Game shell
├── server.js               # Node.js + Socket.IO server
├── package.json
├── css/
│   ├── main.css            # Twilight cozy-core theme
│   ├── animations.css      # 17 keyframe animations
│   └── mobile.css          # Touch optimization
└── js/
    ├── main.js             # Module wiring & entry point
    ├── FartMechanic.js
    ├── UppercutEjection.js
    ├── ScreenEffects.js
    ├── engine/             # 10 core systems
    ├── world/              # 8 world-building systems
    ├── avatar/             # 6 avatar systems
    ├── social/             # 4 social systems
    ├── economy/            # 4 economy systems
    ├── minigames/          # 5 mini-game systems
    ├── events/             # 3 event systems
    ├── safety/             # 7 moderation systems
    └── net/                # 1 network module
```

## License

MIT — Starlight Inn Team
