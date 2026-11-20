import contextlib
import io
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from zipfile import ZipFile

from tools import archive_release


class ReleaseArchiveTest(unittest.TestCase):
    def test_repeatable_archive_keeps_old_release_and_local_dependency(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            subprocess.run(["git", "init", "-q", str(root)], check=True)
            index_html = '<script type="module" src="./assets/hra.js"></script>'
            chunks = {"index.html": {"file": "assets/hra.js", "dynamicImports": ["fyzika.js"]},
                      "fyzika.js": {"file": "assets/fyzika.js", "imports": ["index.html"]}}
            for path, contents in {"package.json": '{"version":"0.2.0"}', "dist/index.html": index_html,
                                   "dist/.vite/manifest.json": json.dumps(chunks),
                                   "dist/assets/hra.js": 'import("./fyzika.js")', "dist/assets/fyzika.js": "export default 1",
                                   "public/test.bin": "dlaždice", "dist/test.bin": "dlaždice",
                                   "vendor/picomatch/index.js": "export default 1", "AGENTS.md": "Pokyny"}.items():
                target = root / path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(contents)
            (root / "Spustit hru.command").write_text("#!/bin/sh\n")
            (root / "Spustit hru.command").chmod(0o755)
            subprocess.run(["git", "add", "."], cwd=root, check=True)
            subprocess.run(["git", "-c", "user.name=test", "-c", "user.email=test@example.invalid",
                            "commit", "-qm", "Připravit vzorek"], cwd=root, check=True)
            output = root / "archiv"
            def run(version):
                args = ["archiv", "--dist", str(root / "dist"), "--output", str(output), "--version", version]
                with patch.object(archive_release, "ROOT", root), patch.object(sys, "argv", args):
                    archive_release.main()

            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                run("0.1.0-E12")
                manifest = (output / "manifest.json").read_bytes()
                (root / "dist/index.html").chmod(0o600)
                (root / "Spustit hru.command").chmod(0o600)
                (root / "AGENTS.md").chmod(0o640)
                run("0.1.0-E12")
                with self.assertRaises(SystemExit):
                    run("0.2.0")
                self.assertEqual((output / "manifest.json").read_bytes(), manifest)
                index = json.loads(manifest)
                with ZipFile(output / "Plzen-naplno-0.1.0-E12-zdroje.zip") as bundle:
                    self.assertIn("vendor/picomatch/index.js", bundle.namelist())
                    self.assertEqual(bundle.getinfo("Spustit hru.command").external_attr >> 16, 0o100755)
                    self.assertEqual(bundle.getinfo("AGENTS.md").external_attr >> 16, 0o100644)
                    self.assertEqual(set(bundle.namelist()), set(index["sources"]))
                for file, record in index["archives"].items():
                    self.assertEqual(archive_release.digest(output / file), record["sha256"])
                    entries = index["published" if file.endswith("-web.zip") else "sources"]
                    with ZipFile(output / file) as bundle:
                        actual = {name: hashlib.sha256(bundle.read(name)).hexdigest() for name in bundle.namelist()}
                    self.assertEqual(actual, entries)
                with self.assertRaises(SystemExit):
                    run("../chyba")

                # I po neúplném přenosu mohou být ve složce index i všechna veřejná data.
                output = root / "neuvolnene"
                html = root / "dist/index.html"
                js = root / "dist/assets/hra.js"
                js.unlink()
                html.write_text('<script type="module" src="./assets/hra.js?v=2"></script>'
                                '<link rel="stylesheet" href="./assets/hra.css">')
                for name in ["hra.js", "hra.css"]:
                    with self.assertRaises(SystemExit):
                        run("0.2.0")
                    self.assertFalse(output.exists())
                    asset = root / "dist/assets" / name
                    asset.parent.mkdir(exist_ok=True)
                    asset.write_text("")
                # Cesta od kořene webu selže při nasazení z podsložky.
                html.write_text('<script src="/assets/hra.js"></script>')
                with self.assertRaises(SystemExit):
                    run("0.2.0")
                html.write_text('<script src="./assets/hra.js?v=2"></script><link rel="stylesheet" href="assets/hra.css">')
                run("0.2.0")
                self.assertTrue((output / "manifest.json").exists())
                html.write_text(index_html)

                # Jolt se načítá až ze vstupního modulu. V samotném HTML odkaz chybí.
                output = root / "chybejici-modul"
                engine = root / "dist/assets/fyzika.js"
                engine.unlink()
                with self.assertRaises(SystemExit):
                    run("0.2.0")
                self.assertFalse(output.exists())
                engine.write_text("export default 1")
                vite_manifest = root / "dist/.vite/manifest.json"
                vite_manifest.write_text(json.dumps({"index.html": chunks["index.html"]}))
                with self.assertRaises(SystemExit):
                    run("0.2.0")
                self.assertFalse(output.exists())
                vite_manifest.unlink()
                with self.assertRaises(SystemExit):
                    run("0.2.0")
                self.assertFalse(output.exists())
                vite_manifest.write_text(json.dumps(chunks))

                # Běžný zdroj může být při balení jiný než ve zveřejněné revizi.
                output = root / "jine-zdroje"
                vendor = root / "vendor/picomatch/index.js"
                vendor.write_text("export default 2")
                with self.assertRaises(SystemExit):
                    run("0.2.0")
                self.assertFalse(output.exists())
                subprocess.run(["git", "add", str(vendor)], cwd=root, check=True)
                with self.assertRaises(SystemExit):
                    run("0.2.0")
                self.assertFalse(output.exists())
                subprocess.run(["git", "restore", "--staged", "--worktree", str(vendor)], cwd=root, check=True)

                # Změna po zabalení webu nesmí vytvořit dva vzájemně odlišné archivy.
                write_zip = archive_release.write_zip
                def change_during_pack(archive, files, tree, *executable):
                    hashes = write_zip(archive, files, tree, *executable)
                    if tree == root / "dist":
                        (root / "public/test.bin").write_text("nová dlaždice")
                    return hashes

                output = root / "zmenene"
                with patch.object(archive_release, "write_zip", change_during_pack), self.assertRaises(SystemExit):
                    run("0.2.0")
                self.assertFalse(output.exists())
                (root / "public/test.bin").write_text("dlaždice")

                (root / "AGENTS.md").unlink()
                with self.assertRaises(SystemExit):
                    run("0.1.0-E12")
