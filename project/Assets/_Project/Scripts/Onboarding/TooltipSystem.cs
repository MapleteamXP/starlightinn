using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace KawaiiCool.Onboarding
{
    /// <summary>
    /// Data asset for a contextual tooltip. ScriptableObject used in the tooltip database.
    /// </summary>
    [CreateAssetMenu(fileName = "Tooltip_", menuName = "KawaiiCool/Tooltip")]
    public class TooltipData : ScriptableObject
    {
        [Tooltip("Unique identifier for this tooltip.")]
        public string TooltipId;

        [Tooltip("Display title shown in the tooltip header.")]
        public string Title;

        [Tooltip("Body description text of the tooltip.")]
        public string Description;

        [Tooltip("Optional icon sprite for the tooltip.")]
        public Sprite Icon;

        [Tooltip("If true, this tooltip will only be shown once per player account.")]
        public bool ShowOnce = true;

        [Tooltip("Context condition that triggers this tooltip (e.g. 'inventory_opened').")]
        public string TriggerContext;

        [Tooltip("Preferred screen-relative anchor position for the tooltip.")]
        public Vector2 PreferredPosition;
    }

    /// <summary>
    /// Manages contextual tooltips that appear when the player encounters
    /// UI elements, features, or situations for the first time.
    /// Tooltips can be shown once (default), resettable, and contextually triggered.
    /// </summary>
    public class TooltipSystem : Singleton<TooltipSystem>
    {
        // ─────────────────────────────────────────────────────────────────
        //  Tooltips
        // ─────────────────────────────────────────────────────────────────
        [Header("Tooltips")]
        [SerializeField, Tooltip("Prefab instantiated for each active tooltip instance.")]
        private GameObject _tooltipPrefab;

        [SerializeField, Tooltip("Parent transform under which tooltip instances are created.")]
        private Transform _tooltipContainer;

        [SerializeField, Tooltip("Delay in seconds before a tooltip appears after its trigger condition is met.")]
        private float _tooltipShowDelay = 1f;

        [SerializeField, Tooltip("Delay in seconds before a tooltip automatically hides after being shown.")]
        private float _tooltipHideDelay = 5f;

        // ─────────────────────────────────────────────────────────────────
        //  Database
        // ─────────────────────────────────────────────────────────────────
        [Header("Database")]
        [SerializeField, Tooltip("Master list of all tooltip data assets available in the game.")]
        private List<TooltipData> _tooltipDatabase = new List<TooltipData>();

        // Tracks which tooltips have already been displayed.
        private HashSet<string> _shownTooltips = new HashSet<string>();

        // Active tooltip instances keyed by their TooltipId.
        private Dictionary<string, GameObject> _activeTooltips = new Dictionary<string, GameObject>();

        // Coroutines managing tooltip lifecycle keyed by TooltipId.
        private Dictionary<string, Coroutine> _tooltipCoroutines = new Dictionary<string, Coroutine>();

        private const string PREFS_TOOLTIPS_SEEN = "KawaiiCool_ShownTooltips";

        // ─────────────────────────────────────────────────────────────────
        //  Lifecycle
        // ─────────────────────────────────────────────────────────────────
        protected override void Awake()
        {
            base.Awake();
            LoadSeenTooltips();
        }

        private void OnDestroy()
        {
            // Stop all pending coroutines.
            foreach (var kvp in _tooltipCoroutines)
            {
                if (kvp.Value != null)
                    StopCoroutine(kvp.Value);
            }
            _tooltipCoroutines.Clear();
        }

        // ─────────────────────────────────────────────────────────────────
        //  Public API — Core Tooltip Methods
        // ─────────────────────────────────────────────────────────────────
        /// <summary>
        /// Shows a tooltip at a screen-space position.
        /// </summary>
        /// <param name="tooltipId">Identifier of the tooltip to display.</param>
        /// <param name="position">Screen-space position for the tooltip.</param>
        public void ShowTooltip(string tooltipId, Vector2 position)
        {
            TooltipData data = GetTooltipData(tooltipId);
            if (data == null)
            {
                Debug.LogWarning($"[TooltipSystem] No tooltip found with ID: {tooltipId}");
                return;
            }

            if (data.ShowOnce && HasSeenTooltip(tooltipId))
                return;

            if (_tooltipCoroutines.ContainsKey(tooltipId))
            {
                StopCoroutine(_tooltipCoroutines[tooltipId]);
                _tooltipCoroutines.Remove(tooltipId);
            }

            Coroutine routine = StartCoroutine(TooltipLifecycle(tooltipId, _tooltipShowDelay, _tooltipHideDelay));
            _tooltipCoroutines[tooltipId] = routine;
        }

        /// <summary>
        /// Shows a tooltip anchored to a specific UI element.
        /// </summary>
        /// <param name="tooltipId">Identifier of the tooltip to display.</param>
        /// <param name="target">The RectTransform to anchor the tooltip to.</param>
        public void ShowTooltip(string tooltipId, RectTransform target)
        {
            if (target == null) return;
            Vector2 screenPos = RectTransformUtility.WorldToScreenPoint(Camera.main, target.position);
            ShowTooltip(tooltipId, screenPos);
        }

        /// <summary>
        /// Hides the tooltip with the specified ID if it is currently visible.
        /// </summary>
        /// <param name="tooltipId">Identifier of the tooltip to hide.</param>
        public void HideTooltip(string tooltipId)
        {
            if (_activeTooltips.TryGetValue(tooltipId, out GameObject instance))
            {
                if (instance != null)
                {
                    StartCoroutine(FadeAndDestroy(instance));
                }
                _activeTooltips.Remove(tooltipId);
            }

            if (_tooltipCoroutines.TryGetValue(tooltipId, out Coroutine routine))
            {
                if (routine != null)
                    StopCoroutine(routine);
                _tooltipCoroutines.Remove(tooltipId);
            }
        }

        /// <summary>
        /// Hides all currently visible tooltips.
        /// </summary>
        public void HideAllTooltips()
        {
            var ids = new List<string>(_activeTooltips.Keys);
            foreach (var id in ids)
            {
                HideTooltip(id);
            }
            _activeTooltips.Clear();
        }

        /// <summary>
        /// Checks whether the player has already seen a tooltip.
        /// </summary>
        /// <param name="tooltipId">The tooltip identifier to check.</param>
        /// <returns>True if the tooltip has been seen; otherwise false.</returns>
        public bool HasSeenTooltip(string tooltipId)
        {
            return _shownTooltips.Contains(tooltipId);
        }

        /// <summary>
        /// Manually marks a tooltip as seen so it will not appear again (if ShowOnce is true).
        /// </summary>
        /// <param name="tooltipId">The tooltip identifier to mark.</param>
        public void MarkTooltipSeen(string tooltipId)
        {
            _shownTooltips.Add(tooltipId);
            SaveSeenTooltips();
        }

        /// <summary>
        /// Resets a single tooltip so it can be shown again.
        /// </summary>
        /// <param name="tooltipId">The tooltip identifier to reset.</param>
        public void ResetTooltip(string tooltipId)
        {
            _shownTooltips.Remove(tooltipId);
            SaveSeenTooltips();
        }

        /// <summary>
        /// Resets all tooltips so every tooltip can be shown again.
        /// </summary>
        public void ResetAllTooltips()
        {
            _shownTooltips.Clear();
            SaveSeenTooltips();
        }

        // ─────────────────────────────────────────────────────────────────
        //  Smart Tooltip Methods
        // ─────────────────────────────────────────────────────────────────
        /// <summary>
        /// Shows a tooltip for a feature the first time the player uses it.
        /// </summary>
        /// <param name="featureId">The feature identifier to trigger a tooltip for.</param>
        public void ShowFeatureTooltip(string featureId)
        {
            if (OnboardingManager.Instance != null &&
                OnboardingManager.Instance.HasDiscoveredFeature(featureId))
            {
                return; // Feature already discovered.
            }

            // Find a tooltip whose TriggerContext matches the feature.
            foreach (var data in _tooltipDatabase)
            {
                if (data.TriggerContext == featureId)
                {
                    ShowTooltip(data.TooltipId, data.PreferredPosition);
                    OnboardingManager.Instance?.MarkFeatureDiscovered(featureId);
                    return;
                }
            }

            Debug.Log($"[TooltipSystem] No tooltip found for feature: {featureId}");
        }

        /// <summary>
        /// Shows a tooltip based on the current gameplay context.
        /// </summary>
        /// <param name="context">Context string (e.g. 'post_onboarding', 'first_trade').</param>
        public void ShowContextualTooltip(string context)
        {
            foreach (var data in _tooltipDatabase)
            {
                if (data.TriggerContext == context)
                {
                    ShowTooltip(data.TooltipId, data.PreferredPosition);
                    return;
                }
            }
        }

        /// <summary>
        /// Shows a help-style tooltip for a given topic.
        /// </summary>
        /// <param name="topic">Topic string to search for in the tooltip database.</param>
        public void ShowHelpTip(string topic)
        {
            foreach (var data in _tooltipDatabase)
            {
                if (data.TooltipId.Equals(topic, System.StringComparison.OrdinalIgnoreCase) ||
                    data.Title.Equals(topic, System.StringComparison.OrdinalIgnoreCase))
                {
                    ShowTooltip(data.TooltipId, data.PreferredPosition);
                    return;
                }
            }
        }

        // ─────────────────────────────────────────────────────────────────
        //  Private Helpers
        // ─────────────────────────────────────────────────────────────────
        private TooltipData GetTooltipData(string tooltipId)
        {
            if (string.IsNullOrEmpty(tooltipId)) return null;
            foreach (var data in _tooltipDatabase)
            {
                if (data != null && data.TooltipId == tooltipId)
                    return data;
            }
            return null;
        }

        private IEnumerator TooltipLifecycle(string tooltipId, float showDelay, float hideDelay)
        {
            yield return new WaitForSeconds(showDelay);

            TooltipData data = GetTooltipData(tooltipId);
            if (data == null) yield break;

            // Instantiate tooltip.
            if (_tooltipPrefab == null) yield break;

            Transform container = _tooltipContainer != null ? _tooltipContainer : transform;
            GameObject instance = Instantiate(_tooltipPrefab, container);
            instance.name = $"Tooltip_{tooltipId}";

            // Populate UI.
            var titleText = instance.GetComponentInChildren<TMP_Text>();
            if (titleText != null)
            {
                // If there's a child named "Title", assign title; otherwise assign description.
                Transform titleTr = instance.transform.Find("Title");
                if (titleTr != null)
                {
                    var tt = titleTr.GetComponent<TMP_Text>();
                    if (tt != null) tt.text = data.Title;
                }
                else
                {
                    titleText.text = $"<b>{data.Title}</b>\n{data.Description}";
                }
            }

            Transform descTr = instance.transform.Find("Description");
            if (descTr != null)
            {
                var dt = descTr.GetComponent<TMP_Text>();
                if (dt != null) dt.text = data.Description;
            }

            if (data.Icon != null)
            {
                Transform iconTr = instance.transform.Find("Icon");
                if (iconTr != null)
                {
                    var img = iconTr.GetComponent<Image>();
                    if (img != null) img.sprite = data.Icon;
                }
            }

            // Position.
            RectTransform rt = instance.GetComponent<RectTransform>();
            if (rt != null)
            {
                rt.anchoredPosition = data.PreferredPosition;
            }

            // Fade in.
            CanvasGroup cg = instance.GetComponent<CanvasGroup>();
            if (cg == null) cg = instance.AddComponent<CanvasGroup>();
            cg.alpha = 0f;
            yield return StartCoroutine(FadeCanvasGroup(cg, 0f, 1f, 0.25f));

            _activeTooltips[tooltipId] = instance;

            if (data.ShowOnce)
                MarkTooltipSeen(tooltipId);

            // Wait then hide.
            yield return new WaitForSeconds(hideDelay);
            HideTooltip(tooltipId);
        }

        private IEnumerator FadeAndDestroy(GameObject instance)
        {
            if (instance == null) yield break;
            CanvasGroup cg = instance.GetComponent<CanvasGroup>();
            if (cg == null) cg = instance.AddComponent<CanvasGroup>();
            yield return StartCoroutine(FadeCanvasGroup(cg, cg.alpha, 0f, 0.2f));
            Destroy(instance);
        }

        private IEnumerator FadeCanvasGroup(CanvasGroup cg, float from, float to, float duration)
        {
            if (cg == null) yield break;
            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                cg.alpha = Mathf.Lerp(from, to, elapsed / duration);
                yield return null;
            }
            cg.alpha = to;
        }

        // ─────────────────────────────────────────────────────────────────
        //  Persistence
        // ─────────────────────────────────────────────────────────────────
        private void SaveSeenTooltips()
        {
            string joined = string.Join(",", _shownTooltips);
            PlayerPrefs.SetString(PREFS_TOOLTIPS_SEEN, joined);
            PlayerPrefs.Save();
        }

        private void LoadSeenTooltips()
        {
            string saved = PlayerPrefs.GetString(PREFS_TOOLTIPS_SEEN, "");
            _shownTooltips.Clear();
            if (!string.IsNullOrEmpty(saved))
            {
                var parts = saved.Split(',');
                foreach (var p in parts)
                {
                    if (!string.IsNullOrEmpty(p))
                        _shownTooltips.Add(p);
                }
            }
        }

        // ─────────────────────────────────────────────────────────────────
        //  Debug Helpers
        // ─────────────────────────────────────────────────────────────────
        /// <summary>
        /// Debug method to force-show a tooltip by ID without any delay or ShowOnce restriction.
        /// </summary>
        /// <param name="tooltipId">The tooltip ID to force show.</param>
        [ContextMenu("Debug Force Show Tooltip")]
        public void DebugForceShowTooltip()
        {
            if (_tooltipDatabase.Count > 0)
            {
                var data = _tooltipDatabase[0];
                ShowTooltip(data.TooltipId, data.PreferredPosition);
            }
        }
    }
}
