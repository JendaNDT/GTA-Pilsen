# Připravený pull request E14

Cíl: `main`, zdroj: `etapa/E14`. Název: **Aktualizovat three.js na 0.187 a ověřit zachování vzhledu**.

[Návrh PR č. 6](https://github.com/JendaNDT/GTA-Pilsen/pull/6) je otevřený do `main`.
Autor odeslal celou větev přes Publish branch v GitHub Desktopu. Ověření místní
a vzdálené historie potvrdilo shodný commit `0722a49` a žádné rozdílné commity.

Autor dne 17. listopadu 2026 výslovně vynechal zbývající ruční a modelovou kontrolu
a schválil sloučení celého PR včetně uvedených odchylek.
Výkonnostní odchylky jsou popsané v protokolu i v popisu PR. Místní závěrečné testy
prošly; výsledky kontrol GitHub Actions je třeba posuzovat samostatně.

## Popis pro vložení

Aktualizace připíná three.js na 0.187.0 a opravuje odstraněné nastavení měkkých stínů. Hra zůstává na WebGLRendereru se stávajícími materiály a vzhledem; v režimu `?debug` nově hlásí chybějící části vlastních shaderů. Všech 27 variant generuje po přidání kontrol stejné shadery.

Three.js nově započítává do statistik i stíny. Autor schválil přepočet referencí z původní E13 včetně stínů při zachování limitu +10 %. Ve třech pevných pohledech mají obě verze stejné úplné počty; dočasné přidání 40 volání hranici překročilo.

Ověření: čistá instalace, 38 testů Node, 13 testů Pythonu, kontrola syntaxe nástrojů, audit bez nálezů, sestavení a 38 prohlížečových testů včetně skutečné minuty hraní bez varování. Osm snímků je porovnaných s E13; zůstávají jen drobné rozdíly ve stínech.

Autor v Chrome pro testování naměřil v obou verzích přibližně 60 FPS a zadrhávání nepozoroval. Výkonnostní odchylky zůstávají uvedené: ruční p95 práce snímku 3,5 → 3,9 ms (+11,4 %), p95 GPU 12,22 ms proti pracovní mezi 12 ms. Automatické běhy kolísaly i bez stínů; nulová regrese se netvrdí.

Protokol: `docs/E14.md`. Autor 17. listopadu 2026 výslovně vynechal zbývající ruční a modelovou kontrolu a schválil sloučení celého PR včetně popsaných odchylek. Vynechané kontroly nejsou označené jako úspěšné.

