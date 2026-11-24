# Rozjezd aut a příčiny kolon

24. listopadu 2026. Výchozí hra `f09c09f`. Pro běžnou hru zůstává původní rozjezd. Silnější motor v ranní špičce zvýšil počet průjezdů na zelenou, ale v jednom scénáři řidič při přidávání plynu vyjel z vozovky. U delší fronty v Husově se podařilo určit konkrétní dvojici účastníků, kteří se vzájemně blokovali.

## Stejná ranní špička

Každá varianta dostala dvě desetiminutové jízdy na každém místě. Hra začínala v pondělí 9. listopadu v 7.30 za jasného počasí. V každé dvojici byl stejný výchozí stav generátoru náhodných čísel, stanoviště, rychlost simulace, pohyb kamery i kvalita. Na Klatovské bylo v dosahu měření celkem 74 začátků či částí zelených fází, u nádraží 66. Počet příjezdů se může v průběhu jízdy změnit podle rychlosti odbavení a dalších rozhodnutí řidičů.

Běžná auta ve zkušební variantě dostala při rychlosti do 10 km/h o 10 % vyšší točivý moment. Mezi 10 a 20 km/h přídavek plynule klesal k nule. Stejný násobek dostalo zrychlení vzdálených aut s jednodušší simulací. Obě varianty používaly stejná pravidla přednosti, odstupy a brzdění.

| Místo | Rozložení provozu | Průjezdy na zelenou | Nejdelší souvislé stání | Hlášené nárazy |
|---|---|---:|---:|---:|
| Klatovská | 20261118 | 114 → 130 | 70 → 106,5 s | 0 → 1 |
| Hlavní nádraží | 20261118 | 101 → 112 | 60 → 59,5 s | 10 → 7 |
| Klatovská | 20261124 | 112 → 130 | 69 → 69 s | 0 → 1 |
| Hlavní nádraží | 20261124 | 80 → 105 | 56,5 → 55 s | 5 → 7 |

Vlevo je běžný rozjezd, vpravo silnější. Celkem připadlo na 280 zelených fází v každé variantě 407 a 477 průjezdů, tedy 1,45 a 1,70 průjezdu na fázi. Nárazy se změnily z 15 na 16. Ve druhé jízdě u nádraží zaznamenala pouze silnější varianta čtyři po sobě jdoucí vzorky mimo vozovku pod plynem, všechny na stejném úseku Ukrajinské od času 433 do 434,5 s. Původní požadavek na jízdu po vozovce proto v tomto případě neprošel. Dřívější stání 163,5 s v Ukrajinské se v těchto osmi jízdách neopakovalo.

Průjezd se počítá při vjezdu běžného auta na zelenou u směrového semaforu do 200 metrů od pozorovatele. Totéž auto se u stejného návěstidla v rámci jedné zelené započítá jednou. Počítadlo nárazů sleduje herní hlášení v tomtéž okruhu. Oboustranné nebo opakované hlášení stejné dvojice do jedné sekundy sloučí. U nárazu do prostředí se sleduje konkrétní vůz. Stání a vyjetí měří původní zkouška po půlsekundách. Dvě rozložení provozu na místo stačí k zachycení porušení pravidla, ale přesná velikost dopadu v celém městě zůstává nejistá.

Při samostatném zopakování první jízdy se silnějším rozjezdem na Klatovské jsme naměřili 121 průjezdů, nejdelší stání 65 s a žádný náraz. Vzájemné čekání sedanu a autobusu se znovu neobjevilo. Stejné hodiny a semínko tedy nezaručují přesné zopakování každého auta. Toto dodatečné měření není zahrnuté do čtyř dvojic v tabulce.

## Rozjezd stejné fronty

Na přímé suché vozovce čekalo deset vozů v přesném pořadí malý vůz, sedan, dodávka a znovu od začátku. Před prvním nárazníkem bylo k čáře 0,6 m, počáteční mezery mezi auty byly 2,4 m. Po uvolnění cesty používali řidiči skutečné řízení plynu, odstupu i fyziku kol. Za deset sekund projelo čárou šest aut v obou variantách. Desátý nárazník projel v čase 16,05 s a 15,93 s. Posílení motoru tedy v této konkrétní frontě získalo 0,12 s. Provoz ve městě kromě rozjezdu mění také počet příjezdů, odbočení, signály a překážky.

## Jak číst příčinu fronty

Desetiminutová zkouška ukládá do `pozorovani.json` řetězec při 60, 120 a 180 sekundách nepřetržitého stání. Uvede typ auta, ulici, důvod čekání a podle situace další vůz nebo linku MHD. Pokud se tentýž účastník objeví znovu, označí vzájemné čekání. Pokud nemá čerstvé rozhodnutí řidiče, uvede „příčina nezjištěna“.

V první jízdě se silnějším rozjezdem čekal od času 553 s sedan v Husově na autobus 41 a autobus na týž sedan. V čase 586,5 s vedla sledovaná fronta od taxi v ulici Kardinála Berana přes další tři auta k téže dvojici. V jízdě s běžným rozjezdem a druhým rozložením skončila jiná větev čekání u MHD s otevřenými dveřmi. Obě situace vypadají zezadu jako stojící řada aut. Pro případnou změnu přednosti zbývá samostatně ověřit, který z účastníků má dost prostoru k bezpečnému průjezdu.

Pozorování lze zapnout kdekoli na mapě přidáním `?debug&kolony=1` do adresy hry. V konzoli prohlížeče vypíše `__kolony()` právě čekající účastníky od 60 sekund. Například `__kolony(10)` ukáže i kratší fronty. Zavřením stránky se záznam zahodí.

## Opakování zkoušky

Po `npm run build` spusť `npm run test:e2e -- traffic-observation --project=webgl2 --trace off`. Pro druhé rozložení přidej před příkaz `PLZEN_TRAFFIC_SEED=20261124`. Pro srovnávací sestavení použij v samostatné pracovní kopii `git apply docs/E20/pokus-rozjezd.patch`, znovu sestav hru a spusť obě rozložení. Při opakování ukládej každý výsledek do jiného adresáře volbou `--output`. [Změna použitá jen pro pokus](pokus-rozjezd.patch)

Místní výsledky osmi jízd jsou ve složkách `data-raw/a1`, `a2`, `b1` a `b2` této pracovní kopie. Záznam stejné desetivozové fronty je v `data-raw/fronta.jsonl`.

## Kontrola výsledné hry

Prošlo 274 z 274 testů JavaScriptu a produkční sestavení. V úplné místní sadě Chromia na Macu prošlo 388 z 390 zkoušek. Všechny dopravní zkoušky prošly na WebGL 2 i WebGPU. V desetiminutové jízdě bylo na Klatovské nejdelší stání 59,5 a 67 s, u hlavního nádraží 51,5 a 95 s. Ve všech čtyřech jízdách zůstala sledovaná auta pod plynem na vozovce.

V obou vykreslovačích selhala kontrola rozdílu jasu dvou oken na náměstí v noci. Stejná kontrola selhala na témže zařízení také na výchozí verzi hry `f09c09f` v obou vykreslovačích. Doplňkový pokus na softwarovém WebGL 2 při souběhu s celou sadou vyčerpal 90 sekund při přípravě obrazu. Kontrola nočních oken zůstává samostatným grafickým nálezem. Záznamy jsou v `data-raw/konecna-e2e.log`, `okna-pred.log`, `okna-pred-gpu.log` a `okna.log`.
