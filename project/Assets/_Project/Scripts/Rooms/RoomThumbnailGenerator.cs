using System;
using System.Collections;
using System.IO;
using UnityEngine;

namespace KawaiiCoolIsland.Rooms
{
    /// <summary>
    /// Auto-generates room thumbnails by capturing a bird's-eye view of the room geometry.
    /// Thumbnails are saved locally and uploaded to the backend for the room browser grid.
    /// </summary>
    public class RoomThumbnailGenerator : MonoBehaviour
    {
        #region Capture

        [Header("Capture")]
        /// <summary>Camera used to render the thumbnail.</summary>
        public Camera ThumbnailCamera;

        /// <summary>Render texture target for thumbnail capture.</summary>
        public RenderTexture ThumbnailRenderTexture;

        /// <summary>Width of the generated thumbnail in pixels.</summary>
        public int ThumbnailWidth = 512;

        /// <summary>Height of the thumbnail in pixels.</summary>
        public int ThumbnailHeight = 384;

        #endregion

        #region Settings

        [Header("Settings")]
        /// <summary>Camera height above room center during capture.</summary>
        public float CameraHeight = 15f;

        /// <summary>Camera tilt angle from horizontal (degrees).</summary>
        public float CameraAngle = 45f;

        /// <summary>Layer mask for room objects to include in the capture.</summary>
        public LayerMask RoomLayer;

        /// <summary>When true, use orthographic projection for isometric-style thumbnails.</summary>
        public bool UseOrthographic = true;

        /// <summary>Orthographic camera size for framing the room.</summary>
        public float OrthographicSize = 10f;

        #endregion

        #region Internal State

        /// <summary>Folder name for local thumbnail storage under Application.persistentDataPath.</summary>
        private const string ThumbnailFolder = "RoomThumbnails";

        /// <summary>Coroutine lock to prevent concurrent captures.</summary>
        private bool _isCapturing;

        /// <summary>Last capture time for cooldown management.</summary>
        private float _lastCaptureTime;

        /// <summary>Minimum seconds between capture requests.</summary>
        private const float CaptureCooldown = 2f;

        #endregion

        #region Events

        /// <summary>Raised when a thumbnail is successfully generated.</summary>
        public event Action<Texture2D, string> OnThumbnailGenerated;

        /// <summary>Raised when thumbnail generation fails.</summary>
        public event Action<string> OnThumbnailFailed;

        /// <summary>Raised during capture progress (0 to 1).</summary>
        public event Action<float> OnCaptureProgress;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            EnsureRenderTexture();
        }

        private void OnEnable()
        {
            EventBus.Subscribe<RoomThumbnailRequestedEvent>(OnThumbnailRequested);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<RoomThumbnailRequestedEvent>(OnThumbnailRequested);
        }

        private void OnDestroy()
        {
            if (ThumbnailRenderTexture != null)
            {
                ThumbnailRenderTexture.Release();
                Destroy(ThumbnailRenderTexture);
            }
        }

        #endregion

        #region Public API

        /// <summary>
        /// Generates a thumbnail for a specific room by finding its scene,
        /// positioning the camera, and capturing a render.
        /// </summary>
        /// <param name="roomId">The target room identifier.</param>
        /// <returns>A <see cref="Texture2D"/> containing the thumbnail, or null on failure.</returns>
        public Texture2D GenerateThumbnail(string roomId)
        {
            if (_isCapturing)
            {
                Debug.LogWarning("[RoomThumbnailGenerator] Capture already in progress.");
                return null;
            }

            if (Time.time - _lastCaptureTime < CaptureCooldown)
            {
                Debug.LogWarning("[RoomThumbnailGenerator] Capture cooldown active.");
                return null;
            }

            if (string.IsNullOrEmpty(roomId))
            {
                Debug.LogWarning("[RoomThumbnailGenerator] Invalid room ID.");
                return null;
            }

            // Check for cached thumbnail first
            string cachedPath = GetThumbnailPath(roomId);
            if (File.Exists(cachedPath))
            {
                byte[] bytes = File.ReadAllBytes(cachedPath);
                Texture2D cached = new(ThumbnailWidth, ThumbnailHeight, TextureFormat.RGB24, false);
                if (cached.LoadImage(bytes))
                {
                    cached.name = $"Thumbnail_{roomId}_Cached";
                    return cached;
                }
            }

            // Synchronous fallback: setup camera and capture one frame
            SetupCameraForRoom(roomId);
            Texture2D result = CaptureFrame();
            if (result != null)
            {
                result.name = $"Thumbnail_{roomId}";
                _lastCaptureTime = Time.time;
                OnThumbnailGenerated?.Invoke(result, roomId);
                return result;
            }

            OnThumbnailFailed?.Invoke(roomId);
            return null;
        }

