# Stav etapy E19

Větev `etapa/E19` vychází z revize `fb29b92`. Všech šest kroků je dokončeno. Zbývá autorská kontrola a sloučení do hlavní větve. Otevřené otázky pro E19 nejsou.
[Zadání E19](E19.md) · [Protokol E19, měření a snímky](../E19.md)

| Krok | Stav |
| --- | --- |
| 1. Fyzikální chůze, schody, svahy a pády | Hotovo |
| 2. Střechy, mostovky, tunely a přestupy | Hotovo |
| 3. Zábradlí a zobrazení kolizí | Hotovo. Společný vnější obvod a obě strany všech 20 mostů prošly kontrolou. |
| 4. Kapsle okolních chodců a srážky | Hotovo |
| 5. Pády postav a vstávání | Hotovo |
| 6. Závěrečné zkoušky a protokol | Hotovo. Výsledky jsou v protokolu E19. |

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
`data-raw/e19/wilson-pred.jpg`. Po prvním kroku nebyly otevřené otázky.

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

Autor určil, že na historických mostech s kamenným ohrazením má chodce zachytit
samotná zídka. Na Švédský ani Wilsonův most se nepřidává další zábradlí.
Pro ostatní úseky platí práh 1,5 m ze zadání. Výškový odečet lze zopakovat
příkazem `node data-raw/e19/vysky-mostu.mjs`.

### Třetí krok

Vykreslování a fyzika používají stejné body okrajů a drátový pohled F8 zobrazuje
i překážky pro chodce. Při rozběhu na vedlejší mostovku uměl Jolt vyzvednout
kapsli na hranu. Změna polohy při takovém kroku se dříve přenesla do rychlosti
jako skok. Oprava zachovává rychlost skutečného skoku a zabrání vymrštění
postavy. Záznamy z obou verzí jsou v `data-raw/e19/stopy.json` a
`data-raw/e19/vzorek-oprava.json`.

Na Domažlické u bodu (−2137,60 m, 495,30 m) má silniční úsek 2256 poloviční
šířku 5,60 m. Střed pěšího úseku 2450 leží 5,32 m od osy vozovky a jeho
povrch je o 0,24 m výš. Silniční zábradlí proto protíná chodníkovou kapsli
o poloměru 0,35 m už na ose pěší cesty. V datech chybí příznak sdílené
mostovky. Na mostě K Prokopávce se dva profily liší ve výšce jen o 0,01 m
a zábradlí pěšího úseku 4598 leží uvnitř mostovky úseku 665.
Autor schválil vedení zábradlí po vnějším obvodu společné plochy.

Při průchodu spodem pod Wilsonovým mostem vybrala zkouška střed řeky.
Zkouška v původním čase řeku nepřekonala. V hlavní ose mostu vyšlo při
vzorkování po 6,2 cm místo s největším odstupem od suchého terénu jen 4 cm
pod mostovkou. Ověření průchodu pod mostem zůstává otevřené. Podklady
jsou v `data-raw/e19/pruchod.log`.

Prošlo všech 77 testů JavaScriptu včetně 100 náběhů pod různými úhly,
produkční sestavení a obě kontroly rozpočtu nízké kvality. V závěrečném
cíleném běhu prošlo šest z osmi prohlížečových kontrol. Obě kamenné zídky
udržely hráče na Švédském i Wilsonově mostě ve WebGL 2 i WebGPU.
[Snímek Švédského mostu](../E19/svedsky-most.jpg)

V rozšířené zkoušce 18 dalších mostů včetně Rondelu neprošla v obou
vykreslovačích výška postavy na úseku 363. Po puštění směru skončila 1,15 m
nad výchozí úrovní. Po rozhodnutí o překrývajících se mostovkách znovu
prověřit geometrii okolí, výšku při náběhu i po zastavení a oba směry
u všech 20 mostů. Zkouška zůstává zapnutá ve stejné přesnosti. Výsledky jsou
v `data-raw/e19/predani3.log`. To byl stav před úpravou společného obvodu.

### Společný obvod vozovky a chodníku

Zábradlí končí přesně tam, kde jeho hranu překryje sousední mostovka ve stejné
úrovni. Při výpočtu se používá tloušťka mostovky stejně jako při jejím
vykreslení a ve fyzice. Oddělená výšková patra si zachovávají vlastní okraje.
Na historických mostech s kamenným ohrazením zachytí hráče přímo zídka.

