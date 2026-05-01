/**
 * ClothingCatalog.js
 * Starlight Inn v7.0 — Habbo-style Isometric Clothing & Accessory Asset Factory
 * 40+ procedural Canvas 2D sprites for avatar layering.
 * Each item: id, name, category, price, rarity, layer order, draw function.
 *
 * @version 7.0.0
 * @module StarlightInn/assets/ClothingCatalog
 */

'use strict';

/* ──────────── shared Habbo palette & helpers ──────────── */
const CLOT = {
  outline: '#000000',
  // skin tones for reference
  skinLight: '#FFCC80', skinMid: '#FFAB91', skinDark: '#E6A075',
  // shirts
  shirtWhite: '#FFFFFF', shirtGrey: '#EEEEEE', shirtBlack: '#212121',
  shirtRed: '#EF5350', shirtBlue: '#42A5F5', shirtGreen: '#66BB6A',
  shirtYellow: '#FFEE58', shirtPink: '#F48FB1', shirtPurple: '#AB47BC',
  shirtOrange: '#FFAB40',
  // hoodies
  hoodieNavy: '#1A237E', hoodieCharcoal: '#424242', hoodieTeal: '#00695C',
  // jackets
  jacketLeather: '#5D4037', jacketDenim: '#1565C0', jacketBomber: '#D32F2F',
  // dresses
  dressRed: '#E91E63', dressBlue: '#2196F3', dressBlack: '#212121',
  dressGold: '#FFD700', dressWhite: '#FFFFFF',
  // suits
  suitNavy: '#0D47A1', suitCharcoal: '#263238', suitWhite: '#FAFAFA',
  // wizard
  wizardRobe: '#4A148C', wizardRobeLight: '#7C4DFF', wizardRobeDark: '#311B92',
  // pants
  pantsJean: '#1565C0', pantsJeanLight: '#42A5F5', pantsJeanDark: '#0D47A1',
  pantsShortsRed: '#D32F2F', pantsShortsBlue: '#1976D2',
  pantsSkirtPink: '#F48FB1', pantsSkirtBlack: '#212121',
  pantsSweatGrey: '#9E9E9E', pantsSweatDark: '#616161',
  // shoes
  shoeWhite: '#FFFFFF', shoeBlack: '#212121', shoeRed: '#D32F2F',
  shoeBrown: '#8D6E63', shoeBlue: '#1976D2', shoeGold: '#FFD700',
  // hats
  hatCapRed: '#D32F2F', hatCapBlue: '#1976D2', hatCapBlack: '#212121',
  hatBeanieGrey: '#9E9E9E', hatBeaniePink: '#F48FB1',
  hatCrownGold: '#FFD700', hatCrownJewel: '#D32F2F',
  hatWizard: '#4A148C', hatBunnyPink: '#F8BBD0',
  // accessories
  glassesBlack: '#212121', glassesLens: '#81D4FA', glassesGold: '#FFD700',
  maskWhite: '#FFFFFF', maskBlack: '#212121',
  wingsWhite: '#E1F5FE', wingsGold: '#FFF9C4',
  necklaceGold: '#FFD700', necklaceGem: '#E91E63',
  backpackRed: '#D32F2F', backpackBlue: '#1976D2',
  haloGold: '#FFD700', haloGlow: '#FFF9C4',
  hornsRed: '#D32F2F', hornsDark: '#B71C1C',
  // facial
  hairBrown: '#5D4037', hairBlonde: '#FDD835', hairBlack: '#212121',
  mustacheBrown: '#5D4037', mustacheBlack: '#212121',
  beardBrown: '#6D4C41', beardBlack: '#212121',
  blush: '#F48FB1', facePaintStar: '#FFEE58', facePaintStripe: '#42A5F5',
};

/**
 * Avatar layering order (bottom → top):
 * 0 skin/body, 1 pants, 2 shoes, 3 shirt, 4 jacket/hoodie, 5 accessories back,
 * 6 head, 7 hat, 8 accessories front, 9 facial
 */
const LAYER_ORDER = {
  body: 0, pants: 1, shoes: 2, shirt: 3, jacket: 4,
  accessoryBack: 5, head: 6, hat: 7, accessoryFront: 8, facial: 9,
};

function makeClothing({ id, name, category, price, rarity, layer, draw }) {
  return { id, name, category, price, rarity, layer, draw };
}

/* ═══════════════════════════════════════════════════════════════
   SHIRTS (8 items)
   ═══════════════════════════════════════════════════════════════ */

ClothingCatalog.shirt_white = makeClothing({
  id: 'shirt_white', name: 'White T-Shirt', category: 'shirts', price: 50, rarity: 'Common', layer: LAYER_ORDER.shirt,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.shirtWhite; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    // torso block
    ctx.fillRect(x - 10, y - 28, 20, 18); ctx.strokeRect(x - 10, y - 28, 20, 18);
    // sleeves
    if (facing === 'SE') {
      ctx.fillRect(x + 8, y - 26, 8, 10); ctx.strokeRect(x + 8, y - 26, 8, 10);
    } else {
      ctx.fillRect(x - 16, y - 26, 8, 10); ctx.strokeRect(x - 16, y - 26, 8, 10);
    }
    ctx.restore();
  }
});

ClothingCatalog.shirt_black = makeClothing({
  id: 'shirt_black', name: 'Black T-Shirt', category: 'shirts', price: 50, rarity: 'Common', layer: LAYER_ORDER.shirt,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.shirtBlack; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 10, y - 28, 20, 18); ctx.strokeRect(x - 10, y - 28, 20, 18);
    if (facing === 'SE') { ctx.fillRect(x + 8, y - 26, 8, 10); ctx.strokeRect(x + 8, y - 26, 8, 10); }
    else { ctx.fillRect(x - 16, y - 26, 8, 10); ctx.strokeRect(x - 16, y - 26, 8, 10); }
    ctx.restore();
  }
});

ClothingCatalog.shirt_red = makeClothing({
  id: 'shirt_red', name: 'Red T-Shirt', category: 'shirts', price: 60, rarity: 'Common', layer: LAYER_ORDER.shirt,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.shirtRed; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 10, y - 28, 20, 18); ctx.strokeRect(x - 10, y - 28, 20, 18);
    if (facing === 'SE') { ctx.fillRect(x + 8, y - 26, 8, 10); ctx.strokeRect(x + 8, y - 26, 8, 10); }
    else { ctx.fillRect(x - 16, y - 26, 8, 10); ctx.strokeRect(x - 16, y - 26, 8, 10); }
    ctx.restore();
  }
});

ClothingCatalog.shirt_blue = makeClothing({
  id: 'shirt_blue', name: 'Blue T-Shirt', category: 'shirts', price: 60, rarity: 'Common', layer: LAYER_ORDER.shirt,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.shirtBlue; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 10, y - 28, 20, 18); ctx.strokeRect(x - 10, y - 28, 20, 18);
    if (facing === 'SE') { ctx.fillRect(x + 8, y - 26, 8, 10); ctx.strokeRect(x + 8, y - 26, 8, 10); }
    else { ctx.fillRect(x - 16, y - 26, 8, 10); ctx.strokeRect(x - 16, y - 26, 8, 10); }
    ctx.restore();
  }
});

ClothingCatalog.shirt_striped = makeClothing({
  id: 'shirt_striped', name: 'Striped Shirt', category: 'shirts', price: 80, rarity: 'Uncommon', layer: LAYER_ORDER.shirt,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.shirtWhite; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 10, y - 28, 20, 18); ctx.strokeRect(x - 10, y - 28, 20, 18);
    // stripes
    ctx.fillStyle = CLOT.shirtRed;
    ctx.fillRect(x - 10, y - 26, 20, 3); ctx.fillRect(x - 10, y - 20, 20, 3); ctx.fillRect(x - 10, y - 14, 20, 3);
    if (facing === 'SE') { ctx.fillRect(x + 8, y - 26, 8, 10); ctx.strokeRect(x + 8, y - 26, 8, 10); }
    else { ctx.fillRect(x - 16, y - 26, 8, 10); ctx.strokeRect(x - 16, y - 26, 8, 10); }
    ctx.restore();
  }
});

