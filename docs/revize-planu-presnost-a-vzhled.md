# Revize plánu „Přesnější stavby a hezčí město“

Posuzovaný dokument: [plan-presnost-a-vzhled.md](plan-presnost-a-vzhled.md), revize `baa7595`.
Revize vznikla 17. listopadu 2026. Fakta v ní jsou ověřená nad kódem, distribuovanými daty,
staženým archivem města a stahovací službou ČÚZK. Návrhy jsou označené jako návrhy; ty, které
mění chování hry, je potřeba nejdřív vyzkoušet na pilotu.

## Shrnutí

Plán je pečlivý a jeho výchozí tvrzení sedí. Všechny počty ze zdrojového archivu jsem
přepočítal a souhlasí. Na několika místech ale volí zbytečně těžkou a rizikovou cestu:

1. **Wilsonův most není potřeba „vyměnit“, stačí ho doladit.** Herní most už dnes odpovídá
   měření: výška mostovky se liší nejvýš asi o 0,2 m, šířka mezi zábradlími je 15 m v obou
   případech a uprostřed stojí jeden pilíř. Měřená data stačí použít pro vzhled zábradlí,
   oblouků, pilíře a opěr. Fyzika jízdy zůstane beze změny. Tím odpadá nejrizikovější část
   plánu: výměna jízdních povrchů, nájezdů a návazností MHD.
2. **Nový kolizní systém není nutný.** Kolize budov už mají výšku od–do, pochozí vršek a test
   kamery. Zdi, pilíře a zábradlí se do nich dají vložit jako další mnohoúhelníky.
3. **Ortofoto se dá vkreslit do textury země, kterou hra už pro každou dlaždici kreslí.**
   Nepotřebuje nový shader, masku ani další paměť grafiky. Pro „vzdálený pohled“ stačí
   2 m na pixel, což je asi 11 MiB. Plán počítá s 1 m nebo 0,5 m na pixel, tedy zhruba
   45 nebo 180 MiB. Dnes mají všechna herní data asi 48 MB.
4. **Pořadí jde zkrátit.** Ortofoto ani ulice nezávisí na mostech. Ortofoto může přijít jako
   první: je to rychlý viditelný výsledek a nesahá na fyziku.
5. **Navržené měření výkonu regresi nepozná.** Měří interval snímků, který je na referenčním
   Macu zastropovaný obnovovací frekvencí displeje (16,7 ms). Navrhuji měřit skutečnou práci
   snímku a v CI hlídat počty vykreslovacích volání.
6. **Jednotkou práce nemá být ID objektu.** Některá ID sdružují zdi a mosty podél řeky
   v délce až 1,85 km. Pracovat je potřeba po souvislých dílech.

Podle mého odhadu tyto změny zkrátí práci zhruba o čtvrtinu až třetinu. Jde o odhad, ne o měření.

## Co jsem ověřil

| Tvrzení nebo otázka | Výsledek |
| --- | --- |
| Archiv `plzen-2024-shp.zip` (opendata.plzen.eu, soubor 430) | Staženo 15 852 799 B. SHA-256 `825dc3e3…7bb9ac` **souhlasí** s plánem. |
| 614 záznamů, 602 ID, 12 315 ploch, počty druhů ploch | **Souhlasí** přesně (7 050 zdí, 2 993 mostů, 1 026 zábradlí, 682 pilířů…). |
| Proč 614 záznamů a jen 602 ID | **Vyřešeno:** všech 12 opakovaných ID patří dlouhým souborným objektům (1,06–1,85 km). Každý je rozdělený do dvou záznamů. |
| Druhy objektů podle převažující plochy | 422 zdí, 79 zábradlí, 44 pilířů, 41 mostů, 6 protihlukových stěn, 6 ostatních, 2 nádrže, 1 jez, 1 komín. Plochu mostu má 42 objektů. |
| Je ve zdroji Wilsonův most? | **Ano**, objekt `00000002021000450` (31 ploch mostu). Zábradlí jsou samostatné objekty `…069` a `…070`, pilíř `…213`. |
| Výškový systém vrstvy objektů | Soubor `.prj` vrstvy objektů **neuvádí výškový systém** (budovy uvádějí Baltic). U Wilsonova mostu výšky odpovídají Bpv, proto je ověření nutné provést měřením na místě. |
| Sedí mosty ze zdroje na herní mosty? | 27 ze 42 objektů s plochou mostu leží do 15 m od osy silničního mostu ve hře. Zbytek nebyl porovnán; pravděpodobně jde o železniční mosty a lávky mimo silniční síť. |
| `build_heritage.py` čte jen budovy | **Souhlasí** (`*_budovy_3D_MultiPatch.shp`). |
| Kolize zábradlí na mostech | **Neexistují.** `deckAt()` hlídá jen poloviční šířku mostovky; zábradlí je pouze vykreslené. README uvádí pád z mostu jako vlastnost hry. |
| Kruhové překážky bez výškového intervalu | Souhlasí: kruhy sahají pevně 2,5 m nad terén. **Kolize budov ale interval mají** (`bBase`–`bTop`), včetně střech a testu kamery. |
| Ortofoto ČÚZK | Stahovací služba ATOM nabízí JPEG po listech SM5 (2,5 × 2 km, 20 000 × 16 000 px, **0,125 m/px**, S-JTSK + JGW). Území hry pokrývá **158 listů ze snímkování 2025**, dohromady **9,1 GiB**. |
| Měření výkonu E12 | `tools/measure_map.mjs` měří intervaly `requestAnimationFrame`, které jsou na Macu svázané s displejem 60 Hz. Hodnota p95 16,7 ms je strop displeje, ne rezerva hry. |
| Výchozí stav projektu | 28/28 testů JavaScriptu, 13/13 Pythonu a 34/34 prohlížečových testů prošlo, sestavení bez chyby. |

