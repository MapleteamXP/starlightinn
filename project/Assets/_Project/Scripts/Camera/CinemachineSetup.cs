using System;
using System.Collections;
using UnityEngine;

#if CINEMACHINE
using Cinemachine;
#endif

namespace KawaiiCool.Camera
{
    /// <summary>
    /// Sets up and manages Cinemachine virtual cameras for different contexts.
    /// </summary>
    public class CinemachineSetup : MonoBehaviour
    {
        [Header("Virtual Cameras")]
        public GameObject FollowCameraPrefab;
        public GameObject RoomOverviewCameraPrefab;
        public GameObject CloseUpCameraPrefab;
        public GameObject EventCameraPrefab;
        
        [Header("Current Camera")]
        public CameraContext CurrentContext = CameraContext.Default;
        
        [Header("Transitions")]
        public float DefaultBlendTime = 1f;
        public AnimationCurve BlendCurve = AnimationCurve.EaseInOut(0, 0, 1, 1);
        public bool UseCinemachineBlends = true;
        
        [Header("Settings")]
        public Transform DefaultFollowTarget;
        public Vector3 DefaultOffset = new Vector3(0, 2, -10);
        public float DefaultCameraDistance = 10f;
        
#if CINEMACHINE
        private CinemachineVirtualCamera _followCamera;
        private CinemachineVirtualCamera _roomOverviewCamera;
        private CinemachineVirtualCamera _closeUpCamera;
        private CinemachineVirtualCamera _eventCamera;
        private CinemachineBrain _brain;
        private CinemachineVirtualCamera _activeCamera;
#endif
        
        private Transform _closeUpTarget;
        private float _closeUpDuration;
        private Coroutine _closeUpCoroutine;
        private Coroutine _transitionCoroutine;
        
        public event Action<CameraContext> OnContextChanged;
        
        /// <summary>
        /// Called when the script instance is being loaded.
        /// </summary>
        private void Awake()
        {
#if CINEMACHINE
            _brain = FindObjectOfType<CinemachineBrain>();
            if (_brain == null)
            {
                Camera mainCamera = Camera.main;
                if (mainCamera != null)
                {
                    _brain = mainCamera.gameObject.AddComponent<CinemachineBrain>();
                }
            }
            
            SetupDefaultBlend();
#endif
        }
        
        /// <summary>
        /// Called on the frame when the script is enabled.
        /// </summary>
        private void Start()
        {
#if CINEMACHINE
            // Auto-setup follow camera if we have a default target
            if (DefaultFollowTarget != null)
            {
                SetupFollowCamera(DefaultFollowTarget);
            }
#endif
        }
        
#if CINEMACHINE
        /// <summary>
        /// Sets up the default Cinemachine blend settings.
        /// </summary>
        private void SetupDefaultBlend()
        {
            if (_brain == null) return;
            
            CinemachineBlendDefinition blend = new CinemachineBlendDefinition(
                CinemachineBlendDefinition.Style.EaseInOut,
                DefaultBlendTime
            );
            _brain.m_DefaultBlend = blend;
        }
        
        /// <summary>
        /// Creates a virtual camera from a prefab if it doesn't exist.
        /// </summary>
        private CinemachineVirtualCamera GetOrCreateCamera(GameObject prefab, string name)
        {
            if (prefab == null) return null;
            
            GameObject existing = GameObject.Find(name);
            if (existing != null)
            {
                return existing.GetComponent<CinemachineVirtualCamera>();
            }
            
            GameObject instance = Instantiate(prefab);
            instance.name = name;
            return instance.GetComponent<CinemachineVirtualCamera>();
        }
#endif
        
