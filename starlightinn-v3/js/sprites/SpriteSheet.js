/**
 * SpriteSheet.js -- v6.0
 * Aseprite-style frame composition and animation for procedural sprites.
 */

export class SpriteSheet {
  constructor(frameWidth, frameHeight, frames = []) {
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.frames = frames; // array of HTMLCanvasElement or ImageBitmap
    this.animations = new Map(); // name -> { fps, frames: [indices], loop }
  }

  /**
   * Add a single frame canvas/image.
   */
  addFrame(source) {
    this.frames.push(source);
    return this.frames.length - 1;
  }

  /**
   * Define an animation sequence.
   */
  defineAnimation(name, { fps = 8, frameIndices = [], loop = true }) {
    this.animations.set(name, { fps, frameIndices: [...frameIndices], loop });
  }

  /**
   * Build a SpriteSheet from a single source image using grid slicing.
   */
  static fromGrid(sourceImage, cols, rows, opts = {}) {
    const fw = Math.floor(sourceImage.width / cols);
    const fh = Math.floor(sourceImage.height / rows);
    const sheet = new SpriteSheet(fw, fh);
    const offscreen = document.createElement('canvas');
    offscreen.width = fw;
    offscreen.height = fh;
    const ctx = offscreen.getContext('2d');
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        ctx.clearRect(0, 0, fw, fh);
        ctx.drawImage(sourceImage, x * fw, y * fh, fw, fh, 0, 0, fw, fh);
        const frame = document.createElement('canvas');
        frame.width = fw;
        frame.height = fh;
        frame.getContext('2d').drawImage(offscreen, 0, 0);
        sheet.addFrame(frame);
      }
    }
    return sheet;
  }

  /**
   * Get a frame by index.
   */
  getFrame(index) {
    return this.frames[index] || this.frames[0] || null;
  }

  /**
   * Get current animation frame for a time.
   */
  getAnimationFrame(animName, elapsedMs) {
    const anim = this.animations.get(animName);
    if (!anim || anim.frameIndices.length === 0) return this.getFrame(0);
    const frameDuration = 1000 / anim.fps;
    const totalDuration = frameDuration * anim.frameIndices.length;
    const t = anim.loop ? elapsedMs % totalDuration : Math.min(elapsedMs, totalDuration - 0.001);
    const idx = Math.floor(t / frameDuration) % anim.frameIndices.length;
    return this.getFrame(anim.frameIndices[idx]);
  }

  /**
   * Draw a specific frame to a canvas context.
   */
  drawFrame(ctx, index, x, y, { scale = 1, flipX = false, flipY = false } = {}) {
    const frame = this.getFrame(index);
    if (!frame) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flipX ? -scale : scale, flipY ? -scale : scale);
    ctx.drawImage(frame, flipX ? -this.frameWidth : 0, flipY ? -this.frameHeight : 0);
    ctx.restore();
  }

  /**
   * Draw current animation frame to a canvas context.
   */
  drawAnimation(ctx, animName, elapsedMs, x, y, opts = {}) {
    const frame = this.getAnimationFrame(animName, elapsedMs);
    if (!frame) return;
    const scale = opts.scale || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(opts.flipX ? -scale : scale, opts.flipY ? -scale : scale);
    ctx.drawImage(frame, opts.flipX ? -this.frameWidth : 0, opts.flipY ? -this.frameHeight : 0);
    ctx.restore();
  }

  /**
   * Clone the sheet (useful for palette swaps).
   */
  clone() {
    const sheet = new SpriteSheet(this.frameWidth, this.frameHeight);
    for (const f of this.frames) {
      const c = document.createElement('canvas');
      c.width = this.frameWidth;
      c.height = this.frameHeight;
      c.getContext('2d').drawImage(f, 0, 0);
      sheet.addFrame(c);
    }
    for (const [name, anim] of this.animations) {
      sheet.defineAnimation(name, { ...anim });
    }
    return sheet;
  }
}

export default SpriteSheet;
