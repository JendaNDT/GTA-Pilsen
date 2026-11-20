@tool
class_name ImportOblasti
extends RefCounted
## Importér upravitelných oblastí. Z převedených dat (data/svet/zastavky.json) vytvoří nebo
## doplní scény res://svet/oblasti/oblast_X_Z.tscn.
##
## Pravidla slučování, aby nový import nepřepsal ruční úpravy:
##  * Zastávka, kterou autor neposunul (poloha = poloha z minulého převodu), dostane novou polohu z dat.
##  * Posunutou nebo otočenou zastávku importér nechá na místě a jen si zapamatuje novou polohu z dat.
##  * Přejmenovanou zastávku nepřejmenuje zpět.
##  * Zastávku, která z dat zmizela, smaže jen tehdy, když ji autor neupravil; jinak ji označí jako zastaralou.
##  * Uzly mimo skupinu Zastavky (např. Upravy) nechává beze změny.


## Spustí import. bunky = seznam Vector2i k obnově (prázdný = celá mapa).
## zastavky, mista = vlastní seznamy místo převedených dat (pro zkoušky).
## Vrací souhrn {oblasti, nove, aktualizovane, zachovane, smazane, zastarale, zpravy}.
static func importuj(bunky: Array = [], zastavky: Variant = null, mista: Variant = null) -> Dictionary:
	var souhrn := {"oblasti": 0, "nove": 0, "aktualizovane": 0, "zachovane": 0, "smazane": 0, "zastarale": 0, "zpravy": []}
	if not Mapa.nacti():
		souhrn.zpravy.append("Chybí data mapy.")
		return souhrn
	if zastavky == null:
		var text := FileAccess.get_file_as_string(Mapa.SLOZKA + "zastavky.json")
		zastavky = JSON.parse_string(text) if not text.is_empty() else []
	if mista == null:
		mista = Mapa.mista().get("pamatky", [])
	var skupiny := {"Zastavky": zastavky, "Mista": mista}
	var podle_bunky := {}
	for skupina: String in skupiny:
		for z: Dictionary in skupiny[skupina]:
			var b := Oblast.bunka_bodu(z.x, z.z)
			if not podle_bunky.has(b):
				podle_bunky[b] = {"Zastavky": [], "Mista": []}
			podle_bunky[b][skupina].append(z)
	DirAccess.make_dir_recursive_absolute(Oblast.slozka)
	# obnovit i oblasti, kde dřív nějaké body byly
	for soubor in DirAccess.get_files_at(Oblast.slozka):
		var m := RegEx.create_from_string("^oblast_(-?\\d+)_(-?\\d+)\\.tscn$").search(soubor)
		if m:
			var b := Vector2i(int(m.get_string(1)), int(m.get_string(2)))
			if not podle_bunky.has(b):
				podle_bunky[b] = {"Zastavky": [], "Mista": []}
	for b: Vector2i in podle_bunky:
		if not bunky.is_empty() and not bunky.has(b):
			continue
		_oblast(b, podle_bunky[b], souhrn)
	return souhrn


static func _oblast(b: Vector2i, obsah: Dictionary, souhrn: Dictionary) -> void:
	var cesta := Oblast.cesta(b)
	var koren: Oblast
	if ResourceLoader.exists(cesta):
		var scena: PackedScene = ResourceLoader.load(cesta, "", ResourceLoader.CACHE_MODE_IGNORE)
		koren = scena.instantiate()
	elif obsah.Zastavky.is_empty() and obsah.Mista.is_empty():
		return
	else:
		koren = Oblast.new()
		koren.name = "Oblast_%d_%d" % [b.x, b.y]
		var upravy := Node3D.new()
		upravy.name = "Upravy"
		koren.add_child(upravy)
		upravy.owner = koren
	koren.bunka = b
	koren.stred = Oblast.stred_bunky(b)
	_slouc(koren, "Zastavky", obsah.Zastavky, func() -> UpravitelnyBod: return Zastavka.new(), souhrn)
	_slouc(koren, "Mista", obsah.Mista, func() -> UpravitelnyBod: return Misto.new(), souhrn)
	var scena := PackedScene.new()
	var chyba := scena.pack(koren)
	if chyba == OK:
		chyba = ResourceSaver.save(scena, cesta)
	if chyba != OK:
		souhrn.zpravy.append("Oblast %s se nepodařilo uložit (chyba %d)." % [cesta, chyba])
	souhrn.oblasti += 1
	koren.free()


