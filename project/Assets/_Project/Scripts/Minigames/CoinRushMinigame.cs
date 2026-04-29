using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

// ---------------------------------------------------------------------------
// KawaiiCool Island - Coin Rush Minigame
// ---------------------------------------------------------------------------
// An arena collection minigame where players race to collect coins,
// grab power-ups, and avoid hazards. Features multiple coin tiers,
// power-up system with timed effects, and hazard spawning.
// ---------------------------------------------------------------------------

namespace KawaiiCool.Minigames
{
    /// <summary>
    /// Type of collectible coin with different point values.
    /// </summary>
    public enum CoinType
    {
        /// <summary>Common bronze coin worth 10 points.</summary>
        Bronze,

        /// <summary>Uncommon silver coin worth 25 points.</summary>
        Silver,

        /// <summary>Rare gold coin worth 50 points.</summary>
        Gold,

        /// <summary>Very rare diamond coin worth 100 points.</summary>
        Diamond
    }

    /// <summary>
    /// Type of power-up that can spawn in the arena.
    /// </summary>
    public enum PowerUpType
    {
        /// <summary>Automatically attracts nearby coins to the player.</summary>
        Magnet,

        /// <summary>Increases player movement speed.</summary>
        SpeedBoost,

        /// <summary>Protects the player from hazards.</summary>
        Shield,

        /// <summary>Doubles points earned from coins.</summary>
        ScoreMultiplier
    }

    /// <summary>
    /// Tracks an active power-up effect on a player, including its remaining
    /// duration and the coroutine managing it.
    /// </summary>
    public class ActivePowerUp
    {
        /// <summary>Type of power-up currently active.</summary>
        public PowerUpType Type;

        /// <summary>Seconds remaining before the power-up expires.</summary>
        public float RemainingDuration;

        /// <summary>Reference to the coroutine managing this power-up.</summary>
        public Coroutine EffectCoroutine;

        /// <summary>Visual effect GameObject associated with this power-up.</summary>
        public GameObject VisualEffect;
    }

    /// <summary>
    /// Coin Rush minigame controller. Players compete to collect coins
    /// spawning in an arena while grabbing power-ups and avoiding hazards.
    /// Features dynamic spawning, player-specific power-up tracking, and
    /// tiered scoring based on coin rarity.
    /// </summary>
    public class CoinRushMinigame : MinigameController
    {
        #region Inspector Settings

        [Header("Arena")]
        [Tooltip("Bounds of the coin spawn arena.")]
        public Bounds ArenaBounds;

        [Tooltip("Transform defining the spawn area center and size.")]
        public Transform SpawnArea;

        [Header("Spawning")]
        [Tooltip("Prefab for collectible coins.")]
        public GameObject CoinPrefab;

        [Tooltip("Prefab for power-up items.")]
        public GameObject PowerUpPrefab;

        [Tooltip("Interval between coin spawn attempts in seconds.")]
        public float SpawnInterval = 1f;

        [Tooltip("Maximum number of coins allowed on the field at once.")]
        public int MaxCoinsOnField = 20;

        [Tooltip("Maximum number of power-ups allowed on the field at once.")]
        public int MaxPowerUpsOnField = 3;

        [Header("Coins")]
        [Tooltip("Point value for Bronze coins.")]
        public int BronzeValue = 10;

        [Tooltip("Point value for Silver coins.")]
        public int SilverValue = 25;

        [Tooltip("Point value for Gold coins.")]
        public int GoldValue = 50;

        [Tooltip("Point value for Diamond coins.")]
        public int DiamondValue = 100;

        [Header("Power-Ups")]
        [Tooltip("Duration of the Magnet power-up in seconds.")]
        public float MagnetDuration = 5f;

        [Tooltip("Movement speed multiplier from Speed Boost.")]
        public float SpeedBoostMultiplier = 1.5f;

        [Tooltip("Duration of the Speed Boost power-up in seconds.")]
        public float SpeedBoostDuration = 5f;

        [Tooltip("Duration of the Shield power-up in seconds.")]
        public float ShieldDuration = 5f;

        [Tooltip("Duration of the Score Multiplier power-up in seconds.")]
        public float ScoreMultiplierDuration = 5f;

        [Tooltip("Score multiplier value when ScoreMultiplier power-up is active.")]
        public float ScoreMultiplierValue = 2f;

