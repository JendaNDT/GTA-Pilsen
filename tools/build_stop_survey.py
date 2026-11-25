"""Přiřadit body nástupišť OSM ke stanovištím místního jízdního řádu."""
import argparse
import json
import math
from collections import defaultdict
from pathlib import Path

from coordinates import to_xz
from osm_source import read_pbf_timestamp


def key(name):
    return " ".join(name.casefold().replace(",", " ").split()).removeprefix("plzeň ")


def match(stops, platforms):
    by_name = defaultdict(list)
    for node, name, x, z, shelter, bench in platforms:
        by_name[key(name)].append((node, x, z, shelter, bench))
    candidates = []
    for name, sx, sz, code in stops:
        for node, x, z, shelter, bench in by_name[key(name)]:
            distance = math.hypot(x - sx, z - sz)
            if distance <= 22:
                candidates.append((distance, code, node, x, z, shelter, bench))
    used, result = set(), {}
    for _, code, node, x, z, shelter, bench in sorted(candidates):
        if code not in result and node not in used:
            result[code] = [round(x, 2), round(z, 2), int(shelter), int(bench)]
            used.add(node)
    return result


if __name__ == "__main__":
    import osmium
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pbf", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--timetable", type=Path, default=Path("public/data/timetable.json"))
    args = parser.parse_args()
    stops = json.loads(args.timetable.read_text())["stops"]
    nodes = osmium.FileProcessor(str(args.pbf), osmium.osm.NODE).with_filter(
        osmium.filter.TagFilter(("highway", "bus_stop"), ("public_transport", "platform")))
    platforms = []
    for n in nodes:
        name = n.tags.get("name")
        if name and not n.tags.get("disused:highway") and n.tags.get("disused") != "yes":
            platforms.append((n.id, name, *to_xz(n.location.lat, n.location.lon),
                              n.tags.get("shelter") == "yes", n.tags.get("bench") == "yes"))
    result = match(stops, platforms)
    args.output.write_text(json.dumps({"osm": read_pbf_timestamp(args.pbf), "platforms": result},
                                      sort_keys=True, separators=(",", ":")) + "\n")
    print(len(result), "přiřazených stanovišť")
