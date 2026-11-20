extends SceneTree
## Zkouška importu oblastí: ruční úpravy přežijí nový import.
##   godot --headless --path godot -s res://testy/test_import.gd
## Pracuje v dočasné složce user://, skutečné scény v res://svet/oblasti/ nemění.

var chyby := 0


func over(ok: bool, popis: String) -> void:
	print(("  ✓ " if ok else "  ✗ ") + popis)
	if not ok:
		chyby += 1


func _nacti(b: Vector2i) -> Oblast:
	var s: PackedScene = ResourceLoader.load(Oblast.cesta(b), "", ResourceLoader.CACHE_MODE_IGNORE)
	return s.instantiate()


## Uloží scénu tak, jak by ji uložil editor po ruční úpravě.
func _uloz(o: Oblast) -> void:
	var s := PackedScene.new()
	s.pack(o)
	ResourceSaver.save(s, Oblast.cesta(o.bunka))
	o.free()


func _zastavka(o: Oblast, id: String) -> Zastavka:
	for n in o.get_node("Zastavky").get_children():
		if n.id == id:
			return n
	return null


func _initialize() -> void:
	Mapa.nacti()
	var slozka := "user://zkouska_oblasti_%d/" % Time.get_ticks_usec()
	Oblast.slozka = slozka
	var b := Oblast.bunka_bodu(0, 100)
	var s := Oblast.stred_bunky(b)

	print("— Pravidla slučování na vlastních datech")
	var d1 := [
		{"index": 0, "id": "A/1", "nazev": "Alfa", "x": s.x + 10, "z": s.y + 10, "y": 1.0, "smer": 0.0},
		{"index": 1, "id": "B/1", "nazev": "Beta", "x": s.x + 20, "z": s.y + 20, "y": 2.0, "smer": 0.5},
	]
	ImportOblasti.importuj([b], d1, [])
	var o := _nacti(b)
	over(_zastavka(o, "A/1") != null and _zastavka(o, "B/1") != null, "první import vytvořil obě zastávky")
	# autor posune zastávku A, přejmenuje B a přidá vlastní objekt
	_zastavka(o, "A/1").position = Vector3(15, 1.0, 13)
	_zastavka(o, "B/1").nazev = "Beta (ruční název)"
	var vlastni := Node3D.new()
	vlastni.name = "MojeLavicka"
	o.get_node("Upravy").add_child(vlastni)
	vlastni.owner = o
	_uloz(o)
	# data se změní: obě zastávky jinde
	var d2 := [
		{"index": 0, "id": "A/1", "nazev": "Alfa", "x": s.x + 11, "z": s.y + 11, "y": 1.0, "smer": 0.0},
		{"index": 1, "id": "B/1", "nazev": "Beta", "x": s.x + 25, "z": s.y + 25, "y": 2.0, "smer": 0.5},
	]
	var souhrn := ImportOblasti.importuj([b], d2, [])
	o = _nacti(b)
	var a := _zastavka(o, "A/1")
	var bb := _zastavka(o, "B/1")
	over(a.position.is_equal_approx(Vector3(15, 1.0, 13)), "posunutá zastávka A zůstala, kam ji autor dal (%s)" % a.position)
	over(a.gen_pozice.is_equal_approx(Vector3(11, 1.0, 11)), "importér si zapamatoval novou polohu z dat")
	over(bb.position.is_equal_approx(Vector3(25, 2.0, 25)), "neposunutá zastávka B se přesunula podle nových dat")
	over(bb.nazev == "Beta (ruční název)", "ruční název zastávky B zůstal")
	over(o.get_node_or_null("Upravy/MojeLavicka") != null, "vlastní objekt v Upravy zůstal")
	over(souhrn.zachovane == 1 and souhrn.aktualizovane == 1, "souhrn: 1 ponechaná úprava, 1 aktualizace")
	o.free()
	# třetí import: A i B z dat zmizí
	souhrn = ImportOblasti.importuj([b], [], [])
	o = _nacti(b)
	a = _zastavka(o, "A/1")
	over(a != null and a.zastarala, "upravená zastávka, která z dat zmizela, zůstala jako zastaralá")
	over(_zastavka(o, "B/1") != null, "přejmenovaná zastávka B také zůstala (je ručně upravená)")
	o.free()

	print("— Skutečná data: posunutí zastávky Náměstí Republiky a nový import okolí")
	var namesti := Oblast.bunka_bodu(-2.2, 119.9)
	ImportOblasti.importuj([namesti])
	o = _nacti(namesti)
	var z := _zastavka(o, "54717/2")
	over(z != null and z.nazev == "Náměstí Republiky", "zastávka Náměstí Republiky (54717/2) je v oblasti")
	var nova := z.position + Vector3(4.0, 0, -2.5)
	z.position = nova
	_uloz(o)
	ImportOblasti.importuj([namesti])
	o = _nacti(namesti)
	z = _zastavka(o, "54717/2")
	over(z.position.is_equal_approx(nova), "po novém importu zůstala zastávka na ručně zvoleném místě")
	var jina := _zastavka(o, "54717/4")
	over(jina != null and jina.position.is_equal_approx(jina.gen_pozice), "ostatní zastávky odpovídají datům")
	o.free()
	print("VÝSLEDEK: ", "PROŠLO" if chyby == 0 else "SELHALO (%d)" % chyby)
	quit(0 if chyby == 0 else 1)
