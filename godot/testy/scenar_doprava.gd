extends Scenar
## Provoz, semafory, chodci a policie kolem náměstí Republiky.
##   godot --headless --path godot testy/scenar_doprava.tscn


func scenar() -> void:
	krok("Provoz se rozjede (pátek 20. 11. 2026, 16:00)")
	await cekej_na_svet()
	hra.cas_zivy = false
	hra.nastav_cas(16.0, JizdniRad.den_z_textu("2026-11-20"))
	var d := hra.doprava
	d.nahoda.seed = 7
	await cekej(4.0)
	over(d.auta.size() >= 10, "kolem hráče jezdí %d aut" % d.auta.size())
	over(d.zaparkovana.size() >= 5, "u chodníků stojí %d zaparkovaných aut" % d.zaparkovana.size())
	over(hra.chodci.chodci.size() >= 5, "po chodnících chodí %d chodců" % hra.chodci.chodci.size())

	krok("Jízda podle pravidel (60 s): pohyb a semafory")
	var poruseni := 0
	var projeti_semaforu := 0
	var ujeto := 0.0
	var minule := {}
	for v: VozProvozu in d.auta:
		minule[v] = [v.hrana, v.s]
	var t := 0.0
	while t < 60.0:
		await get_tree().physics_frame
		t += 1.0 / Engine.physics_ticks_per_second
		for v: VozProvozu in d.auta:
			if not minule.has(v):
				minule[v] = [v.hrana, v.s]
				continue
			var m: Array = minule[v]
			if m[0] == v.hrana:
				ujeto += maxf(0.0, v.s - m[1])
				# přejel vůz čáru semaforu?
				for c: Array in d.rizeni.pravidla.get(v.hrana, []):
					if c[1] == Rizeni.SEMAFOR and m[1] < c[0] - 0.5 and v.s >= c[0] - 0.5:
						projeti_semaforu += 1
						if d.rizeni.svetlo(c[2], c[3]) == "red":
							poruseni += 1
			minule[v] = [v.hrana, v.s]
	print("  ujeto celkem %.0f m, průjezdů semafory %d" % [ujeto, projeti_semaforu])
	over(ujeto > 1500.0, "auta se pohybují (celkem %.0f m za minutu)" % ujeto)
	over(poruseni == 0, "žádné auto neprojelo na červenou (%d porušení z %d průjezdů)" % [poruseni, projeti_semaforu])
	await snimek("01-provoz")

	krok("Policie: přestupek, honička a zatčení")
	var penize := hra.penize
	hra.prestupek(2, "Zkouška")
	await cekej(1.0)
	over(hra.policie.hledanost == 2 and hra.policie.hlidky.size() == 2, "hledanost 2, vyjely 2 hlídky")
	t = 0.0
	while hra.policie.hledanost > 0 and t < 120.0:
		await get_tree().physics_frame
		t += 1.0 / Engine.physics_ticks_per_second
	over(hra.policie.hledanost == 0 and hra.penize < penize, "hráč byl zatčen za %.0f s, pokuta %d Kč" % [t, penize - hra.penize])
	over(int(hra.statistiky.get("zatceni", 0)) == 1, "statistika zatčení")

	krok("Denní rytmus provozu (měřené ulice a odhad)")
	var r := Rytmus.nacti()
	var den := JizdniRad.den_z_textu("2026-11-20")
	var merene := 0
	for k in r.hrany:
		if k >= 0:
			merene += 1
	over(merene > 500, "%d hran má křivku z dopravních detektorů" % merene)
	var spicka := r.hustota_aut(d.graf, -42.0, 52.0, den, 16.5)
	var noc := r.hustota_aut(d.graf, -42.0, 52.0, den, 3.5)
	var nedele := r.hustota_aut(d.graf, -42.0, 52.0, den + 2, 7.5)
	var pondeli := r.hustota_aut(d.graf, -42.0, 52.0, den + 3, 7.5)
	print("  hustota u náměstí: pátek 16:30 %.2f, 3:30 %.2f; neděle 7:30 %.2f, pondělí 7:30 %.2f" % [spicka, noc, nedele, pondeli])
	over(spicka > 0.5 and noc < spicka * 0.4, "odpoledne je provoz hustší než v noci")
	over(nedele < pondeli, "v neděli ráno jezdí méně aut než v pondělí")
	var cil_den := d.cil_aut
	hra.nastav_cas(3.5, den)
	await cekej(3.0)
	over(d.cil_aut < cil_den * 0.6, "v noci provoz zředí: cíl %d aut místo %d" % [d.cil_aut, cil_den])
