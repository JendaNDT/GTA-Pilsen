#!/usr/bin/env python3
"""Převede zaměřené plochy stavebních objektů do souřadnic používaných ve hře."""
import argparse
from collections import Counter, defaultdict
from functools import lru_cache
from hashlib import sha256
import json
from pathlib import Path
from zipfile import ZipFile

from pyproj import Transformer

from build_heritage import read_shapes
from coordinates import to_xz


def projector():
    transform = Transformer.from_crs(5514, 4326, always_xy=True)

    @lru_cache(maxsize=100000)
    def project(east, north):
        lon, lat = transform.transform(east, north)
        return to_xz(lat, lon)

    return project


def convert(source, base):
    project = projector()
    with ZipFile(source) as archive:
        def layer(suffix):
            name, = [n for n in archive.namelist() if n.endswith(suffix + ".shp")]
            return read_shapes(archive, name[:-4])

        with layer("Plzen_objekty_2024_06_MultiPatch") as reader:
            sources = Counter(row[0] for row in reader.iterRecords(fields=["BUDID_VYH"]))
        objects = defaultdict(list)
        with layer("Plzen_objekty_2024_06_Plochy") as reader:
            for feature in reader.iterShapeRecords(fields=["Layer", "BUDID_VYH"]):
                kind, uid = feature.record
                if uid not in sources:
                    raise ValueError(f"Plocha {uid} nemá odpovídající objekt.")
                shape = feature.shape
                rings = []
                for start, end in zip(shape.parts, [*shape.parts[1:], len(shape.points)]):
                    points = []
                    for i in range(start, end):
                        x, z = project(*shape.points[i])
                        vertex = [round(x, 2), round(shape.z[i] - base, 2), round(z, 2)]
                        if not points or points[-1] != vertex:
                            points.append(vertex)
                    if points and points[-1] == points[0]:
                        points.pop()
                    if len(points) >= 3:
                        rings.append([axis for vertex in points for axis in vertex])
                objects[uid].append([kind, *rings])
    return {"sha256": sha256(source.read_bytes()).hexdigest(), "baseElevation": base,
            "objects": [[uid, sources[uid], objects[uid]] for uid in sorted(sources)]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--meta", type=Path, default=Path("public/data/meta.json"))
    parser.add_argument("--output", type=Path, default=Path("data-raw/structures/plochy.json"))
    args = parser.parse_args()
    base = json.loads(args.meta.read_text(encoding="utf-8"))["baseElevation"]
    data = convert(args.source, base)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    objects = data["objects"]
    print(f"{sum(n for _, n, _ in objects)} záznamů, {len(objects)} ID, "
          f"{sum(len(f) for _, _, f in objects)} ploch")


if __name__ == "__main__":
    main()
