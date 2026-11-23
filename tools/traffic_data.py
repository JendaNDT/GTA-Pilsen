"""Převod dopravního značení a pravidel z OSM a otevřeného pasportu města Plzně."""
from collections import defaultdict
from hashlib import sha256
from io import BytesIO
from math import floor, hypot
from pathlib import Path
import re
from zipfile import ZipFile

from coordinates import to_xz

MUNICIPAL = {
    "svisle": "https://opendata.plzen.eu/public/opendata/download-file/10",
    "vodor": "https://opendata.plzen.eu/public/opendata/download-file/258",
}
SIGN_CODES = {"P2": "priority", "P4": "yield", "P6": "stop", "B1": "closed", "B2": "noEntry",
              "B20a": "speed", "IP4a": "oneway", "IP4b": "oneway"}
CELL = 40


def rounded(p):
    return [round(n, 2) for n in p]


def key(x, z):
    return floor(x / CELL), floor(z / CELL)


class RoadIndex:
    def __init__(self, roads):
        self.roads = roads
        self.grid = defaultdict(list)
        self.ways = defaultdict(list)
        for i, road in enumerate(roads):
            if road["cls"] > 13:
                continue
            self.ways[road["way"]].append(i)
            for a, b in zip(road["pts"], road["pts"][1:]):
                ln = hypot(b[0] - a[0], b[1] - a[1])
                if ln < 0.05:
                    continue
                x0, z0 = key(min(a[0], b[0]), min(a[1], b[1]))
                x1, z1 = key(max(a[0], b[0]), max(a[1], b[1]))
                segment = (i, a, (b[0] - a[0]) / ln, (b[1] - a[1]) / ln, ln)
                for x in range(x0, x1 + 1):
                    for z in range(z0, z1 + 1):
                        self.grid[x, z].append(segment)

    def nearby(self, x, z, radius):
        x0, z0 = key(x - radius, z - radius)
        x1, z1 = key(x + radius, z + radius)
        seen = set()
        for i in range(x0, x1 + 1):
            for j in range(z0, z1 + 1):
                for seg in self.grid[i, j]:
                    if seg in seen:
                        continue
                    seen.add(seg)
                    road, (a, b), dx, dz, length = seg
                    along = max(0, min(length, (x - a) * dx + (z - b) * dz))
                    sx, sz = a + dx * along, b + dz * along
                    distance = hypot(sx - x, sz - z)
                    if distance <= radius:
                        yield road, sx, sz, dx, dz, distance

    def match(self, x, z, radius=14, permitted=None, perpendicular=None):
        matches = []
        for hit in self.nearby(x, z, radius):
            road, _, _, dx, dz, d = hit
            if permitted is not None and road not in permitted:
                continue
            if perpendicular and abs(dx * perpendicular[0] + dz * perpendicular[1]) > 0.65:
                continue
            r = self.roads[road]
            if r["flags"] & 4:
                continue
            matches.append((max(0, d - r["w"] * 0.15) + r["cls"] * 0.12, hit))
        return min(matches, default=(0, None))[1]


def municipal_shapes(path, parts):
    # Export SHP je v S-JTSK / Krovak East North. GeoJSON obsahuje neescapované uvozovky.
    from pyproj import Transformer
    import shapefile

    transform = Transformer.from_crs(5514, 4326, always_xy=True)
    with ZipFile(path) as archive:
        for prefix in parts:
            with shapefile.Reader(shp=BytesIO(archive.read(prefix + ".shp")),
                                  dbf=BytesIO(archive.read(prefix + ".dbf")), encoding="cp1250") as dataset:
                for feature in dataset.iterShapeRecords():
                    if not feature.shape.points:
                        continue
                    def point(p):
                        lon, lat = transform.transform(*p)
                        return tuple(rounded(to_xz(lat, lon)))
                    yield feature.record.as_dict(), feature.shape.points, point


