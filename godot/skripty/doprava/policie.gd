class_name Policie
extends Node3D
## Hledanost a policejní honička (podle game.js v předloze).
## Hledanost 0–5: počet hlídek = hledanost. Když jsou hlídky dál než 125 m, po 11 + 3 × hledanost
## sekundách klesne o 1. Když hlídka stojí do 9 m a hráč jede pomaleji než 2,2 m/s déle než 2,2 s,
## následuje zatčení a pokuta 10 % peněz (nejméně 200 Kč).

var hra: Hra
var graf: Graf
var hledanost := 0
var _chladnuti := 0.0
var _zatykani := 0.0
var _prodleva := 0.0
var hlidky: Array = []          ## {uzel, body: PackedVector2Array, i, rychlost, prepocet}
var nahoda := RandomNumberGenerator.new()


func _ready() -> void:
	nahoda.randomize()


func pridej(n: int, duvod: String, samostatne := false) -> void:
	if _prodleva > 0.0 and not samostatne:
		return
	_prodleva = 2.5
	var pred := hledanost
	hledanost = mini(5, hledanost + n)
	_chladnuti = 0.0
	if hledanost > pred:
		hra.hud.zprava("%s – jde po tobě policie!" % duvod, 3)


func _physics_process(delta: float) -> void:
	if hra == null or not Mapa.nacteno:
		return
	if graf == null:
		graf = Graf.nacti()
	_prodleva -= delta
	var cil := hra.kamera.cil.global_position
	# doplnit nebo odvolat hlídky
	if hlidky.size() < hledanost:
		_pridej_hlidku(cil)
	while hlidky.size() > hledanost:
		var h: Dictionary = hlidky.pop_back()
		h.uzel.queue_free()
	var nejbliz := INF
	for h: Dictionary in hlidky:
		_jed(h, cil, delta)
		nejbliz = minf(nejbliz, h.uzel.global_position.distance_to(cil))
	if hledanost > 0:
		_chladnuti = _chladnuti + delta if nejbliz > 125.0 else 0.0
		if _chladnuti > 11.0 + 3.0 * hledanost:
			hledanost -= 1
			_chladnuti = 0.0
			if hledanost == 0:
				hra.hud.zprava("Policie tě ztratila.", 3)
		var rychlost := _rychlost_hrace()
		if nejbliz < 9.0 and rychlost < 2.2 and (hra.rezim == "pesky" or hra.rezim == "auto"):
			_zatykani += delta
		else:
			_zatykani = maxf(0.0, _zatykani - delta * 2.0)
		if _zatykani > 2.2:
			_zatcen()
	else:
		_zatykani = 0.0
	hra.hud.hledanost(hledanost)


func _rychlost_hrace() -> float:
	if hra.rezim == "auto" and hra.auto_hrace:
		return hra.auto_hrace.linear_velocity.length()
	return Vector2(hra.chodec.velocity.x, hra.chodec.velocity.z).length()


func _zatcen() -> void:
	var pokuta := mini(hra.penize, maxi(200, roundi(hra.penize * 0.1 / 10.0) * 10))
	hra.pridej_penize(-pokuta)
	hledanost = 0
	_zatykani = 0.0
	_chladnuti = 0.0
	hra.statistiky["zatceni"] = int(hra.statistiky.get("zatceni", 0)) + 1
	# na nejbližší služebnu
	var p := hra.kamera.cil.global_position
	var nej := Vector2(Hra.START)
	var nej_d := INF
	var nazev := ""
	for s: Dictionary in Mapa.mista().get("sluzby", []):
		if s.druh != "police":
			continue
		var d := Vector2(s.x - p.x, s.z - p.z).length()
		if d < nej_d:
			nej_d = d
			nej = Vector2(s.x, s.z)
			nazev = s.nazev
	if hra.rezim == "auto":
		hra.vystoupit(true)
	if not hra.zakazky.zakazka.is_empty():
		hra.zakazky.zrus("preruseno", "Zatčení a pokuta %d Kč" % pokuta)
	hra.svet.postav_hned(nej, 200.0)
	hra.chodec.postav_na(nej.x, nej.y)
	hra.hud.zprava("Zatčen! Pokuta %d Kč. (%s)" % [pokuta, nazev], 5)
	hra.uloz()


