class_name Vrtulnik
extends RigidBody3D
## Vrtulník (letový model převedený ze src/physics/heli.js). Tah působí podél svislé osy stroje,
## asistent drží výšku a náklon, ližiny mají pružiny s tlumiči a dosednou i na střechu.
## Ovládání: W/S náklon vpřed/vzad, A/D otáčení, Mezerník stoupání, Shift klesání.

const HMOTNOST := 2500.0
const G := 9.81
const MAX_RYCHLOST := 300.0 / 3.6
const NAKLON := 0.51
const ODPOR_VPRED := G * 0.5596 / (MAX_RYCHLOST * MAX_RYCHLOST)   ## tan(0,51) = 0,5596
const LIZINY := [Vector2(-0.95, -1.4), Vector2(-0.95, 2.0), Vector2(0.95, -1.4), Vector2(0.95, 2.0)]

var obsazeny := false
var asistent := true
var rotor := 0.0               ## otáčky rotoru (rad/s), plný tah od 26
var pristany := true
var naraz := 0.0
var _drz_vysku := 0.0
var _vrtule: Node3D
var _ocasni: Node3D


func _ready() -> void:
	mass = HMOTNOST
	angular_damp = 0.12
	linear_damp = 0.0
	continuous_cd = true
	can_sleep = false
	gravity_scale = 1.0
	center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	center_of_mass = Vector3(0, 1.1, 0.2)
	for t: Array in [[Vector3(0, 1.35, 0.3), Vector3(0.85, 0.7, 1.8)], [Vector3(0, 1.9, -3.4), Vector3(0.15, 0.17, 2.1)],
			[Vector3(-0.95, 0.1, 0.3), Vector3(0.05, 0.05, 1.7)], [Vector3(0.95, 0.1, 0.3), Vector3(0.05, 0.05, 1.7)]]:
		var cs := CollisionShape3D.new()
		var b := BoxShape3D.new()
		b.size = t[1] * 2.0
		cs.shape = b
		cs.position = t[0]
		add_child(cs)
	_postav_model()
	_drz_vysku = global_position.y


func _mat(c: Color, drsnost := 0.4) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = drsnost
	return m


