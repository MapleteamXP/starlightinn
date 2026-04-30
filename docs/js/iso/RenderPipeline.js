/**
 * RenderPipeline.js -- v6.0
 * Full render orchestration: bg -> floor -> wall -> prop -> entity -> effect.
 */

export class RenderPipeline {
  constructor(targetCanvasId = 'game-canvas') {
    this.canvas = document.getElementById(targetCanvasId);
    this.ctx = this.canvas?.getContext('2d');
    this.layers = {
      background: [],
      floor: [],
      wall: [],
      prop: [],
      entity: [],
      effect: [],
    };
    this.clearColor = '#1a1a2e';
  }

  /**
   * Register a renderer function for a layer.
   */
  register(layer, rendererFn, priority = 0) {
    if (!this.layers[layer]) return;
    this.layers[layer].push({ fn: rendererFn, priority });
    this.layers[layer].sort((a, b) => a.priority - b.priority);
  }

  unregister(layer, rendererFn) {
    if (!this.layers[layer]) return;
    this.layers[layer] = this.layers[layer].filter(r => r.fn !== rendererFn);
  }

  /**
   * Execute the full pipeline.
   */
  render(ctx = this.ctx) {
    if (!ctx) return;
    this.clear(ctx);
    for (const layer of ['background', 'floor', 'wall', 'prop', 'entity', 'effect']) {
      for (const { fn } of this.layers[layer]) {
        fn(ctx);
      }
    }
  }

  clear(ctx = this.ctx) {
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.clearColor;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }

  setClearColor(hex) {
    this.clearColor = hex;
  }

  /**
   * Convenience: wrap a sprite renderer into the pipeline.
   */
  bindYSortRenderer(ySortRenderer, layer = 'entity') {
    this.register(layer, (ctx) => {
      ySortRenderer.render(ctx);
    }, 0);
  }

  bindTilemapRenderer(tileRenderer, layer = 'floor') {
    this.register(layer, (ctx) => {
      tileRenderer.draw(ctx);
    }, 0);
  }

  bindBackgroundRenderer(bgRenderer, layer = 'background') {
    this.register(layer, (ctx) => {
      bgRenderer.draw(ctx);
    }, 0);
  }

  bindEffectRenderer(effectRenderer, layer = 'effect') {
    this.register(layer, (ctx) => {
      effectRenderer.draw(ctx);
    }, 0);
  }
}

export default RenderPipeline;
