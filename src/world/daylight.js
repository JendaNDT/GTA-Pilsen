// Rozdělení denního světla mezi přímé slunce, světlo oblohy a odrazy prostředí.
// Vzhledová zkouška (listopad 2026): přímé slunce je výrazně silnější než rozptýlené světlo,
// stín je chladnější a odraz oblohy slabší. Stěny v úzkých ulicích tak nepřebírají jas
// oblohy, kterou by ve skutečnosti zakrývaly protější domy, a stíny jsou čitelné.
// Původní nastavení zůstává dostupné adresou ?vzhled=puvodni kvůli porovnání.

export const LOOKS = Object.freeze(['novy', 'puvodni']);

export function lookFromParams(params) {
  const chosen = params?.get?.('vzhled');
  return LOOKS.includes(chosen) ? chosen : 'novy';
}

/** Vzhled podle adresy stránky; mimo prohlížeč (testy v Node) vždy nový vzhled. */
export function pageLook() {
  return lookFromParams(new URLSearchParams(globalThis.location?.search ?? ''));
}

// Úprava barvy omítek v novém vzhledu: sytost a zesvětlení podle jasu barvy.
// Funkce pracuje s čísly i s uzly TSL (používá jen sub/mul/add), proto jde testovat v Node.
export const WALL_SATURATION = 1.15;
export function wallLift(luminance) {
  // tmavá omítka (jas 0,1) se zesvětlí o 45 %, světlá (jas 0,7) jen o 12 %
  return typeof luminance === 'number'
    ? 1.12 + 0.33 * Math.max(0, Math.min(1, (0.7 - luminance) / 0.6))
    : luminance.oneMinus().sub(0.3).div(0.6).clamp(0, 1).mul(0.33).add(1.12);
}

const smooth = (x, a, b) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Světla pro výšku slunce `elevation` (y směru ke slunci), denní podíl `day` (0–1),
 * soumrak `dusk` (0–1) a zatažení `overcast` (0–0,59).
 * Intenzity jsou v jednotkách three.js. Barvy jsou přechody: první barva 0xRRGGBB
 * a dvojice [barva, podíl], které se postupně přimíchají (lineárně jako Color.lerp).
 */
export function daylight({ elevation, day, dusk, overcast }, look = 'novy') {
  const rise = smooth(elevation, -0.06, 0.19);
  if (look === 'puvodni') {
    return {
      sun: 1.85 * (1 - overcast * 1.2) * rise,
      sunColor: [0xfff0d8, [0xffa05a, dusk]],
      hemi: 0.95 + 1.18 * day,
      hemiSky: [0xffe9d5, [0x6f83c0, 1 - day]],
      hemiGround: [0x9a927c, [0x343a52, 1 - day]],
      environment: 0.22 * day,
      facadeEnvironment: null,
      groundRadiance: { color: [0x000000], scale: 0 },
      shadow: 0.43 + 0.48 * day * (1 - dusk * 0.50),
    };
  }
  // Při zatažení slábne slunce a světlo oblohy přebírá jeho podíl, aby den nezešedl.
  const cloudy = Math.min(1, Math.max(0, overcast / 0.59));
  return {
    sun: 3.1 * (1 - overcast * 1.2) * rise,
    sunColor: [0xffeed2, [0xff9a52, dusk]],
    hemi: 0.95 + day * (1.05 + 0.6 * cloudy),
    hemiSky: [0xc4ccd8, [0xdadcde, cloudy], [0xe6c3a5, dusk * 0.6], [0x6f83c0, 1 - day]],
    hemiGround: [0xb2a48a, [0x343a52, 1 - day]],
    // Odraz oblohy zůstává pro vodu, auta a dlažbu stejný jako dřív (modrá řeka, lesk laku).
    // Fasády ho mají jen nepatrný (viz setFacadeEnvironment), právě u nich vznikal závoj.
    environment: 0.22 * day,
    facadeEnvironment: 0.012 * day,
    // Jas země pod obzorem v mapě odrazů, zhruba osmina jasu obzoru za jasného dne.
    groundRadiance: { color: [0x8a7f6c, [0x6f6a62, cloudy]], scale: 2.4 * day },
    shadow: 0.43 + 0.57 * day * (1 - dusk * 0.40),
  };
}