ClothingCatalog.hoodie_navy = makeClothing({
  id: 'hoodie_navy', name: 'Navy Hoodie', category: 'shirts', price: 150, rarity: 'Common', layer: LAYER_ORDER.shirt,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.hoodieNavy; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 11, y - 29, 22, 19); ctx.strokeRect(x - 11, y - 29, 22, 19);
    // hood (behind head, but drawn here as part of shirt layer)
    ctx.fillStyle = CLOT.hoodieCharcoal;
    ctx.beginPath(); ctx.arc(x, y - 36, 10, Math.PI, 0); ctx.fill(); ctx.stroke();
    // pocket
    ctx.fillStyle = CLOT.hoodieTeal;
    ctx.fillRect(x - 6, y - 18, 12, 6); ctx.strokeRect(x - 6, y - 18, 12, 6);
    if (facing === 'SE') { ctx.fillRect(x + 8, y - 26, 9, 11); ctx.strokeRect(x + 8, y - 26, 9, 11); }
    else { ctx.fillRect(x - 17, y - 26, 9, 11); ctx.strokeRect(x - 17, y - 26, 9, 11); }
    ctx.restore();
  }
});

ClothingCatalog.jacket_leather = makeClothing({
  id: 'jacket_leather', name: 'Leather Jacket', category: 'shirts', price: 250, rarity: 'Uncommon', layer: LAYER_ORDER.jacket,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.jacketLeather; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 12, y - 30, 24, 20); ctx.strokeRect(x - 12, y - 30, 24, 20);
    // collar
    ctx.fillStyle = '#3E2723';
    ctx.beginPath(); ctx.moveTo(x - 8, y - 30); ctx.lineTo(x, y - 24); ctx.lineTo(x + 8, y - 30); ctx.closePath(); ctx.fill(); ctx.stroke();
    // zipper line
    ctx.strokeStyle = '#8D6E63'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y - 30); ctx.lineTo(x, y - 10); ctx.stroke();
    if (facing === 'SE') { ctx.fillRect(x + 9, y - 26, 9, 12); ctx.strokeRect(x + 9, y - 26, 9, 12); }
    else { ctx.fillRect(x - 18, y - 26, 9, 12); ctx.strokeRect(x - 18, y - 26, 9, 12); }
    ctx.restore();
  }
});

ClothingCatalog.jacket_bomber = makeClothing({
  id: 'jacket_bomber', name: 'Bomber Jacket', category: 'shirts', price: 280, rarity: 'Uncommon', layer: LAYER_ORDER.jacket,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.jacketBomber; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 12, y - 30, 24, 20); ctx.strokeRect(x - 12, y - 30, 24, 20);
    // orange lining
    ctx.fillStyle = '#FFAB40';
    ctx.fillRect(x - 12, y - 30, 24, 4); ctx.strokeRect(x - 12, y - 30, 24, 4);
    if (facing === 'SE') { ctx.fillRect(x + 9, y - 26, 9, 12); ctx.strokeRect(x + 9, y - 26, 9, 12); }
    else { ctx.fillRect(x - 18, y - 26, 9, 12); ctx.strokeRect(x - 18, y - 26, 9, 12); }
    ctx.restore();
  }
});

ClothingCatalog.dress_red = makeClothing({
  id: 'dress_red', name: 'Red Evening Dress', category: 'shirts', price: 400, rarity: 'Uncommon', layer: LAYER_ORDER.shirt,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.dressRed; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    // bodice
    ctx.fillRect(x - 8, y - 30, 16, 16); ctx.strokeRect(x - 8, y - 30, 16, 16);
    // skirt (wider)
    ctx.beginPath(); ctx.moveTo(x - 8, y - 14); ctx.lineTo(x + 8, y - 14);
    ctx.lineTo(x + 14, y - 2); ctx.lineTo(x - 14, y - 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    // neckline
    ctx.fillStyle = '#F48FB1';
    ctx.beginPath(); ctx.moveTo(x - 4, y - 30); ctx.lineTo(x + 4, y - 30); ctx.lineTo(x, y - 24); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

ClothingCatalog.dress_gold = makeClothing({
  id: 'dress_gold', name: 'Golden Gown', category: 'shirts', price: 1200, rarity: 'Rare', layer: LAYER_ORDER.shirt,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.dressGold; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 8, y - 30, 16, 16); ctx.strokeRect(x - 8, y - 30, 16, 16);
    ctx.beginPath(); ctx.moveTo(x - 8, y - 14); ctx.lineTo(x + 8, y - 14);
    ctx.lineTo(x + 16, y); ctx.lineTo(x - 16, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    // sparkle
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x - 2, y - 20, 2, 2); ctx.fillRect(x + 4, y - 12, 2, 2);
    ctx.restore();
  }
});

ClothingCatalog.suit_navy = makeClothing({
  id: 'suit_navy', name: 'Navy Suit', category: 'shirts', price: 600, rarity: 'Uncommon', layer: LAYER_ORDER.jacket,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.suitNavy; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 11, y - 30, 22, 20); ctx.strokeRect(x - 11, y - 30, 22, 20);
    // tie
    ctx.fillStyle = '#D32F2F';
    ctx.beginPath(); ctx.moveTo(x - 2, y - 30); ctx.lineTo(x + 2, y - 30); ctx.lineTo(x, y - 16); ctx.closePath(); ctx.fill(); ctx.stroke();
    // lapels
    ctx.fillStyle = '#1565C0';
    ctx.beginPath(); ctx.moveTo(x - 8, y - 30); ctx.lineTo(x - 2, y - 22); ctx.lineTo(x - 11, y - 22); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 8, y - 30); ctx.lineTo(x + 2, y - 22); ctx.lineTo(x + 11, y - 22); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (facing === 'SE') { ctx.fillRect(x + 8, y - 26, 8, 12); ctx.strokeRect(x + 8, y - 26, 8, 12); }
    else { ctx.fillRect(x - 16, y - 26, 8, 12); ctx.strokeRect(x - 16, y - 26, 8, 12); }
    ctx.restore();
  }
});

ClothingCatalog.suit_white = makeClothing({
  id: 'suit_white', name: 'White Tuxedo', category: 'shirts', price: 700, rarity: 'Uncommon', layer: LAYER_ORDER.jacket,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.suitWhite; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 11, y - 30, 22, 20); ctx.strokeRect(x - 11, y - 30, 22, 20);
    ctx.fillStyle = '#000000';
    ctx.beginPath(); ctx.moveTo(x - 2, y - 30); ctx.lineTo(x + 2, y - 30); ctx.lineTo(x, y - 16); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (facing === 'SE') { ctx.fillRect(x + 8, y - 26, 8, 12); ctx.strokeRect(x + 8, y - 26, 8, 12); }
    else { ctx.fillRect(x - 16, y - 26, 8, 12); ctx.strokeRect(x - 16, y - 26, 8, 12); }
    ctx.restore();
  }
});

ClothingCatalog.wizard_robe = makeClothing({
  id: 'wizard_robe', name: 'Wizard Robe', category: 'shirts', price: 800, rarity: 'Rare', layer: LAYER_ORDER.shirt,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.wizardRobe; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    // long robe
    ctx.fillRect(x - 12, y - 30, 24, 20); ctx.strokeRect(x - 12, y - 30, 24, 20);
    ctx.beginPath(); ctx.moveTo(x - 12, y - 10); ctx.lineTo(x + 12, y - 10);
    ctx.lineTo(x + 18, y + 6); ctx.lineTo(x - 18, y + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    // star emblem
    ctx.fillStyle = '#FFEE58';
    ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.lineTo(x + 2, y - 14); ctx.lineTo(x + 6, y - 14);
    ctx.lineTo(x + 3, y - 11); ctx.lineTo(x + 4, y - 7); ctx.lineTo(x, y - 9);
    ctx.lineTo(x - 4, y - 7); ctx.lineTo(x - 3, y - 11); ctx.lineTo(x - 6, y - 14);
    ctx.lineTo(x - 2, y - 14); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

/* ═══════════════════════════════════════════════════════════════
   PANTS (6 items)
   ═══════════════════════════════════════════════════════════════ */

ClothingCatalog.pants_jean = makeClothing({
  id: 'pants_jean', name: 'Blue Jeans', category: 'pants', price: 80, rarity: 'Common', layer: LAYER_ORDER.pants,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.pantsJean; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 9, y - 14, 18, 12); ctx.strokeRect(x - 9, y - 14, 18, 12);
    // seam
    ctx.strokeStyle = CLOT.pantsJeanDark; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 4, y - 14); ctx.lineTo(x - 4, y - 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 4, y - 14); ctx.lineTo(x + 4, y - 2); ctx.stroke();
    ctx.restore();
  }
});

ClothingCatalog.pants_jean_ripped = makeClothing({
  id: 'pants_jean_ripped', name: 'Ripped Jeans', category: 'pants', price: 100, rarity: 'Uncommon', layer: LAYER_ORDER.pants,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.pantsJeanLight; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 9, y - 14, 18, 12); ctx.strokeRect(x - 9, y - 14, 18, 12);
    // rips
    ctx.fillStyle = CLOT.skinMid;
    ctx.fillRect(x - 6, y - 10, 4, 3); ctx.strokeRect(x - 6, y - 10, 4, 3);
    ctx.fillRect(x + 4, y - 6, 3, 3); ctx.strokeRect(x + 4, y - 6, 3, 3);
    ctx.restore();
  }
});

