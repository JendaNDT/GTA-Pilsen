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
| 3 | 103 300 budov s výškou, střechy sedlové, valbové, odsazené, ploché | hotovo | stejný výpočet tvaru jako `buildBuildings`; oboustranné kolize stěn, hráč se nedostane dovnitř chůzí, startem ani výstupem z auta (zkouška `scenar_budovy`) |
| 4 | Okna fasád podle stylu (dům, panelák, činžák, kanceláře, hala, kostel, radnice), svícení v noci | hotovo | převedený shader, rozvrh rozsvícení oken |
| 5 | Silnice, chodníky, pěšiny, vodorovné značení, přechody, stopčáry | hotovo | kreslicí příkazy převzaté z předlohy; navíc vyhlazená osa (křivka přes všechny body z mapy) a zhuštění ve svahu, takže silnice v kopcích a zatáčkách není rozpadlá ani hranatá (zkouška `test_silnice`: terén nad vozovkou o víc než 10 cm u 1,1 % místo 1,98 %, žádný viditelný lom osy místo 85); okraje chodníků a krajnic jako hladká čára |
| 6 | 1 179 mostů s mostovkou, pilíři a zábradlím, kamenné oblouky | hotovo | včetně kalibrace mostovek podle měření; ověřen průjezd i chůze po Wilsonově mostě a průjezd pod mostem Milénia |
| 7 | Tunel Valík (dva tubusy, portály, osvětlení) | částečně | tubusy, portály a světla s kolizí; terén nad portálem zatím nemá otvor |
| 8 | Povrch země: pole, louky, lesy, parky, voda, potoky, štěrk kolejí | hotovo | mapa barev 1 m na pixel |
| 9 | Letecké snímky otevřené krajiny (ortofoto ČÚZK) | hotovo | stejné bloky ČÚZK (2 m na pixel) a stejné míchání „soft-light“ 80 % na polích, loukách, trávě a křovinách uvnitř hrací plochy; vypínač v nastavení; ověřeno snímkem se snímky a bez nich |
| 10 | Stromy (listnaté, jehličnaté, lesy) a lampy veřejného osvětlení | částečně | stromy s ročními obdobími a sněhem; stromy zatím bez kolizí |
| 11 | Měřené budovy centra (3D model města), stavby, jezy | hotovo | 93 dlaždic městského modelu nahrazuje budovy z OSM, zdi, pilíře a jezy s kolizí. Model má stěny otočené lícem dovnitř a společné zdi sousedních domů v jedné rovině: budovy se proto kreslí z obou stran jako v předloze, líc má přednost před rubem (bez blikání), zevnitř není vidět ven (`scenar_budovy`); místy zůstává úzká spára mezi domy přímo v datech modelu |
| 12 | Tři podrobné úseky ulic s přízemím a mobiliářem | chybí | |
| 13 | Vodní hamr v Dobřívě s otáčejícími se koly | hotovo | model postavený kódem předlohy (`mill.js`) v převodníku, kolize budovy, 4 kola se točí 0,72 rad/s od 9 do 17 h; zkouška `scenar_hamr`; bez nočního svícení oken a zvuku bucharu |
| 14 | Proudící voda, pěna na jezech | částečně | voda se vlní, bez proudu a pěny |
| 15 | Koleje tramvají a železnice | hotovo | jako pásy a kolejnice |

## Pohyb a vozidla

| # | Funkce v předloze | Godot | Ověření a rozdíly |
| --- | --- | --- | --- |
| 16 | Chůze, běh, skok (2,4 / 6,4 m/s) | hotovo | scénář `scenar_most` |
| 17 | Zábradlí a zídky zastaví chodce | částečně | zábradlí je pevná překážka |
| 18 | Plavání | hotovo | dno řek pod hladinou podle `riverBed` (převodník volá kód předlohy, mřížka 4 m), plavání 1,7 m/s s hlavou nad vodou, výstup na břeh; zkouška `scenar_voda` v Radbuze u Wilsonova mostu |
| 19 | Pády postav a sražení autem | částečně | chodci po sražení autem upadnou a po chvíli vstanou, sražení se počítá do statistik; hráč zatím nepadá a nezraní se pádem |
| 20 | Auto: nástup a výstup, jízda, 8 typů | hotovo | 8 typů v provozu i zaparkovaných, krádež auta z provozu |
| 21 | Fyzika auta (odpružení, převodovka, smyk), arkádové a realistické řízení | částečně | vestavěné vozidlo Godotu s fyzikou Jolt, jen arkádové řízení |
| 22 | Poškození a promáčknutí auta, ztráta dílů | částečně | poškození v procentech z nárazu, slabší motor, kouř od 60 %, nepojízdné při 100 %, ztmavnutí laku (zkušebna); bez promáčklin a odpadávajících dílů |
| 23 | Vrátit auto na kola (R) | hotovo | |
| 24 | Klakson, dálková světla | hotovo | klakson H se zvukem; v noci svítí reflektory a koncová světla všech aut, hráčovo auto má reflektor, brzdová světla a dálková L (ověřeno snímkem ve 21:30) |
| 25 | Vrtulníky na heliportech, přistání na střechách | částečně | letový model z předlohy, 4 heliporty, ližiny dosednou i na střechu; scénář `scenar_vrtulnik`; chybí poškození při nárazu |
| 26 | Auto ve vodě plave a potopí se | hotovo | vztlak jako `Water.step` (1,95 klesá po 2 s o 0,24 za sekundu, odpor vody), motor ve vodě nejede, po 6 s je auto pod hladinou a leží na dně; zkouška `scenar_voda` |

