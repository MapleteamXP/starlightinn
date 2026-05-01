/**
 * AnimationCatalog.js
 * Starlight Inn v7.0 — Habbo-style Avatar Animation Data & Renderer
 * 10+ fully animated avatar actions with per-frame body part offsets,
 * loop flags, durations, and IsoAvatarRenderer integration hooks.
 *
 * @version 7.0.0
 * @module StarlightInn/assets/AnimationCatalog
 */

'use strict';

/* ──────────── animation palette & helpers ──────────── */
const ANI = {
  outline: '#000000',
  skin: '#FFCC80', skinShadow: '#E6A075',
  eyeWhite: '#FFFFFF', eyePupil: '#212121',
  hairBrown: '#5D4037', hairBlonde: '#FDD835', hairBlack: '#212121',
  shirt: '#EEEEEE', pants: '#1565C0', shoes: '#FFFFFF',
  // action-specific
  sleepZ: '#90CAF9', heart: '#F48FB1', musicNote: '#AB47BC',
  food: '#FFAB40', bookCover: '#D32F2F', bookPage: '#FFFFFF',
  swimBubble: '#B3E5FC', djGlow: '#00E676',
};

/**
 * Helper: draw a simple Habbo-style avatar body at given offsets.
 * This is the base pose; animations modify offsets per frame.
 */
