#!/usr/bin/env python3
"""Stáhne výškopis ČÚZK (DMP 1G = povrch včetně budov, DMR 5G = holý terén)
pro oblast Plzně a uloží jej jako pole numpy do data-raw/.

Rozdíl DMP − DMR dává skutečnou výšku budov a stromů.
Vyžaduje: pip install numpy tifffile
"""
import io
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone

import numpy as np
import tifffile

from area import BBOX, DEM_COLS, DEM_ROWS, DEM_TILES
from map_sources import DEM_EXPORT_URL, DEM_SERVICES, dump_dem, load_dem

# Server vrací čtvercové pixely ve stupních a výřez si jinak sám upraví, proto musí poměr
# stran obrázku přesně odpovídat poměru stran výřezu ve stupních (viz area.py).
W, H = DEM_COLS, DEM_ROWS
COLS, ROWS = DEM_TILES
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data-raw")


def get(url):
    last = None
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "plzen-game-data/0.1"})
            with urllib.request.urlopen(req, timeout=300) as r:
                return tifffile.imread(io.BytesIO(r.read()))
        except Exception as e:  # noqa: BLE001
            last = e
            print("  opakuji:", e, flush=True)
            time.sleep(4 * (attempt + 1))
    raise SystemExit(f"Stažení selhalo: {last}")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    s, w, n, e = BBOX
    tw, th = W // COLS, H // ROWS
    if tw * COLS != W or th * ROWS != H:
        raise ValueError("Rozměry rastru musí být dělitelné počtem dlaždic.")
    for name, svc in DEM_SERVICES.items():
        path = os.path.join(OUT_DIR, name + ".npy")
        if os.path.exists(path) and "--force" not in sys.argv:
            try:
                load_dem(path, read_array=False)
            except ValueError as error:
                print(error, flush=True)
            else:
                print(name, "už staženo a ověřeno", flush=True)
                continue
        full = np.zeros((H, W), dtype=np.float32)
        for r in range(ROWS):
            for c in range(COLS):
                tn = n - (n - s) * r / ROWS
                ts = n - (n - s) * (r + 1) / ROWS
                tw_ = w + (e - w) * c / COLS
                te = w + (e - w) * (c + 1) / COLS
                a = get(DEM_EXPORT_URL.format(svc=svc, w=tw_, s=ts, e=te, n=tn, pw=tw, ph=th))
                if a.shape != (th, tw) or a.dtype != np.float32:
                    raise ValueError(f"{name} dlaždice {r},{c}: neočekávaný formát {a.shape}, {a.dtype}.")
                full[r * th:(r + 1) * th, c * tw:(c + 1) * tw] = a
                print(f"{name} dlaždice {r},{c}: {a.shape} min {a.min():.1f} max {a.max():.1f}", flush=True)
        dump_dem(path, full, datetime.now(timezone.utc).isoformat(timespec="seconds"))
        print(name, "uloženo", full.shape)


if __name__ == "__main__":
    main()
