// ============================================================
// Starlight Engine — Room Ratings & Reviews
// ============================================================

const STORAGE_KEY = 'starlight_room_ratings';

export class RoomRatingSystem {
  constructor() {
    this.ratings = {};
    this.load();
  }

  load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (data) this.ratings = data;
    } catch (e) {}
  }

  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.ratings)); } catch (e) {}
  }

  rate(roomId, stars, review = '') {
    if (!this.ratings[roomId]) this.ratings[roomId] = { scores: [], reviews: [] };
    this.ratings[roomId].scores.push({ stars, date: Date.now() });
    if (review.trim()) this.ratings[roomId].reviews.push({ text: review.trim(), date: Date.now() });
    if (this.ratings[roomId].scores.length > 20) this.ratings[roomId].scores.shift();
    if (this.ratings[roomId].reviews.length > 10) this.ratings[roomId].reviews.shift();
    this.save();
  }

  getAverage(roomId) {
    const data = this.ratings[roomId];
    if (!data || data.scores.length === 0) return 0;
    return data.scores.reduce((sum, s) => sum + s.stars, 0) / data.scores.length;
  }

  getRatingCount(roomId) {
    return this.ratings[roomId]?.scores?.length || 0;
  }

  getReviews(roomId) {
    return this.ratings[roomId]?.reviews || [];
  }

  hasRated(roomId) {
    return !!this.ratings[roomId];
  }
}
