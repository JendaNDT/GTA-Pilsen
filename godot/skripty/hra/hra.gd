class_name Hra
extends Node3D
## Řízení hry: hráč pěšky nebo v autě, nastupování, kamera, ukazatele a herní čas.
## Hlavní scéna je res://sceny/hra.tscn.

## Výchozí místo: náměstí Republiky u katedrály (stejné jako START v předloze).
const START := Vector2(-42, 52)
const VRSTVA_SVET := 1
const VRSTVA_HRAC := 2
const VRSTVA_VOZIDLA := 4

signal rezim_zmenen(rezim: String)

@export var start := START

var rezim := "pesky"
var auto_hrace: Auto
var penize := 500
var cas_hodina := 14.0
var cas_den := 20619
var _info_cas := 0.0

@onready var svet: Svet = $Svet
@onready var prostredi: Prostredi = $Prostredi
@onready var chodec: Chodec = $Chodec
@onready var kamera: KameraHrace = $Kamera
@onready var auta: Node3D = $Auta
@onready var oblasti: Oblasti = $Oblasti
@onready var mhd: Mhd = $Mhd
@onready var menu: Menu = $Menu
@onready var zakazky: Zakazky = $Zakazky
@onready var mapa: MapaUI = $Mapa
@onready var doprava: Doprava = $Doprava
@onready var chodci: Chodci = $Chodci
@onready var policie: Policie = $Policie
var _narazy := 0
## Heliporty z předlohy: FN Lochotín, pivovar, Bory a náměstí Republiky.
const HELIPORTY := [Vector2(106, -1596), Vector2(984, -396), Vector2(-266, 1314), Vector2(48, 52)]
var vrtulniky := {}             ## index heliportu -> Vrtulnik
var vrtulnik: Vrtulnik          ## vrtulník, ve kterém hráč sedí
var _heliporty_cas := 0.0

var navigace_cil: Variant = null           ## vlastní cíl (Vector2) z mapy
var navigace_body := PackedVector2Array()  ## trasa k cíli po silnicích
var _navigace_cas := 0.0

var jizda: VuzMhd               ## vůz MHD, ve kterém hráč jede
var _odjezdy_cas := 0.0
var objevene := {}              ## id místa -> true
var statistiky := {}
var nastaveni := {}
var cas_zivy := true            ## herní čas běží podle hodin v Plzni
var _ukladani := 20.0
var _mista_cas := 0.0
var kvalita := ""                ## použitá předvolba (nizka, stredni, vysoka)
var nastaveni_prikaz := ""       ## kvalita z příkazové řádky (--kvalita nizka)
var _auto_kvalita := -1.0        ## měření snímků pro automatickou kvalitu
var _snimku := 0
@onready var hud: Hud = $Hud
@onready var dotyk: Dotyk = $Dotyk


