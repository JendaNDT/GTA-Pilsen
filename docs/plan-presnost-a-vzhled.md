# Plzeň naplno: přesnější stavby a hezčí město

Implementační plán navazující na E01–E12 a aktualizaci ze 17. listopadu 2026.

**Stav:** návrh k realizaci; žádná etapa níže není tímto dokumentem implementována ani otestována.

**Výchozí revize při přípravě:** `61d9d9bff6ebafd62305f2295cd5a42071f54cfb`.

**Datum:** 17. listopadu 2026.

## 1. Cíl a rozsah

Dokončit první dva body porovnání s HrejBrno 2:

1. Využít měřené mosty, opěrné zdi, pilíře, zábradlí a další vhodné stavební objekty ze stažených městských dat. Zlepšit jejich skutečnou polohu, vzhled a soulad s průjezdem a průchodem.
2. Využít ortofoto pro vzdálený pohled na krajinu a doplnit místní podobu ulic při chůzi: průčelí, výlohy, vstupy, dlažbu, přístřešky a další drobné vybavení.

Výsledkem má být stále jedna spustitelná prohlížečová hra. Přesnější konstrukce musí fungovat také pro auta, chodce, MHD, kameru a vrtulník. Výtvarný směr zůstává lehce malovaný realismus; letecký snímek se do něj barevně začlení.

**Rozsah dokončení:** posoudit celou dostupnou vrstvu stavebních objektů centra a po dávkách začlenit všechny vhodné objekty; připravit ortofoto pro vhodné plochy v současném herním výřezu; dokončit tři níže vymezené ukázkové úseky ulic a opakovatelný postup pro další lokality. Nejde o fotografickou rekonstrukci každého průčelí na celé mapě.

Nové zakázky, pěší navigace, interiéry, podchody jako nové průchozí prostory, kabiny vozidel, vlaky, počasí a rozšíření hranic mapy patří do samostatného pokračování. Stávající herní činnosti slouží jako kontrola, že změny světa nezpůsobily regresi. Další městské sady Cukrovarské a ZOO nyní nepřidávat do hlavního rozsahu.

## 2. Ověřený výchozí stav a jeho důsledky

Zjištění vycházejí ze čtení současného kódu, distribuovaných dat a zdrojového archivu. Starší protokoly poskytují referenci; jejich výsledky nejsou novým měřením této revize.

| Zjištění | Důsledek pro implementaci |
| --- | --- |
| V `public/detail/city/` je 93 dlaždic, 5 697 stavebních záznamů a 205 452 zdrojových ploch budov. | Přidat oddělenou vrstvu konstrukcí; nepřevádět při první změně znovu všechny budovy. |
| Archiv centra obsahuje vrstvu `Plzen_objekty_2024_06_MultiPatch`: 614 záznamů s 602 různými `BUDID_VYH`. Odpovídající vrstva `Plochy` má 12 315 záznamů. | 614 neznamená 614 jedinečných mostů. Prověřit vícedílné objekty a opakovaná ID; neslévat ani nemazat automaticky podle samotného ID. |
| Plochy zahrnují 7 050 stěn/opěrných zdí, 2 993 ploch mostů, 1 026 zábradlí, 682 pilířů/sloupů a další druhy. | Jde o počty ploch, nikoliv staveb. Vhodnost pro vykreslení a kolize určit podle objektu i jeho částí. |
| `build_heritage.py` vybírá pouze soubory `*_budovy_3D_MultiPatch.shp`; samostatné stavební objekty nezpracovává. | Je zde konkrétní nevyužitý zdroj přesnější geometrie. |
| `groundY()` a `deckAt()` počítají pohyb po mostech z profilů silnic/kolejí. `buildRoads()` kreslí konstrukce zvlášť. | Nahrazení mostu musí sladit jeho kresbu, jízdní povrch a nájezdy. Překrytí novým modelem samo nestačí. |
| Kruhové překážky pro stromy a lampy se vztahují k terénu; nemají vlastní obecný výškový interval. Kamera běžně testuje obvody budov. | Pro zdi, pilíře a zábradlí je potřeba omezené rozšíření kolizí a testu kamery. Model mostu nesmí vytvořit překážku přes celý prostor pod ním. |
| `grade-separations.json` a zvláštní model Rondelu obsahují dřívější opravy. Některé vazby používají indexy objektů v konkrétních datových souborech. | Zachovat kontrolní otisky vstupů a jednoznačné pořadí výškových úprav. Změna indexů bez nové vazby může poškodit vzdálená křížení. |
| Alfa současné textury země určuje vodu v `terrainCompile()`. Do textury se kreslí i cesty a vzdálené silnice. | Ortofoto připojit samostatně s maskou. Prostá výměna `map` by mohla odstranit vodu nebo skrýt cesty. |
| Detail měřených budov se stahuje podle polohy, ruší při odjezdu a nahrazuje původní model. | Navázat na životní cyklus dlaždic, včetně chyb stahování a uvolňování paměti. |
| Dosavadní měření E12 trvala po 10 sekundách na jedné fyzické sestavě. | Pro nové vrstvy doplnit dlouhé jízdy, opakované návraty a skutečný mobil. Emulace ovládání není měření mobilního GPU. |

