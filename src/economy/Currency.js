// ============================================================
// Starlight Engine — Currency System
// ============================================================

export class CurrencySystem {
  constructor(startAmount = 1000) {
    this.amount = startAmount;
    this.element = document.getElementById('currencyDisplay');
    this.updateDisplay();
  }

  add(amount) {
    this.amount += amount;
    this.updateDisplay();
  }

  spend(amount) {
    if (this.amount >= amount) {
      this.amount -= amount;
      this.updateDisplay();
      return true;
    }
    return false;
  }

  get() {
    return this.amount;
  }

  updateDisplay() {
    if (this.element) {
      this.element.textContent = this.amount.toLocaleString();
    }
  }
}
