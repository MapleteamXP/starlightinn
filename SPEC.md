# KawaiiCool Island — Unity Cross-Platform Social World Game
## Technical Specification v1.0

---

## 1. Project Overview

**Game**: KawaiiCool Island — A cross-platform social hangout game with avatar customization, player islands, minigames, and real-time multiplayer.
**Unity Version**: 2023.2.x LTS
**Render Pipeline**: Universal Render Pipeline (URP) 2D
**Target Platforms**: Android, iOS, Windows, macOS
**Frame Rate Target**: 60 FPS on mobile, uncapped on desktop

---

## 2. Project Structure

```
Assets/
  _Project/
    Animations/              # Animator controllers, animation clips
    Audio/
      Music/                 # Layered music tracks
      SFX/                   # Sound effects by category
    Prefabs/
      Avatar/                # Avatar parts, equipment pieces
      Island/                # Placeable objects, tiles
      UI/                    # UI panels, popups, buttons
      Effects/               # Particle systems
    Resources/               # Runtime-loaded assets
    Scenes/
      Boot.unity             # First scene: initializes all systems
      MainMenu.unity         # Title screen, login, character select
      Island.unity           # Personal island (singleplayer + multiplayer host)
      Hub.unity              # Central social hub world
      Minigame_[Name].unity  # Individual minigame scenes
    ScriptableObjects/
      Items/                 # Item definitions
      Clothing/              # Clothing piece definitions
      Emotes/                # Emote definitions
      Minigames/             # Minigame config
      Audio/                 # Audio event definitions
    Scripts/
      Core/                  # Singletons, event system, save/load
      Avatar/                # Avatar controller, customization
      Island/                # Island editor, placement, persistence
      Multiplayer/           # Netcode, room management, sync
      UI/                    # Canvas management, panels, transitions
      Chat/                  # Chat system, bubbles, moderation
      Minigames/             # Minigame framework + implementations
      Inventory/             # Inventory grid, drag-drop, shop
      Audio/                 # Dynamic music, SFX, spatial audio
      Backend/               # Firebase, PlayFab, REST client
    Settings/
      URP/                   # Pipeline assets, renderer data
      Input/                 # Input actions asset
      Audio/                 # Audio mixer
    Sprites/
      Characters/            # Avatar sprite sheets (PSB)
      Clothing/              # Clothing sprite sheets
      Environment/           # Island tiles, furniture, decor
      UI/                    # UI sprites, icons, backgrounds
      Effects/               # Particle textures
```

---

## 3. Core Architecture

### 3.1 Singleton Pattern

```csharp
public abstract class Singleton<T> : MonoBehaviour where T : MonoBehaviour
{
    public static T Instance { get; private set; }
    protected virtual void Awake()
    {
        if (Instance != null) { Destroy(gameObject); return; }
        Instance = this as T;
        if (DontDestroyOnLoad) DontDestroyOnLoad(gameObject);
    }
    protected virtual bool DontDestroyOnLoad => true;
}
```

### 3.2 Event Bus (type-safe, decoupled)

```csharp
public static class EventBus
{
    private static readonly Dictionary<Type, Delegate> _events = new();
    public static void Subscribe<T>(Action<T> handler) where T : IGameEvent { ... }
    public static void Unsubscribe<T>(Action<T> handler) where T : IGameEvent { ... }
    public static void Publish<T>(T eventData) where T : IGameEvent { ... }
}

public interface IGameEvent {}
public struct AvatarChangedEvent : IGameEvent { public string PartCategory; public string NewLabel; }
public struct InventoryChangedEvent : IGameEvent { public string ItemId; public int Delta; }
public struct CurrencyChangedEvent : IGameEvent { public string CurrencyType; public int NewBalance; }
public struct ChatMessageEvent : IGameEvent { public string SenderId; public string Message; public ChatChannel Channel; }
public struct IslandObjectPlacedEvent : IGameEvent { public PlacedObjectData ObjectData; }
public struct MinigameStateChangedEvent : IGameEvent { public MinigameState NewState; }
```

### 3.3 Save/Load System

```csharp
public interface ISaveable
{
    string SaveKey { get; }
    string ToJson();
    void FromJson(string json);
}

public class SaveManager : Singleton<SaveManager>
{
    // Local save via JSON + optional cloud sync via PlayFab
    public void Save(string key, string jsonData);
    public string Load(string key);
    public void SaveAll();
    public void LoadAll();
    public void CloudSync();
}
```

### 3.4 ScriptableObject Architecture

