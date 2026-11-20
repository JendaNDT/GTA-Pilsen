class_name VuzMhd
extends Node3D
## Vůz MHD (tramvaj, autobus, trolejbus) jedoucí po trase podle jízdního řádu.
## Články se staví z kvádrů v barvách PMDP; každý článek má vlastní kolizi a kopíruje trasu.

const ZLUTA := Color(0.949, 0.745, 0.145)
const CERVENA := Color(0.769, 0.133, 0.165)
const BILA := Color(0.898, 0.89, 0.859)
const ZELENA := Color(0.184, 0.604, 0.341)
const SEDA := Color(0.871, 0.875, 0.863)
const SKLO := Color(0.19, 0.27, 0.32)
const TMAVA := Color(0.12, 0.14, 0.16)

## Délky článků a polohy dveří od středu článku (+ vpřed), podle src/entities/transit-models.js.
const CLANKY := {
	"tram": [{"delka": 9.4, "dvere": [2.36, -3.25]}, {"delka": 10.34, "dvere": [0.0]}, {"delka": 9.4, "dvere": [3.25, -2.36]}],
	"tatra": [{"delka": 16.2, "dvere": [6.02, 0.09, -5.96]}, {"delka": 16.2, "dvere": [6.02, 0.09, -5.96]}],
	"bus": [{"delka": 12.0, "dvere": [4.69, -0.63, -4.23]}],
	"trolleybus": [{"delka": 11.8, "dvere": [3.9, -1.5]}],
}
const MEZERA := 0.35       ## mezera mezi články (m)
const NAZVY := {"tram": "tramvaj", "trolleybus": "trolejbus", "bus": "autobus"}

var udalost: Dictionary
var trasa: JizdniRad.Trasa
var typ := "tram"
var linka := ""
var cil := ""
var s := 0.0               ## poloha čela na trase (m)
var index := 0             ## pořadí příští (nebo právě obsluhované) zastávky
var cekani := 0.0
var dvere_otevrene := false
var bok := 0.0             ## posun od osy trasy doprava (autobusy jezdí v pravém pruhu)
var clanky: Array[Node3D] = []
var _tela: Array[AnimatableBody3D] = []
var _dvere: Array[Node3D] = []
var _otevreni := 0.0
var _popis: Array = []


func priprav(u: Dictionary) -> void:
	udalost = u
	var spoj: Dictionary = u.spoj
	trasa = spoj.trasa
	typ = trasa.typ
	linka = trasa.linka
	cil = spoj.cil
	bok = 0.0 if typ == "tram" else 1.7
	var druh := typ
	# Herní střídání starších souprav Tatra na linkách 1 a 2 (stálé pro konkrétní spoj, jako v předloze).
	if typ == "tram" and (linka == "1" or linka == "2") and int(spoj.id) % 2 == 0:
		druh = "tatra"
	_popis = CLANKY.get(druh, CLANKY.bus)
	for i in _popis.size():
		_postav_clanek(i, druh)


func delka() -> float:
	var d := 0.0
	for c: Dictionary in _popis:
		d += c.delka + MEZERA
	return d - MEZERA


