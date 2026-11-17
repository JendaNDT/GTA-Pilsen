# Měření výkonu E15

Měřeno 17. listopadu 2026 na Macu s Apple M4 a macOS 27.2.1 v Chromiu 159.0.8154.6.
WebGPU používalo Metal, WebGL 2 používalo ANGLE Metal. Výchozí revize E14 je
`415855a`, kód E15 je `43dbc63`. Pro všechny konfigurace běžel stejný nástroj
`tools/measure_map.mjs --work`, vysoká kvalita se stíny, 1920 × 1080 px, měřítko 1,
čas 10:00 a vypnutá adaptace kvality. Každý běh obsahoval 10 s jízdy a 10 s letu
po přípravě okolí. Měření běžela po jednom a bez souběžných testů. Pořadí se
mezi třemi sériemi střídalo. [Všech devět běhů a souhrn](mereni.json).

| Scénář a veličina | E14 | E15 WebGPU | E15 WebGL 2 |
| --- | ---: | ---: | ---: |
| Jízda, práce snímku | 4,80 / 6,60 / 7,80 | 3,20 / 4,20 / 5,50 | 5,30 / 9,90 / 11,20 |
| Jízda, výpočet hry | 0,60 / 1,10 / 1,30 | 0,40 / 0,60 / 0,80 | 0,60 / 1,10 / 1,40 |
| Jízda, příprava vykreslení | 4,10 / 6,00 / 7,20 | 2,80 / 3,70 / 4,80 | 4,70 / 8,90 / 9,90 |
| Jízda, GPU | 6,04 / 9,23 / 10,80 | 4,33 / 6,09 / 6,88 | 10,65 / 13,31 / 15,55 |
| Let, práce snímku | 4,30 / 6,50 / 7,10 | 2,70 / 3,80 / 4,40 | 5,20 / 7,30 / 8,40 |
| Let, výpočet hry | 0,10 / 0,30 / 0,40 | 0,20 / 0,40 / 0,50 | 0,30 / 0,60 / 0,80 |
| Let, příprava vykreslení | 4,20 / 6,40 / 7,00 | 2,50 / 3,60 / 4,10 | 4,80 / 7,00 / 8,20 |
| Let, GPU | 7,31 / 9,28 / 10,38 | 4,85 / 6,82 / 6,82 | 11,41 / 14,37 / 14,37 |

Každá buňka uvádí typickou hodnotu, p95 a p99 v milisekundách. Pro každou z nich
je uveden medián tří samostatných běhů. P95 říká, do jakého času se vešlo 95 % vzorků.
Typická doba spuštění z devíti načtení byla 1 100 ms v E14, 1 164 ms na WebGPU
a 1 370 ms na záložním WebGL 2.

Na WebGPU se p95 práce snímku zlepšilo o 36,4 % při jízdě a o 41,5 % při letu.
Příprava vykreslení měla p95 3,7 a 3,6 ms. Záložní WebGL 2 při jízdě vykázalo růst
p95 práce o 50 % a při letu o 12,3 %. Rozdíl se projevil hlavně v přípravě obrazu,
zejména při jízdě, kde p95 výpočtu hry zůstalo 1,1 ms. Rozpočet počtu volání a
trojúhelníků přitom prošel.

Záložní WebGL 2 používá správu uzlů a mezibuffer s převodem barev společné pro nový
vykreslovač. Přibyl výstupní průchod přes celý obraz. Jde o doložené změny práce
vykreslovače, jejich jednotlivé podíly na zpomalení nebyly změřeny. Pro navazující
grafické etapy je podnětem změřit výstupní průchod a vyhlazování samostatně na záložní
cestě. Nízká kvalita je ověřena prohlížečovými testy včetně dotykového ovládání.

Čas GPU se v E15 získává z dokončených průchodů stejného snímku přes časové značky
three.js. E14 měřila celý příkaz k vykreslení dotazem WebGL. Při letu s odemčenou
rychlostí snímků měla E15 pouze 10–11 časových vzorků GPU na běh ve WebGPU a 16–17
ve WebGL 2. Percentily GPU při letu proto slouží jen k orientaci. Čas procesoru byl
zaznamenán v každém snímku. Rozptyl všech běhů i počty vzorků jsou v datech.
[Podklad k výstupnímu průchodu](https://github.com/mrdoob/three.js/blob/r187/src/renderers/common/Renderer.js).

Výsledky pokrývají uvedený Mac. Ověření na skutečném telefonu zbývá podle
[návodu E13](../E13/mereni-na-zarizeni.md).
