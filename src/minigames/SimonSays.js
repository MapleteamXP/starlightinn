// ============================================================
// Starlight Inn — Simon Says Minigame
// ============================================================

export class SimonSays {
  constructor(game) {
    this.game = game;
    this.state = 'intro'; // intro, playing, ended
    this.sequence = [];
    this.playerSequence = [];
    this.round = 0;
    this.maxRounds = 10;
    this.colors = ['#E74C3C', '#2ECC71', '#3498DB', '#F1C40F'];
    this.colorNames = ['Red', 'Green', 'Blue', 'Yellow'];
    this.highlighted = -1;
    this.canClick = false;
    this.score = 0;
    this.result = null;
    this.canvas = null;
    this.ctx = null;
    this._clickHandler = null;
    this._keyHandler = null;
  }

  start() {
    this.state = 'intro';
    this.sequence = [];
    this.playerSequence = [];
    this.round = 0;
    this.score = 0;
    this.result = null;
    this._setupCanvas();
    this._bindInput();
    this._renderIntro();
    setTimeout(() => this._startRound(), 2000);
  }

  _setupCanvas() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
  }

  _bindInput() {
    this._clickHandler = (e) => this._handleClick(e);
    this._keyHandler = (e) => this._handleKey(e);
    this.canvas.addEventListener('click', this._clickHandler);
    window.addEventListener('keydown', this._keyHandler);
  }

  _unbindInput() {
    if (this._clickHandler) this.canvas.removeEventListener('click', this._clickHandler);
    if (this._keyHandler) window.removeEventListener('keydown', this._keyHandler);
  }

  _handleClick(e) {
    if (!this.canClick || this.state !== 'playing') return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = this.canvas.width, h = this.canvas.height;
    const cx = w / 2, cy = h / 2;
    const size = Math.min(w, h) * 0.35;

    // Check which quadrant was clicked
    let idx = -1;
    if (x < cx && y < cy) idx = 0; // top-left: red
    else if (x >= cx && y < cy) idx = 1; // top-right: green
    else if (x < cx && y >= cy) idx = 2; // bottom-left: blue
    else idx = 3; // bottom-right: yellow

    this._playerInput(idx);
  }

  _handleKey(e) {
    if (!this.canClick || this.state !== 'playing') return;
    const keyMap = { 'q': 0, 'w': 1, 'a': 2, 's': 3, 'ArrowUp': 0, 'ArrowRight': 1, 'ArrowDown': 2, 'ArrowLeft': 3 };
    if (keyMap[e.key] !== undefined) {
      e.preventDefault();
      this._playerInput(keyMap[e.key]);
    }
  }

  _playerInput(idx) {
    this.playerSequence.push(idx);
    this._flashColor(idx);

    const currentStep = this.playerSequence.length - 1;
    if (this.playerSequence[currentStep] !== this.sequence[currentStep]) {
      this._gameOver();
      return;
    }

    if (this.playerSequence.length === this.sequence.length) {
      this.score += this.round * 10;
      this.canClick = false;
      setTimeout(() => this._startRound(), 800);
    }
  }

  _startRound() {
    if (this.round >= this.maxRounds) {
      this._win();
      return;
    }
    this.round++;
    this.playerSequence = [];
    this.sequence.push(Math.floor(Math.random() * 4));
    this.state = 'playing';
    this._playSequence();
  }

  async _playSequence() {
    this.canClick = false;
    await this._delay(500);
    for (let i = 0; i < this.sequence.length; i++) {
      this._flashColor(this.sequence[i]);
      await this._delay(600);
    }
    this.canClick = true;
  }

  _flashColor(idx) {
    this.highlighted = idx;
    this._drawBoard();
    setTimeout(() => {
      this.highlighted = -1;
      this._drawBoard();
    }, 300);
    if (this.game && this.game.soundManager) {
      const notes = [523, 659, 784, 1047]; // C, E, G, C
      this.game.soundManager.playTone(notes[idx], 0.15);
    }
  }

  _delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  update(dt) {
    if (this.state === 'intro') {
      this._renderIntro();
    } else if (this.state === 'playing') {
      this._drawBoard();
    }
  }

  _drawBoard() {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2;
    const size = Math.min(w, h) * 0.35;
    const gap = 8;

    const positions = [
      { x: cx - size - gap/2, y: cy - size - gap/2 }, // top-left
      { x: cx + gap/2, y: cy - size - gap/2 }, // top-right
      { x: cx - size - gap/2, y: cy + gap/2 }, // bottom-left
      { x: cx + gap/2, y: cy + gap/2 }, // bottom-right
    ];

    for (let i = 0; i < 4; i++) {
      const p = positions[i];
      const isLit = this.highlighted === i;
      ctx.fillStyle = isLit ? this._lighten(this.colors[i], 40) : this.colors[i];
      ctx.shadowColor = isLit ? this.colors[i] : 'transparent';
      ctx.shadowBlur = isLit ? 30 : 0;
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, size, size, 16);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Border
      ctx.strokeStyle = isLit ? '#fff' : 'rgba(0,0,0,0.3)';
      ctx.lineWidth = isLit ? 3 : 2;
      ctx.stroke();

      // Key hint
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = 'bold 14px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(['Q', 'W', 'A', 'S'][i], p.x + size/2, p.y + size - 12);
    }

    // Center info
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.arc(cx, cy, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Round ${this.round}/${this.maxRounds}`, cx, cy - 8);
    ctx.font = '14px Nunito, sans-serif';
    ctx.fillStyle = '#f4d03f';
    ctx.fillText(`Score: ${this.score}`, cx, cy + 12);

    // Instructions
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '12px Nunito, sans-serif';
    ctx.fillText(this.canClick ? 'Your turn! Repeat the pattern.' : 'Watch the pattern...', cx, h - 30);
  }

  _renderIntro() {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Simon Says', w/2, h/2 - 20);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '16px Nunito, sans-serif';
    ctx.fillText('Watch the pattern, then repeat it!', w/2, h/2 + 15);
    ctx.font = '14px Nunito, sans-serif';
    ctx.fillText('Use Q/W/A/S or click the colors', w/2, h/2 + 40);
  }

  _gameOver() {
    this.state = 'ended';
    this.result = 'lose';
    this._unbindInput();
    this._drawBoard();
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(231, 76, 60, 0.85)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over!', this.canvas.width/2, this.canvas.height/2 - 20);
    ctx.font = '20px Nunito, sans-serif';
    ctx.fillText(`Round ${this.round} | Score: ${this.score}`, this.canvas.width/2, this.canvas.height/2 + 15);
    ctx.font = '14px Nunito, sans-serif';
    ctx.fillText('Press ESC to exit', this.canvas.width/2, this.canvas.height/2 + 50);
    if (this.game) {
      this.game.currencySystem.add(Math.floor(this.score / 2));
      this.game.uiManager?.showNotification(`Simon Says: +★${Math.floor(this.score/2)}`, 'success');
      this.game.leaderboardSystem?.submit('simon_says', this.score);
      this.game.networkManager?.submitScore('simon_says', this.score);
    }
  }

  _win() {
    this.state = 'ended';
    this.result = 'win';
    this._unbindInput();
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(46, 204, 113, 0.85)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Perfect Memory!', this.canvas.width/2, this.canvas.height/2 - 20);
    ctx.font = '20px Nunito, sans-serif';
    ctx.fillText(`Score: ${this.score}`, this.canvas.width/2, this.canvas.height/2 + 15);
    ctx.font = '14px Nunito, sans-serif';
    ctx.fillText('Press ESC to exit', this.canvas.width/2, this.canvas.height/2 + 50);
    if (this.game) {
      this.game.currencySystem.add(this.score);
      this.game.uiManager?.showNotification(`Simon Says perfect! +★${this.score}`, 'success');
      this.game.leaderboardSystem?.submit('simon_says', this.score);
      this.game.networkManager?.submitScore('simon_says', this.score);
    }
  }

  _lighten(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min((num >> 16) + amt, 255);
    const G = Math.min((num >> 8 & 0x00FF) + amt, 255);
    const B = Math.min((num & 0x0000FF) + amt, 255);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }

  end() {
    this._unbindInput();
  }
}
