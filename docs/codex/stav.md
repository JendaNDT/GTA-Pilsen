# Stav etapy E21

Větev `etapa/E21` navazuje na E20 sloučenou revizí `623e081`. [Zadání E21](E21.md) · [Protokol předchozí etapy](../E20.md)

| Krok | Stav |
| --- | --- |
| 1. Registr a stálé identifikátory | Hotovo. Každý svět má vlastní registr. Značky a hlavy semaforů dostávají identitu ve zdrojovém pořadí své dlaždice před seskupením podle materiálu. |
| 2. Lampy | Rozpracováno. Společné umístění pro grafiku a fyziku, sražení, oprava a obě části lampy jsou zapojené. Probíhá ověření. |
| 3. Značky a semafory | Zbývá ohnutí, zlomení a pravidla přednosti. |
| 4. Mosty a uzavírky | Zbývá rozbití jednotlivých úseků a odtlačení zábrany. Historické mosty mají vlastní kamenné ohrazení. |
| 5. Následky nárazu | Zbývá hledanost, zvuky a správa počtu úlomků. |
| 6. Auta a garáž | Zbývají deformace, odpadlé díly, jízdní následky, uložení a oprava. |
| 7. Částice | Zbývají obě vykreslovací cesty a rozpočet. |
| 8. Závěrečné ověření | Zbývají zkoušky, výkon, snímky a protokol. |

Astra před implementací prověřila návrh. U lamp bude potřeba jeden společný výběr pro fyziku i vzhled, nezávislý na pořadí načítání sousedů. Pro mosty jsou zdrojem již oříznuté úseky hran. Připojené fyzikální těleso a zobrazený objekt mohou mít odlišnou dobu života. Změny po nárazu je potřeba provést po fyzikálním kroku. Otevřené otázky pro autora nyní nejsou.

Prošlo 102 ze 102 testů JavaScriptu a produkční sestavení. Nový test sestaví seznamy dvou dlaždic v obou pořadích, odliší tři předměty v každé a ověří poškození i opravu ve 4:00 dalšího dne. Všech 164 prohlížečových zkoušek prošlo za 45 minut bez vynechání nebo opakování. Záznamy jsou v `data-raw/e21/registr-prohlizec.{log,json}`. Následují lampy. Další záznamy jsou v `data-raw/e21/registr-{node,build}.log`.

## Lampy

Lampa se vybírá ze zdrojového úseku před rozmístěním do scény. Vizuál a fyzika najdou stejné místo bez ohledu na pořadí načtení sousedů. Po nárazu se skryje stožár i noční světelná skvrna a uvolní se stožár a hlava lampy. Po návratu je chodník průchozí. Oprava je ve 4:00 následujícího herního dne. Ve fyzice se vytvoří či zruší nejvýše 20 těles vybavení za krok.

Při prvním ověření ukázal kontakt s válcovým tělesem neplatnou hloubku průniku. Doplněný povinný poloměr zaoblení v konstruktoru Jolt opravil normálu. V testu těleso malého auta při 10 km/h lampu zachovalo, při 30 km/h ji ulomilo. Obě rychlosti i původní práh 6 000 N·s zůstaly zachovány. V obou vykreslovačích prošel náraz hráčovým autem, odjezd, návrat v noci a oprava. Záznamy jsou v `data-raw/e21/lampy-kontakt.log` a `lampy-cilene.log`. Rozšířená zkouška v úplné sadě navíc kontroluje polohu samotné zobrazené instance.

Na výsledné úpravě prošlo 104 ze 104 testů JavaScriptu a produkční sestavení. Nad stejným sestavením běží úplná sada 166 zkoušek. Při navázání ověřit `data-raw/e21/lampy-uplna.{log,json}` a případné nálezy opravit. Po úspěchu uložit druhý krok do gitu a pokračovat značkami a semafory.