        [Header("Hazards")]
        [Tooltip("Prefab for hazard obstacles (spikes, traps, etc.).")]
        public GameObject SpikePrefab;

        [Tooltip("Interval between hazard spawn attempts in seconds.")]
        public float HazardSpawnInterval = 5f;

        [Tooltip("Maximum number of hazards on the field at once.")]
        public int MaxHazardsOnField = 5;

        [Header("Spawn Weights")]
        [Tooltip("Relative spawn weight for Bronze coins.")]
        public float BronzeWeight = 50f;

        [Tooltip("Relative spawn weight for Silver coins.")]
        public float SilverWeight = 30f;

        [Tooltip("Relative spawn weight for Gold coins.")]
        public float GoldWeight = 15f;

        [Tooltip("Relative spawn weight for Diamond coins.")]
        public float DiamondWeight = 5f;

        [Header("Magnet Settings")]
        [Tooltip("Radius within which the magnet attracts coins.")]
        public float MagnetRadius = 5f;

        [Tooltip("Speed at which coins are pulled by the magnet.")]
        public float MagnetPullSpeed = 8f;

        #endregion

        #region Runtime State

        /// <summary>Currently spawned coins in the arena.</summary>
        private List<GameObject> _activeCoins = new();

        /// <summary>Currently spawned power-ups in the arena.</summary>
        private List<GameObject> _activePowerUps = new();

        /// <summary>Currently spawned hazards in the arena.</summary>
        private List<GameObject> _activeHazards = new();

        /// <summary>Active power-ups per player ID.</summary>
        private Dictionary<string, ActivePowerUp> _playerPowerUps = new();

        /// <summary>Time of last coin spawn attempt.</summary>
        private float _lastSpawnTime;

        /// <summary>Time of last hazard spawn attempt.</summary>
        private float _lastHazardTime;

        /// <summary>Total coins collected across all players.</summary>
        private int _totalCoinsCollected;

        /// <summary>Running spawn timer.</summary>
        private float _spawnTimer;

        /// <summary>Running hazard timer.</summary>
        private float _hazardTimer;

        /// <summary>Cached total spawn weight for coin randomization.</summary>
        private float _totalCoinWeight;

        #endregion

        #region Initialization

        /// <summary>
        /// Called when entering the Playing state. Initializes spawn timers
        /// and pre-spawns initial coins.
        /// </summary>
        protected override void OnEnterPlaying()
        {
            base.OnEnterPlaying();

            _lastSpawnTime = Time.time;
            _lastHazardTime = Time.time;
            _spawnTimer = 0f;
            _hazardTimer = 0f;
            _totalCoinsCollected = 0;
            _totalCoinWeight = BronzeWeight + SilverWeight + GoldWeight + DiamondWeight;

            _playerPowerUps.Clear();

            // Pre-spawn initial coins
            for (int i = 0; i < Mathf.Min(10, MaxCoinsOnField); i++)
            {
                SpawnCoin();
            }

            Debug.Log("[CoinRush] Gameplay started! Collect those coins!");
        }

        #endregion

        #region Gameplay Update

        /// <summary>
        /// Called every frame during gameplay. Handles coin spawning, power-up
        /// spawning, hazard spawning, and magnet effects.
        /// </summary>
        protected override void OnUpdatePlaying()
        {
            base.OnUpdatePlaying();

            // Spawn coins on interval
            _spawnTimer += Time.deltaTime;
            if (_spawnTimer >= SpawnInterval)
            {
                _spawnTimer -= SpawnInterval;
                if (_activeCoins.Count < MaxCoinsOnField)
                {
                    SpawnCoin();
                }
            }

            // Spawn power-ups occasionally
            if (_activePowerUps.Count < MaxPowerUpsOnField && UnityEngine.Random.value < 0.005f)
            {
                SpawnPowerUp();
            }

            // Spawn hazards on interval
            _hazardTimer += Time.deltaTime;
            if (_hazardTimer >= HazardSpawnInterval)
            {
                _hazardTimer -= HazardSpawnInterval;
                if (_activeHazards.Count < MaxHazardsOnField)
                {
                    SpawnHazard();
                }
            }

            // Update magnet effects
            UpdateMagnetEffects();

            // Cleanup destroyed objects
            CleanupDestroyedObjects();
        }

