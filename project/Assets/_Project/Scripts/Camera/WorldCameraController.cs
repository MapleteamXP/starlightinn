using System;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.EnhancedTouch;

namespace KawaiiCool.Camera
{
    /// <summary>
    /// Controls the world camera with smooth follow, zoom, pan, and bounds.
    /// </summary>
    public class WorldCameraController : MonoBehaviour
    {
        [Header("Camera")]
        public Camera GameCamera;
        public CameraRenderMode RenderMode = CameraRenderMode.Orthographic;
        
        [Header("Follow")]
        public Transform Target; // Player to follow
        public float FollowSmoothTime = 0.3f;
        public float MaxFollowSpeed = 15f;
        public Vector3 FollowOffset = new(0, 2, -10);
        public bool LockToTarget = true;
        
        [Header("Zoom")]
        public float MinZoom = 3f;
        public float MaxZoom = 20f;
        public float DefaultZoom = 8f;
        public float ZoomSmoothTime = 0.2f;
        public AnimationCurve ZoomCurve = AnimationCurve.EaseInOut(0, 0, 1, 1);
        public float MobilePinchSensitivity = 0.01f;
        public float DesktopScrollSensitivity = 2f;
        public float ZoomButtonStep = 2f;
        
        [Header("Pan")]
        public bool AllowPan = true;
        public float PanSpeed = 10f;
        public float PanSmoothTime = 0.15f;
        public bool PanWhileFollowing = false;
        
        [Header("Bounds")]
        public bool UseBounds = true;
        public Vector2 MinBounds = new(-50, -50);
        public Vector2 MaxBounds = new(50, 50);
        
        [Header("Mobile")]
        public bool UsePinchToZoom = true;
        public bool UseTwoFingerPan = true;
        public float PanTouchThreshold = 10f;
        
        [Header("Desktop")]
        public bool UseScrollZoom = true;
        public bool UseMiddleMousePan = true;
        public bool UseEdgePan = false;
        public float EdgePanMargin = 50f;
        public float EdgePanSpeed = 5f;
        
        [Header("Effects")]
        public float LookAheadDistance = 2f;
        public float LookAheadSmoothTime = 0.5f;
        public bool UseDynamicDeadZone = true;
        public float DeadZoneRadius = 0.5f;
        
        private float _currentZoom;
        private float _targetZoom;
        private Vector3 _currentPosition;
        private Vector3 _targetPosition;
        private Vector3 _velocity;
        private float _zoomVelocity;
        private bool _isPanning;
        private Vector2 _lastPanPosition;
        private float _pinchStartDistance;
        private float _pinchStartZoom;
        private bool _isPinching;
        private Vector2 _lookAheadOffset;
        private Vector2 _lookAheadVelocity;
        private float _panVelocityX;
        private float _panVelocityY;
        private bool _isEdgePanning;
        private float _edgePanVelocityX;
        private float _edgePanVelocityY;
        private bool _initialized;
        private CameraBounds _cameraBounds;
        
        public float CurrentZoom => _currentZoom;
        public bool IsFollowing => LockToTarget && Target != null;
        public bool IsPanning => _isPanning;
        
        public event Action<float> OnZoomChanged;
        public event Action<Vector3> OnCameraMoved;
        
        /// <summary>
        /// Called when the object is first initialized.
        /// </summary>
        private void Awake()
        {
            if (GameCamera == null)
            {
                GameCamera = GetComponent<Camera>();
                if (GameCamera == null)
                {
                    GameCamera = Camera.main;
                }
            }
            
            _cameraBounds = GetComponent<CameraBounds>();
            if (_cameraBounds == null && UseBounds)
            {
                _cameraBounds = gameObject.AddComponent<CameraBounds>();
                _cameraBounds.MinBounds = MinBounds;
                _cameraBounds.MaxBounds = MaxBounds;
            }
            
            _currentZoom = DefaultZoom;
            _targetZoom = DefaultZoom;
            _currentPosition = transform.position;
            _targetPosition = transform.position;
            
            SetCameraRenderMode(RenderMode);
        }
        
