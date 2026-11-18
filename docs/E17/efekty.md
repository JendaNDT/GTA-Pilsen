# E17 · Obrazové efekty

## Průchod scény a vyhlazování

Astra před implementací ověřila rozhraní v three.js 0.187. Návrh po kontrole
ukládá normály přímo v souřadnicích kamery a při střihu vymaže historii
vyhlazování. Povrchy, které nezapisují hloubku, například průhledná světla
a pruhy na silnici, ovlivní barvu a ponechají normálu i pohyb plochy pod sebou.

| Předvolba | Vyhlazování |
| --- | --- |
| Ultra a vysoká | TRAA s údaji o pohybu objektů |
| Střední | SMAA |
| Nízká | FXAA, jeden barevný výstup scény |

WebGL 2 bez samostatného prolínání více výstupů použije SMAA i na vyšších
předvolbách. Prohlížeč bez podpory plovoucího barevného výstupu použije
přímé vykreslení. To lze zapnout i ručně parametrem `?postfx=0`.

Výsledný obraz vykresluje scénu jednou i při vyžádání několika obrazů
v témže kroku prohlížeče. Na WebGPU má stabilní obraz na náměstí po přidání
TRAA 555 volání a 1 055 780 trojúhelníků proti 554 a 1 055 779 před efektem.
[Náměstí](efekty/vyhlazovani-namesti.jpg) · [Valík](efekty/vyhlazovani-valik.jpg).
