"""Terén pro hru: výšková síť z DMR 5G (ČÚZK), zarovnaná pod silnicemi a na vodních plochách,
a výšky mostovek.

Výstupem je síť výšek po G metrech (v metrech nad základní výškou BASE = výška náměstí Republiky).
"""
import math
import os
import struct
from collections import defaultdict

import numpy as np

G = 8.0          # rozteč sítě v metrech
CHUNK = 256      # velikost herní dlaždice (síť je na ni zarovnaná)
Q = 0.1          # krok uložené výšky v metrech (jemnější krok jen zvětšuje soubor)


def box_mean(a, ry, rx):
    """Průměr v okně (2ry+1) × (2rx+1) přes integrální obraz."""
    p = np.pad(a.astype(np.float64), ((ry + 1, ry), (rx + 1, rx)), mode="edge")
    c = p.cumsum(0).cumsum(1)
    del p
    h, w = a.shape
    ky, kx = 2 * ry + 1, 2 * rx + 1
    s = c[ky:ky + h, kx:kx + w] - c[:h, kx:kx + w] - c[ky:ky + h, :w] + c[:h, :w]
    return (s / (ky * kx)).astype(np.float32)


def densify(pts, step=2.5):
    """Zahustí lomenou čáru; vrací pole bodů (n, 2) a index původního bodu u každého zahuštěného (nebo -1)."""
    out = [pts[0]]
    src = [0]
    for k in range(1, len(pts)):
        (x1, z1), (x2, z2) = pts[k - 1], pts[k]
        ln = math.hypot(x2 - x1, z2 - z1)
        n = max(1, int(math.ceil(ln / step)))
        for s in range(1, n + 1):
            t = s / n
            out.append((x1 + (x2 - x1) * t, z1 + (z2 - z1) * t))
            src.append(k if s == n else -1)
    return np.array(out, dtype=np.float64), src


