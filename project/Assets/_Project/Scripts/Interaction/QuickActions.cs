using System;
using System.Collections.Generic;
using System.Collections;
using DG.Tweening;
using UnityEngine;
using UnityEngine.UI;

namespace KawaiiCoolIsland.Interaction
{
    /// <summary>
    /// Defines a quick social action such as wave, hug, or dance.
    /// </summary>
    [System.Serializable]
    public class QuickAction
    {
        /// <summary>
        /// Unique identifier for this action (e.g. "wave", "hug", "trade").
        /// </summary>
        public string ActionId;

        /// <summary>
        /// Human-readable label shown on the action button.
        /// </summary>
        public string DisplayName;

        /// <summary>
        /// Icon sprite displayed on the action button.
        /// </summary>
        public Sprite Icon;

        /// <summary>
        /// Animation clip played on the local player's avatar when this action is executed.
        /// </summary>
        public AnimationClip ActionAnimation;

        /// <summary>
        /// Cooldown duration in seconds before this action can be used again.
        /// </summary>
        public float Cooldown;

        /// <summary>
        /// If true, this action requires a target player to be selected.
        /// </summary>
        public bool RequiresTarget;

        /// <summary>
        /// If true, both the local player and the target player animate together.
        /// </summary>
        public bool IsTargetedAnimation;
    }

    /// <summary>
    /// Quick social actions bar that appears above the action target.
    /// Provides one-tap access to emotes, trades, and social gestures.
    /// </summary>
    public class QuickActions : MonoBehaviour
    {
        #region Inspector — Actions

        [Header("Actions")]
        [Tooltip("All quick actions available to the player. Filtered at runtime by target context.")]
        public List<QuickAction> Actions = new();

        #endregion

        #region Inspector — UI

        [Header("UI")]
        [Tooltip("Parent transform that will contain all spawned action buttons.")]
        public Transform ActionBar;

        [Tooltip("Prefab instantiated for each quick-action button. Must contain an Image and Button.")]
        public GameObject ActionButtonPrefab;

        [Tooltip("Delay between each button appearing during the show animation (seconds).")]
        public float ButtonAppearDelay = 0.05f;

        #endregion

        #region Private State

        private readonly List<GameObject> _spawnedButtons = new();
        private readonly Dictionary<string, float> _lastActionTime = new();
        private string _currentTargetPlayerId;
        private bool _isShowing;
        private Coroutine _hideCoroutine;

        #endregion

        #region Events

        /// <summary>
        /// Invoked when any quick action is executed. Passes the actionId and targetPlayerId.
        /// </summary>
        public event Action<string, string> OnActionExecuted;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            if (ActionBar == null)
            {
                Debug.LogError($"[{nameof(QuickActions)}] ActionBar is not assigned.", this);
                enabled = false;
                return;
            }

            gameObject.SetActive(false);
        }

        private void OnEnable()
        {
            EventBus.Subscribe<PlayerInteractable>(EventBus.EventType.PlayerSelected, OnPlayerSelected);
            EventBus.Subscribe(EventBus.EventType.PlayerDeselected, OnPlayerDeselected);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<PlayerInteractable>(EventBus.EventType.PlayerSelected, OnPlayerSelected);
            EventBus.Unsubscribe(EventBus.EventType.PlayerDeselected, OnPlayerDeselected);
        }

        #endregion

        #region Public API

        /// <summary>
        /// Shows the quick-actions bar for the specified target player.
        /// </summary>
        /// <param name="playerId">Unique ID of the player to perform actions toward.</param>
        public void ShowForTarget(string playerId)
        {
            if (_isShowing && _currentTargetPlayerId == playerId) return;

            if (_hideCoroutine != null)
            {
                StopCoroutine(_hideCoroutine);
                _hideCoroutine = null;
            }

            _currentTargetPlayerId = playerId;
            _isShowing = true;
            gameObject.SetActive(true);

            ClearButtons();
            BuildButtons();
            AnimateShow();
        }

        /// <summary>
        /// Hides the quick-actions bar and destroys all spawned buttons.
        /// </summary>
        public void Hide()
        {
            if (!_isShowing) return;
            _isShowing = false;

            if (_hideCoroutine != null)
                StopCoroutine(_hideCoroutine);
            _hideCoroutine = StartCoroutine(HideAfterDelay(0.1f));
        }

        /// <summary>
        /// Executes the quick action with the given <paramref name="actionId"/>.
        /// </summary>
        public void ExecuteAction(string actionId)
        {
            QuickAction action = FindAction(actionId);
            if (action == null)
            {
                Debug.LogWarning($"[{nameof(QuickActions)}] Action '{actionId}' not found.");
                return;
            }

            // Check cooldown
            if (_lastActionTime.TryGetValue(actionId, out float lastTime))
            {
                float elapsed = Time.time - lastTime;
                if (elapsed < action.Cooldown)
                {
                    Debug.Log($"[{nameof(QuickActions)}] Action '{actionId}' is on cooldown ({action.Cooldown - elapsed:F1}s remaining).");
                    return;
                }
            }

            _lastActionTime[actionId] = Time.time;

            // Route to specific handler
            switch (actionId)
            {
                case "wave": OnWave(); break;
                case "hug": OnHug(); break;
                case "high_five": OnHighFive(); break;
                case "dance_together": OnDanceTogether(); break;
                case "sit_together": OnSitTogether(); break;
                case "follow": OnFollow(); break;
                case "trade": OnTrade(); break;
                default:
                    Debug.LogWarning($"[{nameof(QuickActions)}] Unhandled quick action: {actionId}");
                    break;
            }

            OnActionExecuted?.Invoke(actionId, _currentTargetPlayerId);
        }

