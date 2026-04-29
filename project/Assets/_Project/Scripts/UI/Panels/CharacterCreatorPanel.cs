using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using KawaiiCoolIsland.Core;
using KawaiiCoolIsland.Core.Events;

namespace KawaiiCoolIsland.UI
{
    #region Data Models

    /// <summary>
    /// Immutable data holder for a character customization option (hair style, eye type, etc.).
    /// </summary>
    [System.Serializable]
    public class CustomizationOption
    {
        /// <summary>Unique option identifier.</summary>
        public string OptionId;
        /// <summary>Display name of the option.</summary>
        public string DisplayName;
        /// <summary>Preview thumbnail URL or sprite path.</summary>
        public string ThumbnailUrl;
        /// <summary>Whether this option is locked (requires purchase/level).</summary>
        public bool IsLocked;
    }

    /// <summary>
    /// Simplified color picker placeholder for character skin tone, eye color, and hair color.
    /// </summary>
    public class ColorPicker : MonoBehaviour
    {
        /// <summary>Currently selected color.</summary>
        public Color SelectedColor = Color.white;
        /// <summary>Event fired when the selected color changes.</summary>
        public event Action<Color> OnColorChanged;

        /// <summary>Sets the selected color and fires the change event.</summary>
        public void SetColor(Color color)
        {
            SelectedColor = color;
            OnColorChanged?.Invoke(color);
        }
    }

    #endregion

    /// <summary>
    /// Character creation wizard panel with step-by-step flow for creating a new avatar.
    /// Steps include Name, Body, Face, Hair, Clothing, and Accessories.
    /// Provides live preview, randomization, and navigation controls.
    /// </summary>
    public class CharacterCreatorPanel : UIPanel
    {
        #region Inspector - Steps
        [Header("Steps")]
        [Tooltip("List of panel GameObjects for each creation step, in order.")]
        public List<GameObject> StepPanels = new();

        [Tooltip("Current step index (0-based).")]
        public int CurrentStep = 0;

        [Tooltip("Progress bar slider showing completion percentage.")]
        public Slider ProgressBar;

        [Tooltip("Text displaying the current step title.")]
        public TMP_Text StepTitleText;

        [Tooltip("Text displaying the current step description/instructions.")]
        public TMP_Text StepDescriptionText;
        #endregion

        #region Inspector - Navigation
        [Header("Navigation")]
        [Tooltip("Button to go back to the previous step.")]
        public Button BackButton;

        [Tooltip("Button to advance to the next step or finish.")]
        public Button NextButton;

        [Tooltip("Button to skip the current step (uses defaults).")]
        public Button SkipButton;

        [Tooltip("Button to randomize all customization choices.")]
        public Button RandomizeButton;
        #endregion

        #region Inspector - Preview
        [Header("Preview")]
        [Tooltip("RawImage displaying the character preview render texture.")]
        public RawImage PreviewImage;

        [Tooltip("Button to rotate the preview left.")]
        public Button RotateLeftButton;

        [Tooltip("Button to rotate the preview right.")]
        public Button RotateRightButton;

        [Tooltip("Button to play a random emote on the preview character.")]
        public Button PlayEmoteButton;
        #endregion

        #region Inspector - Name Step
        [Header("Name Step")]
        [Tooltip("Input field for the character name.")]
        public TMP_InputField NameInput;

        [Tooltip("Text showing name availability (available / taken).")]
        public TMP_Text NameAvailabilityText;

        [Tooltip("Button to check name availability against the server.")]
        public Button CheckNameButton;
        #endregion

        #region Inspector - Body Step
        [Header("Body Step")]
        [Tooltip("Slider controlling character height.")]
        public Slider HeightSlider;

        [Tooltip("Slider controlling character width/build.")]
        public Slider WidthSlider;

        [Tooltip("Color picker for skin tone.")]
        public ColorPicker SkinTonePicker;
        #endregion

        #region Inspector - Face Step
        [Header("Face Step")]
        [Tooltip("Grid container for eye type selection cells.")]
        public Transform EyeTypeGrid;

        [Tooltip("Grid container for mouth type selection cells.")]
        public Transform MouthTypeGrid;

