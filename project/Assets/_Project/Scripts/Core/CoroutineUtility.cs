// ----------------------------------------------------------------------------
// KawaiiCool Island - Core Framework
// ----------------------------------------------------------------------------
// CoroutineUtility.cs - Coroutine-based tweening and animation helpers
// ----------------------------------------------------------------------------
// Provides lightweight tweening functions using Unity coroutines.
// Zero external dependencies - no DOTween or other tweening libraries required.
// All easing functions are implemented mathematically for consistent behavior.
// Includes fade, move, scale, pulse, and delayed action helpers.
// ----------------------------------------------------------------------------

using System;
using System.Collections;
using UnityEngine;

namespace KawaiiCoolIsland.Core
{
    /// <summary>
    /// Defines the available easing functions for tweening operations.
    /// </summary>
    public enum EaseType
    {
        /// <summary>Constant speed, no acceleration.</summary>
        Linear,

        /// <summary>Slow start, fast end (quadratic in).</summary>
        EaseIn,

        /// <summary>Fast start, slow end (quadratic out).</summary>
        EaseOut,

        /// <summary>Slow start and end, fast middle (quadratic in-out).</summary>
        EaseInOut,

        /// <summary>Overshoots target and springs back.</summary>
        Elastic,

        /// <summary>Bounces at the target value.</summary>
        Bounce
    }

    /// <summary>
    /// Static utility class providing coroutine-based tweening functions.
    /// All methods return IEnumerator for use with StartCoroutine.
    /// No external dependencies required.
    /// </summary>
    public static class CoroutineUtility
    {
        #region Easing Functions

        /// <summary>
        /// Applies the specified easing function to a normalized time value (0-1).
        /// </summary>
        /// <param name="t">Normalized time value (0 to 1).</param>
        /// <param name="ease">The easing type to apply.</param>
        /// <returns>The eased value.</returns>
        public static float EvaluateEase(float t, EaseType ease)
        {
            // Clamp t to valid range
            t = Mathf.Clamp01(t);

            return ease switch
            {
                EaseType.Linear => t,
                EaseType.EaseIn => t * t,
                EaseType.EaseOut => 1f - (1f - t) * (1f - t),
                EaseType.EaseInOut => t < 0.5f ? 2f * t * t : 1f - Mathf.Pow(-2f * t + 2f, 2f) / 2f,
                EaseType.Elastic => EaseOutElastic(t),
                EaseType.Bounce => EaseOutBounce(t),
                _ => t
            };
        }

        /// <summary>
        /// Elastic ease-out function for springy overshoot effects.
        /// </summary>
        /// <param name="t">Normalized time (0-1).</param>
        /// <returns>Eased value.</returns>
        private static float EaseOutElastic(float t)
        {
            if (t <= 0f) return 0f;
            if (t >= 1f) return 1f;

            const float c4 = (2f * Mathf.PI) / 3f;
            return Mathf.Pow(2f, -10f * t) * Mathf.Sin((t * 10f - 0.75f) * c4) + 1f;
        }

        /// <summary>
        /// Bounce ease-out function for bouncing effects.
        /// </summary>
        /// <param name="t">Normalized time (0-1).</param>
        /// <returns>Eased value.</returns>
        private static float EaseOutBounce(float t)
        {
            const float n1 = 7.5625f;
            const float d1 = 2.75f;

            if (t < 1f / d1)
            {
                return n1 * t * t;
            }
            else if (t < 2f / d1)
            {
                return n1 * (t -= 1.5f / d1) * t + 0.75f;
            }
            else if (t < 2.5f / d1)
            {
                return n1 * (t -= 2.25f / d1) * t + 0.9375f;
            }
            else
            {
                return n1 * (t -= 2.625f / d1) * t + 0.984375f;
            }
        }

        #endregion

        #region Fade Operations

