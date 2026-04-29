using System.Collections.Generic;
using UnityEngine;

namespace KawaiiCoolIsland.Trading
{
    /// <summary>
    /// Calculates trade values for items and full trade offers, providing
    /// fairness ratings and color-coded visual feedback for the trade UI.
    /// </summary>
    public class TradeValueCalculator : MonoBehaviour
    {
        #region Singleton

        private static TradeValueCalculator _instance;
        public static TradeValueCalculator Instance
        {
            get
            {
                if (_instance == null)
                {
                    _instance = FindObjectOfType<TradeValueCalculator>();
                    if (_instance == null)
                    {
                        var go = new GameObject("TradeValueCalculator");
                        _instance = go.AddComponent<TradeValueCalculator>();
                    }
                }
                return _instance;
            }
        }

        private void Awake()
        {
            if (_instance != null && _instance != this)
            {
                Destroy(gameObject);
                return;
            }
            _instance = this;
        }

        #endregion

        #region Settings

        [Header("Value Sources")]
        [SerializeField] private bool _useShopPrice = true;
        [SerializeField] private bool _useRarityMultiplier = true;
        [SerializeField] private bool _useDemandFactor = true;

        [Header("Multipliers")]
        [SerializeField] private float _commonMultiplier = 1f;
        [SerializeField] private float _uncommonMultiplier = 1.5f;
        [SerializeField] private float _rareMultiplier = 3f;
        [SerializeField] private float _epicMultiplier = 8f;
        [SerializeField] private float _legendaryMultiplier = 20f;

        [Header("Fairness Thresholds")]
        [SerializeField] private float _veryFairThreshold = 0.05f;
        [SerializeField] private float _fairThreshold = 0.20f;
        [SerializeField] private float _slightlyUnfairThreshold = 0.40f;
        [SerializeField] private float _unfairThreshold = 0.70f;

        [Header("Demand Factor Settings")]
        [SerializeField] private float _baseDemandValue = 1.0f;
        [SerializeField] private AnimationCurve _demandCurve = AnimationCurve.EaseInOut(0f, 0.5f, 1f, 2f);

        private Dictionary<string, float> _demandCache = new Dictionary<string, float>();

        #endregion

        #region Public API

        /// <summary>
        /// Calculates the trade value of an item by its item ID.
        /// Considers shop price, rarity multiplier, and market demand when enabled.
        /// </summary>
        /// <param name="itemId">The unique item identifier.</param>
        /// <returns>The computed trade value (always non-negative).</returns>
        public int CalculateItemValue(string itemId)
        {
            if (string.IsNullOrEmpty(itemId)) return 0;

            var itemData = GameAPIClient.Instance?.GetItemData(itemId);
            if (itemData == null) return 0;

            return CalculateItemValue(itemData);
        }

        /// <summary>
        /// Calculates the trade value of an item directly from its ItemData.
        /// </summary>
        /// <param name="item">The item data to evaluate.</param>
        /// <returns>The computed trade value (always non-negative).</returns>
        public int CalculateItemValue(ItemData item)
        {
            if (item == null) return 0;

            float value = 0f;

            // Base value from shop price
            if (_useShopPrice)
            {
                value = item.Price;
            }
            else
            {
                value = 100f; // Default base when shop price disabled
            }

            // Rarity multiplier
            if (_useRarityMultiplier)
            {
                value *= GetRarityMultiplier(item.Rarity);
            }

            // Demand factor (market-driven value fluctuation)
            if (_useDemandFactor)
            {
                value *= GetDemandFactor(item.ItemId);
            }

            // Premium items get a slight bonus
            if (item.IsPremium)
            {
                value *= 1.1f;
            }

            // Tradeable restriction penalty (non-tradeable items shouldn't reach here, but safeguard)
            if (!item.IsTradeable)
            {
                value = 0f;
            }

            return Mathf.Max(0, Mathf.RoundToInt(value));
        }

        /// <summary>
        /// Calculates the total trade value of a set of trade slots and currencies.
        /// </summary>
        /// <param name="slots">List of item trade slots.</param>
        /// <param name="currencies">Dictionary of currency type to amount.</param>
        /// <returns>The total combined trade value.</returns>
        public int CalculateTradeValue(List<TradeSlot> slots, Dictionary<string, int> currencies)
        {
            int total = 0;

            if (slots != null)
            {
                foreach (var slot in slots)
                {
                    if (slot == null) continue;
                    int unitValue = slot.Data != null ? CalculateItemValue(slot.Data) : GetFallbackValue(slot.ItemId);
                    total += unitValue * Mathf.Max(1, slot.Quantity);
                }
            }

            if (currencies != null)
            {
                foreach (var kvp in currencies)
                {
                    // Currency typically maps 1:1, but premium currency gets a slight premium
                    float multiplier = kvp.Key.Contains("Gem") || kvp.Key.Contains("Premium") ? 1.2f : 1.0f;
                    total += Mathf.RoundToInt(kvp.Value * multiplier);
                }
            }

            return total;
        }

