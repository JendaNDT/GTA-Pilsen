#!/usr/bin/env python3
"""Stáhne výřez OpenStreetMap pro Plzeňský kraj (PBF) do data-raw/.

Zdroj: download.openstreetmap.fr (denně aktualizované výřezy).
Data © přispěvatelé OpenStreetMap, licence ODbL.
"""
import os
import urllib.request
from tempfile import TemporaryDirectory

from osm_source import OSM_URL, read_pbf_timestamp

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data-raw")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, "plzensky-latest.osm.pbf")
    print("stahuji", OSM_URL)
    req = urllib.request.Request(OSM_URL, headers={"User-Agent": "plzen-game-data/0.1"})
    with TemporaryDirectory(dir=OUT_DIR) as directory:
        temporary = os.path.join(directory, "plzensky-latest.osm.pbf")
        with urllib.request.urlopen(req, timeout=900) as r, open(temporary, "wb") as f:
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                f.write(chunk)
        timestamp = read_pbf_timestamp(temporary)
        os.replace(temporary, path)
    print("  ->", path, os.path.getsize(path), "bajtů, stav OSM", timestamp)


if __name__ == "__main__":
    main()
