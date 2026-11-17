# Plzeň naplno: WebGPU, fyzika Jolt, přesnější stavby a hezčí město

Implementační plán etap E13–E26. Navazuje na vydání 0.1.0-E12.

**Verze 2 ze 17. listopadu 2026.** Nahrazuje verzi 1 z revize `baa7595`. Zapracovává
[revizi plánu](revize-planu-presnost-a-vzhled.md), [katalog vylepšení](fyzika-a-grafika.md)
a rozhodnutí autora:

- přejít na vykreslování WebGPU,
- přejít na fyziku Jolt,
- zábradlí zastaví chodce,
- zábradlí, lampy a další vybavení se dá zničit.

**Stav:** návrh k realizaci. Žádná etapa zatím není implementovaná.
**Zadání pro Codex:** [docs/codex/](codex/README.md), jeden soubor na etapu.
**Pravidla pro agenty:** [AGENTS.md](../AGENTS.md).

## 1. Cíl

1. Převést hru na moderní vykreslování (three.js 0.187, WebGPU s automatickým návratem na
   WebGL 2) a výrazně zlepšit vzhled: světlo, stíny, materiály, vodu, vegetaci, noc a počasí.
2. Nahradit arkádový pohyb skutečnou fyzikou Jolt: auta s motorem, převodovkou a
   pneumatikami, chodci se schody a zábradlím, ragdolly, ničitelné vybavení ulic a poškození aut.
3. Dokončit původní cíle plánu: měřené stavební objekty a mosty, ortofoto krajiny a tři
   podrobně zpracované úseky ulic.

Hra zůstává jedna statická webová aplikace bez serveru. Cílová zařízení jsou výkonnější
počítače a telefony. Nízká předvolba musí dál fungovat i na slabších zařízeních.

**Mimo rozsah:** multiplayer, interiéry budov, nové zakázky, vlaky, rozšíření mapy a
vícevláknová fyzika (vyžaduje hlavičky COOP/COEP na hostingu; lze přidat po E26).

## 2. Ověřený výchozí stav

Ověřeno 17. listopadu 2026 nad kódem revize `baa7595` (do `a58c3dc` se měnila jen dokumentace).

| Oblast | Stav |
| --- | --- |
| Testy | 28/28 JavaScript, 13/13 Python, 34/34 prohlížeč (Chromium, SwiftShader), sestavení bez chyby |
| Vykreslování | three.js 0.170, `WebGLRenderer`, matné materiály Lambert s barvami ve vrcholech. Šest úprav shaderů přes `onBeforeCompile`, vlastní obloha `ShaderMaterial`, jedna stínová mapa, bez postprocesů. |
| Fyzika | arkádový model auta (`stepDynamic()`), kolize třemi kruhy, výška z `groundY()`. Proměnný krok do 50 ms. Zábradlí bez kolizí. |
| Měření výkonu | `tools/measure_map.mjs` měří intervaly snímků, které jsou zastropované obnovovací frekvencí displeje. |
| WebGPU v testech | three.js 0.187 se v Chromiu bez GPU přepne na WebGL 2. S příznaky `--enable-unsafe-webgpu --enable-features=Vulkan --use-webgpu-adapter=swiftshader` jede skutečné WebGPU přes SwiftShader (ověřeno). |
| Jolt | `jolt-physics` 1.1.1 (MIT). V Node ověřeno: auta s motorem a převodovkou, `CharacterVirtual`, výškové pole a ragdolly. Hustá scéna (40 aut, 300 předmětů, 40 chodců) stojí medián 3,0 ms na krok (Xeon 2,1 GHz). |
| Zdroj staveb | Archiv města se SHA-256 `825dc3e3…7bb9ac`: 602 objektů, 12 315 ploch. Wilsonův most je objekt `00000002021000450`. Podrobnosti jsou v revizi. |
| Ortofoto | ČÚZK ATOM, 158 listů ze snímkování 2025, 0,125 m/px, dohromady 9,1 GiB. Ve 2 m/px vychází otevřená krajina na zhruba 11 MiB. |

