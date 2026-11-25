import { SAVE_KEY } from './save-data.js';

// Spojení s aktuální verzí databáze drží právo zápisu. Další zvýšení verze
// prohlížeč povolí až po zavření spojení, i pokud původní karta havarovala.
async function databaseLock(waiting, lost) {
  function open(version) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(SAVE_KEY + '-relace', version);
      let upgraded = false;
      request.onupgradeneeded = () => { upgraded = true; };
      request.onblocked = waiting;
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve({ db: request.result, upgraded });
    });
  }
  for (;;) {
    const { db } = await open();
    const next = db.version + 1;
    db.close();
    try {
      const lock = await open(next);
      if (lock.upgraded) {
        lock.db.onclose = lost;
        return () => lock.db.close();
      }
      lock.db.close();
    } catch (error) {
      if (error.name !== 'VersionError') throw error;
    }
  }
}

export function acquireSaveLock(waiting, lost) {
  if (!navigator.locks) return databaseLock(waiting, lost);
  return new Promise((resolve, reject) => {
    const hold = () => new Promise(release => resolve(release));
    navigator.locks.request(SAVE_KEY, { ifAvailable: true }, lock => {
      if (lock) return hold();
      waiting();
      return navigator.locks.request(SAVE_KEY, hold);
    }).catch(reject);
  });
}
