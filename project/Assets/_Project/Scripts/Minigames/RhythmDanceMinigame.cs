using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using TMPro;

// ---------------------------------------------------------------------------
// KawaiiCool Island - Rhythm Dance Minigame
// ---------------------------------------------------------------------------
// A 4-lane rhythm game where notes scroll toward a hit line. Players press
// the corresponding lane key when the note reaches the hit zone. Supports
// Normal, Hold, Slide, and Fever note types with combo multipliers,
// fever mode activation, and full scoring.
// ---------------------------------------------------------------------------

namespace KawaiiCool.Minigames
{
    /// <summary>
    /// Type of rhythm note that can spawn in a lane.
    /// </summary>
    public enum NoteType
    {
        /// <summary>Standard note — press when it reaches the hit line.</summary>
        Normal,

        /// <summary>Hold note — press and hold for the duration.</summary>
        Hold,

        /// <summary>Slide note — press then swipe in the indicated direction.</summary>
        Slide,

        /// <summary>Fever note — hitting this contributes to fever meter.</summary>
        Fever
    }

    /// <summary>
    /// Result of a note hit attempt.
    /// </summary>
    public enum HitResult
    {
        /// <summary>Hit within the perfect timing window (highest score).</summary>
        Perfect,

        /// <summary>Hit within the great timing window.</summary>
        Great,

        /// <summary>Hit within the good timing window.</summary>
        Good,

        /// <summary>Note missed entirely or hit outside all windows.</summary>
        Miss
    }

    /// <summary>
    /// Input keys mapped to each of the 4 rhythm lanes.
    /// </summary>
    public enum RhythmLaneInput
    {
        /// <summary>First lane (default: D or Left Arrow).</summary>
        Key1,

        /// <summary>Second lane (default: F or Down Arrow).</summary>
        Key2,

        /// <summary>Third lane (default: J or Up Arrow).</summary>
        Key3,

        /// <summary>Fourth lane (default: K or Right Arrow).</summary>
        Key4
    }

    /// <summary>
    /// Represents a single note in the rhythm minigame. Handles its own
    /// position update as it scrolls from spawn to hit point.
    /// </summary>
    public class RhythmNote : MonoBehaviour
    {
        /// <summary>Which lane (0-3) this note belongs to.</summary>
        public int Lane { get; set; }

        /// <summary>Type of note (affects scoring and behavior).</summary>
        public NoteType Type { get; set; }

        /// <summary>Song position (in seconds) when this note was spawned.</summary>
        public float SpawnTime { get; set; }

        /// <summary>Song position (in seconds) when this note should be hit.</summary>
        public float HitTime { get; set; }

        /// <summary>True if the note has been successfully hit.</summary>
        public bool IsHit { get; set; }

        /// <summary>True if the note passed the hit line without being hit.</summary>
        public bool IsMissed { get; set; }

        /// <summary>Duration of hold (for Hold notes).</summary>
        public float HoldDuration { get; set; }

        /// <summary>Sprite renderer for visual feedback.</summary>
        private SpriteRenderer _spriteRenderer;

        /// <summary>Cached transform for performance.</summary>
        private Transform _transform;

        /// <summary>
        /// Initializes the note with its lane, type, and target hit time.
        /// </summary>
        /// <param name="lane">Lane index (0-3).</param>
        /// <param name="type">Note type.</param>
        /// <param name="hitTime">Target song position for hitting.</param>
        public void Initialize(int lane, NoteType type, float hitTime)
        {
            Lane = lane;
            Type = type;
            HitTime = hitTime;
            SpawnTime = Time.time;
            IsHit = false;
            IsMissed = false;
            HoldDuration = type == NoteType.Hold ? 0.5f : 0f;

            _transform = transform;
            _spriteRenderer = GetComponent<SpriteRenderer>();

            // Set visual color based on note type
            if (_spriteRenderer != null)
            {
                _spriteRenderer.color = GetNoteColor(type);
            }
        }

