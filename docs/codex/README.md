# Zadání pro Codex

Každá etapa plánu má vlastní soubor s úplným zadáním. Codex si sám načte stálá pravidla z
[AGENTS.md](../../AGENTS.md), takže do Codexu stačí vložit krátkou zprávu podle šablon níže.
Přehled etap a jejich vztahy jsou v [plánu](../plan-presnost-a-vzhled.md). Popis jednotlivých
vylepšení je v [katalogu](../fyzika-a-grafika.md).

## Pořadí a volba modelu

Model a úroveň uvažování vychází z popisu OpenAI: Astra je nejschopnější model pro náročnou
práci; 6.1 Sol má podobné výsledky za nižší cenu a hodí se na dlouhou práci podle jasného
zadání. Když Sol v některé etapě opakovaně selže, přepni ji na Astru.

| Etapa | Obsah | Stavba | Kontrola |
| --- | --- | --- | --- |
| [E13](E13.md) | příprava a měření | Sol, Medium | Sol, Medium |
| [E14](E14.md) | three.js 0.187 | Sol, High | Sol, Medium |
| [E15](E15.md) | WebGPU a materiály v TSL | Astra, High | Astra, High |
| [E16](E16.md) | ortofoto | Sol, High | Sol, Medium |
| [E17](E17.md) | grafika A: světlo a obraz | Sol, High | Astra, Medium |
| [E18](E18.md) | fyzika Jolt a auto hráče | Astra, High | Astra, High |
| [E19](E19.md) | chodci, zábradlí, ragdolly | Astra, High | Sol, High |
| [E20](E20.md) | provoz, MHD, vrtulník, voda | Astra, High | Astra, Medium |
| [E21](E21.md) | ničení a poškození | Sol, High | Astra, Medium |
| [E22](E22.md) | měřené stavby a mosty | Astra, High (převod), Sol, High (dávky) | Astra, High |
| [E23](E23.md) | grafika B: krajina, voda, noc | Sol, High | Sol, High |
| [E24](E24.md) | grafika C: budovy, auta, počasí | Sol, High | Astra, Medium |
| [E25](E25.md) | tři úseky ulic | Sol, High | Sol, High |
| [E26](E26.md) | vydání | Sol, High | Astra, High |

E16 může přijít kdykoli po E13. Ostatní etapy jdou v uvedeném pořadí.

## Šablony zpráv

**Zahájení etapy** (vlož do nové konverzace v Codexu):

```text
Proveď etapu E15 podle docs/codex/E15.md. Nejdřív si přečti AGENTS.md, plán a zadání.
Založ větev etapa/E15, postupuj po krocích ze zadání a po každém kroku spusť testy a
udělej commit. Když narazíš na rozhodnutí, které zadání neřeší, zeptej se mě. Na konci
napiš protokol docs/E15.md a česky mi shrň, co mám ve hře vyzkoušet.
```

**Pokračování** po přerušení nebo vyčerpání limitu:

```text
Pokračuj v etapě E15 podle docs/codex/E15.md. Zjisti z historie větve etapa/E15, které
kroky jsou hotové, ověř je testy a pokračuj dalším krokem.
```

**Kontrola etapy** (nová konverzace, model podle tabulky):

```text
Zkontroluj etapu E15 na větvi etapa/E15 proti docs/codex/E15.md. Projdi všechny změny od
odbočení z main, spusť všechny testy a ověř každé kritérium přijetí. Vypiš očíslované nálezy
seřazené podle závažnosti, u každého místo v kódu a důvod. Nic neopravuj.
```

Potom do konverzace, kde etapa vznikla, napiš: `Oprav nálezy 1, 2 a 4 z kontroly. Ostatní
zapiš do protokolu jako známé odchylky.`

**Hlášení chyby:**

```text
Chyba ve hře (větev etapa/E18): Co jsem udělal: … Co se stalo: … Co jsem čekal: …
Kde na mapě: … Prohlížeč a zařízení: … (přikládám snímek obrazovky).
Najdi příčinu, napiš test, který chybu zachytí, oprav ji a ověř, že test prochází.
```

**Sloučení:** když kontrola i tvoje vyzkoušení dopadnou dobře, napiš: `Připrav sloučení
větve etapa/E15 do main: aktualizuj ji z main, spusť všechny testy a otevři pull request.`

## Jak vyzkoušet etapu

1. Na Macu spusť `Spustit hru.command` (otevře http://localhost:5173), nebo v terminálu
   `npm ci` a `npm run dev`.
2. Projdi body z části **Kontrola pro autora** v zadání etapy.
3. Výkon změř podle postupu z E13 na počítači a na telefonu. Telefon otevře hru přes adresu,
   kterou vypíše `npm run dev` (stejná Wi-Fi), nebo přes nasazený náhled.
4. Co nefunguje, nahlas šablonou „Hlášení chyby“.

## Obsah zadání

Každé zadání má stejné části:

- **Cíl**
- **Výchozí stav**: konkrétní soubory a funkce
- **Rozsah a mimo rozsah**
- **Postup**: kroky, každý končí commitem
- **Technické poznámky**: ověřená API a známé pasti
- **Testy a ověření**
- **Kritéria přijetí**
- **Výstupy**
- **Kontrola pro autora**: co vyzkoušet ve hře bez čtení kódu
