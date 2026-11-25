# Plzeň naplno

Skutečná Plzeň jako otevřený svět v prohlížeči. Chodíš, jezdíš autem, tramvají, trolejbusem i autobusem,
létáš vrtulníkem, rozvážíš jídlo, vozíš zákazníky a ujíždíš policii – to vše v ulicích postavených ze skutečných
otevřených dat. Běží na počítači i na mobilu, bez instalace.

Ve složce [godot/](godot/README.md) vzniká verze v herním enginu **Godot 4.7.2** ze stejných dat,
s editorem pro úpravy míst a zastávek. Co z této hry už převedla a jak je to ověřené, ukazuje
[godot/FUNKCE.md](godot/FUNKCE.md). Autor 23. 11. 2026 rozhodl, že dál se rozvíjí webová hra popsaná níže;
verze v Godotu zůstává ve stavu z 20. 11. 2026 a nové funkce ani obsah se do ní nepřevádějí.

## Co ve hře je

- Po potvrzení cíle na mapě zůstane značka na vybraném místě. Pěšky se můžeš nechat vést od muzea k lávce u Strouhy nebo na zastávku Slovany. [Pěší navigace](docs/E34.md)

- Řidiči pouštějí lidi čekající u zebry. V sadech můžeš potkat chodce mířící od muzea ke Strouze, u hlavního nádraží sledovat výstup a nástup a v Radobyčicích výjezd autobusu ze zálivu. [Chování provozu ve hře](docs/E30.md)

- **Z Plzně až do Dobříva.** Území má 33,2 × 19,7 km (zhruba 653 km²). Do Rokycan dojedeš
  po D5 nebo po místních silnicích a dál přes Hrádek do Dobříva. Mapa obsahuje 103 tisíc budov
  (přibližně tři čtvrtiny s výškou z měření ČÚZK), 41 tisíc silnic a cest, řeky, rybníky, lesy a parky.
- **Skutečný terén**: kopce a údolí řek podle výškopisu ČÚZK (Lochotín je o 60 m výš než náměstí
  Republiky, Chlum o 100 m, Radyně o 250 m), 1179 silničních a kolejových mostů a dva průjezdné
  tubusy tunelu Valík. Auta se naklánějí podle svahu, do kopce zpomalují. Pěšího hráče u okraje mostu zastaví zábradlí nebo historická kamenná zídka.
- **Krajina mezi obcemi.** Na vybraných svazích a v údolích má terén hustší výškovou síť.
  Po celé mapě se střídají povrchy polí, luk, lesů, břehů a obcí podle mapových ploch.
- **Počasí a fotorežim.** Déšť prodlužuje brzdnou dráhu, sníh pokrývá střechy a dlažbu. Počasí můžeš v nastavení přepnout na vždy jasno. Fotorežim zastaví čas a uloží vlastní snímek PNG. Na předvolbě Ultra lze pro fotografii zapnout objemové sluneční paprsky parametrem `rays=1` v adrese hry. [Ovládání a ověření E24](docs/E24.md)

- **Tři úseky města při chůzi.** Na Americké, v Dřevěné a u hlavního nádraží mají vybraná průčelí vlastní přízemí. Dlažba a městský mobiliář respektují prostor pro dopravu a pěší. U hlavního nádraží čtyři modré označníky ukazují čísla stanovišť z herního jízdního řádu. Ke čtyřce se přichází od severního přechodu. Před hlavní budovou vede souvislá dlažba od Mikulášské až ke spodním dveřím. Průčelí poznáš podle zelených kupolí, velkého obloukového okna a názvu nádraží nad vchodem. Pod otevřenými mapovými přístřešky lze projít i jinde ve městě. [Denní a noční pohled na průčelí](docs/E25/pruceli-nadrazi.md) · [Snímky přednádraží](docs/E25/prednadrazi.md) [Rozsah a předlohy E25](docs/E25.md)
- **Roční období a noční město.** Druhy stromů se liší tvarem i podzimním listím. Voda pod Wilsonovým mostem proudí, na jezech se tvoří pěna a v noci lampy osvětlují okolí. [Snímky a měření E23](docs/E23.md)
- **Kompletní síť PMDP.** Tramvaje, trolejbusy i denní a noční autobusy obsluhují 51 linek z vybraného
  jízdního řádu. V mapě najdeš jednotlivá stanoviště a u nich odjezdy s cílem spoje. Do vozu
  nastoupíš klávesou F u otevřených dveří. Tabule zohledňuje polohu viditelných vozů.
- **Prostorový zvuk.** Každý motor, klakson a hlášení zastávky zní od svého vozidla.
  U aut slyšíš změnu otáček při řazení. Šum pneumatik sleduje rychlost vozu. [Poslech před a po](docs/E37/auto-pred-a-po.wav)
  U vody je slyšet tok nebo jez. U hamru zní mechanismus během práce kol. Zvuk lze vypnout v nastavení.
