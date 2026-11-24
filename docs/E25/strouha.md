# Od Západočeského muzea k Mlýnské strouze

Rozšíření sadového okruhu na větvi `codex/sady-ke-strouze` vychází z revize `37862d6`. Od fontány před Západočeským muzeem pokračuj Šafaříkovými sady kolem Spejbla a Hurvínka a Havlovy lavičky. V Křižíkových sadech projdeš kolem Proluky a Křižíkovy busty. Za Pražskou ulicí sestup k vodě, přejdi dřevěnou lávku a vyjdi na trávník ke třem barevným hlavám.

## Krajina a průchodnost

K původní části přibylo deset ploch zeleně, 36 úseků pěšin a prostranství, sedm květinových záhonů a 56 laviček. Lavičky, nové sochy, opěrné zdi, terasa, lávka a břehové rostliny mají prostorovou geometrii. Devět ploch mokřadů určuje, kde se na břehu objeví orobinec a další rostliny. Při pohledu z vrtulníku jsou vidět obrys jezírka, pěšiny na obou březích i stromořadí.

Lávka dlouhá přibližně patnáct metrů má pochozí nájezdy a dvě zábradlí. Původní vodní plocha nadále určuje, kde hráč plave. Sochařské detaily, výška zdí, skladba záhonů a barevnost hlav jsou výtvarné odhady. U Pražského mostu je vymodelované kamenné průčelí obrácené k jezírku. Barevné hlavy mají otvory a otevřenou zadní stranu. Zvukovou instalaci hra nesimuluje.

## Srovnání ve hře

| Místo | Před | Po |
| --- | --- | --- |
| Spejbl a Hurvínek | [Před úpravou](strouha/loutky-pred.jpg) | [Sousoší v parku](strouha/loutky-po.jpg) |
| Křižíkovy sady | [Před úpravou](strouha/krizik-pred.jpg) | [Busta a cesta](strouha/krizik-po.jpg) |
| Mlýnská strouha | [Před úpravou](strouha/jezirko-pred.jpg) | [Terasa a rostliny ve vodě](strouha/jezirko-po.jpg) |
| Pohled k Pražskému mostu | [Před úpravou](strouha/oblouk-pred.jpg) | [Kamenný oblouk](strouha/oblouk-po.jpg) |
| Přechod mezi břehy | [Před úpravou](strouha/lavka-pred.jpg) | [Pochozí lávka](strouha/lavka-po.jpg) |
| Trávník za jezírkem | [Před úpravou](strouha/hlavy-pred.jpg) | [Detail jedné z hlav](strouha/hlavy-po.jpg) |
| Nízký přelet nad jezírkem | [Před úpravou](strouha/nad-jezirkem-pred.jpg) | [Oba břehy, terasa a lávka](strouha/nad-jezirkem-po.jpg) |
| Od Strouhy směrem k muzeu | [Před úpravou](strouha/prelet-pred.jpg) | [Pohled z vrtulníku](strouha/prelet-po.jpg) |

Obě verze byly snímané ve stejné denní době ze stejných kamer. Zkouška v prohlížeči projde lávku řízením postavy, zkontroluje vodu mimo lávku, odletí z oblasti a ověří, že se prvky po návratu opět načetly. Pomocný svět v jednotkovém testu nyní zahrnuje také dlaždice severně od počátku souřadnic.

## Podklady