func _ready() -> void:
	if not Mapa.nacti():
		hud.zprava("Chybí data mapy – viz godot/README.md", 60)
		return
	var a := OS.get_cmdline_user_args()
	for i in a.size():
		if a[i] == "--start" and i + 1 < a.size():
			var p := a[i + 1].split(",")
			start = Vector2(float(p[0]), float(p[1]))
	var nova := a.has("--nova-hra")
	if a.has("--kvalita") and a.find("--kvalita") + 1 < a.size():
		nastaveni_prikaz = a[a.find("--kvalita") + 1]
	var u := Ulozeni.nacti() if not nova else Ulozeni.VYCHOZI.duplicate(true)
	penize = int(u.penize)
	statistiky = u.statistiky
	nastaveni = u.nastaveni
	if nastaveni_prikaz != "":
		nastaveni.kvalita = nastaveni_prikaz
	for id: String in u.objevene:
		objevene[id] = true
	cas_zivy = bool(u.cas.zivy) or int(u.cas.den) < 0
	if cas_zivy:
		_nastav_cas_ze_systemu()
	else:
		nastav_cas(float(u.cas.hodina), int(u.cas.den))
	var ulozeny_hrac: Dictionary = u.hrac
	if not ulozeny_hrac.is_empty():
		start = Vector2(float(ulozeny_hrac.x), float(ulozeny_hrac.z))
	chodec.collision_layer = VRSTVA_HRAC
	chodec.collision_mask = VRSTVA_SVET | VRSTVA_VOZIDLA
	mhd.hodiny = ted
	_sleduj(chodec)
	dotyk.akce.connect(_akce)
	zakazky.hra = self
	doprava.hra = self
	chodci.hra = self
	policie.hra = self
	mapa.hra = self
	mapa.cil_nastaven.connect(func(b: Vector2, nazev: String) -> void:
		navigace_cil = b
		_navigace_cas = 0.0
		hud.zprava("Cíl nastaven%s – trasa je na minimapě." % ((" · " + nazev) if nazev != "" else ""), 3))
	var z: Dictionary = u.get("zakazky", {})
	if z.get("aktivni", "") != "":
		zakazky.posledni = {"typ": z.aktivni, "stav": "preruseno", "castka": 0, "poznamka": "Načtení uložené hry"}
	elif z.get("posledni", {}) is Dictionary:
		zakazky.posledni = z.get("posledni", {})
	_menu_zakazek()
	menu.zmena_nastaveni.connect(_zmena_nastaveni)
	menu.pozadavek.connect(_pozadavek_menu)
	_pouzij_kvalitu()
	hud.hodiny_viditelne(bool(nastaveni.get("hodiny", true)))
	AudioServer.set_bus_mute(0, not bool(nastaveni.get("zvuk", true)))
	hud.nacitani("Načítám Plzeň…")
	hud.penize(penize)
	# okolí startu se postaví hned, zbytek se dostaví během hry
	svet.postav_hned(start, 300.0)
	chodec.postav_na(start.x, start.y, float(ulozeny_hrac.get("y", NAN)))
	chodec.natoceni = float(ulozeny_hrac.get("natoceni", 2.4))
	var ulozene_auto: Dictionary = u.auto
	if ulozene_auto.is_empty():
		_postav_auto_u_startu()
	else:
		var smer := Vector3(sin(float(ulozene_auto.natoceni)), 0, cos(float(ulozene_auto.natoceni)))
		auto_hrace = postav_auto(ulozene_auto.typ, Vector3(float(ulozene_auto.x), float(ulozene_auto.y), float(ulozene_auto.z)),
			smer, Color.html(ulozene_auto.barva))
		if ulozeny_hrac.get("rezim", "") == "auto":
			nastoupit.call_deferred(auto_hrace)
	hud.nacitani("")
	hud.penize(penize)
	if Ulozeni.existuje() and not nova:
		hud.zprava("Pokračuješ v uložené hře.", 4)
	elif Vstup.aktivni_dotyk:
		hud.zprava("Vítej v Plzni! Páčkou vlevo chodíš, tahem vpravo otáčíš pohled.", 6)
	else:
		hud.zprava("Vítej v Plzni! WASD chůze, F nastoupit, myš otáčí kamerou.", 6)


## Herní čas v sekundách od 1. 1. 1970 (místní čas v Plzni), jako clock.now v předloze.
func ted() -> float:
	return cas_den * 86400.0 + cas_hodina * 3600.0


## Nastaví herní hodinu (a případně den).
func nastav_cas(hodina: float, den := -1) -> void:
	if den >= 0:
		cas_den = den
	cas_hodina = fposmod(hodina, 24.0)
	prostredi.nastav_hodinu(cas_hodina, cas_den)


func _nastav_cas_ze_systemu() -> void:
	var d := Time.get_datetime_dict_from_system()
	cas_den = Slunce.den_z_data(d.year, d.month, d.day)
	cas_hodina = d.hour + d.minute / 60.0
	prostredi.nastav_hodinu(cas_hodina, cas_den)


## Zaparkuje vůz u kraje nejbližší ulice (_spawnStarterCar v předloze: třída silnice III. třídy
## až obytná zóna do 120 m, okraj vozovky + 0,8 m, okrová barva).
func _postav_auto_u_startu() -> void:
	var u := Mapa.nejblizsi_ulice(start.x, start.y, 120.0, 12, 8)
	var bod := Vector3(start.x + 6, Mapa.vyska(start.x + 6, start.y), start.y)
	var smer := Vector3.FORWARD
	if not u.is_empty():
		smer = u.smer
		var bok := Vector3(-smer.z, 0, smer.x)
		var p: Vector3 = u.bod + bok * (float(u.sirka) * 0.5 + 0.8)
		bod = Vector3(p.x, Mapa.vyska(p.x, p.z), p.z)
	auto_hrace = postav_auto("hatch", bod, smer, Color.hex(0xc8922eff).srgb_to_linear())


