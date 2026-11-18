# Katalog vylepšení fyziky a grafiky

Verze 2 z 18. listopadu 2026. Každé vylepšení má označení. Na označení odkazují
[plán](plan-presnost-a-vzhled.md) a [zadání etap](codex/README.md). Rozhodnutí autora:
WebGPU, fyzika Jolt, zábradlí zastaví chodce, vybavení ulic se dá zničit.

Položky fyziky a grafiky jsou **navržené**. Etapa, která položku dokončí, změní stav na
„hotovo“ nebo uvede důvod odložení.

**Příprava ověření (E13) je hotová.** Výchozí vzhled zachycuje osm pohledů. Test na třech
z nich hlídá rozpočet vykreslování. Panel F9 a příkaz `--work` umožňují porovnat práci
snímku v dalších etapách. [Výchozí hodnoty a pohledy](E13.md).

**Aktualizace knihovny (E14) je implementovaná.** Hra přešla na three.js 0.187.0 se
stávajícím WebGLRendererem. Kontroly hlídaly všechny náhrady shaderů, osm snímků
dokládá zachování vzhledu s drobnými rozdíly ve stínech. Rozpočty jsou po souhlasu
autora přepočtené z E13 včetně stínů, stále s limitem +10 %. Ruční měření obou verzí
udrželo přibližně 60 FPS bez pozorovaného zadrhávání, část časů však zůstává vyšší
a p95 GPU je mírně nad pracovní mezí. [Protokol a známé odchylky](E14.md).
Navržené grafické položky tím nejsou označené za dokončené; čekají na své etapy.

**Přechod na WebGPU (E15) je hotový.** Vlastní materiály oblohy, světa a modelů
používají TSL. Hra při chybějící podpoře WebGPU přechází na WebGL 2.
Rozpočet vykreslování hlídají oba prohlížečové projekty. [Protokol E15](E15.md).

**Ortofoto otevřené krajiny (E16) je hotové.** Pole, louky, travnaté plochy a křoviny
využívají snímky ČÚZK ve 2 m na pixel. Měkké prolnutí zachovává malované barvy hry.
Vrstva se načítá za běhu a je samostatně vypínatelná. [Protokol E16](E16.md).

**Světlo a obraz (E17) jsou hotové.** Povrchy reagují na světlo podle materiálu. Obloha
sleduje datum a čas v Plzni. Čtyři předvolby určují kvalitu stínů, záře a vyhlazování.
[Protokol a měření E17](E17.md).

## Stav po E17 (ověřeno v kódu)

- **Fyzika:** auto se otáčí podle natočení kol a boční skluz se tlumí. Nemá hmotnost,
  zavěšení ani pneumatiky (`stepDynamic()` ve `vehicles.js`). Náklony jsou vizuální,
  kolize řeší tři kruhy. Vrtulník a chodci mají zjednodušený pohyb. Krok se mění se snímkem.
- **Grafika** používá three.js 0.187.0 s WebGPU a záložním WebGL 2, fyzikálně založené
  povrchy, stíny podle předvolby a samostatný průchod obrazových efektů. Vnitřní
  rozlišení se řídí naměřenou prací snímku (`Game.adapt()`).

## Měření fyzikálních knihoven

Měřeno 17. 11. 2026 na cloudovém serveru (Intel Xeon 2,1 GHz, jedno vlákno, Node 22).
Scéna: terén 1 km² po 2 m, 400 budov, auta se čtyřmi koly, chodci a volné předměty.
Čas je pro jeden krok simulace při 60 Hz.

| Scéna | Jolt 1.1.1 (motor, převodovka, `CharacterVirtual`) | Rapier 0.21 (paprskové zavěšení) |
| --- | --- | --- |
| 15 aut, 100 předmětů, 20 chodců | 1,2 ms (p95 1,7 ms) | 2,1 ms (p95 3,2 ms) |
| 40 aut, 300 předmětů, 40 chodců | 3,0 ms (p95 4,3 ms) | 5,3 ms (p95 7,4 ms) |
| 80 aut, 800 předmětů, 60 chodců | 5,9 ms (p95 8,9 ms) | 8,4 ms (p95 11,6 ms) |

Jolt vyšel rychlejší i s úplnějším modelem auta. Motory v testu dosahovaly 1 100–6 000
otáček za minutu a auta zůstala na terénu. Test neověřoval jízdní vlastnosti; ty mají
vlastní metriky v plánu.

