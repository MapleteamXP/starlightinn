// -----------------------------------------------------------------------
// CurrencyDisplay.cs
// HUD component that animates currency balance changes with counting
// and bounce effects.  Listens to InventoryManager for updates.
// -----------------------------------------------------------------------

using System;
using System.Collections;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace KawaiiCool.Inventory
{
    /// <summary>
    /// Displays the player's currency balances on the HUD with animated
    /// transitions when values change.  Supports Coins, Gems, and Tickets.
    /// </summary>
    public class CurrencyDisplay : MonoBehaviour
    {
        #region Inspector — Coins
        [Header("Coins")]
        [Tooltip("Root GameObject for the coins display row.")]
        public GameObject CoinsContainer;

        [Tooltip("Text component showing coin balance.")]
        public TMP_Text CoinsText;

        [Tooltip("Icon image for coins.")]
        public Image CoinsIcon;

        [Tooltip("Animation curve for the coin bounce effect.")]
        public AnimationCurve CoinsBounceCurve = AnimationCurve.EaseInOut(0f, 0f, 1f, 1f);
        #endregion

        #region Inspector — Gems
        [Header("Gems")]
        [Tooltip("Root GameObject for the gems display row.")]
        public GameObject GemsContainer;

        [Tooltip("Text component showing gem balance.")]
        public TMP_Text GemsText;

        [Tooltip("Icon image for gems.")]
        public Image GemsIcon;

        [Tooltip("Animation curve for the gem bounce effect.")]
        public AnimationCurve GemsBounceCurve = AnimationCurve.EaseInOut(0f, 0f, 1f, 1f);
        #endregion

        #region Inspector — Tickets
        [Header("Tickets")]
        [Tooltip("Root GameObject for the tickets display row.")]
        public GameObject TicketsContainer;

        [Tooltip("Text component showing ticket balance.")]
        public TMP_Text TicketsText;

        [Tooltip("Icon image for tickets.")]
        public Image TicketsIcon;
        #endregion

        #region Inspector — Animation Settings
        [Header("Animation")]
        [Tooltip("Duration of the count-up / count-down animation in seconds.")]
        public float CountDuration = 1f;

        [Tooltip("Maximum scale multiplier during the bounce animation.")]
        public float BounceScale = 1.3f;
        #endregion

        // ------------------------------------------------------------------
        // Runtime state
        // ------------------------------------------------------------------
        private int _displayedCoins;
        private int _displayedGems;
        private int _displayedTickets;
        private Coroutine _coinsAnimCoroutine;
        private Coroutine _gemsAnimCoroutine;
        private Coroutine _ticketsAnimCoroutine;

        // ------------------------------------------------------------------
        // Lifecycle
        // ------------------------------------------------------------------
        private void Start()
        {
            Refresh();

            if (InventoryManager.Instance != null)
            {
                InventoryManager.Instance.OnCurrencyChanged += HandleCurrencyChanged;
            }
        }

        private void OnDestroy()
        {
            if (InventoryManager.Instance != null)
            {
                InventoryManager.Instance.OnCurrencyChanged -= HandleCurrencyChanged;
            }

            KillCoroutines();
        }

        // ------------------------------------------------------------------
        // Event handling
        // ------------------------------------------------------------------

        /// <summary>
        /// Called whenever InventoryManager fires a currency change event.
        /// </summary>
        private void HandleCurrencyChanged(string currencyType, int newBalance)
        {
            switch (currencyType?.ToLowerInvariant())
            {
                case "coins":
                    AnimateCoinsChange(_displayedCoins, newBalance);
                    break;

                case "gems":
                    AnimateGemsChange(_displayedGems, newBalance);
                    break;

                case "tickets":
                    AnimateTicketsChange(_displayedTickets, newBalance);
                    break;
            }
        }

        // ------------------------------------------------------------------
        // Public API
        // ------------------------------------------------------------------

        /// <summary>
        /// Instantly syncs all displayed values with InventoryManager.
        /// </summary>
        public void Refresh()
        {
            if (InventoryManager.Instance == null) return;

            int coins = InventoryManager.Instance.GetCurrency("coins");
            int gems = InventoryManager.Instance.GetCurrency("gems");
            int tickets = InventoryManager.Instance.GetCurrency("tickets");

            SetCoinsInstant(coins);
            SetGemsInstant(gems);
            SetTicketsInstant(tickets);
        }

        /// <summary>
        /// Animates the coin display from one value to another with bounce.
        /// </summary>
        public void AnimateCoinsChange(int from, int to)
        {
            KillCoroutine(ref _coinsAnimCoroutine);
            _coinsAnimCoroutine = StartCoroutine(AnimateCoinsRoutine(from, to));
        }

        /// <summary>
        /// Animates the gem display from one value to another with bounce.
        /// </summary>
        public void AnimateGemsChange(int from, int to)
        {
            KillCoroutine(ref _gemsAnimCoroutine);
            _gemsAnimCoroutine = StartCoroutine(AnimateGemsRoutine(from, to));
        }

        /// <summary>
        /// Animates the ticket display from one value to another with bounce.
        /// </summary>
        public void AnimateTicketsChange(int from, int to)
        {
            KillCoroutine(ref _ticketsAnimCoroutine);
            _ticketsAnimCoroutine = StartCoroutine(AnimateTicketsRoutine(from, to));
        }

        /// <summary>
        /// Instantly sets the coin display without animation.
        /// </summary>
        public void SetCoinsInstant(int amount)
        {
            _displayedCoins = amount;
            if (CoinsText != null)
                CoinsText.text = amount.ToString("N0");
        }

        /// <summary>
        /// Instantly sets the gem display without animation.
        /// </summary>
        public void SetGemsInstant(int amount)
        {
            _displayedGems = amount;
            if (GemsText != null)
                GemsText.text = amount.ToString("N0");
        }

        /// <summary>
        /// Instantly sets the ticket display without animation.
        /// </summary>
        public void SetTicketsInstant(int amount)
        {
            _displayedTickets = amount;
            if (TicketsText != null)
                TicketsText.text = amount.ToString("N0");
        }

        /// <summary>
        /// Sets visibility of the coins row.
        /// </summary>
        public void SetCoinsVisible(bool visible)
        {
            if (CoinsContainer != null)
                CoinsContainer.SetActive(visible);
        }

        /// <summary>
        /// Sets visibility of the gems row.
        /// </summary>
        public void SetGemsVisible(bool visible)
        {
            if (GemsContainer != null)
                GemsContainer.SetActive(visible);
        }

        /// <summary>
        /// Sets visibility of the tickets row.
        /// </summary>
        public void SetTicketsVisible(bool visible)
        {
            if (TicketsContainer != null)
                TicketsContainer.SetActive(visible);
        }

        // ------------------------------------------------------------------
        // Animation coroutines
        // ------------------------------------------------------------------

        private IEnumerator AnimateCoinsRoutine(int from, int to)
        {
            yield return AnimateCount(CoinsText, from, to, CountDuration,
                val => _displayedCoins = val);

            if (CoinsContainer != null)
            {
                RectTransform rt = CoinsContainer.GetComponent<RectTransform>();
                if (rt != null)
                    yield return BounceElement(rt, CoinsBounceCurve);
            }

            _coinsAnimCoroutine = null;
        }

        private IEnumerator AnimateGemsRoutine(int from, int to)
        {
            yield return AnimateCount(GemsText, from, to, CountDuration,
                val => _displayedGems = val);

            if (GemsContainer != null)
            {
                RectTransform rt = GemsContainer.GetComponent<RectTransform>();
                if (rt != null)
                    yield return BounceElement(rt, GemsBounceCurve);
            }

            _gemsAnimCoroutine = null;
        }

        private IEnumerator AnimateTicketsRoutine(int from, int to)
        {
            yield return AnimateCount(TicketsText, from, to, CountDuration,
                val => _displayedTickets = val);

            if (TicketsContainer != null)
            {
                RectTransform rt = TicketsContainer.GetComponent<RectTransform>();
                if (rt != null)
                    yield return BounceElement(rt, AnimationCurve.EaseInOut(0f, 0f, 1f, 1f));
            }

            _ticketsAnimCoroutine = null;
        }

        /// <summary>
        /// Core counting animation that tweens an integer value over time.
        /// </summary>
        private IEnumerator AnimateCount(TMP_Text text, int from, int to, float duration, Action<int> onValueChanged)
        {
            if (text == null) yield break;

            float elapsed = 0f;
            bool countingUp = to >= from;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / duration);

                // Ease out quad
                t = 1f - (1f - t) * (1f - t);

                int current = countingUp
                    ? Mathf.RoundToInt(Mathf.Lerp(from, to, t))
                    : Mathf.RoundToInt(Mathf.Lerp(from, to, t));

                text.text = current.ToString("N0");
                onValueChanged?.Invoke(current);

                yield return null;
            }

            // Ensure final value is exact
            text.text = to.ToString("N0");
            onValueChanged?.Invoke(to);
        }

        /// <summary>
        /// Bounce scale animation for visual feedback on currency change.
        /// </summary>
        private IEnumerator BounceElement(RectTransform target, AnimationCurve curve)
        {
            if (target == null) yield break;

            Vector3 baseScale = target.localScale;
            float elapsed = 0f;
            float bounceDuration = 0.3f;

            while (elapsed < bounceDuration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / bounceDuration);
                float eval = curve.Evaluate(t);
                float scale = Mathf.Lerp(1f, BounceScale, Mathf.Sin(t * Mathf.PI));
                target.localScale = baseScale * scale;
                yield return null;
            }

            target.localScale = baseScale;
        }

        // ------------------------------------------------------------------
        // Utility
        // ------------------------------------------------------------------

        private void KillCoroutine(ref Coroutine coroutine)
        {
            if (coroutine != null)
            {
                StopCoroutine(coroutine);
                coroutine = null;
            }
        }

        private void KillCoroutines()
        {
            KillCoroutine(ref _coinsAnimCoroutine);
            KillCoroutine(ref _gemsAnimCoroutine);
            KillCoroutine(ref _ticketsAnimCoroutine);
        }
    }
}
