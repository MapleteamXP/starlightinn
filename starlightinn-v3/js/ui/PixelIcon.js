/**
 * @file PixelIcon.js
 * @description UI icon system for Starlight Inn v8.0.
 * Replaces all HTML emoji characters with crisp <canvas> pixel-art icons.
 * Provides IconButton, IconBadge, IconToggle, and a central drawIcon() helper.
 *
 * @module ui/PixelIcon
 * @version 8.0.0
 */

import PixelEmoji, { getEmoji, drawEmoji, getAllEmojis, hasEmoji } from '../sprites/PixelEmoji.js';

// ============================================================
// CONFIGURATION
// ============================================================

/** @constant {number} DEFAULT_ICON_SIZE — Default icon canvas size in px */
const DEFAULT_ICON_SIZE = 16;

/** @constant {number} LARGE_ICON_SIZE — Large icon canvas size in px */
const LARGE_ICON_SIZE = 24;

/** @constant {Object<string, string>} UI_COLORS */
const UI_COLORS = {
  bgDefault: '#2A2A3E',
  bgHover: '#3A3A5E',
  bgActive: '#4A4A7E',
  bgDisabled: '#1A1A2E',
  borderDefault: '#555577',
  borderHover: '#8888AA',
  borderActive: '#AAAACC',
  textDefault: '#E0E0E0',
  textDisabled: '#666666',
  badgeBg: '#E53935',
  badgeText: '#FFFFFF',
  toggleOn: '#4CAF50',
  toggleOff: '#9E9E9E',
  shadow: 'rgba(0,0,0,0.4)',
};

// ============================================================
// ICON NAME MAP (UI semantic names → emoji drawer names)
// ============================================================

/**
 * @constant {Object<string, string>}
 * Maps UI semantic names to PixelEmoji drawer names.
 */
export const ICON_MAP = {
  // Action icons
  profile: 'profile',
  whisper: 'whisper',
  friend: 'friend',
  trade: 'trade',
  ignore: 'ignore',
  report: 'report',
  settings: 'settings',
  inventory: 'inventory',
  catalog: 'catalog',
  chat: 'chat',
  friendsList: 'friends_list',
  minigames: 'minigames',
  achievements: 'achievements',
  badges: 'badges',
  store: 'store',
  coins: 'coins',
  close: 'close',
  back: 'back',
  play: 'play',
  pause: 'pause',
  music: 'music',
  sound: 'sound',
  mute: 'mute',
  // Status
  online: 'online',
  offline: 'offline',
  away: 'away',
  busy: 'busy',
  heart: 'heart',
  gift: 'gift',
  notification: 'notification',
  search: 'search',
  edit: 'edit',
  delete: 'delete',
  add: 'add',
  remove: 'remove',
  check: 'check',
  locked: 'locked',
  unlocked: 'unlocked',
  vip: 'vip',
  new: 'new',
  hot: 'hot',
  time: 'time',
  location: 'location',
  // Gestures
  dance: 'dance',
  sit: 'sit',
  wave: 'wave',
  sleep: 'sleep',
  laugh: 'laugh',
  kiss: 'kiss',
  cry: 'cry',
  angry: 'angry',
  surprised: 'surprised',
  cool: 'cool',
  love: 'love',
  sick: 'sick',
  confused: 'confused',
  // Wearables
  topHat: 'cool_hat',
  wizard: 'wizard',
  crown: 'crown',
  bunnyEars: 'bunny_ears',
  wings: 'wings',
  halo: 'halo',
  horns: 'horns',
  mask: 'mask',
  glasses: 'glasses',
  sunglasses: 'sunglasses',
  necklace: 'necklace',
  // Objects
  phone: 'phone',
  computer: 'computer',
  tv: 'tv',
  book: 'book',
  drink: 'drink',
  food: 'food',
  iceCream: 'ice_cream',
  coffee: 'coffee',
  balloon: 'balloon',
  confetti: 'confetti',
  firework: 'firework',
  star: 'star',
  moon: 'moon',
  sun: 'sun',
  cloud: 'cloud',
  rain: 'rain',
  snow: 'snow',
  flower: 'flower',
  tree: 'tree',
  leaf: 'leaf',
  fire: 'fire',
  water: 'water',
  bolt: 'bolt',
  rainbow: 'rainbow',
  earth: 'earth',
  rocket: 'rocket',
  ufo: 'ufo',
  ghost: 'ghost',
  pumpkin: 'pumpkin',
  skull: 'skull',
  spider: 'spider',
  bat: 'bat',
  candy: 'candy',
  giftRed: 'gift_red',
  ornament: 'ornament',
  snowman: 'snowman',
  // Heart variants
  heartPink: 'heart_pink',
  heartPurple: 'heart_purple',
  heartBlue: 'heart_blue',
  heartGreen: 'heart_green',
  heartYellow: 'heart_yellow',
  heartOrange: 'heart_orange',
  heartBlack: 'heart_black',
  heartBroken: 'heart_broken',
  heartSparkle: 'heart_sparkle',
  heartArrow: 'heart_arrow',
  heartRibbon: 'heart_ribbon',
  heartFire: 'heart_fire',
  heartBandage: 'heart_bandage',
  heartRevolving: 'heart_revolving',
  heartTwo: 'heart_two',
};

