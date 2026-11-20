class_name Postava
extends Node3D
## Postava z jednoduchých dílů s klouby (stehna, lýtka, paže, předloktí). Pohyb končetin odpovídá
## animatePed v src/entities/models.js. Postava stojí na y = 0 a dívá se ve směru +Z.

const KUZE := Color(0.87, 0.69, 0.56)

@export var oblecek := Color(0.18, 0.32, 0.55)
@export var kalhoty := Color(0.16, 0.17, 0.2)
@export var vlasy := Color(0.22, 0.15, 0.1)

var faze := 0.0
var _klouby := {}
var _trup: Node3D


func _ready() -> void:
	_postav()


func _dil(rodic: Node3D, jmeno: String, pozice: Vector3, velikost: Vector3, posun: Vector3, barva: Color) -> Node3D:
	var kloub := Node3D.new()
	kloub.name = jmeno
	kloub.position = pozice
	rodic.add_child(kloub)
	var mi := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = velikost
	var mat := StandardMaterial3D.new()
	mat.albedo_color = barva
	mat.roughness = 0.85
	box.material = mat
	mi.mesh = box
	mi.position = posun
	kloub.add_child(mi)
	_klouby[jmeno] = kloub
	return kloub


func _postav() -> void:
	_trup = _dil(self, "trup", Vector3(0, 0.95, 0), Vector3(0.42, 0.56, 0.24), Vector3(0, 0.28, 0), oblecek)
	_dil(_trup, "hlava", Vector3(0, 0.62, 0), Vector3(0.22, 0.25, 0.24), Vector3(0, 0.1, 0), KUZE)
	_dil(_klouby["hlava"], "vlasy", Vector3(0, 0.2, -0.01), Vector3(0.23, 0.07, 0.25), Vector3.ZERO, vlasy)
	for strana: int in [1, -1]:
		var s := str(strana)
		var paze := _dil(_trup, "paze" + s, Vector3(strana * 0.27, 0.52, 0), Vector3(0.11, 0.32, 0.12),
			Vector3(0, -0.15, 0), oblecek)
		_dil(paze, "predlokti" + s, Vector3(0, -0.3, 0), Vector3(0.1, 0.3, 0.11), Vector3(0, -0.14, 0), KUZE)
		var stehno := _dil(self, "stehno" + s, Vector3(strana * 0.11, 0.93, 0), Vector3(0.16, 0.46, 0.18),
			Vector3(0, -0.22, 0), kalhoty)
		var lytko := _dil(stehno, "lytko" + s, Vector3(0, -0.45, 0), Vector3(0.14, 0.44, 0.16), Vector3(0, -0.21, 0), kalhoty)
		_dil(lytko, "bota" + s, Vector3(0, -0.45, 0.04), Vector3(0.13, 0.07, 0.26), Vector3.ZERO, Color(0.1, 0.09, 0.08))


## Pohyb končetin: rychlost v m/s (0 = stání).
func animuj(delta: float, rychlost: float) -> void:
	if _trup == null:
		return
	faze += delta * (3.0 + rychlost * 2.2)
	var mira := minf(1.0, rychlost / 3.0)
	var houpani := sin(faze) * mira
	for strana: int in [1, -1]:
		var s := str(strana)
		var h := houpani * strana
		_klouby["stehno" + s].rotation.x = h * 0.65
		_klouby["lytko" + s].rotation.x = maxf(0.0, -h) * 0.66
		_klouby["paze" + s].rotation.x = -h * 0.58
		_klouby["predlokti" + s].rotation.x = -maxf(0.0, h) * 0.32
	_trup.position.y = 0.95 + absf(houpani) * 0.025
