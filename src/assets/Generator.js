// ============================================================
// Starlight Engine — Procedural Asset Generator
// ============================================================

import { TILE_W, TILE_H, WALL_H } from '../engine/Core.js';

const Assets = { avatars: {}, furniture: {}, tiles: {} };

export function clearAvatarCache(key) { delete Assets.avatars[key]; }

// ─────────────────────────────────────────────────────────────
// Avatar Generator — Habbo-style chibi proportions
// ─────────────────────────────────────────────────────────────

export function createAvatarCanvas(skinColor, hairColor, hairStyle, shirtColor, pantsColor, shoeColor, hatType, glassesType) {
  const c = document.createElement('canvas');
  c.width = 48; c.height = 72;
  const ctx = c.getContext('2d');
  const cx = 24, cy = 22; // head center

  // Helper: darken color
  function darken(hex, pct) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * pct);
    const R = Math.max((num >> 16) - amt, 0);
    const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
    const B = Math.max((num & 0x0000FF) - amt, 0);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }

  const shirtDark = darken(shirtColor, 25);
  const pantsDark = darken(pantsColor, 20);

  // ── LEGS ──
  // Left leg
  ctx.fillStyle = pantsColor;
  ctx.beginPath();
  ctx.roundRect(cx - 9, 44, 7, 18, 3);
  ctx.fill();
  ctx.strokeStyle = pantsDark;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Right leg
  ctx.fillStyle = pantsColor;
  ctx.beginPath();
  ctx.roundRect(cx + 2, 44, 7, 18, 3);
  ctx.fill();
  ctx.strokeStyle = pantsDark;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Cuffs
  ctx.fillStyle = pantsDark;
  ctx.fillRect(cx - 9, 56, 7, 3);
  ctx.fillRect(cx + 2, 56, 7, 3);

  // ── SHOES ──
  ctx.fillStyle = shoeColor || '#333';
  ctx.beginPath();
  ctx.ellipse(cx - 5.5, 64, 6, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 5.5, 64, 6, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Shoe shine
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx - 7, 63, 2, 1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 4, 63, 2, 1, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── TORSO / SHIRT ──
  // Main body - rounded rectangle with slight taper
  ctx.fillStyle = shirtColor;
  ctx.beginPath();
  ctx.moveTo(cx - 11, 34);
  ctx.lineTo(cx + 11, 34);
  ctx.quadraticCurveTo(cx + 12, 38, cx + 10, 46);
  ctx.lineTo(cx - 10, 46);
  ctx.quadraticCurveTo(cx - 12, 38, cx - 11, 34);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shirtDark;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Collar
  ctx.fillStyle = darken(shirtColor, 10);
  ctx.beginPath();
  ctx.moveTo(cx - 6, 34);
  ctx.lineTo(cx, 38);
  ctx.lineTo(cx + 6, 34);
  ctx.lineTo(cx + 4, 32);
  ctx.lineTo(cx - 4, 32);
  ctx.closePath();
  ctx.fill();

  // Shirt detail line
  ctx.strokeStyle = shirtDark;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx, 36);
  ctx.lineTo(cx, 45);
  ctx.stroke();

  // ── ARMS ──
  // Sleeves
  ctx.fillStyle = shirtColor;
  ctx.beginPath();
  ctx.roundRect(cx - 15, 35, 5, 12, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx + 10, 35, 5, 12, 2);
  ctx.fill();

  // Hands
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.arc(cx - 12.5, 49, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 12.5, 49, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // ── HEAD ──
  // Neck
  ctx.fillStyle = skinColor;
  ctx.fillRect(cx - 3, 28, 6, 6);

  // Face shape (slightly larger, more oval)
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 15, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cheeks (subtle blush)
  ctx.fillStyle = 'rgba(255,160,160,0.15)';
  ctx.beginPath();
  ctx.arc(cx - 8, cy + 6, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 8, cy + 6, 5, 0, Math.PI * 2);
  ctx.fill();

  // ── EYES ──
  // Eye whites
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(cx - 5, cy + 1, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 5, cy + 1, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pupils
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(cx - 4, cy + 1, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 6, cy + 1, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Eye shine
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx - 3, cy, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 7, cy, 1, 0, Math.PI * 2);
  ctx.fill();

  // Eyebrows
  ctx.strokeStyle = hairColor;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 9, cy - 5);
  ctx.quadraticCurveTo(cx - 5, cy - 7, cx - 2, cy - 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 2, cy - 5);
  ctx.quadraticCurveTo(cx + 5, cy - 7, cx + 9, cy - 5);
  ctx.stroke();

  // ── MOUTH ──
  ctx.strokeStyle = '#b05050';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy + 8, 4, 0.15, Math.PI - 0.15);
  ctx.stroke();

  // ── HAIR ──
  ctx.fillStyle = hairColor;
  const hairDark = darken(hairColor, 30);

  if (hairStyle === 'spiky') {
    // Spiky anime hair
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy + 2);
    ctx.lineTo(cx - 14, cy - 12);
    ctx.lineTo(cx - 10, cy - 6);
    ctx.lineTo(cx - 6, cy - 16);
    ctx.lineTo(cx - 2, cy - 8);
    ctx.lineTo(cx + 2, cy - 18);
    ctx.lineTo(cx + 6, cy - 8);
    ctx.lineTo(cx + 10, cy - 14);
    ctx.lineTo(cx + 14, cy - 6);
    ctx.lineTo(cx + 16, cy + 2);
    ctx.quadraticCurveTo(cx + 14, cy + 6, cx + 10, cy + 4);
    ctx.lineTo(cx - 10, cy + 4);
    ctx.quadraticCurveTo(cx - 14, cy + 6, cx - 16, cy + 2);
    ctx.closePath();
    ctx.fill();
    // Hair shading
    ctx.fillStyle = hairDark;
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy - 12);
    ctx.lineTo(cx - 10, cy - 6);
    ctx.lineTo(cx - 6, cy - 16);
    ctx.lineTo(cx - 2, cy - 8);
    ctx.lineTo(cx + 2, cy - 18);
    ctx.lineTo(cx + 2, cy - 10);
    ctx.lineTo(cx - 2, cy - 6);
    ctx.lineTo(cx - 6, cy - 10);
    ctx.lineTo(cx - 10, cy - 4);
    ctx.lineTo(cx - 14, cy - 8);
    ctx.closePath();
    ctx.fill();

  } else if (hairStyle === 'long') {
    // Long flowing hair
    ctx.beginPath();
    ctx.arc(cx, cy - 4, 17, Math.PI, 0);
    ctx.quadraticCurveTo(cx + 18, cy + 4, cx + 16, cy + 18);
    ctx.quadraticCurveTo(cx + 10, cy + 22, cx + 6, cy + 16);
    ctx.quadraticCurveTo(cx + 4, cy + 20, cx, cy + 16);
    ctx.quadraticCurveTo(cx - 4, cy + 20, cx - 6, cy + 16);
    ctx.quadraticCurveTo(cx - 10, cy + 22, cx - 16, cy + 18);
    ctx.quadraticCurveTo(cx - 18, cy + 4, cx - 17, cy - 4);
    ctx.closePath();
    ctx.fill();
    // Highlight
    ctx.fillStyle = hairDark;
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy + 6);
    ctx.quadraticCurveTo(cx - 14, cy + 16, cx - 10, cy + 18);
    ctx.quadraticCurveTo(cx - 12, cy + 12, cx - 14, cy + 4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 16, cy + 6);
    ctx.quadraticCurveTo(cx + 14, cy + 16, cx + 10, cy + 18);
    ctx.quadraticCurveTo(cx + 12, cy + 12, cx + 14, cy + 4);
    ctx.closePath();
    ctx.fill();

  } else if (hairStyle === 'mohawk') {
    // Mohawk with shaved sides
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy - 14);
    ctx.quadraticCurveTo(cx - 2, cy - 26, cx, cy - 30);
    ctx.quadraticCurveTo(cx + 2, cy - 26, cx + 3, cy - 14);
    ctx.closePath();
    ctx.fill();
    // Shaved texture
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(cx - 14 + i * 3, cy - 6 + i * 2, 2, 2);
      ctx.fillRect(cx + 8 + i * 3, cy - 6 + i * 2, 2, 2);
    }

  } else if (hairStyle === 'bald') {
    // Shine spots
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx - 5, cy - 10, 4, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 4, cy - 8, 3, 2, 0.3, 0, Math.PI * 2);
    ctx.fill();

  } else if (hairStyle === 'curly') {
    // Defined curly puffs
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI + Math.PI * 0.85;
      const rx = cx + Math.cos(angle) * 14;
      const ry = cy - 3 + Math.sin(angle) * 11;
      ctx.fillStyle = i % 2 === 0 ? hairColor : hairDark;
      ctx.beginPath();
      ctx.arc(rx, ry, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Top curl
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(cx, cy - 16, 6, 0, Math.PI * 2);
    ctx.fill();

  } else if (hairStyle === 'bob') {
    // Sharp bob cut
    ctx.beginPath();
    ctx.arc(cx, cy - 4, 17, Math.PI, 0);
    ctx.lineTo(cx + 17, cy + 10);
    ctx.quadraticCurveTo(cx + 10, cy + 14, cx + 4, cy + 10);
    ctx.lineTo(cx - 4, cy + 10);
    ctx.quadraticCurveTo(cx - 10, cy + 14, cx - 17, cy + 10);
    ctx.closePath();
    ctx.fill();
    // Bangs
    ctx.fillStyle = hairDark;
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy - 8);
    ctx.quadraticCurveTo(cx - 6, cy - 2, cx, cy - 6);
    ctx.quadraticCurveTo(cx + 6, cy - 2, cx + 14, cy - 8);
    ctx.lineTo(cx + 14, cy - 14);
    ctx.lineTo(cx - 14, cy - 14);
    ctx.closePath();
    ctx.fill();

  } else if (hairStyle === 'ponytail') {
    // Ponytail
    ctx.beginPath();
    ctx.arc(cx, cy - 4, 16, Math.PI, 0);
    ctx.lineTo(cx + 16, cy + 2);
    ctx.lineTo(cx - 16, cy + 2);
    ctx.closePath();
    ctx.fill();
    // Tail
    ctx.beginPath();
    ctx.ellipse(cx, cy - 22, 5, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hairDark;
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy - 22, 3, 8, 0, 0, Math.PI * 2);
    ctx.fill();

  } else if (hairStyle === 'buzz') {
    // Very short buzz cut
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(cx, cy - 6, 15, Math.PI, 0);
    ctx.lineTo(cx + 15, cy);
    ctx.lineTo(cx - 15, cy);
    ctx.closePath();
    ctx.fill();
    // Fade effect
    ctx.fillStyle = hairDark;
    ctx.beginPath();
    ctx.arc(cx, cy - 8, 14, Math.PI, 0);
    ctx.lineTo(cx + 14, cy - 2);
    ctx.lineTo(cx - 14, cy - 2);
    ctx.closePath();
    ctx.fill();

  } else {
    // Default "short" — neat, styled short hair
    ctx.beginPath();
    ctx.arc(cx, cy - 5, 16, Math.PI, 0);
    ctx.lineTo(cx + 16, cy + 1);
    ctx.quadraticCurveTo(cx + 14, cy + 5, cx + 10, cy + 3);
    ctx.lineTo(cx - 10, cy + 3);
    ctx.quadraticCurveTo(cx - 14, cy + 5, cx - 16, cy + 1);
    ctx.closePath();
    ctx.fill();
    // Side part detail
    ctx.fillStyle = hairDark;
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy - 10);
    ctx.quadraticCurveTo(cx - 4, cy - 4, cx + 4, cy - 8);
    ctx.quadraticCurveTo(cx + 8, cy - 4, cx + 14, cy - 10);
    ctx.lineTo(cx + 14, cy - 16);
    ctx.lineTo(cx - 14, cy - 16);
    ctx.closePath();
    ctx.fill();
  }

  // ── HAT ──
  if (hatType === 'cap') {
    ctx.fillStyle = shirtColor;
    ctx.beginPath();
    ctx.arc(cx, cy - 6, 16, Math.PI, 0);
    ctx.lineTo(cx + 18, cy + 2);
    ctx.lineTo(cx - 18, cy + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = darken(shirtColor, 20);
    ctx.fillRect(cx - 18, cy + 2, 36, 3);
    ctx.fillRect(cx - 16, cy - 2, 32, 2);
  } else if (hatType === 'beanie') {
    ctx.fillStyle = shirtColor;
    ctx.beginPath();
    ctx.arc(cx, cy - 8, 16, Math.PI, 0);
    ctx.lineTo(cx + 16, cy + 4);
    ctx.lineTo(cx - 16, cy + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 2, 16, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pom pom
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(cx, cy - 24, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (hatType === 'crown') {
    ctx.fillStyle = '#f4d03f';
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy - 2);
    ctx.lineTo(cx - 11, cy - 14);
    ctx.lineTo(cx - 5, cy - 6);
    ctx.lineTo(cx, cy - 16);
    ctx.lineTo(cx + 5, cy - 6);
    ctx.lineTo(cx + 11, cy - 14);
    ctx.lineTo(cx + 15, cy - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f39c12';
    ctx.fillRect(cx - 15, cy - 2, 30, 4);
    // Jewels
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath(); ctx.arc(cx - 11, cy - 10, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy - 12, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 11, cy - 10, 2, 0, Math.PI * 2); ctx.fill();
  } else if (hatType === 'wizard') {
    ctx.fillStyle = '#4B0082';
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy + 2);
    ctx.quadraticCurveTo(cx - 8, cy - 14, cx, cy - 30);
    ctx.quadraticCurveTo(cx + 8, cy - 14, cx + 15, cy + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(cx, cy - 30, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a189a';
    ctx.fillRect(cx - 15, cy, 30, 3);
  } else if (hatType === 'bowler') {
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 6, 17, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy - 10, 12, Math.PI, 0);
    ctx.lineTo(cx + 12, cy - 6);
    ctx.lineTo(cx - 12, cy - 6);
    ctx.closePath();
    ctx.fill();
  }

  // ── GLASSES ──
  if (glassesType === 'shades') {
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.roundRect(cx - 11, cy - 2, 10, 7, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(cx + 1, cy - 2, 10, 7, 2);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 11, cy + 2);
    ctx.lineTo(cx - 15, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 11, cy + 2);
    ctx.lineTo(cx + 15, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 1, cy + 2);
    ctx.lineTo(cx + 1, cy + 2);
    ctx.stroke();
    // Lens shine
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(cx - 11, cy - 2);
    ctx.lineTo(cx - 6, cy - 2);
    ctx.lineTo(cx - 9, cy + 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 1, cy - 2);
    ctx.lineTo(cx + 6, cy - 2);
    ctx.lineTo(cx + 3, cy + 2);
    ctx.closePath();
    ctx.fill();
  } else if (glassesType === 'round') {
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx - 5, cy + 1, 5.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 5, cy + 1, 5.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 0.5, cy + 1);
    ctx.lineTo(cx + 0.5, cy + 1);
    ctx.stroke();
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 10.5, cy + 1);
    ctx.lineTo(cx - 15, cy - 1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 10.5, cy + 1);
    ctx.lineTo(cx + 15, cy - 1);
    ctx.stroke();
  } else if (glassesType === 'heart') {
    ctx.fillStyle = '#e91e63';
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy);
    ctx.quadraticCurveTo(cx - 8, cy - 5, cx - 5, cy - 2);
    ctx.quadraticCurveTo(cx - 2, cy - 5, cx - 2, cy);
    ctx.quadraticCurveTo(cx - 5, cy + 4, cx - 8, cy);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 2, cy);
    ctx.quadraticCurveTo(cx + 2, cy - 5, cx + 5, cy - 2);
    ctx.quadraticCurveTo(cx + 8, cy - 5, cx + 8, cy);
    ctx.quadraticCurveTo(cx + 5, cy + 4, cx + 2, cy);
    ctx.fill();
    ctx.strokeStyle = '#e91e63';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 2, cy);
    ctx.lineTo(cx + 2, cy);
    ctx.stroke();
  }

  // ── OUTLINE ──
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 15, 16, 0, 0, Math.PI * 2);
  ctx.stroke();

  return c;
}

