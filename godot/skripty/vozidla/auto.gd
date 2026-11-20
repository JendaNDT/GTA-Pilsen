class_name Auto
extends VehicleBody3D
## Osobní auto. Rozměry a jízdní vlastnosti podle CAR_TYPES a vehicleSpec v předloze
## (src/entities/models.js, src/physics/vehicle.js). Vpřed je +Z, vlevo +X.

const TYPY := {
	"hatch": {"nazev": "Malé auto", "len": 3.9, "wid": 1.7, "h": 1.45, "hood": 0.9, "max": 40.0, "accel": 6.2, "mass": 1.0},
	"sedan": {"nazev": "Sedan", "len": 4.6, "wid": 1.8, "h": 1.42, "hood": 1.15, "max": 46.0, "accel": 6.8, "mass": 1.2},
	"kombi": {"nazev": "Kombi", "len": 4.7, "wid": 1.8, "h": 1.48, "hood": 1.15, "max": 44.0, "accel": 6.4, "mass": 1.25},
	"suv": {"nazev": "SUV", "len": 4.6, "wid": 1.92, "h": 1.72, "hood": 1.1, "max": 44.0, "accel": 6.2, "mass": 1.6},
	"van": {"nazev": "Dodávka", "len": 5.3, "wid": 2.0, "h": 2.25, "hood": 0.7, "max": 36.0, "accel": 4.6, "mass": 2.0},
	"sport": {"nazev": "Sporťák", "len": 4.35, "wid": 1.86, "h": 1.22, "hood": 1.3, "max": 68.0, "accel": 10.5, "mass": 1.1},
	"taxi": {"nazev": "Taxi", "len": 4.6, "wid": 1.8, "h": 1.42, "hood": 1.15, "max": 46.0, "accel": 6.8, "mass": 1.2},
	"policie": {"nazev": "Policejní vůz", "len": 4.7, "wid": 1.8, "h": 1.48, "hood": 1.15, "max": 58.0, "accel": 9.5, "mass": 1.25},
}
const BARVY := [0xd9dadb, 0x9da3a8, 0x2b2e33, 0x1f3a5f, 0x8f1d1d, 0xb8b0a0, 0x3d6b4f, 0x5b7fa6, 0xc8922e, 0x6b4a2f, 0xf2f2ef, 0x4a4d52]

@export var typ := "hatch"
@export var barva := Color(0.56, 0.11, 0.11)
## Řídí hráč (čte vstup). Jinak auto stojí nebo ho řídí doprava.
@export var ridi_hrac := false

var plyn := 0.0
var zatoceni := 0.0
var rucni := false
var poskozeni := 0.0
var _kola: Array[VehicleWheel3D] = []
var _spec := {}
var _zpatecka := false
var _zatoceni_hladke := 0.0


func _ready() -> void:
	_spec = TYPY.get(typ, TYPY.hatch)
	mass = 1200.0 * _spec.mass
	center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	center_of_mass = Vector3(0, 0.35, 0.1)
	angular_damp = 0.4
	continuous_cd = true
	can_sleep = true
	contact_monitor = true
	max_contacts_reported = 4
	var L: float = _spec.len
	var W: float = _spec.wid
	var H: float = _spec.h
	var tvar := BoxShape3D.new()
	tvar.size = Vector3(W, H * 0.62, L)
	var cs := CollisionShape3D.new()
	cs.shape = tvar
	cs.position.y = 0.32 + H * 0.31
	add_child(cs)
	var kabina := BoxShape3D.new()
	kabina.size = Vector3(W * 0.86, H * 0.36, L * 0.5)
	var cs2 := CollisionShape3D.new()
	cs2.shape = kabina
	cs2.position = Vector3(0, 0.32 + H * 0.62 + H * 0.17, -L * 0.04)
	add_child(cs2)
	add_child(ModelAuta.karoserie(_spec, barva, typ))
	var polomer := 0.39 if typ == "suv" else (0.36 if typ == "van" else 0.31)
	var rozvor := L * 0.64
	var rozchod := W * 0.84
	for i in 4:
		var k := VehicleWheel3D.new()
		var predni := i < 2
		k.position = Vector3((1 if i % 2 == 0 else -1) * rozchod / 2.0, polomer + 0.06, (1 if predni else -1) * rozvor / 2.0)
		k.wheel_radius = polomer
		k.wheel_rest_length = 0.16
		k.suspension_travel = 0.22
		k.suspension_stiffness = 42.0
		k.suspension_max_force = 18000.0 * _spec.mass
		k.damping_compression = 0.9
		k.damping_relaxation = 1.1
		k.wheel_friction_slip = 2.6
		k.wheel_roll_influence = 0.12
		k.use_as_steering = predni
		k.use_as_traction = predni if typ != "sport" and typ != "van" else not predni
		k.add_child(ModelAuta.kolo(polomer))
		add_child(k)
		_kola.append(k)


