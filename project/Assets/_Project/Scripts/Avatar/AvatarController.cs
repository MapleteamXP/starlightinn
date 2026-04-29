using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.U2D.Animation;

namespace KawaiiCool.Avatar
{
    /// <summary>
    /// Central controller for a player or NPC avatar in KawaiiCool Island.
    /// Manages SpriteRenderer layering, SpriteResolver-based part swapping,
    /// outfit application, emote playback, movement with physics, and animation blending.
    /// 
    /// Hierarchy expected:
    ///   Avatar (this script, Animator, SpriteLibrary, Rigidbody2D)
    ///     Body       (SpriteRenderer, SpriteResolver)     - sort order 0
    ///     Shoes      (SpriteRenderer, SpriteResolver)     - sort order 1
    ///     Bottom     (SpriteRenderer, SpriteResolver)     - sort order 2
    ///     Top        (SpriteRenderer, SpriteResolver)     - sort order 3
    ///     HairBack   (SpriteRenderer, SpriteResolver)     - sort order 4
    ///     Head       (SpriteRenderer, SpriteResolver)     - sort order 5
    ///     HairFront  (SpriteRenderer, SpriteResolver)     - sort order 6
    ///     Accessory1 (SpriteRenderer, SpriteResolver)     - sort order 7
    ///     Accessory2 (SpriteRenderer, SpriteResolver)     - sort order 8
    /// </summary>
    [RequireComponent(typeof(Rigidbody2D))]
    [RequireComponent(typeof(Animator))]
    public class AvatarController : MonoBehaviour
    {
        // =====================================================================
        // RENDER LAYERS
        // =====================================================================
        [Header("Render Layers")]
        [Tooltip("Base body / skin layer (sorting order 0).")]
        public SpriteRenderer BodyRenderer;

        [Tooltip("Shoes / feet layer (sorting order 1).")]
        public SpriteRenderer ShoesRenderer;

        [Tooltip("Bottom clothing layer - pants, skirts (sorting order 2).")]
        public SpriteRenderer BottomRenderer;

        [Tooltip("Top clothing layer - shirts, jackets (sorting order 3).")]
        public SpriteRenderer TopRenderer;

        [Tooltip("Hair behind the head for depth (sorting order 4).")]
        public SpriteRenderer HairBackRenderer;

        [Tooltip("Head and face base layer (sorting order 5).")]
        public SpriteRenderer HeadRenderer;

        [Tooltip("Hair bangs / front layer (sorting order 6).")]
        public SpriteRenderer HairFrontRenderer;

        [Tooltip("Primary accessory layer - hats, glasses (sorting order 7).")]
        public SpriteRenderer Accessory1Renderer;

        [Tooltip("Secondary accessory layer - bags, wings (sorting order 8).")]
        public SpriteRenderer Accessory2Renderer;

        // =====================================================================
        // ANIMATION
        // =====================================================================
        [Header("Animation")]
        [Tooltip("Animator controlling bone-based skeletal animations.")]
        public Animator Animator;

        [Tooltip("Sprite Library Asset containing categorized sprites.")]
        public SpriteLibrary SpriteLibrary;

        [Tooltip("Optional dedicated animation controller for parameter management.")]
        public AvatarAnimationController AnimationController;

        [Tooltip("Optional emote player component.")]
        public EmotePlayer EmotePlayer;

        // =====================================================================
        // MOVEMENT
        // =====================================================================
        [Header("Movement")]
        [Tooltip("Movement speed in units per second.")]
        public float MoveSpeed = 5f;

        [Tooltip("How quickly animation blend values catch up to input.")]
        public float AnimationBlendSpeed = 8f;

        [Tooltip("If true, movement uses Rigidbody2D physics." +
                 " If false, uses direct transform translation.")]
        public bool UsePhysicsMovement = true;

        // =====================================================================
        // COLOR CUSTOMIZATION
        // =====================================================================
        [Header("Color Customization")]
        [Tooltip("Optional color tinting component for hair/skin/clothing.")]
        public ColorCustomization ColorCustomizer;

        // =====================================================================
        // EVENTS
        // =====================================================================
        /// <summary>Invoked whenever any outfit part changes.</summary>
        public event Action<string, string> OnPartChanged;

        /// <summary>Invoked when a full outfit is applied.</summary>
        public event Action<OutfitData> OnOutfitApplied;

        /// <summary>Invoked when the avatar's facing direction changes.</summary>
        public event Action<bool> OnFacingDirectionChanged;

