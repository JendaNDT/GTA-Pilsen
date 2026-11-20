class_name Scenar
extends Node
## Základ pro zkoušky herních situací. Scénář spustí hlavní scénu hry, ovládá vstupy jako hráč,
## ověřuje výsledky a na konci ukončí Godot s kódem 0 (vše prošlo) nebo 1 (chyba).
## Snímky se ukládají jen při vykreslování (bez --headless) do složky z parametru --snimky.

var hra: Hra
var chyby := 0
var _snimky := ""
var _limit := 600.0


func _ready() -> void:
	var a := OS.get_cmdline_user_args()
	for i in a.size():
		if a[i] == "--snimky" and i + 1 < a.size():
			_snimky = a[i + 1]
	hra = load("res://sceny/hra.tscn").instantiate()
	add_child(hra)
	_hlidac()
	await get_tree().process_frame
	await scenar()
	print("VÝSLEDEK: ", "PROŠLO" if chyby == 0 else "SELHALO (%d)" % chyby)
	get_tree().quit(0 if chyby == 0 else 1)


func _hlidac() -> void:
	await get_tree().create_timer(_limit).timeout
	print("CHYBA: vypršel časový limit zkoušky")
	get_tree().quit(2)


## Přepsat ve scénáři.
func scenar() -> void:
	pass


func over(podminka: bool, popis: String) -> void:
	if podminka:
		print("  ✓ ", popis)
	else:
		chyby += 1
		print("  ✗ ", popis)


func krok(popis: String) -> void:
	print("— ", popis)


func cekej_snimky(n: int) -> void:
	for k in n:
		await get_tree().physics_frame


func cekej(sekund: float) -> void:
	await cekej_snimky(int(sekund * Engine.physics_ticks_per_second))


## Počká, až budou postavené dlaždice v okolí hráče.
func cekej_na_svet(max_sekund := 60.0) -> void:
	var t := 0.0
	while hra.svet.ceka_na_stavbu() > 0 and t < max_sekund:
		await get_tree().process_frame
		t += get_process_delta_time()


func snimek(nazev: String) -> void:
	if _snimky.is_empty() or DisplayServer.get_name() == "headless":
		return
	for k in 3:
		await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	var cesta := _snimky.path_join(nazev + ".png")
	img.save_png(cesta)
	print("  snímek ", cesta)
