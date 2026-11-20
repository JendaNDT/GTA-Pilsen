# Stav etapy E21

Větev `etapa/E21` navazuje na E20 sloučenou revizí `623e081`. [Zadání E21](E21.md) · [Protokol předchozí etapy](../E20.md)

## Uvolnění výjezdu z křižovatky

V desetiminutové zkoušce na Klatovské třídě čekalo jedno auto 381 sekund. U stojícího vozu v sadech Pětatřicátníků ukázal záznam v čase 376 s zelenou, volný přechod a část vozu MHD ve zvoleném výjezdu. V rekonstrukci zůstával z jeho jízdního pruhu volný ještě jeden povolený výjezd. Další měření na původním sestavení zachytilo po čtyřech minutách čekání až 184,5 s. V této koloně už výjezd blokovala i osobní auta z více směrů. Měření jsme potom ukončili a uvolnili prostředky pro ověření opravy.

Řidič může při zelené zvolit jiný povolený směr, když sám čeká nejméně minutu a MHD mu stejně dlouho stojí ve výjezdu se zavřenými dveřmi. Objížďka používá stejné kontroly volných pruhů jako běžný průjezd. Po změně fáze řidič s volnem vyčká, až záď posledního auta z příčného směru uvolní křižovatku. Regresní zkouška této přednosti před úpravou selhala a po úpravě prošla. Na revizi `7d9471b` prošla obě desetiminutová pozorování ranní špičky na WebGL 2. Na Klatovské třídě trvalo nejdelší stání 118 s, u hlavního nádraží 56,5 s. Ověřený limit je méně než 120 s.

Na sestavení s objížďkou prošly v Chromiu na WebGL 2 obě cílené zkoušky. Řidič počkal za krátce stojící MHD, na červenou a před obsazeným druhým výjezdem. Na zelenou odbočil volným směrem. Druhý případ ověřil dřívější chování u odstaveného vozidla. Na sestavení zahrnujícím i čekání příčné osy prošlo 129 testů JavaScriptu a produkční sestavení. Záznamy zkoušek jsou v `data-raw/e21/kolona-objizdka-e2e.log`, `kolona-pricny-node.log` a `kolona-pricny-build.log` ve stejné složce.

| Krok | Stav |
| --- | --- |
| 1. Registr a stálé identifikátory | Hotovo. Každý svět má vlastní registr. Značky a hlavy semaforů dostávají identitu ve zdrojovém pořadí své dlaždice před seskupením podle materiálu. |
| 2. Lampy | Hotovo. Společné umístění pro grafiku a fyziku, sražení, zhasnutí, dvě části lampy, obnova po návratu a ranní oprava prošly ověřením. |
| 3. Značky a semafory | Kontrola návratu po opravě a desetiminutová ranní špička na Klatovské i u hlavního nádraží prošly. Grafická kontrola na cílovém zařízení zůstává otevřená. |
| 4. Mosty a uzavírky | Hotovo. Náraz, návrat a oprava ověřeny ve fyzice a průjezd autem na WebGL 2 i WebGPU. |
| 5. Následky nárazu | Hotovo. Hledanost, zvuky a společný limit úlomků jsou zapojené do hry. |
| 6. Auta a garáž | Hotovo. Prošly deformace, odpadnutí dílu, načtení uloženého poškození a oprava v garáži. |
| 7. Částice | Hotovo. Prošla kontrola výpočtu na WebGPU i náhradního výpočtu na WebGL 2. |
| 8. Závěrečné ověření | Probíhají závěrečné prohlížečové zkoušky. Snímky a měření ze softwarového vykreslovače jsou v protokolu. Měření na autorově počítači je otevřené. |

### Opakování ranní špičky na WebGL 2

Tři opakované zkoušky nad produkčním sestavením dokončily start hry. Prošla návštěva Krkavce s pokutou a nákupem u garáže. Během deseti simulovaných minut u hlavního nádraží trvalo nejdelší stání vozu 60 sekund. Na Klatovské třídě dosáhlo 381 sekund při požadavku méně než 120. V každé z deseti minut se část provozu pohybovala a test u žádného sledovaného vozu nezaznamenal výjezd z vozovky. Dřívějších 182 úspěchů ze 183 případů je součet napříč běhy. Otevřená zůstává také regrese ranní špičky. Prošlo 128 testů JavaScriptu a produkční sestavení.