- Půdorysy parku, lávka, terasa, mokřady a polohy laviček vycházejí z dat přispěvatelů OpenStreetMap (ODbL). K ověření rozložení posloužilo ortofoto ČÚZK (CC BY 4.0). [OpenStreetMap](https://www.openstreetmap.org/copyright) · [Ortofoto ČÚZK](https://ags.cuzk.gov.cz/arcgis1/services/ORTOFOTO/MapServer/WMSServer)
- Průběh sadového okruhu a úpravu okolí vody popisují městské zdroje. [Sadový okruh](https://encyklopedie.plzen.eu/home-mup/?acc=profil-domu&load=311) · [Správa veřejného statku – obnova Mlýnské strouhy](https://svsmp.cz/archiv/2009/mlynska-strouha/) · [Visit Plzeň – Mlýnská strouha](https://www.visitplzen.eu/poznej-plzen/historicke-centrum/mlynska-strouha/)
- Vlastní zjednodušené modely sousoší, lavičky a trojice hlav vycházejí z veřejných pohledů na tato díla. Fotografie nejsou součástí hry. [Spejbl a Hurvínek](https://krizkyavetrelci.plzne.cz/katalog/dilo/267/) · [Lavička Václava Havla](https://plzen.eu/o-meste/aktuality/aktuality-z-mesta/predstavitele-mesta-plzne-pripomneli-dvanacte-vyroci-umrti-vaclava-havla/) · [Tři sochy Terezy Damcové](https://plzen.eu/o-meste/aktuality/aktuality-z-mesta/interaktivni-sochy-v-mlynske-strouze-prochazi-obnovou/)
- Výběr břehových a vodních rostlin vychází z popisu údržby jezírka. [Čištění Mlýnské strouhy](https://plzen.eu/o-meste/aktuality/aktuality-z-mesta/zacina-cisteni-mlynske-strouhy/)

## Výkon

Na celkovém leteckém snímku při vysoké předvolbě měla původní hra 586 vykreslovacích volání a 1 018 947 trojúhelníků. Po rozšíření jich bylo 584 a 1 004 955. První verze kreslila z velké vzdálenosti i detaily soch a laviček a na referenčním náměstí překročila rozpočet tří předvoleb. Konečná verze přestává drobné prvky kreslit podle jejich velikosti a vzdálenosti od kamery. Lávka, zdi a terasa zůstávají vidět z větší dálky než jednotlivé oči soch nebo stébla orobince. Na WebGL 2 i WebGPU se pak všechny čtyři předvolby vešly do původních rozpočtů. Na snímku z lávky vzrostl počet volání z 545 na 556 a počet trojúhelníků z 911 463 na 927 505.

### Měření jízdy a přeletu

Běžná herní smyčka v Chromiu na Macu byla měřena ve Full HD na nízkou předvolbu s WebGL 2. Při každém průchodu auto ujelo 39 až 43 m poblíž Pražské a vrtulník přeletěl 208 až 232 m od sadů k jezírku. Před změnou i po ní proběhly dvě desetisekundové jízdy a dva přelety, v pořadí verzí původní, nová, nová, původní. Použitý místní nástroj vychází z `tools/measure_map.mjs` se změněným výchozím místem a směrem letu.

| Pohled | Práce snímku před (ms) | Práce snímku po (ms) | GPU před (ms) | GPU po (ms) |
| --- | ---: | ---: | ---: | ---: |
| Jízda poblíž Pražské | 5,4–5,7 | 5,3–5,7 | 11,32–12,11 | 8,25–10,86 |
| Přelet k jezírku | 5,1–5,6 | 5,5–5,9 | 10,71–10,97 | 7,72–9,25 |

Tabulka uvádí rozpětí 95. percentilů mezi dvěma průchody. Na měřeném stroji byly oba přelety nové verze pod cílem 12 ms na GPU. Průměr obou 95. percentilů práce snímku při letu vzrostl o 6,5 %.

## Výsledky kontrol

Prošlo 306 testů JavaScriptu a produkční sestavení. Ve společném běhu prošlo 413 ze 418 prohlížečových zkoušek. Tři původně neúspěšné kontroly se týkaly rozpočtu vykreslení na náměstí. Po úpravě dohledu na finálním sestavení prošlo všech osm kombinací předvolby a vykreslovače i oba testy průchodu přes Strouhu. Dvě zbývající zkoušky ranní špičky na Klatovské prošly při následném opakování na WebGL 2 i WebGPU. Limity testů se neměnily.
