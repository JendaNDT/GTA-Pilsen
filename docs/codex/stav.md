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
| 6. Poškození, garáž, návrat na silnici a uložení | Hotovo |
| 7. Měření, ladění a protokol | Jízdní zkoušky dokončené, čeká se na úplné ověření a PR. |

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

Při předání po kroku 5 bylo třeba pokračovat krokem 6. Je třeba propojit nárazy s poškozením a
ověřit nastupování, vystupování, návrat na silnici, garáž a obnovení uložené hry.
V kroku 7 zbývá diagnostika, měření v zatáčce a na hraně dlaždic, zkoušky
mostu, tunelů a dopadu, půlhodinová jízda, výkon a úplné testy obou způsobů
simulace. Následuje protokol, README, katalog, kontrola komprese na adrese
pro telefon při zveřejnění a návrh na sloučení do hlavní větve. Žádné otázky
pro autora teď nejsou otevřené.

## Šestý krok

Po fyzikálním kroku hra zpracuje nejsilnější kontakt hráčova auta. Lehký dotyk
při 2 m/s nezpůsobil škodu, náraz do stěny při 15 m/s snížil stav karoserie.
Po návratu na silnici se zastaví i otáčení kol. Hra uložená za volantem se
obnoví ve stojícím autě, u vlastního vozu také se stavem a úpravami z garáže.
Starší pozice se otevře pěšky jako dosud.

Prošlo 69 testů JavaScriptu, produkční sestavení a čtyři dotčené prohlížečové
scénáře včetně garáže, staré pozice a obnovení auta po návratu na silnici.
Zbývá sedmý krok a jeho úplné přejímací zkoušky.

## Sedmý krok – rozhodnutí o lávce v ulici U Prazdroje

První automatická jízda nové fyziky po trase E12 z Plzně přes Klabavu směrem
na Rokycany skončila po 754 metrech v ulici U Prazdroje. Zkouška jela bez
ostatních vozidel. U souřadnic x = 657 m, z = 162 m má vozovka č. 14422 výšku
−3,29 m a pěší lávka č. 32249 v témže místě −2,94 m. Mezi jejich horními
plochami je jen 35 cm. Přední kola zůstala v kontaktu, bok mostovky zastavil
karoserii. Ověřeno průjezdem a odečtem trojúhelníků z kolizní sítě. Jde
o hodnoty v herní mapě. Skutečnou světlou výšku zatím nemáme ověřenou.

Kalibrace lávek podle měření patří podle plánu do E22. Autor má rozhodnout,
zda přesunout ověření a místní opravu této jedné lávky do E18. Do té doby
se profil nemění. Půlhodinová jízda zůstává nesplněná. Místní reprodukce
a odečty jsou v `data-raw/e18/krok7/route.mjs`, `route.log` a `steny.log`.
V pracovní kopii je rozpracovaný panel fyziky, test jízdy na kruhu a volba
simulace pro prohlížečové testy. První úplný prohlížečový běh nové fyziky
zapisuje do `data-raw/e18/krok7/new.log`. Před dalším během ověřit jeho výsledek.

## Oprava povolená autorem v E18

Městský archiv 430 má SHA-256 `825dc3e395044b1f5a47e27c812cc4189829e9134cc027865ffc8fcb3e7bb9ac`.
Lávce U Prazdroje odpovídá objekt `00000002023003269`. Středy protilehlých hran horní
plochy dávají profil přes obě vozovky a po zakřivené rampě. V bodě (657, 162)
má vršek 316,615 m Bpv a spodní plocha 315,96 m Bpv. Herní vozovka pod
lávkou má 309,91 m Bpv. Opravená lávka používá stejný profil pro vykreslení,
dotazy na výšku i fyziku. Místní zkouška v obou směrech zachovala 100 % stavu
auta. Kontrola horní i spodní plochy ve fyzice prošla s tolerancí 5 cm.
[Podklady města](https://opendata.plzen.eu/public/opendata/detail/37) ·
[Snímek před opravou](../E18/lavka-pred.jpg) · [Snímek po opravě](../E18/lavka-po.jpg)

Na trase E12 s novou fyzikou dojelo auto v první souvislé půlhodině z Plzně přes
Klabavu do Rokycan (19,02 km). Největší zanoření spodního referenčního bodu
auta vůči jízdní ploše bylo 0,162 m. Zkouška používá fyzikální kroky po 1/60 s,
bez přemístění auta. Všechny dotčené testy JavaScriptu a sestavení prošly.
Sedmý krok pokračuje zbývajícími jízdními zkouškami, měřením a úplnými sadami.

## Závěrečné ověření

Zkušební auto dojelo z Plzně k hamru v Dobřívě (29,78 km) a zpět (29,80 km).
Každý směr trval přes 50 minut simulované jízdy. Prošly výšky kontaktů kol
na Wilsonově mostě do 5 cm, průjezdy Valíkem, skok, dopad a zkouška na
hraně dlaždic. V obou způsobech řízení prošlo také uložení a návrat na
obsazenou silnici s výběrem volného místa. Prošlo 71 testů JavaScriptu,
23 testů Pythonu a produkční sestavení. Pracovní protokol je v [E18](../E18.md).
Na telefonu je ke zkoušce dostupná oprava lávky, veřejný přenos Jolt i střech
má potvrzenou kompresi gzip.

Obě kompletní sady po poslední opravě běží nad sestavením na portu 4194.
Každá obsahuje 110 prohlížečových zkoušek. Výsledky sledovat v místních
`data-raw/e18/krok7/final-new.log` a `data-raw/e18/krok7/final-old.log`.
Na GitHubu je větev s ověřovanou revizí `1d58c88` a [rozpracovaný návrh na sloučení E18](https://github.com/JendaNDT/GTA-Pilsen/pull/11).
Po dokončení obou sad zapsat výsledky, uzavřít protokol a předat návrh ke kontrole.
