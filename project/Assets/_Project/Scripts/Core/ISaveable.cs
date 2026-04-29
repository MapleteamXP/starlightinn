// ----------------------------------------------------------------------------
// KawaiiCool Island - Core Framework
// ----------------------------------------------------------------------------
// ISaveable.cs - Interface for persistable game objects
// ----------------------------------------------------------------------------
// Any component or system that needs to persist data across sessions
// implements this interface. The SaveManager automatically discovers and
// manages all ISaveable objects through SaveAll() and LoadAll().
// ----------------------------------------------------------------------------

namespace KawaiiCoolIsland.Core
{
    /// <summary>
    /// Interface for objects that support JSON serialization through the SaveManager.
    /// Implement this on any MonoBehaviour or plain C# class that needs to persist data.
    /// </summary>
    public interface ISaveable
    {
        /// <summary>
        /// The unique key used to identify this object's save data in PlayerPrefs.
        /// Should be globally unique to prevent collisions.
        /// </summary>
        /// <example>"PlayerInventory", "IslandLayout_001", "QuestProgress_Daily"</example>
        string SaveKey { get; }

        /// <summary>
        /// Called by SaveManager during SaveAll(). The implementation should use
        /// <paramref name="saver"/>.Save() to write its serializable data object.
        /// </summary>
        /// <param name="saver">Reference to the SaveManager for performing the actual save.</param>
        void OnSave(SaveManager saver);

        /// <summary>
        /// Called by SaveManager during LoadAll(). The implementation should use
        /// <paramref name="saver"/>.Load() to retrieve its data and restore state.
        /// </summary>
        /// <param name="saver">Reference to the SaveManager for performing the actual load.</param>
        void OnLoad(SaveManager saver);
    }
}
