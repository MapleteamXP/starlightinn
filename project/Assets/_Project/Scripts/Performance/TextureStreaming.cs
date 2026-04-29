using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.Networking;

namespace KawaiiCoolIsland.Performance
{
    /// <summary>
    /// On-demand texture streaming system for KawaiiCool Island v3.0.
    /// Loads avatar textures, furniture thumbnails, and room backgrounds asynchronously
    /// while staying within a strict memory budget. Unloads least-recently-used textures
    /// automatically when the budget is exceeded. Integrates with the existing avatar part
    /// system via <see cref="RequestTexture"/> and <see cref="ReleaseTexture"/>.
    /// </summary>
    public class TextureStreaming : MonoBehaviour
    {
        #region Header: Streaming

        [Header("Streaming")]
        [Tooltip("Maximum number of textures kept resident simultaneously.")]
        public int MaxLoadedTextures = 100;

        [Tooltip("Maximum estimated texture memory budget in megabytes.")]
        public int MaxTextureMemoryMB = 128;

        [Tooltip("Distance within which textures are loaded proactively.")]
        public float LoadDistance = 20f;

        [Tooltip("Distance beyond which textures are eligible for unloading.")]
        public float UnloadDistance = 30f;

        [Tooltip("Preload textures for objects within LoadDistance on room entry.")]
        public bool PreloadNearby = true;

        #endregion

        #region Header: Quality

        [Header("Quality")]
        [Tooltip("Store loaded textures in compressed formats to reduce VRAM.")]
        public bool UseCompressedTextures = true;

        [Tooltip("Maximum dimension for full-resolution streamed textures.")]
        public int MaxTextureSize = 1024;

        [Tooltip("Maximum dimension for thumbnail / distant previews.")]
        public int MaxThumbnailSize = 256;

        #endregion

        #region Private State

        private readonly Dictionary<string, Texture2D> _loadedTextures = new();
        private readonly Queue<string> _lruOrder = new();
        private readonly Queue<TextureRequest> _loadQueue = new();
        private readonly List<TextureRequest> _activeRequests = new();
        private readonly Dictionary<string, int> _referenceCounts = new();
        private Camera _mainCamera;
        private bool _isLoading;
        private float _lastUnloadCheck;
        private const float UnloadCheckInterval = 5f;

        #endregion

        #region Events

        /// <summary>Fired when a texture finishes loading successfully.</summary>
        public event Action<string, Texture2D> OnTextureLoaded;

        /// <summary>Fired when a texture fails to load or is released.</summary>
        public event Action<string> OnTextureUnloaded;

        #endregion

        #region Unity Lifecycle

        private void Start()
        {
            _mainCamera = Camera.main;
            EventBus.Subscribe<QualityTierChangedEvent>(OnQualityTierChanged);
        }

        private void OnDestroy()
        {
            EventBus.Unsubscribe<QualityTierChangedEvent>(OnQualityTierChanged);
            UnloadAllTextures();
        }

        private void Update()
        {
            if (_loadQueue.Count > 0 && !_isLoading)
            {
                StartCoroutine(ProcessLoadQueue());
            }

            if (Time.time - _lastUnloadCheck >= UnloadCheckInterval)
            {
                _lastUnloadCheck = Time.time;
                UnloadFarthestTextures();
            }
        }

        #endregion

        #region Public API: Texture Requests

        /// <summary>
        /// Requests a texture to be loaded asynchronously. If already loaded, the callback
        /// fires immediately. Reference counting ensures shared textures survive until all
        /// requesters have called <see cref="ReleaseTexture"/>.
        /// </summary>
        /// <param name="textureId">Unique identifier for this texture (used for caching).</param>
        /// <param name="path">File system or streaming-assets path to the image.</param>
        /// <param name="onLoaded">Callback receiving the loaded <see cref="Texture2D"/>.</param>
        public void RequestTexture(string textureId, string path, Action<Texture2D> onLoaded)
        {
            if (string.IsNullOrEmpty(textureId) || string.IsNullOrEmpty(path))
            {
                onLoaded?.Invoke(null);
                return;
            }

            // Already loaded
            if (_loadedTextures.TryGetValue(textureId, out var existing))
            {
                IncrementRef(textureId);
                TouchLRU(textureId);
                onLoaded?.Invoke(existing);
                return;
            }

            // Already in queue or active
            var pending = _loadQueue.FirstOrDefault(r => r.TextureId == textureId);
            if (pending != null)
            {
                pending.Callback += onLoaded;
                return;
            }

            var active = _activeRequests.FirstOrDefault(r => r.TextureId == textureId);
            if (active != null)
            {
                active.Callback += onLoaded;
                return;
            }

            var request = new TextureRequest
            {
                TextureId = textureId,
                Path = path,
                Callback = onLoaded,
                RequestTime = Time.time,
                IsLoading = false
            };

            _loadQueue.Enqueue(request);
            IncrementRef(textureId);
        }