func _mat(barva: Color, drsnost := 0.4, kov := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = barva
	m.roughness = drsnost
	m.metallic = kov
	return m


func _box(rodic: Node3D, velikost: Vector3, pozice: Vector3, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = velikost
	b.material = mat
	mi.mesh = b
	mi.position = pozice
	rodic.add_child(mi)
	return mi


func _postav_clanek(i: int, druh: String) -> void:
	var p: Dictionary = _popis[i]
	var L: float = p.delka
	var W := 2.5
	var c := Node3D.new()
	c.name = "Clanek%d" % i
	add_child(c)
	clanky.append(c)
	var lak: Color = ZLUTA if typ == "tram" else (ZELENA if typ == "trolleybus" else CERVENA)
	if druh == "tatra":
		lak = Color(0.306, 0.376, 0.42)
	var m_lak := _mat(lak, 0.3, 0.2)
	var m_bila := _mat(BILA if typ != "trolleybus" else SEDA, 0.4)
	var m_sklo := _mat(SKLO, 0.08, 0.3)
	var m_tmava := _mat(TMAVA, 0.8)
	var spodek := 0.3 if typ == "tram" else 0.32
	_box(c, Vector3(W, 1.0, L), Vector3(0, spodek + 0.5, 0), m_lak)
	_box(c, Vector3(W * 0.99, 1.35, L * 0.99), Vector3(0, spodek + 1.0 + 0.675, 0), m_sklo)
	_box(c, Vector3(W * 0.98, 0.35, L * 0.995), Vector3(0, spodek + 2.35 + 0.17, 0), m_bila)
	_box(c, Vector3(W * 0.9, 0.12, L * 0.97), Vector3(0, spodek + 2.88, 0), m_bila)
	# kola nebo podvozky
	for z in [L * 0.32, -L * 0.32]:
		for x in [-W * 0.42, W * 0.42]:
			_box(c, Vector3(0.3, 0.7, 0.9), Vector3(x, 0.35, z), m_tmava)
	# dveře na pravé straně (−X je vpravo při jízdě ve směru +Z)
	for d: float in p.dvere:
		var dv := _box(c, Vector3(0.06, 2.1, 1.25), Vector3(-W / 2.0 - 0.02, spodek + 1.15, d), _mat(Color(0.22, 0.24, 0.25), 0.3))
		_dvere.append(dv)
	if i == 0:
		var cedule := Label3D.new()
		cedule.text = "%s  %s" % [linka, cil]
		cedule.font_size = 48
		cedule.pixel_size = 0.006
		cedule.modulate = Color(1.0, 0.75, 0.2)
		cedule.outline_size = 0
		cedule.position = Vector3(0, spodek + 2.45, L / 2.0 + 0.04)
		cedule.double_sided = false
		c.add_child(cedule)
		var cislo := Label3D.new()
		cislo.text = linka
		cislo.font_size = 72
		cislo.pixel_size = 0.006
		cislo.modulate = Color(1.0, 0.75, 0.2)
		cislo.position = Vector3(-W / 2.0 - 0.05, spodek + 2.2, L / 2.0 - 1.0)
		cislo.rotation.y = -PI / 2.0
		c.add_child(cislo)
		var svetlo := _mat(Color(1, 0.95, 0.8))
		svetlo.emission_enabled = true
		svetlo.emission = Color(1, 0.93, 0.75)
		for x in [-0.8, 0.8]:
			_box(c, Vector3(0.3, 0.15, 0.05), Vector3(x, spodek + 0.7, L / 2.0 + 0.02), svetlo)
	if typ == "trolleybus":
		for x in [-0.35, 0.35]:
			var tyc := _box(c, Vector3(0.06, 0.06, 6.2), Vector3(x, spodek + 3.55, -L / 2.0 + 3.3), m_tmava)
			tyc.rotation.x = -0.12
	if typ == "tram" and i == 1 or druh == "tatra" and i == 0:
		var sberac := _box(c, Vector3(1.2, 0.05, 0.05), Vector3(0, spodek + 3.9, 0), m_tmava)
		_box(sberac, Vector3(0.05, 0.9, 0.05), Vector3(0, -0.45, 0), m_tmava)
	var telo := AnimatableBody3D.new()
	telo.sync_to_physics = true
	telo.collision_layer = Hra.VRSTVA_VOZIDLA
	telo.collision_mask = 0
	var cs := CollisionShape3D.new()
	var tvar := BoxShape3D.new()
	tvar.size = Vector3(W, 3.0, L)
	cs.shape = tvar
	cs.position.y = 1.6
	telo.add_child(cs)
	c.add_child(telo)
	_tela.append(telo)


## Nastaví polohu podle stavu jízdního řádu.
func nastav(stav: Dictionary, delta: float) -> void:
	s = stav.s
	index = stav.index
	cekani = stav.cekani
	dvere_otevrene = cekani > 0.0
	_otevreni = move_toward(_otevreni, 1.0 if dvere_otevrene else 0.0, delta * 3.0)
	var od := 0.0
	for i in clanky.size():
		var L: float = _popis[i].delka
		var predek := s - od
		var zadek := predek - L
		var a := trasa.poloha(predek, bok)
		var b := trasa.poloha(zadek, bok)
		var ya := trasa.vyska(predek)
		var yb := trasa.vyska(zadek)
		var vpred := Vector3(a.x - b.x, ya - yb, a.y - b.y)
		if vpred.length() < 0.01:
			vpred = Vector3(a.z, 0, a.w)
		var stred := Vector3((a.x + b.x) * 0.5, (ya + yb) * 0.5, (a.y + b.y) * 0.5)
		var basis := Basis.looking_at(-vpred.normalized(), Vector3.UP)
		clanky[i].global_transform = Transform3D(basis, stred)
		od += L + MEZERA
	for dv in _dvere:
		dv.position.x = -1.27 - 0.25 * _otevreni


## Poloha dveří prvního článku ve světě (pro nástup a výstup).
func misto_dveri(vne := 1.2) -> Vector3:
	var c := clanky[0]
	var d: float = _popis[0].dvere[0]
	return c.global_transform * Vector3(-1.25 - vne, 0.0, d)


func nazev_spoje() -> String:
	return "%s %s → %s" % [NAZVY.get(typ, typ).capitalize(), linka, cil]


func pristi_zastavka() -> String:
	var z: Array = udalost.spoj.zastaveni
	if index < z.size():
		return z[index].cil[1]
	return ""


func je_konecna() -> bool:
	return index >= udalost.spoj.zastaveni.size() - 1
