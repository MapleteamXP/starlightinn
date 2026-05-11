// ============================================================
// Starlight Engine — Base Minigame
// ============================================================

export class BaseMinigame {
  constructor(game, config = {}) {
    this.game = game;
    this.config = config;
    this.state = 'waiting'; // waiting -> countdown -> playing -> ended
    this.score = 0;
    this.countdown = 3;
    this.countdownTimer = 0;
    this.duration = config.duration || 60;
    this.timer = 0;
    this.rewards = config.rewards || { win: 100, lose: 10 };
  }

  start() {
    this.state = 'countdown';
    this.countdown = 3;
    this.countdownTimer = 0;
    this.score = 0;
    this.timer = 0;
  }

  end(won) {
    this.state = 'ended';
    let reward = won ? this.rewards.win : this.rewards.lose;
    if (this.game.eventSystem) reward *= this.game.eventSystem.getCoinMultiplier();
    if (this.game.currencySystem) {
      this.game.currencySystem.add(reward);
    }
    if (this.game.uiManager) {
      this.game.uiManager.showNotification(won ? `You won ${reward} StarCoins!` : `Game over! +${reward} StarCoins`, won ? 'success' : 'info');
    }
  }

  update(dt) {
    if (this.state === 'countdown') {
      this.countdownTimer += dt;
      if (this.countdownTimer >= 1) {
        this.countdownTimer -= 1;
        this.countdown--;
        if (this.countdown <= 0) {
          this.state = 'playing';
        }
      }
    } else if (this.state === 'playing') {
      this.timer += dt;
      if (this.timer >= this.duration) {
        this.end(false);
      }
    }
  }

  render(ctx) {
    // Override in subclass
    if (this.state === 'countdown') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 72px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.countdown > 0 ? String(this.countdown) : 'GO!', ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
  }
}
