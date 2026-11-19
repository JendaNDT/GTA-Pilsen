import contextlib
import io
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
            for path, contents in {"package.json": '{"version":"0.2.0"}', "dist/index.html": "<canvas></canvas>",
                                   "public/test.bin": "dlaždice", "dist/test.bin": "dlaždice",
                                   "vendor/picomatch/index.js": "export default 1", "AGENTS.md": "Pokyny"}.items():
                target = root / path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(contents)
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
                run("0.1.0-E12")
                with self.assertRaises(SystemExit):
                    run("0.2.0")
                self.assertEqual((output / "manifest.json").read_bytes(), manifest)
                index = json.loads(manifest)
                with ZipFile(output / "Plzen-naplno-0.1.0-E12-zdroje.zip") as bundle:
                    self.assertIn("vendor/picomatch/index.js", bundle.namelist())
                    self.assertEqual(set(bundle.namelist()), set(index["sources"]))
                for file, record in index["archives"].items():
                    self.assertEqual(archive_release.digest(output / file), record["sha256"])
                with self.assertRaises(SystemExit):
                    run("../chyba")
