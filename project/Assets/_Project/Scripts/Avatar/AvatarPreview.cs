using UnityEngine;

namespace KawaiiCool.Avatar
{
    /// <summary>
    /// Renders an avatar preview for the customization UI. Manages a dedicated
    /// preview camera, background color, rotation, emote playback, and thumbnail capture.
    /// Attach to a UI element (e.g., a RawImage displaying the preview RenderTexture).
    /// </summary>
    public class AvatarPreview : MonoBehaviour
    {
        [Header("Avatar")]
        [Tooltip("The AvatarController to preview. Instantiate a separate avatar for preview.")]
        public AvatarController Avatar;

        [Header("Camera")]
        [Tooltip("Dedicated camera rendering the preview (should target PreviewTexture).")]
        public Camera PreviewCamera;

        [Tooltip("RenderTexture the preview camera writes to. Display this in a UI RawImage.")]
        public RenderTexture PreviewTexture;

        [Header("Rotation")]
        [Tooltip("Degrees per second for smooth rotation.")]
        [Range(0f, 180f)]
        public float AutoRotateSpeed = 30f;

        [Tooltip("If true, automatically rotates the preview avatar.")]
        public bool AutoRotate = false;

        [Header("Background")]
        [Tooltip("Default background color for the preview.")]
        public Color DefaultBackground = new Color(0.15f, 0.15f, 0.2f, 1f);

        [Header("Thumbnail Capture")]
        [Tooltip("Resolution of captured thumbnails (square).")]
        [Range(64, 512)]
        public int ThumbnailResolution = 256;

        [Tooltip("Background color used during thumbnail capture (transparent-ready).")]
        public Color ThumbnailBackground = new Color(0.1f, 0.1f, 0.12f, 1f);

        [Header("Preview Emotes")]
        [Tooltip("Optional EmotePlayer for previewing emotes on the avatar.")]
        public EmotePlayer PreviewEmotePlayer;

        // Internal state
        private Transform _avatarTransform;
        private float _currentRotation;
        private Color _previousBackgroundColor;
        private int _previousCullingMask;
        private bool _isCapturingThumbnail;

        private void Awake()
        {
            ValidateSetup();
        }

        private void Start()
        {
            SetPreviewBackground(DefaultBackground);
        }

        private void Update()
        {
            if (AutoRotate && Avatar != null && !_isCapturingThumbnail)
            {
                RotatePreview(AutoRotateSpeed * Time.deltaTime);
            }
        }

        private void OnDestroy()
        {
            ReleaseRenderTexture();
        }

        // =====================================================================
        // SETUP VALIDATION
        // =====================================================================
        /// <summary>
        /// Validates that all required references are assigned and configures
        /// the preview camera if needed.
        /// </summary>
        private void ValidateSetup()
        {
            if (Avatar != null)
            {
                _avatarTransform = Avatar.transform;
            }
            else
            {
                Debug.LogWarning("[AvatarPreview] No AvatarController assigned. Preview will not function.");
            }

            if (PreviewCamera == null)
            {
                Debug.LogWarning("[AvatarPreview] No PreviewCamera assigned. Attempting to find or create one.");
                PreviewCamera = GetComponentInChildren<Camera>();
            }

            if (PreviewTexture == null && PreviewCamera != null)
            {
                CreatePreviewTexture(512, 512);
            }

            if (PreviewCamera != null && PreviewTexture != null)
            {
                PreviewCamera.targetTexture = PreviewTexture;
            }

            if (PreviewEmotePlayer == null && Avatar != null)
            {
                PreviewEmotePlayer = Avatar.EmotePlayer;
            }
        }

        /// <summary>
        /// Creates a RenderTexture for the preview camera.
        /// </summary>
        /// <param name="width">Texture width in pixels.</param>
        /// <param name="height">Texture height in pixels.</param>
        private void CreatePreviewTexture(int width, int height)
        {
            ReleaseRenderTexture();

            PreviewTexture = new RenderTexture(width, height, 24, RenderTextureFormat.ARGB32)
            {
                antiAliasing = 4,
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp,
                name = $"AvatarPreview_{gameObject.name}"
            };
            PreviewTexture.Create();

            if (PreviewCamera != null)
                PreviewCamera.targetTexture = PreviewTexture;
        }