Zdrojový archiv: `data-raw/e05/plzen-2024-shp.zip`, SHA-256 `825dc3e395044b1f5a47e27c812cc4189829e9134cc027865ffc8fcb3e7bb9ac`. U nové kopie musí inventura buď potvrdit tyto hodnoty, nebo vysvětlit změnu.

## 3. Co udělat společně a co rozdělit

**Společně navrhnout datové smlouvy a pravidla aktivace. Implementaci a vydání rozdělit podle konkrétních lokalit a typů změn.**

| Jednotka práce | Co má přijít společně | Co zavádět postupně |
| --- | --- | --- |
| Zpracování zdrojů | Inventura celé vrstvy, souřadnice, identita, původ, třídění a evidence výjimek. | Zapnutí objektů v herním světě po lokalitách. |
| Jeden most | Konstrukce, jízdní a pěší povrch, nájezdy, případné úpravy okolního terénu, kolize a potlačení původní konstrukce. | Další most až po ověření předchozího typu. |
| Jedna zeď či zábradlí | Viditelný základ, odpovídající kolize, výška a průchozí otvory. | Zdi, pilíře a drobné objekty po menších skupinách. |
| Ortofoto | Převod rastru, maska, barevné zpracování, materiál, načítání a návrat k původnímu povrchu. | Nejprve dva malé výřezy, potom souvislé pásy krajiny, nakonec pokrytí výřezu. |
| Průčelí | Zaměření výtvarného návrhu, přiřazení k fasádě, potlačení původních výloh v daném místě a blízký/vzdálený vzhled. | Jednotlivé bloky; neupravovat všechny domy jedním přepisem shaderu. |
| Vybavení ulice | Poloha, ukotvení na správném povrchu a průjezdné/průchozí odstupy. | Přístřešky, lavičky, koše a další rodiny zvlášť. |
| Vydání | Kód, manifesty, všechny odkazované soubory a nové protokoly jako ověřený celek. | Návrat k předchozímu celému vydání; nikdy nahodilé vracení několika binárních souborů. |

Podklady pro ortofoto a fasády lze připravovat během ověřování konstrukcí. Úpravy společných souborů `chunks.js`, `materials.js`, `data.js` a `world.js` slučovat postupně. Každá změna těchto souborů musí mít vlastní ověřený výsledek. Současný přepis vykreslovače, fyziky, datových zdrojů a materiálů celé mapy by zbytečně ztížil hledání příčiny chyb.

## 4. Datový a technický návrh

### 4.1 Společná pravidla

- Zachovat současný počátek, měřítko a orientaci světa. S-JTSK převádět přes doložené CRS do WGS 84 a přes společný modul `coordinates.py` do herních metrů. Výšku Bpv převést jednou odečtením `baseElevation`. Ověřit osy a výšku každého zdroje z metadat.
- Detailní rastr převzorkovat do současné herní soustavy. Nová „přesnější“ projekce jen pro jednu vrstvu by rozpojila vrstvy i uložené pozice.
- Zdrojový identifikátor doplnit o sadu a vrstvu. U vícedílného objektu zachovat díly; totožné geometrie odhalovat normalizovaným otiskem. Vztah 614 záznamů / 602 ID musí zůstat vysvětlitelný v inventuře.
- Ruční rozhodnutí ukládat jako samostatné opravy s důvodem, zdrojem, místem a verzí vstupu. Nevpisovat je do staženého archivu ani je vázat jen na pořadí řádku.
- Každý manifest nese verzi schématu, pokrytí, zdroje, datum podkladů, kontrolní součty a seznam souborů. Ověřuje také počátek, hranice a mřížku světa. Stavební vrstva ověřuje `terrain`, `roads`, `rails`, `landscape` a `grade-separations`; pokud využívá půdorysy, také `buildings`. Masky ortofota navíc závisejí na `land`. Uvést jen skutečné závislosti, ale žádnou zatajenou.
- Uliční detail kotvený k nové konstrukci uvádí její verzi jako závislost. Pokud se při startu použije původní fyzický svět, nenačíst na něj nekompatibilní výzdobu ani překážky. Čistě vzhledové selhání nesmí přepnout fyzický svět za běhu.
- Surová data a pracovní výstupy patří do `data-raw/`. Nové balíčky sestavovat do kandidátní složky, kontrolovat a teprve poté převzít do `public/`.

### 4.2 Stavební objekty: samostatná vrstva

Navržené nové části:

| Cesta | Úloha |
| --- | --- |
| `tools/build_structures.py` | Inventura a převod ploch stavebních objektů, validace geometrie a původu. |
| `tools/build_structures.mjs` | Triangulace, zjednodušený základ, detail, balení po dlaždicích a report velikostí. |
| `tools/structure-overrides.json` | Ověřené vztahy k silnicím/kolejím, náhrady konstrukcí a místní výjimky. |
| `public/detail/structures/index.json` | Verze vrstvy, závislosti, schválené objekty, dlaždice a základní balíček. |
| `public/detail/structures/core.bin` | Kompaktní fyzický a jednoduchý viditelný základ celé aktivované stavební vrstvy. |
| `public/detail/structures/*.bin` | Volitelná podrobná geometrie načítaná podle polohy. |
| `src/world/structures.js` | Aktivace, vykreslení, vlastnictví objektů a detailů. |
| `src/world/structure-surfaces.js` | Výškové a kolizní dotazy nad zjednodušenými konstrukcemi. |

