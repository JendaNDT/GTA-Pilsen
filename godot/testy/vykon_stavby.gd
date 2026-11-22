extends SceneTree
## Měření rychlosti stavby dlaždic (bez vykreslování):
##   godot --headless --path godot -s res://testy/vykon_stavby.gd


func _initialize() -> void:
	var data = Mapa
	data.nacti()
	var stred := Vector2(200, 457)
	var casy := {"teren": 0, "povrch": 0, "silnice": 0, "budovy": 0, "stromy": 0}
	var pocet := 0
	for dz in range(-2, 3):
		for dx in range(-2, 3):
			var ci: int = data.index_dlazdice(stred.x + dx * 256, stred.y + dz * 256)
			var t0 := Time.get_ticks_usec()
			var t = data.teren(ci)
			var g := Stavba.teren(t)
			var t1 := Time.get_ticks_usec()
			var img := Stavba.povrch(data.blok("povrch", ci))
			var t2 := Time.get_ticks_usec()
			var s := Stavba.silnice(data.blok("silnice", ci))
			var t3 := Time.get_ticks_usec()
			var b := Stavba.budovy(data.blok("budovy", ci))
			var t4 := Time.get_ticks_usec()
			var st := Stavba.stromy(data.blok("stromy", ci), data.roh_dlazdice(ci))
			var t5 := Time.get_ticks_usec()
			casy.teren += t1 - t0
			casy.povrch += t2 - t1
			casy.silnice += t3 - t2
			casy.budovy += t4 - t3
			casy.stromy += t5 - t4
			pocet += 1
			if dx == 0 and dz == 0:
				print("dlaždice %d: asfalt %d vrcholů, značky %d, pevné %d, budovy %d vrcholů" % [ci,
					s.asfalt.pocet() if s.has("asfalt") else 0, s.znacky.pocet() if s.has("znacky") else 0,
					s.pevne.pocet() if s.has("pevne") else 0, b.budovy.pocet() if b.has("budovy") else 0])
	for k: String in casy:
		print("%s: %.1f ms na dlaždici" % [k, casy[k] / 1000.0 / pocet])
	quit()
