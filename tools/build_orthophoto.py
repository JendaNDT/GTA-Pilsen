#!/usr/bin/env python3
"""Převzorkuje Ortofoto ČR do bloků zarovnaných na herní dlaždice."""

import argparse
import math
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from shutil import copyfile, copyfileobj
from tempfile import TemporaryDirectory
from xml.etree import ElementTree as ET
from zipfile import ZipFile

import numpy as np
from PIL import Image, ImageDraw
from pyproj import Transformer

from build_data import LAND
from build_landscape import fingerprint, read_pack
from coordinates import to_wgs84, to_xz
from fetch_orthophoto import (ATOM_URL, RAW_DIR, ROOT, process_sheets, read_json,
                              read_url, select_feeds, sha256, write_json)
from terrain import CHUNK


METERS = 2
BLOCK = CHUNK * 4
PIXELS = BLOCK // METERS
JPEG_SIZE = (20000, 16000)
SOURCE_CRS = "EPSG:5514"
FROM_WGS84 = Transformer.from_crs("EPSG:4326", SOURCE_CRS, always_xy=True)
TO_WGS84 = Transformer.from_crs(SOURCE_CRS, "EPSG:4326", always_xy=True)
NEUTRAL = (128, 128, 128)
SATURATION = 0.92
WEBP_QUALITY = 75
PILOTS = ((15975, -690), (11645, -690))
OPEN_LAND = {LAND[name] for name in ("farmland", "meadow", "grass", "scrub")}
# Pořadí odpovídá LAND_GROUP v chunks.js, vodu tam vyřízne poslední průchod.
LAND_ORDER = {LAND[name]: group for group, names in enumerate((
    "farmland meadow residential commercial industrial railway construction",
    "forest scrub grass park allotments cemetery garden",
    "pitch playground parking plaza sand",
    "water",
)) for name in names.split()}


@dataclass(frozen=True)
class SheetGrid:
    x: float
    y: float
    step: float

    def pixel(self, easting, northing):
        return (easting - self.x) / self.step, (self.y - northing) / self.step

    def downsampled(self, step):
        offset = (step - self.step) / 2
        return SheetGrid(self.x + offset, self.y - offset, step)


def read_jgw(text):
    step, rotation_y, rotation_x, down, x, y = map(float, text.split())
    if step != 0.125 or down != -step or rotation_x or rotation_y:
        raise ValueError("Neočekávaná mřížka listu ČÚZK v S-JTSK.")
    return SheetGrid(x, y, step)


def projected_pixels(grid, x, z):
    lat, lon = to_wgs84(x, z)
    return grid.pixel(*FROM_WGS84.transform(lon, lat))


def sample_sheet(rgb, col, row):
    height, width = rgb.shape[:2]
    inside = ((col >= -0.5) & (col < width - 0.5) &
              (row >= -0.5) & (row < height - 0.5))
    x = np.clip(col[inside], 0, width - 1)
    y = np.clip(row[inside], 0, height - 1)
    left, top = x.astype(int), y.astype(int)
    right, bottom = np.minimum(left + 1, width - 1), np.minimum(top + 1, height - 1)
    fx, fy = (x - left)[:, None], (y - top)[:, None]
    upper = rgb[top, left] * (1 - fx) + rgb[top, right] * fx
    lower = rgb[bottom, left] * (1 - fx) + rgb[bottom, right] * fx
    return inside, np.rint(upper * (1 - fy) + lower * fy).astype(np.uint8)


