# Stav etapy E15

Větev `etapa/E15` vychází z revize `415855a` na `main`. E14 je sloučená.
Autor potvrdil zahájení E15. [Zadání](E15.md) · [Protokol E14](../E14.md).

| Krok | Stav |
| --- | --- |
| 1. Sjednotit importy a ověřit je testem | Hotovo |
| 2. Zapojit nový vykreslovač na WebGL 2 | Zbývá |
| 3a. Převést oblohu a pořídit srovnávací snímek | Zbývá |
| 3b. Převést terén, vodu, dlažbu a výřezy portálů | Zbývá |
| 3c. Převést silnice a čáry | Zbývá |
| 3d. Převést budovy a okna | Zbývá |
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
  Dočasný import původního vykreslovače z jeho zdrojového modulu se odstraní v kroku 2.
- Od autora bude potřeba závěrečné ověření vzhledu a plynulosti na počítači a telefonu.