        /// <summary>
        /// Rates the fairness of a trade by comparing the initiator's and target's offer values.
        /// </summary>
        /// <param name="offerValue">Value of the local player's offer.</param>
        /// <param name="requestValue">Value of the partner's offer.</param>
        /// <returns>A fairness rating from VeryFair to VeryUnfair.</returns>
        public FairnessRating RateFairness(int offerValue, int requestValue)
        {
            int maxValue = Mathf.Max(offerValue, requestValue, 1);
            int difference = Mathf.Abs(offerValue - requestValue);
            float ratio = (float)difference / maxValue;

            if (ratio <= _veryFairThreshold)
                return FairnessRating.VeryFair;
            if (ratio <= _fairThreshold)
                return FairnessRating.Fair;
            if (ratio <= _slightlyUnfairThreshold)
                return FairnessRating.SlightlyUnfair;
            if (ratio <= _unfairThreshold)
                return FairnessRating.Unfair;

            return FairnessRating.VeryUnfair;
        }

        /// <summary>
        /// Gets the color associated with a fairness rating for UI display.
        /// </summary>
        /// <param name="rating">The fairness rating to convert.</param>
        /// <returns>A Unity Color suitable for UI tinting.</returns>
        public Color GetFairnessColor(FairnessRating rating)
        {
            return rating switch
            {
                FairnessRating.VeryFair => new Color(0.2f, 0.9f, 0.3f),     // Bright green
                FairnessRating.Fair => new Color(0.4f, 0.8f, 0.4f),          // Green
                FairnessRating.SlightlyUnfair => new Color(1f, 0.9f, 0.2f),  // Yellow
                FairnessRating.Unfair => new Color(1f, 0.5f, 0.1f),          // Orange
                FairnessRating.VeryUnfair => new Color(0.9f, 0.1f, 0.1f),    // Red
                _ => Color.white
            };
        }

        /// <summary>
        /// Gets a human-readable description of the fairness rating.
        /// </summary>
        /// <param name="rating">The fairness rating to describe.</param>
        /// <returns>A localized-style string describing the fairness level.</returns>
        public string GetFairnessText(FairnessRating rating)
        {
            return rating switch
            {
                FairnessRating.VeryFair => "Very Fair",
                FairnessRating.Fair => "Fair",
                FairnessRating.SlightlyUnfair => "Slightly Unfair",
                FairnessRating.Unfair => "Unfair",
                FairnessRating.VeryUnfair => "Very Unfair",
                _ => "Unknown"
            };
        }

        /// <summary>
        /// Gets the rarity multiplier for a given item rarity.
        /// </summary>
        /// <param name="rarity">The item rarity.</param>
        /// <returns>The configured multiplier.</returns>
        public float GetRarityMultiplier(ItemRarity rarity)
        {
            return rarity switch
            {
                ItemRarity.Common => _commonMultiplier,
                ItemRarity.Uncommon => _uncommonMultiplier,
                ItemRarity.Rare => _rareMultiplier,
                ItemRarity.Epic => _epicMultiplier,
                ItemRarity.Legendary => _legendaryMultiplier,
                _ => _commonMultiplier
            };
        }

        #endregion

        #region Private Helpers

        /// <summary>
        /// Retrieves the current market demand factor for an item.
        /// Falls back to a default neutral value if demand data is unavailable.
        /// </summary>
        /// <param name="itemId">The item to look up demand for.</param>
        /// <returns>A multiplier representing current market demand.</returns>
        private float GetDemandFactor(string itemId)
        {
            if (!_useDemandFactor) return 1f;
            if (string.IsNullOrEmpty(itemId)) return 1f;

            if (_demandCache.TryGetValue(itemId, out float cached))
                return cached;

            // Attempt to fetch from GameAPIClient
            float demandScore = GameAPIClient.Instance?.GetItemDemandScore(itemId) ?? _baseDemandValue;
            float factor = _demandCurve.Evaluate(demandScore);

            _demandCache[itemId] = factor;
            return factor;
        }

        /// <summary>
        /// Returns a fallback value for an item when its ItemData is not available.
        /// </summary>
        /// <param name="itemId">The item identifier.</param>
        /// <returns>A default value of 50.</returns>
        private int GetFallbackValue(string itemId)
        {
            return 50;
        }

        /// <summary>
        /// Clears the cached demand data. Call this when market conditions change.
        /// </summary>
        public void ClearDemandCache()
        {
            _demandCache.Clear();
        }

        #endregion
    }

    /// <summary>
    /// Enumeration of fairness ratings from very fair to very unfair.
    /// </summary>
    public enum FairnessRating
    {
        VeryFair,
        Fair,
        SlightlyUnfair,
        Unfair,
        VeryUnfair
    }
}
