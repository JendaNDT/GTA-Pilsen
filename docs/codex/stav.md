# E86 · Opakovatelný provoz a otisk simulace

Výchozí revize `ccbf222` obsahuje převzatou E85. Hra má samostatnou náhodu pro
simulaci a efekty. Semínko ukazuje panel Měření, podrobnosti chyby i výpis kolon.
Minutový otisk vyšel stejně pětkrát ve WebGL 2 a pětkrát ve WebGPU. Přibyl mezi
základní kontroly pull requestu. Prošlo 459 zkoušek JavaScriptu, produkční sestavení
a 34 zkoušek Pythonu s jednou dříve známou přeskočenou. Průměrná hustota se držela
v rozpětí jednotlivých běhů. Na Klatovské zůstávají otevřené chyby se semínkem
20261118, včetně kolony v Americké a vyjetí mimo vozovku v sadech Pětatřicátníků.
[Zadání](E86.md) · [Protokol, měření a snímky](../E86.md)

# E85 · Pojistka při chybě za běhu

Na větvi `etapa/E85` je hotové zachytávání chyb ve smyčce i ve fotorežimu, úklid stisků,
zastavení po opakované chybě a dialog s obnovením z posledního uložení. Ladicí režim
umí vyvolat jednorázovou nebo trvalou chybu. Prošlo 452 zkoušek JavaScriptu, produkční
sestavení a všech 16 nových prohlížečových zkoušek ve WebGL 2 a WebGPU včetně dotykové
emulace. Ze starších zkoušek prošlo 25 z 26. Zachycení kurzoru ve WebGL 2 selhalo
i na výchozí revizi. Typický čas logiky na nízké předvolbě zůstal stejný. Zbývá ověření
dotyku na fyzickém telefonu. [Zadání](E85.md) · [Protokol a snímky](../E85.md)

# E84 · Automatické kontroly na GitHubu

