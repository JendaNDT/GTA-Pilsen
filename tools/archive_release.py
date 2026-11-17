#!/usr/bin/env python3
"""Zabalí ověřené statické vydání a odpovídající zdrojový strom."""
import argparse
import hashlib
import json
import shutil
import stat
import subprocess
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parent.parent


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_zip(archive, files, root):
    with ZipFile(archive, "w", compression=ZIP_DEFLATED) as bundle:
        for name in files:
            path = root / name
            info = ZipInfo(name)
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | stat.S_IMODE(path.stat().st_mode)) << 16
            info.compress_type = ZIP_DEFLATED
            with path.open("rb") as source, bundle.open(info, "w") as target:
                shutil.copyfileobj(source, target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dist", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    dist = args.dist.resolve()
    if not (dist / "index.html").is_file():
        parser.error("Výstup musí obsahovat sestavené index.html.")
    source = subprocess.check_output(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z",
         "--", ".github", ".gitignore", ".nvmrc", "README.md", "Spustit hru.command", "docs",
         "index.html", "package.json", "package-lock.json", "playwright.config.js", "public", "src", "tests", "tools", "vite.config.js"],
        cwd=ROOT,
    )
    paths = sorted({name for name in source.decode().split("\0") if name and (ROOT / name).is_file()})
    published = sorted(path.relative_to(dist).as_posix() for path in dist.rglob("*") if path.is_file())
    for name in paths:
        if (ROOT / name).is_symlink():
            parser.error(f"Zdrojový archiv nepřijímá symbolický odkaz {name}.")
        if name.startswith("public/"):
            output = dist / name.removeprefix("public/")
            if not output.is_file() or digest(ROOT / name) != digest(output):
                parser.error(f"Sestavení neodpovídá souboru {name}.")

    version = json.loads((ROOT / "package.json").read_text())["version"] + "-E12"
    base = f"Plzen-naplno-{version}"
    manifest = {
        "version": version,
        "baseCommit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "published": {name: digest(dist / name) for name in published},
    }
    args.output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=args.output) as folder:
        stage = Path(folder)
        web = stage / f"{base}-web.zip"
        sources = stage / f"{base}-zdroje.zip"
        write_zip(web, published, dist)
        write_zip(sources, paths, ROOT)
        manifest["archives"] = {path.name: {"bytes": path.stat().st_size, "sha256": digest(path)} for path in (web, sources)}
        (stage / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        for path in sorted(stage.iterdir()):
            path.replace(args.output / path.name)
    print(f"{version} · {len(published)} souborů ve webu · {len(paths)} souborů ve zdrojích")


if __name__ == "__main__":
    main()
