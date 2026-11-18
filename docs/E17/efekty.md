# E17 · Obrazové efekty

## Průchod scény a vyhlazování

Astra před implementací ověřila rozhraní v three.js 0.187. Návrh po kontrole
ukládá normály přímo v souřadnicích kamery a při střihu vymaže historii
vyhlazování. Povrchy, které nezapisují hloubku, například průhledná světla
a pruhy na silnici, ovlivní barvu a ponechají normálu i pohyb plochy pod sebou.

| Předvolba | Vyhlazování |
| --- | --- |
| Ultra a vysoká | TRAA s údaji o pohybu objektů |
| Střední | SMAA |
| Nízká | FXAA, jeden barevný výstup scény |

WebGL 2 bez samostatného prolínání více výstupů použije SMAA i na vyšších
předvolbách. Prohlížeč bez podpory plovoucího barevného výstupu použije
přímé vykreslení. To lze zapnout i ručně parametrem `?postfx=0`.

Výsledný obraz vykresluje scénu jednou i při vyžádání několika obrazů
v témže kroku prohlížeče. Na WebGPU má stabilní obraz na náměstí po přidání
TRAA 555 volání a 1 055 780 trojúhelníků proti 554 a 1 055 779 před efektem.
[Náměstí](efekty/vyhlazovani-namesti.jpg) · [Valík](efekty/vyhlazovani-valik.jpg).

## Kontaktní zastínění

Na vysoké a ultra předvolbě s odděleným výstupem hloubky a normál počítá
GTAO jemné zastínění v rozích, u zdí a pod předměty. Mapa zastínění má
poloviční šířku a výšku a vyhlazování potlačuje její šum v čase.
Zastínění se přidává před vyhlazením obrazu. Parametr `?ao=0` ho vypne.
[Hamr před zastíněním](efekty/zastineni-pred.jpg) · [Hamr po úpravě](efekty/zastineni-hamr.jpg).

## Záře světel

Záře se rozlévá pouze z částí obrazu, které překročí hranici jasu. V noci
je hranice nižší a záře silnější, aby vynikla okna, lampy a světlomety.
Průměrný jas náměstí ve 22:00 stoupl z 27,7 na 31,7 z 255. Průměrný jas
denního pohledu zůstal 166,1. Záře běží od střední předvolby a dá se vypnout
parametrem `?bloom=0`. [Náměstí před přidáním záře](efekty/zare-pred.jpg) ·
[Náměstí se září](efekty/zare-namesti.jpg).

## Tónování

ACES a AgX byly porovnány ve stejných pohledech s expozicí 1.
Výchozí zůstává ACES. Uchovává teplejší odstín dlažby a silnější rozdíl
mezi rozsvíceným a zhasnutým oknem. AgX v porovnání zvedá tmavé plochy
a ve dne tlumí barvy. Lze ho zobrazit parametrem `?tone=agx`.

| Pohled | ACES | AgX |
| --- | --- | --- |
| Náměstí ve dne | [Snímek](efekty/tonovani-aces-den.jpg) | [Snímek](efekty/tonovani-agx-den.jpg) |
| Náměstí v noci | [Snímek](efekty/tonovani-aces-noc.jpg) | [Snímek](efekty/tonovani-agx-noc.jpg) |

V nočním vzorku dvou sousedních oken byl rozdíl v červeném kanálu 144
bodů z 255 u ACES a 104 u AgX. Denní vzorek dlažby měl v červeném kanálu
175 bodů u ACES a 159 u AgX. Převod obrazu pro monitor probíhá samostatně
po tónování, aby mezi ně v dalším kroku šlo přidat barevné ladění.
