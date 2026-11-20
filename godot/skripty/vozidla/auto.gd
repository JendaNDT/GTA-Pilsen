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

signal naraz(sila: float, telo: Node)

## Herní den (pro ranní opravu ulomených zařízení), nastavuje Hra.
static var herni_den := 0
## Přilnavost povrchu podle počasí (1 = sucho, 0,7 mokro, 0,35 sníh), nastavuje Hra.
static var prilnavost := 1.0

## Vylepšení z garáže: "brzdy" (silnější brzdy), "pneu" (lepší pneumatiky).
var vylepseni := {}
## Dálková světla hráčova auta (klávesa L).
static var dalkova := false
var _reflektor: SpotLight3D
var v_vode := 0.0                   ## jak dlouho je auto ve vodě (s)
var potopene := false
var _brzdova: StandardMaterial3D

var plyn := 0.0
var zatoceni := 0.0
var rucni := false
var poskozeni := 0.0               ## 0–100 %; při 100 je auto nepojízdné
var _minula := Vector3.ZERO
var _naraz_dv := 0.0                ## změna rychlosti během probíhajícího nárazu
var _naraz_cas := 0.0
var _neprirazeno := 0.0
var _kour: CPUParticles3D
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
	body_entered.connect(_dotyk)
	_kour = CPUParticles3D.new()
	_kour.emitting = false
	_kour.amount = 24
	_kour.lifetime = 1.6
	_kour.direction = Vector3.UP
	_kour.initial_velocity_min = 1.0
	_kour.initial_velocity_max = 2.0
	_kour.gravity = Vector3(0, 0.6, 0)
	_kour.scale_amount_min = 0.4
	_kour.scale_amount_max = 1.0
	var koule := SphereMesh.new()
	koule.radius = 0.3
	koule.height = 0.6
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.2, 0.2, 0.2, 0.5)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	koule.material = m
	_kour.mesh = koule
	_kour.position = Vector3(0, H * 0.6, L * 0.38)
	add_child(_kour)
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
	_hlidej_naraz()
	if _voda(delta):
		plyn = 0.0
		zatoceni = 0.0
	var v := rychlost()
	var vmax: float = _spec.max
	# automatická převodovka: dozadu jen ze zastavení
	# (jede-li auto znatelně dopředu, brzda brzdí i po předchozím couvání)
	if plyn < -0.05 and v < 0.6:
		_zpatecka = true
	elif (plyn > 0.05 and v > -0.6) or v > 1.5:
		_zpatecka = false
	var tazna := 0
	for k in _kola:
		if k.use_as_traction:
			tazna += 1
	# poškozený motor má menší výkon, při 100 % auto nejede
	var vykon := 0.0 if poskozeni >= 100.0 else 1.0 - poskozeni / 100.0 * 0.7
	var sila := mass * float(_spec.accel) / maxi(1, tazna) * vykon
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
	# brzdy z garáže 21/16 síly, pneumatiky +25 % přilnavosti (vehicles.js v předloze)
	var sila_brzd := prilnavost * (21.0 / 16.0 if vylepseni.get("brzdy", false) else 1.0)
	var treni := 2.6 * prilnavost * (1.25 if vylepseni.get("pneu", false) else 1.0)
	for k in _kola:
		k.engine_force = motor if k.use_as_traction else 0.0
		k.wheel_friction_slip = treni
		var predni := k.use_as_steering
		# brzda je impuls za krok fyziky: plné brzdění ≈ 10 m/s² na suchu (předloha 16 m/s²)
		k.brake = brzda * mass * (0.048 if predni else 0.035) * sila_brzd
		if rucni and not predni:
			k.brake = mass * 0.04 * prilnavost
		k.steering = _zatoceni_hladke if predni else 0.0
	# mírný odpor vzduchu a valení
	if linear_velocity.length() > 0.5:
		apply_central_force(-linear_velocity * linear_velocity.length() * 0.35)
	if ridi_hrac or _reflektor:
		_svetla_hrace(ridi_hrac and (brzda > 0.05 or rucni))


## Auto ve vodě (Water.step v předloze): vztlak nejdřív auto nese, po 2 s nabírá vodu a po 6 s
## jde ke dnu. Motor ve vodě nejede. Vrací true, když je auto ve vodě.
func _voda(delta: float) -> bool:
	var p := global_position
	var hl := Mapa.hloubka(p.x, p.z)
	var hladina := Mapa.vyska(p.x, p.z)
	var vyska_auta: float = _spec.h
	if hl < 0.15 or p.y > hladina + 0.2:
		v_vode = 0.0
		return false
	v_vode += delta
	var vztlak := maxf(0.18, 1.95 - maxf(0.0, v_vode - 2.0) * 0.24)
	# ponořená část karoserie (spodek 0,3 m nad počátkem auta)
	var ponor := clampf((hladina - (p.y + 0.3)) / (vyska_auta - 0.3), 0.0, 1.0)
	apply_central_force(Vector3.UP * mass * 9.81 * vztlak * ponor)
	linear_velocity *= 1.0 - minf(1.0, 0.65 * delta * ponor)
	angular_velocity *= 1.0 - minf(1.0, 0.8 * delta * ponor)
	if v_vode >= 6.0 and p.y + vyska_auta < hladina - 0.02:
		potopene = true
	return true


