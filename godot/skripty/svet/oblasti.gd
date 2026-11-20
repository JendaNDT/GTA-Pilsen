class_name Oblasti
extends Node3D
## Ve hře vkládá upravitelné oblasti (res://svet/oblasti/) kolem hráče: zastávky a autorovy úpravy.
## Oblast se vloží na svůj střed, takže její obsah leží na stejném místě jako v editoru.

@export var sledovat: Node3D
@export var dosah := 1400.0

var _nactene := {}      # Vector2i -> Oblast
var _odpocet := 0.0


func _process(delta: float) -> void:
	_odpocet -= delta
	if _odpocet > 0.0 or sledovat == null or not Mapa.nacteno:
		return
	_odpocet = 0.5
	aktualizuj(Vector2(sledovat.global_position.x, sledovat.global_position.z))


func aktualizuj(stred: Vector2) -> void:
	var chci := {}
	var b0 := Oblast.bunka_bodu(stred.x - dosah, stred.y - dosah)
	var b1 := Oblast.bunka_bodu(stred.x + dosah, stred.y + dosah)
	for bz in range(b0.y, b1.y + 1):
		for bx in range(b0.x, b1.x + 1):
			var b := Vector2i(bx, bz)
			var s := Oblast.stred_bunky(b)
			if s.distance_to(stred) - Oblast.VELIKOST * 0.7071 <= dosah:
				chci[b] = true
	for b: Vector2i in _nactene.keys():
		if not chci.has(b):
			_nactene[b].queue_free()
			_nactene.erase(b)
	for b: Vector2i in chci:
		if _nactene.has(b):
			continue
		var cesta := Oblast.cesta(b)
		if not ResourceLoader.exists(cesta):
			_nactene[b] = Node3D.new()
			add_child(_nactene[b])
			continue
		var o: Node3D = (load(cesta) as PackedScene).instantiate()
		if o is Oblast:
			(o as Oblast).nahled = false
			o.position = Vector3(o.stred.x, 0, o.stred.y)
		add_child(o)
		_nactene[b] = o


## Všechny zastávky v načtených oblastech.
func zastavky() -> Array[Zastavka]:
	var out: Array[Zastavka] = []
	for o: Node in _nactene.values():
		var z := o.get_node_or_null("Zastavky")
		if z:
			for n in z.get_children():
				if n is Zastavka:
					out.append(n)
	return out
