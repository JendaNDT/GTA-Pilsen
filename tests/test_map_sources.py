import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from area import BBOX
from coordinates import ORIGIN, to_wgs84, to_xz, world_bounds
from map_sources import DEM_GRID, dump_dem, load_dem


class MapSourcesTests(unittest.TestCase):
    def test_coordinates_match_shipped_map_and_extend_east(self):
        meta = json.loads((ROOT / "public/data/meta.json").read_text(encoding="utf-8"))
        self.assertEqual(ORIGIN, meta["origin"])
        self.assertEqual([round(v) for v in world_bounds(BBOX)],
                         [meta["bounds"][k] for k in ("minX", "maxX", "minZ", "maxZ")])
        points = [
            ((49.7475, 13.3776), (0.0, 0.0)),
            ((49.74268195, 13.59419935), (15609.448757, 535.882793)),  # Rokycany
            ((49.7196333, 13.6920319), (22659.849305, 3099.445841)),  # Dobřív
        ]
        for gps, expected in points:
            with self.subTest(gps=gps):
                x, z = to_xz(*gps)
                self.assertAlmostEqual(x, expected[0], places=6)
                self.assertAlmostEqual(z, expected[1], places=6)
                self.assertEqual(to_wgs84(x, z), gps)

    def test_dem_rejects_different_bounds_and_replaced_raster(self):
        with TemporaryDirectory() as directory, patch.dict(DEM_GRID, {"shape": [2, 2]}):
            path = Path(directory) / "dmr.npy"
            elevations = np.full((2, 2), 300, dtype=np.float32)
            dump_dem(path, elevations, "2026-11-16T18:00:00+00:00")
            array, info = load_dem(path)
            np.testing.assert_array_equal(array, elevations)
            self.assertEqual(info["service"], "dmr5g")
            with patch.dict(DEM_GRID, {"bbox": [0, 0, 1, 1]}):
                with self.assertRaisesRegex(ValueError, "jiný výřez"):
                    load_dem(path)
            np.save(path, elevations + 10)
            with self.assertRaisesRegex(ValueError, "kontrolní součet"):
                load_dem(path)
