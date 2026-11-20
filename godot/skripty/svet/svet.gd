@tool
class_name Svet
extends Node3D
## Načítání mapy Plzně po dlaždicích 256 × 256 m kolem sledovaného bodu.
##
## Ve hře sleduje uzel v `sledovat` (hráče nebo vozidlo). V editoru staví náhled kolem bodu
## `nahled_stred`, aby bylo při úpravách scény vidět skutečné okolí. Náhled se do scény neukládá.

signal dlazdice_hotova(ci: int)

@export var sledovat: Node3D
## Poloměr načtení geometrie v metrech.
@export_range(256, 3000, 32) var dohled := 1000.0
## Poloměr, ve kterém mají dlaždice kolize (fyziku).
@export_range(128, 1500, 32) var dosah_kolizi := 520.0
## Kolik milisekund za snímek smí stavba dlaždic zabrat.
@export_range(1, 60) var rozpocet_ms := 10.0
@export var stromy := true

@export_group("Náhled v editoru")
## Střed náhledu v herních souřadnicích (x, z). Mění se tlačítkem „Místo“ nebo ručně.
@export var nahled_stred := Vector2(-42, 52):
	set(v):
		nahled_stred = v
		if Engine.is_editor_hint() and is_inside_tree():
			_vycistit()
@export_range(128, 1500, 32) var nahled_dohled := 500.0
@export var nahled_zapnout := true:
	set(v):
		nahled_zapnout = v
		if Engine.is_editor_hint() and is_inside_tree() and not v:
			_vycistit()

var _dlazdice := {}           # ci -> Dlazdice
var _fronta: Array[int] = []
var _mat_teren: ShaderMaterial
var _mat_asfalt: ShaderMaterial
var _mat_znacky: ShaderMaterial
var _mat_pevne: StandardMaterial3D
var _mat_budovy: ShaderMaterial
var _mat_strom: ShaderMaterial
var _mat_jehlicnan: ShaderMaterial
var _paleta: ImageTexture
var _strom_mesh: Array[Mesh] = []
var _lampa_mesh: Mesh
var _posledni_stred := Vector2(INF, INF)
var _posledni_ci := -2


class Dlazdice:
	var ci := 0
	var uzel: Node3D
	var faze := 0
	var vzdalenost := 0.0
	var kolize: StaticBody3D
	var kolizni_tvary: Array = []
	var hotova := false
	var lampy := PackedFloat32Array()
	var lampy_mm: MultiMesh
	var vybaveni: Node3D


func _ready() -> void:
	if not Mapa.nacti():
		return
	_priprav_materialy()


func _priprav_materialy() -> void:
	var img := Image.create(256, 1, false, Image.FORMAT_RGBAF)
	for k in Mapa.paleta.size():
		img.set_pixel(k, 0, Mapa.paleta[k].srgb_to_linear())
	_paleta = ImageTexture.create_from_image(img)
	_mat_teren = ShaderMaterial.new()
	_mat_teren.shader = load("res://materialy/teren.gdshader")
	_mat_teren.set_shader_parameter("paleta", _paleta)
	_mat_asfalt = ShaderMaterial.new()
	_mat_asfalt.shader = load("res://materialy/silnice.gdshader")
	_mat_asfalt.set_shader_parameter("posun", 0.0012)
	_mat_znacky = ShaderMaterial.new()
	_mat_znacky.shader = load("res://materialy/silnice.gdshader")
	_mat_znacky.set_shader_parameter("posun", 0.0022)
	_mat_znacky.set_shader_parameter("drsnost", 0.7)
	_mat_pevne = StandardMaterial3D.new()
	_mat_pevne.vertex_color_use_as_albedo = true
	_mat_pevne.roughness = 0.9
	_mat_pevne.cull_mode = BaseMaterial3D.CULL_DISABLED
	_mat_budovy = ShaderMaterial.new()
	_mat_budovy.shader = load("res://materialy/budova.gdshader")
	_mat_strom = ShaderMaterial.new()
	_mat_strom.shader = load("res://materialy/strom.gdshader")
	_mat_jehlicnan = ShaderMaterial.new()
	_mat_jehlicnan.shader = _mat_strom.shader
	_mat_jehlicnan.set_shader_parameter("listnaty", false)
	_strom_mesh = [Modely.strom_listnaty(), Modely.strom_jehlicnaty()]
	_lampa_mesh = Modely.lampa()


var _tunely_hotove := false


