# Nové divadlo v Plzni

Doplnění E25 navazuje na revizi `b8cd154` s Velkým divadlem. Ze sadů Pětatřicátníků je vidět nakloněná betonová stěna a za ní prosklené foyer. Tři spodní otvory sahají až k chodníku. Na nádvoří stojí betonová koule, nad průchodem vedou spojovací chodby do tmavého administrativního křídla. Z druhé strany je vidět červený plášť sálu s trojúhelníkovým zasklením.

| Pohled z herní kamery | Původní verze | Upravená verze |
| --- | --- | --- |
| Průčelí z protějšího chodníku | [Před úpravou](nove-divadlo/pruceli-puvodni.jpg) | [Po úpravě](nove-divadlo/pruceli-uprava.jpg) |
| Spojovací chodby a nádvoří | [Před úpravou](nove-divadlo/kridla-puvodni.jpg) | [Po úpravě](nove-divadlo/kridla-uprava.jpg) |
| Červený plášť sálu | [Před úpravou](nove-divadlo/sal-puvodni.jpg) | [Po úpravě](nove-divadlo/sal-uprava.jpg) |
| Areál při pohledu z výšky | [Před úpravou](nove-divadlo/strechy-puvodni.jpg) | [Po úpravě](nove-divadlo/strechy-uprava.jpg) |

## Podklady

Obrysy a výšky hlavních částí vycházejí z městského 3D modelu Plzně, list `-384--128.bin` s otiskem `691b6e4e`. Půdorysy spojovacích chodeb pocházejí z OpenStreetMap (ODbL). Projekt vytvořil vlastní geometrii a kresbu povrchů podle čtyř fotografií poskytnutých autorem hry. Fotografie sloužily jen jako předloha. Sklon stěny, tvary otvorů, členění oken, výšku přední chodby a rozměr koule jsme odhadli podle snímků. [Zdroje a licence](../../README.md#zdroje-a-licence-dat)

## Jak vyzkoušet úpravu

Přejdi od protějšího chodníku k prostřednímu portálu a zkus dojít až ke sklu. Potom obejdi šikmou stěnu zleva a projdi kolem koule pod první spojovací chodbou. Pro srovnání lze hru otevřít s parametrem `?noveDivadlo=puvodni`.

## Ověření a výkon

Při stejném nastavení kamery zůstalo ve čtyřech pohledech ve vysoké kvalitě 477, 494, 462 a 478 vykreslovacích volání. Počet trojúhelníků včetně stínů vzrostl v každém pohledu o 18 472. Celý areál sdílí jedinou novou texturu. Dotyková zkouška v Chromiu při rozlišení 844 × 390 ověřuje dojití ke sklu, kolizi s betonovým pilířem i koulí, průchod pod chodbou a uvolnění a návrat modelu na nízké předvolbě. Skutečný telefon jsme při této úpravě nezkoušeli.

Prošlo všech 276 testů JavaScriptu a produkční sestavení. V celé sadě prohlížečových zkoušek prošlo 394 z 396 kontrol. Stávající kontrola kontrastu nočních oken na náměstí Republiky selhala ve WebGL 2 i WebGPU stejně jako při předchozí úpravě Velkého divadla. Po dokončení kresby střešních částí jsme na výsledném sestavení zopakovali dotykovou zkoušku Nového divadla na obou vykreslovačích.

Přímo před průčelím jsme na Apple M4 měřili čtyřikrát po deseti sekundách v nízké kvalitě při 1920 × 1080 ve WebGL 2. V pořadí původní, upravená, upravená a původní verze vyšel 95. percentil času grafiky na 5,59, 5,34, 6,46 a 6,07 ms.

Stejný počítač a předvolbu jsme použili pro dvě jízdy centrem a dva lety nad centrem v každé verzi. Nástroj `tools/measure_map.mjs --work --center-flight` měřil skutečnou práci na snímku při dohledu 340 m. Čísla uvádějí 95. percentil v milisekundách pro první a druhé měření.

| Trasa | CPU před | CPU po | GPU před | GPU po |
| --- | --- | --- | --- | --- |
| Jízda centrem | 4,2 / 4,4 | 4,2 / 4,4 | 6,80 / 7,13 | 9,85 / 8,46 |
| Let nad centrem | 4,0 / 4,2 | 4,2 / 4,3 | 7,60 / 8,55 | 7,23 / 5,82 |

Při jízdě centrem překročilo zpomalení grafiky hranici 10 % v obou porovnáních. Scéna s novým divadlem v této trase vykreslovala o 2 710 až 5 320 trojúhelníků více. Otvory mají vlastní přední i zadní hranu a vnitřní ostění, aby zůstal zachovaný průhled ze strany. Samostatný podíl této geometrie na čase celé scény měření nerozlišuje. Ve všech čtyřech jízdách a letech upravené hry zůstal 95. percentil pod rozpočtem 12 ms pro grafiku.
