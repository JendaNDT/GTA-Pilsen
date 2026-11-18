# Stav etapy E17

Větev `etapa/E17` vychází z revize `9661ee7` na `main`. E16 je sloučená.
Autor potvrdil zahájení E17. [Zadání E17](E17.md) · [Protokol E16](../E16.md)

| Krok | Stav |
| --- | --- |
| 1. Fyzikálně založené materiály | Hotovo, běží ještě úplná regresní sada |
| 2. Obloha, poloha slunce a světlo z oblohy | Další krok |
| 3. Kaskádové stíny | Čeká |
| 4. Průchod scény, vyhlazování, AO, záře, tónování, barevné ladění a mlha | Čeká na návrh a kontrolu Astrou |
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
  a 23 testů Pythonu i produkční sestavení. Prošlo šest cílených kontrol WebGPU
  (materiály a rozpočet) a prvních 24 kontrol úplné sady na WebGL 2, včetně
  všech sedmi kontrol materiálů, dlaždic památek, mobilního ovládání a Valíku.
- Pro kontrolu soumraku v 18:09 se použije 19. říjen 2026. V Plzni toho dne
  slunce zapadá v 18:08. Pro srovnání denních a nočních snímků zůstává datum
  E13, 17. listopad 2026. [Údaje U.S. Naval Observatory](https://aa.usno.navy.mil/api/rstt/oneday?date=2026-10-19&coords=49.7475%2C13.3776&tz=2).
- Po dokončení čeká měření v autorově běžném prohlížeči a kontrola na telefonu.
