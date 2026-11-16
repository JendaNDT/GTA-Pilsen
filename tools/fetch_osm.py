#!/usr/bin/env python3
"""Stáhne výřez OpenStreetMap pro Plzeňský kraj (PBF) do data-raw/.

Zdroj: download.openstreetmap.fr (denně aktualizované výřezy).
Data © přispěvatelé OpenStreetMap, licence ODbL.
"""
import os
import urllib.request

URL = "https://download.openstreetmap.fr/extracts/europe/czech_republic/plzensky-latest.osm.pbf"
STATE = "https://download.openstreetmap.fr/extracts/europe/czech_republic/plzensky.state.txt"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data-raw")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for url, name in ((URL, "plzensky-latest.osm.pbf"), (STATE, "plzensky.state.txt")):
        path = os.path.join(OUT_DIR, name)
        print("stahuji", url)
        req = urllib.request.Request(url, headers={"User-Agent": "plzen-game-data/0.1"})
        with urllib.request.urlopen(req, timeout=900) as r, open(path, "wb") as f:
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                f.write(chunk)
        print("  ->", path, os.path.getsize(path), "bajtů")


if __name__ == "__main__":
    main()