        #endregion

        #region Coin Spawning

        /// <summary>
        /// Spawns a random coin at a random position within the arena bounds.
        /// Coin type is determined by weighted random selection.
        /// </summary>
        private void SpawnCoin()
        {
            if (CoinPrefab == null) return;

            CoinType coinType = GetRandomCoinType();
            Vector3 spawnPos = GetRandomSpawnPosition();

            // Ensure spawn position is above ground
            spawnPos.y = Mathf.Max(spawnPos.y, 0.5f);

            GameObject coin = Instantiate(CoinPrefab, spawnPos, Quaternion.identity, transform);

            // Set coin visual based on type (requires CoinVisual component on prefab)
            CoinVisual visual = coin.GetComponent<CoinVisual>();
            if (visual != null)
            {
                visual.SetCoinType(coinType);
            }
            else
            {
                // Fallback: set color via material
                Renderer rend = coin.GetComponent<Renderer>();
                if (rend != null)
                {
                    rend.material.color = GetCoinColor(coinType);
                }
            }

            // Store coin data for collection handling
            CoinData coinData = coin.GetComponent<CoinData>();
            if (coinData == null)
                coinData = coin.AddComponent<CoinData>();
            coinData.Type = coinType;
            coinData.Value = GetCoinValue(coinType);

            _activeCoins.Add(coin);
        }

        /// <summary>
        /// Returns a random coin type based on configured spawn weights.
        /// </summary>
        private CoinType GetRandomCoinType()
        {
            float roll = UnityEngine.Random.Range(0f, _totalCoinWeight);

            if (roll < BronzeWeight) return CoinType.Bronze;
            roll -= BronzeWeight;

            if (roll < SilverWeight) return CoinType.Silver;
            roll -= SilverWeight;

            if (roll < GoldWeight) return CoinType.Gold;

            return CoinType.Diamond;
        }

        /// <summary>
        /// Returns the point value for a given coin type.
        /// </summary>
        /// <param name="type">The coin type.</param>
        /// <returns>Point value.</returns>
        private int GetCoinValue(CoinType type)
        {
            return type switch
            {
                CoinType.Bronze => BronzeValue,
                CoinType.Silver => SilverValue,
                CoinType.Gold => GoldValue,
                CoinType.Diamond => DiamondValue,
                _ => BronzeValue
            };
        }

        /// <summary>
        /// Returns the display color for a coin type.
        /// </summary>
        private Color GetCoinColor(CoinType type)
        {
            return type switch
            {
                CoinType.Bronze => new Color(0.8f, 0.5f, 0.2f),
                CoinType.Silver => new Color(0.75f, 0.75f, 0.75f),
                CoinType.Gold => new Color(1f, 0.84f, 0f),
                CoinType.Diamond => new Color(0.7f, 0.9f, 1f),
                _ => Color.white
            };
        }

        #endregion

        #region Power-Up Spawning

        /// <summary>
        /// Spawns a random power-up at a random position in the arena.
        /// </summary>
        private void SpawnPowerUp()
        {
            if (PowerUpPrefab == null) return;

            PowerUpType powerUpType = (PowerUpType)UnityEngine.Random.Range(0, Enum.GetValues(typeof(PowerUpType)).Length);
            Vector3 spawnPos = GetRandomSpawnPosition();
            spawnPos.y = Mathf.Max(spawnPos.y, 0.5f);

            GameObject powerUp = Instantiate(PowerUpPrefab, spawnPos, Quaternion.identity, transform);

            // Set power-up visual
            PowerUpVisual visual = powerUp.GetComponent<PowerUpVisual>();
            if (visual != null)
            {
                visual.SetPowerUpType(powerUpType);
            }
            else
            {
                Renderer rend = powerUp.GetComponent<Renderer>();
                if (rend != null)
                    rend.material.color = GetPowerUpColor(powerUpType);
            }

            // Store power-up data
            PowerUpData powerUpData = powerUp.GetComponent<PowerUpData>();
            if (powerUpData == null)
                powerUpData = powerUp.AddComponent<PowerUpData>();
            powerUpData.Type = powerUpType;

            _activePowerUps.Add(powerUp);
        }