        /// <summary>
        /// Releases the current RenderTexture to prevent memory leaks.
        /// </summary>
        private void ReleaseRenderTexture()
        {
            if (PreviewTexture != null)
            {
                if (PreviewCamera != null)
                    PreviewCamera.targetTexture = null;

                PreviewTexture.Release();
                Destroy(PreviewTexture);
                PreviewTexture = null;
            }
        }

        // =====================================================================
        // ROTATION
        // =====================================================================
        /// <summary>
        /// Rotates the preview avatar by the specified number of degrees.
        /// Positive values rotate clockwise (around Y axis).
        /// </summary>
        /// <param name="degrees">Rotation delta in degrees.</param>
        public void RotatePreview(float degrees)
        {
            if (_avatarTransform == null)
                return;

            _currentRotation += degrees;
            _avatarTransform.rotation = Quaternion.Euler(0f, _currentRotation, 0f);
        }

        /// <summary>
        /// Sets the preview avatar to a specific rotation angle.
        /// </summary>
        /// <param name="angle">Target Y-rotation in degrees.</param>
        public void SetRotation(float angle)
        {
            if (_avatarTransform == null)
                return;

            _currentRotation = angle;
            _avatarTransform.rotation = Quaternion.Euler(0f, _currentRotation, 0f);
        }

        /// <summary>
        /// Resets the preview rotation to face forward (0 degrees).
        /// </summary>
        public void ResetRotation()
        {
            SetRotation(0f);
        }

        /// <summary>
        /// Enables or disables automatic rotation.
        /// </summary>
        /// <param name="enable">True to enable auto-rotation.</param>
        public void SetAutoRotate(bool enable)
        {
            AutoRotate = enable;
        }

        // =====================================================================
        // EMOTES
        // =====================================================================
        /// <summary>
        /// Plays an emote on the preview avatar by its ID.
        /// </summary>
        /// <param name="emoteId">The emote identifier string.</param>
        public void PlayPreviewEmote(string emoteId)
        {
            if (Avatar == null)
            {
                Debug.LogWarning("[AvatarPreview] Cannot play emote: no avatar assigned.");
                return;
            }

            Avatar.PlayEmote(emoteId);
        }

        /// <summary>
        /// Plays an emote on the preview avatar using EmoteData directly.
        /// </summary>
        /// <param name="emote">The EmoteData to play.</param>
        public void PlayPreviewEmote(EmoteData emote)
        {
            if (PreviewEmotePlayer != null && emote != null)
            {
                PreviewEmotePlayer.PlayEmote(emote);
            }
            else if (Avatar != null && emote != null)
            {
                Avatar.PlayEmote(emote.EmoteId);
            }
        }

        /// <summary>
        /// Stops any currently playing preview emote.
        /// </summary>
        public void StopPreviewEmote()
        {
            if (PreviewEmotePlayer != null)
            {
                PreviewEmotePlayer.StopEmote();
            }
            else if (Avatar != null)
            {
                Avatar.StopEmote();
            }
        }

        // =====================================================================
        // BACKGROUND
        // =====================================================================
        /// <summary>
        /// Sets the preview background color.
        /// </summary>
        /// <param name="color">Target background color.</param>
        public void SetPreviewBackground(Color color)
        {
            if (PreviewCamera != null)
            {
                PreviewCamera.backgroundColor = color;
                PreviewCamera.clearFlags = CameraClearFlags.SolidColor;
            }
        }

        /// <summary>
        /// Sets the preview background to use a skybox instead of a solid color.
        /// </summary>
        /// <param name="skybox">The skybox material to use.</param>
        public void SetPreviewSkybox(Material skybox)
        {
            if (PreviewCamera == null) return;

            if (skybox != null)
            {
                PreviewCamera.clearFlags = CameraClearFlags.Skybox;
            }
            else
            {
                PreviewCamera.clearFlags = CameraClearFlags.SolidColor;
            }
        }

