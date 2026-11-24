# Morový sloup na náměstí Republiky

Úprava navazuje na revizi `22e097e` s katedrálou. V severozápadní části náměstí před Císařským domem nahradilo barokní sousoší původní sedmimetrovou budovu. Kamenný podstavec obklopuje šest stupňů, balustráda s kuželkami a kovové oplocení. Nad čtyřmi rohovými figurami vychází hladký dřík se zlacenými listy, hlavicí a Madonou s dítětem. Další tři postavy jsou u paty podstavce, čtvrtá leží na východní straně.

| Pohled | Před úpravou | Po úpravě |
| --- | --- | --- |
| Z náměstí směrem k radnici | [Původní](morovy-sloup/z-namesti-pred.jpg) | [Nový](morovy-sloup/z-namesti-po.jpg) |
| Od radnice ke katedrále | [Původní](morovy-sloup/od-radnice-pred.jpg) | [Nový](morovy-sloup/od-radnice-po.jpg) |
| Detail ohrazení a soch | [Původní](morovy-sloup/detail-pred.jpg) | [Nový](morovy-sloup/detail-po.jpg) |

## Umístění a podklady

Půdorys má přibližně 9,0 × 8,7 m. Jeho střed leží na herních souřadnicích x = −23,31 m, z = −48,98 m. Natočení vychází ze čtyř vrcholů v místní kopii OpenStreetMap (ODbL). Polohu potvrzuje plzeňský záznam v registru památek. [Půdorys OSM](https://www.openstreetmap.org/way/1103555254) · [Registr památek](../aktualizace-2026-11-17/registr-pamatek-v-herni-mape.tsv)

Výška modelu je přibližně 15,5 m a spolu s proporcemi soch je odhadnutá z fotografie od autora hry. Drobné tváře, záhyby rouch a atributy světců jsou stylizované. Na pamětní desce jsou z původního nápisu ponechány letopočty 1681, 1890 a 1931. [Přepis nápisu v encyklopedii města](https://encyklopedie.plzen.eu/home-mup/?acc=profil-objektu&load=2)

Projekt vytvořil vlastní geometrii i povrchové materiály. Skladbu stupňů a podstavce jsme ověřili podle NPÚ, umístění ležící Rozálie podle popisu Plzeňského kraje. [Památkový katalog](https://pamatkovykatalog.cz/morovy-sloup-15046744) · [Plzeňský kraj](https://www.plzensky-kraj.cz/detail-pamatky?ID_Detail=953263)

## Jak vyzkoušet

Od katedrální věže se vydej k Císařskému domu. Obejdi oplocení až k malým vrátkům. Z odstupu si prohlédni zlacení proti obloze, zblízka kuželky balustrády, ležící světici a reliéf na podstavci. Fyzický model má samostatné schodiště, podstavec a dřík. Jednotlivá pole ohrazení podléhají stejnému poškození a opravám jako další městský mobiliář. Z větší vzdálenosti hra používá jednodušší siluetu.

## Ověření a výkon

Prošlo všech 282 testů JavaScriptu a produkční sestavení. Nové testy porovnávají horní plochy fyziky s výškou všech šesti stupňů, ověřují kolizi s dříkem a prostor vedle něj, trvanlivost poškození i návrat původních vrcholů ohrazení po opravě. Vzdálený model má 156 trojúhelníků. Při nahrávání a opouštění náměstí se síť sloupu a její materiály spravují společně s dlaždicí.

Měření na Apple M4 při 1920 × 1080, WebGL 2, nízké kvalitě a dohledu 340 m používá desetisekundové úseky nástroje `tools/measure_map.mjs --work --center-flight`. Tabulka uvádí 95. percentil skutečné práce za snímek.

| Trasa | CPU před | CPU po | GPU před | GPU po |
| --- | ---: | ---: | ---: | ---: |
| Jízda přes náměstí | 4,0 ms | 4,1 ms | 6,82 ms | 7,61 ms |
| Let nad centrem | 3,9 ms | 3,6 ms | 8,68 ms | 5,97 ms |

Při jízdě se čas grafiky zvýšil o 0,79 ms (12 %). U památky se vykreslují i sochy a ohrazení, na vzdálených záběrech hra přepíná na zjednodušenou siluetu. Měření celé trasy zahrnuje i pohyb ostatních vozidel. Obě trasy zůstaly v rozpočtu 12 ms. V pevném blízkém pohledu ve vysoké kvalitě včetně stínů přibylo pět vykreslovacích volání a 20 452 trojúhelníků.

V úplné sadě prošlo 400 ze 402 prohlížečových kontrol. Na WebGL 2 i WebGPU selhala už dříve známá kontrola kontrastu rozsvícených oken na náměstí. Zkouška nového sloupu v dotykové emulaci 844 × 390 na nízké kvalitě prošla na obou vykreslovačích. Postava při chůzi do plotu zastavila, okolní dlažba zůstala průchozí a po návratu na náměstí hra znovu načetla model se správným stavem poškozeného pole. Fyzický telefon jsme při této úpravě neměřili.