        /// <summary>
        /// Returns the color associated with each power-up type.
        /// </summary>
        private Color GetPowerUpColor(PowerUpType type)
        {
            return type switch
            {
                PowerUpType.Magnet => Color.red,
                PowerUpType.SpeedBoost => Color.cyan,
                PowerUpType.Shield => Color.green,
                PowerUpType.ScoreMultiplier => Color.yellow,
                _ => Color.white
            };
        }

        #endregion

        #region Hazard Spawning

        /// <summary>
        /// Spawns a hazard (spike/trap) at a random position in the arena.
        /// </summary>
        private void SpawnHazard()
        {
            if (SpikePrefab == null) return;

            Vector3 spawnPos = GetRandomSpawnPosition();
            spawnPos.y = 0f;

            GameObject hazard = Instantiate(SpikePrefab, spawnPos, Quaternion.identity, transform);
            _activeHazards.Add(hazard);

            // Auto-remove hazards after 10 seconds
            StartCoroutine(RemoveHazardAfterDelay(hazard, 10f));
        }

        /// <summary>
        /// Removes a hazard after a delay.
        /// </summary>
        private IEnumerator RemoveHazardAfterDelay(GameObject hazard, float delay)
        {
            yield return new WaitForSeconds(delay);
            if (hazard != null)
            {
                _activeHazards.Remove(hazard);
                Destroy(hazard);
            }
        }

        #endregion

        #region Spawn Position

        /// <summary>
        /// Gets a random spawn position within the arena bounds.
        /// Uses the SpawnArea transform if available, otherwise uses ArenaBounds.
        /// </summary>
        /// <returns>Random Vector3 within the spawn area.</returns>
        private Vector3 GetRandomSpawnPosition()
        {
            if (SpawnArea != null)
            {
                Vector3 center = SpawnArea.position;
                Vector3 scale = SpawnArea.localScale;
                return new Vector3(
                    center.x + UnityEngine.Random.Range(-scale.x / 2f, scale.x / 2f),
                    center.y + 0.5f,
                    center.z + UnityEngine.Random.Range(-scale.z / 2f, scale.z / 2f)
                );
            }

            return new Vector3(
                UnityEngine.Random.Range(ArenaBounds.min.x, ArenaBounds.max.x),
                Mathf.Max(ArenaBounds.min.y, 0.5f),
                UnityEngine.Random.Range(ArenaBounds.min.z, ArenaBounds.max.z)
            );
        }

        #endregion

        #region Collection Handling

        /// <summary>
        /// Called when a player collects a coin. Awards points with applicable
        /// score multipliers and tracks stats.
        /// </summary>
        /// <param name="playerId">The collecting player.</param>
        /// <param name="coinType">Type of coin collected.</param>
        private void OnCoinCollected(string playerId, CoinType coinType)
        {
            if (!PlayerScores.ContainsKey(playerId)) return;

            int baseValue = GetCoinValue(coinType);

            // Apply score multiplier if active
            float multiplier = GetPlayerScoreMultiplier(playerId);
            int finalValue = Mathf.RoundToInt(baseValue * multiplier);

            AddScore(playerId, finalValue);
            _totalCoinsCollected++;

            // Update stats
            PlayerScore ps = PlayerScores[playerId];
            string statKey = $"coins_{coinType.ToString().ToLower()}";
            if (!ps.Stats.ContainsKey(statKey))
                ps.Stats[statKey] = 0;
            ps.Stats[statKey]++;

            if (!ps.Stats.ContainsKey("total_coins"))
                ps.Stats["total_coins"] = 0;
            ps.Stats["total_coins"]++;

            // Play collection SFX
            PlaySFX($"coin_collect_{coinType.ToString().ToLower()}");

            Debug.Log($"[CoinRush] {ps.PlayerName} collected {coinType} coin: +{finalValue} pts");
        }

        /// <summary>
        /// Called when a player collects a power-up. Applies the effect.
        /// </summary>
        /// <param name="playerId">The collecting player.</param>
        /// <param name="powerUp">Type of power-up collected.</param>
        private void OnPowerUpCollected(string playerId, PowerUpType powerUp)
        {
            ApplyPowerUp(playerId, powerUp);
            PlaySFX($"powerup_{powerUp.ToString().ToLower()}");
            Debug.Log($"[CoinRush] {playerId} collected {powerUp} power-up!");
        }

