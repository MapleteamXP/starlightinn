# Starlight Inn — Unity Project Setup Guide

> The Unity version is the **premium native client** with full 2D pixel-perfect rendering, richer animations, and native performance.

## Prerequisites

1. **Unity Hub** — Download from [unity.com/download](https://unity.com/download)
2. **Unity Editor 2022.3 LTS** (2022.3.20f1 or newer)
   - Required modules: **2D**, **WebGL Build Support**
3. **Git** (optional, for version control)

## First-Time Setup

### Step 1: Install Unity

```bash
# Via Unity Hub:
# 1. Open Unity Hub
# 2. Installs > Install Editor
# 3. Select Unity 2022.3.20f1 LTS
# 4. Add modules: WebGL Build Support, Android Build Support (optional)
```

### Step 2: Open the Project

```bash
# In Unity Hub:
# 1. Projects > Open
# 2. Navigate to: starlight-inn-unity/
# 3. Click "Open"
# 4. Wait for first import (5-10 minutes)
```

### Step 3: Configure Project

**Graphics Settings** (Window > Rendering > Graphics Settings):
- Set URP 2D Renderer as default pipeline asset
- Enable Pixel Perfect Camera

**Player Settings** (Edit > Project Settings > Player):
- Company Name: `Starlight Studios`
- Product Name: `Starlight Inn`
- Default Icon: Set a 512x512 PNG
- Resolution: 1280x720 (windowed), 1920x1080 (fullscreen)
- WebGL Template: Default

**Input Settings** (Edit > Project Settings > Input Manager):
- Horizontal: Arrow keys + A/D
- Vertical: Arrow keys + W/S
- Interact: Space / E
- Chat: Enter / T
- Inventory: I
- Trade: Y

### Step 4: Create Scenes

Create the following scenes in `Assets/Scenes/`:

| Scene | Purpose |
|-------|---------|
| `LandingPage` | Title screen, name entry, character select |
| `WorldHub` | Starlight Inn Lobby — main social hub |
| `Beach` | Sunset Beach area |
| `Forest` | Whisperwood Forest |
| `Treehouse` | Canopy Treehouse |
| `Park` | Blossom Park |
| `PlayerIsland` | Personal customizable island |

### Step 5: Create Prefabs

Create prefabs in `Assets/Prefabs/`:

```
Prefabs/
├── PlayerAvatar.prefab      — 2D sprite with animator
├── NPC.prefab               — Static NPC with dialogue trigger
├── FurnitureItem.prefab     — Placeable object with rarity glow
├── ChatBubble.prefab        — Floating text above avatars
├── TradeWindow.prefab       — UI panel for trading
├── RoomNode.prefab          — Portal to another area
└── UI/
    ├── MainCanvas.prefab
    ├── TopBar.prefab
    ├── ChatPanel.prefab
    ├── InventoryPanel.prefab
    └── AreaSelector.prefab
```

### Step 6: Import Your Scripts

The `KawaiiCool Island` C# scripts are located at:
```
C:\Users\Renau\OneDrive\Documents\Kimi_Agent_Premium Scalable Social World\project\Assets\_Project\Scripts\
```

Copy these folders to `Assets/Scripts/`:
- `Core/`
- `Avatar/`
- `Social/`
- `Economy/`
- `Minigames/`
- `Data/`
- `Analytics/`

### Step 7: Create Sprite Assets

You need pixel-art sprites for:
- **Characters**: 6 base characters (walk animation: 4 frames each direction)
- **Furniture**: ~20 items (bed, lamp, tree, chair, etc.)
- **Environment**: Tilemap tiles for each biome (floor, walls, decorations)
- **UI**: Buttons, panels, icons, rarity borders
- **Effects**: Particle sprites for glows, sparkles, fireflies

**Recommended tools:**
- [Aseprite](https://www.aseprite.org/) — Best for pixel art ($20)
- [Lospec Pixel Editor](https://lospec.com/pixel-editor/) — Free online
- [Pixilart](https://www.pixilart.com/) — Free online community

**Style guide:**
- Resolution: 32x32 per tile, characters 32x48
- Color palette: [Lospec "Starlight" palette](https://lospec.com/palette-list) or custom cozy palette
- Animation: 4-frame walk cycles, 8fps
- Rarity glows: Match web version colors (blue→purple→orange→gold→red)

### Step 8: Build

**WebGL Build:**
1. File > Build Settings
2. Platform: WebGL
3. Click "Switch Platform" (first time only)
4. Compression Format: Gzip
5. Click "Build And Run"
6. Output folder: `Builds/WebGL/`

**Standalone Build:**
1. File > Build Settings
2. Platform: PC, Mac & Linux Standalone
3. Target Platform: Windows
4. Architecture: x86_64
5. Click "Build"
6. Output folder: `Builds/Standalone/`

## Script Adaptation Notes

The existing C# scripts from `KawaiiCool Island` use a different namespace structure. Adapt them:

```csharp
// OLD namespace
namespace KawaiiCool.Avatar { }

// NEW namespace
namespace StarlightInn.Avatar { }
```

Update all `using` statements and class references accordingly.

## Architecture Overview

```
Starlight Inn (Unity)
├── Scenes/
│   ├── LandingPage (UI Canvas + CharacterSelect)
│   ├── WorldHub (Tilemap + NPCs + Players)
│   ├── Beach, Forest, Treehouse, Park (Area scenes)
│   └── PlayerIsland (Editable tilemap)
├── Prefabs/
│   ├── PlayerAvatar (Sprite + Animator + Movement)
│   ├── Furniture (Placeable + RarityGlow)
│   └── UI elements
├── Scripts/
│   ├── Core/ (GameManager, SceneLoader, Input)
│   ├── Avatar/ (Customization, Animation)
│   ├── Social/ (Chat, Friends, Trading)
│   ├── Economy/ (Inventory, Currency, Items)
│   └── Network/ (Mirror/Netcode for multiplayer)
├── Sprites/
│   ├── Characters/ (32x48 walk animations)
│   ├── Furniture/ (32x32 items)
│   ├── Environment/ (Tilemap tiles)
│   └── UI/ (Buttons, panels, icons)
├── Tilemaps/
│   ├── HubTiles/
│   ├── BeachTiles/
│   └── ForestTiles/
└── Settings/
    └── URP 2D Renderer
```

## Multiplayer Options

### Option A: Mirror (Free, Open Source)
```bash
# Install via Package Manager
# Window > Package Manager > Add package from git URL
# URL: https://github.com/MirrorNetworking/Mirror.git
```

### Option B: Unity Netcode for GameObjects (Official)
```bash
# Install via Package Manager
# Search: "Netcode for GameObjects"
```

### Option C: Photon PUN 2 (Commercial, easiest)
```bash
# Download from Asset Store
# Requires Photon account (free tier: 20 CCU)
```

**Recommended for Starlight Inn:** Photon PUN 2 — easiest setup for social/MMO-style games.

## Next Steps After Setup

1. ✅ Create placeholder scenes with basic tilemaps
2. ✅ Place PlayerAvatar prefab with movement script
3. ✅ Add NPCs with dialogue triggers
4. ✅ Implement chat UI with Photon/Mirror
5. ✅ Add inventory UI with drag-and-drop
6. ✅ Build trade window with rarity glow shaders
7. ✅ Create island editor (click to place furniture)
8. ✅ Add particle effects (fireflies, sparkles, campfire smoke)
9. ✅ Compose ambient music + SFX
10. ✅ Beta test with friends!

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No valid Unity Editor" | Install 2022.3 LTS via Unity Hub |
| Pink/magenta textures | Assign URP 2D material to sprites |
| Blurry pixel art | Enable Pixel Perfect Camera on camera |
| Scripts not compiling | Check .NET version in Player Settings |
| WebGL build fails | Disable exceptions in Player Settings > Publishing Settings |

## Resources

- [Unity 2D Game Kit](https://unity.com/learn/game-kits) — Learn 2D fundamentals
- [2D Pixel Perfect](https://docs.unity3d.com/Packages/com.unity.2d.pixel-perfect@5.0/manual/index.html) — Official docs
- [URP 2D Renderer](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/2d-index.html) — Lighting & shaders
- [Aseprite](https://www.aseprite.org/) — Pixel art tool

---

*"Every star in the sky is someone's island."* ⭐