function drawAvatarBase(ctx, x, y, {
  bodyX = 0, bodyY = 0,
  headX = 0, headY = 0,
  armLX = 0, armLY = 0,
  armRX = 0, armRY = 0,
  legLX = 0, legLY = 0,
  legRX = 0, legRY = 0,
  facing = 'SE',
  eyeOpen = true, mouth = 'neutral',
  accessory = null,
}) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const dir = facing === 'SE' ? 1 : -1;

  // ── legs ──
  ctx.fillStyle = ANI.pants; ctx.strokeStyle = ANI.outline; ctx.lineWidth = 2;
  ctx.fillRect(x - 6 + legLX, y + legLY, 5, 8); ctx.strokeRect(x - 6 + legLX, y + legLY, 5, 8);
  ctx.fillRect(x + 1 + legRX, y + legRY, 5, 8); ctx.strokeRect(x + 1 + legRX, y + legRY, 5, 8);

  // ── shoes ──
  ctx.fillStyle = ANI.shoes;
  ctx.fillRect(x - 6 + legLX, y + 6 + legLY, 5, 3); ctx.strokeRect(x - 6 + legLX, y + 6 + legLY, 5, 3);
  ctx.fillRect(x + 1 + legRX, y + 6 + legRY, 5, 3); ctx.strokeRect(x + 1 + legRX, y + 6 + legRY, 5, 3);

  // ── torso ──
  ctx.fillStyle = ANI.shirt;
  ctx.fillRect(x - 8 + bodyX, y - 14 + bodyY, 16, 14); ctx.strokeRect(x - 8 + bodyX, y - 14 + bodyY, 16, 14);

  // ── arms ──
  ctx.fillStyle = ANI.skin;
  // left arm
  ctx.fillRect(x - 12 + armLX * dir, y - 12 + armLY, 4, 10); ctx.strokeRect(x - 12 + armLX * dir, y - 12 + armLY, 4, 10);
  // right arm
  ctx.fillRect(x + 8 + armRX * dir, y - 12 + armRY, 4, 10); ctx.strokeRect(x + 8 + armRX * dir, y - 12 + armRY, 4, 10);

  // ── head ──
  ctx.fillStyle = ANI.skin;
  ctx.beginPath(); ctx.arc(x + headX, y - 20 + headY, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // hair
  ctx.fillStyle = ANI.hairBrown;
  ctx.beginPath(); ctx.arc(x + headX, y - 22 + headY, 9, Math.PI, 0); ctx.fill(); ctx.stroke();

  // eyes
  if (eyeOpen) {
    ctx.fillStyle = ANI.eyeWhite;
    ctx.fillRect(x - 4 + headX, y - 22 + headY, 3, 3); ctx.strokeRect(x - 4 + headX, y - 22 + headY, 3, 3);
    ctx.fillRect(x + 1 + headX, y - 22 + headY, 3, 3); ctx.strokeRect(x + 1 + headX, y - 22 + headY, 3, 3);
    ctx.fillStyle = ANI.eyePupil;
    ctx.fillRect(x - 3 + headX, y - 21 + headY, 1, 1);
    ctx.fillRect(x + 2 + headX, y - 21 + headY, 1, 1);
  } else {
    ctx.strokeStyle = ANI.outline; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 4 + headX, y - 20 + headY); ctx.lineTo(x - 1 + headX, y - 20 + headY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 1 + headX, y - 20 + headY); ctx.lineTo(x + 4 + headX, y - 20 + headY); ctx.stroke();
  }

  // mouth
  ctx.strokeStyle = ANI.outline; ctx.lineWidth = 1;
  if (mouth === 'smile') {
    ctx.beginPath(); ctx.arc(x + headX, y - 16 + headY, 3, 0, Math.PI); ctx.stroke();
  } else if (mouth === 'open') {
    ctx.fillStyle = '#D32F2F';
    ctx.beginPath(); ctx.ellipse(x + headX, y - 15 + headY, 2, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (mouth === 'kiss') {
    ctx.beginPath(); ctx.ellipse(x + headX, y - 15 + headY, 2, 1.5, 0, 0, Math.PI * 2); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(x - 2 + headX, y - 15 + headY); ctx.lineTo(x + 2 + headX, y - 15 + headY); ctx.stroke();
  }

  ctx.restore();
}

/* ──────────── animation data factory ──────────── */
function makeAnimation({ id, name, frames, durationMs, loop = true, drawOverlay = null }) {
  return {
    id, name,
    frameCount: frames.length,
    durationMs,
    loop,
    frames, // array of offset objects + mouth/eye state
    draw(ctx, x, y, facing, frameIndex) {
      const f = frames[Math.floor(frameIndex) % frames.length];
      drawAvatarBase(ctx, x, y, { ...f, facing });
      if (drawOverlay) drawOverlay(ctx, x, y, facing, f, frameIndex);
    },
    drawInterpolated(ctx, x, y, facing, progress) {
      const idx = (progress * frames.length) % frames.length;
      const i0 = Math.floor(idx);
      const i1 = (i0 + 1) % frames.length;
      const t = idx - i0;
      const f0 = frames[i0];
      const f1 = frames[i1];
      const interp = {};
      for (const key of Object.keys(f0)) {
        if (typeof f0[key] === 'number' && typeof f1[key] === 'number') {
          interp[key] = f0[key] + (f1[key] - f0[key]) * t;
        } else {
          interp[key] = t < 0.5 ? f0[key] : f1[key];
        }
      }
      drawAvatarBase(ctx, x, y, { ...interp, facing });
      if (drawOverlay) drawOverlay(ctx, x, y, facing, interp, idx);
    },
  };
}

/* ═══════════════════════════════════════════════════════════════
   ANIMATIONS (10 actions)
   ═══════════════════════════════════════════════════════════════ */

const AnimationCatalog = {};

/* ─── 1. SIT (4 frames) ─── */
AnimationCatalog.sit = makeAnimation({
  id: 'sit', name: 'Sit',
  durationMs: 800, loop: true,
  frames: [
    { bodyX: 0, bodyY: 6,  headX: 0, headY: 4,  armLX: 0, armLY: 6, armRX: 0, armRY: 6, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'neutral', eyeOpen: true },
    { bodyX: 0, bodyY: 6,  headX: 0, headY: 5,  armLX: 1, armLY: 6, armRX: -1, armRY: 6, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'neutral', eyeOpen: true },
    { bodyX: 0, bodyY: 6,  headX: 0, headY: 4,  armLX: 2, armLY: 5, armRX: -2, armRY: 5, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'neutral', eyeOpen: true },
    { bodyX: 0, bodyY: 6,  headX: 0, headY: 5,  armLX: 1, armLY: 6, armRX: -1, armRY: 6, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'neutral', eyeOpen: true },
  ],
});

/* ─── 2. DANCE (8 frames) ─── */
AnimationCatalog.dance = makeAnimation({
  id: 'dance', name: 'Dance',
  durationMs: 1200, loop: true,
  frames: [
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: -2, armLY: -4, armRX: 2, armRY: -4, legLX: -2, legLY: 0, legRX: 2, legRY: 0, mouth: 'smile', eyeOpen: true },
    { bodyX: 0, bodyY: -2, headX: 0, headY: -1, armLX: -4, armLY: -6, armRX: 4, armRY: -2, legLX: -3, legLY: 0, legRX: 3, legRY: 0, mouth: 'smile', eyeOpen: true },
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: -2, armLY: -2, armRX: 6, armRY: -6, legLX: -2, legLY: 0, legRX: 4, legRY: 0, mouth: 'open', eyeOpen: true },
    { bodyX: 0, bodyY: -2, headX: 0, headY: -1, armLX: 2, armLY: -6, armRX: -4, armRY: -2, legLX: 3, legLY: 0, legRX: -3, legRY: 0, mouth: 'smile', eyeOpen: true },
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 4, armLY: -4, armRX: -2, armRY: -4, legLX: 2, legLY: 0, legRX: -2, legRY: 0, mouth: 'smile', eyeOpen: true },
    { bodyX: 0, bodyY: -2, headX: 0, headY: -1, armLX: 6, armLY: -2, armRX: -2, armRY: -6, legLX: 4, legLY: 0, legRX: -2, legRY: 0, mouth: 'open', eyeOpen: true },
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 2, armLY: -4, armRX: -4, armRY: -6, legLX: 2, legLY: 0, legRX: -4, legRY: 0, mouth: 'smile', eyeOpen: true },
    { bodyX: 0, bodyY: -2, headX: 0, headY: -1, armLX: 0, armLY: -6, armRX: 0, armRY: -6, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'smile', eyeOpen: true },
  ],
  drawOverlay(ctx, x, y, facing, f, idx) {
    // music notes
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = ANI.musicNote;
    const noteX = x + (Math.sin(idx * 0.8) * 12);
    const noteY = y - 36 + (Math.cos(idx * 0.8) * 4);
    ctx.fillRect(noteX, noteY, 3, 6); ctx.fillRect(noteX + 3, noteY, 2, 2);
    ctx.strokeStyle = ANI.outline; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(noteX + 3, noteY); ctx.lineTo(noteX + 3, noteY + 6); ctx.stroke();
    ctx.restore();
  },
});