// ============================================================
// CORE DRAWING API
// ============================================================

/**
 * Draws a pixel-art icon onto a canvas 2D context.
 *
 * @param {CanvasRenderingContext2D} ctx — Target context
 * @param {string} iconName — Semantic icon name (from ICON_MAP) or raw emoji name
 * @param {number} x — Destination X
 * @param {number} y — Destination Y
 * @param {number} [size=16] — Render size in pixels
 * @param {Object} [options]
 * @param {string} [options.tint] — Optional CSS tint colour applied via composite
 * @param {number} [options.alpha=1] — Opacity 0..1
 */
export function drawIcon(ctx, iconName, x, y, size = DEFAULT_ICON_SIZE, options = {}) {
  const emojiName = ICON_MAP[iconName] || iconName;
  if (!hasEmoji(emojiName)) {
    console.warn(`[PixelIcon] Unknown icon: "${iconName}"`);
    return;
  }

  ctx.save();
  ctx.globalAlpha = options.alpha ?? 1;

  if (options.tint) {
    // Draw to temporary offscreen, tint, then blit
    const src = getEmoji(emojiName, 16);
    ctx.drawImage(src, x, y, size, size);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = options.tint;
    ctx.fillRect(x, y, size, size);
    ctx.globalCompositeOperation = 'source-over';
  } else {
    drawEmoji(ctx, emojiName, x, y, size);
  }

  ctx.restore();
}

/**
 * Returns a standalone canvas element with the requested icon rendered.
 *
 * @param {string} iconName
 * @param {number} [size=16]
 * @param {Object} [options]
 * @param {string} [options.bg] — Optional background colour
 * @param {number} [options.padding=0]
 * @param {number} [options.borderRadius=0]
 * @returns {HTMLCanvasElement}
 */
export function getIconCanvas(iconName, size = DEFAULT_ICON_SIZE, options = {}) {
  const emojiName = ICON_MAP[iconName] || iconName;
  const padding = options.padding ?? 0;
  const total = size + padding * 2;
  const canvas = document.createElement('canvas');
  canvas.width = total;
  canvas.height = total;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  if (options.bg) {
    ctx.fillStyle = options.bg;
    if (options.borderRadius > 0) {
      ctx.beginPath();
      ctx.roundRect(0, 0, total, total, options.borderRadius);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, total, total);
    }
  }

  drawIcon(ctx, emojiName, padding, padding, size);
  return canvas;
}

