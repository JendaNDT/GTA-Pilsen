class_name Garaz
extends Node3D
## Garáž u hlavního nádraží (src/game/garage.js): koupě vlastního auta, vyzvednutí a uložení,
## oprava a vylepšení brzd a pneumatik. Vlastní auto se ukládá s poškozením a vylepšeními;
## po načtení hry stojí v garáži.

const MISTO := Vector2(833, 254)
const NATOCENI := -2.49          ## směr výjezdu jako v předloze (vpřed = sin, cos)
const NAZEV := "Garáž u hlavního nádraží"
const CENA_AUTA := 1350
const UPRAVY := {
	"brzdy": {"nazev": "Lepší brzdy", "cena": 325},
	"pneu": {"nazev": "Lepší pneumatiky", "cena": 360},
}
const BARVA := Color("397f70")
const DOSAH := 22.0

var hra: Hra
## Vlastní auto: {model, poskozeni, vylepseni: {brzdy, pneu}}; prázdné = žádné.
var vlastni := {}
## Vyzvednuté auto ve světě (null = stojí v garáži).
var auto: Auto = null


func _ready() -> void:
	var y := Mapa.vyska(MISTO.x, MISTO.y)
	position = Vector3(MISTO.x, y, MISTO.y)
	var cedule := Label3D.new()
	cedule.text = "GARÁŽ"
	cedule.font_size = 96
	cedule.pixel_size = 0.01
	cedule.outline_size = 12
	cedule.modulate = Color("6be0bc")
	cedule.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	cedule.position = Vector3(0, 4.5, 0)
	add_child(cedule)
	var kruh := MeshInstance3D.new()
	var valec := CylinderMesh.new()
	valec.top_radius = 3.0
	valec.bottom_radius = 3.0
	valec.height = 0.06
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.42, 0.88, 0.74, 0.45)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	valec.material = m
	kruh.mesh = valec
	kruh.position.y = 0.05
	kruh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(kruh)


func nacti(d: Variant) -> void:
	vlastni = {}
	if not d is Dictionary or (d as Dictionary).get("model", "") != "hatch":
		return
	var v: Dictionary = (d as Dictionary).get("vylepseni", {}) if (d as Dictionary).get("vylepseni", {}) is Dictionary else {}
	vlastni = {
		"model": "hatch",
		"poskozeni": clampf(float((d as Dictionary).get("poskozeni", 0.0)), 0.0, 100.0),
		"vylepseni": {"brzdy": v.get("brzdy", false) == true, "pneu": v.get("pneu", false) == true},
	}


## Stav k uložení (s aktuálním poškozením vyzvednutého auta).
func stav() -> Dictionary:
	if vlastni.is_empty():
		return {}
	var s := vlastni.duplicate(true)
	if is_instance_valid(auto):
		s.poskozeni = auto.poskozeni
	return s


## Hráč stojí (nebo sedí v autě) u garáže.
func blizko() -> bool:
	if hra == null or not (hra.rezim == "pesky" or hra.rezim == "auto"):
		return false
	var p := hra.kamera.cil.global_position
	return Vector2(p.x - MISTO.x, p.z - MISTO.y).length() < DOSAH and absf(Mapa.vyska(MISTO.x, MISTO.y) - p.y) < 5.0


func cena_opravy() -> int:
	var s := stav()
	var p: float = s.get("poskozeni", 0.0)
	return ceili((75.0 + p * 5.0) / 5.0) * 5 if p > 0.0 else 0