První úplný běh lamp odhalil, že startovní vůz po přímém rozjezdu narazil do nízkou rychlostí neulomitelné lampy. Před nárazem byla pata 4,5 m před středem auta, náraz měl impulz 4 546 N·s. Vůz teď při prvním umístění hledá místo podél stejné strany ulice s volnou cestou od obrubníku. V ověřené trase zaparkoval o šest metrů dál od lampy a po 130 krocích měl rychlost 5,19 m/s bez nárazu. Původní test rozjezdu i práh zlomení zůstaly zachovány. Diagnostika: `data-raw/e21/rozjezd{,-po}.json`.

Oprava byla sestavena odděleně, aby předchozí úplná sada doběhla nad původní hrou. Prošlo 104 testů JavaScriptu a sestavení, záznamy `rozjezd-{node,build}.log`. Cílená kontrola rozjezdu a lamp v obou vykreslovačích má záznam `rozjezd-cilene.log`. Při navázání ověřit i případné další nálezy z `lampy-uplna.json`.

Všechny čtyři cílené kontroly rozjezdu a lamp na opraveném sestavení prošly na WebGL 2 i WebGPU. Po dokončení původní sady se automaticky spustí úplná kontrola opravy, pokud původní sada neodhalí další závadu. Výsledek hledej v `data-raw/e21/rozjezd-uplna.{log,json}`; případný jiný nález zaznamená `rozjezd-navazani.log`.

V původním běhu projelo během deseti minut kolem Klatovské 135 aut. Žádné při sledování nevyjelo pod plynem mimo vozovku, řidič ve Smetanových sadech ale čekal 128,5 s při limitu 120 s (hrana 11884). U hlavního nádraží zkouška prošla. Rozšířený záznam sleduje okolní vozidla, fázi semaforu a kontakty se stožáry. Při navázání porovnat `spicka-4173-Klatovská.json` (původní sestavení) a `spicka-4181-Klatovská.json` (upravené parkování). Opakování s jiným průběhem samo příčinu nedokazuje.

V rozšířeném pozorování na Klatovské nenarazilo žádné jedoucí auto do lampy. Ve frontě na Husově odhalila samostatná zkouška jinou chybu. Pokud si řidič dřív zvolil jen část průjezdu, považoval spojku 1421 za výjezd a hlásil jízdu rovně. Jeho skutečná trasa odbočovala vlevo do sadů Pětatřicátníků na úsek 12147. Zkouška na předchozím sestavení chybu zopakovala. Nyní řidič ponechá již zvolený směr a doplní navazující odbočení ještě před stopčárou. Nová samostatná zkouška prošla, ale první opakované desetiminutové jízdy měly nadlimitní čekání na obou místech. Záznamy jsou v `spojka-pred.log`, `spojka-e2e.log` a složce `spojka-e2e/`.

Druhá pracovní úprava rozlišuje dvě situace před zelenou. Řidič jedoucí rovně má přednost před čekajícím levým odbočením. Pokud již protijedoucí vůz najel do levého oblouku, ponechá mu před čárou místo k dokončení. Prošlo 104 testů JavaScriptu včetně obou situací a sestavení. Při navázání nejdříve ověřit sedm cílených prohlížečových zkoušek na tomto sestavení v `data-raw/e21/oblouk-e2e.log`, hlavně obě desetiminutové jízdy. Úplný běh `lampy-uplna` kontroluje starší sestavení před opravou parkování a křižovatek. Zbývá také úplná sada na výsledné revizi.

Pokud všech sedm cílených kontrol projde a zbytek původní sady neodhalí jiný problém, naváže automaticky standardní sestavení a úplná sada do `data-raw/e21/oblouk-uplna.{log,json}`. Důvod případného nezahájení zaznamená `oblouk-navazani.log`.

Po druhé úpravě prošlo šest ze sedmi cílených zkoušek. Na Klatovské kleslo nejdelší čekání na 74 s a všechna sledovaná auta zůstala na silnici. U nádraží však řidič v Barrandově na hraně 1173 čekal 435 s (výjezd 6376). Zbývá najít konkrétní překážku a ověřit opravu. Běží podrobné pozorování nádraží nad stejným sestavením na portu 4181, výstup `data-raw/e21/spicka-4181-hlavní nádraží.json` a `barrandova-stop.log`.