        /// <summary>
        /// Called when the object is enabled.
        /// </summary>
        private void OnEnable()
        {
            if (!_initialized)
            {
                EnhancedTouchSupport.Enable();
                _initialized = true;
            }
        }
        
        /// <summary>
        /// Called when the object is disabled.
        /// </summary>
        private void OnDisable()
        {
            EnhancedTouchSupport.Disable();
            _initialized = false;
        }
        
        /// <summary>
        /// Sets the camera render mode (orthographic or perspective).
        /// </summary>
        private void SetCameraRenderMode(CameraRenderMode mode)
        {
            if (GameCamera == null) return;
            
            switch (mode)
            {
                case CameraRenderMode.Orthographic:
                    GameCamera.orthographic = true;
                    GameCamera.orthographicSize = _currentZoom;
                    break;
                case CameraRenderMode.Perspective:
                    GameCamera.orthographic = false;
                    GameCamera.fieldOfView = CalculateFOVFromZoom(_currentZoom);
                    break;
            }
        }
        
        /// <summary>
        /// Calculates the field of view from a zoom level for perspective cameras.
        /// </summary>
        private float CalculateFOVFromZoom(float zoom)
        {
            float distance = Mathf.Abs(FollowOffset.z);
            float halfHeight = zoom * 0.5f;
            return 2f * Mathf.Atan(halfHeight / distance) * Mathf.Rad2Deg;
        }
        
        /// <summary>
        /// Called every frame for input processing.
        /// </summary>
        private void Update()
        {
            HandleTouchInput();
            HandleMouseInput();
            HandleScrollZoom();
            HandleEdgePan();
        }
        
        /// <summary>
        /// Called after all Update calls for smooth camera movement.
        /// </summary>
        private void LateUpdate()
        {
            UpdateZoom();
            
            if (IsFollowing)
            {
                UpdateFollow();
            }
            else if (AllowPan)
            {
                UpdatePan();
            }
            
            ApplyBounds();
            ApplyPosition();
            
            OnCameraMoved?.Invoke(_currentPosition);
        }
        
        /// <summary>
        /// Updates the camera follow behavior with smooth damping.
        /// </summary>
        private void UpdateFollow()
        {
            if (Target == null) return;
            
            Vector3 targetPos = Target.position + FollowOffset;
            
            // Calculate look ahead based on target velocity
            if (LookAheadDistance > 0)
            {
                Vector2 targetVelocity = GetTargetVelocity();
                Vector2 desiredLookAhead = targetVelocity.normalized * LookAheadDistance;
                _lookAheadOffset = Vector2.SmoothDamp(_lookAheadOffset, desiredLookAhead, ref _lookAheadVelocity, LookAheadSmoothTime);
                targetPos += new Vector3(_lookAheadOffset.x, _lookAheadOffset.y, 0);
            }
            
            // Apply dynamic dead zone
            if (UseDynamicDeadZone)
            {
                Vector2 toTarget = new Vector2(targetPos.x - _currentPosition.x, targetPos.y - _currentPosition.y);
                if (toTarget.magnitude < DeadZoneRadius)
                {
                    return; // Within dead zone, don't move
                }
            }
            
            _targetPosition = targetPos;
            
            // Allow pan while following if enabled
            if (PanWhileFollowing && _isPanning)
            {
                _targetPosition += new Vector3(_lastPanPosition.x, _lastPanPosition.y, 0) * PanSpeed * Time.deltaTime;
            }
        }
        
        /// <summary>
        /// Gets the current velocity of the follow target.
        /// </summary>
        private Vector2 GetTargetVelocity()
        {
            if (Target == null) return Vector2.zero;
            
            Rigidbody2D rb2d = Target.GetComponent<Rigidbody2D>();
            if (rb2d != null)
            {
                return rb2d.velocity;
            }
            
            Rigidbody rb = Target.GetComponent<Rigidbody>();
            if (rb != null)
            {
                return new Vector2(rb.velocity.x, rb.velocity.y);
            }
            
            return Vector2.zero;
        }
        
