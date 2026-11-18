# Stav etapy E19

Větev `etapa/E19` vychází z revize `fb29b92`. Autor potvrdil zahájení.
[Zadání E19](E19.md) · [Protokol E18](../E18.md)

| Krok | Stav |
| --- | --- |
| 1. Fyzikální chůze, schody, svahy a pády | Hotovo |
| 2. Střechy, mostovky, tunely a přestupy | Hotovo |
| 3. Zábradlí a zobrazení kolizí | Čeká na rozhodnutí autora o nízkých mostech |
| 4. Kapsle okolních chodců a srážky | Čeká |
| 5. Pády postav a vstávání | Čeká |
| 6. Závěrečné zkoušky a protokol | Čeká |

## Ověření prvního kroku

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

### Druhý krok

První krok je v revizi `15e0ce9`. Při nástupu do auta, vrtulníku a MHD se
pěší těleso hned odstraní. Při výstupu se vedle dveří vyhledá blízký
povrch statické sítě Jolt. Na místě bez blízké opory hráč začne ve výšce
vozidla a může spadnout. Zkouška na stoupající vozovce ve Valíku zachytila,
že svislá složka rychlosti při chůzi do kopce byla považována za skok.
Po opravě určuje oporu kontakt s vozovkou.

Prošlo 76 testů JavaScriptu, produkční sestavení a šest dotčených
prohlížečových kontrol. Výstup na Wilsonově mostě, ve Valíku i po přistání
na střeše prošel na WebGL 2 i na WebGPU. Zápis běhu je v
`data-raw/e19/krok2-final.log`.

### Rozhodnutí pro třetí krok

Švédský most v Dobřívě (herní cesta 3070) má viditelné kamenné zábradlí po
obou stranách. V 161 příčných řezech vzdálených nejvýše 10 cm dosahuje rozdíl
mezi mostovkou a herním terénem na její ose nejvýše 0,61 m a na okrajích
0,77 m a 0,46 m. Při použití pravidla 1,5 m po celé délce by zmizelo celé
zábradlí i s překážkou pro chodce. Mezi 956 úseky silnic a cest označenými
jako most (bez sdílených mostovek) zůstalo při stejném odečtu 540 po celé
délce pod prahem. Jde o úseky mapových dat, jeden most může mít více úseků.

Autor má určit, zda zachovat zábradlí na vlastním mostě a práh uplatnit jen na
přechodech na souš, nebo práh uplatnit po celé délce i u těchto nízkých mostů.
Odečet lze zopakovat místně příkazem `node data-raw/e19/vysky-mostu.mjs`.
Do rozhodnutí čeká třetí krok. Profily mostů patří do E22.
