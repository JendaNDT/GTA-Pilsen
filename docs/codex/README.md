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
| [E13](E13.md) | příprava a měření · [protokol](../E13.md) | Sol, Medium | Sol, Medium |
| [E14](E14.md) | three.js 0.187 · [protokol](../E14.md) | Sol, High | Sol, Medium |
| [E15](E15.md) | WebGPU a materiály v TSL · [protokol](../E15.md) | Astra, High | Astra, High |
| [E16](E16.md) | ortofoto · [protokol](../E16.md) | Sol, High | Sol, Medium |
| [E17](E17.md) | grafika A: světlo a obraz · [protokol](../E17.md) | Sol, High | Astra, Medium |
| [E18](E18.md) | fyzika Jolt a auto hráče · [protokol](../E18.md) | Astra, High | Astra, High |
| [E19](E19.md) | chodci, zábradlí, ragdolly · [protokol](../E19.md) | Astra, High | Sol, High |
| [E20](E20.md) | provoz, MHD, vrtulník, voda | Astra, High | Astra, Medium |
| [E21](E21.md) | ničení a poškození | Sol, High | Astra, Medium |
| [E22](E22.md) | měřené stavby a mosty | Astra, High (převod), Sol, High (dávky) | Astra, High |
| [E23](E23.md) | grafika B: krajina, voda, noc | Sol, High | Sol, High |
| [E24](E24.md) | grafika C: budovy, auta, počasí | Sol, High | Astra, Medium |
| [E25](E25.md) | tři úseky ulic | Sol, High | Sol, High |
| [E26](E26.md) | vydání | Sol, High | Astra, High |

E16 může přijít kdykoli po E13. Ostatní etapy jdou v uvedeném pořadí.

## Univerzální zpráva (doporučeno)

Tuhle zprávu vkládej do Codexu pořád dokola. Codex si sám zjistí, která etapa je na řadě,
řekne ti, jaký model k ní patří, a po etapě se zastaví.

```text
Pokračuj v implementaci plánu Plzeň naplno.

1. Přečti si AGENTS.md, docs/plan-presnost-a-vzhled.md a docs/codex/README.md.

2. Zjisti, kde jsme:
   - Když jsi na větvi etapa/Exx, pokračuj v této etapě. Hotové kroky zjisti z historie
     commitů a z docs/codex/stav.md a ověř je testy.
   - Když jsi na main, vezmi první etapu z tabulky v docs/codex/README.md, která v main
     ještě nemá protokol docs/Exx.md, a založ pro ni větev etapa/Exx.
   - Když je předchozí etapa hotová, ale není sloučená do main, novou nezačínej a řekni mi to.

3. Než začneš pracovat, napiš mi v pár větách:
   - kterou etapu budeš dělat a co v ní vznikne,
   - jaký model a úroveň uvažování pro ni doporučuje tabulka,
   - co ode mě budeš potřebovat (rozhodnutí, fotky, měření).
   Potom počkej, až napíšu „pokračuj“.

4. Proveď etapu podle docs/codex/Exx.md: krok za krokem, po každém kroku dotčené testy
   a commit. Pracuj jen na této jedné etapě.

5. Když chybí nástroj nebo internet, nebo narazíš na rozhodnutí, které zadání neřeší,
   zastav se a zeptej se mě. Nic neobcházej a nesnižuj očekávání testů.

6. Průběžně veď docs/codex/stav.md: etapa, hotové a zbývající kroky, otevřené otázky,
   poslední výsledky testů. Když ti dojde kontext nebo čas, zapiš stav, commitni a napiš
   mi, ať můžu pokračovat stejnou zprávou.

7. Na konci etapy:
   - napiš protokol docs/Exx.md, aktualizuj README a katalog a spusť všechny testy,
   - připrav pull request do main (když ho nemůžeš otevřít sám, napiš mi jak),
   - česky a bez žargonu mi napiš, co se změnilo, co mám ve hře vyzkoušet (podle části
     „Kontrola pro autora“) a kterým modelem mám udělat kontrolu.
   Další etapu nezačínej.
```

**Postup s univerzální zprávou:**

1. **Zahájení:** založ v Codexu nový úkol nad `main` (nebo nad větví `etapa/Exx`, když
   pokračuješ v rozdělané etapě) a vlož zprávu.
2. **Volba modelu:** Codex napíše, která etapa je na řadě a jaký model k ní patří. Když máš
   zvolený jiný, přepni ho. Pokud to v běžícím úkolu nejde, spusť úkol znovu se správným
   modelem. Pak napiš „pokračuj“.
3. **Kontrola:** po dokončení vyzkoušej hru podle seznamu, který ti Codex napíše, a nech
   udělat kontrolu šablonou „Kontrola etapy“ níže.
4. **Sloučení:** když je všechno v pořádku, slouč pull request do `main` a začni znovu od
   kroku 1.

Soubor `docs/codex/stav.md` si Codex vytvoří při první etapě. Kdykoli v něm uvidíš, kde se
zrovna nachází.

**Cloud Codexu:** agent tam ve výchozím nastavení nemá internet. Do instalačního skriptu
prostředí (ten internet má) proto vlož:

```bash
npm ci
python3 -m pip install -r tools/requirements.txt
npx playwright install --with-deps chromium
```

## Další šablony zpráv

Tyto šablony se hodí, když chceš konkrétní etapu, kontrolu nebo opravu chyby.

**Zahájení konkrétní etapy** (vlož do nové konverzace v Codexu):

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