/* ─── 3. LAUGH (6 frames) ─── */
AnimationCatalog.laugh = makeAnimation({
  id: 'laugh', name: 'Laugh',
  durationMs: 900, loop: true,
  frames: [
    { bodyX: 0, bodyY: -1, headX: 0, headY: -2, armLX: -1, armLY: -2, armRX: 1, armRY: -2, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'open', eyeOpen: true },
    { bodyX: 0, bodyY: -2, headX: 0, headY: -3, armLX: -2, armLY: -3, armRX: 2, armRY: -3, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'open', eyeOpen: false },
    { bodyX: 0, bodyY: -1, headX: 0, headY: -2, armLX: -1, armLY: -2, armRX: 1, armRY: -2, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'open', eyeOpen: true },
    { bodyX: 0, bodyY: -2, headX: 0, headY: -3, armLX: -2, armLY: -3, armRX: 2, armRY: -3, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'open', eyeOpen: false },
    { bodyX: 0, bodyY: -1, headX: 0, headY: -2, armLX: -1, armLY: -2, armRX: 1, armRY: -2, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'open', eyeOpen: true },
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 0, armLY: 0,  armRX: 0, armRY: 0,  legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'smile', eyeOpen: true },
  ],
  drawOverlay(ctx, x, y, facing, f, idx) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // tears of joy
    ctx.fillStyle = '#90CAF9';
    ctx.fillRect(x - 5, y - 22, 2, 3);
    ctx.fillRect(x + 3, y - 22, 2, 3);
    ctx.restore();
  },
});

/* ─── 4. KISS (5 frames) ─── */
AnimationCatalog.kiss = makeAnimation({
  id: 'kiss', name: 'Kiss',
  durationMs: 1200, loop: false,
  frames: [
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 0, armLY: 0,  armRX: 0, armRY: 0,  legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'neutral', eyeOpen: true },
    { bodyX: 0, bodyY: 0,  headX: 1, headY: 0,  armLX: 2, armLY: -2, armRX: -1, armRY: -1, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'kiss', eyeOpen: true },
    { bodyX: 0, bodyY: 0,  headX: 2, headY: 0,  armLX: 4, armLY: -4, armRX: -2, armRY: -2, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'kiss', eyeOpen: false },
    { bodyX: 0, bodyY: 0,  headX: 1, headY: 0,  armLX: 2, armLY: -2, armRX: -1, armRY: -1, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'kiss', eyeOpen: true },
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 0, armLY: 0,  armRX: 0, armRY: 0,  legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'smile', eyeOpen: true },
  ],
  drawOverlay(ctx, x, y, facing, f, idx) {
    if (idx >= 1.5 && idx <= 3.5) {
      ctx.save(); ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = ANI.heart;
      const hx = x + 10 + (idx - 1.5) * 6;
      const hy = y - 22 - (idx - 1.5) * 4;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.bezierCurveTo(hx - 4, hy - 4, hx - 8, hy + 2, hx, hy + 6);
      ctx.bezierCurveTo(hx + 8, hy + 2, hx + 4, hy - 4, hx, hy); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  },
});