func postav_auto(typ: String, bod: Vector3, smer: Vector3, barva: Color) -> Auto:
	var a := Auto.new()
	a.typ = typ
	a.barva = barva
	a.collision_layer = VRSTVA_VOZIDLA
	a.collision_mask = VRSTVA_SVET | VRSTVA_HRAC | VRSTVA_VOZIDLA
	auta.add_child(a)
	a.body_entered.connect(_naraz.bind(a))
	smer.y = 0
	a.global_transform = Transform3D(Basis.looking_at(-smer.normalized(), Vector3.UP), bod + Vector3(0, 0.15, 0))
	return a


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("menu") and not menu.visible:
		_akce("menu")
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("nastoupit"):
		_akce("nastoupit")
	elif event.is_action_pressed("na_silnici"):
		_akce("na_silnici")
	elif event.is_action_pressed("mapa"):
		_akce("mapa")
	elif event.is_action_pressed("zakazka"):
		_akce("zakazka")
	elif event.is_action_pressed("posun_casu"):
		cas_zivy = false
		nastav_cas(cas_hodina + 3.0)
		hud.zprava("Čas posunut o 3 hodiny", 2)


func _akce(nazev: String) -> void:
	match nazev:
		"nastoupit":
			if rezim == "vrtulnik":
				vystoupit_z_vrtulniku()
				return
			if rezim == "pesky":
				var h := vrtulnik_nablizku()
				if h:
					nastoupit_do_vrtulniku(h)
					return
				var v := mhd.vuz_k_nastupu(chodec.global_position)
				if v:
					nastoupit_mhd(v)
					return
				var vp := doprava.vuz_k_sebrani(chodec.global_position)
				if vp:
					var ukradene := doprava.narazeno(vp)
					hud.zprava("„Hej! To je moje auto!“", 2)
					if randf() < 0.6:
						prestupek(1, "Krádež auta")
					nastoupit(ukradene)
					return
				var a := auto_nablizku()
				if a:
					nastoupit(a)
			elif rezim == "auto":
				vystoupit()
			elif rezim == "mhd":
				vystoupit_z_mhd()
		"na_silnici":
			if rezim == "auto" and auto_hrace:
				auto_hrace.vrat_na_kola()
		"mapa":
			mapa.prepni()
		"zakazka":
			if not zakazky.zakazka.is_empty():
				zakazky.zrus()
			else:
				var chyba := zakazky.zacni("jidlo")
				if chyba != "":
					hud.zprava(chyba, 3)
		"menu":
			_menu_zakazek()
			menu.otevri(nastaveni, cas_zivy, cas_hodina, "Peníze: %s Kč · objevená místa: %d/%d" % [
				Hud._tisice(penize), objevene.size(), (Mapa.mista().get("pamatky", []) as Array).size()])


## Nejbližší auto do 4 m od hráče.
func auto_nablizku() -> Auto:
	var nej: Auto = null
	var nej_d := 4.0
	for a: Node in auta.get_children():
		if a is Auto:
			var d := (a as Auto).global_position.distance_to(chodec.global_position)
			if d < nej_d:
				nej_d = d
				nej = a
	return nej


func nastoupit(a: Auto) -> void:
	auto_hrace = a
	rezim = "auto"
	chodec.aktivni = false
	chodec.visible = false
	chodec.collision_layer = 0
	chodec.collision_mask = 0
	a.ridi_hrac = true
	a.sleeping = false
	_sleduj(a)
	rezim_zmenen.emit(rezim)


func vystoupit(vynutit := false) -> bool:
	if auto_hrace == null:
		return false
	if absf(auto_hrace.rychlost()) > 4.0 and not vynutit:
		hud.zprava("Nejdřív zpomal", 1.5)
		return false
	var a := auto_hrace
	a.ridi_hrac = false
	var p := a.misto_vystupu()
	var y := _povrch(p)
	chodec.global_position = Vector3(p.x, y + 0.05, p.z)
	chodec.velocity = Vector3.ZERO
	chodec.aktivni = true
	chodec.visible = true
	chodec.collision_layer = VRSTVA_HRAC
	chodec.collision_mask = VRSTVA_SVET | VRSTVA_VOZIDLA
	chodec.natoceni = atan2(a.global_basis.z.x, a.global_basis.z.z)
	_sleduj(chodec)
	rezim = "pesky"
	rezim_zmenen.emit(rezim)
	return true


