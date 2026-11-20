extends SceneTree
## Import upravitelných oblastí z příkazové řádky (z kořene repozitáře):
##   godot --headless --path godot -s res://editor/import_oblasti.gd
##   godot --headless --path godot -s res://editor/import_oblasti.gd -- --kolem 200,457
## Bez parametru obnoví celou mapu, s --kolem jen oblasti do 1 km od bodu (x, z).
## V editoru totéž dělá panel „Plzeň“ tlačítkem Znovu importovat.


func _initialize() -> void:
	var bunky: Array = []
	var a := OS.get_cmdline_user_args()
	for i in a.size():
		if a[i] == "--kolem" and i + 1 < a.size():
			var p := a[i + 1].split(",")
			var stred := Oblast.bunka_bodu(float(p[0]), float(p[1]))
			for dz in range(-1, 2):
				for dx in range(-1, 2):
					bunky.append(stred + Vector2i(dx, dz))
	var s := ImportOblasti.importuj(bunky)
	for zprava: String in s.zpravy:
		print(zprava)
	print("Oblastí: %d, nových zastávek: %d, aktualizovaných: %d, ponechaných ručních úprav: %d, smazaných: %d, zastaralých: %d" % [
		s.oblasti, s.nove, s.aktualizovane, s.zachovane, s.smazane, s.zastarale])
	quit()
