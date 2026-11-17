# Stav etapy E13

Větev `etapa/E13`, výchozí revize `3e8aa3e`. Zadání je v [E13](E13.md).

| Krok | Stav |
| --- | --- |
| 1. Pevná kvalita a měření práce snímku | Hotovo |
| 2. Panel F9 a ovládání na telefonu | Hotovo |
| 3. Režim `--work` | Hotovo |
| 4. Osm referenčních pohledů | Hotovo |
| 5. Test rozpočtu vykreslování | Hotovo |
| 6. Návod, protokol a závěrečné testy | Hotovo |

Krok 1 · Prošlo 30 testů Node, sestavení a všech 35 prohlížečových testů včetně nového měření. Výchozí revize prošla 13 testy Pythonu.

Krok 2 · Prošlo 30 testů Node, sestavení a všech 36 prohlížečových testů. Panel byl ověřen klávesou F9 i klepnutím v emulaci telefonu.

Krok 3 · Prošlo 30 testů Node, 13 testů Pythonu a sestavení. Tři běhy `--work` zapsaly JSON včetně času GPU na Apple M4. Největší rozdíl mediánu, p95 nebo p99 práce snímku byl 6,5 %.

Krok 4 · Prošlo 30 testů Node, 13 testů Pythonu a sestavení. Všech osm JPEG má 1280 × 720 px a méně než 250 kB. Místa byla ověřena pohledem a opakované snímky byly na stejném stroji souborově shodné.

Krok 5 · Prošlo 30 testů Node, sestavení a test rozpočtu ve všech třech pohledech. Přidání 40 vykreslovacích volání vyvolalo očekávané selhání (302 proti limitu 288). Po odebrání se test vrátil k úspěchu.

Krok 6 · Prošlo 30 testů Node, 13 testů Pythonu, kontrola syntaxe nástrojů, audit npm,
sestavení a 37 prohlížečových testů. [Protokol etapy](../E13.md).

Autor dodal měření z počítače dne 17. listopadu 2026. Zaznamenalo 3 595 snímků za 60 s,
práci snímku 2,4 / 4,3 / 5,7 ms a GPU 11,41 / 12,69 / 13,07 ms (medián / p95 / p99).
Úplné hodnoty jsou v protokolu.

Měření na skutečném telefonu autor výslovně vynechal. Výkon telefonu zůstává neověřený.
Autor dne 17. listopadu 2026 prohlédl a schválil referenční snímky.
Autor následně schválil sloučení všech změn E13 do `main` přes pull request č. 5.
Samostatná kontrola modelem zůstává doporučeným postupem.

## Oprava závislosti před sloučením

Při přípravě sloučení dne 17. listopadu 2026 znovu prošlo 30 testů Node, 13 testů Pythonu,
sestavení a všech 37 prohlížečových testů. Audit npm nyní selhává kvůli
[GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) v knihovně
`picomatch`, kterou používá Vite. Záznam byl na GitHubu nově prověřen v 15:56 UTC.
Nainstalovaná i nejnovější verze `picomatch` je 4.0.7, opravená verze není uvedená.
Autor následně schválil opravu. Izolovaný kandidát Vite 6.2.7 měl další známé zranitelnosti.
Projekt používá místní opravu picomatch `4.0.8-plzen.1` se zachovanou licencí a zdrojem.
Všech 1 983 testů knihovny a tři cílené testy projektu prošly. Audit hlásí nula
zranitelností. Čistá instalace, 33 testů Node, 13 testů Pythonu, sestavení a všech
37 prohlížečových testů prošly. Vývojová verze hry na `localhost:5173` se načetla bez
chyb. E13 je připravená k dokončení sloučení přes pull request č. 5.