## Fyzika

E18 zavádí F01–F05 a F14 pro hráčovo auto. Má automatickou převodovku, čtyři
suché povrchy a dvě volby řízení. Mokro a sníh přidá E24. Fyzika chodců
a ničitelné vybavení mají vlastní etapy. [Výsledky jízd a měření](E18.md)

| ID | Vylepšení | Co hráč pozná | Jak | Etapa |
| --- | --- | --- | --- | --- |
| F01 | Pevný krok a interpolace | plynulý a stejný pohyb při 30 i 144 FPS | střádač času, krok 1/60 s, nejvýš 4 kroky za snímek, interpolace polohy a natočení pro vykreslení | E18 |
| F02 | Fyzikální okruh | svět je pevný kolem hráče a výkon nezávisí na velikosti mapy | statické kolize dlaždic do 384 m: terén ze stejných trojúhelníků jako vykreslení (s otvory u portálů), budovy jako hranoly se střechami podle `roofAt()`, mostovky z profilů, tunely Valíku | E18 |
| F03 | Vrstvy kolizí | zábradlí drží chodce; úlomky nezastaví postavu | tabulka vrstev v plánu (část 3.2) | E18 |
| F04 | Auto hráče | váha, přenos hmotnosti, smyk, pérování, převodovka, zvuk podle otáček | `WheeledVehicleController`: křivka motoru, automatická převodovka (volitelně ruční), diferenciál, stabilizátory, tření podle povrchu (asfalt 1,0; dlažba 0,9; mokro 0,7; štěrk 0,6; tráva 0,5; sníh 0,35) | E18 |
| F05 | Typy aut a asistence | každý typ jezdí jinak; volba „arkádové“ nebo „realistické“ řízení | parametry pro osm typů z `CAR_TYPES` (hmotnost, točivý moment, pohon přední/zadní/4×4, převody podle `maxSpeed`). Arkádový režim přidává ABS, kontrolu trakce, stabilizaci a vyšší přilnavost. Úpravy z garáže mění brzdy a pneumatiky. | E18 |
| F06 | Postava | chůze po schodech, svazích a střechách; zábradlí drží; postava odstrčí lehké předměty | `CharacterVirtual` se zachovanými rychlostmi z `player.js` a omezenou silou | E19 |
| F07 | Ragdolly | sražený chodec i hráč padá podle nárazu a pak vstane | `Ragdoll` z 11 částí podle modelu chodce; omezený počet podle předvolby | E19 |
| F08 | Provoz ve fyzice | srážky s auty provozu jsou skutečné; vozy se po nárazu odhodí a otočí | auta do 150 m přejdou na fyziku, nad 220 m zpět. Řidič AI dává plyn, brzdu a řízení podle trasy a pravidel; zaparkovaná auta spí a jdou odtlačit. | E20 |
| F09 | MHD a policie | tramvaj auto odstrčí; policie honí fyzikálním autem | tramvaje a autobusy jako těžká kinematická tělesa na trase; směny MHD dál s jednorozměrným modelem adheze; policejní vozy ve fyzice | E20 |
| F10 | Vrtulník | let s váhou a setrvačností, přistání na střeše, tvrdý dopad | těleso s tahem rotoru, kolektivem, cyklikou, ocasním rotorem a přízemním efektem; asistence vyrovnání a držení výšky (výchozí zapnuto) | E20 |
| F11 | Voda | auto v řece plave, nabírá vodu a potopí se; postava plave ke břehu | `ApplyBuoyancyImpulse` nad vodními plochami, výška hladiny ze stejného zdroje jako vykreslení vody | E20 |
| F12 | Ničitelné vybavení | lampy, značky, semafory, sloupky, zábradlí a zábrany se ulomí, ohnou nebo převrhnou | celek je statické těleso. Při nárazu nad prahem ho nahradí dynamické díly (stožár, hlava lampy, úsek zábradlí); značky se ohnou na pružném kloubu. Zničený semafor přestane řídit křižovatku. Poškození veřejného majetku zvyšuje hledanost. Opraví se v 4:00 dalšího herního dne. | E21 |
| F13 | Poškození aut | promáčknutí v místě nárazu, odpadlé díly, kouř, slabší motor, tah řízení | deformace vrcholů karoserie, odpadávající nárazníky, kapota a dveře jako úlomky, mechanické následky podle zdraví, oprava v garáži | E21 |
| F14 | Diagnostika | autor může zobrazit kolize a výkon fyziky | `?debug` přidá drátový pohled na kolize a panel s časem kroku a počty těles | E18 |

