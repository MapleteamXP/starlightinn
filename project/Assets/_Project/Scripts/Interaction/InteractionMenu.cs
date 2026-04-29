using System;
using System.Collections.Generic;
using DG.Tweening;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace KawaiiCoolIsland.Interaction
{
    /// <summary>
    /// Defines a single action available in the interaction radial menu.
    /// </summary>
    [System.Serializable]
    public class InteractionAction
    {
        /// <summary>
        /// Unique identifier for this action (e.g. "view_profile", "add_friend").
        /// </summary>
        public string ActionId;

        /// <summary>
        /// Human-readable label shown on the menu button.
        /// </summary>
        public string DisplayName;

        /// <summary>
        /// Icon sprite displayed inside the menu button.
        /// </summary>
        public Sprite Icon;

        /// <summary>
        /// Tint color applied to the icon.
        /// </summary>
        public Color IconColor = Color.white;

        [Tooltip("If true, this action only appears when the target is already a friend.")]
        public bool RequiresFriendship;

        [Tooltip("If true, this action only appears when the target is in the same room.")]
        public bool RequiresSameRoom;

        [Tooltip("If true, the button is styled as destructive (red / warning tone).")]
        public bool IsDestructive;

        [Tooltip("Lower numbers appear first in the radial menu (clockwise from top).")]
        public int Order;
    }

    /// <summary>
    /// A radial / context menu that appears when tapping another player.
    /// Provides quick access to social actions like viewing profiles, adding friends,
    /// sending gifts, and more.
    /// </summary>
    public class InteractionMenu : MonoBehaviour
    {
        #region Inspector — Menu Items

        [Header("Menu Items")]
        [Tooltip("Parent transform that will contain all spawned menu buttons.")]
        public Transform MenuContainer;

        [Tooltip("Prefab instantiated for each menu button. Must contain an Image and TMP_Text.")]
        public GameObject MenuButtonPrefab;

        [Tooltip("Radius in pixels for the radial button layout.")]
        public float MenuRadius = 120f;

        [Tooltip("Duration of the expand / collapse animation in seconds.")]
        public float AppearDuration = 0.2f;

        [Tooltip("Angular spacing between buttons in degrees.")]
        public float ButtonSpacingDegrees = 45f;

        #endregion

        #region Inspector — Actions

        [Header("Actions")]
        [Tooltip("All possible actions. The menu filters these at runtime based on relationship state.")]
        public List<InteractionAction> AvailableActions = new();

        #endregion

        #region Private State

        private string _targetPlayerId;
        private string _targetPlayerName;
        private Vector2 _screenPosition;
        private readonly List<GameObject> _spawnedButtons = new();
        private bool _isShowing;
        private bool _isFriend;
        private bool _isSameRoom;
        private Tweener _showTween;
        private Tweener _hideTween;

        #endregion

        #region Events

        /// <summary>
        /// Invoked when any menu action is selected. Passes the <see cref="InteractionAction.ActionId"/>.
        /// </summary>
        public event Action<string> OnActionSelected;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            if (MenuContainer == null)
            {
                Debug.LogError($"[{nameof(InteractionMenu)}] MenuContainer is not assigned.", this);
                enabled = false;
                return;
            }

            // Hide on startup
            gameObject.SetActive(false);
        }

        private void OnEnable()
        {
            EventBus.Subscribe<(string, string, Vector2)>(EventBus.EventType.ShowInteractionMenu, OnShowRequested);
            EventBus.Subscribe(EventBus.EventType.PlayerDeselected, OnPlayerDeselected);
            EventBus.Subscribe<string>(EventBus.EventType.FriendshipStatusChanged, OnFriendshipStatusChanged);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<(string, string, Vector2)>(EventBus.EventType.ShowInteractionMenu, OnShowRequested);
            EventBus.Unsubscribe(EventBus.EventType.PlayerDeselected, OnPlayerDeselected);
            EventBus.Unsubscribe<string>(EventBus.EventType.FriendshipStatusChanged, OnFriendshipStatusChanged);
        }

        private void Update()
        {
            // Auto-hide if the target player moves off-screen or out of range
            if (_isShowing && !string.IsNullOrEmpty(_targetPlayerId))
            {
                // Optional: could add distance check here
            }

            // Close menu on Escape key (desktop)
            if (_isShowing && Input.GetKeyDown(KeyCode.Escape))
            {
                Hide();
            }
        }

        #endregion

        #region Show / Hide

        /// <summary>
        /// Displays the interaction menu for the specified target player.
        /// </summary>
        /// <param name="targetPlayerId">Unique ID of the player being interacted with.</param>
        /// <param name="targetPlayerName">Display name of the target player.</param>
        /// <param name="screenPosition">Screen-space position to center the radial menu around.</param>
        public void Show(string targetPlayerId, string targetPlayerName, Vector2 screenPosition)
        {
            if (_isShowing) Hide();

            _targetPlayerId = targetPlayerId;
            _targetPlayerName = targetPlayerName;
            _screenPosition = screenPosition;

            // Query relationship state
            _isFriend = CheckIsFriend(targetPlayerId);
            _isSameRoom = CheckIsSameRoom(targetPlayerId);

            gameObject.SetActive(true);
            _isShowing = true;

            // Position container at screen point
            if (MenuContainer is RectTransform rect)
            {
                rect.anchoredPosition = screenPosition;
            }

            RefreshActions();
            CreateMenuButtons();
            PositionButtonsInCircle();
            AnimateShow();

            EventBus.Publish(EventBus.EventType.InteractionMenuShown, targetPlayerId);
        }

        /// <summary>
        /// Hides and destroys the interaction menu.
        /// </summary>
        public void Hide()
        {
            if (!_isShowing) return;
            _isShowing = false;

            AnimateHide(() =>
            {
                ClearSpawnedButtons();
                gameObject.SetActive(false);
            });

            EventBus.Publish(EventBus.EventType.InteractionMenuHidden, _targetPlayerId);
            _targetPlayerId = null;
            _targetPlayerName = null;
        }

        /// <summary>
        /// Re-evaluates which actions should be visible based on current friendship and room state.
        /// </summary>
        public void RefreshActions()
        {
            _isFriend = CheckIsFriend(_targetPlayerId);
            _isSameRoom = CheckIsSameRoom(_targetPlayerId);

            // Refresh existing buttons
            foreach (var btn in _spawnedButtons)
            {
                if (btn == null) continue;
                // Re-apply visibility by checking the attached action data
                // This is a simplified implementation; full refresh would re-build
            }
        }

        #endregion

        #region Default Action Handlers

        /// <summary>
        /// Opens the profile viewer for the target player.
        /// </summary>
        private void OnViewProfile()
        {
            if (string.IsNullOrEmpty(_targetPlayerId)) return;
            EventBus.Publish(EventBus.EventType.ShowProfileViewer, _targetPlayerId);
            OnActionSelected?.Invoke("view_profile");
            Hide();
        }

        /// <summary>
        /// Sends a friend request to the target player.
        /// </summary>
        private void OnAddFriend()
        {
            if (string.IsNullOrEmpty(_targetPlayerId)) return;
            EventBus.Publish(EventBus.EventType.SendFriendRequest, _targetPlayerId);
            OnActionSelected?.Invoke("add_friend");
            Hide();
        }

        /// <summary>
        /// Opens a private whisper chat with the target player.
        /// </summary>
        private void OnSendWhisper()
        {
            if (string.IsNullOrEmpty(_targetPlayerId)) return;
            EventBus.Publish(EventBus.EventType.OpenWhisperChat, (_targetPlayerId, _targetPlayerName));
            OnActionSelected?.Invoke("send_whisper");
            Hide();
        }

        /// <summary>
        /// Opens the gift-sending UI for the target player.
        /// </summary>
        private void OnSendGift()
        {
            if (string.IsNullOrEmpty(_targetPlayerId)) return;
            EventBus.Publish(EventBus.EventType.OpenGiftDialog, _targetPlayerId);
            OnActionSelected?.Invoke("send_gift");
            Hide();
        }

        /// <summary>
        /// Sends a room invitation to the target player.
        /// </summary>
        private void OnInviteToRoom()
        {
            if (string.IsNullOrEmpty(_targetPlayerId)) return;
            EventBus.Publish(EventBus.EventType.InviteToRoom, _targetPlayerId);
            OnActionSelected?.Invoke("invite_room");
            Hide();
        }

        /// <summary>
        /// Invites the target player to join the local player's party.
        /// </summary>
        private void OnInviteToParty()
        {
            if (string.IsNullOrEmpty(_targetPlayerId)) return;
            EventBus.Publish(EventBus.EventType.InviteToParty, _targetPlayerId);
            OnActionSelected?.Invoke("invite_party");
            Hide();
        }

        /// <summary>
        /// Initiates a trade request with the target player.
        /// </summary>
        private void OnTrade()
        {
            if (string.IsNullOrEmpty(_targetPlayerId)) return;
            EventBus.Publish(EventBus.EventType.RequestTrade, _targetPlayerId);
            OnActionSelected?.Invoke("trade");
            Hide();
        }

        /// <summary>
        /// Opens the report dialog for the target player.
        /// </summary>
        private void OnReport()
        {
            if (string.IsNullOrEmpty(_targetPlayerId)) return;
            EventBus.Publish(EventBus.EventType.OpenReportDialog, _targetPlayerId);
            OnActionSelected?.Invoke("report");
            Hide();
        }

        /// <summary>
        /// Blocks the target player.
        /// </summary>
        private void OnBlock()
        {
            if (string.IsNullOrEmpty(_targetPlayerId)) return;
            EventBus.Publish(EventBus.EventType.BlockPlayer, _targetPlayerId);
            OnActionSelected?.Invoke("block");
            Hide();
        }

        /// <summary>
        /// Follows the target player.
        /// </summary>
        private void OnFollow()
        {
            if (string.IsNullOrEmpty(_targetPlayerId)) return;
            EventBus.Publish(EventBus.EventType.FollowPlayer, _targetPlayerId);
            OnActionSelected?.Invoke("follow");
            Hide();
        }

        /// <summary>
        /// Sends a wave emote toward the target player.
        /// </summary>
        private void OnWave()
        {
            if (string.IsNullOrEmpty(_targetPlayerId)) return;
            EventBus.Publish(EventBus.EventType.PlayEmote, ("wave", _targetPlayerId));
            OnActionSelected?.Invoke("wave");
            Hide();
        }

        /// <summary>
        /// Sends a hug emote toward the target player.
        /// </summary>
        private void OnHug()
        {
            if (string.IsNullOrEmpty(_targetPlayerId)) return;
            EventBus.Publish(EventBus.EventType.PlayEmote, ("hug", _targetPlayerId));
            OnActionSelected?.Invoke("hug");
            Hide();
        }

        /// <summary>
        /// Sends a dance-together request to the target player.
        /// </summary>
        private void OnDanceTogether()
        {
            if (string.IsNullOrEmpty(_targetPlayerId)) return;
            EventBus.Publish(EventBus.EventType.PlayEmote, ("dance", _targetPlayerId));
            OnActionSelected?.Invoke("dance_together");
            Hide();
        }

        #endregion

        #region Button Construction

        /// <summary>
        /// Instantiates and configures buttons for all currently valid actions.
        /// </summary>
        private void CreateMenuButtons()
        {
            ClearSpawnedButtons();

            List<InteractionAction> filtered = FilterActions();
            filtered.Sort((a, b) => a.Order.CompareTo(b.Order));

            foreach (var action in filtered)
            {
                GameObject btn = Instantiate(MenuButtonPrefab, MenuContainer);
                _spawnedButtons.Add(btn);

                ConfigureButton(btn, action);
            }
        }

        /// <summary>
        /// Configures a single menu button with icon, label, color, and click handler.
        /// </summary>
        private void ConfigureButton(GameObject btn, InteractionAction action)
        {
            // Find components
            Image iconImg = btn.GetComponentInChildren<Image>();
            TMP_Text labelTxt = btn.GetComponentInChildren<TMP_Text>();
            Button button = btn.GetComponent<Button>();

            if (iconImg != null)
            {
                iconImg.sprite = action.Icon;
                iconImg.color = action.IsDestructive ? Color.red : action.IconColor;
            }

            if (labelTxt != null)
            {
                labelTxt.text = action.DisplayName;
                labelTxt.color = action.IsDestructive ? new Color(0.8f, 0.2f, 0.2f) : Color.white;
            }

            if (button != null)
            {
                string capturedId = action.ActionId; // closure capture
                button.onClick.AddListener(() => ExecuteActionById(capturedId));
            }

            // Start scale at zero for animation
            btn.transform.localScale = Vector3.zero;
        }

        /// <summary>
        /// Arranges spawned buttons in a circle around the menu center.
        /// </summary>
        private void PositionButtonsInCircle()
        {
            int count = _spawnedButtons.Count;
            if (count == 0) return;

            float startAngle = 90f; // Start from top
            float totalArc = (count - 1) * ButtonSpacingDegrees;
            float currentAngle = startAngle + totalArc / 2f;

            for (int i = 0; i < count; i++)
            {
                GameObject btn = _spawnedButtons[i];
                if (btn == null) continue;

                RectTransform rt = btn.GetComponent<RectTransform>();
                if (rt == null) continue;

                float rad = currentAngle * Mathf.Deg2Rad;
                Vector2 pos = new Vector2(Mathf.Cos(rad), Mathf.Sin(rad)) * MenuRadius;
                rt.anchoredPosition = pos;

                currentAngle -= ButtonSpacingDegrees;
            }
        }

        /// <summary>
        /// Destroys all dynamically created menu buttons.
        /// </summary>
        private void ClearSpawnedButtons()
        {
            foreach (var btn in _spawnedButtons)
            {
                if (btn != null)
                {
                    Button b = btn.GetComponent<Button>();
                    if (b != null) b.onClick.RemoveAllListeners();
                    Destroy(btn);
                }
            }
            _spawnedButtons.Clear();
        }

        #endregion

        #region Animation

        /// <summary>
        /// Animates the menu container and buttons into view using DOTween.
        /// </summary>
        private void AnimateShow()
        {
            _showTween?.Kill();

            // Scale up container
            MenuContainer.localScale = Vector3.zero;
            _showTween = MenuContainer.DOScale(Vector3.one, AppearDuration)
                .SetEase(Ease.OutBack);

            // Stagger buttons
            for (int i = 0; i < _spawnedButtons.Count; i++)
            {
                GameObject btn = _spawnedButtons[i];
                if (btn == null) continue;

                btn.transform.localScale = Vector3.zero;
                btn.transform.DOScale(Vector3.one, 0.15f)
                    .SetDelay(AppearDuration * 0.3f + i * 0.03f)
                    .SetEase(Ease.OutBack);
            }
        }

        /// <summary>
        /// Animates the menu out of view, invoking <paramref name="onComplete"/> when finished.
        /// </summary>
        private void AnimateHide(TweenCallback onComplete)
        {
            _hideTween?.Kill();

            _hideTween = MenuContainer.DOScale(Vector3.zero, AppearDuration * 0.6f)
                .SetEase(Ease.InBack)
                .OnComplete(onComplete);
        }

        #endregion

        #region Action Routing

        /// <summary>
        /// Executes the action matching the provided <paramref name="actionId"/>.
        /// </summary>
        private void ExecuteActionById(string actionId)
        {
            switch (actionId)
            {
                case "view_profile": OnViewProfile(); break;
                case "add_friend": OnAddFriend(); break;
                case "send_whisper": OnSendWhisper(); break;
                case "send_gift": OnSendGift(); break;
                case "invite_room": OnInviteToRoom(); break;
                case "invite_party": OnInviteToParty(); break;
                case "trade": OnTrade(); break;
                case "report": OnReport(); break;
                case "block": OnBlock(); break;
                case "follow": OnFollow(); break;
                case "wave": OnWave(); break;
                case "hug": OnHug(); break;
                case "dance_together": OnDanceTogether(); break;
                default:
                    Debug.LogWarning($"[{nameof(InteractionMenu)}] Unhandled actionId: {actionId}");
                    OnActionSelected?.Invoke(actionId);
                    Hide();
                    break;
            }
        }

        #endregion

        #region Filtering & State Queries

        /// <summary>
        /// Returns the subset of <see cref="AvailableActions"/> that are valid for the current context.
        /// </summary>
        private List<InteractionAction> FilterActions()
        {
            var result = new List<InteractionAction>();
            foreach (var action in AvailableActions)
            {
                if (action.RequiresFriendship && !_isFriend) continue;
                if (action.RequiresSameRoom && !_isSameRoom) continue;
                result.Add(action);
            }
            return result;
        }

        /// <summary>
        /// Checks whether the local player is friends with the given target.
        /// </summary>
        private bool CheckIsFriend(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return false;
            // Query SocialGraphManager via EventBus or direct reference
            // Simplified: publish a request and wait for response
            return false; // Placeholder – hook up to SocialGraphManager
        }

        /// <summary>
        /// Checks whether the target player is in the same room as the local player.
        /// </summary>
        private bool CheckIsSameRoom(string playerId)
        {
            if (string.IsNullOrEmpty(playerId)) return false;
            // Query NetworkedPlayer or RoomManager
            return true; // Placeholder – most actions assume same room
        }

        #endregion

        #region EventBus Handlers

        /// <summary>
        /// Responds to a ShowInteractionMenu event broadcast via the EventBus.
        /// </summary>
        private void OnShowRequested((string playerId, string playerName, Vector2 screenPos) data)
        {
            Show(data.playerId, data.playerName, data.screenPos);
        }

        /// <summary>
        /// Hides the menu when the current player selection is cleared.
        /// </summary>
        private void OnPlayerDeselected()
        {
            Hide();
        }

        /// <summary>
        /// Refreshes action visibility when friendship status changes.
        /// </summary>
        private void OnFriendshipStatusChanged(string playerId)
        {
            if (_targetPlayerId == playerId)
            {
                RefreshActions();
            }
        }

        #endregion
    }
}
