#!/usr/bin/env python3
"""Odvodí lokální výškové profily křížení z DMP/DMR a výsledku auditu herní mapy."""
import argparse
from collections import defaultdict
import json
import math
from pathlib import Path
from subprocess import check_output

import numpy as np

from area import BBOX, DEM_STEP
from build_landscape import CHUNK, coords, fingerprint, interpolate_base, read_pack
from coordinates import to_xz
from map_sources import load_dem

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'public/data'
STEP = 2
SLAB = 0.94
# Před rasterizací se hladina podjezdu sníží minimálně o rezervu na vzorkování.
GRID_MARGIN = 0.16

# Tam, kde se v rastru sejdou různé konstrukce nebo je povrch zakrytý,
# určují výšky přilehlé úseky téže trasy a ortofoto.
# Kalibrace je vázaná na indexy os v konkrétním balíku.
CALIBRATED_SOURCES = {'terrain': '66422d06', 'roads': 'b0700c49', 'rails': '3bf5d11d'}
DECK_LEVELS = {
    ('rail', 1687): 347.90, ('rail', 553): 347.90,  # souběžné koleje u stanice Chrást
    ('rail', 996): 330.80, ('rail', 1029): 330.80, ('rail', 383): 336.70,  # přesmyk Skvrňany
    ('rail', 260): 369.49,  # souběžný druhý most u Josefa Růžičky
}
FLOOR_LEVELS = {
    ('rail', 34): 323.82, ('rail', 732): 323.82,  # spodní trať na Cheb
    ('rail', 140): 327.31,  # vlečka pod Břeňkovou
    ('road', 1472): 368.30,  # příčná silnice pod souběhem D5 a přivaděče
    ('road', 13368): 315.10,  # Prokopova, oba otevřené portály
}
# Světlé výšky vyznačené v použitém výřezu OpenStreetMap. Nejsou-li uvedeny,
# minimální otvor je odhad pro daný druh spodní trasy, nikoli dopravní údaj.
POSTED_CLEARANCE = {
    9939: 2.50, 9951: 2.80, 24987: 4.00, 6933: 3.40, 13368: 4.00,
    83: 4.20, 18118: 4.20, 18124: 4.20, 6916: 4.20, 6917: 4.20,
}
BOLEVEC_ROAD = ('road', 6920)
BOLEVEC_BRIDGE = ('rail', 210)
LITICE_TRACK = ('road', 14068)

# D5. V Černicích hladina obrusu mezi konci mostovek kolísá kvůli vozidlům
# v DMP, proto profil vedeme mezi ověřenými výškami konců.
D5_DECKS = {('road', i) for i in (2599, 2600, 4164, 4166, 4167, 4169,
                                  5877, 5878, 18729, 18730, 18733, 33944)}
D5_DECK_ENDS = {
    ('road', 4164): (356.54, 357.26), ('road', 4166): (356.44, 357.06),
    ('road', 4167): (356.95, 356.21), ('road', 4169): (356.97, 356.42),
}
# Poloha na dolní trase, interval zakrytý násypem a výška mezi portály.
D5_FLOORS = {
    ('rail', 165): ((4261.28, 4545.70), (-20., 34.), (347.36, 347.56)),
    ('road', 31802): ((4284.27, 4535.67), (-35., 21.), (349.72, 349.98)),
    ('road', 19138): ((4268.83, 4556.28), (-34., 21.), (348.99, 349.45)),
    LITICE_TRACK: ((-1149.09, 6936.24), (-20., 28.), (371.24, 371.12)),
}


class Raster:
    def __init__(self, data, x0, z0, dx, dz, centers=False):
        self.data = data
        self.x0, self.z0 = x0, z0
        self.dx, self.dz = dx, dz
        self.center = 0.5 if centers else 0

    def sample(self, points, *, triangle=False):
        u = np.clip((points[..., 0] - self.x0) / self.dx - self.center, 0, self.data.shape[1] - 1.0001)
        v = np.clip((points[..., 1] - self.z0) / self.dz - self.center, 0, self.data.shape[0] - 1.0001)
        i, j = u.astype(int), v.astype(int)
        x, z = u - i, v - j
        a, b, c, d = self.data[j, i], self.data[j, i + 1], self.data[j + 1, i], self.data[j + 1, i + 1]
        if triangle:
            return np.where(x + z <= 1, a + (b - a) * x + (c - a) * z,
                            d + (c - d) * (1 - x) + (b - d) * (1 - z))
        return a * (1 - x) * (1 - z) + b * x * (1 - z) + c * (1 - x) * z + d * x * z


