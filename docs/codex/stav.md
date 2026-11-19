# Stav etapy E24

E24 navazuje na G17 ve větvi E23 (`fe30ef0`). [Zadání E24](E24.md)

## G18 a G20 · Fasády a střechy

Na střední až ultra předvolbě se sedm fotografických fasád řídí typem budovy a paletou čtvrti. Okna, sokl a ostění sdílejí souřadnice. Pět střešních vrstev rozlišuje tašky, plech, měď, lepenku a vláknocement. Měděná patina na katedrále začíná až na věži. Převod spároval materiálové údaje OSM s 138 budovami projektu. Ostatní plochy používají výběr podle stylu a barvy.

U 21 fotografických podkladů CC0 prošla kontrola velikosti a zdrojového otisku. Oba převody vytvořily shodné atlasy. Prošlo 161 testů JavaScriptu, 25 testů Pythonu a produkční sestavení. WebGL 2 i WebGPU načetly atlasy a vykreslily měřené i běžné budovy.

## G19 · Místnosti za okny

Osm vlastních variant bytu, kanceláře, obchodu a schodiště má v atlasu po pěti stěnách. Při chůzi kolem budovy se podle směru pohledu odkrývá jiná část místnosti. Závěsy a žaluzie si každé okno drží na místě a večer se rozsvěcí podle rozvrhu E23. Nízká předvolba si ponechává původní okna.

Prošlo 161 testů JavaScriptu, 26 testů Pythonu a produkční sestavení. Kontrola porovnala všech 40 dlaždic s generátorem. WebGL 2 i WebGPU zaznamenaly změnu barev za stejným oknem po načtení atlasu a další změnu po posunu kamery.

## Výchozí etapa E23

E23 vychází z dokončené větve E22 (`496a72d`). Prvním krokem je detail země při chůzi. Další pořadí tvoří povrchy silnic, voda, stromy, tráva, noční světla a částice. [Zadání E23](E23.md) · [Protokol E22](../E22.md)

## G11 · Detail terénu

Dva atlasy obsahují šest fotografických povrchů včetně normálových map z Poly Haven (CC0). Na střední až ultra předvolbě se mísí s původní barvou země. Čtyřmetrová maska respektuje otvory v polygonech, vodu i pořadí překrývajících se tříd. Detail slábne od 80 do 120 m od kamery. Svahy nad 35° používají tři projekce. Nízká předvolba používá původní materiál a atlasy nestahuje.

Otisky všech 12 zdrojových souborů jsou v převodním seznamu a dva převody se po bajtech shodují s distribuovanými atlasy o souhrnné velikosti přibližně 3,7 MiB. Licence je v README i v nabídce O hře. Prošlo 151 testů JavaScriptu, 25 testů Pythonu a produkční sestavení. Na střední předvolbě byla nalezena rekurze při čtení normály upravovaného materiálu. Detail nyní používá výchozí normálu geometrie. Opakované vykreslení prošlo na WebGPU i WebGL 2 a na WebGPU prošla také nízká předvolba bez požadavků na nové textury.

Rozdíl po přenosu atlasů zachycují dva snímky ze stejného místa a zastavené kamery. [Původní svah](../E23/teren-pred.jpg) · [Svah s detailem](../E23/teren-po.jpg)

## G12 · Asfalt a mokrá vozovka

Na střední až ultra předvolbě se četnost záplat a intenzita vyjetých stop řídí třídou silnice a týdenním průměrem naměřené dopravy. Stopy sledují jízdní pruhy. Záplaty a mříže u městských obrubníků navazují přes hranice dlaždic. Za mokra se mění drsnost asfaltu a odlesk v kolejích. Vodorovné značení si zachovává vlastní vykreslovací vrstvu. Nízká předvolba používá původní geometrii bez dalších atributů.

Prošlo 153 jednotkových testů a produkční sestavení. Mokrou silnici na střední předvolbě vykreslily WebGL 2 i WebGPU. Obě prohlížečové kontroly ověřily provozní profil geometrie, šířky pruhů, pořadí značení a kompilaci materiálu. Měření plynulosti na autorově grafice zůstává otevřené.

## G13 · Řeky a jezy

Dvě vrstvy vln postupují po směru střednice toku z OSM. Samostatné rybníky mají klidný povrch. Vzdálenost od břehu mění odstín vody, úhel pohledu její odlesk. Mapa prostředí osvětluje hladinu na střední a vyšší předvolbě. Ultra na podporovaném vykreslovači přidává odraz viditelných předmětů přes SSR v polovičním rozlišení. Pěna a sprška používají souřadnice jezů ze zvukové mapy. Sprška sdílí rozpočet s ostatními částicemi.

Prošlo 154 jednotkových testů a produkční sestavení. Syntetická řeka ověřila obrácení proudu, mělký břeh, samostatný rybník a návaznost dlaždic. Čtyři prohlížečové zkoušky vykreslily nejbližší jez na střední a ultra předvolbě ve WebGL 2 a WebGPU. Ověřily tok, pěnu, vznik částic i připojení mapy prostředí. Na WebGPU prošla také opakovaná kontrola ultra s odečtem masky odrazů na podporovaném adaptéru.

## G14 · Stromy a roční období