        /// <summary>
        /// Updates the note's position based on current song position and note speed.
        /// </summary>
        /// <param name="currentSongPosition">Current position in the song (seconds).</param>
        /// <param name="noteSpeed">Speed multiplier for note movement.</param>
        public void UpdatePosition(float currentSongPosition, float noteSpeed)
        {
            if (_transform == null) return;

            // Calculate progress: 0 = at spawn, 1 = at hit point, >1 = past hit
            float timeUntilHit = HitTime - currentSongPosition;
            float totalTravelTime = (HitTime - SpawnTime);

            if (totalTravelTime <= 0f) return;

            float progress = 1f - (timeUntilHit / totalTravelTime);

            // Move along Z axis from spawn to hit
            Vector3 pos = _transform.localPosition;
            pos.z = progress * noteSpeed * 10f;
            _transform.localPosition = pos;
        }

        /// <summary>
        /// Returns the color associated with each note type for visual feedback.
        /// </summary>
        private Color GetNoteColor(NoteType type)
        {
            return type switch
            {
                NoteType.Normal => Color.cyan,
                NoteType.Hold => Color.yellow,
                NoteType.Slide => Color.magenta,
                NoteType.Fever => new Color(1f, 0.5f, 0f), // Orange
                _ => Color.white
            };
        }
    }

    /// <summary>
    /// Represents a single lane in the rhythm game, handling input and
    /// lane-specific visual feedback.
    /// </summary>
    [Serializable]
    public class RhythmLane
    {
        /// <summary>Lane index (0-3).</summary>
        public int LaneIndex;

        /// <summary>Transform position of this lane.</summary>
        public Transform LaneTransform;

        /// <summary>Visual indicator for when the lane is pressed.</summary>
        public GameObject PressEffect;

        /// <summary>Visual indicator for a successful hit.</summary>
        public GameObject HitEffect;

        /// <summary>Visual indicator for a miss.</summary>
        public GameObject MissEffect;

        /// <summary>Key codes that trigger this lane.</summary>
        public KeyCode[] InputKeys;

        /// <summary>Whether this lane is currently being held (for hold notes).</summary>
        public bool IsHeld;

        /// <summary>
        /// Checks if any of this lane's input keys are pressed this frame.
        /// </summary>
        public bool GetInputDown()
        {
            if (InputKeys == null) return false;
            foreach (var key in InputKeys)
            {
                if (Input.GetKeyDown(key)) return true;
            }
            return false;
        }

        /// <summary>
        /// Checks if any of this lane's input keys are currently held.
        /// </summary>
        public bool GetInputHeld()
        {
            if (InputKeys == null) return false;
            foreach (var key in InputKeys)
            {
                if (Input.GetKey(key)) return true;
            }
            return false;
        }

        /// <summary>
        /// Checks if any of this lane's input keys were released this frame.
        /// </summary>
        public bool GetInputUp()
        {
            if (InputKeys == null) return false;
            foreach (var key in InputKeys)
            {
                if (Input.GetKeyUp(key)) return true;
            }
            return false;
        }
    }

    /// <summary>
    /// Defines a rhythm pattern as a sequence of note spawn events.
    /// </summary>
    [Serializable]
    public class RhythmPattern
    {
        /// <summary>Display name of this pattern.</summary>
        public string PatternName;

        /// <summary>BPM for this pattern.</summary>
        public float BPM = 120f;

        /// <summary>List of note spawn events in chronological order.</summary>
        public List<NoteSpawnEvent> Notes = new();
    }

    /// <summary>
    /// A single note spawn event within a rhythm pattern.
    /// </summary>
    [Serializable]
    public class NoteSpawnEvent
    {
        /// <summary>Beat number (0-based) when this note should spawn.</summary>
        public float Beat;

        /// <summary>Target lane (0-3).</summary>
        public int Lane;

        /// <summary>Type of note to spawn.</summary>
        public NoteType Type;
    }

    /// <summary>
    /// Rhythm Dance minigame controller. A 4-lane rhythm game where notes
    /// scroll toward a hit line. Features combo system, fever mode, multiple
    /// note types, and difficulty-based scoring.
    /// </summary>
    public class RhythmDanceMinigame : MinigameController
    {
        #region Inspector Settings

        [Header("Rhythm Settings")]
        [Tooltip("Beats per minute for the song.")]
        public float BPM = 120f;

        [Tooltip("How fast notes move toward the hit line.")]
        public float NoteSpeed = 5f;

        [Tooltip("Timing window for a Perfect hit (seconds).")]
        public float PerfectWindow = 0.05f; // 50ms