## Tunel Valík (tubusy, portály, světla) se staví jednou pro celou mapu.
func _postav_tunely() -> void:
	_tunely_hotove = true
	var surova := FileAccess.get_file_as_bytes(Mapa.SLOZKA + "tunely.bin")
	if surova.is_empty():
		return
	var tunely: Array = bytes_to_var(surova.decompress_dynamic(-1, FileAccess.COMPRESSION_DEFLATE))
	var svetla_mat := StandardMaterial3D.new()
	svetla_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	svetla_mat.albedo_color = Color(1.0, 0.92, 0.75)
	svetla_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	for t: Dictionary in tunely:
		var p := Stavba.Plocha.new()
		p.v = t.pevne
		p.c = t.barvy
		p.n = Stavba.ploche_normaly(p.v)
		var mi := _mesh(p, _mat_pevne)
		mi.name = "Tunel_%d" % t.silnice
		add_child(mi)
		var l := Stavba.Plocha.new()
		l.v = t.svetla
		l.n = Stavba.ploche_normaly(l.v)
		l.c.resize(l.v.size())
		l.c.fill(Color.WHITE)
		var ml := _mesh(l, svetla_mat, false)
		add_child(ml)
		if not Engine.is_editor_hint():
			var telo := StaticBody3D.new()
			var cs := CollisionShape3D.new()
			var tvar := ConcavePolygonShape3D.new()
			tvar.backface_collision = true
			tvar.set_faces(p.v)
			cs.shape = tvar
			telo.add_child(cs)
			mi.add_child(telo)


func _process(_delta: float) -> void:
	if not Mapa.nacteno or _mat_teren == null:
		return
	if not _tunely_hotove:
		_postav_tunely()
	var stred: Vector2
	var r: float
	if Engine.is_editor_hint():
		if not nahled_zapnout:
			return
		stred = nahled_stred
		r = nahled_dohled
	else:
		if sledovat == null:
			return
		stred = Vector2(sledovat.global_position.x, sledovat.global_position.z)
		r = dohled
	_aktualizuj(stred, r)


## Okamžitě postaví všechny dlaždice v poloměru (při startu hry nebo v testech).
func postav_hned(stred: Vector2, r: float) -> void:
	if _mat_teren == null:
		_priprav_materialy()
	_aktualizuj(stred, r, 1e9)


func _aktualizuj(stred: Vector2, r: float, rozpocet := -1.0) -> void:
	var ci_stred := Mapa.index_dlazdice(stred.x, stred.y)
	if ci_stred != _posledni_ci or stred.distance_to(_posledni_stred) > 32.0 or rozpocet > 0:
		_posledni_ci = ci_stred
		_posledni_stred = stred
		_naplanuj(stred, r)
	var konec := Time.get_ticks_usec() + int((rozpocet if rozpocet > 0 else rozpocet_ms) * 1000.0)
	while not _fronta.is_empty() and Time.get_ticks_usec() < konec:
		var ci: int = _fronta[0]
		var d: Dlazdice = _dlazdice.get(ci)
		if d == null or d.hotova:
			_fronta.pop_front()
			continue
		_krok(d)
		if d.hotova:
			_fronta.pop_front()
			dlazdice_hotova.emit(ci)
	# kolize jen v blízkosti
	for d: Dlazdice in _dlazdice.values():
		if d.faze >= 1:
			_nastav_kolize(d, d.vzdalenost < dosah_kolizi)


func _naplanuj(stred: Vector2, r: float) -> void:
	var D := Mapa.dlazdice
	var c0 := floori((stred.x - r - Mapa.min_x) / D)
	var c1 := floori((stred.x + r - Mapa.min_x) / D)
	var r0 := floori((stred.y - r - Mapa.min_z) / D)
	var r1 := floori((stred.y + r - Mapa.min_z) / D)
	var chci := {}
	for cz in range(maxi(0, r0), mini(Mapa.radky - 1, r1) + 1):
		for cx in range(maxi(0, c0), mini(Mapa.sloupce - 1, c1) + 1):
			var ci := cz * Mapa.sloupce + cx
			var roh := Mapa.roh_dlazdice(ci)
			var stred_d := roh + Vector2(D, D) * 0.5
			var vzd := maxf(0.0, stred.distance_to(stred_d) - D * 0.7071)
			if vzd <= r:
				chci[ci] = vzd
	# odebrat vzdálené (s rezervou, aby dlaždice na hranici neblikaly)
	for ci: int in _dlazdice.keys():
		var d: Dlazdice = _dlazdice[ci]
		var roh := Mapa.roh_dlazdice(ci)
		d.vzdalenost = maxf(0.0, stred.distance_to(roh + Vector2(D, D) * 0.5) - D * 0.7071)
		if not chci.has(ci) and d.vzdalenost > r + D * 0.5:
			_odeber(d)
	for ci: int in chci:
		if not _dlazdice.has(ci):
			var d := Dlazdice.new()
			d.ci = ci
			d.uzel = Node3D.new()
			d.uzel.name = "Dlazdice_%d" % ci
			add_child(d.uzel)
			_dlazdice[ci] = d
		_dlazdice[ci].vzdalenost = chci[ci]
	_fronta.clear()
	for ci: int in _dlazdice:
		if not _dlazdice[ci].hotova:
			_fronta.append(ci)
	_fronta.sort_custom(func(a: int, b: int) -> bool: return _dlazdice[a].vzdalenost < _dlazdice[b].vzdalenost)