func rychlost() -> float:
	return linear_velocity.dot(global_basis.z)


func rychlost_kmh() -> float:
	return absf(rychlost()) * 3.6


func _physics_process(delta: float) -> void:
	if ridi_hrac:
		var p := Vstup.pohyb()
		plyn = Vstup.plyn()
		zatoceni = -p.x
		rucni = Vstup.brzda()
	elif not freeze:
		plyn = 0.0
		zatoceni = 0.0
		rucni = true
	var v := rychlost()
	var vmax: float = _spec.max
	# automatická převodovka: dozadu jen ze zastavení
	if plyn < -0.05 and v < 0.6:
		_zpatecka = true
	elif plyn > 0.05 and v > -0.6:
		_zpatecka = false
	var tazna := 0
	for k in _kola:
		if k.use_as_traction:
			tazna += 1
	var sila := mass * float(_spec.accel) / maxi(1, tazna)
	var motor := 0.0
	var brzda := 0.0
	if _zpatecka:
		if plyn < 0.0:
			motor = plyn * sila * 0.55 * maxf(0.0, 1.0 - absf(v) / 9.0)
		elif plyn > 0.0:
			brzda = plyn
	else:
		if plyn > 0.0:
			motor = plyn * sila * maxf(0.0, 1.0 - pow(maxf(0.0, v) / vmax, 1.7))
		elif plyn < 0.0:
			brzda = -plyn
	if not ridi_hrac:
		brzda = 1.0
	# arkádové řízení: menší rejd ve vyšší rychlosti
	var rejd := 0.62 / (1.0 + absf(v) / 14.0)
	_zatoceni_hladke = move_toward(_zatoceni_hladke, zatoceni * rejd, delta * 2.4)
	for k in _kola:
		k.engine_force = motor if k.use_as_traction else 0.0
		var predni := k.use_as_steering
		k.brake = brzda * mass * (0.0105 if predni else 0.0075)
		if rucni and not predni:
			k.brake = mass * 0.02
		k.steering = _zatoceni_hladke if predni else 0.0
	# mírný odpor vzduchu a valení
	if linear_velocity.length() > 0.5:
		apply_central_force(-linear_velocity * linear_velocity.length() * 0.35)


## Místo vedle levých předních dveří (pro výstup) ve světových souřadnicích.
func misto_vystupu() -> Vector3:
	var W: float = _spec.wid
	return global_transform * Vector3(W / 2.0 + 0.8, 0.1, 0.4)


## Vrátí auto na kola na nejbližší místě (klávesa R).
func vrat_na_kola() -> void:
	var p := global_position
	var smer := global_basis.z
	smer.y = 0
	if smer.length() < 0.1:
		smer = Vector3.FORWARD
	var y := Mapa.vyska(p.x, p.z) + 0.6
	global_transform = Transform3D(Basis.looking_at(-smer.normalized(), Vector3.UP), Vector3(p.x, maxf(p.y, y), p.z))
	linear_velocity = Vector3.ZERO
	angular_velocity = Vector3.ZERO
