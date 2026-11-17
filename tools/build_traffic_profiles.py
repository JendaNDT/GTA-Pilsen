#!/usr/bin/env python3
"""Hodinové profily z historických plzeňských sčítacích smyček."""

import argparse
import csv
import hashlib
import json
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from statistics import median
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
CATALOG = 'https://opendata.plzen.eu/public/opendata/detail/160'
CITY_API = 'https://polivisuapi.plzen.eu/api/roadlinks/traffic_intensity/'
PRAGUE = ZoneInfo('Europe/Prague')
INTERVALS_PER_HOUR = 40

# Ověřené příjezdy křižovatek. Úhel je směr jízdy po mapě od severu po hodinách.
# Z dvojic smyček nad sebou v témže pruhu se počítá jen jedna.
APPROACHES = (
    ('klatovska-jih', 'Klatovská třída', 191, 'centrum', ('FD117_D3', 'FD117_D4')),
    ('klatovska-sever', 'Klatovská třída', 11, 'centrum', ('FD117_D10', 'FD117_D11')),
    ('tylova-vychod', 'Tylova', 98, 'centrum', ('FD141_D5',)),
    ('tylova-zapad', 'Tylova', 278, 'centrum', ('FD141_D1',)),
    ('borska-zapad', 'Borská', 270, 'centrum', ('FD139_D1', 'FD139_D2', 'FD139_D3')),
    ('vejprnicka-do-mesta', 'Vejprnická', 117, 'prijezd', ('FD101_D1', 'FD101_D2', 'FD101_D3')),
    ('domazlicka-do-mesta', 'Domažlická', 58, 'prijezd', ('FD101_D11', 'FD101_D13')),
)


