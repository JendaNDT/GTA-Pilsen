class_name Fotorezim
extends CanvasLayer
## Fotorežim (src/game/photo-mode.js): hra se zastaví, kamera se volně pohybuje do 100 m od místa,
## kde režim začal (WASD nebo šipky, Q/E dolů a nahoru, tah myší nebo prstem otáčí), rozhraní
## se skryje a snímek jde uložit jako PNG. O nebo Esc režim ukončí.

const DOSAH := 100.0
const RYCHLOST := 16.0

signal ukonceno

var aktivni := false
var _kamera: Camera3D
var _puvodni: Camera3D
var _kotva := Vector3.ZERO
var _yaw := 0.0
var _pitch := 0.0
var _lista: HBoxContainer
var _zprava: Label
var _drzene := {}           ## dotyková tlačítka vpřed/vzad
var _prst := -1
var _zorne: HSlider


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	layer = 20
	visible = false
	_lista = HBoxContainer.new()
	_lista.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	_lista.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_lista.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_lista.offset_bottom = -16
	_lista.add_theme_constant_override("separation", 10)
	add_child(_lista)
	var l := Label.new()
	l.text = "Zorný úhel"
	_lista.add_child(l)
	_zorne = HSlider.new()
	_zorne.min_value = 20
	_zorne.max_value = 90
	_zorne.value = 62
	_zorne.custom_minimum_size = Vector2(160, 40)
	_zorne.value_changed.connect(func(v: float) -> void:
		if _kamera:
			_kamera.fov = v)
	_lista.add_child(_zorne)
	for t: Array in [["Vpřed", "vpred"], ["Vzad", "vzad"]]:
		var b := Button.new()
		b.text = t[0]
		b.custom_minimum_size = Vector2(90, 48)
		var klic: String = t[1]
		b.button_down.connect(func() -> void: _drzene[klic] = true)
		b.button_up.connect(func() -> void: _drzene.erase(klic))
		_lista.add_child(b)
	var ulozit := Button.new()
	ulozit.text = "Uložit PNG"
	ulozit.custom_minimum_size = Vector2(120, 48)
	ulozit.pressed.connect(uloz)
	_lista.add_child(ulozit)
	var zpet := Button.new()
	zpet.text = "Zpět"
	zpet.custom_minimum_size = Vector2(90, 48)
	zpet.pressed.connect(zavri)
	_lista.add_child(zpet)
	_zprava = Label.new()
	_zprava.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	_zprava.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_zprava.offset_top = 16
	_zprava.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_zprava.add_theme_font_size_override("font_size", 18)
	_zprava.add_theme_color_override("font_outline_color", Color.BLACK)
	_zprava.add_theme_constant_override("outline_size", 6)
	add_child(_zprava)


## Otevře fotorežim z pohledu aktuální kamery.
func otevri() -> void:
	if aktivni:
		return
	_puvodni = get_viewport().get_camera_3d()
	if _puvodni == null:
		return
	_kamera = Camera3D.new()
	_kamera.name = "FotoKamera"
	add_child(_kamera)
	_kamera.global_transform = _puvodni.global_transform
	_kamera.fov = _puvodni.fov
	_kamera.near = _puvodni.near
	_kamera.far = _puvodni.far
	_kamera.current = true
	_zorne.set_value_no_signal(_kamera.fov)
	_kotva = _kamera.global_position
	# směr pohledu bez náklonu (kamera ramene může mít v rozkladu na úhly otočení o 180°)
	var f := -_kamera.global_basis.z.normalized()
	_pitch = asin(clampf(f.y, -1.0, 1.0))
	_yaw = atan2(-f.x, -f.z)
	aktivni = true
	visible = true
	_zprava.text = "Fotorežim · WASD/šipky pohyb, Q/E výška, tah myší otáčí · O nebo Esc zpět"
	get_tree().paused = true


func zavri() -> void:
	if not aktivni:
		return
	aktivni = false
	visible = false
	_drzene.clear()
	_prst = -1
	if is_instance_valid(_puvodni):
		_puvodni.current = true
	_kamera.queue_free()
	_kamera = null
	get_tree().paused = false
	ukonceno.emit()


## Uloží snímek bez ovládacích prvků. Na počítači do složky user://fotky, na webu ke stažení.
func uloz() -> String:
	visible = false
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	visible = aktivni
	var d := Time.get_datetime_dict_from_system()
	var nazev := "plzen-%04d-%02d-%02d-%02d-%02d-%02d.png" % [d.year, d.month, d.day, d.hour, d.minute, d.second]
	if OS.has_feature("web"):
		JavaScriptBridge.download_buffer(img.save_png_to_buffer(), nazev, "image/png")
		_zprava.text = "Snímek se stahuje: " + nazev
		return nazev
	DirAccess.make_dir_recursive_absolute("user://fotky")
	var cesta := "user://fotky/" + nazev
	if img.save_png(cesta) == OK:
		_zprava.text = "Uloženo: " + ProjectSettings.globalize_path(cesta)
		return cesta
	_zprava.text = "Snímek se nepodařilo uložit."
	return ""


func _unhandled_input(event: InputEvent) -> void:
	if not aktivni:
		return
	if event.is_action_pressed("fotorezim") or event.is_action_pressed("menu"):
		zavri()
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseMotion and event.button_mask & (MOUSE_BUTTON_MASK_LEFT | MOUSE_BUTTON_MASK_RIGHT):
		_otoc(event.relative)
	elif event is InputEventScreenTouch:
		if event.pressed and _prst < 0:
			_prst = event.index
		elif not event.pressed and event.index == _prst:
			_prst = -1
	elif event is InputEventScreenDrag and event.index == _prst:
		_otoc(event.relative)


func _otoc(posun: Vector2) -> void:
	_yaw -= posun.x * 0.004
	_pitch = clampf(_pitch - posun.y * 0.004, -1.45, 1.45)


func _process(delta: float) -> void:
	if not aktivni or _kamera == null:
		return
	_kamera.global_basis = Basis.from_euler(Vector3(_pitch, _yaw, 0.0), EULER_ORDER_YXZ)
	var krok := Vector3(Input.get_axis("vlevo", "vpravo"), 0.0, Input.get_axis("vpred", "vzad"))
	if _drzene.has("vpred"):
		krok.z -= 1.0
	if _drzene.has("vzad"):
		krok.z += 1.0
	krok = _kamera.global_basis * krok
	krok.y += float(Input.is_key_pressed(KEY_E)) - float(Input.is_key_pressed(KEY_Q))
	var p := _kamera.global_position + krok.limit_length(1.0) * RYCHLOST * delta
	p = _kotva + (p - _kotva).limit_length(DOSAH)
	# nad terénem
	p.y = maxf(p.y, Mapa.vyska(p.x, p.z) + 0.6)
	_kamera.global_position = p
