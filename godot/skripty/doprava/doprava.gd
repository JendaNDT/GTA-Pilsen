class_name Doprava
extends Node3D
## Provoz kolem hráče: auta v pruzích podle grafu, semafory a značky z předlohy, zaparkovaná auta.
## Řidiči zastaví na červenou a u stopky, dají přednost, drží odstup a v zatáčkách zpomalí.

const ZRYCHLENI := 2.6
const BRZDENI := 4.5
const NOUZOVE := 8.0
const MEZERA := 4.0             ## odstup při stání (m)
const TYPY_PROVOZU := ["hatch", "sedan", "kombi", "suv", "sedan", "kombi", "van", "hatch", "taxi"]

@export var sledovat: Node3D
@export var pocet_aut := 26
@export var pocet_zaparkovanych := 40
@export var dosah_aut := 260.0
@export var dosah_navestidel := 260.0

var hra: Hra
var graf: Graf
var rizeni: Rizeni
var rytmus: Rytmus
## Cílový počet aut podle denního rytmu (pocet_aut je horní mez podle kvality).
var cil_aut := 0
var _cas_rytmu := 0.0
var auta: Array[VozProvozu] = []
var zaparkovana: Array[Auto] = []
var nahoda := RandomNumberGenerator.new()
var _navestidla := {}          ## ci -> Node3D
var _lampy := []               ## [MeshInstance3D, skupina, osa, chodci, barva]
var _materialy := {}
var _cas_obnovy := 0.0
var _cas_svetel := 0.0


func _ready() -> void:
	nahoda.randomize()
	for barva: String in ["red", "amber", "green"]:
		var zap := StandardMaterial3D.new()
		zap.albedo_color = {"red": Color(1, 0.1, 0.05), "amber": Color(1, 0.65, 0.05), "green": Color(0.1, 1, 0.3)}[barva]
		zap.emission_enabled = true
		zap.emission = zap.albedo_color
		zap.emission_energy_multiplier = 2.5
		var vyp := StandardMaterial3D.new()
		vyp.albedo_color = zap.albedo_color.darkened(0.8)
		_materialy[barva] = [zap, vyp]


func _priprav() -> bool:
	if graf == null:
		graf = Graf.nacti()
		rizeni = Rizeni.nacti()
		rytmus = Rytmus.nacti()
	return graf != null


func _physics_process(delta: float) -> void:
	if sledovat == null or not Mapa.nacteno or not _priprav():
		return
	rizeni.cas += delta
	var stred := sledovat.global_position
	_cas_obnovy -= delta
	_cas_rytmu -= delta
	if _cas_rytmu <= 0.0:
		_cas_rytmu = 2.0
		# denní rytmus: v noci jezdí málo aut, ve špičce plný počet (target v vehicles.js)
		var hustota := rytmus.hustota_aut(graf, stred.x, stred.z, hra.cas_den, hra.cas_hodina) if hra else 1.0
		cil_aut = ceili(pocet_aut * (0.12 + 0.88 * hustota))
	if _cas_obnovy <= 0.0:
		_cas_obnovy = 0.5
		_uklid(stred)
		_dopln(stred)
		_navestidla_kolem(stred)
	_cas_svetel -= delta
	if _cas_svetel <= 0.0:
		_cas_svetel = 0.25
		_obnov_svetla()
	for v in auta:
		_jed(v, delta)


# ------------------------------------------------------------------ vozy v provozu

## Hrana je vhodná pro běžný provoz (třídy do obytné zóny, ne soukromé, ne tunel).
func _provozni(e: int) -> bool:
	var silnice := graf.h_silnice[e]
	return graf.trida[silnice] <= 12 and not (graf.priznaky[silnice] & (Graf.RF_PRIVATE | Graf.RF_TUNNEL)) \
		and graf.h_delka[e] >= 12.0


func _bok(e: int) -> float:
	var silnice := graf.h_silnice[e]
	var w := graf.sirka[silnice]
	if graf.priznaky[silnice] & Graf.RF_ONEWAY:
		return w * 0.25 if graf.pruhy[silnice] >= 2 else 0.0
	return maxf(1.3, w * 0.25)


