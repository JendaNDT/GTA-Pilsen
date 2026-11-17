# Pracovní měření výkonu E14

**Etapa není uzavřená.** Autor 17. listopadu 2026 rozhodl počkat na ruční měření.
Příčina kolísání a části výsledků nad +10 % není potvrzená. Odchylka není schválená.

Revize hry E14 `146a263`, původní E13 `e6d5768`. Apple M4, arm64, macOS 27.2.1,
Chromium 159.0.8154.6, ANGLE Metal, 1920 × 1080 px, měřítko 1, vysoká kvalita,
pevné datum 17. listopadu 2026, počáteční čas 10:00 a vypnutá adaptace kvality.
Použit byl stávající `tools/measure_map.mjs --work`, tedy skutečná práce snímku
na procesoru a čas GPU zvlášť. Každý běh měří 10 s jízdy a 10 s letu.

Pět běhů každé verze se provedlo v pořadí E13-1, E14-1, E13-2, E14-2, E13-3,
E14-3, E14-4, E13-4, E13-5, E14-5. Prohlížečové testy neběžely souběžně.
Poslední čtyři běhy doplnily kontrolu opačného pořadí poté, co první série vykázala
rostoucí časy i v původní E13. Žádný výsledek nebyl odstraněn.

Tabulka uvádí **medián pěti samostatně naměřených statistik**; nejde o percentily
sloučených vzorků. Všechny hodnoty jsou v ms.

| Scénář a ukazatel | E13 | E14 | Změna |
| --- | ---: | ---: | ---: |
| Jízda · práce snímku · medián | 3.50 | 3.80 | +8.6 % |
| Jízda · práce snímku · p95 | 4.70 | 5.20 | +10.6 % |
| Jízda · práce snímku · p99 | 5.20 | 6.50 | +25.0 % |
| Jízda · GPU · medián | 5.42 | 5.89 | +8.8 % |
| Jízda · GPU · p95 | 6.37 | 7.37 | +15.7 % |
| Jízda · GPU · p99 | 6.81 | 8.84 | +29.8 % |
| Let · práce snímku · medián | 4.10 | 4.20 | +2.4 % |
| Let · práce snímku · p95 | 5.20 | 5.70 | +9.6 % |
| Let · práce snímku · p99 | 5.60 | 6.70 | +19.6 % |
| Let · GPU · medián | 6.05 | 7.01 | +15.9 % |
| Let · GPU · p95 | 7.12 | 8.63 | +21.3 % |
| Let · GPU · p99 | 7.51 | 9.06 | +20.7 % |

## Kolísání a hranice +10 %

Medián práce jízdy měl v E13 rozpětí 3,4–4,7 ms a v E14 3,4–5,5 ms. P99 práce
jízdy bylo 5,0–7,8 ms v E13 a 5,1–9,7 ms v E14. U letu byl medián práce
3,9–4,8 ms v E13 a 3,8–5,0 ms v E14. Největší naměřené p95 GPU bylo v E14
12,060 ms, tedy nepatrně nad pracovní mezí 12 ms.

Souhrnné p95 práce jízdy se zvýšilo o 10,6 %, p99 o 25 %. P99 práce letu vzrostlo
o 19,6 %. Také část časů GPU překračuje +10 %. Výsledky proto **nepotvrzují splnění
výkonnostní meze bez odchylky**. Samotná změna významu počítadel tyto časové rozdíly
nevysvětluje: časování zahrnuje celou práci vykreslení v obou verzích.

Kontrolní série s vysokou kvalitou a `shadows=0` v pořadí E14-1, E13-1, E13-2,
E14-2 zaznamenala kolísání i bez stínů. Například medián GPU letu v E14 vzrostl
z 2,47 na 4,21 ms, v E13 z 2,40 na 2,74 ms. Změna stínového filtru tak není
prokázaná jako jediná příčina. macOS při kontrole nehlásil tepelnou ani výkonnostní
výstrahu. Příčinu se nepodařilo spolehlivě určit a není uvedena jako vyřešená.

[Všechny běhy, souhrny a diagnostika bez stínů](mereni.json). Počty volání v surových
výsledcích E13 nezahrnují stíny, v E14 ano. Srovnatelné úplné počty geometrie
dokládá samostatné [ověření počítadel](pocitadla.json); tři pevné pohledy mají
v obou verzích stejné počty. Rozpočet po schváleném přepočtu dál povoluje +10 %.

## Ruční měření pro autora

Otevři postupně původní E13 a novou E14 v anonymním okně stejného prohlížeče.
Tím obě verze začnou bez uložené pozice. Použij stejnou velikost okna.
Následující adresy fungují, dokud běží připravené místní servery:

- [Původní E13](http://localhost:4174/?debug&adapt=0&quality=high&date=2026-11-17&hour=10)
- [Nová E14](http://localhost:4173/?debug&adapt=0&quality=high&date=2026-11-17&hour=10)

1. Klikni na **Hrát** a nech okolí dostavět.
2. Otevři **Měření** (nebo F9) a klikni na **Začít znovu**.
3. Zůstaň 60 sekund na výchozím místě. Potom označ a zkopíruj celý text výsledku.
4. První verzi zavři a stejný postup proveď ve druhé, aby neběžely souběžně.
5. Pošli oba texty označené E13 a E14, název prohlížeče a případné viditelné zadrhávání.

Po dodání výsledků zbývá vyhodnotit odchylku, dokončit protokol `docs/E14.md`,
aktualizovat katalog a přehledy, provést závěrečné testy a připravit pull request.