**Výchozí prahy zlomení (F12)** jsou impulz v N·s, odhadnutý z redukované hmotnosti a
rychlosti nárazu. Ladí se v E21.

| Objekt | Ohnutí | Zlomení | Poznámka |
| --- | --- | --- | --- |
| uliční lampa | – | 6 000 | auto zhruba od 20 km/h |
| dopravní značka | 2 500 | 9 000 | ohnutí na kloubu u země |
| semafor | – | 15 000 | vypne řízení křižovatky |
| sloupek | – | 8 000 | |
| ocelové zábradlí mostu | – | 12 000 na úsek 2,5 m | chodce udrží vždy |
| kamenné zábradlí (Wilsonův most) | – | 30 000 | odlomí se po kusech |
| zábrana uzavírky | – | – | lehké dynamické těleso, jde odtlačit |
| lavička, koš | – | 3 000 / 800 | od E25, kde přibude vybavení ulic |

**Co v prohlížeči nedělat:** plnou deformaci karoserie jako BeamNG u celého provozu, ničení
budov ani simulaci tekutin.

## Grafika

Předvolby kvality jsou **U** ultra, **V** vysoká, **S** střední a **N** nízká. Automatika
spouští první měření na vysoké předvolbě na počítači a na nízké na telefonu. Moduly jsou
ověřené v three.js 0.187.

### Světlo a obraz (E17)

| ID | Vylepšení | Co je vidět | Jak (three.js 0.187) | Předvolby | Stav |
| --- | --- | --- | --- | --- | --- |
| G01 | Fyzikálně založené materiály | lesk aut, skla a kovu, matná omítka, asfalt a dlažba | `MeshStandardNodeMaterial` s tabulkou drsnosti a kovovosti, barvy ve vrcholech zůstávají jako albedo | U V S N | hotovo |
| G02 | Obloha a světlo z oblohy | obloha a odrazy podle času, barevné ranní a večerní světlo, měsíc a hvězdy | `SkyMesh` podle data a času, mapa světla se postupně přepočítá při posunu slunce o 2° nebo po 10 herních minutách | U V S N | hotovo |
| G03 | Kaskádové stíny | drobné stíny v popředí i stíny budov a stromů v dálce | `CSMShadowNode` s mapami U 4 × 2048, V 3 × 2048, S 2 × 1024 | U V S | hotovo |
| G04 | Kontaktní zastínění | stín u paty domu, pod autem a v koutech | `GTAONode` v poloviční velikosti s odšuměním | U V | hotovo |
| G05 | Barevné ladění | malovaný vzhled ve dne, za soumraku i v noci | výchozí ACES a `Lut3DNode` s plynulou směsí tří vlastních tabulek v `public/luts/` | U V S N | hotovo |
| G06 | Vzdušná perspektiva a mlha v údolích | opar v dálce a ranní mlha nad Radbuzou, Mží a Berounkou | výšková mlha zbarvená oblohou, opar podle ranního času a blízkosti vody | U V S N | hotovo |
| G07 | Záře světel | záře lamp, oken, světlometů a odlesků slunce | `BloomNode` s prahem podle světla, vyzařující materiály | U V S | hotovo |
| G08 | Vyhlazování | hladší hrany | U a V používají `TRAANode`, S `SMAANode` a N `FXAANode` | U V S N | hotovo |
| G09 | Předvolby a dynamické rozlišení | volba kvality v menu a plynulejší obraz při velké zátěži | automatická volba podle zařízení a práce prvních 10 s, vnitřní rozlišení 60–100 % maxima předvolby | U V S N | hotovo |
| G10 | Adaptace oka | jas se postupně přizpůsobí při vjezdu do Valíku a po výjezdu | automatická expozice z průměrného jasu scény | U V S | hotovo |

### Krajina, voda a noc (E23)

