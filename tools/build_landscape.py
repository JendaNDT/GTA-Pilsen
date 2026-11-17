#!/usr/bin/env python3
"""Vybere a sbalí jemnější terén z již staženého reliéfu ČÚZK."""

import argparse
import json
import math
import struct
from collections import defaultdict
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from build_data import LAND, ROAD_CLASS, write_pack
from coordinates import world_bounds
from map_sources import load_dem
from terrain import CHUNK


ROOT = Path(__file__).resolve().parents[1]
QUANTUM = 0.05
STRIDE = 4
TILE = CHUNK // STRIDE
FADE = 16
SOURCES = ('terrain', 'roads', 'rails', 'buildings', 'land')


def read_pack(path):
    raw = path.read_bytes()
    magic, size = struct.unpack_from('<4sI', raw)
    if magic != b'PLZ1':
        raise ValueError(f'{path.name}: neznámý formát')
    header = json.loads(raw[8:8 + size])
    arrays = {name: np.frombuffer(raw, dtype='<' + item['dtype'], count=item['length'],
                                  offset=8 + size + item['offset'])
              for name, item in header['arrays'].items()}
    return header, arrays


def fingerprint(path):
    value = 2166136261
    for byte in path.read_bytes():
        value = ((value ^ byte) * 16777619) & 0xffffffff
    return f'{value:08x}'


def coords(pack, i):
    start, end = pack['start'][i:i + 2]
    x = np.r_[pack['x0'][i], pack['dx'][start:end]].cumsum()
    z = np.r_[pack['z0'][i], pack['dz'][start:end]].cumsum()
    return x, z


def protection(data, origin, size):
    image = Image.new('L', size)
    draw = ImageDraw.Draw(image)
    x0, z0 = origin

    def pixels(xs, zs):
        return list(zip(np.rint((xs * 0.1 - x0) / STRIDE).astype(int).tolist(),
                        np.rint((zs * 0.1 - z0) / STRIDE).astype(int).tolist()))

    def corridor(points, radius):
        radius = math.ceil(radius / STRIDE)
        draw.line(points, fill=255, width=2 * radius + 1, joint='curve')
        for x, z in (points[0], points[-1]):
            draw.ellipse((x - radius, z - radius, x + radius, z + radius), fill=255)

    for name in ('roads', 'rails'):
        header, pack = data[name]
        for i in range(header['count']):
            if name == 'rails':
                radius = 7
            else:
                margin = 7 if pack['cls'][i] <= ROAD_CLASS['service'] else 4
                radius = float(pack['w'][i]) / 2 + margin + (5 if pack['flags'][i] & 4 else 0)
            corridor(pixels(*coords(pack, i)), radius)

    header, pack = data['buildings']
    for i in range(header['count']):
        ring = pack['bRing'][i]
        start, end = pack['ringStart'][ring:ring + 2]
        xs = pack['vdx'][start:end].astype(np.int32) + pack['ax'][i]
        zs = pack['vdz'][start:end].astype(np.int32) + pack['az'][i]
        a, b = pixels(np.array([xs.min(), xs.max()]), np.array([zs.min(), zs.max()]))
        draw.rectangle((a[0] - 2, a[1] - 2, b[0] + 2, b[1] + 2), fill=255)

    _, pack = data['land']
    for i in np.flatnonzero(pack['cls'] == LAND['water']):
        ring = pack['pRing'][i]
        start, end = pack['ringStart'][ring:ring + 2]
        points = pixels(pack['vx'][start:end], pack['vz'][start:end])
        draw.polygon(points, fill=255)
        draw.line([*points, points[0]], fill=255, width=3, joint='curve')
    for i in np.flatnonzero(pack['lCls'] <= 3):
        start, end = pack['lStart'][i:i + 2]
        corridor(pixels(pack['lx'][start:end], pack['lz'][start:end]), 3 + (4 if pack['lCls'][i] == 0 else 0))

    blurred = image.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.5))
    return np.maximum(np.asarray(image), np.asarray(blurred))


def interpolate_base(header, pack):
    rows, cols = header['rows'], header['cols']
    increments = np.c_[pack['rowStart'], pack['d'].reshape(rows, cols - 1)]
    coarse = increments.cumsum(axis=1, dtype=np.int32).astype(np.float32) * header['q'] + header['base']
    base = np.empty((2 * rows - 1, 2 * cols - 1), np.float32)
    base[::2, ::2] = coarse
    base[::2, 1::2] = (coarse[:, :-1] + coarse[:, 1:]) * 0.5
    base[1::2, ::2] = (coarse[:-1, :] + coarse[1:, :]) * 0.5
    # Úhlopříčka mezi body 10 a 01 je shodná s trojúhelníky herní sítě.
    base[1::2, 1::2] = (coarse[1:, :-1] + coarse[:-1, 1:]) * 0.5
    return base