/**
 * Replaces all text-node emoji characters inside a container with canvas icons.
 * Walks DOM recursively; replaces only leaf text nodes containing emojis.
 *
 * @param {HTMLElement} container
 * @param {number} [size=16]
 * @param {Object} [options]
 * @param {boolean} [options.preserveText=false] — If true, inserts icon before text rather than replacing
 */
export function replaceEmojisInContainer(container, size = DEFAULT_ICON_SIZE, options = {}) {
  if (!container) return;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const replacements = [];

  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent;
    // Simple emoji regex: Unicode range U+1F300–U+1F9FF plus common symbols
    const emojiRegex = /([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[⭐❤️💬👤🤝🚫⚠️⚙️🎒🏪💭👥🎮🏆🎖️💎🪙✕←▶️🎵🔊🔇🟢⚪🟡🔴❤️🎁🔔🔍✏️🗑️🔒🔓👑🆕🔥⏰📍💃🪑👋😴😄💋😢😠😮😎😍🤢😕🎩🧙🐰🕊️😇😈😷👓🕶️📿📱💻📺📖🥤🍕🍦☕🎈🎉🎆☀️☁️🌧️❄️🌸🌳🍂💧⚡🌈🌍🚀🛸👻🎃💀🕷️🦇🍬🎄⛄💗💜💙💚💛🧡🖤💔💖💘💝❤️‍🔥❤️‍🩹💞💕])/gu;

    if (emojiRegex.test(text)) {
      replacements.push({ node, text });
    }
  }

  for (const { node, text } of replacements) {
    const parent = node.parentNode;
    if (!parent) continue;

    const parts = text.split(emojiRegex);
    const fragment = document.createDocumentFragment();

    for (const part of parts) {
      if (!part) continue;
      if (emojiRegex.test(part)) {
        // Try to map emoji to icon name
        const iconName = _emojiToIconName(part);
        if (iconName && hasEmoji(iconName)) {
          const canvas = getIconCanvas(iconName, size, {
            padding: 0,
            bg: options.bg ?? null,
          });
          canvas.style.display = 'inline-block';
          canvas.style.verticalAlign = 'middle';
          canvas.style.imageRendering = 'pixelated';
          fragment.appendChild(canvas);
          if (options.preserveText) {
            fragment.appendChild(document.createTextNode(part));
          }
        } else {
          fragment.appendChild(document.createTextNode(part));
        }
      } else {
        fragment.appendChild(document.createTextNode(part));
      }
    }

    parent.replaceChild(fragment, node);
  }
}

/**
 * Maps a single emoji character to a PixelEmoji drawer name.
 * @param {string} emoji
 * @returns {string|null}
 */