## 3. Architektura

### 3.1 Vykreslování (od E15)

- `THREE.WebGPURenderer` z `three/webgpu`. Parametr `?renderer=webgl` vynutí záložní WebGL 2
  (`forceWebGL`). Starý `WebGLRenderer` po E15 končí; návrat zajišťuje předchozí vydání.
- Materiály jsou uzlové (TSL). Sdílené parametry (čas, obloha, slunce, noc, mokro) jsou
  uniformy TSL v `src/world/materials.js`.
- Efekty skládá `THREE.RenderPipeline`:
  scéna (MRT: barva, normály, hloubka, pohyb) → GTAO → bloom → tónování a LUT → opar →
  TRAA nebo SMAA/FXAA. Každý krok závisí na předvolbě kvality.
- Čtyři předvolby kvality (ultra, vysoká, střední, nízká) s automatickou volbou a
  dynamickým rozlišením. Nahrazují dnešní `Game.adapt()`.

### 3.2 Fyzika (od E18)

- Modul `src/physics/` obaluje Jolt. Hra dál používá své dotazy (`groundY`, `nearestRoad`,
  graf silnic); fyzika dostává kopie geometrie.
- Pevný krok 1/60 s se střádačem času (nejvýš 4 kroky za snímek) a interpolací polohy pro
  vykreslení.
- **Fyzikální okruh** kolem hráče: statické kolize dlaždic do 384 m. Plná fyzika aut se
  zapíná do 150 m a vypíná nad 220 m. Dál jede provoz lehkým modelem jako dnes.
- Vrstvy kolizí:

| Vrstva | Narazí do |
| --- | --- |
| STATIC (terén, budovy, mosty, zdi, tunely) | VEHICLE, CHARACTER, DEBRIS |
| VEHICLE (auta, vrtulník) | STATIC, VEHICLE, RAILING, BREAKABLE, DEBRIS, TRANSIT, SENSOR |
| CHARACTER (dotazy `CharacterVirtual`, kapsle chodců) | STATIC, VEHICLE, RAILING, BREAKABLE, TRANSIT |
| RAILING (zábradlí) | CHARACTER vždy; VEHICLE od E21 se zlomením |
| BREAKABLE (lampy, značky, sloupky, lavičky v celku) | VEHICLE, CHARACTER |
| DEBRIS (úlomky, odpadlé díly) | STATIC, VEHICLE, DEBRIS |
| TRANSIT (tramvaje a autobusy jako kinematická tělesa) | VEHICLE, CHARACTER, DEBRIS |
| SENSOR (voda, cíle) | VEHICLE, CHARACTER |

- **Fyzika nezávisí na grafickém detailu.** Kolize vznikají ze stejných dat jako jednoduchá
  geometrie dlaždice, ne z podrobných modelů. Výpadek detailu nesmí změnit fyziku.
- Statický terén v kolizích používá stejné trojúhelníky jako vykreslený terén, včetně otvorů
  u portálů Valíku. Výškové pole Jolt použít jen tehdy, když měření ukáže potřebu a jeho
  úhlopříčky se shodují s terénem.

### 3.3 Společná pravidla dat

Pravidla z verze 1 dál platí:

- Zachovat počátek, měřítko a orientaci světa. S-JTSK převádět přes WGS 84 a
  `tools/coordinates.py`; výšky Bpv převést jednou odečtením `baseElevation`.
- Každý manifest nese verzi schématu, zdroje, data podkladů, kontrolní součty a otisky
  závislých souborů. Při nesouladu se vrstva nenačte a hra použije původní stav.
- Ruční rozhodnutí se ukládají jako samostatné opravy s důvodem a místem, ne zásahem do
  staženého archivu.
- Surová data patří do `data-raw/`. Kandidát se sestavuje mimo `public/` a před převzetím
  se porovnává.

## 4. Etapy

Etapy jsou číslované v doporučeném pořadí. Podrobné zadání každé etapy je v `docs/codex/`.

