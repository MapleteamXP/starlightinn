// IslandEditor.cs
// Main island editor controller handling placement, manipulation, camera, and save/load.
// KawaiiCool Island - Island Editor System

using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Tilemaps;

namespace KawaiiCool.IslandEditor
{
    /// <summary>
    /// Current operational mode of the island editor.
    /// </summary>
    public enum EditorMode
    {
        /// <summary>Editor is inactive.</summary>
        None,
        /// <summary>Player is placing a new object from inventory.</summary>
        Placing,
        /// <summary>Player is manipulating existing placed objects.</summary>
        Editing
    }

    /// <summary>
    /// Central controller for the island editor. Handles object placement (grid and free),
    /// rotation, scaling, drag-and-drop manipulation, ghost previews, camera control,
    /// and delegates save/load to <see cref="IslandSaveManager"/>.
    /// </summary>
    public class IslandEditor : MonoBehaviour
    {
        [Header("Tilemaps")]
        /// <summary>Primary tilemap for ground terrain layers.</summary>
        public Tilemap GroundTilemap;

        /// <summary>Secondary tilemap for decoration overlays.</summary>
        public Tilemap DecorationTilemap;

        /// <summary>The Grid component both tilemaps belong to.</summary>
        public Grid WorldGrid;

        [Header("Containers")]
        /// <summary>Parent transform for all placed objects in the scene.</summary>
        public Transform ObjectsContainer;

        /// <summary>Parent transform for the ghost preview object.</summary>
        public Transform GhostContainer;

        [Header("Camera")]
        /// <summary>The camera used for editor viewport control.</summary>
        public Camera EditorCamera;

        /// <summary>Speed multiplier for camera panning via drag.</summary>
        public float CameraPanSpeed = 10f;

        /// <summary>Minimum orthographic camera size (zoomed in).</summary>
        public float CameraZoomMin = 3f;

        /// <summary>Maximum orthographic camera size (zoomed out).</summary>
        public float CameraZoomMax = 15f;

        /// <summary>Speed multiplier for scroll wheel zoom.</summary>
        public float CameraZoomSpeed = 5f;

        [Header("Settings")]
        /// <summary>Size of each grid cell in world units.</summary>
        public float CellSize = 1f;

        /// <summary>Whether new objects snap to the nearest grid cell center.</summary>
        public bool SnapToGrid = true;

        /// <summary>Layer mask for valid placement surface raycasting.</summary>
        public LayerMask PlacementLayer;

        /// <summary>Layer mask for detecting existing placed objects.</summary>
        public LayerMask ObjectLayer;

        [Header("Visual Feedback")]
        /// <summary>Color tint for the ghost when placement is valid.</summary>
        public Color ValidPlacementColor = new Color(0, 1, 0, 0.5f);

        /// <summary>Color tint for the ghost when placement is invalid.</summary>
        public Color InvalidPlacementColor = new Color(1, 0, 0, 0.5f);

        /// <summary>Alpha multiplier for ghost preview objects.</summary>
        public float GhostAlpha = 0.6f;

        [Header("References")]
        /// <summary>Database of all available placeable objects.</summary>
        public ObjectDatabase ObjectDatabase;

        /// <summary>Tilemap manager for painting and querying tiles.</summary>
        public TilemapManager TilemapManager;

        /// <summary>Save manager for persistence operations.</summary>
        public IslandSaveManager SaveManager;

        // --- State ---
        private PlaceableObject _selectedPrefab;
        private GameObject _ghostObject;
        private SpriteRenderer _ghostRenderer;
        private PlacedObject _hoveredObject;
        private bool _isDraggingObject;
        private Vector3 _dragOffset;
        private int _currentRotation;
        private float _currentScale = 1f;
        private bool _isPanningCamera;
        private Vector3 _lastMousePosition;
        private List<PlacedObject> _placedObjects = new();

        /// <summary>Current editor operational mode.</summary>
        public EditorMode CurrentMode { get; private set; }

        /// <summary>Raised when an object is successfully placed in the world.</summary>
        public event Action<PlacedObject> OnObjectPlaced;

        /// <summary>Raised when an object is removed from the world.</summary>
        public event Action<PlacedObject> OnObjectRemoved;

