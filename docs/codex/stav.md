# Stav etapy E21

Větev `etapa/E21` navazuje na E20 sloučenou revizí `623e081`. [Zadání E21](E21.md) · [Protokol předchozí etapy](../E20.md)

| Krok | Stav |
| --- | --- |
| 1. Registr a stálé identifikátory | Hotovo. Každý svět má vlastní registr. Značky a hlavy semaforů dostávají identitu ve zdrojovém pořadí své dlaždice před seskupením podle materiálu. |
| 2. Lampy | Zbývá spojit umístění, tělesa, skrytí světla, úlomky a opravu při přechodu času. |
| 3. Značky a semafory | Zbývá ohnutí, zlomení a pravidla přednosti. |
| 4. Mosty a uzavírky | Zbývá rozbití jednotlivých úseků a odtlačení zábrany. Historické mosty mají vlastní kamenné ohrazení. |
| 5. Následky nárazu | Zbývá hledanost, zvuky a správa počtu úlomků. |
| 6. Auta a garáž | Zbývají deformace, odpadlé díly, jízdní následky, uložení a oprava. |
| 7. Částice | Zbývají obě vykreslovací cesty a rozpočet. |
| 8. Závěrečné ověření | Zbývají zkoušky, výkon, snímky a protokol. |

Astra před implementací prověřila návrh. U lamp bude potřeba jeden společný výběr pro fyziku i vzhled, nezávislý na pořadí načítání sousedů. Pro mosty jsou zdrojem již oříznuté úseky hran. Připojené fyzikální těleso a zobrazený objekt mohou mít odlišnou dobu života. Změny po nárazu je potřeba provést po fyzikálním kroku. Otevřené otázky pro autora nyní nejsou.

Prošlo 102 ze 102 testů JavaScriptu a produkční sestavení. Nový test sestaví seznamy dvou dlaždic v obou pořadích, odliší tři předměty v každé a ověří poškození i opravu ve 4:00 dalšího dne. Všech 164 prohlížečových zkoušek prošlo za 45 minut bez vynechání nebo opakování. Záznamy jsou v `data-raw/e21/registr-prohlizec.{log,json}`. Následují lampy. Další záznamy jsou v `data-raw/e21/registr-{node,build}.log`.
