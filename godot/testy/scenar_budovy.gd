extends Scenar
## Budovy: kreslí se z obou stran, stěny mají kolizi, hráč se nedostane dovnitř chůzí, startem ani
## výstupem z auta, a zevnitř nevidí ven. Spuštění: godot --headless --path godot testy/scenar_budovy.tscn
## (pohled zevnitř se ověří jen s vykreslováním, např. přes xvfb-run).

const PRAZSKA := Vector2(-20, 120)      ## ulice v měřeném modelu centra
const SOLNI := Vector2(-120, -40)       ## bod uvnitř domu v centru
const SLOVANY := Vector2(1100, 900)     ## bod uvnitř domu mimo centrum
const DOUBRAVKA := Vector2(2400, -600)  ## běžné budovy z OpenStreetMap


func _init() -> void:
	_limit = 900.0


func _presun(p: Vector2) -> void:
	hra.svet.postav_hned(p, 300.0)
	hra.chodec.postav_na(p.x, p.y)
	await cekej(1.5)


## Hráč jde kolmo proti stěně ve směru uhel; vrací [vzdálenost stěny, ušlá vzdálenost, skupina] nebo [].
func _proti_stene(start: Vector2, uhel: float) -> Array:
	var s := Vector3(sin(uhel), 0, cos(uhel))
	var h := Vector3(start.x, Mapa.vyska(start.x, start.y) + 1.2, start.y)
	var z := hra._paprsek(h, h + s * 40.0)
	var skupina := hra._skupina(z)
	if not skupina in ["mesto", "budovy"]:
		return []
	var vzd := Vector2(z.position.x - start.x, z.position.z - start.y).length()
	hra.chodec.postav_na(start.x, start.y)
	await cekej(0.2)
	var t := 0.0
	var proslo := false
	var minule := hra.chodec.global_position
	while t < (vzd + 6.0) / Chodec.CHUZE:
		hra.chodec.smer_kamery = uhel
		Vstup.dotyk_pohyb = Vector2(0, 1)
		await get_tree().physics_frame
		t += 1.0 / Engine.physics_ticks_per_second
		# prošel stěnou: mezi minulou a novou polohou (ve výšce pasu) leží plocha budovy
		var ted := hra.chodec.global_position
		if hra._zed_mezi(minule + Vector3(0, 1.0, 0), ted + Vector3(0, 1.0, 0)):
			proslo = true
		minule = ted
	Vstup.dotyk_pohyb = Vector2.ZERO
	var p := hra.chodec.global_position
	return [vzd, (p - Vector3(start.x, p.y, start.y)).dot(s), skupina, proslo]