        /// <summary>
        /// Releases one reference to a texture. When the reference count reaches zero,
        /// the texture becomes eligible for LRU unloading.
        /// </summary>
        /// <param name="textureId">The identifier previously passed to <see cref="RequestTexture"/>.</param>
        public void ReleaseTexture(string textureId)
        {
            if (string.IsNullOrEmpty(textureId)) return;

            if (_referenceCounts.ContainsKey(textureId))
            {
                _referenceCounts[textureId]--;
                if (_referenceCounts[textureId] <= 0)
                {
                    _referenceCounts.Remove(textureId);
                }
            }
        }

        /// <summary>
        /// Retrieves a loaded texture without altering reference counts.
        /// </summary>
        /// <param name="textureId">The texture identifier.</param>
        /// <returns>The <see cref="Texture2D"/> if resident; otherwise null.</returns>
        public Texture2D GetTexture(string textureId)
        {
            if (string.IsNullOrEmpty(textureId)) return null;
            _loadedTextures.TryGetValue(textureId, out var tex);
            return tex;
        }

        /// <summary>
        /// Preloads all textures associated with a specific room. Call during room transition.
        /// </summary>
        /// <param name="roomId">The room identifier used to look up texture manifests.</param>
        public void PreloadTexturesForRoom(string roomId)
        {
            if (string.IsNullOrEmpty(roomId)) return;

            var manifest = RoomTextureManifest.GetTexturesForRoom(roomId);
            if (manifest == null) return;

            foreach (var entry in manifest)
            {
                RequestTexture(entry.TextureId, entry.Path, null);
            }

            Debug.Log($"[TextureStreaming] Preloaded {manifest.Count} textures for room '{roomId}'.");
        }

        /// <summary>
        /// Unloads all resident textures and clears the load queue. Use on scene change.
        /// </summary>
        public void UnloadAllTextures()
        {
            foreach (var kvp in _loadedTextures)
            {
                if (kvp.Value != null)
                    Destroy(kvp.Value);
            }
            _loadedTextures.Clear();
            _lruOrder.Clear();
            _referenceCounts.Clear();
            _loadQueue.Clear();
            _activeRequests.Clear();
            _isLoading = false;
            Debug.Log("[TextureStreaming] All textures unloaded.");
        }

        /// <summary>
        /// Dynamically adjusts the maximum texture dimension for future loads.
        /// </summary>
        /// <param name="size">Desired max dimension (power-of-two recommended).</param>
        public void SetMaxTextureSize(int size)
        {
            MaxTextureSize = Mathf.Clamp(size, 64, 4096);
        }

        #endregion

        #region Async Loading

        private IEnumerator ProcessLoadQueue()
        {
            _isLoading = true;

            while (_loadQueue.Count > 0)
            {
                // Memory guard: pause loading if over budget
                if (GetTextureMemoryUsage() > MaxTextureMemoryMB || _loadedTextures.Count >= MaxLoadedTextures)
                {
                    UnloadFarthestTextures();
                    if (GetTextureMemoryUsage() > MaxTextureMemoryMB)
                    {
                        yield return new WaitForSeconds(0.1f);
                        continue;
                    }
                }

                TextureRequest request = _loadQueue.Dequeue();
                if (string.IsNullOrEmpty(request?.TextureId))
                    continue;

                _activeRequests.Add(request);
                yield return StartCoroutine(LoadTextureAsync(request));
            }

            _isLoading = false;
        }

