using UnityEngine;

namespace KawaiiCool.Camera
{
    /// <summary>
    /// Defines and enforces world bounds to keep the camera within a valid area.
    /// </summary>
    public class CameraBounds : MonoBehaviour
    {
        [Header("Bounds")]
        public Collider2D WorldBoundsCollider;
        public Vector2 MinBounds;
        public Vector2 MaxBounds;
        public float HorizontalPadding = 2f;
        public float VerticalPadding = 2f;
        public bool ShowGizmos = true;
        public Color GizmoColor = new Color(1f, 0.5f, 0f, 0.5f);
        
        [Header("Soft Bounds")]
        public bool UseSoftBounds = false;
        public float SoftBoundMargin = 1f;
        public AnimationCurve SoftBoundCurve = AnimationCurve.EaseInOut(0, 1, 1, 0);
        
        private float _currentCameraWidth;
        private float _currentCameraHeight;
        
        /// <summary>
        /// Called when the script instance is being loaded.
        /// </summary>
        private void Awake()
        {
            if (WorldBoundsCollider != null)
            {
                SetBoundsFromCollider(WorldBoundsCollider);
            }
        }
        
        /// <summary>
        /// Clamps a position to stay within the defined bounds.
        /// </summary>
        /// <param name="position">The position to clamp.</param>
        /// <param name="cameraHeight">The camera height in world units.</param>
        /// <param name="cameraWidth">The camera width in world units.</param>
        /// <returns>The clamped position.</returns>
        public Vector3 ClampPosition(Vector3 position, float cameraHeight, float cameraWidth)
        {
            _currentCameraWidth = cameraWidth;
            _currentCameraHeight = cameraHeight;
            
            float halfWidth = cameraWidth * 0.5f + HorizontalPadding;
            float halfHeight = cameraHeight * 0.5f + VerticalPadding;
            
            float clampedX = Mathf.Clamp(position.x, MinBounds.x + halfWidth, MaxBounds.x - halfWidth);
            float clampedY = Mathf.Clamp(position.y, MinBounds.y + halfHeight, MaxBounds.y - halfHeight);
            
            // If bounds are smaller than camera, center on bounds
            if (MinBounds.x + halfWidth > MaxBounds.x - halfWidth)
            {
                clampedX = (MinBounds.x + MaxBounds.x) * 0.5f;
            }
            
            if (MinBounds.y + halfHeight > MaxBounds.y - halfHeight)
            {
                clampedY = (MinBounds.y + MaxBounds.y) * 0.5f;
            }
            
            Vector3 result = new Vector3(clampedX, clampedY, position.z);
            
            // Apply soft bounds if enabled
            if (UseSoftBounds)
            {
                result = ApplySoftBounds(position, result, halfWidth, halfHeight);
            }
            
            return result;
        }
        
        /// <summary>
        /// Applies soft boundary damping to create a smooth resistance effect.
        /// </summary>
        private Vector3 ApplySoftBounds(Vector3 original, Vector3 clamped, float halfWidth, float halfHeight)
        {
            Vector3 result = clamped;
            
            float distFromLeft = original.x - (MinBounds.x + halfWidth);
            float distFromRight = (MaxBounds.x - halfWidth) - original.x;
            float distFromBottom = original.y - (MinBounds.y + halfHeight);
            float distFromTop = (MaxBounds.y - halfHeight) - original.y;
            
            if (distFromLeft < 0 && distFromLeft > -SoftBoundMargin)
            {
                float t = Mathf.Abs(distFromLeft) / SoftBoundMargin;
                float damp = SoftBoundCurve.Evaluate(t);
                result.x = Mathf.Lerp(original.x, clamped.x, damp);
            }
            
            if (distFromRight < 0 && distFromRight > -SoftBoundMargin)
            {
                float t = Mathf.Abs(distFromRight) / SoftBoundMargin;
                float damp = SoftBoundCurve.Evaluate(t);
                result.x = Mathf.Lerp(original.x, clamped.x, damp);
            }
            
            if (distFromBottom < 0 && distFromBottom > -SoftBoundMargin)
            {
                float t = Mathf.Abs(distFromBottom) / SoftBoundMargin;
                float damp = SoftBoundCurve.Evaluate(t);
                result.y = Mathf.Lerp(original.y, clamped.y, damp);
            }
            
            if (distFromTop < 0 && distFromTop > -SoftBoundMargin)
            {
                float t = Mathf.Abs(distFromTop) / SoftBoundMargin;
                float damp = SoftBoundCurve.Evaluate(t);
                result.y = Mathf.Lerp(original.y, clamped.y, damp);
            }
            
            return result;
        }
        
