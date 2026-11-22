extends Scenar
## Dokončení zakázky: rozvoz jídla autem od převzetí v podniku po doručení na adresu.
##   godot --headless --path godot testy/scenar_zakazka.tscn


func scenar() -> void:
	krok("Start a nástup do auta")
	await cekej_na_svet()
	await cekej(1.0)
	var auto := hra.auto_hrace
	hra.chodec.global_position = auto.global_position + Vector3(0, 0.2, 0) + auto.global_basis.x * 2.2
	await cekej(0.3)
	hra._akce("nastoupit")
	await cekej(0.3)
	over(hra.rezim == "auto", "hráč sedí v autě")
	var penize_pred := hra.penize

	krok("Nová zakázka rozvozu jídla")
	hra.zakazky.nahoda.seed = 42
	var chyba := hra.zakazky.zacni("jidlo")
	over(chyba == "", "zakázka přijata %s" % chyba)
	var j := hra.zakazky.zakazka
	print("  podnik %s (%s), adresa %s, trasa %.0f m, limit %.0f s, odměna %d Kč" % [j.nazev, j.druh, j.adresa, j.delka, j.limit, j.odmena])
	over(j.delka > 400.0 and j.limit > 0.0, "trasa a limit spočítané z grafu")
	await cekej(0.6)
	over(hra.hud.text_zakazky().contains(j.nazev), "HUD ukazuje, kde jídlo vyzvednout")
	await snimek("01-zakazka-prijata")

	krok("Jízda do podniku")
	var c: Dictionary = hra.zakazky.cil()
	var ok := await jed_po_trase(auto, trasa(auto.global_position, Vector2(c.x, c.z)), 45.0, 400.0)
	await cekej(0.5)
	over(ok and hra.zakazky.zakazka.get("faze", "") == "doruceni", "jídlo vyzvednuto")
	await snimek("02-vyzvednuto")

	krok("Jízda na adresu doručení")
	c = hra.zakazky.cil()
	var zacatek: float = hra.zakazky.zakazka.cas
	ok = await jed_po_trase(auto, trasa(auto.global_position, Vector2(c.x, c.z)), 45.0, 600.0)
	await cekej(0.5)
	var v := hra.zakazky.posledni
	over(ok and v.get("stav", "") == "zaplaceno", "zakázka dokončena: %s" % Zakazky.text_vysledku(v))
	over(hra.penize == penize_pred + int(v.get("castka", 0)), "peníze přibyly (%d → %d Kč)" % [penize_pred, hra.penize])
	over(int(hra.statistiky.get("rozvozy", 0)) == 1, "statistika rozvozů: 1")
	over(Ulozeni.existuje(), "výsledek je uložený")
	print("  časový limit %.0f s, zbývalo %.0f s" % [zacatek, maxf(0.0, zacatek)])
	await snimek("03-doruceno")
