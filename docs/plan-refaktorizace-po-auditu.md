# Plán oprav a refaktorizace po auditu kódu

Plán převádí všechny nálezy [auditu z 28. 11. 2026](audit-2026-11-28.md) na dvanáct etap E84–E95.
Výchozí revize je `3d79342`, audit je v commitu `0597d25`. Navazuje na dřívější
[plán oprav po auditu hry](plan-oprav-po-auditu.md) (E31–E36). Protokol E35 nezmiňuje provedení
jejího kroku 6, rozdělení světa a dlaždic. Tento plán ho přebírá do E93.

**Žádná etapa nemění chování hry.** Hráč si všimne jen dvou věcí: srozumitelné zprávy, když hra narazí
na chybu (E85), a případně o něco rychlejšího startu (E94). Všechno ostatní je přestavba „pod kapotou“. Ta
má zjednodušit další vývoj s AI a snížit počet chyb, které se dnes objevují při každé nové funkci.

## Etapy

| Etapa | Obsah | Nálezy auditu | Co půjde po dokončení ověřit | Velikost |
| --- | --- | --- | --- | --- |
| [E84](codex/E84.md) | Automatické kontroly na GitHubu | 3 | U každého nahrání se na GitHubu objeví zelená nebo červená značka | malá |
| [E85](codex/E85.md) | Pojistka při chybě za běhu | 1 | Se zkušební adresou se ukáže zpráva o chybě a tlačítko „Načíst znovu“ | malá |
| [E86](codex/E86.md) | Opakovatelný provoz a otisk simulace | 2 | Stejné semínko v adrese dá dvakrát stejný provoz | střední |
| [E87](codex/E87.md) | Úklid kódu a pravidla stylu | 7, 8 | Nový příkaz `npm run lint` projde bez nálezů, hra se chová stejně | střední |
| [E88](codex/E88.md) | Repozitář a podklady pro AI agenty | 9 | `stav.md` má jen pár kilobajtů, data Godotu jsou v archivu | malá |
| [E89](codex/E89.md) | Rozdělení řízení hry (`game.js`) | 4, 10 | Hra se chová stejně, otisk simulace se nezměnil | velká |
| [E90](codex/E90.md) | Rozdělení startu hry (`main.js`) | 4 | Menu, nastavení a start fungují stejně | střední |
| [E91](codex/E91.md) | Památky přes společné rozhraní | 5 | Kolize u kašen, pavilonku, Borů a sloupu jsou stejné | velká |
| [E92](codex/E92.md) | Stav hráče na jednom místě | 6 | Mapa, fotorežim a menu jsou dostupné ve stejných situacích jako dřív | střední |
| [E93](codex/E93.md) | Rozdělení světa a dlaždic | 4, 10 | Město vypadá stejně, paměť při dlouhé jízdě neroste | velká |
| [E94](codex/E94.md) | Paměť, načítání a závislosti | 10 | Start je rychlejší, minihry se načtou až při vstupu | střední |
| [E95](codex/E95.md) | Převzetí a závěrečné měření | všechny | Tabulka „před a po“ pro všechna čísla z auditu | malá |

Velikost je odhad pracnosti pro jednu etapu Codexu. Malá etapa obvykle zabere jeden úkol,
velká může potřebovat několik pokračování.

### Pořadí a návaznosti

Doporučené pořadí je podle čísel. Etapu lze začít, až jsou sloučené etapy v pravém sloupci.

| Etapa | Potřebuje hotové |
| --- | --- |
| E84 kontroly | nic |
| E85 pojistka | E84 |
| E86 otisk simulace | E84 |
| E87 úklid | E86 |
| E88 repozitář | E84 |
| E89 `game.js` | E86, E87 |
| E90 `main.js` | E85, E89 |
| E91 památky | E86, E87, E89 |
| E92 stav hráče | E89, E90 |
| E93 svět a dlaždice | E86, E87, E91 |
| E94 paměť a načítání | E89, E92, E93 |
| E95 převzetí | všechny |

