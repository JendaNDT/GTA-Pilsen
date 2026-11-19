# Stav etapy E21

Větev `etapa/E21` navazuje na E20 sloučenou revizí `623e081`. [Zadání E21](E21.md) · [Protokol předchozí etapy](../E20.md)

| Krok | Stav |
| --- | --- |
| 1. Registr a stálé identifikátory | Hotovo. Každý svět má vlastní registr. Značky a hlavy semaforů dostávají identitu ve zdrojovém pořadí své dlaždice před seskupením podle materiálu. |
| 2. Lampy | Hotovo. Společné umístění pro grafiku a fyziku, sražení, zhasnutí, dvě části lampy, obnova po návratu a ranní oprava prošly ověřením. |
| 3. Značky a semafory | Rozpracováno. Tělesa, ohnutí, zlomení a přednost po výpadku jsou zapojené. Probíhají zkoušky polohy sloupků a provozu. |
| 4. Mosty a uzavírky | Zbývá rozbití jednotlivých úseků a odtlačení zábrany. Historické mosty mají vlastní kamenné ohrazení. |
| 5. Následky nárazu | Zbývá hledanost, zvuky a správa počtu úlomků. |
| 6. Auta a garáž | Zbývají deformace, odpadlé díly, jízdní následky, uložení a oprava. |
| 7. Částice | Zbývají obě vykreslovací cesty a rozpočet. |
| 8. Závěrečné ověření | Zbývají zkoušky, výkon, snímky a protokol. |

Astra před implementací prověřila návrh. U lamp bude potřeba jeden společný výběr pro fyziku i vzhled, nezávislý na pořadí načítání sousedů. Pro mosty jsou zdrojem již oříznuté úseky hran. Připojené fyzikální těleso a zobrazený objekt mohou mít odlišnou dobu života. Změny po nárazu je potřeba provést po fyzikálním kroku. Otevřené otázky pro autora nyní nejsou.

Prošlo 102 ze 102 testů JavaScriptu a produkční sestavení. Nový test sestaví seznamy dvou dlaždic v obou pořadích, odliší tři předměty v každé a ověří poškození i opravu ve 4:00 dalšího dne. Všech 164 prohlížečových zkoušek prošlo za 45 minut bez vynechání nebo opakování. Záznamy jsou v `data-raw/e21/registr-prohlizec.{log,json}`. Následují lampy. Další záznamy jsou v `data-raw/e21/registr-{node,build}.log`.

## Lampy

Lampa se vybírá ze zdrojového úseku před rozmístěním do scény. Vizuál a fyzika najdou stejné místo bez ohledu na pořadí načtení sousedů. Po nárazu se skryje stožár i noční světelná skvrna a uvolní se stožár a hlava lampy. Po návratu je chodník průchozí. Oprava je ve 4:00 následujícího herního dne. Ve fyzice se vytvoří či zruší nejvýše 20 těles vybavení za krok.

Při prvním ověření ukázal kontakt s válcovým tělesem neplatnou hloubku průniku. Doplněný povinný poloměr zaoblení v konstruktoru Jolt opravil normálu. V testu těleso malého auta při 10 km/h lampu zachovalo, při 30 km/h ji ulomilo. Obě rychlosti i původní práh 6 000 N·s zůstaly zachovány. V obou vykreslovačích prošel náraz hráčovým autem, odjezd, návrat v noci a oprava. Záznamy jsou v `data-raw/e21/lampy-kontakt.log` a `lampy-cilene.log`. Rozšířená zkouška v úplné sadě navíc kontroluje polohu samotné zobrazené instance.

Na výsledné úpravě prošlo 104 ze 104 testů JavaScriptu a produkční sestavení. Nad stejným sestavením běží úplná sada 166 zkoušek. Při navázání ověřit `data-raw/e21/lampy-uplna.{log,json}` a případné nálezy opravit. Po úspěchu uložit druhý krok do gitu a pokračovat značkami a semafory.

