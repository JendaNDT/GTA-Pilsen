// Ostrost a stabilita obrazu: kdy mají zmizet jemné vzory, jak ostře filtrovat textury a v jakém
// rozlišení kreslit. Čisté výpočty bez prohlížeče (hlídá je tests/image-quality.test.js).
//
// Jemný procedurální vzor (zrno asfaltu, omítky, spáry cihel) bliká, když jedna jeho buňka zabere
// méně než dva pixely: při každém pohybu kamery padne pixel na jiné místo vzoru a barva přeskakuje.
// Vzor proto plynule mizí, když promítnutý pixel dosáhne čtvrtiny buňky, a zmizí úplně u poloviny.
// Původní (pozdější) mizení vrací adresa ?obraz=puvodni kvůli porovnání.

export const FADE_START = 0.25;   // podíl buňky vzoru, od kterého vzor slábne
export const FADE_END = 0.5;      // podíl buňky, u kterého vzor zmizí (dva pixely na buňku)

const search = globalThis.location?.search ?? '';
export const ORIGINAL_IMAGE = new URLSearchParams(search).get('obraz') === 'puvodni';

/**
 * Rozmezí velikosti promítnutého pixelu v metrech [začátek, konec], ve kterém vzor s buňkou cell
 * (metry) plynule zmizí. legacy = původní rozmezí pro ?obraz=puvodni.
 */
export function detailFadeRange(cell, legacy = null, original = ORIGINAL_IMAGE) {
  if (original && legacy) return legacy;
  return [cell * FADE_START, cell * FADE_END];
}

/** Anizotropní filtrování textur země podle předvolby (víc = ostřejší země v dálce). */
export function groundAnisotropy(quality, maxAnisotropy, original = ORIGINAL_IMAGE) {
  const wanted = original ? 4 : quality === 'low' ? 4 : quality === 'medium' ? 8 : 16;
  return Math.max(1, Math.min(wanted, maxAnisotropy || 1));
}

/**
 * Největší poměr pixelů vykreslování k pixelům obrazovky. Nízká předvolba na počítači kreslí
 * v plném rozlišení (dřív 0,75 a obraz se zvětšoval, takže byl rozmazaný); na telefonu zůstává 0,75.
 * Při pomalé grafice rozlišení dál snižuje automatika (resolutionScale).
 */
export function profilePixelRatio(profileRatio, mobile, original = ORIGINAL_IMAGE) {
  if (original || mobile) return profileRatio;
  return Math.max(1, profileRatio);
}

/**
 * Doostření po časovém vyhlazení (TRAA) na vysoké a ultra předvolbě. Vrací parametr pro SharpenNode
 * (0 = nejostřejší, 2 = bez doostření), nebo null, když se nedoostřuje.
 */
export function temporalSharpness(original = ORIGINAL_IMAGE) {
  return original ? null : 0.35;
}

/**
 * Pořadí kreslení plochého povrchu dlaždice ci (base = 14 asfalt, 16 značení).
 * Sousední dlaždice se liší o 0,5 podle šachovnice, takže se jejich překryv nekreslí jednou tak
 * a jednou onak podle vzdálenosti od kamery. Pořadí druhů povrchů se tím nemění (rozdíl < 1).
 */
export function decalOrder(base, ci, cols) {
  const parity = (ci % cols + Math.floor(ci / cols)) % 2;
  return base + parity * 0.5;
}
