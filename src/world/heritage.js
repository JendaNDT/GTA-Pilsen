import { gateSite } from './dominanty/gate-collision.js';
import { sheets, dressSurvey } from './dominanty/survey.js';
import { Exterior, exteriorMaterial } from './dominanty/mesh.js';
import { measuredDetails } from './dominanty/measured-details.js';
import { outerTiles, buildOuterSite } from './dominanty/outer-sites.js';
// Měřené městské dlaždice a vlastní model vodního hamru.
import { canopyTile, stationMaterials, stationSurfaces, stationTile } from './station-building.js';
import { alignTheatreTerrace, theatreMaterial, theatreSurfaces, theatreTile } from './theatre.js';
import { modernTheatreGeometry, modernTheatreMaterial, modernTheatreSite, modernTheatreTile } from './modern-theatre.js';
import { cathedralGeometry, cathedralHands, cathedralMaterial, cathedralTile } from './cathedral.js';
import { museumGeometry, museumMaterial, museumTile } from './museum.js';
import { hasSquareFronts, squareFrontGeometry, squareFrontMaterial } from './square-fronts.js';
import { hasNorthSquare, northSquareGeometry } from './north-square.js';
import { townHallClock, townHallGeometry, townHallMaterial, townHallTile } from './town-hall.js';
import { synagogueMaterial, synagogueSurface, synagogueTile } from './synagogue.js';
import { forecourtBounds } from './station-forecourt.js';
import * as THREE from 'three/webgpu';
import { CHUNK, PARAMS, QUALITY } from '../config.js';
import { SolidBuf } from './solid-buffer.js';
import { attachRoadFurniture } from './road-furniture.js';
import { drawStreetFixture, installStreetPaving, streetFixtures } from './street-furniture.js';
import { StreetDetails } from './street-details.js';
import { loadCityTile } from '../data.js';
import { HeritageRoofs } from './heritage-geometry.js';
import { env, makeBuildingMaterial, makeMillraceMaterial, makeSurfaceMaterial } from './materials.js';
import { SURFACE } from './material-table.js';
import { FORGE, buildForge, forgeRoofHeight } from './mill.js';

const showCathedral = PARAMS.get('katedrala') !== 'puvodni';
const showMuseum = PARAMS.get('muzeum') !== 'puvodni';
const showTownHall = PARAMS.get('radnice') !== 'puvodni';
const showTheatre = PARAMS.get('divadlo') !== 'puvodni';
const showNorthSquare = PARAMS.get('stity') !== 'puvodni';
const showSynagogue = PARAMS.get('synagoga') !== 'puvodni';
const stationTiles = new Set(PARAMS.get('pruceli') === 'puvodni' ? [] : [stationTile, canopyTile]);

export const detailRequestLimit = () => QUALITY.groundTex === 256 ? 2 : 4;

function cityMesh(pack, prefix) {
  const src = pack[prefix + 'p'];
  if (!src?.length) return null;
  const { cx, cz } = pack.header;
  const points = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    points[i] = cx + src[i] * 0.02;
    points[i + 1] = src[i + 1] * 0.02;
    points[i + 2] = cz + src[i + 2] * 0.02;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(pack[prefix + 'n'], 3, true));
  geometry.setAttribute('color', new THREE.BufferAttribute(pack[prefix + 'c'], 3, true));
  if (!prefix) {
    if (pack.street) {
      geometry.setAttribute('aStreet', new THREE.BufferAttribute(pack.street, 4));
      geometry.setAttribute('aEntrance', new THREE.BufferAttribute(pack.entrances, 1));
    }
    const win = Float32Array.from(pack.win, (v, i) => i % 3 === 2 ? v : v / 32);
    geometry.setAttribute('aWin', new THREE.BufferAttribute(win, 3));
  }
  geometry.setIndex(new THREE.BufferAttribute(pack[prefix + 'i'], 1));
  return geometry;
}

