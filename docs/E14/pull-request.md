# Připravený pull request E14

Cíl: `main`, zdroj: `etapa/E14`. Název: **Aktualizovat three.js na 0.187 a ověřit zachování vzhledu**.

Místní implementace a závěrečné kontroly jsou dokončené. Odeslání větve terminálem
selhalo kvůli chybějícím přihlašovacím údajům. GitHub Desktop ukazuje správné úložiště
a větev s tlačítkem **Publish branch**, ale automatické klikání selhává chybou
`noWindowsAvailable`. Větev zatím na vzdáleném úložišti není.

Autor může v GitHub Desktopu kliknout nahoře na **Publish branch**. Potom lze vytvořit
návrh pull requestu přes připojený GitHub nebo přes
[porovnání s main](https://github.com/JendaNDT/GTA-Pilsen/compare/main...etapa/E14?expand=1).
Sloučení čeká na nezávislou kontrolu a kontrolu autora.

## Popis pro vložení

Aktualizace připíná three.js na 0.187.0 a opravuje odstraněné nastavení měkkých stínů. Hra zůstává na WebGLRendereru se stávajícími materiály a vzhledem; v režimu `?debug` nově hlásí chybějící části vlastních shaderů. Všech 27 variant generuje po přidání kontrol stejné shadery.

Three.js nově započítává do statistik i stíny. Autor schválil přepočet referencí z původní E13 včetně stínů při zachování limitu +10 %. Ve třech pevných pohledech mají obě verze stejné úplné počty; dočasné přidání 40 volání hranici překročilo.

Ověření: čistá instalace, 38 testů Node, 13 testů Pythonu, kontrola syntaxe nástrojů, audit bez nálezů, sestavení a 38 prohlížečových testů včetně skutečné minuty hraní bez varování. Osm snímků je porovnaných s E13; zůstávají jen drobné rozdíly ve stínech.

Autor v Chrome pro testování naměřil v obou verzích přibližně 60 FPS a zadrhávání nepozoroval. Výkonnostní odchylky zůstávají uvedené: ruční p95 práce snímku 3,5 → 3,9 ms (+11,4 %), p95 GPU 12,22 ms proti pracovní mezi 12 ms. Automatické běhy kolísaly i bez stínů; nulová regrese se netvrdí.

Protokol: `docs/E14.md`. Před sloučením zbývá nezávislá kontrola modelem 6.1 Sol, Medium a autorova kontrola náměstí, Wilsonova mostu, Valíku a noci.

