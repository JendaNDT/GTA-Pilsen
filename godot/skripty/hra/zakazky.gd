class_name Zakazky
extends Node3D
## Zakázky: rozvoz jídla a taxi (převod src/game/missions.js a work-sites.js).
## Rozvoz: vyzvedni jídlo v podniku, doruč na adresu v časovém limitu. Taxi: zastav u zákazníka
## u kraje vozovky, odvez ho plynule do cíle. Výsledek se přičte k penězům a uloží.

signal dokonceno(vysledek: Dictionary)

const NAZVY := {"jidlo": "Rozvoz jídla", "taxi": "Taxi"}
const DRUHY_PODNIKU := ["restaurace", "rychlé občerstvení", "kavárna", "hospoda"]
const VYSLEDKY := {"zaplaceno": "Dokončeno", "zruseno": "Zrušeno", "preruseno": "Přerušeno", "vyprseno": "Vypršel čas"}

var hra: Hra
var zakazka := {}               ## probíhající zakázka (prázdná = žádná)
var posledni := {}              ## poslední výsledek
var nahoda := RandomNumberGenerator.new()
var _majak: Node3D
var _zakaznik: Postava


func _ready() -> void:
	nahoda.randomize()
	_majak = _postav_majak(Color(0.95, 0.71, 0.2))
	_majak.visible = false
	add_child(_majak)


static func _peti(kc: float) -> int:
	return roundi(kc / 5.0) * 5


static func text_vysledku(v: Dictionary) -> String:
	if v.is_empty():
		return ""
	return "%s · %s%s%s" % [NAZVY.get(v.typ, v.typ), VYSLEDKY.get(v.stav, v.stav),
		(" · +%d Kč" % v.castka) if v.castka else "", (" · " + v.poznamka) if v.get("poznamka", "") != "" else ""]


## Vertikální světelný sloup s kroužkem (makeBeacon v předloze).
static func _postav_majak(barva: Color) -> Node3D:
	var m := Node3D.new()
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color = Color(barva, 0.35)
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	var sloup := MeshInstance3D.new()
	var c := CylinderMesh.new()
	c.top_radius = 1.2
	c.bottom_radius = 1.2
	c.height = 60.0
	c.cap_top = false
	c.cap_bottom = false
	c.material = mat
	sloup.mesh = c
	sloup.position.y = 30.0
	sloup.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	m.add_child(sloup)
	var kruh := MeshInstance3D.new()
	var t := TorusMesh.new()
	t.inner_radius = 3.6
	t.outer_radius = 4.2
	var mat2 := mat.duplicate()
	mat2.albedo_color = Color(barva, 0.8)
	t.material = mat2
	kruh.mesh = t
	kruh.name = "Kruh"
	kruh.position.y = 0.3
	m.add_child(kruh)
	return m


## Bod u kraje nejbližší vhodné silnice (snap v předloze).
func _u_silnice(x: float, z: float) -> Vector2:
	var g := Graf.nacti()
	var h := g.nejblizsi_hrana(x, z, 60.0)
	return Vector2(h.x, h.z) if not h.is_empty() else Vector2(x, z)