## Nástup do vozu MHD s otevřenými dveřmi.
func nastoupit_mhd(v: VuzMhd) -> void:
	jizda = v
	v.set_meta("cestujici", true)
	rezim = "mhd"
	chodec.aktivni = false
	chodec.visible = false
	chodec.collision_layer = 0
	chodec.collision_mask = 0
	_sleduj(v.clanky[0])
	hud.zprava("Nastoupil(a) jsi: %s" % v.nazev_spoje(), 3)
	rezim_zmenen.emit(rezim)


## Výstup z MHD (jen při otevřených dveřích, na konečné i automaticky).
func vystoupit_z_mhd(vynutit := false) -> bool:
	if jizda == null:
		return false
	if not jizda.dvere_otevrene and not vynutit:
		hud.zprava("Vystoupit lze, až vůz zastaví a otevře dveře", 1.5)
		return false
	var p := jizda.misto_dveri(1.0)
	var y := _povrch(p)
	chodec.global_position = Vector3(p.x, y + 0.05, p.z)
	chodec.velocity = Vector3.ZERO
	chodec.aktivni = true
	chodec.visible = true
	chodec.collision_layer = VRSTVA_HRAC
	chodec.collision_mask = VRSTVA_SVET | VRSTVA_VOZIDLA
	jizda.remove_meta("cestujici")
	jizda = null
	rezim = "pesky"
	_sleduj(chodec)
	rezim_zmenen.emit(rezim)
	return true


func vrtulnik_nablizku() -> Vrtulnik:
	for h: Vrtulnik in vrtulniky.values():
		if is_instance_valid(h) and h.global_position.distance_to(chodec.global_position) < 5.5:
			return h
	return null


func nastoupit_do_vrtulniku(h: Vrtulnik) -> void:
	vrtulnik = h
	h.obsazeny = true
	rezim = "vrtulnik"
	chodec.aktivni = false
	chodec.visible = false
	chodec.collision_layer = 0
	chodec.collision_mask = 0
	_sleduj(h)
	hud.zprava("Vrtulník: Mezerník stoupání, Shift klesání, W/S vpřed a vzad, A/D otáčení", 5)
	rezim_zmenen.emit(rezim)


func vystoupit_z_vrtulniku(vynutit := false) -> bool:
	if vrtulnik == null:
		return false
	if not vynutit and not (vrtulnik.pristany or (vrtulnik.vyska_nad_terenem() < 1.5 and vrtulnik.linear_velocity.length() < 2.0)):
		hud.zprava("Nejdřív přistaň", 1.5)
		return false
	var p := vrtulnik.global_transform * Vector3(2.2, 0.0, 0.5)
	chodec.global_position = Vector3(p.x, _povrch(p + Vector3(0, 2.0, 0)) + 0.05, p.z)
	chodec.velocity = Vector3.ZERO
	chodec.aktivni = true
	chodec.visible = true
	chodec.collision_layer = VRSTVA_HRAC
	chodec.collision_mask = VRSTVA_SVET | VRSTVA_VOZIDLA
	vrtulnik.obsazeny = false
	vrtulnik = null
	rezim = "pesky"
	_sleduj(chodec)
	rezim_zmenen.emit(rezim)
	return true


## Vrtulníky se objeví na heliportech, jakmile je v jejich okolí postavený svět s kolizemi.
func _hlidej_heliporty(delta: float) -> void:
	_heliporty_cas -= delta
	if _heliporty_cas > 0.0:
		return
	_heliporty_cas = 1.0
	var p := kamera.cil.global_position
	for i in HELIPORTY.size():
		var bod: Vector2 = HELIPORTY[i]
		var d := Vector2(p.x, p.z).distance_to(bod)
		if vrtulniky.has(i):
			if d > 1500.0 and vrtulniky[i] != vrtulnik:
				vrtulniky[i].queue_free()
				vrtulniky.erase(i)
			continue
		if d > 350.0:
			continue
		var y := _povrch(Vector3(bod.x, Mapa.vyska(bod.x, bod.y) + 150.0, bod.y))
		var h := Vrtulnik.new()
		h.name = "Vrtulnik%d" % i
		h.collision_layer = VRSTVA_VOZIDLA
		h.collision_mask = VRSTVA_SVET | VRSTVA_HRAC | VRSTVA_VOZIDLA
		auta.add_child(h)
		h.global_position = Vector3(bod.x, y + 0.2, bod.y)
		h.rotation.y = i * 1.3
		vrtulniky[i] = h


