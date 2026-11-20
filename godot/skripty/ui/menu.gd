class_name Menu
extends CanvasLayer
## Herní menu (Esc nebo tlačítko Menu): pokračování, uložení, nastavení, ovládání a O hře.
## Při otevřeném menu hra stojí.

signal zmena_nastaveni(klic: String, hodnota: Variant)
signal pozadavek(akce: String)

var _panel: PanelContainer
var _karty: TabContainer
var _kvalita: OptionButton
var _zvuk: CheckButton
var _hodiny: CheckButton
var _pocasi: OptionButton
var _srazky: CheckButton
var _cas_zivy: CheckButton
var _hodina: SpinBox
var _stav: Label
var _obsah_karet := {}


func _ready() -> void:
	layer = 20
	process_mode = Node.PROCESS_MODE_ALWAYS
	visible = false
	var pozadi := ColorRect.new()
	pozadi.color = Color(0, 0, 0, 0.45)
	pozadi.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(pozadi)
	_panel = PanelContainer.new()
	_panel.set_anchors_preset(Control.PRESET_CENTER)
	_panel.custom_minimum_size = Vector2(760, 520)
	_panel.offset_left = -380
	_panel.offset_top = -260
	_panel.offset_right = 380
	_panel.offset_bottom = 260
	add_child(_panel)
	var obsah := VBoxContainer.new()
	_panel.add_child(obsah)
	var nadpis := Label.new()
	nadpis.text = "Plzeň naplno"
	nadpis.add_theme_font_size_override("font_size", 28)
	obsah.add_child(nadpis)
	_karty = TabContainer.new()
	_karty.size_flags_vertical = Control.SIZE_EXPAND_FILL
	obsah.add_child(_karty)
	_karta_hra()
	_obsah_karet["zakazky"] = _karta("Zakázky")
	_obsah_karet["garaz"] = _karta("Garáž")
	_karta_nastaveni()
	_karta_text("Ovládání", OVLADANI)
	_karta_text("O hře", O_HRE)


func _karta(nazev: String) -> VBoxContainer:
	var s := ScrollContainer.new()
	s.name = nazev
	s.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_karty.add_child(s)
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	s.add_child(v)
	return v


## Obsah karty (pro zakázky a garáž, které plní jiné části hry).
func karta(klic: String) -> VBoxContainer:
	return _obsah_karet.get(klic)


