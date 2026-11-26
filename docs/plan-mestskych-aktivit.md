# Plzeň naplno · Implementační plán městských aktivit

Návrh z 26. listopadu 2026. Výchozí stav je `main` po etapě E51, revize `f16ae3c`. Plán rozpracovává [průběžný seznam nápadů](napady-na-aktivity.md) do samostatně hratelných etap. Čísla etap jsou navržená.

## 1. Co má hráč dostat

Hráč najde aktivitu na mapě, dojde nebo dojede na místo a zahájí ji přímo u vchodu, dráhy nebo vozidla. Zakázky čerpají z ulic, provozu a skutečných adres. Sportovní minihry mají vlastní pravidla a osobní rekordy. Jízda MHD je samostatný způsob, jak se po městě pohybovat a dívat se na něj zblízka.

| Aktivita | První hratelná verze | Místo nebo výchozí trasa |
| --- | --- | --- |
| Taxi | Tři druhy jízd a rozpis jízdného a bonusu | Centrum a okolní čtvrti. První ověřené cíle budou zahrnovat hlavní nádraží. |
| Minigolf | Tři odlišné jamky, celkový počet úderů a rekord | Škodaland, V Lukách 34 v Českém údolí. [Sportovní Plzeň](https://sport.plzen.eu/Sportoviste/d/skodaland-ceske-udoli) |
| Rozvoz pizzy na kole | Jedna pizzerie, šest prověřených adres a volná volba trasy | Okolí Americké a Prokopovy. V datech hry už jsou pizzerie označené typem kuchyně. Kandidát je pobočka na Prokopově 356/10. [Pobočky provozovatele](https://rudspizza.cz/pobocky/) |
| Bowling | Volně přístupná herna, trénink a celá partie pro jednoho | U Papírny, Papírnická 3. [Přehled sportovišť města Plzně](https://plzen.eu/doprava/plzen-bez-barier/sport/bezbarierova-sportoviste-pro-verejnost/) |
| Kulečník | Jeden poolový stůl, volný trénink a celá osmička proti soupeři ovládanému hrou | Společná herna s bowlingem U Papírny, Papírnická 3. [Sportoviště U Papírny](https://sport.plzen.cz/Sportoviste/d/bowling-u-papirny) |
| Sportovní terče | Trénink, krátká série letících terčů, dvojice a rekord | Herní sportoviště v Lobzích. Podkladem pro volbu místa je doložená sportovní disciplína v areálu, herní stanoviště navrhneme vlastní. [Český střelecký svaz](https://www.shooting.cz/cs/souteze/2025-05-16-4-kolo-kzr-cesky-pohar) |
| Průchozí MHD | Nástup dveřmi, chůze, sezení, výhled a výstup. Jeden vůz na lince 1, potom rozšíření na další typy. | Pilotní jízda Náměstí Republiky → Hlavní pošta → Pod Záhorskem směrem na Bolevec. Při přípravě se vybere konkrétní spoj z herního jízdního řádu. [Jízdní řád linky 1](https://jizdnirady.pmdp.cz/JR?l=445001) |

Polohy v tabulce jsou výchozí body pro umístění. Před zapojením do hry se v každém místě ověří vstup, pěší přístup, terén, blízká zastávka a případná kolize s existující budovou. V distribuovaných datech už mají Papírnická 3 a V Lukách 34 adresní body. Půdorys herny a provedení drah jsou výtvarný návrh, dokud projekt nemá použitelné podklady pro přesnější model.

První vydání počítá s jedním hráčem, místními rekordy a obsahem z tabulky. Delší minigolfové hřiště, bowling pro střídající se hráče, karambol a další pizzerie jsou kandidáti na další etapy. Současný rychlý rozvoz, rozvoz k Boleváku, řidičské směny a běžné přestupy zůstávají součástí hry.

## 2. Základ ve stávající hře

| Co už máme | Jak na to navázat |
| --- | --- |
| `Jobs` v `src/game/missions.js`, nabídku v `work-ui.js`, adresy a podniky v `world.meta`, ověřování zastavení a trasy v `work-sites.js` | Taxi a pizza použijí stejný průběh zakázky, navigaci, oznámení a výplatu. Taxi už hodnotí čas a nárazy. Rozšíření přidá různé priority cestujících a potvrzení příjezdu u vhodného obrubníku. |
| Hledání v mapě, pěší průvodce, minimapu a označníky MHD v `src/game/area-map.js`, `map-search.js`, `map-drawing.js` a `walking-guide.js` | Přidat místa aktivit do stávajícího hledání a mapy. Na kartě místa zobrazit přístup a tlačítko „Navigovat sem“. Aktivní úkol bude mít přednost v HUD, vlastní značku si hráč může ponechat. |
| Silnice včetně třídy `RC.CYCLEWAY`, terén a kolize Jolt | Kolo použije existující povrchy a kolize. Pro výpočet trasy potřebuje vlastní pravidla průjezdu, protože automobilový graf cyklostezky nevede a pěší graf má jiný účel. |
| Jízdní řád, zastávky, animované dveře a nastupování v `src/entities/transit.js` a `src/game/game.js` | Zachovat spoj, odbavení a režim cestujícího. Dnes se při nástupu skryje postava a kamera sleduje vůz zvenčí. Přidat polohu postavy uvnitř konkrétního vozu a pohled z jeho skutečných oken. |
| Ukládání `plzen-naplno-v1`, `parseSave()`, `Game.commitAccount()` a zámek zápisu mezi kartami | Rekordy a případnou odměnu uložit stejným mechanismem. Existující uložené hry dostanou bezpečné výchozí hodnoty. |

### Společný vstup, průběh a výsledky

- Zapsat malý katalog s trvalým ID, českým názvem, typem, polohou vstupu, směrem nástupu, orientačním bodem a způsobem zahájení. U dopravy identifikovat spoj a stanoviště jejich stávajícími ID. U ručně umístěného vstupu doložit zdroj polohy a po ověření zapsat výšku a bezpečnou návratovou pozici. Hra načte detail místa až při přiblížení či vstupu.
- Použít stávající akci F/E nebo dotykové tlačítko. Výzva u místa musí říct, co se stane. Například „Zahrát minigolf“ nebo „Vyzvednout pizzu“. Kliknutí na značku na mapě nabídne navigaci. Nabídka Zakázky bude dál sloužit k přijetí taxi, pizzy a stávajících rozvozů.
- V jednu chvíli držet nejvýš jednu bodovanou aktivitu, zakázku nebo řidičskou směnu. Pasivní jízda MHD zůstane dostupná uvnitř zakázky, která ji potřebuje. Při ukončení se uklidí dočasné předměty, navigace úkolu, zvuk i kamera. Hráč vždy dostane srozumitelnou cestu zpět do volné hry.
- Pauza zastaví měřený čas herního pokusu. Manuální posun denní doby nepřidává čas do skóre. Po obnovení stránky se nedokončený pokus uzavře jako přerušený, u interiéru se hráč načte na bezpečném venkovním bodě nebo na posledním bezpečném nástupišti. Výslovné pokračování stejné rozehrané partie lze navrhnout později.
- U osobního rekordu uložit ID místa, režim a verzi pravidel. Trénink vést bez osobních rekordů. U dokončené zakázky uložit stav a peníze jedním zápisem. Při chybě nabídnout znovu uložit hotový výsledek bez dalšího odehrání. Opakovaný stisk nebo druhá karta nesmí vyplatit odměnu podruhé.
- Má-li místo rozpoznatelný skutečný podnik, použít vlastní grafiku a ověřit podklady před převzetím. Každý nový distribuovaný podklad patří se zdrojem a licencí do README a „O hře“. Mapové vrstvy se vyrábějí nástroji v `tools/`, nejdřív do `data-raw/kandidat/`.

## 3. Pořadí prací a závislosti

| Etapa | Hratelná změna nebo výstup | Závislost | Hlavní důkaz dokončení |
| --- | --- | --- | --- |
| E52 · Místa a průběh aktivit | Značka na mapě, pěší příchod, kontextová akce, ukončení a návrat. První místo připravit pro minigolf. | E51 | Průchod od vyhledání po návrat na klávesnici i dotyku, ověřená východiska pro další místa. |
| E53 · Pestřejší taxi | Tři druhy placených jízd v existující nabídce Zakázky. | E52 | Hráč dokončí tři druhy jízdy a vidí, proč získal konkrétní bonus. |
| E54 · Minigolf | Tři jamky od startu po souhrn a uložený rekord. | E52 | Celá partie ve Škodalandu, včetně opuštění a nové partie. |
| E55 · Jízda na kole | Půjčení kola, jízda, sesednutí a trasa po prověřených cyklistických cestách. | E52 | Oba směry referenční trasy, městské křížení a samostatná cyklostezka. |
| E56 · Rozvoz pizzy | Jedna pizzerie v centru a výběr ze šesti ověřených cílů. | E53, E55 | Rozvoz s volbou dvou různých cest, předání pěšky u vchodu a jedna výplata. |
| E57 · Bowling | Herna, trénink a deset kol na jedné hratelné dráze. | E52, E54 | Celá partie se správným skóre a návrat stejným vchodem. |
| E58 · Sportovní terče | Trénink a bodované série v Lobzích. | E52 | Celá série, dvojice a výsledek shodný po stejném vstupu. |
| E59 · Pilotní vůz MHD | Jeden vůz linky 1 s chůzí, sezením, výhledem a nástupem i výstupem. | E52 | Jízda alespoň přes dvě zastávky v zatáčce i při brzdění a zkušební výstup v přestupním uzlu. |
| E60 · Interiéry dalších typů MHD | Průchod spojenými články, další tramvaj, autobus a trolejbus. | E59 | Jeden ověřený spoj pro každý podporovaný typ, dále přestup a zachování řidičských směn. |
| E61 · Kulečník | Trénink a poolová osmička na jednom stole ve společné herně U Papírny. | E54, E57 | Partie proti soupeři s ověřením faulů a černé osmičky, přechod od bowlingové dráhy ke stolu. |
| E62 · Společné ověření | Hratelná cesta mezi místy, kontrola uložené hry, výkonu a dotyku. | E53, E54, E56–E61 | Ověření podle části 5 a souhrnný protokol pro vydání. |

E53 a E54 přinesou dvě použitelné aktivity před delší prací na kole a MHD. Ještě v E52 lze na existujícím modelu tramvaje ověřit rozměry, výhled a zvolené nástupiště. E59 pak začne technickým prototypem pohybu za jízdy, po jeho potvrzení dostane vůz finální sedadla, madla a osvětlení.

### E52 · Umístění a spuštění

1. Zapsat navržená místa a ověřit pěší přístup ve dne i v noci. Pro zkoušky uložit pevný čas, výchozí polohu a u MHD identifikátor konkrétního spoje a stanoviště. Nechat stejné adresy fungovat ve stávajícím vyhledávání.
2. Připojit značky k mapě a dohledatelnosti podle názvu nebo typu. Po příchodu nabídnout kontextovou akci. Při souběhu s nástupem do auta nebo MHD se výzva i tlačítko musí shodovat v tom, co se spustí.
3. Přidat jen společný životní cyklus vstupu, výsledku a úklidu. Pravidla, kamera a fyzika zůstávají součástí konkrétní aktivity. První místo ověří, že lze mapu zavřít, spustit aktivitu, přerušit ji, pokračovat v chůzi a později ji znovu spustit.

### E53 · Taxi podle potřeb cestujícího

1. V existující nabídce přidat běžnou jízdu, spěch na nádraží a klidnou jízdu. Karta ukáže nástup, cíl, hlavní požadavek a odhad výplaty před přijetím. Začít se třemi ručně prověřenými dvojicemi nástup a cíl, další nabídky skládat z dosažitelných adres.
2. Recyklovat `curbStop()` a kontrolu jednosměrek a odbočení z `taxiJourney()`. Nabídnout jen cíle s ověřeným příjezdem a místem pro čekajícího chodce. Nástup a výstup potvrdí zastavení u správné strany obrubníku. U nádraží označit bezpečné herní nástupní místo a příslušný pěší přístup.
3. Běžnou jízdu hodnotit podle dokončení, spěch podle času a klidnou jízdu podle plynulosti. Plynulost doplnit o opakované prudké brzdění a nárazy. Časový cíl odhadnout z délky a podmínek skutečné trasy. Rozumné zpoždění snižuje bonus, takže hráč má důvod zákazníka i tak dovézt. Výsledek vysvětlí základní jízdné, získaný bonus a jeho případnou ztrátu.
4. Ověřit prázdnou nabídku, nástup mimo správné místo, poruchu nebo opuštění vozidla, vypršení času, změnu trasy a výplatu po opakovaném uložení. Do hry použít fiktivní cestující a jejich požadavky.

### E54 · Minigolf ve Škodalandu

1. Umístit půjčovnu a tři jamky s postupnou obtížností. První naučí sílu, druhá nabídne užitečný odraz, třetí překážku nebo šikmý povrch s volbou dráhy. Mezi jamkami hráč normálně přechází.
2. U jamky ukázat směr úderu a sílu. Hráč může mířit klávesnicí, myší nebo dotykem. Po úderu sleduje míček, další úder je možný po jeho zastavení. Pro první verzi navrhnout nejvýše sedm úderů na jamku. Míček mimo dráhu se vrátí na místo posledního úderu s jedním trestným úderem, celkový výsledek jamky nepřekročí limit.
3. Pohyb počítat v pevném kroku, pro odraz a valení použít jednoduchá lokální tělesa Jolt. Jamka potřebuje vyhodnocení polohy i rychlosti, aby rychlý přejezd přes otvor neznamenal zásah. Skóre je součet úderů a osobní rekord platí jen za kompletní trojici.
4. Ověřit odraz, klid míčku na svahu, příliš rychlý průjezd jamkou, trestný návrat, konec na limitu a záznam rekordu. Ve hře musí jít začít novou partii po dokončení i po odchodu uprostřed.

### E55–E56 · Kolo a rozvoz pizzy

1. Začít jedním městským kolem u pizzerie. F nebo dotykové tlačítko obstará nástup a sesednutí. Zavést stabilizovanou jízdu s náklonem v zatáčce, jízdou do kopce, brzděním a bezpečným sesednutím. Použít pevný krok, dotazy fyziky a výšku skutečného povrchu. Oddělit stabilitu ovládání od animace kol a postavy.
2. Pro navigaci použít čáry z existujících mapových dat. V datovém kroku ověřit, kde jsou dostupná pravidla `bicycle`, omezení vjezdu a jednosměrnost. Chybějící údaje doplnit do samostatné verze cyklistické vrstvy z dostupných podkladů. Náklady trasy mohou zohlednit sklon, typ vozovky a podíl klidných úseků. Graf musí rozlišit oddělené úrovně mostu a podjezdu, vynechávat dálnice, schody a uzavřené úseky a respektovat povolené výjimky pro cyklisty.
3. Vybrat šest adres v ověřeném okolí. Každá musí mít bezpečné místo k sesednutí a krátký pěší přístup, který je průchozí i bez kola. Nejméně u dvou cílů ověřit rozdílné rozumné trasy, například kratší po ulici a klidnější po cyklostezce. Trasu podél řeky použít pouze v úsecích, které jsou průjezdné také ve hře. [Cyklotrasy kolem plzeňských řek](https://www.visitplzen.eu/blog-a-nase-tipy/vylety-a-prochazky/na-kole-kolem-plzne-podel-rek/)
4. Průběh zakázky je vyzvednout krabici, dojet na kole, sesednout a potvrdit předání u adresy. Při sesednutí kvůli posledním metrům zůstává krabice u hráče. Po pádu musí jít kolo zvednout nebo se vrátit pro náhradní. Ztráta kola nesmí uvěznit hráče v režimu jízdy. Výplata obsahuje základ a čitelný časový bonus.
5. Ověřit rozjezd do svahu, sjíždění obrubníku, střet s překážkou, vodu u nábřeží, návrat po pádu, přepočet trasy, dokončení při zpoždění a jedinou výplatu. Pro první jízdu na dotyku musí být možné brzdit a zatáčet současně.

### E57 · Bowling U Papírny

1. Postavit přístupný vstup a hernu se zádveřím, místem pro rozběh, jednou hratelnou dráhou a čitelnou výsledkovou tabulí. Při návrhu vyhradit místo pro poolový stůl a průchozí cestu mezi oběma aktivitami. Pokud existující kolizní obálka budovy znemožní průchod, propojit vchod s místním interiérem krátkým přechodem. Návrat vždy vede ke stejnému vchodu. Volbu řešení zapsat po zkoušce budovy.
2. Hráč si nastaví směr a sílu a hodí ovládáním podobným minigolfu. Jolt řeší kouli, žlaby, kuželky i vzájemné srážky. Po ustálení poloh se vyhodnotí skutečně sražené kuželky. Stojící kuželky zůstanou na druhý hod. Začátek nového kola je postaví znovu, po ukončení partie se všechna dočasná tělesa uvolní.
3. Přidat trénink a celou partii na deset kol. Tabule zobrazí jednotlivé hody, průběžné body, strike, spare a dodatečné hody v desátém kole. Při čekání na další hod pro výpočet bonusu má tabule ukázat rozpracovaný stav. [Pravidla počítání bodů USBC](https://bowl.com/keeping-score)
4. V testech musí vyjít 0 bodů při samých nulách, 150 při sérii samých 5 a spare zakončené pětkou a 300 za perfektní hru. Ve hře ověřit také žlab, druhý hod se zbylými kuželkami, opakování partie a čitelnost tabule na nízkou předvolbu.

### E58 · Sportovní terče v Lobzích

1. Umístit označení aktivity a vlastní herní stanoviště v prostoru sportoviště. Přidat trénink bez rekordu a krátkou sérii deseti jednotlivých terčů. Po odzkoušení ovládání přidat samostatnou sérii dvojic.
2. Udělat z minihry zkoušku míření a načasování s čitelným pozadím. Herní vyhodnocení používá kurzor a pohyb klikatelných terčů, vázané na čas a pravidla série. Jeden terč lze započítat jednou. Ovládání, zásahy, efekty a skóre platí jen ve spuštěné minihře. Na dotyku má hráč oddělené ovládání pohledu a akce.
3. Výsledkem je počet zasažených terčů z celkového počtu, záznam rekordu a možnost přímého opakování. Ověřit zásah, minutí, souběh dvojice, ukončení rozehrané série a výsledky při rozdílné snímkové frekvenci. Zvuk respektuje ztlumení a efekty respektují nastavení částic.

### E59–E60 · Průchozí vozy MHD

1. Vybrat jeden běžný spoj linky 1 s modelem Tatra v herním jízdním řádu. Projekt na lince střídá modely, proto v testu i na mapě rozlišit konkrétní upravený vůz. Pilot zpřístupní celý jeden samostatný vůz soupravy. Dveře, sedadla, ulička a kabina dostanou vlastní jednoduché hranice pohybu.
2. Držet polohu cestujícího v souřadnicích daného vozu nebo článku a při vykreslení ji přepočítat podle skutečného pohybu vozu. Tím zůstane klidný pohyb na podlaze i v zatáčce. Vnější kolizní těleso MHD ponechat kvůli provozu. Pro chůzi uvnitř použít jednoduché hranice podlahy, překážek a dveří, které se zkoušejí odděleně. Kamera se musí vejít do uličky a dovolit otočení u okna.
3. Nechat nastoupit u odpovídajících otevřených dveří v zastávce. Hráč může dojít k sedadlu, sednout si, vstát a přejít k jiným dveřím. Výstup je možný u otevřeného východu na přístupné straně. Jestliže dveře začnou zavírat při přechodu, hra dokončí přechod jednoznačně na jednu stranu bez zaklínění. Na konečné nebo při zániku spoje se použije ověřená bezpečná venkovní pozice.
4. Prosklít otvory do živé scény města, nastavit správné kreslení rámů a skla z obou stran a jednoduché vnitřní osvětlení. Na nízkou předvolbu použít levnější sklo, výhled musí zůstat. Upravit interiér tak, aby přes okna byly poznat skutečné ulice a zastávky. Po jízdě zachovat existující události nástupu a výstupu pro rozvoz k Boleváku.
5. V E60 přidat další dostupný tramvajový model, autobus a trolejbus postupně. U průchozího článkového vozu zkoušet přechod mezi články v zatáčce. Mezi oddělenými vozy soupravy se přechází venkem po zastavení. Do katalogu doplnit podporované modely a pilotní spoje. U ostatních spojů zůstane dostupný dosavadní způsob jízdy. Řidičskou směnu, přestup a jízdní řád testovat po přidání každého typu.
6. Kritické zkoušky jsou zavřené dveře, rozjezd během chůze, průjezd obloukem, změna stanoviště, sednutí a vstávání, přeskočení herního času, obnovení stránky a bezpečný návrat na konečné. Prohlížečový test a dvojice snímků potvrdí, že výhled z téhož okna skutečně odpovídá dvěma různým místům na trase.

### E61 · Kulečník U Papírny

1. Umístit jeden hratelný poolový stůl do interiéru z E57. V mapě vyhledávat bowling i kulečník pod jejich vlastními názvy a vést hráče ke společnému vchodu. U stolu nabídnout volný trénink nebo partii proti soupeři ovládanému hrou. Po partii se hráč vrátí k témuž stolu a může přejít k bowlingu.
2. Při strku nastavit směr a sílu. Nabídnout pohled ve směru tága a volitelný pohled shora se stejným ovládáním na klávesnici a na dotyku. Kulečníkové koule, mantinely a kapsy řešit místní fyzikou v pevném kroku. Události strku zaznamenají první kontakt, odrazy a pořadí potopených koulí. Pravidla vyhodnotit až po ustálení koulí. Soupeř použije stejné vstupy a stejnou fyziku jako hráč, s jednoduchou volbou přímého strku nebo odrazu.
3. Pro první vydání použít zjednodušenou osmičku. Po rozstřelu je stůl otevřený a první platně potopená skupinová koule v následujících strcích určí plné a půlené koule. Čisté potopení vlastní koule dovolí hrát dál. Po faulu dostane soupeř bílou do ruky. Černá na rozstřelu se vrací na stůl. V ostatních strcích černá vyhrává jen po předchozím dohrání vlastní skupiny a potopení do ohlášené kapsy bez faulu. Předčasné potopení černé, nesprávná kapsa nebo faul při potopení černé znamenají prohru. Rozdíly herního rozstřelu od soutěžních pravidel stručně popsat při zahájení partie. [Pravidla poolu WPA](https://wpapool.com/rules/)
4. Zkoušet běžný odraz, současný dopad více koulí, faul při potopení bílé, umístění bílé mimo ostatní koule, přidělení skupiny, pokračování tahu a výhru i prohru s osmičkou. Projít celou partii na dotyku a na nízkou grafickou předvolbu. Po opakování partie nebo odchodu ke dráze se musí odstranit všechna dočasná tělesa a obnovit pěší kamera. Do místních statistik zapsat dokončené partie a výhry.

## 4. Práce po etapách

- Každou zahájenou etapu popsat v `docs/codex/Exx.md`, vést její stav v `docs/codex/stav.md` a pracovat na samostatné větvi etapy. Po logickém kroku spustit dotčené kontroly a vytvořit commit v češtině. Po dokončení přidat protokol `docs/Exx.md` s revizí, výsledky, známými odchylkami a snímky. [Pokyny projektu](../AGENTS.md)
- Držet stávající three.js přes `three/webgpu`, WebGL 2 jako zálohu a Jolt s krokem 1/60 s. Vysoký detail, efekty a stíny musí jít snížit nebo vypnout stávajícím nastavením. Kolize, výhled z MHD, míření, skóre a ovládání se musí dát použít i na nízkou předvolbu.
- Oddělit načítání míst a vozidel od jejich pobytu v paměti. Míček, kuželky, terče a ostatní dočasné prvky mají omezený počet a životnost. Při opuštění místa uvolnit kolize, grafické prostředky a události. Zvlášť měřit první návštěvu a opakovaný vstup. Měření provádět pomocí `tools/measure_map.mjs --work --paced` a doplnit srovnatelná místa podle etapy.
- Největší technická rizika jsou kolize v pohybující se tramvaji, sjízdnost cyklistické trasy a spolehlivý konec hodu v bowlingu. Každé má samostatný mezivýsledek před výrobou detailního obsahu. Pokud se prototyp nevejde do rozpočtu, nejdřív zjednodušit vizuální hustotu nebo kolizní tvary, poté znovu změřit.

## 5. Ověření připravenosti k vydání

| Oblast | Co musí projít |
| --- | --- |
| Základní příkazy | `npm test`, `npm run build`, při úpravě nástrojů `npm run test:python`, při změně herního běhu `npm run test:e2e -- --trace off`. Nová pravidla mají testy pro známé mezní případy. |
| Hraní od začátku do konce | Na mapě lze najít všechna zveřejněná místa. Z každé minihry se dá vyjít zpátky do města, z MHD na nástupiště a z každé zakázky do volné hry. Ručně vyzkoušet všech sedm aktivit podle postupů výše. |
| Ukládání | Uložená hra z E51 jde načíst včetně peněz, auta, statistik a nastavení. Obnovení stránky uprostřed aktivity vrátí hráče na bezpečné místo. Výsledek se uloží jednou i při opakování po chybě nebo při otevřené druhé kartě. |
| Ovládání a vykreslení | Klávesnice a myš, dotyk v prohlížeči a ruční zkouška na telefonu. Na WebGPU i WebGL 2 projdou základní scénáře na nízkou kvalitu. Ve voze jsou čitelné výzvy, chodí se bez propadání a ven je vidět i při nižším detailu. |
| Výkon | Porovnání se stejnou scénou před etapou. Uvést 95. percentil práce snímku. Pro 60 FPS platí fyzika do 4 ms, logika do 2 ms, příprava vykreslení do 6 ms a GPU do 12 ms. Zapsat důvod zhoršení nad 10 %. Projít testem volání a trojúhelníků a ověřit, že opakovaný vstup nepřidává další trvale držené objekty. |
| Ruční společná jízda | Najít hernu U Papírny na mapě, zahrát bowling, přejít ke kulečníku a dokončit osmičku. Potom nastoupit na linku 1, sednout si, sledovat průjezd městem a vystoupit. Pak dokončit taxi, vyzkoušet dvě cesty při rozvozu pizzy a odehrát minigolf i sportovní sérii. Na závěr obnovit stránku a zkontrolovat odměny a rekordy. |

První zadání k realizaci bude E52. Jeho výstupem bude ověřený vstup u Škodalandu a opakovatelný postup pro přidávání dalších míst. Před startem dalších etap se doplní do jejich zadání konkrétní ověřené vstupy, spoje a testovací trasy.
