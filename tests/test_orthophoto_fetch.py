import hashlib
import io
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from xml.etree import ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

import fetch_orthophoto as ortho
from coordinates import to_xz


class TestOrthophotoFetch(unittest.TestCase):
    def test_selects_only_sheets_intersecting_game_bounds(self):
        min_x, max_z = to_xz(49.5, 13)
        max_x, min_z = to_xz(50, 13.5)
        bounds = {"minX": min_x, "maxX": max_x, "minZ": min_z, "maxZ": max_z}
        polygons = {
            "uvnitr": "49.6 13.1 49.7 13.2 49.6 13.2 49.6 13.1",
            "na-okraji": "49.4 13.4 49.6 13.6 49.4 13.6 49.4 13.4",
            "sever": "50.1 13.2 50.2 13.3 50.1 13.3 50.1 13.2",
            "vychod": "49.6 13.6 49.7 13.7 49.6 13.7 49.6 13.6",
        }
        entries = "".join(f"<entry><id>{name}</id><g:polygon>{polygon}</g:polygon></entry>"
                          for name, polygon in polygons.items())
        catalogue = ET.fromstring(f'<feed xmlns="{ortho.NS["a"]}" xmlns:g="{ortho.NS["g"]}">'
                                  f"{entries}</feed>")
        self.assertEqual(ortho.select_feeds(catalogue, bounds), ["na-okraji", "uvnitr"])

    def test_reads_zip_url_length_and_survey_year_from_dataset_feed(self):
        updated = "2026-02-26T08:38:20+02:00"
        url = "https://openzu.cuzk.gov.cz/opendata/ORTOFOTO/WRTO24.2025.BLOV40.zip"
        payload = (f'<feed xmlns="{ortho.NS["a"]}"><entry><updated>{updated}</updated>'
                   f'<link href="{url}" length="6" /></entry></feed>').encode()
        with patch.object(ortho, "read_url", return_value=io.BytesIO(payload)):
            sheet = ortho.read_sheet("https://atom.cuzk.gov.cz/list.xml")
        self.assertEqual(sheet, {"id": "WRTO24.2025.BLOV40", "url": url, "length": 6,
                                 "updated": updated, "year": 2025})

    def test_records_only_successful_conversion_and_resumes_the_download(self):
        sheet = {"id": "mapa", "url": "https://openzu.cuzk.gov.cz/mapa.zip", "year": 2025,
                 "updated": "2026-02-26", "length": 6}
        first = io.BytesIO(b"abc")
        first.status, first.headers = 200, {}
        second = io.BytesIO(b"def")
        second.status, second.headers = 206, {"Content-Range": "bytes 3-5/6"}
        saved = []

        def convert(record, path):
            saved.append(record)
            self.assertEqual(path.read_bytes(), b"abcdef")

        with tempfile.TemporaryDirectory() as directory, \
                patch.object(ortho, "read_sheet", return_value=sheet), \
                patch.object(ortho, "read_url", side_effect=[first, second]) as download:
            raw = Path(directory)
            with self.assertRaisesRegex(ValueError, "Neúplný archiv"):
                ortho.process_sheets(["feed"], raw, convert, lambda record: record in saved)
            self.assertFalse((raw / "sheets.json").exists())

            records = ortho.process_sheets(["feed"], raw, convert, lambda record: record in saved)
            self.assertEqual(download.call_args.args[1], {"Range": "bytes=3-"})
            self.assertEqual(records, [{**sheet, "sha256": hashlib.sha256(b"abcdef").hexdigest()}])
            self.assertEqual(ortho.read_json(raw / "sheets.json", {}), {"mapa": records[0]})
            self.assertFalse((raw / "rozpracovany.zip").exists())

            repeated = ortho.process_sheets(["feed"], raw, convert, lambda record: record in saved)
            self.assertEqual(repeated, records)
            self.assertEqual(len(saved), 1)
            self.assertEqual(download.call_count, 2)


if __name__ == "__main__":
    unittest.main()