All game data defined as ScriptableObjects:

```csharp
[CreateAssetMenu(fileName = "Item_", menuName = "KawaiiCool/Item")]
public class ItemData : ScriptableObject
{
    public string ItemId;
    public string DisplayName;
    public string Description;
    public Sprite Icon;
    public ItemRarity Rarity;
    public ItemCategory Category;
    public int PurchasePrice;
    public string CurrencyType; // "coins", "gems"
    public bool IsPremium;
    public string[] Tags;
}

public enum ItemRarity { Common, Uncommon, Rare, Epic, Legendary }
public enum ItemCategory { Clothing, Accessory, Furniture, Consumable, Currency }
```

---

## 4. Avatar System

### 4.1 Avatar Controller

```csharp
public class AvatarController : MonoBehaviour
{
    [Header("Body Parts")]
    public SpriteRenderer BodyRenderer;
    public SpriteRenderer HairBackRenderer;
    public SpriteRenderer HairFrontRenderer;
    public SpriteRenderer FaceRenderer;
    public SpriteRenderer TopRenderer;
    public SpriteRenderer BottomRenderer;
    public SpriteRenderer ShoesRenderer;
    public SpriteRenderer Accessory1Renderer;
    public SpriteRenderer Accessory2Renderer;

    [Header("Animation")]
    public Animator Animator;
    public SpriteLibrary SpriteLibrary;

    private Dictionary<string, SpriteResolver> _resolvers;

    public void ApplyOutfit(OutfitData outfit);
    public void SwapPart(string category, string label);
    public void PlayEmote(string emoteName);
    public void SetMovement(Vector2 direction, bool isMoving);
}
```

### 4.2 Outfit Data (ScriptableObject)

```csharp
[CreateAssetMenu(fileName = "Outfit_", menuName = "KawaiiCool/Outfit")]
public class OutfitData : ScriptableObject
{
    public string OutfitName;
    public string Body;
    public string Hair;
    public string Face;
    public string Top;
    public string Bottom;
    public string Shoes;
    public string Accessory1;
    public string Accessory2;
    public string Emote;
}
```

### 4.3 Emote System

```csharp
[CreateAssetMenu(fileName = "Emote_", menuName = "KawaiiCool/Emote")]
public class EmoteData : ScriptableObject
{
    public string EmoteId;
    public string DisplayName;
    public Sprite Icon;
    public AnimationClip AnimationClip;
    public AudioClip SFX;
    public float Duration;
    public bool Loop;
    public bool CanMoveWhilePlaying;
}

public class EmotePlayer : MonoBehaviour
{
    public void PlayEmote(EmoteData emote);
    public void StopEmote();
    public event Action<EmoteData> OnEmoteStarted;
    public event Action OnEmoteEnded;
}
```

---

## 5. Island Editor System

### 5.1 Placement System

```csharp
public class IslandEditor : MonoBehaviour
{
    [Header("References")]
    public Tilemap GroundTilemap;
    public Transform ObjectsContainer;
    public Camera EditorCamera;

    [Header("Settings")]
    public float CellSize = 1f;
    public bool SnapToGrid = true;
    public LayerMask PlacementLayer;

    private PlaceableObject _selectedObject;
    private GameObject _ghostObject;
    private bool _isDragging;

    public void SelectObject(PlaceableObject prefab);
    public void PlaceObject(Vector3 worldPosition);
    public void RemoveObject(PlacedObjectData target);
    public void RotateSelected(int degrees);
    public void SetSnapToGrid(bool snap);
    public void SaveLayout(string slotName);
    public void LoadLayout(string slotName);
    public void ClearIsland();
}
```

### 5.2 Placeable Object

```csharp
public class PlaceableObject : MonoBehaviour
{
    public string ObjectId;
    public string DisplayName;
    public Sprite Icon;
    public Sprite PreviewSprite;
    public Vector2Int Size = Vector2Int.one;
    public PlacementType PlacementType;
    public bool CanRotate = true;
    public bool CanScale = false;
    public Vector2 MinScale = Vector2.one;
    public Vector2 MaxScale = Vector2.one * 3f;
    public int PurchasePrice;
    public string CurrencyType;
}

public enum PlacementType { Ground, Wall, Floor, Ceiling, Any }
```

### 5.3 Save Data

