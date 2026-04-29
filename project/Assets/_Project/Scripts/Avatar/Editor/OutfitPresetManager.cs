using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KawaiiCoolIsland.Avatar.Editor
{
    /// <summary>
    /// Represents a saved outfit preset with metadata for display, sorting, and sharing.
    /// </summary>
    [System.Serializable]
    public class OutfitPreset
    {
        /// <summary>
        /// Unique identifier for this preset.
        /// </summary>
        public string PresetId;

        /// <summary>
        /// Display name of the preset.
        /// </summary>
        public string Name;

        /// <summary>
        /// Optional description or notes about the outfit.
        /// </summary>
        public string Description;

        /// <summary>
        /// The actual outfit data containing part references and configurations.
        /// </summary>
        public OutfitData Outfit;

        /// <summary>
        /// Thumbnail sprite for UI display.
        /// </summary>
        public Sprite Thumbnail;

        /// <summary>
        /// Whether this preset is marked as a favorite.
        /// </summary>
        public bool IsFavorite;

        /// <summary>
        /// Unix timestamp of when this preset was first created.
        /// </summary>
        public long CreatedDate;

        /// <summary>
        /// Unix timestamp of when this preset was last equipped or loaded.
        /// </summary>
        public long LastUsedDate;

        /// <summary>
        /// Number of times this preset has been equipped.
        /// </summary>
        public int UseCount;
    }

    /// <summary>
    /// Manages saving, loading, sharing, and organizing outfit presets.
    /// Persists presets across sessions and provides search, sort, and favorite capabilities.
    /// </summary>
    public class OutfitPresetManager : Singleton<OutfitPresetManager>
    {
        #region Header Fields

        [Header("Settings")]
        [SerializeField, Tooltip("Maximum number of presets a player can save."), Min(1)]
        public int MaxPresets = 20;

        [Header("Data")]
        [SerializeField, Tooltip("Runtime list of saved outfit presets.")]
        private List<OutfitPreset> _presets = new();

        #endregion

        #region Properties

        /// <summary>
        /// Gets the current list of saved presets.
        /// </summary>
        public List<OutfitPreset> Presets => _presets;

        #endregion

        #region Events

        /// <summary>
        /// Invoked whenever the preset collection changes (add, remove, reorder, rename).
        /// </summary>
        public event Action OnPresetsChanged;

        /// <summary>
        /// Invoked when a preset is equipped onto the player avatar.
        /// </summary>
        public event Action<string> OnPresetEquipped;

        #endregion

        #region Unity Lifecycle

        protected override void Awake()
        {
            base.Awake();
            LoadPresetsFromDisk();
        }

        #endregion

        #region Public API

        /// <summary>
        /// Saves a new outfit preset with the given name and outfit data.
        /// </summary>
        /// <param name="name">Display name for the preset.</param>
        /// <param name="outfit">OutfitData to store in the preset.</param>
        public void SavePreset(string name, OutfitData outfit)
        {
            if (outfit == null) return;
            if (_presets.Count >= MaxPresets)
            {
                Debug.LogWarning($"[OutfitPresetManager] Cannot save preset: maximum limit of {MaxPresets} reached.");
                return;
            }

            var preset = new OutfitPreset
            {
                PresetId = Guid.NewGuid().ToString("N"),
                Name = name,
                Description = string.Empty,
                Outfit = outfit,
                IsFavorite = false,
                CreatedDate = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                LastUsedDate = 0,
                UseCount = 0
            };

            _presets.Add(preset);
            PersistPresets();
            OnPresetsChanged?.Invoke();

            Debug.Log($"[OutfitPresetManager] Saved preset '{name}' with ID {preset.PresetId}.");
        }

        /// <summary>
        /// Deletes a preset by its unique ID.
        /// </summary>
        /// <param name="presetId">The unique preset identifier.</param>
        public void DeletePreset(string presetId)
        {
            var preset = _presets.FirstOrDefault(p => p.PresetId == presetId);
            if (preset == null) return;

            _presets.Remove(preset);
            PersistPresets();
            OnPresetsChanged?.Invoke();
        }

        /// <summary>
        /// Renames an existing preset.
        /// </summary>
        /// <param name="presetId">The unique preset identifier.</param>
        /// <param name="newName">The new display name.</param>
        public void RenamePreset(string presetId, string newName)
        {
            var preset = _presets.FirstOrDefault(p => p.PresetId == presetId);
            if (preset == null || string.IsNullOrWhiteSpace(newName)) return;

            preset.Name = newName;
            PersistPresets();
            OnPresetsChanged?.Invoke();
        }

        /// <summary>
        /// Loads a preset's outfit data without equipping it.
        /// </summary>
        /// <param name="presetId">The unique preset identifier.</param>
        public void LoadPreset(string presetId)
        {
            var preset = _presets.FirstOrDefault(p => p.PresetId == presetId);
            if (preset == null) return;

            EventBus.Publish(new PresetLoadedEvent { PresetId = presetId, Outfit = preset.Outfit });
        }

        /// <summary>
        /// Equips a preset onto the player's avatar.
        /// </summary>
        /// <param name="presetId">The unique preset identifier.</param>
        public void EquipPreset(string presetId)
        {
            var preset = _presets.FirstOrDefault(p => p.PresetId == presetId);
            if (preset == null) return;

            preset.LastUsedDate = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            preset.UseCount++;

            EventBus.Publish(new PresetEquippedEvent { PresetId = presetId, Outfit = preset.Outfit });
            OnPresetEquipped?.Invoke(presetId);
            PersistPresets();
        }

        /// <summary>
        /// Shares a preset with another player via the server.
        /// </summary>
        /// <param name="presetId">The unique preset identifier to share.</param>
        /// <param name="recipientId">The target player's user ID.</param>
        public void SharePreset(string presetId, string recipientId)
        {
            var preset = _presets.FirstOrDefault(p => p.PresetId == presetId);
            if (preset == null || string.IsNullOrWhiteSpace(recipientId)) return;

            var json = ExportPreset(presetId);
            EventBus.Publish(new ShareOutfitEvent { OutfitJson = json });

            Debug.Log($"[OutfitPresetManager] Shared preset '{preset.Name}' with recipient '{recipientId}'.");
        }

        /// <summary>
        /// Imports a preset from a JSON string.
        /// </summary>
        /// <param name="presetJson">JSON-serialized OutfitPreset or OutfitData.</param>
        public void ImportPreset(string presetJson)
        {
            if (string.IsNullOrWhiteSpace(presetJson)) return;
            if (_presets.Count >= MaxPresets)
            {
                Debug.LogWarning("[OutfitPresetManager] Cannot import: preset limit reached.");
                return;
            }

            try
            {
                var imported = JsonUtility.FromJson<OutfitPreset>(presetJson);
                if (imported == null || imported.Outfit == null)
                {
                    var outfit = JsonUtility.FromJson<OutfitData>(presetJson);
                    if (outfit == null) return;

                    imported = new OutfitPreset
                    {
                        PresetId = Guid.NewGuid().ToString("N"),
                        Name = outfit.OutfitName,
                        Outfit = outfit,
                        CreatedDate = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
                    };
                }

                imported.PresetId = Guid.NewGuid().ToString("N");
                imported.CreatedDate = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                imported.LastUsedDate = 0;
                imported.UseCount = 0;

                _presets.Add(imported);
                PersistPresets();
                OnPresetsChanged?.Invoke();

                Debug.Log($"[OutfitPresetManager] Imported preset '{imported.Name}'.");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[OutfitPresetManager] Failed to import preset: {ex.Message}");
            }
        }

        /// <summary>
        /// Exports a preset to a JSON string for sharing or backup.
        /// </summary>
        /// <param name="presetId">The unique preset identifier.</param>
        /// <returns>JSON string representing the preset, or null if not found.</returns>
        public string ExportPreset(string presetId)
        {
            var preset = _presets.FirstOrDefault(p => p.PresetId == presetId);
            if (preset == null) return null;
            return JsonUtility.ToJson(preset);
        }

        /// <summary>
        /// Returns all saved presets.
        /// </summary>
        public List<OutfitPreset> GetPresets()
        {
            return new List<OutfitPreset>(_presets);
        }

        /// <summary>
        /// Returns a single preset by ID, or null if not found.
        /// </summary>
        public OutfitPreset GetPreset(string presetId)
        {
            return _presets.FirstOrDefault(p => p.PresetId == presetId);
        }

        /// <summary>
        /// Toggles the favorite status of a preset.
        /// </summary>
        /// <param name="presetId">The unique preset identifier.</param>
        /// <param name="isFavorite">Desired favorite state.</param>
        public void SetFavorite(string presetId, bool isFavorite)
        {
            var preset = _presets.FirstOrDefault(p => p.PresetId == presetId);
            if (preset == null) return;

            preset.IsFavorite = isFavorite;
            PersistPresets();
            OnPresetsChanged?.Invoke();
        }

        /// <summary>
        /// Moves a preset to a new index in the list.
        /// </summary>
        /// <param name="presetId">The unique preset identifier.</param>
        /// <param name="newIndex">Target zero-based index.</param>
        public void ReorderPreset(string presetId, int newIndex)
        {
            var preset = _presets.FirstOrDefault(p => p.PresetId == presetId);
            if (preset == null) return;

            newIndex = Mathf.Clamp(newIndex, 0, _presets.Count - 1);
            _presets.Remove(preset);
            _presets.Insert(newIndex, preset);
            PersistPresets();
            OnPresetsChanged?.Invoke();
        }

        /// <summary>
        /// Generates a thumbnail for the given preset by rendering the avatar preview.
        /// </summary>
        /// <param name="presetId">The unique preset identifier.</param>
        public void GenerateThumbnail(string presetId)
        {
            var preset = _presets.FirstOrDefault(p => p.PresetId == presetId);
            if (preset == null) return;

            EventBus.Publish(new GeneratePresetThumbnailEvent { PresetId = presetId });
        }

        /// <summary>
        /// Returns presets sorted by most recently used.
        /// </summary>
        public List<OutfitPreset> GetPresetsByRecency()
        {
            return _presets.OrderByDescending(p => p.LastUsedDate).ToList();
        }

        /// <summary>
        /// Returns presets sorted by use count.
        /// </summary>
        public List<OutfitPreset> GetPresetsByPopularity()
        {
            return _presets.OrderByDescending(p => p.UseCount).ToList();
        }

        /// <summary>
        /// Returns only favorite presets.
        /// </summary>
        public List<OutfitPreset> GetFavoritePresets()
        {
            return _presets.Where(p => p.IsFavorite).ToList();
        }

        #endregion

        #region Persistence

        private void PersistPresets()
        {
            var serializable = new OutfitPresetList { Presets = _presets };
            var json = JsonUtility.ToJson(serializable);
            PlayerPrefs.SetString("OutfitPresets", json);
            PlayerPrefs.Save();
        }

        private void LoadPresetsFromDisk()
        {
            var json = PlayerPrefs.GetString("OutfitPresets", string.Empty);
            if (string.IsNullOrWhiteSpace(json)) return;

            try
            {
                var wrapper = JsonUtility.FromJson<OutfitPresetList>(json);
                if (wrapper?.Presets != null)
                    _presets = wrapper.Presets;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[OutfitPresetManager] Failed to load presets: {ex.Message}");
            }
        }

        #endregion
    }

    #region Serializable Wrapper

    /// <summary>
    /// Wrapper class for serializing a list of presets to JSON via JsonUtility.
    /// </summary>
    [System.Serializable]
    public class OutfitPresetList
    {
        public List<OutfitPreset> Presets = new();
    }

    #endregion

    #region Events

    /// <summary>
    /// Published when a preset is loaded into the editor without being equipped.
    /// </summary>
    public struct PresetLoadedEvent
    {
        public string PresetId;
        public OutfitData Outfit;
    }

    /// <summary>
    /// Published when a preset is equipped onto the player's avatar.
    /// </summary>
    public struct PresetEquippedEvent
    {
        public string PresetId;
        public OutfitData Outfit;
    }

    /// <summary>
    /// Published to request generation of a preset thumbnail.
    /// </summary>
    public struct GeneratePresetThumbnailEvent
    {
        public string PresetId;
    }

    #endregion
}
