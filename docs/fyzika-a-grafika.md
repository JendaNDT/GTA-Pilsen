# Fyzika a grafika: co prohlížeč zvládne

Návrh ze 17. listopadu 2026. Navazuje na [revizi plánu](revize-planu-presnost-a-vzhled.md).
Cílová zařízení jsou výkonnější počítače a telefony. Nic z tohoto dokumentu zatím není
implementované.

## Výchozí stav (ověřeno v kódu)

**Fyzika** je dnes arkádová:

- Auto se otáčí podle natočení kol a jeho boční skluz se postupně tlumí. Nemá hmotnost,
  zavěšení ani pneumatiky (`stepDynamic()` v `vehicles.js`).
- Náklony karoserie jsou jen vizuální. Výšku auto přebírá ze čtyř bodů povrchu.
- Kolize řeší tři kruhy, které se od překážky odtlačí.
- Vrtulník a chodci mají vlastní zjednodušené pohyby.
- Délka kroku simulace se mění se snímkem (nejvýš 50 ms).

**Grafika:**

- three.js 0.170 (poslední vydání je 0.187) s WebGL.
- Všechny povrchy mají jednoduchý matný materiál (Lambert, ne PBR) s barvami ve vrcholech.
- Jedna stínová mapa 2 048 px, vlastní obloha, žádné postprocesové efekty.
- Šest vlastních úprav shaderů (`onBeforeCompile`) a shader oblohy.
- Při poklesu FPS hra sama snižuje rozlišení a vypíná stíny (`Game.adapt()`).

## Fyzika

### Fyzikální knihovna

| | Jolt (`jolt-physics` 1.1.1) | Rapier (`@dimforge/rapier3d-compat` 0.21.0) |
| --- | --- | --- |
| Auta | Úplný model: motor s křivkou točivého momentu, spojka, převodovka, diferenciály, stabilizátory, pneumatiky se skluzem. Navíc motorky a pásová vozidla. | Paprskové zavěšení a tření kol. Motor, převodovku a pneumatiky by bylo nutné napsat zvlášť. |
| Chodci | `CharacterVirtual`: schody, svahy, tlačení předmětů | Ovladač postavy: schody, svahy, přichycení k zemi |
| Další | ragdolly, měkká tělesa, výškové pole terénu, vícevláknová verze | ragdolly přes klouby, výškové pole terénu, jednodušší API |
| Velikost | WASM asi 2 MB | srovnatelná |

**Doporučení: Jolt.** Auta jsou jádro hry a jeho vozidlový model ušetří nejvíc vlastního
a chybového kódu. Vícevláknová verze vyžaduje na hostingu hlavičky COOP/COEP. Vercel je umí
nastavit, GitHub Pages ne. Začít s jednovláknovou verzí.

### Ověřený výpočetní výkon

Změřeno knihovnou Rapier na cloudovém serveru (Intel Xeon 2,1 GHz, jedno vlákno).
Scéna: terén 1 km² po 2 m, 400 budov, auta se čtyřmi koly a zavěšením, kinematičtí chodci
a volné předměty. Měřen čas jednoho kroku simulace při 60 Hz.

| Scéna | Medián | p95 |
| --- | --- | --- |
| 15 aut, 100 předmětů, 20 chodců | 2,1 ms | 3,2 ms |
| 40 aut, 300 předmětů, 40 chodců | 5,3 ms | 7,4 ms |
| 80 aut, 800 předmětů, 60 chodců | 8,4 ms | 11,6 ms |

Snímek při 60 FPS má 16,7 ms. Hustá scéna se do něj vejde i na tomto pomalém jádru; moderní
počítač a nový telefon budou rychlejší. Test měřil jen cenu výpočtu, ne jízdní vlastnosti.
Jolt nebyl měřen; jeho výkon je potřeba ověřit v prvním pilotu.

### Co postavit

1. **Pevný krok simulace** 60 Hz (vozidla s jemnějším podkrokem) a plynulé vykreslování mezi
   kroky. Dnešní proměnný krok fyzikální knihovně nevyhovuje.
2. **Fyzikální okruh kolem hráče** o poloměru asi 300 m. Plně se počítá jen v něm. Statické
   kolize se staví a ruší s dlaždicemi:
   - terén jako výškové pole z `terrain.bin` a jemných dlaždic,
   - budovy jako hranoly z půdorysů,
   - mosty ze stávajících profilů silnic,
   - zdi a pilíře z plánu E13–E22.

   Herní data zůstávají zdrojem pravdy a knihovna dostává jejich kopii.
3. **Vrstvy kolizí.** Zábradlí koliduje s chodci, jak bylo rozhodnuto. U aut navrhuji, aby
   zábradlí při slabém nárazu auto zastavilo a při silném se prolomilo. Toto je ještě
   potřeba potvrdit.
4. **Auta.** Vlastní auto a auta do zhruba 150 m mají plnou fyziku: motor, převodovku,
   pneumatiky, zavěšení a přenos hmotnosti při brzdění a v zatáčkách. Parametry se odvodí
   pro všech osm typů aut. Vzdálený provoz zůstane na dnešním lehkém modelu a na plnou
   fyziku se přepne při přiblížení nebo nárazu.
5. **MHD.** Tramvaje jedou po kolejích jako těžká kinematická tělesa, takže auto při srážce
   odstrčí. Pro směny MHD stačí jednorozměrný model adheze, rozjezdu a brzdění. Kloubové
   autobusy a trolejbusy mohou být dvě tělesa spojená kloubem.
6. **Chodci.** Ovladač postavy se schody, svahy a zábradlím. Při sražení se z chodce stane
   ragdoll (nejvýš asi čtyři současně), který potom vstane.