def city_data(folder, index):
    signs, markings, sources = [], [], {}
    # Při sestavení lze použít stejný místní archiv. Bez něj se použije OSM.
    for kind, url in MUNICIPAL.items():
        path = folder / "e04" / (kind + "-shp.zip")
        if not path.exists():
            continue
        with ZipFile(path) as archive:
            revision = max(info.date_time[:3] for info in archive.infolist())
        sources[kind] = {"url": url, "sha256": sha256(path.read_bytes()).hexdigest(),
                         "archiveDate": "%04d-%02d-%02d" % revision}
        if kind == "vodor":
            for tags, pts, point in municipal_shapes(path, ["dz_vodor_lin"]):
                code = tags["OZNACENI"]
                if code not in ("V5", "V7a") or len(pts) < 2:
                    continue
                a, b = point(pts[0]), point(pts[-1])
                length = hypot(b[0] - a[0], b[1] - a[1])
                if not 1.4 <= length <= 34:
                    continue
                x, z = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
                tangent = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
                hit = index.match(x, z, 10, perpendicular=tangent)
                if hit:
                    markings.append({"kind": "line" if code == "V5" else "crossing", "a": a, "b": b,
                                     "road": hit[0], "id": tags["ID_ZNAC"], "source": "plzen"})
            continue
        for tags, pts, point in municipal_shapes(path, ["dz_svisle_pnt"]):
            code = tags["OZNACENI"]
            kind = SIGN_CODES.get(code)
            if not kind:
                continue
            x, z = point(pts[0])
            hit = index.match(x, z, 11)
            if not hit:
                continue
            road, sx, sz, dx, dz, dist = hit
            r = index.roads[road]
            side = (z - sz) * dx - (x - sx) * dz
            if dist < 0.8 or abs(side) < 0.65:
                continue
            direction = 1 if side > 0 or r["flags"] & 1 else -1
            if kind == "noEntry" and r["flags"] & 1:
                direction = -1
            # Samotný pasport značek neurčuje směr platnosti. Natočení odvozujeme
            # od pravé strany vozovky a doloženého směru jednosměrky.
            speed = None
            if kind == "speed":
                m = re.search(r"\b[1-9]\d{0,2}\b", tags["TEXT"])
                if not m:
                    continue
                speed = int(m.group())
            sign = {"kind": kind, "x": x, "z": z, "tx": round(dx * direction, 4), "tz": round(dz * direction, 4),
                    "road": road, "direction": direction, "id": tags["ID_ZNAC"], "source": "plzen"}
            if speed is not None:
                sign["speed"] = speed
            signs.append(sign)
    return signs, markings, sources


def restrictions(ex, index):
    rules = []
    for rid, (tags, members) in ex["rels"].items():
        kind = tags.get("restriction:motorcar") or tags.get("restriction:motor_vehicle") or tags.get("restriction", "")
        if tags.get("type") != "restriction" or not kind.startswith(("no_", "only_")):
            continue
        if any(p.strip() in ("motorcar", "motor_vehicle", "vehicle") for p in tags.get("except", "").split(";")):
            continue
        incoming = [m[1] for m in members if m[0] == "w" and m[2] == "from"]
        outgoing = [m[1] for m in members if m[0] == "w" and m[2] == "to"]
        via = [m for m in members if m[2] == "via"]
        if not incoming or not outgoing or not via:
            continue
        fr = [i for wid in incoming for i in index.ways.get(wid, ())]
        to = [i for wid in outgoing for i in index.ways.get(wid, ())]
        if not fr or not to:
            continue
        if len(via) == 1 and via[0][0] == "n":
            way = ex["ways"][incoming[0]]
            if via[0][1] not in way[1]:
                continue
            pos = rounded(to_xz(*way[2][way[1].index(via[0][1])]))
            rules.append({"id": rid, "kind": kind, "from": fr, "to": to, "at": pos})
        elif all(m[0] == "w" for m in via):
            middle = [index.ways.get(m[1], []) for m in via]
            if all(middle):
                rules.append({"id": rid, "kind": kind, "from": fr, "to": to, "via": middle})
    return rules


def osm_signs(ex, index, municipal):
    endpoints = defaultdict(list)
    for ids in index.ways.values():
        for i in ids:
            road = index.roads[i]
            for direction, p in ((1, road["pts"][0]), (-1, road["pts"][-1])):
                endpoints[tuple(rounded(p))].append((i, direction))
    by_road = defaultdict(list)
    for sign in municipal:
        by_road[sign["road"]].append(sign)

    out = []

    def add(kind, i, a, b, direction, osm_id, speed=0):
        road = index.roads[i]
        dx, dz = b[0] - a[0], b[1] - a[1]
        ln = hypot(dx, dz)
        if ln < 0.05:
            return
        tx, tz = dx / ln, dz / ln
        side = road["w"] / 2 + 0.9
        x, z = rounded((a[0] + tx - tz * side, a[1] + tz + tx * side))
        if any(s["kind"] == kind and hypot(s["x"] - x, s["z"] - z) < 22 for s in by_road[i]):
            return
        item = {"kind": kind, "x": x, "z": z, "tx": round(tx, 4), "tz": round(tz, 4), "road": i,
                "direction": direction, "id": osm_id, "source": "osm", "estimated": True}
        if speed:
            item["speed"] = speed
        out.append(item)

    for p, entries in endpoints.items():
        if len(entries) < 2:
            continue
        for i, direction in entries:
            road = index.roads[i]
            tags = ex["ways"][road["way"]][0]
            a, b = (road["pts"][:2] if direction == 1 else road["pts"][-1:-3:-1])
            other = [(index.roads[n], d) for n, d in entries if n != i]
            if road["flags"] & 1 and not road["flags"] & (4 | 8 | 32) and 4 <= road["cls"] <= 12:
                if tags.get("oneway") in ("yes", "1", "true", "-1") and any(not r["flags"] & 1 for r, _ in other):
                    add("oneway" if direction == 1 else "noEntry", i, a, b, direction, road["way"])
            field = "limitForward" if direction == 1 else "limitBackward"
            limit = road[field]
            if not limit or road["flags"] & (4 | 32) or (direction == -1 and road["flags"] & 1):
                continue
            for r, facing in other:
                arriving = r["limitBackward"] if facing == 1 else r["limitForward"]
                if r["cls"] == road["cls"] and arriving and arriving != limit and (
                        tags.get("name") or tags.get("ref")) == (
                        ex["ways"][r["way"]][0].get("name") or ex["ways"][r["way"]][0].get("ref")):
                    add("speed", i, a, b, direction, road["way"], limit)
                    break
    return out


