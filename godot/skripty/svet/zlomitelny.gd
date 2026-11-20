class_name Zlomitelny
extends StaticBody3D
## Pevná překážka, kterou auto při nárazu ulomí (lampa, sloupek značky, semafor).
## Do ulomení stojí; po nárazu rychlejším než `pevnost` se změní v padající těleso.
## Ulomená zařízení si hra pamatuje do rána dalšího herního dne (oprava, jako v předloze).

signal ulomen(id: String)

## Seznam ulomených zařízení: id -> herní den ulomení.
static var ulomene := {}

@export var id := ""
@export var vyska := 7.0
@export var polomer := 0.12
@export var hmotnost := 80.0
## Rychlost nárazu (m/s), od které se zařízení ulomí.
@export var pevnost := 3.0

## Vizuál z MultiMesh, který se při ulomení skryje (instance), nebo vlastní uzel.
var multimesh: MultiMesh
var instance := -1
var vzhled: Mesh


func _ready() -> void:
	collision_layer = Hra.VRSTVA_SVET
	var cs := CollisionShape3D.new()
	var tvar := CylinderShape3D.new()
	tvar.radius = polomer
	tvar.height = vyska
	cs.shape = tvar
	cs.position.y = vyska / 2.0
	add_child(cs)


## Náraz tělesa s rychlostí v (m/s ve světě). Vrátí true, když se zařízení ulomilo.
func zasazen(v: Vector3, den := 0) -> bool:
	if v.length() < pevnost or not is_inside_tree():
		return false
	# ulomený sloup už nesmí auto zastavit
	collision_layer = 0
	for c in get_children():
		if c is CollisionShape3D:
			c.set_deferred("disabled", true)
	if multimesh and instance >= 0:
		multimesh.set_instance_transform(instance, Transform3D(Basis().scaled(Vector3.ZERO), global_position))
	var padajici := RigidBody3D.new()
	padajici.mass = hmotnost
	padajici.collision_layer = Hra.VRSTVA_VOZIDLA
	padajici.collision_mask = Hra.VRSTVA_SVET | Hra.VRSTVA_VOZIDLA
	var cs := CollisionShape3D.new()
	var tvar := CylinderShape3D.new()
	tvar.radius = polomer
	tvar.height = vyska
	cs.shape = tvar
	cs.position.y = vyska / 2.0
	padajici.add_child(cs)
	if vzhled:
		var mi := MeshInstance3D.new()
		mi.mesh = vzhled
		padajici.add_child(mi)
	get_parent().add_child(padajici)
	padajici.global_transform = global_transform
	var vlastni := get_node_or_null("Vzhled")
	if vlastni:
		vlastni.reparent(padajici, true)
	# sloup se překlopí ve směru nárazu
	var smer := Vector3(v.x, 0, v.z).normalized()
	padajici.apply_impulse(smer * hmotnost * minf(v.length(), 12.0) * 0.35, Vector3(0, vyska * 0.6, 0))
	ulomene[id] = den
	ulomen.emit(id)
	queue_free()
	return true


## Ranní oprava: zapomene zařízení ulomená v předchozích dnech.
static func oprav(den: int) -> void:
	for k: String in ulomene.keys():
		if ulomene[k] < den:
			ulomene.erase(k)
