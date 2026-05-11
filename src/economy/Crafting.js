// ============================================================
// Starlight Engine — Crafting System
// ============================================================

export const CRAFTING_RECIPES = [
  { id: 'lamp', name: 'Golden Lamp', ingredients: { chair: 1, plant: 1 }, output: 'lamp', outputCount: 1 },
  { id: 'bookshelf', name: 'Bookshelf', ingredients: { chair: 2, table: 1 }, output: 'bookshelf', outputCount: 1 },
  { id: 'rug', name: 'Persian Rug', ingredients: { plant: 2, lamp: 1 }, output: 'rug', outputCount: 1 },
  { id: 'tv', name: 'Retro TV', ingredients: { lamp: 1, mirror: 1 }, output: 'tv', outputCount: 1 },
  { id: 'fountain', name: 'Water Fountain', ingredients: { plant: 3, lamp: 2 }, output: 'fountain', outputCount: 1 },
  { id: 'dragon', name: 'Toy Dragon', ingredients: { statue: 1, trophy: 1 }, output: 'dragon', outputCount: 1 },
  { id: 'arcade', name: 'Arcade Machine', ingredients: { tv: 1, jukebox: 1 }, output: 'arcade', outputCount: 1 },
  { id: 'fireplace', name: 'Stone Fireplace', ingredients: { barrel: 2, bench: 1 }, output: 'fireplace', outputCount: 1 },
];

export class CraftingSystem {
  constructor(inventorySystem) {
    this.inventorySystem = inventorySystem;
  }

  canCraft(recipe) {
    for (const [ing, count] of Object.entries(recipe.ingredients)) {
      if (this.inventorySystem.getCount(ing) < count) return false;
    }
    return true;
  }

  craft(recipe) {
    if (!this.canCraft(recipe)) return false;
    for (const [ing, count] of Object.entries(recipe.ingredients)) {
      this.inventorySystem.remove(ing, count);
    }
    this.inventorySystem.add(recipe.output, recipe.outputCount);
    return true;
  }

  getAvailableRecipes() {
    return CRAFTING_RECIPES.map(r => ({ ...r, canCraft: this.canCraft(r) }));
  }
}
