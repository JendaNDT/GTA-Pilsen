# Stav etapy E20

Větev `etapa/E20` vychází ze sloučené etapy E19 na revizi `10832b4`. [Zadání E20](E20.md)

| Krok | Stav |
| --- | --- |
| 1. Řidič AI | Hotovo. |
| 2. Provoz v okruhu hráče | Hotovo. Převzetí řízení fyzikou, pravidla na trase a volný vůz po nárazu. |
| 3. Zaparkovaná auta a policie | Hotovo. Střet a dojetí hlídky k chodci ověřeny ve hře. |
| 4. MHD a směny | Hotovo. Články vozidel, odstrčení auta, rozjezdy a brzdění ve směnách. |
| 5. Vrtulník | Hotovo. Let s asistencí, přistání na střeše a na heliportu. |
| 6. Voda | Hotovo. Vztlak a odpor vody, pozvolné potopení auta a plavání ke břehu. |
| 7. Závěrečné scénáře, výkon a protokol | Rozpracováno. Prošly samostatné zkoušky míjení v Barrandově, světel v Tylově, směn i četnosti průjezdů na Klatovské. Před křižovatkou s Husovou už řidič může změnit směr, když jeho výjezd blokuje vrak. Poslední výsledky a zbývající kontroly jsou na konci souboru. |

## Otevřené otázky

Aktuálně nejsou potřeba další podklady ani rozhodnutí.

