const normalize = (text) => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim();

export function initMapSearch(world, setDestination) {
  const form = document.getElementById('bigmap-search');
  const input = document.getElementById('bigmap-query');
  const list = document.getElementById('bigmap-results');
  const places = [...world.meta.places, ...world.meta.landmarks]
    .filter(([x, z]) => x >= world.playMinX && x <= world.playMaxX && z >= world.playMinZ && z <= world.playMaxZ)
    .map(([x, z, name]) => ({ x, z, name, key: normalize(name) }));

  const matches = () => {
    const query = normalize(input.value);
    if (!query) return [];
    return places.filter((place) => place.key.includes(query))
      .sort((a, b) => Number(b.key === query) - Number(a.key === query)
        || Number(b.key.startsWith(query)) - Number(a.key.startsWith(query))
        || a.name.localeCompare(b.name, 'cs')).slice(0, 5);
  };
  const choose = ({ x, z, name }) => {
    input.value = '';
    list.replaceChildren();
    setDestination({ x, z, name });
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
      button.type = 'button'; button.textContent = place.name;
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
