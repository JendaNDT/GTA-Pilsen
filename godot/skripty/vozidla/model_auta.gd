class_name ModelAuta
extends RefCounted
## Vzhled auta skládaný z kvádrů (spodek, kapota, kabina se skly, světla, kola).
## Model je samostatný uzel „Model“, aby ho šlo v editoru nahradit vlastním 3D modelem.

const SKLO := Color(0.09, 0.12, 0.15)
const TMAVA := Color(0.07, 0.07, 0.08)


static func _mat(barva: Color, drsnost := 0.35, kov := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = barva
	m.roughness = drsnost
	m.metallic = kov
	return m


static func _box(rodic: Node3D, jmeno: String, velikost: Vector3, pozice: Vector3, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.name = jmeno
	var b := BoxMesh.new()
	b.size = velikost
	b.material = mat
	mi.mesh = b
	mi.position = pozice
	rodic.add_child(mi)
	return mi


## Sdílené materiály reflektorů a koncových světel (v noci svítí všem autům najednou).
static var mat_predni: StandardMaterial3D
static var mat_zadni: StandardMaterial3D


static func _svetla() -> void:
	if mat_predni:
		return
	mat_predni = _mat(Color(1.0, 0.97, 0.88), 0.2)
	mat_predni.emission_enabled = true
	mat_predni.emission = Color(0.9, 0.85, 0.7)
	mat_predni.emission_energy_multiplier = 0.4
	mat_zadni = _mat(Color(0.7, 0.05, 0.04), 0.3)
	mat_zadni.emission_enabled = true
	mat_zadni.emission = Color(0.6, 0.02, 0.02)
	mat_zadni.emission_energy_multiplier = 0.3


## Svícení podle noci (0 den, 1 noc): auta rozsvítí, když je noc nad 0,25 (vehicles.js).
static func nastav_noc(noc: float) -> void:
	_svetla()
	var sviti := noc > 0.25
	mat_predni.emission_energy_multiplier = 2.6 if sviti else 0.4
	mat_zadni.emission_energy_multiplier = 1.3 if sviti else 0.3


static func karoserie(spec: Dictionary, barva: Color, typ: String) -> Node3D:
	_svetla()
	var m := Node3D.new()
	m.name = "Model"
	var L: float = spec.len
	var W: float = spec.wid
	var H: float = spec.h
	var hood: float = spec.hood
	var lak := _mat(barva, 0.28, 0.35)
	var sklo := _mat(SKLO, 0.08, 0.2)
	var tmava := _mat(TMAVA, 0.8)
	var spodek := 0.32
	var telo_h := H * 0.42
	_box(m, "Spodek", Vector3(W, telo_h, L), Vector3(0, spodek + telo_h / 2.0, 0), lak)
	_box(m, "Prah", Vector3(W * 1.01, 0.12, L * 0.98), Vector3(0, spodek + 0.04, 0), tmava)
	var kabina_l := L - hood - (0.45 if typ == "hatch" else 0.9)
	var kabina_z := (L / 2.0 - hood) - kabina_l / 2.0
	var kabina_h := H - spodek - telo_h
	if typ == "van":
		kabina_l = L - hood - 0.1
		kabina_z = (L / 2.0 - hood) - kabina_l / 2.0
	_box(m, "Kabina", Vector3(W * 0.92, kabina_h, kabina_l), Vector3(0, spodek + telo_h + kabina_h / 2.0, kabina_z), lak)
	_box(m, "CelniSklo", Vector3(W * 0.86, kabina_h * 0.78, 0.04), Vector3(0, spodek + telo_h + kabina_h * 0.45, kabina_z + kabina_l / 2.0 + 0.01), sklo)
	_box(m, "ZadniSklo", Vector3(W * 0.84, kabina_h * 0.7, 0.04), Vector3(0, spodek + telo_h + kabina_h * 0.45, kabina_z - kabina_l / 2.0 - 0.01), sklo)
	for strana: int in [1, -1]:
		_box(m, "BocniSklo%d" % strana, Vector3(0.04, kabina_h * 0.66, kabina_l * 0.86),
			Vector3(strana * W * 0.465, spodek + telo_h + kabina_h * 0.45, kabina_z), sklo)
		_box(m, "Svetlo%d" % strana, Vector3(0.32, 0.12, 0.05), Vector3(strana * W * 0.34, spodek + telo_h * 0.7, L / 2.0 + 0.01), mat_predni)
		_box(m, "Koncove%d" % strana, Vector3(0.28, 0.12, 0.05), Vector3(strana * W * 0.36, spodek + telo_h * 0.72, -L / 2.0 - 0.01), mat_zadni)
	if typ == "taxi":
		_box(m, "TaxiCedule", Vector3(0.6, 0.18, 0.25), Vector3(0, H + 0.09, kabina_z), _mat(Color(0.95, 0.8, 0.15), 0.4))
	if typ == "policie":
		_box(m, "Majak", Vector3(0.9, 0.12, 0.25), Vector3(0, H + 0.06, kabina_z), _mat(Color(0.15, 0.3, 0.9), 0.3))
	return m


static func kolo(polomer: float) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.name = "Pneumatika"
	var c := CylinderMesh.new()
	c.top_radius = polomer
	c.bottom_radius = polomer
	c.height = 0.21
	c.radial_segments = 14
	c.rings = 1
	c.material = _mat(Color(0.06, 0.06, 0.06), 0.9)
	mi.mesh = c
	mi.rotation.z = PI / 2.0
	var disk := MeshInstance3D.new()
	var d := CylinderMesh.new()
	d.top_radius = polomer * 0.6
	d.bottom_radius = polomer * 0.6
	d.height = 0.22
	d.radial_segments = 10
	d.rings = 1
	d.material = _mat(Color(0.6, 0.62, 0.64), 0.3, 0.6)
	disk.mesh = d
	mi.add_child(disk)
	return mi
