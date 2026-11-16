# Plzeň naplno

Skutečná Plzeň jako otevřený svět v prohlížeči. Chodíš, jezdíš autem, tramvají a trolejbusem,
létáš vrtulníkem, rozvážíš jídlo a ujíždíš policii – to vše v ulicích postavených ze skutečných
otevřených dat. Běží na počítači i na mobilu, bez instalace.

## Co ve hře je

- **Celá Plzeň i s okolím**: území 16,6 × 19,7 km (zhruba 327 km²) – od Horní Břízy, Třemošné
  a Zruče-Sence na severu po Útušice a hrad Radyni na jihu, od Vejprnic na západě po
  Starý Plzenec a Dolany na východě. 73 tisíc budov (skoro tři čtvrtiny se skutečnou výškou
  z měření ČÚZK), 33 tisíc silnic a cest, řeky, rybníky, lesy a parky.
- **Skutečný terén**: kopce a údolí řek podle výškopisu ČÚZK (Lochotín je o 60 m výš než náměstí
  Republiky, Chlum o 100 m, Radyně o 250 m), 811 mostů s mostovkou, zábradlím a pilíři. Auta se naklánějí podle
  svahu, do kopce zpomalují a z mostu se dá spadnout.
- **MHD podle skutečných linek**: tramvaje 1, 2 a 4 a trolejbusy jezdí po svých trasách a staví
  v zastávkách se skutečnými názvy. Dá se nastoupit a svézt.
- **Auta**: zaparkovaná i v provozu, osm typů, jízdní fyzika se smykem a poškozením.
- **Rozvoz jídla**: zakázky ze skutečných podniků na skutečné adresy, s časovým limitem a navigací.
- **Policie**: za krádež auta nebo nebezpečnou jízdu po tobě jde, dá se ujet nebo skončit s pokutou.
- **Vrtulníky**: stojí na heliportech (FN Lochotín, pivovar, Bory) a na náměstí Republiky,
  přistávat jde i na střechách.
- **50 míst k objevení** (od katedrály po Radyni, Krkavec a Air Park ve Zruči), střídání dne a noci, velká mapa s navigací, ukládání postupu.

## Ovládání

| Klávesa | Co dělá |
| --- | --- |
| W A S D / šipky | chůze, řízení |
| Shift | běh (ve vrtulníku klesání) |
| Mezerník | ruční brzda, skok, ve vrtulníku stoupání |
| F nebo E | nastoupit / vystoupit |
| J | vzít nebo zrušit zakázku |
| M | velká mapa (kliknutím nastavíš cíl) |
| C · H · R | kamera · klakson · vrátit na silnici |
| N · Esc | posunout čas o 3 hodiny · menu |

Na dotykové obrazovce se objeví páčka a tlačítka.

## Jak hru spustit u sebe

Je potřeba [Node.js](https://nodejs.org) verze 18 nebo novější.

```bash
npm install
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

## Odkud jsou data a jak je obnovit

Hotová herní data jsou v repozitáři ve složce `public/data/` (asi 14 MB, při stahování do prohlížeče zhruba 6,5 MB), takže ke spuštění
není potřeba nic stahovat. Skripty ve složce `tools/` je umí vyrobit znovu z aktuálních zdrojů
(potřebují Python 3 a balíčky `numpy`, `tifffile` a `osmium`):

```bash
pip install numpy tifffile osmium
```

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
python3 tools/build_data.py
```

| Skript | Co dělá |
| --- | --- |
| `area.py` | jediné místo, kde je zadaný rozsah herního území (stačí změnit a spustit ostatní skripty) |
| `fetch_osm.py` | stáhne výřez OpenStreetMap pro Plzeňský kraj |
| `fetch_dem.py` | stáhne výškopis ČÚZK (povrch DMP 1G a terén DMR 5G) pro oblast Plzně |
| `extract_osm.py` | vybere z výřezu jen oblast hry |
| `build_data.py` | spočítá výšky budov a vyrobí kompaktní soubory pro hru |
| `terrain.py` | pomocný modul: výšková síť terénu, zarovnání pod silnicemi, hladiny, výšky mostů |

Surová data (stovky MB) se ukládají do `data-raw/`, která se do repozitáře nenahrává.

## Zdroje a licence dat

- Mapová data © [přispěvatelé OpenStreetMap](https://www.openstreetmap.org/copyright), licence ODbL.
- Terén vychází z digitálního modelu reliéfu DMR 5G a výšky budov z rozdílu digitálního modelu
  povrchu DMP 1G a DMR 5G © [ČÚZK](https://www.cuzk.cz). Terén je pro hru zjednodušený na síť
  po 8 metrech a pod silnicemi zarovnaný.

Skutečné jsou půdorysy a výšky budov, tvar terénu, průběh ulic, linky a zastávky MHD, názvy ulic,
podniků a adresy. Vymyšlené jsou barvy a okna domů, provoz a chodci. Výšky mostovek jsou dopočítané
(mezi konci mostu vedou rovně), tunely hra zatím neumí – silnice v nich vedou po povrchu.

Hra je nezávislý fanouškovský projekt, není oficiálním produktem města Plzně ani dopravního podniku.
Inspirací byl projekt [HrejBrno.cz](https://www.hrejbrno.cz/).

## Jak je hra postavená

- [Three.js](https://threejs.org) pro 3D grafiku, [Vite](https://vitejs.dev) pro sestavení.
- `src/world/` – svět: načtení dat, terén a mosty, kolize, silniční síť, stavba 3D geometrie po dlaždicích.
- `src/entities/` – auta, chodci, tramvaje, vrtulník a jejich modely.
- `src/game/` – pravidla hry, kamera, ovládání, mapa, zakázky, zvuky.
