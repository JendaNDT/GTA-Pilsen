# Stav etapy E19

Větev `etapa/E19` vychází z revize `fb29b92`. Autor potvrdil zahájení.
[Zadání E19](E19.md) · [Protokol E18](../E18.md)

| Krok | Stav |
| --- | --- |
| 1. Fyzikální chůze, schody, svahy a pády | Hotovo |
| 2. Střechy, mostovky, tunely a přestupy | Čeká |
| 3. Zábradlí a zobrazení kolizí | Čeká |
| 4. Kapsle okolních chodců a srážky | Čeká |
| 5. Pády postav a vstávání | Čeká |
| 6. Závěrečné zkoušky a protokol | Čeká |

## Ověření a otevřené otázky

Prošlo 76 testů JavaScriptu, sestavení a všech šest dotčených prohlížečových scénářů (WebGL 2). Zahrnují také dotykové ovládání, cestu k hamru, pěší předání u Boleváku a Klabavu. Záznamy jsou v `data-raw/e19/krok1-*.log`.

### První krok

Hráč používá v pevném kroku kapsli vysokou 1,8 m. V Node překonala schod
30 cm a svah 30°, zastavila před 50cm schodem a nevyšla 60° rampu. Ověřen
byl také skok, jednorázové poškození při pádu z 9 m a rozdíl mezi
odstrčením 8kg předmětu a 1 200kg tělesa. Kolize s registrovanými stromy
a sloupy zůstávají součástí pěšího pohybu. Koš zastupuje zkušební těleso,
městské vybavení patří podle plánu do E25.

Původní zkouška u Klabavy předpokládala pevný odstup chodidel 5 cm od
země. Kapsle se na svahu dotýká terénu stranou od své svislé osy. Test nyní
porovnává skutečný bod dotyku Jolt s výškou terénu ve stejných souřadnicích
se stejnou přesností na čtyři desetinná místa. Ověřuje také oporu a
vzdálenost bodu od osy postavy. Tento důvod patří i do závěrečného protokolu.

Výchozí snímek Wilsonova mostu z hlavní větve je v
`data-raw/e19/wilson-pred.jpg`. Otevřené otázky zatím nejsou.
