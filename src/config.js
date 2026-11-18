// Společné konstanty a nastavení podle zařízení.
import { graphicsPreferences, PROFILES, SAVE_KEY } from './game/graphics-quality.js';

export const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
export const IS_MOBILE = IS_TOUCH && Math.min(screen.width, screen.height) < 900;

const params = new URLSearchParams(location.search);
export const DEBUG = params.has('debug');
export const PARAMS = params;

export const CHUNK = 256;            // velikost dlaždice světa v metrech
export const COLL_CELL = 64;         // buňka kolizní mřížky

let storedGraphics;
try { storedGraphics = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')?.graphics; } catch { /* stará nebo nedostupná uložená hra */ }
export const SAVED_GRAPHICS = graphicsPreferences(storedGraphics);
export const QUALITY_OVERRIDE = Object.hasOwn(PROFILES, params.get('quality')) ? params.get('quality') : null;
export const DEFAULT_QUALITY = IS_MOBILE ? 'low' : 'high';
export const QUALITY = {};

export function applyQualityProfile(name) {
  const profile = PROFILES[name];
  Object.assign(QUALITY, profile, { name, shadows: profile.shadowCascades > 0 && params.get('shadows') !== '0' });
  if (params.has('view')) QUALITY.view = +params.get('view');
}

applyQualityProfile(QUALITY_OVERRIDE ?? (SAVED_GRAPHICS.choice === 'auto'
  ? SAVED_GRAPHICS.automatic ?? DEFAULT_QUALITY : SAVED_GRAPHICS.choice));

// třídy silnic (stejné číslování jako v tools/build_data.py)
export const RC = {
  MOTORWAY: 0, MOTORWAY_LINK: 1, TRUNK: 2, TRUNK_LINK: 3, PRIMARY: 4, PRIMARY_LINK: 5,
  SECONDARY: 6, SECONDARY_LINK: 7, TERTIARY: 8, TERTIARY_LINK: 9, UNCLASSIFIED: 10,
  RESIDENTIAL: 11, LIVING: 12, SERVICE: 13, PEDESTRIAN: 14, TRACK: 15, FOOTWAY: 16,
  PATH: 17, CYCLEWAY: 18, STEPS: 19,
};
export const DRIVABLE_MAX = 13;

export const RF = { ONEWAY: 1, BRIDGE: 2, TUNNEL: 4, ROUNDABOUT: 8, LIT: 16, PRIVATE: 32, AISLE: 64, SHARED_DECK: 128 };

// třídy ploch
export const LC = {
  FARMLAND: 1, MEADOW: 2, GRASS: 3, RESIDENTIAL: 4, COMMERCIAL: 5, INDUSTRIAL: 6, RAILWAY: 7,
  ALLOTMENTS: 8, CEMETERY: 9, FOREST: 10, SCRUB: 11, PARK: 12, PITCH: 13, PARKING: 14,
  PLAZA: 15, WATER: 16, SAND: 17, CONSTRUCTION: 18, GARDEN: 19, PLAYGROUND: 20,
};

// druhy budov
export const BK = {
  GENERIC: 0, HOUSE: 1, APARTMENTS: 2, COMMERCIAL: 3, INDUSTRIAL: 4, CIVIC: 5, RELIGIOUS: 6,
  GARAGE: 7, ROOF: 8, TRANSPORT: 10, FARM: 11, TOWER: 12,
};
export const BF = { GABLE: 1, RIDGE: 2, PART: 4, HAS_PARTS: 8, NO_COLLIDE: 16, PYRAMID: 32, NO_HIP: 64, INSET: 128 };
