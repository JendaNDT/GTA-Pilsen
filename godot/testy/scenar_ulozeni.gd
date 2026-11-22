extends Scenar
## Uložení a načtení po restartu ve dvou samostatných spuštěních Godotu:
##   godot --headless --path godot testy/scenar_ulozeni.tscn -- --faze 1
##   godot --headless --path godot testy/scenar_ulozeni.tscn -- --faze 2
## Fáze 1 hraje a uloží, fáze 2 je nový proces, který uložení načte a porovná.

const OCEKAVANI := "user://zkouska-ulozeni-ocekavani.json"
var faze := 1


func _init() -> void:
	var a := OS.get_cmdline_user_args()
	var i := a.find("--faze")
	if i >= 0 and i + 1 < a.size():
		faze = int(a[i + 1])
	zachovat_ulozeni = faze == 2


func scenar() -> void:
	if faze == 1:
		await _faze1()
	else:
		await _faze2()


func _faze1() -> void:
	krok("Fáze 1: nová hra, objev, jízda autem a uložení")
	await cekej_na_svet()
	await cekej(2.0)
	over(hra.objevene.has("pamatka-0"), "u startu se objevila katedrála sv. Bartoloměje")
	over(hra.penize == 650, "odměna za objev: %d Kč" % hra.penize)
	var auto := hra.auto_hrace
	hra.chodec.global_position = auto.global_position + Vector3(0, 0.2, 0) + auto.global_basis.x * 2.2
	await cekej(0.3)
	hra._akce("nastoupit")
	await cekej(0.3)
	over(hra.rezim == "auto", "hráč nastoupil do auta")
	Vstup.dotyk_pohyb = Vector2(0, 0.6)
	await cekej(3.0)
	Vstup.dotyk_pohyb = Vector2(0, -1)
	var t := 0.0
	while auto.rychlost_kmh() > 2.0 and t < 10.0:
		await get_tree().physics_frame
		t += 1.0 / Engine.physics_ticks_per_second
	Vstup.dotyk_pohyb = Vector2.ZERO
	await cekej(0.5)
	hra._akce("nastoupit")
	await cekej(0.5)
	over(hra.rezim == "pesky", "hráč vystoupil")
	hra.pridej_penize(1234)
	hra.nastav_cas(21.5)
	hra.cas_zivy = false
	over(hra.uloz(), "hra se uložila")
	var p := hra.chodec.global_position
	var a := hra.auto_hrace.global_position
	var f := FileAccess.open(OCEKAVANI, FileAccess.WRITE)
	f.store_string(JSON.stringify({"penize": hra.penize, "hrac": [p.x, p.y, p.z], "auto": [a.x, a.y, a.z]}))
	f.close()
	print("  uloženo: %d Kč, hráč (%.1f, %.1f), auto (%.1f, %.1f)" % [hra.penize, p.x, p.z, a.x, a.z])


func _faze2() -> void:
	krok("Fáze 2: nové spuštění hry načte uložený postup")
	var o: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(OCEKAVANI))
	await cekej_na_svet()
	await cekej(1.0)
	over(hra.penize == int(o.penize), "peníze po restartu: %d Kč (čekáno %d)" % [hra.penize, int(o.penize)])
	var p := hra.chodec.global_position
	var hrac := Vector3(o.hrac[0], o.hrac[1], o.hrac[2])
	over(Vector2(p.x - hrac.x, p.z - hrac.z).length() < 1.0, "hráč je na uloženém místě (%.1f m)" % Vector2(p.x - hrac.x, p.z - hrac.z).length())
	var a := hra.auto_hrace.global_position
	var auto := Vector3(o.auto[0], o.auto[1], o.auto[2])
	over(Vector2(a.x - auto.x, a.z - auto.z).length() < 1.5, "auto stojí na uloženém místě (%.1f m)" % Vector2(a.x - auto.x, a.z - auto.z).length())
	over(hra.objevene.has("pamatka-0"), "objevená katedrála zůstala objevená")
	over(not hra.cas_zivy and absf(hra.cas_hodina - 21.5) < 0.05, "ručně nastavený čas 21:30 zůstal")
	await snimek("restart")
