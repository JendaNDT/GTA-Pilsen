#!/usr/bin/env python3
"""Stáhne výřez OpenStreetMap pro Plzeňský kraj (PBF) do data-raw/.

Zdroj: download.openstreetmap.fr (denně aktualizované výřezy).
Data © přispěvatelé OpenStreetMap, licence ODbL.
"""
import os
import urllib.request

from osm_source import read_pbf_timestamp

URL = "https://download.openstreetmap.fr/extracts/europe/czech_republic/plzensky-latest.osm.pbf"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data-raw")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, "plzensky-latest.osm.pbf")
    temporary = path + ".part"
    print("stahuji", URL)
    req = urllib.request.Request(URL, headers={"User-Agent": "plzen-game-data/0.1"})
    try:
        with urllib.request.urlopen(req, timeout=900) as r, open(temporary, "wb") as f:
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                f.write(chunk)
        timestamp = read_pbf_timestamp(temporary)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.remove(temporary)
    print("  ->", path, os.path.getsize(path), "bajtů, stav OSM", timestamp)


if __name__ == "__main__":
    main()
