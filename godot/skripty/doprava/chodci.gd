class_name Chodci
extends Node3D
## Chodci na chodnících kolem hráče. Jdou po okraji ulic (osa silnice + polovina šířky + 1,3 m),
## na křižovatce zahnou do jiné ulice. Při sražení autem upadnou a po chvíli vstanou.

const OBLECENI := [Color(0.18, 0.32, 0.55), Color(0.55, 0.2, 0.25), Color(0.25, 0.42, 0.25), Color(0.6, 0.55, 0.45),
	Color(0.2, 0.2, 0.22), Color(0.75, 0.6, 0.2), Color(0.45, 0.3, 0.55), Color(0.85, 0.85, 0.82)]

@export var sledovat: Node3D
@export var pocet := 16
@export var dosah := 150.0

var hra: Hra
var graf: Graf
var nahoda := RandomNumberGenerator.new()
var chodci: Array = []         ## {uzel, postava, hrana, s, strana, rychlost, pad}
var _cas := 0.0
var _rytmus: Rytmus
## Cílový počet chodců podle denní doby, zastavěnosti a odjezdů MHD (pocet je horní mez).
var cil := 0


func _ready() -> void:
	nahoda.randomize()


func _physics_process(delta: float) -> void:
	if sledovat == null or not Mapa.nacteno:
		return
	if graf == null:
		graf = Graf.nacti()
		if graf == null:
			return
	var stred := sledovat.global_position
	_cas -= delta
	if _cas <= 0.0:
		_cas = 0.7
		cil = pocet
		if hra:
			if _rytmus == null:
				_rytmus = Rytmus.nacti()
			var odjezdu := 0
			var jr := hra.mhd.jr
			if jr:
				var i := jr.nejblizsi(stred.x, stred.z)
				if i >= 0:
					odjezdu = (jr.odjezdy(i, hra.ted(), 1200.0, 20).radky as Array).size()
			cil = ceili(pocet * (0.1 + 0.9 * _rytmus.vaha_chodcu(stred.x, stred.z, hra.cas_den, hra.cas_hodina, odjezdu)))
		for i in range(chodci.size() - 1, -1, -1):
			if chodci[i].uzel.global_position.distance_to(stred) > dosah + 50.0:
				chodci[i].uzel.queue_free()
				chodci.remove_at(i)
		for k in 3:
			if chodci.size() < cil:
				_pridej(stred)
	for c: Dictionary in chodci:
		_krok(c, delta)


func _chodnik(e: int) -> bool:
	var silnice := graf.h_silnice[e]
	var t := graf.trida[silnice]
	return t >= 4 and t <= 13 and not (graf.priznaky[silnice] & (Graf.RF_TUNNEL | Graf.RF_PRIVATE))


func _pridej(stred: Vector3) -> void:
	var uhel := nahoda.randf() * TAU
	var d := nahoda.randf_range(40.0, dosah - 10.0)
	var h := graf.nejblizsi_hrana(stred.x + sin(uhel) * d, stred.z + cos(uhel) * d, 30.0)
	if h.is_empty() or not _chodnik(h.hrana):
		return
	var uzel := Node3D.new()
	add_child(uzel)
	var p := Postava.new()
	p.oblecek = OBLECENI[nahoda.randi_range(0, OBLECENI.size() - 1)]
	p.kalhoty = OBLECENI[nahoda.randi_range(0, OBLECENI.size() - 1)].darkened(0.4)
	uzel.add_child(p)
	var telo := AnimatableBody3D.new()
	telo.collision_layer = Hra.VRSTVA_VOZIDLA
	telo.collision_mask = 0
	var cs := CollisionShape3D.new()
	var tvar := CapsuleShape3D.new()
	tvar.radius = 0.28
	tvar.height = 1.7
	cs.shape = tvar
	cs.position.y = 0.85
	telo.add_child(cs)
	uzel.add_child(telo)
	var c := {"uzel": uzel, "postava": p, "telo": telo, "hrana": h.hrana, "s": h.podel,
		"strana": 1.0 if nahoda.randf() < 0.5 else -1.0, "rychlost": nahoda.randf_range(1.1, 1.6), "pad": 0.0}
	chodci.append(c)
	_umisti(c)


func _umisti(c: Dictionary) -> void:
	var e: int = c.hrana
	var silnice := graf.h_silnice[e]
	var p := graf.bod_na_hrane(e, c.s, c.strana * (graf.sirka[silnice] * 0.5 + 1.3))
	var y: float
	if graf.priznaky[silnice] & Graf.RF_BRIDGE:
		var t := clampf(c.s / maxf(0.1, graf.h_delka[e]), 0.0, 1.0)
		y = lerpf(graf.bod_y[graf.h_a[e]], graf.bod_y[graf.h_b[e]], t)
	else:
		y = Mapa.vyska(p.x, p.y) + Stavba.SURF
	c.uzel.global_position = Vector3(p.x, y, p.y)
	c.postava.rotation.y = atan2(p.z, p.w)


func _krok(c: Dictionary, delta: float) -> void:
	var postava: Postava = c.postava
	if c.pad > 0.0:
		c.pad -= delta
		if c.pad <= 0.0:
			postava.rotation.x = 0.0
			postava.position.y = 0.0
		return
	# sražení hráčovým autem
	if hra and hra.rezim == "auto" and hra.auto_hrace:
		var a := hra.auto_hrace
		var uzel: Node3D = c.uzel
		var d := uzel.global_position - a.global_position
		if absf(d.y) < 2.0 and a.linear_velocity.length() > 3.0:
			var mistni := a.global_transform.affine_inverse() * uzel.global_position
			if absf(mistni.x) < 1.25 and absf(mistni.z) < 2.6:
				_srazen(c)
				return
	c.s += c.rychlost * delta
	var delka := graf.h_delka[c.hrana]
	if c.s > delka:
		var n := graf.h_do[c.hrana]
		var moznosti := []
		for q in range(graf.vystup_zac[n], graf.vystup_zac[n + 1]):
			var f := graf.vystup_hrany[q]
			if _chodnik(f) and not (graf.h_do[f] == graf.h_od[c.hrana] and graf.h_silnice[f] == graf.h_silnice[c.hrana]):
				moznosti.append(f)
		if moznosti.is_empty():
			var o := Zakazky._opacna(graf, c.hrana)
			if o < 0:
				c.s = delka
				return
			c.hrana = o
			c.strana = -c.strana
		else:
			c.hrana = moznosti[nahoda.randi_range(0, moznosti.size() - 1)]
		c.s = 0.0
	_umisti(c)
	postava.animuj(delta, c.rychlost)


func _srazen(c: Dictionary) -> void:
	c.pad = 4.0
	var postava: Postava = c.postava
	postava.rotation.x = -PI / 2.0
	postava.position.y = 0.25
	if hra:
		hra.statistiky["srazeni"] = int(hra.statistiky.get("srazeni", 0)) + 1
		hra.prestupek(1, "Sražení chodce")