        // =====================================================================
        // THUMBNAIL CAPTURE
        // =====================================================================
        /// <summary>
        /// Captures a thumbnail image of the current avatar preview.
        /// Temporarily changes camera settings for clean capture.
        /// </summary>
        /// <returns>Texture2D containing the thumbnail, or null if capture failed.</returns>
        public Texture2D CaptureThumbnail()
        {
            if (PreviewCamera == null)
            {
                Debug.LogWarning("[AvatarPreview] Cannot capture thumbnail: no preview camera.");
                return null;
            }

            _isCapturingThumbnail = true;

            // Save current state
            _previousBackgroundColor = PreviewCamera.backgroundColor;
            CameraClearFlags previousClearFlags = PreviewCamera.clearFlags;
            RenderTexture previousTarget = PreviewCamera.targetTexture;

            // Create temporary render texture for capture
            RenderTexture tempRT = RenderTexture.GetTemporary(
                ThumbnailResolution, ThumbnailResolution, 24, RenderTextureFormat.ARGB32);

            // Configure camera for capture
            PreviewCamera.targetTexture = tempRT;
            PreviewCamera.backgroundColor = ThumbnailBackground;
            PreviewCamera.clearFlags = CameraClearFlags.SolidColor;
            PreviewCamera.Render();

            // Read pixels
            RenderTexture.active = tempRT;
            Texture2D thumbnail = new Texture2D(
                ThumbnailResolution, ThumbnailResolution, TextureFormat.RGBA32, false)
            {
                name = $"AvatarThumbnail_{Avatar?.gameObject.name ?? "Unknown"}_{System.DateTime.Now:yyyyMMdd_HHmmss}",
                filterMode = FilterMode.Bilinear
            };
            thumbnail.ReadPixels(new Rect(0, 0, ThumbnailResolution, ThumbnailResolution), 0, 0);
            thumbnail.Apply();

            // Restore state
            RenderTexture.active = null;
            PreviewCamera.targetTexture = previousTarget;
            PreviewCamera.backgroundColor = _previousBackgroundColor;
            PreviewCamera.clearFlags = previousClearFlags;
            RenderTexture.ReleaseTemporary(tempRT);

            _isCapturingThumbnail = false;

            Debug.Log($"[AvatarPreview] Captured thumbnail ({ThumbnailResolution}x{ThumbnailResolution}).");
            return thumbnail;
        }

        /// <summary>
        /// Captures a thumbnail asynchronously over multiple frames for higher quality
        /// anti-aliasing (super-sampled). The callback receives the final texture.
        /// </summary>
        /// <param name="callback">Action called with the captured Texture2D.</param>
        /// <param name="supersample">If true, captures at 2x resolution then downscales.</param>
        public void CaptureThumbnailAsync(System.Action<Texture2D> callback, bool supersample = true)
        {
            StartCoroutine(CaptureThumbnailCoroutine(callback, supersample));
        }

        /// <summary>
        /// Coroutine that captures a high-quality super-sampled thumbnail.
        /// </summary>
        private System.Collections.IEnumerator CaptureThumbnailCoroutine(
            System.Action<Texture2D> callback, bool supersample)
        {
            if (PreviewCamera == null)
            {
                callback?.Invoke(null);
                yield break;
            }

            _isCapturingThumbnail = true;

            int captureRes = supersample ? ThumbnailResolution * 2 : ThumbnailResolution;

            // Save state
            _previousBackgroundColor = PreviewCamera.backgroundColor;
            CameraClearFlags previousClearFlags = PreviewCamera.clearFlags;
            RenderTexture previousTarget = PreviewCamera.targetTexture;

            // Create temp render texture
            RenderTexture tempRT = RenderTexture.GetTemporary(
                captureRes, captureRes, 24, RenderTextureFormat.ARGB32);

            // Configure camera
            PreviewCamera.targetTexture = tempRT;
            PreviewCamera.backgroundColor = ThumbnailBackground;
            PreviewCamera.clearFlags = CameraClearFlags.SolidColor;

            // Wait for end of frame for clean render
            yield return new WaitForEndOfFrame();

            PreviewCamera.Render();

            // Read high-res pixels
            RenderTexture.active = tempRT;
            Texture2D highResCapture = new Texture2D(captureRes, captureRes, TextureFormat.RGBA32, false);
            highResCapture.ReadPixels(new Rect(0, 0, captureRes, captureRes), 0, 0);
            highResCapture.Apply();

            // Restore state
            RenderTexture.active = null;
            PreviewCamera.targetTexture = previousTarget;
            PreviewCamera.backgroundColor = _previousBackgroundColor;
            PreviewCamera.clearFlags = previousClearFlags;
            RenderTexture.ReleaseTemporary(tempRT);

            // Downsample if supersampling
            Texture2D finalThumbnail;
            if (supersample && ThumbnailResolution > 0)
            {
                finalThumbnail = DownsampleTexture(highResCapture, ThumbnailResolution, ThumbnailResolution);
                Destroy(highResCapture);
            }
            else
            {
                finalThumbnail = highResCapture;
            }

            finalThumbnail.name = $"AvatarThumbnail_{Avatar?.gameObject.name ?? "Unknown"}_{System.DateTime.Now:yyyyMMdd_HHmmss}";
            finalThumbnail.filterMode = FilterMode.Bilinear;

            _isCapturingThumbnail = false;

            Debug.Log($"[AvatarPreview] Captured HQ thumbnail ({ThumbnailResolution}x{ThumbnailResolution}).");
            callback?.Invoke(finalThumbnail);
        }