První úplný běh lamp odhalil, že startovní vůz po přímém rozjezdu narazil do nízkou rychlostí neulomitelné lampy. Před nárazem byla pata 4,5 m před středem auta, náraz měl impulz 4 546 N·s. Vůz teď při prvním umístění hledá místo podél stejné strany ulice s volnou cestou od obrubníku. V ověřené trase zaparkoval o šest metrů dál od lampy a po 130 krocích měl rychlost 5,19 m/s bez nárazu. Původní test rozjezdu i práh zlomení zůstaly zachovány. Diagnostika: `data-raw/e21/rozjezd{,-po}.json`.

Oprava byla sestavena odděleně, aby předchozí úplná sada doběhla nad původní hrou. Prošlo 104 testů JavaScriptu a sestavení, záznamy `rozjezd-{node,build}.log`. Cílená kontrola rozjezdu a lamp v obou vykreslovačích má záznam `rozjezd-cilene.log`. Při navázání ověřit i případné další nálezy z `lampy-uplna.json`.

Všechny čtyři cílené kontroly rozjezdu a lamp na opraveném sestavení prošly na WebGL 2 i WebGPU. Po dokončení původní sady se automaticky spustí úplná kontrola opravy, pokud původní sada neodhalí další závadu. Výsledek hledej v `data-raw/e21/rozjezd-uplna.{log,json}`; případný jiný nález zaznamená `rozjezd-navazani.log`.

V původním běhu projelo během deseti minut kolem Klatovské 135 aut. Žádné při sledování nevyjelo pod plynem mimo vozovku, řidič ve Smetanových sadech ale čekal 128,5 s při limitu 120 s (hrana 11884). U hlavního nádraží zkouška prošla. Rozšířený záznam sleduje okolní vozidla, fázi semaforu a kontakty se stožáry. Při navázání porovnat `spicka-4173-Klatovská.json` (původní sestavení) a `spicka-4181-Klatovská.json` (upravené parkování). Opakování s jiným průběhem samo příčinu nedokazuje.

V rozšířeném pozorování na Klatovské nenarazilo žádné jedoucí auto do lampy. Ve frontě na Husově odhalila samostatná zkouška jinou chybu. Pokud si řidič dřív zvolil jen část průjezdu, považoval spojku 1421 za výjezd a hlásil jízdu rovně. Jeho skutečná trasa odbočovala vlevo do sadů Pětatřicátníků na úsek 12147. Zkouška na předchozím sestavení chybu zopakovala. Nyní řidič ponechá již zvolený směr a doplní navazující odbočení ještě před stopčárou. Nová samostatná zkouška prošla, ale první opakované desetiminutové jízdy měly nadlimitní čekání na obou místech. Záznamy jsou v `spojka-pred.log`, `spojka-e2e.log` a složce `spojka-e2e/`.

Druhá pracovní úprava rozlišuje dvě situace před zelenou. Řidič jedoucí rovně má přednost před čekajícím levým odbočením. Pokud již protijedoucí vůz najel do levého oblouku, ponechá mu před čárou místo k dokončení. Prošlo 104 testů JavaScriptu včetně obou situací a sestavení. Při navázání nejdříve ověřit sedm cílených prohlížečových zkoušek na tomto sestavení v `data-raw/e21/oblouk-e2e.log`, hlavně obě desetiminutové jízdy. Úplný běh `lampy-uplna` kontroluje starší sestavení před opravou parkování a křižovatek. Zbývá také úplná sada na výsledné revizi.

Pokud všech sedm cílených kontrol projde a zbytek původní sady neodhalí jiný problém, naváže automaticky standardní sestavení a úplná sada do `data-raw/e21/oblouk-uplna.{log,json}`. Důvod případného nezahájení zaznamená `oblouk-navazani.log`.

Po druhé úpravě prošlo šest ze sedmi cílených zkoušek. Na Klatovské kleslo nejdelší čekání na 74 s a všechna sledovaná auta zůstala na silnici. U nádraží však řidič v Barrandově na hraně 1173 čekal 435 s (výjezd 6376). Zbývá najít konkrétní překážku a ověřit opravu. Běží podrobné pozorování nádraží nad stejným sestavením na portu 4181, výstup `data-raw/e21/spicka-4181-hlavní nádraží.json` a `barrandova-stop.log`.

### Kontrola kolon při ověřování lamp