        [Tooltip("Color picker for eye color.")]
        public ColorPicker EyeColorPicker;
        #endregion

        #region Inspector - Hair Step
        [Header("Hair Step")]
        [Tooltip("Grid container for hair style selection cells.")]
        public Transform HairStyleGrid;

        [Tooltip("Color picker for hair color.")]
        public ColorPicker HairColorPicker;
        #endregion

        #region Inspector - Clothing Step
        [Header("Clothing Step")]
        [Tooltip("Grid container for tops selection cells.")]
        public Transform TopsGrid;

        [Tooltip("Grid container for bottoms selection cells.")]
        public Transform BottomsGrid;

        [Tooltip("Grid container for shoes selection cells.")]
        public Transform ShoesGrid;
        #endregion

        #region Inspector - Accessories Step
        [Header("Accessories Step")]
        [Tooltip("Grid container for accessory selection cells.")]
        public Transform AccessoriesGrid;
        #endregion

        #region State
        private readonly List<CustomizationOption> _eyeOptions = new();
        private readonly List<CustomizationOption> _mouthOptions = new();
        private readonly List<CustomizationOption> _hairOptions = new();
        private readonly List<CustomizationOption> _topOptions = new();
        private readonly List<CustomizationOption> _bottomOptions = new();
        private readonly List<CustomizationOption> _shoeOptions = new();
        private readonly List<CustomizationOption> _accessoryOptions = new();

        private string _selectedEyeId;
        private string _selectedMouthId;
        private string _selectedHairId;
        private string _selectedTopId;
        private string _selectedBottomId;
        private string _selectedShoeId;
        private string _selectedAccessoryId;

        private bool _isNameAvailable;
        private bool _isCheckingName;
        private float _previewRotation = 0f;
        private readonly string[] _stepTitles = { "Choose Your Name", "Customize Body", "Design Your Face", "Pick a Hairstyle", "Choose Outfit", "Add Accessories" };
        private readonly string[] _stepDescriptions = {
            "What should others call you? Check availability before continuing.",
            "Adjust your height, build, and skin tone to match your style.",
            "Select eye shape, mouth shape, and eye color.",
            "Pick a hairstyle and color that expresses your personality.",
            "Choose tops, bottoms, and shoes for your character.",
            "Add accessories like hats, glasses, and jewelry to complete your look."
        };
        #endregion

        #region Properties
        /// <summary>
        /// Returns true if all required steps are complete and the character is ready to create.
        /// </summary>
        public bool IsComplete { get; private set; }
        #endregion

        #region Events
        /// <summary>
        /// Fired when the character creation process is completed successfully.
        /// </summary>
        public event Action OnCreationComplete;

        /// <summary>
        /// Fired when the player cancels or exits the creation process.
        /// </summary>
        public event Action OnCreationCancelled;
        #endregion

        #region Unity Lifecycle
        protected override void Awake()
        {
            base.Awake();
            WireEventListeners();
            LoadCustomizationData();
        }

        private void OnEnable()
        {
            EventBus.Instance?.Subscribe<SaveCompletedEvent>(OnSaveCompleted);
        }

        private void OnDisable()
        {
            EventBus.Instance?.Unsubscribe<SaveCompletedEvent>(OnSaveCompleted);
        }
        #endregion

        #region EventBus Handlers
        /// <summary>
        /// Handles save completion events (character data saved to server).
        /// </summary>
        private void OnSaveCompleted(SaveCompletedEvent evt)
        {
            if (evt.Success && evt.Key == "character_creation")
            {
                IsComplete = true;
                UIManager.Instance?.ShowToast("Character saved successfully!", ToastType.Success, 3f);
                OnCreationComplete?.Invoke();
            }
            else if (!evt.Success && evt.Key == "character_creation")
            {
                UIManager.Instance?.ShowToast($"Failed to save character: {evt.ErrorMessage}", ToastType.Error, 3f);
            }
        }
        #endregion

        #region Public API
        /// <summary>
        /// Called when the panel is about to be shown. Resets to the first step.
        /// </summary>
        public override void OnPanelShow()
        {
            base.OnPanelShow();
            StartCreation();
        }