## Kamera, načítání mapy, oblastí a MHD sledují hráče nebo jeho vozidlo.
func _sleduj(uzel: Node3D) -> void:
	kamera.cil = uzel
	svet.sledovat = uzel
	doprava.sledovat = uzel
	chodci.sledovat = uzel
	oblasti.sledovat = uzel
	mhd.sledovat = uzel


## Výška pochozího povrchu v bodě (most, střecha i terén) paprskem shora.
func _povrch(p: Vector3) -> float:
	var teren := Mapa.vyska(p.x, p.z)
	var dotaz := PhysicsRayQueryParameters3D.create(Vector3(p.x, maxf(p.y, teren) + 3.0, p.z), Vector3(p.x, teren - 1.0, p.z), VRSTVA_SVET)
	var hit := get_world_3d().direct_space_state.intersect_ray(dotaz)
	return maxf(teren, (hit.position as Vector3).y) if not hit.is_empty() else teren


func _process(delta: float) -> void:
	if not Mapa.nacteno:
		return
	_hlidej_kvalitu(delta)
	chodec.smer_kamery = kamera.yaw
	# herní čas plyne stejně rychle jako skutečný
	cas_hodina += delta / 3600.0
	if cas_hodina >= 24.0:
		cas_hodina -= 24.0
		cas_den += 1
	if Auto.herni_den != cas_den:
		Auto.herni_den = cas_den
		Zlomitelny.oprav(cas_den)
	_ukladani -= delta
	if _ukladani <= 0.0:
		_ukladani = 20.0
		uloz()
	_navigace(delta)
	_hlidej_heliporty(delta)
	_mista_cas -= delta
	if _mista_cas <= 0.0:
		_mista_cas = 0.5
		_kontrola_mist()
	_info_cas -= delta
	if _info_cas <= 0.0:
		_info_cas = 0.5
		var p := kamera.cil.global_position
		# jako v předloze: ulice do 45 m (bez pěšin), pod ní čtvrť a nadmořská výška
		var u := Mapa.nejblizsi_ulice(p.x, p.z, 45.0, 14)
		var ctvrt := Mapa.nejblizsi_obec(p.x, p.z)
		hud.misto(u.get("nazev", "") if not u.is_empty() else "",
			("%s · " % ctvrt if ctvrt != "" else "") + "%d m n. m." % Mapa.nadmorska_vyska(p.y))
		hud.cas("%02d:%02d" % [int(cas_hodina), int(fmod(cas_hodina, 1.0) * 60.0)])
		prostredi.nastav_hodinu(cas_hodina, cas_den)
	if OS.has_feature("web") and _info_cas == 0.5:
		_stav_pro_prohlizec()
	if rezim == "auto" and auto_hrace:
		hud.rychlost(auto_hrace.rychlost_kmh())
		hud.napoveda("F – vystoupit" if absf(auto_hrace.rychlost()) < 4.0 else "")
	elif rezim == "vrtulnik" and vrtulnik:
		hud.rychlost(vrtulnik.rychlost_kmh())
		hud.napoveda("Vrtulník · výška %d m%s" % [roundi(vrtulnik.vyska_nad_terenem()), " · F vystoupit" if vrtulnik.pristany else ""])
	elif rezim == "mhd" and jizda:
		hud.rychlost(-1)
		var pristi := jizda.pristi_zastavka()
		hud.napoveda("%s · %s%s" % [jizda.nazev_spoje(), ("zastávka " if jizda.dvere_otevrene else "příští: ") + pristi,
			" · F vystoupit" if jizda.dvere_otevrene else ""])
		if jizda.index >= jizda.udalost.spoj.zastaveni.size():
			vystoupit_z_mhd(true)
	else:
		hud.rychlost(-1)
		var v := mhd.vuz_k_nastupu(chodec.global_position)
		if v:
			hud.napoveda("F – nastoupit · %s" % v.nazev_spoje())
		else:
			hud.napoveda("F – nastoupit do auta" if auto_nablizku() else "")
		_odjezdy_cas -= delta
		if _odjezdy_cas <= 0.0:
			_odjezdy_cas = 1.0
			hud.odjezdy(mhd.odjezdy_u(chodec.global_position))
	if rezim != "pesky":
		hud.odjezdy(null)


