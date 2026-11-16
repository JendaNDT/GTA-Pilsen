import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from terrain import Terrain


class TerrainTests(unittest.TestCase):
    def test_water_flattening_preserves_islands_and_land(self):
        # Malý skutečný průchod přes Pillow; ostrov se odečte z vodního polygonu.
        terrain = Terrain.__new__(Terrain)
        terrain.x0 = terrain.z0 = 0
        terrain.rows = terrain.cols = 9
        terrain.h = np.full((9, 9), 10.0)
        terrain.h[2, 2] = 50
        terrain.h[4, 4] = 80
        terrain.h[0, 0] = 90
        outer = [(8, 8), (56, 8), (56, 56), (8, 56)]
        island = [(24, 24), (40, 24), (40, 40), (24, 40)]
        self.assertGreater(terrain.flatten_water([[outer, island]]), 0)
        self.assertEqual(terrain.h[2, 2], 10)
        self.assertEqual(terrain.h[4, 4], 80)
        self.assertEqual(terrain.h[0, 0], 90)
