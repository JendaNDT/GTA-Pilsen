# Měření výkonu E16

Na Macu s Apple M4 bylo použito Chromium 159.0.8154.6, WebGPU přes Metal, vysoká
předvolba, 1920 × 1080 a stejné nastavení dne ve všech jízdách. Nástroj
`tools/measure_map.mjs` před každým desetisekundovým měřením dokončil stavbu okolí
a načtení dostupných snímků. Čas CPU zahrnuje celý krok hry i přípravu obrazu.
P95 je hodnota, do které se vešlo 95 % vzorků.

| Trasa | CPU p95 vypnuto / zapnuto | GPU p95 vypnuto / zapnuto | Snímky přes 50 ms vypnuto / zapnuto |
| --- | ---: | ---: | ---: |
| Jízda v Plzni, 61 m | 3,2 / 2,5 ms | 4,85 / 4,06 ms | 0 / 0 |
| Let u Dobříva, 191 m | 4,9 / 3,4 ms | 7,47 / 5,83 ms | 1 / 2 |
| Jízda v Hrádku, 76 m | 4,1 / 2,3 ms | 5,05 / 3,34 ms | 0 / 0 |
| Let nad Plzní, 192 m | 5,8 / 3,6 ms | 7,27 / 5,44 ms | 0 / 0 |

První zkouška měla opačné pořadí. Tehdy CPU p95 stouplo u jízdy v Hrádku
z 2,3 na 3,8 ms a u letu nad Plzní z 3,3 na 4,6 ms. Při jízdě a letu se část
kontrol okolních dlaždic stále opakovala v každém snímku. Seznam požadovaných
bloků se teď obnovuje při posunu do jiné dlaždice. Dříve nakreslená textura
se kontroluje znovu po změně dostupnosti snímku. Před závěrečným měřením se
také vyčkalo na překreslení okolí.

Závěrečné měření začalo zapnutou vrstvou a rychlejší byl první běh. Pořadí,
stav počítače a změna přípravy scény ovlivňují srovnání, proto uvedený rozdíl
nelze celý připsat snímkům. U Dobříva bylo jen 11 a 13 vzorků GPU, ostatní
trasy měly nejméně 321. Obě varianty se vešly do pracovní meze GPU 12 ms.
V referenčních pohledech prošly rozpočty počtu vykreslení a trojúhelníků
na WebGPU i WebGL 2.

Postup pro zopakování z adresáře hry po `npm run build` a spuštění
`npm run preview -- --port 4173`:

```sh
node tools/measure_map.mjs 'http://127.0.0.1:4173/' --work --release --output=data-raw/orthophoto/mereni-zapnuto.json
node tools/measure_map.mjs 'http://127.0.0.1:4173/?orthophoto=0' --work --release --output=data-raw/orthophoto/mereni-vypnuto.json
```

Nízkou předvolbu ověřují prohlížečové testy. Fyzický telefon k měření nebyl k dispozici.
