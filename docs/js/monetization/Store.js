/**
 * Store.js — In-Game Shop with Daily Rotation & Multi-Currency
 * Starlight Inn v7.0
 */

import { FurnitureCatalog } from '../assets/FurnitureCatalog.js';
import { ClothingCatalog } from '../assets/ClothingCatalog.js';
import { RareEggs } from '../assets/RareEggs.js';

/**
 * @class Store
 * @description In-game store with daily rotation, multi-currency, and Stripe checkout
 */
class Store {
  constructor(game) {
    this.game = game;
    this.currencies = { silver: 0, gold: 0, diamonds: 0 };
    this.dailyRotation = [];
    this.lastRotation = null;
    this.wishlist = [];
    this.recentlyViewed = [];
    this.purchaseHistory = [];
    this.categories = {
      furniture: { name: 'Furniture', items: [] },
      clothing: { name: 'Clothing', items: [] },
      eggs: { name: 'Rare Eggs', items: [] },
      badges: { name: 'Badges', items: [] },
      emotes: { name: 'Emotes', items: [] },
      bundles: { name: 'Bundles', items: [] },
      currency: { name: 'Currency', items: [] }
    };
    this.init();
  }

  init() {
    this.loadFromStorage();
    this.generateDailyRotation();
    this.populateCategories();
  }

  populateCategories() {
    // Furniture from catalog
    this.categories.furniture.items = FurnitureCatalog.getAll().slice(0, 8).map(i => ({
      id: i.id, name: i.name, price: i.price, currency: 'silver',
      icon: i.id, type: 'furniture', rarity: i.rarity
    }));

    // Clothing from catalog
    this.categories.clothing.items = ClothingCatalog.getAll().slice(0, 6).map(i => ({
      id: i.id, name: i.name, price: i.price, currency: 'silver',
      icon: i.id, type: 'clothing', rarity: i.rarity
    }));

    // Eggs
    this.categories.eggs.items = RareEggs.getAll().slice(0, 4).map(e => ({
      id: e.id, name: e.name, price: e.price || 500, currency: 'gold',
      icon: 'egg', type: 'egg', rarity: e.rarity
    }));

    // Badges
    const badgeItems = [
      { id: 'badge_new_star', name: 'New Star Badge', price: 1000, currency: 'silver', type: 'badge' },
      { id: 'badge_trade_master', name: 'Trade Master', price: 2000, currency: 'silver', type: 'badge' },
      { id: 'badge_rich', name: 'Rich Star', price: 50, currency: 'gold', type: 'badge' }
    ];
    this.categories.badges.items = badgeItems;

    // Emotes
    const emoteItems = [
      { id: 'emote_heart', name: 'Heart Burst', price: 500, currency: 'silver', type: 'emote' },
      { id: 'emote_tears', name: 'Joy Tears', price: 500, currency: 'silver', type: 'emote' },
      { id: 'emote_angry', name: 'Angry Steam', price: 500, currency: 'silver', type: 'emote' },
      { id: 'emote_dance', name: 'Dance Fever', price: 1000, currency: 'silver', type: 'emote' },
      { id: 'emote_sleep', name: 'Sleepy Zzz', price: 300, currency: 'silver', type: 'emote' }
    ];
    this.categories.emotes.items = emoteItems;

    // Bundles
    const bundleItems = [
      { id: 'bundle_starter', name: 'Starter Pack', price: 0, currency: 'silver', type: 'bundle', items: ['chair_wooden', 'lamp_table', 'shirt_tshirt', 'egg_star'] },
      { id: 'bundle_furniture', name: 'Furniture Set', price: 1500, currency: 'silver', type: 'bundle', items: ['sofa', 'table_coffee', 'rug_rect', 'lamp_floor', 'bookshelf'] },
      { id: 'bundle_fashion', name: 'Fashion Pack', price: 20, currency: 'gold', type: 'bundle', items: ['shirt_hoodie', 'pants_jeans', 'shoes_sneakers', 'hat_cap', 'glasses'] },
      { id: 'bundle_premium', name: 'Premium Collection', price: 100, currency: 'gold', type: 'bundle', items: ['throne', 'chandelier', 'dress_formal', 'crown', 'wings'] }
    ];
    this.categories.bundles.items = bundleItems;

    // Currency packs
    const currencyItems = [
      { id: 'gold_100', name: '100 Gold', price: 99, currency: 'dollars', type: 'currency', amount: { gold: 100 } },
      { id: 'gold_500', name: '500 Gold', price: 399, currency: 'dollars', type: 'currency', amount: { gold: 500 } },
      { id: 'gold_1000', name: '1000 Gold', price: 699, currency: 'dollars', type: 'currency', amount: { gold: 1000 } },
      { id: 'diamonds_50', name: '50 Diamonds', price: 199, currency: 'dollars', type: 'currency', amount: { diamonds: 50 } }
    ];
    this.categories.currency.items = currencyItems;
  }

  generateDailyRotation() {
    const now = new Date();
    const today = now.toDateString();
    if (this.lastRotation === today && this.dailyRotation.length > 0) return;
    this.lastRotation = today;

    const pool = [
      ...this.categories.furniture.items.slice(0, 3),
      ...this.categories.clothing.items.slice(0, 2),
      ...this.categories.eggs.items.slice(0, 1)
    ];
    // Shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.dailyRotation = pool.slice(0, 6);
    this.saveToStorage();
  }

  getDailyRotation() {
    this.generateDailyRotation();
    return this.dailyRotation;
  }

