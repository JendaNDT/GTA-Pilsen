class_name VozProvozu
extends Node3D
## Auto v provozu. Jede po hraně silničního grafu v pravém pruhu, pohyb počítá Doprava.
## Kolizní těleso je kinematické; po nárazu hráčova auta se vůz mění na fyzikální Auto.

var typ := "sedan"
var barva := Color.WHITE
var hrana := -1
var dalsi := -1               ## příští hrana (rozhodnutá předem kvůli zatáčce a semaforu)
var s := 0.0                  ## poloha na hraně od jejího začátku (m)
var bok := 1.8                ## posun od osy silnice vpravo (m)
var rychlost := 0.0           ## m/s
var cestovni := 13.0          ## přání řidiče (m/s)
var stoji_u_stopky := 0.0
var projel_stopku := -1.0
var telo: AnimatableBody3D
var delka := 4.6


func priprav(t: String, b: Color) -> void:
	typ = t
	barva = b
	var spec: Dictionary = Auto.TYPY.get(typ, Auto.TYPY.sedan)
	delka = spec.len
	add_child(ModelAuta.karoserie(spec, barva, typ))
	for z in [delka * 0.32, -delka * 0.32]:
		for x in [-spec.wid * 0.42, spec.wid * 0.42]:
			var k := ModelAuta.kolo(0.31)
			k.position = Vector3(x, 0.31, z)
			add_child(k)
	telo = AnimatableBody3D.new()
	telo.sync_to_physics = false
	telo.collision_layer = Hra.VRSTVA_VOZIDLA
	telo.collision_mask = 0
	telo.set_meta("vuz_provozu", self)
	var cs := CollisionShape3D.new()
	var tvar := BoxShape3D.new()
	tvar.size = Vector3(spec.wid, spec.h * 0.8, delka)
	cs.shape = tvar
	cs.position.y = 0.32 + spec.h * 0.4
	telo.add_child(cs)
	add_child(telo)