- **Auta**: zaparkovaná i v provozu, osm typů, jízdní fyzika se smykem a poškozením. Od střední
  kvality mají oblou karoserii s podběhy, okny a ráfky, na nízké kvalitě zůstávají jednodušší.
  [Nové modely aut a MHD](docs/auta-a-mhd.md)
- **Dopravní značení**: navigace i provoz respektují jednosměrky, zákazy vjezdu a odbočení.
  Auta dávají přednost a zastavují u stopek. Světla pro chodce, auta a MHD na křižovatce mají
  společný herní cyklus. U rychloměru se zobrazuje doložený limit pro směr jízdy.
- **Denní rytmus ulic.** Na měřených tazích v centru i dalších částech Plzně se provoz mění
  podle hodinových profilů pro pracovní den a víkend. Počet aut a chodců v okolí hráče závisí také
  na zvolené grafické kvalitě. U zastávek přibývají lidé podle blížících se odjezdů. Auta při zaplněném výjezdu čekají před
  křižovatkou i na zelenou.
- **Zakázky.** Rozvážej jídlo nebo voz zákazníky po skutečných adresách. Rozvoz k Boleváku můžeš
  splnit autem přes Lochotín a Bolevec nebo tramvají a autobusem s pěším předáním u rybníka.
- **Vlastní vůz.** V garáži u hlavního nádraží koupíš malé auto za 1 350 Kč. Ukládá se jeho stav
  i namontované úpravy. Ke koupi a servisu otevři v menu položku **Garáž**.
- **Směny MHD.** V nabídce vyber směr tramvaje 1, trolejbusu 16 nebo autobusu 30. Na přidělené
  trase řídíš plyn, brzdy a dveře. Odměnu určí obsluha zastávek, rozpis, pravidla a plynulost.
- **Policie**: za krádež auta nebo nebezpečnou jízdu po tobě jde, dá se ujet nebo skončit s pokutou.
- **Vrtulníky**: stojí na heliportech (FN Lochotín, pivovar, Bory) a na náměstí Republiky,
  přistávat jde i na střechách. Po nastoupení se roztočí rotor. Pro vzlet podrž mezerník nebo dotykové tlačítko ▲.
- **Měřené centrum.** Čtyři mapové listy městského 3D modelu dodávají zaměřené střechy a římsy.
  Materiály plzeňských domů vycházejí z typu budovy a městského obvodu. U vodního hamru v Dobřívě
  uvidíš šindelovou střechu, dřevěné vantroky a čtyři otáčející se vodní kola.
- **53 míst k objevení** včetně vodního hamru v Dobřívě. Na velké mapě vyhledáš obce a památky
  i bez diakritiky. Modré tečky vedou poslední úsek k hamru pěšky, červené příčky označují
  uzavírky na okraji mapy. Hra střídá den a noc, ukazuje den v týdnu a ukládá datum i postup.
  Hodiny u minimapy lze skrýt v nastavení.