U společné plochy teď zkouška měří odstup od skutečné vnější hrany a výšku nad
mostovkou v místě zastavení. Na šikmém okraji běžec po prvním dotyku zatlačí
dvě sekundy kolmo proti zábradlí. Po puštění směru musí stále stát na mostě.
Přesnost výškové zkoušky zůstala 15 cm u zídek a 35 cm u ostatních mostů.
Na Domažlické vede příčná trasa třemi čtvrtinami délky pěšího úseku 2450,
kde mají obě vnější strany předepsanou výšku nad terénem. Z chodníku hráč
urazil k protějšímu zábradlí 23,63 m. Samostatná podélná zkouška prochází
chodník od metru za začátkem do metru před koncem. Stejnou trasu po chodníku
má i Wilsonův most.

[Snímek Domažlické před E19](../E19/domazlicka-pred.jpg) ·
[Stejný pohled po úpravě](../E19/domazlicka-po.jpg)

**Poslední ověření.** Prošlo všech 79 testů JavaScriptu, produkční sestavení a
16 dotčených prohlížečových kontrol. Oba vykreslovače ověřily 40 náběhů na
vnější okraje 20 mostů, obě podélné trasy, výstupy z vozidel, průchod pod lávkou
U Prazdroje, pohyb pod Wilsonovým mostem řekou a rozpočet nízké kvality.
Prošly i trasy k hamru, u Klabavy, pěší předání u Boleváku a průjezd auta
ulicí U Prazdroje. Výsledky jsou v `data-raw/e19/obrys-{node,build,e2e,trasy}.log`.

**Rozhodnutí autora.** Suchá cesta po nábřeží pod Wilsonovým mostem patří
do E22. V E19 je ověřen pohyb řekou pod Wilsonovým mostem a pěší průchod
po suchu pod lávkou U Prazdroje. Zbývají kroky 4 až 6.

### Čtvrtý krok

Chodci do 80 m mají ve fyzice kapsli. Auta i při pěší hře předávají fyzice
svůj pohyb. Rychlost a směr zásahu se přebírají při dotyku auta s kapslí.
U hráče se počítá i dotyk virtuální kapsle, která může před kapotou ustoupit
dříve, než na sebe narazí vnitřní tělesa. Jedna srážka hráčova auta přičetla
jeden přestupek. Auto nad hlavou chodce ho nezasáhlo.

Prošlo všech 80 testů JavaScriptu a produkční sestavení. V prohlížeči prošlo
17 kontrol dopravy a fyziky a závěrečné čtyři zkoušky zasažení chodce i hráče
na WebGL 2 a WebGPU. Zápisy jsou v `data-raw/e19/krok4-{node,build,e2e,final}.log`.
Následují pády, vstávání a závěrečné ověření.

### Pátý krok

Postava má při pádu 11 samostatných částí a deset kloubů. Při nárazu rychlostí
10 m/s dolehla v obou směrech na podložku a uklidnila se do pěti sekund.
Hráče během pádu sleduje kamera a po dvou až čtyřech sekundách se vrátí k chůzi.
Ostatní chodci začnou vstávat po třech sekundách klidu. Přechod do stoje trvá
0,35 sekundy. Při zaplnění limitu se uvolní nejstarší postava.
Volba „Fyzikální pády postav“ v nastavení se ukládá. Ve starších uložených
hrách je zapnutá. Prostředky Jolt se po pádu uvolní.

Prošlo všech 82 testů JavaScriptu, produkční sestavení, sedm prohlížečových
kontrol pádů s výchozí jízdou i sedm s původní jízdou. Oba vykreslovače
ověřily zásah auta, jediný úbytek zdraví při pádu z devíti metrů, návrat
ovládání i výměnu nejstarší postavy v nízké kvalitě. Opakovaný náraz na
stejném úseku u Prazdroje také prošel. Zápisy jsou v
`data-raw/e19/{vstani,krok5-old,krok5-silnice,krok5-node,krok5-build}.log`.

### Šestý krok

Prošlo 82 testů JavaScriptu, 23 testů Pythonu, produkční sestavení a všech
127 prohlížečových zkoušek (88 WebGL 2, 39 WebGPU) za 42 minut.
Výsledky jsou v `data-raw/e19/final-{node,python,build}.log` a
`data-raw/e19/uplne.log`. Dvakrát za každou verzi byla porovnána jízda a let.
Časy z obou měření i první samostatný výkyv GPU jsou v [protokolu](../E19.md).
README, katalog a nabídka „O hře“ popisují nové chování. Doporučená kontrola
je Sol s vysokou úrovní uvažování. Nábřeží pod Wilsonovým mostem patří do E22.
