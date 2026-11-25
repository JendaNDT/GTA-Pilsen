# Plán oprav po auditu hry

**První vydatelná oprava chrání uložený postup.** Hráč musí po potvrzeném novém začátku dostat 500 Kč a zavření zapomenuté karty mu nesmí vzít mezitím vydělané peníze. Tuto opravu lze vydat dříve než pěší navigaci a úpravy grafiky.

Výchozí hratelná revize je `42d7571`, audit je v commitu `9f47ee5`. Čísla nálezů níže odkazují na jeho tabulku. Průběh implementace a poslední zkoušky zachycuje [stav oprav](codex/stav.md). [Audit hry](audit-hry-2026-11-25.md) · [Referenční měření](audit-hry-2026-11-25-vykon.json)

| Pořadí | Rozsah | Co půjde po dokončení ověřit | Návaznost |
| --- | --- | --- | --- |
| [E31 · Uložená hra](codex/E31.md) | Chyby 1–3. Reset, dvě karty, částečně poškozené uložení | Peníze, garáž a odměny přežijí zavření staré karty. Nová hra opravdu začne od začátku. | První samostatně vydatelný celek |
| [E32 · Start hry a datové nástroje](codex/E32.md) | Chyba 8, volitelné podklady, chyba zkoušky archivu na macOS | Hra se spustí i při vadném souboru zvuků. Balení vydání odhalí skutečně změněný soubor. | Lze vyvíjet nezávisle na E31. Předchází optimalizaci startu. |
| [E33 · Zakázky a let](codex/E33.md) | Chyby 4, 6 a 7. Předání na správné výškové úrovni, dotyk, náklon a popisy tlačítek | Jídlo předáš v ulici. Vrtulník může zároveň stoupat a letět vpřed a naklání se do zatáčky. | Pro ověření peněz použít opravy E31. Let lze předat zvlášť. |
| [E34 · Pěší cíl a síť cest](codex/E34.md) | Chyba 5, pěší navigace v dalších čtvrtích a kontrola mostních křížení | Značka zůstane na vybraném místě. Trasa využije průchozí pěšiny a lávky ve správné výšce. | Přesný bod lze vydat samostatně. Výpočet tras a kontrola dat na něj navazují. |
| [E35 · Výkon a údržba kódu](codex/E35.md) | Měření rozpočtů, start, vykreslování špičky a cena vyhledávání překážek | Srovnání stejné jízdy před a po na obou vykreslovačích, včetně vlivu na obraz a provoz | Měřit proti stejné revizi před každou změnou. Start závisí na E32. |
| [E36 · Převzetí a vydání](codex/E36.md) | Celá sada testů, skutečný telefon, obraz, zvuk a samostatné kontroly archivovaného Godotu | Přehled, které opravy prošly na počítači a telefonu, které odchylky ještě zbývají a ke které revizi se vrátit | Závěrečné převzetí po E31–E35. Archivní kontrola může běžet samostatně. |

## Jak postupovat

Každý číslovaný krok v zadání je samostatně ověřitelná změna. Nejprve zaznamenat selhání na výchozí revizi, potom opravit příčinu a zopakovat stejný scénář. U měřených změn uložit také výchozí hodnoty. Pracovat na větvi etapy a po ověření kroku udělat český commit. Stav, další krok a otevřené otázky patří do [stavu etap](codex/stav.md). Po dokončení etapy sepsat její protokol podle [pravidel projektu](../AGENTS.md).

Před commitem spustit `npm test` a `npm run build`. Při změně běhu hry ověřit sestavenou hru pomocí `npm run test:e2e -- --trace off`, při změně datových nástrojů také `npm run test:python`. Cílené scénáře uvedené v etapách slouží k rychlé kontrole jednotlivých oprav. Počty 320 jednotkových a 440 prohlížečových testů popisují výchozí revizi. Nové případy se mají přidat.

**Rozhodnutí o rozsahu.** Přednost má aktivní webová hra. Mezi závazné opravy patří všech osm reprodukovaných chyb. Výkonnostní zásahy se vybírají podle měření. U 148 nízkých křížení se nejprve určí druh cesty a skutečná průchodnost. Godot má od 23. listopadu archivní režim, proto plán počítá s opravou průkaznosti jeho kontrol a s evidencí známých omezení. Rozšíření funkcí portu má vlastní podmínku v E36.
