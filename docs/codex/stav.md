# Stav etapy E16

Větev `etapa/E16` vychází z revize `7ad3671` na `main`. E15 je sloučená.
Autor potvrdil zahájení E16 a postupné zpracování podkladů pro celou mapu.
[Zadání E16](E16.md) · [Protokol E15](../E15.md)

| Krok | Stav |
| --- | --- |
| 1. Výběr, stahování a evidence listů ČÚZK | Hotovo · `4fb1104` |
| 2. Převod souřadnic, složení bloků a testy | Hotovo · `1c434fc` |
| 3. Načtení a vykreslení dvou pilotů | Hotovo · `786d840` |
| 4. Srovnávací snímky a vyladění barev | Hotovo · `2f1eede` |
| 5. Sestavení celého území a ověření velikosti a švů | Hotovo |
| 6. Přepínač, licence, dokumentace a závěrečné ověření | Zbývá |

## Ověření a otevřené otázky

- Zdroj ČÚZK je dostupný. Katalog obsahuje 16 301 záznamů a pro aktuální hranice
  mapy vybírá 158 listů. Zkušební list Blovice 0-0 byl stažen v délce 59 684 796
  bajtů a ověřen součtem SHA-256. Archiv obsahuje JPEG a tři soubory JGW pro
  jednotlivé souřadnicové systémy.
- Ověření kroku 1: 16 testů Pythonu, 38 testů Node a produkční sestavení prošly.
  Test stahování ověřuje navázání na přerušený přenos a evidenci po převodu.
- Ověření kroku 2: 21 testů Pythonu, 38 testů Node a produkční sestavení.
  Skutečných sedm listů tvoří osm pilotních bloků mimo `public/`. Testy ověřují
  převod s tolerancí půl zdrojového pixelu, hranici listů, vyrovnání barev a masku
  otevřené krajiny.
- GitHub potvrdil sloučení E15 v revizi `7ad3671`. Dokumentace i prohlížečové
  kontroly po sloučení prošly. [Kontroly projektu](https://github.com/JendaNDT/GTA-Pilsen/actions/runs/44182177519).
- Krok 3 prošel 22 testy Pythonu, 41 testy Node a produkčním sestavením. První
  prohlížečový běh našel chybu volání `fetch`, kvůli které se katalog snímků
  nenačetl. Opravené volání prošlo se stejnými očekáváními ve všech 14
  dotčených prohlížečových testech, včetně pozdního načtení v obou režimech
  vykreslování, výpadku bloku, vypnutí vrstvy a rozpočtu vykreslování.
- Krok 4 vybral měkké světlo s 80% krytím. Snímky před a po, porovnání tří
  způsobů prolnutí a odečet deseti kontrolních bodů jsou v [ověření pilotů](../E16/overeni-pilotu.md).
  Prošlo 41 testů Node, 22 testů Pythonu, sestavení a osm dotčených prohlížečových
  testů včetně referenčních pohledů v obou režimech.
- Krok 5 zpracoval 158 listů z roku 2025, celkem 9 806 292 735 bajtů vstupních
  archivů. Krátký výpadek spojení s katalogem překlenulo navázání na dokončené listy.
  Test Pythonu ověřuje i opakování krátkých výpadků. Kandidát pokrývá 244,5 km²
  otevřené krajiny a s katalogem má 4 851 182 bajtů v 615 blocích. Audit ověřil
  231 751 dvojic pixelů na 979 hranách a nezjistil chybějící ani černé pixely
  v masce otevřené krajiny. Po vizuálním ověření [ze země](../E16/hranice-ze-zeme.jpg)
  a [ze vzduchu](../E16/hranice-ze-vzduchu.jpg) převzal kandidáta sestavovací skript.
  Prošlo 42 testů Node, 23 testů Pythonu, sestavení a osm dotčených
  prohlížečových testů.
- Po dokončení bude potřeba autorova kontrola při přeletu Rokycan a Klabavy
  a měření na telefonu. Další podklady a rozhodnutí zatím nejsou potřeba.
