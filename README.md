# Plzeň naplno – sestavené webové verze

Tato větev obsahuje jen sestavené hry pro GitHub Pages:

- [**Zkouška kulečníku**](https://jendandt.github.io/GTA-Pilsen/zkouska-kulecniku/) – E63 z revize `c5255b2`. Na mapě vyhledej „kulečník“, vejdi do bowlingu U Papírny a zvol **Ke kulečníku**.
- **kořen** – webová verze z enginu Godot (adresář `godot/`, revize d868511 větve `godot/prestavba`),
- **`zkouska-vzhledu/`** – webová hra (three.js), revize `eb5d900` z větve `etapa/E62` s průchozími vozy na všech 51 linkách a kontrolou volného místa u dveří před výstupem.
  V hlavní nabídce zvol **Svézt se MHD** a vyber spoj. Zahrnuje také dřívější úpravy vzhledu
  (vydání 0.2.0 a nová postava hráče a chodců: oblé tělo se svažujícími se rameny, obličejem,
  účesy a dlaněmi, jemné zastínění, přirozenější chůze, běh, stání, skok, dopad a plavání). Obsahuje nové světlo, fasády, stromy, podrobnější auta, vyhlazené tramvaje, hladký profil silnic,
  chodníky s obrubníkem, zaoblené rohy křižovatek, příčný sklon silnic s klopenými zatáčkami,
  opravený nájezd na Wilsonův most, Anglické nábřeží zvednuté na úroveň ulice a klidnější, ostřejší
  obraz za jízdy (jemné vzory bez blikání, koleje v asfaltu ulice, terén pod okrajem silnice)
  a celou obrazovku (po kliknutí na Hrát, tlačítko ⛶).
  Původní vzhled pro srovnání zapne adresa `zkouska-vzhledu/?vzhled=puvodni`, původní silnice
  `zkouska-vzhledu/?silnice=puvodni`, chodníky jen v textuře `zkouska-vzhledu/?chodniky=0`, ostré rohy
  `zkouska-vzhledu/?rohy=0`, silnice vodorovné napříč `zkouska-vzhledu/?sklon=0`, nábřeží bez zvednutí
  `zkouska-vzhledu/?nabrezi=0` a obraz před opravou blikání a rozmazání `zkouska-vzhledu/?obraz=puvodni`
  (samotné doostření vypne `?ostreni=0`). Původní kvádrovou postavu vrátí
  `zkouska-vzhledu/?postava=puvodni`, zastínění postavy vypne `zkouska-vzhledu/?zastineni=0`. Panel pro měření výkonu zapne
  `zkouska-vzhledu/?debug&adapt=0&quality=low`. Popis změn je v `docs/vzhledova-zkouska.md`,
  `docs/auta-a-mhd.md`, `docs/silnice.md`, `docs/chodniky.md`, `docs/rohy.md`, `docs/sklon.md`,
  `docs/nabrezi.md`, `docs/obraz.md` a `docs/postava.md`.

Zdrojové kódy, návody a seznam zdrojů dat a licencí jsou v uvedených větvích, v souborech
`README.md` (část „Zdroje a licence dat“) a `godot/README.md`. Uvedení zdrojů je také ve hře
v menu **O hře**.
