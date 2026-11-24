# Tři kašny na náměstí Republiky

Úprava navazuje na revizi `65aaebd`. Na severovýchodě náměstí stojí Anděl se dvěma výtoky, na jihozápadě Chrtice s obloukovým krkem a na jihovýchodě Velbloud s dlouhým hranatým chrličem. Západně od katedrální věže stojí morový sloup.

| Kašna | Výška | Nádrž | Stejný pohled před změnou a po ní |
| --- | ---: | --- | --- |
| Anděl | 4,9 m | Dvě kruhové mísy o průměru 2,8 m | [Před](kasny/andel-pred.jpg) · [Po](kasny/andel-po.jpg) |
| Chrtice | 3,7 m | Oválná mísa dlouhá 4,2 m | [Před](kasny/chrtice-pred.jpg) · [Po](kasny/chrtice-po.jpg) |
| Velbloud | 4,1 m | Čtvercová nádrž o straně 4,9 m | [Před](kasny/velbloud-pred.jpg) · [Po](kasny/velbloud-po.jpg) |

## Podklady a přesnost

Autorem skutečných kašen je Ondřej Císler. Rozměry vycházejí z popisu ateliéru. Polohu všech čtyř nádrží určují mapové obrysy. Směry proudů odpovídají ortofotu. Profily litých chrličů, výšku okrajů a odstíny zlata i kamene jsme odhadli podle dodaných fotografií. Model, materiály a kresba vody jsou vlastní tvorba projektu. [Aoc architekti](https://aoc.archi/cs/projekt/20/tri-kasny-pro-namesti-republiky-v-plzni/description) · [Anděl v OSM](https://www.openstreetmap.org/node/1120205100) · [Chrtice v OSM](https://www.openstreetmap.org/way/1103553484) · [Velbloud v OSM](https://www.openstreetmap.org/way/362663331) · [Ortofoto ČÚZK](https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO/MapServer)

Voda dopadá obloukem na hladinu v míse. Pro ověření lze přidat do adresy `?kasny=bez-proudu`, který vypne proudy a čeření hladiny. Původní podobu náměstí zobrazí `?kasny=puvodni`.

## Ověření

Prošlo 292 testů JavaScriptu a produkční sestavení hry. Test s dotykovou obrazovkou na nízké kvalitě ve WebGL 2 i WebGPU ověřil přítomnost všech tří kašen, nahrazení čtyř mapových vodních ploch, zastavení postavy před chrličem a správné načtení po odjezdu a návratu. Testy geometrie ověřily také průchod mezi nohama Velblouda a místo dopadu každého ze čtyř proudů. Dotyk byl zkoušen v emulaci. Samostatná kontrola v prohlížeči ověřila také přepnutí mezi tekoucí vodou, stojatou hladinou a původním náměstím.

Nad 100 m se na nízké kvalitě používá pohled na kašnu vytvořený ze stejného modelu pro směr a výšku kamery. Pevný pohled na náměstí se i na nízké kvalitě vešel do stávajícího rozpočtu pro obě grafická rozhraní.

Měření času práce na snímku na Apple M4 ve WebGL 2, 1920 × 1080, nízká kvalita, dohled 340 m. Tabulka uvádí 95. percentil ze srovnávací jízdy a letu nástrojem `tools/measure_map.mjs --work --center-flight`. Časy GPU kolísají mezi běhy.

| Trasa | CPU před | CPU po | GPU před | GPU po |
| --- | ---: | ---: | ---: | ---: |
| Jízda centrem | 4,10 ms | 4,30 ms | 12,41 ms | 6,72 ms |
| Let nad centrem | 3,70 ms | 3,70 ms | 6,01 ms | 5,02 ms |

Ve společném běhu prošlo 405 ze 408 prohlížečových zkoušek. Na obou vykreslovačích se zopakovalo známé selhání kontroly nočních oken na náměstí. Ve WebGL 2 při ranní špičce jedno auto na Klatovské čekalo 134,5 s oproti limitu 120 s. Stejná zkouška v samostatném běhu prošla na původní revizi (63,5 s) i na verzi s kašnami (75,5 s).