func _dopln(stred: Vector3) -> void:
	var pokusu := 0
	while auta.size() < cil_aut and pokusu < 6:
		pokusu += 1
		var uhel := nahoda.randf() * TAU
		var d := nahoda.randf_range(110.0, dosah_aut - 20.0)
		var bod := Vector2(stred.x + sin(uhel) * d, stred.z + cos(uhel) * d)
		var h := graf.nejblizsi_hrana(bod.x, bod.y, 40.0)
		if h.is_empty():
			continue
		var e: int = h.hrana
		if nahoda.randf() < 0.5:
			var o := Zakazky._opacna(graf, e)
			if o >= 0:
				e = o
		if not _provozni(e):
			continue
		if hra and nahoda.randf() >= rytmus.vaha_auta(graf, e, hra.cas_den, hra.cas_hodina):
			continue
		var s: float = h.podel if e == h.hrana else graf.h_delka[e] - h.podel
		var p := graf.bod_na_hrane(e, s, _bok(e))
		var volno := true
		for v in auta:
			if v.global_position.distance_squared_to(Vector3(p.x, v.global_position.y, p.y)) < 400.0:
				volno = false
				break
		if not volno:
			continue
		var v := VozProvozu.new()
		v.priprav(TYPY_PROVOZU[nahoda.randi_range(0, TYPY_PROVOZU.size() - 1)],
			Color.hex(Auto.BARVY[nahoda.randi_range(0, Auto.BARVY.size() - 1)] << 8 | 0xff).srgb_to_linear())
		v.hrana = e
		v.s = s
		v.bok = _bok(e)
		v.cestovni = _rychlost_hrany(e) * nahoda.randf_range(0.85, 1.05)
		v.rychlost = v.cestovni * 0.6
		v.dalsi = _vyber_dalsi(e)
		add_child(v)
		auta.append(v)
		_umisti(v)
		if hra and hra.zvuky:
			v.set_meta("motor", hra.zvuky.motor_pro(v, "car", -16.0))
	var pokusu2 := 0
	while zaparkovana.size() < pocet_zaparkovanych and pokusu2 < 4:
		pokusu2 += 1
		_zaparkuj(stred)


func _rychlost_hrany(e: int) -> float:
	var silnice := graf.h_silnice[e]
	var kmh := graf.rychlost_silnice(silnice, graf.h_a[e] < graf.h_b[e])
	if kmh <= 0:
		kmh = 50
	return minf(kmh, 80) / 3.6


func _vyber_dalsi(e: int) -> int:
	var n := graf.h_do[e]
	var moznosti := []
	var vahy := []
	var smer := _smer_konce(e)
	for q in range(graf.vystup_zac[n], graf.vystup_zac[n + 1]):
		var f := graf.vystup_hrany[q]
		if graf.h_do[f] == graf.h_od[e] and graf.h_silnice[f] == graf.h_silnice[e]:
			continue
		if not _provozni(f):
			continue
		var d2 := _smer_zacatku(f)
		moznosti.append(f)
		vahy.append(0.4 + maxf(0.0, smer.dot(d2)) * 2.0)
	if moznosti.is_empty():
		return Zakazky._opacna(graf, e)
	var celkem := 0.0
	for w: float in vahy:
		celkem += w
	var r := nahoda.randf() * celkem
	for i in moznosti.size():
		r -= vahy[i]
		if r <= 0.0:
			return moznosti[i]
	return moznosti[-1]


func _smer_konce(e: int) -> Vector2:
	var b := graf.h_b[e]
	var p := b - (1 if graf.h_a[e] < b else -1)
	return Vector2(graf.bod_x[b] - graf.bod_x[p], graf.bod_z[b] - graf.bod_z[p]).normalized()


func _smer_zacatku(e: int) -> Vector2:
	var a := graf.h_a[e]
	var n := a + (1 if a < graf.h_b[e] else -1)
	return Vector2(graf.bod_x[n] - graf.bod_x[a], graf.bod_z[n] - graf.bod_z[a]).normalized()


