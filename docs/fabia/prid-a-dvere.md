# Fabia II zblízka

Druhá verze navazuje na revizi `b7a9fd9`. Na náměstí jsme vyfotili stejné auto za denního světla ze stejných dvou míst.

| Pohled | Před úpravou | Po úpravě |
| --- | --- | --- |
| Příď | [Původní světla a maska](pred-opravou-prid.jpg) | [Kryty světel, paraboly a napojení na blatník](oprava-prid.jpg) |
| Bok | [Původní obrysy dveří](pred-opravou-dvere.jpg) | [Tvar obou dveří, kliky, rámy a prosklení](oprava-dvere.jpg) |

Zakřivení předních světlometů, kapota a členění bočních dveří vycházejí z pětidveřové Fabie II z roku 2007. Plechy, skla, paraboly a kliky vznikají z vlastní geometrie projektu. [Obrazová předloha výrobce](https://cdn.skoda-storyboard.com/2021/02/SKODA_FABIA_History.pdf)

Ve hře obejdi zaparkovanou Fabii. Zepředu se obě paraboly dají rozeznat i při zhasnutých světlech. Z boku můžeš sledovat spáru zadních dveří podél podběhu až k prahu. Po nasednutí můžeš na místě vytočit přední kola.

## Ověření

Prošlo 314 testů JavaScriptu, produkční sestavení a 12 cílených prohlížečových kontrol. Testy ověřily světla v noci, animaci kol při jízdě i couvání a rozpočet všech čtyř grafických předvoleb na WebGL 2 a WebGPU. Podrobný vůz včetně čtyř kol má 2 188 trojúhelníků při limitu 2 200.

Na Apple M4 při jízdě dlouhé 111 m v nízké předvolbě na WebGL 2 naměřil nástroj `tools/measure_map.mjs` na 95. percentilu 3,7 ms práce na snímek a 11,4 ms na GPU. Jde o jeden průjezd ve městě.
