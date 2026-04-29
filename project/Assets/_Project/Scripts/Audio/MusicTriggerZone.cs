using UnityEngine;

namespace KawaiiCoolIsland.Audio
{
    /// <summary>
    /// Triggers music state changes when the player enters or exits a 2D trigger zone.
    /// Supports one-shot triggers, reversion to previous state on exit, custom layer volume
    /// overrides, and optional enter/exit sound effects.
    /// 
    /// Place this component on a GameObject with a Collider2D set to IsTrigger=true
    /// in areas of your island where you want different music arrangements.
    /// </summary>
    [RequireComponent(typeof(Collider2D))]
    public class MusicTriggerZone : MonoBehaviour
    {
        #region Inspector Fields
        [Header("Trigger")]
        [Tooltip("The Collider2D that defines this trigger zone. Auto-assigned if not set.")]
        public Collider2D TriggerCollider;

        [Tooltip("Whether to trigger music change when the player enters the zone.")]
        public bool TriggerOnEnter = true;

        [Tooltip("Whether to revert music when the player exits the zone.")]
        public bool TriggerOnExit = true;

        [Tooltip("If true, the zone only triggers once and is then disabled.")]
        public bool OneShot = false;

        [Header("Music Change")]
        [Tooltip("The target music state to transition to when entering this zone.")]
        public MusicState TargetMusicState = MusicState.Explore;

        [Tooltip("Duration of the music transition in seconds. Use -1 for default.")]
        public float TransitionTime = 2f;

        [Tooltip(
            "Optional custom layer volumes override. Must be 4 floats: [Base, Melody, Harmony, Accent]. " +
            "Leave empty to use the state's default volumes.")]
        public float[] CustomLayerVolumes = new float[0];

        [Header("SFX")]
        [Tooltip("Optional SFX to play when entering the zone. Leave empty for no sound.")]
        public string EnterSFX;

        [Tooltip("Optional SFX to play when exiting the zone. Leave empty for no sound.")]
        public string ExitSFX;

        [Header("Filtering")]
        [Tooltip("Only trigger for objects with this tag. Leave empty for any object.")]
        public string TargetTag = "Player";

        [Tooltip("Layers that can trigger this zone. Default is Everything.")]
        public LayerMask TriggerLayers = ~0; // Everything by default

        [Header("Gizmo")]
        [Tooltip("Color for the trigger zone gizmo in the editor.")]
        public Color GizmoColor = new(0.2f, 0.8f, 0.4f, 0.3f);
        #endregion

        #region Private State
        private bool _hasTriggered;
        private MusicState _previousState;
        private bool _playerInside;
        private DynamicMusicController _musicController;
        #endregion

        #region Unity Lifecycle
        private void Awake()
        {
            // Auto-assign collider if not set
            if (TriggerCollider == null)
            {
                TriggerCollider = GetComponent<Collider2D>();
            }

            // Ensure the collider is set to trigger
            if (TriggerCollider != null && !TriggerCollider.isTrigger)
            {
                Debug.LogWarning($"[MusicTriggerZone] Collider on '{gameObject.name}' should be set to IsTrigger=true.");
            }

            // Validate custom layer volumes
            if (CustomLayerVolumes.Length > 0 && CustomLayerVolumes.Length != 4)
            {
                Debug.LogWarning(
                    $"[MusicTriggerZone] CustomLayerVolumes on '{gameObject.name}' must have exactly 4 elements. " +
                    "Clearing invalid array.");
                CustomLayerVolumes = new float[0];
            }
        }

        private void Start()
        {
            _musicController = DynamicMusicController.Instance;
            if (_musicController == null)
            {
                Debug.LogWarning(
                    $"[MusicTriggerZone] DynamicMusicController not found on '{gameObject.name}'. " +
                    "Music triggers will not function.");
            }
        }

        private void OnValidate()
        {
            // Ensure transition time is non-negative (except -1 sentinel)
            if (TransitionTime < 0 && TransitionTime != -1)
            {
                TransitionTime = 2f;
            }

            // Clamp custom layer volumes
            if (CustomLayerVolumes != null)
            {
                for (int i = 0; i < CustomLayerVolumes.Length; i++)
                {
                    CustomLayerVolumes[i] = Mathf.Clamp01(CustomLayerVolumes[i]);
                }
            }
        }
        #endregion

        #region Trigger Events
        /// <summary>
        /// Called when a Collider2D enters the trigger zone.
        /// </summary>
        /// <param name="other">The collider that entered the zone.</param>
        private void OnTriggerEnter2D(Collider2D other)
        {
            if (!TriggerOnEnter) return;
            if (!ValidateTarget(other)) return;
            if (OneShot && _hasTriggered) return;

            _playerInside = true;
            TriggerMusicChange();
        }

