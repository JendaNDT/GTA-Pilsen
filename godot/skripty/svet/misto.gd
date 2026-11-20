@tool
class_name Misto
extends UpravitelnyBod
## Místo k objevení (památka). Hráč ho objeví, když se přiblíží na `dosah` metrů,
## a dostane odměnu (stejně jako v předloze: 75 m, 150 Kč). V editoru slouží i jako záložka:
## v panelu Plzeň stačí místo vybrat a v 3D pohledu stisknout F.

@export_multiline var popis := ""
@export var dosah := 75.0
@export var odmena := 150


func _ready() -> void:
	if Engine.is_editor_hint():
		var znacka := Label3D.new()
		znacka.text = "★ " + nazev
		znacka.font_size = 64
		znacka.pixel_size = 0.03
		znacka.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		znacka.no_depth_test = true
		znacka.modulate = Color(1.0, 0.8, 0.2)
		znacka.position.y = 25.0
		add_child(znacka)
