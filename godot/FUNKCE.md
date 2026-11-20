# Seznam funkcí: předloha a Godot

Předloha je webová hra na větvi `etapa/E26`, revize `5233937acd7821c455c8e97494a1722f107fb181`
(20. 11. 2026). Seznam vychází z README, protokolů etap E01–E26 a skutečného kódu v `src/`.
Uvádí jen funkce, které v předloze opravdu fungují. Plány bez kódu nejsou započítané.

Stav v Godotu: **hotovo** = funguje a je ověřené zkouškou, **částečně** = funguje se známými rozdíly,
**chybí** = zatím není.

## Svět a mapa

| # | Funkce v předloze | Godot | Ověření a rozdíly |
| --- | --- | --- | --- |
| 1 | Území 33,2 × 19,7 km Plzeň–Rokycany–Dobřív, 10 218 dlaždic 256 m | hotovo | celé území převedeno, načítá se po dlaždicích |
| 2 | Terén ČÚZK (8 m, 4 m na vybraných místech, zarovnání pod silnicemi) | hotovo | výšky převzaté z výpočtu předlohy, shoda s jejími trojúhelníky |
| 3 | 103 300 budov s výškou, střechy sedlové, valbové, odsazené, ploché | hotovo | stejný výpočet tvaru jako `buildBuildings` |
| 4 | Okna fasád podle stylu (dům, panelák, činžák, kanceláře, hala, kostel, radnice), svícení v noci | hotovo | převedený shader, rozvrh rozsvícení oken |
| 5 | Silnice, chodníky, pěšiny, vodorovné značení, přechody, stopčáry | hotovo | kreslicí příkazy převzaté z předlohy |
| 6 | 1 179 mostů s mostovkou, pilíři a zábradlím, kamenné oblouky | hotovo | Wilsonův most ověřen průjezdem a chůzí |
| 7 | Tunel Valík (dva tubusy, portály, osvětlení) | chybí | |
| 8 | Povrch země: pole, louky, lesy, parky, voda, potoky, štěrk kolejí | hotovo | mapa barev 1 m na pixel |
| 9 | Letecké snímky otevřené krajiny (ortofoto ČÚZK) | chybí | |
| 10 | Stromy (listnaté, jehličnaté, lesy) a lampy veřejného osvětlení | částečně | bez ročních období a kolizí |
| 11 | Měřené budovy centra (3D model města), stavby, jezy | chybí | zatím se kreslí budovy z OSM |
| 12 | Tři podrobné úseky ulic s přízemím a mobiliářem | chybí | |
| 13 | Vodní hamr v Dobřívě s otáčejícími se koly | chybí | |
| 14 | Proudící voda, pěna na jezech | částečně | voda se vlní, bez proudu a pěny |
| 15 | Koleje tramvají a železnice | hotovo | jako pásy a kolejnice |

## Pohyb a vozidla

| # | Funkce v předloze | Godot | Ověření a rozdíly |
| --- | --- | --- | --- |
| 16 | Chůze, běh, skok (2,4 / 6,4 m/s) | hotovo | scénář `scenar_most` |
| 17 | Zábradlí a zídky zastaví chodce | částečně | zábradlí je pevná překážka |
| 18 | Plavání | chybí | |
| 19 | Pády postav a sražení autem | chybí | |
| 20 | Auto: nástup a výstup, jízda, 8 typů | částečně | typy připravené, ve hře zatím jeden vůz |
| 21 | Fyzika auta (odpružení, převodovka, smyk), arkádové a realistické řízení | částečně | vestavěné vozidlo Godotu s fyzikou Jolt, jen arkádové řízení |
| 22 | Poškození a promáčknutí auta, ztráta dílů | chybí | |
| 23 | Vrátit auto na kola (R) | hotovo | |
| 24 | Klakson, dálková světla | chybí | |
| 25 | Vrtulníky na heliportech, přistání na střechách | chybí | |
| 26 | Auto ve vodě plave a potopí se | chybí | |

## Doprava a MHD

| # | Funkce v předloze | Godot | Ověření a rozdíly |
| --- | --- | --- | --- |
| 27 | Provoz aut podle značení, přednosti a stopek | chybí | |
| 28 | Semafory pro auta, chodce a MHD | chybí | |
| 29 | Denní rytmus provozu podle měření | chybí | |
| 30 | Chodci na chodnících a přechodech | chybí | |
| 31 | MHD PMDP: 51 linek, jízdní řád GTFS, zastávky, odjezdy | chybí | |
| 32 | Nástup a výstup z MHD, přestupy, noční spoje | chybí | |
| 33 | Policie, hledanost, pokuty | chybí | |
| 34 | Ničitelné lampy, značky, semafory a zábradlí | chybí | |

## Hra a postup

| # | Funkce v předloze | Godot | Ověření a rozdíly |
| --- | --- | --- | --- |
| 35 | Rozvoz jídla a taxi na skutečné adresy | chybí | |
| 36 | Směny řidiče MHD (tram 1, trolejbus 16, bus 30) | chybí | |
| 37 | Garáž u hlavního nádraží, koupě vozu, úpravy, oprava | chybí | |
| 38 | Peníze, statistiky | částečně | ukazatel peněz |
| 39 | Ukládání postupu a načtení po restartu | chybí | |
| 40 | 53 míst k objevení | chybí | seznam míst je převedený |
| 41 | Velká mapa, hledání míst, cíl a navigace | chybí | |
| 42 | Minimapa a hodiny | částečně | hodiny |

## Prostředí, zvuk a nastavení

| # | Funkce v předloze | Godot | Ověření a rozdíly |
| --- | --- | --- | --- |
| 43 | Slunce a obloha podle data a času v Plzni | hotovo | stejný výpočet polohy slunce (NOAA) |
| 44 | Herní čas podle Plzně, ruční nastavení, posun N | částečně | čas ze systému, posun N |
| 45 | Počasí (déšť, sníh, mlha), přilnavost, „vždy jasno“ | chybí | |
| 46 | Roční období stromů | chybí | |
| 47 | Prostorový zvuk motorů, klaksonů, hlášení zastávek, vody | chybí | |
| 48 | Nastavení kvality (4 předvolby a automaticky) | chybí | |
| 49 | Fotorežim (O) | chybí | |
| 50 | Dotykové ovládání na telefonu | částečně | páčka, tlačítka, kamera tahem |
| 51 | Menu, nastavení, O hře s licencemi | chybí | |
| 52 | Měření výkonu a ladicí režim | chybí | |

## Editor (nové v Godotu)

| # | Funkce | Godot | Ověření |
| --- | --- | --- | --- |
| E1 | Náhled skutečného okolí v editoru | částečně | uzel Svet staví náhled kolem zvoleného bodu |
| E2 | Ruční úpravy zastávek a objektů zachované při novém importu | chybí | |