        /// <summary>
        /// Called when a Collider2D exits the trigger zone.
        /// </summary>
        /// <param name="other">The collider that exited the zone.</param>
        private void OnTriggerExit2D(Collider2D other)
        {
            if (!TriggerOnExit) return;
            if (!ValidateTarget(other)) return;

            _playerInside = false;
            RevertMusic();
        }
        #endregion

        #region Music Change Logic
        /// <summary>
        /// Triggers the music change to the target state.
        /// Saves the previous state for potential reversion.
        /// </summary>
        private void TriggerMusicChange()
        {
            if (_musicController == null) return;

            // Save current state for reversion
            _previousState = _musicController.CurrentState;

            // Determine transition time
            float transitionTime = TransitionTime < 0
                ? _musicController.SnapshotTransitionTime
                : TransitionTime;

            // Apply custom layer volumes if provided
            if (CustomLayerVolumes.Length == 4)
            {
                // First transition to the state normally
                _musicController.SetMusicState(TargetMusicState, transitionTime);

                // Then override individual layers
                for (int i = 0; i < 4; i++)
                {
                    _musicController.SetLayerVolume(i, CustomLayerVolumes[i], transitionTime);
                }
            }
            else
            {
                // Standard state transition
                _musicController.SetMusicState(TargetMusicState, transitionTime);
            }

            _hasTriggered = true;

            // Play enter SFX if specified
            if (!string.IsNullOrEmpty(EnterSFX))
            {
                PlaySFX(EnterSFX);
            }

            if (DynamicMusicController.Instance != null)
            {
                Debug.Log(
                    $"[MusicTriggerZone] '{gameObject.name}' triggered music state: {TargetMusicState} " +
                    $"(from: {_previousState})");
            }
        }

        /// <summary>
        /// Reverts music to the previously saved state.
        /// Called when the player exits the trigger zone (if TriggerOnExit is enabled).
        /// </summary>
        private void RevertMusic()
        {
            if (_musicController == null) return;

            float transitionTime = TransitionTime < 0
                ? _musicController.SnapshotTransitionTime
                : TransitionTime;

            _musicController.SetMusicState(_previousState, transitionTime);

            // Play exit SFX if specified
            if (!string.IsNullOrEmpty(ExitSFX))
            {
                PlaySFX(ExitSFX);
            }

            Debug.Log($"[MusicTriggerZone] '{gameObject.name}' reverted music to: {_previousState}");
        }
        #endregion

        #region Validation
        /// <summary>
        /// Validates whether the triggering object matches our filters.
        /// </summary>
        /// <param name="other">The collider that triggered the event.</param>
        /// <returns>True if the object passes all filters.</returns>
        private bool ValidateTarget(Collider2D other)
        {
            // Check tag filter
            if (!string.IsNullOrEmpty(TargetTag) && !other.CompareTag(TargetTag))
            {
                return false;
            }

            // Check layer filter
            if ((TriggerLayers.value & (1 << other.gameObject.layer)) == 0)
            {
                return false;
            }

            return true;
        }
        #endregion

        #region SFX Playback
        /// <summary>
        /// Plays a sound effect through the SFXManager.
        /// </summary>
        /// <param name="sfxId">The SFX identifier to play.</param>
        private void PlaySFX(string sfxId)
        {
            if (SFXManager.Instance != null)
            {
                SFXManager.Instance.PlayUISFX(sfxId);
            }
        }
        #endregion

        #region Public API
        /// <summary>
        /// Manually triggers the music change for this zone.
        /// Useful for scripting or testing.
        /// </summary>
        public void TriggerManually()
        {
            _musicController = DynamicMusicController.Instance;
            TriggerMusicChange();
        }

        /// <summary>
        /// Resets the one-shot trigger so it can fire again.
        /// </summary>
        public void ResetTrigger()
        {
            _hasTriggered = false;
        }

        /// <summary>
        /// Enables or disables the trigger zone.
        /// </summary>
        /// <param name="enabled">Whether the zone should be active.</param>
        public void SetZoneEnabled(bool enabled)
        {
            if (TriggerCollider != null)
            {
                TriggerCollider.enabled = enabled;
            }
        }

        /// <summary>
        /// Gets whether a valid target is currently inside the zone.
        /// </summary>
        public bool IsPlayerInside => _playerInside;

        /// <summary>
        /// Gets whether this zone has already triggered (for one-shot zones).
        /// </summary>
        public bool HasTriggered => _hasTriggered;
        #endregion