        /// <summary>
        /// Checks if a position is within the defined bounds.
        /// </summary>
        /// <param name="position">The position to check.</param>
        /// <returns>True if within bounds.</returns>
        public bool IsWithinBounds(Vector3 position)
        {
            float halfWidth = _currentCameraWidth * 0.5f + HorizontalPadding;
            float halfHeight = _currentCameraHeight * 0.5f + VerticalPadding;
            
            return position.x >= MinBounds.x + halfWidth &&
                   position.x <= MaxBounds.x - halfWidth &&
                   position.y >= MinBounds.y + halfHeight &&
                   position.y <= MaxBounds.y - halfHeight;
        }
        
        /// <summary>
        /// Sets the bounds from explicit min/max values.
        /// </summary>
        /// <param name="min">The minimum bounds.</param>
        /// <param name="max">The maximum bounds.</param>
        public void SetBounds(Vector2 min, Vector2 max)
        {
            MinBounds = min;
            MaxBounds = max;
        }
        
        /// <summary>
        /// Sets the bounds from a collider's bounding box.
        /// </summary>
        /// <param name="collider">The collider to derive bounds from.</param>
        public void SetBoundsFromCollider(Collider2D collider)
        {
            if (collider == null) return;
            
            WorldBoundsCollider = collider;
            Bounds bounds = collider.bounds;
            
            MinBounds = new Vector2(bounds.min.x, bounds.min.y);
            MaxBounds = new Vector2(bounds.max.x, bounds.max.y);
        }
        
        /// <summary>
        /// Gets the center point of the bounds.
        /// </summary>
        /// <returns>The center position.</returns>
        public Vector3 GetCenter()
        {
            return new Vector3(
                (MinBounds.x + MaxBounds.x) * 0.5f,
                (MinBounds.y + MaxBounds.y) * 0.5f,
                0f
            );
        }
        
        /// <summary>
        /// Gets the total width of the bounds.
        /// </summary>
        /// <returns>The width.</returns>
        public float GetWidth()
        {
            return MaxBounds.x - MinBounds.x;
        }
        
        /// <summary>
        /// Gets the total height of the bounds.
        /// </summary>
        /// <returns>The height.</returns>
        public float GetHeight()
        {
            return MaxBounds.y - MinBounds.y;
        }
        
        /// <summary>
        /// Gets the total area of the bounds.
        /// </summary>
        /// <returns>The area.</returns>
        public float GetArea()
        {
            return GetWidth() * GetHeight();
        }
        
        /// <summary>
        /// Checks if the camera at the given position and size can fit entirely within bounds.
        /// </summary>
        /// <param name="cameraSize">The orthographic camera size.</param>
        /// <param name="aspect">The camera aspect ratio.</param>
        /// <returns>True if the camera view fits within bounds.</returns>
        public bool CanCameraFit(float cameraSize, float aspect)
        {
            float cameraWidth = cameraSize * 2f * aspect;
            float cameraHeight = cameraSize * 2f;
            
            return cameraWidth <= GetWidth() && cameraHeight <= GetHeight();
        }
        
        /// <summary>
        /// Gets the maximum zoom level that still fits within the bounds.
        /// </summary>
        /// <param name="aspect">The camera aspect ratio.</param>
        /// <returns>The maximum zoom level.</returns>
        public float GetMaxZoomForBounds(float aspect)
        {
            float widthZoom = GetWidth() / (2f * aspect);
            float heightZoom = GetHeight() / 2f;
            
            return Mathf.Min(widthZoom, heightZoom);
        }
        
        /// <summary>
        /// Expands the bounds by the specified amount on all sides.
        /// </summary>
        /// <param name="amount">The amount to expand by.</param>
        public void ExpandBounds(float amount)
        {
            MinBounds -= Vector2.one * amount;
            MaxBounds += Vector2.one * amount;
        }
        
        /// <summary>
        /// Draws gizmos in the editor for visualizing bounds.
        /// </summary>
        private void OnDrawGizmos()
        {
            if (!ShowGizmos) return;
            
            Gizmos.color = GizmoColor;
            
            Vector3 center = GetCenter();
            Vector3 size = new Vector3(GetWidth(), GetHeight(), 0.1f);
            
            Gizmos.DrawWireCube(center, size);
            Gizmos.DrawCube(center, size * 0.98f);
            
            // Draw padding area
            Gizmos.color = new Color(GizmoColor.r, GizmoColor.g, GizmoColor.b, GizmoColor.a * 0.3f);
            Vector3 paddedSize = new Vector3(
                GetWidth() - HorizontalPadding * 2f,
                GetHeight() - VerticalPadding * 2f,
                0.1f
            );
            Gizmos.DrawWireCube(center, paddedSize);
        }
        
        /// <summary>
        /// Draws selected gizmos with brighter color.
        /// </summary>
        private void OnDrawGizmosSelected()
        {
            if (!ShowGizmos) return;
            
            Color brightColor = new Color(GizmoColor.r, GizmoColor.g, GizmoColor.b, 1f);
            Gizmos.color = brightColor;
            
            Vector3 center = GetCenter();
            Vector3 size = new Vector3(GetWidth(), GetHeight(), 0.1f);
            
            Gizmos.DrawWireCube(center, size);
        }
    }
}