        [Tooltip("Timing window for a Great hit (seconds).")]
        public float GreatWindow = 0.1f;   // 100ms

        [Tooltip("Timing window for a Good hit (seconds).")]
        public float GoodWindow = 0.15f;   // 150ms

        [Tooltip("Number of lanes (typically 4).")]
        public int Lanes = 4;

        [Tooltip("Horizontal spacing between lane centers.")]
        public float LaneSpacing = 1.5f;

        [Header("Spawning")]
        [Tooltip("Transform where notes spawn (far from player).")]
        public Transform SpawnPoint;

        [Tooltip("Transform where notes should be hit (near player).")]
        public Transform HitPoint;

        [Tooltip("Transform where notes are considered missed (past player).")]
        public Transform MissPoint;

        [Tooltip("Prefab for rhythm notes.")]
        public GameObject NotePrefab;

        [Tooltip("Prefab for lane visual indicators.")]
        public GameObject LanePrefab;

        [Header("Scoring")]
        [Tooltip("Points awarded for a Perfect hit.")]
        public int PerfectScore = 100;

        [Tooltip("Points awarded for a Great hit.")]
        public int GreatScore = 70;

        [Tooltip("Points awarded for a Good hit.")]
        public int GoodScore = 40;

        [Tooltip("Points (or penalty) for a Miss.")]
        public int MissScore = 0;

        [Tooltip("Score multiplier per combo level (+10% per combo).")]
        public float ComboMultiplier = 0.1f;

        [Tooltip("Combo thresholds that activate fever mode levels.")]
        public int[] FeverThresholds = { 10, 25, 50 };

        [Header("Visual")]
        [Tooltip("Text displaying the current combo count.")]
        public TMP_Text ComboText;

        [Tooltip("Text displaying the last hit result.")]
        public TMP_Text HitResultText;

        [Tooltip("Animator for fever mode visual effects.")]
        public Animator FeverAnimator;

        [Tooltip("Particle system for perfect hit feedback.")]
        public ParticleSystem PerfectEffect;

        [Tooltip("Particle system for fever activation.")]
        public ParticleSystem FeverEffect;

        [Header("Input")]
        [Tooltip("Key codes for Lane 1 (leftmost).")]
        public KeyCode[] Lane1Keys = { KeyCode.D, KeyCode.LeftArrow };

        [Tooltip("Key codes for Lane 2.")]
        public KeyCode[] Lane2Keys = { KeyCode.F, KeyCode.DownArrow };

        [Tooltip("Key codes for Lane 3.")]
        public KeyCode[] Lane3Keys = { KeyCode.J, KeyCode.UpArrow };

        [Tooltip("Key codes for Lane 4 (rightmost).")]
        public KeyCode[] Lane4Keys = { KeyCode.K, KeyCode.RightArrow };

        #endregion

        #region Runtime State

        /// <summary>All currently active (spawned but not hit/missed) notes.</summary>
        private List<RhythmNote> _activeNotes = new();

        /// <summary>Lane configurations for input handling.</summary>
        private List<RhythmLane> _rhythmLanes = new();

        /// <summary>Current rhythm pattern being played.</summary>
        private RhythmPattern _currentPattern;

        /// <summary>Duration of a single beat in seconds (60/BPM).</summary>
        private float _beatInterval;

        /// <summary>Song position at the last processed beat.</summary>
        private float _lastBeatTime;

        /// <summary>Current consecutive hit streak.</summary>
        private int _currentCombo;

        /// <summary>Maximum combo achieved this session.</summary>
        private int _maxCombo;

        /// <summary>Total Perfect hits.</summary>
        private int _perfectCount;

        /// <summary>Total Great hits.</summary>
        private int _greatCount;

        /// <summary>Total Good hits.</summary>
        private int _goodCount;

        /// <summary>Total Misses.</summary>
        private int _missCount;

        /// <summary>Current fever level (0 = none, 1+ = active).</summary>
        private int _feverLevel;

        /// <summary>Whether fever mode is currently active.</summary>
        private bool _isFeverMode;

        /// <summary>Current position in the song (seconds since start).</summary>
        private float _songPosition;

        /// <summary>Index of the next note to spawn from the pattern.</summary>
        private int _nextNoteIndex;

        /// <summary>Time since gameplay started.</summary>
        private float _gameplayStartTime;

