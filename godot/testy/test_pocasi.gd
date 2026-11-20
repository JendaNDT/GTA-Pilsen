extends SceneTree
## Výpočet počasí bez vykreslování: stálost pro stejný čas, rozložení během roku, mokro po dešti,
## sníh, přilnavost a režim „vždy jasno“.  godot --headless --path godot -s res://testy/test_pocasi.gd

var chyby := 0
## Vzorky z původní hry (src/world/weather.js v Node): čas, druh, oblačnost, mokro, sníh, teplota.
const PREDLOHA := [
	[1795132800, "partly", 0.41, 0, 0, 6.396],
	[1795211640, "fog", 0.64, 0.8781, 0, 4.168],
	[1795290480, "fog", 0.64, 0.6319, 0, 6.475],
	[1795369320, "partly", 0.41, 0, 0.7384, -0.212],
	[1795448160, "cloudy", 0.9, 0, 0, 6.411],
	[1795527000, "cloudy", 0.9, 0, 0, -1.424],
	[1795605840, "fog", 0.64, 0, 0, 4.119],
	[1795684680, "cloudy", 0.8964, 0, 0, 5.182],
	[1795763520, "fog", 0.64, 0.7304, 0, 8.563],
	[1795842360, "cloudy", 0.9, 0.0315, 0, 2.641],
	[1795921200, "partly", 0.41, 0, 0, 7.571],
	[1796000040, "fog", 0.64, 0, 0, 5.595],
]


func over(ok: bool, popis: String) -> void:
	print(("  ✓ " if ok else "  ✗ ") + popis)
	if not ok:
		chyby += 1


func _init() -> void:
	var den := Slunce.den_z_data(2026, 11, 20)
	var cas := den * 86400.0 + 14.0 * 3600.0
	print("— Stejný čas dává stejné počasí")
	var a := Pocasi.new()
	var b := Pocasi.new()
	a.obnov(cas)
	b.obnov(cas)
	over(a.druh == b.druh and is_equal_approx(a.oblacnost, b.oblacnost) and is_equal_approx(a.mokro, b.mokro),
		"20. 11. 2026 14:00 → %s, %d °C, mokro %.2f" % [Pocasi.NAZVY[a.druh], roundi(a.teplota), a.mokro])

	print("— Shoda s původní hrou")
	var shoda := 0
	var w := Pocasi.new()
	for r: Array in PREDLOHA:
		w.obnov(float(r[0]))
		if w.druh == r[1] and absf(w.oblacnost - r[2]) < 0.001 and absf(w.mokro - r[3]) < 0.001 and absf(w.snih - r[4]) < 0.001 and absf(w.teplota - r[5]) < 0.01:
			shoda += 1
	over(shoda == PREDLOHA.size(), "%d z %d vzorků je stejných jako v předloze" % [shoda, PREDLOHA.size()])

	print("— Rozložení během roku (bloky po 3 hodinách)")
	var pocty := {}
	var snih_leto := 0
	var p := Pocasi.new()
	var zacatek := Slunce.den_z_data(2026, 1, 1)
	for d in 365:
		for blok in 8:
			var k: String = p.blok((zacatek + d) * 8 + blok).druh
			pocty[k] = int(pocty.get(k, 0)) + 1
			var mesic := int(Slunce.datum(zacatek + d).month)
			if k == "snow" and mesic >= 5 and mesic <= 9:
				snih_leto += 1
		if p._bloky.size() > 2000:
			p._bloky.clear()
	print("  ", pocty)
	var celkem := 365 * 8
	for k: String in ["clear", "partly", "cloudy", "rain", "fog", "snow"]:
		over(int(pocty.get(k, 0)) > 0, "během roku nastane %s (%d ×)" % [Pocasi.NAZVY[k], int(pocty.get(k, 0))])
	var srazky := float(int(pocty.get("rain", 0)) + int(pocty.get("storm", 0)) + int(pocty.get("snow", 0))) / celkem
	over(srazky > 0.15 and srazky < 0.35, "srážky zhruba ve čtvrtině času (%.0f %%)" % (srazky * 100.0))
	over(snih_leto == 0, "v létě nesněží")

	print("— Déšť: mokro a přilnavost")
	var d := Pocasi.new()
	d.vynuceno = "rain"
	d.obnov(cas)
	over(d.dest > 0.7, "prší (síla %.2f)" % d.dest)
	over(d.mokro > 0.9, "po hodinách deště je mokro (%.2f)" % d.mokro)
	over(absf(d.prilnavost() - 0.7) < 0.05, "přilnavost na mokru %.2f" % d.prilnavost())

	print("— Sníh")
	var s := Pocasi.new()
	s.vynuceno = "snow"
	s.obnov(cas)
	over(s.vlocky > 0.8 and s.dest == 0.0, "sněží (vločky %.2f)" % s.vlocky)
	over(s.snih > 0.9, "napadl sníh (%.2f)" % s.snih)
	over(s.prilnavost() < 0.4, "přilnavost na sněhu %.2f" % s.prilnavost())

	print("— Mokro po dešti vyschne")
	var v := Pocasi.new()
	var posledni_dest := -1.0
	for blok_id in range(int(cas / Pocasi.BLOK), int(cas / Pocasi.BLOK) + 2000):
		if v.blok(blok_id).druh == "rain" and v.blok(blok_id + 1).druh != "rain" and v.blok(blok_id + 2).druh in ["clear", "partly", "cloudy"] and v.blok(blok_id + 3).druh in ["clear", "partly", "cloudy"]:
			posledni_dest = blok_id
			break
	over(posledni_dest > 0, "našel se déšť následovaný suchem")
	if posledni_dest > 0:
		v.obnov((posledni_dest + 1) * Pocasi.BLOK - 600.0)
		var mokro_po := v.mokro
		v.obnov((posledni_dest + 3) * Pocasi.BLOK + 3600.0)
		over(mokro_po > 0.5 and v.mokro < mokro_po * 0.6, "mokro %.2f klesne za 7 h na %.2f" % [mokro_po, v.mokro])

	print("— Vždy jasno")
	var j := Pocasi.new()
	j.rezim = "jasno"
	j.vynuceno = "storm"
	j.obnov(cas)
	over(j.druh == "clear" and j.dest == 0.0 and j.prilnavost() == 1.0, "jasno, sucho, plná přilnavost")

	print("VÝSLEDEK: ", "PROŠLO" if chyby == 0 else "SELHALO (%d)" % chyby)
	quit(0 if chyby == 0 else 1)