class Terrain:
    def __init__(self, dem, bounds):
        """dem = objekt Dem se surovým polem dmr; bounds = (minX, maxX, minZ, maxZ) herní oblasti."""
        self.dem = dem
        mnx, mxx, mnz, mxz = bounds
        self.x0 = math.floor(mnx / CHUNK) * CHUNK
        self.z0 = math.floor(mnz / CHUNK) * CHUNK
        x1 = math.ceil(mxx / CHUNK) * CHUNK
        z1 = math.ceil(mxz / CHUNK) * CHUNK
        self.cols = int(round((x1 - self.x0) / G)) + 1
        self.rows = int(round((z1 - self.z0) / G)) + 1
        # vyhlazený DMR: hrubší pro síť, jemnější pro profily silnic
        self.s_grid = box_mean(dem.dmr, 2, 3)        # ~10 × 9 m
        self.s_fine = box_mean(dem.dmr, 1, 1)        # ~6 × 4 m
        xs = self.x0 + np.arange(self.cols) * G
        zs = self.z0 + np.arange(self.rows) * G
        self.XX, self.ZZ = np.meshgrid(xs, zs)
        self.h = self._dem_sample(self.s_grid, self.XX, self.ZZ).astype(np.float64)
        self.base = round(float(self.at(0.0, 0.0)), 1)

    def _dem_sample(self, a, xs, zs):
        d = self.dem
        c = np.clip((np.asarray(xs) - d.x0) / d.px - 0.5, 0, d.W - 1.001)
        r = np.clip((np.asarray(zs) - d.z0) / d.pz - 0.5, 0, d.H - 1.001)
        c0 = np.floor(c).astype(np.int64)
        r0 = np.floor(r).astype(np.int64)
        fc = c - c0
        fr = r - r0
        return (a[r0, c0] * (1 - fc) * (1 - fr) + a[r0, c0 + 1] * fc * (1 - fr)
                + a[r0 + 1, c0] * (1 - fc) * fr + a[r0 + 1, c0 + 1] * fc * fr)

    def fine(self, xs, zs):
        """Výška z jemně vyhlazeného DMR (pro profily silnic)."""
        return self._dem_sample(self.s_fine, xs, zs)

    def at(self, x, z):
        """Výška ze sítě (bilineárně); x, z mohou být pole."""
        gx = np.clip((np.asarray(x, dtype=np.float64) - self.x0) / G, 0, self.cols - 1.001)
        gz = np.clip((np.asarray(z, dtype=np.float64) - self.z0) / G, 0, self.rows - 1.001)
        i = np.floor(gx).astype(np.int64)
        j = np.floor(gz).astype(np.int64)
        fx = gx - i
        fz = gz - j
        h = self.h
        # stejné dělení čtverce na dva trojúhelníky jako ve hře (úhlopříčka mezi body 10 a 01)
        h00, h10, h01, h11 = h[j, i], h[j, i + 1], h[j + 1, i], h[j + 1, i + 1]
        lower = h00 + (h10 - h00) * fx + (h01 - h00) * fz
        upper = h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz)
        return np.where(fx + fz <= 1, lower, upper)

    # ------------------------------------------------------------------
    def burn_lines(self, items, half_width, inner_margin=1.0, falloff=9.0):
        """Zarovná terén pod liniemi (silnice, koleje) na jejich vyhlazený podélný profil.

        items = seznam slovníků s klíčem 'pts'; half_width = funkce(item) -> poloviční šířka.
        """
        num = np.zeros_like(self.h)
        den = np.zeros_like(self.h)
        wmax = np.zeros_like(self.h)
        for it in items:
            pts, _ = densify(it["pts"], 2.5)
            if len(pts) < 2:
                continue
            hp = self.fine(pts[:, 0], pts[:, 1]).astype(np.float64)
            # vyhlazení podél trasy (~22 m)
            k = 4
            pad = np.concatenate([np.full(k, hp[0]), hp, np.full(k, hp[-1])])
            hp = np.convolve(pad, np.ones(2 * k + 1) / (2 * k + 1), mode="valid")
            r_in = half_width(it) + inner_margin
            r_out = r_in + falloff
            for s in range(0, len(pts), 48):
                seg = pts[s:s + 49]
                hs = hp[s:s + 49]
                i0 = max(0, int(math.floor((seg[:, 0].min() - r_out - self.x0) / G)))
                i1 = min(self.cols - 1, int(math.ceil((seg[:, 0].max() + r_out - self.x0) / G)))
                j0 = max(0, int(math.floor((seg[:, 1].min() - r_out - self.z0) / G)))
                j1 = min(self.rows - 1, int(math.ceil((seg[:, 1].max() + r_out - self.z0) / G)))
                if i1 < i0 or j1 < j0:
                    continue
                nx = self.XX[j0:j1 + 1, i0:i1 + 1]
                nz = self.ZZ[j0:j1 + 1, i0:i1 + 1]
                d2 = (nx[:, :, None] - seg[None, None, :, 0]) ** 2 + (nz[:, :, None] - seg[None, None, :, 1]) ** 2
                am = d2.argmin(axis=2)
                d = np.sqrt(np.take_along_axis(d2, am[:, :, None], axis=2)[:, :, 0])
                w = np.where(d <= r_in, 1.0, np.where(d >= r_out, 0.0, 0.5 * (1 + np.cos(np.pi * (d - r_in) / falloff))))
                w2 = w * w
                num[j0:j1 + 1, i0:i1 + 1] += w2 * hs[am]
                den[j0:j1 + 1, i0:i1 + 1] += w2
                np.maximum(wmax[j0:j1 + 1, i0:i1 + 1], w, out=wmax[j0:j1 + 1, i0:i1 + 1])
        m = den > 1e-9
        target = np.where(m, num / np.maximum(den, 1e-9), self.h)
        self.h = self.h * (1 - wmax) + target * wmax

    def flatten_water(self, water_polys):
        """Na vodních plochách vyrovná hladinu (medián okolních vodních bodů)."""
        from PIL import Image, ImageChops, ImageDraw
        mask = np.zeros((self.rows, self.cols), dtype=bool)
        for rings in water_polys:
            xs = [p[0] for r in rings for p in r]
            zs = [p[1] for r in rings for p in r]
            i0 = max(0, int((min(xs) - self.x0) / G) - 1)
            i1 = min(self.cols - 1, int((max(xs) - self.x0) / G) + 2)
            j0 = max(0, int((min(zs) - self.z0) / G) - 1)
            j1 = min(self.rows - 1, int((max(zs) - self.z0) / G) + 2)
            if i1 <= i0 or j1 <= j0:
                continue
            w, h = i1 - i0 + 1, j1 - j0 + 1
            acc = Image.new("1", (w, h), 0)
            for r in rings:
                if len(r) < 3:
                    continue
                m = Image.new("1", (w, h), 0)
                ImageDraw.Draw(m).polygon([((x - self.x0) / G - i0, (z - self.z0) / G - j0) for x, z in r], fill=1)
                acc = ImageChops.logical_xor(acc, m)      # sudá–lichá: díry (ostrovy) se odečtou
            mask[j0:j1 + 1, i0:i1 + 1] |= np.array(acc, dtype=bool)
        src = self.h.copy()
        js, is_ = np.nonzero(mask)
        R = 3
        for j, i in zip(js, is_):
            a0, a1 = max(0, j - R), min(self.rows, j + R + 1)
            b0, b1 = max(0, i - R), min(self.cols, i + R + 1)
            vals = src[a0:a1, b0:b1][mask[a0:a1, b0:b1]]
            self.h[j, i] = np.median(vals)
        return int(mask.sum())

    # ------------------------------------------------------------------
    def bridge_heights(self, items, is_bridge):
        """Dopočítá výšky bodů mostů: konce leží na terénu, mezi nimi mostovka plynule spojuje.

        items = seznam linií jedné sítě (silnice, nebo koleje); doplní klíč 'by' (výšky nad BASE).
        """
        def key(p):
            return (round(p[0] * 10), round(p[1] * 10))

        ground = set()
        for it in items:
            if not is_bridge(it):
                for p in it["pts"]:
                    ground.add(key(p))
        pos = {}
        adj = defaultdict(list)
        deg_end = defaultdict(int)
        bridges = [it for it in items if is_bridge(it)]
        for it in bridges:
            pts = it["pts"]
            for a, b in zip(pts, pts[1:]):
                ka, kb = key(a), key(b)
                pos[ka] = a
                pos[kb] = b
                ln = max(0.2, math.hypot(b[0] - a[0], b[1] - a[1]))
                adj[ka].append((kb, 1.0 / ln))
                adj[kb].append((ka, 1.0 / ln))
            deg_end[key(pts[0])] += 1
            deg_end[key(pts[-1])] += 1
        if not pos:
            return 0
        keys = list(pos)
        px = np.array([pos[k][0] for k in keys])
        pz = np.array([pos[k][1] for k in keys])
        th = self.at(px, pz)
        hgt = dict(zip(keys, th.tolist()))
        # pevné body: napojení na silnici mimo most a volné konce
        fixed = set()
        for k in keys:
            if k in ground or (len(adj[k]) == 1):
                fixed.add(k)
        # souvislé části bez pevného bodu nech na terénu
        seen = set()
        for k in keys:
            if k in seen:
                continue
            comp = [k]
            seen.add(k)
            stack = [k]
            while stack:
                c = stack.pop()
                for n, _ in adj[c]:
                    if n not in seen:
                        seen.add(n)
                        comp.append(n)
                        stack.append(n)
            if not any(c in fixed for c in comp):
                fixed.update(comp)
        free = [k for k in keys if k not in fixed]
        for _ in range(600):
            delta = 0.0
            for k in free:
                s = 0.0
                w = 0.0
                for n, wt in adj[k]:
                    s += hgt[n] * wt
                    w += wt
                v = s / w
                delta = max(delta, abs(v - hgt[k]))
                hgt[k] = v
            if delta < 0.002:
                break
        tmap = dict(zip(keys, th.tolist()))
        for it in bridges:
            # mostovka nesmí být pod terénem
            it["by"] = [max(hgt[key(p)], tmap[key(p)] + 0.05) - self.base for p in it["pts"]]
        return len(bridges)

    # ------------------------------------------------------------------
    def quantize(self):
        """Převede síť na uložitelný tvar (krok Q, rozdíly po řádcích v int8) a nahradí ji
        přesně tím, co si hra z uložených dat přečte – další výpočty pak sedí na centimetr."""
        q = np.round((self.h - self.base) / Q).astype(np.int64)
        rows, cols = q.shape
        self._start = q[:, 0].astype(np.int16)
        d = np.zeros((rows, cols - 1), dtype=np.int8)
        clipped = 0
        for j in range(rows):
            dj = np.diff(q[j])
            if np.abs(dj).max() <= 127:
                d[j] = dj
            else:
                # příliš strmý skok (nábřežní zeď, lom) se rozloží do sousedních kroků
                cur = int(q[j, 0])
                for i in range(1, cols):
                    step = max(-127, min(127, int(q[j, i]) - cur))
                    d[j, i - 1] = step
                    cur += step
                clipped += 1
        self._d = d
        dec = np.concatenate([self._start.astype(np.int64)[:, None], d.astype(np.int64)], axis=1).cumsum(axis=1)
        self.h = dec * Q + self.base
        return clipped

    def write(self, path, write_pack):
        rows, cols = self.h.shape
        write_pack(path, {"g": G, "cols": cols, "rows": rows, "x0": self.x0, "z0": self.z0,
                          "base": self.base, "q": Q},
                   {"rowStart": self._start, "d": self._d.reshape(-1)})