        // =====================================================================
        // PRIVATE STATE
        // =====================================================================
        private readonly Dictionary<string, string> _currentParts = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, SpriteResolver> _resolvers = new Dictionary<string, SpriteResolver>(StringComparer.OrdinalIgnoreCase);
        private Rigidbody2D _rigidbody;
        private Vector2 _movementInput;
        private bool _isMoving;
        private bool _isFacingRight = true;
        private float _currentMoveX;
        private float _currentMoveY;
        private bool _initialized;

        // Cached Animator property hashes
        private static readonly int IsMovingHash = Animator.StringToHash("IsMoving");
        private static readonly int MoveXHash = Animator.StringToHash("MoveX");
        private static readonly int MoveYHash = Animator.StringToHash("MoveY");
        private static readonly int EmoteTriggerHash = Animator.StringToHash("PlayEmote");
        private static readonly int EmoteIdHash = Animator.StringToHash("EmoteId");

        // =====================================================================
        // CONSTANTS
        // =====================================================================
        private const string DEFAULT_BODY = "default";
        private const string NONE_VALUE = "none";

        // Sorting order constants for each layer
        private const int SORT_BODY = 0;
        private const int SORT_SHOES = 1;
        private const int SORT_BOTTOM = 2;
        private const int SORT_TOP = 3;
        private const int SORT_HAIR_BACK = 4;
        private const int SORT_HEAD = 5;
        private const int SORT_HAIR_FRONT = 6;
        private const int SORT_ACCESSORY1 = 7;
        private const int SORT_ACCESSORY2 = 8;

        // =====================================================================
        // LIFECYCLE
        // =====================================================================
        private void Awake()
        {
            CacheComponents();
        }

        private void Start()
        {
            if (!_initialized)
                Initialize();
        }

        private void Update()
        {
            if (!_initialized) return;

            UpdateAnimationParameters();
        }

        private void FixedUpdate()
        {
            if (!_initialized) return;

            ApplyMovement();
        }

        private void OnEnable()
        {
            UpdateSortingOrder();
        }

        // =====================================================================
        // INITIALIZATION
        // =====================================================================
        /// <summary>
        /// Caches required component references. Called automatically in Awake.
        /// </summary>
        private void CacheComponents()
        {
            if (_rigidbody == null)
                _rigidbody = GetComponent<Rigidbody2D>();

            if (Animator == null)
                Animator = GetComponent<Animator>();

            if (SpriteLibrary == null)
                SpriteLibrary = GetComponent<SpriteLibrary>();

            if (AnimationController == null)
                AnimationController = GetComponent<AvatarAnimationController>();

            if (EmotePlayer == null)
                EmotePlayer = GetComponent<EmotePlayer>();
        }

        /// <summary>
        /// Initializes the avatar system: discovers SpriteResolvers from child objects,
        /// validates renderers, sets default sorting orders, and applies initial default sprites.
        /// Call this after instantiating an avatar prefab at runtime.
        /// </summary>
        public void Initialize()
        {
            CacheComponents();
            DiscoverResolvers();
            ValidateRenderers();
            UpdateSortingOrder();

            // Apply default outfit if nothing loaded
            if (_currentParts.Count == 0)
            {
                SetDefaultParts();
            }

            _initialized = true;
            Debug.Log($"[AvatarController] Initialized '{gameObject.name}' with {_resolvers.Count} resolvers.");
        }

        /// <summary>
        /// Auto-discovers SpriteResolver components on child objects and maps them
        /// by the resolver's category (or the GameObject name as fallback).
        /// </summary>
        private void DiscoverResolvers()
        {
            _resolvers.Clear();

            SpriteResolver[] foundResolvers = GetComponentsInChildren<SpriteResolver>(true);
            foreach (var resolver in foundResolvers)
            {
                if (resolver == null) continue;

                string category = resolver.GetCategory();
                if (string.IsNullOrWhiteSpace(category))
                {
                    // Fallback to GameObject name if category not set
                    category = resolver.gameObject.name.ToLowerInvariant().Replace(" ", "");
                }

                if (!_resolvers.ContainsKey(category))
                {
                    _resolvers[category] = resolver;
                }
                else
                {
                    Debug.LogWarning($"[AvatarController] Duplicate resolver category '{category}' on {resolver.gameObject.name}. Skipping.");
                }
            }
        }