        /// <summary>
        /// Updates the camera pan behavior.
        /// </summary>
        private void UpdatePan()
        {
            if (!_isPanning) return;
            
            Vector3 panDelta = new Vector3(_lastPanPosition.x, _lastPanPosition.y, 0) * PanSpeed * Time.deltaTime;
            _targetPosition += panDelta;
        }
        
        /// <summary>
        /// Updates the camera zoom with smooth interpolation.
        /// </summary>
        private void UpdateZoom()
        {
            float t = ZoomCurve.Evaluate(1f);
            _currentZoom = Mathf.SmoothDamp(_currentZoom, _targetZoom, ref _zoomVelocity, ZoomSmoothTime, Mathf.Infinity, Time.deltaTime);
            
            if (GameCamera != null)
            {
                if (RenderMode == CameraRenderMode.Orthographic)
                {
                    GameCamera.orthographicSize = _currentZoom;
                }
                else
                {
                    GameCamera.fieldOfView = CalculateFOVFromZoom(_currentZoom);
                }
            }
            
            if (Mathf.Abs(_currentZoom - _targetZoom) > 0.001f)
            {
                OnZoomChanged?.Invoke(_currentZoom);
            }
        }
        
        /// <summary>
        /// Handles all touch input including pinch zoom and two-finger pan.
        /// </summary>
        private void HandleTouchInput()
        {
            if (Touchscreen.current == null) return;
            
            var activeTouches = UnityEngine.InputSystem.EnhancedTouch.Touch.activeTouches;
            
            if (activeTouches.Count == 0)
            {
                _isPinching = false;
                _isPanning = false;
                return;
            }
            
            if (activeTouches.Count >= 2 && UsePinchToZoom)
            {
                HandlePinchZoom(activeTouches);
            }
            else if (activeTouches.Count == 1)
            {
                HandleSingleTouchPan(activeTouches[0]);
            }
        }
        
        /// <summary>
        /// Handles pinch-to-zoom gesture.
        /// </summary>
        private void HandlePinchZoom(UnityEngine.InputSystem.EnhancedTouch.ReadOnlyArray<UnityEngine.InputSystem.EnhancedTouch.Touch> touches)
        {
            if (touches.Count < 2) return;
            
            var touch1 = touches[0];
            var touch2 = touches[1];
            
            float currentDistance = Vector2.Distance(touch1.screenPosition, touch2.screenPosition);
            
            if (!_isPinching)
            {
                _pinchStartDistance = currentDistance;
                _pinchStartZoom = _targetZoom;
                _isPinching = true;
            }
            
            if (_pinchStartDistance > 0)
            {
                float scaleFactor = currentDistance / _pinchStartDistance;
                float newZoom = _pinchStartZoom / scaleFactor;
                _targetZoom = Mathf.Clamp(newZoom, MinZoom, MaxZoom);
            }
            
            // Two-finger pan
            if (UseTwoFingerPan)
            {
                Vector2 avgDelta = (touch1.delta + touch2.delta) * 0.5f;
                Pan(-avgDelta * MobilePinchSensitivity);
            }
        }
        
        /// <summary>
        /// Handles single touch pan input.
        /// </summary>
        private void HandleSingleTouchPan(UnityEngine.InputSystem.EnhancedTouch.Touch touch)
        {
            if (touch.phase == UnityEngine.InputSystem.TouchPhase.Began)
            {
                _lastPanPosition = touch.screenPosition;
                _isPanning = true;
            }
            else if (touch.phase == UnityEngine.InputSystem.TouchPhase.Moved)
            {
                Vector2 delta = touch.screenPosition - _lastPanPosition;
                if (delta.magnitude > PanTouchThreshold)
                {
                    Pan(-delta * MobilePinchSensitivity);
                    _lastPanPosition = touch.screenPosition;
                }
            }
            else if (touch.phase == UnityEngine.InputSystem.TouchPhase.Ended || 
                     touch.phase == UnityEngine.InputSystem.TouchPhase.Canceled)
            {
                _isPanning = false;
            }
        }
        
