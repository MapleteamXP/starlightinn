// -----------------------------------------------------------------------
// InventoryGridUI.cs
// Grid-based inventory user interface with drag-and-drop, tooltips,
// filtering, sorting, and context menus.  Works with InventoryManager.
// -----------------------------------------------------------------------

using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace KawaiiCool.Inventory
{
    /// <summary>
    /// Visual cell inside the inventory grid.  Can hold one InventoryItem.
    /// </summary>
    public class InventoryCell : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler
    {
        [Header("Visual")]
        public Image Background;
        public Image ItemIcon;
        public Image RarityBorder;
        public TMP_Text QuantityText;
        public GameObject EquippedIndicator;
        public GameObject FavoriteIndicator;
        public Button CellButton;

        /// <summary>Index of this cell within the grid (left-to-right, top-to-bottom).</summary>
        public int CellIndex { get; set; }

        /// <summary>The item currently occupying this cell.</summary>
        public InventoryItem CurrentItem { get; private set; }

        /// <summary>True when no item is assigned.</summary>
        public bool IsEmpty => CurrentItem == null;

        private Color _defaultBackgroundColor;

        private void Awake()
        {
            if (Background != null)
                _defaultBackgroundColor = Background.color;
        }

        /// <summary>
        /// Assigns an item to this cell and refreshes visuals.
        /// </summary>
        public void SetItem(InventoryItem item)
        {
            CurrentItem = item;
            RefreshVisuals();
        }

        /// <summary>
        /// Clears the cell so it appears empty.
        /// </summary>
        public void Clear()
        {
            CurrentItem = null;
            RefreshVisuals();
        }

        /// <summary>
        /// Temporarily tints the background for drag feedback.
        /// </summary>
        public void SetHighlight(bool highlight, Color color)
        {
            if (Background == null) return;
            Background.color = highlight ? color : _defaultBackgroundColor;
        }

        /// <summary>
        /// Shows or hides the equipped star icon.
        /// </summary>
        public void SetEquipped(bool equipped)
        {
            if (EquippedIndicator != null)
                EquippedIndicator.SetActive(equipped);
        }

        /// <summary>
        /// Refreshes all visual elements based on CurrentItem.
        /// </summary>
        private void RefreshVisuals()
        {
            if (CurrentItem == null || CurrentItem.Data == null)
            {
                if (ItemIcon != null) ItemIcon.sprite = null;
                if (ItemIcon != null) ItemIcon.enabled = false;
                if (RarityBorder != null) RarityBorder.enabled = false;
                if (QuantityText != null) QuantityText.text = "";
                if (EquippedIndicator != null) EquippedIndicator.SetActive(false);
                if (FavoriteIndicator != null) FavoriteIndicator.SetActive(false);
                return;
            }

            ItemData data = CurrentItem.Data;

            if (ItemIcon != null)
            {
                ItemIcon.sprite = data.Icon;
                ItemIcon.enabled = data.Icon != null;
            }

            if (RarityBorder != null)
            {
                RarityBorder.sprite = data.RarityBorder;
                RarityBorder.color = data.RarityColor;
                RarityBorder.enabled = true;
            }

            if (QuantityText != null)
            {
                QuantityText.text = CurrentItem.Quantity > 1
                    ? CurrentItem.Quantity.ToString("N0")
                    : "";
            }

            if (EquippedIndicator != null)
                EquippedIndicator.SetActive(CurrentItem.IsEquipped);

            if (FavoriteIndicator != null)
                FavoriteIndicator.SetActive(CurrentItem.IsFavorite);
        }

        public void OnPointerEnter(PointerEventData eventData)
        {
            // Handled by InventoryGridUI
        }

        public void OnPointerExit(PointerEventData eventData)
        {
            // Handled by InventoryGridUI
        }
    }

    // =====================================================================
    // InventoryGridUI
    // =====================================================================

    /// <summary>
    /// Main inventory grid controller.  Creates cells, handles drag-and-drop,
    /// filtering, sorting, search, tooltips, and context menus.
    /// </summary>
    public class InventoryGridUI : MonoBehaviour,
        IBeginDragHandler, IDragHandler, IEndDragHandler,
        IPointerClickHandler, IPointerEnterHandler, IPointerExitHandler
    {
        #region Inspector
        [Header("Grid")]
        [Tooltip("GridLayoutGroup that arranges the cell containers.")]
        public GridLayoutGroup GridLayout;

        [Tooltip("Parent transform for all cell GameObjects.")]
        public Transform CellContainer;

        [Tooltip("Prefab instantiated for each grid cell container.")]
        public GameObject CellPrefab;

        [Tooltip("Number of columns in the grid.")]
        public int Columns = 5;

        [Tooltip("Number of rows in the grid.")]
        public int Rows = 4;

        [Header("Item Display")]
        [Tooltip("Optional prefab for the visual slot inside each cell (can be same as CellPrefab).")]
        public GameObject ItemSlotPrefab;

        [Tooltip("Width/height of each cell in pixels.")]
        public float CellSize = 100f;

        [Tooltip("Spacing between cells in pixels.")]
        public float CellSpacing = 10f;

        [Header("Drag & Drop")]
        [Tooltip("Canvas that renders the drag proxy on top of everything.")]
        public Canvas DragCanvas;

        [Tooltip("RectTransform moved under the cursor while dragging.")]
        public RectTransform DragProxy;

        [Tooltip("Opacity of the drag proxy image.")]
        [Range(0.1f, 1f)]
        public float DragOpacity = 0.7f;

        [Tooltip("Color shown when hovering a valid drop target.")]
        public Color ValidDropColor = new Color(0.3f, 1f, 0.3f, 0.5f);

        [Tooltip("Color shown when hovering an invalid drop target.")]
        public Color InvalidDropColor = new Color(1f, 0.3f, 0.3f, 0.5f);

        [Header("Tooltip")]
        [Tooltip("Prefab for the hover tooltip panel.")]
        public GameObject TooltipPrefab;

        [Tooltip("Seconds the pointer must rest before the tooltip appears.")]
        public float TooltipDelay = 0.5f;

        [Header("Context Menu")]
        [Tooltip("Prefab for the right-click context menu.")]
        public GameObject ContextMenuPrefab;
        #endregion

        // ------------------------------------------------------------------
        // Runtime state
        // ------------------------------------------------------------------
        private readonly List<InventoryCell> _cells = new();
        private InventoryItem _draggedItem;
        private InventoryCell _dragStartCell;
        private InventoryCell _hoveredCell;
        private Coroutine _tooltipCoroutine;
        private ItemTooltip _activeTooltip;
        private GameObject _activeContextMenu;

        private ItemCategory? _currentCategoryFilter;
        private SortType _currentSort = SortType.Name;
        private string _currentSearch = "";

        // ------------------------------------------------------------------
        // Events
        // ------------------------------------------------------------------
        /// <summary>Fired when a cell is left-clicked.</summary>
        public event Action<InventoryItem> OnItemClicked;

        /// <summary>Fired when two items are swapped via drag-and-drop.</summary>
        public event Action<InventoryItem, InventoryItem> OnItemsSwapped;

        /// <summary>Fired when the user requests to use an item.</summary>
        public event Action<InventoryItem> OnItemUseRequested;

        /// <summary>Fired when the user requests to equip an item.</summary>
        public event Action<InventoryItem> OnItemEquipRequested;

        /// <summary>Fired when the user requests to delete an item.</summary>
        public event Action<InventoryItem> OnItemDeleteRequested;

        // ------------------------------------------------------------------
        // Lifecycle
        // ------------------------------------------------------------------
        private void Start()
        {
            if (InventoryManager.Instance != null)
            {
                InventoryManager.Instance.OnItemAdded += HandleItemChanged;
                InventoryManager.Instance.OnItemRemoved += HandleItemChanged;
                InventoryManager.Instance.OnItemEquipped += HandleItemEquipped;
                InventoryManager.Instance.OnItemUnequipped += HandleItemEquipped;
            }

            InitializeGrid(Columns, Rows);
        }

        private void OnDestroy()
        {
            if (InventoryManager.Instance != null)
            {
                InventoryManager.Instance.OnItemAdded -= HandleItemChanged;
                InventoryManager.Instance.OnItemRemoved -= HandleItemChanged;
                InventoryManager.Instance.OnItemEquipped -= HandleItemEquipped;
                InventoryManager.Instance.OnItemUnequipped -= HandleItemEquipped;
            }
        }

        // ------------------------------------------------------------------
        // Grid creation
        // ------------------------------------------------------------------

        /// <summary>
        /// (Re)creates the grid with the specified dimensions.
        /// </summary>
        public void InitializeGrid(int columns, int rows)
        {
            Columns = Mathf.Max(1, columns);
            Rows = Mathf.Max(1, rows);

            ClearGrid();
            ConfigureLayout();
            CreateCells();
            RefreshInventory();
        }

        private void ClearGrid()
        {
            foreach (var cell in _cells)
            {
                if (cell != null && cell.gameObject != null)
                    Destroy(cell.gameObject);
            }
            _cells.Clear();
        }

        private void ConfigureLayout()
        {
            if (GridLayout != null)
            {
                GridLayout.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
                GridLayout.constraintCount = Columns;
                GridLayout.cellSize = new Vector2(CellSize, CellSize);
                GridLayout.spacing = new Vector2(CellSpacing, CellSpacing);
            }
        }

        private void CreateCells()
        {
            int totalCells = Columns * Rows;
            for (int i = 0; i < totalCells; i++)
            {
                GameObject cellGO = Instantiate(CellPrefab, CellContainer);
                var cell = cellGO.GetComponent<InventoryCell>();
                if (cell == null)
                    cell = cellGO.AddComponent<InventoryCell>();

                cell.CellIndex = i;
                cell.Clear();

                int capturedIndex = i;
                if (cell.CellButton != null)
                {
                    cell.CellButton.onClick.AddListener(() => HandleCellClicked(capturedIndex));
                }

                _cells.Add(cell);
            }
        }

        // ------------------------------------------------------------------
        // Population
        // ------------------------------------------------------------------

        /// <summary>
        /// Refreshes the grid from InventoryManager, applying current filter/sort/search.
        /// </summary>
        public void RefreshInventory()
        {
            if (InventoryManager.Instance == null) return;

            List<InventoryItem> items = ApplyFilters(InventoryManager.Instance.GetAllItems());
            ApplySort(ref items);

            // Clear all cells first
            foreach (var cell in _cells)
                cell.Clear();

            // Populate
            int limit = Mathf.Min(items.Count, _cells.Count);
            for (int i = 0; i < limit; i++)
            {
                _cells[i].SetItem(items[i]);
            }
        }

        private List<InventoryItem> ApplyFilters(List<InventoryItem> items)
        {
            IEnumerable<InventoryItem> filtered = items;

            if (_currentCategoryFilter.HasValue)
                filtered = filtered.Where(i => i.Data != null && i.Data.Category == _currentCategoryFilter.Value);

            if (!string.IsNullOrWhiteSpace(_currentSearch))
            {
                string term = _currentSearch.ToLowerInvariant();
                filtered = filtered.Where(i =>
                    i.Data != null &&
                    ((i.Data.DisplayName?.ToLowerInvariant().Contains(term) ?? false) ||
                     i.ItemId.ToLowerInvariant().Contains(term) ||
                     i.Data.Description?.ToLowerInvariant().Contains(term) ?? false));
            }

            return filtered.ToList();
        }

        private void ApplySort(ref List<InventoryItem> items)
        {
            switch (_currentSort)
            {
                case SortType.Name:
                    items = items.OrderBy(i => i.Data?.DisplayName ?? i.ItemId).ToList();
                    break;
                case SortType.Rarity:
                    items = items.OrderByDescending(i => i.Data?.Rarity ?? ItemRarity.Common).ToList();
                    break;
                case SortType.Category:
                    items = items.OrderBy(i => i.Data?.Category.ToString() ?? "").ThenBy(i => i.Data?.DisplayName ?? "").ToList();
                    break;
                case SortType.DateAcquired:
                    items = items.OrderByDescending(i => i.AcquiredDate).ToList();
                    break;
            }
        }

        /// <summary>
        /// Adds a single item visually to the first empty cell (runtime helper).
        /// </summary>
        public void AddItemToGrid(InventoryItem item)
        {
            var emptyCell = _cells.FirstOrDefault(c => c.IsEmpty);
            emptyCell?.SetItem(item);
        }

        /// <summary>
        /// Removes an item from whichever cell holds it.
        /// </summary>
        public void RemoveItemFromGrid(InventoryItem item)
        {
            if (item == null) return;
            var cell = _cells.FirstOrDefault(c => c.CurrentItem == item);
            cell?.Clear();
        }

        // ------------------------------------------------------------------
        // Filtering / Sorting / Search
        // ------------------------------------------------------------------

        /// <summary>Sets the category filter.  Pass null to clear.</summary>
        public void SetFilter(ItemCategory? category)
        {
            _currentCategoryFilter = category;
            RefreshInventory();
        }

        /// <summary>Sets the sort order.</summary>
        public void SetSort(SortType sortType)
        {
            _currentSort = sortType;
            RefreshInventory();
        }

        /// <summary>Sets the search string.</summary>
        public void SetSearch(string searchTerm)
        {
            _currentSearch = searchTerm ?? "";
            RefreshInventory();
        }

        // ------------------------------------------------------------------
        // Drag & Drop (Unity UI interfaces)
        // ------------------------------------------------------------------

        /// <summary>Called by Unity when the user begins dragging.</summary>
        public void OnBeginDrag(PointerEventData eventData)
        {
            InventoryCell cell = GetCellUnderPointer(eventData);
            if (cell == null || cell.IsEmpty) return;

            _dragStartCell = cell;
            _draggedItem = cell.CurrentItem;

            StartDrag(cell);
        }

        /// <summary>Called every frame while dragging.</summary>
        public void OnDrag(PointerEventData eventData)
        {
            if (_draggedItem == null) return;

            UpdateDrag(eventData.position);

            // Highlight hovered cell
            var target = GetCellUnderPointer(eventData);
            if (target != _hoveredCell)
            {
                _hoveredCell?.SetHighlight(false, Color.clear);
                _hoveredCell = target;
            }

            if (_hoveredCell != null)
            {
                bool valid = IsValidDropTarget(_hoveredCell);
                _hoveredCell.SetHighlight(true, valid ? ValidDropColor : InvalidDropColor);
            }
        }

        /// <summary>Called when the drag ends.</summary>
        public void OnEndDrag(PointerEventData eventData)
        {
            if (_draggedItem == null) return;

            InventoryCell targetCell = GetCellUnderPointer(eventData);
            EndDrag(targetCell);

            _hoveredCell?.SetHighlight(false, Color.clear);
            _hoveredCell = null;
            _draggedItem = null;
            _dragStartCell = null;
        }

        // ------------------------------------------------------------------
        // Pointer handling
        // ------------------------------------------------------------------

        /// <summary>Left-click handling.</summary>
        public void OnPointerClick(PointerEventData eventData)
        {
            if (eventData.button == PointerEventData.InputButton.Right)
            {
                InventoryCell cell = GetCellUnderPointer(eventData);
                if (cell != null && !cell.IsEmpty)
                    ShowContextMenu(cell);
            }
        }

        /// <summary>Pointer enters the grid — starts tooltip timer.</summary>
        public void OnPointerEnter(PointerEventData eventData)
        {
            // Tooltip is handled per-cell via raycast
        }

        /// <summary>Pointer leaves the grid — hide tooltip.</summary>
        public void OnPointerExit(PointerEventData eventData)
        {
            HideTooltip();
        }

        // ------------------------------------------------------------------
        // Drag internals
        // ------------------------------------------------------------------

        private void StartDrag(InventoryCell cell)
        {
            if (DragProxy == null) return;

            DragProxy.gameObject.SetActive(true);
            var proxyImage = DragProxy.GetComponent<Image>();
            if (proxyImage != null && cell.CurrentItem?.Data?.Icon != null)
            {
                proxyImage.sprite = cell.CurrentItem.Data.Icon;
                Color c = proxyImage.color;
                c.a = DragOpacity;
                proxyImage.color = c;
            }

            // Dim the source cell
            if (cell.ItemIcon != null)
            {
                Color c = cell.ItemIcon.color;
                c.a = 0.4f;
                cell.ItemIcon.color = c;
            }

            // Move proxy to top canvas
            if (DragCanvas != null)
                DragProxy.SetParent(DragCanvas.transform, false);

            DragProxy.position = Input.mousePosition;
        }

        private void UpdateDrag(Vector2 screenPosition)
        {
            if (DragProxy != null)
                DragProxy.position = screenPosition;
        }

        private void EndDrag(InventoryCell targetCell)
        {
            // Restore source cell opacity
            if (_dragStartCell?.ItemIcon != null)
            {
                Color c = _dragStartCell.ItemIcon.color;
                c.a = 1f;
                _dragStartCell.ItemIcon.color = c;
            }

            // Hide proxy
            if (DragProxy != null)
                DragProxy.gameObject.SetActive(false);

            // Return proxy to original parent
            if (CellContainer != null && DragProxy != null)
                DragProxy.SetParent(CellContainer, false);

            if (targetCell == null || targetCell == _dragStartCell)
                return;

            if (!IsValidDropTarget(targetCell))
                return;

            // Swap logic
            var otherItem = targetCell.CurrentItem;

            if (otherItem != null)
            {
                // Swap
                targetCell.SetItem(_draggedItem);
                _dragStartCell.SetItem(otherItem);
                OnItemsSwapped?.Invoke(_draggedItem, otherItem);
            }
            else
            {
                // Move to empty cell
                targetCell.SetItem(_draggedItem);
                _dragStartCell.Clear();
            }
        }

        private bool IsValidDropTarget(InventoryCell cell)
        {
            if (cell == null || cell == _dragStartCell) return false;
            if (cell.IsEmpty) return true;

            // Could add size checks, category restrictions, etc.
            return true;
        }

        // ------------------------------------------------------------------
        // Tooltip
        // ------------------------------------------------------------------

        private void ShowTooltip(InventoryCell cell)
        {
            if (TooltipPrefab == null || cell?.CurrentItem?.Data == null) return;

            if (_activeTooltip == null)
            {
                GameObject tooltipGO = Instantiate(TooltipPrefab, DragCanvas != null ? DragCanvas.transform : transform.root);
                _activeTooltip = tooltipGO.GetComponent<ItemTooltip>();
            }

            Vector2 pos = Input.mousePosition;
            _activeTooltip.Show(cell.CurrentItem.Data, pos);
        }

        private void HideTooltip()
        {
            _tooltipCoroutine = null;
            _activeTooltip?.Hide();
        }

        // ------------------------------------------------------------------
        // Context Menu
        // ------------------------------------------------------------------

        private void ShowContextMenu(InventoryCell cell)
        {
            if (ContextMenuPrefab == null || cell?.CurrentItem == null) return;

            HideContextMenu();

            GameObject menuGO = Instantiate(ContextMenuPrefab, DragCanvas != null ? DragCanvas.transform : transform.root);
            _activeContextMenu = menuGO;

            // Position near cell
            RectTransform rt = menuGO.GetComponent<RectTransform>();
            if (rt != null)
                rt.position = Input.mousePosition;

            // Populate buttons — assumes a ContextMenuUI component on the prefab
            var ctx = menuGO.GetComponent<ContextMenuUI>();
            if (ctx != null)
            {
                var item = cell.CurrentItem;
                ctx.Clear();

                if (item.Data.IsUsable || item.Data.IsConsumable)
                    ctx.AddButton("Use", () => { OnItemUseRequested?.Invoke(item); HideContextMenu(); });

                if (item.Data.IsEquippable)
                {
                    if (item.IsEquipped)
                        ctx.AddButton("Unequip", () => { InventoryManager.Instance.UnequipItem(item.ItemId); HideContextMenu(); });
                    else
                        ctx.AddButton("Equip", () => { OnItemEquipRequested?.Invoke(item); HideContextMenu(); });
                }

                ctx.AddButton("Favorite", () =>
                {
                    InventoryManager.Instance.ToggleFavorite(item.ItemId);
                    cell.SetItem(item); // refresh star
                    HideContextMenu();
                });

                ctx.AddButton("Delete", () => { OnItemDeleteRequested?.Invoke(item); HideContextMenu(); });
            }
        }

        private void HideContextMenu()
        {
            if (_activeContextMenu != null)
            {
                Destroy(_activeContextMenu);
                _activeContextMenu = null;
            }
        }

        // ------------------------------------------------------------------
        // Helpers
        // ------------------------------------------------------------------

        private InventoryCell GetCellUnderPointer(PointerEventData eventData)
        {
            return GetCellAtPosition(eventData.position);
        }

        private InventoryCell GetCellAtPosition(Vector2 screenPosition)
        {
            PointerEventData pointer = new PointerEventData(EventSystem.current)
            {
                position = screenPosition
            };

            List<RaycastResult> results = new();
            EventSystem.current.RaycastAll(pointer, results);

            foreach (var result in results)
            {
                var cell = result.gameObject.GetComponentInParent<InventoryCell>();
                if (cell != null)
                    return cell;
            }

            return null;
        }

        private void HandleCellClicked(int index)
        {
            if (index < 0 || index >= _cells.Count) return;
            var cell = _cells[index];
            if (cell?.CurrentItem != null)
                OnItemClicked?.Invoke(cell.CurrentItem);
        }

        private void HandleItemChanged(string itemId, int quantity)
        {
            RefreshInventory();
        }

        private void HandleItemEquipped(string itemId)
        {
            RefreshInventory();
        }

        private void Update()
        {
            // Tooltip hover detection
            if (_tooltipCoroutine == null && _activeTooltip == null)
            {
                var cell = GetCellAtPosition(Input.mousePosition);
                if (cell != null && !cell.IsEmpty)
                    _tooltipCoroutine = StartCoroutine(TooltipDelayCoroutine(cell));
            }
            else if (_activeTooltip != null && _activeTooltip.gameObject.activeInHierarchy)
            {
                _activeTooltip.UpdatePosition(Input.mousePosition);

                // Hide if no longer hovering the same cell
                var cell = GetCellAtPosition(Input.mousePosition);
                if (cell == null || cell.IsEmpty)
                    HideTooltip();
            }

            // Dismiss context menu on click elsewhere
            if (_activeContextMenu != null && Input.GetMouseButtonDown(0))
            {
                var cell = GetCellAtPosition(Input.mousePosition);
                if (cell == null)
                    HideContextMenu();
            }
        }

        private IEnumerator TooltipDelayCoroutine(InventoryCell cell)
        {
            yield return new WaitForSeconds(TooltipDelay);

            // Verify still hovering
            var current = GetCellAtPosition(Input.mousePosition);
            if (current == cell && !cell.IsEmpty)
                ShowTooltip(cell);

            _tooltipCoroutine = null;
        }
    }

    // =====================================================================
    // Simple context menu helper (assumes buttons are children of the prefab)
    // =====================================================================

    /// <summary>
    /// Simple context menu UI that dynamically adds buttons at runtime.
    /// </summary>
    public class ContextMenuUI : MonoBehaviour
    {
        [Tooltip("Prefab for a single context-menu button.")]
        public GameObject ButtonPrefab;

        [Tooltip("Parent transform for the buttons.")]
        public Transform ButtonContainer;

        private readonly List<GameObject> _spawned = new();

        /// <summary>Clears all existing buttons.</summary>
        public void Clear()
        {
            foreach (var btn in _spawned)
            {
                if (btn != null) Destroy(btn);
            }
            _spawned.Clear();
        }

        /// <summary>Adds a labeled button that invokes the given callback.</summary>
        public void AddButton(string label, Action onClick)
        {
            if (ButtonPrefab == null) return;

            GameObject go = Instantiate(ButtonPrefab, ButtonContainer);
            var txt = go.GetComponentInChildren<TMP_Text>();
            if (txt != null) txt.text = label;

            var btn = go.GetComponent<Button>();
            if (btn != null)
                btn.onClick.AddListener(() => onClick?.Invoke());

            _spawned.Add(go);
        }

        private void OnDisable()
        {
            Clear();
        }
    }
}