        #region Editor Gizmos
        /// <summary>
        /// Draws the trigger zone bounds in the Scene view.
        /// </summary>
        private void OnDrawGizmos()
        {
            if (TriggerCollider == null) return;

            Gizmos.color = GizmoColor;

            // Draw different shapes based on collider type
            switch (TriggerCollider)
            {
                case BoxCollider2D box:
                    DrawBoxGizmo(box);
                    break;
                case CircleCollider2D circle:
                    DrawCircleGizmo(circle);
                    break;
                case PolygonCollider2D poly:
                    DrawPolygonGizmo(poly);
                    break;
                case CapsuleCollider2D capsule:
                    DrawCapsuleGizmo(capsule);
                    break;
                default:
                    // Fallback: draw a wire cube at the transform position
                    Gizmos.DrawWireCube(transform.position, Vector3.one * 2f);
                    break;
            }

            // Draw a small icon at the center
            Gizmos.color = new Color(GizmoColor.r, GizmoColor.g, GizmoColor.b, 1f);
            Gizmos.DrawSphere(transform.position, 0.15f);
        }

        /// <summary>
        /// Draws gizmo for BoxCollider2D.
        /// </summary>
        private void DrawBoxGizmo(BoxCollider2D box)
        {
            Vector3 center = transform.TransformPoint(box.offset);
            Vector3 size = new(
                box.size.x * transform.lossyScale.x,
                box.size.y * transform.lossyScale.y,
                0.1f);

            Gizmos.DrawCube(center, size);
            Gizmos.color = new Color(GizmoColor.r, GizmoColor.g, GizmoColor.b, 1f);
            Gizmos.DrawWireCube(center, size);
        }

        /// <summary>
        /// Draws gizmo for CircleCollider2D.
        /// </summary>
        private void DrawCircleGizmo(CircleCollider2D circle)
        {
            Vector3 center = transform.TransformPoint(circle.offset);
            float radius = circle.radius * Mathf.Max(transform.lossyScale.x, transform.lossyScale.y);

            Gizmos.DrawSphere(center, radius);
            Gizmos.color = new Color(GizmoColor.r, GizmoColor.g, GizmoColor.b, 1f);
            Gizmos.DrawWireSphere(center, radius);
        }

        /// <summary>
        /// Draws gizmo for PolygonCollider2D.
        /// </summary>
        private void DrawPolygonGizmo(PolygonCollider2D poly)
        {
            // Draw the polygon outline
            Gizmos.color = new Color(GizmoColor.r, GizmoColor.g, GizmoColor.b, 1f);

            for (int i = 0; i < poly.pathCount; i++)
            {
                Vector2[] points = poly.GetPath(i);
                if (points.Length < 2) continue;

                for (int j = 0; j < points.Length; j++)
                {
                    Vector3 p1 = transform.TransformPoint(points[j]);
                    Vector3 p2 = transform.TransformPoint(points[(j + 1) % points.Length]);
                    Gizmos.DrawLine(p1, p2);
                }
            }
        }

        /// <summary>
        /// Draws gizmo for CapsuleCollider2D.
        /// </summary>
        private void DrawCapsuleGizmo(CapsuleCollider2D capsule)
        {
            Vector3 center = transform.TransformPoint(capsule.offset);
            Vector2 size = capsule.size;
            size.x *= transform.lossyScale.x;
            size.y *= transform.lossyScale.y;

            // Draw as a box for simplicity
            Gizmos.DrawCube(center, new Vector3(size.x, size.y, 0.1f));
            Gizmos.color = new Color(GizmoColor.r, GizmoColor.g, GizmoColor.b, 1f);
            Gizmos.DrawWireCube(center, new Vector3(size.x, size.y, 0.1f));
        }

        /// <summary>
        /// Draws a more prominent gizmo when the object is selected.
        /// </summary>
        private void OnDrawGizmosSelected()
        {
            if (TriggerCollider == null) return;

            Color selectedColor = new(
                Mathf.Clamp01(GizmoColor.r + 0.3f),
                Mathf.Clamp01(GizmoColor.g + 0.3f),
                Mathf.Clamp01(GizmoColor.b + 0.3f),
                0.5f);

            Gizmos.color = selectedColor;

            // Draw a label showing the target state
#if UNITY_EDITOR
            UnityEditor.Handles.Label(
                transform.position + Vector3.up * 0.5f,
                $"Music: {TargetMusicState}\n" +
                $"{(TriggerOnEnter ? "[Enter]" : "")} {(TriggerOnExit ? "[Exit]" : "")} " +
                $"{(OneShot ? "[OneShot]" : "")}");
#endif
        }
        #endregion
    }
}