def read_sheet_image(record, archive_path):
    name = record["id"]
    with ZipFile(archive_path) as archive, TemporaryDirectory(dir=archive_path.parent) as tmp:
        grid = read_jgw(archive.read(f"{name}.jgw").decode("ascii")).downsampled(METERS)
        jpeg = Path(tmp) / "list.jpg"
        with archive.open(f"{name}.jpg") as original, jpeg.open("wb") as target:
            copyfileobj(original, target)
        # Pillow běžně chrání před takto velkými obrázky. Rozměr tohoto zdroje je známý.
        previous_limit = Image.MAX_IMAGE_PIXELS
        Image.MAX_IMAGE_PIXELS = math.prod(JPEG_SIZE)
        try:
            with Image.open(jpeg, formats=("JPEG",)) as original:
                if original.size != JPEG_SIZE:
                    raise ValueError(f"Neočekávané rozměry snímku {name}: {original.size}.")
                original.draft("RGB", tuple(dimension // 8 for dimension in JPEG_SIZE))
                size = tuple(round(dimension * 0.125 / METERS) for dimension in JPEG_SIZE)
                rgb = original.resize(size, Image.Resampling.LANCZOS)
                return grid, np.array(rgb)
        finally:
            Image.MAX_IMAGE_PIXELS = previous_limit


def world_grid(bounds):
    origin = [math.floor(bounds[axis] / CHUNK) * CHUNK for axis in ("minX", "minZ")]
    size = [math.ceil((bounds[axis] - start) / BLOCK) * PIXELS
            for axis, start in zip(("maxX", "maxZ"), origin)]
    return origin, size


def sheet_window(grid, shape, origin, size):
    height, width = shape
    west, north = grid.x - grid.step / 2, grid.y + grid.step / 2
    east, south = west + width * grid.step, north - height * grid.step
    xs_sk, ys_sk = [west, east, west, east], [south, south, north, north]
    lon, lat = TO_WGS84.transform(xs_sk, ys_sk)
    xs, zs = to_xz(np.array(lat), np.array(lon))
    starts = [max(0, math.floor((min(values) - start) / METERS) - 2)
              for values, start in zip((xs, zs), origin)]
    ends = [min(dim, math.ceil((max(values) - start) / METERS) + 2)
            for values, start, dim in zip((xs, zs), origin, size)]
    return tuple(slice(start, end) for start, end in zip(starts, ends))


class Mosaic:
    """Rozpracovaná herní mřížka na disku. Originální list se po převodu smaže."""

    def __init__(self, directory, origin, size):
        self.directory = directory
        self.origin = origin
        self.size = size
        directory.mkdir(parents=True, exist_ok=True)
        layout_path = directory / "grid.json"
        layout = {"version": 1, "origin": origin, "size": size, "meters": METERS}
        saved = read_json(layout_path, None)
        if saved is not None and saved != layout:
            raise ValueError("Rozpracovaná mozaika používá jinou mřížku. Zvol jinou složku --work.")
        shape = tuple(reversed(size))
        mode = "r+" if saved else "w+"
        self.rgb = np.memmap(directory / "rgb.bin", dtype=np.uint8, mode=mode, shape=(*shape, 3))
        self.owners = np.memmap(directory / "owners.bin", dtype=np.uint16, mode=mode, shape=shape)
        self.sheets_path = directory / "converted.json"
        self.sheets = read_json(self.sheets_path, {})
        if saved is None:
            write_json(layout_path, layout)

    def is_ready(self, record):
        return self.sheets.get(record["id"], {}).get("sha256") == record["sha256"]

    def consume(self, record, archive):
        grid, rgb = read_sheet_image(record, archive)
        sx, sz = sheet_window(grid, rgb.shape[:2], self.origin, self.size)
        x = self.origin[0] + (np.arange(sx.start, sx.stop) + 0.5) * METERS
        z = self.origin[1] + (np.arange(sz.start, sz.stop) + 0.5) * METERS
        col, row = projected_pixels(grid, *np.meshgrid(x, z))
        inside, samples = sample_sheet(rgb, col, row)
        name = record["id"]
        index = self.sheets[name]["number"] if name in self.sheets else len(self.sheets) + 1
        self.rgb[sz, sx][inside] = samples
        self.owners[sz, sx][inside] = index
        self.rgb.flush()
        self.owners.flush()
        self.sheets[name] = {"number": index, "sha256": record["sha256"]}
        write_json(self.sheets_path, self.sheets)


def draw_land_mask(path, bbox):
    """Otevřenou krajinu vybere ve stejném pořadí a se stejnými otvory jako hra."""
    min_x, min_z, width, height = bbox
    mask = Image.new("L", (width, height))
    header, land = read_pack(path)
    order = sorted((i for i in range(header["count"]) if land["cls"][i] in LAND_ORDER),
                   key=lambda i: LAND_ORDER[land["cls"][i]])
    for i in order:
        begin, end = land["pRing"][i:i + 2]
        starts = land["ringStart"][begin:end + 1]
        verts = slice(starts[0], starts[-1])
        x = (land["vx"][verts] * 0.1 - min_x) / METERS - 0.5
        z = (land["vz"][verts] * 0.1 - min_z) / METERS - 0.5
        left, right = max(0, math.floor(x.min())), min(width, math.ceil(x.max()) + 1)
        top, bottom = max(0, math.floor(z.min())), min(height, math.ceil(z.max()) + 1)
        if left >= right or top >= bottom:
            continue
        polygon = Image.new("1", (right - left, bottom - top))
        draw = ImageDraw.Draw(polygon)
        points = list(zip(x - left, z - top))
        for ring, (start, stop) in enumerate(zip(starts, starts[1:])):
            draw.polygon(points[start - starts[0]:stop - starts[0]], fill=int(ring == 0))
        mask.paste(255 if land["cls"][i] in OPEN_LAND else 0, (left, top), polygon)
    return mask


def calibrate(mosaic):
    # Sousední vzorky na společné hraně jsou páry vzdálené jen dva herní metry.
    offsets = defaultdict(list)
    owners, rgb = mosaic.owners, mosaic.rgb
    for start in range(0, owners.shape[0], 128):
        end = min(start + 128, owners.shape[0])
        for first, second in ((np.s_[start:end, :-1], np.s_[start:end, 1:]),
                              (np.s_[start:min(end, owners.shape[0] - 1), :],
                               np.s_[start + 1:end + 1, :])):
            a, b = owners[first], owners[second]
            edge = (a != b) & (a > 0) & (b > 0)
            left, right = a[edge], b[edge]
            diff = rgb[first][edge].astype(np.int16) - rgb[second][edge]
            for l, r, d in zip(left.tolist(), right.tolist(), diff.tolist()):
                if l < r:
                    offsets[l, r].append(d)
                else:
                    offsets[r, l].append([-value for value in d])

    count = len(mosaic.sheets) + 1
    equations = [np.eye(count) * 0.35]
    targets = [np.zeros((count, 3))]
    for (left, right), differences in offsets.items():
        if len(differences) < 32:
            continue
        weight = min(2, math.sqrt(len(differences) / 256))
        equation = np.zeros((1, count))
        equation[0, [left, right]] = [-weight, weight]
        equations.append(equation)
        targets.append(np.median(differences, axis=0)[None, :] * weight)
    corrections = np.linalg.lstsq(np.vstack(equations), np.vstack(targets), rcond=None)[0]
    return np.clip(corrections, -14, 14)


def choose_blocks(bounds, origin, size, pilots):
    if not pilots:
        blocks = [(bx, bz) for bz in range(size[1] // PIXELS) for bx in range(size[0] // PIXELS)]
        return blocks, [bounds]
    blocks, regions = set(), []
    for x, z in PILOTS:
        bx = math.floor((x - origin[0]) / BLOCK - 0.5)
        bz = math.floor((z - origin[1]) / BLOCK - 0.5)
        blocks.update((bx + dx, bz + dz) for dx in (0, 1) for dz in (0, 1))
        regions.append({"minX": origin[0] + bx * BLOCK, "minZ": origin[1] + bz * BLOCK,
                        "maxX": origin[0] + (bx + 2) * BLOCK, "maxZ": origin[1] + (bz + 2) * BLOCK})
    return sorted(blocks), regions


def build_blocks(mosaic, blocks, bounds, data, destination, records):
    corrections = calibrate(mosaic)
    output = {}
    destination.mkdir(parents=True, exist_ok=True)
    ox, oz = mosaic.origin
    first_x, last_x = min(bx for bx, _ in blocks), max(bx for bx, _ in blocks)
    first_z, last_z = min(bz for _, bz in blocks), max(bz for _, bz in blocks)
    land_mask = draw_land_mask(data / "land.bin", (
        ox + first_x * BLOCK, oz + first_z * BLOCK,
        (last_x - first_x + 1) * PIXELS, (last_z - first_z + 1) * PIXELS,
    ))
    for bx, bz in blocks:
        x, z = ox + bx * BLOCK, oz + bz * BLOCK
        left, top = (bx - first_x) * PIXELS, (bz - first_z) * PIXELS
        mask = np.asarray(land_mask.crop((left, top, left + PIXELS, top + PIXELS))) > 0
        xs = x + (np.arange(PIXELS) + 0.5) * METERS
        zs = z + (np.arange(PIXELS) + 0.5) * METERS
        mask &= (xs >= bounds["minX"]) & (xs < bounds["maxX"])
        mask &= ((zs >= bounds["minZ"]) & (zs < bounds["maxZ"]))[:, None]
        if not mask.any():
            continue
        area = np.s_[bz * PIXELS:(bz + 1) * PIXELS, bx * PIXELS:(bx + 1) * PIXELS]
        owners = mosaic.owners[area][mask]
        if not owners.all():
            raise ValueError(f"V bloku {bx}_{bz} chybí {np.count_nonzero(owners == 0)} pixelů krajiny.")
        pixels = mosaic.rgb[area][mask] + corrections[owners]
        gray = pixels @ np.array([0.2126, 0.7152, 0.0722])
        pixels = gray[:, None] + (pixels - gray[:, None]) * SATURATION
        rgb = np.full((PIXELS, PIXELS, 3), NEUTRAL, dtype=np.uint8)
        rgb[mask] = np.clip(np.rint(pixels), 0, 255).astype(np.uint8)
        key = f"{bx}_{bz}"
        name = f"{key}.webp"
        path = destination / name
        Image.fromarray(rgb).save(path, quality=WEBP_QUALITY, method=4)
        output[key] = {"file": name, "sha256": sha256(path), "bytes": path.stat().st_size}

    years = sorted({record["year"] for record in records})
    identifiers = {info["number"]: key for key, info in mosaic.sheets.items()}
    manifest = {
        "version": 1, "source": {"name": "ČÚZK – Ortofoto ČR", "url": ATOM_URL, "license": "CC BY 4.0"},
        "years": years, "crs": SOURCE_CRS, "origin": mosaic.origin, "metersPerPixel": METERS,
        "blockMeters": BLOCK, "sources": {name: fingerprint(data / f"{name}.bin") for name in ("terrain", "land")},
        "color": {"saturation": SATURATION, "neutral": list(NEUTRAL), "webpQuality": WEBP_QUALITY,
                  "sheetOffsets": {identifiers[i]: delta.round(3).tolist()
                                   for i, delta in enumerate(corrections) if i}},
        "blocks": output,
    }
    write_json(destination / "index.json", manifest)
    print(f"{len(output)} bloků, {sum(info['bytes'] for info in output.values()) / 2**20:.2f} MiB.")


def publish_candidate(candidate, data, destination):
    manifest_path = candidate / "index.json"
    manifest = read_json(manifest_path, {})
    sources = {name: fingerprint(data / f"{name}.bin") for name in ("terrain", "land")}
    if manifest.get("version") != 1 or manifest.get("sources") != sources:
        raise ValueError("Kandidát neodpovídá aktuálním datům hry.")
    size = manifest_path.stat().st_size
    files = set()
    for key, info in manifest["blocks"].items():
        name = f"{key}.webp"
        source = candidate / name
        if (not re.fullmatch(r"\d+_\d+", key) or info["file"] != name or
                info["bytes"] != source.stat().st_size or info["sha256"] != sha256(source)):
            raise ValueError(f"Neúplný nebo změněný blok kandidáta: {key}.")
        size += info["bytes"]
        files.add(name)
    if size > 30 * 2**20:
        raise ValueError("Kandidát překračuje limit 30 MiB.")
    destination.mkdir(parents=True, exist_ok=True)
    for name in sorted(files):
        copyfile(candidate / name, destination / name)
    write_json(destination / "index.json", manifest)
    for path in destination.glob("*.webp"):
        if re.fullmatch(r"\d+_\d+\.webp", path.name) and path.name not in files:
            path.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=ROOT / "public/data")
    parser.add_argument("--raw", type=Path, default=RAW_DIR)
    parser.add_argument("--work", type=Path, default=RAW_DIR / "mosaic")
    parser.add_argument("--out", type=Path)
    parser.add_argument("--atom", type=Path, help="Použít stažený katalog ATOM.")
    parser.add_argument("--pilots", action="store_true", help="Sestavit jen dva pilotní úseky.")
    parser.add_argument("--publish", action="store_true", help="Ověřit a převzít porovnaného kandidáta do public/.")
    args = parser.parse_args()
    out = args.out or ROOT / "data-raw" / "kandidat" / ("ortho-pilot" if args.pilots else "orthophoto")
    if args.publish:
        publish_candidate(out, args.data, ROOT / "public/detail/orthophoto")
        return
    bounds = read_json(args.data / "meta.json", {})["bounds"]
    origin, size = world_grid(bounds)
    blocks, regions = choose_blocks(bounds, origin, size, args.pilots)
    with args.atom.open("rb") if args.atom else read_url(ATOM_URL) as response:
        catalogue = ET.parse(response)
    feeds = sorted({feed for region in regions for feed in select_feeds(catalogue, region)})
    mosaic = Mosaic(args.work, origin, size)
    records = process_sheets(feeds, args.raw, mosaic.consume, mosaic.is_ready)
    build_blocks(mosaic, blocks, bounds, args.data, out, records)


if __name__ == "__main__":
    main()
