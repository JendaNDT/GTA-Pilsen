# Šest domů u plzeňské radnice

Úprava vychází z revize `012bc91` s kašnami. Při pohledu od katedrály se pořadí čte zleva doprava.

| Číslo orientační | Dům | Co je vidět z náměstí |
| ---: | --- | --- |
| 40 | Pechovský | Tři páry oken, trojúhelné nadokenní římsy a členěný pás pod okapem |
| 41 | Císařský | Světlá omítka, opěráky, dvě řady vikýřů nad šesti okenními osami |
| 2 | U Bílé růže | Krémové průčelí s párovými okny a rozetami pod dlouhou okapní římsou |
| 3 | U Zlatého beránka | Růžová fasáda se třemi skupinami oken a štukovými závěsy |
| 4 | Dům čp. 5 | Úzké žluté průčelí s trojúhelným štítem, středním oknem a dvěma světlými nikami |
| 5 | U Klotzů | Široké průčelí s vodorovnou římsou, zdvojenými okny a oblouky v přízemí |

Názvy a adresy odpovídají [Encyklopedii dějin města Plzně](https://encyklopedie.plzen.eu/home-mup/?acc=profil-ulice&load=20).

| Pohled ze stejné kamery | Původní hra | Upravená hra |
| --- | --- | --- |
| Západně od radnice | [Před](severni-stity/zapad-pred.jpg) | [Po](severni-stity/zapad-po.jpg) |
| Od radnice směrem k Rooseveltově | [Před](severni-stity/vychod-pred.jpg) | [Po](severni-stity/vychod-po.jpg) |
| Celá řada | [Před](severni-stity/rada-pred.jpg) | [Po](severni-stity/rada-po.jpg) |

## Podklady a provedení

Hlavní obrysy střech, štítu, opěráků a stěn určuje městské zaměření ze dvou mapových listů. Nové římsy a vikýře mají v podrobném zobrazení hloubku. Na nízké kvalitě sdílejí původní geometrii domu a jsou vykreslené v nové textuře. Přepínač `?stity=puvodni` umožňuje porovnání ve hře. Odstíny, drobná štuková výzdoba a hloubky říms jsou odhadem z fotografií. Výlohy a dveře jsou zjednodušené.

Kresba fasád a střešní krytiny i modely detailů jsou vlastní tvorba projektu. Fotografie sloužily k rozeznání domů, proporcí a barev.

- Pechovský dům, Sovicka169, CC BY-SA 4.0. [Detail průčelí](https://commons.wikimedia.org/wiki/File:Plze%C5%88,_n%C3%A1m%C4%9Bst%C3%AD_Republiky_40.jpg)
- Dva pohledy přes náměstí, Txllxt TxllxT, CC BY-SA 4.0. [Domy západně od radnice](https://commons.wikimedia.org/wiki/File:Plze%C5%88_-_N%C3%A1m%C4%9Bst%C3%AD_Republiky_-_Panorama_view_with_D%C5%AFm_Anny_Kreslov%C3%A9,_Ka%C5%A1na_And%C4%9Bl,_Renesan%C4%8Dn%C3%AD_radnice_(City_Hall)_1559_by_Giovanni_de_Statia_-_Renaissance_architecture_-_C%C3%ADsa%C5%99sk%C3%BD_d%C5%AFm_(Plze%C5%88)_-_Marian_column_1681_08.jpg) · [Východní část řady](https://commons.wikimedia.org/wiki/File:Plze%C5%88_-_N%C3%A1m%C4%9Bst%C3%AD_Republiky_-_Panorama_view_with_D%C5%AFm_Anny_Kreslov%C3%A9,_Ka%C5%A1na_And%C4%9Bl,_Renesan%C4%8Dn%C3%AD_radnice_(City_Hall)_1559_by_Giovanni_de_Statia_-_Renaissance_architecture_-_C%C3%ADsa%C5%99sk%C3%BD_d%C5%AFm_(Plze%C5%88)_-_Marian_column_1681_06.jpg)
- Pohled podél východních průčelí, Honza Groh (Jagro), CC BY-SA 3.0. [Severní část náměstí](https://commons.wikimedia.org/wiki/File:Plze%C5%88,_n%C3%A1m%C4%9Bst%C3%AD_Republiky,_severn%C3%AD_%C4%8D%C3%A1st.jpg)
- Ověření opěráků a oken Císařského domu, Alex Hauner, CC BY-SA 4.0. [Noční pohled od západu](https://commons.wikimedia.org/wiki/File:Radnice_m%C4%9Bsta_Plzn%C4%9B_a_C%C3%ADsa%C5%99sk%C3%BD_d%C5%AFm,_no%C4%8Dn%C3%AD_foto.jpg)

## Ověření ve hře

Všech 294 testů JavaScriptu i produkční sestavení prošlo. Testy načítají skutečné městské listy, ověřují pokrytí všech šesti adres, zachování samostatného modelu radnice a původních povrchů pro kolize. Při neshodě otisku městských dat se vlastní výzdoba nepoužije. Na nízké kvalitě počet trojúhelníků upravených ploch odpovídá původním domům.

| Vysoká kvalita včetně stínů | Volání před → po | Trojúhelníky před → po |
| --- | ---: | ---: |
| Západní dvojice | 475 → 483 | 770 078 → 770 890 |
| Východní čtveřice | 532 → 540 | 784 348 → 785 160 |
| Celá řada | 547 → 555 | 794 216 → 795 028 |

Srovnání dvou po sobě jdoucích měření na Apple M4 ve WebGL 2 při 1920 × 1080, na nízké kvalitě a s dohledem 340 m. Nástroj `tools/measure_map.mjs --work --center-flight` měřil práci při průjezdu a přeletu centrem. Tabulka uvádí 95. percentil v milisekundách.

| Trasa | CPU před | CPU po | GPU před | GPU po |
| --- | ---: | ---: | ---: | ---: |
| Jízda | 4,10 | 4,00 | 7,38 | 6,75 |
| Let | 3,50 | 3,50 | 5,86 | 4,85 |

Ve společném běhu prošlo 407 ze 410 prohlížečových zkoušek. Nová zkouška návratu na náměstí, uvolnění obou částí řady z paměti a načtení spolu s radnicí prošla v dotykové emulaci na nízké kvalitě ve WebGL 2 i WebGPU. Fyzický telefon se nezkoušel. Prošly i výkonnostní rozpočty. Samostatně jsme ověřili přepnutí na původní průčelí.

Na obou vykreslovačích přetrvává známé selhání testu nočního kontrastu oken na náměstí. Test ranní špičky na Klatovské ve WebGPU jednou naměřil zastavení na 145,5 s oproti limitu 120 s. Při samostatném opakování prošel s nejdelším zastavením 108,5 s.
