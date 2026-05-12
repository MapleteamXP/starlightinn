// ============================================================
// Starlight Engine — Trading Marketplace / Auction House
// ============================================================

import { FURNITURE_CATALOG } from '../world/Data.js';

const STORAGE_KEY = 'starlight_marketplace';
const LISTING_FEE = 10;
const MAX_LISTINGS = 10;

export class MarketplaceSystem {
  constructor() {
    this.listings = [];
    this.load();
  }

  load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (data && Array.isArray(data)) this.listings = data;
    } catch (e) {}
    // Generate some NPC listings if empty
    if (this.listings.length === 0) this._generateNPCListings();
  }

  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.listings)); } catch (e) {}
  }

  _generateNPCListings() {
    const rareItems = FURNITURE_CATALOG.filter(i => i.price >= 300);
    for (let i = 0; i < 6; i++) {
      const item = rareItems[Math.floor(Math.random() * rareItems.length)];
      if (item) {
        this.listings.push({
          id: 'npc_' + Date.now() + '_' + i,
          seller: ['SkyWalker', 'LunaStar', 'PixelDream', 'CocoBean', 'NovaFlare'][i % 5],
          itemType: item.id,
          itemName: item.name,
          price: Math.floor(item.price * (0.8 + Math.random() * 0.6)),
          icon: item.icon,
          npc: true,
          listedAt: Date.now() - Math.random() * 86400000
        });
      }
    }
    this.save();
  }

  listItem(itemType, price, sellerName) {
    const cat = FURNITURE_CATALOG.find(c => c.id === itemType);
    if (!cat) return null;
    const userListings = this.listings.filter(l => !l.npc && l.seller === sellerName);
    if (userListings.length >= MAX_LISTINGS) return { error: 'Max listings reached' };
    const listing = {
      id: 'lst_' + Date.now().toString(36),
      seller: sellerName,
      itemType,
      itemName: cat.name,
      price,
      icon: cat.icon,
      npc: false,
      listedAt: Date.now()
    };
    this.listings.push(listing);
    this.save();
    return listing;
  }

  buyListing(listingId, buyerCurrencySystem, buyerInventorySystem) {
    const idx = this.listings.findIndex(l => l.id === listingId);
    if (idx === -1) return { error: 'Listing not found' };
    const listing = this.listings[idx];
    if (!buyerCurrencySystem.spend(listing.price)) return { error: 'Not enough coins' };
    buyerInventorySystem.add(listing.itemType, 1);
    this.listings.splice(idx, 1);
    this.save();
    return { success: true, listing };
  }

  cancelListing(listingId, sellerName) {
    const idx = this.listings.findIndex(l => l.id === listingId && l.seller === sellerName);
    if (idx === -1) return false;
    this.listings.splice(idx, 1);
    this.save();
    return true;
  }

  getListings() {
    // Remove old NPC listings and regenerate
    const now = Date.now();
    const old = this.listings.filter(l => l.npc && now - l.listedAt > 3600000);
    old.forEach(o => {
      const idx = this.listings.indexOf(o);
      if (idx > -1) this.listings.splice(idx, 1);
    });
    if (this.listings.length < 4) this._generateNPCListings();
    return this.listings;
  }

  search(query) {
    const q = query.toLowerCase();
    return this.getListings().filter(l => l.itemName.toLowerCase().includes(q) || l.seller.toLowerCase().includes(q));
  }
}
