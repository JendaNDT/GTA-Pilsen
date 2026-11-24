# Velké divadlo J. K. Tyla

Doplnění E25 navazuje na revizi `cc913b1` s Velkou synagogou. Ze strany vstupu jsou za prostorovým balkonem tři vysoká oblouková okna. Zakřivená balustráda sleduje původní vysunutou desku na sloupech. Na štít a nároží přibyly zjednodušené siluety soch. Od parku je vidět žebrovaná zelená střecha jevištní věže, menší věžička a skleněné zábradlí nízké tmavé terasy.

[Vstup před úpravou](divadlo/vchod-puvodni.jpg) · [Vstup po úpravě](divadlo/vchod-uprava.jpg) · [Park před úpravou](divadlo/park-puvodni.jpg) · [Park po úpravě](divadlo/park-uprava.jpg)

Vnější rozměry vycházejí z městského modelu z roku 2024, list `-384-128.bin` s otiskem `f495308f`. Tři fotografie poskytnuté autorem hry posloužily jako předloha. Projekt vytvořil vlastní kresbu fasád, geometrii střechy jeviště, balustrádu a ozdoby. Sochy, kování a detaily oken jsou stylizované. Pro část terasy, kterou model města nepokrývá, jsme převzali půdorys OSM a odhadli výšku podle sousední zaměřené střechy. Tuto výšku používá také pohyb postavy a fyzika vozidel. [Zdroje a licence](../../README.md#zdroje-a-licence-dat)

Ve hře přejdi od hlavního vchodu na stranu k parku. Změnou úhlu se odkryje průhled mezi sloupy, vyšší střecha a navazující úseky skleněného zábradlí. Přidáním `?divadlo=puvodni` do adresy hry můžeš stejnou trasu projít v původní podobě.

## Ověření

Prošlo všech 274 testů JavaScriptu a produkční sestavení. Testy kontrolují shodu s revizí měření, povrch střech, souřadnice kresby a společné načtení se synagogou ve stejném městském listu. Dotyková zkouška v Chromiu (844 × 390, nízká předvolba) prošla na WebGL 2 i WebGPU. Po klepnutí na „Hrát“ se načetlo divadlo. Postava dopadla na terasu a zastavila se před sklem. Po odjezdu se uvolnila síť, kresba i materiál. Po návratu se obnovily také jednotlivé úseky zábradlí. Fyzický telefon jsme při této úpravě nezkoušeli.

Na srovnávacích snímcích ve vysoké kvalitě při 1280 × 760 vzrostl počet vykreslovacích volání u vstupu z 522 na 538 a od parku ze 493 na 509. Počet vykreslených trojúhelníků včetně stínů stoupl o 30 128 na obou pohledech. Scéna používá jednu novou texturu. Samostatné vykreslení skla a kamene umožňuje při nárazu uvolnit konkrétní část zábradlí.

V celé sadě prohlížečových zkoušek prošlo 392 z 394 kontrol. Zkouška kontrastu dvou nočních oken na náměstí Republiky selhala na obou vykreslovačích. Stejná kontrola selhala také na základní revizi se synagogou před přidáním divadla. Na konečném sestavení prošla ve WebGL 2 i WebGPU opakovaná kontrola pohybu na terase a původní zkouška rozbití skla autem.

## Výkon

Nástroj `tools/measure_map.mjs --work --center-flight` měřil každou trasu deset sekund v Chromiu na Apple M4. Hra běžela ve WebGL 2 na nízké předvolbě ve 1920 × 1080 s dohledem 340 m. Tabulka udává 95. percentil skutečné práce procesoru a grafiky na snímku.

| Trasa | CPU před | CPU po | GPU před | GPU po |
| --- | ---: | ---: | ---: | ---: |
| Jízda centrem | 4,2 ms | 4,1 ms | 8,99 ms | 6,92 ms |
| Let nad centrem | 3,8 ms | 3,9 ms | 8,19 ms | 6,34 ms |

Obě trasy splnily rozpočet 12 ms pro GPU. Každá varianta poskytla 37 vzorků GPU při jízdě a 39 za letu.

Přímo před vstupem proběhly čtyři desetisekundové zkoušky v pořadí původní, upravená, upravená a původní podoba. Čas GPU v 95. percentilu vyšel před úpravou na 5,14 a 5,11 ms a po úpravě na 5,30 a 5,19 ms.
