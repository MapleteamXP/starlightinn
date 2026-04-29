using System;
using UnityEngine;
using UnityEngine.EventSystems;

namespace KawaiiCoolIsland.Interaction
{
    /// <summary>
    /// Raycast-based player selector that works with both mouse and touch input.
    /// Manages selection state, visual indicators, and broadcasts selection events.
    /// </summary>
    public class PlayerSelector : MonoBehaviour
    {
        #region Inspector — Selection

        [Header("Selection")]
        [Tooltip("Camera used for screen-point-to-ray conversion. Defaults to Camera.main if unassigned.")]
        public Camera GameCamera;

        [Tooltip("LayerMask for detecting player avatars via raycast.")]
        public LayerMask PlayerLayer;

        [Tooltip("Maximum raycast distance for selecting a player.")]
        public float MaxSelectionDistance = 50f;

        #endregion

        #region Inspector — Feedback

        [Header("Feedback")]
        [Tooltip("Prefab instantiated at the selected player's position to show selection.")]
        public GameObject SelectionIndicatorPrefab;

        [Tooltip("Vertical offset (world units) applied to the indicator above the player's feet.")]
        public float IndicatorOffset = 1.5f;

        #endregion

        #region Private State

        private PlayerInteractable _selectedPlayer;
        private GameObject _activeIndicator;
        private bool _isMouseDragging;
        private Vector2 _mouseDownPosition;
        private const float DRAG_THRESHOLD_SQ = 900f; // 30 px squared

        // Touch tracking
        private int _trackedTouchId = -1;
        private Vector2 _touchDownPosition;
        private bool _isTouchSelecting;

        #endregion

        #region Public API

        /// <summary>
        /// Gets the currently selected <see cref="PlayerInteractable"/>, or null if none.
        /// </summary>
        public PlayerInteractable SelectedPlayer => _selectedPlayer;

        #endregion

        #region Events

        /// <summary>
        /// Invoked when a player is selected. Passes the selected <see cref="PlayerInteractable"/>.
        /// </summary>
        public event Action<PlayerInteractable> OnPlayerSelected;

        /// <summary>
        /// Invoked when the current selection is cleared.
        /// </summary>
        public event Action OnPlayerDeselected;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            if (GameCamera == null)
                GameCamera = Camera.main;

            if (GameCamera == null)
            {
                Debug.LogError($"[{nameof(PlayerSelector)}] No camera assigned and Camera.main is null.", this);
                enabled = false;
                return;
            }
        }

        private void Update()
        {
            HandleMouseSelection();
            HandleTouchSelection();
            UpdateIndicatorPosition();

            // Clear selection on Escape (desktop)
            if (Input.GetKeyDown(KeyCode.Escape))
            {
                DeselectPlayer();
            }
        }

        private void OnDisable()
        {
            DeselectPlayer();
        }

        #endregion

        #region Mouse Selection

        /// <summary>
        /// Handles mouse-based player selection including click vs drag detection.
        /// </summary>
        private void HandleMouseSelection()
        {
            if (Input.GetMouseButtonDown(0))
            {
                // Ignore clicks over UI
                if (EventSystem.current != null && EventSystem.current.IsPointerOverGameObject())
                    return;

                _isMouseDragging = false;
                _mouseDownPosition = Input.mousePosition;
            }

            if (Input.GetMouseButton(0))
            {
                float dragSq = ((Vector2)Input.mousePosition - _mouseDownPosition).sqrMagnitude;
                if (dragSq > DRAG_THRESHOLD_SQ)
                {
                    _isMouseDragging = true;
                }
            }

            if (Input.GetMouseButtonUp(0))
            {
                if (_isMouseDragging) return; // It was a drag, not a click

                // Ignore clicks over UI
                if (EventSystem.current != null && EventSystem.current.IsPointerOverGameObject())
                    return;

                Vector2 screenPos = Input.mousePosition;
                PlayerInteractable hitPlayer = GetPlayerAtScreenPosition(screenPos);

                if (hitPlayer != null)
                {
                    SelectPlayer(hitPlayer);
                }
                else
                {
                    // Clicked on empty space — deselect
                    DeselectPlayer();
                }

                _isMouseDragging = false;
            }
        }

        #endregion

        #region Touch Selection

        /// <summary>
        /// Handles touch-based player selection including tap vs drag detection.
        /// </summary>
        private void HandleTouchSelection()
        {
            if (Input.touchCount == 0) return;

            for (int i = 0; i < Input.touchCount; i++)
            {
                Touch touch = Input.GetTouch(i);

                switch (touch.phase)
                {
                    case TouchPhase.Began:
                        TryStartTouchSelection(touch);
                        break;

                    case TouchPhase.Moved:
                        UpdateTouchSelection(touch);
                        break;

                    case TouchPhase.Ended:
                        FinalizeTouchSelection(touch);
                        break;

                    case TouchPhase.Canceled:
                        CancelTouchSelection();
                        break;
                }
            }
        }

