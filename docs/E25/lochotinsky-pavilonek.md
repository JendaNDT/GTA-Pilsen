# Lochotínský pavilonek

Úprava navazuje na revizi `ce112c7` se Západočeským muzeem. Pavilonek stojí v Lochotínském parku nad cestou Nad ZOO. Vyšší střed má na obou dlouhých průčelích pět os, bílé okenice s půlkruhovými světlíky a pod okapem římsu s konzolami. Na nižších křídlech jsou zavřené okenice a oddělené světlíky. Z jižní strany je vidět terasa se čtyřmi vodorovnými dřevěnými příčkami.

| Pohled | Původní herní model | Nový herní model |
| --- | --- | --- |
| Z cesty k terase | [Před](lochotinsky-pavilonek/terasa-pred.jpg) | [Po](lochotinsky-pavilonek/terasa-po.jpg) |
| Šikmo od parku | [Před](lochotinsky-pavilonek/park-pred.jpg) | [Po](lochotinsky-pavilonek/park-po.jpg) |
| Detail okenic a světlíků | [Před](lochotinsky-pavilonek/okenice-pred.jpg) | [Po](lochotinsky-pavilonek/okenice-po.jpg) |

## Podklady a přesnost

Poloha, délka přibližně 38 m, natočení průčelí a ustoupení křídel vycházejí z pojmenovaného půdorysu v distribuovaných datech hry. [OpenStreetMap, objekt 109759707](https://www.openstreetmap.org/way/109759707)

Výšky, členění oken, odstíny omítky a plechu i polohu terasy jsme odhadli podle čtyř dodaných fotografií. Krajní boky jsou zjednodušené. Používáme vlastní kresbu v jedné textuře. Výšku založení určuje terén hry. Původní dům lze zobrazit parametrem `?pavilonek=puvodni`. [Zdroje a licence](../../README.md#zdroje-a-licence-dat)

## Ověření

Prošlo všech 289 testů JavaScriptu i produkční sestavení. Testy spojují výšky střech a terasy s kolizními plochami pro postavu, kameru a vozidla. Při výměně se změní jen budova se shodnou polohou a českým názvem.

| Pevná kamera ve vysoké kvalitě včetně stínů | Volání před → po | Trojúhelníky před → po |
| --- | ---: | ---: |
| Od terasy | 279 → 287 | 438 110 → 447 178 |
| Od parku | 319 → 325 | 375 455 → 382 256 |

Pavilonek využívá jednu novou texturu. Dřevěné ohrazení je za běžného stavu jedna společná síť. Jednotlivá pole se oddělují při poškození stejně jako ostatní rozbitné vybavení hry.

V celé sadě prošlo 404 ze 406 prohlížečových zkoušek. WebGL 2 i WebGPU v dotykové emulaci 844 × 390 na nízké kvalitě ověřily různé výšky střech, načtení po návratu a zachování poškozeného pole zábradlí až do herní opravy. Na obou vykreslovačích selhala již dříve známá kontrola kontrastu nočních oken na náměstí Republiky. Fyzický telefon jsme v této úpravě nezkoušeli.

Při chůzi kolmo k zábradlí zevnitř terasy se střed postavy zastavil 0,44 m od ohrazení. Výška chodidel souhlasila s horní plochou terasy na méně než jeden milimetr.

Srovnávací jízda a let nástrojem `tools/measure_map.mjs --work --center-flight` měřily čas práce na snímku na Apple M4 ve WebGL 2, při 1920 × 1080, nízké kvalitě a dohledu 340 m. Tabulka uvádí 95. percentil pro standardní desetisekundové trasy přes centrum. Blízké pohledy přímo na pavilonek jsou změřené v tabulce výše.

| Trasa | CPU před | CPU po | GPU před | GPU po |
| --- | ---: | ---: | ---: | ---: |
| Jízda centrem | 4,10 ms | 4,30 ms | 10,09 ms | 8,84 ms |
| Let nad centrem | 3,90 ms | 3,80 ms | 4,91 ms | 4,96 ms |