        /// <summary>Raised when the editor mode changes.</summary>
        public event Action OnEditorModeChanged;

        /// <summary>
        /// Whether an object is currently being dragged.
        /// </summary>
        public bool IsDraggingObject => _isDraggingObject;

        /// <summary>
        /// The prefab currently selected for placement (null if none).
        /// </summary>
        public PlaceableObject SelectedPrefab => _selectedPrefab;

        private void Awake()
        {
            // Auto-find references if not assigned
            if (EditorCamera == null)
                EditorCamera = Camera.main;

            if (WorldGrid == null && GroundTilemap != null)
                WorldGrid = GroundTilemap.layoutGrid;

            if (TilemapManager == null)
                TilemapManager = FindAnyObjectByType<TilemapManager>();

            if (SaveManager == null)
                SaveManager = FindAnyObjectByType<IslandSaveManager>();

            if (ObjectsContainer == null)
            {
                var go = new GameObject("PlacedObjects");
                ObjectsContainer = go.transform;
            }

            if (GhostContainer == null)
            {
                var go = new GameObject("GhostContainer");
                GhostContainer = go.transform;
            }

            CurrentMode = EditorMode.None;
        }

        private void Update()
        {
            if (CurrentMode == EditorMode.None)
                return;

            HandleCameraInput();

            if (CurrentMode == EditorMode.Placing && _selectedPrefab != null)
            {
                HandlePlacementInput();
                UpdateGhostPosition();
            }
            else if (CurrentMode == EditorMode.Editing)
            {
                HandleObjectManipulation();
            }
        }

        // ==================== PUBLIC API ====================

        /// <summary>
        /// Activates the editor, enabling placement and editing capabilities.
        /// </summary>
        public void EnterEditorMode()
        {
            CurrentMode = EditorMode.Editing;
            OnEditorModeChanged?.Invoke();
            Debug.Log("[IslandEditor] Entered editor mode.");
        }

        /// <summary>
        /// Deactivates the editor, discarding any active placement ghost.
        /// </summary>
        public void ExitEditorMode()
        {
            DeselectPrefab();
            CurrentMode = EditorMode.None;
            OnEditorModeChanged?.Invoke();
            Debug.Log("[IslandEditor] Exited editor mode.");
        }

        /// <summary>
        /// Selects a placeable object prefab from inventory for placement.
        /// Switches to <see cref="EditorMode.Placing"/> mode.
        /// </summary>
        /// <param name="prefab">The placeable object prefab to place.</param>
        public void SelectObject(PlaceableObject prefab)
        {
            if (prefab == null)
                return;

            _selectedPrefab = prefab;
            _currentRotation = 0;
            _currentScale = 1f;
            CurrentMode = EditorMode.Placing;

            DestroyGhost();
            CreateGhost();

            OnEditorModeChanged?.Invoke();
            Debug.Log($"[IslandEditor] Selected object: {prefab.DisplayName}");
        }

        /// <summary>
        /// Toggles grid snapping on or off.
        /// </summary>
        /// <param name="snap">True to snap to grid, false for free placement.</param>
        public void SetSnapToGrid(bool snap)
        {
            SnapToGrid = snap;
        }

        /// <summary>
        /// Rotates the selected prefab 90 degrees clockwise.
        /// </summary>
        public void RotateClockwise()
        {
            if (_selectedPrefab == null || !_selectedPrefab.CanRotate)
                return;

            _currentRotation = (_currentRotation + 1) % 4;
            UpdateGhostRotation();
        }

        /// <summary>
        /// Rotates the selected prefab 90 degrees counter-clockwise.
        /// </summary>
        public void RotateCounterClockwise()
        {
            if (_selectedPrefab == null || !_selectedPrefab.CanRotate)
                return;

            _currentRotation = (_currentRotation + 3) % 4;
            UpdateGhostRotation();
        }

        /// <summary>
        /// Sets the uniform scale for placement, clamped to the prefab's min/max bounds.
        /// </summary>
        /// <param name="scale">Desired scale factor.</param>
        public void SetScale(float scale)
        {
            if (_selectedPrefab == null || !_selectedPrefab.CanScale)
                return;

            float minScale = Mathf.Min(_selectedPrefab.MinScale.x, _selectedPrefab.MinScale.y);
            float maxScale = Mathf.Max(_selectedPrefab.MaxScale.x, _selectedPrefab.MaxScale.y);
            _currentScale = Mathf.Clamp(scale, minScale, maxScale);

            if (_ghostObject != null)
                _ghostObject.transform.localScale = Vector3.one * _currentScale;
        }