def highway_values(tags):
    """Jeden uzel OSM může nést přechod i směrový semafor."""
    return {value.strip() for value in tags.get("highway", "").split(";")}


def build_traffic(ex, roads, bounds, raw):
    folder = Path(raw)
    index = RoadIndex(roads)
    signs, markings, sources = city_data(folder, index)
    by_road = defaultdict(list)
    for mark in markings:
        if mark["kind"] == "line":
            by_road[mark["road"]].append(mark)

    tagged = {}
    for nid, (lat, lon, tags) in ex["nodes"].items():
        kinds = highway_values(tags)
        if (kinds.intersection(("stop", "give_way", "traffic_signals", "crossing")) or tags.get("traffic_sign") == "CZ:B1") and tags.get("public_transport") != "stop_position":
            x, z = rounded(to_xz(lat, lon))
            if bounds[0] < x < bounds[1] and bounds[2] < z < bounds[3]:
                tagged[nid] = (x, z, tags, kinds)
    members = defaultdict(set)
    for wid, road_ids in index.ways.items():
        for nid in ex["ways"][wid][1]:
            if nid in tagged:
                members[nid].update(road_ids)

    controls, crossings, conflicts = [], [], []
    for nid, (x, z, tags, kinds) in tagged.items():
        roads_here = members.get(nid)
        if not roads_here:
            continue
        hw = tags.get("highway")
        if tags.get("traffic_sign") == "CZ:B1" and not tags.get("description"):
            hit = index.match(x, z, 8, roads_here)
            if hit:
                i, sx, sz, dx, dz, _ = hit
                r = roads[i]
                a, b = r["pts"][0], r["pts"][-1]
                d = 1 if hypot(x - b[0], z - b[1]) < hypot(x - a[0], z - a[1]) else -1
                side = r["w"] / 2 + 0.6
                signs.append({"kind": "closed", "x": round(sx - dz * d * side, 2),
                              "z": round(sz + dx * d * side, 2), "tx": round(dx * d, 4), "tz": round(dz * d, 4),
                              "road": i, "direction": d, "id": nid, "source": "osm", "estimated": True})
        signal_crossing = tags.get("crossing") == "traffic_signals" or tags.get("crossing:signals") == "yes"
        if "traffic_signals" in kinds or signal_crossing:
            direction = tags.get("traffic_signals:direction")
            for i in sorted(roads_here):
                r = roads[i]
                if r["flags"] & 4:
                    continue
                sign_dir = (1 if direction == "forward" else -1) if direction in ("forward", "backward") else 0
                if r["reverse"]:
                    sign_dir = -sign_dir
                controls.append({"kind": "signal", "x": x, "z": z, "road": i, "direction": sign_dir,
                                 "id": nid, "source": "osm", "directedHead": "traffic_signals" in kinds and bool(sign_dir)})
        if hw in ("stop", "give_way"):
            for i in sorted(roads_here):
                r = roads[i]
                direction = tags.get("direction")
                sign_dir = (1 if direction == "forward" else -1) if direction in ("forward", "backward") else 0
                if r["reverse"]:
                    sign_dir = -sign_dir
                if sign_dir == 0 and (r["flags"] & 1):
                    sign_dir = 1
                if sign_dir == 0 and tags.get("stop") != "all":
                    first, last = r["pts"][0], r["pts"][-1]
                    if hypot(x - first[0], z - first[1]) < 1:
                        sign_dir = -1
                    elif hypot(x - last[0], z - last[1]) < 1:
                        sign_dir = 1
                if sign_dir == 0 and tags.get("stop") != "all":
                    continue
                controls.append({"kind": "stop" if hw == "stop" else "yield", "x": x, "z": z,
                                 "road": i, "direction": sign_dir, "id": nid, "source": "osm"})
        if ("crossing" in kinds or signal_crossing) and tags.get("crossing") not in ("unmarked", "no") and tags.get("crossing:markings") != "no":
            hit = index.match(x, z, 8, roads_here)
            if not hit:
                continue
            i, sx, sz, dx, dz, _ = hit
            width = roads[i]["w"] / 2 + 0.85
            crossings.append({"a": rounded((sx + dz * width, sz - dx * width)),
                              "b": rounded((sx - dz * width, sz + dx * width)),
                              "road": i, "signal": signal_crossing, "id": nid, "source": "osm"})

    linked = defaultdict(list)
    for entry in controls:
        if entry["kind"] != "signal":
            linked[entry["road"]].append(entry)
    for sign in signs:
        r = roads[sign["road"]]
        kind, direction = sign["kind"], sign["direction"]
        if kind == "speed":
            speed = r["limitForward" if direction == 1 else "limitBackward"]
            if speed and speed != sign["speed"]:
                conflicts.append({"sign": sign, "kept": "osm", "value": speed, "reason": "speed"})
                continue
        if kind in ("oneway", "noEntry") and not r["flags"] & 1:
            conflicts.append({"sign": sign, "kept": "osm", "reason": "oneway-association"})
            continue
        if sign["kind"] not in ("stop", "yield"):
            continue
        i, x, z = sign["road"], sign["x"], sign["z"]
        tx, tz = sign["tx"], sign["tz"]
        r = roads[i]
        if r["flags"] & 32:
            continue
        hit = index.match(x, z, 11, {i})
        if not hit:
            continue
        _, sx, sz, *_ = hit
        best = (14, None)
        for line in by_road[i]:
            ax, az = line["a"]
            bx, bz = line["b"]
            mx, mz = (ax + bx) / 2, (az + bz) / 2
            if (mz - sz) * tx - (mx - sx) * tz < -0.5:
                continue
            d = hypot(mx - x, mz - z)
            if d < best[0]:
                best = d, line
        near = next((c for c in linked[i] if c["direction"] in (0, sign["direction"])
                     and hypot(c["x"] - sx, c["z"] - sz) < 13), None)
        if near and near["kind"] != sign["kind"]:
            conflicts.append({"sign": sign, "kept": "osm", "osm": near["id"], "reason": "priority"})
            continue
        mark = best[1]
        if mark:
            ax, az = mark["a"]
            bx, bz = mark["b"]
            mid = index.match((ax + bx) / 2, (az + bz) / 2, 11, {i})
            if mid:
                _, sx, sz, *_ = mid
        if near:
            near.update(x=round(sx, 2), z=round(sz, 2), mark=mark["id"] if mark else None)
        else:
            entry = {"kind": sign["kind"], "x": round(sx, 2), "z": round(sz, 2), "road": i,
                     "direction": sign["direction"], "source": "plzen", "id": sign["id"],
                     "mark": mark["id"] if mark else None}
            controls.append(entry)
            linked[i].append(entry)

    city_crossings = [m for m in markings if m["kind"] == "crossing"]
    crossings_by_road = defaultdict(list)
    for c in crossings:
        crossings_by_road[c["road"]].append(c)
    replaced = set()
    for c in city_crossings:
        x, z = ((c["a"][k] + c["b"][k]) / 2 for k in (0, 1))
        nearby = [o for o in crossings_by_road[c["road"]]
                  if hypot(x - (o["a"][0] + o["b"][0]) / 2, z - (o["a"][1] + o["b"][1]) / 2) < 8]
        c["signal"] = any(o["signal"] for o in nearby)
        replaced.update(o["id"] for o in nearby)

    suppressed = {c["sign"]["id"] for c in conflicts}
    signs = [s for s in signs if s["source"] != "plzen" or s["id"] not in suppressed]
    signs.extend(osm_signs(ex, index, signs))
    # I po rozdělení silnice na hranici mapy má každý díl stejnou výjimku pro MHD.
    bus_contraflow = []
    for i, road in enumerate(roads):
        if road["flags"] & 1:
            tags = ex["ways"][road["way"]][0]
            if tags.get("oneway:bus", tags.get("oneway:psv")) in ("no", "false", "0"):
                bus_contraflow.append(i)
    result = {"sources": sources, "restrictions": restrictions(ex, index), "controls": controls, "signs": signs,
              "busContraflow": bus_contraflow,
              "lines": [m for m in markings if m["kind"] == "line"],
              "crossings": city_crossings + [c for c in crossings if c["id"] not in replaced],
              "conflicts": conflicts}
    print("  doprava:", ", ".join(f"{k}={len(v)}" for k, v in result.items()))
    return result