- **E84 je první.** Od té chvíle GitHub u každé změny sám spustí testy. Všechny další etapy se tím
  kontrolují automaticky.
- **E86 musí předcházet přestavbám E89–E93.** Vytvoří „otisk simulace“: záznam polohy postavy, aut
  a peněz po pevně dané minutě hry se stejným semínkem náhody. Přestavba je správná, jen když
  otisk zůstane do milimetru stejný. To je hlavní pojistka, že se chování nezměnilo.
- **E87 předchází E89–E93.** Jednorázové přeformátování kódu by jinak kolidovalo s rozpracovanými
  přestavbami.
- **E91 předchází E93.** Nejdřív se z jádra světa vyjmou výjimky pro památky, potom se jádro dělí.
- **E92 čeká na E89 a E90.** Podmínky dostupnosti mapy a fotorežimu se přesouvají z modulů, které
  tyto etapy vytvoří.
- **E88** obsahuje jen dokumenty a úklid repozitáře. Může běžet kdykoli po E84, ideálně hned,
  protože kratší `stav.md` ušetří práci všem dalším etapám.
- Během etap E87–E93 by neměly běžet jiné větve s velkými zásahy do `src/`. Herní novinky je lepší
  dělat mezi etapami.

## Rozhodnutí autora

Tři rozhodnutí autor potvrdil 28. 11. 2026. Ostatní padnou v příslušné etapě.

| Kdy | Otázka | Rozhodnutí nebo doporučení |
| --- | --- | --- |
| před E84 | Je repozitář na GitHubu veřejný, nebo soukromý? | **Rozhodnuto: veřejný.** Úplná sada testů v prohlížeči poběží každou noc a jde spustit i ručně. |
| po E84 | Zapnout v nastavení GitHubu ochranu větve `main`? | Ano. Pull request pak nepůjde sloučit, dokud kontroly nesvítí zeleně. Postup bude v README. Nastavení musí udělat autor, agent k němu nemá přístup. |
| E85 | Má hra po vážné chybě ještě uložit postup? | **Rozhodnuto: ne.** Platí poslední automatické uložení, nejvýš 20 s staré. Uložení stavu po chybě by mohlo zapsat poškozená data. |
| E87 | Kdy provést jednorázové přeformátování kódu? | Jen ve chvíli, kdy není rozpracovaná žádná jiná větev. |
| E88 | Odstranit z `main` vygenerovaná data zmrazené verze v Godotu (`godot/data/`, 79 MB z 81 MB)? | **Rozhodnuto: ano.** Celá verze zůstane pod značkou `godot-archiv-2026-11-20`. Data se smažou, jen pokud je nástroj ověřeně vyrobí znovu stejná. Skripty a popis v `godot/` zůstanou kvůli odkazům ze starších protokolů. |
| E88 | Smazat staré větve etap na GitHubu? | Ano, po schválení seznamu. Větve `main` a `gh-pages` (nasazená hra) zůstanou. |

## Jak postupovat

Etapy se dělají stejně jako dosud podle [pravidel projektu](../AGENTS.md) a
[návodu pro Codex](codex/README.md). Univerzální zpráva z návodu najde další etapu sama, protože
E84–E95 jsou v jeho tabulce.

Pro všechny etapy tohoto plánu navíc platí:

1. **Před první změnou změřit výchozí stav.** Spustit testy, uložit výchozí otisk simulace (od E86)
   a změřit výkon nástrojem `tools/measure_map.mjs` na nízké předvolbě a ve špičce.
2. **Malé kroky.** Každý krok zadání je samostatný commit. Po každém kroku projdou `npm test`,
   `npm run build` a dotčené prohlížečové testy. Od E86 musí zůstat stejný i otisk simulace.
3. **Přesun kódu bez úprav.** Při vyjímání do nového souboru se kód nejdřív jen přesune. Úpravy
   přijdou až v dalším commitu. Rozdíl v přehledu změn je pak snadno čitelný.