        /// <summary>
        /// Resets the wizard and starts character creation from step 0.
        /// </summary>
        public void StartCreation()
        {
            CurrentStep = 0;
            IsComplete = false;
            if (NameInput != null) NameInput.text = string.Empty;
            if (HeightSlider != null) HeightSlider.value = 0.5f;
            if (WidthSlider != null) WidthSlider.value = 0.5f;
            _previewRotation = 0f;
            _isNameAvailable = false;
            RefreshStepUI();
            UpdateProgressBar();
            RefreshPreview();
        }

        /// <summary>
        /// Jumps to a specific step in the creation wizard.
        /// </summary>
        /// <param name="step">0-based step index.</param>
        public void GoToStep(int step)
        {
            CurrentStep = Mathf.Clamp(step, 0, StepPanels.Count - 1);
            RefreshStepUI();
            UpdateProgressBar();
            RefreshPreview();
        }

        /// <summary>
        /// Advances to the next step, or completes creation if on the final step.
        /// </summary>
        public void NextStep()
        {
            if (CurrentStep >= StepPanels.Count - 1)
            {
                CompleteCreation();
                return;
            }
            GoToStep(CurrentStep + 1);
        }

        /// <summary>
        /// Goes back to the previous step if not on step 0.
        /// </summary>
        public void PreviousStep()
        {
            if (CurrentStep > 0)
                GoToStep(CurrentStep - 1);
        }

        /// <summary>
        /// Finalizes the character creation and publishes the result.
        /// </summary>
        public void CompleteCreation()
        {
            if (!ValidateCurrentStep())
            {
                UIManager.Instance?.ShowToast("Please complete the current step before finishing.", ToastType.Warning, 2f);
                return;
            }

            // Publish character creation complete event
            EventBus.Instance?.Publish(new AvatarChangedEvent
            {
                PlayerId = "local_player",
                PartCategory = "FullCreation",
                NewLabel = NameInput?.text ?? "Player"
            });

            IsComplete = true;
            OnCreationComplete?.Invoke();
            Hide(true);
        }

        /// <summary>
        /// Randomizes all customization choices across all steps.
        /// </summary>
        public void RandomizeCharacter()
        {
            if (_eyeOptions.Count > 0)
                _selectedEyeId = _eyeOptions[UnityEngine.Random.Range(0, _eyeOptions.Count)].OptionId;
            if (_mouthOptions.Count > 0)
                _selectedMouthId = _mouthOptions[UnityEngine.Random.Range(0, _mouthOptions.Count)].OptionId;
            if (_hairOptions.Count > 0)
                _selectedHairId = _hairOptions[UnityEngine.Random.Range(0, _hairOptions.Count)].OptionId;
            if (_topOptions.Count > 0)
                _selectedTopId = _topOptions[UnityEngine.Random.Range(0, _topOptions.Count)].OptionId;
            if (_bottomOptions.Count > 0)
                _selectedBottomId = _bottomOptions[UnityEngine.Random.Range(0, _bottomOptions.Count)].OptionId;
            if (_shoeOptions.Count > 0)
                _selectedShoeId = _shoeOptions[UnityEngine.Random.Range(0, _shoeOptions.Count)].OptionId;
            if (_accessoryOptions.Count > 0)
                _selectedAccessoryId = _accessoryOptions[UnityEngine.Random.Range(0, _accessoryOptions.Count)].OptionId;

            if (HeightSlider != null) HeightSlider.value = UnityEngine.Random.Range(0.3f, 0.8f);
            if (WidthSlider != null) WidthSlider.value = UnityEngine.Random.Range(0.3f, 0.7f);
            if (SkinTonePicker != null) SkinTonePicker.SetColor(RandomSkinTone());
            if (EyeColorPicker != null) EyeColorPicker.SetColor(RandomEyeColor());
            if (HairColorPicker != null) HairColorPicker.SetColor(RandomHairColor());

            RefreshStepUI();
            RefreshPreview();
            UIManager.Instance?.ShowToast("Character randomized!", ToastType.Info, 1.5f);
        }

