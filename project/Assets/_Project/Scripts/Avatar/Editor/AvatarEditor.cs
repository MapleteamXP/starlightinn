using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace KawaiiCoolIsland.Avatar.Editor
{
    /// <summary>
    /// Serializable snapshot of an avatar's configuration for undo/redo support.
    /// </summary>
    [System.Serializable]
    public class AvatarEditState
    {
        /// <summary>
        /// Map of layer names to equipped part IDs.
        /// </summary>
        public Dictionary<string, string> Parts = new();

        /// <summary>
        /// Map of color target names to applied colors.
        /// </summary>
        public Dictionary<string, Color> Colors = new();

        /// <summary>
        /// Unix timestamp when this state was captured.
        /// </summary>
        public long Timestamp;
    }

    /// <summary>
    /// Enhanced avatar editing panel with undo/redo, live preview, deep customization,
    /// item browsing with search/filter/sort, and outfit save/load/share functionality.
    /// </summary>
    public class AvatarEditor : UIPanel
    {
        #region Header Fields

        [Header("Category Tabs")]
        [SerializeField, Tooltip("Toggle group for category selection.")] public ToggleGroup CategoryTabs;
        [SerializeField] public Toggle BodyTab;
        [SerializeField] public Toggle FaceTab;
        [SerializeField] public Toggle HairTab;
        [SerializeField] public Toggle TopsTab;
        [SerializeField] public Toggle BottomsTab;
        [SerializeField] public Toggle ShoesTab;
        [SerializeField] public Toggle AccessoriesTab;
        [SerializeField] public Toggle ColorsTab;

        [Header("Item Browser")]
        [SerializeField, Tooltip("Container for grid layout of item cells.")] public Transform ItemGridContainer;
        [SerializeField, Tooltip("Prefab instantiated for each item in the browser.")] public GameObject ItemCellPrefab;
        [SerializeField, Tooltip("Search input field for filtering items by name.")] public TMP_InputField SearchInput;
        [SerializeField, Tooltip("Dropdown for applying category or rarity filters.")] public TMP_Dropdown FilterDropdown;
        [SerializeField, Tooltip("Dropdown for changing item sort order.")] public TMP_Dropdown SortDropdown;

        [Header("Preview")]
        [SerializeField, Tooltip("Live avatar preview component.")] public AvatarPreview Preview;
        [SerializeField, Tooltip("Button to rotate the preview left.")] public Button RotateLeftButton;
        [SerializeField, Tooltip("Button to rotate the preview right.")] public Button RotateRightButton;
        [SerializeField, Tooltip("Button to play a random emote on the preview.")] public Button PlayEmoteButton;
        [SerializeField, Tooltip("Button to randomize the entire avatar.")] public Button RandomizeButton;
        [SerializeField, Tooltip("Button to reset to the default avatar state.")] public Button ResetButton;

        [Header("Actions")]
        [SerializeField, Tooltip("Button to save the current outfit as a preset.")] public Button SaveOutfitButton;
        [SerializeField, Tooltip("Button to open the outfit preset browser.")] public Button LoadOutfitButton;
        [SerializeField, Tooltip("Button to share the current outfit with other players.")] public Button ShareOutfitButton;
        [SerializeField, Tooltip("Input field for naming the saved outfit.")] public TMP_Text OutfitNameInput;

        [Header("Undo/Redo")]
        [SerializeField, Tooltip("Button to undo the last change.")] public Button UndoButton;
        [SerializeField, Tooltip("Button to redo a previously undone change.")] public Button RedoButton;
        [SerializeField, Tooltip("Maximum number of undo states to retain."), Min(1)] public int MaxUndoStack = 50;

        #endregion

        #region Private Fields

        private AvatarEditState _currentState;
        private Stack<AvatarEditState> _undoStack = new();
        private Stack<AvatarEditState> _redoStack = new();
        private string _currentCategory = "Body";
        private AvatarController _avatarController;
        private List<AvatarPartData> _availableParts = new();
        private Dictionary<string, GameObject> _itemCells = new();
        private BodyCustomizer _bodyCustomizer;
        private FaceCustomizer _faceCustomizer;
        private ColorCustomization _colorCustomization;
        private float _previewRotation;

        #endregion

        #region Properties

        /// <summary>
        /// Returns true if there are changes available to undo.
        /// </summary>
        public bool CanUndo => _undoStack.Count > 0;

        /// <summary>
        /// Returns true if there are changes available to redo.
        /// </summary>
        public bool CanRedo => _redoStack.Count > 0;

        #endregion

        #region Events

        /// <summary>
        /// Invoked when an outfit is successfully saved.
        /// </summary>
        public event Action OnOutfitSaved;

        /// <summary>
        /// Invoked when the editor is closed.
        /// </summary>
        public event Action OnEditorClosed;

        #endregion

        #region Unity Lifecycle

        protected virtual void Awake()
        {
            _bodyCustomizer = GetComponentInChildren<BodyCustomizer>(true);
            _faceCustomizer = GetComponentInChildren<FaceCustomizer>(true);
            _colorCustomization = GetComponentInChildren<ColorCustomization>(true);

            if (Preview != null)
                _avatarController = Preview.GetComponent<AvatarController>();

            BindUIEvents();
            BuildCategoryTabs();
        }

        protected virtual void OnEnable()
        {
            EventBus.Subscribe<InventoryUpdatedEvent>(OnInventoryUpdated);
            EventBus.Subscribe<ColorChangedEvent>(OnColorChangedEvent);
        }

        protected virtual void OnDisable()
        {
            EventBus.Unsubscribe<InventoryUpdatedEvent>(OnInventoryUpdated);
            EventBus.Unsubscribe<ColorChangedEvent>(OnColorChangedEvent);
        }

        #endregion

        #region UIPanel Overrides

        /// <summary>
        /// Called when the panel is shown. Initializes the editor state and refreshes the browser.
        /// </summary>
        public override void OnPanelShow()
        {
            base.OnPanelShow();
            _undoStack.Clear();
            _redoStack.Clear();
            _currentState = CaptureState();
            ShowCategory("Body");
            RefreshPreview();
            UpdateUndoRedoUI();
        }

        /// <summary>
        /// Called when the panel is hidden. Saves current state and cleans up.
        /// </summary>
        public override void OnPanelHide()
        {
            base.OnPanelHide();
            SaveCurrentStateToPlayer();
            OnEditorClosed?.Invoke();
        }

        #endregion

        #region Public API

        /// <summary>
        /// Switches the editor to the specified category and refreshes the item browser.
        /// </summary>
        /// <param name="category">Category name: Body, Face, Hair, Tops, Bottoms, Shoes, Accessories, Colors.</param>
        public void ShowCategory(string category)
        {
            _currentCategory = category;
            PushUndoState();
            RefreshItemBrowser();
            UpdateTabVisuals();
        }

        /// <summary>
        /// Selects and equips an item by its unique identifier.
        /// </summary>
        /// <param name="itemId">The unique ID of the AvatarPartData to equip.</param>
        public void SelectItem(string itemId)
        {
            var part = FindPartById(itemId);
            if (part == null) return;

            PushUndoState();

            if (_avatarController != null)
                _avatarController.EquipPart(part);

            _currentState.Parts[part.LayerName] = itemId;
            EventBus.Publish(new AvatarPartEquippedEvent { PartId = itemId, LayerName = part.LayerName });

            RefreshPreview();
            UpdateItemSelectionVisuals(itemId);
        }

        /// <summary>
        /// Called when a color picker value changes. Applies the color to the appropriate target.
        /// </summary>
        /// <param name="color">The selected color.</param>
        public void OnColorChanged(Color color)
        {
            PushUndoState();

            switch (_currentCategory)
            {
                case "Hair":
                    _currentState.Colors["Hair"] = color;
                    _colorCustomization?.SetHairColor(color);
                    break;
                case "Body":
                    _currentState.Colors["Skin"] = color;
                    _bodyCustomizer?.SetSkinTone(color);
                    break;
                case "Face":
                    _currentState.Colors["Eyes"] = color;
                    _faceCustomizer?.SetEyeColor(color);
                    break;
                case "Colors":
                    _currentState.Colors["Custom"] = color;
                    _colorCustomization?.ApplyCustomColor(color);
                    break;
            }

            RefreshPreview();
        }

        /// <summary>
        /// Saves the current avatar configuration as a named outfit preset.
        /// </summary>
        /// <param name="name">Display name for the outfit preset.</param>
        public void SaveCurrentOutfit(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) name = "Custom Outfit";
            if (_avatarController == null) return;

            var outfit = _avatarController.BuildCurrentOutfit();
            outfit.OutfitName = name;

            if (OutfitPresetManager.Instance != null)
                OutfitPresetManager.Instance.SavePreset(name, outfit);

            EventBus.Publish(new OutfitSavedEvent { OutfitName = name });
            OnOutfitSaved?.Invoke();
        }

        /// <summary>
        /// Loads a saved outfit and applies it to the preview.
        /// </summary>
        /// <param name="outfit">The outfit data to apply.</param>
        public void LoadOutfit(OutfitData outfit)
        {
            if (outfit == null) return;

            PushUndoState();
            _avatarController?.ApplyOutfit(outfit);

            if (outfit.BodyConfig != null && _bodyCustomizer != null)
                _bodyCustomizer.LoadConfiguration(outfit.BodyConfig);

            if (outfit.FaceConfig != null && _faceCustomizer != null)
                _faceCustomizer.LoadConfiguration(outfit.FaceConfig);

            RefreshPreview();
            RefreshItemBrowser();
        }

        /// <summary>
        /// Undoes the last change, restoring the previous avatar state.
        /// </summary>
        public void Undo()
        {
            if (!CanUndo) return;

            _redoStack.Push(CaptureState());
            var state = _undoStack.Pop();
            RestoreState(state);
            UpdateUndoRedoUI();
        }

        /// <summary>
        /// Redoes a previously undone change.
        /// </summary>
        public void Redo()
        {
            if (!CanRedo) return;

            _undoStack.Push(CaptureState());
            var state = _redoStack.Pop();
            RestoreState(state);
            UpdateUndoRedoUI();
        }

        /// <summary>
        /// Randomizes all customizable aspects of the avatar.
        /// </summary>
        public void Randomize()
        {
            PushUndoState();
            Preview?.Randomize();
            _bodyCustomizer?.Randomize();
            _faceCustomizer?.Randomize();
            RefreshPreview();
            RefreshItemBrowser();
        }

        /// <summary>
        /// Resets the avatar to its default configuration.
        /// </summary>
        public void ResetToDefault()
        {
            PushUndoState();
            Preview?.ResetToDefault();
            _bodyCustomizer?.LoadConfiguration(new BodyConfiguration());
            _faceCustomizer?.LoadConfiguration(new FaceConfiguration());
            _currentState = CaptureState();
            RefreshPreview();
            RefreshItemBrowser();
        }

        #endregion

        #region Undo/Redo Stack

        private void PushUndoState()
        {
            _undoStack.Push(CaptureState());
            _redoStack.Clear();

            while (_undoStack.Count > MaxUndoStack)
            {
                var temp = new Stack<AvatarEditState>();
                var discard = _undoStack.Pop();
                while (_undoStack.Count > 0) temp.Push(_undoStack.Pop());
                temp.Pop();
                while (temp.Count > 0) _undoStack.Push(temp.Pop());
            }

            UpdateUndoRedoUI();
        }

        private AvatarEditState CaptureState()
        {
            var state = new AvatarEditState
            {
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
            };

            if (_avatarController != null)
            {
                foreach (var layer in _avatarController.GetLayerNames())
                {
                    var part = _avatarController.GetEquippedPart(layer);
                    if (part != null)
                        state.Parts[layer] = part.PartId;
                }
            }

            if (_bodyCustomizer != null)
            {
                var body = _bodyCustomizer.GetConfiguration();
                state.Colors["Skin"] = body.SkinTone;
            }

            if (_faceCustomizer != null)
            {
                var face = _faceCustomizer.GetConfiguration();
                state.Colors["Eyes"] = face.EyeColor;
                state.Colors["Eyebrows"] = face.EyebrowColor;
                state.Parts["EyeType"] = face.EyeType;
                state.Parts["EyebrowType"] = face.EyebrowType;
                state.Parts["MouthType"] = face.MouthType;
            }

            return state;
        }

        private void RestoreState(AvatarEditState state)
        {
            if (state == null) return;

            foreach (var kvp in state.Parts)
            {
                var part = FindPartById(kvp.Value);
                if (part != null && _avatarController != null)
                    _avatarController.EquipPart(part);
            }

            foreach (var kvp in state.Colors)
            {
                switch (kvp.Key)
                {
                    case "Skin": _bodyCustomizer?.SetSkinTone(kvp.Value); break;
                    case "Eyes": _faceCustomizer?.SetEyeColor(kvp.Value); break;
                    case "Eyebrows": _faceCustomizer?.SetEyebrowColor(kvp.Value); break;
                    case "Hair": _colorCustomization?.SetHairColor(kvp.Value); break;
                }
            }

            _currentState = state;
            RefreshPreview();
            RefreshItemBrowser();
        }

        private void UpdateUndoRedoUI()
        {
            if (UndoButton != null) UndoButton.interactable = CanUndo;
            if (RedoButton != null) RedoButton.interactable = CanRedo;
        }

        #endregion

        #region Item Browser

        private void RefreshItemBrowser()
        {
            ClearItemGrid();
            _availableParts = GetPartsForCategory(_currentCategory);
            ApplyBrowserFilters();
            PopulateItemGrid();
        }

        private void ClearItemGrid()
        {
            foreach (var cell in _itemCells.Values)
                if (cell != null) Destroy(cell);
            _itemCells.Clear();
        }

        private void PopulateItemGrid()
        {
            if (ItemGridContainer == null || ItemCellPrefab == null) return;

            foreach (var part in _availableParts)
            {
                var cell = Instantiate(ItemCellPrefab, ItemGridContainer);
                var cellScript = cell.GetComponent<AvatarItemCell>();
                if (cellScript != null)
                    cellScript.Setup(part, OnItemCellClicked, IsItemEquipped(part));

                _itemCells[part.PartId] = cell;
            }
        }

        private void ApplyBrowserFilters()
        {
            if (!string.IsNullOrWhiteSpace(SearchInput?.text))
            {
                var query = SearchInput.text.ToLowerInvariant();
                _availableParts.RemoveAll(p => !p.DisplayName.ToLowerInvariant().Contains(query));
            }

            if (FilterDropdown != null && FilterDropdown.value > 0)
            {
                // Apply rarity or category sub-filter
            }

            if (SortDropdown != null)
            {
                switch (SortDropdown.value)
                {
                    case 0: _availableParts.Sort((a, b) => string.Compare(a.DisplayName, b.DisplayName, StringComparison.Ordinal)); break;
                    case 1: _availableParts.Sort((a, b) => b.Rarity.CompareTo(a.Rarity)); break;
                    case 2: _availableParts.Sort((a, b) => a.OrderIndex.CompareTo(b.OrderIndex)); break;
                }
            }
        }

        private void OnItemCellClicked(AvatarPartData part)
        {
            SelectItem(part.PartId);
        }

        private bool IsItemEquipped(AvatarPartData part)
        {
            if (_avatarController == null) return false;
            var equipped = _avatarController.GetEquippedPart(part.LayerName);
            return equipped != null && equipped.PartId == part.PartId;
        }

        private void UpdateItemSelectionVisuals(string selectedId)
        {
            foreach (var kvp in _itemCells)
            {
                var cell = kvp.Value?.GetComponent<AvatarItemCell>();
                if (cell != null)
                    cell.SetSelected(kvp.Key == selectedId);
            }
        }

        private List<AvatarPartData> GetPartsForCategory(string category)
        {
            var result = new List<AvatarPartData>();
            string layerName = category switch
            {
                "Body" => "Body",
                "Face" => "Head",
                "Hair" => "HairFront",
                "Tops" => "Top",
                "Bottoms" => "Bottom",
                "Shoes" => "Shoes",
                "Accessories" => "Accessory1",
                _ => "Body"
            };

            if (InventoryManager.Instance != null)
            {
                var items = InventoryManager.Instance.GetOwnedParts(layerName);
                if (items != null) result.AddRange(items);
            }

            return result;
        }

        private AvatarPartData FindPartById(string partId)
        {
            if (InventoryManager.Instance != null)
                return InventoryManager.Instance.GetPartById(partId);
            return null;
        }

        #endregion

        #region Preview Management

        private void RefreshPreview()
        {
            if (Preview != null)
                Preview.RefreshRender();
        }

        private void RotatePreviewLeft()
        {
            _previewRotation -= 45f;
            if (Preview != null)
                Preview.SetRotation(_previewRotation);
        }

        private void RotatePreviewRight()
        {
            _previewRotation += 45f;
            if (Preview != null)
                Preview.SetRotation(_previewRotation);
        }

        private void PlayPreviewEmote()
        {
            if (Preview != null)
                Preview.PlayRandomEmote();
        }

        #endregion

        #region UI Bindings

        private void BindUIEvents()
        {
            if (RotateLeftButton != null)
                RotateLeftButton.onClick.AddListener(RotatePreviewLeft);

            if (RotateRightButton != null)
                RotateRightButton.onClick.AddListener(RotatePreviewRight);

            if (PlayEmoteButton != null)
                PlayEmoteButton.onClick.AddListener(PlayPreviewEmote);

            if (RandomizeButton != null)
                RandomizeButton.onClick.AddListener(Randomize);

            if (ResetButton != null)
                ResetButton.onClick.AddListener(ResetToDefault);

            if (SaveOutfitButton != null)
                SaveOutfitButton.onClick.AddListener(() => SaveCurrentOutfit(OutfitNameInput?.text ?? "Custom Outfit"));

            if (LoadOutfitButton != null)
                LoadOutfitButton.onClick.AddListener(OpenPresetBrowser);

            if (ShareOutfitButton != null)
                ShareOutfitButton.onClick.AddListener(ShareCurrentOutfit);

            if (UndoButton != null)
                UndoButton.onClick.AddListener(Undo);

            if (RedoButton != null)
                RedoButton.onClick.AddListener(Redo);

            if (SearchInput != null)
                SearchInput.onValueChanged.AddListener(_ => RefreshItemBrowser());

            if (FilterDropdown != null)
                FilterDropdown.onValueChanged.AddListener(_ => RefreshItemBrowser());

            if (SortDropdown != null)
                SortDropdown.onValueChanged.AddListener(_ => RefreshItemBrowser());
        }

        private void BuildCategoryTabs()
        {
            BindTab(BodyTab, "Body");
            BindTab(FaceTab, "Face");
            BindTab(HairTab, "Hair");
            BindTab(TopsTab, "Tops");
            BindTab(BottomsTab, "Bottoms");
            BindTab(ShoesTab, "Shoes");
            BindTab(AccessoriesTab, "Accessories");
            BindTab(ColorsTab, "Colors");
        }

        private void BindTab(Toggle toggle, string category)
        {
            if (toggle == null) return;
            toggle.onValueChanged.AddListener(isOn => { if (isOn) ShowCategory(category); });
        }

        private void UpdateTabVisuals()
        {
            if (BodyTab != null) BodyTab.isOn = _currentCategory == "Body";
            if (FaceTab != null) FaceTab.isOn = _currentCategory == "Face";
            if (HairTab != null) HairTab.isOn = _currentCategory == "Hair";
            if (TopsTab != null) TopsTab.isOn = _currentCategory == "Tops";
            if (BottomsTab != null) BottomsTab.isOn = _currentCategory == "Bottoms";
            if (ShoesTab != null) ShoesTab.isOn = _currentCategory == "Shoes";
            if (AccessoriesTab != null) AccessoriesTab.isOn = _currentCategory == "Accessories";
            if (ColorsTab != null) ColorsTab.isOn = _currentCategory == "Colors";
        }

        #endregion

        #region Outfit Actions

        private void OpenPresetBrowser()
        {
            EventBus.Publish(new OpenOutfitPresetBrowserEvent());
        }

        private void ShareCurrentOutfit()
        {
            if (_avatarController == null) return;
            var outfit = _avatarController.BuildCurrentOutfit();
            var json = JsonUtility.ToJson(outfit);
            EventBus.Publish(new ShareOutfitEvent { OutfitJson = json });
        }

        private void SaveCurrentStateToPlayer()
        {
            if (_avatarController == null) return;
            var outfit = _avatarController.BuildCurrentOutfit();
            SaveManager.Save(outfit, "player_current_outfit");
        }

        #endregion

        #region Event Handlers

        private void OnInventoryUpdated(InventoryUpdatedEvent evt)
        {
            RefreshItemBrowser();
        }

        private void OnColorChangedEvent(ColorChangedEvent evt)
        {
            OnColorChanged(evt.NewColor);
        }

        #endregion
    }

    #region Events

    /// <summary>
    /// Published when an outfit is saved.
    /// </summary>
    public struct OutfitSavedEvent
    {
        public string OutfitName;
    }

    /// <summary>
    /// Published to request opening the outfit preset browser.
    /// </summary>
    public struct OpenOutfitPresetBrowserEvent { }

    /// <summary>
    /// Published when an outfit is shared.
    /// </summary>
    public struct ShareOutfitEvent
    {
        public string OutfitJson;
    }

    /// <summary>
    /// Published when inventory contents change.
    /// </summary>
    public struct InventoryUpdatedEvent { }

    /// <summary>
    /// Published when a color picker value changes.
    /// </summary>
    public struct ColorChangedEvent
    {
        public string Target;
        public Color NewColor;
    }

    /// <summary>
    /// Published when an avatar part is equipped.
    /// </summary>
    public struct AvatarPartEquippedEvent
    {
        public string PartId;
        public string LayerName;
    }

    #endregion
}
