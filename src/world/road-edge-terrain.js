// Terén u okraje vozovky ve vykreslené síti. Uzly sítě terénu leží po 2 až 8 m. Uzel na vozovce
// se srovná pod asfalt, uzel za okrajem ale zůstává ve své výšce (svah, násep, terasa). Na hraně
// trojúhelníku mezi nimi terén stoupá rovnoměrně, takže už uvnitř vozovky vystoupí nad asfalt:
// okraj silnice je zubatý a za jízdy bliká. Vnější uzel se proto sníží právě tolik, aby terén na
// okraji vozovky zůstal pod asfaltem. Čisté výpočty (hlídá tests/road-edge-terrain.test.js).

export const EDGE_MARGIN = 0.01;   // terén na okraji vozovky leží aspoň o 1 cm pod asfaltem (m)

/**
 * Nejvyšší výška vnějšího uzlu P, při které terén na úsečce Q–P nepřesáhne asfalt na okraji vozovky.
 * yQ = terén v uzlu Q na vozovce, asphaltQ = asfalt nad Q, eQ < 0 a eP > 0 = vzdálenost uzlů
 * od okraje vozovky (záporná uvnitř). Terén i asfalt jsou podél úsečky lineární, nejvýš je tedy
 * terén nad asfaltem v místě, kde úsečka okraj protne.
 */
export function edgeBound(yQ, asphaltQ, eQ, eP) {
  if (!(eQ < 0 && eP > 0)) return Infinity;
  const f = -eQ / (eP - eQ);                 // podíl cesty z Q k okraji vozovky
  return yQ + (asphaltQ - EDGE_MARGIN - yQ) / f;
}

// Sousedé uzlu v trojúhelnících sítě (úhlopříčka 10–01 jako ve world.heightAt a buildTerrain).
const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];

/**
 * Sníží vnější uzly čtvercové sítě n1 × n1 (pořadí řádků j, sloupců i) tak, aby terén na okraji
 * vozovky neprorostl asfaltem. y = výšky uzlů (mění se), edge = vzdálenost uzlu od okraje
 * nejbližší vozovky (záporná na vozovce, NaN daleko od silnic), asphalt = výška asfaltu nad uzlem
 * na vozovce. Uzly na okraji sítě se nemění, aby navazovaly na sousední dlaždice.
 * Vrací počet snížených uzlů.
 */
export function limitRoadEdges(n1, y, edge, asphalt) {
  const original = Float64Array.from(y);
  let lowered = 0;
  for (let j = 1; j < n1 - 1; j++) for (let i = 1; i < n1 - 1; i++) {
    const p = j * n1 + i, eP = edge[p];
    if (!(eP > 0)) continue;
    let bound = Infinity;
    for (const [di, dj] of NEIGHBORS) {
      const q = (j + dj) * n1 + i + di, eQ = edge[q];
      if (!(eQ < 0) || asphalt[q] !== asphalt[q]) continue;
      bound = Math.min(bound, edgeBound(original[q], asphalt[q], eQ, eP));
    }
    if (bound < y[p]) { y[p] = bound; lowered++; }
  }
  return lowered;
}
