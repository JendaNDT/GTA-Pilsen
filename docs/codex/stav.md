# Stav etapy E14

**Implementace E14 je dokončená. Odeslání větve čeká na autora.** Autor nejprve odložil uzavření do ručního měření.
Dne 17. listopadu 2026 dodal oba výsledky a uvedl „Chrome pro testování“ bez
pozorovaného zadrhávání. Výkonnostní odchylky jsou zachované v protokolu.

Větev `etapa/E14`, výchozí revize `e6d5768`. Zadání je v [E14](E14.md).
Předchozí E13 je sloučená do `main`; její výsledky jsou v [protokolu E13](../E13.md).

| Krok | Stav a commit |
| --- | --- |
| 1. Aktualizace three.js a záznam výsledků testů | Hotovo · `470a94b` |
| 2. Opravy API a varování | Hotovo · `9292bba` |
| 3. Kontrola nahrazovaných řetězců shaderů | Hotovo · `146a263` |
| 4. Referenční pohledy a porovnání s E13 | Hotovo · `1c01685` |
| 5. Rozpočet, měření a závěrečný protokol | Hotovo · protokol, automatické a ruční měření, všechny závěrečné kontroly |

## Hotové změny

Three.js je připnuté na přesnou verzi 0.187.0. Stávající WebGLRenderer je zachovaný.
Bylo nahrazeno odstraněné `PCFSoftShadowMap` za `PCFShadowMap`; verze a licence jsou
v README a v „O hře“. Byl projit průvodce migrací r171–r187; další používaná API
nevyžadovala opravu. Barvy, expozice a osvětlení se neupravovaly.

Všechny náhrady v budovách, zemi, terénu, portálech, náhonu a světlech vozidel hlásí
v režimu `?debug` nenalezený řetězec. Pět nových testů v Node ověřuje všech 27 variant
a záměrně poškozený shader. Vygenerované shadery před přidáním kontrol a po něm jsou
řetězcově shodné. Nový prohlížečový test ověřuje skutečnou minutu hraní ve dne i v noci
bez varování a chyb.

Všech osm konečných pohledů má 1280 × 720 px a méně než 250 kB. Dvojí pořízení dalo
shodné soubory. [Porovnání s E13](../E14/snimky.md) ukazuje jen drobné rozdíly ve stínech;
největší průměrná odchylka RGB je 0,469 ze 255 a změna průměrného jasu do 0,0301.

## Schválený přepočet rozpočtu

První běh po aktualizaci prošel 36 z 37 prohlížečových testů. Rozpočet selhal na 295
voláních proti limitu 288. Příčinou je přesun automatického vynulování `renderer.info`
před stíny: nová verze nově započítává i stínový průchod. Skutečná geometrie nepřibyla.

Autor schválil výjimku z požadavku E14 neměnit očekávání testů: nové reference byly
převzaty z **původní E13** včetně stínů, limit +10 % zůstal. [Srovnání počítadel](../E14/pocitadla.json)
dokládá stejné úplné počty v obou verzích: 295 / 509 603 (náměstí), 322 / 503 726
(Lochotín), 195 / 283 880 (Rokycany), vždy volání / trojúhelníky. Dočasné přidání 40
kopií oblohy vyvolalo překročení (335 proti limitu 324), po odebrání znovu 295.

## Výkon a otevřené otázky

Pět běhů každé verze, kontrola bez stínů a oba ruční výsledky jsou v
[měření](../E14/mereni.md), [automatických výsledcích](../E14/mereni.json)
a [ručních výsledcích](../E14/rucni-mereni.json). Obě ruční minuty měly přibližně 60 FPS,
autor zadrhávání nepozoroval. P95 práce vzrostlo z 3,5 na 3,9 ms (+11,4 %), GPU má
p95 12,22 ms, tedy 0,22 ms nad pracovní mezí. Příčina všech výkyvů není potvrzená.
Nevydává se to za nulovou regresi ani za splnění všech mezí bez odchylky.

[Protokol E14](../E14.md) uvádí odchylky, zdroje, snímky a kontrolu pro autora.
README, katalog a přehled etap jsou aktualizované. Větev `etapa/E14` je připravená
pro pull request do `main`. Před sloučením zbývá kontrola modelem 6.1 Sol, Medium
a autorova kontrola náměstí, Wilsonova mostu, Valíku a noci, včetně posouzení popsaných
výkonnostních odchylek.
Další etapu nezačínat.

## Poslední ověření a prostředí

Závěrečné čisté `npm ci`, všech 38 testů Node, 13 testů Pythonu a všech 38
prohlížečových testů (`--trace off`) prošly. Součástí je rozpočet ve třech pohledech,
minuta hraní ve dne a v noci bez varování, uložené hry verze 1, nízká kvalita a dotykové
ovládání v emulaci. Prošla kontrola syntaxe nástrojů Pythonu, audit npm bez nálezů
a produkční sestavení. Logy: `data-raw/e14/final-*.log`.

Původně chybělo npm. Autor schválil jeho doplnění; npm 12.2.2 bylo instalováno
z oficiálního registru s ověřením SHA-512. Node.js 24.22.3 je v PATH spolu s npm a npx.
Python 3.12 se závislostmi je v `.venv`, Chromium 159.0.8154.6 je nainstalované.
Pythonové npm příkazy spouštět s `.venv/bin` v PATH. Pracovní logy a původní sestavení
E13 jsou v neversionovaném `data-raw/e14/`. Žádná distribuovaná data se neměnila.

Pro ruční měření jsou připravené servery: původní E13 na portu 4174 obsluhuje
`data-raw/e14/baseline-dist/`, E14 na portu 4173 obsluhuje aktuální `dist/`.
Obě adresy před uložením stavu odpověděly HTTP 200. Při opětovném spuštění serverů
nesmí E13 omylem obsluhovat současné sestavení E14.

## Ruční výsledky autora

E13: 3 601 snímků za 60 s, práce 2,7 / 3,5 / 4,6 ms, GPU 10,68 / 11,35 / 11,83 ms.
E14: 3 600 snímků za 60 s, práce 2,6 / 3,9 / 5,0 ms, GPU 11,00 / 12,22 / 13,01 ms.
Obě verze měly měřítko 2 a zapnuté stíny. Přesná verze prohlížeče a pohyb nebyly
uvedeny; přiřazení vychází z pořadí otevření a navazujících výzev. Nešlo o ověření
stejné náhodné posloupnosti provozu. Autor uvedl Chrome pro testování bez zadrhávání.

## Překážka při odeslání větve

Finální protokol a kontroly jsou v commitu `8490179`. `git push -u origin etapa/E14`
selhal: terminál nemá přihlašovací údaje pro GitHub. Vzdálená větev dosud neexistuje
(ověřeno `git ls-remote --heads origin etapa/E14`). GitHub Desktop ukazuje úložiště
GTA-Pilsen, větev etapa/E14 a tlačítko Publish branch, ale automatické ovládání okna
opakovaně selhalo s `noWindowsAvailable`. Commity se nepřeváděly do jiné historie.

Autor má v GitHub Desktopu ručně kliknout nahoře na **Publish branch**. Pak lze
přes připojený GitHub vytvořit návrh PR do main. [Připravený název, popis a postup](../E14/pull-request.md).
Před vytvořením ověřit, že vzdálená větev obsahuje i tento stavový commit.
