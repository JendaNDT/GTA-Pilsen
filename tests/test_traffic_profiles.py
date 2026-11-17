import json
import sys
import unittest
from datetime import date, datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from build_traffic_profiles import build_city_profiles, read_hours


class TrafficProfileTests(unittest.TestCase):
    def test_city_geometries_use_hourly_observations_and_filter_incomplete_profiles(self):
        start = datetime(2026, 11, 1, 23)
        point = {'type': 'Point', 'coordinates': ['13.37', '49.74']}
        line = {'type': 'LineString', 'coordinates': [[13.37, 49.74], [13.38, 49.74]]}
        values = [{'timestamp': (start + timedelta(hours=h)).isoformat(),
                   'flow': '60' if h % 24 == 7 else '10', 'obs_count': '40'} for h in range(14 * 24)]
        invalid = [{**row, 'obs_count': '28'} for row in values]
        with TemporaryDirectory() as folder:
            points, week = (Path(folder) / name for name in ('points.geojson', 'week.geojson'))
            points.write_text(json.dumps({'features': [{'geometry': point, 'properties': {'id': key, 'angle': 90}}
                                                       for key in (1, 2)]}))
            week.write_text(json.dumps({'features': [{'geometry': line, 'properties': {'id': key, 'values': rows}}
                                                     for key, rows in ((1, values), (2, invalid))]}))
            data = build_city_profiles(points, [week], {date(2026, 11, 2)})
        self.assertEqual(data['sourceProfiles'], 2)
        self.assertEqual(data['rejected'], {'coverage': 1})
        record, = data['profiles']
        self.assertEqual(record['point'], [13.37, 49.74])
        self.assertEqual(record['heading'], 270)
        self.assertEqual(record['weekday'][7], 60)
        self.assertEqual(record['days']['weekday'][0], '2026-11-03')

    def test_overlapping_exports_use_utc_and_dedupe_measurements(self):
        local_day = date(2026, 11, 5)
        start = datetime(2026, 11, 4, 23, 0, 1)
        header = 'ID_DETEKTOR,UTCTIMESTAMP,INTENZITA,TIMESTAMP\n'
        rows = [f'A,{start + timedelta(seconds=i * 90)},2,00:00\n' for i in range(40)]
        with TemporaryDirectory() as folder:
            source, overlap = (Path(folder) / name for name in ('source.csv', 'overlap.csv'))
            source.write_text(header + ''.join(rows), encoding='utf-8')
            overlap.write_text(header + rows[0] + f'A,{start + timedelta(seconds=90)},8,00:00\n', encoding='utf-8')
            hours, quality = read_hours([source, overlap], {'A'}, local_day, local_day, set())
        self.assertEqual(hours, {('A', local_day, 0): 80})
        self.assertEqual(quality['A'], {'overlap': 1, 'conflict': 1})

    def test_partial_hour_and_excluded_day_do_not_create_traffic_counts(self):
        day = date(2026, 11, 5)
        start = datetime(2026, 11, 5, 12, 0, 1)
        with TemporaryDirectory() as folder:
            source = Path(folder) / 'partial.csv'
            rows = [f'A,{start + timedelta(seconds=i * 90)},2\n' for i in range(37)]
            source.write_text('ID_DETEKTOR,UTCTIMESTAMP,INTENZITA\n' + ''.join(rows), encoding='utf-8')
            hours, _ = read_hours([source], {'A'}, day, day, set())
            self.assertEqual(hours, {})
            with source.open('a', encoding='utf-8') as output:
                output.write(f'A,{start + timedelta(seconds=37 * 90)},2\n')
            self.assertEqual(read_hours([source], {'A'}, day, day, set())[0], {('A', day, 13): 80})
            self.assertEqual(read_hours([source], {'A'}, day, day, {day})[0], {})
