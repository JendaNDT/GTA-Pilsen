import { findPizzaChoices, PIZZERIAS, pizzaOrder } from './pizza-offers.js';

export function initPizzaMenu() {
  const shop = document.getElementById('pizza-shop');
  const address = document.getElementById('pizza-address');
  const search = document.getElementById('pizza-search');
  const modes = document.querySelectorAll('input[name="pizza-mode"]');
  const summary = document.getElementById('pizza-pay');
  const accept = document.querySelector('[data-job="pizza"]');
  let byAddress = false;
  let selected = null;

  function fill(select, labels) {
    const previous = select.value;
    select.replaceChildren(...labels.map(label => new Option(label, label, false, label === previous)));
    select.disabled = !labels.length;
  }

  function showPrice() {
    const pizzeria = PIZZERIAS.find(item => item.name === shop.value);
    const order = pizzeria?.orders.find(item => item.label === address.value);
    selected = order ? pizzaOrder(pizzeria, order) : null;
    accept.disabled = !selected;
    if (!selected) {
      summary.textContent = byAddress ? 'Žádná adresa neodpovídá hledání. Zkus jinou obec nebo ulici.'
        : 'Žádná pizzerie neodpovídá hledání. Zkus jiný název nebo místo.';
      return;
    }
    const { metres, reward, bonus, limit } = selected;
    const length = metres < 1000 ? metres + ' m' : (metres / 1000).toLocaleString('cs-CZ', { maximumFractionDigits: 1 }) + ' km';
    const time = Math.floor(limit / 60) + ':' + String(limit % 60).padStart(2, '0');
    summary.textContent = `${length} na kole · ${reward} Kč + ${bonus} Kč za předání do ${time} od vyzvednutí`;
  }

  function showPartners() {
    if (byAddress) {
      fill(shop, PIZZERIAS.filter(item => item.orders.some(order => order.label === address.value)).map(item => item.name));
    } else {
      const pizzeria = PIZZERIAS.find(item => item.name === shop.value);
      fill(address, pizzeria?.orders.map(order => order.label) ?? []);
    }
    showPrice();
  }

  function filter() {
    fill(byAddress ? address : shop, findPizzaChoices(search.value, byAddress));
    showPartners();
  }

  for (const mode of modes) mode.addEventListener('change', () => {
    byAddress = mode.value === 'address';
    document.getElementById('pizza-choices').prepend((byAddress ? address : shop).closest('label'));
    document.getElementById('pizza-search-label').textContent = byAddress ? 'Hledat adresu' : 'Hledat pizzerii';
    search.value = '';
    filter();
  });
  shop.addEventListener('change', () => byAddress ? showPrice() : showPartners());
  address.addEventListener('change', () => byAddress ? showPartners() : showPrice());
  search.addEventListener('input', filter);
  search.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      search.blur();
    }
  });
  filter();
  return () => selected;
}