Autor schválil rozumný odhad podvodního profilu. Využije obrys vodní plochy a výšku vykreslené hladiny.
Kontrolním údajem je kóta dna u Wilsonova mostu v městské tabulce. Poppler 26.11.0 z ní přečetl profil R19 v říčním km 1,372 s kótou 299,30 m n. m. Hloubku určuje rozdíl od hladiny.
Měřené příčné profily nebudou potřeba. [Tabulka města](https://gis.plzen.eu/foto/pov_model/profily/PM_Psany_PP.pdf)

Autor schválil, že cizí nepojízdné auto může hra odklidit po minutě stání, jakmile je celé mimo záběr. Hráčovo poslední auto, právě řízené auto a auto z garáže jsou chráněná.

Autor schválil také změnu směru před křižovatkou, pokud původní výjezd blokuje vrak. Běžný řidič může zvolit jiný volný směr povolený z jeho dosavadního pruhu. Žádost o sloučení se po úspěšné kontrole otevře přes připojený GitHub v Codexu.

## Ověření

Řidič dostává trasu, povolenou rychlost a vzdálenost od předního nárazníku k místu zastavení.
Tři zkoušky v Node používají skutečné čtyřkolové vozidlo s motorem, brzdami a odpružením. Na rovince byla největší odchylka 0,02 m, na kružnici s poloměrem 15 m byla 0,11 m. Z 50 km/h zastavil nárazník 0,61 m před čárou. Prošlo 85 z 85 testů JavaScriptu a produkční sestavení. První krok ještě nemění běžící hru.

### Druhý krok

Okolní auto přebírá čtyřkolový model do 150 m po načtení terénu a drží ho až do 220 m.
Předvolby dovolují 40, 40, 20 nebo 10 takových aut. Při obou přechodech zůstává stejné auto na své trase.
V prohlížeči fyzikální vůz u stopky na Doudlevecké zastavil a po splnění pravidla pokračoval.
Prošlo všech 86 testů JavaScriptu, produkční sestavení a 16 prohlížečových kontrol fyziky a dopravy.
Zahrnují kolonu před obsazeným výjezdem na Tylově i jízdu hráčovým autem na WebGPU a WebGL 2.
Záznamy jsou v `data-raw/e20/krok2-{node,build,ove}.log`.

### Třetí krok

Poblíž hráče zaparkované auto spí, čelní náraz ho probudí a odstrčí. Hlídka používá stejný regulátor jako ostatní auta,
sleduje trasu k hráči a před stojícím chodcem zastaví v dosahu zatčení. V rozpočtu počtu aut má při pronásledování přednost.
Prošlo všech 86 testů JavaScriptu, sestavení a všech 11 dotčených prohlížečových kontrol včetně nehody, hlídky, pokuty a pádů chodců.
Záznamy jsou v `data-raw/e20/krok3-{node,build,e2e}.log`.

### Čtvrtý krok

Prošlo 87 testů JavaScriptu, produkční sestavení a prohlížečové sady MHD, směn a provozu.
Tramvaj při náhlé překážce brzdila a odtlačila stojící auto. Při skoku v čase se staré těleso odebere,
aby při přemístění vozu mezi zastávkami neodstrčilo chodce. Kontrola ověřila i pěší přestup na náměstí Republiky.
Při stejném průjezdu jako v E12 získala tramvaj 1 celkem 93 bodů, trolejbus 16 získal 99 a autobus 30 získal 100.
Rozjezd i přechod na provozní brzdu mají omezenou změnu zrychlení. Nouzové zabrzdění má kratší dráhu.
Záznamy jsou v `data-raw/e20/krok4-{node,build,final,smeny,provoz}.log` a `krok4-body.json`.

### Pátý krok

Vrtulník váží 2 500 kg. Zkouška s počátečním náklonem a klesáním ověřila, že při zapnuté asistenci udrží výšku v rozmezí ±0,5 m po dobu 20 sekund. Ve hře bez poškození přistál z výšky 12 m na střeše FN Lochotín i na pozemním heliportu. Prošlo všech 88 testů JavaScriptu, produkční sestavení a čtyři prohlížečové kontroly včetně načtení vypnuté asistence, dokončení rozvozu a návratu od hranice mapy. Záznamy jsou v `data-raw/e20/krok5-{node,build,final}.log`.

#### Vyšší vodorovná rychlost na přání autora

V letovém modelu E20 má vrtulník vodorovné maximum 300 km/h. Při větším náklonu vpřed se mění podélný odpor vzduchu. Při jemném manévrování a po vyrovnání působí dosavadní tlumení. Omezení se počítá z obou vodorovných složek rychlosti, takže zachovává směr i rychlost stoupání nebo klesání.

Při měření z visu s výchozí asistencí a plným povelem vpřed dosahoval původní model nejvýše 141,1 km/h. Po změně dosáhl 258,9 km/h za 20 s a 299,2 km/h za 50 s. Po uvolnění W z maximální rychlosti zpomalil za deset sekund na 76 km/h. V prohlížeči zkouška porovnává rychloměr se vzdáleností uletěnou za posledních pět sekund a ověřuje také udržení výšky.

Prošlo všech 93 testů JavaScriptu, produkční sestavení a šest dotčených zkoušek v prohlížeči. Přelet prošel na WebGPU i WebGL 2. Prošlo i přistání na střeše FN Lochotín a na heliportu a let k okraji mapy. Záznamy jsou v `data-raw/e20/rychlost-vrtulniku-{node,build,prohlizec,webgpu}.log`.

### Šestý krok

Voda v materiálu terénu používá stejnou síť jako `world.heightAt`. Dno pro kola vychází z obrysu vody včetně ostrovů. Do osmi metrů od břehu klesá přibližně o 12 cm na metr, dále o 2,5 cm na metr, nejvýše do hloubky 2,4 m. Na ose Wilsonova mostu poblíž středu řeky je herní hladina ve výšce 300,70 m n. m. Při vzdálenosti 30,5 m od břehu vychází odhad dna na 299,18 m n. m., tedy asi o 12 cm níž než údaj města. Tvar koryta mezi břehy je odhad.

V obou vykreslovačích malé auto sjelo ze suchého západního břehu do Radbuzy asi 20 m po proudu od mostu. Při zkoušce zaznělo jedno šplouchnutí, vůz plaval bez dotyku kol se dnem, hráč vyplaval a dostal se zpět na souš. Od prvního kontaktu s vodou po úplné ponoření a vyřazení auta uplynulo 7,05 s. Na mělčině zůstává vyčnívající karoserie ve hře. Prošlo 90 testů JavaScriptu, sestavení a devět závěrečných prohlížečových scénářů. Širší ověření jízdy, fyziky a vody mělo 20 úspěšných scénářů. Záznamy jsou v `data-raw/e20/krok6-{node,build,overeni,kalibrace}.log`.

První delší pozorování okolního provozu odhalilo chyby při odbočení do Husovy a při návratu převráceného auta do provozu. Ve špičce některé vozy zůstaly stát několik minut. Pro přijetí kroku 7 je potřeba odstranit příčiny a dlouhý běh zopakovat. Souřadnice a průběh jsou v `data-raw/e20/stopa-Klatovská.json` a `data-raw/e20/pozorovani-v2-*.json`.

### Sedmý krok, rozpracováno

Střet s jedoucím autem provozu i odbočení z ulice Kardinála Berana do Husovy už mají vlastní zkoušku ve hře. Přední vůz při střetu zrychlil, hráčův zpomalil, oba utrpěly škodu. Převrácené auto už se nepokouší jet po střeše. Odklizení cizího auta hlídá dobu stání, vlastníka a okraje záběru kamery včetně rozměrů auta. Prošlo 92 testů JavaScriptu a sestavení. Zbývá ověřit návrat plynulého provozu v husté dopravě a uzavřít společné měření, testy a protokol.

K uložení této části sedmého kroku prošlo 13 prohlížečových scénářů provozu a MHD a samostatná prohlížečová zkouška odklizení vraku. Ověřila dobu před minutovým limitem, viditelný vrak po limitu, odstranění po otočení kamery a zachování posledního i garážového auta. Předběžné dlouhé pozorování stále zachytilo dlouhé fronty a vyjetí z vozovky. Záznamy jsou v `data-raw/e20/{krok7-odklid,vrak,odklid-provoz}.log`.

#### Pokračování po revizi `33b5724`

Průběžný provoz při výběru trasy prověřuje slepé ulice a na navazující jednosměrce drží pruh. Při parkování se kontrolují i rohy karoserie, aby auto nezasahovalo do křižovatky. Když místo na trase právě zabírá auto, vůz MHD se zařadí až po jeho uvolnění. Obě změny prošly zkouškou ve hře. Při návratu po nehodě řidič kontroluje směr, prostor a dotyk kol s vozovkou. Při bočním odstrčení dalším autem nebo tramvají řízení převezme fyzika.

Měření na Klatovské proběhlo na autorově Macu v pondělní herní špičce v 7.30, na vysoké předvolbě a s WebGPU. Během 10 sekund měření bylo v blízkosti až 40 aut s plnou fyzikou, z nich až 18 s aktivním řidičem. Z 604 měřených kroků fyziky jich 95 % trvalo nejvýše 3,80 ms při rozpočtu 4 ms. Příkaz je `node tools/measure_map.mjs http://127.0.0.1:4173/ --rush`, výsledek je v `data-raw/e20/vykon-spicka.json`.

Desetiminutová zkouška ve hře sleduje ranní provoz dvakrát. U hlavního nádraží stojí pozorovatel na chodníku u Železniční, přibližně 88 m od bodu nádražní budovy. Při prvním běhu na těchto místech se na Klatovské za deset minut vystřídalo 117 fyzikálně řízených aut a u nádraží 69. V každé minutě se některá auta pohybovala. Nejdelší souvislé čekání jednoho vozu ale dosáhlo 356,5 s na Klatovské a 448,5 s u nádraží, nad mezí 120 s. Pod plynem vyjela auta také z vozovky, mimo jiné na úsecích 28371 na Klatovské a 20738 na Železniční. Časy a souřadnice jsou v `data-raw/e20/pozorovani2/*/pozorovani.json`.

Před uložením prošlo 92 z 92 testů JavaScriptu, 23 z 23 testů Pythonu a sestavení. Z 16 dotčených prohlížečových scénářů jich původně prošlo 15. Šestnáctý používal aktuální čas počítače a ve večerním jízdním řádu nenašel svůj zkušební spoj. Po nastavení pondělí v 7.30 prošla kontrola semaforu pro chodce, trolejbus 10 a tramvaj 4 se stejnými očekáváními. Záznamy jsou v `data-raw/e20/krok7-pravidla.log` a `krok7-semafor.log`.

Při posledním opakování prošly obě zkoušky tramvaje a společná zkouška semaforů. Obě desetiminutová pozorování znovu selhala. Na Klatovské stálo auto 284,5 s na úseku 19355 před úsekem 4, i když na konci čekání řidič požadoval 10,9 m/s. U nádraží bylo nejdelší čekání 201 s na Barrandově, na úseku 1173 před úsekem 6376, kde řidič žádal nulovou rychlost. První vyjetí nastala v sadech Pětatřicátníků a na Koterovské. Záznamy jsou v `data-raw/e20/krok7-ulozeni/*/pozorovani.json`.

#### Pokračování po revizi `668bf0f`

Při odbočení z Koterovské do Železniční vyjížděla i samotná dodávka na prázdné silnici. Nyní řidič začne zatáčet ještě před průsečíkem obou pruhů. Poloměr oblouku vychází z rozvoru vozu, místa v ulici a úhlu odbočení. Na krátkých spojkách řidič počítá s následující zatáčkou při dobrzďování. Nová zkouška nechá dodávku odbočit také z Klatovské na Americkou a kontroluje polohu při každém kroku fyziky až do výjezdového pruhu.

Řidiči sledují volnou vzdálenost podél své trasy i za zatáčkou. U tramvají se přitom bere v úvahu poloha každého článku. Nová auta se zařazují dál od křižovatky a kontrolují, zda už v místě nevznikla kolona.

V průběžném běhu prošlo 15 ze 16 zkoušek v prohlížeči. Během deseti minut u hlavního nádraží se vystřídalo 75 aut, nejdelší stání trvalo 58,5 s. Na Klatovské se vystřídalo 108 aut a nejdelší stání trvalo 268 s. V obou místech se v každé minutě část provozu pohybovala a kontrola nezaznamenala žádné vyjetí. Tento běh předcházel poslední úpravě odstupu. Výsledky jsou v `data-raw/e20/zarazeni/*/pozorovani.json`.

Po úpravě odstupu a brzdění MHD prošlo 94 z 94 testů JavaScriptu, 23 z 23 testů Pythonu a produkční sestavení. Z 24 dotčených zkoušek v prohlížeči uspělo 22, včetně všech tří zkoušek MHD, fronty na Tylově a porovnání intenzity dopravy v pracovní den a o víkendu. Záznamy jsou v `data-raw/e20/oblouky-{node,python,build,overeni}.log`.

| Místo | Pozorovaných aut za 10 minut | Nejdelší souvislé stání | Zjištěná vyjetí z vozovky pod plynem |
| --- | ---: | ---: | ---: |
| Hlavní nádraží | 59 | 74,5 s | 0 |
| Klatovská | 88 | 486 s | 0 |

První neúspěšná zkouška zachytila na Klatovské dlouhou frontu před výjezdem. V samostatném záznamu čelo tramvaje 4 z Košutky stálo na souřadnicích (−374,76; 358,50). Střed zaparkovaného auta v bodě (−377,7; 361,7) byl podle mapy mimo vozovku, ale vůz zasahoval do prostoru před tramvají. Podle délky karoserie zbývá k překážce jen 2,52 až 2,58 m. Další auta v koloně čekala i při zelené. Při pokračování prověřit, kam hra dovoluje zaparkovat podél kolejí v křižovatce, a zda výjezd uvolní tramvaj i auta za ní. Záznam průběhu je v `data-raw/e20/cekani-Klatovská.json`, přepočet mezery v `data-raw/e20/koleje-spicka.json`.

Druhá neúspěšná zkouška byla směna trolejbusu 16. Při opakování má zkouška pevný okamžik nabídky spojů podle uloženého měření ze 17.18 dne 18. listopadu 2026 a stejnou počáteční fázi semaforů. Tramvaj 1 získala 93 bodů, autobus 30 získal 100 a trolejbus 16 získal 85 při obsloužení všech čtyř zastávek. Dva průjezdy na červenou snížily hodnocení o 14 bodů proti původním 99. Zbývá zachytit konkrétní čáry a okamžik, kdy řidič začíná brzdit, a ověřit výsledek proti povolené odchylce pěti bodů. Výpočty hodnocení i meze testů zůstaly stejné. Záznamy jsou v `data-raw/e20/odjezd-smeny.log` a `data-raw/e20/odjezd-body.json`.

Při dvou samostatných měřeních na Macu trvalo 95 % z 604 kroků fyziky nejvýše 4,50 ms a 2,40 ms. První běh dosáhl jen 39 fyzikálních aut a překročil rozpočet 4 ms. Ve druhém bylo 40 fyzikálních aut, z nich až 21 s aktivním řidičem, a měření prošlo. Oba výsledky jsou v `data-raw/e20/vykon-oblouky*.json`. Výkon po dalších změnách znovu změřit.

#### Pokračování po revizi `b78d684`

Na Klatovské už hra při parkování kontroluje celou délku a šířku auta vůči tramvajové koleji. U křižovatky s Tylovou tak odmítne i původní místo, kde střed auta byl mimo silnici, ale roh karoserie překážel tramvaji. Samostatná zkouška ověřuje také parkování pod vyvýšenou tratí.

V Tylově se trolejbusy 12 z Nové Hospody a 16 z Doubravky na prázdné ulici zastavily proti sobě. Oba původně sledovaly její střed. Generátor nyní z původních dat OpenStreetMap přebírá výslovně povolený protisměr pro MHD. Ve hře se vozy drží vpravo a při zkoušce oba dojely přes dvacet metrů za místo setkání. Při porovnání nově sestavených dat se změnil pouze seznam 16 silničních úseků v `meta.json`. Všech šest binárních souborů se shodovalo po bajtech.

Tramvaj 4 z Košutky na středovém pásu Klatovské rozpozná směrový semafor před Americkou. Při jízdě výjezdem přes křižovatku řidič auta může následovat plynule odjíždějící vůz. Před stojícím, brzdícím nebo napříč projíždějícím autem dál čeká.

Při srovnání směn začíná zkouška odměřovat čas přímo při kliknutí na „Nastoupit do směny“. Dříve mohl mezi nástupem a prvním měřením proběhnout další snímek hry a zkrátit pobyt v zastávce. Při stejném jízdním řádu a ovládání získaly linky 1, 16 a 30 opět 93, 99 a 100 bodů, stejně jako v E12. Výsledky jednotlivých směn jsou v `data-raw/e20/nastup-body.json`.

| Poslední desetiminutové pozorování | Počet různých aut s fyzikou | Nejdelší stání | Vyjetí z vozovky pod plynem |
| --- | ---: | ---: | ---: |
| Hlavní nádraží | 51 | 61 s | 0 |
| Klatovská | 102 | 197 s | 0 |

Mez zůstává 120 s. Před křižovatkou Husovy s Klatovskou stálo auto na úseku 34501 před úsekem 1423. V souběžném záznamu této situace mělo po 130 s čekání zelenou. Výjezd mu blokovala tramvaj 4 stojící u jiného návěstidla téže skupiny. Při pokračování prověřit polohu čela a zadního článku tramvaje vůči stopčarám a dráze odbočujícího auta. U nádraží při dřívějším běhu vůz vyjel na Železniční, proto po opravě zopakovat obě pozorování. Výsledky jsou v `data-raw/e20/odjezd-pozorovani/*/pozorovani.json`, polohy a semafory v `data-raw/e20/vazby-Klatovská.json`.

Při uložení prošlo 96 z 96 testů JavaScriptu, 23 z 23 testů Pythonu a produkční sestavení. Ve společném běhu dopravy, MHD a směn prošlo 23 z 24 zkoušek. Prošla i starší zkouška, v níž kolona na Tylově nechává volný přechod a koleje. Při jediném neúspěchu dodávka z Klatovské do Americké nedojela do sledovaného místa za zatáčkou do 90 s. Obě samostatná opakování se stejnou mezí prošla, stejně jako všech šest dalších průjezdů oběma zatáčkami při záznamu polohy. Příčina nedojetí zůstává otevřená. Příští neúspěch vypíše také polohu, rychlost a číslo semaforu nebo značky. Záznamy jsou v `data-raw/e20/protismery-{node,python,build,zaver}.log`, `protismer-oblouky.log` a `prujezd-americka.json`.

Na autorově Macu při 40 autech trvalo 95 % fyzikálních kroků nejvýše 4,20 ms, při opakování s 38 auty to bylo 3,50 ms. Každý běh změřil 605 kroků na Klatovské. Podmínku 4 ms při plném počtu 40 aut zatím tato verze nesplnila. Výsledky jsou v `data-raw/e20/vykon-protismer.json` a `vykon-protismer-opakovani.json`.

Pokračovat na větvi `etapa/E20` krokem 7. Po sestavení zopakovat `npm run test:e2e -- traffic-observation.spec.js --trace off --output=data-raw/e20/dalsi-pozorovani`. Při kontrole Americké použít i `npm run test:e2e -- physical-traffic.spec.js -g 'dodávka udrží' --repeat-each=3 --trace off`. Po vyřešení fronty a ověření odbočení zbývá celá sada testů, kontrola výkonu při 40 autech, protokol `docs/E20.md`, README, katalog a žádost o sloučení do `main`. Od autora nejsou potřeba další podklady.

#### Pokračování po revizi `41dbf7d`

U Husovy stojí směrový semafor na vjezdu a body dvou přechodů téže křižovatky až za ním. Po změně světel původně tramvaj 4 znovu zabrzdila na výjezdu. Její zadní článek zůstal stát napříč Husovou. Při samostatné zkoušce byla na vjezdu při červené skutečná mezera před čelem 0,55 m. Po vjezdu na zelenou nyní vozidlo opustí křižovatku i při změně fáze. Chodec na přechodu má dále přednost. V měření bez chodce se zadní konec tramvaje po změně světel dostal na souřadnici z = 328,89 m, dříve zůstával na 246,84 m. Husova protíná koleje kolem z = 261 m. Záznamy jsou v `data-raw/e20/husova-srovnani-{pred,po}.json`.

Při levém odbočení na Klatovskou řidič sleduje protijedoucí pruh už před krátkou spojkou. Dvě protijedoucí auta v samostatné zkoušce projela bez nárazu. Na Americké odhalila zkouška také falešnou překážku v oblouku. Když zaparkované auto stojí šikmo k odbočujícímu vozu, řidič nyní kontroluje skutečné boky karoserie. V druhém zaznamenaném případě zaparkované auto skutečně blokovalo vnitřek odbočení. Nově zůstává prostor u nároží volný. Všech 98 testů JavaScriptu a sestavení prošly.

Na příčném svahu Železniční se dodávka při čekání na červenou opakovaně pokoušela popojet o několik centimetrů. Na kraji silnice přitom sjížděla do strany. Když nárazník pomalu dojede do 95 cm od čáry, řidič drží brzdu. Při rozjezdu bere řízení v úvahu i boční rychlost vozu. V samostatné zkoušce zůstala dodávka padesát sekund před čárou, pak projela na zelenou a po celou dobu zůstala na vozovce. Zkouška prošla ze středu pruhu i při počátečním vychýlení o 82,5 cm k okraji. U značky STOP se ve stejné vzdálenosti započítává doba zastavení.

Na Klatovské u Tylovy má přechod v mapě několik navazujících částí. Jednu z nich dříve řídily jiné herní hodiny a auto mohlo čekat na kolejích, zatímco do křižovatky vjížděly další vozy. Pokud na sebe dvě části přechodu přes oddělené vozovky přímo navazují, připojí se osamocené světlo ke skupině téže křižovatky. Zkouška porovnává obě části přímo na této ulici. Časy světel jsou ve hře odhadem podle E04.

Samostatný záznam u nádraží ukazuje příčinu jedné z dlouhých front. V Barrandově před odbočkou na Koterovskou čekal sedan na úseku 1176 na protijedoucí kombi. Kombi na úseku 1177 před značkou „Dej přednost v jízdě“ číslo 15504 čekalo na sedan a trolejbus 12 z Božkova. Trolejbus čekal na sedan. Řidič sedanu držel brzdu i po 520 s. Tento případ lze ověřit samostatně na skutečných pruzích 1176 → 1178 a 1177 → 1245. V témže záznamu byly dvě po sobě jdoucí polohy mimo vozovku na Ukrajinské (úsek 214 → 217, čas 35 a 35,5 s). Záznam všech tří vozidel a jejich důvodů ke stání je v `data-raw/e20/ostruvek-pricina-hlavní nádraží.json`.

#### Poslední ověření před uložením kroku 7

Prošlo 98 z 98 testů JavaScriptu, 23 z 23 testů Pythonu a produkční sestavení. Na konečné verzi prošlo 10 z 12 vybraných prohlížečových zkoušek. Dodávka zvládla obě ostrá odbočení, tramvaj uvolnila Husovu i zadním článkem a při změně světel počkala na chodce. Prošla také samostatná zkouška levého odbočení, parkování, stání na svahu a volného přechodu na Tylově. Směny linek 1, 16 a 30 dosáhly původního hodnocení 93, 99 a 100 bodů. Záznamy jsou v `data-raw/e20/kontrola-prujezdu{.json,.log,-node.log,-python.log,-build.log}`.

| Deset minut ve hře, poslední společná zkouška | Počet různých aut s fyzikou | Nejdelší stání | Polohy mimo vozovku pod plynem |
| --- | ---: | ---: | ---: |
| Klatovská | 95 | 175 s | 0 |
| Hlavní nádraží | 89 | 61,5 s | 0 |

V obou případech měla hra současně nejvýše 40 fyzikálních aut. Na Klatovské byl limit čekání 120 s překročen v sadech Pětatřicátníků před úsekem 19355. V jiném rozložení provozu prošla Klatovská se 78 s, zatímco u nádraží čekal vůz na úseku 43739 celých 289 s. Další záznam na konečné verzi zachytil frontu dlouhou 213 s před semaforem 10274015039 na úseku 19523. Výsledky jednotlivých zkoušek jsou v `data-raw/e20/{kontrola-prujezdu,ostruvek-pozorovani}/*/pozorovani.json`, průběh fronty u semaforu je v `data-raw/e20/prujezd-pricina-Klatovská.json`.

Druhá neúspěšná kontrola porovnává počty průjezdů jedním směrem na Klatovské. Za čtyři opakování projelo ráno 41 aut, v poledne 71, odpoledne 60, večer 55 a v sobotu ráno 23. Ranní špička má mít více průjezdů než večer i v sobotu. Časy, pravidla a meze zkoušek zůstaly podle zadání.

Při samostatném měření na autorově Macu bylo na Klatovské současně 40 fyzikálních aut. Z 604 kroků fyziky se 95 % vešlo do 3,0 ms při rozpočtu 4 ms. Výsledek je v `data-raw/e20/vykon-prujezd.json`.

Pokračovat v E20 krokem 7. Nejprve na Barrandově znovu sestavit zachycené setkání sedanu, kombi a trolejbusu a ověřit, kde se jejich jízdní dráhy skutečně překrývají. Na Klatovské zachytit obsazení výjezdu během zelené, porovnat špičku s večerem a zopakovat obě desetiminutová pozorování příkazem `npm run test:e2e -- traffic-observation.spec.js --trace off`. Před uzavřením zbývá ověřit také jízdu na Ukrajinské, spustit úplnou sadu, změřit konečnou verzi, připravit protokol se snímky, README, katalog a žádost o sloučení. Od autora zatím nejsou potřeba podklady ani rozhodnutí.

#### Pokračování po revizi `9868bfd`

Při samostatném opakování v Barrandově odbočuje sedan doprava z Koterovské (19166 → 1176), kombi jede proti němu ke značce přednosti (1177 → 1245) a za sedanem přijíždí trolejbus 12 z Božkova. Při výchozí poloze kombi 13 nebo 18 m od začátku úseku původně zůstaly stát všechny tři vozy. Pokud sedan přijížděl z druhého směru nebo měl protijedoucí vůz větší odstup, všechny tři projely. Původní pokusy obsahuje `data-raw/e20/barrandova-najezd-pred.json`. Nová prohlížečová zkouška měří také skutečný odstup obou karoserií v každém kroku simulace.

Na Klatovské samostatná zkouška potvrdila, že po průjezdu na zelenou přes směrové světlo 10274015040 řidič zastavil na 0 km/h u značky STOP 23586 uvnitř téže řízené křižovatky. Nyní si řidič spojuje značku s navazujícím světelným přechodem na témže úseku a po vjezdu na zelenou pokračuje. Na Husově ukázal záznam další příčinu ranní fronty. Odbočující řidiči si na krátkých spojkách 1423 → 1421 a 1420 → 1422 až 284 sekund dávali přednost navzájem. Před dalšími změnami je případ zaznamenán v `data-raw/e20/klatovska-oblouky.json`.

Sedan při pravém odbočení využívá dostupnou šířku příjezdové ulice. Před stopčárou nechává místo protijedoucímu autu. Při zatáčení řidič opravuje skluz podle směru vozovky. V Barrandově sedan, kombi i trolejbus dokončily průjezd a mezi karoseriemi obou aut zůstal v každém kroku odstup. Dodávka projela oba ověřované ostré oblouky na Americkou a Železniční. Na Ukrajinské při samostatných průjezdech dojely malý vůz, sedan a dodávka přes úseky 519 → 214 → 217 bez vyjetí z vozovky (`data-raw/e20/ukrajinska-prujezd.json`).

Na Husově řidič před levým odbočením sleduje, zda má protější vůz kam dokončit manévr. V ověřené poloze čtyř aut se obě fronty rozjely. V samostatné zkoušce s vnitřními výjezdovými pruhy a dvěma dalšími vozy již uvnitř křižovatky čtveřice po 30 s stále stála (`data-raw/e20/husova-skutecne-pruhy.mjs`, `volny-oblouk-ctyri.json`). Při pokračování porovnat tuto polohu s příjezdem od obou vstupních stopčar a ověřit, kdy může další vůz bezpečně vjet. Původní kontrola volného místa na výjezdu dále hlídá přechod a koleje. Vzdálenější přechod připouští zastavení před sebou, pokud se tam vejde celé auto.

V Tylově dosavadní hledání světel vynechávalo návěstidlo 10274015037 v protisměrném pruhu vyhrazeném MHD. Linky 12 a 11 pak čekaly až na výjezdu do Americké a bránily provozu na Klatovské. Hra nyní používá i pro tento vjezd skutečnou městskou stopčáru 3843. Linka 12 zastavila před čarou do jednoho metru. Po vjezdu na zelenou opustil křižovatku i zadní konec trolejbusu, přestože se mezitím světla změnila. Běžná auta nadále používají svůj jednosměrný pruh. Podklady a původní frontu zachycují `data-raw/e20/tylova-vjezd{,-po}.json` a `volny-oblouk-retez-Klatovská.json`.

| Deset minut ranní špičky po zapojení semaforu v Tylově | Různých aut s fyzikou | Nejdelší stání | Zaznamenané polohy mimo vozovku pod plynem |
| --- | ---: | ---: | ---: |
| Klatovská | 109 | 348 s | 0 |
| Hlavní nádraží | 88 | 133,5 s | 8 |

Obě desetiminutové zkoušky překročily mez 120 s. Na Klatovské čekal vůz před semaforem (19355 → 4). U nádraží na Železniční (20737 → 518) dostával stojící vůz požadavek na jízdu rychlostí 10,09 m/s. Mezi 326. a 330. sekundou zaznamenala zkouška na téže ulici osm poloh mimo vozovku. Jsou to vzorky v čase. Počet různých vozů, které vyjely, z této zkoušky neznáme. Oba původní záznamy jsou v `data-raw/e20/tylova-protismer-pozorovani/*/pozorovani.json`.

Samostatné měření na autorově Macu zachytilo 604 kroků fyziky na Klatovské. Při nejvýše 40 autech s fyzikou, z toho až 22 jedoucích pod řízením hry, se 95 % kroků vešlo do 3,60 ms při rozpočtu 4 ms (`data-raw/e20/vykon-barrandova.json`).

Před uložením prošlo 99 z 99 testů JavaScriptu, 23 z 23 testů Pythonu v prostředí projektu a produkční sestavení. Na tomto sestavení prošlo i všech 12 cílených zkoušek v prohlížeči. Kromě míst popsaných výše ověřily zastavení a rozjezd dodávky na svahu, volný přechod a koleje v Tylově a hodnocení směn 1, 16 a 30 (93, 99 a 100 bodů). Ve zkoušce četnosti provozu na Klatovské projelo za čtyři opakování ráno 107 aut, v poledne 80, odpoledne 78, večer 60 a v sobotu ráno 44. Výsledky jsou v `data-raw/e20/barrandova-zaver-{node,python,build,e2e}.log` a `barrandova-zaver-e2e.json`. Dřívější běh celé sady byl spuštěn před zapojením semaforu v Tylově a po 21 úspěšných zkouškách přerušen. Úplná sada na výsledném sestavení zbývá.

**Navázání v kroku 7:** Při doplňujícím pozorování byla u Husovy po 210 sekundách stání před autem zelená (semafor 3073913700, 28439 → 1423). Uložené polohy a rychlosti okolních aut jsou v `data-raw/e20/tylova-posledni-fronty-Klatovská.json`. Podle nich ověřit, co na zelenou skutečně zabírá výjezd v místě napojení na Husovu. Na Železniční projetí samotného malého auta, sedanu i dodávky vyšlo ve všech šesti pokusech. Polovina vyjížděla ze začátku úseku 20737, druhá z klidu z místa zaznamenaného stání. Všechny vozy dojely na 518 a udržely se na vozovce (`data-raw/e20/zeleznicni-20737-prujezd.json`). V dalším pozorování u nádraží bylo nejdelší stání 109 s a žádné vyjetí. Pro zachycení příčiny při opakování lze spustit `node data-raw/e20/tylova-posledni-fronty.mjs 'hlavní nádraží'` nad místním produkčním sestavením. Zaznamenává polohy okolních vozů, kontakt kol s vozovkou, směr, rychlost a požadavek řidiče.

Po opravách znovu spustit obě desetiminutové zkoušky, celou sadu a měření při 40 autech. K uzavření E20 zbývá protokol se snímky, README, katalog a žádost o sloučení do `main`. Od autora teď nejsou potřeba fotografie, měření ani rozhodnutí.

#### Pokračování po revizi `cd85f0d`

Na Americké se fronta protáhla až ke třem vozům MHD. Dva protijedoucí řidiči taxi chtěli odbočit vlevo (27738 → 56972 a 56968 → 56970). I po 490 sekundách si stále dávali přednost navzájem. Společná zkouška původní chování zopakovala. Po rozpoznání dvojice levých odbočení i před místem míjení oba taxíky projely a jejich karoserie se při žádném kroku nedotkly. Údaje jsou v `data-raw/e20/dodelani-zelena-Klatovská.json` a `americka-taxi-{pred,po}.log`.

Na Husově projely při běžném příjezdu od stopčar všechny čtyři vozy. Záznam celé ranní špičky ale znovu zachytil dvě auta s levým odbočením a dvě těsně za nimi už uvnitř křižovatky. Dodávka a pickup ve vnitřních výjezdových pruzích zůstaly stát přes osm minut. V samostatném pokusu se dvěma volnými vnějšími výjezdovými pruhy všechna čtyři auta projela, v nejtěsnějším místě je dělilo 36 cm. Příčinou a rozměry se zabývají `data-raw/e20/zaznam-rozjezdu-Klatovská.json` a `dodelani-pruhy-mezery.jsonl`.

Při volbě pruhu se kontroluje místo za koncem oblouku. Příčný provoz před tímto místem řidič během odbočování dál sleduje. Zkoušky s oběma volbami výjezdu i obsazeným druhým pruhem prošly. Obě desetiminutové zkoušky na této dílčí verzi skončily s 72 s na Klatovské a 53,5 s u nádraží bez vyjetí. V následném běhu se u Husovy ocitlo taxi již za stopčárou před levou zatáčkou protijedoucího auta. Stálo 470 s. Při samostatném opakování nová zkouška na původním řízení zachytila předčasné překročení čáry a následné uváznutí.

Řidič před levým odbočením nyní vyčká před vstupní čarou, dokud dříve vjeté auto neuvolní společnou část obou tras. Řidič v souběžném volném pruhu může pokračovat. Zkouška rozjezdu z protějších stran prošla. Při nočním běhu původní zkoušky fronty v Tylově chyběl spoj tramvaje 4 z Univerzity. Pro tuto zkoušku je nyní zvolen pracovní den v 7.30. Znovu prošla s původním požadavkem na průjezd skutečné tramvaje přes volné koleje (`data-raw/e20/prednost-prujezd.log`).

Další pozorování našlo v cestě ze sadů havarovanou dodávku. Řidič před zelenou měl obsazené levé odbočení a volnou cestu rovně po Klatovské. Přesných 128,5 s čekání je v `data-raw/e20/rezervace-prubeh-Klatovská.json`, porovnání výjezdů je v `vrak-mozne-smery.json`. Na Železniční projela všechna tři zkušební vozidla také z příjezdu 29310 přes 20737 až na 518. Při následných pozorováních bylo nejdelší stání u nádraží 53,5 s a 55,5 s, oba běhy bez vyjetí z vozovky.

Řidič, který stojí před čárou a má ve výjezdu havarovaný vůz, nově posoudí i další povolené směry ze svého jízdního pruhu. Přes krátké spojky sleduje, zda je na konci místo pro celé auto. Před červenou dál čeká. Pokud jsou všechny výjezdy obsazené nebo původní výjezd blokuje běžná kolona, zachová původní trasu. Zkouška v sadech používá skutečnou polohu dodávky ze záznamu a ověřuje všechny tři situace.

#### Výsledky po zavedení objížďky

Před opravou zůstal řidič v samostatné zkoušce na původní trase 1423. Po opravě projel přes 19355 rovně po Klatovské. Při ucpání všech výjezdů zůstal před čárou. Po nahrazení vraku běžným stojícím autem ponechal původní odbočení. Ze 30 cílených prohlížečových zkoušek prošlo 29 včetně těchto tří situací, jízdy MHD v Tylově, front na Husově, celé sady fyzického provozu a porovnání počtu průjezdů ve špičce a o víkendu. Prošlo 100 ze 100 testů JavaScriptu, 23 z 23 testů Pythonu a produkční sestavení. Záznamy jsou v `data-raw/e20/objizdka-{pred,ove,node,python,build}.log`.

| Deset minut ráno | Různá auta s fyzikou | Nejvíce současně | Nejdelší stání | Polohy mimo vozovku pod plynem |
| --- | ---: | ---: | ---: | ---: |
| Klatovská | 137 | 40 | 130 s | 0 |
| Hlavní nádraží | 81 | 40 | 60 s | 0 |

Jedinou neúspěšnou zkouškou z této skupiny byla Klatovská. Taxi ze Smetanových sadů stálo od 266. do 396. sekundy u světla 10274015045. Při zelené mu stál v cestě vůz odbočující z jeho pruhu, autobus 41 a později vozy linky 4. Po uvolnění kolejí už svítila oranžová. Taxi vyjelo na další zelenou. Všechny čtyři pneumatiky měly kontakt se zemí. Obě samostatná sledování potvrdila tentýž průběh. Polohy jsou v `data-raw/e20/objizdka-ove/*/pozorovani.json`; stav světel a jednotlivých vozů po sekundách v `smetanovy-cary-Klatovská.json`.

Původní měření začínalo čekat na hustý provoz ještě před načtením okolí. Během vlastního měření bylo současně jen 37 aut, takže tento pokus nesplnil požadovanou zátěž. Nástroj teď nejdřív načte okolí a počká na 40 přirozeně přijíždějících vozů. Naměřil 605 kroků fyziky a v 95 % z nich čas do 3,8 ms při rozpočtu 4 ms. Současně mělo fyziku až 40 aut, z toho až 25 řídila hra. [Měřicí nástroj](../../tools/measure_map.mjs). Oba záznamy jsou v `data-raw/e20/objizdka-vykon{,-plna}.json`.

Běh úplné sady zahájený na předchozím sestavení byl ukončen po 35 úspěšných zkouškách a jedné chybě. Při zkoušce rozvozu se přerušilo stažení leteckého snímku `8_11.webp`. Při samostatném zopakování na sestavení s objížďkou stejná zkouška prošla včetně kontroly načtených souborů (`data-raw/e20/objizdka-rozvoz.log`). Úplné ověření výsledného sestavení zbývá.

**Navázání v E20, krok 7.** Příčinu fronty lze hledat před příjezdem taxi. V čase 254,33 s fyzika zaznamenala nehodu kombi při vjezdu z 28439 na 1423. V tom okamžiku jelo kombi 8,0 m/s a na jeho levé straně byl autobus 41 jedoucí rychlostí 6,3 m/s. Havarované kombi pak stálo 5,1 m od čela autobusu, který už vjel do křižovatky. Autobus měl zavřené dveře. Záznam nárazu a následného stání je v `data-raw/e20/smetanovy-nehoda-Klatovská.json` a `smetanovy-linka41-Klatovská.json`. V další zkoušce od obou vstupních čar zjistit, kdo vjel na zelenou první, a ověřit bezpečný průjezd autobusu 41 a kombi bez dotyku. Zachovat pravidla pro červenou, přednost i odklízení vraku. Potom zopakovat obě desetiminutové zkoušky, měření při 40 autech a úplnou sadu. Zbývá protokol `docs/E20.md` se snímky, záznam v README a katalogu a žádost o sloučení do `main` přes připojený GitHub. Další rozhodnutí ani podklady od autora nejsou potřeba.

#### Průjezd linky 41 po revizi `58d7544`

Kombi i autobus vjely ze stejné strany na zelenou u světla 3073913700. Autobus byl v křižovatce první. Druhý vůz stejné linky stál v Husově na červenou. Na původní trase se při posunu čela o dva centimetry přes vrchol zatáčky poloha v pruhu změnila o 3,43 m. Sousední úseky nyní sdílejí bod posunutý do jízdního pruhu. V prohlížeči prošla kontrola plynulosti i přehrání rozjezdu kombi vedle odbočujícího autobusu s kontrolou mezery mezi karoseriemi v každém kroku.

Při desetiminutovém pozorování bylo nejdelší stání 64,5 s na Klatovské (131 různých aut) a 79 s u nádraží (89 aut). Obě místa měla špičku 40 fyzikálních aut. Nebylo zaznamenáno vyjetí pod plynem. Samostatné měření při 40 autech zachytilo 604 kroků fyziky, z toho 95 % do 2,1 ms. Prošlo 100 testů JavaScriptu, 23 testů Pythonu a produkční sestavení. Záznamy jsou v `data-raw/e20/linka41-*`. Zbývá uzavřít úplnou kontrolu, protokol, přehled etap a žádost o sloučení.
