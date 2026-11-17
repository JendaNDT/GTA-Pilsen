# Picomatch 4.0.7 s místní opravou

Zdrojový balíček je převzatý z npm, licence MIT je v souboru LICENSE.

- Zdroj · https://registry.npmjs.org/picomatch/-/picomatch-4.0.7.tgz
- SHA-256 archivu · `697b463be3cdbd9ffc8f4194fd5019a69ddf95875fb703d78b2b115cc9e740a8`
- Upozornění · https://github.com/advisories/GHSA-fc5q-39xc-vjpf

Místní změna v `lib/parse.js` rozšiřuje existující ochranu opakovaných skupin o jedinou
větev obsahující volnou hvězdičku. Jednoduché skupiny jako `+(*a)` a `*(*)` se převedou
na jediný výskyt své větve, který pohltí i její opakování. U vnější hvězdičky je větev
volitelná. Tím odpadne vnoření neomezených opakování. Složitější rizikové skupiny se
podle dosavadní politiky knihovny chápou jako doslovný text. Hvězdičky uvnitř znakové
třídy, uvozovek, escapovaného textu nebo vnořené skupiny tato nová podmínka neoznačuje.

Balíček používají Vite, tinyglobby a fdir přes `overrides` v hlavním package.json.
Místní číslo verze je `4.0.8-plzen.1`. Toto označení patří opravě tohoto projektu,
upstream vydání s touto verzí neexistuje. V původním package.json jsou odstraněné
vývojové závislosti a příkazy, protože tento projekt přebírá jen knihovnu.
Konkrétní opravu vedle auditu ověřuje také test projektu, včetně kontroly skutečně
načtené závislosti Vite.

Po vydání upstream opravy nahraď místní balíček opravenou verzí z npm a spusť audit,
testy opravy i úplnou kontrolní sadu hry.
