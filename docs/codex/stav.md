# Stav etapy E15

Větev `etapa/E15` vychází z revize `415855a` na `main`. E14 je sloučená.
Autor potvrdil zahájení E15. [Zadání](E15.md) · [Protokol E14](../E14.md).

| Krok | Stav |
| --- | --- |
| 1. Sjednotit importy a ověřit je testem | Hotovo · `a68135b` |
| 2. Zapojit nový vykreslovač na WebGL 2 | Hotovo · `27a2d77` |
| 3a. Převést oblohu a pořídit srovnávací snímek | Hotovo · `4e42957` |
| 3b. Převést terén, vodu, dlažbu a výřezy portálů | Hotovo · `a700323` |
| 3c. Převést silnice a čáry | Hotovo · `f755611` |
| 3d. Převést budovy a okna | Hotovo · `d5d71b8` |
| 3e. Převést náhon a skvrny lamp | Hotovo · `e8cf715` |
| 3f. Převést detaily modelů | Hotovo · `0fa6385` |
| 4. Zapnout WebGPU a ověřit automatický i vynucený návrat na WebGL 2 | Hotovo · `3676b27` |
| 5. Dokončit měření, sady Playwright a kontroly na GitHubu | Hotovo · `43dbc63` |
| 6. Porovnat referenční snímky, změřit výkon a uzavřít protokol | Hotovo |

## Ověření a podklady

- Prohlížeč Playwright umí na tomto Macu WebGL 2 i WebGPU přes SwiftShader.
  Při použití příznaků pro projekt WebGPU je dostupné i měření časových značek GPU.
