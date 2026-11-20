#!/usr/bin/env bash
# Zkontroluje syntaxi a typy všech skriptů GDScript v projektu (z kořene repozitáře nebo ze složky godot).
cd "$(dirname "$0")/.." || exit 1
chyby=0
for f in $(find skripty addons testy editor -name "*.gd" | sort); do
  out=$(timeout 60 godot --headless --check-only --script "res://$f" 2>&1 | grep -E "SCRIPT ERROR|Parse Error" | head -3)
  if [ -n "$out" ]; then echo "✗ $f"; echo "$out"; chyby=$((chyby + 1)); fi
done
[ $chyby -eq 0 ] && echo "Všechny skripty jsou v pořádku." || echo "Chybných skriptů: $chyby"
exit $chyby
