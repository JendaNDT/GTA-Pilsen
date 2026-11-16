#!/usr/bin/env python3
"""Převede plochy městských 3D budov 2024 ze S-JTSK/Bpv do herních metrů."""
import argparse
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
from zipfile import ZipFile

from pyproj import Transformer
import shapefile

from coordinates import to_xz


# Katedrála a blok mezi náměstím, Dominikánskou, Veleslavínovou a Rooseveltovou.
PILOT_IDS = {f"{uid:017d}" for uid in range(100681, 100707) if uid not in (100695, 100697)}
PILOT_IDS.add("00000000000101960")
# Druh plochy pro materiál a pro vzdálený model bez drobných prvků.
SURFACES = {
    "Zakladova_deska": 0,
    "Svisle_obvodove_steny": 1,
    "Sikme_stresni_plochy": 2,
    "Vodorovne_stresni_plochy": 3,
    "Vikyr_obvodove_steny": 4,
    "Vikyr_stresni_plochy": 5,
    "Komin_stena": 6,
    "Komin_plocha": 6,
}


def read_shapes(archive, name):
    return shapefile.Reader(
        **{ext: BytesIO(archive.read(f"{name}.{ext}")) for ext in ("shp", "shx", "dbf")}
    )


def build(source, full=False):
    transform = Transformer.from_crs(5514, 4326, always_xy=True)

    def project(east, north):
        lon, lat = transform.transform(east, north)
        return to_xz(lat, lon)

    buildings = {}
    with ZipFile(source) as archive:
        for name in sorted(archive.namelist()):
            if not name.endswith("_budovy_3D_MultiPatch.shp"):
                continue
            tile = name.rsplit("/", 1)[-1].removesuffix("_budovy_3D_MultiPatch.shp")
            with read_shapes(archive, name[:-4]) as reader:
                identifiers = {record[0] for record in reader.iterRecords(fields=["BUDID_VYH"])
                               if full or record[0] in PILOT_IDS}
                for uid in identifiers:
                    buildings.setdefault((tile if full else "", uid), [])
            if not identifiers:
                continue
            member = next(p[:-4] for p in archive.namelist() if p.endswith(f"/{tile}_Plochy.shp"))
            with read_shapes(archive, member) as reader:
                for record in reader.iterShapeRecords(fields=["Layer", "BUDID_VYH"]):
                    layer, uid = record.record
                    if uid not in identifiers:
                        continue
                    shape = record.shape
                    rings = []
                    for start, end in zip(shape.parts, [*shape.parts[1:], len(shape.points)]):
                        vertices = []
                        for idx in range(start, end):
                            x, z = project(*shape.points[idx])
                            vertices.append((round(x, 2), round(shape.z[idx], 2), round(z, 2)))
                        if vertices[0] == vertices[-1]:
                            vertices.pop()
                        if len(vertices) >= 3:
                            rings.append([axis for vertex in vertices for axis in vertex])
                    if rings:
                        buildings[(tile if full else "", uid)].append([SURFACES.get(layer, 6), *rings])
    if not PILOT_IDS.issubset({uid for (_, uid), faces in buildings.items() if faces}):
        raise ValueError("V archivu chybí plochy některé z pilotních budov.")
    if full and any(not faces for faces in buildings.values()):
        missing = sum(not faces for faces in buildings.values())
        print(f"{missing} záznamů bez odpovídajících ploch SHP")
        buildings = {uid: faces for uid, faces in buildings.items() if faces}
    return {"sha256": sha256(source.read_bytes()).hexdigest(),
            "buildings": [[uid, faces] for (_, uid), faces in sorted(buildings.items())]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, default=Path("data-raw/e05/plzen-2024-pilot.json"))
    parser.add_argument("--full", action="store_true", help="Převést všechny čtyři mapové listy")
    args = parser.parse_args()
    result = build(args.source, args.full)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(result['buildings'])} budov, {sum(len(f) for _, f in result['buildings'])} ploch, {args.output.stat().st_size:,} B")


if __name__ == "__main__":
    main()
