class_name MapaUI
extends CanvasLayer
## Velká mapa (M) a minimapa. Podklad je obraz celého území (data/svet/mapa.png, ~8 m na pixel),
## nad ním hráč, cíl zakázky, vlastní cíl s trasou po silnicích a památky.
## Velká mapa: tah posouvá, kolečko nebo dva prsty přibližují, klepnutí nastaví cíl, hledání bez diakritiky.

signal cil_nastaven(bod: Vector2, nazev: String)

var hra: Hra
var otevrena := false
var _textura: Texture2D
var _info: Dictionary
var _velka: Control
var _mini: Control
var _hledat: LineEdit
var _vysledky: ItemList
var _polozky: Array = []
var _stred := Vector2.ZERO       ## střed velké mapy (x, z)
var _meritko := 1.2              ## pixelů obrazovky na pixel mapy
var _tazeni := false
var _dotyky := {}
var _pocatek_tahu := Vector2.ZERO


func _ready() -> void:
	layer = 8
	process_mode = Node.PROCESS_MODE_ALWAYS
	_info = Mapa.info.get("mapa", {})
	if ResourceLoader.exists(Mapa.SLOZKA + "mapa.png"):
		_textura = load(Mapa.SLOZKA + "mapa.png")
	_mini = Control.new()
	if DisplayServer.is_touchscreen_available() or OS.get_cmdline_user_args().has("--dotyk"):
		# na telefonu vpravo nahoře, aby nepřekážela páčce
		_mini.set_anchors_preset(Control.PRESET_TOP_RIGHT)
		_mini.offset_left = -176
		_mini.offset_top = 132
		_mini.offset_right = -16
		_mini.offset_bottom = 292
	else:
		_mini.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
		_mini.offset_left = 16
		_mini.offset_top = -236
		_mini.offset_right = 236
		_mini.offset_bottom = -16
	_mini.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_mini.draw.connect(_kresli_mini)
	add_child(_mini)
	_velka = Control.new()
	_velka.set_anchors_preset(Control.PRESET_FULL_RECT)
	_velka.visible = false
	_velka.draw.connect(_kresli_velkou)
	_velka.gui_input.connect(_vstup_velke)
	add_child(_velka)
	var horni := HBoxContainer.new()
	horni.position = Vector2(16, 16)
	_velka.add_child(horni)
	_hledat = LineEdit.new()
	_hledat.placeholder_text = "Hledat místo, zastávku nebo čtvrť…"
	_hledat.custom_minimum_size = Vector2(360, 40)
	_hledat.text_changed.connect(_hledej)
	horni.add_child(_hledat)
	var zavrit := Button.new()
	zavrit.text = "Zavřít mapu"
	zavrit.pressed.connect(zavri)
	horni.add_child(zavrit)
	var zrusit := Button.new()
	zrusit.text = "Zrušit cíl"
	zrusit.pressed.connect(func() -> void: hra.navigace_cil = null)
	horni.add_child(zrusit)
	_vysledky = ItemList.new()
	_vysledky.position = Vector2(16, 62)
	_vysledky.size = Vector2(360, 260)
	_vysledky.visible = false
	_vysledky.item_activated.connect(_vyber)
	_vysledky.item_clicked.connect(func(i: int, _p: Vector2, _b: int) -> void: _vyber(i))
	_velka.add_child(_vysledky)
	_pripravit_polozky()


func _pripravit_polozky() -> void:
	var m := Mapa.mista()
	for o: Dictionary in m.get("obce", []):
		_polozky.append({"text": "%s (%s)" % [o.nazev, {"city": "město", "town": "město", "village": "obec", "suburb": "čtvrť", "neighbourhood": "čtvrť", "hamlet": "osada"}.get(o.druh, o.druh)], "x": o.x, "z": o.z})
	for p: Dictionary in m.get("pamatky", []):
		_polozky.append({"text": "★ " + p.nazev, "x": p.x, "z": p.z})
	var videne := {}
	var text := FileAccess.get_file_as_string(Mapa.SLOZKA + "zastavky.json")
	for z: Dictionary in (JSON.parse_string(text) if not text.is_empty() else []):
		if videne.has(z.nazev):
			continue
		videne[z.nazev] = true
		_polozky.append({"text": "Zastávka " + z.nazev, "x": z.x, "z": z.z})
	for p: Dictionary in _polozky:
		p.klic = _bez_diakritiky(p.text)