/* ─── 5. WAVE (4 frames) ─── */
AnimationCatalog.wave = makeAnimation({
  id: 'wave', name: 'Wave',
  durationMs: 800, loop: true,
  frames: [
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 0, armLY: 0,  armRX: 0, armRY: -6, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'smile', eyeOpen: true },
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 0, armLY: 0,  armRX: 0, armRY: -10, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'smile', eyeOpen: true },
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 0, armLY: 0,  armRX: 0, armRY: -6, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'smile', eyeOpen: true },
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 0, armLY: 0,  armRX: 0, armRY: 0,  legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'smile', eyeOpen: true },
  ],
});

/* ─── 6. SLEEP (2 frames) ─── */
AnimationCatalog.sleep = makeAnimation({
  id: 'sleep', name: 'Sleep',
  durationMs: 2000, loop: true,
  frames: [
    { bodyX: 0, bodyY: 6,  headX: 0, headY: 4,  armLX: 0, armLY: 6, armRX: 0, armRY: 6, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'neutral', eyeOpen: false },
    { bodyX: 0, bodyY: 6,  headX: 0, headY: 5,  armLX: 1, armLY: 6, armRX: -1, armRY: 6, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'neutral', eyeOpen: false },
  ],
  drawOverlay(ctx, x, y, facing, f, idx) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = ANI.sleepZ;
    ctx.strokeStyle = ANI.outline; ctx.lineWidth = 1;
    const zx = x + 8 + idx * 2;
    const zy = y - 32 - idx * 4;
    ctx.font = '10px monospace';
    ctx.fillText('Z', zx, zy);
    ctx.strokeText('Z', zx, zy);
    ctx.restore();
  },
});

/* ─── 7. EAT (6 frames) ─── */
AnimationCatalog.eat = makeAnimation({
  id: 'eat', name: 'Eat',
  durationMs: 1400, loop: false,
  frames: [
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 0, armLY: 0,  armRX: -2, armRY: -2, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'neutral', eyeOpen: true },
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 0, armLY: 0,  armRX: -2, armRY: -6, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'neutral', eyeOpen: true },
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 0, armLY: 0,  armRX: -2, armRY: -8, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'open', eyeOpen: true },
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 0, armLY: 0,  armRX: -2, armRY: -6, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'open', eyeOpen: true },
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 0, armLY: 0,  armRX: -2, armRY: -2, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'smile', eyeOpen: true },
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 0, armLY: 0,  armRX: 0, armRY: 0,  legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'smile', eyeOpen: true },
  ],
  drawOverlay(ctx, x, y, facing, f, idx) {
    if (idx >= 1.0 && idx <= 4.0) {
      ctx.save(); ctx.imageSmoothingEnabled = false;
      // food item near mouth
      ctx.fillStyle = ANI.food; ctx.strokeStyle = ANI.outline; ctx.lineWidth = 1;
      const fx = x + 8 + Math.sin(idx) * 2;
      const fy = y - 22 + Math.cos(idx) * 2;
      ctx.beginPath(); ctx.arc(fx, fy, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // crumbs
      if (idx > 2.5) {
        ctx.fillStyle = '#FFE0B2';
        ctx.fillRect(fx - 6, fy + 4, 2, 2);
        ctx.fillRect(fx + 4, fy + 2, 2, 2);
      }
      ctx.restore();
    }
  },
});