class Line:
    def __init__(self, pack, index):
        self.points = np.column_stack(coords(pack, index)) * 0.1
        self.v = np.diff(self.points, axis=0)
        self.lengths = np.linalg.norm(self.v, axis=1)
        self.along = np.r_[0., self.lengths.cumsum()]

    def at(self, distance):
        return np.stack([np.interp(distance, self.along, v) for v in self.points.T], axis=-1)

    def locate(self, x, z):
        p = np.array([x, z])
        t = np.clip(np.sum((p - self.points[:-1]) * self.v, axis=1)
                    / np.maximum(self.lengths ** 2, 1e-10), 0, 1)
        offset = self.points[:-1] + self.v * t[:, None] - p
        k = np.argmin(np.sum(offset ** 2, axis=1))
        return self.along[k] + self.lengths[k] * t[k], self.v[k] / max(0.001, self.lengths[k])

    def stations(self, a=0., b=None):
        b = self.along[-1] if b is None else b
        return np.linspace(a, b, max(2, math.ceil((b - a) / STEP) + 1))


def ease(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def deck_profile(line, dmp):
    s = line.stations()
    d = line.at(s + 1.) - line.at(s - 1.)
    normals = np.column_stack((-d[:, 1], d[:, 0])) / np.maximum(0.001, np.linalg.norm(d, axis=1)[:, None])
    y = np.median([dmp.sample(line.at(s) + normals * across) for across in (-0.75, 0, 0.75)], axis=0)
    # Jediný strom nebo vozidlo nemá určovat profil mostovky.
    y = np.median(np.lib.stride_tricks.sliding_window_view(np.pad(y, 2, mode='edge'), 5), axis=1)
    if s[-1] <= 45:
        # Krátká přímá mostovka uvnitř rastru někdy obsahuje i hranu opěry.
        middle = (s >= 0.16 * s[-1]) & (s <= 0.84 * s[-1])
        if middle.sum() >= 3:
            center = float(np.median(y[middle]))
            good = middle & (np.abs(y - center) <= 1.35)
            if good.sum() >= 2:
                slope = float(np.clip(np.polyfit(s[good], y[good], 1)[0], -0.075, 0.075))
                return center + slope * (line.along - np.mean(s[good]))
    return np.interp(line.along, s, y)


class TerrainEdits:
    def __init__(self, base):
        self.base = base
        self.additions = {}
        self.cuts = {}
        self.protected = {}
        self.caps = {}

    def paint(self, points, heights, width, *, cut, protection=None, cap=False, shoulder=4.5):
        # Příčný pás má uvnitř jízdního prostoru jednotnou výšku. Okraj přechází do terénu.
        radius = width + shoulder
        changes = self.cuts if cut else self.additions
        for k, ((x, z), h) in enumerate(zip(points, heights)):
            X, Z = np.meshgrid(np.arange(math.floor((x - radius) / STEP), math.ceil((x + radius) / STEP) + 1),
                               np.arange(math.floor((z - radius) / STEP), math.ceil((z + radius) / STEP) + 1))
            d = np.hypot(X * STEP - x, Z * STEP - z)
            w = ease((radius - d) / (radius - width))
            xy = np.stack((X, Z), axis=-1)[w > 0]
            old = self.base.sample(xy * STEP, triangle=True)
            delta = (h - old) * w[w > 0]
            for (i, j), new, weight in zip(xy, delta, w[w > 0]):
                key = int(i), int(j)
                if cap:
                    if weight == 1 or new < 0:
                        self.caps[key] = min(self.caps.get(key, math.inf), float(new))
                    continue
                current = changes.get(key, 0.)
                changes[key] = min(current, float(new)) if cut else max(current, float(new))
                if protection is not None:
                    self.protected[key] = max(self.protected.get(key, 0.), float(weight * protection[k]))

    def encoded(self):
        # Spodní stopa má přednost, pokud se dotkne spodku náspu jiné stavby.
        result = []
        for key in sorted(self.cuts.keys() | self.additions.keys() | self.caps.keys(), key=lambda p: (p[1], p[0])):
            cut = self.cuts.get(key, 0.)
            addition = self.additions.get(key, 0.) * (1 - self.protected.get(key, 0.))
            delta = round(100 * min(cut or addition, self.caps.get(key, math.inf)))
            if abs(delta) >= 2:
                result.append((*key, delta))
        return result

    def follow(self, points, heights, width, shoulder, *, floor=False, abutments=()):
        # Výška uzlu je dána průmětem na osu. Sousední vzorky na podélném
        # sklonu tak spolu nesoupeří o to, který vytvoří vyšší vrchol.
        radius = width + shoulder
        lo = np.floor((points.min(axis=0) - radius) / STEP).astype(int)
        hi = np.ceil((points.max(axis=0) + radius) / STEP).astype(int)
        grid = np.stack(np.meshgrid(np.arange(lo[0], hi[0] + 1), np.arange(lo[1], hi[1] + 1)), axis=-1).reshape(-1, 2)
        xy = grid * STEP
        distance_sq = np.full(len(grid), radius ** 2)
        target = np.zeros(len(grid))
        for a, b, ya, yb in zip(points[:-1], points[1:], heights[:-1], heights[1:]):
            direction = b - a
            t = np.clip((xy - a) @ direction / max(direction @ direction, 1e-8), 0, 1)
            offset = a + t[:, None] * direction - xy
            d2 = np.sum(offset * offset, axis=1)
            closer = d2 < distance_sq
            target[closer] = ya + t[closer] * (yb - ya)
            distance_sq[closer] = d2[closer]
        inside = distance_sq < radius ** 2
        for end, outward, half_width in abutments:
            offset = xy - end
            behind_wall = (offset @ outward > -STEP) & (np.abs(offset @ [-outward[1], outward[0]]) < half_width)
            inside &= ~behind_wall
        weights = ease((radius - np.sqrt(distance_sq[inside])) / shoulder)
        delta = (target[inside] - self.base.sample(xy[inside], triangle=True)) * weights
        for (i, j), dy, weight in zip(grid[inside], delta, weights):
            key = int(i), int(j)
            if dy >= 0:
                self.additions[key] = max(self.additions.get(key, 0.), float(dy))
            else:
                self.cuts[key] = min(self.cuts.get(key, 0.), float(dy))
            if floor and dy < 0:
                self.protected[key] = max(self.protected.get(key, 0.), float(weight))


def approach_profile(line, reverse, elevation, slope, base):
    reach = min(56., line.along[-1])
    s = line.stations(0, reach)
    xy = line.at(line.along[-1] - s if reverse else s)
    ground = base.sample(xy, triangle=True)
    end_slope = float(np.clip((ground[-1] - ground[-min(5, len(s))]) / max(1., min(8., reach)), -0.07, 0.07))
    t = s / reach
    target = ((1 - ease(t)) * elevation + ease(t) * ground[-1] +
              reach * t * (1 - t) * (slope * (1 - t) - end_slope * t))
    return xy, target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--node', default='node')
    parser.add_argument('--output', type=Path, default=DATA / 'grade-separations.json')
    args = parser.parse_args()
    sources = {n: fingerprint(DATA / f'{n}.bin') for n in CALIBRATED_SOURCES}
    if sources != CALIBRATED_SOURCES:
        raise ValueError('Jiný mapový výřez, znovu prověřit místní kalibraci.')
    raw = ROOT / 'data-raw'
    # Ověření vstupů přes jejich manifesty. Poté se použije mmap bez kopie rastru.
    for name in ('dmr', 'dmp'):
        load_dem(raw / f'{name}.npy', read_array=False)
    x0, z0 = to_xz(BBOX[2], BBOX[1])
    dx = DEM_STEP * 72066
    dz = DEM_STEP * 111224
    dmr, dmp = (Raster(np.load(raw / f'{name}.npy', mmap_mode='r'), x0, z0, dx, dz, centers=True)
                for name in ('dmr', 'dmp'))
    th, tp = read_pack(DATA / 'terrain.bin')
    grid = interpolate_base(th, tp)
    lh, lp = read_pack(DATA / 'landscape.bin')
    steps = CHUNK // lh['g']
    detail = np.zeros(grid.shape, np.int16)
    for tile, offsets in zip(lp['tiles'], lp['offsets'].reshape(-1, steps + 1, steps + 1)):
        j, i = divmod(int(tile), lh['cols'])
        detail[j * steps:j * steps + steps + 1, i * steps:i * steps + steps + 1] = offsets
    grid += detail * np.float32(lh['q'])
    base = Raster(grid, th['x0'], th['z0'], lh['g'], lh['g'])
    sources['landscape'] = fingerprint(DATA / 'landscape.bin')
    tables = {kind: read_pack(DATA / f'{kind}s.bin')[1] for kind in ('road', 'rail')}
    baseline = json.loads(check_output([args.node, str(ROOT / 'tools/audit_grade_separations.mjs'),
                                       '--baseline', '--json'], cwd=ROOT))
    features = baseline['features']
    crossings = baseline['crossings']
    key = lambda number: (features[str(number)]['kind'], features[str(number)]['index'])
    findings = [c for c in crossings if c['delta'] < 3 and all(features[str(c[k])]['drivable'] for k in ('a', 'b'))
                and features[str(c['a'])]['flags'] & 2 and not features[str(c['b'])]['flags'] & 4]
    if len(findings) != 110:
        raise ValueError(f'Jiný mapový výřez, znovu prověřit místní kalibraci ({len(findings)} průsečíků).')

    selected = {key(c['a']) for c in findings} | D5_DECKS
    all_lines = {}
    def line(k):
        if k not in all_lines:
            all_lines[k] = Line(tables[k[0]], k[1])
        return all_lines[k]

    # Samostatně zmapované chodníky a cyklostezky na stejném mostě mají vlastní profil.
    # Zahrň jen souběžné mostovky u stejného spodního tahu.
    companions = []
    for c in crossings:
        upper, lower = (features[str(c[k])] for k in ('a', 'b'))
        if (upper['kind'] != 'road' or upper['className'] not in ('FOOTWAY', 'CYCLEWAY') or
                not upper['flags'] & 2 or not lower['drivable'] or lower['flags'] & 4):
            continue
        for f in findings:
            if math.hypot(c['x'] - f['x'], c['z'] - f['z']) > 28:
                continue
            main, bottom = (features[str(f[k])] for k in ('a', 'b'))
            if main['kind'] != 'road' or main['layer'] != upper['layer']:
                continue
            same_way = (bottom['kind'] == lower['kind'] == 'road' and
                        bottom['label'] == lower['label'] != 'bez názvu')
            if c['b'] != f['b'] and not same_way:
                continue
            _, u = line(key(c['a'])).locate(c['x'], c['z'])
            _, v = line(key(f['a'])).locate(f['x'], f['z'])
            if abs(u[0] * v[1] - u[1] * v[0]) <= 0.37:
                selected.add(key(c['a']))
                companions.append(c)
                break

    touching = defaultdict(list)
    for kind, pack in tables.items():
        for i in range(len(pack['x0'])):
            if kind == 'road' and pack['flags'][i] & (4 | 128):
                continue
            a, b = pack['start'][i:i + 2]
            x, z = int(pack['x0'][i]), int(pack['z0'][i])
            other = x + int(pack['dx'][a:b].sum()), z + int(pack['dz'][a:b].sum())
            touching[(kind, x, z)].append(((kind, i), False))
            touching[(kind, *other)].append(((kind, i), True))

    def endpoint(k, reverse):
        p = line(k).points[-1 if reverse else 0]
        return k[0], *np.rint(p * 10).astype(int)

    # Rekonstruujte také navazující mostní díly stejné úrovně, aby na spoji nevznikl schod.
    todo = list(sorted(selected))
    for k in todo:
        p = tables[k[0]]
        for reverse in (False, True):
            for n, rev in touching[endpoint(k, reverse)]:
                if n in selected or not p['flags'][n[1]] & 2:
                    continue
                if k[0] == 'road' and p['layer'][k[1]] != p['layer'][n[1]]:
                    continue
                if line(n).along[-1] > 400:
                    continue
                selected.add(n)
                todo.append(n)
    updates = {}
    nodes = defaultdict(list)
    for k in sorted(selected):
        at = line(k)
        level = DECK_LEVELS.get(k)
        if k in D5_DECK_ENDS:
            updates[k] = np.interp(at.along, [0, at.along[-1]], D5_DECK_ENDS[k])
        else:
            updates[k] = np.full(len(at.points), level) if level is not None else deck_profile(at, dmp)
        for reverse in (False, True):
            nodes[endpoint(k, reverse)].append((k, reverse))
    for ends in nodes.values():
        if len(ends) < 2:
            continue
        y = float(np.median([updates[k][-1 if rev else 0] for k, rev in ends]))
        for k, rev in ends:
            s = line(k).along
            w = ease(1 - (s[-1] - s if rev else s) / min(20., s[-1] * 0.55))
            updates[k] += w * (y - updates[k][-1 if rev else 0])

    def width(k):
        return (max(2.1, float(tables['road']['w'][k[1]]) * 0.5 + 0.8)
                if k[0] == 'road' else 3.0)

    edits = TerrainEdits(base)
    for end, entries in nodes.items():
        height = float(np.median([updates[k][-1 if rev else 0] for k, rev in entries]))
        d5_end = next(((k, reverse) for k, reverse in entries if k in D5_DECKS), None)
        for n, rev in touching[end]:
            if n in selected or tables[n[0]]['flags'][n[1]] & 2:
                continue
            at = line(n)
            endpoint_xy = at.points[-1 if rev else 0]
            # Násep napojte v místě, kde stávající terén není ve výšce mostovky.
            start = float(base.sample(endpoint_xy, triangle=True))
            if abs(height - start) < 0.08:
                continue
            if d5_end and n[0] == 'road' and tables['road']['cls'][n[1]] <= 1:
                bridge, reverse = d5_end
                a, b = (-2, -1) if reverse else (1, 0)
                slope = (updates[bridge][b] - updates[bridge][a]) / abs(line(bridge).along[b] - line(bridge).along[a])
                xy, target = approach_profile(at, rev, height - 0.05, slope, base)
                edits.follow(xy, target, width(n), 5.)
                continue
            reach = min(at.along[-1], min(65., max(9., abs(height - start) * 18.)))
            s = at.stations(0, reach)
            xy = at.at(at.along[-1] - s if rev else s)
            terrain = base.sample(xy, triangle=True)
            target = terrain + (height - start) * ease(1 - s / max(0.01, reach))
            edits.paint(xy, target, width(n), cut=height < start)

    floor = defaultdict(list)
    for c in [*findings, *companions]:
        upper, lower = key(c['a']), key(c['b'])
        us, ud = line(upper).locate(c['x'], c['z'])
        lo = line(lower)
        ls, ld = lo.locate(c['x'], c['z'])
        height = float(np.interp(us, line(upper).along, updates[upper]))
        y = float(np.median(dmr.sample(lo.at(ls + np.array([-2, -1, 0, 1, 2])))))
        posted = POSTED_CLEARANCE.get(lower[1]) if lower[0] == 'road' else None
        clearance = (posted if posted is not None else 2.80 if lower[0] == 'road' else 4.40) + SLAB + GRID_MARGIN
        target = min(FLOOR_LEVELS.get(lower, y), height - clearance)
        coverage = (width(upper) + 1.1) / max(0.42, abs(ud[0] * ld[1] - ud[1] * ld[0]))
        floor[lower].append((ls, target, coverage))

    for k, conditions in sorted(floor.items()):
        at = line(k)
        lo = max(0., min(s - core - 48 for s, _, core in conditions))
        hi = min(at.along[-1], max(s + core + 48 for s, _, core in conditions))
        s = at.stations(lo, hi)
        xy = at.at(s)
        terrain = base.sample(xy, triangle=True)
        target = terrain.copy()
        protection = np.zeros(len(s))
        for origin, level, core in conditions:
            baseline_y = float(base.sample(at.at(origin), triangle=True))
            reach = min(48., max(12., (baseline_y - level) * 13.))
            blend = ease(1 - (np.abs(s - origin) - core) / reach)
            target = np.minimum(target, terrain + blend * np.minimum(0., level - terrain))
            protection = np.maximum(protection, ease(1 - (np.abs(s - origin) - core) / 12))
        # V Bolevci je zářez mezi opěrami, břehy hned za nimi zůstávají vysoko.
        shoulder = 2. if k == BOLEVEC_ROAD else 4.5
        edits.paint(xy, target, width(k), cut=True, protection=protection, shoulder=shoulder)

    cernice_abutments = []
    for index, station in ((4164, 0), (4166, 0), (4167, -1), (4169, -1)):
        bridge = line(('road', index))
        end = bridge.points[station]
        outward = end - bridge.points[1 if station == 0 else -2]
        cernice_abutments.append((end, outward / np.linalg.norm(outward), width(('road', index))))
    track_underpasses = []
    for k, (anchor, limits, levels) in D5_FLOORS.items():
        at = line(k)
        center, _ = at.locate(*anchor)
        left, right = np.array(limits) + center
        s = at.stations(max(0., left - 12.), min(at.along[-1], right + 12.))
        xy = at.at(s)
        ground = base.sample(xy, triangle=True)
        blend = ease(1 - np.maximum(left - s, s - right) / 12.)
        target = ground + blend * (np.interp(s, [left, right], levels) - ground)
        # Polní cesty v Černicích běží těsně pod čely mostovek. Drž zářez
        # v šířce cesty, jinak se dvoumetrová síť propadne i v nájezdu D5.
        if k[0] == 'road' and k[1] in (31802, 19138):
            edits.follow(xy, target, 1.8, 1.15, floor=True, abutments=cernice_abutments if k[1] == 31802 else ())
        else:
            edits.follow(xy, target, max(width(k), 3.), 2.5, floor=True)
        if k == LITICE_TRACK:
            portals = np.rint(at.at(np.array([left, right])) * 10).astype(int).ravel().tolist()
            track_underpasses.append(portals + [21, 48])

    # Čelo mostu v hrubém rastru někdy zasahuje nad jízdní plochu.
    # Srovnej i jeho okraj, snižování podjezdů přitom zůstane zachováno.
    for k, levels in sorted(updates.items()):
        at = line(k)
        s = at.stations()
        target = np.interp(s, at.along, levels) - 0.05
        edits.paint(at.at(s), target, width(k), cut=True, cap=True)

    # Podpěry se smějí vytvářet jen mimo pás křížené silnice nebo koleje.
    keep_clear = {(round(c['x'] * 10), round(c['z'] * 10), round((width(key(c['b'])) + 1.4) * 10))
                  for c in crossings if key(c['a']) in selected}
    result = {
        'version': 1, 'sources': sources,
        'grid': STEP, 'terrain': edits.encoded(), 'clear': sorted(keep_clear),
        'roads': [], 'rails': [], 'railAbutments': [BOLEVEC_BRIDGE[1]],
        'trackUnderpasses': track_underpasses,
    }
    for kind, index in sorted(updates):
        p = line((kind, index)).points
        ends = np.rint(np.r_[p[0], p[-1]] * 10).astype(int).tolist()
        result[kind + 's'].append([index, ends, np.rint(updates[(kind, index)] * 100).astype(int).tolist()])
    args.output.write_text(json.dumps(result, separators=(',', ':'), ensure_ascii=False) + '\n')
    print(f'Průsečíky {len(findings)}, díly mostů {len(updates)}, body terénu {len(result["terrain"])}')


if __name__ == '__main__':
    main()