func _box(rodic: Node3D, s: Vector3, p: Vector3, m: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = s
	b.material = m
	mi.mesh = b
	mi.position = p
	rodic.add_child(mi)
	return mi


## Vzhled podle makeHeliMesh v předloze (bílý trup, okrový pruh, prosklená kabina, ližiny).
func _postav_model() -> void:
	var bila := _mat(Color(0.945, 0.945, 0.933), 0.3)
	var okrova := _mat(Color(0.949, 0.714, 0.196), 0.35)
	var tmava := _mat(Color(0.133, 0.149, 0.169), 0.7)
	var sklo := _mat(Color(0.19, 0.27, 0.32), 0.08)
	_box(self, Vector3(1.7, 1.5, 3.6), Vector3(0, 1.45, 0.3), bila)
	_box(self, Vector3(1.5, 0.9, 1.5), Vector3(0, 1.55, 1.75), sklo)
	_box(self, Vector3(1.72, 0.3, 3.0), Vector3(0, 1.0, 0.2), okrova)
	_box(self, Vector3(0.3, 0.34, 4.2), Vector3(0, 1.9, -3.4), bila)
	_box(self, Vector3(0.1, 1.2, 0.7), Vector3(0, 2.5, -5.3), okrova)
	_box(self, Vector3(0.5, 0.35, 0.9), Vector3(0, 2.35, 0.1), tmava)
	for sx in [-1.0, 1.0]:
		_box(self, Vector3(0.1, 0.1, 3.4), Vector3(sx * 0.95, 0.12, 0.3), tmava)
		_box(self, Vector3(0.07, 0.7, 0.07), Vector3(sx * 0.9, 0.5, 1.2), tmava)
		_box(self, Vector3(0.07, 0.7, 0.07), Vector3(sx * 0.9, 0.5, -0.6), tmava)
	_vrtule = Node3D.new()
	_vrtule.position = Vector3(0, 2.6, 0.1)
	add_child(_vrtule)
	_box(_vrtule, Vector3(0.24, 0.05, 10.4), Vector3.ZERO, tmava)
	_box(_vrtule, Vector3(10.4, 0.05, 0.24), Vector3.ZERO, tmava)
	_ocasni = Node3D.new()
	_ocasni.position = Vector3(0.12, 2.5, -5.3)
	add_child(_ocasni)
	_box(_ocasni, Vector3(0.04, 1.6, 0.14), Vector3.ZERO, tmava)


## Euleruv úhel kolem svislé osy (směr letu), náklon vpřed a do strany (pořadí YXZ jako v předloze).
func uhly() -> Vector3:
	return global_basis.get_euler(EULER_ORDER_YXZ)


func rychlost_kmh() -> float:
	return linear_velocity.length() * 3.6


func vyska_nad_terenem() -> float:
	return global_position.y - Mapa.vyska(global_position.x, global_position.z)


## Pružiny ližin: paprsek z každého konce ližiny dolů na jakýkoli pevný povrch (i střechu).
func _liziny() -> float:
	var prostor := get_world_3d().direct_space_state
	var vule := INF
	var kontaktu := 0
	for k: Vector2 in LIZINY:
		var bod := global_transform * Vector3(k.x, 0.05, k.y)
		var dotaz := PhysicsRayQueryParameters3D.create(bod + Vector3(0, 0.4, 0), bod + Vector3(0, -8.0, 0), Hra.VRSTVA_SVET)
		dotaz.exclude = [get_rid()]
		var hit := prostor.intersect_ray(dotaz)
		if hit.is_empty():
			continue
		var vyska: float = bod.y - (hit.position as Vector3).y
		vule = minf(vule, vyska)
		if vyska > 0.15:
			continue
		kontaktu += 1
		var vy := (linear_velocity + angular_velocity.cross(bod - global_transform * center_of_mass)).y
		var sila := clampf((0.15 - vyska) * 61500.0 - vy * 8600.0, 0.0, HMOTNOST * G * 1.5)
		apply_force(Vector3(0, sila, 0), bod - global_position)
		if vy < -5.0:
			naraz = maxf(naraz, -vy)
	pristany = kontaktu >= 2 and absf(linear_velocity.y) < 1.0
	return vule


func _physics_process(delta: float) -> void:
	var vpred := 0.0
	var otoceni := 0.0
	var stoupani := 0.0
	if obsazeny:
		var p := Vstup.pohyb()
		vpred = p.y
		otoceni = p.x
		stoupani = (1.0 if Vstup.brzda() else 0.0) - (1.0 if Vstup.beh() else 0.0)
	rotor = move_toward(rotor, 26.0 if obsazeny else 0.0, delta * (6.0 if obsazeny else 3.0))
	_vrtule.rotate_y(rotor * delta)
	_ocasni.rotate_x(rotor * delta * 1.6)
	var vule := _liziny()
	var vykon := clampf((rotor - 10.0) / 16.0, 0.0, 1.0)
	var u := uhly()
	var yaw := u.y
	var pitch := u.x
	var roll := u.z
	var v := linear_velocity
	if not obsazeny:
		stoupani = -1.0
	if stoupani != 0.0 or not asistent:
		_drz_vysku = global_position.y
	var vz := stoupani * (8.0 if stoupani > 0.0 else 4.0) if stoupani != 0.0 else clampf((_drz_vysku - global_position.y) * 1.8, -5.0, 5.0)
	var svisle := (vz - v.y) * 2.5 if asistent else stoupani * 5.0
	var prizemni := 1.0 + 0.12 * clampf(1.0 - vule / 8.0, 0.0, 1.0)
	var nahoru := global_basis.y
	var tah := (G + svisle) / (maxf(0.55, nahoru.y) * prizemni if asistent else 1.0)
	if not obsazeny or (pristany and stoupani <= 0.0 and _drz_vysku <= global_position.y + 0.2):
		tah = 0.0
	var strop := Mapa.vyska(global_position.x, global_position.z) + 600.0
	if global_position.y >= strop:
		tah = minf(tah, G - maxf(0.0, v.y))
	tah = clampf(tah * prizemni * vykon, 0.0, 1.3 * G)
	var s := sin(yaw)
	var c := cos(yaw)
	var rychlost_vpred := maxf(0.0, v.x * s + v.z * c)
	var odpor := 3.0 if pristany else 0.14
	var cestovni := 0.0 if pristany else clampf(2.0 * pitch / NAKLON - 1.0, 0.0, 1.0)
	var korekce := cestovni * rychlost_vpred * (odpor - ODPOR_VPRED * rychlost_vpred)
	apply_central_force(Vector3(HMOTNOST * (tah * nahoru.x - v.x * odpor + s * korekce), HMOTNOST * tah * nahoru.y,
		HMOTNOST * (tah * nahoru.z - v.z * odpor + c * korekce)))
	var w := angular_velocity
	var rychlost_kloneni := c * w.x - s * w.z
	var rychlost_naklonu := s * w.x + c * w.z
	var cil_kloneni := (vpred * NAKLON - pitch) * 5.0 if asistent else vpred * 0.9
	# otoceni = vstup doprava (+1), jako turn v předloze
	var cil_naklonu := (-otoceni * minf(0.22, v.length() * 0.018) - roll) * 5.0 if asistent else 0.0
	var moment_k := (cil_kloneni - rychlost_kloneni) * 16500.0 * vykon
	var moment_n := (cil_naklonu - rychlost_naklonu) * 4300.0 * vykon
	apply_torque(Vector3(moment_k * c + moment_n * s, (-otoceni * 1.5 - w.y) * 12500.0 * vykon, -moment_k * s + moment_n * c))
