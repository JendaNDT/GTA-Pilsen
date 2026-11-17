"""Dohledání jízdní dráhy mezi nástupišti na směrovém grafu výřezu OSM."""
from collections import defaultdict
from functools import lru_cache
from heapq import heappop, heappush
from math import floor, hypot

from build_data import DRIVABLE_MAX, ROAD_CLASS, ROAD_EDGE_MARGIN, dp_simplify
from coordinates import to_xz, world_bounds

CELL = 80
BUS_ACCESS = ("bus", "psv", "motor_vehicle", "vehicle", "access")


def cells(a, b, pad=0):
    for x in range(floor((min(a[0], b[0]) - pad) / CELL), floor((max(a[0], b[0]) + pad) / CELL) + 1):
        for z in range(floor((min(a[1], b[1]) - pad) / CELL), floor((max(a[1], b[1]) + pad) / CELL) + 1):
            yield x, z


def distance(a, b):
    return hypot(b[0] - a[0], b[1] - a[1])


def point(a, b, fraction):
    return (a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction)


def inside(p, bounds):
    x, z = p
    return bounds["minX"] <= x <= bounds["maxX"] and bounds["minZ"] <= z <= bounds["maxZ"]


def boundary_fraction(a, b, bounds):
    return min((bounds[limit] - a[i]) / (b[i] - a[i])
               for i, limit in ((0, "minX"), (0, "maxX"), (1, "minZ"), (1, "maxZ"))
               if (b[i] < bounds[limit] if "min" in limit else b[i] > bounds[limit]))