7. **Předměty.** Lampy, značky, koše, lavičky, sloupky a ploty jsou spící tělesa; dokud se
   nehýbou, výkon téměř nestojí. Nad určitou silou nárazu se ulomí nebo převrhnou.
8. **Poškození.** Viditelná deformace karoserie v místě nárazu, ztráta výkonu, rozladěné
   řízení a odpadlé díly jako volná tělesa.
9. **Voda.** Vztlak a odpor: auto v Radbuze chvíli plave a potom se potopí.
10. **Vrtulník.** Těleso s tahem rotoru, kolektivem, cyklikou a přízemním efektem, s
    volitelnou stabilizací pro snadné ovládání.

**Co v prohlížeči nedělat:** plnou deformaci karoserie jako BeamNG pro celý provoz, ničení
budov a simulaci tekutin.

**Bezpečný přechod.** Novou fyziku zavádět vedle staré, nejdřív jen pro hráčovo auto. Starý
model ponechat přes parametr (například `?physics=old`), dokud neprojdou všechny prohlížečové
testy. Některé testy kontrolují konkrétní chování, třeba jízdu přes Wilsonův most bez
poškození; jejich očekávání je potřeba přenastavit vědomě, ne je jen povolit.

## Grafika

### Nejdřív rozhodnout mezi WebGL a WebGPU

WebGPU je dnes zapnuté v Chromu a Edgi (počítače, Android 12+), v Safari 26 (macOS, iOS 26+)
a ve Firefoxu na Windows a Macích s Apple Silicon. Chybí Firefox na Androidu a Linuxu a starší
iOS. Vykreslovač WebGPU v three.js se tam sám vrátí k WebGL 2.

Rozhodnout je potřeba hned, protože efekty pro WebGL (postprocesy, úpravy shaderů přes
`onBeforeCompile`) se pro WebGPU musí napsat znovu jazykem TSL.

**Návrh:**

1. Aktualizovat three.js z 0.170 na 0.187.
2. Udělat malou zkoušku: jedna oblast s terénem, budovami a stíny ve WebGPU, změřená na
   vlastním počítači a telefonu.
3. Podle výsledku stavět další efekty jen v jedné technologii.

### Úrovně vylepšení

| Úroveň | Změna | Co bude vidět | Náročnost |
| --- | --- | --- | --- |
| 1 | Fyzikálně založené materiály (PBR) a osvětlení z oblohy | lesk aut, odlesky oken a mokré dlažby, věrnější světlo během dne | střední, dotkne se všech materiálů |
| 1 | Kaskádové stíny | ostré stíny zblízka i stíny do dálky | malá |
| 1 | Ambient occlusion | domy a předměty „sedí“ na zemi, plastické kouty | malá |
| 1 | Bloom a noční světla | svítící lampy, okna a světla aut | malá |
| 1 | Barevné ladění (LUT) a vzdušný opar | jednotný malovaný styl, hloubka krajiny | malá |
| 1 | Vyhlazování SMAA nebo TAA | méně zubatých hran | malá |
| 2 | Fasády podle stylu čtvrti, normálové mapy, okna s falešnými interiéry | věrohodné ulice zblízka i v noci | velká |
| 2 | Řeky s odrazy | Radbuza a Mže jako skutečná voda | střední |
| 2 | Stromy s úrovněmi detailu, tráva u kamery, vítr | živější krajina | střední |
| 2 | Metalický lak, odrazy, kužely světlometů | auta jako z moderní hry | střední |
| 2 | Déšť, mokro (navazuje na `?wet=1`), sníh, objemové mraky | počasí a atmosféra | velká |
| 3 | WebGPU: částice na GPU, mnoho světel v noci, menší zátěž procesoru | jiskry, kouř, déšť, plně osvětlené noční město | velká, přepis shaderů |

Úroveň 1 přinese největší skok vzhledu za nejmenší práci. Výkonnější zařízení ji zvládnou
v plném rozlišení. Na slabších zařízeních se rozlišení sníží automaticky.

### Pracovní rozpočet snímku

Návrh pro 60 FPS (16,7 ms) na cílových zařízeních: fyzika do 4 ms, logika hry do 2 ms,
příprava vykreslení na procesoru do 6 ms, grafická karta do 12 ms. Měřit metodou z revize
(skutečná práce snímku, ne interval mezi snímky).

## Doporučené pořadí s plánem E13–E22

1. Výchozí stav a nové měření výkonu.
2. Ortofoto. Nezávisí na fyzice ani na vykreslovači.
3. Aktualizace three.js a zkouška WebGPU, potom rozhodnutí.
4. Fyzikální jádro: Jolt, pevný krok, okruh kolem hráče, terén, budovy, mosty a hráčovo auto.
5. Chodci, zábradlí, zdi a pilíře. Stavební objekty z plánu jdou rovnou do fyzikální knihovny,
   ne do kolizí budov, jak navrhovala revize před rozhodnutím o fyzice.
6. Provoz v okruhu, předměty, poškození a srážky s MHD.
7. Grafika, úroveň 1.
8. Mosty kalibrací a ulice podle plánu.
9. Grafika, úroveň 2.

## Zdroje

- [Jolt Physics pro JavaScript](https://github.com/jrouwe/JoltPhysics.js) · [Rapier](https://rapier.rs/)
- [Podpora WebGPU v hlavních prohlížečích (web.dev)](https://web.dev/blog/webgpu-supported-major-browsers)
- [Stav implementací WebGPU](https://github.com/gpuweb/gpuweb/wiki/implementation-status)
- Verze knihoven ověřeny v registru npm 17. 11. 2026.
