// ============================================================
// Starlight Inn — Fishing Minigame
// ============================================================

const FISH_TYPES = [
  { name: 'Minnow', emoji: '🐟', coins: 10, color: '#A0A0A0', weight: 40 },
  { name: 'Bass', emoji: '🐠', coins: 25, color: '#4CAF50', weight: 25 },
  { name: 'Trout', emoji: '🐡', coins: 40, color: '#FF9800', weight: 15 },
  { name: 'Salmon', emoji: '🦈', coins: 75, color: '#E91E63', weight: 10 },
  { name: 'Starlight Koi', emoji: '✨', coins: 200, color: '#FFD700', weight: 8 },
  { name: 'Golden Legend', emoji: '🏆', coins: 500, color: '#FFA500', weight: 2 },
];

export class FishingGame {
  constructor(game) {
    this.game = game;
    this.state = 'intro'; // intro, waiting, biting, reeling, ended
    this.canvas = null;
    this.ctx = null;
    this._clickHandler = null;
    this._keyHandler = null;
    this.result = null;
    this.score = 0;
    this.catches = [];
    this.bobberY = 0;
    this.bobberVel = 0;
    this.targetZoneY = 0;
    this.targetZoneHeight = 60;
    this.timeLeft = 60;
    this.biteTimer = 0;
    this.reelProgress = 0;
    this.fish = null;
    this.rodShake = 0;
  }

  start() {
    this.state = 'intro';
    this.score = 0;
    this.catches = [];
    this.timeLeft = 60;
    this._setupCanvas();
    this._bindInput();
    this._startWaiting();
  }

