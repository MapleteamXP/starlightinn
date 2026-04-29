// ObjectDatabase.cs
// ScriptableObject database for all placeable objects in the game.
// Provides fast ID-based lookup and category/tag filtering.
// KawaiiCool Island - Island Editor System

using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KawaiiCool.IslandEditor
{
    /// <summary>
    /// ScriptableObject asset that serves as the central registry for all
    /// <see cref="PlaceableObject"/> prefabs available in the island editor.
    /// Create via Assets > Create > KawaiiCool > Object Database.
    /// </summary>
    [CreateAssetMenu(fileName = "ObjectDatabase", menuName = "KawaiiCool/Object Database")]
    public class ObjectDatabase : ScriptableObject
    {
        /// <summary>All placeable object prefabs registered in this database.</summary>
        public List<PlaceableObject> AllObjects = new();

        /// <summary>Runtime lookup cache mapping <see cref="PlaceableObject.ObjectId"/> to instances.</summary>
        private Dictionary<string, PlaceableObject> _lookup;

        /// <summary>
        /// Retrieves a <see cref="PlaceableObject"/> by its unique <paramref name="objectId"/>.
        /// Builds the lookup table on first access if needed.
        /// </summary>
        /// <param name="objectId">The unique object identifier.</param>
        /// <returns>The matching <see cref="PlaceableObject"/> or <c>null</c> if not found.</returns>
        public PlaceableObject GetObject(string objectId)
        {
            if (string.IsNullOrEmpty(objectId))
                return null;

            if (_lookup == null)
                BuildLookup();

            _lookup.TryGetValue(objectId, out var obj);
            return obj;
        }

        /// <summary>
        /// Returns all objects that belong to a specific category.
        /// Categories are defined by the object's <c>gameObject.tag</c> or name prefix convention.
        /// </summary>
        /// <param name="category">Category name to filter by.</param>
        /// <returns>List of matching objects; empty if none found.</returns>
        public List<PlaceableObject> GetObjectsByCategory(string category)
        {
            if (string.IsNullOrEmpty(category) || AllObjects == null)
                return new List<PlaceableObject>();

            return AllObjects.Where(obj => obj != null && obj.CompareTag(category)).ToList();
        }

        /// <summary>
        /// Returns all objects that have a specific Unity tag.
        /// </summary>
        /// <param name="tag">The Unity tag to search for.</param>
        /// <returns>List of matching objects; empty if none found.</returns>
        public List<PlaceableObject> GetObjectsByTag(string tag)
        {
            if (string.IsNullOrEmpty(tag) || AllObjects == null)
                return new List<PlaceableObject>();

            return AllObjects.Where(obj => obj != null && obj.CompareTag(tag)).ToList();
        }

        /// <summary>
        /// Performs a case-insensitive search across <see cref="PlaceableObject.DisplayName"/>
        /// and <see cref="PlaceableObject.ObjectId"/>.
        /// </summary>
        /// <param name="searchTerm">The search string.</param>
        /// <returns>List of objects whose name or ID contains the search term.</returns>
        public List<PlaceableObject> SearchObjects(string searchTerm)
        {
            if (string.IsNullOrEmpty(searchTerm) || AllObjects == null)
                return new List<PlaceableObject>();

            var term = searchTerm.ToLowerInvariant();
            return AllObjects.Where(obj =>
                obj != null && (
                    (!string.IsNullOrEmpty(obj.DisplayName) && obj.DisplayName.ToLowerInvariant().Contains(term)) ||
                    (!string.IsNullOrEmpty(obj.ObjectId) && obj.ObjectId.ToLowerInvariant().Contains(term))
                )
            ).ToList();
        }

        /// <summary>
        /// Rebuilds the internal ID-to-object lookup dictionary.
        /// Call this after modifying <see cref="AllObjects"/> at runtime.
        /// </summary>
        public void BuildLookup()
        {
            _lookup = new Dictionary<string, PlaceableObject>(StringComparer.Ordinal);
            if (AllObjects == null) return;

            foreach (var obj in AllObjects)
            {
                if (obj == null || string.IsNullOrEmpty(obj.ObjectId))
                    continue;

                if (!_lookup.ContainsKey(obj.ObjectId))
                    _lookup.Add(obj.ObjectId, obj);
                else
                    Debug.LogWarning($"[ObjectDatabase] Duplicate ObjectId '{obj.ObjectId}' detected. Ignoring duplicate.", obj);
            }
        }

        private void OnEnable()
        {
            BuildLookup();
        }
    }
}
