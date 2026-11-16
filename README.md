# Plzeň naplno

Skutečná Plzeň jako otevřený svět v prohlížeči. Chodíš, jezdíš autem, tramvají a trolejbusem,
létáš vrtulníkem, rozvážíš jídlo a ujíždíš policii – to vše v ulicích postavených ze skutečných
otevřených dat. Běží na počítači i na mobilu, bez instalace.

## Co ve hře je

- **Z Plzně až do Dobříva.** Území má 33,2 × 19,7 km (zhruba 653 km²). Do Rokycan dojedeš
  po D5 nebo po místních silnicích a dál přes Hrádek do Dobříva. Mapa obsahuje 103 tisíc budov
  (přibližně tři čtvrtiny s výškou z měření ČÚZK), 41 tisíc silnic a cest, řeky, rybníky, lesy a parky.
- **Skutečný terén**: kopce a údolí řek podle výškopisu ČÚZK (Lochotín je o 60 m výš než náměstí
  Republiky, Chlum o 100 m, Radyně o 250 m), 1179 silničních a kolejových mostů a dva průjezdné
  tubusy tunelu Valík. Auta se naklánějí podle svahu, do kopce zpomalují a z mostu se dá spadnout.
- **MHD podle skutečných linek**: tramvaje 1, 2 a 4 a trolejbusy jezdí po svých trasách a staví
  v zastávkách se skutečnými názvy. Vybrané spoje se vypravují podle zabaleného jízdního řádu PMDP.
  U nejbližší zastávky se zobrazí plánované odjezdy a do vozu se dá nastoupit.
- **Auta**: zaparkovaná i v provozu, osm typů, jízdní fyzika se smykem a poškozením.
- **Dopravní značení**: navigace i provoz respektují jednosměrky, zákazy vjezdu a odbočení.
  Auta dávají přednost a zastavují u stopek. Světla pro chodce, auta a MHD na křižovatce mají
  společný herní cyklus. U rychloměru se zobrazuje doložený limit pro směr jízdy.
- **Rozvoz jídla**: zakázky ze skutečných podniků na skutečné adresy, s časovým limitem a navigací.
- **Policie**: za krádež auta nebo nebezpečnou jízdu po tobě jde, dá se ujet nebo skončit s pokutou.
- **Vrtulníky**: stojí na heliportech (FN Lochotín, pivovar, Bory) a na náměstí Republiky,
  přistávat jde i na střechách.
- **Měřené centrum.** Čtyři mapové listy městského 3D modelu dodávají zaměřené střechy a římsy.
  Materiály plzeňských domů vycházejí z typu budovy a městského obvodu. U vodního hamru v Dobřívě
  uvidíš šindelovou střechu, dřevěné vantroky a čtyři otáčející se vodní kola.
- **53 míst k objevení** včetně vodního hamru v Dobřívě. Na velké mapě vyhledáš obce a památky
  i bez diakritiky. Modré tečky vedou poslední úsek k hamru pěšky, červené příčky označují
  uzavírky na okraji mapy. Hra střídá den a noc, ukazuje den v týdnu a ukládá datum i postup.
  Hodiny u minimapy lze skrýt v nastavení.

## Ovládání

| Klávesa | Co dělá |
| --- | --- |
| W A S D / šipky | chůze, řízení |
| Shift | běh (ve vrtulníku klesání) |
| Mezerník | ruční brzda, skok, ve vrtulníku stoupání |
| F nebo E | nastoupit / vystoupit |
| J | vzít nebo zrušit zakázku |
| M | velká mapa (vyhledej místo nebo kliknutím nastav cíl) |
| C · H · R | kamera · klakson · vrátit na silnici |
| N · Esc | posunout čas o 3 hodiny · menu |

Na dotykové obrazovce se objeví páčka a tlačítka. Telefon automaticky použije nižší grafickou
kvalitu. Na počítači ji lze zapnout parametrem `?quality=low`. Ve vyšší kvalitě zobrazí `?wet=1`
tlumené odlesky na mokré dlažbě v obou ukázkových lokalitách.

## Jak hru spustit u sebe

