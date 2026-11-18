# Stav etapy E20

Větev `etapa/E20` vychází ze sloučené etapy E19 na revizi `10832b4`. [Zadání E20](E20.md)

| Krok | Stav |
| --- | --- |
| 1. Řidič AI | Hotovo. |
| 2. Provoz v okruhu hráče | Hotovo. Převzetí řízení fyzikou, pravidla na trase a volný vůz po nárazu. |
| 3. Zaparkovaná auta a policie | Zbývá |
| 4. MHD a směny | Zbývá |
| 5. Vrtulník | Zbývá |
| 6. Voda | Zbývá |
| 7. Závěrečné scénáře, výkon a protokol | Zbývá |

## Otevřené otázky

Autor zvolil skutečná měření hloubky. Hladina v mapě leží na stejné síti jako dosavadní kolize terénu.
Pro krok 6 prověřit prostorový průběh dna a licenci pro začlenění číselných dat. Město zveřejňuje [dokumentaci povodňového modelu](https://mapy.plzen.eu/dokumentace-povodnoveho-modelu/) a [tabulku kót dna](https://gis.plzen.eu/foto/pov_model/profily/PM_Psany_PP.pdf).
Místní program pdftotext není nainstalován. Autor rozhoduje o způsobu čtení PDF. Podklady zatím slouží k ověření, žádné hodnoty z nich nejsou součástí hry.

## Ověření

Řidič dostává trasu, povolenou rychlost a vzdálenost od předního nárazníku k místu zastavení.
Tři zkoušky v Node používají skutečné čtyřkolové vozidlo s motorem, brzdami a odpružením. Na rovince byla největší odchylka 0,02 m, na kružnici s poloměrem 15 m byla 0,11 m. Z 50 km/h zastavil nárazník 0,61 m před čárou. Prošlo 85 z 85 testů JavaScriptu a produkční sestavení. První krok ještě nemění běžící hru.

### Druhý krok

Okolní auto přebírá čtyřkolový model do 150 m po načtení terénu a drží ho až do 220 m.
Předvolby dovolují 40, 40, 20 nebo 10 takových aut. Při obou přechodech zůstává stejné auto na své trase.
V prohlížeči fyzikální vůz u stopky na Doudlevecké zastavil a po splnění pravidla pokračoval.
Prošlo všech 86 testů JavaScriptu, produkční sestavení a 16 prohlížečových kontrol fyziky a dopravy.
Zahrnují kolonu před obsazeným výjezdem na Tylově i jízdu hráčovým autem na WebGPU a WebGL 2.
Záznamy jsou v `data-raw/e20/krok2-{node,build,ove}.log`.
