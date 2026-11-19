#!/usr/bin/env python3
"""Zabalí ověřené statické vydání a odpovídající zdrojový strom."""
import argparse
import hashlib
import json
import re
import stat
import subprocess
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parent.parent


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_zip(archive, files, root, executable=()):
    hashes = {}
    with ZipFile(archive, "w", compression=ZIP_DEFLATED) as bundle:
        for name in files:
            path = root / name
            info = ZipInfo(name)
            info.create_system = 3
            mode = 0o755 if name in executable else 0o644
            info.external_attr = (stat.S_IFREG | mode) << 16
            info.compress_type = ZIP_DEFLATED
            checksum = hashlib.sha256()
            with path.open("rb") as source, bundle.open(info, "w") as target:
                while block := source.read(1024 * 1024):
                    target.write(block)
                    checksum.update(block)
            hashes[name] = checksum.hexdigest()
    return hashes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", help="Označení vydání, výchozí je verze z package.json.")
    parser.add_argument("--dist", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    version = args.version or json.loads((ROOT / "package.json").read_text())["version"]
    if not re.fullmatch(r"[0-9]+(?:[.][0-9]+){2}(?:[-+][a-zA-Z0-9.-]+)?", version):
        parser.error("Neplatné označení verze.")
    dist = args.dist.resolve()
    if not (dist / "index.html").is_file():
        parser.error("Výstup musí obsahovat sestavené index.html.")
    source = subprocess.check_output(
        ["git", "ls-files", "--stage", "-z",
         "--", "AGENTS.md", "vendor", ".github", ".gitignore", ".nvmrc", "README.md", "Spustit hru.command", "docs",
         "index.html", "package.json", "package-lock.json", "playwright.config.js", "public", "src", "tests", "tools", "vite.config.js"],
        cwd=ROOT,
    )
    executable = set()
    paths = []
    for row in source.decode().split("\0"):
        if not row:
            continue
        metadata, name = row.split("\t", 1)
        mode, _, stage = metadata.split()
        if stage != "0" or mode not in {"100644", "100755"}:
            parser.error(f"Neuzavřený nebo nepodporovaný zdrojový soubor {name}.")
        if not (ROOT / name).is_file() or (ROOT / name).is_symlink():
            parser.error(f"V pracovní kopii chybí běžný sledovaný soubor {name}.")
        paths.append(name)
        if mode == "100755":
            executable.add(name)
    paths.sort()
    published = sorted(path.relative_to(dist).as_posix() for path in dist.rglob("*") if path.is_file())
    base = f"Plzen-naplno-{version}"
    manifest = {
        "version": version,
        "baseCommit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
    }
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=output.parent) as folder:
        stage = Path(folder) / "vydani"
        stage.mkdir()
        web = stage / f"{base}-web.zip"
        sources = stage / f"{base}-zdroje.zip"
        manifest["published"] = write_zip(web, published, dist)
        manifest["sources"] = write_zip(sources, paths, ROOT, executable)
        for name, checksum in manifest["sources"].items():
            if name.startswith("public/") and manifest["published"].get(name.removeprefix("public/")) != checksum:
                parser.error(f"Sestavení neodpovídá souboru {name}.")
        manifest["archives"] = {path.name: {"bytes": path.stat().st_size, "sha256": digest(path)} for path in (web, sources)}
        (stage / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        try:
            stage.replace(output)
        except OSError:
            if not output.is_dir():
                raise
            if any(not (output / p.name).is_file() or digest(p) != digest(output / p.name) for p in stage.iterdir()):
                parser.error(f"Ve složce {output} je jiné vydání. Vyber pro novou verzi vlastní složku.")
    print(f"{version} · {len(published)} souborů ve webu · {len(paths)} souborů ve zdrojích")


if __name__ == "__main__":
    main()