Vydání 0.2.0 (23. 11. 2026, revize `99b1463`) obsahuje společnou fyziku vozidel v Joltu, kontrolu stažených mapových podkladů, chodníky, zaoblené rohy a sklon silnic, klidnější a ostřejší obraz, celou obrazovku a možnost obnovit předchozí vydání se stejným uloženým postupem. [Ověření vydání a postup návratu](docs/E26.md#vydání-020)

## Ovládání

| Klávesa | Co dělá |
| --- | --- |
| W A S D / šipky | chůze, řízení |
| Myš | tažením otáčíš kameru. Pěšky se můžeš podívat i přímo nad hlavu. V nastavení můžeš zapnout volné rozhlížení při chůzi. Kliknutím do hry zachytíš kurzor, Esc ho uvolní. |
| Shift | běh (ve vrtulníku klesání) |
| Mezerník | ruční brzda, skok, ve vrtulníku stoupání |
| F nebo E | nastoupit / vystoupit, ve směně MHD dveře |
| L | přepnout v autě dálková světla |
| O | fotorežim, uložit snímek lze i přes menu na telefonu |
| J | vzít rychlý rozvoz jídla nebo zrušit rozpracovanou zakázku |
| M | [mapa okolí hráče](docs/E27.md) (posun tažením, přiblížení kolečkem nebo dvěma prsty, výběr cíle přes **Navigovat sem**) |
| C · H · L · R | kamera · klakson · dálková světla · vrátit na silnici |
| O | otevřít nebo zavřít fotorežim |
| F8 · F9 | v režimu `?debug` zobrazit kolize nebo otevřít měření výkonu |
| N · Esc | posunout čas o 3 hodiny · menu se zakázkami, garáží a směnami MHD |
| ⛶ · F11 | celá obrazovka; po kliknutí na **Hrát** se zapne sama (vypíná se v **Nastavení**), Esc ji ukončí |

Na telefonu určuje rychlost chůze vychýlení páčky. V poslední třetině její dráhy přejde postava plynule do běhu. [Ovládání pěšky a ukázka zatáčky](docs/E38.md)

Na dotykové obrazovce se objeví páčka a tlačítka. Telefon automaticky použije nižší grafickou
kvalitu. Na počítači ji lze zapnout parametrem `?quality=low`. Ve vyšší kvalitě zobrazí `?wet=1`
tlumené odlesky na mokré dlažbě v obou ukázkových lokalitách.

Od vzhledové zkoušky z listopadu 2026 má den silnější slunce, čitelné stíny a sytější omítky
a fasády už neodrážejí oblohu jako mléčný závoj. Původní světlo pro porovnání zapne parametr
`?vzhled=puvodni`. [Protokol vzhledové zkoušky](docs/vzhledova-zkouska.md)

Silnice mají od listopadu 2026 hladký podélný profil. Dřív kopírovaly trojúhelníky terénu,
takže auto v kopcích drncalo a terén místy prorůstal asfaltem. Terén pod vozovkou se profilu
přizpůsobí, okolí mostů a ručně upravená místa zůstávají beze změny. Původní silnice pro
porovnání zapne parametr `?silnice=puvodni`. [Rozbor, měření a snímky](docs/silnice.md)

Městské ulice mají od střední předvolby chodník s obrubníkem 10 cm nad asfaltem. Auto o obrubník
drcne a chodci chodí po chodníku. Na nízké předvolbě zůstává chodník v textuře země, parametr
`?chodniky=0` ho vypne i jinde. [Popis a snímky](docs/chodniky.md)

Rohy křižovatek a ostré ohyby silnic jsou zaoblené obloukem o poloměru 4–12 m podle šířky ulic,
obrubník i chodník ho obcházejí. Líc obrubníku je zkosený, takže při seříznutí zatáčky auto
přes obrubník přejede. Auta řízená hrou v rozích odbočují vpravo plynulejším obloukem podél
obrubníku. Ostré rohy pro porovnání vrátí `?rohy=0`. [Popis a snímky](docs/rohy.md)

Silnice jsou napříč skloněné podle svahu (nejvýš 4 %) a zatáčky mimo zástavbu jsou klopené
(nejvýš 6 %), aby v nich auto lépe drželo. Navazující silnice mají stejný sklon, takže
v křižovatkách méně drncá. Vodorovné silnice pro porovnání vrátí `?sklon=0`.
[Popis, měření a snímky](docs/sklon.md)

Silnice na hraně břehu (Anglické a Denisovo nábřeží, Mlýnské nábřeží, Karlovarská nad zatopeným
lomem a několik cest u vody) leží na ulici nad nábřežní zdí. Výškový model po 8 m tam zeď
rozmazal do svahu přes celou vozovku, takže Anglické nábřeží dřív leželo v jámě až 6 m pod
ulicí. Původní profil pro porovnání vrátí `?nabrezi=0`. [Rozbor a měření](docs/nabrezi.md)

Obraz za jízdy je klidnější a ostřejší. Jemné zrno asfaltu, omítek a dlažby se v dálce plynule
vytratí dřív, než by začalo blikat, a spáry cihel se nahradí jejich průměrnou tmavostí. Textury
země se v dálce filtrují ostřeji, nízká předvolba kreslí na počítači v plném rozlišení a vysoká
předvolba obraz po časovém vyhlazení mírně doostří. Tramvajový pás leží pod asfaltem ulice
a terén u okraje silnice už tak často nevystupuje nad asfalt. Původní obraz pro porovnání vrátí
`?obraz=puvodni`, samotné doostření vypne `?ostreni=0`. [Rozbor, měření a snímky](docs/obraz.md)

Hráč i chodci mají stylizovanou postavu místo kvádrů: zaoblené tělo se svažujícími se rameny,
obličej, čtyři druhy účesů, dlaně s prsty a boty, víc odstínů pleti a vlasů. Jemné zastínění
v barvách postavy (podpaží, krk, vnitřní strana paží a stehen) vypne `?zastineni=0`. Postava se pohybuje přirozeněji: délka kroku odpovídá
rychlosti, při běhu se předkloní a pumpuje rukama, vestoje dýchá a rozhlíží se, ve skoku pokrčí
nohy, při pádu roztáhne ruce, po dopadu se přikrčí a ve vodě plave tempa. Pohyby se drží mezí
kloubů fyzikální postavy, takže pády a srážky fungují jako dřív. Původní postavu pro porovnání
vrátí `?postava=puvodni`. [Popis a snímky](docs/postava.md)

Hra ve výchozím nastavení používá aktuální čas v Plzni. V **Nastavení → Herní čas**
můžeš zadat konkrétní hodinu a minutu. Herní čas pak plyne stejným tempem jako skutečný
čas a při pauze stojí. **Použít aktuální čas v Plzni** obnoví živé hodiny. Po změně
času se podle něj připraví spoje MHD a odjezdy ze zastávek. Při návratu z pauzy živé
hodiny znovu ukážou čas v Plzni. Starší uložené hry použijí toto výchozí nastavení.
Nástup do směny přestaví čas na její odjezd. Změna času uprostřed směny ji po potvrzení
přeruší.

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

**Na telefonu** připoj telefon i počítač ke stejné domácí Wi-Fi. Na počítači spusť hru
příkazem `npm run dev` podle postupu výše a nech terminál otevřený. Do prohlížeče
v telefonu opiš celou adresu z řádku **Network**, včetně čísla portu. Otoč telefon
na šířku a klepni na **Hrát**. Objeví se dotyková páčka a tlačítko mapy.
Spouštěč `Spustit hru.command` na Macu používá adresu dostupnou jen z toho Macu.

Verzi pro nasazení na web vytvoří:

```bash
npm run build
```

Výsledek je ve složce `dist/` – obyčejné statické soubory, které jde nahrát na jakýkoli hosting.

## Kontroly před odesláním změn

[Plán oprav po auditu](docs/plan-oprav-po-auditu.md) · [Stav jednotlivých etap](docs/codex/stav.md)

[Audit hry z 25. listopadu 2026](docs/audit-hry-2026-11-25.md) uvádí ověřené chyby, nedodělky a měření výkonu.
[Plán oprav po auditu](docs/plan-oprav-po-auditu.md) řadí opravy do šesti etap a popisuje, jak je převzít ve hře.

Výchozí pohledy, měření práce snímku a rozpočet vykreslování jsou v
[protokolu E13](docs/E13.md). Panel výkonu v režimu `?debug&adapt=0` otevřeš klávesou
F9 nebo tlačítkem **Měření**. [Návod pro počítač a telefon](docs/E13/mereni-na-zarizeni.md).

[E14 aktualizuje three.js na 0.187.0](docs/E14.md), zachovává stávající vykreslování
a doplňuje hlídání vlastních materiálů. [Osm porovnání před a po](docs/E14/snimky.md)
ukazuje jen drobné rozdíly ve stínech. Rozpočet nově započítává i stínový průchod,
limit +10 % zůstává. Autor v obou ručních měřeních dosáhl přibližně 60 FPS bez
pozorovaného zadrhávání; vyšší některé časy a mírné překročení meze GPU jsou
popsané v [měření E14](docs/E14/mereni.md).

[E15 převádí hru na WebGPU](docs/E15.md). Když prohlížeč WebGPU nepodporuje,
hra automaticky použije WebGL 2. Otevřením adresy s `?renderer=webgl` můžeš
WebGL 2 vynutit. Použitou cestu uvidíš v **O hře** i v panelu **Měření**.
[Porovnání osmi pohledů na obou cestách](docs/E15/snimky.md).

[E16 přidává letecké snímky otevřené krajiny](docs/E16.md). Snímky ČÚZK z roku 2025
se načítají po malých blocích podle polohy a jsou sladěné s malovaným vzhledem hry.
V nastavení je vypneš volbou **Letecké snímky krajiny** nebo adresou s `?orthophoto=0`.
[Srovnání pole u Rokycan a údolí Klabavy](docs/E16/overeni-pilotu.md).

[E17 mění světlo a obraz](docs/E17.md). Slunce a obloha sledují datum a čas v Plzni,
sklo a lak aut odrážejí okolí, v noci září lampy a okna a ráno nad řekami leží opar.
Po vjezdu do Valíku se na střední a vyšší kvalitě obraz postupně přizpůsobí tmě.
V menu **Nastavení → Kvalita grafiky** můžeš vybrat jednu ze čtyř předvoleb. Výchozí
volba **Automaticky** přizpůsobí kvalitu zařízení podle prvních deseti sekund hraní.

[E18 přidává odpružení, pneumatiky a automatickou převodovku auta](docs/E18.md).
V **Nastavení → Řízení** si zvolíš arkádový nebo realistický režim. V arkádovém autě se rychleji rozjedeš,
snáz zatočíš v městské rychlosti a po puštění plynu auto postupně zpomalí. Klávesa **R**
vrátí auto na nejbližší silnici. Pokud hru uložíš za volantem, při návratu
najdeš stojící auto na uloženém místě. V režimu `?debug` zobrazí **F8** povrchy pro
fyziku a **F9** měření včetně otáček a prokluzu jednotlivých kol.

[E19 přidává fyzikální chůzi a pády postav](docs/E19.md). Pěšky vyjdeš schod,
přejdeš most po chodníku nebo vystoupíš z vrtulníku na střeše. Na Švédském
i Wilsonově mostě tě zastaví kamenná zídka. Při sražení autem postava padne
ve směru nárazu a zase vstane. Volba **Nastavení → Fyzikální pády postav**
se zachová i při dalším spuštění hry.

V E20 můžeš autem odstrčit zaparkovaný vůz nebo pocítit náraz tramvaje. Vrtulník při dlouhém přímém letu dosáhne přibližně 300 km/h. Když sjedeš autem do Radbuzy u Wilsonova mostu, vůz chvíli plave, nabere vodu a dosedne na mělčinu. Můžeš vystoupit a doplavat ke břehu. [Protokol E20, snímky a zkoušky ve hře](docs/E20.md).

Při zkoušce ranní špičky lze sledovat, které auto nebo linka MHD zadržuje další účastníky. [Výsledky pokusu s rozjezdem a postup pro sledování kolon](docs/E20/rozjezd-a-kolony.md).

Na vývojové větvi E21 reagují na náraz také lampy, dopravní značky, semafory a zábradlí. Auto se promáčkne v místě nárazu a může ztratit díl. Garáž si pamatuje poškození vlastního vozu a umí ho opravit. [Protokol E21 a snímky](docs/E21.md).

Na větvi E22 mají Wilsonův most a vybrané lávky a železniční mosty půdorys podle městského měření. Na nábřeží a ve svazích přibyly zdi, pilíře a protihlukové stěny. U vody se vykreslují čtyři části jezů. Měřenou vrstvu lze vypnout parametrem `?structures=0`. [Srovnávací snímky, inventura a ověření E22](docs/E22.md).

Regresní testy kolizí, terénu, silničního grafu a distribuovaných dat:

```bash
npm test
```

Testy přípravy dat (po instalaci Python závislostí uvedených níže):

```bash
npm run test:python
```

Testy hry v Chromiu ověřují chůzi, mapu a navigaci, auto, vrtulník, rozvoz oběma způsoby,
taxi, nákup, opravu a uložení vlastního auta, přestup z tramvaje na autobus, trolejbus,
noční spoj s výstupem na kraji mapy, směny na všech třech typech vozidel, uložení postupu
a mobilní dotykové ovládání. Používají debug režim pro
řízený čas a přesun k interakcím; mobil je emulovaný, nejde o měření výkonu telefonu.

```bash
npx playwright install chromium
npm run build
npm run test:e2e -- --trace off
```

Testy si samy spustí lokální server nad `dist/`. Projekt `webgl2` spouští úplnou sadu.
Projekt `webgpu` ověřuje start, rozpočet, noc, Wilsonův most, Valík a referenční pohledy.

Kontroly projektu spouštíme místně před nahráním změn na GitHub. Pro ověření
kompatibility spusť na Node.js 20.19, 22.12 a 24 příkazy `npm ci`, `npm test`,
`npm run test:python`, `python3 -m py_compile tools/*.py`,
`npm audit --audit-level=moderate` a `npm run build`. Testy JavaScriptu zahrnují
i odkazy v dokumentaci. Prohlížečové testy spusť na Node.js 24 podle postupu výše.
Snímky při selhání najdeš
v místní složce `test-results/`.

## Odkud jsou data a jak je obnovit

Hotová herní data jsou v repozitáři ve složce `public/data/` (asi 29 MB včetně jízdního řádu PMDP).
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
| `fetch_orthophoto.py` | vybere mapové listy ČÚZK a při převodu eviduje jejich stažení a kontrolní součty |
| `build_orthophoto.py` | převede letecké snímky otevřené krajiny do herních bloků ve 2 m na pixel |
| `extract_osm.py` | vybere z výřezu jen oblast hry |
| `fetch_traffic.py` | stáhne otevřený pasport svislého a vodorovného značení města Plzně |
| `build_data.py` | spočítá výšky budov a vyrobí kompaktní soubory pro hru |
| `build_transit_network.py` | sestaví kompletní síť z GTFS PMDP a směrového grafu OSM a vykáže pokrytí |
| `build_timetable.py` | obnoví historický pilot E06 do surových dat a drží společný převod kalendáře |
| `build_traffic_profiles.py` | sestaví pracovní a víkendové hodinové profily z historických měření plzeňských smyček |
| `build_landscape.py` | porovná základní terén s výškopisem a sbalí vybrané dlaždice s hustší sítí |
| `build_heritage.py` | převede městské plochy SHP do herních souřadnic |
| `build_city.mjs` | sestaví měřené budovy do dlaždic a spáruje je s půdorysy OSM |
| `archive_release.py` | zabalí ověřené statické vydání a jeho zdrojový strom s kontrolními součty |
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
[Protokol E08](docs/E08.md) popisuje pokrytí celé sítě PMDP, výpočet tras, přestupy, okraj mapy a obnovu dat.
[Protokol E09](docs/E09.md) popisuje zdroje zvuku v herním světě a obnovu českých hlášení.
[Protokol E10](docs/E10.md) popisuje taxi, garáž, výplaty a trasu rozvozu k Boleváku.
[Protokol E11](docs/E11.md) popisuje směny řidiče, jízdní rozpis a podmínky výplaty.
[Protokol E12](docs/E12.md) uvádí obnovu vydání, závěrečné zkoušky, měření výkonu a známé odchylky.
[Protokol E07](docs/E07.md) uvádí měřené směry, postup sestavení a porovnání provozu ve hře.
[Protokol krajiny](docs/krajina.md) popisuje výběr jemnějšího terénu a kontrolu celé oblasti.
[Aktualizace z 17. listopadu 2026](docs/aktualizace-2026-11-17/README.md) obsahuje rešerši modelů staveb a kontrolní snímky MHD a silnic.
[Navazující implementační plán](docs/plan-presnost-a-vzhled.md) rozepisuje etapy E13–E26: vykreslování WebGPU, fyziku Jolt, ničitelné vybavení ulic, ortofoto, měřené stavby a mosty, nová grafika a tři podrobné úseky ulic.
[Zadání pro Codex](docs/codex/README.md) obsahuje úplné zadání každé etapy, šablony zpráv a doporučené modely. Stálá pravidla pro AI agenty jsou v [AGENTS.md](AGENTS.md).
[Katalog vylepšení fyziky a grafiky](docs/fyzika-a-grafika.md) popisuje jednotlivá vylepšení a měření fyzikálních knihoven.
[Revize první verze plánu](docs/revize-planu-presnost-a-vzhled.md) ověřuje výchozí údaje nad zdrojovými daty; její návrhy jsou zapracované do plánu.

Datum OSM se čte z položky `osmosis_replication_timestamp` přímo v hlavičce staženého PBF,
ukládá se do `extract.pkl` a odtud do `meta.json` jako `osmTimestamp` (UTC) se zdrojem
`osmTimestampSource: "pbf-header"`. Datum sestavení ani nově stažený stavový soubor ho
nenahrazují. PBF bez data nebo starší výřez bez této položky se odmítne; výřez je třeba
znovu vytvořit příkazem `python3 tools/extract_osm.py`.

U přiložené historické datové sady není původní datum doloženo. Proto má
`osmTimestamp: null` a `osmTimestampSource: "unknown-legacy"`; menu „O hře“ tuto skutečnost
zobrazuje. Nové sestavení dat již musí obsahovat ověřené datum.

## Zdroje a licence dat

Zelenobílý městský trolejbus je vlastní model projektu Plzeň naplno. [Snímky z ulice a shora](docs/E39.md)

- Pěší trasa od muzea ke Strouze a poloha zastávkových zálivů vycházejí z místního výřezu dat přispěvatelů OpenStreetMap (ODbL). Stanoviště, spoje a směry využívají již distribuovaný jízdní řád PMDP.

- Fyziku počítá [Jolt Physics 1.1.1](https://github.com/jrouwe/JoltPhysics.js) od Jorrita Rouweho ([licence MIT](https://github.com/jrouwe/JoltPhysics.js/blob/main/LICENSE)).
- Sedan, kombi, SUV, dodávka, sportovní kupé, pick-up a výbava taxislužby a policie jsou vlastní modely projektu. [Přehled aut ve hře](docs/E29.md)
- Karoserie herní Fabie II, disky a animace kol jsou vlastní tvorbou projektu Plzeň naplno. Tvarovou předlohou byl pětidveřový hatchback z roku 2007. [Příď a dveře před úpravou a po ní](docs/fabia/prid-a-dvere.md) · [Celý model ve hře](docs/E28.md) · [Fotografické srovnání generací výrobce](https://cdn.skoda-storyboard.com/2021/02/SKODA_FABIA_History.pdf)
- Tvar říčního dna je vlastní herní odhad podle vzdálenosti od břehu. Pro kontrolu výšky u Wilsonova mostu sloužil profil R19. [Povodňový model města Plzně](https://gis.plzen.eu/foto/pov_model/profily/PM_Psany_PP.pdf).

- Grafiku vykresluje [three.js 0.187.0](https://github.com/mrdoob/three.js/tree/r187),
  autoři three.js, [licence MIT](https://github.com/mrdoob/three.js/blob/r187/LICENSE).
- Barevné tabulky pro den, soumrak a noc jsou vlastní podklad hry. Generuje je
  [skript `build_luts.mjs`](tools/build_luts.mjs).
- Sestavení používá [picomatch](https://github.com/micromatch/picomatch), autor Jon
  Schlinkert, licence MIT. [Místní oprava 4.0.8-plzen.1](vendor/picomatch/README.md)
  vychází z verze 4.0.7 a odstraňuje zaseknutí při opakovaných vzorech hledání souborů.

- Mapová data © [přispěvatelé OpenStreetMap](https://www.openstreetmap.org/copyright), licence ODbL.
- Terén vychází z digitálního modelu reliéfu DMR 5G a výšky budov z rozdílu digitálního modelu
  povrchu DMP 1G a DMR 5G © [ČÚZK](https://www.cuzk.cz). Terén je pro hru zjednodušený na síť
  po 8 metrech, na vybraných dlaždicích po 4 metrech. Pod silnicemi je zarovnaný.
- Letecké snímky otevřené krajiny vycházejí z [Ortofota ČR © ČÚZK](https://atom.cuzk.gov.cz/ORTOFOTO/ORTOFOTO.xml),
  [licence CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Snímkování z roku 2025
  je převzorkované do herní mapy, oříznuté na otevřenou krajinu a barevně sjednocené.
- Poloha vybraných dopravních značek, čar a přechodů vychází v Plzni také z otevřeného
  pasportu města. [Svislé značení](https://opendata.plzen.eu/public/opendata/detail/6) ·
  [Vodorovné značení](https://opendata.plzen.eu/public/opendata/detail/92)
- Denní rytmus aut na měřených úsecích vychází z odvozených hodinových profilů města Plzně.
  Pro další ulice a pro chodce hra používá odhad. [Dopravní detektory](https://opendata.plzen.eu/public/opendata/detail/160) ·
  [Hodinové profily PoliVisu](https://polivisuapi.plzen.eu/api/)

- Morový sloup před Císařským domem má vlastní model podle fotografie od autora hry. Půdorys a natočení pocházejí z OpenStreetMap (ODbL), zpracování kamene, zlacení a soch je vlastní tvorba projektu. [Sloup ve hře a zdroje](docs/E25/morovy-sloup.md)
- Katedrála sv. Bartoloměje stojí na měřeném modelu centra Plzně. Kresba pískovce, břidlice, měděné krytiny, oken a portálů, ciferníky a doplněné střešní detaily jsou vlastní tvorba projektu podle fotografií dodaných autorem hry. [Katedrála před úpravou a po ní](docs/E25/katedrala.md)
- Šafaříkovy a Křižíkovy sady a břehy Mlýnské strouhy navazují na park u muzea. Modely mobiliáře, soch, lávky a rostlin jsou vlastní. Geometrie parků, cest a mokřadů pochází z OpenStreetMap (ODbL), ortofoto ČÚZK (CC BY 4.0) sloužilo k porovnání. [Galerie a podklady](docs/E25/strouha.md)
- Smetanovy a Kopeckého sady od Velkého divadla k Západočeskému muzeu mají pět vlastních modelů vodních prvků, tři pomníky, zelené loubí, záhony a lavičky. Polohy vycházejí z OpenStreetMap (ODbL), zeleň z ortofota ČÚZK (CC BY 4.0). Výtvarnými předlohami byly katalog Sochy a města, městská encyklopedie, galerie v Chebu a dokumentace města Plzně. [Zdroje a osm pohledů před úpravou a po ní](docs/E25/smetanovy-sady.md)
- Historické budovy věznice Bory mají vlastní kresbu fasád, kupoli, lucernu a střechy křídel. Půdorysy vycházejí z herních dat OpenStreetMap (ODbL). Fotografie autora Aisano (CC BY-SA 3.0) a dvě letecké předlohy od autora hry sloužily k výtvarnému porovnání. [Snímky z ulice i vrtulníku a zdroje](docs/E25/bory.md)
- Na východní, jižní a západní straně náměstí Republiky má dalších 33 domů vlastní kresbu průčelí podle městského zaměření, adresního přehledu města a fotografií na Wikimedia Commons. Fotografické předlohy pořídili Honza Groh (CC BY-SA 3.0) a Txllxt TxllxT (CC BY-SA 4.0). [Porovnání a fotografické předlohy](docs/E25/stity-namesti.md)
- Šest jižních průčelí na severní straně náměstí Republiky stojí na zaměřených domech města Plzně. Herní kresba, římsy a vikýře jsou vlastní tvorba projektu. Fotografické předlohy poskytli autoři na Wikimedia Commons. [Autoři, licence, adresy a porovnání ve hře](docs/E25/severni-stity.md)
- Kašny Anděl, Chrtice a Velbloud na náměstí Republiky navrhl Ondřej Císler. Herní geometrie i voda jsou vlastní tvorba projektu podle autorových fotografických předloh. Polohy mís vycházejí z OpenStreetMap (ODbL), natočení z ortofota ČÚZK (CC BY 4.0) a výšky z popisu architektů. [Návrh kašen](https://aoc.archi/cs/projekt/20/tri-kasny-pro-namesti-republiky-v-plzni/description) · [Srovnání všech tří míst ve hře](docs/E25/kasny.md)
- Lochotínský pavilonek má půdorys podle [OpenStreetMap](https://www.openstreetmap.org/way/109759707) (ODbL). Model, kresba okenic, střechy a ohrazení terasy jsou vlastní tvorba projektu podle fotografií dodaných autorem hry. [Snímky před úpravou a po ní](docs/E25/lochotinsky-pavilonek.md)
- Kresba fasády Západočeského muzea, portál a otevřené střešní věžičky jsou vlastní tvorba projektu podle čtyř fotografií dodaných autorem hry. Půdorys a střechy vycházejí z městského 3D modelu. [Muzeum před úpravou a po ní](docs/E25/zapadoceske-muzeum.md)
- Průčelí plzeňské radnice, kresba sgrafit, ciferník, stupňovité štíty a měděná věžička jsou vlastní tvorba projektu podle fotografií dodaných autorem hry. Umístění, šířka průčelí a hřeben střechy vycházejí z městského 3D modelu. [Radnice před úpravou a po ní](docs/E25/radnice.md)
- Perforovaná stěna Nového divadla, kresba jeho fasád, prosklené chodby a betonová koule jsou vlastní tvorba projektu. Výšky a obrysy budov vycházejí z městského měření a půdorysy spojovacích chodeb z OpenStreetMap (ODbL). [Snímky Nového divadla ve hře](docs/E25/nove-divadlo.md)
- Fasády Velkého divadla, balustráda, střešní ozdoby a členění měděné střechy jsou vlastní tvorba projektu. Tvar budovy vychází z městského měření a část parkové terasy z půdorysu OpenStreetMap (ODbL). [Srovnání ze dvou stran](docs/E25/velke-divadlo.md)
- Fasády Velké synagogy a obou sousedních domů v sadech Pětatřicátníků, kupole, římsy a hvězdy jsou vlastní tvorba projektu Plzeň naplno. Poloha budov vychází z měřeného modelu města. [Snímky ulice před a po úpravě](docs/E25/synagoga.md)
- Kresba průčelí hlavního nádraží, římsy, tabule, špice a materiál měděných kupolí jsou vlastní tvorba projektu Plzeň naplno. Podkladem tvaru je měřený model města uvedený níže.
- Fotografické materiály fasád poskytla knihovna Poly Haven (CC0). Normály, drsnost a barva stěn se balí do atlasů spolu s pěti vlastními vzory střech. Projekt vytvořil také osm variant interiérů za okny. [Sedm materiálů a otisky](tools/facade-textures.json) · [Licence Poly Haven](https://polyhaven.com/license)
- Čtyři modely stromů a atlas jejich sezónních pohledů vznikají přímo z geometrie projektu. Druh olistění vychází ze značek OpenStreetMap pod licencí ODbL. [Převod značek](tools/build_tree_types.py) · [Vykreslení atlasu](tools/build_impostors.mjs)
- Detail trávy, hlíny, štěrku, brázd, písku a lesního listí používá fotografie a normálové mapy z knihovny Poly Haven pod licencí CC0. [Šest použitých materiálů a jejich otisky](tools/terrain-textures.json) · [Licence Poly Haven](https://polyhaven.com/license)
- Měřené budovy centra, stavební objekty včetně mostů a jezů a profil lávky U Prazdroje vycházejí z dat města Plzně z roku 2024 od GEOREAL – Vybíral. Plochy jsou
  převedené do herních souřadnic a doplněné vlastními materiály. Hranice městských částí určují
  místní palety. [3D budovy centra Plzně](https://opendata.plzen.eu/public/opendata/detail/37) ·
  [Městské části](https://opendata.plzen.eu/public/opendata/detail/108)
  Město u sady 3D uvádí, že neobsahuje autorská díla a databáze nepodléhá autorskoprávní ochraně ani zvláštnímu právu pořizovatele. [Podmínky užití v katalogu města](https://opendata.plzen.eu/public/opendata/dataset/37)
- Obrysy tramvajových ostrůvků a osy nástupišť v Šumavské vycházejí z OpenStreetMap (ODbL). Dlažba před hlavní budovou používá profil z DMR 5G ČÚZK a rozměry podle OpenStreetMap. Oboustranné označníky, opěrné zdi a kovové sloupky jsou vlastní modely projektu. [Podklady a srovnání ve hře](docs/E25/nadrazi.md)
- Každé z 705 stanovišť jízdního řádu má oboustranný označník s názvem, číslem a linkami.
  U označníku se pěšímu hráči zobrazí odjezdy z daného stanoviště. Polohy, přístřešky
  a lavičky využívají místní výřez OpenStreetMap (© přispěvatelé, ODbL), čísla a linky
  přibalený jízdní řád PMDP. Modely a kresba tabulí jsou vlastní. [Ukázka v Koterově](docs/E40/koterov.jpg)
- Odjezdy tramvají, trolejbusů a autobusů vycházejí z GTFS Plzeňských městských dopravních podniků, a.s.
  Hra přiřazuje zastávky ke kolejím a silnicím OpenStreetMap a ořezává spoje na okraji herního území.
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

- [Three.js 0.187.0](https://threejs.org) pro 3D grafiku (licence MIT), [Vite](https://vitejs.dev) pro sestavení.
- `src/world/` – svět: načtení dat, terén a mosty, kolize, silniční síť, stavba 3D geometrie po dlaždicích.
- `src/entities/` – auta, chodci, tramvaje, vrtulník a jejich modely.
- `src/game/` – pravidla hry, kamera, ovládání, mapa, zakázky, zvuky.
