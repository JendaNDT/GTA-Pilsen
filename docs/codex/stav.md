# Stav etapy E20

Větev `etapa/E20` vychází ze sloučené etapy E19 na revizi `10832b4`. [Zadání E20](E20.md)

| Krok | Stav |
| --- | --- |
| 1. Řidič AI | Hotovo. |
| 2. Provoz v okruhu hráče | Hotovo. Převzetí řízení fyzikou, pravidla na trase a volný vůz po nárazu. |
| 3. Zaparkovaná auta a policie | Hotovo. Střet a dojetí hlídky k chodci ověřeny ve hře. |
| 4. MHD a směny | Hotovo. Články vozidel, odstrčení auta, rozjezdy a brzdění ve směnách. |
| 5. Vrtulník | Hotovo. Let s asistencí, přistání na střeše a na heliportu. |
| 6. Voda | Zbývá |
| 7. Závěrečné scénáře, výkon a protokol | Zbývá |

## Otevřené otázky

Autor schválil rozumný odhad podvodního profilu. Využije obrys vodní plochy a výšku vykreslené hladiny.
Kontrolním údajem je kóta dna u Wilsonova mostu v městské tabulce. Poppler 26.11.0 z ní přečetl profil R19 v říčním km 1,372 s kótou 299,30 m n. m. Hloubku určuje rozdíl od hladiny.
Měřené příčné profily nebudou potřeba. [Tabulka města](https://gis.plzen.eu/foto/pov_model/profily/PM_Psany_PP.pdf)

## Ověření

Řidič dostává trasu, povolenou rychlost a vzdálenost od předního nárazníku k místu zastavení.
Tři zkoušky v Node používají skutečné čtyřkolové vozidlo s motorem, brzdami a odpružením. Na rovince byla největší odchylka 0,02 m, na kružnici s poloměrem 15 m byla 0,11 m. Z 50 km/h zastavil nárazník 0,61 m před čárou. Prošlo 85 z 85 testů JavaScriptu a produkční sestavení. První krok ještě nemění běžící hru.

### Druhý krok

Okolní auto přebírá čtyřkolový model do 150 m po načtení terénu a drží ho až do 220 m.
Předvolby dovolují 40, 40, 20 nebo 10 takových aut. Při obou přechodech zůstává stejné auto na své trase.
V prohlížeči fyzikální vůz u stopky na Doudlevecké zastavil a po splnění pravidla pokračoval.
Prošlo všech 86 testů JavaScriptu, produkční sestavení a 16 prohlížečových kontrol fyziky a dopravy.
Zahrnují kolonu před obsazeným výjezdem na Tylově i jízdu hráčovým autem na WebGPU a WebGL 2.
Záznamy jsou v `data-raw/e20/krok2-{node,build,ove}.log`.

### Třetí krok

Poblíž hráče zaparkované auto spí, čelní náraz ho probudí a odstrčí. Hlídka používá stejný regulátor jako ostatní auta,
sleduje trasu k hráči a před stojícím chodcem zastaví v dosahu zatčení. V rozpočtu počtu aut má při pronásledování přednost.
Prošlo všech 86 testů JavaScriptu, sestavení a všech 11 dotčených prohlížečových kontrol včetně nehody, hlídky, pokuty a pádů chodců.
Záznamy jsou v `data-raw/e20/krok3-{node,build,e2e}.log`.

### Čtvrtý krok

Prošlo 87 testů JavaScriptu, produkční sestavení a prohlížečové sady MHD, směn a provozu.
Tramvaj při náhlé překážce brzdila a odtlačila stojící auto. Při skoku v čase se staré těleso odebere,
aby při přemístění vozu mezi zastávkami neodstrčilo chodce. Kontrola ověřila i pěší přestup na náměstí Republiky.
Při stejném průjezdu jako v E12 získala tramvaj 1 celkem 93 bodů, trolejbus 16 získal 99 a autobus 30 získal 100.
Rozjezd i přechod na provozní brzdu mají omezenou změnu zrychlení. Nouzové zabrzdění má kratší dráhu.
Záznamy jsou v `data-raw/e20/krok4-{node,build,final,smeny,provoz}.log` a `krok4-body.json`.

### Pátý krok

Vrtulník váží 2 500 kg. Zkouška s počátečním náklonem a klesáním ověřila, že při zapnuté asistenci udrží výšku v rozmezí ±0,5 m po dobu 20 sekund. Ve hře bez poškození přistál z výšky 12 m na střeše FN Lochotín i na pozemním heliportu. Prošlo všech 88 testů JavaScriptu, produkční sestavení a čtyři prohlížečové kontroly včetně načtení vypnuté asistence, dokončení rozvozu a návratu od hranice mapy. Záznamy jsou v `data-raw/e20/krok5-{node,build,final}.log`.