První úplná kontrola lamp skončila 163 úspěchy ze 166. Dvě selhání byla při rozjezdu startovního auta a jedno na Klatovské. Obě varianty rozjezdu po posunutí parkovacího místa prošly. Úplná kontrola sestavení s opraveným rozjezdem a plánováním odbočení běží do `data-raw/e21/kolony-uplna.{log,json}`.

Tři jízdy u nádraží před úpravou parkovací brzdy měly nejdelší čekání 223,5 s, 57 s a 129,5 s. V první zůstal nabouraný sedan přes čtyři minuty na stejných souřadnicích. Hra mu stále připisovala rychlost 0,318 m/s, takže se nikdy nezačala počítat minuta k odklizení. Při třetí jízdě čekalo jiné auto v Božkovské u přednosti v jízdě. Na chodník během těchto tří jízd žádné sledované auto pod plynem nevyjelo. Podklady jsou v `data-raw/e21/barrandova-trikrat/`.

Zaparkovaný vůz nyní při probuzení zabrzdí a při uspání se jeho rychlost srovná se skutečnou rychlostí tělesa. Při opuštění okruhu fyziky se pohybující se vůz dál valí. Nová zkouška ověřila oba případy na 13% svahu. Prošlo všech 105 testů JavaScriptu, sestavení i prohlížečové zkoušky lampy, odtlačení zaparkovaného auta a odklizení cizího vraku. V nové jízdě u Klatovské však auto v sadech Pětatřicátníků čekalo 128,5 s. Limit je nadále méně než 120 s. Krok 2 zůstává otevřený.

Při navázání zkontrolovat výsledky obou míst v `data-raw/e21/vrak-svah-kontrola/` a původní úplnou sadu v `kolony-uplna.log`. Diagnostika `cekani-priciny.mjs` zaznamenává po deseti sekundách čekání barvu semaforu, obsazený výjezd a vozidla s předností. První záznam vzniká v `cekani-klatovska.json`. Určit příčinu další dlouhé fronty a po opravě spustit celou sadu na výsledném sestavení.

Ověření po opravě vraku skončilo čtyřmi úspěchy z pěti. U hlavního nádraží byla nejdelší doba stání 90 s. Žádné auto v obou jízdách pod plynem neopustilo vozovku.

Na křižovatce Klatovské a Tylovy pokračují dva souběžné pruhy do jednoho. Záznam desetiminutové jízdy v `data-raw/e21/nehody-klatovska.json` zachytil střet dvou aut při řazení do stejného výjezdu. Obě pak zůstala stát. V samostatné zkoušce přijíždějí SUV a krátké osobní auto vedle sebe rychlostí 6 m/s. Před opravou se při zařazování překryly jejich karoserie o 16 cm a obě auta havarovala. Záznam je v `soubeh-prijezd.log`.

Řidič před čárou nyní zohlední sousední auto, které se právě rozjíždí do téhož výjezdového pruhu. Pokud vyjíždějí do dvou různých pruhů, mohou jet současně. Samostatná zkouška po opravě prošla, oba vozy projely bez dotyku. Prošlo 106 testů JavaScriptu a sestavení. V desetiminutové kontrole Klatovské žádné sledované auto pod plynem neopustilo vozovku a nejdéle stálo 68 sekund. Výsledek zbývajících kontrol bude v `soubeh-po.log`. Při všech šesti úspěších a bez dalšího nového selhání v původní úplné sadě naváže kontrola všech 167 zkoušek v `soubeh-uplna.{log,json}`. Stav návaznosti zapisuje `soubeh-navazani.log`.

Všech šest cílených kontrol opravy prošlo. Na Klatovské i u hlavního nádraží byla nejdelší doba stání 68 sekund při limitu 120 s. Ani na jednom místě žádné sledované auto pod plynem neopustilo vozovku. Ověřeno bylo také vyhnutí se vraku, přednost protisměru a plánování odbočení přes Husovu. Zbývá výsledek úplné sady.