ClothingCatalog.pants_shorts_red = makeClothing({
  id: 'pants_shorts_red', name: 'Red Shorts', category: 'pants', price: 60, rarity: 'Common', layer: LAYER_ORDER.pants,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.pantsShortsRed; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 9, y - 14, 18, 8); ctx.strokeRect(x - 9, y - 14, 18, 8);
    // leg showing below
    ctx.fillStyle = CLOT.skinMid;
    ctx.fillRect(x - 6, y - 6, 4, 6); ctx.strokeRect(x - 6, y - 6, 4, 6);
    ctx.fillRect(x + 2, y - 6, 4, 6); ctx.strokeRect(x + 2, y - 6, 4, 6);
    ctx.restore();
  }
});

ClothingCatalog.pants_skirt_pink = makeClothing({
  id: 'pants_skirt_pink', name: 'Pink Skirt', category: 'pants', price: 90, rarity: 'Common', layer: LAYER_ORDER.pants,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.pantsSkirtPink; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 8, y - 14); ctx.lineTo(x + 8, y - 14);
    ctx.lineTo(x + 14, y - 2); ctx.lineTo(x - 14, y - 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    // pleats
    ctx.strokeStyle = '#F06292'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 4, y - 14); ctx.lineTo(x - 6, y - 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 4, y - 14); ctx.lineTo(x + 6, y - 2); ctx.stroke();
    ctx.restore();
  }
});

ClothingCatalog.pants_skirt_black = makeClothing({
  id: 'pants_skirt_black', name: 'Black Mini Skirt', category: 'pants', price: 100, rarity: 'Common', layer: LAYER_ORDER.pants,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.pantsSkirtBlack; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 8, y - 14); ctx.lineTo(x + 8, y - 14);
    ctx.lineTo(x + 12, y - 4); ctx.lineTo(x - 12, y - 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

ClothingCatalog.pants_sweatpants = makeClothing({
  id: 'pants_sweatpants', name: 'Grey Sweatpants', category: 'pants', price: 70, rarity: 'Common', layer: LAYER_ORDER.pants,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.pantsSweatGrey; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 9, y - 14, 18, 12); ctx.strokeRect(x - 9, y - 14, 18, 12);
    // cuffs
    ctx.fillStyle = CLOT.pantsSweatDark;
    ctx.fillRect(x - 9, y - 4, 18, 4); ctx.strokeRect(x - 9, y - 4, 18, 4);
    ctx.restore();
  }
});

/* ═══════════════════════════════════════════════════════════════
   SHOES (6 items)
   ═══════════════════════════════════════════════════════════════ */

ClothingCatalog.shoes_sneaker_white = makeClothing({
  id: 'shoes_sneaker_white', name: 'White Sneakers', category: 'shoes', price: 60, rarity: 'Common', layer: LAYER_ORDER.shoes,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.shoeWhite; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    if (facing === 'SE') {
      ctx.fillRect(x + 2, y - 4, 10, 6); ctx.strokeRect(x + 2, y - 4, 10, 6);
    } else {
      ctx.fillRect(x - 12, y - 4, 10, 6); ctx.strokeRect(x - 12, y - 4, 10, 6);
    }
    ctx.restore();
  }
});

ClothingCatalog.shoes_sneaker_red = makeClothing({
  id: 'shoes_sneaker_red', name: 'Red Sneakers', category: 'shoes', price: 70, rarity: 'Common', layer: LAYER_ORDER.shoes,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.shoeRed; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    if (facing === 'SE') { ctx.fillRect(x + 2, y - 4, 10, 6); ctx.strokeRect(x + 2, y - 4, 10, 6); }
    else { ctx.fillRect(x - 12, y - 4, 10, 6); ctx.strokeRect(x - 12, y - 4, 10, 6); }
    ctx.restore();
  }
});

ClothingCatalog.shoes_boots_brown = makeClothing({
  id: 'shoes_boots_brown', name: 'Brown Boots', category: 'shoes', price: 120, rarity: 'Common', layer: LAYER_ORDER.shoes,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.shoeBrown; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    if (facing === 'SE') {
      ctx.fillRect(x + 2, y - 6, 10, 8); ctx.strokeRect(x + 2, y - 6, 10, 8);
      // boot top
      ctx.fillRect(x + 2, y - 10, 10, 4); ctx.strokeRect(x + 2, y - 10, 10, 4);
    } else {
      ctx.fillRect(x - 12, y - 6, 10, 8); ctx.strokeRect(x - 12, y - 6, 10, 8);
      ctx.fillRect(x - 12, y - 10, 10, 4); ctx.strokeRect(x - 12, y - 10, 10, 4);
    }
    ctx.restore();
  }
});

ClothingCatalog.shoes_boots_black = makeClothing({
  id: 'shoes_boots_black', name: 'Black Boots', category: 'shoes', price: 130, rarity: 'Uncommon', layer: LAYER_ORDER.shoes,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.shoeBlack; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    if (facing === 'SE') {
      ctx.fillRect(x + 2, y - 6, 10, 8); ctx.strokeRect(x + 2, y - 6, 10, 8);
      ctx.fillRect(x + 2, y - 12, 10, 6); ctx.strokeRect(x + 2, y - 12, 10, 6);
    } else {
      ctx.fillRect(x - 12, y - 6, 10, 8); ctx.strokeRect(x - 12, y - 6, 10, 8);
      ctx.fillRect(x - 12, y - 12, 10, 6); ctx.strokeRect(x - 12, y - 12, 10, 6);
    }
    ctx.restore();
  }
});

ClothingCatalog.shoes_sandals = makeClothing({
  id: 'shoes_sandals', name: 'Sandals', category: 'shoes', price: 40, rarity: 'Common', layer: LAYER_ORDER.shoes,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.shoeBrown; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    if (facing === 'SE') {
      ctx.fillRect(x + 2, y - 2, 10, 4); ctx.strokeRect(x + 2, y - 2, 10, 4);
      // strap
      ctx.strokeStyle = CLOT.shoeBrown; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 4, y - 4); ctx.lineTo(x + 10, y - 4); ctx.stroke();
    } else {
      ctx.fillRect(x - 12, y - 2, 10, 4); ctx.strokeRect(x - 12, y - 2, 10, 4);
      ctx.beginPath(); ctx.moveTo(x - 10, y - 4); ctx.lineTo(x - 4, y - 4); ctx.stroke();
    }
    ctx.restore();
  }
});

ClothingCatalog.shoes_slippers = makeClothing({
  id: 'shoes_slippers', name: 'Bunny Slippers', category: 'shoes', price: 90, rarity: 'Uncommon', layer: LAYER_ORDER.shoes,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#F8BBD0'; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    if (facing === 'SE') {
      ctx.beginPath(); ctx.ellipse(x + 7, y - 2, 8, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // ears
      ctx.fillStyle = '#F48FB1';
      ctx.fillRect(x + 3, y - 10, 3, 8); ctx.strokeRect(x + 3, y - 10, 3, 8);
      ctx.fillRect(x + 8, y - 10, 3, 8); ctx.strokeRect(x + 8, y - 10, 3, 8);
    } else {
      ctx.beginPath(); ctx.ellipse(x - 7, y - 2, 8, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#F48FB1';
      ctx.fillRect(x - 10, y - 10, 3, 8); ctx.strokeRect(x - 10, y - 10, 3, 8);
      ctx.fillRect(x - 5, y - 10, 3, 8); ctx.strokeRect(x - 5, y - 10, 3, 8);
    }
    ctx.restore();
  }
});

/* ═══════════════════════════════════════════════════════════════
   HATS (6 items)
   ═══════════════════════════════════════════════════════════════ */

ClothingCatalog.hat_cap_red = makeClothing({
  id: 'hat_cap_red', name: 'Red Cap', category: 'hats', price: 80, rarity: 'Common', layer: LAYER_ORDER.hat,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.hatCapRed; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y - 42, 10, Math.PI, 0); ctx.fill(); ctx.stroke();
    // brim
    ctx.fillRect(x - 4, y - 42, 14, 4); ctx.strokeRect(x - 4, y - 42, 14, 4);
    ctx.restore();
  }
});

ClothingCatalog.hat_cap_blue = makeClothing({
  id: 'hat_cap_blue', name: 'Blue Cap', category: 'hats', price: 80, rarity: 'Common', layer: LAYER_ORDER.hat,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.hatCapBlue; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y - 42, 10, Math.PI, 0); ctx.fill(); ctx.stroke();
    ctx.fillRect(x - 4, y - 42, 14, 4); ctx.strokeRect(x - 4, y - 42, 14, 4);
    ctx.restore();
  }
});

