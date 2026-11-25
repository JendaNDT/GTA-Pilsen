import { museumWaterPolygon } from './sady-layout.js';
import { createSady } from './sady-model.js';
import { createBorySite } from './bory.js';
import { isFountainPool } from './fountain-shapes.js';
import { createFountainSites, fountainContact, fountainRay, fountainSurface } from './fountain-site.js';
import { createPavilionSite, nearPavilion, pavilionContact, pavilionRay, pavilionSurface } from './pavilion-site.js';
import { columnContact, columnRay, columnSurface, createColumnSite } from './plague-column-site.js';
import { stationForecourtOffsets, stationRetainingWalls } from './station-forecourt.js';
import { bridgeApproach, bridgeBankOffsets, stationRampOffsets } from './road-profile.js';
import { indexLampSurvey, streetLamps } from './lamps.js';
import { breakableId, Breakables } from '../physics/breakables.js';
// Herní svět: dekódování dat, prostorové indexy, kolize, silniční graf.
import { PARAMS, CHUNK, COLL_CELL, DRIVABLE_MAX, RF, RC, LC, BF, BK } from '../config.js';
import {measuredRailDeck, segmentHalfWidth} from './rail-deck.js';
import { Structures } from './structures.js';
import { Tunnel, TUNNEL_HEIGHT } from './tunnels.js';
import { TurnRules } from './turns.js';
import { Traffic } from '../game/traffic.js';
import { prazdrojDeck, identifyPrazdrojBridge } from './prazdroj-bridge.js';
import { indexBridgeEdges } from '../physics/railings.js';
import { surveyedApproaches, approachHeight } from './underpasses.js';
import { prepareRondel } from './rondel.js';
import { buildRoadGrades, corridorWeight, gradeBlend, gradeCross, gradeHeight, gradeShore, gradeSurface, shoreLift, CORRIDOR_FALLOFF, CORRIDOR_MARGIN,
  SHORE_BACK, SHORE_FADE, SHORE_FILL, SHORE_PLATEAU, SHORE_REACH, SHORE_WATER } from './road-grade.js';
import { sidewalkHeight, sidewalkPriority, sidewalkProfile } from './sidewalks.js';
import { armCut, cornerOverlap, cornerPolygon, findCorners, insidePolygon, shrinkPolygon } from './corners.js';

function overlapsPark(bounds,x0,z0,x1,z1) {
  return x0<=bounds.max.x && x1>=bounds.min.x && z0<=bounds.max.z && z1>=bounds.min.z;
}

export const SURF = 0.05;    // o kolik nad terénem leží povrch, po kterém se jezdí (kvůli vrstvě asfaltu)
const ROAD_TERRAIN_STEP = 4;                       // rozteč úprav terénu pod silnicemi (m)
const STRUCTURE_KEEP = 8;                          // okolí konců mostů a tunelů beze změny terénu (m)
const ROAD_TILE_CACHE = 512;                       // kolik dlaždic s úpravou terénu držet v paměti
const CLAMP_PAD = 1.5;                             // terén do této vzdálenosti za okrajem vozovky leží pod ní (m)
const NEAR_PAD = 3;                                // pás kolem vozovky, kde má fyzika jemnou síť terénu (m)
const JUNCTION_CELL = 32;                          // mřížka pro hledání křižovatek (m)
// Zářez svahu u vozovky hlubší než tolik (m): dlaždice má jemnější síť terénu (4 m), aby do pásu nezasahovala.
const STEEP_CUT = 0.3;
const JUNCTION_BLEND = 6;
const CORNER_OVERLAP = 0.3;                        // vykreslený asfalt oblouku zasahuje pod pás vozovky (m)                         // vedlejší silnice se napojí na okraj hlavní během (m)
const junctionKey = (x, z) => (Math.floor(x / JUNCTION_CELL) + 65536) * 131072 + Math.floor(z / JUNCTION_CELL) + 65536;
const cellKey = (x, z) => (Math.floor(x / STRUCTURE_KEEP) + 65536) * 131072 + Math.floor(z / STRUCTURE_KEEP) + 65536;
const SHORE_CELL = 32;                             // mřížka hran břehů pro hledání vody u silnic (m)
const shoreKey = (cx, cz) => (cx + 65536) * 131072 + cz + 65536;
const ROAD_TERRAIN_STRIDE = CHUNK / ROAD_TERRAIN_STEP + 1;
const KEY_OFF = 250000;      // posun, aby byly kvantované souřadnice (decimetry) kladné – stačí na ±25 km
const KEY_MUL = 524288;

function triangleHeight(h, i, stride, x, z) {
  const east = h[i + 1], south = h[i + stride];
  if (x + z <= 1) {
    const corner = h[i];
    return corner + (east - corner) * x + (south - corner) * z;
  }
  const corner = h[i + stride + 1];
  return corner + (south - corner) * (1 - x) + (east - corner) * (1 - z);
}

export class World {
  constructor(data) {
    this.meta = data.meta;
    const b = data.meta.bounds;
    // okraje zarovnané na celé dlaždice
    this.minX = Math.floor(b.minX / CHUNK) * CHUNK; this.maxX = Math.ceil(b.maxX / CHUNK) * CHUNK;
    this.minZ = Math.floor(b.minZ / CHUNK) * CHUNK; this.maxZ = Math.ceil(b.maxZ / CHUNK) * CHUNK;
    this.playMinX = b.minX; this.playMaxX = b.maxX; this.playMinZ = b.minZ; this.playMaxZ = b.maxZ;
    this.cols = Math.ceil((this.maxX - this.minX) / CHUNK);
    this.rows = Math.ceil((this.maxZ - this.minZ) / CHUNK);
    this.lampSurvey = indexLampSurvey(this, data.lampSurvey?.lamps ?? []);
    this.streetDetails = data.streetDetails;
    this.streetFixtures = new Map();
    this.streetPaving = new Map();
    this.structures = data.structures ? new Structures(data.structures, this.cols, this.rows) : null;
    this.gcols = Math.ceil((this.maxX - this.minX) / COLL_CELL) + 1;
    this.grows = Math.ceil((this.maxZ - this.minZ) / COLL_CELL) + 1;
    this.roadNames = data.meta.roadNames;
    this.obstacles = new Map();   // kruhové překážky (stromy, sloupy) podle buněk 16 m
    const grades = data.gradeSeparations?.version === 1 && data.gradeSeparations.grid === 2
      ? data.gradeSeparations : null;
    this._initTerrain(data.terrain);
    this._initTerrainDetail(data.landscape);
    this._initGradeTerrain(grades);
    this.originalGradeTiles = new Set(this.gradeTerrain.keys());
    this.underpassTiles = new Set();
    if (grades) for (const [i, j, cm] of data.underpasses?.terrain ?? []) {
      this._setGradeOffset(i * grades.grid, j * grades.grid, cm, true, this.underpassTiles);
    }
    for (const [x, z, delta] of stationForecourtOffsets(this)) this._setGradeOffset(x, z, delta, true);
    this.buildingMaterials = new Map(data.buildingMaterials?.surfaces.map(([i,wall,roof])=>[i,[wall,roof]]));
    this._initBuildings(data.buildings);
    this._initRoads(data.roads);
    this.gradeRoads = this._applyGradeProfiles(grades?.roads, (road) => {
      if (!(this.r.flags[road] & RF.BRIDGE)) return null;
      const begin = this.rOff[road], end = this.rOff[road + 1], last = end - 1;
      return [[this.rpx[begin], this.rpz[begin], this.rpx[last], this.rpz[last]], this.rpy.subarray(begin, end)];
    });
    this.deckCalibrations = new Map();
    for (const model of data.structures?.index.bridges ?? []) {
      const road = model.road;
      if (!(this.r.flags[road] & RF.BRIDGE) || this.gradeRoads.has(road)) continue;
      const start = this.rOff[road], end = this.rOff[road + 1];
      if (end - start !== 2) continue;
      this.deckCalibrations.set(road, model);
      for (let k = start; k < end; k++) this.rpy[k] += model.lift;
    }
    this.rondel = prepareRondel(this);
    this.elevatedWidths = new Map(this.rondel.elevated);
    const platforms = this._applyGradeProfiles(grades && data.underpasses?.decks, road => {
      if (road >= this.rCount) return null;
      const a = this.rOff[road], b = this.rOff[road + 1] - 1;
      return [[this.rpx[a], this.rpz[a], this.rpx[b], this.rpz[b]], this.rpy.subarray(a, b + 1)];
    });
    for (const road of platforms) this.elevatedWidths.set(road, this.r.w[road] / 2 + 0.12);
    this.archedBridges = new Map(data.roads.header.archedBridges ?? []);
    this.tunnelRoads = new Set(data.roads.header.tunnels ?? []);
    this.tunnels = [...this.tunnelRoads].map((road) => new Tunnel(this, road));
    this.tunnelApproaches = new Map();
    if (this.tunnels.length) {
      const portals = new Map(this.tunnels.flatMap((t) => t.portals.map((p) => [`${p.x},${p.z}`, p])));
      for (let i = 0; i < this.rCount; i++) {
        if (this.tunnelRoads.has(i) || this.r.cls[i] !== RC.MOTORWAY) continue;
        const a = this.rOff[i], b = this.rOff[i + 1] - 1;
        const start = portals.get(`${this.rpx[a]},${this.rpz[a]}`);
        const end = portals.get(`${this.rpx[b]},${this.rpz[b]}`);
        if (start || end) this.tunnelApproaches.set(i, { start, end });
      }
    }
    for (const [x, z, delta] of stationRampOffsets(this)) this._setGradeOffset(x, z, delta, true);
    this._initGraph();
    this.busContraflow = new Set(data.meta.traffic?.busContraflow);
    this.turns = new TurnRules(this, data.meta.traffic?.restrictions);
    this.breakables = new Breakables();
    this.traffic = new Traffic(this, data.meta.traffic);
    this.gardenWaterLand = PARAMS.get('sady') === 'puvodni' ? null : new Set();
    this.fountainLand = PARAMS.get('kasny') === 'puvodni' ? null : new Set();
    this._initLand(data.land);
    this._initRails(data.rails);
    this.gradeRails = this._applyGradeProfiles(grades?.rails, (index) => {
      const rail = this.rails[index];
      if (!rail?.y) return null;
      const p = rail.pts;
      return [[p[0], p[1], p[p.length - 2], p[p.length - 1]], rail.y];
    });
    this.gradeRailAbutments = new Set((grades?.railAbutments ?? []).filter((i) => this.gradeRails.has(i)));
    for (const model of data.structures?.index.railDecks ?? []) {
      const rail = this.rails[model.rail];
      if (rail?.y && !this.gradeRails.has(model.rail)) rail.deck = measuredRailDeck(rail,model.sections);
    }
    // Pravý pruh mostu 2706 přechází na šikmý břeh silnice 33139.
    if (this.gradeStep && (this.r.flags[2706] & RF.BRIDGE)) {
      const offsets = bridgeBankOffsets(this, 2706, 33139);
      if (offsets.length) this.bankTerrainTile = this.chunkIndex(offsets[0][0], offsets[0][1]);
      for (const [x, z, delta] of offsets) this._setGradeOffset(x, z, delta, true);
    }
    // V tomto výřezu končí nájezd 2725 u měřeného horního pásu 64.
    this.roadApproach = bridgeApproach(this, 64, 2725);
    this.upperApproaches = surveyedApproaches(this, grades && data.underpasses?.approaches);
    this._initBridges();
    this.bridgeEdges = indexBridgeEdges(this);
    this._initRoadGrades();
    this._initCorners();
    this.forecourtWalls = stationRetainingWalls(this);
    this.fountainTiles = this.fountainLand ? createFountainSites(this) : new Map();
    this.bory = PARAMS.get('bory') === 'puvodni' ? null : createBorySite(this);
    this.pavilion = PARAMS.get('pavilonek') === 'puvodni' ? null : createPavilionSite(this);
    for (const rail of this.pavilion?.rails ?? []) {
      if (!this.streetFixtures.has(rail.tile)) this.streetFixtures.set(rail.tile, []);
      this.streetFixtures.get(rail.tile).push(rail);
    }
    this.plagueColumn = createColumnSite(this);
    if (this.plagueColumn) this.streetFixtures.set(this.plagueColumn.tile, this.plagueColumn.fixtures.slice());
    this.sady = PARAMS.get('sady') === 'puvodni' ? null : createSady(this);
    for (const tile of this.sady?.tiles.values() ?? []) {
      for (const bench of [...tile.benches,...tile.rails]) {
        if (!this.streetFixtures.has(bench.tile)) this.streetFixtures.set(bench.tile, []);
        this.streetFixtures.get(bench.tile).push(bench);
      }
    }
    this.treeTypes = new Map(data.treeTypes?.trees);
    this.forestTypes = new Map(data.treeTypes?.land);
    this.trees = data.trees;
    this._initTrees(data.trees);
    this.roadClosures = data.meta.roadClosures ?? [];
    this.closureChunks = new Map();
    for (const closure of this.roadClosures) {
      const [x, z, dx, dz, width] = closure;
      const ci = this.chunkIndex(x, z);
      if (!this.closureChunks.has(ci)) this.closureChunks.set(ci, []);
      const entries = this.closureChunks.get(ci);
      const obstacles = [];
      const sections = Math.ceil(width / 1.15);
      for (let i = 0; i < sections; i++) {
        const side = width * ((i + 0.5) / sections - 0.5);
        obstacles.push(x - dz * side, z + dx * side, 0.66);
      }
      entries.push({ id: breakableId('closure', ci, entries.length), tile: ci, closure, obstacles,
        x, y: this.heightAt(x, z) + 0.44, z });
      this.addObstacles(obstacles);
      // Dva herní vymezovací sloupky po stranách dočasné uzavírky.
      for (const side of [-1, 1]) {
        const distance = side * (width / 2 + 1);
        const px = x - dz * distance, pz = z + dx * distance;
        this.traffic.addVisual(px, pz, 'posts', { x: px, z: pz, tx: dx, tz: dz });
      }
    }
  }

  /** WGS 84 ve stupních na herní metry. */
  gpsToWorld(lat, lon) {
    const origin = this.meta.origin;
    return { x: (lon - origin.lon) * origin.kx, z: (origin.lat - lat) * origin.ky };
  }

  /** Herní metry na WGS 84 ve stupních. */
  worldToGps(x, z) {
    const origin = this.meta.origin;
    return { lat: origin.lat - z / origin.ky, lon: origin.lon + x / origin.kx };
  }

  lampsInTile(ci) { return streetLamps(this, ci); }

  chunkIndex(x, z) {
    const cx = Math.floor((x - this.minX) / CHUNK);
    const cz = Math.floor((z - this.minZ) / CHUNK);
    if (cx < 0 || cz < 0 || cx >= this.cols || cz >= this.rows) return -1;
    return cz * this.cols + cx;
  }

  cellIndex(x, z) {
    let cx = Math.floor((x - this.minX) / COLL_CELL);
    let cz = Math.floor((z - this.minZ) / COLL_CELL);
    if (cx < 0) cx = 0; else if (cx >= this.gcols) cx = this.gcols - 1;
    if (cz < 0) cz = 0; else if (cz >= this.grows) cz = this.grows - 1;
    return cz * this.gcols + cx;
  }

  inBounds(x, z, margin = 0) {
    return x > this.minX + margin && x < this.maxX - margin && z > this.minZ + margin && z < this.maxZ - margin;
  }

  // ------------------------------------------------------------- terén ----
  _initTerrain(T) {
    const { g, cols, rows, x0, z0, q } = T.header;
    const h = new Float32Array(cols * rows);
    const d = T.d, rs = T.rowStart;
    for (let j = 0; j < rows; j++) {
      let v = rs[j];
      const o = j * cols, od = j * (cols - 1);
      h[o] = v * q;
      for (let i = 1; i < cols; i++) { v += d[od + i - 1]; h[o + i] = v * q; }
    }
    this.th = h; this.tG = g; this.tCols = cols; this.tRows = rows; this.tX0 = x0; this.tZ0 = z0;
    this.baseElevation = T.header.base;
  }

  _initTerrainDetail(data) {
    this.terrainDetail = new Map();
    if (!data) return;
    const { g, q, x0, z0, cols } = data.header;
    if (g !== this.tG / 2 || !Number.isFinite(q) || q <= 0 || cols !== this.cols || x0 !== this.minX || z0 !== this.minZ) return;
    const width = CHUNK / g + 1, size = width ** 2;
    if (!data.tiles || data.offsets?.length !== data.tiles.length * size) return;
    this.tDetailG = g; this.tDetailQ = q; this.tDetailWidth = width;
    for (let i = 0; i < data.tiles.length; i++) {
      const tile = data.tiles[i];
      if (tile < this.cols * this.rows) this.terrainDetail.set(tile, data.offsets.subarray(i * size, (i + 1) * size));
    }
  }