        #endregion

        #region Power-Up System

        /// <summary>
        /// Applies a power-up effect to a player. Starts or restarts the
        /// power-up coroutine for the player.
        /// </summary>
        /// <param name="playerId">The player receiving the power-up.</param>
        /// <param name="powerUp">Type of power-up to apply.</param>
        private void ApplyPowerUp(string playerId, PowerUpType powerUp)
        {
            // Remove existing power-up of same type
            if (_playerPowerUps.ContainsKey(playerId) && _playerPowerUps[playerId].Type == powerUp)
            {
                StopCoroutine(_playerPowerUps[playerId].EffectCoroutine);
                if (_playerPowerUps[playerId].VisualEffect != null)
                    Destroy(_playerPowerUps[playerId].VisualEffect);
            }

            float duration = powerUp switch
            {
                PowerUpType.Magnet => MagnetDuration,
                PowerUpType.SpeedBoost => SpeedBoostDuration,
                PowerUpType.Shield => ShieldDuration,
                PowerUpType.ScoreMultiplier => ScoreMultiplierDuration,
                _ => 5f
            };

            ActivePowerUp active = new ActivePowerUp
            {
                Type = powerUp,
                RemainingDuration = duration,
                VisualEffect = CreatePowerUpVisual(playerId, powerUp)
            };

            active.EffectCoroutine = StartCoroutine(PowerUpCoroutine(playerId, powerUp, duration));
            _playerPowerUps[playerId] = active;
        }

        /// <summary>
        /// Coroutine that manages a power-up's duration and expiry.
        /// </summary>
        /// <param name="playerId">The player with the power-up.</param>
        /// <param name="powerUp">Type of power-up.</param>
        /// <param name="duration">Duration in seconds.</param>
        private IEnumerator PowerUpCoroutine(string playerId, PowerUpType powerUp, float duration)
        {
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;

                if (_playerPowerUps.ContainsKey(playerId))
                    _playerPowerUps[playerId].RemainingDuration = duration - elapsed;

                yield return null;
            }

            // Power-up expired
            if (_playerPowerUps.ContainsKey(playerId) && _playerPowerUps[playerId].Type == powerUp)
            {
                if (_playerPowerUps[playerId].VisualEffect != null)
                    Destroy(_playerPowerUps[playerId].VisualEffect);
                _playerPowerUps.Remove(playerId);
            }

            Debug.Log($"[CoinRush] {powerUp} expired for {playerId}");
        }

        /// <summary>
        /// Creates a visual effect GameObject attached to the player.
        /// </summary>
        private GameObject CreatePowerUpVisual(string playerId, PowerUpType powerUp)
        {
            // TODO: Instantiate visual effect at player position
            // For now, return null (visual handled by player controller)
            return null;
        }

        /// <summary>
        /// Updates magnet effects: pulls nearby coins toward players with
        /// active magnet power-ups.
        /// </summary>
        private void UpdateMagnetEffects()
        {
            foreach (var kvp in _playerPowerUps)
            {
                if (kvp.Value.Type != PowerUpType.Magnet) continue;

                string playerId = kvp.Key;
                // TODO: Get actual player position from player controller
                Vector3 playerPos = GetPlayerPosition(playerId);

                foreach (var coin in _activeCoins)
                {
                    if (coin == null) continue;

                    float dist = Vector3.Distance(coin.transform.position, playerPos);
                    if (dist < MagnetRadius)
                    {
                        Vector3 pullDir = (playerPos - coin.transform.position).normalized;
                        coin.transform.position += pullDir * MagnetPullSpeed * Time.deltaTime;
                    }
                }
            }
        }

        /// <summary>
        /// Gets a player's current position in the world.
        /// Stub — should be linked to the player controller / character system.
        /// </summary>
        private Vector3 GetPlayerPosition(string playerId)
        {
            // TODO: Get actual player position from player manager
            return Vector3.zero;
        }

        /// <summary>
        /// Gets the current score multiplier for a player (from ScoreMultiplier power-up).
        /// </summary>
        /// <param name="playerId">The player ID.</param>
        /// <returns>Score multiplier (1.0 = no bonus).</returns>
        private float GetPlayerScoreMultiplier(string playerId)
        {
            if (_playerPowerUps.ContainsKey(playerId) && _playerPowerUps[playerId].Type == PowerUpType.ScoreMultiplier)
                return ScoreMultiplierValue;
            return 1f;
        }

