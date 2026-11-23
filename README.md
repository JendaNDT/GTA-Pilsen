# Plzeň naplno – sestavené webové verze

Tato větev obsahuje jen sestavené hry pro GitHub Pages:

- **kořen** – webová verze z enginu Godot (adresář `godot/`, revize d868511 větve `godot/prestavba`),
- **`zkouska-vzhledu/`** – původní webová hra (three.js) ve verzi 0.2.0 s opravami obrazu z větve
  `claude/bold-ptolemy-36flyi`, revize 2b193c8 (navazuje na `main`, revize 6b8df3a).
  Obsahuje nové světlo, fasády, stromy, podrobnější auta, vyhlazené tramvaje, hladký profil silnic,
  chodníky s obrubníkem, zaoblené rohy křižovatek, příčný sklon silnic s klopenými zatáčkami,
  opravený nájezd na Wilsonův most, Anglické nábřeží zvednuté na úroveň ulice a klidnější, ostřejší
  obraz za jízdy (jemné vzory bez blikání, koleje v asfaltu ulice, terén pod okrajem silnice).
  Původní vzhled pro srovnání zapne adresa `zkouska-vzhledu/?vzhled=puvodni`, původní silnice
  `zkouska-vzhledu/?silnice=puvodni`, chodníky jen v textuře `zkouska-vzhledu/?chodniky=0`, ostré rohy
  `zkouska-vzhledu/?rohy=0`, silnice vodorovné napříč `zkouska-vzhledu/?sklon=0`, nábřeží bez zvednutí
  `zkouska-vzhledu/?nabrezi=0` a obraz před opravou blikání a rozmazání `zkouska-vzhledu/?obraz=puvodni`
  (samotné doostření vypne `?ostreni=0`). Panel pro měření výkonu zapne
  `zkouska-vzhledu/?debug&adapt=0&quality=low`. Popis změn je v `docs/vzhledova-zkouska.md`,
  `docs/auta-a-mhd.md`, `docs/silnice.md`, `docs/chodniky.md`, `docs/rohy.md`, `docs/sklon.md`,
  `docs/nabrezi.md` a `docs/obraz.md`.

Zdrojové kódy, návody a seznam zdrojů dat a licencí jsou v uvedených větvích, v souborech
`README.md` (část „Zdroje a licence dat“) a `godot/README.md`. Uvedení zdrojů je také ve hře
v menu **O hře**.
