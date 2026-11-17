# Referenční pohledy E15

Kamery, herní datum a příprava okolí vycházejí z [E13](../E13.md). Každý snímek
má 1280 × 720 px, JPEG s kvalitou 85 a velikost pod 250 kB. Obě cesty E15 byly
zachyceny v Chromiu 159.0.8154.6 na Macu s Apple M4. Použitý režim se ověřil po startu
hry. [Nastavení kamer](../../tools/reference-views.json).

| Pohled | E14 | E15 WebGPU | E15 WebGL 2 | Co je vidět při porovnání |
| --- | --- | --- | --- | --- |
| Náměstí ve dne | [E14](../E14/reference/namesti-den.jpg) | [WebGPU](webgpu/namesti-den.jpg) | [WebGL 2](webgl2/namesti-den.jpg) | Stejná dlažba a kresba fasád. Některé osvětlené a zastíněné plochy mají mírně jiné odstíny. |
| Náměstí v noci | [E14](../E14/reference/namesti-noc.jpg) | [WebGPU](webgpu/namesti-noc.jpg) | [WebGL 2](webgl2/namesti-noc.jpg) | Svítí stejná okna. Skvrny lamp na pravém okraji náměstí jsou o něco tlumenější. |
| Wilsonův most | [E14](../E14/reference/wilson.jpg) | [WebGPU](webgpu/wilson.jpg) | [WebGL 2](webgl2/wilson.jpg) | Řeka má na obou cestách stejný druh vln a odrazů. Drobné odchylky jsou na hranách mostu, ve stínech na břehu a na vlnách. |
| Portály Valíku | [E14](../E14/reference/valik-zapad.jpg) | [WebGPU](webgpu/valik-zapad.jpg) | [WebGL 2](webgl2/valik-zapad.jpg) | Oba průjezdy jsou otevřené. Liší se vyhlazení tenkých čar a odstín některých částí svahu. |
| Lochotín ze vzduchu | [E14](../E14/reference/lochotin.jpg) | [WebGPU](webgpu/lochotin.jpg) | [WebGL 2](webgl2/lochotin.jpg) | Nejviditelnější změna je v dálce, kde se opar plynuleji slévá s obzorem. U silnic a střech se liší vyhlazení. |
| Pole u Rokycan | [E14](../E14/reference/rokycany-pole.jpg) | [WebGPU](webgpu/rokycany-pole.jpg) | [WebGL 2](webgl2/rokycany-pole.jpg) | Dálka má tlumenější modrou, v popředí odpovídají hranice polí, silnice a zástavba. |
| Hamr v Dobřívě | [E14](../E14/reference/dobriv-hamr.jpg) | [WebGPU](webgpu/dobriv-hamr.jpg) | [WebGL 2](webgl2/dobriv-hamr.jpg) | Zůstává pohyblivá voda v náhonu, dlažba i kresba dřeva. Jemně se liší hrany a stíny na dvoře. |
| Údolí Klabavy | [E14](../E14/reference/klabava-udoli.jpg) | [WebGPU](webgpu/klabava-udoli.jpg) | [WebGL 2](webgl2/klabava-udoli.jpg) | V dálce je jiný odstín oparu. U stromořadí, střech a břehů jsou drobné rozdíly vyhlazení. |

Průměrná absolutní odchylka RGB mezi oběma cestami E15 dosahuje 0,24–1,61 z 255.
Pro WebGPU proti E14 je rozpětí 0,69–4,71 z 255. Největší odchylky jsou v leteckých
pohledech, kde opar zabírá velkou část obrazu. Čísla zahrnují i rozdíly komprese JPEG.
[Úplné porovnání](porovnani-snimku.json).

Snímky jednotlivých převodů zachycují [oblohu ve dne](kroky/03a-obloha-den.jpg)
a [v noci](kroky/03a-obloha-noc.jpg), [vodu](kroky/03b-voda.jpg), [portály](kroky/03b-valik.jpg),
[dlažbu](kroky/03b-dlazba.jpg), přechod v centru [v E14](kroky/03c-vozovka-e14.jpg) a [v E15](kroky/03c-vozovka.jpg),
[fasády ve dne](kroky/03d-fasady.jpg) a [v noci](kroky/03d-okna.jpg),
[náhon](kroky/03e-nahon.jpg), [skvrny lamp](kroky/03e-lampy.jpg)
a světlomety [před převodem](kroky/03f-svetlomety-e14.jpg) a [po převodu](kroky/03f-svetlomety.jpg).