```csharp
[System.Serializable]
public class IslandSaveData
{
    public string SaveSlotName;
    public string LastSaved;
    public List<TileSaveData> Tiles = new();
    public List<PlacedObjectData> Objects = new();
}

[System.Serializable]
public class PlacedObjectData
{
    public string ObjectId;
    public Vector3 Position;
    public Vector3 Rotation;
    public Vector3 Scale;
    public int SortingOrder;
}

[System.Serializable]
public class TileSaveData
{
    public string TileId;
    public Vector3Int CellPosition;
    public string TilemapName;
}
```

---

## 6. Multiplayer System (Netcode for GameObjects)

### 6.1 Network Manager

```csharp
public class KawaiiNetworkManager : Singleton<KawaiiNetworkManager>
{
    public NetworkManager NetworkManager;
    public GameObject PlayerPrefab;

    [Header("Settings")]
    public int MaxPlayers = 20;
    public float ProximityChatRange = 10f;
    public float PositionSyncRate = 10f; // per second

    private Dictionary<ulong, NetworkedPlayer> _connectedPlayers = new();

    public void StartHost();
    public void StartClient(string joinCode);
    public void Disconnect();
    public NetworkedPlayer GetPlayer(ulong clientId);
    public List<NetworkedPlayer> GetNearbyPlayers(Vector3 position, float radius);

    // Events
    public event Action<ulong> OnPlayerConnected;
    public event Action<ulong> OnPlayerDisconnected;
}
```

### 6.2 Networked Player

```csharp
public class NetworkedPlayer : NetworkBehaviour
{
    [Header("Avatar")]
    public AvatarController Avatar;

    [Header("UI")]
    public ChatBubble ChatBubble;
    public GameObject NameTag;

    private NetworkVariable<Vector3> _netPosition = new(writePerm: NetworkVariableWritePermission.Owner);
    private NetworkVariable<Vector2> _netMovement = new(writePerm: NetworkVariableWritePermission.Owner);
    private NetworkVariable<FixedString64Bytes> _displayName = new(writePerm: NetworkVariableWritePermission.Owner);
    private NetworkVariable<FixedString128Bytes> _outfitJson = new(writePerm: NetworkVariableWritePermission.Owner);

    public override void OnNetworkSpawn();
    private void Update();
    private void UpdateMovement();
    private void UpdateRemoteInterpolation();

    [ServerRpc]
    public void SendChatMessageServerRpc(string message, ChatChannel channel);

    [ClientRpc]
    public void ReceiveChatMessageClientRpc(string senderName, string message, ChatChannel channel);

    [ServerRpc]
    public void PlayEmoteServerRpc(string emoteId);

    [ClientRpc]
    public void PlayEmoteClientRpc(string emoteId);
}
```

### 6.3 Room Manager

```csharp
public class RoomManager : Singleton<RoomManager>
{
    public string CurrentRoomId { get; private set; }
    public RoomType CurrentRoomType { get; private set; }
    public int MaxPlayers { get; private set; }
    public List<PlayerInfo> PlayersInRoom { get; private set; }

    public void CreateRoom(RoomType type, int maxPlayers = 20);
    public void JoinRoom(string roomId);
    public void JoinRandomRoom(RoomType type);
    public void LeaveRoom();

    public event Action OnRoomJoined;
    public event Action OnRoomLeft;
    public event Action<PlayerInfo> OnPlayerJoinedRoom;
    public event Action<PlayerInfo> OnPlayerLeftRoom;
}

public enum RoomType { Hub, Island, Minigame, Private }
```

---

## 7. Chat System

### 7.1 Chat Manager

```csharp
public class ChatManager : Singleton<ChatManager>
{
    [Header("Settings")]
    public int MaxMessageHistory = 100;
    public float MessageDisplayTime = 5f;
    public float TypingIndicatorTimeout = 5f;

    private Dictionary<ChatChannel, List<ChatMessage>> _messageHistory = new();
    private Dictionary<string, TypingIndicator> _typingIndicators = new();

    public void SendMessage(string message, ChatChannel channel);
    public void SendEmoteReaction(string emoteId, string targetMessageId);
    public void SendSticker(string stickerId);
    public void SetTyping(bool isTyping);
    public void ShowTypingIndicator(string playerId, string playerName);
    public void HideTypingIndicator(string playerId);

    public event Action<ChatMessage> OnMessageReceived;
    public event Action<string, string> OnTypingIndicatorShown;
}

public enum ChatChannel { World, Proximity, Island, Party, System }

public struct ChatMessage
{
    public string MessageId;
    public string SenderId;
    public string SenderName;
    public string Content;
    public ChatChannel Channel;
    public float Timestamp;
    public List<EmoteReaction> Reactions;
}
```

