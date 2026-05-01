/**
 * ColorWheel.js — v8.0 HSL Color Picker
 * Interactive canvas-based color wheel for avatar customization.
 */
export class ColorWheel {
  constructor(containerId, onChange) {
    this.container = document.getElementById(containerId);
    this.onChange = onChange || (() => {});
    this.hue = 200;
    this.sat = 70;
    this.light = 50;
    this.canvas = null;
    this.ctx = null;
    this.dragging = false;
    this.build();
  }

  build() {
    if (!this.container) return;
    this.container.innerHTML = '';
    this.canvas = document.createElement('canvas');
    this.canvas.width = 180;
    this.canvas.height = 180;
    this.canvas.className = 'color-wheel-canvas';
    this.canvas.style.cursor = 'crosshair';
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.canvas.addEventListener('pointerdown', e => { this.dragging = true; this.pick(e); });
    this.canvas.addEventListener('pointermove', e => { if (this.dragging) this.pick(e); });
    window.addEventListener('pointerup', () => { this.dragging = false; });

    this.render();
  }

  pick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), cx);
    const angle = Math.atan2(dy, dx);
    this.hue = ((angle * 180 / Math.PI) + 360) % 360;
    this.sat = Math.min(100, (dist / cx) * 100);
    this.render();
    this.onChange(this.getHSL());
  }

  getHSL() {
    return `hsl(${Math.round(this.hue)}, ${Math.round(this.sat)}%, ${Math.round(this.light)}%)`;
  }

  setHSL(h, s, l) {
    this.hue = h; this.sat = s; this.light = l;
    this.render();
  }

  render() {
    if (!this.ctx) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2, cy = h / 2, r = Math.min(cx, cy);
    this.ctx.clearRect(0, 0, w, h);

    // Draw color wheel
    for (let angle = 0; angle < 360; angle++) {
      const rad = (angle * Math.PI) / 180;
      const x = cx + Math.cos(rad) * r;
      const y = cy + Math.sin(rad) * r;
      this.ctx.strokeStyle = `hsl(${angle}, 100%, 50%)`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(cx, cy);
      this.ctx.lineTo(x, y);
      this.ctx.stroke();
    }

    // Saturation gradient
    const grad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `hsl(${this.hue}, 0%, ${this.light}%)`);
    grad.addColorStop(1, `hsl(${this.hue}, 100%, ${this.light}%)`);
    this.ctx.fillStyle = grad;
    this.ctx.globalAlpha = 0.6;
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.globalAlpha = 1;

    // Selector dot
    const rad = (this.hue * Math.PI) / 180;
    const d = (this.sat / 100) * r;
    const sx = cx + Math.cos(rad) * d;
    const sy = cy + Math.sin(rad) * d;
    this.ctx.fillStyle = '#fff';
    this.ctx.beginPath();
    this.ctx.arc(sx, sy, 6, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }
}
