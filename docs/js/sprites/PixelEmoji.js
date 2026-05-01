/**
 * PixelEmoji.js — v8.0 100+ Pixel Art Emojis
 * Canvas-rendered pixel-art emoji replacements for text emojis.
 */
export const PIXEL_EMOJI_MAP = {
  '⭐': 'star', '🌟': 'glow', '💫': 'sparkle', '✨': 'sparkles',
  '❤️': 'heart', '💙': 'blue_heart', '💜': 'purple_heart', '🧡': 'orange_heart',
  '👋': 'wave', '💃': 'dance', '🧘': 'sit', '😴': 'sleep',
  '😂': 'laugh', '😢': 'cry', '😊': 'happy', '😔': 'sad',
  '😎': 'cool', '😍': 'love', '😲': 'surprised', '😪': 'sleepy',
  '😠': 'angry', '😵': 'dizzy', '🙋': 'greet', '🙏': 'thank',
  '🤗': 'hug', '👏': 'clap', '💬': 'chat', '🎮': 'game',
  '🏠': 'house', '🎵': 'music', '🪙': 'coin', '🎒': 'bag',
  '🏪': 'shop', '📜': 'scroll', '🔔': 'bell', '⚙️': 'gear',
  '🗺️': 'map', '👥': 'group', '🤝': 'handshake', '🚫': 'block',
  '⚠️': 'warn', '👤': 'person', '🎲': 'dice', '➡️': 'arrow',
  '🌙': 'moon', '☀️': 'sun', '🌸': 'flower', '🔥': 'fire',
  '❄️': 'snow', '🍃': 'leaf', '🌊': 'wave_ocean', '🌈': 'rainbow',
  '🎁': 'gift', '🎄': 'tree', '🎃': 'pumpkin', '🐰': 'bunny',
  '🎂': 'cake', '🍵': 'tea', '☕': 'coffee', '🍕': 'pizza',
  '🍦': 'icecream', '🍭': 'lollipop', '🍪': 'cookie', '🍩': 'donut',
  '🐱': 'cat', '🐶': 'dog', '🦊': 'fox', '🐼': 'panda',
  '🐸': 'frog', '🦄': 'unicorn', '🐙': 'octopus', '🐢': 'turtle',
  '🌵': 'cactus', '🍄': 'mushroom', '🌻': 'sunflower', '🌹': 'rose',
  '💎': 'gem', '👑': 'crown', '🔮': 'crystal', '📖': 'book',
  '✏️': 'pencil', '🎨': 'palette', '🎭': 'mask', '🎬': 'clapper',
  '🎤': 'mic', '🎧': 'headphones', '🎸': 'guitar', '🥁': 'drum',
  '⚽': 'soccer', '🏀': 'basketball', '🏆': 'trophy', '🥇': 'medal',
  '🚀': 'rocket', '🛸': 'ufo', '🌍': 'earth', '🌌': 'galaxy',
  '💡': 'bulb', '🔋': 'battery', '💻': 'laptop', '📱': 'phone',
  '🔑': 'key', '🔒': 'lock', '🔓': 'unlock', '📬': 'mailbox',
  '✅': 'check', '❌': 'cross', '➕': 'plus', '➖': 'minus',
  '❓': 'question', '💢': 'anger', '💤': 'zzz', '💭': 'thought',
  '🎈': 'balloon', '🎉': 'party', '🎊': 'confetti', '🎏': 'banner',
  '🏳️': 'flag', '🏴': 'pirate', '🚩': 'tri_flag', '🎌': 'crossed',
};

export class PixelEmoji {
  constructor(size = 16) {
    this.size = size;
    this.cache = new Map();
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d');
  }

  render(char) {
    const key = PIXEL_EMOJI_MAP[char];
    if (!key) return null;
    if (this.cache.has(key)) return this.cache.get(key);

    const s = this.size;
    const c = this.ctx;
    c.clearRect(0, 0, s, s);
    c.imageSmoothingEnabled = false;

    // Draw based on key
    this._drawKey(key, c, s);

    const dataUrl = this.canvas.toDataURL();
    this.cache.set(key, dataUrl);
    return dataUrl;
  }

