extends Scenar
## Voda: dno pod hladinou Radbuzy, plavání hráče a auto, které nejdřív plave a pak se potopí
## (water.js a player.js v předloze). Spuštění: godot --headless --path godot testy/scenar_voda.tscn


func _nejhlubsi(od: Vector2, do_: Vector2) -> Vector2:
	var nej := Vector2.ZERO
	var nej_h := 0.0
	var x := od.x
	while x <= do_.x:
		var z := od.y
		while z <= do_.y:
			var h := Mapa.hloubka(x, z)
			if h > nej_h:
				nej_h = h
				nej = Vector2(x, z)
			z += 4.0
		x += 4.0
	return nej


func scenar() -> void:
	krok("Radbuza u Wilsonova mostu má dno pod hladinou")
	await cekej_na_svet()
	var w := _nejhlubsi(Vector2(150, 480), Vector2(330, 620))
	var hl := Mapa.hloubka(w.x, w.y)
	print("  nejhlubší místo (%.0f, %.0f): hloubka %.2f m, hladina %.2f" % [w.x, w.y, hl, Mapa.vyska(w.x, w.y)])
	# riverBed: 8 m od břehu 0,12 m/m, dál 0,025 m/m; řeka široká asi 60 m tak má uprostřed asi 1,5 m
	over(hl > 1.2 and hl <= 2.41, "hloubka uprostřed řeky %.2f m (vzorec předlohy, nejvýš 2,4 m)" % hl)
	# břeh: první suché místo západně od nejhlubšího bodu
	var breh := w
	while Mapa.hloubka(breh.x, breh.y) > 0.0 and breh.x > w.x - 120.0:
		breh.x -= 1.0
	breh.x -= 3.0
	print("  břeh (%.0f, %.0f), terén %.2f" % [breh.x, breh.y, Mapa.vyska(breh.x, breh.y)])
	hra.svet.postav_hned(w, 250.0)
	await cekej(1.0)

	krok("Hráč vejde do řeky a plave")
	hra.chodec.postav_na(breh.x, breh.y)
	await cekej(0.5)
	var t := 0.0
	var plaval := false
	var nejniz := INF
	while t < 40.0 and hra.chodec.global_position.x < w.x - 2.0:
		hra.kamera.yaw = PI / 2.0
		Vstup.dotyk_pohyb = Vector2(0, 1)
		await get_tree().physics_frame
		t += 1.0 / Engine.physics_ticks_per_second
		if hra.chodec.plave:
			plaval = true
			nejniz = minf(nejniz, hra.chodec.global_position.y - Mapa.vyska(hra.chodec.global_position.x, hra.chodec.global_position.z))
	var p := hra.chodec.global_position
	over(plaval and hra.chodec.plave, "hráč plave (x %.0f, hloubka pod ním %.1f m)" % [p.x, Mapa.hloubka(p.x, p.z)])
	over(nejniz > -0.6, "hlava zůstává nad vodou (nohy nejvýš %.2f m pod hladinou)" % -nejniz)
	var v := Vector2(hra.chodec.velocity.x, hra.chodec.velocity.z).length()
	over(absf(v - Chodec.PLAVANI) < 0.4, "rychlost plavání %.1f m/s (předloha 1,7 m/s)" % v)
	await snimek("01-plavani")

	krok("Návrat na břeh")
	t = 0.0
	while t < 40.0 and hra.chodec.plave:
		hra.kamera.yaw = -PI / 2.0
		Vstup.dotyk_pohyb = Vector2(0, 1)
		await get_tree().physics_frame
		t += 1.0 / Engine.physics_ticks_per_second
	await cekej(1.0)
	Vstup.dotyk_pohyb = Vector2.ZERO
	over(not hra.chodec.plave, "hráč vylezl z vody za %.0f s" % t)

	krok("Auto spadne do řeky: plave a potom se potopí")
	var a := hra.postav_auto("hatch", Vector3(w.x, Mapa.vyska(w.x, w.y) + 0.6, w.y), Vector3(0, 0, 1), Color(0.3, 0.4, 0.6))
	await cekej(2.0)
	var y2 := a.global_position.y - Mapa.vyska(w.x, w.y)
	over(a.v_vode > 0.0 and y2 > -1.0, "po 2 s auto plave (%.2f m vůči hladině)" % y2)
	t = 0.0
	while not a.potopene and t < 30.0:
		await get_tree().physics_frame
		t += 1.0 / Engine.physics_ticks_per_second
	var y := a.global_position.y - Mapa.vyska(a.global_position.x, a.global_position.z)
	over(a.potopene, "auto se potopilo za %.0f s (střecha pod hladinou, %.2f m)" % [t + 2.0, y])
	var dno := Mapa.dno(a.global_position.x, a.global_position.z)
	over(a.global_position.y > dno - 0.6, "auto leží na dně, nepropadlo se (%.2f m nad dnem)" % (a.global_position.y - dno))
	await snimek("02-auto-ve-vode")