ClothingCatalog.hat_beanie_grey = makeClothing({
  id: 'hat_beanie_grey', name: 'Grey Beanie', category: 'hats', price: 70, rarity: 'Common', layer: LAYER_ORDER.hat,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.hatBeanieGrey; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y - 44, 11, Math.PI, 0); ctx.fill(); ctx.stroke();
    ctx.fillRect(x - 11, y - 44, 22, 5); ctx.strokeRect(x - 11, y - 44, 22, 5);
    // pom-pom
    ctx.fillStyle = '#B0BEC5';
    ctx.beginPath(); ctx.arc(x, y - 56, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

ClothingCatalog.hat_crown_gold = makeClothing({
  id: 'hat_crown_gold', name: 'Golden Crown', category: 'hats', price: 1500, rarity: 'Legendary', layer: LAYER_ORDER.hat,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.hatCrownGold; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 10, y - 48, 20, 4); ctx.strokeRect(x - 10, y - 48, 20, 4);
    // points
    ctx.beginPath(); ctx.moveTo(x - 10, y - 48); ctx.lineTo(x - 6, y - 58); ctx.lineTo(x - 2, y - 48); ctx.lineTo(x + 2, y - 56);
    ctx.lineTo(x + 6, y - 48); ctx.lineTo(x + 10, y - 58); ctx.lineTo(x + 10, y - 48); ctx.closePath(); ctx.fill(); ctx.stroke();
    // jewels
    ctx.fillStyle = CLOT.hatCrownJewel;
    ctx.beginPath(); ctx.arc(x - 6, y - 52, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 2, y - 50, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 8, y - 52, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
});

ClothingCatalog.hat_wizard = makeClothing({
  id: 'hat_wizard', name: 'Wizard Hat', category: 'hats', price: 500, rarity: 'Rare', layer: LAYER_ORDER.hat,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.hatWizard; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 46, 14, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // cone
    ctx.beginPath(); ctx.moveTo(x - 12, y - 46); ctx.lineTo(x, y - 72); ctx.lineTo(x + 12, y - 46); ctx.closePath(); ctx.fill(); ctx.stroke();
    // star
    ctx.fillStyle = '#FFEE58';
    ctx.beginPath(); ctx.moveTo(x, y - 58); ctx.lineTo(x + 2, y - 54); ctx.lineTo(x + 4, y - 54);
    ctx.lineTo(x + 2, y - 52); ctx.lineTo(x + 3, y - 50); ctx.lineTo(x, y - 51);
    ctx.lineTo(x - 3, y - 50); ctx.lineTo(x - 2, y - 52); ctx.lineTo(x - 4, y - 54);
    ctx.lineTo(x - 2, y - 54); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

ClothingCatalog.hat_bunny_ears = makeClothing({
  id: 'hat_bunny_ears', name: 'Bunny Ears', category: 'hats', price: 200, rarity: 'Uncommon', layer: LAYER_ORDER.hat,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // headband
    ctx.fillStyle = CLOT.hatBunnyPink; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 10, y - 48, 20, 4); ctx.strokeRect(x - 10, y - 48, 20, 4);
    // ears
    ctx.fillRect(x - 8, y - 68, 5, 22); ctx.strokeRect(x - 8, y - 68, 5, 22);
    ctx.fillRect(x + 3, y - 68, 5, 22); ctx.strokeRect(x + 3, y - 68, 5, 22);
    // inner ear
    ctx.fillStyle = '#F48FB1';
    ctx.fillRect(x - 7, y - 62, 3, 12); ctx.fillRect(x + 4, y - 62, 3, 12);
    ctx.restore();
  }
});

/* ═══════════════════════════════════════════════════════════════
   ACCESSORIES (8 items)
   ═══════════════════════════════════════════════════════════════ */

ClothingCatalog.glasses_black = makeClothing({
  id: 'glasses_black', name: 'Black Glasses', category: 'accessories', price: 60, rarity: 'Common', layer: LAYER_ORDER.accessoryFront,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.strokeStyle = CLOT.glassesBlack; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x - 5, y - 36, 4, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 5, y - 36, 4, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 1, y - 36); ctx.lineTo(x + 1, y - 36); ctx.stroke();
    ctx.restore();
  }
});

ClothingCatalog.glasses_sun = makeClothing({
  id: 'glasses_sun', name: 'Sunglasses', category: 'accessories', price: 80, rarity: 'Common', layer: LAYER_ORDER.accessoryFront,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.glassesBlack; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x - 5, y - 36, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 5, y - 36, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - 36); ctx.lineTo(x + 2, y - 36); ctx.stroke();
    // lens shine
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x - 7, y - 38, 2, 2); ctx.fillRect(x + 3, y - 38, 2, 2);
    ctx.restore();
  }
});

ClothingCatalog.mask_white = makeClothing({
  id: 'mask_white', name: 'White Mask', category: 'accessories', price: 50, rarity: 'Common', layer: LAYER_ORDER.accessoryFront,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.maskWhite; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 32, 8, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // eye holes
    ctx.fillStyle = CLOT.outline;
    ctx.fillRect(x - 4, y - 34, 2, 2); ctx.fillRect(x + 2, y - 34, 2, 2);
    ctx.restore();
  }
});

ClothingCatalog.wings_white = makeClothing({
  id: 'wings_white', name: 'Angel Wings', category: 'accessories', price: 800, rarity: 'Rare', layer: LAYER_ORDER.accessoryBack,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.wingsWhite; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    // left wing
    ctx.beginPath(); ctx.ellipse(x - 14, y - 28, 10, 18, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // right wing
    ctx.beginPath(); ctx.ellipse(x + 14, y - 28, 10, 18, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

ClothingCatalog.wings_gold = makeClothing({
  id: 'wings_gold', name: 'Golden Wings', category: 'accessories', price: 1200, rarity: 'Epic', layer: LAYER_ORDER.accessoryBack,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.wingsGold; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x - 14, y - 28, 10, 18, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + 14, y - 28, 10, 18, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // feather detail
    ctx.strokeStyle = '#F9A825'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 14, y - 38); ctx.lineTo(x - 14, y - 18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 14, y - 38); ctx.lineTo(x + 14, y - 18); ctx.stroke();
    ctx.restore();
  }
});

ClothingCatalog.necklace_gold = makeClothing({
  id: 'necklace_gold', name: 'Gold Necklace', category: 'accessories', price: 200, rarity: 'Uncommon', layer: LAYER_ORDER.accessoryFront,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.strokeStyle = CLOT.necklaceGold; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 6, y - 28); ctx.quadraticCurveTo(x, y - 20, x + 6, y - 28); ctx.stroke();
    // pendant
    ctx.fillStyle = CLOT.necklaceGem;
    ctx.beginPath(); ctx.arc(x, y - 22, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

ClothingCatalog.backpack_red = makeClothing({
  id: 'backpack_red', name: 'Red Backpack', category: 'accessories', price: 150, rarity: 'Common', layer: LAYER_ORDER.accessoryBack,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.backpackRed; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    // body behind
    ctx.fillRect(x - 8, y - 26, 16, 18); ctx.strokeRect(x - 8, y - 26, 16, 18);
    // flap
    ctx.fillStyle = '#B71C1C';
    ctx.fillRect(x - 8, y - 26, 16, 8); ctx.strokeRect(x - 8, y - 26, 16, 8);
    // straps
    ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 4, y - 28); ctx.lineTo(x - 4, y - 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 4, y - 28); ctx.lineTo(x + 4, y - 14); ctx.stroke();
    ctx.restore();
  }
});

ClothingCatalog.backpack_blue = makeClothing({
  id: 'backpack_blue', name: 'Blue Backpack', category: 'accessories', price: 150, rarity: 'Common', layer: LAYER_ORDER.accessoryBack,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.backpackBlue; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 8, y - 26, 16, 18); ctx.strokeRect(x - 8, y - 26, 16, 18);
    ctx.fillStyle = '#0D47A1';
    ctx.fillRect(x - 8, y - 26, 16, 8); ctx.strokeRect(x - 8, y - 26, 16, 8);
    ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 4, y - 28); ctx.lineTo(x - 4, y - 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 4, y - 28); ctx.lineTo(x + 4, y - 14); ctx.stroke();
    ctx.restore();
  }
});

ClothingCatalog.halo_gold = makeClothing({
  id: 'halo_gold', name: 'Golden Halo', category: 'accessories', price: 600, rarity: 'Rare', layer: LAYER_ORDER.hat,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.strokeStyle = CLOT.haloGold; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, y - 56, 12, 4, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = CLOT.haloGlow; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y - 56, 14, 5, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
});

