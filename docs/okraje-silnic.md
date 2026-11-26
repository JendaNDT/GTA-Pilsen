# Napojení terénu na asfalt

Herní revize `b036d5b` vychází z revize `adcd302` po úpravě chodníků u tramvajových kolejí. Na Karlovarské vystupoval vykreslený terén nad vozovku uprostřed trojúhelníků sítě a v místě napojení dvou dlaždic. Okraj asfaltu proto tvořil světlé klíny. Stejný druh výškového překryvu byl měřitelný v Kaplířově a Zahradní. Oprava používá stávající osy a šířky silnic OpenStreetMap (ODbL), výškopis ČÚZK (CC BY 4.0) a herní profily vozovek. [Zdroje a licence](../README.md#zdroje-a-licence-dat)

Vykreslený terén u vozovky má výškovou rezervu proti rozdílnému tvaru trojúhelníků v asfaltu a zemi. V základních uzlech je dodatečné snížení omezeno na 35 cm. Na společné hranici dlaždic používá hrubá i jemná síť tutéž výšku. Oprava se aplikuje při stavbě vykresleného terénu. Břeh u Wilsonova mostu a ručně upravená místa mají vyhrazenou ochranu.

## Srovnání ve hře

Snímky jsou pořízené na vysokou předvolbu ze stejné kamery na WebGPU. Kladné číslo znamená výšku terénu nad asfaltem, záporné udává, o kolik terén leží pod ním.

| Ulice | Terén vůči asfaltu | Před | Po |
| --- | ---: | --- | --- |
| Karlovarská | +12,7 → −15,0 cm | [Před](okraje-silnic/karlovarska-pred.jpg) | [Po](okraje-silnic/karlovarska-po.jpg) |
| Kaplířova | +11,6 → −4,4 cm | [Před](okraje-silnic/kaplirova-pred.jpg) | [Po](okraje-silnic/kaplirova-po.jpg) |
| Zahradní | +9,9 → −3,6 cm | [Před](okraje-silnic/zahradni-pred.jpg) | [Po](okraje-silnic/zahradni-po.jpg) |

V místním náhledu vyzkoušej Karlovarskou kolem bodu 49,75668° s. š., 13,37401° v. d. Z výšky řidiče sleduj pravý okraj vozovky u červené pěší cesty.

Při průzkumu čtyř částí Plzně bylo před opravou nad asfaltem o více než 1,8 cm celkem 127 ze 40 009 vzorků u okrajů, z toho 34 o více než 5 cm. Po opravě bylo v každém z obou vykreslovačů zkontrolováno 39 998 vzorků. Nad mezí 1,8 cm byl výsledek v obou nulový. Jde o měřený výběr z načtených oblastí. Na nízkou předvolbu ve WebGL 2 ležel terén ve třech referenčních bodech také pod asfaltem, o 15,0 cm, 4,4 cm a 2,2 cm.

Nové prohlížečové zkoušky na původní verzi zachytily přesah terénu ve všech třech ulicích. Na opravené verzi prošly na WebGL 2 i WebGPU, včetně kontroly společné hranice dlaždic na Karlovarské.

## Kontroly světlometů a terénu

Revize prohlížečových zkoušek je `b3850b8`.

- Test nočních světlometů Fabie měří skutečnou plochu světla uvnitř čočky. Na každé straně dál vyžaduje jas nad 190 z 255 a rozdíl přes 160 bodů proti snímku téže čočky po ztlumení. Původní vzorek zasahoval na lem.
- Na střední předvolbě test ověřuje sdílená čísla vrcholů a vlastní grafický atribut každé dlaždice. Na nízké ověřuje i vlastní datové pole, do kterého dlaždice při otáčení kamery vybírá viditelné trojúhelníky. Zkouška v Node navíc kontroluje jejich pořadí a návrat do záběru.

Prošlo produkční sestavení, všech 377 zkoušek JavaScriptu a všech 95 cílených prohlížečových běhů v Chromiu na WebGL 2 a WebGPU. Sada zahrnuje i předchozí opravu kolejí, rozpočty všech čtyř předvoleb, denní a noční vykreslení, vodu, stíny, podjezdy a jízdní zkoušky na mostě a v tunelu.

## Výkon

Srovnání nástrojem `tools/measure_map.mjs --work --paced` na Macu s Apple M4, v Chromiu 159 na WebGPU při 1920 × 1080. Nízká předvolba při jízdě i letu splnila všechny čtyři rozpočty. Hodnoty jsou 95. percentil v milisekundách.

| Scéna | Fyzika před → po | Logika před → po | Příprava obrazu před → po | GPU před → po |
| --- | ---: | ---: | ---: | ---: |
| Jízda | 1,50 → 1,10 | 0,70 → 0,80 | 2,50 → 2,50 | 9,96 → 9,63 |
| Let | 0,50 → 0,60 | 0,30 → 0,30 | 2,20 → 2,20 | 7,67 → 7,93 |

Medián tří studených startů hry se zvýšil z 5,10 na 5,43 s při dodatečném výpočtu výšek hran. Při jízdě skončily běhy v různých bodech a počty se pohybovaly od 140 do 148 vykreslovacích volání a od 206 569 do 212 381 trojúhelníků. Při letu se shodovalo 55 volání i 145 496 trojúhelníků. Odchylka fyziky při letu a logiky za jízdy byla v obou případech 0,10 ms, což odpovídá jednomu kroku rozlišení záznamu. Místní záznamy jsou v `data-raw/graficke-zavady/`.
