#!/usr/bin/env python3
"""Sestaví síť pro kola ze stejného místního výřezu OSM jako herní silnice."""
import argparse
import json
import pickle
from pathlib import Path

import numpy as np

from build_data import ROAD_CLASS, ROAD_EDGE_MARGIN, write_pack
from coordinates import to_xz, world_bounds
from osm_source import extract_timestamp

PUBLIC = {"yes", "designated", "permissive", "official"}
RESTRICTED = {"no", "private", "destination", "delivery", "customers", "permit", "dismount",
              "agricultural", "forestry", "use_sidepath"}
STREETS = {"primary", "secondary", "tertiary", "unclassified", "residential", "living_street",
           "service", "road", "track", "cycleway"} | {kind + "_link" for kind in ("primary", "secondary", "tertiary")}
PATHS = {"footway", "path", "pedestrian", "bridleway", "trunk", "trunk_link"}
BLOCKING = {"gate", "lift_gate", "swing_gate", "block", "jersey_barrier", "planter", "rope",
            "fence", "turnstile", "full-height_turnstile", "kissing_gate", "cycle_barrier",
            "wicket_gate", "ditch", "barrier_board"}
SURFACES = {"sand", "mud", "snow", "ice"}


def directions(tags):
    """Maska směru v pořadí bodů OSM. Jednička vpřed, dvojka vzad."""
    bike = tags.get("bicycle")
    kind = tags.get("highway")
    access = next((tags[key] for key in ("vehicle", "access") if key in tags), None)
    if (kind not in STREETS | PATHS or tags.get("area") == "yes" or tags.get("indoor") == "yes"
        or tags.get("motorroad") == "yes" or tags.get("surface") in SURFACES
        or bike in RESTRICTED or tags.get("bicycle:conditional")
        or (bike not in PUBLIC and (access in RESTRICTED or kind in PATHS))):
        return 0
    one = tags.get("oneway:bicycle")
    if one is None:
        opposite = ("opposite", "opposite_lane", "opposite_track", "opposite_share_busway")
        if any(tags.get(key) in opposite for key in ("cycleway", "cycleway:left", "cycleway:right", "cycleway:both")):
            one = "no"
        elif kind not in ("footway", "path", "pedestrian", "bridleway"):
            one = tags.get("oneway", "yes" if tags.get("junction") == "roundabout" else "no")
    mask = 2 if one == "-1" else 1 if one in ("yes", "1", "true") else 3
    for bit, name in ((1, "forward"), (2, "backward")):
        if tags.get("bicycle:" + name) in RESTRICTED or tags.get("bicycle:" + name + ":conditional"):
            mask &= ~bit
    return mask


def passable_node(tags):
    bike = tags.get("bicycle")
    if bike in PUBLIC:
        return True
    return (bike not in RESTRICTED and tags.get("access") not in RESTRICTED
            and tags.get("barrier") not in BLOCKING and tags.get("kerb") != "raised")


def build(extract, stations):
    bx, ex, bz, ez = world_bounds(extract["bbox"])
    coverage = [to_xz(p["lat"], p["lon"]) for p in stations]
    x0, x1 = max(bx + ROAD_EDGE_MARGIN, min(p[0] for p in coverage) - 1500), min(ex - ROAD_EDGE_MARGIN, max(p[0] for p in coverage) + 1500)
    z0, z1 = max(bz + ROAD_EDGE_MARGIN, min(p[1] for p in coverage) - 1500), min(ez - ROAD_EDGE_MARGIN, max(p[1] for p in coverage) + 1500)
    nodes, ways = {}, {}
    x, z, start, end, segment_way, allow, level, kind = [], [], [], [], [], [], [], []

    def inside(point):
        return x0 <= point[0] <= x1 and z0 <= point[1] <= z1

    def vertex(nid, point):
        if nid not in nodes:
            nodes[nid] = len(x)
            x.append(round(point[0] * 10))
            z.append(round(point[1] * 10))
        return nodes[nid]

    for wid, (tags, ids, points) in sorted(extract["ways"].items()):
        mask = directions(tags)
        if not mask:
            continue
        coords = [to_xz(*p) for p in points]
        for a, b, pa, pb in zip(ids, ids[1:], coords, coords[1:]):
            if pa == pb or not inside(pa) or not inside(pb):
                continue
            # Slepý konec ponechá příjezd k fyzické překážce bez průjezdu skrz ni.
            a = a if passable_node(extract["nodes"].get(a, (0, 0, {}))[2]) else (wid, len(start), a)
            b = b if passable_node(extract["nodes"].get(b, (0, 0, {}))[2]) else (wid, len(start), b)
            if wid not in ways:
                ways[wid] = len(ways)
                allow.append(mask)
                kind.append(ROAD_CLASS[tags["highway"]])
                bridge = tags.get("bridge") not in (None, "no")
                tunnel = tags.get("tunnel") not in (None, "no", "building_passage", "covered")
                level.append(1 if bridge else -1 if tunnel else 0)
            start.append(vertex(a, pa))
            end.append(vertex(b, pb))
            segment_way.append(ways[wid])
    rules = []
    for tags, members in extract["rels"].values():
        bike = tags.get("restriction:bicycle")
        rule = bike or tags.get("restriction", "")
        if tags.get("type") != "restriction" or not rule.startswith(("no_", "only_")):
            continue
        if not bike and "bicycle" in tags.get("except", "").replace(" ", "").split(";"):
            continue
        fr = [ways[ref] for typ, ref, role in members if role == "from" and typ == "w" and ref in ways]
        to = [ways[ref] for typ, ref, role in members if role == "to" and typ == "w" and ref in ways]
        via = [(typ, ref) for typ, ref, role in members if role == "via"]
        if not fr or not to or not via:
            continue
        if len(via) == 1 and via[0][0] == "n" and via[0][1] in nodes:
            at = nodes[via[0][1]]
            rules.append({"kind": rule, "from": fr, "to": to, "at": [x[at] / 10, z[at] / 10], "node": at})
        elif all(typ == "w" and ref in ways for typ, ref in via):
            rules.append({"kind": rule, "from": fr, "to": to, "via": [[ways[ref]] for _, ref in via]})
    header = {"osmTimestamp": extract_timestamp(extract), "bounds": [x0, z0, x1, z1], "restrictions": rules}
    arrays = {
        "x": np.array(x, np.int32), "z": np.array(z, np.int32),
        "a": np.array(start, np.uint32), "b": np.array(end, np.uint32), "way": np.array(segment_way, np.uint32),
        "direction": np.array(allow, np.uint8), "level": np.array(level, np.int8), "kind": np.array(kind, np.uint8),
    }
    return header, arrays


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("extract", type=Path, help="Místní výřez vytvořený skriptem extract_osm.py")
    parser.add_argument("stations", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    with args.extract.open("rb") as source:
        extract = pickle.load(source)
    stations = json.loads(args.stations.read_text(encoding="utf-8"))["stations"]
    header, arrays = build(extract, stations)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    write_pack(args.output, header, arrays)
    print(f"  {len(arrays['x'])} uzlů, {len(arrays['a'])} úseků, {len(header['restrictions'])} omezení odbočení")


if __name__ == "__main__":
    main()
