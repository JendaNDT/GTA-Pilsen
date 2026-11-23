# Hlavní nádraží pěšky

Doplnění veřejného prostoru E25 vychází z revize `33f74e9`. Na straně od nádraží ukazuje modrý rozcestník, kudy ke čtyřem stanovištím MHD. Ve směru k Šumavské jsou označníky 1 a 2, u tramvajových kolejí 3 a 4. Čísla odpovídají vyhledávání na herní mapě. Čtyřka stojí u severního vstupu na západní ostrůvek, kde sloupek ponechává volnou cestu i dveře tramvaje.

## Podklady

- Dlažba dvou tramvajových ostrůvků přebírá obrysy OSM 1064543438 a 1064543439. Veřejný vstup na jižní straně východního ostrůvku je uzel 9737859382. [Východní ostrůvek](https://www.openstreetmap.org/way/1064543438) · [Západní ostrůvek](https://www.openstreetmap.org/way/1064543439)
- U nástupišť v Šumavské jsou zmapované osy a dlažba. Šířka pásů 2,8 m je herní odhad. Přístřešek u jedničky má otevřenou stranu k místu zastavení vozu. Rozměry přístřešku a přesné umístění vybavení čekají na porovnání s fotografiemi. [Nástupiště](https://www.openstreetmap.org/way/332361606) · [Místo zastavení](https://www.openstreetmap.org/node/3395187564)
- Číslování vychází ze čtyř kódů 53408 v distribuovaném jízdním řádu PMDP. Cedule, jejich barvy a místo rozcestníku jsou vlastní herní návrh. Fyzické značení místních a regionálních linek se může lišit. [Zdroje a licence](../../README.md)

## Kontrola ve hře

Na mapě vyhledej „Hlavní nádraží“. Před terminálem najdi modrou směrovku a dojdi podle ní k tramvajím. Čísla na sloupcích přečteš z obou stran. Od východu u jižního konce východního ostrůvku lze projít až ke trojce. Čtyřka stojí za přechodem na druhé straně kolejí.

[Snímek před úpravou](nadrazi/pred.jpg) · [Stejné místo po úpravě](nadrazi/po.jpg) · [Rozcestník při příchodu](nadrazi/rozcestnik.jpg)

## Místní ověření

V Chromiu na obou vykreslovačích prošly dvě pěší trasy se skrytou minimapou. Jedna začíná u veřejných dveří OSM 12707369913, míjí rozcestník a končí do metru od nástupního bodu jedničky. Druhá vede z jižního vstupu po ostrůvku ke trojce. Prošel také nástup do trolejbusu 49, jízda do Pařížské, doručení zakázky a chůze ve dne, za soumraku a v noci. Celá sada JavaScriptu má 267 úspěšných testů, Pythonu 28. Telefon autora čeká na vyzkoušení.

V nízké kvalitě při stejném pohledu na stanoviště 1 zůstalo 75 vykreslovacích volání. Počet trojúhelníků se zvýšil z 230 834 na 231 071 (+0,10 %). Datový soubor nádraží narostl z 1 828 na 2 752 bajtů. Druhé sestavení se s kandidátem shodovalo po bajtech.

### Čas snímku

Chromium 159 na Apple M4, WebGL 2, 1920 × 1080, nízká kvalita a dohled 340 m. Nástroj `tools/measure_map.mjs --work` měřil deset sekund jízdy a letu. Dvě dvojice běhů proběhly v opačném pořadí. Tabulka uvádí 95. percentil v milisekundách.

| Scénář | Práce CPU před | Práce CPU po | GPU před | GPU po |
|---|---|---|---|---|
| Jízda 78 m | 4,1 / 4,1 | 4,1 / 4,2 | 7,39 / 8,48 | 10,54 / 12,29 |
| Let 250 m | 3,4 / 3,5 | 3,4 / 3,5 | 5,83 / 6,42 | 4,14 / 4,77 |

U jízdy vyšel čas GPU v obou bězích o více než 10 % vyšší, ve druhém o 0,29 ms nad rozpočet. Jízdní scénář vede mimo bezprostřední okolí nádraží. V koncovém snímku se lišil také počet vykreslovacích volání podle průběhu provozu (89 a 90 před, 91 a 96 po). Na jeden běh připadlo 30 až 31 vzorků GPU. Přímou příčinu rozdílu tyto běhy neurčují.

Samostatná desetisekundová zkouška přímo u jedničky s běžícím provozem naměřila práci CPU 3,9 ms před úpravou a 3,8 ms po ní. Čas GPU v 95. percentilu vyšel 4,64 a 5,79 ms (21 a 23 vzorků). Oba výsledky u nádraží se vešly do jeho rozpočtu 12 ms.