## 1. Stavební objekty

### 1.1 Pracovat po souvislých dílech, ne po ID

Plán chce dlouhý objekt držet jako „jeden logický objekt“ a v prostorovém indexu registrovat
celý jeho rozsah. Ve zdroji je ale 25 objektů rozsáhlejších než 300 m; nejdelší má 1 853 m.
Jde o skupiny zdí, jezů a mostů podél řeky, které nejsou jedna stavba. Registrace podle celé
obálky by takovou skupinu zapsala do stovek buněk mřížky.

**Návrh:** Při převodu rozdělit plochy na souvislé díly (plochy, které se dotýkají nebo jsou od
sebe do 0,5 m). Díl dostane identitu `ID + pořadí dílu`, stabilní podle otisku geometrie.
Inventura, rozhodnutí a kolize se vedou po dílech. Původní ID zůstane jako odkaz na zdroj.

### 1.2 Wilsonův most: doladit místo výměny

Srovnání herního mostu (silnice č. 19 v `roads.bin`) s měřeným objektem:

| Údaj | Hra dnes | Měření 2024 |
| --- | --- | --- |
| Výška mostovky (herní metry) | −2,06 až −2,24 | vršek −1,95 až −2,32 |
| Šířka mezi zábradlími | 15,0 m (pevně v `deckHalfWidth`) | 15,0 m |
| Osa | podle OSM | posunutá asi o 0,6 m |
| Délka | 62,2 m (úsek OSM) | mostovka 57 m, zbytek tvoří opěry |
| Pilíř | 2 oblouky, tedy 1 pilíř uprostřed | 1 pilíř uprostřed, pata −13,3 m |
| Zábradlí | výška 0,95 m, tloušťka 0,32 m | výška asi 1,15 m, půdorys 1,3–1,4 m |

Herní fyzika mostu tedy už odpovídá skutečnosti a liší se hlavně vzhled. Plán přitom pro E16
počítá s úplnou náhradou mostu „včetně nájezdů a návazností“. To je nejdražší a nejrizikovější
část celé práce. Ohrožuje i dřívější opravy Rondelu a mimoúrovňových křížení, které jsou vázané
na indexy objektů.

**Návrh: kalibrace místo náhrady.**

- Jízdní povrch dál počítat z profilu silnice. Z měření převzít jen opravy parametrů: výškový
  profil, šířku, případný posun osy a polohu pilířů. Mostovku pak kreslí stávající kód ze
  stejného profilu, takže viditelný a fyzický povrch se shodují automaticky.
- Měřenou geometrii použít jen pro části, po kterých se nejezdí: boky, oblouky, pilíř, opěry
  a zábradlí. Z měřeného modelu vynechat horní plochu mostovky.
- Pevně zapsanou šířku Wilsonova mostu v `deckHalfWidth()` nahradit hodnotou z převodu.