        /// <summary>
        /// Handles mouse input for desktop panning.
        /// </summary>
        private void HandleMouseInput()
        {
            if (Mouse.current == null) return;
            
            // Middle mouse pan
            if (UseMiddleMousePan && Mouse.current.middleButton.isPressed)
            {
                Vector2 mouseDelta = Mouse.current.delta.ReadValue();
                Pan(-mouseDelta * 0.01f * PanSpeed);
            }
            
            // Left mouse drag pan (when not following)
            if (AllowPan && !IsFollowing && Mouse.current.leftButton.isPressed)
            {
                Vector2 mouseDelta = Mouse.current.delta.ReadValue();
                Pan(-mouseDelta * 0.01f * PanSpeed);
            }
        }
        
        /// <summary>
        /// Handles scroll wheel zoom input.
        /// </summary>
        private void HandleScrollZoom()
        {
            if (!UseScrollZoom || Mouse.current == null) return;
            
            float scroll = Mouse.current.scroll.ReadValue().y;
            if (scroll != 0)
            {
                float zoomDelta = scroll * DesktopScrollSensitivity * 0.01f;
                _targetZoom = Mathf.Clamp(_targetZoom - zoomDelta, MinZoom, MaxZoom);
            }
        }
        
        /// <summary>
        /// Handles edge panning when mouse is near screen edges.
        /// </summary>
        private void HandleEdgePan()
        {
            if (!UseEdgePan || Mouse.current == null) return;
            
            Vector2 mousePos = Mouse.current.position.ReadValue();
            Vector2 screenSize = new Vector2(Screen.width, Screen.height);
            
            Vector2 panDirection = Vector2.zero;
            
            if (mousePos.x < EdgePanMargin) panDirection.x = -1;
            else if (mousePos.x > screenSize.x - EdgePanMargin) panDirection.x = 1;
            
            if (mousePos.y < EdgePanMargin) panDirection.y = -1;
            else if (mousePos.y > screenSize.y - EdgePanMargin) panDirection.y = 1;
            
            if (panDirection != Vector2.zero)
            {
                _isEdgePanning = true;
                float smoothTime = PanSmoothTime;
                float targetX = panDirection.x * EdgePanSpeed;
                float targetY = panDirection.y * EdgePanSpeed;
                
                float currentX = Mathf.SmoothDamp(0, targetX, ref _edgePanVelocityX, smoothTime);
                float currentY = Mathf.SmoothDamp(0, targetY, ref _edgePanVelocityY, smoothTime);
                
                Pan(new Vector2(currentX, currentY));
            }
            else
            {
                _isEdgePanning = false;
            }
        }
        
        /// <summary>
        /// Applies camera bounds constraints.
        /// </summary>
        private void ApplyBounds()
        {
            if (!UseBounds) return;
            
            float cameraHeight;
            float cameraWidth;
            
            if (RenderMode == CameraRenderMode.Orthographic && GameCamera != null)
            {
                cameraHeight = _currentZoom;
                cameraWidth = _currentZoom * GameCamera.aspect;
            }
            else if (GameCamera != null)
            {
                float distance = Mathf.Abs(FollowOffset.z);
                cameraHeight = 2f * distance * Mathf.Tan(GameCamera.fieldOfView * 0.5f * Mathf.Deg2Rad);
                cameraWidth = cameraHeight * GameCamera.aspect;
            }
            else
            {
                cameraHeight = _currentZoom;
                cameraWidth = _currentZoom * 1.78f;
            }
            
            if (_cameraBounds != null)
            {
                _targetPosition = _cameraBounds.ClampPosition(_targetPosition, cameraHeight, cameraWidth);
            }
            else
            {
                _targetPosition.x = Mathf.Clamp(_targetPosition.x, MinBounds.x + cameraWidth * 0.5f, MaxBounds.x - cameraWidth * 0.5f);
                _targetPosition.y = Mathf.Clamp(_targetPosition.y, MinBounds.y + cameraHeight * 0.5f, MaxBounds.y - cameraHeight * 0.5f);
            }
        }
        
