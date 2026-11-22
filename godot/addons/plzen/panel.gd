@tool
extends VBoxContainer
## Hledání míst a oblastí mapy v editoru.

var _hledat: LineEdit
var _seznam: ItemList
var _info: Label
var _polozky: Array = []


func _ready() -> void:
	var nadpis := Label.new()
	nadpis.text = "Najdi místo v Plzni"
	add_child(nadpis)
	_hledat = LineEdit.new()
	_hledat.placeholder_text = "zastávka, památka nebo čtvrť (i bez diakritiky)"
	_hledat.clear_button_enabled = true
	_hledat.text_changed.connect(_hledej)
	add_child(_hledat)
	_seznam = ItemList.new()
	_seznam.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_seznam.custom_minimum_size = Vector2(0, 260)
	_seznam.item_activated.connect(_otevri)
	add_child(_seznam)
	_info = Label.new()
	_info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_info.text = "Dvojklikem otevřeš oblast a vybereš bod. V 3D pohledu pak stiskni F."
	add_child(_info)
	var okoli := Button.new()
	okoli.text = "Znovu importovat otevřenou oblast a okolí"
	okoli.tooltip_text = "Obnoví zastávky a místa z dat. Ručně posunuté nebo přejmenované body zůstanou."
	okoli.pressed.connect(_import_okoli)
	add_child(okoli)
	var vse := Button.new()
	vse.text = "Importovat celou mapu"
	vse.pressed.connect(_import_vse)
	add_child(vse)
	_nacti()


func _nacti() -> void:
	_polozky.clear()
	if not Mapa.nacti():
		_info.text = "Chybí data mapy (data/svet)."
		return
	var text := FileAccess.get_file_as_string(Mapa.SLOZKA + "zastavky.json")
	for z: Dictionary in (JSON.parse_string(text) if not text.is_empty() else []):
		_polozky.append({"text": "🚏 %s (%s)" % [z.nazev, z.id], "x": z.x, "z": z.z, "skupina": "Zastavky", "id": z.id})
	var mista := Mapa.mista()
	for m: Dictionary in mista.get("pamatky", []):
		_polozky.append({"text": "★ " + m.nazev, "x": m.x, "z": m.z, "skupina": "Mista", "id": m.id})
	for o: Dictionary in mista.get("obce", []):
		_polozky.append({"text": "⌂ %s (%s)" % [o.nazev, o.druh], "x": o.x, "z": o.z, "skupina": "", "id": ""})
	for p: Dictionary in _polozky:
		p.klic = _bez_diakritiky(p.text)
	_hledej("")


static func _bez_diakritiky(s: String) -> String:
	var z := "áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ"
	var na := "acdeeinorstuuyzACDEEINORSTUUYZ"
	var out := ""
	for ch in s:
		var i := z.find(ch)
		out += na[i] if i >= 0 else ch
	return out.to_lower()


func _hledej(text: String) -> void:
	_seznam.clear()
	var klic := _bez_diakritiky(text.strip_edges())
	var n := 0
	for i in _polozky.size():
		if klic.is_empty() or _polozky[i].klic.contains(klic):
			_seznam.add_item(_polozky[i].text)
			_seznam.set_item_metadata(_seznam.item_count - 1, i)
			n += 1
			if n >= 200:
				break


func _otevri(radek: int) -> void:
	var p: Dictionary = _polozky[_seznam.get_item_metadata(radek)]
	var b := Oblast.bunka_bodu(p.x, p.z)
	var cesta := Oblast.cesta(b)
	if not ResourceLoader.exists(cesta):
		ImportOblasti.prazdna_oblast(b)
		EditorInterface.get_resource_filesystem().scan()
	EditorInterface.open_scene_from_path(cesta)
	await get_tree().process_frame
	var koren := EditorInterface.get_edited_scene_root()
	if koren == null:
		return
	var cil: Node = koren
	if p.skupina != "":
		var skupina := koren.get_node_or_null(p.skupina)
		if skupina:
			for n in skupina.get_children():
				if n is UpravitelnyBod and n.id == p.id:
					cil = n
	EditorInterface.get_selection().clear()
	EditorInterface.get_selection().add_node(cil)
	EditorInterface.edit_node(cil)
	_info.text = "Otevřeno: %s\nV 3D pohledu stiskni F, kamera se přiblíží k vybranému bodu." % cesta.get_file()


func _import_okoli() -> void:
	var koren := EditorInterface.get_edited_scene_root()
	if not koren is Oblast:
		_info.text = "Nejdřív otevři scénu oblasti (res://svet/oblasti/…)."
		return
	var stred: Vector2i = (koren as Oblast).bunka
	var bunky := []
	for dz in range(-1, 2):
		for dx in range(-1, 2):
			bunky.append(stred + Vector2i(dx, dz))
	var cesta := koren.scene_file_path
	EditorInterface.save_scene()
	var s := ImportOblasti.importuj(bunky)
	EditorInterface.reload_scene_from_path(cesta)
	_info.text = "Import okolí: %d oblastí, %d nových, %d aktualizovaných, %d ručních úprav zachováno." % [
		s.oblasti, s.nove, s.aktualizovane, s.zachovane]


func _import_vse() -> void:
	var s := ImportOblasti.importuj()
	EditorInterface.get_resource_filesystem().scan()
	_info.text = "Import mapy: %d oblastí, %d nových, %d aktualizovaných, %d ručních úprav zachováno." % [
		s.oblasti, s.nove, s.aktualizovane, s.zachovane]