  _initGradeTerrain(data) {
    this.gradeTerrain = new Map();
    this.trackUnderpasses = new Map();
    if (!data) return;
    this.gradeStep = data.grid;
    this.gradeStride = CHUNK / data.grid + 1;
    this.gradeSupportClearance = data.clear ?? [];
    for (const values of data.trackUnderpasses ?? []) {
      const section = values.map((value) => value * 0.1);
      const [x, z, endX, endZ] = section;
      const tile = this.chunkIndex((x + endX) * 0.5, (z + endZ) * 0.5);
      if (tile < 0) continue;
      if (!this.trackUnderpasses.has(tile)) this.trackUnderpasses.set(tile, []);
      this.trackUnderpasses.get(tile).push(section);
    }
    for (const [i, j, delta] of data.terrain ?? []) {
      this._setGradeOffset(i * data.grid, j * data.grid, delta);
    }
  }

  _setGradeOffset(x, z, delta, relative = false, touched) {
    const ix = (x - this.minX) / CHUNK, iz = (z - this.minZ) / CHUNK;
    // Stejný upravený vrchol patří oběma sousedům na hraně dlaždice.
    for (const cx of Number.isInteger(ix) ? [ix - 1, ix] : [Math.floor(ix)]) {
      for (const cz of Number.isInteger(iz) ? [iz - 1, iz] : [Math.floor(iz)]) {
        if (cx < 0 || cx >= this.cols || cz < 0 || cz >= this.rows) continue;
        const tile = cz * this.cols + cx;
        touched?.add(tile);
        if (!this.gradeTerrain.has(tile)) this.gradeTerrain.set(tile, new Int16Array(this.gradeStride ** 2));
        const u = (ix - cx) * (this.gradeStride - 1), v = (iz - cz) * (this.gradeStride - 1);
        const heights = this.gradeTerrain.get(tile), index = v * this.gradeStride + u;
        heights[index] = relative ? heights[index] + delta : delta;
      }
    }
  }

  _applyGradeProfiles(entries, getProfile) {
    const updated = new Set();
    for (const [index, endpoints, heights] of entries ?? []) {
      const profile = getProfile(index);
      if (!profile) continue;
      const [ends, samples] = profile;
      if (samples.length !== heights.length || !ends.every((x, i) => Math.round(x * 10) === endpoints[i])) continue;
      for (let k = 0; k < samples.length; k++) samples[k] = heights[k] * 0.01 - this.baseElevation;
      updated.add(index);
    }
    return updated;
  }

  bridgeSupportAllowed(x, z, ground, underside, halfWidth) {
    // Celá patka musí ležet mimo spodní cestu, i když je pod horním mostem další nájezd.
    if (this.onCarriageway(x, z, ground, Math.SQRT2 * halfWidth, RC.TRACK, underside)) return false;
    return !(this.gradeSupportClearance ?? []).some(([cx, cz, radius]) =>
      (x * 10 - cx) ** 2 + (z * 10 - cz) ** 2 < radius ** 2);
  }

  baseHeightAt(x, z) {
    let gx = (x - this.tX0) / this.tG, gz = (z - this.tZ0) / this.tG;
    const mc = this.tCols - 1.001, mr = this.tRows - 1.001;
    if (gx < 0) gx = 0; else if (gx > mc) gx = mc;
    if (gz < 0) gz = 0; else if (gz > mr) gz = mr;
    const i = gx | 0, j = gz | 0;
    const fx = gx - i, fz = gz - j;
    // čtverec je rozdělen úhlopříčkou mezi body 10 a 01 (stejně jako síť terénu)
    return triangleHeight(this.th, j * this.tCols + i, this.tCols, fx, fz);
  }

  /** Výška v metrech nad počátkem hry, shodná s viditelnými trojúhelníky. */
  heightAt(x, z) {
    const y = this.terrainHeightAt(x, z);
    if (!this.roadTerrain) return y;
    const tileX = Math.floor((x - this.minX) / CHUNK), tileZ = Math.floor((z - this.minZ) / CHUNK);
    if (tileX < 0 || tileX >= this.cols || tileZ < 0 || tileZ >= this.rows) return y;
    const grid = this.roadTerrainTile(tileZ * this.cols + tileX);
    if (!grid) return y;
    const dx = (x - this.minX - tileX * CHUNK) / ROAD_TERRAIN_STEP, dz = (z - this.minZ - tileZ * CHUNK) / ROAD_TERRAIN_STEP;
    const i = Math.min(ROAD_TERRAIN_STRIDE - 2, dx | 0), j = Math.min(ROAD_TERRAIN_STRIDE - 2, dz | 0);
    return y + 0.01 * triangleHeight(grid, j * ROAD_TERRAIN_STRIDE + i, ROAD_TERRAIN_STRIDE, dx - i, dz - j);
  }

  /** Terén bez úpravy pod silnicemi (z něj vzniká hladký profil silnic). */
  terrainHeightAt(x, z) {
    let y = this.baseHeightAt(x, z);
    if (!this.terrainDetail?.size && !this.gradeTerrain?.size) return y;
    const tileX = Math.floor((x - this.minX) / CHUNK), tileZ = Math.floor((z - this.minZ) / CHUNK);
    if (tileX < 0 || tileX >= this.cols || tileZ < 0 || tileZ >= this.rows) return y;
    const tile = tileZ * this.cols + tileX;
    const lx = x - this.minX - tileX * CHUNK, lz = z - this.minZ - tileZ * CHUNK;
    const detail = this.terrainDetail?.get(tile);
    if (detail) {
      const dx = lx / this.tDetailG, dz = lz / this.tDetailG;
      const i = dx | 0, j = dz | 0;
      y += this.tDetailQ * triangleHeight(detail, j * this.tDetailWidth + i, this.tDetailWidth, dx - i, dz - j);
    }
    const grade = this.gradeTerrain?.get(tile);
    if (grade) {
      const dx = lx / this.gradeStep, dz = lz / this.gradeStep;
      const i = dx | 0, j = dz | 0;
      y += 0.01 * triangleHeight(grade, j * this.gradeStride + i, this.gradeStride, dx - i, dz - j);
    }
    return y;
  }

