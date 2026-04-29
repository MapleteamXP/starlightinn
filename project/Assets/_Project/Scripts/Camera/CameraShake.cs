using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Random = UnityEngine.Random;

namespace KawaiiCool.Camera
{
    /// <summary>
    /// Provides screen shake effects for impactful moments.
    /// </summary>
    public class CameraShake : MonoBehaviour
    {
        [Header("Shake Profiles")]
        public List<ShakeProfile> Profiles = new();
        
        [Header("Current Shake")]
        [SerializeField] private bool _isShaking;
        [SerializeField] private float _shakeIntensity;
        
        [Header("Settings")]
        public bool UseUnscaledTime = false;
        public bool RestorePosition = true;
        public float SmoothReturnTime = 0.3f;
        
        private Vector3 _originalPosition;
        private Coroutine _shakeCoroutine;
        private Vector3 _shakeOffset;
        private Vector3 _returnVelocity;
        private float _currentZoomModifier;
        private float _zoomModifierVelocity;
        private Transform _targetTransform;
        private bool _hasStoredPosition;
        
        /// <summary>
        /// Whether the camera is currently shaking.
        /// </summary>
        public bool IsShaking => _isShaking;
        
        /// <summary>
        /// The current shake intensity.
        /// </summary>
        public float ShakeIntensity => _shakeIntensity;
        
        /// <summary>
        /// Called when the script instance is being loaded.
        /// </summary>
        private void Awake()
        {
            _targetTransform = transform;
        }
        
        /// <summary>
        /// Triggers a shake using a named profile.
        /// </summary>
        /// <param name="profileName">The name of the shake profile to use.</param>
        public void Shake(string profileName)
        {
            ShakeProfile profile = Profiles.Find(p => p.ProfileName == profileName);
            if (profile != null)
            {
                Shake(profile.Intensity, profile.Duration, profile.Frequency, profile.IntensityCurve, profile.Type);
            }
            else
            {
                Debug.LogWarning($"[CameraShake] Profile '{profileName}' not found!");
            }
        }
        
        /// <summary>
        /// Triggers a shake with the specified parameters.
        /// </summary>
        /// <param name="intensity">The shake intensity.</param>
        /// <param name="duration">The shake duration.</param>
        /// <param name="frequency">The shake frequency.</param>
        public void Shake(float intensity, float duration, float frequency = 20f)
        {
            Shake(intensity, duration, frequency, AnimationCurve.Linear(0, 1, 1, 0), ShakeType.Random);
        }
        
        /// <summary>
        /// Triggers a shake with full control over all parameters.
        /// </summary>
        /// <param name="intensity">The shake intensity.</param>
        /// <param name="duration">The shake duration.</param>
        /// <param name="frequency">The shake frequency.</param>
        /// <param name="intensityCurve">The intensity curve over time.</param>
        /// <param name="type">The shake type.</param>
        public void Shake(float intensity, float duration, float frequency, AnimationCurve intensityCurve, ShakeType type)
        {
            if (_shakeCoroutine != null)
            {
                StopCoroutine(_shakeCoroutine);
            }
            
            StoreOriginalPosition();
            _shakeCoroutine = StartCoroutine(ShakeCoroutine(intensity, duration, frequency, intensityCurve, type));
        }
        
        /// <summary>
        /// Triggers a random shake with intensity within the specified range.
        /// </summary>
        /// <param name="minIntensity">The minimum intensity.</param>
        /// <param name="maxIntensity">The maximum intensity.</param>
        /// <param name="duration">The shake duration.</param>
        public void ShakeRandom(float minIntensity, float maxIntensity, float duration)
        {
            float intensity = Random.Range(minIntensity, maxIntensity);
            Shake(intensity, duration);
        }
        
        /// <summary>
        /// Triggers a directional shake in the specified direction.
        /// </summary>
        /// <param name="intensity">The shake intensity.</param>
        /// <param name="duration">The shake duration.</param>
        /// <param name="direction">The shake direction.</param>
        public void ShakeDirectional(float intensity, float duration, Vector2 direction)
        {
            if (_shakeCoroutine != null)
            {
                StopCoroutine(_shakeCoroutine);
            }
            
            StoreOriginalPosition();
            _shakeCoroutine = StartCoroutine(DirectionalShakeCoroutine(intensity, duration, direction));
        }
        
