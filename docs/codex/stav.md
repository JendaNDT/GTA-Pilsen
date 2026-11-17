# Stav etapy E16

Větev `etapa/E16` vychází z revize `7ad3671` na `main`. E15 je sloučená.
Autor potvrdil zahájení E16 a postupné zpracování podkladů pro celou mapu.
[Zadání E16](E16.md) · [Protokol E15](../E15.md)

| Krok | Stav |
| --- | --- |
| 1. Výběr, stahování a evidence listů ČÚZK | Hotovo · `4fb1104` |
| 2. Převod souřadnic, složení bloků a testy | Hotovo · `1c434fc` |
| 3. Načtení a vykreslení dvou pilotů | Hotovo |
| 4. Srovnávací snímky a vyladění barev | Zbývá |
| 5. Sestavení celého území a ověření velikosti a švů | Zbývá |
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
- Po dokončení bude potřeba autorova kontrola při přeletu Rokycan a Klabavy
  a měření na telefonu. Další podklady a rozhodnutí zatím nejsou potřeba.
