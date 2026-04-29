// -----------------------------------------------------------------------
// ItemTooltip.cs
// Hover tooltip panel that displays detailed item information.
// Follows the cursor with fade in/out and dynamic positioning.
// -----------------------------------------------------------------------

using System.Collections;
using System.Text;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace KawaiiCool.Inventory
{
    /// <summary>
    /// Tooltip panel that appears when hovering over an inventory or shop item.
    /// Displays name, rarity, description, stats, and tags with smooth fade
    /// and cursor-following behaviour.
    /// </summary>
    public class ItemTooltip : MonoBehaviour
    {
        #region Inspector — References
        [Header("References")]
        [Tooltip("CanvasGroup controlling overall opacity.")]
        public CanvasGroup CanvasGroup;

        [Tooltip("Image showing the item icon.")]
        public Image ItemIcon;

        [Tooltip("Text displaying the item name (with rarity color).")]
        public TMP_Text NameText;

        [Tooltip("Text displaying the rarity tier.")]
        public TMP_Text RarityText;

        [Tooltip("Text displaying the item description.")]
        public TMP_Text DescriptionText;

        [Tooltip("Text displaying stats/economy info.")]
        public TMP_Text StatsText;

        [Tooltip("Border image tinted with rarity color.")]
        public Image RarityBorder;

        [Tooltip("Parent transform for tag pills.")]
        public Transform TagsContainer;

        [Tooltip("Prefab for a single tag pill.")]
        public GameObject TagPrefab;
        #endregion

        #region Inspector — Positioning
        [Header("Positioning")]
        [Tooltip("Offset from the cursor in screen-space pixels.")]
        public Vector2 Offset = new Vector2(15f, 15f);

        [Tooltip("Duration of the fade-in and fade-out animations.")]
        public float FadeDuration = 0.15f;

        [Tooltip("If true, the tooltip follows the mouse cursor every frame.")]
        public bool FollowMouse = true;

        [Tooltip("Padding from screen edges to keep the tooltip fully visible.")]
        public float ScreenEdgePadding = 16f;
        #endregion

        // ------------------------------------------------------------------
        // Runtime state
        // ------------------------------------------------------------------
        private Coroutine _fadeCoroutine;
        private RectTransform _rectTransform;
        private Camera _uiCamera;
        private bool _isVisible;

        // ------------------------------------------------------------------
        // Lifecycle
        // ------------------------------------------------------------------
        private void Awake()
        {
            _rectTransform = GetComponent<RectTransform>();
            _uiCamera = GetComponentInParent<Canvas>()?.worldCamera;

            if (CanvasGroup != null)
            {
                CanvasGroup.alpha = 0f;
                CanvasGroup.blocksRaycasts = false;
                CanvasGroup.interactable = false;
            }

            gameObject.SetActive(false);
        }

        private void Update()
        {
            if (_isVisible && FollowMouse)
            {
                UpdatePosition(Input.mousePosition);
            }
        }

        // ------------------------------------------------------------------
        // Public API
        // ------------------------------------------------------------------

        /// <summary>
        /// Shows the tooltip for the given item at the specified screen position.
        /// </summary>
        /// <param name="item">Item data to display.</param>
        /// <param name="position">Initial screen position (typically the mouse cursor).</param>
        public void Show(ItemData item, Vector2 position)
        {
            if (item == null) return;

            KillFade();
            gameObject.SetActive(true);
            PopulateTooltip(item);
            UpdatePosition(position);

            _isVisible = true;
            _fadeCoroutine = StartCoroutine(FadeIn());
        }

        /// <summary>
        /// Hides the tooltip with a fade-out animation.
        /// </summary>
        public void Hide()
        {
            if (!_isVisible) return;

            _isVisible = false;
            KillFade();
            _fadeCoroutine = StartCoroutine(FadeOut());
        }

        /// <summary>
        /// Immediately hides the tooltip without animation.
        /// </summary>
        public void HideInstant()
        {
            _isVisible = false;
            KillFade();

            if (CanvasGroup != null)
                CanvasGroup.alpha = 0f;

            gameObject.SetActive(false);
        }

        /// <summary>
        /// Updates the tooltip position, keeping it within screen bounds.
        /// </summary>
        public void UpdatePosition(Vector2 position)
        {
            if (_rectTransform == null) return;

            Vector2 targetPos = position + Offset;

            // Clamp to screen edges
            float maxX = Screen.width - _rectTransform.rect.width - ScreenEdgePadding;
            float maxY = Screen.height - _rectTransform.rect.height - ScreenEdgePadding;

            targetPos.x = Mathf.Clamp(targetPos.x, ScreenEdgePadding, maxX);
            targetPos.y = Mathf.Clamp(targetPos.y, ScreenEdgePadding, maxY);

            // Flip to left of cursor if it would go off the right edge
            if (position.x + Offset.x + _rectTransform.rect.width > Screen.width - ScreenEdgePadding)
            {
                targetPos.x = position.x - _rectTransform.rect.width - Offset.x;
            }

            // Flip below cursor if it would go off the top edge
            if (position.y + Offset.y + _rectTransform.rect.height > Screen.height - ScreenEdgePadding)
            {
                targetPos.y = position.y - _rectTransform.rect.height - Offset.y;
            }

            _rectTransform.position = targetPos;
        }

        // ------------------------------------------------------------------
        // Population
        // ------------------------------------------------------------------

        /// <summary>
        /// Fills all UI fields with data from the given item.
        /// </summary>
        private void PopulateTooltip(ItemData item)
        {
            // Icon
            if (ItemIcon != null)
            {
                ItemIcon.sprite = item.Icon;
                ItemIcon.enabled = item.Icon != null;
            }

            // Name with rarity color
            if (NameText != null)
            {
                string hex = item.GetRarityColorHex();
                NameText.text = $"<color={hex}>{item.DisplayName}</color>";
            }

            // Rarity
            if (RarityText != null)
            {
                string hex = item.GetRarityColorHex();
                RarityText.text = $"<color={hex}>{item.Rarity}</color>";
            }

            // Description
            if (DescriptionText != null)
            {
                DescriptionText.text = string.IsNullOrWhiteSpace(item.Description)
                    ? "No description available."
                    : item.Description;
            }

            // Stats
            if (StatsText != null)
            {
                StatsText.text = BuildStatsText(item);
            }

            // Rarity border tint
            if (RarityBorder != null)
            {
                RarityBorder.color = item.RarityColor;
            }

            // Tags
            PopulateTags(item);
        }

        /// <summary>
        /// Builds the stats/economy text block.
        /// </summary>
        private string BuildStatsText(ItemData item)
        {
            if (item == null) return "";

            StringBuilder sb = new StringBuilder();

            // Category
            sb.AppendLine($"Category: {item.Category}");

            // Stack info
            if (item.IsStackable)
                sb.AppendLine($"Stack: {item.MaxStackSize}");

            // Economy
            if (item.PurchasePrice > 0)
            {
                string currencyName = char.ToUpperInvariant(item.PurchaseCurrency[0]) + item.PurchaseCurrency.Substring(1);
                sb.AppendLine($"Buy: {item.PurchasePrice:N0} {currencyName}");
            }

            if (item.SellPrice > 0)
                sb.AppendLine($"Sell: {item.SellPrice:N0}");

            // Flags
            if (item.IsConsumable)
                sb.AppendLine("Type: Consumable");
            if (item.IsEquippable)
                sb.AppendLine($"Equippable: {string.Join(", ", item.EquipSlots)}");
            if (item.IsUsable)
                sb.AppendLine($"Use: {item.UseEffectDescription}");

            // Limited availability
            if (item.IsLimitedTime)
            {
                sb.AppendLine("<color=#FF4444>Limited Time</color>");
            }

            if (!item.IsTradeable)
                sb.AppendLine("Untradeable");

            if (!item.IsGiftable)
                sb.AppendLine("Cannot be gifted");

            return sb.ToString().TrimEnd();
        }

        /// <summary>
        /// Spawns tag pills for each tag on the item.
        /// </summary>
        private void PopulateTags(ItemData item)
        {
            if (TagsContainer == null || TagPrefab == null) return;

            // Clear existing
            foreach (Transform child in TagsContainer)
            {
                if (child != null) Destroy(child.gameObject);
            }

            if (item.Tags == null || item.Tags.Count == 0) return;

            foreach (string tag in item.Tags)
            {
                if (string.IsNullOrWhiteSpace(tag)) continue;

                GameObject go = Instantiate(TagPrefab, TagsContainer);
                var txt = go.GetComponentInChildren<TMP_Text>();
                if (txt != null)
                    txt.text = tag;
            }
        }

        // ------------------------------------------------------------------
        // Fade animations
        // ------------------------------------------------------------------

        private IEnumerator FadeIn()
        {
            if (CanvasGroup == null) yield break;

            CanvasGroup.blocksRaycasts = true;
            float elapsed = 0f;

            while (elapsed < FadeDuration)
            {
                elapsed += Time.unscaledDeltaTime;
                CanvasGroup.alpha = Mathf.Clamp01(elapsed / FadeDuration);
                yield return null;
            }

            CanvasGroup.alpha = 1f;
            _fadeCoroutine = null;
        }

        private IEnumerator FadeOut()
        {
            if (CanvasGroup == null) yield break;

            float elapsed = 0f;
            float startAlpha = CanvasGroup.alpha;

            while (elapsed < FadeDuration)
            {
                elapsed += Time.unscaledDeltaTime;
                CanvasGroup.alpha = Mathf.Lerp(startAlpha, 0f, elapsed / FadeDuration);
                yield return null;
            }

            CanvasGroup.alpha = 0f;
            CanvasGroup.blocksRaycasts = false;
            gameObject.SetActive(false);
            _fadeCoroutine = null;
        }

        // ------------------------------------------------------------------
        // Utility
        // ------------------------------------------------------------------

        private void KillFade()
        {
            if (_fadeCoroutine != null)
            {
                StopCoroutine(_fadeCoroutine);
                _fadeCoroutine = null;
            }
        }
    }
}
