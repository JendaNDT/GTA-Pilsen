class_name Scenar
extends Node
## Základ pro zkoušky herních situací. Scénář spustí hlavní scénu hry, ovládá vstupy jako hráč,
## ověřuje výsledky a na konci ukončí Godot s kódem 0 (vše prošlo) nebo 1 (chyba).
## Snímky se ukládají jen při vykreslování (bez --headless) do složky z parametru --snimky.

var hra: Hra
var chyby := 0
var _snimky := ""
var _limit := 600.0
## Ponechat uložení z předchozího běhu (zkouška restartu).
var zachovat_ulozeni := false


func _ready() -> void:
	var a := OS.get_cmdline_user_args()
	for i in a.size():
		if a[i] == "--snimky" and i + 1 < a.size():
			_snimky = a[i + 1]
	# každá zkouška má vlastní uložení a začíná od začátku
	Ulozeni.soubor = "user://zkouska-%s.json" % name
	if not zachovat_ulozeni:
		Ulozeni.smaz()
	hra = load("res://sceny/hra.tscn").instantiate()
	add_child(hra)
	_hlidac()
	await get_tree().process_frame
	await scenar()
	print("VÝSLEDEK: ", "PROŠLO" if chyby == 0 else "SELHALO (%d)" % chyby)
	get_tree().quit(0 if chyby == 0 else 1)


func _hlidac() -> void:
	await get_tree().create_timer(_limit).timeout
	print("CHYBA: vypršel časový limit zkoušky")
	get_tree().quit(2)


## Přepsat ve scénáři.
func scenar() -> void:
	pass


func over(podminka: bool, popis: String) -> void:
	if podminka:
		print("  ✓ ", popis)
	else:
		chyby += 1
		print("  ✗ ", popis)


func krok(popis: String) -> void:
	print("— ", popis)


func cekej_snimky(n: int) -> void:
	for k in n:
		await get_tree().physics_frame


func cekej(sekund: float) -> void:
	await cekej_snimky(int(sekund * Engine.physics_ticks_per_second))


## Počká, až budou postavené dlaždice v okolí hráče.
func cekej_na_svet(max_sekund := 60.0) -> void:
	var t := 0.0
	while hra.svet.ceka_na_stavbu() > 0 and t < max_sekund:
		await get_tree().process_frame
		t += get_process_delta_time()


func snimek(nazev: String) -> void:
	if _snimky.is_empty() or DisplayServer.get_name() == "headless":
		return
	for k in 3:
		await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	var cesta := _snimky.path_join(nazev + ".png")
	img.save_png(cesta)
	print("  snímek ", cesta)


## Trasa po silnicích z bodu a do bodu b (body x, z) podle grafu.
func trasa(a: Vector3, b: Vector2) -> PackedVector2Array:
	var g := Graf.nacti()
	var cesta: Variant = g.najdi_cestu(g.nejblizsi_uzel(a.x, a.z), g.nejblizsi_uzel(b.x, b.y), 30000)
	var body := PackedVector2Array([Vector2(a.x, a.z)])
	if cesta != null:
		body.append_array(g.body_cesty(cesta))
	body.append(b)
	return body


## Řidič-automat: jede autem po bodech trasy, před zatáčkami zpomalí, při uvíznutí couvne.
## Vrací true, když dojel do 6 m od posledního bodu a zastavil.
func jed_po_trase(auto: Auto, body: PackedVector2Array, max_kmh := 40.0, limit := 600.0) -> bool:
	var i := 0
	var t := 0.0
	var stani := 0.0
	var couvani := 0.0
	var dt := 1.0 / Engine.physics_ticks_per_second
	var konec := body[body.size() - 1]
	while t < limit:
		var p := Vector2(auto.global_position.x, auto.global_position.z)
		var v := auto.rychlost_kmh()
		if p.distance_to(konec) < 6.0:
			Vstup.dotyk_pohyb = Vector2(0, -1)
			if v < 1.0:
				Vstup.dotyk_pohyb = Vector2.ZERO
				return true
			await get_tree().physics_frame
			t += dt
			continue
		# posun na nejbližší bod trasy před autem
		while i < body.size() - 1 and p.distance_to(body[i]) < 9.0:
			i += 1
		var nej := i
		for k in range(i, mini(i + 12, body.size())):
			if p.distance_to(body[k]) < p.distance_to(body[nej]):
				nej = k
		i = nej
		var dohled := 7.0 + auto.rychlost() * 0.9
		var cil := body[i]
		var k2 := i
		var zbyva := dohled
		while k2 < body.size() - 1 and zbyva > 0.0:
			zbyva -= body[k2].distance_to(body[k2 + 1])
			k2 += 1
			cil = body[k2]
		var vpred3 := auto.global_basis.z
		var vpred := Vector2(vpred3.x, vpred3.z).normalized()
		var smer := (cil - p).normalized()
		var chyba := atan2(vpred.x * smer.y - vpred.y * smer.x, vpred.dot(smer))
		# zatáčka 25 m před autem
		var ostra := 0.0
		if k2 + 3 < body.size():
			var d1 := (body[k2] - body[i]).normalized()
			var d2 := (body[mini(k2 + 4, body.size() - 1)] - body[k2]).normalized()
			ostra = absf(d1.angle_to(d2))
		var cilova := max_kmh
		if ostra > 0.5:
			cilova = minf(cilova, 22.0)
		if ostra > 1.0 or absf(chyba) > 0.6:
			cilova = minf(cilova, 13.0)
		if p.distance_to(konec) < 30.0:
			cilova = minf(cilova, 15.0)
		var plyn := 0.0
		if v < cilova - 2.0:
			plyn = 0.75
		elif v > cilova + 4.0:
			plyn = -0.6
		# uvíznutí: couvnout s opačným rejdem
		if couvani > 0.0:
			couvani -= dt
			Vstup.dotyk_pohyb = Vector2(clampf(chyba * 2.0, -1, 1), -0.7)
		else:
			# zatáčení: chyba > 0 = cíl vlevo = rejd vlevo = vstup vlevo (záporné x)
			Vstup.dotyk_pohyb = Vector2(-clampf(chyba * 2.2, -1, 1), plyn)
			if v < 1.0 and plyn > 0.0:
				stani += dt
				if stani > 3.0:
					stani = 0.0
					couvani = 1.6
			else:
				stani = 0.0
		await get_tree().physics_frame
		t += dt
		if fmod(t, 10.0) < dt:
			print("    jízda %.0f s: bod %d/%d, %.0f m do cíle, %.0f km/h" % [t, i, body.size(), p.distance_to(konec), v])
	Vstup.dotyk_pohyb = Vector2.ZERO
	return false
