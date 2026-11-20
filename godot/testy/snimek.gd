extends Node3D
## Zkušební snímek světa bez hráče. Spuštění (z kořene repozitáře):
##   godot --path godot testy/snimek.tscn -- --kamera x,y,z --cil x,y,z --soubor /cesta/snimek.png [--hodina 14]
##   [--pocasi rain|snow|fog|storm|clear|partly|cloudy] [--datum 2026-11-20]
## Postaví dlaždice kolem kamery, počká na vykreslení a uloží obrázek.

var _kamera := Vector3(120, 30, 520)
var _cil := Vector3(200, 0, 457)
var _soubor := "user://snimek.png"
var _dohled := 900.0
var _hodina := 14.0
var _pocasi := ""
var _datum := ""


func _ready() -> void:
	var a := OS.get_cmdline_user_args()
	for i in a.size():
		match a[i]:
			"--kamera": _kamera = _vec(a[i + 1])
			"--cil": _cil = _vec(a[i + 1])
			"--soubor": _soubor = a[i + 1]
			"--dohled": _dohled = float(a[i + 1])
			"--hodina": _hodina = float(a[i + 1])
			"--pocasi": _pocasi = a[i + 1]
			"--datum": _datum = a[i + 1]
	var prostredi: Prostredi = $Prostredi
	if _pocasi != "":
		prostredi.pocasi.vynuceno = _pocasi
	else:
		prostredi.pocasi.rezim = "jasno"
	var den := -1
	if _datum != "":
		den = JizdniRad.den_z_textu(_datum)
	elif _pocasi == "snow":
		den = Slunce.den_z_data(2026, 1, 15)
	prostredi.nastav_hodinu(_hodina, den)
	var svet: Svet = $Svet
	var t0 := Time.get_ticks_msec()
	svet.postav_hned(Vector2(_kamera.x, _kamera.z), _dohled)
	print("Postaveno %d dlaždic za %d ms" % [svet.pocet_hotovych(), Time.get_ticks_msec() - t0])
	await prostredi.pripraveno()
	var cam: Camera3D = $Kamera
	cam.position = _kamera
	cam.look_at(_cil)
	for k in 8:
		await get_tree().process_frame
	var img := get_viewport().get_texture().get_image()
	img.save_png(_soubor)
	print("Uložen snímek ", _soubor)
	get_tree().quit()


func _vec(s: String) -> Vector3:
	var p := s.split(",")
	return Vector3(float(p[0]), float(p[1]), float(p[2]))