  _setupCanvas() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
  }

  _bindInput() {
    this._clickHandler = () => this._handleAction();
    this._keyHandler = (e) => { if (e.code === 'Space') { e.preventDefault(); this._handleAction(); } };
    this.canvas.addEventListener('click', this._clickHandler);
    window.addEventListener('keydown', this._keyHandler);
  }

  _unbindInput() {
    if (this._clickHandler) this.canvas.removeEventListener('click', this._clickHandler);
    if (this._keyHandler) window.removeEventListener('keydown', this._keyHandler);
  }

  _handleAction() {
    if (this.state === 'biting') {
      this.state = 'reeling';
      this.reelProgress = 0;
      this._pickFish();
    } else if (this.state === 'reeling') {
      const inZone = Math.abs(this.bobberY - this.targetZoneY) < this.targetZoneHeight / 2;
      if (inZone) {
        this.reelProgress += 0.15;
        if (this.game?.soundManager) this.game.soundManager.playTone(440 + this.reelProgress * 400, 0.08);
      } else {
        this.reelProgress -= 0.08;
        if (this.game?.soundManager) this.game.soundManager.playTone(200, 0.1);
      }
      if (this.reelProgress >= 1) {
        this._catchFish();
      } else if (this.reelProgress <= 0) {
        this._fishEscaped();
      }
    }
  }

  _pickFish() {
    const total = FISH_TYPES.reduce((s, f) => s + f.weight, 0);
    let r = Math.random() * total;
    for (const fish of FISH_TYPES) {
      r -= fish.weight;
      if (r <= 0) { this.fish = fish; break; }
    }
    if (!this.fish) this.fish = FISH_TYPES[0];
  }

  _catchFish() {
    this.score += this.fish.coins;
    this.catches.push(this.fish);
    this.state = 'intro';
    if (this.game?.uiManager) {
      this.game.uiManager.showNotification(`Caught ${this.fish.emoji} ${this.fish.name}! +★${this.fish.coins}`, 'success');
    }
    if (this.game?.soundManager) this.game.soundManager.play('win');
    setTimeout(() => this._startWaiting(), 1500);
  }

  _fishEscaped() {
    this.state = 'intro';
    if (this.game?.uiManager) {
      this.game.uiManager.showNotification(`${this.fish.name} got away!`, 'error');
    }
    if (this.game?.soundManager) this.game.soundManager.play('error');
    setTimeout(() => this._startWaiting(), 1500);
  }

  _startWaiting() {
    if (this.timeLeft <= 0) {
      this._endGame();
      return;
    }
    this.state = 'waiting';
    this.biteTimer = 2 + Math.random() * 4;
    this.bobberY = 0;
    this.bobberVel = 0;
  }

  _endGame() {
    this.state = 'ended';
    this._unbindInput();
    if (this.game) {
      this.game.currencySystem.add(this.score);
      this.game.uiManager?.showNotification(`Fishing trip done! +★${this.score}`, 'success');
      this.game.achievementSystem?.track('minigame');
      if (this.catches.length >= 3) this.game.achievementSystem?.track('win');
      this.game.leaderboardSystem?.submit('fishing', this.score);
      this.game.networkManager?.submitScore('fishing', this.score);
    }
  }

  update(dt) {
    if (this.state === 'ended') return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0 && this.state !== 'reeling') {
      this._endGame();
      return;
    }

    if (this.state === 'waiting') {
      this.biteTimer -= dt;
      this.bobberY = Math.sin(Date.now() / 500) * 5;
      if (this.biteTimer <= 0) {
        this.state = 'biting';
        this.rodShake = 1;
        if (this.game?.soundManager) this.game.soundManager.playTone(800, 0.15);
      }
    } else if (this.state === 'biting') {
      this.rodShake *= 0.9;
      this.bobberY = Math.sin(Date.now() / 80) * 15 + Math.sin(Date.now() / 40) * 10;
    } else if (this.state === 'reeling') {
      // Target zone moves
      this.targetZoneY = Math.sin(Date.now() / 600) * 60 + Math.sin(Date.now() / 300) * 30;
      // Bobber follows physics
      this.bobberVel += (Math.sin(Date.now() / 400) * 2 - this.bobberY * 0.05) * dt * 5;
      this.bobberVel *= 0.95;
      this.bobberY += this.bobberVel;
      // Clamp
      this.bobberY = Math.max(-90, Math.min(90, this.bobberY));
    }

    this._draw();
  }

  _draw() {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    const cx = w / 2, cy = h / 2;

    // Water background
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1a3a4a');
    grad.addColorStop(1, '#0d2529');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Water shimmer
    ctx.fillStyle = 'rgba(100,200,255,0.05)';
    for (let i = 0; i < 8; i++) {
      const sx = ((Date.now() / 30 + i * 100) % w);
      const sy = ((Date.now() / 20 + i * 73) % h);
      ctx.beginPath();
      ctx.ellipse(sx, sy, 40, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎣 Starlight Fishing', cx, 40);

    // Timer
    ctx.fillStyle = this.timeLeft < 10 ? '#e74c3c' : '#f4d03f';
    ctx.font = 'bold 18px Nunito, sans-serif';
    ctx.fillText(`⏱ ${Math.ceil(this.timeLeft)}s`, cx, 70);

    // Score
    ctx.fillStyle = '#fff';
    ctx.font = '16px Nunito, sans-serif';
    ctx.fillText(`★${this.score} | Caught: ${this.catches.length}`, cx, 95);

    // Reel bar (only in reeling state)
    if (this.state === 'reeling') {
      const barW = 40, barH = 200;
      const bx = cx - barW / 2, by = cy - barH / 2;

      // Background
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.roundRect(bx, by, barW, barH, 8); ctx.fill();

      // Target zone
      ctx.fillStyle = 'rgba(46,204,113,0.4)';
      const tzY = by + barH/2 + this.targetZoneY;
      ctx.beginPath(); ctx.roundRect(bx + 2, tzY - this.targetZoneHeight/2, barW - 4, this.targetZoneHeight, 6); ctx.fill();

      // Bobber
      ctx.fillStyle = '#fff';
      const bobY = by + barH/2 + this.bobberY;
      ctx.beginPath(); ctx.arc(cx, bobY, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath(); ctx.arc(cx, bobY, 6, 0, Math.PI * 2); ctx.fill();

      // Progress bar at top
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(cx - 80, by - 25, 160, 14);
      ctx.fillStyle = this.reelProgress > 0.6 ? '#2ecc71' : (this.reelProgress > 0.3 ? '#f1c40f' : '#e74c3c');
      ctx.fillRect(cx - 78, by - 23, 156 * Math.max(0, this.reelProgress), 10);

      // Instructions
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '13px Nunito, sans-serif';
      ctx.fillText('Click/Space when bobber is in green zone!', cx, by + barH + 30);
    } else if (this.state === 'waiting') {
      // Bobber on water
      const bobX = cx + Math.sin(Date.now() / 800) * 20;
      const bobY = cy + 40 + this.bobberY;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.ellipse(bobX, bobY + 5, 15, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(bobX, bobY - 10, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bobX, bobY - 2); ctx.lineTo(bobX + 30, bobY - 50); ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '14px Nunito, sans-serif';
      ctx.fillText('Waiting for a bite...', cx, cy - 60);
    } else if (this.state === 'biting') {
      // Splash effect
      const splash = 10 + this.rodShake * 20;
      ctx.fillStyle = `rgba(255,255,255,${0.3 + this.rodShake * 0.3})`;
      ctx.beginPath(); ctx.arc(cx, cy + 40, splash, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#e74c3c';
      ctx.font = 'bold 20px Nunito, sans-serif';
      ctx.fillText('🐟 FISH ON! CLICK NOW!', cx, cy - 60);
    } else if (this.state === 'intro' && this.catches.length > 0) {
      // Show last catch
      const last = this.catches[this.catches.length - 1];
      ctx.fillStyle = last.color;
      ctx.font = 'bold 22px Nunito, sans-serif';
      ctx.fillText(`${last.emoji} ${last.name}`, cx, cy);
      ctx.fillStyle = '#f4d03f';
      ctx.font = '16px Nunito, sans-serif';
      ctx.fillText(`+★${last.coins}`, cx, cy + 30);
    }

    // Catch log
    if (this.catches.length > 0) {
      ctx.textAlign = 'left';
      ctx.font = '12px Nunito, sans-serif';
      let y = h - 20;
      for (let i = this.catches.length - 1; i >= Math.max(0, this.catches.length - 4); i--) {
        const c = this.catches[i];
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(10, y - 14, 140, 18);
        ctx.fillStyle = '#fff';
        ctx.fillText(`${c.emoji} ${c.name} +★${c.coins}`, 16, y);
        y -= 22;
      }
      ctx.textAlign = 'center';
    }
  }

  end() {
    this._unbindInput();
  }
}