## Reflektor a brzdová světla auta, které řídí hráč (v noci, dálková klávesou L).
func _svetla_hrace(brzdi: bool) -> void:
	var noc := ModelAuta.mat_predni != null and ModelAuta.mat_predni.emission_energy_multiplier > 1.0
	var sviti := ridi_hrac and noc and poskozeni < 100.0
	if sviti and _reflektor == null:
		_reflektor = SpotLight3D.new()
		_reflektor.name = "Reflektor"
		_reflektor.position = Vector3(0, 0.75, float(_spec.len) / 2.0 + 0.1)
		_reflektor.rotation.y = PI
		_reflektor.rotation.x = -0.05
		_reflektor.light_color = Color(1.0, 0.95, 0.85)
		_reflektor.shadow_enabled = false
		add_child(_reflektor)
	if _reflektor:
		_reflektor.visible = sviti
		_reflektor.spot_range = 95.0 if dalkova else 45.0
		_reflektor.spot_angle = 22.0 if dalkova else 32.0
		_reflektor.light_energy = 3.2 if dalkova else 2.2
	if not ridi_hrac:
		return
	if _brzdova == null:
		_brzdova = ModelAuta.mat_zadni.duplicate()
		for jmeno in ["Model/Koncove1", "Model/Koncove-1"]:
			var mi := get_node_or_null(jmeno) as MeshInstance3D
			if mi:
				mi.material_override = _brzdova
	_brzdova.emission_energy_multiplier = 3.0 if brzdi else ModelAuta.mat_zadni.emission_energy_multiplier


## Náraz: prudká změna rychlosti při dotyku s jiným tělesem zvýší poškození.
func _hlidej_naraz() -> void:
	var dv := (linear_velocity - _minula).length()
	_minula = linear_velocity
	var dt := get_physics_process_delta_time()
	# běžná jízda a brzdění mění rychlost nejvýš o 0,2 m/s za krok; víc znamená dotyk s překážkou
	# během probíhajícího nárazu se počítají i menší změny (tlačení do překážky)
	if get_contact_count() > 0 and (dv > 1.0 or (_naraz_cas > 0.0 and dv > 0.25)):
		# jeden náraz se rozloží do několika kroků fyziky – sečte se celá změna rychlosti
		# (hlášení dotyku přichází o krok později, proto se přičte i předchozí krok)
		_naraz_dv += dv + _neprirazeno
		_neprirazeno = 0.0
		_naraz_cas = 0.3
		return
	_neprirazeno = dv if dv > 1.0 else 0.0
	if _naraz_cas > 0.0:
		_naraz_cas -= dt
		if _naraz_cas <= 0.0:
			_vyhodnot_naraz(_naraz_dv)
			_naraz_dv = 0.0


## Poškození podle síly nárazu: 50 km/h do zdi asi 45 %, nad 100 km/h zničení.
func _vyhodnot_naraz(dv: float) -> void:
	poskozeni = minf(100.0, poskozeni + maxf(0.0, dv - 3.0) * 4.0)
	_kour.emitting = poskozeni >= 60.0
	var tmavsi := clampf(poskozeni / 100.0, 0.0, 1.0) * 0.45
	for jmeno in ["Model/Spodek", "Model/Kabina"]:
		var mi := get_node_or_null(jmeno) as MeshInstance3D
		if mi and mi.mesh:
			var mat := (mi.mesh as BoxMesh).material as StandardMaterial3D
			mat.albedo_color = barva.darkened(tmavsi)
	naraz.emit(dv, null)


## Dotyk s tělesem: ulomitelná zařízení se zlomí, ostatní nárazy hlásí signál naraz.
func _dotyk(telo: Node) -> void:
	if telo is Zlomitelny:
		if (telo as Zlomitelny).zasazen(_minula, herni_den):
			# zlomení stojí část rychlosti, auto jede dál
			linear_velocity = _minula * 0.85


func opravit() -> void:
	poskozeni = 0.0
	_kour.emitting = false
	for jmeno in ["Model/Spodek", "Model/Kabina"]:
		var mi := get_node_or_null(jmeno) as MeshInstance3D
		if mi and mi.mesh:
			((mi.mesh as BoxMesh).material as StandardMaterial3D).albedo_color = barva


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
