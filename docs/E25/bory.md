# Historická budova věznice Bory

Větev vychází z revize `e3c2ec1`. Podle současné obdélníkové uliční fasády vznikly okrové okenní rámy, římsy a nápis BORY. Vyšší historický dům má střední pavilon s obloukovými okny. Z vrtulníku lze rozeznat sedm dlouhých křídel kolem tamburu a osmý paprsek s vyšší kaplí směrem k průčelí. Střídají se zelenošedé valby, tmavé hřebeny a žebrovaná kupole se světlým vrchlíkem. Všechny boční i koncové stěny dlouhých křídel mají vlastní kresbu.

| Pohled | Před úpravou | Po úpravě |
| --- | --- | --- |
| Z ulice | [Před](bory/ulice-pred.jpg) | [Po](bory/ulice-po.jpg) |
| Šikmo k průčelí | [Před](bory/sikmo-pred.jpg) | [Po](bory/sikmo-po.jpg) |
| Přelet od průčelí | [Před](bory/prelet-pred.jpg) | [Po](bory/prelet-po.jpg) |
| Přelet z opačné strany | [Před](bory/kopule-pred.jpg) | [Po](bory/kopule-po.jpg) |

## Podklady

- Poloha a objemy vycházejí z již distribuovaných herních obrysů přispěvatelů OpenStreetMap (ODbL). Historii a paprskovité uspořádání popisuje [město Plzeň](https://plzen.eu/o-meste/aktuality/aktuality-z-mesta/pred-135-lety-byla-dostavena-veznice-na-borech/).
- Referenční fotografii z ulice pořídil Aisano v roce 2014. [Wikimedia Commons, CC BY-SA 3.0](https://commons.wikimedia.org/wiki/File:V%C4%9Bznice_Plze%C5%88,_vchod,_3.jpeg)
- Autor hry dodal historický černobílý letecký záběr a barevnou šikmou fotografii. Sloužily k porovnání siluety a materiálů. Rozměry drobných prvků, rytmus světlíků a členění oken jsou výtvarným odhadem. Pomocné stavby kolem historického domu dál využívají běžné modely města. Herní textura a doplněná geometrie jsou vlastní tvorba projektu.

## Vyzkoušení

Na mapě vyber památku **Věznice Bory**. Prohlédni si nápis na průčelí a ve vrtulníku obleť kupoli i z odvrácené strany. S parametrem `?bory=puvodni` lze ze stejného místa zobrazit starý model.

## Ověření ve hře

Na stejných místech a při stejném osvětlení vznikly čtyři dvojice snímků. Při šikmém přeletu proti průčelí ve vysoké kvalitě vzrostl počet vykreslovacích volání celé scény z 308 na 312 a počet vykreslených trojúhelníků z 382 993 na 389 597 včetně stínů. Přibyla jedna geometrie a jedna textura. Při druhém přeletu z opačné strany byly přírůstky stejné. Předvolba „nízká“ využívá jednodušší zakřivení kupole a vynechává drobné světlíky.

Automatická kontrola přímo ve hře vyzkoušela načtení na nízké kvalitě, výšku povrchu kupole, uvolnění geometrie i textury při odletu a nové načtení po návratu. Zkoušky běžely na počítači. Výkon na skutečném telefonu se neměřil.

### Výkon při jízdě a letu

Na Macu s čipem Apple M4 běželo Chromium ve Full HD, ve WebGL 2 a na nízké předvolbě. Měření vychází z `tools/measure_map.mjs`, s trasou auta poblíž památky a s desetisekundovým letem nad Bory. Pořadí bylo původní, nová, nová, původní verze. Vrtulník během vzorku skutečně uletěl 207 až 216 metrů. Tabulka uvádí rozpětí dvou měření v milisekundách. Každá hodnota je 95. percentil, tedy čas, do kterého se vešlo 95 % vzorků.

| Pohled | Práce snímku před | Práce snímku po | GPU před | GPU po |
| --- | ---: | ---: | ---: | ---: |
| Jízda | 4,9–5,9 | 5,5 | 5,38–8,63 | 5,76–7,13 |
| Přelet | 5,0–5,9 | 5,0 | 8,44–9,09 | 8,89–9,32 |

Při přeletu vzrostl průměr obou hodnot GPU z 8,77 na 9,11 ms (asi 4 %). V obou bězích se vešel do cíle 12 ms. Krátké měření zahrnuje i provoz a načítání okolí.

### Výsledky kontrol

Prošlo všech 300 testů JavaScriptu a produkční sestavení. V úplné sadě prošlo 413 ze 414 prohlížečových zkoušek, včetně kontrol Borů na WebGL 2 i WebGPU. Zbývající zkouška ranní dopravy u hlavního nádraží na WebGL 2 při společném běhu zaznamenala vyjetí vozidel z vozovky. Při samostatném opakování prošla beze změny kódu.
