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
var _odjezdy: Label
var _zakazka: Label
var _hledanost: Label


var _ladeni: Label


## Ladicí přehled výkonu (F3): snímky za sekundu, čas snímku, vykreslování a paměť.
func prepni_ladeni() -> bool:
	_ladeni.visible = not _ladeni.visible
	return _ladeni.visible


func ladeni(text: String) -> void:
	if _ladeni.visible:
		_ladeni.text = text


func _ready() -> void:
	layer = 5
	var koren := Control.new()
	koren.set_anchors_preset(Control.PRESET_FULL_RECT)
	koren.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(koren)
	_misto = _stitek(koren, 22, Color(1, 1, 1), Control.PRESET_TOP_LEFT, Rect2(18, 12, 600, 30))
	_ulice = _stitek(koren, 17, Color(0.85, 0.9, 0.95), Control.PRESET_TOP_LEFT, Rect2(18, 44, 600, 26))
	_cas = _stitek(koren, 20, Color(1, 1, 1), Control.PRESET_TOP_RIGHT, Rect2(-220, 12, 200, 30), HORIZONTAL_ALIGNMENT_RIGHT)
	_penize = _stitek(koren, 20, Color(0.75, 1.0, 0.7), Control.PRESET_TOP_RIGHT, Rect2(-220, 42, 200, 30), HORIZONTAL_ALIGNMENT_RIGHT)
	_rychlost = _stitek(koren, 40, Color(1, 1, 1), Control.PRESET_BOTTOM_RIGHT, Rect2(-260, -90, 240, 60), HORIZONTAL_ALIGNMENT_RIGHT)
	_napoveda = _stitek(koren, 20, Color(1, 0.95, 0.7), Control.PRESET_CENTER_BOTTOM, Rect2(-300, -120, 600, 30), HORIZONTAL_ALIGNMENT_CENTER)
	_zprava = _stitek(koren, 24, Color(1, 1, 1), Control.PRESET_CENTER_TOP, Rect2(-450, 90, 900, 40), HORIZONTAL_ALIGNMENT_CENTER)
	_ladeni = _stitek(koren, 15, Color(0.8, 1.0, 0.8), Control.PRESET_TOP_LEFT, Rect2(18, 80, 520, 200))
	_ladeni.visible = false
	_zprava.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_nacitani = _stitek(koren, 30, Color(1, 1, 1), Control.PRESET_CENTER, Rect2(-300, -20, 600, 40), HORIZONTAL_ALIGNMENT_CENTER)
	_odjezdy = _stitek(koren, 17, Color(1.0, 0.85, 0.45), Control.PRESET_TOP_LEFT, Rect2(18, 80, 420, 120))
	_zakazka = _stitek(koren, 18, Color(1.0, 0.86, 0.5), Control.PRESET_TOP_RIGHT, Rect2(-480, 100, 460, 110), HORIZONTAL_ALIGNMENT_RIGHT)
	_zakazka.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_hledanost = _stitek(koren, 26, Color(1.0, 0.85, 0.3), Control.PRESET_TOP_RIGHT, Rect2(-220, 64, 200, 34), HORIZONTAL_ALIGNMENT_RIGHT)


## Popisek ukotvený k okraji obrazovky; obdélník = posun a velikost vůči kotvě.
func _stitek(rodic: Control, velikost: int, barva: Color, kotva: Control.LayoutPreset, r: Rect2,
		zarovnani := HORIZONTAL_ALIGNMENT_LEFT) -> Label:
	var l := Label.new()
	l.set_anchors_preset(kotva)
	l.offset_left = r.position.x
	l.offset_top = r.position.y
	l.offset_right = r.position.x + r.size.x
	l.offset_bottom = r.position.y + r.size.y
	l.horizontal_alignment = zarovnani
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


func hodiny_viditelne(zapnout: bool) -> void:
	_cas.visible = zapnout


func cas(text: String) -> void:
	_cas.text = text


func penize(kc: int) -> void:
	_penize.text = "%s Kč" % _tisice(kc)


func rychlost(kmh: float) -> void:
	_rychlost.text = "" if kmh < 0.0 else "%d km/h" % roundi(kmh)


func napoveda(text: String) -> void:
	_napoveda.text = text


## Tabule odjezdů z nejbližšího stanoviště (nebo null = skrýt).
func odjezdy(data: Variant) -> void:
	if data == null or (data.radky as Array).is_empty():
		_odjezdy.text = ""
		return
	var t := "Zastávka %s\n" % data.stanoviste
	for r: Dictionary in data.radky:
		t += "%s  %s → %s\n" % [JizdniRad.format_cas(r.cas), r.linka, r.cil]
	_odjezdy.text = t


func hledanost(n: int) -> void:
	_hledanost.text = "" if n <= 0 else "★".repeat(n) + "☆".repeat(5 - n)


func zakazka(text: String) -> void:
	_zakazka.text = text


func text_zakazky() -> String:
	return _zakazka.text


func text_odjezdu() -> String:
	return _odjezdy.text


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
