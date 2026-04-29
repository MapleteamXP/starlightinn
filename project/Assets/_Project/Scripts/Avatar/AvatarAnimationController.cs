using UnityEngine;

namespace KawaiiCool.Avatar
{
    /// <summary>
    /// Centralizes Animator parameter management for avatar movement, emotes,
    /// and animation speed. Uses hashed parameter IDs for optimal performance.
    /// Attach to the same GameObject as the Animator.
    /// </summary>
    [RequireComponent(typeof(Animator))]
    public class AvatarAnimationController : MonoBehaviour
    {
        private Animator _animator;

        // Cached Animator property hashes for zero-allocation Set/Get calls
        private static readonly int IsMovingHash = Animator.StringToHash("IsMoving");
        private static readonly int MoveXHash = Animator.StringToHash("MoveX");
        private static readonly int MoveYHash = Animator.StringToHash("MoveY");
        private static readonly int MoveMagnitudeHash = Animator.StringToHash("MoveMagnitude");
        private static readonly int EmoteTriggerHash = Animator.StringToHash("PlayEmote");
        private static readonly int EmoteIdHash = Animator.StringToHash("EmoteId");
        private static readonly int AnimationSpeedHash = Animator.StringToHash("AnimationSpeed");
        private static readonly int CancelEmoteHash = Animator.StringToHash("CancelEmote");
        private static readonly int IsGroundedHash = Animator.StringToHash("IsGrounded");
        private static readonly int VelocityYHash = Animator.StringToHash("VelocityY");

        // Smoothing state
        private float _smoothMoveX;
        private float _smoothMoveY;
        private float _smoothMagnitude;

        [Header("Smoothing")]
        [Tooltip("Speed at which movement blend values interpolate toward target.")]
        [Range(1f, 30f)]
        public float BlendSpeed = 10f;

        /// <summary>
        /// Gets the Animator component (cached on first access).
        /// </summary>
        public Animator Animator => _animator;

        private void Awake()
        {
            _animator = GetComponent<Animator>();
            if (_animator == null)
            {
                Debug.LogError("[AvatarAnimationController] No Animator component found on this GameObject.", this);
                enabled = false;
            }
        }

        private void OnEnable()
        {
            ResetBlendValues();
        }

        /// <summary>
        /// Updates movement animation parameters with smooth interpolation.
        /// Call every frame from <see cref="AvatarController.Update"/>. />
        /// </summary>
        /// <param name="x">Horizontal movement input (-1 to 1).</param>
        /// <param name="y">Vertical movement input (-1 to 1).</param>
        /// <param name="isMoving">True if the avatar has movement input.</param>
        public void SetMovement(float x, float y, bool isMoving)
        {
            if (_animator == null) return;

            float targetMagnitude = isMoving ? new Vector2(x, y).magnitude : 0f;
            float delta = Time.deltaTime * BlendSpeed;

            _smoothMoveX = Mathf.MoveTowards(_smoothMoveX, x, delta);
            _smoothMoveY = Mathf.MoveTowards(_smoothMoveY, y, delta);
            _smoothMagnitude = Mathf.MoveTowards(_smoothMagnitude, targetMagnitude, delta);

            _animator.SetFloat(MoveXHash, _smoothMoveX);
            _animator.SetFloat(MoveYHash, _smoothMoveY);
            _animator.SetFloat(MoveMagnitudeHash, _smoothMagnitude);
            _animator.SetBool(IsMovingHash, isMoving);
        }

        /// <summary>
        /// Immediately sets movement values without smoothing. Useful for initialization
        /// or when teleporting the avatar.
        /// </summary>
        /// <param name="x">Horizontal movement input (-1 to 1).</param>
        /// <param name="y">Vertical movement input (-1 to 1).</param>
        /// <param name="isMoving">True if the avatar has movement input.</param>
        public void SetMovementImmediate(float x, float y, bool isMoving)
        {
            _smoothMoveX = x;
            _smoothMoveY = y;
            _smoothMagnitude = isMoving ? new Vector2(x, y).magnitude : 0f;

            if (_animator == null) return;

            _animator.SetFloat(MoveXHash, _smoothMoveX);
            _animator.SetFloat(MoveYHash, _smoothMoveY);
            _animator.SetFloat(MoveMagnitudeHash, _smoothMagnitude);
            _animator.SetBool(IsMovingHash, isMoving);
        }

