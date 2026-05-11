// ============================================================
// Starlight Engine — Ring Uppercut Minigame
// ============================================================

import { BaseMinigame } from './Framework.js';

export class RingUppercut extends BaseMinigame {
  constructor(game) {
    super(game, { duration: 60, rewards: { win: 200, lose: 20 } });
    this.playerHealth = 100;
    this.opponentHealth = 100;
    this.combo = 0;
    this.maxCombo = 0;
    this.timingBar = 0;
    this.timingDirection = 1;
    this.timingSpeed = 1.5;
    this.greenZoneStart = 0.4;
    this.greenZoneEnd = 0.6;
    this.canAttack = true;
    this.attackCooldown = 0;
    this.opponentAttackTimer = 0;
    this.result = null;

    this._keydown = (e) => {
      if (e.code === 'Space' && this.state === 'playing') {
        e.preventDefault();
        this.attemptAttack();
      }
    };
    window.addEventListener('keydown', this._keydown);
  }

  start() {
    super.start();
    this.playerHealth = 100;
    this.opponentHealth = 100;
    this.combo = 0;
    this.maxCombo = 0;
    this.result = null;
    this.canAttack = true;
    this.attackCooldown = 0;
    this.opponentAttackTimer = 0;
  }

  end(won) {
    window.removeEventListener('keydown', this._keydown);
    this.result = won ? 'win' : 'lose';
    this.game.soundManager.play(won ? 'win' : 'error');
    super.end(won);
  }

  attemptAttack() {
    if (!this.canAttack || this.attackCooldown > 0) return;
    const inGreen = this.timingBar >= this.greenZoneStart && this.timingBar <= this.greenZoneEnd;
    if (inGreen) {
      const damage = 8 + Math.floor(this.combo * 1.5);
      this.opponentHealth -= damage;
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.game.soundManager.play('punch');
      if (this.opponentHealth <= 0) {
        this.opponentHealth = 0;
        this.end(true);
      }
    } else {
      this.combo = 0;
      this.game.soundManager.play('error');
    }
    this.canAttack = false;
    this.attackCooldown = 0.4;
  }

  update(dt) {
    super.update(dt);
    if (this.state !== 'playing') return;

    this.timingBar += this.timingSpeed * dt * this.timingDirection;
    if (this.timingBar >= 1) { this.timingBar = 1; this.timingDirection = -1; }
    if (this.timingBar <= 0) { this.timingBar = 0; this.timingDirection = 1; }

    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0) this.canAttack = true;
    }

    this.opponentAttackTimer += dt;
    if (this.opponentAttackTimer >= 1.2 + Math.random() * 1.5) {
      this.opponentAttackTimer = 0;
      const dmg = 5 + Math.floor(Math.random() * 8);
      this.playerHealth -= dmg;
      this.game.soundManager.play('punch');
      if (this.playerHealth <= 0) {
        this.playerHealth = 0;
        this.end(false);
      }
    }
  }

  render(ctx) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#2d2d44';
    ctx.fillRect(w * 0.1, h * 0.35, w * 0.8, h * 0.45);
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 4;
    ctx.strokeRect(w * 0.1, h * 0.35, w * 0.8, h * 0.45);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const y = h * 0.35 + (i + 1) * (h * 0.45 / 4);
      ctx.beginPath();
      ctx.moveTo(w * 0.1, y);
      ctx.lineTo(w * 0.9, y);
      ctx.stroke();
    }

    this._drawFighter(ctx, w * 0.3, h * 0.55, this.game.player, true);
    this._drawFighter(ctx, w * 0.7, h * 0.55, { name: 'Challenger', shirtColor: '#e74c3c', skinColor: '#F5CBA7' }, false);

    this._drawHealthBar(ctx, w * 0.15, h * 0.12, w * 0.3, 20, this.playerHealth, '#2ecc71', 'You');
    this._drawHealthBar(ctx, w * 0.55, h * 0.12, w * 0.3, 20, this.opponentHealth, '#e74c3c', 'Challenger');

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.ceil(this.duration - this.timer) + 's', w / 2, h * 0.22);

    if (this.combo > 1) {
      ctx.fillStyle = '#f4d03f';
      ctx.font = 'bold 28px Nunito, sans-serif';
      ctx.fillText(this.combo + 'x COMBO!', w / 2, h * 0.28);
    }

    if (this.state === 'playing') {
      const barW = w * 0.4;
      const barH = 16;
      const barX = (w - barW) / 2;
      const barY = h * 0.82;
      ctx.fillStyle = '#333';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(barX + barW * this.greenZoneStart, barY, barW * (this.greenZoneEnd - this.greenZoneStart), barH);
      ctx.fillStyle = '#fff';
      ctx.fillRect(barX + barW * this.timingBar - 3, barY - 4, 6, barH + 8);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(barX, barY, barW, barH);

      ctx.fillStyle = '#fff';
      ctx.font = '12px Nunito, sans-serif';
      ctx.fillText('SPACE to punch!', w / 2, barY + barH + 20);
    }

    if (this.state === 'countdown') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 72px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.countdown > 0 ? String(this.countdown) : 'GO!', w / 2, h / 2);
    }

    if (this.state === 'ended') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = this.result === 'win' ? '#2ecc71' : '#e74c3c';
      ctx.font = 'bold 48px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.result === 'win' ? 'YOU WIN!' : 'YOU LOSE!', w / 2, h / 2);
      ctx.fillStyle = '#fff';
      ctx.font = '20px Nunito, sans-serif';
      const reward = this.result === 'win' ? this.rewards.win : this.rewards.lose;
      ctx.fillText(`+${reward} StarCoins`, w / 2, h / 2 + 50);
      ctx.font = '14px Nunito, sans-serif';
      ctx.fillText('Press ESC to return', w / 2, h / 2 + 80);
    }
  }

  _drawFighter(ctx, x, y, avatar, isPlayer) {
    ctx.fillStyle = avatar.skinColor || '#F5CBA7';
    ctx.beginPath(); ctx.arc(x, y - 30, 20, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = avatar.shirtColor || (isPlayer ? '#3498DB' : '#e74c3c');
    ctx.fillRect(x - 18, y - 10, 36, 40);
    ctx.fillStyle = '#2C3E50';
    ctx.fillRect(x - 12, y + 30, 10, 25);
    ctx.fillRect(x + 2, y + 30, 10, 25);
  }

  _drawHealthBar(ctx, x, y, w, h, health, color, label) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * (health / 100), h);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label + ' ' + Math.ceil(health) + '%', x + w / 2, y + h / 2);
  }
}