export class Heritage {
  constructor(world, manifest) {
    this.world = world;
    this.iconsEnabled = PARAMS.get('dominanty') !== 'puvodni';
    this.breweryGate = this.iconsEnabled ? gateSite(world) : null;
    this.outerSites = this.iconsEnabled ? outerTiles(world) : new Map();
    this.streets = world.streetDetails ? new StreetDetails(world.streetDetails) : null;
    world.heritage = this;
    this.cells = new Map();
    this.roofCells = new Map();
    this.replaced = new Set();
    this.buildingLists = new Map();
    this.fetching = 0;
    this.streetSections = new Map();
    for (const [x, z, name, bounds, replacements] of manifest.tiles) {
      const ci = world.chunkIndex(x, z);
      if (ci >= 0) this.cells.set(ci, { name, x, z, bounds, replacements });
    }
    // Zastoupení budovy OSM a odpovídající zaměřené plochy mají stejného vlastníka i na hraně dlaždic.
    const moved = new Map();
    const override = (ci) => {
      if (!this.buildingLists.has(ci)) this.buildingLists.set(ci, new Set(world.bChunks[ci]));
      return this.buildingLists.get(ci);
    };
    for (const [ci, { replacements }] of this.cells) for (const i of replacements) {
      const old = world.chunkIndex((world.bMinX[i] + world.bMaxX[i]) / 2, (world.bMinZ[i] + world.bMaxZ[i]) / 2);
      if (old >= 0 && old !== ci) {
        override(old).delete(i);
        if (!moved.has(ci)) moved.set(ci, []);
        moved.get(ci).push(i);
      }
    }
    for (const [ci, buildings] of moved) {
      const group = override(ci);
      for (const i of buildings) group.add(i);
    }
    if (showTheatre && manifest.tiles.some(tile=>tile[2]===theatreTile)) {
      this.theatreTerrace=alignTheatreTerrace(world);
    }
    this.modernTheatre = PARAMS.get('noveDivadlo') === 'puvodni' ? null : modernTheatreSite(world,manifest);
    const forge = world.buildingAt(FORGE.x, FORGE.z);
    this.forgeIndex = forge;
    this.forgeWorking = false;
    this.forgeAngle = 0;
    if (forge >= 0) this.replaced.add(forge);
    this.forgeChunk = world.chunkIndex(FORGE.x, FORGE.z);
    this.far = makeSurfaceMaterial(SURFACE.timber, { vertexColors: true });
    this.streetGlass = makeSurfaceMaterial(SURFACE.glass, {vertexColors:true, transparent:true,
      opacity:.30, depthWrite:false, side:THREE.DoubleSide});
    this.cityFar = makeSurfaceMaterial(SURFACE.plaster, { vertexColors: true, side: THREE.DoubleSide });
    this.applyQuality();
  }

  applyQuality() {
    this.close?.dispose();
    this.cityClose?.dispose();
    this.streetClose?.dispose();
    this.water?.dispose();
    this.close = makeBuildingMaterial({ textures: QUALITY.heritageDetail, heritage: true });
    this.cityClose = makeBuildingMaterial({ textures: QUALITY.heritageDetail, heritage: true });
    this.cityClose.side = THREE.DoubleSide;
    this.streetClose = makeBuildingMaterial({ textures: QUALITY.heritageDetail, heritage: true, street: true });
    this.streetClose.side = THREE.DoubleSide;
    this.water = makeMillraceMaterial(QUALITY.heritageDetail);
  }

  buildings(ci) {
    return this.buildingLists.get(ci) ?? this.world.bChunks[ci];
  }

  prefetch(candidates, otherRequests = 0) {
    const limit = detailRequestLimit() - otherRequests;
    if (this.fetching >= limit) return;
    candidates.sort((a, b) => a.dist - b.dist);
    for (const ch of candidates) {
      if (this.fetching >= limit) break;
      const controller = new AbortController();
      ch.cityRequest = controller;
      this.fetching++;
      const tile = this.cells.get(ch.ci);
      const hasStreet = this.streets?.tiles.has(tile.name);
      const customFacade = (this.iconsEnabled && !!sheets[tile.name]) || (showNorthSquare && (hasNorthSquare(tile.name) || hasSquareFronts(tile.name))) || stationTiles.has(tile.name) || (showSynagogue && tile.name === synagogueTile)
        || (showMuseum && tile.name === museumTile)
        || (showCathedral && tile.name === cathedralTile) || (showTownHall && tile.name === townHallTile) || (showTheatre && tile.name === theatreTile) || (this.modernTheatre && tile.name === modernTheatreTile);
      loadCityTile(tile.name, controller.signal, hasStreet || customFacade).then(async (pack) => {
        if (controller.signal.aborted) return;
        const { version, cx, cz } = pack.header;
        const n = pack.p?.length;
        if (version === 1 && cx === tile.x && cz === tile.z && n && n % 3 === 0
            && pack.n?.length === n && pack.c?.length === n && pack.win?.length === n
            && pack.i?.length && pack.i.length % 3 === 0 && pack.roof?.length % 3 === 0) {
          if (hasStreet) {
            pack.scenery = [];
            pack.entrances = new Float32Array(n / 3);
            pack.street = await this.streets.forTile(tile.name, pack.fileHash, n / 3, pack.scenery, pack.entrances);
          }
          if (!controller.signal.aborted) ch.cityData = pack;
        }
      }).catch(() => {
        // Při chybě zůstane na místě původní zástavba. Znovu se zkusí při návratu do dlaždice.
      }).finally(() => {
        this.fetching--;
      });
    }
  }