        /// <summary>
        /// Deletes the currently hovered object.
        /// </summary>
        public void DeleteHoveredObject()
        {
            if (_hoveredObject != null)
            {
                RemoveObject(_hoveredObject);
                _hoveredObject = null;
            }
        }

        /// <summary>
        /// Picks up an already-placed object back to the cursor for repositioning.
        /// </summary>
        /// <param name="obj">The placed object to pick up.</param>
        public void PickUpObject(PlacedObject obj)
        {
            if (obj == null || obj.Data == null)
                return;

            // Store current transform
            Vector3 pos = obj.transform.position;
            int rot = obj.RotationSteps;

            // Remove from placed list
            _placedObjects.Remove(obj);
            OnObjectRemoved?.Invoke(obj);

            // Destroy the old instance
            Destroy(obj.gameObject);

            // Select the prefab and restore transform
            _currentRotation = rot;
            _currentScale = obj.transform.localScale.x / (obj.Data.transform.localScale.x > 0 ? obj.Data.transform.localScale.x : 1f);
            SelectObject(obj.Data);

            // Position ghost at old location
            if (_ghostObject != null)
                _ghostObject.transform.position = pos;
        }

        /// <summary>
        /// Saves the current island layout to a named save slot.
        /// </summary>
        /// <param name="slotName">The save slot name.</param>
        public void SaveLayout(string slotName)
        {
            if (SaveManager == null)
            {
                Debug.LogError("[IslandEditor] SaveManager reference is missing.");
                return;
            }

            var saveData = new IslandSaveData
            {
                IslandName = slotName,
                GroundTiles = SerializeTiles("Ground"),
                DecorationTiles = SerializeTiles("Decoration"),
                Objects = SerializeObjects()
            };

            SaveManager.SaveIsland(slotName, saveData);
        }

        /// <summary>
        /// Loads an island layout from a named save slot.
        /// </summary>
        /// <param name="slotName">The save slot name.</param>
        public void LoadLayout(string slotName)
        {
            if (SaveManager == null)
            {
                Debug.LogError("[IslandEditor] SaveManager reference is missing.");
                return;
            }

            var data = SaveManager.LoadIsland(slotName);
            if (data == null)
                return;

            ClearIsland();
            DeserializeTiles(data.GroundTiles);
            DeserializeTiles(data.DecorationTiles);
            DeserializeObjects(data.Objects);

            Debug.Log($"[IslandEditor] Loaded layout '{slotName}' with {data.Objects.Count} objects.");
        }

        /// <summary>
        /// Clears all placed objects and tiles from the island.
        /// </summary>
        public void ClearIsland()
        {
            // Remove all placed objects
            foreach (var obj in _placedObjects)
            {
                if (obj != null)
                    Destroy(obj.gameObject);
            }
            _placedObjects.Clear();

            // Clear tilemaps
            TilemapManager?.ClearAllTiles();

            Debug.Log("[IslandEditor] Island cleared.");
        }

        /// <summary>
        /// Returns a list of all existing save slot names.
        /// </summary>
        /// <returns>List of save slot names.</returns>
        public List<string> GetSaveSlots()
        {
            return SaveManager != null ? SaveManager.GetSaveSlots() : new List<string>();
        }

        /// <summary>
        /// Checks if a save slot with the given name exists.
        /// </summary>
        /// <param name="slotName">The save slot name.</param>
        /// <returns>True if the slot exists.</returns>
        public bool HasSaveSlot(string slotName)
        {
            return SaveManager != null && SaveManager.HasSaveSlot(slotName);
        }

        /// <summary>
        /// Deletes a save slot and its associated data.
        /// </summary>
        /// <param name="slotName">The save slot to delete.</param>
        public void DeleteSaveSlot(string slotName)
        {
            SaveManager?.DeleteSave(slotName);
        }

