class_name KameraHrace
extends Node3D
## Kamera ze třetí osoby. Otáčí se tahem myši (se stisknutým tlačítkem), kolečkem se přibližuje,
## na dotykové obrazovce tahem prstu v pravé části. Za autem se sama natáčí do směru jízdy.
## Klávesa C přepíná vzdálenost.

@export var cil: Node3D
@export var citlivost := 0.005

var yaw := 2.4          ## směr pohledu (rad), 0 = k jihu (+Z)
var pitch := 0.3
var vzdalenost := 6.0
var rezim := 0
var _necinnost := 9.0
var _rameno: SpringArm3D
var _kamera: Camera3D

const VZDALENOSTI := [6.0, 10.0, 3.2]


func _ready() -> void:
	_rameno = SpringArm3D.new()
	_rameno.spring_length = vzdalenost
	_rameno.margin = 0.3
	var koule := SphereShape3D.new()
	koule.radius = 0.25
	_rameno.shape = koule
	add_child(_rameno)
	_kamera = Camera3D.new()
	_kamera.name = "Kamera"
	_kamera.fov = 62.0
	_kamera.near = 0.3
	_kamera.far = 2600.0
	_kamera.current = true
	_rameno.add_child(_kamera)


func kamera() -> Camera3D:
	return _kamera


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and (event.button_mask & (MOUSE_BUTTON_MASK_LEFT | MOUSE_BUTTON_MASK_RIGHT) or Input.mouse_mode == Input.MOUSE_MODE_CAPTURED):
		yaw -= event.relative.x * citlivost
		pitch = clampf(pitch + event.relative.y * citlivost, -0.35, 1.35)
		_necinnost = 0.0
	elif event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			vzdalenost = maxf(2.5, vzdalenost * 0.9)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			vzdalenost = minf(30.0, vzdalenost * 1.1)
	elif event.is_action_pressed("kamera"):
		rezim = (rezim + 1) % VZDALENOSTI.size()
		vzdalenost = VZDALENOSTI[rezim]


func _process(delta: float) -> void:
	if cil == null:
		return
	if Vstup.dotyk_kamera != Vector2.ZERO:
		yaw -= Vstup.dotyk_kamera.x * citlivost * 1.4
		pitch = clampf(pitch + Vstup.dotyk_kamera.y * citlivost * 1.4, -0.35, 1.35)
		Vstup.dotyk_kamera = Vector2.ZERO
		_necinnost = 0.0
	_necinnost += delta
	var auto := cil as Auto
	var vuz := cil.get_parent() as VuzMhd
	var vyska := 1.6
	if vuz:
		vyska = 4.2
		if _necinnost > 1.5:
			var smer_vozu := atan2(cil.global_basis.z.x, cil.global_basis.z.z)
			yaw = lerp_angle(yaw, smer_vozu, minf(1.0, delta * 1.5))
			pitch = lerpf(pitch, 0.32, minf(1.0, delta * 1.5))
	if auto:
		vyska = 1.9
		# po chvíli bez zásahu se kamera vrátí za auto
		var v := auto.linear_velocity
		if _necinnost > 1.5 and Vector2(v.x, v.z).length() > 2.0:
			var smer := atan2(auto.global_basis.z.x, auto.global_basis.z.z)
			if auto.rychlost() < -0.5:
				smer += PI
			yaw = lerp_angle(yaw, smer, minf(1.0, delta * 2.2))
			pitch = lerpf(pitch, 0.22, minf(1.0, delta * 1.5))
	var bod := cil.global_position + Vector3(0, vyska, 0)
	global_position = global_position.lerp(bod, minf(1.0, delta * 14.0)) if global_position.distance_to(bod) < 20.0 else bod
	var mira := vzdalenost * (1.35 if auto else (2.6 if vuz else 1.0))
	_rameno.spring_length = lerpf(_rameno.spring_length, mira, minf(1.0, delta * 5.0))
	# rameno míří za cíl: otočení podle yaw, sklon podle pitch
	rotation = Vector3(-pitch, yaw + PI, 0)
	_rameno.rotation = Vector3.ZERO
	if auto:
		_rameno.add_excluded_object(auto.get_rid())