        /// <summary>
        /// Validates that all required SpriteRenderers are assigned,
        /// attempting to auto-find them from child objects if missing.
        /// </summary>
        private void ValidateRenderers()
        {
            BodyRenderer ??= FindRenderer("body", "Body");
            ShoesRenderer ??= FindRenderer("shoes", "Shoes");
            BottomRenderer ??= FindRenderer("bottom", "Bottom", "Pants", "Skirt");
            TopRenderer ??= FindRenderer("top", "Top", "Shirt", "Jacket");
            HairBackRenderer ??= FindRenderer("hairback", "HairBack", "Hair_Back");
            HeadRenderer ??= FindRenderer("head", "Head", "Face");
            HairFrontRenderer ??= FindRenderer("hairfront", "HairFront", "Hair_Front");
            Accessory1Renderer ??= FindRenderer("accessory1", "Accessory1", "Accessory_1");
            Accessory2Renderer ??= FindRenderer("accessory2", "Accessory2", "Accessory_2");
        }

        /// <summary>
        /// Attempts to find a SpriteRenderer on a child object matching any of the given names.
        /// </summary>
        private SpriteRenderer FindRenderer(string category, params string[] possibleNames)
        {
            foreach (Transform child in transform)
            {
                string childName = child.gameObject.name;
                foreach (var name in possibleNames)
                {
                    if (childName.Equals(name, StringComparison.OrdinalIgnoreCase))
                    {
                        if (child.TryGetComponent(out SpriteRenderer renderer))
                        {
                            return renderer;
                        }
                    }
                }
            }

            Debug.LogWarning($"[AvatarController] Could not find SpriteRenderer for category '{category}'." +
                             " Please assign it in the Inspector.");
            return null;
        }

        /// <summary>
        /// Sets the default body parts when no saved outfit exists.
        /// </summary>
        private void SetDefaultParts()
        {
            _currentParts["body"] = DEFAULT_BODY;
            _currentParts["hair"] = DEFAULT_BODY;
            _currentParts["face"] = DEFAULT_BODY;
            _currentParts["top"] = NONE_VALUE;
            _currentParts["bottom"] = NONE_VALUE;
            _currentParts["shoes"] = DEFAULT_BODY;
            _currentParts["accessory1"] = NONE_VALUE;
            _currentParts["accessory2"] = NONE_VALUE;

            ApplyCurrentPartsToResolvers();
        }

        // =====================================================================
        // OUTFIT APPLICATION
        // =====================================================================
        /// <summary>
        /// Applies a complete outfit from an <see cref="OutfitData"/> ScriptableObject.
        /// Updates all body parts and triggers visual refresh.
        /// </summary>
        /// <param name="outfit">The outfit preset to apply.</param>
        public void ApplyOutfit(OutfitData outfit)
        {
            if (outfit == null)
            {
                Debug.LogWarning("[AvatarController] Cannot apply null outfit.");
                return;
            }

            Dictionary<string, string> outfitDict = outfit.ToDictionary();
            LoadOutfit(outfitDict);

            OnOutfitApplied?.Invoke(outfit);
            Debug.Log($"[AvatarController] Applied outfit '{outfit.OutfitName}' to '{gameObject.name}'.");
        }

        // =====================================================================
        // PART SWAPPING
        // =====================================================================
        /// <summary>
        /// Swaps a single avatar part at runtime using the SpriteResolver system.
        /// The category must match a Sprite Library category and a resolver must exist.
        /// </summary>
        /// <param name="category">Sprite Library category (body, hair, top, bottom, shoes, face, accessory1, accessory2).</param>
        /// <param name="label">Sprite label within the category. Use "none" to hide the layer.</param>
        public void SwapPart(string category, string label)
        {
            if (string.IsNullOrWhiteSpace(category))
            {
                Debug.LogWarning("[AvatarController] Cannot swap part with null or empty category.");
                return;
            }

            string normalizedCategory = category.ToLowerInvariant().Trim();
            string normalizedLabel = string.IsNullOrWhiteSpace(label) ? NONE_VALUE : label.ToLowerInvariant().Trim();

            // Store the change
            _currentParts[normalizedCategory] = normalizedLabel;

            // Apply to resolver
            ApplyPartToResolver(normalizedCategory, normalizedLabel);

            // Hide layer if "none"
            UpdateLayerVisibility(normalizedCategory, normalizedLabel);

            OnPartChanged?.Invoke(normalizedCategory, normalizedLabel);
        }

        /// <summary>
        /// Applies the current stored parts to all discovered resolvers.
        /// Call after initialization or when restoring a saved outfit.
        /// </summary>
        private void ApplyCurrentPartsToResolvers()
        {
            foreach (var kvp in _currentParts)
            {
                ApplyPartToResolver(kvp.Key, kvp.Value);
                UpdateLayerVisibility(kvp.Key, kvp.Value);
            }
        }

