import contextlib
import io
import pickle
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import osmium

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from osm_source import extract_timestamp, normalize_timestamp, read_pbf_timestamp
import build_data
import extract_osm
import fetch_osm


class OsmSourceTests(unittest.TestCase):
    def test_timestamp_formats(self):
        self.assertEqual(normalize_timestamp("2026-11-15T01\\:07\\:22Z"), "2026-11-15T01:07:22Z")
        self.assertEqual(normalize_timestamp("2026-11-15T02:07:22+01:00"), "2026-11-15T01:07:22Z")

    def test_missing_invalid_or_ambiguous_timestamps_are_rejected(self):
        for value in (None, "", "včera", "2026-11-15", "2026-11-15T01:07:22"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                normalize_timestamp(value)
        with self.assertRaisesRegex(ValueError, "extract_osm.py"):
            extract_timestamp({})

    def test_pbf_header_is_the_source_even_for_temporary_downloads(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "map.osm.pbf.part"
            header = osmium.io.Header()
            header.set("osmosis_replication_timestamp", "2026-11-15T01:07:22Z")
            with osmium.SimpleWriter(osmium.io.File(str(path), "pbf"), header=header) as writer:
                writer.add_node(osmium.osm.mutable.Node(id=1, location=(13.37, 49.74)))
            timestamp = read_pbf_timestamp(path)
            self.assertEqual(timestamp, "2026-11-15T01:07:22Z")
            self.assertEqual(extract_timestamp({"osmTimestamp": timestamp}), timestamp)

    def test_pbf_without_replication_timestamp_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "map.osm.pbf"
            with osmium.SimpleWriter(str(path)) as writer:
                writer.add_node(osmium.osm.mutable.Node(id=1, location=(13.37, 49.74)))
            with self.assertRaisesRegex(ValueError, "Chybí datum"):
                read_pbf_timestamp(path)

    def test_extraction_keeps_the_source_timestamp_with_the_data(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "plzensky-latest.osm.pbf"
            header = osmium.io.Header()
            header.set("osmosis_replication_timestamp", "2026-11-15T01:07:22Z")
            with osmium.SimpleWriter(str(path), header=header) as writer:
                writer.add_node(osmium.osm.mutable.Node(
                    id=1, location=(13.3776, 49.7475), tags={"amenity": "restaurant", "name": "Test"}))
            with patch.object(extract_osm, "RAW", directory), contextlib.redirect_stdout(io.StringIO()):
                extract_osm.main()
            with open(Path(directory) / "extract.pkl", "rb") as stream:
                extract = pickle.load(stream)
            self.assertIn(1, extract["nodes"])
            self.assertEqual(extract_timestamp(extract), "2026-11-15T01:07:22Z")

    def test_build_rejects_undated_extract_before_replacing_any_game_data(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "output"
            output.mkdir()
            existing = output / "buildings.bin"
            existing.write_bytes(b"existing game data")
            with open(Path(directory) / "extract.pkl", "wb") as stream:
                pickle.dump({"bbox": (49.7, 13.3, 49.8, 13.4)}, stream)
            with patch.object(build_data, "RAW", directory), patch.object(build_data, "OUT", str(output)):
                with self.assertRaisesRegex(ValueError, "extract_osm.py"):
                    build_data.main()
            self.assertEqual(existing.read_bytes(), b"existing game data")
            self.assertFalse((output / "meta.json").exists())

    def test_invalid_download_preserves_the_previous_source_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "plzensky-latest.osm.pbf"
            path.write_bytes(b"previous complete file")
            with patch.object(fetch_osm, "OUT_DIR", directory), \
                    patch.object(fetch_osm.urllib.request, "urlopen", return_value=io.BytesIO(b"invalid PBF")), \
                    contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaises((RuntimeError, ValueError)):
                    fetch_osm.main()
            self.assertEqual(path.read_bytes(), b"previous complete file")
            self.assertFalse(Path(str(path) + ".part").exists())
