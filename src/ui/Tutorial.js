// ============================================================
// Starlight Engine — First-Time Tutorial
// ============================================================

const STEPS = [
  { title: 'Welcome to Starlight Inn!', text: 'Use W/A/S/D or arrow keys to walk around. Click tiles to move.', highlight: null },
  { title: 'Chat with others', text: 'Press Enter to chat, or click the chat bar at the bottom.', highlight: 'chatBar' },
  { title: 'Explore rooms', text: 'Click the Navigator button to visit different rooms.', highlight: 'btnNavigator' },
  { title: 'Buy furniture', text: 'Visit the Catalog to buy furniture for your room.', highlight: 'btnCatalog' },
  { title: 'Customize yourself', text: 'Click the Me button to change your look.', highlight: 'btnCustomize' },
  { title: 'Play minigames', text: 'Click the Games button to earn StarCoins!', highlight: 'toolMinigame' },
];

export class TutorialSystem {
  constructor() {
    this.step = 0;
    this.seen = false;
    this.load();
  }

  load() {
    try { this.seen = localStorage.getItem('starlight_tutorial') === 'seen'; } catch (e) {}
  }

  markSeen() {
    this.seen = true;
    try { localStorage.setItem('starlight_tutorial', 'seen'); } catch (e) {}
  }

  shouldShow() {
    return !this.seen;
  }

  show(uiManager, onNext, onSkip) {
    this._render(uiManager, onNext, onSkip);
  }

  _render(uiManager, onNext, onSkip) {
    const existing = document.getElementById('tutorialOverlay');
    if (existing) existing.remove();

    const step = STEPS[this.step];
    if (!step) { this.markSeen(); onSkip && onSkip(); return; }

    const overlay = document.createElement('div');
    overlay.id = 'tutorialOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center;';

    const card = document.createElement('div');
    card.style.cssText = 'background:var(--habbo-panel);border:3px solid var(--habbo-accent);border-radius:16px;padding:24px;max-width:360px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,0.5);';
    card.innerHTML = `
      <div style="font-size:20px;font-weight:800;color:var(--habbo-accent);margin-bottom:10px;">${step.title}</div>
      <div style="font-size:14px;color:var(--habbo-text);margin-bottom:20px;line-height:1.5;">${step.text}</div>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button id="tutSkip" style="padding:8px 16px;background:transparent;border:2px solid var(--habbo-panel-border);color:white;border-radius:8px;cursor:pointer;font-family:inherit;font-weight:600;">Skip Tutorial</button>
        <button id="tutNext" style="padding:8px 16px;background:var(--habbo-accent);color:var(--habbo-dark);border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-weight:700;">${this.step < STEPS.length - 1 ? 'Next' : 'Get Started!'}</button>
      </div>
      <div style="margin-top:12px;font-size:11px;color:var(--habbo-text-dim);">Step ${this.step + 1} of ${STEPS.length}</div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    card.querySelector('#tutNext').addEventListener('click', () => {
      this.step++;
      if (this.step >= STEPS.length) { this.markSeen(); overlay.remove(); onSkip && onSkip(); }
      else { this._render(uiManager, onNext, onSkip); }
    });
    card.querySelector('#tutSkip').addEventListener('click', () => {
      this.markSeen();
      overlay.remove();
      onSkip && onSkip();
    });
  }
}