        /// <summary>
        /// Returns all currently placed objects.
        /// </summary>
        /// <returns>List of placed object references.</returns>
        public IReadOnlyList<PlacedObject> GetPlacedObjects()
        {
            return _placedObjects;
        }

        // ==================== PRIVATE METHODS ====================

        /// <summary>
        /// Handles camera pan (middle/right mouse drag) and zoom (scroll wheel).
        /// </summary>
        private void HandleCameraInput()
        {
            if (EditorCamera == null)
                return;

            // Pan with middle mouse or right mouse drag
            if (Input.GetMouseButtonDown(2) || Input.GetMouseButtonDown(1))
            {
                _isPanningCamera = true;
                _lastMousePosition = Input.mousePosition;
            }

            if (Input.GetMouseButtonUp(2) || Input.GetMouseButtonUp(1))
            {
                _isPanningCamera = false;
            }

            if (_isPanningCamera)
            {
                Vector3 delta = Input.mousePosition - _lastMousePosition;
                Vector3 pan = new Vector3(-delta.x, -delta.y, 0) * CameraPanSpeed * Time.deltaTime * 0.05f;
                EditorCamera.transform.position += pan;
                _lastMousePosition = Input.mousePosition;
            }

            // Zoom with scroll wheel
            float scroll = Input.GetAxis("Mouse ScrollWheel");
            if (Mathf.Abs(scroll) > 0.001f)
            {
                EditorCamera.orthographicSize = Mathf.Clamp(
                    EditorCamera.orthographicSize - scroll * CameraZoomSpeed,
                    CameraZoomMin,
                    CameraZoomMax
                );
            }

            // Also handle pinch zoom on touch
            if (Input.touchCount == 2)
            {
                Touch t0 = Input.GetTouch(0);
                Touch t1 = Input.GetTouch(1);
                float prevDist = Vector2.Distance(t0.position - t0.deltaPosition, t1.position - t1.deltaPosition);
                float currDist = Vector2.Distance(t0.position, t1.position);
                float zoomDelta = (prevDist - currDist) * 0.01f * CameraZoomSpeed;
                EditorCamera.orthographicSize = Mathf.Clamp(
                    EditorCamera.orthographicSize + zoomDelta,
                    CameraZoomMin,
                    CameraZoomMax
                );
            }
        }

        /// <summary>
        /// Handles placement input: left click to place, right click to cancel.
        /// </summary>
        private void HandlePlacementInput()
        {
            // Right click cancels placement
            if (Input.GetMouseButtonDown(1))
            {
                DeselectPrefab();
                CurrentMode = EditorMode.Editing;
                OnEditorModeChanged?.Invoke();
                return;
            }

            // Left click places the object
            if (Input.GetMouseButtonDown(0) && !_isPanningCamera)
            {
                Vector3 mousePos = GetMouseWorldPosition();
                if (IsValidPlacement(mousePos))
                {
                    PlaceObject(mousePos);
                }
            }
        }

