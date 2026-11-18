# Stav etapy E17

Větev `etapa/E17` vychází z revize `9661ee7` na `main`. E16 je sloučená.
Autor potvrdil zahájení E17. [Zadání E17](E17.md) · [Protokol E16](../E16.md)

| Krok | Stav |
| --- | --- |
| 1. Fyzikálně založené materiály | Hotovo · `0e84e90` |
| 2. Obloha, poloha slunce a světlo z oblohy | Hotovo · `9c27cd9` |
| 3. Kaskádové stíny | Hotovo · `bf5ba60` |
| 4. Průchod scény, vyhlazování, AO, záře, tónování, barevné ladění a mlha | Hotovo |
| 5. Čtyři předvolby, automatika a dynamické rozlišení | Hotovo · `56108ea` |
| 6. Přizpůsobení jasu | Hotovo · `e285dca` |
| 7. Měření všech předvoleb, snímky, protokol a příprava na sloučení | Hotovo · `a084d47` · [Protokol E17](../E17.md) |

## Ověření a otevřené otázky

- Výchozí sestavení a osm referenčních pohledů prošly na Apple M4 v Chromiu
  159.0.8154.6 s WebGPU přes Metal. První měření nízké předvolby je v
  `data-raw/e17/mereni-pred-low.json`. Pro porovnání na konci etapy se stejná
  revize přeměřila s časovými značkami okolo celého snímku a s běžnou
  obnovovací frekvencí prohlížeče.
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
  Commit `1f477bc`.
- Výšková mlha čte hloubku a používá stávající vodní plochy pro ranní opar.
  Prošlo sestavení, 49 testů Node a čtyři kontroly vysoké a nízké předvolby
  na obou vykreslovačích. Commit `9840b0b`. [Porovnání obrazových efektů](../E17/efekty.md).
- Předvolba se mění ve stejné instanci hry. Hráč, čas, peníze a rozpracované
  úkoly zůstávají. Automatika používá práci prvních deseti sekund hraní
  a ukládá předvolbu. Rozlišení má rozsah 60–100 %. Prošlo 52 testů Node,
  sestavení, tři kontroly nastavení a uložení a dvě kontroly panelu měření.
  Přepnutí vysoké předvolby na nízkou v záběru s dosahem 620 m trvalo na
  Apple M4 1,2 s na WebGPU a 1,5 s na WebGL 2. Test na softwarovém ovladači
  čeká na dokončení až 30 s, protože příprava obrazu tam trvala více než 5 s.
- Adaptace jasu u Valíku prošla na WebGL 2 i WebGPU spolu s 54 testy Node
  a sestavením. V záběru uvnitř byl naměřen zobrazovací jas 0,049 před
  tónováním a za 2,5 s vzrostla expozice z 1,00 na 1,62. Test ověřil
  postupné zesvětlení i ztlumení po výjezdu. [Snímky](../E17/efekty.md).
- Závěrečné měření používá jedinou dvojici značek WebGPU okolo celého snímku.
  Výchozí E16 je znovu naměřená stejným postupem. Všechny čtyři předvolby
  držely na Apple M4 při jízdě i letu v centru 60 FPS. Po omezení vnitřního
  rozlišení nízké předvolby na 75 % stoupl čas GPU při jízdě proti E16 o 2,0 %
  a při letu klesl o 8,7 %. Vysoká a ultra předvolba při letu překročily
  pracovní rozpočet GPU 12 ms. Skutečný telefon čeká na kontrolu autora.
- Závěrečný běh našel v testu památek chybu staršího volání, které mění jen
  hodinu. Oprava ponechává nastavené datum. Původní test zůstává a test oblohy
  navíc ověřuje setrvání data po změně samotné hodiny. Po opravě prošly čtyři
  cílené kontroly památek a oblohy a všech 24 opakovaných scénářů první části
  úplné sady na opraveném sestavení. Prošly rozpočty všech čtyř předvoleb
  na obou vykreslovačích a cílená kontrola měření času GPU.
- Samostatná diagnostika Valíku na softwarovém WebGPU naměřila první odečet
  jasu asi po 11 s včetně čekání na dříve zadané snímky. Test čeká na dokončení
  přípravy pohledu před zahájením každého odečtu. Desetisekundová mez odečtu
  a všechna očekávání na přizpůsobení jasu zůstávají stejná. Závěrečné
  zopakování Valíku prošlo na obou vykreslovačích.
- Na konečném sestavení prošlo ve více bězích všech 93 prohlížečových
  scénářů (67 WebGL 2, 26 WebGPU). Prošlo i 55 testů Node, 23 testů Pythonu
  a produkční sestavení. [Snímky a měření](../E17.md)
