# E05 – Rozšíření na Plzeň

Všechny čtyři otevřené mapové listy centra z roku 2024 jsou převedené do 93 herních dlaždic.
Obsahují 5 697 stavebních záznamů a 205 452 zdrojových ploch. Stavební záznam může představovat
část objektu oddělenou hranicí parcely. Několik identifikátorů se ve zdroji opakuje. Jedinečným
klíčem pro převod je kombinace mapového listu a identifikátoru. Dvě dvojice záznamů v rámci jednoho
listu sdílejí identifikátor i GUID a jejich plochy se převádějí společně.
[Městská 3D data](https://opendata.plzen.eu/public/opendata/detail/37) ·
[Popis zaměření a pokrytí](https://mapy.plzen.eu/o-gis/nase-projekty/3d-model-mesta/)

## Ve hře

- Měřené plochy určují siluetu, výšky říms a střechy. Omítka, okna a výlohy mají stylizované
  materiály. Běžné výlohy se kreslí na fasádách rovnoběžných s blízkou ulicí. Katedrála a radnice
  zachovávají vlastní výtvarnou úpravu z pilotu.
- Výška střechy při přistávání se počítá z měřených trojúhelníků. Ulice používá kolizní půdorysy
  OSM. Výměna zobrazených budov vychází ze vzorkovaného překryvu základů. Model a jeho protějšek z
  OSM se staví ve stejné herní dlaždici, i když jejich půdorysy zasahují přes její hranici.
- Dlaždice se stahují podle polohy hráče, nejvýše čtyři souběžně. Do dokončení nebo při chybě
  stažení je vidět původní budova. Po opuštění oblasti hra uvolní geometrii a výškový index. Ve
  vzdálenějších dlaždicích používá měřená geometrie jednodušší materiál.
- Městské části určují paletu omítek a drobné rozdíly v barvách chodníků a náměstí. Důležitý je
  také typ zástavby. Činžovní domy, sídliště, rodinné domy a průmyslové areály mají vlastní kombinace
  materiálů. Ve čtvrtích mimo zaměřené listy vycházejí proporce ze stávajících půdorysů OSM a výšek
  odvozených z ČÚZK. Barvy a detaily jsou výtvarným odhadem, jednotlivá průčelí nemají fototextury.
  [Hranice městských částí](https://opendata.plzen.eu/public/opendata/detail/108)

## Sestavení

Archiv SHP má SHA-256 `825dc3e395044b1f5a47e27c812cc4189829e9134cc027865ffc8fcb3e7bb9ac`.
GeoJSON hranic má SHA-256 `37bf6669e677bc4993eb00b29e74d1087f543224fc9929c622064a14af621ae4`.
Katalog otevřených dat uvádí podmínky obou distribucí.
[3D zdroj v katalogu](https://opendata.plzen.eu/public/opendata/dataset/37) ·
[Hranice v katalogu](https://opendata.plzen.eu/public/opendata/dataset/108)

```bash
mkdir -p data-raw/e05-mesto
curl -fL https://opendata.plzen.eu/public/opendata/download-file/430 -o data-raw/e05-mesto/plzen-2024-shp.zip
curl -fL https://opendata.plzen.eu/public/opendata/download-file/308 -o data-raw/e05-mesto/mestske-casti.zip
unzip -p data-raw/e05-mesto/mestske-casti.zip mestskecasti.geojson > data-raw/e05-mesto/mestske-casti.geojson
python3 tools/build_heritage.py data-raw/e05-mesto/plzen-2024-shp.zip --full --output data-raw/e05-mesto/plzen-2024-plochy.json
node tools/build_city.mjs data-raw/e05-mesto/plzen-2024-plochy.json data-raw/e05-mesto/mestske-casti.geojson
```

Adresář `public/detail/city/` obsahuje 75 kB rejstřík a 15,8 MB binárních sítí. Vrcholy mají
rozlišení 2 cm. Po změně výškopisu nebo půdorysů hlavní mapy znovu spusť sestavení měřených dlaždic.
Rejstřík je svázaný s verzí obou podkladů kontrolními otisky a při rozdílné verzi se zobrazí
procedurální zástavba.

## Ověření

Prohlídka při hraní zahrnula náměstí Republiky, centrum z výšky, Americkou, Slovany a sever města.
Snímky a nezpracované záznamy měření vznikly v místní složce `data-raw/e05-mesto`.

Dvě sestavení ze stejných vstupů měla bajtově shodný rejstřík i všech 93 dlaždic.
Měření proběhlo v Chrome 157.0.8103.51 na MacBooku Air M4 s 16 GB RAM při 1920 × 1080.
Každá trasa běžela deset sekund v běžné herní smyčce a přejela nebo přeletěla spoj dlaždic.
Nižší profil byl měřený na stejném počítači.

| Trasa | Profil | Vzdálenost | FPS | 95. percentil intervalu mezi snímky |
| --- | --- | ---: | ---: | ---: |
| Jízda u radnice | Vysoký | 61 m | 60,0 | 16,7 ms |
| Přelet nad Dobřívem | Vysoký | 192 m | 60,0 | 16,7 ms |
| Přelet nad centrem | Vysoký | 192 m | 60,0 | 16,8 ms |
| Jízda u radnice | Nízký | 61 m | 60,0 | 16,7 ms |
| Přelet nad centrem | Nízký | 192 m | 60,0 | 16,7 ms |

Při přeletu nad centrem bylo na konci připojených 62 měřených dlaždic ve vysokém profilu
a 37 v nižším. Nejdelší interval mezi snímky byl ve všech záznamech 16,8 ms. Medián prvního
spuštění z místního serveru při původních trasách E05 byl 698 ms. V nižším profilu vyšel medián
546 ms. Vysoký profil měl zapnuté stíny po celou dobu měření.

```bash
node tools/measure_map.mjs http://127.0.0.1:4174/ --pilot
node tools/measure_map.mjs http://127.0.0.1:4174/ --center-flight
node tools/measure_map.mjs 'http://127.0.0.1:4174/?quality=low' --center-flight
```

Prošlo 10 testů JavaScriptu, 10 testů Pythonu a 12 testů v Chromu. Nové kontroly ověřily všechny
indexy geometrie, jediného vlastníka každého nahrazeného půdorysu, odložené stahování při startu
mimo centrum, náhradní vzhled po selhání požadavku a nové načtení po návratu. Dotykové ovládání
bylo ověřeno v emulaci iPhonu 13.