        /// <summary>
        /// Handles object selection, hovering, and drag-to-move in editing mode.
        /// </summary>
        private void HandleObjectManipulation()
        {
            Vector3 mouseWorld = GetMouseWorldPosition();

            // Raycast to find hovered object
            var hit = Physics2D.OverlapPoint(mouseWorld, ObjectLayer);

            if (!_isDraggingObject)
            {
                PlacedObject hitObj = hit != null ? hit.GetComponent<PlacedObject>() : null;

                // Clear previous hover
                if (_hoveredObject != null && _hoveredObject != hitObj)
                {
                    _hoveredObject.SetHighlight(false, Color.white);
                    _hoveredObject = null;
                }

                // Set new hover
                if (hitObj != null)
                {
                    _hoveredObject = hitObj;
                    _hoveredObject.SetHighlight(true, new Color(1, 1, 0, 0.3f));
                }

                // Start dragging
                if (Input.GetMouseButtonDown(0) && _hoveredObject != null && !Input.GetKey(KeyCode.LeftAlt))
                {
                    _isDraggingObject = true;
                    _dragOffset = _hoveredObject.transform.position - mouseWorld;
                    _hoveredObject.SetHighlight(true, new Color(0, 0.5f, 1, 0.4f));
                }

                // Delete on Delete key
                if (Input.GetKeyDown(KeyCode.Delete) && _hoveredObject != null)
                {
                    DeleteHoveredObject();
                }

                // Pick up on 'P' key
                if (Input.GetKeyDown(KeyCode.P) && _hoveredObject != null)
                {
                    PickUpObject(_hoveredObject);
                }
            }
            else
            {
                // Continue dragging
                if (Input.GetMouseButton(0))
                {
                    Vector3 targetPos = mouseWorld + _dragOffset;
                    if (SnapToGrid && _hoveredObject != null)
                    {
                        targetPos = GetSnappedPosition(targetPos);
                    }

                    if (_hoveredObject != null)
                        _hoveredObject.transform.position = targetPos;
                }

                // End drag
                if (Input.GetMouseButtonUp(0))
                {
                    _isDraggingObject = false;
                    if (_hoveredObject != null)
                    {
                        _hoveredObject.SetHighlight(true, new Color(1, 1, 0, 0.3f));
                        // Update Y-sort if applicable
                        if (_hoveredObject.Data != null && _hoveredObject.Data.UseYSort)
                        {
                            var sr = _hoveredObject.GetComponent<SpriteRenderer>();
                            if (sr != null)
                                sr.sortingOrder = Mathf.RoundToInt(_hoveredObject.transform.position.y * -100f);
                        }
                    }
                }
            }
        }

        /// <summary>
        /// Updates the ghost object's position to follow the mouse cursor.
        /// </summary>
        private void UpdateGhostPosition()
        {
            if (_ghostObject == null || _selectedPrefab == null)
                return;

            Vector3 mousePos = GetMouseWorldPosition();
            Vector3 targetPos = SnapToGrid ? GetSnappedPosition(mousePos) : mousePos;
            _ghostObject.transform.position = targetPos;

            // Validate and update color
            bool valid = IsValidPlacement(targetPos);
            if (_ghostRenderer != null)
            {
                _ghostRenderer.color = valid ? ValidPlacementColor : InvalidPlacementColor;
            }
        }

        /// <summary>
        /// Checks if placement at the given position is valid (no collisions, within bounds).
        /// </summary>
        /// <param name="position">World-space position to validate.</param>
        /// <returns>True if placement is allowed.</returns>
        private bool IsValidPlacement(Vector3 position)
        {
            if (_selectedPrefab == null)
                return false;

            Vector2Int size = _selectedPrefab.GetRotatedSize(_currentRotation);
            Vector2 halfSize = new Vector2(size.x * CellSize * _currentScale * 0.5f,
                                            size.y * CellSize * _currentScale * 0.5f);

            // Check for overlapping objects (unless stacking is allowed)
            if (!_selectedPrefab.CanStack)
            {
                Collider2D[] overlaps = Physics2D.OverlapBoxAll(
                    position + (Vector3)halfSize * 0.5f,
                    halfSize * 0.9f, // Slightly smaller to avoid edge-case overlaps
                    _currentRotation * 90f,
                    ObjectLayer
                );

                foreach (var overlap in overlaps)
                {
                    // Ignore the ghost object itself
                    if (overlap.gameObject == _ghostObject)
                        continue;

                    var placed = overlap.GetComponent<PlacedObject>();
                    if (placed != null && placed.Data != null && !placed.Data.CanStack)
                        return false;
                }
            }

            // Check placement layer
            Collider2D[] groundHits = Physics2D.OverlapPointAll(position, PlacementLayer);
            if (PlacementLayer != 0 && groundHits.Length == 0)
            {
                // No placement surface found under the object
                return false;
            }

            return true;
        }

        /// <summary>
        /// Instantiates the selected prefab at the given position.
        /// </summary>
        /// <param name="position">World-space position to place at.</param>
        private void PlaceObject(Vector3 position)
        {
            if (_selectedPrefab == null)
                return;

            Vector3 spawnPos = SnapToGrid ? GetSnappedPosition(position) : position;
            Quaternion spawnRot = Quaternion.Euler(0, 0, _currentRotation * 90f);

            var instance = Instantiate(_selectedPrefab, spawnPos, spawnRot, ObjectsContainer);
            instance.transform.localScale = Vector3.one * _currentScale;

            var placed = instance.gameObject.AddComponent<PlacedObject>();
            placed.Initialize(_selectedPrefab, spawnPos, _currentRotation, worldGrid: WorldGrid);

            _placedObjects.Add(placed);

            OnObjectPlaced?.Invoke(placed);
            Debug.Log($"[IslandEditor] Placed {_selectedPrefab.DisplayName} at {spawnPos}");

            // Optionally deselect after placement for one-at-a-time mode
            // DeselectPrefab();
        }