Názvy jsou návrhem; nejde o seznam již existujících souborů. Sdílet pouze potřebné čisté funkce s existujícím převodem. Nevnucovat konstrukcím atributy oken a střech z formátu městských budov.

Každý objekt má oddělené: identitu, zdrojové plochy, obálku, vlastníka, vazbu na nahrazovanou konstrukci, povrchy pro pohyb, boční kolize a podrobný vzhled. U mostu označení `Most` samo neurčuje, která plocha je vozovka. Rozlišit vršek mostovky, bok, spodek, podpěry a zábradlí podle normál, polohy a ověřené návaznosti na komunikace.

**Fyzický základ je nezávislý na podrobném vykreslení.** Při startu načíst a zvalidovat kompaktní `core.bin` pro celou aktivovanou vrstvu. Součástí je také jednoduchý viditelný model odpovídající jeho kolizím. Detail pouze zlepší vzhled. Kolize tedy nezmizí při změně grafické kvality, odletu kamery ani selhání stahování detailu. Při nedostupnosti či nesouladu základního balíčku vypnout celou tuto vrstvu před umístěním hráče a použít původní konzistentní svět.

Jednoduché modely základního balíčku sestavit při aktivaci vrstvy a prostorově seskupit pro ořez mimo záběr. Jejich existence se neváže na dokončení síťového požadavku na dlaždici detailu. Tím ani při rychlém příjezdu nevznikne neviditelná pevná překážka. Podrobný model nahrazuje odpovídající základ až po úplném sestavení; během změny LOD se fyzika nemění.

Základ přidat s pevným rozpočtem do startu, nikoliv do každé snímkové smyčky. Pokud překročí rozpočet, nejdřív zjednodušit reprezentaci. Regionální streamování fyziky je samostatný zásah s nutností přednačítání a blokace vstupu do nepřipravené oblasti; neřešit ho skrytě při dokončování vzhledu.

Původní konstrukci potlačit jen podle schválené vazby na konkrétní části komunikací, ne podle hrubé obálky objektu. U Wilsonova mostu například nahradit konstrukci a příslušná zábradlí; dopravní značky, čáry a navazující silnice musí zůstat na správném povrchu. Dosavadní `buildRoads()` slučuje geometrii, proto doplnit rozhodování o náhradě před jejím sestavením, ne skrývat celou silniční dlaždici.

**Pořadí inicializace:** původní terén a jeho opravy → silniční/kolejové profily včetně dřívějších úprav → ověřené místní profily konstrukcí → odvozené mostní a prostorové indexy → umístění hráče, vozidel a MHD. Závislé grafy a indexy vytvořit až z konečného stavu, případně je jednou přepočítat. Konflikt dvou oprav je chyba sestavení, nikoliv pravidlo „poslední zápis vyhraje“.

Výchozí topologii silničního grafu, směrové zákazy a identitu linek ponechat. Pokud konkrétní oprava vyžaduje změnu půdorysné trasy, vydělit ji jako samostatnou mapovou opravu s novým sestavením všech dotčených závislostí a kontrolou MHD; nezahrnovat ji nepozorovaně do změny materiálu nebo mostního detailu.

Boční kolize reprezentovat úseky či jednoduchými tělesy s intervalem výšek. Zachovat otvory; žádný obdélník přes celý most. U povrchů ponechat výškový kontext dotazu, aby hráč pod mostem neskočil na jeho vršek. Pro kameru doplnit dotaz na nové konstrukce s výškou po délce paprsku; současný plochý test budov nesmí být jedinou ochranou. Při rychlé jízdě ověřit, že tenká zábradlí nelze přeskočit jedním krokem simulace.

Dlouhý objekt zůstává jedním logickým objektem. Detail lze rozdělit do více dlaždic, ale části musí mít stabilní identitu a návazné hrany. Prostorový index registruje celý rozsah, nikoliv pouze dlaždici středu. Omezení stávajícího 16bitového balení souřadnic se musí kontrolovat; při překročení rozdělit geometrii nebo použít jiný doložený formát. Hodnoty nikdy neoříznout tiše.

### 4.3 Ortofoto: další barva povrchu s vlastní maskou

Navržené části: `tools/fetch_orthophoto.py`, `tools/build_orthophoto.py`, `public/detail/orthophoto/`, `src/world/orthophoto.js`. Offline nástroj získá výřezy z doložené distribuce ČÚZK, uloží datum snímkování, CRS, rozlišení, licenci a otisk. Distribuované dlaždice se servírují spolu s hrou; hra při jízdě nezávisí na dostupnosti mapového serveru třetí strany.

Postup:

