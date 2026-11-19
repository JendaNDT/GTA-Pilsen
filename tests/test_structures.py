import json
from math import dist
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from build_structures import convert, projector


class Structures(unittest.TestCase):
    def test_kontrolni_body(self):
        # Nezávislý výpočet proj4js 2.23.0, Křovák a sedmiparametrová transformace
        # S-JTSK do WGS84 s parametry stejné operace EPSG jako u městských budov.
        project = projector()
        for xy, expected in [
            ((-820000, -1070000), (2416.90861, -60.41500)),
            ((-823000, -1069000), (-699.33507, -599.19876)),
            ((-818000, -1072000), (4693.08232, 1618.25573)),
        ]:
            self.assertLess(dist(project(*xy), expected), 0.05)

    def test_mestsky_archiv(self):
        path = ROOT / 'data-raw/e05-mesto/plzen-2024-shp.zip'
        if not path.exists():
            self.skipTest('Úplný archiv není přiložen k distribuované hře.')
        base = json.loads((ROOT / 'public/data/meta.json').read_text())['baseElevation']
        result = convert(path, base)
        objects = result['objects']
        self.assertEqual(result['sha256'], '825dc3e395044b1f5a47e27c812cc4189829e9134cc027865ffc8fcb3e7bb9ac')
        self.assertEqual((sum(n for _, n, _ in objects), len(objects), sum(len(f) for _, _, f in objects)),
                         (614, 602, 12315))
