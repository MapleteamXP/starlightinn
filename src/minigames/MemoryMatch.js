// ============================================================
// Starlight Engine — Memory Match Minigame
// ============================================================

import { BaseMinigame } from './Framework.js';

const EMOJIS = ['🌟','🚀','🎵','🎨','🎮','🍕','⚡','💎','🌈','🔥','❄️','🌺'];

export class MemoryMatch extends BaseMinigame {
  constructor(game) {
    super(game, { duration: 90, rewards: { win: 250, lose: 25 } });
    this.gridSize = 4; // 4x4
    this.cards = [];
    this.flipped = [];
    this.matched = 0;
    this.canFlip = true;
    this.moves = 0;
    this._click = this.handleClick.bind(this);
  }

  start() {
    super.start();
    this.matched = 0;
    this.moves = 0;
    this.flipped = [];
    this.canFlip = true;
    this._buildDeck();
    this.game.canvas.addEventListener('click', this._click);
  }

  end(won) {
    this.game.canvas.removeEventListener('click', this._click);
    super.end(won);
  }

  _buildDeck() {
    const pairs = this.gridSize * this.gridSize / 2;
    const deck = [];
    for (let i = 0; i < pairs; i++) {
      const emoji = EMOJIS[i % EMOJIS.length];
      deck.push({ id: i, emoji, face: 'down', matched: false });
      deck.push({ id: i, emoji, face: 'down', matched: false });
    }
    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    this.cards = deck;
  }

  handleClick(e) {
    if (this.state !== 'playing' || !this.canFlip) return;
    const w = this.game.canvas.width;
    const h = this.game.canvas.height;
    const cardW = 64, cardH = 80, gap = 12;
    const totalW = this.gridSize * cardW + (this.gridSize - 1) * gap;
    const totalH = this.gridSize * cardH + (this.gridSize - 1) * gap;
    const offX = (w - totalW) / 2;
    const offY = (h - totalH) / 2 - 20;

    const mx = e.clientX, my = e.clientY;
    for (let i = 0; i < this.cards.length; i++) {
      const col = i % this.gridSize;
      const row = Math.floor(i / this.gridSize);
      const cx = offX + col * (cardW + gap);
      const cy = offY + row * (cardH + gap);
      if (mx >= cx && mx <= cx + cardW && my >= cy && my <= cy + cardH) {
        this._flipCard(i);
        break;
      }
    }
  }

  _flipCard(index) {
    const card = this.cards[index];
    if (card.face === 'up' || card.matched || this.flipped.includes(index)) return;
    card.face = 'up';
    this.flipped.push(index);
    this.game.soundManager.play('click');

    if (this.flipped.length === 2) {
      this.moves++;
      const [a, b] = this.flipped;
      if (this.cards[a].emoji === this.cards[b].emoji) {
        this.cards[a].matched = true;
        this.cards[b].matched = true;
        this.matched++;
        this.flipped = [];
        this.score += 100;
        this.game.soundManager.play('buy');
        if (this.matched >= this.cards.length / 2) {
          this.end(true);
        }
      } else {
        this.canFlip = false;
        setTimeout(() => {
          this.cards[a].face = 'down';
          this.cards[b].face = 'down';
          this.flipped = [];
          this.canFlip = true;
          this.game.soundManager.play('error');
        }, 700);
      }
    }
  }

  update(dt) {
    super.update(dt);
  }

  render(ctx) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.fillStyle = '#0e2a30';
    ctx.fillRect(0, 0, w, h);

    // Title
    ctx.fillStyle = '#f4d03f';
    ctx.font = 'bold 24px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Memory Match', w / 2, 40);
    ctx.fillStyle = '#fff';
    ctx.font = '14px Nunito, sans-serif';
    ctx.fillText(`Matches: ${this.matched}/${this.cards.length / 2}   Moves: ${this.moves}   Time: ${Math.ceil(this.duration - this.timer)}s`, w / 2, 66);

    const cardW = 64, cardH = 80, gap = 12;
    const totalW = this.gridSize * cardW + (this.gridSize - 1) * gap;
    const totalH = this.gridSize * cardH + (this.gridSize - 1) * gap;
    const offX = (w - totalW) / 2;
    const offY = (h - totalH) / 2 - 10;

    for (let i = 0; i < this.cards.length; i++) {
      const col = i % this.gridSize;
      const row = Math.floor(i / this.gridSize);
      const cx = offX + col * (cardW + gap);
      const cy = offY + row * (cardH + gap);
      const card = this.cards[i];

      // Card back or face
      if (card.face === 'up' || card.matched) {
        ctx.fillStyle = card.matched ? 'rgba(46,204,113,0.25)' : 'rgba(255,255,255,0.1)';
        ctx.fillRect(cx, cy, cardW, cardH);
        ctx.strokeStyle = card.matched ? '#2ecc71' : '#f4d03f';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx, cy, cardW, cardH);
        ctx.fillStyle = '#fff';
        ctx.font = '32px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(card.emoji, cx + cardW / 2, cy + cardH / 2);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(cx, cy, cardW, cardH);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx, cy, cardW, cardH);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.font = '20px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', cx + cardW / 2, cy + cardH / 2);
      }
    }

    if (this.state === 'ended') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = this.result === 'win' ? '#2ecc71' : '#e74c3c';
      ctx.font = 'bold 48px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.result === 'win' ? 'YOU WIN!' : 'TIME UP!', w / 2, h / 2 - 20);
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
