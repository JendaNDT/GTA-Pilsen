#!/usr/bin/env python3
"""Zabalí síť PMDP z archivního GTFS a jízdní dráhy z mapového výřezu OSM."""
import argparse
from collections import Counter, defaultdict
from hashlib import sha256
import json
from pathlib import Path
import pickle
from tempfile import TemporaryDirectory
from zipfile import ZipFile

from build_timetable import SOURCE, calendar, rows, seconds
from coordinates import to_xz
from transit_paths import Network, distance, inside

KINDS = {"0": "tram", "3": "bus", "11": "trolleybus"}


def spans(stops, bounds):
    """Souvislé úseky stanovišť uvnitř mapy, se zastávkou za každým otevřeným koncem."""
    start = 0
    while start < len(stops):
        if not inside(stops[start], bounds):
            start += 1
            continue
        end = start + 1
        while end < len(stops) and inside(stops[end], bounds):
            end += 1
        yield start, end
        start = end


def read_feed(archive):
    routes = {r["route_id"]: r for r in rows(archive, "routes") if r["route_type"] in KINDS}
    stops = {}
    for stop in rows(archive, "stops"):
        x, z = to_xz(float(stop["stop_lat"]), float(stop["stop_lon"]))
        stops[stop["stop_id"]] = (stop["stop_name"], round(x, 1), round(z, 1), stop["stop_code"])
    trips = {r["trip_id"]: r for r in rows(archive, "trips") if r["route_id"] in routes}
    times = defaultdict(list)
    for row in rows(archive, "stop_times"):
        if row["trip_id"] not in trips:
            continue
        pickup = int(row["pickup_type"] or 0)
        dropoff = int(row["drop_off_type"] or 0)
        # 3 znamená zastávku po dohodě s řidičem. Ve hře ji obsloužíme vždy.
        times[row["trip_id"]].append((int(row["stop_sequence"]), row["stop_id"], seconds(row["arrival_time"]),
                                      seconds(row["departure_time"]), pickup not in (1, 2), dropoff not in (1, 2)))
    groups = defaultdict(list)
    for trip_id, trip in trips.items():
        ordered = sorted(times[trip_id])
        group = tuple(row[1] for row in ordered)
        groups[(trip["route_id"], trip["direction_id"], trip.get("trip_headsign") or stops[group[-1]][0], group)].append(
            (trip_id, trip["service_id"], ordered))
    return routes, stops, groups