Čtyři vlastní modely představují listnatý a jehličnatý strom, keř a ovocný strom. Z historického dotazu na datum mapy získala hra druh olistění pro 11 379 stromů a 118 ploch. Jednotlivé stromy jsou přiřazené podle polohy, lesní plochy podle vrcholů obvodu. Tam, kde druh chybí, rozhoduje typ plochy. Na střední až ultra předvolbě se blízké koruny pohybují ve větru. Ve vzdálenosti kolem 150 m přebírá obraz atlas s 25 směry pohledu pro každý model a období. Opadavým stromům v zimě zůstávají kmen a větve. Nízká předvolba zachovává původní modely.

Sestavení atlasu a převod mapových značek se po opakování shodovaly po bajtech. Atlas má 96 KiB a mapa olistění 106 KiB. Prošlo 156 jednotkových testů JavaScriptu, produkční sestavení a 24 z 25 zkoušek Pythonu. Jedna kontrola vyžaduje úplný archiv městských objektů. Ve WebGL 2 i WebGPU prošlo vykreslení lesa poblíž Dobříva, výměna obou úrovní detailu a zachování polohy překážek při změně data na leden.

## G15 · Tráva zblízka

V parcích, na loukách a v travních plochách se kolem hráče vytvářejí trsy čtyř stébel. Jejich rozmístění je stálé při odchodu a návratu. Hustota závisí na třídě plochy a zelené složce dostupného ortofota. Výběr vynechává vodu, budovy i celou šířku cest a silnic ve stejné výšce. Vrcholy stébel rozhýbává vítr. Dosah je 30 m na střední, 50 m na vysoké a 80 m na ultra předvolbě. Nízká předvolba trsy nevytváří.

Prošlo 157 jednotkových testů a produkční sestavení. Zkoušky na WebGL 2 a WebGPU našly skutečný městský park, vykreslily jeho trsy a prověřily polohu každého trsu vůči cestám a budovám. Po přesunu pohledu 100 m nad terén tráva zmizela. Rozpočet vykreslování se změří společně s ostatními efekty na konci etapy.

## G16 · Noční osvětlení

Na náměstí a v okolních ulicích osvětlují blízké povrchy skutečná bodová světla. Střední předvolba vybírá až 48 nejbližších lamp, vysoká 128 a ultra 256. Odlehlejší lampy používají původní světelné skvrny. Zhasnutá nebo odstraněná lampa přestane osvětlovat okolí. Vysoká a ultra předvolba mají navíc kuželové světlomety nejvýše osmi nejbližších jedoucích vozů. Přes den hra přepne zpět na běžné osvětlení. Okna domácností se postupně rozsvěcují večer, kanceláře ve dne a výlohy zhasnou ve 20 hodin.

Prošlo 159 jednotkových testů a produkční sestavení. WebGL 2 i WebGPU vykreslily náměstí ve 22 hodin na vysoké předvolbě se 128 bodovými světly. V obou případech zhasla vybraná lampa a při návratu k poledni se skupina nočních světel vypnula.

## G17 · Částice od kol a jezů

Na suché polní cestě a v trávě se od zadních kol zvedá prach. Na mokré vozovce vzniká sprška tam, kde se při stejném sklonu a poloze vykresluje kaluž. Scénu lze vyzkoušet s parametrem `?wet=1`. Kola ve vzduchu nic nevypouštějí. Fyzika částic zahrnuje boční úlet a gravitaci. Počet efektů od kol je omezen i při souběhu více aut a spršky z jezu. Nízká předvolba používá dřívější efekty E21, v nastavení lze vypnout všechny částice.

Prošlo 160 jednotkových testů a produkční sestavení. Oba vykreslovače ověřily vznik částic od kol, zastavení emise ve vzduchu i společný rozpočet. WebGPU přečetl výslednou polohu z výpočetního bufferu, WebGL 2 ověřil stejný výpočet na CPU. Závěrečné ověření E23 zahrnuje rozpočet všech předvoleb, referenční pohledy a měření výkonu.

## Výchozí etapa E22

