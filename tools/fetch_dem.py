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

import numpy as np
import tifffile

# musí odpovídat BBOX ve fetch_osm.py (jih, západ, sever, východ)
BBOX = (49.700, 13.300, 49.800, 13.450)
# Server vrací čtvercové pixely ve stupních a výřez si jinak sám upraví,
# proto musí poměr stran obrázku přesně odpovídat poměru stran výřezu ve
# stupních (0,15° : 0,10° = 3 : 2). Vychází ~1,3 m na pixel v ose x a 2 m v ose z.
W, H = 8340, 5560
COLS, ROWS = 2, 4            # dlaždice (limit serveru 15000 x 4100 px)
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data-raw")
URL = ("https://ags.cuzk.cz/arcgis2/rest/services/{svc}/ImageServer/exportImage"
       "?bbox={w},{s},{e},{n}&bboxSR=4326&imageSR=4326&size={pw},{ph}"
       "&format=tiff&pixelType=F32&noData=-9999"
       "&interpolation=RSP_BilinearInterpolation&f=image")


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
    s, w, n, e = BBOX
    tw, th = W // COLS, H // ROWS
    for svc, name in (("dmp1g", "dmp"), ("dmr5g", "dmr")):
        path = os.path.join(OUT_DIR, name + ".npy")
        if os.path.exists(path) and "--force" not in sys.argv:
            print(name, "už staženo")
            continue
        full = np.zeros((H, W), dtype=np.float32)
        for r in range(ROWS):
            for c in range(COLS):
                tn = n - (n - s) * r / ROWS
                ts = n - (n - s) * (r + 1) / ROWS
                tw_ = w + (e - w) * c / COLS
                te = w + (e - w) * (c + 1) / COLS
                a = get(URL.format(svc=svc, w=tw_, s=ts, e=te, n=tn, pw=tw, ph=th))
                full[r * th:(r + 1) * th, c * tw:(c + 1) * tw] = a
                print(f"{name} dlaždice {r},{c}: {a.shape} min {a.min():.1f} max {a.max():.1f}", flush=True)
        np.save(path, full)
        print(name, "uloženo", full.shape)


if __name__ == "__main__":
    main()