def build(source, extract, bounds):
    with ZipFile(source) as archive:
        routes, points, groups = read_feed(archive)
        weekly = list(rows(archive, "calendar"))
        exceptions = list(rows(archive, "calendar_dates"))
        transfers = list(rows(archive, "transfers")) if "transfers.txt" in archive.namelist() else []
    rail = Network(extract, bounds, rail=True)
    road = Network(extract, bounds)
    result_routes, result_stops, patterns, result_trips = [], [], [], []
    service_ids, stop_ids = {}, {}
    lines = defaultdict(lambda: {"feedTrips": 0, "importedTrips": 0, "patterns": 0, "osmCorridor": False})
    failures, boundaries, deviations, long_legs = [], [], [], []
    for (route_id, direction, destination, group), trips in groups.items():
        route = routes[route_id]
        kind, ref = KINDS[route["route_type"]], route["route_short_name"]
        line = (kind, ref)
        line_stats = lines[line]
        line_stats["feedTrips"] += len(trips)
        network = rail if kind == "tram" else road
        # OSM vede N7 jako autobusovou relaci, vozidlo ve hře určuje typ z PMDP.
        corridor = line if line in network.corridors else ("bus", ref) if kind == "trolleybus" else line
        line_stats["osmCorridor"] = bool(network.corridors.get(corridor))
        positions = [points[identifier][1:3] for identifier in group]
        sections = list(spans(positions, network.bounds))
        if not sections:
            failures.append({"line": ref, "trip": trips[0][0], "cause": "mimo herní oblast"})
        handled = 0
        for start, end in sections:
            before = positions[start - 1] if start else None
            after = positions[end] if end < len(positions) else None
            try:
                path, offsets, deltas = network.route(corridor, positions[start:end], before, after)
                if len(path) < 2 or len(offsets) != end - start:
                    raise ValueError("nulová délka jízdní dráhy")
            except ValueError as error:
                failures.append({"line": ref, "trip": trips[0][0], "stops": [points[i][0] for i in group[start:end]],
                                 "cause": str(error)})
                continue
            handled += 1
            line_stats["patterns"] += 1
            route_index = len(result_routes)
            mapped = []
            names = []
            for index, identifier in enumerate(group[start:end]):
                name, x, z, code = points[identifier]
                if identifier not in stop_ids:
                    stop_ids[identifier] = len(result_stops)
                    result_stops.append([name, x, z, code])
                mapped.append([stop_ids[identifier], index])
                names.append([offsets[index], name])
                gap, side = deltas[index]
                if gap > 20 or kind != "tram" and side < -7:
                    deviations.append([ref, trips[0][0], name, code, round(gap, 1), round(side, 1)])
                if index:
                    direct = distance(positions[start + index - 1], positions[start + index])
                    length = offsets[index] - offsets[index - 1]
                    if length > 330 and length > direct * 2.4:
                        long_legs.append((ref, names[-2][1], name, round(direct), round(length)))
            length = sum(distance(a, b) for a, b in zip(path, path[1:]))
            result_routes.append({"type": kind, "ref": ref, "from": names[0][1], "to": names[-1][1], "length": round(length, 2),
                                  "path": [[round(x, 2), round(z, 2)] for x, z in path], "stops": names})
            pi = len(patterns)
            patterns.append([route_index, mapped, destination, direction, bool(before), bool(after)])
            if before or after:
                boundaries.append({"line": ref, "direction": direction, "trip": trips[0][0], "destination": destination,
                                   "first": names[0][1], "last": names[-1][1], "enter": path[0] if before else None,
                                   "exit": path[-1] if after else None, "trips": len(trips)})
            for trip_id, service, times in trips:
                si = service_ids.setdefault(service, len(service_ids))
                values = []
                for _, _, arrival, departure, pickup, dropoff in times[start:end]:
                    values.extend((arrival if dropoff or after and len(values) == (end - start - 1) * 2 else -arrival - 1,
                                   departure if pickup else -departure - 1))
                identifier = trip_id if len(sections) == 1 else f"{trip_id}/{handled}"
                result_trips.append([identifier, si, pi, values])
        if sections and handled == len(sections):
            line_stats["importedTrips"] += len(trips)

    report = {"gtfsTrips": sum(map(len, groups.values())), "gtfsPatterns": len(groups),
              "lines": {f"{kind} {ref}": stats for (kind, ref), stats in sorted(lines.items())},
              "boundary": boundaries, "unresolved": failures, "platformDeviations": sorted(deviations),
              "longLegs": sorted(set(long_legs))}
    if failures:
        return None, report
    result = {
        "version": 2, "source": {"url": SOURCE, "sha256": sha256(source.read_bytes()).hexdigest(),
                                 "osm": extract["osmTimestamp"], "osmSha256": extract["source"]["sha256"]},
        "calendar": calendar(weekly, exceptions, service_ids),
        "routes": result_routes, "stops": result_stops, "patterns": patterns, "trips": result_trips,
        "transfers": [[stop_ids[t["from_stop_id"]], stop_ids[t["to_stop_id"]], int(t["min_transfer_time"] or 0)]
                      for t in transfers if t["transfer_type"] in ("0", "1", "2")
                      and t["from_stop_id"] in stop_ids and t["to_stop_id"] in stop_ids],
    }
    return result, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--osm", type=Path, default=Path("data-raw/extract.pkl"))
    parser.add_argument("--map", type=Path, default=Path("public/data/meta.json"))
    parser.add_argument("--output", type=Path, default=Path("public/data/timetable.json"))
    parser.add_argument("--report", type=Path, default=Path("data-raw/e08/pokryti.json"))
    args = parser.parse_args()
    with args.osm.open("rb") as file:
        extract = pickle.load(file)
    meta = json.loads(args.map.read_text(encoding="utf-8"))
    if meta["osmTimestamp"] != extract["osmTimestamp"]:
        parser.error("Datum výřezu OSM neodpovídá mapě.")
    result, report = build(args.archive, extract, meta["bounds"])
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if result is None:
        parser.error(f"Nezpracované varianty: {len(report['unresolved'])}. Viz {args.report}.")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=args.output.parent) as directory:
        output = Path(directory) / args.output.name
        output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        output.replace(args.output)
    counts = Counter(r["type"] for r in result["routes"])
    print(f"{len(result['trips'])} spojů, {len(result['stops'])} nástupišť, varianty {dict(counts)}")
    print(f"{len(report['lines'])} linek, {len(report['boundary'])} hraniční varianty, protokol {args.report}")


if __name__ == "__main__":
    main()