func _umisti(v: VozProvozu) -> void:
	var p := graf.bod_na_hrane(v.hrana, v.s, v.bok)
	var silnice := graf.h_silnice[v.hrana]
	var y: float
	if graf.priznaky[silnice] & Graf.RF_BRIDGE:
		var t := clampf(v.s / maxf(0.1, graf.h_delka[v.hrana]), 0.0, 1.0)
		y = lerpf(graf.bod_y[graf.h_a[v.hrana]], graf.bod_y[graf.h_b[v.hrana]], t)
	else:
		y = Mapa.vyska(p.x, p.y) + Stavba.SURF
	var vpred := Vector3(p.z, 0, p.w)
	if vpred.length_squared() < 0.01:
		vpred = Vector3.FORWARD
	v.global_transform = Transform3D(Basis.looking_at(-vpred.normalized(), Vector3.UP), Vector3(p.x, y, p.y))


## Vzdálenost k nejbližší překážce v pruhu před vozem (auta, MHD, hráč), nebo INF.
func _prekazka(v: VozProvozu) -> float:
	var poloha := v.global_position
	var vpred := v.global_basis.z
	var nej := INF
	v.blokuje = null
	var dohled := 12.0 + v.rychlost * 2.5
	var kandidati: Array = []
	kandidati.append_array(auta)
	if hra:
		if hra.auto_hrace:
			kandidati.append(hra.auto_hrace)
		if hra.rezim == "pesky":
			kandidati.append(hra.chodec)
		for vuz: VuzMhd in hra.mhd.vozy.values():
			kandidati.append_array(vuz.clanky)
	kandidati.append_array(zaparkovana)
	for o: Node3D in kandidati:
		if o == v or not is_instance_valid(o):
			continue
		if v.ignoruje_auta > 0.0 and o is VozProvozu:
			continue
		var d := o.global_position - poloha
		if absf(d.y) > 4.0:
			continue
		var pred := d.dot(vpred)
		if pred <= 0.0 or pred > dohled:
			continue
		var bokem := absf(d.cross(vpred).y)
		var sirka := 1.6 if o is VozProvozu or o is Auto else (1.9 if o.get_parent() is VuzMhd else 0.9)
		# protijedoucí vůz se míjí v protisměru (jinak by se vůz a tramvaj navzájem zablokovaly)
		if sirka > 1.0 and o.global_basis.z.dot(vpred) < -0.5:
			sirka = 1.0
		if bokem < sirka:
			var delka_o := 2.4 if o is VozProvozu or o is Auto else (6.0 if o.get_parent() is VuzMhd else 0.3)
			if pred - v.delka * 0.5 - delka_o < nej:
				nej = pred - v.delka * 0.5 - delka_o
				v.blokuje = o
	return nej


