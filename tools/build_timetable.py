#!/usr/bin/env python3
"""Obnoví historický balík E06. Pro aktuální hru slouží build_transit_network.py."""
import argparse
from collections import Counter, defaultdict
import csv
from datetime import date, timedelta
from hashlib import sha256
import io
import json
from math import hypot
from pathlib import Path
import re
import unicodedata
from zipfile import ZipFile

from coordinates import to_xz

SOURCE = "https://jizdnirady.pmdp.cz/jr/gtfs"
NAMES = {"0": "tram", "11": "trolleybus"}
WEEKDAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")


def rows(archive, name):
    with archive.open(name + ".txt") as raw:
        yield from csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig", newline=""))


def seconds(value):
    hour, minute, second = map(int, value.split(":"))
    return hour * 3600 + minute * 60 + second


def normalized(name):
    text = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", text.lower())


def route_key(route):
    return [route[k] for k in ("type", "ref", "from", "to", "length")]


def route_stops(route):
    positions = [0.0]
    path = route["path"]
    for (a, b), (x, z) in zip(path, path[1:]):
        positions.append(positions[-1] + hypot(x - a, z - b))
    index = 0
    result = []
    for s, name in route["stops"]:
        while index + 2 < len(path) and s > positions[index + 1]:
            index += 1
        a, b = path[index]
        x, z = path[index + 1]
        t = min(1, max(0, (s - positions[index]) / max(0.001, positions[index + 1] - positions[index])))
        result.append((normalized(name), a + (x - a) * t, b + (z - b) * t))
    return result


def align_line(gtfs_stops, game_stops):
    """Najde nejdelší souhlasné pořadí zastávek a upřednostní název a bližší nástupiště."""
    n = len(game_stops)
    best = [(0, 0, ())] * (n + 1)
    for idx, (name, x, z) in enumerate(gtfs_stops):
        row = [best[0]]
        for j, (other, a, b) in enumerate(game_stops):
            options = [row[-1], best[j + 1]]
            distance = hypot(x - a, z - b)
            same = bool(name and name == other)
            if distance <= (155 if same else 52):
                count, cost, links = best[j]
                options.append((count + 1, cost - distance - (0 if same else 90), links + ((idx, j),)))
            row.append(max(options, key=lambda entry: entry[:2]))
        best = row
    return best[-1]


