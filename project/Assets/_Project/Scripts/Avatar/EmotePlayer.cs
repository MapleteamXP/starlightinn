using System;
using System.Collections;
using UnityEngine;

namespace KawaiiCool.Avatar
{
    /// <summary>
    /// ScriptableObject defining a single emote animation with audio,
    /// duration, and gameplay behavior flags.
    /// </summary>
    [CreateAssetMenu(fileName = "Emote_", menuName = "KawaiiCool/Emote")]
    public class EmoteData : ScriptableObject
    {
        [Header("Identity")]
        [Tooltip("Unique identifier for the emote (used for triggers and save data).")]
        public string EmoteId;

        [Tooltip("Human-readable name shown in the emote wheel UI.")]
        public string DisplayName;

        [Tooltip("Icon sprite displayed in the emote selection UI.")]
        public Sprite Icon;

        [Header("Animation & Audio")]
        [Tooltip("Animation clip played when this emote is triggered.")]
        public AnimationClip AnimationClip;

        [Tooltip("Optional audio clip played alongside the animation.")]
        public AudioClip SFX;

        [Tooltip("Duration of the emote in seconds. Ignored if Loop is true.")]
        public float Duration = 2f;

        [Tooltip("If true, the emote animation loops until manually stopped.")]
        public bool Loop;

        [Header("Gameplay")]
        [Tooltip("If true, the player can move while the emote plays.")]
        public bool CanMoveWhilePlaying;

        [Tooltip("If true, the animation freezes on the final frame until cancelled.")]
        public bool FreezeAtEnd;

        [Tooltip("Optional PartId required to be equipped for this emote to be available.")]
        public string RequiredBodyPart;

        private void OnValidate()
        {
            if (string.IsNullOrWhiteSpace(EmoteId))
            {
                EmoteId = name.Replace("Emote_", "").ToLowerInvariant().Trim();
            }

            if (string.IsNullOrWhiteSpace(DisplayName))
            {
                DisplayName = ObjectNames.NicifyVariableName(name.Replace("Emote_", ""));
            }

            if (Duration < 0.1f && !Loop)
                Duration = 0.1f;
        }
    }

    /// <summary>
    /// Handles emote playback lifecycle: triggering, looping, cancellation,
    /// audio sync, and event dispatch. Works in tandem with <see cref="AvatarController"/>
    /// and <see cref="AvatarAnimationController"/>.
    /// </summary>
    [RequireComponent(typeof(Animator))]
    public class EmotePlayer : MonoBehaviour
    {
        [Header("References")]
        [Tooltip("Animator component for playing emote animations.")]
        public Animator Animator;

        [Tooltip("Audio source for playing emote sound effects.")]
        public AudioSource EmoteAudioSource;

        // State
        private EmoteData _currentEmote;
        private Coroutine _emoteCoroutine;
        private bool _isPlayingEmote;

        // Cached Animator property hashes for performance
        private static readonly int EmoteTriggerHash = Animator.StringToHash("PlayEmote");
        private static readonly int EmoteIdHash = Animator.StringToHash("EmoteId");
        private static readonly int EmoteSpeedHash = Animator.StringToHash("EmoteSpeed");
        private static readonly int CancelEmoteHash = Animator.StringToHash("CancelEmote");

        // Events
        /// <summary>Invoked when any emote begins playback.</summary>
        public event Action<EmoteData> OnEmoteStarted;

        /// <summary>Invoked when an emote finishes its natural duration.</summary>
        public event Action OnEmoteEnded;

        /// <summary>Invoked when an emote is manually cancelled before completion.</summary>
        public event Action OnEmoteCancelled;

        /// <summary>Returns true if an emote is currently playing.</summary>
        public bool IsPlayingEmote => _isPlayingEmote;

        /// <summary>Returns the currently active emote data, or null if none.</summary>
        public EmoteData CurrentEmote => _currentEmote;

        private void Awake()
        {
            if (Animator == null)
                Animator = GetComponent<Animator>();

            if (EmoteAudioSource == null)
            {
                EmoteAudioSource = GetComponent<AudioSource>();
                if (EmoteAudioSource == null)
                {
                    EmoteAudioSource = gameObject.AddComponent<AudioSource>();
                    EmoteAudioSource.playOnAwake = false;
                }
            }
        }