func _jed(v: VozProvozu, delta: float) -> void:
	var delka_hrany := graf.h_delka[v.hrana]
	# na mokru a sněhu jezdí pomaleji (vmax × √přilnavosti jako v předloze)
	var cil := v.cestovni * sqrt(Auto.prilnavost)
	# zatáčka na konci hrany
	if v.dalsi >= 0:
		var ostrost := _smer_konce(v.hrana).angle_to(_smer_zacatku(v.dalsi))
		var zbyva := delka_hrany - v.s
		if absf(ostrost) > 0.5 and zbyva < 25.0:
			cil = minf(cil, 7.0 if absf(ostrost) < 1.2 else 5.0)
	# semafor, stopka, dej přednost
	var c := rizeni.pravidlo_vpred(v.hrana, v.s, 45.0)
	var stop_vzdalenost := INF
	if not c.is_empty():
		var k: float = c[0] - v.s - 1.0
		match int(c[1]):
			Rizeni.SEMAFOR:
				var barva := rizeni.svetlo(c[2], c[3])
				# na žlutou zastaví, jen když to stihne
				if barva == "red" or (barva == "amber" and k > v.rychlost * v.rychlost / (2.0 * BRZDENI)):
					stop_vzdalenost = k
			Rizeni.STOPKA:
				if v.projel_stopku != c[0]:
					stop_vzdalenost = k
					if k < 1.5 and v.rychlost < 0.3:
						v.stoji_u_stopky += delta
						if v.stoji_u_stopky > 1.5:
							v.projel_stopku = c[0]
							v.stoji_u_stopky = 0.0
			Rizeni.PREDNOST:
				if k < 10.0:
					cil = minf(cil, 4.5)
	var prekazka := _prekazka(v)
	var volno := minf(stop_vzdalenost, prekazka - MEZERA)
	# rychlost, při které ještě zastaví na volné vzdálenosti
	var bezpecna := sqrt(maxf(0.0, 2.0 * BRZDENI * maxf(0.0, volno)))
	cil = minf(cil, bezpecna)
	if v.rychlost < cil:
		v.rychlost = minf(cil, v.rychlost + ZRYCHLENI * delta)
	else:
		var brzda := NOUZOVE if volno < 2.0 else BRZDENI
		v.rychlost = maxf(cil, v.rychlost - brzda * delta)
	if volno <= 0.0:
		v.rychlost = 0.0
	_zaklesnuti(v, stop_vzdalenost, delta)
	v.s += v.rychlost * delta
	if v.has_meta("motor"):
		(v.get_meta("motor") as AudioStreamPlayer3D).pitch_scale = Zvuky.ladeni("car", v.rychlost / 20.0)
	while v.s > delka_hrany:
		v.s -= delka_hrany
		var predchozi := v.hrana
		v.hrana = v.dalsi if v.dalsi >= 0 else Zakazky._opacna(graf, predchozi)
		if v.hrana < 0:
			# slepý konec bez pokračování: vůz zmizí a provoz doplní jiný
			v.hrana = predchozi
			v.s = delka_hrany
			v.rychlost = 0.0
			v.na_konci = true
			break
		v.dalsi = _vyber_dalsi(v.hrana)
		v.bok = _bok(v.hrana)
		v.cestovni = _rychlost_hrany(v.hrana) * nahoda.randf_range(0.85, 1.05)
		v.projel_stopku = -1.0
		delka_hrany = graf.h_delka[v.hrana]
	_umisti(v)


## Dvě auta, která do sebe zaklesla (každé má to druhé před sebou), nebo kruh čekajících aut
## by stála navždy. Vzájemné zablokování se řeší hned (jede vůz s menším číslem), dlouhé stání
## bez semaforu a stopky po 12 s: vůz na 2,5 s přestane vidět ostatní auta provozu a vyjede.
func _zaklesnuti(v: VozProvozu, stop_vzdalenost: float, delta: float) -> void:
	v.ignoruje_auta = maxf(0.0, v.ignoruje_auta - delta)
	if v.rychlost > 0.1 or stop_vzdalenost < 3.0:
		v.stoji = 0.0
		return
	v.stoji += delta
	var b := v.blokuje as VozProvozu
	if b == null:
		return
	if b.blokuje == v and b.rychlost < 0.1 and v.get_instance_id() < b.get_instance_id() and v.stoji > 1.0:
		v.ignoruje_auta = 2.5
	elif v.stoji > 12.0:
		v.ignoruje_auta = 2.5
		v.stoji = 0.0


func _uklid(stred: Vector3) -> void:
	# přebytečné auto (po změně denní doby) zmizí daleko za kamerou
	if auta.size() > cil_aut:
		var kam := get_viewport().get_camera_3d()
		for i in range(auta.size() - 1, -1, -1):
			var v := auta[i]
			var d := v.global_position - stred
			if Vector2(d.x, d.z).length() > 190.0 and (kam == null or (v.global_position - kam.global_position).dot(-kam.global_basis.z) < 0.0):
				auta.remove_at(i)
				v.queue_free()
				break
	for i in range(auta.size() - 1, -1, -1):
		var v := auta[i]
		if v.na_konci or v.global_position.distance_to(stred) > dosah_aut + 60.0:
			auta.remove_at(i)
			v.queue_free()
	for i in range(zaparkovana.size() - 1, -1, -1):
		if not is_instance_valid(zaparkovana[i]):
			zaparkovana.remove_at(i)
			continue
		var a := zaparkovana[i]
		if a == hra.auto_hrace:
			zaparkovana.remove_at(i)
			continue
		if a.global_position.distance_to(stred) > 320.0:
			zaparkovana.remove_at(i)
			a.queue_free()


