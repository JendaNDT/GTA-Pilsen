extends Node3D
## Zkušební snímek světa bez hráče. Spuštění (z kořene repozitáře):
##   godot --path godot testy/snimek.tscn -- --kamera x,y,z --cil x,y,z --soubor /cesta/snimek.png [--hodina 14]
## Postaví dlaždice kolem kamery, počká na vykreslení a uloží obrázek.

var _kamera := Vector3(120, 30, 520)
var _cil := Vector3(200, 0, 457)
var _soubor := "user://snimek.png"
var _dohled := 900.0


func _ready() -> void:
	var a := OS.get_cmdline_user_args()
	for i in a.size():
		match a[i]:
			"--kamera": _kamera = _vec(a[i + 1])
			"--cil": _cil = _vec(a[i + 1])
			"--soubor": _soubor = a[i + 1]
			"--dohled": _dohled = float(a[i + 1])
	var prostredi: Prostredi = $Prostredi
	prostredi.nastav_hodinu(14.0)
	var svet: Svet = $Svet
	var t0 := Time.get_ticks_msec()
	svet.postav_hned(Vector2(_kamera.x, _kamera.z), _dohled)
	print("Postaveno %d dlaždic za %d ms" % [svet.pocet_hotovych(), Time.get_ticks_msec() - t0])
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
