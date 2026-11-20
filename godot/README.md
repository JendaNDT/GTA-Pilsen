# Plzeň naplno v Godotu

Nová verze hry postavená v **Godotu 4.7.2**. Svět vychází ze stejných dat jako původní
webová hra v kořeni repozitáře: terén, silnice, mosty a budovy jsou převedené z `public/data`.
Původní hra zůstává beze změny a dál se spouští podle hlavního [README](../README.md).

## Jak hru spustit

1. Stáhni Godot 4.7.2 (standardní verze, ne .NET) z [godotengine.org](https://godotengine.org/download/archive/4.7.2-stable/).
2. Spusť Godot, klikni na **Importovat**, vyber soubor `godot/project.godot` a potvrď **Importovat a upravit**.
   Při prvním otevření Godot chvíli připravuje soubory, to je v pořádku.
3. Stiskni **F5** (nebo trojúhelník vpravo nahoře). Hra začíná na náměstí Republiky.

Herní data mapy jsou v repozitáři hotová (`godot/data/svet/`), nic dalšího se stahovat nemusí.

## Ovládání

| Klávesa | Co dělá |
| --- | --- |
| W A S D / šipky | chůze, řízení |
| Shift | běh |
| Mezerník | skok, ruční brzda |
| F nebo E | nastoupit do auta / vystoupit |
| myš se stisknutým tlačítkem | otáčení kamery, kolečko přibližuje |
| C | vzdálenost kamery |
| R | postavit auto zpět na kola |
| N | posunout čas o 3 hodiny |

Na dotykové obrazovce se objeví páčka vlevo a tlačítka vpravo, tahem prstu vpravo se otáčí kamera.

## Kde co je

| Složka | Obsah |
| --- | --- |
| `sceny/hra.tscn` | hlavní scéna hry (spouští ji F5) |
| `skripty/data/mapa.gd` | čtení dat mapy, výška terénu, nejbližší ulice |
| `skripty/svet/` | načítání dlaždic 256 × 256 m a stavba terénu, silnic, mostů, budov a stromů |
| `skripty/hrac/`, `skripty/vozidla/` | chodec a auto |
| `skripty/hra/` | řízení hry, slunce a obloha, vstupy |
| `skripty/ui/` | ukazatele na obrazovce a dotykové ovládání |
| `materialy/` | shadery terénu, silnic a fasád |
| `data/svet/` | převedená mapa (vyrábí ji převodník, ručně se nemění) |
| `testy/` | zkoušky herních situací |

## Zkoušky

Celou první hratelnou část (start, chůze, nástup do auta, přejezd Wilsonova mostu, výstup a chůze
po mostě) ověří jeden příkaz z kořene repozitáře:

```bash
godot --headless --path godot testy/scenar_most.tscn
```

Na konci vypíše `VÝSLEDEK: PROŠLO`.

## Obnova dat mapy

Data v `data/svet/` vyrábí převodník z původní hry. Používá její vlastní výpočty terénu, mostů
a silnic, takže tvar města zůstává stejný. Spuštění z kořene repozitáře (potřebuje Node.js
a `npm ci`, trvá asi 2 minuty):

```bash
node tools/godot/export_svet.mjs
```

Zdroje dat a licence jsou stejné jako u původní hry, viz část „Zdroje a licence dat“
v [hlavním README](../README.md#zdroje-a-licence-dat).
