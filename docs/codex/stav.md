# Stav etapy E13

Větev `etapa/E13`, výchozí revize `3e8aa3e`. Zadání je v [E13](E13.md).

| Krok | Stav |
| --- | --- |
| 1. Pevná kvalita a měření práce snímku | Hotovo |
| 2. Panel F9 a ovládání na telefonu | Hotovo |
| 3. Režim `--work` | Hotovo |
| 4. Osm referenčních pohledů | Čeká |
| 5. Test rozpočtu vykreslování | Čeká |
| 6. Návod, protokol a pull request | Čeká |

Krok 1 · Prošlo 30 testů Node, sestavení a všech 35 prohlížečových testů včetně nového měření. Výchozí revize prošla 13 testy Pythonu.

Krok 2 · Prošlo 30 testů Node, sestavení a všech 36 prohlížečových testů. Panel byl ověřen klávesou F9 i klepnutím v emulaci telefonu.

Krok 3 · Prošlo 30 testů Node, 13 testů Pythonu a sestavení. Tři běhy `--work` zapsaly JSON včetně času GPU na Apple M4. Největší rozdíl mediánu, p95 nebo p99 práce snímku byl 6,5 %.

Na kontrolu autora čeká měření na jeho počítači a telefonu.
