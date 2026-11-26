import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from build_cycle_network import build, directions


class CycleNetworkTest(unittest.TestCase):
    def test_bike_access_and_oneway(self):
        self.assertEqual(directions({"highway": "residential", "oneway": "yes", "oneway:bicycle": "no"}), 3)
        self.assertEqual(directions({"highway": "residential", "oneway": "-1"}), 2)
        self.assertEqual(directions({"highway": "residential", "junction": "roundabout"}), 1)
        self.assertEqual(directions({"highway": "footway"}), 0)
        self.assertEqual(directions({"highway": "footway", "bicycle": "designated", "access": "no"}), 3)
        self.assertEqual(directions({"highway": "path", "bicycle": "designated", "oneway": "yes"}), 1)
        self.assertEqual(directions({"highway": "path", "bicycle": "designated", "mtb": "single track"}), 0)
        self.assertEqual(directions({"highway": "service", "access:conditional": "no @ (dusk-dawn)"}), 0)
        self.assertEqual(directions({"highway": "cycleway", "bicycle:backward": "no"}), 1)
        self.assertEqual(directions({"highway": "cycleway", "bicycle": "dismount"}), 0)
        self.assertEqual(directions({"highway": "motorway", "bicycle": "yes"}), 0)

    def test_keeps_osm_connections_and_barriers(self):
        a, b, c, d = [(49.7475, 13.377 + i * .0001) for i in range(4)]
        road = {"highway": "residential"}
        extract = {
            "bbox": (49.70, 13.30, 49.80, 13.44), "osmTimestamp": "2026-11-15T01:07:22Z",
            "nodes": {2: (*b, {"barrier": "gate"})},
            "ways": {
                11: (road, [1, 2, 3], [a, b, c]),
                12: (road, [3, 4], [c, d]),
                13: ({"highway": "cycleway", "bridge": "yes"}, [5, 6], [b, d]),
            },
            "rels": {20: ({"type": "restriction", "restriction": "no_right_turn", "except": "bus;bicycle"},
                          [("w", 11, "from"), ("n", 3, "via"), ("w", 12, "to")]),
                     21: ({"type": "restriction", "restriction:bicycle": "only_right_turn"},
                          [("w", 11, "from"), ("n", 3, "via"), ("w", 12, "to")])},
        }
        header, graph = build(extract, [{"lat": a[0], "lon": a[1]}])
        self.assertNotEqual(graph["b"][0], graph["a"][1])
        self.assertEqual(graph["b"][1], graph["a"][2])
        self.assertNotEqual(graph["b"][2], graph["b"][3])
        self.assertEqual([rule["kind"] for rule in header["restrictions"]], ["only_right_turn"])
        self.assertEqual(graph["level"].tolist(), [0, 0, 1])


if __name__ == "__main__":
    unittest.main()