| ID | Vylepšení | Co bude vidět | Jak | Předvolby |
| --- | --- | --- | --- | --- |
| G11 | Terén zblízka | tráva, hlína, štěrk a brázdy polí zblízka, ne jen barva | opakované detailní textury podle třídy plochy (maska z plátna dlaždice), normálové mapy, trojrozměrné mapování na prudkých svazích | U V S |
| G12 | Silnice a chodníky | asfalt se strukturou, vyjeté koleje, záplaty, kanály, ostré čáry | PBR asfalt s normálou a drsností, opotřebení podle tříd silnic, navázání na mokro | U V S N |
| G13 | Řeky a rybníky | tekoucí voda ve směru toku, odrazy břehů a mostů, pěna u jezů | vodní uzlový materiál s normálovými vlnami podle směru toku z OSM, Fresnel, `SSRNode` (U), odraz prostředí (V, S); pěna a sprška u jezů ze `sound-places.json` | U V S N |
| G14 | Stromy | různé druhy, vítr, podzimní barvy podle data ve hře | modely blízko a impostory v dálce, kývání ve větru, sezónní barva a opad podle herního kalendáře | U V S N |
| G15 | Tráva | louky a parky s trávou u kamery | instancovaná stébla do U 80 m, V 50 m, S 30 m, s větrem | U V S |
| G16 | Noční město | lampy opravdu svítí na ulici a auta, okna se rozsvěcují podle času | `ClusteredLighting`: U 256, V 128, S 48 světel u kamery, dál zůstávají světelné skvrny; rozvrh oken podle hodiny | U V S |
| G17 | Částice | prach z polí, jiskry při drhnutí, kouř z rozbitých aut, střepy, šplouchnutí | částice na GPU (výpočet v TSL) se společným rozpočtem; na záložním WebGL 2 jednodušší instancované částice | U V S N |

### Budovy, vozidla a počasí (E24)

| ID | Vylepšení | Co bude vidět | Jak | Předvolby |
| --- | --- | --- | --- | --- |
| G18 | Fasády podle čtvrtí | omítky, cihla, panel a kámen podle typu zástavby, sokly a rámy oken | atlas textur CC0 navázaný na `styleFor()` a `Districts`, normálové mapy, zarovnání na mřížku oken (`wu`, `wv`) | U V S N |
| G19 | Okna s interiéry | za okny jsou vidět pokoje, kanceláře a obchody, v noci se rozsvěcují | interior mapping (paralaxa místností) s několika variantami a závěsy | U V S |
| G20 | Střechy | tašky, plech, měď a lepenka s plastickou strukturou | materiály podle materiálu střechy z mapy, normálové mapy | U V S N |
| G21 | Auta | metalický lak, odrazy, chrom, světla, brzdová a couvací světla, špína a promáčknutí | `MeshPhysicalNodeMaterial` s clearcoatem, vyzařující světla navázaná na fyziku (brzda, couvání), světlomety jako bodová světla pro hráče a nejbližší auta | U V S N |
| G22 | MHD a postavy | materiály tramvají a autobusů, rozsvícené interiéry a cedule, pestřejší chodci | uzlové materiály, vyzařující panely, varianty oblečení | U V S N |
| G23 | Počasí | déšť, mokré ulice s kalužemi, sníh v zimě, mlha; počasí mění přilnavost aut | stav počasí podle data a náhody; déšť jako částice; dynamická vlhkost (rozšíření `?wet=1`) se schnutím; sněhová pokrývka podle sezóny; tření pneumatik podle F04 | U V S N |
| G24 | Oblaka | objemová oblaka a jejich stíny na krajině | raymarching v nižším rozlišení s časovou reprojekcí; N a S zůstávají u dnešních mraků | U V |
| G25 | Sluneční paprsky a odlesky | paprsky mezi domy a stromy, odlesk slunce | `GodraysNode` (U), `LensflareMesh` (volitelně v nastavení) | U |
| G26 | Fotorežim | volná kamera, hloubka ostrosti, skrytí HUD, uložení snímku | `DepthOfFieldNode`, zastavení času | U V S |
| G27 | Pohybové rozmazání | pocit rychlosti při jízdě a letu (výchozí vypnuto) | `MotionBlur` z vektorů pohybu, které vytváří TRAA | U V |

### Ulice (E25)

Tři úseky z plánu (Americká, Dřevěná a náměstí, okolí nádraží) využijí G01, G18–G20 a
ničitelné vybavení F12: lavičky, koše, přístřešky se sklem a stojany.

## Licence podkladů

Textury, modely a LUT musí mít licenci CC0 nebo CC BY, nebo jít o vlastní tvorbu. Vhodné
zdroje CC0: [ambientCG](https://ambientcg.com), [Poly Haven](https://polyhaven.com),
[Quaternius](https://quaternius.com). Každý podklad se zapíše do README a „O hře“.
Fotografie ulic slouží jen jako předloha; do textur se nevkládají.
