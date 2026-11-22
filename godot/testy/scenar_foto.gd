extends Scenar
## Fotorežim: zastaví hru, skryje rozhraní, volná kamera do 100 m od místa, uložení PNG
## (jen při vykreslování) a návrat do hry. Spuštění: godot --headless --path godot testy/scenar_foto.tscn


func scenar() -> void:
	krok("Otevření fotorežimu (O)")
	await cekej_na_svet()
	await cekej(0.5)
	var puvodni := get_viewport().get_camera_3d()
	var start := puvodni.global_position
	hra._akce("fotorezim")
	await get_tree().process_frame
	var f := hra.fotorezim
	over(f.aktivni and get_tree().paused, "fotorežim je otevřený a hra stojí")
	over(not hra.hud.visible, "herní rozhraní je skryté")
	over(get_viewport().get_camera_3d() != puvodni, "kreslí volná kamera")
	var cas := hra.cas_hodina
	var hrac := hra.chodec.global_position

	krok("Pohyb kamery a hranice 100 m")
	Input.action_press("vpred")
	for k in 120:
		await get_tree().process_frame
	Input.action_release("vpred")
	var kam := get_viewport().get_camera_3d().global_position
	over(kam.distance_to(start) > 5.0, "kamera se posunula o %.0f m" % kam.distance_to(start))
	Input.action_press("vpred")
	var t0 := Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < 9000:
		await get_tree().process_frame
	Input.action_release("vpred")
	kam = get_viewport().get_camera_3d().global_position
	over(kam.distance_to(start) <= 100.5, "kamera zůstala do 100 m od místa (%.0f m)" % kam.distance_to(start))
	over(is_equal_approx(hra.cas_hodina, cas) and hra.chodec.global_position.distance_to(hrac) < 0.01, "herní čas i hráč stojí")
	await snimek("foto")

	if DisplayServer.get_name() != "headless":
		krok("Uložení snímku")
		var cesta: String = await f.uloz()
		over(cesta != "" and FileAccess.file_exists(cesta), "snímek uložen do %s" % ProjectSettings.globalize_path(cesta))

	krok("Návrat do hry")
	f.zavri()
	await get_tree().process_frame
	over(not f.aktivni and not get_tree().paused, "hra znovu běží")
	over(get_viewport().get_camera_3d() == puvodni and hra.hud.visible, "vrátila se herní kamera i rozhraní")