        /// <summary>Score multiplier from fever mode.</summary>
        private float _feverScoreMultiplier = 1f;

        #endregion

        #region Events

        /// <summary>Invoked when a note is hit. Argument is the hit quality.</summary>
        public event Action<HitResult> OnNoteHit;

        /// <summary>Invoked when the combo count changes. Argument is new combo.</summary>
        public event Action<int> OnComboChanged;

        /// <summary>Invoked when fever level changes. Argument is new level (0 = off).</summary>
        public event Action<int> OnFeverLevelChanged;

        #endregion

        #region Initialization

        /// <summary>
        /// Called once after initialization. Sets up lanes, loads the
        /// rhythm pattern, and configures timing.
        /// </summary>
        protected override void OnInitialized()
        {
            base.OnInitialized();

            _beatInterval = 60f / BPM;
            _currentCombo = 0;
            _maxCombo = 0;
            _perfectCount = 0;
            _greatCount = 0;
            _goodCount = 0;
            _missCount = 0;
            _feverLevel = 0;
            _isFeverMode = false;
            _songPosition = 0f;
            _nextNoteIndex = 0;
            _feverScoreMultiplier = 1f;

            SpawnLanes();
            LoadPattern();

            Debug.Log($"[RhythmDance] Initialized with BPM={BPM}, BeatInterval={_beatInterval:F3}s");
        }

        #endregion

        #region Lane Setup

        /// <summary>
        /// Creates and configures the 4 rhythm lanes with their transforms,
        /// input keys, and visual effects.
        /// </summary>
        private void SpawnLanes()
        {
            _rhythmLanes.Clear();

            for (int i = 0; i < Lanes; i++)
            {
                RhythmLane lane = new RhythmLane
                {
                    LaneIndex = i,
                    InputKeys = i switch
                    {
                        0 => Lane1Keys,
                        1 => Lane2Keys,
                        2 => Lane3Keys,
                        3 => Lane4Keys,
                        _ => new KeyCode[] { KeyCode.None }
                    }
                };

                // Create lane visual if prefab is assigned
                if (LanePrefab != null && HitPoint != null)
                {
                    Vector3 lanePos = HitPoint.position;
                    lanePos.x += (i - (Lanes - 1) / 2f) * LaneSpacing;
                    GameObject laneObj = Instantiate(LanePrefab, lanePos, Quaternion.identity, transform);
                    lane.LaneTransform = laneObj.transform;
                }

                _rhythmLanes.Add(lane);
            }

            Debug.Log($"[RhythmDance] Spawned {Lanes} lanes.");
        }

        #endregion

        #region Pattern Loading

        /// <summary>
        /// Loads or generates the rhythm pattern for this session.
        /// In a full implementation, this would load from ScriptableObject or JSON.
        /// </summary>
        private void LoadPattern()
        {
            // Create a procedural pattern for demo purposes
            _currentPattern = new RhythmPattern
            {
                PatternName = "Kawaii Dance Standard",
                BPM = this.BPM,
                Notes = new List<NoteSpawnEvent>()
            };

            // Generate a simple 4-beat repeating pattern for 60 seconds
            float totalBeats = (GameDuration / 60f) * BPM;
            for (int beat = 0; beat < totalBeats; beat++)
            {
                // Quarter note on every beat
                int lane = beat % Lanes;
                NoteType type = NoteType.Normal;

                // Every 8th beat, add a fever note
                if (beat % 8 == 7)
                    type = NoteType.Fever;

                // Every 16th beat, add a hold note
                if (beat % 16 == 15)
                    type = NoteType.Hold;

                _currentPattern.Notes.Add(new NoteSpawnEvent
                {
                    Beat = beat,
                    Lane = lane,
                    Type = type
                });

                // Add off-beat notes for higher difficulty sections
                if (beat > 32 && beat % 2 == 0)
                {
                    int offLane = (lane + 2) % Lanes;
                    _currentPattern.Notes.Add(new NoteSpawnEvent
                    {
                        Beat = beat + 0.5f,
                        Lane = offLane,
                        Type = NoteType.Normal
                    });
                }
            }

            Debug.Log($"[RhythmDance] Loaded pattern '{_currentPattern.PatternName}' with {_currentPattern.Notes.Count} notes.");
        }

