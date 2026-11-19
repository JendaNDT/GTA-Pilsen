#!/usr/bin/env python3
"""Přiřadí leaf_type z historického snímku OSM k existujícím stromům a půdorysům lesa."""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
import math
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from build_landscape import read_pack, fingerprint
from coordinates import to_xz


def aligned(points):
    return [(round(x * 10), round(z * 10)) for x, z in points]


def coordinates(points):
    return [to_xz(p['lat'], p['lon']) for p in points]


def row_points(points):
    if not points:
        return []
    result = [points[0]]
    carry = 0.0
    for (ax, az), (bx, bz) in zip(points, points[1:]):
        length = math.hypot(bx - ax, bz - az)
        distance = 9.0 - carry
        while distance < length:
            result.append((ax + (bx - ax) * distance / length, az + (bz - az) * distance / length))
            distance += 9.0
        carry = (carry + length) % 9.0
    return result


def build(data, source):
    _, trees = read_pack(data / 'trees.bin')
    _, land = read_pack(data / 'land.bin')
    by_position = defaultdict(list)
    for i, coord in enumerate(zip(trees['x'], trees['z'])):
        by_position[coord].append(i)
    by_vertex = defaultdict(list)
    sizes = {}
    for i, cls in enumerate(land['cls']):
        if cls not in (10, 11):
            continue
        ring = land['pRing'][i]
        start, end = land['ringStart'][ring:ring + 2]
        points = set(zip(land['vx'][start:end], land['vz'][start:end]))
        sizes[i] = len(points)
        for pt in points:
            by_vertex[pt].append(i)
    species, areas = {}, {}
    for item in source:
        tags = item['tags']
        leaf = {'broadleaved': 1, 'needleleaved': 2}.get(tags.get('leaf_type'))
        if not leaf:
            continue
        if item['type'] == 'node' and tags.get('natural') == 'tree':
            points = coordinates([item])
        elif item['type'] == 'way' and tags.get('natural') == 'tree_row':
            points = row_points(coordinates(item['geometry']))
        elif tags.get('natural') in ('wood', 'scrub') or tags.get('landuse') == 'forest':
            rings = [item['geometry']] if item['type'] == 'way' else [
                m['geometry'] for m in item.get('members', []) if m.get('geometry') and m['role'] != 'inner']
            vertices = set(p for ring in rings for p in aligned(coordinates(ring)))
            hits = Counter(i for p in vertices for i in by_vertex.get(p, ()))
            for i, count in hits.items():
                if count == sizes[i] and count >= 3:
                    areas[i] = leaf
            continue
        else:
            continue
        for coord in aligned(points):
            for i in by_position.get(coord, ()):
                species[i] = leaf
    return {'trees': sorted(species.items()), 'land': sorted(areas.items())}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--data', type=Path, default=Path('public/data'))
    ap.add_argument('--raw', type=Path, required=True)
    ap.add_argument('--output', type=Path, required=True)
    args = ap.parse_args()
    meta = json.loads((args.data / 'meta.json').read_text())
    bounds = ','.join(map(str, meta['sources']['bbox']))
    stamp = meta['osmTimestamp']
    query = f'[out:json][timeout:80][date:"{stamp}"];(nwr["leaf_type"]({bounds}););out geom;'
    endpoint = 'https://overpass-api.de/api/interpreter'
    receipt = args.raw.with_suffix('.request.json')
    if not args.raw.exists():
        request = Request(endpoint + '?' + urlencode({'data': query}), headers={'User-Agent': 'Plzen-naplno/0.1 tree-map'})
        with urlopen(request, timeout=120) as response:
            raw = response.read()
        args.raw.parent.mkdir(parents=True, exist_ok=True)
        args.raw.write_bytes(raw)
        receipt.write_text(json.dumps({'query': query, 'sha256': hashlib.sha256(raw).hexdigest()}))
    raw = args.raw.read_bytes()
    proof = json.loads(receipt.read_text())
    if proof != {'query': query, 'sha256': hashlib.sha256(raw).hexdigest()}:
        raise ValueError('Otisk odpovědi nebo datum dotazu neodpovídá podkladu.')
    response = json.loads(raw)
    if response.get('remark') or not response.get('elements'):
        raise ValueError('Výpis značek OSM je neúplný.')
    result = build(args.data, response['elements'])
    result.update(osm=stamp, sources={name: fingerprint(args.data / f'{name}.bin') for name in ('land', 'trees')})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, separators=(',', ':')) + '\n')
    print(f"OSM {stamp}, určených stromů {len(result['trees'])}, ploch {len(result['land'])}")


if __name__ == '__main__':
    main()