function _emojiToIconName(emoji) {
  const map = {
    '👤': 'profile', '💬': 'whisper', '⭐': 'friend', '🤝': 'trade',
    '🚫': 'ignore', '⚠️': 'report', '⚙️': 'settings', '🎒': 'inventory',
    '🏪': 'catalog', '👥': 'friends_list', '🎮': 'minigames', '🏆': 'achievements',
    '🎖️': 'badges', '💎': 'store', '🪙': 'coins', '✕': 'close', '←': 'back',
    '▶️': 'play', '🎵': 'music', '🔊': 'sound', '🔇': 'mute',
    '🟢': 'online', '⚪': 'offline', '🟡': 'away', '🔴': 'busy',
    '❤️': 'heart', '🎁': 'gift', '🔔': 'notification', '🔍': 'search',
    '✏️': 'edit', '🗑️': 'delete', '🔒': 'locked', '🔓': 'unlocked',
    '👑': 'crown', '🆕': 'new', '🔥': 'hot', '⏰': 'time', '📍': 'location',
    '💃': 'dance', '🪑': 'sit', '👋': 'wave', '😴': 'sleep', '😄': 'laugh',
    '💋': 'kiss', '😢': 'cry', '😠': 'angry', '😮': 'surprised',
    '😎': 'cool', '😍': 'love', '🤢': 'sick', '😕': 'confused',
    '🎩': 'cool_hat', '🧙': 'wizard', '🐰': 'bunny_ears', '🕊️': 'wings',
    '😇': 'halo', '😈': 'horns', '😷': 'mask', '👓': 'glasses',
    '🕶️': 'sunglasses', '📿': 'necklace', '📱': 'phone', '💻': 'computer',
    '📺': 'tv', '📖': 'book', '🥤': 'drink', '🍕': 'food', '🍦': 'ice_cream',
    '☕': 'coffee', '🎈': 'balloon', '🎉': 'confetti', '🎆': 'firework',
    '☀️': 'sun', '☁️': 'cloud', '🌧️': 'rain', '❄️': 'snow', '🌸': 'flower',
    '🌳': 'tree', '🍂': 'leaf', '💧': 'water', '⚡': 'bolt', '🌈': 'rainbow',
    '🌍': 'earth', '🚀': 'rocket', '🛸': 'ufo', '👻': 'ghost', '🎃': 'pumpkin',
    '💀': 'skull', '🕷️': 'spider', '🦇': 'bat', '🍬': 'candy', '🎄': 'ornament',
    '⛄': 'snowman', '💗': 'heart_pink', '💜': 'heart_purple', '💙': 'heart_blue',
    '💚': 'heart_green', '💛': 'heart_yellow', '🧡': 'heart_orange', '🖤': 'heart_black',
    '💔': 'heart_broken', '💖': 'heart_sparkle', '💘': 'heart_arrow', '💝': 'heart_ribbon',
    '💞': 'heart_revolving', '💕': 'heart_two',
  };
  return map[emoji] || null;
}

// ============================================================
// ICON BUTTON
// ============================================================

/**
 * @class IconButton
 * @description A clickable button rendered on canvas with a pixel icon and optional label.
 */
export class IconButton {
  /**
   * @param {Object} options
   * @param {string} options.icon — Icon name
   * @param {string} [options.label] — Optional text label
   * @param {number} [options.x=0]
   * @param {number} [options.y=0]
   * @param {number} [options.width=32]
   * @param {number} [options.height=32]
   * @param {number} [options.iconSize=16]
   * @param {Function} [options.onClick]
   * @param {boolean} [options.disabled=false]
   */
  constructor(options) {
    this.icon = options.icon;
    this.label = options.label || '';
    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.width = options.width ?? 32;
    this.height = options.height ?? 32;
    this.iconSize = options.iconSize ?? DEFAULT_ICON_SIZE;
    this.onClick = options.onClick || null;
    this.disabled = options.disabled ?? false;

    this.hovered = false;
    this.pressed = false;
    this.visible = true;

    // Pre-render icon canvas
    this._iconCanvas = null;
    this._refreshIcon();
  }

  /** Re-renders the internal icon canvas. */
  _refreshIcon() {
    const emojiName = ICON_MAP[this.icon] || this.icon;
    if (hasEmoji(emojiName)) {
      this._iconCanvas = getEmoji(emojiName, 16);
    }
  }

  /**
   * Sets a new icon name.
   * @param {string} name
   */
  setIcon(name) {
    this.icon = name;
    this._refreshIcon();
  }

  /**
   * Sets the button position.
   * @param {number} x
   * @param {number} y
   */
  move(x, y) {
    this.x = x;
    this.y = y;
  }

  /**
   * Hit-test for pointer input.
   * @param {number} px
   * @param {number} py
   * @returns {boolean}
   */
  containsPoint(px, py) {
    return (
      px >= this.x &&
      px < this.x + this.width &&
      py >= this.y &&
      py < this.y + this.height
    );
  }