        #endregion

        #region Playing State

        /// <summary>
        /// Called when entering the Playing state. Resets runtime state and
        /// starts song position tracking.
        /// </summary>
        protected override void OnEnterPlaying()
        {
            base.OnEnterPlaying();

            _songPosition = 0f;
            _gameplayStartTime = Time.time;
            _nextNoteIndex = 0;
            _activeNotes.Clear();

            if (ComboText != null) ComboText.text = "Combo: 0";
            if (HitResultText != null) HitResultText.text = "";

            Debug.Log("[RhythmDance] Gameplay started!");
        }

        /// <summary>
        /// Called every frame during gameplay. Handles note spawning from the
        /// pattern, note position updates, input detection, and auto-miss detection.
        /// </summary>
        protected override void OnUpdatePlaying()
        {
            base.OnUpdatePlaying();

            // Update song position
            _songPosition = Time.time - _gameplayStartTime;

            // Spawn notes from pattern
            SpawnNotesFromPattern();

            // Check lane inputs
            CheckLaneInputs();

            // Update note positions
            UpdateNotes();

            // Check for missed notes
            CheckMissedNotes();

            // Update fever state visuals
            UpdateFeverVisuals();
        }

        #endregion

        #region Note Spawning

        /// <summary>
        /// Checks the pattern for notes that should be spawned at the current
        /// song position and spawns them.
        /// </summary>
        private void SpawnNotesFromPattern()
        {
            if (_currentPattern == null || _currentPattern.Notes == null) return;

            float spawnWindow = 2f; // Spawn notes 2 seconds before they need to be hit

            while (_nextNoteIndex < _currentPattern.Notes.Count)
            {
                NoteSpawnEvent noteEvent = _currentPattern.Notes[_nextNoteIndex];
                float noteTime = noteEvent.Beat * _beatInterval;

                // If this note's time is within the spawn window
                if (noteTime <= _songPosition + spawnWindow)
                {
                    SpawnNote(noteEvent.Lane, noteEvent.Type, noteTime);
                    _nextNoteIndex++;
                }
                else
                {
                    break;
                }
            }
        }

        /// <summary>
        /// Spawns a single note in the specified lane with the given type and hit time.
        /// </summary>
        /// <param name="lane">Target lane (0-3).</param>
        /// <param name="type">Note type.</param>
        /// <param name="hitTime">Target song position for the hit.</param>
        private void SpawnNote(int lane, NoteType type, float hitTime)
        {
            if (NotePrefab == null || SpawnPoint == null) return;
            if (lane < 0 || lane >= Lanes) return;

            Vector3 spawnPos = SpawnPoint.position;
            spawnPos.x += (lane - (Lanes - 1) / 2f) * LaneSpacing;

            GameObject noteObj = Instantiate(NotePrefab, spawnPos, Quaternion.identity, transform);
            RhythmNote note = noteObj.GetComponent<RhythmNote>();

            if (note == null)
            {
                Debug.LogWarning("[RhythmDance] Note prefab is missing RhythmNote component!");
                return;
            }

            note.Initialize(lane, type, hitTime);
            _activeNotes.Add(note);
        }

        #endregion

        #region Input Handling

        /// <summary>
        /// Checks all lanes for input presses and processes hits.
        /// </summary>
        private void CheckLaneInputs()
        {
            for (int i = 0; i < _rhythmLanes.Count; i++)
            {
                RhythmLane lane = _rhythmLanes[i];

                if (lane.GetInputDown())
                {
                    CheckInput(i);
                    ShowLanePressEffect(i);
                }

                lane.IsHeld = lane.GetInputHeld();
            }
        }

        /// <summary>
        /// Processes input for a specific lane, finding the closest note and
        /// evaluating the hit timing.
        /// </summary>
        /// <param name="lane">Lane index (0-3) that received input.</param>
        private void CheckInput(int lane)
        {
            // Find the closest unhit note in this lane
            RhythmNote closestNote = null;
            float closestTimeDiff = float.MaxValue;

            foreach (var note in _activeNotes)
            {
                if (note.Lane != lane) continue;
                if (note.IsHit || note.IsMissed) continue;

                float timeDiff = Mathf.Abs(note.HitTime - _songPosition);
                if (timeDiff < closestTimeDiff)
                {
                    closestTimeDiff = timeDiff;
                    closestNote = note;
                }
            }

            if (closestNote == null) return;

            // Check hit timing
            HitResult result = CheckHit(closestNote);
            ProcessHit(result);

            if (result != HitResult.Miss)
            {
                closestNote.IsHit = true;
                Destroy(closestNote.gameObject, 0.1f);
                _activeNotes.Remove(closestNote);

                ShowHitEffect(lane, result);
            }
        }

