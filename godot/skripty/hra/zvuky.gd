class_name Zvuky
extends Node3D
## Zvuky hry. Motory, rotor, klakson, náraz a zvonek se syntetizují při startu do krátkých smyček
## (podobně jako sound-design.js v předloze), výška tónu se mění s rychlostí. Prostorový zvuk zní
## od svého vozidla. Hlášení zastávek jsou nahrávky z předlohy (data/zvuk, hlas Piper).

const VZORKOVANI := 22050
## Motory: základní tón (Hz), nárůst s výkonem a hlasitost (VEHICLES v sound-design.js).
const MOTORY := {
	"car": {"vlna": "pila", "ton": 35.0, "narust": 105.0, "uroven": 0.5, "sum": 0.5},
	"bus": {"vlna": "pila", "ton": 29.0, "narust": 67.0, "uroven": 0.7, "sum": 0.6},
	"tram": {"vlna": "trojuhelnik", "ton": 79.0, "narust": 185.0, "uroven": 0.6, "sum": 0.9},
	"trolleybus": {"vlna": "trojuhelnik", "ton": 92.0, "narust": 190.0, "uroven": 0.55, "sum": 0.5},
}

var hra: Hra
var _smycky := {}
var _efekty := {}
var _hlasky := {}           ## název zastávky -> [soubor, začátek, délka]
var _hlasky_proudy := {}
var _hlas: AudioStreamPlayer
var _hlas_konec := 0.0
var _hrac_motor: AudioStreamPlayer3D
var _klakson: AudioStreamPlayer3D
var _nahoda := RandomNumberGenerator.new()


func _ready() -> void:
	_nahoda.seed = 291437
	for druh: String in MOTORY:
		_smycky[druh] = _motor(MOTORY[druh])
	_smycky["rotor"] = _rotor()
	_efekty["klakson"] = _klakson_zvuk()
	_efekty["naraz"] = _naraz_zvuk()
	_efekty["zvonek"] = _zvonek()
	var text := FileAccess.get_file_as_string("res://data/zvuk/stops.json")
	if not text.is_empty():
		_hlasky = (JSON.parse_string(text) as Dictionary).get("clips", {})
	_hlas = AudioStreamPlayer.new()
	_hlas.volume_db = -2.0
	add_child(_hlas)
	_hrac_motor = AudioStreamPlayer3D.new()
	_hrac_motor.unit_size = 8.0
	_hrac_motor.max_distance = 120.0
	add_child(_hrac_motor)
	_klakson = AudioStreamPlayer3D.new()
	_klakson.stream = _efekty.klakson
	_klakson.unit_size = 20.0
	_klakson.max_distance = 150.0
	add_child(_klakson)