## Ve webové verzi zapíše stav hry do window.__plzen (pro zkoušky v prohlížeči).
func _stav_pro_prohlizec() -> void:
	var p := kamera.cil.global_position
	var stav := {"x": p.x, "y": p.y, "z": p.z, "rezim": rezim, "dlazdice": svet.pocet_hotovych(),
		"ceka": svet.ceka_na_stavbu(), "dotyk": Vstup.aktivni_dotyk, "fps": Engine.get_frames_per_second()}
	JavaScriptBridge.eval("window.__plzen = %s;" % JSON.stringify(stav), true)


# ------------------------------------------------------------------ peníze, objevy, ukládání

## Přestupek zvýší hledanost (policie).
func prestupek(n: int, duvod: String) -> void:
	policie.pridej(n, duvod)


## Náraz auta: vůz z provozu se stane fyzikálním, opakované nárazy hráče jsou nebezpečná jízda.
func _naraz(telo: Node, a: Auto) -> void:
	if a != auto_hrace or rezim != "auto":
		return
	if telo.has_meta("vuz_provozu"):
		doprava.narazeno(telo.get_meta("vuz_provozu"))
	if telo is Auto or telo.has_meta("vuz_provozu"):
		if a.linear_velocity.length() > 5.0:
			_narazy += 1
			if _narazy >= 3:
				_narazy = 0
				prestupek(1, "Nebezpečná jízda")


func pridej_penize(kc: int) -> void:
	penize = maxi(0, penize + kc)
	hud.penize(penize)


## Objevení památky: do 75 m od místa (missions.js v předloze), odměna a krátký popis.
func _kontrola_mist() -> void:
	if rezim == "auto" and auto_hrace == null:
		return
	var p := kamera.cil.global_position
	for o: Node in oblasti.get_children():
		var skupina := o.get_node_or_null("Mista")
		if skupina == null:
			continue
		for m in skupina.get_children():
			if not m is Misto or objevene.has(m.id):
				continue
			var g: Vector3 = m.global_position
			if Vector2(g.x - p.x, g.z - p.z).length() < m.dosah:
				objev(m)


func objev(m: Misto) -> void:
	objevene[m.id] = true
	pridej_penize(m.odmena)
	var celkem: int = (Mapa.mista().get("pamatky", []) as Array).size()
	hud.zprava("Objeveno: %s (%d/%d) · +%d Kč%s" % [m.nazev, objevene.size(), celkem, m.odmena,
		("\n" + m.popis) if m.popis != "" else ""], 7)
	uloz()


## Stav hry k uložení.
func stav() -> Dictionary:
	var u: Dictionary = Ulozeni.VYCHOZI.duplicate(true)
	u.penize = penize
	u.objevene = objevene.keys()
	u.statistiky = statistiky
	u.zakazky = {"aktivni": zakazky.zakazka.get("typ", ""), "posledni": zakazky.posledni}
	u.nastaveni = nastaveni
	u.cas = {"zivy": cas_zivy, "den": cas_den, "hodina": cas_hodina}
	var p := chodec.global_position
	if rezim == "auto" and auto_hrace:
		p = auto_hrace.global_position
	elif rezim == "vrtulnik" and vrtulnik:
		hud.rychlost(vrtulnik.rychlost_kmh())
		hud.napoveda("Vrtulník · výška %d m%s" % [roundi(vrtulnik.vyska_nad_terenem()), " · F vystoupit" if vrtulnik.pristany else ""])
	elif rezim == "mhd" and jizda:
		p = jizda.misto_dveri(1.0)
		p.y = _povrch(p)
	elif rezim == "vrtulnik" and vrtulnik:
		p = vrtulnik.global_position
		p.y = Mapa.vyska(p.x, p.z)
	u.hrac = {"x": p.x, "y": p.y, "z": p.z, "natoceni": chodec.natoceni, "rezim": rezim if rezim == "auto" else "pesky"}
	if auto_hrace:
		var a := auto_hrace.global_position
		var z := auto_hrace.global_basis.z
		u.auto = {"typ": auto_hrace.typ, "barva": auto_hrace.barva.to_html(false), "x": a.x, "y": a.y + 0.1, "z": a.z,
			"natoceni": atan2(z.x, z.z)}
	return u


func uloz() -> bool:
	return Ulozeni.uloz(stav())


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST and Mapa.nacteno:
		uloz()


# ------------------------------------------------------------------ nastavení