        /// <summary>
        /// Triggers an emote animation by its numeric ID. The Animator should have
        /// a transition from 'Any State' responding to the PlayEmote trigger.
        /// </summary>
        /// <param name="emoteId">Numeric identifier for the emote animation state.</param>
        public void TriggerEmote(int emoteId)
        {
            if (_animator == null) return;

            _animator.SetInteger(EmoteIdHash, emoteId);
            _animator.SetTrigger(EmoteTriggerHash);
        }

        /// <summary>
        /// Cancels any currently playing emote and returns to idle/movement blend tree.
        /// </summary>
        public void CancelEmote()
        {
            if (_animator == null) return;

            _animator.SetTrigger(CancelEmoteHash);
            _animator.ResetTrigger(EmoteTriggerHash);
        }

        /// <summary>
        /// Sets the overall animation playback speed multiplier.
        /// 1.0 = normal speed. Useful for slow-motion or haste effects.
        /// </summary>
        /// <param name="speed">Speed multiplier (must be positive).</param>
        public void SetAnimationSpeed(float speed)
        {
            if (_animator == null) return;

            _animator.SetFloat(AnimationSpeedHash, Mathf.Max(0.001f, speed));
        }

        /// <summary>
        /// Resets animation speed to normal (1.0).
        /// </summary>
        public void ResetAnimationSpeed()
        {
            if (_animator == null) return;

            _animator.SetFloat(AnimationSpeedHash, 1f);
        }

        /// <summary>
        /// Returns the length of the currently playing animation state in seconds.
        /// Returns 0 if no animation is playing or the Animator is invalid.
        /// </summary>
        public float GetCurrentAnimationLength()
        {
            if (_animator == null || _animator.runtimeAnimatorController == null)
                return 0f;

            AnimatorStateInfo stateInfo = _animator.GetCurrentAnimatorStateInfo(0);
            return stateInfo.length;
        }

        /// <summary>
        /// Returns the normalized time (0-1) of the currently playing animation state.
        /// Useful for syncing visual effects to animation keyframes.
        /// </summary>
        public float GetCurrentAnimationNormalizedTime()
        {
            if (_animator == null)
                return 0f;

            AnimatorStateInfo stateInfo = _animator.GetCurrentAnimatorStateInfo(0);
            return stateInfo.normalizedTime % 1f;
        }

        /// <summary>
        /// Returns true if the current animation state has the given tag.
        /// Useful for checking if an emote or specific action is playing.
        /// </summary>
        /// <param name="tag">The Animator state tag to check.</param>
        public bool IsCurrentStateTagged(string tag)
        {
            if (_animator == null || string.IsNullOrEmpty(tag))
                return false;

            AnimatorStateInfo stateInfo = _animator.GetCurrentAnimatorStateInfo(0);
            return stateInfo.IsTag(tag);
        }

        /// <summary>
        /// Sets the IsGrounded parameter. Useful for avatars with jump/fall animations.
        /// </summary>
        /// <param name="grounded">True if the avatar is on the ground.</param>
        public void SetGrounded(bool grounded)
        {
            if (_animator == null) return;
            _animator.SetBool(IsGroundedHash, grounded);
        }

        /// <summary>
        /// Sets the vertical velocity parameter for jump/fall animation blending.
        /// </summary>
        /// <param name="velocityY">Vertical velocity in units per second.</param>
        public void SetVerticalVelocity(float velocityY)
        {
            if (_animator == null) return;
            _animator.SetFloat(VelocityYHash, velocityY);
        }

        /// <summary>
        /// Resets all blend values to zero. Call when disabling the avatar
        /// to prevent stale interpolation on re-enable.
        /// </summary>
        public void ResetBlendValues()
        {
            _smoothMoveX = 0f;
            _smoothMoveY = 0f;
            _smoothMagnitude = 0f;
        }

        /// <summary>
        /// Forces the Animator to update immediately. Call after teleporting
        /// or making large position changes to prevent visual pops.
        /// </summary>
        public void ForceAnimatorUpdate()
        {
            if (_animator != null)
                _animator.Update(0f);
        }
    }
}
