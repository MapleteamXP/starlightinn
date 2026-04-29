using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace KawaiiCoolIsland.UI
{
    /// <summary>
    /// Direction for slide-based UI animations.
    /// </summary>
    public enum SlideDirection
    {
        /// <summary>Slide from/to the left edge.</summary>
        Left,
        /// <summary>Slide from/to the right edge.</summary>
        Right,
        /// <summary>Slide from/to the top edge.</summary>
        Top,
        /// <summary>Slide from/to the bottom edge.</summary>
        Bottom
    }

    /// <summary>
    /// Static utility class providing coroutine-based UI animation functions.
    /// All animations use unscaled delta time for pause-menu compatibility.
    /// </summary>
    public static class UITransitions
    {
        #region Fade Animations
        /// <summary>
        /// Fades a CanvasGroup from transparent (alpha 0) to opaque (alpha 1).
        /// </summary>
        /// <param name="target">The CanvasGroup to animate.</param>
        /// <param name="duration">Animation duration in seconds.</param>
        /// <param name="curve">Optional easing curve. Defaults to linear.</param>
        /// <returns>Coroutine enumerator.</returns>
        public static IEnumerator FadeIn(CanvasGroup target, float duration, AnimationCurve curve = null)
        {
            if (target == null) yield break;

            curve ??= AnimationCurve.Linear(0, 0, 1, 1);
            target.alpha = 0f;
            target.gameObject.SetActive(true);
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                target.alpha = curve.Evaluate(t);
                yield return null;
            }

            target.alpha = 1f;
        }

        /// <summary>
        /// Fades a CanvasGroup from opaque (alpha 1) to transparent (alpha 0).
        /// </summary>
        /// <param name="target">The CanvasGroup to animate.</param>
        /// <param name="duration">Animation duration in seconds.</param>
        /// <param name="curve">Optional easing curve. Defaults to linear.</param>
        /// <returns>Coroutine enumerator.</returns>
        public static IEnumerator FadeOut(CanvasGroup target, float duration, AnimationCurve curve = null)
        {
            if (target == null) yield break;

            curve ??= AnimationCurve.Linear(0, 0, 1, 1);
            float startAlpha = target.alpha;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                target.alpha = Mathf.Lerp(startAlpha, 0f, curve.Evaluate(t));
                yield return null;
            }

            target.alpha = 0f;
            target.gameObject.SetActive(false);
        }

        /// <summary>
        /// Fades a CanvasGroup to a specific alpha value.
        /// </summary>
        /// <param name="target">The CanvasGroup to animate.</param>
        /// <param name="targetAlpha">Target alpha value (0-1).</param>
        /// <param name="duration">Animation duration in seconds.</param>
        /// <param name="curve">Optional easing curve.</param>
        /// <returns>Coroutine enumerator.</returns>
        public static IEnumerator FadeTo(CanvasGroup target, float targetAlpha, float duration, AnimationCurve curve = null)
        {
            if (target == null) yield break;

            curve ??= AnimationCurve.Linear(0, 0, 1, 1);
            float startAlpha = target.alpha;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                target.alpha = Mathf.Lerp(startAlpha, targetAlpha, curve.Evaluate(t));
                yield return null;
            }

            target.alpha = targetAlpha;
        }
        #endregion

        #region Slide Animations
        /// <summary>
        /// Slides a RectTransform in from the specified edge of the screen.
        /// </summary>
        /// <param name="target">The RectTransform to animate.</param>
        /// <param name="from">The edge to slide in from.</param>
        /// <param name="duration">Animation duration in seconds.</param>
        /// <param name="curve">Optional easing curve.</param>
        /// <returns>Coroutine enumerator.</returns>
        public static IEnumerator SlideIn(RectTransform target, SlideDirection from, float duration, AnimationCurve curve = null)
        {
            if (target == null) yield break;

            curve ??= AnimationCurve.EaseInOut(0, 0, 1, 1);
            Vector2 hiddenPos = GetHiddenPosition(target, from);
            Vector2 shownPos = GetShownPosition(target);
            target.anchoredPosition = hiddenPos;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                target.anchoredPosition = Vector2.LerpUnclamped(hiddenPos, shownPos, curve.Evaluate(t));
                yield return null;
            }

            target.anchoredPosition = shownPos;
        }

        /// <summary>
        /// Slides a RectTransform out toward the specified edge of the screen.
        /// </summary>
        /// <param name="target">The RectTransform to animate.</param>
        /// <param name="to">The edge to slide out toward.</param>
        /// <param name="duration">Animation duration in seconds.</param>
        /// <param name="curve">Optional easing curve.</param>
        /// <returns>Coroutine enumerator.</returns>
        public static IEnumerator SlideOut(RectTransform target, SlideDirection to, float duration, AnimationCurve curve = null)
        {
            if (target == null) yield break;

            curve ??= AnimationCurve.EaseInOut(0, 0, 1, 1);
            Vector2 startPos = target.anchoredPosition;
            Vector2 hiddenPos = GetHiddenPosition(target, to);
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                target.anchoredPosition = Vector2.LerpUnclamped(startPos, hiddenPos, curve.Evaluate(t));
                yield return null;
            }

            target.anchoredPosition = hiddenPos;
        }
        #endregion

        #region Scale Animations
        /// <summary>
        /// Scales a RectTransform from zero to its full size with a fade.
        /// </summary>
        /// <param name="target">The RectTransform to animate.</param>
        /// <param name="duration">Animation duration in seconds.</param>
        /// <param name="curve">Optional easing curve.</param>
        /// <returns>Coroutine enumerator.</returns>
        public static IEnumerator ScaleIn(RectTransform target, float duration, AnimationCurve curve = null)
        {
            if (target == null) yield break;

            curve ??= AnimationCurve.EaseInOut(0, 0, 1, 1);
            Vector3 targetScale = target.localScale;
            target.localScale = Vector3.zero;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                float eval = curve.Evaluate(t);
                target.localScale = Vector3.LerpUnclamped(Vector3.zero, targetScale, eval);
                yield return null;
            }

            target.localScale = targetScale;
        }

        /// <summary>
        /// Scales a RectTransform from full size down to zero with a fade.
        /// </summary>
        /// <param name="target">The RectTransform to animate.</param>
        /// <param name="duration">Animation duration in seconds.</param>
        /// <param name="curve">Optional easing curve.</param>
        /// <returns>Coroutine enumerator.</returns>
        public static IEnumerator ScaleOut(RectTransform target, float duration, AnimationCurve curve = null)
        {
            if (target == null) yield break;

            curve ??= AnimationCurve.EaseInOut(0, 0, 1, 1);
            Vector3 startScale = target.localScale;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                target.localScale = Vector3.LerpUnclamped(startScale, Vector3.zero, curve.Evaluate(t));
                yield return null;
            }

            target.localScale = Vector3.zero;
        }
        #endregion

        #region Bounce Animations
        /// <summary>
        /// Bounces a RectTransform in from zero scale with elastic overshoot.
        /// </summary>
        /// <param name="target">The RectTransform to animate.</param>
        /// <param name="duration">Animation duration in seconds.</param>
        /// <returns>Coroutine enumerator.</returns>
        public static IEnumerator BounceIn(RectTransform target, float duration)
        {
            if (target == null) yield break;

            Vector3 targetScale = target.localScale;
            target.localScale = Vector3.zero;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                // Elastic ease-out formula
                float bounce = Mathf.Pow(2f, -10f * t) * Mathf.Sin((t - 0.1f) * (2f * Mathf.PI) / 0.4f) + 1f;
                target.localScale = Vector3.LerpUnclamped(Vector3.zero, targetScale, Mathf.Clamp01(bounce));
                yield return null;
            }

            target.localScale = targetScale;
        }

        /// <summary>
        /// Bounces a RectTransform out with elastic overshoot before shrinking to zero.
        /// </summary>
        /// <param name="target">The RectTransform to animate.</param>
        /// <param name="duration">Animation duration in seconds.</param>
        /// <returns>Coroutine enumerator.</returns>
        public static IEnumerator BounceOut(RectTransform target, float duration)
        {
            if (target == null) yield break;

            Vector3 startScale = target.localScale;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                // Elastic ease-in formula
                float bounce = 1f - Mathf.Pow(2f, 10f * (t - 1f)) * Mathf.Sin((t - 1.1f) * (2f * Mathf.PI) / 0.4f);
                target.localScale = Vector3.LerpUnclamped(startScale, Vector3.zero, Mathf.Clamp01(bounce));
                yield return null;
            }

            target.localScale = Vector3.zero;
        }
        #endregion

        #region Shake Animation
        /// <summary>
        /// Shakes a RectTransform with random offset jitter for error/impact feedback.
        /// </summary>
        /// <param name="target">The RectTransform to animate.</param>
        /// <param name="intensity">Maximum pixel offset for the shake.</param>
        /// <param name="duration">Shake duration in seconds.</param>
        /// <returns>Coroutine enumerator.</returns>
        public static IEnumerator Shake(RectTransform target, float intensity, float duration)
        {
            if (target == null) yield break;

            Vector2 originalPos = target.anchoredPosition;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = elapsed / duration;
                float currentIntensity = intensity * (1f - t);
                float offsetX = UnityEngine.Random.Range(-currentIntensity, currentIntensity);
                float offsetY = UnityEngine.Random.Range(-currentIntensity, currentIntensity);
                target.anchoredPosition = originalPos + new Vector2(offsetX, offsetY);
                yield return null;
            }

            target.anchoredPosition = originalPos;
        }
        #endregion

        #region Punch Animation
        /// <summary>
        /// Temporarily scales up a RectTransform then returns to normal (pulse effect).
        /// </summary>
        /// <param name="target">The RectTransform to animate.</param>
        /// <param name="punchScale">Scale multiplier at peak (1.2 = 120% of original).</param>
        /// <param name="duration">Total animation duration in seconds.</param>
        /// <returns>Coroutine enumerator.</returns>
        public static IEnumerator PunchScale(RectTransform target, float punchScale, float duration)
        {
            if (target == null) yield break;

            Vector3 originalScale = target.localScale;
            Vector3 targetScale = originalScale * punchScale;
            float halfDuration = duration * 0.5f;
            float elapsed = 0f;

            // Punch up
            while (elapsed < halfDuration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / halfDuration);
                target.localScale = Vector3.LerpUnclamped(originalScale, targetScale, t);
                yield return null;
            }

            // Return back
            elapsed = 0f;
            while (elapsed < halfDuration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / halfDuration);
                target.localScale = Vector3.LerpUnclamped(targetScale, originalScale, t);
                yield return null;
            }

            target.localScale = originalScale;
        }
        #endregion

        #region Combined Animations
        /// <summary>
        /// Fades in a CanvasGroup while sliding its RectTransform from an edge.
        /// </summary>
        /// <param name="cg">The CanvasGroup to fade.</param>
        /// <param name="rt">The RectTransform to slide.</param>
        /// <param name="from">The edge to slide in from.</param>
        /// <param name="duration">Animation duration in seconds.</param>
        /// <returns>Coroutine enumerator.</returns>
        public static IEnumerator FadeAndSlideIn(CanvasGroup cg, RectTransform rt, SlideDirection from, float duration)
        {
            if (cg == null || rt == null) yield break;

            AnimationCurve curve = AnimationCurve.EaseInOut(0, 0, 1, 1);
            Vector2 hiddenPos = GetHiddenPosition(rt, from);
            Vector2 shownPos = GetShownPosition(rt);
            rt.anchoredPosition = hiddenPos;
            cg.alpha = 0f;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                float eval = curve.Evaluate(t);
                cg.alpha = eval;
                rt.anchoredPosition = Vector2.LerpUnclamped(hiddenPos, shownPos, eval);
                yield return null;
            }

            cg.alpha = 1f;
            rt.anchoredPosition = shownPos;
        }

        /// <summary>
        /// Fades in a CanvasGroup while scaling its RectTransform from zero.
        /// </summary>
        /// <param name="cg">The CanvasGroup to fade.</param>
        /// <param name="rt">The RectTransform to scale.</param>
        /// <param name="duration">Animation duration in seconds.</param>
        /// <returns>Coroutine enumerator.</returns>
        public static IEnumerator FadeAndScaleIn(CanvasGroup cg, RectTransform rt, float duration)
        {
            if (cg == null || rt == null) yield break;

            AnimationCurve curve = AnimationCurve.EaseInOut(0, 0, 1, 1);
            Vector3 targetScale = rt.localScale;
            rt.localScale = Vector3.zero;
            cg.alpha = 0f;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                float eval = curve.Evaluate(t);
                cg.alpha = eval;
                rt.localScale = Vector3.LerpUnclamped(Vector3.zero, targetScale, eval);
                yield return null;
            }

            cg.alpha = 1f;
            rt.localScale = targetScale;
        }

        /// <summary>
        /// Slides a RectTransform in while also scaling it from zero.
        /// </summary>
        /// <param name="rt">The RectTransform to animate.</param>
        /// <param name="from">The edge to slide in from.</param>
        /// <param name="duration">Animation duration in seconds.</param>
        /// <returns>Coroutine enumerator.</returns>
        public static IEnumerator SlideAndScaleIn(RectTransform rt, SlideDirection from, float duration)
        {
            if (rt == null) yield break;

            AnimationCurve curve = AnimationCurve.EaseInOut(0, 0, 1, 1);
            Vector2 hiddenPos = GetHiddenPosition(rt, from);
            Vector2 shownPos = GetShownPosition(rt);
            Vector3 targetScale = rt.localScale;
            rt.anchoredPosition = hiddenPos;
            rt.localScale = Vector3.zero;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                float eval = curve.Evaluate(t);
                rt.anchoredPosition = Vector2.LerpUnclamped(hiddenPos, shownPos, eval);
                rt.localScale = Vector3.LerpUnclamped(Vector3.zero, targetScale, eval);
                yield return null;
            }

            rt.anchoredPosition = shownPos;
            rt.localScale = targetScale;
        }
        #endregion

        #region Utility Coroutines
        /// <summary>
        /// Waits for a specified number of seconds using unscaled time.
        /// Use this for pause-menu compatible delays.
        /// </summary>
        /// <param name="seconds">Duration to wait in seconds.</param>
        /// <returns>Coroutine enumerator.</returns>
        public static IEnumerator WaitForSecondsRealtime(float seconds)
        {
            float elapsed = 0f;
            while (elapsed < seconds)
            {
                elapsed += Time.unscaledDeltaTime;
                yield return null;
            }
        }

        /// <summary>
        /// Chains multiple coroutines to run sequentially.
        /// </summary>
        /// <param name="enumerators">Coroutines to execute in order.</param>
        /// <returns>Coroutine enumerator.</returns>
        public static IEnumerator Chain(params IEnumerator[] enumerators)
        {
            foreach (var e in enumerators)
            {
                yield return e;
            }
        }

        /// <summary>
        /// Runs multiple coroutines in parallel and waits for all to complete.
        /// </summary>
        /// <param name="enumerators">Coroutines to execute simultaneously.</param>
        /// <returns>Coroutine enumerator.</returns>
        public static IEnumerator Parallel(params IEnumerator[] enumerators)
        {
            var running = new List<CoroutineRunner>();
            foreach (var e in enumerators)
            {
                running.Add(new CoroutineRunner(e));
            }

            bool anyRunning;
            do
            {
                anyRunning = false;
                foreach (var runner in running)
                {
                    if (runner.MoveNext())
                    {
                        anyRunning = true;
                    }
                }
                if (anyRunning)
                    yield return null;
            } while (anyRunning);
        }

        /// <summary>
        /// Tweens a float value using a callback for each frame.
        /// </summary>
        /// <param name="from">Starting value.</param>
        /// <param name="to">Target value.</param>
        /// <param name="duration">Animation duration.</param>
        /// <param name="onValueChanged">Called each frame with the current value.</param>
        /// <param name="curve">Optional easing curve.</param>
        /// <returns>Coroutine enumerator.</returns>
        public static IEnumerator TweenFloat(float from, float to, float duration, Action<float> onValueChanged, AnimationCurve curve = null)
        {
            curve ??= AnimationCurve.Linear(0, 0, 1, 1);
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                float value = Mathf.LerpUnclamped(from, to, curve.Evaluate(t));
                onValueChanged?.Invoke(value);
                yield return null;
            }

            onValueChanged?.Invoke(to);
        }

        /// <summary>
        /// Tweens a Color value using a callback for each frame.
        /// </summary>
        /// <param name="from">Starting color.</param>
        /// <param name="to">Target color.</param>
        /// <param name="duration">Animation duration.</param>
        /// <param name="onColorChanged">Called each frame with the current color.</param>
        /// <param name="curve">Optional easing curve.</param>
        /// <returns>Coroutine enumerator.</returns>
        public static IEnumerator TweenColor(Color from, Color to, float duration, Action<Color> onColorChanged, AnimationCurve curve = null)
        {
            curve ??= AnimationCurve.Linear(0, 0, 1, 1);
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                Color value = Color.LerpUnclamped(from, to, curve.Evaluate(t));
                onColorChanged?.Invoke(value);
                yield return null;
            }

            onColorChanged?.Invoke(to);
        }

        /// <summary>
        /// Tweens a Vector2 value using a callback for each frame.
        /// </summary>
        /// <param name="from">Starting vector.</param>
        /// <param name="to">Target vector.</param>
        /// <param name="duration">Animation duration.</param>
        /// <param name="onValueChanged">Called each frame with the current vector.</param>
        /// <param name="curve">Optional easing curve.</param>
        /// <returns>Coroutine enumerator.</returns>
        public static IEnumerator TweenVector2(Vector2 from, Vector2 to, float duration, Action<Vector2> onValueChanged, AnimationCurve curve = null)
        {
            curve ??= AnimationCurve.Linear(0, 0, 1, 1);
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                Vector2 value = Vector2.LerpUnclamped(from, to, curve.Evaluate(t));
                onValueChanged?.Invoke(value);
                yield return null;
            }

            onValueChanged?.Invoke(to);
        }

        /// <summary>
        /// Tweens a Vector3 value using a callback for each frame.
        /// </summary>
        /// <param name="from">Starting vector.</param>
        /// <param name="to">Target vector.</param>
        /// <param name="duration">Animation duration.</param>
        /// <param name="onValueChanged">Called each frame with the current vector.</param>
        /// <param name="curve">Optional easing curve.</param>
        /// <returns>Coroutine enumerator.</returns>
        public static IEnumerator TweenVector3(Vector3 from, Vector3 to, float duration, Action<Vector3> onValueChanged, AnimationCurve curve = null)
        {
            curve ??= AnimationCurve.Linear(0, 0, 1, 1);
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                Vector3 value = Vector3.LerpUnclamped(from, to, curve.Evaluate(t));
                onValueChanged?.Invoke(value);
                yield return null;
            }

            onValueChanged?.Invoke(to);
        }
        #endregion

        #region Easing Functions
        /// <summary>
        /// Ease-In-Out cubic function for smooth acceleration and deceleration.
        /// </summary>
        /// <param name="t">Normalized time (0-1).</param>
        /// <returns>Eased value.</returns>
        public static float EaseInOutCubic(float t)
        {
            return t < 0.5f ? 4f * t * t * t : 1f - Mathf.Pow(-2f * t + 2f, 3f) / 2f;
        }

        /// <summary>
        /// Ease-Out cubic function for smooth deceleration.
        /// </summary>
        /// <param name="t">Normalized time (0-1).</param>
        /// <returns>Eased value.</returns>
        public static float EaseOutCubic(float t)
        {
            return 1f - Mathf.Pow(1f - t, 3f);
        }

        /// <summary>
        /// Ease-In cubic function for smooth acceleration.
        /// </summary>
        /// <param name="t">Normalized time (0-1).</param>
        /// <returns>Eased value.</returns>
        public static float EaseInCubic(float t)
        {
            return t * t * t;
        }

        /// <summary>
        /// Elastic ease-out for bouncy effects.
        /// </summary>
        /// <param name="t">Normalized time (0-1).</param>
        /// <returns>Eased value.</returns>
        public static float EaseOutElastic(float t)
        {
            float c4 = (2f * Mathf.PI) / 3f;
            return t == 0f ? 0f : t == 1f ? 1f : Mathf.Pow(2f, -10f * t) * Mathf.Sin((t * 10f - 0.75f) * c4) + 1f;
        }

        /// <summary>
        /// Spring ease-out for overshoot effects.
        /// </summary>
        /// <param name="t">Normalized time (0-1).</param>
        /// <returns>Eased value.</returns>
        public static float EaseOutBack(float t)
        {
            const float c1 = 1.70158f;
            const float c3 = c1 + 1f;
            return 1f + c3 * Mathf.Pow(t - 1f, 3f) + c1 * Mathf.Pow(t - 1f, 2f);
        }
        #endregion

        #region Private Helpers
        private static Vector2 GetHiddenPosition(RectTransform target, SlideDirection direction)
        {
            Vector2 shownPos = GetShownPosition(target);
            float parentWidth = target.parent is RectTransform parentRt ? parentRt.rect.width : Screen.width;
            float parentHeight = target.parent is RectTransform parentRt2 ? parentRt2.rect.height : Screen.height;
            float targetWidth = target.rect.width;
            float targetHeight = target.rect.height;

            return direction switch
            {
                SlideDirection.Left => shownPos + new Vector2(-(parentWidth * 0.5f + targetWidth), 0f),
                SlideDirection.Right => shownPos + new Vector2(parentWidth * 0.5f + targetWidth, 0f),
                SlideDirection.Top => shownPos + new Vector2(0f, parentHeight * 0.5f + targetHeight),
                SlideDirection.Bottom => shownPos + new Vector2(0f, -(parentHeight * 0.5f + targetHeight)),
                _ => shownPos
            };
        }

        private static Vector2 GetShownPosition(RectTransform target)
        {
            // Return the position the element should have when fully shown
            // This is typically the anchoredPosition set in the inspector
            return target.anchoredPosition;
        }

        /// <summary>
        /// Helper class to run IEnumerator as a coroutine-like state machine.
        /// </summary>
        private class CoroutineRunner
        {
            private readonly IEnumerator _enumerator;
            private bool _isComplete;

            public CoroutineRunner(IEnumerator enumerator)
            {
                _enumerator = enumerator;
                _isComplete = false;
            }

            public bool MoveNext()
            {
                if (_isComplete) return false;
                bool hasNext = _enumerator.MoveNext();
                if (!hasNext) _isComplete = true;
                return hasNext;
            }
        }
        #endregion
    }
}