func _odeber(d: Dlazdice) -> void:
	_dlazdice.erase(d.ci)
	d.uzel.queue_free()


func _vycistit() -> void:
	for d: Dlazdice in _dlazdice.values():
		d.uzel.queue_free()
	_dlazdice.clear()
	_fronta.clear()
	_posledni_ci = -2


func _mesh(p: Stavba.Plocha, mat: Material, stiny := true) -> MeshInstance3D:
	if p == null or p.pocet() == 0:
		return null
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, p.pole())
	m.surface_set_material(0, mat)
	var mi := MeshInstance3D.new()
	mi.mesh = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if stiny else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi


func _pridej_kolizi(d: Dlazdice, tvary: PackedVector3Array, oboustranne: bool, skupina: String) -> void:
	if tvary.is_empty():
		return
	var s := ConcavePolygonShape3D.new()
	s.backface_collision = oboustranne
	s.set_faces(tvary)
	d.kolizni_tvary.append([s, skupina])


func _nastav_kolize(d: Dlazdice, zapnout: bool) -> void:
	if Engine.is_editor_hint():
		return
	if zapnout:
		if d.kolize == null and not d.kolizni_tvary.is_empty():
			d.kolize = StaticBody3D.new()
			d.kolize.name = "Kolize"
			d.uzel.add_child(d.kolize)
		if d.kolize != null:
			# tvary přibývají po fázích stavby
			while d.kolize.get_child_count() < d.kolizni_tvary.size():
				var t: Array = d.kolizni_tvary[d.kolize.get_child_count()]
				var cs := CollisionShape3D.new()
				cs.shape = t[0]
				cs.name = t[1]
				d.kolize.add_child(cs)
		if d.vybaveni == null and d.lampy_mm != null:
			_postav_vybaveni(d)
	elif d.kolize != null:
		d.kolize.queue_free()
		d.kolize = null
		if d.vybaveni:
			d.vybaveni.queue_free()
			d.vybaveni = null


## Kolizní sloupky lamp (ulomitelné autem). Vzhled zůstává v MultiMesh dlaždice.
func _postav_vybaveni(d: Dlazdice) -> void:
	d.vybaveni = Node3D.new()
	d.vybaveni.name = "Vybaveni"
	d.uzel.add_child(d.vybaveni)
	var L := d.lampy
	for k in L.size() / 8:
		var o := k * 8
		var id := "lampa/%d/%d" % [d.ci, k]
		if Zlomitelny.ulomene.has(id):
			continue
		var z := Zlomitelny.new()
		z.id = id
		z.vyska = L[o + 3]
		z.polomer = 0.12
		z.multimesh = d.lampy_mm
		z.instance = k
		z.vzhled = _lampa_mesh
		d.vybaveni.add_child(z)
		z.global_position = Vector3(L[o], L[o + 1], L[o + 2])