## Zaparkuje auto u kraje vozovky obytné ulice (jako _spawnStarterCar v předloze: okraj + 0,8 m).
func _zaparkuj(stred: Vector3) -> void:
	var uhel := nahoda.randf() * TAU
	var d := nahoda.randf_range(70.0, 220.0)
	var h := graf.nejblizsi_hrana(stred.x + sin(uhel) * d, stred.z + cos(uhel) * d, 30.0)
	if h.is_empty():
		return
	var e: int = h.hrana
	var silnice := graf.h_silnice[e]
	var trida := graf.trida[silnice]
	if trida < 9 or trida > 12 or graf.priznaky[silnice] & (Graf.RF_BRIDGE | Graf.RF_TUNNEL | Graf.RF_PRIVATE):
		return
	# ne u křižovatky (první a posledních 15 m hrany) a ne na tramvajové trati
	if h.podel < 15.0 or h.podel > graf.h_delka[e] - 15.0:
		return
	var p := graf.bod_na_hrane(e, h.podel, graf.sirka[silnice] * 0.5 + 0.8)
	if hra.mhd.u_koleji(p.x, p.y):
		return
	var bod := Vector3(p.x, Mapa.vyska(p.x, p.y), p.y)
	for a in zaparkovana:
		if is_instance_valid(a) and a.global_position.distance_to(bod) < 8.0:
			return
	if hra.auto_hrace and hra.auto_hrace.global_position.distance_to(bod) < 8.0:
		return
	var typ: String = TYPY_PROVOZU[nahoda.randi_range(0, 7)]
	var a := hra.postav_auto(typ, bod, Vector3(p.z, 0, p.w),
		Color.hex(Auto.BARVY[nahoda.randi_range(0, Auto.BARVY.size() - 1)] << 8 | 0xff).srgb_to_linear())
	a.set_meta("cizi", true)
	zaparkovana.append(a)


## Náraz hráčova auta do vozu v provozu: vůz se stane fyzikálním autem a dál ho nikdo neřídí.
func narazeno(v: VozProvozu) -> Auto:
	if not auta.has(v):
		return null
	auta.erase(v)
	var smer := v.global_basis.z
	var a := hra.postav_auto(v.typ, v.global_position, smer, v.barva)
	a.global_transform = v.global_transform
	a.linear_velocity = smer * v.rychlost
	a.set_meta("cizi", true)
	zaparkovana.append(a)
	v.queue_free()
	return a


## Stojící vůz v provozu do 4 m od hráče (k „sebrání“).
func vuz_k_sebrani(p: Vector3) -> VozProvozu:
	for v in auta:
		if v.rychlost < 1.0 and v.global_position.distance_to(p) < 4.0:
			return v
	return null


# ------------------------------------------------------------------ návěstidla a značky

func _navestidla_kolem(stred: Vector3) -> void:
	var chci := {}
	var r := ceili(dosah_navestidel / Mapa.dlazdice)
	var c := Mapa.index_dlazdice(stred.x, stred.z)
	if c < 0:
		return
	var cx := c % Mapa.sloupce
	var cz := c / Mapa.sloupce
	for dz in range(-r, r + 1):
		for dx in range(-r, r + 1):
			if cx + dx < 0 or cz + dz < 0 or cx + dx >= Mapa.sloupce or cz + dz >= Mapa.radky:
				continue
			chci[(cz + dz) * Mapa.sloupce + cx + dx] = true
	for ci: int in _navestidla.keys():
		if not chci.has(ci):
			_navestidla[ci].queue_free()
			_navestidla.erase(ci)
	var zmena := false
	for ci: int in chci:
		if _navestidla.has(ci):
			continue
		var u := Node3D.new()
		add_child(u)
		_navestidla[ci] = u
		zmena = true
		for i: int in rizeni.hlavy_dlazdice.get(ci, []):
			_postav_semafor(u, i)
		for i: int in rizeni.znacky_dlazdice.get(ci, []):
			_postav_znacku(u, i)
	if zmena:
		_lampy = _lampy.filter(func(l: Array) -> bool: return is_instance_valid(l[0]))


