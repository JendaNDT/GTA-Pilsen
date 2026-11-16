"""Evidence zdrojů a kontrola, že uložený výškopis odpovídá výřezu."""
import hashlib
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np

from area import BBOX, DEM_COLS, DEM_ROWS, DEM_STEP, DEM_TILES

DEM_SERVICES = {"dmp": "dmp1g", "dmr": "dmr5g"}
DEM_EXPORT_URL = (
    "https://ags.cuzk.cz/arcgis2/rest/services/{svc}/ImageServer/exportImage"
    "?bbox={w},{s},{e},{n}&bboxSR=4326&imageSR=4326&size={pw},{ph}"
    "&format=tiff&pixelType=F32&noData=-9999"
    "&interpolation=RSP_BilinearInterpolation&f=image"
)
DEM_GRID = {
    "bbox": list(BBOX), "crs": "EPSG:4326", "verticalDatum": "Bpv", "stepDegrees": DEM_STEP,
    "shape": [DEM_ROWS, DEM_COLS], "tiles": list(DEM_TILES),
}


def sha256(source):
    digest = hashlib.sha256()
    for block in iter(lambda: source.read(1 << 20), b""):
        digest.update(block)
    return digest.hexdigest()


def dump_dem(path, array, retrieved_at):
    path = Path(path)
    with TemporaryDirectory(dir=path.parent) as directory:
        raster = Path(directory) / path.name
        np.save(raster, array)
        with raster.open("rb") as source:
            checksum = sha256(source)
        info = {
            "service": DEM_SERVICES[path.stem],
            "url": DEM_EXPORT_URL,
            "retrievedAt": retrieved_at,
            "grid": DEM_GRID,
            "sha256": checksum,
        }
        manifest = Path(directory) / f"{path.name}.json"
        manifest.write_text(json.dumps(info, indent=2) + "\n", encoding="utf-8")
        os.replace(raster, path)
        os.replace(manifest, path.with_suffix(".npy.json"))


def load_dem(path, *, read_array=True):
    path = Path(path)
    try:
        info = json.loads(path.with_suffix(".npy.json").read_text(encoding="utf-8"))
        if (info["grid"] != DEM_GRID or info["service"] != DEM_SERVICES[path.stem]
                or info["url"] != DEM_EXPORT_URL or not info["retrievedAt"]):
            raise ValueError("jiný výřez nebo nastavení exportu")
        with path.open("rb") as source:
            if sha256(source) != info["sha256"]:
                raise ValueError("nesouhlasí kontrolní součet")
            if not read_array:
                return None, info
            source.seek(0)
            array = np.load(source)
        if array.shape != tuple(DEM_GRID["shape"]) or array.dtype != np.float32:
            raise ValueError("jiný tvar nebo formát rastru")
        return array, info
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise ValueError(f"{path.name}: {error}. Obnovte výškopis pomocí tools/fetch_dem.py.") from error
