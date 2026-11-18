# Stav etapy E20

Větev `etapa/E20` vychází ze sloučené etapy E19 na revizi `10832b4`. [Zadání E20](E20.md)

| Krok | Stav |
| --- | --- |
| 1. Řidič AI | Hotovo. |
| 2. Provoz v okruhu hráče | Hotovo. Převzetí řízení fyzikou, pravidla na trase a volný vůz po nárazu. |
| 3. Zaparkovaná auta a policie | Hotovo. Střet a dojetí hlídky k chodci ověřeny ve hře. |
| 4. MHD a směny | Hotovo. Články vozidel, odstrčení auta, rozjezdy a brzdění ve směnách. |
| 5. Vrtulník | Hotovo. Let s asistencí, přistání na střeše a na heliportu. |
| 6. Voda | Hotovo. Vztlak a odpor vody, pozvolné potopení auta a plavání ke břehu. |
| 7. Závěrečné scénáře, výkon a protokol | Střet dvou jedoucích aut, odklizení vraku a měření ve špičce ověřeny. Otevřené jsou dlouhé fronty a vyjíždění z vozovky na Klatovské a u nádraží. Po opravě zbývají všechny testy, protokol a žádost o sloučení. |

## Otevřené otázky

Autor schválil rozumný odhad podvodního profilu. Využije obrys vodní plochy a výšku vykreslené hladiny.
Kontrolním údajem je kóta dna u Wilsonova mostu v městské tabulce. Poppler 26.11.0 z ní přečetl profil R19 v říčním km 1,372 s kótou 299,30 m n. m. Hloubku určuje rozdíl od hladiny.
Měřené příčné profily nebudou potřeba. [Tabulka města](https://gis.plzen.eu/foto/pov_model/profily/PM_Psany_PP.pdf)

Autor schválil, že cizí nepojízdné auto může hra odklidit po minutě stání, jakmile je celé mimo záběr. Hráčovo poslední auto, právě řízené auto a auto z garáže jsou chráněná.

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

### Šestý krok

Voda v materiálu terénu používá stejnou síť jako `world.heightAt`. Dno pro kola vychází z obrysu vody včetně ostrovů. Do osmi metrů od břehu klesá přibližně o 12 cm na metr, dále o 2,5 cm na metr, nejvýše do hloubky 2,4 m. Na ose Wilsonova mostu poblíž středu řeky je herní hladina ve výšce 300,70 m n. m. Při vzdálenosti 30,5 m od břehu vychází odhad dna na 299,18 m n. m., tedy asi o 12 cm níž než údaj města. Tvar koryta mezi břehy je odhad.

V obou vykreslovačích malé auto sjelo ze suchého západního břehu do Radbuzy asi 20 m po proudu od mostu. Při zkoušce zaznělo jedno šplouchnutí, vůz plaval bez dotyku kol se dnem, hráč vyplaval a dostal se zpět na souš. Od prvního kontaktu s vodou po úplné ponoření a vyřazení auta uplynulo 7,05 s. Na mělčině zůstává vyčnívající karoserie ve hře. Prošlo 90 testů JavaScriptu, sestavení a devět závěrečných prohlížečových scénářů. Širší ověření jízdy, fyziky a vody mělo 20 úspěšných scénářů. Záznamy jsou v `data-raw/e20/krok6-{node,build,overeni,kalibrace}.log`.

První delší pozorování okolního provozu odhalilo chyby při odbočení do Husovy a při návratu převráceného auta do provozu. Ve špičce některé vozy zůstaly stát několik minut. Pro přijetí kroku 7 je potřeba odstranit příčiny a dlouhý běh zopakovat. Souřadnice a průběh jsou v `data-raw/e20/stopa-Klatovská.json` a `data-raw/e20/pozorovani-v2-*.json`.

### Sedmý krok, rozpracováno

Střet s jedoucím autem provozu i odbočení z ulice Kardinála Berana do Husovy už mají vlastní zkoušku ve hře. Přední vůz při střetu zrychlil, hráčův zpomalil, oba utrpěly škodu. Převrácené auto už se nepokouší jet po střeše. Odklizení cizího auta hlídá dobu stání, vlastníka a okraje záběru kamery včetně rozměrů auta. Prošlo 92 testů JavaScriptu a sestavení. Zbývá ověřit návrat plynulého provozu v husté dopravě a uzavřít společné měření, testy a protokol.

K uložení této části sedmého kroku prošlo 13 prohlížečových scénářů provozu a MHD a samostatná prohlížečová zkouška odklizení vraku. Ověřila dobu před minutovým limitem, viditelný vrak po limitu, odstranění po otočení kamery a zachování posledního i garážového auta. Předběžné dlouhé pozorování stále zachytilo dlouhé fronty a vyjetí z vozovky. Záznamy jsou v `data-raw/e20/{krok7-odklid,vrak,odklid-provoz}.log`.

#### Pokračování po revizi `33b5724`

Průběžný provoz při výběru trasy prověřuje slepé ulice a na navazující jednosměrce drží pruh. Při parkování se kontrolují i rohy karoserie, aby auto nezasahovalo do křižovatky. Když místo na trase právě zabírá auto, vůz MHD se zařadí až po jeho uvolnění. Obě změny prošly zkouškou ve hře. Při návratu po nehodě řidič kontroluje směr, prostor a dotyk kol s vozovkou. Při bočním odstrčení dalším autem nebo tramvají řízení převezme fyzika.

Měření na Klatovské proběhlo na autorově Macu v pondělní herní špičce v 7.30, na vysoké předvolbě a s WebGPU. Během 10 sekund měření bylo v blízkosti až 40 aut s plnou fyzikou, z nich až 18 s aktivním řidičem. Z 604 měřených kroků fyziky jich 95 % trvalo nejvýše 3,80 ms při rozpočtu 4 ms. Příkaz je `node tools/measure_map.mjs http://127.0.0.1:4173/ --rush`, výsledek je v `data-raw/e20/vykon-spicka.json`.

Desetiminutová zkouška ve hře sleduje ranní provoz dvakrát. U hlavního nádraží stojí pozorovatel na chodníku u Železniční, přibližně 88 m od bodu nádražní budovy. Při prvním běhu na těchto místech se na Klatovské za deset minut vystřídalo 117 fyzikálně řízených aut a u nádraží 69. V každé minutě se některá auta pohybovala. Nejdelší souvislé čekání jednoho vozu ale dosáhlo 356,5 s na Klatovské a 448,5 s u nádraží, nad mezí 120 s. Pod plynem vyjela auta také z vozovky, mimo jiné na úsecích 28371 na Klatovské a 20738 na Železniční. Časy a souřadnice jsou v `data-raw/e20/pozorovani2/*/pozorovani.json`.

Před uložením prošlo 92 z 92 testů JavaScriptu, 23 z 23 testů Pythonu a sestavení. Z 16 dotčených prohlížečových scénářů jich původně prošlo 15. Šestnáctý používal aktuální čas počítače a ve večerním jízdním řádu nenašel svůj zkušební spoj. Po nastavení pondělí v 7.30 prošla kontrola semaforu pro chodce, trolejbus 10 a tramvaj 4 se stejnými očekáváními. Záznamy jsou v `data-raw/e20/krok7-pravidla.log` a `krok7-semafor.log`.

Při posledním opakování prošly obě zkoušky tramvaje a společná zkouška semaforů. Obě desetiminutová pozorování znovu selhala. Na Klatovské stálo auto 284,5 s na úseku 19355 před úsekem 4, i když na konci čekání řidič požadoval 10,9 m/s. U nádraží bylo nejdelší čekání 201 s na Barrandově, na úseku 1173 před úsekem 6376, kde řidič žádal nulovou rychlost. První vyjetí nastala v sadech Pětatřicátníků a na Koterovské. Záznamy jsou v `data-raw/e20/krok7-ulozeni/*/pozorovani.json`.

Na této větvi pokračovat krokem 7. Po sestavení lze opakovat obě pozorování příkazem `npm run test:e2e -- traffic-observation.spec.js --trace off --output=data-raw/e20/dalsi-pozorovani`. Každý běh zapíše do souboru `pozorovani.json` také místo nejdelšího čekání, požadovanou rychlost řidiče a první souřadnice vyjetí. Zbývá opravit dlouhé čekání a vyjíždění, zopakovat kontrolu i měření a pak uzavřít E20. Od autora nyní nic dalšího nepotřebujeme.