func _postav_semafor(rodic: Node3D, i: int) -> void:
	var h := rizeni.hlavy
	var o := i * 8
	var chodci := h[o + 7] > 0.5
	if Zlomitelny.ulomene.has("semafor/%d" % i):
		return
	var telo := Zlomitelny.new()
	telo.id = "semafor/%d" % i
	telo.vyska = 3.3
	telo.polomer = 0.1
	telo.hmotnost = 70.0
	telo.position = Vector3(h[o], h[o + 1], h[o + 2])
	rodic.add_child(telo)
	var uzel := Node3D.new()
	uzel.name = "Vzhled"
	uzel.rotation.y = atan2(-h[o + 3], -h[o + 4])
	telo.add_child(uzel)
	var sloup := MeshInstance3D.new()
	var c := CylinderMesh.new()
	c.top_radius = 0.06
	c.bottom_radius = 0.07
	c.height = 3.2 if not chodci else 2.6
	c.radial_segments = 6
	sloup.mesh = c
	sloup.position.y = c.height / 2.0
	uzel.add_child(sloup)
	var skrin := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = Vector3(0.32, 0.95 if not chodci else 0.66, 0.22)
	var tmava := StandardMaterial3D.new()
	tmava.albedo_color = Color(0.1, 0.11, 0.12)
	b.material = tmava
	skrin.mesh = b
	skrin.position.y = c.height + b.size.y / 2.0 - 0.1
	uzel.add_child(skrin)
	var barvy := ["red", "green"] if chodci else ["red", "amber", "green"]
	for k in barvy.size():
		var lampa := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = 0.1
		sm.height = 0.2
		sm.radial_segments = 8
		sm.rings = 4
		lampa.mesh = sm
		lampa.position = Vector3(0, skrin.position.y + b.size.y / 2.0 - 0.17 - k * 0.3, 0.12)
		uzel.add_child(lampa)
		_lampy.append([lampa, int(h[o + 6]), int(h[o + 5]), chodci, barvy[k]])


func _postav_znacku(rodic: Node3D, i: int) -> void:
	var z := rizeni.znacky
	var o := i * 6
	var druh := int(z[o + 5])
	if druh == 0 or Zlomitelny.ulomene.has("znacka/%d" % i):
		return
	var telo := Zlomitelny.new()
	telo.id = "znacka/%d" % i
	telo.vyska = 2.6
	telo.polomer = 0.05
	telo.hmotnost = 25.0
	telo.pevnost = 2.0
	telo.position = Vector3(z[o], z[o + 1], z[o + 2])
	rodic.add_child(telo)
	var uzel := Node3D.new()
	uzel.name = "Vzhled"
	uzel.rotation.y = atan2(-z[o + 3], -z[o + 4])
	telo.add_child(uzel)
	var sloup := MeshInstance3D.new()
	var c := CylinderMesh.new()
	c.top_radius = 0.035
	c.bottom_radius = 0.035
	c.height = 2.3
	c.radial_segments = 6
	sloup.mesh = c
	sloup.position.y = 1.15
	uzel.add_child(sloup)
	var tabule := MeshInstance3D.new()
	var tvar := CylinderMesh.new()
	tvar.top_radius = 0.33
	tvar.bottom_radius = 0.33
	tvar.height = 0.03
	tvar.radial_segments = {1: 8, 2: 3, 3: 16, 4: 4, 5: 16}.get(druh, 16)
	var m := StandardMaterial3D.new()
	m.albedo_color = {1: Color(0.8, 0.08, 0.08), 2: Color(0.95, 0.95, 0.95), 3: Color(0.8, 0.08, 0.08),
		4: Color(0.1, 0.25, 0.7), 5: Color(0.95, 0.95, 0.95)}.get(druh, Color.WHITE)
	tvar.material = m
	tabule.mesh = tvar
	tabule.rotation.x = PI / 2.0
	if druh == 2:
		tabule.rotation.z = PI
	tabule.position.y = 2.25
	uzel.add_child(tabule)


func _obnov_svetla() -> void:
	_lampy = _lampy.filter(func(l: Array) -> bool: return is_instance_valid(l[0]) and not (l[0] as Object).is_queued_for_deletion())
	for l: Array in _lampy:
		var lampa: MeshInstance3D = l[0]
		var stav := rizeni.svetlo(l[1], l[2], l[3])
		lampa.material_override = _materialy[l[4]][0 if stav == l[4] else 1]
