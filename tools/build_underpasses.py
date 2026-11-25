"""Sestaví opravu spodních jízdních pásů z průzkumu mostů a výškových dat ČÚZK."""
import argparse
from collections import defaultdict
import json
import math
from pathlib import Path

import numpy as np

from area import BBOX, DEM_STEP
from build_grade_separations import CALIBRATED_SOURCES, D5_FLOORS, Line, Raster, ease, deck_profile
from build_landscape import coords, fingerprint, read_pack
from coordinates import ORIGIN, to_xz
from map_sources import load_dem

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'public/data'
STEP = 2
# Známé hladiny vozovek a značky průjezdné výšky mají přednost před DMR přes násep.
# V K Valše a u nádraží jsou uvnitř tunelu vidět jen koleje nebo zástavba nad ním.
LEVELS = {6794: (315.80, 315.65), 6918: (315.10, 315.10)}
ABUTMENTS = [998, 1005, 2429, 2731, 2771, 4168, 4857, 6861, 11362, 14138, 15373, 21543, 21797, 24098, 25961, 19490, 19492, 31162, 34831, 31440, 26432]


def smooth(values, radius):
    window = np.arange(-radius, radius + 1)
    weights = np.exp(-0.5 * (window / (radius / 2.5)) ** 2)
    return np.convolve(np.pad(values, radius, mode='edge'), weights / weights.sum(), mode='valid')