### 7.2 Chat Bubble (World Space)

```csharp
public class ChatBubble : MonoBehaviour
{
    public TMP_Text MessageText;
    public CanvasGroup CanvasGroup;
    public float DisplayDuration = 4f;
    public float FadeDuration = 0.5f;
    public Vector3 WorldOffset = new(0, 1.5f, 0);

    public void ShowMessage(string message);
    public void ShowEmote(Sprite emoteIcon);
    private IEnumerator FadeOutCoroutine();
}
```

---

## 8. UI Framework

### 8.1 Canvas Manager

```csharp
public class UIManager : Singleton<UIManager>
{
    [Header("Canvases")]
    public Canvas MainCanvas;
    public Canvas OverlayCanvas;
    public Canvas PopupCanvas;

    [Header("Panels")]
    public List<UIPanel> Panels = new();

    private Stack<UIPanel> _panelHistory = new();

    public void ShowPanel(string panelId, bool pushToHistory = true);
    public void HidePanel(string panelId);
    public void GoBack();
    public void ShowPopup(string message, PopupType type = PopupType.Info);
    public void ShowToast(string message, float duration = 2f);

    // Platform detection
    public DeviceType CurrentDeviceType { get; private set; }
    public bool IsMobile => CurrentDeviceType == DeviceType.Mobile;
    public bool IsDesktop => CurrentDeviceType == DeviceType.Desktop;
}

public abstract class UIPanel : MonoBehaviour
{
    public string PanelId;
    public bool IsModal;
    public PanelAnimation EnterAnimation;
    public PanelAnimation ExitAnimation;

    public virtual void OnShow();
    public virtual void OnHide();
    public virtual void OnRefresh();
}
```

### 8.2 Transitions

```csharp
public static class UITransitions
{
    public static IEnumerator FadeIn(CanvasGroup target, float duration);
    public static IEnumerator FadeOut(CanvasGroup target, float duration);
    public static IEnumerator SlideIn(RectTransform target, Vector2 fromOffset, float duration);
    public static IEnumerator SlideOut(RectTransform target, Vector2 toOffset, float duration);
    public static IEnumerator ScaleIn(RectTransform target, float duration);
    public static IEnumerator ScaleOut(RectTransform target, float duration);
    public static IEnumerator BounceIn(RectTransform target, float duration);
}
```

---

## 9. Minigame Framework

### 9.1 State Machine Base

```csharp
public abstract class MinigameController : MonoBehaviour
{
    [Header("Config")]
    public MinigameData Data;
    public float CountdownDuration = 3f;
    public float GameDuration = 60f;

    protected MinigameState CurrentState { get; private set; }
    protected float Timer { get; private set; }
    protected Dictionary<ulong, int> PlayerScores = new();

    protected virtual void Update();
    protected abstract void OnEnterWaiting();
    protected abstract void OnEnterCountdown();
    protected abstract void OnEnterPlaying();
    protected abstract void OnEnterGameOver();
    protected abstract void OnUpdateWaiting();
    protected abstract void OnUpdatePlaying();
    protected abstract void OnUpdateGameOver();

    protected void ChangeState(MinigameState newState);
    protected void EndGame();
    protected void AwardRewards();
}

public enum MinigameState { Waiting, Countdown, Playing, GameOver }
```

### 9.2 Minigame Implementations

**Rhythm Dance:**
```csharp
public class RhythmDanceMinigame : MinigameController
{
    // Notes spawn and travel toward hit zones
    // Player presses corresponding key when note overlaps hit zone
    // Scoring: Perfect/Great/Good/Miss
    // Combo multiplier system
}
```

**Fashion Voting:**
```csharp
public class FashionVotingMinigame : MinigameController
{
    // Players dress up according to a theme
    // Voting phase: everyone votes on each other's outfits
    // Points for theme adherence + vote popularity
}
```

**Coin Rush:**
```csharp
public class CoinRushMinigame : MinigameController
{
    // Arena spawns coins, power-ups, hazards
    // Collect most coins within time limit
    // Power-ups: magnet, speed boost, shield
}
```

**Trivia:**
```csharp
public class TriviaMinigame : MinigameController
{
    // Multiple choice questions
    // Timer per question (faster = more points)
    // Category selection, difficulty scaling
}
```

---

## 10. Inventory & Shop System

### 10.1 Inventory Manager

