// ============================================================
// Starlight Engine — Procedural Asset Generator
// ============================================================

import { TILE_W, TILE_H, WALL_H } from '../engine/Core.js';

const Assets = { avatars: {}, furniture: {}, tiles: {} };

export function clearAvatarCache(key) { delete Assets.avatars[key]; }

export function createAvatarCanvas(skinColor, hairColor, hairStyle, shirtColor, pantsColor, shoeColor, hatType, glassesType) {
  const c = document.createElement('canvas');
  c.width = 44; c.height = 64;
  const ctx = c.getContext('2d');
  const cx = 22, cy = 20;

  // Legs
  ctx.strokeStyle = pantsColor; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 4, 42); ctx.lineTo(cx - 5, 58); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 4, 42); ctx.lineTo(cx + 5, 58); ctx.stroke();

  // Shoes
  ctx.fillStyle = shoeColor || '#333';
  ctx.beginPath(); ctx.ellipse(cx - 5, 59, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 5, 59, 4, 2, 0, 0, Math.PI * 2); ctx.fill();

  // Body
  ctx.fillStyle = shirtColor;
  ctx.beginPath();
  ctx.moveTo(cx - 10, 32); ctx.lineTo(cx + 10, 32);
  ctx.lineTo(cx + 8, 46); ctx.lineTo(cx - 8, 46);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.stroke();

  // Arms
  ctx.strokeStyle = skinColor; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 10, 34); ctx.lineTo(cx - 14, 44); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 10, 34); ctx.lineTo(cx + 14, 44); ctx.stroke();

  // Head
  ctx.fillStyle = skinColor;
  ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.fill();

  // Eyes
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(cx - 5, cy + 1, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 5, cy + 1, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx - 4, cy, 1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 6, cy, 1, 0, Math.PI * 2); ctx.fill();

  // Mouth
  ctx.strokeStyle = '#a04040'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy + 7, 4, 0.2, Math.PI - 0.2); ctx.stroke();

  // Hair
  ctx.fillStyle = hairColor;
  if (hairStyle === 'spiky') {
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy - 2); ctx.lineTo(cx - 10, cy - 18); ctx.lineTo(cx - 4, cy - 10);
    ctx.lineTo(cx, cy - 20); ctx.lineTo(cx + 4, cy - 10); ctx.lineTo(cx + 10, cy - 18);
    ctx.lineTo(cx + 14, cy - 2); ctx.lineTo(cx + 12, cy + 4); ctx.lineTo(cx - 12, cy + 4);
    ctx.closePath(); ctx.fill();
  } else if (hairStyle === 'long') {
    ctx.beginPath(); ctx.arc(cx, cy - 2, 17, Math.PI, 0);
    ctx.lineTo(cx + 17, cy + 14); ctx.lineTo(cx - 17, cy + 14); ctx.closePath(); ctx.fill();
  } else if (hairStyle === 'mohawk') {
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy - 14); ctx.lineTo(cx - 2, cy - 26);
    ctx.lineTo(cx, cy - 28); ctx.lineTo(cx + 2, cy - 26); ctx.lineTo(cx + 3, cy - 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = skinColor;
    ctx.beginPath(); ctx.arc(cx - 12, cy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 12, cy, 4, 0, Math.PI * 2); ctx.fill();
  } else if (hairStyle === 'bald') {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.arc(cx - 4, cy - 8, 4, 0, Math.PI * 2); ctx.fill();
  } else if (hairStyle === 'curly') {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI + Math.PI;
      const rx = cx + Math.cos(angle) * 14;
      const ry = cy - 4 + Math.sin(angle) * 10;
      ctx.beginPath(); ctx.arc(rx, ry, 5, 0, Math.PI * 2); ctx.fill();
    }
  } else if (hairStyle === 'bob') {
    ctx.beginPath(); ctx.arc(cx, cy - 2, 17, Math.PI, 0);
    ctx.lineTo(cx + 17, cy + 8); ctx.lineTo(cx - 17, cy + 8); ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(cx, cy - 4, 16, Math.PI, 0);
    ctx.lineTo(cx + 16, cy + 2); ctx.lineTo(cx - 16, cy + 2); ctx.closePath(); ctx.fill();
  }

  // Hat
  ctx.fillStyle = shirtColor;
  if (hatType === 'cap') {
    ctx.beginPath(); ctx.arc(cx, cy - 6, 16, Math.PI, 0); ctx.lineTo(cx + 20, cy + 2); ctx.lineTo(cx - 20, cy + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(cx - 18, cy + 2, 36, 3);
  } else if (hatType === 'beanie') {
    ctx.beginPath(); ctx.arc(cx, cy - 8, 16, Math.PI, 0); ctx.lineTo(cx + 16, cy + 4); ctx.lineTo(cx - 16, cy + 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.ellipse(cx, cy - 2, 16, 3, 0, 0, Math.PI * 2); ctx.fill();
  } else if (hatType === 'crown') {
    ctx.fillStyle = '#f4d03f';
    ctx.beginPath(); ctx.moveTo(cx - 14, cy - 2); ctx.lineTo(cx - 10, cy - 14); ctx.lineTo(cx - 4, cy - 6); ctx.lineTo(cx, cy - 16); ctx.lineTo(cx + 4, cy - 6); ctx.lineTo(cx + 10, cy - 14); ctx.lineTo(cx + 14, cy - 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f39c12'; ctx.fillRect(cx - 14, cy - 2, 28, 4);
  } else if (hatType === 'wizard') {
    ctx.fillStyle = '#4B0082';
    ctx.beginPath(); ctx.moveTo(cx - 14, cy + 2); ctx.lineTo(cx, cy - 28); ctx.lineTo(cx + 14, cy + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FFD700'; ctx.beginPath(); ctx.arc(cx, cy - 28, 3, 0, Math.PI * 2); ctx.fill();
  }

  // Glasses
  if (glassesType === 'shades') {
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.rect(cx - 11, cy - 2, 10, 6); ctx.fill();
    ctx.beginPath(); ctx.rect(cx + 1, cy - 2, 10, 6); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - 11, cy + 1); ctx.lineTo(cx - 15, cy - 1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 11, cy + 1); ctx.lineTo(cx + 15, cy - 1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 1, cy + 1); ctx.lineTo(cx + 1, cy + 1); ctx.stroke();
  } else if (glassesType === 'round') {
    ctx.strokeStyle = '#5D4037'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx - 5, cy + 1, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 5, cy + 1, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy + 1); ctx.lineTo(cx, cy + 1); ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.stroke();
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
    ctx.beginPath(); ctx.moveTo(26,26);ctx.lineTo(54,16);ctx.lineTo(51,38);ctx.lineTo(28,46);ctx.closePath();ctx.fill();
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(40,10);ctx.lineTo(32,0);ctx.stroke();
    ctx.beginPath(); ctx.moveTo(40,10);ctx.lineTo(48,0);ctx.stroke();
  } else if (type === 'rug') {
    ctx.fillStyle = '#C0392B';
    ctx.beginPath(); ctx.moveTo(8,28);ctx.lineTo(52,6);ctx.lineTo(72,22);ctx.lineTo(28,46);ctx.closePath();ctx.fill();
    ctx.strokeStyle = '#922B21'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(20,24);ctx.lineTo(44,12);ctx.stroke();
    ctx.beginPath(); ctx.moveTo(32,34);ctx.lineTo(56,20);ctx.stroke();
  } else if (type === 'sofa') {
    ctx.fillStyle = '#7D3C98';
    ctx.beginPath(); ctx.moveTo(12,38);ctx.lineTo(46,20);ctx.lineTo(68,32);ctx.lineTo(34,50);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#6C3483';
    ctx.beginPath(); ctx.moveTo(12,38);ctx.lineTo(12,20);ctx.lineTo(46,4);ctx.lineTo(46,20);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#5B2C6F';
    ctx.beginPath(); ctx.moveTo(46,20);ctx.lineTo(58,12);ctx.lineTo(58,28);ctx.lineTo(46,36);ctx.closePath();ctx.fill();
  } else if (type === 'fridge') {
    ctx.fillStyle = '#BDC3C7';
    ctx.beginPath(); ctx.moveTo(28,16);ctx.lineTo(52,4);ctx.lineTo(52,56);ctx.lineTo(28,68);ctx.closePath();ctx.fill();
    ctx.strokeStyle = '#7F8C8D'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#7F8C8D';
    ctx.fillRect(38,26,4,2); ctx.fillRect(38,42,4,2);
    ctx.fillStyle = '#E74C3C';
    ctx.beginPath(); ctx.ellipse(40,18,6,3,0,0,Math.PI*2);ctx.fill();
  } else if (type === 'bookshelf') {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.moveTo(22,12);ctx.lineTo(58,0);ctx.lineTo(58,56);ctx.lineTo(22,68);ctx.closePath();ctx.fill();
    ctx.strokeStyle = '#5D3A1A'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(22,28);ctx.lineTo(58,16);ctx.stroke();
    ctx.beginPath(); ctx.moveTo(22,44);ctx.lineTo(58,32);ctx.stroke();
    ctx.fillStyle = '#E74C3C'; ctx.fillRect(30,16,4,10);
    ctx.fillStyle = '#3498DB'; ctx.fillRect(36,14,4,12);
    ctx.fillStyle = '#2ECC71'; ctx.fillRect(42,17,4,9);
    ctx.fillStyle = '#F1C40F'; ctx.fillRect(48,15,3,11);
  } else if (type === 'fountain') {
    ctx.fillStyle = '#7f8c8d';
    ctx.beginPath(); ctx.ellipse(40,56,22,8,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#3498db';
    ctx.beginPath(); ctx.ellipse(40,54,16,6,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#95a5a6';
    ctx.fillRect(36,28,8,26);
    ctx.fillStyle = '#7f8c8d';
    ctx.beginPath(); ctx.ellipse(40,28,14,5,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#85c1e9';
    ctx.beginPath(); ctx.arc(40,22,4,0,Math.PI*2);ctx.fill();
  } else if (type === 'piano') {
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.moveTo(16,36);ctx.lineTo(56,16);ctx.lineTo(72,28);ctx.lineTo(32,48);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(20,38);ctx.lineTo(52,20);ctx.lineTo(56,24);ctx.lineTo(24,42);ctx.closePath();ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(24,44);ctx.lineTo(24,64);ctx.stroke();
    ctx.beginPath(); ctx.moveTo(56,24);ctx.lineTo(56,44);ctx.stroke();
  } else if (type === 'dragon') {
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath(); ctx.ellipse(40,40,14,10,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#27ae60';
    ctx.beginPath(); ctx.arc(28,32,10,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(24,30,3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.arc(24,30,1.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#229954';
    ctx.beginPath(); ctx.moveTo(38,34);ctx.lineTo(56,20);ctx.lineTo(58,36);ctx.closePath();ctx.fill();
    ctx.strokeStyle = '#27ae60'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(52,42);ctx.quadraticCurveTo(64,48,60,56);ctx.stroke();
  } else if (type === 'statue') {
    ctx.fillStyle = '#ddd';
    ctx.beginPath(); ctx.moveTo(30,60); ctx.lineTo(50,60); ctx.lineTo(48,68); ctx.lineTo(32,68); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#bbb';
    ctx.beginPath(); ctx.ellipse(40,60,10,4,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#e0e0e0';
    ctx.beginPath(); ctx.ellipse(40,36,14,22,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ccc';
    ctx.beginPath(); ctx.ellipse(36,30,4,6,-0.3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#d4af37';
    ctx.beginPath(); ctx.arc(40,18,5,0,Math.PI*2); ctx.fill();
  } else if (type === 'clock') {
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(32,12,16,56);
    ctx.fillStyle = '#3E2723';
    ctx.fillRect(30,10,20,6);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(40,32,10,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(40,32); ctx.lineTo(40,25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(40,32); ctx.lineTo(44,32); ctx.stroke();
    ctx.fillStyle = '#d4af37';
    ctx.beginPath(); ctx.arc(40,32,2,0,Math.PI*2); ctx.fill();
  } else if (type === 'chest') {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.moveTo(16,40); ctx.lineTo(40,28); ctx.lineTo(64,40); ctx.lineTo(40,52); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#A0522D';
    ctx.beginPath(); ctx.moveTo(16,40); ctx.lineTo(16,56); ctx.lineTo(40,68); ctx.lineTo(40,52); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6D4C41';
    ctx.beginPath(); ctx.moveTo(64,40); ctx.lineTo(64,56); ctx.lineTo(40,68); ctx.lineTo(40,52); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(40,40); ctx.lineTo(40,52); ctx.stroke();
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(40,46,3,0,Math.PI*2); ctx.fill();
  } else if (type === 'mirror') {
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(34,8,12,56);
    ctx.fillStyle = '#E8E8E8';
    ctx.fillRect(36,10,8,52);
    ctx.fillStyle = '#87CEEB';
    ctx.globalAlpha = 0.3;
    ctx.fillRect(36,10,8,52);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#A9A9A9';
    ctx.beginPath(); ctx.ellipse(40,66,10,4,0,0,Math.PI*2); ctx.fill();
  } else if (type === 'vase') {
    ctx.fillStyle = '#3498DB';
    ctx.beginPath(); ctx.moveTo(34,56); ctx.lineTo(46,56); ctx.lineTo(48,40); ctx.lineTo(44,30); ctx.lineTo(44,20); ctx.lineTo(36,20); ctx.lineTo(36,30); ctx.lineTo(32,40); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2980B9';
    ctx.beginPath(); ctx.ellipse(40,56,8,3,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#1ABC9C'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(36,36); ctx.lineTo(44,44); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(44,36); ctx.lineTo(36,44); ctx.stroke();
  } else if (type === 'trophy') {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.moveTo(34,58); ctx.lineTo(46,58); ctx.lineTo(44,66); ctx.lineTo(36,66); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(40,38,12,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#F1C40F';
    ctx.beginPath(); ctx.arc(40,38,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#D4AC0D';
    ctx.beginPath(); ctx.moveTo(28,38); ctx.lineTo(40,20); ctx.lineTo(52,38); ctx.lineTo(40,30); ctx.closePath(); ctx.fill();
  } else if (type === 'jukebox') {
    ctx.fillStyle = '#C0392B';
    ctx.fillRect(22,16,36,44);
    ctx.fillStyle = '#922B21';
    ctx.fillRect(26,20,28,28);
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(40,34,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#2ECC71';
    ctx.fillRect(28,52,6,4);
    ctx.fillStyle = '#3498DB';
    ctx.fillRect(36,52,6,4);
    ctx.fillStyle = '#E74C3C';
    ctx.fillRect(44,52,6,4);
  } else if (type === 'arcade') {
    ctx.fillStyle = '#2C3E50';
    ctx.fillRect(24,12,32,48);
    ctx.fillStyle = '#111';
    ctx.fillRect(28,16,24,20);
    ctx.fillStyle = '#66ccff';
    ctx.fillRect(30,18,20,16);
    ctx.fillStyle = '#E74C3C';
    ctx.beginPath(); ctx.arc(36,44,4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#3498DB';
    ctx.fillRect(44,40,4,8);
  } else if (type === 'barrel') {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.ellipse(40,56,16,6,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#A0522D';
    ctx.fillRect(24,28,32,28);
    ctx.fillStyle = '#5D4037';
    ctx.beginPath(); ctx.ellipse(40,28,16,6,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(24,36); ctx.lineTo(56,36); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(24,48); ctx.lineTo(56,48); ctx.stroke();
  } else if (type === 'bench') {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.moveTo(12,36); ctx.lineTo(68,12); ctx.lineTo(72,18); ctx.lineTo(16,42); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5D4037';
    ctx.beginPath(); ctx.moveTo(12,36); ctx.lineTo(12,44); ctx.lineTo(16,48); ctx.lineTo(16,42); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#555';
    ctx.fillRect(16,44,4,16); ctx.fillRect(64,20,4,16);
  } else if (type === 'fireplace') {
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(20,16,40,44);
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.arc(40,44,10,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath(); ctx.moveTo(34,48); ctx.lineTo(38,36); ctx.lineTo(42,42); ctx.lineTo(46,32); ctx.lineTo(48,48); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255, 200, 50, 0.4)';
    ctx.beginPath(); ctx.arc(40,40,14,0,Math.PI*2); ctx.fill();
  } else if (type === 'chandelier') {
    ctx.strokeStyle = '#B8860B'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(40,8); ctx.lineTo(40,28); ctx.stroke();
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.ellipse(40,32,18,6,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#B8860B';
    ctx.beginPath(); ctx.moveTo(28,32); ctx.lineTo(26,48); ctx.lineTo(30,48); ctx.lineTo(32,32); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(40,32); ctx.lineTo(40,52); ctx.lineTo(44,52); ctx.lineTo(44,32); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(52,32); ctx.lineTo(54,48); ctx.lineTo(50,48); ctx.lineTo(48,32); ctx.closePath(); ctx.fill();
  } else if (type === 'neon_sign') {
    ctx.fillStyle = '#222';
    ctx.fillRect(18,20,44,28);
    ctx.fillStyle = '#ff00ff';
    ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
    ctx.fillText('OPEN', 40, 38);
    ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = 12;
    ctx.fillText('OPEN', 40, 38);
    ctx.shadowBlur = 0;
  } else if (type === 'window') {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(24,16,32,40);
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(28,20,24,28);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(40,20); ctx.lineTo(40,48); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(28,34); ctx.lineTo(52,34); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.3;
    ctx.fillRect(28,20,10,28); ctx.globalAlpha = 1;
  } else if (type === 'door') {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(26,12,28,52);
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(30,16,20,44);
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(46,40,3,0,Math.PI*2); ctx.fill();
  } else if (type === 'stove') {
    ctx.fillStyle = '#BDC3C7';
    ctx.fillRect(24,20,32,40);
    ctx.fillStyle = '#7F8C8D';
    ctx.fillRect(28,24,24,20);
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(34,30,3,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(46,30,3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#E74C3C';
    ctx.fillRect(28,48,24,8);
  } else if (type === 'dresser') {
    ctx.fillStyle = '#A0522D';
    ctx.fillRect(22,20,36,40);
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(24,24,32,10);
    ctx.fillRect(24,36,32,10);
    ctx.fillRect(24,48,32,10);
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(40,29,2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(40,41,2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(40,53,2,0,Math.PI*2); ctx.fill();
  } else if (type === 'wardrobe') {
    ctx.fillStyle = '#6D4C41';
    ctx.fillRect(24,12,32,52);
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(38,14,2,48);
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(34,38,2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(44,38,2,0,Math.PI*2); ctx.fill();
  } else if (type === 'sink') {
    ctx.fillStyle = '#ECF0F1';
    ctx.fillRect(26,28,28,24);
    ctx.fillStyle = '#BDC3C7';
    ctx.beginPath(); ctx.ellipse(40,32,10,4,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#7F8C8D'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(40,28); ctx.lineTo(40,18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(38,20); ctx.lineTo(42,20); ctx.stroke();
  } else if (type === 'toilet') {
    ctx.fillStyle = '#ECF0F1';
    ctx.beginPath(); ctx.ellipse(40,52,12,6,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#BDC3C7';
    ctx.fillRect(34,24,12,28);
    ctx.fillStyle = '#ECF0F1';
    ctx.beginPath(); ctx.ellipse(40,24,10,4,0,0,Math.PI*2); ctx.fill();
  } else if (type === 'bathtub') {
    ctx.fillStyle = '#ECF0F1';
    ctx.beginPath(); ctx.moveTo(16,40); ctx.lineTo(64,16); ctx.lineTo(68,24); ctx.lineTo(20,48); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#BDC3C7';
    ctx.beginPath(); ctx.moveTo(16,40); ctx.lineTo(16,52); ctx.lineTo(20,56); ctx.lineTo(20,48); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#85C1E9';
    ctx.beginPath(); ctx.moveTo(20,44); ctx.lineTo(64,22); ctx.lineTo(62,28); ctx.lineTo(22,48); ctx.closePath(); ctx.fill();
  } else if (type === 'pet_bed') {
    ctx.fillStyle = '#E74C3C';
    ctx.beginPath(); ctx.ellipse(40,48,18,10,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#C0392B';
    ctx.beginPath(); ctx.ellipse(40,46,14,7,0,0,Math.PI*2); ctx.fill();
  } else if (type === 'food_bowl') {
    ctx.fillStyle = '#3498DB';
    ctx.beginPath(); ctx.moveTo(28,44); ctx.lineTo(52,44); ctx.lineTo(48,54); ctx.lineTo(32,54); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#85C1E9';
    ctx.beginPath(); ctx.ellipse(40,44,10,3,0,0,Math.PI*2); ctx.fill();
  } else if (type === 'laptop') {
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.moveTo(24,44); ctx.lineTo(56,28); ctx.lineTo(58,32); ctx.lineTo(26,48); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.moveTo(26,42); ctx.lineTo(54,28); ctx.lineTo(54,22); ctx.lineTo(26,36); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#66ccff';
    ctx.fillRect(28,30,24,10);
  } else if (type === 'phone') {
    ctx.fillStyle = '#C0392B';
    ctx.beginPath(); ctx.arc(40,44,10,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#E74C3C';
    ctx.beginPath(); ctx.arc(40,44,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(40,40,2,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(40,44,8,-Math.PI*0.8,-Math.PI*0.2); ctx.stroke();
  } else if (type === 'radio') {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(26,32,28,20);
    ctx.fillStyle = '#333';
    ctx.fillRect(30,36,20,10);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(40,32); ctx.lineTo(40,20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(38,22); ctx.lineTo(42,22); ctx.stroke();
  } else if (type === 'guitar') {
    ctx.fillStyle = '#D35400';
    ctx.beginPath(); ctx.ellipse(40,46,10,14,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#A04000';
    ctx.fillRect(38,16,4,30);
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(40,16,5,0,Math.PI*2); ctx.fill();
  } else if (type === 'easel') {
    ctx.strokeStyle = '#8B4513'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(30,60); ctx.lineTo(40,20); ctx.lineTo(50,60); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(34,44); ctx.lineTo(46,44); ctx.stroke();
    ctx.fillStyle = '#FDFEFE';
    ctx.fillRect(30,22,20,24);
    ctx.fillStyle = '#3498DB';
    ctx.beginPath(); ctx.arc(40,34,5,0,Math.PI*2); ctx.fill();
  }
  return c;
}

export function createSceneryCanvas(type) {
  const c = document.createElement('canvas');
  c.width = 80; c.height = 80;
  const ctx = c.getContext('2d');
  if (type === 'palm_tree') {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(36,32,8,36);
    ctx.fillStyle = '#228B22';
    ctx.beginPath(); ctx.arc(40,28,18,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#32CD32';
    ctx.beginPath(); ctx.ellipse(28,20,10,5,-0.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(52,20,10,5,0.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(40,12,8,4,0,0,Math.PI*2); ctx.fill();
  } else if (type === 'rock') {
    ctx.fillStyle = '#7f8c8d';
    ctx.beginPath(); ctx.ellipse(40,56,16,10,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#95a5a6';
    ctx.beginPath(); ctx.ellipse(36,50,10,8,0,0,Math.PI*2); ctx.fill();
  } else if (type === 'bush') {
    ctx.fillStyle = '#228B22';
    ctx.beginPath(); ctx.ellipse(40,52,18,12,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#32CD32';
    ctx.beginPath(); ctx.ellipse(32,44,10,10,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(48,44,10,10,0,0,Math.PI*2); ctx.fill();
  } else if (type === 'flower_patch') {
    ctx.fillStyle = '#27AE60';
    ctx.beginPath(); ctx.ellipse(40,56,14,8,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#E74C3C'; ctx.beginPath(); ctx.arc(34,50,4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#F1C40F'; ctx.beginPath(); ctx.arc(42,46,4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#9B59B6'; ctx.beginPath(); ctx.arc(48,54,4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(34,50,1.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(42,46,1.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(48,54,1.5,0,Math.PI*2); ctx.fill();
  } else if (type === 'bookshelf_wall') {
    ctx.fillStyle = '#6D4C41';
    ctx.fillRect(16,20,48,40);
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(18,22,44,10); ctx.fillRect(18,34,44,10); ctx.fillRect(18,46,44,10);
    ctx.fillStyle = '#E74C3C'; ctx.fillRect(22,24,3,6);
    ctx.fillStyle = '#3498DB'; ctx.fillRect(28,24,3,6);
    ctx.fillStyle = '#2ECC71'; ctx.fillRect(34,36,3,6);
    ctx.fillStyle = '#F1C40F'; ctx.fillRect(40,48,3,6);
  } else if (type === 'chalkboard') {
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(18,16,44,32);
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(22,20,36,24);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(26,28); ctx.lineTo(54,28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(26,36); ctx.lineTo(48,36); ctx.stroke();
  } else if (type === 'life_preserver') {
    ctx.strokeStyle = '#E74C3C'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(40,40,14,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(40,40,14,0.2,Math.PI*0.8); ctx.stroke();
    ctx.beginPath(); ctx.arc(40,40,14,Math.PI*1.2,Math.PI*1.8); ctx.stroke();
  } else if (type === 'umbrella') {
    ctx.strokeStyle = '#8B4513'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(40,56); ctx.lineTo(40,28); ctx.stroke();
    ctx.fillStyle = '#E74C3C';
    ctx.beginPath(); ctx.arc(40,28,18,Math.PI,0); ctx.lineTo(58,28); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#F1C40F';
    ctx.beginPath(); ctx.arc(36,28,6,Math.PI,0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(48,28,6,Math.PI,0); ctx.closePath(); ctx.fill();
  } else if (type === 'streetlamp') {
    ctx.fillStyle = '#2C3E50';
    ctx.fillRect(38,28,4,36);
    ctx.fillStyle = '#F1C40F';
    ctx.beginPath(); ctx.arc(40,24,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,200,0.3)';
    ctx.beginPath(); ctx.arc(40,24,16,0,Math.PI*2); ctx.fill();
  } else if (type === 'neon_light') {
    ctx.fillStyle = '#222';
    ctx.fillRect(20,24,40,24);
    ctx.fillStyle = '#ff00ff';
    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
    ctx.fillText('CLUB', 40, 40);
    ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = 10;
    ctx.fillText('CLUB', 40, 40);
    ctx.shadowBlur = 0;
  } else if (type === 'poster') {
    ctx.fillStyle = '#eee';
    ctx.fillRect(24,16,32,40);
    ctx.fillStyle = '#E74C3C';
    ctx.fillRect(28,20,24,14);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('NOW', 40, 30);
    ctx.fillStyle = '#333';
    ctx.fillRect(28,36,24,16);
  } else if (type === 'arcade_machine') {
    ctx.fillStyle = '#2C3E50';
    ctx.fillRect(24,12,32,52);
    ctx.fillStyle = '#111';
    ctx.fillRect(28,16,24,24);
    ctx.fillStyle = '#2ECC71';
    ctx.fillRect(30,18,20,20);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
    ctx.fillText('PLAY', 40, 32);
  } else if (type === 'dining_table') {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(40,48,20,10,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(36,48,8,14);
  } else if (type === 'spa_plant') {
    ctx.fillStyle = '#D2691E';
    ctx.beginPath(); ctx.ellipse(40,56,10,5,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1ABC9C';
    ctx.beginPath(); ctx.ellipse(40,38,14,18,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#16A085';
    ctx.beginPath(); ctx.ellipse(34,30,8,12,-0.3,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(46,34,7,11,0.3,0,Math.PI*2); ctx.fill();
  } else if (type === 'lobby_desk') {
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(16,32,48,24);
    ctx.fillStyle = '#8D6E63';
    ctx.fillRect(18,34,44,8);
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(40,42,3,0,Math.PI*2); ctx.fill();
  }
  return c;
}

export function getFurnitureAsset(type) {
  if (!Assets.furniture[type]) Assets.furniture[type] = createFurnitureCanvas(type);
  return Assets.furniture[type];
}

// --- Tile & Wall Patterns ---
export function getTilePattern(type) {
  if (Assets.tiles[type]) return Assets.tiles[type];
  const c = document.createElement('canvas');
  c.width = TILE_W + 2; c.height = TILE_H + 2;
  const ctx = c.getContext('2d');
  const colors = {
    wood: '#C19A6B', tile: '#ECF0F1', carpet: '#A93226',
    grass: '#58D68D', sand: '#F9E79F', stone: '#AAB7B8',
    water: '#5DADE2', marble: '#F4F6F7',
    darkwood: '#5D4037', checkered: '#E74C3C'
  };
  ctx.fillStyle = colors[type] || colors.wood;
  ctx.beginPath();
  ctx.moveTo(1, TILE_H / 2 + 1);
  ctx.lineTo(TILE_W / 2 + 1, 1);
  ctx.lineTo(TILE_W + 1, TILE_H / 2 + 1);
  ctx.lineTo(TILE_W / 2 + 1, TILE_H + 1);
  ctx.closePath(); ctx.fill();

  if (type === 'wood') {
    ctx.strokeStyle = 'rgba(139,105,20,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(TILE_W / 2, 4); ctx.lineTo(TILE_W / 2, TILE_H - 2); ctx.stroke();
  } else if (type === 'tile') {
    ctx.strokeStyle = 'rgba(149,165,166,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(TILE_W / 4, TILE_H / 4); ctx.lineTo(TILE_W * 3 / 4, TILE_H * 3 / 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(TILE_W * 3 / 4, TILE_H / 4); ctx.lineTo(TILE_W / 4, TILE_H * 3 / 4); ctx.stroke();
  } else if (type === 'checkered') {
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.moveTo(TILE_W / 2 + 1, 1); ctx.lineTo(TILE_W * 3 / 4, TILE_H / 4);
    ctx.lineTo(TILE_W / 2 + 1, TILE_H / 2); ctx.lineTo(TILE_W / 4, TILE_H / 4); ctx.closePath(); ctx.fill();
  } else if (type === 'marble') {
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(TILE_W / 3, TILE_H / 3); ctx.lineTo(TILE_W * 2 / 3, TILE_H / 3); ctx.stroke();
  }
  Assets.tiles[type] = c;
  return c;
}

export function getWallPattern(color) {
  const key = 'wall_' + color;
  if (Assets.tiles[key]) return Assets.tiles[key];
  const c = document.createElement('canvas');
  c.width = TILE_W / 2 + 2; c.height = WALL_H + TILE_H / 2 + 2;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(1, WALL_H + 1); ctx.lineTo(1, 1);
  ctx.lineTo(TILE_W / 2 + 1, TILE_H / 2 + 1);
  ctx.lineTo(TILE_W / 2 + 1, WALL_H + TILE_H / 2 + 1);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(1, 1); ctx.lineTo(TILE_W / 2 + 1, TILE_H / 2 + 1); ctx.stroke();
  Assets.tiles[key] = c;
  return c;
}