## Sloučí body jedné skupiny (např. Zastavky) s daty podle pravidel v záhlaví souboru.
static func _slouc(koren: Oblast, jmeno: String, polozky: Array, vyrob: Callable, souhrn: Dictionary) -> void:
	var skupina: Node3D = koren.get_node_or_null(jmeno)
	if skupina == null:
		if polozky.is_empty():
			return
		skupina = Node3D.new()
		skupina.name = jmeno
		koren.add_child(skupina)
		skupina.owner = koren
	var existujici := {}
	for n in skupina.get_children():
		if n is UpravitelnyBod and n.id != "":
			existujici[n.id] = n
	var videne := {}
	for z: Dictionary in polozky:
		var id: String = z.id
		videne[id] = true
		var pozice := Vector3(z.x - koren.stred.x, z.y, z.z - koren.stred.y)
		var natoceni: float = z.get("smer", 0.0)
		var n: UpravitelnyBod = existujici.get(id)
		if n == null:
			n = vyrob.call()
			n.name = _jmeno_uzlu(z)
			n.id = id
			n.nazev = z.nazev
			n.position = pozice
			n.rotation.y = natoceni
			if n is Misto:
				n.popis = z.get("popis", "")
			skupina.add_child(n)
			n.owner = koren
			souhrn.nove += 1
		else:
			if n.posunuta():
				souhrn.zachovane += 1
				souhrn.zpravy.append("%s %s (%s) zůstal na ručně upravené poloze." % [jmeno, n.nazev, id])
			else:
				if n.position.distance_to(pozice) > 0.05 or absf(wrapf(n.rotation.y - natoceni, -PI, PI)) > 0.01:
					souhrn.aktualizovane += 1
				n.position = pozice
				n.rotation.y = natoceni
			if not n.prejmenovana():
				n.nazev = z.nazev
		n.poradi = int(z.index)
		n.gen_pozice = pozice
		n.gen_natoceni = natoceni
		n.gen_nazev = z.nazev
		n.zastarala = false
	for id: String in existujici:
		if videne.has(id):
			continue
		var n: UpravitelnyBod = existujici[id]
		if n.posunuta() or n.prejmenovana():
			n.zastarala = true
			souhrn.zastarale += 1
			souhrn.zpravy.append("%s %s (%s) už v datech není, ale byl ručně upravený – ponechán." % [jmeno, n.nazev, id])
		else:
			skupina.remove_child(n)
			n.free()
			souhrn.smazane += 1


static func _jmeno_uzlu(z: Dictionary) -> String:
	var jmeno: String = z.nazev
	jmeno = jmeno.validate_node_name().replace(" ", "_")
	return "%s_%s" % [jmeno, str(z.id).replace("/", "-")]


## Vytvoří prázdnou oblast (jen skupinu Upravy) pro buňku bez zastávek a míst.
static func prazdna_oblast(b: Vector2i) -> void:
	var cesta := Oblast.cesta(b)
	if ResourceLoader.exists(cesta):
		return
	DirAccess.make_dir_recursive_absolute(Oblast.slozka)
	var koren := Oblast.new()
	koren.name = "Oblast_%d_%d" % [b.x, b.y]
	koren.bunka = b
	koren.stred = Oblast.stred_bunky(b)
	var upravy := Node3D.new()
	upravy.name = "Upravy"
	koren.add_child(upravy)
	upravy.owner = koren
	var scena := PackedScene.new()
	scena.pack(koren)
	ResourceSaver.save(scena, cesta)
	koren.free()
