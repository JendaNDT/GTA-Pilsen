# Krajina celé mapy

Na všech 653 km² zůstává společný model výšek z DMR 5G. Kontrola porovnala 41,9 milionu uzlů
po 4 m s původním terénem a našla 562 dlaždic s výraznějšími rozdíly. Jemnější síť vznikla
pro **320 dlaždic ve 41 částech mapy**. První trasa pro podrobnější kontrolu vede přes
Klabavu, Rokycany, Hrádek a Dobřív. Výběr zahrnuje i svahy na severu, u Valíku a na dalších
okrajích mapy. [Podklad ČÚZK](https://ags.cuzk.gov.cz/opendata/) · [Výchozí mapa](E03.md)

## Výšky a povrchy

- Dlaždice o rozměru 256 m ukládá z výškopisu odchylky proti základní síti s krokem 5 cm.
  Výběr upřednostňuje výraznější rozdíly v každém pásmu o velikosti přibližně 4 × 4 km
  a doplňuje okolí kontrolních obcí. Na hranách k hrubším dlaždicím se odchylka plynule
  vrací na původní výšku. U dvou detailních sousedů mají společné uzly shodnou výšku.
- Ochranné pásy kolem silnic, kolejí, budov a vody zachovávají průjezdné profily, základy
  domů a hladiny. Vykreslení, jízda i chůze dostávají výšku ze stejných trojúhelníků.
  Zaměřené 3D stavby i podklady mostů a tunelů dál používají dosavadní souřadnice.
- Pole se liší barevností a mají jemné stopy podle orientace hranic v OSM. Louky, lesy,
  břehy a potoky dostaly vlastní odstíny. Obytné plochy mimo plzeňské čtvrti se odlišují
  podle hustoty zástavby a krajnice mají venkovský nebo městský povrch. Výběr materiálů,
  stopy na polích a skladba dřevin jsou výtvarné odhady. Stromy v lesích používají přesné
  půdorysy porostů včetně výřezů a hra odmítá umístění na zmapovaných cestách, ve vodě
  a v budovách.
- Detail omítek se při vyšší kvalitě používá zblízka i v obcích mimo Plzeň. Půdorysy
  a modely místních domů se dál opírají o dosavadní mapové podklady. [Měřené budovy centra](E05-mesto.md)

## Obnova dat

Po sestavení základní mapy je potřeba stejný zdrojový soubor `data-raw/dmr.npy` s manifestem
z `tools/fetch_dem.py`. Výsledný `public/data/landscape.bin` má 1,35 MB, po gzip 0,55 MB.
Balíček obsahuje otisky terénu, silnic, kolejí, budov a mapových ploch. Pokud se podklad
liší nebo balíček při načtení selže, hra použije společnou síť po 8 m.

```bash
mkdir -p data-raw/krajina
python3 tools/build_landscape.py
python3 tools/build_landscape.py --data public/data --output data-raw/krajina/opakovani.bin
cmp public/data/landscape.bin data-raw/krajina/opakovani.bin
```

## Kontrola ve hře

Uložené snímky před a po úpravě zahrnují 12 stejných pohledů. Patří mezi ně pole na západě,
Třemošná, Chrást, Bolevecké rybníky, Valík, jihovýchodní krajina, východní okraj mapy,
Plzeň a všechna čtyři místa první trasy. Snímky jsou v `data-raw/krajina/pred` a
`data-raw/krajina/po`. Na 244 156 uložených bodech silnic a cest vyšla největší změna terénu
1,4 cm. Automatická kontrola porovnala všechny hrany jemných dlaždic v distribuovaných datech.

Automatický řidič projel oběma směry přibližně 29,9 km mezi Plzní a pěším přístupem k hamru
přes Klabavu, Rokycany a Hrádek. Následný pěší test došel až k hamru. U Klabavy se výška stojící
postavy shoduje s výškou trojúhelníku pod ní po započtení odstupu chodidel. Prošlo 17 testů
JavaScriptu, 13 testů Pythonu a všech 16 testů v Chromu včetně letu a mobilního ovládání.

Při 1920 × 1080 ve vysoké kvalitě dosáhla jízda u plzeňské radnice i let nad Dobřívem 60 FPS
na MacBooku Air M4 v Chrome 157.0.8103.79. První načtení z místního serveru mělo medián 740 ms.
Výsledky jsou v `data-raw/krajina/playwright.json` a `data-raw/krajina/vykon.json`.

```bash
node tools/audit_landscape.mjs data-raw/krajina/po http://127.0.0.1:4173/
```
