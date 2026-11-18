# Stav etapy E18

Větev `etapa/E18` vychází z `974c25b` na `main`, včetně opravy hodin a MHD.
Autor potvrdil zahájení. [Zadání E18](E18.md) · [Protokol E17](../E17.md)

| Krok | Stav |
| --- | --- |
| 1. Načtení Jolt, svět a vrstvy | Hotovo. Pád tělesa, načtení hry i chyba při stažení ověřeny. |
| 2. Pevný krok a interpolace | Hotovo. Ověřeno při 30 i 144 snímcích/s, po delším snímku, v pauze a při přesunutí tělesa. |
| 3. Terén, budovy a zobrazení kolizí | Hotovo |
| 4. Mostovky, Rondel, tunely a uzavírky | Hotovo |
| 5. Auto hráče, ovládání a zvuk | Hotovo. Hra ukládá volbu řízení a zvuk sleduje otáčky motoru. |
| 6. Poškození, garáž, návrat na silnici a uložení | Čeká |
| 7. Měření, ladění a protokol | Čeká |

## Ověření

Prošlo 58 testů JavaScriptu včetně pádu, nárazu a zastavení tělesa na podložce.
Prošlo produkční sestavení. Samostatný soubor Jolt má 3 572,85 kB před kompresí
a 953,32 kB s gzipem. Prošly všechny tři cílené prohlížečové kontroly prvního kroku na Macu, včetně spuštění s WebGL 2 a WebGPU. Prošlo také všech 96 původních scénářů za 33,6 minuty.

Ve druhém kroku prošlo 61 testů JavaScriptu, produkční sestavení a pět cílených
prohlížečových kontrol. Pro tento krok běžel samostatný server nad jeho sestavením.
Výsledky obou běhů jsou v místním adresáři `data-raw/e18/`.
První krok je v revizi `efa2cf2`.

## Rozhodnutí autora

Limit 3 MiB navíc proti E12 se počítá ze skutečně přenesených dat při studeném
startu se zapnutou přenosovou kompresí. Samotný Jolt při místní zkoušce
přenesl 944 375 bajtů. Při zveřejnění ověříme kompresi také na adrese pro telefon.

Ve třetím kroku prošlo 62 testů JavaScriptu, 23 testů Pythonu, sestavení a sedm
cílených prohlížečových kontrol. Paprsky v Jolt ověřily základní, jemný i upravený
terén do 5 cm. Všech 76 740 trojúhelníků střech v 93 dlaždicích se shoduje s daty
města. F8 ukazuje stejnou síť, jakou používá fyzika.
Při studeném startu v nízké kvalitě přenesly hra, základní data a katalogy
o 2 103 364 bajtů (2,01 MiB) více než archiv E12. S dokončenými požadavky na okolí
do zobrazení nabídky to bylo 32 656 336 proti 33 641 355 bajtům v E12. Výběr
detailů závisí na vydání a rychlosti načítání. Odečet lze zopakovat nástrojem
`node tools/measure_startup.mjs adresář-E12 adresář-nového-sestavení`.

Ve čtvrtém kroku první měření našlo tři překryvy při napojení silnic. Na Lobezské
se fyzická plocha odchylovala od osy vozovky až o 17,4 cm. Ve společné ploše nyní
výšku určuje vzdálenost od os připojených silnic se zachováním jejich podélných
profilů. Po opravě prošlo 63 testů JavaScriptu, sestavení a pět dotčených
prohlížečových scénářů. Původní mez 5 cm prošla pro Wilsonův most, Rondel,
upravené mostovky a obě vozovky i stropy Valíku.

## Předání po pátém kroku

Malé auto na suchém asfaltu dosáhlo 100 km/h za 12,8 s a ubrzdilo ze stejné
rychlosti na 43 m. Sporťák potřeboval 5,3 s a 41 m. Ruční brzda udržela auto
na 15% svahu. Při nárazu rychlostí 250 km/h auto zůstalo před 20cm stěnou.
Prošlo 68 testů JavaScriptu, produkční sestavení a sedm cílených prohlížečových
kontrol. Volbu řízení, její uchování a rozjezd ověřily WebGL 2 i WebGPU.

Při opakovaném místním studeném startu přenesly hra, základní data a katalogy
o 2 107 829 bajtů (2,01 MiB) více než E12. Celkem se do zobrazení nabídky
přeneslo 32 660 801 bajtů proti 33 641 355 bajtům v E12 včetně okolí.

Pokračovat krokem 6 podle zadání. Je třeba propojit nárazy s poškozením a
ověřit nastupování, vystupování, návrat na silnici, garáž a obnovení uložené hry.
V kroku 7 zbývá diagnostika, měření v zatáčce a na hraně dlaždic, zkoušky
mostu, tunelů a dopadu, půlhodinová jízda, výkon a úplné testy obou způsobů
simulace. Následuje protokol, README, katalog, kontrola komprese na adrese
pro telefon při zveřejnění a návrh na sloučení do hlavní větve. Žádné otázky
pro autora teď nejsou otevřené.