ClothingCatalog.horns_red = makeClothing({
  id: 'horns_red', name: 'Devil Horns', category: 'accessories', price: 350, rarity: 'Uncommon', layer: LAYER_ORDER.hat,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.hornsRed; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 2;
    // headband
    ctx.fillRect(x - 10, y - 48, 20, 3); ctx.strokeRect(x - 10, y - 48, 20, 3);
    // horns
    ctx.beginPath(); ctx.moveTo(x - 6, y - 48); ctx.lineTo(x - 10, y - 60); ctx.lineTo(x - 2, y - 50); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 6, y - 48); ctx.lineTo(x + 10, y - 60); ctx.lineTo(x + 2, y - 50); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

/* ═══════════════════════════════════════════════════════════════
   FACIAL (6 items)
   ═══════════════════════════════════════════════════════════════ */

ClothingCatalog.mustache_brown = makeClothing({
  id: 'mustache_brown', name: 'Brown Mustache', category: 'facial', price: 40, rarity: 'Common', layer: LAYER_ORDER.facial,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.mustacheBrown; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 6, y - 30); ctx.quadraticCurveTo(x - 2, y - 26, x, y - 30);
    ctx.quadraticCurveTo(x + 2, y - 26, x + 6, y - 30); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

ClothingCatalog.mustache_curly = makeClothing({
  id: 'mustache_curly', name: 'Curly Mustache', category: 'facial', price: 60, rarity: 'Uncommon', layer: LAYER_ORDER.facial,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.strokeStyle = CLOT.mustacheBlack; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 8, y - 30); ctx.quadraticCurveTo(x - 4, y - 24, x, y - 30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 8, y - 30); ctx.quadraticCurveTo(x + 4, y - 24, x, y - 30); ctx.stroke();
    ctx.restore();
  }
});

ClothingCatalog.beard_short = makeClothing({
  id: 'beard_short', name: 'Short Beard', category: 'facial', price: 50, rarity: 'Common', layer: LAYER_ORDER.facial,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.beardBrown; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 1;
    ctx.fillRect(x - 6, y - 28, 12, 6); ctx.strokeRect(x - 6, y - 28, 12, 6);
    ctx.restore();
  }
});

