@tool
class_name Zastavka
extends UpravitelnyBod
## Stanoviště MHD (zastávkový sloupek). Polohu, natočení i název lze v editoru volně měnit,
## nový import je zachová (viz UpravitelnyBod). Číslo id je stanoviště v jízdním řádu PMDP (GTFS).

var _cedule: Label3D


func _ready() -> void:
	var sloup := MeshInstance3D.new()
	var c := CylinderMesh.new()
	c.top_radius = 0.04
	c.bottom_radius = 0.04
	c.height = 2.7
	c.radial_segments = 8
	var kov := StandardMaterial3D.new()
	kov.albedo_color = Color(0.32, 0.34, 0.36)
	kov.metallic = 0.6
	kov.roughness = 0.4
	c.material = kov
	sloup.mesh = c
	sloup.position.y = 1.35
	add_child(sloup)
	var tabule := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = Vector3(0.05, 0.42, 0.42)
	var zluta := StandardMaterial3D.new()
	zluta.albedo_color = Color(0.95, 0.78, 0.1)
	b.material = zluta
	tabule.mesh = b
	tabule.position = Vector3(0.0, 2.45, 0.0)
	add_child(tabule)
	var zz := Label3D.new()
	zz.text = "Z"
	zz.font_size = 64
	zz.pixel_size = 0.004
	zz.modulate = Color(0.75, 0.05, 0.05)
	zz.outline_size = 0
	zz.position = Vector3(0.03, 2.45, 0)
	zz.rotation.y = PI / 2.0
	zz.double_sided = true
	add_child(zz)
	_cedule = Label3D.new()
	_cedule.text = nazev
	_cedule.font_size = 40
	_cedule.pixel_size = 0.005
	_cedule.outline_size = 8
	_cedule.position = Vector3(0, 2.95, 0)
	_cedule.billboard = BaseMaterial3D.BILLBOARD_FIXED_Y
	_cedule.visibility_range_end = 60.0
	add_child(_cedule)


func _nazev_zmenen() -> void:
	if _cedule:
		_cedule.text = nazev
