#!/usr/bin/env bash
# Spustí všechny zkoušky Godot verze bez vykreslování. Z kořene repozitáře:
#   godot/testy/spust_zkousky.sh
# Zkouška projde jen tehdy, když vypíše „VÝSLEDEK: PROŠLO“ a v jejím výstupu není chyba skriptu.
cd "$(dirname "$0")/.." || exit 1
LOG="${TMPDIR:-/tmp}/plzen-zkousky"
mkdir -p "$LOG"
selhalo=0

echo "== Kontrola skriptů"
testy/kontrola_skriptu.sh || selhalo=$((selhalo + 1))

zkouska() {
  local nazev="$1"; shift
  echo "== $nazev"
  timeout 1200 godot --headless --path . "$@" > "$LOG/$nazev.log" 2>&1
  if grep -q "VÝSLEDEK: PROŠLO" "$LOG/$nazev.log" && ! grep -q "SCRIPT ERROR" "$LOG/$nazev.log"; then
    echo "   prošlo"
  else
    echo "   SELHALO – podrobnosti v $LOG/$nazev.log"
    grep -E "✗|SCRIPT ERROR|VÝSLEDEK" "$LOG/$nazev.log" | head -8
    selhalo=$((selhalo + 1))
  fi
}

zkouska import -s res://testy/test_import.gd
zkouska most testy/scenar_most.tscn
zkouska mhd testy/scenar_mhd.tscn
for dalsi in testy/scenar_*.tscn; do
  case "$dalsi" in *scenar_most.tscn|*scenar_mhd.tscn) continue ;; esac
  zkouska "$(basename "$dalsi" .tscn)" "$dalsi"
done

echo
[ $selhalo -eq 0 ] && echo "Všechny zkoušky prošly." || echo "Neprošlo: $selhalo"
exit $selhalo
