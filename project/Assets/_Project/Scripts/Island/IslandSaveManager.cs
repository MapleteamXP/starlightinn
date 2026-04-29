// IslandSaveManager.cs
// Save/load operations for island layouts using PlayerPrefs and JSON serialization.
// Supports multiple save slots, import/export, and cloud sync stubs.
// KawaiiCool Island - Island Editor System

using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace KawaiiCool.IslandEditor
{
    /// <summary>
    /// Manages persistence of island layouts including multiple save slots,
    /// JSON import/export, and cloud synchronization.
    /// All local data is stored via PlayerPrefs as JSON strings.
    /// </summary>
    public class IslandSaveManager : MonoBehaviour
    {
        /// <summary>Prefix for all PlayerPrefs save keys.</summary>
        private const string SAVE_PREFIX = "IslandSave_";

        /// <summary>Key storing the comma-separated list of save slot names.</summary>
        private const string SAVE_SLOTS_KEY = "IslandSaveSlots";

        /// <summary>Maximum number of save slots allowed.</summary>
        private const int MAX_SAVE_SLOTS = 10;

        /// <summary>Current save data version for migration support.</summary>
        private const string CURRENT_VERSION = "1.0";

        /// <summary>
        /// Saves island data to a named slot in PlayerPrefs.
        /// </summary>
        /// <param name="slotName">The save slot name (e.g., "Slot1", "MyIsland").</param>
        /// <param name="data">The island data to serialize and store.</param>
        public void SaveIsland(string slotName, IslandSaveData data)
        {
            if (string.IsNullOrWhiteSpace(slotName))
                throw new ArgumentException("Slot name cannot be empty.", nameof(slotName));

            if (data == null)
                throw new ArgumentNullException(nameof(data));

            data.SaveSlotName = slotName;
            data.SaveVersion = CURRENT_VERSION;
            data.LastSaved = DateTime.UtcNow.ToString("O");

            string json = JsonUtility.ToJson(data, true);
            string key = GetSaveKey(slotName);

            PlayerPrefs.SetString(key, json);
            PlayerPrefs.Save();

            UpdateSaveSlotsList(slotName, add: true);
            Debug.Log($"[IslandSaveManager] Island saved to slot '{slotName}' ({json.Length} chars).");
        }

        /// <summary>
        /// Loads island data from a named save slot.
        /// </summary>
        /// <param name="slotName">The save slot name.</param>
        /// <returns>Deserialized <see cref="IslandSaveData"/>, or null if not found.</returns>
        public IslandSaveData LoadIsland(string slotName)
        {
            if (string.IsNullOrWhiteSpace(slotName))
            {
                Debug.LogWarning("[IslandSaveManager] Cannot load: slot name is empty.");
                return null;
            }

            string key = GetSaveKey(slotName);
            if (!PlayerPrefs.HasKey(key))
            {
                Debug.LogWarning($"[IslandSaveManager] No save found for slot '{slotName}'.");
                return null;
            }

            string json = PlayerPrefs.GetString(key);
            try
            {
                var data = JsonUtility.FromJson<IslandSaveData>(json);
                if (data == null)
                {
                    Debug.LogError($"[IslandSaveManager] Failed to deserialize save slot '{slotName}'.");
                    return null;
                }

                // Validate version
                if (string.IsNullOrEmpty(data.SaveVersion))
                    data.SaveVersion = "1.0";

                Debug.Log($"[IslandSaveManager] Island loaded from slot '{slotName}' (v{data.SaveVersion}).");
                return data;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[IslandSaveManager] Exception loading slot '{slotName}': {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// Permanently deletes a save slot and its data.
        /// </summary>
        /// <param name="slotName">The save slot to delete.</param>
        public void DeleteSave(string slotName)
        {
            if (string.IsNullOrWhiteSpace(slotName))
                return;

            string key = GetSaveKey(slotName);
            if (PlayerPrefs.HasKey(key))
            {
                PlayerPrefs.DeleteKey(key);
                PlayerPrefs.Save();
            }

            UpdateSaveSlotsList(slotName, add: false);
            Debug.Log($"[IslandSaveManager] Save slot '{slotName}' deleted.");
        }

        /// <summary>
        /// Returns a list of all existing save slot names.
        /// </summary>
        /// <returns>Ordered list of save slot names.</returns>
        public List<string> GetSaveSlots()
        {
            string slotsCsv = PlayerPrefs.GetString(SAVE_SLOTS_KEY, "");
            if (string.IsNullOrEmpty(slotsCsv))
                return new List<string>();

            var slots = new List<string>();
            foreach (var slot in slotsCsv.Split(','))
            {
                string trimmed = slot.Trim();
                if (!string.IsNullOrEmpty(trimmed))
                    slots.Add(trimmed);
            }

            return slots;
        }

        /// <summary>
        /// Checks if a save slot with the given name exists.
        /// </summary>
        /// <param name="slotName">The save slot name.</param>
        /// <returns>True if the slot exists.</returns>
        public bool HasSaveSlot(string slotName)
        {
            if (string.IsNullOrWhiteSpace(slotName))
                return false;

            return PlayerPrefs.HasKey(GetSaveKey(slotName));
        }

        /// <summary>
        /// Whether a new save slot can be created (under the max limit).
        /// </summary>
        /// <returns>True if below MAX_SAVE_SLOTS.</returns>
        public bool CanCreateNewSave()
        {
            return GetSaveSlots().Count < MAX_SAVE_SLOTS;
        }

        /// <summary>
        /// Exports a save slot to a JSON file on disk.
        /// </summary>
        /// <param name="slotName">The save slot to export.</param>
        /// <param name="filePath">Absolute file path to write JSON to.</param>
        public void ExportToJson(string slotName, string filePath)
        {
            var data = LoadIsland(slotName);
            if (data == null)
            {
                Debug.LogWarning($"[IslandSaveManager] Cannot export: slot '{slotName}' not found.");
                return;
            }

            try
            {
                string json = JsonUtility.ToJson(data, true);
                File.WriteAllText(filePath, json);
                Debug.Log($"[IslandSaveManager] Exported slot '{slotName}' to {filePath}");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[IslandSaveManager] Export failed: {ex.Message}");
            }
        }

        /// <summary>
        /// Imports island data from a JSON string.
        /// </summary>
        /// <param name="json">JSON string containing serialized IslandSaveData.</param>
        /// <returns>Deserialized IslandSaveData, or null on failure.</returns>
        public IslandSaveData ImportFromJson(string json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                Debug.LogWarning("[IslandSaveManager] Cannot import empty JSON.");
                return null;
            }

            try
            {
                var data = JsonUtility.FromJson<IslandSaveData>(json);
                if (data == null)
                {
                    Debug.LogError("[IslandSaveManager] Failed to deserialize imported JSON.");
                    return null;
                }

                // Ensure lists are initialized (JsonUtility may leave them null)
                data.GroundTiles ??= new List<TileSaveData>();
                data.DecorationTiles ??= new List<TileSaveData>();
                data.Objects ??= new List<PlacedObjectData>();
                data.Settings ??= new IslandSettingsData();

                Debug.Log($"[IslandSaveManager] Imported save '{data.SaveSlotName}' (v{data.SaveVersion}).");
                return data;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[IslandSaveManager] Import failed: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// Stub for uploading a save slot to cloud storage (e.g., PlayFab, Unity Cloud Save).
        /// Implement platform-specific cloud save logic here.
        /// </summary>
        /// <param name="slotName">The save slot to upload.</param>
        public void CloudSave(string slotName)
        {
            var data = LoadIsland(slotName);
            if (data == null)
            {
                Debug.LogWarning($"[IslandSaveManager] Cloud save failed: slot '{slotName}' not found locally.");
                return;
            }

            string json = JsonUtility.ToJson(data);
            Debug.Log($"[IslandSaveManager] Cloud save stub: would upload {json.Length} bytes for slot '{slotName}'.");
            // TODO: Integrate PlayFab / Unity Cloud Save / custom backend
        }

        /// <summary>
        /// Stub for downloading a save slot from cloud storage.
        /// Implement platform-specific cloud load logic here.
        /// </summary>
        /// <param name="slotName">The save slot to download.</param>
        public void CloudLoad(string slotName)
        {
            Debug.Log($"[IslandSaveManager] Cloud load stub: would download slot '{slotName}' from cloud.");
            // TODO: Integrate PlayFab / Unity Cloud Save / custom backend
            // On success: deserialize and call SaveIsland(slotName, data) to cache locally
        }

        /// <summary>
        /// Constructs the PlayerPrefs key for a given save slot.
        /// </summary>
        private string GetSaveKey(string slotName)
        {
            return SAVE_PREFIX + slotName;
        }

        /// <summary>
        /// Maintains the comma-separated save slot registry in PlayerPrefs.
        /// </summary>
        /// <param name="slotName">Slot to add or remove.</param>
        /// <param name="add">True to add, false to remove.</param>
        private void UpdateSaveSlotsList(string slotName, bool add)
        {
            var slots = GetSaveSlots();

            if (add)
            {
                if (!slots.Contains(slotName))
                    slots.Add(slotName);
            }
            else
            {
                slots.Remove(slotName);
            }

            PlayerPrefs.SetString(SAVE_SLOTS_KEY, string.Join(",", slots));
            PlayerPrefs.Save();
        }
    }
}