Ve větvi `etapa/E22` jsou převedené městské objekty, ověřený Wilsonův most i tři dávky zdí a pilířů. Hra používá další dvě lávky, silniční desku, dvě železniční mostovky a čtyři díly jezů. Vývoj a dostupné přejímací kontroly E22 jsou dokončené. Zůstává porovnání s autorovými fotografiemi a změření plynulosti na jeho zařízení. [Protokol E22](../E22.md). [Zadání E22](E22.md) · [Výsledky převodu a pilotu](#e22--převod-a-inventura)

## Výchozí etapa E21

Větev `etapa/E21` navazuje na E20 sloučenou revizí `623e081`. [Zadání E21](E21.md) · [Protokol předchozí etapy](../E20.md)

| Krok | Stav |
| --- | --- |
| 1. Registr a stálé identifikátory | Hotovo. Každý svět má vlastní registr. Značky a hlavy semaforů dostávají identitu ve zdrojovém pořadí své dlaždice před seskupením podle materiálu. |
| 2. Lampy | Hotovo. Společné umístění pro grafiku a fyziku, sražení, zhasnutí, dvě části lampy, obnova po návratu a ranní oprava prošly ověřením. |
| 3. Značky a semafory | Funkční kontroly včetně návratu po opravě a dopravní špičky prošly. Celková grafická kontrola na cílovém zařízení zůstává otevřená. |
| 4. Mosty a uzavírky | Hotovo. Náraz, návrat a oprava ověřeny ve fyzice a průjezd autem na WebGL 2 i WebGPU. |
| 5. Následky nárazu | Hotovo. Hledanost, zvuky a společný limit úlomků jsou zapojené do hry. |
| 6. Auta a garáž | Hotovo. Prošly deformace, odpadnutí dílu, načtení uloženého poškození a oprava v garáži. |
| 7. Částice | Hotovo. Prošla kontrola výpočtu na WebGPU i náhradního výpočtu na WebGL 2. |
| 8. Závěrečné ověření | Probíhají závěrečné prohlížečové zkoušky. Snímky a měření ze softwarového vykreslovače jsou v protokolu. Měření na autorově počítači je otevřené. |

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

Na revizi `243735c` prošlo všech sedm prohlížečových scénářů v `breakables.spec.js` (čtyři na WebGL 2 a tři na WebGPU) a všech 23 testů Pythonu. Obě desetiminutové zkoušky ranní špičky prošly. Na Klatovské se vystřídalo 120 aut, nejdelší stání bylo 68,5 s. U hlavního nádraží bylo 103 aut a nejdelší stání 60,5 s. Ani na jednom místě sledované auto nevyjelo pod plynem z vozovky. Výsledky jsou v `data-raw/e21/spicka-cloud/`.

Úplná kontrola kroku 3 zůstává otevřená. V cloudu (2 procesorová jádra pro výpočet, softwarové vykreslování) dosáhly grafické testy E17 při vysoké kvalitě a ultra limitu 90 s v pohledu na Lochotín. U ultra se to zopakovalo ve dvou verzích Chromia (156 a projektová 159) a také v samostatné kopii původní E20 na revizi `623e081` s Chromiem 159. Test skončil před výsledkem počtu volání a trojúhelníků pro tento pohled. Původní limity i grafické předvolby zůstávají součástí závěrečného ověření. Záznamy jsou v `data-raw/e21/{pesi-e2e,ultra-159,e20-ultra}.log`.

### Mostní zábradlí a uzavírky

Každý díl zábradlí má vlastní identitu uvnitř společné kolizní sítě dlaždice. Rozbití dílu otevře mezeru a uvolní pohyblivý kus. Ostatní úseky dál drží chodce i vozidla. Zábrany uzavírek se dají odtlačit, pamatují si polohu po návratu do oblasti a při ranní opravě se vrátí na původní místo. Změna očekávání ve starší zkoušce E19 odpovídá nové kolizi auta se zábradlím. Všech sto pěších náběhů zůstalo součástí testu.

Prošlo 119 testů JavaScriptu a sestavení. Ve fyzice se ověřilo chování tří typů zábradlí, odtlačení zábrany i obnova. V prohlížeči auto na WebGL 2 i WebGPU projelo vzniklou mezerou. První zvolená trajektorie na složitém napojení křížila jinou pevnou konstrukci. Zkouška nyní vybírá úsek s volným kolmým příjezdem po vozovce. Kontroluje skutečný pohyb auta, vznik dílu, stav po návratu a opravu. Výstup je v `data-raw/e21/mosty-prujezd.log`.

### Hledanost, zvuky a úlomky

Škodu na veřejném majetku připisuje hra řidiči vozidla, které se objektu skutečně dotklo. Kov, sklo a kámen mají odlišný zvuk. Lampy, značky a zábradlí sdílejí rozpočet 40, 100 nebo 200 pohyblivých úlomků podle předvolby. Při plném rozpočtu dostanou při úklidu přednost spící díly mimo pohled.

Prošlo 120 testů JavaScriptu, produkční sestavení a všech devět prohlížečových zkoušek vybavení. Závěrečný test mostu používá samostatnou zkušební mostovku nad mapou. Hráčovo vozidlo projede vzniklou mezerou a po návratu i opravě se kontroluje stav úseku. Tato zkouška a připsání škody po sražení lampy prošly na obou vykreslovačích. Výsledky jsou v `data-raw/e21/ulomky-{node,build,e2e,final}.log`.

### Poškození vozů a garáž

Fyzika zaznamená místo kontaktu na každém zúčastněném voze. Karoserie se promáčkne nejvýše o čtvrt metru a při větším poškození může přijít o kapotu, dveře nebo nárazník. Oddělené díly mají vlastní fyziku a společný rozpočet s ostatními úlomky. Poškozenému autu slábne motor, boční poškození ovlivní řízení. Garáž ukládá stav dílů a opraví ho společně se zdravím auta. Starší uložení načte s původním zdravím.

Prošlo 124 testů JavaScriptu, sestavení a pět cílených prohlížečových zkoušek. Test na obou vykreslovačích vrazil vlastním autem do samostatné zkušební stěny, ověřil pohyblivý díl, návrat chybějící části po načtení jako stále poškozené a obnovu po zaplacení v garáži. Výsledky jsou v `data-raw/e21/panely-{node,build,e2e}.log`. Kouř z motoru navazuje v kroku 7.

### Částice

Jiskry při drhnutí kovu, střepy, prach a kouř z poškozeného motoru sdílejí jednu geometrii a rozpočet podle předvolby. Efekty lze vypnout v nastavení. Na WebGPU počítá polohy a velikosti výpočetní průchod TSL. Na WebGL 2 dělá stejný výpočet procesor. Prošlo 125 testů JavaScriptu a sestavení. Prohlížečová zkouška na obou vykreslovačích přečetla polohu a velikost střepu, ověřila jeho pohyb, zmenšování a zánik. Na WebGPU četla přímo výstup výpočetního průchodu. Výsledky jsou v `data-raw/e21/castice-{node,build,e2e}.log`.

### Sloupky a závěrečné ověření

Uzavírky dostaly 302 samostatných herních sloupků. Jejich zobrazení a fyzika používají společnou polohu. Sloupek se při nárazu odlomí jako jeden díl a v určenou hodinu se obnoví. Prošlo 126 testů JavaScriptu, 23 testů Pythonu a sestavení. V první části závěrečného běhu prošlo všech sedm scénářů vybavení a garáže na WebGL 2 včetně polohy, skrytí a počtu sloupků.

V testu deseti zkušebních lamp na softwarovém WebGPU se všech deset rozbilo. Maximum času do dokončení celého snímku bylo 7 508,2 ms, maximum práce procesoru 107,2 ms. Rozpočet 50 ms na počítači autora čeká na měření. Dva snímky ze stejné kamery ukazují deformaci přídě a ztrátu předního nárazníku. [Protokol E21](../E21.md).

Závěrečný cílený běh zahrnuje 30 scénářů E21, rozvozů a provozu. Na něj naváže úplná sada. Záznamy jsou v `data-raw/e21/zaver-{cilene,uplna}.log`. Přijetí etapy zůstává otevřené do vyhodnocení prohlížečových zkoušek a měření na cílovém počítači.

### Opravy po závěrečné kontrole

Odpadlý panel se umístí podle tělesa auta včetně natočení. Po průrazu zůstává na hraně mostovky samostatná kolize pro pěší postavu. Rozpočet tvorby těles zahrnuje i tuto síť. Prošlo všech 126 testů JavaScriptu a produkční sestavení. Regresní zkoušky přímo porovnaly polohu panelu u vozu otočeného o 90 stupňů a pohyb pěší postavy směrem k mezeře po návratu na dlaždici.

Na starší revizi `b14f83d` prošlo 18 z 30 závěrečných cílených případů, tři doběhly do časového limitu, jeden byl přerušen a osm se nespustilo. Běh byl ukončen po sestavení opravy. Na nové revizi prošel průjezd zkušební mezerou na obou vykreslovačích a zkouška garáže na WebGPU. Garáž na WebGL 2 poprvé vyčerpala 90 s při opětovném načítání stránky. Záznamy nové revize jsou v `data-raw/e21/revize-{node,build,e2e,garaz,uplna}.log`. Opakování a úplná sada mají v cloudu časový limit 240 s na případ. Funkční podmínky ani rozpočty jednotlivých kontrol se nemění.

Garáž při opakování na WebGL 2 prošla včetně nového načtení a zaplacení opravy. Úplný prohlížečový běh nyní používá samostatné sestavení s oběma opravami z kontroly.

### Návazné ověření referenčních scén

Při kontrole na softwarovém vykreslovači se dřívější časový limit přípravy pohledu na Valík vyčerpal i při pokračujícím načítání. Kontrola nyní sleduje počet kroků geometrie, dokončené přenosy i postupné překreslování ortofota. Po skutečném zastavení vypíše stav dlaždic. Odečet expozice čeká na nový vykreslený snímek a dokončení předchozího čtení pixelů. Prahy pro jas a rychlost přizpůsobení oka se zachovaly.

Prošlo 127 testů JavaScriptu, 23 testů Pythonu a produkční sestavení. Změnu jasu při vjezdu do tunelu a výjezdu na denní světlo potvrdil WebGPU i WebGL 2. Celý případ na WebGL 2 trval na sdíleném softwarovém vykreslovači 12,6 minuty. Jedná se o délku prohlížečového testu včetně přípravy scény. Úplná sada dalších herních scén pokračuje. Otevřené zůstává měření dopadu deseti fiktivních testovacích objektů na cílovém zařízení autora.

### Letecké snímky během celého průchodu hrou

Při jízdě a následném přesunu k vrtulníku na softwarovém WebGL 2 vypršelo osm sekund na načtení dostupného bloku ortofota. Rozvoz skončil, ale prohlížeč ohlásil přerušený požadavek. Pro jednotlivý snímek je nyní na přenos minuta. Jestli přenos vyprší a snímek je ještě v dohledu, hra ho vyžádá podruhé. Po druhém vypršení uvolní místo dalším snímkům. Při návratu do oblasti může přenos začít znovu. Odpověď 404 se znovu nezkouší.

Po změně prošlo 128 testů JavaScriptu a produkční sestavení. WebGL 2 dokončil chůzi, navigaci, jízdu autem, let vrtulníkem, přistání i placený rozvoz. Během celého případu prošly také původní kontroly chyb konzole, síťových odpovědí a skutečného načtení vybraného leteckého snímku. Ověření je v `data-raw/e21/ortofoto-pruchod.log`.

### Start hry a výměna grafických zdrojů

Prohlížečové kontroly křížení, Rondelu a památek nyní čekají na stejný signál připravenosti jako hra. Zkouška změny kvality sleduje také dokončení výměny grafických zdrojů. Na sdíleném WebGL 2 prošly obě zkoušky památek, přepnutí grafiky, terén u Klabavy a průjezdy u D5. Opakování nad navazujícím sestavením E22 ověřilo také Rondel a úrovně v Bolevci. U kompletního herního průchodu ve stejné sérii selhal přenos snímku na starém sestavení. Po opravě `0e12604` prošel celý tento případ. Výsledky posledního jednotkového a produkčního sestavení jsou uvedené výše. Úplná prohlížečová regrese a samostatné opakování materiálových scén na softwarovém vykreslovači stále běží.

### Samostatné grafické indexy terénních dlaždic

Při uvolňování dlaždic v navazujícím měření WebGPU došlo k chybě při likvidaci grafického atributu. Kontrola zjistila, že různé geometrie sdílely tentýž atribut indexů a každá jej při svém zániku uvolnila. Dlaždice nyní sdílejí pouze čísla vrcholů v paměti a každá vlastní svůj samostatně uvolnitelný atribut. Prošlo 128 testů JavaScriptu, produkční sestavení i nová prohlížečová zkouška vlastnictví atributů na WebGPU. V měření se samostatně vyskytlo také odmítnutí alokace grafického bufferu v softwarovém adaptéru. Dopad na celý měřený průjezd ještě není ověřen.

## E22 · Převod a inventura

Samostatná pracovní větev začíná nad rozpracovanou E21. Oficiální archiv má otisk `825dc3e395044b1f5a47e27c812cc4189829e9134cc027865ffc8fcb3e7bb9ac`. Převod přečetl 614 záznamů, 602 ID a všech 12 315 ploch. Po sloučení totožných ploch uvnitř ID vytvořil 715 souvislých dílů. Z toho má 93 dílů totožnou geometrii jako jiný díl, jeden nemá použitelný trojúhelník a 621 čeká na prostorovou kontrolu. Každá zdrojová plocha je započtena.

Dva úplné převody daly po bajtech shodné soubory `plochy.json`, `dily.json` a `inventura.tsv`. Výsledky jsou v `data-raw/structures/`. Na třech kontrolních bodech se převod do souřadnic hry shodl do pěti centimetrů s nezávislým výpočtem proj4js. Prošlo 128 testů JavaScriptu, 25 testů Pythonu a produkční sestavení. Do běhu hry zatím měřené objekty nevstupují.

### Průchodnost a výšky

Kontrola porovnává trojúhelníky městských ploch s průchozími objemy herních cest včetně sklonu a různých výškových úrovní. Zahrnuje vozovky, parkovací prostor provozu, koleje, pěší cesty a přechody, zastávky, cíle, start, garáž a výchozí okolí heliportů. Ze 715 dílů zasahuje 289 alespoň do jednoho kontrolovaného objemu. Tento průnik je podnětem k posouzení před zařazením. Porovnání výšek u mostních ploch a pilířů obsahuje 91 řádků. Zprávy jsou v `data-raw/structures/strety.tsv`, `vysky.tsv` a `kontroly.json`.

Větev převzala změny E21 včetně sloupků a protokolu z `b14f83d`. Prošlo 130 testů JavaScriptu, 25 testů Pythonu a produkční sestavení. Dalším krokem E22 je volitelný balík herních modelů, kontrola jeho otisků a zkouška statického pilotního objektu.

### Volitelný model pilíře

Třetí krok přidává měřený pilíř Wilsonova mostu. Základní soubor má 2 956 bajtů a slouží zároveň pro vzhled v dálce a kolizi Jolt. Při přiblížení se načte soubor s městskými plochami (2 272 bajtů). Při odjezdu se podrobná geometrie uvolní. Dva převody daly stejné tři soubory a distribuované soubory souhlasí s ověřeným kandidátem. Inventura po zabalení uvádí jeden začleněný díl a 620 dosud čekajících dílů.

Prošlo 131 testů JavaScriptu, 25 testů Pythonu a produkční sestavení. Prohlížeč na WebGL 2 ověřil střet paprsku s horní plochou pilíře, přepnutí na detail a tři způsoby spuštění původní hry: parametr `?structures=0` bez požadavků na vrstvu, odpověď 404 při načítání základu a nesoulad s otiskem silnic. Výpadek detailu a pozdní odpověď po vyložení dlaždice pokrývá také zkouška v Node. Běhy jsou v `data-raw/structures/pilot-{node,python,build,e2e}.log`.

Následuje kalibrace Wilsonova mostu. První řezy horní městskou plochou v 20, 35, 50, 65 a 80 % herního rozpětí ukázaly příčný posun osy o 0,55 až 0,59 m. Průměr výšek obou vnějších okrajů byl v těchto řezech o 0,07 až 0,11 m výš než stávající jízdní profil. Šířka vnějšího obrysu ve středním řezu dosahuje 17,67 m, na ostatních řezech 15,67 až 15,75 m. Do třetího kroku patří pouze pilotní pilíř. Rozměry ani jízdní profil mostovky se v tomto kroku neupravují.

Oporu a načtení detailní geometrie ověřil také WebGPU. Všech pět cílených prohlížečových případů dokončilo zkoušku.

E22 převzala opravy E21 z revize `7398106`. Následná kontrola kódu potvrdila vypořádání obou nálezů. Po sloučení prošlo všech 131 testů JavaScriptu, produkční sestavení a zkouška pilíře na WebGL 2 i WebGPU.

### Kalibrace Wilsonova mostu

Půdorysy z městské sady určují polohu chodníků a kamenného ohrazení včetně jejich rozšíření uprostřed. Herní jízdní plocha dál vychází ze silničního profilu. Pět příčných řezů určilo společnou výškovou opravu 0,103 m a příčný posun konstrukce přibližně 0,58 m vůči ose jízdních pruhů. V každém řezu se vzdálenost mezi vnitřními stěnami liší od 15 m o méně než 0,1 m. Výška herního ohrazení je 1,15 m. Stejné rohy používá kresba a pěší kolize. Kamera protíná pouze viditelné díly a nad ohrazením vidí přes něj.

Konce městské desky a půdorys zaměřeného pilíře určují rozpětí dvou oblouků. Městský model obsahuje desku, samostatný pilíř a ohrazení. Přesná křivka spodního líce oblouků v těchto plochách chybí, proto zůstává herní aproximací. Zdroj a podmínky užití jsou v README a v obrazovce O hře.

Prošlo 134 testů JavaScriptu, 25 testů Pythonu a produkční sestavení. Dvě sestavení dat se shodují po bajtech. Na WebGL 2 prošla chůze po chodníku, zastavení pěší postavy na obou stranách mostu i průchod pod mostem mimo pilíř. Původní zkouška měřila vzdálenost k vnější stěně při pevné tloušťce 0,5 m. Na měřeném půdorysu ověřuje vzdálenost kapsle k vnitřní stěně v rozsahu 0,32 až 0,45 m. U ostatních mostů platí původní požadavek. Další prohlížečové kontroly včetně průjezdu auta a porovnání pohledu před a po se vyhodnocují v `data-raw/structures/kalibrace-final-e2e.log` a `kalibrace-snimky.log`.

### Zdi a pilíře v obvodu Plzeň 1

První obvod přidává 34 zdí a dva pilíře. S dřívějším pilotním pilířem obsahuje základ 37 objektů ve 12 dlaždicích a zabírá 95 276 bajtů. Z 61 nově posuzovaných dílů obvodu jich 24 zasahuje do herních tras. Jeden další pilíř má patu nad terénem a čeká na určení navazující konstrukce. Inventura zachovává důvod u každého dílu.

Převod řeže plochy na hranicích dlaždic. U členitých zdí ověřuje, že zjednodušení nezaplní dvůr nebo průchod. Před zařazením kontroluje původní plochy i výsledný kolizní obal proti herním trasám. Běžící hra nadále načte také starší formát základu. Detail sdílí omezený počet souběžných přenosů s budovami a leteckými snímky.

Dva převody daly stejné soubory jako distribuovaná vrstva. Prošlo 139 testů JavaScriptu, 25 testů Pythonu a produkční sestavení. V obou vykreslovačích prošlo ověření horní plochy zdi ve fyzice s tolerancí 4 cm a načtení podrobného modelu. Snímek na nízké nastavení pochází z dokončeného snímku WebGPU. [Zeď na nábřeží v obvodu Plzeň 1](../E22/obvod-1.jpg)

Po kalibraci mostu prošlo 12 ze 13 cílených prohlížečových případů včetně kamery u kamenného okraje a pěších cest v obou vykreslovačích. Společná zkouška průjezdu Wilsonovým mostem a oběma tubusy Valíku přesáhla čtyři minuty. Nyní mají oba úseky samostatné výsledky při stejných požadavcích na dojezd, stav auta i kontakt kol.

Dva snímky z téže kamery zachycují změnu u středového pilíře a obou oblouků. Oba vznikly na WebGL 2 v nízkém nastavení. [Před kalibrací](../E22/most-pred.jpg) · [Po kalibraci](../E22/most-po.jpg)

### Zdi a pilíře v obvodu Plzeň 2

Druhá dávka přidává 62 zdí a tři pilíře. Kontrola odložila 53 dalších dílů obvodu kvůli průniku s herní trasou. Celkem je nyní ve 26 dlaždicích 102 statických objektů a základ má 357 992 bajtů. Opakované sestavení kandidáta i distribuované soubory se shodují po bajtech.

Na WebGPU s nízkým nastavením prošlo načtení detailu vybrané zdi a kontrola její výšky ve fyzice do 4 cm. Prošlo 139 testů JavaScriptu, 25 testů Pythonu a produkční sestavení. [Měřená zeď v obvodu Plzeň 2](../E22/obvod-2.jpg)

### Zdi, pilíře a protihlukové stěny v obvodu Plzeň 3

Třetí dávka přidává 142 zdí, osm pilířů a dvě protihlukové stěny. U 153 dalších dílů kontrola našla průnik původních ploch s herní trasou. U jednoho dílu přetrval průnik i po zpřesnění kolizního obalu. Jeden další pilíř čeká kvůli výšce paty. V datech pro ostatních sedm obvodů inventura nenašla samostatné zdi, pilíře ani protihlukové stěny k dávkovému zařazení.

Ve všech třech dávkách a pilotu hra načte 254 objektů v 59 dlaždicích. Základ má 811 308 bajtů. Dva převody i distribuované soubory jsou po bajtech shodné. Z celkem 715 zdrojových dílů má 257 stav „začleněn“ včetně tří půdorysů použitých při kalibraci Wilsonova mostu. Dalších 364 čeká na ověření, 93 sdílí geometrii a jeden postrádá použitelnou plochu.

Prošlo 139 testů JavaScriptu, 25 testů Pythonu a produkční sestavení. WebGPU ověřil načtení detailu a fyzickou horní hranu na dvou zdech ve třetím obvodu. Na WebGL 2 prošly také oddělené průjezdy Wilsonovým mostem v obou směrech bez poškození a oběma tubusy Valíku. Dvě zkoušky mimoúrovňových křížení ukončil časový limit při startu hry. [Zeď u ulice v obvodu Plzeň 3](../E22/obvod-3.jpg)

### Porovnání mostů a první dvě lávky

Kontrola prošla všech 42 městských dílů s mostní plochou. U 35 našla pět společných příčných řezů s alespoň jednou vyvýšenou herní cestou nebo kolejí. Kde se překrývá více cest, zpráva uchovává všechny možnosti. Sedm dílů nemá pět společných řezů. Šířka se měří pouze na souvislé ploše protínající zkoumanou osu. [Porovnání mostních ploch s herními trasami](../E22/mostni-rezy.tsv)

U dvou přímých lávek je přiřazení jednoznačné. U herní cesty č. 1921 má deska po úpravě šířku 3,721 m, u cesty č. 1845 má 5,296 m. Obě se podle řezů posunuly příčně přibližně o 0,12 m. Viditelná konstrukce, okraje, herní výškový dotaz a kolize používají stejnou šířku a posun. Svislé rozdíly přibližně 1,6 m a 1,0 m zůstávají k ověření na navazujících pěších přístupech. U vstupů zůstává původní výška herního profilu.

Ověření 26 krajních dílů proti průchozím objemům nenašlo průnik. Opakované sestavení i distribuovaná data se shodují po bajtech. Prošlo 141 testů JavaScriptu, 25 testů Pythonu a produkční sestavení. Na WebGPU prošel hráč po obou lávkách v obou směrech u okrajů. Na konci každé trasy stál na mostovce. Na WebGL 2 prošel také opakovaný test úrovní v Bolevci a u Wenzigovy nad sestavením třetí dávky zdí.

E22 převzala ověřování referenčních pohledů z E21 (`2123df2`). Příprava pohledu zde sleduje také přenos okolních měřených objektů. Po sloučení prošlo 142 testů JavaScriptu, 25 testů Pythonu, produkční sestavení a cílené zkoušky expozice i měřeného pilíře na WebGPU. Druhá prohlížečová zkouška mimoúrovňových křížení včetně D5 také prošla nad sestavením třetí dávky zdí.

### Silniční deska se souběžnou pěší trasou

Na silničním úseku 1831 má konstrukce podle pěti řezů šířku 8,005 m a příčný posun 0,06 m. Převod ověřuje všechny vrcholy souběžné pěší trasy 28147 včetně její šířky. Oba konce této trasy leží uvnitř rozpětí a jejich výška se od silničního profilu liší nejvýše o 0,023 m. Herní výšky u obou napojení zůstávají původní. Rozdíl proti středu městské desky činí přibližně 1,29 m.

Kontrola přijatých krajních dílů proti herním trasám i dva opakované převody prošly. U dalších tří zvažovaných silničních mostů zasáhl navržený okraj do pěší cesty. Jejich úprava čeká na posouzení skutečného konce ohrazení. Prošlo 143 testů JavaScriptu, 25 testů Pythonu a produkční sestavení. Na WebGL 2 projelo auto po úseku 1831 v obou směrech bez poškození. Kontakty kol se od profilu odchýlily o méně než 5 cm. Samostatná zkouška Rondelu prošla nad sestavením třetí dávky zdí.

### Železniční mostovky

U dvou železničních konstrukcí (herní tratě 8 a 21) nyní pět městských řezů určuje proměnnou šířku a boční polohu desky. Na koncích se plynule vrací k dosavadní šířce. Poloha kolejnic, jízdní profil a jejich výška se zachovaly. Stejné části desky používají kresba, Jolt i výškové dotazy hry. Pata nebo profil přístupu by vyžadovaly další ověření, než by šlo převzít městské výšky.

Převod nyní kontroluje výsledné okraje po oříznutí sousedními mostovkami. Trať 6 zůstala v původní podobě, protože by nový okraj zasáhl do pěší cesty i do prostoru kolejí. Důvod je také v inventuře. Dvě sestavení a distribuovaná data se shodují po bajtech. Základ vrstvy má dál 811 308 bajtů.

Prošlo 145 testů JavaScriptu, 25 testů Pythonu i produkční sestavení. Na WebGPU se u obou mostů a na obou okrajích ověřila poloha viditelného vrcholu do 1 cm. Fyzická opora i výškový dotaz uvnitř okraje odpovídaly hernímu profilu do 9 cm. Další práci v E22 tvoří posouzení dosud nezařazených samostatných zábradlí, vodních a ostatních objektů, přístupů k mostům a závěrečný protokol.

### Jezy, nádrže a ostatní objekty

U všech dvanácti samostatných dílů v těchto třech třídách převod porovnal střed a jedinečné vrcholy s vodními polygony hry i půdorysy budov. Výšku každého vrcholu porovnal s terénem pod ním, na němž hra vykresluje hladinu. Čtyři díly jezů se shodují s polohou dosavadních zvuků vody do 12 metrů. Jejich geometrie i výsledné obaly prošly kontrolou herních tras. Základní balík nyní obsahuje 258 statických objektů a má 811 932 bajtů. [Posouzení dvanácti městských dílů](../E22/vodni-objekty.tsv)

Dva z osmi dalších dílů jsou pro tento model terénu nevhodné. Jedna nádrž leží pod povrchem a v půdorysu budovy, jiný díl vystupuje nanejvýš o dva centimetry. Šest dílů čeká na vyjasnění překryvu s trasou nebo podoby břehu. Ve hře se nezobrazují.

Dva samostatné převody se shodují po bajtech s distribuovanými daty. Prošlo 146 testů JavaScriptu, 25 testů Pythonu a produkční sestavení. Na WebGPU při nízké kvalitě se všechna čtyři tělesa načetla v podrobných dlaždicích. U každého test ověřil polohu ve vodním polygonu a vrcholy nad hladinou i pod ní.

E22 převzala opravu načítání ortofota a čekání na sestavení herních scén z E21 (`cf543a2`). Po sloučení prošlo 147 testů JavaScriptu, 25 testů Pythonu i produkční sestavení. Na WebGPU se pozdě načtené ortofoto promítlo do hotové dlaždice a čtyři měřené díly jezů se vykreslily u hladiny.

### Samostatná zábradlí

Kromě dvou městských obrysů převzatých pro Wilsonův most zbývalo prověřit 77 modelů zábradlí. U 15 vedla měřenými plochami průchozí trasa. U dalších 50 leží spodní část v blízkosti jednoho nebo více dílců stávajícího herního ohrazení. U zbývajících 12 nemá alespoň jeden vzorek spodní části oporu do půl metru od herního terénu ani mostovky. Žádný z těchto modelů proto nepřidává samostatnou překážku. Při dalších úpravách příslušné mostovky lze rozhodnutí přezkoumat podle jednotlivých dílů. [Porovnání všech 77 dílů](../E22/samostatna-zabradli.tsv)

Převod doplňuje každý důvod také do inventury a dává po bajtech stejné herní soubory jako ověřený balík s jezy. Prošlo 148 testů JavaScriptu, 25 testů Pythonu i produkční sestavení. Rozlišení opory, trasy a již přítomného ohrazení má jednotkový test s fiktivním modelem.

### Návaznost výšek u dalších pěti mostovek

Deset konců má poblíž vrchol navazující herní cesty téhož dopravního druhu. U dvou lávek a silničního mostu se nejbližší výška liší nejvýše o 1 cm. U železnice je odchylka nejvýše 9 cm. Šest městských řezů čtvrt metru od konce leží o 0,615 až 1,582 m nad průchozím profilem. U čtyř konců chybí souvislý městský řez v ose. Původní výšky tak zachovávají návaznost v místech, kde by plošný posun desky vytvořil schod. [Všech deset kontrol](../E22/pristupy-mostu.tsv)

Kontrola načítání kolejí navíc odhalila záměnu pořadových čísel dráhy a silniční lávky. Na současných datech se tato čísla neshodovala. Zkouška s fiktivními čísly nyní ověřuje, že železniční model při každém pořadí načte vlastní body a výšky. Prošlo 150 testů JavaScriptu, 25 testů Pythonu, produkční sestavení i zkouška obou železničních mostovek na WebGPU. Převod vyrobil přesně stejnou herní geometrii jako publikovaný balík.

Při měření se projevila chyba vlastnictví společných indexů terénních dlaždic. E22 převzala opravu z E21 (`81395df`). Po sloučení prošlo 150 testů JavaScriptu, 25 testů Pythonu, produkční sestavení a dvě zkoušky WebGPU na sdílená čísla vrcholů a na detail jezů. Na WebGL 2 prošel na sestavení s opravou řazení drah také start hry při chybějícím `core.bin`.

### Uzavření E22

Protokol vychází z herního kódu `d7290c3`. Obsahuje všech 715 inventurních řádků, srovnávací snímky a porovnání stejné kamery s vrstvou i bez ní. U Wilsonova mostu přibylo 8,3 % volání vykreslovače a 2,7 % trojúhelníků. Na náměstí ve dne přibylo 6,9 % volání a 4,4 % trojúhelníků. Úplná dvojice snímkových časů jízdy a letu na softwarovém adaptéru chybí. Podrobnosti a omezení jsou v protokolu. Kontrola autorových fotografií a výkonu na jeho zařízení zůstává otevřená. Další vývoj pokračuje krokem G11 v E23.