## Místo u pravého kraje vozovky pro taxi (curbStop v předloze, bez kontroly přechodů).
func _u_obrubniku(x: float, z: float, polomer := 58.0) -> Dictionary:
	var g := Graf.nacti()
	var nej := {}
	var skore := polomer
	var hrany := {}
	for dz in range(-1, 2):
		for dx in range(-1, 2):
			for e: int in g._mrizka.get(Vector2i(floori(x / Graf.BUNKA) + dx, floori(z / Graf.BUNKA) + dz), PackedInt32Array()):
				hrany[e] = true
	for e: int in hrany:
		for smer in 2:
			var hrana := e
			if smer == 1:
				hrana = _opacna(g, e)
				if hrana < 0:
					continue
			var silnice := g.h_silnice[hrana]
			var delka := g.h_delka[hrana]
			var sirka := g.sirka[silnice]
			if g.trida[silnice] < 8 or g.trida[silnice] > 12 or g.priznaky[silnice] & (Graf.RF_PRIVATE | Graf.RF_BRIDGE | Graf.RF_TUNNEL | Graf.RF_ROUNDABOUT) \
					or delka < 24.0 or sirka < 4.0:
				continue
			var obrubnik := maxf(1.2, sirka / 2.0 - 1.0)
			var podel := 10.0
			while podel <= delka - 10.0:
				var p := g.bod_na_hrane(hrana, podel, obrubnik)
				var d := Vector2(p.x - x, p.y - z).length()
				if d < skore:
					var cekani := g.bod_na_hrane(hrana, podel, sirka / 2.0 + 0.85)
					nej = {"x": p.x, "z": p.y, "tx": p.z, "tz": p.w, "hrana": hrana, "podel": podel,
						"cekani": Vector2(cekani.x, cekani.y)}
					skore = d
				podel += 5.0
	return nej


static func _opacna(g: Graf, e: int) -> int:
	var a := g.h_od[e]
	var b := g.h_do[e]
	for q in range(g.vystup_zac[b], g.vystup_zac[b + 1]):
		var f := g.vystup_hrany[q]
		if g.h_do[f] == a and g.h_a[f] == g.h_b[e] and g.h_b[f] == g.h_a[e]:
			return f
	return -1


## Vezme novou zakázku. Vrací text chyby, nebo "".
func zacni(typ: String) -> String:
	if not zakazka.is_empty():
		return "Nejdřív dokonči nebo zruš probíhající zakázku."
	var ukol := {}
	if typ == "jidlo":
		ukol = _jidlo()
		if ukol.is_empty():
			return "V okolí není dostupný rozvoz."
	elif typ == "taxi":
		if hra.rezim != "auto" or hra.auto_hrace == null:
			return "Nejdřív nastup do pojízdného osobního auta."
		ukol = _taxi()
		if ukol.is_empty():
			return "V okolí teď není dostupná jízda. Zkus to v jiné ulici."
	zakazka = ukol
	zakazka.typ = typ
	zakazka.faze = "vyzvednuti"
	zakazka.cas = 180.0 if typ == "taxi" else -1.0
	if typ == "taxi":
		_zakaznik = Postava.new()
		_zakaznik.oblecek = Color(0.55, 0.2, 0.25)
		add_child(_zakaznik)
		var w: Vector2 = ukol.vyzvednuti.cekani
		_zakaznik.global_position = Vector3(w.x, Mapa.vyska(w.x, w.y), w.y)
		_zakaznik.rotation.y = atan2(-ukol.vyzvednuti.tz, ukol.vyzvednuti.tx)
	hra.hud.zprava("%s · %s" % [NAZVY[typ], ukol.nazev], 4)
	return ""