/* ─── 8. READ (4 frames) ─── */
AnimationCatalog.read = makeAnimation({
  id: 'read', name: 'Read',
  durationMs: 1600, loop: true,
  frames: [
    { bodyX: 0, bodyY: 4,  headX: 0, headY: 2,  armLX: 2, armLY: -2, armRX: -2, armRY: -2, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'neutral', eyeOpen: true },
    { bodyX: 0, bodyY: 4,  headX: 0, headY: 2,  armLX: 2, armLY: -2, armRX: -2, armRY: -2, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'neutral', eyeOpen: false },
    { bodyX: 0, bodyY: 4,  headX: 0, headY: 3,  armLX: 2, armLY: -3, armRX: -2, armRY: -3, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'neutral', eyeOpen: true },
    { bodyX: 0, bodyY: 4,  headX: 0, headY: 2,  armLX: 2, armLY: -2, armRX: -2, armRY: -2, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'neutral', eyeOpen: false },
  ],
  drawOverlay(ctx, x, y, facing, f, idx) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // open book
    const bx = x - 8; const by = y - 18;
    ctx.fillStyle = ANI.bookCover; ctx.strokeStyle = ANI.outline; ctx.lineWidth = 1;
    ctx.fillRect(bx, by, 7, 10); ctx.strokeRect(bx, by, 7, 10);
    ctx.fillRect(bx + 7, by, 7, 10); ctx.strokeRect(bx + 7, by, 7, 10);
    ctx.fillStyle = ANI.bookPage;
    ctx.fillRect(bx + 1, by + 1, 5, 8);
    ctx.fillRect(bx + 8, by + 1, 5, 8);
    ctx.restore();
  },
});

/* ─── 9. DJ (6 frames) ─── */
AnimationCatalog.dj = makeAnimation({
  id: 'dj', name: 'DJ',
  durationMs: 800, loop: true,
  frames: [
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: -2, armLY: -4, armRX: 4, armRY: -6, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'smile', eyeOpen: true },
    { bodyX: 0, bodyY: -1, headX: 0, headY: -1, armLX: -4, armLY: -6, armRX: 2, armRY: -4, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'open', eyeOpen: true },
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 0, armLY: -2, armRX: 0, armRY: -2, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'smile', eyeOpen: true },
    { bodyX: 0, bodyY: -1, headX: 0, headY: -1, armLX: 4, armLY: -6, armRX: -2, armRY: -4, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'open', eyeOpen: true },
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 2, armLY: -4, armRX: -4, armRY: -6, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'smile', eyeOpen: true },
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 0, armLY: 0,  armRX: 0, armRY: 0,  legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'smile', eyeOpen: true },
  ],
  drawOverlay(ctx, x, y, facing, f, idx) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // headphones
    ctx.fillStyle = '#424242'; ctx.strokeStyle = ANI.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 12, y - 28, 4, 8); ctx.strokeRect(x - 12, y - 28, 4, 8);
    ctx.fillRect(x + 8, y - 28, 4, 8); ctx.strokeRect(x + 8, y - 28, 4, 8);
    ctx.strokeStyle = '#424242'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y - 24, 12, Math.PI, 0); ctx.stroke();
    // glow sticks / deck suggestion
    ctx.fillStyle = ANI.djGlow;
    ctx.fillRect(x - 14 + f.armLX, y - 10 + f.armLY, 3, 8);
    ctx.fillRect(x + 11 + f.armRX, y - 10 + f.armRY, 3, 8);
    ctx.restore();
  },
});

/* ─── 10. SWIM (6 frames) ─── */
AnimationCatalog.swim = makeAnimation({
  id: 'swim', name: 'Swim',
  durationMs: 1000, loop: true,
  frames: [
    { bodyX: 0, bodyY: 4,  headX: 0, headY: 4,  armLX: -4, armLY: -2, armRX: 4, armRY: -2, legLX: -2, legLY: 4, legRX: 2, legRY: 4, mouth: 'neutral', eyeOpen: true },
    { bodyX: 0, bodyY: 2,  headX: 0, headY: 2,  armLX: -6, armLY: -4, armRX: 2, armRY: -2, legLX: -3, legLY: 3, legRX: 1, legRY: 3, mouth: 'neutral', eyeOpen: true },
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: -2, armLY: -6, armRX: 0, armRY: -4, legLX: -1, legLY: 2, legRX: 0, legRY: 2, mouth: 'open', eyeOpen: true },
    { bodyX: 0, bodyY: 2,  headX: 0, headY: 2,  armLX: 2, armLY: -4, armRX: -2, armRY: -6, legLX: 1, legLY: 3, legRX: -1, legRY: 3, mouth: 'neutral', eyeOpen: true },
    { bodyX: 0, bodyY: 4,  headX: 0, headY: 4,  armLX: 4, armLY: -2, armRX: -4, armRY: -2, legLX: 2, legLY: 4, legRX: -2, legRY: 4, mouth: 'neutral', eyeOpen: true },
    { bodyX: 0, bodyY: 2,  headX: 0, headY: 2,  armLX: 6, armLY: -4, armRX: -6, armRY: -4, legLX: 3, legLY: 3, legRX: -3, legRY: 3, mouth: 'neutral', eyeOpen: true },
  ],
  drawOverlay(ctx, x, y, facing, f, idx) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // water line
    ctx.strokeStyle = '#42A5F5'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 20, y); ctx.lineTo(x + 20, y); ctx.stroke();
    // bubbles
    ctx.fillStyle = ANI.swimBubble;
    const bx = x + Math.sin(idx * 1.2) * 10;
    const by = y - 10 - (idx % 1) * 10;
    ctx.beginPath(); ctx.arc(bx, by, 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(bx + 6, by - 4, 1.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  },
});

