# E36 · Archivní port Godot

Na macOS arm64 prošel import v Godotu 4.7.2 i kontrola skriptů. Revize `777b8f4` vyhodnocuje návratový kód každého spuštění včetně importu. Při chybě zachová výstup. Automatické zkoušky pokryly správný průchod, chybu bez zprávy, chybu jediného skriptu, chybějící příkaz a časový limit.

V oddělené kopii portu zůstal původní automatický řidič rozvozu stát. Když zkušební scénář přesunul pěšího hráče na místo vyzvednutí a poté na místo předání, hra vyplatila jednu odměnu a uložila dokončení. Tento pokus prověřuje předání. Samostatné projetí celé trasy ještě čeká na ověření.

Fotorežim při běžném čase prošel. Pět dalších vstupů a návratů vykázalo v každém cyklu 13 535 objektů, v jiné sérii deset cyklů po 13 505. V druhém běhu Godot při ukončení ohlásil 26 neuvolněných instancí. Zrychlená zkouška s pevným časem skončila na časovém limitu s 18 instancemi. V měřených cyklech počet objektů nerostl. Původ výstupního varování zůstává otevřený.

[Katalog 52 funkcí portu](../godot/FUNKCE.md) eviduje 33 hotových, 18 částečných a jednu chybějící. Rozsah převodu přechodů chodců, semaforů MHD a portálu Valíku popisuje katalog.