## Provede akci (koupit, vyzvednout, ulozit, opravit, brzdy, pneu). Vrací zprávu pro hráče.
func proved(akce: String) -> String:
	if not blizko():
		return "Nejdřív přijeď ke garáži u hlavního nádraží."
	if hra.rezim != "pesky":
		return "Před použitím garáže vystup z auta."
	if akce == "koupit" and vlastni.is_empty():
		if hra.penize < CENA_AUTA:
			return "Na nákup nemáš dost peněz."
		hra.pridej_penize(-CENA_AUTA)
		vlastni = {"model": "hatch", "poskozeni": 0.0, "vylepseni": {"brzdy": false, "pneu": false}}
		hra.uloz()
		return "Auto je tvoje a čeká v garáži."
	if vlastni.is_empty():
		return "Zatím nemáš vlastní auto."
	if akce == "vyzvednout" and not is_instance_valid(auto):
		if float(vlastni.poskozeni) >= 100.0:
			return "Vůz je nepojízdný. Nejdřív ho oprav."
		var stred := Vector3(MISTO.x, Mapa.vyska(MISTO.x, MISTO.y), MISTO.y)
		for a: Node in hra.auta.get_children():
			if a is Node3D and (a as Node3D).global_position.distance_to(stred) < 3.8:
				return "Výjezd potřebuje volné místo. Odstup několik kroků a zkus to znovu."
		if hra.chodec.global_position.distance_to(stred) < 3.8:
			return "Výjezd potřebuje volné místo. Odstup několik kroků a zkus to znovu."
		var smer := Vector3(sin(NATOCENI), 0.0, cos(NATOCENI))
		auto = hra.postav_auto("hatch", stred, smer, BARVA.srgb_to_linear())
		auto.set_meta("garaz", true)
		auto.poskozeni = float(vlastni.poskozeni)
		auto.vylepseni = (vlastni.vylepseni as Dictionary).duplicate()
		if auto.poskozeni > 0.0:
			auto.call_deferred("_vyhodnot_naraz", 0.0)
		return "Tvoje auto stojí u garáže."
	if akce == "ulozit" and is_instance_valid(auto):
		if auto.global_position.distance_to(global_position) > DOSAH + 8.0:
			return "Přijeď s autem ke garáži."
		vlastni.poskozeni = auto.poskozeni
		if hra.auto_hrace == auto:
			hra.auto_hrace = null
		auto.queue_free()
		auto = null
		hra.uloz()
		return "Auto je uložené v garáži."
	if is_instance_valid(auto):
		return "Nejdřív ulož auto do garáže."
	if akce == "opravit":
		var cena := cena_opravy()
		if cena == 0:
			return "Auto je v pořádku."
		if hra.penize < cena:
			return "Na opravu nemáš dost peněz."
		hra.pridej_penize(-cena)
		vlastni.poskozeni = 0.0
		hra.uloz()
		return "Opraveno za %d Kč." % cena
	if UPRAVY.has(akce) and not vlastni.vylepseni.get(akce, false):
		var u: Dictionary = UPRAVY[akce]
		if hra.penize < int(u.cena):
			return "Na úpravu nemáš dost peněz."
		hra.pridej_penize(-int(u.cena))
		vlastni.vylepseni[akce] = true
		hra.uloz()
		return "%s jsou namontované." % u.nazev
	return "Tato možnost teď není k dispozici."


## Auto zmizelo ze světa (například dojelo mimo dosah): zůstane v garáži se svým poškozením.
func auto_odstraneno(a: Auto) -> void:
	if a == auto:
		vlastni.poskozeni = a.poskozeni
		auto = null


## Řádky pro kartu Garáž v menu: [text, akce nebo ""].
func nabidka() -> Array:
	var r: Array = []
	if vlastni.is_empty():
		r.append(["Koupit malé auto · %d Kč" % CENA_AUTA, "koupit"])
	else:
		var s := stav()
		if is_instance_valid(auto):
			r.append(["Uložit auto do garáže", "ulozit"])
		else:
			r.append(["Vyzvednout auto", "vyzvednout"])
			var c := cena_opravy()
			r.append([("Opravit · %d Kč" % c) if c > 0 else "Auto je v pořádku", "opravit" if c > 0 else ""])
			for k: String in UPRAVY:
				var hotovo: bool = s.vylepseni.get(k, false)
				r.append(["%s · %s" % [UPRAVY[k].nazev, "namontováno" if hotovo else "%d Kč" % UPRAVY[k].cena], "" if hotovo else k])
	return r


func popis() -> String:
	if vlastni.is_empty():
		return "%s: kup si vlastní malé auto, nech ho opravit a vylepšit brzdy a pneumatiky." % NAZEV
	var s := stav()
	var v: Array = []
	for k: String in UPRAVY:
		if s.vylepseni.get(k, false):
			v.append(UPRAVY[k].nazev.to_lower())
	return "Vlastní malé auto · poškození %d %%%s · %s" % [roundi(s.poskozeni),
		(" · " + ", ".join(v)) if not v.is_empty() else "", "venku" if is_instance_valid(auto) else "v garáži"]