/* ─── 11. IDLE (2 frames) ─── */
AnimationCatalog.idle = makeAnimation({
  id: 'idle', name: 'Idle',
  durationMs: 2000, loop: true,
  frames: [
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 0, armLY: 0,  armRX: 0, armRY: 0,  legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'neutral', eyeOpen: true },
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 1,  armLX: 0, armLY: 0,  armRX: 0, armRY: 0,  legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'neutral', eyeOpen: true },
  ],
});

/* ─── 12. WALK (4 frames) ─── */
AnimationCatalog.walk = makeAnimation({
  id: 'walk', name: 'Walk',
  durationMs: 600, loop: true,
  frames: [
    { bodyX: 0, bodyY: -1, headX: 0, headY: 0,  armLX: -2, armLY: -1, armRX: 2, armRY: 0,  legLX: -2, legLY: 0, legRX: 2, legRY: 0, mouth: 'neutral', eyeOpen: true },
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: -3, armLY: 0,  armRX: 3, armRY: -1, legLX: -3, legLY: 0, legRX: 3, legRY: 0, mouth: 'neutral', eyeOpen: true },
    { bodyX: 0, bodyY: -1, headX: 0, headY: 0,  armLX: -2, armLY: 0,  armRX: 2, armRY: -1, legLX: -2, legLY: 0, legRX: 2, legRY: 0, mouth: 'neutral', eyeOpen: true },
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 0, armLY: -1,  armRX: 0, armRY: 0,  legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'neutral', eyeOpen: true },
  ],
});

/* ─── 13. JUMP (4 frames) ─── */
AnimationCatalog.jump = makeAnimation({
  id: 'jump', name: 'Jump',
  durationMs: 600, loop: false,
  frames: [
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 0, armLY: -2, armRX: 0, armRY: -2, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'open', eyeOpen: true },
    { bodyX: 0, bodyY: -6, headX: 0, headY: -2, armLX: -2, armLY: -6, armRX: 2, armRY: -6, legLX: -2, legLY: 2, legRX: 2, legRY: 2, mouth: 'open', eyeOpen: true },
    { bodyX: 0, bodyY: -8, headX: 0, headY: -3, armLX: -4, armLY: -8, armRX: 4, armRY: -8, legLX: -3, legLY: 3, legRX: 3, legRY: 3, mouth: 'open', eyeOpen: true },
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 0, armLY: -2, armRX: 0, armRY: -2, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'smile', eyeOpen: true },
  ],
});

/* ─── 14. BOW (3 frames) ─── */
AnimationCatalog.bow = makeAnimation({
  id: 'bow', name: 'Bow',
  durationMs: 900, loop: false,
  frames: [
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 0, armLY: 0,  armRX: 0, armRY: 0,  legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'smile', eyeOpen: true },
    { bodyX: 0, bodyY: 4,  headX: 0, headY: 4,  armLX: 2, armLY: -2, armRX: -2, armRY: -2, legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'smile', eyeOpen: false },
    { bodyX: 0, bodyY: 0,  headX: 0, headY: 0,  armLX: 0, armLY: 0,  armRX: 0, armRY: 0,  legLX: 0, legLY: 0, legRX: 0, legRY: 0, mouth: 'smile', eyeOpen: true },
  ],
});

/* ═══════════════════════════════════════════════════════════════
   ISO AVATAR RENDERER
   ═══════════════════════════════════════════════════════════════ */

class IsoAvatarRenderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.currentAnimation = AnimationCatalog.idle;
    this.frameTime = 0;
    this.facing = 'SE';
    this.isPlaying = false;
    this.lastTimestamp = 0;
  }

  setAnimation(animId) {
    const anim = AnimationCatalog[animId];
    if (!anim) return false;
    this.currentAnimation = anim;
    this.frameTime = 0;
    return true;
  }

  setFacing(facing) {
    this.facing = facing === 'NW' ? 'NW' : 'SE';
  }

  play() { this.isPlaying = true; }
  pause() { this.isPlaying = false; }
  stop() { this.isPlaying = false; this.frameTime = 0; }

  update(deltaMs) {
    if (!this.isPlaying) return;
    this.frameTime += deltaMs;
    const anim = this.currentAnimation;
    if (anim.loop) {
      this.frameTime %= anim.durationMs;
    } else {
      if (this.frameTime >= anim.durationMs) {
        this.frameTime = anim.durationMs;
        this.isPlaying = false;
      }
    }
  }

  draw(x, y) {
    const anim = this.currentAnimation;
    const progress = anim.durationMs > 0 ? this.frameTime / anim.durationMs : 0;
    anim.drawInterpolated(this.ctx, x, y, this.facing, progress);
  }

  tick(timestamp) {
    if (!this.lastTimestamp) this.lastTimestamp = timestamp;
    const delta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    this.update(delta);
  }

  /** Draw a static avatar (no animation) */
  drawStatic(x, y, animId = 'idle', frame = 0) {
    const anim = AnimationCatalog[animId] || AnimationCatalog.idle;
    anim.draw(this.ctx, x, y, this.facing, frame);
  }
}

/* ═══════════════════════════════════════════════════════════════
   ANIMATION META API
   ═══════════════════════════════════════════════════════════════ */

const ALL_ANIM_IDS = Object.keys(AnimationCatalog);

function getAnimation(id) {
  return AnimationCatalog[id] || null;
}

function getAllAnimations() {
  return ALL_ANIM_IDS.map(id => AnimationCatalog[id]);
}

function getLoopingAnimations() {
  return ALL_ANIM_IDS.filter(id => AnimationCatalog[id].loop).map(id => AnimationCatalog[id]);
}

function getOneShotAnimations() {
  return ALL_ANIM_IDS.filter(id => !AnimationCatalog[id].loop).map(id => AnimationCatalog[id]);
}

function exportAnimationData() {
  return ALL_ANIM_IDS.map(id => {
    const a = AnimationCatalog[id];
    return {
      id: a.id,
      name: a.name,
      frameCount: a.frameCount,
      durationMs: a.durationMs,
      loop: a.loop,
      frames: a.frames,
    };
  });
}

function importAnimationData(dataArray) {
  dataArray.forEach(data => {
    AnimationCatalog[data.id] = makeAnimation({
      id: data.id,
      name: data.name,
      durationMs: data.durationMs,
      loop: data.loop,
      frames: data.frames,
    });
  });
}

function generateSpriteSheet(canvasWidth = 512, canvasHeight = 512, cols = 8) {
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const cellW = Math.floor(canvasWidth / cols);
  const cellH = 64;
  let idx = 0;

  ALL_ANIM_IDS.forEach(animId => {
    const anim = AnimationCatalog[animId];
    anim.frames.forEach((frame, fIdx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = col * cellW + cellW / 2;
      const cy = row * cellH + cellH - 8;
      anim.draw(ctx, cx, cy, 'SE', fIdx);
      idx++;
    });
  });

  return { canvas, count: idx, cols, cellW, cellH };
}

function exportSpriteSheetDataURL() {
  const sheet = generateSpriteSheet();
  return sheet.canvas.toDataURL('image/png');
}

/* ═══════════════════════════════════════════════════════════════
   EXPORTS
   ═══════════════════════════════════════════════════════════════ */

export {
  AnimationCatalog,
  ANI,
  IsoAvatarRenderer,
  drawAvatarBase,
  makeAnimation,
  getAnimation,
  getAllAnimations,
  getLoopingAnimations,
  getOneShotAnimations,
  exportAnimationData,
  importAnimationData,
  generateSpriteSheet,
  exportSpriteSheetDataURL,
};

export default AnimationCatalog;

if (typeof window !== 'undefined') {
  window.AnimationCatalog = AnimationCatalog;
  window.IsoAvatarRenderer = IsoAvatarRenderer;
  window.AnimationPalette = ANI;
}