static func _bez_diakritiky(s: String) -> String:
	var z := "áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ"
	var na := "acdeeinorstuuyzACDEEINORSTUUYZ"
	var out := ""
	for ch in s:
		var i := z.find(ch)
		out += na[i] if i >= 0 else ch
	return out.to_lower()


func _hledej(text: String) -> void:
	_vysledky.clear()
	var klic := _bez_diakritiky(text.strip_edges())
	_vysledky.visible = klic.length() >= 2
	if not _vysledky.visible:
		return
	for i in _polozky.size():
		if _polozky[i].klic.contains(klic):
			_vysledky.add_item(_polozky[i].text)
			_vysledky.set_item_metadata(_vysledky.item_count - 1, i)
			if _vysledky.item_count >= 30:
				break


func _vyber(radek: int) -> void:
	var p: Dictionary = _polozky[_vysledky.get_item_metadata(radek)]
	_stred = Vector2(p.x, p.z)
	_meritko = maxf(_meritko, 2.5)
	_vysledky.visible = false
	cil_nastaven.emit(Vector2(p.x, p.z), p.text)
	_velka.queue_redraw()


func otevri() -> void:
	otevrena = true
	_velka.visible = true
	_mini.visible = false
	var p := hra.kamera.cil.global_position
	_stred = Vector2(p.x, p.z)
	get_tree().paused = true
	_velka.queue_redraw()


func zavri() -> void:
	otevrena = false
	_velka.visible = false
	_mini.visible = true
	_vysledky.visible = false
	_hledat.release_focus()
	get_tree().paused = false


func prepni() -> void:
	if otevrena:
		zavri()
	else:
		otevri()


func _unhandled_input(event: InputEvent) -> void:
	if otevrena and (event.is_action_pressed("menu") or event.is_action_pressed("mapa")):
		zavri()
		get_viewport().set_input_as_handled()


# ------------------------------------------------------------------ převody

func _krok() -> float:
	return float(_info.get("krok", 8.0))


## Bod světa (x, z) na pixel velké mapy.
func _na_obrazovku(b: Vector2) -> Vector2:
	var k := _krok()
	return _velka.size * 0.5 + (b - _stred) / k * _meritko


func _ze_obrazovky(s: Vector2) -> Vector2:
	var k := _krok()
	return _stred + (s - _velka.size * 0.5) / _meritko * k


