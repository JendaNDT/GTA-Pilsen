#!/usr/bin/env bash
# Chyba importu tříd znemožňuje spolehlivě ověřit jednotlivé skripty.
cd "$(dirname "$0")/.." || exit 1
godot_bin=${GODOT_BIN:-godot}

zkontrolovat() {
  local limit="$1" nazev="$2" vystup kod
  shift 2
  vystup=$(timeout "$limit" "$godot_bin" --headless "$@" 2>&1)
  kod=$?
  if [[ $kod != 0 || "$vystup" == *"SCRIPT ERROR"* || "$vystup" == *"Parse Error"* ]]; then
    printf 'Chyba při kontrole %s (návratový kód %s).\n%s\n' "$nazev" "$kod" "$vystup" >&2
    return 1
  fi
}

zkontrolovat 300 'importu projektu' --editor --quit || exit 1
chyby=0
for adresar in skripty addons testy editor; do
  [[ -d "$adresar" ]] || exit 1
done
while IFS= read -r -d '' soubor; do
  zkontrolovat 60 "$soubor" --check-only --script "res://$soubor" || chyby=$((chyby + 1))
done < <(find skripty addons testy editor -name '*.gd' -type f -print0)
if (( chyby )); then
  echo "Chybných skriptů: $chyby" >&2
  exit 1
fi
echo "Všechny skripty jsou v pořádku."
