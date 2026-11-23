# Postava · vzhled těla a pohyby

Autor chtěl hezčí herní postavu a přirozenější pohyby a zvolil stylizovaný vzhled vytvořený přímo
v kódu hry. Úprava platí pro hráče i chodce, vychází z vydání 0.2.0 (revize `da600ef`). Nové
podklady ani knihovny nepřibyly.

## Co bylo předtím

Postava se skládala z 11 kvádrů (pánev, hrudník, hlava, paže, předloktí, stehna, lýtka) o zhruba
170 trojúhelnících. Pohyb byl jen houpání rukama a nohama, jehož rychlost rostla s rychlostí chůze.
Postava neměla vlastní pohyby vestoje, ve skoku, při dopadu ani ve vodě (ve vodě se jen ponořila
o metr). Stejné kvádry s rozměry a klouby má fyzikální postava pro pády a srážky
(`src/physics/ragdoll.js`).

## Co se změnilo

- **Tělo** (`src/entities/character-shape.js`). Každý díl leží ve stejném kvádru jako díl fyzikální
  postavy, takže pády fungují beze změny. Trup se zužuje do pasu a má zaoblená ramena, pánev pásek,
  hlava krk, oči, obočí, nos, ústa a uši. Vlasy jsou nakloněná čepička, která nechá čelo volné a
  zakryje týl; účesy jsou krátké, dlouhé, drdol a nakrátko. Paže a nohy jsou oblé a zužují se,
  v lokti a koleni je kloub, předloktí končí dlaní s palcem a lýtko botou s podrážkou. Paže se
  kreslí o 4,5 cm blíž k trupu (ramenní klouby fyzikální postavy jsou 0,3 m od osy těla), kolem
  stejného kloubu. Chodci mají šest odstínů pleti, šest barev vlasů a čtyři druhy bot. Kšiltovka,
  batoh, krátký rukáv a košile s légou zůstávají.
- **Pohyby** (`src/entities/character-pose.js`), čisté výpočty:
  - fáze kroku roste s uraženou vzdáleností, takže boty po zemi neklouzají; chodec udělá asi 101
    kroků za minutu, svižná chůze hráče 152 a běh 183,
  - při chůzi se střídají nohy a paže, koleno se ohne při švihu, pánev se dvakrát za krok zhoupne
    a natočí, hrudník se natáčí proti ní,
  - při běhu delší krok, předklon asi 11°, lokty ohnuté asi na 84°, víc pohupování a náklon do
    zatáčky,
  - vestoje dýchání, lehké přenášení váhy a po dvou a půl sekundách rozhlížení,
  - ve skoku pokrčená kolena, při pádu natažené nohy a ruce do stran, po dopadu podřep podle síly
    dopadu (do 0,32 s),
  - ve vodě při pohybu prsa se skloněným tělem, na místě šlapání vody.
- **Meze kloubů.** Natočení se omezuje na meze fyzikální postavy (například stehno nejvýš 60°
  dopředu nebo dozadu, koleno do 135°, loket do 140°).
- `?postava=puvodni` vrátí kvádrovou postavu, původní houpání i původní ponoření ve vodě.

## Měření a zkoušky

Měření probíhá, výsledky se doplní.
