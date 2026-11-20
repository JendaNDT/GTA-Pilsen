extends Node3D
## Nárazové zkoušky fyziky na fiktivní zkušební ploše (mimo mapu Plzně):
## ulomení lampy, odstrčení zaparkovaného auta, náraz do zdi a nepojízdné auto po těžké havárii.
##   godot --headless --path godot testy/zkusebna.tscn

var chyby := 0
var auto: Auto


func over(ok: bool, popis: String) -> void:
	print(("  ✓ " if ok else "  ✗ ") + popis)
	if not ok:
		chyby += 1


func _box(velikost: Vector3, pozice: Vector3) -> StaticBody3D:
	var b := StaticBody3D.new()
	b.collision_layer = Hra.VRSTVA_SVET
	var cs := CollisionShape3D.new()
	var tvar := BoxShape3D.new()
	tvar.size = velikost
	cs.shape = tvar
	b.add_child(cs)
	var mi := MeshInstance3D.new()
	var m := BoxMesh.new()
	m.size = velikost
	mi.mesh = m
	b.add_child(mi)
	add_child(b)
	b.global_position = pozice
	return b


func _auto(typ: String, pozice: Vector3, ridi: bool) -> Auto:
	var a := Auto.new()
	a.typ = typ
	a.ridi_hrac = ridi
	a.collision_layer = Hra.VRSTVA_VOZIDLA
	a.collision_mask = Hra.VRSTVA_SVET | Hra.VRSTVA_VOZIDLA
	add_child(a)
	a.global_position = pozice
	return a


func cekej(s: float) -> void:
	for k in int(s * Engine.physics_ticks_per_second):
		await get_tree().physics_frame


## Rozjede auto na rychlost (km/h) po ose +Z ze startu.
func rozjed(start: Vector3, kmh: float) -> void:
	auto.global_transform = Transform3D(Basis.IDENTITY, start)
	auto.linear_velocity = Vector3(0, 0, kmh / 3.6)
	auto.angular_velocity = Vector3.ZERO
	Vstup.dotyk_pohyb = Vector2(0, 0.0)


func _ready() -> void:
	_box(Vector3(600, 1, 600), Vector3(0, -0.5, 0))
	var zed := _box(Vector3(12, 3, 1), Vector3(0, 1.5, 120))
	var lampa := Zlomitelny.new()
	lampa.id = "zkouska/lampa"
	lampa.vyska = 7.0
	add_child(lampa)
	lampa.global_position = Vector3(-30, 0, 40)
	var zaparkovane := _auto("sedan", Vector3(30, 0.4, 40), false)
	auto = _auto("hatch", Vector3(0, 0.4, 0), true)
	await cekej(1.0)

	print("— Ulomení lampy při 50 km/h")
	rozjed(Vector3(-30, 0.4, 0), 50.0)
	await cekej(3.5)
	over(not is_instance_valid(lampa) or lampa.is_queued_for_deletion(), "lampa se ulomila")
	over(Zlomitelny.ulomene.has("zkouska/lampa"), "ulomení je zaznamenané do ranní opravy")
	var padajici := 0
	for n in get_children():
		if n is RigidBody3D and not n is Auto:
			padajici += 1
			over(n.global_basis.y.y < 0.9 or n.linear_velocity.length() > 0.5, "sloup padá nebo leží (svislost %.2f)" % n.global_basis.y.y)
	over(padajici == 1, "z lampy vzniklo padající těleso")
	over(auto.rychlost_kmh() > 15.0, "auto po ulomení lampy jede dál (%.0f km/h)" % auto.rychlost_kmh())

	print("— Odstrčení zaparkovaného auta při 25 km/h")
	var p0 := zaparkovane.global_position
	auto.poskozeni = 0.0
	rozjed(Vector3(30, 0.4, 25), 25.0)
	await cekej(3.0)
	var posun := zaparkovane.global_position.distance_to(p0)
	over(posun > 0.5, "zaparkované auto se posunulo o %.1f m" % posun)
	over(auto.poskozeni > 0.0 and auto.poskozeni < 60.0, "lehký náraz: poškození %.0f %%" % auto.poskozeni)

	print("— Náraz do zdi při 50 km/h")
	auto.opravit()
	rozjed(Vector3(0, 0.4, 95), 50.0)
	await cekej(4.0)
	over(auto.global_position.z < zed.global_position.z - 0.5, "auto neprojelo zdí (z %.1f, zeď %.1f)" % [auto.global_position.z, zed.global_position.z])
	over(auto.rychlost_kmh() < 5.0, "auto se o zeď zastavilo (%.0f km/h)" % auto.rychlost_kmh())
	over(auto.poskozeni > 20.0, "poškození po nárazu %.0f %%" % auto.poskozeni)

	print("— Těžká havárie při 110 km/h")
	auto.opravit()
	rozjed(Vector3(0, 0.4, 60), 110.0)
	await cekej(4.0)
	over(auto.global_position.z < zed.global_position.z - 0.5, "ani ve 110 km/h auto neprojelo zdí")
	over(auto.poskozeni >= 100.0, "auto je zničené (%.0f %%)" % auto.poskozeni)
	auto.global_transform = Transform3D(Basis.IDENTITY, Vector3(-40, 0.4, 0))
	auto.linear_velocity = Vector3.ZERO
	await cekej(0.5)
	Vstup.dotyk_pohyb = Vector2(0, 1)
	await cekej(3.0)
	Vstup.dotyk_pohyb = Vector2.ZERO
	over(auto.rychlost_kmh() < 2.0, "zničené auto se už nerozjede (%.1f km/h)" % auto.rychlost_kmh())
	print("VÝSLEDEK: ", "PROŠLO" if chyby == 0 else "SELHALO (%d)" % chyby)
	get_tree().quit(0 if chyby == 0 else 1)
