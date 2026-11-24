# Katedrála sv. Bartoloměje

Úprava navazuje na plzeňskou radnici v revizi `5aa680f`. Při obcházení katedrály po náměstí jsou vidět úzká lomená okna presbytáře, širší kružba uprostřed lodi, boční kaple a západní portál s několika kamennými oblouky. Nad břidlicovými střechami stojí dvě menší věžičky. Čtyři ciferníky pod hlavní měděnou špicí ukazují čas hry po celých minutách.

| Pohled | Před úpravou | Po úpravě |
| --- | --- | --- |
| Jižní strana lodi | [Původní](katedrala/lod-puvodni.jpg) | [Upravená](katedrala/lod-nova.jpg) |
| Západní portál | [Původní](katedrala/portal-puvodni.jpg) | [Upravený](katedrala/portal-nova.jpg) |
| Presbytář a boční kaple | [Původní](katedrala/presbytar-puvodni.jpg) | [Upravené](katedrala/presbytar-nova.jpg) |
| Věž z protější strany | [Původní](katedrala/vez-puvodni.jpg) | [Upravená](katedrala/vez-nova.jpg) |

## Podklady a odchylky

Podkladem je městský 3D model centra Plzně z roku 2024, budova `00000000000100681` v listu `-128-128.bin` s otiskem `b9ad9ff6`. Z měření pocházejí půdorysy lodi, věže, kaplí i opěráků, hrany střech a hlavní špice. Výzdoba vychází z pěti fotografií od autora hry. Projekt vytvořil vlastní kresbu spár, kamene, krytin, oken, dveří a hodin. Tvary kružeb, kování, detaily portálů a menší střešní ozdoby jsou zjednodušené. Fyzický povrch střech dál používá městské měření. [Zdroje a licence](../../README.md#zdroje-a-licence-dat)

## Jak vyzkoušet

Přejdi od radnice na západní stranu katedrály. Porovnej čas na obou budovách a pokračuj kolem jižní předsíně k presbytáři. Změnou úhlu uvidíš profil ostění a okna na zalomených stěnách kaple. Při otevření hry s parametrem `?katedrala=puvodni` se načte předchozí podoba náměstí.

## Měření výkonu

Měření proběhlo na Apple M4 v Chromiu s WebGL 2, v nízké kvalitě, při rozlišení 1920 × 1080 a dohledu 340 m. Nástroj `tools/measure_map.mjs --work --center-flight` měřil desetisekundovou jízdu a let nad centrem. Tabulka uvádí čas, do kterého se vešlo 95 % vzorků.

| Trasa | Práce CPU před | Práce CPU po | GPU před | GPU po |
| --- | ---: | ---: | ---: | ---: |
| Jízda přes náměstí | 4,1 ms | 4,4 ms | 7,36 ms | 7,18 ms |
| Let nad centrem | 4,0 ms | 4,2 ms | 5,77 ms | 6,21 ms |

Obě trasy splnily rozpočet GPU 12 ms. Katedrála přidává do paměti jednu texturu pro celou stavbu včetně hodin. Při stejném pevném pohledu od jihu ve vysoké kvalitě přibyly čtyři volání a 12 848 trojúhelníků včetně průchodů pro stíny. První podoba katedrály na nízké předvolbě překročila rozpočet trojúhelníků na náměstí. Po zjednodušení oblouků oken a profilů ostění už zkouška prošla na WebGL 2 i WebGPU s původním limitem.

## Ověření

Prošlo všech 280 testů JavaScriptu a produkční sestavení hry. Nové testy porovnávají při úpravě sítě původní střechy i sousední budovy a kontrolují polohu ručiček na všech čtyřech stranách. V dotykové emulaci telefonu (844 × 390, nízká kvalita) ukázaly katedrála a radnice čas 3.30. Po odjezdu se uvolnily obě geometrie, materiál i textura katedrály. Při návratu v poledne její hodiny znovu ukázaly dvanáct. Zkouška prošla na WebGL 2 i WebGPU. Z náměstí jsou ručičky vidět, při vzdáleném pohledu z výšky je hra schová spolu s dalším drobným vybavením. Původní zkouška přepínání detailu i měřené střechy prošla na obou vykreslovačích. Výkon na fyzickém telefonu nebyl změřen.

V celé prohlížečové sadě prošlo 397 ze 400 kontrol. Kontrola kontrastu rozsvícených nočních oken na náměstí selhala na WebGL 2 i WebGPU stejně jako v předchozí revizi. V desetiminutovém pozorování ranní špičky u Klatovské na WebGPU čekalo jedno auto 123 s při očekávání pod 120 s. První samostatné opakování naměřilo 129,5 s, druhé prošlo. Pro porovnání jsme tutéž zkoušku dvakrát spustili i na předchozím sestavení s radnicí. Jednou prošla a podruhé naměřila 131,5 s.