  // -------------------------------------------------------------- mosty ----
  _initBridges() {
    const seg = [];     // x1, z1, y1, x2, z2, y2, poloviční šířka, druh (0 silnice, 1 tramvaj, 2 železnice)
    const R = this.r, px = this.rpx, pz = this.rpz, py = this.rpy;
    for (let i = 0; i < this.rCount; i++) {
      if (!(R.flags[i] & RF.BRIDGE) && !this.elevatedWidths?.has(i)) continue;
      if (R.flags[i] & RF.SHARED_DECK) continue;
      const cls = R.cls[i];
      const hw = this.deckHalfWidth(i);
      const model = this.deckCalibrations.get(i);
      const dx = model?.shiftX ?? 0, dz = model?.shiftZ ?? 0;
      for (let k = this.rOff[i], ke = this.rOff[i + 1] - 1; k < ke; k++) {
        seg.push(px[k]+dx, pz[k]+dz, py[k], px[k+1]+dx, pz[k+1]+dz, py[k+1], hw, cls <= DRIVABLE_MAX ? 0 : 3);
      }
    }
    if (this.roadApproach) {
      const { path, halfWidth } = this.roadApproach;
      seg.push(path.x[0], path.z[0], path.y[0], path.x.at(-1), path.z.at(-1), path.y.at(-1), halfWidth, 0);
    }
    for (const [road, entry] of this.upperApproaches ?? []) {
      for (const { path } of entry.spans) for (let k = 0; k < path.n - 1; k++) {
        seg.push(path.x[k], path.z[k], path.y[k], path.x[k+1], path.z[k+1], path.y[k+1], R.w[road] / 2, 0);
      }
    }
    this.bridgeEndWidths = new Map();
    for (const rail of this.rails) {
      if (!rail.y) continue;
      if (rail.deck) {
        const d = rail.deck;
        for (let k=0; k<d.n-1; k++) {
          this.bridgeEndWidths.set(seg.length,d.widths[k+1]);
          seg.push(d.x[k],d.z[k],d.y[k],d.x[k+1],d.z[k+1],d.y[k+1],d.widths[k],rail.cls===0 ? 1 : 2);
        }
        continue;
      }
      const hw = rail.cls === 1 ? 2.4 : 1.7;
      for (let k = 0, n = rail.pts.length / 2 - 1; k < n; k++) {
        seg.push(rail.pts[k * 2], rail.pts[k * 2 + 1], rail.y[k], rail.pts[k * 2 + 2], rail.pts[k * 2 + 3], rail.y[k + 1], hw, rail.cls === 0 ? 1 : 2);
      }
    }
    this.bridgeSeg = Float32Array.from(seg);
    const grid = new Map();
    for (let s = 0; s < seg.length; s += 8) {
      const hw = Math.max(seg[s+6],this.bridgeEndWidths.get(s) ?? 0);
      const cx0 = Math.floor((Math.min(seg[s], seg[s + 3]) - hw) / COLL_CELL), cx1 = Math.floor((Math.max(seg[s], seg[s + 3]) + hw) / COLL_CELL);
      const cz0 = Math.floor((Math.min(seg[s + 1], seg[s + 4]) - hw) / COLL_CELL), cz1 = Math.floor((Math.max(seg[s + 1], seg[s + 4]) + hw) / COLL_CELL);
      for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
        const key = cx * 8192 + cz;
        let a = grid.get(key);
        if (!a) grid.set(key, a = []);
        a.push(s);
      }
    }
    this.bridgeGrid = grid;
  }

  /** Poloviční šířka mostovky silnice (včetně chodníků). */
  deckHalfWidth(road) {
    const calibration = this.deckCalibrations?.get(road);
    if (calibration) return calibration.halfWidth;
    if (road === this.prazdrojRoad) return 1.55;
    const measured = this.elevatedWidths?.get(road);
    if (measured !== undefined) return measured;
    // Wilsonův most má podle městské dokumentace včetně chodníků 15 metrů.
    if (this.roadNames?.[this.r.name?.[road]] === 'Wilsonův most') return 7.5;
    const cls = this.r.cls[road], hw = this.r.w[road] / 2;
    if (cls <= RC.LIVING) return hw + 2.0;
    if (cls <= DRIVABLE_MAX) return hw + 0.5;
    return Math.max(1.3, hw + 0.4);
  }

  /** Nejvyšší mostovka v bodě, která neleží výš než yMax. Vrací -1e9, když tu žádná není. kind = filtr druhu (volitelně). */
  deckAt(x, z, yMax, kind = -1) {
    const list = this.bridgeGrid.get(Math.floor(x / COLL_CELL) * 8192 + Math.floor(z / COLL_CELL));
    if (!list) return -1e9;
    const sg = this.bridgeSeg;
    let best = -1e9;
    for (let q = 0; q < list.length; q++) {
      const s = list[q];
      if (kind >= 0 && sg[s + 7] !== kind) continue;
      const x1 = sg[s], z1 = sg[s + 1], dx = sg[s + 3] - x1, dz = sg[s + 4] - z1;
      const l2 = dx * dx + dz * dz;
      let t = l2 > 0 ? ((x - x1) * dx + (z - z1) * dz) / l2 : 0;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      const qx = x1 + dx * t - x, qz = z1 + dz * t - z, hw = segmentHalfWidth(this,s,t);
      if (qx * qx + qz * qz > hw * hw) continue;
      const y = sg[s + 2] + (sg[s + 5] - sg[s + 2]) * t;
      if (y <= yMax && y > best) best = y;
    }
    return best;
  }

  /**
   * Výška povrchu, po kterém se chodí a jezdí: terén, nebo mostovka, na kterou lze z výšky yHint vstoupit.
   * Kdo stojí pod mostem, zůstane na terénu; kdo na most najede, drží se mostovky.
   */
  groundY(x, z, yHint = 1e9) {
    const tunnel = this.tunnelAt(x, z, yHint, 0, true);
    if (tunnel) return tunnel.floor;
    const t = this.heightAt(x, z) + SURF;
    const d = this.deckAt(x, z, yHint + 0.9);
    return d > t ? d : t;
  }

  /** Povrch včetně střech (pro pěšího hráče a vrtulník). */
  surfaceAt(x, z, yMax = 1e9) {
    const g = this.groundY(x, z, yMax);
    const r = this.roofAt(x, z, yMax);
    return r > g ? r : g;
  }

  /** Najde správnou výškovou úroveň; nad tunelem platí povrch kopce. */
  tunnelAt(x, z, y, margin = 0, openApproach = false) {
    const res = this._tunnelPosition ??= {};
    for (const tunnel of this.tunnels ?? []) {
      if (!tunnel.position(x, z, tunnel.halfWidth + margin, res)) continue;
      if (!res.inside && (openApproach || y === Infinity)) return res;
      if (y >= res.floor + TUNNEL_HEIGHT || y < res.floor - 2) continue;
      return res;
    }
    return null;
  }

  // ------------------------------------------------------------ budovy ----
  _initBuildings(B) {
    const n = B.header.count;
    this.b = B;
    this.bCount = n;
    const nv = B.vdx.length;
    const vx = new Float32Array(nv), vz = new Float32Array(nv);
    const minX = new Float32Array(n), maxX = new Float32Array(n), minZ = new Float32Array(n), maxZ = new Float32Array(n);
    const hTop = new Float32Array(n), hWall = new Float32Array(n), hMin = new Float32Array(n);
    const bGround = new Float32Array(n), bFoot = new Float32Array(n);
    const chunkLists = new Array(this.cols * this.rows);
    const cellCount = new Uint32Array(this.gcols * this.grows + 1);
    for (let i = 0; i < n; i++) {
      const r0 = B.bRing[i], r1 = B.bRing[i + 1];
      const v0 = B.ringStart[r0], v1 = B.ringStart[r1];
      const axm = B.ax[i], azm = B.az[i];
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, gs = 0, gmin = 1e9;
      for (let v = v0; v < v1; v++) {
        const x = (axm + B.vdx[v]) * 0.1, z = (azm + B.vdz[v]) * 0.1;
        vx[v] = x; vz[v] = z;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
        const g = this.heightAt(x, z);
        gs += g; if (g < gmin) gmin = g;
      }
      minX[i] = x0; maxX[i] = x1; minZ[i] = z0; maxZ[i] = z1;
      // dům stojí na průměrné výšce terénu pod půdorysem; zdi sahají až k nejnižšímu bodu
      const ground = gs / (v1 - v0);
      bGround[i] = ground; bFoot[i] = gmin - 0.4;
      hTop[i] = ground + B.hTop[i] * 0.1; hWall[i] = ground + B.hWall[i] * 0.1;
      hMin[i] = B.hMin[i] > 0 ? ground + B.hMin[i] * 0.1 : gmin - 0.4;
      // Samostatná střecha má tenký okraj i ve fyzice. Pod ní zůstává volný prostor.
      if (B.kind[i] === BK.ROOF) hMin[i] = Math.max(hMin[i], hTop[i] - 0.35);
      const ci = this.chunkIndex((x0 + x1) / 2, (z0 + z1) / 2);
      if (ci >= 0) (chunkLists[ci] || (chunkLists[ci] = [])).push(i);
      if (B.flags[i] & (BF.NO_COLLIDE | BF.PART)) continue;
      const cx0 = Math.max(0, Math.floor((x0 - this.minX) / COLL_CELL)), cx1 = Math.min(this.gcols - 1, Math.floor((x1 - this.minX) / COLL_CELL));
      const cz0 = Math.max(0, Math.floor((z0 - this.minZ) / COLL_CELL)), cz1 = Math.min(this.grows - 1, Math.floor((z1 - this.minZ) / COLL_CELL));
      for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) cellCount[cz * this.gcols + cx + 1]++;
    }
    for (let i = 1; i < cellCount.length; i++) cellCount[i] += cellCount[i - 1];
    const cellItems = new Uint32Array(cellCount[cellCount.length - 1]);
    const fill = new Uint32Array(this.gcols * this.grows);
    for (let i = 0; i < n; i++) {
      if (B.flags[i] & (BF.NO_COLLIDE | BF.PART)) continue;
      const cx0 = Math.max(0, Math.floor((minX[i] - this.minX) / COLL_CELL)), cx1 = Math.min(this.gcols - 1, Math.floor((maxX[i] - this.minX) / COLL_CELL));
      const cz0 = Math.max(0, Math.floor((minZ[i] - this.minZ) / COLL_CELL)), cz1 = Math.min(this.grows - 1, Math.floor((maxZ[i] - this.minZ) / COLL_CELL));
      for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
        const c = cz * this.gcols + cx;
        cellItems[cellCount[c] + fill[c]++] = i;
      }
    }
    this.bvx = vx; this.bvz = vz;
    this.bMinX = minX; this.bMaxX = maxX; this.bMinZ = minZ; this.bMaxZ = maxZ;
    // výšky jsou absolutní (ve stejné soustavě jako terén)
    this.bTop = hTop; this.bWall = hWall; this.bBase = hMin; this.bGround = bGround; this.bFoot = bFoot;
    this.bChunks = chunkLists;
    this.bCellStart = cellCount; this.bCellItems = cellItems;
    this.bNames = new Map(B.header.names);
  }

  /** Vysune kruh (x, z, r) ve výšce y ven ze zdí budov. Vrací true při kolizi; výsledek v this.hit. */
  collideCircle(x, z, r, y, yTop, fixedMapOnly = false) {
    const hit = this.hit || (this.hit = { x: 0, z: 0, nx: 0, nz: 0, depth: 0, building: -1 });
    hit.x = x; hit.z = z; hit.nx = 0; hit.nz = 0; hit.depth = 0; hit.building = -1;
    let any = false;
    const tube = this.tunnelAt(x, z, y, r + 0.4);
    if (tube && tube.distance > tube.tunnel.halfWidth - r && tube.distance > 0
        && (tube.inside || this.heightAt(x, z) > y + 0.25)) {
      hit.nx = (tube.x - x) / tube.distance;
      hit.nz = (tube.z - z) / tube.distance;
      hit.depth = tube.distance - tube.tunnel.halfWidth + r;
      hit.x += hit.nx * hit.depth; hit.z += hit.nz * hit.depth;
      any = true;
    }
    const fountains = this.fountainTiles?.get(this.chunkIndex(hit.x,hit.z));
    if (fountains && fountainContact(fountains,hit,r,y,yTop)) any=true;
    if (this.sady && overlapsPark(this.sady.bounds,hit.x-r,hit.z-r,hit.x+r,hit.z+r)) {
      for (const group of this.sady.groups) {
        if (overlapsPark(group.bounds,hit.x-r,hit.z-r,hit.x+r,hit.z+r) &&
            fountainContact(group.sites,hit,r,y,yTop)) any=true;
      }
    }
    if (this.pavilion && nearPavilion(hit.x,hit.z,r) && pavilionContact(this.pavilion,hit,r,y,yTop)) any=true;
    const B = this.b, vx = this.bvx, vz = this.bvz;
    const cx0 = Math.max(0, Math.floor((x - r - this.minX) / COLL_CELL)), cx1 = Math.min(this.gcols - 1, Math.floor((x + r - this.minX) / COLL_CELL));
    const cz0 = Math.max(0, Math.floor((z - r - this.minZ) / COLL_CELL)), cz1 = Math.min(this.grows - 1, Math.floor((z + r - this.minZ) / COLL_CELL));
    for (let pass = 0; pass < 2; pass++) {
      let moved = false;
      for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
        const c = cz * this.gcols + cx;
        for (let k = this.bCellStart[c], ke = this.bCellStart[c + 1]; k < ke; k++) {
          const i = this.bCellItems[k];
          if (i === this.heritage?.breweryGate?.building) {
            if (fountainContact(this.heritage.breweryGate.surfaces,hit,r,y,yTop)) { any=true; moved=true; }
            continue;
          }
          if (i === this.pavilion?.building) continue;
          if (i === this.plagueColumn?.building) {
            if (columnContact(this.plagueColumn, hit, r, y, yTop)) { any = true; moved = true; }
            continue;
          }
          x = hit.x; z = hit.z;
          if (x + r < this.bMinX[i] || x - r > this.bMaxX[i] || z + r < this.bMinZ[i] || z - r > this.bMaxZ[i]) continue;
          const importedRoof = !fixedMapOnly && this.heritage?.replaced.has(i) && y > this.bGround[i] + 2.5
            ? this.heritage.roofHeight(x, z) : -Infinity;
          const top = Number.isFinite(importedRoof) ? importedRoof : this.bTop[i];
          if (y >= top - 0.25 || yTop <= this.bBase[i]) continue;
          // nejbližší bod na obvodu + test, zda je střed uvnitř
          let best = 1e9, bx = 0, bz = 0, inside = false;
          const r0 = B.bRing[i], r1 = B.bRing[i + 1];
          for (let rg = r0; rg < r1; rg++) {
            const v0 = B.ringStart[rg], v1 = B.ringStart[rg + 1];
            let j = v1 - 1;
            for (let v = v0; v < v1; j = v++) {
              const x1 = vx[j], z1 = vz[j], x2 = vx[v], z2 = vz[v];
              if ((z1 > z) !== (z2 > z) && x < (x2 - x1) * (z - z1) / (z2 - z1) + x1) inside = !inside;
              const dx = x2 - x1, dz = z2 - z1;
              const l2 = dx * dx + dz * dz;
              let t = l2 > 0 ? ((x - x1) * dx + (z - z1) * dz) / l2 : 0;
              if (t < 0) t = 0; else if (t > 1) t = 1;
              const qx = x1 + dx * t, qz = z1 + dz * t;
              const d = (x - qx) * (x - qx) + (z - qz) * (z - qz);
              if (d < best) { best = d; bx = qx; bz = qz; }
            }
          }
          const d = Math.sqrt(best);
          if (!inside && d >= r) continue;
          let nx, nz, push;
          if (inside) {
            if (d > 1e-5) { nx = (bx - x) / d; nz = (bz - z) / d; } else { nx = 1; nz = 0; }
            push = d + r;
          } else {
            if (d > 1e-5) { nx = (x - bx) / d; nz = (z - bz) / d; } else { nx = 1; nz = 0; }
            push = r - d;
          }
          hit.x = x + nx * push; hit.z = z + nz * push;
          hit.nx = nx; hit.nz = nz; hit.depth = Math.max(hit.depth, push); hit.building = i;
          any = true; moved = true;
        }
      }
      if (!moved) break;
    }
    return fixedMapOnly ? any : this.collideStreetObjects(hit, r, y) || any;
  }

  collideStreetObjects(hit, r, y) {
    let any = false;
    const ox0 = Math.floor((hit.x - r - 1) / 16), ox1 = Math.floor((hit.x + r + 1) / 16);
    const oz0 = Math.floor((hit.z - r - 1) / 16), oz1 = Math.floor((hit.z + r + 1) / 16);
    {
      const yLim = y - 2.5;       // překážky (kmeny, sloupy) sahají 2,5 m nad zem
      for (let oz = oz0; oz <= oz1; oz++) for (let ox = ox0; ox <= ox1; ox++) {
        const list = this.obstacles.get(ox * 4096 + oz);
        if (!list) continue;
        for (let k = 0; k < list.length; k += 3) {
          const dx = hit.x - list[k], dz = hit.z - list[k + 1], rr = r + list[k + 2];
          const d2 = dx * dx + dz * dz;
          if (d2 < rr * rr && d2 > 1e-8 && this.heightAt(list[k], list[k + 1]) > yLim) {
            const d = Math.sqrt(d2);
            hit.nx = dx / d; hit.nz = dz / d;
            hit.x += hit.nx * (rr - d); hit.z += hit.nz * (rr - d);
            hit.depth = Math.max(hit.depth, rr - d);
            any = true;
          }
        }
      }
    }
    return any;
  }

  /** Je kruh u země zablokovaný zdí nebo překážkou? (výšky lo–hi nad terénem) */
  blocked(x, z, r, lo = 0.2, hi = 1.7) {
    const g = this.heightAt(x, z);
    return this.collideCircle(x, z, r, g + lo, g + hi);
  }

  addObstacles(list) {
    for (let k = 0; k < list.length; k += 3) {
      const key = Math.floor(list[k] / 16) * 4096 + Math.floor(list[k + 1] / 16);
      let arr = this.obstacles.get(key);
      if (!arr) this.obstacles.set(key, arr = []);
      arr.push(list[k], list[k + 1], list[k + 2]);
    }
  }

  removeObstacles(list) {
    for (let k = 0; k < list.length; k += 3) {
      const key = Math.floor(list[k] / 16) * 4096 + Math.floor(list[k + 1] / 16);
      const arr = this.obstacles.get(key);
      if (!arr) continue;
      // Buňku mohou sdílet sousední dlaždice. Odeber jen jednu odpovídající
      // položku; i dvě totožné překážky mohou mít různé vlastníky.
      for (let i = 0; i < arr.length; i += 3) {
        if (arr[i] === list[k] && arr[i + 1] === list[k + 1] && arr[i + 2] === list[k + 2]) {
          arr.splice(i, 3);
          break;
        }
      }
      if (!arr.length) this.obstacles.delete(key);
    }
  }

  _pointInBuilding(i, x, z) {
    const B = this.b, vx = this.bvx, vz = this.bvz;
    let inside = false;
    for (let rg = B.bRing[i], r1 = B.bRing[i + 1]; rg < r1; rg++) {
      const v0 = B.ringStart[rg], v1 = B.ringStart[rg + 1];
      let j = v1 - 1;
      for (let v = v0; v < v1; j = v++) {
        const z1 = vz[j], z2 = vz[v];
        if ((z1 > z) !== (z2 > z) && x < (vx[v] - vx[j]) * (z - z1) / (z2 - z1) + vx[j]) inside = !inside;
      }
    }
    return inside;
  }

  /** Výška střechy v bodě (-1e9 = žádná). Bere jen střechy do výšky maxY (aby šlo stát pod převisem). */
  roofAt(x, z, maxY = 1e9) {
    const c = this.cellIndex(x, z);
    const imported = this.heritage?.roofHeight(x, z) ?? -Infinity;
    let h = Number.isFinite(imported) && imported <= maxY ? imported : -1e9;
    const fountains = this.fountainTiles?.get(this.chunkIndex(x,z));
    if (fountains) h=Math.max(h,fountainSurface(fountains,x,z,maxY));
    if (this.sady && overlapsPark(this.sady.bounds,x,z,x,z)) {
      for (const group of this.sady.groups) {
        if (overlapsPark(group.bounds,x,z,x,z)) h=Math.max(h,fountainSurface(group.sites,x,z,maxY));
      }
    }
    if (this.bory && Math.abs(x-this.bory.cx)<190 && Math.abs(z-this.bory.cz)<190) {
      const roof=this.bory.roofs.heightAt(x,z);
      if(roof<=maxY) h=Math.max(h,roof);
    }
    if (this.pavilion && nearPavilion(x,z)) h=Math.max(h,pavilionSurface(this.pavilion,x,z,maxY));
    for (let k = this.bCellStart[c], ke = this.bCellStart[c + 1]; k < ke; k++) {
      const i = this.bCellItems[k];
      if (i === this.heritage?.breweryGate?.building) {
        h=Math.max(h,fountainSurface(this.heritage.breweryGate.surfaces,x,z,maxY));
        continue;
      }
      if (i === this.pavilion?.building || i === this.bory?.drum) continue;
      if (x < this.bMinX[i] || x > this.bMaxX[i] || z < this.bMinZ[i] || z > this.bMaxZ[i]) continue;
      if (i === this.plagueColumn?.building) {
        h = Math.max(h, columnSurface(this.plagueColumn, x, z, maxY));
        continue;
      }
      if (Number.isFinite(imported) && this.heritage.replaced.has(i)) continue;
      const top = this.bTop[i];
      if (top <= h || top > maxY) continue;
      if (this._pointInBuilding(i, x, z)) h = top;
    }
    return h;
  }

  buildingAt(x, z) {
    const c = this.cellIndex(x, z);
    for (let k = this.bCellStart[c], ke = this.bCellStart[c + 1]; k < ke; k++) {
      const i = this.bCellItems[k];
      if (x < this.bMinX[i] || x > this.bMaxX[i] || z < this.bMinZ[i] || z > this.bMaxZ[i]) continue;
      if (this._pointInBuilding(i, x, z)) return i;
    }
    return -1;
  }

  /** Paprsek v rovině xz proti zdem vyšším než y. Vrací t ∈ (0, 1] prvního zásahu, nebo 1. */
  raycast(x0, z0, x1, z1, y) {
    const B = this.b, vx = this.bvx, vz = this.bvz;
    const len = Math.hypot(x1 - x0, z1 - z0);
    let tBest = this.pavilion && nearPavilion(x0,z0,len) ? pavilionRay(this.pavilion,x0,z0,x1,z1,y) : 1;
    if (this.sady) {
      const xmin=Math.min(x0,x1), xmax=Math.max(x0,x1), zmin=Math.min(z0,z1), zmax=Math.max(z0,z1);
      if (overlapsPark(this.sady.bounds,xmin,zmin,xmax,zmax)) {
        for (const group of this.sady.groups) {
          if(overlapsPark(group.bounds,xmin,zmin,xmax,zmax)) tBest=Math.min(tBest,fountainRay(group.sites,x0,z0,x1,z1,y));
        }
      }
    }
    if (this.fountainTiles && Math.min(x0,x1)<55 && Math.max(x0,x1)>-59 && Math.min(z0,z1)<103 && Math.max(z0,z1)>-30) {
      for (const sites of this.fountainTiles.values()) tBest=Math.min(tBest,fountainRay(sites,x0,z0,x1,z1,y));
    }
    const steps = Math.max(1, Math.ceil(len / (COLL_CELL * 0.5)));
    let lastCell = -1;
    const seen = this._seen || (this._seen = new Set());
    seen.clear();
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const c = this.cellIndex(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
      if (c === lastCell) continue;
      lastCell = c;
      for (let k = this.bCellStart[c], ke = this.bCellStart[c + 1]; k < ke; k++) {
        const i = this.bCellItems[k];
        if (seen.has(i) || i === this.pavilion?.building) continue;
        if (i === this.heritage?.breweryGate?.building) {
          seen.add(i);
          tBest=Math.min(tBest,fountainRay(this.heritage.breweryGate.surfaces,x0,z0,x1,z1,y));
          continue;
        }
        seen.add(i);
        if (i === this.plagueColumn?.building) {
          tBest = Math.min(tBest, columnRay(this.plagueColumn, x0, z0, x1, z1, y));
          continue;
        }
        if (this.bTop[i] <= y) continue;
        if (Math.min(x0, x1) > this.bMaxX[i] || Math.max(x0, x1) < this.bMinX[i] || Math.min(z0, z1) > this.bMaxZ[i] || Math.max(z0, z1) < this.bMinZ[i]) continue;
        for (let rg = B.bRing[i], r1 = B.bRing[i + 1]; rg < r1; rg++) {
          const v0 = B.ringStart[rg], v1 = B.ringStart[rg + 1];
          let j = v1 - 1;
          for (let v = v0; v < v1; j = v++) {
            const ex = vx[v] - vx[j], ez = vz[v] - vz[j];
            const dx = x1 - x0, dz = z1 - z0;
            const den = dx * ez - dz * ex;
            if (Math.abs(den) < 1e-9) continue;
            const t = ((vx[j] - x0) * ez - (vz[j] - z0) * ex) / den;
            const u = ((vx[j] - x0) * dz - (vz[j] - z0) * dx) / den;
            if (t > 0 && t < tBest && u >= 0 && u <= 1) tBest = t;
          }
        }
      }
    }
    return tBest;
  }

  // ----------------------------------------------------------- silnice ----
  _initRoads(R) {
    const n = R.header.count;
    this.r = R;
    this.rCount = n;
    this.prazdrojRoad = identifyPrazdrojBridge(R);
    const originalLength = this.prazdrojRoad < 0 ? 0 : R.start[this.prazdrojRoad + 1] - R.start[this.prazdrojRoad] + 1;
    const nPts = R.dx.length + n + (originalLength ? prazdrojDeck.length - originalLength : 0);
    const px = new Float32Array(nPts), pz = new Float32Array(nPts);
    const pOff = new Uint32Array(n + 1);
    const roadOfPt = new Uint32Array(nPts);
    let o = 0;
    for (let i = 0; i < n; i++) {
      pOff[i] = o;
      if (i === this.prazdrojRoad) {
        for (const [x, z] of prazdrojDeck) {
          px[o] = x; pz[o] = z; roadOfPt[o++] = i;
        }
        continue;
      }
      let x = R.x0[i], z = R.z0[i];
      px[o] = x * 0.1; pz[o] = z * 0.1; roadOfPt[o] = i; o++;
      for (let k = R.start[i], ke = R.start[i + 1]; k < ke; k++) {
        x += R.dx[k]; z += R.dz[k];
        px[o] = x * 0.1; pz[o] = z * 0.1; roadOfPt[o] = i; o++;
      }
    }
    pOff[n] = o;
    this.rpx = px; this.rpz = pz; this.rOff = pOff; this.roadOfPt = roadOfPt;
    // výška bodů: mostovka u mostů, jinak terén
    const py = new Float32Array(nPts);
    for (let i = 0; i < n; i++) {
      if (i === this.prazdrojRoad) {
        for (let k = 0; k < prazdrojDeck.length; k++) py[pOff[i] + k] = prazdrojDeck[k][2] - this.baseElevation;
        continue;
      }
      const bo = R.bridgeOff ? R.bridgeOff[i] : 0xFFFFFFFF;
      for (let k = pOff[i], ke = pOff[i + 1]; k < ke; k++) {
        py[k] = bo !== 0xFFFFFFFF ? R.bridgeY[bo + k - pOff[i]] * 0.02 : this.heightAt(px[k], pz[k]) + SURF;
      }
      if (bo === 0xFFFFFFFF && (R.flags[i] & RF.BRIDGE)) R.flags[i] &= ~RF.BRIDGE;
    }
    this.rpy = py;

    // kousky silnic po dlaždicích (pro vykreslování)
    const pieces = new Array(this.cols * this.rows);
    for (let i = 0; i < n; i++) {
      const a = pOff[i], b = pOff[i + 1] - 1;
      let s = a, acc = 0;
      for (let k = a; k < b; k++) {
        acc += Math.hypot(px[k + 1] - px[k], pz[k + 1] - pz[k]);
        if (acc > 160 || k === b - 1) {
          const e = k + 1;
          const mid = (s + e) >> 1;
          const ci = this.chunkIndex(px[mid], pz[mid]);
          if (ci >= 0) (pieces[ci] || (pieces[ci] = [])).push(i, s, e);
          s = e; acc = 0;
        }
      }
    }
    this.rPieces = pieces;
    this.maxRoadHalfWidth = R.w.reduce((maximum, width, i) => R.cls[i] <= DRIVABLE_MAX ? Math.max(maximum, width / 2) : maximum, 0);

    // mřížka úseků pro hledání nejbližší silnice
    const cnt = new Uint32Array(this.gcols * this.grows + 1);
    const each = (fn) => {
      for (let i = 0; i < n; i++) {
        for (let k = pOff[i], ke = pOff[i + 1] - 1; k < ke; k++) {
          const x0 = Math.min(px[k], px[k + 1]), x1 = Math.max(px[k], px[k + 1]);
          const z0 = Math.min(pz[k], pz[k + 1]), z1 = Math.max(pz[k], pz[k + 1]);
          const cx0 = Math.max(0, Math.floor((x0 - this.minX) / COLL_CELL)), cx1 = Math.min(this.gcols - 1, Math.floor((x1 - this.minX) / COLL_CELL));
          const cz0 = Math.max(0, Math.floor((z0 - this.minZ) / COLL_CELL)), cz1 = Math.min(this.grows - 1, Math.floor((z1 - this.minZ) / COLL_CELL));
          for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) fn(cz * this.gcols + cx, k);
        }
      }
    };
    each((c) => { cnt[c + 1]++; });
    for (let i = 1; i < cnt.length; i++) cnt[i] += cnt[i - 1];
    const items = new Uint32Array(cnt[cnt.length - 1]);
    const fill = new Uint32Array(this.gcols * this.grows);
    each((c, k) => { items[cnt[c] + fill[c]++] = k; });
    this.segCellStart = cnt; this.segCellItems = items;
  }

  /**
   * Nejbližší úsek silnice. maxClass omezuje třídu, heading vyžaduje slučitelný směr.
   * Vrací objekt {road, seg, t, dist, x, z, dx, dz} nebo null.
   */
  nearestRoad(x, z, maxDist = 60, maxClass = 99, minClass = 0, out, y, publicOnly = false, heading) {
    const res = out || {};
    const maxSquared = maxDist * maxDist;
    let best = Infinity, found = false;
    const R = this.r, px = this.rpx, pz = this.rpz;
    const tube = y === undefined ? null : this.tunnelAt(x, z, y);
    const tunnelRoad = tube?.inside ? tube.tunnel.road : -1;
    const layered = Number.isFinite(y) && this.deckAt(x, z, Infinity) > this.heightAt(x, z) + 2.5;
    const cx0 = Math.max(0, Math.floor((x - maxDist - this.minX) / COLL_CELL)), cx1 = Math.min(this.gcols - 1, Math.floor((x + maxDist - this.minX) / COLL_CELL));
    const cz0 = Math.max(0, Math.floor((z - maxDist - this.minZ) / COLL_CELL)), cz1 = Math.min(this.grows - 1, Math.floor((z + maxDist - this.minZ) / COLL_CELL));
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
      const c = cz * this.gcols + cx;
      for (let q = this.segCellStart[c], qe = this.segCellStart[c + 1]; q < qe; q++) {
        const k = this.segCellItems[q];
        const road = this.roadOfPt[k];
        if (publicOnly && (R.flags[road] & RF.PRIVATE)) continue;
        if (tunnelRoad >= 0 && tunnelRoad !== road) continue;
        if (y !== undefined && tunnelRoad < 0 && this.tunnelRoads.has(road)) continue;
        const cls = R.cls[road];
        if (cls > maxClass || cls < minClass) continue;
        const x1 = px[k], z1 = pz[k], dx = px[k + 1] - x1, dz = pz[k + 1] - z1;
        const l2 = dx * dx + dz * dz;
        let t = l2 > 0 ? ((x - x1) * dx + (z - z1) * dz) / l2 : 0;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        const qx = x1 + dx * t, qz = z1 + dz * t;
        const d = (x - qx) * (x - qx) + (z - qz) * (z - qz);
        if (d >= maxSquared || d >= best) continue;
        let score = d;
        if (Number.isFinite(y) && (layered || (R.flags[road] & RF.BRIDGE) || this.elevatedWidths?.has(road))) {
          const level = this.roadSurfaceY(road, k, t, qx, qz);
          score += 4 * Math.max(0, Math.abs(level - y) - 1.2) ** 2;
        }
        if (score < best) {
          const l = Math.sqrt(l2) || 1;
          if (heading) {
            const alignment = (dx * heading.tx + dz * heading.tz) / l;
            if (Math.abs(alignment) < 0.8 || (alignment < 0 && (R.flags[road] & RF.ONEWAY))) continue;
          }
          best = score; found = true;
          res.road = road; res.seg = k; res.t = t; res.x = qx; res.z = qz;
          res.dx = dx / l; res.dz = dz / l; res.dist = Math.sqrt(d);
        }
      }
    }
    if (!found) return null;
    return res;
  }

  // ------------------------------------------------- profil silnic ----
  _initRoadGrades() {
    this.roadGrade = null;
    this.roadTerrain = null;
    if (new URLSearchParams(globalThis.location?.search ?? '').get('silnice') === 'puvodni') return;
    const R = this.r;
    const raised = (road) => (R.flags[road] & (RF.BRIDGE | RF.TUNNEL | RF.SHARED_DECK)) !== 0 ||
      this.tunnelRoads.has(road) || this.elevatedWidths?.has(road) || this.gradeRoads.has(road);
    const include = (road) => R.cls[road] <= DRIVABLE_MAX && !raised(road) && !this.rondel?.trackAccess?.has(road);
    // Ručně doladěná místa (nájezd na horní pás, břeh u mostu, rampa u nádraží, podjezdy) zůstávají.
    const special = new Set([this.roadApproach?.road, 155, 33139, 33140, ...this.tunnelApproaches.keys()]);
    const includeRoad = (road) => include(road) && !special.has(road);
    // Konce měřených a kamenných mostů, tunelů, Rondelu a mimoúrovňových ramp mají kalibrované
    // napojení na terén. Na běžné mosty z mapy se profil napojí na výšku mostovky.
    // Každá buňka zná konce ze svého okolí, dotaz tak potřebuje jediné vyhledání.
    const calibrated = (road) => (R.flags[road] & (RF.TUNNEL | RF.SHARED_DECK)) !== 0 || this.deckCalibrations.has(road) ||
      this.archedBridges.has(road) || this.tunnelRoads.has(road) || this.elevatedWidths?.has(road) || this.gradeRoads.has(road);
    const ends = new Map();
    for (let road = 0; road < this.rCount; road++) {
      if (R.cls[road] > DRIVABLE_MAX || !calibrated(road)) continue;
      for (const p of [this.rOff[road], this.rOff[road + 1] - 1]) {
        const x = this.rpx[p], z = this.rpz[p];
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          const key = cellKey(x + dx * STRUCTURE_KEEP, z + dz * STRUCTURE_KEEP);
          if (!ends.has(key)) ends.set(key, []);
          ends.get(key).push(x, z);
        }
      }
    }
    this._structureEnds = ends;
    // Sjízdné silnice bez profilu (ručně doladěné nájezdy): navazující silnice k nim přejdou do terénu.
    const foreign = (road) => R.cls[road] <= DRIVABLE_MAX && !raised(road) && !includeRoad(road);
    // Příčný sklon podle svahu a klopení zatáček mimo obytné ulice a kruhové objezdy (?sklon=0 vypne).
    const cross = new URLSearchParams(globalThis.location?.search ?? '').get('sklon') !== '0';
    const bank = (road) => R.cls[road] <= RC.UNCLASSIFIED && !(R.flags[road] & RF.ROUNDABOUT) && !this.rondel?.ring.has(road);
    const built = (x, z, r) => this.nearBuilding(x, z, r);
    // Silnice podél břehu leží na terase nad nábřežní zdí, kterou výškový model rozmazal (?nabrezi=0 vypne).
    const shore = new URLSearchParams(globalThis.location?.search ?? '').get('nabrezi') !== '0' && this.shoreCells?.size
      ? (road, x, z, nx, nz) => this.shoreLiftAt(road, x, z, nx, nz) : null;
    this.roadGrade = buildRoadGrades(this, includeRoad, raised, (x, z) => this.terrainHeightAt(x, z), undefined,
      (x, z) => this.keepsTerrain(x, z), foreign, { cross, bank, built, shore, halfWidth: (road) => R.w[road] / 2 });
    this.roadTerrain = new Map();
    this.roadClamp = new Map();
    this.roadNear = new Map();
    this.roadSteepTiles = new Set();
    // Plocha křižovatky: kruh přes nejširší vozovku, každá buňka zná křižovatky ze svého okolí.
    const junctions = new Map();
    for (const { p, roads, dirs } of this.roadGrade.junctions) {
      const x = this.rpx[p], z = this.rpz[p];
      // Kruh musí pokrýt celé překrytí vozovek; pod ostrým úhlem sahá dál od společného bodu.
      let radius = 0;
      for (let a = 0; a < roads.length; a++) for (let b = a + 1; b < roads.length; b++) {
        const sin = Math.abs(dirs[a][0] * dirs[b][1] - dirs[a][1] * dirs[b][0]);
        radius = Math.max(radius, ((R.w[roads[a]] + R.w[roads[b]]) / 2 + JUNCTION_BLEND) / Math.max(sin, 0.25));
      }
      radius = Math.min(50, radius) + 1;
      const reach = Math.ceil(radius / JUNCTION_CELL);
      for (let dz = -reach; dz <= reach; dz++) for (let dx = -reach; dx <= reach; dx++) {
        const key = junctionKey(x + dx * JUNCTION_CELL, z + dz * JUNCTION_CELL);
        if (!junctions.has(key)) junctions.set(key, []);
        junctions.get(key).push(x, z, radius);
      }
    }
    this._junctions = junctions;
  }

  /** Leží bod v ploše křižovatky silnic s profilem? */
  inJunction(x, z) {
    const list = this._junctions?.get(junctionKey(x, z));
    if (!list) return false;
    for (let k = 0; k < list.length; k += 3) {
      if ((list[k] - x) ** 2 + (list[k + 1] - z) ** 2 < list[k + 2] * list[k + 2]) return true;
    }
    return false;
  }

  /**
   * Společná výška vozovek v křižovatce. Na vozovce důležitější silnice (vyšší třída, širší,
   * při shodě nižší číslo) platí její profil; méně důležitá silnice se k jejímu okraji napojí
   * plynule během JUNCTION_BLEND. Pásy, asfalt i provoz se tak v křižovatce potkají ve stejné
   * výšce a hlavní silnice si zachová svůj sklon. NaN mimo vozovku s plným profilem.
   */
  junctionSurfaceAt(x, z) {
    const grade = this.roadGrade;
    if (!grade) return NaN;
    const R = this.r;
    const cx = Math.floor((x - this.minX) / COLL_CELL), cz = Math.floor((z - this.minZ) / COLL_CELL);
    // Úsek dál než reach na ose x nebo z nemůže zasáhnout; rychlé vyřazení před výpočtem vzdálenosti.
    const reach = this.maxRoadHalfWidth + JUNCTION_BLEND;
    const found = this._junctionRoads ??= [];
    found.length = 0;
    for (let row = Math.max(0, cz - 1); row <= Math.min(this.grows - 1, cz + 1); row++) {
      for (let col = Math.max(0, cx - 1); col <= Math.min(this.gcols - 1, cx + 1); col++) {
        const cell = row * this.gcols + col;
        for (let j = this.segCellStart[cell]; j < this.segCellStart[cell + 1]; j++) {
          const k = this.segCellItems[j], road = this.roadOfPt[k];
          if (grade.start[road] < 0) continue;
          const ax = this.rpx[k], az = this.rpz[k], bx = this.rpx[k + 1], bz = this.rpz[k + 1];
          if ((ax < bx ? ax : bx) > x + reach || (ax > bx ? ax : bx) < x - reach ||
            (az < bz ? az : bz) > z + reach || (az > bz ? az : bz) < z - reach) continue;
          const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
          if (!l2) continue;
          const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2));
          const d = Math.hypot(ax + ex * t - x, az + ez * t - z);
          if (d > R.w[road] / 2 + JUNCTION_BLEND) continue;
          let index = -1;
          for (let q = 0; q < found.length; q += 3) if (found[q] === road) { index = q; break; }
          if (index >= 0 && found[index + 1] <= d) continue;
          let y = gradeSurface(grade, road, grade.station[k] + t * (grade.station[k + 1] - grade.station[k]), NaN);
          if (y !== y) continue;
          y += this.roadCrossAt(road, k, t, x, z);
          if (index >= 0) { found[index + 1] = d; found[index + 2] = y; }
          else found.push(road, d, y);
        }
      }
    }
    // od nejméně důležité silnice k nejdůležitější: každá přepíše výšku na své vozovce
    const order = this._junctionOrder ??= [];
    order.length = 0;
    for (let q = 0; q < found.length; q += 3) order.push(q);
    // pořadí: vyšší třída (méně důležitá) dřív, potom užší, potom vyšší číslo silnice
    order.sort((a, b) => {
      const ra = found[a], rb = found[b];
      return R.cls[rb] - R.cls[ra] || R.w[ra] - R.w[rb] || rb - ra;
    });
    let surface = NaN;
    for (const q of order) {
      const road = found[q], d = found[q + 1], y = found[q + 2], hw = R.w[road] / 2;
      if (surface !== surface) {
        if (d <= hw + 0.01) surface = y;
        continue;
      }
      const u = Math.max(0, Math.min(1, 1 - (d - hw) / JUNCTION_BLEND));
      const weight = u * u * (3 - 2 * u);
      surface += weight * (y - surface);
    }
    return surface;
  }

  /**
   * Ručně doladěné místo, kde silnice dál kopíruje původní terén: 2 = terén upravený pro
   * mimoúrovňová křížení, 1 = okolí konce mostu, tunelu nebo rampy, 0 = jinde.
   */
  keepsTerrain(x, z) {
    if (Math.abs(this.gradeOffsetAt(x, z)) > 0.02) return 2;
    const list = this._structureEnds?.get(cellKey(x, z));
    if (!list) return 0;
    for (let k = 0; k < list.length; k += 2) {
      if ((list[k] - x) ** 2 + (list[k + 1] - z) ** 2 < STRUCTURE_KEEP * STRUCTURE_KEEP) return 1;
    }
    return 0;
  }

  /** Ruční úprava terénu z mimoúrovňových křížení v bodě (m), 0 mimo upravené dlaždice. */
  gradeOffsetAt(x, z) {
    if (!this.gradeTerrain?.size) return 0;
    const tileX = Math.floor((x - this.minX) / CHUNK), tileZ = Math.floor((z - this.minZ) / CHUNK);
    if (tileX < 0 || tileX >= this.cols || tileZ < 0 || tileZ >= this.rows) return 0;
    const grade = this.gradeTerrain.get(tileZ * this.cols + tileX);
    if (!grade) return 0;
    const dx = (x - this.minX - tileX * CHUNK) / this.gradeStep, dz = (z - this.minZ - tileZ * CHUNK) / this.gradeStep;
    const i = Math.min(this.gradeStride - 2, dx | 0), j = Math.min(this.gradeStride - 2, dz | 0);
    return 0.01 * triangleHeight(grade, j * this.gradeStride + i, this.gradeStride, dx - i, dz - j);
  }

  /**
   * Nejnižší povrch vozovky s profilem, na které bod leží (NaN mimo ni); ground je terén v bodě.
   * Fyzika a síť terénu pod ním terén snižují, aby pás silnice nikde nepřekrýval. Výška pro
   * chodce a domy (heightAt) se tím nemění.
   */
  carriagewayProfileAt(x, z, ground, pad = 1.5) {
    const grade = this.roadGrade;
    if (!grade) return NaN;
    const cx = Math.floor((x - this.minX) / COLL_CELL), cz = Math.floor((z - this.minZ) / COLL_CELL);
    let best = NaN, kept = -1;
    for (let row = Math.max(0, cz - 1); row <= Math.min(this.grows - 1, cz + 1); row++) {
      for (let col = Math.max(0, cx - 1); col <= Math.min(this.gcols - 1, cx + 1); col++) {
        const cell = row * this.gcols + col;
        for (let j = this.segCellStart[cell]; j < this.segCellStart[cell + 1]; j++) {
          const k = this.segCellItems[j], road = this.roadOfPt[k];
          if (grade.start[road] < 0) continue;
          const ax = this.rpx[k], az = this.rpz[k], ex = this.rpx[k + 1] - ax, ez = this.rpz[k + 1] - az, l2 = ex * ex + ez * ez;
          if (!l2) continue;
          const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2));
          const hw = this.r.w[road] / 2, reach = hw + pad, d2 = (ax + ex * t - x) ** 2 + (az + ez * t - z) ** 2;
          if (d2 > reach * reach) continue;
          // za okrajem pásu ne u konců mostů, tunelů a ramp (viz _buildRoadTerrain)
          if (d2 > hw * hw && (kept < 0 ? (kept = this.keepsTerrain(x, z) === 1 ? 1 : 0) : kept)) continue;
          let y = gradeSurface(grade, road, grade.station[k] + t * (grade.station[k + 1] - grade.station[k]), NaN);
          y = y === y ? this.stripClampY(road, k, t, x, z, y + this.roadCrossAt(road, k, t, x, z, true)) : ground;
          if (y < best || best !== best) best = y;
        }
      }
    }
    return best;
  }

  /**
   * Vzdálenost bodu od okraje nejbližší vozovky s profilem (záporná na vozovce), NaN dál než reach.
   * Pro vykreslenou síť terénu u okraje silnice (road-edge-terrain.js).
   */
  roadEdgeDistance(x, z, reach) {
    const grade = this.roadGrade;
    if (!grade) return NaN;
    const cx = Math.floor((x - this.minX) / COLL_CELL), cz = Math.floor((z - this.minZ) / COLL_CELL);
    let best = Infinity;
    for (let row = Math.max(0, cz - 1); row <= Math.min(this.grows - 1, cz + 1); row++) {
      for (let col = Math.max(0, cx - 1); col <= Math.min(this.gcols - 1, cx + 1); col++) {
        const cell = row * this.gcols + col;
        for (let j = this.segCellStart[cell]; j < this.segCellStart[cell + 1]; j++) {
          const k = this.segCellItems[j], road = this.roadOfPt[k];
          if (grade.start[road] < 0) continue;
          const ax = this.rpx[k], az = this.rpz[k], ex = this.rpx[k + 1] - ax, ez = this.rpz[k + 1] - az, l2 = ex * ex + ez * ez;
          if (!l2) continue;
          const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2));
          const edge = Math.hypot(ax + ex * t - x, az + ez * t - z) - this.r.w[road] / 2;
          if (edge < best) best = edge;
        }
      }
    }
    return best <= reach ? best : NaN;
  }

  /**
   * Výška pásu vozovky, pod kterou se srovná terén v bodě (x, z) u úseku (seg, t). Mimo
   * křižovatky je to vlastní profil silnice s příčným sklonem, za okrajem na nižší straně
   * prodloužený dál dolů (own). V křižovatce ale pás leží ve společné výšce vozovek
   * (junctionSurfaceAt), která se od vlastního profilu vedlejší nebo strmé silnice liší i o
   * desítky centimetrů. Bod za okrajem se proto promítne na okraj pásu a vezme se tamní společná
   * výška; klesá-li pás k okraji, pokračuje za ním stejným sklonem. Jinak by okraj sousední silnice
   * stáhl terén pod vozovku, po které kola jedou přímo po terénu (napojení mostů a tunelů).
   */
  stripClampY(road, seg, t, x, z, own) {
    const ax = this.rpx[seg], az = this.rpz[seg];
    const px = ax + (this.rpx[seg + 1] - ax) * t, pz = az + (this.rpz[seg + 1] - az) * t;
    const d = Math.hypot(x - px, z - pz), hw = this.r.w[road] / 2;
    const f = d > hw ? hw / d : 1;
    const qx = px + (x - px) * f, qz = pz + (z - pz) * f;
    if (!this.inJunction(qx, qz)) return own;
    const shared = this.junctionSurfaceAt(qx, qz);
    if (shared !== shared) return own;
    if (d <= hw) return shared;
    // sklon pásu napříč u okraje: výška o krok (nejvýš 1 m) blíž k ose
    const step = Math.min(1, hw), back = (hw - step) / d;
    const inner = this.junctionSurfaceAt(px + (x - px) * back, pz + (z - pz) * back);
    const fall = inner === inner ? Math.min(0, (shared - inner) / step) : 0;
    return shared + fall * (d - hw);
  }

  /**
   * Výška hladkého profilu silnice v bodě úseku (seg, t); NaN, pokud silnice profil nemá
   * nebo bod leží v ručně doladěném místě.
   */
  roadGradeY(road, seg, t) {
    const grade = this.roadGrade;
    if (!grade || grade.start[road] < 0) return NaN;
    return gradeHeight(grade, road, grade.station[seg] + t * (grade.station[seg + 1] - grade.station[seg]));
  }

  /** Výška profilu podle staničení od začátku silnice (NaN jako u roadGradeY). */
  roadGradeAt(road, station) {
    const grade = this.roadGrade;
    if (!grade || grade.start[road] < 0) return NaN;
    return gradeHeight(grade, road, station);
  }

  /**
   * Příčný sklon: o kolik leží bod (x, z) nad osou silnice v úseku (seg, t). Odsazení od osy se
   * měří jako vzdálenost od úseku se znaménkem strany a nejvýš do okraje vozovky. lower = za
   * okrajem na nižší straně pokračovat ve sklonu dál dolů (pro srovnání terénu pod pásem).
   */
  roadCrossAt(road, seg, t, x, z, lower = false) {
    const grade = this.roadGrade;
    if (!grade?.cross || grade.start[road] < 0) return 0;
    const ax = this.rpx[seg], az = this.rpz[seg], ex = this.rpx[seg + 1] - ax, ez = this.rpz[seg + 1] - az;
    const ox = x - ax - ex * t, oz = z - az - ez * t;
    const d = Math.hypot(ox, oz);
    if (!d) return 0;
    const slope = gradeCross(grade, road, grade.station[seg] + t * (grade.station[seg + 1] - grade.station[seg]));
    const rate = ex * oz - ez * ox < 0 ? -slope : slope, hw = this.r.w[road] / 2;
    return lower ? Math.min(rate * Math.min(hw, d), rate * d) : rate * Math.min(hw, d);
  }

  /**
   * Úprava terénu jedné dlaždice (v cm po 4 m): vozovka a krajnice leží na profilu,
   * dál se terén plynule vrací k původní výšce. Počítá se při prvním dotazu; v paměti
   * zůstává nejvýš ROAD_TILE_CACHE naposledy spočtených dlaždic.
   */
  roadTerrainTile(tile) {
    let grid = this.roadTerrain.get(tile);
    if (grid !== undefined) return grid;
    if (this.roadTerrain.size >= ROAD_TILE_CACHE) {
      const oldest = this.roadTerrain.keys().next().value;
      this.roadTerrain.delete(oldest);
      this.roadClamp.delete(oldest);
      this.roadNear.delete(oldest);
    }
    grid = this._buildRoadTerrain(tile);
    this.roadTerrain.set(tile, grid);
    return grid;
  }

  // -------------------------------------------------------- zaoblené rohy ----
  /** Najde zaoblené rohy křižovatek a ohybů (viz corners.js); vypne je ?rohy=0. */
  _initCorners() {
    this.corners = [];
    this.cornerTiles = new Map();
    this._cornerCells = new Map();
    this.sidewalkCuts = new Map();
    if (new URLSearchParams(globalThis.location?.search ?? '').get('rohy') === '0') return;
    const R = this.r;
    const special = new Set([this.roadApproach?.road, 155, 33139, 33140, ...this.tunnelApproaches.keys()]);
    const usable = (road) => R.cls[road] <= RC.LIVING && !(R.flags[road] & (RF.BRIDGE | RF.TUNNEL | RF.SHARED_DECK | RF.AISLE)) &&
      !this.tunnelRoads.has(road) && !this.gradeRoads.has(road) && !special.has(road) &&
      !this.elevatedWidths?.has(road) && !this.rondel?.ring.has(road) && !this.rondel?.trackAccess?.has(road);
    const walls = (x0, z0, x1, z1, visit) => this.forWalls(x0, z0, x1, z1, visit);
    const skip = (x, z) => this.sidewalkExcluded(x, z) || this.keepsTerrain(x, z) > 0;
    const roads = (x, z, a, b) => this.insideOtherCarriageway(a, x, z, 0.2, b);
    this.corners = findCorners(this, usable, walls, skip, roads);
    for (let i = 0; i < this.corners.length; i++) {
      const corner = this.corners[i];
      corner.polygon = cornerPolygon(corner);
      corner.inner = shrinkPolygon(corner.polygon, 0.05);
      corner.draw = cornerOverlap(corner, CORNER_OVERLAP);
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (const [x, z] of [...corner.polygon, ...corner.draw]) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
      corner.box = [x0, z0, x1, z1];
      const tile = this.chunkIndex(corner.node[0], corner.node[1]);
      if (tile >= 0) {
        if (!this.cornerTiles.has(tile)) this.cornerTiles.set(tile, []);
        this.cornerTiles.get(tile).push(corner);
      }
      for (let cz = Math.floor(z0 / 32); cz <= Math.floor(z1 / 32); cz++) for (let cx = Math.floor(x0 / 32); cx <= Math.floor(x1 / 32); cx++) {
        const key = cx * 131072 + cz;
        if (!this._cornerCells.has(key)) this._cornerCells.set(key, []);
        this._cornerCells.get(key).push(corner);
      }
      // chodníky obou silnic končí přesně v bodech dotyku oblouku
      for (const [arm, along, side] of [[corner.a, corner.sa, 1], [corner.b, corner.sb, -1]]) {
        const cut = armCut(this, arm, along, side);
        if (!this.sidewalkCuts.has(arm.road)) this.sidewalkCuts.set(arm.road, []);
        this.sidewalkCuts.get(arm.road).push(cut);
      }
    }
  }

  /** Zaoblený roh, v jehož asfaltu bod leží (null mimo rohy). */
  cornerAt(x, z) {
    const list = this._cornerCells?.get(Math.floor(x / 32) * 131072 + Math.floor(z / 32));
    if (!list) return null;
    for (const corner of list) {
      const [x0, z0, x1, z1] = corner.box;
      if (x < x0 || x > x1 || z < z0 || z > z1) continue;
      if (insidePolygon(corner.inner, x, z)) return corner;
    }
    return null;
  }

  /** Zaoblený roh, jehož asfalt (i s překrytím přes okraje vozovek) leží v bodě, nebo null. */
  cornerAsphaltAt(x, z) {
    const list = this._cornerCells?.get(Math.floor(x / 32) * 131072 + Math.floor(z / 32));
    if (!list) return null;
    for (const corner of list) {
      const [x0, z0, x1, z1] = corner.box;
      if (x < x0 - 1 || x > x1 + 1 || z < z0 - 1 || z > z1 + 1) continue;
      if (insidePolygon(corner.draw ?? corner.polygon, x, z)) return corner;
    }
    return null;
  }

  /**
   * Zaoblený roh v uzlu (x, z) mezi rameny ve směrech (ax, az) a (bx, bz) od uzlu, nebo null.
   * Auta řízená hrou podle něj volí dráhu při odbočení.
   */
  cornerBetween(x, z, ax, az, bx, bz) {
    if (!this._cornerCells?.size) return null;
    const along = (arm, dx, dz) => arm.dx * dx + arm.dz * dz > 0.8;
    // roh je zapsaný v buňkách své plochy, uzel může ležet v sousední
    for (let cz = Math.floor((z - 12) / 32); cz <= Math.floor((z + 12) / 32); cz++) {
      for (let cx = Math.floor((x - 12) / 32); cx <= Math.floor((x + 12) / 32); cx++) {
        for (const corner of this._cornerCells.get(cx * 131072 + cz) ?? []) {
          if (Math.hypot(corner.node[0] - x, corner.node[1] - z) > 3) continue;
          if ((along(corner.a, ax, az) && along(corner.b, bx, bz)) || (along(corner.a, bx, bz) && along(corner.b, ax, az))) return corner;
        }
      }
    }
    return null;
  }

  /**
   * Výška asfaltu v zaobleném rohu (včetně SURF jako roadSurfaceY): mezi okraji obou vozovek
   * podle vzdálenosti, u okraje vozovky přesně její výška. profileOnly = jen z profilů silnic
   * (bez dotazu na terén, pro výpočet úprav terénu; NaN, kde profil neplatí).
   */
  cornerY(corner, x, z, profileOnly = false) {
    const side = (arm, sign) => {
      // nejbližší úsek ramene
      let k = arm.segs[0], t = 0, best = Infinity;
      for (const seg of arm.segs) {
        const ax = this.rpx[seg], az = this.rpz[seg], ex = this.rpx[seg + 1] - ax, ez = this.rpz[seg + 1] - az, l2 = ex * ex + ez * ez;
        const f = l2 ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)) : 0;
        const d = (ax + ex * f - x) ** 2 + (az + ez * f - z) ** 2;
        if (d < best) { best = d; k = seg; t = f; }
      }
      const ax = this.rpx[k], az = this.rpz[k], ex = this.rpx[k + 1] - ax, ez = this.rpz[k + 1] - az;
      // okraj vozovky na straně rohu; bod na vozovce ramene má výšku vozovky (i s příčným sklonem)
      const nx = -arm.dz * sign, nz = arm.dx * sign;
      let qx = ax + ex * t + nx * arm.hw, qz = az + ez * t + nz * arm.hw;
      const beyond = (x - qx) * nx + (z - qz) * nz;
      if (beyond < 0) { qx = x; qz = z; }
      const grade = this.roadGrade, station = grade?.start[arm.road] >= 0 ? grade.station[k] + t * (grade.station[k + 1] - grade.station[k]) : 0;
      const y = !profileOnly ? this.roadSurfaceY(arm.road, k, t, qx, qz)
        : grade && gradeBlend(grade, arm.road, station) >= 1 ? this.roadGradeY(arm.road, k, t) + this.roadCrossAt(arm.road, k, t, qx, qz) + SURF : NaN;
      return [y, Math.max(0, beyond)];
    };
    const [ya, da] = side(corner.a, 1), [yb, db] = side(corner.b, -1);
    if (profileOnly && (ya !== ya || yb !== yb)) return NaN;
    if (ya !== ya) return yb;
    if (yb !== yb) return ya;
    return da + db > 1e-6 ? (ya * db + yb * da) / (da + db) : (ya + yb) / 2;
  }

  // ------------------------------------------------------------- chodníky ----
  /** Leží do vzdálenosti r od bodu obdélník kolem některého domu? */
  nearBuilding(x, z, r) {
    const cx0 = Math.max(0, Math.floor((x - r - this.minX) / COLL_CELL)), cx1 = Math.min(this.gcols - 1, Math.floor((x + r - this.minX) / COLL_CELL));
    const cz0 = Math.max(0, Math.floor((z - r - this.minZ) / COLL_CELL)), cz1 = Math.min(this.grows - 1, Math.floor((z + r - this.minZ) / COLL_CELL));
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
      const c = cz * this.gcols + cx;
      for (let k = this.bCellStart[c], ke = this.bCellStart[c + 1]; k < ke; k++) {
        const i = this.bCellItems[k];
        const dx = Math.max(this.bMinX[i] - x, 0, x - this.bMaxX[i]), dz = Math.max(this.bMinZ[i] - z, 0, z - this.bMaxZ[i]);
        if (dx * dx + dz * dz <= r * r) return true;
      }
    }
    return false;
  }

  /** Projde hrany stěn budov v obdélníku; visit(ax, az, bx, bz). */
  forWalls(x0, z0, x1, z1, visit) {
    const B = this.b, vx = this.bvx, vz = this.bvz;
    const cx0 = Math.max(0, Math.floor((x0 - this.minX) / COLL_CELL)), cx1 = Math.min(this.gcols - 1, Math.floor((x1 - this.minX) / COLL_CELL));
    const cz0 = Math.max(0, Math.floor((z0 - this.minZ) / COLL_CELL)), cz1 = Math.min(this.grows - 1, Math.floor((z1 - this.minZ) / COLL_CELL));
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
      const c = cz * this.gcols + cx;
      for (let k = this.bCellStart[c], ke = this.bCellStart[c + 1]; k < ke; k++) {
        const i = this.bCellItems[k];
        if (x1 < this.bMinX[i] || x0 > this.bMaxX[i] || z1 < this.bMinZ[i] || z0 > this.bMaxZ[i]) continue;
        for (let rg = B.bRing[i]; rg < B.bRing[i + 1]; rg++) {
          const v0 = B.ringStart[rg], v1 = B.ringStart[rg + 1];
          for (let v = v0, j = v1 - 1; v < v1; j = v++) visit(vx[j], vz[j], vx[v], vz[v]);
        }
      }
    }
  }

  /**
   * Leží bod na vozovce jiné sjízdné silnice než road a also (mimo mosty a tunely), s okrajem pad,
   * nebo v asfaltu zaobleného rohu?
   */
  insideOtherCarriageway(road, x, z, pad = 0, also = -1) {
    if (this.cornerAt(x, z)) return true;
    const cx = Math.floor((x - this.minX) / COLL_CELL), cz = Math.floor((z - this.minZ) / COLL_CELL);
    for (let row = Math.max(0, cz - 1); row <= Math.min(this.grows - 1, cz + 1); row++) {
      for (let col = Math.max(0, cx - 1); col <= Math.min(this.gcols - 1, cx + 1); col++) {
        const cell = row * this.gcols + col;
        for (let j = this.segCellStart[cell]; j < this.segCellStart[cell + 1]; j++) {
          const k = this.segCellItems[j], other = this.roadOfPt[k];
          if (other === road || other === also || this.r.cls[other] > DRIVABLE_MAX || (this.r.flags[other] & (RF.BRIDGE | RF.TUNNEL))) continue;
          const ax = this.rpx[k], az = this.rpz[k], ex = this.rpx[k + 1] - ax, ez = this.rpz[k + 1] - az, l2 = ex * ex + ez * ez;
          if (!l2) continue;
          const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2));
          const reach = this.r.w[other] / 2 + pad;
          if ((ax + ex * t - x) ** 2 + (az + ez * t - z) ** 2 <= reach * reach) return true;
        }
      }
    }
    return false;
  }

  /** Leží bod na chodníku důležitější silnice? Tam chodník silnice road v rohu křižovatky končí. */
  insideSidewalkOf(road, x, z, widths = this.sidewalks) {
    if (!widths) return false;
    const own = sidewalkPriority(this, road);
    const cx = Math.floor((x - this.minX) / COLL_CELL), cz = Math.floor((z - this.minZ) / COLL_CELL);
    for (let row = Math.max(0, cz - 1); row <= Math.min(this.grows - 1, cz + 1); row++) {
      for (let col = Math.max(0, cx - 1); col <= Math.min(this.gcols - 1, cx + 1); col++) {
        const cell = row * this.gcols + col;
        for (let j = this.segCellStart[cell]; j < this.segCellStart[cell + 1]; j++) {
          const k = this.segCellItems[j], other = this.roadOfPt[k];
          if (other === road || !widths[other]) continue;
          const priority = sidewalkPriority(this, other);
          if (priority < own || (priority === own && other > road)) continue;
          const ax = this.rpx[k], az = this.rpz[k], ex = this.rpx[k + 1] - ax, ez = this.rpz[k + 1] - az, l2 = ex * ex + ez * ez;
          if (!l2) continue;
          const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2));
          const reach = this.r.w[other] / 2 + widths[other];
          if ((ax + ex * t - x) ** 2 + (az + ez * t - z) ** 2 <= reach * reach) return true;
        }
      }
    }
    return false;
  }

  /** Ruční úseky ulic z E25 mají vlastní dlažbu a vybavení; chodník se tam negeneruje. */
  sidewalkExcluded(x, z) {
    for (const section of this.streetDetails?.sections ?? []) {
      const [x0, z0, x1, z1] = section.bounds;
      if (x >= x0 - 6 && x <= x1 + 6 && z >= z0 - 6 && z <= z1 + 6) return true;
    }
    return false;
  }

  /** Výška chodníku v bodě (NaN mimo chodník). Stejný průběh jako vykreslený chodník. */
  sidewalkY(x, z) {
    const widths = this.sidewalks;
    if (!widths || this.sidewalkExcluded(x, z)) return NaN;
    const cx = Math.floor((x - this.minX) / COLL_CELL), cz = Math.floor((z - this.minZ) / COLL_CELL);
    let best = Infinity, road = -1, seg = 0, along = 0, qx = 0, qz = 0;
    for (let row = Math.max(0, cz - 1); row <= Math.min(this.grows - 1, cz + 1); row++) {
      for (let col = Math.max(0, cx - 1); col <= Math.min(this.gcols - 1, cx + 1); col++) {
        const cell = row * this.gcols + col;
        for (let j = this.segCellStart[cell]; j < this.segCellStart[cell + 1]; j++) {
          const k = this.segCellItems[j], r = this.roadOfPt[k];
          if (!widths[r]) continue;
          const ax = this.rpx[k], az = this.rpz[k], ex = this.rpx[k + 1] - ax, ez = this.rpz[k + 1] - az, l2 = ex * ex + ez * ez;
          if (!l2) continue;
          const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2));
          const px = ax + ex * t, pz = az + ez * t, d = Math.hypot(px - x, pz - z), hw = this.r.w[r] / 2;
          if (d < hw || d > hw + widths[r] || d - hw >= best) continue;
          best = d - hw; road = r; seg = k; along = t; qx = px; qz = pz;
        }
      }
    }
    if (road < 0 || this.insideOtherCarriageway(road, x, z, 0)) return NaN;
    const d = best + this.r.w[road] / 2, ox = (x - qx) / d, oz = (z - qz) / d, hw = this.r.w[road] / 2, width = widths[road];
    const surface = this.roadSurfaceY(road, seg, along, qx + ox * hw, qz + oz * hw);
    const terrain = this.heightAt(qx + ox * (hw + width), qz + oz * (hw + width)) + SURF;
    return sidewalkHeight(sidewalkProfile(surface, terrain, width), width, best);
  }

  /** Výška pro chodce: terén, mostovka nebo chodník, co je výš. */
  walkY(x, z, yHint) {
    const ground = this.groundY(x, z, yHint);
    const walk = this.sidewalks ? this.sidewalkY(x, z) : NaN;
    return walk > ground ? walk : ground;
  }

  /** Má dlaždice úpravy terénu nebo vozovku s profilem? */
  hasRoadTerrain(tile) {
    if (!this.roadTerrain) return false;
    return this.roadTerrainTile(tile) !== null || !!this.roadClamp.get(tile);
  }

  /**
   * Uzly mřížky po 4 m (ROAD_TERRAIN_STRIDE × ROAD_TERRAIN_STRIDE) do NEAR_PAD od vozovky
   * s profilem, nebo null. Fyzika podle nich zjemní síť terénu jen podél silnic.
   */
  roadNearTile(tile) {
    if (!this.roadTerrain) return null;
    this.roadTerrainTile(tile);
    return this.roadNear.get(tile) ?? null;
  }

  /**
   * Povrch vozovky s profilem nad bodem sítě terénu (NaN mimo ni). V uzlech mřížky po 4 m se
   * čte z předpočtené tabulky dlaždice, jinde se počítá jako carriagewayProfileAt().
   */
  roadClampAt(x, z, ground) {
    if (!this.roadGrade) return NaN;
    const tileX = Math.floor((x - this.minX) / CHUNK), tileZ = Math.floor((z - this.minZ) / CHUNK);
    if (tileX < 0 || tileX >= this.cols || tileZ < 0 || tileZ >= this.rows) return NaN;
    const fi = (x - this.minX - tileX * CHUNK) / ROAD_TERRAIN_STEP, fz = (z - this.minZ - tileZ * CHUNK) / ROAD_TERRAIN_STEP;
    const i = Math.round(fi), j = Math.round(fz);
    if (Math.abs(fi - i) > 1e-6 || Math.abs(fz - j) > 1e-6) return this.carriagewayProfileAt(x, z, ground, CLAMP_PAD);
    const tile = tileZ * this.cols + tileX;
    this.roadTerrainTile(tile);
    const clamp = this.roadClamp.get(tile);
    return clamp ? clamp[j * ROAD_TERRAIN_STRIDE + i] : NaN;
  }

  _buildRoadTerrain(tile) {
    const grade = this.roadGrade;
    const S = ROAD_TERRAIN_STEP, W = ROAD_TERRAIN_STRIDE;
    const x0 = this.minX + (tile % this.cols) * CHUNK, z0 = this.minZ + Math.floor(tile / this.cols) * CHUNK;
    const reach = this.maxRoadHalfWidth + CORRIDOR_MARGIN + CORRIDOR_FALLOFF;
    const weight = new Float32Array(W * W), target = new Float32Array(W * W), carriageway = new Uint8Array(W * W);
    const fade = new Float32Array(W * W);
    const clamp = new Float32Array(W * W).fill(NaN), near = new Uint8Array(W * W);
    const sharedY = new Float32Array(W * W), sharedDone = new Uint8Array(W * W), kept = new Int8Array(W * W).fill(-1);
    let clamped = false;
    const distance = new Float32Array(W * W), halfWidth = new Float32Array(W * W), shore = new Float32Array(W * W);
    const seen = new Set();
    const c0 = Math.max(0, Math.floor((x0 - reach - this.minX) / COLL_CELL)), c1 = Math.min(this.gcols - 1, Math.floor((x0 + CHUNK + reach - this.minX) / COLL_CELL));
    const r0 = Math.max(0, Math.floor((z0 - reach - this.minZ) / COLL_CELL)), r1 = Math.min(this.grows - 1, Math.floor((z0 + CHUNK + reach - this.minZ) / COLL_CELL));
    for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) {
      const cell = row * this.gcols + col;
      for (let j = this.segCellStart[cell]; j < this.segCellStart[cell + 1]; j++) {
        const k = this.segCellItems[j];
        if (seen.has(k)) continue;
        seen.add(k);
        const road = this.roadOfPt[k];
        if (grade.start[road] < 0) continue;
        const ax = this.rpx[k], az = this.rpz[k], ex = this.rpx[k + 1] - ax, ez = this.rpz[k + 1] - az;
        const l2 = ex * ex + ez * ez;
        if (!l2) continue;
        const hw = this.r.w[road] / 2, far = hw + CORRIDOR_MARGIN + CORRIDOR_FALLOFF;
        const i0 = Math.max(0, Math.ceil((Math.min(ax, ax + ex) - far - x0) / S)), i1 = Math.min(W - 1, Math.floor((Math.max(ax, ax + ex) + far - x0) / S));
        const j0 = Math.max(0, Math.ceil((Math.min(az, az + ez) - far - z0) / S)), j1 = Math.min(W - 1, Math.floor((Math.max(az, az + ez) + far - z0) / S));
        for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) {
          const x = x0 + ii * S, z = z0 + jj * S;
          const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2));
          const d = Math.hypot(ax + ex * t - x, az + ez * t - z);
          const w = corridorWeight(d, hw);
          const index = jj * W + ii;
          const station = grade.station[k] + t * (grade.station[k + 1] - grade.station[k]);
          // příčný sklon: na vozovce, za okrajem na nižší straně dál dolů (terén tam leží pod pásem)
          const slope = grade.cross ? gradeCross(grade, road, station) : 0;
          const u = (ex * (z - az - ez * t) - ez * (x - ax - ex * t)) < 0 ? -d : d;
          const cross = Math.min(slope * Math.max(-hw, Math.min(hw, u)), slope * u);
          // nejnižší pás vozovky nad uzlem (terén pod ním nesmí prorůstat)
          if (d <= hw + NEAR_PAD) {
            let surface = gradeSurface(grade, road, station, NaN) + cross;
            if (surface === surface) near[index] = 1;
            // Za okrajem pásu se terén nesnižuje u konců mostů, tunelů a ramp: silnice tam leží přímo
            // na terénu kalibrovaném podle měření a pás nemá. (Ručně upravený terén mimoúrovňových
            // křížení se snižuje dál, vedle silnic tam bývá násep, který by do pásu prorůstal.)
            if (d > hw && d <= hw + CLAMP_PAD && kept[index] < 0) kept[index] = this.keepsTerrain(x, z) === 1 ? 1 : 0;
            if (d <= hw + CLAMP_PAD && surface === surface && !(d > hw && kept[index])) {
              // v křižovatce podle společné výšky pásů (viz stripClampY)
              if (d <= hw) {
                // uzel na vozovce: společná výška křižovatky v uzlu je stejná pro všechny silnice
                if (!sharedDone[index]) {
                  sharedDone[index] = 1;
                  sharedY[index] = this.inJunction(x, z) ? this.junctionSurfaceAt(x, z) : NaN;
                }
                if (sharedY[index] === sharedY[index]) surface = sharedY[index];
              } else surface = this.stripClampY(road, k, t, x, z, surface);
              if (surface < clamp[index] || clamp[index] !== clamp[index]) {
                clamp[index] = surface;
                clamped = true;
              }
            }
          }
          if (w <= weight[index]) continue;
          const goal = gradeHeight(grade, road, station) + cross;
          if (goal !== goal) continue;                    // ručně doladěný úsek
          fade[index] = gradeBlend(grade, road, station);
          weight[index] = w;
          carriageway[index] = d <= hw ? 1 : 0;
          distance[index] = d; halfWidth[index] = hw;
          target[index] = goal;
          shore[index] = gradeShore(grade, road, station);
        }
      }
    }
    // U domů zůstává terén beze změny (vchody a prahy leží na původní výšce chodníku).
    const BUILDING_CLEARANCE = 4;
    const tx = tile % this.cols, tz = Math.floor(tile / this.cols), B = this.b;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const cx = tx + dx, cz = tz + dz;
      if (cx < 0 || cz < 0 || cx >= this.cols || cz >= this.rows) continue;
      for (const building of this.bChunks[cz * this.cols + cx] ?? []) {
        if (this.bMaxX[building] < x0 - BUILDING_CLEARANCE || this.bMinX[building] > x0 + CHUNK + BUILDING_CLEARANCE ||
          this.bMaxZ[building] < z0 - BUILDING_CLEARANCE || this.bMinZ[building] > z0 + CHUNK + BUILDING_CLEARANCE) continue;
        for (let r = B.bRing[building]; r < B.bRing[building + 1]; r++) {
          const v0 = B.ringStart[r], v1 = B.ringStart[r + 1];
          for (let v = v0; v < v1; v++) {
            const u = v + 1 < v1 ? v + 1 : v0;
            const ax = this.bvx[v], az = this.bvz[v], ex = this.bvx[u] - ax, ez = this.bvz[u] - az, l2 = ex * ex + ez * ez;
            const i0 = Math.max(0, Math.ceil((Math.min(ax, ax + ex) - BUILDING_CLEARANCE - x0) / S));
            const i1 = Math.min(W - 1, Math.floor((Math.max(ax, ax + ex) + BUILDING_CLEARANCE - x0) / S));
            const j0 = Math.max(0, Math.ceil((Math.min(az, az + ez) - BUILDING_CLEARANCE - z0) / S));
            const j1 = Math.min(W - 1, Math.floor((Math.max(az, az + ez) + BUILDING_CLEARANCE - z0) / S));
            for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) {
              const index = jj * W + ii;
              if (!weight[index]) continue;
              // Na nábřeží s rozmazanou zdí leží i terén u domu pod vozovkou zvednutou na ulici.
              if (shore[index] > SHORE_FILL) continue;
              const x = x0 + ii * S, z = z0 + jj * S;
              const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)) : 0;
              if (Math.hypot(ax + ex * t - x, az + ez * t - z) <= BUILDING_CLEARANCE) weight[index] = 0;
            }
          }
        }
      }
    }
    // terén pod asfaltem zaobleného rohu leží pod ním (a fyzika tam má jemnou síť)
    const col = tile % this.cols, row = Math.floor(tile / this.cols), nearby = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (col + dx < 0 || row + dz < 0 || col + dx >= this.cols || row + dz >= this.rows) continue;
      nearby.push(...(this.cornerTiles?.get((row + dz) * this.cols + col + dx) ?? []));
    }
    for (const corner of nearby) {
      const [cx0, cz0, cx1, cz1] = corner.box;
      if (cx1 < x0 || cx0 > x0 + CHUNK || cz1 < z0 || cz0 > z0 + CHUNK) continue;
      const i0 = Math.max(0, Math.floor((cx0 - x0) / S)), i1 = Math.min(W - 1, Math.ceil((cx1 - x0) / S));
      const j0 = Math.max(0, Math.floor((cz0 - z0) / S)), j1 = Math.min(W - 1, Math.ceil((cz1 - z0) / S));
      for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) {
        const x = x0 + ii * S, z = z0 + jj * S;
        if (!insidePolygon(corner.polygon, x, z)) continue;
        const index = jj * W + ii, y = this.cornerY(corner, x, z, true) - SURF;
        if (y === y && !(clamp[index] <= y)) { clamp[index] = y; clamped = true; }
        near[index] = 1;
      }
    }
    this.roadClamp.set(tile, clamped ? clamp : null);
    this.roadNear.set(tile, clamped ? near : null);
    let any = false;
    const grid = new Int16Array(W * W);
    for (let jj = 0; jj < W; jj++) for (let ii = 0; ii < W; ii++) {
      const index = jj * W + ii, w = weight[index];
      if (!w) continue;
      if (this.keepsTerrain(x0 + ii * S, z0 + jj * S)) continue;
      const base = this.terrainHeightAt(x0 + ii * S, z0 + jj * S);
      let goal = target[index];
      // Svah těsně u vozovky výš než silnice: dlaždice potřebuje jemnější síť terénu.
      if (!carriageway[index] && distance[index] <= halfWidth[index] + 2 && base - goal > STEEP_CUT) this.roadSteepTiles.add(tile);
      // u chráněných míst a volných konců se úprava plynule ztrácí
      let strength = w * fade[index];
      if (!carriageway[index] && base > goal) {
        // Svah nad silnicí: pata se odřízne (krajnice nejvýš 5 cm nad vozovkou, dál mírný
        // sklon 15 %), aby trojúhelníky svahu nezasahovaly do vozovky. Jen snížení, bez náspu.
        // Na nižší straně silnice s příčným sklonem se měří od roviny vozovky prodloužené za
        // okraj (cíl už ji obsahuje), jinak by svah zasahoval do pásu.
        goal = Math.min(base, goal + 0.05 + 0.15 * Math.max(0, distance[index] - halfWidth[index] - 1.5));
        strength = fade[index];
      } else if (!carriageway[index] && goal - base > 0.3) {
        // Jiná úroveň (opěrná zeď, násep) zůstává. Na nábřeží se ale terén dosype i za okraj
        // vozovky směrem k vodě (ne do ní), ať asfalt nevisí nad rozmazanou nábřežní zdí.
        if (!(shore[index] > SHORE_FILL) || this.inWaterArea(x0 + ii * S, z0 + jj * S)) continue;
      }
      if (goal === base) continue;
      const offset = Math.round(100 * strength * (goal - base));
      if (offset) { grid[index] = Math.max(-32000, Math.min(32000, offset)); any = true; }
    }
    return any ? grid : null;
  }

  /** Výška příslušné silnice, i když stejným bodem prochází jiná úroveň. */
  roadSurfaceY(road, seg, t, x, z) {
    if (this.r.flags[road] & RF.BRIDGE || this.elevatedWidths?.has(road) || this.tunnelRoads?.has(road)) {
      return this.rpy[seg] + (this.rpy[seg + 1] - this.rpy[seg]) * t;
    }
    const entry = this.upperApproaches?.get(road);
    if (entry) {
      const k = seg - this.rOff[road], s = entry.stations[k] + t * (entry.stations[k+1] - entry.stations[k]);
      const y = approachHeight(entry, s);
      if (Number.isFinite(y)) return y;
    }
    const graded = this.roadGradeY(road, seg, t);
    let terrain;
    if (graded !== graded) terrain = this.heightAt(x, z) + SURF;
    else {
      const grade = this.roadGrade, b = gradeBlend(grade, road, grade.station[seg] + t * (grade.station[seg + 1] - grade.station[seg]));
      let surface = b >= 1 ? graded + this.roadCrossAt(road, seg, t, x, z) : this.heightAt(x, z);
      if (b >= 1 && this.inJunction(x, z)) {
        const shared = this.junctionSurfaceAt(x, z);
        if (shared === shared) surface = shared;
      }
      terrain = surface + SURF;
    }
    const apron = this.roadApproach;
    if (apron?.road === road && apron.seg === seg && t >= apron.startT) {
      const y = apron.path.y;
      return Math.max(terrain, y[0] + (y.at(-1) - y[0]) * (1 - t) / (1 - apron.startT));
    }
    return terrain;
  }

  /** Zahrnuje celou šířku všech překrývajících se vozovek v téže výšce i asfalt zaoblených rohů. */
  onCarriageway(x, z, y, padding = 0, maxClass = DRIVABLE_MAX, upper = y + 2.5) {
    const inHeight = level => level > y - 2.5 && level < upper;
    const corner = this.cornerAsphaltAt(x, z);
    if (corner && inHeight(this.cornerY(corner, x, z))) return true;
    const range = this.maxRoadHalfWidth + padding;
    const minCol = Math.max(0, Math.floor((x - range - this.minX) / COLL_CELL));
    const maxCol = Math.min(this.gcols - 1, Math.floor((x + range - this.minX) / COLL_CELL));
    const minRow = Math.max(0, Math.floor((z - range - this.minZ) / COLL_CELL));
    const maxRow = Math.min(this.grows - 1, Math.floor((z + range - this.minZ) / COLL_CELL));
    for (let row = minRow; row <= maxRow; row++) for (let col = minCol; col <= maxCol; col++) {
      const cell = row * this.gcols + col;
      for (let j = this.segCellStart[cell]; j < this.segCellStart[cell + 1]; j++) {
        const k = this.segCellItems[j], road = this.roadOfPt[k];
        if (this.r.cls[road] > maxClass) continue;
        const ax = this.rpx[k], az = this.rpz[k], dx = this.rpx[k + 1] - ax, dz = this.rpz[k + 1] - az;
        const length2 = dx * dx + dz * dz;
        const t = length2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / length2)) : 0;
        const px = ax + t * dx, pz = az + t * dz;
        if ((px - x) ** 2 + (pz - z) ** 2 <= (this.r.w[road] / 2 + padding) ** 2 &&
            inHeight(this.roadSurfaceY(road, k, t, px, pz))) return true;
      }
    }
    return false;
  }

  /** Je bod na vozovce / cestě? (s tolerancí) */
  onRoad(x, z, extra = 0.5) {
    const r = this.nearestRoad(x, z, 14, 99, 0, this._tmpRoad || (this._tmpRoad = {}));
    return !!r && r.dist <= this.r.w[r.road] / 2 + extra;
  }

  // -------------------------------------------------------------- graf ----
  _initGraph() {
    const R = this.r, px = this.rpx, pz = this.rpz, pOff = this.rOff;
    const key = (k) => {
      const coord = (Math.round(px[k] * 10) + KEY_OFF) * KEY_MUL + (Math.round(pz[k] * 10) + KEY_OFF);
      const road = this.roadOfPt?.[k];
      // Ve stejné souřadnici se s povrchem propojí jen konce tunelu u portálů.
      return this.tunnelRoads?.has(road) && k > pOff[road] && k < pOff[road + 1] - 1 ? -coord - 1 : coord;
    };
    const uses = new Map();
    const drivable = (i) => R.cls[i] <= DRIVABLE_MAX;
    for (let i = 0; i < this.rCount; i++) {
      if (!drivable(i)) continue;
      const a = pOff[i], b = pOff[i + 1] - 1;
      for (let k = a; k <= b; k++) {
        const kk = key(k);
        uses.set(kk, (uses.get(kk) || 0) + (k === a || k === b ? 2 : 1));
      }
    }
    const nodeId = new Map();
    const nodeX = [], nodeZ = [];
    const getNode = (k) => {
      const kk = key(k);
      let id = nodeId.get(kk);
      if (id === undefined) { id = nodeX.length; nodeId.set(kk, id); nodeX.push(px[k]); nodeZ.push(pz[k]); }
      return id;
    };
    const eFrom = [], eTo = [], eA = [], eB = [], eLen = [], eRoad = [];
    for (let i = 0; i < this.rCount; i++) {
      if (!drivable(i)) continue;
      const a = pOff[i], b = pOff[i + 1] - 1;
      let s = a, len = 0;
      for (let k = a + 1; k <= b; k++) {
        len += Math.hypot(px[k] - px[k - 1], pz[k] - pz[k - 1]);
        if (k === b || uses.get(key(k)) >= 2) {
          if (len > 0.5) {
            const n0 = getNode(s), n1 = getNode(k);
            eFrom.push(n0); eTo.push(n1); eA.push(s); eB.push(k); eLen.push(len); eRoad.push(i);
            if (!(R.flags[i] & RF.ONEWAY)) {
              eFrom.push(n1); eTo.push(n0); eA.push(k); eB.push(s); eLen.push(len); eRoad.push(i);
            }
          }
          s = k; len = 0;
        }
      }
    }
    const nN = nodeX.length, nE = eFrom.length;
    this.nodeX = Float32Array.from(nodeX); this.nodeZ = Float32Array.from(nodeZ);
    this.eFrom = Uint32Array.from(eFrom); this.eTo = Uint32Array.from(eTo);
    this.eA = Uint32Array.from(eA); this.eB = Uint32Array.from(eB);
    this.eLen = Float32Array.from(eLen); this.eRoad = Uint32Array.from(eRoad);
    this.junctionArms = new Uint16Array(nN);
    this.junctionHalfWidth = new Float32Array(nN);
    for (let e = 0; e < nE; e++) {
      if (eA[e] >= eB[e]) continue;
      const half = R.w[eRoad[e]] / 2;
      for (const node of [eFrom[e], eTo[e]]) {
        this.junctionArms[node]++;
        this.junctionHalfWidth[node] = Math.max(this.junctionHalfWidth[node], half);
      }
    }
    const outStart = new Uint32Array(nN + 1);
    for (let e = 0; e < nE; e++) outStart[this.eFrom[e] + 1]++;
    for (let i = 1; i <= nN; i++) outStart[i] += outStart[i - 1];
    const outEdges = new Uint32Array(nE);
    const fill = new Uint32Array(nN);
    for (let e = 0; e < nE; e++) { const f = this.eFrom[e]; outEdges[outStart[f] + fill[f]++] = e; }
    this.outStart = outStart; this.outEdges = outEdges;
    this.nodeCount = nN; this.edgeCount = nE;
    this.nodeOfKey = nodeId;

    // hrany vhodné pro běžný provoz, po dlaždicích
    const trafficEdges = new Array(this.cols * this.rows);
    const edgeOfSeg = new Map();
    for (let e = 0; e < nE; e++) {
      const i = this.eRoad[e];
      const lo = Math.min(this.eA[e], this.eB[e]);
      if (!edgeOfSeg.has(lo) || this.eA[e] < this.eB[e]) edgeOfSeg.set(lo, e);
      const cls = R.cls[i];
      if (cls > RC.LIVING || (R.flags[i] & (RF.PRIVATE | RF.TUNNEL))) continue;
      if (this.eLen[e] < 12) continue;
      const mid = (this.eA[e] + this.eB[e]) >> 1;
      const ci = this.chunkIndex(px[mid], pz[mid]);
      if (ci >= 0) (trafficEdges[ci] || (trafficEdges[ci] = [])).push(e);
    }
    this.trafficEdges = trafficEdges;
    this.edgeOfStart = edgeOfSeg;
    // pro každý bod silnice: hrana (v dopředném směru), do které patří
    const edgeOfPt = new Int32Array(px.length).fill(-1);
    for (let e = 0; e < nE; e++) {
      if (this.eA[e] < this.eB[e]) for (let k = this.eA[e]; k < this.eB[e]; k++) edgeOfPt[k] = e;
    }
    this.edgeOfPt = edgeOfPt;
  }

  /** Vrátí id zpětné hrany k dané hraně, nebo -1. */
  reverseEdge(e) {
    const a = this.eFrom[e], b = this.eTo[e], A = this.eA[e], B = this.eB[e];
    for (let q = this.outStart[b], qe = this.outStart[b + 1]; q < qe; q++) {
      const f = this.outEdges[q];
      if (this.eTo[f] === a && this.eA[f] === B && this.eB[f] === A) return f;
    }
    return -1;
  }

  /** Zda by parkování u kraje této silnice zabralo místo potřebné pro odbočení. */
  blocksStreetCorner(edge, x, z, yaw, length, width) {
    if (edge < 0) return false;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (const node of [this.eFrom[edge], this.eTo[edge]]) {
      if (this.junctionArms[node] < 3) continue;
      const dx = this.nodeX[node] - x, dz = this.nodeZ[node] - z;
      const along = Math.max(0, Math.abs(dx * fx + dz * fz) - length / 2);
      const across = Math.max(0, Math.abs(dx * fz - dz * fx) - width / 2);
      if (Math.hypot(along, across) < this.junctionHalfWidth[node] + 5) return true;
    }
    return false;
  }

  roadSpeed(road, forward) {
    return (forward ? this.r.speedForward : this.r.speedBackward)?.[road] ?? this.r.speed[road];
  }

  turnContext(from, to, context = 0) {
    if (this.r.flags[this.eRoad[to]] & RF.PRIVATE) return -1;
    return this.turns?.advance(from, to, context) ?? 0;
  }

  /** Bod na hraně ve vzdálenosti d od jejího začátku (ve směru jízdy), s bočním posunem vpravo. */
  edgePoint(e, d, side, out) {
    const px = this.rpx, pz = this.rpz;
    const A = this.eA[e], B = this.eB[e];
    const step = A < B ? 1 : -1;
    let k = A, x = px[A], z = pz[A], tx = 0, tz = 1;
    for (; k !== B; k += step) {
      const nx = px[k + step], nz = pz[k + step];
      const l = Math.hypot(nx - px[k], nz - pz[k]);
      if (l > 1e-6) { tx = (nx - px[k]) / l; tz = (nz - pz[k]) / l; }
      if (d <= l || k + step === B) {
        const t = l > 0 ? Math.min(d, l) / l : 0;
        x = px[k] + (nx - px[k]) * t; z = pz[k] + (nz - pz[k]) * t;
        out.seg = Math.min(k, k + step);
        out.t = step > 0 ? t : 1 - t;
        break;
      }
      d -= l;
    }
    // pravá strana ve směru jízdy (x východ, z jih): (−tz, tx)
    out.x = x - tz * side; out.z = z + tx * side; out.tx = tx; out.tz = tz;
    return out;
  }

  /** Nejbližší uzel grafu k bodu (přes nejbližší sjízdnou silnici). */
  nearestNode(x, z, maxDist = 150, y) {
    const r = this.nearestRoad(x, z, maxDist, DRIVABLE_MAX, 0, this._tmpRoad2 || (this._tmpRoad2 = {}), y, true);
    if (!r) return -1;
    let e = this.edgeOfPt[r.seg];
    if (e < 0) return -1;
    if (y !== undefined && this.tunnelRoads.has(r.road)) return this.eTo[e];
    const dA = Math.hypot(this.nodeX[this.eFrom[e]] - x, this.nodeZ[this.eFrom[e]] - z);
    const dB = Math.hypot(this.nodeX[this.eTo[e]] - x, this.nodeZ[this.eTo[e]] - z);
    return dA < dB ? this.eFrom[e] : this.eTo[e];
  }

  /** A* – vrátí pole hran z uzlu a do uzlu b (nebo null). */
  findPath(a, b, maxExpand = 6000, incoming = -1, initialContext = 0) {
    if (a < 0 || b < 0) return null;
    if (a === b) return [];
    const best = new Map();
    const stateKey = (node, edge, context) => (context || this.turns?.relevant(edge))
      ? this.nodeCount + context * this.edgeCount + edge : node;
    const heap = [];        // dvojice (f, uzel)
    const push = (f, n) => {
      let i = heap.length; heap.push(f, n);
      while (i > 0) {
        const p = ((i >> 1) - 1 >> 1) << 1;
        if (heap[p] <= f) break;
        heap[i] = heap[p]; heap[i + 1] = heap[p + 1]; heap[p] = f; heap[p + 1] = n; i = p;
      }
    };
    const pop = () => {
      const n = heap[1];
      const lf = heap[heap.length - 2], ln = heap[heap.length - 1];
      heap.length -= 2;
      if (heap.length) {
        let i = 0; heap[0] = lf; heap[1] = ln;
        for (;;) {
          let l = i * 2 + 2, r = l + 2, m = i;
          if (l < heap.length && heap[l] < heap[m]) m = l;
          if (r < heap.length && heap[r] < heap[m]) m = r;
          if (m === i) break;
          const tf = heap[i], tn = heap[i + 1];
          heap[i] = heap[m]; heap[i + 1] = heap[m + 1]; heap[m] = tf; heap[m + 1] = tn; i = m;
        }
      }
      return n;
    };
    const bx = this.nodeX[b], bz = this.nodeZ[b];
    const start = stateKey(a, incoming, initialContext);
    best.set(start, { score: 0, node: a, edge: incoming, context: initialContext, previous: null });
    push(Math.hypot(this.nodeX[a] - bx, this.nodeZ[a] - bz), start);
    let expanded = 0;
    const closed = new Set();
    while (heap.length) {
      const key = pop();
      if (closed.has(key)) continue;
      const state = best.get(key), n = state.node;
      if (n === b) {
        const path = [];
        for (let at = state; at.previous; at = at.previous) path.push(at.edge);
        return path.reverse();
      }
      closed.add(key);
      if (++expanded > maxExpand) return null;
      for (let q = this.outStart[n], qe = this.outStart[n + 1]; q < qe; q++) {
        const e = this.outEdges[q], m = this.eTo[e];
        const context = this.turnContext(state.edge, e, state.context);
        if (context < 0) continue;
        const road = this.eRoad[e];
        const cost = this.eLen[e] * (this.r.cls[road] >= RC.SERVICE ? 1.6 : 1);
        const next = stateKey(m, e, context), score = state.score + cost;
        if (score < (best.get(next)?.score ?? Infinity)) {
          best.set(next, { score, node: m, edge: e, context, previous: state });
          push(score + Math.hypot(this.nodeX[m] - bx, this.nodeZ[m] - bz), next);
        }
      }
    }
    return null;
  }

  // ------------------------------------------------------------ plochy ----
  /** Vodní plochy pro přesný test a hrany jejich břehů po buňkách SHORE_CELL (bez plátna). */
  _initWater(L) {
    this.l = L;
    const n = L.header.count;
    this.lCount = n;
    const water = [], shore = new Map();
    for (let i = 0; i < n; i++) {
      if (L.cls[i] !== LC.WATER) continue;
      const r0 = L.pRing[i], r1 = L.pRing[i + 1];
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (let v = L.ringStart[r0], ve = L.ringStart[r0 + 1]; v < ve; v++) {
        const x = L.vx[v] * 0.1, z = L.vz[v] * 0.1;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
      }
      if (this.gardenWaterLand && museumWaterPolygon(x0,z0,x1,z1)) {
        this.gardenWaterLand.add(i);
        continue;
      }
      if (this.fountainLand && isFountainPool(x0,z0,x1,z1)) {
        this.fountainLand.add(i);
        continue;
      }
      water.push({ i, x0, x1, z0, z1 });
      for (let r = r0; r < r1; r++) {
        const start = L.ringStart[r], end = L.ringStart[r + 1];
        for (let a = end - 1, b = start; b < end; a = b++) {
          const ax = L.vx[a] * 0.1, az = L.vz[a] * 0.1, bx = L.vx[b] * 0.1, bz = L.vz[b] * 0.1;
          for (let cz = Math.floor(Math.min(az, bz) / SHORE_CELL); cz <= Math.floor(Math.max(az, bz) / SHORE_CELL); cz++) {
            for (let cx = Math.floor(Math.min(ax, bx) / SHORE_CELL); cx <= Math.floor(Math.max(ax, bx) / SHORE_CELL); cx++) {
              const key = shoreKey(cx, cz);
              if (!shore.has(key)) shore.set(key, []);
              shore.get(key).push(ax, az, bx, bz);
            }
          }
        }
      }
    }
    this.water = water;
    this.shoreCells = shore;
  }

  /** Nejbližší bod břehové čáry do vzdálenosti reach: [x, z, vzdálenost], nebo null. */
  nearestShore(x, z, reach) {
    const cells = this.shoreCells;
    if (!cells?.size) return null;
    let best = reach * reach, bx = NaN, bz = NaN;
    for (let cz = Math.floor((z - reach) / SHORE_CELL); cz <= Math.floor((z + reach) / SHORE_CELL); cz++) {
      for (let cx = Math.floor((x - reach) / SHORE_CELL); cx <= Math.floor((x + reach) / SHORE_CELL); cx++) {
        const list = cells.get(shoreKey(cx, cz));
        if (!list) continue;
        for (let k = 0; k < list.length; k += 4) {
          const ax = list[k], az = list[k + 1], ex = list[k + 2] - ax, ez = list[k + 3] - az, l2 = ex * ex + ez * ez;
          const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)) : 0;
          const d2 = (ax + ex * t - x) ** 2 + (az + ez * t - z) ** 2;
          if (d2 < best) { best = d2; bx = ax + ex * t; bz = az + ez * t; }
        }
      }
    }
    return bx === bx ? [bx, bz, Math.sqrt(best)] : null;
  }

  /** Leží bod ve vodní ploše? Přesný test bez hrubé masky. */
  inWaterArea(x, z) {
    for (const w of this.water ?? []) {
      if (x < w.x0 || x > w.x1 || z < w.z0 || z > w.z1) continue;
      if (this.landContains(w.i, x, z)) return true;
    }
    return false;
  }

  /**
   * O kolik zvednout profil silnice road v bodě (x, z) s normálou (nx, nz), když vede podél břehu
   * a výškový model do ní rozmazal nábřežní zeď (viz shoreLift). Voda musí ležet z boku silnice
   * nejvýš SHORE_WATER za okrajem vozovky, dál se zvednutí plynule ztrácí.
   */
  shoreLiftAt(road, x, z, nx, nz) {
    const hw = this.r.w[road] / 2, range = hw + SHORE_WATER + SHORE_FADE;
    // Většina silnic k vodě nevede: rychlé vyřazení celé silnice podle buněk s hranami břehu.
    const near = this._shoreRoads ??= new Uint8Array(this.rCount);
    if (!near[road]) {
      near[road] = 1;
      for (let k = this.rOff[road]; k + 1 < this.rOff[road + 1] && near[road] === 1; k++) {
        const ax = this.rpx[k], az = this.rpz[k], bx = this.rpx[k + 1], bz = this.rpz[k + 1];
        for (let cz = Math.floor((Math.min(az, bz) - range) / SHORE_CELL); cz <= Math.floor((Math.max(az, bz) + range) / SHORE_CELL); cz++) {
          for (let cx = Math.floor((Math.min(ax, bx) - range) / SHORE_CELL); cx <= Math.floor((Math.max(ax, bx) + range) / SHORE_CELL); cx++) {
            if (this.shoreCells.has(shoreKey(cx, cz))) { near[road] = 2; break; }
          }
          if (near[road] === 2) break;
        }
      }
    }
    if (near[road] === 1) return 0;
    const shore = this.nearestShore(x, z, range);
    if (!shore || shore[2] < 0.1) return 0;
    const ux = (x - shore[0]) / shore[2], uz = (z - shore[1]) / shore[2];
    const side = ux * nx + uz * nz;
    const across = Math.abs(side);
    if (across <= 0.5) return 0;
    const reach = hw + SHORE_REACH, n = SHORE_BACK + Math.round(reach) + SHORE_PLATEAU;
    const land = this._shoreLand ??= [];
    land.length = n + 1;
    const sx = Math.sign(side) * nx, sz = Math.sign(side) * nz;
    for (let i = 0; i <= n; i++) land[i] = this.terrainHeightAt(x + sx * (i - SHORE_BACK), z + sz * (i - SHORE_BACK));
    const lift = shoreLift(land, reach);
    if (!lift || this.inWaterArea(x, z)) return 0;
    const lateral = Math.min(1, (across - 0.5) / 0.2), far = Math.max(0, Math.min(1, (shore[2] - hw - SHORE_WATER) / SHORE_FADE));
    return lift * lateral * lateral * (3 - 2 * lateral) * (1 - far * far * (3 - 2 * far));
  }

  _initLand(L) {
    this._initWater(L);
    const n = L.header.count;

    // hrubá maska povrchů: bit 1 = les, 2 = měkký povrch (tráva, pole), 4 = voda (~10 m na bod)
    const S = 2048;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'lighter';
    const sx = S / (this.maxX - this.minX), sz = S / (this.maxZ - this.minZ);
    const soft = new Set([LC.FARMLAND, LC.MEADOW, LC.GRASS, LC.ALLOTMENTS, LC.FOREST, LC.SCRUB, LC.PARK, LC.GARDEN, LC.CEMETERY, LC.PITCH]);
    for (let i = 0; i < n; i++) {
      if (this.fountainLand?.has(i) || this.gardenWaterLand?.has(i)) continue;
      const c = L.cls[i];
      let col = null;
      if (c === LC.FOREST) col = '#ff0000';
      else if (c === LC.WATER) col = '#0000ff';
      if (soft.has(c)) col = col ? '#ffff00' : '#00ff00';
      if (!col) continue;
      g.beginPath();
      for (let rg = L.pRing[i], r1 = L.pRing[i + 1]; rg < r1; rg++) {
        const v0 = L.ringStart[rg], v1 = L.ringStart[rg + 1];
        for (let v = v0; v < v1; v++) {
          const x = (L.vx[v] * 0.1 - this.minX) * sx, z = (L.vz[v] * 0.1 - this.minZ) * sz;
          if (v === v0) g.moveTo(x, z); else g.lineTo(x, z);
        }
        g.closePath();
      }
      g.fillStyle = col;
      g.fill('evenodd');
    }
    const img = g.getImageData(0, 0, S, S).data;
    const mask = new Uint8Array(S * S);
    for (let i = 0; i < S * S; i++) {
      mask[i] = (img[i * 4] > 127 ? 1 : 0) | (img[i * 4 + 1] > 127 ? 2 : 0) | (img[i * 4 + 2] > 40 ? 4 : 0);
    }
    this.mask = mask; this.maskS = S; this.maskSX = sx; this.maskSZ = sz;
  }

  maskAt(x, z) {
    const mx = Math.floor((x - this.minX) * this.maskSX), mz = Math.floor((z - this.minZ) * this.maskSZ);
    if (mx < 0 || mz < 0 || mx >= this.maskS || mz >= this.maskS) return 0;
    return this.mask[mz * this.maskS + mx];
  }

  isForest(x, z) { return (this.maskAt(x, z) & 1) !== 0; }
  isSoft(x, z) { return (this.maskAt(x, z) & 2) !== 0; }

  landContains(i, x, z) {
    const L = this.l;
    let inside = false;
    for (let rg = L.pRing[i], r1 = L.pRing[i + 1]; rg < r1; rg++) {
      const v0 = L.ringStart[rg], v1 = L.ringStart[rg + 1];
      let j = v1 - 1;
      for (let v = v0; v < v1; j = v++) {
        const z1 = L.vz[j] * 0.1, z2 = L.vz[v] * 0.1;
        if ((z1 > z) !== (z2 > z)) {
          const x1 = L.vx[j] * 0.1, x2 = L.vx[v] * 0.1;
          if (x < (x2 - x1) * (z - z1) / (z2 - z1) + x1) inside = !inside;
        }
      }
    }
    return inside;
  }

  isWater(x, z) {
    // rychlé vyloučení přes hrubou masku (včetně sousedních pixelů)
    const px = 1 / this.maskSX;
    if (!((this.maskAt(x, z) | this.maskAt(x + px, z) | this.maskAt(x - px, z) | this.maskAt(x, z + px) | this.maskAt(x, z - px)) & 4)) return false;
    for (const w of this.water) {
      if (x < w.x0 || x > w.x1 || z < w.z0 || z > w.z1) continue;
      if (this.landContains(w.i, x, z)) return true;
    }
    return false;
  }

  // ------------------------------------------------------------ koleje ----
  _initRails(R) {
    const n = R.header.count;
    this.rails = [];
    this.tramTracks = [];
    const lists = new Array(this.cols * this.rows);
    for (let i = 0; i < n; i++) {
      const cnt = R.start[i + 1] - R.start[i] + 1;
      const pts = new Float32Array(cnt * 2);
      let x = R.x0[i], z = R.z0[i];
      pts[0] = x * 0.1; pts[1] = z * 0.1;
      let o = 2;
      for (let k = R.start[i], ke = R.start[i + 1]; k < ke; k++) {
        x += R.dx[k]; z += R.dz[k];
        pts[o++] = x * 0.1; pts[o++] = z * 0.1;
      }
      const rail = { cls: R.cls[i], flags: R.flags[i], pts, y: null };
      const bo = R.bridgeOff ? R.bridgeOff[i] : 0xFFFFFFFF;
      if (bo !== 0xFFFFFFFF) {
        rail.y = new Float32Array(cnt);
        for (let k = 0; k < cnt; k++) rail.y[k] = R.bridgeY[bo + k] * 0.02;
      }
      this.rails.push(rail);
      if (rail.cls === 0) {
        let minX = pts[0], maxX = minX, minZ = pts[1], maxZ = minZ;
        for (let k = 2; k < pts.length; k += 2) {
          minX = Math.min(minX, pts[k]); maxX = Math.max(maxX, pts[k]);
          minZ = Math.min(minZ, pts[k + 1]); maxZ = Math.max(maxZ, pts[k + 1]);
        }
        this.tramTracks.push({ rail, minX, maxX, minZ, maxZ });
      }
      const mid = (cnt >> 1) * 2;
      const ci = this.chunkIndex(pts[mid], pts[mid + 1]);
      if (ci >= 0) (lists[ci] || (lists[ci] = [])).push(i);
    }
    this.railChunks = lists;
  }

  /** Zda by zaparkovaná karoserie zasahovala do průjezdného prostoru tramvaje. */
  blocksTramTrack(x, z, y, yaw, length, width) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const reach = Math.hypot(length, width) / 2 + 1.7;
    for (const { rail, minX, maxX, minZ, maxZ } of this.tramTracks) {
      if (x < minX - reach || x > maxX + reach || z < minZ - reach || z > maxZ + reach) continue;
      const p = rail.pts;
      for (let i = 2; i < p.length; i += 2) {
        const ax = p[i - 2] - x, az = p[i - 1] - z, dx = p[i] - p[i - 2], dz = p[i + 1] - p[i - 1];
        const length2 = dx * dx + dz * dz;
        if (!length2) continue;
        const t = Math.max(0, Math.min(1, -(ax * dx + az * dz) / length2));
        const ox = ax + t * dx, oz = az + t * dz;
        if (ox * ox + oz * oz > reach * reach) continue;
        const k = i / 2 - 1;
        const railY = rail.y ? rail.y[k] + t * (rail.y[k + 1] - rail.y[k]) : this.heightAt(x + ox, z + oz);
        if (Math.abs(railY - y) >= 2.5) continue;
        // Průměty na osy karoserie a na kolmici ke koleji. Započtena je i šířka tramvaje.
        const along = dx * fx + dz * fz, across = dx * fz - dz * fx;
        if (Math.abs(ax * fx + az * fz + along / 2) > length / 2 + Math.abs(along) / 2 + 1.7 ||
            Math.abs(ax * fz - az * fx + across / 2) > width / 2 + Math.abs(across) / 2 + 1.7) continue;
        if (Math.abs(ax * dz - az * dx) <=
            (length * Math.abs(across) + width * Math.abs(along)) / 2 + 1.7 * Math.sqrt(length2)) return true;
      }
    }
    return false;
  }

  _initTrees(T) {
    const lists = new Array(this.cols * this.rows);
    for (let i = 0; i < T.header.count; i++) {
      const ci = this.chunkIndex(T.x[i] * 0.1, T.z[i] * 0.1);
      if (ci >= 0) (lists[ci] || (lists[ci] = [])).push(i);
    }
    this.treeChunks = lists;
  }

  /** Název nejbližší čtvrti. */
  districtAt(x, z) {
    let best = 1e18, name = '';
    for (const p of this.meta.places) {
      if (p[3] === 'city') continue;
      const w = p[3] === 'suburb' ? 1.0 : 0.75;      // menší části mají přednost, když jsou blízko
      const d = ((p[0] - x) ** 2 + (p[1] - z) ** 2) * w;
      if (d < best) { best = d; name = p[2]; }
    }
    return best < 1500 * 1500 ? name : '';
  }
}
