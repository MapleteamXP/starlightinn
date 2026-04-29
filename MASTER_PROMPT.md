# STARLIGHT INN — MASTER PROMPT
# World-Class Social World Game — Complete Specification

_This document is the single source of truth. Any dev working on this project reads this first._

---

## 1. PROJECT IDENTITY

**Name:** Starlight Inn  
**Formerly:** KawaiiCool Island (full rebrand required)  
**Tagline:** "A cozy world of islands, trades, and starlit chats"  
**Rating:** E-rated / Family Friendly — no blood, no gore, no sexual content  
**Platforms:** Browser (WebGL/WebGPU), Desktop (Windows/Mac/Linux), Mobile (iOS/Android)  
**Priority:** Browser-first, then native desktop, then mobile

---

## 2. ART DIRECTION (NON-NEGOTIABLE)

**Style:** Maplestory × Habbo Hotel pixel aesthetic  
**Vibe:** Cutesy but cool. Rasta influences. Cat girls (neko). "Kekos" (preselected characters with deep customization).  
**Resolution:** Base sprites at 32×32 or 64×64 pixels, scaled up 2×–4× with `image-rendering: pixelated`  
**Color Palette:** Warm, cozy, twilight-inspired — deep purples (#2a2040), warm golds (#ffd700), mint accents (#7dd3c0), soft lavenders (#b8a9d9)  
**Animation:** 4-directional walk cycles (up/down/left/right), idle breathing animation, emote animations

### 2.1 Character Design Requirements

**6 Base Characters ("Kekos"):**

| ID | Name | Base | Vibe | Default Accessories |
|----|------|------|------|---------------------|
| `catgirl` | Neko | Humanoid + cat features | Playful, mew~, bubbly | Cat ears, tail, bell collar |
| `rasta` | Rasta | Human | Chill, wise, reggae energy | Dreadlocks, headband, sunglasses |
| `mage` | Luna | Human | Mysterious, starlit | Witch hat, staff, cape |
| `pirate` | Cpt. Kiko | Human | Adventurous, treasure hunter | Pirate hat, eyepatch, boots |
| `bunny` | Bun-Bun | Humanoid + bunny features | Hoppy, fluffy, sweet | Bunny ears, carrot, cotton tail |
| `robot` | Byte | Mechanical | Cute bot, innocent | Antenna, LED screen face, mechanical joints |

**Customization Depth:**
- **Skin:** 8 tones from pale (#f5d0b5) to deep (#3d2719)
- **Hair:** 10 colors — black, brown, blonde, gold, pink, mint, lavender, orange, red, blue
- **Outfit:** 10 colors — peach, mint, lavender, yellow, coral, purple, cyan, white, red, dark
- **Accessories:** 20+ unlockable — hats, glasses, wings, tails, weapons, pets, badges

**Sprite Asset Requirements:**
Each character needs:
- `idle_down.png`, `idle_up.png`, `idle_left.png`, `idle_right.png` (1 frame each, breathing subtle)
- `walk_down_1.png`, `walk_down_2.png`, `walk_up_1.png`, `walk_up_2.png`, etc. (2-frame walk cycle per direction)
- `emote_happy.png`, `emote_sad.png`, `emote_wave.png` (emote bubbles)
- `portrait.png` (for UI, 64×64)

**Resolution:** 32×48 pixels base (Maplestory proportions — big head, tiny body = cute)

### 2.2 World/Environment Art

**Tilesets needed (16×16 pixel tiles, seamless):**
- `inn_lobby_tiles.png` — wooden floors, warm lighting, reception desk, potted plants
- `beach_tiles.png` — sand, water animation frames, palm trees, beach towels
- `forest_tiles.png` — grass, dirt paths, tree trunks, mushroom clusters, fireflies
- `treehouse_tiles.png` — wooden planks, rope bridges, leaf canopy, bird nests
- `park_tiles.png` — grass, cherry blossom trees, stone paths, benches, fountain
- `island_tiles.png` — sand, water, palm trees, customizable plot grid

**Furniture Sprites (placed on island):**
- Star Lamp, Cozy Bed, Palm Tree, Crystal Chair, Golden Throne, Moon Rug, Neon Sign, Campfire, Hammock, Tree Swing, Flower Pot, Fountain, DJ Booth, LTD Statue, Magic Chest

**Each furniture item:**
- 1 static sprite (32×32 or 64×64)
- Rarity-colored glow overlay (CSS box-shadow or canvas glow)

---

## 3. CORE GAME SYSTEMS

### 3.1 Authentication Flow

1. **Landing Page:** Animated starfield background, name entry field, "Enter World" button
2. **Character Select:** Grid of 6 base characters with live preview, color sliders, accessory toggles
3. **Area Selection:** Hub (Inn Lobby) is default. Dock shows 6 area buttons
4. **Persistent Profile:** LocalStorage saves name + character config + inventory

### 3.2 Movement & Camera

- **Controls:** WASD / Arrow keys (desktop), virtual joystick (mobile)
- **Speed:** 120 pixels/second base
- **Camera:** Smooth follow with slight lag (lerp factor 0.1)
- **Boundaries:** Player cannot walk outside area bounds
- **Collision:** Simple AABB against furniture and NPCs

### 3.3 Chat System

- **Global Chat:** All players in same area see messages
- **Whisper:** `/w username message` for private messages
- **Emotes:** `/dance`, `/wave`, `/sit`, `/sleep` trigger sprite animations
- **NPC Chat:** Click NPC to open dialogue tree with quest hints
- **Bubble UI:** Chat appears above character head for 5 seconds, then fades

### 3.4 Trading System

**Rarity Tiers (with visual intensity):**

| Tier | Color | Glow | Drop Rate | Border Style |
|------|-------|------|-----------|--------------|
| Common | #888888 | None | 60% | Solid grey |
| Rare | #4fc3f7 | Soft blue | 25% | Solid blue + shadow |
| Very Rare | #ba68c8 | Purple pulse | 10% | Solid purple + animated glow |
| Almost Unique | #ff8a65 | Orange flare | 4% | Solid orange + strong glow |
| Unique | #ffd54f | Gold shine | 0.9% | Solid gold + sparkle particles |
| LTD | #ff5252 | Intense red pulse | 0.1% | Animated pulsing red + rare badge |

**Trade Flow:**
1. Click player → "Request Trade" button
2. Both players open trade window (4×2 grid each side)
3. Drag items from inventory to trade slots
4. Both click "Ready" → 3-second countdown → items swap
5. Trade log saved to profile

### 3.5 Inventory System

- **Grid:** 8×5 slots (40 total)
- **Categories:** Furniture, Wearable, Consumable, Currency, Collectible
- **Stacking:** Furniture doesn't stack, consumables stack to 99
- **Sorting:** By rarity, by type, by name
- **Quick Equip:** Double-click wearable to equip on avatar

### 3.6 Island Builder (Personal Space)

- **Grid:** 12×12 placement grid
- **Layers:** Floor → Furniture (behind player) → Player → Furniture (in front)
- **Rotation:** Furniture can rotate 4 directions (R key)
- **Storage:** Excess furniture goes to "storage box" (unlimited)
- **Visit:** Other players can visit your island via profile click
- **Likes:** Visitors can "⭐" your island, leaderboard for most-liked

### 3.7 Daily Rewards & Economy

- **Login Streak:** Rewards scale with consecutive days
- **Day 1:** 100 Star Coins + Common item
- **Day 7:** 500 Star Coins + Rare item
- **Day 30:** 2000 Star Coins + Very Rare item + exclusive badge
- **Currency:** Star Coins (grindable) + Moon Gems (premium, NOT pay-to-win)
- **Earning Coins:** Chatting (1 coin/message), trading (10 coin fee), visiting islands (5 coins), mini-games

---

## 4. AREAS (WORLDS)

### 4.1 Starlight Inn Lobby (Hub)
- **Size:** 800×600 pixels
- **NPCs:** Innkeeper Elara (quests), Barista Milo (daily rewards), Trader Trix (market)
- **Features:** Notice board (community events), fireplace (sit + chat buff), staircase to rooms
- **Music:** Warm piano + soft strings, 432Hz tuned

### 4.2 Sunset Beach
- **Size:** 1200×600 pixels
- **NPCs:** Surfer Kai (surfing mini-game), Shell Collector (trading rare shells)
- **Features:** Bonfire (night mode only), surfboard rental, tidal pools (foraging)
- **Day/Night:** Beach has special sunset lighting 6PM–8PM real time

### 4.3 Whisperwood Forest
- **Size:** 1200×800 pixels
- **NPCs:** Ranger Oak (forest quests), Fox Spirit (riddles)
- **Features:** Hidden paths (invisible until walked near), firefly glade (catching mini-game), ancient tree (wishing well)

### 4.4 Canopy Treehouse
- **Size:** 800×500 pixels
- **NPCs:** Treekeeper Yew (wisdom), Squirrel Friend (nut trading)
- **Features:** Rope bridges (shake when walked on), bird feeding, leaf pile jumping

### 4.5 Blossom Park
- **Size:** 1000×700 pixels
- **NPCs:** Gardener Rose (flower quests), Poet Willow (random poetry)
- **Features:** Picnic spots (sit + chat), fountain (coin tossing), cherry blossom rain (spring season)

### 4.6 Your Island (Personal)
- **Size:** 600×600 pixels (expandable to 1000×1000)
- **Features:** Full furniture placement, weather toggle (sunny/rainy/starry), visitor log
- **Default:** Small hut + palm tree + beach border

---

## 5. TECHNICAL ARCHITECTURE

### 5.1 Web Version (Current Priority)

**Stack:**
- HTML5 Canvas 2D (no WebGL — broader compatibility)
- Vanilla JavaScript (ES6, transpiled to ES5 for older browsers)
- No frameworks (React/Vue add bloat for this use case)
- Single-file deployment option for easy hosting

**Renderer Pipeline:**
1. Clear canvas
2. Draw background color + tileset layer
3. Draw floor decorations (below player)
4. Draw NPCs + other players (sorted by Y-coordinate)
5. Draw local player
6. Draw foreground decorations + particles
7. Draw UI overlays (chat bubbles, name tags)
8. Post-processing vignette

**Asset Loading:**
- All sprites loaded at startup with progress bar
- `Image()` objects preloaded into `assetCache` object
- Fallback: if sprite fails to load, show colored rectangle + emoji (graceful degradation)

**State Management:**
```javascript
const state = {
  screen: 'landing' | 'charselect' | 'game' | 'trade',
  area: 'hub' | 'beach' | 'forest' | 'treehouse' | 'park' | 'island',
  player: { name, charId, skinColor, hairColor, outfitColor, x, y, facing, accessories, equipped },
  inventory: [Item],
  islandItems: [{ item, x, y, rotation }],
  chatMessages: [{ name, text, timestamp, system }],
  onlinePlayers: [Player],
  settings: { musicVolume, sfxVolume, showNames, filterChat }
};
```

**Networking (Future):**
- WebSocket server (Node.js + ws library)
- Message types: `move`, `chat`, `trade_request`, `trade_offer`, `trade_confirm`, `emote`, `furniture_place`
- Authoritative server for trades and inventory
- Client-side prediction for movement (lerp to server state)

### 5.2 Unity Version (Future Native Build)

**Engine:** Unity 2022.3 LTS  
**Pipeline:** URP 2D (Universal Render Pipeline)  
**Netcode:** Netcode for GameObjects 1.8.1 + Transport 2.1.0  
**Input:** Input System 1.7.0  
**2D Tools:** 2D Animation 9.1.0, 2D Pixel-Perfect 5.0.3, 2D SpriteShape 9.0.3

**Scene Structure:**
- `LandingPage.unity` — Title screen, name entry
- `CharacterSelect.unity` — Avatar customization
- `WorldHub.unity` — Inn lobby (master scene, additive load areas)
- `Area_Beach.unity`, `Area_Forest.unity`, etc. — Additive-loaded sub-scenes
- `PlayerIsland.unity` — Personal island
- `TradeUI.unity` — DontDestroyOnLoad trade overlay

**Prefab Structure:**
- `PlayerAvatar.prefab` — SpriteResolver + Animator + NetworkTransform
- `NPC.prefab` — DialogueTrigger + ShopInventory
- `FurnitureItem.prefab` — Placeable + NetworkVariable<Vector3>
- `ChatBubble.prefab` — Canvas + TMP_Text + fade animation
- `TradeWindow.prefab` — Panel + InventorySlot[] + NetworkList<Item>

**Build Scripts:**
- `BuildWebGL.ps1` — WebGL2 build with compression
- `BuildStandalone.ps1` — Windows/Mac/Linux standalone

### 5.3 Desktop Launcher

**Files:**
- `index.html` — Self-contained game (all JS/CSS inline)
- `server.js` — Node.js static file server
- `Start Starlight Inn.bat` — Windows launcher (finds Chrome/Edge, starts server, opens browser)

**Features:**
- No installation required
- Works offline after first load
- Auto-detects Node.js (uses it if available, falls back to file://)
- Opens in Chrome/Edge explicitly (never Internet Explorer)

---

## 6. AUDIO DESIGN

**Music (generative/procedural fallback if no assets):**
- Inn Lobby: Warm piano in F major, 72 BPM, soft pad underneath
- Beach: Ukulele + steel drum, reggae-influenced, 85 BPM
- Forest: Flute + strings, minor key, 60 BPM
- Treehouse: Music box + glockenspiel, lullaby feel, 50 BPM
- Park: Acoustic guitar + light percussion, cheerful, 90 BPM
- Island: Ambient waves + soft synth pad, relaxing, no strict tempo

**SFX:**
- Footsteps (wood, sand, grass, metal — context-aware)
- UI clicks (soft chimes, not harsh beeps)
- Trade complete ( satisfying "ding" + sparkle sound)
- Item equip (fabric/rustle sound)
- Chat notification (gentle bell, not intrusive)
- Rare item drop ( escalating chime based on rarity tier)

---

## 7. DEPLOYMENT OPTIONS

### 7.1 Instant Hosting (No Account)

| Service | Method | Pros | Cons |
|---------|--------|------|------|
| **Netlify Drop** | Drag zip to https://app.netlify.com/drop | Free, instant, HTTPS | 100MB limit, no custom domain on free |
| **Tiiny.host** | Drag HTML file to https://tiiny.host | Single-file friendly, fast | Free plan limited duration |
| **Surge.sh** | `npx surge` | Free forever, custom domains | Requires Node.js installed |

### 7.2 Permanent Hosting

| Service | Effort | Best For |
|---------|--------|----------|
| **GitHub Pages** | 2 min setup | Free forever, version control |
| **Cloudflare Pages** | 5 min setup | Fast CDN, generous limits |
| **Vercel** | 2 min setup | Serverless functions if needed |

### 7.3 Local/Offline

- Double-click `index.html` → opens in browser (file:// protocol)
- Run `Start Starlight Inn.bat` → local server + auto-open browser
- No internet required after initial load

---

## 8. MONETIZATION & ECONOMY (ETHICAL)

**Free-to-play, NOT pay-to-win:**
- **Star Coins:** Earned by playing — chatting, trading, visiting, mini-games
- **Moon Gems:** Premium currency — ONLY for cosmetics, NEVER for power
- **LTD Items:** Limited-time drops, tradeable, create scarcity economy
- **Battle Pass (optional):** $5/season, grants cosmetic rewards, NOT gameplay advantages
- **No loot boxes:** All purchases are direct-buy
- **No ads:** Optional "watch ad for coins" ONLY if player chooses

---

## 9. ACCESSIBILITY

- **Font scaling:** UI scales up to 200%
- **Colorblind mode:** Rarity uses patterns + icons, not just color
- **Reduced motion:** Disable particle effects and screen shake
- **Screen reader:** All UI elements have ARIA labels
- **Keyboard navigation:** Full tab-order support, no mouse required
- **High contrast mode:** Optional dark/light theme with strong contrast

---

## 10. PERFORMANCE TARGETS

- **Web:** 60 FPS on mid-tier laptop (Intel i5, integrated graphics)
- **Mobile:** 30 FPS minimum on 3-year-old phones
- **Load time:** First paint < 1 second, interactive < 3 seconds
- **Asset size:** Total bundle < 500KB (sprites compressed as PNG-8 or WebP)
- **Memory:** < 200MB RAM usage

---

## 11. DEVELOPMENT ROADMAP

### Phase 1: Core Loop (DONE — Web Demo)
- ✅ Landing page + character select
- ✅ 6 areas with basic navigation
- ✅ Procedural rectangle avatars (placeholder)
- ✅ Chat system with simulated players
- ✅ Inventory + rarity system
- ✅ Trading window (UI only)
- ✅ Island furniture placement
- ✅ Local server + desktop launcher

### Phase 2: Visual Overhaul (NEXT)
- 🔄 **Proper pixel sprite sheets for all 6 characters**
- 🔄 Tileset art for all 6 areas
- 🔄 Furniture sprite assets
- 🔄 Portrait art for NPCs
- 🔄 Animation system (idle, walk, emote)
- 🔄 Particle effects (fireflies, waves, sparkles)
- 🔄 Day/night cycle visuals

### Phase 3: Multiplayer (REAL)
- WebSocket server with room-based areas
- Player persistence (accounts + database)
- Friend system + private messages
- Trade escrow + anti-scam measures
- Moderation tools + reporting

### Phase 4: Content Expansion
- Seasonal events (Halloween, Winter, Summer)
- Mini-games (surfing, fishing, treasure hunt)
- Guild system + guild islands
- Player marketplace (auction house)
- Mobile app wrapper (Capacitor/Tauri)

### Phase 5: Unity Native Build
- Port all systems to Unity 2022.3 LTS
- URP 2D pipeline with pixel-perfect camera
- Netcode for GameObjects multiplayer
- Steam/Epic distribution
- Console ports (Switch priority)

---

## 12. REBRANDING CHECKLIST (KawaiiCool Island → Starlight Inn)

- [x] Project folder renamed
- [x] All user-facing strings changed
- [x] Logo/title updated
- [x] Unity namespace: `StarlightInn.Core` (was `KawaiiCoolIsland.Core`)
- [x] Unity namespace: `StarlightInn.Avatar` (was `KawaiiCool.Avatar`)
- [ ] Unity C# script string literals updated
- [ ] Documentation links updated
- [ ] Discord/server names updated
- [ ] Social media handles claimed

---

## 13. CRITICAL DECISIONS LOG

| Date | Decision | Why |
|------|----------|-----|
| 2026-04-28 | Path C: Web-native NOW + Unity scaffolding LATER | Unity Editor not installed, no scenes/prefabs exist in archived project |
| 2026-04-28 | Procedural Canvas avatars as placeholder | No artist assets available, needed playable demo fast |
| 2026-04-28 | Single-file HTML deployment | Easiest hosting, no build step, drag-and-drop anywhere |
| 2026-04-28 | Desktop launcher with batch file | User frustration with hosting services, wanted offline play |
| 2026-04-28 | Emoji + colored rectangles → PROPER SPRITES | User feedback: graphics look bad, wants Maplestory quality |

---

## 14. KNOWN ISSUES & WORKAROUNDS

| Issue | Workaround | Permanent Fix |
|-------|-----------|---------------|
| Netlify Drop zip upload fails via automation | Manual drag-and-drop on https://app.netlify.com/drop | Use single-file HTML or CLI deploy |
| localtunnel.me connection refused | Firewall blocks port; use `--subdomain` flag or try `npx localtunnel` | Use paid tunnel service or proper hosting |
| Browser `file://` protocol blocks ES6 modules | Use self-contained single-file HTML (no `type="module"`) | Always serve from `http://` even locally |
| Internet Explorer can't run Canvas 2D | Launcher opens Chrome/Edge explicitly | Drop IE support, target modern browsers |
| No real-time multiplayer | Simulated NPCs with scripted chat | Phase 3: WebSocket server |

---

## 15. FILE STRUCTURE

```
starlight-inn-desktop/
├── index.html              # Self-contained game (ALL code inline)
├── server.js               # Node.js static server (optional)
├── Start Starlight Inn.bat # Windows launcher
└── README.md               # User instructions

starlight-inn-web/          # (development version, modular)
├── index.html              # Main HTML (imports JS modules)
├── css/
│   └── styles.css          # (if split out)
├── js/
│   ├── engine.js           # Core game engine
│   ├── renderer.js         # Sprite + tileset renderer
│   ├── network.js          # WebSocket client (future)
│   └── audio.js            # Web Audio API music/SFX
├── assets/
│   ├── sprites/
│   │   ├── characters/     # 6 kekos, 4 directions, walk cycles
│   │   ├── furniture/      # 18+ placeable items
│   │   ├── npcs/           # Area-specific NPCs
│   │   └── ui/             # Buttons, panels, icons
│   ├── tilesets/
│   │   ├── inn.png
│   │   ├── beach.png
│   │   ├── forest.png
│   │   ├── treehouse.png
│   │   ├── park.png
│   │   └── island.png
│   └── audio/
│       ├── music/
│       └── sfx/
└── server.js               # Dev server

starlight-inn-unity/        # (future native build)
├── Assets/
│   ├── _Project/
│   │   ├── Scripts/
│   │   │   ├── Core/
│   │   │   │   ├── GameManager.cs
│   │   │   │   └── NetworkManager.cs
│   │   │   ├── Avatar/
│   │   │   │   └── AvatarController.cs
│   │   │   ├── UI/
│   │   │   │   └── UIManager.cs
│   │   │   └── Economy/
│   │   │       └── TradeManager.cs
│   │   ├── Prefabs/
│   │   │   ├── PlayerAvatar.prefab
│   │   │   ├── NPC.prefab
│   │   │   └── FurnitureItem.prefab
│   │   ├── Scenes/
│   │   │   ├── LandingPage.unity
│   │   │   ├── CharacterSelect.unity
│   │   │   ├── WorldHub.unity
│   │   │   └── PlayerIsland.unity
│   │   └── Sprites/
│   │       └── (all pixel art assets)
│   └── Plugins/
├── Packages/
│   └── manifest.json
├── ProjectSettings/
└── BuildScripts/
    ├── BuildWebGL.ps1
    └── BuildStandalone.ps1
```

---

## 16. SPRITE ASSET SOURCES (FREE/LEGAL)

**If you don't have an artist, use these:**

| Resource | URL | License | Best For |
|----------|-----|---------|----------|
| OpenGameArt | https://opengameart.org | CC0/CC-BY | Base sprites to modify |
| itch.io (free assets) | https://itch.io/game-assets/free | Varies | High quality packs |
| CraftPix.net | https://craftpix.net/freebies | CC-BY | RPG character sprites |
| Pixel Art Marketplace | https://itch.io/game-assets | Paid $5–$20 | Professional quality |
| Lospec | https://lospec.com/pixel-art-scaler | Tool | Scale pixel art without blur |

**For Maplestory-style characters specifically:**
- Search "chibi sprite sheet" or "SD character sprite"
- Target 32×32 or 32×48 base resolution
- Look for 4-directional walk cycle packs
- Modify colors in Aseprite (free trial) or GraphicsGale (free)

---

## 17. BUILD CHECKLIST (Before Any Release)

- [ ] All sprites loaded correctly (no 404s)
- [ ] All 6 characters render with correct colors
- [ ] All 6 areas load without errors
- [ ] Movement smooth at 60 FPS
- [ ] Chat sends/receives correctly
- [ ] Trade window opens, items display rarity glows
- [ ] Inventory persists across page refresh (LocalStorage)
- [ ] Island furniture saves and loads
- [ ] Mobile touch controls work
- [ ] Audio plays (music + SFX)
- [ ] No console errors in Chrome DevTools
- [ ] File size under 500KB total
- [ ] Works on Chrome, Firefox, Edge, Safari

---

## 18. CONTACT & ATTRIBUTION

**Project Origin:** Rebranded from "KawaiiCool Island" Unity social world concept  
**Original Scripts:** `GameManager.cs`, `AvatarController.cs` (Unity C# framework)  
**Web Version:** Built from scratch using HTML5 Canvas 2D  
**Style Inspiration:** Maplestory (Wizet/Nexon), Habbo Hotel (Sulake), Club Penguin (Disney)

---

_This document is living. Update it when decisions change. Future you will thank present you._

**Last Updated:** 2026-04-28  
**Next Review:** When sprite assets are integrated