        /// <summary>
        /// Checks the entered name against the server for availability.
        /// </summary>
        public void CheckNameAvailability()
        {
            if (NameInput == null || string.IsNullOrWhiteSpace(NameInput.text))
            {
                if (NameAvailabilityText != null)
                {
                    NameAvailabilityText.text = "Please enter a name.";
                    NameAvailabilityText.color = Color.red;
                }
                return;
            }

            _isCheckingName = true;
            // TODO: Replace with actual API call to check name availability
            // Simulated check
            bool taken = NameInput.text.ToLowerInvariant().Contains("admin");
            _isNameAvailable = !taken;
            _isCheckingName = false;

            if (NameAvailabilityText != null)
            {
                NameAvailabilityText.text = taken ? "Name is already taken." : "Name is available!";
                NameAvailabilityText.color = taken ? Color.red : Color.green;
            }
        }

        /// <summary>
        /// Called when the back button (Escape) is pressed. Goes back a step or cancels.
        /// </summary>
        /// <returns>True if the back press was handled.</returns>
        public override bool OnBackPressed()
        {
            if (CurrentStep > 0)
            {
                PreviousStep();
                return true;
            }
            OnCreationCancelled?.Invoke();
            return base.OnBackPressed();
        }
        #endregion

        #region Private Implementation
        /// <summary>
        /// Wires all UI event listeners.
        /// </summary>
        private void WireEventListeners()
        {
            if (BackButton != null)
                BackButton.onClick.AddListener(PreviousStep);
            if (NextButton != null)
                NextButton.onClick.AddListener(NextStep);
            if (SkipButton != null)
                SkipButton.onClick.AddListener(() =>
                {
                    if (CurrentStep < StepPanels.Count - 1)
                        GoToStep(CurrentStep + 1);
                    else
                        CompleteCreation();
                });
            if (RandomizeButton != null)
                RandomizeButton.onClick.AddListener(RandomizeCharacter);

            if (CheckNameButton != null)
                CheckNameButton.onClick.AddListener(CheckNameAvailability);
            if (NameInput != null)
                NameInput.onEndEdit.AddListener(_ => CheckNameAvailability());

            if (RotateLeftButton != null)
                RotateLeftButton.onClick.AddListener(() => RotatePreview(-45f));
            if (RotateRightButton != null)
                RotateRightButton.onClick.AddListener(() => RotatePreview(45f));
            if (PlayEmoteButton != null)
                PlayEmoteButton.onClick.AddListener(OnPlayEmote);

            if (HeightSlider != null)
                HeightSlider.onValueChanged.AddListener(_ => RefreshPreview());
            if (WidthSlider != null)
                WidthSlider.onValueChanged.AddListener(_ => RefreshPreview());
            if (SkinTonePicker != null)
                SkinTonePicker.OnColorChanged += _ => RefreshPreview();
            if (EyeColorPicker != null)
                EyeColorPicker.OnColorChanged += _ => RefreshPreview();
            if (HairColorPicker != null)
                HairColorPicker.OnColorChanged += _ => RefreshPreview();
        }

        /// <summary>
        /// Loads customization option data for grids.
        /// </summary>
        private void LoadCustomizationData()
        {
            _eyeOptions.Clear();
            for (int i = 0; i < 8; i++)
                _eyeOptions.Add(new CustomizationOption { OptionId = $"eye_{i}", DisplayName = $"Eyes {i + 1}", ThumbnailUrl = string.Empty, IsLocked = false });

            _mouthOptions.Clear();
            for (int i = 0; i < 6; i++)
                _mouthOptions.Add(new CustomizationOption { OptionId = $"mouth_{i}", DisplayName = $"Mouth {i + 1}", ThumbnailUrl = string.Empty, IsLocked = false });

            _hairOptions.Clear();
            for (int i = 0; i < 12; i++)
                _hairOptions.Add(new CustomizationOption { OptionId = $"hair_{i}", DisplayName = $"Hair {i + 1}", ThumbnailUrl = string.Empty, IsLocked = i >= 8 });

            _topOptions.Clear();
            for (int i = 0; i < 10; i++)
                _topOptions.Add(new CustomizationOption { OptionId = $"top_{i}", DisplayName = $"Top {i + 1}", ThumbnailUrl = string.Empty, IsLocked = false });

            _bottomOptions.Clear();
            for (int i = 0; i < 8; i++)
                _bottomOptions.Add(new CustomizationOption { OptionId = $"bottom_{i}", DisplayName = $"Bottom {i + 1}", ThumbnailUrl = string.Empty, IsLocked = false });

            _shoeOptions.Clear();
            for (int i = 0; i < 6; i++)
                _shoeOptions.Add(new CustomizationOption { OptionId = $"shoe_{i}", DisplayName = $"Shoes {i + 1}", ThumbnailUrl = string.Empty, IsLocked = false });

            _accessoryOptions.Clear();
            for (int i = 0; i < 10; i++)
                _accessoryOptions.Add(new CustomizationOption { OptionId = $"acc_{i}", DisplayName = $"Accessory {i + 1}", ThumbnailUrl = string.Empty, IsLocked = i >= 6 });
        }