- Výchozí sestavení E14 pro porovnání je v `data-raw/e15/baseline-dist/`.
  Kamery a referenční snímky jsou v [protokolu E14](../E14.md#snímky-před-a-po).
- Krok 1 prošel 39 testy Node a produkčním sestavením. Prošlo sedm vybraných prohlížečových kontrol včetně
  rozpočtu, uložené hry, dotyku a minuty hraní bez varování. Úplná sada je naplánovaná
  na závěr etapy. Logy jsou v `data-raw/e15/`.
- Krok 2 spouští nový vykreslovač zatím výhradně na WebGL 2. Základní materiály
  a nastavení stínů fungují. Vlastní detaily povrchů se převádějí v kroku 3. Textury dlaždic se nahrávají ihned před opětovným použitím plátna.
- Srovnatelné počítadlo je v novém vykreslovači `renderer.info.render.drawCalls`.
  Nuluje se jednou před snímkem, aby zahrnovalo stíny i výstupní průchod.
  Při zkušebním měření přibyl jeden výstupní trojúhelník a jedno volání na pohled.
  Limity rozpočtu zůstávají stejné.
- Od autora bude potřeba závěrečné ověření vzhledu a plynulosti na počítači a telefonu.
- Ověření kroku 2: 39 testů Node, produkční sestavení a tři vybrané prohlížečové
  testy (rozpočet, menu s použitým vykreslováním a dotykový panel) prošly.
- Ověření kroku 3a: 39 testů Node, sestavení a prohlížečový test mraků a tmy prošly.
  Snímky [ve dne](../E15/kroky/03a-obloha-den.jpg) a [v noci](../E15/kroky/03a-obloha-noc.jpg)
  zachycují stejný pohled jako E14. Průměry vybraných plošek oblohy se liší nejvýš
  o 0,30 z 255 v jednotlivých barevných kanálech.
- Ověření kroku 3b: 39 testů Node, sestavení, průjezd oběma tubusy Valíku
  a prohlížečová kontrola vody, dlažby a obou výřezů prošly. Testy práce s původním
  textem shaderu terénu nahradilo ověření 18 sdílených variant a kontroly obrazu.
  Snímky [Wilsonova mostu](../E15/kroky/03b-voda.jpg), [Valíku](../E15/kroky/03b-valik.jpg)
  a [dlažby](../E15/kroky/03b-dlazba.jpg) ukazují převedené povrchy. Fasády jsou v těchto
  snímcích ještě bez detailů.
- Ověření kroku 3c: 40 testů Node, sestavení a prohlížečový test světlé čáry
  na tmavém asfaltu prošly. Test náhrad textu shaderu země vystřídala kontrola
  společného materiálu, odsazení vrstev a viditelného značení.
  Závěrečné porovnání zachycuje přechod v centru
  [v E14](../E15/kroky/03c-vozovka-e14.jpg) a [v E15](../E15/kroky/03c-vozovka.jpg).
- Ověření kroku 3d: 41 testů Node, sestavení a prohlížečové testy nočních oken
  a dotykového ovládání prošly. Čtyři varianty fasád sdílejí uzly. Test starého klíče
  shaderu vystřídala kontrola, že nízká kvalita nepoužívá detailní fasádní materiál.
  Na [nočním snímku](../E15/kroky/03d-okna.jpg) mají vybraná okna stejnou barvu jako v E14,
  na [denním snímku](../E15/kroky/03d-fasady.jpg) jsou místy o něco světlejší stíny.
- Ověření kroku 3e: 41 testů Node, sestavení, vykreslení památek, změna odlesku
  v náhonu a přisvícení pod lampou prošly. [Náhon](../E15/kroky/03e-nahon.jpg) odpovídá
  E14. [Skvrny lamp](../E15/kroky/03e-lampy.jpg) jsou místy tmavší. Nový vykreslovač
  sčítá světlo před tónováním a převodem do barev displeje.
- Ověření kroku 3f: 37 testů Node, sestavení a prohlížečová kontrola
  světlometů prošly. Světlomet má stejnou průměrnou barvu na [snímku E14](../E15/kroky/03f-svetlomety-e14.jpg)
  a [snímku E15](../E15/kroky/03f-svetlomety.jpg). Místo posledního zásahu do textu shaderu a čtyř
  testů starých náhrad se ověřuje vykreslený světlomet. Kontrola zdrojů nyní hlídá, že se staré metody nevrátí.
- Ověření kroku 4: 37 testů Node, sestavení a tři prohlížečové starty prošly.
  Chromium se skutečným adaptérem WebGPU vykreslilo hru a panel ukazuje WebGPU.
  Vynucená cesta i automatický přechod v prohlížeči bez WebGPU zobrazily WebGL 2.
  Měření GPU na nové cestě se doplňuje v kroku 5.
- Ověření kroku 5: 38 testů Node, 13 testů Pythonu, sestavení, všech osm testů
  projektu WebGPU a čtyři vybrané testy WebGL 2 prošly. V obou režimech Mac vrátil
  skutečné časy GPU. Měření zahazuje staré časové výsledky. CI má oba projekty na Node 24.
- Krok 6 má všech 16 [referenčních snímků](../E15/snimky.md) a dokončené
  [měření na Macu](../E15/mereni.md). P95 práce na WebGPU kleslo z 6,6 na 4,2 ms
  při jízdě a z 6,5 na 3,8 ms při letu. Zpomalení záložního WebGL 2 je zdokumentované.
  Úplný běh ověřil 53 z 54 scénářů v obou prohlížečových projektech.
- Závěrečný běh u Krkavce odhalil závod mezi kontrolou textu a vypršením krátkého
  oznámení po přesunu. Test čte stejný text v okamžiku jeho zobrazení a prošel třikrát.
  Pravidla hry se kvůli tomu neměnila. Logy jsou v `data-raw/e15/final-*.log`
  a `data-raw/e15/release-fixed.log`.
- Protokol, README a katalog jsou aktualizované. S opakováním opraveného scénáře
  prošlo všech 54 kontrol. Etapa je připravená ke kontrole na větvi `etapa/E15`.
  Zbývá autorova kontrola vzhledu, startu a plynulosti na telefonu a kontrola
  modelem Astra, High. [Protokol a kontrola pro autora](../E15.md).
