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
| 3d. Převést budovy a okna | Hotovo |
| 3e. Převést náhon a skvrny lamp | Zbývá |
| 3f. Převést detaily modelů | Zbývá |
| 4. Zapnout WebGPU a ověřit automatický i vynucený návrat na WebGL 2 | Zbývá |
| 5. Dokončit měření, sady Playwright a kontroly na GitHubu | Zbývá |
| 6. Porovnat referenční snímky, změřit výkon a uzavřít protokol | Zbývá |

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
  [Vozovka u Valíku](../E15/kroky/03c-vozovka.jpg).
- Ověření kroku 3d: 41 testů Node, sestavení a prohlížečové testy nočních oken
  a dotykového ovládání prošly. Čtyři varianty fasád sdílejí uzly. Test starého klíče
  shaderu vystřídala kontrola, že nízká kvalita nepoužívá detailní fasádní materiál.
  Na [nočním snímku](../E15/kroky/03d-okna.jpg) mají vybraná okna stejnou barvu jako v E14,
  na [denním snímku](../E15/kroky/03d-fasady.jpg) jsou místy o něco světlejší stíny.
