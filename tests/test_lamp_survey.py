from pathlib import Path
import sys
from types import SimpleNamespace
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from build_lamp_survey import pole_row


class LampSurveyTest(unittest.TestCase):
    def test_samostatny_sloup_uvnitr_mapy(self):
        node = SimpleNamespace(id=7, location=SimpleNamespace(lat=49.7475, lon=13.3776), tags={})
        bounds = dict(minX=-10, maxX=10, minZ=-10, maxZ=10)
        self.assertEqual(pole_row(node, bounds), [7, 0, 0])
        for tags in [{"lamp_mount": "wall"}, {"support": "wall_mounted"}, {"layer": "1"}]:
            node.tags = tags
            self.assertIsNone(pole_row(node, bounds))
        node.tags = {}
        node.location.lon += 1
        self.assertIsNone(pole_row(node, bounds))
