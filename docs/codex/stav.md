# Stav etapy E14

Větev `etapa/E14`, výchozí revize `e6d5768`. Zadání je v [E14](E14.md).
Předchozí E13 je sloučená do `main`; její výsledky jsou v [protokolu E13](../E13.md).
Autor schválil zahájení E14 zprávou „pokračuj“ a následně instalaci potřebných nástrojů.

| Krok | Stav |
| --- | --- |
| 1. Aktualizace three.js a záznam výsledků testů | Hotovo |
| 2. Opravy API a varování | Hotovo |
| 3. Kontrola nahrazovaných řetězců shaderů | Čeká |
| 4. Referenční pohledy a porovnání s E13 | Čeká |
| 5. Rozpočet, měření a závěrečný protokol | Čeká |

## Prostředí a výchozí ověření

Dne 17. listopadu 2026 chybělo npm; původní pokus o testy skončil kódem 127.
Po souhlasu autora bylo doplněno npm 12.2.2 z oficiálního registru s ověřením SHA-512.
Node.js 24.22.3 z prostředí Codexu je nyní dostupný v PATH spolu s npm a npx.
Python 3.12 a jeho závislosti i Chromium 159.0.8154.6 už jsou nainstalované.
Pythonové příkazy se spouštějí s `.venv/bin` v PATH.

Čistá instalace E13, všech 33 testů Node, 13 testů Pythonu a sestavení prošly.
Nově pořízené původní pohledy jsou v `data-raw/e14/baseline-reference/`.
Výchozí prohlížečová sada byla po sedmi úspěšných testech ukončena, aby následovalo
úplné ověření aktualizované verze. Zbývající testy tohoto výchozího běhu nejsou označené
jako ověřené. Logy a srovnávací měření jsou v neversionovaném `data-raw/e14/`.

## Krok 1

Three.js je připnuté na přesnou verzi 0.187.0, zámek závislostí se změnil jen u three.js.
Všech 33 testů Node, sestavení a audit npm bez nálezů prošly. Z 37 prohlížečových
testů prošlo 36. Jediný neúspěšný je test rozpočtu (295 volání na náměstí proti
původnímu limitu 288); příčina je doložená níže. Očekávané selhání se v kroku 1
pouze zaznamenává podle zadání, oprava následuje v kroku 2.
Při skutečném načtení se objevilo varování:
`THREE.WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.`
Oprava patří do kroku 2. Další chyby při startu nebyly zachyceny.

Byl přečten [průvodce migrací](https://github.com/mrdoob/three.js/wiki/Migration-Guide)
pro r171–r187. Průvodce upozorňuje zejména na stíny; kontrola kódu knihovny navíc odhalila změnu
počítadel vykreslování (viz níže). Ostatní změněná API se v projektu nepoužívají. Statické objekty
s vypnutým automatickým přepočtem matice nemění ručně matici a nevolají
`updateWorldMatrix()`. Barvy, expozice, materiály a vlastní obloha se zatím nemění.

## Změna významu počítadel

Test rozpočtu po aktualizaci selhal. V E13 se automatické vynulování `renderer.info`
provádělo až po vykreslení stínů, nyní probíhá před ním. Nové počty tedy zahrnují
scénu i stíny. Na náměstí se v obou verzích skutečně kreslí totožných 295 objektů,
z toho 33 ve stínovém průchodu. Původní počítadlo hlásilo pouze 262 volání.
Trojúhelníky se ze stejného důvodu změnily z 405 706 na 509 603. Zachycené seznamy
objektů včetně geometrie a matic jsou shodné (`data-raw/e14/render-old.json`
a `render-new.json`). Nejde o přidanou geometrii. [Výsledky všech tří pohledů](../E14/pocitadla.json)
ukazují shodné úplné počty pro původní i aktualizovanou verzi.

## Otevřené otázky

Autor dne 17. listopadu 2026 schválil přepočet rozpočtu z **původní E13** včetně
stínů při zachování limitu +10 %. Rozpočet se nepřevezme z aktualizované verze.
Jde o schválenou výjimku z požadavku E14 neměnit očekávání testů, vyvolanou změnou
významu API knihovny. Úplné původní počty jsou 295 / 509 603 (náměstí),
322 / 503 726 (Lochotín) a 195 / 283 880 (Rokycany), vždy volání / trojúhelníky.

Na konci zbývá kontrola vzhledu autorem a samostatná kontrola modelem 6.1 Sol, Medium.

## Krok 2

Bylo nahrazeno odstraněné `PCFSoftShadowMap` za `PCFShadowMap`. Test startu a skutečné
minuty hraní ve dne i v noci před opravou selhal na zachyceném varování knihovny.
Rozpočty jsou po souhlasu autora převzaté z úplných původních měření E13 včetně stínů;
limit +10 % v testu se nemění. Jde o nápravu srovnatelnosti počítadel, nikoli zvětšení
povolené scény. Verze a licence three.js jsou uvedené i v „O hře“.

Ověření kroku 2: všech 33 testů Node, sestavení a všech 38 prohlížečových testů prošly,
včetně skutečné minuty hraní ve dne a v noci bez varování a chyb. Rozpočet prošel ve
všech třech pohledech. Při dočasném přidání 40 kopií oblohy bylo naměřeno 335 volání
proti limitu 324, po odebrání znovu 295. Zkouška tedy nadále rozpozná skutečný růst
práce. Srovnávací podklady jsou v `data-raw/e14/budget-negative-control.json`.