## Doprava a MHD

| # | Funkce v předloze | Godot | Ověření a rozdíly |
| --- | --- | --- | --- |
| 27 | Provoz aut podle značení, přednosti a stopek | částečně | auta v pruzích po grafu, stopky, dej přednost, odstup, zatáčky; náraz změní vůz ve fyzikální; zákazy odbočení zatím ne |
| 28 | Semafory pro auta, chodce a MHD | částečně | 174 skupin s časováním z předlohy, návěstidla; zkouška: 0 průjezdů na červenou; MHD a chodci zatím semafory nerespektují |
| 29 | Denní rytmus provozu podle měření | hotovo | křivky z dopravních detektorů města Plzně přiřazené 714 hranám stejným výpočtem jako `traffic-rhythm.js` (převodník volá přímo kód předlohy), odhad pro ostatní ulice, chodci podle centra a odjezdů MHD; zkouška `scenar_doprava`: u náměstí pátek 16:30 hustota 0,90, 3:30 0,07, v noci cíl 8 aut místo 38 |
| 30 | Chodci na chodnících a přechodech | částečně | chodí po chodnících, zahýbají, po sražení upadnou; přechody zatím nepoužívají |
| 31 | MHD PMDP: 51 linek, jízdní řád GTFS, zastávky, odjezdy | hotovo | 370 tras podle jízdního řádu, tabule odjezdů; scénář `scenar_mhd` |
| 32 | Nástup a výstup z MHD, přestupy, noční spoje | hotovo | nástup a výstup ověřené (`scenar_mhd`); tabule ukazuje 5 nejbližších odjezdů a nejbližší přestup s nástupištěm a vzdáleností; noční spoje jedou podle jízdního řádu |
| 33 | Policie, hledanost, pokuty | hotovo | pravidla z předlohy (hlídky podle hledanosti, ztracení po 11 + 3 × hledanost s, zatčení do 9 m, pokuta); scénář `scenar_doprava` |
| 34 | Ničitelné lampy, značky, semafory a zábradlí | částečně | lampy, značky a semafory se autem ulomí a spadnou, ráno se opraví (zkušebna); zábradlí zatím zničit nejde |

## Hra a postup

| # | Funkce v předloze | Godot | Ověření a rozdíly |
| --- | --- | --- | --- |
| 35 | Rozvoz jídla a taxi na skutečné adresy | částečně | zakázky se dají vzít (J, menu), trasa a limit z grafu; dokončení zatím neověřené zkouškou, odloženo |
| 36 | Směny řidiče MHD (tram 1, trolejbus 16, bus 30) | hotovo | stejné okruhy, výběr spoje, plánované časy, jízdní dynamika, dveře F, bodování a výplata jako `shift.js`; zkouška `scenar_smena`: tramvaj 1 Hlavní nádraží → Lékařská fakulta, 6/6 zastávek, 89 bodů, 580 Kč. Semafory na trase se hodnotí podle nejbližšího návěstidla ve směru jízdy; nedání přednosti a STOP se zatím nehodnotí |
| 37 | Garáž u hlavního nádraží, koupě vozu, úpravy, oprava | hotovo | ceny a pravidla jako `garage.js` (auto 1 350 Kč, brzdy 325, pneumatiky 360, oprava 75 + 5 × poškození); zkouška `scenar_garaz` včetně uložení; bez promáčklin karoserie a špíny |
| 38 | Peníze, statistiky | hotovo | peníze, objevená místa, rozvozy, taxi, směny, zatčení a sražení chodci v menu; ukládají se |
| 39 | Ukládání postupu a načtení po restartu | hotovo | scénář `scenar_ulozeni` ve dvou samostatných spuštěních |
| 40 | 53 míst k objevení | hotovo | do 75 m, 150 Kč a popis; místa jsou upravitelná v oblastech |
| 41 | Velká mapa, hledání míst, cíl a navigace | částečně | mapa M, hledání bez diakritiky, cíl kliknutím, trasa po silnicích; bez zákazů odbočení |
| 42 | Minimapa a hodiny | hotovo | |

