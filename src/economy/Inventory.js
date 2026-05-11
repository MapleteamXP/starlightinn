// ============================================================
// Starlight Engine — Inventory System
// ============================================================

export class InventorySystem {
  constructor() {
    this.items = {};
  }

  add(type, count = 1) {
    this.items[type] = (this.items[type] || 0) + count;
  }

  remove(type, count = 1) {
    if (!this.items[type]) return false;
    this.items[type] -= count;
    if (this.items[type] <= 0) delete this.items[type];
    return true;
  }

  has(type) {
    return !!this.items[type];
  }

  getCount(type) {
    return this.items[type] || 0;
  }

  getAll() {
    return { ...this.items };
  }

  renderGrid(container, onSelect) {
    if (!container) return;
    container.innerHTML = '';
    const entries = Object.entries(this.items);
    if (entries.length === 0) {
      container.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--habbo-text-dim);padding:20px;">Your inventory is empty. Visit the catalog to buy furniture!</div>';
      return;
    }
    entries.forEach(([type, count]) => {
      const div = document.createElement('div');
      div.className = 'inv-item';
      div.innerHTML = `<div>${type}</div><div class="inv-count">x${count}</div>`;
      div.addEventListener('click', () => onSelect && onSelect(type));
      container.appendChild(div);
    });
  }
}