## Jeden krok stavby: 0 terén, 1 silnice a mosty, 2 budovy, 3 stromy a lampy.
func _krok(d: Dlazdice) -> void:
	var u := d.uzel
	match d.faze:
		0:
			var t := Mapa.teren(d.ci)
			var g := Stavba.teren(t)
			var mi := _mesh(g.teren, _mat_teren.duplicate(), false)
			var img := Stavba.povrch(Mapa.blok("povrch", d.ci))
			if img:
				mi.material_override = null
				var mat: ShaderMaterial = mi.mesh.surface_get_material(0)
				mat.set_shader_parameter("povrch", ImageTexture.create_from_image(img))
				mat.set_shader_parameter("pixelu", float(img.get_width()))
			mi.name = "Teren"
			u.add_child(mi)
			_pridej_kolizi(d, g.kolize, false, "teren")
		1:
			var s := Stavba.silnice(Mapa.blok("silnice", d.ci))
			if not s.is_empty():
				for jmeno: String in ["asfalt", "znacky", "pevne"]:
					var mat: Material = {"asfalt": _mat_asfalt, "znacky": _mat_znacky, "pevne": _mat_pevne}[jmeno]
					var mi := _mesh(s[jmeno], mat, jmeno == "pevne")
					if mi:
						mi.name = jmeno.capitalize()
						u.add_child(mi)
				_pridej_kolizi(d, s.kolize, true, "mosty")
		2:
			# zaměřené budovy centra nahrazují odpovídající budovy z OSM
			var mesto := Stavba.mesto(Mapa.blok("mesto", d.ci))
			var b := Stavba.budovy(Mapa.blok("budovy", d.ci), not mesto.is_empty())
			if mesto.has("hlavni"):
				var mh := _mesh(mesto.hlavni, _mat_budovy)
				mh.name = "MestoZamerene"
				u.add_child(mh)
				_pridej_kolizi(d, mesto.kolize, true, "mesto")
			if mesto.has("detail"):
				var md := _mesh(mesto.detail, _mat_pevne)
				md.name = "MestoDetail"
				u.add_child(md)
			var k := Stavba.konstrukce(Mapa.blok("konstrukce", d.ci))
			if not k.is_empty():
				var mk := _mesh(k.konstrukce, _mat_pevne)
				mk.name = "Konstrukce"
				u.add_child(mk)
				_pridej_kolizi(d, k.kolize, true, "konstrukce")
			if not b.is_empty():
				var mi := _mesh(b.budovy, _mat_budovy)
				if mi:
					mi.name = "Budovy"
					u.add_child(mi)
				_pridej_kolizi(d, b.kolize, false, "budovy")
		3:
			if stromy:
				var druhy := Stavba.stromy(Mapa.blok("stromy", d.ci), Mapa.roh_dlazdice(d.ci))
				for druh in 2:
					var seznam: Array = druhy[druh]
					if seznam.is_empty():
						continue
					var mm := MultiMesh.new()
					mm.transform_format = MultiMesh.TRANSFORM_3D
					mm.use_colors = true
					mm.mesh = _strom_mesh[druh]
					mm.instance_count = seznam.size()
					for k in seznam.size():
						mm.set_instance_transform(k, seznam[k][0])
						mm.set_instance_color(k, seznam[k][1])
					var mmi := MultiMeshInstance3D.new()
					mmi.multimesh = mm
					mmi.material_override = _mat_strom if druh == 0 else _mat_jehlicnan
					mmi.name = "Stromy%d" % druh
					u.add_child(mmi)
			var lampy: Variant = Mapa.blok("lampy", d.ci)
			if lampy != null:
				var L: PackedFloat32Array = lampy.l
				var pocet := L.size() / 8
				var mm := MultiMesh.new()
				mm.transform_format = MultiMesh.TRANSFORM_3D
				mm.mesh = _lampa_mesh
				mm.instance_count = pocet
				for k in pocet:
					var o := k * 8
					var vyska_sloupu := L[o + 3]
					var b := Basis.IDENTITY.scaled(Vector3(1.0, vyska_sloupu / 7.0, 1.0))
					mm.set_instance_transform(k, Transform3D(b, Vector3(L[o], L[o + 1], L[o + 2])))
				for k in pocet:
					if Zlomitelny.ulomene.has("lampa/%d/%d" % [d.ci, k]):
						mm.set_instance_transform(k, Transform3D(Basis().scaled(Vector3.ZERO), Vector3(L[k * 8], L[k * 8 + 1], L[k * 8 + 2])))
				var mmi := MultiMeshInstance3D.new()
				mmi.multimesh = mm
				mmi.name = "Lampy"
				u.add_child(mmi)
				d.lampy = L
				d.lampy_mm = mm
			d.hotova = true
	d.faze += 1


## Počet hotových dlaždic (pro testy a ukazatel načítání).
func pocet_hotovych() -> int:
	var n := 0
	for d: Dlazdice in _dlazdice.values():
		if d.hotova:
			n += 1
	return n


func ceka_na_stavbu() -> int:
	return _fronta.size()