func _tlacitko(rodic: Control, text: String, akce: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(0, 44)
	b.add_theme_font_size_override("font_size", 20)
	b.pressed.connect(akce)
	rodic.add_child(b)
	return b


func _karta_hra() -> void:
	var v := _karta("Hra")
	_tlacitko(v, "Pokračovat", zavri)
	_tlacitko(v, "Uložit hru", func() -> void: pozadavek.emit("ulozit"))
	_tlacitko(v, "Nová hra (smaže uložený postup)", func() -> void: pozadavek.emit("nova_hra"))
	if not OS.has_feature("web"):
		_tlacitko(v, "Uložit a ukončit", func() -> void: pozadavek.emit("konec"))
	_stav = Label.new()
	_stav.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(_stav)


func _karta_nastaveni() -> void:
	var v := _karta("Nastavení")
	var r1 := HBoxContainer.new()
	v.add_child(r1)
	var l := Label.new()
	l.text = "Kvalita grafiky"
	l.custom_minimum_size.x = 260
	r1.add_child(l)
	_kvalita = OptionButton.new()
	_kvalita.add_item("Automaticky")
	_kvalita.set_item_metadata(0, "auto")
	for k: String in Kvalita.PORADI:
		_kvalita.add_item(Kvalita.PREDVOLBY[k].nazev)
		_kvalita.set_item_metadata(_kvalita.item_count - 1, k)
	_kvalita.item_selected.connect(func(i: int) -> void: zmena_nastaveni.emit("kvalita", _kvalita.get_item_metadata(i)))
	r1.add_child(_kvalita)
	var r0 := HBoxContainer.new()
	v.add_child(r0)
	var l0 := Label.new()
	l0.text = "Počasí"
	l0.custom_minimum_size.x = 260
	r0.add_child(l0)
	_pocasi = OptionButton.new()
	_pocasi.add_item("Proměnlivé")
	_pocasi.set_item_metadata(0, "promenlive")
	_pocasi.add_item("Vždy jasno")
	_pocasi.set_item_metadata(1, "jasno")
	_pocasi.item_selected.connect(func(i: int) -> void: zmena_nastaveni.emit("pocasi", _pocasi.get_item_metadata(i)))
	r0.add_child(_pocasi)
	_srazky = _prepinac(v, "Kapky deště a vločky", "srazky")
	_zvuk = _prepinac(v, "Zvuk", "zvuk")
	_hodiny = _prepinac(v, "Zobrazit hodiny", "hodiny")
	_cas_zivy = _prepinac(v, "Herní čas podle hodin v Plzni", "cas_zivy")
	var r2 := HBoxContainer.new()
	v.add_child(r2)
	var l2 := Label.new()
	l2.text = "Herní hodina (při vypnutém živém čase)"
	l2.custom_minimum_size.x = 260
	r2.add_child(l2)
	_hodina = SpinBox.new()
	_hodina.min_value = 0
	_hodina.max_value = 23.99
	_hodina.step = 0.25
	_hodina.value_changed.connect(func(h: float) -> void: zmena_nastaveni.emit("hodina", h))
	r2.add_child(_hodina)


func _prepinac(rodic: Control, text: String, klic: String) -> CheckButton:
	var c := CheckButton.new()
	c.text = text
	c.add_theme_font_size_override("font_size", 18)
	c.toggled.connect(func(zap: bool) -> void: zmena_nastaveni.emit(klic, zap))
	rodic.add_child(c)
	return c


func _karta_text(nazev: String, text: String) -> void:
	var v := _karta(nazev)
	var t := RichTextLabel.new()
	t.bbcode_enabled = true
	t.fit_content = true
	t.text = text
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	t.meta_clicked.connect(func(odkaz: Variant) -> void: OS.shell_open(str(odkaz)))
	v.add_child(t)


## Zobrazí menu a nastaví prvky podle aktuálního nastavení.
func otevri(nastaveni: Dictionary, cas_zivy: bool, hodina: float, info := "") -> void:
	for i in _kvalita.item_count:
		if _kvalita.get_item_metadata(i) == nastaveni.get("kvalita", "auto"):
			_kvalita.select(i)
	_pocasi.select(1 if nastaveni.get("pocasi", "promenlive") == "jasno" else 0)
	_srazky.set_pressed_no_signal(bool(nastaveni.get("srazky", true)))
	_zvuk.set_pressed_no_signal(bool(nastaveni.get("zvuk", true)))
	_hodiny.set_pressed_no_signal(bool(nastaveni.get("hodiny", true)))
	_cas_zivy.set_pressed_no_signal(cas_zivy)
	_hodina.set_value_no_signal(snappedf(hodina, 0.25))
	_stav.text = info
	visible = true
	get_tree().paused = true


func zavri() -> void:
	visible = false
	get_tree().paused = false


func _unhandled_input(event: InputEvent) -> void:
	if visible and event.is_action_pressed("menu"):
		zavri()
		get_viewport().set_input_as_handled()


const OVLADANI := """[b]Na počítači[/b]
W A S D nebo šipky – chůze, řízení
Shift – běh
Mezerník – skok, ruční brzda
F nebo E – nastoupit do auta nebo MHD, vystoupit
myš se stisknutým tlačítkem – otáčení kamery, kolečko přibližuje
C – vzdálenost kamery
R – postavit auto zpět na kola
N – posunout čas o 3 hodiny
Esc – menu

[b]Na telefonu[/b]
páčka vlevo – pohyb, tah prstem vpravo – kamera
tlačítka vpravo – nastoupit, brzda, běh, mapa, menu"""

const O_HRE := """[b]Plzeň naplno[/b] · verze 0.1.0 (Godot)
Otevřený svět postavený ze skutečných dat od Plzně přes Rokycany až do Dobříva: kopce a údolí řek, půdorysy a výšky budov, silnice a mosty, linky MHD, parky, podniky i adresy. Hra je nezávislý fanouškovský projekt, není oficiálním produktem města Plzně ani dopravního podniku.

[b]Software[/b]
Herní engine [url=https://godotengine.org]Godot 4.7.2[/url] (Juan Linietsky, Ariel Manzur a přispěvatelé Godotu, licence [url=https://godotengine.org/license]MIT[/url]). Fyziku počítá [url=https://github.com/jrouwe/JoltPhysics]Jolt Physics[/url] (Jorrit Rouwe, licence MIT), který je součástí Godotu.

[b]Zdroje dat[/b]
Mapová data © [url=https://www.openstreetmap.org/copyright]přispěvatelé OpenStreetMap[/url] (licence ODbL).
Terén vychází z digitálního modelu reliéfu DMR 5G, výšky budov z rozdílu modelu povrchu DMP 1G a DMR 5G © [url=https://www.cuzk.gov.cz]ČÚZK[/url].
Polohy značek, stop čar a přechodů v Plzni vycházejí také z otevřeného [url=https://opendata.plzen.eu/public/opendata/detail/6]pasportu svislého[/url] a [url=https://opendata.plzen.eu/public/opendata/detail/92]vodorovného značení města Plzně[/url].
Odjezdy tramvají, trolejbusů a autobusů vycházejí z GTFS [url=https://opendata.plzen.eu/public/opendata/detail/187]Plzeňských městských dopravních podniků, a.s.[/url] ([url=https://creativecommons.org/licenses/by/4.0/]CC BY 4.0[/url]).
Tvar říčního dna je vlastní herní odhad podle vzdálenosti od břehu; výška dna u Wilsonova mostu byla porovnána s [url=https://gis.plzen.eu/foto/pov_model/profily/PM_Psany_PP.pdf]profilem R19 povodňového modelu města Plzně[/url].
Popisy památek obsahují jen obecně známá fakta.

[b]Zvuk[/b]
Motory, rotor, klakson, náraz a zvonek se syntetizují přímo ve hře. Česká hlášení zastávek jsou z původní hry: syntetický hlas Piper 1.5.0 [url=https://huggingface.co/rhasspy/piper-voices/blob/2f358b6a560e3a913ebf509b2f3344f20b367f94/cs/cs_CZ/jirka/medium/MODEL_CARD]cs_CZ-jirka-medium[/url] (česká data Jirka CC0, základ hlasu Cori Samuel z [url=https://www.openslr.org/109/]Hi-Fi TTS[/url], CC BY 4.0), texty z jízdních řádů PMDP (CC BY 4.0); podrobnosti v data/zvuk/zdroje.txt.

Data převádí nástroj tools/godot/export_svet.mjs z původní webové hry Plzeň naplno; skutečné jsou půdorysy a výšky budov, tvar terénu, průběh ulic, linky a zastávky MHD, názvy ulic, podniků a adresy. Barvy a okna domů jsou stylizované, provoz a chodci jsou simulovaní."""