        /// <summary>
        /// Sets up a follow camera that tracks a target.
        /// </summary>
        /// <param name="target">The target transform to follow.</param>
        public void SetupFollowCamera(Transform target)
        {
#if CINEMACHINE
            if (_followCamera == null)
            {
                _followCamera = GetOrCreateCamera(FollowCameraPrefab, "CM_FollowCamera");
            }
            
            if (_followCamera != null)
            {
                _followCamera.Follow = target;
                _followCamera.Priority = 10;
                _activeCamera = _followCamera;
                
                // Configure follow settings
                var body = _followCamera.GetCinemachineComponent<CinemachineTransposer>();
                if (body != null)
                {
                    body.m_FollowOffset = DefaultOffset;
                }
            }
#endif
            CurrentContext = CameraContext.Follow;
            OnContextChanged?.Invoke(CurrentContext);
        }
        
        /// <summary>
        /// Sets up a room overview camera showing the entire room.
        /// </summary>
        /// <param name="roomCenter">The center of the room.</param>
        /// <param name="roomSize">The size of the room.</param>
        public void SetupRoomOverview(Vector2 roomCenter, float roomSize)
        {
#if CINEMACHINE
            if (_roomOverviewCamera == null)
            {
                _roomOverviewCamera = GetOrCreateCamera(RoomOverviewCameraPrefab, "CM_RoomOverview");
            }
            
            if (_roomOverviewCamera != null)
            {
                _roomOverviewCamera.transform.position = new Vector3(roomCenter.x, roomCenter.y, _roomOverviewCamera.transform.position.z);
                _roomOverviewCamera.Priority = 20;
                _activeCamera = _roomOverviewCamera;
                
                var lens = _roomOverviewCamera.m_Lens;
                lens.OrthographicSize = roomSize * 0.5f;
                _roomOverviewCamera.m_Lens = lens;
            }
#endif
            CurrentContext = CameraContext.Overview;
            OnContextChanged?.Invoke(CurrentContext);
        }
        
        /// <summary>
        /// Sets up a close-up camera focused on a target.
        /// </summary>
        /// <param name="target">The target to focus on.</param>
        /// <param name="duration">Duration before returning to default.</param>
        public void SetupCloseUp(Transform target, float duration = 2f)
        {
#if CINEMACHINE
            if (_closeUpCamera == null)
            {
                _closeUpCamera = GetOrCreateCamera(CloseUpCameraPrefab, "CM_CloseUp");
            }
            
            if (_closeUpCamera != null)
            {
                _closeUpTarget = target;
                _closeUpDuration = duration;
                
                _closeUpCamera.Follow = target;
                _closeUpCamera.LookAt = target;
                _closeUpCamera.Priority = 30;
                _activeCamera = _closeUpCamera;
                
                var lens = _closeUpCamera.m_Lens;
                lens.OrthographicSize = 3f;
                _closeUpCamera.m_Lens = lens;
                
                // Auto-return after duration
                if (_closeUpCoroutine != null)
                {
                    StopCoroutine(_closeUpCoroutine);
                }
                _closeUpCoroutine = StartCoroutine(CloseUpTimeoutCoroutine(duration));
            }
#endif
            CurrentContext = CameraContext.CloseUp;
            OnContextChanged?.Invoke(CurrentContext);
        }
        
        /// <summary>
        /// Sets up an event camera at a specific position.
        /// </summary>
        /// <param name="eventPosition">The position of the event.</param>
        public void SetupEventCamera(Vector2 eventPosition)
        {
#if CINEMACHINE
            if (_eventCamera == null)
            {
                _eventCamera = GetOrCreateCamera(EventCameraPrefab, "CM_EventCamera");
            }
            
            if (_eventCamera != null)
            {
                _eventCamera.transform.position = new Vector3(eventPosition.x, eventPosition.y, _eventCamera.transform.position.z);
                _eventCamera.Priority = 25;
                _activeCamera = _eventCamera;
            }
#endif
            CurrentContext = CameraContext.Event;
            OnContextChanged?.Invoke(CurrentContext);
        }
        
