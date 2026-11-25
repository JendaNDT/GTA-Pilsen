import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from build_underpasses import paint, smooth_junctions


class Rovina:
    def nodes(self, xy):
        return np.full(len(xy), 310.0)


class Podjezdy(unittest.TestCase):
    def test_zarez_na_svahu_zachova_spad_a_konci_za_krajnici(self):
        ground = Rovina()
        changes = {}
        points = np.array([[-12., 0.], [0., 0.], [12., 0.]])
        paint(changes, points, [307., 307.6, 308.2], [1., 1., 1.], 3, ground)
        smooth_junctions(changes, ground)
        self.assertEqual(changes[(0, 0)][1], -240)
        self.assertEqual(changes[(2, 1)][1], -220)
        self.assertEqual(changes[(2, -1)][1], -220)
        self.assertNotIn((0, 5), changes)
