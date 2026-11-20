extends Scenar
## První hratelná část: start na náměstí Republiky, chůze, nástup do auta, jízda přes Wilsonův most,
## výstup na mostě a chůze po mostě. Spuštění:
##   godot --headless --path godot testy/scenar_most.tscn
##   (se snímky) xvfb-run godot --path godot testy/scenar_most.tscn -- --snimky /cesta/slozka

const MOST_ZAPAD := Vector3(171.4, -2.1, 457.6)
const MOST_VYCHOD := Vector3(233.6, -2.2, 457.5)
const MOSTOVKA := -2.15
const DNO_REKY := -12.5


func scenar() -> void:
	krok("Start na náměstí Republiky")
	await cekej_na_svet()
	await cekej(1.0)
	var p := hra.chodec.global_position
	over(Vector2(p.x, p.z).distance_to(Hra.START) < 3.0, "hráč stojí u startu (%.1f, %.1f)" % [p.x, p.z])
	over(absf(p.y - Mapa.vyska(p.x, p.z)) < 0.6, "hráč stojí na zemi (y %.2f, terén %.2f)" % [p.y, Mapa.vyska(p.x, p.z)])
	over(Mapa.nejblizsi_obec(p.x, p.z) == "Vnitřní Město", "čtvrť je Vnitřní Město")
	var ulice := Mapa.nejblizsi_ulice(p.x, p.z, 45.0, 14)
	over(ulice.get("nazev", "") == "náměstí Republiky", "nejbližší ulice je náměstí Republiky (%s)" % ulice.get("nazev", ""))
	over(absi(Mapa.nadmorska_vyska(p.y) - 313) <= 2, "nadmořská výška %d m" % Mapa.nadmorska_vyska(p.y))
	await snimek("01-start-namesti")

	krok("Chůze ke zaparkovanému autu")
	var auto := hra.auto_hrace
	over(auto != null, "u startu stojí auto")
	var t := 0.0
	var start_pos := hra.chodec.global_position
	while hra.chodec.global_position.distance_to(auto.global_position) > 3.0 and t < 30.0:
		var k := auto.global_position - hra.chodec.global_position
		hra.kamera.yaw = atan2(k.x, k.z)
		Vstup.dotyk_pohyb = Vector2(0, 1)
		await get_tree().physics_frame
		t += 1.0 / Engine.physics_ticks_per_second
	Vstup.dotyk_pohyb = Vector2.ZERO
	var usel := hra.chodec.global_position.distance_to(start_pos)
	over(hra.chodec.global_position.distance_to(auto.global_position) <= 3.0, "hráč došel k autu za %.1f s (%.1f m)" % [t, usel])
	await snimek("02-u-auta")

	krok("Nástup do auta")
	hra._akce("nastoupit")
	await cekej(0.5)
	over(hra.rezim == "auto", "hráč sedí v autě")
	over(auto.ridi_hrac, "auto řídí hráč")

	krok("Nájezd na Wilsonův most (auto přeneseno na Americkou, 60 m před mostem)")
	auto.global_transform = Transform3D(Basis.looking_at(Vector3(-1, 0, 0), Vector3.UP), Vector3(110, Mapa.vyska(110, 458.6) + 0.4, 458.6))
	auto.linear_velocity = Vector3.ZERO
	auto.angular_velocity = Vector3.ZERO
	await cekej_na_svet()
	await cekej(1.0)
	await snimek("03-pred-mostem")

	krok("Jízda přes most na východ")
	var nejnizsi_na_moste := INF
	var max_rychlost := 0.0
	t = 0.0
	var cil := Vector3(330, 0, 457.3)
	while auto.global_position.x < 300.0 and t < 40.0:
		var pa := auto.global_position
		var smer := (cil - pa)
		smer.y = 0
		var vpred := auto.global_basis.z
		vpred.y = 0
		var chyba := atan2(vpred.cross(smer.normalized()).y, vpred.normalized().dot(smer.normalized()))
		var plyn := 0.7 if auto.rychlost_kmh() < 45.0 else 0.0
		Vstup.dotyk_pohyb = Vector2(-clampf(chyba * 2.5, -1, 1), plyn)
		if pa.x > 175.0 and pa.x < 230.0:
			nejnizsi_na_moste = minf(nejnizsi_na_moste, pa.y)
		max_rychlost = maxf(max_rychlost, auto.rychlost_kmh())
		if absf(pa.x - 200.0) < 1.5:
			await snimek("04-na-moste")
		await get_tree().physics_frame
		t += 1.0 / Engine.physics_ticks_per_second
	over(auto.global_position.x >= 300.0, "auto přejelo most a dojelo na x = %.0f za %.1f s" % [auto.global_position.x, t])
	over(nejnizsi_na_moste > MOSTOVKA - 1.0, "auto zůstalo na mostovce (nejnižší bod %.2f m, mostovka %.2f, dno %.1f)" % [nejnizsi_na_moste, MOSTOVKA, DNO_REKY])
	over(max_rychlost > 30.0, "auto se rozjelo na %.0f km/h" % max_rychlost)

	krok("Zastavení a cesta zpět na most")
	Vstup.dotyk_pohyb = Vector2(0, -1)
	await cekej(2.0)
	Vstup.dotyk_pohyb = Vector2.ZERO
	# otočit a dojet doprostřed mostu
	auto.global_transform = Transform3D(Basis.looking_at(Vector3(1, 0, 0), Vector3.UP), Vector3(260, Mapa.vyska(260, 456.5) + 0.4, 456.5))
	auto.linear_velocity = Vector3.ZERO
	await cekej(1.0)
	t = 0.0
	while auto.global_position.x > 205.0 and t < 20.0:
		Vstup.dotyk_pohyb = Vector2(0, 0.4 if auto.rychlost_kmh() < 15.0 else 0.0)
		await get_tree().physics_frame
		t += 1.0 / Engine.physics_ticks_per_second
	Vstup.dotyk_pohyb = Vector2(0, -1)
	await cekej(1.5)
	Vstup.dotyk_pohyb = Vector2.ZERO
	await cekej(0.5)
	over(auto.rychlost_kmh() < 5.0, "auto zastavilo na mostě (x %.0f, %.0f km/h)" % [auto.global_position.x, auto.rychlost_kmh()])

	krok("Výstup na mostě")
	hra._akce("nastoupit")
	await cekej(0.5)
	over(hra.rezim == "pesky", "hráč vystoupil")
	var pc := hra.chodec.global_position
	over(absf(pc.y - MOSTOVKA) < 0.8, "hráč stojí na mostovce (y %.2f)" % pc.y)
	await snimek("05-vystup-na-moste")

	krok("Chůze po mostě k západnímu břehu")
	hra.kamera.yaw = -PI / 2.0
	Vstup.dotyk_pohyb = Vector2(0, 1)
	var nejnizsi_chodec := INF
	t = 0.0
	while hra.chodec.global_position.x > 165.0 and t < 30.0:
		hra.kamera.yaw = atan2(165.0 - hra.chodec.global_position.x, 461.0 - hra.chodec.global_position.z)
		nejnizsi_chodec = minf(nejnizsi_chodec, hra.chodec.global_position.y)
		await get_tree().physics_frame
		t += 1.0 / Engine.physics_ticks_per_second
	Vstup.dotyk_pohyb = Vector2.ZERO
	over(hra.chodec.global_position.x <= 165.0, "hráč přešel most pěšky za %.1f s" % t)
	over(nejnizsi_chodec > MOSTOVKA - 1.0, "hráč nespadl do řeky (nejnižší bod %.2f m)" % nejnizsi_chodec)
	await snimek("06-zapadni-breh")
