// Přepočet městských půdorysů do podélného a příčného směru herní mostovky.
function topRing(part, layer) {
  const faces = part.faces.filter(([kind]) => kind === layer).map(([, ring]) => {
    const points = [];
    for (let i = 0; i < ring.length; i += 3) points.push(ring.slice(i, i + 3));
    const area = points.reduce((sum, [x,,z], i) => {
      const next = points[(i + 1) % points.length];
      return sum + x * next[2] - z * next[0];
    }, 0);
    return {points, area: Math.abs(area) / 2, y: points.reduce((sum, p) => sum + p[1], 0) / points.length};
  });
  const max = Math.max(...faces.map(f => f.area));
  const face = faces.filter(f => f.area >= max * 0.95 && f.area > 0).sort((a,b) => b.y - a.y)[0];
  if (!face) throw Error('Chybí plošný půdorys ' + part.id);
  return face.points;
}

function crossing(a, b, station) {
  const t = (station - a[0]) / (b[0] - a[0]);
  return [a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
}

function boundaries(ring, station) {
  const lines = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i+1) % ring.length];
    if ((a[0] < station) !== (b[0] < station)) lines.push([a,b]);
  }
  return lines.sort((a,b) => crossing(...a, station)[0] - crossing(...b, station)[0]);
}

// Rozdělí i nekonvexní obrys podle skutečných lomů. Příčné řezy nemohou přemostit dutinu.
export function footprintStrips(ring, step = 2.5) {
  const stations = [...new Set(ring.map(p => p[0]))].sort((a,b) => a-b);
  const strips = [];
  for (let i = 1; i < stations.length; i++) {
    const from = stations[i-1], to = stations[i];
    if (to-from < 0.002) continue;
    const lines = boundaries(ring, (from+to)/2);
    if (lines.length % 2) throw Error('Neuzavřený obrys při řezu.');
    for (let j = 0; j < lines.length; j += 2) {
      const count = Math.ceil((to-from)/step);
      const corners = u => [u, crossing(...lines[j], u)[0], crossing(...lines[j+1], u)[0]];
      for (let n = 0; n < count; n++) {
        strips.push([...corners(from+(to-from)*n/count), ...corners(from+(to-from)*(n+1)/count)]);
      }
    }
  }
  return strips;
}

const median = values => [...values].sort((a,b) => a-b)[Math.floor(values.length / 2)];
const rounded = v => Math.round(v * 10000) / 10000;

export function calibrateBridge(choice, parts, roads) {
  const start = roads.start[choice.road], end = roads.start[choice.road+1], h = roads.bridgeOff[choice.road];
  if (end - start !== 1 || h === 0xffffffff) throw Error('Kalibrace očekává přímý herní profil.');
  const x = roads.x0[choice.road] * 0.1, z = roads.z0[choice.road] * 0.1;
  const length = Math.hypot(roads.dx[start], roads.dz[start]) * 0.1;
  const dx = roads.dx[start] * 0.1 / length, dz = roads.dz[start] * 0.1 / length;
  const project = ([px,y,pz]) => [(px-x)*dx+(pz-z)*dz, (pz-z)*dx-(px-x)*dz, y];
  const deck = topRing(parts.get(choice.deck), 'Most').map(project);
  const rails = choice.rails.map(id => topRing(parts.get(id), 'Zabradli').map(project));
  const sections = [0.2,0.35,0.5,0.65,0.8].map(t => {
    function cut(ring) {
      const u = length*t, lines = boundaries(ring,u);
      if (lines.length !== 2) throw Error('Nejednoznačný kontrolní řez mostu.');
      return lines.map(line => crossing(...line, u));
    }
    const [left,right] = rails.map(cut).sort((a,b) => a[0][0]-b[0][0]);
    const [a,b] = cut(deck);
    const level = (a[1]+b[1])/2;
    const profile = (roads.bridgeY[h]*(1-t) + roads.bridgeY[h+1]*t)*0.02;
    return {width:right[0][0]-left[1][0], axis:(right[0][0]+left[1][0])/2,
      outerWidth:b[0]-a[0], lift:level-profile};
  });
  const offset = median(sections.map(s => s.axis)), lift = median(sections.map(s => s.lift));
  if (sections.some(s => Math.abs(s.lift-lift) > 0.1 || Math.abs(s.width-choice.clearWidth) > 0.15))
    throw Error('Kontrolní řezy nesouhlasí s přijatou šířkou nebo výškou mostovky.');
  const strips = rails.flatMap(ring => footprintStrips(ring)).map(strip => strip.map(rounded));
  const pier = topRing(parts.get(choice.pier), 'Pilir_Sloup').map(project);
  const span = points => points.map(p => p[0]/length);
  const deckSpan = span(deck), pierSpan = span(pier);
  const archStops = [Math.min(...deckSpan), (Math.min(...pierSpan)+Math.max(...pierSpan))/2,
    Math.max(...deckSpan)].map(rounded);
  if (!(0 <= archStops[0] && archStops[0] < archStops[1] && archStops[1] < archStops[2] && archStops[2] <= 1))
    throw Error('Podpory neleží uvnitř herního rozpětí.');
  return {road:choice.road, archStops, shiftX:rounded(-dz*offset), shiftZ:rounded(dx*offset),
    lift:rounded(lift), halfWidth:rounded(median(sections.map(s => s.outerWidth))/2),
    railHeight:choice.railHeight, strips};
}
