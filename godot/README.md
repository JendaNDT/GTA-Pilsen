# Plzeň naplno v Godotu

Nová verze hry postavená v **Godotu 4.7.2**. Svět vychází ze stejných dat jako původní
webová hra v kořeni repozitáře: terén, silnice, mosty, budovy, zastávky a jízdní řády MHD jsou
převedené z `public/`. Původní hra zůstává beze změny a dál se spouští podle hlavního
[README](../README.md). Co z předlohy už funguje a jak je to ověřené, je v [FUNKCE.md](FUNKCE.md).

## Jak hru spustit na počítači

1. Stáhni Godot 4.7.2 (standardní verze, ne .NET) z [godotengine.org](https://godotengine.org/download/archive/4.7.2-stable/).
2. Spusť Godot, klikni na **Importovat**, vyber soubor `godot/project.godot` a potvrď **Importovat a upravit**.
   Při prvním otevření Godot chvíli připravuje soubory (asi minutu), to je v pořádku.
3. Stiskni **F5** (nebo trojúhelník vpravo nahoře). Hra začíná na náměstí Republiky.

Herní data jsou v repozitáři hotová (`godot/data/`), nic dalšího se stahovat nemusí.
Postup se ukládá sám každých 20 sekund a při zavření okna.

## Co se dá dělat

- **Chodit a řídit** po celé mapě od Plzně po Rokycany a Dobřív. Auto u startu je tvoje,
  stojící auto v provozu jde „sebrat“ (policie si toho může všimnout).
- **Jezdit MHD**: na zastávce je tabule odjezdů, vůz zastaví podle jízdního řádu PMDP, F nastoupí,
  na další zastávce F vystoupí. Zastávka se ohlásí hlasem.
- **Směny řidiče MHD** (menu → Směny MHD): odřiď skutečný spoj tramvaje 1, trolejbusu 16 nebo
  autobusu 30. W plyn, S brzda, mezerník nouzová brzda, u stanoviště F otevře a zavře dveře.
  Za dobrou jízdu (60 bodů a obsluha 80 % zastávek) dostaneš zaplaceno.
- **Garáž u hlavního nádraží** (menu → Garáž): koupě vlastního auta, lepší brzdy a pneumatiky, oprava.
- **Vrtulník** na heliportech (F u vrtulníku), přistání kdekoli na rovině.
- **Objevování** 53 památek a míst, každé za odměnu; velká mapa (M) s hledáním a navigací.
- **Počasí** podle ročního období (déšť, sníh, mlha, mokrá vozovka brzdí hůř), den a noc podle
  skutečného času v Plzni. V nastavení jde zapnout „Vždy jasno“.
- **Fotorežim** (O): hra se zastaví, kamerou se volně létá a snímek se uloží jako PNG.

## Ovládání

| Klávesa | Co dělá |
| --- | --- |
| W A S D / šipky | chůze, řízení |
| Shift | běh |
| Mezerník | skok, ruční brzda (ve směně nouzová brzda) |
| F nebo E | nastoupit do auta, MHD nebo vrtulníku / vystoupit (ve směně dveře) |
| myš se stisknutým tlačítkem | otáčení kamery, kolečko přibližuje |
| C | vzdálenost kamery |
| H | klakson |
| R | postavit auto zpět na kola |
| M | velká mapa (kliknutím nastavíš cíl) |
| J | zakázka rozvozu jídla |
| N | posunout čas o 3 hodiny |
| O | fotorežim (WASD a Q/E pohyb, myš otáčí, O nebo Esc zpět) |
| Esc | menu: hra, zakázky, garáž, směny, nastavení, ovládání, o hře |

Na dotykové obrazovce se objeví páčka vlevo a tlačítka vpravo, tahem prstu vpravo se otáčí kamera.

## Úpravy v editoru

Mapa je rozdělená na **oblasti 1 × 1 km** (`svet/oblasti/oblast_X_Z.tscn`). Každá oblast obsahuje
zastávky a místa, která můžeš posouvat, přejmenovat nebo k nim přidávat vlastní objekty.

1. V Godotu vpravo otevři panel **Plzeň** a napiš název místa (například „Hlavní nádraží“ nebo
   „namesti republiky“, diakritika není nutná).
2. Dvojklikem otevřeš oblast a vybereš bod. V 3D pohledu stiskni **F**, kamera na něj zaměří.
   Kolem je vidět skutečné okolí (terén, silnice, budovy), které se do scény neukládá.
3. Zastávku posuň myší (táhni šipky) a scénu ulož **Ctrl+S**. Ve hře na posunutém místě zastavují
   i tramvaje a autobusy.
4. Vlastní objekty vkládej do uzlu **Upravy** dané oblasti. Importér je nikdy nemění.
5. Tlačítkem **Znovu importovat otevřenou oblast a okolí** se obnoví body z dat. Ručně posunuté
   nebo přejmenované body zůstanou, jen se doplní nové a smažou zrušené (pokud jsi je neupravil).

## Hra na telefonu (webová verze)

Webová verze běží v prohlížeči počítače i telefonu (Chrome, Safari, Firefox), bez instalace.

1. V Godotu otevři **Editor → Spravovat šablony exportu** a stáhni šablony pro 4.7.2 (jednou).
2. **Projekt → Exportovat…**, vyber předvolbu **Web** a klikni **Exportovat projekt**
   (cíl `godot/export/web/index.html`). Z příkazové řádky totéž udělá:

   ```bash
   godot --headless --path godot --export-release "Web" export/web/index.html
   ```

3. Složku `godot/export/web` stačí nahrát na libovolný statický web (například GitHub Pages).
   Webová verze je bez vláken, takže nepotřebuje žádné zvláštní nastavení serveru.
4. Pro rychlé vyzkoušení doma: na počítači ve složce `godot/export/web` spusť

   ```bash
   python3 -m http.server 8000
   ```

   a v telefonu ve stejné Wi-Fi otevři `http://<adresa počítače>:8000`.

Na telefonu se kvalita grafiky sama nastaví na „nízká“. První načtení stáhne asi 70 MB dat.

## Hra jako program pro počítač

V **Projekt → Exportovat…** jsou připravené předvolby **Windows**, **Linux** a **macOS**
(výstup do `godot/export/`). Po stažení šablon exportu stačí zvolit předvolbu a **Exportovat projekt**.
Data mapy jsou zabalená uvnitř, program se dá zkopírovat a spustit na jiném počítači.

## Kde co je

| Složka | Obsah |
| --- | --- |
| `sceny/hra.tscn` | hlavní scéna hry (spouští ji F5) |
| `svet/oblasti/` | upravitelné oblasti 1 × 1 km se zastávkami a místy |
| `skripty/data/` | čtení dat mapy a silničního grafu |
| `skripty/svet/` | načítání dlaždic a stavba terénu, silnic, mostů, budov, stromů; oblasti a importér |
| `skripty/hrac/`, `skripty/vozidla/` | chodec, auto a vrtulník |
| `skripty/doprava/` | provoz, semafory, chodci a policie |
| `skripty/mhd/` | jízdní řád a vozy MHD |
| `skripty/hra/` | řízení hry, počasí, prostředí, zvuky, garáž, směny, fotorežim, ukládání |
| `skripty/ui/` | ukazatele, menu, mapa a dotykové ovládání |
| `addons/plzen/` | panel Plzeň v editoru |
| `materialy/` | shadery terénu, silnic a fasád |
| `data/` | převedená mapa a zvuky (vyrábí je převodník, ručně se nemění) |
| `testy/` | zkoušky herních situací |

## Zkoušky

Všechny zkoušky spustí jeden příkaz z kořene repozitáře (trvá asi 40 minut):

```bash
godot/testy/spust_zkousky.sh
```

Každá zkouška hraje celou situaci jako hráč: chůze na zastávku a jízda tramvají, přejezd a chůze
po Wilsonově mostě i průjezd pod mostem Milénia, uložení a načtení po restartu, provoz a semafory,
policie, let vrtulníkem, nárazy a brzdná dráha na zkušební ploše, garáž, směna řidiče tramvaje,
fotorežim a výpočet počasí. Každá na konci vypíše `VÝSLEDEK: PROŠLO`. Jednotlivě například:

```bash
godot --headless --path godot testy/scenar_most.tscn
```

Webovou verzi v emulovaném telefonu ověří `node tools/godot/zkouska_web.mjs` (po webovém exportu).

## Obnova dat mapy

Data v `data/` vyrábí převodník z původní hry. Používá její vlastní výpočty terénu, mostů
a silnic, takže tvar města zůstává stejný. Spuštění z kořene repozitáře (potřebuje Node.js
a `npm ci`, trvá asi 2 minuty):

```bash
node tools/godot/export_svet.mjs
```

Potom obnov upravitelné oblasti (ruční úpravy zůstanou):

```bash
godot --headless --path godot -s res://editor/import_oblasti.gd
```

Zdroje dat a licence jsou stejné jako u původní hry, viz část „Zdroje a licence dat“
v [hlavním README](../README.md#zdroje-a-licence-dat). Seznam je i ve hře v menu **O hře**.
