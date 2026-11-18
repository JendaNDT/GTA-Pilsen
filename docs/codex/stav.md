# Stav etapy E18

Větev `etapa/E18` vychází z `974c25b` na `main`, včetně opravy hodin a MHD.
Autor potvrdil zahájení. [Zadání E18](E18.md) · [Protokol E17](../E17.md)

| Krok | Stav |
| --- | --- |
| 1. Načtení Jolt, svět a vrstvy | Hotovo. Pád tělesa, načtení hry i chyba při stažení ověřeny. |
| 2. Pevný krok a interpolace | Hotovo. Ověřeno při 30 i 144 snímcích/s, po delším snímku, v pauze a při přesunutí tělesa. |
| 3. Terén, budovy a zobrazení kolizí | Čeká |
| 4. Mostovky, Rondel, tunely a uzavírky | Čeká |
| 5. Auto hráče, ovládání a zvuk | Čeká |
| 6. Poškození, garáž, návrat na silnici a uložení | Čeká |
| 7. Měření, ladění a protokol | Čeká |

## Ověření

Prošlo 58 testů JavaScriptu včetně pádu, nárazu a zastavení tělesa na podložce.
Prošlo produkční sestavení. Samostatný soubor Jolt má 3 572,85 kB před kompresí
a 953,32 kB s gzipem. Prošly všechny tři cílené prohlížečové kontroly prvního kroku na Macu, včetně spuštění s WebGL 2 a WebGPU. Běží také původních 96 scénářů.

Ve druhém kroku prošlo 61 testů JavaScriptu, produkční sestavení a pět cílených
prohlížečových kontrol. Pro tento krok běžel samostatný server nad jeho sestavením.
Výsledky obou běhů jsou v místním adresáři `data-raw/e18/`.
První krok je v revizi `efa2cf2`.

## Otevřená otázka

Plán omezuje nárůst povinných dat při startu na 3 MiB proti E12. Neurčuje,
zda se velikost počítá před přenosovou kompresí, nebo po ní. Při HTTP GET
produkčního souboru Jolt v místním náhledu se přeneslo 944 375 bajtů s gzipem
a 3 572 852 bajtů bez komprese. Jde pouze o knihovnu. Celkový rozdíl proti E12
se má změřit stejným způsobem. Autor dostal otázku před zahájením stavby kolizí.
