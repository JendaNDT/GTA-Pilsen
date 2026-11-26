const normalize = (text) => text.toLowerCase().normalize('NFD')
  .replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function initMapSearch(world, selectPlace, stops, sites = []) {
  const form = document.getElementById('bigmap-search');
  const input = document.getElementById('bigmap-query');
  const list = document.getElementById('bigmap-results');
  const places = [...world.meta.places, ...world.meta.landmarks]
    .filter(([x, z]) => x >= world.playMinX && x <= world.playMaxX && z >= world.playMinZ && z <= world.playMaxZ)
    .map(([x, z, name]) => ({ x, z, name, key: normalize(name) }));
  for (const site of sites) {
    if (site.activity || !places.some(place => place.name === site.name)) {
      places.push({ ...site, key: normalize(site.name), aliasKeys: site.aliases?.map(normalize) });
    }
  }
  for (const [name, x, z, code] of stops) {
    const platform = code?.split('/')[1];
    const title = `${name} · ${platform ? `stanoviště ${platform}` : 'zastávka MHD'}`;
    places.push({ x, z, name, title, stop: true, key: normalize(title) });
  }

  const matches = () => {
    const query = normalize(input.value);
    if (!query) return [];
    const words = query.split(' ');
    return places.filter(place => place.police
      ? words.every(word => ('sluzebna ' + place.key).includes(word))
      : place.key.includes(query) || place.aliasKeys?.some(alias => alias.includes(query)))
      .sort((a, b) => Number(b.key === query || b.aliasKeys?.includes(query) || false)
        - Number(a.key === query || a.aliasKeys?.includes(query) || false)
        || Number(b.key.startsWith(query)) - Number(a.key.startsWith(query))
        || Number(Boolean(a.stop)) - Number(Boolean(b.stop))
        || (a.title ?? a.name).localeCompare(b.title ?? b.name, 'cs', { numeric: true })).slice(0, 6);
  };
  const choose = (place) => {
    input.value = '';
    list.replaceChildren();
    selectPlace(place);
  };

  document.getElementById('bigmap-controls').addEventListener('keydown', (event) => {
    if (event.code !== 'Escape') event.stopPropagation();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const [first] = matches();
    if (first) choose(first);
  });
  input.addEventListener('input', () => {
    list.replaceChildren();
    if (!normalize(input.value)) return;
    for (const place of matches()) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = place.title ?? place.name;
      button.addEventListener('click', () => choose(place));
      item.append(button);
      list.append(item);
    }
    if (!list.children.length) {
      const item = document.createElement('li');
      item.textContent = 'Žádné místo nenalezeno.';
      list.append(item);
    }
  });
}