  /**
   * Handles a pointer down event.
   * @param {number} px
   * @param {number} py
   * @returns {boolean} True if consumed
   */
  onPointerDown(px, py) {
    if (!this.visible || this.disabled) return false;
    if (this.containsPoint(px, py)) {
      this.pressed = true;
      return true;
    }
    return false;
  }

  /**
   * Handles a pointer up event.
   * @param {number} px
   * @param {number} py
   * @returns {boolean} True if consumed / clicked
   */
  onPointerUp(px, py) {
    if (!this.visible || this.disabled) return false;
    const wasPressed = this.pressed;
    this.pressed = false;
    if (wasPressed && this.containsPoint(px, py)) {
      if (this.onClick) this.onClick(this);
      return true;
    }
    return false;
  }

  /**
   * Handles a pointer move event.
   * @param {number} px
   * @param {number} py
   */
  onPointerMove(px, py) {
    this.hovered = this.containsPoint(px, py);
  }

  /**
   * Renders the button.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    if (!this.visible) return;
    ctx.save();

    // Background
    let bg = UI_COLORS.bgDefault;
    let border = UI_COLORS.borderDefault;
    if (this.disabled) {
      bg = UI_COLORS.bgDisabled;
      border = UI_COLORS.borderDefault;
    } else if (this.pressed) {
      bg = UI_COLORS.bgActive;
      border = UI_COLORS.borderActive;
    } else if (this.hovered) {
      bg = UI_COLORS.bgHover;
      border = UI_COLORS.borderHover;
    }

    // Shadow
    ctx.fillStyle = UI_COLORS.shadow;
    ctx.fillRect(this.x + 2, this.y + 2, this.width, this.height);

    // Body
    ctx.fillStyle = bg;
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // Border
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x + 0.5, this.y + 0.5, this.width - 1, this.height - 1);

    // Icon
    if (this._iconCanvas) {
      const iconX = this.x + Math.floor((this.width - this.iconSize) / 2);
      const iconY = this.y + Math.floor((this.height - this.iconSize) / 2);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = this.disabled ? 0.5 : 1;
      ctx.drawImage(this._iconCanvas, iconX, iconY, this.iconSize, this.iconSize);
      ctx.globalAlpha = 1;
    }

    // Label (if room permits)
    if (this.label && this.width >= 48) {
      ctx.fillStyle = this.disabled ? UI_COLORS.textDisabled : UI_COLORS.textDefault;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.label, this.x + this.width / 2, this.y + this.height + 8);
    }

    ctx.restore();
  }
}

// ============================================================
// ICON BADGE
// ============================================================

/**
 * @class IconBadge
 * @description A small icon with a numeric or text badge overlaid in the corner.
 */
export class IconBadge {
  /**
   * @param {Object} options
   * @param {string} options.icon
   * @param {number} [options.count=0]
   * @param {number} [options.x=0]
   * @param {number} [options.y=0]
   * @param {number} [options.size=24]
   * @param {number} [options.badgeSize=12]
   */
  constructor(options) {
    this.icon = options.icon;
    this.count = options.count ?? 0;
    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.size = options.size ?? 24;
    this.badgeSize = options.badgeSize ?? 12;
    this.visible = true;
    this._iconCanvas = null;
    this._refreshIcon();
  }

  _refreshIcon() {
    const emojiName = ICON_MAP[this.icon] || this.icon;
    if (hasEmoji(emojiName)) {
      this._iconCanvas = getEmoji(emojiName, 16);
    }
  }

  /**
   * @param {string} name
   */
  setIcon(name) {
    this.icon = name;
    this._refreshIcon();
  }

  /**
   * @param {number} n
   */
  setCount(n) {
    this.count = n;
  }

