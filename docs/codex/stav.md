# Stav etapy E17

Větev `etapa/E17` vychází z revize `9661ee7` na `main`. E16 je sloučená.
Autor potvrdil zahájení E17. [Zadání E17](E17.md) · [Protokol E16](../E16.md)

| Krok | Stav |
| --- | --- |
| 1. Fyzikálně založené materiály | Hotovo · `0e84e90` |
| 2. Obloha, poloha slunce a světlo z oblohy | Hotovo · `9c27cd9` |
| 3. Kaskádové stíny | Hotovo · `bf5ba60` |
| 4. Průchod scény, vyhlazování, AO, záře, tónování, barevné ladění a mlha | Hotovo až po barevné ladění, další je mlha |
| 5. Čtyři předvolby, automatika a dynamické rozlišení | Čeká |
| 6. Přizpůsobení jasu | Čeká |
| 7. Měření všech předvoleb, snímky, protokol a pull request | Čeká |

## Ověření a otevřené otázky

- Výchozí sestavení a osm referenčních pohledů prošly na Apple M4 v Chromiu
  159.0.8154.6 s WebGPU přes Metal. Výchozí měření nízké předvolby je v
  `data-raw/e17/mereni-pred-low.json`. Jízda v centru měla CPU p95 1,10 ms
  a GPU p95 2,03 ms při 1920 × 1080.
- Krok 1 zachovává barvy ve vrcholech a sdílí materiály mezi objekty.
  Počty volání a trojúhelníků se v osmi pohledech nezměnily.
  [Srovnávací snímky a odečty](../E17/materialy.md). Prošlo 43 testů Node
  a 23 testů Pythonu i produkční sestavení. Prošla úplná sada 63 prohlížečových
  scénářů na WebGL 2 a WebGPU, včetně kontrol materiálů, dlaždic památek,
  mobilního ovládání a Valíku.
- Pro kontrolu soumraku v 18:09 se použije 19. říjen 2026. V Plzni toho dne
  slunce zapadá v 18:08. Pro srovnání denních a nočních snímků zůstává datum
  E13, 17. listopad 2026. [Údaje U.S. Naval Observatory](https://aa.usno.navy.mil/api/rstt/oneday?date=2026-10-19&coords=49.7475%2C13.3776&tz=2).
- Krok 2 prošel 46 testy Node, 23 testy Pythonu a produkčním sestavením.
  První měření odhalilo víc práce pro stíny při nižším zimním slunci.
  Po zúžení dosavadní oblasti stínů prošel rozpočet E13 na WebGL 2 a WebGPU
  se stejnými očekáváními. Scénář s postupným výpočtem mapy světla a se
  soumrakem prošel na obou vykreslovačích. Celkem prošlo 16 cílených scénářů
  a čtyři opakované kontroly po doplnění počítadla pro všechny průchody.
  [Snímky a porovnání](../E17/obloha.md).
- Krok 3 prošel 46 testy Node, sestavením, osmi prohlížečovými scénáři
  s mapami stínů všech předvoleb a rozpočtem na obou vykreslovačích. Tři
  mapy ve vysoké předvolbě mají vlastní naměřený rozpočet se stejnou
  tolerancí jako E13. Při místním měření byla GPU p95 6,68 ms při jízdě
  a 7,80 ms při letu nad Plzní. [Měření a snímky](../E17/stiny.md).
- Astra zkontrolovala návrh obrazových efektů proti three.js 0.187. První
  část kroku 4 doplnila samostatný průchod obrazu a vyhlazování. Překrytí
  světel a pruhů ponechává podkladové normály a vektory pohybu. Prošlo 46
  testů Node, sestavení, deset prohlížečových kontrol předvoleb a rozpočtu
  a zkouška pohybu dveří tramvaje na WebGPU. Commit `da0c231`.
- Kontaktní zastínění běží v poloviční šířce a výšce. Prošly 46 testů Node,
  sestavení a čtyři prohlížečové kontroly vysoké a nízké předvolby na obou
  vykreslovačích. V Dobřívě je tmavší hlavně okolí stěn a dřevěných částí
  hamru. Commit `a4d6d77`. [Snímky](../E17/efekty.md).
- Záře světel běží na střední a vyšší předvolbě. Po vyladění prahu má denní
  náměstí stejný průměrný jas a noční okna osvětlují bezprostřední okolí.
  Prošlo sestavení, 46 testů Node a čtyři kontroly střední a nízké předvolby.
  Commit `4427c28`.
- Porovnání tónování ponechalo výchozí ACES kvůli barvě dlažby a kontrastu
  nočních oken. Oba způsoby se ověřily v osmi referenčních pohledech.
  Prošlo sestavení, 46 testů Node a čtyři cílené prohlížečové scénáře.
  Commit `da2f19c`.
- Tři vlastní barevné tabulky mají celkem 353 947 bajtů. Kandidát se shoduje
  s převzatými soubory. Prošlo 48 testů Node, 23 testů Pythonu, sestavení
  a čtyři kontroly načtení na vysoké a nízké předvolbě v obou vykreslovačích.
- Po dokončení čeká měření v autorově běžném prohlížeči a kontrola na telefonu.
