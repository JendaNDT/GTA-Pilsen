class_name Chodec
extends CharacterBody3D
## Hráč pěšky. Rychlosti odpovídají předloze (src/entities/player.js): chůze 2,4 m/s,
## běh 6,4 m/s, plavání 1,7 m/s, otáčení až 12 rad/s.

const CHUZE := 2.4
const BEH := 6.4
const PLAVANI := 1.7
const SKOK := 4.6
const GRAVITACE := 9.81

## Směr pohledu kamery (rad); pohyb je vztažený k němu.
var smer_kamery := 0.0
var natoceni := 0.0
var aktivni := true
var plave := false
var _postava: Postava


func _ready() -> void:
	var tvar := CapsuleShape3D.new()
	tvar.radius = 0.3
	tvar.height = 1.75
	var cs := CollisionShape3D.new()
	cs.shape = tvar
	cs.position.y = 0.875
	add_child(cs)
	_postava = Postava.new()
	_postava.name = "Postava"
	add_child(_postava)
	floor_max_angle = deg_to_rad(50)
	floor_snap_length = 0.35
	safe_margin = 0.02


## Postaví hráče na zem v bodě (x, z); y = výška nad terénem, odkud se hledá povrch.
func postav_na(x: float, z: float, y := NAN) -> void:
	var zem := Mapa.vyska(x, z) + 0.05
	global_position = Vector3(x, zem if is_nan(y) else maxf(y, zem), z)
	velocity = Vector3.ZERO


func _physics_process(delta: float) -> void:
	if not aktivni:
		return
	var vstup := Vstup.pohyb()
	var dopredu := Vector3(sin(smer_kamery), 0, cos(smer_kamery))
	var doprava := Vector3(-cos(smer_kamery), 0, sin(smer_kamery))
	var smer := dopredu * vstup.y + doprava * vstup.x
	var zem := Mapa.vyska(global_position.x, global_position.z)
	plave = global_position.y < zem + 0.05 and _je_voda()
	var rychlost := PLAVANI if plave else (BEH if Vstup.beh() else CHUZE)
	var cil := Vector3.ZERO
	if smer.length() > 0.05:
		cil = smer.limit_length(1.0) * rychlost
		var chci := atan2(smer.x, smer.z)
		natoceni += clampf(wrapf(chci - natoceni, -PI, PI), -12.0 * delta, 12.0 * delta)
	var k := minf(1.0, delta * (12.0 if is_on_floor() else 2.5))
	velocity.x += (cil.x - velocity.x) * k
	velocity.z += (cil.z - velocity.z) * k
	if is_on_floor():
		if Vstup.brzda() and not plave:
			velocity.y = SKOK
	else:
		velocity.y -= GRAVITACE * delta
	move_and_slide()
	# pojistka: nikdy nespadnout pod terén (díra v kolizi, nenačtená dlaždice)
	var pod := Mapa.vyska(global_position.x, global_position.z)
	if global_position.y < pod - 2.0:
		global_position.y = pod + 0.1
		velocity.y = 0.0
	_postava.rotation.y = natoceni
	_postava.position.y = -1.05 if plave else 0.0
	_postava.animuj(delta, Vector2(velocity.x, velocity.z).length())


func _je_voda() -> bool:
	# hladinu zatím určuje mapa povrchu (barva 0); přesnou vodu řeší fyzika vody později
	return false
