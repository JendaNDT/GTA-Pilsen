import { TAXI_STANDS, taxiDestinations, regionalPickup, regionalOffer } from './regional-taxi.js';
import { initPizzaMenu } from './pizza-menu.js';
import { CAR_PRICE, GARAGE, UPGRADES } from './garage.js';
import { jobTitle, resultText } from './missions.js';
import { TAXI_RIDES } from './taxi.js';
import { shiftName, shiftTime } from './shift-plans.js';
import { SHIFT_STATUS } from './shift.js';

export function initWorkUI(game, play, refreshMenu) {
  const $ = (id) => document.getElementById(id);
  const { jobs, garage, shifts } = game;
  const garageButtons = document.querySelectorAll('[data-garage]');

  const taxiCards = $('taxi-cards');
  const taxiFeedback = $('taxi-feedback');

  const selectedPizza = initPizzaMenu();

  const region = $('regional-taxi'), destination = $('taxi-destination');
  const search = $('taxi-search');
  const acceptRegional = $('regional-taxi-start');
  let regionalOrigin, regionalTrip, pricedStand;
  function showRegionalPrice() {
    const stand = destination.selectedIndex < 0 ? null : TAXI_STANDS[Number(destination.value)];
    if (stand !== pricedStand) {
      pricedStand = stand;
      regionalTrip = regionalOffer(game.world, regionalOrigin, stand);
    }
    acceptRegional.disabled = !regionalTrip;
    const summary = $('regional-taxi-summary');
    if (!regionalOrigin) summary.textContent = 'V dosahu není místo pro nástup. Přijeď blíž k obydlené části mapy.';
    else if (!stand) summary.textContent = 'Žádný cíl neodpovídá hledání. Zkus jinou obec nebo ulici.';
    else if (!regionalTrip) summary.textContent = 'Do tohoto cíle se od nástupu nedá dojet. Zvol jiný cíl.';
    else {
      const km = (regionalTrip.len / 1000).toLocaleString('cs-CZ', { maximumFractionDigits: 1 });
      summary.textContent = `Nástup · ${regionalTrip.name} → ${regionalTrip.label} · ${km} km · ${regionalTrip.reward} Kč`;
    }
  }
  function filterDestinations() {
    const matches = taxiDestinations(search.value, regionalOrigin?.stand);
    const previous = destination.selectedIndex < 0 ? null : TAXI_STANDS[Number(destination.value)];
    const selected = matches.includes(previous) ? previous :
      matches.find(stand => stand.area === 'Starý Plzenec') ?? matches[0];
    destination.replaceChildren(...matches.map(stand => {
      const label = stand.area === stand.label ? stand.area : stand.area + ' · ' + stand.label;
      return new Option(label, TAXI_STANDS.indexOf(stand), false, stand === selected);
    }));
    destination.disabled = matches.length === 0;
    showRegionalPrice();
  }
  function showRegion() {
    if (!region.open || region.hidden) return;
    regionalOrigin = regionalPickup(game.world, game.car);
    pricedStand = undefined;
    filterDestinations();
  }
  search.addEventListener('input', filterDestinations);
  search.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      search.blur();
    }
  });
  region.addEventListener('toggle', showRegion);
  destination.addEventListener('change', showRegionalPrice);
  acceptRegional.addEventListener('click', () => {
    if (!regionalTrip) return;
    const error = jobs.start('taxi', regionalTrip);
    $('job-feedback').textContent = error ?? '';
    updateJobs(true);
    if (!error) play();
  });

  function showTaxiOffers() {
    const reason = jobs.taxiUnavailable();
    region.hidden = Boolean(reason);
    showRegion();
    const offers = reason ? [] : jobs.offersForTaxi();
    taxiFeedback.textContent = reason ?? (offers.length ? '' : 'Na místní jízdu v okolí teď žádný cestující nečeká.');
    const cards = [];
    for (const id of Object.keys(TAXI_RIDES)) {
      const offer = offers.find((item) => item.id === id);
      if (!offer) continue;
      const ride = TAXI_RIDES[id];
      const card = document.createElement('article');
      card.className = 'taxi-card';
      const title = document.createElement('h4');
      title.textContent = ride.name;
      const route = document.createElement('p');
      route.textContent = `Nástup · ${offer.name} → Cíl · ${offer.label}`;
      const request = document.createElement('p');
      request.textContent = ride.request;
      const pay = document.createElement('p');
      pay.textContent = ride.bonus ? `Odhad výplaty ${offer.reward}–${offer.reward + ride.bonus} Kč` : `Výplata ${offer.reward} Kč`;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Přijmout';
      button.setAttribute('aria-label', `Přijmout · ${ride.name}`);
      button.addEventListener('click', () => {
        const error = jobs.start('taxi', offer);
        $('job-feedback').textContent = error ?? '';
        updateJobs(true);
        if (!error) play();
      });
      const actions = document.createElement('footer');
      actions.append(pay, button);
      card.append(title, route, request, actions);
      cards.push(card);
    }
    taxiCards.replaceChildren(...cards);
  }

  function updateJobs(showOffers = false) {
    const j = jobs.job;
    $('job-result').textContent = j ? `Probíhá · ${jobTitle(j)}`
      : jobs.last ? resultText(jobs.last) : '';
    $('job-result').hidden = !j && !jobs.last;
    $('job-offers').hidden = $('job-demo').hidden = !!j;
    $('job-cancel').hidden = !j;
    $('job-retry').hidden = !j?.pending;
    if (showOffers && !j) showTaxiOffers();
  }

  function updateGarage() {
    const owned = garage.snapshot(), repair = garage.repairPrice;
    $('garage-balance').textContent = `Zůstatek ${game.money.toLocaleString('cs-CZ')} Kč`;
    const condition = owned ? `Stav vozu ${Math.floor(owned.health)} %${garage.active ? ' · venku' : ' · v garáži'}` : 'První vůz · malé městské auto';
    const installed = owned && Object.keys(UPGRADES).filter((key) => owned.upgrades[key]).map((key) => UPGRADES[key].label);
    $('garage-car').textContent = installed?.length ? `${condition} · ${installed.join(', ')}` : condition;
    const prices = { buy: CAR_PRICE, repair, brakes: UPGRADES.brakes.price, tires: UPGRADES.tires.price };
    const labels = { buy: 'Koupit malé auto', repair: 'Opravit vůz', brakes: UPGRADES.brakes.label, tires: UPGRADES.tires.label };
    const available = {
      buy: !owned, retrieve: owned && !garage.active && owned.health > 0,
      store: garage.active, repair: owned && !garage.active && repair > 0,
      brakes: owned && !garage.active && !owned.upgrades.brakes, tires: owned && !garage.active && !owned.upgrades.tires,
    };
    for (const button of garageButtons) {
      const key = button.dataset.garage;
      if (key === 'navigate') {
        button.hidden = garage.near;
        continue;
      }
      button.hidden = !available[key];
      button.disabled = !garage.near || game.mode !== 'foot' || game.money < (prices[key] ?? 0);
      if (labels[key]) button.textContent = `${labels[key]} · ${prices[key].toLocaleString('cs-CZ')} Kč`;
    }
    $('garage-feedback').textContent = !garage.near ? 'Nákup a servis jsou dostupné u garáže.'
      : game.mode === 'car' ? 'Pro použití garáže vystup z auta.' : '';
  }

  const select = $('shift-offer');
  let offers = [];
  const showDirection = () => {
    const offer = offers.find(({ id }) => id === select.value);
    $('shift-direction').textContent = offer
      ? `Nástup ${offer.from} · konec směny ${offer.to}. Směr ${offer.destination} · odjezd ${shiftTime(offer.departure)}` : 'Žádné dostupné spoje';
  };
  function updateShifts() {
    const run = shifts.active, last = shifts.last;
    const selection = select.value;
    offers = run ? [] : shifts.offers();
    select.replaceChildren(...offers.map((offer) => new Option(shiftName(offer), offer.id)));
    if (offers.some((offer) => offer.id === selection)) select.value = selection;
    showDirection();
    $('shift-select').hidden = !!run;
    $('shift-start').hidden = !!run;
    $('shift-start').disabled = !offers.length;
    $('shift-cancel').hidden = !run;
    $('shift-retry').hidden = !run?.pending;
    $('shift-summary').hidden = !run && !last;
    $('shift-result').textContent = run ? `Probíhá · ${shiftName(run.offer)}` : last
      ? `${last.name} · ${SHIFT_STATUS[last.state]}${last.amount ? ` · +${last.amount} Kč` : ''}${last.note ? ` · ${last.note}` : ''}` : '';
    $('shift-score').textContent = !run && last?.score !== undefined
      ? `${last.score}/100 bodů · zastávky ${last.served}/${last.count} (${last.stops}/45 b.) · rozpis ${last.punctuality}/20 b. · pravidla ${last.rules}/25 b. · plynulost ${last.comfort}/10 b.` : '';
    $('shift-traffic').textContent = !run && last?.score !== undefined
      ? `Červená ${last.red} · nezastavení u STOP ${last.ignoredStop} · nedání přednosti ${last.yielding} · nad limitem ${last.speeding} s · zásah brzdy ${last.safetyStops}` : '';
  }
  select.addEventListener('change', showDirection);
  $('shift-start').addEventListener('click', () => {
    const error = shifts.start(select.value);
    $('shift-feedback').textContent = error ?? '';
    updateShifts();
    if (!error) play();
  });
  $('shift-cancel').addEventListener('click', () => {
    shifts.end('cancelled');
    $('shift-feedback').textContent = '';
    updateShifts();
    refreshMenu();
  });
  $('shift-retry').addEventListener('click', () => {
    $('shift-feedback').textContent = shifts.pay() ?? '';
    updateShifts();
    refreshMenu();
  });

  for (const button of document.querySelectorAll('[data-job]')) {
    button.addEventListener('click', () => {
      const error = jobs.start(button.dataset.job, button.dataset.job === 'pizza' ? selectedPizza() : undefined);
      $('job-feedback').textContent = error ?? '';
      updateJobs(true);
      if (!error) play();
    });
  }
  $('job-cancel').addEventListener('click', () => {
    jobs.end('cancelled', 'Zrušeno hráčem');
    $('job-feedback').textContent = '';
    updateJobs(true);
    refreshMenu();
  });
  $('job-retry').addEventListener('click', () => {
    $('job-feedback').textContent = jobs.pay() ?? '';
    updateJobs(true);
    refreshMenu();
  });
  for (const button of document.querySelectorAll('[data-work-resume]')) button.addEventListener('click', play);
  for (const button of garageButtons) {
    button.addEventListener('click', () => {
      const key = button.dataset.garage;
      if (key === 'navigate') {
        play();
        game.toggleMap(true);
        game.areaMap.select({ ...GARAGE, exact: true }, true);
      } else {
        const message = garage.perform(key);
        updateGarage();
        $('garage-feedback').textContent = message;
      }
    });
  }

  return (section) => {
    $('job-feedback').textContent = '';
    $('shift-feedback').textContent = '';
    updateJobs(section === 'jobs');
    updateGarage();
    updateShifts();
  };
}
