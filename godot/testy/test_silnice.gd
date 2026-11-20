extends SceneTree
## Silnice ve svahu a v zatáčkách (bez vykreslování): terén nesmí prosvítat nad asfaltem a osa
## silnice se nesmí lámat. Měří dlaždice s nejstrmějšími zatáčkami v okolí Plzně.
##   godot --headless --path godot -s res://testy/test_silnice.gd

## Středy strmých zatočených silnic (sklon 6–10 %, zatočení 140–320°), nalezené v grafu silnic.
const MISTA := [Vector2(545, -1880), Vector2(827, -76), Vector2(-2123, -998), Vector2(-3178, -1754),
	Vector2(4689, -2772), Vector2(2386, 4508), Vector2(-1574, 4514)]
const VIDITELNE := 0.10      ## terén výš než 10 cm nad vozovkou už posun povrchu ke kameře nezakryje
const VELKE := 0.25

var chyby := 0


func over(ok: bool, popis: String) -> void:
	print(("  ✓ " if ok else "  ✗ ") + popis)
	if not ok:
		chyby += 1


func _init() -> void:
	Mapa.nacti()
	var trojuhelniku := 0
	var prosvita := 0
	var velke := 0
	var nejvic := 0.0
	var max_lom := 0.0
	for m: Vector2 in MISTA:
		var ci := Mapa.index_dlazdice(m.x, m.y)
		var s := Stavba.silnice(Mapa.blok("silnice", ci))
		if s.is_empty():
			continue
		var p: Stavba.Plocha = s.asfalt
		for q in range(0, p.i.size(), 3):
			var a := p.v[p.i[q]]
			var b := p.v[p.i[q + 1]]
			var c := p.v[p.i[q + 2]]
			# jen vozovka položená na terénu (mostovky mají vlastní výšku)
			if absf(a.y - Mapa.vyska(a.x, a.z) - Stavba.SURF) > 0.3:
				continue
			trojuhelniku += 1
			var nejhorsi := 0.0
			# terén v těžišti a ve středech hran trojúhelníku proti výšce vozovky
			for bod: Vector3 in [(a + b + c) / 3.0, (a + b) * 0.5, (b + c) * 0.5, (a + c) * 0.5]:
				nejhorsi = maxf(nejhorsi, Mapa.vyska(bod.x, bod.z) - (bod.y - Stavba.SURF))
			if nejhorsi > VIDITELNE:
				prosvita += 1
			if nejhorsi > VELKE:
				velke += 1
			nejvic = maxf(nejvic, nejhorsi)
	var podil := float(prosvita) / maxi(1, trojuhelniku)
	var podil_velke := float(velke) / maxi(1, trojuhelniku)
	print("  %d trojúhelníků vozovky; terén nad vozovkou o víc než 10 cm u %d (%.2f %%), o víc než 25 cm u %d, nejvýš %.2f m" % [
		trojuhelniku, prosvita, podil * 100.0, velke, nejvic])
	over(trojuhelniku > 1000, "změřeno %d trojúhelníků vozovky ve 7 strmých zatáčkách" % trojuhelniku)
	over(podil < 0.015, "terén vystupuje nad vozovku o víc než 10 cm u %.2f %% trojúhelníků (stará verze 1,98 %%, mez 1,5 %%)" % (podil * 100.0))
	over(podil_velke < 0.002, "o víc než 25 cm jen u %d trojúhelníků na prudkých srázech (stará verze 15, mez 0,2 %%)" % velke)

	# lom osy: vyhlazená osa se na jednom úseku stočí nejvýš o ~10° (předtím až o desítky stupňů)
	var g := Graf.nacti()
	var lomu := 0
	for m: Vector2 in MISTA:
		var ci := Mapa.index_dlazdice(m.x, m.y)
		var blok: Variant = Mapa.blok("silnice", ci)
		var rib: PackedFloat32Array = blok.rib
		for q in range(0, rib.size(), 16):
			var d := Stavba.Cesta.new()
			d.x = blok.x
			d.z = blok.z
			d.y = blok.y
			d.zac = int(rib[q + 12])
			d.n = int(rib[q + 13])
			d.px = Stavba._nan(rib[q + 8])
			d.pz = Stavba._nan(rib[q + 9])
			d.nx = Stavba._nan(rib[q + 10])
			d.nz = Stavba._nan(rib[q + 11])
			var v := Stavba.vyhlad(d)
			for k in range(1, v.n - 1):
				var d0 := Vector2(v.x[k] - v.x[k - 1], v.z[k] - v.z[k - 1])
				var d1 := Vector2(v.x[k + 1] - v.x[k], v.z[k + 1] - v.z[k])
				# viditelný zub: lom mezi úseky delšími než 2 m (ostré vlásenky z bodů po 1 m jsou oblouk)
				if d0.length() > 2.0 and d1.length() > 2.0:
					var lom := absf(d0.angle_to(d1))
					max_lom = maxf(max_lom, lom)
					if lom > deg_to_rad(15.0):
						lomu += 1
	print("  největší lom vyhlazené osy %.1f°, lomů nad 15°: %d" % [rad_to_deg(max_lom), lomu])
	over(lomu == 0, "osa silnic se v zatáčkách viditelně neláme (lomů nad 15° mezi úseky přes 2 m: %d, stará verze 85)" % lomu)
	print("VÝSLEDEK: ", "PROŠLO" if chyby == 0 else "SELHALO (%d)" % chyby)
	quit(0 if chyby == 0 else 1)