```csharp
public class InventoryManager : Singleton<InventoryManager>
{
    private Dictionary<string, InventoryItem> _items = new();
    private Dictionary<string, int> _currencies = new();

    public void AddItem(string itemId, int quantity = 1);
    public void RemoveItem(string itemId, int quantity = 1);
    public bool HasItem(string itemId, int quantity = 1);
    public int GetItemQuantity(string itemId);
    public void AddCurrency(string currencyType, int amount);
    public bool SpendCurrency(string currencyType, int amount);
    public int GetCurrency(string currencyType);
    public List<InventoryItem> GetItemsByCategory(ItemCategory category);

    public event Action<string, int> OnItemAdded;
    public event Action<string, int> OnItemRemoved;
    public event Action<string, int> OnCurrencyChanged;
}

public class InventoryItem
{
    public string ItemId;
    public ItemData Data;
    public int Quantity;
    public bool IsEquipped;
    public string InstanceId;
}
```

### 10.2 Shop

```csharp
public class ShopManager : Singleton<ShopManager>
{
    [Header("Sections")]
    public List<ShopSection> Sections = new();

    [Header("Events")]
    public List<ShopEvent> ActiveEvents = new();

    public void PurchaseItem(string itemId, string currencyType);
    public bool CanAfford(string itemId, string currencyType);
    public List<ItemData> GetDailyRotation();
    public void RefreshDailyShop();

    public event Action<ItemData> OnItemPurchased;
}

public class ShopSection
{
    public string SectionId;
    public string DisplayName;
    public Sprite Icon;
    public ItemCategory Category;
    public List<ItemData> Items;
}

public class ShopEvent
{
    public string EventId;
    public string EventName;
    public Sprite Banner;
    public DateTime StartTime;
    public DateTime EndTime;
    public List<string> DiscountedItemIds;
    public float DiscountMultiplier;
}
```

### 10.3 Daily Rewards

```csharp
public class DailyRewardsSystem : MonoBehaviour
{
    public int CurrentStreak { get; private set; }
    public DateTime LastClaimTime { get; private set; }
    public bool CanClaimToday { get; private set; }

    public void ClaimDay(int dayIndex);
    public void CheckStreak();
    public List<RewardData> GetWeekRewards();
}
```

---

## 11. Audio System

### 11.1 Dynamic Music

```csharp
public class DynamicMusicController : Singleton<DynamicMusicController>
{
    [Header("Layers")]
    public AudioSource BaseLayer;
    public AudioSource MelodyLayer;
    public AudioSource HarmonyLayer;
    public AudioSource AccentLayer;

    [Header("Snapshots")]
    public AudioMixerSnapshot ExploreSnapshot;
    public AudioMixerSnapshot SocialSnapshot;
    public AudioMixerSnapshot MinigameSnapshot;
    public AudioMixerSnapshot MenuSnapshot;

    public void SetMusicState(MusicState state);
    public void CrossfadeToSnapshot(AudioMixerSnapshot snapshot, float duration);
    public void SetLayerVolume(int layerIndex, float volume, float fadeDuration);
}

public enum MusicState { Menu, Explore, Social, Minigame, IslandEdit }
```

### 11.2 SFX Manager

```csharp
public class SFXManager : Singleton<SFXManager>
{
    [Header("Pools")]
    public int PoolSize = 20;
    private Queue<AudioSource> _sfxPool = new();

    [Header("Categories")]
    public List<SFXCategory> Categories = new();

    public void PlaySFX(string sfxId, Vector3? position = null);
    public void PlaySFXRandom(string categoryId);
    public void PlayUISFX(string sfxId);
    public void StopAllSFX();
}

[CreateAssetMenu(fileName = "SFX_", menuName = "KawaiiCool/SFX")]
public class SFXData : ScriptableObject
{
    public string SFXId;
    public AudioClip Clip;
    public float Volume = 1f;
    public float Pitch = 1f;
    public float PitchRandomness;
    public bool IsSpatial;
    public float MaxDistance = 20f;
    public SFXCategory Category;
}
```

---

## 12. Backend Integration

### 12.1 Firebase Manager

```csharp
public class FirebaseManager : Singleton<FirebaseManager>
{
    private FirebaseAuth _auth;
    private FirebaseAnalytics _analytics;
    private FirebaseUser _currentUser;

    public bool IsInitialized { get; private set; }
    public bool IsLoggedIn => _currentUser != null;
    public string UserId => _currentUser?.UserId;

    public async Task Initialize();
    public async Task<bool> SignInAnonymously();
    public async Task<bool> SignInWithEmail(string email, string password);
    public async Task<bool> SignInWithGoogle();
    public async Task<bool> CreateAccount(string email, string password, string displayName);
    public void SignOut();
    public void LogEvent(string eventName, Dictionary<string, object> parameters);
}
```

