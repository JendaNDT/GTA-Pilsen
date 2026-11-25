import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from build_stop_survey import match


class StopSurveyTest(unittest.TestCase):
    def test_smer_a_vybaveni(self):
        stops = [("Plzeň, Koterov", 0, 0, "1/1"), ("Koterov", 12, 0, "1/2"),
                 ("Koterov", 0, 0, "1/3"), ("Koterov", 50, 0, "1/4")]
        nodes = [(11, "Koterov", 1, 0, True, True), (12, "Koterov", 13, 0, False, True),
                 (13, "Jiná", 50, 0, True, True)]
        self.assertEqual(match(stops, nodes), {"1/1": [1, 0, 1, 1], "1/2": [13, 0, 0, 1]})