        #endregion

        #region Public Queries

        /// <summary>
        /// Checks if a player currently has a specific power-up active.
        /// </summary>
        /// <param name="playerId">The player ID.</param>
        /// <param name="powerUp">The power-up type to check.</param>
        /// <returns>True if the player has the power-up active.</returns>
        public bool HasPowerUp(string playerId, PowerUpType powerUp)
        {
            return _playerPowerUps.ContainsKey(playerId) && _playerPowerUps[playerId].Type == powerUp;
        }

        /// <summary>
        /// Gets the remaining duration of a player's active power-up.
        /// </summary>
        /// <param name="playerId">The player ID.</param>
        /// <returns>Seconds remaining, or 0 if no power-up is active.</returns>
        public float GetPowerUpRemaining(string playerId)
        {
            if (_playerPowerUps.ContainsKey(playerId))
                return _playerPowerUps[playerId].RemainingDuration;
            return 0f;
        }

        /// <summary>
        /// Gets the active power-up type for a player.
        /// </summary>
        /// <param name="playerId">The player ID.</param>
        /// <returns>The active power-up type, or null if none.</returns>
        public PowerUpType? GetActivePowerUp(string playerId)
        {
            if (_playerPowerUps.ContainsKey(playerId))
                return _playerPowerUps[playerId].Type;
            return null;
        }

        #endregion

        #region Cleanup

        /// <summary>
        /// Removes null references from the active object lists.
        /// </summary>
        private void CleanupDestroyedObjects()
        {
            _activeCoins.RemoveAll(c => c == null);
            _activePowerUps.RemoveAll(p => p == null);
            _activeHazards.RemoveAll(h => h == null);
        }

        /// <summary>
        /// Called when returning to Inactive state. Destroys all spawned objects.
        /// </summary>
        protected override void OnEnterInactive()
        {
            base.OnEnterInactive();

            // Destroy all coins
            foreach (var coin in _activeCoins)
            {
                if (coin != null) Destroy(coin);
            }
            _activeCoins.Clear();

            // Destroy all power-ups
            foreach (var powerUp in _activePowerUps)
            {
                if (powerUp != null) Destroy(powerUp);
            }
            _activePowerUps.Clear();

            // Destroy all hazards
            foreach (var hazard in _activeHazards)
            {
                if (hazard != null) Destroy(hazard);
            }
            _activeHazards.Clear();

            // Clear player power-ups
            _playerPowerUps.Clear();

            Debug.Log("[CoinRush] All objects cleaned up.");
        }

        #endregion

        #region Reward Calculation

        /// <summary>
        /// Calculates rewards based on coins collected and final rank.
        /// </summary>
        protected override void CalculateRewards()
        {
            base.CalculateRewards();

            var sortedScores = GetSortedScores();

            for (int i = 0; i < sortedScores.Count; i++)
            {
                PlayerScore ps = sortedScores[i];
                int rank = i + 1;

                // Rank-based coin bonus
                switch (rank)
                {
                    case 1:
                        ps.Rewards.Add(new RewardData { RewardType = "coins", RewardId = "coins_gold", Amount = 200 });
                        ps.Rewards.Add(new RewardData { RewardType = "item", RewardId = "coinrush_winner", Amount = 1, Probability = 0.5f });
                        break;
                    case 2:
                        ps.Rewards.Add(new RewardData { RewardType = "coins", RewardId = "coins_silver", Amount = 150 });
                        break;
                    case 3:
                        ps.Rewards.Add(new RewardData { RewardType = "coins", RewardId = "coins_bronze", Amount = 100 });
                        break;
                    default:
                        ps.Rewards.Add(new RewardData { RewardType = "coins", RewardId = "coins_participation", Amount = 50 });
                        break;
                }

                // Bonus for collecting diamond coins
                if (ps.Stats.ContainsKey("coins_diamond") && ps.Stats["coins_diamond"] > 0)
                {
                    ps.Rewards.Add(new RewardData { RewardType = "gems", RewardId = "gem_lucky", Amount = ps.Stats["coins_diamond"] });
                }
            }
        }

        #endregion

