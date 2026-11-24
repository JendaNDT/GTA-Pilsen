# Velká synagoga a sousední domy v sadech Pětatřicátníků

Doplnění etapy E25 z 24. listopadu 2026 vychází z revize `f09c09f`. Z protější strany ulice jsou na synagoze vidět tři vstupní portály, trojice sdružených oken, Davidova hvězda ve štítu a osmiboké věže s červenými žebrovanými kupolemi. Okrový dům po levé straně má vlastní štíty, římsy, okna a průjezd. Na domě vpravo pokračují výlohy a zdobená okna kolem zaobleného nároží až na konec boční fasády.

[Před úpravou](synagoga/pred.jpg) · [Stejný pohled po úpravě](synagoga/po.jpg) · [Pohled z křižovatky](synagoga/narozi.jpg)

## Podklady a provedení

Tvar a poloha tří budov vycházejí z měřeného modelu města z roku 2024, list `-384-128.bin` s otiskem `f495308f`. Detail synagogy a panorama poskytnuté autorem hry posloužily jako obrazová předloha. Všechny plochy, které se ve hře vykreslují, mají vlastní kresbu projektu. Oblouky, hvězdy a žebrování kupolí jsou stylizované. Podobu výloh a členění boční fasády jsme odhadli podle uličního průčelí. [Zdroje a licence](../../README.md#zdroje-a-licence-dat)

Kresba o rozměrech 2016 × 672 bodů pokrývá původní zaměřené stěny. Věže dostaly novou geometrii včetně říms, špic a hvězd. Měření střech používané pro pohyb postavy dál vychází z městského modelu. Původní vzhled lze porovnat přidáním `?synagoga=puvodni` do adresy hry.

## Jak vzhled ověřit

V sadech Pětatřicátníků se postav na protější stranu ulice k přechodu před synagogou. Od přechodu uvidíš obě kupole a pod nimi tři dveře. Pokračuj podél kolejí k nárožnímu domu. Výlohy mají navázat i za zatáčkou a na sousedním domě skončit.

## Ověření a výkon

Nízká předvolba v dotykové emulaci Chromia (844 × 390) načetla upravenou i původní podobu po klepnutí na „Hrát“ i po návratu do ulice. Fyzický telefon jsme nezkoušeli. Samostatný test kontroluje obě věže, průčelí, konec boční fasády a zachování zaměřených střech. Prohlížečový test kontroluje načtení kresby, viditelnost modelu a uvolnění geometrie, materiálu i textury po odjezdu.

Model přidává jednu kresbu a jednu síť. Po odečtení nahrazených částí má městský list o 2 072 trojúhelníků více. Na vysoké předvolbě ve stejném uloženém pohledu ze srovnávacích snímků vzrostl počet vykreslovacích volání z 521 na 525 a počet trojúhelníků všech průchodů z 1 068 796 na 1 077 084.

Prošlo 272 testů JavaScriptu a produkční sestavení. V celé sadě prohlížečových zkoušek prošlo 390 z 392 kontrol. Na WebGL 2 i WebGPU selhalo srovnání dvou nočních oken na náměstí Republiky. Obě selhání se zopakovala i na výchozí revizi `f09c09f`. Po dokončení kresby a celé boční fasády jsme na konečném sestavení zopakovali všech 16 kontrol památek a grafického rozpočtu. Prošly v obou vykreslovačích.

Nástroj `tools/measure_map.mjs --work --center-flight` měřil jízdu centrem a let od synagogy. Každý úsek trval deset sekund v Chromiu na Apple M4, na nízké předvolbě, s WebGL 2 ve 1920 × 1080 a dohledem 340 m. Tabulka uvádí dobu skutečné práce na snímku v 95. percentilu.

| Úsek | CPU před | CPU po | GPU před | GPU po |
| --- | ---: | ---: | ---: | ---: |
| Jízda centrem | 4,3 ms | 4,2 ms | 5,97 ms | 7,57 ms |
| Let od synagogy | 4,0 ms | 4,0 ms | 8,63 ms | 7,60 ms |

Při jízdě centrem vzrostla naměřená doba GPU o 27 %, zatímco při letu od synagogy klesla o 12 %. Cílových 12 ms oba úseky dodržely. Jde o jeden pár jízd s proměnlivým provozem a 31 až 39 vzorky GPU na úsek. Pro posouzení vlivu modelu přímo v místě jsme navíc zopakovali měření z protějšího chodníku.

Na protějším chodníku jsme střídali původní, upravenou, upravenou a původní podobu, pokaždé deset sekund. Před úpravou vyšel 95. percentil GPU na 4,44 a 4,49 ms, po úpravě na 4,05 a 4,11 ms. Čas CPU vyšel před úpravou na 4,00 a 4,00 ms a po úpravě na 3,30 a 3,30 ms. Nárůst z jízdy centrem se přímo před třemi budovami v těchto dvou opakováních neprojevil.
