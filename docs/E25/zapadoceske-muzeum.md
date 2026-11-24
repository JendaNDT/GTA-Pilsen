# Západočeské muzeum v Kopeckého sadech

Úprava navazuje na revizi `b9e8e88`. Hlavní budova má směrem ke kašně pískovcový portál, tři skupiny vysokých dělených oken a v horním podlaží lodžii se sloupy. Nad ní jsou tři otevřené lucerny s kovovými špicemi. Podél sadů pokračuje pásované zdivo s půlkruhovými okny pod římsou až k oblému nároží.

| Pohled ve hře | Původní podoba | Nová podoba |
| --- | --- | --- |
| Od kašny ke vchodu | [Před](zapadoceske-muzeum/pruceli-pred.jpg) | [Po](zapadoceske-muzeum/pruceli-po.jpg) |
| Podél křídla od parku | [Před](zapadoceske-muzeum/park-pred.jpg) | [Po](zapadoceske-muzeum/park-po.jpg) |
| Od oblého nároží směrem ke vstupu | [Před](zapadoceske-muzeum/narozi-pred.jpg) | [Po](zapadoceske-muzeum/narozi-po.jpg) |

## Podklady a přesnost

Půdorys, natočení průčelí, křídla, střechy a osy věží pocházejí z městského 3D modelu Plzně, z objektu `00000000000100794`. Úprava se použije pouze nad odpovídající verzí městského listu `128-384.bin` s otiskem `d45bbb33`. Hra si ponechává zaměřené plochy pro kolize. Pro přímé srovnání nabízí parametr `?muzeum=puvodni`.

Kresba zdiva, oken a detailů je vlastní tvorba projektu podle čtyř fotografií dodaných autorem hry. Členění hlavního průčelí odpovídá čelní fotografii. Boční křídla používají opakovaný okenní motiv. Reliéfy a sochy u portálu jsou nakreslené ve zjednodušené podobě. Výšku luceren a profil drobných ozdob jsme odhadli z fotografií. [Zdroje a licence dat](../../README.md#zdroje-a-licence-dat)

## Ověření

Všech 286 testů JavaScriptu a produkční sestavení prošly. Test nad distribuovaným listem ověřuje, že sousední objekty a kolizní střechy mají stejné plochy, a kontroluje polohu všech tří špic. Změněná část muzea používá jednu geometrii s 1 772 trojúhelníky a jednu texturu. Při čelním pohledu ve vysoké kvalitě přibyly včetně stínů čtyři vykreslovací operace a 4 836 trojúhelníků.

V úplné sadě prošlo 402 ze 404 prohlížečových zkoušek. Muzeum se na WebGL 2 i WebGPU načetlo po odjezdu a návratu v dotykové emulaci 844 × 390 na nízké kvalitě. Obě selhání patří k dříve zaznamenané kontrole kontrastu nočních oken na náměstí Republiky. Fyzický telefon jsme při této úpravě nezkoušeli.

Výkon jsme měřili nástrojem `tools/measure_map.mjs --work --center-flight` na Apple M4 ve WebGL 2 při 1920 × 1080, nízké kvalitě a dohledu 340 m. Jde o 95. percentil skutečné práce za snímek při desetisekundové jízdě a letu centrem.

| Trasa | CPU před | CPU po | GPU před | GPU po |
| --- | ---: | ---: | ---: | ---: |
| Jízda centrem | 4,10 ms | 4,20 ms | 9,53 ms | 8,46 ms |
| Let nad centrem | 3,80 ms | 3,50 ms | 6,32 ms | 7,38 ms |

Při letu vzrostl čas grafiky o 1,06 ms (17 %). Při jízdě naopak klesl o 1,07 ms. Změna přidává do pohledu na centrum kresbu fasády a geometrii věžiček včetně stínů. Obě trasy zahrnují také okolní město a provoz, takže podíl samotného muzea z nich nelze přesně určit. Obě měření po úpravě se vešla do rozpočtu 12 ms pro grafiku.