        /// <summary>
        /// Applies the final smoothed position to the camera transform.
        /// </summary>
        private void ApplyPosition()
        {
            _currentPosition = Vector3.SmoothDamp(_currentPosition, _targetPosition, ref _velocity, FollowSmoothTime, MaxFollowSpeed, Time.deltaTime);
            transform.position = _currentPosition;
        }
        
        /// <summary>
        /// Calculates the optimal zoom level to fit a room of the given size.
        /// </summary>
        private float CalculateOptimalZoomForRoom(float roomWidth, float roomHeight)
        {
            if (GameCamera == null) return DefaultZoom;
            
            float aspect = GameCamera.aspect;
            float zoomForWidth = roomWidth / (2f * aspect);
            float zoomForHeight = roomHeight / 2f;
            
            float optimalZoom = Mathf.Max(zoomForWidth, zoomForHeight);
            return Mathf.Clamp(optimalZoom, MinZoom, MaxZoom);
        }
        
        // Public API
        
        /// <summary>
        /// Sets the target transform to follow.
        /// </summary>
        /// <param name="target">The transform to follow.</param>
        public void SetTarget(Transform target)
        {
            Target = target;
            LockToTarget = true;
            
            if (target != null)
            {
                _targetPosition = target.position + FollowOffset;
                _currentPosition = _targetPosition;
                transform.position = _currentPosition;
            }
        }
        
        /// <summary>
        /// Clears the current follow target.
        /// </summary>
        public void ClearTarget()
        {
            Target = null;
            LockToTarget = false;
        }
        
        /// <summary>
        /// Sets the camera zoom level.
        /// </summary>
        /// <param name="zoom">The desired zoom level.</param>
        /// <param name="instant">Whether to apply instantly without smoothing.</param>
        public void SetZoom(float zoom, bool instant = false)
        {
            _targetZoom = Mathf.Clamp(zoom, MinZoom, MaxZoom);
            
            if (instant)
            {
                _currentZoom = _targetZoom;
                _zoomVelocity = 0;
                
                if (GameCamera != null)
                {
                    if (RenderMode == CameraRenderMode.Orthographic)
                    {
                        GameCamera.orthographicSize = _currentZoom;
                    }
                    else
                    {
                        GameCamera.fieldOfView = CalculateFOVFromZoom(_currentZoom);
                    }
                }
                
                OnZoomChanged?.Invoke(_currentZoom);
            }
        }
        
        /// <summary>
        /// Zooms in by the specified amount.
        /// </summary>
        /// <param name="amount">The amount to zoom in.</param>
        public void ZoomIn(float amount)
        {
            SetZoom(_targetZoom - amount);
        }
        
        /// <summary>
        /// Zooms out by the specified amount.
        /// </summary>
        /// <param name="amount">The amount to zoom out.</param>
        public void ZoomOut(float amount)
        {
            SetZoom(_targetZoom + amount);
        }
        
        /// <summary>
        /// Resets zoom to the default level.
        /// </summary>
        public void ResetZoom()
        {
            SetZoom(DefaultZoom);
        }
        
        /// <summary>
        /// Pans the camera by the specified delta.
        /// </summary>
        /// <param name="delta">The pan delta in world units.</param>
        public void Pan(Vector2 delta)
        {
            if (!AllowPan) return;
            
            _isPanning = true;
            _targetPosition += new Vector3(delta.x, delta.y, 0);
        }
        
        /// <summary>
        /// Smoothly pans the camera to the specified world position.
        /// </summary>
        /// <param name="worldPosition">The world position to pan to.</param>
        /// <param name="duration">The duration of the pan animation.</param>
        public void PanTo(Vector2 worldPosition, float duration = 0.5f)
        {
            ClearTarget();
            Vector3 target = new Vector3(worldPosition.x, worldPosition.y, _targetPosition.z);
            StartCoroutine(PanToCoroutine(target, duration));
        }
        