        /// <summary>
        /// Applies a single part to its matching SpriteResolver.
        /// </summary>
        private void ApplyPartToResolver(string category, string label)
        {
            SpriteResolver resolver = GetResolver(category);
            if (resolver == null)
            {
                Debug.LogWarning($"[AvatarController] No SpriteResolver found for category '{category}'.");
                return;
            }

            // Check if the label exists in the sprite library
            if (SpriteLibrary != null)
            {
                Sprite sprite = SpriteLibrary.GetSprite(category, label);
                if (sprite == null && label != NONE_VALUE)
                {
                    Debug.LogWarning($"[AvatarController] Sprite '{label}' not found in category '{category}' of SpriteLibrary.");
                    return;
                }
            }

            resolver.SetCategoryAndLabel(category, label);
        }

        /// <summary>
        /// Gets the SpriteResolver for a given category, or null if not found.
        /// </summary>
        /// <param name="category">Category name to look up.</param>
        private SpriteResolver GetResolver(string category)
        {
            if (string.IsNullOrWhiteSpace(category))
                return null;

            string key = category.ToLowerInvariant().Trim();
            _resolvers.TryGetValue(key, out SpriteResolver resolver);
            return resolver;
        }

        // =====================================================================
        // LAYER VISIBILITY
        // =====================================================================
        /// <summary>
        /// Toggles renderer visibility based on whether the part is "none".
        /// </summary>
        private void UpdateLayerVisibility(string category, string label)
        {
            bool visible = !string.Equals(label, NONE_VALUE, StringComparison.OrdinalIgnoreCase);
            SpriteRenderer renderer = GetRendererForCategory(category);

            if (renderer != null)
            {
                renderer.enabled = visible;
            }
        }

        /// <summary>
        /// Returns the SpriteRenderer responsible for rendering the given category.
        /// </summary>
        private SpriteRenderer GetRendererForCategory(string category)
        {
            return category?.ToLowerInvariant() switch
            {
                "body" => BodyRenderer,
                "shoes" => ShoesRenderer,
                "bottom" => BottomRenderer,
                "top" => TopRenderer,
                "hairback" or "hair_back" => HairBackRenderer,
                "head" or "face" => HeadRenderer,
                "hairfront" or "hair_front" => HairFrontRenderer,
                "accessory1" or "accessory_1" => Accessory1Renderer,
                "accessory2" or "accessory_2" => Accessory2Renderer,
                _ => null
            };
        }

        // =====================================================================
        // SORTING ORDER
        // =====================================================================
        /// <summary>
        /// Ensures all renderers have the correct sorting order for proper
        /// visual layering (body on bottom, accessories on top).
        /// </summary>
        private void UpdateSortingOrder()
        {
            SetSortingOrder(BodyRenderer, SORT_BODY);
            SetSortingOrder(ShoesRenderer, SORT_SHOES);
            SetSortingOrder(BottomRenderer, SORT_BOTTOM);
            SetSortingOrder(TopRenderer, SORT_TOP);
            SetSortingOrder(HairBackRenderer, SORT_HAIR_BACK);
            SetSortingOrder(HeadRenderer, SORT_HEAD);
            SetSortingOrder(HairFrontRenderer, SORT_HAIR_FRONT);
            SetSortingOrder(Accessory1Renderer, SORT_ACCESSORY1);
            SetSortingOrder(Accessory2Renderer, SORT_ACCESSORY2);
        }

        /// <summary>
        /// Sets the sorting order on a SpriteRenderer if it exists.
        /// </summary>
        private void SetSortingOrder(SpriteRenderer renderer, int order)
        {
            if (renderer != null)
                renderer.sortingOrder = order;
        }

        // =====================================================================
        // MOVEMENT
        // =====================================================================
        /// <summary>
        /// Updates the avatar's movement direction. Call from your input system
        /// every frame with the normalized input vector.
        /// </summary>
        /// <param name="direction">Normalized movement direction vector.</param>
        public void SetMovement(Vector2 direction)
        {
            _movementInput = direction;
            _isMoving = direction.sqrMagnitude > 0.001f;

            // Auto-flip based on horizontal movement
            if (Mathf.Abs(direction.x) > 0.01f)
            {
                SetFacingDirection(direction.x > 0);
            }
        }