### 12.2 PlayFab Manager

```csharp
public class PlayFabManager : Singleton<PlayFabManager>
{
    public bool IsLoggedIn { get; private set; }
    public string PlayFabId { get; private set; }
    public string DisplayName { get; private set; }

    public async Task LoginWithFirebase(string firebaseToken);
    public async Task UpdatePlayerData(string key, string jsonValue);
    public async Task<string> GetPlayerData(string key);
    public async Task UpdateStatistics(string statName, int value);
    public async Task<List<PlayerLeaderboardEntry>> GetLeaderboard(string statName, int maxResults);
    public async Task GrantCurrency(string currencyCode, int amount);
    public async Task<bool> SpendCurrency(string currencyCode, int amount);
    public async Task<int> GetCurrency(string currencyCode);
    public async Task PurchaseItem(string itemId, string currencyCode, int price);
    public async Task<List<PlayFabItemInstance>> GetInventory();
}
```

### 12.3 REST API Client

```csharp
public class GameAPIClient : Singleton<GameAPIClient>
{
    public string BaseUrl = "https://api.kawaiicool.game/v1";

    public async Task<APIResponse<PlayerProfile>> GetPlayerProfile(string playerId);
    public async Task<APIResponse<List<FriendInfo>>> GetFriends();
    public async Task<APIResponse<bool>> AddFriend(string friendId);
    public async Task<APIResponse<bool>> ReportPlayer(string targetId, ReportReason reason, string details);
    public async Task<APIResponse<bool>> TradeRequest(string targetId, List<string> offerItems, List<string> requestItems);
    public async Task<APIResponse<ServerTime>> GetServerTime();
}
```

---

## 13. Input System

### 13.1 Input Actions Asset Structure

**Action Maps:**
- **Gameplay**: Movement (Vector2), Interact (Button), Jump (Button), EmoteWheel (Button)
- **UI**: Navigate (Vector2), Submit (Button), Cancel (Button), Point (Vector2), Click (Button), ScrollWheel (Vector2)
- **IslandEditor**: Place (Button), Remove (Button), Rotate (Button), ToggleSnap (Button)

**Control Schemes:**
- KeyboardMouse: WASD/Arrows, Space, E, Tab, Mouse
- Gamepad: Left Stick, Face Buttons, D-Pad, Triggers
- Touch: On-Screen Joystick, On-Screen Buttons, Tap

### 13.2 Input Manager

```csharp
public class InputManager : Singleton<InputManager>
{
    public PlayerInput PlayerInput;
    public InputActionAsset InputActions;

    [Header("Touch Controls")]
    public GameObject MobileTouchControls;
    public OnScreenStick MovementJoystick;
    public OnScreenButton InteractButton;

    public Vector2 MovementInput { get; private set; }
    public bool IsInteracting { get; private set; }
    public bool IsJumping { get; private set; }

    public void EnableActionMap(string mapName);
    public void DisableActionMap(string mapName);
    public void SetControlScheme(string schemeName);
    public void ShowTouchControls(bool show);

    public event Action OnInteractPressed;
    public event Action OnJumpPressed;
    public event Action<Vector2> OnMove;
}
```

---

## 14. Build Configuration

### 14.1 Platform Settings

| Platform | Target FPS | Texture Quality | Bloom Quality | Shadow Quality |
|----------|-----------|-----------------|---------------|----------------|
| Android (Mid) | 30 | Half Res | Quarter | Off |
| Android (High) | 60 | Full | Half | Off |
| iOS | 60 | Full | Half | Off |
| Windows | 144 | Full | Full | 2D Shadows |
| macOS | 120 | Full | Full | 2D Shadows |

### 14.2 Quality Levels (URP Asset)

- **Mobile Low**: No bloom, no post-processing, simple shaders
- **Mobile High**: Bloom (quarter), basic post-processing
- **Desktop**: Full bloom, all post-processing, HDR

---

## 15. Performance Targets

- **Draw Calls**: < 100 on mobile, < 200 on desktop
- **SetPass Calls**: < 50 on mobile
- **Texture Memory**: < 128MB on mobile, < 512MB on desktop
- **GC Alloc**: < 1KB per frame during gameplay
- **Load Time**: < 5 seconds to main menu on mid-tier mobile
- **Scene Transition**: < 2 seconds with loading screen
