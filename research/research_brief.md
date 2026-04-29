# KawaiiCool Island — Technical Research Brief

## Date: 2026-04-28
## Unity Version: 2023.2+ LTS
## Render Pipeline: Universal Render Pipeline (URP) 2D

---

## 1. Networking Decision: Unity Netcode for GameObjects (NGO)

**Why NGO over Mirror/FishNet:**
- Official Unity support with best integration for Unity Gaming Services (Relay, Lobby)
- Owner-authoritative model perfect for casual social games (not competitive FPS)
- NetworkVariables for lightweight state sync (position, animation states)
- RPCs for actions (emotes, chat, interactions)
- ClientNetworkTransform available for smooth 2D movement interpolation
- Room-based architecture fits our "island hangout" model

**Architecture Pattern:**
- NetworkManager as singleton host
- Player prefab with NetworkObject + ClientNetworkTransform
- Owner-writes for position (NetworkVariable with Owner write permission)
- Others interpolate via Vector3.Lerp in Update
- ServerRpc for validated actions (purchases, trades)

---

## 2. Avatar System: 2D Animation Package + Sprite Library

**Core Tech:**
- Unity 2D Animation package (com.unity.2d.animation)
- Sprite Library Asset: Categories = Body, Hair, Face, Top, Bottom, Shoes, Accessory1, Accessory2
- Sprite Resolver per category on child GameObjects
- Parent GameObject with multiple child SpriteRenderers (sorted by Order in Layer)
- Animator with bone-based skeletal animation for emotes/movement

**Layer Order (bottom to top):**
1. Body/Skin (base layer)
2. Shoes
3. Bottom (pants/skirts)
4. Top (shirts/jackets)
5. Hair (back)
6. Head/Face
7. Hair (front/bangs)
8. Accessories
9. Makeup/Face paint

**Runtime Swap:**
```csharp
resolver.SetCategoryAndLabel("Top", "hoodie_pink");
```

---

## 3. URP 2D Renderer + Post-Processing

**Setup:**
- URP Pipeline Asset with 2D Renderer
- Camera: HDR enabled, Post Processing enabled
- Global Volume GameObject with Bloom override
- Bloom settings for kawaii glow:
  - Threshold: 0.8 (lower = more glow)
  - Intensity: 0.4
  - Scatter: 0.7
  - Tint: Soft pastel (pink/blue gradient)
  - High Quality Filtering: OFF for mobile
  - Downscale: Quarter for mobile, Half for desktop

**Performance:**
- Use Sprite Atlas for 4096x4096 sheets
- Occlusion culling not needed for 2D (use culling groups instead)
- LOD: Multiple sprite resolutions via AssetBundles or Addressables

---

## 4. Backend: Firebase + PlayFab Hybrid

**Firebase (General Services):**
- Authentication (Anonymous, Email/Password, Google, Apple, Facebook)
- Analytics (player behavior, retention)
- Crashlytics
- Cloud Messaging (push notifications)
- Remote Config (feature flags, event tuning)

**PlayFab (Game-Specific):**
- Player Data / Cloud Save (inventory, island layouts, avatar state)
- Economy (currencies: Coins, Gems, Tickets)
- Inventory system (item catalog with custom data)
- Leaderboards (minigame scores, fashion voting)
- CloudScript / Azure Functions (server-side validation)

**Why Both:**
- Firebase free tier generous for auth + analytics
- PlayFab purpose-built for game economies and live-ops
- Secure economy requires server-side validation via CloudScript

---

## 5. Input System: Unity Input System Package

**Control Schemes:**
- **KeyboardMouse**: WASD/Arrow movement, mouse for UI, E for interact
- **Gamepad**: Left stick movement, face buttons for actions
- **Touch**: On-screen joystick (left), action buttons (right), tap to interact

**Implementation:**
- Input Actions asset with separate action maps
- PlayerInput component, Invoke Unity Events behavior
- Runtime control scheme switching via InputUser
- OnScreenStick + OnScreenButton for mobile UI controls

---

## 6. Island Editor: Tilemap + Custom Placement

**Architecture:**
- Tilemap for ground/flooring (grid-locked)
- Custom placement system for furniture/decos (free placement + snap toggle)
- Grid snapping: mathf.round(pos / cellSize) * cellSize
- Rotation: 90-degree increments (Q/E keys)
- Scaling: uniform scale with min/max bounds

**Save/Load:**
- Proxy serialization: save object ID, position, rotation, scale as JSON
- Don't serialize TileBase directly — save tile coordinates + tile asset name
- Multiple save slots as separate JSON files
- Cloud sync via PlayFab Cloud Save

---

## 7. UI: Responsive Canvas Scaler

**Mobile Layout:**
- Canvas Scaler: Scale With Screen Size, Reference 1080x1920 (portrait)
- Bottom nav bar, floating action buttons
- Full-screen panels for inventory, shop, avatar editor
- Safe area padding for notches

**Desktop Layout:**
- Canvas Scaler: Scale With Screen Size, Reference 1920x1080 (landscape)
- Side panels, persistent chat window
- Mouse hover tooltips
- Keyboard shortcuts

**Transitions:**
- Custom tweening system (coroutine-based, no DOTween dependency)
- Panel slide/fade animations
- Particle bursts on UI interactions

---

## 8. Audio: Dynamic Layers

**Music:**
- 3-4 layered audio tracks (base rhythm, melody, harmony, accents)
- Volume crossfading between layers based on gameplay state (exploring, minigame, social)
- FMOD or custom AudioMixer snapshots

**SFX:**
- Event-driven: each interaction triggers appropriate SFX
- Spatial audio for 2D: AudioSource with rolloff based on camera distance
- Categories: UI, Footsteps, Interactions, Minigames, Ambient

**Voice Chat:**
- Vivox (Unity Gaming Services) or Photon Voice
- Proximity-based: only hear nearby players
- Push-to-talk or voice activation