  /**
   * Renders the badge.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    if (!this.visible) return;
    ctx.save();

    // Icon background
    ctx.fillStyle = UI_COLORS.bgDefault;
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.strokeStyle = UI_COLORS.borderDefault;
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x + 0.5, this.y + 0.5, this.size - 1, this.size - 1);

    // Pixel icon
    if (this._iconCanvas) {
      const iconDrawSize = this.size - 4;
      const ix = this.x + 2;
      const iy = this.y + 2;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this._iconCanvas, ix, iy, iconDrawSize, iconDrawSize);
    }

    // Count badge
    if (this.count > 0) {
      const bx = this.x + this.size - this.badgeSize;
      const by = this.y + this.size - this.badgeSize;

      ctx.fillStyle = UI_COLORS.badgeBg;
      ctx.beginPath();
      ctx.arc(bx + this.badgeSize / 2, by + this.badgeSize / 2, this.badgeSize / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();

      const label = this.count > 99 ? '99+' : String(this.count);
      ctx.fillStyle = UI_COLORS.badgeText;
      ctx.font = label.length > 2 ? '7px monospace' : '9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, bx + this.badgeSize / 2, by + this.badgeSize / 2 + 1);
    }

    ctx.restore();
  }
}

// ============================================================
// ICON TOGGLE
// ============================================================

/**
 * @class IconToggle
 * @description A two-state toggle button with distinct on/off icons.
 */
export class IconToggle {
  /**
   * @param {Object} options
   * @param {string} options.iconOn
   * @param {string} options.iconOff
   * @param {boolean} [options.value=false]
   * @param {number} [options.x=0]
   * @param {number} [options.y=0]
   * @param {number} [options.width=32]
   * @param {number} [options.height=32]
   * @param {Function} [options.onChange]
   */
  constructor(options) {
    this.iconOn = options.iconOn;
    this.iconOff = options.iconOff;
    this.value = options.value ?? false;
    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.width = options.width ?? 32;
    this.height = options.height ?? 32;
    this.onChange = options.onChange || null;

    this.hovered = false;
    this.pressed = false;
    this.visible = true;

    this._canvasOn = null;
    this._canvasOff = null;
    this._refreshIcons();
  }

  _refreshIcons() {
    const onName = ICON_MAP[this.iconOn] || this.iconOn;
    const offName = ICON_MAP[this.iconOff] || this.iconOff;
    if (hasEmoji(onName)) this._canvasOn = getEmoji(onName, 16);
    if (hasEmoji(offName)) this._canvasOff = getEmoji(offName, 16);
  }

  /**
   * @param {boolean} v
   */
  setValue(v) {
    if (this.value !== v) {
      this.value = v;
      if (this.onChange) this.onChange(v, this);
    }
  }

  /**
   * Toggles the current value.
   */
  toggle() {
    this.setValue(!this.value);
  }

  /**
   * @param {number} px
   * @param {number} py
   * @returns {boolean}
   */
  containsPoint(px, py) {
    return (
      px >= this.x && px < this.x + this.width &&
      py >= this.y && py < this.y + this.height
    );
  }

  /**
   * @param {number} px
   * @param {number} py
   * @returns {boolean}
   */
  onPointerDown(px, py) {
    if (!this.visible) return false;
    if (this.containsPoint(px, py)) {
      this.pressed = true;
      return true;
    }
    return false;
  }

  /**
   * @param {number} px
   * @param {number} py
   * @returns {boolean}
   */
  onPointerUp(px, py) {
    if (!this.visible) return false;
    const wasPressed = this.pressed;
    this.pressed = false;
    if (wasPressed && this.containsPoint(px, py)) {
      this.toggle();
      return true;
    }
    return false;
  }

  /**
   * @param {number} px
   * @param {number} py
   */
  onPointerMove(px, py) {
    this.hovered = this.containsPoint(px, py);
  }