Výchozí revize je `dc4411a`. Rychlé kontroly na GitHubu prošly po nahrání větve `etapa/E84`
za 1 min 33 s. Místně prošlo 447 testů JavaScriptu, produkční sestavení a 34 testů Pythonu.
Jedna zkouška Pythonu přeskočila chybějící úplný archiv staveb. Všech pět základních scénářů
ve WebGL 2 prošlo místně dvakrát. GitHub zachytil úmyslné selhání a ověřil start ve WebGPU
na Linuxu. E84 je v `main` od revize `2ca3334`, ochrana větve vyžaduje obě kontroly i od správců.
V prvním ručním běhu úplné sady prošlo 676 z 692 zkoušek za necelé dvě hodiny. Všechny neprošlé
zkoušky a jejich místní opakování jsou v protokolu. [Zadání](E84.md) · [Protokol](../E84.md) ·
[Úplná sada](https://github.com/JendaNDT/GTA-Pilsen/actions/runs/46160553490)

# E83 · Hustší provoz na hlavních tazích

Na větvi `etapa/E83` hra přidává auta přímo na hlavní silnice podle blízkosti tahu, denní doby a kvality. Ve dvou ranních bězích přibyly průjezdy na Klatovské z 21 na 48 a na Domažlické z 22 na 34. U Skvrňanské zůstává k řešení vzájemné blokování aut. V jednom běhu u Domažlické čekal vůz přes dvě minuty. Prošlo sestavení, 446 testů JavaScriptu a čtyři cílené zkoušky v prohlížeči včetně dotykové emulace. Kontrolní špička na vysoké kvalitě dosáhla 59,7 FPS s fyzikou do 2,7 ms v 95 % snímků. Grafické časy v obou verzích překročily rozpočet, zbývá ověření na fyzickém telefonu. [Zadání](E83.md) · [Protokol a snímky](../E83.md)

# E82 · Chování řidičů v městském provozu

Na větvi `etapa/E82` řidiči reagují na rozjezd auta vpředu a vyhledávají volné odbočení, když se před nimi drží fronta. V Božkovské řidič před dvojicí stojících aut přehodnotil trasu po 10 sekundách. Desáté auto projelo po rozjezdu o 0,32 s dřív. U nádraží v obou měřeních přibylo průjezdů, na Klatovské se v jednom běhu nejdelší čekání prodloužilo. Prošlo sestavení, 444 testů JavaScriptu a sedm cílených prohlížečových zkoušek včetně dotykové emulace. Ve špičce při vysoké kvalitě klesla frekvence z 59,7 na 45,9–59,2 FPS. Před vydáním zbývá určit příčinu zpomalení, vysvětlit nejdelší frontu na Klatovské a ověřit změnu na fyzickém telefonu. [Zadání](E82.md) · [Srovnání a snímky](../E82.md)

# E81 · Přednost chodce při výjezdu linky 32

Na větvi `etapa/E81` se v běžné simulaci při výjezdu ze zálivu potkaly autobus, osobní auto a chodec. Po opravě zůstal roh autobusu 0,58 m před zebrou. Chodec přešel, oba řidiči pokračovali a nejmenší odstup mezi vozy činil 2,59 m. Prošlo sestavení, 441 testů JavaScriptu a devět cílených prohlížečových zkoušek včetně dotykové emulace. Zbývá ověření na fyzickém telefonu. [Zadání](E81.md) · [Průjezd, snímky a měření](../E81.md)

# E80 · Výjezd ze zálivu před přechodem

Na větvi `etapa/E80` chodec při výjezdu autobusu nebo trolejbusu počítá s návratem karoserie od obruby do pruhu. Na přechodu v Radobyčicích se podařilo zopakovat předčasný vstup před linkou 32. Po úpravě chodec počkal, přešel a autobus pokračoval. Prošlo sestavení, 440 testů JavaScriptu a devět cílených zkoušek v prohlížeči včetně dotykové emulace. Kontrolní jízda v obou verzích dosáhla 59,8 FPS. Zbývá vyzkoušení na fyzickém telefonu. [Zadání](E80.md) · [Průběh a výsledky](../E80.md)

# E79 · Odbočující autobusy a trolejbusy

Na větvi `etapa/E79` se při pěší zelené kontroluje i dráha zádě odbočujících vozů silniční MHD. V Tylově ulici se na E78 podařilo zopakovat předčasný vstup před linkou 49. V Tylově chodec počkal při širším průjezdu a při těsném minutí vykročil. U Borského parku se ověřil zásah zádí autobusu 39 při běžném výběru pruhu. Prošlo sestavení, 439 testů JavaScriptu a 14 cílených zkoušek v prohlížeči včetně dvou s emulovaným dotykem. Kontrolní jízda dosáhla 59,8 FPS. Zbývá zkouška na fyzickém telefonu. [Zadání](E79.md) · [Průběh a výsledky](../E79.md)

# E78 · Brzdná dráha tramvaje na přechodu

Na větvi `etapa/E78` chodec na zelenou zohlední polohu všech článků až do odhadovaného zastavení po kolejích. Na předchozí verzi se na Klatovské podařilo zopakovat předčasný vstup před čtyřkou. Po změně chodec při 36 km/h počkal a po zpomalení na 14,4 km/h vykročil. Prošlo sestavení, 438 testů JavaScriptu, deset cílených zkoušek v obou grafických režimech i zkouška s emulovaným dotykem. Jízdy dosáhly 59,7–59,8 FPS. Čas GPU kolísal v rámci rozpočtu, zbývá vyzkoušení na fyzickém telefonu. [Zadání](E78.md) · [Zkouška a podklady](../E78.md)

# E77 · Brzdná dráha ve sněhu

Na větvi `etapa/E77` chodec používá přilnavost podle stavu vozovky. Na původní revizi vykročil při 36 km/h i na zasněženou zebru. Po změně na suchu při 36 km/h vykročil a na sněhu počkal na zpomalení. Prošlo sestavení, 437 testů JavaScriptu, deset cílených zkoušek v obou grafických režimech a dvě s emulovaným dotykem. Kontrolní jízda na sněhu dosáhla 60 FPS. Zbývá vyzkoušení na fyzickém telefonu. [Zadání](E77.md) · [Ověření a podklady](../E77.md)

# E76 · Brzdná dráha auta před zebrou

Na větvi `etapa/E76` odhaduje chodec před vstupem na zelenou brzdnou dráhu přijíždějícího auta. Na Klatovské třídě se na předchozí revizi podařilo zopakovat předčasný vstup na přechod. Po úpravě chodec při rychlosti 54 km/h počkal a při 14,4 km/h mohl na stejném místě vykročit. Prošlo sestavení, 436 testů JavaScriptu a osm cílených zkoušek v Chromiu. Srovnávací jízdy obou verzí dosáhly 60 FPS. Zbývá zkouška na fyzickém telefonu. [Zadání](E76.md) · [Chování a ověření](../E76.md)

# E75 · Chodci na zelenou čekají na volnou zebru

Na větvi `etapa/E75` chodec při pěší zelené kontroluje celou šířku zebry včetně místa za posledním článkem MHD. Na původní revizi `60063d3` se na Klatovské podařilo zopakovat předčasný vstup do vozovky. Po opravě chodec počkal na uvolnění přechodu v obou grafických režimech. Prošlo sestavení, všech 435 testů JavaScriptu a 10 cílených prohlížečových zkoušek. Kontrolní jízda linkou 49 dosáhla 60 FPS. Zbývá vyzkoušení na fyzickém telefonu. [Zadání](E75.md) · [Přechod a zkoušky](../E75.md)

# E74 · Od nádražních dveří na odjezdovou 49

Na větvi `etapa/E74` funguje cesta na stanoviště 1 podle platného jízdního řádu, přecházení Šumavské a nástup do vybraného spoje. Běžná simulace odhalila překážející zaparkovaná auta. Po úpravě parkování cestující nastoupil do 49 směr Karlov. Prošlo sestavení, 434 testů JavaScriptu a všech 16 cílených prohlížečových zkoušek. Kontrolní jízda dosáhla 60 FPS. Zbývá vyzkoušení na fyzickém telefonu. [Zadání](E74.md) · [Trasa, snímky a výsledky](../E74.md)

# E73 · Cestující míří k nádražní budově

Na větvi `etapa/E73` funguje souvislá pěší cesta po výstupu z linky 49 na stanovišti 2. Prošlo sestavení, 431 testů JavaScriptu a 12 cílených zkoušek v Chromiu. Kontrolní jízda linkou 49 dosáhla před změnou i po ní 60 FPS. Úplný běh 660 scénářů byl po třech úspěšných kontrolách přerušen pro nedostatek místa při zápisu na disk. Na skutečném telefonu zbývá projít trasu za cestujícím. [Zadání](E73.md) · [Trasa, snímky a ověření](../E73.md)

# E72 · Hledání rozvozu pizzy

Na větvi `etapa/E72` z revize `2112104` funguje výběr rozvozu podle pizzerie i adresy z celé herní oblasti. Hotová je nabídka pro obě pořadí výběru, cena konkrétní dvojice i ověření rozvozu do Sedlce až k výplatě. Prošlo sestavení, 430 testů JavaScriptu a po opravě výběru prvku v testu všech 16 dotčených scénářů rozvozu a taxi ve WebGL 2 a WebGPU. Na fyzickém telefonu zbývá vyzkoušet schování klávesnice a výběr výdeje pro sdílenou adresu. [Zadání](E72.md) · [Protokol, snímky a měření](../E72.md)

# E71 · Hledání cíle taxi

Na větvi `etapa/E71` z revize `6cf459d` je hotové dotykové hledání podle obce, ulice a čísla domu v nabídce regionálního taxi. Prošlo sestavení, 429 testů JavaScriptu a čtyři cílené prohlížečové zkoušky včetně přijetí vyfiltrované jízdy. Dalším krokem je ověření se softwarovou klávesnicí na skutečném telefonu. [Zadání](E71.md) · [Ovládání, snímek a výsledky](../E71.md)

# E70 · Taxi po Plzni a okolí

Z revize `2892135` na větvi `etapa/E70` funguje výběr cíle mezi 160 stanovišti. Ověřená jízda z Prokopovy 21 na Masarykovo náměstí 74 ve Starém Plzenci měří podle navigace 10,21 km a vyplatí 1 655 Kč. Dotyková zkouška ověřila výběr z Rokycan a návrat k uložené výplatě. Prošlo sestavení, 428 testů JavaScriptu, 34 testů Pythonu s jedním přeskočeným a osm cílených prohlížečových zkoušek. Srovnávací jízda dosáhla 59,1 FPS. Doporučený další krok je na telefonu vyjet ze Starého Plzence a ověřit nabídku pro zpáteční cestu. [Zadání](E70.md) · [Průběh, ověření a snímky](../E70.md)

# E58 · Série deseti terčů

Na větvi `etapa/E58` navazuje na revizi `864274a` bodovaná série. Každý z deseti terčů má limit pěti sekund a jeden pokus. Po posledním terči lze hrát znovu nebo se vrátit do volného tréninku. Dokončená série může zlepšit osobní rekord v uložené hře. Prošlo sestavení, 427 testů JavaScriptu a deset různých cílených zkoušek v prohlížeči. Série běžela při 60 FPS. Dalším krokem je zkusit časový limit na fyzickém telefonu. [Zadání](E58.md) · [Pravidla a ověření](../E58-serie.md)

# E58 · Volný trénink terčů v Lobzích

Na větvi `etapa/E58` z revize `b2c8a60` je hratelný první krok. Z mapy lze dojít po pěšině ke vstupu, vyzkoušet jeden pohyblivý terč a vrátit se do města. Trénink počítá zásahy a pokusy. V obou vykreslovačích prošel průchod s myší i s emulovaným dotykem. Sestavení a 424 testů JavaScriptu prošlo. Zbývá zkouška na fyzickém telefonu. Doporučené pokračování je série deseti terčů s osobním rekordem. [Zadání](E58.md) · [Ovládání, snímky a výkon](../E58.md)

# E69 · Rozvoz pizzy v celé herní oblasti

Na větvi `etapa/E69` z revize `38f2ed6` je hotových 41 výdejních míst, 546 adres a 562 nabízených spojení. V nabídce Zakázky lze zvolit podnik a cíl. Pět rozvozů bylo projetých včetně pěšího předání. Prošlo sestavení, 422 testů JavaScriptu, 34 testů Pythonu (jeden další přeskočen) a 16 cílených zkoušek v prohlížeči. Zbývá uživatelská zkouška na skutečném telefonu. [Zadání](E69.md) · [Podklady, snímky a výsledky](../E69.md)

# E68 · První rozvoz pizzy na kole

Na větvi `etapa/E68` z revize `b1b8c8c` je hratelná první zakázka z Rud’s Pizza do Prokopovy 25. Hráč vyzvedne krabici, jede podle vlastní volby, sesedne na chodníku a pěšky potvrdí předání. Prošlo produkční sestavení, 421 testů JavaScriptu, 34 zkoušek Pythonu (jedna další přeskočena), čtyři prohlížečové zkoušky rozvozu a čtyři zkoušky sdílených kol. Při jízdě na nízkou předvolbu ve Full HD bylo naměřeno 59,1 FPS. Příští krok je doplnit zbývajících pět adres. [Zadání](E68.md) · [Zkoušky, snímky a výkon](../E68.md)

# E67 · Symbol skupiny u tahu

Na větvi `etapa/E67` z revize `470163c` ukazuje symbol v osmičce plné, půlené nebo závěrečnou černou podle právě hrajícího hráče. Prošlo sestavení, 418 testů JavaScriptu a šest cílených prohlížečových zkoušek ve WebGL 2 a WebGPU. Na šířce 320 bodů byl ověřen pruhovaný symbol i následný přechod na plnou. Na nízkou předvolbu ve Full HD dosáhla hra 59,1 FPS. [Zadání](E67.md) · [Snímky, zkoušky a výkon](../E67.md)

# E66 · Společný výběr kulečníku

Na větvi `etapa/E66` z revize `3573aed` je hotový výběr všech tří režimů přes **Ke kulečníku**. Sestavení, 417 testů JavaScriptu a všech 14 cílených zkoušek herny prošlo. V mobilním zobrazení o šířce 320 bodů jsou tři tlačítka vedle sebe. Ověřen je návrat k rozehrané i dohrané dráze. Měření osmičky na nízkou předvolbu ve Full HD dosáhlo 60 FPS. [Zadání](E66.md) · [Ovládání, snímky a měření](../E66.md)

# E65 · Osmička proti počítači

Na větvi `etapa/E65` z revize `a446bf4` je hotová hra pro jednoho. Soupeř si vybírá přípustné koule, nastavuje směr a sílu, přesouvá bílou po faulu a střídá rozstřely při odvetě. Sestavení a 417 testů JavaScriptu prošlo, v Pythonu prošlo 34 zkoušek a jedna byla přeskočena. Všech dvanáct cílených zkoušek herny prošlo, jednu zkoušku načítání bowlingu bylo třeba opakovat. V obou vykreslovačích proběhla celá partie na emulovaném telefonu. Měření na nízkou předvolbu ve Full HD dosáhlo 60 FPS. [Zadání](E65.md) · [Ovládání, zkoušky a výkon](../E65.md)

# E64 · Osmička pro dva

Na větvi `etapa/E64` z revize `c5255b2` je hotová místní partie na jednom telefonu. Oba hráči se střídají u jednoho stolu, po faulu je bílá v ruce a po výsledku lze hrát odvetu. Sestavení a 413 testů JavaScriptu prošlo. Z 35 testů Pythonu prošlo 34 a jeden byl přeskočen. V obou vykreslovačích prošlo všech deset cílených zkoušek společné herny. Výkon v osmičce dosáhl 60 FPS ve Full HD na nízkou předvolbu. Zbývá volitelné ověření dvěma lidmi na skutečném telefonu. [Zadání](E64.md) · [Pravidla, snímek a měření](../E64.md)

# E63 · Tréninkový kulečník U Papírny

Na větvi `etapa/E63` z revize `eb5d900` je hotový první hratelný krok. Z bowlingové dráhy lze přejít k jednomu kulečníkovému stolu, mířit, nastavit sílu, potopit tři barevné koule a vrátit se k rozehranému bowlingu. Na klávesnici i dotyku prošel celý přechod v obou vykreslovačích. Prošlo sestavení, 408 testů JavaScriptu, 34 testů Pythonu (jeden další přeskočen) a osm zkoušek v Chromiu. Trénink ve Full HD na nízkou předvolbu dosáhl 60 FPS. Dalším navrženým krokem jsou pravidla osmičky. [Zadání](E63.md) · [Ovládání, snímky a měření](../E63.md)

## Míření přímo na stole

Po revizi `28f5840` lze směr vybrat kliknutím, dotykem nebo tažením. Světlá čára vede od bílé k prvnímu kontaktu. Síla i okamžik strku zůstávají v rukou hráče. Prošlo sestavení, všech 408 testů JavaScriptu a čtyři zkoušky kulečníku v Chromiu. Na počítači i emulovaném telefonu zkouška ověřila změnu cíle, potopení žluté a návrat ke dráze ve WebGL 2 i WebGPU.

# E62 · Výstup vedle auta v Pařížské

Na výchozí revizi `858cde2` dovolila hra vystoupit zadními dveřmi linky 33 i do místa obsazeného sedanem. V řízené zkoušce stál střed auta 55 cm od cílového bodu. Hra postavu nejprve umístila ke dveřím, po prvním kroku se střetem byla 95 cm od cíle. Ve třech jízdách původního místního sestavení s volným prostorem u dveří byl rozdíl pod 1 mm. Přesnou polohu auta z dřívějšího veřejného měření 67 cm neznáme.

Před výstupem hra kontroluje, jestli se cestující vedle karoserie vejde. Zohledňuje šířku a délku auta, jeho natočení i výšku. Pokud auto překáží, hráč zůstane ve voze a hra nabídne jiné dveře. Uvolněné dveře lze použít ještě při stejném zastavení.

Prošlo produkční sestavení a všech 407 testů JavaScriptu. Ze dvou opakování ve WebGL 2 a dvou ve WebGPU prošla zkouška obsazených a následně volných dveří čtyřikrát. Ze čtyř celých jízd tři dojely z náměstí Republiky přes Goethovu do Pařížské a splnily původní mez 50 cm. Při čtvrté jízdě na sebe autobus a kombi na Americké čekaly po 81 m od Goethovy. Výstup při této jízdě nešlo změřit.

# E62 · Průchozí MHD na všech linkách

Na větvi `etapa/E62` nad revizí `510420a` se při pěším nástupu použije interiér podle modelu vozidla. Rozšíření pokrývá všech 51 linek herního jízdního řádu. U Tatry jsou přístupné oba samostatné vozy. Čtyři ukázky zůstávají v nabídce **Svézt se MHD**.

Ověřeny byly jízdy běžnými spoji linek 2, 4, 30 a 16 přes dvě zastávky, přestup, rozvoz a řidičské směny. Prošlo sestavení, 406 testů JavaScriptu a 39 cílených prohlížečových zkoušek. Všechny čtyři předvolby splnily rozpočet vykreslování a jízda na nízkou předvolbu dosáhla 60 snímků za sekundu. [Trasy, snímky a měření](../E62.md)

# E61 · Společná nabídka jízd MHD

Na větvi `etapa/E61` nad revizí `fa38686` otevírá volba **Svézt se MHD** z úvodu i z pauzy výběr čtyř vozů. U každého je linka, typ vozu a směr. Ověřen je nástup do všech čtyř interiérů, návrat z nabídky i zachování rozjetého rozvozu. Prošlo sestavení, 405 testů JavaScriptu a 12 cílených prohlížečových zkoušek. Měření v trolejbusu splnilo všechny čtyři časové rozpočty. [Ovládání, snímky a měření](../E61.md)

# E60 · Průchozí trolejbus linky 49

Třetí krok nad revizí `8077df6` dokončuje katalog čtyř průchozích spojů. Na lince 49 lze od hlavního nádraží projít uličkou, svézt se vsedě přes Pařížskou a vystoupit druhými dveřmi u Mrakodrapu. Přestup z autobusu 33 v Pařížské prošel na dotykovém ovládání v obou vykreslovačích. Na nízkou předvolbu ve Full HD jízda dosáhla 60 snímků za sekundu a splnila čtyři časové rozpočty.

Prošlo sestavení, 405 testů JavaScriptu a 34 testů Pythonu s jedním přeskočeným. V první sérii prošlo 21 z 24 prohlížečových zkoušek, při opakování pět z osmi jízd. Každý scénář včetně řidičských směn a jízdy původní Tatrou prošel alespoň jednou v obou vykreslovačích. Otevřené zůstává vzájemné blokování aut na Americké, občasné čekání tramvaje před Hlavní poštou a jedna odchylka 67 cm při výstupu z autobusu vedle osobního auta. [Katalog, snímky, přestup, měření a záznamy čekání](../E60.md#trolejbus-linky-49)

# E60 · Průchozí autobus linky 33

Druhý krok navazuje na revizi `5c5a4a4`. Spoj 688856 odjíždí v pondělí v 8:20 ze stanoviště 4 na náměstí Republiky směrem na hlavní nádraží. Přímý nástup je v nabídce, pěší nástup nabídnou otevřené dveře. Zkouška přestupu navázala na tramvaj 4 od zastávky U Práce. Z náměstí prošla jízda přes Goethovu k výstupu zadními dveřmi v Pařížské.

Prošlo 404 testů JavaScriptu, 34 testů Pythonu s jedním přeskočeným případem, produkční sestavení a všech 12 cílených prohlížečových zkoušek na WebGL 2 a WebGPU. Dotyková zkouška ověřila hledání na mapě a prostřední dveře autobusu. Řidičská směna linky 30 skončila výplatou.

Při jednom průjezdu s náhodným provozem autobus po odjezdu z Goethovy ujel pouze 17 m za 283 sekund. Důvod tohoto čekání zůstává otevřený. Dalším krokem podle zadání je průchozí trolejbus. [Postup a snímky z autobusu](../E60.md#autobus-linky-33)

# E60 · Článková tramvaj linky 1

Místní větev `main` převzala všech pět revizí E59 po `e074d04`. Na tomto základě má spoj 685463 tři průchozí články, přímý nástup z nabídky a vlastní vyhledání na mapě. Ověřený je přechod za jízdy v zatáčce, pohled ze sedadla, výstup prostředními dveřmi i průchod oběma měchy dotykovou páčkou. Prošlo sestavení, 402 testů JavaScriptu a 34 testů Pythonu s jedním přeskočeným případem. Měření jízdy na nízkou předvolbu splnilo čtyři časové rozpočty.

Otevřená je opakovaná dopravní prodleva na křižovatce Dominikánské a Solní. Před tramvají tam při odbočování uvázlo auto u stěny domu. Následujícími kroky E60 jsou průchozí autobus a trolejbus. [Zadání](E60.md) · [Ovládání, snímky, výkon a výsledky zkoušek](../E60.md)

# E59 · První průchozí vůz linky 1

Na revizi `ec4c99a` dojel spoj ve všech 19 měřených jízdách k Hlavní poště za 48 až 73 sekund. Další tři jízdy prošly až k výstupu Pod Záhorskem. Příčina dřívější prodlevy zůstává otevřená. Při opakování má automatická zkouška uložit polohu vozu a důvody čekání. Prošlo produkční sestavení, všech 400 testů JavaScriptu a také celá jízda s výchozí hodnotou na WebGL 2 i WebGPU. [Opakování čekání před Hlavní poštou](../E59.md#opakování-čekání-před-hlavní-poštou)

Po vyzkoušení autorem přibyl přímý nástup do uličky z hlavní nabídky i pauzy. Ověřena je také cesta od označníku a přechod z vnějšího pohledu jiné tramvaje. Delší snímek při vykreslení interiéru už hráče nevysadí. Po této opravě prošlo sestavení, 400 testů JavaScriptu a deset cílených prohlížečových zkoušek včetně jízdy přes dvě zastávky. [Postup po opravě](../E59.md#přímý-nástup-z-nabídky)

Dokončeno na herní revizi `f493782` z větve `main` na `1fc8112`. Cestující nastoupil předními dveřmi Tatry na náměstí Republiky, za jízdy došel k sedadlu, projel Hlavní poštou a vystoupil prostředními dveřmi Pod Záhorskem. Ověřeny jsou také dotykové ovládání, výstup v přestupním uzlu, konečná a návrat na nástupiště po přerušení.

Prošlo sestavení, 400 testů JavaScriptu, 34 testů Pythonu s jedním přeskočeným případem a 34 cílených zkoušek v Chromiu. V tramvaji na nízkou předvolbu vyšly všechny čtyři časové rozpočty. Otevřenou otázkou je příčina jedné prodlevy v náhodném provozu před Hlavní poštou. [Zadání](E59.md) · [Protokol, snímky a ovládání](../E59.md)

# Převzetí E54 až E57 do mainu

Na revizi `1bd5bf2` navazuje minigolf ve Škodalandu, síť 152 stanovišť Pilsen Bike, navigace pro elektrokola a jedna bowlingová dráha U Papírny. Společné sestavení vychází z herní revize `7f6eccc`. Prošlo produkční sestavení, 396 testů JavaScriptu, 34 testů Pythonu s jedním přeskočeným případem a 56 cílených zkoušek v Chromiu na WebGL 2 i WebGPU. Zkoušky zahrnuly všechna stanoviště, souvislou jízdu s navigací v obou směrech, dohrání minigolfu i bowlingu, dotykové ovládání, starší uložené hry a všechny čtyři grafické předvolby. [Minigolf](../E54.md) · [Sdílená elektrokola](../E55.md) · [Cyklistická navigace](../E56.md) · [Bowling](../E57.md)

# E57 · Pilot bowlingu U Papírny

Jedna dráha na Papírnické 3 je přístupná z mapy a hratelná v deseti kolech. Prošlo 396 testů JavaScriptu, produkční sestavení a 62 cílených prohlížečových zkoušek. Ověřeno bylo také dotykové ovládání, uložení rekordu a pěší přístup od Mikulášského náměstí. Časové rozpočty vyšly v herně, při jízdě i při letu. E57 je dokončená nad herní revizí `78e31d0`. [Zadání](E57.md) · [Ovládání a ověření](../E57.md)

# E56 · Cyklistická navigace

Hotová trasa mezi Západočeským muzeem a DEPO 2015 je průjezdná v obou směrech. Prošlo produkční sestavení, 391 testů JavaScriptu, 34 úspěšných testů Pythonu a jeden přeskočený případ a 78 cílených prohlížečových případů včetně opakované dotykové zkoušky v obou vykreslovačích. Časové rozpočty splnila jízda na kole s aktivní trasou, jízda autem i let. E56 je dokončená nad herní revizí `5f8e32a`. [Zadání](E56.md) · [Protokol a snímky](../E56.md)

# E55 · Celá síť sdílených elektrokol

Snímek Pilsen Bike z 26. listopadu 2026 obsahuje 152 stanovišť. Import ověřil příchod a místní nájezd na všech bodech. Devět umístění v herním světě se proti souřadnici poskytovatele posunulo o 1 až 4 m, obě místa pilotu zůstala přesně na původních souřadnicích. Prošlo produkční sestavení, 386 testů JavaScriptu a 32 testů Pythonu s jedním přeskočeným případem. Ve hře se dá půjčit a vrátit kolo na všech 152 místech. Prošlo 42 cílených zkoušek v Chromiu na WebGL 2 a WebGPU včetně pěšího příchodu a místní jízdy u každého stanoviště. Rozšíření je dokončené nad herní revizí `1f9ca97`. V opakovaném měření na nízkou předvolbu vyšly časové rozpočty při jízdě na kole, jízdě autem i letu. [Zadání](E55.md) · [Protokol a snímky](../E55.md#síť-stanovišť-po-pilotu)

# E55 · Pilot sdílených elektrokol

Dvě skutečná stanoviště u Západočeského muzea a DEPA2015 jsou v mapě a umožňují výpůjčku a vrácení. Prošel souvislý průjezd dlouhý 1 175 m, 385 testů JavaScriptu, produkční build i 50 cílených běhů v Chromiu. Pilot je dokončený nad herní revizí `919b978`. Rozpočty výkonu vyšly při jízdě na kole, jízdě autem i letu. Naváže celá síť skutečných stanovišť. [Zadání](E55.md) · [Snímky a ověření](../E55.md)

# E54 · Minigolf ve Škodalandu

Půjčovna a všechny tři jamky jsou hratelné. Druhá využívá odraz od mantinelu, třetí má dvě cesty kolem ostrůvku. Hráč mezi jamkami chodí pěšky a osobní rekord se ukládá po dohrání série. Prošlo sestavení, 383 testů JavaScriptu, 48 cílených zkoušek v Chromiu a opakování osmi běhů minigolfu po úpravě ovládání klávesou Enter. E54 je dokončená nad herní revizí `56f0cf8`. Časové rozpočty vyšly při hře třetí jamky, jízdě i letu na nízkou předvolbu. [Zadání](E54.md) · [Protokol a snímky](../E54.md)

# Převzetí E52 a E53 do mainu

Na grafické opravy z revize `cdaa5fd` navazuje vstup do městských aktivit ve Škodalandu a nabídka tří jízd taxi. Společné sestavení prošlo 377 testy JavaScriptu a 98 cílenými prohlížečovými zkouškami na WebGL 2 a WebGPU. Ověřeny byly také dotyk, uložená hra, rozvozy, opravené okraje silnic a kolejiště i rozpočty všech čtyř grafických předvoleb. [E52](../E52.md) · [E53](../E53.md)

# Převzetí grafických oprav do mainu

Opravy chodníků u kolejí, překryvu asfaltu a grafických zkoušek jsou ověřené nad stavem hlavní větve po E51 (`f16ae3c`). Prošlo produkční sestavení, všech 369 testů JavaScriptu a 52 cílených zkoušek v Chromiu na WebGL 2 a WebGPU, včetně všech čtyř grafických předvoleb. [Chodníky u kolejí](../chodniky-u-koleji.md) · [Okraje silnic](../okraje-silnic.md)

# Oprava okrajů silnic a grafických testů

Na Karlovarské, v Kaplířově a v Zahradní zůstal v kontrolovaných bodech terén pod asfaltem. Součástí je návaznost výšky na hranici dlaždic. Herní revize je `b036d5b`. Kontroly světlometů a dat terénu jsou zpřesněné v revizi `b3850b8`. Prošlo produkční sestavení, 377 jednotkových a 95 cílených prohlížečových zkoušek. Jízda i let v měření na nízkou předvolbu splnily rozpočty. [Snímky a ověření](../okraje-silnic.md)

# Oprava chodníků u tramvajových kolejí

Na Slovanské, Lidické a Skvrňanské se obrubníky odsunuly za tramvajové pásy. Ověřeno na revizi `e012088`. Prošlo všech 375 jednotkových zkoušek, produkční sestavení a 56 cílených běhů v Chromiu na WebGL 2 a WebGPU. Měření na pevné kameře ukázalo na nízkou předvolbu stejný počet vykreslovacích volání a trojúhelníků. [Srovnávací snímky a výsledky](../chodniky-u-koleji.md)

# E52 · Místa a průběh městských aktivit

Dokončeno nad herní revizí `8784c60`. První aktivita ve Škodalandu má značku na mapě, pěší navigaci, společnou akci pro klávesnici a dotyk a zkušební trasu s dokončením, zrušením a návratem po načtení. Vstup je na chodníku. Ověřen je příchod z obou stanovišť U Přehrady a referenční spoj Tatry pro pozdější etapu MHD.

Prošlo 374 testů JavaScriptu, produkční sestavení a šest cílených běhů E52. Z 542 prohlížečových běhů prošlo 536 včetně všech případů E52 a pozorování ranního provozu. Šest zbývajících selhání bylo doloženo už při ověřování E53 proti E51. Samostatné měření jízdy a letu splnilo rozpočty na nízkou kvalitu. [Zadání](E52.md) · [Protokol, snímky a postup vyzkoušení](../E52.md)

# E53 · Taxi podle potřeb cestujícího

Dokončeno nad herní revizí `797ee34`. Taxi nabízí běžnou jízdu, spěch na nádraží a klidnou jízdu. Karty ukazují nástup, cíl a odměnu ještě před přijetím. U obou zastávek se kontroluje směr a správný obrubník. E53 navazuje přímo na E51 přes existující nabídku Zakázky.

Prošlo všech 370 testů JavaScriptu, produkční sestavení a všechny nové zkoušky taxi v obou vykreslovačích. Dosavadních osm běhů zakázek a garáže prošlo samostatně. Úplná sada prošla v 528 z 536 případů. Obě zkoušky kolony u hlavního nádraží prošly při opakování, celkem tedy prošlo 530 různých případů. Zbývajících šest odchylek se stejnou kontrolou potvrdilo i v E51. Měření na nízkou kvalitu vyšlo v rozpočtu za jízdy i za letu. [Zadání](E53.md) · [Protokol, snímky a postup vyzkoušení](../E53.md)

# E51 · Voda u Wilsonova mostu a u Ostende

Dokončeno nad revizí `5eeaae8`. Radbuza unáší plavce a plovoucí auta, u Ostende hráč prochází mělčinou. Výpočet výšky hladiny sdílí grafika a fyzika. Při vstupu do vody kreslí střední a vyšší předvolba kruhy a tříšť.

Prošlo produkční sestavení, 365 testů JavaScriptu a 50 z 52 cílených zkoušek v Chromiu. Zbývající dvě zkoušky měří jas světlometů a stejný výsledek se opakoval i na E50. Obě jízdy a oba lety na nízkou kvalitu splnily v nové verzi rozpočty. Ve vysoké předvolbě u mostu dosáhl čas GPU 12,50 ms při cíli 12 ms. [Zadání](E51.md) · [Snímky, výsledky a postup vyzkoušení](../E51.md)

Proud v řekách je výraznější i na nízkou předvolbu. Po zvýraznění prošlo všech 365 testů JavaScriptu, sestavení a 28 různých cílených zkoušek v Chromiu. Nízká předvolba splnila rozpočty. V pevném pohledu u Wilsonova mostu na vysokou kvalitu vyšel čas GPU 14,97 ms při cíli 12 ms. Před zvýrazněním to bylo 14,21 ms. [Srovnání a výsledky](../E51/proud.md)

Brodění funguje na celé mapě a v plochách se zakreslenou osou toku proud unáší plavce i plovoucí auta. Ověřeno v Mži, Kamenném rybníku a na Radbuze mimo původní úsek. Prošlo sestavení, 366 testů JavaScriptu a 42 cílených zkoušek v Chromiu. [Snímky, ověření a měření](../E51/voda-na-cele-mape.md)

# E50 · Lampy pod mostem Generála Pattona

Sloupy v Jízdecké a Lochotínské mají nově výšku 6,06 m a 4,78 m. Obě světla se vejdou pod most. Přejezd přímo nad každým z nich prošel při 44,7 km/h se všemi koly na vozovce. Prošlo sestavení, všech 361 jednotkových testů a 20 cílených zkoušek v Chromiu. [Měření, srovnávací snímky a výsledky kontrol](../E50.md)

# E49 · Plynulá jízda po silnicích

Prověřeno 18 481 silničních dílů a napojení v celé mapě. Na severním příjezdu k Rondelu klesla největší dvanáctimetrová vlna ze 49 na 4 cm. Při 89 až 90 km/h držela kola na obou jízdních pásech. Překročení jedné z měřených mezí zůstává na 1 477 dílech. Prošlo sestavení, 360 jednotkových zkoušek JavaScriptu, 33 testů Pythonu a 26 cílených zkoušek v Chromiu. [Výsledky, souřadnice, snímky a zkoušky](../E49.md)

# E48 · Spodní vozovky pod mosty

Upravené jsou oba směry Karlovarské pod Rondelem, Prokopova, K Valše a další podjezdy v celé mapě. Z 322 prověřovaných překryvů šla čtyřmetrová nerovnost změřit ve 320. Nejvyšší odchylka pod koly byla 9,55 cm. U dvou dotyků na hraně cesty byl měřitelný příjezd. Prošlo sestavení, 356 testů JavaScriptu, 32 testů Pythonu a všech 30 různých cílených zkoušek v Chromiu včetně jízdy a rozpočtů všech předvoleb. Podlaha uzavřené lávky ve FN Lochotín má pouze odhadnutou výšku. [Snímky před opravou a po ní, seznam úseků a ověření](../E48.md)

# E47 · Kilometr okolí před startem

Dokončeno pro novou i uloženou hru. Za jízdy se příprava silnic dělí podle času. Prošlo sestavení, 351 testů JavaScriptu a 34 cílených zkoušek v Chromiu. Na stejné trase klesl počet kroků dostavování nad 10 ms ze 14 na 6. Výkon na skutečném telefonu zůstává neověřený. [Snímky a srovnání](../E47.md)

# E46 · Návrat po zatčení

Hra používá 25 pojmenovaných služeben na území celé mapy. Po dopadení za sražení chodce hráče vrátí před věznici Bory. Závažnost se uchovává i po uložení během honičky. Všech 26 míst návratu prošlo kontrolou ve hře. Prošlo sestavení, 350 jednotkových testů a 48 zkoušek v Chromiu. U druhé rokycanské služebny v Dělostřelců zůstává otevřená otázka současného provozu. [Výběr míst, snímky a výsledky testů](../E46.md)

# E45 · Čitelnost herního menu

Upraveny barvy ovládacích prvků a rozložení na úvodní obrazovce i v pauze. [Porovnání a ověření](../E45.md)

# E44 · Kostel sv. Jana Nepomuckého

Hotová je oprava dvojvěží, rozet a trojice portálů včetně schodů nad chodníkem. Kostel jsme porovnali ze čtyř stejných pohledů před úpravou a po ní. [Snímky a měření výkonu](../E44.md)

# E43 · Dvanáct plzeňských dominant

Hotových je všech dvanáct exteriérů včetně střech a zadních křídel. Každé místo má porovnání ze stejné kamery na zemi i ze vzduchu. Prošlo 347 jednotkových testů a 46 cílených zkoušek v Chromiu na WebGL 2 a WebGPU, včetně opětovného načtení míst a rozpočtů vykreslování. [Modely, předlohy a měření](../E43.md)

# E42 · Úvodní nabídka a pauza

Hotovo. Úvod zobrazuje poslední polohu uložené hry. Pauza ukazuje cíl a dovoluje otevřít mapu i během jízdy. Prošlo produkční sestavení, 334 testů JavaScriptu a 58 cílených zkoušek v Chromiu. Ověřen je i návrat z mapy na dotykovém telefonu v emulaci. [Snímky a měření](../E42.md)

# E41 · Veřejné osvětlení

Ověřeno všech 43 578 sloupů. Z nich 2 339 vychází z poloh v OpenStreetMap. U zastávky U Prodejny je odstup od označníku 9,23 metru. Prošlo produkční sestavení, 334 testů JavaScriptu, 31 kontrol Pythonu a 32 cílených zkoušek v Chromiu. [Snímky, měření a odchylky](../E41.md)

# E40 · Zastávky MHD

Dokončeno pro 705 stanovišť. Prošlo 331 jednotkových testů, 30 kontrol nástrojů, produkční sestavení a 38 cílených zkoušek v Chromiu. Ověřen je přestup, výběr odjezdů u označníku, provoz bez podkladu OSM a rozpočet všech předvoleb. [Snímky, podklady a měření](../E40.md)

# E39 · Model městského trolejbusu

Hotový je zelenobílý vůz se dvěma sběrači a pohyblivými prosklenými dveřmi. Prošlo 329 jednotkových testů, sestavení a 26 cílených prohlížečových zkoušek včetně linek 16 a 49. [Porovnání modelů a měření](../E39.md)

# E38 · Ovládání pěší postavy

Pěšky lze zvednout pohled až kolmo vzhůru. Po tomto doplnění prošlo sestavení, 328 jednotkových testů a 12 cílených zkoušek kamery a ovládání v Chromiu.

Dokončen je náklon při běhu do zatáčky, volná kamera na myši a plynulý běh na dotykové páčce. Prošlo 328 jednotkových testů, sestavení a 28 cílených zkoušek ve dvou vykreslovačích. [Snímky a výsledky měření](../E38.md)

# Převzetí auditu a zvuků do hlavní větve

Opravy E31–E36 byly sloučeny se zvukovými úpravami E37 nad revizí `529da10`. Společné sestavení prošlo 328 testy JavaScriptu, 29 testy datových nástrojů a 52 cílenými zkouškami v Chromiu na WebGL 2 a WebGPU. Ty zahrnují předávání uložené hry, mapu a pěší trasy, rozvoz, vrtulník, načítání volitelných vrstev, potopení auta i zvuky. Známé omezení posledního zápisu při pádu celého prohlížeče popisuje [protokol převzetí](../E36.md).

# E37 · Přepracování zvuku silničních vozidel

Hotový je motor aut a autobusů, odvalování pneumatik a klakson. Při převzetí do hlavní větve prošlo 321 testů JavaScriptu, produkční sestavení a osm zvukových zkoušek v Chromiu na WebGL 2 i WebGPU. [Zadání](E37.md) · [Poslech před a po](../E37/auto-pred-a-po.wav)

# Opravy po auditu · E31–E36

Společná herní revize `803c780` má opravy osmi reprodukovaných problémů. Prošlo 327 jednotkových testů, 29 kontrol nástrojů, produkční sestavení a všech 474 prohlížečových zkoušek. Místní sestavení je připravené ke hraní. Veřejné vydání je pozdržené kvůli ztrátě posledního zápisu po násilném ukončení celého prohlížeče. Původní test nástupu do vrtulníku občas ztratil stisk F při ručním krokování. Po cílené reprodukci a opravě prošel na obou vykreslovačích. Další výsledky a omezení shrnuje [převzetí hry](../E36.md).

[Uložená hra](../E31.md) · [Start a data](../E32.md) · [Rozvoz a let](../E33.md) · [Pěší navigace](../E34.md) · [Měření výkonu](../E35.md) · [Archiv Godotu](../E36-godot.md)

Při přípravě zadání prošlo 320 testů JavaScriptu, produkční sestavení a kontrola všech 52 místních odkazů v přehledu a šesti zadáních. Sestavení upozornilo na velikost hlavního balíčku a fyziky Jolt. Náklady startu se měří v E35.

# Audit hry · 25. listopadu 2026

Prověřena hlavní větev `42d7571`. Audit popisuje osm reprodukovaných problémů webové hry včetně resetu postupu, přepsání uložení druhou kartou a posunu pěšího cíle. Prošlo 320 testů JavaScriptu, sestavení a 21 vybraných prohlížečových zkoušek. U Pythonu protokol rozlišuje běžný běh na macOS a opakování se všemi podklady. Součástí jsou výsledky Godotu, měření nízké předvolby a ranní špičky na M4. [Nálezy, ověření a doporučené pořadí oprav](../audit-hry-2026-11-25.md)

# E20 – samovolný vzlet po nastoupení

Výchozí revize `2f2d335`. Pružiny ližin přidávaly sílu také při stání prázdného vrtulníku s uspaným tělesem. Jolt nasčítanou sílu zpracoval v prvním kroku po nastoupení. Po šesti sekundách čekání u FN Lochotín byl původní vzestup bez stisku mezerníku 147,88 m. Podvozek nyní přeskočí výpočet sil na prázdném spícím tělese. Po probuzení počítá síly pro právě probíhající krok.

Při opakování na střeše FN Lochotín se vrtulník zvedl o méně než milimetr. Také na náměstí, u pivovaru a na Borech zůstal vrtulník při desetisekundovém roztáčení rotoru bez povelu na místě. Prošlo 320 jednotkových testů, produkční sestavení a osm prohlížečových zkoušek letu na WebGL 2 a WebGPU včetně vzletu na povel a přistání na střeše.

# Oprava obrazu při otáčení kamery (E24)

Výchozí revize `54969a0`. Na náměstí Republiky se při předvolbě Ultra v 11.30 na WebGL 2 při otáčení kolem stojícího auta objevil široký zlatavý pás s ostrým okrajem. Odlesk objektivu byl vypnutý. Na stejné kameře pás zmizel při nastavení nulové hustoty objemových slunečních paprsků. V běžném zobrazení se proto tento průchod vůbec nevytváří. Pro srovnání jej lze výslovně vyžádat pomocí `?quality=ultra&rays=1`.

Ověřeny byly dva šikmé pohledy na hotové sestavení. Prošlo 320 jednotkových testů, produkční sestavení a čtyři zkoušky v Chromiu pro běžné i výslovně vyžádané vykreslení paprsků na WebGL 2 a WebGPU. [Původní obraz](../E24/pruhy-pred.jpg) · [Stejný pohled po opravě](../E24/pruhy-po.jpg)

# Stav etapy E30

Dokončené jsou reakce na čekající chodce, cílené pěší cesty včetně celé trasy od muzea přes lávku, výměna cestujících a výjezd linkového vozu ze zálivu. Prošlo 320 jednotkových testů, sestavení, čtyři nové herní scénáře na obou vykreslovačích a rozpočty všech čtyř předvoleb. Základem je revize `7a6b269`. [Zadání](E30.md) · [Ověření, snímky a rozsah pokrytí](../E30.md)

## Hustší provoz v okolí hráče

Na všech předvolbách je mírně vyšší cílový počet jedoucích aut i chodců. Když do cíle chybějí alespoň čtyři, hra častěji hledá vhodnou silnici nebo chodník. Místo, den v týdnu a hodina nadále určují, jak rušno kolem hráče bude.

Při dvou minutách na stejném místě na Klatovské v pondělí v 7.30, na střední kvalitu a se stejným výchozím generátorem náhody, se každých dvacet sekund spočítala auta běžného provozu a postavy v simulovaném okolí. Před změnou (revize `983b4d6`) šlo o 26 aut a 12–13 chodců. Po změně to bylo 30–32 aut a 16–17 chodců. Jde o okolí hráče včetně ulic za kamerou.

Prošlo 320 jednotkových testů, produkční sestavení a sedm cílených kontrol v prohlížeči. Ty ověřily hustotu na Klatovské na obou vykreslovačích, volný přechod a koleje na Tylově a rozpočty všech čtyř předvoleb. Nástroj `tools/measure_map.mjs --work` na Apple M4 při nízké kvalitě a WebGL 2 naměřil při jízdě 95. percentil práce snímku 3,8 ms před změnou a 3,9 ms po ní. Při přeletu naměřil 3,6 ms v obou verzích.

# Stav etapy E29

## Modely ostatních aut

Dokončeny jsou všechny ostatní karoserie i obě služební varianty. Přibylo srovnání osmi aut ze stejného místa, kontrola hloubky korby a zkouška řízení každého typu na nízkou kvalitu. Prošlo 315 jednotkových testů, sestavení hry a 14 cílených kontrol v prohlížeči. [Zadání](E29.md) · [Galerie a výsledky](../E29.md)

## Druhá verze přídě a dveří Fabie

Světlomety kopírují zakřivení blatníků. Každé pouzdro má dvě paraboly a samostatnou směrovku. Boční dveře mají tvarované plechy, průběžné spáry a kliky v barvě karoserie. Prošlo 314 jednotkových testů, produkční sestavení a 12 cílených kontrol v prohlížeči. [Snímky stejného auta před úpravou a po ní a ověření](../fabia/prid-a-dvere.md)

## Fabia II a pohyblivá kola

Hotová je pětidveřová Fabia II včetně střechy a zádě, rejd předních kol a odvalování všech kol při jízdě i couvání. Pohyb používají také auta v provozu. Prošlo 313 jednotkových testů, produkční sestavení a 14 cílených kontrol v prohlížeči. [Zadání](E28.md) · [Snímky, měření a výsledek](../E28.md)

## Kratší dobrzdění při držení brzdy

Po vyzkoušení revize `cab60c3` chtěl autor silnější účinek při sešlápnutí brzdy. Kola při aktivním brzdění v arkádě využijí vyšší podélnou přilnavost a brzda zůstane zapojená až do rychlosti přibližně 0,4 km/h. Volný dojezd malého auta po uvolnění plynu ve čtyřicítce dal před změnou i po ní 32,9 km/h po dvou sekundách.

Na stejné suché rovině se u malého auta zkrátila dráha dobrzdění z 50 km/h z 11,73 na 7,62 metru a čas z 1,80 na 1,20 sekundy. Z 15 km/h klesla dráha z 1,68 na 1,05 metru. Měření končilo při poklesu rychlosti pod 0,1 m/s. Podle měření se zpřísnila přípustná brzdná dráha ze stovky pro malé i sportovní auto a přibyla zkouška času a dráhy při brzdění z 15 a 50 km/h.

Prošlo 311 jednotkových zkoušek včetně brzdění na mokru a sněhu, produkční sestavení a šest cílených zkoušek v prohlížeči.

## Arkádové řízení hráčova auta

Úprava na větvi `codex/arkadove-rizeni` navazuje na kameru z revize `053d326`. V arkádovém režimu má auto silnější motor a provozní brzdy, ve městě má větší rejd a po puštění plynu brzdí motorem. S rychlostí rejd stále klesá. Při předání vozidla provozu nebo přepnutí na realistické řízení se obnoví jeho původní nastavení.

| Malé auto na stejné suché rovině | Před | Po |
| --- | ---: | ---: |
| Rozjezd z 0 na 50 km/h | 5,45 s | 3,83 s |
| Brzdná dráha ze 100 km/h | 44,4 m | 33,8 m |
| Změna směru za půl sekundy při 65 % rejdu po dosažení 40 km/h | 12,8° | 19,8° |
| Rychlost dvě sekundy po puštění plynu při 40 km/h | 41,1 km/h | 32,9 km/h |

Původní zkouška arkádového režimu měla dolní mez času zrychlení a délky brzdné dráhy. Nové intervaly pro malé a sportovní auto odpovídají požadovanému svižnějšímu rozjezdu a kratšímu zastavení. Přibylo ověření reakce na řízení, dojezdu a obnovení nastavení při změně režimu i po vystoupení.

Prošlo všech 310 jednotkových testů, produkční sestavení a 24 cílených zkoušek ve hře na WebGL 2 a WebGPU. Ověřily mimo jiné běžnou jízdu po mostě, průjezd tunelem, výjezd na rampu, nastavení řízení a kameru při rozjezdu.

## Oprava kamery při rozjezdu auta

Oprava vychází z revize `47b808d`. Kamera za autem přebírá polohu a natočení právě vykreslené karoserie. Stejná poloha slouží i ke kontrole překážek mezi autem a kamerou. Při třech sekundách rovného rozjezdu se 120 aktualizacemi obrazu za sekundu původní směr pohledu míjel očekávaný cíl až o 2,1–2,2 cm. Po opravě klesla největší měřená odchylka mezi kroky fyziky pod 0,1 mm na WebGL 2 i WebGPU. Prošlo všech 308 jednotkových zkoušek, produkční sestavení a osm cílených prohlížečových kontrol rozjezdu, tunelu Valík a kamenného okraje mostu.

## E27 – Herní mapa a orientace

Mapa je hotová na větvi `codex/herni-mapa` z revize `a496a1a`. Otevře okolí hráče, umožní posun a přiblížení, ukáže skutečnou hranici pohybu a vyžádá si potvrzení cíle. Při kontrole na počítači a emulovaném telefonu fungoval výběr lávky, hledání zastávek i návrat k hráči. Prošlo 308 jednotkových testů a produkční sestavení. Ve společném běhu prošlo 420 z 422 prohlížečových kontrol. Obě zkoušky původního ovládání uspěly po doplnění kroku potvrzení cíle. [Zadání](E27.md) · [Snímky a výsledky měření](../E27.md)

## Od muzea k Mlýnské strouze

Větev `codex/sady-ke-strouze` prodlužuje model od Západočeského muzea přes Šafaříkovy a Křižíkovy sady k jezírku i na trávník za ním. Pěší hráč přejde lávku mezi oběma břehy. Vzniklo osm dvojic srovnávacích snímků včetně dvou přeletů. Prošlo 306 jednotkových testů a produkční sestavení. Z 418 prohlížečových zkoušek prošlo napoprvé 413. Po úpravě dohledu prošly všechny kontroly rozpočtů a při opakování také obě kontroly ranní špičky na Klatovské. [Snímky, podklady a ověření](../E25/strouha.md)

## Smetanovy a Kopeckého sady až k muzeu

Větev `codex/smetanovy-sady` doplňuje celý úsek od divadla k muzeu. Na trase je pět vodních prvků, tři pomníky, zelené loubí, 14 záhonů a 33 laviček. Vzniklo osm dvojic snímků včetně dvou přeletů. Prošlo všech 304 testů JavaScriptu a produkční sestavení. V úplném běhu prošlo 414 ze 416 prohlížečových kontrol. Kontrola celé promenády po odletu a návratu prošla na WebGL 2 i WebGPU. Dvě zkoušky ranní špičky na Klatovské při společném běhu zaznamenaly příliš dlouhé čekání na křižovatce. Obě prošly při samostatném opakování beze změny kódu. Při přeletu je náročnost srovnatelná s výchozí verzí, při jízdě v sadech vzrostl čas GPU přibližně o 23 %. [Podklady, porovnání a ověření](../E25/smetanovy-sady.md)

## Historická věznice Bory

Větev `codex/bory-pruceli` doplňuje celý vnější model historické budovy. Uliční průčelí, kapli, paprskovitá křídla a kupoli lze porovnat ve čtyřech pohledech před změnou a po ní. Prošlo všech 300 testů JavaScriptu, produkční sestavení a 413 ze 414 prohlížečových kontrol. Zbývající zkouška dopravy u hlavního nádraží prošla při samostatném opakování. Pro příští památky platí kontrola ze země i z vrtulníku. [Snímky, zdroje a ověření](../E25/bory.md)

## Zbývající tři strany náměstí Republiky

Na větvi `codex/stity-namesti` mají vlastní průčelí všechny domy č. 6–33 a 35–39 obrácené do náměstí. Hotové jsou adresní podklady, kresby, modely štítů, kontrola načtení po návratu a šest dvojic srovnávacích snímků. Všech 299 testů JavaScriptu a produkční sestavení prošly. Z 28 zkoušek Pythonu prošlo 27 a jedna vyžadující úplný nedistribuovaný archiv se přeskočila. V celém běhu prošlo 410 ze 412 prohlížečových kontrol. Po přemístění vzorků na současná noční okna i po samostatném opakování dopravy na Klatovské prošly také obě zbývající kontroly. [Podklady, snímky a podrobné ověření](../E25/stity-namesti.md)

## Štíty severní strany náměstí

Na větvi `codex/severni-stity` jsou průčelí č. 40, 41 a 2 až 5, římsy, vikýře a samostatná kresba šesti domů. Prošlo 294 testů JavaScriptu, sestavení a 407 ze 410 prohlížečových kontrol. Kontrola celé řady po návratu na náměstí prošla na obou vykreslovačích. Selhaly dvě známé kontroly nočních oken a jednou ranní špička na Klatovské, která při opakování prošla. [Podklady a ověření](../E25/severni-stity.md)

## Kašny na náměstí Republiky

Větev `codex/kasny-na-namesti` přidává Anděla, Chrtici a Velblouda na jejich mapová místa. Hotové jsou modely čtyř nádrží a tří chrličů, proudy vody, kolize, snímky a měření výkonu. Prošlo 292 testů JavaScriptu, produkční sestavení i cílené kontroly kašen a rozpočtu na obou vykreslovačích. Ve společném běhu prošlo 405 ze 408 prohlížečových zkoušek. Selhala známá dvojice kontrol nočních oken a jednou ranní špička na Klatovské. Samostatná zkouška špičky prošla před změnou i po ní. [Srovnání ze stejných míst, zdroje a výsledky měření](../E25/kasny.md)

## Lochotínský pavilonek

Na větvi `codex/lochotinsky-pavilonek` pavilonek převzal půdorys z OpenStreetMap. Podle fotografií má členěné fasády, tři valbové střechy a přístupnou terasu s dřevěným zábradlím. Prošlo všech 289 testů JavaScriptu, produkční sestavení a 404 ze 406 prohlížečových kontrol. Na obou vykreslovačích prošla zkouška pavilonku a selhala známá kontrola nočních oken na náměstí. [Tři pohledy před úpravou a po ní a ověření ve hře](../E25/lochotinsky-pavilonek.md)

## Západočeské muzeum

Na větvi `codex/zapadoceske-muzeum` má hlavní budova v Kopeckého sadech vlastní portál, lodžii se třemi oblouky a tři otevřené střešní věžičky. Obě křídla a oblé nároží vycházejí z městského měření. Prošlo všech 286 testů JavaScriptu, produkční sestavení i kontrola muzea na obou vykreslovačích. V celé prohlížečové sadě prošlo 402 ze 404 zkoušek. Obě selhání odpovídají známé kontrole nočních oken na náměstí. [Srovnání tří pohledů a měření výkonu](../E25/zapadoceske-muzeum.md)

## Sloučení památek a dopravní větve

Společné sestavení památek (`a78fff2`) a sledování kolon (`e1ddfa3`) prošlo všemi 285 testy JavaScriptu a produkčním sestavením. Na WebGL 2 a WebGPU prošlo celkem 400 ze 402 prohlížečových kontrol včetně památek a ranní dopravy. Na obou vykreslovačích selhala známá kontrola kontrastu nočních oken na náměstí. Pokus se silnějším rozjezdem je uložen v samostatné záplatě.

## Morový sloup na náměstí Republiky

Větev `codex/morovy-sloup` navazuje na katedrálu. Původní budovu na půdorysu památky nahrazuje šest stupňů, kamenná balustráda, kovové oplocení a sloup s Madonou. Hra zohledňuje stupně a užší podstavec i při chůzi, nárazu auta nebo pohybu kamery. Prošlo 282 testů JavaScriptu, sestavení hry i 400 ze 402 prohlížečových kontrol. Obě selhání odpovídají původní zkoušce nočních oken na náměstí. [Pohledy od radnice i z náměstí a ověření](../E25/morovy-sloup.md)

## Katedrála sv. Bartoloměje

Na větvi `codex/katedrala` má katedrála na náměstí Republiky vlastní kamenné zdivo, gotická okna a portály, čtyři funkční ciferníky a měděnou špici. Prošlo 280 testů JavaScriptu a produkční sestavení. V dotykové zkoušce na WebGL 2 i WebGPU souhlasily hodiny katedrály s radnicí a obnovily se po návratu na náměstí. V úplné sadě prošlo 397 ze 400 prohlížečových zkoušek. Kontrola kontrastu nočních oken selhala na obou vykreslovačích, pozorování ranní špičky u Klatovské na WebGPU. Obě potíže se projevily i ve verzi s původní katedrálou. [Srovnávací snímky a měření](../E25/katedrala.md)

## Plzeňská radnice

Větev `codex/radnice` navazuje na Nové divadlo. Na severní straně náměstí Republiky má radnice vlastní sgrafitové průčelí, trojici štítů a otevřenou věžičku. Ověřili jsme změnu času na ručičkách a jejich obnovu po návratu na náměstí v nízké kvalitě na dotykovém displeji v Chromiu. Prošlo 278 testů JavaScriptu, sestavení a 396 z 398 prohlížečových kontrol. Obě selhání odpovídají známé zkoušce kontrastu nočních oken na náměstí. [Snímky a ověření](../E25/radnice.md)

## Nové divadlo v Plzni

Na větvi `codex/nove-divadlo` dostalo Nové divadlo nakloněné průčelí s otvory, červený sál a tmavé administrativní křídlo s prosklenými spojovacími chodbami. V nízké kvalitě prošla dotyková zkouška chůze až k foyer i pod přední spojovací chodbou na obou vykreslovačích. Prošlo 276 testů JavaScriptu a sestavení hry. V celé sadě prošlo 394 z 396 prohlížečových kontrol. Zbývající dvě kontroly kontrastu nočních oken na náměstí selhávaly už před úpravou. [Snímky a výsledky ověření](../E25/nove-divadlo.md)

## Velké divadlo J. K. Tyla

Větev `codex/velke-divadlo` navazuje na synagogu. Divadlo má vlastní historické průčelí, prostorovou balustrádu, střechu jeviště a souvislou parkovou terasu. Prošlo 274 testů JavaScriptu, produkční sestavení a dotyková zkouška na WebGL 2 i WebGPU. V celé sadě prošlo 392 z 394 prohlížečových kontrol. Kontrola nočních oken na náměstí selhala na obou vykreslovačích i na výchozí revizi. Postava na terase přistála a při chůzi se zastavila o její sklo. [Srovnání vstupu a parkové strany](../E25/velke-divadlo.md)

## Velká synagoga v sadech Pětatřicátníků

Na větvi `codex/velka-synagoga` má synagoga vlastní průčelí, kupole, římsy a hvězdy. Vlastní fasádu mají také oba přilehlé domy včetně výloh za zaobleným nárožím. Prošlo 272 testů JavaScriptu, produkční sestavení a 16 cílených prohlížečových zkoušek. V celé sadě prošlo 390 z 392 kontrol. Zbývající dvě kontroly nočních oken na náměstí selhaly i na původní verzi. Na nízké předvolbě se vzhled obnovil také po návratu do ulice v dotykové emulaci. [Srovnání ze stejného místa a výsledky zkoušek](../E25/synagoga.md)

## Rozjezd a příčiny kolon (24. 11. 2026)

Na větvi `codex/rozjezd-a-kolony` navazující na `f09c09f` přibylo sledování příčiny fronty přímo při rozhodování řidičů a MHD. Ve čtyřech dvojicích desetiminutových jízd stouply průjezdy na zelenou ze 407 na 477 a počet hlášených nárazů z 15 na 16. Pouze u silnějšího rozjezdu test zjistil v Ukrajinské jízdu pod plynem mimo vozovku. V běžné hře proto zůstává původní výkon motoru. Dvě vozidla, která se v pokusu blokovala, byla autobus 41 a sedan v Husově. Případné pravidlo pro jejich vyhnutí potřebuje ověřit prostor pro průjezd. [Měření, podmínky a návod pro zopakování](../E20/rozjezd-a-kolony.md)

Prošlo všech 274 testů JavaScriptu, produkční sestavení a 388 z 390 prohlížečových zkoušek. Všechny dopravní zkoušky prošly. Obě selhání kontroly nočních oken na náměstí se zopakovala i na původním sestavení `f09c09f`. [Podrobnosti ověření](../E20/rozjezd-a-kolony.md#kontrola-výsledné-hry)

## Vzhled hlavního nádraží od Mikulášské

Na větvi `codex/hlavni-nadrazi` má západní průčelí vlastní kresbu podle autorovy předlohy, patinované kupole, římsy a čitelný název na přední hraně přístřešku. Prošlo 271 testů JavaScriptu, produkční sestavení, cílené kontroly na WebGL 2 i WebGPU a dotyková emulace telefonu. [Snímky a místní ověření](../E25/pruceli-nadrazi.md)

## Průchod pod střechami v celé mapě

Na přání autora byla nádražní oprava rozšířena na 309 mapových přístřešků včetně 13 částí staveb. Po opravě prošlo sedm původně zablokovaných pěších tras v šesti čtvrtích na WebGL 2 i WebGPU. Ověřen byl též dopad na střechu, přístřešek se sklem a spodní předprostor nádraží. Prošlo 269 testů JavaScriptu, 28 testů Pythonu a produkční sestavení. [Naměřené vzdálenosti a rozsah kontroly](../E25/prednadrazi.md#průchod-pod-střechami-na-celé-mapě)

## Spodní předprostor hlavního nádraží

Před vstupem od Mikulášské je nyní dlažba s podélným sklonem 1,8 %, opěrné zdi a průchozí prostor pod přístřešky. Porovnání se stejným pohledem před úpravou, výsledky zkoušek a odchylky od fotografie jsou v [protokolu](../E25/prednadrazi.md).

## Doplnění E25 u hlavního nádraží (23. 11. 2026)

Větev `codex/hlavni-nadrazi` navazuje na opravu dopravy `33f74e9`. Veřejný prostor má čtyři herní označníky, oboustrannou směrovku, zpřesněnou dlažbu a opravenou orientaci přístřešku. Čtyřka stojí u severního přechodu. Blíž k bodu zastavení by sloupek zasáhl do pěší nebo dopravní trasy.

Prošlo 267 testů JavaScriptu, 28 testů Pythonu a produkční sestavení. Na WebGL 2 i WebGPU prošel rozvoz, chůze v nízké a vysoké kvalitě i nástup do trolejbusu 49. Rozšířená zkouška prošla na obou také bez minimapy po trase od veřejných dveří kolem rozcestníku ke stanovišti 1 a od jižního vstupu do tramvajového ostrůvku ke stanovišti 3. Čeká porovnání konstrukce přístřešku s fotografiemi a kontrola autorem na telefonu. [Podklady, snímky a měření](../E25/nadrazi.md)

## Ranní kolona na Klatovské (23. 11. 2026)

Oprava vychází z revize `f2ff94a`. V jedné desetiminutové jízdě čekalo auto ve Smetanových sadech 319,5 s. Při jiném rozložení provozu stálo auto v Tylově 537,5 s. V obou případech se fronta přenesla i do okolních ulic.

- Při příjezdu ze Smetanových sadů leží stopčára těsně za hranicí dvou úseků silnice. Auto teď zkontroluje protisměr a místo za křižovatkou už na předchozím úseku. Ve zkoušce na původní verzi přejelo čáru o více než 17 m. Po opravě zastaví před čárou a po uvolnění protisměru projede.
- Pokud si na Husově při odbočování do Skrétovy zahradí cestu dvě protijedoucí auta, může řidič ještě před provedením odbočky pokračovat volným pruhem rovně. U semaforu může po dlouhém čekání zvolit jiný povolený výjezd ještě během zelené. Zohlední, zda při odbočování vlevo skutečně čekal na zelenou kvůli ostatním vozidlům. Obě situace mají samostatnou jízdní zkoušku.
- Linkový vůz a řidič odbočující přes koleje nově respektují, kdo už do křižovatky vjel. Jakmile i poslední článek tramvaje mine dráhu auta, řidič může odbočit. Na Božkovské může řidič po minutě před zaplněnou Železniční odbočit na volnou stranu. Nadále dává přednost provozu na hlavní.
- Při kontrolní jízdě od nádraží stálo taxi v Barrandově u Guldenerovy 500,5 s. Malé auto v protisměru mělo po boku 11,5 cm místa, ale návratem doprostřed pruhu by narazilo. Řidič nyní může krokem podržet směr, pokud mají karoserie skutečný boční odstup a oba přední rohy zůstanou na vozovce. Zkouška sleduje všechna tři původní auta až do uvolnění křižovatky a měří odstup každé dvojice.
- Při odbočení vlevo z vedlejší ulice řidič počítá i s rozjezdem od čáry a s délkou svého auta. V ulici Kardinála Berana tak nechá vůz na hlavní projet i v případě, kdy by původní třísekundový odhad propustil taxi do jeho dráhy.
- Na jižním příjezdu ke křižovatce Klatovské, Tylovy a Americké doplnilo sestavení mapy směrový semafor. Přechod a návěstidlo sdílejí uzel OSM `3073913680`. Hra nyní použije městskou stopčáru `10982` a střídá zelenou společně s protějším semaforem, příčnou ulicí a chodci. Nové sestavení používá stejné zdrojové soubory. Všech šest binárních souborů základní mapy se shoduje bajt po bajtu.

**Místní ověření.** Prošlo všech 264 testů JavaScriptu, všech 28 testů Pythonu včetně ověření městského archivu a produkční sestavení. V Chromiu prošlo všech 14 cílených zkoušek na závěrečném sestavení (sedm situací na WebGL 2 a WebGPU). V širší průběžné sadě dopravy a MHD prošlo 85 z 86. Zbývající zkoušku po přejmenování běžící proces nenašel, pod konečným názvem na obou vykreslovačích prošla. Kompletní sadu všech herních zkoušek jsme po poslední úpravě neopakovali.

**Deset minut v pondělí v 7.30.** Běžná zkouška na Klatovské prošla na obou vykreslovačích. Nejdelší souvislé stání bylo 65,5 a 70,5 s. Kontrola u hlavního nádraží na obou vykreslovačích naměřila 163,5 s v Ukrajinské, kde záznam ukazuje několik poškozených vozů. Kontrolní jízda od nádraží na původní revizi měla maximum 96 s. Maximum se získává ze všech sledovaných aut v okolí pozorovatele, jednotlivé jízdy mají různý průběh. Žádná ze čtyř jízd nezaznamenala vyjetí z vozovky pod plynem.

**Další rozložení provozu.** Tři samostatné desetiminutové jízdy v okolí Klatovské naměřily 95 s, 279 s a 68 s. V delší frontě stálo auto na Americké, za opravenou křižovatkou, před linkovým vozem. Ukrajinská a souběh MHD na tomto úseku Americké zůstávají otevřené. Dvouminutový limit platí dál.

## Kontrola celé obrazovky po stisku Esc (23. 11. 2026)

Na revizi `d98e677` se podařilo zopakovat selhání při vypnutí celé obrazovky tlačítkem. Při místním měření dorazila událost `fullscreenchange` po dokončení požadavku za 150 ms na WebGPU a za 122 ms na WebGL 2. Hra v obou případech při události správně přepnula stav tlačítka. Původní test tento stav přečetl před doručením události.

Zkouška nyní v jednom odečtu ověřuje režim okna, stav tlačítka a jeho nápovědu. Kontroluje také ukončení režimu přes `document.exitFullscreen()` mimo tlačítko hry a následné zapnutí. V běžném okně Chromu na Macu byl zvlášť vyzkoušen přímo stisk Esc v obou režimech. Vrátily se lišty, tlačítko hlásilo vypnutou celou obrazovku a dalším kliknutím ji znovu zapnulo.

Prošlo 262 z 262 testů JavaScriptu a produkční sestavení. Obě zkoušky v `fullscreen.spec.js` prošly dvakrát na WebGL 2 i dvakrát na WebGPU, celkem 8 z 8. Změna se týká testu a tohoto zápisu.

## Postava ve větvi main (23. 11. 2026)

Autor schválil sloučení stylizované postavy. `main` je na revizi `34ae246` (sloučení `claude/bold-ptolemy-36flyi`, obsah shodný s ověřenou revizí `c0c9a3e`). Celá sada prohlížečových zkoušek na WebGL 2 182 ze 184. Selhaly proměnlivé zkoušky „start a minuta hraní“ (22 snímků, vydání 0.2.0 má 22 až 24) a „ranní špička, Klatovská“ (selhává i na vydání 0.2.0). [Podrobnosti](../postava.md#sloučení-do-main-na-přání-autora)

## Postava · vylepšení vzhledu (mimo etapu, na přání autora)

Autor schválil úpravu ramen a paží, zad a boků a jemné zastínění (`450ad17`). Ramena se svažují ke krku, vršek paže je oblý ramenní sval pod kloubem ramene, paže jsou o 7 cm blíž k trupu, boky navazují na stehna, ruka má dlaň s prsty. Zastínění v barvách postavy vypne `?zastineni=0`. [Popis a snímky](../postava.md#vylepšení-vzhledu-na-přání-autora)

**Ověření.** `npm test` 262 z 262 (3 nové zkoušky tvaru a zastínění, na předchozí podobě postavy neprojdou), `npm run build` prošlo. Postava má 1 578 až 1 762 trojúhelníků. Prohlížečové zkoušky na WebGL 2: `budget` na všech předvolbách, `character`, `pedestrians`, `game`, `physics`, `street-collision`, `water` 32 z 32. Snímky všech jedenácti pohybů včetně pádu a plavání jsou v protokolu.

**Zkušební stránka.** Revize `450ad17` je ve složce `zkouska-vzhledu/` na větvi `gh-pages` od revize `70a6971`. Před zveřejněním se načetla z podsložky na počítači i na emulovaném telefonu bez chyby a bez chybějícího souboru.

**Zbývá.** Vyzkoušení autorem. Sloučení do `main` jen se souhlasem autora.

## Postava · vzhled a pohyby (mimo etapu, na přání autora)

Autor chtěl hezčí herní postavu a přirozenější pohyby, zvolil stylizovaný vzhled vytvořený v kódu (bez stažených modelů). Platí pro hráče i chodce. Na větvi `claude/bold-ptolemy-36flyi` od vydání 0.2.0 (`da600ef`). [Popis, snímky a měření](../postava.md)

**Úprava.** `src/entities/character-pose.js` (výpočet pohybů: chůze, běh, stání, rozhlížení, skok, pád, dopad, plavání, šlapání vody, náklon v zatáčce; meze kloubů z fyzikální postavy), `src/entities/character-shape.js` (oblé tělo, obličej, čtyři účesy, klouby, dlaně, boty; každý díl v kvádru fyzikální postavy), `models.js` (`poseCharacter`, víc odstínů pleti, vlasů a bot), `player.js` (fáze kroku podle uražené vzdálenosti, ponoření ve vodě 1,17 m / 1,3 m). Původní kvádrovou postavu vrací `?postava=puvodni`. Uložené hry se nemění.

**Ověření.** `npm test` 259 z 259 (nové `character-pose` 8, `character-shape` 4), `npm run build` prošlo. Prohlížečové zkoušky na WebGL 2: `budget` na všech předvolbách, `character`, `pedestrians`, `game`, `physics`, `street-collision` 29 z 29, po úpravě ponoření `water` a `character` 9 z 9. Postava má 1 510 až 1 642 trojúhelníků (dříve asi 170).

**Zkušební stránka.** Revize `e57292a` je ve složce `zkouska-vzhledu/` na větvi `gh-pages` od revize `f55e6e3`. Před zveřejněním se načetla z podsložky na počítači i na emulovaném telefonu bez chyby a bez chybějícího souboru.

**Zbývá.** Vyzkoušení autorem. Sloučení do `main` jen se souhlasem autora.

## Vydání 0.2.0 (23. 11. 2026)

Autor rozhodl o vydání. `main` je na revizi `99b1463` (sloučení `claude/bold-ptolemy-36flyi`). Zkoušky, archiv a přenos uložené hry jsou v [protokolu E26](../E26.md#vydání-020). Značku `v0.2.0` GitHub z prostředí odmítl (HTTP 403), vytvoří ji autor na revizi `99b1463`. Otevřené: měření na autorově počítači a telefonu, dlouhá jízda se zásobami po 3. a 4. návratu, kontrola Astrou, zácpy v modelu provozu (Klatovská).

## Rozhodnutí autora: pokračuje webová hra (23. 11. 2026)

Dál se rozvíjí webová hra (three.js). Verze v Godotu (`godot/`, větev `godot/prestavba`) zůstává ve stavu z 20. 11. 2026, nové funkce ani herní obsah se do ní nepřevádějí. Herní obsah se bude vkládat do webové hry.

## Celá obrazovka (mimo etapu, na přání autora)

Autor hlásil, že hra neběží přes celou obrazovku. Plátno hry vyplňuje celé okno prohlížeče i po jeho zvětšení (ověřeno na nízké, střední i vysoké předvolbě z 800 × 450 na 1600 × 900), hra ale neměla režim celé obrazovky bez lišt prohlížeče.

**Úprava.** `src/game/fullscreen.js` (zjištění podpory, zapnutí, vypnutí, starší Safari s předponou webkit). Po kliknutí na **Hrát** se hra přepne na celou obrazovku; volba **Hrát přes celou obrazovku** v Nastavení se ukládá jako `fullscreenEnabled` (starší uložené hry ji mají zapnutou). Tlačítko ⛶ vedle ☰ ji kdykoli přepíná, Esc ji ukončí, F11 prohlížeče funguje dál. Kde prohlížeč celou obrazovku nepovoluje (iPhone), tlačítko ani volba se nezobrazí. Nápověda v Ovládání a README.

**Ověření.** `tests/fullscreen.test.js` (5), `tests/e2e/fullscreen.spec.js` (2). `npm test` 247 z 247, `npm run build` prošlo. Prohlížečové zkoušky na WebGL 2: `fullscreen`, `graphics-quality`, `game`, `physics` 20 z 20 a `photo-mode`, `startup`, `release`, `work`, `shifts`, `sound` 17 ze 17. V Chromiu bez obrazovky se rozměr okna při celé obrazovce nemění, ostatní zkoušky proto ovlivněny nejsou.

**Zkušební stránka.** Revize `2b5f96f` je ve složce `zkouska-vzhledu/` na větvi `gh-pages` od revize `660f89c`. Před zveřejněním se načetla z podsložky na počítači i na emulovaném telefonu bez chyby a bez chybějícího souboru.

**Potvrzení autora.** 23. 11. 2026 autor na zkušební stránce ověřil, že celá obrazovka funguje.

## Blikání, rozmazání a okraje silnic (mimo etapu, na přání autora)

Autor hrál verzi 0.2.0 ze zkušební stránky na počítači a hlásil: textury při jízdě problikávají a rozmazávají se, mezi asfaltem a obrubníkem zůstává pruh jiného povrchu a terén vystupuje přes okraj silnice. Na větvi `claude/bold-ptolemy-36flyi` od revize `3e46e6b`. [Rozbor, měření a snímky](../obraz.md)

**Příčiny (ověřeno).** Jemné vzory (zrno asfaltu 3 cm, zrno omítky 14 cm, spáry cihel) mizely, až když pixel měřil víc než buňka vzoru, a za jízdy blikaly. Asfalt a čáry sousedních dlaždic se kreslily v pořadí podle vzdálenosti od kamery, takže se jejich překryv prohazoval. V Prešovské ležel tramvajový pás ze sousední dlaždice přes asfalt ulice a vedle něj vykukoval světlejší asfalt (měření u 61 334 míst u obrubníků nenašlo žádnou skutečnou díru). Nízká předvolba kreslila na počítači ve 3/4 rozlišení, země se filtrovala jen čtyřnásobně a časové vyhlazení vysoké předvolby obraz za jízdy změkčilo. Terén mezi uzlem pod vozovkou a uzlem za okrajem stoupal nad asfalt.

**Oprava.** `src/world/image-quality.js` (mizení vzorů podle buňky, filtrování, rozlišení, doostření, pořadí dlaždic), `asphalt.js`, `materials.js`, `building-nodes.js`, `postfx.js` (SharpenNode po TRAA), `chunks.js` (pořadí dlaždic podle šachovnice, tramvajový pás se nekreslí na vozovce), `road-edge-terrain.js` a `world.roadEdgeDistance` (snížení uzlů terénu za okrajem vozovky). Původní obraz vrací `?obraz=puvodni`, doostření vypne `?ostreni=0`.

**Ověření.**
- `npm test` 242 z 242 (nové `tests/image-quality.test.js` 6 a `tests/road-edge-terrain.test.js` 3), `npm run build` prošlo.
- Prohlížečové zkoušky na WebGL 2: celá sada 178 ze 182, nová `image-quality.spec.js` 3 ze 3, rozpočet vykreslování na všech předvolbách prošel. `graphics-quality.spec.js` čekala rozlišení 0,75 po přepnutí na nízkou předvolbu; nízká ho na počítači záměrně kreslí v plném rozlišení, očekávání je teď 1 a zkouška prošla. `renderer.spec.js` (minuta hraní) selhává v prostředí dlouhodobě.
- Okraje silnic (32 dlaždic centra, střední předvolba): terén nad asfaltem 0,71 → 0,30 %, nad 5 cm 0,14 → 0,04 %, nejvyšší 0,74 → 0,09 m. Třepot vozovky při posunu kamery o půl pixelu −40 %. Nízká předvolba ostrost proti ideálu 0,82 → 0,93. Vysoká předvolba za jízdy 0,93 → 1,22 původní ostrosti vestoje.
- Výkon: na softwarovém vykreslování nejsou časy použitelné (0,1 až 1,4 snímku za sekundu). Nízká předvolba na počítači kreslí o 78 % pixelů víc, vysoká přidává průchod doostření. Měření na autorově počítači zbývá.

**Otevřená otázka.** `traffic-observation.spec.js`: Klatovská selhává i na původní revizi `3e46e6b` (386,5 s). Hlavní nádraží na nové verzi dvakrát 141 s (mez 120 s), na původní revizi i s `?obraz=puvodni` prošlo. Úpravy nemění kód provozu ani fyziky. Příčina neověřená, nejspíš jiné načasování startu.

[Rozbor, měření a snímky](../obraz.md)

**Odbočka.** První pokus kreslil tramvajový pás jako samostatnou vrstvu pod asfaltem. Přidal tím vykreslovací volání a pohled na Lochotín na nízké předvolbě překročil rozpočet (111 volání, mez 110). Mez se neměnila, pás se místo toho na vozovce nekreslí.

**Zkušební stránka.** Revize `2b193c8` je ve složce `zkouska-vzhledu/` na větvi `gh-pages` od revize `cba17fe`. Před zveřejněním se stránka načetla z podsložky na počítači (`?debug&adapt=0&quality=low`) i na emulovaném telefonu Pixel 7 bez chyby a bez chybějícího souboru, verze 0.2.0, panel Měření funguje. Popis na `gh-pages` uvádí `?obraz=puvodni` a `?ostreni=0`.

## Aktuální verze na zkušební stránce (na přání autora, příprava vydání 0.2.0)

Ve složce `zkouska-vzhledu/` na větvi `gh-pages` je od revize `0d9e98e` sestavení verze 0.2.0 z `main`, revize `6b8df3a`. Předchozí zveřejněná verze (`41c9b3b`) byla o 38 revizí starší a neměla opravu nájezdu Wilsonova mostu ani zvednuté Anglické nábřeží. Seznam 816 souborů se nezměnil. Liší se jen kód hry (`assets/`, `index.html`, `.vite/manifest.json`), data a obrázky jsou stejné. Popis na větvi `gh-pages` uvádí nový vypínač `?nabrezi=0` a adresu panelu měření.

**Ověření před zveřejněním** (22. 11. 2026, revize `6b8df3a`):
- `npm test` 233 z 233, `npm run test:python` 27 testů (1 přeskočený), `npm run build` prošlo.
- `npm run test:e2e -- physics-roads.spec.js physics.spec.js game.spec.js --project=webgl2 --trace off`: 19 z 19, včetně Wilsonova mostu v obou směrech a obou tubusů Valíku.
- Zveřejňovaná složka se otevřela místně z podsložky jako na GitHub Pages v Chromiu na softwarovém WebGL 2. Na počítači (1280 × 720, `?debug&adapt=0&quality=low`) i na emulovaném telefonu Pixel 7 s dotykem šla spustit hra, **O hře** ukazuje verzi 0.2.0 a panel **Měření** začal měřit. Nevznikla žádná chyba stránky a nechyběl žádný soubor.
- Ve snímku s otevřeným panelem **Měření** je pod panelem tmavý obdélník velikosti jeho textového pole. Není to prvek stránky a stejně se objevil i ve starší verzi `b4935e9`. Nejspíš jde o chybu skládání obrazu v prohlížeči bez obrazovky. Na skutečném zařízení zbývá potvrdit, že tam není.

**Zbývá k vydání 0.2.0.** Autor změří hru na počítači a telefonu podle části „Měření vydání na počítači a telefonu“ v [E26](../E26.md) a rozhodne, zda zůstane nový vzhled. Potom se doplní protokol E26 a vydání se označí.

## Anglické nábřeží pod terénem (mimo etapu, na přání autora)

Na větvi `claude/stoic-hopper-46xgy0`, která navazuje na opravu nájezdu Wilsonova mostu (`claude/determined-volta-o7e9t2`, revize `6e3e924`). Oprava je v revizi `ada32f9`. [Rozbor, tabulky a měření](../nabrezi.md)

**Směr.** Zadání i dřívější zápis mluví o úseku „severně od mostu“. Herní z ale roste k jihu: úsek z 458–519 vede od Americké na jih po levém břehu Radbuzy (bod (165; 490) = 49,74309° s. š., 13,37989° v. d.).

**Příčina (ověřeno).** Profil silnice vzniká z výšek výškového modelu v ose. Model má body po 8 m a mezi ulicí nad Radbuzou (asi −3 m) a řekou (asi −12 m) je nábřežní zeď. Jeden uzel sítě leží na ulici, sousední o 8 m dál u vody, a výška mezi nimi klesá rovnoměrně. Celá vozovka Anglického nábřeží (silnice 13188) tak ležela na rozmazané zdi: v z 505 je osa na −9,7 m, terasa začíná 7 m od osy na −3,2 m a voda 7,3 m od osy na −11,4 m. Model tedy nezachytil koryto přímo v ose, ale pád terénu z ulice k řece. Podle mapy je mezi silnicí a vodou jen chodník.

**Druhá chyba se potvrdila jinde.** Body na břehové čáře ve fyzice (`shore()`) se opravdu nesrovnávaly pod pás. Ve 239 dlaždicích s vodou a silnicemi prorůstalo nad pás 14 z 34 235 takových bodů, nejvíc o 19 cm u Radbuzy pod Tyršovou (568; 94). Na Anglickém nábřeží žádný takový bod nebyl. Naměřené prorůstání o 2,2 m u (161,7; 486,5) způsoboval uzel sítě fyziky (160; 488) 4,7 m od osy na ulici (−2,9 m). Ten už leží za pásem 1,5 m od okraje vozovky, který se srovnává pod pás, a trojúhelník od něj k propadlé vozovce (−6,7 m) vystupoval u okraje nad pás.

**Oprava.**
- `src/world/road-grade.js`, `src/world/world.js`: vzorek profilu silnice, která vede z boku podél vody (nejvýš 8 m za okrajem), se zvedne na terasu nad zdí, když terén u osy nebo k terase prudce stoupá (25–50 % na metr) a za terasou už nestoupá. Na úbočí kopce zůstává výška v ose. Zvednutá vozovka je napříč rovná a terén se pod ni dosype i u domů a směrem k vodě (ne do ní). Vypne se `?nabrezi=0`.
- `src/physics/terrain.js`: body na břehové čáře se srovnávají pod pás stejně jako ostatní vrcholy (`roadClampAt`).

**Výsledek na Anglickém nábřeží.** Profil −9,06 … −2,08 m → −3,41 … −2,05 m. Asfalt v z 505 −9,01 → −3,02 m. Asfalt v z 470–515 leží nejvýš 0,00 m pod okolním terénem (dřív 5,72 m), fyzika terénu je v celé šířce aspoň 5 cm pod pásem (dřív o 2,25 m nad ním). Ve městě se zvedlo 14 silnic, všechny na hraně břehu nebo nad zatopeným lomem (Anglické a Denisovo nábřeží, Mlýnské nábřeží, Karlovarská, Pražská, Doubravecká, K Valše, Ke Krkavci a pět účelových cest u vody). Sestavení profilů při startu +0,15 s (1 180 → 1 333 ms v Node).

**Ověření.**
- Dva nové testy v Node (`tests/physics-terrain.test.js`): Anglické nábřeží v z 470–515 (asfalt nejvýš 0,3 m pod okolním terénem, fyzika pod pásem, profil kolísá méně než 1,6 m; s `?nabrezi=0` selže s 5,72 m) a body na břehové čáře pod pásem (na původním `terrain.js` selže s 0,186 m). Testovací svět v Node má nově vodní plochy (`_initWater`).
- `npm test` 231 z 231, `npm run build` prošlo.
- Prohlížečové zkoušky `physics-roads.spec.js physics.spec.js river-detail.spec.js water.spec.js --trace off` (vzor zahrnuje i `structure-water.spec.js`): prošlo 32 z 34. WebGL 2 17 z 17 včetně Wilsonova mostu v obou směrech. Na WebGPU selhaly obě zkoušky `river-detail.spec.js` (medium, ultra) hned při prvním dotazu do stránky chybou `OperationError: A valid external Instance reference no longer exists` (ztráta softwarového zařízení WebGPU). Na původní revizi `6e3e924` bez opravy selhávají v tomto prostředí stejně, opakovaně. Oprava je tedy nezpůsobila.
- Jízda ve hře (nízká předvolba, WebGL 2, 9. 11. 2026 v 10.00, bez MHD a cizích aut) po celém úseku od Americké na jih do 43 km/h: s opravou auto dojelo se zdravím 100, kola se od asfaltu lišila nejvýš o 5 mm a nikdy neztratila dotyk. S `?nabrezi=0` auto nedojelo, zdraví kleslo na 90, kolo se od asfaltu vzdálilo o 1,61 m a kola 13 270krát ztratila dotyk. Snímky před a po jsou v protokolu.

**Otevřené a návrhy.** Čistší oprava by byla v sestavení terénu (`tools/terrain.py`, `burn_lines`), surová data DMR 5G ale v tomto prostředí nejsou. Dům 1545 u nábřeží stojí na průměrné výšce původního modelu a může být o něco níž než ulice. Nábřežní zeď se nevykresluje, k vodě klesá terén strmým svahem.

## Propad nájezdu na Wilsonův most (mimo etapu, na přání autora)

Na větvi `claude/modest-ramanujan-wvjl2i` (revize `faa1a84`) selhávala zkouška „kola unesou auto přes Wilsonův most v obou směrech“: auto dojelo se zdravím 100, ale jedno kolo leželo 5,3 cm pod vozovkou (mez 5 cm). Oprava je na větvi `claude/determined-volta-o7e9t2`.

**Vypínače.** Odchylku pod mez sníží jen `?sklon=0` (5,31 → 2,55 cm). `?chodniky=0` ani `?rohy=0` nic nemění: na nízké předvolbě zkoušky chodníky nejsou a u konců mostů se rohy nedělají.

**Příčina.** Nejhorší kolo stálo 1,2 m před mostovkou na nájezdu z Americké. Tam silnice leží přímo na terénu kalibrovaném podle měření a pás fyziky nemá. Sousední Anglické nábřeží od křižovatky prudce klesá k řece. Terén do 1,5 m za okrajem vozovky se srovnával pod vlastní profil a příčný sklon každé silnice, ne pod společnou výšku křižovatky, ve které pás i asfalt skutečně leží. Okraj nábřeží tak stáhl uzel sítě terénu na nájezdu o 39 cm (bez sklonu o 19 cm). Ve hře měl nájezd skrytou jámu: v ose až 35 cm, u severního okraje až 57 cm pod vykreslenou vozovkou. Zkouška ji zachytila jen okrajově, protože auto startuje na mostovce.

**Oprava** (`src/world/world.js`). V křižovatce se terén srovnává podle společné výšky pásů. U konců mostů, tunelů a ramp okraj sousedního pásu terén nesnižuje. Dotaz na společnou výšku je rychlejší a dává bit po bitu stejný výsledek. Mez zkoušky se nemění.

**Ověření.**
- Zkouška Wilsonova mostu: odchylka kola 5,31 → 0,001 cm v obou směrech, zdraví 100. Oba nájezdy jsou v celé šířce do 0,9 cm od vozovky.
- Nový test v Node hlídá výšku fyziky na nájezdu v šířce ±3 m (na původním kódu selže s rozdílem 57 cm).
- `npm test` 229 z 229, `npm run build` prošlo, `npm run test:e2e -- physics-roads.spec.js physics.spec.js --trace off` 22 z 22 (WebGL 2 i WebGPU).
- Ve městě ubylo míst, kde terén ve fyzice prorůstá nad pás o víc než 5 cm, z 2 871 na 794. Propady pod vozovku nad 20 cm zmizely. Příprava fyziky dlaždice +1 až 3 %.
- Širší sada 21 souborů prohlížečových zkoušek na WebGL 2 (rozpočet vykreslování, hra, chodci, srážky s vybavením ulic, rozvoz, podrobnosti ulic, rozbitné předměty, fyzikální provoz, doprava, postava, stavby, MHD, směny, asfalt, materiály, mimoúrovňová křížení, Rondel, Prazdroj, řeka, jemný terén, stopy kol): 100 ze 100.

**Návrhy mimo úkol.** Profil Anglického nábřeží severně od mostu leží až 2,5 m pod terénem (výškový model u břehu nejspíš zachytil koryto) a body sítě na břehové čáře řeky se pod pás nesrovnávají. Na samém okraji nábřeží u nájezdu vystoupí terén až 15 cm nad pás, mimo stopu kol. [Měření, tabulky a návrhy](../sklon.md#dodatek-proč-kolo-klesalo-pod-nájezd-wilsonova-mostu)

Oba návrhy jsou provedené v části „Anglické nábřeží pod terénem“ výše. Úsek ve skutečnosti leží jižně od mostu (z ve hře roste k jihu).

## Jasné počasí ve všech prohlížečových zkouškách (mimo etapu, na přání autora)

Větev `claude/modest-ramanujan-wvjl2i` spojuje `claude/lucid-bohr-y3rlwb` (chodníky, rohy a příčný sklon) s `claude/exciting-cannon-kzvgbu` (pevné datum zkoušek). Obě vycházejí z revize `35f7265` a sloučily se bez konfliktu.

**Příčina.** Hra bez parametru `weather` losuje počasí podle herního času po tříhodinových úsecích. Bez data v adrese bere čas počítače. V neděli 22. 11. 2026 v 11.00 v Plzni (10.00 UTC) ve hře sněží, sníh pokrývá vozovku celý a přilnavost kol klesne na 0,35. Pomocník `gameUrl` v `tests/e2e/game-url.js` počasí ani datum nenastavoval. Na větvi `claude/lucid-bohr-y3rlwb` proto selhávaly jízdní zkoušky v `game.spec.js` a `physical-traffic.spec.js`. Ve stejný čas na původním kódu zastavil policejní vůz 2,63 m před chodcem, zkouška žádá více než 3 m.

**Úprava zkoušek.** Herní kód se nemění.

- `gameUrl` doplní `weather=clear`, pokud adresa počasí sama nenastavuje. Zkoušky počasí si ho dál nastavují samy: `weather` (sníh), `precipitation` (déšť, potom sníh), `clouds` (zataženo). `asphalt` používá vlastní parametr `wet=1`.
- Když adresa nastaví jen hodinu, `gameUrl` doplní datum pondělí 9. 11. 2026. Když nastaví jen datum, doplní 10.00. Chybějící část by jinak hra vzala z hodin počítače.
- Zkoušky referenčních pohledů (`exposure`, `reference`, `budget`, `materials`) mají pevné datum 17. 11. 2026. Volbou `gameUrl(…, { weather: null })` si ponechají počasí podle tohoto data, protože stejné pohledy fotí a měří `tools/reference_views.mjs`.
- `physical-traffic.spec.js`: zkoušky bez data běžely v aktuálním čase s MHD a provozem podle dne. Výchozí hodnota pomocníka `start` je teď pondělí 9. 11. 2026 v 10.00, jako ve zkouškách provozu. Zkoušky s vlastním datem a hodinou se nemění.
- Zkoušky bez data a hodiny, které záměrně používají hodiny prohlížeče (`clock`, `page.clock.setFixedTime`), nebo uloženou hru, zůstávají v aktuálním čase. Mají jen jasno.

**Ověření.** Prošlo 228 z 228 testů JavaScriptu a produkční sestavení. Herní kód se mezi revizemi `3e8f5ee` (bez úpravy) a `faa1a84` (s úpravou) neliší, oba běhy používají stejné sestavení.

Celá sada na WebGL 2 běžela v neděli 22. 11. 2026 od 11.13 do 12.19 v Plzni, kdy ve hře sněžilo a přilnavost byla 0,35. Prošlo 176 ze 179 zkoušek za 1,1 hodiny. U všech tří neúspěšných zkoušek rozhodlo opakování na obou revizích:

| Zkouška | Bez úpravy | S úpravou | Závěr |
|---|---|---|---|
| `physics-roads` · Wilsonův most v obou směrech | odchylka kola 0,05306 m (mez 0,05 m) | stejná odchylka 0,05306 m | Nezávisí na počasí ani čase. Zkouška má pevné datum a přilnavost je v obou případech 1,0. Dřív ji zakrývala srážka s trolejbusem 12. Na `claude/exciting-cannon-kzvgbu` bez chodníků a sklonu prošla. Na samostatnou opravu čeká návrh úkolu. Místo: x = 170,20, z = 456,99, kolo 5,3 cm pod mostovkou. |
| `renderer` · minuta hraní ve dne i v noci | 21 snímků za 30 s (mez > 30) | 20 snímků | Vykreslování v tomto prostředí běží jen na procesoru a je na zkoušku pomalé. |
| `traffic-observation` · ranní špička na Klatovské | stání 205 s (mez 120 s) | v celé sadě 343 s, při opakování prošla | Kolísání provozu, jako dřív v E20. Mlha a oblaka mění jen obraz, ne řidiče. |

Dotčené soubory jsem spustil i v jiných časech: `game`, `physical-traffic`, `weather`, `precipitation`, `clouds` a `asphalt`, celkem 34 zkoušek. Čas spuštění nastavují hodiny prohlížeče (`page.clock.setFixedTime`) v dočasné kopii zkoušek mimo repozitář. Nástroj `faketime` pro celý systém se nehodil, hra se pod ním v prohlížeči nenačetla.

| Čas spuštění (Plzeň) | Počasí ve hře | Bez úpravy | S úpravou |
|---|---|---|---|
| neděle 22. 11. 2026, 11.00 | sněžení, sníh 1,0, přilnavost 0,35 | policejní vůz 2,63 m před chodcem (mez > 3 m) | 34 z 34 |
| sobota 14. 11. 2026, 22.00 | noc, sněžení, sníh 0,96, přilnavost 0,38 | policejní vůz i dodávka prošly | 34 z 34 |
| neděle 21. 6. 2026, 21.45 | letní soumrak, polojasno | – | 34 z 34 |
| pondělí 23. 11. 2026, 7.30 | ranní špička, déšť, přilnavost 0,70 | – | 34 z 34 |

Simulace zopakovala selhání policejního vozu s přesně stejnou vzdáleností jako skutečný běh v neděli v 11.10, tedy 2,62743664949375 m. Zkoušky `weather`, `precipitation`, `clouds` a `asphalt` jsem spustil také na WebGPU. Prošla jen `weather`. Ostatní tři selhaly s chybou „A valid external Instance reference no longer exists“ stejně i na revizi bez úpravy. Softwarový adaptér WebGPU je v tomto prostředí nespolehlivý. Záznamy běhů zůstaly jen v dočasném adresáři prostředí.

**Návrh mimo tento úkol.** Zkoušky bez data a hodiny v `traffic`, `transit`, `work` a `breakables` mají teď jasno. Jízdní řád MHD, hustota provozu a noc se v nich ale dál řídí dnem spuštění. Předchozí rozbor 29 souborů je nezahrnul, protože v jiné zkoušce stejného souboru datum je. Doporučuji projít je stejným postupem jako `physical-traffic`.

## Vzhledová zkouška (mimo etapu, na přání autora)

Na větvi `claude/lucid-bohr-y3rlwb` vznikla vzhledová zkouška webové verze: silnější slunce, slabší odraz oblohy na fasádách, tmavší zem v mapě odrazů, sytější omítky a oblé koruny stromů. Původní světlo zapne `?vzhled=puvodni`. Autor rozhodne podle zveřejněné zkoušky, zda se vzhled převezme. [Protokol a snímky](../vzhledova-zkouska.md)

## Doladění zaoblených rohů (mimo etapu, na přání autora)

Asfalt oblouku zasahuje 0,3 m pod pás vozovek (zmizela světlá spára), kusy chodníku kratší než 3 m (zbytky v ostrůvcích) se nekreslí a auta řízená hrou odbočují vpravo v rohu po oblouku soustředném s obrubníkem (7 272 z 12 683 odbočení v rozích, typicky 9,3 m místo 5 m), pokud celá šířka auta zůstane na asfaltu. Asfalt rohu se počítá do vozovky i pro rozmístění vybavení, parkování a trávy. Prošlo 230 testů JavaScriptu a 96 z 97 prohlížečových zkoušek (Wilsonův most selhává dlouhodobě); zkoušky běžely s `weather=clear`, protože ve skutečném čase v herní Plzni sněžilo. [Popis a snímky](../rohy.md#doladění-rohů)

## Příčný sklon silnic (mimo etapu, na přání autora)

Silnice s hladkým profilem jsou napříč skloněné podle svahu vedle silnice (nejvýš 4 %). Zatáčky silnic mimo obytné ulice jsou klopené podle křivosti (nejvýš 6 %), klopení mizí u křižovatek, na koncích a mezi domy. Navazující silnice mají ve společném bodě stejný sklon, na mostovky se napojí bez sklonu. Sklon platí pro asfalt, fyziku, auta, chodníky, rohy i křižovatky. Terén se na nižší straně srovnává od roviny vozovky a dlaždice se zářezem nad 0,3 m má jemnější síť terénu. Vypne ho `?sklon=0`. Drncání mezi křižovatkami +2 %, v křižovatkách −16 %, prosvítání terénu u okraje 3,44 % → 2,62 %. Start hry asi +0,5 s. Prošlo 228 testů JavaScriptu a 110 ze 111 prohlížečových zkoušek (Wilsonův most selhává dlouhodobě). [Popis, měření a snímky](../sklon.md)

## Zaoblené rohy křižovatek (mimo etapu, na přání autora)

Každý roh křižovatky a vnitřní strana ostrého ohybu silnice má asfaltový oblouk o poloměru 4–12 m podle šířky ulic (17 950 oblouků, typicky 7,8 m). Obrubník a chodník ho obcházejí, líc obrubníku je zkosený, aby přes něj auto přejelo. Asfalt oblouku má i fyzika. Vypne je `?rohy=0`. Prošlo 225 testů JavaScriptu a 109 ze 111 prohlížečových zkoušek (Wilsonův most selhává dlouhodobě, odbočení z Kardinála Berana bylo náhodné a samostatně prošlo třikrát). [Popis a snímky](../rohy.md)

## Chodníky a obrubníky (mimo etapu, na přání autora)

Podél městských ulic vzniká od střední předvolby chodník s obrubníkem 10 cm nad asfaltem; vykreslení, fyzika i chodci používají stejné řezy. Chodník se kreslí do 380 m od kamery, aby se vešel do rozpočtu vykreslování. Vypne ho `?chodniky=0`. Prošlo 218 testů JavaScriptu a 104 ze 105 prohlížečových zkoušek (neprošel jen dlouhodobě selhávající Wilsonův most). [Popis a snímky](../chodniky.md)

## Hladký profil silnic (mimo etapu, na přání autora)

Autor si stěžoval na hrbolaté silnice v kopcích. Na větvi `claude/lucid-bohr-y3rlwb` má každá silnice hladký podélný profil, terén pod vozovkou se mu přizpůsobí a fyzika jede po pásu silnice. Okolí měřených mostů, tunelů a ručně upravených křížení zůstává beze změny, v křižovatkách platí výška důležitější silnice. Původní silnice zapne `?silnice=puvodni`. Ve fyzice hry klesl počet rázů mezi křižovatkami ze 180 na 51 na km, v kopcích ze 464 na 79; v křižovatkách zůstává hrbolatost zhruba stejná. [Protokol, měření a snímky](../silnice.md)

Zkouška Wilsonova mostu selhávala o víkendu kvůli srážce s trolejbusem 12. Zkušební auto jede po ose mostu a v 10.00 se čelně srazilo s víkendovým trolejbusem 12 v protisměru. Vozidla se překrývala asi o 0,25 m. V pátek i v pondělí zkouška procházela. Most, profil silnic ani fyzika kol chybu nezpůsobily. Zkouška má nyní pevné datum a před měřením odstaví MHD a cizí auta. Prošlo všech 11 případů `physics-roads.spec.js` a `physics.spec.js` na WebGL 2, 212 testů JavaScriptu a sestavení. Deset dalších souborů prohlížečových zkoušek nemělo pevné datum. Jejich úprava je popsaná v následující části. [Měření a oprava](../silnice.md#dodatek-proč-selhávala-zkouška-wilsonova-mostu)

## Pevné datum v dalších prohlížečových zkouškách (mimo etapu, navazuje na opravu Wilsonova mostu)

Deset souborů prohlížečových zkoušek nastavovalo hodinu bez data, takže hra brala den spuštění. Podle data se ve hře mění jízdní řád MHD pro všední den a víkend, hustota aut a chodců, počasí, poloha slunce a roční období stromů. Počasí se losuje po tříhodinových úsecích. Například v 10.00 je 9. 11. 2026 zataženo a sucho, 21. 11. je mokro, 22. 11. sněží a 14. 11. leží téměř souvislý sníh.

Na větvi `claude/epic-goodall-4sf609`, která navazuje na `claude/sweet-carson-xmt7sk`, má všech 11 zkoušek s nastavenou hodinou pevné datum pondělí 9. 11. 2026, stejně jako zkoušky provozu. Zkouška interiérů má navíc jasné počasí. Ostatní zkoušky v těchto souborech nenastavují hodinu ani datum a na dni nezávisí, proto zůstaly beze změny. Očekávání zkoušek ani herní kód se nemění.

### Co podle dne mění jednotlivé zkoušky

| Soubor · zkouška | Co se podle dne mění | Úprava |
|---|---|---|
| `prazdroj` · průjezd pod lávkou U Prazdroje (10.00) | Mokro a sníh snižují přilnavost kol, ve všední den jezdí dvakrát víc vozů MHD. Na sněhu trval průjezd 5,83 s z povolených 6 s, výsledek se tedy může změnit. | datum |
| `interiors` · místnost za stejným oknem (10.00) | Zkouška porovnává barvy okna. Slunce, oblačnost, mlha a sníh mění jejich jas, výsledek se tedy může změnit. | datum a jasno |
| `sky-depth` · obloha na nízké předvolbě (10.00, jasno) | Poloha slunce a barva stromů mění barvy oblohy i ulic, které zkouška počítá. | datum |
| `character` · vystoupení na mostě, v tunelu a na střeše (10.00) | Při přistání vrtulníku běží 120 kroků hry s MHD a provozem podle dne. | datum |
| `flight` · let rychlostí 300 km/h (10.00) | Během 2 550 kroků letu hra kolem vrtulníku simuluje MHD a provoz podle dne. | datum |
| `car-appearance` · světla auta (22.00) | Ve 22.00 je v Plzni po celý rok tma, světla se tedy rozsvítí vždy. Déšť, mlha a sníh ale mění, které efekty se vykreslí a jejichž chyby zkouška hlídá. | datum |
| `facade-detail` · povrchy budov (10.00) | Déšť nebo sníh přidají do snímku další efekty. | datum |
| `graphics-failure` · poškozená barevná tabulka a textury (10.00) | Počasí mění efekty prvního herního snímku. | datum |
| `clouds` · obraz oblaků (12.00, vynuceně oblačno) | Krytí a tvar oblaků na datu nezávisí, mění se jen poloha slunce a barva oblohy. Datum zajistí stejný obraz při opakování. | datum |
| `photo-mode` · fotorežim z menu a paprsky na ultra (12.00, jasno) | Mění se poloha slunce, do kterého míří kamera, a roční období stromů. V poledne je slunce po celý rok nad obzorem. | datum |

### Zkoušky ponechané bez data

- `character`, čtyři zkoušky chůze u zábradlí, po chodníku a pod mosty: hra stojí v menu a posouvá se jen chodec mezi pevnými kolizemi. Tělesa MHD a aut vznikají až v kroku hry, který tyto zkoušky nespouštějí. Počasí chůzi neovlivňuje.
- `flight`, přistání na FN Lochotín a na heliportu: zkouška vypíná auta i chodce. Ze všech 370 tras MHD vede nejbližší 160 m od střechy a 414 m od heliportu, takže se vůz MHD k místu přistání nedostane blíž. Počasí let neovlivňuje.
- `flight`, načtení vypnuté letové asistence: ověřuje jen uložené nastavení.
- `graphics-failure`, porucha katalogů (dvě zkoušky) a pomalá síť (dvě zkoušky): ověřují, co se stáhne a zda lze začít hrát. Na datu to nezávisí.
- `photo-mode`, klávesa fotorežimu v mapě: ověřuje jen přepínání oken a ovládání.

### Ověření

V Chromiu na WebGL 2 prošlo ve čtyřech bězích všech 22 případů deseti souborů:

- původní zkoušky dnes, v neděli 22. 11. 2026, kdy v 10.00 sněží: 22 z 22,
- upravené zkoušky s pevným datem 9. 11. 2026 předepsaným příkazem: 22 z 22,
- upravené zkoušky s datem posunutým na sobotu 21. 11. 2026: 22 z 22,
- upravené zkoušky s datem posunutým na pondělí 23. 11. 2026 s mokrou vozovkou: 22 z 22.

Prošlo také 212 testů JavaScriptu (`npm test`) a sestavení (`npm run build`).

Samostatné měření průjezdu U Prazdroje ukazuje, jak velký je rozdíl mezi dny. Zkouška povoluje na 28 m nejvýše 6 s.

| Datum | Den | Počasí v 10.00 | Přilnavost kol | Průjezd tam / zpět | Vozů MHD | Nejbližší vůz MHD |
|---|---|---|---:|---:|---:|---:|
| 9. 11. 2026 | pondělí | zataženo, sucho | 1,00 | 4,62 / 3,62 s | 83 | 40 m |
| 14. 11. 2026 | sobota | jasno, sníh 0,97 | 0,37 | 5,83 / 5,25 s | 41 | 189 m |
| 21. 11. 2026 | sobota | polojasno, mokro 0,86 | 0,74 | 4,60 / 3,87 s | 41 | 189 m |
| 22. 11. 2026 | neděle | sněžení, sníh 0,49 | 0,68 | 4,63 / 4,02 s | 41 | 189 m |
| 23. 11. 2026 | pondělí | jasno, mokro 0,83 | 0,75 | 4,65 / 3,85 s | 83 | 40 m |

Zdraví auta zůstalo ve všech dnech 100 a kola se od terénu vzdálila nejvýše o 0,073 m.

### Návrh mimo tento úkol

Dalších 29 souborů prohlížečových zkoušek nikde nenastavuje datum: `asphalt`, `budget`, `exposure`, `game`, `grade-separations`, `graphics-quality`, `grass`, `heritage`, `orthophoto`, `particles`, `pedestrians`, `performance`, `postfx`, `reference`, `release`, `river-detail`, `rondel`, `shadows`, `shifts`, `solar`, `sound`, `startup`, `street-collision`, `street-delivery`, `structure-water`, `structures`, `terrain-detail`, `water` a `wheel-trails`. Hodinu nastavují jen `game`, `shadows`, `solar` a `sound`, ostatních 25 souborů běží v aktuálním čase. Doporučuji je projít stejným postupem.

Návrh je proveden v následující části. Výčet platil jen pro zápis `date=` přímo v adrese. Šest z těchto souborů nastavuje datum jinak a tři další u některých zkoušek pevně nastavují hodiny prohlížeče, viz níže.

## Pevné datum ve zbývajících prohlížečových zkouškách (mimo etapu, navazuje na předchozí část)

Na větvi `claude/exciting-cannon-kzvgbu`, která navazuje na `claude/epic-goodall-4sf609`, jsem prošel všech 29 souborů. Zkouška závisí na dni, pokud během ní běží herní smyčka s MHD a provozem, auto jede s přilnavostí podle počasí nebo se vykresluje snímek, jehož efekty mění noc, mlha a srážky. Bez parametru `hour=` totiž zkouška běží v aktuálním čase. Při ověření v neděli 22. 11. ve 3.20 tak hra kreslila noční Plzeň v mlze.

Pevné datum pondělí 9. 11. 2026 a hodinu 10.00 má nyní 17 zkoušek v 9 souborech. Ostatní zkoušky zůstaly beze změny a důvod je uveden u každé z nich. Žádná z upravených zkoušek neporovnává barvy obrazu, proto jasné počasí (`weather=clear`) nepřibylo nikde. Jas porovnává jen zkouška expozice a ta má datum, hodinu i počasí pevné z referenčních pohledů. Očekávání zkoušek ani herní kód se nemění.

### Upravené zkoušky

| Soubor · zkouška | Co se podle dne nebo hodiny mění | Úprava |
|---|---|---|
| `heritage` · pilotní památky | Zkouška nastaví 21.48 a čeká úplnou noc (`night = 1`). Den ale bere z kalendáře. Od konce května do konce července v tu dobu v Plzni ještě není úplná tma: 21. 6. je noc jen 0,59, 15. 7. 0,72. Zkouška by tedy v létě selhala. Hlídá také chyby vykreslení s mokrou dlažbou. | datum a hodina |
| `asphalt` · mokrý povrch vozovky | Zkouška vykreslí snímek a hlídá chyby shaderů. V noci přibudou světla lamp a aut, mlha a srážky přidají další efekty. | datum a hodina |
| `grass` · stébla v parku | jako `asphalt` | datum a hodina |
| `terrain-detail` · blízký terén (low, medium) | jako `asphalt` | datum a hodina |
| `river-detail` · proud a odrazy u jezu (medium, ultra) | jako `asphalt`, navíc počítá odrážející plochy vody | datum a hodina |
| `game` · chůze, navigace, auto, vrtulník a rozvoz | 960 kroků hry s MHD a provozem podle dne. Rozjezd auta závisí na přilnavosti kol. | datum a hodina |
| `game` · silniční trasy do Rokycan, Hrádku a Dobřívi | Počítačem řízené auto jezdí na mokru a sněhu pomaleji (rychlost se násobí odmocninou přilnavosti). Na sněhu nestihne dvě nejdelší trasy v limitu kroků. | datum a hodina |
| `game` · E03 hamr, mosty a hranice mapy | 820 kroků letu s MHD a provozem podle dne, jízda přes Wilsonův most s přilnavostí podle počasí. | datum a hodina |
| `game` · oba tubusy Valíku | Auto zatáčí tunelem. S menší přilnavostí může víc klouzat ke stěnám. Zkouška také vykresluje a hlídá chyby. | datum a hodina |
| `game` · mobilní ovládání | 120 kroků hry na náměstí s MHD a provozem podle dne. | datum a hodina |
| `pedestrians` · náraz auta do chodce, auto srazí pěšího hráče | Zkušební plocha vypne MHD i nová auta, přilnavost kol jedoucího auta se ale mění s počasím. | datum a hodina |
| `rondel` · průjezd okruhem a pod mosty | Auto zatáčí po okruhu, mokro a sníh snižují boční přilnavost. | datum a hodina |
| `water` · mělčina a hluboká nádrž | Auto vjíždí z břehu do nádrže s přilnavostí podle počasí. Herní smyčka běží 1 100 kroků. | datum a hodina |

V `game.spec.js` přidává datum a hodinu společná funkce `boot(page, FIXED_DAY)`. Zkoušky, které datum nepotřebují, volají `boot(page)` jako dosud.

### Zkoušky, které už datum mají jiným způsobem

- `budget`, `exposure`, `reference`: pomocník `openReferenceGame` nastaví 17. 11. 2026, hodinu podle pohledu a pevnou řadu náhodných čísel.
- `shadows` (17. 11. 2026, 10.00) a `solar` (19. 10. 2026, 10.00): datum a hodinu nastavují přes `searchParams`.
- `postfx`, pohyb dveří tramvaje pro TRAA: datum 9. 11. 2026 přes `searchParams`. Na hodině nezáleží. Hra se neposouvá, tramvaj se postaví do zastávky bez ohledu na čas a zkouška počítá jen pohyb dveří, ne světlo. Běží jen na WebGPU.
- Pevné hodiny prohlížeče (`page.clock.setFixedTime`): `game` · tramvaj a uložený postup, `game` · uložení verze 1 (záměrně ověřuje převzetí času v Plzni, 11.20), `shifts` · změna času přeruší směnu a tři celé směny, `sound` · stereo tramvaje.

### Zkoušky ponechané bez data

- `game` · jemný terén u Klabavy: posouvá se jen chodec po terénu, MHD ani auta se nepočítají.
- `grade-separations`, Bolevec a Wenzigova, D5 u Šlovic: auto jede rovně bez řízení a bez brzdy. Přilnavost podle počasí tlumí jen boční smyk, který bez zatáčení nevzniká. Obě zkoušky prošly i v sobotu 14. 11. 2026 v 10.00 na sněhu s přilnavostí 0,37.
- `graphics-quality` (2): volba a uložení předvolby grafiky.
- `heritage` · měřené budovy po selhání stahování: ověřuje stahování a náhradní zástavbu.
- `orthophoto` (4): stahování a nastavení leteckých snímků.
- `particles`, `wheel-trails`: výpočet částic. Povrch pod koly si zkouška `wheel-trails` určuje sama.
- `pedestrians` · pád z výšky: zkušební plocha vypne MHD i nová auta, auto se nepoužije a pád postavy na počasí nezávisí. `pedestrians` · vypnutí pádů: jen nastavení.
- `performance` (3): ověřuje, že měření existuje a panel jde otevřít.
- `postfx` (4 předvolby): nastavení vyhlazení a více než 10 vykreslovacích volání.
- `release`: objevení Krkavce, pokuta a garáž nezávisí na čase. Hlídka se zkouší postavit až na 60 místech, MHD ji tedy nezablokuje.
- `shifts` · zrušení, přerušení a pokuta: hra nabídne nejbližší odjezd tramvaje 1, která jezdí každý den. Zkouška ověřuje jen zrušení, přerušení a pokutu.
- `sound` · klakson: zkouška před měřením odebere ostatní auta i všechna vozidla MHD. `sound` · hamr: kola hamru se točí od 9 do 17 hodin a hodinu 16.59.59 si zkouška nastaví sama.
- `startup`: stránka otevřená z disku, hra se nespustí.
- `street-collision`: vlastní fyzikální svět s pevnou přilnavostí 1.
- `street-delivery`: rozvoz nezávisí na hodinách, chůze hráče nezávisí na počasí.
- `structure-water`, `structures` (7): tvar, kolize a start bez měřených objektů.
- `water` · plavec v Radbuze: jen plavání a chůze.

### Ověření

V Chromiu na WebGL 2:

| Běh | Datum a čas ve hře | Počasí ve hře | Výsledek |
|---|---|---|---|
| 9 souborů před úpravou | aktuální čas, neděle 22. 11. 2026 od 3.18 | v noci mlha, sucho | 25 z 25 (včetně `structure-water`) |
| všech 29 souborů po úpravě | upravené 9. 11. 2026 v 10.00, ostatní v aktuálním čase (neděle 3.27–3.46) | upravené zataženo a sucho, ostatní v noci mlha | 72 z 72 za 18,2 min |
| 9 upravených souborů | sobota 21. 11. 2026, 10.00 | polojasno, mokro 0,86, přilnavost 0,74 | 24 z 24 |
| 9 upravených souborů | pondělí 23. 11. 2026, 10.00 | jasno, mokro 0,83, přilnavost 0,75 | 24 z 24 |
| `heritage` | neděle 21. 6. 2026, 10.00 | – | 1 z 2. Pilotní památky selhaly na `night = 1`, ve 21.48 vyšla noc 0,589. Potvrzuje letní chybu. |
| `grade-separations`, bez úpravy | sobota 14. 11. 2026, 10.00 | jasno, sníh 0,97, přilnavost 0,37 | 2 z 2 |
| `game`, `pedestrians`, `rondel`, `water` | sobota 14. 11. 2026, 10.00 | jasno, sníh 0,97, přilnavost 0,37 | 14 z 16, viz níže |

Pro posunuté běhy jsem dočasně přepsal `date=2026-11-09` v adrese upravených zkoušek a soubory potom vrátil z gitu. Pevné hodiny prohlížeče (`page.clock`) zůstaly beze změny. Na WebGPU jsem zkoušky nespouštěl. Prošlo také 212 testů JavaScriptu (`npm test`) a sestavení (`npm run build`).

Na sněhu 14. 11. selhaly dvě zkoušky, které před úpravou běžely v aktuálním čase. Za takového počasí by tedy selhaly i bez posunu data:

- `game` · chůze, navigace, auto, vrtulník a rozvoz: auto se za 2 s rozjelo jen na 3,0 m/s, zkouška žádá více než 5 m/s.
- `game` · silniční trasy: počítačem řízené auto nedojelo za 100 000 kroků do cíle na dvou nejdelších trasách (29,9 km). Na cestě k hamru mu chybělo 2 671 m, na zpáteční cestě 1 056 m. Čtyři kratší trasy dojely. Za sucha 9. 11. dojelo všech šest tras nejvýše 2,3 m od cíle.

U zkoušek vody sníh výsledek změnil jen málo, daleko od mezí. V hluboké nádrži trvalo potopení 6,93 s místo 6,95 s, auto skončilo o 0,25 m dál. Na mělčině zůstala střecha 0,418 m nad vodou místo 0,428 m.

Chování na sněhu je věrohodné a herní kód zůstává beze změny. Pokud má hra ověřovat i jízdu na sněhu, navrhuji pro ni samostatnou zkoušku s vlastními mezemi, například s datem 14. 11. 2026.

## Ověření brzd po načtení auta

Na WebGL 2 prošla zkouška zakázek a garáže po sjednocení počasí při měření brzd. Archiv větve `f6d41bb` obsahuje opravenou zkoušku. Webový ZIP je po bajtech shodný s herní revizí `5233937`. Na témže webu pokračuje úplná sada a dlouhá jízda. [Výsledek a podmínky zkoušky](../E26.md#brzdění-po-vyzvednutí-auta-z-garáže)

## Ověření ranní špičky a archiv

Na herní revizi `5233937` prošla ranní špička u hlavního nádraží i na Klatovské na WebGL 2 a WebGPU. Nejdelší stání ze všech čtyř běhů dosáhlo 118 s při limitu 120 s. Prošlo také všech 70 cílených prohlížečových případů dopravy. Tři verze Node.js sestavily přesně stejný web jako v archivu. Uložený postup prošel přechodem z E12 i E25 do nové verze a zpět. Zbytek úplné prohlížečové sady pokračuje. [Měření a otisky souborů](../E26.md#špička-na-dvou-místech-a-archiv-po-úpravě-rampy)

## Rampa u hlavního nádraží

Návrat z předchozího archivu do E12 i E25 prošel. U hlavního nádraží odhalilo pozorování na WebGL 2 stání 181 s. Po úpravě příčného sklonu a brzdění ve sjezdu bylo při opakování nejdelší stání 57 s. Prošlo 185 testů JavaScriptu, 27 testů Pythonu a sestavení. Pokračují prohlížečové zkoušky vydání na obou vykreslovacích cestách. [Povrch rampy, brzdění a provoz](../E26.md#příčný-sklon-nádražní-rampy-a-brzdění-ve-sjezdu)

## Archiv po opravě rozjezdu

Na větvi E26 je oprava `87aba55`. Pět cílených průjezdů křižovatkou prošlo na každé z obou vykreslovacích cest. Z rozbalených zdrojů se na třech verzích Node.js podařilo sestavit přesně stejných 816 webových souborů. Další pozorování špičky, návrat s uloženou hrou a zbytek úplné sady jsou rozpracované. [Archiv a ověřené průjezdy](../E26.md#archiv-a-průjezd-křižovatkou-po-opravě-rozjezdu)

## Rozjezd na protější zelenou

Řidič odbočující vlevo nyní počká na vůz rozjíždějící se z protější čáry. Na softwarovém WebGPU prošlo deset minut ranní špičky na Klatovské. Nejdelší stání bylo 117,5 s při limitu 120 s. Prošlo také všech 184 testů JavaScriptu, 27 testů Pythonu a sestavení. Další ověřování dopravy a celého vydání pokračuje. [Výsledky a rozsah měření](../E26.md#rozjezd-protisměru-na-zelenou)

## Dlouhá jízda splněna

V jedné souvislé jízdě se vůz čtyřikrát vrátil do Plzně a ujel 205,27 km. Při posledních dvou návratech klesl počet textur z 81 na 73 a počet geometrií z 275 na 272. Počet těles zůstal na 887 a úlomků na nule. Úplná prohlížečová sada pokračuje. Na Klatovské odhalila vůz čekající 545 s při požadavku méně než 120 s. [Záznam všech návratů](../E26.md#čtyři-návraty-po-trase-plzeňrokycanydobřív)

## Spuštění z místní sítě a z disku

V emulaci dotyku hra z rozbaleného archivu přes HTTP automaticky vybrala WebGL 2. Hráč se pohnul páčkou a otevřel mapu. Po sestavení do běžné složky `dist` prošla také opravená příprava zkoušky otevření HTML z disku. Měření na fyzickém telefonu zůstává otevřené. [Podmínky zkoušek](../E26.md#spuštění-na-telefonu-přes-místní-http)

## Archiv s úplným seznamem modulů

Revize `962291e` má ověřené archivy, sestavení na třech verzích Node.js a oba návraty s uloženým postupem. Hra používá stejných 815 souborů jako při probíhajících zkouškách. [Otisky archivů a rozsah ověření](../E26.md#archiv-s-úplným-seznamem-modulů)

## Úplnost fyzikálního modulu ve webovém archivu

Archivace odhalí chybějící modul Joltu i při úplném vstupním HTML. Ověřili jsme to na kopii produkčního sestavení. Prošlo 183 testů JavaScriptu a 27 testů Pythonu. Obsah 815 dosavadních herních souborů se shoduje s kandidátem `254ae60`. Prohlížečová sada a dlouhá jízda pokračují. [Zkouška neúplného webu](../E26.md#úplnost-fyzikálního-modulu-ve-webovém-archivu)

## Ověření archivů po opravě rozvozu MHD

Web kandidáta `254ae60` se shoduje po sestavení na všech třech podporovaných verzích Node.js. Oba návraty s uloženou hrou prošly. Samostatný průjezd místem dřívějšího zastavení měřil 1131,61 m. Úplná prohlížečová sada a porovnání zásob při čtvrtém návratu zůstávají otevřené. [Otisky archivů a výsledky průjezdu](../E26.md#ověření-archivů-po-opravě-rozvozu-mhd)

## Mělčina, hluboká voda a plavání

Na opraveném sestavení prošlo všech osm cílených kontrol na WebGL 2 a WebGPU. Zahrnují rozvoz MHD, dvě fiktivní nádrže a plavání v mapě Radbuzy. Úplná sada nyní obsahuje 360 případů. Otevřená je úplná sada, porovnání třetího a čtvrtého návratu a kontroly na autorových zařízeních. [Výsledky zkoušek vody](../E26.md#mělčina-hluboká-voda-a-plavání)

## Počítání zpátečky při zkoušce čtyř okruhů

Zkouška čtvrtého okruhu na revizi `d4630eb` skončila po 196,42 km. Opravený nástroj přičte pokus až při skutečném couvání. Ověření prošlo v záznamu řídicích vstupů i na fiktivní dráze v Joltu. Prošlo 183 testů JavaScriptu, 27 testů Pythonu a produkční sestavení. Dlouhá jízda zůstává otevřená. [Výsledky zkoušky řízení](../E26.md#počítání-zpátečky-při-zkoušce-čtyř-okruhů)

## Pěší cesta k tramvaji při rozvozu MHD

Opravenou trasu k nástupišti prošel hráč na WebGL 2 i WebGPU. V obou případech dokončil přestup a doručil zásilku pěšky. Prošlo 183 testů JavaScriptu, 27 testů Pythonu a produkční sestavení. Úplná sada vydání a čtyři návraty autem jsou dál rozpracované. [Průběh zakázky](../E26.md#pěší-cesta-k-tramvaji-při-rozvozu-mhd)

## Archiv a návrat uloženého postupu s místním zjemněním terénu

Tři podporované verze Node.js sestavily stejný web jako archiv revize `667277b`. Návrat s uloženým postupem do E12 a E25 prošel. Sestavení přímo z rozbalených zdrojů prošlo i po samostatné instalaci závislostí. Zkouška skončila neúspěšně. Řádky tabulky odpovídají skutečně dokončeným návratům. [Dlouhá jízda na předchozí revizi](../E26.md#dlouhá-jízda-na-revizi-d4630eb) · [Velikosti, otisky a výsledky zkoušek](../E26.md#archiv-a-návrat-uloženého-postupu-s-místním-zjemněním-terénu)

## Počet trojúhelníků u opraveného nájezdu

Ve stejném pohledu na opravený břeh klesl počet trojúhelníků na WebGPU z 59 058 na 28 736. Výšky pro jízdu zůstávají společné s terénem. Na herním kódu `d4630eb` je doloženo 3 z celkem čtyř návratů. Při posledním zaznamenaném návratu bylo 81 textur, 275 geometrií, 887 těles a 0 úlomků. Úplná prohlížečová sada je rozpracovaná. [Měření a minutová zkouška](../E26.md#počet-trojúhelníků-u-opraveného-nájezdu)

## Archiv a návrat uloženého postupu po napojení mostovky

Tři podporované verze Node.js sestavily stejný web jako archiv revize `d4630eb`. Návrat s uloženým postupem do E12 a E25 prošel. [Velikosti, otisky a výsledky zkoušek](../E26.md#archiv-a-návrat-uloženého-postupu-po-napojení-mostovky)

## Plynulý výjezd z mostu na břeh

Řidič při dlouhé jízdě uvízl ve druhém okruhu po 87,72 km. Pomalý průjezd odhalil pod pravými koly pokles o 1,33 m na konci mostovky. Po napojení terénu přes celou šířku vozovky vůz shodným úsekem projel bez couvání. Prošlo 182 testů JavaScriptu, produkční sestavení a kontrola obou směrů jízdy přes Wilsonův most ve WebGL 2 i WebGPU. Nová dlouhá jízda a úplná sada 358 zkoušek pokračují. [Měření břehu a výsledky průjezdů](../E26.md#přechod-z-mostu-na-šikmý-břeh)

## Archiv a návrat uloženého postupu po úpravě řízení

Tři podporované verze Node.js sestavily stejný web jako archiv revize `dc58b1f`. Návrat s uloženým postupem do E12 a E25 prošel. [Velikosti, otisky a výsledky zkoušek](../E26.md#archiv-a-návrat-uloženého-postupu-po-úpravě-řízení)

## Opakování dlouhé jízdy

Předchozí jízda skončila ve třetím okruhu po 103,21 km překročením 12 m od bodu trasy. Po úpravě řízení se vůz na fiktivní přímé dráze vrátil z odchylky 11 m s maximem 11,515 m. V samostatné jízdě přes dotčený úsek ujel 1,04 km bez vyprošťování. Prošlo 182 testů JavaScriptu, 27 testů Pythonu a produkční sestavení. Zbývá porovnat zásoby při třetím a čtvrtém návratu. [Výsledky jízdy](../E26.md#návrat-zkušebního-řidiče-do-pruhu)

Návrat uloženého postupu z archivované revize `2516ec7` do E12 i E25 prošel včetně zachování nákupu vozu a postupu získaného v kandidátovi. [Výsledky obnovy](../E26.md#obnova-postupu-u-kandidáta-2516ec7)

## Zrnitost povrchu v dálce

U vzdálených povrchů nyní shader přeskočí výpočet jemné nebo střední zrnitosti v místech, kde by její váha byla nulová. Výpočet šířky pixelu zůstává mimo obě podmínky, aby měl stejnou hodnotu i na jejich hranicích.

Časy stejné úpravy na větvi E24 jsou v jejím protokolu. Zde šlo o funkční zkoušky.

Na E26 prošlo 182 testů JavaScriptu, produkční sestavení a čtyři prohlížečové kontroly terénu. WebGL 2 i WebGPU vykreslily nízkou předvolbu bez atlasů a střední s barevnou a normálovou texturou.

## Kandidát s opravenými fasádami

Na revizi `2516ec7` se ve vysoké předvolbě na WebGL 2 podařilo spustit hru bez původní chyby při kreslení budov. Při zkoušce dne a noci v okně 400 × 280 bylo v poslední minutě 17 snímků při požadavku více než 30. Zkouška skončila u tohoto požadavku, závěrečnou kontrolu zpráv vykreslovače tedy neprovedla. Výsledek je v `data-raw/e26/vrstva-minuta.log`.

Všechny tři předepsané verze Node.js sestavily stejných 815 souborů jako webový ZIP. Na novém sestavení byla spuštěna úplná sada zkoušek na obou vykreslovačích. V předchozím běhu prošlo před přerušením 22 případů. Dlouhá jízda na herním kódu `19b459d` pokračuje ve druhém okruhu. Při prvním návratu po 51,35 km bylo 74 textur, 239 geometrií, 884 těles Joltu a žádný úlomek. [Archiv a otisky souborů](../E26.md#archiv-kandidáta-z-revize-2516ec7)

## Číslo materiálu fasády na WebGL 2

Při startu hry na WebGL 2 odmítl ovladač vykreslit část domů. U atributu `buildingLayer` shader očekával celé číslo, zatímco geometrie předávala bajt jako číslo s plovoucí řádovou čárkou. Geometrie nyní výslovně předává celočíselný atribut. Stěny a střechy si zachovávají původní čísla materiálů.

Na této větvi prošlo 182 testů JavaScriptu a produkční sestavení. Chromium 159 na střední předvolbě načetlo atlasy fasád a ověřilo materiál stěn i střech v herní scéně na WebGL 2 a WebGPU. Kontrola nově zachytí i odmítnutí příkazu vykreslení ve WebGL. Výsledky jsou v `data-raw/e26/vrstva-typ-e2e.log`.

## Shoda zdrojového archivu s označenou revizí

Při regresní zkoušce se lokálně změněná knihovna dostala do zdrojového ZIPu pod označením původního commitu. Nástroj nyní bere seznam souborů a oprávnění z určeného commitu. Při zápisu porovná skutečné bajty každého zdroje s otiskem jeho objektu v Gitu. Zkouška ověřila odmítnutí změněné knihovny jak před `git add`, tak po něm. Dosavadní výstup se při chybě zachová.

Při opakovaném zabalení čisté revize `be8a43b` vyšly oba ZIPy i manifest přesně stejné jako původní soubory. Prošlo 182 testů JavaScriptu, 27 testů Pythonu a produkční sestavení.

## Ověření archivu s opravou provozu

Webový ZIP z revize `be8a43b` obsahuje 815 souborů. Všech 1 371 položek zdrojového ZIPu odpovídá čisté pracovní kopii. Při použití stejných nainstalovaných závislostí daly Node.js 20.19.0, 22.12.0 i 24.22.1 ve všech souborech stejný výsledek jako zabalený web. Další kontrola rozbalila zdrojový ZIP do prázdné složky, na Node.js 24.22.1 nainstalovala závislosti pomocí `npm ci --offline` z místní mezipaměti a znovu sestavila všech 815 souborů se stejnými otisky. Audit zámku závislostí našel nula známých zranitelností. [Otisky a velikosti obou archivů](../E26.md#archiv-kandidáta-z-revize-be8a43b)

Na webu rozbaleném z tohoto ZIPu prošla také obnova uložené hry z E12 a z E25, její přehrání po nové odměně a objevu i návrat do původních verzí. E25 zachovala vzhled vozu a nastavení počasí. Obě zkoušky běžely v oddělených profilech prohlížeče.

Ve 400 × 280 prošel celý test výchozího WebGPU včetně kladného vzorku času GPU, ověření názvu vykreslovače a kontroly chyb a varování. Při načítání nyní test používá společnou kontrolu připravenosti hry. Výsledek je v `data-raw/e26/mensi-start.log`. Měření v původním rozlišení 960 × 600 zůstává otevřené.

## Čtvrtý okruh a kontrola památek

Na kandidátu `f6a1254` se vůz třikrát vrátil do Plzně. Ve čtvrtém okruhu po 154,56 km střídal pokusy o vyproštění. Po dokončení couvání dostal jediný krok fyziky na jízdu vpřed. Nástroj nyní začne čekací dobu počítat na konci couvání. V opakovaném sledu povelů měl řidič mezi pokusy 100 kroků vpřed. Na sestavení `19b459d` projel od místa dřívějšího zastavení 1 295,65 m bez dalšího couvání. Ověření spotřeby prostředků po čtvrtém návratu pokračuje. [Podmínky jízdy a výsledky](../E26.md)

Na WebGL 2 prošla kontrola blízkého a vzdáleného materiálu památky, střechy i uvolnění dlaždice. Zkouška čeká na obě příslušné dlaždice, aby její výsledek nezávisel na tom, zda se dříve načte novější uliční vybavení. Při samostatné minutové kontrole dne a noci na softwarovém WebGL 2 vzniklo za sledovanou minutu 11 snímků při požadavku více než 30. Výchozí WebGPU hru spustilo a zobrazilo v menu správný název vykreslovače. V okně 960 × 600 během desetiminutového limitu panel nezaznamenal vzorek času GPU. Při opakovaném spuštění v okně 400 × 280 vrátil stejný adaptér po pěti snímcích jeden vzorek, 8 342,91 ms. Minutová zkouška a původní rozlišení zůstávají otevřené. Prošlo všech 182 testů JavaScriptu a 27 testů Pythonu. Nové produkční sestavení se ve všech 815 souborech shoduje se sestavením použité hry. Nad herním kódem `19b459d` byla zahájena nová sada 358 prohlížečových zkoušek.

## Průjezd křižovatkou z E21

Větev vydání přebírá opravu `7d9471b`. Při změně směru zelené řidič počká, až záď vozu z předchozí fáze uvolní křižovatku. Při dlouhém stání MHD u výjezdu může zvolit volnou povolenou odbočku. Na větvi E21 prošla po této změně dvě desetiminutová pozorování. Nejdelší stání na Klatovské třídě bylo 118 s a u hlavního nádraží 56,5 s. Obě měření zachovala hranici pod 120 s i kontrolu jízdy po vozovce.

Na sestavení E26 se změnou prošlo 182 jednotkových testů, produkční sestavení a dva případy na WebGL 2. Jeden ověřil přednost při levém odbočení, druhý vyčkání a volbu odbočky u stojící MHD. Časový limit pozorovacího testu může běžec pro pomalý adaptér prodloužit, doba simulace i podmínky přijetí zůstávají stejné. Výsledky jsou v `data-raw/e26/kolona-sokl-e2e.log`.

## Podmínky materiálu u výloh na Americké

Při spuštění kandidáta `f6a1254` hlásil WebGL 2 čtyři návraty hodnot z podmínek uvnitř shaderu. Úprava z E25 mění barvu soklu a římsy přímo uvnitř podmínek. V obou vykreslovačích prošla stejná kontrola u Wilsonova mostu. Změřená stěna měla přiřazený materiál přízemí i vstup a kompilace proběhla bez varování TSL. Na tomto sestavení prošlo 181 jednotkových testů a produkční sestavení. Výsledky jsou v `data-raw/e26/sokl-e2e.log`. Výkon při minutové zkoušce dne a noci se měří samostatně.

## Uložená hra a panel měření

Chromium 159 načetlo z E12 do archivovaného kandidáta `f6a1254` koupený vůz, brzdy, pneumatiky, sedm rozvozů a objevené místo. V kandidátovi přibylo 120 Kč a druhé místo. Po novém načtení i návratu do E12 zůstalo 4 085 Kč a oba objevy. U přenosu z E25 se v kandidátovi shodovaly také špína, poškození a nastavení počasí. První návrat do E25 vyčerpal pětiminutový limit načtení stránky. Při opakování celého postupu prošel i návrat. E25 načetla novou odměnu, druhý objev, špínu 0,5, poškození levých dveří 0,4 a jasné počasí. [Protokol návratu k archivovaným verzím](../E26.md)

Při kontrole panelu F9 hra po nástupu zapojí řidičovo auto do fyziky v dalším kroku simulace. Zkouška nyní tento krok provede a zkontroluje spojení auta s řidičem ještě před otevřením panelu. Na softwarovém WebGPU prošlo zobrazení času fyziky, počtu těles, otáček, stupně a prokluzu kol. Prošlo také 181 jednotkových testů JavaScriptu a produkční sestavení.

Při zkouškách hodin a návratu ke garáži se po načtení stránky čeká na signál připravenosti hry. Dva případy ve WebGL 2 ověřily přechod přes půlnoc, odjezdy spojů, převod času v Plzni a uchování nastavení po načtení. Na WebGPU prošla na sestavení `f6a1254` zkouška Krkavce, pokuty a nákupu u garáže s nízkým zůstatkem.

V hlavní části prohlížečových zkoušek WebGL 2 prošlo 40 případů. Jejich výsledky jsou uložené. Zbývajících 128 případů má vlastní seznam pro pokračování po uvolnění paměti. WebGPU a dlouhá jízda se vyhodnocují samostatně.

## Čtrnáct kontrol vzhledu kandidáta

V Chromiu 159 prošlo všech sedm zkoušek materiálů na WebGPU a stejných sedm na WebGL 2 nad produkčním sestavením `f6a1254`. Kontroly porovnaly denní a noční oblohu, okna, vodu a lampy u náhonu, světlomety auta, hladinu pod Wilsonovým mostem, portály Valíku a dlažbu náměstí. Při porovnání s předlohami byla hra nastavena na jasné počasí. U řeky test podle G13 měří zvlášť světlou mělčinu a tmavší střed toku. Na obou místech vyžaduje převahu modré. WebGPU čte barvy z dokončeného snímku ve výstupní textuře.

## Kontrola vstupu do archivované hry

Balicí nástroj ověřuje v hotovém ZIPu místní skripty a styly odkazované z úvodní stránky. Zkouška odmítla balík s chybějícím JavaScriptem, s chybějícím CSS i s cestou od kořene serveru, která by se při nasazení z podsložky otevřela mimo hru. Prošlo 181 testů JavaScriptu, 27 testů Pythonu a produkční sestavení. U kandidáta `f6a1254` souhlasí s manifestem všech 815 webových a 1 371 zdrojových položek. Dlouhá jízda stejného kandidáta dokončila druhý okruh po celkových 102,62 km. Při návratu bylo načteno 75 textur, 239 geometrií, 886 fyzikálních těles a žádný úlomek. Porovnání třetího a čtvrtého okruhu pokračuje. [Archivy kandidáta](../E26.md)

## Pozdní načtení textur interiérů

Na WebGPU i WebGL 2 prošly obě zkoušky pomalé sítě. Hra se spustila i při neodpovídajících katalozích a barevné tabulce. Při samostatném pokusu s minimálně třináctisekundovým zpožděním se atlas interiérů po spuštění doplnil a obsah okna reagoval na pohyb kamery. Prošlo všech 181 testů JavaScriptu a 27 testů Pythonu. Node.js 20.19.0, 22.12.0 a 24.22.1 sestavily shodných 815 souborů. Na tomto sestavení vůz dokončil první návrat po 51,32 km. V té chvíli bylo načteno 73 textur, 239 geometrií, 884 fyzikálních těles a žádný úlomek. Porovnání třetího a čtvrtého návratu a úplná prohlížečová sada pokračují.

## Ověřené archivy 0.2.0

Ve složce `data-raw/e26/vydani-34458c8/` jsou webový a zdrojový ZIP revize `34458c8` a manifest. Všech 815 webových a 1 371 zdrojových položek souhlasí s manifestem. Sestavení z rozbalených zdrojů dalo stejných 815 souborů. Na WebGPU i WebGL 2 prošlo všech šest cílených zkoušek k nálezům kontroly. Zbývající případy běží nad stejným produkčním webem. [Otisky archivů a způsob sestavení](../E26.md)

## Výsledky závěrečné kontroly Astrou

Astra prošla zadání E13–E25 a našla dva problémy, které blokovaly ovládání nebo start, a jednu chybu diagnostiky. Opravy obnovily návrat z mapy po stisku O, spuštění s neodpovídajícími katalogy a měření času GPU na podporované záložní WebGL 2. Z rozbaleného webového ZIPu prošlo načtení a návrat do E12 i E25. Úplná sada má 356 prohlížečových případů, výsledky opakované jízdy a měření na autorových zařízeních jsou otevřené. [Jednotlivé nálezy, ověření a otisk webu](../E26.md)

## První návrat po opravě nájezdu

Na kandidátu `34458c8` dojel zkušební vůz z centra přes Rokycany a Dobřív zpět do Plzně po 51,27 km a 6 088,83 sekundách simulace. Největší pokles pod jízdní povrch byl 0,235 m. Po dokončení vykreslení měl první návrat 72 textur, 229 geometrií, 886 těles Joltu a žádný úlomek. Druhý okruh skončil po celkových 100,47 km odchylkou od trasy při stavu vozu 2,73 ze 100. Další zkouška sleduje stav vozu po celou jízdu a před křižovatkami zpomaluje. Po opravě měření skutečného postupu při návratu z couvání vůz dokončil kontrolní úsek 11,23 km se stavem 94,04 ze 100. Při ukončení předchozího testu po 8,68 km vůz normálně postupoval, ale pořadí bodu zůstávalo stejné. Prošlo 180 testů JavaScriptu, 27 testů Pythonu a produkční sestavení. Pro posouzení růstu prostředků se porovnává až třetí a čtvrtý návrat.

## Jízdní povrch při návratu do Plzně

Na trase centrum–Rokycany–Dobřív–centrum se po 45,62 km projevil nespojitý nájezd na horní vozovku. Opravený spoj používají vykreslení i kolize Joltu. Běžný průjezd přes místo a okolí v délce 1,195 km skončil bez vyprošťování s největším poklesem 0,109 m. Prošlo 180 testů JavaScriptu, 27 testů Pythonu a produkční sestavení. Všechny tři podporované verze Node.js daly stejných 815 souborů. Pokračuje zkouška čtyř okruhů. [Jízda a porovnání před opravou](../E26.md)

## Shoda manifestu s obsahem archivů

Nástroj pro vydání zapisuje do manifestu otisky přesně těch dat, která prošla do obou ZIPů. Regresní zkouška změnila dlaždici mezi zabalením webu a zdrojů a ověřila odmítnutí neúplného vydání. Nezávislé čtení obou ZIPů kandidáta ověřilo 815 položek webu a 1 371 položek zdrojů. [Balení a uložení hry](../E26.md)

## Uložené hry na rozbaleném webu 0.2.0

Chromium 159 na stejné adrese ověřilo přechod z vydání E12 i z posledního sestavení E25 do rozbaleného webového ZIPu a zpět. Po návratu obě starší verze načetly 4 085 Kč, dva objevy, sedm doručení a hatchback s upravenými brzdami a pneumatikami. E25 načetla také znečištění 0,5, poškození levých dveří 0,4 a jasné počasí. [Otisk webového ZIPu a postup obnovy](../E26.md)

## Kandidát se vstupy ve výšce chodníku

Po opravě E25 se mezi 785 chráněnými soubory změnily tři uliční úseky a jejich katalog. Produkční web měl na Node.js 20.19.0, 22.12.0 a 24.22.1 všech 815 souborů shodných po bajtech. Prošlo 179 testů JavaScriptu a 27 testů Pythonu. Při rozbalení webového ZIPu prošlo porovnání každého souboru s tímto sestavením. Úplná prohlížečová sada začala na produkčním náhledu a obsahuje 352 případů včetně fiktivní zkušebny vybavení na obou vykreslovačích. Dlouhá jízda, výsledky celé sady a měření na cílových zařízeních jsou otevřené. [Protokol E26](../E26.md)

## Referenční kamery E13 a E26

Na produkčním webu kandidáta `34458c8` vzniklo osm snímků ze stejných kamer a časů jako v E13. Ve hře byla nastavená volba **Vždy jasno**. Chromium 159 na WebGPU uložilo všechny pohledy v rozlišení 1 280 × 720 do 250 kB na snímek. Kontrola dvojic ověřila záběry a čitelnost scény ve dne i v noci. Nástroj ukládá přímo dokončený obraz a vypisuje počty volání a trojúhelníků. Prošlo 180 testů JavaScriptu, 27 testů Pythonu a produkční sestavení. [Snímky a příkaz pro zopakování](../E26.md)

## První návrat z Dobříva

Řidič zkušební jízdy po opravě zpátečky dokončil první okruh 59,59 km a ve druhém projel přes místo předchozího zastavení. První návrat v Chromiu vykázal 72 textur, 223 geometrií, 886 těles a nula úlomků. Projelo se 6 103,73 simulované sekundy skutečným řízením auta v Joltu. Opakování a srovnání zásob ve třetím a čtvrtém okruhu pokračují. [Podmínky a měření](../E26.md)

## Verze v menu a sestavení na třech verzích Node.js

Kandidát 0.2.0 zobrazuje verzi v nabídce O hře a popisuje fotorežim a diagnostiku v ovládání. Na WebGPU prošla jízda tramvají, uložení a obnovení postupu i kontrola obou nabídek. Na Node.js 20.19.0, 22.12.0 a 24.22.1 vzniklo 815 shodných souborů. Prošlo 178 testů JavaScriptu a 27 testů Pythonu. Úplná sada pro oba vykreslovače obsahuje 350 scénářů. Výsledky jednotlivých jízd a zbývajících prohlížečových zkoušek se doplňují.

## Sestavení z archivu po přidání vstupů

S údaji o vstupech z E25 se změnily otisky tří úseků a jejich společného katalogu. Generátor vydání dal po opakování totožný manifest. Prošlo 178 testů JavaScriptu, 27 testů Pythonu a produkční sestavení. Z předběžného zdrojového ZIPu se podařilo pomocí místní mezipaměti npm sestavit celý web znovu. Všech 815 souborů má stejný SHA-256 jako v předběžném webovém ZIPu. Návrat k nádraží po pozdrženém požadavku a odjezdu prošel na WebGL 2 i WebGPU. Konečné archivy a celkový výsledek zkoušek zůstávají otevřené. [Protokol E26](../E26.md)

## Otisky vydání a obnova z E25

Manifest obsahuje 785 souborů a chrání také seznam střech používaný fyzikou. Na WebGL 2 i WebGPU prošla zkouška chybějící textury a pozměněné tabulky barev. V obou vykreslovačích vzniklo hratelné původní město i při současné chybě 404 čtyř katalogů nebo po přidání jediného bajtu do každého z nich. Prošlo všech 176 testů JavaScriptu, 27 testů Pythonu a produkční sestavení. Samostatné porovnání kandidáta na třech verzích Node.js je v protokolu.

Chromium ověřilo skutečné uložení z E25, načtení a pokračování v E26 i návrat do E25. Při všech načteních zůstalo na hatchbacku poškození levých dveří 0,4 a špína 0,5. Zachovalo se i jasné počasí, dvě zakoupená vylepšení, zakázky, peníze a objevy. Pokračuje zkouška pomalého načítání, dlouhá jízda a skládání konečného vydání. [Výsledky a postup návratu](../E26.md)

### Opakovatelnost archivů

Zdrojový ZIP přebírá spustitelnost souborů z Gitu a webový ZIP používá běžná práva pro čtení. Kontrolní součty tak odpovídají po změně místních přístupových práv. Zkouška navíc ověřila zachování spouštěcího skriptu pro macOS a odmítnutí archivu, ve kterém chybí sledovaný soubor. Prošlo 27 testů Pythonu, na stejném herním kódu 176 testů JavaScriptu a produkční sestavení.

## Řízení vozidel a návrat uložené hry

Jolt nyní řídí hráčův vůz a vrtulník při každém spuštění. Lehký výpočet pohybu aut ve vzdáleném provozu má stále aktivní volající a zůstává zachován. Při zkoušce letu se po odebrání starého řízení projevil chybějící odkaz vrtulníku na svět. Po jeho obnovení prošlo vynuceným WebGL 2 přistání na střeše a vystoupení z vozidla na mostě i v tunelu. Na softwarovém WebGPU dokončil skutečný vůz opraveného sestavení prvních 20 simulovaných minut průjezdu. Další okruhy pokračují.

Na stejné adrese prošel přenos uložené hry z E12 do novějšího sestavení, druhé načtení a návrat do E12 se stejným výsledkem. Podrobnosti o penězích, autě, úpravách a objevech uvádí protokol. Na první revizi katalogů prošlo 172 testů JavaScriptu, 27 testů Pythonu a produkční sestavení. Při simulovaném výpadku katalogu města se ukázala závislost na seznamu čtvrtí a měřených střech. Oprava a závěrečná regresní sada se ověřují samostatně. [Protokol E26](../E26.md)

## Příprava archivu

Nástroj přijímá označení vydání přes `--version`. Před vytvořením ZIPů zkontroluje shodu distribuovaných dat se sestavením. Zdrojový archiv zahrnuje také místní závislost `vendor/picomatch`. Manifest uvádí otisky všech zdrojů, webových souborů a obou archivů. Nové vydání se zveřejní najednou v samostatné složce. Při opakování se zachová totožný výsledek i starší vydání.

Na malém zkušebním repozitáři prošlo dvojí zabalení, porovnání obou archivů s manifestem a odmítnutí zápisu jiné verze do stejné složky. Prošlo 166 testů JavaScriptu, 27 testů Pythonu a produkční sestavení. Finální ZIPy počkají na úplný obsah E25 a zkoušky vydání.

# Stav etapy E25

## Zrnitost povrchu v dálce

U vzdálených povrchů nyní shader přeskočí výpočet jemné nebo střední zrnitosti v místech, kde by její váha byla nulová. Výpočet šířky pixelu zůstává mimo obě podmínky, aby měl stejnou hodnotu i na jejich hranicích.

Časy stejné úpravy na větvi E24 jsou v jejím protokolu. Zde šlo o funkční zkoušky.

Na E25 prošlo 176 testů JavaScriptu, produkční sestavení a čtyři prohlížečové kontroly terénu. WebGL 2 i WebGPU vykreslily nízkou předvolbu bez atlasů a střední s barevnou a normálovou texturou.

## Číslo materiálu fasády na WebGL 2

Při startu hry na WebGL 2 odmítl ovladač vykreslit část domů. U atributu `buildingLayer` shader očekával celé číslo, zatímco geometrie předávala bajt jako číslo s plovoucí řádovou čárkou. Geometrie nyní výslovně předává celočíselný atribut. Stěny a střechy si zachovávají původní čísla materiálů.

Na této větvi prošlo 176 testů JavaScriptu a produkční sestavení. Chromium 159 na střední předvolbě načetlo atlasy fasád a ověřilo materiál stěn i střech v herní scéně na WebGL 2 a WebGPU. Kontrola nově zachytí i odmítnutí příkazu vykreslení ve WebGL. Výsledky jsou v `data-raw/e25/vrstva-typ-e2e.log`.

## Vykreslení soklu a římsy

V materiálu přízemí dvě podmínky vracely změněnou barvu do překladače shaderů Three.js. Po spuštění hry na WebGL 2 hlásil čtyři varování. Podmínky teď přímo upraví barvu soklu a římsy. Kontrola u Wilsonova mostu sleduje i hlášení překladače TSL.

V Chromiu 159 se na WebGL 2 i WebGPU vykreslila fasáda na Americké se změřenými stěnami a vyznačeným vstupem, bez chyby shaderu či varování TSL. Prošlo 176 jednotkových testů a produkční sestavení. První pokus s WebGPU v prostředí nastaveném pro softwarové OpenGL skončil ještě při spuštění vykreslovače. Samostatný běh s adaptérem SwiftShader prošel. Výstupy jsou v `data-raw/e25/sokl-e2e.log` a `data-raw/e25/sokl-webgpu.log`.

## Výška vstupů nad chodníkem

První snímky ukázaly nízká okna a zčásti zapuštěné dveře. U všech 21 vstupů ležel spodek měřené stěny 1,05 až 3,14 m pod chodníkem. Převod teď odvozuje výšku prahu z herního terénu v místě dveří. Otisky stěn, počet vrcholů a jejich poloha zůstávají platné. Kontrola našla všech 21 vstupů v distribuovaných dlaždicích a ověřila polohu prahu s tolerancí 4 cm. Prošlo 176 testů JavaScriptu, 26 testů Pythonu a produkční sestavení. Na opraveném vysokém WebGPU je při pohledu z Americké vidět celý vstup až k chodníku. Všech šest snímků je v protokolu včetně počtu trojúhelníků, vykreslovacích volání a mediánu z pěti snímků v každém pohledu. Na WebGL 2 i WebGPU v Chromiu prošlo vykreslení jediné přízemní vrstvy v pilotu po opravě prahů. Fotografická shoda podle autorových předloh zůstává otevřená. [Protokol E25](../E25.md)

## Vymezení pilotu

Americká mezi západním koncem Wilsonova mostu a kruhovou křižovatkou zahrnuje obě strany ulice i nároží u nábřeží. Ze všech 205 452 ploch městského archivu 2024 se podařilo určit 26 stěn osmi budov pro fotografické porovnání. Výběr vychází z průsečíků s paprsky z osy ulice a z předmostí v úrovni parteru. Všechny konce hran leží ve vymezeném obrysu a otisky ploch jsou jedinečné. Zbývá fotograficky ověřit podobu a členění provozoven i vybavení. [Návod k focení a soupis](../E25/navod-foceni.md)

## Převod a načítání pilotu

Všech 26 ploch našlo protějšek ve skutečně distribuované dlaždici. Převod kontroluje zdroj městského měření, otisk a rozměry jednotlivých stěn. Hra ověřuje verzi městského modelu a stavebních konstrukcí a otisk staženého úseku i příslušné dlaždice. Vybrané přízemí získá vlastní materiál až při přiblížení. Ostatní průčelí a vyšší patra zachovávají původní okna. Členění přízemí je zatím neutrální kresba k ověření podle fotografií.

Prošlo 168 testů JavaScriptu, 26 testů Pythonu a produkční sestavení. Ve WebGL 2 i WebGPU se po přesunu do pilotu načetl samostatný balík a vykreslil se správný materiál. Při změně otisku zůstalo při jednotkové zkoušce původní průčelí. Opakovaný převod dal stejných 3,1 kB dat pilotu.

## Vybavení, dlažba a tři úseky

Ve čtyřech městských dlaždicích se podařilo přiřadit všech 66 vymezených stěn. Patnáct jednotlivých prvků vybavení a jeden zastávkový přístřešek prošly kontrolou odstupů od komunikací, dveří vozidel MHD a cílů zakázek. Sklo a konstrukce se zobrazují a reagují na herní fyziku samostatně. Při jednotkové zkoušce na fiktivním místě zůstal po rozbití skla celý rám, po návratu přetrval poškozený stav a po ranní opravě se výplň obnovila.

Prošlo 173 testů JavaScriptu, 26 testů Pythonu a produkční sestavení. Ve všech šesti prohlížečových zkouškách prošel pilot a chůze ve třech úsecích na nízké i vysoké předvolbě za dne, soumraku a noci ve WebGL 2 i WebGPU. Zbývají samostatné zkoušky nástupu u nádraží, doručení na místní adresy a snímky před a po. Věrnost přízemí a přístřešku vyžaduje fotografie autora. [Protokol úseků](../E25.md)

## Průchod ulicemi a zkušebna vybavení

Se vstupy prošlo všech šest prohlížečových zkoušek pilotu a chůze třemi úseky. Na vysoké i nízké předvolbě se hráč pohyboval při 10:00, 18:09 a 22:00 ve WebGL 2 i WebGPU. Na oddělené fiktivní ploše v Joltu projel herní vůz vlastní lavičkou a skleněnou výplní zkušebního přístřešku. Stojky i střecha zůstaly celé. Stav přetrval po odpojení a opětovném připojení vybavení, v ranním termínu se vše opravilo. Oba vykreslovače prošly. Probíhá závěrečné snímkování a měření tří úseků. Porovnání se skutečnými průčelími čeká na fotografie autora.

## Vstupy z ulice

U 21 průčelí dostaly výlohy samostatné prosklené dveře. V popisu je poloha středu v metrech podél konkrétní měřené zdi. Osm vstupů připadá na Americkou, devět na Dřevěnou a čtyři na nádraží. Polohy jsou předběžné do porovnání s autorovými fotografiemi. Na nízké předvolbě má lavička a koš méně ploch, kolizní tvar zůstává společný pro všechny předvolby. Přidání vybavení vyvolá jedinou aktualizaci kolizí příslušné dlaždice.

Prošlo 175 testů JavaScriptu, 26 testů Pythonu a produkční sestavení. WebGL 2 na střední předvolbě ověřilo, že se samostatné dveře v pilotu dostanou až do geometrie vykresleného průčelí. Probíhá kontrola zbývajících pohledů a samostatné fiktivní zkušebny.

## Rozvoz a nastoupení u nádraží

V Chromiu na WebGL 2 i WebGPU prošel rozvoz na adresy ve všech třech úsecích. Na posledních metrech šel hráč pěšky a po doručení dostal odměnu. U hlavního nádraží byla před nástupem načtená nová uliční vrstva. Hráč nastoupil do linky 49, dojel do Pařížské a vystoupil. Všechny čtyři scénáře prošly. Produkční sestavení, 175 jednotkových testů a 26 testů Pythonu prošlo i s připravovanou úpravou vstupů.

# Stav etapy E24

## Zrnitost povrchu v dálce

U vzdálených povrchů nyní shader přeskočí výpočet jemné nebo střední zrnitosti v místech, kde by její váha byla nulová. Výpočet šířky pixelu zůstává mimo obě podmínky, aby měl stejnou hodnotu i na jejich hranicích.

Na softwarovém WebGPU splnila nízká předvolba limit zpomalení vůči E23 v obou měřených pohledech. U Wilsonova mostu byl medián času snímku do dokončení o 3,8 % kratší, na nočním náměstí o 1,0 % delší. Měření vysoké předvolby v dešti na autorově počítači a ovládání na skutečném telefonu zůstávají otevřené. [Výsledky obou porovnání](../E24.md#zrnitost-povrchu-v-dálce)

Na E24 prošlo 166 testů JavaScriptu, produkční sestavení a čtyři prohlížečové kontroly terénu. WebGL 2 i WebGPU vykreslily nízkou předvolbu bez atlasů a střední s barevnou a normálovou texturou.

## Číslo materiálu fasády na WebGL 2

Při startu hry na WebGL 2 odmítl ovladač vykreslit část domů. U atributu `buildingLayer` shader očekával celé číslo, zatímco geometrie předávala bajt jako číslo s plovoucí řádovou čárkou. Geometrie nyní výslovně předává celočíselný atribut. Stěny a střechy si zachovávají původní čísla materiálů.

Na této větvi prošlo 166 testů JavaScriptu a produkční sestavení. Chromium 159 na střední předvolbě načetlo atlasy fasád a ověřilo materiál stěn i střech v herní scéně na WebGL 2 a WebGPU. Kontrola nově zachytí i odmítnutí příkazu vykreslení ve WebGL. Výsledky jsou v `data-raw/e24/vrstva-typ-e2e.log`.

## Klávesové ovládání mapy a fotorežimu

Po stisku O v mapě lze pokračovat klávesou Escape a ze hry pak znovu otevřít fotorežim. Celou posloupnost ověřilo Chromium 159 na WebGL 2 i WebGPU. Prošlo 166 testů JavaScriptu a produkční sestavení. [Protokol E24](../E24.md)

E24 navazuje na G17 ve větvi E23 (`fe30ef0`). [Zadání E24](E24.md)

## Výsledek měření E24

G18–G27 jsou implementovány. Po úpravách v revizi `910314b` prošlo 166 testů JavaScriptu, produkční sestavení a funkční kontroly obou vykreslovačů. Při porovnání nízké předvolby na jednom vyhrazeném jádře byl měřený pohled na noční náměstí o 7,0 % pomalejší než E23. Na Wilsonově mostu činil rozdíl 14,6 %, nad požadovanou mezí 10 %. Výsledek z autorova grafického zařízení, výkon vysoké předvolby v dešti a ovládání na skutečném telefonu zůstávají otevřené. Další místní ověření probíhá v souhrnné sadě vydání E26. [Měření, snímky a postup kontroly](../E24.md)

## Vypnutí počasí a práce vykreslovače

Při volbě **Vždy jasno** se i na vysoké a ultra předvolbě vrací původní obloha z E23. Výpočet objemové vrstvy stojí a krajinu nestíní její maska. Po návratu k proměnlivému počasí se první snímek vytvoří bez zastaralé historie. Za sucha materiály přeskočí výpočet sněhové pokrývky. Pod horizontem se vynechá výpočet procedurálních mraků, kde mají nulové krytí. Noční osvětlení používá společný zdroj pozic lamp z E21.

Na obou vykreslovačích prošla kontrola zastavení a obnovení objemové vrstvy, deště a sněhu i porovnání obrazu kolem městské zástavby na nízké předvolbě. Po převzetí E21 prošlo 166 testů JavaScriptu a produkční sestavení. Výkon softwarového adaptéru měří samostatná série. [Ověření E24](../E24.md)

## Průhlednost objemových oblaků

Ve vysoké předvolbě se u nádraží objevila černá obloha. Na stejném místě po opravě zmizely černé plochy a mezi oblaky je vidět modrá obloha. Oprava zachovává krytí vypočtené pro každý paprsek i při přebírání předchozího snímku. WebGL 2 i WebGPU našly částečně průhledné vzorky mezi oblaky a ověřily nulové krytí při pohledu přímo dolů. Prošlo 166 jednotkových testů JavaScriptu a produkční sestavení. [Porovnání obrazu](../E24.md)

Snímky náměstí v protokolu nyní pocházejí z opraveného vykreslování. V dešti v 18:09 zůstaly viditelné večerní osvětlení a srážky, v lednovém sněhu se pokryly střechy i dlažba náměstí. Obě scény mají shodnou kameru.

## G18 a G20 · Fasády a střechy

Na střední až ultra předvolbě se sedm fotografických fasád řídí typem budovy a paletou čtvrti. Okna, sokl a ostění sdílejí souřadnice. Pět střešních vrstev rozlišuje tašky, plech, měď, lepenku a vláknocement. Měděná patina na katedrále začíná až na věži. Převod spároval materiálové údaje OSM s 138 budovami projektu. Ostatní plochy používají výběr podle stylu a barvy.

U 21 fotografických podkladů CC0 prošla kontrola velikosti a zdrojového otisku. Oba převody vytvořily shodné atlasy. Prošlo 161 testů JavaScriptu, 25 testů Pythonu a produkční sestavení. WebGL 2 i WebGPU načetly atlasy a vykreslily měřené i běžné budovy.

## G19 · Místnosti za okny

Osm vlastních variant bytu, kanceláře, obchodu a schodiště má v atlasu po pěti stěnách. Při chůzi kolem budovy se podle směru pohledu odkrývá jiná část místnosti. Závěsy a žaluzie si každé okno drží na místě a večer se rozsvěcí podle rozvrhu E23. Nízká předvolba si ponechává původní okna.

Prošlo 161 testů JavaScriptu, 26 testů Pythonu a produkční sestavení. Kontrola porovnala všech 40 dlaždic s generátorem. WebGL 2 i WebGPU zaznamenaly změnu barev za stejným oknem po načtení atlasu a další změnu po posunu kamery.

## G21 · Lak, špína a světla aut

Na střední až ultra předvolbě má lak průhlednou vrchní vrstvu. Na spodní části karoserie přibývá špína podle ujetých metrů mimo asfalt. Promáčknutí zanechá stopu na konkrétním panelu daného vozu. Uložení a garáž zachovají špínu i po načtení. Brzdová světla čtou brzdu z fyziky, couvací reagují na směr jízdy a provoz má směrovky podle plánovaného odbočení. Dva světlomety hráče sledují natočení karoserie. Klávesa L přepíná v noci dálková světla.

Prošlo 162 testů JavaScriptu a produkční sestavení. WebGPU odhalilo nepodporovaný jednokanálový osmibitový atribut. Po opravě formátu prošly dotčené jednotkové testy a v Chromiu na WebGL 2 i WebGPU prošla kontrola dvou kuželů, rozteče světel a změny jejich dosahu.

## G22 · MHD a postavy

Karoserie tramvají, autobusů a trolejbusů rozlišují lak, sklo, kov a gumu. V noci se rozsvěcují boční okna včetně siluet sedadel a zůstávají čitelné linkové cedule. Chodci mají čtyři střihy oděvu v různých barvách. Jedenáct kostí ovládá chůzi a stejné díly s totožným oblečením používá i pád postavy. Dvě postavy mohou sdílet geometrii a přitom udělat krok každá jinou nohou.

Prošlo 163 testů JavaScriptu a produkční sestavení. WebGL 2 i WebGPU vykreslily noční soupravu a postavu s jedenácti kostmi. Kontrola porovnala označení kostí, geometrii a samostatný pohyb dvou postav.

## G23 · Počasí a přilnavost

Před implementací prošel návrh kontrolou Astra High. Sedm typů počasí vychází z deterministické volby podle data, měsíčních herních vah a teploty. Přechod trvá 10 až 30 herních minut. Z předchozích srážek se při obnově hry i při přeskočení času odvodí vlhkost a sněhová pokrývka. Nastavení „Vždy jasno“ vrací suchý povrch. Volba se ukládá i ve stávajícím formátu pozice.

Na úplně mokrém povrchu klesá přilnavost na 70 % suché hodnoty a na souvislém sněhu na 35 %. Hráč i fyzicky řízená auta čtou stejný dotaz, vzdálený provoz sníží cílovou rychlost a původní jízdní režim upraví brzdění a boční přilnavost. Na stejné fiktivní rovné dráze z 16 m/s potřeboval vůz v dešti delší dráhu než za sucha a na sněhu delší než v dešti.

Prošlo 166 testů JavaScriptu a produkční sestavení. Oba vykreslovače ověřily lednový povrch, změnu počasí v nastavení i obnovení této volby po načtení.

### Déšť, sníh a mlha

Déšť i sníh se vykreslují na GPU v jednom poli kolem kamery. Tunel částice skryje a utlumí déšť. Jeho zvuk se řídí intenzitou srážek, vypnutím zvuku i pozastavením hry. Země za mokra tmavne a vlhne i mimo původní dvě ukázková místa. Sníh zůstává hlavně na vodorovných plochách terénu, střech a korun, u silnic prosvítají stopy jízdních pruhů. Mlha mění dohled a podle výšky se rozptyluje.

Produkční sestavení a všech 12 cílených jednotkových testů prošlo. WebGL 2 i WebGPU vykreslily náměstí za deště v 18:09 a lednové vločky. Test ověřil vodu, sníh, opakované využití stejného bufferu i skrytí částic po nastavení jasného počasí.

## G24 · Objemová oblaka

Na vysoké předvolbě a na ultra prochází každý paprsek deseti vzorky vrstvy oblaků. Její hustota se řídí počasím. Obraz má čtvrtinovou šířku i výšku a při pohybu kamery přebírá předchozí vzorek podle jeho původní projekce. Velký přesun, změna data i velikosti obrazu historii zahodí. Stejný široký vzor oblačnosti tlumí sluneční světlo na krajině. Na střední a nízké předvolbě zůstává původní výpočet oblohy.

Produkční sestavení prošlo. WebGPU i WebGL 2 načetly skutečně vykreslené pixely z cílové textury, ověřily rozměry vůči plátnu, střídání obou textur, opětovné použití při malém pohybu i reset po přesunu o sto metrů.

## G25–G27 · Slunce, fotorežim a pohybové rozmazání

Na ultra procházejí sluneční paprsky stínem vzdálené sluneční kaskády. Odlesk objektivu a pohybové rozmazání mají vlastní přepínače. Rozmazání čte vektory pohybu z časového vyhlazování a ve výchozím nastavení je vypnuté. Fotorežim se otevírá klávesou O nebo z menu, zastaví čas a skryje herní ukazatele. Volná kamera má dosah 100 m, nastavitelnou vzdálenost zaostření a ukládá snímky PNG.

Prošlo 166 testů JavaScriptu, 26 testů Pythonu a produkční sestavení. Ve WebGL 2 i WebGPU prošly čtyři prohlížečové zkoušky. Ověřily zastavení času, návrat kamery, stažení souboru PNG a zapojení paprsků, odlesku i pohybových vektorů na ultra.

## Snímky a měření

Stejná kamera zachytila déšť i sníh na vysoké předvolbě. Ve čtyřech předvolbách prošel rozpočet ve třech referenčních pohledech. Na softwarovém adaptéru jsme zaznamenali také pět snímků za deště i sněhu v každé předvolbě. První postupné srovnání suché scény E23 a E24 ukázalo delší čas vykreslení při souběžných testech. Při prvním střídavém měření byl Wilsonův most o 1 % rychlejší, náměstí o 15 % pomalejší v čase do dokončení snímku. Nízká předvolba nyní kreslí oblohu až za neprůhledné povrchy. V obou vykreslovačích prošlo porovnání obrazu starého a nového pořadí. [Protokol a snímky](../E24.md)

## Výchozí etapa E23

E23 vychází z dokončené větve E22 (`496a72d`). Prvním krokem je detail země při chůzi. Další pořadí tvoří povrchy silnic, voda, stromy, tráva, noční světla a částice. [Zadání E23](E23.md) · [Protokol E22](../E22.md)

Dodatečně doběhla úplná sada Full HD na softwarovém WebGPU. Pro každý profil uvádí protokol skutečný počet snímků i čas CPU. V tak malé sadě vzorků zůstává plynulost jízdy a letu na autorově zařízení otevřená. [Naměřené hodnoty](../E23.md#pokus-ve-full-hd-při-jízdě-a-letu)

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

## Uzavření E23

G11 až G17 jsou implementované a prošly funkčními zkouškami. Závěrečné sestavení prošlo se 160 testy JavaScriptu a 25 testy Pythonu. Ve WebGPU prošly všechny čtyři předvolby ve třech referenčních pohledech při 1280 × 720. Nízká předvolba na náměstí má ověřený přírůstek deseti volání za měřené konstrukce E22. Protokol obsahuje kontrolní měření s těmito konstrukcemi i bez nich, osm měření ze dvou pevných kamer a snímky ze hry. Na cílovém zařízení zbývá ověřit 60 FPS při jízdě a letu. [Protokol E23](../E23.md)

## Výchozí etapa E22

Ve větvi `etapa/E22` jsou převedené městské objekty, ověřený Wilsonův most i tři dávky zdí a pilířů. Hra používá další dvě lávky, silniční desku, dvě železniční mostovky a čtyři díly jezů. Vývoj a dostupné přejímací kontroly E22 jsou dokončené. Zůstává porovnání s autorovými fotografiemi a změření plynulosti na jeho zařízení. [Protokol E22](../E22.md). [Zadání E22](E22.md) · [Výsledky převodu a pilotu](#e22--převod-a-inventura)

## Výchozí etapa E21

Větev `etapa/E21` navazuje na E20 sloučenou revizí `623e081`. [Zadání E21](E21.md) · [Protokol předchozí etapy](../E20.md)

## Minuta dne a noci po ověření ranní špičky

Chromium 159 na softwarovém WebGL 2 v okně 400 × 280 na herním kódu `7d9471b` zaznamenalo 21 snímků během minuty. Mez je více než 30. V prostředí současně běžely zkoušky E26. Výsledek je v `data-raw/e21/minuta-po-kolone.log`. Při opakování v témže okně se dvěma vlákny Mesa a samostatně přidělenými procesory prošla celá minutová zkouška. Po střídání dne a noci bylo ve sledovaném okně více než 30 snímků a prohlížeč nehlásil chybu ani varování. Záznam je v `data-raw/e21/minuta-dve-jadra.log`.

Po přidání zkoušky objížďky u MHD má výpis Playwrightu 184 případů. Všech 184 má úspěšný výsledek napříč běhy a revizemi. Na herním kódu `7d9471b` prošlo 129 testů JavaScriptu, produkční sestavení, obě desetiminutové ranní špičky a poslední dosud otevřená minutová zkouška. K přijetí etapy zbývá měření deseti fiktivních lamp na autorově počítači s limitem 50 ms na snímek.

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
| 8. Závěrečné ověření | Místní funkční zkoušky dokončeny. Snímky a výsledky jsou v protokolu. Zbývá měření na autorově počítači. |

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