  _drawKey(key, c, s) {
    const half = s / 2;
    const ps = Math.max(1, Math.floor(s / 8));

    if (key === 'star' || key === 'glow') {
      c.fillStyle = '#ffd700';
      c.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * 4 * Math.PI / 5) - Math.PI / 2;
        const r = i % 2 === 0 ? half * 0.9 : half * 0.4;
        c.lineTo(half + Math.cos(a) * r, half + Math.sin(a) * r);
      }
      c.closePath(); c.fill();
    } else if (key === 'heart' || key === 'blue_heart' || key === 'purple_heart' || key === 'orange_heart') {
      const colors = { heart: '#e74c3c', blue_heart: '#3498db', purple_heart: '#9b59b6', orange_heart: '#e67e22' };
      c.fillStyle = colors[key] || colors.heart;
      c.beginPath();
      c.arc(half * 0.6, half * 0.6, half * 0.4, 0, Math.PI * 2);
      c.arc(half * 1.4, half * 0.6, half * 0.4, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.moveTo(half * 0.2, half * 0.8);
      c.lineTo(half, s * 0.95);
      c.lineTo(half * 1.8, half * 0.8);
      c.fill();
    } else if (key === 'wave') {
      c.strokeStyle = '#f1c40f'; c.lineWidth = ps * 2;
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.arc(half + (i - 1) * ps * 3, half, half * 0.4, -Math.PI * 0.6, Math.PI * 0.6);
        c.stroke();
      }
    } else if (key === 'coin' || key === 'shop') {
      c.fillStyle = '#f1c40f';
      c.beginPath(); c.arc(half, half, half * 0.8, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#f39c12';
      c.beginPath(); c.arc(half, half, half * 0.6, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff';
      c.font = `${Math.floor(s * 0.5)}px monospace`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(key === 'coin' ? '$' : 'S', half, half + 1);
    } else if (key === 'chat') {
      c.fillStyle = '#3498db';
      c.fillRect(half * 0.2, half * 0.3, s * 0.6, s * 0.4);
      c.beginPath();
      c.moveTo(half * 0.5, half * 0.7);
      c.lineTo(half, s * 0.9);
      c.lineTo(half * 0.8, half * 0.7);
      c.fill();
    } else if (key === 'happy') {
      c.fillStyle = '#f1c40f';
      c.beginPath(); c.arc(half, half, half * 0.85, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a1a2e';
      c.beginPath(); c.arc(half * 0.65, half * 0.7, ps, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(half * 1.35, half * 0.7, ps, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(half, half * 1.15, half * 0.35, 0, Math.PI); c.fill();
    } else if (key === 'sad') {
      c.fillStyle = '#f1c40f';
      c.beginPath(); c.arc(half, half, half * 0.85, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a1a2e';
      c.beginPath(); c.arc(half * 0.65, half * 0.7, ps, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(half * 1.35, half * 0.7, ps, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(half, s * 0.85, half * 0.3, Math.PI, 0); c.fill();
    } else if (key === 'gear') {
      c.fillStyle = '#95a5a6';
      c.beginPath(); c.arc(half, half, half * 0.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#7f8c8d';
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        c.fillRect(half + Math.cos(a) * half * 0.65 - ps, half + Math.sin(a) * half * 0.65 - ps * 2, ps * 2, ps * 4);
      }
    } else {
      // Generic fallback: colored square with first letter
      const hues = { sparkles: 45, dance: 280, sit: 120, sleep: 200, laugh: 50, cry: 200, cool: 200, love: 340, surprised: 30, sleepy: 200, angry: 0, dizzy: 270, greet: 180, thank: 35, hug: 300, clap: 45, house: 30, music: 260, bag: 35, shop: 200, scroll: 35, bell: 45, map: 120, group: 200, handshake: 35, block: 0, warn: 45, person: 30, dice: 280, arrow: 200, moon: 220, sun: 45, flower: 320, fire: 15, snow: 190, leaf: 100, wave_ocean: 200, rainbow: 280, gift: 340, tree: 120, pumpkin: 30, bunny: 30, cake: 340, tea: 100, coffee: 25, pizza: 30, icecream: 280, lollipop: 300, cookie: 30, donut: 320, cat: 280, dog: 30, fox: 25, panda: 0, frog: 100, unicorn: 280, octopus: 260, turtle: 120, cactus: 100, mushroom: 30, sunflower: 45, rose: 340, gem: 190, crown: 45, crystal: 270, book: 30, pencil: 45, palette: 280, mask: 260, clapper: 0, mic: 280, headphones: 260, guitar: 30, drum: 0, soccer: 120, basketball: 25, trophy: 45, medal: 45, rocket: 0, ufo: 260, earth: 200, galaxy: 270, bulb: 45, battery: 100, laptop: 200, phone: 200, key: 45, lock: 0, unlock: 120, mailbox: 0, check: 120, cross: 0, plus: 120, minus: 0, question: 200, anger: 0, zzz: 200, thought: 0, balloon: 340, party: 280, confetti: 280, banner: 0, flag: 200, pirate: 0, tri_flag: 0, crossed: 0, sparkles: 45, };
      c.fillStyle = `hsl(${hues[key] || 200}, 70%, 60%)`;
      c.fillRect(half * 0.2, half * 0.2, s * 0.6, s * 0.6);
      c.fillStyle = '#fff';
      c.font = `bold ${Math.floor(s * 0.5)}px monospace`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(key[0].toUpperCase(), half, half + 1);
    }
  }

  replaceInElement(el) {
    if (!el) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(node => {
      let text = node.nodeValue;
      let changed = false;
      for (const [emoji, key] of Object.entries(PIXEL_EMOJI_MAP)) {
        if (text.includes(emoji)) {
          changed = true;
          const img = this.render(emoji);
          if (img) {
            text = text.split(emoji).join(`<img src="${img}" class="pixel-emoji" alt="${emoji}" style="width:${this.size}px;height:${this.size}px;vertical-align:middle;">`);
          }
        }
      }
      if (changed) {
        const span = document.createElement('span');
        span.innerHTML = text;
        node.parentNode.replaceChild(span, node);
      }
    });
  }
}