  getTimeUntilNextRotation() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow - now;
  }

  getCategories() {
    return Object.values(this.categories);
  }

  getStoreFront() {
    return {
      daily: this.getDailyRotation(),
      categories: this.getCategories(),
      featured: this.getFeatured(),
      sale: this.getSaleItems()
    };
  }

  getFeatured() {
    return [
      { id: 'bundle_premium', name: 'Premium Collection', price: 100, currency: 'gold', type: 'bundle', highlight: true },
      { id: 'egg_golden', name: 'Golden Egg', price: 50, currency: 'gold', type: 'egg', highlight: true }
    ];
  }

  getSaleItems() {
    const weekend = new Date().getDay() === 0 || new Date().getDay() === 6;
    if (!weekend) return [];
    return this.categories.furniture.items.slice(0, 3).map(i => ({
      ...i, salePrice: Math.floor(i.price * 0.8), discount: 20
    }));
  }

  purchase(itemId, currency) {
    const item = this.findItem(itemId);
    if (!item) return { success: false, error: 'Item not found' };
    if (this.currencies[currency] < item.price) {
      return { success: false, error: 'Insufficient ' + currency };
    }
    this.currencies[currency] -= item.price;
    this.purchaseHistory.push({ itemId, currency, price: item.price, date: new Date().toISOString() });
    this.saveToStorage();
    return { success: true, item, remaining: this.currencies[currency] };
  }

  purchaseWithStripe(itemId) {
    const item = this.findItem(itemId);
    if (!item) return { success: false, error: 'Item not found' };
    // Stripe checkout redirect
    const stripeUrl = this.createStripeCheckout(item);
    return { success: true, stripeUrl, item };
  }

  createStripeCheckout(item) {
    // In production, this calls backend to create Stripe session
    // For now, return mock URL
    const basePrice = item.price || 199;
    return `https://checkout.stripe.com/pay?client_reference_id=${item.id}&amount=${basePrice}`;
  }

  gift(itemId, friendId, currency) {
    const result = this.purchase(itemId, currency);
    if (!result.success) return result;
    // Add to friend's inventory
    return { success: true, message: 'Gift sent!', item: result.item, friendId };
  }

  findItem(itemId) {
    for (const cat of Object.values(this.categories)) {
      const item = cat.items.find(i => i.id === itemId);
      if (item) return item;
    }
    return this.dailyRotation.find(i => i.id === itemId);
  }

  searchItems(query) {
    const all = Object.values(this.categories).flatMap(c => c.items);
    return all.filter(i => i.name.toLowerCase().includes(query.toLowerCase()));
  }

  addToWishlist(itemId) {
    if (this.wishlist.includes(itemId)) return false;
    if (this.wishlist.length >= 50) this.wishlist.shift();
    this.wishlist.push(itemId);
    this.saveToStorage();
    return true;
  }

  removeFromWishlist(itemId) {
    this.wishlist = this.wishlist.filter(id => id !== itemId);
    this.saveToStorage();
  }

  getWishlist() {
    return this.wishlist.map(id => this.findItem(id)).filter(Boolean);
  }

  recordView(itemId) {
    this.recentlyViewed = [itemId, ...this.recentlyViewed.filter(id => id !== itemId)].slice(0, 20);
  }

  getRecentlyViewed() {
    return this.recentlyViewed.map(id => this.findItem(id)).filter(Boolean);
  }

  getItemDetails(itemId) {
    const item = this.findItem(itemId);
    if (!item) return null;
    return { ...item, inWishlist: this.wishlist.includes(itemId) };
  }

  getBundleValue(bundleId) {
    const bundle = this.categories.bundles.items.find(b => b.id === bundleId);
    if (!bundle) return null;
    const itemValues = bundle.items.map(id => this.findItem(id)?.price || 0);
    const totalValue = itemValues.reduce((a, b) => a + b, 0);
    return { ...bundle, totalValue, savings: totalValue - bundle.price };
  }

  getSpendingStats() {
    const total = this.purchaseHistory.reduce((sum, p) => sum + p.price, 0);
    return { totalSpent: total, totalPurchases: this.purchaseHistory.length, history: this.purchaseHistory.slice(-10) };
  }

  addCurrency(type, amount) {
    this.currencies[type] = (this.currencies[type] || 0) + amount;
    this.saveToStorage();
  }

  getCurrency(type) {
    return this.currencies[type] || 0;
  }

  loadFromStorage() {
    try {
      const data = JSON.parse(localStorage.getItem('starlight_store') || '{}');
      this.currencies = data.currencies || { silver: 1000, gold: 10, diamonds: 0 };
      this.wishlist = data.wishlist || [];
      this.recentlyViewed = data.recentlyViewed || [];
      this.purchaseHistory = data.purchaseHistory || [];
      this.lastRotation = data.lastRotation || null;
    } catch (e) {
      this.currencies = { silver: 1000, gold: 10, diamonds: 0 };
    }
  }

  saveToStorage() {
    localStorage.setItem('starlight_store', JSON.stringify({
      currencies: this.currencies,
      wishlist: this.wishlist,
      recentlyViewed: this.recentlyViewed,
      purchaseHistory: this.purchaseHistory,
      lastRotation: this.lastRotation
    }));
  }

  // Weekend sale check
  isWeekendSale() {
    const day = new Date().getDay();
    return day === 0 || day === 6;
  }

  getSaleDiscount() {
    return this.isWeekendSale() ? 0.2 : 0;
  }
}

export default Store;