### Kontrola kolon při ověřování lamp

První úplná kontrola lamp skončila 163 úspěchy ze 166. Dvě selhání byla při rozjezdu startovního auta a jedno na Klatovské. Obě varianty rozjezdu po posunutí parkovacího místa prošly. Úplná kontrola sestavení s opraveným rozjezdem a plánováním odbočení běží do `data-raw/e21/kolony-uplna.{log,json}`.

Tři jízdy u nádraží před úpravou parkovací brzdy měly nejdelší čekání 223,5 s, 57 s a 129,5 s. V první zůstal nabouraný sedan přes čtyři minuty na stejných souřadnicích. Hra mu stále připisovala rychlost 0,318 m/s, takže se nikdy nezačala počítat minuta k odklizení. Při třetí jízdě čekalo jiné auto v Božkovské u přednosti v jízdě. Na chodník během těchto tří jízd žádné sledované auto pod plynem nevyjelo. Podklady jsou v `data-raw/e21/barrandova-trikrat/`.

Zaparkovaný vůz nyní při probuzení zabrzdí a při uspání se jeho rychlost srovná se skutečnou rychlostí tělesa. Při opuštění okruhu fyziky se pohybující se vůz dál valí. Nová zkouška ověřila oba případy na 13% svahu. Prošlo všech 105 testů JavaScriptu, sestavení i prohlížečové zkoušky lampy, odtlačení zaparkovaného auta a odklizení cizího vraku. V nové jízdě u Klatovské však auto v sadech Pětatřicátníků čekalo 128,5 s. Limit je nadále méně než 120 s. Krok 2 zůstává otevřený.

Při navázání zkontrolovat výsledky obou míst v `data-raw/e21/vrak-svah-kontrola/` a původní úplnou sadu v `kolony-uplna.log`. Diagnostika `cekani-priciny.mjs` zaznamenává po deseti sekundách čekání barvu semaforu, obsazený výjezd a vozidla s předností. První záznam vzniká v `cekani-klatovska.json`. Určit příčinu další dlouhé fronty a po opravě spustit celou sadu na výsledném sestavení.

Ověření po opravě vraku skončilo čtyřmi úspěchy z pěti. U hlavního nádraží byla nejdelší doba stání 90 s. Žádné auto v obou jízdách pod plynem neopustilo vozovku.

Na křižovatce Klatovské a Tylovy pokračují dva souběžné pruhy do jednoho. Záznam desetiminutové jízdy v `data-raw/e21/nehody-klatovska.json` zachytil střet dvou aut při řazení do stejného výjezdu. Obě pak zůstala stát. V samostatné zkoušce přijíždějí SUV a krátké osobní auto vedle sebe rychlostí 6 m/s. Před opravou se při zařazování překryly jejich karoserie o 16 cm a obě auta havarovala. Záznam je v `soubeh-prijezd.log`.

Řidič před čárou nyní zohlední sousední auto, které se právě rozjíždí do téhož výjezdového pruhu. Pokud vyjíždějí do dvou různých pruhů, mohou jet současně. Samostatná zkouška po opravě prošla, oba vozy projely bez dotyku. Prošlo 106 testů JavaScriptu a sestavení. V desetiminutové kontrole Klatovské žádné sledované auto pod plynem neopustilo vozovku a nejdéle stálo 68 sekund. Výsledek zbývajících kontrol bude v `soubeh-po.log`. Při všech šesti úspěších a bez dalšího nového selhání v původní úplné sadě naváže kontrola všech 167 zkoušek v `soubeh-uplna.{log,json}`. Stav návaznosti zapisuje `soubeh-navazani.log`.

Všech šest cílených kontrol opravy prošlo. Na Klatovské i u hlavního nádraží byla nejdelší doba stání 68 sekund při limitu 120 s. Ani na jednom místě žádné sledované auto pod plynem neopustilo vozovku. Ověřeno bylo také vyhnutí se vraku, přednost protisměru a plánování odbočení přes Husovu. Zbývá výsledek úplné sady.
