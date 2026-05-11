// ============================================================
// Starlight Engine — Currency System
// ============================================================

export class CurrencySystem {
  constructor(startAmount = 1000) {
    this.amount = startAmount;
    this.element = document.getElementById('currencyDisplay');
    this.load();
    this.updateDisplay();
  }

  add(amount) {
    this.amount += amount;
    this.save();
    this.updateDisplay();
  }

  spend(amount) {
    if (this.amount >= amount) {
      this.amount -= amount;
      this.save();
      this.updateDisplay();
      return true;
    }
    return false;
  }

  get() {
    return this.amount;
  }

  load() {
    try {
      const data = localStorage.getItem('starlight_currency');
      if (data !== null) this.amount = parseInt(data, 10) || this.amount;
    } catch (e) {}
  }

  save() {
    try { localStorage.setItem('starlight_currency', String(this.amount)); } catch (e) {}
  }

  updateDisplay() {
    if (this.element) {
      this.element.textContent = this.amount.toLocaleString();
    }
  }
}