func _jidlo() -> Dictionary:
	var p := hra.kamera.cil.global_position
	var podniky: Array = Mapa.mista().podniky
	var kandidati := []
	for f: Dictionary in podniky:
		var d := Vector2(f.x - p.x, f.z - p.z).length()
		if d > 90.0 and d < 1400.0:
			kandidati.append([d, f])
	if kandidati.is_empty():
		return {}
	kandidati.sort_custom(func(a: Array, b: Array) -> bool: return a[0] < b[0])
	var f: Dictionary = kandidati[nahoda.randi_range(0, mini(6, kandidati.size()) - 1)][1]
	var vyzvednuti := _u_silnice(f.x, f.z)
	var adresy: Array = Mapa.mista().adresy
	var adresa: Array = []
	for t in 60:
		var a: Array = adresy[nahoda.randi_range(0, adresy.size() - 1)]
		var d := Vector2(a[0] - f.x, a[1] - f.z).length()
		if d > 500.0 and d < 2600.0 and Mapa.hranice.grow(-120.0).has_point(Vector2(a[0], a[1])):
			adresa = a
			break
	if adresa.is_empty():
		return {}
	var doruceni := _u_silnice(adresa[0], adresa[1])
	var delka := Graf.nacti().delka_trasy(vyzvednuti.x, vyzvednuti.y, doruceni.x, doruceni.y)
	var ulice: int = adresa[2]
	var nazev_ulice: String = Mapa.nazvy_ulic[ulice] if ulice >= 0 and ulice < Mapa.nazvy_ulic.size() else ""
	return {"nazev": f.nazev, "druh": DRUHY_PODNIKU[int(f.druh)] if int(f.druh) < 4 else "podnik",
		"vyzvednuti": {"x": vyzvednuti.x, "z": vyzvednuti.y}, "doruceni": {"x": doruceni.x, "z": doruceni.y},
		"adresa": "%s %s" % [nazev_ulice, adresa[3]], "delka": delka,
		"limit": roundf(delka / 8.5 + 40.0), "odmena": _peti(90.0 + delka * 0.11)}


func _taxi() -> Dictionary:
	var p := hra.kamera.cil.global_position
	var adresy: Array = Mapa.mista().adresy
	var blizke := []
	var daleke := []
	for a: Array in adresy:
		if a[2] < 0 or str(a[3]) == "":
			continue
		var d := Vector2(a[0] - p.x, a[1] - p.z).length()
		if d > 120.0 and d < 850.0:
			blizke.append(a)
		if d > 950.0 and d < 2700.0:
			daleke.append(a)
	var nazev := func(a: Array) -> String: return "%s %s" % [Mapa.nazvy_ulic[a[2]], a[3]]
	for i in 16:
		if blizke.is_empty():
			break
		var odkud: Array = blizke.pop_at(nahoda.randi_range(0, blizke.size() - 1))
		var vyz := _u_obrubniku(odkud[0], odkud[1])
		if vyz.is_empty():
			continue
		for k in 18:
			if daleke.is_empty():
				break
			var kam: Array = daleke.pop_at(nahoda.randi_range(0, daleke.size() - 1))
			var dor := _u_obrubniku(kam[0], kam[1])
			if dor.is_empty() or Vector2(vyz.x - dor.x, vyz.z - dor.z).length() < 800.0:
				continue
			var delka := Graf.nacti().delka_trasy(vyz.x, vyz.z, dor.x, dor.z)
			if delka > 4400.0:
				continue
			return {"nazev": nazev.call(odkud), "adresa": nazev.call(kam), "vyzvednuti": vyz, "doruceni": dor,
				"delka": delka, "limit": ceilf(delka / 7.0 + 75.0), "odmena": _peti(125.0 + delka * 0.15),
				"plynulost": 90.0, "rychlost": 0.0, "auto": hra.auto_hrace}
	return {}


func zrus(stav := "zruseno", poznamka := "Zrušeno hráčem") -> void:
	if zakazka.is_empty():
		return
	posledni = {"typ": zakazka.typ, "stav": stav, "castka": 0, "poznamka": poznamka}
	_vycisti()
	hra.hud.zprava(text_vysledku(posledni), 5)


func _vycisti() -> void:
	if _zakaznik:
		_zakaznik.queue_free()
		_zakaznik = null
	zakazka = {}
	_majak.visible = false
	hra.hud.zakazka("")


func _dokonci() -> void:
	var j := zakazka
	var spropitne := _peti(maxf(0.0, j.cas) / j.limit * 80.0)
	var plynulost := _peti(j.get("plynulost", 0.0))
	var castka: int = j.odmena + spropitne + plynulost
	var poznamka := ("%d Kč jízdné + %d Kč za čas + %d Kč za plynulost" % [j.odmena, spropitne, plynulost]) if j.typ == "taxi" \
		else (("%d Kč odměna + %d Kč spropitné" % [j.odmena, spropitne]) if spropitne else "")
	posledni = {"typ": j.typ, "stav": "zaplaceno", "castka": castka, "poznamka": poznamka}
	var klic := "taxi" if j.typ == "taxi" else "rozvozy"
	hra.statistiky[klic] = int(hra.statistiky.get(klic, 0)) + 1
	hra.pridej_penize(castka)
	_vycisti()
	hra.uloz()
	hra.hud.zprava(text_vysledku(posledni), 6)
	dokonceno.emit(posledni)