def elevation_offsets(raster, bbox, origin, base, protected):
    x0, z0 = origin
    west, east, north, south = world_bounds(bbox)
    ny, nx = raster.shape
    rows, cols = base.shape
    gx = (x0 + np.arange(cols) * STRIDE - west) * nx / (east - west) - 0.5
    gz = (z0 + np.arange(rows) * STRIDE - north) * ny / (south - north) - 0.5
    ix = np.clip(gx, 0, nx - 1.001).astype(int)
    fx = np.clip(gx - ix, 0, 1).astype(np.float32)
    corrections = np.zeros(base.shape, dtype=np.int8)
    for first in range(0, rows, 128):
        sl = slice(first, first + 128)
        iz = np.clip(gz[sl], 0, ny - 1.001).astype(int)[:, None]
        fz = np.clip(gz[sl, None] - iz, 0, 1).astype(np.float32)
        a, b = raster[iz, ix], raster[iz, ix + 1]
        c, d = raster[iz + 1, ix], raster[iz + 1, ix + 1]
        valid = (a > -1000) & (b > -1000) & (c > -1000) & (d > -1000)
        valid &= (gx >= 0) & (gx < nx - 1) & (gz[sl, None] >= 0) & (gz[sl, None] < ny - 1)
        measured = (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz
        change = (measured - base[sl]) * (1 - protected[sl].astype(np.float32) / 255)
        corrections[sl] = np.where(valid, np.rint(np.clip(change / QUANTUM, -100, 100)), 0)
    return corrections


def tile_slice(tile):
    return slice(tile * TILE, (tile + 1) * TILE + 1)


def select_tiles(corrections, origin, pilot):
    rows, cols = ((size - 1) // TILE for size in corrections.shape)
    sectors = defaultdict(list)
    picked = set()
    significant = 0
    for j in range(rows):
        for i in range(cols):
            values = np.abs(corrections[tile_slice(j), tile_slice(i)])
            count = np.count_nonzero(values >= 13)
            x, z = origin[0] + (i + 0.5) * CHUNK, origin[1] + (j + 0.5) * CHUNK
            if count >= 48 and any((x - a) ** 2 + (z - b) ** 2 < 850 ** 2 for a, b in pilot):
                picked.add((i, j))
            if count < 80:
                continue
            significant += 1
            score = np.maximum(values.astype(np.float32) - 9, 0)
            sectors[i // 16, j // 16].append((float(np.sum(score ** 2)), i, j))
    for candidates in sectors.values():
        for _, i, j in sorted(candidates, reverse=True)[:12]:
            picked.add((i, j))
    return picked, significant


def edge_fade(i, j, selected):
    axis = np.arange(TILE + 1) * STRIDE
    distance = np.full((TILE + 1, TILE + 1), FADE, dtype=np.float32)
    for dz in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if (i + dx, j + dz) in selected:
                continue
            x = np.maximum(np.maximum(dx * CHUNK - axis, axis - (dx + 1) * CHUNK), 0)
            z = np.maximum(np.maximum(dz * CHUNK - axis, axis - (dz + 1) * CHUNK), 0)
            distance = np.minimum(distance, np.hypot(x, z[:, None]))
    t = distance / FADE
    return t * t * (3 - 2 * t)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, default=ROOT / 'public/data')
    parser.add_argument('--dmr', type=Path, default=ROOT / 'data-raw/dmr.npy')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    output = args.output or args.data / 'landscape.bin'
    meta = json.loads((args.data / 'meta.json').read_text(encoding='utf-8'))
    _, source = load_dem(args.dmr, read_array=False)
    if meta['sources']['elevation']['dmr']['sha256'] != source['sha256']:
        raise ValueError('Výškopis detailů musí odpovídat výškopisu základní mapy.')
    data = {name: read_pack(args.data / f'{name}.bin') for name in SOURCES}
    header, values = data['terrain']
    if header['g'] != STRIDE * 2:
        raise ValueError('Jemná síť předpokládá základní síť po 8 metrech.')
    origin = (header['x0'], header['z0'])
    base = interpolate_base(header, values)
    protected = protection(data, origin, base.shape[::-1])
    del data
    raster = np.load(args.dmr, mmap_mode='r')
    change = elevation_offsets(raster, source['grid']['bbox'], origin, base, protected)
    pilot = [(x, z) for x, z, name, *_ in meta['places'] if name in {'Klabava', 'Rokycany', 'Hrádek', 'Dobřív'}]
    picked, significant = select_tiles(change, origin, pilot)
    columns = (base.shape[1] - 1) // TILE
    tiles, offsets = [], []
    for i, j in sorted(picked, key=lambda cell: (cell[1], cell[0])):
        section = np.rint(change[tile_slice(j), tile_slice(i)] * edge_fade(i, j, picked)).astype(np.int8)
        tiles.append(j * columns + i)
        offsets.append(section.ravel())
    header = {'g': STRIDE, 'q': QUANTUM, 'x0': origin[0], 'z0': origin[1], 'cols': columns,
              'sources': {name: fingerprint(args.data / f'{name}.bin') for name in SOURCES},
              'dmr': source['sha256']}
    with TemporaryDirectory(dir=output.parent) as folder:
        path = Path(folder) / output.name
        write_pack(path, header, {'tiles': np.array(tiles, dtype=np.uint32),
                                  'offsets': np.concatenate(offsets) if offsets else np.array([], np.int8)})
        path.replace(output)
    print(f'Prověřeno {change.size:,} uzlů po 4 m, {significant:,} dlaždic s výraznějším reliéfem, '
          f'{len(tiles):,} vybraných dlaždic v {len({(i // 16, j // 16) for i, j in picked})} oblastech.')


if __name__ == '__main__':
    main()
