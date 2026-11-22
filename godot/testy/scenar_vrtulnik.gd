extends Scenar
## Vrtulník na náměstí Republiky: nástup, vzlet, let vpřed, přistání a výstup.
##   godot --headless --path godot testy/scenar_vrtulnik.tscn


func scenar() -> void:
	krok("Vrtulník na heliportu u náměstí")
	await cekej_na_svet()
	await cekej(2.0)
	var h: Vrtulnik = hra.vrtulniky.get(3)
	over(h != null, "na náměstí stojí vrtulník")
	if h == null:
		return
	await cekej(1.0)
	var zem := h.global_position.y
	over(h.pristany, "vrtulník stojí na ližinách (y %.2f)" % zem)
	# natočit stroj na východ (nad nižší zástavbou, mimo věž katedrály)
	h.global_rotation = Vector3(0, PI / 2.0, 0)
	await cekej(0.5)
	hra.chodec.global_position = h.global_position + Vector3(0, 0.3, 2.8)
	await cekej(0.3)
	hra._akce("nastoupit")
	await cekej(0.3)
	over(hra.rezim == "vrtulnik", "hráč nastoupil do vrtulníku")

	krok("Vzlet")
	await cekej(3.0)
	Vstup.dotyk_brzda = true
	await cekej(9.0)
	Vstup.dotyk_brzda = false
	await cekej(1.0)
	var vyska := h.global_position.y - zem
	over(vyska > 50.0, "vrtulník vystoupal o %.0f m" % vyska)
	await snimek("01-vzlet")

	krok("Let vpřed")
	var start := h.global_position
	Vstup.dotyk_pohyb = Vector2(0, 1)
	await cekej(10.0)
	Vstup.dotyk_pohyb = Vector2.ZERO
	var ulet := Vector2(h.global_position.x - start.x, h.global_position.z - start.z).length()
	over(ulet > 150.0, "vrtulník uletěl %.0f m, nejvyšší rychlost kolem %.0f km/h" % [ulet, h.rychlost_kmh()])
	over(absf(h.uhly().z) < 0.4 and absf(h.uhly().x) < 0.7, "asistent drží stroj ve stabilní poloze")
	await snimek("02-let")

	krok("Brzdění a přistání")
	await cekej(8.0)
	Vstup.dotyk_beh = true
	var t := 0.0
	while not h.pristany and t < 60.0:
		await get_tree().physics_frame
		t += 1.0 / Engine.physics_ticks_per_second
	Vstup.dotyk_beh = false
	await cekej(1.0)
	over(h.pristany, "vrtulník přistál za %.0f s (%.1f m nad terénem)" % [t, h.vyska_nad_terenem()])
	hra._akce("nastoupit")
	await cekej(0.5)
	over(hra.rezim == "pesky", "hráč vystoupil")
	await cekej(1.0)
	over(hra.chodec.is_on_floor(), "hráč stojí na pevném povrchu")
	await snimek("03-pristani")