### Barvy na WebGPU a minutová zkouška WebGL 2

Po opravě čtení výsledné textury prošlo všech pět barevných kontrol na WebGPU. Stejné původní meze ověřily denní a noční oblohu, sousední světlá a tmavá okna, vodu u Wilsonova mostu, oba portály se značením a dlažbu náměstí. Na WebGL 2 prošlo sedm zkoušek materiálů včetně pohybu náhonu, světel auta a osvětlení pod lampou. Napříč běhy má úspěšný výsledek 182 ze 183 případů. Při opakování zbývající minuty dne a noci vykázal softwarový WebGL 2 v Chromiu 159 s Mesa llvmpipe 20 snímků při souběžné práci. Mez je více než 30. Výsledek izolovaného běhu a měření na skutečné grafické kartě zůstávají otevřené.

### Závěrečné prohlížečové zkoušky

Na Chromiu 159 prošel výchozí start na WebGPU, zobrazení názvu vykreslovače v nabídce i získání prvních snímků bez varování. Prošly také všechny čtyři předvolby vyhlazování a stínů, pohyb dveří tramvaje v obrazu pro TRAA, měsíc po západu slunce a oba případy vztlaku. Z 37 znovu spuštěných případů prošlo 32. Pět zbývajících v tomto běhu používalo čtení barev plátna. Součet jednotlivých úspěšných zkoušek napříč opravami dosahuje 177 ze 183. Kromě pěti kontrol barev zbývá ověřit počet snímků během minuty hraní na WebGL 2. Původní mez nad 30 snímků zůstává součástí zkoušky.

### Hodiny po opětovném načtení hry

Chromium 159 na WebGPU ověřilo změnu času na 09:15, přepočet jízdního řádu, opětovné načtení hry i návrat k aktuálnímu času v Plzni. Stejná zkouška už prošla na WebGL 2. Test při načítání nyní vypíše chybu startu hry a respektuje čas přidělený prohlížečové zkoušce. Prošlo 128 testů JavaScriptu a všech 741 souborů nového produkčního sestavení se po bajtech shodovalo s webem, nad kterým běží zkoušky. Při kontrole materiálů na WebGPU vrátilo kopírování prezentačního plátna černé pixely. Pokračuje ověření čtení přímo z vykreslené textury.

### Doprava, směny a doručování

Na WebGL 2 prošla kolona na Tylově, změna provozu ve špičce, přestup z tramvaje na autobus, trolejbus 49 i víkendová noční linka. Prošly také čtyři zkoušky zakázek včetně rozvozu s pěším předáním a přestupu s doručením. Při minutě hraní na softwarovém WebGL 2 vykázal Mesa llvmpipe 19 dokončených snímků v měřicím okně při požadavku více než 30. Starší běh se SwiftShaderem vykázal 11. Sada zachovává původní mez. Zbývající zkoušky běží na WebGPU.

### Provoz na fiktivní silnici a kolejích

Na WebGL 2 i WebGPU prošlo všech šest scénářů s figurínami, testovacími auty a tramvají na samostatné desce Joltu. Testovací tramvaj má vlastní přímou trať a dvě smyšlené zastávky. Po zařazení desky mezi aktivní dlaždice šlo ověřit také vznik běžných fyzikálních těles vozidel. U zaparkovaného vozu test potvrdil probuzení po dotyku, u dvou jedoucích aut změnu rychlosti a u tramvaje brzdění před překážkou. Veškerých osm referenčních pohledů prošlo na WebGL 2 s Mesa llvmpipe za 10,9 minuty. Na WebGPU byly ověřeny již dříve.

### Zkoušky s herní figurínou

