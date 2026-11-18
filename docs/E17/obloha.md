# E17 · Obloha a světlo v průběhu dne

Hra počítá směr slunce pro souřadnice náměstí Republiky podle kalendáře a
místního času včetně letního času. V noci osvětluje scénu samostatné slabé
měsíční světlo. Stávající mraky se pohybují nad oblohou z modelu třídy
`SkyMesh` v three.js. [Rovnice NOAA](https://gml.noaa.gov/grad/solcalc/solareqns.PDF).

Mapa světla pro lesklé a matné povrchy se poprvé připraví při načítání.
Za jízdy se šest stran mapy snímá postupně, po jedné na vykreslení. Hra
publikuje hotovou mapu až na sedmé vykreslení. Přepočet vyvolá uplynutí
deseti herních minut nebo posun slunce o více než dva stupně. Parametr
`?sky=0` vypne nový model oblohy i mapu světla.

| Pohled | Před změnou oblohy | Po změně |
| --- | --- | --- |
| Náměstí v 10:00, 17. listopadu | [Před](materialy/namesti-den.jpg) | [Po](obloha/namesti-den.jpg) |
| Náměstí v 18:09, 19. října | [Před](obloha/namesti-soumrak-pred.jpg) | [Po](obloha/namesti-soumrak.jpg) |
| Náměstí ve 22:00, 17. listopadu | [Před](materialy/namesti-noc.jpg) | [Po](obloha/namesti-noc.jpg) |
| Západní portály Valíku v 10:00 | [Před](materialy/valik-zapad.jpg) | [Po](obloha/valik-zapad.jpg) |

Šikmé zimní slunce protáhlo stíny. S první úpravou se na náměstí kreslilo
335 volání a 597 414 trojúhelníků. Dosavadní oblast stínů se pro tento
krok zúžila. Výsledný snímek má 308 volání a 553 991 trojúhelníků, což se
vejde do obou mezí testu E13. U Valíku slábne denní světlo v tubusu za
portálem, kde přímé slunce zakrývá strop a terén. Značení a osvětlení v
tubusech zůstávají čitelné.