        /// <summary>
        /// Generates a thumbnail for the currently active room scene.
        /// </summary>
        /// <returns>A <see cref="Texture2D"/> thumbnail, or null on failure.</returns>
        public Texture2D GenerateThumbnailForCurrentRoom()
        {
            RoomInfo current = RoomInstanceManager.Instance?.CurrentRoom;
            if (current == null)
            {
                Debug.LogWarning("[RoomThumbnailGenerator] No current room available.");
                return null;
            }

            return GenerateThumbnail(current.RoomId);
        }

        /// <summary>
        /// Generates a thumbnail asynchronously and saves it to local disk,
        /// then optionally uploads to the backend.
        /// </summary>
        /// <param name="roomId">The room to capture.</param>
        public void GenerateAndSaveThumbnail(string roomId)
        {
            if (_isCapturing)
            {
                Debug.LogWarning("[RoomThumbnailGenerator] Capture already in progress.");
                return;
            }

            StartCoroutine(CaptureCoroutine(roomId));
        }

        /// <summary>
        /// Positions and configures the thumbnail camera for a given room.
        /// </summary>
        /// <param name="roomId">The room to frame.</param>
        public void SetupCameraForRoom(string roomId)
        {
            if (ThumbnailCamera == null)
            {
                Debug.LogError("[RoomThumbnailGenerator] ThumbnailCamera is not assigned.");
                return;
            }

            Vector3 center = CalculateRoomCenter(roomId);
            float zoom = CalculateOptimalZoom(roomId);

            // Position camera above and angled at the room center
            float angleRad = CameraAngle * Mathf.Deg2Rad;
            float horizontalDist = CameraHeight * Mathf.Tan(angleRad);
            Vector3 offset = new Vector3(0f, CameraHeight, -horizontalDist);
            Vector3 camPos = center + offset;

            ThumbnailCamera.transform.position = camPos;
            ThumbnailCamera.transform.LookAt(center);

            if (UseOrthographic)
            {
                ThumbnailCamera.orthographic = true;
                ThumbnailCamera.orthographicSize = Mathf.Max(OrthographicSize, zoom);
            }
            else
            {
                ThumbnailCamera.orthographic = false;
                float distance = Vector3.Distance(camPos, center);
                ThumbnailCamera.fieldOfView = CalculateFOVForDistance(distance, zoom * 2f);
            }

            ThumbnailCamera.cullingMask = RoomLayer;
        }

        #endregion

        #region Capture Pipeline

        /// <summary>
        /// Coroutine that performs a full async capture, save, and optional upload.
        /// </summary>
        private IEnumerator CaptureCoroutine(string roomId)
        {
            _isCapturing = true;
            OnCaptureProgress?.Invoke(0f);

            yield return null;

            SetupCameraForRoom(roomId);
            OnCaptureProgress?.Invoke(0.2f);

            yield return new WaitForEndOfFrame();

            // Ensure render texture is ready
            EnsureRenderTexture();

            RenderTexture prevTarget = ThumbnailCamera.targetTexture;
            ThumbnailCamera.targetTexture = ThumbnailRenderTexture;
            ThumbnailCamera.Render();

            OnCaptureProgress?.Invoke(0.5f);
            yield return new WaitForEndOfFrame();

            // Read pixels from render texture
            RenderTexture.active = ThumbnailRenderTexture;
            Texture2D thumbnail = new(ThumbnailWidth, ThumbnailHeight, TextureFormat.RGB24, false);
            thumbnail.ReadPixels(new Rect(0, 0, ThumbnailWidth, ThumbnailHeight), 0, 0);
            thumbnail.Apply();
            thumbnail.name = $"Thumbnail_{roomId}";

            ThumbnailCamera.targetTexture = prevTarget;
            RenderTexture.active = null;

            OnCaptureProgress?.Invoke(0.7f);
            yield return null;

            // Save to disk
            SaveThumbnailToDisk(thumbnail, roomId);
            OnCaptureProgress?.Invoke(0.9f);

            // Upload to backend
            yield return StartCoroutine(UploadThumbnail(thumbnail, roomId));

            OnCaptureProgress?.Invoke(1f);
            OnThumbnailGenerated?.Invoke(thumbnail, roomId);
            _lastCaptureTime = Time.time;
            _isCapturing = false;
        }