        /// <summary>
        /// Stops any active shake and smoothly returns to the original position.
        /// </summary>
        public void StopShake()
        {
            if (_shakeCoroutine != null)
            {
                StopCoroutine(_shakeCoroutine);
                _shakeCoroutine = null;
            }
            
            StartCoroutine(ReturnToOriginalPosition());
        }
        
        /// <summary>
        /// Stores the original camera position before shaking begins.
        /// </summary>
        private void StoreOriginalPosition()
        {
            if (!_hasStoredPosition || !RestorePosition)
            {
                _originalPosition = _targetTransform.localPosition;
                _hasStoredPosition = true;
            }
        }
        
        /// <summary>
        /// Coroutine that handles the shake effect.
        /// </summary>
        private IEnumerator ShakeCoroutine(float intensity, float duration, float frequency, AnimationCurve intensityCurve, ShakeType type)
        {
            _isShaking = true;
            _shakeIntensity = intensity;
            float elapsed = 0f;
            
            while (elapsed < duration)
            {
                float deltaTime = UseUnscaledTime ? Time.unscaledDeltaTime : Time.deltaTime;
                elapsed += deltaTime;
                float normalizedTime = Mathf.Clamp01(elapsed / duration);
                
                float curveValue = intensityCurve.Evaluate(normalizedTime);
                float currentIntensity = intensity * curveValue;
                _shakeIntensity = currentIntensity;
                
                Vector3 offset = type switch
                {
                    ShakeType.Random => GetRandomShakeOffset(currentIntensity),
                    ShakeType.Perlin => GetPerlinShakeOffset(currentIntensity, elapsed * frequency),
                    ShakeType.Zoom => GetZoomShakeOffset(currentIntensity, normalizedTime),
                    _ => GetRandomShakeOffset(currentIntensity)
                };
                
                _shakeOffset = offset;
                ApplyShake();
                
                yield return null;
            }
            
            _isShaking = false;
            _shakeIntensity = 0f;
            _shakeOffset = Vector3.zero;
            
            if (RestorePosition)
            {
                yield return ReturnToOriginalPosition();
            }
            
            _shakeCoroutine = null;
        }
        
        /// <summary>
        /// Coroutine for directional shake.
        /// </summary>
        private IEnumerator DirectionalShakeCoroutine(float intensity, float duration, Vector2 direction)
        {
            _isShaking = true;
            _shakeIntensity = intensity;
            float elapsed = 0f;
            
            while (elapsed < duration)
            {
                float deltaTime = UseUnscaledTime ? Time.unscaledDeltaTime : Time.deltaTime;
                elapsed += deltaTime;
                float normalizedTime = Mathf.Clamp01(elapsed / duration);
                
                float fade = 1f - normalizedTime;
                float currentIntensity = intensity * fade;
                _shakeIntensity = currentIntensity;
                
                float shakeAmount = Mathf.Sin(elapsed * 30f) * currentIntensity;
                _shakeOffset = new Vector3(direction.x * shakeAmount, direction.y * shakeAmount, 0f);
                ApplyShake();
                
                yield return null;
            }
            
            _isShaking = false;
            _shakeIntensity = 0f;
            _shakeOffset = Vector3.zero;
            
            if (RestorePosition)
            {
                yield return ReturnToOriginalPosition();
            }
            
            _shakeCoroutine = null;
        }
        
        /// <summary>
        /// Coroutine to smoothly return camera to original position after shake.
        /// </summary>
        private IEnumerator ReturnToOriginalPosition()
        {
            float elapsed = 0f;
            Vector3 startPosition = _targetTransform.localPosition;
            
            while (elapsed < SmoothReturnTime)
            {
                float deltaTime = UseUnscaledTime ? Time.unscaledDeltaTime : Time.deltaTime;
                elapsed += deltaTime;
                float t = Mathf.Clamp01(elapsed / SmoothReturnTime);
                
                _targetTransform.localPosition = Vector3.Lerp(startPosition, _originalPosition, t);
                
                yield return null;
            }
            
            _targetTransform.localPosition = _originalPosition;
        }
        
        /// <summary>
        /// Applies the current shake offset to the camera transform.
        /// </summary>
        private void ApplyShake()
        {
            _targetTransform.localPosition = _originalPosition + _shakeOffset;
        }
        
