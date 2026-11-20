extends Scenar
## Garáž u hlavního nádraží: koupě auta, vylepšení, vyzvednutí, poškození, uložení do garáže,
## oprava a zachování v uložené hře. Spuštění: godot --headless --path godot testy/scenar_garaz.tscn


func scenar() -> void:
	krok("Start u garáže")
	await cekej_na_svet()
	hra.svet.postav_hned(Garaz.MISTO, 250.0)
	hra.chodec.postav_na(Garaz.MISTO.x + 7.0, Garaz.MISTO.y + 7.0)
	await cekej(1.0)
	over(hra.garaz.blizko(), "hráč stojí u garáže (%.0f m)" % Vector2(hra.chodec.global_position.x, hra.chodec.global_position.z).distance_to(Garaz.MISTO))
	over(hra.garaz.vlastni.is_empty(), "na začátku hráč vlastní auto nemá")
	hra.penize = 1000
	over(hra.garaz.proved("koupit") == "Na nákup nemáš dost peněz.", "bez peněz auto koupit nejde")
	hra.penize = 3000

	krok("Koupě a vylepšení")
	print("  ", hra.garaz.proved("koupit"))
	over(not hra.garaz.vlastni.is_empty() and hra.penize == 3000 - Garaz.CENA_AUTA, "auto koupeno za %d Kč (zbývá %d Kč)" % [Garaz.CENA_AUTA, hra.penize])
	print("  ", hra.garaz.proved("brzdy"))
	print("  ", hra.garaz.proved("pneu"))
	over(hra.garaz.vlastni.vylepseni.brzdy and hra.garaz.vlastni.vylepseni.pneu, "brzdy i pneumatiky jsou vylepšené")
	over(hra.penize == 3000 - 1350 - 325 - 360, "zaplaceno 325 + 360 Kč (zbývá %d Kč)" % hra.penize)
	over(hra.garaz.proved("brzdy") == "Tato možnost teď není k dispozici.", "druhé vylepšení téhož se neplatí")

	krok("Vyzvednutí a jízda")
	print("  ", hra.garaz.proved("vyzvednout"))
	var a := hra.garaz.auto
	over(is_instance_valid(a) and a.vylepseni.get("brzdy", false) and a.vylepseni.get("pneu", false), "auto stojí u garáže s vylepšeními")
	await cekej(1.0)
	hra.chodec.postav_na(a.global_position.x + 2.5, a.global_position.z)
	await cekej(0.5)
	hra._akce("nastoupit")
	await cekej(0.3)
	over(hra.rezim == "auto" and hra.auto_hrace == a, "hráč sedí ve vlastním autě")
	a.poskozeni = 40.0
	hra._akce("nastoupit")
	await cekej(0.5)
	over(hra.rezim == "pesky", "hráč vystoupil")
	var u := hra.stav()
	over((u.auto as Dictionary).is_empty() or u.auto.get("barva", "") != Garaz.BARVA.to_html(false), "vlastní auto se neukládá jako zaparkované cizí auto")
	over(is_equal_approx(float(u.garaz.poskozeni), 40.0), "uložení zná poškození vlastního auta (%.0f %%)" % float(u.garaz.poskozeni))

	krok("Uložení do garáže a oprava")
	print("  ", hra.garaz.proved("ulozit"))
	await cekej(0.2)
	over(not is_instance_valid(hra.garaz.auto) or hra.garaz.auto == null, "auto je v garáži")
	var cena := hra.garaz.cena_opravy()
	over(cena == 275, "oprava 40 %% poškození stojí %d Kč (předloha: 75 + 5 × 40)" % cena)
	var pred := hra.penize
	print("  ", hra.garaz.proved("opravit"))
	over(hra.penize == pred - cena and float(hra.garaz.vlastni.poskozeni) == 0.0, "auto je opravené")

	krok("Uložená hra")
	hra.uloz()
	var nactene := Ulozeni.nacti()
	var g: Dictionary = nactene.garaz
	over(g.get("model", "") == "hatch" and g.vylepseni.brzdy and g.vylepseni.pneu and float(g.poskozeni) == 0.0, "garáž je v uložené hře (%s)" % JSON.stringify(g))
	var nova := Garaz.new()
	nova.nacti(g)
	over(nova.vlastni.vylepseni.pneu, "po načtení hry auto v garáži zůstává s vylepšeními")
	nova.free()
	await snimek("garaz")
