// Celá obrazovka: hra skryje lišty a záložky prohlížeče. Prohlížeč ji dovolí zapnout jen
// po kliknutí nebo stisku klávesy, proto se o ni hra pokusí při kliknutí na Hrát a tlačítkem ⛶.
// Safari na iPadu zná jen starší jména s předponou webkit, iPhone celou obrazovku pro stránky
// nepovoluje vůbec (tlačítko se tam nezobrazí). Funkce dostávají dokument, aby šly zkoušet v Node.

/** Umí prohlížeč přepnout stránku na celou obrazovku? */
export function fullscreenSupported(doc = globalThis.document) {
  const root = doc?.documentElement;
  const enabled = doc?.fullscreenEnabled ?? doc?.webkitFullscreenEnabled ?? false;
  return Boolean(enabled && (root?.requestFullscreen || root?.webkitRequestFullscreen));
}

/** Běží hra právě přes celou obrazovku? */
export function isFullscreen(doc = globalThis.document) {
  return Boolean(doc?.fullscreenElement ?? doc?.webkitFullscreenElement);
}

/** Přepne na celou obrazovku. Vrací true, když se to povedlo; odmítnutí prohlížeče hru nezastaví. */
export async function enterFullscreen(doc = globalThis.document) {
  if (!fullscreenSupported(doc) || isFullscreen(doc)) return false;
  const root = doc.documentElement;
  try {
    if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
    else await root.webkitRequestFullscreen();
    return true;
  } catch {
    return false;
  }
}

/** Vrátí okno prohlížeče. Vrací true, když hra celou obrazovku opravdu opustila. */
export async function exitFullscreen(doc = globalThis.document) {
  if (!isFullscreen(doc)) return false;
  try {
    if (doc.exitFullscreen) await doc.exitFullscreen();
    else await doc.webkitExitFullscreen();
    return true;
  } catch {
    return false;
  }
}

/** Tlačítko ⛶: zapne nebo vypne celou obrazovku. */
export function toggleFullscreen(doc = globalThis.document) {
  return isFullscreen(doc) ? exitFullscreen(doc) : enterFullscreen(doc);
}

/** Má hra po kliknutí na Hrát přejít na celou obrazovku? setting = volba v nastavení. */
export function fullscreenOnPlay(setting, doc = globalThis.document) {
  return setting !== false && fullscreenSupported(doc) && !isFullscreen(doc);
}
