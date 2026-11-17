import { CAR_PRICE, UPGRADES } from './garage.js';
import { JOB_NAMES, resultText } from './missions.js';
import { shiftName, shiftTime } from './shift-plans.js';
import { SHIFT_STATUS } from './shift.js';

export function initWorkUI(game, play) {
  const $ = (id) => document.getElementById(id);
  const { jobs, garage, shifts } = game;
  const garageButtons = document.querySelectorAll('[data-garage]');

  function updateJobs() {
    const j = jobs.job;
    $('job-result').textContent = j ? `Probíhá · ${JOB_NAMES[j.type]}`
      : jobs.last ? resultText(jobs.last) : 'Taxi jede s řidičem v osobním autě. Po příjezdu k zákazníkovi zastav.';
    $('job-offers').hidden = $('job-demo').hidden = !!j;
    $('job-cancel').hidden = !j;
    $('job-retry').hidden = !j?.pending;
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
    $('shift-direction').textContent = offer ? `Směr ${offer.destination} · odjezd ${shiftTime(offer.departure)}` : 'Žádné dostupné spoje';
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
  });
  $('shift-retry').addEventListener('click', () => {
    $('shift-feedback').textContent = shifts.pay() ?? '';
    updateShifts();
  });

  for (const button of document.querySelectorAll('[data-job]')) {
    button.addEventListener('click', () => {
      const error = jobs.start(button.dataset.job);
      $('job-feedback').textContent = error ?? '';
      updateJobs();
      if (!error) play();
    });
  }
  $('job-cancel').addEventListener('click', () => {
    jobs.end('cancelled', 'Zrušeno hráčem');
    $('job-feedback').textContent = '';
    updateJobs();
  });
  $('job-retry').addEventListener('click', () => {
    $('job-feedback').textContent = jobs.pay() ?? '';
    updateJobs();
  });
  for (const button of document.querySelectorAll('[data-work-resume]')) button.addEventListener('click', play);
  for (const button of garageButtons) {
    button.addEventListener('click', () => {
      const key = button.dataset.garage;
      if (key === 'navigate') {
        garage.navigate();
        play();
        game.toggleMap(true);
      } else {
        const message = garage.perform(key);
        updateGarage();
        $('garage-feedback').textContent = message;
      }
    });
  }

  return () => {
    $('job-feedback').textContent = '';
    $('shift-feedback').textContent = '';
    updateJobs();
    updateGarage();
    updateShifts();
  };
}