        /// <summary>
        /// Refreshes the visibility of step panels and updates navigation buttons.
        /// </summary>
        private void RefreshStepUI()
        {
            for (int i = 0; i < StepPanels.Count; i++)
            {
                if (StepPanels[i] != null)
                    StepPanels[i].SetActive(i == CurrentStep);
            }

            if (StepTitleText != null)
                StepTitleText.text = _stepTitles[Mathf.Clamp(CurrentStep, 0, _stepTitles.Length - 1)];
            if (StepDescriptionText != null)
                StepDescriptionText.text = _stepDescriptions[Mathf.Clamp(CurrentStep, 0, _stepDescriptions.Length - 1)];

            if (BackButton != null)
                BackButton.gameObject.SetActive(CurrentStep > 0);
            if (NextButton != null)
            {
                bool isLastStep = CurrentStep >= StepPanels.Count - 1;
                var nextLabel = NextButton.transform.Find("Label")?.GetComponent<TMP_Text>();
                if (nextLabel != null) nextLabel.text = isLastStep ? "Finish" : "Next";
            }
            if (SkipButton != null)
                SkipButton.gameObject.SetActive(CurrentStep < StepPanels.Count - 1);

            // Populate option grids for the current step
            switch (CurrentStep)
            {
                case 2: PopulateOptionGrid(EyeTypeGrid, _eyeOptions, ref _selectedEyeId); break;
                case 2: PopulateOptionGrid(MouthTypeGrid, _mouthOptions, ref _selectedMouthId); break;
                case 3: PopulateOptionGrid(HairStyleGrid, _hairOptions, ref _selectedHairId); break;
                case 4:
                    PopulateOptionGrid(TopsGrid, _topOptions, ref _selectedTopId);
                    PopulateOptionGrid(BottomsGrid, _bottomOptions, ref _selectedBottomId);
                    PopulateOptionGrid(ShoesGrid, _shoeOptions, ref _selectedShoeId);
                    break;
                case 5: PopulateOptionGrid(AccessoriesGrid, _accessoryOptions, ref _selectedAccessoryId); break;
            }
        }

        /// <summary>
        /// Updates the progress bar value based on current step.
        /// </summary>
        private void UpdateProgressBar()
        {
            if (ProgressBar == null || StepPanels.Count == 0) return;
            float progress = (float)(CurrentStep + 1) / StepPanels.Count;
            ProgressBar.value = progress;
        }

        /// <summary>
        /// Refreshes the character preview render.
        /// </summary>
        private void RefreshPreview()
        {
            // TODO: Trigger avatar preview render update
            // This would typically update a render texture or re-render the avatar model
        }

        /// <summary>
        /// Rotates the preview camera or model by the specified degrees.
        /// </summary>
        private void RotatePreview(float degrees)
        {
            _previewRotation += degrees;
            _previewRotation = (_previewRotation % 360f + 360f) % 360f;
            // TODO: Apply rotation to preview camera rig
        }

        /// <summary>
        /// Triggers a random emote animation on the preview character.
        /// </summary>
        private void OnPlayEmote()
        {
            // TODO: Trigger emote animation on preview avatar
            UIManager.Instance?.ShowToast("Playing emote...", ToastType.Info, 1f);
        }