ClothingCatalog.beard_long = makeClothing({
  id: 'beard_long', name: 'Long Beard', category: 'facial', price: 70, rarity: 'Uncommon', layer: LAYER_ORDER.facial,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.beardBrown; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 1;
    ctx.fillRect(x - 6, y - 28, 12, 6); ctx.strokeRect(x - 6, y - 28, 12, 6);
    ctx.beginPath(); ctx.moveTo(x - 4, y - 22); ctx.lineTo(x, y - 14); ctx.lineTo(x + 4, y - 22); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

ClothingCatalog.blush_pink = makeClothing({
  id: 'blush_pink', name: 'Pink Blush', category: 'facial', price: 30, rarity: 'Common', layer: LAYER_ORDER.facial,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.blush;
    ctx.beginPath(); ctx.ellipse(x - 8, y - 32, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 8, y - 32, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
});

ClothingCatalog.facepaint_star = makeClothing({
  id: 'facepaint_star', name: 'Star Face Paint', category: 'facial', price: 80, rarity: 'Uncommon', layer: LAYER_ORDER.facial,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.facePaintStar; ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 1;
    const sy = y - 36;
    ctx.beginPath(); ctx.moveTo(x, sy - 4); ctx.lineTo(x + 2, sy); ctx.lineTo(x + 4, sy);
    ctx.lineTo(x + 2, sy + 2); ctx.lineTo(x + 3, sy + 4); ctx.lineTo(x, sy + 2);
    ctx.lineTo(x - 3, sy + 4); ctx.lineTo(x - 2, sy + 2); ctx.lineTo(x - 4, sy);
    ctx.lineTo(x - 2, sy); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

ClothingCatalog.facepaint_stripe = makeClothing({
  id: 'facepaint_stripe', name: 'War Stripe', category: 'facial', price: 70, rarity: 'Uncommon', layer: LAYER_ORDER.facial,
  draw(ctx, x, y, facing = 'SE') {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLOT.facePaintStripe;
    ctx.fillRect(x - 2, y - 42, 4, 12); ctx.strokeStyle = CLOT.outline; ctx.lineWidth = 1; ctx.strokeRect(x - 2, y - 42, 4, 12);
    ctx.restore();
  }
});

/* ═══════════════════════════════════════════════════════════════
   CATALOG META API
   ═══════════════════════════════════════════════════════════════ */

const ClothingCatalog = {};

// populate from global objects (each makeClothing call registered itself above)
// We will re-declare properly by iterating registered items.
const _registeredClothing = [];

// Since makeClothing returns objects and we need them in ClothingCatalog,
// we'll manually register all items into ClothingCatalog:
const _allClothingItems = [
  'shirt_white','shirt_black','shirt_red','shirt_blue','shirt_striped',
  'hoodie_navy','jacket_leather','jacket_bomber','dress_red','dress_gold',
  'suit_navy','suit_white','wizard_robe',
  'pants_jean','pants_jean_ripped','pants_shorts_red','pants_skirt_pink',
  'pants_skirt_black','pants_sweatpants',
  'shoes_sneaker_white','shoes_sneaker_red','shoes_boots_brown','shoes_boots_black',
  'shoes_sandals','shoes_slippers',
  'hat_cap_red','hat_cap_blue','hat_beanie_grey','hat_crown_gold','hat_wizard','hat_bunny_ears',
  'glasses_black','glasses_sun','mask_white','wings_white','wings_gold',
  'necklace_gold','backpack_red','backpack_blue','halo_gold','horns_red',
  'mustache_brown','mustache_curly','beard_short','beard_long','blush_pink',
  'facepaint_star','facepaint_stripe'
];

// Since we already have the objects declared as properties on a temporary object,
// let's just rebuild ClothingCatalog properly by creating the items inline below.

// Actually, the code above defined them on an undeclared ClothingCatalog which fails.
// Let me fix this: I'll define all items directly into ClothingCatalog.

// Re-declare the items into ClothingCatalog object directly:
const _clothingDefs = {
  shirt_white: { n:'White T-Shirt', c:'shirts', p:50, r:'Common', l:LAYER_ORDER.shirt,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.shirtWhite;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.fillRect(x-10,y-28,20,18);ctx.strokeRect(x-10,y-28,20,18);if(f==='SE'){ctx.fillRect(x+8,y-26,8,10);ctx.strokeRect(x+8,y-26,8,10);}else{ctx.fillRect(x-16,y-26,8,10);ctx.strokeRect(x-16,y-26,8,10);}ctx.restore();} },
  shirt_black: { n:'Black T-Shirt', c:'shirts', p:50, r:'Common', l:LAYER_ORDER.shirt,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.shirtBlack;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.fillRect(x-10,y-28,20,18);ctx.strokeRect(x-10,y-28,20,18);if(f==='SE'){ctx.fillRect(x+8,y-26,8,10);ctx.strokeRect(x+8,y-26,8,10);}else{ctx.fillRect(x-16,y-26,8,10);ctx.strokeRect(x-16,y-26,8,10);}ctx.restore();} },
  shirt_red: { n:'Red T-Shirt', c:'shirts', p:60, r:'Common', l:LAYER_ORDER.shirt,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.shirtRed;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.fillRect(x-10,y-28,20,18);ctx.strokeRect(x-10,y-28,20,18);if(f==='SE'){ctx.fillRect(x+8,y-26,8,10);ctx.strokeRect(x+8,y-26,8,10);}else{ctx.fillRect(x-16,y-26,8,10);ctx.strokeRect(x-16,y-26,8,10);}ctx.restore();} },
  shirt_blue: { n:'Blue T-Shirt', c:'shirts', p:60, r:'Common', l:LAYER_ORDER.shirt,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.shirtBlue;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.fillRect(x-10,y-28,20,18);ctx.strokeRect(x-10,y-28,20,18);if(f==='SE'){ctx.fillRect(x+8,y-26,8,10);ctx.strokeRect(x+8,y-26,8,10);}else{ctx.fillRect(x-16,y-26,8,10);ctx.strokeRect(x-16,y-26,8,10);}ctx.restore();} },
  shirt_striped: { n:'Striped Shirt', c:'shirts', p:80, r:'Uncommon', l:LAYER_ORDER.shirt,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.shirtWhite;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.fillRect(x-10,y-28,20,18);ctx.strokeRect(x-10,y-28,20,18);ctx.fillStyle=CLOT.shirtRed;ctx.fillRect(x-10,y-26,20,3);ctx.fillRect(x-10,y-20,20,3);ctx.fillRect(x-10,y-14,20,3);if(f==='SE'){ctx.fillRect(x+8,y-26,8,10);ctx.strokeRect(x+8,y-26,8,10);}else{ctx.fillRect(x-16,y-26,8,10);ctx.strokeRect(x-16,y-26,8,10);}ctx.restore();} },
  hoodie_navy: { n:'Navy Hoodie', c:'shirts', p:150, r:'Common', l:LAYER_ORDER.shirt,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.hoodieNavy;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.fillRect(x-11,y-29,22,19);ctx.strokeRect(x-11,y-29,22,19);ctx.fillStyle=CLOT.hoodieCharcoal;ctx.beginPath();ctx.arc(x,y-36,10,Math.PI,0);ctx.fill();ctx.stroke();ctx.fillStyle=CLOT.hoodieTeal;ctx.fillRect(x-6,y-18,12,6);ctx.strokeRect(x-6,y-18,12,6);if(f==='SE'){ctx.fillRect(x+8,y-26,9,11);ctx.strokeRect(x+8,y-26,9,11);}else{ctx.fillRect(x-17,y-26,9,11);ctx.strokeRect(x-17,y-26,9,11);}ctx.restore();} },
  jacket_leather: { n:'Leather Jacket', c:'shirts', p:250, r:'Uncommon', l:LAYER_ORDER.jacket,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.jacketLeather;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.fillRect(x-12,y-30,24,20);ctx.strokeRect(x-12,y-30,24,20);ctx.fillStyle='#3E2723';ctx.beginPath();ctx.moveTo(x-8,y-30);ctx.lineTo(x,y-24);ctx.lineTo(x+8,y-30);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle='#8D6E63';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y-30);ctx.lineTo(x,y-10);ctx.stroke();if(f==='SE'){ctx.fillRect(x+9,y-26,9,12);ctx.strokeRect(x+9,y-26,9,12);}else{ctx.fillRect(x-18,y-26,9,12);ctx.strokeRect(x-18,y-26,9,12);}ctx.restore();} },
  jacket_bomber: { n:'Bomber Jacket', c:'shirts', p:280, r:'Uncommon', l:LAYER_ORDER.jacket,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.jacketBomber;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.fillRect(x-12,y-30,24,20);ctx.strokeRect(x-12,y-30,24,20);ctx.fillStyle='#FFAB40';ctx.fillRect(x-12,y-30,24,4);ctx.strokeRect(x-12,y-30,24,4);if(f==='SE'){ctx.fillRect(x+9,y-26,9,12);ctx.strokeRect(x+9,y-26,9,12);}else{ctx.fillRect(x-18,y-26,9,12);ctx.strokeRect(x-18,y-26,9,12);}ctx.restore();} },
  dress_red: { n:'Red Evening Dress', c:'shirts', p:400, r:'Uncommon', l:LAYER_ORDER.shirt,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.dressRed;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.fillRect(x-8,y-30,16,16);ctx.strokeRect(x-8,y-30,16,16);ctx.beginPath();ctx.moveTo(x-8,y-14);ctx.lineTo(x+8,y-14);ctx.lineTo(x+14,y-2);ctx.lineTo(x-14,y-2);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#F48FB1';ctx.beginPath();ctx.moveTo(x-4,y-30);ctx.lineTo(x+4,y-30);ctx.lineTo(x,y-24);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();} },
  dress_gold: { n:'Golden Gown', c:'shirts', p:1200, r:'Rare', l:LAYER_ORDER.shirt,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.dressGold;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.fillRect(x-8,y-30,16,16);ctx.strokeRect(x-8,y-30,16,16);ctx.beginPath();ctx.moveTo(x-8,y-14);ctx.lineTo(x+8,y-14);ctx.lineTo(x+16,y);ctx.lineTo(x-16,y);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#FFFFFF';ctx.fillRect(x-2,y-20,2,2);ctx.fillRect(x+4,y-12,2,2);ctx.restore();} },
  suit_navy: { n:'Navy Suit', c:'shirts', p:600, r:'Uncommon', l:LAYER_ORDER.jacket,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.suitNavy;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.fillRect(x-11,y-30,22,20);ctx.strokeRect(x-11,y-30,22,20);ctx.fillStyle='#D32F2F';ctx.beginPath();ctx.moveTo(x-2,y-30);ctx.lineTo(x+2,y-30);ctx.lineTo(x,y-16);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#1565C0';ctx.beginPath();ctx.moveTo(x-8,y-30);ctx.lineTo(x-2,y-22);ctx.lineTo(x-11,y-22);ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(x+8,y-30);ctx.lineTo(x+2,y-22);ctx.lineTo(x+11,y-22);ctx.closePath();ctx.fill();ctx.stroke();if(f==='SE'){ctx.fillRect(x+8,y-26,8,12);ctx.strokeRect(x+8,y-26,8,12);}else{ctx.fillRect(x-16,y-26,8,12);ctx.strokeRect(x-16,y-26,8,12);}ctx.restore();} },
  suit_white: { n:'White Tuxedo', c:'shirts', p:700, r:'Uncommon', l:LAYER_ORDER.jacket,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.suitWhite;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.fillRect(x-11,y-30,22,20);ctx.strokeRect(x-11,y-30,22,20);ctx.fillStyle='#000000';ctx.beginPath();ctx.moveTo(x-2,y-30);ctx.lineTo(x+2,y-30);ctx.lineTo(x,y-16);ctx.closePath();ctx.fill();ctx.stroke();if(f==='SE'){ctx.fillRect(x+8,y-26,8,12);ctx.strokeRect(x+8,y-26,8,12);}else{ctx.fillRect(x-16,y-26,8,12);ctx.strokeRect(x-16,y-26,8,12);}ctx.restore();} },
  wizard_robe: { n:'Wizard Robe', c:'shirts', p:800, r:'Rare', l:LAYER_ORDER.shirt,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.wizardRobe;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.fillRect(x-12,y-30,24,20);ctx.strokeRect(x-12,y-30,24,20);ctx.beginPath();ctx.moveTo(x-12,y-10);ctx.lineTo(x+12,y-10);ctx.lineTo(x+18,y+6);ctx.lineTo(x-18,y+6);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#FFEE58';ctx.beginPath();ctx.moveTo(x,y-20);ctx.lineTo(x+2,y-14);ctx.lineTo(x+4,y-14);ctx.lineTo(x+2,y-11);ctx.lineTo(x+3,y-9);ctx.lineTo(x,y-10);ctx.lineTo(x-3,y-9);ctx.lineTo(x-2,y-11);ctx.lineTo(x-4,y-14);ctx.lineTo(x-2,y-14);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();} },
  pants_jean: { n:'Blue Jeans', c:'pants', p:80, r:'Common', l:LAYER_ORDER.pants,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.pantsJean;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.fillRect(x-9,y-14,18,12);ctx.strokeRect(x-9,y-14,18,12);ctx.strokeStyle=CLOT.pantsJeanDark;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-4,y-14);ctx.lineTo(x-4,y-2);ctx.stroke();ctx.beginPath();ctx.moveTo(x+4,y-14);ctx.lineTo(x+4,y-2);ctx.stroke();ctx.restore();} },
  pants_jean_ripped: { n:'Ripped Jeans', c:'pants', p:100, r:'Uncommon', l:LAYER_ORDER.pants,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.pantsJeanLight;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.fillRect(x-9,y-14,18,12);ctx.strokeRect(x-9,y-14,18,12);ctx.fillStyle=CLOT.skinMid;ctx.fillRect(x-6,y-10,4,3);ctx.strokeRect(x-6,y-10,4,3);ctx.fillRect(x+4,y-6,3,3);ctx.strokeRect(x+4,y-6,3,3);ctx.restore();} },
  pants_shorts_red: { n:'Red Shorts', c:'pants', p:60, r:'Common', l:LAYER_ORDER.pants,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.pantsShortsRed;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.fillRect(x-9,y-14,18,8);ctx.strokeRect(x-9,y-14,18,8);ctx.fillStyle=CLOT.skinMid;ctx.fillRect(x-6,y-6,4,6);ctx.strokeRect(x-6,y-6,4,6);ctx.fillRect(x+2,y-6,4,6);ctx.strokeRect(x+2,y-6,4,6);ctx.restore();} },
  pants_skirt_pink: { n:'Pink Skirt', c:'pants', p:90, r:'Common', l:LAYER_ORDER.pants,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.pantsSkirtPink;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-8,y-14);ctx.lineTo(x+8,y-14);ctx.lineTo(x+14,y-2);ctx.lineTo(x-14,y-2);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle='#F06292';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-4,y-14);ctx.lineTo(x-6,y-2);ctx.stroke();ctx.beginPath();ctx.moveTo(x+4,y-14);ctx.lineTo(x+6,y-2);ctx.stroke();ctx.restore();} },
  pants_skirt_black: { n:'Black Mini Skirt', c:'pants', p:100, r:'Common', l:LAYER_ORDER.pants,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.pantsSkirtBlack;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-8,y-14).lineTo(x+8,y-14).lineTo(x+12,y-4).lineTo(x-12,y-4).closePath();ctx.fill();ctx.stroke();ctx.restore();} },
  pants_sweatpants: { n:'Grey Sweatpants', c:'pants', p:70, r:'Common', l:LAYER_ORDER.pants,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.pantsSweatGrey;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.fillRect(x-9,y-14,18,12);ctx.strokeRect(x-9,y-14,18,12);ctx.fillStyle=CLOT.pantsSweatDark;ctx.fillRect(x-9,y-4,18,4);ctx.strokeRect(x-9,y-4,18,4);ctx.restore();} },
  shoes_sneaker_white: { n:'White Sneakers', c:'shoes', p:60, r:'Common', l:LAYER_ORDER.shoes,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.shoeWhite;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;if(f==='SE'){ctx.fillRect(x+2,y-4,10,6);ctx.strokeRect(x+2,y-4,10,6);}else{ctx.fillRect(x-12,y-4,10,6);ctx.strokeRect(x-12,y-4,10,6);}ctx.restore();} },
  shoes_sneaker_red: { n:'Red Sneakers', c:'shoes', p:70, r:'Common', l:LAYER_ORDER.shoes,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.shoeRed;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;if(f==='SE'){ctx.fillRect(x+2,y-4,10,6);ctx.strokeRect(x+2,y-4,10,6);}else{ctx.fillRect(x-12,y-4,10,6);ctx.strokeRect(x-12,y-4,10,6);}ctx.restore();} },
  shoes_boots_brown: { n:'Brown Boots', c:'shoes', p:120, r:'Common', l:LAYER_ORDER.shoes,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.shoeBrown;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;if(f==='SE'){ctx.fillRect(x+2,y-6,10,8);ctx.strokeRect(x+2,y-6,10,8);ctx.fillRect(x+2,y-10,10,4);ctx.strokeRect(x+2,y-10,10,4);}else{ctx.fillRect(x-12,y-6,10,8);ctx.strokeRect(x-12,y-6,10,8);ctx.fillRect(x-12,y-10,10,4);ctx.strokeRect(x-12,y-10,10,4);}ctx.restore();} },
  shoes_boots_black: { n:'Black Boots', c:'shoes', p:130, r:'Uncommon', l:LAYER_ORDER.shoes,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.shoeBlack;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;if(f==='SE'){ctx.fillRect(x+2,y-6,10,8);ctx.strokeRect(x+2,y-6,10,8);ctx.fillRect(x+2,y-12,10,6);ctx.strokeRect(x+2,y-12,10,6);}else{ctx.fillRect(x-12,y-6,10,8);ctx.strokeRect(x-12,y-6,10,8);ctx.fillRect(x-12,y-12,10,6);ctx.strokeRect(x-12,y-12,10,6);}ctx.restore();} },
  shoes_sandals: { n:'Sandals', c:'shoes', p:40, r:'Common', l:LAYER_ORDER.shoes,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.shoeBrown;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;if(f==='SE'){ctx.fillRect(x+2,y-2,10,4);ctx.strokeRect(x+2,y-2,10,4);ctx.strokeStyle=CLOT.shoeBrown;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+4,y-4);ctx.lineTo(x+10,y-4);ctx.stroke();}else{ctx.fillRect(x-12,y-2,10,4);ctx.strokeRect(x-12,y-2,10,4);ctx.beginPath();ctx.moveTo(x-10,y-4);ctx.lineTo(x-4,y-4);ctx.stroke();}ctx.restore();} },
  shoes_slippers: { n:'Bunny Slippers', c:'shoes', p:90, r:'Uncommon', l:LAYER_ORDER.shoes,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle='#F8BBD0';ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;if(f==='SE'){ctx.beginPath();ctx.ellipse(x+7,y-2,8,4,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#F48FB1';ctx.fillRect(x+3,y-10,3,8);ctx.strokeRect(x+3,y-10,3,8);ctx.fillRect(x+8,y-10,3,8);ctx.strokeRect(x+8,y-10,3,8);}else{ctx.beginPath();ctx.ellipse(x-7,y-2,8,4,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#F48FB1';ctx.fillRect(x-10,y-10,3,8);ctx.strokeRect(x-10,y-10,3,8);ctx.fillRect(x-5,y-10,3,8);ctx.strokeRect(x-5,y-10,3,8);}ctx.restore();} },
  hat_cap_red: { n:'Red Cap', c:'hats', p:80, r:'Common', l:LAYER_ORDER.hat,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.hatCapRed;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y-42,10,Math.PI,0);ctx.fill();ctx.stroke();ctx.fillRect(x-4,y-42,14,4);ctx.strokeRect(x-4,y-42,14,4);ctx.restore();} },
  hat_cap_blue: { n:'Blue Cap', c:'hats', p:80, r:'Common', l:LAYER_ORDER.hat,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.hatCapBlue;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y-42,10,Math.PI,0);ctx.fill();ctx.stroke();ctx.fillRect(x-4,y-42,14,4);ctx.strokeRect(x-4,y-42,14,4);ctx.restore();} },
  hat_beanie_grey: { n:'Grey Beanie', c:'hats', p:70, r:'Common', l:LAYER_ORDER.hat,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.hatBeanieGrey;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y-44,11,Math.PI,0);ctx.fill();ctx.stroke();ctx.fillRect(x-11,y-44,22,5);ctx.strokeRect(x-11,y-44,22,5);ctx.fillStyle='#B0BEC5';ctx.beginPath();ctx.arc(x,y-56,4,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();} },
  hat_crown_gold: { n:'Golden Crown', c:'hats', p:1500, r:'Legendary', l:LAYER_ORDER.hat,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.hatCrownGold;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.fillRect(x-10,y-48,20,4);ctx.strokeRect(x-10,y-48,20,4);ctx.beginPath();ctx.moveTo(x-10,y-48);ctx.lineTo(x-6,y-58);ctx.lineTo(x-2,y-48);ctx.lineTo(x+2,y-56);ctx.lineTo(x+6,y-48);ctx.lineTo(x+10,y-58);ctx.lineTo(x+10,y-48);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle=CLOT.hatCrownJewel;ctx.beginPath();ctx.arc(x-6,y-52,2,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+2,y-50,2,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+8,y-52,2,0,Math.PI*2);ctx.fill();ctx.restore();} },
  hat_wizard: { n:'Wizard Hat', c:'hats', p:500, r:'Rare', l:LAYER_ORDER.hat,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.hatWizard;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y-46,14,5,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(x-12,y-46);ctx.lineTo(x,y-72);ctx.lineTo(x+12,y-46);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#FFEE58';ctx.beginPath();ctx.moveTo(x,y-58);ctx.lineTo(x+2,y-54);ctx.lineTo(x+4,y-54);ctx.lineTo(x+2,y-52);ctx.lineTo(x+3,y-50);ctx.lineTo(x,y-51);ctx.lineTo(x-3,y-50);ctx.lineTo(x-2,y-52);ctx.lineTo(x-4,y-54);ctx.lineTo(x-2,y-54);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();} },
  hat_bunny_ears: { n:'Bunny Ears', c:'hats', p:200, r:'Uncommon', l:LAYER_ORDER.hat,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.hatBunnyPink;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.fillRect(x-10,y-48,20,3);ctx.strokeRect(x-10,y-48,20,3);ctx.fillRect(x-8,y-68,5,22);ctx.strokeRect(x-8,y-68,5,22);ctx.fillRect(x+3,y-68,5,22);ctx.strokeRect(x+3,y-68,5,22);ctx.fillStyle='#F48FB1';ctx.fillRect(x-7,y-62,3,12);ctx.fillRect(x+4,y-62,3,12);ctx.restore();} },
  glasses_black: { n:'Black Glasses', c:'accessories', p:60, r:'Common', l:LAYER_ORDER.accessoryFront,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.strokeStyle=CLOT.glassesBlack;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x-5,y-36,4,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(x+5,y-36,4,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x-1,y-36);ctx.lineTo(x+1,y-36);ctx.stroke();ctx.restore();} },
  glasses_sun: { n:'Sunglasses', c:'accessories', p:80, r:'Common', l:LAYER_ORDER.accessoryFront,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.glassesBlack;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x-5,y-36,5,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(x+5,y-36,5,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(x,y-36);ctx.lineTo(x+2,y-36);ctx.stroke();ctx.fillStyle='#FFFFFF';ctx.fillRect(x-7,y-38,2,2);ctx.fillRect(x+3,y-38,2,2);ctx.restore();} },
  mask_white: { n:'White Mask', c:'accessories', p:50, r:'Common', l:LAYER_ORDER.accessoryFront,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.maskWhite;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y-32,8,6,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=CLOT.outline;ctx.fillRect(x-4,y-34,2,2);ctx.fillRect(x+2,y-34,2,2);ctx.restore();} },
  wings_white: { n:'Angel Wings', c:'accessories', p:800, r:'Rare', l:LAYER_ORDER.accessoryBack,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.wingsWhite;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x-14,y-28,10,18,-0.4,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.ellipse(x+14,y-28,10,18,0.4,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();} },
  wings_gold: { n:'Golden Wings', c:'accessories', p:1200, r:'Epic', l:LAYER_ORDER.accessoryBack,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.wingsGold;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x-14,y-28,10,18,-0.4,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.ellipse(x+14,y-28,10,18,0.4,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle='#F9A825';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-14,y-38);ctx.lineTo(x-14,y-18);ctx.stroke();ctx.beginPath();ctx.moveTo(x+14,y-38);ctx.lineTo(x+14,y-18);ctx.stroke();ctx.restore();} },
  necklace_gold: { n:'Gold Necklace', c:'accessories', p:200, r:'Uncommon', l:LAYER_ORDER.accessoryFront,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.strokeStyle=CLOT.necklaceGold;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-6,y-28);ctx.quadraticCurveTo(x,y-20,x+6,y-28);ctx.stroke();ctx.fillStyle=CLOT.necklaceGem;ctx.beginPath();ctx.arc(x,y-22,3,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();} },
  backpack_red: { n:'Red Backpack', c:'accessories', p:150, r:'Common', l:LAYER_ORDER.accessoryBack,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.backpackRed;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.fillRect(x-8,y-26,16,18);ctx.strokeRect(x-8,y-26,16,18);ctx.fillStyle='#B71C1C';ctx.fillRect(x-8,y-26,16,8);ctx.strokeRect(x-8,y-26,16,8);ctx.strokeStyle=CLOT.outline;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-4,y-28).lineTo(x-4,y-14);ctx.stroke();ctx.beginPath();ctx.moveTo(x+4,y-28).lineTo(x+4,y-14);ctx.stroke();ctx.restore();} },
  backpack_blue: { n:'Blue Backpack', c:'accessories', p:150, r:'Common', l:LAYER_ORDER.accessoryBack,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.backpackBlue;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.fillRect(x-8,y-26,16,18);ctx.strokeRect(x-8,y-26,16,18);ctx.fillStyle='#0D47A1';ctx.fillRect(x-8,y-26,16,8);ctx.strokeRect(x-8,y-26,16,8);ctx.strokeStyle=CLOT.outline;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-4,y-28).lineTo(x-4,y-14);ctx.stroke();ctx.beginPath();ctx.moveTo(x+4,y-28).lineTo(x+4,y-14);ctx.stroke();ctx.restore();} },
  halo_gold: { n:'Golden Halo', c:'accessories', p:600, r:'Rare', l:LAYER_ORDER.hat,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.strokeStyle=CLOT.haloGold;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,y-56,12,4,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle=CLOT.haloGlow;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,y-56,14,5,0,0,Math.PI*2);ctx.stroke();ctx.restore();} },
  horns_red: { n:'Devil Horns', c:'accessories', p:350, r:'Uncommon', l:LAYER_ORDER.hat,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.hornsRed;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=2;ctx.fillRect(x-10,y-48,20,3);ctx.strokeRect(x-10,y-48,20,3);ctx.beginPath();ctx.moveTo(x-6,y-48);ctx.lineTo(x-10,y-60);ctx.lineTo(x-2,y-50);ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(x+6,y-48);ctx.lineTo(x+10,y-60);ctx.lineTo(x+2,y-50);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();} },
  mustache_brown: { n:'Brown Mustache', c:'facial', p:40, r:'Common', l:LAYER_ORDER.facial,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.mustacheBrown;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-6,y-30).quadraticCurveTo(x-2,y-26,x,y-30).quadraticCurveTo(x+2,y-26,x+6,y-30).closePath();ctx.fill();ctx.stroke();ctx.restore();} },
  mustache_curly: { n:'Curly Mustache', c:'facial', p:60, r:'Uncommon', l:LAYER_ORDER.facial,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.strokeStyle=CLOT.mustacheBlack;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-8,y-30).quadraticCurveTo(x-4,y-24,x,y-30);ctx.stroke();ctx.beginPath();ctx.moveTo(x+8,y-30).quadraticCurveTo(x+4,y-24,x,y-30);ctx.stroke();ctx.restore();} },
  beard_short: { n:'Short Beard', c:'facial', p:50, r:'Common', l:LAYER_ORDER.facial,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.beardBrown;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=1;ctx.fillRect(x-6,y-28,12,6);ctx.strokeRect(x-6,y-28,12,6);ctx.restore();} },
  beard_long: { n:'Long Beard', c:'facial', p:70, r:'Uncommon', l:LAYER_ORDER.facial,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.beardBrown;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=1;ctx.fillRect(x-6,y-28,12,6);ctx.strokeRect(x-6,y-28,12,6);ctx.beginPath();ctx.moveTo(x-4,y-22).lineTo(x,y-14).lineTo(x+4,y-22).closePath();ctx.fill();ctx.stroke();ctx.restore();} },
  blush_pink: { n:'Pink Blush', c:'facial', p:30, r:'Common', l:LAYER_ORDER.facial,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.blush;ctx.beginPath();ctx.ellipse(x-8,y-32,3,2,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(x+8,y-32,3,2,0,0,Math.PI*2);ctx.fill();ctx.restore();} },
  facepaint_star: { n:'Star Face Paint', c:'facial', p:80, r:'Uncommon', l:LAYER_ORDER.facial,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.facePaintStar;ctx.strokeStyle=CLOT.outline;ctx.lineWidth=1;const sy=y-36;ctx.beginPath();ctx.moveTo(x,sy-4).lineTo(x+2,sy).lineTo(x+4,sy).lineTo(x+2,sy+2).lineTo(x+3,sy+4).lineTo(x,sy+2).lineTo(x-3,sy+4).lineTo(x-2,sy+2).lineTo(x-4,sy).lineTo(x-2,sy).closePath();ctx.fill();ctx.stroke();ctx.restore();} },
  facepaint_stripe: { n:'War Stripe', c:'facial', p:70, r:'Uncommon', l:LAYER_ORDER.facial,
    d:(ctx,x,y,f='SE')=>{ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CLOT.facePaintStripe;ctx.fillRect(x-2,y-42,4,12);ctx.strokeStyle=CLOT.outline;ctx.lineWidth=1;ctx.strokeRect(x-2,y-42,4,12);ctx.restore();} },
};