export function getAvatarAsset(key) {
  if (!Assets.avatars[key]) {
    const parts = key.split('|');
    Assets.avatars[key] = createAvatarCanvas(parts[0], parts[1], parts[2], parts[3], parts[4], parts[5], parts[6] || 'none', parts[7] || 'none');
  }
  return Assets.avatars[key];
}

// --- Furniture Generator ---
export function createFurnitureCanvas(type) {
  const c = document.createElement('canvas');
  c.width = 80; c.height = 80;
  const ctx = c.getContext('2d');

  if (type === 'chair') {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.moveTo(20,40);ctx.lineTo(40,30);ctx.lineTo(60,40);ctx.lineTo(40,50);ctx.closePath();ctx.fill();
    ctx.strokeStyle = '#5D3A1A'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#A0522D';
    ctx.beginPath(); ctx.moveTo(20,40);ctx.lineTo(20,18);ctx.lineTo(40,8);ctx.lineTo(40,30);ctx.closePath();ctx.fill();
    ctx.strokeStyle = '#5D3A1A'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(20,50);ctx.lineTo(20,64);ctx.stroke();
    ctx.beginPath(); ctx.moveTo(40,55);ctx.lineTo(40,68);ctx.stroke();
    ctx.beginPath(); ctx.moveTo(60,50);ctx.lineTo(60,64);ctx.stroke();
  } else if (type === 'table') {
    ctx.fillStyle = '#CD853F';
    ctx.beginPath(); ctx.moveTo(8,34);ctx.lineTo(40,18);ctx.lineTo(72,34);ctx.lineTo(40,50);ctx.closePath();ctx.fill();
    ctx.strokeStyle = '#8B4513'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = '#8B4513'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(18,42);ctx.lineTo(18,66);ctx.stroke();
    ctx.beginPath(); ctx.moveTo(40,50);ctx.lineTo(40,72);ctx.stroke();
    ctx.beginPath(); ctx.moveTo(62,42);ctx.lineTo(62,66);ctx.stroke();
  } else if (type === 'lamp') {
    ctx.fillStyle = '#B8860B';
    ctx.beginPath(); ctx.ellipse(40,56,12,5,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle = '#B8860B'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(40,56);ctx.lineTo(40,24);ctx.stroke();
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.moveTo(26,34);ctx.lineTo(54,34);ctx.lineTo(50,12);ctx.lineTo(30,12);ctx.closePath();ctx.fill();
    ctx.strokeStyle = '#B8860B'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,200,0.35)';
    ctx.beginPath(); ctx.arc(40,26,20,0,Math.PI*2);ctx.fill();
  } else if (type === 'bed') {
    ctx.fillStyle = '#4682B4';
    ctx.beginPath(); ctx.moveTo(12,42);ctx.lineTo(56,18);ctx.lineTo(76,30);ctx.lineTo(32,52);ctx.closePath();ctx.fill();
    ctx.strokeStyle = '#2E5C8A'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(26,30,9,5,-0.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#5F9EA0';
    ctx.beginPath(); ctx.moveTo(34,36);ctx.lineTo(68,18);ctx.lineTo(74,26);ctx.lineTo(38,48);ctx.closePath();ctx.fill();
  } else if (type === 'plant') {
    ctx.fillStyle = '#D2691E';
    ctx.beginPath(); ctx.moveTo(30,48);ctx.lineTo(50,48);ctx.lineTo(48,62);ctx.lineTo(32,62);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#3E2723';
    ctx.beginPath(); ctx.ellipse(40,48,10,3,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#228B22';
    ctx.beginPath(); ctx.ellipse(40,28,12,18,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#32CD32';
    ctx.beginPath(); ctx.ellipse(34,22,7,12,-0.3,0,Math.PI*2);ctx.fill();
    ctx.beginPath(); ctx.ellipse(46,26,6,11,0.3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#90EE90';
    ctx.beginPath(); ctx.ellipse(40,16,4,6,0,0,Math.PI*2);ctx.fill();
  } else if (type === 'tv') {
    ctx.fillStyle = '#444';
    ctx.beginPath(); ctx.moveTo(28,48);ctx.lineTo(52,48);ctx.lineTo(50,60);ctx.lineTo(30,60);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.moveTo(22,22);ctx.lineTo(58,10);ctx.lineTo(54,40);ctx.lineTo(26,50);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#66ccff';
    ctx.beginPath(); ctx.moveTo(26,24);ctx.lineTo(54,14);ctx.lineTo(50,36);ctx.lineTo(28,44);ctx.closePath();ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.moveTo(26,24);ctx.lineTo(38,19);ctx.lineTo(34,31);ctx.closePath();ctx.fill();
  } else if (type === 'rug') {
    ctx.fillStyle = '#8B0000';
    ctx.beginPath(); ctx.moveTo(8,38);ctx.lineTo(40,22);ctx.lineTo(72,38);ctx.lineTo(40,54);ctx.closePath();ctx.fill();
    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(14,38);ctx.lineTo(40,26);ctx.lineTo(66,38);ctx.lineTo(40,50);ctx.closePath();ctx.stroke();
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(40,38,3,0,Math.PI*2);ctx.fill();
  } else if (type === 'sofa') {
    ctx.fillStyle = '#800080';
    ctx.beginPath(); ctx.moveTo(4,38);ctx.lineTo(40,20);ctx.lineTo(76,38);ctx.lineTo(40,56);ctx.closePath();ctx.fill();
    ctx.strokeStyle = '#4B0082'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#9932CC';
    ctx.beginPath(); ctx.moveTo(4,38);ctx.lineTo(4,22);ctx.lineTo(40,4);ctx.lineTo(40,20);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#4B0082';
    ctx.beginPath(); ctx.moveTo(40,20);ctx.lineTo(40,4);ctx.lineTo(76,22);ctx.lineTo(76,38);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.ellipse(22,28,4,2,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath(); ctx.ellipse(58,28,4,2,0,0,Math.PI*2);ctx.fill();
  } else if (type === 'fridge') {
    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath(); ctx.moveTo(24,28);ctx.lineTo(48,16);ctx.lineTo(56,20);ctx.lineTo(56,56);ctx.lineTo(32,68);ctx.lineTo(32,32);ctx.closePath();ctx.fill();
    ctx.strokeStyle = '#808080'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#E0E0E0';
    ctx.beginPath(); ctx.moveTo(24,28);ctx.lineTo(48,16);ctx.lineTo(48,52);ctx.lineTo(24,64);ctx.closePath();ctx.fill();
    ctx.strokeStyle = '#A0A0A0'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#888';
    ctx.fillRect(44,24,3,24);
  } else if (type === 'bookshelf') {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.moveTo(16,28);ctx.lineTo(48,12);ctx.lineTo(64,20);ctx.lineTo(64,56);ctx.lineTo(32,72);ctx.lineTo(32,36);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#A0522D';
    ctx.beginPath(); ctx.moveTo(16,28);ctx.lineTo(48,12);ctx.lineTo(48,48);ctx.lineTo(16,64);ctx.closePath();ctx.fill();
    ctx.strokeStyle = '#5D3A1A'; ctx.lineWidth = 1;
    for(let y of [36,44,52]){ ctx.beginPath(); ctx.moveTo(18,y);ctx.lineTo(46,y-14);ctx.stroke(); }
    ctx.fillStyle = '#3498DB'; ctx.fillRect(20,30,8,4);
    ctx.fillStyle = '#E74C3C'; ctx.fillRect(22,38,6,4);
    ctx.fillStyle = '#2ECC71'; ctx.fillRect(24,46,8,4);
  } else if (type === 'fountain') {
    ctx.fillStyle = '#708090';
    ctx.beginPath(); ctx.moveTo(12,42);ctx.lineTo(40,28);ctx.lineTo(68,42);ctx.lineTo(40,56);ctx.closePath();ctx.fill();
    ctx.strokeStyle = '#2F4F4F'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#4682B4';
    ctx.beginPath(); ctx.arc(40,30,10,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#87CEEB';
    ctx.beginPath(); ctx.arc(36,26,4,0,Math.PI*2);ctx.fill();
    ctx.beginPath(); ctx.arc(44,28,3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(38,24,2,0,Math.PI*2);ctx.fill();
  } else if (type === 'piano') {
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.moveTo(4,36);ctx.lineTo(40,18);ctx.lineTo(76,36);ctx.lineTo(40,54);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(8,34);ctx.lineTo(40,18);ctx.lineTo(72,34);ctx.lineTo(40,50);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#000';
    for(let i=0;i<12;i++) ctx.fillRect(14+i*4,28,2,12);
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.moveTo(36,36);ctx.lineTo(44,32);ctx.lineTo(44,60);ctx.lineTo(36,64);ctx.closePath();ctx.fill();
  } else if (type === 'dragon') {
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath(); ctx.moveTo(30,40);ctx.lineTo(50,30);ctx.lineTo(55,45);ctx.lineTo(45,55);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.arc(38,34,6,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(36,32,2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath(); ctx.moveTo(50,38);ctx.lineTo(60,32);ctx.lineTo(58,42);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath(); ctx.moveTo(28,44);ctx.lineTo(22,38);ctx.lineTo(26,48);ctx.closePath();ctx.fill();
  } else if (type === 'statue') {
    ctx.fillStyle = '#D3D3D3';
    ctx.beginPath(); ctx.moveTo(32,24);ctx.lineTo(48,16);ctx.lineTo(48,56);ctx.lineTo(32,64);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath(); ctx.moveTo(32,24);ctx.lineTo(16,32);ctx.lineTo(16,72);ctx.lineTo(32,64);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#B0B0B0';
    ctx.beginPath(); ctx.ellipse(32,68,18,6,0,0,Math.PI*2);ctx.fill();
  } else if (type === 'clock') {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.moveTo(28,32);ctx.lineTo(52,20);ctx.lineTo(52,56);ctx.lineTo(28,68);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#F5F5DC';
    ctx.beginPath(); ctx.arc(40,40,10,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(40,40);ctx.lineTo(40,34);ctx.stroke();
    ctx.beginPath(); ctx.moveTo(40,40);ctx.lineTo(44,42);ctx.stroke();
  } else if (type === 'chest') {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.moveTo(20,36);ctx.lineTo(48,22);ctx.lineTo(60,28);ctx.lineTo(60,48);ctx.lineTo(32,62);ctx.lineTo(32,42);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#A0522D';
    ctx.beginPath(); ctx.moveTo(20,36);ctx.lineTo(48,22);ctx.lineTo(48,42);ctx.lineTo(20,56);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(30,36,4,4);
  } else if (type === 'mirror') {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.moveTo(26,20);ctx.lineTo(54,6);ctx.lineTo(54,50);ctx.lineTo(26,64);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath(); ctx.ellipse(40,30,10,16,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#E8E8E8';
    ctx.beginPath(); ctx.ellipse(40,30,8,14,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.moveTo(36,20);ctx.lineTo(42,18);ctx.lineTo(38,32);ctx.closePath();ctx.fill();
  } else if (type === 'vase') {
    ctx.fillStyle = '#3498DB';
    ctx.beginPath(); ctx.moveTo(34,30);ctx.lineTo(46,24);ctx.lineTo(48,48);ctx.lineTo(32,54);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#2980B9';
    ctx.fillRect(32,24,16,6);
    ctx.fillStyle = '#E74C3C';
    ctx.beginPath(); ctx.arc(38,20,3,0,Math.PI*2);ctx.fill();
    ctx.beginPath(); ctx.arc(42,18,2.5,0,Math.PI*2);ctx.fill();
  } else if (type === 'trophy') {
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.moveTo(34,44);ctx.lineTo(46,38);ctx.lineTo(46,50);ctx.lineTo(34,56);ctx.closePath();ctx.fill();
    ctx.beginPath(); ctx.arc(40,28,8,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#F4D03F';
    ctx.beginPath(); ctx.arc(36,26,3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#B8860B';
    ctx.fillRect(36,52,8,4);
  } else if (type === 'jukebox') {
    ctx.fillStyle = '#8B0000';
    ctx.beginPath(); ctx.moveTo(20,32);ctx.lineTo(48,18);ctx.lineTo(60,24);ctx.lineTo(60,52);ctx.lineTo(32,66);ctx.lineTo(32,38);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#A52A2A';
    ctx.beginPath(); ctx.moveTo(20,32);ctx.lineTo(48,18);ctx.lineTo(48,46);ctx.lineTo(20,60);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(34,36,5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#333';
    ctx.fillRect(28,44,8,8);
  } else if (type === 'arcade') {
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.moveTo(20,28);ctx.lineTo(48,14);ctx.lineTo(60,20);ctx.lineTo(60,56);ctx.lineTo(32,70);ctx.lineTo(32,34);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.moveTo(20,28);ctx.lineTo(48,14);ctx.lineTo(48,50);ctx.lineTo(20,64);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#0f0';
    ctx.fillRect(26,26,14,10);
    ctx.fillStyle = '#f0f';
    ctx.beginPath(); ctx.arc(30,50,3,0,Math.PI*2);ctx.fill();
    ctx.beginPath(); ctx.arc(38,50,3,0,Math.PI*2);ctx.fill();
  } else if (type === 'barrel') {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.ellipse(40,46,18,8,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#A0522D';
    ctx.beginPath(); ctx.moveTo(22,30);ctx.lineTo(58,30);ctx.lineTo(58,46);ctx.lineTo(22,46);ctx.closePath();ctx.fill();
    ctx.strokeStyle = '#5D3A1A'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(22,34);ctx.lineTo(58,34);ctx.stroke();
    ctx.beginPath(); ctx.moveTo(22,42);ctx.lineTo(58,42);ctx.stroke();
    ctx.fillStyle = '#CD853F';
    ctx.beginPath(); ctx.ellipse(40,30,18,8,0,0,Math.PI*2);ctx.fill();
  } else if (type === 'bench') {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.moveTo(4,36);ctx.lineTo(40,18);ctx.lineTo(76,36);ctx.lineTo(40,54);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#A0522D';
    ctx.beginPath(); ctx.moveTo(4,36);ctx.lineTo(4,26);ctx.lineTo(40,8);ctx.lineTo(40,18);ctx.closePath();ctx.fill();
    ctx.strokeStyle = '#5D3A1A'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(14,42);ctx.lineTo(14,64);ctx.stroke();
    ctx.beginPath(); ctx.moveTo(40,48);ctx.lineTo(40,68);ctx.stroke();
    ctx.beginPath(); ctx.moveTo(66,42);ctx.lineTo(66,64);ctx.stroke();
  } else if (type === 'fireplace') {
    ctx.fillStyle = '#696969';
    ctx.beginPath(); ctx.moveTo(8,32);ctx.lineTo(40,16);ctx.lineTo(72,32);ctx.lineTo(72,56);ctx.lineTo(40,72);ctx.lineTo(40,48);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#808080';
    ctx.beginPath(); ctx.moveTo(8,32);ctx.lineTo(40,16);ctx.lineTo(40,40);ctx.lineTo(8,56);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.moveTo(24,36);ctx.lineTo(40,28);ctx.lineTo(56,36);ctx.lineTo(56,48);ctx.lineTo(40,56);ctx.lineTo(24,48);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#ff4500';
    ctx.beginPath(); ctx.moveTo(32,44);ctx.lineTo(36,36);ctx.lineTo(40,44);ctx.lineTo(44,36);ctx.lineTo(48,44);ctx.lineTo(40,52);ctx.closePath();ctx.fill();
  } else if (type === 'chandelier') {
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.moveTo(36,20);ctx.lineTo(44,20);ctx.lineTo(42,32);ctx.lineTo(38,32);ctx.closePath();ctx.fill();
    ctx.beginPath(); ctx.moveTo(28,28);ctx.lineTo(52,28);ctx.lineTo(48,40);ctx.lineTo(32,40);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(34,34,2,0,Math.PI*2);ctx.fill();
    ctx.beginPath(); ctx.arc(40,36,2,0,Math.PI*2);ctx.fill();
    ctx.beginPath(); ctx.arc(46,34,2,0,Math.PI*2);ctx.fill();
  } else if (type === 'neon_sign') {
    ctx.fillStyle = '#ff00ff';
    ctx.beginPath(); ctx.roundRect(20,24,40,16,4);ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('OPEN',40,36);
    ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = 8;
    ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(24,44);ctx.lineTo(24,56);ctx.stroke();
    ctx.beginPath(); ctx.moveTo(56,44);ctx.lineTo(56,56);ctx.stroke();
    ctx.shadowBlur = 0;
  } else if (type === 'window') {
    ctx.fillStyle = '#87CEEB';
    ctx.beginPath(); ctx.moveTo(24,16);ctx.lineTo(56,0);ctx.lineTo(56,40);ctx.lineTo(24,56);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(28,18);ctx.lineTo(52,6);ctx.lineTo(52,36);ctx.lineTo(28,48);ctx.closePath();ctx.fill();
    ctx.strokeStyle = '#8B4513'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(24,16);ctx.lineTo(56,0);ctx.lineTo(56,40);ctx.lineTo(24,56);ctx.closePath();ctx.stroke();
    ctx.beginPath(); ctx.moveTo(40,8);ctx.lineTo(40,48);ctx.stroke();
    ctx.beginPath(); ctx.moveTo(24,28);ctx.lineTo(56,12);ctx.stroke();
  } else if (type === 'door') {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.moveTo(24,16);ctx.lineTo(48,4);ctx.lineTo(48,52);ctx.lineTo(24,64);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#A0522D';
    ctx.beginPath(); ctx.moveTo(24,16);ctx.lineTo(24,64);ctx.lineTo(32,60);ctx.lineTo(32,20);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(44,30,3,0,Math.PI*2);ctx.fill();
  } else if (type === 'stove') {
    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath(); ctx.moveTo(20,28);ctx.lineTo(48,14);ctx.lineTo(60,20);ctx.lineTo(60,52);ctx.lineTo(32,66);ctx.lineTo(32,34);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#E0E0E0';
    ctx.beginPath(); ctx.moveTo(20,28);ctx.lineTo(48,14);ctx.lineTo(48,46);ctx.lineTo(20,60);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(34,28,4,0,Math.PI*2);ctx.fill();
    ctx.beginPath(); ctx.arc(42,24,4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#ff4500';
    ctx.fillRect(28,40,8,12);
  } else if (type === 'dresser') {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.moveTo(8,32);ctx.lineTo(40,16);ctx.lineTo(72,32);ctx.lineTo(72,52);ctx.lineTo(40,68);ctx.lineTo(40,48);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#A0522D';
    ctx.beginPath(); ctx.moveTo(8,32);ctx.lineTo(40,16);ctx.lineTo(40,36);ctx.lineTo(8,52);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(22,28,6,4);
    ctx.fillRect(22,40,6,4);
  } else if (type === 'wardrobe') {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.moveTo(24,20);ctx.lineTo(48,8);ctx.lineTo(56,12);ctx.lineTo(56,56);ctx.lineTo(32,68);ctx.lineTo(32,24);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#A0522D';
    ctx.beginPath(); ctx.moveTo(24,20);ctx.lineTo(48,8);ctx.lineTo(48,52);ctx.lineTo(24,64);ctx.closePath();ctx.fill();
    ctx.strokeStyle = '#5D3A1A'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(36,14);ctx.lineTo(36,60);ctx.stroke();
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(32,36,2,0,Math.PI*2);ctx.fill();
    ctx.beginPath(); ctx.arc(40,32,2,0,Math.PI*2);ctx.fill();
  } else if (type === 'sink') {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(24,28);ctx.lineTo(48,16);ctx.lineTo(56,20);ctx.lineTo(56,48);ctx.lineTo(32,60);ctx.lineTo(32,32);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#E0E0E0';
    ctx.beginPath(); ctx.moveTo(24,28);ctx.lineTo(48,16);ctx.lineTo(48,44);ctx.lineTo(24,56);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath(); ctx.arc(36,32,5,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle = '#999'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(36,32,5,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle = '#87CEEB';
    ctx.beginPath(); ctx.arc(36,32,3,0,Math.PI*2);ctx.fill();
  } else if (type === 'toilet') {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(28,32);ctx.lineTo(48,22);ctx.lineTo(54,26);ctx.lineTo(54,50);ctx.lineTo(34,60);ctx.lineTo(34,36);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#E8E8E8';
    ctx.beginPath(); ctx.moveTo(28,32);ctx.lineTo(48,22);ctx.lineTo(48,46);ctx.lineTo(28,56);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath(); ctx.ellipse(38,24,8,4,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#87CEEB';
    ctx.beginPath(); ctx.arc(38,24,4,0,Math.PI*2);ctx.fill();
  } else if (type === 'bathtub') {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(8,32);ctx.lineTo(40,16);ctx.lineTo(72,32);ctx.lineTo(72,48);ctx.lineTo(40,64);ctx.lineTo(40,48);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#E8E8E8';
    ctx.beginPath(); ctx.moveTo(8,32);ctx.lineTo(40,16);ctx.lineTo(40,32);ctx.lineTo(8,48);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath(); ctx.moveTo(16,36);ctx.lineTo(36,26);ctx.lineTo(36,38);ctx.lineTo(16,48);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#87CEEB';
    ctx.beginPath(); ctx.moveTo(20,38);ctx.lineTo(32,32);ctx.lineTo(32,38);ctx.lineTo(20,44);ctx.closePath();ctx.fill();
  } else if (type === 'pet_bed') {
    ctx.fillStyle = '#FF69B4';
    ctx.beginPath(); ctx.moveTo(16,36);ctx.lineTo(40,24);ctx.lineTo(64,36);ctx.lineTo(64,48);ctx.lineTo(40,60);ctx.lineTo(40,48);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#FFB6C1';
    ctx.beginPath(); ctx.moveTo(16,36);ctx.lineTo(40,24);ctx.lineTo(40,36);ctx.lineTo(16,48);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(30,38,3,0,Math.PI*2);ctx.fill();
    ctx.beginPath(); ctx.arc(50,38,3,0,Math.PI*2);ctx.fill();
  } else if (type === 'food_bowl') {
    ctx.fillStyle = '#FF6347';
    ctx.beginPath(); ctx.moveTo(28,36);ctx.lineTo(44,28);ctx.lineTo(52,32);ctx.lineTo(52,44);ctx.lineTo(36,52);ctx.lineTo(36,40);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#FF4500';
    ctx.beginPath(); ctx.moveTo(28,36);ctx.lineTo(44,28);ctx.lineTo(44,40);ctx.lineTo(28,48);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.arc(36,34,4,0,Math.PI*2);ctx.fill();
  } else if (type === 'laptop') {
    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath(); ctx.moveTo(24,32);ctx.lineTo(48,20);ctx.lineTo(56,24);ctx.lineTo(56,44);ctx.lineTo(32,56);ctx.lineTo(32,36);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.moveTo(28,30);ctx.lineTo(48,20);ctx.lineTo(48,36);ctx.lineTo(28,46);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#66ccff';
    ctx.fillRect(30,28,12,10);
  } else if (type === 'phone') {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.moveTo(32,28);ctx.lineTo(48,20);ctx.lineTo(52,22);ctx.lineTo(52,44);ctx.lineTo(36,52);ctx.lineTo(36,30);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#A0522D';
    ctx.beginPath(); ctx.moveTo(32,28);ctx.lineTo(48,20);ctx.lineTo(48,42);ctx.lineTo(32,50);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath(); ctx.arc(40,30,4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(40,30,2,0,Math.PI*2);ctx.fill();
  } else if (type === 'radio') {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.moveTo(24,28);ctx.lineTo(48,16);ctx.lineTo(56,20);ctx.lineTo(56,48);ctx.lineTo(32,60);ctx.lineTo(32,32);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#A0522D';
    ctx.beginPath(); ctx.moveTo(24,28);ctx.lineTo(48,16);ctx.lineTo(48,44);ctx.lineTo(24,56);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath(); ctx.arc(36,28,5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#333';
    ctx.fillRect(30,36,12,4);
    ctx.fillStyle = '#0f0';
    ctx.fillRect(32,38,2,2);
  } else if (type === 'guitar') {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.moveTo(36,16);ctx.lineTo(44,12);ctx.lineTo(48,48);ctx.lineTo(40,52);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#D2691E';
    ctx.beginPath(); ctx.ellipse(36,46,8,10,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(36,46,3,0,Math.PI*2);ctx.fill();
  } else if (type === 'easel') {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.moveTo(28,24);ctx.lineTo(32,20);ctx.lineTo(36,56);ctx.lineTo(32,60);ctx.closePath();ctx.fill();
    ctx.beginPath(); ctx.moveTo(44,24);ctx.lineTo(48,20);ctx.lineTo(44,56);ctx.lineTo(40,60);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(20,28);ctx.lineTo(56,12);ctx.lineTo(56,40);ctx.lineTo(20,56);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#3498DB';
    ctx.beginPath(); ctx.arc(32,32,6,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#2ECC71';
    ctx.beginPath(); ctx.arc(44,28,4,0,Math.PI*2);ctx.fill();
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(8,38);ctx.lineTo(40,22);ctx.lineTo(72,38);ctx.lineTo(40,54);ctx.closePath();ctx.stroke();
  return c;
}

export function getFurnitureAsset(type) {
  if (!Assets.furniture[type]) Assets.furniture[type] = createFurnitureCanvas(type);
  return Assets.furniture[type];
}

// --- Tile & Wall Patterns ---
export function getTilePattern(floorType) {
  if (Assets.tiles[floorType]) return Assets.tiles[floorType];
  const c = document.createElement('canvas');
  c.width = TILE_W; c.height = TILE_H;
  const ctx = c.getContext('2d');
  const colors = {
    wood: ['#C19A6B', '#A08055'],
    carpet: ['#8B4513', '#7A3A0D'],
    tile: ['#D3D3D3', '#BEBEBE'],
    grass: ['#7CFC00', '#66CC00'],
    sand: ['#F4A460', '#E39350'],
    ice: ['#E0FFFF', '#CAE9EA'],
    marble: ['#F5F5F5', '#E8E8E8'],
    stone: ['#808080', '#707070'],
    lava: ['#FF4500', '#CC3700'],
    space: ['#191970', '#0D0D3A'],
  };
  const [c1, c2] = colors[floorType] || colors.wood;
  ctx.fillStyle = c1;
  ctx.beginPath();
  ctx.moveTo(0, TILE_H / 2); ctx.lineTo(TILE_W / 2, 0);
  ctx.lineTo(TILE_W, TILE_H / 2); ctx.lineTo(TILE_W / 2, TILE_H);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = c2;
  ctx.beginPath();
  ctx.moveTo(0, TILE_H / 2); ctx.lineTo(TILE_W / 2, TILE_H);
  ctx.lineTo(TILE_W / 2, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, TILE_H / 2); ctx.lineTo(TILE_W / 2, 0);
  ctx.lineTo(TILE_W, TILE_H / 2); ctx.lineTo(TILE_W / 2, TILE_H);
  ctx.closePath(); ctx.stroke();
  Assets.tiles[floorType] = c;
  return c;
}

export function getWallPattern(wallColor) {
  const key = 'wall_' + wallColor;
  if (Assets.tiles[key]) return Assets.tiles[key];
  const c = document.createElement('canvas');
  c.width = TILE_W; c.height = WALL_H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = wallColor;
  ctx.fillRect(0, 0, TILE_W, WALL_H);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, 0, TILE_W / 2, WALL_H);
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(TILE_W / 2, 0, TILE_W / 2, WALL_H);
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(TILE_W / 2, 0); ctx.lineTo(TILE_W / 2, WALL_H);
  ctx.stroke();
  Assets.tiles[key] = c;
  return c;
}

// --- Scenery Generator ---
export function createSceneryCanvas(type) {
  const c = document.createElement('canvas');
  c.width = 120; c.height = 120;
  const ctx = c.getContext('2d');
  if (type === 'tree') {
    ctx.fillStyle = '#5D3A1A';
    ctx.beginPath(); ctx.moveTo(52,72);ctx.lineTo(68,72);ctx.lineTo(64,100);ctx.lineTo(56,100);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#228B22';
    ctx.beginPath(); ctx.ellipse(60,52,28,36,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#32CD32';
    ctx.beginPath(); ctx.ellipse(54,44,16,24,-0.3,0,Math.PI*2);ctx.fill();
    ctx.beginPath(); ctx.ellipse(68,48,14,20,0.3,0,Math.PI*2);ctx.fill();
  } else if (type === 'bush') {
    ctx.fillStyle = '#228B22';
    ctx.beginPath(); ctx.arc(48,72,16,0,Math.PI*2);ctx.fill();
    ctx.beginPath(); ctx.arc(72,72,14,0,Math.PI*2);ctx.fill();
    ctx.beginPath(); ctx.arc(60,56,18,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#32CD32';
    ctx.beginPath(); ctx.arc(56,60,10,0,Math.PI*2);ctx.fill();
  } else if (type === 'flower') {
    ctx.fillStyle = '#228B22';
    ctx.fillRect(58,72,4,20);
    ctx.fillStyle = '#FF69B4';
    for(let i=0;i<5;i++){
      const a=(i/5)*Math.PI*2;
      ctx.beginPath(); ctx.arc(60+Math.cos(a)*6,64+Math.sin(a)*6,5,0,Math.PI*2);ctx.fill();
    }
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(60,64,4,0,Math.PI*2);ctx.fill();
  } else if (type === 'rock') {
    ctx.fillStyle = '#808080';
    ctx.beginPath(); ctx.ellipse(60,80,20,12,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#A9A9A9';
    ctx.beginPath(); ctx.ellipse(56,76,10,6,-0.3,0,Math.PI*2);ctx.fill();
  } else if (type === 'palm') {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.moveTo(56,68);ctx.lineTo(64,68);ctx.lineTo(62,100);ctx.lineTo(58,100);ctx.closePath();ctx.fill();
    ctx.strokeStyle = '#228B22'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for(let i=0;i<5;i++){
      const a=(i/5)*Math.PI*2-Math.PI/2;
      ctx.beginPath(); ctx.moveTo(60,56);ctx.lineTo(60+Math.cos(a)*28,56+Math.sin(a)*20);ctx.stroke();
    }
    ctx.fillStyle = '#32CD32';
    ctx.beginPath(); ctx.ellipse(60,52,10,8,0,0,Math.PI*2);ctx.fill();
  } else if (type === 'cactus') {
    ctx.fillStyle = '#2E8B57';
    ctx.beginPath(); ctx.roundRect(54,40,12,44,6);ctx.fill();
    ctx.beginPath(); ctx.roundRect(42,52,10,20,5);ctx.fill();
    ctx.beginPath(); ctx.roundRect(68,48,10,18,5);ctx.fill();
    ctx.fillStyle = '#3CB371';
    ctx.beginPath(); ctx.arc(58,48,4,0,Math.PI*2);ctx.fill();
  } else if (type === 'snowman') {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(60,80,14,0,Math.PI*2);ctx.fill();
    ctx.beginPath(); ctx.arc(60,58,10,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#F4A460';
    ctx.beginPath(); ctx.moveTo(60,56);ctx.lineTo(72,54);ctx.lineTo(60,58);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(56,54,1.5,0,Math.PI*2);ctx.fill();
    ctx.beginPath(); ctx.arc(64,54,1.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#8B0000';
    ctx.fillRect(52,36,16,4);
  }
  return c;
}

export function getSceneryAsset(type) {
  const key = 'scenery_' + type;
  if (!Assets.furniture[key]) Assets.furniture[key] = createSceneryCanvas(type);
  return Assets.furniture[key];
}