Stejný postup platí pro zbylých zhruba 40 mostních objektů. Úplnou náhradu povrchu použít jen
tam, kde se měření od hry liší natolik, že kalibrace nestačí. Kritériem může být například
rozdíl výšky nad 0,5 m nebo jiný půdorys.

### 1.3 Kolize: využít kolize budov

Plán navrhuje nový modul `structure-surfaces.js` s vlastními výškovými kolizemi a testem
kamery. Stávající kolize budov už umí to podstatné:

- mnohoúhelník s výškou od–do (`bBase`, `bTop`), takže zábradlí na mostě může mít spodek ve
  výšce mostovky a nepůsobí pod ním,
- pochozí vršek (`roofAt`), takže na zídku jde vylézt,
- test kamery (`raycast`).

**Návrh:** V pilotu vložit zdi, pilíře a zábradlí jako další položky do kolizní mřížky budov
(při startu, z kompaktního základního balíčku). Ověřit vedlejší účinky: minimapu, poškození
auta při nárazu, výběr budov pro zakázky a vyhodnocení objektů v `heritage.replaced`. Pokud se
objeví překážka, která se do tohoto modelu nevejde, rozšířit ho až na základě konkrétního případu.

### 1.4 Zdi a pilíře hromadně, s automatickou kontrolou střetů

Plán navrhuje dávky po 10–30 objektech, každou s vlastním ověřením. Pro 422 zdí, 79 zábradlí
a 44 pilířů to znamená desítky ručních kol.

**Návrh:** Zdi, pilíře a zábradlí stojící na zemi převést najednou. Každý díl automaticky
otestovat proti:

- osám pojízdných silnic a kolejí (díl nesmí zasahovat do průjezdného profilu),
- pěším cestám a přechodům,
- zastávkám MHD a jejich dveřím, cílům zakázek, místům pro vznik aut a heliportům,
- uloženým výchozím pozicím (start, garáž).

Ručně posoudit jen díly, které test označí, a dále mosty, nádrže, jezy a `Ostatni`. Výsledek
testu je zároveň inventura: díl je buď začleněný, nebo má konkrétní důvod vyřazení.

### 1.5 Zábradlí na všech mostech (rozhodnutí)

Dnes se z každého mostu dá sjet bokem, protože zábradlí nemá kolizi. README to uvádí jako
vlastnost hry. Plán u Wilsonova mostu mluví o „funkčních chodnících a zábradlí“.

Obecné řešení pro všech 958 herních mostů je jednoduché. Okraje mostovky už jsou v
`bridgeSeg`, takže stačí kolize podél nich, nezávisle na městských datech. Možnosti:

- zábradlí zastaví chodce i auta,
- zastaví chodce a auto ho při vysoké rychlosti prorazí,
- zůstane jako dnes.

Toto rozhodnutí patří autorovi hry, ne plánu.

**Rozhodnuto 17. 11. 2026:** zábradlí zastaví chodce. Chování aut a provedení kolizí řeší
návrh [fyziky a grafiky](fyzika-a-grafika.md). Pokud se zavede fyzikální knihovna, zdi,
pilíře a zábradlí z části 1.3 půjdou rovnou do ní, ne do kolizí budov.

## 2. Ortofoto

### 2.1 Zdroj

Ortofoto ČR je od 1. 7. 2023 otevřenými daty pod licencí CC BY 4.0. Stahovací služba ATOM
(`atom.cuzk.gov.cz/ORTOFOTO/ORTOFOTO.xml`) nabízí každý list SM5 jako ZIP s JPEG a souřadnicovými
soubory. Hlavní soubor JGW je v S-JTSK, další dva v ETRS89/TM33 a TM34. U ověřeného listu
Blovice 4-0 je rozlišení 0,125 m/px. Všech 158 listů na území hry pochází ze snímkování 2025,
takže barevné rozdíly mezi roky odpadají; mezi letovými pásy je ještě potřeba je zkontrolovat.

Pozor: pole `rights` ve službě ATOM uvádí „žádné podmínky neplatí“, obecné podmínky ČÚZK ale
CC BY 4.0. Uvést ČÚZK jako zdroj tak jako tak; hra ho už uvádí u výškopisu.

### 2.2 Rozlišení a velikost

Změřeno na listu Blovice 4-0 (2,5 × 2 km), zmenšeném z 0,125 m/px:

| Rozlišení | WebP (kvalita 75) | JPEG (kvalita 80) | Otevřená krajina 277 km² | Celá mapa 653 km² |
| --- | --- | --- | --- | --- |
| 0,5 m/px | – | – | odhadem ~180 MiB | ~420 MiB |
| 1 m/px | 165 KiB/km² | 226 KiB/km² | ~45 MiB | ~105 MiB |
| 2 m/px | 41 KiB/km² | 56 KiB/km² | **~11 MiB** | ~26 MiB |
| 4 m/px | 9 KiB/km² | 13 KiB/km² | ~2,5 MiB | ~6 MiB |

Otevřenou krajinu tvoří pole (217 km²), louky (49 km²), tráva (7 km²) a křoviny (4 km²)
podle `land.bin`. Lesy (307 km²) pokrývají 3D stromy.

Plánovaný rozpočet hlídá paměť grafiky, ale ne velikost distribuce a repozitáře. Git si každou
verzi binárních souborů pamatuje navždy, takže rozlišení 1 m a 0,5 m by repozitář během pár
oprav zvětšilo na násobky.

**Návrh:** Distribuovat ortofoto ve 2 m/px a balit ho po blocích 4 × 4 dlaždic (1 024 m,
512 × 512 px, asi 40 KiB na soubor). Jemnější rozlišení použít jen tam, kde pilot ukáže
viditelný přínos. Před převzetím do repozitáře zvolit rozlišení napevno, ať se velká data
nepřepisují opakovaně.

### 2.3 Vkreslit ortofoto do stávající textury země

Hra každé dlaždici kreslí texturu země na 2D plátno (`drawGround()` v `chunks.js`): 512 px
na 256 m zblízka a 256 px zdálky. Nejdřív vyplní plochy území barvami a řádky polí, potom
přes ně kreslí vodu, potoky, cesty a silnice.

**Návrh:** Ortofoto vkreslit do tohoto plátna hned po plochách, oříznuté na otevřenou krajinu.
Vodu, cesty a silnice pak hra kreslí přes ně jako dnes. Barvu sladit s malovaným stylem při
kreslení, třeba částečnou průhledností, režimem prolnutí s barvou plochy nebo sníženou sytostí.

Co tím z plánu odpadá:

- samostatná textura masky a nový kanál materiálu (část 4.3, body 3 a 5),
- míchání podle vzdálenosti s hysterezí (bod 6), protože blízká i vzdálená verze dlaždice se
  kreslí stejně, jen v jiném rozlišení,
- dodatečných 64/16 MiB paměti textur, protože se používá stejná textura jako dnes,
- riziko porušení vody v alfa kanálu: voda se z plátna vyřezává až na konci kreslení
  (`destination-out`), takže ji ortofoto nezmění.

Zbývá vyřešit jedno: plátno se kreslí synchronně při stavbě dlaždice. Blok ortofota se proto
musí stahovat předem, nebo se dlaždice po jeho příchodu jednou překreslí. Dekódovaný blok
uvolnit hned po vykreslení jeho dlaždic.

### 2.4 Zpracovat po listech

Surová data mají 9,1 GiB. Převodní nástroj by měl list stáhnout, zmenšit, uložit výsledek
a list smazat, aby se na disku nikdy nedržela všechna data najednou. Do evidence zapsat pro
každý list jeho URL, velikost, datum aktualizace a SHA-256.

## 3. Ulice

- **E20 nemá záviset na E19.** Blok Americké leží v centru, kde se ortofoto maskuje. Na mosty
  navazuje jen roh u Wilsonova mostu. Průčelí, dlažbu a vybavení bloku lze dělat hned po E13
  a roh dokončit až po mostu.
- **Předlohy fotografovat vlastním telefonem.** Je to nejjednodušší cesta k fotkám bez
  licenčních otázek. Fotky slouží jako předloha pro vlastní stylizaci, do textur se nevkládají.
  Ke každé zapsat datum a místo.

## 4. Výkon a testy

- **Měřit skutečnou práci snímku.** K současnému měření přidat čas `game.update()` a
  `render()` přes `performance.now()`, kde to jde i čas GPU (`EXT_disjoint_timer_query_webgl2`).
  Prohlížeč spouštět bez vazby na displej (`--disable-gpu-vsync --disable-frame-rate-limit`).