        #region Network RPC Stubs

        /// <summary>
        /// Stub for network-synchronized coin collection.
        /// </summary>
        protected virtual void RpcCoinCollected(string playerId, CoinType coinType, Vector3 position)
        {
            // Override in networked subclass
        }

        /// <summary>
        /// Stub for network-synchronized power-up collection.
        /// </summary>
        protected virtual void RpcPowerUpCollected(string playerId, PowerUpType powerUp, Vector3 position)
        {
            // Override in networked subclass
        }

        #endregion

        #region Debug API

        /// <summary>
        /// Gets the total number of coins collected in this session.
        /// </summary>
        public int GetTotalCoinsCollected() => _totalCoinsCollected;

        /// <summary>
        /// Gets the number of coins currently on the field.
        /// </summary>
        public int GetActiveCoinCount() => _activeCoins.Count;

        /// <summary>
        /// Gets the number of power-ups currently on the field.
        /// </summary>
        public int GetActivePowerUpCount() => _activePowerUps.Count;

        /// <summary>
        /// Manually triggers a coin collection for testing.
        /// </summary>
        public void DebugCollectCoin(string playerId, CoinType type)
        {
            OnCoinCollected(playerId, type);
        }

        #endregion
    }

    #region Helper Components

    /// <summary>
    /// Simple data component attached to spawned coins. Identifies the coin
    /// type and value for collection handling.
    /// </summary>
    public class CoinData : MonoBehaviour
    {
        public CoinType Type;
        public int Value;
        public float SpinSpeed = 180f;

        private void Update()
        {
            transform.Rotate(0f, SpinSpeed * Time.deltaTime, 0f);
        }
    }

    /// <summary>
    /// Simple data component attached to spawned power-ups. Identifies the
    /// power-up type for collection handling.
    /// </summary>
    public class PowerUpData : MonoBehaviour
    {
        public PowerUpType Type;
        public float BobSpeed = 2f;
        public float BobHeight = 0.25f;
        private float _initialY;
        private float _bobOffset;

        private void Start()
        {
            _initialY = transform.position.y;
            _bobOffset = UnityEngine.Random.Range(0f, Mathf.PI * 2f);
        }

        private void Update()
        {
            float bob = Mathf.Sin((Time.time + _bobOffset) * BobSpeed) * BobHeight;
            Vector3 pos = transform.position;
            pos.y = _initialY + bob;
            transform.position = pos;

            transform.Rotate(0f, 90f * Time.deltaTime, 0f);
        }
    }

    /// <summary>
    /// Interface for coin visual components. Implement this to handle
    /// per-coin-type visual customization.
    /// </summary>
    public interface ICoinVisual
    {
        void SetCoinType(CoinType type);
    }

    /// <summary>
    /// Placeholder component for coin visual customization.
    /// </summary>
    public class CoinVisual : MonoBehaviour, ICoinVisual
    {
        [SerializeField] private Renderer _renderer;

        public void SetCoinType(CoinType type)
        {
            if (_renderer == null) _renderer = GetComponent<Renderer>();
            if (_renderer == null) return;

            _renderer.material.color = type switch
            {
                CoinType.Bronze => new Color(0.8f, 0.5f, 0.2f),
                CoinType.Silver => new Color(0.75f, 0.75f, 0.75f),
                CoinType.Gold => new Color(1f, 0.84f, 0f),
                CoinType.Diamond => new Color(0.7f, 0.9f, 1f),
                _ => Color.white
            };
        }
    }

    /// <summary>
    /// Placeholder component for power-up visual customization.
    /// </summary>
    public class PowerUpVisual : MonoBehaviour
    {
        [SerializeField] private Renderer _renderer;
        [SerializeField] private ParticleSystem _glowEffect;

        public void SetPowerUpType(PowerUpType type)
        {
            if (_renderer == null) _renderer = GetComponent<Renderer>();
            if (_renderer == null) return;

            _renderer.material.color = type switch
            {
                PowerUpType.Magnet => Color.red,
                PowerUpType.SpeedBoost => Color.cyan,
                PowerUpType.Shield => Color.green,
                PowerUpType.ScoreMultiplier => Color.yellow,
                _ => Color.white
            };

            if (_glowEffect != null)
                _glowEffect.Play();
        }
    }

    #endregion
}