func _vstup_velke(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP and event.pressed:
			_meritko = minf(12.0, _meritko * 1.2)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN and event.pressed:
			_meritko = maxf(0.15, _meritko / 1.2)
		elif event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				_tazeni = true
				_pocatek_tahu = event.position
			else:
				_tazeni = false
				if event.position.distance_to(_pocatek_tahu) < 6.0:
					var b := _ze_obrazovky(event.position)
					cil_nastaven.emit(b, "")
		_velka.queue_redraw()
	elif event is InputEventMouseMotion and _tazeni:
		_stred -= event.relative / _meritko * _krok()
		_velka.queue_redraw()
	elif event is InputEventScreenTouch:
		if event.pressed:
			_dotyky[event.index] = event.position
		else:
			_dotyky.erase(event.index)
	elif event is InputEventScreenDrag:
		if _dotyky.size() == 2 and _dotyky.has(event.index):
			var jiny: Vector2 = _dotyky.values()[0] if _dotyky.keys()[0] != event.index else _dotyky.values()[1]
			var pred: float = (jiny - _dotyky[event.index]).length()
			var po: float = (jiny - event.position).length()
			if pred > 1.0:
				_meritko = clampf(_meritko * po / pred, 0.15, 12.0)
		_dotyky[event.index] = event.position
		_velka.queue_redraw()


# ------------------------------------------------------------------ kreslení

func _kresli_texturu(c: Control, oblast: Rect2, stred: Vector2, meritko: float) -> void:
	if _textura == null:
		c.draw_rect(oblast, Color(0.6, 0.65, 0.5))
		return
	var k := _krok()
	var x0 := float(_info.get("x0", 0.0))
	var z0 := float(_info.get("z0", 0.0))
	# výřez textury, který odpovídá oblasti
	var px := (stred - Vector2(x0, z0)) / k
	var pul := oblast.size * 0.5 / meritko
	var zdroj := Rect2(px - pul, pul * 2.0)
	var vyrez := zdroj.intersection(Rect2(Vector2.ZERO, _textura.get_size()))
	if vyrez.size.x <= 0.0 or vyrez.size.y <= 0.0:
		return
	var cil := Rect2(oblast.position + (vyrez.position - zdroj.position) * meritko, vyrez.size * meritko)
	c.draw_texture_rect_region(_textura, cil, vyrez)


func _kresli_velkou() -> void:
	var c := _velka
	c.draw_rect(Rect2(Vector2.ZERO, c.size), Color(0.18, 0.2, 0.22))
	_kresli_texturu(c, Rect2(Vector2.ZERO, c.size), _stred, _meritko)
	_kresli_vrstvy(c, func(b: Vector2) -> Vector2: return _na_obrazovku(b), 1.0)
	var napoveda := "Tah posouvá, kolečko přibližuje, klepnutí nastaví cíl · Památky: %d/%d" % [
		hra.objevene.size(), (Mapa.mista().get("pamatky", []) as Array).size()]
	c.draw_string(ThemeDB.fallback_font, Vector2(16, c.size.y - 18), napoveda, HORIZONTAL_ALIGNMENT_LEFT, -1, 18)


func _kresli_vrstvy(c: Control, prevod: Callable, velikost: float) -> void:
	# trasa
	var trasa: PackedVector2Array = hra.navigace_body
	if trasa.size() >= 2:
		var body := PackedVector2Array()
		for b in trasa:
			body.append(prevod.call(b))
		c.draw_polyline(body, Color(0.69, 0.49, 1.0), 4.0 * velikost, true)
	# památky
	for p: Dictionary in Mapa.mista().get("pamatky", []):
		var nalezena: bool = hra.objevene.has(p.id)
		c.draw_circle(prevod.call(Vector2(p.x, p.z)), (4.5 if nalezena else 3.0) * velikost,
			Color(0.95, 0.71, 0.2) if nalezena else Color(0.49, 0.53, 0.56))
	# cíl zakázky a vlastní cíl
	var z: Variant = hra.zakazky.cil()
	if z != null:
		c.draw_circle(prevod.call(Vector2(z.x, z.z)), 7.0 * velikost, Color(0.95, 0.71, 0.2))
	if hra.navigace_cil != null:
		c.draw_circle(prevod.call(hra.navigace_cil), 6.0 * velikost, Color(0.69, 0.49, 1.0))
	# hráč
	var p3 := hra.kamera.cil.global_position
	var s: Vector2 = prevod.call(Vector2(p3.x, p3.z))
	var smer := Vector2(sin(hra.kamera.yaw), cos(hra.kamera.yaw))
	var bok := Vector2(-smer.y, smer.x)
	c.draw_colored_polygon(PackedVector2Array([s + smer * 10.0 * velikost, s - smer * 6.0 * velikost + bok * 6.0 * velikost,
		s - smer * 6.0 * velikost - bok * 6.0 * velikost]), Color(1, 1, 1))


func _kresli_mini() -> void:
	var c := _mini
	var r := Rect2(Vector2.ZERO, c.size)
	c.draw_rect(r, Color(0.1, 0.12, 0.14, 0.85))
	if hra == null:
		return
	var p := hra.kamera.cil.global_position
	var stred := Vector2(p.x, p.z)
	var meritko := 2.4
	_kresli_texturu(c, r, stred, meritko)
	var k := _krok()
	var prevod := func(b: Vector2) -> Vector2: return r.size * 0.5 + (b - stred) / k * meritko
	_kresli_vrstvy(c, prevod, 0.8)
	c.draw_rect(r, Color(1, 1, 1, 0.5), false, 2.0)


func _process(_delta: float) -> void:
	if not otevrena and _mini.visible:
		_mini.queue_redraw()
