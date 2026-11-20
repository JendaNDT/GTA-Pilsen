class_name Hud
extends CanvasLayer
## Herní ukazatele: místo a ulice, čas, peníze, rychloměr a nápověda k akci.

var _misto: Label
var _ulice: Label
var _cas: Label
var _penize: Label
var _rychlost: Label
var _napoveda: Label
var _zprava: Label
var _zprava_cas := 0.0
var _nacitani: Label


func _ready() -> void:
	layer = 5
	var koren := Control.new()
	koren.set_anchors_preset(Control.PRESET_FULL_RECT)
	koren.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(koren)
	_misto = _stitek(koren, 22, Color(1, 1, 1))
	_misto.position = Vector2(18, 12)
	_ulice = _stitek(koren, 17, Color(0.85, 0.9, 0.95))
	_ulice.position = Vector2(18, 44)
	_cas = _stitek(koren, 20, Color(1, 1, 1))
	_cas.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_cas.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_cas.position = Vector2(-220, 12)
	_cas.size = Vector2(200, 30)
	_penize = _stitek(koren, 20, Color(0.75, 1.0, 0.7))
	_penize.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_penize.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_penize.position = Vector2(-220, 42)
	_penize.size = Vector2(200, 30)
	_rychlost = _stitek(koren, 40, Color(1, 1, 1))
	_rychlost.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	_rychlost.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_rychlost.position = Vector2(-260, -90)
	_rychlost.size = Vector2(240, 60)
	_napoveda = _stitek(koren, 20, Color(1, 0.95, 0.7))
	_napoveda.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_napoveda.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_napoveda.position = Vector2(-300, -120)
	_napoveda.size = Vector2(600, 30)
	_zprava = _stitek(koren, 24, Color(1, 1, 1))
	_zprava.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_zprava.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_zprava.position = Vector2(-400, 90)
	_zprava.size = Vector2(800, 40)
	_nacitani = _stitek(koren, 30, Color(1, 1, 1))
	_nacitani.set_anchors_preset(Control.PRESET_CENTER)
	_nacitani.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_nacitani.position = Vector2(-300, -20)
	_nacitani.size = Vector2(600, 40)


func _stitek(rodic: Control, velikost: int, barva: Color) -> Label:
	var l := Label.new()
	l.add_theme_font_size_override("font_size", velikost)
	l.add_theme_color_override("font_color", barva)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	l.add_theme_constant_override("outline_size", 6)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rodic.add_child(l)
	return l


func misto(obec: String, ulice: String) -> void:
	_misto.text = obec
	_ulice.text = ulice


func cas(text: String) -> void:
	_cas.text = text


func penize(kc: int) -> void:
	_penize.text = "%s Kč" % _tisice(kc)


func rychlost(kmh: float) -> void:
	_rychlost.text = "" if kmh < 0.0 else "%d km/h" % roundi(kmh)


func napoveda(text: String) -> void:
	_napoveda.text = text


func nacitani(text: String) -> void:
	_nacitani.text = text


func zprava(text: String, sekund := 3.0) -> void:
	_zprava.text = text
	_zprava_cas = sekund


func _process(delta: float) -> void:
	if _zprava_cas > 0.0:
		_zprava_cas -= delta
		if _zprava_cas <= 0.0:
			_zprava.text = ""


static func _tisice(n: int) -> String:
	var s := str(absi(n))
	var out := ""
	while s.length() > 3:
		out = " " + s.substr(s.length() - 3) + out
		s = s.substr(0, s.length() - 3)
	return ("-" if n < 0 else "") + s + out