Object.keys(_clothingDefs).forEach(key => {
  const d = _clothingDefs[key];
  ClothingCatalog[key] = {
    id: key, name: d.n, category: d.c, price: d.p, rarity: d.r, layer: d.l,
    draw(ctx, x, y, facing = 'SE') { ctx.save(); ctx.imageSmoothingEnabled = false; d.d(ctx, x, y, facing); ctx.restore(); }
  };
});

/* ──────── catalog API ──────── */
const CLOTH_KEYS = Object.keys(ClothingCatalog);

function clothByCategory(cat) {
  return CLOTH_KEYS.filter(k => ClothingCatalog[k].category === cat).map(k => ClothingCatalog[k]);
}

function clothByRarity(rarity) {
  return CLOTH_KEYS.filter(k => ClothingCatalog[k].rarity === rarity).map(k => ClothingCatalog[k]);
}

function clothByPriceRange(min, max) {
  return CLOTH_KEYS.filter(k => { const p = ClothingCatalog[k].price; return p >= min && p <= max; }).map(k => ClothingCatalog[k]);
}

function getClothCount() { return CLOTH_KEYS.length; }

function sortByLayer(items) {
  return [...items].sort((a, b) => a.layer - b.layer);
}

function drawAvatarStack(ctx, x, y, facing, equippedIds) {
  const items = sortByLayer(equippedIds.map(id => ClothingCatalog[id]).filter(Boolean));
  items.forEach(item => item.draw(ctx, x, y, facing));
}

/* exports */
export {
  ClothingCatalog,
  CLOT,
  LAYER_ORDER,
  clothByCategory,
  clothByRarity,
  clothByPriceRange,
  getClothCount,
  sortByLayer,
  drawAvatarStack,
};

export default ClothingCatalog;

if (typeof window !== 'undefined') {
  window.ClothingCatalog = ClothingCatalog;
  window.ClothingPalette = CLOT;
  window.ClothingLayerOrder = LAYER_ORDER;
}