## Cíl zakázky (bod), nebo null.
func cil() -> Variant:
	if zakazka.is_empty():
		return null
	return zakazka.vyzvednuti if zakazka.faze == "vyzvednuti" else zakazka.doruceni


func _process(delta: float) -> void:
	if zakazka.is_empty() or hra == null:
		return
	var j := zakazka
	var uzel := hra.kamera.cil
	var p := uzel.global_position
	var rychlost := 0.0
	if hra.rezim == "auto" and hra.auto_hrace:
		rychlost = Vector2(hra.auto_hrace.linear_velocity.x, hra.auto_hrace.linear_velocity.z).length()
	elif hra.rezim == "pesky":
		rychlost = Vector2(hra.chodec.velocity.x, hra.chodec.velocity.z).length()
	if j.typ == "taxi" and (hra.rezim != "auto" or hra.auto_hrace != j.auto):
		zrus("preruseno", "Vystoupil jsi z auta")
		return
	if j.cas >= 0.0:
		j.cas -= delta
		if j.cas <= 0.0:
			zrus("vyprseno", "Bez odměny")
			return
	var t: Dictionary = cil()
	var d := Vector2(t.x - p.x, t.z - p.z).length()
	var zem := Mapa.vyska(t.x, t.z)
	_majak.visible = true
	_majak.global_position = Vector3(t.x, zem, t.z)
	_majak.get_node("Kruh").scale = Vector3.ONE * (1.0 + sin(Time.get_ticks_msec() / 300.0) * 0.12)
	var u_cile := func(polomer: float) -> bool: return d < polomer and absf(p.y - zem) < 4.5
	var pokyn := ""
	if j.faze == "vyzvednuti":
		pokyn = ("Zastav u zákazníka · %s" % j.nazev) if j.typ == "taxi" else ("Vyzvedni jídlo · %s (%s)" % [j.nazev, j.druh])
		var hotovo: bool = (u_cile.call(6.5) and rychlost < 1.6) if j.typ == "taxi" else (d < 11.0 and rychlost < 7.0)
		if hotovo:
			j.cas = j.limit
			j.faze = "doruceni"
			if _zakaznik:
				_zakaznik.visible = false
			hra.hud.zprava(("Zákazník nastoupil. Cíl · %s" if j.typ == "taxi" else "Jídlo vyzvednuto · %s") % j.adresa, 3)
	else:
		pokyn = ("Zastav u cíle · %s · bonus za plynulost %d Kč" % [j.adresa, _peti(j.plynulost)]) if j.typ == "taxi" \
			else ("Doruč na adresu %s" % j.adresa)
		if j.typ == "taxi":
			if delta > 0.0 and j.rychlost > 9.0 and j.rychlost - rychlost > 11.0 * delta:
				j.plynulost = maxf(0.0, j.plynulost - 5.0 * delta)
			j.rychlost = rychlost
		var hotovo2: bool = (u_cile.call(6.5) and rychlost < 1.6) if j.typ == "taxi" else (d < 11.0 and rychlost < 7.0)
		if hotovo2:
			_dokonci()
			return
	var cas_text := "" if j.cas < 0.0 else " · %d:%02d" % [int(j.cas) / 60, int(j.cas) % 60]
	hra.hud.zakazka("%s\n%s\n%d m%s · odměna od %d Kč" % [NAZVY[j.typ], pokyn, roundi(d), cas_text, j.odmena])
