#!/usr/bin/env python3
"""Vybere z PBF výřezu jen oblast Plzně a uloží ji do data-raw/extract.pkl.

Vyžaduje: pip install osmium
"""
import os
import pickle
import sys
import time
from tempfile import TemporaryDirectory

import osmium

from area import BBOX, OSM_BBOX
from map_sources import sha256
from osm_source import OSM_URL, read_pbf_timestamp

RAW = os.path.join(os.path.dirname(__file__), "..", "data-raw")
S, W, N, E = OSM_BBOX


class Handler(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.nodes = {}      # id -> (lat, lon, tags) jen uzly s tagy
        self.ways = {}       # id -> (tags, [node ids], [(lat, lon)])
        self.rels = {}       # id -> (tags, [(type, ref, role)])

    def node(self, n):
        if not n.tags:
            return
        loc = n.location
        if not loc.valid():
            return
        if S <= loc.lat <= N and W <= loc.lon <= E:
            self.nodes[n.id] = (loc.lat, loc.lon, {t.k: t.v for t in n.tags})

    def way(self, w):
        pts = []
        ids = []
        inside = False
        for nd in w.nodes:
            if not nd.location.valid():
                continue
            la, lo = nd.location.lat, nd.location.lon
            if S <= la <= N and W <= lo <= E:
                inside = True
            pts.append((la, lo))
            ids.append(nd.ref)
        if inside and len(pts) >= 2:
            self.ways[w.id] = ({t.k: t.v for t in w.tags}, ids, pts)

    def relation(self, r):
        tags = {t.k: t.v for t in r.tags}
        typ = tags.get("type")
        if typ not in ("multipolygon", "route", "boundary", "building", "route_master"):
            return
        self.rels[r.id] = (tags, [(m.type, m.ref, m.role) for m in r.members])


def main():
    src = os.path.join(RAW, "plzensky-latest.osm.pbf")
    before = os.stat(src)
    timestamp = read_pbf_timestamp(src)
    with open(src, "rb") as source:
        checksum = sha256(source)
    t = time.time()
    h = Handler()
    h.apply_file(src, locations=True)
    after = os.stat(src)
    if (not os.path.samestat(before, after) or before.st_mtime_ns != after.st_mtime_ns
            or before.st_size != after.st_size):
        raise ValueError("Zdrojové PBF se při čtení změnilo; spusťte výřez znovu.")
    # ponech jen relace, které mají aspoň jednoho člena v oblasti
    keep = {}
    for rid, (tags, members) in h.rels.items():
        if any((m[0] == "w" and m[1] in h.ways) or (m[0] == "n" and m[1] in h.nodes) for m in members):
            keep[rid] = (tags, members)
    out = {
        "bbox": BBOX, "osmTimestamp": timestamp,
        "source": {"url": OSM_URL, "sha256": checksum, "extractBbox": OSM_BBOX},
        "nodes": h.nodes, "ways": h.ways, "rels": keep,
    }
    with TemporaryDirectory(dir=RAW) as directory:
        path = os.path.join(directory, "extract.pkl")
        with open(path, "wb") as f:
            pickle.dump(out, f, protocol=pickle.HIGHEST_PROTOCOL)
        os.replace(path, os.path.join(RAW, "extract.pkl"))
    print(f"uzly s tagy: {len(h.nodes)}, cesty: {len(h.ways)}, relace: {len(keep)}, {time.time() - t:.0f} s")


if __name__ == "__main__":
    sys.exit(main())