        /// <summary>
        /// Populates a selection grid with customization option cells.
        /// </summary>
        private void PopulateOptionGrid(Transform grid, List<CustomizationOption> options, ref string selectedId)
        {
            if (grid == null) return;

            foreach (Transform child in grid)
            {
                if (child != null) Destroy(child.gameObject);
            }

            foreach (var option in options)
            {
                var cell = new GameObject($"Option_{option.OptionId}");
                cell.transform.SetParent(grid, false);
                var rt = cell.AddComponent<RectTransform>();
                rt.sizeDelta = new Vector2(80f, 80f);

                var img = cell.AddComponent<Image>();
                img.color = option.IsLocked ? new Color(0.3f, 0.3f, 0.3f, 0.5f) : Color.white;

                var btn = cell.AddComponent<Button>();
                string oid = option.OptionId;
                btn.onClick.AddListener(() =>
                {
                    if (option.IsLocked)
                    {
                        UIManager.Instance?.ShowToast("This option is locked!", ToastType.Warning, 1.5f);
                        return;
                    }
                    selectedId = oid;
                    RefreshPreview();
                    // Refresh grid to show selection state
                    PopulateOptionGrid(grid, options, ref selectedId);
                });

                // Selection highlight
                if (selectedId == option.OptionId)
                {
                    var highlight = new GameObject("Highlight");
                    highlight.transform.SetParent(cell.transform, false);
                    var hrt = highlight.AddComponent<RectTransform>();
                    hrt.anchorMin = Vector2.zero;
                    hrt.anchorMax = Vector2.one;
                    hrt.offsetMin = new Vector2(-4f, -4f);
                    hrt.offsetMax = new Vector2(4f, 4f);
                    var himg = highlight.AddComponent<Image>();
                    himg.color = new Color(0.2f, 0.8f, 0.9f, 0.4f);
                }
            }
        }

        /// <summary>
        /// Validates that the current step has required selections filled in.
        /// </summary>
        private bool ValidateCurrentStep()
        {
            switch (CurrentStep)
            {
                case 0: // Name
                    return !string.IsNullOrWhiteSpace(NameInput?.text) && _isNameAvailable;
                case 1: // Body
                    return true;
                case 2: // Face
                    return !string.IsNullOrEmpty(_selectedEyeId) && !string.IsNullOrEmpty(_selectedMouthId);
                case 3: // Hair
                    return !string.IsNullOrEmpty(_selectedHairId);
                case 4: // Clothing
                    return !string.IsNullOrEmpty(_selectedTopId) && !string.IsNullOrEmpty(_selectedBottomId) && !string.IsNullOrEmpty(_selectedShoeId);
                case 5: // Accessories
                    return true; // Optional
                default:
                    return true;
            }
        }

        /// <summary>
        /// Generates a random skin tone color.
        /// </summary>
        private static Color RandomSkinTone()
        {
            float hue = UnityEngine.Random.Range(0.05f, 0.12f);
            float saturation = UnityEngine.Random.Range(0.3f, 0.6f);
            float value = UnityEngine.Random.Range(0.5f, 0.9f);
            return Color.HSVToRGB(hue, saturation, value);
        }

        /// <summary>
        /// Generates a random eye color.
        /// </summary>
        private static Color RandomEyeColor()
        {
            float hue = UnityEngine.Random.Range(0f, 1f);
            float saturation = UnityEngine.Random.Range(0.4f, 0.9f);
            float value = UnityEngine.Random.Range(0.5f, 0.9f);
            return Color.HSVToRGB(hue, saturation, value);
        }

        /// <summary>
        /// Generates a random hair color.
        /// </summary>
        private static Color RandomHairColor()
        {
            float hue = UnityEngine.Random.Range(0f, 1f);
            float saturation = UnityEngine.Random.Range(0.2f, 0.9f);
            float value = UnityEngine.Random.Range(0.2f, 0.9f);
            return Color.HSVToRGB(hue, saturation, value);
        }
        #endregion
    }
}
