// Jeden rozpočet pro úlomky všech druhů. Místo se uvolňuje po kroku Jolt.
export class DebrisBudget {
  constructor(limit, inView) {
    this.limit = limit;
    this.inView = inView;
    this.items = new Map();
    this.needed = 0;
  }

  room(count) {
    if (this.items.size + count <= this.limit()) return true;
    this.needed = Math.max(this.needed, count);
    return false;
  }

  add(body, remove) { this.items.set(body, remove); }
  forget(body) { this.items.delete(body); }

  step(budget) {
    const target = Math.max(0, this.limit() - this.needed);
    this.needed = 0;
    if (this.items.size <= target) return budget;
    // Map zachovává stáří i při shodné prioritě.
    const groups = [[], [], [], []];
    for (const body of this.items.keys()) {
      groups[Number(body.IsActive()) * 2 + Number(this.inView(body))].push(body);
    }
    for (const group of groups) for (const body of group) {
      if (this.items.size <= target || budget === 0) return budget;
      const remove = this.items.get(body);
      this.items.delete(body);
      remove();
      budget--;
    }
    return budget;
  }
}
