# Chodníky u tramvajových kolejí

Herní revize `e012088` navazuje na E52 (výchozí revize `d4aa8f9`). Na Slovanské byla zakreslená vozovka široká 7,2 m a osy kolejí vedly v kontrolovaném úseku asi 4,3 až 5,1 m od osy silnice. Obrubník se odměřoval od okraje vozovky. Chodníky proto zasahovaly do asfaltového pásu kolejí a v obraze tvořily světlé klíny.

Při střetu s tramvajovým pásem se obrubník posune za jeho okraj s rezervou 10 cm. U budov se šířka přizpůsobí zbývajícímu prostoru. U příčného křížení může souvislý obrubník skončit, aby nevznikla překážka v kolejišti. Stejný výpočet používá vykreslení, fyzika obrubníků a pěší navigace. Při hledání výšky pro chodce se posun zohlední také. Vychází se ze stávajících os silnic a kolejí OpenStreetMap (ODbL) a výškopisu ČÚZK (CC BY 4.0). [Zdroje a licence](../README.md#zdroje-a-licence-dat)

## Vyzkoušení ve hře

Na mapě vyhledej Mikulášské náměstí nebo se svez linkou 2 směrem na Světovar. Pohled podél Slovanské směrem k zastávce U Duhy ukáže na obou stranách vozovky souvislý pás mezi kolejnicemi. Světlá plocha chodníku je vedle kolejí.

Snímky vznikly ze stejné kamery na vysokou kvalitu v herní pátek v 7.38. Nabídka na obrazovce byla pro porovnání skrytá. [Před opravou](chodniky-u-koleji/pred.jpg) · [Po opravě](chodniky-u-koleji/po.jpg)

## Ověření

Nová zkouška na Slovanské, Lidické a Skvrňanské kontroluje asfalt pod kolejemi, volný prostor bez plochy chodníku a zachovaný chodník vedle. Na původním sestavení selhala ve všech třech ulicích, protože plocha chodníku stále překrývala tramvajový pás. Prešovská zůstává součástí kontroly vykreslení kolejí v asfaltu.

Prošlo všech 375 jednotkových zkoušek JavaScriptu, produkční sestavení a 56 cílených prohlížečových běhů na WebGL 2 a WebGPU. Ověřeny byly všechny čtyři grafické předvolby, pěší navigace, dotykové ovládání v emulaci telefonu, chodníky u přístřešků, průjezdy po mostech a tunelech i návrat k aktivitě ve Škodalandu.

## Výkon

Měřeno nástrojem `tools/measure_map.mjs --work --paced` v Chromiu 159 přes WebGPU na Apple M4 při 1920 × 1080. Tabulka uvádí 95. percentil v milisekundách. Nízká předvolba je z posledního ze tří srovnání.

| Scéna | Fyzika před → po | Logika před → po | Příprava obrazu před → po | GPU před → po |
| --- | ---: | ---: | ---: | ---: |
| Jízda, nízká | 1,00 → 1,30 | 0,80 → 0,70 | 2,60 → 2,70 | 9,44 → 9,70 |
| Let, nízká | 0,50 → 0,50 | 0,30 → 0,30 | 2,10 → 2,00 | 6,75 → 6,75 |
| Jízda, vysoká | 0,80 → 1,00 | 1,90 → 1,80 | 5,90 → 6,00 | 15,01 → 13,04 |
| Let, vysoká | 0,30 → 0,30 | 0,20 → 0,20 | 2,80 → 2,80 | 12,06 → 16,38 |

U jízdy na nízkou předvolbu překročil čas GPU v prvních dvou bězích po opravě limit 12 ms (12,06 a 12,58 ms). Ve třetím srovnání se v obou verzích vešly do limitu jízda i let. Běhy jízdy končily na různých místech. Vysoká předvolba při letu na východním okraji mapy překročila čas GPU v obou verzích. Na trase letu nejsou tramvajové pásy. Běhy se lišily i počtem načtených geometrií a textur.

Při doplňkovém měření ze stejné pevné kamery na Slovanské se zastavenou simulací měla nízká předvolba v obou verzích 58 vykreslovacích volání a 63 204 trojúhelníků. Medián GPU v obou případech vyšel 6,03 ms. Na vysoké předvolbě přidaly jemnější řezy podél kolejí 7,8 % trojúhelníků (192 839 → 207 789), počet 136 volání se shodoval. Medián GPU v obou opakováních stoupl z 8,06–8,13 na 8,32–8,52 ms. Hodnota 95. percentilu se při obrácení pořadí měření obrátila z 9,70 → 12,91 ms na 13,76 → 9,83 ms.

Místní měření jsou v `data-raw/koleje-slovanska/`.

Na nízkou předvolbu se u Slovanské používá plošný chodník bez zvýšených hran. Na vyšších předvolbách zvýšený chodník končí tam, kde po odsazení zbývá méně než 60 cm do nejbližší stěny.
