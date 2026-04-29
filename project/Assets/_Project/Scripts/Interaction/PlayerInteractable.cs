using System;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;

namespace KawaiiCoolIsland.Interaction
{
    /// <summary>
    /// Makes a player avatar clickable and tappable. Attach this to player prefabs
    /// to enable tap-to-interact, long-press, and hover feedback.
    /// </summary>
    [RequireComponent(typeof(AvatarController))]
    [HelpURL("https://docs.kawaiicoolisland.com/player-interactable")]
    public class PlayerInteractable : MonoBehaviour
    {
        #region Inspector — Interaction

        [Header("Interaction")]
        [Tooltip("Maximum distance from the local player for this target to be interactable.")]
        public float InteractionRange = 3f;

        [Tooltip("Duration (seconds) a press must be held to count as a long-press instead of a tap.")]
        public float TapHoldDuration = 0.3f;

        [Tooltip("LayerMask used when raycasting to detect this player.")]
        public LayerMask InteractableLayer;

        #endregion

        #region Inspector — Visual Feedback

        [Header("Visual Feedback")]
        [Tooltip("GameObject activated when this player is selected.")]
        public GameObject SelectionHighlight;

        [Tooltip("Name-tag GameObject shown above the player on hover / selection.")]
        public GameObject NameTagAbove;

        [Tooltip("TMP_Text inside the name-tag to display the player name.")]
        public TMP_Text NameTagText;

        [Tooltip("Online / busy / offline status dot GameObject.")]
        public GameObject StatusIndicator;

        #endregion

        #region Public Properties

        /// <summary>
        /// Unique identifier for this player (e.g. Photon UserId or backend GUID).
        /// </summary>
        public string PlayerId { get; set; }

        /// <summary>
        /// Human-readable display name shown in name-tags and menus.
        /// </summary>
        public string DisplayName { get; set; }

        /// <summary>
        /// True if this <see cref="PlayerInteractable"/> belongs to the local client.
        /// </summary>
        public bool IsLocalPlayer { get; set; }

        /// <summary>
        /// Whether this player can currently be interacted with.
        /// Set to false during loading, cutscenes, or when blocked.
        /// </summary>
        public bool IsInteractable { get; set; } = true;

        #endregion

        #region Events

        /// <summary>
        /// Invoked when the player is tapped (short press / click).
        /// </summary>
        public event Action OnPlayerTapped;

        /// <summary>
        /// Invoked when the player is long-pressed (held longer than <see cref="TapHoldDuration"/>).
        /// </summary>
        public event Action OnPlayerLongPressed;

        #endregion

        #region Private State

        private AvatarController _avatarController;
        private float _mouseDownTime;
        private bool _isMouseDown;
        private bool _isPointerOver;
        private bool _isHighlighted;
        private bool _isLongPressTriggered;

        // Touch tracking
        private int _trackedTouchId = -1;
        private float _touchDownTime;
        private Vector2 _touchDownPosition;
        private bool _isTouchDown;
        private bool _isTouchLongTriggered;
        private const float TOUCH_DRAG_THRESHOLD_SQ = 400f; // 20 px squared

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            _avatarController = GetComponent<AvatarController>();
            if (_avatarController == null)
            {
                Debug.LogError($"[{nameof(PlayerInteractable)}] Missing required AvatarController on {gameObject.name}", this);
                enabled = false;
                return;
            }

            // Hide feedback objects on startup
            SetHighlight(false);
            HideNameTag();

            if (StatusIndicator != null)
                StatusIndicator.SetActive(false);
        }

        private void OnEnable()
        {
            EventBus.Subscribe<PlayerInteractable>(EventBus.EventType.PlayerSelected, OnOtherPlayerSelected);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<PlayerInteractable>(EventBus.EventType.PlayerSelected, OnOtherPlayerSelected);
        }

        /// <summary>
        /// Handles per-frame touch input and long-press timing.
        /// </summary>
        private void Update()
        {
            if (!IsInteractable) return;

            HandleTouchInput();

            // Update highlight position to follow avatar
            if (_isHighlighted && SelectionHighlight != null)
            {
                SelectionHighlight.transform.position = transform.position + Vector3.up * 0.1f;
            }

            // Update name-tag position above avatar
            if (NameTagAbove != null && NameTagAbove.activeSelf)
            {
                PositionNameTagAboveAvatar();
            }
        }

        #endregion

        #region Mouse Input (Desktop)

        /// <summary>
        /// Called by Unity when the mouse button is pressed while over this collider.
        /// </summary>
        private void OnMouseDown()
        {
            if (!IsInteractable || IsLocalPlayer) return;
            if (EventSystem.current != null && EventSystem.current.IsPointerOverGameObject()) return;
            if (!IsInInteractionRange()) return;

            _isMouseDown = true;
            _mouseDownTime = Time.time;
            _isLongPressTriggered = false;
        }

