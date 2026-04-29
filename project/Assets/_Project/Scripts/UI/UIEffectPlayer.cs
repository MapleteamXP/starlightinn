using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace KawaiiCoolIsland.UI
{
    /// <summary>
    /// Plays particle and visual effects on UI interactions.
    /// Handles click particles, hover scaling, success/error feedback,
    /// color flashes, pulses, and floating text animations.
    /// </summary>
    public class UIEffectPlayer : MonoBehaviour
    {
        #region Inspector - Click Effects
        [Header("Click Effects")]
        [Tooltip("Particle system prefab instantiated at click positions.")]
        public ParticleSystem ClickParticles;

        [Tooltip("Optional audio clip played on UI click.")]
        public AudioClip ClickSFX;

        [Tooltip("If true, spawns a ripple effect on click.")]
        public bool EnableClickRipple = true;

        [Tooltip("Color of the click ripple effect.")]
        public Color RippleColor = new Color(1f, 1f, 1f, 0.5f);

        [Tooltip("Duration of the click ripple in seconds.")]
        public float RippleDuration = 0.4f;

        [Tooltip("Maximum scale of the click ripple.")]
        public float RippleMaxScale = 3f;
        #endregion

        #region Inspector - Hover Effects
        [Header("Hover Effects")]
        [Tooltip("Scale multiplier applied on hover (1.1 = 110% of original).")]
        public float HoverScaleMultiplier = 1.1f;

        [Tooltip("Duration of the hover scale transition.")]
        public float HoverTransitionDuration = 0.1f;

        [Tooltip("If true, also changes the element's color on hover.")]
        public bool EnableHoverColor = false;

        [Tooltip("Color tint applied on hover (if EnableHoverColor is true).")]
        public Color HoverTintColor = new Color(0.9f, 0.9f, 0.9f, 1f);

        [Tooltip("Easing curve for hover transitions.")]
        public AnimationCurve HoverCurve = AnimationCurve.EaseInOut(0, 0, 1, 1);
        #endregion

        #region Inspector - Success Effects
        [Header("Success Effects")]
        [Tooltip("Particle system played on success actions.")]
        public ParticleSystem SuccessParticles;

        [Tooltip("Color used for success flash effect.")]
        public Color SuccessFlashColor = new Color(0.2f, 1f, 0.2f, 1f);

        [Tooltip("Duration of the success flash in seconds.")]
        public float SuccessFlashDuration = 0.3f;

        [Tooltip("Number of flashes during the success effect.")]
        public int SuccessFlashCount = 1;

        [Tooltip("Optional audio clip for success sound.")]
        public AudioClip SuccessSFX;
        #endregion

        #region Inspector - Error Effects
        [Header("Error Effects")]
        [Tooltip("Particle system played on error actions.")]
        public ParticleSystem ErrorParticles;

        [Tooltip("Color used for error flash effect.")]
        public Color ErrorFlashColor = new Color(1f, 0.2f, 0.2f, 1f);

        [Tooltip("Duration of the error flash in seconds.")]
        public float ErrorFlashDuration = 0.3f;

        [Tooltip("Number of flashes during the error effect.")]
        public int ErrorFlashCount = 2;

        [Tooltip("If true, also applies a shake effect on error.")]
        public bool ShakeOnError = true;

        [Tooltip("Shake intensity in pixels.")]
        public float ErrorShakeIntensity = 10f;

        [Tooltip("Optional audio clip for error sound.")]
        public AudioClip ErrorSFX;
        #endregion

        #region Inspector - Floating Text
        [Header("Floating Text")]
        [Tooltip("Prefab for floating text (should have TextMeshProUGUI component).")]
        public GameObject FloatingTextPrefab;

        [Tooltip("Canvas to spawn floating text on (defaults to OverlayCanvas).")]
        public Canvas TargetCanvas;

        [Tooltip("Default upward drift speed for floating text.")]
        public float FloatingTextDriftSpeed = 50f;

        [Tooltip("Default duration for floating text.")]
        public float FloatingTextDuration = 1f;
        #endregion

        #region Inspector - Pooling
        [Header("Pooling")]
        [Tooltip("If true, pools particle effects for better performance.")]
        public bool UseObjectPooling = true;

        [Tooltip("Initial pool size for each particle system type.")]
        public int PoolSize = 5;
        #endregion

        #region Private State
        private AudioSource _audioSource;
        private readonly Dictionary<ParticleSystem, Queue<ParticleSystem>> _particlePools = new();
        private readonly Dictionary<RectTransform, Coroutine> _activeHovers = new();
        private readonly Dictionary<RectTransform, Vector3> _originalScales = new();
        private Canvas _cachedCanvas;
        #endregion

        #region Singleton Access
        private static UIEffectPlayer _instance;
        public static UIEffectPlayer Instance
        {
            get
            {
                if (_instance == null)
                    _instance = FindFirstObjectByType<UIEffectPlayer>();
                return _instance;
            }
        }
        #endregion

        #region Unity Lifecycle
        private void Awake()
        {
            _instance = this;
            _audioSource = GetComponent<AudioSource>();
            if (_audioSource == null && (ClickSFX != null || SuccessSFX != null || ErrorSFX != null))
            {
                _audioSource = gameObject.AddComponent<AudioSource>();
                _audioSource.playOnAwake = false;
            }

            if (TargetCanvas == null)
            {
                TargetCanvas = GetComponentInParent<Canvas>();
            }

            if (UseObjectPooling)
            {
                InitializePools();
            }
        }

        private void OnDestroy()
        {
            if (_instance == this)
                _instance = null;
        }
        #endregion

        #region Click Effects
        /// <summary>
        /// Plays the click particle and sound effects at the specified screen position.
        /// </summary>
        /// <param name="screenPosition">Screen-space position for the effect.</param>
        public void PlayClickEffect(Vector2 screenPosition)
        {
            PlayParticlesAtPosition(ClickParticles, screenPosition);
            PlaySFX(ClickSFX);

            if (EnableClickRipple)
            {
                SpawnClickRipple(screenPosition);
            }
        }

        /// <summary>
        /// Plays click effect at the position of the specified RectTransform.
        /// </summary>
        /// <param name="target">RectTransform to use as effect origin.</param>
        public void PlayClickEffect(RectTransform target)
        {
            if (target == null) return;
            Vector2 screenPos = RectTransformUtility.WorldToScreenPoint(null, target.position);
            PlayClickEffect(screenPos);
        }
        #endregion

        #region Success Effects
        /// <summary>
        /// Plays the success particle, sound, and flash effects.
        /// </summary>
        /// <param name="screenPosition">Screen-space position for particles.</param>
        public void PlaySuccessEffect(Vector2 screenPosition)
        {
            PlayParticlesAtPosition(SuccessParticles, screenPosition);
            PlaySFX(SuccessSFX);
        }

        /// <summary>
        /// Plays success effects on a specific UI element with color flash.
        /// </summary>
        /// <param name="target">The UI element to flash.</param>
        public void PlaySuccessEffect(RectTransform target)
        {
            if (target == null) return;

            Vector2 screenPos = RectTransformUtility.WorldToScreenPoint(null, target.position);
            PlaySuccessEffect(screenPos);

            // Flash the image component
            var image = target.GetComponent<Image>();
            if (image != null)
            {
                FlashColor(image, SuccessFlashColor, SuccessFlashDuration, SuccessFlashCount);
            }

            // Also try TextMeshPro
            var tmpText = target.GetComponent<TextMeshProUGUI>();
            if (tmpText != null)
            {
                FlashTextColor(tmpText, SuccessFlashColor, SuccessFlashDuration, SuccessFlashCount);
            }
        }
        #endregion

        #region Error Effects
        /// <summary>
        /// Plays the error particle, sound, and flash effects.
        /// </summary>
        /// <param name="screenPosition">Screen-space position for particles.</param>
        public void PlayErrorEffect(Vector2 screenPosition)
        {
            PlayParticlesAtPosition(ErrorParticles, screenPosition);
            PlaySFX(ErrorSFX);
        }

        /// <summary>
        /// Plays error effects on a specific UI element with color flash and optional shake.
        /// </summary>
        /// <param name="target">The UI element to flash and shake.</param>
        public void PlayErrorEffect(RectTransform target)
        {
            if (target == null) return;

            Vector2 screenPos = RectTransformUtility.WorldToScreenPoint(null, target.position);
            PlayErrorEffect(screenPos);

            // Flash the image component
            var image = target.GetComponent<Image>();
            if (image != null)
            {
                FlashColor(image, ErrorFlashColor, ErrorFlashDuration, ErrorFlashCount);
            }

            // Also try TextMeshPro
            var tmpText = target.GetComponent<TextMeshProUGUI>();
            if (tmpText != null)
            {
                FlashTextColor(tmpText, ErrorFlashColor, ErrorFlashDuration, ErrorFlashCount);
            }

            // Shake
            if (ShakeOnError)
            {
                ShakeElement(target, ErrorShakeIntensity, ErrorFlashDuration);
            }
        }
        #endregion

        #region Hover Effects
        /// <summary>
        /// Applies hover scale-up effect to a UI element.
        /// </summary>
        /// <param name="target">The RectTransform to scale.</param>
        public void PlayHoverEffect(RectTransform target)
        {
            if (target == null) return;

            // Store original scale
            if (!_originalScales.ContainsKey(target))
            {
                _originalScales[target] = target.localScale;
            }

            // Cancel any existing hover on this target
            if (_activeHovers.TryGetValue(target, out var existingCoroutine))
            {
                if (existingCoroutine != null)
                    StopCoroutine(existingCoroutine);
            }

            _activeHovers[target] = StartCoroutine(HoverScaleCoroutine(target, HoverScaleMultiplier));

            // Apply hover color
            if (EnableHoverColor)
            {
                var image = target.GetComponent<Image>();
                if (image != null)
                {
                    image.color = HoverTintColor;
                }
            }
        }

        /// <summary>
        /// Removes hover effect and restores original scale.
        /// </summary>
        /// <param name="target">The RectTransform to restore.</param>
        public void PlayUnhoverEffect(RectTransform target)
        {
            if (target == null) return;

            if (_activeHovers.TryGetValue(target, out var existingCoroutine))
            {
                if (existingCoroutine != null)
                    StopCoroutine(existingCoroutine);
            }

            Vector3 originalScale = _originalScales.ContainsKey(target)
                ? _originalScales[target]
                : Vector3.one;

            _activeHovers[target] = StartCoroutine(HoverScaleCoroutine(target, 1f, originalScale));

            // Restore original color
            if (EnableHoverColor)
            {
                var image = target.GetComponent<Image>();
                if (image != null)
                {
                    image.color = Color.white;
                }
            }
        }
        #endregion

        #region Color Flash
        /// <summary>
        /// Flashes an Image component with a specified color.
        /// </summary>
        /// <param name="target">The Image to flash.</param>
        /// <param name="flashColor">Color to flash.</param>
        /// <param name="duration">Flash duration per cycle.</param>
        /// <param name="flashCount">Number of flash cycles.</param>
        public void FlashColor(Image target, Color flashColor, float duration, int flashCount = 1)
        {
            if (target == null) return;
            StartCoroutine(FlashColorCoroutine(target, flashColor, duration, flashCount));
        }

        /// <summary>
        /// Flashes a TextMeshProUGUI component with a specified color.
        /// </summary>
        /// <param name="target">The TextMeshProUGUI to flash.</param>
        /// <param name="flashColor">Color to flash.</param>
        /// <param name="duration">Flash duration per cycle.</param>
        /// <param name="flashCount">Number of flash cycles.</param>
        public void FlashTextColor(TextMeshProUGUI target, Color flashColor, float duration, int flashCount = 1)
        {
            if (target == null) return;
            StartCoroutine(FlashTextColorCoroutine(target, flashColor, duration, flashCount));
        }
        #endregion

        #region Pulse / Shake
        /// <summary>
        /// Applies a pulse scale animation to a UI element.
        /// </summary>
        /// <param name="target">The RectTransform to pulse.</param>
        /// <param name="scale">Maximum scale multiplier during pulse.</param>
        /// <param name="duration">Duration of one pulse cycle.</param>
        public void PulseElement(RectTransform target, float scale, float duration)
        {
            if (target == null) return;
            StartCoroutine(UITransitions.PunchScale(target, scale, duration));
        }

        /// <summary>
        /// Shakes a UI element with random jitter.
        /// </summary>
        /// <param name="target">The RectTransform to shake.</param>
        /// <param name="intensity">Maximum pixel offset.</param>
        /// <param name="duration">Shake duration.</param>
        public void ShakeElement(RectTransform target, float intensity, float duration)
        {
            if (target == null) return;
            StartCoroutine(UITransitions.Shake(target, intensity, duration));
        }
        #endregion

        #region Floating Text
        /// <summary>
        /// Spawns floating text at a screen position that drifts upward and fades out.
        /// </summary>
        /// <param name="position">Screen-space spawn position.</param>
        /// <param name="text">Text content to display.</param>
        /// <param name="color">Text color.</param>
        /// <param name="duration">How long the text remains visible.</param>
        public void FloatingText(Vector2 position, string text, Color color, float duration = 1f)
        {
            if (string.IsNullOrEmpty(text)) return;

            GameObject textObj;
            TextMeshProUGUI tmpText = null;

            if (FloatingTextPrefab != null)
            {
                Transform parent = TargetCanvas != null ? TargetCanvas.transform : transform;
                textObj = Instantiate(FloatingTextPrefab, parent, false);
                tmpText = textObj.GetComponentInChildren<TextMeshProUGUI>();
            }
            else
            {
                // Create a simple floating text object
                Transform parent = TargetCanvas != null ? TargetCanvas.transform : transform;
                textObj = new GameObject("FloatingText");
                textObj.transform.SetParent(parent, false);
                tmpText = textObj.AddComponent<TextMeshProUGUI>();
                tmpText.alignment = TextAlignmentOptions.Center;
                tmpText.fontSize = 36f;
            }

            if (tmpText != null)
            {
                tmpText.text = text;
                tmpText.color = color;
            }

            // Position
            RectTransform rt = textObj.GetComponent<RectTransform>();
            if (rt != null)
            {
                Vector2 localPos;
                RectTransform canvasRT = TargetCanvas != null
                    ? TargetCanvas.GetComponent<RectTransform>()
                    : GetComponent<RectTransform>();
                RectTransformUtility.ScreenPointToLocalPointInRectangle(canvasRT, position, null, out localPos);
                rt.anchoredPosition = localPos;
            }

            // Animate
            StartCoroutine(AnimateFloatingText(textObj, duration));
        }

        /// <summary>
        /// Spawns floating text at the position of a UI element.
        /// </summary>
        /// <param name="target">The UI element to spawn text above.</param>
        /// <param name="text">Text content.</param>
        /// <param name="color">Text color.</param>
        /// <param name="duration">Visibility duration.</param>
        public void FloatingText(RectTransform target, string text, Color color, float duration = 1f)
        {
            if (target == null) return;
            Vector2 screenPos = RectTransformUtility.WorldToScreenPoint(null, target.position);
            FloatingText(screenPos + Vector2.up * target.rect.height * 0.5f, text, color, duration);
        }
        #endregion

        #region Private Coroutines
        private IEnumerator FlashColorCoroutine(Image target, Color flashColor, float duration, int flashCount)
        {
            Color originalColor = target.color;

            for (int i = 0; i < flashCount; i++)
            {
                float elapsed = 0f;
                while (elapsed < duration * 0.5f)
                {
                    elapsed += Time.unscaledDeltaTime;
                    float t = elapsed / (duration * 0.5f);
                    target.color = Color.Lerp(originalColor, flashColor, t);
                    yield return null;
                }

                elapsed = 0f;
                while (elapsed < duration * 0.5f)
                {
                    elapsed += Time.unscaledDeltaTime;
                    float t = elapsed / (duration * 0.5f);
                    target.color = Color.Lerp(flashColor, originalColor, t);
                    yield return null;
                }
            }

            target.color = originalColor;
        }

        private IEnumerator FlashTextColorCoroutine(TextMeshProUGUI target, Color flashColor, float duration, int flashCount)
        {
            Color originalColor = target.color;

            for (int i = 0; i < flashCount; i++)
            {
                float elapsed = 0f;
                while (elapsed < duration * 0.5f)
                {
                    elapsed += Time.unscaledDeltaTime;
                    float t = elapsed / (duration * 0.5f);
                    target.color = Color.Lerp(originalColor, flashColor, t);
                    yield return null;
                }

                elapsed = 0f;
                while (elapsed < duration * 0.5f)
                {
                    elapsed += Time.unscaledDeltaTime;
                    float t = elapsed / (duration * 0.5f);
                    target.color = Color.Lerp(flashColor, originalColor, t);
                    yield return null;
                }
            }

            target.color = originalColor;
        }

        private IEnumerator HoverScaleCoroutine(RectTransform target, float targetScaleMultiplier, Vector3? originalScale = null)
        {
            Vector3 origScale = originalScale ?? (_originalScales.ContainsKey(target) ? _originalScales[target] : target.localScale);
            Vector3 targetScale = origScale * targetScaleMultiplier;
            float elapsed = 0f;

            while (elapsed < HoverTransitionDuration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / HoverTransitionDuration);
                float easedT = HoverCurve.Evaluate(t);
                target.localScale = Vector3.LerpUnclamped(target.localScale, targetScale, easedT);
                yield return null;
            }

            target.localScale = targetScale;
        }

        private IEnumerator AnimateFloatingText(GameObject textObj, float duration)
        {
            RectTransform rt = textObj.GetComponent<RectTransform>();
            CanvasGroup cg = textObj.GetComponent<CanvasGroup>();
            if (cg == null)
                cg = textObj.AddComponent<CanvasGroup>();

            float elapsed = 0f;
            Vector2 startPos = rt != null ? rt.anchoredPosition : Vector2.zero;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = elapsed / duration;

                // Drift upward
                if (rt != null)
                {
                    rt.anchoredPosition = startPos + Vector2.up * FloatingTextDriftSpeed * elapsed;
                }

                // Fade out in last 30%
                if (t > 0.7f)
                {
                    cg.alpha = 1f - (t - 0.7f) / 0.3f;
                }

                yield return null;
            }

            Destroy(textObj);
        }
        #endregion

        #region Private Helpers
        private void PlayParticlesAtPosition(ParticleSystem prefab, Vector2 screenPosition)
        {
            if (prefab == null) return;

            ParticleSystem particles;

            if (UseObjectPooling && _particlePools.ContainsKey(prefab) && _particlePools[prefab].Count > 0)
            {
                particles = _particlePools[prefab].Dequeue();
                particles.gameObject.SetActive(true);
            }
            else
            {
                Transform parent = TargetCanvas != null ? TargetCanvas.transform : transform;
                GameObject go = Instantiate(prefab.gameObject, parent, false);
                particles = go.GetComponent<ParticleSystem>();
            }

            // Convert screen position to canvas-local position
            if (TargetCanvas != null)
            {
                RectTransform canvasRT = TargetCanvas.GetComponent<RectTransform>();
                Vector2 localPos;
                RectTransformUtility.ScreenPointToLocalPointInRectangle(canvasRT, screenPosition,
                    TargetCanvas.renderMode == RenderMode.ScreenSpaceCamera ? TargetCanvas.worldCamera : null,
                    out localPos);

                RectTransform particleRT = particles.GetComponent<RectTransform>();
                if (particleRT != null)
                    particleRT.anchoredPosition = localPos;
                else
                    particles.transform.position = new Vector3(localPos.x, localPos.y, particles.transform.position.z);
            }
            else
            {
                particles.transform.position = new Vector3(screenPosition.x, screenPosition.y, 0f);
            }

            particles.Play();

            // Return to pool after playback
            if (UseObjectPooling)
            {
                float delay = particles.main.duration + particles.main.startLifetime.constantMax;
                StartCoroutine(ReturnToPool(particles, prefab, delay));
            }
            else
            {
                float delay = particles.main.duration + particles.main.startLifetime.constantMax;
                Destroy(particles.gameObject, delay);
            }
        }

        private void SpawnClickRipple(Vector2 screenPosition)
        {
            Transform parent = TargetCanvas != null ? TargetCanvas.transform : transform;
            GameObject ripple = new GameObject("ClickRipple");
            ripple.transform.SetParent(parent, false);

            // Add image
            Image rippleImage = ripple.AddComponent<Image>();
            rippleImage.color = RippleColor;
            rippleImage.sprite = Resources.GetBuiltinResource<Sprite>("UI/Skin/UISprite.psd");

            // Position
            RectTransform rt = ripple.GetComponent<RectTransform>();
            rt.sizeDelta = new Vector2(20f, 20f);

            if (TargetCanvas != null)
            {
                RectTransform canvasRT = TargetCanvas.GetComponent<RectTransform>();
                Vector2 localPos;
                RectTransformUtility.ScreenPointToLocalPointInRectangle(canvasRT, screenPosition,
                    TargetCanvas.renderMode == RenderMode.ScreenSpaceCamera ? TargetCanvas.worldCamera : null,
                    out localPos);
                rt.anchoredPosition = localPos;
            }

            // Animate scale and fade
            StartCoroutine(AnimateRipple(rt, rippleImage));
        }

        private IEnumerator AnimateRipple(RectTransform rt, Image image)
        {
            Vector3 startScale = Vector3.one;
            Vector3 endScale = Vector3.one * RippleMaxScale;
            Color startColor = RippleColor;
            Color endColor = new Color(RippleColor.r, RippleColor.g, RippleColor.b, 0f);
            float elapsed = 0f;

            while (elapsed < RippleDuration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = elapsed / RippleDuration;
                rt.localScale = Vector3.Lerp(startScale, endScale, t);
                image.color = Color.Lerp(startColor, endColor, t);
                yield return null;
            }

            Destroy(rt.gameObject);
        }

        private void PlaySFX(AudioClip clip)
        {
            if (clip == null || _audioSource == null) return;
            _audioSource.PlayOneShot(clip);
        }

        private void InitializePools()
        {
            if (ClickParticles != null)
                CreatePool(ClickParticles);
            if (SuccessParticles != null)
                CreatePool(SuccessParticles);
            if (ErrorParticles != null)
                CreatePool(ErrorParticles);
        }

        private void CreatePool(ParticleSystem prefab)
        {
            var pool = new Queue<ParticleSystem>();
            Transform poolParent = new GameObject($"Pool_{prefab.name}").transform;
            poolParent.SetParent(transform, false);

            for (int i = 0; i < PoolSize; i++)
            {
                GameObject go = Instantiate(prefab.gameObject, poolParent, false);
                go.SetActive(false);
                pool.Enqueue(go.GetComponent<ParticleSystem>());
            }

            _particlePools[prefab] = pool;
        }

        private IEnumerator ReturnToPool(ParticleSystem particles, ParticleSystem prefab, float delay)
        {
            yield return new WaitForSecondsRealtime(delay);

            particles.gameObject.SetActive(false);

            if (_particlePools.ContainsKey(prefab))
            {
                _particlePools[prefab].Enqueue(particles);
            }
            else
            {
                Destroy(particles.gameObject);
            }
        }
        #endregion
    }
}