1. Georeferencovat a převzorkovat snímky do herní mřížky 256 m. Použít stejnou definici pixelových středů, přesahů a ořezu pro sousední dlaždice.
2. Připravit dvě velikosti: obvykle 256 × 256 px (1 m/px), volitelně 512 × 512 px (0,5 m/px) pro vybraná místa. Slabší profil používá nejvýše základní velikost a menší aktivní zásobu. Čísla jsou návrh pro pilot, ne vlastnost zdroje.
3. Vytvořit samostatnou masku použití snímku: přednost mají pole, louky a otevřená krajina. Voda, vozovky, koleje, chodníky, důležité pěšiny, půdorysy budov s rezervou a ručně upravené plochy mají zachovat stávající kresbu. Zohlednit cesty, které jsou v dálce vidět pouze v textuře terénu.
4. Ztlumit barevné rozdíly mezi snímkovými pásy, ověřit pevné fotografické stíny a nevhodně zachycená auta, stromy nebo zbourané objekty. Sporné oblasti maskovat. Snímek nepoužívat jako důkaz aktuálnosti celé mapy.
5. Přidat samostatnou barvu a masku do materiálu. Zachovat původní alfa kanál vody, stávající pohyb hladiny, dlažbu i řezy u tunelových portálů. Barevné snímky správně dekódovat ze sRGB; masku číst jako data. Existující práce s přednásobenou alfou musí zůstat konzistentní.
6. Plynule míchat podle vzdálenosti od kamery; pro pilot blízký vzhled přibližně do 80 m, vzdálený od 200 m. Prahy ověřit při letu i chůzi a použít hysterezi při výměně rozlišení. Podrobnost snímku nesmí „přeskakovat“ při drobném pohybu kamery.
7. Řešit přesahy a mipmapy tak, aby se na hranách netvořily linky. Při chybě, chybějící dlaždici nebo plné paměti ponechat procedurální povrch; žádná černá textura.

Ortofoto nemění výšky ani kolize. Rozpor odhalený snímkem patří jako samostatná oprava geometrie do evidence; nevyřeší se posunutím celé textury tak, aby seděla jen jedna budova.

### 4.4 Ulice při pohledu zblízka

Navržené části: `tools/street-details/` pro zdrojové popisy a reference, `tools/build_street_details.mjs`, `public/detail/streets/`, `src/world/street-details.js`. Použít stejné zásady verzování a životního cyklu jako u konstrukcí.

**Tři dokončované úseky:**

1. Pilot: souvislý blok Americké u Wilsonova mostu včetně obou přilehlých nároží. Přesný polygon a seznam průčelí vymezit v E13 podle dostupných podkladů, zhruba 100–200 m ulice.
2. Druhá dávka: napojení Dřevěné na náměstí Republiky. Zachovat dosavadní úpravu katedrály a radnice; upravovat jen předem vymezená průčelí, povrchy a vybavení.
3. Třetí dávka: vnější okolí zastávek u hlavního nádraží, veřejně přístupný prostor a přístřešky. Rozsah končí u vstupů do podchodů a budov; nevytváří nové interiéry.

Pro každý úsek zaznamenat současný referenční vzhled, datum a práva k použitým fotografiím. Fotografie jako předloha pro vlastní stylizaci a fotografie přímo vložená do textury jsou dva různé způsoby užití. Na obchodní název či vzhled provozovny navázat jen tam, kde je podklad ověřený; jinde použít vlastní neutrální grafiku.

Průčelí kotvit k měřeným plochám pomocí geometrického popisu a kontrolního otisku. Nepoužívat neověřené číslo trojúhelníku ani samostatný GPS bod. Pokud se podklad změní, chybnou dekoraci nezobrazit a vykázat ji k novému přiřazení. U složených domů zachovat vazby na všechny části.

Detaily mají konkrétní měřítko: členění výloh a vstupů, sokly, římsy, rámy, stříšky a drobné cedule. Sdílet materiály a atlas vlastních textur. Novou výlohu současně spojit s vypnutím procedurální výlohy na téže části fasády. Pro vzdálený pohled ponechat levnější siluetu a barvu. Stíny a osvětlení nesmí být dvakrát zapečené.

Lavičky, koše, stojany a přístřešky přidávat až po fasádách a površích. Ověřit odstup od dveří MHD, přechodů, průjezdného profilu a cílů existujících úkolů. Tenké grafické prvky jsou bez kolize; tělesa, o něž by hráč přirozeně narazil, mají odpovídající jednoduchou viditelnou a fyzickou reprezentaci. V nízké kvalitě mohou být jednodušší, ne neviditelná s ponechanou kolizí.

## 5. Doporučené pořadí etap

Číslování pokračuje po E12. Každá etapa končí samostatným protokolem se zdroji, revizí, výsledkem a známými výjimkami. Příprava podkladů smí běžet souběžně; sloupec závislost určuje, kdy se může zapnout výsledek ve hře.

Hlavní sled je **ověřený základ → import konstrukcí → jejich fyzika a pilot → rozšíření konstrukcí → materiál terénu a ortofoto → detaily ulic → společné vydání**. Toto pořadí stabilizuje povrchy před ukotvováním výzdoby. E18 lze připravit už po E13; před jeho použitím obnovit masky proti poslední přijaté geometrii.

