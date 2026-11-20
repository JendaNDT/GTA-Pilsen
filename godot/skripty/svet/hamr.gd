class_name Hamr
extends Node3D
## Vodní hamr v Dobřívě (src/world/mill.js): model z převodníku, kolize budovy a čtyři lopatková
## kola, která se od 9 do 17 hodin točí rychlostí 0,72 rad/s (updateForge v předloze).

const SOUBOR := "hamr.bin"
const RYCHLOST := 0.72
const DOSAH := 1400.0            ## postaví se, když je hráč blíž než 1,4 km

var sledovat: Node3D
var hodina := 12.0
var uhel := 0.0
var _stred := Vector2.ZERO
var _data: Dictionary = {}
var _kola: Array[Node3D] = []
var _postaveno := false


func _ready() -> void:
	var surova := FileAccess.get_file_as_bytes(Mapa.SLOZKA + SOUBOR)
	if surova.is_empty():
		return
	_data = bytes_to_var(surova.decompress_dynamic(-1, FileAccess.COMPRESSION_DEFLATE))
	_stred = Vector2(_data.stred[0], _data.stred[1])


func _mesh(cast: Dictionary) -> ArrayMesh:
	var a := []
	a.resize(Mesh.ARRAY_MAX)
	a[Mesh.ARRAY_VERTEX] = cast.v
	a[Mesh.ARRAY_NORMAL] = cast.n
	var barvy: PackedColorArray = cast.c
	var lin := PackedColorArray()
	lin.resize(barvy.size())
	for k in barvy.size():
		lin[k] = barvy[k]
	a[Mesh.ARRAY_COLOR] = lin
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, a)
	return m


func _postav() -> void:
	_postaveno = true
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.85
	var voda := StandardMaterial3D.new()
	voda.albedo_color = Color(0.28, 0.38, 0.4, 0.85)
	voda.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	voda.roughness = 0.1
	var telo := StaticBody3D.new()
	telo.collision_layer = Hra.VRSTVA_SVET
	add_child(telo)
	for cast: Dictionary in _data.casti:
		var mi := MeshInstance3D.new()
		mi.mesh = _mesh(cast)
		var druh := str(cast.druh)
		mi.material_override = voda if druh == "voda" else (_svetlo() if druh == "svetlo" else mat)
		add_child(mi)
		# kolize: obvodové zdi a střecha (blízký plášť), voda a drobnosti ne
		if druh == "blizko":
			var cs := CollisionShape3D.new()
			var tvar := ConcavePolygonShape3D.new()
			tvar.set_faces(cast.v)
			cs.shape = tvar
			telo.add_child(cs)
	if _data.kolo != null:
		var casti: Array = _data.kolo
		for e: PackedFloat32Array in _data.osy:
			var osa := Node3D.new()
			# matrixWorld z three.js (sloupce) → Transform3D
			osa.transform = Transform3D(Basis(Vector3(e[0], e[1], e[2]), Vector3(e[4], e[5], e[6]), Vector3(e[8], e[9], e[10])),
				Vector3(e[12], e[13], e[14]))
			add_child(osa)
			var kolo := Node3D.new()
			osa.add_child(kolo)
			for cast: Dictionary in casti:
				var mi := MeshInstance3D.new()
				mi.mesh = _mesh(cast)
				mi.material_override = mat
				kolo.add_child(mi)
			_kola.append(kolo)


## Svítící okna a lampa hamru.
func _svetlo() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	return m


## Kola se točí v pracovní době hamru.
func pracuje() -> bool:
	return hodina >= 9.0 and hodina < 17.0


func _process(delta: float) -> void:
	if _data.is_empty() or sledovat == null:
		return
	var p := sledovat.global_position
	if not _postaveno:
		if Vector2(p.x, p.z).distance_to(_stred) < DOSAH:
			_postav()
		return
	if pracuje():
		uhel = fmod(uhel + delta * RYCHLOST, TAU)
	for k in _kola:
		k.rotation.x = uhel