        #endregion

        #region Action Handlers

        /// <summary>
        /// Sends a wave emote toward the target player.
        /// </summary>
        private void OnWave()
        {
            PlayAnimation("wave");
            EventBus.Publish(EventBus.EventType.PlayEmote, ("wave", _currentTargetPlayerId));
        }

        /// <summary>
        /// Sends a hug emote toward the target player. Requires close proximity.
        /// </summary>
        private void OnHug()
        {
            PlayAnimation("hug");
            EventBus.Publish(EventBus.EventType.PlayEmote, ("hug", _currentTargetPlayerId));
        }

        /// <summary>
        /// Sends a high-five emote toward the target player.
        /// </summary>
        private void OnHighFive()
        {
            PlayAnimation("high_five");
            EventBus.Publish(EventBus.EventType.PlayEmote, ("high_five", _currentTargetPlayerId));
        }

        /// <summary>
        /// Sends a dance-together request to the target player.
        /// </summary>
        private void OnDanceTogether()
        {
            PlayAnimation("dance");
            EventBus.Publish(EventBus.EventType.PlayEmote, ("dance", _currentTargetPlayerId));
        }

        /// <summary>
        /// Sends a sit-together request to the target player.
        /// </summary>
        private void OnSitTogether()
        {
            PlayAnimation("sit");
            EventBus.Publish(EventBus.EventType.PlayEmote, ("sit", _currentTargetPlayerId));
        }

        /// <summary>
        /// Initiates auto-follow of the target player.
        /// </summary>
        private void OnFollow()
        {
            EventBus.Publish(EventBus.EventType.FollowPlayer, _currentTargetPlayerId);
        }

        /// <summary>
        /// Opens the trade dialog with the target player.
        /// </summary>
        private void OnTrade()
        {
            EventBus.Publish(EventBus.EventType.RequestTrade, _currentTargetPlayerId);
        }

        #endregion

        #region Button Construction

        /// <summary>
        /// Builds action buttons for all currently valid quick actions.
        /// </summary>
        private void BuildButtons()
        {
            if (ActionButtonPrefab == null) return;

            foreach (var action in Actions)
            {
                if (action.RequiresTarget && string.IsNullOrEmpty(_currentTargetPlayerId)) continue;

                GameObject btn = Instantiate(ActionButtonPrefab, ActionBar);
                _spawnedButtons.Add(btn);
                ConfigureButton(btn, action);
            }
        }

        /// <summary>
        /// Configures a single quick-action button with icon, tooltip, and click handler.
        /// </summary>
        private void ConfigureButton(GameObject btn, QuickAction action)
        {
            Image iconImg = btn.GetComponentInChildren<Image>();
            TMP_Text labelTxt = btn.GetComponentInChildren<TMP_Text>();
            Button button = btn.GetComponent<Button>();

            if (iconImg != null && action.Icon != null)
                iconImg.sprite = action.Icon;

            if (labelTxt != null)
                labelTxt.text = action.DisplayName;

            if (button != null)
            {
                string capturedId = action.ActionId;
                button.onClick.AddListener(() => ExecuteAction(capturedId));
            }

            // Tooltip component could be added here
            btn.transform.localScale = Vector3.zero;
        }

        /// <summary>
        /// Destroys all spawned quick-action buttons.
        /// </summary>
        private void ClearButtons()
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
        /// Animates each button into view with a staggered scale-up effect.
        /// </summary>
        private void AnimateShow()
        {
            for (int i = 0; i < _spawnedButtons.Count; i++)
            {
                GameObject btn = _spawnedButtons[i];
                if (btn == null) continue;

                btn.transform.DOScale(Vector3.one, 0.2f)
                    .SetDelay(i * ButtonAppearDelay)
                    .SetEase(Ease.OutBack);
            }
        }

        /// <summary>
        /// Coroutine that waits briefly then hides the action bar.
        /// </summary>
        private IEnumerator HideAfterDelay(float delay)
        {
            yield return new WaitForSeconds(delay);
            ClearButtons();
            gameObject.SetActive(false);
            _hideCoroutine = null;
        }

        #endregion

        #region Helpers

        /// <summary>
        /// Finds a <see cref="QuickAction"/> by its <see cref="QuickAction.ActionId"/>.
        /// </summary>
        private QuickAction FindAction(string actionId)
        {
            foreach (var action in Actions)
            {
                if (action.ActionId == actionId)
                    return action;
            }
            return null;
        }

        /// <summary>
        /// Plays the named animation on the local player's AvatarController if available.
        /// </summary>
        private void PlayAnimation(string animationName)
        {
            GameObject localPlayer = GameObject.FindGameObjectWithTag("LocalPlayer");
            if (localPlayer == null) return;

            AvatarController avatar = localPlayer.GetComponent<AvatarController>();
            if (avatar != null)
            {
                // Assuming AvatarController has a method to trigger animations
                // avatar.TriggerAnimation(animationName);
            }

            Animator animator = localPlayer.GetComponent<Animator>();
            if (animator != null)
            {
                animator.SetTrigger(animationName);
            }
        }

        #endregion

        #region EventBus Handlers

        /// <summary>
        /// Shows quick actions when a player is selected.
        /// </summary>
        private void OnPlayerSelected(PlayerInteractable player)
        {
            if (player == null || player.IsLocalPlayer) return;
            ShowForTarget(player.PlayerId);
        }

        /// <summary>
        /// Hides quick actions when the current selection is cleared.
        /// </summary>
        private void OnPlayerDeselected()
        {
            Hide();
        }

        #endregion
    }
}