Úplný běh před opravou řazení skončil 166 úspěchy ze 167. Selhala jen Klatovská. Úplný běh revize `114f0b7` obsahuje 168 zkoušek včetně nového řazení. Při prvních šesti zkouškách WebGL 2 se Mac opakovaně uspal. Všechny skončily překročením časového limitu při čekání na prohlížeč nebo při jeho zavírání. Po probuzení pokračuje stejný běh, jeho výsledky jsou v `data-raw/e21/soubeh-uplna.{log,json}`. Po dobu běhu je omezeno automatické uspání z nečinnosti. Hned po dokončení se znovu spustí pouze těchto šest zkoušek se stejnými limity a stejným sestavením, do `data-raw/e21/po-probuzeni.{log,json}`. Zkontrolovat výsledky obou sad včetně případných dalších selhání před uzavřením kroku 2.

Ze stejné kamery na WebGPU byly pořízeny snímky před ulomením lampy a po něm. Je vidět zhasnutý přechod, spadlý stožár a samostatná hlava lampy. Snímky jsou v `data-raw/e21/lampy-snimky/`. Po úplné sadě a opakování šesti přerušených zkoušek naváže zkušební měření deseti současných kolizí s lampami do `data-raw/e21/deset-lamp.{log,json}`. Výsledné měření výkonu se zopakuje v kroku 8. Mimo herní kód je ověřený kloub pro připravovaný krok značek. Pokus `data-raw/e21/kloub-pokus.mjs` upevnil 2,4m sloupek k zemi. Sloupek se během 1,5 s ustálil v trvalém náklonu přibližně 35°. Zapojení do hry je krok 3.

Ve stejné úplné sadě po probuzení prošly obě desetiminutové zkoušky provozu. Nejdelší stání bylo 71,5 s na Klatovské a 50,5 s u hlavního nádraží. V obou případech byla všechna sledovaná auta při jízdě pod plynem na vozovce. Prošel i nový cílený průjezd dvou aut přes zúžení u Tylovy. Úplný běh pokračuje.

Před uložením průběžného stavu znovu prošlo 106 testů JavaScriptu a standardní produkční sestavení. Hlavní soubor je totožný se sestavením v úplném běhu (SHA-256 `01a7241f165f27634443d196fe16f9d7f9d556b8c8023c7cf6c2c5c65200210a`).

Krok 2 je uzavřen. Úplný běh dokončil 162 ze 168 zkoušek. Šest zkoušek přerušených uspáním Macu při samostatném opakování prošlo na stejném sestavení. Dohromady prošlo všech 168 různých zkoušek. Bez vynechání, změny očekávání nebo úpravy časových limitů. Hlavní přehled je v `data-raw/e21/soubeh-uplna.json`, opakování v `po-probuzeni.json`, porovnání konkrétních případů v `soubeh-soucet.py`.

První měření deseti lamp proběhlo v předvolbě vysoká při 1920 × 1080 přes WebGPU na hardwaru Apple. V osmi snímcích bylo maximum 26 ms včetně dokončení vykreslení. V samotných dvou krocích zlomení trvalo vše 21,6 a 16,8 ms a fyzika 1,8 a 1,3 ms. Při umělé souběžné kolizi deseti těles se šest lamp zlomilo v prvním kroku a čtyři v následujícím. Softwarové vykreslování SwiftShader je v samostatném záznamu. Konečné měření celé etapy zbývá v kroku 8. Záznamy jsou v `data-raw/e21/deset-lamp-hw.json` a `deset-lamp.json`.

## Značky a semafory

Rozměry sloupku a štítu nebo skříně semaforu vycházejí z jednoho popisu. Světelná skříň pro chodce má stávající odlišnou výšku. Po změně rozměrů prošlo 108 zkoušek v Node, sestavení a pět prohlížečových kontrol lamp, sdílených fází MHD a stávajících osmi referenčních pohledů. Podklady `data-raw/e21/znacky-rozmery-{node,build,e2e}.log`.

Značka i semafor nyní při změně stavu ve stávajícím registru skryjí všechny části současně. Registr odstraní vazbu při odložení grafické dlaždice. Prošlo 108 zkoušek v Node, produkční sestavení a pět cílených prohlížečových zkoušek. WebGL 2 i WebGPU ověřily, že u značky zmizí dva díly a u semaforu pět dílů. Při opravě se všechny vrátí na původní místo. Záznamy jsou v `data-raw/e21/znacky-matice-{node,build,e2e}.log`. Další práce připojí fyzikální tělesa a nastaví provoz při výpadku semaforu. Podklady k ověřenému kloubu jsou v `data-raw/e21/znacky-navazani.md` a `kloub-pokus.log`.

