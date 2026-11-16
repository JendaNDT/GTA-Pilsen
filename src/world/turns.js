// Pravidla přechodu mezi směrovými hranami. Relace s mezilehlou cestou nesou
// stav až do konce manévru, takže cesta z jiného vjezdu zůstává průjezdná.
export class TurnRules {
  constructor(world, restrictions = []) {
    this.direct = new Map();
    this.starts = new Map();
    this.contexts = [[]];
    this.contextIds = new Map();
    const byRoad = new Map();
    const used = new Set(restrictions.flatMap((r) => [...r.from, ...r.to, ...(r.via || []).flat()]));
    for (let e = 0; e < world.edgeCount; e++) {
      const road = world.eRoad[e];
      if (!used.has(road)) continue;
      if (!byRoad.has(road)) byRoad.set(road, []);
      byRoad.get(road).push(e);
    }
    let trieId = 0;
    const newTrie = (only) => ({ id: trieId++, only, links: new Map(), end: false });
    for (const rule of restrictions) {
      const only = rule.kind.startsWith('only_');
      const uTurn = rule.kind.endsWith('_u_turn');
      const outgoing = new Set(rule.to);
      for (const from of rule.from.flatMap((road) => byRoad.get(road) || [])) {
        const node = world.eTo[from];
        if (rule.at) {
          if (Math.hypot(world.nodeX[node] - rule.at[0], world.nodeZ[node] - rule.at[1]) > 0.18) continue;
          const targets = new Set(this.outgoing(world, node).filter((e) => outgoing.has(world.eRoad[e])
            && (!uTurn || !rule.from.includes(world.eRoad[e]) || world.eTo[e] === world.eFrom[from])));
          if (!targets.size) continue;
          if (!this.direct.has(from)) this.direct.set(from, []);
          this.direct.get(from).push({ only, targets });
        } else {
          const chains = this.chains(world, from, rule.via.map((roads) => new Set(roads)), outgoing);
          if (!chains.length) continue;
          const root = newTrie(only);
          for (const chain of chains) {
            let branch = root;
            for (const e of chain) {
              if (!branch.links.has(e)) branch.links.set(e, newTrie(only));
              branch = branch.links.get(e);
            }
            branch.end = true;
          }
          if (!this.starts.has(from)) this.starts.set(from, []);
          this.starts.get(from).push(root);
        }
      }
    }
  }

  outgoing(w, node) {
    return Array.from(w.outEdges.subarray(w.outStart[node], w.outStart[node + 1]));
  }

  chains(w, from, via, target) {
    const found = [];
    const visit = (prev, index, path) => {
      if (path.length > 16) return;
      for (const e of this.outgoing(w, w.eTo[prev])) {
        if (w.eTo[e] === w.eFrom[prev] || path.includes(e)) continue;
        const road = w.eRoad[e];
        if (index === via.length - 1 && target.has(road)) found.push([...path, e]);
        if (index + 1 < via.length && via[index + 1].has(road)) visit(e, index + 1, [...path, e]);
        if (via[index].has(road)) visit(e, index, [...path, e]);
      }
    };
    for (const e of this.outgoing(w, w.eTo[from])) {
      if (w.eTo[e] !== w.eFrom[from] && via[0].has(w.eRoad[e])) visit(e, 0, [e]);
    }
    return found;
  }

  relevant(edge) { return this.direct.has(edge) || this.starts.has(edge); }

  advance(from, to, context = 0) {
    const direct = this.direct.get(from);
    if (direct?.some((rule) => rule.only !== rule.targets.has(to))) return -1;
    const starts = this.starts.get(from);
    if (!starts && !context) return 0;
    const active = [...(starts || []), ...this.contexts[context]];
    const following = [];
    for (const branch of active) {
      const next = branch.links.get(to);
      if ((branch.only && !next) || (!branch.only && next?.end)) return -1;
      if (next?.links.size && !(branch.only && next.end)) following.push(next);
    }
    if (!following.length) return 0;
    const signature = following.map((b) => b.id).sort((a, b) => a - b).join(',');
    if (!this.contextIds.has(signature)) {
      this.contextIds.set(signature, this.contexts.length);
      this.contexts.push(following);
    }
    return this.contextIds.get(signature);
  }
}
