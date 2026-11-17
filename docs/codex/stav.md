# Stav etapy E13

Větev `etapa/E13`, výchozí revize `3e8aa3e`. Zadání je v [E13](E13.md).

| Krok | Stav |
| --- | --- |
| 1. Pevná kvalita a měření práce snímku | Hotovo |
| 2. Panel F9 a ovládání na telefonu | Hotovo |
| 3. Režim `--work` | Hotovo |
| 4. Osm referenčních pohledů | Hotovo |
| 5. Test rozpočtu vykreslování | Hotovo |
| 6. Návod, protokol a pull request | Čeká |

Krok 1 · Prošlo 30 testů Node, sestavení a všech 35 prohlížečových testů včetně nového měření. Výchozí revize prošla 13 testy Pythonu.

Krok 2 · Prošlo 30 testů Node, sestavení a všech 36 prohlížečových testů. Panel byl ověřen klávesou F9 i klepnutím v emulaci telefonu.

Krok 3 · Prošlo 30 testů Node, 13 testů Pythonu a sestavení. Tři běhy `--work` zapsaly JSON včetně času GPU na Apple M4. Největší rozdíl mediánu, p95 nebo p99 práce snímku byl 6,5 %.

Krok 4 · Prošlo 30 testů Node, 13 testů Pythonu a sestavení. Všech osm JPEG má 1280 × 720 px a méně než 250 kB. Místa byla ověřena pohledem a opakované snímky byly na stejném stroji souborově shodné.

Krok 5 · Prošlo 30 testů Node, sestavení a test rozpočtu ve všech třech pohledech. Přidání 40 vykreslovacích volání vyvolalo očekávané selhání (302 proti limitu 288). Po odebrání se test vrátil k úspěchu.

Na kontrolu autora čeká měření na jeho počítači a telefonu.
