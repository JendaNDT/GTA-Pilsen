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

var jizda: VuzMhd               ## vůz MHD, ve kterém hráč jede
var _odjezdy_cas := 0.0
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
	_nastav_cas_ze_systemu()
	chodec.collision_layer = VRSTVA_HRAC
	chodec.collision_mask = VRSTVA_SVET | VRSTVA_VOZIDLA
	mhd.hodiny = ted
	_sleduj(chodec)
	dotyk.akce.connect(_akce)
	hud.nacitani("Načítám Plzeň…")
	hud.penize(penize)
	# okolí startu se postaví hned, zbytek se dostaví během hry
	svet.postav_hned(start, 300.0)
	chodec.postav_na(start.x, start.y)
	chodec.natoceni = 2.4
	_postav_auto_u_startu()
	hud.nacitani("")
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
	smer.y = 0
	a.global_transform = Transform3D(Basis.looking_at(-smer.normalized(), Vector3.UP), bod + Vector3(0, 0.15, 0))
	return a


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("nastoupit"):
		_akce("nastoupit")
	elif event.is_action_pressed("na_silnici"):
		_akce("na_silnici")
	elif event.is_action_pressed("posun_casu"):
		cas_hodina = fmod(cas_hodina + 3.0, 24.0)
		prostredi.nastav_hodinu(cas_hodina, cas_den)
		hud.zprava("Čas posunut o 3 hodiny", 2)


func _akce(nazev: String) -> void:
	match nazev:
		"nastoupit":
			if rezim == "pesky":
				var v := mhd.vuz_k_nastupu(chodec.global_position)
				if v:
					nastoupit_mhd(v)
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


func vystoupit() -> bool:
	if auto_hrace == null:
		return false
	if absf(auto_hrace.rychlost()) > 4.0:
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


## Kamera, načítání mapy, oblastí a MHD sledují hráče nebo jeho vozidlo.
func _sleduj(uzel: Node3D) -> void:
	kamera.cil = uzel
	svet.sledovat = uzel
	oblasti.sledovat = uzel
	mhd.sledovat = uzel


## Výška pochozího povrchu v bodě (most, střecha i terén) paprskem shora.
func _povrch(p: Vector3) -> float:
	var teren := Mapa.vyska(p.x, p.z)
	var dotaz := PhysicsRayQueryParameters3D.create(Vector3(p.x, p.y + 3.0, p.z), Vector3(p.x, teren - 1.0, p.z), VRSTVA_SVET)
	var hit := get_world_3d().direct_space_state.intersect_ray(dotaz)
	return maxf(teren, (hit.position as Vector3).y) if not hit.is_empty() else teren


func _process(delta: float) -> void:
	if not Mapa.nacteno:
		return
	chodec.smer_kamery = kamera.yaw
	# herní čas plyne stejně rychle jako skutečný
	cas_hodina += delta / 3600.0
	if cas_hodina >= 24.0:
		cas_hodina -= 24.0
		cas_den += 1
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
