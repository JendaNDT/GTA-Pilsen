import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


class KontrolaGodotu(unittest.TestCase):
    def test_skutecny_vysledek_importu_a_kazdeho_skriptu(self):
        source = Path(__file__).resolve().parents[1] / "godot/testy/kontrola_skriptu.sh"
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name in ("skripty", "addons", "testy", "editor"):
                (root / name).mkdir()
            script = root / "testy/kontrola_skriptu.sh"
            shutil.copy2(source, script)
            (root / "skripty/s mezerou.gd").touch()
            godot = root / "godot"
            godot.write_text("""#!/bin/sh
case "$ZKOUSKA:$*" in
  ticha:*) exit 9 ;;
  cas:*) exit 124 ;;
  skript:*--script*) echo "diagnostika vadného souboru" >&2; exit 1 ;;
  vypis:*--script*) echo 'SCRIPT ERROR: vadný typ' ;;
esac
""")
            godot.chmod(0o755)
            for case, part in [
                ("uspech", "jsou v pořádku"), ("ticha", "kód 9"),
                ("cas", "kód 124"), ("skript", "diagnostika vadného souboru"),
                ("vypis", "SCRIPT ERROR"), ("chybi", "kód 127"),
            ]:
                with self.subTest(case=case):
                    binary = root / "chybi" if case == "chybi" else godot
                    env = {**os.environ, "GODOT_BIN": str(binary), "ZKOUSKA": case}
                    result = subprocess.run([script], env=env, capture_output=True, text=True)
                    self.assertEqual(result.returncode == 0, case == "uspech")
                    self.assertIn(part, result.stdout + result.stderr)