        /// <summary>
        /// Called by Unity when the mouse button is released.
        /// </summary>
        private void OnMouseUp()
        {
            if (!_isMouseDown) return;
            _isMouseDown = false;

            if (_isLongPressTriggered) return; // Long-press already handled

            float heldDuration = Time.time - _mouseDownTime;
            if (heldDuration < TapHoldDuration)
            {
                HandleTap();
            }
            else
            {
                HandleLongPress();
            }
        }

        /// <summary>
        /// Called by Unity when the mouse pointer enters this collider.
        /// </summary>
        private void OnMouseEnter()
        {
            if (!IsInteractable) return;
            _isPointerOver = true;
            ShowNameTag();
            EventBus.Publish(EventBus.EventType.PlayerHoverEnter, this);
        }

        /// <summary>
        /// Called by Unity when the mouse pointer exits this collider.
        /// </summary>
        private void OnMouseExit()
        {
            _isPointerOver = false;
            if (!_isHighlighted)
            {
                HideNameTag();
            }
            EventBus.Publish(EventBus.EventType.PlayerHoverExit, this);
        }

        #endregion

        #region Touch Input (Mobile)

        /// <summary>
        /// Processes touch input for tap and long-press detection on mobile devices.
        /// </summary>
        private void HandleTouchInput()
        {
            if (Input.touchCount == 0) return;

            for (int i = 0; i < Input.touchCount; i++)
            {
                Touch touch = Input.GetTouch(i);

                switch (touch.phase)
                {
                    case TouchPhase.Began:
                        TryStartTouch(touch);
                        break;

                    case TouchPhase.Stationary:
                    case TouchPhase.Moved:
                        UpdateTouch(touch);
                        break;

                    case TouchPhase.Ended:
                    case TouchPhase.Canceled:
                        EndTouch(touch);
                        break;
                }
            }
        }

        /// <summary>
        /// Attempts to begin tracking a touch if it hits this player.
        /// </summary>
        private void TryStartTouch(Touch touch)
        {
            if (_isTouchDown) return; // Already tracking a touch
            if (IsLocalPlayer) return;
            if (EventSystem.current != null && EventSystem.current.IsPointerOverGameObject(touch.fingerId)) return;
            if (!IsInInteractionRange()) return;

            // Raycast from camera to see if we hit this object
            if (Camera.main == null) return;
            Ray ray = Camera.main.ScreenPointToRay(touch.position);
            if (Physics.Raycast(ray, out RaycastHit hit, 100f, InteractableLayer))
            {
                if (hit.transform == transform || hit.transform.IsChildOf(transform))
                {
                    _trackedTouchId = touch.fingerId;
                    _isTouchDown = true;
                    _touchDownTime = Time.time;
                    _touchDownPosition = touch.position;
                    _isTouchLongTriggered = false;
                }
            }
        }

        /// <summary>
        /// Checks if the tracked touch has been held long enough for a long-press.
        /// </summary>
        private void UpdateTouch(Touch touch)
        {
            if (!_isTouchDown || touch.fingerId != _trackedTouchId) return;
            if (_isTouchLongTriggered) return;

            // Check drag distance
            float dragSq = (touch.position - _touchDownPosition).sqrMagnitude;
            if (dragSq > TOUCH_DRAG_THRESHOLD_SQ)
            {
                CancelTouch();
                return;
            }

            float held = Time.time - _touchDownTime;
            if (held >= TapHoldDuration)
            {
                _isTouchLongTriggered = true;
                HandleLongPress();
            }
        }

        /// <summary>
        /// Finalizes touch input and determines tap vs long-press.
        /// </summary>
        private void EndTouch(Touch touch)
        {
            if (!_isTouchDown || touch.fingerId != _trackedTouchId) return;

            if (!_isTouchLongTriggered)
            {
                float held = Time.time - _touchDownTime;
                float dragSq = (touch.position - _touchDownPosition).sqrMagnitude;

                if (held < TapHoldDuration && dragSq <= TOUCH_DRAG_THRESHOLD_SQ)
                {
                    HandleTap();
                }
            }

            CancelTouch();
        }

        /// <summary>
        /// Cancels the current touch tracking without triggering any action.
        /// </summary>
        private void CancelTouch()
        {
            _isTouchDown = false;
            _trackedTouchId = -1;
            _isTouchLongTriggered = false;
        }

        #endregion

        #region Interaction Handlers