Značka má jedno pevné těleso pro sloupek a štít. Střední náraz ji ohne přes pružný kloub u země. Po ustálení drží náklon jako pevné těleso, které lze dále zlomit. Poloha a náklon se uchovají po odjezdu a návratu. Silný náraz oddělí štít a sloupek. Semafor po zlomení zhasne spolu se světly téže křižovatky. Řidiči zpomalí, počkají na vozy v křižovatce a dají přednost zprava. Výpadek jednoho společného řízení předejde různým pravidlům v příčných směrech. Společně se zpracuje nejvýše 20 těles lamp, značek a semaforů za krok.

Ve zkoušce s vozem o hmotnosti 1 000 kg značka při 6 km/h vydržela, při 18 km/h se ohnula a při dalším nárazu 43 km/h zlomila. Semafor vydržel při 45 km/h a zlomil se při 65 km/h. Prohlížečové zkoušky na WebGL 2 a WebGPU ověřily ohnutí, zhasnutí, dva odlomené díly a ranní opravu. Záznam je v `data-raw/e21/semafor-e2e.log`.

První pozorování po připojení těles ukázalo dlouhé stání na Americké. Kombi přidávalo plyn, ale před jeho nárazníkem byla pata pěšího semaforu skutečně uvnitř vozovky. Doloženo v `data-raw/e21/znacky-fyzika-e2e/` a `znacka-americka.json`. Původní polohu zachováme, kdykoli je mimo vozovku. Paty v jízdním pruhu se přesunou s tělesem i zobrazením na nejbližší místo u vozovky. Zdrojový identifikátor a řízený přechod zůstávají. Test kontroluje konkrétní pěší semafor na Americké.

Po opravě polohy prošlo 112 testů v Node a produkční sestavení. Běží 13 cílených prohlížečových zkoušek včetně obou desetiminutových pozorování v `data-raw/e21/znacky-mimo-pruh-e2e.log`. Po jejich úspěchu automaticky naváže úplná sada `znacky-uplna.{log,json}`. Před uzavřením kroku 3 vyhodnotit oba běhy a kontrolu umístění v `paty-semaforu.json`.

Kontrola polohy prošla všech 8 004 patek. Hrubší vyhledávání přesunulo 1 781 objektů a ponechalo jedinou značku zákazu vjezdu u 17. listopadu v jízdním pruhu. Mezi budovou a okrajem vozovky se pro tuto značku našel úzký volný chodník. Jemnější hledání jako druhý pokus přesunulo i poslední patu. V konečném dvojitém měření bylo přesunuto 1 782 patek a žádná nezůstala ve vozovce. Podklady `data-raw/e21/paty-semaforu.json`, `paty-semaforu-po.json` a `bory-znacka.json`. Po opravě polohy semaforu na Americké prošla desetiminutová Klatovská s maximem 66 s. Zkouška nárazu na obou vykreslovačích také prošla po výběru značky, k níž nárazové těleso může dojet volnou cestou.

U hlavního nádraží potom jiné pozorování naměřilo stání 137,5 s. Záznam `data-raw/e21/nehody-znacky-nadrazi.json` zachytil opakované nehody na sjezdové rampě. První vůz narazil podvozkem do terénu, ztratil řízení a o šest metrů dál rozbil semafor. Samostatný průjezd prázdnou rampou chybu zopakoval. Pickup najel do prudké části rychlostí 9,75 m/s a dostal náraz 9 077 N·s. Řidiči nyní před strmým klesáním přibrzdí podle výškového profilu. Na stejné rampě po úpravě zůstal pickup v režimu běžného provozu a dojel na spodní úsek. Záznamy `nadrzi-svah.json` a `nadrzi-svah-po.json`.