def checksum(path):
    digest = hashlib.sha256()
    with path.open('rb') as src:
        for chunk in iter(lambda: src.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


@lru_cache(maxsize=1024)
def local_hour(utc_hour):
    return datetime.fromisoformat(utc_hour).replace(tzinfo=timezone.utc).astimezone(PRAGUE)


def read_hours(paths, detectors, start, end, excluded):
    intervals = defaultdict(dict)
    diagnostics = defaultdict(lambda: defaultdict(int))
    earliest_utc = (start - timedelta(days=1)).isoformat()
    last_utc = end.isoformat()
    for path in paths:
        with path.open(encoding='utf-8-sig', newline='') as src:
            rows = csv.reader(src)
            header = next(rows)
            id_col, utc_col, count_col = (header.index(name) for name in ('ID_DETEKTOR', 'UTCTIMESTAMP', 'INTENZITA'))
            for row in rows:
                if len(row) <= id_col or row[id_col] not in detectors:
                    continue
                detector = row[id_col]
                try:
                    timestamp = row[utc_col]
                    if not earliest_utc <= timestamp[:10] <= last_utc:
                        continue
                    hour = local_hour(timestamp[:13])
                    day = hour.date()
                    if day < start or day > end or day in excluded:
                        continue
                    minute, second = int(timestamp[14:16]), int(timestamp[17:19])
                    volume = int(row[count_col])
                    if not (0 <= minute < 60 and 0 <= second < 60 and 0 <= volume <= 75):
                        raise ValueError('Měření mimo rozsah')
                except (ValueError, IndexError):
                    diagnostics[detector]['invalid'] += 1
                    continue
                # Rozsah přes změnu času nevytvoří při dvojí 02:00 dvojitou intenzitu.
                if hour.fold:
                    continue
                bucket = intervals[detector, day, hour.hour]
                slot = (minute * 60 + second) // 90
                if slot in bucket:
                    key = 'overlap' if bucket[slot] == volume else 'conflict'
                    diagnostics[detector][key] += 1
                    if key == 'conflict':
                        bucket[slot] = None
                else:
                    bucket[slot] = volume

    hours = {}
    for key, bucket in intervals.items():
        observed = [value for value in bucket.values() if value is not None]
        if len(observed) >= 38:
            hours[key] = round(sum(observed) * INTERVALS_PER_HOUR / len(observed), 2)
    return hours, diagnostics


def build_profiles(locations, hours, start, end):
    result = []
    for name, street, heading, area, detectors in APPROACHES:
        points = [locations[detector] for detector in detectors]
        weeks = {'weekday': [], 'weekend': []}
        for offset in range((end - start).days + 1):
            day = start + timedelta(days=offset)
            lanes = [[hours.get((detector, day, h)) for h in range(24)] for detector in detectors]
            if any(None in lane or not sum(lane) for lane in lanes):
                continue
            weeks['weekday' if day.weekday() < 5 else 'weekend'].append((day, list(map(sum, zip(*lanes)))))
        summary = summarize_days(weeks, 4, 2)
        if not summary:
            raise ValueError(f'{name}: nedostatek celých dnů pro pracovní a víkendový profil')
        result.append({
            'id': name, 'street': street, 'heading': heading, 'area': area,
            'lat': round(sum(p[0] for p in points) / len(points), 7),
            'lon': round(sum(p[1] for p in points) / len(points), 7),
            'detectors': detectors,
            **summary,
        })
    return result


def summarize_days(weeks, weekdays, weekends):
    typical_days = {}
    for kind, minimum in [('weekday', weekdays), ('weekend', weekends)]:
        rows = weeks[kind]
        if len(rows) < minimum:
            return None
        typical = median(sum(row) for _, row in rows)
        typical_days[kind] = [(day, row) for day, row in rows if 0.45 * typical <= sum(row) <= 1.8 * typical]
        if len(typical_days[kind]) < minimum:
            return None
    return {
        'days': {kind: [day.isoformat() for day, _ in days] for kind, days in typical_days.items()},
        **{kind: [round(median(h) * 2) / 2 for h in zip(*(row for _, row in days))]
           for kind, days in typical_days.items()},
    }


def build_city_profiles(point_file, weeks, excluded):
    points = {}
    for feature in geojson_features(point_file):
        point, data = feature['geometry'], feature['properties']
        angle = data.get('angle')
        if point and point['type'] == 'Point' and isinstance(angle, (int, float)) and 0 <= angle <= 360:
            # Městský úhel roste proti směru hodinových ručiček od severu.
            points[data['id']] = (point['coordinates'], (360 - angle) % 360)

    lines = {}
    observations = defaultdict(dict)
    rejected = Counter()
    changed = set()
    for path in weeks:
        for feature in geojson_features(path):
            geometry, data = feature['geometry'], feature['properties']
            key = data['id']
            if not geometry or geometry['type'] != 'LineString' or len(geometry['coordinates']) < 2:
                continue
            line = geometry['coordinates']
            if key in lines and lines[key] != line:
                changed.add(key)
            lines[key] = line
            for row in data['values']:
                try:
                    stamp = row['timestamp']
                    if stamp[13:] != ':00:00':
                        continue
                    count, flow = int(row['obs_count']), int(row['flow'])
                    day = local_hour(stamp[:13])
                    if count <= 0 or flow < 0 or day.fold or day.date() in excluded:
                        continue
                except (TypeError, ValueError):
                    continue
                key_hour = (day.date(), day.hour)
                value = (count, flow)
                rows = observations[key]
                rows[key_hour] = value if rows.get(key_hour, value) == value else None

    profiles = []
    for key, line in sorted(lines.items()):
        if key in changed or key not in points:
            rejected['geometry'] += 1
            continue
        rows = observations[key]
        counts = Counter(count for count, _ in (row for row in rows.values() if row))
        if not counts:
            rejected['coverage'] += 1
            continue
        # Čtyřicet devadesátisekundových intervalů na pruh a hodinu.
        nominal = max(INTERVALS_PER_HOUR, round(counts.most_common(1)[0][0] / INTERVALS_PER_HOUR) * INTERVALS_PER_HOUR)
        day_types = {'weekday': [], 'weekend': []}
        for day in sorted({day for day, _ in rows}):
            measures = [rows.get((day, h)) for h in range(24)]
            if any(not value or not 0.95 * nominal <= value[0] <= nominal for value in measures):
                continue
            volumes = [flow for _, flow in measures]
            if sum(volumes):
                day_types['weekday' if day.weekday() < 5 else 'weekend'].append((day, volumes))
        summary = summarize_days(day_types, 6, 3)
        if not summary:
            rejected['coverage'] += 1
            continue
        point, heading = points[key]
        profiles.append({'id': key, 'point': round_gps(point), 'heading': heading,
                         'line': [round_gps(coord) for coord in line], **summary})
    if not profiles:
        raise ValueError('Městský export neobsahuje profily s dostatečným pokrytím')
    return {'api': CITY_API, 'sourceProfiles': len(lines), 'rejected': dict(sorted(rejected.items())),
            'inputs': [source_input(path) for path in [point_file, *weeks]], 'profiles': profiles}


def geojson_features(path):
    return json.loads(path.read_text(encoding='utf-8'))['features']


def round_gps(coordinates):
    return [round(float(coord), 7) for coord in coordinates[:2]]


def source_input(path):
    return {'file': path.name, 'sha256': checksum(path)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('locations', type=Path, help='popis polohy smyček z městského CSV')
    parser.add_argument('measurements', type=Path, nargs='+', help='archivované CSV s počty vozidel')
    parser.add_argument('--start', type=date.fromisoformat, required=True)
    parser.add_argument('--end', type=date.fromisoformat, required=True)
    parser.add_argument('--exclude', type=date.fromisoformat, action='append', default=[], help='výluka nebo svátek')
    parser.add_argument('--city-points', type=Path, help='bodový GeoJSON městských profilů s úhlem')
    parser.add_argument('--city-week', type=Path, action='append', default=[], help='liniový GeoJSON s hodinovými měřeními')
    parser.add_argument('--output', type=Path, default=ROOT / 'public/data/traffic-profiles.json')
    args = parser.parse_args()
    if args.start > args.end:
        parser.error('--start musí předcházet --end')
    if bool(args.city_points) != bool(args.city_week):
        parser.error('Městské profily potřebují --city-points i nejméně jeden --city-week')
    detectors = {detector for _, _, _, _, ids in APPROACHES for detector in ids}
    with args.locations.open(encoding='utf-8-sig', newline='') as src:
        locations = {row['ID_detektor']: (float(row['lat']), float(row['lon'])) for row in csv.DictReader(src)}
    hours, diagnostics = read_hours(args.measurements, detectors, args.start, args.end, set(args.exclude))
    profiles = build_profiles(locations, hours, args.start, args.end)
    data = {
        'version': 1, 'provider': 'Město Plzeň / SITMP', 'catalog': CATALOG, 'zone': str(PRAGUE),
        'start': args.start.isoformat(), 'end': args.end.isoformat(),
        'excluded': sorted({day.isoformat() for day in args.exclude}),
        'inputs': [source_input(path) for path in [args.locations, *args.measurements]],
        'profiles': profiles,
    }
    if args.city_points:
        city = build_city_profiles(args.city_points, args.city_week, set(args.exclude))
        data['city'] = city
        print(f"Městské profily {len(city['profiles'])} z {city['sourceProfiles']}", city['rejected'])
    args.output.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    for profile in profiles:
        print(profile['id'], {kind: len(days) for kind, days in profile['days'].items()},
              '7, 12, 16, 21 h', [[profile[kind][h] for h in (7, 12, 16, 21)] for kind in profile['days']])
    print(json.dumps(diagnostics, sort_keys=True))


if __name__ == '__main__':
    main()
