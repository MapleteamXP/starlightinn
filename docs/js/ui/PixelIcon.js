/**
 * PixelIcon.js — v8.0 Pixel Art UI Icons
 * 8-bit style icons for HUD panels and buttons.
 */
export class PixelIcon {
  constructor(size = 20) {
    this.size = size;
    this.cache = new Map();
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d');
  }

  get(name) {
    if (this.cache.has(name)) return this.cache.get(name);
    const s = this.size;
    const c = this.ctx;
    c.clearRect(0, 0, s, s);
    c.imageSmoothingEnabled = false;

    const colors = {
      star: '#f1c40f', heart: '#e74c3c', coin: '#f1c40f', bag: '#8e44ad',
      gear: '#95a5a6', chat: '#3498db', map: '#2ecc71', group: '#e67e22',
      shop: '#f39c12', scroll: '#d35400', bell: '#f1c40f', game: '#9b59b6',
      settings: '#95a5a6', friends: '#2ecc71', inventory: '#8e44ad', close: '#e74c3c',
    };

    const draw = ICONS[name] || ICONS.default;
    draw(c, s, colors[name] || '#fff');

    const url = this.canvas.toDataURL();
    this.cache.set(name, url);
    return url;
  }

  injectButton(btnId, iconName) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.innerHTML = `<img src="${this.get(iconName)}" class="pixel-icon" style="width:${this.size}px;height:${this.size}px;" alt="">`;
  }
}

const ICONS = {
  star: (c, s, col) => {
    const h = s / 2;
    c.fillStyle = col;
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI / 5) - Math.PI / 2;
      const r = i % 2 === 0 ? h * 0.9 : h * 0.4;
      c.lineTo(h + Math.cos(a) * r, h + Math.sin(a) * r);
    }
    c.closePath(); c.fill();
  },
  heart: (c, s, col) => {
    const h = s / 2;
    c.fillStyle = col;
    c.beginPath();
    c.arc(h * 0.6, h * 0.55, h * 0.35, 0, Math.PI * 2);
    c.arc(h * 1.4, h * 0.55, h * 0.35, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(h * 0.25, h * 0.75);
    c.lineTo(h, s * 0.9);
    c.lineTo(h * 1.75, h * 0.75);
    c.fill();
  },
  coin: (c, s, col) => {
    const h = s / 2;
    c.fillStyle = col;
    c.beginPath(); c.arc(h, h, h * 0.8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff';
    c.font = `bold ${Math.floor(s * 0.55)}px monospace`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('$', h, h + 1);
  },
  bag: (c, s, col) => {
    c.fillStyle = col;
    c.fillRect(s * 0.3, s * 0.2, s * 0.4, s * 0.55);
    c.fillRect(s * 0.4, s * 0.1, s * 0.2, s * 0.15);
    c.fillStyle = '#fff';
    c.fillRect(s * 0.45, s * 0.35, s * 0.1, s * 0.15);
  },
  gear: (c, s, col) => {
    c.fillStyle = col;
    c.beginPath(); c.arc(s / 2, s / 2, s * 0.3, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#7f8c8d';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      c.fillRect(s / 2 + Math.cos(a) * s * 0.4 - 1, s / 2 + Math.sin(a) * s * 0.4 - 2, 2, 4);
    }
  },
  chat: (c, s, col) => {
    c.fillStyle = col;
    c.fillRect(s * 0.2, s * 0.25, s * 0.6, s * 0.45);
    c.beginPath();
    c.moveTo(s * 0.35, s * 0.7);
    c.lineTo(s * 0.5, s * 0.9);
    c.lineTo(s * 0.65, s * 0.7);
    c.fill();
  },
  map: (c, s, col) => {
    c.fillStyle = col;
    c.fillRect(s * 0.15, s * 0.2, s * 0.7, s * 0.6);
    c.fillStyle = '#fff';
    c.fillRect(s * 0.3, s * 0.35, s * 0.15, s * 0.1);
    c.fillRect(s * 0.55, s * 0.5, s * 0.15, s * 0.1);
  },
  group: (c, s, col) => {
    c.fillStyle = col;
    c.beginPath(); c.arc(s * 0.35, s * 0.4, s * 0.18, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(s * 0.65, s * 0.4, s * 0.18, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(s * 0.5, s * 0.7, s * 0.22, 0, Math.PI); c.fill();
  },
  shop: (c, s, col) => {
    c.fillStyle = col;
    c.fillRect(s * 0.2, s * 0.35, s * 0.6, s * 0.5);
    c.fillStyle = '#e67e22';
    c.fillRect(s * 0.15, s * 0.25, s * 0.7, s * 0.12);
  },
  scroll: (c, s, col) => {
    c.fillStyle = col;
    c.fillRect(s * 0.3, s * 0.15, s * 0.4, s * 0.7);
    c.fillStyle = '#1a1a2e';
    for (let i = 0; i < 4; i++) c.fillRect(s * 0.35, s * 0.25 + i * s * 0.12, s * 0.3, 1);
  },
  bell: (c, s, col) => {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(s * 0.3, s * 0.3);
    c.lineTo(s * 0.7, s * 0.3);
    c.lineTo(s * 0.65, s * 0.75);
    c.lineTo(s * 0.35, s * 0.75);
    c.fill();
    c.beginPath(); c.arc(s * 0.5, s * 0.82, s * 0.06, 0, Math.PI * 2); c.fill();
  },
  game: (c, s, col) => {
    c.fillStyle = col;
    c.fillRect(s * 0.25, s * 0.3, s * 0.5, s * 0.4);
    c.fillStyle = '#fff';
    c.fillRect(s * 0.35, s * 0.4, s * 0.08, s * 0.2);
    c.fillRect(s * 0.57, s * 0.4, s * 0.08, s * 0.2);
  },
  settings: (c, s, col) => {
    c.fillStyle = col;
    c.beginPath(); c.arc(s / 2, s / 2, s * 0.22, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      c.fillRect(s / 2 + Math.cos(a) * s * 0.32 - 1, s / 2 + Math.sin(a) * s * 0.32 - 3, 2, 6);
    }
  },
  friends: (c, s, col) => {
    c.fillStyle = col;
    c.beginPath(); c.arc(s * 0.4, s * 0.35, s * 0.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(s * 0.6, s * 0.35, s * 0.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(s * 0.5, s * 0.7, s * 0.25, 0, Math.PI); c.fill();
  },
  inventory: (c, s, col) => {
    c.fillStyle = col;
    c.fillRect(s * 0.25, s * 0.2, s * 0.5, s * 0.6);
    c.fillStyle = '#fff';
    c.fillRect(s * 0.35, s * 0.3, s * 0.3, 2);
    c.fillRect(s * 0.35, s * 0.4, s * 0.25, 2);
    c.fillRect(s * 0.35, s * 0.5, s * 0.2, 2);
  },
  close: (c, s, col) => {
    c.strokeStyle = col; c.lineWidth = 2;
    c.beginPath(); c.moveTo(s * 0.25, s * 0.25); c.lineTo(s * 0.75, s * 0.75); c.stroke();
    c.beginPath(); c.moveTo(s * 0.75, s * 0.25); c.lineTo(s * 0.25, s * 0.75); c.stroke();
  },
  default: (c, s, col) => {
    c.fillStyle = col;
    c.fillRect(s * 0.3, s * 0.3, s * 0.4, s * 0.4);
  }
};