  roofHeight(x, z) {
    if (Math.abs(x - FORGE.x) < 15 && Math.abs(z - FORGE.z) < 19) return forgeRoofHeight(this.world, this.forgeIndex, x, z);
    const indexes = this.roofCells.get(this.world.chunkIndex(x, z));
    let top = -Infinity;
    if (indexes) for (const roofs of indexes) top = Math.max(top, roofs.heightAt(x, z));
    return top;
  }

  addExterior(geo, group, owner, name) {
    if (!geo) return;
    this.exteriorMat ??= exteriorMaterial();
    const mesh = new THREE.Mesh(geo, this.exteriorMat);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = name;
    group.add(mesh);
    owner.disposables.push(geo);
    return mesh;
  }

  buildOuter(ci, owner) {
    const sites = this.outerSites.get(ci);
    if (!sites) return;
    const buf = new Exterior();
    buildOuterSite(buf, this.world, sites);
    this.addExterior(buf.geometry(), owner.group, owner, sites[0].site.name);
    owner.exteriorBuildings = new Set(sites.map(record => record.id));
  }

  build(ci, owner) {
    const entry = this.cells.get(ci);
    const city = !!(entry && owner.cityData);
    if (!city && ci !== this.forgeChunk) return null;
    const group = new THREE.Group();
    group.name = city ? 'Měřené budovy Plzně' : 'Vodní hamr Dobřív';
    const base = [], detail = [], wheels = [], night = [], roofChunks = [];
    let roofs = null, exterior = null;
    const add = (geo, mat, layer) => {
      if (!geo) return null;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = mat !== this.water;
      mesh.receiveShadow = true;
      group.add(mesh);
      if (layer) layer.push(mesh);
      owner.disposables.push(geo);
      return mesh;
    };
    if (city) {
      const pack = owner.cityData;
      const geometry = cityMesh(pack, '');
      const sections = [...(pack.scenery ?? [])];
      if (showCathedral && entry.name === cathedralTile) {
        const stone = cathedralGeometry(pack,geometry);
        if (stone) {
          const material = cathedralMaterial();
          add(stone,material).name = 'Katedrála sv. Bartoloměje';
          const hands = cathedralHands();
          hands.setTime(this.hour ?? 0);
          add(hands.geometry, material, detail).name = 'Hodiny katedrály';
          owner.cathedralClock = this.cathedralClock = hands;
          owner.disposables.push(material,material.map);
        }
      }
      if (showMuseum && entry.name === museumTile) {
        const facade = museumGeometry(pack, geometry);
        if (facade) {
          const material = museumMaterial();
          add(facade, material).name = 'Západočeské muzeum';
          owner.disposables.push(material, material.map);
        }
      }
      if (showTownHall && entry.name === townHallTile) {
        const facade = townHallGeometry(pack, geometry);
        if (facade) {
          const material = townHallMaterial(env.night);
          add(facade, material).name = 'Plzeňská radnice';
          const clock = townHallClock(material);
          clock.setTime(this.hour ?? 0);
          this.clock = clock;
          owner.townHallClock = clock;
          group.add(clock);
          owner.disposables.push(material, material.map, ...clock.children.map(hand => hand.geometry));
        }
      }
      const north = showNorthSquare && hasNorthSquare(entry.name)
        ? northSquareGeometry(entry.name, pack, geometry, QUALITY.heritageDetail) : null;
      if (showSynagogue && entry.name === synagogueTile) {
        const front = synagogueSurface(pack, geometry);
        if (front) {
          const material = synagogueMaterial();
          add(front, material).name = 'Velká synagoga a sousední domy';
          owner.disposables.push(material, material.map);
        }
      }
      if (showTheatre && entry.name === theatreTile) {
        const theatre = theatreSurfaces(pack, geometry, this.world, this.theatreTerrace);
        if (theatre) {
          owner.facadeBuildings = new Set([this.theatreTerrace]);
          const material = theatreMaterial();
          add(theatre.geometry, material).name = 'Velké divadlo';
          sections.push({id:'divadlo-zabradli', fixtures:theatre.fixtures, paving:[]});
          owner.disposables.push(material, material.map);
        }
      }
      if (this.modernTheatre && entry.name === modernTheatreTile) {
        const modern = modernTheatreGeometry(pack, geometry, this.world, this.modernTheatre);
        if (modern) {
          owner.facadeBuildings = this.modernTheatre.hidden;
          const material = modernTheatreMaterial();
          add(modern, material).name = 'Nové divadlo';
          owner.disposables.push(material, material.map);
        }
      }
      if (stationTiles.has(entry.name)) {
        const station = stationSurfaces(pack, geometry);
        if (station) {
          const materials = stationMaterials(env.night);
          add(station.front, materials.front).name = 'Průčelí hlavního nádraží';
          add(station.copper, materials.copper).name = 'Kupole hlavního nádraží';
          owner.disposables.push(materials.front, materials.copper, materials.map);
        }
      }
      if (showNorthSquare && hasSquareFronts(entry.name)) {
        const front = squareFrontGeometry(entry.name, pack, geometry, QUALITY.heritageDetail, north);
        if (front) {
          const material = squareFrontMaterial(entry.name, env.night);
          add(front, material).name = north ? 'Severní průčelí náměstí' : 'Domy na náměstí Republiky';
          owner.disposables.push(material, material.map);
        }
      }
      const layers = [{ solid:new SolidBuf(), ranges:[], material:this.cityFar },
        { solid:new SolidBuf(), ranges:[], material:this.streetGlass }];
      for (const section of sections) {
        let fixtures = this.streetSections.get(section.id);
        if (!fixtures) {
          fixtures = section.fixtures ?? section.items.flatMap(item => streetFixtures(item, this.world));
          this.streetSections.set(section.id, fixtures);
          const touched = new Set();
          for (const fixture of fixtures) {
            if (this.world.transitStops?.authoredIds.has(fixture.id)) continue;
            const tiles = this.world.streetFixtures;
            if (!tiles.has(fixture.tile)) tiles.set(fixture.tile, []);
            tiles.get(fixture.tile).push(fixture);
            touched.add(fixture.tile);
          }
          for (const tile of touched) this.world.refreshStreetCollision?.(tile);
          installStreetPaving(this.world, section.paving);
        }
        for (const fixture of fixtures) {
          if (this.world.transitStops?.authoredIds.has(fixture.id)) continue;
          const {solid,ranges} = layers[fixture.piece === 'sklo' ? 1 : 0];
          const start = solid.p.length;
          drawStreetFixture(solid, fixture, QUALITY.heritageDetail);
          ranges.push({fixture, start, end:solid.p.length});
        }
      }
      owner.streetVisuals = [];
      for (const {solid,ranges,material} of layers) {
        if (!ranges.length) continue;
        const props = solid.geometry();
        add(props, material, detail);
        owner.streetVisuals.push(...attachRoadFurniture(this.world.breakables, group, props, material, ranges));
      }
      if (this.iconsEnabled && sheets[entry.name]) {
        const buf = new Exterior();
        if (dressSurvey(buf, this.world, pack, geometry, entry.name)) {
          measuredDetails(buf, this.world, entry.name);
          const mesh = this.addExterior(buf.geometry(), group, owner, 'Dominanty Plzně');
          mesh.geometry.computeBoundingBox();
          exterior = {mesh, shell:geometry, nearCount:geometry.drawRange.count};
        }
      }
      add(geometry, pack.street ? this.streetClose : this.cityClose, base);
      // V tomto listu obsahuje vrstva detailu jen původní okna katedrály.
      if (!owner.cathedralClock) add(cityMesh(pack, 'd'), this.cityFar, detail);
      roofs = new HeritageRoofs();
      roofs.add({ p: geometry.attributes.position.array, indices: pack.roof }, 0);
      const [x0, z0, x1, z1] = entry.bounds;
      for (let z = Math.floor(z0 / CHUNK) * CHUNK; z <= z1; z += CHUNK) {
        for (let x = Math.floor(x0 / CHUNK) * CHUNK; x <= x1; x += CHUNK) {
          const key = this.world.chunkIndex(x, z);
          if (key < 0) continue;
          if (!this.roofCells.has(key)) this.roofCells.set(key, new Set());
          this.roofCells.get(key).add(roofs);
          roofChunks.push(key);
        }
      }
      for (const i of entry.replacements) this.replaced.add(i);
      owner.cityData = null;
    } else {
      buildForge(this.world, this.forgeIndex, this.close, this.far, this.water, add, { base, detail, wheels, night, group, disposables: owner.disposables });
    }
    owner.group.add(group);
    const x = city ? entry.x : FORGE.x, z = city ? entry.z : FORGE.z;
    return { group, base, detail, wheels, night, exterior, city, roofs, roofChunks, x, z, y: this.world.heightAt(x, z) };
  }

