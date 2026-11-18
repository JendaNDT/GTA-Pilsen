import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

import build_orthophoto as ortho
from coordinates import to_xz


class TestOrthophotoBuild(unittest.TestCase):
    def test_converts_game_coordinates_to_a_known_center_in_the_source_sheet(self):
        grid = ortho.read_jgw("0.125 0 0 -0.125 -802499.9375 -1080000.0625")
        col, row = 4934.25, 11841.75
        lon, lat = ortho.TO_WGS84.transform(grid.x + col * 0.125, grid.y - row * 0.125)
        x, z = to_xz(lat, lon)
        actual_col, actual_row = ortho.projected_pixels(grid, x, z)
        self.assertAlmostEqual(actual_col, col, delta=0.5)
        self.assertAlmostEqual(actual_row, row, delta=0.5)
        reduced = grid.downsampled(2)
        self.assertEqual(reduced.pixel(grid.x + 7.5 * 0.125, grid.y - 7.5 * 0.125), (0, 0))

    def test_adjacent_sheets_cover_a_shared_boundary_once(self):
        west = ortho.SheetGrid(-3, 1, 2)
        east = ortho.SheetGrid(1, 1, 2)
        points = np.array([-3, -1, -0.01, 0, 1, 3])
        joined = np.zeros((len(points), 3), dtype=np.uint8)
        coverage = np.zeros(len(points), dtype=int)
        for grid, color in ((west, (40, 90, 10)), (east, (130, 160, 20))):
            image = np.broadcast_to(color, (2, 2, 3))
            inside, pixels = ortho.sample_sheet(image, *grid.pixel(points, np.ones(len(points))))
            joined[inside] = pixels
            coverage += inside
        np.testing.assert_equal(coverage, np.ones(len(points)))
        self.assertEqual(joined[:, 0].tolist(), [40, 40, 40, 130, 130, 130])

    def test_map_blocks_use_the_aligned_chunk_origin(self):
        bounds = {"minX": -8835, "minZ": -10858, "maxX": 24321, "maxZ": 8842}
        origin, size = ortho.world_grid(bounds)
        self.assertEqual(origin, [-8960, -11008])
        self.assertEqual(size, [33 * 512, 20 * 512])
        pilots, regions = ortho.choose_blocks(bounds, origin, size, True)
        self.assertEqual(len(pilots), 8)
        for x, z in ortho.PILOTS:
            self.assertTrue(any(b["minX"] <= x < b["maxX"] and b["minZ"] <= z < b["maxZ"]
                                for b in regions))

    def test_balances_the_brightness_and_white_point_of_adjacent_sheets(self):
        owners = np.broadcast_to([1, 1, 2, 2], (129, 4))
        rgb = np.where((owners == 1)[..., None], [88, 94, 90], [100, 104, 98]).astype(np.uint8)
        source = SimpleNamespace(owners=owners, rgb=rgb, sheets={"západ": {}, "východ": {}})
        correction = ortho.calibrate(source)
        np.testing.assert_allclose(rgb[0, 1] + correction[1], rgb[0, 2] + correction[2], atol=1.5)

    def test_land_mask_preserves_holes_and_excludes_water_and_forest(self):
        land = {"cls": np.array([ortho.LAND[name] for name in ("farmland", "forest", "water")]),
                "pRing": np.array([0, 2, 3, 4]),
                "ringStart": np.array([0, 4, 8, 12, 16])}
        polys = [[(0, 0), (80, 0), (80, 80), (0, 80)], [(60, 60), (70, 60), (70, 70), (60, 70)],
                 [(10, 10), (30, 10), (30, 30), (10, 30)], [(40, 20), (60, 20), (60, 30), (40, 30)]]
        land["vx"], land["vz"] = np.array([p for ring in polys for p in ring]).T * 10
        with patch.object(ortho, "read_pack", return_value=({"count": 3}, land)):
            mask = ortho.draw_land_mask(Path("land.bin"), (0, 0, 50, 50))
        self.assertEqual(mask.getpixel((2, 2)), 255)
        for point in ((10, 10), (25, 12), (32, 32), (45, 45)):
            self.assertEqual(mask.getpixel(point), 0, str(point))

    def test_publishing_checks_assets_and_map_fingerprints_before_writing(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data, candidate, output = (root / name for name in ("data", "candidate", "public"))
            data.mkdir()
            candidate.mkdir()
            for name in ("terrain", "land"):
                (data / f"{name}.bin").write_bytes(name.encode())
            image = candidate / "0_0.webp"
            image.write_bytes(b"bitmapa")
            manifest = {"version": 1, "sources": {
                name: ortho.fingerprint(data / f"{name}.bin") for name in ("terrain", "land")
            }, "blocks": {"0_0": {"file": image.name, "bytes": 7, "sha256": ortho.sha256(image)}}}
            ortho.write_json(candidate / "index.json", manifest)
            ortho.publish_candidate(candidate, data, output)
            self.assertEqual((output / image.name).read_bytes(), b"bitmapa")
            self.assertEqual(ortho.read_json(output / "index.json", None), manifest)
            image.write_bytes(b"zmenena")
            with self.assertRaisesRegex(ValueError, "změněný blok"):
                ortho.publish_candidate(candidate, data, output)
            self.assertEqual((output / image.name).read_bytes(), b"bitmapa")


if __name__ == "__main__":
    unittest.main()
