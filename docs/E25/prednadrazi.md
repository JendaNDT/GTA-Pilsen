# Terén před hlavním vchodem do plzeňského nádraží

Výchozí revize je `bb9eeea`. Fotografie dodaná autorem 23. listopadu 2026 ukazuje spodní vstup od Mikulášské. Dlážděná plocha pokračuje napříč pod obě boční střechy. Ve hře před úpravou rostl uprostřed pěší trasy svah až k hornímu nástupišti. Příčinou byla interpolace výšek pod střechami a následné vyhlazení osmimetrové sítě. Další překážkou byl kolizní plášť přístřešků sahající až na zem.

## Podklady a rozsah

- Na otevřené ose v DMR 5G je u dveří 316,2 m n. m. a o 28 m blíž k Mikulášské 315,7 m. Podélný sklon dlažby je proto přibližně 1,8 %. Polohu hlavního vchodu a dolních cest určuje OSM. [Spodní vchod](https://www.openstreetmap.org/node/4293191657) · [Přes předprostor](https://www.openstreetmap.org/way/1060041190)
- Šířku přibližně 39 m určují obě hrany horních nástupišť. Čela po stranách jsou vlastní zjednodušené opěrné zdi. Jejich horní okraj navazuje na výšku sousedního terénu. Otevřené boční průchody u budovy zůstávají průchozí. [Severní hrana](https://www.openstreetmap.org/way/874767805) · [Jižní hrana](https://www.openstreetmap.org/way/1259768628)
- Oblouk před vstupem sleduje zaměřené kovové sloupky OSM. Deset herních sloupků má oproti mapovým bodům odstup 2 až 2,75 m, aby ponechaly volnou trasu pro pěší. Jeden se do průchozího profilu nevešel. [Jeden ze zdrojových bodů](https://www.openstreetmap.org/node/8118968786)
- Fotografie sloužila k porovnání prostorového uspořádání. Dlažbu, sloupky a zdi vykresluje hra vlastními materiály. Tvar budovy, barvy střech a detaily průčelí se od fotografie odlišují. [Zdroje a licence](../../README.md)

## Jak místo zkontrolovat

Od Mikulášské projdi mezi sloupky ke spodním dveřím. Uprostřed prostranství přejdi napříč pod boční zastřešení. Nahoře na obou stranách má zůstat zvýšená úroveň nástupišť. Kamera na srovnávacích snímcích stojí na stejné pozici.

[Před úpravou](nadrazi/teren-pred.jpg) · [Po úpravě](nadrazi/teren-po.jpg) · [Stejný pohled ve 23.10](nadrazi/teren-noc.jpg)

## Ověření

Prošlo všech 268 testů JavaScriptu, 28 testů Pythonu a produkční sestavení. Na WebGL 2 i WebGPU postava přešla od jednoho přístřešku ke druhému a došla ke spodním dveřím. Na obou prošla i zkouška cesty ke stanovištím MHD. Zkouška trolejbusu 49 prošla na WebGPU, na softwarovém WebGL 2 při prvním ověření vypršel limit při čekání na načtení detailu nádraží. Samostatné opakování na stejném sestavení prošlo za 40,4 s.

U hlavního vchodu v nízké kvalitě (Apple M4, Chromium, WebGL 2, 1920 × 1080, deset sekund) vyšel 95. percentil práce CPU 5,9 ms před úpravou a 4,7 ms po ní. GPU stoupl z 9,49 na 10,25 ms (20 a 18 vzorků). Poslední snímek měl 89 a 93 vykreslovacích volání. Běžná kontrolní jízda mimo předprostor a let pomocí `tools/measure_map.mjs --work` vyšly na 7,0 a 4,3 ms CPU a 13,83 a 8,19 ms GPU. U jízdy překročil čas GPU rozpočet 12 ms. Kontrolní měření mimo nádraží probíhalo souběžně s dalšími zkouškami prohlížeče a pro izolované srovnání výkonu se nehodí.

## Průchod pod střechami na celé mapě

V mapovém balíčku je 103 300 objektů budov. Z nich 296 představuje samostatnou střechu nebo přístřešek a 13 střešní část jiné stavby. U všech 309 fyzika před revizí `fc675ea` vytvářela svislý plášť níž než vykreslení mapové střechy. První oprava zvedla spodní hranu tří střech před nádražím. Nyní ji fyzika a kresba přebírají ze stejného místa na celé mapě. Zastávkové přístřešky z městského mobiliáře mají vlastní stojky, střechu a sklo a byly prověřeny samostatně.

V tabulce je vzdálenost, která postavě po pokusu dojít na určené místo zbývala v metrech. Obě verze měly stejnou trasu, velikost postavy a toleranci cíle 0,45 m. Dvě trasy končí pod střechou u sousední budovy, pět pokračuje až na druhou stranu.

| Místo | Před opravou | Po opravě |
|---|---:|---:|
| Jíkalka, směrem k domu | 6,80 | 0,44 |
| Petrohrad u Šumavské | 24,90 | 0,44 |
| Bezovka | 17,79 | 0,41 |
| Jíkalka u Přemyslovy | 27,79 | 0,44 |
| Pod Záhorskem u Karlovarské | 23,24 | 0,41 |
| Karlov | 36,27 | 0,41 |
| Roudná, směrem k domu | 4,12 | 0,42 |

Kontrola spodní hrany proběhla u všech objektů v distribuovaných datech. V prohlížeči bylo vyzkoušeno těchto sedm tras, předprostor u nádraží, dopad postavy na střechu na Karlově a náraz auta do přístřešku se sklem. Na WebGL 2 i WebGPU prošly všechny tři cílené scénáře. Prošlo také 269 testů JavaScriptu, 28 testů Pythonu a produkční sestavení.

Samostatně jsme hledali převislá patra uvnitř obrysů domů. U centra NTIS obě mapované pěšiny došly k cíli už na původní verzi. U dvou dalších domů, včetně Nového divadla, nevede kontrolovanou plochou žádná pěší trasa v distribuované mapě. Samotný překryv půdorysů u nich nedokládá chybějící veřejný průchod.