func _pouzij_kvalitu() -> void:
	var volba: String = nastaveni.get("kvalita", "auto")
	if volba == "auto":
		kvalita = Kvalita.pouzij(Kvalita.vychozi() if kvalita == "" else kvalita, svet, prostredi, get_viewport())
		_auto_kvalita = 10.0
		_snimku = 0
	else:
		kvalita = Kvalita.pouzij(volba, svet, prostredi, get_viewport())
		_auto_kvalita = -1.0


## Automatická kvalita: po 10 s hraní sníží předvolbu, když hra běží pod 30 snímků za sekundu.
func _hlidej_kvalitu(delta: float) -> void:
	if _auto_kvalita < 0.0:
		return
	_auto_kvalita -= delta
	_snimku += 1
	if _auto_kvalita > 0.0:
		return
	var fps := _snimku / 10.0
	_auto_kvalita = -1.0
	var i := Kvalita.PORADI.find(kvalita)
	if fps < 30.0 and i > 0:
		kvalita = Kvalita.pouzij(Kvalita.PORADI[i - 1], svet, prostredi, get_viewport())
		hud.zprava("Kvalita grafiky snížena na %s (%.0f snímků/s)" % [Kvalita.PREDVOLBY[kvalita].nazev.to_lower(), fps], 3)


func _zmena_nastaveni(klic: String, hodnota: Variant) -> void:
	match klic:
		"kvalita":
			nastaveni.kvalita = hodnota
			kvalita = ""
			_pouzij_kvalitu()
		"zvuk":
			nastaveni.zvuk = hodnota
			AudioServer.set_bus_mute(0, not hodnota)
		"hodiny":
			nastaveni.hodiny = hodnota
			hud.hodiny_viditelne(hodnota)
		"cas_zivy":
			cas_zivy = hodnota
			if hodnota:
				_nastav_cas_ze_systemu()
		"hodina":
			cas_zivy = false
			nastav_cas(hodnota)
	uloz()


func _pozadavek_menu(akce: String) -> void:
	match akce:
		"ulozit":
			if uloz():
				hud.zprava("Hra uložena", 2)
		"nova_hra":
			Ulozeni.smaz()
			menu.zavri()
			get_tree().reload_current_scene()
		"konec":
			uloz()
			get_tree().quit()


## Karta Zakázky v menu: nabídka a poslední výsledek.
func _menu_zakazek() -> void:
	var k := menu.karta("zakazky")
	for n in k.get_children():
		n.queue_free()
	var info := Label.new()
	info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	info.text = "Rozvážej jídlo ze skutečných podniků na skutečné adresy, nebo vozi zákazníky autem.\n" + \
		("Poslední: " + Zakazky.text_vysledku(zakazky.posledni) if not zakazky.posledni.is_empty() else "")
	k.add_child(info)
	for volba: Array in [["Rozvoz jídla (J)", "jidlo"], ["Taxi (musíš sedět v autě)", "taxi"]]:
		var b := Button.new()
		b.text = volba[0]
		b.custom_minimum_size = Vector2(0, 44)
		var typ: String = volba[1]
		b.pressed.connect(func() -> void:
			menu.zavri()
			var chyba := zakazky.zacni(typ)
			if chyba != "":
				hud.zprava(chyba, 3))
		k.add_child(b)
	var z := Button.new()
	z.text = "Zrušit probíhající zakázku"
	z.custom_minimum_size = Vector2(0, 44)
	z.pressed.connect(func() -> void:
		menu.zavri()
		zakazky.zrus())
	k.add_child(z)


## Trasa po silnicích k cíli zakázky nebo k vlastnímu cíli (obnovuje se každé 2,2 s).
func _navigace(delta: float) -> void:
	var p := kamera.cil.global_position
	var cil: Variant = null
	var z: Variant = zakazky.cil()
	if z != null:
		cil = Vector2(z.x, z.z)
	elif navigace_cil != null:
		cil = navigace_cil
		if Vector2(p.x, p.z).distance_to(navigace_cil) < 22.0:
			navigace_cil = null
			navigace_body = PackedVector2Array()
			hud.zprava("Jsi v cíli.", 2)
			return
	if cil == null:
		navigace_body = PackedVector2Array()
		return
	_navigace_cas -= delta
	if _navigace_cas > 0.0:
		return
	_navigace_cas = 2.2
	navigace_body = PackedVector2Array([Vector2(p.x, p.z)])
	navigace_body.append_array(Graf.nacti().trasa_z_mista(p.x, p.z, cil, 18000))