        /// <summary>
        /// Evaluates the timing quality of a hit on a specific note.
        /// </summary>
        /// <param name="note">The note to check timing against.</param>
        /// <returns>The HitResult quality level.</returns>
        private HitResult CheckHit(RhythmNote note)
        {
            float timeDiff = Mathf.Abs(note.HitTime - _songPosition);

            if (timeDiff <= PerfectWindow)
                return HitResult.Perfect;
            if (timeDiff <= GreatWindow)
                return HitResult.Great;
            if (timeDiff <= GoodWindow)
                return HitResult.Good;

            return HitResult.Miss;
        }

        #endregion

        #region Hit Processing

        /// <summary>
        /// Processes a hit result, updating score, combo, and fever state.
        /// </summary>
        /// <param name="result">The quality of the hit.</param>
        private void ProcessHit(HitResult result)
        {
            int points = result switch
            {
                HitResult.Perfect => PerfectScore,
                HitResult.Great => GreatScore,
                HitResult.Good => GoodScore,
                HitResult.Miss => MissScore,
                _ => 0
            };

            // Track hit counts
            switch (result)
            {
                case HitResult.Perfect: _perfectCount++; break;
                case HitResult.Great: _greatCount++; break;
                case HitResult.Good: _goodCount++; break;
                case HitResult.Miss: _missCount++; break;
            }

            // Apply combo multiplier (only on successful hits)
            if (result != HitResult.Miss)
            {
                float comboBonus = 1f + (_currentCombo * ComboMultiplier);
                float feverBonus = _isFeverMode ? _feverScoreMultiplier : 1f;
                points = Mathf.RoundToInt(points * comboBonus * feverBonus);
            }

            // Update combo
            UpdateCombo(result);

            // Add score to first participating player (local player in singleplayer)
            if (ParticipatingPlayers.Count > 0)
            {
                string localPlayerId = ParticipatingPlayers[0];
                AddScore(localPlayerId, points);

                // Update stats
                if (PlayerScores.TryGetValue(localPlayerId, out PlayerScore ps))
                {
                    string statKey = result.ToString().ToLower();
                    if (!ps.Stats.ContainsKey(statKey))
                        ps.Stats[statKey] = 0;
                    ps.Stats[statKey]++;
                }
            }

            // Show hit result text
            if (HitResultText != null)
            {
                HitResultText.text = result.ToString().ToUpper();
                HitResultText.color = result switch
                {
                    HitResult.Perfect => Color.yellow,
                    HitResult.Great => Color.green,
                    HitResult.Good => Color.cyan,
                    HitResult.Miss => Color.red,
                    _ => Color.white
                };
            }

            // Fire event
            try
            {
                OnNoteHit?.Invoke(result);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[RhythmDance] OnNoteHit event exception: {ex}");
            }

            // Check fever mode
            CheckFeverMode();
        }

        /// <summary>
        /// Updates the combo counter based on hit result. Resets on miss.
        /// </summary>
        /// <param name="result">The hit result.</param>
        private void UpdateCombo(HitResult result)
        {
            if (result == HitResult.Miss)
            {
                _currentCombo = 0;
                _isFeverMode = false;
                _feverLevel = 0;
                _feverScoreMultiplier = 1f;
            }
            else
            {
                _currentCombo++;
                if (_currentCombo > _maxCombo)
                    _maxCombo = _currentCombo;
            }

            // Update combo display
            if (ComboText != null)
                ComboText.text = $"Combo: {_currentCombo}";

            // Notify combo change
            try
            {
                OnComboChanged?.Invoke(_currentCombo);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[RhythmDance] OnComboChanged event exception: {ex}");
            }
        }

        #endregion

        #region Fever Mode