Výsledné sestavení prošlo 113 testy JavaScriptu a sestavením. Běží 14 cílených zkoušek v `data-raw/e21/znacky-rampe-e2e.log`. Zahrnují jednotlivý průjezd rampou i obě desetiminutové zkoušky. Při úspěchu naváže závěrečná úplná sada do `znacky-uplna.{log,json}`. Limity zkoušek zůstaly stejné. Krok 4 začne po vyhodnocení výsledku.

Po úpravě rampy prošlo všech 14 cílených zkoušek. Nejdelší čekání bylo 95,5 s na Klatovské a 62 s u hlavního nádraží. Žádné sledované auto pod plynem neopustilo vozovku. Na snímcích před a po je vidět náklon značky 27,4°. Jsou v `data-raw/e21/znacka-snimky/`.

Ve směně MHD se nově u zhasnutého návěstidla zobrazuje „Semafor mimo provoz“. Tento poslední nález vedl k ukončení právě zahájené úplné kontroly a spuštění nové nad výsledným sestavením. Prošlo 114 testů JavaScriptu a produkční sestavení. Nyní běží 174 prohlížečových zkoušek v `data-raw/e21/znacky-final-uplna.{log,json}` s ochranou proti uspání z nečinnosti. Původní krátký běh zůstal v `znacky-uplna.log`. Po vyhodnocení úplné sady bez dalších nálezů uzavřít krok 3 a pokračovat zábradlím a uzavírkami.

Při úplné kontrole se Mac v 9:09 místního času uspal po zavření víka. WebGL 2 překročilo limit u panelu měření a u vyhlazení obrazu na dvou předvolbách. Záznam uspání se shoduje s dobou těchto zkoušek. Stejná sada pokračuje od probuzení. Po jejím skončení se přesně tyto tři zkoušky zopakují nad stejným sestavením a limity. Výsledek bude v `data-raw/e21/znacky-po-viku.{log,json}`. Ostatní selhání vyhodnotit zvlášť.

Pro navazující zábradlí ověřil samostatný fyzikální pokus uzavřený tvar vytvořený ze stávajících rohů mostního úseku. Auto o hmotnosti 1 000 kg při 50 km/h vyvolalo na kamenné zídce impulz 13 808 N·s. To je pod prahem 30 000 N·s. Při 60 km/h na oceli dosáhlo 16 556 N·s a překročilo práh 12 000 N·s. Herní kód zábradlí zatím zůstává ve stavu E19. Podklady `data-raw/e21/zabradli-navazani.md` a `zabradli-tvar-pokus.json`.

## Přerušení práce 19. listopadu 2026

Vývoj je na žádost autora pozastavený. Poslední změny hry jsou v revizi `c031baf` na místní větvi `etapa/E21`. Na GitHubu je sloučená E20 v revizi `623e081`. Krok 3 v E21 čeká na úplnou kontrolu.

Prošlo 114 testů JavaScriptu a produkční sestavení. V přerušeném běhu `znacky-final-uplna.json` prošlo 139 ze 174 zkoušek. Tři zastavilo uspání Macu, jedna byla přerušena na žádost autora a 31 se ještě nespustilo. Při přerušení bylo zrušeno i naplánované opakování. V cloudovém prostředí spustit úplnou sadu nad toutéž verzí kódu a podle výsledku navázat. Snímky lamp a ohnuté značky i místní protokoly testů leží v ignorované složce `data-raw/e21/`.

### Navázání v cloudu

Na větvi `etapa/E21` prošlo na převzatém kódu 114 testů JavaScriptu a produkční sestavení. V prohlížeči prošly první tři zkoušky E21 na WebGL 2. Při kontrole výpadku na přechodu odhalil nový test chybu. Po zničení pěšího semaforu auta na stejné křižovatce dál dostávala zelenou. Pěší i vozidlová návěstidla teď přidávají svou identitu do stejné skupiny při stavbě křižovatky. Samostatná zkouška pokrývá i sousední křižovatku a obnovení světel po ranní opravě.

Po opravě prošlo všech 115 testů JavaScriptu, produkční sestavení a rozšířená zkouška pěšího semaforu na Americké ve WebGL 2. Zbývající prohlížečové zkoušky probíhají na stejném sestavení. Výstupy jsou v `data-raw/e21/pesi-{node,build,americka,e2e}.log`.
