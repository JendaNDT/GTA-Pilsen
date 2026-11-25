"""Vybrat samostatné sloupy osvětlení v hranicích herní mapy."""
import argparse
import json
from pathlib import Path

from coordinates import to_xz
from osm_source import read_pbf_timestamp


def pole_row(node, bounds):
    x, z = to_xz(node.location.lat, node.location.lon)
    if not (bounds["minX"] <= x <= bounds["maxX"] and bounds["minZ"] <= z <= bounds["maxZ"]):
        return None
    if node.tags.get("lamp_mount") == "wall" or node.tags.get("support") == "wall_mounted":
        return None
    if node.tags.get("layer", "0") != "0":
        return None
    return [node.id, round(x, 2), round(z, 2)]


if __name__ == "__main__":
    import osmium
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pbf", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--meta", type=Path, default=Path("public/data/meta.json"))
    args = parser.parse_args()
    meta = json.loads(args.meta.read_text())
    timestamp = read_pbf_timestamp(args.pbf)
    if timestamp != meta["osmTimestamp"]:
        parser.error("Datum zdroje se liší od herní mapy.")
    nodes = osmium.FileProcessor(str(args.pbf), osmium.osm.NODE).with_filter(
        osmium.filter.TagFilter(("highway", "street_lamp")))
    lamps = sorted(row for n in nodes if (row := pole_row(n, meta["bounds"])))
    args.output.write_text(json.dumps({"osm": timestamp, "lamps": lamps}, separators=(",", ":")) + "\n")
    print(len(lamps), "samostatných sloupů")