        /// <summary>
        /// Directly sets the avatar's facing direction.
        /// </summary>
        /// <param name="faceRight">True to face right, false to face left.</param>
        public void SetFacingDirection(bool faceRight)
        {
            if (_isFacingRight == faceRight)
                return;

            _isFacingRight = faceRight;
            FlipSprite(faceRight);
            OnFacingDirectionChanged?.Invoke(faceRight);
        }

        /// <summary>
        /// Applies the movement input to either Rigidbody2D (physics)
        /// or direct transform translation.
        /// </summary>
        private void ApplyMovement()
        {
            if (!_isMoving || (EmotePlayer != null && EmotePlayer.IsPlayingEmote &&
                EmotePlayer.CurrentEmote != null && !EmotePlayer.CurrentEmote.CanMoveWhilePlaying))
            {
                if (UsePhysicsMovement && _rigidbody != null)
                {
                    _rigidbody.linearVelocity = new Vector2(0f, _rigidbody.linearVelocity.y);
                }
                return;
            }

            Vector2 velocity = _movementInput * MoveSpeed;

            if (UsePhysicsMovement && _rigidbody != null)
            {
                _rigidbody.linearVelocity = new Vector2(velocity.x, velocity.y);
            }
            else
            {
                transform.Translate(velocity * Time.fixedDeltaTime);
            }
        }

        /// <summary>
        /// Flips the entire avatar horizontally by inverting the local scale's X axis.
        /// </summary>
        /// <param name="faceRight">True to face right (scale x = 1), false to face left (scale x = -1).</param>
        private void FlipSprite(bool faceRight)
        {
            Vector3 scale = transform.localScale;
            scale.x = faceRight ? Mathf.Abs(scale.x) : -Mathf.Abs(scale.x);
            transform.localScale = scale;
        }

        // =====================================================================
        // ANIMATION
        // =====================================================================
        /// <summary>
        /// Smoothly updates Animator parameters based on current movement state.
        /// Uses Mathf.Lerp for fluid blend tree transitions.
        /// </summary>
        private void UpdateAnimationParameters()
        {
            if (Animator == null || Animator.runtimeAnimatorController == null)
                return;

            // If we have a dedicated animation controller, delegate to it
            if (AnimationController != null)
            {
                AnimationController.SetMovement(_movementInput.x, _movementInput.y, _isMoving);
                return;
            }

            // Fallback: set parameters directly
            float lerpFactor = Time.deltaTime * AnimationBlendSpeed;
            _currentMoveX = Mathf.Lerp(_currentMoveX, _movementInput.x, lerpFactor);
            _currentMoveY = Mathf.Lerp(_currentMoveY, _movementInput.y, lerpFactor);

            Animator.SetFloat(MoveXHash, _currentMoveX);
            Animator.SetFloat(MoveYHash, _currentMoveY);
            Animator.SetBool(IsMovingHash, _isMoving);
        }

        // =====================================================================
        // EMOTES
        // =====================================================================
        /// <summary>
        /// Plays an emote animation by name. Looks up the emote in the Animator
        /// using the emote name as an EmoteId parameter.
        /// </summary>
        /// <param name="emoteName">Identifier for the emote animation.</param>
        public void PlayEmote(string emoteName)
        {
            if (string.IsNullOrWhiteSpace(emoteName))
            {
                Debug.LogWarning("[AvatarController] Cannot play emote with empty name.");
                return;
            }

            // Delegate to EmotePlayer if available
            if (EmotePlayer != null)
            {
                var emoteData = Resources.Load<EmoteData>($"Emotes/{emoteName}");
                if (emoteData != null)
                {
                    EmotePlayer.PlayEmote(emoteData);
                    return;
                }
            }

            // Fallback: direct animator trigger
            if (Animator != null && Animator.runtimeAnimatorController != null)
            {
                int emoteId = Animator.StringToHash(emoteName);
                Animator.SetInteger(EmoteIdHash, emoteId);
                Animator.SetTrigger(EmoteTriggerHash);
            }
        }

        /// <summary>
        /// Stops any currently playing emote and returns to idle/movement.
        /// </summary>
        public void StopEmote()
        {
            if (EmotePlayer != null)
            {
                EmotePlayer.StopEmote();
                return;
            }

            if (Animator != null)
            {
                Animator.ResetTrigger(EmoteTriggerHash);
            }
        }

