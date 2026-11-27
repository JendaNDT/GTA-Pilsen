# E58 · Bodovaná série v Lobzích

Druhý krok etapy vychází z revize `864274a` na větvi `etapa/E58`. Na mapě vyhledej **terče**, dojdi ke značce u ulice Ke Střelnici, otevři **Spustit trénink** a zvol **Série deseti terčů**.

## Pravidla

Každý z deseti kotoučů se pohybuje nejvýše pět sekund. Na každý máš jeden pokus. Za zásah získáš bod, po minutí nebo vypršení času pokračuje série dalším kotoučem. Na počítači klikni na kotouč nebo pohybuj kroužkem šipkami a potvrď mezerníkem. Na telefonu nastav kroužek prstem a klepni na **Zasáhnout**.

Po desátém terči se ukáže výsledek a osobní rekord. Tlačítkem **Hrát znovu** začneš od prvního terče. Můžeš se také vrátit do volného tréninku nebo odejít do města. Rekord patří do místní uložené hry v daném prohlížeči. Horší výsledek ani odchod uprostřed série ho nesníží. Při selhání zápisu lze uložení výsledku zopakovat.

## Podklady

Série používá pěšinu ze stávající mapy OpenStreetMap (ODbL) a původní grafiku sportovního stanoviště projektu Plzeň naplno. [Snímek před změnou](E58/dotyk.jpg)

## Jak jsme sérii ověřili

Na počítači i v dotykovém zobrazení 320 × 568 prošel celý průchod v Chromiu s WebGL 2 a WebGPU. Při zkoušce první kotouč vypršel, druhý hráč minul a osm dalších zasáhl. Výsledkem bylo 8/10. Po další sérii s výsledkem 0/10 i po obnovení stránky zůstal rekord 8/10. Ověřili jsme také odchod po prvním zásahu a návrat k volnému tréninku.

V obou vykreslovačích prošlo i uložení prvního výsledku 0/10, neúspěšný pokus zapsat lepší rekord a následný úspěšný zápis 1/10. Prošlo produkční sestavení, 427 testů JavaScriptu a deset různých cílených prohlížečových zkoušek série a tréninku. Na fyzickém telefonu zbývá ověřit pohodlí ovládání.

[Rozehraná série na mobilní obrazovce](E58/serie-mobil.jpg) · [Výsledek 8/10](E58/vysledek-serie.jpg)

## Výkon

Srovnávací desetisekundová jízda po Prokopově v nízké kvalitě ve Full HD (`tools/measure_map.mjs --pizza --paced`, WebGPU, Apple Metal) dosáhla 59,1 FPS. V předchozím kroku měla 59,0 FPS. Časy jsou 95. percentilem skutečné práce za snímek.

| Činnost | Před sérií, revize `864274a` | Po přidání série | Rozpočet |
| --- | ---: | ---: | ---: |
| Fyzika | 1,40 ms | 1,50 ms | 4 ms |
| Logika | 0,80 ms | 0,80 ms | 2 ms |
| Příprava obrazu | 2,20 ms | 2,30 ms | 6 ms |
| GPU | 8,91 ms | 8,98 ms | 12 ms |

Při samostatném desetisekundovém měření série na nízkou předvolbu v okně 1280 × 720 běžela hra při 60 FPS. Aktualizace kotouče a ovládacích prvků v JavaScriptu trvala v 95. percentilu 0,10 ms (602 vzorků).