        /// <summary>
        /// Begins tracking a touch for potential player selection.
        /// </summary>
        private void TryStartTouchSelection(Touch touch)
        {
            if (EventSystem.current != null && EventSystem.current.IsPointerOverGameObject(touch.fingerId))
                return;

            _trackedTouchId = touch.fingerId;
            _touchDownPosition = touch.position;
            _isTouchSelecting = true;
        }

        /// <summary>
        /// Checks if the tracked touch has moved enough to count as a drag (cancelling selection).
        /// </summary>
        private void UpdateTouchSelection(Touch touch)
        {
            if (!_isTouchSelecting || touch.fingerId != _trackedTouchId) return;

            float dragSq = (touch.position - _touchDownPosition).sqrMagnitude;
            if (dragSq > DRAG_THRESHOLD_SQ)
            {
                _isTouchSelecting = false; // Drag — cancel selection
            }
        }

        /// <summary>
        /// Finalizes touch selection if it was a clean tap.
        /// </summary>
        private void FinalizeTouchSelection(Touch touch)
        {
            if (!_isTouchSelecting || touch.fingerId != _trackedTouchId) return;

            float dragSq = (touch.position - _touchDownPosition).sqrMagnitude;
            if (dragSq <= DRAG_THRESHOLD_SQ)
            {
                PlayerInteractable hitPlayer = GetPlayerAtScreenPosition(touch.position);
                if (hitPlayer != null)
                {
                    SelectPlayer(hitPlayer);
                }
                else
                {
                    DeselectPlayer();
                }
            }

            CancelTouchSelection();
        }

        /// <summary>
        /// Cancels the current touch tracking.
        /// </summary>
        private void CancelTouchSelection()
        {
            _isTouchSelecting = false;
            _trackedTouchId = -1;
        }

        #endregion

        #region Selection Management

        /// <summary>
        /// Selects the specified player, updating indicators and firing events.
        /// </summary>
        private void SelectPlayer(PlayerInteractable player)
        {
            if (player == null) return;
            if (player == _selectedPlayer) return; // Already selected
            if (!player.IsInteractable) return;

            // Deselect previous
            if (_selectedPlayer != null)
            {
                _selectedPlayer.ClearSelection();
            }

            _selectedPlayer = player;
            ShowIndicator(player);

            EventBus.Publish(EventBus.EventType.PlayerSelected, player);
            OnPlayerSelected?.Invoke(player);
        }

        /// <summary>
        /// Clears the current player selection, hiding indicators and firing events.
        /// </summary>
        private void DeselectPlayer()
        {
            if (_selectedPlayer != null)
            {
                _selectedPlayer.ClearSelection();
            }

            _selectedPlayer = null;
            HideIndicator();

            EventBus.Publish(EventBus.EventType.PlayerDeselected);
            OnPlayerDeselected?.Invoke();
        }

        /// <summary>
        /// Raycasts from the given screen position to find a <see cref="PlayerInteractable"/>.
        /// </summary>
        private PlayerInteractable GetPlayerAtScreenPosition(Vector2 screenPos)
        {
            if (GameCamera == null) return null;

            Ray ray = GameCamera.ScreenPointToRay(screenPos);
            if (Physics.Raycast(ray, out RaycastHit hit, MaxSelectionDistance, PlayerLayer))
            {
                PlayerInteractable interactable = hit.collider.GetComponent<PlayerInteractable>();
                if (interactable == null)
                {
                    // Try searching up the hierarchy in case collider is on a child
                    interactable = hit.collider.GetComponentInParent<PlayerInteractable>();
                }
                return interactable;
            }
            return null;
        }

        #endregion

        #region Indicator

        /// <summary>
        /// Instantiates and positions the selection indicator above the selected player.
        /// </summary>
        private void ShowIndicator(PlayerInteractable player)
        {
            if (player == null) return;

            HideIndicator(); // Destroy any existing indicator

            if (SelectionIndicatorPrefab != null)
            {
                _activeIndicator = Instantiate(SelectionIndicatorPrefab);
            }

            UpdateIndicatorPosition();
        }

        /// <summary>
        /// Destroys the active selection indicator.
        /// </summary>
        private void HideIndicator()
        {
            if (_activeIndicator != null)
            {
                Destroy(_activeIndicator);
                _activeIndicator = null;
            }
        }

        /// <summary>
        /// Keeps the selection indicator positioned above the selected player each frame.
        /// </summary>
        private void UpdateIndicatorPosition()
        {
            if (_activeIndicator == null || _selectedPlayer == null) return;

            Vector3 targetPos = _selectedPlayer.transform.position + Vector3.up * IndicatorOffset;
            _activeIndicator.transform.position = targetPos;

            // Billboard toward camera
            if (GameCamera != null)
            {
                _activeIndicator.transform.rotation = Quaternion.LookRotation(
                    _activeIndicator.transform.position - GameCamera.transform.position);
            }
        }

        #endregion
    }
}
