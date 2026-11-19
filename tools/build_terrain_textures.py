"""Sestaví dvě textury pro herní terén z vybraných podkladů Poly Haven (CC0)."""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen

import numpy as np
from PIL import Image

TILE = 512
LAYERS = ('grass_ground', 'brown_mud', 'gravel', 'farm_furrows', 'damp_beach_sand', 'leaves_forest_ground')


def source(asset, channel, row, cache):
    path = cache / f'{asset}-{channel}.jpg'
    if not path.is_file():
        request = Request(row['url'], headers={'User-Agent': 'Plzen-naplno/1.0 (github.com/JendaNDT/GTA-Pilsen)'})
        with urlopen(request, timeout=60) as response:
            data = response.read()
    else:
        data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != row['sha256']:
        raise ValueError(f'Neočekávaný otisk textury {asset}/{channel}')
    if not path.is_file():
        path.write_bytes(data)
    with Image.open(path) as image:
        return np.asarray(image.convert('RGB').resize((TILE, TILE), Image.Resampling.LANCZOS))


def build(manifest, cache, output):
    cache.mkdir(parents=True, exist_ok=True)
    output.mkdir(parents=True, exist_ok=True)
    for channel, name in [('Diffuse', 'barva'), ('nor_gl', 'normaly')]:
        atlas = Image.new('RGB', (3*TILE, 2*TILE))
        for index, asset in enumerate(LAYERS):
            pixels = source(asset, channel, manifest[asset][channel], cache)
            if channel == 'Diffuse':
                # Barvu již určuje herní mapa a ortofoto. Z fotografie přeneseme místní odchylku od průměru.
                pixels = pixels.astype(np.float32)
                mean = np.maximum(pixels.mean(axis=(0, 1), keepdims=True), 1)
                pixels = np.rint(128 * pixels / mean).clip(0, 255).astype(np.uint8)
            else:
                normals = pixels.astype(np.float32) / 127.5 - 1
                normals /= np.maximum(np.linalg.norm(normals, axis=2, keepdims=True), 1e-6)
                pixels = np.rint((normals + 1)*127.5).clip(0,255).astype(np.uint8)
            atlas.paste(Image.fromarray(pixels), ((index % 3)*TILE, (index // 3)*TILE))
        atlas.save(output / (name + '.webp'), lossless=channel == 'nor_gl', quality=88, method=6)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=Path('data-raw/e23/polyhaven'))
    parser.add_argument('--output', type=Path, default=Path('data-raw/kandidat/textures/terrain'))
    arguments = parser.parse_args()
    manifest = json.loads(Path(__file__).with_name('terrain-textures.json').read_text())
    build(manifest, arguments.cache, arguments.output)
