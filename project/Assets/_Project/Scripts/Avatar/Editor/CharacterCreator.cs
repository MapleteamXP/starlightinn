using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace KawaiiCoolIsland.Avatar.Editor
{
    /// <summary>
    /// Represents a single step within the Character Creation wizard.
    /// Configured in the Unity Inspector to define the flow for new players.
    /// </summary>
    [System.Serializable]
    public class CreatorStep
    {
        [Tooltip("Internal identifier for the step.")] public string StepName;
        [Tooltip("Localized title shown to the player.")] public string Title;
        [Tooltip("Localized description shown under the title.")] public string Description;
        [Tooltip("UI panel GameObject activated during this step.")] public GameObject Panel;
        [Tooltip("If true, the step can be skipped via the Skip button.")] public bool IsOptional;
    }

    /// <summary>
    /// Full character creation wizard for new players in KawaiiCool Island v2.0.
    /// Guides the player through a multi-step setup including body, face, hair,
    /// clothing, accessories, and naming. Provides live preview, randomization,
    /// and back/forward navigation with a progress slider.
    /// </summary>
    public class CharacterCreator : UIPanel
    {
        #region Header Fields

        [Header("Steps")]
        [SerializeField, Tooltip("Ordered list of creation steps.")]
        private List<CreatorStep> _steps = new();

        [Header("Navigation")]
        [SerializeField, Tooltip("Button to navigate to the previous step.")] public Button BackButton;
        [SerializeField, Tooltip("Button to advance to the next step.")] public Button NextButton;
        [SerializeField, Tooltip("Button to skip optional steps.")] public Button SkipButton;
        [SerializeField, Tooltip("Text displaying the current step title.")] public TMP_Text StepTitleText;
        [SerializeField, Tooltip("Text displaying the current step description.")] public TMP_Text StepDescriptionText;
        [SerializeField, Tooltip("Progress bar for the overall creation flow.")] public Slider ProgressSlider;

        [Header("Preview")]
        [SerializeField, Tooltip("Live avatar preview component.")] public AvatarPreview PreviewAvatar;
        [SerializeField, Tooltip("Camera used for rendering the preview.")] public Camera PreviewCamera;
        [SerializeField, Tooltip("RenderTexture used for the preview display.")] public RenderTexture PreviewTexture;

        [Header("Step Containers")]
        [SerializeField, Tooltip("Panel for body customization (skin, height, proportions).")] public GameObject BodyStepPanel;
        [SerializeField, Tooltip("Panel for face customization (eyes, mouth, brows).")] public GameObject FaceStepPanel;
        [SerializeField, Tooltip("Panel for hair style and color selection.")] public GameObject HairStepPanel;
        [SerializeField, Tooltip("Panel for clothing selection.")] public GameObject ClothingStepPanel;
        [SerializeField, Tooltip("Panel for accessory equipping.")] public GameObject AccessoriesStepPanel;
        [SerializeField, Tooltip("Panel for entering the character name.")] public GameObject NameStepPanel;

        #endregion

        #region Properties

        /// <summary>
        /// Gets the ordered list of creation steps.
        /// </summary>
        public List<CreatorStep> Steps => _steps;

        /// <summary>
        /// Gets the index of the currently active step.
        /// </summary>
        public int CurrentStepIndex { get; private set; }

        /// <summary>
        /// Returns true if all required steps have been completed.
        /// </summary>
        public bool IsComplete { get; private set; }

        #endregion

        #region Events

        /// <summary>
        /// Invoked when the character has been fully created and saved.
        /// </summary>
        public event Action OnCharacterCreated;

        /// <summary>
        /// Invoked when the player cancels the creation process.
        /// </summary>
        public event Action OnCreationCancelled;

        #endregion

        #region Private Fields

        private AvatarController _previewAvatarController;
        private BodyCustomizer _bodyCustomizer;
        private FaceCustomizer _faceCustomizer;
        private ColorCustomization _colorCustomization;
        private string _characterName = "Player";
        private bool _hasStarted;

        #endregion

        #region Unity Lifecycle

        protected virtual void Awake()
        {
            if (PreviewAvatar != null)
                _previewAvatarController = PreviewAvatar.GetComponent<AvatarController>();

            _bodyCustomizer = GetComponentInChildren<BodyCustomizer>(true);
            _faceCustomizer = GetComponentInChildren<FaceCustomizer>(true);
            _colorCustomization = GetComponentInChildren<ColorCustomization>(true);

            BindButtons();
        }

        protected virtual void OnEnable()
        {
            EventBus.Subscribe<AvatarPartEquippedEvent>(OnAvatarPartEquipped);
        }

        protected virtual void OnDisable()
        {
            EventBus.Unsubscribe<AvatarPartEquippedEvent>(OnAvatarPartEquipped);
        }

        #endregion

        #region Public API

        /// <summary>
        /// Begins the character creation wizard from the first step.
        /// Resets all internal state and prepares the preview.
        /// </summary>
        public void StartCharacterCreation()
        {
            IsComplete = false;
            CurrentStepIndex = 0;
            _hasStarted = true;
            _characterName = "Player";

            if (PreviewAvatar != null)
            {
                PreviewAvatar.ResetToDefault();
                PreviewAvatar.gameObject.SetActive(true);
            }

            SetupStepPanels();
            GoToStep(0);
            UpdateProgressUI();
        }

        /// <summary>
        /// Jumps to a specific step by index. Bounds-checked.
        /// </summary>
        /// <param name="stepIndex">Zero-based step index.</param>
        public void GoToStep(int stepIndex)
        {
            if (stepIndex < 0 || stepIndex >= _steps.Count)
                return;

            DeactivateAllPanels();
            CurrentStepIndex = stepIndex;

            var step = _steps[stepIndex];
            if (step.Panel != null)
                step.Panel.SetActive(true);

            SetupCurrentStep();
            UpdateNavigationUI();
            UpdateProgressUI();
            UpdatePreviewForStep(step.StepName);
        }

        /// <summary>
        /// Advances to the next step. Completes creation if on the last step.
        /// </summary>
        public void GoToNextStep()
        {
            if (CurrentStepIndex >= _steps.Count - 1)
            {
                CompleteCreation();
                return;
            }

            GoToStep(CurrentStepIndex + 1);
        }

        /// <summary>
        /// Returns to the previous step.
        /// </summary>
        public void GoToPreviousStep()
        {
            if (CurrentStepIndex > 0)
                GoToStep(CurrentStepIndex - 1);
        }

        /// <summary>
        /// Skips the current step if it is optional.
        /// </summary>
        public void SkipCurrentStep()
        {
            if (CurrentStepIndex < _steps.Count && _steps[CurrentStepIndex].IsOptional)
                GoToNextStep();
        }

        /// <summary>
        /// Finalizes character creation, saves data, and broadcasts completion.
        /// </summary>
        public void CompleteCreation()
        {
            if (IsComplete) return;
            IsComplete = true;

            SaveCharacter();

            EventBus.Publish(new CharacterCreatedEvent { CharacterName = _characterName });
            OnCharacterCreated?.Invoke();

            Debug.Log($"[CharacterCreator] Character '{_characterName}' created successfully.");
        }

        /// <summary>
        /// Persists the current avatar configuration to the save system.
        /// </summary>
        public void SaveCharacter()
        {
            if (_previewAvatarController == null) return;

            var outfit = _previewAvatarController.BuildCurrentOutfit();
            outfit.OutfitName = _characterName;

            if (_bodyCustomizer != null)
                outfit.BodyConfig = _bodyCustomizer.GetConfiguration();

            if (_faceCustomizer != null)
                outfit.FaceConfig = _faceCustomizer.GetConfiguration();

            SaveManager.Save(outfit, "character_outfit");
            PlayerPrefs.SetString("CharacterName", _characterName);
            PlayerPrefs.Save();
        }

        /// <summary>
        /// Randomizes all customizable aspects of the character.
        /// </summary>
        public void RandomizeCharacter()
        {
            if (PreviewAvatar == null) return;

            PreviewAvatar.Randomize();

            if (_bodyCustomizer != null)
            {
                _bodyCustomizer.SetHeight(UnityEngine.Random.Range(0.85f, 1.15f));
                _bodyCustomizer.SetWidth(UnityEngine.Random.Range(0.85f, 1.15f));
                _bodyCustomizer.SetHeadSize(UnityEngine.Random.Range(0.85f, 1.15f));
                _bodyCustomizer.SetSkinTone(GetRandomSkinTone());
            }

            if (_faceCustomizer != null)
            {
                _faceCustomizer.SetEyeColor(UnityEngine.Random.ColorHSV());
                _faceCustomizer.SetEyebrowColor(UnityEngine.Random.ColorHSV());
                _faceCustomizer.ToggleMakeup(UnityEngine.Random.value > 0.7f);
            }

            RefreshPreview();
        }

        /// <summary>
        /// Cancels the character creation process.
        /// </summary>
        public void CancelCreation()
        {
            _hasStarted = false;
            OnCreationCancelled?.Invoke();
            EventBus.Publish(new CharacterCreationCancelledEvent());
        }

        /// <summary>
        /// Sets the character name from the name step.
        /// </summary>
        /// <param name="name">The desired character name.</param>
        public void SetCharacterName(string name)
        {
            _characterName = string.IsNullOrWhiteSpace(name) ? "Player" : name.Trim();
        }

        #endregion

        #region Step Setup Handlers

        private void SetupCurrentStep()
        {
            if (CurrentStepIndex >= _steps.Count) return;

            string stepName = _steps[CurrentStepIndex].StepName;

            switch (stepName)
            {
                case "Body":  SetupBodyStep();  break;
                case "Face":  SetupFaceStep();  break;
                case "Hair":  SetupHairStep();  break;
                case "Clothing": SetupClothingStep(); break;
                case "Accessories": SetupAccessoriesStep(); break;
                case "Name": SetupNameStep(); break;
            }
        }

        /// <summary>
        /// Initializes the Body step with default body panel and skin tone options.
        /// </summary>
        private void SetupBodyStep()
        {
            if (_bodyCustomizer != null)
            {
                _bodyCustomizer.Preview = PreviewAvatar;
                _bodyCustomizer.SetSkinTone(GetDefaultSkinTone());
            }
        }

        /// <summary>
        /// Initializes the Face step with default eye, brow, and mouth options.
        /// </summary>
        private void SetupFaceStep()
        {
            if (_faceCustomizer != null)
            {
                _faceCustomizer.SetEyeColor(Color.blue);
                _faceCustomizer.SetEyebrowColor(Color.black);
                _faceCustomizer.ToggleMakeup(false);
            }
        }

        /// <summary>
        /// Initializes the Hair step with color customization ready.
        /// </summary>
        private void SetupHairStep()
        {
            if (_colorCustomization != null)
            {
                _colorCustomization.SetHairColor(Color.black);
            }
        }

        /// <summary>
        /// Initializes the Clothing step by resetting to default outfit and enabling browsing.
        /// </summary>
        private void SetupClothingStep()
        {
            if (PreviewAvatar != null)
            {
                PreviewAvatar.EquipDefaultClothing();
            }

            EventBus.Publish(new ShowWardrobeCategoryEvent { Category = ItemCategory.Top });
        }

        /// <summary>
        /// Initializes the Accessories step by showing the accessories wardrobe category.
        /// </summary>
        private void SetupAccessoriesStep()
        {
            EventBus.Publish(new ShowWardrobeCategoryEvent { Category = ItemCategory.Accessory });
        }

        /// <summary>
        /// Initializes the Name step with default name input.
        /// </summary>
        private void SetupNameStep()
        {
            if (NameStepPanel != null)
            {
                var input = NameStepPanel.GetComponentInChildren<TMP_InputField>(true);
                if (input != null)
                {
                    input.text = _characterName;
                    input.onEndEdit.RemoveAllListeners();
                    input.onEndEdit.AddListener(SetCharacterName);
                }
            }
        }

        #endregion

        #region UI Management

        private void BindButtons()
        {
            if (BackButton != null)
                BackButton.onClick.AddListener(GoToPreviousStep);

            if (NextButton != null)
                NextButton.onClick.AddListener(GoToNextStep);

            if (SkipButton != null)
                SkipButton.onClick.AddListener(SkipCurrentStep);
        }

        private void UpdateNavigationUI()
        {
            if (BackButton != null)
                BackButton.interactable = CurrentStepIndex > 0;

            if (NextButton != null)
            {
                bool isLast = CurrentStepIndex >= _steps.Count - 1;
                var nextText = NextButton.GetComponentInChildren<TMP_Text>(true);
                if (nextText != null)
                    nextText.text = isLast ? "Finish" : "Next";
            }

            if (SkipButton != null)
            {
                bool canSkip = CurrentStepIndex < _steps.Count && _steps[CurrentStepIndex].IsOptional;
                SkipButton.gameObject.SetActive(canSkip);
            }

            if (StepTitleText != null && CurrentStepIndex < _steps.Count)
                StepTitleText.text = _steps[CurrentStepIndex].Title;

            if (StepDescriptionText != null && CurrentStepIndex < _steps.Count)
                StepDescriptionText.text = _steps[CurrentStepIndex].Description;
        }

        private void UpdateProgressUI()
        {
            if (ProgressSlider == null || _steps.Count == 0) return;
            ProgressSlider.value = (float)(CurrentStepIndex + 1) / _steps.Count;
        }

        private void DeactivateAllPanels()
        {
            if (BodyStepPanel != null) BodyStepPanel.SetActive(false);
            if (FaceStepPanel != null) FaceStepPanel.SetActive(false);
            if (HairStepPanel != null) HairStepPanel.SetActive(false);
            if (ClothingStepPanel != null) ClothingStepPanel.SetActive(false);
            if (AccessoriesStepPanel != null) AccessoriesStepPanel.SetActive(false);
            if (NameStepPanel != null) NameStepPanel.SetActive(false);

            foreach (var step in _steps)
                if (step.Panel != null)
                    step.Panel.SetActive(false);
        }

        private void SetupStepPanels()
        {
            if (_steps.Count == 0)
            {
                _steps.Add(new CreatorStep { StepName = "Body", Title = "Body", Description = "Choose your body shape and skin tone.", Panel = BodyStepPanel, IsOptional = false });
                _steps.Add(new CreatorStep { StepName = "Face", Title = "Face", Description = "Customize your facial features.", Panel = FaceStepPanel, IsOptional = false });
                _steps.Add(new CreatorStep { StepName = "Hair", Title = "Hair", Description = "Pick a hairstyle and color.", Panel = HairStepPanel, IsOptional = false });
                _steps.Add(new CreatorStep { StepName = "Clothing", Title = "Outfit", Description = "Choose your starting outfit.", Panel = ClothingStepPanel, IsOptional = true });
                _steps.Add(new CreatorStep { StepName = "Accessories", Title = "Accessories", Description = "Add some accessories.", Panel = AccessoriesStepPanel, IsOptional = true });
                _steps.Add(new CreatorStep { StepName = "Name", Title = "Name", Description = "What should we call you?", Panel = NameStepPanel, IsOptional = false });
            }
        }

        #endregion

        #region Preview Management

        private void UpdatePreviewForStep(string stepName)
        {
            if (PreviewAvatar == null) return;

            switch (stepName)
            {
                case "Body":
                    PreviewAvatar.FocusOnBody();
                    break;
                case "Face":
                    PreviewAvatar.FocusOnFace();
                    break;
                case "Hair":
                    PreviewAvatar.FocusOnHair();
                    break;
                case "Clothing":
                case "Accessories":
                    PreviewAvatar.ShowFullBody();
                    break;
                case "Name":
                    PreviewAvatar.PlayIdleAnimation();
                    break;
            }

            RefreshPreview();
        }

        private void RefreshPreview()
        {
            if (PreviewAvatar != null)
                PreviewAvatar.RefreshRender();
        }

        #endregion

        #region Event Handlers

        private void OnAvatarPartEquipped(AvatarPartEquippedEvent evt)
        {
            if (!_hasStarted) return;
            RefreshPreview();
        }

        #endregion

        #region Utilities

        private Color GetDefaultSkinTone()
        {
            if (_bodyCustomizer != null && _bodyCustomizer.PresetSkinTones.Count > 0)
                return _bodyCustomizer.PresetSkinTones[0];
            return new Color(1f, 0.85f, 0.7f, 1f);
        }

        private Color GetRandomSkinTone()
        {
            if (_bodyCustomizer != null && _bodyCustomizer.PresetSkinTones.Count > 0)
                return _bodyCustomizer.PresetSkinTones[UnityEngine.Random.Range(0, _bodyCustomizer.PresetSkinTones.Count)];
            return new Color(1f, 0.85f, 0.7f, 1f);
        }

        #endregion

        #region UIPanel Overrides

        /// <summary>
        /// Called when the panel is shown. Automatically starts character creation.
        /// </summary>
        public override void OnPanelShow()
        {
            base.OnPanelShow();
            StartCharacterCreation();
        }

        /// <summary>
        /// Called when the panel is hidden. Cleans up preview resources.
        /// </summary>
        public override void OnPanelHide()
        {
            base.OnPanelHide();
            if (PreviewAvatar != null)
                PreviewAvatar.gameObject.SetActive(false);
            _hasStarted = false;
        }

        #endregion
    }

    #region Events

    /// <summary>
    /// Published when a character is successfully created.
    /// </summary>
    public struct CharacterCreatedEvent
    {
        public string CharacterName;
    }

    /// <summary>
    /// Published when character creation is cancelled by the player.
    /// </summary>
    public struct CharacterCreationCancelledEvent { }

    /// <summary>
    /// Published to request showing a specific wardrobe category.
    /// </summary>
    public struct ShowWardrobeCategoryEvent
    {
        public ItemCategory Category;
    }

    #endregion
}