        /// <summary>
        /// Gets a random shake offset for random shake type.
        /// </summary>
        /// <param name="intensity">The shake intensity.</param>
        /// <returns>A random offset vector.</returns>
        private Vector3 GetRandomShakeOffset(float intensity)
        {
            return new Vector3(
                Random.Range(-1f, 1f) * intensity,
                Random.Range(-1f, 1f) * intensity,
                0f
            );
        }
        
        /// <summary>
        /// Gets a Perlin noise based shake offset for smooth shake.
        /// </summary>
        /// <param name="intensity">The shake intensity.</param>
        /// <param name="time">The time value for Perlin noise.</param>
        /// <returns>A Perlin noise offset vector.</returns>
        private Vector3 GetPerlinShakeOffset(float intensity, float time)
        {
            float x = (Mathf.PerlinNoise(time, 0f) - 0.5f) * 2f * intensity;
            float y = (Mathf.PerlinNoise(0f, time) - 0.5f) * 2f * intensity;
            
            return new Vector3(x, y, 0f);
        }
        
        /// <summary>
        /// Gets a zoom-based shake offset that scales the camera view.
        /// </summary>
        private Vector3 GetZoomShakeOffset(float intensity, float normalizedTime)
        {
            float zoomAmount = Mathf.Sin(normalizedTime * Mathf.PI * 4f) * intensity * 0.01f;
            _currentZoomModifier = Mathf.SmoothDamp(_currentZoomModifier, zoomAmount, ref _zoomModifierVelocity, 0.1f);
            
            // Zoom shake modifies the camera's orthographic size or FOV
            Camera cam = GetComponent<Camera>();
            if (cam != null && cam.orthographic)
            {
                cam.orthographicSize += _currentZoomModifier;
            }
            else if (cam != null)
            {
                cam.fieldOfView += _currentZoomModifier;
            }
            
            return GetRandomShakeOffset(intensity * 0.5f);
        }
        
        /// <summary>
        /// Adds a shake profile at runtime.
        /// </summary>
        /// <param name="profile">The profile to add.</param>
        public void AddProfile(ShakeProfile profile)
        {
            if (profile != null && !Profiles.Contains(profile))
            {
                Profiles.Add(profile);
            }
        }
        
        /// <summary>
        /// Removes a shake profile at runtime.
        /// </summary>
        /// <param name="profile">The profile to remove.</param>
        public void RemoveProfile(ShakeProfile profile)
        {
            if (profile != null)
            {
                Profiles.Remove(profile);
            }
        }
        
        /// <summary>
        /// Clears all shake profiles.
        /// </summary>
        public void ClearProfiles()
        {
            Profiles.Clear();
        }
    }
    
    /// <summary>
    /// Defines a screen shake profile that can be created as an asset.
    /// </summary>
    [CreateAssetMenu(fileName = "Shake_", menuName = "KawaiiCool/Camera Shake")]
    public class ShakeProfile : ScriptableObject
    {
        [Tooltip("Unique name for this shake profile.")]
        public string ProfileName;
        
        [Tooltip("Maximum shake intensity.")]
        public float Intensity;
        
        [Tooltip("Duration of the shake in seconds.")]
        public float Duration;
        
        [Tooltip("Frequency of shake oscillations.")]
        public float Frequency = 20f;
        
        [Tooltip("Curve that controls intensity over time. X=0 is start, X=1 is end.")]
        public AnimationCurve IntensityCurve = AnimationCurve.Linear(0, 1, 1, 0);
        
        [Tooltip("Type of shake effect.")]
        public ShakeType Type;
        
        /// <summary>
        /// Validates the profile and returns a description of any issues.
        /// </summary>
        public string Validate()
        {
            if (string.IsNullOrEmpty(ProfileName))
                return "ProfileName is empty";
            if (Intensity <= 0)
                return "Intensity must be greater than 0";
            if (Duration <= 0)
                return "Duration must be greater than 0";
            if (Frequency <= 0)
                return "Frequency must be greater than 0";
            if (IntensityCurve == null || IntensityCurve.length == 0)
                return "IntensityCurve is missing";
            return null;
        }
    }
    
    /// <summary>
    /// Defines the type of shake effect.
    /// </summary>
    public enum ShakeType
    {
        /// <summary>Random position jittering.</summary>
        Random,
        /// <summary>Smooth Perlin noise based movement.</summary>
        Perlin,
        /// <summary>Shake in a specific direction.</summary>
        Directional,
        /// <summary>Zoom in/out shake effect.</summary>
        Zoom
    }
}
