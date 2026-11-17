# Jak změřit výkon Plzně naplno

## Na počítači

1. Spusť hru. Na Macu můžeš použít `Spustit hru.command`. V Chromu otevři
   [hru s měřením](http://localhost:5173/?debug&adapt=0) a klikni na **Hrát**.
2. Nastup klávesou **F** do auta. Stiskni **F9** nebo klikni na **Měření** a zvol
   **Začít znovu**. Parametr `adapt=0` během jízdy drží původní rozlišení a nastavení stínů.
3. Jeď minutu po městě a měj kartu hry v popředí. Až panel ukáže **Výsledek za posledních
   60 sekund**, zkopíruj text z pole nebo ho opiš. Výsledek se při označování textu ustálí.

## Na telefonu

1. Připoj telefon ke stejné Wi-Fi jako počítač. Ve složce hry na počítači spusť `npm run dev`.
   Z terminálu vezmi adresu označenou **Network**. Na telefonu k ní přidej `?debug&adapt=0`.
   Výsledná adresa může vypadat jako `http://192.168.1.20:5173/?debug&adapt=0`.
2. Otoč telefon na šířku a klepni na **Hrát**. Klepni na **Měření** a **Začít znovu**.
   Jeď stejnou trasu po dobu jedné minuty.
3. Zkopíruj výsledek dlouhým stiskem v textovém poli, opiš ho nebo ulož snímek obrazovky.
   Pokud chybí čas GPU, zaznamenej zbytek výsledku. Dostupnost času GPU závisí na prohlížeči.

## Co poslat ke kontrole

Uveď model zařízení, systém a verzi prohlížeče, trasu, orientaci obrazovky a celý výsledek
z panelu. Pro další měření na stejném zařízení použij stejnou trasu a nastavení. Řádek
**Práce snímku** vyjadřuje čas výpočtu hry a přípravy obrazu na procesoru. Medián je
typická hodnota. P95 říká, do jakého času se vešlo 95 % snímků, a p99 totéž pro 99 %.
Čas GPU ukazuje práci grafického čipu samostatně. Počet volání a trojúhelníků se týká
posledního vykresleného snímku.

| Zařízení | Systém a prohlížeč | Trasa a orientace | Výsledek z panelu |
| --- | --- | --- | --- |
| Počítač | | | |
| Telefon | | | |
