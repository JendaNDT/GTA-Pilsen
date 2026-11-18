# Pokyny pro AI agenty (Codex)

Plzeň naplno je 3D otevřený svět Plzně a okolí v prohlížeči. Je postavený ze skutečných
otevřených dat: OpenStreetMap, ČÚZK, PMDP a města Plzně. Autor neprogramuje; hru tvoří
s pomocí AI. Píšeš proto kód, testy i vysvětlení tak, aby výsledek šel ověřit bez čtení kódu.

## Jazyk

- S autorem komunikuj česky. Česky piš i texty ve hře, dokumentaci a komentáře v kódu.
- Commity piš česky v infinitivu jako dosavadní historie: „Přidat…“, „Opravit…“, „Zpřesnit…“.

## Kde co je

- `src/world/`: svět, terén, mosty, kolize, silnice, stavba dlaždic, materiály.
- `src/entities/`: auta, chodci, MHD, vrtulník a jejich modely.
- `src/game/`: pravidla, kamera, ovládání, HUD, mapa, zakázky, směny, zvuk.
- `src/physics/`: fyzika Jolt (vzniká v etapě E18).
- `tools/`: sestavení dat v Pythonu a Node.js. `public/`: hotová distribuovaná data.
- `tests/`: testy Node (`*.test.js`), Pythonu (`test_*.py`) a prohlížeče (`tests/e2e/`).
- `docs/`: protokoly etap. Plán je v `docs/plan-presnost-a-vzhled.md`, zadání etap v
  `docs/codex/Exx.md` a katalog vylepšení v `docs/fyzika-a-grafika.md`.

## Příkazy

```bash
npm ci
npm run dev          # vývojový server, obvykle http://localhost:5173
npm test             # testy JavaScriptu (node:test)
npm run test:python  # testy nástrojů (po instalaci tools/requirements.txt)
npm run build        # produkční sestavení do dist/
npm run test:e2e     # testy v Chromiu nad dist/ (nejdřív npm run build)
```

- Prohlížečové testy spouštěj s `--trace off`, pokud nehledáš konkrétní chybu.
- Kontroly spouštěj místně. Výsledky před nahráním změn zapiš do stavu etapy.
- V cloudovém prostředí s předinstalovaným Chromiem nastav
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium`.
  Lokálně stačí jednou `npx playwright install chromium`.
- Debug režim `?debug` zpřístupní `window.__game`, `__step`, `__view`, `__setClock` a `__setInput`.

## Závazná technická rozhodnutí

- **Vykreslování:** three.js 0.187 přes `three/webgpu` a TSL (`three/tsl`) od etapy E15.
  Všechny moduly importují stejnou cestu. Nepoužívej `onBeforeCompile`, `ShaderMaterial`,
  `EffectComposer` ani knihovnu `postprocessing`. Efekty skládej přes `THREE.RenderPipeline`;
  `PostProcessing` je od r183 zastaralý název. Bez WebGPU se vykreslovač sám přepne na WebGL 2.
- **Fyzika:** Jolt (`jolt-physics`, sestavení `wasm-compat`, jedno vlákno) od etapy E18.
  Dočasné objekty Jolt uvolňuj přes `Jolt.destroy`. V herní smyčce nevytvářej nové objekty
  Jolt; znovu používej předem vytvořené `Vec3` a `RVec3`. Krok simulace je pevný (1/60 s).
- **Zábradlí** zastaví chodce. Zábradlí, lampy, značky a podobné vybavení se dá autem
  ulomit nebo zničit.
- **Ortofoto** se kreslí ve 2 m/px do stávající textury země v `drawGround()`.
- **Mosty** se kalibrují podle měření. Fyzika jízdního povrchu zůstává z profilů silnic.

## Pravidla práce

1. Pracuj jen na zadané etapě podle `docs/codex/Exx.md`. Co do ní nepatří, zapiš do protokolu
   jako návrh a nedělej to.
2. Postupuj po krocích ze zadání. Po každém kroku spusť dotčené testy a udělej commit.
   Pracuj na větvi etapy (například `etapa/E15`), ne přímo na `main`. Stav rozpracované
   etapy (hotové a zbývající kroky, otevřené otázky, poslední testy) veď v
   `docs/codex/stav.md`.
3. **Nesnižuj očekávání testů jen proto, aby prošly.** Když nové chování oprávněně mění
   výsledek, uprav test a důvod zapiš do protokolu. Ke každé nové funkci přidej test.
4. Před commitem spusť `npm test` a `npm run build`. Po změně v `tools/` spusť i
   `npm run test:python`, po změně běhu hry i `npm run test:e2e`.
5. Distribuovaná data v `public/` měň jen skripty z `tools/`. Surová a pracovní data patří
   do `data-raw/`, která není v gitu. Nová data nejdřív sestav do `data-raw/kandidat/`,
   porovnej a teprve potom převezmi.
6. Uložené hry (`localStorage`, klíč `plzen-naplno-v1`) musí po změně dál fungovat. Novou
   položku přidej s bezpečnou výchozí hodnotou.
7. Hra musí běžet i v předvolbě „nízká“ a na dotykovém telefonu. Nový efekt musí jít vypnout.
8. Každý nový podklad, knihovnu, texturu nebo model zapiš s licencí do README (část
   „Zdroje a licence dat“) a do „O hře“ v `src/main.js`. Používej jen podklady s jasnou
   licencí (CC0, CC BY, MIT nebo vlastní).
9. Etapu ukonči protokolem `docs/Exx.md`. Uveď v něm revizi, použité zdroje, výsledky testů,
   měření výkonu, snímky před a po a známé odchylky. Starší protokoly nepřepisuj.
   Aktualizuj README.
10. Na konci napiš autorovi česky a bez žargonu, co se změnilo a co má ve hře vyzkoušet.

## Výkon

- Rozpočet snímku pro 60 FPS na cílových zařízeních: fyzika do 4 ms, logika do 2 ms,
  příprava vykreslení do 6 ms, GPU do 12 ms.
- Měř nástrojem `tools/measure_map.mjs`, po etapě E13 skutečnou práci snímku, ne interval
  mezi snímky. Počty vykreslovacích volání a trojúhelníků hlídá test rozpočtu.
- Zhoršení nad 10 % proti referenci musí mít v protokolu důvod.

## Styl kódu

- ES moduly v JavaScriptu (bez TypeScriptu), dvě mezery, středníky.
- Komentáře česky jen tam, kde nejsou zřejmé z kódu.
- Výpočty piš jako čisté funkce, které jdou testovat v Node bez prohlížeče.
- Herní souřadnice: x na východ, z na jih, y nahoru, metry. Převody jsou v
  `tools/coordinates.py` a `World.gpsToWorld()`.