- **V CI hlídat počty.** Z `renderer.info` zaznamenat počet vykreslovacích volání, trojúhelníků,
  textur a geometrií na pevných pozicích kamery. Hodnoty jsou stejné i se SwiftShaderem, takže
  je CI může hlídat při každé změně. Rozpočet například +10 % proti referenci.
- **Počítat s automatickým snižováním kvality.** `Game.adapt()` při FPS pod 30 snižuje
  rozlišení a pod 24 vypíná stíny. Na slabším zařízení tak FPS zůstává podobné, i když hra
  zpomalila. Při měření zapisovat i výsledné rozlišení a stav stínů, případně adaptaci vypnout.
- **Skutečný telefon.** Stačí nasadit náhled hry a otevřít ho na vlastním telefonu. Hra už FPS
  počítá (`game.fps`), stačí ho v debug režimu zobrazit. Výsledek zapsat i s modelem telefonu
  a prohlížečem.
- Prohlížečové testy v tomto cloudovém prostředí vyžadují
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium`. Konfigurace to už umí;
  jen to zapsat do postupu.

## 5. Navržené pořadí

Čísla etap by se přečíslovala. Původní označení jsou v závorce.

| Pořadí | Etapa | Poznámka |
| --- | --- | --- |
| 1 | Výchozí stav (E13) | Testy, archiv a inventura jsou ověřené touto revizí. Zbývají referenční snímky a měření výkonu novou metodou. |
| 2 | Ortofoto offline i ve hře (E18 + E19) | 2 m/px, vkreslené do textury země. Dva piloty (Rokycany, Klabava), potom celá mapa. |
| 3 | Převod konstrukcí (E14) | Po souvislých dílech, s automatickou zprávou o střetech. |
| 4 | Zdi, pilíře a opěry (část E15 a E17) | Hromadně, přes kolize budov. |
| 5 | Mosty kalibrací (E15 + E16 + část E17) | Nejdřív Wilsonův most, potom zbylé mosty. Zábradlí podle rozhodnutí v 1.5. |
| 6 | Blok Americké (E20) | Průčelí lze začít souběžně od kroku 2, roh u mostu až po kroku 5. |
| 7 | Dřevěná a okolí nádraží (E21) | Beze změny. |
| 8 | Vydání (E22) | Beze změny. |

Odhad v „pracovních dnech jednoho vývojáře“ navrhuji nahradit milníky s viditelným výsledkem.
Práci dělá AI podle zadání, takže počet dnů vývojáře neodpovídá skutečnému průběhu.

## 6. Drobné opravy textu plánu

- Část 2: doplnit, že 614/602 je vyřešené (viz výše), že vrstva objektů nemá výškový systém
  v `.prj` a že Wilsonův most ve zdroji je. Tyto body v E13 odpadají.
- Část 4.2, rozhodnutí „Opakovaná ID“: rozhodnutí je dané, jde o rozdělené souborné objekty.
- Část 6: přidat rozpočet velikosti distribuce a repozitáře.
- Část 7, kritérium „shoda viditelného a fyzického povrchu do 5 cm“: při kalibraci platí
  automaticky. Přidat srovnání se zdrojem, například výšku mostovky do 0,1 m od měření.
- Část 8, bod 5: `archive_release.py` opravdu používá pevnou příponu `-E12`.

## Rozhodnutí pro autora

1. ~~Mají zábradlí na mostech zastavit chodce, auta, nebo obojí? (1.5)~~ Zastaví chodce.
2. Stačí ortofoto ve 2 m/px, nebo chceš jemnější za cenu desítek MiB navíc? (2.2)
3. Má ortofoto přijít jako první, před mosty? (5)
4. Můžeš nafotit blok Americké a okolí jako předlohy? (3)

## Jak jsem ověřoval

- Archiv města stažený z `https://opendata.plzen.eu/public/opendata/download-file/430` a
  přečtený knihovnou pyshp. Souřadnice převedené přes EPSG:5514 → WGS 84 → `tools/coordinates.py`.
- Herní mosty přečtené přímo z `public/data/roads.bin`, plochy území z `public/data/land.bin`.
- Ortofoto: přehled služby ATOM (16 301 listů ČR), velikosti 158 listů z jejich záznamů,
  jeden list stažený a zmenšený nástrojem Pillow.
- Neověřeno: železniční mosty, skutečný vzhled ortofota ve hře a vedlejší účinky vložení zdí
  do kolizí budov. To mají ukázat piloty.