4. **Veřejná rozhraní zůstávají.** Prohlížečové testy volají asi 520× `__game.…`. Názvy metod
   a vlastností, které testy používají, se nemění. Uvnitř mohou volat nové moduly.
5. **Uložené hry.** Formát `plzen-naplno-v1` se v tomto plánu nemění. Testy uložení v1 a v2 musí
   projít v každé etapě.
6. **Výkon.** Zhoršení nad 10 % proti výchozímu měření musí mít v protokolu důvod. Od přestaveb se
   čeká stejný výkon. Zlepšení se čeká jen v E89 (méně alokací) a E94.
7. **Co do etapy nepatří, zapsat jako návrh a nedělat.** Platí to hlavně pro chyby provozu, které
   otisk simulace pomůže zopakovat. Jejich oprava je samostatná práce.

## Výchozí čísla pro závěrečné srovnání

Etapa E95 porovná tato čísla z auditu se stavem po dokončení plánu. E87 přidá nástroj
`tools/code_metrics.mjs`, který je změří znovu a stejně.

| Ukazatel | Při auditu | Cíl |
| --- | ---: | ---: |
| Řádky `src/game/game.js` | 1 464 | ≤ 800 |
| Řádky `src/world/world.js` | 2 381 | ≤ 900 |
| Řádky `src/world/chunks.js` | 2 230 | ≤ 700 |
| Řádky funkce `boot()` v `src/main.js` | 390 | ≤ 120 |
| Funkce delší než 100 řádků | 32 | ≤ 15 |
| Funkce s více než 50 rozhodovacími větvemi | 27 | ≤ 12 |
| Kopie funkce `clamp` | 15 | 1 |
| Kopie ošetření textu pro HTML | 3 | 1 |
| Volání `Math.random()` v herním kódu | 41 | 0 (vše přes společný generátor) |
| Testy a nástroje s vlastní náhradou `Math.random` | 13 | 0 |
| Rychlé testy, které předstírají prohlížeč | 24 | 0 |
| Nepoužité proměnné podle ESLint | 8 | 0 |
| Velikost `docs/codex/stav.md` | 223 kB | ≤ 10 kB |
| Výjimky pro památky v `collideCircle`, `roofAt` a `raycast` | 6 památek | 0 |
| Hlavní balík JavaScriptu | 2,2 MB | menší o minihry |
| Automatické kontroly na GitHubu | žádné | při každém nahrání |

## Doplnění auditu

Při přípravě plánu se ukázalo, že nález 2 auditu byl neúplný. Měřicí nástroje a 8 prohlížečových
testů už dnes náhodu fixují. Na začátku nahradí funkci `Math.random` vlastním generátorem. Hra
sama ale semínko nezná, ostatní testy běží s náhodou a stejný generátor je zkopírovaný ve
12 souborech. Etapa E86 to sjednotí. Další zjištění z přípravy plánu:

- 24 rychlých testů musí předstírat prohlížeč, protože `src/config.js` už při načtení čte
  obrazovku, adresu a uloženou hru. Proto nejde rychle testovat řízení hry ani svět. Řeší E87.
- Některé testy, například `tests/bory.test.js`, si znovu programují zjednodušený herní svět. Testují
  pak kopii, ne skutečný kód. Řeší E91 společnou testovací přípravou skutečného světa.
- Ošetření textu pro HTML je ve třech kopiích, ne ve dvou: `plain` v `game.js` a `missions.js`
  a `text` v `shift.js`. Některé texty z dat jdou na obrazovku neošetřené. Řeší E87.
- Nástroje webové hry pro rozvoz pizzy a taxi importují `tools/godot/node-shim.mjs`. Při úklidu
  Godotu se proto nesmí odstranit složka `tools/godot/` bez přesunu tohoto souboru. Řeší E88.
- Protokol E35 nezmiňuje provedení kroku 6 (rozdělení světa a dlaždic). Podle auditu hry
  z 25. 11. měly `world.js` 2 219 a `chunks.js` 2 057 řádků, dnes mají 2 381 a 2 230. Krok
  převzala E93.
