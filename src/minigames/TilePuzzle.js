// ============================================================
// Starlight Engine — Tile Puzzle Minigame (15-puzzle style)
// ============================================================

import { BaseMinigame } from './Framework.js';

export class TilePuzzle extends BaseMinigame {
  constructor(game) {
    super(game, { duration: 120, rewards: { win: 300, lose: 20 } });
    this.gridSize = 4;
    this.tiles = [];
    this.emptyIndex = 15;
    this.moves = 0;
    this.solved = false;
    this._click = this.handleClick.bind(this);
  }

  start() {
    super.start();
    this.moves = 0;
    this.solved = false;
    this._buildBoard();
    this._shuffle(120);
    this.game.canvas.addEventListener('click', this._click);
  }

  end(won) {
    this.game.canvas.removeEventListener('click', this._click);
    super.end(won);
  }

  _buildBoard() {
    this.tiles = [];
    for (let i = 0; i < 15; i++) this.tiles.push(i + 1);
    this.tiles.push(0); // empty
    this.emptyIndex = 15;
  }

  _shuffle(count) {
    for (let i = 0; i < count; i++) {
      const neighbors = this._getNeighbors(this.emptyIndex);
      const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
      this._swap(pick, this.emptyIndex, false);
    }
    this.moves = 0;
  }

  _getNeighbors(idx) {
    const row = Math.floor(idx / this.gridSize);
    const col = idx % this.gridSize;
    const neighbors = [];
    if (row > 0) neighbors.push(idx - this.gridSize);
    if (row < this.gridSize - 1) neighbors.push(idx + this.gridSize);
    if (col > 0) neighbors.push(idx - 1);
    if (col < this.gridSize - 1) neighbors.push(idx + 1);
    return neighbors;
  }

  _swap(from, to, countMove = true) {
    [this.tiles[from], this.tiles[to]] = [this.tiles[to], this.tiles[from]];
    this.emptyIndex = from;
    if (countMove) this.moves++;
  }

  handleClick(e) {
    if (this.state !== 'playing' || this.solved) return;
    const w = this.game.canvas.width;
    const h = this.game.canvas.height;
    const tileSize = 72, gap = 6;
    const totalW = this.gridSize * tileSize + (this.gridSize - 1) * gap;
    const totalH = this.gridSize * tileSize + (this.gridSize - 1) * gap;
    const offX = (w - totalW) / 2;
    const offY = (h - totalH) / 2 + 10;

    const mx = e.clientX, my = e.clientY;
    for (let i = 0; i < this.tiles.length; i++) {
      const col = i % this.gridSize;
      const row = Math.floor(i / this.gridSize);
      const cx = offX + col * (tileSize + gap);
      const cy = offY + row * (tileSize + gap);
      if (mx >= cx && mx <= cx + tileSize && my >= cy && my <= cy + tileSize) {
        if (this._getNeighbors(this.emptyIndex).includes(i)) {
          this._swap(i, this.emptyIndex);
          this.game.soundManager.play('click');
          if (this._checkSolved()) {
            this.solved = true;
            const score = 2000 - this.moves * 10 + Math.floor((this.duration - this.timer)) * 20;
            this.game.leaderboardSystem.submit('tilepuzzle', Math.max(0, score), { moves: this.moves, time: Math.floor(this.timer) });
            this.end(true);
          }
        } else {
          this.game.soundManager.play('error');
        }
        break;
      }
    }
  }

  _checkSolved() {
    for (let i = 0; i < 15; i++) {
      if (this.tiles[i] !== i + 1) return false;
    }
    return true;
  }

  render(ctx) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.fillStyle = '#0e2a30';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#f4d03f';
    ctx.font = 'bold 24px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Tile Puzzle', w / 2, 40);
    ctx.fillStyle = '#fff';
    ctx.font = '14px Nunito, sans-serif';
    ctx.fillText(`Moves: ${this.moves}   Time: ${Math.ceil(this.duration - this.timer)}s`, w / 2, 66);

    const tileSize = 72, gap = 6;
    const totalW = this.gridSize * tileSize + (this.gridSize - 1) * gap;
    const totalH = this.gridSize * tileSize + (this.gridSize - 1) * gap;
    const offX = (w - totalW) / 2;
    const offY = (h - totalH) / 2 + 20;

    for (let i = 0; i < this.tiles.length; i++) {
      const col = i % this.gridSize;
      const row = Math.floor(i / this.gridSize);
      const cx = offX + col * (tileSize + gap);
      const cy = offY + row * (tileSize + gap);
      const val = this.tiles[i];

      if (val !== 0) {
        const isCorrect = val === i + 1;
        ctx.fillStyle = isCorrect ? 'rgba(46,204,113,0.2)' : 'rgba(255,255,255,0.08)';
        ctx.fillRect(cx, cy, tileSize, tileSize);
        ctx.strokeStyle = isCorrect ? '#2ecc71' : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx, cy, tileSize, tileSize);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 28px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(val), cx + tileSize / 2, cy + tileSize / 2);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(cx, cy, tileSize, tileSize);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx, cy, tileSize, tileSize);
      }
    }

    if (this.state === 'ended') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = this.result === 'win' ? '#2ecc71' : '#e74c3c';
      ctx.font = 'bold 48px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.result === 'win' ? 'SOLVED!' : 'TIME UP!', w / 2, h / 2 - 20);
      ctx.fillStyle = '#fff';
      ctx.font = '20px Nunito, sans-serif';
      const reward = this.result === 'win' ? this.rewards.win : this.rewards.lose;
      ctx.fillText(`+${reward} StarCoins`, w / 2, h / 2 + 25);
      ctx.font = '14px Nunito, sans-serif';
      ctx.fillText('Press ESC to return', w / 2, h / 2 + 55);
    }

    super.render(ctx);
  }
}