        /// <summary>
        /// Handles a short tap / click on this player.
        /// Publishes a selection event and shows the interaction menu.
        /// </summary>
        private void HandleTap()
        {
            if (!IsInteractable) return;

            EventBus.Publish(EventBus.EventType.PlayerSelected, this);
            EventBus.Publish(EventBus.EventType.ShowInteractionMenu,
                (PlayerId, DisplayName, (Vector2)Camera.main.WorldToScreenPoint(transform.position)));

            OnPlayerTapped?.Invoke();
            SetHighlight(true);
        }

        /// <summary>
        /// Handles a long-press on this player.
        /// Typically opens the profile directly for faster access.
        /// </summary>
        private void HandleLongPress()
        {
            if (!IsInteractable) return;

            EventBus.Publish(EventBus.EventType.PlayerLongPressed, this);
            EventBus.Publish(EventBus.EventType.ShowProfileViewer, PlayerId);

            OnPlayerLongPressed?.Invoke();
            SetHighlight(true);
        }

        #endregion

        #region Visual Feedback

        /// <summary>
        /// Activates the name-tag above the player and sets its text.
        /// </summary>
        private void ShowNameTag()
        {
            if (NameTagAbove == null) return;
            NameTagAbove.SetActive(true);
            if (NameTagText != null)
            {
                NameTagText.text = string.IsNullOrEmpty(DisplayName) ? "..." : DisplayName;
            }
            PositionNameTagAboveAvatar();
        }

        /// <summary>
        /// Hides the name-tag above the player.
        /// </summary>
        private void HideNameTag()
        {
            if (NameTagAbove == null) return;
            NameTagAbove.SetActive(false);
        }

        /// <summary>
        /// Positions the name-tag in world space above the avatar.
        /// </summary>
        private void PositionNameTagAboveAvatar()
        {
            if (NameTagAbove == null) return;
            // Billboard toward camera
            Vector3 worldPos = transform.position + Vector3.up * 1.8f;
            NameTagAbove.transform.position = worldPos;
            if (Camera.main != null)
            {
                NameTagAbove.transform.rotation = Quaternion.LookRotation(
                    NameTagAbove.transform.position - Camera.main.transform.position);
            }
        }

        /// <summary>
        /// Toggles the selection highlight around this player.
        /// </summary>
        /// <param name="active">True to show highlight, false to hide.</param>
        private void SetHighlight(bool active)
        {
            _isHighlighted = active;
            if (SelectionHighlight != null)
                SelectionHighlight.SetActive(active);

            if (active)
            {
                ShowNameTag();
                if (StatusIndicator != null)
                    StatusIndicator.SetActive(true);
            }
            else
            {
                if (!_isPointerOver)
                    HideNameTag();
            }
        }

        /// <summary>
        /// Called when another player is selected; clears our highlight if we are not the target.
        /// </summary>
        private void OnOtherPlayerSelected(PlayerInteractable other)
        {
            if (other != this)
            {
                SetHighlight(false);
            }
        }

        #endregion

        #region Range Check

        /// <summary>
        /// Returns true if the local player is within <see cref="InteractionRange"/>
        /// of this target in world-space.
        /// </summary>
        private bool IsInInteractionRange()
        {
            // For local player, always in range of themselves
            if (IsLocalPlayer) return true;

            GameObject localPlayer = GetLocalPlayerObject();
            if (localPlayer == null) return true; // Fallback: allow if no local player found

            float distance = Vector3.Distance(transform.position, localPlayer.transform.position);
            return distance <= InteractionRange;
        }

        /// <summary>
        /// Attempts to locate the local player's GameObject in the scene.
        /// </summary>
        private GameObject GetLocalPlayerObject()
        {
            // Search by tag or use the EventBus to query
            GameObject go = GameObject.FindGameObjectWithTag("LocalPlayer");
            return go;
        }

        #endregion

        #region Public API

        /// <summary>
        /// Programmatically simulates a tap on this player.
        /// </summary>
        public void SimulateTap()
        {
            HandleTap();
        }

        /// <summary>
        /// Programmatically simulates a long-press on this player.
        /// </summary>
        public void SimulateLongPress()
        {
            HandleLongPress();
        }

        /// <summary>
        /// Clears the selection highlight and name-tag.
        /// Call this when the interaction menu is dismissed.
        /// </summary>
        public void ClearSelection()
        {
            SetHighlight(false);
            _isMouseDown = false;
            CancelTouch();
        }

        /// <summary>
        /// Updates the online/offline status dot color.
        /// </summary>
        /// <param name="isOnline">True for online (green), false for offline (gray).</param>
        public void SetOnlineStatus(bool isOnline)
        {
            if (StatusIndicator == null) return;
            SpriteRenderer sr = StatusIndicator.GetComponent<SpriteRenderer>();
            if (sr != null)
            {
                sr.color = isOnline ? Color.green : Color.gray;
            }
        }

        #endregion
    }
}