Na Macu ve Finderu dvakrát klikni na [Spustit hru.command](Spustit%20hru.command). Terminál
spustí místní server a hra se otevře na [localhost:5173](http://localhost:5173/). Terminál
nech při hraní otevřený. Soubor `index.html` otevřený z disku zobrazí pokyny ke spuštění.

### Spuštění z terminálu

Je potřeba [Node.js](https://nodejs.org) 20.19+ nebo 22.12+ (doporučená verze je 24 LTS,
uložená také v `.nvmrc`). Node.js 18 a 21 už nejsou podporované.

```bash
npm ci
```

```bash
npm run dev
```

Hra pak běží na adrese, kterou příkaz vypíše (obvykle http://localhost:5173).

Verzi pro nasazení na web vytvoří:

```bash
npm run build
```

Výsledek je ve složce `dist/` – obyčejné statické soubory, které jde nahrát na jakýkoli hosting.

## Kontroly před odesláním změn

Regresní testy kolizí, terénu, silničního grafu a distribuovaných dat:

```bash
npm test
```

Testy přípravy dat (po instalaci Python závislostí uvedených níže):

```bash
npm run test:python
```

Testy hry v Chromiu ověřují chůzi, mapu a navigaci, auto, vrtulník, rozvoz,
tramvaj, uložení postupu a mobilní dotykové ovládání. Používají debug režim pro
řízený čas a přesun k interakcím; mobil je emulovaný, nejde o měření výkonu telefonu.

```bash
npx playwright install chromium
npm run build
npm run test:e2e
```

Testy si samy spustí lokální server nad `dist/`. GitHub Actions spouští testy JavaScriptu
a Pythonu, audit závislostí a sestavení na Node.js 20.19, 22.12 a 24; na Node.js 24 také
testy v prohlížeči. Neúspěšný průchod prohlížečem uloží trasu a snímek obrazovky jako artefakt.

## Odkud jsou data a jak je obnovit

Hotová herní data jsou v repozitáři ve složce `public/data/` (asi 25,2 MB včetně jízdního řádu PMDP).
Měřené centrum se načítá po 256metrových dlaždicích z `public/detail/city/` (asi 15,8 MB celkem). Všechny soubory jsou připravené ke spuštění. Skripty ve složce `tools/` je umí vyrobit znovu z aktuálních zdrojů
(potřebují Python 3.10+ a balíčky z `tools/requirements.txt`):

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r tools/requirements.txt
```

Ve Windows se virtuální prostředí aktivuje příkazem `.venv\Scripts\activate`.

```bash
python3 tools/fetch_osm.py
```

```bash
python3 tools/fetch_dem.py
```

```bash
python3 tools/extract_osm.py
```

```bash
python3 tools/fetch_traffic.py
```

```bash
python3 tools/build_data.py
```

| Skript | Co dělá |
| --- | --- |
| `area.py` | jediné místo, kde je zadaný rozsah herního území (stačí změnit a spustit ostatní skripty) |
| `fetch_osm.py` | stáhne výřez OpenStreetMap pro Plzeňský kraj |
| `fetch_dem.py` | stáhne výškopis ČÚZK (povrch DMP 1G a terén DMR 5G) pro oblast Plzně |
| `extract_osm.py` | vybere z výřezu jen oblast hry |
| `fetch_traffic.py` | stáhne otevřený pasport svislého a vodorovného značení města Plzně |
| `build_data.py` | spočítá výšky budov a vyrobí kompaktní soubory pro hru |
| `build_timetable.py` | připraví z GTFS PMDP odjezdy a kalendář stávajících herních tras |
| `build_heritage.py` | převede městské plochy SHP do herních souřadnic |
| `build_city.mjs` | sestaví měřené budovy do dlaždic a spáruje je s půdorysy OSM |
| `terrain.py` | pomocný modul: výšková síť terénu, zarovnání pod silnicemi, hladiny, výšky mostů |
| `osm_source.py` | ověření a přenos data OSM z hlavičky zdrojového PBF |
| `coordinates.py` | obousměrný převod mezi WGS 84 a herními metry |

Surová data (asi 2,2 GB pro výřez do Dobříva) se ukládají do `data-raw/`, která se do repozitáře nenahrává.

Pro sestavení do samostatné složky použij `python3 tools/build_data.py --output-dir data-raw/kandidat`.
Výškopis se opakovaně používá spolu se soubory `dmp.npy.json` a `dmr.npy.json`, které obsahují
rozsah, parametry exportu a kontrolní součet. `fetch_dem.py` obnoví starý nebo neplatný výškopis.
Při změně rozsahu spusť také `extract_osm.py` znovu. Postup obnovy ze stejných vstupů je
v [protokolu E01](docs/E01.md). Výřez do Rokycan a průjezdy popisuje [protokol E02](docs/E02.md).
Výřez do Dobříva, průjezdy a detaily terénu popisuje [protokol E03](docs/E03.md).
Zdroje značení a pilot jízdy, MHD a chůze popisuje [protokol E04](docs/E04.md). Referenční snímky,
zdroje geometrie a měření historických lokalit uvádí [protokol E05](docs/E05.md).
[Rozšíření E05 na Plzeň](docs/E05-mesto.md) popisuje sestavení všech čtyř listů centra a nové měření.
[Protokol E06](docs/E06.md) popisuje herní kalendář, rozsah jízdního řádu a jeho obnovu.

Datum OSM se čte z položky `osmosis_replication_timestamp` přímo v hlavičce staženého PBF,
ukládá se do `extract.pkl` a odtud do `meta.json` jako `osmTimestamp` (UTC) se zdrojem
`osmTimestampSource: "pbf-header"`. Datum sestavení ani nově stažený stavový soubor ho
nenahrazují. PBF bez data nebo starší výřez bez této položky se odmítne; výřez je třeba
znovu vytvořit příkazem `python3 tools/extract_osm.py`.

U přiložené historické datové sady není původní datum doloženo. Proto má
`osmTimestamp: null` a `osmTimestampSource: "unknown-legacy"`; menu „O hře“ tuto skutečnost
zobrazuje. Nové sestavení dat již musí obsahovat ověřené datum.

## Zdroje a licence dat

- Mapová data © [přispěvatelé OpenStreetMap](https://www.openstreetmap.org/copyright), licence ODbL.
- Terén vychází z digitálního modelu reliéfu DMR 5G a výšky budov z rozdílu digitálního modelu
  povrchu DMP 1G a DMR 5G © [ČÚZK](https://www.cuzk.cz). Terén je pro hru zjednodušený na síť
  po 8 metrech a pod silnicemi zarovnaný.
- Poloha vybraných dopravních značek, čar a přechodů vychází v Plzni také z otevřeného
  pasportu města. [Svislé značení](https://opendata.plzen.eu/public/opendata/detail/6) ·
  [Vodorovné značení](https://opendata.plzen.eu/public/opendata/detail/92)

- Měřené budovy centra vycházejí z dat města Plzně z roku 2024 od GEOREAL – Vybíral. Plochy jsou
  převedené do herních souřadnic a doplněné vlastními materiály. Hranice městských částí určují
  místní palety. [3D budovy centra Plzně](https://opendata.plzen.eu/public/opendata/detail/37) ·
  [Městské části](https://opendata.plzen.eu/public/opendata/detail/108)
- Odjezdy tramvají a trolejbusů vycházejí z GTFS Plzeňských městských dopravních podniků, a.s.
  Hra vybírá spoje na stávajících trasách a přiřazuje jejich zastávky k herní mapě.
  [Jízdní řády PMDP](https://opendata.plzen.eu/public/opendata/detail/187) ·
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Vlastní model vodního hamru vychází z půdorysu OpenStreetMap, terénu ČÚZK a fotografií obnovy.
  [Národní památkový ústav](https://www.npu.cz/cs/generalni-reditelstvi-npu/inspirujte-se/70002-obnova-hamru-horejsi-lub-v-dobrivu)

Skutečné jsou půdorysy a výšky budov, tvar terénu, průběh ulic, linky a zastávky MHD, názvy ulic,
podniků a adresy. Barvy a okna domů jsou stylizované. Provoz a chodci jsou simulovaní. Výšky mostovek a podélný
profil Valíku jsou dopočítané z výškopisu. Ostatní křížení označená jako tunely používají
zjednodušený průběh po terénu.

Hra je nezávislý fanouškovský projekt, není oficiálním produktem města Plzně ani dopravního podniku.
Inspirací byl projekt [HrejBrno.cz](https://www.hrejbrno.cz/).

## Jak je hra postavená

- [Three.js](https://threejs.org) pro 3D grafiku, [Vite](https://vitejs.dev) pro sestavení.
- `src/world/` – svět: načtení dat, terén a mosty, kolize, silniční síť, stavba 3D geometrie po dlaždicích.
- `src/entities/` – auta, chodci, tramvaje, vrtulník a jejich modely.
- `src/game/` – pravidla hry, kamera, ovládání, mapa, zakázky, zvuky.
