/**
 * AvatarPreview.js — v8.0 Real-time Avatar Preview
 * Canvas-based live preview of avatar with hair + colors.
 */
export class AvatarPreview {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas?.getContext('2d');
    this.colors = { skin: '#f5cba7', hair: '#5d4037', clothes: '#5b8c85', accent: '#ffd700' };
    this.hairStyle = 'bob';
    this.expression = 'happy';
    this.scale = 2;
  }

  setColors(c) { this.colors = { ...this.colors, ...c }; }
  setHair(style) { this.hairStyle = style; }
  setExpression(expr) { this.expression = expr; }

  draw() {
    if (!this.ctx) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2 + 10;
    const s = this.scale;

    // Body
    this.ctx.fillStyle = this.colors.clothes;
    this.ctx.fillRect(cx - 16 * s, cy, 32 * s, 28 * s);
    this.ctx.fillStyle = this.colors.accent;
    this.ctx.fillRect(cx - 8 * s, cy + 6 * s, 16 * s, 4 * s);

    // Head
    this.ctx.fillStyle = this.colors.skin;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy - 12 * s, 14 * s, 0, Math.PI * 2);
    this.ctx.fill();

    // Eyes
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.beginPath();
    this.ctx.arc(cx - 5 * s, cy - 14 * s, 2 * s, 0, Math.PI * 2);
    this.ctx.arc(cx + 5 * s, cy - 14 * s, 2 * s, 0, Math.PI * 2);
    this.ctx.fill();

    // Expression
    this.drawMouth(cx, cy - 8 * s, s);

    // Hair
    this.drawHair(cx, cy - 12 * s, s);
  }

  drawMouth(cx, cy, s) {
    this.ctx.strokeStyle = '#1a1a2e';
    this.ctx.lineWidth = 1.5 * s;
    this.ctx.beginPath();
    if (this.expression === 'happy') {
      this.ctx.arc(cx, cy, 4 * s, 0, Math.PI);
    } else if (this.expression === 'sad') {
      this.ctx.arc(cx, cy + 4 * s, 4 * s, Math.PI, 0);
    } else if (this.expression === 'surprised') {
      this.ctx.arc(cx, cy, 2 * s, 0, Math.PI * 2);
    } else {
      this.ctx.moveTo(cx - 4 * s, cy);
      this.ctx.lineTo(cx + 4 * s, cy);
    }
    this.ctx.stroke();
  }

  drawHair(cx, cy, s) {
    this.ctx.fillStyle = this.colors.hair;
    const style = this.hairStyle;
    if (style === 'buzz' || style === 'crew') {
      this.ctx.fillRect(cx - 14 * s, cy - 16 * s, 28 * s, 6 * s);
    } else if (['bob', 'lob', 'pageboy'].includes(style)) {
      this.ctx.fillRect(cx - 16 * s, cy - 18 * s, 32 * s, 10 * s);
      this.ctx.fillRect(cx - 18 * s, cy - 12 * s, 6 * s, 22 * s);
      this.ctx.fillRect(cx + 12 * s, cy - 12 * s, 6 * s, 22 * s);
    } else if (['longstraight', 'hime'].includes(style)) {
      this.ctx.fillRect(cx - 16 * s, cy - 18 * s, 32 * s, 10 * s);
      this.ctx.fillRect(cx - 20 * s, cy - 14 * s, 8 * s, 36 * s);
      this.ctx.fillRect(cx + 12 * s, cy - 14 * s, 8 * s, 36 * s);
    } else if (['ponytail', 'highpony'].includes(style)) {
      this.ctx.fillRect(cx - 16 * s, cy - 18 * s, 32 * s, 10 * s);
      this.ctx.fillRect(cx - 4 * s, cy - 20 * s, 8 * s, 30 * s);
    } else if (['pigtails', 'spacebuns', 'odango'].includes(style)) {
      this.ctx.fillRect(cx - 16 * s, cy - 18 * s, 32 * s, 10 * s);
      this.ctx.beginPath();
      this.ctx.arc(cx - 12 * s, cy - 22 * s, 6 * s, 0, Math.PI * 2);
      this.ctx.arc(cx + 12 * s, cy - 22 * s, 6 * s, 0, Math.PI * 2);
      this.ctx.fill();
    } else if (['mohawk', 'libertyspikes', 'deathhawk'].includes(style)) {
      this.ctx.fillRect(cx - 4 * s, cy - 28 * s, 8 * s, 18 * s);
    } else if (['afro', 'taperedafro', 'puff'].includes(style)) {
      this.ctx.beginPath();
      this.ctx.arc(cx, cy - 10 * s, 18 * s, 0, Math.PI * 2);
      this.ctx.fill();
    } else if (['buzz', 'fade', 'flatop', 'crew'].includes(style)) {
      this.ctx.fillRect(cx - 14 * s, cy - 16 * s, 28 * s, 6 * s);
    } else {
      // Default medium
      this.ctx.fillRect(cx - 16 * s, cy - 18 * s, 32 * s, 12 * s);
      this.ctx.fillRect(cx - 18 * s, cy - 10 * s, 4 * s, 14 * s);
      this.ctx.fillRect(cx + 14 * s, cy - 10 * s, 4 * s, 14 * s);
    }
  }
}