        /// <summary>
        /// Fades a CanvasGroup's alpha to the target value over the specified duration.
        /// </summary>
        /// <param name="cg">The CanvasGroup to fade.</param>
        /// <param name="target">Target alpha value (0-1).</param>
        /// <param name="duration">Fade duration in seconds.</param>
        /// <param name="ease">Easing function to use.</param>
        /// <returns>IEnumerator for use with StartCoroutine.</returns>
        public static IEnumerator FadeCanvasGroup(CanvasGroup cg, float target, float duration, EaseType ease = EaseType.Linear)
        {
            if (cg == null)
            {
                Debug.LogError("[CoroutineUtility] FadeCanvasGroup: CanvasGroup is null.");
                yield break;
            }

            target = Mathf.Clamp01(target);

            if (duration <= 0f)
            {
                cg.alpha = target;
                yield break;
            }

            float start = cg.alpha;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = EvaluateEase(elapsed / duration, ease);
                cg.alpha = Mathf.Lerp(start, target, t);
                yield return null;
            }

            cg.alpha = target;
        }

        /// <summary>
        /// Fades a CanvasGroup to full opacity (alpha = 1).
        /// </summary>
        /// <param name="cg">The CanvasGroup to fade in.</param>
        /// <param name="duration">Fade duration in seconds.</param>
        /// <param name="ease">Easing function to use.</param>
        /// <returns>IEnumerator for use with StartCoroutine.</returns>
        public static IEnumerator FadeIn(CanvasGroup cg, float duration, EaseType ease = EaseType.EaseOut)
        {
            return FadeCanvasGroup(cg, 1f, duration, ease);
        }

        /// <summary>
        /// Fades a CanvasGroup to full transparency (alpha = 0).
        /// </summary>
        /// <param name="cg">The CanvasGroup to fade out.</param>
        /// <param name="duration">Fade duration in seconds.</param>
        /// <param name="ease">Easing function to use.</param>
        /// <returns>IEnumerator for use with StartCoroutine.</returns>
        public static IEnumerator FadeOut(CanvasGroup cg, float duration, EaseType ease = EaseType.EaseIn)
        {
            return FadeCanvasGroup(cg, 0f, duration, ease);
        }

        #endregion

        #region Move Operations

        /// <summary>
        /// Moves a RectTransform's anchored position to the target over time.
        /// </summary>
        /// <param name="rt">The RectTransform to move.</param>
        /// <param name="target">Target anchored position.</param>
        /// <param name="duration">Movement duration in seconds.</param>
        /// <param name="ease">Easing function to use.</param>
        /// <returns>IEnumerator for use with StartCoroutine.</returns>
        public static IEnumerator MoveRectTransform(RectTransform rt, Vector2 target, float duration, EaseType ease = EaseType.EaseInOut)
        {
            if (rt == null)
            {
                Debug.LogError("[CoroutineUtility] MoveRectTransform: RectTransform is null.");
                yield break;
            }

            if (duration <= 0f)
            {
                rt.anchoredPosition = target;
                yield break;
            }

            Vector2 start = rt.anchoredPosition;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = EvaluateEase(elapsed / duration, ease);
                rt.anchoredPosition = Vector2.LerpUnclamped(start, target, t);
                yield return null;
            }