| Etapa | Výsledek | Závisí na | Model v Codexu |
| --- | --- | --- | --- |
| [E13](codex/E13.md) Příprava a měření | referenční snímky, měření skutečné práce snímku, test rozpočtu | – | Sol, Medium |
| [E14](codex/E14.md) three.js 0.187 | aktualizace knihovny beze změny vzhledu | E13 | Sol, High |
| [E15](codex/E15.md) WebGPU | nový vykreslovač, materiály v TSL, testy na WebGPU i WebGL 2 | E14 | Astra, High |
| [E16](codex/E16.md) Ortofoto | krajina ze snímků ČÚZK ve 2 m/px | E13 | Sol, High |
| [E17](codex/E17.md) Grafika A | PBR, obloha a osvětlení z oblohy, kaskádové stíny, AO, bloom, LUT, opar, vyhlazování, předvolby | E15 | Sol, High |
| [E18](codex/E18.md) Fyzika Jolt | pevný krok, okruh kolizí, auto hráče s motorem a převodovkou | E15 | Astra, High |
| [E19](codex/E19.md) Chodci a zábradlí | `CharacterVirtual`, zábradlí na všech mostech, ragdolly | E18 | Astra, High |
| [E20](codex/E20.md) Provoz a vozidla | auta provozu ve fyzice, MHD, policie, vrtulník, voda | E19 | Astra, High |
| [E21](codex/E21.md) Ničení a poškození | zlomitelné lampy, značky, zábradlí, semafory; deformace a díly aut; částice | E20 | Sol, High |
| [E22](codex/E22.md) Měřené stavby a mosty | inventura po dílech, zdi a pilíře v kolizích, kalibrace mostů | E21 | Astra, High (převod), Sol (dávky) |
| [E23](codex/E23.md) Grafika B | terén zblízka, silnice, řeky, stromy, tráva, noční světla, částice na GPU | E17, E21 | Sol, High |
| [E24](codex/E24.md) Grafika C | fasády, okna s interiéry, střechy, auta, MHD, počasí, oblaka | E23 | Sol, High |
| [E25](codex/E25.md) Ulice | Americká, Dřevěná a náměstí, okolí nádraží | E22, E24 | Sol, High |
| [E26](codex/E26.md) Vydání | závěrečné zkoušky, měření na skutečných zařízeních, archiv, návrat | vše | Sol, High; kontrola Astra |

**Milníky:**

- M1 po E15: hra běží na WebGPU.
- M2 po E17: nový vzhled.
- M3 po E18: nová jízda autem.
- M4 po E21: ničitelné město.
- M5 po E24: plná grafika.
- M6 po E26: vydání.

E16 lze udělat kdykoli po E13, protože se dotýká jen kreslení textury země. Grafické
etapy E17, E23 a E24 a fyzikální etapy E18–E21 mění stejné soubory (`game.js`,
`chunks.js`, `materials.js`). Proto se neprovádějí souběžně.

## 5. Odolnost a výkon

| Oblast | Pracovní mez |
| --- | --- |
| Snímek 60 FPS na cílovém zařízení | fyzika ≤ 4 ms, logika ≤ 2 ms, příprava vykreslení ≤ 6 ms, GPU ≤ 12 ms |
| Povinná data při startu | nejvýš +3 MiB proti E12 (WASM Jolt asi 2 MB, základ staveb). Ortofoto a detaily se načítají za běhu. |
| Distribuce | ortofoto do 30 MiB, textury fasád a vegetace do 40 MiB. Celé `public/` nemá přesáhnout 150 MB. |
| Paměť GPU navíc | vysoká předvolba do 512 MiB, střední do 256 MiB, nízká do 96 MiB |
| Souběžné požadavky | nejvýš 4 (nízká 2). Pořadí: nutný svět → blízká geometrie → vzhled → vzdálené snímky. |
| Úlomky a ragdolly | ultra/vysoká 200 úlomků a 4 ragdolly; střední 100 a 2; nízká 40 a 1 |
| Regrese | počty vykreslovacích volání a trojúhelníků +10 % proti referenci a práce snímku +10 % vyžadují zdůvodnění v protokolu |

