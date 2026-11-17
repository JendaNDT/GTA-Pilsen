#!/usr/bin/env python3
"""Vytvoří seznam jezů z téhož výřezu OSM jako mapa."""
import argparse
import json
from math import hypot
from pathlib import Path
import pickle

from coordinates import to_xz


def build(extract, bounds):
    points = []
    for tags, _, coords in extract["ways"].values():
        if tags.get("waterway") == "weir":
            n = len(coords)
            points.append(to_xz(sum(p[0] for p in coords) / n, sum(p[1] for p in coords) / n))
    for lat, lon, tags in extract["nodes"].values():
        if tags.get("waterway") == "weir":
            points.append(to_xz(lat, lon))
    weirs = []
    for x, z in points:
        if (bounds["minX"] <= x <= bounds["maxX"] and bounds["minZ"] <= z <= bounds["maxZ"]
                and not any(hypot(x - bx, z - bz) < 11 for bx, bz in weirs)):
            weirs.append([round(x, 1), round(z, 1)])
    return {"osm": extract["osmTimestamp"], "weirs": sorted(weirs)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--osm", type=Path, default=Path("data-raw/extract.pkl"))
    parser.add_argument("--map", type=Path, default=Path("public/data/meta.json"))
    parser.add_argument("--output", type=Path, default=Path("public/data/sound-places.json"))
    args = parser.parse_args()
    with args.osm.open("rb") as source:
        extract = pickle.load(source)
    meta = json.loads(args.map.read_text(encoding="utf-8"))
    if extract["osmTimestamp"] != meta["osmTimestamp"]:
        parser.error("Datum výřezu OSM neodpovídá mapě.")
    result = build(extract, meta["bounds"])
    args.output.write_text(json.dumps(result, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Mapové body jezů: {len(result['weirs'])}")


if __name__ == "__main__":
    main()