Tři regresní scénáře nyní používají vlastní rovnou desku v Joltu a herní figuríny mimo městskou geometrii, bez jízdního řádu a běžného provozu. Na WebGL 2 prošla registrace jediné události při kontaktu, sledování kamery a návrat pěšího hráče do chůze i omezení souběžných pádů. Prošlo 128 testů JavaScriptu a produkční sestavení. Samostatně prošla ve WebGL 2 příprava střední předvolby stínů a stereo tramvaje. Průchod všech osmi referenčních kamer na softwarovém WebGL 2 překročil při souběžném ověřování dvacetiminutový limit. Kontrola klaksonu prošla na WebGL 2 (Mesa llvmpipe) i na WebGPU (SwiftShader). Krátký tón test zachytí při jeho skutečném vytvoření po stisku H. Před odebráním auta navíc ověřuje, že má aktivní vlastní zvuk. Prošlo také stereo tramvaje a zastavení kol a zvuku hamru na WebGL 2.

### Oddělená zkušební plocha

Lampa pro fyzikální zkoušku vzniká na vlastní plošině nad herním terénem. Vykreslení i fyzika si vyžádají stejný seznam lamp v dlaždici. Také zkušební značka a světelný signál pocházejí ze samostatného testovacího vstupu s vlastní skupinou. Prošla ztráta a obnova světla po návratu, změna stavu a oprava u všech tří předmětů. V Chromiu uspěly dva scénáře na WebGL 2 a tytéž dva na WebGPU. Prošlo všech 128 testů JavaScriptu a produkční sestavení. Regrese dřívějších etap pokračují.

### Směny a spuštění vykreslovače

Na softwarovém adaptéru první sestavení scény někdy přesáhlo pevnou minutu. Zkoušky směn a vykreslovače nyní čekají na připravenou hru v rámci času určeného pro celý test. V Chromiu prošlo všech pět scénářů směn včetně výplaty, zrušení a opětovného načtení. Prošlo ruční i automatické spuštění WebGL 2. V minutové zkoušce na vysoké předvolbě adaptér zvládl jen 11 snímků, požadavek přes 30 zůstává otevřený. Prošlo 128 testů JavaScriptu a produkční sestavení. Regrese dopravy a starších grafických scén pokračují.

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

### Opakování zkoušek na softwarovém vykreslovači

Všech šest kontrol materiálů a obě samostatné kontroly dlažby na náměstí a chybějícího ortofota prošly. Pět ze šesti cílených dopravních zkoušek prošlo po úpravě čekání na spuštění hry. Šestá zkouška se dostala až k jízdě. Dodávka zůstala stát 7,82 m od začátku cílové hrany. Při opakování s diagnostikou dojela a ve scéně zůstaly údaje o MHD z okamžiku zmrazení. Tyto výsledky samy neurčují přesnou příčinu původního zastavení.

Zkouška ostrého zatáčení nyní před jízdou uvolní rezervace přechodů a seznam překážek těch účastníků, jejichž pohyb během ní nepokračuje. Semafory, geometrie, požadovaná dojezdová vzdálenost i zákaz vyjetí z vozovky zůstávají součástí zkoušky. Tři nezávislá spuštění projela obě odbočky a všech šest jízd zůstalo na vozovce. Prošlo také 128 jednotkových testů a produkční sestavení. Úplná prohlížečová sada na dřívějším sestavení dál běží. [Zadání E21](E21.md)

### Referenční pohledy po opravě načítání

Na WebGPU prošla zkouška všech osmi referenčních kamer. Při přípravě kolem nové kamery se sleduje postup načítání geometrie a leteckých podkladů. Během dokončování mapy osvětlení stačí vykreslit další strany oblohy. Celé město se kreslí až s hotovým světlem. V odděleném opakování prošly také čtyři scénáře MHD, pádu a lamp. Prošly jednotkové testy, všech 23 testů Pythonu a produkční sestavení.

Na WebGL 2 prošlo vynucení vykreslovače i automatický přechod při chybějícím WebGPU. Při minutové zkoušce dne a noci vykázal sdílený softwarový adaptér 11 snímků proti požadavku na více než 30. Tato výkonnostní kontrola je otevřená. Celková regresní sada se eviduje samostatně.