        /// <summary>
        /// Downsamples a texture to the target resolution using bilinear filtering.
        /// </summary>
        private Texture2D DownsampleTexture(Texture2D source, int targetWidth, int targetHeight)
        {
            RenderTexture rt = RenderTexture.GetTemporary(targetWidth, targetHeight, 0, RenderTextureFormat.ARGB32);
            rt.filterMode = FilterMode.Bilinear;

            RenderTexture.active = rt;
            Graphics.Blit(source, rt);

            Texture2D result = new Texture2D(targetWidth, targetHeight, TextureFormat.RGBA32, false);
            result.ReadPixels(new Rect(0, 0, targetWidth, targetHeight), 0, 0);
            result.Apply();

            RenderTexture.active = null;
            RenderTexture.ReleaseTemporary(rt);

            return result;
        }

        // =====================================================================
        // OUTFIT APPLICATION
        // =====================================================================
        /// <summary>
        /// Applies an outfit to the preview avatar.
        /// </summary>
        /// <param name="outfit">The outfit to display.</param>
        public void ApplyOutfit(OutfitData outfit)
        {
            if (Avatar == null)
            {
                Debug.LogWarning("[AvatarPreview] Cannot apply outfit: no avatar assigned.");
                return;
            }

            Avatar.ApplyOutfit(outfit);
        }

        /// <summary>
        /// Swaps a single part on the preview avatar.
        /// </summary>
        /// <param name="category">Part category.</param>
        /// <param name="label">Sprite label.</param>
        public void SwapPart(string category, string label)
        {
            if (Avatar == null)
            {
                Debug.LogWarning("[AvatarPreview] Cannot swap part: no avatar assigned.");
                return;
            }

            Avatar.SwapPart(category, label);
        }

        /// <summary>
        /// Resets the preview avatar to default parts.
        /// </summary>
        public void ResetToDefault()
        {
            if (Avatar == null)
                return;

            Avatar.ForceReinitialize();
            ResetRotation();
        }

        // =====================================================================
        // CAMERA CONTROLS
        // =====================================================================
        /// <summary>
        /// Sets the orthographic size of the preview camera (zoom level).
        /// </summary>
        /// <param name="size">Orthographic size. Smaller = more zoomed in.</param>
        public void SetCameraZoom(float size)
        {
            if (PreviewCamera == null) return;

            PreviewCamera.orthographicSize = Mathf.Max(0.1f, size);
        }

        /// <summary>
        /// Sets the preview camera offset from the avatar.
        /// </summary>
        /// <param name="offset">Position offset relative to avatar.</param>
        public void SetCameraOffset(Vector3 offset)
        {
            if (PreviewCamera == null || _avatarTransform == null) return;

            PreviewCamera.transform.position = _avatarTransform.position + offset;
        }

        /// <summary>
        /// Enables or disables the preview camera.
        /// </summary>
        /// <param name="enabled">True to enable the preview camera.</param>
        public void SetPreviewActive(bool enabled)
        {
            if (PreviewCamera != null)
                PreviewCamera.enabled = enabled;
        }
    }
}
