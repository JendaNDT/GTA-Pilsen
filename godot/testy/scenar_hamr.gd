extends Scenar
## Vodní hamr v Dobřívě: model z předlohy stojí na místě, kola se točí jen v pracovní době (9–17 h).
## Spuštění: godot --headless --path godot testy/scenar_hamr.tscn

const HAMR := Vector2(22660.55, 3099.7)


func scenar() -> void:
	krok("Cesta do Dobřívu")
	await cekej_na_svet()
	hra.cas_zivy = false
	hra.nastav_cas(10.0, JizdniRad.den_z_textu("2026-11-20"))
	hra.svet.postav_hned(HAMR, 300.0)
	hra.chodec.postav_na(HAMR.x - 25.0, HAMR.y + 30.0)
	await cekej(1.5)
	var h := hra.hamr
	over(h._postaveno, "hamr je postavený, když je hráč blízko")
	over(h._kola.size() == 4, "hamr má 4 lopatková kola (%d)" % h._kola.size())
	var obec := Mapa.nejblizsi_obec(HAMR.x, HAMR.y)
	over(obec.contains("Dobřív"), "hamr stojí v obci %s" % obec)

	krok("V pracovní době se kola točí")
	var u0 := h.uhel
	await cekej(2.0)
	var otoceni := fposmod(h.uhel - u0, TAU)
	over(otoceni > 1.0 and otoceni < 1.9, "za 2 s se kola otočila o %.2f rad (0,72 rad/s)" % otoceni)
	over(is_equal_approx((h._kola[0] as Node3D).rotation.x, h.uhel), "kolo v modelu má stejný úhel")

	krok("Večer kola stojí")
	hra.nastav_cas(20.0)
	await cekej(1.0)
	var u1 := h.uhel
	await cekej(2.0)
	over(is_equal_approx(h.uhel, u1), "ve 20:00 se kola netočí")

	krok("Budova hamru má kolizi")
	var dotaz := PhysicsRayQueryParameters3D.create(Vector3(HAMR.x, Mapa.vyska(HAMR.x, HAMR.y) + 30.0, HAMR.y),
		Vector3(HAMR.x, Mapa.vyska(HAMR.x, HAMR.y) - 5.0, HAMR.y), Hra.VRSTVA_SVET)
	var zasah := hra.get_world_3d().direct_space_state.intersect_ray(dotaz)
	var vyska: float = (zasah.position as Vector3).y - Mapa.vyska(HAMR.x, HAMR.y) if not zasah.is_empty() else 0.0
	over(vyska > 5.0, "paprsek shora narazí na střechu hamru %.1f m nad terénem" % vyska)
	hra.chodec.postav_na(HAMR.x - 25.0, HAMR.y + 30.0)
	hra.kamera.yaw = atan2(25.0, -30.0)
	await cekej(0.5)
	await snimek("hamr")