class Network:
    def __init__(self, extract, bounds, rail=False):
        if rail:
            self.bounds = bounds
        else:
            west, east, north, south = world_bounds(extract["bbox"])
            self.bounds = {"minX": west + ROAD_EDGE_MARGIN, "maxX": east - ROAD_EDGE_MARGIN,
                           "minZ": north + ROAD_EDGE_MARGIN, "maxZ": south - ROAD_EDGE_MARGIN}
        self.rail = rail
        self.xy = {}
        self.edges = []
        self.out = defaultdict(list)
        self.grid = defaultdict(list)
        self.portals = []
        self.turns = defaultdict(list)
        self.corridors = defaultdict(dict)
        route_ways = set()
        for tags, members in extract["rels"].values():
            kind, ref = tags.get("route"), tags.get("ref")
            if tags.get("type") != "route" or kind not in ("tram", "bus", "trolleybus") or not ref:
                continue
            if (kind == "tram") != rail or not (ref.isdecimal() or ref.startswith("N") and ref[1:].isdecimal()):
                continue
            corridor = self.corridors[kind, ref]
            for member_type, wid, role in members:
                if member_type == "w" and role in ("", "forward", "backward"):
                    corridor[wid] = 1
                    route_ways.add(wid)

        for wid, (tags, ids, coords) in extract["ways"].items():
            highway = tags.get("highway")
            road_class = ROAD_CLASS.get(highway, 99)
            if rail:
                if tags.get("railway") != "tram" or tags.get("service") == "yard" and wid not in route_ways:
                    continue
            else:
                if road_class > DRIVABLE_MAX:
                    continue
                if tags.get("area") == "yes" or tags.get("indoor") == "yes" or not highway:
                    continue
                access = next((tags[k] for k in BUS_ACCESS if k in tags), "")
                if access in ("no", "private", "agricultural", "forestry") and wid not in route_ways:
                    continue
            oneway = next((tags[k] for k in ("oneway:bus", "oneway:psv", "oneway") if k in tags), None) if not rail else tags.get("oneway")
            if oneway is None and (not rail and road_class < 2 or tags.get("junction") == "roundabout"):
                oneway = "yes"
            penalty = (1.45 if rail and tags.get("service") else 1.0) if rail else (
                1.72 if tags.get("service") in ("driveway", "parking_aisle") else
                1.25 if road_class >= 12 and highway != "busway" else 1.04 if road_class >= 10 else 1.0)
            points = [tuple(round(v, 1) for v in to_xz(*p)) for p in coords]
            for a, b, p, q in zip(ids, ids[1:], points, points[1:]):
                length = distance(p, q)
                if length < 0.05:
                    # Zachovej topologii i u uzlů se shodnými souřadnicemi.
                    length = 0.05
                self.xy[a], self.xy[b] = p, q
                if oneway != "-1":
                    self.add_edge(a, b, wid, length, penalty)
                if oneway not in ("yes", "1", "true"):
                    self.add_edge(b, a, wid, length, penalty)
        if not rail:
            for tags, members in extract["rels"].values():
                if tags.get("type") != "restriction" or set(tags.get("except", "").split(";")) & {"bus", "psv"}:
                    continue
                rule = tags.get("restriction:bus", tags.get("restriction:psv", tags.get("restriction", "")))
                via = [n for k, n, role in members if k == "n" and role == "via"]
                target = {n for k, n, role in members if k == "w" and role == "to"}
                if len(via) == 1 and target and rule:
                    for k, n, role in members:
                        if k == "w" and role == "from":
                            self.turns[via[0], n].append((rule, target))
        self.interior = {node for node, p in self.xy.items() if inside(p, self.bounds)}

    def add_edge(self, a, b, way, length, penalty):
        index = len(self.edges)
        self.edges.append((a, b, way, length, penalty))
        self.out[a].append(index)
        p, q = self.xy[a], self.xy[b]
        for cell in cells(p, q):
            self.grid[cell].append(index)
        pin, qin = inside(p, self.bounds), inside(q, self.bounds)
        if pin != qin:
            fraction = boundary_fraction(p, q, self.bounds) if pin else 1 - boundary_fraction(q, p, self.bounds)
            self.portals.append((index, round(fraction, 7), point(p, q, fraction), pin))

    @lru_cache(maxsize=None)
    def anchors(self, position, line):
        corridor = self.corridors.get(line, {})
        nearby = {i for cell in cells(position, position, 135) for i in self.grid[cell]}
        matches = []
        for i in sorted(nearby):
            a, b, way, length, penalty = self.edges[i]
            p, q = self.xy[a], self.xy[b]
            dx, dz = q[0] - p[0], q[1] - p[1]
            if length < 0.1:
                continue
            rx, rz = position[0] - p[0], position[1] - p[1]
            t = round(max(0, min(1, (rx * dx + rz * dz) / length ** 2)), 7)
            spot = point(p, q, t)
            dist = distance(spot, position)
            if dist > 135 or not inside(spot, self.bounds):
                continue
            lateral = (dx * rz - dz * rx) / length
            side = max(0, -lateral - 2) ** 2 * 0.75 if not self.rail else 0
            score = dist * 3 + max(0, dist - 9) ** 2 * 0.45 + side
            score += (0 if way in corridor else 10 if corridor else 0) + (penalty - 1) * 18
            matches.append((score, i, t, spot, dist, lateral))
        selected = []
        result = []
        for match in sorted(matches):
            _, i, _, spot, _, _ = match
            a, b, way, _, _ = self.edges[i]
            heading = (self.xy[b][0] - self.xy[a][0], self.xy[b][1] - self.xy[a][1])
            if any(way == w and distance(spot, p) < 18 and heading[0] * h[0] + heading[1] * h[1] > 0
                   for w, p, h in selected):
                continue
            selected.append((way, spot, heading))
            result.append((i, match[2], spot, match[0], match[4], match[5]))
            if len(selected) >= 10:
                break
        return tuple(result)

    def portal_anchors(self, outer, inner, outgoing):
        # Čím blíž je průsečík ke směru skutečné první zastávky za mapou, tím nižší penalizace.
        chord = point(inner, outer, boundary_fraction(inner, outer, self.bounds))
        candidates = sorted((distance(chord, p), i, t, p) for i, t, p, out in self.portals if out == outgoing)
        return tuple((i, t, p, d * 0.65, 0, 0) for d, i, t, p in candidates[:8])

    def cost(self, i, corridor):
        _, _, way, length, penalty = self.edges[i]
        return length * penalty * (1 if not corridor or way in corridor else 2.6)

    def allowed(self, previous, following):
        a, node, way, _, _ = self.edges[previous]
        _, b, new_way, _, _ = self.edges[following]
        if b == a:
            return False
        for rule, target in self.turns.get((node, way), ()):
            if rule.endswith("_u_turn") and way == new_way:
                continue
            if rule.startswith("only_") != (new_way in target):
                return False
        return True

    @lru_cache(maxsize=28000)
    def connections(self, source, targets, line):
        """Všechny dosažitelné vstupy na další zastávce, s cenou a cestou."""
        si, st, start = source[:3]
        _, node, _, _, _ = self.edges[si]
        corridor = self.corridors.get(line, {})
        targets_at = defaultdict(list)
        for j, item in enumerate(targets):
            ti, tt, end = item[:3]
            first = self.edges[ti][0]
            targets_at[first].append((j, ti, tt))
        ends = [item[2] for item in targets]
        minx, maxx = min(p[0] for p in ends), max(p[0] for p in ends)
        minz, maxz = min(p[1] for p in ends), max(p[1] for p in ends)
        found = {}
        for j, item in enumerate(targets):
            ti, tt, end = item[:3]
            if si == ti and tt >= st:
                found[j] = ((tt - st) * self.cost(si, corridor), (start, end))

        def heuristic(n):
            x, z = self.xy[n]
            return hypot(max(0, minx - x, x - maxx), max(0, minz - z, z - maxz))

        initial = (1 - st) * self.cost(si, corridor)
        direct = heuristic(node)
        budget = max(950, min(distance(self.xy[node], end) for end in ends) * 7.5 + 420)
        best = {si: initial}
        parents = {}
        queue = [(initial + direct, initial, si)]
        while queue:
            f, cost, i = heappop(queue)
            if cost != best[i]:
                continue
            if f > budget or len(found) == len(targets) and f >= max(result[0] for result in found.values()):
                break
            _, n, _, _, _ = self.edges[i]
            for j, ti, fraction in targets_at.get(n, ()):
                expense = cost + fraction * self.cost(ti, corridor)
                if (j not in found or expense < found[j][0]) and self.allowed(i, ti):
                    points = [targets[j][2]]
                    step = i
                    while True:
                        points.append(self.xy[self.edges[step][1]])
                        if step == si:
                            break
                        step = parents[step]
                    points.append(start)
                    found[j] = (expense, tuple(reversed(points)))
            for nxt in self.out[n]:
                if self.edges[nxt][1] not in self.interior or not self.allowed(i, nxt):
                    continue
                expense = cost + self.cost(nxt, corridor)
                if expense < best.get(nxt, float("inf")):
                    estimate = expense + heuristic(self.edges[nxt][1])
                    if estimate <= budget:
                        best[nxt] = expense
                        parents[nxt] = i
                        heappush(queue, (estimate, expense, nxt))
        return found

    def route(self, line, positions, before=None, after=None):
        anchors = [self.anchors(p, line) for p in positions]
        if before:
            anchors.insert(0, self.portal_anchors(before, positions[0], False))
        if after:
            anchors.append(self.portal_anchors(after, positions[-1], True))
        if any(not a for a in anchors):
            raise ValueError("chybí vhodná hrana u zastávky nebo na hranici mapy")
        best = {i: (a[3], ()) for i, a in enumerate(anchors[0])}
        for k, (origins, targets) in enumerate(zip(anchors, anchors[1:])):
            following = {}
            for i, (score, links) in best.items():
                for j, (cost, path) in self.connections(origins[i], targets, line).items():
                    if k and path == links[-1][0][::-1]:
                        continue
                    total = score + cost + targets[j][3]
                    if j not in following or total < following[j][0]:
                        following[j] = (total, links + ((path, origins[i], targets[j]),))
            if not following:
                raise ValueError(f"nespojeno mezi body {k} a {k + 1}")
            best = following
        _, links = min(best.values(), key=lambda pair: pair[0])
        nodes = []
        offsets = []
        deviations = []
        length = 0
        for k, (path, src, dst) in enumerate(links):
            clean = [p for i, p in enumerate(path) if not i or p != path[i - 1]]
            if len(clean) > 2:
                clean = [clean[i] for i in dp_simplify(clean, 0.23)]
            if not nodes:
                nodes.append(clean[0])
                offsets.append(0)
                deviations.append((src[4], src[5]))
            nodes.extend(clean[1:])
            length += sum(distance(a, b) for a, b in zip(clean, clean[1:]))
            offsets.append(round(length, 2))
            deviations.append((dst[4], dst[5]))
        stop_range = slice(bool(before), len(offsets) - bool(after))
        return nodes, offsets[stop_range], deviations[stop_range]