        /// <summary>
        /// Removes a placed object from the scene and tracking list.
        /// </summary>
        /// <param name="target">The placed object to remove.</param>
        private void RemoveObject(PlacedObject target)
        {
            if (target == null)
                return;

            _placedObjects.Remove(target);
            OnObjectRemoved?.Invoke(target);
            Destroy(target.gameObject);

            Debug.Log($"[IslandEditor] Removed object: {target.ObjectId}");
        }

        /// <summary>
        /// Creates a ghost preview object from the currently selected prefab.
        /// </summary>
        private void CreateGhost()
        {
            if (_selectedPrefab == null)
                return;

            _ghostObject = new GameObject($"Ghost_{_selectedPrefab.ObjectId}");
            _ghostObject.transform.SetParent(GhostContainer);

            _ghostRenderer = _ghostObject.AddComponent<SpriteRenderer>();
            _ghostRenderer.sprite = _selectedPrefab.PreviewSprite ?? _selectedPrefab.GetComponent<SpriteRenderer>()?.sprite;
            _ghostRenderer.color = ValidPlacementColor;
            _ghostRenderer.sortingOrder = 9999; // Always on top

            // Add a trigger collider for overlap detection if the prefab has one
            var prefabCollider = _selectedPrefab.GetComponent<Collider2D>();
            if (prefabCollider != null)
            {
                if (prefabCollider is BoxCollider2D box)
                {
                    var ghostBox = _ghostObject.AddComponent<BoxCollider2D>();
                    ghostBox.size = box.size;
                    ghostBox.offset = box.offset;
                    ghostBox.isTrigger = true;
                }
                else if (prefabCollider is CircleCollider2D circle)
                {
                    var ghostCircle = _ghostObject.AddComponent<CircleCollider2D>();
                    ghostCircle.radius = circle.radius;
                    ghostCircle.offset = circle.offset;
                    ghostCircle.isTrigger = true;
                }
            }

            _ghostObject.transform.localScale = Vector3.one * _currentScale;
            UpdateGhostRotation();
        }

        /// <summary>
        /// Destroys the current ghost preview object.
        /// </summary>
        private void DestroyGhost()
        {
            if (_ghostObject != null)
            {
                Destroy(_ghostObject);
                _ghostObject = null;
                _ghostRenderer = null;
            }
        }

        /// <summary>
        /// Deselects the current prefab and cleans up placement state.
        /// </summary>
        private void DeselectPrefab()
        {
            _selectedPrefab = null;
            _currentRotation = 0;
            _currentScale = 1f;
            DestroyGhost();
        }

        /// <summary>
        /// Updates the ghost object's rotation to match the current rotation steps.
        /// </summary>
        private void UpdateGhostRotation()
        {
            if (_ghostObject != null)
                _ghostObject.transform.rotation = Quaternion.Euler(0, 0, _currentRotation * 90f);
        }

        /// <summary>
        /// Snaps a world position to the nearest grid cell center.
        /// </summary>
        /// <param name="worldPos">Raw world position.</param>
        /// <returns>Snapped position at cell center.</returns>
        private Vector3 GetSnappedPosition(Vector3 worldPos)
        {
            if (WorldGrid != null)
            {
                Vector3Int cell = WorldGrid.WorldToCell(worldPos);
                return WorldGrid.GetCellCenterWorld(cell);
            }

            float x = Mathf.Floor(worldPos.x / CellSize) * CellSize + CellSize * 0.5f;
            float y = Mathf.Floor(worldPos.y / CellSize) * CellSize + CellSize * 0.5f;
            return new Vector3(x, y, worldPos.z);
        }

