@tool
class_name Oblast
extends Node3D
## Upravitelná oblast mapy 1 × 1 km. Scény oblastí jsou v res://svet/oblasti/.
##
## Souřadnice uvnitř scény jsou vztažené ke středu oblasti (počátek scény = střed), výška y je
## stejná jako ve hře. Ve hře se oblast vloží na svůj střed. V editoru se kolem počátku
## postaví náhled skutečného okolí (terén, silnice, budovy), který se do scény neukládá.
##
## Podřízené uzly:
##   Zastavky – stanoviště MHD (vytváří importér, můžeš je posouvat a přejmenovat)
##   Upravy   – tvoje vlastní objekty: překážky, rekvizity, značky… (importér je nemění)

const VELIKOST := 1024.0
const SLOZKA := "res://svet/oblasti/"

## Složka se scénami oblastí (zkoušky ji mohou přesměrovat jinam).
static var slozka := SLOZKA

## Číslo buňky (sloupec, řádek) v mřížce 1 km.
@export var bunka := Vector2i.ZERO
## Střed oblasti v herních souřadnicích (x, z).
@export var stred := Vector2.ZERO
@export var nahled := true:
	set(v):
		nahled = v
		if Engine.is_editor_hint() and is_inside_tree():
			_nahled_obnov()
@export_range(256, 1500, 64) var nahled_dohled := 760.0

var _svet: Node3D


func _ready() -> void:
	if Engine.is_editor_hint():
		_nahled_obnov()


func _nahled_obnov() -> void:
	if _svet:
		_svet.queue_free()
		_svet = null
	if not nahled or not Mapa.nacti():
		return
	_svet = Svet.new()
	_svet.name = "NahledOkoli"
	_svet.nahled_stred = stred
	_svet.nahled_dohled = nahled_dohled
	_svet.rozpocet_ms = 25.0
	_svet.position = Vector3(-stred.x, 0, -stred.y)
	add_child(_svet, false, Node.INTERNAL_MODE_FRONT)


## Buňka, do které patří bod (x, z).
static func bunka_bodu(x: float, z: float) -> Vector2i:
	Mapa.nacti()
	return Vector2i(floori((x - Mapa.min_x) / VELIKOST), floori((z - Mapa.min_z) / VELIKOST))


static func stred_bunky(b: Vector2i) -> Vector2:
	Mapa.nacti()
	return Vector2(Mapa.min_x + (b.x + 0.5) * VELIKOST, Mapa.min_z + (b.y + 0.5) * VELIKOST)


static func cesta(b: Vector2i) -> String:
	return slozka + "oblast_%d_%d.tscn" % [b.x, b.y]