        /// <summary>
        /// Checks if the current combo has reached any fever thresholds and
        /// activates the appropriate fever level.
        /// </summary>
        private void CheckFeverMode()
        {
            int newFeverLevel = 0;
            float newMultiplier = 1f;

            for (int i = 0; i < FeverThresholds.Length; i++)
            {
                if (_currentCombo >= FeverThresholds[i])
                {
                    newFeverLevel = i + 1;
                    newMultiplier = 1f + (i + 1) * 0.5f; // +50%, +100%, +150%
                }
            }

            if (newFeverLevel != _feverLevel)
            {
                _feverLevel = newFeverLevel;
                _isFeverMode = _feverLevel > 0;
                _feverScoreMultiplier = newMultiplier;

                if (_isFeverMode && FeverEffect != null)
                {
                    FeverEffect.Play();
                }

                try
                {
                    OnFeverLevelChanged?.Invoke(_feverLevel);
                }
                catch (Exception ex)
                {
                    Debug.LogError($"[RhythmDance] OnFeverLevelChanged event exception: {ex}");
                }

                Debug.Log($"[RhythmDance] Fever Level {_feverLevel} activated! Score x{_feverScoreMultiplier:F1}");
            }
        }

        /// <summary>
        /// Updates the fever mode visual feedback (screen effects, UI, etc.).
        /// </summary>
        private void UpdateFeverVisuals()
        {
            if (FeverAnimator != null)
            {
                FeverAnimator.SetBool("IsFever", _isFeverMode);
                FeverAnimator.SetInteger("FeverLevel", _feverLevel);
            }
        }

        #endregion

        #region Note Management

        /// <summary>
        /// Updates the position of all active notes and cleans up destroyed ones.
        /// </summary>
        private void UpdateNotes()
        {
            for (int i = _activeNotes.Count - 1; i >= 0; i--)
            {
                if (_activeNotes[i] == null)
                {
                    _activeNotes.RemoveAt(i);
                    continue;
                }

                _activeNotes[i].UpdatePosition(_songPosition, NoteSpeed);
            }
        }

        /// <summary>
        /// Checks for notes that have passed the miss point without being hit.
        /// </summary>
        private void CheckMissedNotes()
        {
            float missThreshold = GoodWindow + 0.1f;

            for (int i = _activeNotes.Count - 1; i >= 0; i--)
            {
                RhythmNote note = _activeNotes[i];
                if (note.IsHit || note.IsMissed) continue;

                // If note has passed its hit time beyond the good window
                if (_songPosition > note.HitTime + missThreshold)
                {
                    note.IsMissed = true;
                    ProcessHit(HitResult.Miss);

                    Destroy(note.gameObject);
                    _activeNotes.RemoveAt(i);
                }
            }
        }

        #endregion

        #region Visual Effects

        /// <summary>
        /// Shows the lane press visual effect when a lane key is pressed.
        /// </summary>
        /// <param name="lane">Lane index.</param>
        private void ShowLanePressEffect(int lane)
        {
            if (lane < 0 || lane >= _rhythmLanes.Count) return;

            RhythmLane rhythmLane = _rhythmLanes[lane];
            if (rhythmLane.PressEffect != null)
            {
                rhythmLane.PressEffect.SetActive(true);
                StartCoroutine(HideEffectAfterDelay(rhythmLane.PressEffect, 0.1f));
            }
        }

        /// <summary>
        /// Shows the hit quality visual effect in the specified lane.
        /// </summary>
        /// <param name="lane">Lane index.</param>
        /// <param name="result">Hit quality.</param>
        private void ShowHitEffect(int lane, HitResult result)
        {
            if (lane < 0 || lane >= _rhythmLanes.Count) return;

            RhythmLane rhythmLane = _rhythmLanes[lane];

            if (result == HitResult.Perfect && PerfectEffect != null)
            {
                PerfectEffect.transform.position = rhythmLane.LaneTransform?.position ?? transform.position;
                PerfectEffect.Play();
            }

            GameObject effectObj = result switch
            {
                HitResult.Perfect or HitResult.Great => rhythmLane.HitEffect,
                _ => rhythmLane.MissEffect
            };

            if (effectObj != null)
            {
                effectObj.SetActive(true);
                StartCoroutine(HideEffectAfterDelay(effectObj, 0.3f));
            }
        }

