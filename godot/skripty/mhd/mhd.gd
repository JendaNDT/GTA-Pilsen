class_name Mhd
extends Node3D
## Městská hromadná doprava: vozy podle jízdního řádu PMDP kolem hráče.
## Poloha vozu plyne z času (JizdniRad.stav), takže spoje jedou podle řádu i mimo dohled.
## Zastávky posunuté v editoru (scény oblastí) mění místo, kde vozy zastavují.

@export var sledovat: Node3D
@export var dohled := 650.0

var jr: JizdniRad
var vozy := {}                  ## klíč spoje -> VuzMhd
var _aktivni: Array = []        ## události, které právě probíhají
var _ukazatel := 0
var _den := -9999
var _posledni_ted := -1.0
var _obnova := 0.0
var _hranice := {}              ## Trasa -> Rect2 s rezervou
var hodiny: Callable            ## vrací herní čas v sekundách od 1. 1. 1970 (místní čas)
var zvuky: Zvuky


func _ready() -> void:
	jr = JizdniRad.nacti()
	if jr == null:
		return
	for t: JizdniRad.Trasa in jr.trasy:
		var r := Rect2(t.body[0], t.body[1], 0, 0)
		for i in range(0, t.body.size(), 2):
			r = r.expand(Vector2(t.body[i], t.body[i + 1]))
		_hranice[t] = r.grow(dohled + 50.0)
	_prevezmi_upravy_zastavek()


## Stanoviště, která autor v editoru posunul, přesune i v jízdním řádu: místo zastavení na trase
## se přepočítá kolmým průmětem nové polohy na trasu.
func _prevezmi_upravy_zastavek() -> void:
	var posunute := {}
	var slozka := Oblast.slozka
	for soubor in DirAccess.get_files_at(slozka):
		if not soubor.ends_with(".tscn"):
			continue
		var o: Node = (load(slozka + soubor) as PackedScene).instantiate()
		var stred: Vector2 = o.stred if o is Oblast else Vector2.ZERO
		var z := o.get_node_or_null("Zastavky")
		if z:
			for n in z.get_children():
				if n is Zastavka and n.posunuta():
					posunute[n.id] = Vector2(n.position.x + stred.x, n.position.z + stred.y)
		o.free()
	if posunute.is_empty():
		return
	var indexy := {}
	for i in jr.stanoviste.size():
		var kod: String = jr.stanoviste[i][3]
		if posunute.has(kod):
			indexy[i] = posunute[kod]
			jr.stanoviste[i][1] = posunute[kod].x
			jr.stanoviste[i][2] = posunute[kod].y
	jr._mrizka.clear()
	for i in jr.stanoviste.size():
		var k := jr._klic(jr.stanoviste[i][1], jr.stanoviste[i][2])
		if not jr._mrizka.has(k):
			jr._mrizka[k] = []
		jr._mrizka[k].append(i)
	var hotove := {}
	for sluzba: Array in jr.spoje_podle_sluzby:
		for spoj: Dictionary in sluzba:
			for z: Dictionary in spoj.zastaveni:
				if indexy.has(z.stanoviste) and not hotove.has(z.cil):
					hotove[z.cil] = true
					z.cil[0] = _prumet(spoj.trasa, indexy[z.stanoviste], z.cil[0])
	print("MHD: převzato %d ručně posunutých zastávek" % indexy.size())


## Vzdálenost na trase nejbližší bodu p v okolí původní vzdálenosti s0.
static func _prumet(t: JizdniRad.Trasa, p: Vector2, s0: float) -> float:
	var nej := s0
	var nej_d := INF
	var s := maxf(0.0, s0 - 200.0)
	while s <= minf(t.delka, s0 + 200.0):
		var q := t.poloha(s)
		var d := Vector2(q.x - p.x, q.y - p.y).length_squared()
		if d < nej_d:
			nej_d = d
			nej = s
		s += 0.5
	return nej


func ted() -> float:
	return hodiny.call() if hodiny.is_valid() else 0.0


## Obnoví seznam probíhajících spojů (při startu a po skoku v čase).
func _obnov_aktivni(t: float) -> void:
	var den := int(floor(t / JizdniRad.DEN))
	_den = den
	_aktivni.clear()
	var u := jr.udalosti(den)
	_ukazatel = 0
	while _ukazatel < u.size() and u[_ukazatel].zacatek <= t:
		if u[_ukazatel].konec >= t:
			_aktivni.append(u[_ukazatel])
		_ukazatel += 1


func _physics_process(delta: float) -> void:
	if jr == null or sledovat == null:
		return
	var t := ted()
	if int(floor(t / JizdniRad.DEN)) != _den or absf(t - _posledni_ted) > 120.0 or t < _posledni_ted:
		_obnov_aktivni(t)
	_posledni_ted = t
	# přidat spoje, které právě vyjely
	var u := jr.udalosti(_den)
	while _ukazatel < u.size() and u[_ukazatel].zacatek <= t:
		_aktivni.append(u[_ukazatel])
		_ukazatel += 1
	_obnova -= delta
	var stred := Vector2(sledovat.global_position.x, sledovat.global_position.z)
	if _obnova <= 0.0:
		_obnova = 1.0
		_vyber_viditelne(t, stred)
	for klic: String in vozy:
		var v: VuzMhd = vozy[klic]
		v.nastav(jr.stav(v.udalost, t), delta)


func _vyber_viditelne(t: float, stred: Vector2) -> void:
	var chci := {}
	var zbyle := []
	for e: Dictionary in _aktivni:
		if e.konec < t:
			continue
		zbyle.append(e)
		var trasa: JizdniRad.Trasa = e.spoj.trasa
		if not _hranice[trasa].has_point(stred):
			continue
		var st := jr.stav(e, t)
		var p := trasa.poloha(st.s)
		if Vector2(p.x, p.y).distance_to(stred) < dohled:
			chci[e.klic] = e
	_aktivni = zbyle
	for klic: String in vozy.keys():
		if not chci.has(klic) and not vozy[klic].has_meta("cestujici"):
			vozy[klic].queue_free()
			vozy.erase(klic)
	for klic: String in chci:
		if vozy.has(klic):
			continue
		var v := VuzMhd.new()
		v.name = "Vuz_" + klic.replace(":", "_")
		add_child(v)
		v.priprav(chci[klic])
		v.nastav(jr.stav(chci[klic], t), 1.0)
		if zvuky:
			v.motor = zvuky.motor_pro(v.clanky[0], v.typ, -8.0)
		vozy[klic] = v


## Vůz s otevřenými dveřmi, ke kterému může hráč v bodě p nastoupit (do 4 m od dveří).
func vuz_k_nastupu(p: Vector3) -> VuzMhd:
	var nej: VuzMhd = null
	var nej_d := 4.5
	for v: VuzMhd in vozy.values():
		if not v.dvere_otevrene or v.je_konecna():
			continue
		for c: Node3D in v.clanky:
			# vzdálenost k obdélníku článku v půdorysu
			var lokal := c.global_transform.affine_inverse() * p
			var dx := maxf(0.0, absf(lokal.x) - 1.25)
			var dz := maxf(0.0, absf(lokal.z) - 6.0)
			var d := Vector2(dx, dz).length()
			if d < nej_d:
				nej_d = d
				nej = v
	return nej


## Nejbližší odjezdy ze stanoviště u bodu p (nebo null).
func odjezdy_u(p: Vector3) -> Variant:
	if jr == null:
		return null
	var i := jr.nejblizsi(p.x, p.z)
	return null if i < 0 else jr.odjezdy(i, ted())