        private void OnDestroy()
        {
            if (_emoteCoroutine != null)
            {
                StopCoroutine(_emoteCoroutine);
                _emoteCoroutine = null;
            }
            OnEmoteStarted = null;
            OnEmoteEnded = null;
            OnEmoteCancelled = null;
        }

        /// <summary>
        /// Begins playing the specified emote. Cancels any currently playing emote first.
        /// </summary>
        /// <param name="emote">The emote data to play.</param>
        public void PlayEmote(EmoteData emote)
        {
            if (emote == null)
            {
                Debug.LogWarning("[EmotePlayer] Cannot play null emote.");
                return;
            }

            // Cancel existing emote before starting new one
            if (_isPlayingEmote)
                StopEmoteInternal(cancelled: true);

            _currentEmote = emote;
            _isPlayingEmote = true;

            // Trigger animation via Animator
            if (Animator != null && Animator.runtimeAnimatorController != null)
            {
                // Use AnimationClip directly via override if available,
                // otherwise fall back to trigger + EmoteId parameter
                if (emote.AnimationClip != null)
                {
                    Animator.SetInteger(EmoteIdHash, emote.AnimationClip.GetInstanceID());
                }
                Animator.SetTrigger(EmoteTriggerHash);
            }

            // Play SFX
            if (EmoteAudioSource != null && emote.SFX != null)
            {
                EmoteAudioSource.clip = emote.SFX;
                EmoteAudioSource.loop = emote.Loop;
                EmoteAudioSource.Play();
            }

            OnEmoteStarted?.Invoke(emote);

            // Start coroutine for non-looping emotes with finite duration
            if (!emote.Loop || !emote.FreezeAtEnd)
            {
                _emoteCoroutine = StartCoroutine(EmoteCoroutine(emote));
            }
        }

        /// <summary>
        /// Immediately stops the currently playing emote and resets animation state.
        /// </summary>
        public void StopEmote()
        {
            if (!_isPlayingEmote)
                return;

            StopEmoteInternal(cancelled: true);
        }

        /// <summary>
        /// Internal cleanup shared by natural completion and cancellation.
        /// </summary>
        /// <param name="cancelled">True if stopped manually before finishing.</param>
        private void StopEmoteInternal(bool cancelled)
        {
            if (_emoteCoroutine != null)
            {
                StopCoroutine(_emoteCoroutine);
                _emoteCoroutine = null;
            }

            // Reset Animator
            if (Animator != null)
            {
                Animator.SetTrigger(CancelEmoteHash);
                Animator.ResetTrigger(EmoteTriggerHash);
            }

            // Stop audio
            if (EmoteAudioSource != null && EmoteAudioSource.isPlaying)
            {
                EmoteAudioSource.Stop();
                EmoteAudioSource.clip = null;
                EmoteAudioSource.loop = false;
            }

            _currentEmote = null;
            _isPlayingEmote = false;

            if (cancelled)
                OnEmoteCancelled?.Invoke();
            else
                OnEmoteEnded?.Invoke();
        }

        /// <summary>
        /// Coroutine that waits for the emote's natural duration then cleans up.
        /// Handles FreezeAtEnd by pausing the animator at the final frame.
        /// </summary>
        /// <param name="emote">The emote being played.</param>
        private IEnumerator EmoteCoroutine(EmoteData emote)
        {
            if (emote == null)
                yield break;

            float waitTime = emote.Loop ? 0f : emote.Duration;
            float timer = 0f;

            while (timer < waitTime)
            {
                timer += Time.deltaTime;
                yield return null;
            }

            // Freeze at final frame if requested
            if (emote.FreezeAtEnd && Animator != null)
            {
                Animator.speed = 0f;

                // Wait indefinitely until cancelled externally
                while (_isPlayingEmote)
                {
                    yield return null;
                }

                // Restore animator speed
                Animator.speed = 1f;
                yield break;
            }

            // Natural completion
            StopEmoteInternal(cancelled: false);
        }
    }
}