static func _wav(vzorky: PackedFloat32Array, smycka: bool) -> AudioStreamWAV:
	var data := PackedByteArray()
	data.resize(vzorky.size() * 2)
	for i in vzorky.size():
		data.encode_s16(i * 2, int(clampf(vzorky[i], -1.0, 1.0) * 32000.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = VZORKOVANI
	w.stereo = false
	w.data = data
	if smycka:
		w.loop_mode = AudioStreamWAV.LOOP_FORWARD
		w.loop_begin = 0
		w.loop_end = vzorky.size()
	return w


func _sum() -> float:
	return _nahoda.randf() * 2.0 - 1.0


## Smyčka motoru: 1 s s celým počtem period základního tónu, harmonické a filtrovaný šum.
func _motor(m: Dictionary) -> AudioStreamWAV:
	var n := VZORKOVANI
	var v := PackedFloat32Array()
	v.resize(n)
	var f: float = m.ton
	var sum := 0.0
	for i in n:
		var t := float(i) / VZORKOVANI
		var faze := fmod(t * f, 1.0)
		var vlna := (faze * 2.0 - 1.0) if m.vlna == "pila" else (1.0 - 4.0 * absf(faze - 0.5))
		var vlna2 := sin(TAU * f * 2.0 * t) * 0.35 + sin(TAU * f * 3.0 * t) * 0.15
		sum = sum * 0.9 + _sum() * 0.1
		v[i] = (vlna * 0.55 + vlna2 + sum * float(m.sum)) * float(m.uroven)
	return _wav(v, true)


## Rotor vrtulníku: údery listů 24× za sekundu (soundBuffers.rotor v předloze).
func _rotor() -> AudioStreamWAV:
	var n := VZORKOVANI * 2
	var v := PackedFloat32Array()
	v.resize(n)
	for i in n:
		var t := float(i) / VZORKOVANI
		var faze := fmod(t * 24.0, 1.0)
		var puls := exp(-faze * 11.0) * (1.0 - exp(-faze * 90.0))
		v[i] = (puls * (0.55 * sin(TAU * 78.0 * t) + _sum() * 0.35) + 0.12 * sin(TAU * 48.0 * t)) * 0.8
	return _wav(v, true)


func _klakson_zvuk() -> AudioStreamWAV:
	var n := int(VZORKOVANI * 0.6)
	var v := PackedFloat32Array()
	v.resize(n)
	for i in n:
		var t := float(i) / VZORKOVANI
		var obalka := minf(1.0, t * 40.0) * minf(1.0, (0.6 - t) * 20.0)
		v[i] = (signf(sin(TAU * 392.0 * t)) * 0.3 + signf(sin(TAU * 494.0 * t)) * 0.3) * obalka * 0.6
	return _wav(v, false)


func _naraz_zvuk() -> AudioStreamWAV:
	var n := int(VZORKOVANI * 0.8)
	var v := PackedFloat32Array()
	v.resize(n)
	var nizky := 0.0
	for i in n:
		var t := float(i) / VZORKOVANI
		nizky = nizky * 0.8 + _sum() * 0.2
		v[i] = (nizky * 2.0 + _sum() * 0.4 * exp(-t * 12.0) + sin(TAU * 60.0 * t) * exp(-t * 6.0)) * exp(-t * 4.0)
	return _wav(v, false)


func _zvonek() -> AudioStreamWAV:
	var n := int(VZORKOVANI * 1.2)
	var v := PackedFloat32Array()
	v.resize(n)
	for i in n:
		var t := float(i) / VZORKOVANI
		var uder := fmod(t, 0.3)
		v[i] = (sin(TAU * 1180.0 * t) * 0.5 + sin(TAU * 2360.0 * t) * 0.2) * exp(-uder * 14.0) * 0.6
	return _wav(v, false)


## Přehraje efekt v bodě (náraz, zvonek, klakson).
func efekt(nazev: String, kde: Vector3, sila := 1.0) -> void:
	if not _efekty.has(nazev):
		return
	var p := AudioStreamPlayer3D.new()
	p.stream = _efekty[nazev]
	p.volume_db = linear_to_db(clampf(sila, 0.05, 1.0))
	p.unit_size = 15.0
	p.max_distance = 100.0
	add_child(p)
	p.global_position = kde
	p.play()
	p.finished.connect(p.queue_free)


## Smyčka motoru připojená k uzlu vozidla (vrací přehrávač pro řízení výšky tónu).
func motor_pro(uzel: Node3D, druh: String, hlasitost_db := -6.0) -> AudioStreamPlayer3D:
	var p := AudioStreamPlayer3D.new()
	p.stream = _smycky.get(druh, _smycky.car)
	p.volume_db = hlasitost_db
	p.unit_size = 6.0
	p.max_distance = 90.0
	p.name = "Motor"
	uzel.add_child(p)
	p.play(_nahoda.randf() * 0.9)
	return p


## Výška tónu motoru podle výkonu (0–1): tón + nárůst × výkon (vehicleState v předloze).
static func ladeni(druh: String, vykon: float) -> float:
	var m: Dictionary = MOTORY.get(druh, MOTORY.car)
	return (float(m.ton) + float(m.narust) * clampf(vykon, 0.0, 1.0)) / float(m.ton)


## Název zastávky hlasem (pokud pro ni existuje nahrávka).
func ohlas(zastavka: String) -> bool:
	if not _hlasky.has(zastavka):
		return false
	var k: Array = _hlasky[zastavka]
	var soubor: String = k[0]
	if not _hlasky_proudy.has(soubor):
		_hlasky_proudy[soubor] = load("res://data/zvuk/" + soubor)
	_hlas.stream = _hlasky_proudy[soubor]
	_hlas.play(float(k[1]))
	_hlas_konec = float(k[2])
	return true


func _process(delta: float) -> void:
	if _hlas_konec > 0.0:
		_hlas_konec -= delta
		if _hlas_konec <= 0.0:
			_hlas.stop()
	if hra == null:
		return
	# motor hráčova auta nebo rotor vrtulníku
	var cil: Node3D = null
	var stream: AudioStream = null
	var ton := 1.0
	if hra.rezim == "auto" and hra.auto_hrace:
		cil = hra.auto_hrace
		stream = _smycky.car
		var vykon := maxf(absf(hra.auto_hrace.plyn), hra.auto_hrace.rychlost_kmh() / 120.0)
		ton = ladeni("car", vykon) if hra.auto_hrace.poskozeni < 100.0 else 0.0
	elif hra.rezim == "vrtulnik" and hra.vrtulnik:
		cil = hra.vrtulnik
		stream = _smycky.rotor
		ton = 0.4 + hra.vrtulnik.rotor / 26.0 * 0.6
	if cil and ton > 0.0:
		if _hrac_motor.stream != stream:
			_hrac_motor.stream = stream
			_hrac_motor.play()
		_hrac_motor.global_position = cil.global_position
		_hrac_motor.pitch_scale = ton
		if not _hrac_motor.playing:
			_hrac_motor.play()
	elif _hrac_motor.playing:
		_hrac_motor.stop()
	if Input.is_action_just_pressed("klakson") and hra.rezim == "auto" and hra.auto_hrace:
		_klakson.global_position = hra.auto_hrace.global_position
		_klakson.play()
