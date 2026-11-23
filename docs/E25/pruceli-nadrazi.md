# Průčelí hlavního nádraží od Mikulášské

Výchozí revize `8cf2b3a`. Vnější tvar vychází z měřeného modelu Plzně z roku 2024. Podle fotografie od autora jsme pro západní průčelí nakreslili okna, dveře, pilastry, ozdobné pásy a ciferník. Přibyly prostorové římsy na věžích, kovové špice a tabule na přední hraně přístřešku. Ve tmě se rozsvítí okna a název stanice. [Podklady a autorství](../../README.md#zdroje-a-licence-dat)

Od Mikulášské se postav za řadu sloupků čelem ke spodním dveřím. Na věžích jsou pod zelenými kupolemi dvě obdélná okna. Uprostřed hledej obloukové okno a na tmavé stříšce nápis „Plzeň hlavní nádraží“. Po setmění je dobře vidět členění svítících oken. Ornamenty a odstíny jsou vlastní stylizace podle předlohy. Ciferník je součástí kresby a ukazuje pevný čas. Pro porovnání lze původní materiály zapnout přidáním `?pruceli=puvodni` do adresy hry.

[Původní průčelí](nadrazi/teren-po.jpg) · [Upravené průčelí ve dne](nadrazi/pruceli-den.jpg) · [Ve 23.10](nadrazi/pruceli-noc.jpg)

## Ověření a výkon

Prošlo všech 271 testů JavaScriptu a produkční sestavení. V Chromiu prošla na WebGL 2 i WebGPU kontrola památek, zobrazení průčelí v nízké kvalitě a pěší průchod přednádražím. Poslední dvě zkoušky jsme zopakovali na konečném sestavení. V dotykové emulaci telefonu (844 × 390, nízká kvalita) se po klepnutí na „Hrát“ zobrazilo nové průčelí i volitelná původní podoba. Na fyzickém telefonu měření neproběhlo.

Při chůzi přes spodní předprostor prošla postava pod přístřešky až ke dveřím. Samostatná zkouška při odjezdu z nádraží zkontrolovala uvolnění geometrie průčelí a kupolí, obou materiálů a kresby fasády z paměti.

Přímo před nádražím v Chromiu na Apple M4 při 1920 × 1080, WebGL 2, nízké kvalitě a dohledu 340 m trval desetisekundový běh na každé verzi. V 95. percentilu vyšel čas CPU 4,9 ms před úpravou a 4,2 ms po ní. GPU vyšel na 6,52 a 5,48 ms (21 a 24 vzorků). Poslední snímek s provozem stoupl z 90 na 94 vykreslovacích volání a z 291 398 na 292 524 trojúhelníků. Samotný nový vzhled budovy přidává dvě sítě a jednu texturu. Jedna dvojice měření nestačí k závěru o zrychlení hry.

Nástroj `tools/measure_map.mjs --work` na stejném počítači v obvyklém jízdním a letovém scénáři naměřil práci CPU 5,0 a 3,6 ms a GPU 7,43 a 9,78 ms v 95. percentilu. Let probíhá daleko od nádraží a má jen 11 měření GPU.