func scenar() -> void:
	krok("Budovy se kreslí z obou stran a mají oboustranné kolize")
	await cekej_na_svet()
	await _presun(PRAZSKA)
	var site := 0
	var jednostranne := 0
	for n in hra.svet.find_children("*", "MeshInstance3D", true, false):
		if n.name in ["MestoZamerene", "Budovy"]:
			site += 1
			var m: Material = (n as MeshInstance3D).mesh.surface_get_material(0)
			# líc (cull_back) a rub jako druhý průchod (cull_front)
			if not (m is ShaderMaterial and m.next_pass is ShaderMaterial and \
					(m.next_pass as ShaderMaterial).shader.code.contains("cull_front")):
				jednostranne += 1
	over(site > 10 and jednostranne == 0, "%d sítí budov, všechny kreslené z obou stran" % site)
	var tvaru := 0
	var bez_rubu := 0
	for n in hra.svet.find_children("*", "CollisionShape3D", true, false):
		if n.name in ["mesto", "budovy"]:
			tvaru += 1
			if not ((n as CollisionShape3D).shape as ConcavePolygonShape3D).backface_collision:
				bez_rubu += 1
	over(tvaru > 10 and bez_rubu == 0, "%d kolizních tvarů budov, všechny oboustranné" % tvaru)

	krok("Chůze proti stěnám měřených i běžných budov")
	for zkouska: Array in [[PRAZSKA, 0.0, "Pražská"], [PRAZSKA, PI, "Pražská"]]:
		var r := await _proti_stene(zkouska[0], zkouska[1])
		over(not r.is_empty() and not r[3] and not hra.uvnitr_budovy(hra.chodec.global_position),
			"%s %d°: stěna (%s) ve %.1f m, hráč zastavil po %.1f m" % [zkouska[2], roundi(rad_to_deg(zkouska[1])),
			r[2] if not r.is_empty() else "—", r[0] if not r.is_empty() else 0.0, r[1] if not r.is_empty() else 0.0])
	await _presun(DOUBRAVKA)
	var osm := 0
	for k in 8:
		var r := await _proti_stene(DOUBRAVKA, k * PI / 4.0)
		if r.is_empty() or r[2] != "budovy":
			continue
		osm += 1
		over(not r[3] and not hra.uvnitr_budovy(hra.chodec.global_position),
			"Doubravka %d°: stěna ve %.1f m, hráč stěnou neprošel (posun ve směru %.1f m, u šikmé stěny klouže podél ní)" % [k * 45, r[0], r[1]])
	over(osm >= 2, "u Doubravky se zkoušely %d stěny běžných budov" % osm)

	krok("Hráč nezačne uvnitř budovy")
	for misto: Array in [[SOLNI, "Solní"], [SLOVANY, "Slovany"]]:
		var p: Vector2 = misto[0]
		await _presun(p)
		var uvnitr := hra.uvnitr_budovy(hra.chodec.global_position)
		await hra._zajisti_venku()
		var q := hra.chodec.global_position
		over(uvnitr and not hra.uvnitr_budovy(q) and not hra.ve_zdi(q),
			"%s: bod byl uvnitř domu (%s), hráč přemístěn %.0f m daleko (uvnitř %s, ve zdi %s)" % [misto[1], uvnitr,
			Vector2(q.x - p.x, q.z - p.y).length(), hra.uvnitr_budovy(q), hra.ve_zdi(q)])

	krok("Výstup z auta zaparkovaného těsně u zdi")
	await _presun(PRAZSKA)
	var s := Vector3(0, 0, 1)
	var h := Vector3(PRAZSKA.x, Mapa.vyska(PRAZSKA.x, PRAZSKA.y) + 1.2, PRAZSKA.y)
	var z := hra._paprsek(h, h + s * 40.0)
	var a := hra.auto_hrace
	var W: float = a._spec.wid
	var stred := Vector3(PRAZSKA.x, 0, PRAZSKA.y) + s * (Vector2(z.position.x - PRAZSKA.x, z.position.z - PRAZSKA.y).length() - W / 2.0 - 0.35)
	stred.y = Mapa.vyska(stred.x, stred.z) + 0.4
	# levý bok auta (+X) míří ke zdi
	a.global_transform = Transform3D(Basis(s, Vector3.UP, s.cross(Vector3.UP)), stred)
	a.linear_velocity = Vector3.ZERO
	await cekej(1.0)
	hra.nastoupit(a)
	await cekej(0.5)
	hra._akce("nastoupit")
	await cekej(0.5)
	var p := hra.chodec.global_position
	over(hra.rezim == "pesky" and not hra.uvnitr_budovy(p) and not hra.ve_zdi(p) and (p - stred).dot(s) < 0.0,
		"hráč vystoupil na straně od zdi (%.1f m od středu auta)" % Vector2(p.x - stred.x, p.z - stred.z).length())

	if DisplayServer.get_name() != "headless":
		krok("Zevnitř budovy není vidět ven")
		await _presun(SOLNI)
		hra.hud.visible = false
		hra.mapa.visible = false
		var kam := Camera3D.new()
		hra.add_child(kam)
		kam.current = true
		var nejvic := 0.0
		for k in 4:
			kam.global_transform = Transform3D(Basis(Vector3.UP, k * PI / 2.0), Vector3(SOLNI.x, Mapa.vyska(SOLNI.x, SOLNI.y) + 1.7, SOLNI.y))
			for i in 4:
				await RenderingServer.frame_post_draw
			var img := get_viewport().get_texture().get_image()
			var obloha := 0
			for y in range(0, img.get_height(), 4):
				for x in range(0, img.get_width(), 4):
					var c := img.get_pixel(x, y)
					if c.b > c.r + 0.08 and c.get_luminance() > 0.55:
						obloha += 1
			nejvic = maxf(nejvic, 16.0 * obloha / (img.get_width() * img.get_height()))
			if k == 0:
				await snimek("zevnitr")
		over(nejvic < 0.01, "ve všech 4 směrech je vidět jen budova, obloha nejvýš %.1f %% obrazu" % (nejvic * 100.0))
		kam.queue_free()