        /// <summary>
        /// Coroutine to deactivate a GameObject after a delay.
        /// </summary>
        private IEnumerator HideEffectAfterDelay(GameObject effect, float delay)
        {
            yield return new WaitForSeconds(delay);
            if (effect != null)
                effect.SetActive(false);
        }

        #endregion

        #region Reward Calculation

        /// <summary>
        /// Calculates performance-based rewards at the end of the minigame.
        /// Higher accuracy and max combo yield better rewards.
        /// </summary>
        protected override void CalculateRewards()
        {
            base.CalculateRewards();

            int totalNotes = _perfectCount + _greatCount + _goodCount + _missCount;
            if (totalNotes == 0) return;

            float accuracy = (_perfectCount * 1.0f + _greatCount * 0.75f + _goodCount * 0.5f) / totalNotes;

            foreach (var kvp in PlayerScores)
            {
                PlayerScore ps = kvp.Value;

                // Reward based on max combo
                if (_maxCombo >= 50)
                    ps.Rewards.Add(new RewardData { RewardType = "gems", RewardId = "gem_premium", Amount = 10 });
                else if (_maxCombo >= 25)
                    ps.Rewards.Add(new RewardData { RewardType = "gems", RewardId = "gem_standard", Amount = 5 });

                // Reward based on accuracy
                if (accuracy >= 0.95f)
                    ps.Rewards.Add(new RewardData { RewardType = "item", RewardId = "rhythm_perfect_badge", Amount = 1 });
                else if (accuracy >= 0.80f)
                    ps.Rewards.Add(new RewardData { RewardType = "coins", RewardId = "coins_bonus", Amount = 100 });

                // Store stats
                ps.Stats["total_notes"] = totalNotes;
                ps.Stats["perfect"] = _perfectCount;
                ps.Stats["great"] = _greatCount;
                ps.Stats["good"] = _goodCount;
                ps.Stats["miss"] = _missCount;
                ps.Stats["max_combo"] = _maxCombo;
                ps.Stats["accuracy"] = Mathf.RoundToInt(accuracy * 100);
            }

            Debug.Log($"[RhythmDance] Calculated rewards. Accuracy: {accuracy:P0}, Max Combo: {_maxCombo}");
        }

        #endregion

        #region Cleanup

        /// <summary>
        /// Called when returning to Inactive state. Cleans up all spawned notes
        /// and resets runtime state.
        /// </summary>
        protected override void OnEnterInactive()
        {
            base.OnEnterInactive();

            // Destroy all active notes
            foreach (var note in _activeNotes)
            {
                if (note != null && note.gameObject != null)
                    Destroy(note.gameObject);
            }
            _activeNotes.Clear();

            // Reset state
            _currentCombo = 0;
            _maxCombo = 0;
            _perfectCount = 0;
            _greatCount = 0;
            _goodCount = 0;
            _missCount = 0;
            _feverLevel = 0;
            _isFeverMode = false;
            _songPosition = 0f;
            _nextNoteIndex = 0;
            _feverScoreMultiplier = 1f;

            Debug.Log("[RhythmDance] Cleaned up and returned to inactive.");
        }

        #endregion

        #region Public API

        /// <summary>
        /// Gets the current hit accuracy as a percentage (0-100).
        /// </summary>
        public float GetAccuracy()
        {
            int total = _perfectCount + _greatCount + _goodCount + _missCount;
            if (total == 0) return 0f;
            return ((_perfectCount * 1.0f + _greatCount * 0.75f + _goodCount * 0.5f) / total) * 100f;
        }

        /// <summary>
        /// Gets the current combo count.
        /// </summary>
        public int GetCurrentCombo() => _currentCombo;

        /// <summary>
        /// Gets the maximum combo achieved.
        /// </summary>
        public int GetMaxCombo() => _maxCombo;

        /// <summary>
        /// Gets the current fever level.
        /// </summary>
        public int GetFeverLevel() => _feverLevel;

        /// <summary>
        /// Returns the count of each hit result type.
        /// </summary>
        public Dictionary<HitResult, int> GetHitCounts()
        {
            return new Dictionary<HitResult, int>
            {
                { HitResult.Perfect, _perfectCount },
                { HitResult.Great, _greatCount },
                { HitResult.Good, _goodCount },
                { HitResult.Miss, _missCount }
            };
        }

        #endregion
    }
}