        private IEnumerator LoadTextureAsync(TextureRequest request)
        {
            string path = request.Path;
            bool isWeb = path.StartsWith("http://") || path.StartsWith("https://");
            bool isStreamingAsset = path.StartsWith("StreamingAssets/") || !Path.IsPathRooted(path);

            string fullPath = isStreamingAsset ? Path.Combine(Application.streamingAssetsPath, path) : path;

            using UnityWebRequest uwr = UnityWebRequestTexture.GetTexture(fullPath);
            yield return uwr.SendWebRequest();

            if (uwr.result != UnityWebRequest.Result.Success)
            {
                Debug.LogWarning($"[TextureStreaming] Failed to load '{request.TextureId}': {uwr.error}");
                _activeRequests.Remove(request);
                yield break;
            }

            Texture2D tex = DownloadHandlerTexture.GetContent(uwr);
            if (tex == null)
            {
                Debug.LogWarning($"[TextureStreaming] Downloaded null texture for '{request.TextureId}'.");
                _activeRequests.Remove(request);
                yield break;
            }

            // Resize if exceeds MaxTextureSize
            if (tex.width > MaxTextureSize || tex.height > MaxTextureSize)
            {
                int newW = MaxTextureSize;
                int newH = Mathf.RoundToInt(tex.height * (MaxTextureSize / (float)tex.width));
                if (newH > MaxTextureSize)
                {
                    newH = MaxTextureSize;
                    newW = Mathf.RoundToInt(tex.width * (MaxTextureSize / (float)tex.height));
                }
                Texture2D resized = new Texture2D(newW, newH, tex.format, false);
                resized.SetPixels32(tex.GetPixels32().Select(c => c).ToArray());
                // Actually we need proper resize, so use GPU fallback via RenderTexture for quality
                RenderTexture rt = RenderTexture.GetTemporary(newW, newH);
                Graphics.Blit(tex, rt);
                RenderTexture.active = rt;
                resized.ReadPixels(new Rect(0, 0, newW, newH), 0, 0);
                resized.Apply();
                RenderTexture.ReleaseTemporary(rt);
                Destroy(tex);
                tex = resized;
            }

            if (UseCompressedTextures)
            {
                // Compress on GPU if uncompressed
                if (tex.format == TextureFormat.RGBA32 || tex.format == TextureFormat.RGB24)
                {
                    tex.Compress(true);
                }
            }

            tex.wrapMode = TextureWrapMode.Clamp;
            tex.filterMode = FilterMode.Bilinear;
            tex.name = request.TextureId;

            _loadedTextures[request.TextureId] = tex;
            _lruOrder.Enqueue(request.TextureId);

            _activeRequests.Remove(request);

            try
            {
                request.Callback?.Invoke(tex);
                OnTextureLoaded?.Invoke(request.TextureId, tex);
            }
            catch (Exception ex)
            {
                Debug.LogException(ex);
            }
        }

        #endregion

        #region Memory Management

        private void UnloadFarthestTextures()
        {
            if (_loadedTextures.Count == 0) return;

            float memUsage = GetTextureMemoryUsage();
            if (memUsage <= MaxTextureMemoryMB && _loadedTextures.Count <= MaxLoadedTextures)
                return;

            // Build distance-sorted list of zero-ref textures
            var candidates = new List<(string id, float distance)>();
            foreach (var kvp in _loadedTextures)
            {
                if (_referenceCounts.TryGetValue(kvp.Key, out int refs) && refs > 0)
                    continue;

                float dist = float.MaxValue;
                if (_mainCamera != null && kvp.Value != null)
                {
                    // Textures aren't world-positioned; we approximate by LRU age as proxy
                    dist = EstimateTextureDistance(kvp.Key);
                }
                candidates.Add((kvp.Key, dist));
            }

            candidates.Sort((a, b) => b.distance.CompareTo(a.distance));

            int unloadTarget = Mathf.Max(1, (_loadedTextures.Count - MaxLoadedTextures) + Mathf.CeilToInt((memUsage - MaxTextureMemoryMB) / 4f));
            for (int i = 0; i < Mathf.Min(unloadTarget, candidates.Count); i++)
            {
                string id = candidates[i].id;
                if (_loadedTextures.TryGetValue(id, out var tex))
                {
                    Destroy(tex);
                    _loadedTextures.Remove(id);
                    OnTextureUnloaded?.Invoke(id);
                }
                // Remove from LRU
                var newLru = new Queue<string>();
                foreach (var qid in _lruOrder)
                {
                    if (qid != id) newLru.Enqueue(qid);
                }
                _lruOrder.Clear();
                foreach (var qid in newLru) _lruOrder.Enqueue(qid);
            }
        }