class Ground:
    def __init__(self, data, grades):
        th, tp = read_pack(data / 'terrain.bin')
        values = np.c_[tp['rowStart'], tp['d'].reshape(th['rows'], -1)].cumsum(axis=1)
        self.base = Raster(values * th['q'] + th['base'], th['x0'], th['z0'], th['g'], th['g'])
        lh, lp = read_pack(data / 'landscape.bin')
        self.detail = {}
        size = 256 // lh['g'] + 1
        for tile, patch in zip(lp['tiles'], lp['offsets'].reshape(-1, size, size)):
            row, col = divmod(int(tile), lh['cols'])
            self.detail[col, row] = Raster(patch * lh['q'], th['x0'] + col * 256,
                                           th['z0'] + row * 256, lh['g'], lh['g'])
        self.grades = {(i, j): dy for i, j, dy in grades['terrain']}

    def nodes(self, xy):
        heights = self.base.sample(xy, triangle=True)
        tiles = np.floor((xy - [self.base.x0, self.base.z0]) / 256).astype(int)
        for tile in np.unique(tiles, axis=0):
            at = np.all(tiles == tile, axis=1)
            patch = self.detail.get(tuple(tile))
            if patch is not None:
                heights[at] += patch.sample(xy[at], triangle=True)
        return heights + np.array([self.grades.get(tuple(k), 0) * .01 for k in xy // STEP])


def road_path(pack, ends, road, reach=50):
    """Po obou stranách připojí skutečnou navazující osu, v křižovatce jen přímé pokračování."""
    line = Line(pack, road)
    points = line.points
    extensions = []
    for reverse in (False, True):
        path = points if reverse else points[::-1]
        used = {road}
        extra = []
        length = 0
        while length < reach:
            p = path[-1]
            direction = p - path[-2]
            choices = []
            for other, flip in ends[tuple(np.rint(p * 10).astype(int))]:
                if other in used or pack['flags'][other] & (2 | 128):
                    continue
                path2 = Line(pack, other).points
                if flip:
                    path2 = path2[::-1]
                v = path2[1] - path2[0]
                dot = float(v @ direction / max(1e-6, np.linalg.norm(direction) * np.linalg.norm(v)))
                if dot > .72:
                    choices.append((dot + (pack['name'][other] == pack['name'][road]) * .08, other, path2))
            if not choices:
                break
            _, other, path = max(choices, key=lambda entry: entry[0])
            used.add(other)
            for a, b in zip(path, path[1:]):
                distance = float(np.linalg.norm(b - a))
                if distance > 0 and length + distance >= reach:
                    extra.append(a + (b - a) * (reach - length) / distance)
                    length = reach
                    break
                length += distance
                extra.append(b)
        extensions.append(extra)
    left, right = extensions
    path = np.array([*reversed(left), *points, *right])
    stations = np.r_[0., np.linalg.norm(np.diff(path, axis=0), axis=1).cumsum()]
    return path, stations - stations[len(left)]


def smooth_junctions(changes, ground):
    """V překryvu pásů a v ostré zatáčce proloží místní rovinu jen vozovkou, bez svahu za krajnicí."""
    keys = [key for key, (priority, _) in changes.items() if priority[0] > .90]
    if not keys:
        return
    coords = np.array(keys)
    levels = ground.nodes(coords * STEP) + np.array([changes[k][1] * .01 for k in keys])
    indices = {k: i for i, k in enumerate(keys)}
    offsets = np.array([(i, j) for i in range(-4, 5) for j in range(-4, 5) if i*i+j*j <= 16])
    weights = np.exp(-np.sum(offsets**2, axis=1) / 6)
    planes = np.column_stack((np.ones(len(offsets)), offsets))
    for i, key in enumerate(keys):
        neighbors = np.array([indices.get((key[0]+dx, key[1]+dz), -1) for dx, dz in offsets])
        use = (neighbors >= 0) & (np.abs(levels[neighbors] - levels[i]) < .55 + .35 * np.linalg.norm(offsets, axis=1))
        if np.count_nonzero(use) < 6:
            continue
        fit, _, rank, _ = np.linalg.lstsq(planes[use] * weights[use,None],
                                           (levels[neighbors[use]] - levels[i]) * weights[use], rcond=None)
        if rank == 3:
            priority, delta = changes[key]
            changes[key] = priority, delta + round(100 * fit[0])


def paint(changes, points, heights, strengths, width, ground):
    """Výšku každého uzlu určuje nejbližší místo na ose, v překryvu vítězí vnitřek pásu."""
    reach = width + 5
    grid = np.stack(np.meshgrid(*[np.arange(math.floor(lo / STEP), math.ceil(hi / STEP) + 1)
                                  for lo, hi in zip(points.min(axis=0) - reach, points.max(axis=0) + reach)]),
                    axis=-1).reshape(-1, 2)
    xy = grid * STEP
    nearest = np.full(len(xy), reach, dtype=np.float32)
    level = np.zeros(len(xy))
    fade = np.zeros(len(xy))
    for n, (a, b) in enumerate(zip(points, points[1:])):
        v = b - a
        t = np.clip(np.sum((xy - a) * v, axis=1) / max(1e-8, np.dot(v, v)), 0, 1)
        dist = np.linalg.norm(xy - (a + t[:, None] * v), axis=1)
        use = dist < nearest
        nearest[use] = dist[use]
        level[use] = heights[n] + t[use] * (heights[n+1] - heights[n])
        fade[use] = strengths[n] + t[use] * (strengths[n+1] - strengths[n])
    weight = fade * ease((reach - nearest) / 3.)
    use = weight > 0
    for k, dy, strength, distance in zip(grid[use], (level[use] - ground.nodes(xy[use])) * weight[use],
                                        weight[use], nearest[use]):
        key = tuple(k)
        priority = (round(float(strength), 5), -float(distance))
        if key not in changes or priority > changes[key][0]:
            changes[key] = (priority, round(float(dy) * 100))


# Pásy mezi opěrami, které OSM vede jako nájezd nebo horní patro bez příznaku mostu.
# U nádraží má podzemní spirála jinou výšku než protisměrná rampa nad ní.
PLATFORMS = {
    4485: (315.28, 315.18), 12063: (315.15, 315.08), 13371: (315.18, 315.10),
    18122: (315.12, 315.15), 20492: (315.13, 315.15), 20496: (315.05, 315.12),
    24985: (310.05, 311.0), 24986: (307.95, 311.67),
    21537: (412.50, 407.13),
}
# Ulice pod společným železničním tělesem musí být plynulá i přes hranice mapových dílů.
LEVELS.update({83: (314.1, 313.45), 6916: (313.45, 313.75), 18124: (313.75, 313.1),
               6917: (313.0, 313.13), 13804: (315.07, 315.13), 13368: (315.1, 315.1), 16130: (308.7, 309.0),
               25002: (310.30, 309.45), 25001: (310.30, 309.0), 24987: (308.50, 307.95), 2778: (340.9, 340.0)})
# Lávky a soukromý přejezd, kde DMP zachytil horní povrch a DMR dolní ulici.
SURVEYED_DECKS = (3744, 26467, 7129, 32141, 23677, 32104, 14040, 25501)


# Hodnoty v metrech od začátku OSM dílu a v metrech nad mořem. Zdroj a kontrolní řezy v E48.
# Na silnici 232 DMR ještě zachycuje svah před stavbou obchvatu, novější DMP OK vidí asfalt.
SURVEYED_FLOORS = {
    # ZPS Plzeň 1, 10/2026: dolní příjezd pod schodištěm u fakulty 337,83–337,98 m.
    23513: [(25, 341.3), (41, 340.63), (60, 340.12), (83, 338.54), (112, 338.36),
            (140, 338.5), (150, 337.86), (163, 337.98), (177, 338.4)],
    33960: [(470, 386.19), (513, 386.0), (553, 385.7), (585, 385.3), (601, 385.1),
            (633, 384.6), (673, 383.8), (705, 383.05)],
}
SURVEYED_HEIGHTS = {
    # U fakulty jsou plošiny a schodiště ve dvou zaměřených úrovních.
    26364: [(0, 340.42), (11.9, 342.48)],
    # Snímkovaný horní povrch spojovací lávky FN, bez výšek střech sousedních budov.
    32136: [(0, 340.71), (28.8, 340.27)],
    31161: [(0, 391.42), (18, 391.6), (37, 391.95)],
    # Otevřená hlavní mostovka a navazující oblouk lávky v Koterově, DMP OK a projekt SUDOP.
    22164: [(0, 345.0), (15, 346.1), (42, 348.1), (61, 348.65), (78, 347.7),
            (102, 346.8), (120, 346.1), (145, 344.65), (160, 343.3), (177.2, 341.93)],
    # Horní plocha tělesa U Planetária v městském modelu 00000002021000456.
    26431: [(0, 334.41), (34.88, 332.83)],
    26507: [(0, 333.23), (4.60, 333.23)],
    19489: [(0, 434.22), (17, 434.52), (34, 434.62)],
}


def encode_profile(road, line, height):
    ends = np.rint(line.points[[0, -1]].ravel() * 10).astype(int).tolist()
    return [road, ends, np.rint(height * 100).astype(int).tolist()]


def build(raw, output):
    grades = json.loads((DATA / 'grade-separations.json').read_text())
    sources = {name: fingerprint(DATA / (name + '.bin')) for name in grades['sources']}
    if sources != grades['sources'] or any(sources[name] != value for name, value in CALIBRATED_SOURCES.items()):
        raise ValueError('Kalibrace vyžaduje původní výškový a silniční výřez.')
    ground = Ground(DATA, grades)
    terrain_header, _ = read_pack(DATA / 'terrain.bin')
    load_dem(raw / 'dmr.npy', read_array=False)
    dx, dz = DEM_STEP * ORIGIN['kx'], DEM_STEP * ORIGIN['ky']
    raster = Raster(np.load(raw / 'dmr.npy', mmap_mode='r'), *to_xz(BBOX[2], BBOX[1]), dx, dz, centers=True)
    load_dem(raw / 'dmp.npy', read_array=False)
    surface = Raster(np.load(raw / 'dmp.npy', mmap_mode='r'), *to_xz(BBOX[2], BBOX[1]), dx, dz, centers=True)
    _, roads = read_pack(DATA / 'roads.bin')
    ends = defaultdict(list)
    for i, cls in enumerate(roads['cls']):
        if cls > 13 and cls != 15:
            continue
        x, z = coords(roads, i)
        ends[x[0], z[0]].append((i, False))
        ends[x[-1], z[-1]].append((i, True))
    survey = json.loads(Path(__file__).with_name('underpass-survey.json').read_text())
    changes = {}
    decks = []
    for road, levels in PLATFORMS.items():
        line = Line(roads, road)
        progress = line.along / line.along[-1]
        if road in (24985, 24986):
            # Na koncích garážové spirály se sklon obrací, spád narůstá až uvnitř oblouku.
            progress = ease(progress)
        heights = levels[0] + progress * (levels[1] - levels[0])
        decks.append(encode_profile(road, line, heights))
    for road, observations in SURVEYED_HEIGHTS.items():
        line = Line(roads, road)
        distances, levels = np.array(observations).T
        decks.append(encode_profile(road, line, np.interp(line.along, distances, levels)))
    for road in SURVEYED_DECKS:
        line = Line(roads, road)
        decks.append(encode_profile(road, line, deck_profile(line, surface)))
    for key, spans in survey.items():
        road = int(key)
        if road in PLATFORMS or roads['flags'][road] & (2 | 128):
            continue
        path, along = road_path(roads, ends, road)
        line = Line(roads, road)
        for lo, hi in spans:
            left, right = lo - 12, hi + 12
            if road in LEVELS:
                left, right = -5, line.along[-1] + 5
            s = np.arange(max(along[0], math.floor(left - 30)), min(along[-1], math.ceil(right + 30)) + .01, 1.)
            if len(s) < 2:
                continue
            xy = np.column_stack([np.interp(s, along, axis) for axis in path.T])
            h = smooth(raster.sample(xy), 6)
            # Přes zakrytou část interpolujeme mezi oběma odkrytými příjezdy.
            anchor = np.interp([left, right], s, h)
            target = np.interp(s, [left, right], anchor)
            if road in SURVEYED_FLOORS:
                distances, levels = np.array(SURVEYED_FLOORS[road]).T
                target = np.interp(s, distances, levels)
            elif road in LEVELS:
                target = np.interp(s, [0, line.along[-1]], LEVELS[road])
            elif ('road', road) in D5_FLOORS and (road != 14068 or lo < 1000):
                origin, limits, levels = D5_FLOORS['road', road]
                station, _ = line.locate(*origin)
                target = np.interp(s, station + np.array(limits), levels)
            else:
                # Dlouhé zářezy mohou i v zakryté části klesat. Vyšší násep DMR přes otvor odřízneme.
                target = smooth(np.minimum(h, target), 12)
            distance = np.maximum(0, np.maximum(left - s, s - right))
            target = h + ease(1 - distance / 16) * (target - h)
            if road == 14502:
                # Šikmý sjezd z cesty 13271 sdílí prvních několik metrů se šikmou krajnicí.
                # Podélný spád nepřeskočí ani na dalším lomu osy.
                descent = np.maximum(0, s - 6)
                approach = h[0] - .155 * (descent - 5 * (1 - np.exp(-descent / 5)))
                blend = ease((s - 34) / 35)
                target = (1 - blend) * approach + blend * target
            fade = ease(1 - distance / 30)
            paint(changes, xy, target, fade, roads['w'][road] * .5, ground)
    smooth_junctions(changes, ground)
    # Nájezdy u okraje mostovky: měřená výška opěry má přednost před náspem v DMR.
    # Tam, kde již leží dolní cesta, ji nezahrneme zeminou. Horní pruh nese samostatný pás.
    bridge_ends = defaultdict(list)
    measured = {i: np.array(y) / 100 for i, _, y in grades['roads']}
    measured.update({i: np.array(y) / 100 for i, _, y in decks})
    for i in np.flatnonzero(roads['flags'] & 2):
        off = int(roads['bridgeOff'][i])
        if off == 0xffffffff:
            continue
        line = Line(roads, i)
        y = measured.get(i, roads['bridgeY'][off:off+len(line.points)] * .02 + terrain_header['base'])
        for side in (0, -1):
            bridge_ends[tuple(np.rint(line.points[side] * 10).astype(int))].append(y[side])
    approaches = []
    banks = {}
    for road in ABUTMENTS:
        line = Line(roads, road)
        total = line.along[-1]
        samples = np.linspace(0, total, max(2, int(math.ceil(total / STEP)) + 1))
        xy = line.at(samples)
        raw_height = smooth(raster.sample(xy), 4)
        y = raw_height.copy()
        influence = np.zeros(len(samples))
        for end in (0, -1):
            anchor = bridge_ends.get(tuple(np.rint(line.points[end] * 10).astype(int)))
            if not anchor:
                continue
            distance = samples if end == 0 else total - samples
            reach = min(total, max(24, min(80, 18 * abs(raw_height[end] - np.mean(anchor)))))
            far = min(len(y)-1, int(np.argmin(np.abs(distance - reach))))
            progress = np.minimum(1, distance / reach)
            if road == 2429:
                # Dvě nízké lávky navazují na tutéž cestu, na obou koncích téměř vodorovně.
                progress = ease(progress)
            plane = np.mean(anchor) + (raw_height[far] - np.mean(anchor)) * progress
            weight = ease(1 - np.maximum(0, distance - reach * .65) / (reach * .35))
            y += weight * (plane - y)
            influence = np.maximum(influence, weight)
        if all(tuple(np.rint(p * 10).astype(int)) in bridge_ends for p in line.points[[0,-1]]) and total < 25:
            y = np.interp(samples, [0,total], [np.mean(bridge_ends[tuple(np.rint(p*10).astype(int))]) for p in line.points[[0,-1]]])
        paint(banks, xy, y - .05, influence, roads['w'][road] / 2, ground)
        indices = np.flatnonzero(influence)
        for region in np.split(indices, np.flatnonzero(np.diff(indices) > 1) + 1):
            if len(region) < 2:
                continue
            start, end = region[[0,-1]]
            approaches.append([road, round(samples[start]*100), round(samples[end]*100), np.rint(y[start:end+1]*100).astype(int).tolist()])
    # Obě rampy v podzemní garáži mají vlastní jízdní pás. Terén pod ním nesmí kola zvedat.
    for road in (24985, 24986):
        line = Line(roads, road)
        s = line.stations()
        start, end = PLATFORMS[road]
        height = start + (end - start) * ease(s / line.along[-1])
        cut = {}
        paint(cut, line.at(s), height - .12, np.ones(len(s)), roads['w'][road] / 2, ground)
        for key, result in cut.items():
            if result[1] < banks.get(key, (None, 0))[1]:
                banks[key] = result
    for k, result in banks.items():
        # Zeminu nad spodní tratí nikdy nedosypáváme. Nájezd nese vlastní konstrukce.
        if result[1] < min(0, changes.get(k, (None, 0))[1]):
            changes[k] = result
    corrections = [[int(i), int(j), dy] for (i,j), (_,dy) in sorted(changes.items()) if abs(dy) >= 1]
    result = {'version': 1, 'source': fingerprint(DATA / 'grade-separations.json'), 'terrain': corrections, 'decks': decks, 'approaches': approaches}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, separators=(',', ':')) + '\n')
    print(f'{len(survey)} spodních komunikací, {len(corrections)} upravených uzlů.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--raw', type=Path, default=ROOT / 'data-raw')
    parser.add_argument('--output', type=Path, default=ROOT / 'data-raw/kandidat/underpasses.json')
    args = parser.parse_args()
    build(args.raw, args.output)
