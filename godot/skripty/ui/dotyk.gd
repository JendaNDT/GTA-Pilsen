class_name Dotyk
extends CanvasLayer
## Dotykové ovládání pro telefon: páčka vlevo, tlačítka vpravo, tah prstem v pravé polovině
## otáčí kamerou. Zobrazí se automaticky na dotykové obrazovce (nebo s parametrem --dotyk).

signal akce(nazev: String)

const POLOMER := 70.0

var _packa_stred := Vector2.ZERO
var _packa_prst := -1
var _kamera_prst := -1
var _kamera_posledni := Vector2.ZERO
var _koren: Control
var _tlacitka := {}


func _ready() -> void:
	layer = 6
	var zapnout := DisplayServer.is_touchscreen_available() or OS.get_cmdline_user_args().has("--dotyk")
	visible = zapnout
	Vstup.aktivni_dotyk = zapnout
	_koren = Control.new()
	_koren.set_anchors_preset(Control.PRESET_FULL_RECT)
	_koren.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_koren)
	_koren.draw.connect(_kresli)
	var seznam := [["nastoupit", "Nastoupit", Vector2(-120, -250)], ["skok_brzda", "Brzda", Vector2(-120, -140)],
		["beh", "Běh", Vector2(-240, -140)], ["mapa", "Mapa", Vector2(-120, -360)], ["menu", "Menu", Vector2(-80, 80)]]
	for t: Array in seznam:
		var b := Button.new()
		b.text = t[1]
		b.add_theme_font_size_override("font_size", 22)
		b.size = Vector2(100, 90) if t[0] != "menu" else Vector2(70, 50)
		b.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT if t[0] != "menu" else Control.PRESET_TOP_RIGHT)
		b.position = t[2]
		b.focus_mode = Control.FOCUS_NONE
		b.modulate = Color(1, 1, 1, 0.75)
		var akce_jmeno: String = t[0]
		b.button_down.connect(_stisk.bind(akce_jmeno, true))
		b.button_up.connect(_stisk.bind(akce_jmeno, false))
		_koren.add_child(b)
		_tlacitka[akce_jmeno] = b


func _stisk(nazev: String, dole: bool) -> void:
	match nazev:
		"beh":
			Vstup.dotyk_beh = dole
		"skok_brzda":
			Vstup.dotyk_brzda = dole
		_:
			if dole:
				akce.emit(nazev)


func _input(event: InputEvent) -> void:
	if not visible:
		return
	var sirka := get_viewport().get_visible_rect().size.x
	if event is InputEventScreenTouch:
		if event.pressed:
			if event.position.x < sirka * 0.4 and _packa_prst < 0:
				_packa_prst = event.index
				_packa_stred = event.position
			elif event.position.x >= sirka * 0.4 and _kamera_prst < 0:
				_kamera_prst = event.index
				_kamera_posledni = event.position
		else:
			if event.index == _packa_prst:
				_packa_prst = -1
				Vstup.dotyk_pohyb = Vector2.ZERO
			elif event.index == _kamera_prst:
				_kamera_prst = -1
		_koren.queue_redraw()
	elif event is InputEventScreenDrag:
		if event.index == _packa_prst:
			var d: Vector2 = (event.position - _packa_stred) / POLOMER
			d = d.limit_length(1.0)
			Vstup.dotyk_pohyb = Vector2(d.x, -d.y)
			_koren.queue_redraw()
		elif event.index == _kamera_prst:
			Vstup.dotyk_kamera += event.position - _kamera_posledni
			_kamera_posledni = event.position


func _kresli() -> void:
	if _packa_prst < 0:
		var vyska := get_viewport().get_visible_rect().size.y
		_koren.draw_circle(Vector2(140, vyska - 150), POLOMER, Color(1, 1, 1, 0.12))
		_koren.draw_arc(Vector2(140, vyska - 150), POLOMER, 0, TAU, 48, Color(1, 1, 1, 0.4), 3.0)
		return
	_koren.draw_circle(_packa_stred, POLOMER, Color(1, 1, 1, 0.15))
	_koren.draw_arc(_packa_stred, POLOMER, 0, TAU, 48, Color(1, 1, 1, 0.5), 3.0)
	var p := _packa_stred + Vector2(Vstup.dotyk_pohyb.x, -Vstup.dotyk_pohyb.y) * POLOMER
	_koren.draw_circle(p, 32.0, Color(1, 1, 1, 0.55))