        /// <summary>
        /// Converts the current mouse screen position to world-space coordinates.
        /// </summary>
        /// <returns>World-space position on the XY plane at z=0.</returns>
        private Vector3 GetMouseWorldPosition()
        {
            if (EditorCamera == null)
                return Vector3.zero;

            Vector3 mouseScreen = Input.mousePosition;
            mouseScreen.z = EditorCamera.nearClipPlane + 10f;
            Vector3 worldPos = EditorCamera.ScreenToWorldPoint(mouseScreen);
            worldPos.z = 0;
            return worldPos;
        }

        // ==================== SERIALIZATION ====================

        /// <summary>
        /// Serializes all tiles from a named tilemap layer.
        /// </summary>
        /// <param name="tilemapName">"Ground" or "Decoration".</param>
        /// <returns>List of serialized tile data.</returns>
        private List<TileSaveData> SerializeTiles(string tilemapName)
        {
            var tiles = new List<TileSaveData>();
            if (TilemapManager == null)
                return tiles;

            Tilemap tilemap = tilemapName == "Ground" ? GroundTilemap : DecorationTilemap;
            if (tilemap == null)
                return tiles;

            tilemap.CompressBounds();
            foreach (var pos in tilemap.cellBounds.allPositionsWithin)
            {
                TileBase tile = tilemap.GetTile(pos);
                if (tile != null)
                {
                    tiles.Add(new TileSaveData
                    {
                        TileId = tile.name,
                        CellX = pos.x,
                        CellY = pos.y,
                        CellZ = pos.z,
                        TilemapName = tilemapName
                    });
                }
            }

            return tiles;
        }

        /// <summary>
        /// Serializes all placed objects.
        /// </summary>
        /// <returns>List of serialized object data.</returns>
        private List<PlacedObjectData> SerializeObjects()
        {
            var objects = new List<PlacedObjectData>();
            foreach (var obj in _placedObjects)
            {
                if (obj != null)
                    objects.Add(obj.Serialize());
            }
            return objects;
        }

        /// <summary>
        /// Restores tiles from serialized data onto the appropriate tilemap.
        /// </summary>
        private void DeserializeTiles(List<TileSaveData> tileData)
        {
            if (tileData == null || TilemapManager == null)
                return;

            foreach (var tile in tileData)
            {
                if (tile == null)
                    continue;

                var cellPos = new Vector3Int(tile.CellX, tile.CellY, tile.CellZ);
                var tileBase = TilemapManager.GetTileByName(tile.TileId);

                if (tileBase != null)
                {
                    TilemapManager.PaintTile(cellPos, tileBase, tile.TilemapName);
                }
                else
                {
                    Debug.LogWarning($"[IslandEditor] Tile '{tile.TileId}' not found in database. Skipping.");
                }
            }
        }

        /// <summary>
        /// Instantiates placed objects from serialized data.
        /// </summary>
        private void DeserializeObjects(List<PlacedObjectData> objectData)
        {
            if (objectData == null || ObjectDatabase == null)
                return;

            // Build lookup
            var lookup = new Dictionary<string, PlaceableObject>();
            foreach (var obj in ObjectDatabase.AllObjects)
            {
                if (obj != null && !string.IsNullOrEmpty(obj.ObjectId) && !lookup.ContainsKey(obj.ObjectId))
                    lookup.Add(obj.ObjectId, obj);
            }

            foreach (var data in objectData)
            {
                if (data == null)
                    continue;

                if (!lookup.TryGetValue(data.ObjectId, out var prefab))
                {
                    Debug.LogWarning($"[IslandEditor] Prefab '{data.ObjectId}' not found. Skipping object.");
                    continue;
                }

                var position = new Vector3(data.PosX, data.PosY, data.PosZ);
                var rotation = Quaternion.Euler(data.RotX, data.RotY, data.RotZ);
                var instance = Instantiate(prefab, position, rotation, ObjectsContainer);
                instance.transform.localScale = new Vector3(data.ScaleX, data.ScaleY, data.ScaleZ);

                var placed = instance.gameObject.AddComponent<PlacedObject>();
                placed.Initialize(prefab, position, Mathf.RoundToInt(data.RotZ / 90f), data.InstanceId, WorldGrid);
                placed.SetSortingOrder(data.SortingOrder);

                _placedObjects.Add(placed);
            }
        }
    }
}