def select_route(group, candidates, points):
    gtfs_stops = [points[i][:3] for i in group]
    winner = None
    score = ()
    for idx, stops in candidates:
        count, cost, links = align_line(gtfs_stops, stops)
        if count < max(3, (len(group) * 77 + 99) // 100) or links[0][0] > 1 or links[-1][0] < len(group) - 2:
            continue
        quality = (count, cost)
        if quality > score:
            score = quality
            winner = (idx, links)
    return winner


def calendar(weekly, exceptions, service_ids):
    dates = [(date.fromisoformat(r["start_date"]), date.fromisoformat(r["end_date"]), r)
             for r in weekly]
    days = [date.fromisoformat(row["date"]) for row in exceptions]
    start = min([a for a, _, _ in dates] + days)
    end = max([b for _, b, _ in dates] + days)
    overrides = defaultdict(list)
    for row in exceptions:
        service = service_ids.get(row["service_id"])
        if service is not None:
            overrides[date.fromisoformat(row["date"])].append((service, row["exception_type"] == "1"))
    profiles = []
    profile_ids = {}
    daily = []
    occurrences = [Counter() for _ in WEEKDAYS]
    for offset in range((end - start).days + 1):
        current = start + timedelta(days=offset)
        weekday = current.weekday()
        active = {service_ids[row["service_id"]] for a, b, row in dates
                  if a <= current <= b and row[WEEKDAYS[weekday]] == "1" and row["service_id"] in service_ids}
        for service, add in overrides[current]:
            if add:
                active.add(service)
            else:
                active.discard(service)
        key = tuple(sorted(active))
        if key not in profile_ids:
            profile_ids[key] = len(profiles)
            profiles.append(key)
        profile = profile_ids[key]
        daily.append(profile)
        if key:
            occurrences[weekday][profile] += 1
    if () not in profile_ids:
        profile_ids[()] = len(profiles)
        profiles.append(())
    fallback = [counts.most_common(1)[0][0] if counts else profile_ids[()] for counts in occurrences]
    first = next(i for i, p in enumerate(daily) if profiles[p])
    last = max(i for i, p in enumerate(daily) if profiles[p])
    monday = next(start + timedelta(days=i) for i in range(first, last + 1)
                  if (start.weekday() + i) % 7 == 0 and profiles[daily[i]])
    return {"start": str(start + timedelta(days=first)), "end": str(start + timedelta(days=last)),
            "publishedEnd": str(end), "monday": str(monday), "days": daily[first:last + 1],
            "profiles": profiles, "weekly": fallback}


def build(source, meta):
    routes = meta["transit"]
    candidates = defaultdict(list)
    for idx, route in enumerate(routes):
        if not route.get("gaps", 0) and len(route["path"]) >= 10 and route["length"] >= 1500:
            candidates[(route["type"], route["ref"])].append((idx, route_stops(route)))
    with ZipFile(source) as archive:
        routes_gtfs = {r["route_id"]: (NAMES.get(r["route_type"]), r["route_short_name"])
                       for r in rows(archive, "routes")}
        points = {}
        for row in rows(archive, "stops"):
            x, z = to_xz(float(row["stop_lat"]), float(row["stop_lon"]))
            label = row["stop_name"]
            points[row["stop_id"]] = (normalized(label), round(x, 1), round(z, 1), label)
        trips_gtfs = {r["trip_id"]: (routes_gtfs[r["route_id"]], r["service_id"])
                      for r in rows(archive, "trips") if routes_gtfs[r["route_id"]] in candidates}
        times = defaultdict(list)
        for row in rows(archive, "stop_times"):
            if row["trip_id"] not in trips_gtfs:
                continue
            times[row["trip_id"]].append((int(row["stop_sequence"]), row["stop_id"], seconds(row["arrival_time"]),
                                         seconds(row["departure_time"]), int(row["pickup_type"] or 0) != 1))
        weekly = list(rows(archive, "calendar"))
        exceptions = list(rows(archive, "calendar_dates"))

    stop_ids, pattern_ids, service_ids = {}, {}, {}
    stops, patterns, trips = [], [], []
    unresolved = Counter()
    for trip_id, (line, service) in trips_gtfs.items():
        ordered = sorted(times[trip_id])
        group = tuple(item[1] for item in ordered)
        key = (line, group)
        if key not in pattern_ids:
            variant = select_route(group, candidates[line], points)
            pattern_ids[key] = None
            if variant:
                ri, links = variant
                destinations = []
                for i, j in links:
                    identifier = group[i]
                    if identifier not in stop_ids:
                        stop_ids[identifier] = len(stops)
                        _, x, z, label = points[identifier]
                        stops.append([label, x, z])
                    destinations.append([stop_ids[identifier], j])
                pattern_ids[key] = (len(patterns), links)
                patterns.append([ri, destinations, points[group[-1]][3]])
        mapped = pattern_ids[key]
        if mapped is None:
            unresolved[line[1]] += 1
            continue
        pi, links = mapped
        si = service_ids.setdefault(service, len(service_ids))
        values = []
        for i, _ in links:
            _, _, arrival, departure, pickup = ordered[i]
            values.extend((arrival, departure if pickup else -departure - 1))
        trips.append([trip_id, si, pi, values])

    if not trips:
        raise ValueError("Žádný spoj neodpovídá stávajícím trasám hry")
    result = {
        "version": 1, "source": {"url": SOURCE, "sha256": sha256(source.read_bytes()).hexdigest()},
        "calendar": calendar(weekly, exceptions, service_ids),
        "routes": [route_key(r) for r in routes],
        "stops": stops, "patterns": patterns, "trips": trips,
        "unmatched": dict(unresolved),
    }
    mapped_indices = {p[0] for p in patterns}
    print(f"{len(trips)} spojů, {len(patterns)} variant, {len(stops)} nástupišť, {len(mapped_indices)} herních tras")
    print("Bez přiřazené trasy:", sorted(unresolved.items()))
    print("Herní trasy bez spojů:", [route_key(r) for i, r in enumerate(routes)
                                    if i not in mapped_indices and (r["type"], r["ref"]) in candidates])
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--map", type=Path, default=Path("public/data/meta.json"))
    parser.add_argument("--output", type=Path, default=Path("data-raw/e06/timetable.json"))
    args = parser.parse_args()
    result = build(args.archive, json.loads(args.map.read_text(encoding="utf-8")))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