func _pridej_hlidku(cil: Vector3) -> void:
	for pokus in 6:
		var uhel := nahoda.randf() * TAU
		var d := nahoda.randf_range(150.0, 220.0)
		var h := graf.nejblizsi_hrana(cil.x + sin(uhel) * d, cil.z + cos(uhel) * d, 50.0)
		if h.is_empty() or graf.trida[graf.h_silnice[h.hrana]] > 12:
			continue
		var uzel := Node3D.new()
		uzel.name = "Hlidka"
		var spec: Dictionary = Auto.TYPY.policie
		uzel.add_child(ModelAuta.karoserie(spec, Color(0.92, 0.92, 0.9), "policie"))
		var majak := OmniLight3D.new()
		majak.light_color = Color(0.2, 0.35, 1.0)
		majak.omni_range = 9.0
		majak.light_energy = 2.0
		majak.position.y = 2.0
		majak.name = "Majak"
		uzel.add_child(majak)
		var telo := AnimatableBody3D.new()
		telo.collision_layer = Hra.VRSTVA_VOZIDLA
		telo.collision_mask = 0
		var cs := CollisionShape3D.new()
		var tvar := BoxShape3D.new()
		tvar.size = Vector3(spec.wid, spec.h * 0.8, spec.len)
		cs.shape = tvar
		cs.position.y = 0.32 + spec.h * 0.4
		telo.add_child(cs)
		uzel.add_child(telo)
		add_child(uzel)
		var y := Mapa.vyska(h.x, h.z)
		uzel.global_position = Vector3(h.x, y, h.z)
		hlidky.append({"uzel": uzel, "body": PackedVector2Array(), "i": 0, "rychlost": 8.0, "prepocet": 0.0})
		return


func _jed(h: Dictionary, cil: Vector3, delta: float) -> void:
	var uzel: Node3D = h.uzel
	var p := uzel.global_position
	(uzel.get_node("Majak") as OmniLight3D).light_color = Color(0.2, 0.35, 1.0) if int(Time.get_ticks_msec() / 250) % 2 == 0 else Color(1.0, 0.15, 0.15)
	h.prepocet -= delta
	var primo: bool = p.distance_to(cil) < 60.0 or h.get("primo", false)
	if h.prepocet <= 0.0 and not primo:
		h.prepocet = 2.0
		h.body = graf.trasa_z_mista(p.x, p.z, Vector2(cil.x, cil.z), 6000)
		h.i = 0
	var dalsi := Vector2(cil.x, cil.z)
	if not primo and h.i < h.body.size():
		while h.i < h.body.size() - 1 and Vector2(p.x, p.z).distance_to(h.body[h.i]) < 4.0:
			h.i += 1
		dalsi = h.body[h.i]
		# u posledního uzlu trasy (hráč mimo silnici, např. v pěší zóně) jede hlídka přímo k němu
		if h.body.size() >= 2 and Vector2(p.x, p.z).distance_to(h.body[h.body.size() - 2]) < 15.0:
			h.primo = true
	var smer := dalsi - Vector2(p.x, p.z)
	var vzd := smer.length()
	if p.distance_to(cil) > 150.0:
		h.primo = false
	var cilova := 17.0 if not primo else clampf(p.distance_to(cil) - 6.0, 0.0, 12.0)
	h.rychlost = move_toward(h.rychlost, cilova, delta * 4.0)
	if vzd > 0.01:
		var krok := smer / vzd * minf(vzd, h.rychlost * delta)
		var nova := Vector3(p.x + krok.x, 0.0, p.z + krok.y)
		nova.y = Mapa.vyska(nova.x, nova.z) + Stavba.SURF
		var vpred := Vector3(smer.x, 0, smer.y).normalized()
		var stary := uzel.global_basis.z
		var plynule := stary.slerp(vpred, minf(1.0, delta * 4.0)) if stary.dot(vpred) > -0.9 else vpred
		uzel.global_transform = Transform3D(Basis.looking_at(-plynule.normalized(), Vector3.UP), nova)
