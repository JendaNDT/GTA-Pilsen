extends Scenar
## Cesta MHD: pěšky na zastávku u náměstí Republiky, odjezdy na tabuli, příjezd spoje, nástup,
## jízda na příští zastávku a výstup. Spuštění: godot --headless --path godot testy/scenar_mhd.tscn

const DEN_ZKOUSKY := "2026-11-20"     ## pátek, platí pracovní jízdní řád


func _jdi_k(cil: Vector3, blizko := 2.5, limit := 60.0) -> float:
	var t := 0.0
	while Vector2(hra.chodec.global_position.x - cil.x, hra.chodec.global_position.z - cil.z).length() > blizko and t < limit:
		var k := cil - hra.chodec.global_position
		hra.kamera.yaw = atan2(k.x, k.z)
		Vstup.dotyk_pohyb = Vector2(0, 1)
		await get_tree().physics_frame
		t += 1.0 / Engine.physics_ticks_per_second
	Vstup.dotyk_pohyb = Vector2.ZERO
	return t


func scenar() -> void:
	krok("Start a herní čas: pátek 9:50")
	await cekej_na_svet()
	hra.nastav_cas(9.0 + 50.0 / 60.0, JizdniRad.den_z_textu(DEN_ZKOUSKY))
	await cekej(0.5)
	var jr := hra.mhd.jr
	over(jr != null and jr.trasy.size() > 300, "jízdní řád načten (%d tras)" % (jr.trasy.size() if jr else 0))
	var nej_i := -1
	var nej_cas := INF
	for i in jr.stanoviste.size():
		var st: Array = jr.stanoviste[i]
		if Vector2(st[1], st[2]).distance_to(Hra.START) > 160.0:
			continue
		var o := jr.odjezdy(i, hra.ted() + 90.0, 1800.0, 1)
		if not (o.radky as Array).is_empty() and o.radky[0].cas < nej_cas:
			nej_cas = o.radky[0].cas
			nej_i = i
	over(nej_i >= 0, "u náměstí odjíždí spoj do 30 minut")
	var st: Array = jr.stanoviste[nej_i]
	var radek: Dictionary = jr.odjezdy(nej_i, hra.ted() + 90.0, 1800.0, 1).radky[0]
	print("  zastávka %s (%s), odjezd %s linka %s → %s" % [st[0], st[3], JizdniRad.format_cas(radek.cas), radek.linka, radek.cil])

	krok("Pěší cesta k zastávce")
	var zastavka := Vector3(st[1], 0, st[2])
	var t := await _jdi_k(zastavka, 3.0)
	over(Vector2(hra.chodec.global_position.x - st[1], hra.chodec.global_position.z - st[2]).length() <= 3.0,
		"hráč došel na zastávku %s za %.0f s" % [st[0], t])
	await cekej(1.2)
	over(hra.hud.text_odjezdu().contains(st[0]), "tabule ukazuje odjezdy ze zastávky")
	await snimek("01-zastavka-odjezdy")

	krok("Čekání na spoj")
	hra.nastav_cas(fposmod(radek.cas - 50.0, JizdniRad.DEN) / 3600.0)
	var vuz: VuzMhd = null
	t = 0.0
	while vuz == null and t < 120.0:
		await get_tree().physics_frame
		t += 1.0 / Engine.physics_ticks_per_second
		for v: VuzMhd in hra.mhd.vozy.values():
			if v.dvere_otevrene and v.linka == radek.linka and v.cil == radek.cil:
				vuz = v
	over(vuz != null, "přijel spoj %s → %s a otevřel dveře" % [radek.linka, radek.cil])
	if vuz == null:
		return
	# dojít ke dveřím
	await _jdi_k(vuz.misto_dveri(1.0), 1.0, 15.0)
	await snimek("02-prijezd")

	krok("Nástup")
	hra._akce("nastoupit")
	await cekej(0.3)
	over(hra.rezim == "mhd" and hra.jizda == vuz, "hráč nastoupil do vozu %s" % vuz.nazev_spoje())
	var prvni := vuz.index

	krok("Jízda na příští zastávku")
	Engine.time_scale = 4.0
	t = 0.0
	var start_pos := vuz.clanky[0].global_position
	while not (vuz.index > prvni and vuz.dvere_otevrene) and t < 600.0:
		await get_tree().physics_frame
		t += 1.0 / Engine.physics_ticks_per_second * Engine.time_scale
	Engine.time_scale = 1.0
	var ujeto := vuz.clanky[0].global_position.distance_to(start_pos)
	var stanice := vuz.pristi_zastavka()
	over(vuz.index > prvni and vuz.dvere_otevrene, "vůz dojel na zastávku %s (%.0f m, %.0f s herního času)" % [stanice, ujeto, t])
	await snimek("03-ve-voze")

	krok("Výstup")
	hra._akce("nastoupit")
	await cekej(0.5)
	over(hra.rezim == "pesky", "hráč vystoupil")
	var p := hra.chodec.global_position
	var blizko := INF
	for i in jr.stanoviste.size():
		if jr.stanoviste[i][0] == stanice:
			blizko = minf(blizko, Vector2(jr.stanoviste[i][1] - p.x, jr.stanoviste[i][2] - p.z).length())
	over(blizko < 30.0, "hráč stojí u zastávky %s (%.1f m od stanoviště)" % [stanice, blizko])
	await cekej(1.0)
	var zem := Mapa.vyska(p.x, p.z)
	over(hra.chodec.global_position.y > zem - 0.5 and hra.chodec.is_on_floor(), "hráč stojí na zemi")
	await snimek("04-vystup")