Selhání načtení vzhledové vrstvy (ortofoto, fasády, detail staveb) nesmí zastavit hru.
Selhání fyzikální knihovny při startu zobrazí srozumitelnou chybu; hra bez fyziky po E18
nepokračuje.

## 6. Ověřování

- **Automaticky** při každé etapě: testy Node (výpočty, převody, fyzika v Node s Joltem),
  Python (nástroje), prohlížečové testy na WebGL 2 a výběr scénářů na WebGPU, test
  rozpočtu vykreslování.
- **Fyzikální metriky** (testy v Node, E18):
  - malé auto zrychlí z 0 na 100 km/h za 11–14 s, sporťák za 4–6 s,
  - brzdná dráha ze 100 km/h na suchu je 36–45 m,
  - boční zrychlení na suchu 0,85–0,95 g,
  - auto ve 250 km/h neprojde stěnou ani zábradlím,
  - výška mostovky ve fyzice se od vykreslené liší nejvýš o 5 cm.
- **Vizuálně:** referenční pohledy z E13 (náměstí v 10:00 a ve 22:00, Wilsonův most,
  portál Valíku, Lochotín ze vzduchu, pole u Rokycan, hamr v Dobřívě, Klabava). Po každé
  vizuální etapě se pořídí znovu ve stejných polohách.
- **Na skutečných zařízeních:** autor změří výkon na svém počítači a telefonu (postup v E13).
  Neměřená zařízení se neoznačují jako ověřená.
- Stávající regresní sady (Rondel, mimoúrovňová křížení, Valík, Dobřív, MHD, rozvoz,
  směny, uložení) zůstávají. Změnu jejich očekávání je nutné zdůvodnit.

## 7. Vydání a návrat

1. Každá etapa končí na vlastní větvi s protokolem. Do `main` se slučuje po kontrole autora.
2. Diagnostické přepínače:
   - `?renderer=webgl` (od E15) vynutí záložní WebGL 2,
   - `?physics=old` (E18–E25; na E26 se odstraní) zapne původní pohyb hráčova auta,
   - `?orthophoto=0`, `?structures=0` a `?quality=…` vypnou nebo přepnou jednotlivé vrstvy.
3. Nové datové soubory se pojmenují verzovaně nebo otiskem. Manifest odkazuje jen na úplné
   sestavení.
4. `archive_release.py` dostane parametr verze místo pevné přípony `-E12`.
5. Návrat je vždy celé předchozí vydání. Uložené hry v něm musí jít načíst.

## 8. Dokončení

Plán je hotový, když:

- hra běží na WebGPU a WebGL 2 se stejnými pravidly a jen rozdílnou kvalitou,
- auta, chodci, MHD a vrtulník používají fyziku Jolt a splňují metriky z části 6,
- zábradlí zastaví chodce a vybavení ulic se dá zničit,
- inventura stavebních objektů má u každého dílu rozhodnutí a mosty jsou zkalibrované,
- ortofoto pokrývá vhodné plochy,
- všechna vylepšení grafiky z katalogu mají stav „hotovo“ nebo zdůvodněné odložení,
- tři úseky ulic jsou hotové,
- všechny regresní sady projdou a výkon je změřený na autorových zařízeních,
- vydání jde sestavit ze zaznamenaných vstupů a vrátit jako celek.

## 9. Zdroje

- [three.js](https://threejs.org) (MIT) · [Jolt Physics](https://github.com/jrouwe/JoltPhysics.js) (MIT)
- [Ortofoto ČR, ATOM](https://atom.cuzk.gov.cz/ORTOFOTO/ORTOFOTO.xml) (CC BY 4.0, ČÚZK)
- [3D budovy centra Plzně 2024](https://opendata.plzen.eu/public/opendata/detail/37)
- [Podpora WebGPU](https://web.dev/blog/webgpu-supported-major-browsers)
- Textury a modely jen s licencí CC0 nebo CC BY, například [ambientCG](https://ambientcg.com),
  [Poly Haven](https://polyhaven.com) a [Quaternius](https://quaternius.com), nebo vlastní.
