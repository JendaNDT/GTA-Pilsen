#!/usr/bin/env python3
"""Převede surová data (data-raw/extract.pkl + výškopis ČÚZK) na kompaktní
herní soubory v public/data/.

Výstupy:
  buildings.bin  – půdorysy a skutečné výšky budov
  roads.bin      – silnice, chodníky, cesty
  rails.bin      – tramvajové a železniční koleje
  land.bin       – plochy (voda, lesy, parky, ...), vodní toky
  meta.json      – názvy ulic, linky MHD, podniky, adresy, památky, čtvrti

Souřadnice: metry, počátek na náměstí Republiky, x = východ, z = jih.
Vyžaduje: pip install numpy
"""
import argparse
import json
import math
import os
import pickle
import struct
import sys
import time
from collections import defaultdict
from tempfile import TemporaryDirectory

import numpy as np

import terrain as terrain_mod
from area import BBOX, OSM_BBOX
from coordinates import ORIGIN, to_xz, world_bounds
from traffic_data import build_traffic, highway_values
from map_sources import load_dem
from terrain import Terrain
from osm_source import extract_timestamp

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "..", "data-raw")
OUT = os.path.join(HERE, "..", "public", "data")

# ---------------------------------------------------------------- zápis ----

def write_pack(path, header, arrays):
    """Jednoduchý binární kontejner: 'PLZ1', délka hlavičky, JSON hlavička, pole."""
    meta = {}
    blobs = []
    off = 0
    for name, arr in arrays.items():
        arr = np.ascontiguousarray(arr)
        code = {"int8": "i1", "uint8": "u1", "int16": "i2", "uint16": "u2",
                "int32": "i4", "uint32": "u4", "float32": "f4"}[arr.dtype.name]
        pad = (-off) % 4
        if pad:
            blobs.append(b"\0" * pad)
            off += pad
        raw = arr.tobytes()
        meta[name] = {"dtype": code, "offset": off, "length": int(arr.size)}
        blobs.append(raw)
        off += len(raw)
    header = dict(header)
    header["arrays"] = meta
    hj = json.dumps(header, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    hj += b" " * ((-len(hj)) % 4)
    with open(path, "wb") as f:
        f.write(b"PLZ1")
        f.write(struct.pack("<I", len(hj)))
        f.write(hj)
        for b in blobs:
            f.write(b)
    print(f"  {os.path.basename(path)}: {os.path.getsize(path) / 1e6:.2f} MB")


# ------------------------------------------------------------ geometrie ----

def signed_area(pts):
    a = 0.0
    n = len(pts)
    for i in range(n):
        x1, z1 = pts[i]
        x2, z2 = pts[(i + 1) % n]
        a += x1 * z2 - x2 * z1
    return a / 2.0


def centroid(pts):
    sx = sum(p[0] for p in pts) / len(pts)
    sz = sum(p[1] for p in pts) / len(pts)
    return sx, sz


def clean_ring(pts, tol=0.06):
    """Odstraní zdvojené a kolineární body uzavřeného prstence."""
    if len(pts) >= 2 and pts[0] == pts[-1]:
        pts = pts[:-1]
    out = []
    for p in pts:
        if not out or (abs(p[0] - out[-1][0]) > 0.02 or abs(p[1] - out[-1][1]) > 0.02):
            out.append(p)
    if len(out) >= 2 and abs(out[0][0] - out[-1][0]) < 0.02 and abs(out[0][1] - out[-1][1]) < 0.02:
        out.pop()
    changed = True
    while changed and len(out) > 3:
        changed = False
        res = []
        n = len(out)
        for i in range(n):
            a = out[i - 1]
            b = out[i]
            c = out[(i + 1) % n]
            dx, dz = c[0] - a[0], c[1] - a[1]
            ln = math.hypot(dx, dz)
            if ln < 1e-6:
                d = math.hypot(b[0] - a[0], b[1] - a[1])
            else:
                d = abs((b[0] - a[0]) * dz - (b[1] - a[1]) * dx) / ln
            if d < tol and len(out) - (n - len(res) - (n - i)) > 3:
                changed = True
                continue
            res.append(b)
        if len(res) >= 3:
            out = res
        else:
            break
    return out


def dp_simplify(pts, tol, keep=None):
    """Douglas–Peucker pro lomenou čáru; keep = množina indexů, které zůstanou."""
    n = len(pts)
    if n <= 2:
        return list(range(n))
    marks = [False] * n
    marks[0] = marks[-1] = True
    if keep:
        for k in keep:
            marks[k] = True
    stack = []
    last = 0
    for i in range(1, n):
        if marks[i]:
            stack.append((last, i))
            last = i
    while stack:
        a, b = stack.pop()
        if b - a < 2:
            continue
        ax, az = pts[a]
        bx, bz = pts[b]
        dx, dz = bx - ax, bz - az
        ln = math.hypot(dx, dz)
        best, bi = -1.0, -1
        for i in range(a + 1, b):
            px, pz = pts[i]
            if ln < 1e-9:
                d = math.hypot(px - ax, pz - az)
            else:
                d = abs((px - ax) * dz - (pz - az) * dx) / ln
            if d > best:
                best, bi = d, i
        if best > tol:
            marks[bi] = True
            stack.append((a, bi))
            stack.append((bi, b))
    return [i for i in range(n) if marks[i]]


def point_in_ring(x, z, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, zi = ring[i]
        xj, zj = ring[j]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi:
            inside = not inside
        j = i
    return inside


def obb_fill(ring):
    """Poměr plochy půdorysu k ploše nejmenšího opsaného obdélníku (1 = obdélník)."""
    best = None
    n = len(ring)
    for i in range(n):
        x1, z1 = ring[i]
        x2, z2 = ring[(i + 1) % n]
        dx, dz = x2 - x1, z2 - z1
        ln = math.hypot(dx, dz)
        if ln < 0.3:
            continue
        dx /= ln
        dz /= ln
        us = [p[0] * dx + p[1] * dz for p in ring]
        vs = [-p[0] * dz + p[1] * dx for p in ring]
        a = (max(us) - min(us)) * (max(vs) - min(vs))
        if best is None or a < best:
            best = a
    if not best:
        return 0.0
    return abs(signed_area(ring)) / best


def obb_width(ring):
    """Kratší strana nejmenšího opsaného obdélníku."""
    best = None
    n = len(ring)
    for i in range(n):
        x1, z1 = ring[i]
        x2, z2 = ring[(i + 1) % n]
        dx, dz = x2 - x1, z2 - z1
        ln = math.hypot(dx, dz)
        if ln < 0.3:
            continue
        dx /= ln
        dz /= ln
        us = [p[0] * dx + p[1] * dz for p in ring]
        vs = [-p[0] * dz + p[1] * dx for p in ring]
        a, b = max(us) - min(us), max(vs) - min(vs)
        if best is None or a * b < best[0]:
            best = (a * b, min(a, b))
    return best[1] if best else 0.0


def assemble_rings(way_list):
    """Spojí cesty (seznamy (ids, pts)) do uzavřených prstenců podle id uzlů."""
    rings = []
    segs = [(list(ids), list(pts)) for ids, pts in way_list if len(ids) >= 2]
    used = [False] * len(segs)
    ends = defaultdict(list)
    for i, (ids, _) in enumerate(segs):
        ends[ids[0]].append(i)
        ends[ids[-1]].append(i)
    for i, (ids, pts) in enumerate(segs):
        if used[i]:
            continue
        used[i] = True
        cur_ids = list(ids)
        cur_pts = list(pts)
        while cur_ids[0] != cur_ids[-1]:
            tail = cur_ids[-1]
            nxt = None
            for j in ends[tail]:
                if not used[j]:
                    nxt = j
                    break
            if nxt is None:
                break
            used[nxt] = True
            nids, npts = segs[nxt]
            if nids[0] != tail:
                nids = nids[::-1]
                npts = npts[::-1]
            cur_ids.extend(nids[1:])
            cur_pts.extend(npts[1:])
        if cur_ids[0] == cur_ids[-1] and len(cur_pts) >= 4:
            rings.append(cur_pts)
    return rings


# ---------------------------------------------------------------- DEM ------

class Dem:
    def __init__(self):
        dmp, dmp_source = load_dem(os.path.join(RAW, "dmp.npy"))
        dmr, dmr_source = load_dem(os.path.join(RAW, "dmr.npy"))
        self.sources = {"dmp": dmp_source, "dmr": dmr_source}
        self.diff = dmp - dmr
        self.diff[(dmp < -1000) | (dmr < -1000)] = 0
        self.dmr = dmr          # holý terén (pro tvar krajiny)
        del dmp
        self.H, self.W = self.diff.shape
        self.x0, east, self.z0, south = world_bounds(BBOX)
        self.px = (east - self.x0) / self.W   # metrů na pixel (x)
        self.pz = (south - self.z0) / self.H  # metrů na pixel (z)

    def sample_polygon(self, ring, holes=()):
        """Vrátí výšky (DMP − DMR) pixelů uvnitř půdorysu."""
        xs = [p[0] for p in ring]
        zs = [p[1] for p in ring]
        c0 = int(math.floor((min(xs) - self.x0) / self.px))
        c1 = int(math.ceil((max(xs) - self.x0) / self.px))
        r0 = int(math.floor((min(zs) - self.z0) / self.pz))
        r1 = int(math.ceil((max(zs) - self.z0) / self.pz))
        c0, c1 = max(c0, 0), min(c1, self.W)
        r0, r1 = max(r0, 0), min(r1, self.H)
        if c1 <= c0 or r1 <= r0:
            return np.zeros(0, dtype=np.float32)
        gx = self.x0 + (np.arange(c0, c1) + 0.5) * self.px
        gz = self.z0 + (np.arange(r0, r1) + 0.5) * self.pz
        PX, PZ = np.meshgrid(gx, gz)
        inside = np.zeros(PX.shape, dtype=bool)
        for rg in (ring,) + tuple(holes):
            n = len(rg)
            for i in range(n):
                xi, zi = rg[i]
                xj, zj = rg[i - 1]
                if zi == zj:
                    continue
                cond = (zi > PZ) != (zj > PZ)
                xint = (xj - xi) * (PZ - zi) / (zj - zi) + xi
                inside ^= cond & (PX < xint)
        return self.diff[r0:r1, c0:c1][inside]

    def sample_disc(self, x, z, radius):
        c0 = int((x - radius - self.x0) / self.px)
        c1 = int((x + radius - self.x0) / self.px) + 1
        r0 = int((z - radius - self.z0) / self.pz)
        r1 = int((z + radius - self.z0) / self.pz) + 1
        c0, c1 = max(c0, 0), min(c1, self.W)
        r0, r1 = max(r0, 0), min(r1, self.H)
        if c1 <= c0 or r1 <= r0:
            return np.zeros(0, dtype=np.float32)
        return self.diff[r0:r1, c0:c1].ravel()


# ------------------------------------------------------------- budovy ------

KIND = {"generic": 0, "house": 1, "apartments": 2, "commercial": 3, "industrial": 4,
        "civic": 5, "religious": 6, "garage": 7, "roof": 8, "transport": 10,
        "farm": 11, "tower": 12}

KIND_MAP = {
    "house": "house", "detached": "house", "semidetached_house": "house", "terrace": "house",
    "bungalow": "house", "cabin": "house", "static_caravan": "garage", "allotment_house": "house",
    "residential": "generic", "apartments": "apartments", "dormitory": "apartments",
    "commercial": "commercial", "retail": "commercial", "office": "commercial", "hotel": "commercial",
    "supermarket": "commercial", "kiosk": "garage",
    "industrial": "industrial", "warehouse": "industrial", "manufacture": "industrial",
    "service": "garage", "hangar": "industrial",
    "civic": "civic", "public": "civic", "school": "civic", "university": "civic",
    "hospital": "civic", "government": "civic", "kindergarten": "civic", "college": "civic",
    "sports_hall": "civic", "sports_centre": "civic", "stadium": "civic", "grandstand": "civic",
    "theatre": "civic", "museum": "civic", "fire_station": "civic",
    "church": "religious", "cathedral": "religious", "chapel": "religious", "synagogue": "religious",
    "religious": "religious", "monastery": "religious", "mosque": "religious",
    "garage": "garage", "garages": "garage", "shed": "garage", "carport": "roof", "hut": "garage",
    "roof": "roof", "transportation": "transport", "train_station": "transport",
    "barn": "farm", "farm_auxiliary": "farm", "greenhouse": "farm", "farm": "farm", "stable": "farm",
    "cowshed": "farm", "sty": "farm",
    "tower": "tower", "chimney": "tower", "water_tower": "tower", "silo": "industrial",
    "tank": "industrial", "storage_tank": "industrial",
}

DEFAULT_H = {0: 7.0, 1: 7.5, 2: 16.0, 3: 9.0, 4: 9.0, 5: 12.0, 6: 14.0, 7: 2.8, 8: 3.5,
             10: 6.0, 11: 5.0, 12: 20.0}


def parse_len(v):
    if not v:
        return None
    v = v.strip().lower().replace(",", ".").replace("m", "").strip()
    try:
        f = float(v)
        return f if f > 0 else None
    except ValueError:
        return None


def build_buildings(ex, dem):
    ways, rels = ex["ways"], ex["rels"]
    raw = []  # (tags, outer ring xz, [holes])
    member_ways = set()
    for rid, (tags, members) in rels.items():
        if tags.get("type") != "multipolygon":
            continue
        if "building" not in tags and "building:part" not in tags:
            continue
        outers = [(ways[m[1]][1], [to_xz(*p) for p in ways[m[1]][2]]) for m in members
                  if m[0] == "w" and m[1] in ways and m[2] in ("outer", "")]
        inners = [(ways[m[1]][1], [to_xz(*p) for p in ways[m[1]][2]]) for m in members
                  if m[0] == "w" and m[1] in ways and m[2] == "inner"]
        for m in members:
            if m[0] == "w" and m[2] in ("outer", ""):
                member_ways.add(m[1])
        orings = assemble_rings(outers)
        irings = assemble_rings(inners)
        for o in orings:
            holes = [h for h in irings if point_in_ring(h[0][0], h[0][1], o)]
            raw.append((tags, o, holes))
    for wid, (tags, ids, pts) in ways.items():
        if "building" not in tags and "building:part" not in tags:
            continue
        if ids[0] != ids[-1] or len(ids) < 4:
            continue
        if wid in member_ways and "building" not in tags:
            continue
        raw.append((tags, [to_xz(*p) for p in pts], []))

    items = []
    for tags, ring, holes in raw:
        if tags.get("location") == "underground" or tags.get("building") in ("no", "ruins", "construction", "proposed"):
            continue
        if tags.get("tunnel") == "yes":
            continue
        ring = clean_ring(ring)
        if len(ring) < 3:
            continue
        a = signed_area(ring)
        if abs(a) < 4.0:
            continue
        if a < 0:
            ring = ring[::-1]
        hs = []
        for h in holes:
            h = clean_ring(h)
            if len(h) >= 3 and abs(signed_area(h)) > 6.0:
                if signed_area(h) > 0:
                    h = h[::-1]
                hs.append(h)
        items.append({"tags": tags, "ring": ring, "holes": hs, "area": abs(a)})

    # části budov (building:part) – obrys, který je obsahuje, se nevykresluje
    parts = [it for it in items if "building:part" in it["tags"] and it["tags"].get("building:part") != "no"
             and "building" not in it["tags"]]
    outlines = [it for it in items if "building" in it["tags"]]
    grid = defaultdict(list)
    for i, it in enumerate(outlines):
        cx, cz = centroid(it["ring"])
        it["c"] = (cx, cz)
        xs = [p[0] for p in it["ring"]]
        zs = [p[1] for p in it["ring"]]
        for gx in range(int(min(xs) // 100), int(max(xs) // 100) + 1):
            for gz in range(int(min(zs) // 100), int(max(zs) // 100) + 1):
                grid[(gx, gz)].append(i)
    for p in parts:
        cx, cz = centroid(p["ring"])
        p["c"] = (cx, cz)
        for i in grid.get((int(cx // 100), int(cz // 100)), ()):
            o = outlines[i]
            if point_in_ring(cx, cz, o["ring"]):
                o["parts_area"] = o.get("parts_area", 0.0) + p["area"]
                p["parent"] = o
                break
    for o in outlines:
        # obrys se nekreslí jen tehdy, když ho části pokrývají skoro celý
        if o.get("parts_area", 0.0) >= 0.6 * o["area"]:
            o["has_parts"] = True

    out = []
    t0 = time.time()
    stats = defaultdict(int)
    for it in outlines + parts:
        tags = it["tags"]
        is_part = it in parts if False else ("building" not in tags)
        btype = tags.get("building") or tags.get("building:part") or "yes"
        if is_part and "parent" in it:
            btype = it["parent"]["tags"].get("building", "yes")
        kind_name = KIND_MAP.get(btype, "generic")
        if tags.get("amenity") == "place_of_worship":
            kind_name = "religious"
        if tags.get("man_made") in ("chimney", "tower", "water_tower"):
            kind_name = "tower"
        kind = KIND[kind_name]
        levels = parse_len(tags.get("building:levels"))
        roof_levels = parse_len(tags.get("roof:levels")) or 0
        tag_h = parse_len(tags.get("height")) or parse_len(tags.get("building:height"))
        min_h = parse_len(tags.get("min_height")) or 0.0
        if not min_h and parse_len(tags.get("building:min_level")):
            min_h = parse_len(tags.get("building:min_level")) * 3.2
        area = it["area"]

        vals = dem.sample_polygon(it["ring"], tuple(it["holes"]))
        vals = vals[vals > -5]
        h_top = h_wall = None
        src = "default"
        if vals.size >= 3:
            p35, p70, p92 = np.percentile(vals, [35, 70, 92])
            if p70 >= 2.2:
                h_top = float(p92)
                h_wall = float(p35 if p35 > 2.0 else p70)
                h_flat = float(p70)
                src = "dem"
        est = None
        if levels:
            est = levels * 3.1 + (1.2 if kind != 7 else 0) + roof_levels * 2.0
        if tag_h:
            h_top = tag_h
            h_wall = min(h_wall, tag_h) if (h_wall and src == "dem") else tag_h
            h_flat = tag_h
            src = "tag"
        elif src == "dem":
            # stromy nad nízkou stavbou výšku nadsazují – omez podle typu
            cap = None
            if kind == 7:
                cap = max(4.5, (est or 0) + 1.5)
            elif kind == 8:
                cap = 6.0
            elif est:
                cap = est + 7.0
            elif kind == 1:
                cap = 15.0
            if cap and h_flat > cap:
                h_top = h_wall = h_flat = cap
                src = "dem-cap"
        else:
            if est:
                h_top = h_wall = h_flat = est
                src = "levels"
            else:
                d = DEFAULT_H[kind]
                if kind == 0 and area > 600:
                    d = 9.0
                # malá "yes" stavba bez údajů je nejspíš kůlna
                if kind == 0 and area < 30:
                    d = 3.0
                h_top = h_wall = h_flat = d
        if is_part and not tag_h and est and src != "dem":
            h_top = h_wall = h_flat = est + min_h
        stats[src] += 1

        # šikmé střechy
        gable = False     # sedlová střecha na čtyřúhelníkovém půdorysu
        ridge = False     # obecná střecha s hřebenem (valbová, jehlanová)
        hip = 0
        roof_shape = tags.get("roof:shape", "")
        roof_h = parse_len(tags.get("roof:height"))
        pitched_tag = roof_shape in ("gabled", "hipped", "half-hipped", "pitched", "pyramidal", "mansard", "gambrel")
        if roof_h and roof_shape != "flat" and (tag_h or src.startswith("dem")) and not it["holes"]:
            top = tag_h or h_top
            if top - roof_h > 2.0:
                h_top, h_wall = top, top - roof_h
                ridge = True
                hip = 2 if roof_shape == "pyramidal" else (0 if roof_shape == "gabled" else 1)
        elif (len(it["ring"]) == 4 and not it["holes"] and kind in (0, 1) and 35 < area < 420
                and src == "dem" and h_top - h_wall > 1.6 and h_wall > 2.4 and h_top < 16
                and roof_shape in ("", "gabled", "hipped", "half-hipped", "pitched")):
            gable = True
        elif (not it["holes"] and src == "dem" and h_top - h_wall > 1.8 and h_wall > 2.4
                and len(it["ring"]) <= 12 and roof_shape != "flat"
                and ((kind in (0, 1) and 35 < area < 650 and h_top < 17 and obb_fill(it["ring"]) > 0.8)
                     or (kind == 6 and h_top - h_wall > 3.0)
                     or pitched_tag)):
            ridge = True
            hip = 1
        # obecná šikmá střecha: okraj ve výšce okapu, střed ve výšce hřebene (obojí z měření)
        inset = 0.0
        if (not gable and not ridge and not it["holes"] and src == "dem" and h_top - h_wall > 1.8
                and 2.6 < h_wall <= 19 and 50 < area < 2600 and kind in (0, 1, 2, 3, 5, 6, 10)
                and roof_shape != "flat" and len(it["ring"]) <= 40):
            inset = min(max((h_top - h_wall) / 0.78, 1.3), 4.8, obb_width(it["ring"]) * 0.42)
            if inset < 1.0:
                inset = 0.0
            else:
                h_wall = max(h_wall, h_top - inset * 1.5)      # ne strmější než ~56°
        if not gable and not ridge and not inset:
            h_wall = h_top = h_flat
        h_top = max(2.2, min(h_top, 220.0))
        h_wall = max(2.0, min(h_wall, h_top))

        flags = 0
        if gable:
            flags |= 1
        if ridge:
            flags |= 2
            if hip == 2:
                flags |= 32     # jehlan (věž)
            elif hip == 0:
                flags |= 64     # sedlová (bez valby)
        if inset:
            flags |= 128    # šikmá střecha odsazením obrysu
        if is_part:
            flags |= 4
        if it.get("has_parts"):
            flags |= 8      # obrys s detailními částmi: jen kolize, nekreslit
        if kind == 8:
            flags |= 16     # přístřešek: bez kolizí
        colour = tags.get("building:colour") or ""
        if not colour and is_part and "parent" in it:
            colour = it["parent"]["tags"].get("building:colour") or ""
        roof_colour = tags.get("roof:colour") or ROOF_MATERIAL.get(tags.get("roof:material", ""), "")
        name = tags.get("name")
        out.append({
            "ring": it["ring"], "holes": it["holes"], "kind": kind, "flags": flags,
            "h_top": h_top, "h_wall": h_wall, "h_min": min(min_h, h_top - 1.0) if min_h else 0.0,
            "levels": int(levels or 0), "name": name, "colour": colour, "roof_colour": roof_colour, "area": area,
            "inset": inset,
            "tags": tags,
        })
    print(f"  budovy: {len(out)} ({dict(stats)}), {time.time() - t0:.0f} s")
    return out


def pack_buildings(path, blds):
    n = len(blds)
    ax = np.zeros(n, np.int32)
    az = np.zeros(n, np.int32)
    h_top = np.zeros(n, np.uint16)
    h_wall = np.zeros(n, np.uint16)
    h_min = np.zeros(n, np.uint16)
    kind = np.zeros(n, np.uint8)
    flags = np.zeros(n, np.uint8)
    levels = np.zeros(n, np.uint8)
    colour = np.zeros(n, np.uint32)
    roof_colour = np.zeros(n, np.uint32)
    roof_inset = np.zeros(n, np.uint8)
    b_ring = np.zeros(n + 1, np.uint32)
    ring_start = [0]
    vdx = []
    vdz = []
    names = []
    for i, b in enumerate(blds):
        x0, z0 = b["ring"][0]
        ax[i] = round(x0 * 10)
        az[i] = round(z0 * 10)
        h_top[i] = round(b["h_top"] * 10)
        h_wall[i] = round(b["h_wall"] * 10)
        h_min[i] = round(b["h_min"] * 10)
        kind[i] = b["kind"]
        flags[i] = b["flags"]
        levels[i] = min(b["levels"], 255)
        colour[i] = parse_colour(b["colour"])
        roof_colour[i] = parse_colour(b["roof_colour"])
        roof_inset[i] = min(255, round(b["inset"] * 10))
        b_ring[i] = len(ring_start) - 1
        for rg in [b["ring"]] + b["holes"]:
            for (x, z) in rg:
                vdx.append(max(-32000, min(32000, round(x * 10) - int(ax[i]))))
                vdz.append(max(-32000, min(32000, round(z * 10) - int(az[i]))))
            ring_start.append(len(vdx))
        if b["name"]:
            names.append([i, b["name"]])
    b_ring[n] = len(ring_start) - 1
    write_pack(path, {"count": n, "names": names}, {
        "ax": ax, "az": az, "hTop": h_top, "hWall": h_wall, "hMin": h_min,
        "kind": kind, "flags": flags, "levels": levels, "colour": colour, "roofColour": roof_colour,
        "roofInset": roof_inset,
        "bRing": b_ring, "ringStart": np.array(ring_start, np.uint32),
        "vdx": np.array(vdx, np.int16), "vdz": np.array(vdz, np.int16),
    })


# barva střechy podle materiálu (měď časem zezelená)
ROOF_MATERIAL = {"copper": "#5f8f7b", "slate": "#4a4d52", "roof_tiles": "#9c4a36", "tile": "#9c4a36",
                 "metal": "#8d949b", "tar_paper": "#3f4246", "concrete": "#8a8a86", "glass": "#7fa3b8"}

CSS_COLOURS = {
    "white": 0xf2f2f2, "black": 0x222222, "grey": 0x8c8c8c, "gray": 0x8c8c8c, "red": 0xb23a2e,
    "brown": 0x7a5234, "yellow": 0xe6c84a, "green": 0x4f8a4b, "blue": 0x3d6fb0, "orange": 0xd9822b,
    "beige": 0xe0d2b0, "pink": 0xe8a7b5, "cream": 0xf1e6c4, "tan": 0xc9ac80, "silver": 0xc0c0c0,
    "maroon": 0x7a2a2a, "lightgrey": 0xcfcfcf, "lightgray": 0xcfcfcf, "darkgrey": 0x77726a,
    "darkgray": 0x77726a, "ivory": 0xf4f0dc, "lightyellow": 0xf3ecb8, "lightblue": 0xa9c8e6,
}


def parse_colour(s):
    """Vrátí 0 (neurčeno) nebo 0x01RRGGBB."""
    if not s:
        return 0
    s = s.strip().lower()
    if s.startswith("#"):
        h = s[1:]
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        try:
            return 0x01000000 | int(h[:6], 16)
        except ValueError:
            return 0
    if s in CSS_COLOURS:
        return 0x01000000 | CSS_COLOURS[s]
    return 0


# ------------------------------------------------------------ silnice ------

ROAD_CLASS = {
    "motorway": 0, "motorway_link": 1, "trunk": 2, "trunk_link": 3, "primary": 4, "primary_link": 5,
    "secondary": 6, "secondary_link": 7, "tertiary": 8, "tertiary_link": 9, "unclassified": 10,
    "residential": 11, "living_street": 12, "service": 13, "pedestrian": 14, "track": 15,
    "footway": 16, "path": 17, "cycleway": 18, "steps": 19, "bridleway": 17, "raceway": 13,
    "bus_guideway": 13, "busway": 13, "road": 10,
}
DRIVABLE_MAX = 13
ROAD_EDGE_MARGIN = 42
# Trouby D5 ověřené podle portálů v ortofotu. Příčné podjezdy mají jiný výškový profil.
VALIK_WAYS = {24525621, 27568574}
HISTORIC_BRIDGES = {4722526: 2, 37894284: 1}
WILSON_SIDEWALKS = {875790743, 1102321297}
DEF_WIDTH = {0: 8.0, 1: 5.0, 2: 7.5, 3: 5.0, 4: 8.5, 5: 5.0, 6: 7.5, 7: 5.0, 8: 7.0, 9: 5.0,
             10: 6.0, 11: 6.0, 12: 5.0, 13: 3.6, 14: 5.0, 15: 2.8, 16: 2.0, 17: 1.4, 18: 2.4, 19: 2.2}
DEF_SPEED = {0: 110, 1: 70, 2: 80, 3: 60, 4: 50, 5: 45, 6: 50, 7: 45, 8: 50, 9: 40,
             10: 45, 11: 40, 12: 20, 13: 20, 14: 10, 15: 20, 16: 5, 17: 5, 18: 15, 19: 3}


def parse_speed(value):
    return parse_len((value or "").lower().removesuffix("km/h"))


def build_roads(ex):
    ways = ex["ways"]
    sel = {}
    for wid, (tags, ids, pts) in ways.items():
        hw = tags.get("highway")
        if hw not in ROAD_CLASS:
            continue
        if tags.get("area") == "yes":
            continue
        if tags.get("access") in ("no",) and hw == "service":
            pass
        if tags.get("indoor") == "yes" or tags.get("level") not in (None, "0"):
            if hw in ("footway", "steps", "path", "corridor"):
                continue
        cls = ROAD_CLASS[hw]
        if cls == 13 and tags.get("service") in ("parking_aisle",) and False:
            continue
        sel[wid] = (tags, ids, pts, cls)
    # uzly sdílené více cestami (křižovatky) se při zjednodušení zachovají
    use = defaultdict(int)
    for wid, (tags, ids, pts, cls) in sel.items():
        for k, nid in enumerate(ids):
            use[nid] += 1 if 0 < k < len(ids) - 1 else 1
        use[ids[0]] += 1
        use[ids[-1]] += 1
    names = {}
    name_list = []
    out = []
    for wid, (tags, ids, pts, cls) in sel.items():
        xz = [to_xz(*p) for p in pts]
        keep = [k for k, nid in enumerate(ids) if use[nid] > 1]
        tol = 0.25 if cls <= DRIVABLE_MAX else 0.6
        idx = dp_simplify(xz, tol, keep)
        xz = [xz[k] for k in idx]
        if len(xz) < 2:
            continue
        lanes = parse_len(tags.get("lanes"))
        oneway = tags.get("oneway") in ("yes", "1", "true") or (
            tags.get("oneway") is None and (tags.get("junction") == "roundabout" or cls in (0, 1)))
        reverse = tags.get("oneway") == "-1"
        if reverse:
            xz = xz[::-1]
            oneway = True
        w = parse_len(tags.get("width"))
        if not w or w > 30:
            if lanes and cls <= DRIVABLE_MAX:
                w = max(lanes * 3.3 + 0.6, 3.4)
            else:
                w = DEF_WIDTH[cls]
                if oneway and cls in (2, 4, 6, 8):
                    w = max(5.5, w - 2.0)
        if cls <= DRIVABLE_MAX:
            w = max(3.2, min(w, 22.0))
        else:
            w = max(1.0, min(w, 12.0))
        if not lanes:
            lanes = 1 if (oneway or cls in (1, 3, 5, 7, 9, 12, 13)) and w < 6.5 else 2
            if oneway and w >= 6.5:
                lanes = 2
        limit = parse_speed(tags.get("maxspeed")) or {
            "CZ:urban": 50, "CZ:rural": 90, "CZ:motorway": 130,
        }.get(tags.get("maxspeed:type"), 0)
        sp = limit or DEF_SPEED[cls]
        forward = parse_speed(tags.get("maxspeed:" + ("backward" if reverse else "forward"))) or limit
        backward = parse_speed(tags.get("maxspeed:" + ("forward" if reverse else "backward"))) or limit
        flags = 0
        if oneway:
            flags |= 1
        if tags.get("bridge") not in (None, "no"):
            flags |= 2
        if tags.get("tunnel") not in (None, "no"):
            flags |= 4
        if tags.get("junction") == "roundabout":
            flags |= 8
        if tags.get("lit") == "yes":
            flags |= 16
        access = next((tags[key] for key in ("motorcar", "motor_vehicle", "vehicle", "access") if key in tags), None)
        if access in ("private", "no"):
            flags |= 32
        if tags.get("service") in ("parking_aisle", "driveway"):
            flags |= 64
        if wid in WILSON_SIDEWALKS:
            flags |= 128
        nm = tags.get("name") or ""
        if nm not in names:
            names[nm] = len(name_list)
            name_list.append(nm)
        layer = 0
        try:
            layer = int(tags.get("layer", "0"))
        except ValueError:
            pass
        out.append({"cls": cls, "w": w, "lanes": int(min(lanes, 8)), "speed": int(min(sp, 130)),
                    "speedForward": int(min(forward or sp, 130)), "speedBackward": int(min(backward or sp, 130)),
                    "limitForward": int(min(forward, 130)), "limitBackward": int(min(backward, 130)),
                    "way": wid, "reverse": reverse,
                    "flags": flags, "name": names[nm], "layer": layer, "pts": xz,
                    "valik": wid in VALIK_WAYS, "arches": HISTORIC_BRIDGES.get(wid, 0)})
    return out, name_list


def clip_segment(a, b, bounds):
    """Parametry části úsečky uvnitř obdélníku."""
    lo, hi = 0.0, 1.0
    for origin, end, lower, upper in zip(a, b, bounds[::2], bounds[1::2]):
        d = end - origin
        if not d:
            if not lower <= origin <= upper:
                return None
            continue
        t0, t1 = sorted(((lower - origin) / d, (upper - origin) / d))
        lo, hi = max(lo, t0), min(hi, t1)
        if lo >= hi:
            return None
    return lo, hi


def clip_roads(roads, bounds):
    # Závora je uvnitř hratelné plochy. Za ní je rezerva pro pěší pohyb i let.
    min_x, max_x, min_z, max_z = bounds
    limits = (min_x + ROAD_EDGE_MARGIN, max_x - ROAD_EDGE_MARGIN,
              min_z + ROAD_EDGE_MARGIN, max_z - ROAD_EDGE_MARGIN)
    clipped, closures = [], []
    for road in roads:
        if road["cls"] > DRIVABLE_MAX:
            clipped.append(road)
            continue
        path, length = [], 0.0
        ends = []
        for a, b in zip(road["pts"], road["pts"][1:]):
            window = clip_segment(a, b, limits)
            if window is None:
                if path:
                    if length > 0.5:
                        clipped.append({**road, "pts": path})
                        closures.extend(ends)
                    path, length, ends = [], 0.0, []
                continue
            lo, hi = window
            dx, dz = b[0] - a[0], b[1] - a[1]
            span = math.hypot(dx, dz)
            if span < 0.01:
                continue
            if not path:
                path.append(a if lo == 0 else (a[0] + dx * lo, a[1] + dz * lo))
            path.append(b if hi == 1 else (a[0] + dx * hi, a[1] + dz * hi))
            length += span * (hi - lo)
            if not road["flags"] & (2 | 4 | 32):
                for t, direction, point in ((lo, -1, path[0]), (hi, 1, path[-1])):
                    if 0 < t < 1 and (direction > 0 or len(path) == 2):
                        ends.append([round(point[0], 1), round(point[1], 1),
                                     round(direction * dx / span, 5), round(direction * dz / span, 5),
                                     round(road["w"], 1)])
            if hi < 1:
                if length > 0.5:
                    clipped.append({**road, "pts": path})
                    closures.extend(ends)
                path, length, ends = [], 0.0, []
        if length > 0.5 and path:
            clipped.append({**road, "pts": path})
            closures.extend(ends)
    return clipped, closures


def pack_lines(path, items, header, extra=()):
    n = len(items)
    x0 = np.zeros(n, np.int32)
    z0 = np.zeros(n, np.int32)
    start = np.zeros(n + 1, np.uint32)
    dx = []
    dz = []
    for i, it in enumerate(items):
        pts = it["pts"]
        px, pz = round(pts[0][0] * 10), round(pts[0][1] * 10)
        x0[i], z0[i] = px, pz
        start[i] = len(dx)
        for (x, z) in pts[1:]:
            qx, qz = round(x * 10), round(z * 10)
            ddx, ddz = qx - px, qz - pz
            # příliš dlouhý úsek rozděl, aby se vešel do int16
            steps = max(1, int(max(abs(ddx), abs(ddz)) // 30000) + 1)
            for s in range(1, steps + 1):
                tx = px + round(ddx * s / steps)
                tz = pz + round(ddz * s / steps)
                dx.append(tx - (px + round(ddx * (s - 1) / steps)))
                dz.append(tz - (pz + round(ddz * (s - 1) / steps)))
            px, pz = qx, qz
    start[n] = len(dx)
    arrays = {"x0": x0, "z0": z0, "start": start,
              "dx": np.array(dx, np.int16), "dz": np.array(dz, np.int16)}
    for key, dtype in extra:
        arrays[key] = np.array([it[key] for it in items], dtype)
    # Výška vozovky u mostů a tunelů, po 2 cm nad základní výškou terénu.
    b_off = np.full(n, 0xFFFFFFFF, np.uint32)
    b_y = []
    for i, it in enumerate(items):
        by = it.get("by")
        if by is None:
            continue
        assert len(by) == int(start[i + 1] - start[i]) + 1, "most s rozděleným úsekem"
        b_off[i] = len(b_y)
        b_y.extend(max(-32000, min(32000, round(v / 0.02))) for v in by)
    arrays["bridgeOff"] = b_off
    arrays["bridgeY"] = np.array(b_y if b_y else [0], np.int16)
    header = dict(header)
    header["count"] = n
    write_pack(path, header, arrays)


# ------------------------------------------------------------- koleje ------

def build_rails(ex):
    out = []
    for wid, (tags, ids, pts) in ex["ways"].items():
        rw = tags.get("railway")
        if rw not in ("tram", "rail"):
            continue
        if tags.get("tunnel") == "yes" and rw == "rail":
            continue
        xz = [to_xz(*p) for p in pts]
        idx = dp_simplify(xz, 0.15)
        xz = [xz[k] for k in idx]
        flags = 0
        if tags.get("bridge") not in (None, "no"):
            flags |= 2
        if tags.get("service") in ("yard", "siding", "spur", "crossover"):
            flags |= 64
        out.append({"cls": 0 if rw == "tram" else 1, "flags": flags, "pts": xz})
    return out


# ------------------------------------------------------------- plochy ------

LAND = {"farmland": 1, "meadow": 2, "grass": 3, "residential": 4, "commercial": 5, "industrial": 6,
        "railway": 7, "allotments": 8, "cemetery": 9, "forest": 10, "scrub": 11, "park": 12,
        "pitch": 13, "parking": 14, "plaza": 15, "water": 16, "sand": 17, "construction": 18,
        "garden": 19, "playground": 20}


def land_class(tags):
    lu = tags.get("landuse")
    nat = tags.get("natural")
    le = tags.get("leisure")
    if nat == "water" or lu in ("reservoir", "basin") or tags.get("waterway") == "riverbank":
        return "water"
    if lu in ("forest",) or nat == "wood":
        return "forest"
    if nat in ("scrub", "heath", "shrubbery"):
        return "scrub"
    if le in ("park", "nature_reserve", "dog_park") or lu in ("village_green", "recreation_ground"):
        return "park"
    if le == "garden" or lu in ("flowerbed", "plant_nursery", "orchard", "vineyard"):
        return "garden"
    if le in ("pitch", "track", "sports_centre", "stadium", "golf_course"):
        return "pitch" if le in ("pitch", "track") else None
    if le == "playground":
        return "playground"
    if lu == "grass" or nat == "grassland":
        return "grass"
    if lu == "meadow" or nat == "wetland":
        return "meadow"
    if lu in ("farmland", "greenhouse_horticulture", "farmyard"):
        return "farmland"
    if lu == "residential":
        return "residential"
    if lu in ("commercial", "retail"):
        return "commercial"
    if lu in ("industrial", "garages", "landfill", "quarry"):
        return "industrial"
    if lu == "railway":
        return "railway"
    if lu == "allotments":
        return "allotments"
    if lu in ("cemetery", "religious"):
        return "cemetery" if lu == "cemetery" else None
    if lu in ("construction", "brownfield", "greenfield"):
        return "construction"
    if nat in ("sand", "beach", "shingle"):
        return "sand"
    if tags.get("amenity") == "parking" and tags.get("parking") in (None, "surface", "street_side", "lane"):
        return "parking"
    if tags.get("highway") in ("pedestrian", "footway") and tags.get("area") == "yes":
        return "plaza"
    if tags.get("highway") == "pedestrian" and tags.get("type") == "multipolygon":
        return "plaza"
    if tags.get("place") == "square":
        return "plaza"
    return None


def build_land(ex):
    ways, rels = ex["ways"], ex["rels"]
    polys = []
    for rid, (tags, members) in rels.items():
        if tags.get("type") != "multipolygon":
            continue
        cls = land_class(tags)
        if not cls:
            continue
        segs = [(ways[m[1]][1], [to_xz(*p) for p in ways[m[1]][2]]) for m in members
                if m[0] == "w" and m[1] in ways]
        rings = assemble_rings(segs)
        if rings:
            polys.append((cls, rings, tags.get("name")))
    for wid, (tags, ids, pts) in ways.items():
        if ids[0] != ids[-1] or len(ids) < 4:
            continue
        cls = land_class(tags)
        if not cls:
            continue
        polys.append((cls, [[to_xz(*p) for p in pts]], tags.get("name")))
    out = []
    for cls, rings, name in polys:
        rs = []
        tol = 0.5 if cls in ("water", "plaza", "parking", "pitch") else 1.2
        for rg in rings:
            idx = dp_simplify(rg, tol)
            rg2 = [rg[k] for k in idx]
            if len(rg2) >= 4:
                rs.append(rg2[:-1])
        if not rs:
            continue
        area = sum(abs(signed_area(r)) for r in rs[:1])
        out.append({"cls": LAND[cls], "rings": rs, "area": area, "name": name})
    # větší plochy první (kreslí se jako podklad)
    out.sort(key=lambda p: -p["area"])

    lines = []
    for wid, (tags, ids, pts) in ways.items():
        ww = tags.get("waterway")
        if ww in ("river", "stream", "canal", "drain", "ditch") and tags.get("tunnel") not in ("yes", "culvert"):
            xz = [to_xz(*p) for p in pts]
            idx = dp_simplify(xz, 0.8)
            lines.append({"cls": {"river": 0, "canal": 1, "stream": 2, "drain": 3, "ditch": 3}[ww],
                          "pts": [xz[k] for k in idx], "name": tags.get("name")})
        elif tags.get("natural") == "tree_row":
            xz = [to_xz(*p) for p in pts]
            lines.append({"cls": 9, "pts": xz, "name": None})
    return out, lines


def pack_land(path, polys, lines):
    n = len(polys)
    cls = np.array([p["cls"] for p in polys], np.uint8)
    p_ring = np.zeros(n + 1, np.uint32)
    ring_start = [0]
    vx = []
    vz = []
    names = []
    for i, p in enumerate(polys):
        p_ring[i] = len(ring_start) - 1
        for rg in p["rings"]:
            for (x, z) in rg:
                vx.append(round(x * 10))
                vz.append(round(z * 10))
            ring_start.append(len(vx))
        if p["name"] and p["cls"] in (LAND["water"], LAND["park"], LAND["forest"]) and p["area"] > 3000:
            names.append([i, p["name"]])
    p_ring[n] = len(ring_start) - 1
    ln = len(lines)
    l_start = np.zeros(ln + 1, np.uint32)
    lx = []
    lz = []
    for i, l in enumerate(lines):
        l_start[i] = len(lx)
        for (x, z) in l["pts"]:
            lx.append(round(x * 10))
            lz.append(round(z * 10))
    l_start[ln] = len(lx)
    write_pack(path, {"count": n, "lineCount": ln, "names": names, "classes": LAND}, {
        "cls": cls, "pRing": p_ring, "ringStart": np.array(ring_start, np.uint32),
        "vx": np.array(vx, np.int32), "vz": np.array(vz, np.int32),
        "lCls": np.array([l["cls"] for l in lines], np.uint8), "lStart": l_start,
        "lx": np.array(lx, np.int32), "lz": np.array(lz, np.int32),
    })


# ---------------------------------------------------------------- MHD ------

def build_transit(ex):
    ways, rels, nodes = ex["ways"], ex["rels"], ex["nodes"]
    lines = []
    for rid, (tags, members) in rels.items():
        if tags.get("type") != "route" or tags.get("route") not in ("tram", "trolleybus"):
            continue
        ref = tags.get("ref") or ""
        if not ref or not ref.isdigit():
            continue  # manipulační jízdy do vozovny vynech
        segs = [(m[1], ways[m[1]]) for m in members if m[0] == "w" and m[1] in ways and m[2] in ("", "forward", "backward")]
        segs = [(wid, w) for wid, w in segs if ("railway" in w[0] or "highway" in w[0])
                and w[0].get("highway") != "platform" and w[0].get("railway") != "platform"]
        if not segs:
            continue
        # poskládej cestu v pořadí členů relace
        path_ids = []
        path = []
        gaps = 0
        for k, (wid, (wt, ids, pts)) in enumerate(segs):
            ids = list(ids)
            pts = [to_xz(*p) for p in pts]
            if not path_ids:
                if k + 1 < len(segs):
                    nxt = segs[k + 1][1][1]
                    if ids[0] in (nxt[0], nxt[-1]) and ids[-1] not in (nxt[0], nxt[-1]):
                        ids, pts = ids[::-1], pts[::-1]
                    elif wt.get("junction") == "roundabout" or ids[0] == ids[-1]:
                        pass
                path_ids, path = ids, pts
                continue
            tail = path_ids[-1]
            if ids[0] == tail:
                pass
            elif ids[-1] == tail:
                ids, pts = ids[::-1], pts[::-1]
            elif tail in ids:      # napojení uprostřed (okružní křižovatka, smyčka)
                j = ids.index(tail)
                if ids[0] == ids[-1]:
                    ids = ids[j:] + ids[1:j + 1]
                    pts = pts[j:] + pts[1:j + 1]
                    # u kruhového objezdu projeď jen k výjezdu na další člen
                    if k + 1 < len(segs):
                        nxt = segs[k + 1][1][1]
                        cut = None
                        for q, nid in enumerate(ids):
                            if q > 0 and nid in (nxt[0], nxt[-1]):
                                cut = q
                                break
                        if cut:
                            ids, pts = ids[:cut + 1], pts[:cut + 1]
                else:
                    ids, pts = ids[j:], pts[j:]
            else:
                # zkus otočit, jinak mezera
                d0 = math.hypot(pts[0][0] - path[-1][0], pts[0][1] - path[-1][1])
                d1 = math.hypot(pts[-1][0] - path[-1][0], pts[-1][1] - path[-1][1])
                if d1 < d0:
                    ids, pts = ids[::-1], pts[::-1]
                    d0 = d1
                if d0 > 60:
                    gaps += 1
                path_ids.extend(ids)
                path.extend(pts)
                continue
            path_ids.extend(ids[1:])
            path.extend(pts[1:])
        idx = dp_simplify(path, 0.2)
        path = [path[k] for k in idx]
        # zastávky
        stops = []
        cum = [0.0]
        for a, b in zip(path, path[1:]):
            cum.append(cum[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
        for m in members:
            if m[0] != "n" or m[1] not in nodes:
                continue
            if not m[2].startswith("stop"):
                continue
            la, lo, nt = nodes[m[1]]
            sx, sz = to_xz(la, lo)
            best, bd = 1e9, 0.0
            for k in range(len(path) - 1):
                ax_, az_ = path[k]
                bx_, bz_ = path[k + 1]
                dx_, dz_ = bx_ - ax_, bz_ - az_
                l2 = dx_ * dx_ + dz_ * dz_
                t = 0.0 if l2 == 0 else max(0.0, min(1.0, ((sx - ax_) * dx_ + (sz - az_) * dz_) / l2))
                d = math.hypot(ax_ + dx_ * t - sx, az_ + dz_ * t - sz)
                if d < best:
                    best, bd = d, cum[k] + math.sqrt(l2) * t
            if best < 40:
                stops.append([round(bd, 1), nt.get("name", "")])
        stops.sort()
        lines.append({
            "type": tags["route"], "ref": ref, "name": tags.get("name", ""),
            "from": tags.get("from", ""), "to": tags.get("to", ""), "colour": tags.get("colour", ""),
            "length": round(cum[-1], 1), "gaps": gaps,
            "path": [[round(x, 1), round(z, 1)] for x, z in path], "stops": stops,
        })
        print(f"   {tags['route']} {ref}: {tags.get('from', '?')} → {tags.get('to', '?')}, "
              f"{cum[-1] / 1000:.1f} km, {len(stops)} zastávek, mezery {gaps}")
    lines.sort(key=lambda l: (l["type"], int(l["ref"]), l["name"]))
    return lines


# -------------------------------------------------------- body zájmu -------

FOOD = {"restaurant": 0, "fast_food": 1, "cafe": 2, "pub": 3, "bar": 3, "ice_cream": 2, "biergarten": 3,
        "food_court": 1}


def way_centroids(ex, pred):
    res = []
    for wid, (tags, ids, pts) in ex["ways"].items():
        if pred(tags):
            la = sum(p[0] for p in pts) / len(pts)
            lo = sum(p[1] for p in pts) / len(pts)
            res.append((la, lo, tags))
    return res


def build_pois(ex, dem, road_names):
    nodes = ex["nodes"]
    s, w, n, e = ex["bbox"]

    def inside(la, lo):
        return s <= la <= n and w <= lo <= e

    food = []
    seen = set()
    cand = [(la, lo, t) for (la, lo, t) in nodes.values() if t.get("amenity") in FOOD]
    cand += way_centroids(ex, lambda t: t.get("amenity") in FOOD)
    for la, lo, t in cand:
        nm = t.get("name")
        if not nm or not inside(la, lo):
            continue
        x, z = to_xz(la, lo)
        key = (nm, round(x / 30), round(z / 30))
        if key in seen:
            continue
        seen.add(key)
        food.append([round(x, 1), round(z, 1), FOOD[t["amenity"]], nm, t.get("cuisine", "").split(";")[0]])

    services = []
    kinds = {"hospital": "hospital", "police": "police", "fuel": "fuel", "fire_station": "fire",
             "car_wash": "carwash", "car_repair": "repair"}
    cand = [(la, lo, t) for (la, lo, t) in nodes.values()
            if t.get("amenity") in kinds or t.get("shop") == "car_repair"]
    cand += way_centroids(ex, lambda t: t.get("amenity") in kinds or t.get("shop") == "car_repair")
    seen = set()
    for la, lo, t in cand:
        if not inside(la, lo):
            continue
        k = kinds.get(t.get("amenity")) or "repair"
        x, z = to_xz(la, lo)
        key = (k, round(x / 60), round(z / 60))
        if key in seen:
            continue
        seen.add(key)
        services.append([round(x, 1), round(z, 1), k, t.get("name") or t.get("brand") or ""])

    trees = []
    for la, lo, t in nodes.values():
        if t.get("natural") == "tree" and inside(la, lo):
            x, z = to_xz(la, lo)
            trees.append((x, z))
    for wid, (tags, ids, pts) in ex["ways"].items():
        if tags.get("natural") == "tree_row":
            xz = [to_xz(*p) for p in pts]
            acc = 0.0
            trees.append(xz[0])
            for a, b in zip(xz, xz[1:]):
                seg = math.hypot(b[0] - a[0], b[1] - a[1])
                pos = 9.0 - acc
                while pos < seg:
                    t_ = pos / seg
                    trees.append((a[0] + (b[0] - a[0]) * t_, a[1] + (b[1] - a[1]) * t_))
                    pos += 9.0
                acc = (acc + seg) % 9.0

    towers = []
    for la, lo, t in nodes.values():
        mm = t.get("man_made")
        if mm in ("chimney", "tower", "water_tower", "mast") and inside(la, lo):
            x, z = to_xz(la, lo)
            vals = dem.sample_disc(x, z, 5.0)
            h = float(vals.max()) if vals.size else 0.0
            th = parse_len(t.get("height"))
            if th:
                h = th
            if h >= 12:
                towers.append([round(x, 1), round(z, 1), round(h, 1), mm, t.get("name", "")])

    signals = []
    crossings = []
    for la, lo, t in nodes.values():
        if not inside(la, lo):
            continue
        kinds = highway_values(t)
        if "traffic_signals" in kinds:
            x, z = to_xz(la, lo)
            signals.append([round(x, 1), round(z, 1)])
        if "crossing" in kinds and t.get("crossing") not in ("unmarked", "no"):
            x, z = to_xz(la, lo)
            crossings.append([round(x, 1), round(z, 1)])

    places = []
    for la, lo, t in nodes.values():
        if t.get("place") in ("suburb", "quarter", "neighbourhood", "village", "hamlet", "city", "town") and t.get("name"):
            x, z = to_xz(la, lo)
            places.append([round(x), round(z), t["name"], t["place"]])

    # adresy pro rozvoz: rovnoměrný výběr po mřížce 120 m
    name_idx = {nm: i for i, nm in enumerate(road_names)}
    cells = defaultdict(list)
    for la, lo, t in nodes.values():
        hn = t.get("addr:housenumber")
        st = t.get("addr:street")
        if not hn or not st or st not in name_idx or not inside(la, lo):
            continue
        x, z = to_xz(la, lo)
        num = t.get("addr:streetnumber") or t.get("addr:conscriptionnumber") or hn
        cells[(int(x // 120), int(z // 120))].append((x, z, name_idx[st], num))
    addrs = []
    for key in sorted(cells):
        lst = sorted(cells[key])
        for item in lst[::max(1, len(lst) // 2)][:2]:
            addrs.append([round(item[0], 1), round(item[1], 1), item[2], item[3]])
    return {"food": food, "services": services, "towers": towers, "signals": signals,
            "crossings": crossings, "places": places, "addresses": addrs}, trees


# památky: (název ve hře, hledaný text v OSM, krátký popis)
LANDMARKS = [
    ("Katedrála sv. Bartoloměje", ["svatý Bartoloměj", "Katedrála svatého Bartoloměje"]),
    ("Velká synagoga", ["Velká synagoga"]),
    ("Radnice", ["Magistrát města Plzně", "Radnice"]),
    ("Plzeňský Prazdroj", ["Historická brána Prazdroj", "Návštěvnické centrum Plzeňský Prazdroj"]),
    ("Stadion ve Štruncových sadech", ["Doosan Arena", "Stadion města Plzně"]),
    ("Techmania Science Center", ["Techmania Science Center", "Techmania"]),
    ("Zoologická a botanická zahrada", ["Zoologická a botanická zahrada města Plzně", "Zoologická a botanická zahrada", "ZOO Plzeň"]),
    ("Velké divadlo", ["Divadlo Josefa Kajetána Tyla - Velké divadlo", "Velké divadlo"]),
    ("Nové divadlo", ["Nové divadlo"]),
    ("Hlavní nádraží", ["Plzeň hlavní nádraží"]),
    ("Západočeské muzeum", ["Západočeské muzeum", "Západočeské muzeum v Plzni"]),
    ("Měšťanská beseda", ["Měšťanská beseda"]),
    ("Lochotínský amfiteátr", ["Amfiteátr Lochotín", "Lochotínský amfiteátr", "Amfiteátr"]),
    ("Věznice Bory", ["Věznice Plzeň", "Věznice Bory", "Věznice Plzeň-Bory"]),
    ("Borský park", ["Borský park"]),
    ("Velký bolevecký rybník", ["Velký Bolevecký rybník", "Velký bolevecký rybník"]),
    ("DEPO2015", ["DEPO2015"]),
    ("Pivovarské muzeum", ["Pivovarské muzeum v Plzni", "Pivovarské muzeum"]),
    ("Zimní stadion", ["Logspeed CZ Aréna", "Home Monitoring Aréna", "Zimní stadion"]),
    ("Západočeská univerzita", ["Západočeská univerzita v Plzni", "Západočeská univerzita"]),
    ("Fakultní nemocnice Lochotín", ["Fakultní nemocnice Plzeň - Lochotín", "Fakultní nemocnice Lochotín", "Fakultní nemocnice Plzeň"]),
    ("Mlýnská strouha", ["Mlýnská strouha"]),
    ("Loosovy interiéry", ["Loosovy interiéry - Brummelův dům", "Loosovy interiéry"]),
    ("Rozhledna Sylván", ["Sylván (rozhledna)", "Sylván"]),
    ("Rozhledna Chlum", ["rozhledna Chlum", "Rozhledna Chlum"]),
    ("Kalikovský mlýn", ["Kalikovský mlýn"]),
    ("Meditační zahrada", ["Meditační zahrada", "Památník obětem zla"]),
    ("Lobezský park", ["Lobezský park"]),
    ("Ústřední hřbitov", ["Ústřední hřbitov"]),
    ("Papírna", ["Papírna Plzeň"]),
    ("Wilsonův most", ["Wilsonův most"]),
    ("Košutecké jezírko", ["Košutecké jezírko"]),
    ("Šídlovský rybník", ["Šídlovský rybník", "Šídlovák"]),
    # okolí Plzně
    ("Hrad Radyně", ["Hrad Radyně", "Radyně (zříc.)"]),
    ("Rotunda sv. Petra a Pavla", ["Hůrka (rotunda)"]),
    ("Radnice ve Starém Plzenci", ["Městská radnice Starý Plzenec"]),
    ("Zřícenina hradu Litice", ["zřícenina hradu Litice", "Hrad Litice"]),
    ("Přehrada České údolí", ["Přehrada České údolí"]),
    ("Zámek Křimice", ["zámek Křimice"]),
    ("Zámek Malesice", ["Zámek Malesice"]),
    ("Zřícenina Kyjov", ["Zřícenina Kyjov", "Kyjov zřícenina"]),
    ("Rozhledna Krkavec", ["Krkavec (rozhledna)"]),
    ("Kamenný rybník", ["Kamenný rybník"]),
    ("Kolomazná pec", ["Kolomazná pec"]),
    ("Air Park Zruč", ["Air Park Zruč"]),
    ("Zřícenina Věžka", ["Věžka"]),
    ("Radnice v Třemošné", ["Městský úřad Třemošná"]),
    ("Radnice v Horní Bříze", ["Městský úřad Horní Bříza"]),
    ("Letiště Letkov", ["Letiště Letkov"]),
    ("Nákupní centrum Olympia", ["Olympia"]),
]

# Přesné objekty v Rokycanech mají v OSM jména sdílená s jinými místy a vztažnými body.
LANDMARK_WAYS = [
    ("Masarykovo náměstí (Rokycany)", 48787149),
    ("Nádraží Rokycany", 81988976),
]


def find_landmarks(ex):
    idx = defaultdict(list)
    for la, lo, t in ex["nodes"].values():
        if t.get("name"):
            idx[t["name"]].append((la, lo, 1, t))
    for wid, (t, ids, pts) in ex["ways"].items():
        if t.get("name"):
            la = sum(p[0] for p in pts) / len(pts)
            lo = sum(p[1] for p in pts) / len(pts)
            pr = 3 if ("building" in t or "leisure" in t or "tourism" in t or "amenity" in t or "natural" in t) else 0
            if "highway" in t and "bridge" not in t and "man_made" not in t:
                pr = -1
            idx[t["name"]].append((la, lo, pr, t))
    out = []
    missing = []
    for title, keys in LANDMARKS:
        hit = None
        for k in keys:
            if k in idx:
                cands = [c for c in idx[k] if c[2] >= 0] or idx[k]
                hit = max(cands, key=lambda c: c[2])
                break
        if not hit:
            missing.append(title)
            continue
        x, z = to_xz(hit[0], hit[1])
        out.append([round(x, 1), round(z, 1), title])
    for title, osm_id in LANDMARK_WAYS:
        way = ex["ways"].get(osm_id)
        if way is None:
            missing.append(title)
            continue
        x, z = to_xz(*centroid(way[2]))
        out.append([round(x, 1), round(z, 1), title])
    hamr = ex["nodes"].get(2443978783)
    if hamr:
        x, z = to_xz(*hamr[:2])
        out.append([round(x, 1), round(z, 1), "Vodní hamr Dobřív"])
    if missing:
        print("   nenalezené památky:", ", ".join(missing))
    return out


def walking_approaches(ex):
    # Od konce obytné ulice po mostku přes Klabavu až k jižnímu přístupu k hamru.
    ids = (37894287, 37894286, 37894312, 37894311)
    ways = [ex["ways"].get(wid) for wid in ids]
    if not all(ways):
        return {}
    pts = []
    node = 444695615
    for _, nodes, coords in ways:
        if nodes[0] == node:
            node = nodes[-1]
        elif nodes[-1] == node:
            node = nodes[0]
            coords = coords[::-1]
        else:
            raise ValueError("Pěší přístup k hamru: cesty OSM na sebe nenavazují.")
        pts.extend(coords[1:] if pts else coords)
    return {"Vodní hamr Dobřív": [round(v, 1) for p in pts for v in to_xz(*p)]}


# --------------------------------------------------------------- main ------

def build(output):
    t0 = time.time()
    with open(os.path.join(RAW, "extract.pkl"), "rb") as f:
        ex = pickle.load(f)
    timestamp = extract_timestamp(ex)
    osm_source = ex.get("source", {})
    if ex.get("bbox") != BBOX or osm_source.get("extractBbox") != OSM_BBOX or not osm_source.get("sha256"):
        raise ValueError("Výřez OSM chybí nebo neodpovídá nastavení. Spusťte znovu tools/extract_osm.py.")
    print("načítám výškopis…")
    dem = Dem()

    print("budovy…")
    blds = build_buildings(ex, dem)
    pack_buildings(os.path.join(output, "buildings.bin"), blds)

    print("silnice…")
    roads, road_names = build_roads(ex)
    print("koleje…")
    rails = build_rails(ex)
    print("plochy…")
    polys, wlines = build_land(ex)
    pack_land(os.path.join(output, "land.bin"), polys, wlines)
    print(f"  ploch: {len(polys)}, linií: {len(wlines)}")

    print("terén…")
    bounds = world_bounds(BBOX)
    ter = Terrain(dem, bounds)
    raw_min, raw_max = float(ter.h.min()), float(ter.h.max())
    # terén se zarovná pod sjízdnými silnicemi, pěšími zónami a kolejemi (mimo mosty a tunely)
    ter.burn_lines([r for r in roads if r["cls"] <= 14 and not (r["flags"] & 6)], lambda r: r["w"] / 2)
    ter.burn_lines([r for r in rails if not (r["flags"] & 2)], lambda r: 1.7 if r["cls"] == 1 else 1.3)
    n_water = ter.flatten_water([p["rings"] for p in polys if p["cls"] == LAND["water"]])
    wilson = next((r for r in roads if r["arches"] == 2), None)
    if wilson:
        ter.refine_wilson(wilson)
    clipped = ter.quantize()
    roads, closures = clip_roads(roads, bounds)
    nb = ter.bridge_heights(roads, lambda r: bool(r["flags"] & 2))
    nb += ter.bridge_heights(rails, lambda r: bool(r["flags"] & 2))
    for road in roads:
        if road["valik"]:
            ter.tunnel_heights(road)
    ter.write(os.path.join(output, "terrain.bin"), write_pack)
    print(f"  síť {ter.cols} × {ter.rows} po {terrain_mod.G:.0f} m, výšky {raw_min:.0f}–{raw_max:.0f} m n. m., "
          f"základ {ter.base} m, vodních bodů {n_water}, mostů {nb}, strmých řádků {clipped}")

    pack_lines(os.path.join(output, "roads.bin"), roads,
               {"tunnels": [i for i, road in enumerate(roads) if road["valik"]],
                "archedBridges": [[i, road["arches"]] for i, road in enumerate(roads) if road["arches"]]},
               extra=(("cls", np.uint8), ("w", np.float32), ("lanes", np.uint8), ("speed", np.uint8),
                      ("flags", np.uint8), ("name", np.uint16), ("layer", np.int8),
                      ("speedForward", np.uint8), ("speedBackward", np.uint8),
                      ("limitForward", np.uint8), ("limitBackward", np.uint8)))
    print(f"  silnic a cest: {len(roads)}, názvů: {len(road_names)}")
    pack_lines(os.path.join(output, "rails.bin"), rails, {}, extra=(("cls", np.uint8), ("flags", np.uint8)))

    print("MHD…")
    transit = build_transit(ex)

    print("body zájmu…")
    pois, trees = build_pois(ex, dem, road_names)
    landmarks = find_landmarks(ex)
    tr = np.array([[round(x * 10), round(z * 10)] for x, z in trees], np.int32)
    write_pack(os.path.join(output, "trees.bin"), {"count": len(trees)}, {"x": tr[:, 0].copy(), "z": tr[:, 1].copy()})

    meta = {
        "origin": ORIGIN,
        "bounds": dict(zip(("minX", "maxX", "minZ", "maxZ"), map(round, bounds))),
        "osmTimestamp": timestamp,
        "osmTimestampSource": "pbf-header",
        "sources": {"bbox": BBOX, "osm": osm_source, "elevation": dem.sources},
        "baseElevation": ter.base,
        "roadNames": road_names,
        "transit": transit,
        "landmarks": landmarks,
        "walkingApproaches": walking_approaches(ex),
        "roadClosures": closures,
        "traffic": build_traffic(ex, roads, bounds, RAW),
    }
    meta.update(pois)
    meta_path = os.path.join(output, "meta.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  meta.json: {os.path.getsize(meta_path) / 1e6:.2f} MB")
    print(f"  podniky: {len(pois['food'])}, adresy: {len(pois['addresses'])}, stromy: {len(trees)}, "
          f"věže/komíny: {len(pois['towers'])}, památky: {len(landmarks)}, čtvrti: {len(pois['places'])}")
    print(f"hotovo za {time.time() - t0:.0f} s")


def main(output=None):
    output = os.path.abspath(OUT if output is None else output)
    parent = os.path.dirname(output)
    os.makedirs(parent, exist_ok=True)
    with TemporaryDirectory(dir=parent) as staging:
        build(staging)
        os.makedirs(output, exist_ok=True)
        for name in os.listdir(staging):
            os.replace(os.path.join(staging, name), os.path.join(output, name))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", help="výstupní složka (výchozí public/data)")
    sys.exit(main(parser.parse_args().output_dir))
