# E17 · Kaskádové stíny

Stíny se počítají ve více vzdálenostech od kamery. Blízká mapa zachytí
jemnější hrany stínů. Další mapy udrží stíny domů a stromů v dálce.
Přechody mezi mapami se prolínají. Po setmění se mapy nepřepočítávají.
Parametr `?shadows=0` vypne stíny i na vyšších předvolbách.

| Předvolba | Mapy stínů | Rozlišení mapy | Dosah |
| --- | ---: | ---: | ---: |
| Ultra | 4 | 2048 × 2048 | 900 m |
| Vysoká | 3 | 2048 × 2048 | 750 m |
| Střední | 2 | 1024 × 1024 | 600 m |
| Nízká | 0 | – | – |

[Náměstí s jednou mapou stínů](obloha/namesti-den.jpg) a
[s kaskádami](stiny/namesti-den.jpg). Další výsledek je vidět na
[Lochotíně ze vzduchu](stiny/lochotin.jpg).

| Pohled | Jedna mapa E13, volání / trojúhelníky | Tři mapy E17, volání / trojúhelníky |
| --- | ---: | ---: |
| Náměstí | 295 / 509 603 | 554 / 1 055 779 |
| Lochotín | 322 / 503 726 | 431 / 673 580 |
| Rokycany | 195 / 283 880 | 280 / 377 034 |

Vyšší počet je důsledkem vykreslování do tří map místo jedné. Stín stejné
budovy může být ve vedlejších mapách kvůli plynulému přechodu a navíc se
kreslí stíny vzdálenějších objektů. Původní referenční hodnoty zůstávají
v [rozpočtu E13](../../tests/budgets.json). Test pro tři mapy používá
[naměřené hodnoty E17](../../tests/budgets-e17.json) se stejnou tolerancí
10 % jako původní test.

Desetisekundové měření na Apple M4, Chromium 159.0.8154.6, WebGPU přes
Metal, vysoká předvolba, 1920 × 1080, 17. listopadu v 10:00. Nástroj
`tools/measure_map.mjs --work --center-flight` naměřil při jízdě CPU p95
4,0 ms a GPU p95 6,68 ms ze 154 vzorků. Při letu nad Plzní naměřil CPU p95
4,8 ms a GPU p95 7,80 ms z 232 vzorků. P95 je čas, do kterého se vešlo
95 % vzorků.