        // =====================================================================
        // SERIALIZATION (SAVE / LOAD)
        // =====================================================================
        /// <summary>
        /// Returns a serialized dictionary of the current outfit state.
        /// Suitable for JSON serialization and cloud save.
        /// </summary>
        /// <returns>Dictionary mapping category name to sprite label.</returns>
        public Dictionary<string, string> GetCurrentOutfit()
        {
            return new Dictionary<string, string>(_currentParts, StringComparer.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Deserializes and applies an outfit from a dictionary.
        /// Used for loading saved outfits from JSON / PlayerPrefs / cloud.
        /// </summary>
        /// <param name="outfitData">Dictionary of category name -> sprite label.</param>
        public void LoadOutfit(Dictionary<string, string> outfitData)
        {
            if (outfitData == null)
            {
                Debug.LogWarning("[AvatarController] Cannot load null outfit data.");
                return;
            }

            // Apply each part
            foreach (var kvp in outfitData)
            {
                SwapPart(kvp.Key, kvp.Value);
            }

            Debug.Log($"[AvatarController] Loaded outfit with {outfitData.Count} parts on '{gameObject.name}'.");
        }

        /// <summary>
        /// Saves the current outfit to a <see cref="OutfitData"/> ScriptableObject.
        /// </summary>
        /// <param name="outfitName">Name for the saved outfit preset.</param>
        /// <returns>A new OutfitData instance with current state.</returns>
        public OutfitData SaveToOutfitAsset(string outfitName)
        {
            var outfit = ScriptableObject.CreateInstance<OutfitData>();
            outfit.OutfitName = outfitName;
            outfit.ApplyFromDictionary(GetCurrentOutfit());
            return outfit;
        }

        // =====================================================================
        // COLOR CUSTOMIZATION
        // =====================================================================
        /// <summary>
        /// Applies a hair color tint via the ColorCustomizer if available.
        /// </summary>
        /// <param name="color">Target hair color.</param>
        public void SetHairColor(Color color)
        {
            if (ColorCustomizer != null)
                ColorCustomizer.SetHairColor(color);
        }

        /// <summary>
        /// Applies a skin tone tint via the ColorCustomizer if available.
        /// </summary>
        /// <param name="color">Target skin tone.</param>
        public void SetSkinTone(Color color)
        {
            if (ColorCustomizer != null)
                ColorCustomizer.SetSkinTone(color);
        }

        /// <summary>
        /// Applies an eye color tint via the ColorCustomizer if available.
        /// </summary>
        /// <param name="color">Target eye color.</param>
        public void SetEyeColor(Color color)
        {
            if (ColorCustomizer != null)
                ColorCustomizer.SetEyeColor(color);
        }

        /// <summary>
        /// Applies a clothing tint for a specific category via the ColorCustomizer.
        /// </summary>
        /// <param name="category">Category to tint (top, bottom, shoes, accessory1, accessory2).</param>
        /// <param name="color">Target tint color.</param>
        public void SetClothingTint(string category, Color color)
        {
            if (ColorCustomizer != null)
                ColorCustomizer.SetClothingTint(category, color);
        }

        // =====================================================================
        // ACCESSORS
        // =====================================================================
        /// <summary>
        /// Returns true if the avatar is currently moving.
        /// </summary>
        public bool IsMoving => _isMoving;

        /// <summary>
        /// Returns true if the avatar is facing right.
        /// </summary>
        public bool IsFacingRight => _isFacingRight;

        /// <summary>
        /// Returns the current movement input vector.
        /// </summary>
        public Vector2 MovementInput => _movementInput;

        /// <summary>
        /// Returns true if the avatar system has completed initialization.
        /// </summary>
        public bool IsInitialized => _initialized;

        /// <summary>
        /// Returns the cached Rigidbody2D component.
        /// </summary>
        public Rigidbody2D Rigidbody => _rigidbody;

        // =====================================================================
        // DEBUG
        // =====================================================================
        /// <summary>
        /// Logs the current outfit state to the console for debugging.
        /// </summary>
        [ContextMenu("Debug Log Current Outfit")]
        public void DebugLogOutfit()
        {
            Debug.Log($"[AvatarController] Current outfit on '{gameObject.name}':");
            foreach (var kvp in _currentParts)
            {
                Debug.Log($"  {kvp.Key}: {kvp.Value}");
            }
        }

        /// <summary>
        /// Forces re-initialization of resolvers and renderers.
        /// Useful after modifying the avatar hierarchy at runtime.
        /// </summary>
        [ContextMenu("Force Reinitialize")]
        public void ForceReinitialize()
        {
            _initialized = false;
            _resolvers.Clear();
            Initialize();
        }
    }
}