| Etapa | Výsledek | Závislost | Podmínka přechodu dál |
| --- | --- | --- | --- |
| **E13 – Výchozí kontrola a inventura** | Obnovená reference současné hry, kompletní seznam objektů, pilotní lokality, zdroje a rozpočty. | Výchozí revize | Projdou dosavadní kontroly, nové snímky a měření jsou uložené; známé chyby mají samostatný seznam. |
| **E14 – Offline převod konstrukcí** | Opakovatelný převod celé vrstvy, třídění, kandidátní základ a detail; ve hře dosud vypnuto. | E13 | Každý zdrojový záznam má dohledatelný výsledek, duplicitu nebo důvod vyřazení; dva převody stejných vstupů jsou shodné. |
| **E15 – Bezpečné načítání a malé konstrukce** | Podpora základního balíčku, výškových kolizí, kamery a detailu; pilot s několika zdmi, pilíři a zábradlími u Wilsonova mostu. | E14 | Správné průchody a kolize, žádná závislost fyziky na detailech, ověřené chyby načítání a návraty. |
| **E16 – Celý Wilsonův most** | První úplná náhrada mostu včetně nájezdů a návazností. | E15 | Projdou jízdy oběma směry, pěší trasy nahoře i pod mostem, MHD na dotčené trase a kamera; souhlas kresby s povrchem. |
| **E17 – Další konstrukce po dávkách** | Schválené objekty celé dostupné vrstvy centra. | E16 | Každá dávka prošla lokálními i sdílenými kontrolami, stav celého inventáře je vysvětlený. |
| **E18 – Offline ortofoto** | Převod, masky, sjednocení barev, dvě úrovně detailu a pokrytí; hra zatím beze změny. | E13; finální masky proti přijatému stavu E17 | Kontrolní body a okraje sedí; soubory a velikosti jsou reprodukovatelné. |
| **E19 – Ortofoto ve hře** | Dva piloty a po ověření souvislé rozšíření vhodných ploch po celé současné mapě. | E17, E18 | Zachovaná voda, pěšiny, značení, noc a tunely; výkon, paměť a návrat při selhání v limitu. |
| **E20 – Detailní blok Americké** | První hotový úsek se skutečnými proporcemi průčelí, dlažbou a vybavením. | E16, E19 | Místo je rozpoznatelné z referenčních pohledů; průchody a stávající herní činnosti fungují. |
| **E21 – Další dva úseky** | Dřevěná/náměstí a okolí nádraží, jednotný styl a sdílené materiály. | E20 | Každý úsek samostatně ověřen v obou kvalitách a třech denních dobách. |
| **E22 – Celkové ověření a vydání** | Reprodukovatelné vydání, protokoly, snímky před/po a ověřený návrat. | E17, E19, E21 | Splněna závěrečná kritéria v části 9. |

### Provedení a velikost dávek

**E13:** zkontrolovat revizi a změny v pracovním stromu, založit pracovní větev, sestavit spustitelnou referenci a ověřit její archiv. Pro konstrukce vybrat kromě Wilsonova mostu jeden objekt přes hranici dlaždic a jedno křížení, u něhož se současně používají starší výškové opravy. Zaznamenat reálnou dostupnost těchto objektů ve zdroji. Pro ortofoto vybrat otevřenou krajinu u Rokycan a úsek okolí Klabavy; voda zůstává mimo barevný přepis. Přesné obálky uložit do strojově čitelného plánu lokalit.

**E14:** první návrh převodu ověřit nad celým archivem, ne jen nad třemi snadnými objekty. Vypsat neplatné plochy, chybějící součásti, rozměrné objekty a nepřiřazené mosty. Základní předprohlídku umožnit existujícím debug režimem hry s izolací objektu, drátovým modelem a kolizními obaly; vlastní obecný 3D editor není potřeba.

**E15–E16:** runtime podporu lze rozdělit do menších změn, ale pilot zapnout teprve s kompletním jednoduchým zobrazením a kolizemi. Wilsonův most má vlastní dosavadní klenby a pevnou šířku v kódu; explicitně vyřešit jejich náhradu a návaznost chodníků. Nenahrazovat jiné mosty jen proto, že se nový model podařilo zobrazit.

**E17:** doporučené pořadí je zdi a podpěry → jednoduché mosty → souběžné nebo víceúrovňové konstrukce → zbylé drobné objekty. Jedna dávka má jednu lokalitu nebo jeden již ověřený typ, orientačně 10–30 jednoduchých objektů či jeden složitý most. Rondel, Valík a opravené podjezdy měnit pouze při doložené kolizi s novou vrstvou; v ostatních případech slouží jako regresní místa. Nejasné `Ostatni`, nádrže a jezy jednotlivě posoudit, zejména proti vodní hladině a existujícím modelům.

**E18–E19:** začít výřezy o rozloze přibližně 1–2 km². Po jejich kontrole nejdřív pokrýt krajinu podél Plzeň–Rokycany–Dobřív, potom zbývající vhodné plochy mapy. Rozšíření nemá zvětšit povinný startovní balík o všechny fotografie. Evidovat pokrytí a vědomě maskované či nedostupné plochy. Pokud snímek v určité oblasti vzhled zhoršuje, ponechat procedurální povrch se zapsaným důvodem.

**E20–E21:** pro jeden úsek postupovat reference → fasády → povrchy → vybavení → noc → nízká kvalita → kontrola hran úseku. Návrhy a vlastní textury lze připravovat už od E13; konečné kotvení a zapnutí vychází ze schválené geometrie a materiálů. Po pilotu zopakovat postup na druhém úseku a teprve pak na třetím.