  /**
   * Renders the toggle.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    if (!this.visible) return;
    ctx.save();

    // Background colour depends on state
    let bg = this.value ? UI_COLORS.toggleOn + '44' : UI_COLORS.toggleOff + '44';
    let border = this.value ? UI_COLORS.toggleOn : UI_COLORS.toggleOff;

    if (this.pressed) {
      bg = UI_COLORS.bgActive;
      border = UI_COLORS.borderActive;
    } else if (this.hovered) {
      border = UI_COLORS.borderHover;
    }

    // Shadow
    ctx.fillStyle = UI_COLORS.shadow;
    ctx.fillRect(this.x + 2, this.y + 2, this.width, this.height);

    // Body
    ctx.fillStyle = bg;
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // Border
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x + 0.5, this.y + 0.5, this.width - 1, this.height - 1);

    // Icon
    const canvas = this.value ? this._canvasOn : this._canvasOff;
    if (canvas) {
      const iconSize = Math.min(this.width, this.height) - 8;
      const ix = this.x + (this.width - iconSize) / 2;
      const iy = this.y + (this.height - iconSize) / 2;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(canvas, ix, iy, iconSize, iconSize);
    }

    // Indicator dot
    const dotColor = this.value ? UI_COLORS.toggleOn : UI_COLORS.toggleOff;
    ctx.fillStyle = dotColor;
    ctx.beginPath();
    ctx.arc(this.x + this.width - 5, this.y + this.height - 5, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ============================================================
// ICON BAR (horizontal / vertical row helper)
// ============================================================

/**
 * @class IconBar
 * @description Arranges IconButtons or IconToggles in a row or column.
 */
export class IconBar {
  /**
   * @param {Object} options
   * @param {Array<IconButton|IconToggle|IconBadge>} options.items
   * @param {number} [options.x=0]
   * @param {number} [options.y=0]
   * @param {number} [options.gap=4]
   * @param {'horizontal'|'vertical'} [options.direction='horizontal']
   */
  constructor(options) {
    this.items = options.items || [];
    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.gap = options.gap ?? 4;
    this.direction = options.direction || 'horizontal';
    this.visible = true;
    this._layout();
  }

  /** Recalculates positions. */
  _layout() {
    let cx = this.x;
    let cy = this.y;
    for (const item of this.items) {
      item.x = cx;
      item.y = cy;
      if (this.direction === 'horizontal') {
        cx += (item.width ?? item.size ?? 32) + this.gap;
      } else {
        cy += (item.height ?? item.size ?? 32) + this.gap;
      }
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    if (!this.visible) return;
    for (const item of this.items) {
      item.draw(ctx);
    }
  }

  /**
   * @param {number} px
   * @param {number} py
   * @returns {IconButton|IconToggle|IconBadge|null}
   */
  hitTest(px, py) {
    for (const item of this.items) {
      if (item.containsPoint && item.containsPoint(px, py)) return item;
    }
    return null;
  }

  /**
   * @param {number} px
   * @param {number} py
   */
  onPointerMove(px, py) {
    for (const item of this.items) {
      if (item.onPointerMove) item.onPointerMove(px, py);
    }
  }

  /**
   * @param {number} px
   * @param {number} py
   * @returns {boolean}
   */
  onPointerDown(px, py) {
    for (const item of this.items) {
      if (item.onPointerDown && item.onPointerDown(px, py)) return true;
    }
    return false;
  }

  /**
   * @param {number} px
   * @param {number} py
   * @returns {boolean}
   */
  onPointerUp(px, py) {
    for (const item of this.items) {
      if (item.onPointerUp && item.onPointerUp(px, py)) return true;
    }
    return false;
  }
}

// ============================================================
// MODULE EXPORTS
// ============================================================

export {
  DEFAULT_ICON_SIZE,
  LARGE_ICON_SIZE,
  UI_COLORS,
};

export default {
  drawIcon,
  getIconCanvas,
  replaceEmojisInContainer,
  ICON_MAP,
  IconButton,
  IconBadge,
  IconToggle,
  IconBar,
  DEFAULT_ICON_SIZE,
  LARGE_ICON_SIZE,
  UI_COLORS,
};
