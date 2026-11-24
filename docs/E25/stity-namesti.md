# Domy na třech dalších stranách náměstí Republiky

Výchozí revize `92c5bbe` obsahovala radnici a šest domů na severní straně. Tato úprava doplňuje průčelí všech 33 domů obrácených do zbývajících tří stran náměstí.

| Strana | Orientační čísla | Podle čeho se ve hře zorientovat |
| --- | --- | --- |
| Východní | 6–15 | Podél řady se střídají rovné římsy, dvojitý stupňovitý štít č. 12, úzký Chotěšovský dům č. 13 a mansarda sousedního domu. |
| Jižní | 16–25 | Uprostřed řady stojí úzké domy s křivkovými štíty. Na západním konci sousedí tmavé pásy oken č. 22 s členěným štítem Muzea loutek č. 23. |
| Západní | 26–33, 35–39 | U č. 27 jsou na fasádě rostlinné motivy. Hotel Central člení svislé sloupky, sousední biskupství má dvojitý štít. Dům U Červeného srdce má na průčelí stylizované jezdce. |

Číslo 14a je uvnitř bloku a č. 34 netvoří další samostatné průčelí do náměstí. Orientační čísla vycházejí z [adresního přehledu v Encyklopedii dějin města Plzně](https://encyklopedie.plzen.eu/home-mup/?acc=profil-ulice&load=20). Motivy průčelí jsme porovnali také s [městským přehledem Alšových výzdob](https://plzen.eu/o-meste/aktuality/aktuality-z-mesta/vyroci-narozeni-vyznamneho-ceskeho-malire-mikolase-alse-si-plzen-pripomina-venkovni-vystavou-jeho-sgrafitovych-a-freskovych-vyzdob-fasad/) a [heslem o domu U Červeného srdce](https://encyklopedie.plzen.eu/home-mup/?acc=profil-domu&load=14).

## Porovnání ve hře

Ze středu náměstí se otoč směrem k vybrané řadě. Pro srovnání původních městských domů otevři stejnou hru s parametrem `?stity=puvodni`.

| Pohled | Výchozí verze | Po úpravě |
| --- | --- | --- |
| Východní řada od severu | [Před](stity-namesti/vychod-sever-pred.jpg) | [Po](stity-namesti/vychod-sever-po.jpg) |
| Východní řada u Chotěšovského domu | [Před](stity-namesti/vychod-jih-pred.jpg) | [Po](stity-namesti/vychod-jih-po.jpg) |
| Jižní řada od východu | [Před](stity-namesti/jih-vychod-pred.jpg) | [Po](stity-namesti/jih-vychod-po.jpg) |
| Jižní řada u Muzea loutek | [Před](stity-namesti/jih-zapad-pred.jpg) | [Po](stity-namesti/jih-zapad-po.jpg) |
| Západní řada od jihu | [Před](stity-namesti/zapad-jih-pred.jpg) | [Po](stity-namesti/zapad-jih-po.jpg) |
| Západní řada u biskupství | [Před](stity-namesti/zapad-sever-pred.jpg) | [Po](stity-namesti/zapad-sever-po.jpg) |

## Podklady a provedení

Polohu, šířku a základní výšky určují stávající [městské 3D listy](https://opendata.plzen.eu/public/opendata/detail/37). Adresy byly přiřazeny i podle dat přispěvatelů OpenStreetMap (ODbL). Pro každé průčelí je zapsaný vlastní počet okenních os a podlaží, barvy, tvar štítu, střešní hrana a rozsah zaměřených ploch. Návrat na náměstí načítá podklady po dlaždicích. Otisk souboru chrání před záměnou ploch při budoucí změně zaměření.

Kresba ploch, tvarované římsy a ornamenty jsou vlastní tvorba projektu. Fotografie z Wikimedia Commons sloužily jako obrazové reference. Tvary, barvy, výlohy a drobná výzdoba jsou stylizované podle fotografií z různých let. Zadní trakty a strany nárožních domů do vedlejších ulic používají městský model. V nízké kvalitě siluetu určuje neprůhledná část kresby, ve vyšší kvalitě má štít také vymodelovanou hranu římsy.

- Honza Groh (Jagro), CC BY-SA 3.0. [Jih](https://commons.wikimedia.org/wiki/File:Plze%C5%88,_n%C3%A1m%C4%9Bst%C3%AD_Republiky,_jih.jpg) · [Jihovýchod](https://commons.wikimedia.org/wiki/File:Plze%C5%88,_n%C3%A1m%C4%9Bst%C3%AD_Republiky,_jihov%C3%BDchod.jpg) · [Jihozápad](https://commons.wikimedia.org/wiki/File:Plze%C5%88,_n%C3%A1m%C4%9Bst%C3%AD_Republiky,_jihoz%C3%A1pad.jpg) · [Západní část](https://commons.wikimedia.org/wiki/File:Plze%C5%88,_n%C3%A1m%C4%9Bst%C3%AD_Republiky,_z%C3%A1padn%C3%AD_%C4%8D%C3%A1st.jpg) · [Severo-západní část](https://commons.wikimedia.org/wiki/File:Plze%C5%88,_n%C3%A1m%C4%9Bst%C3%AD_Republiky,_severo-z%C3%A1padn%C3%AD_%C4%8D%C3%A1st.jpg)
- Txllxt TxllxT, CC BY-SA 4.0. [Panorama 01](https://commons.wikimedia.org/wiki/File:Plze%C5%88_-_N%C3%A1m%C4%9Bst%C3%AD_Republiky_-_Panorama_View_360%C2%B0_01.jpg) · [Panorama 03](https://commons.wikimedia.org/wiki/File:Plze%C5%88_-_N%C3%A1m%C4%9Bst%C3%AD_Republiky_-_Panorama_View_360%C2%B0_03.jpg) · [Panorama 07](https://commons.wikimedia.org/wiki/File:Plze%C5%88_-_N%C3%A1m%C4%9Bst%C3%AD_Republiky_-_Panorama_View_360%C2%B0_07.jpg) · [Panorama 09](https://commons.wikimedia.org/wiki/File:Plze%C5%88_-_N%C3%A1m%C4%9Bst%C3%AD_Republiky_-_Panorama_View_360%C2%B0_09.jpg)

## Kontrola ve hře

Stejné kamery, denní světlo a vysoká kvalita včetně stínů. Počty zahrnují celou scénu v daném pohledu.

| Pohled | Volání před → po | Trojúhelníky před → po |
| --- | ---: | ---: |
| Východní řada od severu | 486 → 494 | 1 055 264 → 1 065 052 |
| Východní řada od jihu | 498 → 506 | 1 105 501 → 1 116 413 |
| Jižní řada od východu | 492 → 500 | 1 256 328 → 1 266 020 |
| Jižní řada od západu | 509 → 518 | 1 306 456 → 1 316 615 |
| Západní řada od jihu | 489 → 497 | 1 078 247 → 1 089 108 |
| Západní řada od severu | 490 → 498 | 945 621 → 958 098 |

Testy načetly původní binární soubory všech čtyř městských listů a prověřily plochy všech adres, pokrytí přízemí, přepnutí úrovně podrobnosti a zachování kolizních střech. Při odchodu se ze scény uvolnily všechny čtyři modely s texturami. Po návratu se v dotykové emulaci znovu zobrazilo všech 33 domů ve WebGL 2 i ve WebGPU. Fyzický telefon se nezkoušel.

V nízké kvalitě u Muzea loutek připadalo na upravenou scénu 141 volání a 386 448 trojúhelníků. Se zapnutým původním vzhledem hra na témže místě vykreslila 139 volání a 386 525 trojúhelníků. Samostatná kontrola podle pevného výkonnostního rozpočtu na náměstí prošla na obou vykreslovačích.

Noční obrazový test po změně rozmístění oken vzorkuje rozsvícené a sousední zhasnuté okno téhož patra západní řady. Původní velikost obou výřezů i požadovaný rozdíl jasu a barev zůstaly stejné. Aktualizovaná zkouška prošla na obou vykreslovačích.

Prošlo 299 testů JavaScriptu, produkční sestavení a 27 zkoušek Pythonu. Jednu zkoušku vynechal chybějící úplný archiv zdrojových dat. V souhrnném běhu prošlo 410 ze 412 prohlížečových zkoušek. Ve WebGL 2 selhalo staré umístění bodů nočního testu a zkouška ranní dopravy na Klatovské. Na aktualizovaných bodech test nočních oken prošel ve WebGL 2 i ve WebGPU. Jeden opakovaný souběžný běh WebGL 2 vyčerpal časový limit, při dalším ověření prošel. Dopravní zkouška při samostatném opakování také prošla.

## Měření výkonu

Nástroj `tools/measure_map.mjs --work --center-flight` měřil na Apple M4 ve WebGL 2 při 1920 × 1080, nízké kvalitě a dohledu 340 m. Každá verze absolvovala tři průjezdy a tři přelety. Tabulka uvádí medián ze tří naměřených 95. percentilů skutečné práce snímku v milisekundách.

| Trasa | CPU před | CPU po | GPU před | GPU po |
| --- | ---: | ---: | ---: | ---: |
| Jízda centrem | 4,60 | 5,00 | 9,31 | 8,74 |
| Přelet centra | 5,00 | 4,40 | 9,37 | 8,96 |