        /// <summary>
        /// Captures a single frame synchronously using the current camera setup.
        /// </summary>
        private Texture2D CaptureFrame()
        {
            if (ThumbnailCamera == null)
                return null;

            EnsureRenderTexture();

            RenderTexture prevTarget = ThumbnailCamera.targetTexture;
            ThumbnailCamera.targetTexture = ThumbnailRenderTexture;
            ThumbnailCamera.Render();

            RenderTexture.active = ThumbnailRenderTexture;
            Texture2D thumbnail = new(ThumbnailWidth, ThumbnailHeight, TextureFormat.RGB24, false);
            thumbnail.ReadPixels(new Rect(0, 0, ThumbnailWidth, ThumbnailHeight), 0, 0);
            thumbnail.Apply();

            ThumbnailCamera.targetTexture = prevTarget;
            RenderTexture.active = null;

            return thumbnail;
        }

        #endregion

        #region Room Geometry Analysis

        /// <summary>
        /// Calculates the world-space center of a room by analyzing its geometry.
        /// </summary>
        /// <param name="roomId">The room identifier.</param>
        /// <returns>World-space center point.</returns>
        private Vector3 CalculateRoomCenter(string roomId)
        {
            // Attempt to find room root by tag or name
            GameObject roomRoot = GameObject.FindWithTag("RoomRoot");
            if (roomRoot == null)
            {
                roomRoot = GameObject.Find($"Room_{roomId}");
            }

            if (roomRoot != null)
            {
                Renderer[] renderers = roomRoot.GetComponentsInChildren<Renderer>();
                if (renderers.Length > 0)
                {
                    Bounds bounds = renderers[0].bounds;
                    for (int i = 1; i < renderers.Length; i++)
                        bounds.Encapsulate(renderers[i].bounds);
                    return bounds.center;
                }
                return roomRoot.transform.position;
            }

            // Fallback: use all objects on RoomLayer
            GameObject[] roomObjects = FindObjectsOfType<GameObject>();
            Bounds fallbackBounds = new(Vector3.zero, Vector3.zero);
            bool hasBounds = false;
            int layer = (int)Mathf.Log(RoomLayer.value, 2);

            foreach (GameObject go in roomObjects)
            {
                if (go.layer == layer)
                {
                    Renderer rend = go.GetComponent<Renderer>();
                    if (rend != null)
                    {
                        if (!hasBounds)
                        {
                            fallbackBounds = rend.bounds;
                            hasBounds = true;
                        }
                        else
                        {
                            fallbackBounds.Encapsulate(rend.bounds);
                        }
                    }
                }
            }

            return hasBounds ? fallbackBounds.center : Vector3.zero;
        }

        /// <summary>
        /// Calculates the optimal orthographic size or camera distance for framing the room.
        /// </summary>
        /// <param name="roomId">The room identifier.</param>
        /// <returns>Optimal zoom value.</returns>
        private float CalculateOptimalZoom(string roomId)
        {
            GameObject roomRoot = GameObject.FindWithTag("RoomRoot") ?? GameObject.Find($"Room_{roomId}");

            if (roomRoot != null)
            {
                Renderer[] renderers = roomRoot.GetComponentsInChildren<Renderer>();
                if (renderers.Length > 0)
                {
                    Bounds bounds = renderers[0].bounds;
                    for (int i = 1; i < renderers.Length; i++)
                        bounds.Encapsulate(renderers[i].bounds);

                    float maxDim = Mathf.Max(bounds.size.x, bounds.size.z);
                    return maxDim * 0.6f;
                }
            }

            return OrthographicSize;
        }