        /// <summary>
        /// Coroutine that returns from close-up to default after a timeout.
        /// </summary>
        private IEnumerator CloseUpTimeoutCoroutine(float duration)
        {
            yield return new WaitForSeconds(duration);
            ResetToDefault();
        }
        
        /// <summary>
        /// Transitions to a new camera context with a blend.
        /// </summary>
        /// <param name="context">The target camera context.</param>
        /// <param name="blendTime">The blend duration.</param>
        public void TransitionTo(CameraContext context, float blendTime = 1f)
        {
            if (_transitionCoroutine != null)
            {
                StopCoroutine(_transitionCoroutine);
            }
            
            _transitionCoroutine = StartCoroutine(TransitionCoroutine(context, blendTime));
        }
        
        /// <summary>
        /// Coroutine that handles smooth transition between camera contexts.
        /// </summary>
        private IEnumerator TransitionCoroutine(CameraContext context, float blendTime)
        {
#if CINEMACHINE
            if (_brain != null)
            {
                CinemachineBlendDefinition originalBlend = _brain.m_DefaultBlend;
                
                CinemachineBlendDefinition newBlend = new CinemachineBlendDefinition(
                    CinemachineBlendDefinition.Style.EaseInOut,
                    blendTime
                );
                _brain.m_DefaultBlend = newBlend;
                
                // Wait for blend to complete
                yield return new WaitForSeconds(blendTime);
                
                _brain.m_DefaultBlend = originalBlend;
            }
#endif
            CurrentContext = context;
            OnContextChanged?.Invoke(CurrentContext);
        }
        
        /// <summary>
        /// Resets the camera to the default context.
        /// </summary>
        public void ResetToDefault()
        {
#if CINEMACHINE
            // Lower all virtual camera priorities
            if (_followCamera != null) _followCamera.Priority = 10;
            if (_roomOverviewCamera != null) _roomOverviewCamera.Priority = 0;
            if (_closeUpCamera != null) _closeUpCamera.Priority = 0;
            if (_eventCamera != null) _eventCamera.Priority = 0;
            
            if (_followCamera != null && DefaultFollowTarget != null)
            {
                _followCamera.Follow = DefaultFollowTarget;
                _activeCamera = _followCamera;
            }
#endif
            
            if (_closeUpCoroutine != null)
            {
                StopCoroutine(_closeUpCoroutine);
                _closeUpCoroutine = null;
            }
            
            CurrentContext = CameraContext.Default;
            OnContextChanged?.Invoke(CurrentContext);
        }
        
        /// <summary>
        /// Sets the default follow target.
        /// </summary>
        /// <param name="target">The new default follow target.</param>
        public void SetDefaultFollowTarget(Transform target)
        {
            DefaultFollowTarget = target;
#if CINEMACHINE
            if (_followCamera != null)
            {
                _followCamera.Follow = target;
            }
#endif
        }
        
        /// <summary>
        /// Gets the currently active virtual camera.
        /// </summary>
        public object GetActiveCamera()
        {
#if CINEMACHINE
            return _activeCamera;
#else
            return null;
#endif
        }
        
        /// <summary>
        /// Checks if Cinemachine is available.
        /// </summary>
        public bool IsCinemachineAvailable
        {
            get
            {
#if CINEMACHINE
                return true;
#else
                return false;
#endif
            }
        }
        
        /// <summary>
        /// Gets whether a transition is currently in progress.
        /// </summary>
        public bool IsTransitioning => _transitionCoroutine != null;
        
        /// <summary>
        /// Defines the different camera contexts for Cinemachine setup.
        /// </summary>
        public enum CameraContext
        {
            /// <summary>Default gameplay camera.</summary>
            Default,
            /// <summary>Camera following a target.</summary>
            Follow,
            /// <summary>Room overview camera.</summary>
            Overview,
            /// <summary>Close-up focused camera.</summary>
            CloseUp,
            /// <summary>Event-specific camera.</summary>
            Event,
            /// <summary>Cutscene camera.</summary>
            Cutscene
        }
    }
}
