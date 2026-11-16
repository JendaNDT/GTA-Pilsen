#!/usr/bin/env python3
"""Stáhne dvě otevřené SHP distribuce pasportu dopravního značení města Plzně."""
import argparse
from pathlib import Path
from shutil import copyfileobj
from tempfile import TemporaryDirectory
from urllib.request import Request, urlopen
from zipfile import ZipFile

from traffic_data import MUNICIPAL

DESTINATION = Path(__file__).resolve().parent.parent / "data-raw" / "e04"


def download(force=False):
    DESTINATION.mkdir(parents=True, exist_ok=True)
    for kind, url in MUNICIPAL.items():
        target = DESTINATION / f"{kind}-shp.zip"
        if target.exists() and not force:
            print(f"{target.name} už je stažený")
            continue
        with TemporaryDirectory(dir=DESTINATION) as directory:
            archive = Path(directory) / target.name
            request = Request(url, headers={"User-Agent": "plzen-game-data/0.1"})
            with urlopen(request, timeout=90) as source, archive.open("wb") as dest:
                copyfileobj(source, dest)
            with ZipFile(archive) as data:
                stem = f"dz_{kind}_" + ("pnt" if kind == "svisle" else "lin")
                for ext in (".shp", ".dbf"):
                    data.getinfo(stem + ext)
                invalid = data.testzip()
                if invalid:
                    raise ValueError(f"{target.name}: poškozený soubor {invalid}")
            archive.replace(target)
        print(f"{target.name} staženo")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="stáhnout i existující archivy")
    download(parser.parse_args().force)