            rt.anchoredPosition = target;
        }

        /// <summary>
        /// Moves a Transform's position to the target in world space.
        /// </summary>
        /// <param name="transform">The Transform to move.</param>
        /// <param name="target">Target world position.</param>
        /// <param name="duration">Movement duration in seconds.</param>
        /// <param name="ease">Easing function to use.</param>
        /// <returns>IEnumerator for use with StartCoroutine.</returns>
        public static IEnumerator MoveTransform(Transform transform, Vector3 target, float duration, EaseType ease = EaseType.EaseInOut)
        {
            if (transform == null)
            {
                Debug.LogError("[CoroutineUtility] MoveTransform: Transform is null.");
                yield break;
            }

            if (duration <= 0f)
            {
                transform.position = target;
                yield break;
            }

            Vector3 start = transform.position;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = EvaluateEase(elapsed / duration, ease);
                transform.position = Vector3.LerpUnclamped(start, target, t);
                yield return null;
            }

            transform.position = target;
        }

        /// <summary>
        /// Moves a Transform's local position to the target.
        /// </summary>
        /// <param name="transform">The Transform to move.</param>
        /// <param name="target">Target local position.</param>
        /// <param name="duration">Movement duration in seconds.</param>
        /// <param name="ease">Easing function to use.</param>
        /// <returns>IEnumerator for use with StartCoroutine.</returns>
        public static IEnumerator MoveLocalTransform(Transform transform, Vector3 target, float duration, EaseType ease = EaseType.EaseInOut)
        {
            if (transform == null)
            {
                Debug.LogError("[CoroutineUtility] MoveLocalTransform: Transform is null.");
                yield break;
            }

            if (duration <= 0f)
            {
                transform.localPosition = target;
                yield break;
            }

            Vector3 start = transform.localPosition;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = EvaluateEase(elapsed / duration, ease);
                transform.localPosition = Vector3.LerpUnclamped(start, target, t);
                yield return null;
            }

            transform.localPosition = target;
        }

        #endregion

        #region Scale Operations

        /// <summary>
        /// Scales a Transform to the target scale over time.
        /// </summary>
        /// <param name="t">The Transform to scale.</param>
        /// <param name="target">Target scale vector.</param>
        /// <param name="duration">Scale duration in seconds.</param>
        /// <param name="ease">Easing function to use.</param>
        /// <returns>IEnumerator for use with StartCoroutine.</returns>
        public static IEnumerator ScaleTransform(Transform t, Vector3 target, float duration, EaseType ease = EaseType.EaseInOut)
        {
            if (t == null)
            {
                Debug.LogError("[CoroutineUtility] ScaleTransform: Transform is null.");
                yield break;
            }

            if (duration <= 0f)
            {
                t.localScale = target;
                yield break;
            }

            Vector3 start = t.localScale;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float easeT = EvaluateEase(elapsed / duration, ease);
                t.localScale = Vector3.LerpUnclamped(start, target, easeT);
                yield return null;
            }

            t.localScale = target;
        }

        /// <summary>
        /// Uniformly scales a Transform to the target scale value.
        /// </summary>
        /// <param name="t">The Transform to scale.</param>
        /// <param name="target">Target uniform scale.</param>
        /// <param name="duration">Scale duration in seconds.</param>
        /// <param name="ease">Easing function to use.</param>
        /// <returns>IEnumerator for use with StartCoroutine.</returns>
        public static IEnumerator ScaleUniform(Transform t, float target, float duration, EaseType ease = EaseType.EaseInOut)
        {
            return ScaleTransform(t, Vector3.one * target, duration, ease);
        }

        /// <summary>
        /// Creates a pulsing scale effect (scale up and back to original).
        /// </summary>
        /// <param name="t">The Transform to pulse.</param>
        /// <param name="scaleMultiplier">Peak scale multiplier (e.g., 1.2f = 120% size).</param>
        /// <param name="duration">Total pulse duration in seconds.</param>
        /// <returns>IEnumerator for use with StartCoroutine.</returns>
        public static IEnumerator PulseScale(Transform t, float scaleMultiplier, float duration)
        {
            if (t == null)
            {
                Debug.LogError("[CoroutineUtility] PulseScale: Transform is null.");
                yield break;
            }

            if (duration <= 0f || scaleMultiplier <= 0f)
            {
                yield break;
            }

            Vector3 originalScale = t.localScale;
            Vector3 targetScale = originalScale * scaleMultiplier;
            float halfDuration = duration * 0.5f;
            float elapsed = 0f;

            // Scale up
            while (elapsed < halfDuration)
            {
                elapsed += Time.unscaledDeltaTime;
                float tNorm = elapsed / halfDuration;
                float easeT = EvaluateEase(tNorm, EaseType.EaseOut);
                t.localScale = Vector3.LerpUnclamped(originalScale, targetScale, easeT);
                yield return null;
            }

            t.localScale = targetScale;
            elapsed = 0f;

            // Scale down
            while (elapsed < halfDuration)
            {
                elapsed += Time.unscaledDeltaTime;
                float tNorm = elapsed / halfDuration;
                float easeT = EvaluateEase(tNorm, EaseType.EaseIn);
                t.localScale = Vector3.LerpUnclamped(targetScale, originalScale, easeT);
                yield return null;
            }

            t.localScale = originalScale;
        }

        /// <summary>
        /// Creates a continuous pulsing loop that can be stopped externally.
        /// </summary>
        /// <param name="t">The Transform to pulse.</param>
        /// <param name="scaleMultiplier">Peak scale multiplier.</param>
        /// <param name="cycleDuration">Duration of one pulse cycle.</param>
        /// <param name="stopCondition">Func that returns true to stop the loop.</param>
        /// <returns>IEnumerator for use with StartCoroutine.</returns>
        public static IEnumerator PulseScaleLoop(Transform t, float scaleMultiplier, float cycleDuration, Func<bool> stopCondition)
        {
            if (t == null || stopCondition == null)
            {
                yield break;
            }

            Vector3 originalScale = t.localScale;
            Vector3 targetScale = originalScale * scaleMultiplier;
            float halfCycle = cycleDuration * 0.5f;

            while (!stopCondition())
            {
                float elapsed = 0f;

                // Scale up
                while (elapsed < halfCycle && !stopCondition())
                {
                    elapsed += Time.unscaledDeltaTime;
                    float tNorm = Mathf.Clamp01(elapsed / halfCycle);
                    float easeT = EvaluateEase(tNorm, EaseType.EaseOut);
                    t.localScale = Vector3.LerpUnclamped(originalScale, targetScale, easeT);
                    yield return null;
                }

                elapsed = 0f;

                // Scale down
                while (elapsed < halfCycle && !stopCondition())
                {
                    elapsed += Time.unscaledDeltaTime;
                    float tNorm = Mathf.Clamp01(elapsed / halfCycle);
                    float easeT = EvaluateEase(tNorm, EaseType.EaseIn);
                    t.localScale = Vector3.LerpUnclamped(targetScale, originalScale, easeT);
                    yield return null;
                }

                t.localScale = originalScale;
                yield return null;
            }
        }

        #endregion

        #region Rotation Operations

        /// <summary>
        /// Rotates a Transform to the target euler angles.
        /// </summary>
        /// <param name="t">The Transform to rotate.</param>
        /// <param name="targetEuler">Target euler angles in degrees.</param>
        /// <param name="duration">Rotation duration in seconds.</param>
        /// <param name="ease">Easing function to use.</param>
        /// <returns>IEnumerator for use with StartCoroutine.</returns>
        public static IEnumerator RotateTransform(Transform t, Vector3 targetEuler, float duration, EaseType ease = EaseType.EaseInOut)
        {
            if (t == null)
            {
                Debug.LogError("[CoroutineUtility] RotateTransform: Transform is null.");
                yield break;
            }

            if (duration <= 0f)
            {
                t.eulerAngles = targetEuler;
                yield break;
            }

            Quaternion start = t.rotation;
            Quaternion target = Quaternion.Euler(targetEuler);
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float easeT = EvaluateEase(elapsed / duration, ease);
                t.rotation = Quaternion.Slerp(start, target, easeT);
                yield return null;
            }

            t.rotation = target;
        }

        /// <summary>
        /// Continuously spins a Transform around the specified axis.
        /// </summary>
        /// <param name="t">The Transform to spin.</param>
        /// <param name="axis">Rotation axis in world space.</param>
        /// <param name="degreesPerSecond">Rotation speed.</param>
        /// <param name="duration">Total spin duration. 0 = infinite.</param>
        /// <returns>IEnumerator for use with StartCoroutine.</returns>
        public static IEnumerator SpinTransform(Transform t, Vector3 axis, float degreesPerSecond, float duration = 0f)
        {
            if (t == null)
            {
                Debug.LogError("[CoroutineUtility] SpinTransform: Transform is null.");
                yield break;
            }

            float elapsed = 0f;

            while (duration <= 0f || elapsed < duration)
            {
                float delta = degreesPerSecond * Time.unscaledDeltaTime;
                t.Rotate(axis, delta, Space.World);
                elapsed += Time.unscaledDeltaTime;
                yield return null;
            }
        }

        #endregion

        #region Utility Operations

        /// <summary>
        /// Invokes an action after the specified delay.
        /// </summary>
        /// <param name="delay">Delay in seconds before invoking the action.</param>
        /// <param name="action">The action to invoke.</param>
        /// <returns>IEnumerator for use with StartCoroutine.</returns>
        public static IEnumerator DelayedAction(float delay, Action action)
        {
            if (action == null)
            {
                Debug.LogError("[CoroutineUtility] DelayedAction: Action is null.");
                yield break;
            }

            if (delay > 0f)
            {
                yield return new WaitForSecondsRealtime(delay);
            }

            try
            {
                action.Invoke();
            }
            catch (Exception ex)
            {
                Debug.LogError($"[CoroutineUtility] DelayedAction exception: {ex}");
            }
        }

        /// <summary>
        /// Invokes an action after the specified delay using unscaled time.
        /// </summary>
        /// <param name="delay">Delay in seconds (unaffected by Time.timeScale).</param>
        /// <param name="action">The action to invoke.</param>
        /// <returns>IEnumerator for use with StartCoroutine.</returns>
        public static IEnumerator DelayedActionUnscaled(float delay, Action action)
        {
            if (action == null)
            {
                Debug.LogError("[CoroutineUtility] DelayedActionUnscaled: Action is null.");
                yield break;
            }

            if (delay > 0f)
            {
                float elapsed = 0f;
                while (elapsed < delay)
                {
                    elapsed += Time.unscaledDeltaTime;
                    yield return null;
                }
            }

            try
            {
                action.Invoke();
            }
            catch (Exception ex)
            {
                Debug.LogError($"[CoroutineUtility] DelayedActionUnscaled exception: {ex}");
            }
        }

        /// <summary>
        /// Shakes a Transform's local position with random offsets.
        /// </summary>
        /// <param name="t">The Transform to shake.</param>
        /// <param name="intensity">Maximum position offset magnitude.</param>
        /// <param name="duration">Shake duration in seconds.</param>
        /// <param name="frequency">How often the shake direction changes per second.</param>
        /// <returns>IEnumerator for use with StartCoroutine.</returns>
        public static IEnumerator ShakeTransform(Transform t, float intensity, float duration, float frequency = 20f)
        {
            if (t == null)
            {
                Debug.LogError("[CoroutineUtility] ShakeTransform: Transform is null.");
                yield break;
            }

            if (duration <= 0f || intensity <= 0f)
            {
                yield break;
            }

            Vector3 originalPosition = t.localPosition;
            float elapsed = 0f;
            float changeInterval = 1f / frequency;
            float timeSinceChange = changeInterval;
            Vector3 currentOffset = Vector3.zero;
            Vector3 targetOffset = Vector3.zero;

            while (elapsed < duration)
            {
                float delta = Time.unscaledDeltaTime;
                elapsed += delta;
                timeSinceChange += delta;

                if (timeSinceChange >= changeInterval)
                {
                    timeSinceChange -= changeInterval;
                    currentOffset = targetOffset;
                    targetOffset = new Vector3(
                        UnityEngine.Random.Range(-intensity, intensity),
                        UnityEngine.Random.Range(-intensity, intensity),
                        UnityEngine.Random.Range(-intensity, intensity)
                    );
                }

                float tNorm = timeSinceChange / changeInterval;
                Vector3 offset = Vector3.Lerp(currentOffset, targetOffset, tNorm);

                // Fade out intensity toward the end
                float fadeMultiplier = 1f - (elapsed / duration);
                offset *= fadeMultiplier;

                t.localPosition = originalPosition + offset;
                yield return null;
            }

            t.localPosition = originalPosition;
        }

        /// <summary>
        /// Animates a float value using a callback each frame.
        /// </summary>
        /// <param name="from">Starting value.</param>
        /// <param name="to">Target value.</param>
        /// <param name="duration">Animation duration.</param>
        /// <param name="onValueChanged">Callback invoked each frame with the current value.</param>
        /// <param name="ease">Easing function.</param>
        /// <returns>IEnumerator for use with StartCoroutine.</returns>
        public static IEnumerator TweenFloat(float from, float to, float duration, Action<float> onValueChanged, EaseType ease = EaseType.Linear)
        {
            if (onValueChanged == null)
            {
                Debug.LogError("[CoroutineUtility] TweenFloat: onValueChanged callback is null.");
                yield break;
            }

            if (duration <= 0f)
            {
                onValueChanged(to);
                yield break;
            }

            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = EvaluateEase(elapsed / duration, ease);
                float value = Mathf.LerpUnclamped(from, to, t);
                onValueChanged(value);
                yield return null;
            }

            onValueChanged(to);
        }

        /// <summary>
        /// Animates a Color value using a callback each frame.
        /// </summary>
        /// <param name="from">Starting color.</param>
        /// <param name="to">Target color.</param>
        /// <param name="duration">Animation duration.</param>
        /// <param name="onColorChanged">Callback invoked each frame with the current color.</param>
        /// <param name="ease">Easing function.</param>
        /// <returns>IEnumerator for use with StartCoroutine.</returns>
        public static IEnumerator TweenColor(Color from, Color to, float duration, Action<Color> onColorChanged, EaseType ease = EaseType.Linear)
        {
            if (onColorChanged == null)
            {
                Debug.LogError("[CoroutineUtility] TweenColor: onColorChanged callback is null.");
                yield break;
            }

            if (duration <= 0f)
            {
                onColorChanged(to);
                yield break;
            }

            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = EvaluateEase(elapsed / duration, ease);
                Color value = Color.LerpUnclamped(from, to, t);
                onColorChanged(value);
                yield return null;
            }

            onColorChanged(to);
        }

        #endregion

        #region CanvasGroup Helpers

        /// <summary>
        /// Fades in a CanvasGroup and sets it to be interactable and blocks raycasts.
        /// </summary>
        /// <param name="cg">The CanvasGroup to show.</param>
        /// <param name="duration">Fade duration.</param>
        /// <param name="ease">Easing function.</param>
        /// <returns>IEnumerator for use with StartCoroutine.</returns>
        public static IEnumerator ShowCanvasGroup(CanvasGroup cg, float duration = 0.3f, EaseType ease = EaseType.EaseOut)
        {
            if (cg == null) yield break;

            cg.blocksRaycasts = true;
            cg.interactable = true;
            yield return FadeCanvasGroup(cg, 1f, duration, ease);
        }

        /// <summary>
        /// Fades out a CanvasGroup and disables interaction.
        /// </summary>
        /// <param name="cg">The CanvasGroup to hide.</param>
        /// <param name="duration">Fade duration.</param>
        /// <param name="ease">Easing function.</param>
        /// <returns>IEnumerator for use with StartCoroutine.</returns>
        public static IEnumerator HideCanvasGroup(CanvasGroup cg, float duration = 0.3f, EaseType ease = EaseType.EaseIn)
        {
            if (cg == null) yield break;

            yield return FadeCanvasGroup(cg, 0f, duration, ease);
            cg.blocksRaycasts = false;
            cg.interactable = false;
        }

        #endregion
    }
}