## Prostředí, zvuk a nastavení

| # | Funkce v předloze | Godot | Ověření a rozdíly |
| --- | --- | --- | --- |
| 43 | Slunce a obloha podle data a času v Plzni | hotovo | stejný výpočet polohy slunce (NOAA) |
| 44 | Herní čas podle Plzně, ruční nastavení, posun N | hotovo | živý čas, ruční hodina v nastavení, N |
| 45 | Počasí (déšť, sníh, mlha), přilnavost, „vždy jasno“ | hotovo | stejný výpočet jako `weather.js` (zkouška `test_pocasi`: 12 vzorků shodných s předlohou, rozložení za rok, vysychání); kapky a vločky kolem kamery (vypínatelné, hustota podle kvality), oblaka, mlha, mokrá a zasněžená zem a střechy; brzdná dráha z 50 km/h sucho 8,8 m, mokro 12,2 m, sníh 21,7 m (zkušebna) |
| 46 | Roční období stromů | hotovo | stejné období a tóny jako `treeSeason` a `SEASON_TINT` (jaro, léto, podzim do oranžova); v zimě mají listnáče řídké holé větve místo průhledné koruny předlohy; ověřeno snímky ve čtyřech měsících |
| 47 | Prostorový zvuk motorů, klaksonů, hlášení zastávek, vody | částečně | syntetizované motory aut, autobusů, tramvají a trolejbusů (výška tónu podle rychlosti), rotor, klakson H, náraz, zvonek tramvaje, česká hlášení zastávek z předlohy (ověřeno v `scenar_mhd`); bez zvuků vody a hamru |
| 48 | Nastavení kvality (4 předvolby a automaticky) | částečně | 3 předvolby a automaticky (podle snímků za sekundu) |
| 49 | Fotorežim (O) | hotovo | zastavená hra, volná kamera do 100 m (WASD, Q/E, myš nebo prst), zorný úhel místo zaostření (hloubka ostrosti v režimu Compatibility není), uložení PNG (na webu stažení); zkouška `scenar_foto` |
| 50 | Dotykové ovládání na telefonu | částečně | páčka, tlačítka, kamera tahem |
| 51 | Menu, nastavení, O hře s licencemi | hotovo | |
| 52 | Měření výkonu a ladicí režim | částečně | přehled F3: snímky za sekundu, čas zpracování a fyziky, volání kreslení, trojúhelníky, paměť, dlaždice, provoz; bez panelu historie snímků |

## Editor (nové v Godotu)

| # | Funkce | Godot | Ověření |
| --- | --- | --- | --- |
| E1 | Náhled skutečného okolí v editoru | hotovo | scény oblastí ukazují okolí, panel Plzeň hledá místa |
| E2 | Ruční úpravy zastávek a objektů zachované při novém importu | hotovo | zkouška `test_import`; posunutá zastávka mění i místo zastavení MHD |

## Souhrn stavu (20. 11. 2026)

Z 52 funkcí předlohy je **33 hotových**, **18 částečně** a **1 chybí** (tři podrobné úseky ulic
s přízemím a mobiliářem). K tomu 2 nové funkce editoru. Rozvoz jídla a taxi jsou podle dohody odložené.

**Zkoušky.** `godot/testy/spust_zkousky.sh` hraje 15 zkoušek celých situací (import oblastí, počasí, budovy,
most a průjezd pod mostem, MHD, nárazy a brzdná dráha, uložení a načtení po restartu, provoz a policie,
fotorežim, garáž, směna řidiče tramvaje, hamr, voda, vrtulník). Webový export ověřuje
`tools/godot/zkouska_web.mjs` v emulovaném telefonu (start asi 8 s, dotyková páčka, bez chyb v konzoli).
Testy původní hry (`npm test`) dál procházejí, původní hra se spouští beze změny.

**Výkon.** Zkoušky běží bez grafické karty (softwarové vykreslování), čísla snímků z nich proto nejsou
měřítkem. Přehled F3 ukáže skutečné hodnoty na daném zařízení. Na vysoké kvalitě kreslí centrum
asi 1 500 volání a 500 tisíc trojúhelníků; výkon na telefonu zůstává otevřený, dokud ho autor nevyzkouší.
Webový balík má 78 MB dat, telefon začíná na nízké kvalitě.

**Známé rozdíly a další kroky.**
- Podrobné úseky ulic (přízemí, mobiliář) a promáčkliny karoserie zatím chybí.
- MHD jede podle jízdního řádu, na semafory ani provoz před sebou nereaguje (kromě směny řidiče).
- Chodci zatím nepoužívají přechody a nečekají na zelenou.
- Terén nad portály tunelu Valík nemá otvor, stromy nemají kolize.
- Zábradlí nejde zničit, hráč se nezraní pádem.
- Řízení je jen arkádové (předloha má i realistický režim).