        private float GetTextureMemoryUsage()
        {
            float totalMB = 0f;
            foreach (var kvp in _loadedTextures)
            {
                Texture2D tex = kvp.Value;
                if (tex == null) continue;
                int bpp = GetBitsPerPixel(tex.format);
                totalMB += (tex.width * tex.height * bpp) / (8f * 1024f * 1024f);
            }
            return totalMB;
        }

        private static int GetBitsPerPixel(TextureFormat format)
        {
            return format switch
            {
                TextureFormat.RGBA32 => 32,
                TextureFormat.RGB24 => 24,
                TextureFormat.RGBA4444 => 16,
                TextureFormat.RGB565 => 16,
                TextureFormat.DXT1 => 4,
                TextureFormat.DXT5 => 8,
                TextureFormat.PVRTC_RGB2 => 2,
                TextureFormat.PVRTC_RGBA2 => 2,
                TextureFormat.PVRTC_RGB4 => 4,
                TextureFormat.PVRTC_RGBA4 => 4,
                TextureFormat.ETC_RGB4 => 4,
                TextureFormat.ETC2_RGB => 4,
                TextureFormat.ETC2_RGBA1 => 5,
                TextureFormat.ETC2_RGBA8 => 8,
                TextureFormat.ASTC_4x4 => 8,
                _ => 32
            };
        }

        private void TouchLRU(string textureId)
        {
            var newQueue = new Queue<string>();
            foreach (var id in _lruOrder)
            {
                if (id != textureId)
                    newQueue.Enqueue(id);
            }
            newQueue.Enqueue(textureId);
            _lruOrder.Clear();
            foreach (var id in newQueue) _lruOrder.Enqueue(id);
        }

        private void IncrementRef(string textureId)
        {
            if (!_referenceCounts.ContainsKey(textureId))
                _referenceCounts[textureId] = 0;
            _referenceCounts[textureId]++;
        }

        private float EstimateTextureDistance(string textureId)
        {
            // LRU index as proxy: older textures are "further" away
            int index = 0;
            foreach (var id in _lruOrder)
            {
                if (id == textureId) break;
                index++;
            }
            return index;
        }

        #endregion

        #region Quality Tier Reaction

        private void OnQualityTierChanged(QualityTierChangedEvent evt)
        {
            switch (evt.NewTier)
            {
                case QualityTier.Ultra:
                    MaxTextureSize = 2048;
                    MaxLoadedTextures = 150;
                    MaxTextureMemoryMB = 256;
                    break;
                case QualityTier.High:
                    MaxTextureSize = 1024;
                    MaxLoadedTextures = 120;
                    MaxTextureMemoryMB = 192;
                    break;
                case QualityTier.Medium:
                    MaxTextureSize = 1024;
                    MaxLoadedTextures = 100;
                    MaxTextureMemoryMB = 128;
                    break;
                case QualityTier.Low:
                    MaxTextureSize = 512;
                    MaxLoadedTextures = 60;
                    MaxTextureMemoryMB = 64;
                    break;
                case QualityTier.Minimal:
                    MaxTextureSize = 256;
                    MaxLoadedTextures = 30;
                    MaxTextureMemoryMB = 32;
                    break;
            }
        }

        #endregion
    }

    #region Data Classes

    /// <summary>Pending or in-flight texture load operation.</summary>
    [System.Serializable]
    public class TextureRequest
    {
        public string TextureId;
        public string Path;
        public Action<Texture2D> Callback;
        public float RequestTime;
        public bool IsLoading;
    }

    /// <summary>Placeholder for room-to-texture mapping used by <see cref="PreloadTexturesForRoom"/>.</summary>
    public static class RoomTextureManifest
    {
        private static readonly Dictionary<string, List<ManifestEntry>> _manifests = new();

        public static List<ManifestEntry> GetTexturesForRoom(string roomId)
        {
            _manifests.TryGetValue(roomId, out var list);
            return list ?? new List<ManifestEntry>();
        }

        public static void RegisterRoomTextures(string roomId, List<ManifestEntry> entries)
        {
            _manifests[roomId] = entries ?? new List<ManifestEntry>();
        }
    }

    /// <summary>Single entry in a room texture manifest.</summary>
    [System.Serializable]
    public class ManifestEntry
    {
        public string TextureId;
        public string Path;
        public Vector3 WorldPosition;
    }

    #endregion
}