        /// <summary>
        /// Calculates a perspective FOV that frames an object of given size at a given distance.
        /// </summary>
        private float CalculateFOVForDistance(float distance, float targetSize)
        {
            float fovRad = 2f * Mathf.Atan(targetSize / (2f * distance));
            return fovRad * Mathf.Rad2Deg;
        }

        #endregion

        #region Save & Upload

        /// <summary>
        /// Saves the thumbnail as a PNG to local persistent storage.
        /// </summary>
        private void SaveThumbnailToDisk(Texture2D thumbnail, string roomId)
        {
            try
            {
                string folder = Path.Combine(Application.persistentDataPath, ThumbnailFolder);
                if (!Directory.Exists(folder))
                    Directory.CreateDirectory(folder);

                string path = GetThumbnailPath(roomId);
                byte[] pngBytes = thumbnail.EncodeToPNG();
                File.WriteAllBytes(path, pngBytes);

                Debug.Log($"[RoomThumbnailGenerator] Thumbnail saved: {path}");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[RoomThumbnailGenerator] Failed to save thumbnail: {ex.Message}");
            }
        }

        /// <summary>
        /// Returns the local file path for a room's cached thumbnail.
        /// </summary>
        private string GetThumbnailPath(string roomId)
        {
            string folder = Path.Combine(Application.persistentDataPath, ThumbnailFolder);
            return Path.Combine(folder, $"thumb_{roomId}.png");
        }

        /// <summary>
        /// Coroutine that uploads the thumbnail to the PlayFab backend.
        /// </summary>
        private IEnumerator UploadThumbnail(Texture2D thumbnail, string roomId)
        {
            byte[] pngBytes = thumbnail.EncodeToPNG();
            if (pngBytes == null || pngBytes.Length == 0)
            {
                Debug.LogWarning("[RoomThumbnailGenerator] Empty thumbnail bytes. Skipping upload.");
                yield break;
            }

            bool done = false;
            PlayFabManager.Instance?.UploadRoomThumbnail(
                roomId: roomId,
                imageData: pngBytes,
                onSuccess: () =>
                {
                    Debug.Log($"[RoomThumbnailGenerator] Thumbnail uploaded for {roomId}.");
                    done = true;
                },
                onError: (err) =>
                {
                    Debug.LogError($"[RoomThumbnailGenerator] Upload failed: {err}");
                    done = true;
                });

            // Wait for async callback
            float timeout = 10f;
            float elapsed = 0f;
            while (!done && elapsed < timeout)
            {
                elapsed += Time.deltaTime;
                yield return null;
            }
        }

        #endregion

        #region Helpers

        /// <summary>
        /// Ensures the render texture exists with the configured dimensions.
        /// </summary>
        private void EnsureRenderTexture()
        {
            if (ThumbnailRenderTexture != null &&
                ThumbnailRenderTexture.width == ThumbnailWidth &&
                ThumbnailRenderTexture.height == ThumbnailHeight)
                return;

            if (ThumbnailRenderTexture != null)
            {
                ThumbnailRenderTexture.Release();
                Destroy(ThumbnailRenderTexture);
            }

            ThumbnailRenderTexture = new RenderTexture(ThumbnailWidth, ThumbnailHeight, 24);
            ThumbnailRenderTexture.name = "RoomThumbnailRenderTexture";
        }

        #endregion

        #region EventBus Handlers

        private void OnThumbnailRequested(RoomThumbnailRequestedEvent evt)
        {
            GenerateAndSaveThumbnail(evt.RoomId);
        }

        #endregion
    }

    #region EventBus Events

    /// <summary>
    /// Published when a room thumbnail needs to be generated.
    /// </summary>
    public struct RoomThumbnailRequestedEvent
    {
        /// <summary>The room to capture.</summary>
        public string RoomId;
    }

    #endregion
}