**E22:** zmrazit kandidátní data, provést celou kontrolní sadu a připravit archiv. Po změně vyvolané závěrečnou kontrolou zopakovat dotčené zkoušky a závislé kontroly. Staré protokoly nepřepisovat novými výsledky.

## 6. Paměť, výkon a odolnost

Následující čísla jsou **počáteční rozpočty k potvrzení v E13–E16**, nikoliv již dosažená měření. Jejich změna musí mít konkrétní naměřený důvod a nový protokol.

| Oblast | Pracovní mez |
| --- | --- |
| Nová povinná data při startu | Indexy a fyzický základ konstrukcí dohromady nejvýše 2 MiB přenesených dat po sjednoceném způsobu komprese. Detailní snímky a textury se načítají později. |
| Dodatečné rezidentní ortofoto a masky | Nejvýše 64 MiB odhadované paměti textur ve vysokém profilu, 16 MiB v nízkém; včetně mipmap. |
| Detailní geometrie konstrukcí a ulic | Pracovně nejvýše 32 MiB dodatečných GPU bufferů ve vysokém a 12 MiB v nízkém profilu. CPU kopie evidovat zvlášť a po uploadu zbytečné uvolnit. |
| Souběžné požadavky | Výchozí společný strop 4 pro blízké městské detaily a nové vrstvy, v nízkém profilu 2. Priorita: nutný jednoduchý svět → blízká geometrie → výtvarné detaily → vzdálené ortofoto. |
| Čas snímku | Medián p95 ze tří shodných běhů nepřekročí referenci o více než větší z hodnot 2 ms / 10 %. Zvlášť vykázat nové záseky nad 50 ms a jejich příčinu. |
| První načtení | Medián pěti studených startů se stejnou sítí nepřekročí referenci o více než větší z hodnot 300 ms / 15 %. |
| Uvolňování | Po třetím opakování stejného okruhu nesmí zásoba textur, bufferů, úloh a vlastníků dále soustavně růst; musí zůstat v rozpočtu. |

Paměť textur počítat z dekódovaných rozměrů a formátu, ne z velikosti JPG/WebP na disku. Počty z `renderer.info` jsou pomocná metrika, nikoliv úplná paměť prohlížeče. Zvlášť hlídat dekódované obrázky, čekající odpovědi a zrušené úlohy. Po uploadu uvolňovat také dočasné obrazové objekty.

Zavést malý společný plánovač požadavků a rozpočet uploadu v rámci nynějšího správce dlaždic; přepracování celého načítání budov není podmínkou. Použít rušení, kontrolu generace požadavku a omezené opakování po selhání. Pozdní odpověď nesmí vytvořit model v již odstraněné dlaždici. Materiálové varianty držet v malém počtu, aby každá dlaždice nevyvolávala vlastní kompilaci shaderu.

Při tlaku na paměť nejdřív snižovat rozlišení snímků, počet vzdálených detailů a vzdálenost jejich zobrazení. Nikdy tím neměnit kolize, dopravní pravidla nebo fyziku mostu. Přepnutí stavební vrstvy jako celku provádět při načtení hry, ne během jízdy; vzhledové vrstvy mohou selhat samostatně.

## 7. Ověření: konkrétní situace a kritéria

### Data a přesnost

- Každý vstupní záznam inventáře má stav `začleněn`, `sloučen jako totožná geometrie`, `nevhodný` nebo `čeká na konkrétní ověření`, vždy s důvodem. Dokončení realizovatelného rozsahu nesmí skrývat nevyřešené vhodné objekty za hromadné vyřazení.
- Dva převody ze stejných vstupů a připnutých verzí nástrojů vytvoří stejné soubory. Report uvádí použité knihovny, parametry, otisky a rozsah ručních úprav.
- Kontrolovat konečnost souřadnic, rozsahy balení, indexy, nulové trojúhelníky, otvory a orientaci ploch. Žádná chybějící vrstva se nesmí tiše změnit na plnou stěnu.
- Numerický převod kontrolních bodů má chybu nejvýše 5 cm proti nezávislému převodu téhož zdroje. Jde o toleranci zpracování, nikoliv tvrzení o geodetické přesnosti hry nebo podkladů.
- Na mostě požadovat shodu viditelného a fyzického povrchu do 5 cm v kontrolních vzorcích; spoje dlaždic a nájezdů nejvýše 5 cm bez umělého schodu. Při rozporu zdrojů evidovat, který povrch má přednost a proč.
- Ortofoto ověřit alespoň na pěti pevných bodech v každém pilotu, rozložených po jeho ploše. Technická odchylka resamplingu nejvýše jeden výstupní pixel; skutečné rozdíly v mapě nebo stáří snímků řešit samostatně. Hranice sousedů musí mít shodnou georeferenci.

### Herní a vizuální zkoušky

