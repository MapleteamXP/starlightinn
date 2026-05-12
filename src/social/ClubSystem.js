// ============================================================
// Starlight Engine — Club / Group System
// ============================================================

const STORAGE_KEY = 'starlight_clubs';
const BADGE_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F1C40F', '#9B59B6', '#E67E22', '#1ABC9C', '#FF6B6B'];
const BADGE_ICONS = ['⭐', '🔥', '💎', '🌙', '⚡', '🌸', '🎵', '🏆'];

export class ClubSystem {
  constructor() {
    this.clubs = [];
    this.myClubs = new Set();
    this.load();
  }

  load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (data) {
        this.clubs = data.clubs || [];
        this.myClubs = new Set(data.myClubs || []);
      }
    } catch (e) {}
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        clubs: this.clubs,
        myClubs: Array.from(this.myClubs)
      }));
    } catch (e) {}
  }

  create(name, badgeColor, badgeIcon) {
    if (!name || name.trim().length < 2 || name.trim().length > 20) return null;
    const id = 'club_' + Date.now().toString(36);
    const club = {
      id,
      name: name.trim(),
      badgeColor: badgeColor || BADGE_COLORS[0],
      badgeIcon: badgeIcon || BADGE_ICONS[0],
      members: [],
      createdAt: Date.now(),
      owner: 'You'
    };
    this.clubs.push(club);
    this.myClubs.add(id);
    this.save();
    return club;
  }

  delete(clubId) {
    this.clubs = this.clubs.filter(c => c.id !== clubId);
    this.myClubs.delete(clubId);
    this.save();
  }

  join(clubId) {
    const club = this.clubs.find(c => c.id === clubId);
    if (!club) return false;
    this.myClubs.add(clubId);
    if (!club.members.includes('You')) club.members.push('You');
    this.save();
    return true;
  }

  leave(clubId) {
    this.myClubs.delete(clubId);
    const club = this.clubs.find(c => c.id === clubId);
    if (club) club.members = club.members.filter(m => m !== 'You');
    this.save();
  }

  getClub(id) {
    return this.clubs.find(c => c.id === id);
  }

  getMyClubs() {
    return this.clubs.filter(c => this.myClubs.has(c.id));
  }

  getAll() {
    return this.clubs;
  }

  getBadgeForMember(memberName) {
    const clubs = this.clubs.filter(c => c.members.includes(memberName));
    if (clubs.length === 0) return null;
    return { color: clubs[0].badgeColor, icon: clubs[0].badgeIcon, name: clubs[0].name };
  }

  getBadgeColors() { return BADGE_COLORS; }
  getBadgeIcons() { return BADGE_ICONS; }
}
