# Stav etapy E16

Větev `etapa/E16` vychází z revize `7ad3671` na `main`. E15 je sloučená.
Autor potvrdil zahájení E16 a postupné zpracování podkladů pro celou mapu.
[Zadání E16](E16.md) · [Protokol E15](../E15.md)

| Krok | Stav |
| --- | --- |
| 1. Výběr, stahování a evidence listů ČÚZK | Hotovo |
| 2. Převod souřadnic, složení bloků a testy | Zbývá |
| 3. Načtení a vykreslení dvou pilotů | Zbývá |
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
- Po dokončení bude potřeba autorova kontrola při přeletu Rokycan a Klabavy
  a měření na telefonu. Další podklady a rozhodnutí zatím nejsou potřeba.