| Scénář | Požadovaný výsledek |
| --- | --- |
| Wilsonův most pěšky a autem oběma směry | Plynulé nájezdy, správná výška, funkční chodníky a zábradlí; žádné nové poškození auta od povrchu. |
| Pod mostem a u podpěr | Prostor je průchozí podle reality, podpěry mají vlastní kolizi, kamera neprojde zdí ani nepřeskočí nad most. |
| Dvě úrovně nad sebou | Hráč, auto a MHD zůstanou na správné úrovni; kolize vrchního zábradlí nepůsobí dole. |
| Dlouhý objekt na hraně dlaždice | Žádné dvojí kreslení, mizení poloviny konstrukce ani mezera při jízdě nebo letu. |
| Stará uložená hra v měněné lokalitě | Peníze, vlastnictví a postup zůstávají zachované. Pozici po načtení prověřit; pokud nová zeď zasahuje uložené místo, použít nejbližší bezpečné místo stejné úrovně a srozumitelně to oznámit. |
| Pomalá síť, 404, přerušený přenos, chybný formát nebo otisk | Jednoznačně zvolený původní či nový fyzický základ; při chybě detailu zůstane jeho jednoduchá podoba. Hra pokračuje bez pádu. |
| Odjezd během stahování, rychlý návrat, změna oblasti | Stará odpověď se nepřipojí do nového vlastníka; žádná duplicita geometrie nebo kolize. |
| Ortofoto při chůzi a letu | Plynulý přechod, bez švů a černých ploch, bez zdvojených cest a domů. |
| Klabava, Valík, hamr a dlažba náměstí | Zachované hladiny, vodní efekt, tunelové otvory, místní dlažba a vzhled hamru. |
| Výlohy a vybavení ulice | Žádné překryté procedurální výlohy, blikání ploch, zakryté dveře MHD nebo zablokované cíle. |
| Den 10:00, soumrak 18:09, noc 22:00 | Čitelná geometrie a značení, konzistentní barvy; fotografické stíny neruší osvětlení. Ověřit i současný `?wet=1`. |
| Vysoká a nízká kvalita | Shodná průchodnost a chování hry; rozdíl jen v rozlišení a detailech. |

Stávající sady pro Rondel, mimoúrovňová křížení, Valík, Dobřív, MHD, rozvoz a uložení zůstávají regresní ochranou. Případnou oprávněnou změnu očekávaných počtů či otisků doložit; nesnižovat nároky testu jen proto, aby nová data prošla.

### Výkon a rozsah testování

Použít stejné startovní pozice, čas, provoz, rozlišení a náhodný seed pro referenci i kandidáta. Vedle dosavadních krátkých scénářů měřit alespoň 60 sekund jízdy nebo letu ve třech opakováních. Doplnit nejméně 20 minut projíždění s návraty mezi centrem, Rokycany a Dobřívem. Vykázat p50/p95/p99, nejdelší snímek, počet záseků, počet požadavků, aktivních textur a odhad paměti.

Automatické kontroly dělit na testy převodu, testy výšek/kolizí a prohlížečové scénáře. Snímky posuzovat vedle původního stavu i podkladu; samotné porovnání pixelů nepotvrdí správnou průjezdnost. Chromium s vykreslováním SwiftShader v současném `playwright.config.js` slouží k funkční regresi. Výkon měřit zvlášť na skutečném GPU, včetně reálného iPhonu/Safari nebo Androidu/Chrome. Dostupné platformy a omezení zapsat; chybějící měření telefonu neoznačovat za hotové ověření.

Při lokální dávce spouštět dotčené testy a základní průchody. Celou sadu, audit závislostí a sestavení spouštět při společných změnách runtime a před vydáním. Nepřidávat stovky testů, které pouze opakují názvy polí manifestu.

## 8. Bezpečné vydávání a návrat

1. Pro každou dokončenou etapu uchovat kód, manifest a protokol. Všechny změny sdílených souborů ověřit před navazující etapou.
2. Mít nezávislé diagnostické přepínače `structures`, `orthophoto` a `streetDetails`; vývojové přepínače nejsou náhradou za správné závislosti. Verzi fyzického světa rozhodnout před zahájením hry.
3. Kandidáta sestavit mimo aktivní `public/`. Pro lokální přehrání použít izolovaný statický výstup. Převzetí do distribuovaných dat musí být kontrolovaným krokem s porovnáním součtů.
4. Nové soubory pojmenovat verzovaně nebo obsahovým otiskem, aby cache nemíchala starou geometrii s novými maskami. Manifest smí odkazovat jen na úplné sestavení. Ověřit i provoz z podsložky.
5. `archive_release.py` dnes používá pevnou příponu `-E12`. Před novým vydáním umožnit jednoznačnou novou verzi a rozšířit manifest o nové vstupy a výstupy. Starý archiv zachovat.
6. Zkusit návrat k předchozímu celému vydání na stejném uloženém postupu. Vzhledové vrstvy nepotřebují nový formát účtu; případné nové nastavení má bezpečnou výchozí hodnotu ve starší verzi.
7. Při problému s ortofotem lze odstavit jen ortofoto. Při chybě nové konstrukce vrátit schválenou skupinu zahrnující model, povrchy, kolize a náhrady původních částí; u nejednoznačné chyby vrátit celé vydání. Neponechávat nové neviditelné kolize se starým zobrazením.

## 9. Dokončení a předání

Práce je dokončená, když:

