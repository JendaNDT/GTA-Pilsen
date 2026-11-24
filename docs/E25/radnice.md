# Plzeňská radnice na náměstí Republiky

Doplnění E25 navazuje na revizi `26c7d96` s Novým divadlem. Radnice má kamenné přízemí s klenutým portálem, pět okenních os se sgrafity a cihlovou atiku s hodinami. Nad římsou stojí tři štíty s kovovými ozdobami. Skrz sloupky věžičky na hřebeni prosvítá obloha.

| Pohled ve hře | Původní podoba | Upravená podoba |
| --- | --- | --- |
| Čelně z náměstí | [Před úpravou](radnice/pruceli-puvodni.jpg) | [Po úpravě](radnice/pruceli-uprava.jpg) |
| Šikmo podél severní strany náměstí | [Před úpravou](radnice/namesti-puvodni.jpg) | [Po úpravě](radnice/namesti-uprava.jpg) |
| Večerní osvětlení | [Před úpravou](radnice/vecer-puvodni.jpg) | [Po úpravě](radnice/vecer-uprava.jpg) |

## Podklady a odchylky

Šířka hlavního průčelí je podle městského 3D modelu přibližně 21 m. Model určuje také polohu a výšku hřebene a věžičky. Úprava patří k listu `128--128.bin` s otiskem `74998e04`. Tři fotografie poskytnuté autorem hry sloužily jako vizuální předloha. Projekt nakreslil vlastní sgrafita, okna, portál, ciferník a kresbu krytiny. Figury a ornamenty jsou zjednodušené. Rozměry říms, vrcholů štítů a lucerny jsme odhadli z fotografií a zaměřeného obrysu. [Zdroje a licence](../../README.md#zdroje-a-licence-dat)

## Jak si radnici prohlédnout

Ze severní části náměstí se postav proti hlavnímu portálu. Na hodinách porovnej ručičky s časem ve hře. Při pohledu z boku je vidět hloubka říms, klenáků nad dveřmi i otevřená věžička. Původní podobu lze zobrazit parametrem `?radnice=puvodni`.

## Ověření a výkon

Prošlo všech 278 testů JavaScriptu a produkční sestavení. V celé sadě prohlížečových zkoušek prošlo 396 z 398 kontrol. Dotyková zkouška radnice prošla na WebGL 2 i WebGPU. Kontrola kontrastu dvou vzorků z nočního pohledu na náměstí selhala na obou vykreslovačích také v předchozí verzi s Novým divadlem.

Testy kontrolují otisk zdrojového listu, rozsah odebraných ploch, souřadnice vlastní kresby a polohu hodinových ručiček. Dotyková zkouška v Chromiu při 844 × 390 a nízké kvalitě přestaví čas na 3.30, odjede z náměstí, přestaví čas na 6.15 a vrátí se. Přitom kontroluje obě ručičky a uvolnění geometrie, materiálu i textury. Fyzický telefon jsme při této úpravě nezkoušeli.

Při čelním pohledu ve vysoké kvalitě vzrostl počet vykreslovacích volání ze 453 na 459, při šikmém ze 470 na 476. V obou pohledech včetně stínů přibylo 11 358 trojúhelníků. V nočním pohledu vzrostl počet volání z 263 na 266 a počet trojúhelníků o 2 844. Průčelí a ručičky používají jednu společnou novou texturu.

Nástroj `tools/measure_map.mjs --work --center-flight` měřil na Apple M4 desetisekundovou jízdu a let nad centrem. Stejné nastavení obou verzí bylo WebGL 2, nízká předvolba, 1920 × 1080 a dohled 340 m. Tabulka uvádí 95. percentil skutečné práce na snímku. V těchto dvou trasách se upravená hra vešla do rozpočtu 12 ms pro grafiku.

| Trasa | CPU s původní radnicí | CPU s novou | GPU s původní radnicí | GPU s novou |
| --- | ---: | ---: | ---: | ---: |
| Jízda centrem | 4,1 ms | 4,1 ms | 9,77 ms | 9,60 ms |
| Let nad centrem | 3,6 ms | 3,7 ms | 6,76 ms | 4,83 ms |
