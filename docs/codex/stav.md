# Stav etapy E14

**Čeká na ruční měření E14. Etapa není uzavřená.** Autor dne 17. listopadu 2026
výslovně rozhodl: „Uzavření odložit, dokud nedodám ruční měření výkonu.“

Větev `etapa/E14`, výchozí revize `e6d5768`. Zadání je v [E14](E14.md).
Předchozí E13 je sloučená do `main`; její výsledky jsou v [protokolu E13](../E13.md).

| Krok | Stav a commit |
| --- | --- |
| 1. Aktualizace three.js a záznam výsledků testů | Hotovo · `470a94b` |
| 2. Opravy API a varování | Hotovo · `9292bba` |
| 3. Kontrola nahrazovaných řetězců shaderů | Hotovo · `146a263` |
| 4. Referenční pohledy a porovnání s E13 | Hotovo · `1c01685` |
| 5. Rozpočet, měření a závěrečný protokol | Automatické měření hotovo; čeká na autora, protokol a závěrečné ověření |

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

Pět běhů každé verze a kontrola bez stínů jsou v [pracovním měření](../E14/mereni.md)
a v [úplných výsledcích](../E14/mereni.json). P95 práce jízdy vzrostlo v souhrnu z 4,7
na 5,2 ms (+10,6 %), p99 z 5,2 na 6,5 ms (+25 %). Výsledky kolísají i v původní E13
a bez stínů. Příčina není potvrzená; odchylka není schválená. Autor chce dodat ruční
měření před uzavřením. Odkazy na obě místní verze a postup jsou v pracovním měření.

Po dodání měření:

1. Vyhodnotit oba výsledky a dořešit odchylku podle zadání; nic nezamlčet.
2. Dokončit protokol `docs/E14.md`, README, katalog a přehled etap.
3. Spustit všechny závěrečné kontroly a commitnout krok 5.
4. Připravit pull request do `main`, doporučit kontrolu modelem 6.1 Sol, Medium.
5. Další etapu nezačínat.

## Poslední ověření a prostředí

Po poslední změně běhu hry (`146a263`) prošlo všech 38 testů Node, sestavení a všech
38 prohlížečových testů (`--trace off`), včetně minuty hraní bez varování. Krok 4 znovu
prošel 38 testy Node a sestavením. Poslední testy Pythonu měly 13 úspěšných testů.
Před uložením stavu znovu prošlo 38 testů Node, 13 testů Pythonu, kontrola syntaxe
všech nástrojů Pythonu, audit npm bez nálezů a sestavení. Protože od `146a263` nebyl
běh hry změněn, prohlížečová sada se při uložení dokumentace neopakovala.

Původně chybělo npm. Autor schválil jeho doplnění; npm 12.2.2 bylo instalováno
z oficiálního registru s ověřením SHA-512. Node.js 24.22.3 je v PATH spolu s npm a npx.
Python 3.12 se závislostmi je v `.venv`, Chromium 159.0.8154.6 je nainstalované.
Pythonové npm příkazy spouštět s `.venv/bin` v PATH. Pracovní logy a původní sestavení
E13 jsou v neversionovaném `data-raw/e14/`. Žádná distribuovaná data se neměnila.

Pro ruční měření jsou připravené servery: původní E13 na portu 4174 obsluhuje
`data-raw/e14/baseline-dist/`, E14 na portu 4173 obsluhuje aktuální `dist/`.
Obě adresy před uložením stavu odpověděly HTTP 200. Při opětovném spuštění serverů
nesmí E13 omylem obsluhovat současné sestavení E14.

## První ruční výsledek autora

Autor dodal 17. listopadu 2026 první 60sekundové měření: 3 601 snímků, práce snímku
2,7 / 3,5 / 4,6 ms a GPU 10,68 / 11,35 / 11,83 ms (medián / p95 / p99), měřítko 2,
stíny zapnuté. [Úplný přepis](../E14/rucni-mereni.json). Podle pořadí otevření je
přiřazen k E13; autor jej výslovně neoznačil. Prohlížeč ani přesný pohyb nebyly uvedeny.
Zbývá odpovídající výsledek E14; tento jediný výsledek zatím nedovoluje uzavřít srovnání.