- celý inventář stavebních objektů má dohledatelné rozhodnutí a všechny přijaté objekty jsou součástí ověřených dávek;
- Wilsonův most i další přijaté konstrukce mají sladěný vzhled, povrch, nájezdy, kolize a kameru;
- ortofoto pokrývá schválené vhodné plochy herního výřezu a ostatní plochy mají zdokumentovanou původní podobu;
- všechny tři vymezené uliční úseky jsou hotové, včetně přechodu do běžné zástavby, noci a nízké kvality;
- původní pohyb, doprava, MHD, úkoly a uložené hry projdou regresními kontrolami;
- nové vrstvy projdou poruchovými scénáři a měřením podle části 7; žádná neověřená platforma není prezentovaná jako ověřená;
- nové vydání lze sestavit ze zaznamenaných vstupů a vrátit zpět jako celek.

Předat: aktualizovaný README, protokoly E13–E22, inventář s výjimkami, zdrojové a výstupní otisky, snímky před/po ze stejných kamer, výsledky testů a výkonu, webový a zdrojový archiv a krátký postup pro přidání další lokality. Pro každý nevyřešený objekt uvést příčinu a konkrétní potřebný podklad; takový objekt nepočítat mezi dokončené.

## 10. Odhad a rozhodnutí v průběhu

Odhad je v soustředěných pracovních dnech jednoho vývojáře včetně lokálního ověřování, bez čekání na podklady. Je to plánovací rámec, nikoliv slíbený termín.

| Část | Předběžný rozsah |
| --- | --- |
| E13–E14: reference, audit, offline převod | 3–5 dnů |
| E15–E16: runtime, kolize, první úplný most | 5–9 dnů |
| E17: rozšíření stavebních objektů | 4–8 dnů |
| E18–E19: ortofoto a jeho rozšíření | 4–7 dnů |
| E20–E21: tři uliční úseky | 6–10 dnů |
| E22: dlouhé kontroly a vydání | 2–4 dny |
| **Celkem** | **24–43 dnů**, před rezervou na neúplná data a složitá křížení |

Po E14 zpřesnit náročnost podle počtu problematických objektů; po E16 podle ceny integrace jednoho celého mostu; po E20 podle práce na jednom uličním bloku. Příprava snímků a referencí může zkrátit kalendářní dobu, ale nesmí předběhnout kontrolu společných závislostí. Nejsilnější první samostatně hratelný milník je **dokončený Wilsonův most s okolními konstrukcemi po E16**.

| Rozhodnutí | Kdy | Výchozí postup |
| --- | --- | --- |
| Opakovaná ID a více částí staveb | E14 | Zachovat části; sloučit pouze prokázané duplicity. |
| Měřená konstrukce nesedí na současný profil | E16/E17 | Prověřit CRS, Bpv, datum a vazbu k silnici. Opravit lokálně celý související celek; sporný objekt nezapínat. |
| Zdrojové snímky se barevně nebo časově rozcházejí | E18/E19 | Sjednotit zpracování, maskovat problematickou oblast; nezkreslovat geometrii kvůli fotografii. |
| Základ nebo detail překročí rozpočet | E15/E19 | Zjednodušit data a LOD; až podle měření rozhodnout o větší změně načítání. |
| Fotografie nebo městská sada má nevyjasněné podmínky dalšího šíření | Před použitím konkrétního podkladu | Navázat na existující evidenci licencí, dohledat podmínky konkrétní distribuce nebo použít vlastní podklad. Nezastavuje to nezávislé práce. |

## 11. Podklady a místa v projektu

Externí podklady byly při přípravě ověřeny 17. listopadu 2026. Podmínky konkrétních nově převzatých souborů zaznamenat při jejich získání.

- [Městská sada centra 2024](https://opendata.plzen.eu/public/opendata/detail/37) a [popis 3D modelu města](https://mapy.plzen.eu/o-gis/nase-projekty/3d-model-mesta/): měřené budovy i další konstrukce; zdroj se vztahuje k roku 2024.
- [Otevřená data Zeměměřického úřadu](https://ags.cuzk.gov.cz/opendata/): informace o distribuci dat, výřezech ortofota a CC BY 4.0.
- [Evidence modelů a podmínek v projektu](aktualizace-2026-11-17/volne-modely-pro-plzen-naplno.md): existující poznámky k jednotlivým podkladům a nejednoznačnostem městských podmínek.
- [Měřené centrum](E05-mesto.md), [výchozí styl](E05.md), [krajina](krajina.md), [závěrečné ověření E12](E12.md), [poslední opravy](aktualizace-2026-11-17/README.md).
- Převod: `tools/coordinates.py`, `tools/build_heritage.py`, `tools/build_city.mjs`, `tools/city_surfaces.mjs`, `tools/build_grade_separations.py`.
- Běh hry: `src/data.js`, `src/world/world.js`, `src/world/chunks.js`, `src/world/heritage.js`, `src/world/materials.js`, `src/world/rondel.js`, `src/game/game.js`.
- Ověření: `tests/world.test.js`, `tests/grade-separations.test.js`, `tests/e2e/heritage.spec.js`, `tests/e2e/rondel.spec.js`, `tests/e2e/grade-separations.spec.js`, `tools/measure_map.mjs`, `tools/archive_release.py`.

Inspirace HrejBrno 2 je zde přeložena do návrhu pro aktuální architekturu Plzně naplno. Konkrétní datový formát, kolizní řešení a pořadí etap jsou návrhem tohoto plánu, nikoliv tvrzením o vnitřní implementaci HrejBrno 2.