  dispose(ch) {
    ch.cityRequest?.abort();
    if (ch.cathedralClock && this.cathedralClock === ch.cathedralClock) this.cathedralClock = null;
    if (ch.townHallClock && this.clock === ch.townHallClock) this.clock = null;
    for (const visual of ch.streetVisuals ?? []) this.world.breakables.detach(visual);
    if (!ch.heritage?.city) return;
    for (const key of ch.heritage.roofChunks) {
      const cell = this.roofCells.get(key);
      cell.delete(ch.heritage.roofs);
      if (!cell.size) this.roofCells.delete(key);
    }
    for (const i of this.cells.get(ch.ci).replacements) this.replaced.delete(i);
  }

  updateTime(hour, dt) {
    this.hour = hour;
    this.clock?.setTime(hour);
    this.cathedralClock?.setTime(hour);
    this.forgeWorking = this.forgeIndex >= 0 && hour >= 9 && hour < 17;
    if (this.forgeWorking) this.forgeAngle = (this.forgeAngle + dt * 0.72) % (Math.PI * 2);
  }

  update(chunk, x, z, y = chunk.y) {
    const distance = Math.hypot(Math.max(0, Math.abs(chunk.x - x) - (chunk.city ? CHUNK * 0.5 : 0)),
      Math.max(0, Math.abs(chunk.z - z) - (chunk.city ? CHUNK * 0.5 : 0)), chunk.y - y);
    if (chunk.exterior) {
      const {mesh,shell,nearCount} = chunk.exterior;
      const {min,max} = mesh.geometry.boundingBox;
      const range = Math.hypot(Math.max(min.x-x,0,x-max.x),Math.max(min.z-z,0,z-max.z),Math.max(0,y-max.y));
      // V dálce se původní měřená silueta vejde zpět do jediného volání za celou dlaždici.
      mesh.visible = range < (QUALITY.heritageDetail ? 400 : 265);
      mesh.castShadow = range < 145;
      shell.setDrawRange(0,mesh.visible ? nearCount : shell.index.count);
    }
    const near = distance < (QUALITY.heritageDetail ? 260 : 175);
    const mat = chunk.city ? (near ? this.cityClose : this.cityFar) : (near ? this.close : this.far);
    for (const mesh of chunk.base) {
      mesh.material = chunk.city && near && mesh.geometry.hasAttribute('aStreet') ? this.streetClose : mat;
      if (chunk.city) mesh.castShadow = distance < 560;
    }
    for (const mesh of chunk.detail) mesh.visible = near;
    for (const wheel of chunk.wheels) {
      wheel.visible = near;
      if (near) wheel.rotation.x = this.forgeAngle;
    }
    for (const mesh of chunk.night) mesh.visible = near && env.night.value > 0.18;
  }
}

// Dlažba jako součást stejné plochy terénu, bez kolizní hrany.
export function pavingChunk(x, z) {
  if (x < 75 && x + CHUNK > -66 && z < 68 && z + CHUNK > -60) return 1;
  const [west, north, east, south] = forecourtBounds;
  if (x < east && x + CHUNK > west && z < south && z + CHUNK > north) return 3;
  if (x < FORGE.x + 19 && x + CHUNK > FORGE.x - 24 && z < FORGE.z + 45 && z + CHUNK > FORGE.z) return 2;
  return 0;
}
