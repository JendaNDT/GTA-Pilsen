#!/usr/bin/env python3
"""Vybere a předá ke zpracování mapové listy Ortofota ČR ze služby ČÚZK ATOM."""

import argparse
import hashlib
import json
import re
from pathlib import Path
from shutil import copyfileobj
from time import sleep
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

from coordinates import to_wgs84


ROOT = Path(__file__).resolve().parents[1]
ATOM_URL = "https://atom.cuzk.gov.cz/ORTOFOTO/ORTOFOTO.xml"
RAW_DIR = ROOT / "data-raw" / "orthophoto"
NS = {"a": "http://www.w3.org/2005/Atom", "g": "http://www.georss.org/georss"}


def source_bounds(bounds):
    south, west = to_wgs84(bounds["minX"], bounds["maxZ"])
    north, east = to_wgs84(bounds["maxX"], bounds["minZ"])
    return south, west, north, east


def read_url(url, headers=None):
    request = Request(url, headers=headers or {})
    for attempt in range(3):
        try:
            return urlopen(request, timeout=60)
        except (URLError, TimeoutError) as error:
            if attempt == 2 or isinstance(error, HTTPError) and error.code not in (429, 502, 503, 504):
                raise
            if isinstance(error, HTTPError):
                error.close()
            sleep(2 ** attempt)


def select_feeds(catalogue, bounds):
    south, west, north, east = source_bounds(bounds)
    feeds = []
    for entry in catalogue.findall("a:entry", NS):
        polygon = entry.findtext("g:polygon", namespaces=NS)
        if not polygon:
            raise ValueError("V katalogu ortofota chybí obrys listu.")
        coords = list(map(float, polygon.split()))
        lat, lon = coords[::2], coords[1::2]
        if min(lat) < north and max(lat) > south and min(lon) < east and max(lon) > west:
            feeds.append(entry.findtext("a:id", namespaces=NS))
    if not feeds:
        raise ValueError("Katalog ortofota neobsahuje žádný list pro vybrané území.")
    return sorted(feeds)


def read_sheet(feed):
    with read_url(feed) as response:
        entry = ET.parse(response).find("a:entry", NS)
    for link in entry.findall("a:link", NS) if entry is not None else ():
        url = link.get("href", "")
        if url.lower().endswith(".zip") and link.get("length"):
            sheet_id = Path(url).stem
            year = re.search(r"\.(\d{4})\.", sheet_id)
            updated = entry.findtext("a:updated", namespaces=NS)
            if year and updated and int(link.get("length")) > 0:
                return {"id": sheet_id, "url": url, "updated": updated,
                        "length": int(link.get("length")), "year": int(year[1])}
    raise ValueError(f"V katalogu listu chybí údaje o ZIP archivu: {feed}")


def write_json(path, value):
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def read_json(path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fetch_archive(sheet, raw_dir):
    partial = raw_dir / "rozpracovany.zip"
    marker = raw_dir / "rozpracovany.json"
    if read_json(marker, None) != sheet:
        partial.unlink(missing_ok=True)
        write_json(marker, sheet)
    length = sheet["length"]
    size = partial.stat().st_size if partial.exists() else 0
    if size > length:
        partial.unlink()
        size = 0
    if size == length:
        return partial

    headers = {"Range": f"bytes={size}-"} if size else {}
    with read_url(sheet["url"], headers) as response:
        append = size > 0 and response.status == 206
        if append:
            expected = f"bytes {size}-{length - 1}/{length}"
            if response.headers.get("Content-Range") != expected:
                raise ValueError(f"ČÚZK vrátil neočekávaný rozsah pro {sheet['id']}.")
        elif response.status != 200:
            raise ValueError(f"ČÚZK vrátil neočekávanou odpověď pro {sheet['id']}.")
        with partial.open("ab" if append else "wb") as file:
            copyfileobj(response, file, length=1 << 20)
    if partial.stat().st_size != length:
        raise ValueError(f"Neúplný archiv {sheet['id']}. Další běh může ve stahování pokračovat.")
    return partial


def process_sheets(feeds, raw_dir, consume, is_ready):
    """Předá vždy jeden ověřený ZIP. Dokončení zapíše až po úspěšném převodu listu."""
    raw_dir.mkdir(parents=True, exist_ok=True)
    ledger = raw_dir / "sheets.json"
    partial = raw_dir / "rozpracovany.zip"
    marker = raw_dir / "rozpracovany.json"
    records = read_json(ledger, {})
    processed = []
    for index, feed in enumerate(feeds, 1):
        sheet = read_sheet(feed)
        record = records.get(sheet["id"], {})
        if all(record.get(key) == value for key, value in sheet.items()) and is_ready(record):
            if read_json(marker, None) == sheet:
                partial.unlink(missing_ok=True)
                marker.unlink()
            processed.append(record)
            continue
        print(f"[{index}/{len(feeds)}] {sheet['id']}", flush=True)
        archive = fetch_archive(sheet, raw_dir)
        record = {**sheet, "sha256": sha256(archive)}
        consume(record, archive)
        records[sheet["id"]] = record
        write_json(ledger, records)
        archive.unlink()
        marker.unlink()
        processed.append(record)
    return processed


def main():
    parser = argparse.ArgumentParser(description="Vypsat seznam listů Ortofota ČR pro herní mapu.")
    parser.add_argument("--meta", type=Path, default=ROOT / "public/data/meta.json")
    parser.add_argument("--atom", type=Path, help="Použít stažený katalog ATOM.")
    args = parser.parse_args()
    with args.atom.open("rb") if args.atom else read_url(ATOM_URL) as catalogue:
        feeds = select_feeds(ET.parse(catalogue), read_json(args.meta, {})["bounds"])
    print("\n".join(feeds))


if __name__ == "__main__":
    main()