        /// <summary>
        /// Coroutine for smooth panning to a position.
        /// </summary>
        private System.Collections.IEnumerator PanToCoroutine(Vector3 target, float duration)
        {
            Vector3 start = _targetPosition;
            float elapsed = 0;
            
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                _targetPosition = Vector3.Lerp(start, target, t);
                yield return null;
            }
            
            _targetPosition = target;
        }
        
        /// <summary>
        /// Instantly jumps the camera to the specified world position.
        /// </summary>
        /// <param name="worldPosition">The world position to jump to.</param>
        public void JumpTo(Vector2 worldPosition)
        {
            ClearTarget();
            _targetPosition = new Vector3(worldPosition.x, worldPosition.y, _targetPosition.z);
            _currentPosition = _targetPosition;
            transform.position = _currentPosition;
            OnCameraMoved?.Invoke(_currentPosition);
        }
        
        /// <summary>
        /// Triggers a screen shake effect.
        /// </summary>
        /// <param name="intensity">The shake intensity.</param>
        /// <param name="duration">The shake duration.</param>
        public void Shake(float intensity, float duration)
        {
            CameraShake shake = GetComponent<CameraShake>();
            if (shake != null)
            {
                shake.Shake(intensity, duration);
            }
        }
        
        /// <summary>
        /// Zooms to fit a room of the specified size centered at the given position.
        /// </summary>
        /// <param name="roomCenter">The center of the room.</param>
        /// <param name="roomWidth">The width of the room.</param>
        /// <param name="roomHeight">The height of the room.</param>
        public void ZoomToFitRoom(Vector2 roomCenter, float roomWidth, float roomHeight)
        {
            float optimalZoom = CalculateOptimalZoomForRoom(roomWidth, roomHeight);
            SetZoom(optimalZoom);
            PanTo(roomCenter, 0.5f);
        }
        
        /// <summary>
        /// Enables or disables target following.
        /// </summary>
        /// <param name="follow">Whether to follow the target.</param>
        public void SetFollowEnabled(bool follow)
        {
            LockToTarget = follow;
        }
        
        /// <summary>
        /// Enables or disables camera bounds.
        /// </summary>
        /// <param name="enabled">Whether bounds are enabled.</param>
        public void SetBoundsEnabled(bool enabled)
        {
            UseBounds = enabled;
        }
        
        /// <summary>
        /// Updates the camera bounds.
        /// </summary>
        /// <param name="min">The minimum bounds.</param>
        /// <param name="max">The maximum bounds.</param>
        public void SetBounds(Vector2 min, Vector2 max)
        {
            MinBounds = min;
            MaxBounds = max;
            
            if (_cameraBounds != null)
            {
                _cameraBounds.SetBounds(min, max);
            }
        }
        
        /// <summary>
        /// Gets the current camera position.
        /// </summary>
        public Vector3 GetPosition()
        {
            return _currentPosition;
        }
        
        /// <summary>
        /// Gets the current target position.
        /// </summary>
        public Vector3 GetTargetPosition()
        {
            return _targetPosition;
        }
        
        /// <summary>
        /// Converts a screen position to a world position at the camera's z-depth.
        /// </summary>
        /// <param name="screenPosition">The screen position.</param>
        public Vector3 ScreenToWorldPoint(Vector2 screenPosition)
        {
            if (GameCamera != null)
            {
                return GameCamera.ScreenToWorldPoint(new Vector3(screenPosition.x, screenPosition.y, Mathf.Abs(FollowOffset.z)));
            }
            return Vector3.zero;
        }
        
        /// <summary>
        /// Converts a world position to a screen position.
        /// </summary>
        /// <param name="worldPosition">The world position.</param>
        public Vector2 WorldToScreenPoint(Vector3 worldPosition)
        {
            if (GameCamera != null)
            {
                return GameCamera.WorldToScreenPoint(worldPosition);
            }
            return Vector2.zero;
        }
    }
    
    /// <summary>
    /// Defines the camera render mode.
    /// </summary>
    public enum CameraRenderMode
    {
        /// <summary>Orthographic projection.</summary>
        Orthographic,
        /// <summary>Perspective projection.</summary>
        Perspective
    }
}
